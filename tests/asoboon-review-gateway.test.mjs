import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const source=fs.readFileSync('miniapp-v2/backend/review-gateway.js','utf8');
const mod=await import(pathToFileURL(process.cwd()+'/miniapp-v2/backend/review-gateway.js').href+'?t='+Date.now());
const T=mod.__reviewTest;

test('Review gateway is isolated and can never write AirWAIT',()=>{
  assert.equal(T.channelId,'2009884612');
  assert.equal(T.health({DB:{}}).environment,'official-review');
  assert.equal(T.health({DB:{}}).reviewSimulation,true);
  assert.equal(T.health({DB:{}}).reviewWritesAirwait,false);
  assert.equal(T.health({DB:{}}).createEnabled,true);
  assert.doesNotMatch(source,/AIRWAIT_API_KEY|reserve\/create|WCLP\/api\/20160600\/external\/stateless\/reserve/);
});

test('Review wait types are store-only and exclude Developing 0042',()=>{
  assert.deepEqual(T.waitTypes.map(x=>x.waitTypeId),['0029','0031','0033']);
  assert.ok(T.waitTypes.every(x=>x.usageDispType==='KeySTORE_RECEPTION_ONLY'));
  assert.doesNotMatch(source,/["']0042["']/);
});

test('Review people validation rejects coercion, decimals and unsafe values',()=>{
  for(const value of [-1,1.5,NaN,Infinity,'1.0','1e2',' 1','01','999999999999999999']){
    assert.throws(()=>T.strictInt(value,0,10));
  }
  assert.equal(T.strictInt('3',0,10),3);
});

test('Review business day and surprise vote are deterministic simulations',()=>{
  const day=T.reviewBusinessDay('2026-10-04');
  assert.equal(day.reviewSimulation,true);
  assert.equal(day.businessType,'土日祝日');
  const vote=T.reviewVoteStatus();
  assert.equal(vote.ok,true);
  assert.equal(vote.reviewSimulation,true);
  assert.equal(vote.mode,'voting');
  assert.ok(vote.event.options.length>=3);
});

test('Review frontend uses Review LIFF, Review storage and Review gateway',()=>{
  const env=fs.readFileSync('miniapp-v2/review/env.js','utf8');
  assert.match(env,/environment:'review'/);
  assert.match(env,/storageNamespace:'review'/);
  assert.match(env,/channelId:'2009884612'/);
  assert.match(env,/liffId:'2009884612-hhM4k4GP'/);
  assert.match(env,/asoboon-miniapp-v2-review-gateway/);
  assert.doesNotMatch(env,/2009884611|bDgDzGrN|develop-gateway/);
});

test('Review reception is testable any time and Review vote cannot write live GAS',()=>{
  const rules=fs.readFileSync('miniapp-v2/review/review-rules.js','utf8');
  const vote=fs.readFileSync('miniapp-v2/review/surprise-vote-config.js','utf8');
  const voteHome=fs.readFileSync('miniapp-v2/review/surprise-vote-home-v1.js','utf8');
  assert.match(rules,/lineReceptionOpen:'00:00'/);
  assert.match(vote,/API_URL:\s*""/);
  assert.match(voteHome,/surprise-vote\.html\?demo=1/);
});

test('Review hides optional games for the first certification scope',()=>{
  const home=fs.readFileSync('miniapp-v2/review/home-v38.js','utf8');
  assert.doesNotMatch(home,/class="v38-play"/);
  assert.match(home,/イベントカレンダー/);
  assert.match(home,/id="v38Surprise"/);
});

test('customer-facing legacy HOME is untouched by Review',()=>{
  const home=fs.readFileSync('home.html','utf8');
  assert.match(home,/ASOBooN 冒険基地ナビ/);
  assert.match(home,/\.\/home-core\.html/);
  assert.doesNotMatch(home,/miniapp-v2\/review/);
});
