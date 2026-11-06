'use strict';
// Independent safety guard: no preview query => no Mint asset requests or active theme.
// All external hosts are mocked/blocked so this test cannot touch production APIs.
const { chromium } = require('playwright');
const assert=require('node:assert/strict');
const HOME_URL='http://127.0.0.1:4178/home.html';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const requests=[];
  page.on('request',req=>requests.push(req.url()));
  await page.route('https://static.line-scdn.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.liff={init:()=>Promise.resolve(),isInClient:()=>false,isLoggedIn:()=>false,getOS:()=> "ios"};'}));
  await page.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort();});
  await page.goto(HOME_URL,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1200);
  const state=await page.evaluate(()=>({flag:window.ASOBOON_MINT_V51_PREVIEW===true,theme:document.documentElement.classList.contains('boon-v5-mint')}));
  assert.equal(state.flag,false);
  assert.equal(state.theme,false);
  assert.equal(requests.filter(x=>x.includes('boon-mint-v51-preview')).length,0);
  console.log('PRODUCTION_DEFAULT_THEME_OFF: OK',JSON.stringify({requests:requests.length,flag:state.flag,theme:state.theme}));
  await page.close();
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
