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
    ],observedDetails:[
      {detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:117},
      {detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:44},
      {detailedWaitType:'15時15分頃入場時間【土休日特定日】',reserveUnit:'PERSON',remaining:8}
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

test('Reception round choices show verified LINE quota, not WEB remaining, and preserve selectable zero',async({page})=>{
 await installProduction(page);
 let quotaRequests=0;
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  quotaRequests++;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,observedDetails:[
    {detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:7,remainingVerified:true},
    {detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:0,remainingVerified:true},
    {detailedWaitType:'15時15分頃入場時間【土休日特定日】',reserveUnit:'PERSON',remaining:39,remainingVerified:true},
    {detailedWaitType:'12時半ご入場枠【WEB整理券】',reserveUnit:'PERSON',remaining:200,remainingVerified:true}
   ]
  })});
 });
 await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
 const slots=page.locator('#recSlots [data-rec-slot]');
 await expect(slots).toHaveCount(3);
 await expect(page.locator('[data-rec-slot="0029"] .rec-slot-remaining')).toContainText('7名');
 await expect(page.locator('[data-rec-slot="0031"] .rec-slot-remaining')).toContainText('0名');
 await expect(page.locator('[data-rec-slot="0033"] .rec-slot-remaining')).toContainText('39名');
 await expect(page.locator('#recRemainingInfo')).toContainText('確認');
 await expect(page.locator('#recRemainingInfo')).toContainText('更新');
 await expect(page.locator('.rec-remaining-caution')).toContainText('受付確定までに変わる');
 await expect(page.locator('#recSlots')).not.toContainText('200名');
 await page.locator('[data-rec-slot="0031"]').click();
 await expect(page.locator('[data-rec-slot="0031"]')).toHaveClass(/active/);
 await expect(page.locator('#recSlotLabel')).toHaveText('12:30の回');
 await expect(page.locator('[data-rec-slot="0031"]')).toBeEnabled();
 expect(quotaRequests).toBe(1);
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  const quota=await page.locator('[data-rec-slot="0031"] .rec-slot-remaining').boundingBox();
  expect(quota.width).toBeGreaterThanOrEqual(85);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
});
test('Reception never fabricates zero from legacy, missing, duplicated, GROUP or stale crowd records',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,observedDetails:[
    {detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:3,remainingVerified:true},
    {detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:5,remainingVerified:true},
    {detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:0},
    {detailedWaitType:'15時15分頃入場時間【土休日特定日】',reserveUnit:'GROUP',remaining:0,remainingVerified:true}
   ]
  })});
 });
 await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#recSlots [data-rec-slot]')).toHaveCount(3);
 for(const waitTypeId of ['0029','0031','0033']){
  await expect(page.locator('[data-rec-slot="'+waitTypeId+'"] .rec-slot-remaining')).toContainText('確認中');
 }
 await page.locator('[data-rec-slot="0033"]').click();
 await expect(page.locator('[data-rec-slot="0033"]')).toHaveClass(/active/);
});
test('Reception reuses a recent HOME quota snapshot without a second shared-WiFi request',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_crowd_snapshot_production_v1',JSON.stringify({
   slots:[{waitTypeId:'0032',remaining:200,matchMode:'exact-name',evidence:'PERSON',reserveUnit:'PERSON'}],
   details:[{detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:12,remainingVerified:true}],
   operationalDate:'2026-10-03',businessType:'土日祝日',savedAt:Date.now(),verifiedFresh:true
  }));
 });
 let calls=0;
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  calls++;return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});
 });
 await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
 await expect(page.locator('[data-rec-slot="0031"] .rec-slot-remaining')).toContainText('12名');
 expect(calls).toBe(0);
 await page.locator('#recRemainingRefresh').click();
 await expect(page.locator('[data-rec-slot="0031"] .rec-slot-remaining')).toContainText('確認中');
 await expect(page.locator('#recRemainingInfo')).toContainText('確認できません');
 expect(calls).toBe(1);
});
test('Quota refresh re-enables after the real-time cooldown without forcing navigation',async({page})=>{
 test.setTimeout(35000);
 await installProduction(page);
 await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#recSlots [data-rec-slot]')).toHaveCount(3);
 const button=page.locator('#recRemainingRefresh');
 await expect(button).toBeVisible();
 await expect(button).toBeDisabled();
 await expect(button).toBeEnabled({timeout:26000});
 await button.click();
 await expect(button).toBeDisabled();
});
test('Reception display is advisory and never calls createReservation from quota preview',async({page})=>{
 await installProduction(page);
 let creates=0;
 page.on('request',req=>{
  if(new URLSearchParams(req.postData()||'').get('action')==='createReservation')creates++;
 });
 await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#recSlots [data-rec-slot]')).toHaveCount(3);
 await expect(page.locator('#recRemainingInfo')).toBeVisible();
 await expect(page.locator('#recSlots')).toContainText('LINE受付 残り');
 expect(creates).toBe(0);
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

test('Official HOME call CTA has a clear signifier, opens callstatus, and respects reduced motion',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
   receiptNo:'F777',businessDate:'2026-10-03',waitTypeId:'0033'
  }));
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const button=page.locator('#v38Hero .v38-call-cta');
 await expect(button).toHaveCount(1);
 await expect(button).toHaveAttribute('aria-label',/受付番号と順番を見る/);
 await expect(button.locator('strong')).toHaveText('呼び出し状況を確認する');
 await expect(button.locator('small')).toHaveText('番号・順番をタップしてチェック');
 await expect(button.locator('.v38-call-cta-icon svg')).toHaveCount(1);
 await expect(button.locator('.v38-call-cta-arrow svg')).toHaveCount(1);
 await expect(button).not.toContainText('LIVE');
 await expect(button).not.toContainText('呼出中');
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:800});
  const box=await button.boundingBox();
  expect(box.width).toBeGreaterThan(240);
  expect(box.width).toBeLessThanOrEqual(341);
  expect(box.height).toBeGreaterThanOrEqual(60);
  expect(box.height).toBeLessThan(85);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 if(process.env.ASOBOON_CALL_CTA_SCREENSHOT==='1'){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/asoboon-call-cta-390.png',fullPage:true})}
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect.poll(()=>button.locator('.v38-call-cta-signal').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await expect.poll(()=>button.locator('.v38-call-cta-arrow').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await button.click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('callstatus');
 await expect(page.locator('#csState')).toBeVisible();
});
test('HOME open-state uses the enhanced call button without interrupting the main reception path',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toHaveClass(/open/);
 const primary=page.locator('#v38Hero [data-v7-view="reception"]');
 const call=page.locator('#v38Hero .v38-call-cta');
 await expect(primary).toBeVisible();
 await expect(call).toBeVisible();
 await expect(call).toContainText('呼び出し状況を確認する');
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:800});
  const rect=await call.boundingBox();
  expect(rect.width).toBeGreaterThan(240);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 await primary.click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
 await expect(page.locator('#recSubmit')).toBeVisible();
});
test('Official HOME call-status button is wide, low-profile and accessible on narrow phones',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
    receiptNo:'F777',businessDate:'2026-10-03',waitTypeId:'0033'
  }));
 });
 await page.setViewportSize({width:320,height:700});
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toHaveClass(/call-link/);
 const hero=await page.locator('#v38Hero').boundingBox();
 const button=await page.locator('#v38Hero [data-v7-view="callstatus"]').boundingBox();
 expect(hero.height).toBeLessThan(85);
 expect(button.height).toBeGreaterThanOrEqual(44);
 expect(button.width).toBeGreaterThan(210);
 expect(button.width).toBeLessThanOrEqual(320);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('Production HOME with a saved receipt shows only the call-status link and makes no automatic reservationStatus requests',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
   localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
     receiptNo:'F321',businessDate:'2026-10-03',waitTypeId:'0030',adults:1,paidChildren:2,infants:0
   }));
   localStorage.setItem('asoboon_v2_home_status_production_v1',JSON.stringify({
     receiptNo:'F321',businessDate:'2026-10-03',savedAt:Date.now(),
     status:{kind:'calling',receipt:'F321',source:'live',checkedAt:Date.now()}
   }));
 });
 const actions=[];
 page.on('request',req=>{const p=new URLSearchParams(req.postData()||'');if(p.get('action')==='reservationStatus')actions.push('status')});
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const hero=page.locator('#v38Hero');
 await expect(hero).toHaveClass(/call-link/);
 await expect(hero.locator('[data-v7-view="callstatus"]')).toHaveCount(1);
 await expect(hero).not.toContainText('F321');
 await expect(hero).not.toContainText('あと');
 await expect(hero).not.toContainText('ご入場可能です');
 await expect(hero).not.toContainText('呼出中');
 for(const kind of ['waiting','calling','hold','guided','canceled','error']){
   await page.evaluate(kind=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{
     detail:{kind,receipt:'F321',ahead:3,source:'live',checkedAt:Date.now()}
   })),kind);
   await expect(hero).toHaveClass(/call-link/);
   await expect(hero.locator('[data-v7-view="callstatus"]')).toHaveCount(1);
   await expect(hero).not.toContainText('F321');
   await expect(hero).not.toContainText('3組');
   await expect(hero).not.toContainText('入場できます');
 }
 await page.waitForTimeout(350);
 expect(actions).toEqual([]);
});

