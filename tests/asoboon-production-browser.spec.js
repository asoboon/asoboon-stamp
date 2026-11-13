const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const BASE=`http://127.0.0.1:${process.env.ASOBOON_TEST_PORT||4173}/miniapp-v2/production/`;
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
      {waitTypeId:'0030',waitTypeName:'10:00 WEB',dispFlg:true,usageDispType:'KeyONLINE_RECEPTION_ONLY'},
      {waitTypeId:'0032',waitTypeName:'12:30 WEB',dispFlg:true,usageDispType:'KeyONLINE_RECEPTION_ONLY'},
      {waitTypeId:'0034',waitTypeName:'15:00 WEB',dispFlg:true,usageDispType:'KeyONLINE_RECEPTION_ONLY'},
    ]});
    if(action==='reservationStatus'&&status)return json(status);
    return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'TEST_NOT_IMPLEMENTED',action})});
  });
}

async function openGuideRoute(page,view){
 await page.locator('.cm-nav-tab[data-v7-view="guide"]').click();
 await expect(page.locator('.cm-hub h1')).toHaveText('ご利用案内');
 await page.locator('.cm-hub-list [data-v7-view="'+view+'"]').first().click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe(view);
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
  await expect(page.locator('.v38-legal')).not.toContainText('048-420-9780');
  await expect(page.locator('.v38-legal a[href^="tel:"]')).toHaveCount(0);
  await expect(page.locator('.v38-legal a[href^="https://comaam.jp"]')).toHaveAttribute('href','https://comaam.jp/privacy-policy/');
  await expect(page.locator('.v38-calendar-card').first()).toHaveAttribute('data-external','1');

  const routes=['first','parking','rules','entry','timeguide'];
  for(const view of routes){
    if(view==='first')await page.locator('.v38-first-shortcut [data-v7-view="first"]').click();
    else if(view==='timeguide')await page.locator('#v38TimeguideShortcut').click();
    else await openGuideRoute(page,view);
    await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe(view);
    await expect.poll(()=>page.evaluate(()=>window.ASOBOON_V2_ROUTE_ASSETS_READY||false)).toBe(true);
    expect(deferredRequests).toHaveLength(2);
    await page.locator('.cm-nav-tab[data-v7-view=home]').click();
    await expect(page.locator('.v38-home')).toBeVisible();
  }
});

for(const width of [320,375,390,430,768]){
 test('Access route selection reveals only the chosen parking information at '+width+'px',async({page})=>{
  await installProduction(page);
  await page.setViewportSize({width,height:844});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await openGuideRoute(page,'parking');
  const container=page.locator('.v24-parking-page');
  await expect(container).toBeVisible();
  const general=page.locator('#v24-general'),highway=page.locator('#v24-highway');
  const road=page.locator('[data-v24-route="v24-general"]');
  const expressway=page.locator('[data-v24-route="v24-highway"]');
  await expect(road).toHaveAttribute('aria-pressed','false');
  await expect(expressway).toHaveAttribute('aria-pressed','false');
  await expect(general).toBeHidden();
  await expect(highway).toBeHidden();
  await expect(page.locator('.v24-select-hint')).toBeVisible();
  await expect(page.locator('.v24-safety')).toBeHidden();

  await road.click();
  await expect(general).toBeVisible();
  await expect(highway).toBeHidden();
  await expect(road).toHaveAttribute('aria-pressed','true');
  await expect(road).toHaveAttribute('aria-expanded','true');
  await expect(expressway).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.v24-select-hint')).toBeHidden();
  const allMap=page.locator('#v24-general .v24-all-map');
  await expect(allMap).toBeVisible();
  await expect(allMap).toContainText('全5か所を地図で見る');
  const mapHref=await allMap.getAttribute('href');
  const mapUrl=new URL(mapHref);
  expect(mapUrl.origin).toBe('https://www.google.com');
  expect(mapUrl.searchParams.get('map_action')).toBe('shortlist');
  expect(mapUrl.searchParams.get('place_ids').split(',')).toEqual([
   'ChIJXXu6y1SVGGAR_0YLVUttt6Y',
   'ChIJyZN4QJOVGGARXseqERsVP2Y',
   'ChIJoRybHi2VGGARe61DT2GBGW0',
   'ChIJYSPyO0CVGGAR8ny8dIbrVDU',
   'ChIJzwHsNK-VGGARXntcgjBDg-4'
  ]);
  const lots=page.locator('#v24-general .v24-lot-row:visible');
  await expect(lots).toHaveCount(5);
  for(const [i,name] of ['東門駐車場①','東門駐車場②','東門駐車場③','正門駐車場①','正門駐車場②'].entries()){
   await expect(lots.nth(i)).toContainText(name);
   await expect(lots.nth(i)).toHaveAttribute('data-external','');
  }
  await expect(lots.first()).toHaveAttribute('href',/hKcx4SKWdEYZHcPE6/);
  await expect(page.locator('#v24-general .v24-alert')).toContainText('駐車場の閉鎖情報');
  await expect(page.locator('#v24-general .v24-more')).not.toHaveAttribute('open',/.+/);
  await page.locator('#v24-general .v24-more summary').click();
  await expect(page.locator('#v24-general .v24-facts')).toBeVisible();
  await expect(lots).toHaveCount(5);

  await expressway.click();
  await expect(general).toBeHidden();
  await expect(highway).toBeVisible();
  await expect(expressway).toHaveAttribute('aria-pressed','true');
  await expect(road).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#v24-highway .v24-map:visible')).toHaveCount(1);
  await expect(page.locator('#v24-highway .v24-map:visible')).toHaveAttribute('href',/PE7zNw8WGpkhvbBZ6/);
  await expect(page.locator('.v24-safety')).toBeVisible();

  await road.click();
  await expect(general).toBeVisible();
  await expect(highway).toBeHidden();
  await expect(page.locator('#v24-general .v24-more')).not.toHaveAttribute('open',/.+/);
  await expect(page.locator('#v24-general .v24-all-map')).toBeVisible();
  await expect(page.locator('#v24-general .v24-lot-row:visible')).toHaveCount(5);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });
}

test('Production play content lives only in the bottom PLAY tab and retains its four links',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v38-play,.v38-play-card,#v59PlayFold')).toHaveCount(0);
 await page.locator('.cm-nav-tab[data-v7-view="play"]').click();
 await expect(page.locator('.cm-hub h1')).toHaveText('あそび');
 const cards=page.locator('.cm-hub-list a.cm-hub-row');
 await expect(cards).toHaveCount(5);
 for(const label of ['ASOQUEST スタンプラリー','BOON パズル','ブーンジャンプ','ブーンRUN','おみくじ']){
  await expect(cards.filter({hasText:label})).toHaveAttribute('data-external','1');
 }
 await expect(cards.filter({hasText:'ASOQUEST スタンプラリー'})).toHaveAttribute('href',/asoquest\//);
 expect(await page.content()).not.toMatch(/2009888671|57TOefc3/);
});

test('bottom PLAY hub opens the BOON puzzle link without new HOME games',async({page})=>{
 await installProduction(page);
 await page.context().route('https://asoboon.github.io/asoboon-3d/boon-block-next/**',
  route=>route.fulfill({status:200,contentType:'text/html',body:'<title>BOON パズル</title><h1>BOON パズル</h1>'}));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('.cm-nav-tab[data-v7-view="play"]').click();
 await expect(page.locator('.cm-hub h1')).toHaveText('あそび');
 const card=page.locator('.cm-hub-list a').filter({hasText:'BOON パズル'});
 await expect(card).toHaveAttribute('href','https://asoboon.github.io/asoboon-3d/boon-block-next/?v=23');
 const [popup]=await Promise.all([page.waitForEvent('popup'),card.click()]);
 await expect(popup).toHaveURL(/boon-block-next/);
 await popup.close();
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
 await expect(page.locator('.rec-remaining-caution')).toContainText('受付前に変わることが');
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
   operationalDate:'2026-10-03',businessType:'土日祝日',savedAt:Date.now(),verifiedFresh:true,publicFlags:[['0030',true],['0032',true],['0034',true],['0029',true],['0031',true],['0033',true]]
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
 await button.evaluate(el=>el.click());
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
  await expect(page.locator('[data-date="2026-10-08"]')).toHaveCSS('background-color','rgb(210, 243, 231)');
  await expect(page.locator('[data-date="2026-10-09"]')).toHaveCSS('background-color','rgb(235, 255, 246)');
  await expect(page.locator('[data-date="2026-10-11"]')).toHaveCSS('background-color','rgb(255, 249, 241)');
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
  await expect(page.locator('.v38-first-shortcut [data-v7-view="first"]')).toBeVisible();
  await page.locator('[data-v7-view="first"]').first().click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/home.html');
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('first');
  await expect.poll(()=>new URL(page.url()).searchParams.get('production_preview')).toBe('1');
  await page.locator('.cm-nav-tab[data-v7-view=home]').click();
  await page.locator('.v38-business-calendar-section .v38-calendar-card').click();
  await expect.poll(()=>new URL(page.url()).pathname).toBe('/miniapp-v2/production/business-calendar.html');
  await expect(page.getByRole('heading',{name:'営業日カレンダー'})).toBeVisible();
  await page.locator('.bc-back').click();
  await expect(page.locator('.v38-home')).toBeVisible();
  await expect(page.locator('.v38-calendar-card').first()).toHaveAttribute('data-external','1');
  await page.locator('.v38-calendar-section:not(.v38-business-calendar-section):not(.v38-access-section) .v38-calendar-card').click();
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
  // The first step is now 'choose a reception slot'; the final submit is
  // intentionally withheld until the slot and party-size steps are completed.
  await expect(page.locator('#boonV4Progress')).toBeVisible();
  await expect(page.locator('#boonV4Continue')).toBeVisible();
  await expect(page.locator('#recSubmit')).toBeHidden();
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

  // Production HOME may re-render before tap. Keep the test on localhost even
  // if a status refresh replaces the manually rewritten anchor.
  await page.route('https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/asoquest/**',
    route=>route.fulfill({status:302,headers:{location:rally}}));

  // Production uses the same origin; rewrite its absolute GitHub Pages URL
  // to this localhost fixture so localStorage can be checked across both screens.
   await expect(page.locator('.cm-nav-tab[data-v7-view="play"]')).toBeVisible();
   await page.goto(site+'miniapp-v2/production/?view=play',{waitUntil:'domcontentloaded'});
   await expect(page.locator('.cm-hub h1')).toHaveText('あそび');
   const card=page.locator('.cm-hub-row').filter({hasText:'ASOQUEST スタンプラリー'});
  await expect(card).toHaveAttribute('href','https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/asoquest/');
  await card.evaluate((a,url)=>{a.href=url;a.target='_self'},rally);
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
    await openGuideRoute(page,'entry');
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
  await openGuideRoute(page,'entry');

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
  await page.locator('#backBtn').click();
  await expect(page.locator('.cm-hub h1')).toHaveText('ご利用案内');
  await page.locator('.cm-nav-tab[data-v7-view=home]').click();
  await expect(page.locator('.v38-home')).toBeVisible();
});

