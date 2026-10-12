import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const js=readFileSync('miniapp-v2/shared/callstatus.js','utf8');
const from=js.indexOf('function delayForStatus(d){');
const to=js.indexOf('\nfunction scheduleNext(',from);
assert.ok(from>=0&&to>from);
const code=[
 'const POLL_RECONCILE_MS=6000,POLL_FRONT_MS=5000,POLL_NEAR_MS=10000,POLL_MID_MS=15000,POLL_FAR_MS=20000,POLL_ERROR_MS=15000,POLL_TERMINAL_MS=15000;',
 js.slice(from,to),
 'globalThis.delayForStatus=delayForStatus;'
].join('\n');
const ctx={};vm.runInNewContext(code,ctx);
const d=ctx.delayForStatus;
test('visible active tickets get 5-20 second automatic refresh, including calling',()=>{
 assert.equal(d({found:true,state:'waiting',aheadCount:1}),5000);
 assert.equal(d({found:true,state:'waiting',aheadCount:5}),10000);
 assert.equal(d({found:true,state:'waiting',aheadCount:20}),15000);
 assert.equal(d({found:true,state:'waiting',aheadCount:49}),20000);
 assert.equal(d({found:true,state:'waiting'}),6000);
 assert.equal(d({found:true,state:'calling'}),15000);
 assert.equal(d({found:true,state:'hold'}),15000);
 assert.equal(d({found:true,state:'processing'}),15000);
});
test('confirmed terminal states stop unnecessary calls; temporarily missing receipts recover',()=>{
 for(const state of ['done','canceled','closed'])assert.equal(d({found:true,state}),0);
 assert.equal(d({found:false}),6000);
 assert.equal(d({found:true,state:'unknown'}),15000);
});
test('single-flight, hidden-tab pause and RATE_LIMITED backoff are wired',()=>{
 assert.match(js,/if\(activeRefreshGeneration===gen\)\{if\(manual\)queuedManualRefresh=true;return\}/);
 assert.match(js,/if\(queuedManualRefresh\)\{queuedManualRefresh=false;void refreshStatus\(\{manual:true\}\)\}/);
 assert.match(js,/document\.visibilityState!=='visible'/);
 assert.match(js,/POLL_RATE_LIMITED_MS=60000/);
 assert.match(js,/RATE_LIMITED\|HTTP 429/);
 assert.match(js,/setTimeout\(\(\)=>\{pollTimer=0;void refreshStatus\(\)\},jitter\(nextPollMs\)\)/);
});
