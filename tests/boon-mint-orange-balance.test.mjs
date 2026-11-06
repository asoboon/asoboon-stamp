import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync('miniapp-v2/production/boon-mint-v51-preview.css','utf8');
const js=readFileSync('miniapp-v2/production/boon-mint-v51-preview.js','utf8');
const sources=JSON.parse(readFileSync('miniapp-v2/production/bundle-sources.json','utf8'));

test('adopted Mint Soda triad remains unchanged, optional orange is supplemental',()=>{
 for(const hex of ['#28C7BE','#E3FFF6','#F26F4C'])assert.ok(css.includes(hex),hex);
 assert.match(css,/--mint-orange-spark:#FFA83F/);
 assert.match(css,/--mint-orange-soft:#FFF1E6/);
});
test('orange accents are attached to active affordances, never to disabled or inactive reception',()=>{
 assert.match(css,/#recSlots \.rec-slot\.active:not\(\[hidden\]\)/);
 assert.match(css, /button\[data-rec-d="1"\]:not\(:disabled\)/);
 assert.doesNotMatch(css,/\.rec-stepper button:disabled\s*\{[^}]*#F26F4C/s);
});
test('warm registration success does not replace official calling GO',()=>{
 assert.match(css,/boon-v5-complete-check/);
 assert.match(css,/background:#F26F4C!important/);
 assert.match(css,/boon-v4-call-hero\.calling/);
 assert.match(js,/var flag=model\.kind==='calling'/);
 assert.match(js,/if\(phase==='waiting'&&ahead===0&&!error\)/);
});
test('HOME orange treatment does not modify the crowd or waiting status source code',()=>{
 assert.match(css,/v38-home-active .*#v38Hero\.open::after/);
 assert.match(css,/v38-home-active .*\.v38-play/);
 assert.ok(!sources.styles.includes('miniapp-v2/production/boon-mint-v51-preview.css'));
 assert.ok(!sources.scripts.includes('miniapp-v2/production/boon-mint-v51-preview.js'));
});
test('the optional preview gate remains off unless expressly requested',()=>{
 const loader=readFileSync('miniapp-v2/production/production-shell-loader.js','utf8');
 assert.match(loader,/get\('boonTheme'\)!=='classic'/);
 assert.match(js,/ASOBOON_MINT_V51_PREVIEW!==true/);
});
