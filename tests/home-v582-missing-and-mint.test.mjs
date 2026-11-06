import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const call=read('miniapp-v2/shared/callstatus.js');
const home=read('miniapp-v2/production/home-v38.js');
const theme=read('miniapp-v2/production/boon-mint-v51-preview.js');
const css=read('miniapp-v2/production/boon-home-v56.css');
const sources=JSON.parse(read('miniapp-v2/production/bundle-sources.json'));

test('verified missing recovery is separate from unavailable LINE auth and network failures',()=>{
 assert.match(call,/const VERIFIED_NO_SESSION=Object\.freeze/);
 assert.match(call,/if\(d\.found===false\)return VERIFIED_NO_SESSION/);
 assert.match(call,/if\(session===VERIFIED_NO_SESSION\)\{showVerifiedMissing\(cachedReservation\(\)\);return\}/);
 assert.match(call,/LINEミニアプリから開き直して呼出状況をご確認ください/);
 assert.match(call,/通信エラーではありません/);
 assert.match(call,/受付番号は保存したままです/);
 assert.doesNotMatch(call,/if\(!d\.found\)return null/);
});

test('callstatus never deletes a saved receipt on a missing or transient response',()=>{
 const fn=call.slice(call.indexOf('function showVerifiedMissing('),call.indexOf('function shareHomeStatus('));
 assert.doesNotMatch(fn,/removeKey\(/);
 assert.match(fn,/updateRebookAction\(null\)/);
 assert.match(call,/receiptNo/);
});

test('HOME reception button remains stable on status polls and no extra HOME status API runs',()=>{
 assert.match(home,/sig=v\.kind\+'\|'\+v\.html/);
 assert.doesNotMatch(home,/asoboon:v8-home-status'[^\n]*lastHero=''/);
 assert.equal(sources.scripts.includes('miniapp-v2/production/home-status-v13.js'),false);
});

test('mint has visual weight and the business classification is the largest first-row fact',()=>{
 assert.match(css,/#BDF5E6/i);
 assert.match(css,/#D3FBEF/i);
 assert.match(css,/#BAF3DE/i);
 assert.match(css,/font-size:clamp\(25px,7vw,32px\)/);
 assert.doesNotMatch(theme,/hero\.insertBefore\(flag,hero\.firstChild\)/);
});
