const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const BASE = process.env.ASOBOON_BASE_URL || 'http://127.0.0.1:4173/miniapp-v2/develop/board/';

function payload(rows) {
  return {
    ok: true,
    fetchedAt: new Date().toISOString(),
    refreshAfterMs: 10000,
    slots: [
      { key: '10:00', label: '10:00の回', count: rows.length, rows },
      { key: '12:30', label: '12:30の回', count: 0, rows: [] },
      { key: '15:00', label: '15:00の回', count: 0, rows: [] },
    ],
  };
}

async function installBoard(page, sequence, { reducedMotion = false } = {}) {
  let index = 0;
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.addInitScript(() => {
    const RealDate = Date;
    const fixed = new RealDate('2026-09-19T00:30:00.000Z').valueOf(); // 09:30 JST -> 10:00 board
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    };
  });

  await page.route('https://asoboon-miniapp-v2-develop-gateway.asoboon425.workers.dev/**', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('action') === 'boardStatus') {
      const body = sequence[Math.min(index, sequence.length - 1)];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"TEST_OFFLINE"}' });
  });

  await page.route('**/miniapp-v2/develop/env.js*', async route => {
    const env = fs.readFileSync('miniapp-v2/develop/env.js', 'utf8');
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: env });
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#queueGrid')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.ASOBOON_CALL_BOARD_TEST && window.ASOBOON_BOARD_ANIMATIONS))).toBe(true);
  await page.evaluate(() => window.ASOBOON_BOARD_ANIMATIONS.setRareEnabled(false));

  return {
    pageErrors,
    next() { index = Math.min(index + 1, sequence.length - 1); },
    async refresh() { await page.evaluate(() => window.ASOBOON_CALL_BOARD_TEST.refresh()); },
  };
}

async function diagnostics(page) {
  return page.evaluate(() => window.ASOBOON_BOARD_ANIMATIONS.getDiagnostics());
}

async function waitForFxIdle(page) {
  await expect.poll(async () => (await diagnostics(page)).activeFx, { timeout: 4000 }).toBe(0);
  await expect.poll(async () => (await diagnostics(page)).running, { timeout: 4000 }).toBe(0);
  await expect(page.locator('.fx-card-ghost,.fx-canvas,.fx-onomatopoeia')).toHaveCount(0);
}

test('initial board snapshot never fires status animations', async ({ page }) => {
  const initial = payload([
    { number: '2501', state: 'calling', order: 1 },
    { number: '2502', state: 'hold', order: 2 },
    { number: '2503', state: 'done', order: 3 },
    { number: '2504', state: 'waiting', order: 4 },
  ]);
  const h = await installBoard(page, [initial]);

  await expect(page.locator('.queue-card')).toHaveCount(4);
  const d = await diagnostics(page);
  expect(d.played).toBe(0);
  expect(d.baselines).toBe(1);
  expect(h.pageErrors).toEqual([]);
});

test('call, guided, hold and cancel transitions fire only for the changed number', async ({ page }) => {
  const states = [
    payload([
      { number: '2501', state: 'waiting', order: 1 },
      { number: '2502', state: 'calling', order: 2 },
      { number: '2503', state: 'hold', order: 3 },
      { number: '2504', state: 'waiting', order: 4 },
    ]),
    payload([
      { number: '2501', state: 'calling', order: 1 },
      { number: '2502', state: 'calling', order: 2 },
      { number: '2503', state: 'hold', order: 3 },
      { number: '2504', state: 'waiting', order: 4 },
    ]),
    payload([
      { number: '2501', state: 'done', order: 1 },
      { number: '2502', state: 'calling', order: 2 },
      { number: '2503', state: 'hold', order: 3 },
      { number: '2504', state: 'waiting', order: 4 },
    ]),
    payload([
      { number: '2501', state: 'done', order: 1 },
      { number: '2502', state: 'calling', order: 2 },
      { number: '2503', state: 'hold', order: 3 },
      { number: '2504', state: 'hold', order: 4 },
    ]),
    payload([
      { number: '2501', state: 'done', order: 1 },
      { number: '2502', state: 'calling', order: 2 },
      { number: '2503', state: 'canceled', order: 3 },
      { number: '2504', state: 'hold', order: 4 },
    ]),
  ];
  const h = await installBoard(page, states);

  for (const [number, kind] of [['2501', 'call'], ['2501', 'guided'], ['2504', 'hold'], ['2503', 'cancel']]) {
    h.next();
    await h.refresh();
    await expect.poll(async () => {
      const d = await diagnostics(page);
      return d.history.some(x => x.number === number && x.kind === kind);
    }, { timeout: 2500 }).toBe(true);
    await waitForFxIdle(page);
  }

  const d = await diagnostics(page);
  expect(d.history.map(x => [x.number, x.kind])).toEqual([
    ['2501', 'call'],
    ['2501', 'guided'],
    ['2504', 'hold'],
    ['2503', 'cancel'],
  ]);
  await expect(page.locator('.queue-number')).toHaveText(['2501', '2502', '2504']);
  expect(h.pageErrors).toEqual([]);
});

