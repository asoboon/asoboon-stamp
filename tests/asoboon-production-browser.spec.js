const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const BASE='http://127.0.0.1:4173/miniapp-v2/production/';
const GATEWAY='https://asoboon-miniapp-v2-production-gateway.asoboon425.workers.dev/';

async function installProduction(page,{status=null}={}){
  await page.addInitScript(()=>{
    const RealDate=Date;
    const fixed=new RealDate('2026-10-03T03:00:00.000Z').valueOf();
    window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}};
  });
  await page.route('**/miniapp-v2/production/env.js*',async route=>{
    let env=fs.readFileSync('miniapp-v2/production/env.js','utf8');
    env=env
      .replace("endpoint:'https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/'",`endpoint:'${BASE}'`)
      .replace("backendUrl:''",`backendUrl:'${GATEWAY}'`)
      .replace('receptionCreate:false','receptionCreate:true')
      .replace('serviceMessage:false','serviceMessage:true');
    await route.fulfill({status:200,contentType:'application/javascript',body:env});
  });
  await page.route('https://static.line-scdn.net/**',async route=>{
    await route.fulfill({status:200,contentType:'application/javascript',body:`window.liff={isInClient:()=>true,isLoggedIn:()=>true,init:opts=>{window.__productionLiffId=opts.liffId;window.__productionLiffInitCount=(window.__productionLiffInitCount||0)+1;return Promise.resolve()},getAccessToken:()=>"prod_test_access_token_abcdefghijklmnopqrstuvwxyz",getProfile:()=>Promise.resolve({userId:"Uprod",displayName:"Production Test"})};`});
  });
  await page.route('https://asoboon-miniapp-v2-production-gateway.asoboon425.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    const p=new URLSearchParams(route.request().postData()||'');
    const action=u.searchParams.get('action')||p.get('action');
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(action==='health')return json({ok:true,environment:'official-production',acceptedClientIds:['2009884613'],createEnabled:true,createRequiresVerifiedLiff:true,serviceMessageReady:true,serviceMessageMandatoryBeforeCreate:true});
    if(action==='businessDay')return json({ok:true,operationalDate:'2026-10-03',calendarDate:'2026-10-03',businessType:'土日祝日',durationLabel:'2時間30分',closingTime:'18:00'});
    if(action==='crowdRemaining')return json({ok:true,slots:[
      {waitTypeId:'0030',waitTypeName:'10時ご入場枠【WEB整理券】',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:195},
      {waitTypeId:'0032',waitTypeName:'12時半ご入場枠【WEB整理券】',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:71},
      {waitTypeId:'0034',waitTypeName:'15時ご入場枠【WEB整理券】',slotKey:'15:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:25},
    ]});
    if(action==='surpriseVotePublicStatus')return json({ok:true,mode:'idle',now:'2026-10-03T12:00:00+09:00'});
    if(action==='recoverReservationSession')return json({ok:true,found:false});
    if(action==='waitTypes')return json({ok:true,waitTypes:[
      {waitTypeId:'0029',waitTypeName:'10:00の回',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
      {waitTypeId:'0031',waitTypeName:'12:30の回',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
      {waitTypeId:'0033',waitTypeName:'15:00の回',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
    ]});
    if(action==='reservationStatus'&&status)return json(status);
    return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'TEST_NOT_IMPLEMENTED',action})});
  });
}

test('Production new HOME renders all core routes and legal information',async({page})=>{
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('.v38-home')).toBeVisible();
  await expect(page.locator('#v38Hero')).toContainText('当日受付');
  await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
  await expect(page.locator('.v38-legal')).toContainText('株式会社コマーム');
  await expect(page.locator('.v38-legal')).toContainText('ASOBooN事務局 048-420-9780');
  await expect(page.locator('.v38-legal a[href^="tel:"]')).toHaveAttribute('href','tel:0484209780');
  await expect(page.locator('.v38-legal a[href^="https://comaam.jp"]')).toHaveAttribute('href','https://comaam.jp/privacy-policy/');
  await expect(page.locator('.v38-calendar-card')).toHaveAttribute('data-external','1');

  const routes=[
    ['[data-v7-view="first"]:not([data-v7-panel])','first'],
    ['[data-v7-view="parking"]','parking'],
    ['[data-v7-view="rules"]','rules'],
    ['[data-v7-view="entry"]','entry'],
    ['#v38TimeguideShortcut','timeguide'],
  ];
  for(const [selector,view] of routes){
    await page.locator(selector).first().click();
    await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe(view);
    await page.getByRole('button',{name:'新HOMEへ戻る'}).click();
    await expect(page.locator('.v38-home')).toBeVisible();
  }
});

