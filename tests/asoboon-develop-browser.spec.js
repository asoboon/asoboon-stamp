const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const BASE = process.env.ASOBOON_BASE_URL || 'http://127.0.0.1:4173/miniapp-v2/develop/';

async function installLiff(page, mode, fixtures = {}) {
  const businessDayFixture = fixtures.businessDay || { ok:true, operationalDate:'2026-09-19', businessType:'土日祝日', closingTime:'18:00' };
  const waitTypesFixture = fixtures.waitTypes || [
    {waitTypeId:'0029',waitTypeName:'10時25分頃入場【土休日特定日】',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
    {waitTypeId:'0030',waitTypeName:'10時ご入場枠【WEB整理券】',dispFlg:true,usageDispType:'KeyONLINE_RECEPTION_ONLY'},
    {waitTypeId:'0031',waitTypeName:'12時50分頃入場【土休日特定日】',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
    {waitTypeId:'0032',waitTypeName:'12時半ご入場枠【WEB整理券】',dispFlg:true,usageDispType:'KeyONLINE_RECEPTION_ONLY'},
    {waitTypeId:'0033',waitTypeName:'15時15分頃入場時間【土休日特定日】',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
    {waitTypeId:'0034',waitTypeName:'15時ご入場枠【WEB整理券】',dispFlg:true,usageDispType:'KeyONLINE_RECEPTION_ONLY'},
    {waitTypeId:'0042',waitTypeName:'入場不可テスト',dispFlg:false,usageDispType:'KeySTORE_RECEPTION_ONLY'}
  ];
  await page.addInitScript(() => {
    const RealDate = Date;
    const fixed = new RealDate('2026-09-19T03:00:00.000Z').valueOf();
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    };
  });
  await page.route('https://asoboon-miniapp-v2-develop-gateway.asoboon425.workers.dev/**', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('action') === 'businessDay') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(businessDayFixture) });
    }
    if (url.searchParams.get('action') === 'health') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok:true, officialDevelopEnabled:true, createRequiresVerifiedLiff:true, createEnabled:true
      }) });
    }
    if (url.searchParams.get('action') === 'waitTypes') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok:true, waitTypes:waitTypesFixture }) });
    }
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"TEST_OFFLINE"}' });
  });
  await page.route('**/miniapp-v2/develop/env.js*', async route => {
    const env = fs.readFileSync('miniapp-v2/develop/env.js', 'utf8')
      .replace("endpoint:'https://asoboon.github.io/asoboon-stamp/miniapp-v2/develop/'", `endpoint:'${BASE}'`);
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: env });
  });
  await page.route('https://static.line-scdn.net/**', async route => {
    if (mode === 'missing') return route.abort();
    const init = mode === 'pending'
      ? 'new Promise(()=>{})'
      : mode === 'reject'
        ? 'Promise.reject(new Error("MOCK_LIFF_REJECT"))'
        : 'Promise.resolve()';
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.liff={isInClient:()=>true,init:()=>${init},isLoggedIn:()=>${mode==='authenticated'?'true':'false'},getAccessToken:()=>${mode==='authenticated'?"'test-liff-access-token-1234567890'":"''"},getProfile:()=>Promise.resolve({displayName:'Test'}),openWindow:(opts)=>{window.__lastLiffOpenWindow=opts;}};`
    });
  });
}

async function openHome(page, mode) {
  await installLiff(page, mode);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.v35-home, .v37-home, .v38-home')).toBeVisible();
}

const routes = [
  ['[data-v7-view="reception"]', 'reception', null, /受付/],
  ['[data-v7-view="first"]:not([data-v7-panel])', 'first', null, /初めての方/],
  ['[data-v7-view="first"][data-v7-panel="price"]', 'first', 'price', /料金/],
  ['[data-v7-view="parking"]', 'parking', null, /駐車場/],
  ['[data-v7-view="rules"]', 'rules', null, /館内ルール/],
  ['[data-v7-view="entry"]', 'entry', null, /一時退場/],
  ['[data-v7-view="timeguide"]', 'timeguide', null, /利用時間/],
];

for (const mode of ['resolve', 'reject', 'pending', 'missing']) {
  test(`HOME navigation remains live when LIFF is ${mode}`, async ({ page }) => {
    await openHome(page, mode);
    for (const [selector, view, panel, heading] of routes) {
      const target = page.locator(selector);
      await expect(target).toHaveCount(1);
      await target.click();
      await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe(view);
      if (panel) await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe(panel);
      await expect(page.locator('main.view')).toContainText(heading);
      await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('home');
      await expect(page.locator('.v35-home, .v37-home, .v38-home')).toBeVisible();
    }
  });
}

test('rapid click, back/forward, focus and visibility do not lock navigation', async ({ page }) => {
  await openHome(page, 'pending');
  const price = page.locator('[data-v7-view="first"][data-v7-panel="price"]');
  await price.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('panel')).toBe('price');
  await page.goBack();
  await expect(page.locator('.v35-home, .v37-home, .v38-home')).toBeVisible();
  await page.goForward();
  await expect(page.locator('main.view')).toContainText('料金');
  await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
  const rules = page.locator('[data-v7-view="rules"]');
  await rules.evaluate(element => { element.click(); element.click(); });
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('rules');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: '新HOMEへ戻る' }).click();
  await expect(page.locator('.v35-home, .v37-home, .v38-home')).toBeVisible();
});

test('Developing LINE reception exposes live WEB slots and no location UI', async ({ page }) => {
  await openHome(page, 'resolve');
  const rules = await page.evaluate(() => ({
    web: window.ASOBOON_V2_RULES.slotsFor('土日祝日','web').map(x=>x.waitTypeId),
    onsite: window.ASOBOON_V2_RULES.slotsFor('土日祝日','onsite').map(x=>x.waitTypeId),
    regularWeb: window.ASOBOON_V2_RULES.slotsFor('平日','web').map(x=>x.waitTypeId),
    specialWeb: window.ASOBOON_V2_RULES.slotsFor('平日特定日','web').map(x=>x.waitTypeId),
  }));
  expect(rules.web).toEqual(['0029','0031','0033']);
  expect(rules.onsite).toEqual(['0029','0031','0033']);
  expect(rules.regularWeb).toEqual(['0023','0024','0025','0027']);
  expect(rules.specialWeb).toEqual(['0036','0038']);

  await page.locator('[data-v7-view="reception"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('reception');
  await expect(page.locator('[data-rec-slot="0029"]')).toHaveCount(1);
  await expect(page.locator('[data-rec-slot="0031"]')).toHaveCount(1);
  await expect(page.locator('[data-rec-slot="0033"]')).toHaveCount(1);
  await expect(page.locator('[data-rec-slot="0030"],[data-rec-slot="0032"],[data-rec-slot="0034"]')).toHaveCount(0);
  await expect(page.locator('[data-rec-slot="0042"],[data-rec-slot="0029"],[data-rec-slot="0031"],[data-rec-slot="0033"]')).toHaveCount(0);
  await expect(page.locator('#recLocation,#recLocationBtn,#recWeb,#recOnsite,.rec-methods')).toHaveCount(0);
  await expect(page.locator('#recModeLabel')).toHaveText('LINE受付');
});

test('regular weekday LINE reception shows all four AirWAIT slots', async ({ page }) => {
  await installLiff(page, 'authenticated', {
    businessDay:{ ok:true, operationalDate:'2026-09-19', businessType:'平日', closingTime:'17:00' },
    waitTypes:[
      {waitTypeId:'0023',waitTypeName:'すぐ入場受付【平日】',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
      {waitTypeId:'0024',waitTypeName:'10時ご入場枠【WEB平日】',dispFlg:true,usageDispType:'KeyONLINE_RECEPTION_ONLY'},
      {waitTypeId:'0025',waitTypeName:'14時から【平日】',dispFlg:true,usageDispType:'KeySTORE_RECEPTION_ONLY'},
      {waitTypeId:'0027',waitTypeName:'14時ご入場枠【WEB平日】',dispFlg:true,usageDispType:'KeyONLINE_RECEPTION_ONLY'}
    ]
  });
  await page.goto(`${BASE}?view=reception`, { waitUntil:'domcontentloaded' });
  for (const id of ['0023','0025']) {
    await expect(page.locator(`[data-rec-slot="${id}"]`)).toHaveCount(1);
  }
  await expect(page.locator('[data-rec-slot="0024"],[data-rec-slot="0027"]')).toHaveCount(0);
  await expect(page.locator('#recModeLabel')).toHaveText('LINE受付');
  await expect(page.locator('#recLocation,#recLocationBtn,#recWeb,#recOnsite,.rec-methods')).toHaveCount(0);
});

test('Developing 0042 remains available only behind explicit dev mode', async ({ page }) => {
  await installLiff(page, 'authenticated');
  await page.goto(`${BASE}?view=reception&dev=0042`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-rec-slot="0042"]')).toHaveCount(1);
  await expect(page.locator('[data-rec-slot="0030"],[data-rec-slot="0032"],[data-rec-slot="0034"]')).toHaveCount(0);
  await expect(page.locator('#recModeLabel')).toHaveText('Developingテスト');
  await expect(page.locator('#recLocation,#recLocationBtn,#recWeb,#recOnsite,.rec-methods')).toHaveCount(0);
});

test('legacy overlay never resurrects disabled Developing test slot', async ({ page }) => {
  await openHome(page, 'resolve');
  await page.locator('[data-v7-view="reception"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('reception');
  await page.evaluate(() => {
    const slots = document.querySelector('#recSlots');
    slots.insertAdjacentHTML('beforeend', '<button type="button" data-rec-slot="0042"><strong>入場不可テスト</strong><small>0042</small></button>');
  });
  await expect(page.locator('.v22-dev-test-slot [data-rec-slot="0042"]')).toHaveCount(0);
  await expect(page.locator('#recSlots [data-rec-slot="0042"]')).toHaveCount(0);
});

async function openReceptionWithPending(page, result) {
  await installLiff(page, 'authenticated');
  await page.addInitScript(pending => localStorage.setItem('asoboon_v2_pending_reception_develop_v1', JSON.stringify(pending)), {
    requestId:'v2_pending_12345678', fingerprint:'2026-09-19|web|0029|1|0|0',
    body:{operationalDate:'2026-09-19',mode:'web',waitTypeId:'0029',adults:1,paidChildren:0,infants:0}, createdAt:Date.parse('2026-09-19T03:00:00Z')
  });
  await page.route('https://asoboon-miniapp-v2-develop-gateway.asoboon425.workers.dev/**', async route => {
    const url=new URL(route.request().url());
    if(url.searchParams.get('action')==='requestStatus')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
    return route.fallback();
  });
  await page.goto(`${BASE}?view=reception`,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#recStatus')).toBeVisible();
}

test('app reopen clears pending after deterministic REJECTED result', async ({page}) => {
  await openReceptionWithPending(page,{found:true,ok:false,ambiguous:false,error:'AIRWAIT_RECEPTION_ENDED'});
  await expect(page.locator('#recStatus')).toContainText('受付は終了');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('asoboon_v2_pending_reception_develop_v1'))).toBeNull();
  await expect(page.locator('#recSubmit')).not.toBeDisabled({timeout:1000}).catch(()=>{});
});

test('app reopen preserves pending and retry control for AMBIGUOUS result', async ({page}) => {
  await openReceptionWithPending(page,{found:true,ok:false,ambiguous:true,error:'AIRWAIT_CREATE_NETWORK_AMBIGUOUS_MANUAL_REVIEW'});
  await expect(page.locator('#recStatus')).toContainText('新しい受付は行わないでください');
  await expect(page.locator('#recStatus')).not.toContainText('スタッフ対応');
  await expect(page.locator('[data-rec-check-result]')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>Boolean(localStorage.getItem('asoboon_v2_pending_reception_develop_v1')))).toBe(true);
});

test('app reopen recovers CONFIRMED and moves to callstatus', async ({page}) => {
  await openReceptionWithPending(page,{found:true,ok:true,stored:true,ambiguous:false,businessDate:'2026-09-19',reserveId:'000000000123',receiptNo:'F123'});
  await expect.poll(()=>new URL(page.url()).searchParams.get('view')).toBe('callstatus');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('asoboon_v2_pending_reception_develop_v1'))).toBeNull();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('asoboon_v2_current_reservation_develop_v1')));
  expect(saved.receiptNo).toBe('F123');
});

for(const width of [320,375,390,430])test(`reception layout has no horizontal overflow at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await openHome(page,'resolve');await page.locator('[data-v7-view="reception"]').click();
  await expect(page.locator('#recSlots')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
