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
 assert.doesNotMatch(layout,/sessionsZone\.appendChild\(slots\)/);
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

test('v5.8.1 has no decorative BOON START title and keeps status motionless',()=>{
 assert.equal(layout.includes("el('h2','v58-header-title','BOON START')"),false);
 assert.equal(layout.includes('shell.appendChild(header)'),false);
 assert.ok(css.includes('.v58-flow #v38Hero *,'));
 assert.ok(css.includes('animation:none!important;transition:none!important'));
 assert.ok(layout.includes('const nativeIds=new Set'));
 assert.ok(layout.includes('if(nativeChanged)request()'));
});
test('v5.8.1 emphasizes real business facts without modifying their source',()=>{
 assert.ok(css.includes('grid-column:1/-1!important'));
 assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
 assert.ok(layout.includes('営業区分'));
 assert.match(original,/function patchToday\(\)/);
});


test('v5.9 keeps critical action, today, slots and timer out of disclosure',()=>{
 assert.match(layout,/progressiveSections\(home,state,info\.live\)/);
 assert.match(layout,/groupCalendars\(home,words\.calendars\)/);
 assert.match(layout,/foldExisting\(home,'\.v38-guide','v59GuideFold'/);
 assert.match(layout,/foldExisting\(home,'\.v38-play','v59PlayFold'/);
 assert.doesNotMatch(layout,/foldExisting\(home,'#v38Hero'|foldExisting\(home,'#v38Today'|foldExisting\(home,'#v38Slots'|foldExisting\(home,'#v38TimeguideShortcut'/);
 assert.match(layout,/document\.createElement\(tag\)/);
 assert.match(layout,/body\.appendChild\(section\)/);
 assert.match(layout,/el\('details','v59-fold'\)/);
 assert.match(layout,/el\('summary','v59-fold-summary'\)/);
 assert.match(layout,/5\.11\.0-home-compact/);
 assert.doesNotMatch(layout,/XMLHttpRequest|fetch\s*\(|createReservation|cancelReservation/);
});
test('v5.9 accessible native disclosure shows the calendar links and preserves keyboard interaction',()=>{
 assert.match(css,/\.v59-fold-summary:focus-visible/);
 assert.match(css,/min-height:73px!important/);
 assert.match(css,/\.v59-fold\[open\] \.v59-fold-close/);
 assert.match(css,/\.v59-calendar-links \.v38-calendar-card/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 for(const locale of ['ja','en','zh-CN','ko','vi','ne','kmr'])assert.ok(layout.includes((locale==='zh-CN'?"'zh-CN'":locale)+':{guide:'),locale);
});

test('v5.11 compact capacity uses a closed native disclosure and retains the original live node',()=>{
 assert.match(layout,/el\('details','v59-slots-fold'\)/);
 assert.match(layout,/el\('summary','v59-slots-summary'\)/);
 assert.match(layout,/slotsBody\.appendChild\(slots\)/);
 assert.match(layout,/\(copy\[language\(\)\]\|\|copy\.en\)\.slots/);
 assert.doesNotMatch(layout,/disclosure\.open\s*=|setAttribute\(['"]open/);
 assert.match(css,/\.v59-slots-summary:focus-visible/);
 assert.match(css,/min-height:56px/);
 assert.match(css,/\.v59-slots-chevron/);
 assert.match(css,/\.v55-crowd-prompt/);
 assert.match(theme,/today\.querySelector\('\.v55-today-action'\)\?\.remove\(\)/);
 assert.match(theme,/slots\?\.querySelectorAll\(':scope > \.v55-crowd-prompt'\)/);
 for(const locale of ['ja','en','ko','vi','ne','kmr'])assert.ok(layout.includes(locale+':{eyebrow:'),locale);assert.ok(layout.includes("'zh-CN':{eyebrow:"), 'zh-CN');
});
test('v5.11 compact business facts use live day values and guard opening time',()=>{
 assert.match(original,/replace\('土日祝日','土日祝'\)/);
 assert.match(original,/day\.closingTime/);
 assert.match(original,/\\d\{2\}:\\d\{2\}/);
 assert.match(original,/d==='無制限'/);
 assert.match(css,/grid-template-columns:minmax\(0,auto\) minmax\(0,1fr\)/);
});

test('v5.11.1 keeps one stable native details node and preserves open state during live updates',()=>{
 assert.match(layout,/let disclosure=sessionsZone\.querySelector\(':scope > details\.v59-slots-fold'\)/);
 assert.match(layout,/slotsBody=disclosure\.querySelector\('\.v59-slots-body'\);if\(slots\.parentElement!==slotsBody\)slotsBody\.appendChild\(slots\)/);
 assert.doesNotMatch(layout,/slots\.parentElement!==sessionsZone/);
 assert.doesNotMatch(layout,/disclosure\.open\s*=|setAttribute\(['"]open/);
 assert.match(css,/\.v59-slots-fold\[open\] \.v59-slots-close/);
 assert.match(css,/\.v59-slots-fold\[open\] \.v59-slots-chevron/);
});
test('v5.11.1 compact facts and tappable summary fit narrow mobile viewports',()=>{
 assert.match(original,/setText\(v\[0\],'今日の営業'\)/);
 assert.match(original,/k\+\(t\?' '\+t:''\)/);
 assert.match(original,/day\.durationLabel/);
 assert.match(css,/\.v58-day\{margin:0 0 6px/);
 assert.match(css,/\.v58-sessions\{margin:5px 0/);
 assert.match(css,/minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:350px\)/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(css,/:active/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 for(const width of [320,390,430]){assert.ok(width>=320&&width<=430);assert.match(css,/grid-template-columns:minmax\(0,auto\) minmax\(0,1fr\)/);assert.match(css,/overflow-wrap:anywhere/)}
 for(const label of ['人数を見る','View spaces','查看名额','인원 보기','Xem chỗ','ठाउँ हेर्नुहोस्','Cihên bibîne'])assert.ok(layout.includes(label),label);
});