test('Entry guide: returning with receipt / yellow holder / neither, then reselect',async({page})=>{
  await installProduction(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await openGuideRoute(page,'entry');
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

test('Certified main HOME keeps after-closing session rows visible in the v58 layout',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T09:10:00.000Z'});
 const site=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{
   configurable:true,get(){return this.__homeQAEnv;},
   set(value){this.__homeQAEnv=Object.freeze({...value,
    assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'
   });}
  });
 },site);
 await page.goto(site+'home.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v58SessionsZone')).toBeVisible();
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
 await expect(page.locator('#v38Slots')).toContainText('本日の受付枠は終了しました');
 await expect(page.locator('#v38Slots [data-v7-view="reception"],#v38Slots a[href]')).toHaveCount(0);
 await expect(page.locator('#v613Board .v613-row')).toHaveCount(3);
});
test('Certified main HOME translates saved ticket instructions in all supported locales',async({page})=>{
 await installProduction(page);
 const site=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{
   configurable:true,get(){return this.__homeQAEnv;},
   set(value){this.__homeQAEnv=Object.freeze({...value,
    assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'
   });}
  });
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
   receiptNo:'R777',businessDate:'2026-10-03',waitTypeId:'0030'
  }));
 },site);
 await page.goto(site+'home.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero h1')).toHaveText('受付番号は保存済みです');
 const headings={
  en:'Your ticket number is saved',
  'zh-CN':'您的取号号码已保存',
  vi:'Số thứ tự của bạn đã được lưu',
  ne:'तपाईंको पालो नम्बर सुरक्षित छ',
  ko:'접수 번호가 저장되어 있습니다',
  kmr:'Hejmara qeydkirina we hatiye tomar kirin'
 };
 const picker=page.locator('#asoboon-language-select');
 for(const [language,heading] of Object.entries(headings)){
  await picker.selectOption(language);
  await expect(page.locator('#v38Hero h1')).toHaveText(heading);
  await expect(page.locator('#v38Hero p')).not.toContainText('現在の受付・呼出状況');
  await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toBeVisible();
 }
 await picker.selectOption('ja');
 await expect(page.locator('#v38Hero h1')).toHaveText('受付番号は保存済みです');
});
test('After 19:00 a fresh visitor sees current-day session times without tomorrow quota numbers',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T10:10:00.000Z'});
 let crowdReads=0;
 await page.route(GATEWAY+'**',route=>{
  const u=new URL(route.request().url()),action=u.searchParams.get('action');
  if(action==='businessDay'){
   const date=u.searchParams.get('date'),today=date==='2026-10-03';
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,operationalDate:date,calendarDate:date,businessType:today?'土日祝日':'平日特定日',
    closingTime:today?'18:00':'17:00',durationLabel:'3時間'
   })});
  }
  if(action==='crowdRemaining'){
   crowdReads++;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,stale:false,fetchedAt:'2026-10-03T10:10:00.000Z',
    slots:[
     {waitTypeId:'0036',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:250},
     {waitTypeId:'0038',slotKey:'13:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:250}
    ],
    observedDetails:[
     {detailedWaitType:'10時15分から【平日特定日】',reserveUnit:'PERSON',remaining:70,remainingVerified:true},
     {detailedWaitType:'13時45分から【平日特定日】',reserveUnit:'PERSON',remaining:70,remainingVerified:true}
    ]
   })});
  }
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v613Board .v613-time')).toHaveText(['10:00','12:30','15:00']);
 await expect(page.locator('#v613Board .v613-percent')).toHaveText(['—','—','—']);
 await expect(page.locator('#v613Board .v38-crowd-channel--web strong')).toHaveText(['—','—','—']);
 await expect(page.locator('#v613Board .v38-crowd-channel--onsite strong')).toHaveText(['—','—','—']);
 await expect(page.locator('#v38Today')).toContainText('土日祝');
 await expect(page.locator('#v38Today')).not.toContainText('平日特定日');
 await expect(page.locator('#v38CrowdAge')).toHaveText('最終更新 —:—');
 await expect(page.locator('#v38Slots')).not.toContainText('次の営業日の入場');
 await expect(page.locator('#v38CrowdUpdate')).toBeHidden();
 await expect(page.locator('#v38Slots [data-v7-view="reception"],#v38Slots a[href]')).toHaveCount(0);
 // Compact WEB/LINE counts must be vertically centered with percentages and time,
 // not pinned to the top by the old 45px large-card number minimum.
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:820});
  await expect(page.locator('#v613Board .v613-row')).toHaveCount(3);
  const aligned=await page.evaluate(()=>{
   const midpoint=el=>{const r=el.getBoundingClientRect();return (r.top+r.bottom)/2};
   return [...document.querySelectorAll('#v613Board .v613-row')].flatMap(row=>{
    const gauge=row.querySelector('.v613-percent');
    return [...row.querySelectorAll('.v613-channel')].map(cell=>{
     const channel=cell.querySelector('.v38-crowd-channel'),strong=channel?.querySelector('strong');
     if(!strong||!gauge)return{exists:false};
     const rect=strong.getBoundingClientRect(),channelRect=channel.getBoundingClientRect();
     return {
      exists:true,
      text:strong.innerText,
      verticalOffset:Math.abs(midpoint(strong)-midpoint(cell)),
      peerOffset:Math.abs(midpoint(strong)-midpoint(gauge)),
      legacyMinHeight:getComputedStyle(strong).minHeight,
      numberHeight:rect.height,
      tapHeight:channelRect.height
     };
    });
   });
  });
  expect(aligned,'WEB/LINE count alignment at '+width).toHaveLength(6);
  for(const box of aligned){
   expect(box.exists).toBe(true);
   expect(box.verticalOffset).toBeLessThanOrEqual(1);
   expect(box.peerOffset).toBeLessThanOrEqual(2);
   expect(box.legacyMinHeight).toBe('0px');
   expect(box.numberHeight).toBeLessThan(28);
   expect(box.tapHeight).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }

 expect(crowdReads).toBeGreaterThanOrEqual(1);
});
test('Certified HOME business-day typography never overlaps at five responsive widths',async({page})=>{
 await installProduction(page);
 const site=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{configurable:true,get(){return this.__qaEnv;},set(value){
   this.__qaEnv=Object.freeze({...value,assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'});
  }});
 },site);
 await page.goto(site+'home.html',{waitUntil:'domcontentloaded'});
 const title=page.locator('#v58DayZone>.v58-section-title');
 await expect(title).toBeVisible();
 await expect(page.locator('#v38Today>span:nth-child(2) strong')).toBeVisible();
 await expect(page.locator('#v38Today>span:nth-child(3) strong')).toBeVisible();
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:820});
  await expect(page.locator('#v58DayZone>.v58-section-title')).toBeVisible();
  await expect(page.locator('#v38Today>span:nth-child(2) strong')).toBeVisible();
  await expect(page.locator('#v38Today>span:nth-child(3) strong')).toBeVisible();
  const v=await page.evaluate(()=>{
   const q=s=>document.querySelector(s)?.getBoundingClientRect();
   const outer=q('#v58DayZone'),title=q('#v58DayZone>.v58-section-title');
   const day=q('#v38Today'),name=q('#v38Today>span:nth-child(2) strong'),duration=q('#v38Today>span:nth-child(3) strong');
   const overlaps=(a,b)=>a&&b&&a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
   return{width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    all:!!outer&&!!title&&!!day&&!!name&&!!duration,
    titleDayOverlap:overlaps(title,day),nameDurationOverlap:overlaps(name,duration),
    titleInside:!!title&&!!outer&&title.left>=outer.left-1&&title.right<=outer.right+1,
    nameInside:!!name&&!!outer&&name.left>=outer.left-1&&name.right<=outer.right+1,
    durationInside:!!duration&&!!outer&&duration.left>=outer.left-1&&duration.right<=outer.right+1};
  });
  expect(v,'business-day overlap at '+width).toMatchObject({all:true,titleDayOverlap:false,nameDurationOverlap:false,titleInside:true,nameInside:true,durationInside:true});
  expect(v.scrollWidth).toBeLessThanOrEqual(width+1);
 }
});
test('PLAY hub restores BOON Puzzle and swaps Monster to Boon Jump with working URLs',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('.cm-nav-tab[data-v7-view="play"]').click();
 await expect(page.locator('.cm-hub-list')).toBeVisible();
 const list=page.locator('.cm-hub-list');
 await expect(list).toContainText('ブーンジャンプ');
 await expect(list).toContainText('BOON パズル');
 await expect(list).not.toContainText('BOON MONSTER');
 await expect(list.locator('a').filter({hasText:'ブーンジャンプ'})).toHaveAttribute('href','https://asoboon.github.io/asoboon-stamp/boonjump/');
 await expect(list.locator('a').filter({hasText:'BOON パズル'})).toHaveAttribute('href','https://asoboon.github.io/asoboon-3d/boon-block-next/?v=23');
});
test('19:00 date rollover reads the previous calendar date business type, never tomorrow booking rows',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T10:10:00.000Z'});
 const dateReads=[];
 await page.route(GATEWAY+'**',async route=>{
  const u=new URL(route.request().url());
  if(u.searchParams.get('action')!=='businessDay')return route.fallback();
  const date=u.searchParams.get('date');dateReads.push(date);
  const isToday=date==='2026-10-03';
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,operationalDate:date,calendarDate:date,businessType:isToday?'土日祝日':'平日特定日',closingTime:isToday?'18:00':'17:00'})});
 });
 await page.addInitScript(()=>localStorage.setItem('asoboon_v2_last_verified_crowd_day_v1',JSON.stringify({
  date:'2026-10-03',businessType:'土日祝日',savedAt:Date.now()-600000,
  slots:[{waitTypeId:'0030',slotKey:'10:00',reserveUnit:'PERSON',matchMode:'exact-name',evidence:'PERSON',remaining:0}],
  details:[{detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:0,remainingVerified:true}]
 })));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
 await expect(page.locator('#v613Board .v613-time')).toHaveText(['10:00','12:30','15:00']);
 await expect(page.locator('#v613Board .v613-percent').first()).toHaveText('—');
 await expect(page.locator('#v38Slots [data-v7-view="reception"],#v38Slots a[href]')).toHaveCount(0);
 expect(dateReads).toContain('2026-10-04');
 expect(dateReads).toContain('2026-10-03');
});
test('Verified legacy capacity survives AIRWAIT_CROWD_EMPTY cleanup and migrates to durable same-day archive',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T09:10:00.000Z'});
 await page.addInitScript(()=>localStorage.setItem('asoboon_v2_crowd_snapshot_production_v1',JSON.stringify({
  operationalDate:'2026-10-03',businessType:'土日祝日',savedAt:Date.now()-600000,verifiedFresh:true,publicFlags:[['0030',true],['0032',true],['0034',true],['0029',true],['0031',true],['0033',true]],
  slots:[{waitTypeId:'0030',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:0}],
  details:[{detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:0,remainingVerified:true}]
 })));
 await page.route(GATEWAY+'**',route=>{
  if(new URL(route.request().url()).searchParams.get('action')==='crowdRemaining')
   return route.fulfill({status:502,contentType:'application/json',body:'{"ok":false,"error":"AIRWAIT_CROWD_EMPTY"}'});
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const first=page.locator('#v613Board .v613-row').first();
 await expect(first.locator('.v613-percent')).toHaveText('100%');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('asoboon_v2_crowd_snapshot_production_v1'))).toBeNull();
 await expect(first.locator('.v613-percent')).toHaveText('100%');
 const x=await page.evaluate(()=>JSON.parse(localStorage.getItem('asoboon_v2_last_verified_crowd_day_v1')||'null'));
 expect(x.date).toBe('2026-10-03');
 await expect(page.locator('#v38Slots a[href],#v38Slots [data-v7-view="reception"]')).toHaveCount(0);
});
test('Business-day refresh failure never reopens closed WEB or LINE reception controls',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T09:10:00.000Z'});
 await page.addInitScript(()=>{
  let currentDay;
  Object.defineProperty(window,'ASOBOON_V2_BUSINESS_DAY',{configurable:true,
   get(){return currentDay;},
   set(value){currentDay={...value,getCurrent:(...args)=>window.__qaBreakBusinessDay?Promise.reject(Error('SIMULATED_BUSINESS_DAY_FAILURE')):value.getCurrent(...args)};}
  });
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
 await page.evaluate(()=>{window.__qaBreakBusinessDay=true;window.dispatchEvent(new Event('focus'))});
 await expect(page.locator('#v38Hero')).toContainText('営業情報を取得できません');
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
 await expect(page.locator('#v38Slots .v38-crowd-closed-note')).toBeHidden();
 await expect(page.locator('#v38Slots a[href],#v38Slots [data-v7-view="reception"]')).toHaveCount(0);
});
test('After closing, last verified WEB and LINE counts still give forecast 100 percent, with no active booking buttons',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T09:10:00.000Z'});
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_last_verified_crowd_day_v1',JSON.stringify({
   date:'2026-10-03',businessType:'土日祝日',savedAt:Date.now()-1800000,publicFlags:[['0030',true],['0032',true],['0034',true],['0029',true],['0031',true],['0033',true]],
   slots:[
    {waitTypeId:'0030',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:0},
    {waitTypeId:'0032',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:71},
    {waitTypeId:'0034',slotKey:'15:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:25}
   ],
   details:[
    {detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:0,remainingVerified:true},
    {detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:44,remainingVerified:true},
    {detailedWaitType:'15時15分頃入場時間【土休日特定日】',reserveUnit:'PERSON',remaining:8,remainingVerified:true}
   ]
  }));
 });
 await page.route(GATEWAY+'**',route=>{
  if(new URL(route.request().url()).searchParams.get('action')==='crowdRemaining')
   return route.fulfill({status:502,contentType:'application/json',body:'{"ok":false,"error":"AIRWAIT_CROWD_EMPTY"}'});
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
 await expect(page.locator('#v38Slots .v38-opening-hours')).not.toContainText('WEB受付');
 await expect(page.locator('#v38Slots .v38-opening-hours')).not.toContainText('7:00');
 await expect(page.locator('#v38Slots .v38-opening-hours')).toContainText('9:30');
 const first=page.locator('#v613Board .v613-row').first();
 await expect(first.locator('.v613-percent')).toHaveText('100%');
 await expect(page.locator('#v38CrowdAge')).toHaveText('最終更新 17:40');
 await expect(first.locator('.v38-crowd-channel--web')).toContainText('0');
 await expect(first.locator('.v38-crowd-channel--onsite')).toContainText('0');
 await expect(page.locator('#v38Slots')).not.toContainText('次の営業日の入場');
 await expect(page.locator('#v38Slots')).not.toContainText('受付時間外');
 await expect(page.locator('#v38Slots a[href],#v38Slots button[data-v7-view="reception"]')).toHaveCount(0);
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toBeVisible();
});
test('Never reuse yesterday verified counts for a new calendar day',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T09:10:00.000Z'});
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_last_verified_crowd_day_v1',JSON.stringify({
   date:'2026-10-02',businessType:'土日祝日',savedAt:Date.now()-1800000,slots:[],details:[]
  }));
 });
 await page.route(GATEWAY+'**',route=>{
  if(new URL(route.request().url()).searchParams.get('action')==='crowdRemaining')
   return route.fulfill({status:502,contentType:'application/json',body:'{"ok":false,"error":"AIRWAIT_CROWD_EMPTY"}'});
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v613Board .v613-row')).toHaveCount(3);
 await expect(page.locator('#v613Board .v613-percent')).toHaveText(['—','—','—']);
 await expect(page.locator('#v38Slots')).not.toContainText('次の営業日の入場');
});
test('After closing, HOME retains three admission times but offers no reception links',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T09:10:00.000Z'});
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toContainText('本日の営業は終了しました');
 const times=page.locator('#v38Slots .v38-crowd-card');
 await expect(times).toHaveCount(3);
 for(const time of ['10:00','12:30','15:00'])await expect(page.locator('#v613Board .v613-time').filter({hasText:time})).toBeVisible();
 await expect(page.locator('#v38Slots [data-v7-view="reception"]')).toHaveCount(0);
 await expect(page.locator('#v38Slots a[href]')).toHaveCount(0);
 await expect(page.locator('#v613Board .v613-row')).toHaveCount(3);
});
test('After 19:00 daily rollover, next-business-day slots remain reference-only',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T10:10:00.000Z'});
 // The default fixture always returns 10/03, even when the cutoff engine asks
 // for 10/04. A date-mismatch triggers JSONP rescue and makes this test flaky
 // on slow CI runners. Return a valid calendar record for the requested date.
 await page.route(GATEWAY+'**',route=>{
  const u=new URL(route.request().url());
  if(u.searchParams.get('action')!=='businessDay')return route.fallback();
  const date=u.searchParams.get('date');
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,operationalDate:date,calendarDate:date,businessType:'土日祝日',
   isClosed:false,closingTime:'18:00',durationMinutes:150,durationLabel:'2時間30分'
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
 await expect(page.locator('#v38Slots .v38-opening-hours')).not.toContainText('7:00');
 await expect(page.locator('#v38Slots')).not.toContainText('受付時間外');
 await expect(page.locator('#v38Slots [data-v7-view="reception"],#v38Slots a[href]')).toHaveCount(0);
});
test('HOME typography follows a left reading edge while numeric slots stay column-aligned on five widths',async({page})=>{
 await installProduction(page);
 const site=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{configurable:true,get(){return this.__qaEnv;},set(value){
   this.__qaEnv=Object.freeze({...value,assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'});
  }});
 },site);
 await page.goto(site+'home.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v58DayZone>.v58-section-title')).toBeVisible();
 await expect(page.locator('#v38Today>span:nth-child(2) strong')).toBeVisible();
 await expect(page.locator('#v38Today>span:nth-child(3) strong')).toBeVisible();
 await expect(page.locator('#v58SessionsZone>.v58-section-title')).toBeVisible();
 await expect(page.locator('#v613Board .v613-header')).toBeVisible({timeout:15000});
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:850});
  const result=await page.evaluate(()=>{
   const b=s=>document.querySelector(s)?.getBoundingClientRect();
   const title=b('#v58DayZone>.v58-section-title'),main=b('#v38Today>span:nth-child(2) strong');
   const duration=b('#v38Today>span:nth-child(3) strong'),day=b('#v58DayZone');
   const items=[...document.querySelectorAll('.v59-calendar-links .v38-calendar-card')];
   const header=document.querySelector('#v613Board .v613-header');
   const leftAligned=[title,main,duration].every(x=>!!x&&Math.abs(x.left-main.left)<6);
   const stacked=!!main&&!!duration&&main.bottom<=duration.top+1;
   const readable=items.every(x=>{const t=x.querySelector('strong');if(!t)return false;const r=t.getBoundingClientRect(),c=x.getBoundingClientRect();return r.left>=c.left-1&&r.right<=c.right+1&&r.height<=Math.max(50,c.height-8)});
   const first=items[0]?.getBoundingClientRect(),second=items[1]?.getBoundingClientRect();
   const cardsSingleColumn=!!first&&!!second&&second.top>=first.bottom-2;
   const chips=getComputedStyle(document.querySelector('#v58SessionsZone>.v58-section-title'),'::before');
   return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    leftAligned,stacked,readable,cardsSingleColumn,chipsPresent:chips.content!=='none',
    cardInside:!!day&&[title,main,duration].every(x=>x&&x.left>=day.left-1&&x.right<=day.right+1),
    boardPresent:!!header,boardHeaderAligned:header?getComputedStyle(header).display==='grid':false
   };
  });
  expect(result,JSON.stringify(result)).toMatchObject({leftAligned:true,stacked:true,readable:true,chipsPresent:true,cardInside:true,boardPresent:true,boardHeaderAligned:true});
  expect(result.scrollWidth).toBeLessThanOrEqual(width+1);
  if(width===320)expect(result.cardsSingleColumn).toBe(true);
  if(width===390)expect(result.cardsSingleColumn).toBe(true); // Readable calendar links, not two cramped title columns.
 }
});
test('Compact after-hours HOME has only last-updated text, no blank CTA, and five consistent guide links',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T10:10:00.000Z'});
 const site=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{configurable:true,get(){return this.__qaEnv;},set(value){
   this.__qaEnv=Object.freeze({...value,assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'});
  }});
 },site);
 await page.route(GATEWAY+'**',route=>{
  const u=new URL(route.request().url()),action=u.searchParams.get('action');
  if(action==='businessDay'){
   const date=u.searchParams.get('date')||'2026-10-03';
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,operationalDate:date,calendarDate:date,businessType:date==='2026-10-03'?'土日祝日':'平日特定日',
    durationLabel:date==='2026-10-03'?'2時間30分':'3時間',closingTime:date==='2026-10-03'?'18:00':'17:00'
   })});
  }
  if(action==='crowdRemaining')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,fetchedAt:'2026-10-03T10:10:00.000Z',
   slots:[{waitTypeId:'0036',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:250},
          {waitTypeId:'0038',slotKey:'13:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:250}],
   observedDetails:[{detailedWaitType:'10時15分から【平日特定日】',reserveUnit:'PERSON',remaining:70,remainingVerified:true},
                    {detailedWaitType:'13時45分から【平日特定日】',reserveUnit:'PERSON',remaining:70,remainingVerified:true}]
  })});
  return route.fallback();
 });
 await page.goto(site+'home.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v58Flow')).toHaveAttribute('data-state','ended');
 await expect(page.locator('#v613Board .v613-row')).toHaveCount(3);
 await expect(page.locator('#v38CrowdAge')).toContainText('最終更新');
 await expect(page.locator('#v38CrowdAge')).not.toContainText('更新ボタン');
 await expect(page.locator('#v38CrowdUpdate')).toBeHidden();
 await expect(page.locator('#v38Slots .v38-crowd-closed-note')).toBeHidden();
 await expect(page.locator('#v38Slots .v38-crowd-disclaimer')).toBeHidden();
 await expect(page.locator('#v613Board .v613-footnote')).toBeHidden();
 await expect(page.locator('#v58Primary .v58-intro')).toContainText('本日の営業は終了しました');
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:820});
   await expect(page.locator('.v38-first-shortcut .v38-guide-card')).toBeVisible();
  const geom=await page.evaluate(()=>{
   const r=s=>document.querySelector(s)?.getBoundingClientRect();
   const primary=r('#v58Primary'),native=r('#v58Primary .v58-native-action');
   const guide=r('.v38-first-shortcut'),cards=[...document.querySelectorAll('.v38-first-shortcut .v38-guide-card')].map(e=>e.getBoundingClientRect());
   return {scroll:document.documentElement.scrollWidth,width:innerWidth,
    compact:!!primary&&primary.height<90,hiddenCTA:!!native&&native.width===0&&native.height===0,
    cardCount:cards.length,aligned:cards.length===1&&cards.every(c=>Math.abs(c.left-cards[0].left)<2&&Math.abs(c.width-cards[0].width)<2),
    stacked:cards.every((c,i)=>!i||c.top>=cards[i-1].bottom+5),
    contained:!!guide&&cards.every(c=>c.left>=guide.left&&c.right<=guide.right+1),
    minimumTap:cards.every(c=>c.height>=56)};
  });
  expect(geom,JSON.stringify(geom)).toMatchObject({compact:true,hiddenCTA:true,cardCount:1,aligned:true,stacked:true,contained:true,minimumTap:true});
  expect(geom.scroll).toBeLessThanOrEqual(width+1);
 }
});
test('Cocoa ice-cream HOME header has legible melted wordmark and unobstructed language picker at five widths',async({page})=>{
 await installProduction(page);
 const site=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{configurable:true,get(){return this.__qaEnv;},set(value){
   this.__qaEnv=Object.freeze({...value,assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'});
  }});
 },site);
 await page.goto(site+'home.html',{waitUntil:'domcontentloaded'});
 const logo=page.locator('.topbar .brand strong');
 const lang=page.locator('#asoboon-language-select');
 await expect(logo).toHaveText('ASOBooN');
 await expect(lang).toBeVisible();
 await expect(page.locator('#v58DayZone')).toBeVisible({timeout:10000});
 await expect(page.locator('.topbar .brand strong')).toHaveCount(1);
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:820});
  const visuals=await page.evaluate(()=>{
   const head=document.querySelector('#app .topbar');
   const brand=head.querySelector('.brand');
   const logo=brand.querySelector('strong');
   const language=document.querySelector('#asoboon-language-select');
   const hr=head.getBoundingClientRect(),br=brand.getBoundingClientRect(),lr=language.getBoundingClientRect();
   const ice=getComputedStyle(logo,'::after');
   const dayZone=document.querySelector('#v58DayZone');
   const sprinkles=dayZone?getComputedStyle(dayZone,'::after'):null;
   return {
    background:getComputedStyle(head).backgroundImage,
    plaque:getComputedStyle(brand).backgroundImage,
    text:getComputedStyle(logo).color,
    drips:ice.content!=='none'&&ice.position==='absolute',
    sprinkles:!!sprinkles&&sprinkles.content!=='none'&&sprinkles.position==='absolute',
    headerInside:br.left>=hr.left&&br.right<=hr.right,
    pickerInside:lr.left>=hr.left&&lr.right<=hr.right,
    noControlCollision:br.right+10<=lr.left,
    scrollWidth:document.documentElement.scrollWidth,
    viewport:innerWidth,
    callNav:document.querySelectorAll('.cm-bottom-nav [data-v7-view="callstatus"]').length
   };
  });
  expect(visuals,JSON.stringify(visuals)).toMatchObject({
   drips:true,headerInside:true,pickerInside:true,noControlCollision:true,callNav:1
  });
  expect(visuals.background).toContain('radial-gradient');
  expect(visuals.background).toContain('rgb(57, 40, 36)');
  expect(visuals.plaque).toContain('linear-gradient');
  expect(['rgb(57, 40, 36)','rgb(86, 59, 50)']).toContain(visuals.text);
  expect(visuals.scrollWidth).toBeLessThanOrEqual(width+1);
 }
 await page.setViewportSize({width:390,height:820});
 await lang.selectOption('en');
 await expect(logo).toHaveText('ASOBooN');
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toBeVisible();
});
test('HOME has exactly one ASOBooN header logo and no second v58 brand',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.topbar .brand strong')).toHaveText('ASOBooN');
 await expect(page.locator('.v38-home .v58-brand')).toHaveCount(0);
 await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toHaveCount(0);
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toHaveCount(1);
});
test('Official HOME keeps one call-status entry in the bottom navigation for saved receipt',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({receiptNo:'F777',businessDate:'2026-10-03',waitTypeId:'0033'})));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toHaveClass(/call-link/);
 await expect(page.locator('#v38Hero')).toContainText('受付番号は保存済みです');
 await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toHaveCount(0);
 const call=page.locator('.cm-bottom-nav [data-v7-view="callstatus"]');
 await expect(call).toHaveCount(1);
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:800});
  await expect(call).toBeVisible();
  expect((await call.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await call.click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('callstatus');
 await expect(page.locator('#csState')).toBeVisible();
});

test('HOME open-state has only reception CTA; call-status stays in the fixed menu',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toHaveClass(/open/);
 const primary=page.locator('#v38Hero [data-v7-view="reception"]');
 await expect(primary).toBeVisible();
 await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toHaveCount(0);
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toBeVisible();
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 await primary.click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
 await expect(page.locator('#recSubmit')).toBeVisible();
});

test('Saved receipt uses compact passive HOME status and accessible fixed call tab on narrow phones',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({receiptNo:'F777',businessDate:'2026-10-03',waitTypeId:'0033'})));
 await page.setViewportSize({width:320,height:700});
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const hero=page.locator('#v38Hero');
 await expect(hero).toHaveClass(/call-link/);
 await expect(hero).toBeVisible();
 await expect(hero.locator('[data-v7-view="callstatus"]')).toHaveCount(0);
 const tab=page.locator('.cm-bottom-nav [data-v7-view="callstatus"]');
 await expect(tab).toBeVisible();
 const tabRect=await tab.boundingBox();
 expect(tabRect.height).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('Production HOME keeps active status discreet and surfaces rebooking after verified terminal without automatic status requests',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({receiptNo:'F321',businessDate:'2026-10-03',waitTypeId:'0030',adults:1,paidChildren:2,infants:0}));
  localStorage.setItem('asoboon_v2_home_status_production_v1',JSON.stringify({receiptNo:'F321',businessDate:'2026-10-03',savedAt:Date.now(),status:{kind:'calling',receipt:'F321',source:'live',checkedAt:Date.now()}}));
 });
 const actions=[];
 page.on('request',req=>{const p=new URLSearchParams(req.postData()||'');if(p.get('action')==='reservationStatus')actions.push('status')});
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const hero=page.locator('#v38Hero');
 await expect(hero).toHaveClass(/call-link/);
 await expect(hero).toContainText('画面下の「呼出」');
 await expect(hero.locator('[data-v7-view="callstatus"]')).toHaveCount(0);
 await expect(hero).not.toContainText('F321');
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toHaveCount(1);
 for(const kind of ['waiting','calling','hold','guided','canceled','error']){
  await page.evaluate(kind=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:{kind,receipt:'F321',ahead:3,source:'live',checkedAt:Date.now()}})),kind);
  const terminal=['guided','canceled'].includes(kind);
  await expect(hero).toHaveClass(terminal?/rebook/:/call-link/);
  await expect(hero.locator('[data-v7-view="reception"]')).toHaveCount(terminal?1:0);
  await expect(hero.locator('[data-v7-view="callstatus"]')).toHaveCount(0);
  await expect(hero).not.toContainText('F321');
  await expect(hero).not.toContainText('3組');
 }
 await page.waitForTimeout(350);
 expect(actions).toEqual([]);
});