test('Production play content has six working escape-guard exceptions and no retired LIFF URLs',async({page})=>{
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const cards=page.locator('.v38-play-card');
  await expect(cards).toHaveCount(6);
  for(const label of ['ASOQUEST','BOON BLOCK','ブーンジャンプ','ブーンRUN','おみくじ','スタンプラリー']){
    const card=cards.filter({hasText:label}).first();
    await expect(card).toHaveAttribute('data-external','1');
  }
  await expect(cards.filter({hasText:'ASOQUEST'}).first()).toHaveAttribute('href','https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/asoquest/');
  await expect(cards.filter({hasText:'BOON BLOCK'}).first()).toHaveAttribute('href','https://asoboon.github.io/asoboon-3d/boon-block-next/?v=23');
  expect(await page.content()).not.toMatch(/2009888671|57TOefc3/);
});

test('route guard allows BOON BLOCK external navigation',async({page})=>{
  await installProduction(page);
  await page.route('https://asoboon.github.io/asoboon-3d/boon-block-next/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>BOON BLOCK TEST</title><h1>BOON BLOCK</h1>'}));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('.v38-play-card').filter({hasText:'BOON BLOCK'}).click();
  await expect(page).toHaveURL(/asoboon\.github\.io\/asoboon-3d\/boon-block-next\/\?v=23/);
  await expect(page.getByRole('heading',{name:'BOON BLOCK'})).toBeVisible();
});

test('Production storage namespace stays isolated from Developing and Review',async({page})=>{
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const source=fs.readFileSync('miniapp-v2/production/home-v38.js','utf8')+fs.readFileSync('miniapp-v2/production/env.js','utf8');
  expect(source).toContain('asoboon_v2_current_reservation_production_v1');
  expect(source).toContain("storageNamespace:'production'");
  expect(source).not.toMatch(/_develop_v1|_review_v1|2009884611|2009884612/);
});

test('Production HOME reception stays in the MINI App and never redirects to AirWAIT',async({page})=>{
  const airwaitRequests=[];
  page.on('request',request=>{if(new URL(request.url()).hostname==='airwait.jp')airwaitRequests.push(request.url())});
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('[data-v7-view="reception"]').first().click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
  await expect(page.locator('#recSubmit')).toBeVisible();
  await expect(page.locator('#recSlots [data-rec-slot]')).toHaveCount(3);
  expect(new URL(page.url()).origin).toBe('http://127.0.0.1:4173');
  expect(airwaitRequests).toEqual([]);
});

async function installCertifiedProduction(page){
  await installProduction(page);
  await page.route('**/miniapp-v2/production/env-facility.js*',async route=>{
    let env=fs.readFileSync('miniapp-v2/production/env-facility.js','utf8');
    env=env
      .replace("endpoint:'https://asoboon.github.io/asoboon-stamp/home.html'","endpoint:'http://127.0.0.1:4173/home.html'")
      .replace("assetBase:'https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/'","assetBase:'http://127.0.0.1:4173/miniapp-v2/production/'")
      .replace("siteBase:'https://asoboon.github.io/asoboon-stamp/'","siteBase:'http://127.0.0.1:4173/'")
      .replace("backendUrl:''",`backendUrl:'${GATEWAY}'`)
      .replace('receptionCreate:false','receptionCreate:true')
      .replace('serviceMessage:false','serviceMessage:true');
    await route.fulfill({status:200,contentType:'application/javascript',body:env});
  });
}

