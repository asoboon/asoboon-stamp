import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('official customer HOME is rolled back to the legacy HOME during review preparation',()=>{
  const s=read('home.html');
  assert.match(s,/ASOBooN 冒険基地ナビ/);
  assert.match(s,/\.\/home-core\.html/);
  assert.match(s,/airwait\.jp\/WCSP\/storeDetail\?storeNo=AKR2298124918/);
  assert.doesNotMatch(s,/\.\/miniapp-v2\/production\//);
});

test('legacy rollback copy remains available',()=>{
  const s=read('home-legacy-20261004.html');
  assert.match(s,/\.\/home-core\.html/);
  assert.match(s,/ASOBooN 冒険基地ナビ/);
  assert.match(s,/airwait\.jp\/WCSP\/storeDetail\?storeNo=AKR2298124918/);
});

test('Production candidate stays isolated and reception creation remains hard locked',()=>{
  const env=read('miniapp-v2/production/env.js');
  const gateway=read('miniapp-v2/backend/production-gateway.js');
  assert.match(env,/environment:'production'/);
  assert.match(env,/backendUrl:''/);
  assert.match(env,/receptionCreate:false/);
  assert.match(gateway,/PRODUCTION_CREATE_ARMED:\s*false/);
});

test('Production candidate is not referenced by the official customer entry point',()=>{
  const home=read('home.html');
  assert.doesNotMatch(home,/miniapp-v2\/production/);
});

test('Production surprise vote stays fail-closed while Developing is prepared for review',()=>{
  const vote=read('miniapp-v2/production/surprise-vote-config.js');
  assert.match(vote,/API_URL:\s*""/);
});
