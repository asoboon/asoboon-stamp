import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Both standalone calendars retain one shared seven-language discoverable switch',()=>{
 const js=read('miniapp-v2/production/calendar-i18n-v1.js');
 for(const route of ['business-calendar.html','event-calendar.html']){
  const source=read('miniapp-v2/production/'+route);
  assert.match(source,/calendar-i18n-v1\.js\?v=20261113-01/);
  assert.match(source,/shared\/i18n-dictionary\.js\?v=20261113-cal01/);
 }
 for(const code of ['ja','en','zh-CN','vi','ne','ko','kmr'])assert.ok(js.includes(code));
 assert.match(js,/🌐 Language/);
 assert.match(js,/localStorage\.getItem\(KEY\)/);
 assert.match(js,/new MutationObserver/);
 assert.match(js,/document\.documentElement\.lang=lang/);
});
test('Calendar locale bridge does not change business data, booking or Instagram endpoints',()=>{
 const js=read('miniapp-v2/production/calendar-i18n-v1.js');
 assert.doesNotMatch(js,/\bfetch\(|XMLHttpRequest|createReservation|cancelReservation|waitTypeId|sessionToken|iframe\.src/);
 for(const ja of ['火曜日は定休日です。特別営業・臨時休業は営業日程に反映します。','※イベント内容・開催時間は、当日の混雑状況や運営上の都合により変更または中止となる場合があります。']){
  assert.ok(js.includes(ja),'Missing critical source notice '+ja);
 }
});
