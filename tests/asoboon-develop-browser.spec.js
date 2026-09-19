const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const BASE = process.env.ASOBOON_BASE_URL || 'http://127.0.0.1:4173/miniapp-v2/develop/';

async function installLiff(page, mode) {
  await page.addInitScript(() => {
    const RealDate = Date;
    const fixed = new RealDate('2026-09-19T03:00:00.000Z').valueOf();
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    };
  });
  await page.route('https://asoboon-miniapp-v2-develop-gateway.asoboon425.workers.dev/**', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('action') === 'businessDay') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, operationalDate: '2026-09-19', businessType: '土日祝日', closingTime: '18:00'
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
    if (mode === 'missing') return route.abort();
    const init = mode === 'pending'
      ? 'new Promise(()=>{})'
      : mode === 'reject'
        ? 'Promise.reject(new Error("MOCK_LIFF_REJECT"))'
        : 'Promise.resolve()';
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.liff={isInClient:()=>true,init:()=>${init},isLoggedIn:()=>false,getProfile:()=>Promise.resolve({displayName:'Test'})};`
    });
  });
}

async function openHome(page, mode) {
  await installLiff(page, mode);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.v35-home')).toBeVisible();
}

const routes = [
  ['[data-v7-view="reception"]', 'reception', null, /受付/],
  ['[data-v7-view="first"]:not([data-v7-panel])', 'first', null, /初めての方/],
  ['[data-v7-view="first"][data-v7-panel="price"]', 'first', 'price', /料金/],
  ['[data-v7-view="parking"]', 'parking', null, /駐車場/],
  ['[data-v7-view="rules"]', 'rules', null, /館内ルール/],
  ['[data-v7-view="entry"]', 'entry', null, /一時退場/],
  ['[data-v7-view="timeguide"]', 'timeguide', null, /利用時間/],
];

for (const mode of ['resolve', 'reject', 'pending', 'missing']) {
  test(`HOME navigation remains live when LIFF is ${mode}`, async ({ page }) => {
    await openHome(page, mode);
    for (const [selector, view, panel, heading] of routes) {
      const target = page.locator(selector);
      await expect(target).toHaveCount(1);
      await target.click();
      await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe(view);
      if (panel) await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe(panel);
      await expect(page.locator('main.view')).toContainText(heading);
      await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('home');
      await expect(page.locator('.v35-home')).toBeVisible();
    }
  });
}

test('rapid click, back/forward, focus and visibility do not lock navigation', async ({ page }) => {
  await openHome(page, 'pending');
  const price = page.locator('[data-v7-view="first"][data-v7-panel="price"]');
  await price.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe('price');
  await page.goBack();
  await expect(page.locator('.v35-home')).toBeVisible();
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
  await expect(page.locator('.v35-home')).toBeVisible();
});
