const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const target=pathToFileURL(path.resolve('jounaisetumei-core.html')).href;

test('お客様画面から退場時間の表示・内容・操作を完全除去',async({page})=>{
  await page.goto(target,{waitUntil:'domcontentloaded'});
  const guide=page.locator('#exitGuideV2');
  await expect(guide).toBeVisible();
  for(const option of ['family','adult','leave'])await expect(guide.locator('[data-guide="'+option+'"]')).toBeVisible();
  await expect(guide.locator('[data-guide="time"]')).toHaveCount(0);
  await expect(page.locator('#timeView')).toHaveCount(0);
  await expect(page.locator('main.app')).toBeHidden();
  await expect(page.locator('main.app')).toBeEmpty();
  const visible=await page.evaluate(()=>document.body.innerText);
  expect(visible).not.toMatch(/退場時間|何時まで遊べる|時間制限なし|ASOBooN EXIT CONTROL/);
});

test('旧画面から独立した3択を操作でき、次の案内へ即移動',async({page})=>{
  await page.goto(target,{waitUntil:'domcontentloaded'});
  const guide=page.locator('#exitGuideV2');
  await expect(guide).toBeVisible();
  const started=await page.evaluate(()=>{const t=performance.now();document.querySelector('[data-guide="family"]').click();return t;});
  await expect(page.locator('#eg-cinema')).toHaveAttribute('data-played','true');
  await expect(guide).toContainText('赤ホルダーからレシートを抜く',{timeout:3000});
  const elapsed=await page.evaluate(t=>performance.now()-t,started);
  expect(elapsed).toBeLessThan(1900);
  await guide.locator('[data-guide="home"]').first().click();
  await expect(guide.locator('[data-guide="adult"]')).toBeVisible({timeout:2500});
  await guide.locator('[data-motion-toggle]').click();
  await guide.locator('[data-guide="adult"]').click();
  await expect(guide).toContainText('黄色ホルダーを持っていますか？');
});

test('ラッパーは退場時間システムを起動せず、新版だけを読み込む',async({page})=>{
  await page.goto(pathToFileURL(path.resolve('jounaisetumei.html')).href,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#tabletCore')).toHaveAttribute('src',/jounaisetumei-core\.html\?tablet_release=v5-tap-steps-20261016-r99/);
  const source=await page.locator('body').textContent();
  expect(source).not.toMatch(/退場時間|asoboon-calendar/);
  await expect(page.frameLocator('#tabletCore').locator('#exitGuideV2')).toBeVisible();
});