test('multiple changes update data immediately while effects are safely queued', async ({ page }) => {
  const h = await installBoard(page, [
    payload([
      { number: '3001', state: 'waiting', order: 1 },
      { number: '3002', state: 'waiting', order: 2 },
      { number: '3003', state: 'waiting', order: 3 },
      { number: '3004', state: 'waiting', order: 4 },
    ]),
    payload([
      { number: '3001', state: 'calling', order: 1 },
      { number: '3002', state: 'hold', order: 2 },
      { number: '3003', state: 'canceled', order: 3 },
      { number: '3004', state: 'done', order: 4 },
    ]),
  ]);

  h.next();
  await h.refresh();

  // The current data is rendered before the entertainment layer finishes.
  await expect(page.locator('.queue-number')).toHaveText(['3001', '3002', '3004']);
  await expect(page.locator('.queue-card').nth(0)).toHaveClass(/calling/);
  await expect(page.locator('.queue-card').nth(1)).toHaveClass(/hold/);
  await expect(page.locator('.queue-card').nth(2)).toHaveClass(/done/);

  await expect.poll(async () => (await diagnostics(page)).history.length, { timeout: 3500 }).toBe(4);
  await waitForFxIdle(page);
  const d = await diagnostics(page);
  expect(d.history.map(x => x.kind).sort()).toEqual(['call', 'cancel', 'guided', 'hold']);
  expect(d.running).toBe(0);
  expect(d.activeFx).toBe(0);
  expect(h.pageErrors).toEqual([]);
});

test('reload with existing calling or hold states stays quiet', async ({ page }) => {
  const current = payload([
    { number: '4101', state: 'calling', order: 1 },
    { number: '4102', state: 'hold', order: 2 },
    { number: '4103', state: 'done', order: 3 },
  ]);
  await installBoard(page, [current]);
  expect((await diagnostics(page)).played).toBe(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(window.ASOBOON_BOARD_ANIMATIONS))).toBe(true);
  expect((await diagnostics(page)).played).toBe(0);
});

test('reduced motion keeps transitions readable and disables screen shake', async ({ page }) => {
  const h = await installBoard(page, [
    payload([{ number: '5101', state: 'waiting', order: 1 }]),
    payload([{ number: '5101', state: 'calling', order: 1 }]),
  ], { reducedMotion: true });

  h.next();
  await h.refresh();
  await expect.poll(async () => (await diagnostics(page)).played).toBe(1);
  await waitForFxIdle(page);

  const d = await diagnostics(page);
  expect(d.reduced).toBe(true);
  expect(d.effectiveLevel).toBe(1);
  expect(d.screenShakes).toBe(0);
  await expect(page.locator('.queue-card.calling .queue-number')).toHaveText('5101');
  expect(h.pageErrors).toEqual([]);
});

test('animation controls support OFF through level 3 and rare effects toggle', async ({ page }) => {
  const h = await installBoard(page, [
    payload([{ number: '6101', state: 'waiting', order: 1 }]),
    payload([{ number: '6101', state: 'calling', order: 1 }]),
  ]);
  await page.evaluate(() => {
    window.ASOBOON_BOARD_ANIMATIONS.setLevel(0);
    window.ASOBOON_BOARD_ANIMATIONS.setRareEnabled(false);
  });
  h.next();
  await h.refresh();
  await expect(page.locator('.queue-card.calling')).toHaveCount(1);
  expect((await diagnostics(page)).played).toBe(0);

  const values = await page.evaluate(() => {
    const fx = window.ASOBOON_BOARD_ANIMATIONS;
    return [fx.setLevel(1), fx.setLevel(2), fx.setLevel(3), fx.setRareEnabled(true), fx.getLevel(), fx.isRareEnabled()];
  });
  expect(values).toEqual([1, 2, 3, true, 3, true]);
});