test('Production HOME link stays available with a local receipt when network status is unavailable',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
   receiptNo:'E777',businessDate:'2026-10-03',waitTypeId:'0030'
  }));
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toHaveClass(/call-link/);
 await expect(page.locator('#v38Hero')).not.toContainText('E777');
 await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toContainText('呼び出し状況を確認する');
});

test('Production HOME recognizes a session restored to call-status cache alone',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
   localStorage.setItem('asoboon_v2_callstatus_production_v1',JSON.stringify({
     receiptNo:'R432',businessDate:'2026-10-03',waitTypeId:'0033',cachedAt:Date.now()
   }));
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toHaveClass(/call-link/);
 await expect(page.locator('#v38Hero')).not.toContainText('R432');
 await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toHaveCount(1);
 await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toHaveCount(0);
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

test('Production HOME shows compact 9:30 MINI App and 7:00 WEB reception hours with optional AirWAIT link',async({page})=>{
  const externalRequests=[];
  page.on('request',req=>{if(new URL(req.url()).hostname==='airwait.jp')externalRequests.push(req.url())});
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#v38Hero')).toHaveClass(/open/);
  const note=page.locator('#v38Hero .v38-reception-hours');
  await expect(note).toBeVisible();
  await expect(note).toContainText('LINEミニアプリ');
  await expect(note).toContainText('9:30から');
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

test('WEB reservation link remains discoverable before 9:30 without opening MINI reception early',async({page})=>{
  await installProduction(page,{clockIso:'2026-10-02T23:00:00.000Z'}); // 08:00 JST
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#v38Hero')).toHaveClass(/before/);
  await expect(page.locator('#v38Hero')).toContainText('LINE当日受付は9:30から');
  const note=page.locator('#v38Hero .v38-reception-hours');
  await expect(note).toContainText('9:30から');
  await expect(note).toContainText('7:00から');
  await expect(note.locator('a')).toHaveAttribute('href','https://airwait.jp/WCSP/storeDetail?storeNo=AKR2298124918');
  await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toHaveCount(0);
});

test('Production HOME stays navigation-only even after call-state events',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero .v38-reception-hours')).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{
   detail:{kind:'waiting',receipt:'F321',ahead:6,source:'live',checkedAt:Date.now()}
 })));
 await expect(page.locator('#v38Hero')).toHaveClass(/open/);
 await expect(page.locator('#v38Hero .v38-reception-hours')).toBeVisible();
 await expect(page.locator('#v38Hero')).not.toContainText('F321');
 await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toBeVisible();
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


test('Production HOME timer shortcut stays accessible after call-state events without showing the call state',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{
   detail:{kind:'guided',receipt:'F123',checkedAt:Date.now(),source:'live'}
 })));
 const hero=page.locator('#v38Hero');
 await expect(hero).not.toContainText('ご入場済み');
 const timer=page.locator('#v38TimeguideShortcut');
 await expect(timer).toBeVisible();
 await expect(timer).toContainText('アソブーンタイマー');
 await timer.click();
 await expect(page.locator('.tg-page h2')).toHaveText('アソブーンタイマー');
});

test('Official HOME never inserts the retired prototype, including while LIFF initializes',async({page})=>{
  const network=[];
  page.on('request',req=>network.push(new URL(req.url()).pathname));
  await page.addInitScript(()=>{
    window.__retiredHomeWrites=[];
    const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
    if(!descriptor)return;
    Object.defineProperty(Element.prototype,'innerHTML',{
      configurable:true,enumerable:descriptor.enumerable,
      get(){return descriptor.get.call(this)},
      set(value){
        if(this.id==='app'&&/hero-kicker|mode-toggle|fun-grid|flow-grid|ASOBooN NEW HOME/.test(String(value))){
          window.__retiredHomeWrites.push(String(value).slice(0,150));
        }
        return descriptor.set.call(this,value);
      }
    });
  });
  await installCertifiedProduction(page);
  await page.goto('http://127.0.0.1:4173/home.html',{waitUntil:'domcontentloaded'});
  await expect(page.locator('.v38-home')).toBeVisible({timeout:15000});
  expect(await page.evaluate(()=>window.__retiredHomeWrites)).toEqual([]);
  expect(await page.locator('iframe,#miniappCore,.hero-kicker,.mode-toggle,.fun-grid,.flow-grid').count()).toBe(0);
  expect(network.filter(x=>x==='/home-core.html'||x.startsWith('/app/core/'))).toEqual([]);
  const timer=page.locator('#v38TimeguideShortcut');
  await expect(timer).toContainText('アソブーンタイマー');
  await timer.click();
  await expect(page.locator('.tg-page h2')).toHaveText('アソブーンタイマー');
  await page.getByRole('button',{name:'新HOMEへ戻る'}).click();
  await expect(page.locator('.v38-home')).toBeVisible();
  expect(await page.evaluate(()=>window.__retiredHomeWrites)).toEqual([]);
});

test('Slow app startup shows only the small neutral boot indicator, never old HOME cards',async({page})=>{
  await installCertifiedProduction(page);
  let release,requestStarted;
  const gate=new Promise(resolve=>release=resolve);
  const requestReady=new Promise(resolve=>requestStarted=resolve);
  await page.route('**/miniapp-v2/production/production-app.js?*',async route=>{
    requestStarted();
    await gate;
    await route.continue();
  });
  const navigation=page.goto('http://127.0.0.1:4173/home.html',{waitUntil:'domcontentloaded'});
  await requestReady;
  const pending=await page.evaluate(()=>({
    loader:document.querySelector('.asoboon-boot')?.innerText||'',
    old:document.querySelectorAll('.hero-kicker,.mode-toggle,.fun-grid,.flow-grid,#miniappCore,iframe').length,
    iframeRequests:performance.getEntriesByType('resource').filter(x=>x.name.includes('home-core.html')).length
  }));
  expect(pending.loader).toContain('ASOBooNを読み込み中');
  expect(pending.old).toBe(0);
  expect(pending.iframeRequests).toBe(0);
  release();
  await navigation;
  await expect(page.locator('.v38-home')).toBeVisible({timeout:15000});
  await expect(page.locator('.asoboon-boot')).toHaveCount(0);
});


