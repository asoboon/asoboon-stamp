import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('miniapp-v2/production/boon-home-v613-board.js');
const css=read('miniapp-v2/production/boon-home-v613-board.css');
const loader=read('miniapp-v2/production/production-shell-loader.js');

test('HOME forecast uses verified WEB+LINE remaining, 320 baseline, and no unverified capacity assumptions',()=>{
 assert.match(js,/Math\.round\(\(320-web-line\)\/320\*100\)/);
 assert.match(js,/channel\?\.querySelector\('strong'\)\?\.getAttribute\('data-v613-n'\)/);
 assert.match(js,/if\(web===null\|\|line===null\|\|web\+line>320\)return null/);
 assert.match(js,/Math\.min\(100,pct\)/);
 assert.match(js,/method:'remaining-proxy'/);
 assert.match(read('miniapp-v2/production/home-v38.js'),/data-v613-n/);
 assert.doesNotMatch(js,/s\.bookedPeopleVerified/);
});
test('remaining count proxy reflects two verified numbers and fails closed for unknown or over 320',()=>{
 const fn=js.slice(js.indexOf('function trustedBooked(card){'),js.indexOf('\nfunction cloneAction('));
 const estimate=vm.runInNewContext(fn+';trustedBooked');
 const card=(web,line)=>({querySelector(selector){const value=selector.includes('--web')?web:line;return {querySelector:q=>q==='strong'?{textContent:'Left '+value+' people',getAttribute:key=>key==='data-v613-n'&&value!==null?String(value):null}:null}}});
 assert.equal(estimate(card(80,80)),50);
 assert.equal(estimate(card(0,0)),100);
 assert.equal(estimate(card(90,30)),63); // Language-neutral even when visible text is translated.
 assert.equal(estimate(card(175,23)),38);
 assert.equal(estimate(card(300,20)),0);
 assert.equal(estimate(card(null,20)),null);
 assert.equal(estimate(card(20,null)),null);
 assert.equal(estimate(card(320,20)),null);
 assert.equal(estimate(card(-3,20)),null);
});
test('Native actions remain delegated and no new mutating network calls are introduced',()=>{
 assert.match(js,/native\.cloneNode\(true\)/);
 assert.doesNotMatch(js,/\bfetch\(/);
 assert.doesNotMatch(js,/\bXMLHttpRequest\b/);
 assert.doesNotMatch(js,/\bPOST\b/);
});
test('Availability board is open and readable without a tap',()=>{
 assert.match(js,/if\(fold&&!fold\.open\)fold\.open=true/);
 assert.match(css,/\.v59-slots-fold>summary[\s\S]{0,180}display:none!important/);
 assert.match(css,/\.v613-header/);
 assert.match(css,/min-height:44px/);
 assert.match(loader,/boon-home-v613-board\.js/);
 assert.match(loader,/boon-home-v613-board\.css/);
});
test('Prior contrast, day-card and fallback issues have targeted corrections',()=>{
 assert.match(css,/#v38Today>span:nth-child\(n\+2\)/);
 assert.match(css,/#v38Hero \.v38-reception-hours>div>span/);
 assert.match(css,/color:#28594d!important/);
 assert.match(js,/pct===null\?'—':pct\+'%'/);
});

test('v7 preserves visible next-step instructions for saved, calling, hold, and error states',()=>{
 assert.match(css,/\.v58-flow:not\(\[data-state="open"\]\):not\(\[data-state="default"\]\)/);
 assert.match(css,/\.v58-primary \.v58-intro\{[\s\S]*?display:block!important/);
 assert.match(css,/\.v58-primary \.v58-next-summary\{[\s\S]*?font-size:14px!important/);
});

test('Japanese business labels survive English and Chinese round trips and native updates',()=>{
 const match=js.match(/function translateBusiness\(\)\{[\s\S]*?\n\}\nfunction trustedBooked/);
 assert.ok(match,'translateBusiness must be extractable for behavioral regression');
 const fn=match[0].replace(/\nfunction trustedBooked$/,'');
 const day={textContent:'平日特定日',dataset:{}};
 const duration={textContent:'3時間制',dataset:{}};
 const host={querySelector:s=>s==='span:nth-child(2) strong'?day:s==='span:nth-child(3) strong'?duration:null};
 let lang='ja';
 const context={
  document:{querySelector:s=>s==='#v38Today'?host:null},
  language:()=>lang,
  days:{
   en:['Sat/Sun/holiday','Special weekday','Weekday','Monday','2h 30m limit','3h limit','No time limit'],
   'zh-CN':['周末及节假日','特别平日','平日','周一','限时2小时30分钟','限时3小时','不限时']
  },
  copyTo:(node,value)=>{node.textContent=value;}
 };
 const translate=vm.runInNewContext(fn+';translateBusiness',context);
 translate();
 lang='en';translate();
 assert.equal(day.textContent,'Special weekday');
 assert.equal(duration.textContent,'3h limit');
 lang='ja';translate();
 assert.equal(day.textContent,'平日特定日');
 assert.equal(duration.textContent,'3時間制');
 lang='zh-CN';translate();
 assert.equal(day.textContent,'特别平日');
 lang='ja';translate();
 assert.equal(day.textContent,'平日特定日');
 assert.equal(duration.textContent,'3時間制');
 // Fresh native data must still update the preserved source.
 day.textContent='土日祝';duration.textContent='2時間30分制';
 lang='en';translate();
 assert.equal(day.textContent,'Sat/Sun/holiday');
 assert.equal(duration.textContent,'2h 30m limit');
 lang='ja';translate();
 assert.equal(day.textContent,'土日祝');
 assert.equal(duration.textContent,'2時間30分制');
});
