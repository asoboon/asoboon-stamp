import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const home=readFileSync('miniapp-v2/production/home-v38.js','utf8');
const rules=readFileSync('miniapp-v2/shared/app-rules.js','utf8');
const business=readFileSync('miniapp-v2/shared/business-day.js','utf8');
const reception=readFileSync('miniapp-v2/shared/reception.js','utf8');
const snippet=(start,end)=>{
  const a=home.indexOf(start),b=home.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'missing source slice: '+start);
  return home.slice(a,b);
};
const crowdLogic=[
 snippet('const ONSITE_CROWD_NAMES=', '\nconst COPY='),
 snippet('const CROWD_SETTINGS=', '\nlet latest='),
 snippet('function safePeople(', 'function remainingMarkup('),
].join('\n');

// Synthetic regression snapshot reproducing the three split-pool shapes observed
// in AirWAIT before 2026-10-17. Not a prediction of tomorrow's real availability.
const webSlots=[
 ['0030','10:00',250,'10時ご入場枠【WEB整理券】'],
 ['0032','12:30',220,'12時半ご入場枠【WEB整理券】'],
 ['0034','15:00',190,'15時ご入場枠【WEB整理券】'],
].map(([id,time,n,name])=>({
 waitTypeId:id,slotKey:time,waitTypeName:name,detailedWaitType:name,
 remaining:n,reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name'
}));
const onsite=[
 ['10時25分頃入場【土休日特定日】',30],
 ['12時50分頃入場【土休日特定日】',30],
 ['15時15分頃入場時間【土休日特定日】',50],
].map(([name,n])=>({detailedWaitType:name,remaining:n,reserveUnit:'PERSON',remainingVerified:true}));

test('Weekend HOME keeps WEB and LINE pools independent across all three time slots',()=>{
 const result=runInNewContext(crowdLogic+'\nvalidCrowdSlots()',{
  day:{businessType:'土日祝日'},crowdSlots:webSlots,crowdDetails:onsite,
  crowdStale:false,crowdAt:Date.now(),CROWD_STALE_MS:90000
 });
 assert.deepEqual(Array.from(result,r=>[r.time,r.web,r.onsite]),[
  ['10:00',250,30],['12:30',220,30],['15:00',190,50]
 ]);
 assert.deepEqual(Array.from(result,r=>r.web+r.onsite),[280,250,240]);
});

test('Missing LINE observations are unavailable, never silently substituted with WEB numbers',()=>{
 const result=runInNewContext(crowdLogic+'\nvalidCrowdSlots()',{
  day:{businessType:'土日祝日'},crowdSlots:webSlots,
  crowdDetails:[onsite[0]],crowdStale:false,crowdAt:Date.now(),CROWD_STALE_MS:90000
 });
 assert.deepEqual(Array.from(result,r=>r.onsite),[30,null,null]);
 assert.deepEqual(Array.from(result,r=>r.web),[250,220,190]);
});

test('The 10/17 weekend service window is 09:30 LINE opening, 150 min play and 18:00 closing',()=>{
 for(const id of ['0029','0031','0033'])assert.ok(rules.includes("waitTypeId:'"+id+"'"));
 assert.match(rules,/lineReceptionOpen:'09:30'/);
 assert.match(business,/'土日祝日':Object\.freeze\(\{businessType:'土日祝日',isClosed:false,durationMinutes:150,durationLabel:'2時間30分',closingTime:'18:00'/);
 assert.match(reception,/actual\.dispFlg===false\|\|!usageAllowed\(actual\)/);
});

test('HOME never fabricates a percentage from a 350-person capacity',()=>{
 assert.doesNotMatch(home,/crowdMetric|CROWD_BASE|aria-valuenow|WEB枠の混雑目安/);
 assert.match(home,/人数は各受付枠の残りです。館内の滞在人数や混雑率ではありません。/);
});
