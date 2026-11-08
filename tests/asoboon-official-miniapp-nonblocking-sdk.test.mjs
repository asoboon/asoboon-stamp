import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(x,'utf8');
const html=read('miniapp-v2/production/index.html');
const builder=read('miniapp-v2/build-production.mjs');
test('Official certified HOME starts without waiting for the LINE SDK network dependency',()=>{
 for(const source of [html,builder]){
  assert.doesNotMatch(source,/<script\s+defer\s+src="https:\/\/static\.line-scdn\.net\/liff\/edge\/2\/sdk\.js"/);
  assert.match(source,/window\.ASOBOON_LIFF_SDK_READY=new Promise\(resolve=>\{/);
  assert.match(source,/sdk\.async=true/);
  assert.match(source,/sdk\.onload=\(\)=>resolve\(true\)/);
  assert.match(source,/sdk\.onerror=\(\)=>resolve\(false\)/);
  assert.match(source,/script defer src="\.\/env\.js/);
  assert.match(source,/script defer src="\.\/production-app\.js/);
 }
});
test('Official HOME retains auth wait, read-only gateway, and service flow unchanged',()=>{
 assert.match(html,/rel="preconnect" href="https:\/\/asoboon-miniapp-v2-production-gateway\.asoboon425\.workers\.dev" crossorigin/);
 const app=read('miniapp-v2/production/production-app.js');
 assert.match(app,/window\.ASOBOON_LIFF_SDK_READY/);
 assert.match(app,/new Promise\(resolve=>\{watchdog=setTimeout\(\(\)=>resolve\('pending'\),6000\)\}\)/);
 assert.match(app,/liff\.init\(\{liffId:E\.liffId\}\)/);
 assert.match(html,/boon-home-v613-board\.js/);
});