test('Production HOME keeps a saved receipt hint and fixed call navigation during network errors',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({receiptNo:'E777',businessDate:'2026-10-03',waitTypeId:'0030'})));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toHaveClass(/call-link/);
 await expect(page.locator('#v38Hero')).toContainText('受付番号は保存済みです');
 await expect(page.locator('#v38Hero')).not.toContainText('E777');
 await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toHaveCount(0);
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toBeVisible();
});

test('Production HOME recognizes call cache session, keeps receipt hint without duplicate call button',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>localStorage.setItem('asoboon_v2_callstatus_production_v1',JSON.stringify({receiptNo:'R432',businessDate:'2026-10-03',waitTypeId:'0033',cachedAt:Date.now()})));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toHaveClass(/call-link/);
 await expect(page.locator('#v38Hero')).not.toContainText('R432');
 await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toHaveCount(0);
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toHaveCount(1);
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
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toBeVisible();
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
  await page.locator('.cm-nav-tab[data-v7-view=home]').click();
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
  await page.locator('.cm-nav-tab[data-v7-view=home]').click();
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


// The certified HOME's 4-column board contains the visible, clickable
// native reception actions; the original .v38-crowd-list remains a data source
// but is visually hidden. E2E click targets must match the user's actual screen.
const visibleCrowdLine=(page,time)=>page.locator('#v613Board .v613-row')
 .filter({hasText:time}).locator('.v38-crowd-channel--onsite');

test('HOME 12:30 quotas refresh only on tap without extra business-day calls',async({page})=>{
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
 await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText(/残り\d+人/);
 await expect(page.locator('#v38CrowdAge')).toContainText('最終更新');
 expect(calls).toBe(1);
 await expect(page.locator('#v38CrowdUpdate')).toBeHidden();
 const before=calls;
 await page.locator('#v38CrowdUpdate').evaluate(el=>el.click());
 await expect.poll(()=>calls).toBeGreaterThan(before);
 await expect(card.locator('.v38-crowd-channel--web strong')).not.toHaveText('残り71人');
 await expect(card.locator('.v38-crowd-channel--onsite strong')).not.toHaveText('残り44人');
 await visibleCrowdLine(page,'12:30').click();
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
 await expect(visibleCrowdLine(page,'12:30')).toBeVisible();
 await expect(page.locator('#v613Board .v613-row').filter({hasText:'12:30'}).locator('.v613-percent')).toHaveText('—');
 await expect(page.locator('#v38CrowdAge')).toContainText('最終更新');
 await expect(card.locator('.v38-crowd-channel--web strong')).toContainText('確認中');
 await expect(card.locator('.v38-crowd-channel--onsite strong')).toContainText('確認中');
 await expect(card).not.toContainText('71名');
 await expect(card).not.toContainText('44名');
 const previous=await page.evaluate(()=>JSON.parse(localStorage.getItem('asoboon_v2_crowd_snapshot_production_v1')||'{}'));
 expect(previous.verifiedFresh).toBe(false);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38CrowdAge')).toContainText('最終更新');
 await expect(card.locator('.v38-crowd-channel--web strong')).toContainText('確認中');
 await expect(card.locator('.v38-crowd-channel--onsite strong')).toContainText('確認中');
 await expect(visibleCrowdLine(page,'12:30').locator('[data-v7-view="reception"]')).toHaveCount(0);
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
 await expect(page.locator('#v38CrowdAge')).toHaveText(/^最終更新 \d{2}:\d{2}$/);
 await expect(button).toBeEnabled();
 await button.evaluate(el=>el.click());
 await expect.poll(()=>reads).toBe(2);
 await expect(button).toBeDisabled();
 await expect(page.locator('#v38CrowdAge')).toContainText('最終更新');
 await page.waitForTimeout(200);
 expect(reads).toBe(2);
});
test('Cold HOME starts crowd request before delayed business day resolves and issues it only once',async({page})=>{
 await installProduction(page);
 let dayDone=false,crowdBeforeDay=false,crowdReads=0;
 await page.route(GATEWAY+'**',async route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action==='businessDay'){await new Promise(resolve=>setTimeout(resolve,1000));dayDone=true;return route.fallback()}
  if(action==='crowdRemaining'){crowdReads++;if(!dayDone)crowdBeforeDay=true;return route.fallback()}
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
 expect(crowdBeforeDay).toBe(true);
 expect(crowdReads).toBe(1);
 await expect(page.locator('#v613Board .v38-crowd-channel--web strong').first()).toHaveText('195人');
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
    await expect(card.locator('.v38-crowd-remaining-title')).toHaveText('残り人数');
    await expect(card).toHaveAttribute('aria-label',new RegExp('WEB受付の残り'+web+'人.*LINE受付の残り'+onsite+'人'));
    await expect(card.locator('.v38-crowd-channel--web')).toContainText('WEB受付');
    await expect(card.locator('.v38-crowd-channel--web')).toHaveAttribute('href','https://airwait.jp/WCSP/storeDetail?storeNo=AKR2298124918');
    await expect(card.locator('.v38-crowd-channel--web')).toHaveAttribute('data-external','1');
    await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText('残り'+web+'人');
    await expect(card.locator('.v38-crowd-channel--onsite')).toContainText('LINE受付');
    await expect(card.locator('.v38-crowd-channel--onsite')).toHaveAttribute('data-v7-view','reception');
    await expect(card.locator('.v38-crowd-channel--onsite')).toHaveAttribute('data-v7-slot',time);
    await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText('残り'+onsite+'人');
    await expect(card.locator('[role="progressbar"]')).toHaveCount(0); // no fabricated occupancy percentage
  }
  await expect(box).toContainText('混雑予想は予約枠の残り人数から算出した参考値');
  expect(actions.length).toBe(1); // no additional Worker calls for onsite
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    await expect(box.locator('.v38-crowd-channel--onsite').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  if(process.env.ASOBOON_CROWD_SCREENSHOT==='1')await page.screenshot({path:'/tmp/asoboon-crowd-web-onsite.png',fullPage:true});
});

test('12:30 LINE verified zero is shown as 残り0人; crowded card advertises navigation to reception',async({page})=>{
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
 await expect(visibleCrowdLine(page,'12:30')).toBeVisible();
 await expect(c1230.locator('.v38-crowd-channel--web strong')).toHaveText('残り0人');
 await expect(c1230.locator('.v38-crowd-channel--onsite strong')).toHaveText('残り0人');
 await expect(c1230.locator('.v38-crowd-channel--web')).toContainText('WEB受付は満員です');
 await expect(c1230.locator('a.v38-crowd-channel--web')).toHaveCount(0);
 await expect(c1230.locator('.v38-crowd-channel--onsite')).toContainText('LINEで受付する');
 await expect(c1230).toHaveAttribute('aria-label',/LINE受付の残り0人/);
 const c1500=box.locator('.v38-crowd-card').filter({hasText:'15:00回'});
 await expect(c1500.locator('.v38-crowd-channel--onsite strong')).toHaveText('残り39人');
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  const button=await visibleCrowdLine(page,'12:30').boundingBox();
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
 await visibleCrowdLine(page,'12:30').click();
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
    await expect(card.locator('.v38-crowd-channel--onsite')).not.toContainText('残り0人');
    await expect(card).toHaveAttribute('aria-label',/LINE受付の残り確認中/);
  }
  await expect(page.locator('.v38-crowd-card').filter({hasText:'12:30回'}).locator('.v38-crowd-channel--web strong')).toHaveText('残り0人');
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
  const cards=page.locator('#v38Slots .v38-crowd-card');
  await expect(cards).toHaveCount(3); // Retain unknown sessions; only one has verified LINE capacity.
  const card=cards.filter({hasText:'10:00回'});
  await expect(card.locator('.v38-crowd-channel--web')).toContainText('確認中');
  await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText('残り75人');
  await expect(cards.filter({hasText:'12:30回'}).locator('.v38-crowd-channel--onsite strong')).toHaveText('確認中');
  await expect(card.locator('[role="progressbar"]')).toHaveCount(0);
  await visibleCrowdLine(page,'10:00').click();
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
});

test('Weekday and special-day local pools use their own exact AirWAIT type names without mixing slots',async({page})=>{
  await installProduction(page);
  await page.route(GATEWAY+'**',async route=>{
    const action=new URL(route.request().url()).searchParams.get('action');
    const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(action==='businessDay')return json({ok:true,operationalDate:'2026-10-03',businessType:'平日特定日',durationLabel:'3時間',closingTime:'17:00'});
    if(action==='waitTypes')return json({ok:true,waitTypes:['0035','0037','0036','0038'].map(waitTypeId=>({waitTypeId,dispFlg:true}))});
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
    await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText('残り'+web+'人');
    await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText('残り'+onsite+'人');
  }
  await expect(page.locator('#v38Slots')).not.toContainText('12:30回');
});

test('Recent verified HOME cache can bridge a brief AirWAIT outage without inventing values',async({page})=>{
  await installProduction(page);
  await page.addInitScript(()=>{
    localStorage.setItem('asoboon_v2_crowd_snapshot_production_v1',JSON.stringify({
      slots:[{waitTypeId:'0030',waitTypeName:'10時ご入場枠【WEB整理券】',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:25}],
      details:[{detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:14}],
      operationalDate:'2026-10-03',businessType:'土日祝日',savedAt:Date.now(),verifiedFresh:true,publicFlags:[['0030',true],['0032',true],['0034',true],['0029',true],['0031',true],['0033',true]]
    }));
  });
  await page.route(GATEWAY+'**',async route=>{
    if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
    await route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  const cards=page.locator('#v38Slots .v38-crowd-card');
  await expect(cards).toHaveCount(3); // v7 retains unknown time slots rather than hiding them.
  const card=cards.filter({hasText:'10:00回'});
  await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText('残り25人');
  await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText('残り14人');
  await expect(cards.filter({hasText:'12:30回'}).locator('.v38-crowd-channel--web strong')).toHaveText('確認中');
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
 await page.locator('.cm-nav-tab[data-v7-view=home]').click();
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toBeVisible();
 await page.locator('.cm-bottom-nav [data-v7-view="callstatus"]').click();
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
 await expect(page.locator('#csHeartbeatLabel')).toContainText('次の再確認まで');
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
  {state:'waiting',tone:'waiting',label:'順番を',rgb:'rgb(247, 239, 229)',ink:'rgb(86, 59, 50)'},
  {state:'calling',tone:'calling',label:'入場できます',rgb:'rgb(210, 243, 231)',ink:'rgb(22, 109, 102)'},
  {state:'done',tone:'done',label:'ご案内済み',rgb:'rgb(155, 230, 211)',ink:'rgb(22, 61, 58)'},
  {state:'canceled',tone:'canceled',label:'取消',rgb:'rgb(229, 214, 201)',ink:'rgb(86, 59, 50)'},
  {state:'closed',tone:'loading',label:'本日の受付は終了',rgb:'rgb(235, 255, 246)',ink:'rgb(86, 59, 50)'}
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
  await page.locator('.cm-nav-tab[data-v7-view=home]').click();
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
  await page.locator('.cm-nav-tab[data-v7-view=home]').click();
  await expect(page.locator('.v38-home')).toBeVisible();
  await expect(page.locator('#v38Hero')).toHaveClass(/call-link/);
  await expect(page.locator('#v38Hero')).not.toContainText('2510');
  await expect(page.locator('#v38Hero')).not.toContainText('あと0組');
  await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toHaveCount(0);
});

test('Five-language switch translates HOME, persists through navigation, and restores Japanese',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const picker=page.locator('#asoboon-language-select');
 await expect(picker).toBeVisible();
 expect(await picker.locator('option').count()).toBe(7);
 const labels={en:'Calls','zh-CN':'叫号',vi:'Gọi số',ne:'बोलावट',ko:'호출',kmr:'Bangkirin'};
 for(const [lang,label] of Object.entries(labels)){
  await picker.selectOption(lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toContainText(label);
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

test('Language selector translates first-visit route without issuing new tickets',async({page})=>{
 await installProduction(page);
 let creates=0;
 page.on('request',r=>{
  if(new URLSearchParams(r.postData()||'').get('action')==='createReservation')creates++;
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#asoboon-language-select').selectOption('zh-CN');
 await page.locator('[data-v7-view="first"]').first().click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('first');
 await expect(page.locator('#asoboon-language-note')).toContainText('可能以英语或日语显示');
 await expect(page.locator('html')).toHaveAttribute('lang','zh-CN');
 await expect(page.locator('.cm-bottom-nav [data-v7-view="guide"]')).toContainText('使用指南');
 await page.locator('.cm-nav-tab[data-v7-view=home]').click();
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
 await expect(page.locator('.v58-next-title')).toHaveText('Take a queue number');
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
 // The v6.13 board contains the visible clone; the legacy list is intentionally hidden.
 await page.locator('#v613Board [data-v7-view="reception"]').first().click();
 await expect(page.locator('#recSlots [data-rec-slot]')).toHaveCount(3);
 // Mint Soda now presents three intentional steps before the submit button.
 await expect(page.locator('#boonV4Continue')).toBeVisible();
 await expect(page.locator('#recSubmit')).toBeHidden();
 await page.locator('#recSlots [data-rec-slot]').first().click();
 await expect(page.locator('#boonV4Continue')).toBeEnabled();
 await page.locator('#boonV4Continue').click();
 await expect(page.locator('.boon-v4-reception')).toHaveAttribute('data-boon-stage','2');
 await page.locator('[data-rec-k="child"][data-rec-d="1"]').first().click();
 await expect(page.locator('#boonV4Continue')).toBeEnabled();
 await page.locator('#boonV4Continue').click();
 await expect(page.locator('.boon-v4-reception')).toHaveAttribute('data-boon-stage','3');
 await expect(page.locator('#recSubmit')).toBeVisible();
});
test('Optional language runtime outage falls back to the working Japanese LINE reception',async({page})=>{
 await installCertifiedProduction(page);
 await page.route('**/miniapp-v2/shared/i18n-runtime.js*',r=>r.abort());
 await page.goto('http://127.0.0.1:4173/home.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toContainText('当日受付');
 await expect(page.locator('#asoboon-language-select')).toHaveCount(0);
 await page.locator('#v38Hero [data-v7-view="reception"]').click();
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

test('HOME has a single mint reception CTA and one dark fixed call-status tab',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const reception=page.locator('#v38Hero [data-v7-view="reception"]');
 await expect(reception).toBeVisible();
 await expect(page.locator('#v38Hero [data-v7-view="callstatus"]')).toHaveCount(0);
 const call=page.locator('.cm-bottom-nav [data-v7-view="callstatus"]');
 await expect(call).toBeVisible();
 // The official HOME can replace the mint CTA during an async status update.
 // A detached node has an empty computed color; poll until the current live
 // button has the intended CSS instead of sampling a stale DOM instance.
 await expect.poll(async()=>reception.evaluate(el=>getComputedStyle(el).backgroundColor),
  {timeout:12000}).toBe('rgb(103, 206, 187)');
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
   savedAt:Date.now(),verifiedFresh:true,publicFlags:[['0030',true],['0032',true],['0034',true],['0029',true],['0031',true],['0033',true]]
  }));
 });
 let crowdReads=0;
 await page.route(GATEWAY+'**',async route=>{
  if(new URL(route.request().url()).searchParams.get('action')==='crowdRemaining')crowdReads++;
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const card=page.locator('#v38Slots .v38-crowd-card').filter({hasText:'12:30回'});
 await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText('残り14人');
 await expect(page.locator('#v38CrowdAge')).toContainText('最終更新');
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

test('Figma HOME uses one accessible ASOBooN AppBar with Language and working back navigation',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v38-home')).toBeVisible();
 await expect(page.locator('.topbar')).toBeVisible();
 await expect(page.locator('.topbar .brand strong')).toHaveText('ASOBooN');
 await expect(page.locator('#asoboon-language-select')).toBeVisible();
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toBeVisible();
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
   ok:true,stale:false,fetchedAt:'2026-10-03T03:00:00.000Z',
   slots:[{waitTypeId:'0032',waitTypeName:'12時半ご入場枠【WEB整理券】',
    slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'alias-name',remaining:281}],
   observedDetails:[{detailedWaitType:'12時50分頃入場【土休日特定日】',
    reserveUnit:'PERSON',remaining:281,remainingVerified:true}]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const card=page.locator('#v38Slots .v38-crowd-card').filter({hasText:'12:30回'});
 await expect(visibleCrowdLine(page,'12:30')).toBeVisible();
 await expect(card.locator('.v38-crowd-channel--web strong')).toHaveText('確認中');
 await expect(card.locator('.v38-crowd-channel--onsite strong')).toHaveText('残り281人');
 await expect(card.locator('[role="progressbar"]')).toHaveCount(0);
 await visibleCrowdLine(page,'12:30').click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
});

test('HOME manual refresh requests fresh AirWAIT confirmation, not the fast cached snapshot',async({page})=>{
 await installProduction(page);
 const requests=[];
 page.on('request',request=>{
  if(new URL(request.url()).searchParams.get('action')==='crowdRemaining')requests.push(new URL(request.url()));
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38CrowdUpdate')).toBeHidden();
 await expect(page.locator('#v38CrowdAge')).toHaveText(/^最終更新 \d{2}:\d{2}$/);
 expect(requests.length).toBe(1);
 expect(requests[0].searchParams.get('refresh')).toBe(null);
 await page.locator('#v38CrowdUpdate').evaluate(el=>el.click());
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
    await expect(page.locator('.v38-first-shortcut .v38-guide-card')).toHaveCount(1);
    await expect(page.locator('.v38-play-card')).toHaveCount(0);
    await expect(page.locator('.cm-bottom-nav [data-v7-view="play"]')).toBeVisible();
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

// LINE-native consent flow is tested without touching a real user or AirWAIT.
test('Reception auto-opens LINE permission screen for unapproved profile',async({page})=>{
  await installProduction(page);
  await page.route('https://static.line-scdn.net/**',route=>route.fulfill({
    status:200,contentType:'application/javascript',
    body:"window.__scope='prompt';window.__requestCount=0;window.liff={init:async()=>{},isInClient:()=>true,isLoggedIn:()=>true,getAccessToken:()=>'prod_test_access_token_abcdefghijklmnopqrstuvwxyz',permission:{query:async()=>({state:window.__scope}),requestAll:async()=>{window.__requestCount++;window.__scope='granted';}}};"
  }));
  await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#recSubmit')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__requestCount)).toBe(1);
  await expect(page.locator('#recProfileConsent')).toBeHidden();
  expect(await page.evaluate(()=>window.__scope)).toBe('granted');
});

test('Reception offers a one-tap LINE permission button after initial dialog declined',async({page})=>{
  await installProduction(page);
  await page.route('https://static.line-scdn.net/**',route=>route.fulfill({
    status:200,contentType:'application/javascript',
    body:"window.__scope='prompt';window.__requestCount=0;window.liff={init:async()=>{},isInClient:()=>true,isLoggedIn:()=>true,getAccessToken:()=>'prod_test_access_token_abcdefghijklmnopqrstuvwxyz',permission:{query:async()=>({state:window.__scope}),requestAll:async()=>{window.__requestCount++;if(window.__requestCount===1)throw Error('declined');window.__scope='granted';}}};"
  }));
  await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>window.__requestCount)).toBe(1);
  await expect(page.locator('#recProfileConsent')).toBeVisible();
  await expect(page.locator('#recSubmit')).toBeDisabled();
  await page.locator('#recProfileConsentButton').click();
  await expect.poll(()=>page.evaluate(()=>window.__requestCount)).toBe(2);
  await expect(page.locator('#recProfileConsent')).toBeHidden();
});

test('Reception does not enable submit if profile scope is missing from the channel',async({page})=>{
  await installProduction(page);
  await page.route('https://static.line-scdn.net/**',route=>route.fulfill({
    status:200,contentType:'application/javascript',
    body:"window.__requestCount=0;window.liff={init:async()=>{},isInClient:()=>true,isLoggedIn:()=>true,getAccessToken:()=>'prod_test_access_token_abcdefghijklmnopqrstuvwxyz',permission:{query:async()=>({state:'unavailable'}),requestAll:async()=>{window.__requestCount++;}}};"
  }));
  await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#recProfileConsent')).toBeVisible();
  await expect(page.locator('#recProfileConsentText')).toContainText('スタッフ');
  await expect(page.locator('#recSubmit')).toBeDisabled();
  expect(await page.evaluate(()=>window.__requestCount)).toBe(0);
});

test('Older LIFF SDK can open native profile consent through getProfile when permission APIs are absent',async({page})=>{
  await installProduction(page);
  await page.route('https://static.line-scdn.net/**',route=>route.fulfill({
    status:200,contentType:'application/javascript',
    body:"window.__profileCalls=0;window.liff={init:async()=>{},isInClient:()=>true,isLoggedIn:()=>true,getAccessToken:()=>'prod_test_access_token_abcdefghijklmnopqrstuvwxyz',getProfile:async()=>{window.__profileCalls++;return {userId:'U_not_sent',displayName:'Not sent'};}};"
  }));
  await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>window.__profileCalls)).toBe(1);
  await expect(page.locator('#recProfileConsent')).toBeHidden();
  await expect(page.locator('#recSubmit')).toBeVisible();
});

test('Reception blocks submission when the LINE permission query itself fails',async({page})=>{
  await installProduction(page);
  await page.route('https://static.line-scdn.net/**',route=>route.fulfill({
    status:200,contentType:'application/javascript',
    body:"window.liff={init:async()=>{},isInClient:()=>true,isLoggedIn:()=>true,getAccessToken:()=>'prod_test_access_token_abcdefghijklmnopqrstuvwxyz',permission:{query:async()=>{throw Error('LINE temporary failure')},requestAll:async()=>{}}};"
  }));
  await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#recProfileConsent')).toBeVisible();
  await expect(page.locator('#recProfileConsentText')).toContainText('確認できません');
  await expect(page.locator('#recSubmit')).toBeDisabled();
});

test('Reception offers official WEB alternative when LINE profile permission is unavailable',async({page})=>{
  await installProduction(page);
  await page.route('https://static.line-scdn.net/**',route=>route.fulfill({
    status:200,contentType:'application/javascript',
    body:"window.liff={init:async()=>{},isInClient:()=>true,isLoggedIn:()=>true,getAccessToken:()=>'prod_test_access_token_abcdefghijklmnopqrstuvwxyz',permission:{query:async()=>({state:'unavailable'}),requestAll:async()=>{}}};"
  }));
  await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#recProfileConsent')).toBeVisible();
  await expect(page.locator('#recWebFallback')).toBeVisible();
  await expect(page.locator('#recWebFallback a')).toHaveAttribute('href','https://airwait.jp/WCSP/storeDetail?storeNo=AKR2298124918');
  await expect(page.locator('#recSubmit')).toBeDisabled();
});

test('HOME shows an ordinary finished-slots message, not a crowd fetch error, when AirWAIT has no published slots',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({ok:false,error:'AIRWAIT_CROWD_EMPTY'})});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const box=page.locator('#v38Slots');
 await expect(box).toContainText('本日の受付枠は終了しました');
 await expect(box).not.toContainText('人数を取得できませんでした');
 await expect(box.locator('.v38-crowd-card')).toHaveCount(3);
});

test('HOME does not falsely announce reception ended when AirWAIT crowd endpoint fails',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'CROWD_UNAVAILABLE'})});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const box=page.locator('#v38Slots');
 await expect(box.locator('#v38CrowdAge')).toHaveText('最終更新 —:—');
 await expect(box).not.toContainText('本日の受付枠は終了しました');
 await expect(box.locator('.v38-crowd-card')).toHaveCount(3);
 await expect(box.locator('.v38-crowd-list [data-v7-view="reception"]')).toHaveCount(0);
 await expect(box.locator('#v613Board [data-v7-view="reception"]')).toHaveCount(0);
});

