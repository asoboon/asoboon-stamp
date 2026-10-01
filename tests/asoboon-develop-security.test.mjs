// Regression tests for the 2026-10-01 security audit (Developing Worker only).
// Core rule under test: receiptNo is a display number. Ownership is decided by
// LINE user + requestId + reserveId (+ waitTypeId), never by receiptNo alone.
import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  FakeD1, FakeWorld, prepareRuntime, baseEnv, call, makeCtx, signOfficialLine,
  DIAG_TOKEN, WORKER_URL,
} from './helpers/develop-worker-harness.mjs';

const DAY = '2026-10-03';                       // Saturday (土日祝日)
const NOON_JST = Date.parse('2026-10-03T03:00:00Z');

let worker, db, world, env;

before(async () => {
  prepareRuntime();
  mock.timers.enable({ apis: ['Date'], now: NOON_JST });
  db = new FakeD1();
  world = new FakeWorld();
  globalThis.fetch = (input, init) => world.fetch(input, init);
  worker = (await import('../miniapp-v2/backend/develop-worker.mjs')).default;
});

beforeEach(() => {
  mock.timers.setTime(NOON_JST);
  db.clear();
  world.reset();
  env = baseEnv(db);
});

function advance(ms = 10_000) { mock.timers.tick(ms); }

async function create(userId, waitTypeId, requestId = `req-${userId}-${waitTypeId}-0001`) {
  const r = await call(worker, env, { body: {
    action: 'createReservation', requestId, mode: 'web', adults: 1, paidChildren: 0, infants: 0,
    waitTypeId, operationalDate: DAY, liffAccessToken: world.issueLiffToken(userId),
  } });
  assert.equal(r.data?.ok, true, `create ${userId}/${waitTypeId}: ${JSON.stringify(r.data)}`);
  return { ...r.data, requestId };
}

async function session(userId) {
  const r = await call(worker, env, { body: { action: 'recoverReservationSession', businessDate: DAY, liffAccessToken: world.issueLiffToken(userId) } });
  assert.equal(r.data?.found, true, JSON.stringify(r.data));
  return r.data;
}

async function status(sessionToken) {
  advance();
  return (await call(worker, env, { body: { action: 'reservationStatus', sessionToken } })).data;
}

async function cron() {
  advance();
  const ctx = makeCtx();
  await worker.scheduled({}, env, ctx);
  await ctx.drain();
}

const callMessages = () => world.sent.filter(m => m.templateName === 'yourturn_s_w_ja');
const cancelMessages = () => world.sent.filter(m => /cancel|cancle/.test(m.templateName));
const messageRow = reserveId => db.rows('SELECT * FROM v2_service_messages WHERE reserve_id=?', reserveId)[0];
const claimRow = reserveId => db.rows('SELECT * FROM v2_user_day_claims WHERE reserve_id=?', reserveId)[0];

async function twoUsersWithReceipt12() {
  world.setNextNumber('0029', 12);
  world.setNextNumber('0031', 12);
  const a = await create('Ualice', '0029');
  const b = await create('Ubob', '0031');
  assert.equal(a.receiptNo, '12');
  assert.equal(b.receiptNo, '12');
  assert.notEqual(a.reserveId, b.reserveId);
  return { a, b };
}

// ---------------------------------------------------------------- 0029#12 / 0031#12

test('cron: calling 0029#12 notifies only its owner, never the 0031#12 owner', async () => {
  const { a, b } = await twoUsersWithReceipt12();
  world.row(a.reserveId).isCalling = '1';
  await cron();
  assert.deepEqual(callMessages().map(m => world.recipientOf(m)), ['Ualice']);
  assert.equal(messageRow(b.reserveId).notified_at, 0);
  assert.equal(messageRow(b.reserveId).wait_type_id, '0031');
});

test('call status: 0031#12 owner never sees the calling state of 0029#12', async () => {
  const { a, b } = await twoUsersWithReceipt12();
  world.row(a.reserveId).isCalling = '1';
  const s = await session('Ubob');
  const st = await status(s.sessionToken);
  assert.equal(st.found, true);
  assert.equal(st.waitTypeId, '0031');
  assert.equal(st.state, 'waiting');
  assert.equal(callMessages().length, 0, 'observing 0031#12 must not notify anyone');
});

