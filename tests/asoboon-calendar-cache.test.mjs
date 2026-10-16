import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {FakeD1,FakeWorld,prepareRuntime,baseEnv,call} from './helpers/production-worker-harness.mjs';
const NOW=Date.parse('2026-10-16T04:33:00Z');
async function setup(){
 mock.timers.enable({apis:['Date'],now:NOW});
 const db=new FakeD1(),world=new FakeWorld(),edge=new Map();
 globalThis.fetch=(input,init)=>world.fetch(input,init);
 globalThis.caches={default:{async match(req){return edge.get(req.url)?.clone()},async put(req,res){edge.set(req.url,res.clone())}}};
 const worker=(await import(prepareRuntime())).default,env=baseEnv(db);
 const request=(from='2026-10-16')=>call(worker,env,{method:'GET',query:{action:'businessDays',month:from.slice(0,7),from},headers:{'CF-Connecting-IP':'198.51.100.50'}});
 return{worker,env,world,db,edge,request};
}
test('300 facility-IP guests and different from-dates share one month, then changes become visible after five minutes',async()=>{
 const x=await setup();
 try{
  const initial=await Promise.all(Array.from({length:30},()=>x.request()));
  assert.ok(initial.every(r=>r.status===200));assert.equal(initial[0].data.days.length,16);
  const upstream=x.world.calls.filter(v=>v.includes('script.google.com')).length;
  assert.equal(upstream,16,'one bounded canonical month, no duplicate per-date work');
  for(let i=0;i<270;i++)assert.equal((await x.request()).status,200);
  const subset=await x.request('2026-10-20');assert.equal(subset.data.days.length,12);
  assert.equal(x.world.calls.filter(v=>v.includes('script.google.com')).length,upstream);
  x.world.businessType='休館';mock.timers.setTime(NOW+299999);
  const cached=await x.request();assert.equal(cached.data.days[0].businessType,'土日祝日');assert.equal(cached.data.days[0].cachedAt,NOW);
  mock.timers.setTime(NOW+300001);
  const changed=await x.request();assert.equal(changed.data.days[0].businessType,'休館');assert.equal(changed.data.days[0].cachedAt,NOW+300001);
  assert.equal(x.world.calls.filter(v=>v.includes('script.google.com')).length,32);
  assert.equal(x.world.sent.length,0);assert.equal(x.world.reservations.length,0);
 }finally{mock.timers.reset()}
});
test('cold isolate reuses D1; degraded month retains source time, shares retry backoff, expires and recovers',async()=>{
 const x=await setup();
 try{
  await x.request();x.edge.clear();const upstream=x.world.calls.length;
  const other=(await import(prepareRuntime())).default;
  const r=await call(other,x.env,{method:'GET',query:{action:'businessDays',month:'2026-10',from:'2026-10-16'}});
  assert.equal(r.status,200);assert.equal(x.world.calls.length,upstream);
  mock.timers.setTime(NOW+300001);for(let d=1;d<=31;d++)x.world.businessDayFailures.add(`2026-10-${String(d).padStart(2,'0')}`);
  const stale=await x.request();assert.equal(stale.data.days[0].stale,true);assert.equal(stale.data.days[0].cachedAt,NOW);
  const attempts=x.world.calls.length;await x.request();assert.equal(x.world.calls.length,attempts);
  mock.timers.setTime(NOW+330002);x.world.businessDayFailures.clear();x.world.businessType='平日特定日';
  const recovered=await x.request();assert.equal(recovered.data.days[0].businessType,'平日特定日');assert.notEqual(recovered.data.days[0].stale,true);
 }finally{mock.timers.reset()}
});
test('uncached batch requests remain IP limited; invalid month/date never escapes validation',async()=>{
 const x=await setup();
 try{
  for(let i=0;i<12;i++){x.edge.clear();assert.equal((await x.request()).status,200)}
  x.edge.clear();assert.equal((await x.request()).status,429);
  for(const from of ['2026-09-16','2026-12-01','2026-10-32'])assert.equal((await x.request(from)).status,400);
 }finally{mock.timers.reset()}
});
test('unprovided or mismatched future dates are unknown, never inferred schedules',async()=>{
 const x=await setup();
 try{
  globalThis.fetch=async input=>{
   const date=new URL(input).searchParams.get('date');
   return new Response(JSON.stringify({ok:true,businessType:'平日',...(date==='2026-11-05'?{operationalDate:'2026-11-04'}:{})}));
  };
  const r=await x.request('2026-11-01');assert.equal(r.status,200);assert.equal(r.data.days.length,0);assert.equal(r.data.failedDates.length,30);assert.equal(r.data.complete,false);
 }finally{mock.timers.reset()}
});
test('backend never assigns onsite alias/time-key PERSON counts to WEB slots',async()=>{
 const x=await setup();
 try{
  const fallback=globalThis.fetch;
  globalThis.fetch=async(input,init)=>{
   if(new URL(input.url||input).pathname.endsWith('/wait/type/get'))return new Response(JSON.stringify({success:true,resultCode:{code:'0000'},innerDto:{waitTypeList:[
    {waitTypeId:'0024',waitTypeName:'10時ご入場枠【WEB平日】',usageDispType:'KeyONLINE_RECEPTION_ONLY',dispFlg:true},
    {waitTypeId:'0027',waitTypeName:'14時ご入場枠【WEB平日】',usageDispType:'KeyONLINE_RECEPTION_ONLY',dispFlg:true}
   ]}}));
   return fallback(input,init);
  };
  x.world.crowdWaitDetails=[{detailedWaitType:'すぐ入場受付【平日】',reserveUnit:'PERSON',remainingNum:264},{detailedWaitType:'14時から【平日】',reserveUnit:'PERSON',remainingNum:50}];
  const r=await call(x.worker,x.env,{method:'GET',query:{action:'crowdRemaining'}});
  assert.equal(r.status,200);assert.equal(r.data.slots.length,2);
  for(const row of r.data.slots){assert.equal(row.remaining,null);assert.equal(row.evidence,'UNVERIFIED_WEB_SOURCE')}
  assert.deepEqual(r.data.observedDetails.map(x=>x.remaining),[264,50]);
 }finally{mock.timers.reset()}
});