test('HOME uses a neutral no-visible-slots state for valid quota data without verified counts',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,fetchedAt:'2026-10-03T03:00:00.000Z',
   slots:[{waitTypeId:'0032',slotKey:'12:30',reserveUnit:'',remaining:null,matchMode:'none',evidence:'NO_MATCH'}],
   observedDetails:[]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const box=page.locator('#v38Slots');
 await expect(box.locator('.v38-crowd-card')).toHaveCount(3);
 await expect(box.locator('.v38-crowd-list .v38-crowd-channel--web strong')).toHaveText(['確認中','確認中','確認中']);
 await expect(box.locator('#v613Board .v38-crowd-channel--web strong')).toHaveText(['—','—','—']);
 await expect(box).not.toContainText('本日の受付枠は終了しました');
 await expect(box).not.toContainText('受付枠の空き状況を確認できません');
 await expect(box.locator('.v38-crowd-list [data-v7-view="reception"]')).toHaveCount(3);
 await expect(box.locator('#v613Board [data-v7-view="reception"]')).toHaveCount(3);
});

test('HOME clears a fresh saved capacity snapshot when staff remove all public AirWAIT slots',async({page})=>{
 await installProduction(page);
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_crowd_snapshot_production_v1',JSON.stringify({
   slots:[{waitTypeId:'0032',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:40}],
   details:[],operationalDate:'2026-10-03',businessType:'土日祝日',savedAt:Date.now(),verifiedFresh:true,publicFlags:[['0030',true],['0032',true],['0034',true],['0029',true],['0031',true],['0033',true]]
  }));
 });
 await page.route(GATEWAY+'**',route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({ok:false,error:'AIRWAIT_CROWD_EMPTY'})});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const box=page.locator('#v38Slots');
 await expect(box.locator('.v38-crowd-list')).toBeAttached();
 // The saved quota is fresh so automatic polling can postpone a network request.
 // Retry the internal manual action until startup and any concurrent fetch have
 // completed. This tests quota invalidation, not JS load-event timing.
 await expect.poll(async()=>{
  if((await box.textContent()||'').includes('本日の受付枠は終了しました'))return true;
  await page.locator('#v38CrowdUpdate').evaluate(el=>{if(!el.disabled)el.click()}).catch(()=>{});
  return false;
 },{timeout:12000,intervals:[200,350,500,750]}).toBe(true);
 await expect(box).not.toContainText('残り40人');
});

test('HOME treats an AirWAIT empty warning on a stale snapshot as ended, not as old remaining seats',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:true,warning:'AIRWAIT_CROWD_EMPTY',fetchedAt:'2026-10-03T03:00:00.000Z',
   slots:[{waitTypeId:'0032',slotKey:'12:30',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:88}],
   observedDetails:[]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Slots')).toContainText('本日の受付枠は終了しました');
 await expect(page.locator('#v38Slots')).not.toContainText('残り88人');
});

test('HOME confirms real hidden AirWAIT slots rather than blaming the connection',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action==='waitTypes')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,waitTypes:['0029','0031','0033','0030','0032','0034'].map(waitTypeId=>({waitTypeId,dispFlg:false}))
  })});
  if(action!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,fetchedAt:'2026-10-03T03:00:00.000Z',
   slots:['0030','0032','0034'].map(waitTypeId=>({waitTypeId,reserveUnit:'',remaining:null,matchMode:'none',evidence:'NO_MATCH'})),
   observedDetails:[{detailedWaitType:'《ご待機者専用》',remaining:null}]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Slots')).toContainText('本日の受付枠は終了しました');
 await expect(page.locator('#v38Slots')).not.toContainText('通信状態をご確認');
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
});

test('HOME does not show archived positive headcounts after all public AirWAIT slots are hidden',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T10:10:00.000Z'});
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_last_verified_crowd_day_v1',JSON.stringify({
   date:'2026-10-03',businessType:'土日祝日',savedAt:Date.now()-600000,
   slots:['0030','0032','0034'].map((waitTypeId,i)=>({
    waitTypeId,slotKey:['10:00','12:30','15:00'][i],
    reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:100
   })),
   details:['10時25分頃入場【土休日特定日】','12時50分頃入場【土休日特定日】',
    '15時15分頃入場時間【土休日特定日】'].map(detailedWaitType=>({
     detailedWaitType,reserveUnit:'PERSON',remaining:50,remainingVerified:true
   }))
  }));
 });
 let visibilityChecks=0;
 await page.route(GATEWAY+'**',route=>{
  const u=new URL(route.request().url()),action=u.searchParams.get('action');
  if(action==='businessDay'){
   const date=u.searchParams.get('date');
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,operationalDate:date,calendarDate:date,
    businessType:date==='2026-10-03'?'土日祝日':'平日特定日',
    closingTime:date==='2026-10-03'?'18:00':'17:00',durationLabel:'3時間'
   })});
  }
  if(action==='crowdRemaining')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,fetchedAt:'2026-10-03T10:10:00.000Z',
   onlineReception:{enabled:false,code:'03'},
   slots:['0024','0027','0030','0032','0034','0036','0038'].map(waitTypeId=>({
    waitTypeId,reserveUnit:'',remaining:null,matchMode:'none',evidence:'NO_MATCH'
   })),
   observedDetails:[{detailedWaitType:'《ご待機者専用》',reserveUnit:'GROUP',remaining:null}]
  })});
  if(action==='waitTypes'){
   visibilityChecks++;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,waitTypes:Array.from({length:50},(_,i)=>({
     waitTypeId:String(i+1).padStart(4,'0'),dispFlg:false
    }))
   })});
  }
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>visibilityChecks,{timeout:12000}).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('asoboon_v2_last_verified_crowd_day_v1')),
  {timeout:12000}).toBeNull();
 await expect(page.locator('#v613Board .v613-row')).toHaveCount(3);
 await expect(page.locator('#v613Board .v613-percent')).toHaveText(['—','—','—']);
 await expect(page.locator('#v613Board .v38-crowd-channel--web strong')).toHaveText(['—','—','—']);
 await expect(page.locator('#v613Board .v38-crowd-channel--onsite strong')).toHaveText(['—','—','—']);
 await expect(page.locator('#v38CrowdAge')).toContainText('最終更新 —:—');
 await expect(page.locator('#v38Slots a[href],#v38Slots [data-v7-view="reception"]')).toHaveCount(0);
 for(const width of [320,375,390,430,768]){
  await page.setViewportSize({width,height:820});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }
});

test('After 19:00 with next day closed, archived seats are invalidated using today hidden wait types',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T10:10:00.000Z'});
 await page.addInitScript(()=>localStorage.setItem('asoboon_v2_last_verified_crowd_day_v1',JSON.stringify({
  date:'2026-10-03',businessType:'土日祝日',savedAt:Date.now()-360000,
  slots:['0030','0032','0034'].map(waitTypeId=>({
   waitTypeId,remaining:130,reserveUnit:'PERSON',matchMode:'exact-name',evidence:'PERSON'
  })),
  details:['10時25分頃入場【土休日特定日】','12時50分頃入場【土休日特定日】','15時15分頃入場時間【土休日特定日】'].map(detailedWaitType=>({
   detailedWaitType,reserveUnit:'PERSON',remaining:45,remainingVerified:true
  }))
 })));
 let crowdReads=0,visibilityReads=0;
 await page.route(GATEWAY+'**',route=>{
  const u=new URL(route.request().url()),action=u.searchParams.get('action');
  if(action==='businessDay'){
   const date=u.searchParams.get('date'),closed=date!=='2026-10-03';
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,operationalDate:date,calendarDate:date,
    businessType:closed?'休館日':'土日祝日',isClosed:closed,
    closingTime:closed?'00:00':'18:00',durationLabel:'2時間30分'
   })});
  }
  if(action==='crowdRemaining'){crowdReads++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,fetchedAt:'2026-10-03T10:10:00.000Z',
   onlineReception:{enabled:false,code:'03'},
   slots:['0024','0027','0030','0032','0034','0036','0038'].map(waitTypeId=>({
    waitTypeId,remaining:null,reserveUnit:'',matchMode:'none',evidence:'NO_MATCH'
   })),observedDetails:[{detailedWaitType:'《ご待機者専用》',reserveUnit:'GROUP',remaining:null}]
  })});}
  if(action==='waitTypes'){visibilityReads++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,waitTypes:Array.from({length:50},(_,i)=>({waitTypeId:String(i+1).padStart(4,'0'),dispFlg:false}))
  })});}
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>crowdReads,{timeout:12000}).toBeGreaterThan(0);
 await expect.poll(()=>visibilityReads,{timeout:12000}).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('asoboon_v2_last_verified_crowd_day_v1')),
  {timeout:12000}).toBeNull();
 await expect(page.locator('#v613Board .v613-percent')).toHaveText(['—','—','—']);
 await expect(page.locator('#v613Board .v38-crowd-channel--web strong')).toHaveText(['—','—','—']);
 await expect(page.locator('#v613Board .v38-crowd-channel--onsite strong')).toHaveText(['—','—','—']);
 await expect(page.locator('#v38Hero h1')).toHaveText('本日の営業は終了しました');
 await expect(page.locator('#v38Slots a[href],#v38Slots [data-v7-view="reception"]')).toHaveCount(0);
});
test('HOME hides reception booking CTA during open hours when staff unpublish every slot',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T03:10:00.000Z'});
 let checkCount=0;
 await page.route(GATEWAY+'**',route=>{
  const u=new URL(route.request().url()),action=u.searchParams.get('action');
  if(action==='crowdRemaining')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,fetchedAt:'2026-10-03T03:10:00.000Z',
   onlineReception:{enabled:false,code:'03'},
   slots:['0030','0032','0034'].map(waitTypeId=>({
    waitTypeId,reserveUnit:'',remaining:null,matchMode:'none',evidence:'NO_MATCH'
   })),observedDetails:[]
  })});
  if(action==='waitTypes'){
   checkCount++;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,waitTypes:Array.from({length:50},(_,i)=>({
     waitTypeId:String(i+1).padStart(4,'0'),dispFlg:false
    }))
   })});
  }
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>checkCount,{timeout:12000}).toBeGreaterThan(0);
 await expect(page.locator('#v38Hero h1')).toHaveText('公開中の受付枠はありません');
 await expect(page.locator('#v38Hero')).not.toContainText('順番を取る');
 await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toHaveCount(0);
 await expect(page.locator('#v38Slots [data-v7-view="reception"],#v38Slots a[href]')).toHaveCount(0);
 await expect(page.locator('#v613Board .v613-percent')).toHaveText(['—','—','—']);
});
test('HOME refuses to claim reception ended when one AirWAIT slot remains published',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action==='waitTypes')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,waitTypes:['0029','0031','0033','0030','0032','0034'].map(waitTypeId=>({waitTypeId,dispFlg:waitTypeId==='0031'}))
  })});
  if(action!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:false,fetchedAt:'2026-10-03T03:00:00.000Z',
   slots:[{waitTypeId:'0032',reserveUnit:'',remaining:null,matchMode:'none',evidence:'NO_MATCH'}],
   observedDetails:[]
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(1);
 await expect(page.locator('#v38Slots .v38-crowd-list .v38-crowd-channel--web strong')).toHaveText(['受付なし']);
 await expect(page.locator('#v613Board .v38-crowd-channel--web strong')).toHaveText(['受付なし']);
 await expect(page.locator('#v38Slots')).toContainText('12:30回');
 await expect(page.locator('#v38Slots')).not.toContainText('10:00回');
 await expect(page.locator('#v38Slots')).not.toContainText('本日の受付枠は終了しました');
});

test('HOME recovers from an invalid crowd count response by checking all hidden wait types',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action==='waitTypes')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,waitTypes:['0029','0031','0033','0030','0032','0034'].map(waitTypeId=>({waitTypeId,dispFlg:false}))
  })});
  if(action!=='crowdRemaining')return route.fallback();
  return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'AIRWAIT_CROWD_INFO_FAILED_HTTP_200_RC_NONE'})});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Slots')).toContainText('本日の受付枠は終了しました');
 await expect(page.locator('#v38Slots')).not.toContainText('通信状態をご確認');
});

test('HOME does not launch a second crowd request while the hidden-slot cross-check is pending',async({page})=>{
 await installProduction(page);
 let crowdReads=0,waitTypeReads=0,release;
 const hold=new Promise(resolve=>{release=resolve});
 await page.route(GATEWAY+'**',async route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action==='crowdRemaining'){
   crowdReads++;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,stale:false,fetchedAt:'2026-10-03T03:00:00.000Z',
    slots:[{waitTypeId:'0032',reserveUnit:'',remaining:null,matchMode:'none',evidence:'NO_MATCH'}],
    observedDetails:[]
   })});
  }
  if(action==='waitTypes'){
   waitTypeReads++;
   await hold;
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,waitTypes:['0029','0031','0033','0030','0032','0034'].map(waitTypeId=>({waitTypeId,dispFlg:false}))
   })});
  }
  return route.fallback();
 });
 try{
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect.poll(()=>waitTypeReads).toBe(1);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(100);
  expect(crowdReads).toBe(1);
  release();
  await expect(page.locator('#v38Slots')).toContainText('本日の受付枠は終了しました');
 }finally{release()}
});



