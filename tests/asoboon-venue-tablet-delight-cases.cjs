const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const target=pathToFileURL(path.resolve('jounaisetumei-core.html')).href;
test.describe('jounaisetumei object delight',()=>{
  test.use({viewport:{width:1194,height:834},reducedMotion:'no-preference'});

test('小道具は選んだ案内で一度だけ動き、注意画面と戻る画面には残らない',async({page})=>{
  await page.goto(target);
  const root=page.locator('#exitGuideV2');
  await expect(root).not.toHaveAttribute('data-delight-route',/.+/);
  await root.locator('[data-guide="family"]').click();
  await expect(root).toHaveAttribute('data-delight-route','family');
  // Receipt is now step 2: earlier instructions stay hidden until Next is tapped.
  await expect(root.locator('.eg-receipt')).toBeHidden();
  await root.locator('[data-stepper-action="next"]').click();
  await expect(root.locator('.eg-receipt')).toBeVisible();
  const receiptAnimation=await root.locator('.eg-receipt').evaluate(node=>({
    name:getComputedStyle(node).animationName,
    count:getComputedStyle(node).animationIterationCount
  }));
  expect(receiptAnimation.name).toContain('eg-delight-peek');
  expect(receiptAnimation.count).toBe('1');
  await root.locator('[data-guide="home"]').first().click();
  await expect(root).not.toHaveAttribute('data-delight-route',/.+/);
  await root.locator('[data-guide="adult"]').click();
  await expect(root).toHaveAttribute('data-delight-route','adult');
  await root.locator('[data-guide="adult-no"]').click();
  await expect(root).not.toHaveAttribute('data-delight-route',/.+/);
  await expect(root).toContainText('外出前に受付スタッフへ確認してください。');
  await expect(root.locator('[data-guide="time"]')).toHaveCount(0);
});

test('大人・帰るに固有の動きがあり、次画面を待たせない',async({page})=>{
  await page.goto(target);
  const root=page.locator('#exitGuideV2');
  await root.locator('[data-guide="adult"]').click();
  const ready=await page.evaluate(()=>{
    const t=performance.now();document.querySelector('#exitGuideV2 [data-guide="adult-yes"]').click();
    return {
      elapsed:performance.now()-t,
      hasContent:document.querySelector('#exitGuideV2')?.innerText.includes('黄色ホルダーを持って、外出できます')
    };
  });
  expect(ready.elapsed).toBeLessThan(400);
  expect(ready.hasContent).toBe(true);
  await expect(root).toHaveAttribute('data-delight-route','adult-yes');
  const proud=await root.locator('.eg-steps .eg-step:first-child .eg-holder').evaluate(el=>getComputedStyle(el).animationName);
  expect(proud).toContain('eg-delight-proud');
  await root.locator('[data-guide="home"]').first().click();
  await root.locator('[data-guide="leave"]').click();
  await expect(root).toHaveAttribute('data-delight-route','leave');
  const shuffle=await root.locator('.eg-two-holders').evaluate(el=>getComputedStyle(el).animationName);
  expect(shuffle).toContain('eg-delight-shuffle');
});

test('動きOFFなら道具も止まり、ブラウザのアクセシビリティ設定も優先',async({page})=>{
  await page.goto(target);
  const root=page.locator('#exitGuideV2');
  await root.locator('[data-motion-toggle]').click();
  await expect(root).toHaveClass(/eg-motion-off/);
  await root.locator('[data-guide="family"]').click();
  await expect(root).not.toHaveAttribute('data-delight-route',/.+/);
  const stopped=await root.locator('.eg-receipt').evaluate(el=>getComputedStyle(el).animationName);
  expect(stopped).toBe('none');

  await page.emulateMedia({reducedMotion:'reduce'});
  await root.locator('[data-guide="home"]').first().click();
  await root.locator('[data-motion-toggle]').click();
  await expect(root).not.toHaveClass(/eg-motion-off/);
  await root.locator('[data-guide="leave"]').click();
  await expect(root).not.toHaveAttribute('data-delight-route',/.+/);
  const reduced=await root.locator('.eg-two-holders').evaluate(el=>getComputedStyle(el).animationName);
  expect(reduced).toBe('none');
});

test('アニメーション途中で「動きを減らす」に変えても直ちに停止',async({page})=>{
  await page.goto(target);
  const root=page.locator('#exitGuideV2');
  await root.locator('[data-guide="family"]').click();
  await expect(root).toHaveAttribute('data-delight-route','family');
  await expect.poll(async()=>root.locator('.eg-receipt').evaluate(el=>getComputedStyle(el).animationName)).toContain('eg-delight-peek');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(async()=>root.locator('.eg-receipt').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});

});
