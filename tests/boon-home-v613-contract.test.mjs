import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('miniapp-v2/production/boon-home-v613-board.js');
const css=read('miniapp-v2/production/boon-home-v613-board.css');
const loader=read('miniapp-v2/production/production-shell-loader.js');

test('HOME crowd forecast is 320-person baseline with strict verified PERSON evidence',()=>{
 assert.match(js,/Math\.round\(n\/320\*100\)/);
 assert.match(js,/s\.bookedPeopleVerified!==true/);
 assert.match(js,/s\.bookedPeopleUnit!=='PERSON'/);
 assert.match(js,/return null/);
 assert.match(js,/Math\.min\(100,pct\)/);
});
test('Native actions remain delegated and no new mutating network calls are introduced',()=>{
 assert.match(js,/native\.cloneNode\(true\)/);
 assert.doesNotMatch(js,/\bfetch\(/);
 assert.doesNotMatch(js,/\bXMLHttpRequest\b/);
 assert.doesNotMatch(js,/\bPOST\b/);
});
test('Availability board is open and readable without a tap',()=>{
 assert.match(js,/if\(fold&&!fold\.open\)fold\.open=true/);
 assert.match(css,/\.v59-slots-fold>summary\{display:none!important\}/);
 assert.match(css,/\.v613-header/);
 assert.match(css,/min-height:44px/);
 assert.match(loader,/boon-home-v613-board\.js/);
 assert.match(loader,/boon-home-v613-board\.css/);
});
test('Prior contrast, day-card and fallback issues have targeted corrections',()=>{
 assert.match(css,/#v38Today>span:nth-child\(n\+2\)/);
 assert.match(css,/#v38Hero \.v38-reception-hours \*/);
 assert.match(css,/color:#174B42!important/);
 assert.match(js,/pct===null\?'—':pct\+'%'/);
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
