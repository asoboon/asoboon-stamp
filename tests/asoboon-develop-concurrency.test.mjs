import { test, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  FakeD1, FakeWorld, prepareRuntime, baseEnv, call, makeCtx,
} from './helpers/develop-worker-harness.mjs';

const DAY = '2026-10-02';
const AT_1400_JST = Date.parse('2026-10-02T05:00:00.000Z');
const WAIT_TYPE = '0025';
const CLIENTS = 320;

let worker;

before(async () => {
  prepareRuntime();
  mock.timers.enable({ apis: ['Date'], now: AT_1400_JST });
  worker = (await import('../miniapp-v2/backend/develop-worker.mjs')).default;
});

test('320 simultaneous one-person reservations keep identity, receipt, reserveId and LINE confirmation isolated', async () => {
  const db = new FakeD1();
  const world = new FakeWorld();
  const env = baseEnv(db);
  world.businessType = '平日';
  world.setNextNumber(WAIT_TYPE, 9001);

  const rawFetch = world.fetch.bind(world);
  world.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
    const body = typeof init.body === 'string' ? init.body : '';
    let seed = 0;
    for (const ch of url.pathname + body) seed = (seed + ch.charCodeAt(0)) % 17;
    if (
      url.pathname.endsWith('/reserve/create') ||
      url.href.includes('/message/v3/notifier/token') ||
      url.href.includes('/message/v3/notifier/send')
    ) {
      await new Promise(resolve => setTimeout(resolve, (16 - seed) % 11));
    }
    return rawFetch(input, init);
  };
  globalThis.fetch = (input, init) => world.fetch(input, init);

  const pad = n => String(n).padStart(3, '0');
  const users = Array.from({ length: CLIENTS }, (_, i) => ({
    userId: 'BurstUser' + pad(i + 1),
    requestId: 'burst-20261002-14-' + pad(i + 1) + '-request',
  }));

  const results = await Promise.all(users.map(async user => {
    const response = await call(worker, env, {
      body: {
        action: 'createReservation',
        requestId: user.requestId,
        mode: 'web',
        adults: 1,
        paidChildren: 0,
        infants: 0,
        waitTypeId: WAIT_TYPE,
        operationalDate: DAY,
        liffAccessToken: world.issueLiffToken(user.userId),
      },
    });
    return { ...user, response };
  }));

  const failed = results.filter(x => x.response.status !== 200 || x.response.data?.ok !== true);
  assert.equal(failed.length, 0, JSON.stringify(failed.slice(0, 3)));

  const reserveIds = results.map(x => String(x.response.data.reserveId));
  const receiptNos = results.map(x => String(x.response.data.receiptNo));
  assert.equal(new Set(reserveIds).size, CLIENTS, 'reserveId must stay one-to-one');
  assert.equal(new Set(receiptNos).size, CLIENTS, 'receiptNo must stay unique inside one waitType');
  assert.equal(world.reservations.length, CLIENTS);

  const claims = db.rows(
    'SELECT request_id,receipt_no,reserve_id,wait_type_id,state FROM v2_user_day_claims ORDER BY request_id'
  );
  assert.equal(claims.length, CLIENTS);
  for (const item of results) {
    const claim = claims.find(row => row.request_id === item.requestId);
    assert.ok(claim, 'missing claim for ' + item.userId);
    assert.equal(String(claim.reserve_id), String(item.response.data.reserveId), 'reserveId mix-up: ' + item.userId);
    assert.equal(String(claim.receipt_no), String(item.response.data.receiptNo), 'receiptNo mix-up: ' + item.userId);
    assert.equal(String(claim.wait_type_id), WAIT_TYPE, 'waitType mix-up: ' + item.userId);
    assert.equal(String(claim.state), 'CONFIRMED');
  }

  const confirmations = world.sent.filter(m => m.templateName === 'waiting_req_d_w_ja');
  assert.equal(confirmations.length, CLIENTS, 'every virtual user gets exactly one reception confirmation');
  const confirmationByUser = new Map(confirmations.map(message => [world.recipientOf(message), message]));
  for (const item of results) {
    const message = confirmationByUser.get(item.userId);
    assert.ok(message, 'missing confirmation for ' + item.userId);
    assert.equal(
      String(message.params?.number || ''),
      String(item.response.data.receiptNo),
      'LINE confirmation crossed users: ' + item.userId
    );
  }

  assert.equal(
    world.sent.filter(m => m.templateName === 'yourturn_s_w_ja').length,
    0,
    'no call notification may be sent before AirWAIT marks a reservation as calling'
  );

  const recovered = await Promise.all(users.map(async (user, index) => {
    const response = await call(worker, env, {
      body: {
        action: 'recoverReservationSession',
        businessDate: DAY,
        liffAccessToken: world.issueLiffToken(user.userId),
      },
    });
    return { user, index, response };
  }));
  for (const item of recovered) {
    assert.equal(item.response.data?.found, true, 'recovery missing: ' + item.user.userId);
    assert.equal(
      String(item.response.data.reserveId),
      String(results[item.index].response.data.reserveId),
      'recovery reserveId crossed users: ' + item.user.userId
    );
    assert.equal(
      String(item.response.data.receiptNo),
      String(results[item.index].response.data.receiptNo),
      'recovery receiptNo crossed users: ' + item.user.userId
    );
  }

  const ctx = makeCtx();
  await worker.scheduled({}, env, ctx);
  await ctx.drain();

  const snapshotRow = db.rows(
    "SELECT value FROM v2_system_state WHERE key='concurrency_integrity_snapshot_v1' LIMIT 1"
  )[0];
  assert.ok(snapshotRow, 'scheduled concurrency audit snapshot must be stored');
  const audit = JSON.parse(String(snapshotRow.value || '{}'));
  assert.equal(audit.status, 'ok', JSON.stringify(audit));
  assert.equal(audit.identityIntegrity?.ok, true, JSON.stringify(audit.identityIntegrity));
  assert.equal(audit.deliveryIntegrity?.ok, true, JSON.stringify(audit.deliveryIntegrity));
  assert.equal(audit.burst?.targetConcurrentClients, 300);
  assert.equal(audit.burst?.createRequestsSeen, CLIENTS);
  assert.equal(audit.burst?.peak1s, CLIENTS);
  assert.equal(audit.bindings?.claimsAudited, CLIENTS);
  assert.equal(audit.bindings?.serviceRowsAudited, CLIENTS);
  assert.equal(audit.bindings?.confirmationRowsAudited, CLIENTS);
  assert.equal(audit.hotPathWritesAdded, 0);

  assert.equal(
    world.sent.filter(m => m.templateName === 'yourturn_s_w_ja').length,
    0,
    'scheduled audit/service reconciliation must not invent call notifications'
  );
});
