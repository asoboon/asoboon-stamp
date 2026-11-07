import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base='miniapp-v2/production/';
const sources=JSON.parse(readFileSync(base+'bundle-sources.json','utf8'));
const css=readFileSync(base+'boon-all-pages-mobile-v512.css','utf8');
const experience=readFileSync(base+'experience-v13.css','utf8');
test('v512 styles are last route stylesheet and include all functional views',()=>{
 assert.equal(sources.routeStyles.at(-1),'miniapp-v2/production/boon-all-pages-mobile-v512.css');
 for(const s of ['v7-reception-active','v7-callstatus-active','v7-timeguide-active','v27-first-page','v24-parking-page','v25-entry-page','.v17-pass','.v28-people']) assert.ok(css.includes(s),s);
});
test('v512 compact responsive affordance rules preserve semantics',()=>{
 for(const s of ['--b512-mint:#E3FFF6','--b512-orange:#FF7A00','min-height:44px','min-height:52px',':focus-visible',':active','prefers-reduced-motion','@media(max-width:360px)','@media(max-width:430px)','[role="alert"]','.cs-error','button:disabled']) assert.ok(css.includes(s),s);
});
test('transactional sources remain stylesheet-only additions',()=>{
 assert.ok(sources.routeScripts.every(p=>!p.endsWith('boon-all-pages-mobile-v512.js')));
});
test('generic pv7 routes and v13/v33 regressions are covered',()=>{
 for(const s of ['body.v7-page-active { background:#F3FBF8!important','body.v7-page-active .pv7-page { background:#fff!important','body.v7-page-active .pv7-head { padding:13px 14px 12px','body.v7-page-active .pv7-body { padding:12px','body.v7-page-active .pv7-section+.pv7-section { margin-top:10px','body.v7-page-active .pv7-band { min-height:56px',' .v13-status-meta button { min-height:44px',' .v33-start-panel { padding:10px 11px',' .v33-detail-number { padding:10px',' .cs-page.v33-compact-active #csRefresh { min-height:44px']) assert.ok(css.includes(s.trim()),s);
});
test('native interactive controls receive focus and tap treatment without styling fake clickables',()=>{
 for(const s of [':is(button,a,summary):focus-visible','button:not(:disabled)','a[href]','summary','prefers-reduced-motion']) assert.ok(css.includes(s),s);
 assert.ok(!css.includes('[role="button"]'));
 assert.match(experience,/\.v13-live-dot\.live\{background:#79c18e\}/);
});

test('generic minimum hit target never shrinks larger entry choices',()=>{
 assert.match(css,/body\.v7-page-active :where\(button:not\(:disabled\),a\[href\],summary\)\{min-height:44px;\}/);
 assert.doesNotMatch(css,/body\.v7-page-active button:not\(:disabled\),body\.v7-page-active a\[href\]/);
 assert.match(css,/\.v25-entry-page :where\(button:not\(:disabled\)\)/);
});
