import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const src=readFileSync(new URL('../miniapp-v2/production/home-v38.js',import.meta.url),'utf8');
const from=src.indexOf('function remainingMarkup(');
const to=src.indexOf('let lastCrowdRenderBox=',from);
assert.ok(from>=0&&to>from,'Find the original WEB/LINE capacity renderer');
const fn=runInNewContext('('+src.slice(from,to).trim()+')',{
 esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
});

test('Verified 18 people is shown as a large concrete count, not a status-only pill',()=>{
 const html=fn('WEB受付',18,'web',{time:'10:00',webUrl:'https://example.org/airwait'});
 assert.match(html,/v38-crowd-number[^>]*>18<\/span>/);
 assert.match(html,/残り/);
 assert.match(html,/WEBで受付する/);
 assert.match(html,/https:\/\/example.org\/airwait/);
});
test('Verified zero is explicitly full, never unknown',()=>{
 const html=fn('LINE受付',0,'onsite',{time:'13:30'});
 assert.match(html,/v38-crowd-number[^>]*>0<\/span>/);
 assert.match(html,/満枠/);
 assert.match(html,/data-v7-view="reception"/);
});
test('Unavailable value is unknown and never fabricated as 0',()=>{
 const html=fn('WEB受付',null,'web',{time:'15:00'});
 assert.match(html,/確認中/);
 assert.doesNotMatch(html,/v38-crowd-number/);
 assert.doesNotMatch(html,/満枠/);
});
test('Production source names capacity accurately, preserving separate WEB/LINE actions',()=>{
 assert.ok(src.includes('受付枠の空き状況'));
 assert.ok(!src.includes('本日の混雑状況'));
 assert.ok(src.includes("const web=usable?verifiedWebRemaining(slot):null"));
 assert.ok(src.includes("const onsite=usable?onsiteRemaining(id):null"));
 assert.ok(src.includes('data-v7-view=\\"reception\\"')||src.includes('data-v7-view="reception"'));
});
