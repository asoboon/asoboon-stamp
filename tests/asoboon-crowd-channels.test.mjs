import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync('miniapp-v2/production/home-v38.js','utf8');
const css=readFileSync('miniapp-v2/production/home-v38.css','utf8');

test('Onsite pool is derived only from explicitly named AirWAIT store labels, not online IDs or clock guesswork',()=>{
 for(const exact of ['すぐ入場受付【平日】','10時15分から【平日特定日】','13時45分から【平日特定日】','10時25分頃入場【土休日特定日】','12時50分頃入場【土休日特定日】','15時15分頃入場時間【土休日特定日】'])assert.ok(home.includes(exact),exact);
 assert.match(home,/matched\.length!==1/);
 assert.match(home,/reserveUnit!=='PERSON'/);
 assert.match(home,/safePeople\(matched\[0\]\.remaining\)/);
 assert.match(home,/slot\.matchMode!=='exact-name'/);
});
test('Reuse only existing API observedDetails, cache safely and never make an extra gateway call',()=>{
 assert.match(home,/Array\.isArray\(data\.observedDetails\)/);
 assert.match(home,/writeCrowdCache\(crowdSlots,crowdDetails\)/);
 assert.match(home,/crowdDetails=Array\.isArray\(cached\.details\)/);
 assert.match(home,/slot\.web===null\?null:crowdMetric\(slot\.web\)/);
 assert.doesNotMatch(home,/fetchOnsite|action=onsiteRemaining/);
});
test('Two clear, responsive channels preserve a neutral unavailable state and original reception action',()=>{
 for(const word of ['WEB受付','現地受付','確認中','混雑目安はWEB枠を基準','data-v7-view="reception"'])assert.ok(home.includes(word),word);
 assert.match(css,/v38-crowd-channels\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
