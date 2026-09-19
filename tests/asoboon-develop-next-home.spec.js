const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.ASOBOON_BASE_URL || 'http://127.0.0.1:4173/miniapp-v2/develop/';
const LOCAL_INDEX = path.join(process.cwd(), 'miniapp-v2/develop/index.html');

async function installNextHome(page, liffMode = 'resolve', statusFixture = null) {
  await page.addInitScript(() => {
    const RealDate = Date;
    const fixed = new RealDate('2026-09-19T03:00:00.000Z').valueOf();
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    };
  });
  await page.route(BASE, async route => {
    if (process.env.ASOBOON_BASE_URL) return route.continue();
    const html = fs.readFileSync(LOCAL_INDEX, 'utf8')
      .replace(/\.\/home-v(?:35|37)\.css\?v=[^\"']+/, './home-v38.css?v=next-test')
      .replace(/\.\/home-v(?:35|37)\.js\?v=[^\"']+/, './home-v38.js?v=next-test');
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });
  await page.route('https://asoboon-miniapp-v2-develop-gateway.asoboon425.workers.dev/**', async route => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action') || new URLSearchParams(route.request().postData() || '').get('action');
    if (action === 'reservationStatus' && statusFixture) {
      const body = typeof statusFixture.next === 'function' ? statusFixture.next() : statusFixture;
      if (body.delay) await new Promise(resolve => setTimeout(resolve, body.delay));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (url.searchParams.get('action') === 'businessDay') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, operationalDate: '2026-09-19', businessType: '土日祝日', durationLabel: '9:30〜18:00', closingTime: '18:00'
      }) });
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"TEST_OFFLINE"}' });
  });
  await page.route('**/miniapp-v2/develop/env.js*', async route => {
    const env = fs.readFileSync('miniapp-v2/develop/env.js', 'utf8')
      .replace("endpoint:'https://asoboon.github.io/asoboon-stamp/miniapp-v2/develop/'", `endpoint:'${BASE}'`);
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: env });
  });
  await page.route('https://static.line-scdn.net/**', async route => {
    if (liffMode === 'missing') return route.abort();
    const init = liffMode === 'pending' ? 'new Promise(()=>{})'
      : liffMode === 'reject' ? 'Promise.reject(new Error("MOCK_LIFF_REJECT"))'
        : 'Promise.resolve()';
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.liff={isInClient:()=>true,init:()=>${init},isLoggedIn:()=>${statusFixture?'true':'false'},getAccessToken:()=>${statusFixture?'"test_access_token_abcdefghijklmnopqrstuvwxyz"':'""'},getProfile:()=>Promise.resolve({displayName:'Test'})};`
    });
  });
}

async function openStatusScenario(page, statusFixture) {
  await page.addInitScript(() => {
    const now = Date.now();
    localStorage.setItem('asoboon_v2_current_reservation_develop_v1', JSON.stringify({ receiptNo: 'F123', businessDate: '2026-09-19', waitTypeId: '0042' }));
    localStorage.setItem('asoboon_v2_callstatus_session_develop_v1', JSON.stringify({ sessionToken: 's'.repeat(40), receiptNo: 'F123', businessDate: '2026-09-19', waitTypeId: '0042', expiresAt: now + 3600000 }));
  });
  await installNextHome(page, 'resolve', statusFixture);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.v38-home')).toBeVisible();
}

async function openNextHome(page, liffMode = 'resolve') {
  await installNextHome(page, liffMode);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.v38-home')).toBeVisible();
  await expect(page.locator('#v38Hero')).toContainText('当日受付');
}

async function setStatus(page, detail) {
  await page.evaluate(value => window.dispatchEvent(new CustomEvent('asoboon:v8-home-status', { detail: value })), detail);
}

const routes = [
  ['[data-v7-view="reception"]', 'reception', null, /受付/],
  ['[data-v7-view="first"]:not([data-v7-panel])', 'first', null, /初めての方/],
  ['[data-v7-view="first"][data-v7-panel="price"]', 'first', 'price', /料金/],
  ['[data-v7-view="parking"]', 'parking', null, /駐車場/],
  ['[data-v7-view="rules"]', 'rules', null, /館内ルール/],
  ['[data-v7-view="entry"]', 'entry', null, /一時退場/],
  ['#v38Today', 'timeguide', null, /利用時間/],
];

test('inactive next HOME exposes every required route on the stable navigator', async ({ page }) => {
  await openNextHome(page);
  for (const [selector, view, panel, heading] of routes) {
    await page.locator(selector).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe(view);
    if (panel) await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe(panel);
    await expect(page.locator('main.view')).toContainText(heading);
    await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
    await expect(page.locator('.v38-home')).toBeVisible();
  }
  await expect(page.locator('.v38-fun-card[disabled]')).toHaveCount(3);
  await expect(page.locator('.v38-fun')).toContainText('準備中');
});

test('next HOME renders none, waiting, calling, guide and canceled states', async ({ page }) => {
  await openNextHome(page);
  await setStatus(page, { kind: 'none' });
  await expect(page.locator('#v38Hero')).toContainText('当日受付');
  await setStatus(page, { kind: 'waiting', receipt: 'F123', ahead: 7 });
  await expect(page.locator('#v38Hero')).toContainText('順番待ち');
  await expect(page.locator('#v38Hero')).toContainText('受付番号 F123');
  await expect(page.locator('#v38Hero')).toContainText('7');
  await setStatus(page, { kind: 'calling', receipt: 'F123' });
  await expect(page.locator('#v38Hero')).toContainText('入場できます！');
  await expect(page.locator('#v38Hero')).toContainText('呼出後30分以内');
  await setStatus(page, { kind: 'guide', receipt: 'F123' });
  await expect(page.locator('#v38Hero')).toContainText('ご利用中');
  await setStatus(page, { kind: 'none', canceled: true });
  await expect(page.locator('#v38Hero')).toContainText('受付は取消済みです');
  await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toBeVisible();
});

for (const mode of ['resolve', 'reject', 'pending', 'missing']) {
  test(`next HOME stays clickable when LIFF is ${mode}`, async ({ page }) => {
    await openNextHome(page, mode);
    await page.locator('[data-v7-view="first"][data-v7-panel="price"]').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe('price');
    await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
    await expect(page.locator('.v38-home')).toBeVisible();
  });
}

test('next HOME tolerates startup click, repeated click, history and lifecycle events', async ({ page }) => {
  await installNextHome(page, 'pending');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const price = page.locator('[data-v7-view="first"][data-v7-panel="price"]');
  await price.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe('price');
  await page.goBack();
  await expect(page.locator('.v38-home')).toBeVisible();
  await page.goForward();
  await expect(page.locator('main.view')).toContainText('料金');
  await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
  const rules = page.locator('[data-v7-view="rules"]');
  await rules.evaluate(element => { element.click(); element.click(); });
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('rules');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
  await expect(page.locator('.v38-home')).toBeVisible();
});

test('v38 Japanese copy has no decorative English or emoji', async ({ page }) => {
  await openNextHome(page);
  const text = await page.locator('.v38-home').innerText();
  for (const banned of ['TODAY ACTION', 'GUIDE', 'FUN', 'NOW CALLING', 'IN ASOBOON', 'CANCELED']) {
    expect(text).not.toContain(banned);
  }
  expect(text).not.toMatch(/[🎮🎯🔩🎫🔔⏱️]/u);
  expect((text.match(/確認/g) || []).length).toBeLessThanOrEqual(1);
});

test('HOME waiting and callstatus waiting remain consistent', async ({ page }) => {
  const status = { ok: true, found: true, state: 'waiting', receiptNo: 'F123', businessDate: '2026-09-19', aheadCount: 8, checkedAt: Date.now() };
  await openStatusScenario(page, status);
  await expect(page.locator('#v38Hero')).toContainText('あと8組');
  await page.locator('#v38Hero [data-v7-view="callstatus"]').click();
  await expect(page.locator('#csQueue')).toContainText('8組');
  await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
  await expect(page.locator('#v38Hero')).toContainText('あと8組');
});

test('callstatus canceled immediately owns HOME and survives lifecycle refresh', async ({ page }) => {
  const status = { ok: true, found: true, state: 'canceled', receiptNo: 'F123', businessDate: '2026-09-19', checkedAt: Date.now() };
  await openStatusScenario(page, status);
  await setStatus(page, { kind: 'sync', receipt: 'F123' });
  await page.locator('#v38Hero [data-v7-view="callstatus"]').click();
  await expect(page.locator('#csState')).toContainText('受付は取消になっています');
  await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
  await expect(page.locator('#v38Hero')).toContainText('受付は取消済みです');
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(page.locator('#v38Hero')).toContainText('受付は取消済みです');
});

test('callstatus calling updates HOME to admission state', async ({ page }) => {
  const status = { ok: true, found: true, state: 'calling', receiptNo: 'F123', businessDate: '2026-09-19', aheadCount: 0, checkedAt: Date.now() };
  await openStatusScenario(page, status);
  await expect(page.locator('#v38Hero')).toContainText('入場できます！');
});

for (const state of ['hold', 'processing', 'done']) {
  test(`callstatus ${state} updates HOME to in-use state`, async ({ page }) => {
    await openStatusScenario(page, { ok: true, found: true, state, receiptNo: 'F123', businessDate: '2026-09-19', checkedAt: Date.now() });
    await expect(page.locator('#v38Hero')).toContainText('ご利用中');
  });
}

test('missing session settles on an actionable error instead of loading forever', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('asoboon_v2_current_reservation_develop_v1', JSON.stringify({ receiptNo: 'F123', businessDate: '2026-09-19' })));
  await installNextHome(page, 'resolve');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#v38Hero')).toContainText('受付状況を取得できません');
  await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toContainText('呼出状況を見る');
});

test('LIFF-ready during refresh queues exactly one follow-up refresh', async ({ page }) => {
  let calls = 0;
  const fixture = { next: () => ({ ok: true, found: true, state: 'waiting', receiptNo: 'F123', businessDate: '2026-09-19', aheadCount: ++calls === 1 ? 9 : 8, checkedAt: Date.now(), delay: calls === 1 ? 250 : 0 }) };
  await openStatusScenario(page, fixture);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('asoboon:v2-liff-ready')));
  await expect.poll(() => calls).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#v38Hero')).toContainText('あと8組');
});

for (const width of [320, 375, 390, 430]) {
  test(`v38 visual viewport ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openNextHome(page);
    const output = path.join('test-results', 'v38-visual');
    fs.mkdirSync(output, { recursive: true });
    await expect(page.locator('.v38-home')).toBeVisible();
    await expect(page.locator('.v38-action.primary')).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    const meaningfulSizes = await page.evaluate(() => [...document.querySelectorAll('.v38-hero p,.v38-action,.v38-today small,.v38-today strong,.v38-guide-card strong,.v38-guide-card small,.v38-fun-card strong,.v38-fun-card small')].map(el => parseFloat(getComputedStyle(el).fontSize)));
    expect(Math.min(...meaningfulSizes)).toBeGreaterThanOrEqual(13);
    await page.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true });
    if (width === 390) {
      const blurStyle = await page.addStyleTag({ content: '.v38-home *{color:transparent!important;text-shadow:0 0 7px rgba(0,0,0,.65)!important}' });
      await page.screenshot({ path: path.join(output, 'home-390-blur.png'), fullPage: true });
      await blurStyle.evaluate(element => element.remove());
      await page.addStyleTag({ content: 'html{filter:grayscale(1)!important}' });
      await page.screenshot({ path: path.join(output, 'home-390-gray.png'), fullPage: true });
    }
  });
}
