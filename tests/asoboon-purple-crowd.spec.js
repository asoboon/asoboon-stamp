const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.ASOBOON_PURPLE_BASE_URL || 'http://127.0.0.1:4173/home-purple.html';
const values = [[350,0],[195,50],[71,90],[41,99],[40,100],[35,100],[0,100]];
const liveSlot=(id,name,remaining,extra={})=>({waitTypeId:id,waitTypeName:name,detailedWaitType:name,reserveUnit:'PERSON',evidence:'PERSON',remaining,...extra});
const liveResponse=slots=>({ok:true,version:'2.1.cf13',slots});
async function mockCrowd(page,response,status=200){let requests=0;await page.route(/asoboon-purple-gateway\.asoboon425\.workers\.dev.*action=crowdRemaining/,route=>{requests++;return route.fulfill({status,contentType:'application/json',body:typeof response==='string'?response:JSON.stringify(response)})});return()=>requests}

async function panel(page) {
  const box = page.frameLocator('#miniappCore').locator('#purpleCrowdPanel');
  await expect(box).toBeVisible();
  return box;
}

for (const [remaining,percent] of values) {
  test(`remaining ${remaining} persons gives crowd ${percent}%`, async ({ page }) => {
    await page.goto(`${BASE}?remainingDemo=${remaining}&crowdDemoSlot=15%3A00%E5%9B%9E`, { waitUntil:'domcontentloaded' });
    const box=await panel(page);
    await expect(box).toContainText(`混雑目安${percent}%`);
    await expect(box).toContainText(`受付残り ${remaining}名`);
    await expect(box).toContainText(remaining===0?'満員':'受付中');
    await expect(box).toContainText('15:00回');
    await expect(box.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow',String(percent));
    await expect(box).not.toContainText('定員');
    await expect(box).not.toContainText('/ 350名');
    await expect(box).not.toContainText('310名で100%');
  });
}

test('closed reception hides remaining while showing crowd', async ({ page }) => {
  await page.goto(`${BASE}?remainingDemo=35&crowdClosed=1`, { waitUntil:'domcontentloaded' });
  const box=await panel(page);
  await expect(box).toContainText('受付終了');
  await expect(box).toContainText('混雑目安100%');
  await expect(box).not.toContainText('受付残り');
  await expect(box).not.toContainText('35名');
});

for (const value of ['-1','351','abc','']) {
  test(`invalid demo remaining ${JSON.stringify(value)} fails closed`, async ({ page }) => {
    await page.goto(`${BASE}?remainingDemo=${encodeURIComponent(value)}`, { waitUntil:'domcontentloaded' });
    const box=await panel(page);
    await expect(box).toContainText('混雑情報を取得できません');
    await expect(box.locator('[role="progressbar"]')).toHaveCount(0);
  });
}

test('normal access shows three actual-person slot percentages without acceptance claims', async ({ page }) => {
  const requests=await mockCrowd(page,liveResponse([liveSlot('0030','10時ご入場枠【WEB整理券】',195),liveSlot('0032','12時半ご入場枠【WEB整理券】',71),liveSlot('0034','15時ご入場枠【WEB整理券】',25)]));
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  const box=await panel(page);
  await expect(box.locator('[role="progressbar"]')).toHaveCount(3);
  for(const [label,percent] of [['10:00回',50],['12:30回',90],['15:00回',100]])await expect(box.locator('.purple-crowd-card').filter({hasText:label}).locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow',String(percent));
  for(const word of ['受付残り','受付中','受付終了','満員','350','310','混雑情報を取得できません'])await expect(box).not.toContainText(word);
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))});
  expect(requests()).toBe(1);
});

test('old currentCount demo parameter is ignored', async ({ page }) => {
  await mockCrowd(page,{ok:false});
  await page.goto(`${BASE}?crowdDemo=315`, { waitUntil:'domcontentloaded' });
  const box=await panel(page);
  await expect(box).toContainText('混雑情報を取得できません');
});

for(const [label,slots] of [
  ['GROUP',[liveSlot('0030','10時ご入場枠【WEB整理券】',35,{reserveUnit:'GROUP'})]],
  ['wrong evidence',[liveSlot('0030','10時ご入場枠【WEB整理券】',35,{evidence:'MATCH_COUNT_2'})]],
  ['negative',[liveSlot('0030','10時ご入場枠【WEB整理券】',-1)]],
  ['over capacity',[liveSlot('0030','10時ご入場枠【WEB整理券】',351)]],
  ['unverified name',[liveSlot('0030','10時ご入場枠【WEB整理券】',35,{detailedWaitType:'別の回'})]],
  ['duplicate',[liveSlot('0030','10時ご入場枠【WEB整理券】',35),liveSlot('0030','10時ご入場枠【WEB整理券】',35)]]
])test(`live ${label} fails closed`,async({page})=>{await mockCrowd(page,liveResponse(slots));await page.goto(BASE,{waitUntil:'domcontentloaded'});const box=await panel(page);await expect(box).toContainText('混雑情報を取得できません');await expect(box.locator('[role="progressbar"]')).toHaveCount(0)});

test('Gateway HTTP error fails closed',async({page})=>{await mockCrowd(page,{ok:false},503);await page.goto(BASE,{waitUntil:'domcontentloaded'});await expect(await panel(page)).toContainText('混雑情報を取得できません')});
test('invalid JSON fails closed',async({page})=>{await mockCrowd(page,'not json');await page.goto(BASE,{waitUntil:'domcontentloaded'});await expect(await panel(page)).toContainText('混雑情報を取得できません')});
test('loading is shown before a delayed Gateway response, without error flash',async({page})=>{let release;await page.route(/asoboon-purple-gateway\.asoboon425\.workers\.dev.*action=crowdRemaining/,async route=>{await new Promise(resolve=>{release=resolve});await route.fulfill({contentType:'application/json',body:JSON.stringify(liveResponse([liveSlot('0030','10時ご入場枠【WEB整理券】',195)]))})});await page.goto(BASE,{waitUntil:'domcontentloaded'});const box=await panel(page);await expect(box).toContainText('混雑情報を取得しています');await expect(box).not.toContainText('混雑情報を取得できません');await expect.poll(()=>typeof release).toBe('function');release();await expect(box).toContainText('50%')});

for (const width of [320,375,390,430]) {
  test(`purple crowd responsive ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height:900 });
    await page.goto(`${BASE}?remainingDemo=35`, { waitUntil:'domcontentloaded' });
    const box=await panel(page);
    const overflow=await page.evaluate(() => document.documentElement.scrollWidth>document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await expect(box.locator('[role="progressbar"]')).toBeVisible();
    await expect(box).toContainText('受付残り 35名');
    const output=path.join('test-results','purple-crowd');
    fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,`crowd-remaining35-${width}.png`),fullPage:true});
    await box.screenshot({path:path.join(output,`crowd-card-remaining35-${width}.png`)});
  });
}
