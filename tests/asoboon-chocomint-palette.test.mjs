import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PALETTE=[
 '#251C1A','#392824','#563B32','#785548','#A57D69','#C9AC99',
 '#E5D6C9','#F7EFE5','#FFF9F1','#FFFFFF','#163D3A','#166D66',
 '#1C8D89','#2BAEAA','#67CEBB','#9BE6D3','#D2F3E7','#EBFFF6'
];
const VALID=new Set(PALETTE.map(x=>x.toLowerCase()));
const roots=['miniapp-v2/production','miniapp-v2/shared'];
function files(root){
 let out=[];
 for(const entry of fs.readdirSync(root,{withFileTypes:true})){
   const name=path.join(root,entry.name);
   if(entry.isDirectory())out.push(...files(name));
   else if(/\.(css|js|html)$/.test(name))out.push(name);
 }
 return out;
}
const colorHex=/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![a-zA-Z0-9_-])/g;
function normalized(raw){
 let x=raw.slice(1);
 if(x.length===3||x.length===4)x=x.split('').map(y=>y+y).join('');
 return '#'+x.slice(0,6).toLowerCase();
}
const rgb=/\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[0-9.]+\s*)?\)/ig;
function hexOf(r,g,b){
 return '#'+[r,g,b].map(n=>Number(n).toString(16).padStart(2,'0')).join('');
}
test('All production/shared/root HOME source UI color literals, including games and independent calendars, use only the chocolate-mint ice cream palette',()=>{
 const outliers=[];
 let checked=0;
 for(const file of [...roots.flatMap(files),'home.html']){
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(colorHex)){
   checked++;
   const color=normalized(match[0]);
   if(!VALID.has(color))outliers.push(file+':hex:'+match[0]);
  }
  for(const match of source.matchAll(rgb)){
   checked++;
   const color=hexOf(...match.slice(1,4));
   if(!VALID.has(color))outliers.push(file+':rgb:'+match[0]);
  }
 }
 assert.ok(checked>=3500,'palette scan should cover all production and game routes');
 assert.deepEqual(outliers,[],'No nonpalette color literals allowed on production screens');
});
test('Legacy passion-orange overlay is not loaded by either production app entry',()=>{
 const loader=fs.readFileSync('miniapp-v2/production/production-shell-loader.js','utf8');
 const builder=fs.readFileSync('miniapp-v2/build-production.mjs','utf8');
 assert.doesNotMatch(loader,/passion\.href|boon-mint-v53-passion\.css/);
 assert.doesNotMatch(builder,/passion\.href|boon-mint-v53-passion\.css/);
});


