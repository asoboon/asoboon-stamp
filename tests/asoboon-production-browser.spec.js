const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const BASE='http://127.0.0.1:4173/miniapp-v2/production/';
const GATEWAY='https://asoboon-miniapp-v2-production-gateway.asoboon425.workers.dev/';

async function installProduction(page,{status=null,clockIso='2026-10-03T03:00:00.000Z'}={}){
  await page.addInitScript(iso=>{
    const RealDate=Date;
    const fixed=new RealDate(iso).valueOf();
    window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}};
  },clockIso);
  await page.route('**/miniapp-v2/production/env.js*',async route=>{
    let env=fs.readFileSync('miniapp-v2/production/env.js','utf8');
    env=env
      .replace("assetBase:'https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/'",`assetBase:'${BASE}'`)
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
  const deferredRequests=[];
  page.on('request',request=>{if(request.url().includes('/production-routes.'))deferredRequests.push(request.url())});
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('.v38-home')).toBeVisible();
  expect(await page.evaluate(()=>window.ASOBOON_V2_ROUTE_ASSETS_READY||false)).toBe(false);
  expect(deferredRequests).toEqual([]);
  await expect(page.locator('#v38Hero')).toContainText('当日受付');
  await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
  await expect(page.locator('.v38-legal')).toContainText('株式会社コマーム');
  await expect(page.locator('.v38-legal')).toContainText('ASOBooN事務局 048-420-9780');
  await expect(page.locator('.v38-legal a[href^="tel:"]')).toHaveAttribute('href','tel:0484209780');
  await expect(page.locator('.v38-legal a[href^="https://comaam.jp"]')).toHaveAttribute('href','https://comaam.jp/privacy-policy/');
  await expect(page.locator('.v38-calendar-card').first()).toHaveAttribute('data-external','1');

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
    await expect.poll(()=>page.evaluate(()=>window.ASOBOON_V2_ROUTE_ASSETS_READY||false)).toBe(true);
    expect(deferredRequests).toHaveLength(2);
    await page.getByRole('button',{name:'新HOMEへ戻る'}).click();
    await expect(page.locator('.v38-home')).toBeVisible();
  }
});

