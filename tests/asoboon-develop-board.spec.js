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
  await expect.poll(() => page.evaluate(() => Boolean(window.ASOBOON_CALL_BOARD_TEST && window.ASOBOON_BOARD_EFFECTS && window.ASOBOON_BOARD_WORLD && window.ASOBOON_BOARD_ANIMATIONS && window.ASOBOON_BOARD_IDLE_EVENTS))).toBe(true);
  await page.evaluate(() => { window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.05,{persistValue:false}); window.ASOBOON_BOARD_ANIMATIONS.setRareEnabled(false); });

  return {
    pageErrors,
    next() { index = Math.min(index + 1, sequence.length - 1); },
    async refresh() { await page.evaluate(() => window.ASOBOON_CALL_BOARD_TEST.refresh()); },
  };
}

async function diagnostics(page) {
  return page.evaluate(() => window.ASOBOON_BOARD_ANIMATIONS.getDiagnostics());
}

async function idleDiagnostics(page) {
  return page.evaluate(() => window.ASOBOON_BOARD_IDLE_EVENTS.getDiagnostics());
}

async function prepareIdleForTest(page, patch = {}) {
  await page.evaluate(config => {
    const idle = window.ASOBOON_BOARD_IDLE_EVENTS;
    idle.resetForTest();
    idle.setConfig({
      ANIMATION_ENABLED: true,
      ANIMATION_LEVEL: 1,
      IDLE_EVENTS_ENABLED: true,
      IDLE_EVENT_CHANCE: 1,
      RARE_EVENTS_ENABLED: true,
      INITIAL_QUIET_MS: 0,
      REAL_CHANGE_COOLDOWN_MS: 0,
      IDLE_POST_COOLDOWN_MIN_MS: 0,
      IDLE_POST_COOLDOWN_MAX_MS: 0,
      ...config,
    });
    idle.onBaseline();
  }, patch);
}