test('official home.html preview boots Production on the exact LIFF endpoint path',async({page})=>{
  const localRequests=[];
  page.on('request',request=>{try{const u=new URL(request.url());if(u.origin==='http://127.0.0.1:4173')localRequests.push(u.pathname+u.search)}catch{}});
  await installCertifiedProduction(page);
  await page.goto('http://127.0.0.1:4173/home.html?production_preview=1',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.v38-home')).toBeVisible({timeout:15000});
  await page.waitForTimeout(900);
  expect(localRequests.some(x=>x.startsWith('/miniapp-v2/production/surprise-vote.html'))).toBeFalsy();
  expect(localRequests.some(x=>x.startsWith('/miniapp-v2/production/surprise-vote.js'))).toBeFalsy();
  expect(localRequests.some(x=>x.startsWith('/miniapp-v2/production/env-facility.js'))).toBeTruthy();
  expect(localRequests.some(x=>x.startsWith('/miniapp-v2/production/production-app.js'))).toBeTruthy();
  expect(localRequests.some(x=>x.startsWith('/miniapp-v2/production/home-v38.js'))).toBeFalsy();
  expect(localRequests.some(x=>x.startsWith('/surprise-vote.html'))).toBeFalsy();
  expect(localRequests.some(x=>x.startsWith('/surprise-vote.js'))).toBeFalsy();
  expect(localRequests.some(x=>x.startsWith('/surprise-vote-config.js'))).toBeFalsy();
  expect(localRequests.some(x=>x.startsWith('/env.js'))).toBeFalsy();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/home.html');
  await expect.poll(()=>new URL(page.url()).searchParams.get('production_preview')).toBe('1');
  await expect(page.locator('.v38-legal')).toContainText('株式会社コマーム');
  await page.locator('[data-v7-view="first"]').first().click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/home.html');
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('first');
  await expect.poll(()=>new URL(page.url()).searchParams.get('production_preview')).toBe('1');
  await page.getByRole('button',{name:'新HOMEへ戻る'}).click();
  await expect(page.locator('.v38-calendar-card')).toHaveAttribute('data-external','1');
  await page.locator('.v38-calendar-card').click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/miniapp-v2/production/event-calendar.html');
});

test('certified HOME loads bundled assets once and keeps the official LINE identity on small and large screens',async({page})=>{
  const requests=[],errors=[];
  page.on('request',r=>requests.push(r.url()));
  page.on('pageerror',e=>errors.push(e.message));
  await installCertifiedProduction(page);
  await page.goto('http://127.0.0.1:4173/home.html',{waitUntil:'networkidle'});
  await expect(page.locator('.v38-home')).toBeVisible();
  expect(await page.evaluate(()=>window.__productionLiffId)).toBe('2009884613-ELc6kolf');
  expect(await page.evaluate(()=>window.__productionLiffInitCount)).toBe(1);
  expect(requests.filter(x=>/production-app\.js\?/.test(x))).toHaveLength(1);
  expect(requests.filter(x=>/production-app\.css\?/.test(x))).toHaveLength(1);
  expect(requests.filter(x=>/surprise-vote\.(?:html|js|css)|\/app\/core\//.test(x))).toHaveLength(0);
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    await expect(page.locator('.v38-home')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  }
  await page.locator('[data-v7-view="reception"]').first().click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/home.html');
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
  await expect(page.locator('#recSubmit')).toBeVisible();
  expect(requests.some(x=>x.startsWith('https://airwait.jp/'))).toBeFalsy();
  expect(errors).toEqual([]);
});


test('legacy customer callstatus preserves UI while reading only through Production proxy',async({page})=>{
  const directAirwait=[];
  const proxyActions=[];
  page.on('request',req=>{
    const u=req.url();
    if(/(?:cl\.airwait\.jp|airwait\.jp\/WCSP\/api)/.test(u))directAirwait.push(u);
  });
  await page.route('**/calltime-config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.ASOBOON_CALLTIME_CONFIG={};'}));
  await page.route('**/asoboon-miniapp-v2-production-gateway.asoboon425.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    const action=u.searchParams.get('action')||'';
    proxyActions.push(action);
    if(action==='legacyReservations')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,count:2,rows:[
      {number:'1001',waitTypeId:'0029',waitTypeName:'10:00の回',status:'0',isCalling:'0'},
      {number:'1002',waitTypeId:'0029',waitTypeName:'10:00の回',status:'0',isCalling:'0'}
    ]})});
    if(action==='legacyWaitInfo')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,store:{storeName:'ASOBooN',waitDetails:[]}})});
    if(action==='legacyLastUpdate')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,lastUpdDate:'',currentDate:''})});
    return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({ok:false,error:'UNKNOWN_ACTION'})});
  });
  await page.goto('http://127.0.0.1:4173/callstatus-core.html?wrap=1&proxy_e2e=1',{waitUntil:'domcontentloaded'});
  await page.locator('#numberInput').fill('1001');
  await page.locator('#numberSubmit').click();
  await expect(page.locator('#personalSection')).toBeVisible({timeout:10000});
  await expect(page.locator('#bigNumber')).toHaveText('1001');
  expect(proxyActions).toContain('legacyReservations');
  expect(directAirwait).toEqual([]);
});