test('Production play content features one new stamp rally and four other games without retired LIFF URLs',async({page})=>{
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const cards=page.locator('.v38-play-card');
  await expect(cards).toHaveCount(5);
  for(const label of ['スタンプラリー','BOON BLOCK','ブーンジャンプ','ブーンRUN','おみくじ']){
    const card=cards.filter({hasText:label}).first();
    await expect(card).toHaveAttribute('data-external','1');
  }
  await expect(cards.filter({hasText:'スタンプラリー'}).first()).toHaveAttribute('href',new URL('asoquest/',BASE).href);
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

test('Production reception shows the supplied facility-use notice before confirmation',async({page})=>{
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('[data-v7-view="reception"]').first().click();
  const notice=page.locator('.rec-disclaimer');
  await expect(notice).toContainText('施設では責任を負いかねます');
  for(const item of ['施設内での怪我、事故','お荷物の紛失、盗難','お客様同士のトラブル','施設内での衣服の汚れ','施設ご利用後の感染症罹患'])await expect(notice).toContainText(item);
  await expect(page.locator('.rec-agree')).toContainText('ご利用にあたっての案内を確認しました');
  await expect(page.locator('#recSubmit')).toBeDisabled();
});

test('business calendar shows API dates, fixed weekdays and faded past days',async({page})=>{
  const requested=[];
  await installCertifiedProduction(page);
  await page.route(GATEWAY+'**',async route=>{
    const u=new URL(route.request().url()),month=u.searchParams.get('month'),start=u.searchParams.get('from');
    if(u.searchParams.get('action')!=='businessDays'||!month||!start)return route.fulfill({status:404,body:'{}'});
    const [year,monthNumber]=month.split('-').map(Number),last=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
    const dates=Array.from({length:last-Number(start.slice(8,10))+1},(_,i)=>`${month}-${String(Number(start.slice(8,10))+i).padStart(2,'0')}`);
    requested.push(...dates);
    const days=dates.map(date=>{
      const weekday=new Date(date+'T12:00:00Z').getUTCDay();
      const businessType=date==='2026-10-10'?'休館':date==='2026-10-08'?'平日特定日':weekday===2?'休館':weekday===0||weekday===6?'土日祝日':'平日';
      return{ok:true,operationalDate:date,calendarDate:date,businessType,closingTime:businessType==='土日祝日'?'18:00':'17:00',durationLabel:'時間制限なし',note:date==='2026-10-10'?'臨時休館':'',source:'test'};
    });
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,month,days,failedDates:[],complete:true,source:'test-batch'})});
  });
  await page.goto('http://127.0.0.1:4173/miniapp-v2/production/business-calendar.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#bcMonth')).toHaveText('2026年 10月');
  await expect(page.locator('[data-date="2026-10-02"]')).toHaveClass(/past/);
  await expect(page.locator('[data-date="2026-10-06"]')).toContainText('休館');
  await expect(page.locator('[data-date="2026-10-10"]')).toContainText('休館');
  await expect(page.locator('[data-date="2026-10-08"]')).toContainText('平日特定日');
  await expect(page.locator('[data-date="2026-10-08"]')).toHaveClass(/type-special/);
  await expect(page.locator('[data-date="2026-10-09"]')).toContainText('平日');
  await expect(page.locator('[data-date="2026-10-11"]')).toContainText('土日祝日');
  await expect(page.locator('[data-date="2026-10-11"]')).toHaveClass(/type-weekend/);
  await expect(page.locator('[data-date="2026-10-08"]')).toHaveCSS('background-color','rgb(244, 249, 255)');
  await expect(page.locator('[data-date="2026-10-09"]')).toHaveCSS('background-color','rgb(239, 249, 245)');
  await expect(page.locator('[data-date="2026-10-11"]')).toHaveCSS('background-color','rgb(255, 248, 233)');
  await expect(page.locator('#bcStatus')).toContainText('営業日API');
  expect(requested.length).toBe(29);
  await page.locator('#bcNext').click();
  await expect(page.locator('#bcMonth')).toHaveText('2026年 11月');
  await expect(page.locator('[data-date="2026-11-03"]')).toContainText('休館');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
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
  await page.locator('.v38-business-calendar-section .v38-calendar-card').click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/miniapp-v2/production/business-calendar.html');
  await expect(page.getByRole('heading',{name:'営業日カレンダー'})).toBeVisible();
  await page.locator('.bc-back').click();
  await expect(page.locator('.v38-home')).toBeVisible();
  await expect(page.locator('.v38-calendar-card').first()).toHaveAttribute('data-external','1');
  await page.locator('.v38-calendar-section:not(.v38-business-calendar-section) .v38-calendar-card').click();
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


test('retired four-spot stamp URLs lead to the new six-part rally instead of the old GAS screen',async({page})=>{
  await page.goto('http://127.0.0.1:4173/index.html?stamp=home');
  await expect(page).toHaveURL(/\/miniapp-v2\/production\/asoquest\/$/);
  await expect(page.getByRole('heading',{name:'スタンプラリー'}).first()).toBeVisible();

  await page.goto('http://127.0.0.1:4173/index.html?spot=spot_01');
  await expect(page).toHaveURL(/\/miniapp-v2\/production\/asoquest\/\?legacy=spot$/);
  await expect(page.locator('#overlay')).toHaveClass(/show/);
  await expect(page.locator('#overlayTitle')).toHaveText('新しい6か所を探そう');
});

test('the official HOME LIFF deep-link bridge acquires six-part stamps via QR and NFC',async({page})=>{
  await page.goto('http://127.0.0.1:4173/home.html?aq=wheel&src=qr');
  await expect(page).toHaveURL(/\/miniapp-v2\/production\/asoquest\/\?part=wheel&src=qr$/);
  await expect(page.locator('#overlayTitle')).toHaveText('タイヤ');
  await expect(page.locator('#partsCount')).toHaveText('1 / 6');
  await page.goto('http://127.0.0.1:4173/home.html?liff.state='+encodeURIComponent('?aq=engine&src=nfc'));
  await expect(page).toHaveURL(/\/miniapp-v2\/production\/asoquest\/\?part=engine&src=nfc$/);
  await expect(page.locator('#overlayTitle')).toHaveText('エンジン');
  await expect(page.locator('#partsCount')).toHaveText('2 / 6');
});