async function waitForFxIdle(page) {
  await expect.poll(async () => (await diagnostics(page)).activeFx, { timeout: 7000 }).toBe(0);
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


test('idle entertainment catalog has at least 60 non-reward events', async ({ page }) => {
  const current = payload([
    { number: '7001', state: 'waiting', order: 1 },
    { number: '7002', state: 'waiting', order: 2 },
  ]);
  await installBoard(page, [current]);
  const catalog = await page.evaluate(() => window.ASOBOON_BOARD_IDLE_EVENTS.events.map(e => ({ id: e.id, tier: e.tier })));
  expect(catalog.length).toBeGreaterThanOrEqual(60);
  expect(new Set(catalog.map(x => x.id)).size).toBe(catalog.length);
  for (const item of catalog) expect(['small','medium','large','rare']).toContain(item.tier);
  const text = JSON.stringify(catalog).toUpperCase();
  for (const banned of ['JACKPOT','BONUS','COIN','SCORE','GACHA']) expect(text).not.toContain(banned);
});


test('fullscreen world audit covers every current idle event individually', async ({ page }) => {
  const current = payload([{ number: '7010', state: 'waiting', order: 1 }]);
  await installBoard(page, [current]);

  const result = await page.evaluate(() => {
    const fx = window.ASOBOON_BOARD_EFFECTS;
    const idle = window.ASOBOON_BOARD_IDLE_EVENTS;
    const world = window.ASOBOON_BOARD_WORLD;
    fx.setSlowdown(2.5,{persistValue:false});
    const audit = idle.audit();
    const worldDiag = world.diagnostics(idle.events);
    const idleDiag = idle.getDiagnostics();
    const statusDiag = window.ASOBOON_BOARD_ANIMATIONS.getDiagnostics();
    fx.setSlowdown(0.05,{persistValue:false});
    return { audit, worldDiag, idleDiag, statusDiag };
  });

  expect(result.audit).toHaveLength(63);
  expect(new Set(result.audit.map(x => x.id)).size).toBe(63);
  expect(new Set(result.audit.map(x => x.signature)).size).toBe(63);
  for (const row of result.audit) {
    expect(row.anticipation).toBe(true);
    expect(row.action).toBe(true);
    expect(row.climax).toBe(true);
    expect(row.afterglow).toBe(true);
    expect(row.fullScreen).toBe(true);
    expect(row.slowdown).toBe(true);
    expect(row.cleanup).toBe(true);
    expect(row.resident).toBeTruthy();
    expect(row.gag).toBeTruthy();
    expect(row.story.length).toBeGreaterThan(3);
    expect(row.revisedAtCurrentSlowdownMs).toBeGreaterThanOrEqual(2500);
    expect(row.revisedAtCurrentSlowdownMs).toBeLessThanOrEqual(9000);
  }

  expect(result.worldDiag.residentCount).toBe(6);
  expect(result.worldDiag.directiveCount).toBe(63);
  expect(result.worldDiag.unmappedGags).toEqual([]);
  expect(result.worldDiag.fullScreenCount).toBe(63);
  expect(result.worldDiag.slowdownCount).toBe(63);
  expect(result.worldDiag.cleanupCount).toBe(63);
  expect(result.worldDiag.emotionCounts).toEqual({
    'かわいい': 7,
    '謎': 13,
    '笑い': 22,
    'ド派手': 18,
    '完全予想外': 3,
  });
  expect(Object.keys(result.worldDiag.storyArcs)).toEqual(expect.arrayContaining(['orb','star','square','eye']));
  expect(result.statusDiag.statusAnimationsChecked).toBe(4);
  expect(result.statusDiag.fullScreenStatusCount).toBe(4);
  expect(result.statusDiag.slowdownCoverage).toBe(4);
  expect(result.idleDiag.auditCount).toBe(63);
  expect(result.idleDiag.fullScreenCount).toBe(63);
  expect(result.idleDiag.slowdownCoverage).toBe(63);
  expect(result.idleDiag.cleanupCoverage).toBe(63);
});

test('all 63 idle events actually play and fully clean up without touching ticket data', async ({ page }) => {
  test.setTimeout(30000);
  const current = payload([
    { number: '7021', state: 'waiting', order: 1 },
    { number: '7022', state: 'calling', order: 2 },
    { number: '7023', state: 'hold', order: 3 },
  ]);
  const h = await installBoard(page, [current]);

  const ids = await page.evaluate(() => window.ASOBOON_BOARD_IDLE_EVENTS.events.map(x => x.id));
  expect(ids).toHaveLength(63);

  await page.evaluate(() => {
    window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.02,{persistValue:false});
    window.ASOBOON_BOARD_IDLE_EVENTS.setConfig({
      ANIMATION_LEVEL: 3,
      IDLE_POST_COOLDOWN_MIN_MS: 0,
      IDLE_POST_COOLDOWN_MAX_MS: 0,
    });
  });

  for (const id of ids) {
    const result = await page.evaluate(async eventId => {
      const idle = window.ASOBOON_BOARD_IDLE_EVENTS;
      await idle.playEventForTest(eventId);
      const runtime = window.ASOBOON_BOARD_EFFECTS.diagnostics();
      const diag = idle.getDiagnostics();
      return {
        id: eventId,
        runtimeScopes: runtime.activeScopes,
        idleAnimations: diag.activeAnimations,
        idleTimers: diag.activeTimers,
        idleRunning: diag.running,
        tempIdleNodes: document.querySelectorAll('#boardIdleLayer > *, .board-fx-back-layer > *, .board-fx-front-layer > *').length,
        numbers: [...document.querySelectorAll('#queueGrid .queue-number')].map(x => x.textContent.trim()),
      };
    }, id);

    expect(result.runtimeScopes, id).toBe(0);
    expect(result.idleAnimations, id).toBe(0);
    expect(result.idleTimers, id).toBe(0);
    expect(result.idleRunning, id).toBe(false);
    expect(result.tempIdleNodes, id).toBe(0);
    expect(result.numbers, id).toEqual(['7021','7022','7023']);
  }

  expect(h.pageErrors).toEqual([]);
});

test('global slowdown runtime defaults to 2.5 and controls CSS timing variables', async ({ page }) => {
  const current = payload([{ number: '7011', state: 'waiting', order: 1 }]);
  await installBoard(page, [current]);
  const values = await page.evaluate(() => {
    const fx = window.ASOBOON_BOARD_EFFECTS;
    fx.setSlowdown(2.5,{persistValue:false});
    const style = getComputedStyle(document.documentElement);
    return {
      defaultSlowdown: fx.DEFAULT_SLOWDOWN,
      slowdown: fx.getSlowdown(),
      normal: style.getPropertyValue('--board-transition-normal').trim(),
    };
  });
  expect(values.defaultSlowdown).toBe(2.5);
  expect(values.slowdown).toBe(2.5);
  expect(values.normal).toBe('450ms');
  await page.evaluate(() => window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.05,{persistValue:false}));
});

test('idle events do not fire on initial load and only run after an unchanged update', async ({ page }) => {
  const current = payload([
    { number: '7101', state: 'waiting', order: 1 },
    { number: '7102', state: 'waiting', order: 2 },
  ]);
  const h = await installBoard(page, [current, current]);
  expect((await idleDiagnostics(page)).played).toBe(0);

  await prepareIdleForTest(page);
  await h.refresh();
  await expect.poll(async () => (await idleDiagnostics(page)).played, { timeout: 3000 }).toBe(1);
  await expect.poll(async () => (await idleDiagnostics(page)).running, { timeout: 5000 }).toBe(false);
  await expect(page.locator('.idle-shape,.idle-canvas,.idle-svg,.idle-background')).toHaveCount(0);
  const d = await idleDiagnostics(page);
  expect(d.activeAnimations).toBe(0);
  expect(d.activeTimers).toBe(0);
});

