import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=s('miniapp-v2/production/home-v38.js');
test('unverified or missing waitTypes flags fail closed for each channel',()=>{
 assert.match(home,/webHidden=flags\?\.get\(id\)!==true/);
 assert.match(home,/onsiteHidden=flags\?\.get\(onsiteId\)!==true/);
 assert.match(home,/crowdPublicFlags=Array\.isArray\(types\)\?/);
 assert.doesNotMatch(home,/new Map\(\[\.\.\.\(crowdPublicFlags/);
});
test('visibility flags reset before each remote fetch',()=>{
 assert.match(home,/crowdLoading=true;crowdError='';crowdClosed=false;[\s\S]*?crowdPublicFlags=null;/);
});
test('viewports allow browser zoom',()=>{
 for(const p of ['home.html','miniapp-v2/production/event-calendar.html']){
  assert.doesNotMatch(s(p),/maximum-scale=1/);
 }
});
test('bottom navigation labels are legible at 12px',()=>{
 assert.match(s('miniapp-v2/production/choco-mint-nav-v8.css'),/font-size:12px/);
});
