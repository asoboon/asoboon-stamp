import test from 'node:test';
import assert from 'node:assert/strict';
import {createReceptionBootstrap} from '../experiments/reception-v3/bootstrap.mjs';

const defer=()=>{
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no});
  return{promise,resolve,reject};
};
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve()};
const ready={
  identity:{liffReady:true,inClient:true,loggedIn:true},
  businessDay:{ok:true,operationalDate:'2026-10-19',isClosed:false,stale:false},
  waitTypes:{ok:true,waitTypes:[{waitTypeId:'0024'}]},
  gateway:{ok:true,createEnabled:true,createRequiresVerifiedLiff:true},
};
const createFixture=()=>{
  const d=Object.fromEntries(Object.keys(ready).map(k=>[k,defer()]));
  const calls=[],snapshots=[];
  let date='2026-10-19';
  const init={operationalDate:()=>date,onSnapshot:s=>snapshots.push(s)};
  for(const k of Object.keys(ready))init[
    {identity:'getIdentity',businessDay:'getBusinessDay',waitTypes:'getWaitTypes',gateway:'getGateway'}[k]
  ]=()=>{calls.push(k);return d[k].promise};
  return{controller:createReceptionBootstrap(init),d,calls,snapshots,setDate:value=>{date=value}};
};

test('each verification lane starts concurrently and partial results never enable commit',async()=>{
  const f=createFixture();
  const initial=f.controller.begin();
  assert.equal(initial.verificationComplete,false);
  assert.deepEqual(Object.values(initial.lanes),['pending','pending','pending','pending']);
  await tick();
  assert.deepEqual(f.calls,['identity','businessDay','waitTypes','gateway']);
  for(const k of ['businessDay','waitTypes','gateway'])f.d[k].resolve(ready[k]);
  await tick();
  assert.equal(f.controller.snapshot().verificationComplete,false);
  assert.equal(f.controller.snapshot().lanes.identity,'pending');
  f.d.identity.resolve(ready.identity);
  await tick();
  assert.equal(f.controller.snapshot().verificationComplete,true);
});

test('authorization denied or API error fails closed; it never invents readiness',async()=>{
  for(const failure of ['identity','businessDay','waitTypes','gateway']){
    const f=createFixture();
    f.controller.begin();
    await tick();
    for(const k of Object.keys(ready)){
      if(k===failure)f.d[k].reject(Error('internal mock secret that must not be exposed'));
      else f.d[k].resolve(ready[k]);
    }
    await tick();
    const snapshot=f.controller.snapshot();
    assert.equal(snapshot.verificationComplete,false);
    assert.equal(snapshot.lanes[failure],'failed');
    assert.doesNotMatch(JSON.stringify(snapshot),/secret/);
  }
});

test('late replies from a previous visit cannot unlock the new reception view',async()=>{
  const a=Object.fromEntries(Object.keys(ready).map(k=>[k,defer()]));
  const b=Object.fromEntries(Object.keys(ready).map(k=>[k,defer()]));
  const runs={identity:0,businessDay:0,waitTypes:0,gateway:0};
  const config={operationalDate:()=> '2026-10-19'};
  for(const k of Object.keys(ready))config[
    {identity:'getIdentity',businessDay:'getBusinessDay',waitTypes:'getWaitTypes',gateway:'getGateway'}[k]
  ]=()=>++runs[k]===1?a[k].promise:b[k].promise;
  const controller=createReceptionBootstrap(config);
  controller.begin();await tick();
  controller.begin();await tick();
  for(const k of Object.keys(ready))a[k].resolve(ready[k]);
  await tick();
  assert.equal(controller.snapshot().verificationComplete,false);
  assert.deepEqual(Object.values(controller.snapshot().lanes),['pending','pending','pending','pending']);
  for(const k of Object.keys(ready))b[k].resolve(ready[k]);
  await tick();
  assert.equal(controller.snapshot().verificationComplete,true);
});

test('operational date changing at the 19:00 boundary makes old read data unverified',async()=>{
  const f=createFixture();
  f.controller.begin();await tick();
  for(const k of Object.keys(ready))f.d[k].resolve(ready[k]);
  await tick();
  assert.equal(f.controller.snapshot().verificationComplete,true);
  f.setDate('2026-10-20');
  assert.equal(f.controller.snapshot().dateMatches,false);
  assert.equal(f.controller.snapshot().verificationComplete,false);
});

test('closed, stale, or mismatched business days always prevent verification',async()=>{
  for(const day of [
    {...ready.businessDay,isClosed:true},
    {...ready.businessDay,stale:true},
    {...ready.businessDay,operationalDate:'2026-10-18'},
  ]){
    const f=createFixture();
    f.controller.begin();await tick();
    for(const k of Object.keys(ready))f.d[k].resolve(k==='businessDay'?day:ready[k]);
    await tick();
    assert.equal(f.controller.snapshot().verificationComplete,false);
    assert.equal(f.controller.snapshot().lanes.businessDay,'failed');
  }
});
