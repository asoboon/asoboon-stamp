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