test('HOME updates 12:30 WEB and LINE quotas while left open without extra business-day calls',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
  const nativeSetTimeout=window.setTimeout.bind(window);
  window.setTimeout=(cb,ms,...args)=>nativeSetTimeout(cb,ms>=35000&&ms<=43000?190:ms,...args);
 });
 let calls=0;
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  const n=++calls;
  const web=n===1?71:Math.max(0,71-n*5),line=n===1?44:Math.max(0,44-n*4);
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,fetchedAt:'2026-10-03T03:00:00.000Z',
   slots:[
    {waitTypeId:'0030',waitTypeName:'10:00',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:195},
    {waitTypeId:'0032',waitTypeName:'12:30',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:web},
    {waitTypeId:'0034',waitTypeName:'15:00',slotKey:'15:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:25}
   ],observedDetails:[
    {detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:117,remainingVerified:true},
    {detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:line,remainingVerified:true},
    {detailedWaitType:'15時15分頃入場時間【土休日特定日】',reserveUnit:'PERSON',remaining:8,remainingVerified:true}
   ]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const card=page.locator('#v38Slots .v38-crowd-card').filter({hasText:'12:30回'});
 await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText(/\d+名/);
 await expect(page.locator('#v38CrowdAge')).toContainText('自動更新中');
 await expect.poll(()=>calls,{timeout:5000}).toBeGreaterThanOrEqual(2);
 await expect(card.locator('.v38-crowd-channel--web strong')).not.toHaveText('71名');
 await expect(card.locator('.v38-crowd-channel--onsite strong')).not.toHaveText('44名');
 await expect(page.locator('#v38CrowdUpdate')).toBeVisible();
 const before=calls;
 await page.locator('#v38CrowdUpdate').click();
 await expect.poll(()=>calls).toBeGreaterThan(before);
 await card.click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
 const after=calls;await page.waitForTimeout(500);expect(calls).toBe(after);
});
test('HOME marks stale AirWAIT quota unverified instead of displaying stale capacity as current',async({page})=>{
 await installProduction(page);
 let reads=0;
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  if(++reads>1)return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"AIRWAIT_UNAVAILABLE"}'});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:true,staleAgeMs:180000,fetchedAt:'2026-10-03T02:57:00.000Z',
   slots:[{waitTypeId:'0032',waitTypeName:'12:30',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:71}],
   observedDetails:[{detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:44,remainingVerified:true}]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const card=page.locator('#v38Slots .v38-crowd-card').filter({hasText:'12:30回'});
 await expect(card).toBeVisible();
 await expect(page.locator('#v38CrowdAge')).toContainText('最新の取得に失敗しました');
 await expect(card.locator('.v38-crowd-channel--web strong')).toContainText('確認中');
 await expect(card.locator('.v38-crowd-channel--onsite strong')).toContainText('確認中');
 await expect(card).not.toContainText('71名');
 await expect(card).not.toContainText('44名');
 const previous=await page.evaluate(()=>JSON.parse(localStorage.getItem('asoboon_v2_crowd_snapshot_production_v1')||'{}'));
 expect(previous.verifiedFresh).toBe(false);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38CrowdAge')).toContainText('自動で再確認');
 await expect(card.locator('.v38-crowd-channel--web strong')).toContainText('確認中');
 await expect(card.locator('.v38-crowd-channel--onsite strong')).toContainText('確認中');
 await card.click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
});
test('HOME shows manual refresh cooldown during 429 backoff instead of silently ignoring taps',async({page})=>{
 await installProduction(page);
 let reads=0;
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  reads++;
  if(reads>1)return route.fulfill({status:429,contentType:'application/json',body:'{"ok":false,"error":"RATE_LIMITED"}'});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,
   slots:[{waitTypeId:'0032',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:71}],
   observedDetails:[{detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:44,remainingVerified:true}]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const button=page.locator('#v38CrowdUpdate');
 await expect(button).toBeEnabled();
 await button.click();
 await expect(button).toBeDisabled();
 await expect(page.locator('#v38CrowdAge')).toContainText('自動で再確認');
 await page.waitForTimeout(200);
 expect(reads).toBe(2);
});
test('HOME shows separate WEB and onsite remaining counts from the same existing crowd API response',async({page})=>{
  const actions=[];
  page.on('request',r=>{if(r.url().includes('action=crowdRemaining'))actions.push(r.url())});
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const box=page.locator('#v38Slots');
  await expect(box.locator('.v38-crowd-card')).toHaveCount(3);
  for(const [time,web,onsite] of [['10:00',195,117],['12:30',71,44],['15:00',25,8]]){
    const card=box.locator('.v38-crowd-card').filter({hasText:time+'回'});
    await expect(card.locator('.v38-crowd-remaining-title')).toHaveText('受付残り');
    await expect(card).toHaveAttribute('aria-label',new RegExp('WEB受付の残り'+web+'名.*LINE受付の残り'+onsite+'名'));
    await expect(card.locator('.v38-crowd-channel--web')).toContainText('WEB受付');
    await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText(web+'名');
    await expect(card.locator('.v38-crowd-channel--onsite')).toContainText('LINE受付');
    await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText(onsite+'名');
    await expect(card.locator('[role="progressbar"]')).toHaveCount(0); // no fabricated occupancy percentage
  }
  await expect(box).toContainText('人数は各受付枠の残りです。');
  expect(actions.length).toBe(1); // no additional Worker calls for onsite
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    await expect(box.locator('.v38-crowd-channel--onsite').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  if(process.env.ASOBOON_CROWD_SCREENSHOT==='1')await page.screenshot({path:'/tmp/asoboon-crowd-web-onsite.png',fullPage:true});
});

test('12:30 LINE verified zero is shown as 0名; crowded card advertises navigation to reception',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,slots:[
    {waitTypeId:'0032',waitTypeName:'12時半ご入場枠【WEB整理券】',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:0},
    {waitTypeId:'0034',waitTypeName:'15時ご入場枠【WEB整理券】',slotKey:'15:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:0}
   ],
   observedDetails:[
    {detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:0,remainingVerified:true},
    {detailedWaitType:'15時15分頃入場時間【土休日特定日】',reserveUnit:'PERSON',remaining:39,remainingVerified:true}
   ]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v38-today-section>h2')).toHaveCount(0);
 await expect(page.locator('#v38Today')).toBeVisible();
 const box=page.locator('#v38Slots');
 const c1230=box.locator('.v38-crowd-card').filter({hasText:'12:30回'});
 await expect(c1230).toBeVisible();
 await expect(c1230.locator('.v38-crowd-channel--web strong')).toHaveText('0名');
 await expect(c1230.locator('.v38-crowd-channel--onsite strong')).toHaveText('0名');
 await expect(c1230.locator('.v38-crowd-go')).toContainText('受付画面へ進む');
 await expect(c1230).toHaveAttribute('aria-label',/LINE受付の残り0名.*タップして受付画面へ進む/);
 const c1500=box.locator('.v38-crowd-card').filter({hasText:'15:00回'});
 await expect(c1500.locator('.v38-crowd-channel--onsite strong')).toHaveText('39名');
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  const button=await c1230.locator('.v38-crowd-go').boundingBox();
  expect(button.height).toBeGreaterThanOrEqual(47);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 await c1230.click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
 await expect(page.locator('#recSubmit')).toBeVisible();
});
test('Legacy or unverified zero remains 確認中 rather than reporting fabricated capacity',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,slots:[{waitTypeId:'0032',waitTypeName:'12時半ご入場枠【WEB整理券】',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:0}],
   observedDetails:[{detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:0}]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const card=page.locator('#v38Slots .v38-crowd-card').filter({hasText:'12:30回'});
 await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText('確認中');
});
test('Missing, ambiguous or invalid onsite rows show 確認中 instead of false zeroes or the WEB remaining count',async({page})=>{
  await installProduction(page);
  await page.route(GATEWAY+'**',async route=>{
    if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,slots:[
        {waitTypeId:'0030',waitTypeName:'10時ご入場枠【WEB整理券】',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:100},
        {waitTypeId:'0032',waitTypeName:'12時半ご入場枠【WEB整理券】',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:0},
        {waitTypeId:'0034',waitTypeName:'15時ご入場枠【WEB整理券】',slotKey:'15:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:200}
      ],observedDetails:[
        {detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:60},
        {detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:80},
        {detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'GROUP',remaining:7},
        {detailedWaitType:'15時15分頃入場時間【土休日特定日】',reserveUnit:'PERSON',remaining:0}
      ]
    })});
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
  for(const time of ['10:00','12:30','15:00']){
    const card=page.locator('.v38-crowd-card').filter({hasText:time+'回'});
    await expect(card.locator('.v38-crowd-channel--onsite')).toContainText('確認中');
    await expect(card.locator('.v38-crowd-channel--onsite')).not.toContainText('0名');
    await expect(card).toHaveAttribute('aria-label',/LINE受付の残り確認中/);
  }
  await expect(page.locator('.v38-crowd-card').filter({hasText:'12:30回'}).locator('.v38-crowd-channel--web strong')).toHaveText('0名');
});

test('Onsite-only verified pool remains visible while unsafe online time-key match is hidden',async({page})=>{
  await installProduction(page);
  await page.route(GATEWAY+'**',async route=>{
    if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,slots:[
        {waitTypeId:'0030',waitTypeName:'10時ご入場枠【WEB整理券】',slotKey:'10:00',detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'time-key',remaining:75}
      ],observedDetails:[{detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:75}]
    })});
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const card=page.locator('#v38Slots .v38-crowd-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.v38-crowd-channel--web')).toContainText('確認中');
  await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText('75名');
  await expect(card.locator('[role="progressbar"]')).toHaveCount(0);
  await card.click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
});

