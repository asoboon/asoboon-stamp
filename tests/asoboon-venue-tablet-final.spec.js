const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const target=pathToFileURL(path.resolve('jounaisetumei-core.html')).href;
test.use({viewport:{width:768,height:1024},reducedMotion:'no-preference'});
test('8言語の入口、持ち物、返却、再入場、禁止文を切替可能',async({page})=>{
  await page.goto(target);
  const guide=page.locator('#exitGuideV2');
  const langbar=page.locator('#eg-final-languages');
  await expect(guide).toBeVisible();
  await expect(langbar.locator('button')).toHaveCount(8);
  const cases=[
    ['ja','外に出るときのご案内'],
    ['en','Leaving & returning'],
    ['zh','外出与返回指南'],
    ['vi','Hướng dẫn ra ngoài'],
    ['ko','외출 및 재입장 안내'],
    ['ne','बाहिर जाने र फर्कने 안내'],
    ['tl','Gabay sa paglabas'],
    ['my','အပြင်ထွက်ခြင်း လမ်းညွှန်']
  ];
  for(const [locale,heading] of cases){
    await langbar.locator('[data-locale="'+locale+'"]').click();
    await expect(guide.locator('.eg-intro h1')).toHaveText(heading);
    await expect(langbar.locator('[data-locale="'+locale+'"]')).toHaveAttribute('aria-pressed','true');
    await expect(guide).toHaveAttribute('lang',locale);
  }
  await langbar.locator('[data-locale="en"]').click();
  await guide.locator('[data-motion-toggle]').click();
  await guide.locator('[data-guide="family"]').click();
  await expect(guide).toContainText('Remove the receipt from the RED holder');
  await expect(guide).toContainText('To re-enter, show the receipt at reception');
  await guide.locator('[data-guide="home"]').first().click();
  await guide.locator('[data-guide="adult"]').click();
  await expect(guide).toContainText('Do you have a YELLOW holder?');
  await guide.locator('[data-guide="adult-no"]').click();
  await expect(guide).toContainText('ask reception BEFORE leaving');
  await guide.locator('[data-guide="home"]').first().click();
  await guide.locator('[data-guide="leave"]').click();
  await expect(guide).toContainText('RE-ENTRY IS NOT ALLOWED');
});
test('V5演出に190粒子と追加の扉・光・衝撃レイヤーがある',async({page})=>{
  await page.goto(target);
  const cin=page.locator('#eg-cinema');
  await expect(page.locator('#eg-final-languages')).toBeVisible();
  await page.locator('#exitGuideV2 [data-guide="family"]').click();
  await expect(cin).toHaveClass(/active/);
  const state=await page.evaluate(()=>({v5:!!window.__asoboonExitGuideV5,playing:window.__ASOBOON_CINEMA_TEST__?.isRunning(),particles:window.__ASOBOON_CINEMA_TEST__?.particleCount()}));
  expect(state).toEqual({v5:true,playing:true,particles:190});
  await expect(cin.locator('.eg-final-rail i')).toHaveCount(2);
  await expect(cin.locator('.eg-final-vortex')).toHaveCount(1);
  await expect(cin.locator('.eg-final-impact')).toHaveCount(1);
  await expect(page.locator('#exitGuideV2')).toContainText('レシートを抜く',{timeout:5000});
});
test('iPad横向きでも3択と多言語コントロールを操作できる',async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await page.goto(target);
  await expect(page.locator('#eg-final-languages')).toBeVisible();
  await expect(page.locator('#exitGuideV2 [data-guide="family"]')).toBeVisible();
  await expect(page.locator('#exitGuideV2 [data-guide="adult"]')).toBeVisible();
  await expect(page.locator('#exitGuideV2 [data-guide="leave"]')).toBeVisible();
  await page.locator('#eg-final-languages [data-locale="zh"]').click();
  await expect(page.locator('#exitGuideV2 .eg-intro h1')).toHaveText('外出与返回指南');
});
test('言語を選択しても通常平日の案内を隠さない',async({page})=>{
  await page.goto(target);
  await page.locator('#eg-final-languages [data-locale="vi"]').click();
  await page.evaluate(()=>{
    const overlay=document.createElement('div');overlay.id='asoboonSpecialOverlay';
    overlay.className='show';overlay.dataset.kind='unlimited';
    document.querySelector('#timeView .stage').append(overlay);
  });
  await expect(page.locator('#exitGuideV2')).toBeVisible();
  await expect(page.locator('#exitGuideV2 .eg-intro h1')).toHaveText('Hướng dẫn ra ngoài');
});
test('視差効果を減らす設定に応じて動作表示がOFFになる',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(target);
  await expect(page.locator('#exitGuideV2 [data-motion-toggle]')).toHaveAttribute('data-motion','off');
  await page.locator('#exitGuideV2 [data-motion-toggle]').click();
  await expect(page.locator('#exitGuideV2 [data-motion-toggle]')).toHaveAttribute('data-motion','on');
});
