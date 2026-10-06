const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const HOST = 'https://asoboon.github.io/asoboon-stamp/';
const PROD = `${HOST}miniapp-v2/production/`;
const DEV = `${HOST}miniapp-v2/develop/`;
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', webp: 'image/webp', png: 'image/png', json: 'application/json', csv: 'text/csv', svg: 'image/svg+xml' };

/* Behaves like the real LIFF SDK as read from sdk.js: with liff.state present, init() location.replace()s to
 * endpoint + state and returns a promise that NEVER resolves. */
const FAKE_LIFF = `(()=>{
const endpoint=()=>window.ASOBOON_V2_ENV&&window.ASOBOON_V2_ENV.endpoint;
const slash=e=>e&&!e.startsWith('/')?'/'+e:e;
window.__liffInitCalls=(window.__liffInitCalls||0);
window.liff={isInClient:()=>true,isLoggedIn:()=>false,getProfile:async()=>({}),
 init(){sessionStorage.setItem('liffInit',String(1+Number(sessionStorage.getItem('liffInit')||0)));
  const st=new URLSearchParams(location.search).get('liff.state');
  if(st){const e=new URL(endpoint());const c=new URL(e.origin+slash(st));let p=(e.pathname+slash(c.pathname)).replace('//','/');
   const target=e.origin+p+c.search+c.hash;location.replace(target);return new Promise(()=>{})}
  return Promise.resolve()}};
})();`;

