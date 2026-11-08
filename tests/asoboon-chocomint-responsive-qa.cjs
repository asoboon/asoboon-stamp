'use strict';
const fs=require('fs');
const path=require('path');
const { chromium }=require('playwright');
const root=path.resolve(__dirname,'..');
const out=process.env.ASOBOON_QA_OUT||'/tmp/asoboon-chocomint-qa';
const screenshots=path.join(out,'screenshots-integration-20261108');
fs.mkdirSync(screenshots,{recursive:true});
const base='https://asoboon.github.io/asoboon-stamp';
const rows=[], anomalies=[], errors=[];

function sleep(t){return new Promise(r=>setTimeout(r,t))}

async function testWidth(browser,width){
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
 page.on('pageerror',err=>errors.push({width,message:err.message.slice(0,240)}));
 await page.addInitScript(()=>{
  window.liff={init:()=>Promise.resolve(),isInClient:()=>false,isLoggedIn:()=>false,getOS:()=> 'ios',getLanguage:()=> 'ja',getProfile:()=>Promise.resolve({displayName:'QA'})};
 });
 await page.route('**/*',async route=>{
  const url=route.request().url();
  if(url.startsWith(base+'/')){
   const pathname=decodeURIComponent(new URL(url).pathname).slice('/asoboon-stamp/'.length);
   const f=path.resolve(root,pathname);
   if(!f.startsWith(root+path.sep))return route.abort();
   try{const ext=path.extname(f);const contentType=ext==='.js'?'application/javascript':ext==='.css'?'text/css':ext==='.svg'?'image/svg+xml':ext==='.json'?'application/json':ext==='.html'?'text/html':ext==='.png'?'image/png':'application/octet-stream';return route.fulfill({status:200,contentType,body:fs.readFileSync(f)});}catch{return route.fulfill({status:404,body:'not found'});} 
  }
  if(url.includes('static.line-scdn.net'))return route.fulfill({status:200,contentType:'text/javascript',body:'window.liff=window.liff||{};'});
  return route.abort();
 });
 const expected=[['home','ホーム'],['callstatus','呼出'],['guide','ご利用案内'],['play','あそび']];
 try{
  await page.goto(base+'/home.html',{waitUntil:'domcontentloaded',timeout:16000});
  await page.waitForTimeout(1100);
  for(const [view,label] of expected){
   const tab=page.locator('.cm-nav-tab[data-v7-view="'+view+'"]');
   if(await tab.count()===0)throw Error('MISSING_NAV '+view);
   if(view!=='home'){await tab.click({timeout:6000});await page.waitForTimeout(700)}
   const actual=new URL(page.url()).searchParams.get('view')||'home';
   const result=await page.evaluate(()=>{
    const app=document.querySelector('#app'),nav=document.querySelector('.cm-bottom-nav');
    const box=nav?.getBoundingClientRect();
    const label=nav?.getAttribute('aria-label');
    return {bodyLen:(app?.innerText||'').length,navCount:nav?.querySelectorAll('.cm-nav-tab').length||0,
     navVisible:!!box&&box.width>0&&box.height>0, navAria:label||null,
     loading:(app?.innerText||'').includes('ASOBooNを読み込み中…'),
     scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
     navBottom:box?Math.round(window.innerHeight-box.bottom):null};
   });
   const file=path.join(screenshots,width+'-'+view+'.png');
   await page.screenshot({path:file,fullPage:true,timeout:10000});
   const pass=actual===view&&result.navCount===4&&result.navVisible&&!result.loading&&result.bodyLen>60&&result.scrollWidth<=width+2;
   const row={width,view,label,actual,pass,...result,screenshot:file};
   rows.push(row);
   if(!pass)anomalies.push(row);
  }
 }catch(err){anomalies.push({width,error:err.message.slice(0,600),url:page.url()})}
 finally{await page.close()}
}
(async()=>{
 let browser=null;
 try{
  browser=await chromium.launch({
   ...(process.env.ASOBOON_CHROME_EXECUTABLE?{executablePath:process.env.ASOBOON_CHROME_EXECUTABLE}:{}),
   headless:true,args:['--no-sandbox','--disable-gpu']
  });
  for(const width of [320,375,390,430,768])await testWidth(browser,width);
 }catch(err){anomalies.push({fatal:err.stack.slice(0,1200)})}
 finally{
  try{await browser?.close()}catch{}
  const result={date:new Date().toISOString(),git:process.env.ASOBOON_QA_SHA||'unverified-local',cases:rows.length,passes:rows.filter(x=>x.pass).length,
   failures:anomalies.length,anomalies,errors,rows,externalNetwork:'blocked'};
  fs.writeFileSync(path.join(out,'INTEGRATION_BROWSER_QA.json'),JSON.stringify(result,null,2));
  console.log('QA_RESULTS',JSON.stringify({cases:result.cases,passes:result.passes,failures:result.failures,errors:errors.length,anomalies:anomalies.slice(0,6)}));
  if(anomalies.length||!rows.length)process.exitCode=2;
 }
})();