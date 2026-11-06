import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(p)=>readFileSync(p,'utf8');
const vote=source('miniapp-v2/production/surprise-vote-home-v1.js');
const loader=source('miniapp-v2/production/production-shell-loader.js');
const css=source('miniapp-v2/production/boon-mint-v53-passion.css');
const build=source('miniapp-v2/build-production.mjs');
test('HOME surprise entry remains present but permanently hidden until operator re-enables it',()=>{
 assert.match(vote,/const SHOW_HOME_ENTRY=false/);
 assert.match(vote,/if\(!root\|\|!SHOW_HOME_ENTRY\)return/);
 assert.match(source('miniapp-v2/production/home-v38.js'),/v38Surprise/);
});
test('Only HOME vote component is disabled; direct vote app and its backend remain untouched',()=>{
 assert.match(vote,/function render\(data\)/);
 assert.match(vote,/surpriseVotePublicStatus/);
 assert.match(source('miniapp-v2/production/surprise-vote.js'),/surprise/);
});
test('Default production theme is Mint Soda v5.4 and classic rollback is explicit',()=>{
 assert.match(loader,/get\('boonTheme'\)!=='classic'/);
 assert.match(loader,/boon-mint-v53-passion.css/);
 assert.match(css,/#FF7A00/);
});
test('Official AirWAIT business rules remain in shared code, not modified by theme',()=>{
 const themes=source('miniapp-v2/production/boon-mint-v51-preview.js')+css;
 assert.doesNotMatch(themes,/\bfetch\s*\(/);
 assert.match(themes,/if\(phase==='waiting'&&ahead===0&&!error\)/);
 assert.match(themes,/var flag=model.kind==='calling'/);
 assert.match(build,/initialBytes>140000\|\|initialGzipBytes>40000/);
});