async function setup(page, { fixedTime } = {}) {
  if (fixedTime) await page.clock.install({ time: new Date(fixedTime) });
  await page.addInitScript(() => {
    /* record whether HOME was ever visibly painted (aq-go hides it during the handoff) */
    const tick = () => {
      if (document.querySelector('.home-shell') && !document.documentElement.classList.contains('aq-go')) sessionStorage.setItem('homeVisible', '1');
      if (performance.now() < 3000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.includes('static.line-scdn.net/liff')) return route.fulfill({ status: 200, contentType: TYPES.js, body: FAKE_LIFF });
    if (url.startsWith(HOST)) {
      const rel = decodeURIComponent(new URL(url).pathname.slice('/asoboon-stamp/'.length));
      let file = path.join(ROOT, rel);
      if (rel.endsWith('/') || rel === '') file = path.join(file, 'index.html');
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: 'nf' });
      return route.fulfill({ status: 200, contentType: TYPES[path.extname(file).slice(1)] || 'application/octet-stream', body: fs.readFileSync(file) });
    }
    if (url.startsWith('data:') || url.startsWith('about:')) return route.continue();
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}
const li = suffix => `${PROD}?liff.state=${encodeURIComponent(suffix)}`;
const overlay = page => ({ kicker: page.locator('#overlayKicker'), title: page.locator('#overlayTitle'), text: page.locator('#overlayText'), box: page.locator('#overlay') });

const PARTS = [['engine', 'エンジン'], ['wheel', 'タイヤ'], ['headlight', 'ライト'], ['fin', 'フィン'], ['grille', 'グリル'], ['key', 'キー']];

for (const src of ['nfc', 'qr']) {
  for (const [id, name] of PARTS) {
    test(`LINE first hop ?aq=${id}&src=${src} (production) -> ASOQUEST ${id} 1/6, HOME never visible, liff.init skipped`, async ({ page }) => {
      await setup(page);
      await page.goto(li(`?aq=${id}&src=${src}`), { waitUntil: 'commit' });
      const o = overlay(page);
      await expect(o.box).toHaveClass(/show/, { timeout: 8000 });
      expect(new URL(page.url()).pathname).toBe('/asoboon-stamp/miniapp-v2/production/asoquest/');
      await expect(o.kicker).toHaveText('パーツゲット！');
      await expect(o.title).toHaveText(name);
      await expect(o.text).toHaveText('マシンにパーツが追加された！');
      await expect(page.locator('#partsCount')).toHaveText('1 / 6');
      expect(await page.evaluate(() => sessionStorage.getItem('homeVisible'))).toBeNull();
      expect(await page.evaluate(() => sessionStorage.getItem('liffInit'))).toBeNull();
    });
  }
}

test('legacy printed URL /asoquest/?part=wheel via liff.state still lands on ASOQUEST', async ({ page }) => {
  await setup(page);
  await page.goto(li('/asoquest/?part=wheel&src=nfc'), { waitUntil: 'commit' });
  await expect(overlay(page).title).toHaveText('タイヤ', { timeout: 8000 });
  await expect(page.locator('#partsCount')).toHaveText('1 / 6');
});

test('Developing endpoint hands off to production ASOQUEST (no env mixing)', async ({ page }) => {
  await setup(page);
  await page.goto(`${DEV}?liff.state=${encodeURIComponent('?aq=key&src=nfc')}`, { waitUntil: 'commit' });
  await expect(overlay(page).title).toHaveText('キー', { timeout: 8000 });
  expect(new URL(page.url()).pathname).toBe('/asoboon-stamp/miniapp-v2/production/asoquest/');
});

test('second hop (direct endpoint ?aq=) also works', async ({ page }) => {
  await setup(page);
  await page.goto(`${PROD}?aq=fin&src=qr`, { waitUntil: 'commit' });
  await expect(overlay(page).title).toHaveText('フィン', { timeout: 8000 });
});

test('ENGINE START via deep link: 0/6 -> あと6こ; 6/6 -> CLEAR; duplicates do not count', async ({ page }) => {
  await setup(page);
  await page.goto(li('?aq=start&src=nfc'), { waitUntil: 'commit' });
  const o = overlay(page);
  await expect(o.kicker).toHaveText('ENGINE START', { timeout: 8000 });
  await expect(o.title).toHaveText('まだ足りない！');
  await expect(o.text).toHaveText('あと6こ集めよう！');
  await expect(page.locator('#partsCount')).toHaveText('0 / 6');

  await page.goto(li('?aq=engine&src=nfc'), { waitUntil: 'commit' });
  await expect(page.locator('#partsCount')).toHaveText('1 / 6', { timeout: 8000 });
  await page.goto(li('?aq=engine&src=nfc'), { waitUntil: 'commit' });
  await expect(o.kicker).toHaveText('ゲット済み！', { timeout: 8000 });
  await expect(page.locator('#partsCount')).toHaveText('1 / 6');

  for (const [id] of PARTS.slice(1)) {
    await page.goto(li(`?aq=${id}&src=qr`), { waitUntil: 'commit' });
    await expect(o.kicker).toHaveText('パーツゲット！', { timeout: 8000 });
  }
  await expect(page.locator('#partsCount')).toHaveText('6 / 6');

  await page.goto(li('?aq=start&src=nfc'), { waitUntil: 'commit' });
  await expect(o.kicker).toHaveText('ENGINE START', { timeout: 8000 });
  await expect(o.title).toHaveText('エンジン始動！');
  await expect(page.locator('#engineTitle')).toHaveText('COMPLETE');
  await expect(o.title).toHaveText('アソクエ クリア！', { timeout: 3000 });
  /* re-access after clear stays clear */
  await page.goto(li('?aq=start&src=nfc'), { waitUntil: 'commit' });
  await expect(page.locator('#engineTitle')).toHaveText('COMPLETE', { timeout: 8000 });
});

test('ASOQUEST direct ?part= / ?station= (game logic untouched)', async ({ page }) => {
  await setup(page);
  for (const [id, name] of PARTS) {
    await page.context().clearCookies();
    await page.goto(`${PROD}asoquest/`);
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${PROD}asoquest/?part=${id}&src=nfc`);
    await expect(overlay(page).title).toHaveText(name);
    await expect(page.locator('#partsCount')).toHaveText('1 / 6');
  }
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${PROD}asoquest/?station=engine`);
  await expect(overlay(page).text).toHaveText('あと6こ集めよう！');
});

test.describe('19:00 JST reset', () => {
  test('18:59:59 keeps cycle, 19:00:00 starts a new cycle (reload)', async ({ page }) => {
    await setup(page, { fixedTime: '2026-10-06T09:59:59Z' }); // 18:59:59 JST
    await page.goto(`${PROD}asoquest/?part=wheel`);
    await expect(page.locator('#partsCount')).toHaveText('1 / 6');
    const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('asoquest:v9:')));
    expect(keys).toEqual(['asoquest:v9:2026-10-05']);
    await page.clock.setFixedTime(new Date('2026-10-06T10:00:00Z')); // 19:00:00 JST
    await page.goto(`${PROD}asoquest/`);
    await expect(page.locator('#partsCount')).toHaveText('0 / 6');
    const keys2 = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('asoquest:v9:')));
    expect(keys2).toEqual([]);
  });
  test('midnight does not reset (same cycle until next 19:00)', async ({ page }) => {
    await setup(page, { fixedTime: '2026-10-06T10:00:30Z' }); // 19:00:30 JST
    await page.goto(`${PROD}asoquest/?part=key`);
    await expect(page.locator('#partsCount')).toHaveText('1 / 6');
    await page.clock.setFixedTime(new Date('2026-10-06T15:30:00Z')); // 00:30 JST next day
    await page.goto(`${PROD}asoquest/`);
    await expect(page.locator('#partsCount')).toHaveText('1 / 6');
    await page.clock.setFixedTime(new Date('2026-10-07T09:59:59Z')); // 18:59:59 JST next day
    await page.goto(`${PROD}asoquest/`);
    await expect(page.locator('#partsCount')).toHaveText('1 / 6');
  });
  test('page left open resets when the clock crosses 19:00 JST', async ({ page }) => {
    await setup(page, { fixedTime: '2026-10-07T09:59:50Z' }); // 18:59:50 JST, time keeps flowing
    await page.goto(`${PROD}asoquest/?part=key`);
    await expect(page.locator('#partsCount')).toHaveText('1 / 6');
    await page.clock.fastForward(20000); // -> 19:00:10 JST
    await expect(page.locator('#partsCount')).toHaveText('0 / 6');
  });
});