test('Weekday and special-day local pools use their own exact AirWAIT type names without mixing slots',async({page})=>{
  await installProduction(page);
  await page.route(GATEWAY+'**',async route=>{
    const action=new URL(route.request().url()).searchParams.get('action');
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(action==='businessDay')return json({ok:true,operationalDate:'2026-10-03',businessType:'平日特定日',durationLabel:'3時間',closingTime:'17:00'});
    if(action!=='crowdRemaining')return route.fallback();
    return json({ok:true,slots:[
      {waitTypeId:'0036',waitTypeName:'10時ご入場枠【WEB平日特定日】',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:140},
      {waitTypeId:'0038',waitTypeName:'13時半ご入場枠【WEB平日特定日】',slotKey:'13:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:80}
    ],observedDetails:[
      {detailedWaitType:'10時15分から【平日特定日】',reserveUnit:'PERSON',remaining:59},
      {detailedWaitType:'13時45分から【平日特定日】',reserveUnit:'PERSON',remaining:22},
      {detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:1},
    ]});
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const cards=page.locator('#v38Slots .v38-crowd-card');
  await expect(cards).toHaveCount(2);
  for(const [time,web,onsite] of [['10:00',140,59],['13:30',80,22]]){
    const card=cards.filter({hasText:time+'回'});
    await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText(web+'名');
    await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText(onsite+'名');
  }
  await expect(page.locator('#v38Slots')).not.toContainText('12:30回');
});

test('Recent verified HOME cache can bridge a brief AirWAIT outage without inventing values',async({page})=>{
  await installProduction(page);
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_crowd_snapshot_production_v1',JSON.stringify({
      slots:[{waitTypeId:'0030',waitTypeName:'10時ご入場枠【WEB整理券】',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:25}],
      details:[{detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:14}],
      operationalDate:'2026-10-03',businessType:'土日祝日',savedAt:Date.now(),verifiedFresh:true
    }));
  });
  await page.route(GATEWAY+'**',async route=>{
    if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
    await route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const card=page.locator('#v38Slots .v38-crowd-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText('25名');
  await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText('14名');
});

for(const state of ['canceled','done']){
 test('Terminal '+state+' exposes re-reception on call-status page, not HOME',async({page})=>{
  await installProduction(page,{status:{
    ok:true,found:true,state,receiptNo:'F998',businessDate:'2026-10-03',
    waitTypeId:'0033',waitTypeName:'15:00の回',checkedAt:Date.parse('2026-10-03T03:00:00Z')
  }});
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'F998',waitTypeId:'0033'
    }));
    localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'F998',waitTypeId:'0033',
      sessionToken:'r'.repeat(40),expiresAt:4102444800000
    }));
  });
  await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#csRebookArea')).toBeVisible();
  await expect(page.locator('#csRebook')).toContainText('もう一度受付する');
  await page.locator('#csRebook').click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
  await expect(page.locator('#recSubmit')).toBeVisible();
 });
}
test('Active waiting call-state does not offer a second reception',async({page})=>{
 await installProduction(page,{status:{
   ok:true,found:true,state:'waiting',receiptNo:'F998',businessDate:'2026-10-03',
   waitTypeId:'0033',waitTypeName:'15:00の回',aheadCount:8,queueRank:9,
   activeCount:40,checkedAt:Date.parse('2026-10-03T03:00:00Z')
 }});
 await page.addInitScript(()=>{
   localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
     businessDate:'2026-10-03',receiptNo:'F998',waitTypeId:'0033'
   }));
   localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
     businessDate:'2026-10-03',receiptNo:'F998',waitTypeId:'0033',
     sessionToken:'r'.repeat(40),expiresAt:4102444800000
   }));
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#csTitle')).toContainText('順番をお待ち');
 await expect(page.locator('#csRebookArea')).toBeHidden();
});

test('Slow call-status responses show elapsed activity and recover without freezing',async({page})=>{
 test.setTimeout(30000);
 await installProduction(page);
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
    businessDate:'2026-10-03',receiptNo:'F333',waitTypeId:'0033'
  }));
  localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
    businessDate:'2026-10-03',receiptNo:'F333',waitTypeId:'0033',
    sessionToken:'s'.repeat(40),expiresAt:4102444800000
  }));
 });
 let count=0;
 await page.route(GATEWAY+'**',async route=>{
  const action=new URLSearchParams(route.request().postData()||'').get('action');
  if(action!=='reservationStatus')return route.fallback();
  count++;
  await new Promise(resolve=>setTimeout(resolve,9000));
  return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,found:true,state:'waiting',receiptNo:'F333',businessDate:'2026-10-03',
      waitTypeId:'0033',waitTypeName:'15:00の回',aheadCount:27,queueRank:28,activeCount:50,checkedAt:Date.now()})
  });
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#csHeartbeat')).toBeVisible();
 await expect(page.locator('#csHeartbeatLabel')).toContainText('最新の呼出状況を確認中');
 await expect(page.locator('#csHeartbeatLabel')).toContainText('確認が続いています',{timeout:12000});
 await expect(page.locator('#csTitle')).toContainText('順番をお待ち',{timeout:18000});
 await expect(page.locator('#csHeartbeatLabel')).toContainText('次の再確認まで');
 expect(count).toBe(1);
});
test('Rate-limited status requests visibly cool down and manual taps do not hammer the shared IP',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
    businessDate:'2026-10-03',receiptNo:'F444',waitTypeId:'0033'
  }));
  localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
    businessDate:'2026-10-03',receiptNo:'F444',waitTypeId:'0033',
    sessionToken:'t'.repeat(40),expiresAt:4102444800000
  }));
 });
 let count=0;
 await page.route(GATEWAY+'**',async route=>{
  const action=new URLSearchParams(route.request().postData()||'').get('action');
  if(action!=='reservationStatus')return route.fallback();
  count++;
  return route.fulfill({status:429,contentType:'application/json',body:'{"ok":false,"error":"RATE_LIMITED"}'});
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#csError')).toContainText('アクセスが集中');
 await expect(page.locator('#csHeartbeatLabel')).toContainText('次の再確認まで');
 expect(count).toBe(1);
 await page.locator('#csRefresh').click();
 await expect(page.locator('#csError')).toContainText('自動で再確認');
 await page.waitForTimeout(300);
 expect(count).toBe(1);
 await page.getByRole('button',{name:'新HOMEへ戻る'}).click();
 await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toBeVisible();
 await page.locator('#v38Hero [data-v7-view="callstatus"]').click();
 await expect(page.locator('#csHeartbeatLabel')).toContainText('次の再確認まで');
 await page.waitForTimeout(300);
 expect(count).toBe(1);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#csHeartbeatLabel')).toContainText('次の再確認まで');
 await page.waitForTimeout(300);
 expect(count).toBe(1);
});
test('Call status automatically updates waiting → calling → done while screen stays open',async({page})=>{
 test.setTimeout(65000);
 await installProduction(page);
 let polls=0;
 await page.route(GATEWAY+'**',async route=>{
   const action=new URLSearchParams(route.request().postData()||'').get('action');
   if(action!=='reservationStatus')return route.fallback();
   polls++;
   const state=polls===1?'waiting':polls===2?'calling':'done';
   const result={ok:true,found:true,state,receiptNo:'F222',businessDate:'2026-10-03',waitTypeId:'0033',
     waitTypeName:'15:00の回',aheadCount:state==='waiting'?1:0,queueRank:state==='waiting'?2:1,
     activeCount:10,checkedAt:Date.parse('2026-10-03T03:00:00Z')};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.addInitScript(()=>{
   localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
     businessDate:'2026-10-03',receiptNo:'F222',waitTypeId:'0033'
   }));
   localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
     businessDate:'2026-10-03',receiptNo:'F222',waitTypeId:'0033',sessionToken:'d'.repeat(40),expiresAt:4102444800000
   }));
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#csTitle')).toContainText('順番をお待ち');
 await expect.poll(()=>polls,{timeout:18000}).toBeGreaterThanOrEqual(2);
 await expect(page.locator('#csTitle')).toContainText('入場できます');
 await expect.poll(()=>polls,{timeout:28000}).toBeGreaterThanOrEqual(3);
 await expect(page.locator('#csTitle')).toContainText('ご案内済み');
 await expect(page.locator('#csTop')).toContainText('自動更新を終了');
});

