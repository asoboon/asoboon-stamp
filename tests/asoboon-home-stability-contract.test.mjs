/* User-approved HOME UX invariants frozen on 2026-11-15 (PR #214). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const board=read('miniapp-v2/production/boon-home-v613-board.js');
const home=read('miniapp-v2/production/home-v38.js');
const routes=read('miniapp-v2/production/production-routes.js');
const gateway=read('miniapp-v2/backend/production-gateway.js');
const shell=read('home.html');
const css=read('miniapp-v2/production/boon-home-v613-board.css');
const browserTests=read('tests/asoboon-production-browser.spec.js');

test('weekend sessions retain verified WEB and onsite ID pairs',()=>{
 const block=board.match(/const PUBLIC_GROUPS=Object\.freeze\(\[([\s\S]*?)\]\);/);
 assert.ok(block,'The public ID list must remain explicit and auditable');
 const sessions=[...block[1].matchAll(/\{title:'(\d\d:\d\dの回)',web:'(\d{4})',line:'(\d{4})'\}/g)]
 .map(([,title,web,line])=>({title,web,line}));
 assert.deepEqual(sessions,[
  {title:'10:00の回',web:'0030',line:'0029'},
  {title:'12:30の回',web:'0032',line:'0031'},
  {title:'15:00の回',web:'0034',line:'0033'}
 ]);
 for(const time of ['10時25分頃入場','12時50分頃入場','15時15分頃入場'])assert.ok(board.includes(time),time);
});

test('each session forecasts against 320 and rejects null, over-quota and unforecastable rows',()=>{
 const m=board.match(/\bconst pct=([^;]+);/);
 assert.ok(m,'per-session forecast must be present');
 const percentage=new Function('group','web','line','return '+m[1]);
 for(const [web,line,expected] of [[0,30,91],[17,50,79],[0,0,100],[320,0,0],[null,30,null],[17,null,null],[180,160,null]]){
  assert.equal(percentage({forecast:true},web,line),expected);
 }
 assert.equal(percentage({forecast:false},30,40),null);
 assert.match(board,/v615-forecast-value/);
 assert.doesNotMatch(board,/id=['"]v615EssentialCrowd['"]/);
});

test('unpublished, stale and unverified onsite AirWAIT numbers never become trusted',()=>{
 for(const invariant of [
  'snap?.verifiedFresh!==true','snap.operationalDate!==today','age>90000',
  'flags.get(id)!==true','hits.length!==1',"reserveUnit!=='PERSON'",
  'hits[0].remainingVerified===true','slot?.remainingVerified===true',
  'data?.verified!==true'
 ])assert.ok(board.includes(invariant),'AirWAIT safety gate missing: '+invariant);
 assert.match(browserTests,/HOME forecast never invents onsite counts from unverified getWaitInfo details/);
});

test('HOME preserves compact WEB/LINE panels and removes duplicate WEB and crowd footers',()=>{
 for(const invariant of [
  'v616BookingChannels','v615SessionBoard',"'WEB受付'","'LINE受付'",
  "'7:00〜'","'9:30〜'","'LINE・現地受付'"
 ])assert.ok(board.includes(invariant),'HOME landmark missing: '+invariant);
 assert.doesNotMatch(home,/WEB受付を確認/);
 assert.match(css,/#v38Slots:has\(/);
 assert.match(browserTests,/HOME hides removed AirWAIT sessions and unpublished channels/);
 assert.match(browserTests,/HOME preserves the external AirWAIT fallback if verified sessions have no actionable WEB link/);
});

test('LINE booking-screen preview retains verified, time and closing conditions',()=>{
 for(const invariant of [
  "panel.dataset.v7View='reception'","cell.dataset.v7View='reception'",
  "if(key==='line'&&previewEnabled)",
  "if(previewEnabled&&slot?.usageDispType==='KeySTORE_RECEPTION_ONLY')",
  'jstMinutes()>=420','publicData?.verified===true',
  'previewTomorrow','ended|closed|tomorrow|error|loading'
 ])assert.ok(board.includes(invariant),'Preview guard missing: '+invariant);
 for(const name of [
  'HOME LINE header opens reservation preview at 09:15 but does not permit early ticket creation',
  'HOME onsite session cell itself navigates to reception after LINE opening',
  'HOME LINE header supports keyboard navigation and preserves read-only before 9:30'
 ])assert.ok(browserTests.includes(name),'Required browser E2E missing: '+name);
});

test('LINE ticket creation is blocked before 9:30 both in browser and server',()=>{
 assert.match(routes,/if\(!lineReceptionOpenNow\(\)&&!hasTest\)/);
 assert.match(routes,/const ready=openNow&&peopleOK&&S\.slot/);
 assert.match(routes,/submit\.disabled=!ready/);
 assert.match(routes,/if\(!lineReceptionOpenNow\(\)&&!PRODUCTION_TEST_DISABLED\)/);
 assert.match(routes,/function scheduleLineOpen\(\)/);
 assert.match(gateway,/WEB_OPEN_MIN:\s*9\s*\*\s*60\s*\+\s*30/);
 assert.match(gateway,/ONSITE_OPEN_MIN:\s*9\s*\*\s*60\s*\+\s*30/);
 assert.match(gateway,/if\s*\(min\s*<\s*open\)\s*throw\s+apiError/);
});

test('HOME structural selectors and viewport contracts stay stable without freezing colors',()=>{
 assert.match(shell,/production-shell-loader\.js/);
 assert.match(css,/#v615SessionBoard/);
 assert.match(css,/#v616BookingChannels/);
 assert.match(browserTests,/320,390,430/);
 // Intentional: no palette assertions. Themes and colors are allowed to change.
});

test('duplicate another reception CTA is absent, terminal status and HOME booking still work',()=>{
 assert.doesNotMatch(home,/もう一度受付する/);
 assert.doesNotMatch(routes,/id="csRebook"|もう一度受付する/);
 assert.doesNotMatch(read('miniapp-v2/shared/callstatus.js'),/id="csRebook"|もう一度受付する/);
 assert.match(home,/前の受付は終了しています/);
 assert.match(home,/受付が取り消されました/);
 assert.match(board,/panel\.dataset\.v7View='reception'/);
 assert.match(browserTests,/HOME LINE header opens reservation preview/);
});
