import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');
const build=read('miniapp-v2/build-production.mjs');
const loader=read('miniapp-v2/production/production-shell-loader.js');
const js=read('miniapp-v2/production/boon-mint-v51-preview.js');
const css=read('miniapp-v2/production/boon-mint-v51-preview.css');
const home=read('home.html');
const sources=JSON.parse(read('miniapp-v2/production/bundle-sources.json'));

test('Mint Soda v5.4 loads normally; classic query is a reversible opt-out',()=>{
 assert.match(loader,/new URLSearchParams\(location.search\)\.get\('boonTheme'\)!=='classic'/);
 assert.match(loader,/ASOBOON_MINT_V51_PREVIEW=true/);
 assert.match(js,/ASOBOON_MINT_V51_PREVIEW!==true/);
 assert.match(loader,/boon-mint-v51-preview\.css\?v=/);
 assert.match(loader,/boon-mint-v51-preview\.js\?v=/);
 assert.doesNotMatch(home, /boon-mint-v51-preview\.(css|js)/);
 assert.doesNotMatch(read('miniapp-v2/production/index.html'),/boon-mint-v51-preview\.(css|js)/);
});
test('Production default bundle remains lean and unchanged by optional assets',()=>{
 assert.ok(!sources.styles.some(x=>x.includes('boon-mint')));
 assert.ok(!sources.scripts.some(x=>x.includes('boon-mint')));
 assert.ok(!sources.routeScripts.some(x=>x.includes('boon-mint')));
 assert.ok(!sources.routeStyles.some(x=>x.includes('boon-mint')));
 assert.doesNotMatch(read('miniapp-v2/production/production-app.js'),/BOON START Mint Soda v5\.1/);
 assert.doesNotMatch(read('miniapp-v2/production/production-app.css'),/BOON START Mint Soda v5\.1/);
});
test('All three user-selected palette colors are preserved',()=>{
 assert.match(css,/#28C7BE/);
 assert.match(css,/#E3FFF6/);
 assert.match(css,/#F26F4C/);
});
test('The bridge neither creates AirWAIT bookings nor changes operational rules',()=>{
 assert.doesNotMatch(js,/\bfetch\s*\(/);
 assert.doesNotMatch(js,/\bXMLHttpRequest\b/);
 assert.doesNotMatch(js,/\/createReservation\b/);
 assert.match(js,/kind==='calling'\?5/);
 assert.match(js,/if\(phase==='waiting'&&ahead===0&&!error\)/);
 assert.match(js,/if\(error\)kind='error'/);
});
test('Existing booking, status, Worker and notification sources stay in the original bundle',()=>{
 for(const x of [
 'miniapp-v2/shared/reception.js',
 'miniapp-v2/shared/callstatus.js',
 'miniapp-v2/shared/call-forecast.js'
 ])assert.ok(sources.routeScripts.includes(x),x);
 assert.match(build,/const routeLoader/);
});
test('No changes to the official production gateway or LIFF identity are needed',()=>{
 const env=read('miniapp-v2/production/env-facility.js');
 assert.match(env,/2009884613-ELc6kolf/);
 assert.match(env,/asoboon-miniapp-v2-production-gateway/);
 assert.doesNotMatch(js,/apiKey|channelSecret|CREATE_ENABLED|LINE_CHANNEL_SECRET/);
});
