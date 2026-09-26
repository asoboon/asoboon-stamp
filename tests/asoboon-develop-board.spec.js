const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const BASE = process.env.ASOBOON_BASE_URL || 'http://127.0.0.1:4173/miniapp-v2/develop/board/';

function payload(rows, options = {}) {
  const businessType = options.businessType || '土日祝日';
  const businessDate = options.businessDate || '2026-09-19';
  const activeKey = options.activeKey || '10:00';
  const definitions = businessType === '平日'
    ? [{ key: 'weekday', label: '本日の呼出状況' }]
    : businessType === '平日特定日'
      ? [{ key: '10:00', label: '10:00の回' }, { key: '13:30', label: '13:30の回' }]
      : businessType === '休館'
        ? []
        : [{ key: '10:00', label: '10:00の回' }, { key: '12:30', label: '12:30の回' }, { key: '15:00', label: '15:00の回' }];
  return {
    ok: true,
    fetchedAt: new Date().toISOString(),
    refreshAfterMs: 10000,
    businessDate,
    businessType,
    isClosed: businessType === '休館',
    slots: definitions.map(slot => ({
      ...slot,
      count: slot.key === activeKey ? rows.length : 0,
      rows: slot.key === activeKey ? rows : [],
    })),
  };
}

async function installBoard(page, sequence, { reducedMotion = false, cachedPayload = null } = {}) {
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
  if (cachedPayload) {
    await page.addInitScript(value => {
      localStorage.setItem('asoboon_call_board_last_good_v1', JSON.stringify({
        savedAt: new Date('2026-09-19T00:29:30.000Z').valueOf(),
        data: value,
      }));
    }, cachedPayload);
  }

  await page.route('https://asoboon-miniapp-v2-develop-gateway.asoboon425.workers.dev/**', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('action') === 'boardStatus') {
      const body = sequence[Math.min(index, sequence.length - 1)];
      return route.fulfill({ status: body?.ok === false ? 503 : 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"TEST_OFFLINE"}' });
  });

  await page.route('**/miniapp-v2/develop/env.js*', async route => {
    const env = fs.readFileSync('miniapp-v2/develop/env.js', 'utf8');
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: env });
  });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#queueGrid')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.ASOBOON_CALL_BOARD_TEST && window.ASOBOON_BOARD_EFFECTS && window.ASOBOON_BOARD_WORLD && window.ASOBOON_BOARD_CHARACTER_ASSETS && window.ASOBOON_BOARD_SOURCE_EFFECTS && window.ASOBOON_BOARD_CHARACTER_EVENTS && window.ASOBOON_BOARD_FOURTH_WALL_ASSETS && window.ASOBOON_BOARD_FOURTH_WALL_EVENTS && window.ASOBOON_BOARD_ANIMATIONS && window.ASOBOON_BOARD_IDLE_EVENTS && window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR))).toBe(true);
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

async function characterDiagnostics(page) {
  return page.evaluate(() => window.ASOBOON_BOARD_CHARACTER_EVENTS.getDiagnostics());
}

async function sourceFxDiagnostics(page) {
  return page.evaluate(() => window.ASOBOON_BOARD_SOURCE_EFFECTS.getDiagnostics());
}

async function waitForCharacterIdle(page) {
  await expect.poll(async () => (await characterDiagnostics(page)).running, { timeout: 7000 }).toBe(false);
  await expect(page.locator('.pc-sprite,.pc-giant-ball')).toHaveCount(0);
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
    const director = window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR;
    if (director) {
      director.resetForTest();
      director.setConfig({
        weights: {
          WORLD: 1,
          POMPON_CAMEO: 0,
          CHIRU_CAMEO: 0,
          POMPON_STORY: 0,
          DUO_STORY: 0,
          RARE_STORY: 0,
        },
        REAL_CHANGE_COOLDOWN_MS: 0,
        CHARACTER_FORCE_AFTER_MS: 999999,
      });
    }
  }, patch);
}

async function waitForFxIdle(page) {
  await expect.poll(async () => (await diagnostics(page)).activeFx, { timeout: 7000 }).toBe(0);
  await expect.poll(async () => (await diagnostics(page)).running, { timeout: 4000 }).toBe(0);
  await expect(page.locator('.fx-card-ghost,.fx-canvas,.fx-onomatopoeia,.fx-foreground-shard,.fx-impact-flash')).toHaveCount(0);
}

test('business-day routing covers weekday, special weekday, three-session days and closed days', async ({ page }) => {
  await installBoard(page, [payload([])]);
  const result = await page.evaluate(() => {
    const resolve = window.ASOBOON_CALL_BOARD_TEST.resolveBoardContext;
    const at = iso => new Date(iso);
    return {
      weekday: resolve(at('2026-09-21T01:00:00.000Z'), '平日'),
      specialBeforeSwitch: resolve(at('2026-09-21T03:59:00.000Z'), '平日特定日'),
      specialAfterSwitch: resolve(at('2026-09-21T04:00:00.000Z'), '平日特定日'),
      weekendMorning: resolve(at('2026-09-19T02:59:00.000Z'), '土日祝日'),
      weekendMidday: resolve(at('2026-09-19T03:00:00.000Z'), '土日祝日'),
      weekendAfternoon: resolve(at('2026-09-19T05:30:00.000Z'), '土日祝日'),
      closed: resolve(at('2026-09-22T01:00:00.000Z'), '休館'),
      beforeOpen: resolve(at('2026-09-18T22:59:00.000Z'), '土日祝日'),
      atEight: resolve(at('2026-09-18T23:00:00.000Z'), '土日祝日'),
      weekdayEnded: resolve(at('2026-09-21T08:00:00.000Z'), '平日'),
      weekendEnded: resolve(at('2026-09-19T09:00:00.000Z'), '土日祝日'),
    };
  });

  expect(result.weekday).toMatchObject({ phase:'active', slotKey:'weekday', slotSuffix:'' });
  expect(result.specialBeforeSwitch).toMatchObject({ phase:'active', slotKey:'10:00' });
  expect(result.specialAfterSwitch).toMatchObject({ phase:'active', slotKey:'13:30' });
  expect(result.weekendMorning).toMatchObject({ phase:'active', slotKey:'10:00' });
  expect(result.weekendMidday).toMatchObject({ phase:'active', slotKey:'12:30' });
  expect(result.weekendAfternoon).toMatchObject({ phase:'active', slotKey:'15:00' });
  expect(result.closed).toMatchObject({ phase:'closed', slotKey:'' });
  expect(result.beforeOpen).toMatchObject({ phase:'before', slotKey:'' });
  expect(result.atEight).toMatchObject({ phase:'active', slotKey:'10:00' });
  expect(result.weekdayEnded).toMatchObject({ phase:'ended', slotKey:'' });
  expect(result.weekendEnded).toMatchObject({ phase:'ended', slotKey:'' });
});