test('call status observation of 0029#12 does not notify or re-type the 0031#12 row', async () => {
  const { a, b } = await twoUsersWithReceipt12();
  // Make Bob's row the most recently updated one, which is what a receiptNo-only lookup would pick.
  db.db.prepare('UPDATE v2_service_messages SET updated_at=updated_at+60000 WHERE reserve_id=?').run(b.reserveId);
  world.row(a.reserveId).isCalling = '1';
  const s = await session('Ualice');
  const st = await status(s.sessionToken);
  assert.equal(st.state, 'calling');
  assert.deepEqual(callMessages().map(m => world.recipientOf(m)), ['Ualice']);
  assert.equal(messageRow(b.reserveId).wait_type_id, '0031');
  assert.equal(messageRow(b.reserveId).notified_at, 0);
});

test('cron: when 0031#12 vanishes from its own waitType, the canceled 0029#12 is not adopted', async () => {
  const { a, b } = await twoUsersWithReceipt12();
  world.row(a.reserveId).status = '3';                         // Alice canceled
  world.reservations = world.reservations.filter(r => r.reserveId !== b.reserveId); // Bob's row temporarily missing
  await cron();
  assert.equal(claimRow(b.reserveId).state, 'CONFIRMED', 'Bob must not be marked canceled');
  assert.equal(claimRow(b.reserveId).wait_type_id, '0031');
  assert.equal(messageRow(b.reserveId).wait_type_id, '0031', 'waitTypeId must never be rewritten from observation');
  assert.deepEqual(cancelMessages().map(m => world.recipientOf(m)), ['Ualice']);
});

test('cron: a calling 0029#12 is not adopted when 0031#12 is missing', async () => {
  const { a, b } = await twoUsersWithReceipt12();
  world.row(a.reserveId).isCalling = '1';
  world.reservations = world.reservations.filter(r => r.reserveId !== b.reserveId);
  await cron();
  assert.deepEqual(callMessages().map(m => world.recipientOf(m)), ['Ualice']);
  assert.equal(messageRow(b.reserveId).notified_at, 0);
  assert.equal(messageRow(b.reserveId).wait_type_id, '0031');
});

test('cancel: 0031#12 owner cancels only reserveId of 0031#12', async () => {
  const { a, b } = await twoUsersWithReceipt12();
  const s = await session('Ubob');
  const r = await call(worker, env, { body: { action: 'cancelReservation', sessionToken: s.sessionToken, liffAccessToken: world.issueLiffToken('Ubob') } });
  assert.equal(r.data?.canceled, true, JSON.stringify(r.data));
  assert.equal(world.row(b.reserveId).status, '3');
  assert.equal(world.row(a.reserveId).status, '0', 'Alice must stay active');
  assert.equal(claimRow(a.reserveId).state, 'CONFIRMED');
  assert.equal(claimRow(b.reserveId).state, 'CANCELED');
  assert.deepEqual(cancelMessages().map(m => world.recipientOf(m)), ['Ubob']);
});

test('cancel: another LINE user cannot use a stolen session token', async () => {
  const { b } = await twoUsersWithReceipt12();
  const s = await session('Ubob');
  const r = await call(worker, env, { body: { action: 'cancelReservation', sessionToken: s.sessionToken, liffAccessToken: world.issueLiffToken('Umallory') } });
  assert.equal(r.status, 403);
  assert.equal(world.row(b.reserveId).status, '0');
});

test('same-day cancel then re-reception still works', async () => {
  const first = await create('Ualice', '0029', 'req-alice-first-0001');
  const s = await session('Ualice');
  const c = await call(worker, env, { body: { action: 'cancelReservation', sessionToken: s.sessionToken, liffAccessToken: world.issueLiffToken('Ualice') } });
  assert.equal(c.data?.canceled, true, JSON.stringify(c.data));
  advance();
  const second = await create('Ualice', '0031', 'req-alice-second-0001');
  assert.notEqual(second.reserveId, first.reserveId);
  assert.equal(claimRow(second.reserveId).state, 'CONFIRMED');
});

test('same-day completed visit can take a later slot while an active visit cannot duplicate', async () => {
  const first = await create('Ualice', '0029', 'req-alice-active-0001');
  const blocked = await create('Ualice', '0031', 'req-alice-active-duplicate-0001');
  assert.equal(blocked.reserveId, first.reserveId, 'active reservation must remain the single current reservation');
  assert.equal(world.reservations.length, 1);

  world.row(first.reserveId).status = '2'; // AirWAIT done / 案内済み
  advance();
  const second = await create('Ualice', '0031', 'req-alice-after-done-0001');
  assert.notEqual(second.reserveId, first.reserveId);
  assert.equal(world.reservations.length, 2);
  assert.equal(claimRow(second.reserveId).state, 'CONFIRMED');
});

// ---------------------------------------------------------------- requestId ownership / shortUrl

test('create response and session recovery never expose the AirWAIT shortUrl', async () => {
  const a = await create('Ualice', '0029');
  assert.equal(a.shortUrl ?? '', '');
  const s = await session('Ualice');
  assert.equal(s.shortUrl ?? '', '');
});

