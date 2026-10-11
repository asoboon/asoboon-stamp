import {test,before,mock} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FakeD1,FakeWorld,prepareRuntime,baseEnv,call} from './helpers/production-worker-harness.mjs';

const DAY='2026-10-03',NOW=Date.parse('2026-10-03T03:00:00Z');
let worker,db,world,env;
before(async()=>{
 mock.timers.enable({apis:['Date'],now:NOW});
 db=new FakeD1();
 world=new FakeWorld();
 globalThis.fetch=(input,init)=>world.fetch(input,init);
 worker=(await import(prepareRuntime())).default;
 db.clear();
 world.reset();
 env=baseEnv(db);
});

test('2510 case: combine AirWAIT WEB and LINE reception within 15:00 slot, preserving global reception order',async()=>{
 const push=(type,num,status)=>world.reservations.push({
  number:String(num),waitTypeId:type,waitTypeName:type==='0033'?'15時15分頃入場時間【土休日特定日】':'15時ご入場枠【WEB整理券】',
  status:String(status),isCalling:'0',reserveId:'test-'+type+'-'+num
 });
 // Fake numbers reproduce the actual cross-pool shape: 51 WEB + 12 LINE.
 // The LINE-only calculation would report 4 ahead; the correct combined
 // queue has 49 still waiting ahead (from both types).
 for(let n=0;n<45;n++)push('0034',1501+n,'0');
 for(let n=0;n<4;n++)push('0033',2501+n,'0');
 for(let n=0;n<4;n++)push('0034',1546+n,'2');
 for(let n=0;n<5;n++)push('0033',2505+n,'2');
 world.setNextNumber('0033',2510);
 const created=await call(worker,env,{body:{
  action:'createReservation',requestId:'req-combined-callqueue-2510-1',
  mode:'web',adults:1,paidChildren:0,infants:0,waitTypeId:'0033',
  operationalDate:DAY,liffAccessToken:world.issueLiffToken('Ucombined2510')
 }});
 assert.equal(created.data?.ok,true,JSON.stringify(created.data));
 assert.equal(created.data?.receiptNo,'2510');
 // Four guests obtained tickets later; none are ahead of #2510.
 for(let n=0;n<2;n++)push('0034',1550+n,'0');
 for(let n=0;n<2;n++)push('0033',2511+n,'0');
 const session=await call(worker,env,{body:{
  action:'recoverReservationSession',businessDate:DAY,liffAccessToken:world.issueLiffToken('Ucombined2510')
 }});
 assert.equal(session.data?.found,true,JSON.stringify(session.data));
 const response=await call(worker,env,{body:{
  action:'reservationStatus',sessionToken:session.data.sessionToken
 }});
 assert.equal(response.status,200,JSON.stringify(response.data));
 const result=response.data;
 assert.equal(result.found,true);
 assert.equal(result.receiptNo,'2510');
 assert.equal(result.waitTypeId,'0033');
 assert.equal(result.state,'waiting');
 assert.equal(result.aheadCount,49,'4 LINE ahead plus 45 WEB ahead, not 4 alone');
 assert.equal(result.queueRank,59,'preserve 9 completed before #2510 without counting them as waiting');
 assert.equal(result.activeCount,63);
 assert.equal(result.queueScope,'combined-web-line');
 assert.deepEqual(result.queueSources,['WEB受付','LINE受付']);
 assert.equal(world.sent.length,1,'a status lookup must not send any extra LINE messages');
 // The real booking is still in its authenticated LINE wait type.
 const own=world.reservations.find(x=>x.reserveId===created.data.reserveId);
 assert.equal(own.waitTypeId,'0033');
 assert.equal(own.status,'0');
 assert.equal(world.reservations.length,63);

 // If the cross-channel board API becomes unavailable after an update, the
 // owner-bound receipt/state must survive, but the old LINE-only 4 must NOT
 // return as an apparent global count or produce a time prediction.
 mock.timers.tick(10_000);
 const originalFetch=world.fetch.bind(world);
 globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input.url||String(input));
  if(url.pathname.endsWith('/store/getLastUpdDateStateless'))
    return new Response(JSON.stringify({success:true,resultCode:{code:'0000'},innerDto:{lastUpdDate:'2026-10-03T12:00:10+09:00'}}),{
      status:200,headers:{'Content-Type':'application/json'}
    });
  if(url.pathname.endsWith('/stateless/reservations')){
    const form=new URLSearchParams(String(init?.body||''));
    if(!form.get('waitTypeId'))return new Response(JSON.stringify({success:false,resultCode:{code:'9999'}}),{
      status:503,headers:{'Content-Type':'application/json'}
    });
  }
  return originalFetch(input,init);
 };
 try{
  const failed=await call(worker,env,{body:{
    action:'reservationStatus',sessionToken:session.data.sessionToken
  }});
  assert.equal(failed.status,200,JSON.stringify(failed.data));
  assert.equal(failed.data?.found,true);
  assert.equal(failed.data?.state,'waiting');
  assert.equal(failed.data?.receiptNo,'2510');
  assert.equal(failed.data?.queueScope,'unverified');
  assert.equal(failed.data?.aheadCount,null);
  assert.equal(failed.data?.queueRank,null);
  assert.equal(failed.data?.activeCount,null);
 }finally{
  globalThis.fetch=(input,init)=>world.fetch(input,init);
 }
});

test('missing queue data must never be converted to zero or presented as an ETA',()=>{
 const workerSource=readFileSync('miniapp-v2/backend/production-worker.mjs','utf8');
 const callJS=readFileSync('miniapp-v2/shared/callstatus.js','utf8');
 const homeJS=readFileSync('miniapp-v2/production/home-status-v13.js','utf8');
 const homeMarkup=readFileSync('miniapp-v2/production/home-v38.js','utf8');
 for(const s of [callJS,homeJS]){
  assert.match(s,/Number\.isSafeInteger\(d\.aheadCount\)/);
  assert.doesNotMatch(s,/const ahead=Number\(d\.aheadCount\)/);
 }
 assert.match(homeMarkup,/Number.isSafeInteger\(data\.ahead\)/);
 assert.match(workerSource,/queueScope:'unverified'/);
 assert.match(workerSource,/aheadCount:null/);
 assert.match(workerSource,/board\.stale===true/);
 assert.match(workerSource,/String\(self\.status\|\|''\)!==String\(body\.status\|\|''\)/);
 assert.match(workerSource,/String\(r\.status\|\|''\)!=='3'/);
});
