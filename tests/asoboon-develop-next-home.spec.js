const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.ASOBOON_BASE_URL || 'http://127.0.0.1:4173/miniapp-v2/develop/';
const LOCAL_INDEX = path.join(process.cwd(), 'miniapp-v2/develop/index.html');

async function installNextHome(page, liffMode = 'resolve') {
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
      .replace(/\.\/home-v35\.css\?v=[^\"']+/, './home-v37.css?v=next-test')
      .replace(/\.\/home-v35\.js\?v=[^\"']+/, './home-v37.js?v=next-test');
    await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });
  await page.route('https://asoboon-miniapp-v2-develop-gateway.asoboon425.workers.dev/**', async route => {
    const url = new URL(route.request().url());
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
      body: `window.liff={isInClient:()=>true,init:()=>${init},isLoggedIn:()=>false,getProfile:()=>Promise.resolve({displayName:'Test'})};`
    });
  });
}

async function openNextHome(page, liffMode = 'resolve') {
  await installNextHome(page, liffMode);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.v37-home')).toBeVisible();
  await expect(page.locator('#v37Hero')).toContainText('本日の当日受付');
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
  ['#v37Today', 'timeguide', null, /利用時間/],
];

test('inactive next HOME exposes every required route on the stable navigator', async ({ page }) => {
  await openNextHome(page);
  for (const [selector, view, panel, heading] of routes) {
    await page.locator(selector).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe(view);
    if (panel) await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe(panel);
    await expect(page.locator('main.view')).toContainText(heading);
    await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
    await expect(page.locator('.v37-home')).toBeVisible();
  }
  await expect(page.locator('.v37-fun-card[disabled]')).toHaveCount(3);
  await expect(page.locator('.v37-fun')).toContainText('準備中');
});

test('next HOME renders none, waiting, calling, guide and canceled states', async ({ page }) => {
  await openNextHome(page);
  await setStatus(page, { kind: 'none' });
  await expect(page.locator('#v37Hero')).toContainText('本日の当日受付');
  await setStatus(page, { kind: 'waiting', receipt: 'F123', ahead: 7 });
  await expect(page.locator('#v37Hero')).toContainText('順番待ち');
  await expect(page.locator('#v37Hero')).toContainText('受付番号 F123');
  await expect(page.locator('#v37Hero')).toContainText('7');
  await setStatus(page, { kind: 'calling', receipt: 'F123' });
  await expect(page.locator('#v37Hero')).toContainText('入場できます！');
  await expect(page.locator('#v37Hero')).toContainText('呼出後30分以内');
  await setStatus(page, { kind: 'guide', receipt: 'F123' });
  await expect(page.locator('#v37Hero')).toContainText('ご利用中のご案内');
  await setStatus(page, { kind: 'none', canceled: true });
  await expect(page.locator('#v37Hero')).toContainText('当日受付は取消済みです');
  await expect(page.locator('#v37Hero [data-v7-view="reception"]')).toBeVisible();
});

for (const mode of ['resolve', 'reject', 'pending', 'missing']) {
  test(`next HOME stays clickable when LIFF is ${mode}`, async ({ page }) => {
    await openNextHome(page, mode);
    await page.locator('[data-v7-view="first"][data-v7-panel="price"]').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe('price');
    await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
    await expect(page.locator('.v37-home')).toBeVisible();
  });
}

test('next HOME tolerates startup click, repeated click, history and lifecycle events', async ({ page }) => {
  await installNextHome(page, 'pending');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const price = page.locator('[data-v7-view="first"][data-v7-panel="price"]');
  await price.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe('price');
  await page.goBack();
  await expect(page.locator('.v37-home')).toBeVisible();
  await page.goForward();
  await expect(page.locator('main.view')).toContainText('料金');
  await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
  const rules = page.locator('[data-v7-view="rules"]');
  await Promise.all([rules.click(), rules.click()]);
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('rules');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
  await expect(page.locator('.v37-home')).toBeVisible();
});
