import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const js=readFileSync('miniapp-v2/shared/callstatus.js','utf8');
const from=js.indexOf('function delayForStatus(d){');
const to=js.indexOf('\nfunction scheduleNext(',from);
assert.ok(from>=0&&to>from);
const code=[
 'const POLL_RECONCILE_MS=6000,POLL_FRONT_MS=8000,POLL_NEAR_MS=15000,POLL_MID_MS=30000,POLL_FAR_MS=45000,POLL_ERROR_MS=30000,POLL_TERMINAL_MS=15000;',
 js.slice(from,to),
 'globalThis.delayForStatus=delayForStatus;'
].join('\n');
const ctx={};vm.runInNewContext(code,ctx);
const d=ctx.delayForStatus;
test('visible active tickets refresh adaptively without overloading shared WIFI',()=>{
 assert.equal(d({found:true,state:'waiting',aheadCount:1}),8000);
 assert.equal(d({found:true,state:'waiting',aheadCount:5}),15000);
 assert.equal(d({found:true,state:'waiting',aheadCount:20}),30000);
 assert.equal(d({found:true,state:'waiting',aheadCount:49}),45000);
 assert.equal(d({found:true,state:'waiting'}),6000);
 assert.equal(d({found:true,state:'calling'}),15000);
 assert.equal(d({found:true,state:'hold'}),30000);
 assert.equal(d({found:true,state:'processing'}),30000);
});
test('confirmed terminal states stop unnecessary calls; temporarily missing receipts recover',()=>{
 for(const state of ['done','canceled','closed'])assert.equal(d({found:true,state}),0);
 assert.equal(d({found:false}),6000);
 assert.equal(d({found:true,state:'unknown'}),30000);
});
test('single-flight, hidden-tab pause and RATE_LIMITED backoff are wired',()=>{
 assert.match(js,/if\(activeRefreshGeneration===gen\)\{if\(manual\)queuedManualRefresh=true;return\}/);
 assert.match(js,/if\(queuedManualRefresh\)\{queuedManualRefresh=false;void refreshStatus\(\{manual:true\}\)\}/);
 assert.match(js,/document\.visibilityState!=='visible'/);
 assert.match(js,/POLL_RATE_LIMITED_MS=90000/);
 assert.match(js,/RATE_LIMITED\|HTTP 429/);
 assert.match(js,/setTimeout\(\(\)=>\{pollTimer=0;nextPollAt=0;void refreshStatus\(\)\},delay\)/);
 assert.match(js,/rateLimitUntil>clockTick\(\)/);
 assert.match(js,/function startHeartbeat\(\)/);
});
