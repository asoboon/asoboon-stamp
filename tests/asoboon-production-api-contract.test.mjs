import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  FakeD1, FakeWorld, prepareRuntime, baseEnv, call, makeCtx, DIAG_TOKEN,
} from './helpers/production-worker-harness.mjs';

const DAY='2026-10-03';
const NOON_JST=Date.parse('2026-10-03T03:00:00Z');
let worker,db,world,env;

before(async()=>{
  const runtimeUrl=prepareRuntime();
  mock.timers.enable({apis:['Date'],now:NOON_JST});
  db=new FakeD1();
  world=new FakeWorld();
  globalThis.fetch=(input,init)=>world.fetch(input,init);
  // Cloudflare cache API used by surprise-vote warm path.
  const cache=new Map();
  globalThis.caches={default:{
    async match(req){const v=cache.get(String(req.url||req));return v?v.clone():undefined},
    async put(req,res){cache.set(String(req.url||req),res.clone())},
  }};
  worker=(await import(runtimeUrl)).default;
});

beforeEach(()=>{
  mock.timers.setTime(NOON_JST);
  db.clear();
  world.reset();
  env=baseEnv(db,{PRODUCTION_DIAGNOSTICS_TOKEN:DIAG_TOKEN});
});

test('Production health exposes certified identity and service-message fail-close contract',async()=>{
  const r=await call(worker,env,{method:'GET',query:{action:'health'}});
  assert.equal(r.status,200,JSON.stringify(r.data));
  assert.equal(r.data?.environment,'official-production');
  assert.deepEqual(r.data?.acceptedClientIds,['2009884613']);
  assert.equal(r.data?.productionCreateArmed,true,'test runtime only must be armed');
  assert.equal(r.data?.serviceMessageMandatoryBeforeCreate,true);
  assert.equal(r.data?.serviceMessageReady,true);
  assert.equal(r.data?.createEnabled,true);
  assert.equal(r.data?.nativeCancelEnabled,true);
});

test('disabled official-web adoption is not advertised and cannot link a reservation or notify LINE',async()=>{
  const health=await call(worker,env,{method:'GET',query:{action:'health'}});
  assert.equal(health.data?.officialWebHandoffEnabled,false);
  assert.ok(!health.data?.apiActions?.includes('adoptOfficialWebReception'));

  const outboundBefore=world.calls.length;
  const r=await call(worker,env,{body:{
    action:'adoptOfficialWebReception',requestId:'req-disabled-adoption-0001',
    handoffRequestId:'req-disabled-handoff-0001',operationalDate:DAY,
    waitTypeId:'0029',receiptNo:'12',liffAccessToken:world.issueLiffToken('Uadopt'),
  }});
  assert.equal(r.status,400,JSON.stringify(r.data));
  assert.equal(r.data?.error,'UNKNOWN_ACTION');
  assert.equal(world.calls.length,outboundBefore,'unsupported adoption must not call LINE or AirWAIT');
  assert.equal(db.rows('SELECT * FROM v2_user_day_claims').length,0);
  assert.equal(db.rows('SELECT * FROM v2_service_messages').length,0);
});

test('all read APIs required by the new HOME resolve through Production Worker',async()=>{
  const waitTypes=await call(worker,env,{method:'GET',query:{action:'waitTypes'}});
  assert.equal(waitTypes.status,200,JSON.stringify(waitTypes.data));
  assert.equal(waitTypes.data?.ok,true);
  assert.ok(waitTypes.data.waitTypes.some(x=>x.waitTypeId==='0029'));

  const day=await call(worker,env,{method:'GET',query:{action:'businessDay',date:DAY}});
  assert.equal(day.status,200,JSON.stringify(day.data));
  assert.equal(day.data?.businessType,'土日祝日');

  const crowd=await call(worker,env,{method:'GET',query:{action:'crowdRemaining'}});
  assert.equal(crowd.status,200,JSON.stringify(crowd.data));
  assert.equal(crowd.data?.ok,true);
  assert.ok(Array.isArray(crowd.data?.slots));
  assert.ok(crowd.data.slots.some(x=>x.waitTypeId==='0030'&&Number.isInteger(x.remaining)));

  const board=await call(worker,env,{method:'GET',query:{action:'boardStatus'}});
  assert.equal(board.status,200,JSON.stringify(board.data));
  assert.equal(board.data?.ok,true);
  assert.equal(board.data?.businessType,'土日祝日');
  assert.deepEqual(board.data?.slots?.map(x=>x.key),['10:00','12:30','15:00']);

  const ctx=makeCtx();
  await worker.scheduled({},env,ctx);
  await ctx.drain();
  const vote=await call(worker,env,{method:'GET',query:{action:'surpriseVotePublicStatus'}});
  assert.equal(vote.status,200,JSON.stringify(vote.data));
  assert.equal(vote.data?.ok,true);
});

