import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const reception=readFileSync('miniapp-v2/shared/reception.js','utf8');
const rules=readFileSync('miniapp-v2/shared/app-rules.js','utf8');
const homepage=readFileSync('miniapp-v2/production/home-v38.js','utf8');
const bundle=readFileSync('miniapp-v2/production/production-app.js','utf8');
const routes=readFileSync('miniapp-v2/production/production-routes.js','utf8');

function between(text,a,b){
  const start=text.indexOf(a),end=text.indexOf(b,start+a.length);
  assert.ok(start>=0&&end>start, 'Expected source boundaries: '+a);
  return text.slice(start,end);
}

test('Live Friday 14:00 on-site slot 0025 is selectable by the LINE app',()=>{
  assert.match(rules,/waitTypeId:'0025',label:'14:00から'/);
  const src=between(reception,'function usageAllowed(', 'function nowJstTime(');
  const ctx={
    S:{day:{businessType:'平日'},mode:'web'},
    DEVELOP_TEST_ONLY:false,
    developTestRule:()=>null,
    R:{slotsFor:()=>[
      {waitTypeId:'0023',label:'すぐ入場'},
      {waitTypeId:'0025',label:'14:00から'}
    ]}
  };
  const result=runInNewContext(src+'\nbuildSlots([{waitTypeId:"0023",dispFlg:true,usageDispType:"KeySTORE_RECEPTION_ONLY"},{waitTypeId:"0025",dispFlg:true,usageDispType:"KeySTORE_RECEPTION_ONLY"}])',ctx);
  assert.deepEqual(Array.from(result,s=>s.waitTypeId),['0023','0025']);
  const hidden=runInNewContext('buildSlots([{waitTypeId:"0023",dispFlg:true,usageDispType:"KeySTORE_RECEPTION_ONLY"},{waitTypeId:"0025",dispFlg:false,usageDispType:"KeySTORE_RECEPTION_ONLY"}])',ctx);
  assert.deepEqual(Array.from(hidden,s=>s.waitTypeId),['0023']);
});

test('LINE 14:00 remaining reads only the exact verified AirWAIT on-site pool',()=>{
  const src=between(reception,'const LINE_REMAINING_NAMES=','\nlet LINE_OPEN_TIMER=');
  const fn=between(reception,'function readLineRemaining(', '\nfunction updateRemainingInfo(');
  const ctx={
    S:{day:{businessType:'平日'}},
    remainingDetails:[
      {detailedWaitType:'すぐ入場受付【平日】',reserveUnit:'PERSON',remaining:253,remainingVerified:true},
      {detailedWaitType:'14時から【平日】',reserveUnit:'PERSON',remaining:50,remainingVerified:true},
      {detailedWaitType:'14時ご入場枠【WEB平日】',reserveUnit:'PERSON',remaining:999,remainingVerified:true}
    ]
  };
  const js='const LINE_REMAINING_NAMES='+src.split('=')[1]+'\n'+fn;
  assert.equal(runInNewContext(js+'\nreadLineRemaining("0025")',ctx),50);
  assert.equal(runInNewContext('readLineRemaining("0023")',ctx),253);
  ctx.remainingDetails=[{detailedWaitType:'14時ご入場枠【WEB平日】',reserveUnit:'PERSON',remaining:70,remainingVerified:true}];
  assert.equal(runInNewContext('readLineRemaining("0025")',ctx),null,'never substitute WEB count for LINE');
  ctx.remainingDetails=[{detailedWaitType:'14時から【平日】',reserveUnit:'PERSON',remaining:0,remainingVerified:false}];
  assert.equal(runInNewContext('readLineRemaining("0025")',ctx),null,'unverified zero remains unknown');
});

test('Home crowd cards show without redundant tapping instructions and production bundle is rebuilt',()=>{
  for(const code of [homepage,bundle,routes])assert.doesNotMatch(code,/希望の時間を確認して、カードをタップすると/);
  assert.match(homepage,/v38-crowd-list/);
  assert.match(routes,/LINE_REMAINING_NAMES/);
  assert.match(routes,/'0025':'14時から【平日】'/);
});
