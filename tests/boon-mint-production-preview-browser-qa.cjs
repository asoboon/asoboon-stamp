/* BOON START v5 Mint Soda development-only visual and state regression.
 * All LINE/AirWAIT calls are intercepted. Creates NO real reservation.
 * Run: NODE_PATH=/path/to/node_modules node tests/boon-start-v4-browser-qa.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const ROOT=process.cwd();
const OUT=path.join(ROOT,'docs/boon-mint-production-preview/qa');
const BASE='http://127.0.0.1:4178/home.html';
const FIXED='2026-11-07T03:00:00.000Z'; // Sat noon JST; not a real booking.
const WAIT=[
 {waitTypeId:'0029',waitTypeName:'10時25分頃入場【土休日特定日】',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
 {waitTypeId:'0031',waitTypeName:'12時50分頃入場【土休日特定日】',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
 {waitTypeId:'0033',waitTypeName:'15時15分頃入場時間【土休日特定日】',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
 {waitTypeId:'0042',waitTypeName:'入場不可テスト',dispFlg:false,usageDispType:'KeySTORE_RECEPTION_ONLY'}
];
const stateResult=(state,ahead=5)=>({ok:true,found:true,state,receiptNo:'QA-123',businessDate:'2026-11-07',
 waitTypeId:'0029',waitTypeName:'LINE当日受付（テスト）',queueScope:'combined-web-line',aheadCount:ahead,
 queueRank:ahead+1,activeCount:25,checkedAt:Date.parse(FIXED)});
function labels(){
 return [
 ['01','home'],['02','slots'],['03','people'],['04','confirm'],['05','processing'],['06','complete'],
 ['07','waiting'],['08','waiting0'],['09','near'],['10','calling'],['11','done'],['12','hold'],
 ['13','cancel-confirm'],['14','canceled'],['15','closed'],['16','comm-error'],['17','ambiguous']
 ];
}
async function install(page,kind){
 await page.addInitScript(({when,kind})=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{
   configurable:true,
   get(){return this.__productionTestEnv;},
   set(value){this.__productionTestEnv=Object.freeze({...value,
    assetBase:'http://127.0.0.1:4178/miniapp-v2/production/',
    siteBase:'http://127.0.0.1:4178/',
    endpoint:'http://127.0.0.1:4178/home.html'
   });}
  });
  const NativeDate=Date, fixed=NativeDate.parse(when);
  window.Date=class extends NativeDate{
   constructor(...args){super(...(args.length?args:[fixed]));}
   static now(){return fixed;}
  };
  const storage={
   sessionToken:'qa-session-token-not-real-12345678901234567890',
   businessDate:'2026-11-07',receiptNo:'QA-123',waitTypeId:'0029',
   expiresAt:fixed+3600000,cachedAt:fixed
  };
  if(['waiting','waiting0','near','calling','done','hold','cancel-confirm','canceled','closed','comm-error'].includes(kind)){
  localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify(storage));
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',
   JSON.stringify({receiptNo:'QA-123',businessDate:'2026-11-07',waitTypeId:'0029',
    waitTypeLabel:'土日祝日 LINE当日受付',adults:1,paidChildren:1,infants:0,cachedAt:fixed}));
 }
 },{when:FIXED,kind});
 await page.route('https://static.line-scdn.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:
  "window.liff={init:()=>Promise.resolve(),isInClient:()=>true,isLoggedIn:()=>true,getAccessToken:()=> 'qa-access-token-test-12345678901234567890',getProfile:()=>Promise.resolve({displayName:'QA'}),openWindow:()=>{},getOS:()=> 'ios'};"}));
 await page.route('https://asoboon-miniapp-v2-production-gateway.asoboon425.workers.dev/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  const post=new URLSearchParams(req.postData()||'');
  const action=url.searchParams.get('action')||post.get('action')||'';
  let payload={ok:false,error:'QA_ONLY_NO_REAL_BACKEND'};
  if(action==='health')payload={ok:true,createEnabled:true,officialDevelopEnabled:true,createRequiresVerifiedLiff:true};
  if(action==='waitTypes')payload={ok:true,waitTypes:WAIT};
  if(action==='businessDay')payload={ok:true,operationalDate:'2026-11-07',businessType:'土日祝日',isClosed:false,closingTime:'18:00',durationLabel:'2時間30分'};
  if(action==='crowdRemaining')payload={ok:true,stale:false,observedDetails:[],verifiedFresh:true};
  if(action==='reservationStatus'){
   const data=kind==='waiting0'?stateResult('waiting',0):
    kind==='near'?stateResult('waiting',1):
    kind==='calling'?stateResult('calling',0):
    kind==='hold'?stateResult('hold',5):
    kind==='done'?stateResult('done',0):
    kind==='canceled'?stateResult('canceled',0):
    kind==='closed'?stateResult('closed',0):stateResult('waiting',5);
   if(kind==='comm-error')return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"MOCK_CONNECTION_LOSS"}'});
   payload=data;
  }
  if(action==='recoverReservationSession')payload={ok:true,found:true,sessionToken:'qa-session-token-not-real-12345678901234567890',receiptNo:'QA-123',businessDate:'2026-11-07',waitTypeId:'0029',expiresAt:Date.parse(FIXED)+3600000};
  if(action==='createReservation')payload={ok:false,error:'QA_INTERCEPT_NO_SEND'};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
 });
 // No external analytics, web navigation or actual posts are allowed in QA.
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='127.0.0.1'||u.hostname==='localhost')return route.fallback();
  if(['static.line-scdn.net','asoboon-miniapp-v2-production-gateway.asoboon425.workers.dev'].includes(u.hostname))return route.fallback();
  return route.abort();
 });
}
async function openKind(page,kind){
 let route='home';
 if(['slots','people','confirm','processing','complete','ambiguous'].includes(kind))route='reception';
 if(['waiting','waiting0','near','calling','done','hold','cancel-confirm','canceled','closed','comm-error'].includes(kind))route='callstatus';
 await page.goto(BASE+'?boonTheme=mint&view='+route,{waitUntil:'domcontentloaded'});
 if(route==='home'){await page.locator('.v38-home, .v37-home, .v35-home').first().waitFor({timeout:15000});}
 if(route==='reception'){
  await page.locator('#boonV4Progress').waitFor({timeout:15000});
  if(kind!=='slots'){
   const slots=page.locator('#recSlots [data-rec-slot]');
   await slots.first().waitFor({timeout:12000});
   await slots.first().click();
   await page.waitForFunction(()=>{const b=document.querySelector('#boonV4Continue');return b&&!b.disabled;},{timeout:6000});
   await page.locator('#boonV4Continue').click();
   await page.waitForFunction(()=>document.querySelector('.boon-v4-reception')?.dataset.boonStage==='2',{timeout:6000});
  }
  if(kind==='people'){
   const before=await page.locator('#recPrice').textContent();
   await page.locator('[data-rec-k="child"][data-rec-d="1"]').first().click();
   await page.waitForFunction(()=>document.querySelector('#recChild')?.textContent==='1',{timeout:6000});
   await page.waitForFunction(()=>document.querySelector('#boonV5TeamPrice')?.textContent===document.querySelector('#recPrice')?.textContent,{timeout:6000});
   const after=await page.locator('#recPrice').textContent();
   if(before===after)throw Error('Child stepper did not update the official calculator');
  }
  if(['confirm','processing','complete','ambiguous'].includes(kind)){
   const more=page.locator('[data-rec-k="child"][data-rec-d="1"]');
   if(await more.count())await more.first().click();
   await page.waitForFunction(()=>{const b=document.querySelector('#boonV4Continue');return b&&!b.disabled;},{timeout:6000});
   await page.locator('#boonV4Continue').click();
   await page.waitForFunction(()=>document.querySelector('.boon-v4-reception')?.dataset.boonStage==='3',{timeout:6000});
  }
  if(kind==='processing')await page.evaluate(()=>{$('recProcessing').hidden=false;function $(id){return document.getElementById(id);}});
  if(kind==='complete')await page.evaluate(()=>{
   const r=document.getElementById('recResult');r.hidden=false;r.innerHTML='<div class="rec-result"><strong>QA-123</strong><span>受付番号 / 受付が完了しました</span></div>';
  });
  if(kind==='ambiguous')await page.evaluate(()=>{
   const r=document.getElementById('recResult');r.hidden=false;r.innerHTML='<div class="rec-lock"><strong>受付結果を確認しています</strong><p>新しい受付を作らず、同じ受付結果を再確認してください。</p><button type="button" data-rec-check-result>同じ受付結果を再確認（QA表示）</button></div>';
  });
 }else if(route==='callstatus'){
  await page.locator('#boonV4CallHero').waitFor({timeout:15000});
  await page.waitForTimeout(850);
  if(kind==='cancel-confirm'){
   if(await page.locator('#csCancel').isVisible())await page.locator('#csCancel').click();
  }
 }
 if(kind==='slots'){
  await page.locator('#recSlots [data-rec-slot]').first().waitFor({timeout:12000});
  await page.locator('#recSlots [data-rec-slot]').first().click();
  await page.waitForFunction(()=>document.querySelector('#recSlots .rec-slot.active[aria-pressed="true"]')!==null,{timeout:6000});
  await page.waitForFunction(()=>!document.querySelector('#boonV4Continue')?.disabled,{timeout:6000});
 }
 await page.waitForTimeout(120);
}
async function main(){
 fs.mkdirSync(path.join(OUT,'screens'),{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const qa={version:'5.1.0-mint-production-preview',baseSha:'400ba7ade537e484db5ff53011edb604e79bd62a',
  strictNoRealCalls:true,attempts:[],startedAt:new Date().toISOString(),browser:'Chrome headless',
  errors:[],testedWidths:[320,390,430],realLiff:false,realAirwait:false};
 for(const width of [320,390,430]){
  for(const [id,kind] of labels()){
   const page=await browser.newPage({viewport:{width,height:860},deviceScaleFactor:1});
   const faults=[];
   page.on('pageerror',e=>faults.push(e.message));
   try{
    await install(page,kind);await openKind(page,kind);
    const state=await page.evaluate(()=>{
     const html=document.documentElement,hero=document.querySelector('#boonV4CallHero');
     const total=document.documentElement.scrollWidth,view=document.documentElement.clientWidth;
     const mint=getComputedStyle(html);
     const targets=[...document.querySelectorAll('#v38Hero.open .v38-action.primary,#boonV5WebReception,#recSlots .rec-slot,#boonV4Continue,#boonV4Back,#recSubmit,.rec-stepper button,#csRefresh,#csCancel')].filter(el=>{
      const st=getComputedStyle(el),r=el.getBoundingClientRect();
      return st.display!=='none'&&st.visibility!=='hidden'&&r.width>0&&r.height>0;
     });
     const tooSmall=targets.filter(el=>{
      const r=el.getBoundingClientRect();return r.width<44||r.height<44;
     }).map(el=>({element:el.id||el.className,width:Math.round(el.getBoundingClientRect().width),height:Math.round(el.getBoundingClientRect().height)}));
     return {v4:html.classList.contains('boon-v4'),v5:html.classList.contains('boon-v5-mint'),
      colors:[mint.getPropertyValue('--mint-main').trim(),mint.getPropertyValue('--mint-pale').trim(),mint.getPropertyValue('--mint-coral').trim()],
      testedTapTargets:targets.length,tooSmall:tooSmall,
      webUrl:document.querySelector('#boonV5WebReception')?.getAttribute('href')||'',
      selectedSlot:!!document.querySelector('#recSlots .rec-slot.active'),
      teamMatches:document.querySelector('#boonV5TeamPrice')?.textContent===document.querySelector('#recPrice')?.textContent,
      overflow:total>view+1,
      heroKind:hero?.className||'',green:hero?.querySelectorAll('.boon-v4-lamp.green').length||0,
      go:!!hero?.querySelector('.boon-v4-go'),
      badge:hero?.querySelector('.boon-v4-status-tag')?.textContent||'',
      headline:hero?.querySelector('h2')?.textContent||'',
      stage:document.querySelector('.boon-v4-reception')?.dataset.boonStage||'',
      receipt:hero?.querySelector('.boon-v4-number strong')?.textContent||'',
      buttons:[...document.querySelectorAll('button')].filter(n=>n.offsetWidth&&n.offsetHeight).length
     };
    });
    const expected={waiting:'waiting',waiting0:'waiting',near:'near',calling:'calling',done:'done',hold:'hold',canceled:'canceled',closed:'closed','comm-error':'error'};
    const namedOk=!expected[kind]||(state.badge!==''&&state.receipt==='QA-123'&&state.heroKind.split(' ').includes(expected[kind]));
    const expectedStage={slots:'1',people:'2',confirm:'3',processing:'4',complete:'5',ambiguous:'5'};
    const stageOk=!expectedStage[kind]||state.stage===expectedStage[kind];
    const mintOk=state.v5&&state.colors.join(',')==='#28C7BE,#E3FFF6,#F26F4C';
    const touchOk=state.tooSmall.length===0;
    const webOk=kind!=='home'||state.webUrl==='https://airwait.jp/WCSP/storeDetail?storeNo=AKR2298124918';
    const slotOk=kind!=='slots'||state.selectedSlot;
    const teamOk=kind!=='people'||state.teamMatches;
    const helpOk=kind!=='slots'||(await page.locator('.v13-after-reception details').count())===1;
    const helpCopyOk=kind!=='slots'||(await page.locator('.v13-after-reception summary').textContent()).includes('LINE');
    const holdOk=kind!=='hold'||(await page.locator('#boonV4CallHero .boon-v4-lights').count())===0;
    const hintOk=kind!=='slots'||(await page.locator('#boonV51ActionHint').count())===1;
    const ok=state.v4&&mintOk&&touchOk&&webOk&&slotOk&&teamOk&&helpOk&&helpCopyOk&&holdOk&&hintOk&&!state.overflow&&faults.length===0&&namedOk&&stageOk&&
       (kind!=='waiting0'||(state.green===0&&!state.go))&&
       (kind!=='calling'||(state.green===5&&state.go&&state.headline.includes('入場できます'))) &&
       (kind!=='comm-error'||(!state.go&&state.headline.includes('取得できません')));
    qa.attempts.push({id,kind,width,ok,state,errors:faults});
    if(width===390)await page.screenshot({path:path.join(OUT,'screens',id+'.png'),fullPage:true});
   }catch(e){qa.attempts.push({id,kind,width,ok:false,error:String(e).slice(0,700),errors:faults});}
   await page.close();
  }
 }
 await browser.close();
 qa.passed=qa.attempts.filter(x=>x.ok).length;qa.failed=qa.attempts.length-qa.passed;
 qa.finishedAt=new Date().toISOString();
 fs.writeFileSync(path.join(OUT,'browser-qa.json'),JSON.stringify(qa,null,2));
 console.log('BOON_MINT_PRODUCTION_PREVIEW_QA passed='+qa.passed+' failed='+qa.failed);
 for(const test of qa.attempts.filter(x=>!x.ok))console.log('FAIL',test.width,test.id,test.kind,JSON.stringify(test).slice(0,500));
 process.exitCode=qa.failed?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
