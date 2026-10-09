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
test('receipt-first hero shows large cached number separately from verified call states',()=>{
 assert.match(read('home-v38.js'),/kind==='pending'&&receipt/);
 assert.match(read('home-v38.js'),/v38-pending-number/);
 assert.match(read('home-v38.css'),/v38-hero\.pending/);
 assert.match(read('home-v38.css'),/v38-pending-number/);
 assert.match(read('home-status-v13.js'),/if\(!matchesCurrent\(cached,window\.ASOBOON_HOME_STATUS_SNAPSHOT\)\)emit\(provisional\(cached\)\)/);
 assert.doesNotMatch(read('home-status-v13.js'),/emit\(snap\)|saveSnapshot\(/);
});
test('new reservations handoff use pending instead of outdated loading status',()=>{
 assert.match(read('home-reservation-handoff-v26.js'),/kind:'pending'/);
 assert.doesNotMatch(read('home-reservation-handoff-v26.js'),/kind:'sync'/);
 assert.match(read('home-status-v13.js'),/waitForLiff/);
});
