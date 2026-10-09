import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('HOME displays timer before business-day calendar, leaving event calendar separate',()=>{
 const code=read('miniapp-v2/production/home-v38.js');
 const timer=code.indexOf('<section class="v38-quick-tools"');
 const business=code.indexOf('<section class="v38-calendar-section v38-business-calendar-section"');
 const event=code.indexOf('<section class="v38-calendar-section"><h2>イベントカレンダー');
 assert(timer>0);
 assert(business>timer);
 assert(event>business);
 assert.match(code,/data-timeguide-title>アソブーンタイマー/);
 assert.match(code,/setText\(title,'アソブーンタイマー'\)/);
 assert.match(code,/setText\(eyebrow,'アソブーンタイマー'\);setText\(title,end\+'まで遊べる'\)/);
});
test('Production route and shared navigation call the feature アソブーンタイマー',()=>{
 for(const path of ['miniapp-v2/shared/timeguide.js','miniapp-v2/shared/config-common.js','miniapp-v2/production/app-stable-v36.js','miniapp-v2/production/production-routes.js']){
  assert.match(read(path),/アソブーンタイマー/,path);
 }
 assert.doesNotMatch(read('miniapp-v2/shared/timeguide.js'),/<h2>何時まであそべる？<\/h2>/);
});

test('admitted guests receive the renamed timer shortcut too',()=>{
 const home=read('miniapp-v2/production/home-v38.js');
 assert.match(home,/action\('timeguide','アソブーンタイマー'\)/);
 assert.doesNotMatch(home,/action\('timeguide','何時まで遊べる'\)/);
});
