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
