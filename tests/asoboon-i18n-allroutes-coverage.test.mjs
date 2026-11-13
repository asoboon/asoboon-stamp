import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const src=read('miniapp-v2/shared/i18n-dictionary.js');
const context={window:{}};
vm.runInNewContext(src,context,{timeout:3000});
const dict=context.window.ASOBOON_I18N_DICTIONARY;
const locales=['en','zh-CN','vi','ne','ko','kmr'];
test('i18n visitor dictionary includes all seven interface languages and expanded Korean/Kurmanji routes',()=>{
 const keys=Object.keys(dict);
 assert.ok(keys.length>=480,'Visitor-route dictionary shrunk: '+keys.length);
 const ko=keys.filter(k=>typeof dict[k].ko==='string'&&dict[k].ko.trim()).length;
 const kmr=keys.filter(k=>typeof dict[k].kmr==='string'&&dict[k].kmr.trim()).length;
 assert.ok(ko>=185,'Korean route coverage fell to '+ko);
 assert.ok(kmr>=185,'Kurmanji route coverage fell to '+kmr);
 for(const lang of locales)assert.ok(keys.some(k=>dict[k][lang]),'Missing locale '+lang);
});
test('essential safety and access phrases exist in both Korean and Kurmanji',()=>{
 for(const phrase of ['お子さまから目を離さないでください。','食べ物は一切禁止です。','飲み物は土足エリアのみです。','保護者1名につき3名まで','駐車場・アクセス','一般道から','首都高から','受付番号が表示されていなければ、受付は完了していません。']){
  assert.ok(dict[phrase],phrase);
  for(const lang of ['ko','kmr']){
   const text=dict[phrase][lang];
   assert.ok(text&&text.trim().length>4,phrase+' '+lang);
   assert.doesNotMatch(text,/[\u0900-\u097F]/,phrase+' leaked Nepali characters in '+lang);
   assert.doesNotMatch(text,/[\u3040-\u30ff\u4e00-\u9faf]/,phrase+' leaked Japanese in '+lang);
  }
 }
});
test('all-route display layer translates without altering ticket or AirWAIT identifiers',()=>{
 const runtime=read('miniapp-v2/shared/i18n-runtime.js');
 assert.match(runtime,/const isTranslatable=\(\)=>/);
 assert.match(runtime,/const translated=isTranslatable\(\)\?translateRaw\(raw\):raw/);
 assert.match(runtime,/document\.documentElement\.lang=isTranslatable\(\)\?language:'ja'/);
 assert.match(runtime,/localizedKoKmr\(value,locale\)/);
 assert.match(runtime,/const normalized=localizedKoKmr\(value,locale\)/);
 for(const phrase of ['receiptNo','sessionToken','waitTypeId','createReservation','cancelReservation','postReservation'])assert.ok(!runtime.includes(phrase),phrase);
});

test('Live audit covers visible FAQs, safety, arrival and calendar labels for both additional languages',()=>{
 const all=Object.keys(dict);
 assert.ok(all.length>=680,'Live-audited dictionary shrank: '+all.length);
 for(const lang of ['ko','kmr']){
  const nativeCount=all.filter(k=>typeof dict[k][lang]==='string'&&dict[k][lang].trim()).length;
  assert.ok(nativeCount>=480,lang+' missing live-route translations: '+nativeCount);
  for(const key of ['ご利用案内','安全に遊ぶ4つの約束','ご利用案内に戻る','受付は何時から始まりますか？','WEB受付は対象日7:00から、LINE受付は9:30から。開館は10:00です。','一時退場中も利用時間は進みます。','今月のイベント','定休日や臨時の営業変更をご確認いただけます。']){
   const value=dict[key]?.[lang];
   assert.ok(value&&value.trim().length>5,lang+' '+key);
   assert.doesNotMatch(value,/[\u0900-\u097f]/,lang+' contains Nepali characters: '+key);
  }
 }
 const bridge=read('miniapp-v2/production/standalone-calendar-i18n-v1.js');
 for(const html of ['miniapp-v2/production/business-calendar.html','miniapp-v2/production/event-calendar.html']){
  assert.match(read(html),/standalone-calendar-i18n-v1\.js/);
 }
 assert.match(bridge,/asoboon_miniapp_locale_v1/);
});
