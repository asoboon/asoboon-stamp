import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../miniapp-v2/production/home-v38.js',import.meta.url),'utf8');
const built=readFileSync(new URL('../miniapp-v2/production/production-app.js',import.meta.url),'utf8');
test('HOME publicly warms only the production read gateway',()=>{
 for(const file of ['../home.html']){
  const html=readFileSync(new URL(file,import.meta.url),'utf8');
  assert.match(html,/<link rel="preconnect" href="https:\/\/asoboon-miniapp-v2-production-gateway\.asoboon425\.workers\.dev" crossorigin>/);
 }
});
test('HOME presents an unknown/error state before independent waitTypes check',()=>{
 for(const code of [source,built]){
  const start=code.indexOf('if(!crowdClosed&&(crowdError||!validCrowdSlots().some(');
  assert.notEqual(start,-1);
  const immediate=code.indexOf('renderSlots();',start);
  const fallback=code.indexOf('await m.check(',start);
  const release=code.indexOf('crowdLoading=false;',start);
  assert.ok(start<immediate&&immediate<fallback&&fallback<release,
    'neutral rows shown immediately while fallback runs under the existing request lock');
 }
});