test('v5.8 HOME exposes true actions and readable operational facts rather than a static card deck',async({page})=>{
 await installProduction(page);
 const homeURL=new URL('../../home.html',BASE).href;
 const siteBase=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{
   configurable:true,get(){return this.__mintTestEnvironment;},
   set(value){this.__mintTestEnvironment=Object.freeze({...value,
    assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'
   });}
  });
 },siteBase);
 await page.goto(homeURL,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v58Flow')).toBeVisible();
 await expect(page.locator('#v58Primary')).toBeVisible();
 await expect(page.locator('#v58Lead #v38Hero')).toBeVisible();
 await expect(page.locator('#v58DayZone #v38Today')).toBeVisible();
 await expect(page.locator('#v58TimerZone #v38TimeguideShortcut')).toBeVisible();
 await expect(page.locator('#v59SlotsFold')).toHaveAttribute('open','');
 await expect(page.locator('#v59SlotsFold summary')).toBeHidden();
 await expect(page.locator('#v58SessionsZone #v38Slots')).toBeVisible();
 await expect(page.locator('#v613Board .v613-row')).toHaveCount(3);
 await expect(page.locator('#v58SessionsZone .v58-section-title')).toHaveText('受付の空き状況');
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
 await expect(page.locator('#v58Primary .v58-next-title')).toHaveText('当日受付をする');
 await expect(page.locator('#v58Lead #v38Hero [data-v7-view="reception"]')).toBeVisible();
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toBeVisible();
 await expect(page.locator('#boonV5WebReception,.boon-v5-web-reception')).toHaveCount(0);
 await expect(page.locator('#v56CommandDeck,#v56QueueTile,#v56CrowdStage')).toHaveCount(0);
 // Business-day information is not a fake button that redirects to a timer.
 expect(await page.locator('#v38Today').evaluate(el=>({
  tag:el.tagName,role:el.getAttribute('role'),action:el.getAttribute('data-v7-view')
 }))).toEqual({tag:'DIV',role:'group',action:null});

 const stable=await page.evaluate(()=>new Promise(resolve=>{
  let mutations=0;
  const observer=new MutationObserver(records=>{
   for(const rec of records)if(rec.type==='attributes')mutations++;
  });
  observer.observe(document.querySelector('.v38-home'),{attributes:true,subtree:true,attributeFilter:['class','hidden']});
  setTimeout(()=>{observer.disconnect();resolve(mutations)},500);
 }));
 expect(stable,'no endless HOME attribute mutation loop').toBeLessThan(10);

 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:860});
  const state=await page.evaluate(()=>{
   const interactive=[
    '#v58Lead #v38Hero [data-v7-view="reception"]',
    '.cm-bottom-nav [data-v7-view="callstatus"]',
    '#v38TimeguideShortcut',
    '#v613Board .v38-crowd-channel--onsite:is(a,button)',
    '#v613Board .v38-crowd-channel--web:is(a,button)'
   ];
   return{
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    unique:['v38Today','v38TimeguideShortcut','v38Slots','v38Hero'].every(id=>document.querySelectorAll('#'+id).length===1),
    controls:interactive.map(selector=>{
     const node=document.querySelector(selector);
     if(!node)return{selector,missing:true};
     const r=node.getBoundingClientRect();
     return{selector,width:r.width,height:r.height,active:node.matches('button:not([disabled]),a[href]')};
    })
   };
  });
  expect(state.overflow,'horizontal overflow '+width).toBe(false);
  expect(state.unique,'unique native control IDs').toBe(true);
  for(const ctl of state.controls){
   expect(ctl.missing,ctl.selector+' missing').toBeFalsy();
   expect(ctl.width,ctl.selector+' width').toBeGreaterThanOrEqual(44);
   expect(ctl.height,ctl.selector+' height').toBeGreaterThanOrEqual(44);
   expect(ctl.active,ctl.selector+' is not actionable').toBe(true);
  }
 }
 const picker=page.locator('#asoboon-language-select');
 await expect(picker).toBeVisible();
 const translations={
  en:'Take a queue number','zh-CN':'领取排队号码',
  vi:'Lấy số thứ tự',ne:'पालो नम्बर लिनुहोस्',
  ko:'대기 번호 받기',kmr:'Hejmarekê bistîne'
 };
 await page.setViewportSize({width:320,height:860});
 for(const [lang,title] of Object.entries(translations)){
  await picker.selectOption(lang);
  await expect(page.locator('.v58-next-title')).toHaveText(title);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+lang).toBe(true);
 }
 await picker.selectOption('ja');
 await expect(page.locator('.v58-next-title')).toHaveText('当日受付をする');
 await page.locator('#v58TimerZone #v38TimeguideShortcut').click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('timeguide');
 await page.goto(homeURL,{waitUntil:'domcontentloaded'});
 await page.locator('.cm-bottom-nav [data-v7-view="callstatus"]').click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('callstatus');
 await page.goto(homeURL,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v59SlotsFold')).toHaveAttribute('open','');
 await expect(page.locator('#v613Board .v38-crowd-channel--onsite')).toHaveCount(3);
 await page.locator('#v613Board .v38-crowd-channel--onsite').first().click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('reception');
});


test('HOME contains only timer, first visit, two calendars, and bottom-only optional routes',async({page})=>{
 await installProduction(page);
 const homeURL=new URL('../../home.html',BASE).href;
 const siteBase=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{configurable:true,get(){return this.__mintTestEnvironment},
    set(value){this.__mintTestEnvironment=Object.freeze({...value,assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'})}});
 },siteBase);
 await page.goto(homeURL,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v58Lead #v38Hero')).toBeVisible();
 await expect(page.locator('#v58DayZone #v38Today')).toBeVisible();
 await expect(page.locator('#v58SessionsZone #v38Slots')).toBeVisible();
 await expect(page.locator('#v58TimerZone #v38TimeguideShortcut')).toBeVisible();
 await expect(page.locator('#v59CalendarLinks .v38-calendar-card')).toHaveCount(2);
 await expect(page.locator('.v38-first-shortcut .v38-guide-card')).toHaveCount(1);
 await expect(page.locator('.v38-guide,.v38-play,.v38-help,#v59GuideFold,#v59PlayFold')).toHaveCount(0);
 await expect(page.locator('.cm-bottom-nav .cm-nav-tab')).toHaveCount(4);
 await page.locator('.v38-first-shortcut [data-v7-view="first"]').click();
 await expect(page.locator('.v27-safety li')).toHaveCount(3);
 await page.locator('.cm-nav-tab[data-v7-view="home"]').click();
 const picker=page.locator('#asoboon-language-select');
 await picker.selectOption('en');
 await expect(page.locator('#v59CalendarLinks .v38-calendar-card').first().locator('strong')).toHaveText('Opening calendar');
 await picker.selectOption('ja');
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:860});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const b=await page.locator('.v38-first-shortcut .v38-guide-card').boundingBox();
  expect(b.height).toBeGreaterThanOrEqual(56);
 }
});

test('HOME and calendar offer self-service help without any facility telephone link',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v38-legal')).not.toContainText(/048[-\s]?420[-\s]?9780/);
 await expect(page.locator('.v38-legal a[href^="tel:"]')).toHaveCount(0);
 await openGuideRoute(page,'faq');
 await expect(page.locator('.cm-faq details')).toHaveCount(16);
 await expect(page.locator('.cm-faq')).toContainText('7:00');
 await expect(page.locator('.cm-faq')).toContainText('9:30');
 await expect(page.locator('.cm-faq')).toContainText('残人数');
 await expect(page.locator('.cm-faq')).toContainText('再入場');
 await expect(page.locator('.cm-faq')).not.toContainText('お電話');
 await expect(page.locator('.cm-hub [href^="tel:"]')).toHaveCount(0);
 await page.goto(BASE+'business-calendar.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('footer')).not.toContainText('048-420-9780');
 await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
 await expect(page.locator('footer')).toContainText('よくある質問を見る');
});

test('AirWAIT waitTypes independently hide unpublished WEB slot but keep still-public LINE count',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='waitTypes')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,waitTypes:[
   {waitTypeId:'0029',dispFlg:true},{waitTypeId:'0031',dispFlg:true},{waitTypeId:'0033',dispFlg:true},
   {waitTypeId:'0030',dispFlg:false},{waitTypeId:'0032',dispFlg:true},{waitTypeId:'0034',dispFlg:true}
  ]})});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const first=page.locator('#v613Board .v613-row').first();
 await expect(first.locator('.v38-crowd-channel--web strong')).toHaveText('受付なし');
 await expect(first.locator('.v38-crowd-channel--onsite strong')).toContainText('117');
 await expect(first.locator('.v613-percent')).toHaveText('63%');
 await expect(first.locator('a[href]')).toHaveCount(0);
 await expect(first.locator('[data-v7-view="reception"]')).toHaveCount(1);
 await expect(page.locator('#v613Board .v613-row').nth(1).locator('.v38-crowd-channel--web strong')).toContainText('71');
});

test('AirWAIT all-unpublished overrides stale positive counts even if getWaitInfo still returns numbers',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  if(new URL(route.request().url()).searchParams.get('action')!=='waitTypes')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,waitTypes:[
   '0029','0031','0033','0030','0032','0034'
  ].map(waitTypeId=>({waitTypeId,dispFlg:false}))})});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Hero')).toContainText('公開中の受付枠はありません');
 await expect(page.locator('#v613Board .v613-percent')).toHaveText(['—','—','—']);
 await expect(page.locator('#v613Board .v38-crowd-channel--web strong')).toHaveText(['—','—','—']);
 await expect(page.locator('#v613Board .v38-crowd-channel--onsite strong')).toHaveText(['—','—','—']);
 await expect(page.locator('#v38Slots a[href],#v38Slots button[data-v7-view="reception"]')).toHaveCount(0);
});

test('After 19:00, HOME never labels archived or newly fetched headcounts as current availability',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T10:10:00.000Z'});
 await page.addInitScript(()=>localStorage.setItem('asoboon_v2_last_verified_crowd_day_v1',JSON.stringify({
  date:'2026-10-03',businessType:'土日祝日',savedAt:Date.now()-60000,
  slots:['0030','0032','0034'].map(waitTypeId=>({waitTypeId,remaining:130,reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name'})),
  details:['10時25分頃入場【土休日特定日】','12時50分頃入場【土休日特定日】','15時15分頃入場時間【土休日特定日】']
   .map(detailedWaitType=>({detailedWaitType,remaining:45,reserveUnit:'PERSON',remainingVerified:true}))
 })));
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v613Board .v613-percent')).toHaveText(['—','—','—']);
 await expect(page.locator('#v613Board .v38-crowd-channel--web strong')).toHaveText(['—','—','—']);
 await expect(page.locator('#v38Slots a[href],#v38Slots [data-v7-view="reception"]')).toHaveCount(0);
});

test('Confirmed hidden WEB quota stays hidden when a later crowdRemaining request fails',async({page})=>{
 await installProduction(page);
 let crowdErrors=0,breakCrowd=false;
 await page.route(GATEWAY+'**',route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action==='waitTypes')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,waitTypes:[
   {waitTypeId:'0029',dispFlg:true},{waitTypeId:'0031',dispFlg:true},{waitTypeId:'0033',dispFlg:true},
   {waitTypeId:'0030',dispFlg:false},{waitTypeId:'0032',dispFlg:true},{waitTypeId:'0034',dispFlg:true}
  ]})});
  if(action==='crowdRemaining'&&breakCrowd){crowdErrors++;return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"TRANSIENT_TEST"}'});}
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const first=page.locator('#v613Board .v613-row').first();
 await expect(first.locator('.v38-crowd-channel--web strong')).toHaveText('受付なし');
 await expect(first.locator('.v38-crowd-channel--onsite strong')).toContainText('117');
 breakCrowd=true;
 await page.locator('#v38CrowdUpdate').evaluate(el=>el.click());
 await expect.poll(()=>crowdErrors,{timeout:10000}).toBe(1);
 await expect(first.locator('.v38-crowd-channel--web strong')).toHaveText('受付なし');
 await expect(first.locator('a[href]')).toHaveCount(0);
 await expect(first.locator('.v38-crowd-channel--onsite strong')).toContainText('—');
});

test('Newly hidden WEB overrides an older certified after-hours archive',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T09:10:00.000Z'});
 await page.addInitScript(()=>localStorage.setItem('asoboon_v2_last_verified_crowd_day_v1',JSON.stringify({
  date:'2026-10-03',businessType:'土日祝日',savedAt:Date.now()-60000,
  publicFlags:[['0030',true],['0032',true],['0034',true],['0029',true],['0031',true],['0033',true]],
  slots:[{waitTypeId:'0030',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:50}],
  details:[{detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:117,remainingVerified:true}]
 })));
 await page.route(GATEWAY+'**',route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action==='waitTypes')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,waitTypes:['0030','0032','0034','0029','0031','0033'].map(waitTypeId=>({waitTypeId,dispFlg:waitTypeId!=='0030'}))
  })});
  if(action==='crowdRemaining')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,stale:true,fetchedAt:'2026-10-03T08:59:00.000Z',slots:[{waitTypeId:'0030',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'exact-name',remaining:50}],observedDetails:[]
  })});
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const first=page.locator('#v613Board .v613-row').first();
 await expect(first).toBeVisible();
 await expect(first.locator('.v38-crowd-channel--web strong')).toHaveText('—');
 await expect(first.locator('.v38-crowd-channel--onsite strong')).toContainText('117');
 await expect(first.locator('a[href]')).toHaveCount(0);
});

test('Confirmed unpublished WEB remains hidden when later waitTypes lookup fails',async({page})=>{
 await installProduction(page);
 let waitReads=0,failVisibility=false;
 await page.route(GATEWAY+'**',route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action!=='waitTypes')return route.fallback();
  waitReads++;
  if(failVisibility)return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"error":"TRANSIENT_TEST"}'});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,waitTypes:[
   {waitTypeId:'0029',dispFlg:true},{waitTypeId:'0031',dispFlg:true},{waitTypeId:'0033',dispFlg:true},
   {waitTypeId:'0030',dispFlg:false},{waitTypeId:'0032',dispFlg:true},{waitTypeId:'0034',dispFlg:true}
  ]})});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const first=page.locator('#v613Board .v613-row').first();
 await expect.poll(()=>waitReads,{timeout:12000}).toBeGreaterThanOrEqual(1);
 await expect(first.locator('.v38-crowd-channel--web strong')).toHaveText('受付なし');
 await expect(first.locator('.v38-crowd-channel--onsite strong')).toContainText('117');
 // The hidden refresh button is disabled during the initial API check.
 // Only trigger a second fetch AFTER the first one has completed.
 await expect(page.locator('#v38CrowdUpdate')).toBeEnabled();
 failVisibility=true;
 await page.locator('#v38CrowdUpdate').evaluate(el=>el.click());
 await expect.poll(()=>waitReads,{timeout:10000}).toBeGreaterThanOrEqual(2);
 await expect(first.locator('.v38-crowd-channel--web strong')).toHaveText('受付なし');
 await expect(first.locator('a[href]')).toHaveCount(0);
});


test('2026-11-10 reception has exactly one 3-stage wizard with required consent intact at 320px',async({page})=>{
 await installProduction(page);
 await page.setViewportSize({width:320,height:700});
 await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
 const stages=page.locator('.rv7-progress [data-rv7-step]');
 await expect(stages).toHaveCount(3);
 await expect(page.locator('#boonV4Progress,.rv7-confirm-label,.rv7-consent-label')).toHaveCount(0);
 await expect(stages.nth(2)).toContainText('確認・同意');
 await expect(stages.first()).toHaveAttribute('aria-current','step');
 await stages.nth(1).focus();await expect(stages.nth(1)).toBeFocused();
 await stages.nth(1).press('Enter');
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(100);
 await expect(page.locator('#recSubmit')).toBeDisabled();
 await expect(page.locator('#recAgree')).not.toBeChecked();
 const metrics=await page.evaluate(()=>({
  overflow:document.documentElement.scrollWidth-innerWidth,
  widths:[...document.querySelectorAll('#app .rec-stepper button')].filter(x=>x.getBoundingClientRect().width).map(x=>x.getBoundingClientRect().width),
  stageSize:parseFloat(getComputedStyle(document.querySelector('.rv7-progress [data-rv7-step] b')).fontSize),
  noteSize:parseFloat(getComputedStyle(document.querySelector('.v26-infant-note span')).fontSize)
 }));
 expect(metrics.overflow).toBeLessThanOrEqual(1);
 expect(metrics.widths.length).toBeGreaterThan(0);
 expect(Math.min(...metrics.widths)).toBeGreaterThanOrEqual(44);
 expect(metrics.stageSize).toBeGreaterThanOrEqual(12);
 expect(metrics.noteSize).toBeGreaterThanOrEqual(12);
});
test('2026-11-10 first-time flow removes repeated copy and provides legible steps',async({page})=>{
 await installProduction(page);
 await page.setViewportSize({width:320,height:700});
 await page.goto(BASE+'?view=first',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v27-first-page')).toBeVisible();
 await expect(page.locator('.v27-step')).toHaveCount(3);
 await expect(page.locator('.v27-step.waiting strong')).toContainText('呼出');
 await expect(page.locator('.v27-step.called p')).toHaveText('入口で受付番号を見せてください。');
 const sizes=await page.locator('.v27-step-copy p').evaluateAll(xs=>xs.map(x=>parseFloat(getComputedStyle(x).fontSize)));
 expect(sizes.length).toBe(3);expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('2026-11-10 HOME privacy-policy link has a usable touch target',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const target=page.locator('.v38-legal a[href*="privacy-policy"]');
 await expect(target).toBeVisible();
 await expect.poll(async()=>Math.round((await target.boundingBox())?.height||0),{timeout:12000}).toBeGreaterThanOrEqual(44);
});


test('2026-11-10 official HOME shows verified closed-day facts, not stale loading or a closed queue',async({page})=>{
 await installProduction(page,{clockIso:'2026-11-10T03:00:00.000Z'});
 await page.route(GATEWAY+'**',async route=>{
  const a=new URL(route.request().url()).searchParams.get('action');
  if(a==='businessDay')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,operationalDate:'2026-11-10',calendarDate:'2026-11-10',businessType:'休館',isClosed:true,durationLabel:'',closingTime:''})});
  return route.fallback();
 });
 const official=new URL('../../home.html',BASE).href;
 await page.setViewportSize({width:320,height:844});
 await page.goto(official,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Today')).toHaveClass(/closed/);
 await expect(page.locator('#v38Today>span:nth-child(2) strong')).toHaveText('休館日');
 await expect(page.locator('#v58Primary .v58-next-title')).toHaveText('本日は休館日です');
 await expect(page.locator('#v58Primary .v58-next-summary')).not.toContainText('受付番号');
  await expect(page.locator('#v59GuideFold,#v59PlayFold')).toHaveCount(0);
  await expect(page.locator('.v38-first-shortcut .v38-guide-card')).toHaveCount(1);
 const nav=await page.locator('#app>.cm-bottom-nav .cm-nav-tab').evaluateAll(xs=>xs.map(x=>({
  height:Math.round(x.getBoundingClientRect().height),
  label:parseFloat(getComputedStyle(x.querySelector('span')||x).fontSize)
 })));
 expect(nav).toHaveLength(4);
 expect(nav.every(x=>x.height>=44&&x.label>=12)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 const selector=page.locator('#asoboon-language-select');
 await selector.selectOption('en');
 await expect(page.locator('#v38Today>span:nth-child(2) strong')).toHaveText('Closed');
 await expect(page.locator('#v58Primary .v58-next-title')).toHaveText('Closed today');
 await selector.selectOption('ja');
 await expect(page.locator('#v38Today>span:nth-child(2) strong')).toHaveText('休館日');
});