test('NFC/QR stamp -> rally HOME -> official MINI App HOME -> rally preserves acquired parts',async({page})=>{
  await installProduction(page);
  await page.setViewportSize({width:390,height:780});
  const site='http://127.0.0.1:4173/';
  const rally=site+'miniapp-v2/production/asoquest/';
  await page.goto(site+'home.html?aq=engine&src=nfc');
  await expect(page.locator('#overlayTitle')).toHaveText('エンジン');
  await expect(page.getByRole('button',{name:'スタンプラリーへ戻る'})).toBeVisible();
  await page.getByRole('button',{name:'スタンプラリーへ戻る'}).click();
  await expect(page.locator('#overlay')).not.toHaveClass(/show/);
  await expect(page).toHaveURL(rally);
  await expect(page.locator('#partsCount')).toHaveText('1 / 6');
  const home=page.getByRole('link',{name:'ミニアプリのホームへ戻る'});
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute('href','../../../home.html');
  expect((await home.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await home.click();
  await expect(page).toHaveURL(site+'home.html');
  await expect(page.locator('.v38-home')).toBeVisible();

  // Production uses the same origin; rewrite its absolute GitHub Pages URL
  // to this localhost fixture so localStorage can be checked across both screens.
  const card=page.locator('.v38-play-card').filter({hasText:'スタンプラリー'});
  await expect(card).toHaveAttribute('href','https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/asoquest/');
  await card.evaluate((a,url)=>{a.href=url;},rally);
  await card.click();
  await expect(page).toHaveURL(rally);
  await expect(page.locator('#partsCount')).toHaveText('1 / 6');
});

test('ENGINE START clear returns to rally HOME without losing completed machine',async({page})=>{
  const site='http://127.0.0.1:4173/';
  const rally=site+'miniapp-v2/production/asoquest/';
  for(const part of ['engine','wheel','headlight','fin','grille','key']){
    await page.goto(rally+'?part='+part+'&src=qr');
    await expect(page.locator('#overlayTitle')).toHaveText(/エンジン|タイヤ|ライト|フィン|グリル|キー/);
    await page.getByRole('button',{name:'スタンプラリーへ戻る'}).click();
  }
  await expect(page.locator('#partsCount')).toHaveText('6 / 6');
  await page.goto(rally+'?station=engine&src=qr');
  await expect(page.locator('#ignitionSequence')).toHaveClass(/phase-final/,{timeout:11000});
  await page.getByRole('button',{name:'スタンプラリーへ戻る'}).click();
  await expect(page.locator('#ignitionSequence')).not.toHaveClass(/show/);
  await expect(page).toHaveURL(rally);
  await expect(page.locator('#partsCount')).toHaveText('6 / 6');
  await expect(page.locator('#headline')).toHaveText('スタンプラリー クリア！');
});

test('Entry guide: four clear cards, large targets, photo-free illustrations on mobile',async({page})=>{
  await installProduction(page);
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.locator('[data-v7-view="entry"]').first().click();
    await expect(page.locator('.v25-entry-page')).toBeVisible();
    await expect(page.locator('#entryChoices .entry-choice')).toHaveCount(4);
    for(const text of ['大人だけ出る','全員で出る','再入場する','今日は帰る']){
      await expect(page.locator('#entryChoices .entry-choice').filter({hasText:text})).toBeVisible();
    }
    const measures=await page.evaluate(()=>{
      const cards=[...document.querySelectorAll('#entryChoices .entry-choice')];
      return{
        overflow:document.documentElement.scrollWidth>window.innerWidth,
        imageCount:document.querySelectorAll('.v25-entry-page img, .v25-entry-page picture').length,
        allLarge:cards.every(card=>card.getBoundingClientRect().height>=90&&card.getBoundingClientRect().width>=120),
        columns:getComputedStyle(document.querySelector('#entryChoices')).gridTemplateColumns.split(' ').length
      };
    });
    expect(measures.overflow).toBe(false);
    expect(measures.imageCount).toBe(0);
    expect(measures.allLarge).toBe(true);
    expect(measures.columns).toBe(width<=350?1:2);
  }
});

test('Entry guide: yellow holder and family receipt procedures, safety warnings and back',async({page})=>{
  await installProduction(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('[data-v7-view="entry"]').first().click();

  await page.locator('[data-entry-choice="adult"]').click();
  await expect(page.locator('.entry-needed h2')).toHaveText('黄色ホルダー');
  await expect(page.locator('.entry-warning')).toContainText('お子さまだけを館内に残すことはできません');
  await expect(page.locator('.entry-checklist li')).toHaveCount(3);
  await expect(page.locator('.entry-note')).toContainText('一時退場中も利用時間は進みます');
  await page.getByRole('button',{name:'4つの選択肢へ戻る'}).click();

  await page.locator('[data-entry-choice="all"]').click();
  // The native sticky MINI App header must never cover the guide heading.
  expect(await page.evaluate(()=>window.scrollY)).toBe(0);
  await expect(page.locator('.entry-needed h2')).toHaveText('レシートを保管');
  await expect(page.locator('.entry-checklist li')).toHaveCount(3);
  await expect(page.locator('.entry-checklist li').last()).toContainText('赤・黄色すべてのホルダーを返却');
  await page.getByRole('button',{name:'4つの選択肢へ戻る'}).click();

  await page.locator('[data-entry-choice="exit"]').click();
  await expect(page.locator('.entry-checklist li')).toHaveCount(2);
  await expect(page.locator('.entry-warning')).toContainText('また戻って遊ぶ予定なら');
  await page.getByRole('button',{name:'4つの選択肢へ戻る'}).click();
  await page.getByRole('button',{name:'新HOMEへ戻る'}).click();
  await expect(page.locator('.v38-home')).toBeVisible();
});

test('Entry guide: returning with receipt / yellow holder / neither, then reselect',async({page})=>{
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('[data-v7-view="entry"]').first().click();
  await page.locator('[data-entry-choice="return"]').click();
  await expect(page.locator('.entry-return-options button')).toHaveCount(3);

  await page.locator('[data-entry-choice="returnAll"]').click();
  await expect(page.locator('.entry-needed h2')).toHaveText('レシートを提示');
  await page.getByRole('button',{name:'持ち物を選び直す'}).click();

  await page.locator('[data-entry-choice="returnAdult"]').click();
  await expect(page.locator('.entry-needed h2')).toHaveText('黄色ホルダーを提示');
  await page.getByRole('button',{name:'持ち物を選び直す'}).click();

  await page.locator('[data-entry-choice="returnUnknown"]').click();
  await expect(page.locator('.entry-warning')).toContainText('入口のスタッフが状況を確認');
  await page.getByRole('button',{name:'持ち物を選び直す'}).click();
  await page.getByRole('button',{name:'4つの選択肢へ戻る'}).click();
  await expect(page.locator('#entryChoices')).toBeVisible();
});

test('Production HOME shows locally saved receipt before delayed call-status and never flashes cached calling',async({page})=>{
  await installProduction(page);
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      receiptNo:'F321',businessDate:'2026-10-03',waitTypeId:'0030',adults:1,paidChildren:2,infants:0
    }));
    localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
      sessionToken:'s'.repeat(40),receiptNo:'F321',businessDate:'2026-10-03',waitTypeId:'0030',expiresAt:4102444800000
    }));
    localStorage.setItem('asoboon_v2_home_status_production_v1',JSON.stringify({
      receiptNo:'F321',businessDate:'2026-10-03',savedAt:Date.now(),
      status:{kind:'calling',receipt:'F321',source:'live',checkedAt:Date.now()}
    }));
  });
  let release,started;
  const held=new Promise(resolve=>{release=resolve});
  const requested=new Promise(resolve=>{started=resolve});
  await page.route(GATEWAY+'**',async route=>{
    const action=new URLSearchParams(route.request().postData()||'').get('action');
    if(action!=='reservationStatus')return route.fallback();
    started();
    await held;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,found:true,state:'waiting',receiptNo:'F321',businessDate:'2026-10-03',aheadCount:6,checkedAt:Date.now()
    })});
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#v38Hero')).toHaveClass(/pending/);
  await expect(page.locator('.v38-pending-number')).toHaveText('F321');
  await expect(page.locator('.v38-pending-status')).toContainText('最新の呼出状況を確認しています');
  await expect(page.locator('#v38Hero')).not.toContainText('ご入場可能です');
  await expect(page.locator('#v38Hero')).not.toContainText('呼出中');
  await requested;
  await expect(page.locator('#v38Hero')).toHaveClass(/pending/);
  expect(await page.evaluate(()=>localStorage.getItem('asoboon_v2_home_status_production_v1'))).toBeNull();
  release();
  await expect(page.locator('#v38Hero')).toHaveClass(/waiting/);
  await expect(page.locator('#v38Hero')).toContainText('F321');
  await expect(page.locator('.v38-ahead')).toContainText('6');
});

