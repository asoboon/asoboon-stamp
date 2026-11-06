import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const bridge=readFileSync('miniapp-v2/production/boon-mint-v51-preview.js','utf8');
const css=readFileSync('miniapp-v2/production/boon-mint-v51-preview.css','utf8');
const call=readFileSync('miniapp-v2/shared/callstatus.js','utf8');

test('native no-reservation state is recognized before generic transport errors',()=>{
 assert.match(call,/本日の受付が見つかりません/);
 assert.match(bridge,/var noSession=nativeTitle==='本日の受付が見つかりません'/);
 assert.match(bridge,/var error=!noSession/);
 assert.match(bridge,/if\(noSession\)/);
 assert.match(bridge,/kind='no-reservation'/);
});
test('new reception is offered only without a cached receipt',()=>{
 assert.match(bridge,/canStart:noSession&&receipt==='—'/);
 assert.match(bridge,/data-v7-view="reception"/);
 assert.match(bridge,/新しい受付を作り直さず/);
 assert.match(bridge,/model\.kind==='no-reservation'/);
});
test('original staff message remains visible and no fake last update is shown',()=>{
 assert.match(bridge,/note:noSession\?message:''/);
 assert.match(bridge,/boon-v4-no-reservation-note/);
 assert.match(bridge,/noSession\?'':'<p class="boon-v4-checked"/);
 assert.match(css,/boon-v4-call-hero\.no-reservation/);
});
