import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const home=readFileSync('miniapp-v2/production/home-v38.js','utf8');
const rec=readFileSync('miniapp-v2/shared/reception.js','utf8');

test('Public home cannot rerender crowd cards on an automatic 35-second polling timer',()=>{
  assert.match(home,/function scheduleCrowd\(\)\{[\s\S]*?clearTimeout\(crowdPollTimer\);crowdPollTimer=0;\s*\}/);
  const body=home.slice(home.indexOf('function scheduleCrowd(){'),home.indexOf('function crowdFreshness()'));
  assert.doesNotMatch(body,/setTimeout\(/);
  assert.match(home,/fetchCrowd\(true,true\)/,'manual refresh remains available');
});

test('A repeated status update with identical crowd markup cannot discard an in-progress tap',()=>{
  assert.match(home,/if\(box===lastCrowdRenderBox&&markup===lastCrowdMarkup\)return/);
  assert.match(home,/function writeCrowdMarkup\(box,markup\)/);
});

test('A business-day error does not prevent navigating to the reception page',()=>{
  assert.match(home,/a\.type==='error'\?action\('reception','受付画面を開く','primary'\)/);
});

test('Reception error offers separate WEB access without pretending it is a LINE reservation',()=>{
  assert.match(rec,/id="recWebFallback"/);
  assert.match(rec,/https:\/\/airwait\.jp\/WCSP\/storeDetail\?storeNo=AKR2298124918/);
  assert.match(rec,/WEB受付から取得できる枠もあります/);
  assert.match(rec,/fallback\.hidden=.*kind==='bad'/);
  assert.match(rec,/const permissionOK=/,'LINE profile requirement is unchanged');
});