test('Rich cocoa/mint presentation is loaded last on both certified production entry points',()=>{
 const home=fs.readFileSync('home.html','utf8');
 const index=fs.readFileSync('miniapp-v2/production/index.html','utf8');
 const builder=fs.readFileSync('miniapp-v2/build-production.mjs','utf8');
 const rich=fs.readFileSync('miniapp-v2/production/choco-mint-rich-v12.css','utf8');
 assert.match(home, /<link rel="stylesheet" href="\.\/miniapp-v2\/production\/choco-mint-rich-v12\.css\?v=20261113-lang02">/);
 assert.match(index, /<link rel="stylesheet" href="\.\/choco-mint-rich-v12\.css\?v=20261113-lang02">/);
 assert.match(builder, /choco-mint-rich-v12\.css\?v=20261113-lang02/);
 for(const color of ['#251C1A','#392824','#2BAEAA','#67CEBB']){
  assert.ok(rich.split(color).length>5,'Expected prominent, repeated rich visual surfaces: '+color);
 }
 assert.match(rich,/\.v58-flow>\.v58-day/);
 assert.match(rich,/#v613Board/);
 assert.match(rich,/\.cm-bottom-nav/);
 assert.match(rich,/\.cm-hub-head/);
 assert.match(rich,/\.rec-submit/);
 assert.doesNotMatch(rich,/#(?:F26F4C|FF7A00|FF8C00)/i);
});


test('Cocoa text on strongest mint CTA surface maintains normal-size WCAG AA contrast',()=>{
 const luminance=h=>{
  const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
  const v=c.map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
  return v[0]*0.2126+v[1]*0.7152+v[2]*0.0722;
 };
 const a=luminance('#251C1A'),b=luminance('#2BAEAA');
 const contrast=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
 assert.ok(contrast>=4.5,'Normal-size CTA labels require at least 4.5:1 contrast');
});


test('Rich treatment protects verified call colors and chocolate chip header/footer',()=>{
 const rich=fs.readFileSync('miniapp-v2/production/choco-mint-rich-v12.css','utf8');
 assert.match(rich,/body\[data-environment="production"\]:not\(\.v7-callstatus-active\)/);
 assert.match(rich,/\.cm-bottom-nav\{[\s\S]*?radial-gradient/);
 assert.match(rich,/\.topbar \.brand\{[\s\S]*?linear-gradient/);
});


test('All critical live-status HOME headings are cream on high-contrast chocolate',()=>{
 const rich=fs.readFileSync('miniapp-v2/production/choco-mint-rich-v12.css','utf8');
 assert.match(rich,/\.v58-primary\{\s*background:linear-gradient\(115deg,#251C1A,#392824\)/);
 for(const name of ['v58-next-title','v58-next-summary','v58-phase-text']){
  assert.ok(rich.includes('.'+name),'Missing contrast override for live status '+name);
 }
 const lum=h=>{
  const rgb=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
  const v=rgb.map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
  return v[0]*.2126+v[1]*.7152+v[2]*.0722;
 };
 for(const bg of ['#251C1A','#392824']){
  const a=lum(bg),b=lum('#FFF9F1');
  assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=7,'Critical live state copy should have AAA contrast on '+bg);
 }
});


test('Live-verified chocolate ribbon and loading-skeleton fix are present in official CSS',()=>{
 const rich=fs.readFileSync('miniapp-v2/production/choco-mint-rich-v12.css','utf8');
 for(const selector of ['#v58Flow > #v58DayZone','data-state="loading"','#v38Today > span:last-of-type strong','.cm-hub-row:nth-child(even)','button:nth-child(2)']){
  assert.ok(rich.includes(selector),'Missing reviewed visual selector '+selector);
 }
});


test('Parking arrival routes share cocoa unselected state and mint is reserved for actual selection',()=>{
 const rich=fs.readFileSync('miniapp-v2/production/choco-mint-rich-v12.css','utf8');
 for(const n of ['nth-child(1):not([aria-pressed="true"])','nth-child(2):not([aria-pressed="true"])','button.is-selected[aria-pressed="true"]']){
  assert.ok(rich.includes(n),'Missing parking selection affordance rule '+n);
 }
 assert.match(rich,/button\.is-selected\[aria-pressed="true"\]\{\s*background:linear-gradient\(125deg,#9BE6D3,#2BAEAA\)/);
});


test('Live LINE reception heading uses cocoa, not a washed-out pale orange legacy surface',()=>{
 const rich=fs.readFileSync('miniapp-v2/production/choco-mint-rich-v12.css','utf8');
 assert.match(rich,/body\.v7-reception-active:not\(\.v7-callstatus-active\)/);
 assert.match(rich,/\.page-head\.orange\{\s*background:radial-gradient/);
 assert.match(rich,/\.page-head\.orange :is\(small,h2,\.rv7-head-note\)/);
 assert.match(rich,/border-bottom:4px solid #67CEBB!important/);
});


test('Discoverable seven-language native picker is linked on both production entrypoints',()=>{
 const home=fs.readFileSync('home.html','utf8');
 const index=fs.readFileSync('miniapp-v2/production/index.html','utf8');
 const builder=fs.readFileSync('miniapp-v2/build-production.mjs','utf8');
 const picker=fs.readFileSync('miniapp-v2/production/language-switch-ux-v1.js','utf8');
 const rich=fs.readFileSync('miniapp-v2/production/choco-mint-rich-v12.css','utf8');
 for(const source of [home,index,builder]){
  assert.match(source,/language-switch-ux-v1\.js\?v=20261113-02/);
  assert.match(source,/choco-mint-rich-v12\.css\?v=20261113-lang02/);
 }
 for(const code of ['ja','zh-CN','vi','en','ne','ko','kmr'])assert.ok(picker.includes(code),'No picker name for '+code);
 assert.ok(picker.includes('Kurmancî / Kurdish (Kurmanji)'));
 assert.ok(picker.includes('🌐 Language'));
 assert.match(rich,/#asoboon-language-bar label\{/);
 assert.match(rich,/#asoboon-language-select\{/);
});


test('Multilingual fallback note does not cover operating-hours cards',()=>{
 const js=fs.readFileSync('miniapp-v2/production/language-switch-ux-v1.js','utf8');
 const rich=fs.readFileSync('miniapp-v2/production/choco-mint-rich-v12.css','utf8');
 assert.match(js,/asoboon-language-note-shown/);
 assert.match(js,/--asoboon-language-note-height/);
 assert.match(rich,/body\.asoboon-language-note-shown #app \.topbar/);
});
