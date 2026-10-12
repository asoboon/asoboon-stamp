import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync('miniapp-v2/production/'+p,'utf8');
test('receipt-first prime uses local receipt and not cached call state',()=>{
 const code=read('home-prime-v13.js');
 assert.match(code,/kind:'pending'/);
 assert.match(code,/businessDate\|\|''/);
 assert.match(code,/ASOBOON_V2_OPERATIONAL_DATE/);
 assert.match(code,/removeItem\('asoboon_v2_home_status_production_v1'\)/);
 assert.doesNotMatch(code,/snap\.status|source:'cache'/);
});
test('Official HOME only provides call-status navigation and no auto polling bundle',()=>{
 const home=read('home-v38.js');
 const manifest=read('bundle-sources.json');
 assert.match(home,/E\.environment==='production'/);
 assert.match(home,/kind:'call-link'/);
 assert.match(home,/呼出状況を確認する/);
 assert.doesNotMatch(manifest,/home-status-v13\.js/);
});

test('new reservations handoff use pending instead of outdated loading status',()=>{
 assert.match(read('home-reservation-handoff-v26.js'),/kind:'pending'/);
 assert.doesNotMatch(read('home-reservation-handoff-v26.js'),/kind:'sync'/);
 assert.match(read('home-reservation-handoff-v26.js'),/ASOBOON_V13_HOME_STATUS\?\.refresh\?\./);
});
