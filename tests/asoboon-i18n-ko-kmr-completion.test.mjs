import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
function dictionary(){
 const window={addEventListener(){},dispatchEvent(){}};
 const ctx={window,Event:class{constructor(type){this.type=type}},setTimeout(){}};
 vm.runInNewContext(read('miniapp-v2/shared/i18n-dictionary.js'),ctx,{timeout:3000});
 vm.runInNewContext(read('miniapp-v2/production/i18n-ko-kmr-completion-v2.js'),ctx,{timeout:3000});
 return {dict:window.ASOBOON_I18N_DICTIONARY,status:window.ASOBOON_KO_KMR_COVERAGE};
}
test('Every listed Japanese interface phrase has native Korean and Kurmanji draft instead of English fallback',()=>{
 const {dict,status}=dictionary();
 const keys=Object.keys(dict);
 assert.ok(keys.length>=487);
 assert.equal(status.missingKo,0);
 assert.equal(status.missingKmr,0);
 assert.equal(status.unmatched.length,0);
 assert.ok(status.mapped>=195);
 for(const [ja,value] of Object.entries(dict)){
  for(const code of ['ko','kmr']){
   assert.ok(value[code]?.trim(),ja+' missing '+code);
   assert.doesNotMatch(value[code],/[\u0900-\u097F]/,ja+' incorrect Nepali script for '+code);
   assert.doesNotMatch(value[code],/[\u3040-\u30ff\u4e00-\u9faf]/,ja+' untranslated Japanese for '+code);
  }
 }
});
test('High-risk booking, cancellation and child safety remain semantically distinct',()=>{
 const {dict}=dictionary();
 for(const ja of [
  'お子さまから目を離さないでください。',
  '食べ物は一切禁止です。',
  '飲み物は土足エリアのみです。',
  'キャンセル処理に時間がかかっています。受付は作り直さず、最新状況を確認してください。',
  '受付は成立していません。内容を確認してもう一度お試しください。',
  '受付番号が表示されていなければ、受付は完了していません。'
 ]){
  assert.ok(dict[ja],ja);
  assert.ok(dict[ja].ko.length>=8&&dict[ja].kmr.length>=8,ja);
  assert.notEqual(dict[ja].ko,dict[ja].en);
  assert.notEqual(dict[ja].kmr,dict[ja].en);
 }
});
test('Completion layer ships on official HOME and direct Production and never touches AirWAIT mutations',()=>{
 const home=read('home.html'),index=read('miniapp-v2/production/index.html'),builder=read('miniapp-v2/build-production.mjs');
 for(const html of [home,index,builder])assert.match(html,/i18n-ko-kmr-completion-v2\.js\?v=20261113-02/);
 const addon=read('miniapp-v2/production/i18n-ko-kmr-completion-v2.js');
 assert.ok(!/fetch\(|XMLHttpRequest|localStorage|createReservation|cancelReservation|sessionToken|receiptNo/.test(addon));
 assert.match(addon,/window\.dispatchEvent\(new Event\('asoboon:v2-route-rendered'\)\)/);
});


test('Dynamic HOME labels use native display text while preserving source on locale return',()=>{
 const addon=read('miniapp-v2/production/i18n-ko-kmr-completion-v2.js');
 for(const phrase of ['受付なし','駐車場・アクセスを見る','最終更新','LINEミニアプリの受付へ'])assert.ok(addon.includes(phrase));
 for(const code of ['en','zh-CN','vi','ne','ko','kmr'])assert.ok(addon.includes(code));
 assert.match(addon,/asoboon:language-changed/);
 assert.match(addon,/const rawCache=new WeakMap/);
});
