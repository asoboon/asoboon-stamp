import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync('miniapp-v2/production/home-v38.js','utf8');
const css=readFileSync('miniapp-v2/production/home-v38.css','utf8');

test('Onsite pool is derived only from explicitly named AirWAIT store labels, not online IDs or clock guesswork',()=>{
 for(const exact of ['すぐ入場受付【平日】','10時15分から【平日特定日】','13時45分から【平日特定日】','10時25分頃入場【土休日特定日】','12時50分頃入場【土休日特定日】','15時15分頃入場時間【土休日特定日】'])assert.ok(home.includes(exact),exact);
 assert.match(home,/matched\.length!==1/);
 assert.match(home,/reserveUnit!=='PERSON'/);
 assert.match(home,/safePeople\(matched\[0\]\.remaining\)/);
 assert.match(home,/n===0&&matched\[0\]\.remainingVerified!==true\?null:n/);
 assert.match(home,/slot\.matchMode!=='exact-name'/);
});
test('Reuse only existing API observedDetails, cache safely and never make an extra gateway call',()=>{
 assert.match(home,/Array\.isArray\(data\.observedDetails\)/);
 assert.match(home,/writeCrowdCache\(crowdSlots,crowdDetails,crowdStale\)/);
 assert.match(home,/crowdDetails=Array\.isArray\(cached\.details\)/);
 assert.doesNotMatch(home,/crowdMetric|CROWD_BASE|LEVELS:|v38-crowd-track/);
 assert.doesNotMatch(home,/fetchOnsite|action=onsiteRemaining/);
 assert.match(home,/function scheduleCrowd\(\)/);
 assert.match(home,/CROWD_STALE_MS=90000/);
});
test('Two clear, responsive channels independently navigate to AirWAIT WEB and LINE reception',()=>{
 for(const word of ['WEB受付','LINE受付','確認中','混雑予想は予約枠の残り人数から算出した参考値で、実際の館内滞在人数とは異なります。','data-v7-view="reception"'])assert.ok(home.includes(word),word);
 assert.match(css,/v38-crowd-channels\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(home,/const webUrl=airwaitWebReceptionUrl\(\)/);
 assert.match(home,/href="\$\{esc\(webUrl\)\}" target="_blank" rel="noopener noreferrer" data-external="1"/);
 assert.match(home,/data-v7-view="reception" data-v7-slot/);
 assert.match(home,/WEBで受付する/);
 assert.match(home,/LINEで受付する/);
 assert.doesNotMatch(home,/<button class="v38-crowd-card/);
 assert.match(css,/\.v38-crowd-channel:is\(a,button\)/);
 assert.doesNotMatch(home,/希望の時間を確認して、カードをタップすると/);
 assert.doesNotMatch(home,/<h2>\$\{T\.today\}<\/h2>/);
});

test('HOME states verified remaining people clearly and labels the section as reception availability',()=>{
 for(const phrase of ['受付の空き状況','残り人数','value===null?\'確認中\''])assert.ok(home.includes(phrase),phrase);
 assert.match(home,/\$\{value\}<small>人<\/small>/);
 assert.match(home,/WEB受付とLINE受付の残り人数/);
 assert.match(home,/混雑予想は予約枠の残り人数から算出した参考値で、実際の館内滞在人数とは異なります。/);
 assert.doesNotMatch(home,/本日の混雑状況/);
 assert.match(home,/slot\.reserveUnit!=='PERSON'/);
 assert.match(home,/slot\.evidence!=='PERSON'/);
 assert.match(home,/slot\.matchMode!=='exact-name'/);
});


test('Cold HOME starts one safe read in parallel with business-day lookup and reuses it',()=>{
 assert.match(home,/if\(!day&&!force\)prefetchCrowd\(\);try\{const previousDate=/);
 assert.match(home,/const date=D\.operationalDate\?\.\(\),hour=nowJst\(\)\.minutes/);
 assert.match(home,/const job=fetch\(url,\{cache:'no-store',signal:ctrl\.signal\}\)/);
 assert.match(home,/early\?\.date===day\?\.operationalDate&&Date\.now\(\)-early\.at<90000/);
 assert.match(home,/if\(!manual&&early/);
 assert.match(home,/const cached=readCrowdCache\(\);if\(cached\?\.verifiedFresh/);
 assert.match(home,/result\.response;data=result\.data/);
 assert.match(home,/受付枠を確認しています/);
});

test('HOME callstatus CTA supports verified states in seven locales without changing its destination',()=>{
 const source=readFileSync('miniapp-v2/production/boon-home-v56-layout.js','utf8');
 for(const lang of ['ja','en','ko','vi','ne','kmr']){
  assert.ok(source.includes(lang+':{calling:'),'missing status-specific CTA label '+lang);
 }
 assert.ok(source.includes('zh-CN')&&source.includes('查看排队号码'),'missing zh-CN calling label');
 assert.ok(source.includes('const callLabel=(callActionLabels[language()]'));
 assert.ok(source.includes("hero.querySelector('.v38-call-cta-copy strong')"));
 assert.ok(source.includes('if(callCTA)set(callCTA,callLabel)'));
});