test('board backend slot definitions include regular weekday and 13:30 special weekday queues', async () => {
  const worker = fs.readFileSync('miniapp-v2/backend/develop-worker.mjs','utf8');
  expect(worker).toContain("key:'weekday'");
  expect(worker).toContain("'0023','0025'");
  expect(worker).toContain("key:'13:30'");
  expect(worker).toContain("'0037','0038'");
  expect(worker).toContain("getBusinessDayProxy(businessDate, env)");
});

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

test('board caption stays simple while calling state is expressed by cards and motion', async ({ page }) => {
  const h = await installBoard(page, [
    payload([{ number: '2551', state: 'calling', order: 1 }]),
    payload([{ number: '2551', state: 'canceled', order: 1 }]),
    payload([], { businessType: '休館' }),
  ]);

  await expect(page.locator('#liveCaption')).toHaveText('呼出状況');
  h.next();
  await h.refresh();
  await expect(page.locator('#liveCaption')).toHaveText('呼出状況');
  await expect(page.locator('.queue-card')).toHaveCount(0);

  h.next();
  await h.refresh();
  await expect(page.locator('#liveCaption')).toHaveText('呼出状況');
  await expect(page.locator('#emptyTitle')).toHaveText('本日は休館日です');
});

test('temporary API failure preserves readable data and automatically recovers', async ({ page }) => {
  const first = payload([{ number: '2581', state: 'calling', order: 1 }]);
  const recovered = payload([
    { number: '2581', state: 'done', order: 1 },
    { number: '2582', state: 'calling', order: 2 },
  ]);
  const h = await installBoard(page, [first, { ok:false, error:'TEST_OFFLINE' }, recovered]);

  h.next();
  await h.refresh();
  await expect(page.locator('.queue-number')).toHaveText(['2581']);
  await expect(page.locator('#connection')).toContainText('更新待機中');
  await expect(page.locator('#liveCaption')).toHaveText('呼出状況');

  h.next();
  await h.refresh();
  await expect(page.locator('.queue-number')).toHaveText(['2581','2582']);
  await expect(page.locator('#connection')).toContainText('10秒ごとに自動更新');
  await expect(page.locator('#liveCaption')).toHaveText('呼出状況');
  expect(h.pageErrors).toEqual([]);
});

test('stale board payload remains visible with a clear update-waiting warning', async ({ page }) => {
  const stale = {
    ...payload([{ number:'2591', state:'calling', order:1 }]),
    stale:true,
    staleAgeMs:45000,
    cacheSource:'snapshot-stale',
  };
  await installBoard(page, [stale]);
  await expect(page.locator('.queue-number')).toHaveText(['2591']);
  await expect(page.locator('#connection')).toContainText('前回の状況を表示中');
  await expect(page.locator('#emptyTitle')).not.toHaveText('呼出状況を確認しています');
});

test('first-load API failure restores same-day browser snapshot instead of freezing on checking screen', async ({ page }) => {
  const cached = payload([
    { number:'2592', state:'waiting', order:1 },
    { number:'2593', state:'calling', order:2 },
  ]);
  await installBoard(page, [{ ok:false, error:'AIRWAIT_BOARD_TIMEOUT' }], { cachedPayload:cached });
  await expect(page.locator('.queue-number')).toHaveText(['2592','2593']);
  await expect(page.locator('#connection')).toContainText('前回の状況を表示中');
  await expect(page.locator('#emptyTitle')).not.toHaveText('呼出状況を確認しています');
  const config=await page.evaluate(() => ({
    timeout:window.ASOBOON_CALL_BOARD_TEST.REQUEST_TIMEOUT_MS,
    cacheAge:window.ASOBOON_CALL_BOARD_TEST.BOARD_CACHE_MAX_AGE_MS,
  }));
  expect(config.timeout).toBe(20000);
  expect(config.cacheAge).toBe(180000);
});

test('board backend uses AirWAIT last-update gating and persistent stale fallback', async () => {
  const worker=fs.readFileSync('miniapp-v2/backend/develop-worker.mjs','utf8');
  expect(worker).toContain('AIR_LAST_UPDATE');
  expect(worker).toContain('fetchAirwaitLastUpdate');
  expect(worker).toContain('readBoardSnapshotD1');
  expect(worker).toContain('writeBoardSnapshotD1');
  expect(worker).toContain('BOARD_SNAPSHOT_STALE_FALLBACK_MS = 3 * 60 * 1000');
  expect(worker).toContain('BOARD_PAGE_CONCURRENCY = 4');
  const start=worker.indexOf('async function getBoardStatus(env)');
  const end=worker.indexOf('function boardSlotKey',start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const boardBlock=worker.slice(start,end);
  expect(boardBlock).toContain('getBoardRows(env,businessDate,businessType)');
  expect(boardBlock).not.toContain('fetchAllReservationsForReconcile(env)');
  const workflow=fs.readFileSync('.github/workflows/deploy-miniapp-v2-develop-gateway.yml','utf8');
  expect(workflow).toContain('Verify live boardStatus read path');
  expect(workflow).toContain('action=boardStatus');
  expect(workflow).toContain('curl --max-time 20');
});

test('240 receptions fit a 1080x1920 portrait board without scrolling or overlap', async ({ page }) => {
  await page.setViewportSize({ width:1080, height:1920 });
  const rows = Array.from({ length:240 }, (_,i) => ({
    number:String(3001+i),
    state:i===119?'calling':i%17===0?'hold':i%11===0?'done':'waiting',
    order:i+1,
  }));
  await installBoard(page, [payload(rows)]);
  await expect(page.locator('.queue-card')).toHaveCount(240);
  await expect(page.locator('#boardDiagnostics')).toBeHidden();
  const layout = await page.evaluate(() => {
    const grid=document.getElementById('queueGrid'),box=grid.getBoundingClientRect();
    const cards=[...grid.querySelectorAll('.queue-card')];
    return {
      bodyScroll:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth,
      minFont:Math.min(...cards.map(x=>parseFloat(getComputedStyle(x.querySelector('.queue-number')).fontSize))),
      outside:cards.filter(x=>{const r=x.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1}).length,
      overlap:cards.some((x,i)=>{const a=x.getBoundingClientRect(),b=cards[i+1]?.getBoundingClientRect();return b&&a.top===b.top&&a.right>b.left+1}),
    };
  });
  expect(layout.bodyScroll).toBe(false);
  expect(layout.minFont).toBeGreaterThanOrEqual(12);
  expect(layout.outside).toBe(0);
  expect(layout.overlap).toBe(false);
  await expect(page.locator('#liveCaption')).toHaveText('呼出状況');
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
    expect(row.revisedAtCurrentSlowdownMs).toBeGreaterThanOrEqual(3000);
    expect(row.revisedAtCurrentSlowdownMs).toBeLessThanOrEqual(6000);
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
      const fx = window.ASOBOON_BOARD_EFFECTS;
      fx.resetPerformanceBaseline();
      await idle.playEventForTest(eventId);
      const runtime = fx.diagnostics();
      const diag = idle.getDiagnostics();
      return {
        id: eventId,
        runtimeScopes: runtime.activeScopes,
        domDeltaPeak: runtime.domDeltaPeak,
        sharedCanvasCount: runtime.sharedCanvasCount,
        maxCanvasJobs: runtime.maxCanvasJobs,
        maxFrameTasks: runtime.maxFrameTasks,
        idleAnimations: diag.activeAnimations,
        idleTimers: diag.activeTimers,
        idleRunning: diag.running,
        tempIdleNodes: document.querySelectorAll('#boardIdleLayer > *, .board-fx-back-layer > *, .board-fx-front-layer > *').length,
        numbers: [...document.querySelectorAll('#queueGrid .queue-number')].map(x => x.textContent.trim()),
      };
    }, id);

    expect(result.runtimeScopes, id).toBe(0);
    expect(result.domDeltaPeak, id).toBeLessThanOrEqual(20);
    expect(result.sharedCanvasCount, id).toBeLessThanOrEqual(1);
    expect(result.maxCanvasJobs, id).toBeLessThanOrEqual(1);
    expect(result.maxFrameTasks, id).toBeLessThanOrEqual(1);
    expect(result.idleAnimations, id).toBe(0);
    expect(result.idleTimers, id).toBe(0);
    expect(result.idleRunning, id).toBe(false);
    expect(result.tempIdleNodes, id).toBe(0);
    expect(result.numbers, id).toEqual(['7021','7022','7023']);
  }

  expect(h.pageErrors).toEqual([]);
});