test('Call status displays a large call-time reference and route from scheduled slot to the guest',async({page})=>{
  const checkedAt=Date.parse('2026-10-03T03:00:00.000Z'); // JST 12:00
  await installProduction(page,{status:{
    ok:true,found:true,state:'waiting',receiptNo:'F123',businessDate:'2026-10-03',
    waitTypeId:'0033',waitTypeName:'15:00の回',aheadCount:50,queueRank:51,
    activeCount:100,checkedAt
  }});
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'F123',waitTypeId:'0033'
    }));
    localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'F123',waitTypeId:'0033',
      sessionToken:'c'.repeat(40),expiresAt:4102444800000
    }));
  });
  await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#csForecast')).toBeVisible();
  await expect(page.locator('.v33-start-eta')).toHaveCount(0);
  await expect(page.locator('#csForecastClock')).toHaveText('15:20');
  await expect(page.locator('#csForecastStart')).toHaveText('呼出開始 15:00');
  await expect(page.locator('#csForecastTarget')).toContainText('15:20ごろ');
  await expect(page.locator('#csForecastNote')).toContainText('参考');
  await expect(page.locator('#csAhead')).toHaveText('50');
  if(process.env.ASOBOON_FORECAST_SCREENSHOT==='1'){
    await page.screenshot({path:'/tmp/asoboon-call-forecast-home-390.png',fullPage:true});
  }
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    await expect(page.locator('#csForecast')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
});

test('Call-time forecast is hidden as soon as the customer is actually being called',async({page})=>{
  const checkedAt=Date.parse('2026-10-03T03:00:00.000Z');
  await installProduction(page,{status:{
    ok:true,found:true,state:'calling',receiptNo:'F123',businessDate:'2026-10-03',
    waitTypeId:'0033',waitTypeName:'15:00の回',aheadCount:0,queueRank:1,
    activeCount:100,checkedAt
  }});
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'F123',waitTypeId:'0033'
    }));
    localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'F123',waitTypeId:'0033',
      sessionToken:'c'.repeat(40),expiresAt:4102444800000
    }));
  });
  await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#csTitle')).toContainText('入場できます');
  await expect(page.locator('#csForecast')).toBeHidden();
});

test('Confirm sends to authoritative Gateway directly without a duplicate business-day request',async({page})=>{
  await installProduction(page);
  const network=[];
  let counting=false;
  await page.route(GATEWAY+'**',async route=>{
    const u=new URL(route.request().url());
    const body=new URLSearchParams(route.request().postData()||'');
    const action=u.searchParams.get('action')||body.get('action');
    if(counting&&action)network.push(action);
    if(action==='createReservation'){
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        ok:true,stored:true,receiptNo:'F321',reserveId:'A123456789',
        businessDate:'2026-10-03',waitTypeId:body.get('waitTypeId'),
        notificationReady:true
      })});
    }
    return route.fallback();
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('[data-v7-view="reception"]').first().click();
  await expect(page.locator('#recStatus')).toContainText('受付できます');
  await page.locator('#recSlots [data-rec-slot]').first().click();
  await page.locator('#recAgree').check();
  await expect(page.locator('#recSubmit')).toBeEnabled();
  counting=true;
  await page.locator('#recSubmit').click();
  await expect.poll(()=>network.includes('createReservation')).toBe(true);
  await expect.poll(()=>page.evaluate(()=>{
    return JSON.parse(localStorage.getItem('asoboon_v2_current_reservation_production_v1')||'null')?.receiptNo
  })).toBe('F321');
  expect(network.filter(a=>a==='businessDay')).toEqual([]);
  expect(network.filter(a=>a==='createReservation')).toHaveLength(1);
});


test('Reception explains the real wait without fake progress, keeps one request, and locks inputs',async({page})=>{
 await installProduction(page);
 let releaseCreate=null;
 const network=[];
 await page.route(GATEWAY+'**',async route=>{
   const u=new URL(route.request().url()),body=new URLSearchParams(route.request().postData()||'');
   const action=u.searchParams.get('action')||body.get('action');
   if(action!=='createReservation')return route.fallback();
   network.push(body.get('requestId'));
   await new Promise(resolve=>{
     releaseCreate=async()=>{
       await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
         ok:true,stored:true,receiptNo:'F901',reserveId:'A901234567',businessDate:'2026-10-03',
         waitTypeId:body.get('waitTypeId'),notificationReady:true
       })});
       resolve();
     };
   });
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('[data-v7-view="reception"]').first().click();
 await expect(page.locator('#recStatus')).toContainText('受付できます');
 await page.locator('#recSlots [data-rec-slot]').first().click();
 await page.locator('#recAgree').check();
 await page.locator('#recSubmit').click();
 await expect(page.locator('#recProcessing')).toBeVisible();
 await expect(page.locator('#recProcessingTitle')).toContainText('受付番号の発行を依頼');
 await expect(page.locator('#recProcessingWhy')).toContainText('二重受付');
 await expect(page.locator('#recProcessingStep1')).toHaveClass(/is-done/);
 await expect(page.locator('#recProcessingStep2')).toHaveClass(/is-active/);
 await expect(page.locator('#recAgree')).toBeDisabled();
 await expect(page.locator('#recSlots [data-rec-slot]').first()).toBeDisabled();
 await expect(page.locator('[data-rec-k]').first()).toBeDisabled();
 await expect(page.locator('#recSubmit')).toBeDisabled();
 expect(await page.locator('#recProcessing').getAttribute('role')).toBe('status');
 expect(await page.locator('#recProcessing').textContent()).not.toMatch(/100%|完了しました|発行済み/);
 for(const width of [320,375,390,430]){
   await page.setViewportSize({width,height:844});
   await expect(page.locator('#recProcessing')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 if(process.env.ASOBOON_WAITUX_SCREENSHOT==='1'){
   await page.screenshot({path:'/tmp/asoboon-waitux-390.png',fullPage:true});
 }
 await expect.poll(()=>typeof releaseCreate).toBe('function');
 await releaseCreate();
 await expect.poll(()=>page.evaluate(()=>{
  return JSON.parse(localStorage.getItem('asoboon_v2_current_reservation_production_v1')||'null')?.receiptNo
 })).toBe('F901');
 await expect(page.locator('#recProcessing')).toBeHidden();
 expect(network).toHaveLength(1);
});


for(const status of [
  {state:'waiting',tone:'waiting',label:'順番を',rgb:'rgb(219, 224, 228)',ink:'rgb(52, 69, 84)'},
  {state:'calling',tone:'calling',label:'入場できます',rgb:'rgb(215, 236, 255)',ink:'rgb(19, 89, 152)'},
  {state:'done',tone:'done',label:'ご案内済み',rgb:'rgb(216, 244, 220)',ink:'rgb(23, 101, 58)'},
  {state:'canceled',tone:'canceled',label:'取消',rgb:'rgb(255, 224, 223)',ink:'rgb(165, 35, 41)'},
  {state:'closed',tone:'loading',label:'本日の受付は終了',rgb:'rgb(242, 240, 233)',ink:'rgb(85, 85, 76)'}
]){
  test('LINE call screen uses full-page '+status.tone+' verified status colors without stale foreground',async({page})=>{
    const stamp=Date.parse('2026-10-03T03:00:00.000Z');
    await installProduction(page,{status:{
      ok:true,found:true,state:status.state,receiptNo:'F123',
      businessDate:'2026-10-03',waitTypeId:'0033',
      waitTypeName:'15:00の回',aheadCount:12,queueRank:13,activeCount:80,checkedAt:stamp
    }});
    await page.addInitScript(()=>{
      localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
        businessDate:'2026-10-03',receiptNo:'F123',waitTypeId:'0033'
      }));
      localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
        businessDate:'2026-10-03',receiptNo:'F123',waitTypeId:'0033',
        sessionToken:'c'.repeat(40),expiresAt:4102444800000
      }));
    });
    await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
    await expect(page.locator('body')).toHaveAttribute('data-asoboon-call-tone',status.tone);
    await expect(page.locator('#csState')).toContainText(status.label);
    const colors=await page.evaluate(()=>({
      body:getComputedStyle(document.body).backgroundColor,
      page:getComputedStyle(document.querySelector('.cs-page')).backgroundColor,
      card:getComputedStyle(document.querySelector('#csState')).backgroundColor,
      head:getComputedStyle(document.querySelector('.cs-page .page-head.green')).backgroundColor,
      overflow:document.documentElement.scrollWidth>innerWidth
    }));
    expect(colors.body).toBe(status.rgb);
    expect(colors.page).toBe(status.rgb);
    expect(colors.head).toBe(status.ink);
    expect(colors.overflow).toBe(false);
    if(status.state!=='waiting')await expect(page.locator('#csForecast')).toBeHidden();
    if(process.env.ASOBOON_COLOR_SCREENSHOTS==='1')await page.screenshot({path:'/tmp/asoboon-status-'+status.tone+'.png',fullPage:true});
    for(const width of [320,375,390,430]){
      await page.setViewportSize({width,height:844});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  });
}

