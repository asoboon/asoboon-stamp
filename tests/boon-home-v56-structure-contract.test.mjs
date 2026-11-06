import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Historical v5.6 test path is kept for callers. The current design is v5.8.
const read=f=>readFileSync(f,'utf8');
const layout=read('miniapp-v2/production/boon-home-v56-layout.js');
const css=read('miniapp-v2/production/boon-home-v56.css');
const original=read('miniapp-v2/production/home-v38.js');
const theme=read('miniapp-v2/production/boon-mint-v51-preview.js');
const loader=read('miniapp-v2/production/production-shell-loader.js');
const sources=JSON.parse(read('miniapp-v2/production/bundle-sources.json'));

test('v5.8 HOME is one verified-state journey instead of a fixed four-card menu',()=>{
 for(const id of ['v58Flow','v58Primary','v58Lead','v58DayZone','v58TimerZone','v58SessionsZone'])
  assert.ok(layout.includes(id),id);
 for(const native of ["'#v38Hero'","'#v38Today'","'#v38TimeguideShortcut'","'#v38Slots'"])
  assert.ok(layout.includes(native),native);
 assert.match(layout,/targetHero\.appendChild\(hero\)/);
 assert.match(layout,/dayZone\.appendChild\(day\)/);
 assert.match(layout,/timerZone\.appendChild\(timer\)/);
 assert.match(layout,/sessionsZone\.appendChild\(slots\)/);
 assert.match(layout,/hero\.classList\.contains\('call-link'\)/);
 assert.match(layout,/s\.source==='live'/);
 assert.match(layout,/state==='guided'/);
 assert.match(layout,/targetHero\.insertBefore\(timer,hero\)/);
 assert.match(layout,/v58-readonly-facts/);
 assert.doesNotMatch(layout,/v56-command-deck|v56-command-home/);
});

test('all seven languages cover meaningful steps and no mock backend actions are added',()=>{
 for(const lang of ['ja','en','zh-CN','vi','ne','ko','kmr'])
  assert.ok(layout.includes(lang+':')||layout.includes("'"+lang+"':"),lang);
 for(const kind of ['pending','waiting','calling','hold','guided','canceled','closed','error','none','loading','open','before','ended'])
  assert.match(layout,new RegExp(kind+':\\['));
 assert.doesNotMatch(layout,/\bfetch\s*\(|XMLHttpRequest|\bliff\.|createReservation|cancelReservation|waitTypeId:/);
 assert.match(layout,/presentationOnly:true/);
 assert.match(layout,/existingActionsOnly:true/);
});

test('readonly business hours are truthful; a saved receipt is not a verified live status',()=>{
 assert.match(layout,/if\(day\.tagName==='BUTTON'\)/);
 assert.match(layout,/passive\.setAttribute\('role','group'\)/);
 assert.match(layout,/while\(day\.firstChild\)passive\.appendChild\(day\.firstChild\)/);
 assert.match(layout,/hero\.classList\.contains\('call-link'\)/);
 assert.match(layout,/source==='live'/);
 assert.match(layout,/checkedAt/);
 assert.match(css,/\.v58-next-title/);
 assert.match(css,/\.v58-sessions/);
});

test('palette and native business systems remain unchanged',()=>{
 assert.match(css,/#FF7A00/);
 assert.match(css,/#E3FFF6/);
 assert.match(css,/#28C7BE/);
 assert.doesNotMatch(css,/\.boon-v4-go\s*\{/);
 assert.match(original,/function heroMarkup/);
 assert.match(original,/function remainingMarkup/);
 assert.match(theme,/var flag=model\.kind==='calling'/);
});

test('no new WEB reception button or synthetic capacity or hidden API requests',()=>{
 assert.doesNotMatch(layout,/boonV5WebReception|boon-v5-web-reception/);
 assert.doesNotMatch(css,/boonV5WebReception|boon-v5-web-reception/);
 assert.match(original,/airwaitWebReceptionUrl\(\)/);
 assert.match(css,/v38-crowd-channel/);
 assert.doesNotMatch(layout,/remaining\s*=|slotKey:|remaining:/);
});

test('emergency classic rollback still works and visual assets are optional',()=>{
 assert.match(loader,/get\('boonTheme'\)!=='classic'/);
 assert.match(loader,/boon-home-v56\.css/);
 assert.match(loader,/boon-home-v56-layout\.js/);
 for(const key of ['styles','scripts','routeScripts','routeStyles'])
  assert.equal(sources[key].some(p=>p.includes('boon-home-v56')),false);
});

test('timer copy and official localization are preserved',()=>{
 assert.match(theme,/var timerCopyParent=/);
 assert.match(theme,/var words=saved\?copy\.timerDone:copy\.timer/);
 assert.match(css,/prefers-reduced-motion/);
});

test('v5.8.1 removes decorative BOON START labels and prevents call-status flashing',()=>{
 assert.doesNotMatch(layout,/el\\('h2','v58-header-title','BOON START'\\)/);
 assert.doesNotMatch(layout,/shell\\.appendChild\\(header\\)/);
 assert.match(css,/\.v58-flow #v38Hero \*\{/);
 assert.match(css,/animation:none!important;transition:none!important/);
 assert.match(layout,/const nativeIds=new Set/);
 assert.match(layout,/if\(nativeChanged\)request\(\)/);
});
test('v5.8.1 reads real business facts in a full-width row and two metric cells',()=>{
 assert.match(css,/grid-column:1\\/-1!important/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(layout,/営業区分/);
 assert.match(original,/function patchToday\(\)/);
});
