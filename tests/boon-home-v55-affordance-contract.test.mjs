import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const bridge=read('miniapp-v2/production/boon-mint-v51-preview.js');
const passion=read('miniapp-v2/production/boon-mint-v53-passion.css');
const native=read('miniapp-v2/production/home-v38.js');
const bundles=JSON.parse(read('miniapp-v2/production/bundle-sources.json'));

test('four original HOME controls gain visible signifiers without introducing new navigation',()=>{
 assert.match(bridge,/function enhanceHomeAffordances\(home\)/);
 assert.match(bridge,/call\.querySelector\('\.v38-call-cta-copy strong'\)/);
 assert.match(bridge,/\.v55-today-action/);
 assert.match(bridge,/\.v55-timer-action/);
 assert.match(bridge,/\.v55-crowd-prompt/);
 assert.match(bridge,/enhanceHomeAffordances\(home\)/);
 assert.doesNotMatch(bridge,/boonV5WebReception|boon-v5-web-reception/);
});
test('action text is grounded in the original route and state',()=>{
 assert.match(bridge,/呼出状況を見る/);
 assert.match(bridge,/営業区分・利用時間を詳しく見る/);
 assert.match(bridge,/遊べる時間を計算する/);
 assert.match(bridge,/計算結果を確認する/);
 assert.match(bridge,/各受付枠の残り人数を表示します/);
 assert.match(native,/data-v7-view="timeguide"/);
 assert.doesNotMatch(native,/data-v7-view=\"callstatus\"/);
 assert.match(read('miniapp-v2/production/choco-mint-nav-v8.js'),/\['home','callstatus','guide','play'\]/);
 assert.match(native,/data-v7-view="reception"/);
});
test('native business type, capacity and calling code and route bundles are unchanged',()=>{
 assert.match(native,/function patchToday\(\)/);
 assert.match(native,/function verifiedWebRemaining/);
 assert.match(native,/function remainingMarkup/);
 assert.match(bridge,/var flag=model\.kind==='calling'/);
 assert.ok(!bundles.scripts.some(p=>p.includes('boon-mint-v51-preview')));
 assert.ok(!bundles.styles.some(p=>p.includes('boon-mint-v53-passion')));
});
test('touch and feedback affordances target real controls; unavailable cards stay unstyled',()=>{
 assert.match(passion,/#v38Today:active/);
 assert.match(passion,/#v38TimeguideShortcut:focus-visible/);
 assert.match(passion,/#v38Slots \.v38-crowd-channel:is\(a,button\):focus-visible/);
 assert.match(passion,/#v38Slots #v38CrowdUpdate:disabled/);
 assert.match(passion,/#v38Hero \.v38-call-cta:active/);
 assert.doesNotMatch(passion,/\.v38-crowd-channel\.is-unavailable\s+\.v38-crowd-tap\s*\{/);
});
test('passion orange keeps meaningful safety colors independent',()=>{
 assert.match(passion,/#FF7A00/);
 assert.match(passion,/#E3FFF6/);
 assert.doesNotMatch(passion,/(?:\.boon-v4-go|\.boon-v4-lamp\.green|\.boon-v4-call-hero\.calling)\s*\{[^}]*#FF7A00/s);
 assert.doesNotMatch(bridge,/function fetchCrowd|function createReservation/);
});