test('legacy compatibility reads are sanitized server-side and never expose AirWAIT credentials',async()=>{
  world.setNextNumber('0029',12);
  const created=await call(worker,env,{body:{
    action:'createReservation',requestId:'req-legacy-proxy-0001',mode:'web',adults:1,paidChildren:0,infants:0,
    waitTypeId:'0029',operationalDate:DAY,liffAccessToken:world.issueLiffToken('Ulegacy'),
  }});
  assert.equal(created.data?.ok,true,JSON.stringify(created.data));

  const reservations=await call(worker,env,{method:'GET',query:{action:'legacyReservations',start:'1',limit:'100'}});
  assert.equal(reservations.status,200,JSON.stringify(reservations.data));
  assert.equal(reservations.data?.ok,true);
  assert.ok(Array.isArray(reservations.data?.rows));
  assert.equal(reservations.data.rows[0]?.number,'12');
  assert.deepEqual(Object.keys(reservations.data.rows[0]).sort(),['isCalling','number','status','waitTypeId','waitTypeName'].sort());

  const last=await call(worker,env,{method:'GET',query:{action:'legacyLastUpdate'}});
  assert.equal(last.status,200,JSON.stringify(last.data));
  assert.equal(last.data?.ok,true);
  assert.ok(Object.hasOwn(last.data,'lastUpdDate'));

  const wait=await call(worker,env,{method:'GET',query:{action:'legacyWaitInfo'}});
  assert.equal(wait.status,200,JSON.stringify(wait.data));
  assert.equal(wait.data?.ok,true);
  assert.ok(Array.isArray(wait.data?.store?.waitDetails));
  if(wait.data.store.waitDetails.length){
    assert.deepEqual(Object.keys(wait.data.store.waitDetails[0]).sort(),['detailedWaitType','remainingNum','waitingCount','waitTypeId','waitTypeName'].sort());
  }

  const serialized=JSON.stringify({reservations:reservations.data,last:last.data,wait:wait.data});
  assert.doesNotMatch(serialized,/AIRWAIT_API_KEY|corWclpKeyCd|apiKey|shortUrl|reserveId/i);
  assert.doesNotMatch(serialized,/test-airwait-key/);
});

test('legacy compatibility reads require official GitHub Pages origin and collapse duplicate upstream reads',async()=>{
  mock.timers.tick(5000); // expire any cache warmed by the previous test
  const deniedBefore=world.calls.length;
  for(const action of ['legacyReservations','legacyLastUpdate','legacyWaitInfo']){
    const denied=await call(worker,env,{method:'GET',query:{action},origin:'https://evil.example'});
    assert.equal(denied.status,403,`${action}: ${JSON.stringify(denied.data)}`);
    assert.equal(denied.data?.error,'ORIGIN_NOT_ALLOWED');
  }
  assert.equal(world.calls.length,deniedBefore,'denied origin must not reach AirWAIT');

  const countCalls=needle=>world.calls.filter(x=>x.includes(needle)).length;
  const beforeReservations=countCalls('/stateless/reservations');
  const a=await call(worker,env,{method:'GET',query:{action:'legacyReservations',start:'1',limit:'100'}});
  const b=await call(worker,env,{method:'GET',query:{action:'legacyReservations',start:'1',limit:'100'}});
  assert.equal(a.status,200);assert.equal(b.status,200);
  assert.equal(countCalls('/stateless/reservations')-beforeReservations,1,'duplicate reservation reads should share a 4s cache');
  assert.equal(b.data?.cached,true);

  const beforeWaitInfo=countCalls('/getWaitInfo');
  const w1=await call(worker,env,{method:'GET',query:{action:'legacyWaitInfo'}});
  const w2=await call(worker,env,{method:'GET',query:{action:'legacyWaitInfo'}});
  assert.equal(w1.status,200);assert.equal(w2.status,200);
  assert.equal(countCalls('/getWaitInfo')-beforeWaitInfo,1,'duplicate waitInfo reads should share a 4s cache');
  assert.equal(w2.data?.cached,true);
});

test('legacy compatibility reads fail closed when the Worker AirWAIT secret is absent',async()=>{
  const locked={...env,AIRWAIT_API_KEY:''};
  for(const action of ['legacyReservations','legacyLastUpdate','legacyWaitInfo']){
    const r=await call(worker,locked,{method:'GET',query:{action}});
    assert.equal(r.status,503,`${action}: ${JSON.stringify(r.data)}`);
    assert.equal(r.data?.ok,false);
    assert.equal(r.data?.error,'AIRWAIT_KEY_NOT_CONFIGURED');
  }
});

test('diagnostic/service status remains secret-gated in Production',async()=>{
  for(const action of ['createDiagnostics','concurrencyAudit','serviceMessageStatus']){
    const denied=await call(worker,env,{method:'GET',query:{action}});
    assert.ok([401,403,404].includes(denied.status),`${action}:${denied.status}`);
    const allowed=await call(worker,env,{method:'GET',query:{action},headers:{'X-ASOBooN-Diagnostics':DIAG_TOKEN}});
    assert.notEqual(allowed.status,401,`${action} should accept the diagnostics secret`);
    assert.notEqual(allowed.status,404,`${action} should exist in Production`);
  }
});

test('unknown actions fail closed rather than falling through',async()=>{
  const get=await call(worker,env,{method:'GET',query:{action:'definitelyUnknown'}});
  assert.equal(get.status,404);
  assert.equal(get.data?.error,'UNKNOWN_ACTION');
  const post=await call(worker,env,{body:{action:'definitelyUnknown'}});
  assert.equal(post.status,400);
  assert.equal(post.data?.error,'UNKNOWN_ACTION');
});
