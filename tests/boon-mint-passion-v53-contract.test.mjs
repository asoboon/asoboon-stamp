import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css=readFileSync('miniapp-v2/production/boon-mint-v53-passion.css','utf8');
const loader=readFileSync('miniapp-v2/production/production-shell-loader.js','utf8');
const themeJS=readFileSync('miniapp-v2/production/boon-mint-v51-preview.js','utf8');
const sources=JSON.parse(readFileSync('miniapp-v2/production/bundle-sources.json','utf8'));
const C=(hex)=>{let s=hex.replace('#','');return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4)};
const L=(hex)=>{const v=C(hex);return v[0]*0.2126+v[1]*0.7152+v[2]*0.0722};
const contrast=(a,b)=>(Math.max(L(a),L(b))+0.05)/(Math.min(L(a),L(b))+0.05);

test('Passion Orange is exactly #FF7A00 and mint colors remain preserved',()=>{
 assert.match(css,/--mint-passion:\s*#FF7A00/);
 assert.match(css,/--mint-coral:\s*#FF7A00/);
 assert.match(css,/--mint-orange-spark:\s*#FF7A00/);
 assert.match(css,/--mint-passion-pale:\s*#FFF0DF/);
 assert.match(readFileSync('miniapp-v2/production/boon-mint-v51-preview.css','utf8'),/#28C7BE/);
 assert.match(readFileSync('miniapp-v2/production/boon-mint-v51-preview.css','utf8'),/#E3FFF6/);
});

test('CTA uses dark ink on orange, rather than inaccessible white text',()=>{
 assert.ok(contrast('#492300','#FF7A00')>=4.5,'contrast ratio '+contrast('#492300','#FF7A00').toFixed(2));
 assert.match(css,/color:#492300!important/);
 assert.match(css,/#v38Hero\.open \.v38-action\.primary/);
 assert.match(css,/\.boon-v4-primary:not\(:disabled\)/);
 assert.match(css,/#recSubmit:not\(:disabled\)/);
});

test('Only interactive and success elements receive the new Passion Orange',()=>{
 assert.match(css,/\.rec-slot\.active:not\(\[hidden\]\)/);
 assert.match(css,/button\[data-rec-d="1"\]:not\(:disabled\)/);
 assert.match(css,/#boonV5Team \.boon-v5-team-price/);
 assert.match(css,/\.boon-v5-complete-check/);
 assert.doesNotMatch(css,/\.boon-v4-lamp\.green\s*\{/);
 assert.doesNotMatch(css,/\.boon-v4-go\s*\{/);
 assert.doesNotMatch(css,/\.boon-v4-call-hero\.error\s*\{/);
});

test('Passion CSS loads only behind existing explicit preview query',()=>{
 assert.match(loader,/get\('boonTheme'\)==='mint'/);
 assert.match(loader,/boon-mint-v53-passion\.css\?v=/);
 assert.match(themeJS,/ASOBOON_MINT_V51_PREVIEW!==true/);
 for (const list of [sources.scripts,sources.styles,sources.routeScripts,sources.routeStyles]) {
  assert.equal(list.some(s=>s.includes('boon-mint-v53-passion')),false);
 }
});

test('no operational booking or notification code is changed by new CSS-only layer',()=>{
 assert.doesNotMatch(css,/fetch\s*\(|XMLHttpRequest|localStorage|createReservation/);
 assert.match(themeJS,/if\(phase==='waiting'&&ahead===0&&!error\)/);
 assert.match(themeJS,/var flag=model\.kind==='calling'/);
});