test('Production HOME preserves cached receipt when online status fails',async({page})=>{
  await installProduction(page);
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      receiptNo:'E777',businessDate:'2026-10-03',waitTypeId:'0030',adults:1,paidChildren:1,infants:0
    }));
    localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
      sessionToken:'t'.repeat(40),receiptNo:'E777',businessDate:'2026-10-03',waitTypeId:'0030',expiresAt:4102444800000
    }));
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#v38Hero')).toHaveClass(/error/);
  await expect(page.locator('#v38Hero')).toContainText('受付状況を取得できません');
  await expect(page.locator('#v38Hero')).toContainText('E777');
  await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toBeVisible();
});

test('Production HOME does not show yesterday receipt or saved calling after the 19:00 JST rollover',async({page})=>{
  await installProduction(page);
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      receiptNo:'Y888',businessDate:'2026-10-02',waitTypeId:'0030'
    }));
    localStorage.setItem('asoboon_v2_home_status_production_v1',JSON.stringify({
      receiptNo:'Y888',businessDate:'2026-10-02',savedAt:Date.now(),
      status:{kind:'calling',receipt:'Y888'}
    }));
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#v38Hero')).toContainText('当日受付');
  await expect(page.locator('#v38Hero')).not.toContainText('Y888');
  expect(await page.evaluate(()=>localStorage.getItem('asoboon_v2_current_reservation_production_v1'))).toBeNull();
  expect(await page.evaluate(()=>localStorage.getItem('asoboon_v2_home_status_production_v1'))).toBeNull();
});

