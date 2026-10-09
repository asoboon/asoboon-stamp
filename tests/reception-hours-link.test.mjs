import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync('miniapp-v2/production/'+file,'utf8');
test('official AirWAIT fallback URL is reused, not invented, and visually secondary',()=>{
  const home=read('home-v38.js'),env=read('env-facility.js'),css=read('home-v38.css');
  assert.match(env,/receptionUrl:'https:\/\/airwait\.jp\/WCSP\/storeDetail\?storeNo=AKR2298124918'/);
  assert.match(home,/OPERATIONAL_FALLBACKS\.receptionUrl/);
  assert.match(home,/url\.hostname==='airwait\.jp'/);
  assert.match(home,/LINEミニアプリ/);
  assert.match(home,/7:00から/);
  assert.match(home,/AirウェイトでWEB受付/);
  assert.match(home,/data-external="1"/);
  assert.match(css,/\.v38-reception-hours/);
  assert.match(css,/font-size:12px/);
});
test('WEB link is included only for open and before states, never as a default replacement for MINI reception',()=>{
  const home=read('home-v38.js');
  assert.match(home,/action\('reception',RECEPTION_FALLBACK_ACTIVE\?'WEB受付を開く':'順番を取る','primary'\)\}\$\{receptionHoursNote\(\)/);
  assert.match(home,/a\.type==='before'\?receptionHoursNote\(\):''/);
  assert.match(home,/target="_blank" rel="noopener noreferrer"/);
});
