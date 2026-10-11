import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('miniapp-v2/shared/call-forecast.js','utf8');
function api(){
 const context={window:{},Intl,Date,Number,Math,Object,String};
 vm.runInNewContext(source,context);
 return context.window.ASOBOON_V2_CALL_FORECAST;
}
const clock=(date,time)=>new Date(date+'T'+time+':00+09:00').getTime();
function fixture({time='12:00',businessDate='2026-10-03',state='waiting',waitTypeId='0033',ahead=50,rank=51,total=100}={}){
 return {ok:true,found:true,state,waitTypeId,businessDate,
  aheadCount:ahead,queueRank:rank,activeCount:total,checkedAt:clock('2026-10-03',time)};
}
test('retired navigator pacing gives a reference clock after the slot start, not an exact promise',()=>{
 const f=api(),s=fixture({time:'15:05',ahead:20,rank:21});
 const d=f.predict(s,s.checkedAt);
 assert.equal(d.clock,'15:10');
 assert.equal(d.start,'15:00');
 assert.equal(d.prestart,false);
 assert.equal(d.method,'reference-queue-pace');
});
test('before a 15:00 round, time is based on its scheduled start and queue position',()=>{
 const f=api(),s=fixture({time:'12:00',ahead:50,rank:51});
 const d=f.predict(s,s.checkedAt);
 assert.equal(d.clock,'15:20');
 assert.equal(d.prestart,true);
});
test('near the front, say まもなく but only after the round starts',()=>{
 const f=api(),near=fixture({time:'15:05',ahead:2,rank:3});
 assert.equal(f.predict(near,near.checkedAt).soon,true);
 const early=fixture({time:'12:00',ahead:2,rank:3});
 assert.equal(f.predict(early,early.checkedAt).soon,false);
});
test('never estimate from canceled, already called, or ambiguous/old/unknown data',()=>{
 const f=api(),s=fixture(),now=s.checkedAt;
 for(const state of ['calling','hold','processing','done','canceled','closed'])assert.equal(f.predict({...s,state},now),null,state);
 assert.equal(f.predict({...s,found:false},now),null);
 assert.equal(f.predict({...s,aheadCount:null},now),null);
 assert.equal(f.predict({...s,queueRank:null},now),null);
 assert.equal(f.predict({...s,waitTypeId:'0023'},now),null);
 assert.equal(f.predict({...s,waitTypeId:'0030'},now),null); // WEB pool is not current LINE reception
 assert.equal(f.predict({...s,businessDate:'2026-10-02'},now),null);
 assert.equal(f.predict({...s,checkedAt:now-4*60*1000},now),null);
});
test('the official final entry cutoff disables misleading late forecasts',()=>{
 const f=api(),s=fixture({time:'12:02',waitTypeId:'0029'});
 assert.equal(f.predict(s,s.checkedAt),null);
 const close=fixture({time:'11:59',waitTypeId:'0029',ahead:150,rank:151,total:200});
 assert.equal(f.predict(close,close.checkedAt),null);
});
test('client confirmation relies on same-day local check and independent server validation, not duplicate date request',()=>{
 const client=readFileSync('miniapp-v2/shared/reception.js','utf8');
 const confirm=client.split('async function submit(){')[1].split('function setMode(')[0];
 assert.match(confirm,/D\.operationalDate\(\)/);
 assert.doesNotMatch(confirm,/D\.getCurrent\(/);
 assert.match(confirm,/post\('createReservation'/);
 const server=readFileSync('miniapp-v2/backend/production-gateway.js','utf8');
 assert.match(server,/if \(!requestedDate \|\| requestedDate !== serverDate\) throw apiError\('OPERATIONAL_DATE_MISMATCH'/);
 assert.match(server,/enforceReceptionHours\(day, mode, waitTypeId\)/);
});