test('2026-11-10 party-size validation never falsely announces reception availability',async({page})=>{
 await installProduction(page);
 await page.goto(BASE+'?view=reception',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#recSlotLabel')).toHaveText('未選択');
 await expect(page.locator('#recPeopleMsg')).toHaveText('人数の条件は満たしています。');
 await expect(page.locator('#recSubmit')).toBeDisabled();
});


test('2026-11-10 official route CSS keeps rules, call details and timer safety copy readable',async({page})=>{
 await installProduction(page);
 await page.setViewportSize({width:320,height:844});
 const examples=[
  ['rules','.pv7-promise small'],
  ['timeguide','.tg-note'],
  ['callstatus','.cs-waittype'],
  ['callstatus','#csMessage'],
 ];
 for(const [route,selector] of examples){
  await page.goto(BASE+'?view='+route,{waitUntil:'domcontentloaded'});
  const item=page.locator(selector).first();
  await expect(item).toBeVisible();
  await expect.poll(async()=>item.evaluate(el=>Number.parseFloat(getComputedStyle(el).fontSize)),{timeout:10000}).toBeGreaterThanOrEqual(12);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
});


test('2026-11-10 FAQ searches the answer as well as the question, and clear restores all 16',async({page})=>{
 await installProduction(page);
 await page.goto(BASE+'?view=faq',{waitUntil:'domcontentloaded'});
 const q=page.locator('#cmFaqQuery'), items=page.locator('#cmFaqList details'),result=page.locator('#cmFaqResult');
 await expect(q).toBeVisible();
 await expect(items).toHaveCount(16);
 await q.fill('37L');
 await expect(items.filter({visible:true})).toHaveCount(1);
 await expect(items.filter({visible:true}).first()).toContainText('ロッカー');
 await expect(result).toContainText('1件');
 await q.fill('ありません検索無');
 await expect(items.filter({visible:true})).toHaveCount(0);
 await expect(result).toContainText('一致する質問がありません');
 const clear=page.locator('#cmFaqClear');
 await expect(clear).toBeVisible();
 await expect(clear).toHaveJSProperty('hidden',false);
 await clear.click();
 await expect(items.filter({visible:true})).toHaveCount(16);
 await expect(q).toHaveValue('');
 await expect(q).toBeFocused();
 for(const width of [320,375,390,430,768]){
   await page.setViewportSize({width,height:844});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),'horizontal overflow '+width).toBeLessThanOrEqual(1);
   const rect=await q.boundingBox();expect(rect.height).toBeGreaterThanOrEqual(44);
 }
});
test('2026-11-11 HOME routes self-service FAQ and play through the bottom navigation only',async({page})=>{
 await installProduction(page);
 const official=new URL('../../home.html',BASE).href;
 const siteBase=new URL('../../',BASE).href;
 await page.addInitScript(site=>{Object.defineProperty(window,'ASOBOON_V2_ENV',{
  configurable:true,get(){return this.__faqEnvironment},
  set(value){this.__faqEnvironment=Object.freeze({...value,assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'})}
 })},siteBase);
 await page.goto(official,{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v38-help,.v38-play,#v59PlayFold')).toHaveCount(0);
 await page.locator('.cm-nav-tab[data-v7-view="play"]').click();
 await expect(page.locator('.cm-hub h1')).toHaveText('あそび');
 await page.locator('.cm-nav-tab[data-v7-view="guide"]').click();
 await page.locator('.cm-hub-list [data-v7-view="faq"]').click();
 await expect(page.locator('#cmFaqQuery')).toBeVisible();
 await expect(page).toHaveURL(/view=faq/);
 await page.locator('#cmFaqQuery').fill('再入場');
 await expect(page.locator('#cmFaqList details').filter({visible:true}).first()).toContainText('再入場');
});

test('2026-11-10 FAQ search is readable in English, Chinese and Korean',async({page})=>{
 await installProduction(page);
 await page.goto(BASE+'?view=faq',{waitUntil:'domcontentloaded'});
 const select=page.locator('#asoboon-language-select');
 const label=page.locator('.cm-faq-find label');
 const q=page.locator('#cmFaqQuery'),msg=page.locator('#cmFaqResult');
 await expect(q).toBeVisible();
 await select.selectOption('en');
 await expect(label).toHaveText('Search questions');
 await q.fill('37L');
 await expect(msg).toHaveText('1 result');
 await select.selectOption('zh-CN');
 await expect(label).toHaveText('搜索问题');
 await expect(msg).toHaveText('1个结果');
 await select.selectOption('ko');
 await expect(label).toHaveText('질문 검색');
 await expect(msg).toHaveText('1개 검색됨');
 await select.selectOption('ja');
 await expect(msg).toHaveText('1件見つかりました');
});


test('2026-11-10 21:00 JST current calendar closed overrides tomorrow operating day without changing saved number',async({page})=>{
 await installProduction(page,{clockIso:'2026-11-10T12:00:00.000Z'});
 let days=[];
 await page.route(GATEWAY+'**',async route=>{
  const u=new URL(route.request().url()),action=u.searchParams.get('action');
  if(action!=='businessDay')return route.fallback();
  const date=u.searchParams.get('date');days.push(date);
  const closed=date==='2026-11-10';
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,calendarDate:date,operationalDate:date,businessType:closed?'休館':'平日',
   isClosed:closed,durationLabel:closed?'':'無制限',closingTime:closed?'':'17:00'
  })});
 });
 const official=new URL('../../home.html',BASE).href;
 await page.goto(official,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Today>span:nth-child(2) strong')).toHaveText('休館日',{timeout:18000});
 await expect(page.locator('#v58Primary .v58-next-title')).toContainText('休館日');
 await expect(page.locator('#v58Primary')).not.toContainText('営業は終了しました');
 await expect(page.locator('#v38Slots')).toContainText('本日は休館日です');
 await expect(page.locator('#v38Slots')).not.toContainText('本日の受付枠は終了しました');
 expect(days).toContain('2026-11-10');
 expect(days).toContain('2026-11-11');
});

test('2026-11-10 call panel distinguishes 30-minute arrival and final session admission conditions',async({page})=>{
 await installProduction(page,{status:{
  ok:true,found:true,state:'calling',receiptNo:'F919',businessDate:'2026-10-03',
  waitTypeId:'0033',waitTypeName:'15:00の回',aheadCount:0,queueRank:1,
  activeCount:100,checkedAt:Date.parse('2026-10-03T03:00:00.000Z')
 }});
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
   businessDate:'2026-10-03',receiptNo:'F919',waitTypeId:'0033'
  }));
  localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
   businessDate:'2026-10-03',receiptNo:'F919',waitTypeId:'0033',
   sessionToken:'z'.repeat(40),expiresAt:4102444800000
  }));
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 const notice=page.locator('.v33-entry-action');
 await expect(notice).toBeVisible();
 await expect(notice).toContainText('ASOBooN入口');
 await expect(notice).toContainText('呼出から30分以内');
 await expect(notice).toContainText('各回の最終入場時刻にも注意');
 await expect(notice).not.toContainText('15:30');
 await expect(page.locator('#csTitle')).toContainText('入場できます');
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
});

test('2026-11-10 FAQ reentry rules are conditional and multilingual search does not overclaim translation',async({page})=>{
 await installProduction(page);
 await page.goto(BASE+'?view=faq',{waitUntil:'domcontentloaded'});
 const item=page.locator('#cmFaqList details[data-faq-key="reentry"]');
 await expect(item).toHaveCount(1);
 await expect(item).toContainText('全員で一時退場');
 await expect(item).toContainText('当日のレシート');
 await expect(item).toContainText('黄色ホルダー');
 await expect(item).toContainText('別の保護者が残る');
 await page.locator('#asoboon-language-select').selectOption('en');
 const note=page.locator('#cmFaqLanguageNote');
 await expect(note).toBeVisible();
 await expect(note).toContainText('Japanese');
 await page.locator('#cmFaqQuery').fill('re-entry');
 await expect(page.locator('#cmFaqList details').filter({visible:true})).toHaveCount(1);
 await expect(item).toBeVisible();
 await page.locator('#asoboon-language-select').selectOption('ja');
 await expect(note).toBeHidden();
});

test('2026-11-10 official reception keeps only its existing three-step wizard',async({page})=>{
 await installProduction(page);
 const homeURL=new URL('../../home.html',BASE).href;
 const siteBase=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{configurable:true,
   get(){return this.__threeStepEnv},set(value){this.__threeStepEnv=Object.freeze({...value,assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'})}});
 },siteBase);
 await page.setViewportSize({width:320,height:700});
 await page.goto(homeURL+'?view=reception',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#boonV4Progress [data-boon-p]')).toHaveCount(3);
 await expect(page.locator('.rv7-progress,.rv7-confirm-label,.rv7-consent-label')).toHaveCount(0);
 await expect(page.locator('#boonV4Progress [data-boon-p="3"]')).toContainText('確認・同意');
 await expect(page.locator('#boonV4StageIntro')).not.toContainText('STEP 01');
 await expect(page.locator('#recAgree')).not.toBeChecked();
 await expect(page.locator('#recSubmit')).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});


test('2026-11-10 timeguide checks actual calendar day after 19:00 cutoff, not tomorrow',async({page})=>{
 await installProduction(page,{clockIso:'2026-11-10T13:15:00.000Z'});
 const requested=[];
 await page.route(GATEWAY+'**',route=>{
  const u=new URL(route.request().url()),action=u.searchParams.get('action');
  if(action!=='businessDay')return route.fallback();
  const date=u.searchParams.get('date');requested.push(date);
  const closed=date==='2026-11-10';
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,operationalDate:date,calendarDate:date,businessType:closed?'休館日':'平日',
    isClosed:closed,closingTime:closed?'00:00':'17:00',durationMinutes:0,durationLabel:'無制限'
  })});
 });
 await page.goto(BASE+'?view=timeguide',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#tgDay')).toContainText('11月10日 の営業');
 await expect(page.locator('#tgStatus')).toContainText('本日は休館日です。');
 await expect(page.locator('#tgEntry')).toBeDisabled();
 await expect(page.locator('#tgResult')).toContainText('休館日');
 await expect(page.locator('#tgClose')).toHaveText('—');
 expect(requested).toContain('2026-11-10');
 expect(requested).not.toContain('2026-11-11');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('2026-11-10 timeguide uses today after reservation rollover, without future-date leakage',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T10:15:00.000Z'});
 const requested=[];
 await page.route(GATEWAY+'**',route=>{
  const u=new URL(route.request().url()),action=u.searchParams.get('action');
  if(action!=='businessDay')return route.fallback();
  const date=u.searchParams.get('date');requested.push(date);
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,operationalDate:date,calendarDate:date,
   businessType:'土日祝日',isClosed:false,closingTime:'18:00',durationMinutes:150,durationLabel:'2時間30分'
  })});
 });
 await page.goto(BASE+'?view=timeguide',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#tgDay')).toContainText('10月3日 の営業');
 await expect(page.locator('#tgEntry')).toBeEnabled();
 await expect(page.locator('#tgStatus')).toContainText('本日の利用時間を確認しました');
 await expect(page.locator('#tgDuration')).toHaveText('2時間30分');
 expect(requested).toContain('2026-10-03');
 expect(requested).not.toContain('2026-10-04');
});


test('2026-11-10 verified same-day crowd archive stays readable after 19:00 without booking links',async({page})=>{
 await installProduction(page,{clockIso:'2026-10-03T10:10:00.000Z'});
 await page.addInitScript(()=>localStorage.setItem('asoboon_v2_last_verified_crowd_day_v1',JSON.stringify({
  date:'2026-10-03',businessType:'土日祝日',savedAt:Date.now()-20*60000,
  publicFlags:[['0029',true],['0031',true],['0033',true],['0030',true],['0032',true],['0034',true]],
  slots:['0030','0032','0034'].map((waitTypeId,i)=>({
   waitTypeId,slotKey:['10:00','12:30','15:00'][i],
   reserveUnit:'PERSON',matchMode:'exact-name',evidence:'PERSON',remaining:100
  })),
  details:['10時25分頃入場【土休日特定日】','12時50分頃入場【土休日特定日】','15時15分頃入場時間【土休日特定日】'].map(detailedWaitType=>({
   detailedWaitType,reserveUnit:'PERSON',remaining:50,remainingVerified:true
  }))
 })));
 await page.route(GATEWAY+'**',route=>{
  const u=new URL(route.request().url()),action=u.searchParams.get('action');
  if(action==='businessDay'){
   const date=u.searchParams.get('date'),closed=date!=='2026-10-03';
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,operationalDate:date,calendarDate:date,
    businessType:closed?'休館日':'土日祝日',isClosed:closed,closingTime:closed?'00:00':'18:00',durationLabel:'2時間30分'
   })});
  }
  if(action==='crowdRemaining')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'ROLLOVER_NO_TODAY_LIVE_DATA'})});
  if(action==='waitTypes')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,waitTypes:Array.from({length:50},(_,i)=>({waitTypeId:String(i+1).padStart(4,'0'),dispFlg:true}))
  })});
  return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const card=page.locator('#v38Slots');
 await expect(card.locator('.v38-crowd-card')).toHaveCount(3);
 await expect(card.locator('.v38-crowd-list .v38-crowd-channel--web strong')).toHaveText(['100人','100人','100人']);
 await expect(card.locator('.v38-crowd-list .v38-crowd-channel--onsite strong')).toHaveText(['50人','50人','50人']);
 await expect(card.locator('#v613Board .v613-percent')).not.toHaveText(['—','—','—']);
 await expect(card.locator('a[href], [data-v7-view="reception"]')).toHaveCount(0);
 await expect(card.locator('#v38CrowdAge')).toContainText('最終更新');
 for(const width of [320,390,768]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)}
});


// Prevent short Japanese fragments ('す。', 'い。', etc.) orphaned at line ends.
test('2026-11-11 mobile calendar shortcuts and HOME help never break a title mid-word',async({page})=>{
 await installProduction(page);
 const site=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{configurable:true,get(){return this.__qaEnv},set(value){
   this.__qaEnv=Object.freeze({...value,assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'});
  }});
 },site);
 await page.goto(site+'home.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v38-first-shortcut .v38-guide-card')).toBeVisible();
 const cards=page.locator('.v59-calendar-links .v38-calendar-card');
 await expect(cards).toHaveCount(2);
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  const data=await page.waitForFunction(()=>{
   const links=[...document.querySelectorAll('.v59-calendar-links .v38-calendar-card')];
   // The production HOME disclosure layer can reparent calendars between
   // animation frames. Do not measure in the temporary empty DOM state.
   if(links.length!==2||links.some(e=>!e.isConnected||!e.querySelector('strong')))return false;
   const first=links[0].getBoundingClientRect(),second=links[1].getBoundingClientRect();
   const title=links.map(e=>{
    const x=e.querySelector('strong'),r=x.getBoundingClientRect();
    return {text:x.textContent,oneLine:r.height<=parseFloat(getComputedStyle(x).lineHeight)*1.1};
   });
   return {oneColumn:second.top>=first.bottom-2,links:title,overflow:document.documentElement.scrollWidth-innerWidth};
  },null,{timeout:10000}).then(handle=>handle.jsonValue());
  expect(data.oneColumn,'calendar must not crush Japanese into 60px column').toBe(true);
  expect(data.links.every(x=>x.oneLine),JSON.stringify(data.links)).toBe(true);
  expect(data.overflow).toBeLessThanOrEqual(1);
 }
 await expect(page.locator('.v38-legal')).toContainText('個人情報保護方針');
});
test('2026-11-11 mobile copy has no isolated 1–2 kana lines in key guidance',async({page})=>{
 await installProduction(page);
 const views=[
  ['parking',['.v24-parking-page .pv7-head p','.v24-free small','.v24-select-hint']],
  ['first',['.v27-first-head p','.v27-step.called .v27-step-copy p']],
  ['entry',['.v25-entry-page .entry-choice--adult .entry-choice-sub']],
  ['faq',['.cm-hub-head p']],
  ['rules',['.pv7-head p']],
  ['timeguide',['#tgStatus']]
 ];
 for(const [view,selectors] of views){
  await page.goto(BASE+'?view='+view,{waitUntil:'domcontentloaded'});
  for(const width of [320,375,390]){
   await page.setViewportSize({width,height:844});
   for(const selector of selectors){
    const el=page.locator(selector).first();
    await expect(el,'missing '+view+' '+selector).toBeVisible();
    const rows=await el.evaluate(element=>{
     const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),m=new Map();let node;
     while(node=walker.nextNode())for(let i=0;i<node.textContent.length;i++){
      const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);
      const r=range.getBoundingClientRect();if(r.height>2&&r.width>.1){
       const top=Math.round(r.top),text=m.get(top)||'';
       m.set(top,text+node.textContent[i]);
      }
     }
     return [...m.values()].map(s=>s.trim()).filter(Boolean);
    });
    expect(rows.length,'no rendered copy '+selector).toBeGreaterThan(0);
    const last=rows[rows.length-1].replace(/[。、！？\s]/g,'');
    expect(last.length,'orphan '+view+' '+selector+': '+JSON.stringify(rows)).toBeGreaterThanOrEqual(3);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),'overflow '+view+' '+width).toBeLessThanOrEqual(1);
  }
 }
});


test('2026-11-11 narrow mobile screens avoid isolated 1–2 character line endings',async({page})=>{
 test.setTimeout(120000);
 await installProduction(page);
 const origin=new URL('../../',BASE).href;
 const selectors={
  home:'.v38-first-shortcut .v38-guide-card strong,.v38-calendar-card strong',
  reception:'.rec-remaining-caution,.v26-person-label strong,.v26-person-label small',
  first:'.v27-first-page h1,.v27-step-copy p,.v27-basic strong',
  parking:'.v24-section-head p,.v24-alert p,.v24-alert strong,.v24-facts strong,.v24-choice strong,.v24-safety p',
  faq:'.cm-hub-head p,.cm-faq details p,.cm-faq details summary',
  rules:'.pv7-page h1,.pv7-promise small'
 };
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  for(const [view,selector] of Object.entries(selectors)){
   await page.goto(view==='home'?origin+'home.html':BASE+'?view='+view,{waitUntil:'domcontentloaded'});
   const content=view==='home'?'.v38-home':view==='reception'?'.rec-people':view==='first'?'.v27-first-page':view==='parking'?'.v24-parking-page':view==='faq'?'.cm-faq':'.pv7-page';
   await expect(page.locator(content).first()).toBeVisible();
   if(view==='home')await page.locator('details').evaluateAll(xs=>xs.forEach(x=>x.open=true));
   if(view==='faq')await page.locator('.cm-faq details').evaluateAll(xs=>xs.forEach(x=>x.open=true));
   if(view==='parking'){
    await page.locator('[data-v24-route="v24-general"]').click();
    await page.locator('#v24-general details').evaluateAll(xs=>xs.forEach(x=>x.open=true));
   }
   const orphans=await page.evaluate(sel=>{
    const found=[];let checked=0;
    for(const el of document.querySelectorAll(sel)){
     const bounds=el.getBoundingClientRect(),style=getComputedStyle(el);
     if(bounds.width<6||bounds.height<6||style.visibility==='hidden'||style.display==='none'||el.closest('[hidden],[aria-hidden="true"]'))continue;
     checked++;
     const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),lines=new Map();let node;
     while((node=walker.nextNode())){
      for(let i=0;i<node.textContent.length;i++){
       const ch=node.textContent[i];if(ch==='\\n')continue;
       const r=document.createRange();r.setStart(node,i);r.setEnd(node,i+1);
       const rect=r.getBoundingClientRect();if(rect.height<2||rect.width<0.3)continue;
       const y=Math.round(rect.top);lines.set(y,(lines.get(y)||'')+ch);
      }
     }
     const rows=[...lines].sort((a,b)=>a[0]-b[0]).map(x=>x[1].replace(/\\s+/g,' ').trim()).filter(Boolean);
     if(rows.length<2)continue;
     const orphan=rows.at(-1).replace(/[。？！、．・\\s（）「」:,.→↗]/g,'');
     if(orphan.length<=2)found.push({text:el.textContent.replace(/\\s+/g,' ').slice(0,90),rows:rows.slice(-3)});
    }
    return {checked,found};
   },selector);
   expect(orphans.checked,'no matching content '+view+' '+width).toBeGreaterThan(0);
   expect(orphans.found,view+' '+width+': '+JSON.stringify(orphans.found)).toEqual([]);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  }
 }
});


for(const [businessType,durationLabel,expected,closingTime] of [
  ['平日','時間制限なし','時間制限なし','17:00'],
  ['平日','無制限','時間制限なし','17:00'],
  ['平日特定日','3時間','3時間制','17:00'],
  ['土日祝日','2時間30分','2時間30分制','18:00']
]){
 test('2026-11-11 HOME duration never doubles 制: '+businessType+' '+durationLabel,async({page})=>{
  await installProduction(page,{clockIso:'2026-11-11T03:00:00.000Z'});
  await page.route(GATEWAY+'**',async route=>{
   const u=new URL(route.request().url()),action=u.searchParams.get('action');
   if(action!=='businessDay')return route.fallback();
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     ok:true,calendarDate:'2026-11-11',operationalDate:'2026-11-11',
     businessType,isClosed:false,durationLabel,closingTime
   })});
  });
  await page.goto(new URL('../../home.html',BASE).href,{waitUntil:'domcontentloaded'});
  const duration=page.locator('#v38Today>span:nth-child(3) strong');
  await expect(duration).toHaveText(expected,{timeout:15000});
  await expect(duration).not.toContainText('なし制');
  if(durationLabel==='時間制限なし'){
   await page.locator('#asoboon-language-select').selectOption('en');
   await expect(duration).toHaveText('No time limit');
   await page.locator('#asoboon-language-select').selectOption('ja');
   await expect(duration).toHaveText('時間制限なし');
  }
 });
}


test('2026-11-11 HOME has only the requested three shortcuts, timer, and no redundant call-status loader',async({page})=>{
 await installProduction(page);
 const site=new URL('../../',BASE).href;
 await page.addInitScript(site=>{Object.defineProperty(window,'ASOBOON_V2_ENV',{
   configurable:true,get(){return this.__testEnv},
   set(value){this.__testEnv=Object.freeze({...value,assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'})}
 })},site);
 await page.goto(site+'home.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v38-first-shortcut .v38-guide-card')).toHaveCount(1);
 await expect(page.locator('.v59-calendar-links .v38-calendar-card')).toHaveCount(2);
 await expect(page.locator('#v38TimeguideShortcut')).toBeVisible();
 await expect(page.locator('.v38-guide,.v38-play,.v38-help,#v59GuideFold,#v59PlayFold')).toHaveCount(0);
 await expect(page.locator('.cm-bottom-nav [data-v7-view="guide"]')).toBeVisible();
 await expect(page.locator('.cm-bottom-nav [data-v7-view="play"]')).toBeVisible();
 await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toBeVisible();
 await expect(page.locator('.v38-home')).not.toContainText('呼出状況を確認中');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{
  detail:{kind:'pending',receipt:'W123',source:'live',checkedAt:Date.now()}
 })));
 await expect(page.locator('.v38-home')).not.toContainText('呼出状況を確認中');
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
});