test('LINE call status keeps a neutral background if the reservation cannot be verified',async({page})=>{
  await installProduction(page);
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'F123',waitTypeId:'0033'
    }));
    localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'F123',waitTypeId:'0033',
      sessionToken:'c'.repeat(40),expiresAt:4102444800000
    }));
  });
  await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toHaveAttribute('data-asoboon-call-tone','loading');
  await expect(page.locator('#csForecast')).toBeHidden();
  await page.getByRole('button',{name:'新HOMEへ戻る'}).click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('home');
  await expect(page.locator('body')).not.toHaveAttribute('data-asoboon-call-tone',/.+/);
});

test('2510 regression: combined WEB+LINE queue shows 49 groups ahead and a later reference clock, never LINE-only 4',async({page})=>{
  const checkedAt=Date.parse('2026-10-03T03:00:00.000Z');
  await installProduction(page,{status:{
    ok:true,found:true,state:'waiting',receiptNo:'2510',businessDate:'2026-10-03',
    waitTypeId:'0033',waitTypeName:'15:00の回',queueScope:'combined-web-line',
    queueSources:['WEB受付','LINE受付'],aheadCount:49,queueRank:59,activeCount:63,checkedAt
  }});
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'2510',waitTypeId:'0033'
    }));
    localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'2510',waitTypeId:'0033',
      sessionToken:'c'.repeat(40),expiresAt:4102444800000
    }));
  });
  await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#csReceipt')).toHaveText('2510');
  await expect(page.locator('#csAhead')).toHaveText('49');
  await expect(page.locator('#csRank')).toHaveText('59');
  await expect(page.locator('#csTotal')).toContainText('63組中');
  await expect(page.locator('#csQueue')).toContainText('WEB＋LINE');
  await expect(page.locator('#csForecastClock')).toHaveText('15:25');
  await expect(page.locator('#csForecastMode')).toContainText('順番からの目安');
  await expect(page.locator('body')).toHaveAttribute('data-asoboon-call-tone','waiting');
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
});

test('Unverified cross-channel queue does not silently show 0 groups or an ungrounded call time',async({page})=>{
  const checkedAt=Date.parse('2026-10-03T03:00:00.000Z');
  await installProduction(page,{status:{
    ok:true,found:true,state:'waiting',receiptNo:'2510',businessDate:'2026-10-03',
    waitTypeId:'0033',waitTypeName:'15:00の回',queueScope:'unverified',
    aheadCount:null,queueRank:null,activeCount:null,checkedAt
  }});
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'2510',waitTypeId:'0033'
    }));
    localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
      businessDate:'2026-10-03',receiptNo:'2510',waitTypeId:'0033',
      sessionToken:'c'.repeat(40),expiresAt:4102444800000
    }));
  });
  await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#csAhead')).toHaveText('—');
  await expect(page.locator('#csRank')).toHaveText('—');
  await expect(page.locator('#csQueue')).toContainText('待ち順を確認中');
  await expect(page.locator('#csForecast')).toBeHidden();
  await expect(page.locator('#csMessage')).toContainText('WEB受付とLINE受付の待ち順');
  await page.getByRole('button',{name:'新HOMEへ戻る'}).click();
  await expect(page.locator('.v38-home')).toBeVisible();
  await expect(page.locator('#v38Hero')).toHaveClass(/call-link/);
  await expect(page.locator('#v38Hero')).not.toContainText('2510');
  await expect(page.locator('#v38Hero')).not.toContainText('あと0組');
  await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toHaveCount(1);
});

test('Five-language switch translates HOME, persists through navigation, and restores Japanese',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const picker=page.locator('#asoboon-language-select');
 await expect(picker).toBeVisible();
 expect(await picker.locator('option').count()).toBe(7);
 const labels={
  en:'Check queue status',
  'zh-CN':'查看叫号状态',
  vi:'Kiểm tra lượt gọi',
  ne:'पालोको अवस्था हेर्नुहोस्',
  ko:'호출 현황 확인하기',
  kmr:'Rewşa gazîkirinê bibîne'
 };
 for(const [lang,label] of Object.entries(labels)){
  await picker.selectOption(lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#v38Hero .v38-call-cta')).toContainText(label);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
  expect(overflow).toBe(true);
 }
 await picker.selectOption('en');
 await page.locator('[data-v7-view="reception"]').first().click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');

 await expect(page.locator('#recSlots')).toContainText('12:30 session');
 await expect(page.locator('h3.rec-title').first()).toHaveText('Select a session');
 await expect(picker).toHaveValue('en');
 await page.locator('[data-rec-slot="0031"]').click();
 await page.locator('[data-rec-k="child"][data-rec-d="1"]').click();
 await page.locator('#recAgree').check();
 await expect(page.locator('#recChild')).toHaveText('1');
 await picker.selectOption('vi');
 await expect(page.locator('h3.rec-title').first()).toHaveText('Chọn lượt chơi');
 await expect(page.locator('#recChild')).toHaveText('1');
 await expect(page.locator('#recAgree')).toBeChecked();
 await expect(page.locator('[data-rec-slot="0031"]')).toHaveClass(/active/);
 await picker.selectOption('ja');
 await expect(page.locator('h3.rec-title').first()).toHaveText('ご利用の回');
 await expect(page.locator('#recChild')).toHaveText('1');
 await expect(page.locator('#recAgree')).toBeChecked();
 await picker.selectOption('ne');
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#asoboon-language-select')).toHaveValue('ne');
 await expect(page.locator('h3.rec-title').first()).toHaveText('समयको पालो छान्नुहोस्');
 await picker.selectOption('ja');
});

test('Five-language call-status keeps ticket number and cancellation controls intact',async({page})=>{
 await installProduction(page,{status:{ok:true,found:true,state:'waiting',receiptNo:'F345',
  businessDate:'2026-10-03',waitTypeId:'0031',waitTypeName:'12:30の回',
  aheadCount:6,queueRank:7,activeCount:80,checkedAt:Date.now()}});
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
   receiptNo:'F345',businessDate:'2026-10-03',waitTypeId:'0031',waitTypeName:'12:30の回'
  }));
  localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
   businessDate:'2026-10-03',receiptNo:'F345',waitTypeId:'0031',
   sessionToken:'s'.repeat(40),expiresAt:4102444800000
  }));
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 const picker=page.locator('#asoboon-language-select');
 await expect(page.locator('#csReceipt')).toHaveText('F345');

 for(const [lang,expected] of Object.entries({
  en:'Queue status','zh-CN':'叫号状态',vi:'Tình trạng gọi số',ne:'पालोको अवस्था',
  ko:'호출 현황',kmr:'Rewşa gazîkirinê'
 })){
  await picker.selectOption(lang);
  await expect(page.locator('.cs-page .page-head h2')).toHaveText(expected);
  await expect(page.locator('#csReceipt')).toHaveText('F345');
  await expect(page.locator('#csCancel')).toBeVisible();
 }
 await picker.selectOption('en');
 await page.locator('#csCancel').click();
 await expect(page.locator('#csCancelTitle')).toHaveText('Cancel this ticket?');
 await expect(page.locator('#csCancelReceipt')).toHaveText('F345');
 await page.locator('.cs-cancel-dismiss').click();
 await expect(page.locator('#csCancelDialog')).toBeHidden();
});

