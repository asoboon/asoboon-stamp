import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('official home.html redirects to Production MINI App v2 and preserves query/hash',()=>{
  const s=read('home.html');
  assert.match(s,/\.\/miniapp-v2\/production\//);
  assert.match(s,/target\.search = location\.search/);
  assert.match(s,/target\.hash = location\.hash/);
  assert.match(s,/location\.replace\(target\.href\)/);
  assert.doesNotMatch(s,/home-core\.html/);
});

test('legacy HOME is preserved for immediate rollback',()=>{
  const s=read('home-legacy-20261004.html');
  assert.match(s,/\.\/home-core\.html/);
  assert.match(s,/ASOBooN 冒険基地ナビ/);
  assert.match(s,/airwait\.jp\/WCSP\/storeDetail\?storeNo=AKR2298124918/);
});

test('official Production identity is live while create remains hard locked',()=>{
  const env=read('miniapp-v2/production/env.js');
  const gateway=read('miniapp-v2/backend/production-gateway.js');
  assert.match(env,/environmentLabel:'OFFICIAL'/);
  assert.match(env,/officialHome:true/);
  assert.match(env,/backendUrl:''/);
  assert.match(env,/receptionCreate:false/);
  assert.match(gateway,/PRODUCTION_CREATE_ARMED:\s*false/);
});

test('official HOME uses only explicit operational fallbacks during cutover',()=>{
  const env=read('miniapp-v2/production/env.js');
  const app=read('miniapp-v2/production/app-stable-v36.js');
  assert.match(env,/operationalFallbacks:Object\.freeze/);
  assert.match(env,/receptionUrl:'https:\/\/airwait\.jp\/WCSP\/storeDetail\?storeNo=AKR2298124918'/);
  assert.match(env,/callstatusUrl:'\.\.\/\.\.\/callstatus\.html'/);
  assert.match(app,/function operationalFallback\(view\)/);
  assert.match(app,/view==='reception'&&F\.receptionCreate!==true/);
  assert.match(app,/view==='callstatus'&&!E\.backendUrl/);
  assert.match(app,/location\.assign\(fallback\)/);
  assert.match(app,/location\.replace\(fallback\)/);
});

test('official HOME tells customers WEB reception is temporary fallback',()=>{
  const home=read('miniapp-v2/production/home-v38.js');
  assert.match(home,/RECEPTION_FALLBACK_ACTIVE/);
  assert.match(home,/当日WEB受付/);
  assert.match(home,/現在は従来のWEB受付をご利用ください。/);
  assert.match(home,/WEB受付を開く/);
});

test('surprise vote remains fail-closed during official HOME cutover',()=>{
  const vote=read('miniapp-v2/production/surprise-vote-config.js');
  assert.match(vote,/API_URL:\s*""/);
});

test('Production page is no longer labelled preview',()=>{
  const html=read('miniapp-v2/production/index.html');
  assert.match(html,/<title>ASOBooN｜公式LINEミニアプリ<\/title>/);
  assert.doesNotMatch(html,/Production Preview/);
  assert.match(html,/env\.js\?v=20261004-03/);
  assert.match(html,/app-stable-v36\.js\?v=20261004-03/);
  assert.match(html,/home-v38\.js\?v=20261004-03/);
});
