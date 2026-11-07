import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const js=readFileSync(new URL('../miniapp-v2/production/boon-home-v60.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../miniapp-v2/production/boon-home-v60.css',import.meta.url),'utf8');
const build=readFileSync(new URL('../miniapp-v2/build-production.mjs',import.meta.url),'utf8');
function api(){
 const window={ASOBOON_MINT_V51_PREVIEW:true,addEventListener(){}};
 const root={};
 const document={getElementById:id=>id==='app'?root:null,documentElement:{lang:'ja'}};
 class MutationObserver{observe(){}}
 vm.runInNewContext(js,{window,document,MutationObserver,requestAnimationFrame(){}});
 return window.BOON_HOME_V60;
}
test('forecast is calculated against 320 people, including over 100%',()=>{
 const calculate=api().forecastPercent;
 for(const [people,expected] of [[0,0],[160,50],[240,75],[320,100],[350,109],[384,120],[640,200],[-1,null],[NaN,null],[null,null],[1.5,null],['320',null]]){
  assert.equal(calculate(people),expected,String(people));
 }
});
test('unknown booked counts are not inferred from remaining capacity',()=>{
 assert.match(js,/booked:null/);
 assert.match(js,/pct===null\?'—'/);
 assert.doesNotMatch(js,/350\s*-\s*row\.web/);
});
test('native available slots supply WEB/LINE people labels without rewriting booking API',()=>{
 assert.match(js,/\.v38-crowd-card/);
 assert.match(js,/\.v38-crowd-channel--/);
 assert.match(js,/v60-capacity-table/);
 assert.match(js,/v38CrowdUpdate/);
 assert.match(js,/readOnly:true/);
});
test('HOME compaction overrides both old slots disclosure and broken day grid',()=>{
 assert.match(css,/v59SlotsFold\{display:none!important\}/);
 assert.match(css,/v38Today>span:nth-child\(2\)/);
 assert.match(css,/v58-sessions\{order:2/);
 assert.match(css,/#v38Hero\.open \.v38-reception-hours \*/);
 assert.match(css,/color:#174A40!important/);
});
test('separate read-only module stays out of the initial booking bundle',()=>{
 assert.match(build,/boon-home-v60\.js/);
 assert.match(build,/boon-home-v60\.css/);
 const sources=JSON.parse(readFileSync(new URL('../miniapp-v2/production/bundle-sources.json',import.meta.url)));
 assert.ok(!sources.scripts.includes('miniapp-v2/production/boon-home-v60.js'));
});