test('Production HOME shows compact 9:25 MINI App and 7:00 WEB reception hours with optional AirWAIT link',async({page})=>{
  const externalRequests=[];
  page.on('request',req=>{if(new URL(req.url()).hostname==='airwait.jp')externalRequests.push(req.url())});
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#v38Hero')).toHaveClass(/open/);
  const note=page.locator('#v38Hero .v38-reception-hours');
  await expect(note).toBeVisible();
  await expect(note).toContainText('LINEミニアプリ');
  await expect(note).toContainText('9:25から');
  await expect(note).toContainText('WEB受付');
  await expect(note).toContainText('7:00から');
  const link=note.locator('a.v38-airwait-link');
  await expect(link).toHaveAttribute('href','https://airwait.jp/WCSP/storeDetail?storeNo=AKR2298124918');
  await expect(link).toHaveAttribute('target','_blank');
  await expect(link).toHaveAttribute('rel',/noopener noreferrer/);
  await expect(link).toHaveAttribute('data-external','1');
  const metrics=await note.evaluate(el=>({fontSize:getComputedStyle(el).fontSize,overflow:document.documentElement.scrollWidth>window.innerWidth}));
  expect(Number.parseFloat(metrics.fontSize)).toBeLessThanOrEqual(13);
  expect(metrics.overflow).toBe(false);
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    await expect(note).toBeVisible();
    await expect(link).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  }
  expect(externalRequests).toEqual([]);
  await page.locator('#v38Hero [data-v7-view="reception"]').click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
  expect(externalRequests).toEqual([]);
});