test('Language selector does not alter booking issuance or invent translated other pages',async({page})=>{
 await installProduction(page);
 let creates=0;
 page.on('request',r=>{
  if(new URLSearchParams(r.postData()||'').get('action')==='createReservation')creates++;
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#asoboon-language-select').selectOption('zh-CN');
 await page.locator('[data-v7-view="first"]').first().click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('first');
 await expect(page.locator('#asoboon-language-note')).toContainText('仅提供日语');
 await expect(page.locator('html')).toHaveAttribute('lang','ja');
 await page.getByRole('button',{name:'新HOMEへ戻る'}).click();
 await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');
 expect(creates).toBe(0);
});

test('I18N translation coverage audit core screens',async({page})=>{
 test.setTimeout(60000);
 await installProduction(page,{status:{ok:true,found:true,state:'waiting',receiptNo:'F345',businessDate:'2026-10-03',
 waitTypeId:'0031',waitTypeName:'12:30の回',aheadCount:8,queueRank:9,activeCount:100,checkedAt:Date.now()}});
 await page.addInitScript(()=>{
 localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({receiptNo:'F345',businessDate:'2026-10-03',waitTypeId:'0031'}));
 localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
 businessDate:'2026-10-03',receiptNo:'F345',waitTypeId:'0031',sessionToken:'x'.repeat(40),expiresAt:4102444800000
 }));
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 for(const target of ['home','reception','callstatus']){
  if(target!=='home'){
   await page.evaluate(target=>window.ASOBOON_V2_NAVIGATE?.(target),target);
   if(new URL(page.url()).searchParams.get('view')!==target){
    await page.goto(BASE+'?view='+target,{waitUntil:'domcontentloaded'});
   }
   await expect(page.locator(target==='reception'?'#recSubmit':'#csReceipt')).toBeVisible();
  }
  for(const code of ['en','zh-CN','vi','ne']){
   await page.locator('#asoboon-language-select').selectOption(code);
   await page.waitForTimeout(200);
   const missing=await page.evaluate(()=>window.ASOBOON_I18N.missing());
   console.log('I18N_COVERAGE',target,code,JSON.stringify(missing));
  }
 }
});

test('Multilingual HOME/reception/callstatus remain usable at narrow mobile widths',async({page})=>{
 test.setTimeout(45000);
 await installProduction(page,{status:{ok:true,found:true,state:'waiting',receiptNo:'F345',businessDate:'2026-10-03',waitTypeId:'0031',waitTypeName:'12:30の回',aheadCount:9,queueRank:10,activeCount:80,checkedAt:Date.now()}});
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({receiptNo:'F345',businessDate:'2026-10-03',waitTypeId:'0031'}));
  localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({businessDate:'2026-10-03',receiptNo:'F345',waitTypeId:'0031',sessionToken:'q'.repeat(40),expiresAt:4102444800000}));
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const locales=['en','zh-CN','vi','ne','ko','kmr'];
 for(const view of ['home','reception','callstatus']){
  if(view!=='home')await page.goto(BASE+'?view='+view,{waitUntil:'domcontentloaded'});
  await expect(page.locator(view==='home'?'#v38Hero':view==='reception'?'#recSlots':'#csReceipt')).toBeVisible();
  for(const lang of locales){
   await page.locator('#asoboon-language-select').selectOption(lang);
   for(const width of [320,375,430]){
    await page.setViewportSize({width,height:740});
    await expect(page.locator('#asoboon-language-select')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+view+' '+lang+' '+width).toBe(true);
    if(view==='reception'){
      await expect(page.locator('.rec-disclaimer')).toBeVisible();
      await expect(page.locator('#asoboon-japanese-legal-original')).toHaveCount(1);
      if(lang==='ko'||lang==='kmr')await expect(page.locator('#asoboon-language-note')).toBeVisible();
      await expect(page.locator('#recSubmit')).toBeVisible();
    }
    if(view==='callstatus')await expect(page.locator('#csReceipt')).toHaveText('F345');
   }
  }
 }
 await page.locator('#asoboon-language-select').selectOption('ja');
 await expect(page.locator('#asoboon-japanese-legal-original')).toHaveCount(0);
});

test('Official home.html loads the real hashed language assets without requiring a restart or second reception',async({page})=>{
 await installProduction(page);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const responseCodes={};
 page.on('response',response=>{
  if(response.url().includes('/shared/i18n-'))responseCodes[response.url().split('?')[0]]=response.status();
 });
 await page.goto('http://127.0.0.1:4173/home.html',{waitUntil:'domcontentloaded'});
 const picker=page.locator('#asoboon-language-select');
 await expect(picker).toBeVisible();
 await picker.selectOption('en');
 await expect(page.locator('#v38Hero')).toContainText('Check queue status');
 expect(Object.keys(responseCodes)).toHaveLength(2);
 expect(Object.values(responseCodes)).toEqual([200,200]);
 expect(errors).toEqual([]);
});

test('Optional language file outage never replaces Japanese reception or stops the official HOME',async({page})=>{
 await installCertifiedProduction(page);
 await page.route('**/miniapp-v2/shared/i18n-dictionary.js*',r=>r.abort());
 await page.goto('http://127.0.0.1:4173/home.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v38-home')).toBeVisible();
 await expect(page.locator('#v38Hero')).toContainText('当日受付');
 await expect(page.locator('#asoboon-language-select')).toHaveCount(0);
 await page.locator('[data-v7-view="reception"]').first().click();
 await expect(page.locator('#recSlots [data-rec-slot]')).toHaveCount(3);
 await expect(page.locator('#recSubmit')).toBeVisible();
});
test('Optional language runtime outage falls back to the working Japanese LINE reception',async({page})=>{
 await installCertifiedProduction(page);
 await page.route('**/miniapp-v2/shared/i18n-runtime.js*',r=>r.abort());
 await page.goto('http://127.0.0.1:4173/home.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toContainText('当日受付');
 await expect(page.locator('#asoboon-language-select')).toHaveCount(0);
 await page.locator('[data-v7-view="reception"]').first().click();
 await expect(page.locator('#recSlots [data-rec-slot]')).toHaveCount(3);
});

test('Five-language fallback and ambiguous-result warnings are never left in Japanese',async({page})=>{
 await installProduction(page);
 await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#recSubmit')).toBeVisible();
 const states=[
  '受付できる内容を確認しています…',
  '受付しています…',
  '現在受付できる枠がありません。最新の受付状況をご確認ください。',
  '受付結果を確認できません。AirWAIT側で成立している可能性があるため、新しい受付は行わないでください。',
 ];
 for(const locale of ['en','zh-CN','vi','ne']){
  await page.locator('#asoboon-language-select').selectOption(locale);
  for(const original of states){
   await page.locator('#recStatus').evaluate((el,value)=>{el.textContent=value},original);
   const expected=await page.evaluate(([key])=>window.ASOBOON_I18N.t(key),[original]);
   await expect(page.locator('#recStatus')).toHaveText(expected);
   expect(expected).not.toEqual(original);
  }
 }
});

test('HOME call-status button is gold and remains distinct from blue reception CTA',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const call=page.locator('#v38Hero .v38-call-cta');
 const reception=page.locator('#v38Hero [data-v7-view="reception"]');
 await expect(call).toBeVisible();
 await expect(reception).toBeVisible();
 const styles=await page.evaluate(()=>{
  const a=document.querySelector('#v38Hero .v38-call-cta');
  const b=document.querySelector('#v38Hero [data-v7-view="reception"]');
  return{background:getComputedStyle(a).backgroundImage,border:getComputedStyle(a).borderColor,
   other:getComputedStyle(b).backgroundImage,rect:a.getBoundingClientRect().toJSON()};
 });
 expect(styles.background).toContain('248, 213, 123'); // bright gold
 expect(styles.background).not.toEqual(styles.other);
 expect(styles.rect.width).toBeGreaterThan(220);
 await call.click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('callstatus');
});
test('HOME restores recently verified 12:30 capacity instantly without a second initial AirWAIT read',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_crowd_snapshot_production_v1',JSON.stringify({
   slots:[
    {waitTypeId:'0030',waitTypeName:'10:00',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:28},
    {waitTypeId:'0032',waitTypeName:'12:30',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:14},
    {waitTypeId:'0034',waitTypeName:'15:00',slotKey:'15:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:12}
   ],
   details:[],
   operationalDate:'2026-10-03',businessType:'土日祝日',
   savedAt:Date.now(),verifiedFresh:true
  }));
 });
 let crowdReads=0;
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')==='crowdRemaining')crowdReads++;
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const card=page.locator('#v38Slots .v38-crowd-card').filter({hasText:'12:30回'});
 await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText('14名');
 await expect(page.locator('#v38CrowdAge')).toContainText('自動更新中');
 expect(crowdReads).toBe(0);
});
test('Business calendar reuses a fully verified 45-minute snapshot and refreshes stale months',async({page})=>{
 await installCertifiedProduction(page);
 let apiReads=0;
 await page.route(GATEWAY+'**',async route=>{
  const u=new URL(route.request().url());
  if(u.searchParams.get('action')!=='businessDays')return route.fallback();
  apiReads++;
  const month=u.searchParams.get('month'),start=u.searchParams.get('from');
  const [year,mon]=month.split('-').map(Number);
  const final=new Date(Date.UTC(year,mon,0)).getUTCDate();
  const dates=Array.from({length:final-Number(start.slice(8,10))+1},(_,i)=>month+'-'+String(Number(start.slice(8,10))+i).padStart(2,'0'));
  const days=dates.map(date=>({
   ok:true,operationalDate:date,calendarDate:date,businessType:'土日祝日',
   closingTime:'18:00',durationLabel:'2時間30分',source:'test'
  }));
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,month,days,failedDates:[],complete:true})});
 });
 const cal='http://127.0.0.1:4173/miniapp-v2/production/business-calendar.html';
 await page.goto(cal,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#bcStatus')).toContainText('営業日API');
 expect(apiReads).toBe(1);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#bcStatus')).toContainText('保存済みの最新営業予定');
 expect(apiReads).toBe(1);
 await page.evaluate(()=>{
  const key='asoboon_business_calendar_month_v1';
  const data=JSON.parse(localStorage.getItem(key));
  for(const row of Object.values(data['2026-10'].days||{}))row.savedAt-=46*60*1000;
  localStorage.setItem(key,JSON.stringify(data));
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await expect.poll(()=>apiReads).toBe(2);
 await expect(page.locator('#bcStatus')).toContainText('営業日API');
});

test('HOME duplicate ASOBooN/Kawaguchi title is removed without hiding Language or other page navigation',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v38-home')).toBeVisible();
 await expect(page.locator('.topbar')).toBeHidden();
 await expect(page.locator('#asoboon-language-select')).toBeVisible();
 await expect(page.locator('#v38Hero .v38-call-cta')).toBeVisible();
 await page.locator('[data-v7-view="first"]').first().click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('first');
 await expect(page.locator('.topbar')).toBeVisible();
 await expect(page.locator('#asoboon-language-select')).toBeVisible();
});
test('HOME surfaces verified LINE capacity when the WEB wait type cannot be matched safely',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,fetchedAt:new Date().toISOString(),
   slots:[{waitTypeId:'0032',waitTypeName:'12時半ご入場枠【WEB整理券】',
    slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'alias-name',remaining:281}],
   observedDetails:[{detailedWaitType:'12時50分頃入場【土休日特定日】',
    reserveUnit:'PERSON',remaining:281,remainingVerified:true}]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const card=page.locator('#v38Slots .v38-crowd-card').filter({hasText:'12:30回'});
 await expect(card).toBeVisible();
 await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText('確認中');
 await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText('281名');
 await expect(card.locator('[role="progressbar"]')).toHaveCount(0);
 await card.click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
});

