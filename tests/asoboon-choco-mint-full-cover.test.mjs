import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(root+p,'utf8');
const manifest=JSON.parse(read('miniapp-v2/production/bundle-sources.json'));
const css=read('miniapp-v2/production/choco-mint-allroutes-v10.css');
test('all non-HOME UI routes load the final chocolate-mint layer after legacy CSS',()=>{
 const core='miniapp-v2/production/choco-mint-allroutes-v10.css';
 const access='miniapp-v2/production/access-legibility-v11.css';
 assert.ok(manifest.routeStyles.includes(core));
 assert.equal(manifest.routeStyles.at(-1),access);
 assert.ok(manifest.routeStyles.indexOf(access)>manifest.routeStyles.indexOf(core));
 assert.match(read('miniapp-v2/production/production-routes.css'),/choco-mint-allroutes-v10\.css/);
 for(const token of ['.pv7-head','.cm-hub-head','.v7-reception-active','.v7-callstatus-active','.v7-timeguide-active','.v27-first-page','.v24-parking-page','.v25-entry-page','.cm-faq','.cm-hub-row']){
  assert.ok(css.includes(token),'Missing route styling: '+token);
 }
});
test('semantic CALL status colors are preserved regardless of cocoa/mint decorations',()=>{
 assert.match(css,/background:var\(--tone-ink\)!important/);
 assert.match(css,/data-asoboon-call-tone/);
 assert.match(css,/\.cs-state\.calling/);
 assert.match(css,/\.cs-state\.canceled/);
});
test('business and event calendars share the same independent chocolate-mint stylesheet',()=>{
 for(const file of ['business-calendar.html','event-calendar.html']){
  const html=read('miniapp-v2/production/'+file);
  assert.match(html,/choco-mint-calendar-v10\.css\?v=1/);
 }
 const theme=read('miniapp-v2/production/choco-mint-calendar-v10.css');
 assert.match(theme,/\.bc-header/);
 assert.match(theme,/\.hero/);
});
test('ASOQUEST receives a visual shell without modifying engine animation code',()=>{
 assert.match(read('miniapp-v2/production/asoquest/index.html'),/choco-mint-rally-v10\.css\?v=1/);
 const theme=read('miniapp-v2/production/asoquest/choco-mint-rally-v10.css');
 assert.match(theme,/\.garage/);
 assert.doesNotMatch(theme,/ignitionSequence|fxFire|animation-duration/);
});
test('production build retains split delivery and existing business logic module ordering',()=>{
 assert.equal(manifest.scripts.filter(v=>v.includes('home-v38.js')).length,1);
 assert.ok(manifest.routeScripts.includes('miniapp-v2/shared/reception.js'));
 assert.ok(manifest.routeScripts.includes('miniapp-v2/shared/callstatus.js'));
 assert.ok(manifest.routeScripts.includes('miniapp-v2/shared/timeguide.js'));
 assert.ok(!manifest.styles.includes('miniapp-v2/production/choco-mint-allroutes-v10.css'),'Non-HOME CSS must be deferred');
});
test('all navigable detail headers keep chocolate chips despite legacy important background declarations',()=>{
 assert.match(css,/main\.view\.active :is\(\.cm-hub-head,\.pv7-head\)/);
 assert.match(css,/body:not\(\.v7-callstatus-active\) #app main\.view\.active \.page-head/);
 assert.match(css,/radial-gradient\(ellipse 6px 4px at 91% 25%,#744634/);
 assert.match(css,/background:var\(--tone-ink\)!important/);
});

test('arrival-choice parking style is deferred after all route themes and stays independent of business API',()=>{
 const accessCss=read('miniapp-v2/production/access-legibility-v11.css');
 const routeJs=read('miniapp-v2/production/parking-v24.js');
 assert.match(accessCss,/\.v24-section,\.v24-safety,\.v24-select-hint/);
 assert.match(accessCss,/\[hidden\]\{display:none!important\}/);
 assert.match(routeJs,/data-v24-route="v24-general"/);
 assert.match(routeJs,/data-v24-route="v24-highway"/);
 assert.match(routeJs,/aria-pressed="false"/);
 assert.match(routeJs,/\.open=false/);
 assert.match(read('miniapp-v2/production/production-routes.css'),/access-legibility-v11/);
 assert.ok(!manifest.styles.includes('miniapp-v2/production/access-legibility-v11.css'));
});

test('all 5 Iina Park parking lots have Google Maps shortlist pins and visible individual links',()=>{
 const parking=read('miniapp-v2/production/parking-v24.js');
 const ids=['ChIJXXu6y1SVGGAR_0YLVUttt6Y','ChIJyZN4QJOVGGARXseqERsVP2Y','ChIJoRybHi2VGGARe61DT2GBGW0','ChIJYSPyO0CVGGAR8ny8dIbrVDU','ChIJzwHsNK-VGGARXntcgjBDg-4'];
 assert.match(parking,/map_action=shortlist&place_ids=/);
 for(const id of ids)assert.ok(parking.includes(id),'Missing Google place ID '+id);
 for(const id of ['hKcx4SKWdEYZHcPE6','kgT7ZqYLWhsQQZZW8','NJnqAPZWHYBngrzYA','wnq7keJLpMDo6GrC8','mYVyxfQSc3ZvMUzG7'])assert.ok(parking.includes(id),'Missing individual Google link '+id);
 for(const i of [1,2,3,4,5])assert.ok(parking.includes('data-v24-lot="'+i+'"'),'Missing visible parking link '+i);
 assert.match(parking,/一部駐車場は閉鎖/);
 assert.match(read('miniapp-v2/production/access-legibility-v11.css'),/v24-all-map/);
 assert.match(read('miniapp-v2/production/access-legibility-v11.css'),/v24-lot-row/);
});