test('requestStatus requires the owning LINE user', async () => {
  const a = await create('Ualice', '0029');
  const legacyGet = await call(worker, env, { method: 'GET', query: { action: 'requestStatus', requestId: a.requestId } });
  assert.equal(legacyGet.data?.reserveId, undefined, 'GET without LINE identity must not leak results');

  const other = await call(worker, env, { body: { action: 'requestStatus', requestId: a.requestId, liffAccessToken: world.issueLiffToken('Umallory') } });
  assert.equal(other.data?.reserveId, undefined);
  assert.equal(other.data?.receiptNo, undefined);

  const own = await call(worker, env, { body: { action: 'requestStatus', requestId: a.requestId, liffAccessToken: world.issueLiffToken('Ualice') } });
  assert.equal(own.data?.found, true);
  assert.equal(own.data?.reserveId, a.reserveId);
  assert.equal(own.data?.shortUrl ?? '', '');
});

test('replaying another user\'s requestId cannot read or re-bind their reservation', async () => {
  const a = await create('Ualice', '0029');
  const before = messageRow(a.reserveId).notification_token;
  const r = await call(worker, env, { body: {
    action: 'createReservation', requestId: a.requestId, mode: 'web', adults: 1, paidChildren: 0, infants: 0,
    waitTypeId: '0029', operationalDate: DAY, liffAccessToken: world.issueLiffToken('Umallory'),
  } });
  assert.notEqual(r.data?.reserveId, a.reserveId);
  assert.equal(messageRow(a.reserveId).notification_token, before, 'notification token must stay with the owner');
  world.row(a.reserveId).isCalling = '1';
  await cron();
  assert.deepEqual(callMessages().map(m => world.recipientOf(m)), ['Ualice']);
});

// ---------------------------------------------------------------- diagnostics / 0042 / rate limit

test('diagnostic endpoints are not available with Origin alone', async () => {
  for (const action of ['createDiagnostics', 'serviceMessageStatus']) {
    const r = await call(worker, env, { method: 'GET', query: { action, businessDate: DAY, receiptNo: '12' } });
    assert.ok([401, 403, 404].includes(r.status), `${action} -> ${r.status}`);
  }
  const withToken = await call(worker, { ...env, DEVELOP_DIAGNOSTICS_TOKEN: DIAG_TOKEN }, {
    method: 'GET', query: { action: 'createDiagnostics' }, headers: { 'X-ASOBooN-Diagnostics': DIAG_TOKEN },
  });
  assert.equal(withToken.status, 200);
});

test('0042 test slot is rejected unless explicitly enabled for that LINE user', async () => {
  const denied = await call(worker, env, { body: {
    action: 'createReservation', requestId: 'req-0042-denied-0001', mode: 'web', adults: 1, paidChildren: 0, infants: 0,
    waitTypeId: '0042', operationalDate: DAY, liffAccessToken: world.issueLiffToken('Ualice'),
  } });
  assert.notEqual(denied.data?.ok, true);
  assert.equal(world.reservations.length, 0, 'no AirWAIT reception may be created');
});

test('session issuance is rate limited per LINE user', async () => {
  await create('Ualice', '0029');
  let limited = false;
  for (let i = 0; i < 80 && !limited; i += 1) {
    const r = await call(worker, env, { body: { action: 'recoverReservationSession', businessDate: DAY, liffAccessToken: world.issueLiffToken('Ualice') } });
    if (r.status === 429) limited = true;
  }
  assert.ok(limited, 'recoverReservationSession must eventually return 429');
  const other = await call(worker, env, { body: { action: 'recoverReservationSession', businessDate: DAY, liffAccessToken: world.issueLiffToken('Ubob') } });
  assert.notEqual(other.status, 429, 'limits are per user');
});

// ---------------------------------------------------------------- official LINE webhook

test('official LINE webhook finds the reservation with the unified identity hash', async () => {
  const a = await create('Ualice', '0029');
  const raw = JSON.stringify({ events: [{ type: 'message', replyToken: 'rt', source: { type: 'user', userId: 'Ualice' }, message: { type: 'text', text: '受付確認' } }] });
  const ctx = makeCtx();
  const res = await worker.fetch(new Request(new URL('/line-webhook', WORKER_URL), {
    method: 'POST', headers: { 'x-line-signature': signOfficialLine(raw), 'Content-Type': 'application/json' }, body: raw,
  }), env, ctx);
  await ctx.drain();
  assert.equal(res.status, 200);
  const text = JSON.stringify(world.replies);
  assert.match(text, new RegExp(`受付番号 ${a.receiptNo}`));
});
