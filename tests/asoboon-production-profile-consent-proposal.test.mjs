import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileConsentController} from '../experiments/reception-v3/profile-consent.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
function setup({initial='prompt',request=()=>Promise.resolve(),query}={}){
 let permission=initial,queryCount=0,requestCount=0;
 const liff={permission:{
  query:async scope=>{assert.equal(scope,'profile');queryCount++;return query?await query(scope):{state:permission}},
  requestAll:()=>{requestCount++;return request()},
 },getAccessToken:()=>{throw Error('do not read token during consent')}};
 const events=[];const ctl=createProfileConsentController({liff,onChange:info=>events.push(info)});
 return{ctl,events,counts:()=>({queryCount,requestCount}),set:value=>permission=value};
}
test('already granted: no popup needed',async()=>{
 const f=setup({initial:'granted'});assert.equal((await f.ctl.check()).phase,'granted');
 assert.equal(await f.ctl.requestFromTap(),false);assert.equal(f.counts().requestCount,0);
});
test('native permission request on explicit tap, then recheck',async()=>{
 let f;f=setup({request:async()=>f.set('granted')});
 assert.equal((await f.ctl.check()).phase,'prompt');assert.equal(f.counts().requestCount,0);
 assert.equal(await f.ctl.requestFromTap(),true);
 assert.equal(f.counts().requestCount,1);
 assert.equal(f.ctl.snapshot().phase,'granted');
 assert.equal(f.events.some(e=>e.phase==='requesting'),true);
});
test('declined permission never issues a booking or auto-retries',async()=>{
 const f=setup({initial:'prompt',request:async()=>{throw Error('user declined')}});
 await f.ctl.check();assert.equal(await f.ctl.requestFromTap(),false);
 assert.equal(f.ctl.snapshot().phase,'prompt');assert.equal(f.counts().requestCount,1);
});
test('channel has no profile scope: unavailable, no popup',async()=>{
 const f=setup({initial:'unavailable'});await f.ctl.check();
 assert.equal(f.ctl.snapshot().phase,'unavailable');
 assert.equal(await f.ctl.requestFromTap(),false);assert.equal(f.counts().requestCount,0);
});
test('missing SDK permission APIs do not falsely grant profile scope',async()=>{
 const ctl=createProfileConsentController({liff:{permission:{}}});await ctl.check();
 assert.equal(ctl.snapshot().phase,'unsupported');assert.equal(await ctl.requestFromTap(),false);
});
test('rapid repeated taps open only one native dialog',async()=>{
 const hold=deferred();const f=setup({request:()=>hold.promise});
 await f.ctl.check();const a=f.ctl.requestFromTap();const b=f.ctl.requestFromTap();
 assert.equal(await b,false);assert.equal(f.counts().requestCount,1);
 f.set('granted');hold.resolve();assert.equal(await a,true);
});
test('leaving the screen invalidates a late check result',async()=>{
 const hold=deferred();const f=setup({query:()=>hold.promise});
 const job=f.ctl.check();f.ctl.invalidate();hold.resolve({state:'granted'});
 await job;assert.equal(f.ctl.snapshot().phase,'unknown');
});
test('requestAll resolving without permission is not approval',async()=>{
 const f=setup();await f.ctl.check();
 assert.equal(await f.ctl.requestFromTap(),false);assert.equal(f.ctl.snapshot().phase,'prompt');
});
