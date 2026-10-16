import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const home=readFileSync('miniapp-v2/production/home-v38.js','utf8');
const bundle=readFileSync('miniapp-v2/production/production-app.js','utf8');

const extract=(start,end)=>{
 const i=home.indexOf(start),j=home.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,'source boundaries '+start);
 return home.slice(i,j);
};
const snippet=[
 extract('const ONSITE_CROWD_NAMES=', '\nconst COPY='),
 extract('const CROWD_SETTINGS=', '\nlet latest='),
 extract('function safePeople(', 'function remainingMarkup(')
].join('\n');

const expected=[{waitTypeId:'0024',waitTypeName:'10時ご入場枠【WEB平日】',slotKey:'10:00',reserveUnit:'PERSON',remaining:253,matchMode:'alias-name',evidence:'PERSON'}, {waitTypeId:'0027',waitTypeName:'14時ご入場枠【WEB平日】',slotKey:'14:00',reserveUnit:'PERSON',remaining:50,matchMode:'time-key',evidence:'PERSON'}];
const details=[{detailedWaitType:'すぐ入場受付【平日】',reserveUnit:'PERSON',remaining:253,remainingVerified:true}, {detailedWaitType:'14時から【平日】',reserveUnit:'PERSON',remaining:50,remainingVerified:true}];

test('Live weekday HOME renders both immediate and 14:00 slots from verified onsite names',()=>{
 const x=runInNewContext(snippet+'\nvalidCrowdSlots()',{
   day:{businessType:'平日'},crowdSlots:expected,crowdDetails:details,
   crowdStale:false,crowdAt:Date.now(),CROWD_STALE_MS:90000
 });
 assert.deepEqual(Array.from(x,s=>({id:s.id,time:s.time,web:s.web,onsite:s.onsite})),[
  {id:'0024',time:'10:00',web:null,onsite:253},
  {id:'0027',time:'14:00',web:null,onsite:50}
 ]);
});

test('14:00 onsite data is never misattributed to the online-only pool',()=>{
 const result=runInNewContext(snippet+'\nvalidCrowdSlots()',{
  day:{businessType:'平日'},crowdSlots:expected,crowdDetails:[details[0]],
  crowdStale:false,crowdAt:Date.now(),CROWD_STALE_MS:90000
 });
 assert.equal(result.length,1,'14:00 hidden when unverified and no matching onsite data');
 assert.equal(result[0].id,'0024');
});

test('HOME labels the 14:00 round by its time and keeps instructions removed in rebuilt bundle',()=>{
 for(const source of [home,bundle]){
  assert.match(source,/slot\.id==='0024'\?'すぐ入場':slot\.id==='0027'\?'14:00から'/);
  assert.match(source,/'0027':'14時から【平日】'/);
  assert.doesNotMatch(source,/希望の時間を確認して、カードをタップすると/);
 }
});
