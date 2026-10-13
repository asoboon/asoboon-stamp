import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ctx={window:{}};
runInNewContext(read('miniapp-v2/shared/i18n-dictionary.js'),ctx);
const entries=ctx.window.ASOBOON_I18N_DICTIONARY;
const locales=['en','zh-CN','vi','ne'];
const critical=[
  '当日受付','① ご利用の回','② ご利用人数','受付番号 / 受付が完了しました',
  '入場できます','キャンセルすると現在の順番は取り消され、元には戻せません。',
  '受付をキャンセルしますか？','やめる',
  '受付内容とご利用にあたっての案内を確認しました。',
  '受付内容とご利用にあたっての案内を確認しました。受付ボタンは一度だけ押してください。',
  'ご利用にあたって','ご利用にあたりお客様ご自身に関する以下の項目について施設では責任を負いかねますので、あらかじめお知らせいたします。',
  '呼出後30分以内','二重受付や番号の取り違えを防ぐため、確認しています。',
  '受付システム側で一時的なエラーが発生しました。受付は成立していません。時間をおいてもう一度お試しください。',
  'キャンセル処理に時間がかかっています。受付は作り直さず、最新状況を確認してください。',
  'アクセスが集中しています。しばらくすると自動で再確認します。LINEの呼出通知もご確認ください。',
  "受付できる内容を確認しています…",
  "受付しています…",
  "受付の準備中…",
  "現在受付できる枠がありません。最新の受付状況をご確認ください。",
  "確認中…",
  "受付結果を確認できません。AirWAIT側で成立している可能性があるため、新しい受付は行わないでください。",
  "受付処理の確認に時間がかかっています。新しい受付は行わないでください。",
  "受付システムの応答を待っています",
  "受付状況の確認がタイムアウトしました。",
];
test('core phrase dictionary is complete, with real translated mandatory safety wording',()=>{
 assert.ok(Object.keys(entries).length>=375);
 for(const [ja,row] of Object.entries(entries)){
  assert.ok(ja.length>0);
  for(const locale of locales){
   assert.equal(typeof row[locale],'string',ja+' '+locale);
   assert.ok(row[locale].trim().length>0,ja+' '+locale);
   assert.ok(!/<script|<\/script|<iframe/i.test(row[locale]));
  }
 }
 for(const ja of critical){
  assert.ok(entries[ja],ja);
  for(const locale of locales){
   assert.notEqual(entries[ja][locale],ja,ja+' '+locale);
  }
 }
});
test('Production and pre-release shells resolve localized resources without modifying AirWAIT flows',()=>{
 const build=read('miniapp-v2/build-production.mjs');
 const routes=read('miniapp-v2/production/bundle-sources.json');
 assert.match(build,/const dictPath='miniapp-v2\/shared\/i18n-dictionary\.js'/);
 assert.match(build,/const i18nPath='miniapp-v2\/shared\/i18n-runtime\.js'/);
 assert.doesNotMatch(routes,/i18n-dictionary|i18n-runtime/);
 const shell=read('miniapp-v2/production/production-shell-loader.js');
 assert.match(shell,/Optional localization must never block Japanese reception/);
 for(const resource of ['i18n-dictionary.js','i18n-runtime.js'])assert.match(shell,new RegExp(resource.replace('.','\\.')));
 for(const mode of ['develop','review']){
  const html=read('miniapp-v2/'+mode+'/index.html');
  for(const resource of ['i18n-dictionary.js','i18n-runtime.js'])assert.match(html,new RegExp(resource.replace('.','\\.')));
 }
 const code=read('miniapp-v2/shared/i18n-runtime.js');
 assert.match(code,/localStorage\.setItem\(KEY,language\)/);
 assert.match(code,/new MutationObserver/);
 assert.match(code,/Original Japanese \/ 日本語原文/);
 assert.doesNotMatch(code,/createReservation|cancelReservation|postReservation/);
});
test('canonical confirmed ticket and backend types remain unmodified by localization implementation',()=>{
 const code=read('miniapp-v2/shared/i18n-runtime.js');
 for(const forbidden of ['recAdult','recChild','recInfant','recAgree','recSubmit','sessionToken','receiptNo','waitTypeId','backendUrl'])assert.ok(!code.includes(forbidden),forbidden);
 assert.match(code,/isCore\(\)/);
 assert.match(code,/value\.trim\(\)/);
});
