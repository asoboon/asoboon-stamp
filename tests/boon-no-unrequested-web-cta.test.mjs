import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load = name => readFileSync(name,'utf8');
const main=load('miniapp-v2/production/boon-mint-v51-preview.js');
const mintCSS=load('miniapp-v2/production/boon-mint-v51-preview.css');
const orangeCSS=load('miniapp-v2/production/boon-mint-v53-passion.css');
const nativeHome=load('miniapp-v2/production/home-v38.js');
const official=load('miniapp-v2/shared/reception.js');

test('Mint Soda does not invent or render a separate WEB reception CTA on HOME',()=>{
 assert.doesNotMatch(main,/boonV5WebReception|boon-v5-web-reception|insertAdjacentElement\('afterend',web\)/);
 assert.doesNotMatch(mintCSS,/boon-v5-web-reception/);
 assert.doesNotMatch(orangeCSS,/boon-v5-web-reception/);
});
test('Official WEB channel and existing operational HOME remain unchanged',()=>{
 assert.match(nativeHome,/v38-airwait-link/);
 assert.match(official,/airwait\.jp\/WCSP\/storeDetail/);
 assert.match(nativeHome,/v38-crowd-channels/);
});
test('No reservation/calling logic is modified by removed HOME link',()=>{
 assert.match(main,/if\(phase==='waiting'&&ahead===0&&!error\)/);
 assert.match(main,/var flag=model\.kind==='calling'/);
 assert.match(main,/kind='no-reservation'/);
});