test('real call interrupts a running idle event and immediately wins priority', async ({ page }) => {
  const h = await installBoard(page, [
    payload([
      { number: '7201', state: 'waiting', order: 1 },
      { number: '7202', state: 'waiting', order: 2 },
    ]),
    payload([
      { number: '7201', state: 'calling', order: 1 },
      { number: '7202', state: 'waiting', order: 2 },
    ]),
  ]);
  await prepareIdleForTest(page, { ANIMATION_LEVEL: 3 });

  await page.evaluate(() => {
    const idle = window.ASOBOON_BOARD_IDLE_EVENTS;
    void idle.onStableUpdate({ grid: document.getElementById('queueGrid') });
  });
  await expect.poll(async () => (await idleDiagnostics(page)).running).toBe(true);

  h.next();
  await h.refresh();

  await expect.poll(async () => (await idleDiagnostics(page)).realInterrupts).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => (await idleDiagnostics(page)).running).toBe(false);
  await expect.poll(async () => {
    const d = await diagnostics(page);
    return d.history.some(x => x.number === '7201' && x.kind === 'call');
  }, { timeout: 3000 }).toBe(true);
  await expect(page.locator('#queueGrid .queue-card.calling .queue-number')).toHaveText('7201');
  await expect(page.locator('.idle-shape,.idle-canvas,.idle-svg,.idle-background')).toHaveCount(0);
});

test('new reception data suppresses idle events even without a status transition', async ({ page }) => {
  const h = await installBoard(page, [
    payload([{ number: '7301', state: 'waiting', order: 1 }]),
    payload([
      { number: '7301', state: 'waiting', order: 1 },
      { number: '7302', state: 'waiting', order: 2 },
    ]),
  ]);
  await prepareIdleForTest(page);
  h.next();
  await h.refresh();

  await expect(page.locator('.queue-number')).toHaveText(['7301','7302']);
  expect((await idleDiagnostics(page)).played).toBe(0);
});

test('recent idle history prevents immediate event repetition', async ({ page }) => {
  const current = payload([{ number: '7401', state: 'waiting', order: 1 }]);
  await installBoard(page, [current]);
  await prepareIdleForTest(page, { ANIMATION_LEVEL: 1, RARE_EVENTS_ENABLED: false });

  for (let i = 0; i < 5; i += 1) {
    await page.evaluate(() => void window.ASOBOON_BOARD_IDLE_EVENTS.onStableUpdate({ grid: document.getElementById('queueGrid') }));
    await expect.poll(async () => (await idleDiagnostics(page)).running, { timeout: 5000 }).toBe(false);
  }
  const d = await idleDiagnostics(page);
  expect(d.history.length).toBe(5);
  expect(new Set(d.history.map(x => x.id)).size).toBe(5);
});

test('communication error cancels idle entertainment and leaves no temporary layers', async ({ page }) => {
  const current = payload([{ number: '7501', state: 'waiting', order: 1 }]);
  await installBoard(page, [current]);
  await prepareIdleForTest(page, { ANIMATION_LEVEL: 3 });

  await page.evaluate(() => void window.ASOBOON_BOARD_IDLE_EVENTS.onStableUpdate({ grid: document.getElementById('queueGrid') }));
  await expect.poll(async () => (await idleDiagnostics(page)).running).toBe(true);
  await page.evaluate(() => window.ASOBOON_BOARD_IDLE_EVENTS.onCommunicationError());

  await expect.poll(async () => (await idleDiagnostics(page)).running).toBe(false);
  await expect(page.locator('.idle-shape,.idle-canvas,.idle-svg,.idle-background')).toHaveCount(0);
  const cleanup = await idleDiagnostics(page);
  expect(cleanup.activeAnimations).toBe(0);
  expect(cleanup.activeTimers).toBe(0);
  const runtime = await page.evaluate(() => window.ASOBOON_BOARD_EFFECTS.diagnostics());
  expect(runtime.activeScopes).toBe(0);
});

test('idle reduced-motion mode caps animation level and keeps real numbers untouched', async ({ page }) => {
  const current = payload([
    { number: '7601', state: 'waiting', order: 1 },
    { number: '7602', state: 'calling', order: 2 },
  ]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installBoard(page, [current]);
  await prepareIdleForTest(page, { ANIMATION_LEVEL: 3 });

  const d = await idleDiagnostics(page);
  expect(d.reduced).toBe(true);
  expect(d.effectiveLevel).toBe(1);
  await expect(page.locator('.queue-number')).toHaveText(['7601','7602']);
});
