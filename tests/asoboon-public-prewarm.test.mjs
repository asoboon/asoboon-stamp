import {test,before,beforeEach,mock} from 'node:test';
import assert from 'node:assert/strict';
import {FakeD1,FakeWorld,prepareRuntime,baseEnv,call,makeCtx} from './helpers/production-worker-harness.mjs';

const SAT_MORNING=Date.parse('2026-10-03T00:35:00Z'); // Saturday 09:35 JST
let worker,db,world,env;

before(()=>{
  mock.timers.enable({apis:['Date'],now:SAT_MORNING});
});
beforeEach(async()=>{
  mock.timers.setTime(SAT_MORNING);
  db=new FakeD1();world=new FakeWorld();
  globalThis.fetch=(input,init)=>world.fetch(input,init);
  worker=(await import(prepareRuntime())).default;
  env=baseEnv(db);
});

const crowdCalls=()=>world.calls.filter(x=>x.includes('/store/getWaitInfo')).length;
const calendarCalls=()=>world.calls.filter(x=>x.includes('script.google.com')).length;
const snap=key=>db.rows('SELECT value,updated_at FROM v2_system_state WHERE key=?',key)[0];
async function cron(){
  const ctx=makeCtx();
  await worker.scheduled({},env,ctx);
  await ctx.drain();
}

test('Existing production behavior is unchanged while prewarm flag is disabled',async()=>{
  const health=await call(worker,env,{method:'GET',query:{action:'health'}});
  assert.equal(health.data.publicReadPrewarmEnabled,false);
  await cron();
  assert.equal(crowdCalls(),0);
  assert.equal(snap('crowd_remaining_snapshot_v1'),undefined);
  assert.equal(snap('business_day:2026-10-03'),undefined);
});

test('A single cron fetch populates D1, then 100 guests read without another AirWAIT fetch',async()=>{
  env.PUBLIC_READ_PREWARM_ENABLED='1';
  const health=await call(worker,env,{method:'GET',query:{action:'health'}});
  assert.equal(health.data.publicReadPrewarmEnabled,true);
  await cron();
  assert.equal(crowdCalls(),1,'cron, not the first guest, calls AirWAIT');
  assert.ok(calendarCalls()>=1,'cron warms the service-day calendar; surprise vote cron also queries GAS');
  const saved=snap('crowd_remaining_snapshot_v1');
  assert.ok(saved, 'crowd snapshot persisted in D1');
  assert.ok(snap('business_day:2026-10-03'), 'calendar persisted in D1');
  const stored=JSON.parse(saved.value);
  assert.equal(stored.ok,true);
  assert.equal(stored.slots.length,7);

  const requests=Array.from({length:100},(_,i)=>call(worker,env,{method:'GET',query:{action:'crowdRemaining'},headers:{'X-Request-Test':String(i)}}));
  const results=await Promise.all(requests);
  assert.ok(results.every(x=>x.status===200&&x.data?.ok===true&&!x.data?.stale));
  assert.equal(crowdCalls(),1,'100 readers must not independently hit AirWAIT');
  assert.ok(results.every(x=>x.data?.cacheSource==='d1-verified-fast'),'readers received the snapshot');
  // A 60s cron has a normal 15-25s scheduling window beyond the old 45s
  // suppress cutoff; guests must still avoid extra origin reads at +70s.
  mock.timers.tick(70000);
  const nextGuests=await Promise.all(Array.from({length:100},()=>call(worker,env,{
    method:'GET',query:{action:'crowdRemaining'}
  })));
  assert.ok(nextGuests.every(x=>x.status===200&&x.data?.ok===true));
  assert.equal(crowdCalls(),1,'guests cannot create a 45-65s refresh burst between cron ticks');
});

test('Scheduled prefetch skips venue crowd data when business calendar says closed',async()=>{
  env.PUBLIC_READ_PREWARM_ENABLED='1';
  world.businessType='休館';
  await cron();
  assert.equal(crowdCalls(),0);
  assert.ok(snap('business_day:2026-10-03'));
});

test('Scheduled prefetch skips outside operating time, even when enabled',async()=>{
  env.PUBLIC_READ_PREWARM_ENABLED='1';
  mock.timers.setTime(Date.parse('2026-10-03T11:00:00Z')); // 20:00 JST
  await cron();
  assert.equal(crowdCalls(),0);
});

test('Guest reads remain read-only and no reservation is created by warming',async()=>{
  env.PUBLIC_READ_PREWARM_ENABLED='1';
  await cron();
  assert.equal(world.reservations.length,0);
  assert.equal(world.sent.length,0);
  const details=world.calls.filter(x=>x.includes('/reserve/create'));
  assert.equal(details.length,0);
});
