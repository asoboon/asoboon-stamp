import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const base='miniapp-v2/production/asoquest/';

test('Production HOME shows exactly one featured Stamp Rally entry to the official six-part game',()=>{
  const home=read('miniapp-v2/production/home-v38.js');
  const matches=home.match(/playLink\('quest','スタンプラリー'/g)||[];
  assert.equal(matches.length,1);
  assert.match(home,/スタンプラリー','館内6か所でパーツを集めよう',assetHref\('asoquest\/'\)/);
  assert.doesNotMatch(home,/index\.html\?stamp=home|館内4か所を探そう|playLink\('stamp'/);
  assert.doesNotMatch(home,/playLink\('quest','ASOQUEST'/);
  const bundled=read('miniapp-v2/production/production-app.js');
  assert.match(bundled,/playLink\('quest','スタンプラリー'/);
  assert.doesNotMatch(bundled,/index\.html\?stamp=home/);
});

test('Old four-stamp QR/bookmarks are retired and point to the six-part game',()=>{
  const index=read('index.html');
  assert.match(index,/if \(spot \|\| showStampHome\)/);
  assert.match(index,/miniapp-v2\/production\/asoquest\//);
  assert.match(index,/target\.searchParams\.set\("legacy", "spot"\)/);
  const retired=read('stamp.html');
  assert.match(retired,/miniapp-v2\/production\/asoquest\//);
  assert.match(retired,/target\.searchParams\.set\("legacy", "spot"\)/);
  const game=read(base+'app.js');
  assert.match(game,/legacy:p\.get\('legacy'\)==='spot'/);
  assert.match(game,/スタンプラリーが新しくなったよ！/);
});

test('Approved ENGINE START keeps all 15 FX assets and all six original car parts',()=>{
  const html=read(base+'index.html');
  const js=read(base+'app.js');
  const css=read(base+'style.css');
  for(const id of ['engine','wheel','headlight','fin','grille','key']) assert.match(js,new RegExp("id:'"+id+"'"));
  const effects=['garage_base.webp','garage_ignition_glow.webp','garage_complete_glow.webp','headlight_left_glow.png','headlight_right_glow.png','afterfire_left_blue.png','afterfire_right_blue.png','afterfire_left_orange.png','afterfire_right_orange.png','exhaust_glow_left.png','exhaust_glow_right.png','floor_reflection_glow.png','complete_aura.png','ignition_flash.png','spark_burst.png'];
  for(const name of effects) {
    assert.ok(statSync(base+'assets/engine-start-fx/'+name).size>0,name);
    assert.ok(html.includes('engine-start-fx/'+name),name+' is referenced by the scene');
  }
  for(const name of ['car_base.webp','wheel_front.webp','wheel_rear.webp','headlight.webp','grille.webp','fin.webp','engine_fx.webp','key_fx.webp','complete_fx.webp'])assert.ok(statSync(base+'assets/'+name).size>0,name);
  assert.match(js,/STORAGE_PREFIX='asoquest:v9:'/);
  assert.match(js,/RESET_HOUR_JST=19/);
  assert.match(js,/phase-blackout/);
  assert.match(js,/phase-reveal/);
  assert.match(js,/FULL POWER/);
  assert.match(html,/スタンプラリー クリア！/);
  assert.match(html,/マシン完成！/);
  assert.match(css,/prefers-reduced-motion/);
});

test('Official facility LIFF and NFC/QR routing remain unchanged',()=>{
  const home=read('home.html');
  const router=read('miniapp-v2/shared/asoquest-deeplink.js');
  const env=read('miniapp-v2/production/env-facility.js');
  assert.match(home,/asoquest-deeplink\.js/);
  assert.match(env,/liffId:'2009884613-ELc6kolf'/);
  assert.match(router,/liff\.state/);
  for(const source of ['nfc','qr']){
    const csv=read(base+(source==='nfc'?'station_urls.csv':'station_urls_qr.csv'));
    for(const id of ['engine','wheel','headlight','fin','grille','key','start'])
      assert.ok(csv.includes('https://miniapp.line.me/2009884613-ELc6kolf/?aq='+id+'&src='+source));
  }
});