test('animation architecture has one RAF owner and one Canvas owner', async () => {
  const runtime = fs.readFileSync('miniapp-v2/develop/board/board-effects-runtime.js','utf8');
  const idle = fs.readFileSync('miniapp-v2/develop/board/board-idle-events.js','utf8');
  const status = fs.readFileSync('miniapp-v2/develop/board/board-animations.js','utf8');
  const world = fs.readFileSync('miniapp-v2/develop/board/board-world.js','utf8');

  expect((runtime.match(/requestAnimationFrame\(/g)||[]).length).toBe(1);
  expect((runtime.match(/createElement\(['"]canvas['"]\)/g)||[]).length).toBe(1);
  expect(idle).not.toContain('requestAnimationFrame(');
  expect(status).not.toContain('requestAnimationFrame(');
  expect(world).not.toContain('requestAnimationFrame(');
  expect(idle).not.toMatch(/createElement\(['"]canvas['"]\)/);
  expect(status).not.toMatch(/createElement\(['"]canvas['"]\)/);
  expect(world).not.toMatch(/createElement\(['"]canvas['"]\)/);
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


test('quality AUTO and LOW fallback keep giant scale while removing expensive decoration', async ({ page }) => {
  const current = payload([{ number: '7030', state: 'waiting', order: 1 }]);
  await installBoard(page, [current]);

  const values = await page.evaluate(() => {
    const fx = window.ASOBOON_BOARD_EFFECTS;
    const probe = document.createElement('div');
    probe.className = 'world-resident resident-ball';
    document.body.appendChild(probe);

    fx.setQuality('HIGH',{persistValue:false});
    const high = getComputedStyle(probe);
    const highWidth = high.width;
    const highFilter = high.filter;

    fx.setQuality('LOW',{persistValue:false});
    const low = getComputedStyle(probe);
    const lowWidth = low.width;
    const lowFilter = low.filter;
    const lowShadow = low.boxShadow;

    fx.setQuality('AUTO',{persistValue:false});
    probe.remove();
    return {
      lowSpecFallback: fx.LOW_SPEC_FALLBACK,
      mode: fx.getQuality(),
      highWidth,
      lowWidth,
      highFilter,
      lowFilter,
      lowShadow,
    };
  });

  expect(values.lowSpecFallback).toBe(true);
  expect(values.mode).toBe('AUTO');
  expect(values.lowWidth).toBe(values.highWidth);
  expect(values.lowFilter).toBe('none');
  expect(values.lowShadow).toBe('none');
});

test('shared animation engine stays bounded under 6x CPU throttling', async ({ page }) => {
  test.setTimeout(30000);
  const current = payload([
    { number: '7040', state: 'waiting', order: 1 },
    { number: '7041', state: 'calling', order: 2 },
    { number: '7042', state: 'hold', order: 3 },
  ]);
  const h = await installBoard(page, [current]);
  const client = await page.context().newCDPSession(page);

  await client.send('Performance.enable');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const beforeRaw = await client.send('Performance.getMetrics');

  const runtime = await page.evaluate(async () => {
    const fx = window.ASOBOON_BOARD_EFFECTS;
    const idle = window.ASOBOON_BOARD_IDLE_EVENTS;
    fx.setQuality('AUTO',{persistValue:false});
    fx.setSlowdown(0.2,{persistValue:false});
    fx.resetPerformanceBaseline();

    await idle.playEventForTest('confetti-glitter');
    await idle.playEventForTest('orbit-star');

    return fx.diagnostics();
  });

  const afterRaw = await client.send('Performance.getMetrics');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const metrics = rows => Object.fromEntries(rows.metrics.map(x => [x.name, x.value]));
  const before = metrics(beforeRaw);
  const after = metrics(afterRaw);

  expect(runtime.sharedCanvasCount).toBe(1);
  expect(runtime.rafLoopCount).toBeLessThanOrEqual(1);
  expect(runtime.maxCanvasJobs).toBeLessThanOrEqual(1);
  expect(runtime.maxFrameTasks).toBeLessThanOrEqual(1);
  expect(runtime.domDeltaPeak).toBeLessThanOrEqual(20);
  expect(runtime.activeScopes).toBe(0);
  expect(runtime.frameTasks).toBe(0);
  expect(runtime.canvasJobs).toBe(0);
  expect(runtime.activeTimers).toBe(0);
  expect(h.pageErrors).toEqual([]);

  expect(after.JSHeapUsedSize).toBeGreaterThan(0);
  expect(after.LayoutCount - before.LayoutCount).toBeLessThan(160);
  expect(after.RecalcStyleCount - before.RecalcStyleCount).toBeLessThan(220);
  expect(after.TaskDuration - before.TaskDuration).toBeLessThan(12);

  console.log('BOARD_PERF_6X_CPU', {
    effectiveQuality: runtime.effectiveQuality,
    fps: runtime.fps,
    frameMs: runtime.frameMs,
    domDeltaPeak: runtime.domDeltaPeak,
    maxCanvasJobs: runtime.maxCanvasJobs,
    maxFrameTasks: runtime.maxFrameTasks,
    layoutDelta: after.LayoutCount - before.LayoutCount,
    styleDelta: after.RecalcStyleCount - before.RecalcStyleCount,
    taskDurationDelta: after.TaskDuration - before.TaskDuration,
    heapDelta: after.JSHeapUsedSize - before.JSHeapUsedSize,
  });
});

test('CALL GUIDED HOLD and CANCEL stay bounded under 6x CPU throttling with a true foreground overlay', async ({ page }) => {
  test.setTimeout(30000);
  const h = await installBoard(page, [payload([
    { number:'7050', state:'waiting', order:1 },
    { number:'7051', state:'waiting', order:2 },
  ])]);
  const client = await page.context().newCDPSession(page);
  await client.send('Performance.enable');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  const beforeRaw = await client.send('Performance.getMetrics');

  const result = await page.evaluate(async () => {
    const fx=window.ASOBOON_BOARD_EFFECTS;
    const anim=window.ASOBOON_BOARD_ANIMATIONS;
    const card=document.querySelector('#queueGrid .queue-card');
    fx.setQuality('AUTO',{persistValue:false});
    fx.setSlowdown(0.06,{persistValue:false});
    fx.resetPerformanceBaseline();

    for(const kind of ['call','guided','hold','cancel']){
      await anim.playStatusAnimation({
        number:'7050',
        kind,
        fromStatus:'waiting',
        toStatus:kind==='call'?'calling':kind==='guided'?'done':kind==='hold'?'hold':'canceled',
        element:card,
      });
    }

    const overlay=fx.getLayer('overlay');
    const front=fx.getLayer('front');
    return{
      runtime:fx.diagnostics(),
      overlayZ:Number(getComputedStyle(overlay).zIndex)||0,
      frontZ:Number(getComputedStyle(front).zIndex)||0,
      tempNodes:document.querySelectorAll('.fx-onomatopoeia,.fx-foreground-shard,.fx-impact-flash,.fx-card-ghost,.pc-sprite').length,
      numbers:[...document.querySelectorAll('#queueGrid .queue-number')].map(x=>x.textContent.trim()),
    };
  });

  const afterRaw = await client.send('Performance.getMetrics');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const metrics = rows => Object.fromEntries(rows.metrics.map(x => [x.name, x.value]));
  const before=metrics(beforeRaw),after=metrics(afterRaw);

  expect(result.overlayZ).toBeGreaterThan(result.frontZ);
  expect(result.runtime.sharedCanvasCount).toBeLessThanOrEqual(1);
  expect(result.runtime.rafLoopCount).toBeLessThanOrEqual(1);
  expect(result.runtime.maxCanvasJobs).toBeLessThanOrEqual(1);
  expect(result.runtime.maxFrameTasks).toBeLessThanOrEqual(1);
  expect(result.runtime.domDeltaPeak).toBeLessThanOrEqual(24);
  expect(result.runtime.activeScopes).toBe(0);
  expect(result.runtime.frameTasks).toBe(0);
  expect(result.runtime.canvasJobs).toBe(0);
  expect(result.runtime.activeTimers).toBe(0);
  expect(result.tempNodes).toBe(0);
  expect(result.numbers).toEqual(['7050','7051']);
  expect(after.LayoutCount-before.LayoutCount).toBeLessThan(260);
  expect(after.RecalcStyleCount-before.RecalcStyleCount).toBeLessThan(360);
  expect(after.TaskDuration-before.TaskDuration).toBeLessThan(18);
  expect(h.pageErrors).toEqual([]);

  console.log('BOARD_SPECIAL_PERF_6X_CPU',{
    effectiveQuality:result.runtime.effectiveQuality,
    fps:result.runtime.fps,
    frameMs:result.runtime.frameMs,
    domDeltaPeak:result.runtime.domDeltaPeak,
    maxCanvasJobs:result.runtime.maxCanvasJobs,
    overlayZ:result.overlayZ,
    frontZ:result.frontZ,
    layoutDelta:after.LayoutCount-before.LayoutCount,
    styleDelta:after.RecalcStyleCount-before.RecalcStyleCount,
    taskDurationDelta:after.TaskDuration-before.TaskDuration,
    heapDelta:after.JSHeapUsedSize-before.JSHeapUsedSize,
  });
});

test('new-source effects stay quiet on load and only run when the show story reaches an FX beat', async ({ page }) => {
  const current = payload([
    { number: '7101', state: 'waiting', order: 1 },
    { number: '7102', state: 'waiting', order: 2 },
  ]);
  const h = await installBoard(page, [current, current]);
  expect((await sourceFxDiagnostics(page)).played).toBe(0);

  await page.evaluate(() => {
    const director=window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR;
    director.resetForTest();
    director.setConfig({
      REAL_CHANGE_COOLDOWN_MS:0,
      CHARACTER_FORCE_AFTER_MS:999999,
      QUIET_BEAT_MS:0,
      INITIAL_SHOW_DELAY_MS:0,
    });
    director.setShowForTest('BALL_CHAOS',0);
  });
  await h.refresh();
  expect((await sourceFxDiagnostics(page)).played).toBe(0);
  const afterQuiet=await page.evaluate(()=>window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR.getDiagnostics());
  expect(afterQuiet.quietBeats).toBeGreaterThanOrEqual(1);

  await page.evaluate(() => window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR.setShowForTest('BALL_CHAOS',2));
  await h.refresh();
  await expect.poll(async () => (await sourceFxDiagnostics(page)).played, { timeout: 3000 }).toBe(1);
  await expect.poll(async () => (await sourceFxDiagnostics(page)).running, { timeout: 5000 }).toBe(false);
  await expect(page.locator('.pc-effect')).toHaveCount(0);
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


test('POMPON and CHIRU optimized atlases are present and bounded for kiosk use', async () => {
  const characterAtlas = fs.statSync('miniapp-v2/develop/board/assets/pompon-chiru-atlas-v2.webp');
  const effectAtlas = fs.statSync('miniapp-v2/develop/board/assets/pompon-chiru-effects-atlas-v2.webp');
  expect(characterAtlas.size).toBeGreaterThan(50000);
  expect(characterAtlas.size).toBeLessThan(700000);
  expect(effectAtlas.size).toBeGreaterThan(20000);
  expect(effectAtlas.size).toBeLessThan(350000);

  const assets = fs.readFileSync('miniapp-v2/develop/board/board-character-assets.js','utf8');
  expect(assets).toContain("pompon_dash");
  expect(assets).toContain("chiru_retort");
  expect(assets).toContain("impact_starburst");
  expect(assets).toContain("dizzy_spiral");
});

test('entertainment director runs three story arcs with callbacks, quiet beats and jackpot slots', async ({ page }) => {
  await installBoard(page, [payload([{ number:'8101', state:'waiting', order:1 }])]);
  const result = await page.evaluate(() => window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR.simulateShowForTest(12345));
  expect(result.scheduler).toBe('show-director-v1');
  expect(result.arcCount).toBe(3);
  expect(result.totalBeats).toBe(33);
  expect(result.quietBeats).toBe(6);
  expect(result.pureFxBeats).toBe(2);
  expect(result.sourceFxShare).toBeLessThan(.10);
  expect(result.megaSlots).toBe(3);
  expect(result.callbackBeats).toBeGreaterThanOrEqual(3);
  expect(result.aftermathBeats).toBeGreaterThanOrEqual(3);
  expect(result.maxNonCharacterGap).toBeLessThanOrEqual(2);
  expect(result.jackpotEvents).toEqual(expect.arrayContaining(['MEGA_GREAT_CRASH','MEGA_SCREEN_TAKEOVER','FW_KNOCK_KNOCK_POMPON']));
  expect(new Set(result.rows.map(x=>x.arc))).toEqual(new Set(['BALL_CHAOS','CHASE_COMEDY','FOURTH_WALL_MYSTERY']));
});

test('four representative POMPON CHIRU stories play and fully clean up without changing ticket data', async ({ page }) => {
  test.setTimeout(20000);
  const h = await installBoard(page, [payload([
    { number:'8201', state:'waiting', order:1 },
    { number:'8202', state:'calling', order:2 },
    { number:'8203', state:'hold', order:3 },
  ])]);
  await page.evaluate(() => {
    window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.02,{persistValue:false});
    window.ASOBOON_BOARD_CHARACTER_EVENTS.resetForTest();
  });
  const ids=['POMPON_BRAKE_FAIL','DUO_CHASE_CATCH','PEEK_DISCOVERY','BALL_RIDE_FAIL'];
  for(const id of ids){
    const result=await page.evaluate(async eventId=>{
      const fx=window.ASOBOON_BOARD_EFFECTS;
      fx.resetPerformanceBaseline();
      const played=await window.ASOBOON_BOARD_CHARACTER_EVENTS.playEventForTest(eventId);
      return{
        played,
        char:window.ASOBOON_BOARD_CHARACTER_EVENTS.getDiagnostics(),
        runtime:fx.diagnostics(),
        numbers:[...document.querySelectorAll('#queueGrid .queue-number')].map(x=>x.textContent.trim()),
        tempNodes:document.querySelectorAll('.pc-sprite,.pc-giant-ball,.pc-mega-wash').length,
      };
    },id);
    expect(result.played.played,id).toBe(true);
    expect(result.char.running,id).toBe(false);
    expect(result.runtime.activeScopes,id).toBe(0);
    expect(result.runtime.domDeltaPeak,id).toBeLessThanOrEqual(20);
    expect(result.tempNodes,id).toBe(0);
    expect(result.numbers,id).toEqual(['8201','8202','8203']);
  }
  expect(h.pageErrors).toEqual([]);
});

test('jackpot character scenes fill the stage, clean up, and preserve real ticket data', async ({ page }) => {
  test.setTimeout(20000);
  const h = await installBoard(page, [payload([
    { number:'8291', state:'waiting', order:1 },
    { number:'8292', state:'calling', order:2 },
  ])]);
  await page.evaluate(() => {
    window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.015,{persistValue:false});
    window.ASOBOON_BOARD_CHARACTER_EVENTS.resetForTest();
  });
  for(const id of ['MEGA_SCREEN_TAKEOVER','MEGA_GREAT_CRASH']){
    const result=await page.evaluate(async eventId=>{
      const fx=window.ASOBOON_BOARD_EFFECTS;
      fx.resetPerformanceBaseline();
      const played=await window.ASOBOON_BOARD_CHARACTER_EVENTS.playEventForTest(eventId);
      return{
        played,
        runtime:fx.diagnostics(),
        numbers:[...document.querySelectorAll('#queueGrid .queue-number')].map(x=>x.textContent.trim()),
        tempNodes:document.querySelectorAll('.pc-sprite,.pc-giant-ball,.pc-mega-wash').length,
      };
    },id);
    expect(result.played.played,id).toBe(true);
    expect(result.runtime.activeScopes,id).toBe(0);
    expect(result.runtime.domDeltaPeak,id).toBeLessThanOrEqual(20);
    expect(result.tempNodes,id).toBe(0);
    expect(result.numbers,id).toEqual(['8291','8292']);
  }
  expect(h.pageErrors).toEqual([]);
});

test('real data change immediately interrupts a running character story', async ({ page }) => {
  await installBoard(page, [payload([{ number:'8301', state:'waiting', order:1 }])]);
  await page.evaluate(() => {
    window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.5,{persistValue:false});
    window.ASOBOON_BOARD_CHARACTER_EVENTS.resetForTest();
    window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR.resetForTest();
    void window.ASOBOON_BOARD_CHARACTER_EVENTS.playEventForTest('BALL_RIDE_FAIL');
  });
  await expect.poll(async () => (await characterDiagnostics(page)).running).toBe(true);
  await page.evaluate(() => window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR.onRealChange());
  await waitForCharacterIdle(page);
  const d=await characterDiagnostics(page);
  expect(d.canceled).toBeGreaterThanOrEqual(1);
  expect(d.running).toBe(false);
});

test('a genuine call adds CALL_DELIVERY while the real calling number remains authoritative', async ({ page }) => {
  const h = await installBoard(page, [
    payload([{ number:'8401', state:'waiting', order:1 }]),
    payload([{ number:'8401', state:'calling', order:1 }]),
  ]);
  await page.evaluate(() => {
    window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.05,{persistValue:false});
    window.ASOBOON_BOARD_CHARACTER_EVENTS.resetForTest();
  });
  h.next();
  await h.refresh();
  await expect.poll(async () => (await characterDiagnostics(page)).callPlayed, { timeout:4000 }).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#queueGrid .queue-card.calling .queue-number')).toHaveText('8401');
  await waitForCharacterIdle(page);
  await waitForFxIdle(page);
  await expect(page.locator('#queueGrid .queue-card.calling .queue-number')).toHaveText('8401');
  expect(h.pageErrors).toEqual([]);
});

test('character engine adds no RAF or canvas owners beyond the shared runtime', async () => {
  const assets=fs.readFileSync('miniapp-v2/develop/board/board-character-assets.js','utf8');
  const chars=fs.readFileSync('miniapp-v2/develop/board/board-character-events.js','utf8');
  const director=fs.readFileSync('miniapp-v2/develop/board/board-entertainment-director.js','utf8');
  const sourcefx=fs.readFileSync('miniapp-v2/develop/board/board-source-effects.js','utf8');
  const fourthAssets=fs.readFileSync('miniapp-v2/develop/board/board-fourth-wall-assets.js','utf8');
  const fourthEvents=fs.readFileSync('miniapp-v2/develop/board/board-fourth-wall-events.js','utf8');
  for(const code of [assets,chars,director,sourcefx,fourthAssets,fourthEvents]){
    expect(code).not.toContain('requestAnimationFrame(');
    expect(code).not.toMatch(/createElement\\(['"]canvas['"]\\)/);
  }
});


test('normal entertainment rotation is new-source-only and legacy mystery residents are excluded', async ({ page }) => {
  await installBoard(page, [payload([{ number:'8501', state:'waiting', order:1 }])]);
  const state=await page.evaluate(() => ({
    director:window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR.getDiagnostics(),
    chars:window.ASOBOON_BOARD_CHARACTER_EVENTS.events.map(x=>x.id),
    sourceFx:window.ASOBOON_BOARD_SOURCE_EFFECTS.getDiagnostics(),
  }));
  expect(state.director.legacyIdleInNormalRotation).toBe(false);
  expect(state.chars).toEqual(expect.arrayContaining(['POMPON_PEEK','POMPON_SPARKLE_SMUG','POMPON_STAR_SHOCK','POMPON_OOPS_QUESTION','CHIRU_PEEK','CHIRU_SNEAK','CHIRU_STAR_DODGE','CHIRU_ALERT_SHOCK','POMPON_BRAKE_FAIL','POMPON_SMUG_OOPS','POMPON_STAR_FLYBACK','DUO_CHASE_CATCH','DUO_BOAST_DISBELIEF','DUO_FAILURE_SCOLD','DUO_OH_NO_ESCAPE','DUO_FRIENDSHIP_OOPS']));
  expect(state.chars).not.toEqual(expect.arrayContaining(['POMPON_DASH_BY','CHIRU_WATCH','CHIRU_EXASPERATED']));
  expect(state.sourceFx.sourcePolicy).toBe('effects_pack_v2-only');
  expect(state.sourceFx.semanticPolicy).toBe('context-matched-only');
  expect(state.sourceFx.events).toEqual(expect.arrayContaining(['FX_MAGIC_STAR_PASS','FX_SPARKLE_SWEEP','FX_CARD_GLINT','FX_SPEED_PASS','FX_DUST_GUST','FX_MAGIC_TRAIL']));
  expect(state.sourceFx.events).not.toEqual(expect.arrayContaining(['FX_DUST_BOUNCE','FX_OFFSCREEN_BONK','FX_STAR_POP']));
});

test('source asset database locks approved sources and contextual use rules', async () => {
  const db=JSON.parse(fs.readFileSync('miniapp-v2/develop/board/assets/source-assets-db.json','utf8'));
  expect(db.database_version).toBe('1.6.0');
  expect(db.source_archive_verification.runtime_reads_source_archives).toBe(false);
  expect(db.source_archive_verification.archives).toHaveLength(3);
  expect(db.runtime_policy.legacy_visual_assets_allowed).toBe(false);
  expect(db.runtime_policy.approved_sources).toEqual(expect.arrayContaining(['POMPON_CHIRU_assets_draft_40 2.zip','effects_pack_v2.zip']));
  expect(db.counts.characters).toBe(40);
  expect(db.counts.effects_total).toBe(589);
  const chiruWatch=db.characters.find(x=>x.id==='chiru_watch');
  const duoCatch=db.characters.find(x=>x.id==='duo_runaway_crash');
  expect(chiruWatch.standalone_ok).toBe(false);
  expect(duoCatch.semantic).toBe('catch');
  expect(db.contextual_rules.jump_arc).toContain('衝突表現には使用禁止');
  expect(db.runtime_event_rules.standalone_character_events).toEqual(expect.arrayContaining(['POMPON_PEEK','POMPON_SPARKLE_SMUG','POMPON_STAR_SHOCK','POMPON_OOPS_QUESTION','CHIRU_PEEK','CHIRU_SNEAK','CHIRU_STAR_DODGE','CHIRU_ALERT_SHOCK']));
  expect(db.runtime_event_rules.forbidden_standalone_character_assets).toEqual(expect.arrayContaining(['chiru_watch','chiru_exasperated','chiru_retort']));
  expect(db.runtime_event_rules.source_fx_events).toEqual(['FX_MAGIC_STAR_PASS','FX_SPARKLE_SWEEP','FX_CARD_GLINT','FX_SPEED_PASS','FX_DUST_GUST','FX_MAGIC_TRAIL']);
  expect(db.stories.some(x=>x.id==='DUO_CHASE_CATCH')).toBe(true);
  expect(db.stories.some(x=>x.id==='MEGA_GREAT_CRASH')).toBe(true);
  expect(db.stories.some(x=>x.id==='MEGA_SCREEN_TAKEOVER')).toBe(true);
  expect(db.runtime_event_rules.scheduler).toBe('show-director-v1');
  expect(db.runtime_event_rules.show_director.arcs).toEqual(['BALL_CHAOS','CHASE_COMEDY','FOURTH_WALL_MYSTERY']);
  expect(db.runtime_event_rules.show_director.max_pure_fx_in_row).toBe(1);
  expect(db.runtime_event_rules.show_director.character_force_after_ms).toBe(25000);
  expect(db.runtime_event_rules.show_director.mega_min_interval_ms).toBe(90000);
  expect(db.runtime_event_rules.shuffle_bag.deprecated).toBe(true);
  expect(db.runtime_event_rules.shuffle_bag.used_by_runtime).toBe(false);
  expect(db.pattern_catalog.total_idle_patterns).toBe(49);
  expect(db.pattern_catalog.mega_story).toEqual(['MEGA_SCREEN_TAKEOVER','MEGA_GREAT_CRASH']);
  expect(db.counts.runtime_idle_patterns).toBe(49);
  expect(db.counts.fourth_wall_implementation_assets).toBe(80);
  expect(db.fourth_wall_inventory.total_implementation_assets).toBe(80);
  expect(db.runtime_event_rules.fourth_wall_rules.source_only).toBe(true);
});


test('character pacing is deliberately slower while call delivery stays separate', async ({ page }) => {
  await installBoard(page, [payload([{ number:'8601', state:'waiting', order:1 }])]);
  const state=await page.evaluate(() => ({
    chars:window.ASOBOON_BOARD_CHARACTER_EVENTS.getDiagnostics(),
    sourceFx:window.ASOBOON_BOARD_SOURCE_EFFECTS.getDiagnostics(),
    assets:window.ASOBOON_BOARD_CHARACTER_ASSETS.diagnostics(),
  }));
  expect(state.chars.idlePace).toBeGreaterThanOrEqual(1.4);
  expect(state.chars.sceneRecipeCount).toBe(23);
  expect(state.assets.anchorCount).toBe(30);
  expect(state.sourceFx.pace).toBeGreaterThanOrEqual(1.3);
  expect(state.assets.effectRules.dodge).toEqual(expect.arrayContaining(['jump_arc','speed_slash']));
  expect(state.assets.effectRules.impact).not.toContain('jump_arc');
  expect(state.assets.effectRules.impact).not.toContain('sparkle_gold');
});

test('hold transition uses the special-event path without legacy world variables', async () => {
  const code=fs.readFileSync('miniapp-v2/develop/board/board-animations.js','utf8');
  expect(code).not.toContain('Promise.all([motion,particles,world])');
  expect(code).toContain("specialScreen('hold'");
  expect(code).toContain("playStatusAccent?.('hold'");
  expect(code).toContain("onomatopoeia('キキキキィー！！'");
  expect(code).toContain("onomatopoeia('ピタッ！！'");
  expect(code).toContain('impactFreeze(');
});


test('real status effects serialize as full-screen manga special events', async () => {
  const code=fs.readFileSync('miniapp-v2/develop/board/board-animations.js','utf8');
  expect(code).toContain('const MAX_CONCURRENT=1;');
  expect(code).not.toContain("const particles=runParticles('call'");
  expect(code).not.toContain("const particles=runParticles('guided'");
  expect(code).not.toContain("const particles=runParticles('hold'");
  expect(code).not.toContain("const particles=runParticles('cancel'");
  expect(code).toContain("onomatopoeia('キタ！'");
  expect(code).toContain("onomatopoeia('ドォォン！！'");
  expect(code).toContain("onomatopoeia('シュッ！！'");
  expect(code).toContain("onomatopoeia('ビューン！！'");
  expect(code).toContain("onomatopoeia('キキキキィー！！'");
  expect(code).toContain("onomatopoeia('バァァァリン！！'");
  expect(code).toContain("onomatopoeia('ガシャン！'");
  expect(code).toContain('foregroundShards(rect,{count:lvl<=1?4:6');
  expect(code).toContain("specialScreen('call'");
  expect(code).toContain("specialScreen('guided'");
  expect(code).toContain("specialScreen('hold'");
  expect(code).toContain("specialScreen('cancel'");
});

test('face-safe placement, target-aware gaze and CALL edge exits are active behavior', async ({ page }) => {
  test.setTimeout(15000);
  await installBoard(page,[payload([{number:'8640',state:'waiting',order:1}])]);
  const result=await page.evaluate(async()=>{
    const fx=window.ASOBOON_BOARD_EFFECTS;
    const chars=window.ASOBOON_BOARD_CHARACTER_EVENTS;
    const assets=window.ASOBOON_BOARD_CHARACTER_ASSETS;
    fx.setSlowdown(0.03,{persistValue:false});
    chars.resetForTest();
    const card=document.querySelector('#queueGrid .queue-card');
    const r=card.getBoundingClientRect();
    const rect={left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
    await chars.playStatusAccent('cancel',{rect});
    await chars.playCallDelivery({number:'8640',rect});
    return{
      diagnostics:chars.getDiagnostics(),
      meta:assets.CHARACTER_META,
      recipes:chars.sceneRecipes,
      leftovers:document.querySelectorAll('.pc-sprite,.pc-effect').length,
    };
  });
  expect(result.diagnostics.faceSafeAdjustments).toBeGreaterThan(0);
  expect(result.diagnostics.gazeResolved).toBeGreaterThan(0);
  expect(result.meta.pompon_dash.nativeFacing).toBe('right');
  expect(result.meta.pompon_dash.flipSafe).toBe(true);
  expect(result.meta.chiru_retort.gazePolicy).toBe('target-aware');
  expect(result.recipes.POMPON_BRAKE_FAIL.faceSafeDuringReaction).toBe(true);
  expect(result.recipes.POMPON_BRAKE_FAIL.facingPolicy).toBe('target-aware-when-directional');
  expect(result.recipes.POMPON_BRAKE_FAIL.exitGrammar).toBe('edge-or-occlusion');
  expect(result.leftovers).toBe(0);

  const code=fs.readFileSync('miniapp-v2/develop/board/board-character-events.js','utf8');
  const start=code.indexOf('async function callDelivery');
  const end=code.indexOf('const PLAYERS=Object.freeze',start);
  const call=code.slice(start,end);
  expect(call).not.toContain('hide(p)');
  expect(call).toContain("p.dataset.pcLookTarget='CHIRU'");
  expect(call).toContain('pExitX');
  expect(call).toContain('cExitX');
});

test('character scenes enforce one visible POMPON and one visible CHIRU unless explicitly represented by one DUO sprite', async ({ page }) => {
  await installBoard(page, [payload([{ number:'8651', state:'waiting', order:1 }])]);
  const state=await page.evaluate(() => window.ASOBOON_BOARD_CHARACTER_EVENTS.getDiagnostics());
  expect(state.characterContinuity).toBe('single-instance-per-character');
  const code=fs.readFileSync('miniapp-v2/develop/board/board-character-events.js','utf8');
  expect(code).toContain("if(owner==='DUO')");
  expect(code).toContain('suppressVisibleCharacter(state.POMPON)');
  expect(code).toContain('suppressVisibleCharacter(state.CHIRU)');
  expect(code).toContain('suppressVisibleCharacter(state[owner])');
});


test('all 23 character idle patterns play, clean up, and preserve ticket data', async ({ page }) => {
  test.setTimeout(30000);
  const h = await installBoard(page, [payload([
    { number:'8251', state:'waiting', order:1 },
    { number:'8252', state:'calling', order:2 },
    { number:'8253', state:'hold', order:3 },
  ])]);
  await page.evaluate(() => {
    window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.015,{persistValue:false});
    window.ASOBOON_BOARD_CHARACTER_EVENTS.resetForTest();
  });
  const ids=await page.evaluate(() => window.ASOBOON_BOARD_CHARACTER_EVENTS.events.map(x=>x.id));
  expect(ids).toHaveLength(23);
  for(const id of ids){
    const result=await page.evaluate(async eventId=>{
      const fx=window.ASOBOON_BOARD_EFFECTS;
      fx.resetPerformanceBaseline();
      const played=await window.ASOBOON_BOARD_CHARACTER_EVENTS.playEventForTest(eventId);
      return{
        played,
        runtime:fx.diagnostics(),
        numbers:[...document.querySelectorAll('#queueGrid .queue-number')].map(x=>x.textContent.trim()),
        tempNodes:document.querySelectorAll('.pc-sprite,.pc-giant-ball').length,
      };
    },id);
    expect(result.played.played,id).toBe(true);
    expect(result.runtime.activeScopes,id).toBe(0);
    expect(result.runtime.domDeltaPeak,id).toBeLessThanOrEqual(20);
    expect(result.tempNodes,id).toBe(0);
    expect(result.numbers,id).toEqual(['8251','8252','8253']);
  }
  expect(h.pageErrors).toEqual([]);
});

test('all six source effect patterns play and clean up', async ({ page }) => {
  await installBoard(page, [payload([{ number:'8261', state:'waiting', order:1 }])]);
  await page.evaluate(() => {
    window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.02,{persistValue:false});
    window.ASOBOON_BOARD_SOURCE_EFFECTS.resetForTest();
  });
  const ids=await page.evaluate(() => [...window.ASOBOON_BOARD_SOURCE_EFFECTS.events]);
  expect(ids).toHaveLength(6);
  for(const id of ids){
    const result=await page.evaluate(async eventId=>{
      const played=await window.ASOBOON_BOARD_SOURCE_EFFECTS.play(eventId);
      return{
        played,
        running:window.ASOBOON_BOARD_SOURCE_EFFECTS.getDiagnostics().running,
        tempNodes:document.querySelectorAll('.pc-effect').length,
        scopes:window.ASOBOON_BOARD_EFFECTS.diagnostics().activeScopes,
      };
    },id);
    expect(result.played.played,id).toBe(true);
    expect(result.running,id).toBe(false);
    expect(result.tempNodes,id).toBe(0);
    expect(result.scopes,id).toBe(0);
  }
});


test('fourth-wall pack atlases are present and bounded for kiosk use', async () => {
  const files=[
    ['fw-cracks-atlas.webp',900000],
    ['fw-frames-atlas.webp',1100000],
    ['fw-shards-atlas.webp',900000],
    ['fw-impacts-atlas.webp',1100000],
    ['fw-pompon-atlas.webp',800000],
    ['fw-duo-atlas.webp',850000],
  ];
  for(const [name,max] of files){
    const stat=fs.statSync('miniapp-v2/develop/board/assets/'+name);
    expect(stat.size,name).toBeGreaterThan(20000);
    expect(stat.size,name).toBeLessThan(max);
  }
});

test('all 20 fourth-wall patterns play, clean up and preserve ticket data', async ({ page }) => {
  test.setTimeout(30000);
  const h=await installBoard(page,[payload([
    { number:'8701', state:'waiting', order:1 },
    { number:'8702', state:'calling', order:2 },
    { number:'8703', state:'hold', order:3 },
  ])]);
  await page.evaluate(() => {
    window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.012,{persistValue:false});
    window.ASOBOON_BOARD_FOURTH_WALL_EVENTS.resetForTest();
  });
  const ids=await page.evaluate(() => window.ASOBOON_BOARD_FOURTH_WALL_EVENTS.events.map(x=>x.id));
  expect(ids).toHaveLength(20);
  for(const id of ids){
    const result=await page.evaluate(async eventId=>{
      const fx=window.ASOBOON_BOARD_EFFECTS;
      fx.resetPerformanceBaseline();
      const played=await window.ASOBOON_BOARD_FOURTH_WALL_EVENTS.playEventForTest(eventId);
      return{
        played,
        running:window.ASOBOON_BOARD_FOURTH_WALL_EVENTS.getDiagnostics().running,
        runtime:fx.diagnostics(),
        numbers:[...document.querySelectorAll('#queueGrid .queue-number')].map(x=>x.textContent.trim()),
        nodes:document.querySelectorAll('.fw-sprite').length,
      };
    },id);
    expect(result.played.played,id).toBe(true);
    expect(result.running,id).toBe(false);
    expect(result.runtime.activeScopes,id).toBe(0);
    expect(result.runtime.domDeltaPeak,id).toBeLessThanOrEqual(20);
    expect(result.nodes,id).toBe(0);
    expect(result.numbers,id).toEqual(['8701','8702','8703']);
  }
  expect(h.pageErrors).toEqual([]);
});

test('real data change immediately interrupts fourth-wall breakout and leaves no fragments', async ({ page }) => {
  await installBoard(page,[payload([{number:'8711',state:'waiting',order:1}])]);
  await page.evaluate(() => {
    window.ASOBOON_BOARD_EFFECTS.setSlowdown(0.5,{persistValue:false});
    window.ASOBOON_BOARD_FOURTH_WALL_EVENTS.resetForTest();
    window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR.resetForTest();
    void window.ASOBOON_BOARD_FOURTH_WALL_EVENTS.play('FW_DUO_SHARED_BREAK');
  });
  await expect.poll(async()=>page.evaluate(()=>window.ASOBOON_BOARD_FOURTH_WALL_EVENTS.getDiagnostics().running)).toBe(true);
  await page.evaluate(()=>window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR.onRealChange());
  await expect.poll(async()=>page.evaluate(()=>window.ASOBOON_BOARD_FOURTH_WALL_EVENTS.getDiagnostics().running)).toBe(false);
  await expect(page.locator('.fw-sprite')).toHaveCount(0);
});

test('show director spaces jackpot scenes while fourth-wall pack remains source-only', async ({ page }) => {
  await installBoard(page,[payload([{number:'8721',state:'waiting',order:1}])]);
  const state=await page.evaluate(()=>({
    director:window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR.getConfig(),
    diagnostics:window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR.getDiagnostics(),
    fourth:window.ASOBOON_BOARD_FOURTH_WALL_EVENTS.getDiagnostics(),
    assets:window.ASOBOON_BOARD_FOURTH_WALL_ASSETS.diagnostics(),
  }));
  expect(state.director.MEGA_MIN_MS).toBe(90000);
  expect(state.director.CHARACTER_FORCE_AFTER_MS).toBe(25000);
  expect(state.director.MAX_PURE_FX_IN_ROW).toBe(1);
  expect(state.director.arcs.FOURTH_WALL_MYSTERY.beats).toBe(11);
  expect(state.diagnostics.scheduler).toBe('show-director-v1');
  expect(state.fourth.events).toHaveLength(20);
  expect(state.assets.totalImplementationAssets).toBe(80);
  expect(state.assets.source).toBe('fourth_wall_implementation_pack_v1');
});
