import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('official customer HOME boots only Production on its certified LIFF endpoint',()=>{
  const s=read('home.html');
  assert.match(s,/<title>ASOBooN｜公式LINEミニアプリ<\/title>/);
  assert.match(s,/asoquest-deeplink\.js/);
  assert.match(s,/production_preview/);
  assert.match(s,/const PRODUCTION_HOME_LIVE=true/);
  assert.match(s,/ASOBOON_PRODUCTION_SHELL=PRODUCTION_HOME_LIVE\|\|preview/);
  assert.match(s,/production-shell-loader\.js/);
  assert.match(s,/preview=direct\.get\('production_preview'\)==='1'\|\|state\.get\('production_preview'\)==='1'/);
  assert.doesNotMatch(s,/<iframe|\.\/home-core\.html|\.\/app\/core\/|setInterval\(/);
  assert.match(read('miniapp-v2/production/env-facility.js'),/airwait\.jp\/WCSP\/storeDetail\?storeNo=AKR2298124918/);
});

test('certified rollback snapshot preserves ASOQUEST bridge and legacy customer HOME',()=>{
  const s=read('home-legacy-certified-20261007.html');
  assert.match(s,/asoquest-deeplink\.js/);
  assert.match(s,/2009884613-ELc6kolf/);
  assert.match(s,/\.\/home-core\.html/);
  assert.match(s,/ASOBooN 冒険基地ナビ/);
  assert.match(s,/airwait\.jp\/WCSP\/storeDetail\?storeNo=AKR2298124918/);
});

test('both Production entries connect to the dedicated Worker and keep reception inside the MINI App',()=>{
  const gateway=read('miniapp-v2/backend/production-gateway.js');
  for(const file of ['miniapp-v2/production/env.js','miniapp-v2/production/env-facility.js']){
    const env=read(file);
    assert.match(env,/environment:'production'/);
    assert.match(env,/backendUrl:'https:\/\/asoboon-miniapp-v2-production-gateway\.asoboon425\.workers\.dev\/'/);
    assert.match(env,/receptionCreate:true/);
    assert.match(env,/serviceMessage:true/);
    assert.match(env,/operationalFallbacks:Object\.freeze\(\{\s*enabled:false/);
  }
  assert.match(gateway,/PRODUCTION_CREATE_ARMED:\s*true/);
});

test('Production surprise vote uses the live dedicated backend but never enables demo mode',()=>{
  const config=read('miniapp-v2/production/surprise-vote-config.js');
  const vote=read('miniapp-v2/production/surprise-vote.js');
  assert.match(config,/API_URL:\s*"https:\/\/script\.google\.com\/macros\/s\//);
  assert.match(config,/LIFF_ID:\s*"2009884613-ELc6kolf"/);
  assert.match(vote,/const DEMO = false/);
});

test('user-reachable legacy pages no longer initialize the retired Production LIFF',()=>{
  const files=['index.html','stamp.html','setumei.html','surprise-vote-config.js','surprise-vote.js','app/core/app-config.js'];
  for(const file of files){
    const s=read(file);
    assert.doesNotMatch(s,/2009888671|57TOefc3/,file);
  }
  assert.match(read('index.html'),/2009884613-ELc6kolf/);
  assert.match(read('stamp.html'),/2009884613-ELc6kolf/);
});
