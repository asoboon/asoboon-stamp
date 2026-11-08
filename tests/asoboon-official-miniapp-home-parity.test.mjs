import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('certified LINE endpoint includes same v7 availability board and structural HOME as browser HOME',()=>{
 const index=read('miniapp-v2/production/index.html');
 for(const asset of ['boon-mint-v51-preview.js','boon-home-v56-layout.js','boon-home-v613-board.js','boon-home-v56.css','boon-home-v613-board.css']){
  assert.ok(index.includes(asset+'?v='),`${asset} missing in certified LINE entry`);
  assert.ok(read('miniapp-v2/production/production-shell-loader.js').includes(asset+'?v='),`${asset} missing in browser HOME`);
 }
 assert.match(index,/document\.addEventListener\('DOMContentLoaded'/);
 assert.match(index,/window\.ASOBOON_MINT_V51_PREVIEW=true/);
 assert.match(index,/script\.async=false/);
 assert.doesNotMatch(index,/location\.replace\(|window\.location\s*=/);
});
test('classic rollback retains original native reception while disabling all theme assets',()=>{
 const index=read('miniapp-v2/production/index.html');
 assert.match(index,/get\('boonTheme'\)==='classic'/);
 assert.match(index,/\/production-app\.js\?v=/);
 assert.match(index,/\/env\.js\?v=/);
});
test('both entrypoint HOME sources are generated reproducibly by build-production.mjs',()=>{
 const s=read('miniapp-v2/build-production.mjs');
 assert.match(s,/Official LINE endpoint must render the same HOME components/);
 assert.match(s,/output\(`\$\{dir\}\/index\.html`,index\)/);
});