for(const scenario of [
 {label:'available',webRemaining:42,visible:true,stale:false,expected:true},
 {label:'zero',webRemaining:0,visible:true,stale:false,expected:false},
 {label:'unverified',webRemaining:42,visible:true,stale:false,matchMode:'alias-name',expected:false},
 {label:'hidden',webRemaining:42,visible:false,stale:false,expected:false},
 {label:'stale',webRemaining:42,visible:true,stale:true,expected:false},
]){
 test('2026-11-11 WEB 7:00 link only for fresh published positive count: '+scenario.label,async({page})=>{
  await installProduction(page);
  await page.route(GATEWAY+'**',async route=>{
   const action=new URL(route.request().url()).searchParams.get('action');
   if(action==='crowdRemaining'){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     ok:true,stale:scenario.stale,slots:['0030','0032','0034'].map((id,i)=>({
      waitTypeId:id,slotKey:['10:00','12:30','15:00'][i],reserveUnit:'PERSON',
      evidence:'PERSON',matchMode:scenario.matchMode||'exact-name',remaining:scenario.webRemaining
     })),
     observedDetails:[
      {detailedWaitType:'10時25分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:18,remainingVerified:true},
      {detailedWaitType:'12時50分頃入場【土休日特定日】',reserveUnit:'PERSON',remaining:18,remainingVerified:true},
      {detailedWaitType:'15時15分頃入場時間【土休日特定日】',reserveUnit:'PERSON',remaining:18,remainingVerified:true}
     ]
    })});
   }
   if(action==='waitTypes'){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,waitTypes:[
     ...['0029','0031','0033'].map(id=>({waitTypeId:id,waitTypeName:'LINE '+id,dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'})),
     ...['0030','0032','0034'].map(id=>({waitTypeId:id,waitTypeName:'WEB '+id,dispFlg:scenario.visible,usageDispType:'KeyONLINE_RECEPTION_ONLY'}))
    ]})});
   }
   return route.fallback();
  });
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#v613Board .v613-row')).toHaveCount(3);
  const hours=page.locator('#v38Hero .v38-reception-hours');
  await expect(hours).toBeVisible();
  await expect(hours).toContainText('LINEミニアプリ');
  if(scenario.expected){
   await expect(hours).toContainText('WEB受付');
   await expect(hours).toContainText('7:00');
   await expect(hours.locator('a.v38-airwait-link')).toBeVisible();
   await expect(page.locator('#v38Slots .v38-opening-hours')).toContainText('7:00');
   await expect(page.locator('#v613Board a.v38-crowd-channel--web')).toHaveCount(3);
  }else{
   await expect(hours).not.toContainText('7:00');
   await expect(hours.locator('a.v38-airwait-link')).toHaveCount(0);
   await expect(page.locator('#v38Slots .v38-opening-hours')).not.toContainText('7:00');
   await expect(page.locator('#v613Board a.v38-crowd-channel--web')).toHaveCount(0);
  }
 });
}

test('2026-11-11 first-visit and indoor rules explicitly show all safety, food and drink restrictions',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('.v38-first-shortcut [data-v7-view="first"]').click();
 await expect(page.locator('.v27-safety li')).toHaveCount(3);
 await expect(page.locator('.v27-safety')).toContainText('目を離さない');
 await expect(page.locator('.v27-safety')).toContainText('食べ物は一切禁止');
 await expect(page.locator('.v27-safety')).toContainText('アメ・ガム・お菓子');
 await expect(page.locator('.v27-safety')).toContainText('飲み物は土足エリアのみ');
 await page.locator('.cm-nav-tab[data-v7-view="guide"]').click();
 await page.locator('.cm-hub-list [data-v7-view="rules"]').click();
 await expect(page.locator('.pv7-food-rules')).toContainText('アメ・ガム・お菓子');
 await expect(page.locator('.pv7-food-rules')).toContainText('食べ物は一切禁止');
 await expect(page.locator('.pv7-food-rules')).toContainText('飲み物は土足エリアでのみ');
 await expect(page.locator('.pv7-promise')).toHaveCount(4);
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
});


test('2026-11-11 deleted AirWAIT session disappears from HOME and retains remaining sessions',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action!=='waitTypes')return route.fallback();
  // The 12:30 WEB + LINE categories have been deleted from AirWAIT.
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,waitTypes:['0029','0033','0030','0034'].map(waitTypeId=>({
    waitTypeId,dispFlg:true,usageDispType:['0030','0034'].includes(waitTypeId)?'KeyONLINE_RECEPTION_ONLY':'KeySTORE_RECEPTION_ONLY'
   }))
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const slots=page.locator('#v38Slots .v38-crowd-card');
 await expect(slots).toHaveCount(2);
 await expect(slots.first()).toContainText('10:00');
 await expect(slots.last()).toContainText('15:00');
 await expect(page.locator('#v613Board .v613-row')).toHaveCount(2);
 await expect(page.locator('#v38Slots')).not.toContainText('12:30回');
 await expect(page.locator('#v38Slots')).not.toContainText('最新情報を取得できません');
 await expect(page.locator('#v38Slots .v38-crowd-remaining')).toHaveCount(2);
});

test('2026-11-11 confirmed retired WEB channel shows no reception instead of a fetch error',async({page})=>{
 await installProduction(page);
 await page.route(GATEWAY+'**',route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action!=='waitTypes')return route.fallback();
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,waitTypes:['0029','0031','0033','0030','0034'].map(waitTypeId=>({
    waitTypeId,dispFlg:true,usageDispType:['0030','0034'].includes(waitTypeId)?'KeyONLINE_RECEPTION_ONLY':'KeySTORE_RECEPTION_ONLY'
   }))
  })});
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v38Slots .v38-crowd-card')).toHaveCount(3);
 const middle=page.locator('#v38Slots .v38-crowd-card').filter({hasText:'12:30回'});
 await expect(middle.locator('.v38-crowd-channel--web')).toContainText('受付なし');
 await expect(middle.locator('a.v38-crowd-channel--web')).toHaveCount(0);
 await expect(middle.locator('.v38-crowd-channel--onsite')).toContainText('44人');
});

test('2026-11-11 guide-complete becomes waiting again and customer cancel action works',async({page})=>{
 await installProduction(page);
 let state='done',cancelRequests=0;
 await page.route(GATEWAY+'**',route=>{
  const body=new URLSearchParams(route.request().postData()||'');
  const action=body.get('action')||new URL(route.request().url()).searchParams.get('action');
  const json=obj=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(obj)});
  if(action==='reservationStatus')return json({
   ok:true,found:true,state,receiptNo:'R321',businessDate:'2026-10-03',
   waitTypeId:'0031',waitTypeName:'12:30の回',aheadCount:state==='waiting'?2:null,
   queueRank:state==='waiting'?3:null,activeCount:state==='waiting'?21:0,
   checkedAt:Date.parse('2026-10-03T03:00:00Z')
  });
  if(action==='cancelReservation'){
   cancelRequests++;
   state='canceled';
   return json({ok:true,canceled:true,receiptNo:'R321',businessDate:'2026-10-03',
     waitTypeId:'0031',checkedAt:Date.parse('2026-10-03T03:00:00Z')});
  }
  return route.fallback();
 });
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
   businessDate:'2026-10-03',receiptNo:'R321',waitTypeId:'0031'
  }));
  localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
   businessDate:'2026-10-03',receiptNo:'R321',waitTypeId:'0031',
   sessionToken:'k'.repeat(40),expiresAt:4102444800000
  }));
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#csTitle')).toContainText('ご案内済み');
 await expect(page.locator('#csCancelArea')).toBeHidden();
 await expect(page.locator('#csHeartbeatLabel')).toContainText('次の再確認まで');
 // A staff member returns the already guided ticket to the waiting queue.
 state='waiting';
 await page.locator('#csRefresh').click();
 await expect(page.locator('#csTitle')).toContainText('順番をお待ち');
 await expect(page.locator('#csCancelArea')).toBeVisible();
 await expect(page.locator('#csCancel')).toBeEnabled();
 await page.locator('#csCancel').click();
 await expect(page.locator('#csCancelDialog')).toBeVisible();
 await expect(page.locator('#csCancelReceipt')).toHaveText('R321');
 await page.locator('#csCancelProceed').click();
 await expect.poll(()=>cancelRequests).toBe(1);
 await expect(page.locator('#csTitle')).toContainText('取消');
 await expect(page.locator('#csCancelArea')).toBeHidden();
});


test('2026-11-11 confirmed guest cancellation stops polling after reopening and resumes only for a new receipt',async({page})=>{
 await installProduction(page);
 let polls=0,cancels=0;
 await page.route(GATEWAY+'**',async route=>{
  const data=new URLSearchParams(route.request().postData()||'');
  const action=data.get('action')||new URL(route.request().url()).searchParams.get('action');
  const json=obj=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(obj)});
  if(action==='reservationStatus'){
   polls++;
   const token=String(data.get('sessionToken')||'');
   return json({ok:true,found:true,state:'waiting',receiptNo:token.startsWith('n')?'R999':'R321',
    businessDate:'2026-10-03',waitTypeId:'0031',waitTypeName:'12:30の回',
    aheadCount:2,queueRank:3,activeCount:20,checkedAt:Date.now()});
  }
  if(action==='cancelReservation'){
   cancels++;
   return json({ok:true,canceled:true,found:true,state:'canceled',receiptNo:'R321',
    businessDate:'2026-10-03',waitTypeId:'0031',checkedAt:Date.now()});
  }
  return route.fallback();
 });
 await page.addInitScript(()=>{
  const key='asoboon_v2_current_reservation_production_v1';
  const sk='asoboon_v2_callstatus_session_production_v1';
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({
   receiptNo:'R321',businessDate:'2026-10-03',waitTypeId:'0031',cachedAt:Date.now()-30000
  }));
  if(!localStorage.getItem(sk))localStorage.setItem(sk,JSON.stringify({
   receiptNo:'R321',businessDate:'2026-10-03',waitTypeId:'0031',
   sessionToken:'k'.repeat(40),expiresAt:4102444800000
  }));
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#csTitle')).toContainText('順番をお待ち');
 await expect(page.locator('#csCancelArea')).toBeVisible();
 await page.locator('#csCancel').click();
 await page.locator('#csCancelProceed').click();
 await expect.poll(()=>cancels).toBe(1);
 await expect(page.locator('#csTitle')).toContainText('取消済み');
 await expect(page.locator('#csCancelArea')).toBeHidden();
 await expect(page.locator('#csHeartbeatLabel')).not.toContainText('次の再確認');
 const afterCancel=polls;
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#csTitle')).toContainText('取消済み');
 await expect(page.locator('#csRebookArea')).toBeVisible();
 await page.locator('#csRefresh').click();
 await page.waitForTimeout(350);
 expect(polls).toBe(afterCancel);
 await page.locator('.cm-nav-tab[data-v7-view="home"]').click();
 await page.waitForTimeout(350);
 expect(polls).toBe(afterCancel);
 await page.evaluate(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
   receiptNo:'R999',businessDate:'2026-10-03',waitTypeId:'0031',cachedAt:Date.now()+5000
  }));
  localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
   receiptNo:'R999',businessDate:'2026-10-03',waitTypeId:'0031',
   sessionToken:'n'.repeat(40),expiresAt:4102444800000
  }));
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#csReceipt')).toHaveText('R999');
 await expect(page.locator('#csTitle')).toContainText('順番をお待ち');
 await expect.poll(()=>polls).toBeGreaterThan(afterCancel);
});

test('2026-11-11 AirWAIT-confirmed canceled state stays terminal across HOME and CALL tabs',async({page})=>{
 await installProduction(page);
 let polls=0;
 await page.route(GATEWAY+'**',route=>{
  const data=new URLSearchParams(route.request().postData()||'');
  const action=data.get('action')||new URL(route.request().url()).searchParams.get('action');
  if(action==='reservationStatus'){
   polls++;
   return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,found:true,state:'canceled',receiptNo:'R456',
     businessDate:'2026-10-03',waitTypeId:'0031',checkedAt:Date.now()})});
  }
  return route.fallback();
 });
 await page.addInitScript(()=>{
  const k='asoboon_v2_current_reservation_production_v1';
  const s='asoboon_v2_callstatus_session_production_v1';
  if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify({
   receiptNo:'R456',businessDate:'2026-10-03',waitTypeId:'0031'
  }));
  if(!localStorage.getItem(s))localStorage.setItem(s,JSON.stringify({
   receiptNo:'R456',businessDate:'2026-10-03',waitTypeId:'0031',
   sessionToken:'x'.repeat(40),expiresAt:4102444800000
  }));
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#csTitle')).toContainText('取消済み');
 const count=polls;
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#csTitle')).toContainText('取消済み');
 await page.locator('.cm-nav-tab[data-v7-view="home"]').click();
 await expect(page.locator('#v38Hero')).toContainText('もう一度受付する');
 await page.waitForTimeout(250);
 await page.locator('.cm-nav-tab[data-v7-view="callstatus"]').click();
 await expect(page.locator('#csTitle')).toContainText('取消済み');
 expect(polls).toBe(count);
});

test('2026-11-11 verified missing receipt pauses polling and keeps manual retry without labeling canceled',async({page})=>{
 await installProduction(page);
 let calls=0;
 await page.route(GATEWAY+'**',route=>{
  const data=new URLSearchParams(route.request().postData()||'');
  const action=data.get('action')||new URL(route.request().url()).searchParams.get('action');
  if(action==='reservationStatus'){
   calls++;
   return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,found:false,receiptNo:'R654',
     businessDate:'2026-10-03',waitTypeId:'0031',checkedAt:Date.now()})});
  }
  return route.fallback();
 });
 await page.addInitScript(()=>{
  const realTimeout=window.setTimeout.bind(window);
  window.setTimeout=(callback,delay,...args)=>
   realTimeout(callback,delay>=5500&&delay<=7200?70:delay,...args);
  const k='asoboon_v2_current_reservation_production_v1';
  const s='asoboon_v2_callstatus_session_production_v1';
  if(!localStorage.getItem(k))localStorage.setItem(k,JSON.stringify({
   receiptNo:'R654',businessDate:'2026-10-03',waitTypeId:'0031'
  }));
  if(!localStorage.getItem(s))localStorage.setItem(s,JSON.stringify({
   receiptNo:'R654',businessDate:'2026-10-03',waitTypeId:'0031',
   sessionToken:'y'.repeat(40),expiresAt:4102444800000
  }));
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 await expect.poll(()=>calls,{timeout:12000}).toBe(3);
 await expect(page.locator('#csMessage')).toContainText('自動確認を停止');
 await expect(page.locator('#csTitle')).not.toContainText('取消済み');
 await page.waitForTimeout(500);
 expect(calls).toBe(3);
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#csTitle')).toContainText('この受付番号を確認できません');
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await page.waitForTimeout(300);
 expect(calls).toBe(3);
 await page.locator('#csRefresh').click();
 await expect.poll(()=>calls).toBeGreaterThan(3);
});

for(const width of [320,390,430]){
 test('2026-11-11 cocoa-chip chocolate header and footer stay visible at '+width+'px',async({page})=>{
  await installProduction(page);
  await page.setViewportSize({width,height:844});
  await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await expect(page.locator('html.boon-v4.boon-v5-mint')).toHaveCount(1);
  await expect(page.locator('.cm-bottom-nav .cm-nav-tab')).toHaveCount(4);
  const css=await page.evaluate(()=>{
   const header=getComputedStyle(document.querySelector('#app .topbar'));
   const nav=getComputedStyle(document.querySelector('#app>.cm-bottom-nav'));
   const current=document.querySelector('#app>.cm-bottom-nav .cm-nav-tab.is-current');
   return {header:header.backgroundImage,footer:nav.backgroundImage,
    tab:getComputedStyle(current).backgroundImage,
    tabHeight:current.getBoundingClientRect().height,
    overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(css.header).toContain('radial-gradient');
  expect(css.header).toContain('linear-gradient');
  expect(css.footer).toContain('radial-gradient');
  expect(css.footer).toContain('linear-gradient');
  expect(css.tab==='none'||css.tab.includes('linear-gradient')).toBe(true);
  expect(css.tabHeight).toBeGreaterThanOrEqual(44);
  expect(css.overflow).toBeLessThanOrEqual(1);
  await page.locator('.cm-bottom-nav [data-v7-view="guide"]').click();
  await expect(page.locator('.cm-hub h1')).toHaveText('ご利用案内');
 });
}


test('2026-11-11 HOME does not resurrect a canceled receipt as pending, but accepts a new ticket',async({page})=>{
 await installProduction(page);
 let lookups=0;
 await page.route(GATEWAY+'**',route=>{
  const a=new URLSearchParams(route.request().postData()||'').get('action');
  if(['reservationStatus','recoverReservationSession'].includes(a))lookups++;
  return route.fallback();
 });
 await page.addInitScript(()=>{window.__homeStatusKinds=[];window.addEventListener('asoboon:v8-home-status',e=>window.__homeStatusKinds.push(String(e.detail?.kind||'')))});
 await page.addInitScript(()=>{
  const now=Date.now();
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
   receiptNo:'R333',businessDate:'2026-10-03',waitTypeId:'0031',cachedAt:now-5000
  }));
  localStorage.setItem('asoboon_v2_callstatus_canceled_production_v1',JSON.stringify({
   receiptNo:'R333',businessDate:'2026-10-03',savedAt:now,checkedAt:now
  }));
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await expect.poll(()=>page.evaluate(()=>window.ASOBOON_HOME_STATUS_SNAPSHOT?.kind)).toBe('canceled');
 await expect.poll(()=>page.evaluate(()=>window.ASOBOON_HOME_STATUS_SNAPSHOT?.receipt)).toBe('R333');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect(page.locator('#v38Hero')).toContainText('もう一度受付する');
 const terminalEvents=await page.evaluate(()=>window.__homeStatusKinds);
 const canceledIndex=terminalEvents.lastIndexOf('canceled');
 expect(canceledIndex).toBeGreaterThanOrEqual(0);
 expect(terminalEvents.slice(canceledIndex+1)).not.toContain('pending');
 await expect.poll(()=>page.evaluate(()=>window.ASOBOON_HOME_STATUS_SNAPSHOT?.kind)).toBe('canceled');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForTimeout(250);
 expect(lookups).toBe(0);
 await page.evaluate(()=>{
  const replacement={receiptNo:'R998',businessDate:'2026-10-03',waitTypeId:'0031',cachedAt:Date.now()+2000};
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify(replacement));
  window.dispatchEvent(new CustomEvent('asoboon:v2-reservation-saved',{detail:replacement}));
 });
 await expect.poll(()=>page.evaluate(()=>window.ASOBOON_HOME_STATUS_SNAPSHOT?.receipt)).toBe('R998');
 await expect.poll(()=>page.evaluate(()=>window.ASOBOON_HOME_STATUS_SNAPSHOT?.kind)).toBe('pending');
});


test('2026-11-12 HOME shows a direct rebook action only after a live verified terminal receipt',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#v38Hero').waitFor();
 await page.evaluate(()=>{
   const date=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
   const receipt='R321';
   localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      receiptNo:receipt,businessDate:date,waitTypeId:'0031',
      reserveId:'000000123456',cachedAt:Date.now()-30000
   }));
   window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:{
      kind:'waiting',receipt,source:'live',checkedAt:Date.now()
   }}));
 });
 await expect(page.locator('#v38Hero')).toHaveClass(/call-link/);
 await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toHaveCount(0);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:{
   kind:'guided',receipt:'R321',source:'live',checkedAt:Date.now()
 }})));
 await expect(page.locator('#v38Hero')).toHaveClass(/rebook/);
 await expect(page.locator('#v38Hero')).toContainText('前の受付は終了しています');
 const cta=page.locator('#v38Hero [data-v7-view="reception"]');
 await expect(cta).toContainText('もう一度受付する');
 for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});
   const size=await cta.boundingBox();
   expect(size.height).toBeGreaterThanOrEqual(44);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
 await cta.click();
 await expect(page).toHaveURL(/view=reception/);
});

