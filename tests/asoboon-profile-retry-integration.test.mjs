import {test,before,beforeEach,mock} from 'node:test';
import assert from 'node:assert/strict';
import {FakeD1,FakeWorld,prepareRuntime,baseEnv,call} from './helpers/production-worker-harness.mjs';
let worker,db,world,env,failed,attempts,statusCode,failOnAttempts;
before(async()=>{
 mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-03T03:00:00Z')});
 db=new FakeD1();world=new FakeWorld();
 globalThis.fetch=async(input,init)=>{
  const url=String(typeof input==='string'?input:input.url);
  if(url==='https://api.line.me/v2/profile'){
   attempts++;
   if(failOnAttempts.has(attempts))return new Response(JSON.stringify({message:'gateway lookup failed'}),{status:statusCode,headers:{'Content-Type':'application/json'}});
   if(failed-->0)return new Response(JSON.stringify({message:'temporary error'}),{status:statusCode,headers:{'Content-Type':'application/json'}});
  }
  return world.fetch(input,init);
 };
 worker=(await import(prepareRuntime())).default;
});
beforeEach(()=>{
 mock.timers.setTime(Date.parse('2026-10-03T03:00:00Z'));
 db.clear();world.reset();env=baseEnv(db);failed=0;attempts=0;statusCode=503;failOnAttempts=new Set();
});
async function attempt(){
 return call(worker,env,{body:{
  action:'createReservation',requestId:'req-auth-profile-0011',
  mode:'web',adults:1,paidChildren:1,infants:0,
  waitTypeId:'0029',operationalDate:'2026-10-03',
  liffAccessToken:world.issueLiffToken('Utest')
 }});
}
test('Transient LINE profile outage retries once and creates one reservation',async()=>{
 failed=1;
 const r=await attempt();
 assert.equal(r.data.ok,true,JSON.stringify(r.data));
 assert.equal(world.reservations.length,1);
 assert.ok(attempts>=3);
});
test('Persistent LINE profile outage fails closed without booking',async()=>{
 failed=2;
 const r=await attempt();
 assert.equal(r.status,503,JSON.stringify(r.data));
 assert.equal(r.data.error,'LINE_PROFILE_TEMPORARILY_UNAVAILABLE');
 assert.equal(world.reservations.length,0);
 assert.equal(attempts,2);
});
test('Invalid profile permission fails without retrying or booking',async()=>{
 failed=1;statusCode=403;
 const r=await attempt();
 assert.equal(r.status,401,JSON.stringify(r.data));
 assert.equal(r.data.error,'LINE_PROFILE_REAUTHORIZE');
 assert.equal(attempts,1);
 assert.equal(world.reservations.length,0);
});

test('Transient failure on second Gateway profile lookup also retries and creates once',async()=>{
 failOnAttempts=new Set([2]);
 const r=await attempt();
 assert.equal(r.data.ok,true,JSON.stringify(r.data));
 assert.equal(world.reservations.length,1);
 assert.equal(attempts,3);
});
test('Persistent failure on Gateway profile lookup does not create an AirWAIT ticket',async()=>{
 failOnAttempts=new Set([2,3]);
 const r=await attempt();
 assert.equal(r.data.ok,false,JSON.stringify(r.data));
 assert.equal(r.data.error,'LINE_PROFILE_TEMPORARILY_UNAVAILABLE');
 assert.equal(world.reservations.length,0);
 assert.equal(attempts,3);
});