test('HOME manual refresh requests fresh AirWAIT confirmation, not the fast cached snapshot',async({page})=>{
 await installProduction(page);
 const requests=[];
 page.on('request',request=>{
  if(new URL(request.url()).searchParams.get('action')==='crowdRemaining')requests.push(new URL(request.url()));
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38CrowdUpdate')).toBeVisible();
 expect(requests.length).toBe(1);
 expect(requests[0].searchParams.get('refresh')).toBe(null);
 await page.locator('#v38CrowdUpdate').click();
 await expect.poll(()=>requests.length).toBe(2);
 expect(requests[1].searchParams.get('refresh')).toBe('manual');
});

// Official production ROOT must not wait for the external SDK before painting HOME.
test('Official ROOT paints the HOME before a delayed LIFF SDK resolves',async({page})=>{
  await installProduction(page);
  let releaseSdk,delivered=false;
  const hold=new Promise(resolve=>{releaseSdk=resolve});
  await page.route('https://static.line-scdn.net/liff/edge/2/sdk.js',async route=>{
    await hold;
    delivered=true;
    await route.fulfill({
      status:200,contentType:'application/javascript',
      body:"window.__profileCalls=0;window.liff={init:async()=>{},isInClient:()=>true,isLoggedIn:()=>true,getAccessToken:()=>null,getProfile:async()=>{window.__profileCalls++;return {displayName:'Not needed'}}};"
    });
  });
  try{
    await page.goto('http://127.0.0.1:4173/home.html',{waitUntil:'domcontentloaded'});
    await expect(page.locator('.v38-home')).toBeVisible({timeout:8000});
    await expect(page.locator('.v38-play-card')).toHaveCount(5);
    expect(delivered).toBe(false);
    expect(await page.evaluate(()=>Boolean(window.ASOBOON_LIFF_SDK_READY))).toBe(true);
  }finally{releaseSdk();}
  await expect.poll(()=>page.evaluate(()=>Boolean(window.liff))).toBe(true);
  await expect(page.locator('.v38-home')).toBeVisible();
  expect(await page.evaluate(()=>window.__profileCalls)).toBe(0);
});

test('Official ROOT shows business-day data before slow crowd API completes',async({page})=>{
  await installProduction(page);
  let releaseCrowd,requestedCrowd=false;
  const hold=new Promise(resolve=>{releaseCrowd=resolve});
  await page.route('https://asoboon-miniapp-v2-production-gateway.asoboon425.workers.dev/**',async route=>{
    if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
    requestedCrowd=true;
    await hold;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,slots:[{waitTypeId:'0030',waitTypeName:'10時ご入場枠【WEB整理券】',
      slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:195}],
      observedDetails:[],fetchedAt:'2026-10-03T03:00:00.000Z'
    })});
  });
  try{
    await page.goto('http://127.0.0.1:4173/home.html',{waitUntil:'domcontentloaded'});
    await expect(page.locator('.v38-home')).toBeVisible({timeout:8000});
    await expect.poll(()=>requestedCrowd).toBe(true);
    await expect(page.locator('#v38Today')).toContainText('2時間30分',{timeout:5000});
  }finally{releaseCrowd();}
});

test('Official ROOT recovers LINE identity when the SDK arrives after the six-second watchdog',async({page})=>{
  await installProduction(page);
  await page.addInitScript(()=>{
    window.__lateLiffEvents=[];
    window.addEventListener('asoboon:v2-liff-ready',event=>{
      window.__lateLiffEvents.push(event.detail);
    });
  });
  let releaseSdk;
  const hold=new Promise(resolve=>{releaseSdk=resolve});
  await page.route('https://static.line-scdn.net/liff/edge/2/sdk.js',async route=>{
    await hold;
    await route.fulfill({
      status:200,contentType:'application/javascript',
      body:"window.liff={init:async()=>{},isInClient:()=>true,isLoggedIn:()=>true,getAccessToken:()=>null,getProfile:async()=>{throw Error('Should not be required') }};"
    });
  });
  try{
    await page.goto('http://127.0.0.1:4173/home.html',{waitUntil:'domcontentloaded'});
    await expect(page.locator('.v38-home')).toBeVisible({timeout:8000});
    await page.waitForTimeout(6250);
    await expect(page.locator('.v38-home')).toBeVisible();
    expect(await page.evaluate(()=>window.__lateLiffEvents?.some(x=>x.liffReady===true))).toBe(false);
  }finally{releaseSdk();}
  await expect.poll(()=>page.evaluate(()=>window.__lateLiffEvents?.some(x=>x.liffReady===true)),{timeout:8000}).toBe(true);
  await expect(page.locator('.v38-home')).toBeVisible();
  // Local test origin deliberately differs from the certified production
  // endpoint, so canonicalization can report PRODUCTION_ENDPOINT_INVALID.
  // What matters here is that the late SDK no longer strands LIFF identity.
  expect(await page.evaluate(()=>window.__lateLiffEvents.at(-1).bootError)).not.toMatch(/LIFF_SDK_SLOW|LIFF_SDK_NOT_READY/);
});
