import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
