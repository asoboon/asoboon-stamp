import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('official customer HOME remains the legacy HOME during review preparation',()=>{
  const s=read('home.html');
  assert.match(s,/ASOBooN 冒険基地ナビ/);
  assert.match(s,/\.\/home-core\.html/);
  assert.doesNotMatch(s,/\.\/miniapp-v2\/production\//);
});

test('Developing review candidate keeps all core functions inside MINI App v2',()=>{
  const env=read('miniapp-v2/develop/env.js');
  const app=read('miniapp-v2/develop/app-stable-v36.js');
  const home=read('miniapp-v2/develop/home-v38.js');
  const worker=read('miniapp-v2/backend/develop-worker.mjs');
  assert.match(env,/backendUrl:'https:\/\/asoboon-miniapp-v2-develop-gateway\.asoboon425\.workers\.dev\/'/);
  assert.match(env,/receptionCreate:true/);
  assert.match(env,/callstatus:true/);
  assert.match(app,/if\(view==='reception'\)return receptionPage\(\)/);
  assert.match(app,/if\(view==='callstatus'\)return callstatusPage\(\)/);
  assert.match(home,/action\('reception'/);
  assert.match(home,/id="v38Surprise"/);
  assert.match(home,/crowdRemaining/);
  assert.match(worker,/action === 'crowdRemaining'/);
  assert.match(worker,/action === 'surpriseVotePublicStatus'/);
  assert.match(worker,/postAction === 'createReservation'/);
});

test('Developing play content exposes BOON BLOCK v23 without changing Review scope',()=>{
  const develop=read('miniapp-v2/develop/home-v38.js');
  const review=read('miniapp-v2/review/home-v38.js');
  const index=read('miniapp-v2/develop/index.html');
  assert.match(develop,/BOON BLOCK/);
  assert.match(develop,/https:\/\/asoboon\.github\.io\/asoboon-3d\/boon-block-next\/\?v=23/);
  assert.match(develop,/BOON BLOCK','ブロックを動かしてジャングル攻略'[^\n]*'is-new'/);
  assert.doesNotMatch(review,/boon-block-next|BOON BLOCK/);
  assert.match(index,/home-v38\.js\?v=20261005-01/);
});

test('active review copy uses 09:25 LINE reception and no legacy 7:00/weekday-onsite wording',()=>{
  const first=read('miniapp-v2/develop/first-v27.js');
  const info=read('miniapp-v2/develop/pages-final-v33.js');
  const app=read('miniapp-v2/develop/app-stable-v36.js');
  const joined=[first,info,app].join('\n');
  assert.match(first,/9:25からLINEミニアプリ内で受付/);
  assert.match(info,/LINE当日受付[\s\S]*9:25〜/);
  assert.match(app,/LINEミニアプリ内で当日受付/);
  assert.doesNotMatch(joined,/\b7:00(?:〜|から)/);
  assert.doesNotMatch(joined,/通常平日は現地/);
  assert.doesNotMatch(joined,/WEB受付・現地受付/);
});

test('first visit and re-entry headers have explicit readable contrast',()=>{
  const first=read('miniapp-v2/develop/first-v27.css');
  const entry=read('miniapp-v2/develop/entry-v25.css');
  assert.match(first,/\.v27-first-page \.pv7-head h1\{color:#fff\}/);
  assert.match(first,/\.v27-first-page \.pv7-head p\{color:#eef8f1\}/);
  assert.match(entry,/\.v25-entry-head h1\{color:#fff\}/);
  assert.match(entry,/\.v25-entry-head p\{color:#edf2f4\}/);
});

test('access colors are general-road blue and highway green',()=>{
  const s=read('miniapp-v2/develop/parking-v24.css');
  assert.match(s,/\.v24-section\.highway\{border-top:5px solid #2f7d4a\}/);
  assert.match(s,/\.v24-section:not\(\.highway\)\{border-top:5px solid #3689cd\}/);
  assert.match(s,/\.v24-section-head>span[^}]*background:#eaf3fa;color:#2f78b7/);
  assert.match(s,/\.v24-section\.highway \.v24-section-head>span\{background:#e9f4ec;color:#2f7d4a\}/);
});

test('review candidate asset cache points to the updated review UI',()=>{
  const s=read('miniapp-v2/develop/index.html');
  for(const name of ['first-v27.css','parking-v24.css','entry-v25.css','app-stable-v36.js','reception-v7.js','first-v27.js','pages-final-v33.js']){
    const escaped=name.replace(/[.*+?^$()|[\]\\]/g,'\\$&');
    assert.match(s,new RegExp(escaped+'\\?v=20261004-06'));
  }
});

test('Review environment uses the console-confirmed Review LIFF identity',()=>{
  const env=read('miniapp-v2/review/env.js');
  assert.match(env,/channelId:'2009884612'/);
  assert.match(env,/liffId:'2009884612-hhM4k4GP'/);
  assert.doesNotMatch(env,/2009884613|ELc6kolf/);
});
