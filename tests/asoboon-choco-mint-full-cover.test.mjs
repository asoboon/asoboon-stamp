import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(root+p,'utf8');
const manifest=JSON.parse(read('miniapp-v2/production/bundle-sources.json'));
const css=read('miniapp-v2/production/choco-mint-allroutes-v10.css');
test('all non-HOME UI routes load the final chocolate-mint layer after legacy CSS',()=>{
 assert.equal(manifest.routeStyles.at(-1),'miniapp-v2/production/choco-mint-allroutes-v10.css');
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