test('WEB reservation link remains discoverable before 9:25 without opening MINI reception early',async({page})=>{
  await installProduction(page,{clockIso:'2026-10-02T23:00:00.000Z'}); // 08:00 JST
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#v38Hero')).toHaveClass(/before/);
  await expect(page.locator('#v38Hero')).toContainText('LINE当日受付は9:25から');
  const note=page.locator('#v38Hero .v38-reception-hours');
  await expect(note).toContainText('9:25から');
  await expect(note).toContainText('7:00から');
  await expect(note.locator('a')).toHaveAttribute('href','https://airwait.jp/WCSP/storeDetail?storeNo=AKR2298124918');
  await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toHaveCount(0);
});

test('WEB reservation invitation disappears when a reservation already exists',async({page})=>{
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#v38Hero .v38-reception-hours')).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{
    detail:{kind:'waiting',receipt:'F321',ahead:6,source:'live',checkedAt:Date.now()}
  })));
  await expect(page.locator('#v38Hero')).toHaveClass(/waiting/);
  await expect(page.locator('#v38Hero .v38-reception-hours')).toHaveCount(0);
});


test('AirWAIT text link opens the configured WEB reception externally on user tap only',async({page})=>{
  await installProduction(page);
  await page.context().route('https://airwait.jp/**',route=>route.fulfill({
    status:200,contentType:'text/html;charset=utf-8',body:'<!doctype html><html><title>AirWAIT mock</title><body>WEB reception</body></html>'
  }));
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const link=page.locator('#v38Hero .v38-airwait-link');
  await expect(link).toBeVisible();
  const popupPromise=page.waitForEvent('popup');
  await link.click();
  const popup=await popupPromise;
  await expect.poll(()=>popup.url()).toContain('airwait.jp/WCSP/storeDetail?storeNo=AKR2298124918');
  await popup.close();
  await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toBeVisible();
  expect(new URL(page.url()).origin).toBe('http://127.0.0.1:4173');
});

test('Production HOME prioritizes ASOBooN Timer before the business calendar',async({page})=>{
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('.v38-home')).toBeVisible();
  const timer=page.locator('#v38TimeguideShortcut');
  const calendar=page.locator('.v38-business-calendar-section');
  await expect(timer.locator('[data-timeguide-title]')).toHaveText('アソブーンタイマー');
  await expect(calendar).toContainText('営業日カレンダー');
  const positions=await page.evaluate(()=>{
    const t=document.querySelector('#v38TimeguideShortcut').getBoundingClientRect();
    const c=document.querySelector('.v38-business-calendar-section').getBoundingClientRect();
    return {timerTop:t.top,calendarTop:c.top,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  expect(positions.timerTop).toBeLessThan(positions.calendarTop);
  expect(positions.overflow).toBe(false);
  await timer.click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('timeguide');
  await expect(page.locator('.tg-page h2')).toHaveText('アソブーンタイマー');
  await expect(page.locator('#tgEntry')).toBeVisible();
  await page.getByRole('button',{name:'新HOMEへ戻る'}).click();
  await expect(calendar).toBeVisible();
});

test('ASOBooN Timer keeps its name and highlights the expected finish time when a result is saved',async({page})=>{
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('.v38-home')).toBeVisible();
  await expect(page.locator('#v38Today strong').first()).toContainText('土日祝日');
  await page.evaluate(()=>{
    localStorage.setItem('asoboon_v2_timeguide_production_v1',JSON.stringify({
      businessDate:'2026-10-03',entryTime:'12:30',endTime:'15:00',durationLabel:'2時間30分'
    }));
    window.dispatchEvent(new Event('asoboon:v2-timeguide-updated'));
  });
  const timer=page.locator('#v38TimeguideShortcut');
  await expect(timer).toHaveClass(/has-timeguide-result/);
  await expect(timer.locator('[data-timeguide-eyebrow]')).toHaveText('アソブーンタイマー');
  await expect(timer.locator('[data-timeguide-title]')).toHaveText('15:00まで遊べる');
  await expect(timer.locator('[data-timeguide-summary]')).toContainText('12:30入場');
  await expect(timer.locator('[data-timeguide-summary]')).toContainText('2時間30分');
});
