import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');const core=read('miniapp-v2/production/app-stable-v36.js');const nav=read('miniapp-v2/production/choco-mint-nav-v8.js');const css=read('miniapp-v2/production/choco-mint-nav-v8.css');const hubs=read('miniapp-v2/production/choco-mint-hubs-v8.js');const hubCss=read('miniapp-v2/production/choco-mint-hubs-v8.css');const bundle=JSON.parse(read('miniapp-v2/production/bundle-sources.json'));
test('Navigation exists as standalone, nonblocking assets in both certified and browser entrypoints',()=>{
 const built=read('miniapp-v2/production/index.html'),loader=read('miniapp-v2/production/production-shell-loader.js');
 for(const name of ['choco-mint-nav-v8.js','choco-mint-nav-v8.css']){assert.match(built,new RegExp(name));assert.match(loader,new RegExp(name))}
 assert(!bundle.scripts.some(s=>s.includes('choco-mint-nav')));assert(!bundle.styles.some(s=>s.includes('choco-mint-nav')));
 assert(bundle.routeScripts.some(s=>s.includes('choco-mint-hubs-v8.js')));
 assert(bundle.routeStyles.some(s=>s.includes('choco-mint-hubs-v8.css')));
});
test('Four functional tabs and parent-back routing are present',()=>{
 assert.match(core,/EXTRA_VIEWS=\['guide','play','faq'\]/);
 for(const route of ['home','callstatus','guide','play'])assert(nav.includes(`'${route}'`));
 for(const route of ['first','entry','rules','timeguide','parking','faq'])assert(nav.includes(`'${route}'`));
 assert.match(nav,/asoboon:v2-route-rendered/);assert.match(nav,/asoboon:language-changed/);assert.match(nav,/window\.ASOBOON_CHOCOMINT_BACK=backView/);
 assert.match(core,/window\.ASOBOON_CHOCOMINT_BACK/);assert.match(core,/window\.ASOBOON_CHOCOMINT_HUBS/);
});
test('New navigation labels support seven real languages and accessible touch targets',()=>{
 for(const locale of ['ja','en','zh-CN','vi','ne','ko','kmr'])assert(nav.includes(locale));
 assert.match(css,/min-height:56px/);assert.match(css,/grid-template-columns:repeat\(4/);
 assert.match(css,/focus-visible/);assert.match(css,/prefers-reduced-motion/);
 for(const color of ['#6DD2CA','#3A231D','#FFF9F0','#DDF8F0','#2F8E74','#E8D8C6'])assert(css.includes(color));
});
test('Guide, FAQ, GameHub retain nondead-end links and no staged game routes',()=>{
 for(const route of ["'timeguide'","'first'","'rules'","'parking'","'entry'","'faq'","'guide'"])assert(hubs.includes(route));
 for(const path of ['miniapp-v2/production/asoquest/','boonrun/','boonjump/','miniapp-v2/production/business-calendar.html','miniapp-v2/production/event-calendar.html']){assert(hubs.includes(path),path);assert(existsSync(path.endsWith('/')?path+'index.html':path),path)}
 assert(!hubs.includes('asoquest-v7/'));
 assert(!hubs.includes('BOON MONSTER'));
 assert(hubs.includes('BOON パズル'));
 assert(hubs.includes('https://asoboon.github.io/asoboon-3d/boon-block-next/?v=23'));
 assert(hubs.includes('target="_blank"'));assert(hubs.includes('data-external="1"'));
 assert.match(hubCss,/cm-hub-row/);assert.match(hubCss,/cm-faq/);
});
test('Navigation modules do not mutate reception, cancellation, user state, or AirWAIT',()=>{
 for(const src of [nav,hubs]){
  for(const forbidden of [/fetch\(/,/XMLHttpRequest/,/localStorage\.removeItem/,/localStorage\.clear/,/cancelReservation/,/createReservation/,/sendServiceMessage/,/navigator\.sendBeacon/])assert(!forbidden.test(src),String(forbidden));
 }
});
test('Figma mint shell remains independent of operational API and prevents view flicker',()=>{
 for(const token of ['--cm-paper:#FFFFFC','--cm-pale:#F7F3EA','--cm-mint-ice:#9ADBC0'])assert(css.includes(token));
 assert(css.includes('body #app .view.active{animation:none!important;opacity:1!important'));
 for(const state of ['v38-home-active','v7-reception-active','v7-callstatus-active','v7-page-active'])assert(css.includes(state));
 assert(css.includes('.v38-action.primary:not(:disabled)'));
});
test('Call-status semantic waiting/calling/canceled colors are not overridden by theme',()=>{
 assert(css.includes('body.v7-callstatus-active #app .cs-page{border-color:var(--cm-line)!important}'));
 assert(!css.includes('body.v7-callstatus-active #app .cs-page,html'));
});