test('2026-11-12 HOME does not advertise a second booking on pending, missing, or unknown status',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
   const date=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
   localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
      receiptNo:'R777',businessDate:date,waitTypeId:'0031',
      reserveId:'000000777777',cachedAt:Date.now()-1000
   }));
   window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:{
     kind:'pending',receipt:'R777',source:'local',checkedAt:Date.now()
   }}));
 });
 await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toHaveCount(0);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:{
   kind:'canceled',receipt:'R777',source:'local',checkedAt:Date.now()
 }})));
 await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toHaveCount(0);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:{
   kind:'error',receipt:'R777',source:'live',checkedAt:Date.now()
 }})));
 await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toHaveCount(0);
});


test('2026-11-12 real CALL gateway done observation reaches HOME and staff restored waiting revokes direct rebooking',async({page})=>{
 await installProduction(page);
 let currentState='done';
 let checks=0;
 await page.route(GATEWAY+'**',async route=>{
  const form=new URLSearchParams(route.request().postData()||'');
  const action=form.get('action')||new URL(route.request().url()).searchParams.get('action');
  if(action!=='reservationStatus')return route.fallback();
  checks++;
  return route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({ok:true,found:true,state:currentState,receiptNo:'R888',
    businessDate:'2026-10-03',waitTypeId:'0031',reserveId:'000000000888',
    checkedAt:Date.now(),aheadCount:1,queueRank:2,activeCount:10})});
 });
 await page.addInitScript(()=>{
  localStorage.setItem('asoboon_v2_current_reservation_production_v1',JSON.stringify({
   receiptNo:'R888',businessDate:'2026-10-03',waitTypeId:'0031',reserveId:'000000000888',
   cachedAt:Date.now()-45000
  }));
  localStorage.setItem('asoboon_v2_callstatus_session_production_v1',JSON.stringify({
   receiptNo:'R888',businessDate:'2026-10-03',waitTypeId:'0031',reserveId:'000000000888',
   sessionToken:'x'.repeat(40),expiresAt:4102444800000
  }));
 });
 await page.goto(BASE+'?view=callstatus',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#csTitle')).toContainText('ご案内');
 await expect.poll(()=>page.evaluate(()=>window.ASOBOON_HOME_STATUS_SNAPSHOT?.kind)).toBe('guided');
 await page.locator('.cm-nav-tab[data-v7-view="home"]').click();
 await expect(page.locator('#v38Hero')).toHaveClass(/rebook/);
 await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toContainText('もう一度受付する');
 await page.locator('.cm-nav-tab[data-v7-view="callstatus"]').click();
 currentState='waiting'; // Real-life staff action reverting already-guided guest
 await page.locator('#csRefresh').click();
 await expect(page.locator('#csTitle')).toContainText('順番をお待ち');
 await expect.poll(()=>page.evaluate(()=>window.ASOBOON_HOME_STATUS_SNAPSHOT?.kind)).toBe('waiting');
 await page.locator('.cm-nav-tab[data-v7-view="home"]').click();
 await expect(page.locator('#v38Hero')).toHaveClass(/call-link/);
 await expect(page.locator('#v38Hero [data-v7-view="reception"]')).toHaveCount(0);
 expect(checks).toBeGreaterThanOrEqual(2);
});


test('2026-11-12 HOME access shortcut opens route selector and five parking lots',async({page})=>{
 await installProduction(page);
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const shortcut=page.locator('.v38-access-section [data-v7-view="parking"]');
 await expect(shortcut).toBeVisible();
 await expect(shortcut).toContainText('駐車場・アクセスを見る');
 await shortcut.click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('parking');
 await expect(page.locator('.v24-parking-page')).toBeVisible();
 await expect(page.locator('[data-v24-route="v24-general"]')).toBeVisible();
 await page.locator('[data-v24-route="v24-general"]').click();
 await expect(page.locator('.v24-lot-row')).toHaveCount(5);
 await page.locator('.cm-nav-tab[data-v7-view="home"]').click();
 await expect(shortcut).toBeVisible();
 for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});
   const box=await shortcut.boundingBox();
   expect(box?.height||0).toBeGreaterThanOrEqual(44);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 }
});

test('2026-11-12 crowd forecast returns percentage with retired WEB and verified public LINE only',async({page})=>{
 await installProduction(page,{clockIso:'2026-11-12T03:16:00.000Z'});
 const date='2026-11-12',fetchedAt='2026-11-12T03:15:00.000Z';
 await page.route(GATEWAY+'**',route=>{
   const action=new URL(route.request().url()).searchParams.get('action');
   const json=x=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
   if(action==='businessDay')return json({ok:true,operationalDate:date,calendarDate:date,businessType:'平日',closingTime:'17:00',durationLabel:'時間制限なし'});
   if(action==='crowdRemaining')return json({ok:true,stale:false,fetchedAt,
      slots:[
       {waitTypeId:'0024',waitTypeName:'10時ご入場枠【WEB平日】',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'alias-name',remaining:273},
       {waitTypeId:'0027',waitTypeName:'14時ご入場枠【WEB平日】',slotKey:'14:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'time-key',remaining:50}],
      observedDetails:[
       {detailedWaitType:'すぐ入場受付【平日】',reserveUnit:'PERSON',remaining:273,remainingVerified:true},
       {detailedWaitType:'14時から【平日】',reserveUnit:'PERSON',remaining:50,remainingVerified:true}]
   });
   if(action==='waitTypes')return json({ok:true,waitTypes:[
     {waitTypeId:'0023',dispFlg:true},{waitTypeId:'0025',dispFlg:true},
     {waitTypeId:'0024',dispFlg:false},{waitTypeId:'0027',dispFlg:false}
   ]});
   return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const rows=page.locator('#v613Board .v613-row');
 await expect(rows).toHaveCount(2);
 await expect(rows.locator('.v613-percent')).toHaveText(['15%','84%']);
 await expect(rows.locator('.v38-crowd-channel--web strong')).toHaveText(['受付なし','受付なし']);
 await expect(rows.locator('.v38-crowd-channel--onsite strong')).toContainText(['273人','50人']);
 await expect(page.locator('#v613Board .v613-footnote')).toContainText('非公開枠は加算しません');
 expect(await page.locator('#v613Board a[href]').count()).toBe(0);
});

test('2026-11-12 unknown non-retired WEB quota does not fabricate crowd forecast',async({page})=>{
 await installProduction(page,{clockIso:'2026-11-12T03:16:00.000Z'});
 const date='2026-11-12',fetchedAt='2026-11-12T03:15:00.000Z';
 await page.route(GATEWAY+'**',route=>{
   const action=new URL(route.request().url()).searchParams.get('action');
   const json=x=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(x)});
   if(action==='businessDay')return json({ok:true,operationalDate:date,calendarDate:date,businessType:'平日',closingTime:'17:00',durationLabel:'時間制限なし'});
   if(action==='crowdRemaining')return json({ok:true,stale:false,fetchedAt,
     slots:[
       {waitTypeId:'0024',waitTypeName:'10時ご入場枠【WEB平日】',slotKey:'10:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'alias-name',remaining:273},
       {waitTypeId:'0027',waitTypeName:'14時ご入場枠【WEB平日】',slotKey:'14:00',reserveUnit:'PERSON',evidence:'PERSON',matchMode:'time-key',remaining:50}],
     observedDetails:[
       {detailedWaitType:'すぐ入場受付【平日】',reserveUnit:'PERSON',remaining:273,remainingVerified:true},
       {detailedWaitType:'14時から【平日】',reserveUnit:'PERSON',remaining:50,remainingVerified:true}]
   });
   if(action==='waitTypes')return json({ok:true,waitTypes:[
     {waitTypeId:'0023',dispFlg:true},{waitTypeId:'0025',dispFlg:true},
     {waitTypeId:'0024',dispFlg:true},{waitTypeId:'0027',dispFlg:true}
   ]});
   return route.fallback();
 });
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 const rows=page.locator('#v613Board .v613-row');
 await expect(rows).toHaveCount(2);
 await expect(rows.locator('.v38-crowd-channel--web strong')).toHaveText(['—','—']);
 await expect(rows.locator('.v38-crowd-channel--onsite strong')).toContainText(['273人','50人']);
 await expect(rows.locator('.v613-percent')).toHaveText(['—','—']);
});


test('2026-11-12 chocolate-mint palette stays free of saturated orange across HOME, booking, calling, guide, parking, timer, rules and games',async({page})=>{
 await installProduction(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const views=['home','reception','callstatus','guide','parking','first','entry','rules','timeguide','game','omikuji'];
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});
  for(const view of views){
   await page.goto(BASE+'?view='+view,{waitUntil:'domcontentloaded'});
   await expect(page.locator('.cm-bottom-nav')).toBeVisible();
   if(view==='home')await expect(page.locator('.v38-home')).toBeVisible();
   if(view==='parking')await expect(page.locator('.v24-parking-page')).toBeVisible();
   const scan=await page.evaluate(()=>{
    const bad=[],parse=x=>{
      const m=String(x||'').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      return m?[Number(m[1]),Number(m[2]),Number(m[3])]:null;
    };
    for(const e of document.querySelectorAll('body,body *')){
     if(!e.getBoundingClientRect().width||!e.getBoundingClientRect().height)continue;
     const s=getComputedStyle(e);
     for(const key of ['backgroundColor','borderTopColor','color']){
       const rgb=parse(s[key]);
       if(!rgb)continue;
       const [r,g,b]=rgb;
       if(r>130&&r>g*1.48&&g>b*1.43&&g>48)
        bad.push({tag:e.tagName,cls:String(e.className||'').slice(0,80),key,value:s[key]});
     }
    }
    return {bad:bad.slice(0,9),overflow:document.documentElement.scrollWidth-innerWidth,nav:document.querySelectorAll('.cm-bottom-nav .cm-nav-tab').length};
   });
   expect(scan.bad,view+'@'+width+' found legacy orange').toEqual([]);
   expect(scan.overflow,view+'@'+width+' horizontal overflow').toBeLessThanOrEqual(1);
   expect(scan.nav).toBe(4);
   if(width===390&&['home','reception','callstatus','parking','timeguide','game'].includes(view))
     await page.screenshot({path:'/tmp/boon-mint-'+view+'-390.png',fullPage:false,animations:'disabled'});
  }
 }
 expect(errors).toEqual([]);
});


test('Live visual QA: chocolate opening ribbon and legible guide at four mobile widths', async ({page})=>{
 await installProduction(page);
 const site=new URL('../../',BASE).href;
 await page.addInitScript(site=>{
  Object.defineProperty(window,'ASOBOON_V2_ENV',{configurable:true,get(){return this.__qaEnv;},set(value){
   this.__qaEnv=Object.freeze({...value,assetBase:site+'miniapp-v2/production/',siteBase:site,endpoint:site+'home.html'});
  }});
 },site);
 await page.goto(site+'home.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#v58DayZone')).toBeVisible({timeout:12000});
 for (const width of [320,375,390,430]){
  await page.setViewportSize({width,height:844});
  await expect.poll(async()=>page.evaluate(()=>{
   const e=document.querySelector('#v58DayZone'),label=e?.querySelector('.v58-section-title');
   return {dark:!!e&&getComputedStyle(e).backgroundImage.includes('rgb(37, 28, 26)'),
    legible:!!label&&getComputedStyle(label).color==='rgb(255, 249, 241)',
    overflow:document.documentElement.scrollWidth>innerWidth+1};
  }),{timeout:12000}).toMatchObject({dark:true,legible:true,overflow:false});
 }
 await page.locator('#app>.cm-bottom-nav [data-v7-view="guide"]').click();
 const second=page.locator('.cm-hub-list>.cm-hub-row:nth-child(2)');
 await expect(second).toBeVisible();
 const guide=await second.evaluate(e=>({bg:getComputedStyle(e).backgroundImage,fg:getComputedStyle(e.querySelector('strong')).color}));
 expect(guide.bg).toContain('rgb(57, 40, 36)');
 expect(guide.fg).toBe('rgb(255, 249, 241)');
});

test('Globe Language picker is identifiable to foreign-language visitors at five widths',async({page})=>{
 await installProduction(page);
 const site=new URL('../../',BASE).href;
 for(const entry of [BASE,site+'home.html']){
  await page.goto(entry,{waitUntil:'domcontentloaded'});
  const label=page.locator('#asoboon-language-bar label[for="asoboon-language-select"]');
  const select=page.locator('#asoboon-language-select');
  await expect(label).toBeVisible({timeout:10000});
  await expect(label).toContainText('🌐 Language');
  await expect(select).toBeVisible();
  await expect(select.locator('option')).toHaveCount(7);
  await expect(select.locator('option[value="kmr"]')).toHaveText('Kurmancî / Kurdish (Kurmanji)');
  await expect(select.locator('option[value="ja"]')).toContainText('Japanese');
  for(const width of [320,375,390,430,768]){
   await page.setViewportSize({width,height:844});
   const a=await page.evaluate(()=>{
    const root=document.querySelector('#asoboon-language-bar');
    const lab=root.querySelector('label'),picker=root.querySelector('select');
    const header=document.querySelector('#app .topbar');
    const brand=header?.querySelector('.brand');
    const rect=el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width}};
    return{bar:rect(root),label:rect(lab),picker:rect(picker),brand:brand?rect(brand):null,
     overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   expect(a.label.width).toBeGreaterThan(45);
   expect(a.label.left).toBeGreaterThanOrEqual(a.bar.left-1);
   expect(a.label.right).toBeLessThanOrEqual(a.bar.right+1);
   expect(a.picker.width).toBeGreaterThanOrEqual(105);
   expect(a.picker.left).toBeGreaterThanOrEqual(a.bar.left-1);
   expect(a.picker.right).toBeLessThanOrEqual(a.bar.right+1);
   if(a.brand)expect(a.brand.right+8).toBeLessThanOrEqual(a.picker.left);
   expect(a.overflow).toBe(false);
  }
  await select.selectOption('kmr');
  await expect(page.locator('html')).toHaveAttribute('lang','kmr');
  await expect(page.locator('.cm-bottom-nav [data-v7-view="callstatus"]')).toContainText('Bangkirin');
  await select.selectOption('ja');
 }
});

test('Kurmanji fallback note stays clear of operating hours on narrow HOME',async({page})=>{
 await installProduction(page);
 const site=new URL('../../',BASE).href;
 await page.goto(site+'home.html',{waitUntil:'domcontentloaded'});
 const select=page.locator('#asoboon-language-select');
 const note=page.locator('#asoboon-language-note');
 await expect(page.locator('#v58DayZone')).toBeVisible({timeout:10000});
 await select.selectOption('kmr');
 await expect(note).toBeVisible();
 await expect(page.locator('body')).toHaveClass(/asoboon-language-note-shown/);
 for(const width of [320,375,390,430]){
  await page.setViewportSize({width,height:820});
  await expect.poll(async()=>page.evaluate(()=>{
   const note=document.querySelector('#asoboon-language-note').getBoundingClientRect();
   const day=document.querySelector('#v58DayZone').getBoundingClientRect();
   return note.bottom+5<=day.top&&document.documentElement.scrollWidth<=innerWidth+1;
  })).toBe(true);
 }
 await select.selectOption('ja');
 await expect(note).toBeHidden();
 await expect(page.locator('body')).not.toHaveClass(/asoboon-language-note-shown/);
});

test('Seven-language i18n translates parking and safety routes with Korean and Kurmanji without Nepali leakage',async({page})=>{
 await installProduction(page);
 await page.goto(BASE+'?view=parking',{waitUntil:'domcontentloaded'});
 await expect(page.locator('.v24-parking-page')).toBeVisible({timeout:15000});
 const language=page.locator('#asoboon-language-select');
 await expect(language).toBeVisible();
 await language.selectOption('kmr');
 await expect(page.locator('html')).toHaveAttribute('lang','kmr');
 await expect(page.locator('.v24-parking-page h1')).toHaveText('Hûn ji kîjan alî ve tên?');
 const kurmanji=await page.evaluate(()=>({
  open:window.ASOBOON_I18N.t('LINE当日受付は9:30から'),
  safety:window.ASOBOON_I18N.t('食べ物は一切禁止です。')
 }));
 expect(kurmanji.open).toContain('Qeydkirina LINE');
 expect(kurmanji.open).not.toMatch(/[\u0900-\u097F]/);
 expect(kurmanji.safety).toContain('Xwarin');
 await language.selectOption('ko');
 await expect(page.locator('html')).toHaveAttribute('lang','ko');
 await expect(page.locator('.v24-parking-page h1')).toHaveText('어느 쪽에서 오시나요?');
 const korean=await page.evaluate(()=>window.ASOBOON_I18N.t('LINE当日受付は9:30から'));
 expect(korean).toContain('LINE 당일 접수');
 expect(korean).not.toMatch(/[\u0900-\u097F]/);
 await language.selectOption('ja');
 await expect(page.locator('.v24-parking-page h1')).toHaveText('どちらから来ますか？');
});

test('Live-audited FAQ and safety routes translate question, answer and visitor rules without changing booking',async({page})=>{
 await installProduction(page);
 await page.goto(BASE+'?view=faq',{waitUntil:'domcontentloaded'});
 const pick=page.locator('#asoboon-language-select');
 const entries=page.locator('#cmFaqList details');
 await expect(entries).toHaveCount(16,{timeout:15000});
 await pick.selectOption('kmr');
 await expect(entries.first().locator('summary')).toHaveText('Qeydkirin kengî dest pê dike?');
 await entries.first().locator('summary').click();
 await expect(entries.first().locator('p')).toContainText('Di rojên destûrdayî de');
 await pick.selectOption('ko');
 await expect(entries.first().locator('summary')).toHaveText('접수는 몇 시부터 시작하나요?');
 await pick.selectOption('ja');
 await expect(entries.first().locator('summary')).toHaveText('受付は何時から始まりますか？');
 await page.goto(BASE+'?view=rules',{waitUntil:'domcontentloaded'});
 const h=page.locator('main.view.active h1').first();
 await expect(h).toContainText('安全に遊ぶ');
 await page.locator('#asoboon-language-select').selectOption('kmr');
 await expect(h).toHaveText('Çar rêzik ji bo lîstina ewle');
 await expect(page.locator('main.view.active')).toContainText('Ji lêketinê dûr bisekinin');
 await page.locator('#asoboon-language-select').selectOption('ko');
 await expect(h).toHaveText('안전한 놀이를 위한 4가지 약속');
});

test('Opening and event calendars retain chosen Kurmanji or Korean and disclose partial text safely',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('asoboon_miniapp_locale_v1','kmr'));
 await page.goto(BASE+'business-calendar.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('html')).toHaveAttribute('lang','kmr');
 await expect(page.locator('.bc-header h1')).toHaveText('Salnameya rojên vekirî',{timeout:10000});
 await expect(page.locator('.asoboon-calendar-language-note')).toBeVisible();
 await expect(page.locator('.bc-back')).toContainText('Vegere malperê');
 await page.goto(BASE+'event-calendar.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('html')).toHaveAttribute('lang','kmr');
 await expect(page.locator('.hero h1')).toHaveText('Bûyerên vê mehê');
 await expect(page.locator('.asoboon-calendar-language-note')).toBeVisible();
 await page.evaluate(()=>localStorage.setItem('asoboon_miniapp_locale_v1','ko'));
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('html')).toHaveAttribute('lang','ko');
 await expect(page.locator('.hero h1')).toHaveText('이번 달 이벤트');
 await page.evaluate(()=>localStorage.setItem('asoboon_miniapp_locale_v1','ja'));
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('html')).toHaveAttribute('lang','ja');
 await expect(page.locator('.asoboon-calendar-language-note')).toHaveCount(0);
});
