'use strict';
// Release guard: Mint is the normal UI, while ?boonTheme=classic restores the old UI.
// All external hosts are mocked/blocked so this test cannot touch production APIs.
const { chromium } = require('playwright');
const assert=require('node:assert/strict');
const HOME_URL='http://127.0.0.1:4182/home.html';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  for(const classic of [false,true]){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const requests=[];
  page.on('request',req=>requests.push(req.url()));
  await page.route('https://static.line-scdn.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.liff={init:()=>Promise.resolve(),isInClient:()=>false,isLoggedIn:()=>false,getOS:()=> "ios"};'}));
  await page.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort();});
  await page.goto(HOME_URL+(classic?'?boonTheme=classic':''),{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1200);
  const state=await page.evaluate(()=>({flag:window.ASOBOON_MINT_V51_PREVIEW===true,theme:document.documentElement.classList.contains('boon-v5-mint')}));
  assert.equal(state.flag,!classic);
  assert.equal(state.theme,!classic);
  const themeRequests=requests.filter(x=>x.includes('boon-mint-v51-preview')||x.includes('boon-mint-v53-passion'));
  assert.equal(themeRequests.length, classic?0:3);
  const hidden=await page.evaluate(()=>{const x=document.querySelector('#v38Surprise');return !x||x.hidden||getComputedStyle(x).display==='none'});
  assert.equal(hidden,true,'HOME surprise vote entry must remain hidden');
  assert.equal(requests.filter(x=>x.includes('surpriseVotePublicStatus')).length,0,'No vote status polling');
  console.log(classic?'PRODUCTION_CLASSIC_ROLLBACK_OK':'PRODUCTION_DEFAULT_MINT_ON_OK',JSON.stringify({requests:requests.length,themeRequests:themeRequests.length,flag:state.flag,theme:state.theme,hidden}));
  await page.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
