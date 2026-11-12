// Production regression tests: same identity and lifecycle guarantees as Developing, using an armed /tmp copy only.
// Core rule under test: receiptNo is a display number. Ownership is decided by
// LINE user + requestId + reserveId (+ waitTypeId), never by receiptNo alone.
import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  FakeD1, FakeWorld, prepareRuntime, baseEnv, call, makeCtx, signOfficialLine,
  DIAG_TOKEN, WORKER_URL,
} from './helpers/production-worker-harness.mjs';

const DAY = '2026-10-03';                       // Saturday (土日祝日)
const NOON_JST = Date.parse('2026-10-03T03:00:00Z');

let worker, db, world, env;

before(async () => {
  const runtimeUrl = prepareRuntime();
  mock.timers.enable({ apis: ['Date'], now: NOON_JST });
  db = new FakeD1();
  world = new FakeWorld();
  globalThis.fetch = (input, init) => world.fetch(input, init);
  worker = (await import(runtimeUrl)).default;
});

let isolatedTestClock=0;
beforeEach(() => {
  // Keep shared Worker caches isolated without crossing the same 10-min rate window.
  mock.timers.setTime(NOON_JST+(++isolatedTestClock)*11_000);
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

  const firstSession = await session('Ualice');
  world.row(first.reserveId).status = '2'; // AirWAIT done / 案内済み
  const done = await status(firstSession.sessionToken);
  assert.equal(done.state, 'done');
  assert.equal(claimRow(first.reserveId).state, 'COMPLETED', 'observed done state must be persisted');

  // Completed claims must remain recoverable even after AirWAIT stops listing the old row.
  const recovered = await session('Ualice');
  assert.equal(recovered.reserveId, first.reserveId);
  world.reservations = world.reservations.filter(r => r.reserveId !== first.reserveId);

  advance();
  const second = await create('Ualice', '0031', 'req-alice-after-done-0001');
  assert.notEqual(second.reserveId, first.reserveId);
  assert.equal(world.reservations.length, 1);
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

test('hard-OFF create performs zero LINE notifier and zero AirWAIT write calls', async () => {
  const hardDb = new FakeD1();
  const hardWorld = new FakeWorld();
  globalThis.fetch = (input, init) => hardWorld.fetch(input, init);
  const hardWorker = (await import(prepareRuntime({ armed:false }))).default;
  const hardEnv = baseEnv(hardDb, { CREATE_ENABLED:'1' });
  const token = hardWorld.issueLiffToken('Uhardoff');
  const before = hardWorld.calls.length;
  const r = await call(hardWorker, hardEnv, { body: {
    action:'createReservation', requestId:'req-hard-off-0001', mode:'web', adults:1, paidChildren:0, infants:0,
    waitTypeId:'0029', operationalDate:DAY, liffAccessToken:token,
  }});
  assert.equal(r.status,503);
  assert.equal(r.data?.error,'CREATE_DISABLED');
  assert.equal(hardWorld.calls.length,before,'hard OFF must stop before LINE verify/notifier/AirWAIT');
  assert.equal(hardWorld.reservations.length,0);
  const serviceTables = hardDb.rows("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'v2_service_%'");
  assert.deepEqual(serviceTables,[],'hard OFF must not create service-message claim tables');
  globalThis.fetch = (input, init) => world.fetch(input, init);
});

// ---------------------------------------------------------------- diagnostics / rate limit

test('runtime OFF stops armed Production before notification tokens or AirWAIT creates', async () => {
  const before=world.calls.length;
  const r=await call(worker,baseEnv(db,{CREATE_ENABLED:'0'}),{body:{
    action:'createReservation',requestId:'req-runtime-off-0001',mode:'web',
    adults:1,paidChildren:0,infants:0,waitTypeId:'0029',operationalDate:DAY,
    liffAccessToken:world.issueLiffToken('Uruntimeoff'),
  }});
  assert.equal(r.status,503);
  assert.equal(r.data?.error,'CREATE_DISABLED');
  assert.equal(world.calls.length,before);
  assert.equal(world.reservations.length,0);
  // beforeEach clears rows but deliberately retains SQLite tables created by prior tests.
  // Runtime OFF must leave every notification table empty, regardless of test order.
  for(const {name} of db.rows("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'v2_service_%'")){
    assert.equal(db.rows(`SELECT COUNT(*) AS count FROM "${name}"`)[0].count,0,name);
  }
});

test('diagnostic endpoints are not available with Origin alone', async () => {
  for (const action of ['createDiagnostics', 'serviceMessageStatus']) {
    const r = await call(worker, env, { method: 'GET', query: { action, businessDate: DAY, receiptNo: '12' } });
    assert.ok([401, 403, 404].includes(r.status), `${action} -> ${r.status}`);
  }
  const withToken = await call(worker, { ...env, PRODUCTION_DIAGNOSTICS_TOKEN: DIAG_TOKEN }, {
    method: 'GET', query: { action: 'createDiagnostics' }, headers: { 'X-ASOBooN-Diagnostics': DIAG_TOKEN },
  });
  assert.equal(withToken.status, 200);
});


test('Production runtime has no Developing test slot or Developing identity', async () => {
  const workerSource = (await import('node:fs')).readFileSync('miniapp-v2/backend/production-worker.mjs','utf8');
  const gatewaySource = (await import('node:fs')).readFileSync('miniapp-v2/backend/production-gateway.js','utf8');
  const serviceSource = (await import('node:fs')).readFileSync('miniapp-v2/backend/production-service-message.js','utf8');
  const joined=[workerSource,gatewaySource,serviceSource].join('\n');
  assert.doesNotMatch(joined,/0042|2009884611|bDgDzGrN|DEVELOP_TEST/);
  assert.match(joined,/2009884613/);
  assert.match(joined,/ELc6kolf/);
});

test('shared venue IP no longer hits the old 20-per-10min create bottleneck', async () => {
  const ip='203.0.113.10';
  for(let i=0;i<25;i+=1){
    const user=`Ushared${String(i).padStart(2,'0')}`;
    const token=world.issueLiffToken(user);
    const r=await call(worker,env,{headers:{'CF-Connecting-IP':ip},body:{
      action:'createReservation',requestId:`req-shared-${String(i).padStart(4,'0')}-0001`,mode:'web',
      adults:1,paidChildren:0,infants:0,waitTypeId:'0029',operationalDate:DAY,liffAccessToken:token,
    }});
    assert.notEqual(r.status,429,`request ${i+1} must not be blocked by shared-IP limiter`);
    assert.equal(r.data?.ok,true,JSON.stringify(r.data));
  }
  assert.equal(world.reservations.length,25);
});

test('create IP abuse is rejected before any LINE/AirWAIT outbound request', async () => {
  const ip='203.0.113.200';
  const ipHash=createHash('sha256').update('ip:'+ip).digest('hex');
  const windowMs=10*60*1000;
  const windowStart=Math.floor(NOON_JST/windowMs)*windowMs;
  db.db.prepare(`CREATE TABLE IF NOT EXISTS v2_rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)`).run();
  db.db.prepare(`INSERT INTO v2_rate_limits(key,count,expires_at) VALUES(?,?,?)`).run(
    `ip:createReservation:${ipHash}:${windowStart}`,300,windowStart+windowMs
  );
  const token=world.issueLiffToken('Ublocked');
  const before=world.calls.length;
  const r=await call(worker,env,{headers:{'CF-Connecting-IP':ip},body:{
    action:'createReservation',requestId:'req-ip-blocked-0001',mode:'web',adults:1,paidChildren:0,infants:0,
    waitTypeId:'0029',operationalDate:DAY,liffAccessToken:token,
  }});
  assert.equal(r.status,429);
  assert.equal(r.data?.error,'RATE_LIMITED');
  assert.equal(world.calls.length,before,'rate limit must fail before LINE verify / notifier / AirWAIT');
  assert.equal(world.reservations.length,0);
});

test('reservationStatus is rate limited per owning LINE user, not only by shared IP',async()=>{
  const created=await create('Ustatuslimit','0029','req-status-limit-0001');
  const recovered=await session('Ustatuslimit');
  const userHash=createHash('sha256').update('2009884613:Ustatuslimit').digest('hex');
  const windowMs=10*60*1000;
  const windowStart=Math.floor(NOON_JST/windowMs)*windowMs;
  db.db.prepare(`CREATE TABLE IF NOT EXISTS v2_rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)`).run();
  db.db.prepare(`INSERT OR REPLACE INTO v2_rate_limits(key,count,expires_at) VALUES(?,?,?)`).run(
    `reservationStatus:${userHash}:${windowStart}`,180,windowStart+windowMs
  );
  const before=world.calls.length;
  const r=await call(worker,env,{body:{action:'reservationStatus',sessionToken:recovered.sessionToken}});
  assert.equal(r.status,429,JSON.stringify(r.data));
  assert.equal(r.data?.error,'RATE_LIMITED');
  assert.equal(world.calls.length,before,'rate limit must stop before AirWAIT status read');
  assert.ok(created.reserveId);
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


test('AMBIGUOUS operations are diagnostics-gated and release requires explicit AirWAIT confirmation',async()=>{
  const opsEnv={...env,PRODUCTION_DIAGNOSTICS_TOKEN:DIAG_TOKEN};
  await call(worker,opsEnv,{method:'GET',query:{action:'health'}});
  const userId='Uambiguous';
  const userHash=createHash('sha256').update('2009884613:'+userId).digest('hex');
  db.db.prepare(`INSERT INTO v2_user_day_claims(user_hash,business_date,request_id,state,receipt_no,reserve_id,wait_type_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(
    userHash,DAY,'req-ambiguous-0001','AMBIGUOUS','','','0029',NOON_JST,NOON_JST
  );
  const denied=await call(worker,env,{method:'GET',query:{action:'ambiguousClaims'}});
  assert.ok([401,403,404].includes(denied.status));
  const listed=await call(worker,opsEnv,{method:'GET',query:{action:'ambiguousClaims'},headers:{'X-ASOBooN-Diagnostics':DIAG_TOKEN}});
  assert.equal(listed.status,200,JSON.stringify(listed.data));
  assert.equal(listed.data?.claims?.[0]?.requestId,'req-ambiguous-0001');
  assert.equal(listed.data?.claims?.[0]?.userHash,undefined);
  const missingAck=await call(worker,opsEnv,{headers:{'X-ASOBooN-Diagnostics':DIAG_TOKEN},body:{action:'resolveAmbiguousClaim',requestId:'req-ambiguous-0001',resolution:'release'}});
  assert.equal(missingAck.status,400);
  assert.equal(missingAck.data?.error,'AMBIGUOUS_RELEASE_CONFIRMATION_REQUIRED');
  const released=await call(worker,opsEnv,{headers:{'X-ASOBooN-Diagnostics':DIAG_TOKEN},body:{action:'resolveAmbiguousClaim',requestId:'req-ambiguous-0001',resolution:'release',confirmation:'CONFIRMED_NO_AIRWAIT_RESERVATION'}});
  assert.equal(released.status,200,JSON.stringify(released.data));
  assert.equal(released.data?.resolution,'release');
  assert.equal(db.db.prepare(`SELECT state FROM v2_user_day_claims WHERE request_id=?`).get('req-ambiguous-0001').state,'CANCELED');
  const retried=await create(userId,'0031','req-ambiguous-retry-0001');
  assert.equal(retried.ok,true);
  const reopened=db.db.prepare(`SELECT state,wait_type_id FROM v2_user_day_claims WHERE user_hash=? AND business_date=?`).get(userHash,DAY);
  assert.equal(reopened.state,'CONFIRMED');
  assert.equal(reopened.wait_type_id,'0031');
});

test('AMBIGUOUS confirm requires full reservation identity and preserves waitType ownership',async()=>{
  const opsEnv={...env,PRODUCTION_DIAGNOSTICS_TOKEN:DIAG_TOKEN};
  await call(worker,opsEnv,{method:'GET',query:{action:'health'}});
  const userId='UambiguousConfirm';
  const userHash=createHash('sha256').update('2009884613:'+userId).digest('hex');
  db.db.prepare(`INSERT INTO v2_user_day_claims(user_hash,business_date,request_id,state,receipt_no,reserve_id,wait_type_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(
    userHash,DAY,'req-ambiguous-confirm-0001','AMBIGUOUS','','','0029',NOON_JST,NOON_JST
  );
  const incomplete=await call(worker,opsEnv,{headers:{'X-ASOBooN-Diagnostics':DIAG_TOKEN},body:{action:'resolveAmbiguousClaim',requestId:'req-ambiguous-confirm-0001',resolution:'confirm',confirmation:'CONFIRMED_AIRWAIT_RESERVATION'}});
  assert.equal(incomplete.status,400);
  const mismatch=await call(worker,opsEnv,{headers:{'X-ASOBooN-Diagnostics':DIAG_TOKEN},body:{action:'resolveAmbiguousClaim',requestId:'req-ambiguous-confirm-0001',resolution:'confirm',confirmation:'CONFIRMED_AIRWAIT_RESERVATION',reserveId:'123456789012',receiptNo:'F12',waitTypeId:'0031'}});
  assert.equal(mismatch.status,409);
  assert.equal(mismatch.data?.error,'AMBIGUOUS_WAIT_TYPE_MISMATCH');
  const confirmed=await call(worker,opsEnv,{headers:{'X-ASOBooN-Diagnostics':DIAG_TOKEN},body:{action:'resolveAmbiguousClaim',requestId:'req-ambiguous-confirm-0001',resolution:'confirm',confirmation:'CONFIRMED_AIRWAIT_RESERVATION',reserveId:'123456789012',receiptNo:'F12',waitTypeId:'0029'}});
  assert.equal(confirmed.status,200,JSON.stringify(confirmed.data));
  const row=db.db.prepare(`SELECT state,reserve_id,receipt_no,wait_type_id FROM v2_user_day_claims WHERE request_id=?`).get('req-ambiguous-confirm-0001');
  assert.deepEqual({...row},{state:'CONFIRMED',reserve_id:'123456789012',receipt_no:'F12',wait_type_id:'0029'});
});



test('a guide-complete ticket returned to waiting is restored to CONFIRMED and can be canceled by its owner',async()=>{
  const user='UguidedBackToWaiting';
  const r=await create(user,'0029','req-guide-back-0001');
  const s=await session(user);
  world.row(r.reserveId).status='2';
  const done=await status(s.sessionToken);
  assert.equal(done.found,true);
  assert.equal(done.state,'done');
  assert.equal(claimRow(r.reserveId).state,'COMPLETED');

  // AirWAIT staff action: undo completed guidance and send this SAME ticket back
  // to its previous wait queue. It is not a new reservation.
  world.row(r.reserveId).status='0';
  world.row(r.reserveId).isCalling='0';
  const waiting=await status(s.sessionToken);
  assert.equal(waiting.found,true);
  assert.equal(waiting.state,'waiting');
  assert.equal(waiting.receiptNo,r.receiptNo);
  assert.equal(waiting.waitTypeId,'0029');
  assert.equal(claimRow(r.reserveId).state,'CONFIRMED',
    'owner-bound active ticket must be protected from duplicate same-day creation');

  const other=await call(worker,env,{body:{action:'createReservation',requestId:'req-guide-back-duplicate-0002',mode:'web',adults:1,paidChildren:0,infants:0,
    waitTypeId:'0031',operationalDate:DAY,liffAccessToken:world.issueLiffToken(user)}});
  assert.equal(other.data?.alreadyExists,true,'do not issue a second active ticket');

  const canceled=await call(worker,env,{body:{action:'cancelReservation',sessionToken:s.sessionToken,liffAccessToken:world.issueLiffToken(user)}});
  assert.equal(canceled.data?.canceled,true,JSON.stringify(canceled.data));
  assert.equal(world.row(r.reserveId).status,'3');
  assert.equal(claimRow(r.reserveId).state,'CANCELED');
});


test('AirWAIT-verified completed receipt allows another same-day booking even without opening callstatus', async () => {
  const first=await create('UterminalNotOpened','0029','req-terminal-first-0001');
  world.row(first.reserveId).status='2'; // Staff completed entry in AirWAIT.
  // No reservationStatus call: this was the failure for guests skipping the call tab.
  const next=await create('UterminalNotOpened','0031','req-terminal-next-0001');
  assert.equal(Boolean(next.alreadyExists),false,'must issue a NEW number after verified completion');
  // Display numbers can repeat between different wait types; reserveId is unique.
  assert.equal(world.row(next.reserveId).waitTypeId,'0031');
  assert.notEqual(next.reserveId,first.reserveId);
  assert.equal(world.row(first.reserveId).status,'2','do not delete the old AirWAIT record');
  assert.equal(claimRow(next.reserveId).state,'CONFIRMED');
});

test('AirWAIT-verified outside cancellation permits rebooking without deleting the original AirWAIT row', async () => {
  const first=await create('UoutCancel','0029','req-cancel-first-0001');
  world.row(first.reserveId).status='3'; // Cancellation performed by staff.
  const next=await create('UoutCancel','0031','req-cancel-next-0001');
  assert.notEqual(next.reserveId,first.reserveId);
  assert.equal(world.row(first.reserveId).status,'3');
  assert.equal(claimRow(next.reserveId).state,'CONFIRMED');
});

test('completed receipt restored to waiting before another booking is protected even if callstatus was not reopened', async () => {
  const who='UstaffUndoWithoutStatus';
  const first=await create(who,'0029','req-staff-undo-first-0001');
  const s=await session(who);
  world.row(first.reserveId).status='2';
  const done=await status(s.sessionToken);
  assert.equal(done.state,'done');
  assert.equal(claimRow(first.reserveId).state,'COMPLETED');
  // Staff undo: no status refresh after this change.
  world.row(first.reserveId).status='0';
  const again=await create(who,'0031','req-staff-undo-next-0001');
  assert.equal(again.alreadyExists,true,'do not issue a second ticket while original is back in waiting');
  assert.equal(again.reserveId,first.reserveId);
  assert.equal(world.reservations.length,1);
  assert.equal(claimRow(first.reserveId).state,'CONFIRMED');
});

test('missing or non-terminal old ticket cannot be forcibly deleted for new registration', async () => {
  const first=await create('UmissingOld','0029','req-missing-first-0001');
  const original=world.row(first.reserveId);
  world.reservations=world.reservations.filter(x=>x.reserveId!==first.reserveId);
  const next=await create('UmissingOld','0031','req-missing-next-0001');
  assert.equal(next.alreadyExists,true,'missing is NOT evidence of cancellation');
  assert.equal(next.receiptNo,first.receiptNo);
  assert.equal(world.reservations.length,0,'no AirWAIT create when terminal not verified');
  world.reservations.push(original);
  world.row(first.reserveId).status='4'; // Processing is active.
  const processing=await create('UmissingOld','0031','req-missing-next-0002');
  assert.equal(processing.alreadyExists,true);
  assert.equal(world.reservations.length,1);
});


test('same LIFF token on a second reception returns actionable reopen code, never creates a second AirWAIT ticket',async()=>{
  const user='UreuseNotifierToken';
  const token=world.issueLiffToken(user);
  const send=(waitTypeId,requestId)=>call(worker,env,{body:{
    action:'createReservation',requestId,mode:'web',adults:1,paidChildren:0,infants:0,
    waitTypeId,operationalDate:DAY,liffAccessToken:token
  }});
  const first=await send('0029','req-reuse-token-first-0001');
  assert.equal(first.data?.ok,true,JSON.stringify(first.data));
  world.row(first.data.reserveId).status='2';
  const again=await send('0031','req-reuse-token-next-0001');
  assert.equal(again.status,409,JSON.stringify(again.data));
  assert.equal(again.data?.errorCode,'LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP');
  assert.match(String(again.data?.error||''),/いったん完全に閉じて/);
  assert.equal(again.data?.ambiguous,false);
  assert.equal(world.reservations.length,1,'same-bound notification token MUST NOT send a second AirWAIT create');
  const fresh=await call(worker,env,{body:{
    action:'createReservation',requestId:'req-reuse-token-fresh-0001',mode:'web',
    adults:1,paidChildren:0,infants:0,waitTypeId:'0031',operationalDate:DAY,
    liffAccessToken:world.issueLiffToken(user)
  }});
  assert.equal(fresh.data?.ok,true,JSON.stringify(fresh.data));
  assert.notEqual(fresh.data.reserveId,first.data.reserveId);
});

test('AirWAIT staff restore between first terminal verification and CREATE is caught by final recheck',async()=>{
  const user='UrestoreBetweenChecks';
  const first=await create(user,'0029','req-staff-race-first-0001');
  world.row(first.reserveId).status='2';
  const original=world.fetch.bind(world);
  let reads=0;
  world.fetch=async(input,init)=>{
    const u=new URL(String(input?.url||input));
    if(u.pathname.endsWith('/stateless/reservations')&&
       new URLSearchParams(init?.body||'').get('waitTypeId')==='0029'){
      reads++;
      if(reads===2)world.row(first.reserveId).status='0';
    }
    return original(input,init);
  };
  try{
    const again=await call(worker,env,{body:{
      action:'createReservation',requestId:'req-staff-race-next-0001',mode:'web',
      adults:1,paidChildren:0,infants:0,waitTypeId:'0031',operationalDate:DAY,
      liffAccessToken:world.issueLiffToken(user)
    }});
    assert.ok(reads>=2,'double-check must run before issuance');
    assert.equal(again.data?.ok,true,JSON.stringify(again.data));
    assert.equal(again.data?.alreadyExists,true,'restored waiting ticket is still active');
    assert.equal(again.data?.reserveId,first.reserveId);
    assert.equal(world.reservations.length,1,'no second AirWAIT ticket may be issued after restore');
    assert.equal(claimRow(first.reserveId).state,'CONFIRMED');
  }finally{world.fetch=original}
});

test('a different terminal generation replacing the prior claim during verification is not overwritten',async()=>{
  const user='UchangedGeneration';
  const first=await create(user,'0029','req-old-generation-first-0001');
  world.row(first.reserveId).status='2';
  const nextRequestId='req-other-generation-0001',nextReserveId='000000888888';
  const original=world.fetch.bind(world);
  let swapped=false;
  world.fetch=async(input,init)=>{
    const u=new URL(String(input?.url||input));
    if(!swapped&&u.pathname.endsWith('/stateless/reservations')&&
       new URLSearchParams(init?.body||'').get('waitTypeId')==='0029'){
      swapped=true;
      db.db.prepare("UPDATE v2_user_day_claims SET request_id=?,state='CONFIRMED',receipt_no='888',reserve_id=?,wait_type_id='0031' WHERE reserve_id=?")
        .run(nextRequestId,nextReserveId,first.reserveId);
    }
    return original(input,init);
  };
  try{
    const retry=await call(worker,env,{body:{
      action:'createReservation',requestId:'req-race-generation-0001',mode:'web',
      adults:1,paidChildren:0,infants:0,waitTypeId:'0031',operationalDate:DAY,
      liffAccessToken:world.issueLiffToken(user)
    }});
    assert.equal(swapped,true);
    assert.equal(retry.data?.alreadyExists,true,JSON.stringify(retry.data));
    assert.equal(retry.data?.reserveId,nextReserveId);
    assert.equal(world.reservations.length,1);
    assert.equal(db.db.prepare('SELECT request_id FROM v2_user_day_claims WHERE reserve_id=?').get(nextReserveId).request_id,nextRequestId);
  }finally{world.fetch=original}
});