test.describe('router / HOME regression', () => {
  test('production HOME plain URL stays HOME and still calls liff.init', async ({ page }) => {
    await setup(page);
    await page.goto(PROD);
    await expect(page.locator('.home-shell')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('liffInit'))).toBe('1');
    expect(await page.evaluate(() => window.ASOBOON_ASOQUEST_HANDOFF)).toBeUndefined();
  });
  test('Developing HOME keeps BOON BLOCK + ASOQUEST + existing contents', async ({ page }) => {
    await setup(page);
    await page.goto(DEV);
    const body = page.locator('body');
    await expect(body).toContainText('BOON BLOCK');
    await expect(body).toContainText('ASOQUEST');
    for (const t of ['ブーンジャンプ', 'ブーンRUN', 'おみくじ', 'スタンプラリー']) await expect(body).toContainText(t);
  });
  test('Developing ?view=reception / callstatus / timeguide / rules still route in-app', async ({ page }) => {
    await setup(page);
    for (const v of ['reception', 'callstatus', 'timeguide', 'rules', 'entry', 'first', 'parking']) {
      await page.goto(`${DEV}?view=${v}&mode=before`);
      await expect(page.locator('.page-card, .home-shell').first()).toBeVisible();
      await expect(page.locator('.home-shell')).toHaveCount(0);
      expect(new URL(page.url()).searchParams.get('view')).toBe(v);
    }
  });
  test('LINE first hop to a non-ASOQUEST view is untouched (view=rules via liff.state)', async ({ page }) => {
    await setup(page);
    await page.goto(`${DEV}?liff.state=${encodeURIComponent('?view=rules&mode=inside')}`);
    await expect(page.locator('.page-card')).toBeVisible();
    expect(new URL(page.url()).searchParams.get('view')).toBe('rules');
  });
  test('production ?view=callstatus keeps its operational fallback', async ({ page }) => {
    await setup(page);
    await page.goto(`${PROD}?view=callstatus`);
    await page.waitForURL(/callstatus\.html/);
  });
});

test('slow navigation: HOME stays hidden; after 8s retry + HOME links appear; navigation still completes on ASOQUEST', async ({ page }) => {
  await setup(page);
  /* Playwright locators stall during a pending navigation, so record the stuck screen from inside the page. */
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const el = document.documentElement.lastElementChild;
      if (el && /もう一度ためす/.test(el.textContent || '')) {
        sessionStorage.setItem('stuckUi', '1');
        sessionStorage.setItem('stuckHomeLink', (el.querySelector('a') || {}).href || '');
        sessionStorage.setItem('stuckAqGo', String(document.documentElement.classList.contains('aq-go')));
      }
    }).observe(document, { childList: true, subtree: true });
  });
  let release;
  const gate = new Promise(r => { release = r; });
  await page.route('**/miniapp-v2/production/asoquest/**', async route => { await gate; return route.fallback(); });
  await page.goto(li('?aq=wheel&src=nfc'), { waitUntil: 'commit' });
  await new Promise(r => setTimeout(r, 7000)); // before 8s: nothing shown yet
  await new Promise(r => setTimeout(r, 2500)); // past 8s
  release();
  await expect(page.locator('#overlayTitle')).toHaveText('タイヤ', { timeout: 10000 });
  const r = await page.evaluate(() => ({ stuck: sessionStorage.getItem('stuckUi'), home: sessionStorage.getItem('stuckHomeLink'), aqGo: sessionStorage.getItem('stuckAqGo'), homeVisible: sessionStorage.getItem('homeVisible') }));
  expect(r.stuck).toBe('1');
  expect(r.home).toBe(PROD);
  expect(r.aqGo).toBe('true');
  expect(r.homeVisible).toBeNull();
});

test.describe('debug mode (?debug=asoquest)', () => {
  test('shows panel with href / liff.state, does NOT redirect or init; init button logs outcome', async ({ page }) => {
    await setup(page);
    await page.goto(li('?aq=engine&src=nfc&debug=asoquest'));
    const panel = page.locator('#aqDebugPanel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('liff.state');
    await expect(panel).toContainText('"part": "engine"');
    expect(new URL(page.url()).pathname).toBe('/asoboon-stamp/miniapp-v2/production/');
    expect(await page.evaluate(() => sessionStorage.getItem('liffInit'))).toBeNull();
    await page.getByRole('button', { name: 'ASOQUESTへ遷移' }).click();
    await expect(page.locator('#overlayTitle')).toHaveText('エンジン', { timeout: 8000 });
  });
  test('panel never appears for normal users', async ({ page }) => {
    await setup(page);
    await page.goto(PROD);
    await expect(page.locator('#aqDebugPanel')).toHaveCount(0);
  });
});
