import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync('miniapp-v2/shared/callstatus.js','utf8');
const css=readFileSync('miniapp-v2/production/callstatus-state-colors.css','utf8');
const home=readFileSync('miniapp-v2/production/home-v38.js','utf8');
const rec=readFileSync('miniapp-v2/shared/reception.js','utf8');
test('The four audience-facing status categories have separate page-wide palettes',()=>{
 for(const k of ['waiting','calling','done','canceled']){
  assert.ok(css.includes('data-asoboon-call-tone="'+k+'"'));
 }
 assert.match(css,/background:var\(--tone-bg\)!important/);
 assert.match(js,/setCallVisualTone\(d.found\?d.state:'loading'\)/);
 assert.match(js,/function unmount\(\)\{clearCallVisualTone\(\)/);
});
test('LINE wording replaces onsite reception in visitor-facing production features',()=>{
 for(const x of [home,rec])assert.ok(!x.includes('現地受付'));
 assert.match(home,/remainingMarkup\('LINE受付'/);
 assert.match(rec,/LINE受付/);
});
