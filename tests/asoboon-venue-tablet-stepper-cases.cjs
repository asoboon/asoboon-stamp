/* Run through the existing venue-tablet E2E workflow without extra CI setup. */
const {test:stepTest,expect:stepExpect}=require('@playwright/test');
const stepPath=require('node:path');
const {pathToFileURL}=require('node:url');
const stepUrl=pathToFileURL(stepPath.resolve('jounaisetumei-core.html')).href;

stepTest.describe('ASOBooN tap-through instructions',()=>{
  stepTest.use({viewport:{width:1194,height:834},reducedMotion:'no-preference'});

  stepTest('family: only one of three instructions at a time; previous and final reentry',async({page})=>{
    await page.goto(stepUrl);
    const r=page.locator('#exitGuideV2');
    await r.locator('[data-guide="family"]').click();
    await stepExpect(r.locator('.eg-stepper-active')).toBeVisible();
    await stepExpect(r.locator('.eg-stepper-number')).toHaveText('ステップ 1 / 3');
    await stepExpect(r.locator('.eg-step:not([hidden])')).toHaveCount(1);
    await stepExpect(r.locator('.eg-step').nth(0)).toBeVisible();
    await stepExpect(r.locator('.eg-step').nth(1)).toBeHidden();
    await stepExpect(r.locator('.eg-stepper-pin')).toContainText('一時退場中も利用時間は進みます。');
    await stepExpect(r.locator('.eg-hint')).toBeHidden();
    await r.locator('[data-stepper-action="next"]').click();
    await stepExpect(r.locator('.eg-stepper-number')).toHaveText('ステップ 2 / 3');
    await stepExpect(r.locator('.eg-step').nth(1)).toBeVisible();
    await r.locator('[data-stepper-action="prev"]').click();
    await stepExpect(r.locator('.eg-stepper-number')).toHaveText('ステップ 1 / 3');
    await r.locator('[data-stepper-action="next"]').click();
    await r.locator('[data-stepper-action="next"]').click();
    await stepExpect(r.locator('.eg-stepper-number')).toHaveText('ステップ 3 / 3');
    await stepExpect(r.locator('.eg-hint')).toBeVisible();
    await stepExpect(r.locator('.eg-hint')).toContainText('戻るときは、受付でレシートを見せてください。');
    await stepExpect(r.locator('[data-stepper-action="next"]')).toContainText('最初の画面へ戻る');
    await r.locator('[data-stepper-action="next"]').click();
    await stepExpect(r.locator('.eg-choice')).toHaveCount(3);
    await stepExpect(r.locator('.eg-stepper-active')).toHaveCount(0);
  });

  stepTest('leave: no-reentry safety notice is ALWAYS visible, two steps',async({page})=>{
    await page.goto(stepUrl);
    const r=page.locator('#exitGuideV2');
    await r.locator('[data-guide="leave"]').click();
    await stepExpect(r.locator('.eg-stepper-number')).toHaveText('ステップ 1 / 2');
    await stepExpect(r.locator('.eg-step:not([hidden])')).toHaveCount(1);
    await stepExpect(r.locator('.eg-hint.eg-danger')).toBeVisible();
    await stepExpect(r.locator('.eg-hint.eg-danger')).toContainText('再入場はできません。');
    await stepExpect(r.locator('.eg-hint.eg-notice-green')).toBeHidden();
    await r.locator('[data-stepper-action="next"]').click();
    await stepExpect(r.locator('.eg-stepper-number')).toHaveText('ステップ 2 / 2');
    await stepExpect(r.locator('.eg-hint.eg-danger')).toBeVisible();
    await stepExpect(r.locator('.eg-hint.eg-notice-green')).toBeVisible();
    await r.locator('[data-stepper-action="next"]').click();
    await stepExpect(r.locator('.eg-choice')).toHaveCount(3);
  });

  stepTest('adult holder decision and safety warning remain unchanged; yes has two steps',async({page})=>{
    await page.goto(stepUrl);
    const r=page.locator('#exitGuideV2');
    await r.locator('[data-guide="adult"]').click();
    await stepExpect(r.locator('.eg-stepper-active')).toHaveCount(0);
    await stepExpect(r.locator('[data-guide="adult-no"]')).toBeVisible();
    await r.locator('[data-guide="adult-no"]').click();
    await stepExpect(r.locator('.eg-hint.eg-danger')).toBeVisible();
    await stepExpect(r.locator('.eg-stepper-active')).toHaveCount(0);
    await r.locator('[data-guide="home"]').first().click();
    await r.locator('[data-guide="adult"]').click();
    await r.locator('[data-guide="adult-yes"]').click();
    await stepExpect(r.locator('.eg-stepper-number')).toHaveText('ステップ 1 / 2');
    await stepExpect(r.locator('.eg-hint.eg-notice-amber')).toBeHidden();
    await r.locator('[data-stepper-action="next"]').click();
    await stepExpect(r.locator('.eg-hint.eg-notice-amber')).toBeVisible();
  });

  stepTest('all eight languages get their own Next/Back buttons',async({page})=>{
    await page.goto(stepUrl);
    const r=page.locator('#exitGuideV2');
    const locales=[['ja','次へ','前へ'],['en','Next','Back'],['zh','下一步','上一步'],['vi','Tiếp theo','Quay lại'],['ko','다음','이전'],['ne','अर्को','अघिल्लो'],['tl','Susunod','Bumalik'],['my','ရှေ့သို့','နောက်သို့']];
    await r.locator('[data-guide="family"]').click();
    for(const [loc,next,prev] of locales){
      await page.locator('#eg-final-languages [data-locale="'+loc+'"]').click();
      await stepExpect(r.locator('[data-stepper-action="next"]')).toContainText(next);
      await r.locator('[data-stepper-action="next"]').click();
      await stepExpect(r.locator('[data-stepper-action="prev"]')).toContainText(prev);
      await r.locator('[data-stepper-action="prev"]').click();
    }
    await stepExpect(r.locator('.eg-stepper-number')).toContainText('1 / 3');
  });

  stepTest('iPad landscape, portrait and small phone retain tappable Next CTA',async({browser})=>{
    for(const size of [{width:1194,height:834},{width:1024,height:768},{width:768,height:1024},{width:390,height:844}]){
      const page=await browser.newPage({viewport:size});
      await page.goto(stepUrl);
      await page.locator('#exitGuideV2 [data-guide="family"]').click();
      const info=await page.locator('#exitGuideV2').evaluate(root=>{
        const next=root.querySelector('[data-stepper-action="next"]'),rect=next.getBoundingClientRect();
        return {x:rect.x,y:rect.y,w:rect.width,h:rect.height,viewportHeight:innerHeight,viewportWidth:innerWidth,stepVisible:root.querySelectorAll('.eg-step:not([hidden])').length};
      });
      stepExpect(info.stepVisible).toBe(1);
      stepExpect(info.w).toBeGreaterThan(120);
      stepExpect(info.h).toBeGreaterThan(48);
      stepExpect(info.y).toBeGreaterThanOrEqual(0);
      stepExpect(info.y+info.h).toBeLessThanOrEqual(size.height+2);
      await page.locator('#exitGuideV2 [data-stepper-action="next"]').click();
      await stepExpect(page.locator('#exitGuideV2 .eg-stepper-number')).toContainText('2 / 3');
      await page.close();
    }
  });
});
