import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=f=>readFileSync(f,'utf8');
const layout=read('miniapp-v2/production/boon-home-v56-layout.js');
const css=read('miniapp-v2/production/boon-home-v56.css');
const original=read('miniapp-v2/production/home-v38.js');
const theme=read('miniapp-v2/production/boon-mint-v51-preview.js');
const loader=read('miniapp-v2/production/production-shell-loader.js');
const sources=JSON.parse(read('miniapp-v2/production/bundle-sources.json'));

test('HOME is structurally rebuilt as START, queue, today and timer, and capacity board',()=>{
 for(const id of ['v56CommandDeck','v56QueueTile','v56DayTile','v56TimerTile','v56CrowdStage'])
  assert.ok(layout.includes(id),id);
 for(const native of ["'#v38Hero'","'#v38Today'","'#v38TimeguideShortcut'","'#v38Slots'"])
  assert.ok(layout.includes(native),native);
 assert.match(layout,/dayTile\.appendChild\(day\)/);
 assert.match(layout,/timerTile\.appendChild\(timer\)/);
 assert.match(layout,/crowdStage\.appendChild\(crowd\)/);
 assert.match(layout,/callSlot\.replaceChildren\(originalCall\)/);
});
test('all 7 already supported languages have copy and no synthetic data is generated',()=>{
 for(const language of ['ja','en','zh-CN','vi','ne','ko','kmr'])
  assert.ok(layout.includes(language+':')||layout.includes("'"+language+"':"),language);
 assert.doesNotMatch(layout,/\bfetch\s*\(|XMLHttpRequest|\bliff\.|createReservation|cancelReservation|waitTypeId:/);
 assert.match(layout,/presentationOnly:true/);
});
test('approved palette and status semantics remain unchanged',()=>{
 assert.match(css,/#FF7A00/);
 assert.match(css,/#E3FFF6/);
 assert.match(css,/#125E58/);
 assert.doesNotMatch(css,/\.boon-v4-go\s*\{/);
 assert.doesNotMatch(css,/\.boon-v4-lamp\.green\s*\{/);
 assert.match(original,/function heroMarkup/);
 assert.match(theme,/var flag=model\.kind==='calling'/);
});
test('never invent the removed WEB button or replace operational data',()=>{
 assert.doesNotMatch(layout,/boonV5WebReception|boon-v5-web-reception/);
 assert.doesNotMatch(css,/boonV5WebReception|boon-v5-web-reception/);
 assert.match(original,/airwaitWebReceptionUrl\(\)/);
 assert.match(original,/function remainingMarkup/);
 assert.match(css,/v38-crowd-channel--onsite/);
});
test('zero-base design is an optional visual overlay with a classic-mode emergency fallback',()=>{
 assert.match(loader,/get\('boonTheme'\)!=='classic'/);
 assert.match(loader,/boon-home-v56\.css/);
 assert.match(loader,/boon-home-v56-layout\.js/);
 for(const key of ['styles','scripts','routeScripts','routeStyles'])
  assert.equal(sources[key].some(p=>p.includes('boon-home-v56')),false);
});
test('timer action copy does not shadow the locale dictionary',()=>{
 assert.match(theme,/var timerCopyParent=/);
 assert.doesNotMatch(theme,/var copy=timer\.querySelector/);
 assert.match(theme,/var words=saved\?copy\.timerDone:copy\.timer/);
});
