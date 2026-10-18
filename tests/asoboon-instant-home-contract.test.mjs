import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(x,'utf8');
test('Official ROOT preloads main assets only after QR handoff has had priority',()=>{
 const html=read('home.html'),shell=read('miniapp-v2/production/production-shell-loader.js');
 assert.ok(html.indexOf('asoquest-deeplink.js')<html.indexOf("link.rel='preload'"));
 assert.match(html,/window\.ASOBOON_PRODUCTION_SHELL&&!window\.ASOBOON_ASOQUEST_HANDOFF/);
 assert.match(html,/production-app\.js\?v=[0-9a-f]{12}/);
 assert.match(html,/production-app\.css\?v=[0-9a-f]{12}/);
 assert.match(shell,/window\.ASOBOON_LIFF_SDK_READY=new Promise/);
 assert.match(shell,/sdk\.async=true/);
 assert.doesNotMatch(shell,/const scripts=\['https:\/\/static\.line-scdn\.net/);
});
test('Official ROOT initializes LIFF after async SDK load without startup profile API',()=>{
 const source=read('miniapp-v2/production/app-stable-v36.js');
 assert.match(source,/window\.ASOBOON_LIFF_SDK_READY/);
 assert.doesNotMatch(source,/await liff\.getProfile\(\)/);
 assert.match(source,/liff\.init\(\{liffId:E\.liffId\}\)/);
 assert.match(source,/window\.dispatchEvent\(new CustomEvent\('asoboon:v2-liff-ready'/);
});
test('Business-day display no longer waits for crowd API',()=>{
 const source=read('miniapp-v2/production/home-v38.js');
 assert.match(source,/restoreFreshCrowdForDay\(\);void fetchCrowd\(force\)/);
 assert.doesNotMatch(source,/await fetchCrowd\(force\)/);
});
