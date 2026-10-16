const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

test('通常平日の無制限表示が3択を隠さず、手順と退場時間を開ける',async({page})=>{
  await page.goto(pathToFileURL(path.resolve('jounaisetumei-core.html')).href);
  const guide=page.locator('#exitGuideV2');
  await expect(guide).toBeVisible();
  await expect(guide.locator('[data-guide="family"]')).toBeVisible();
  await expect(guide.locator('[data-guide="adult"]')).toBeVisible();
  await expect(guide.locator('[data-guide="leave"]')).toBeVisible();

  await page.evaluate(()=>{
    const overlay=document.createElement('div');
    overlay.id='asoboonSpecialOverlay';
    overlay.dataset.kind='unlimited';
    overlay.className='show';
    document.querySelector('#timeView .stage').appendChild(overlay);
  });
  await expect(guide).toBeVisible();
  await guide.locator('[data-motion-toggle]').click();
  await guide.locator('[data-guide="family"]').click();
  await expect(guide).toContainText('赤ホルダーからレシートを抜く');
  await guide.locator('[data-guide="home"]').first().click();
  await guide.locator('[data-guide="adult"]').click();
  await expect(guide).toContainText('黄色ホルダーを持っていますか？');
  await guide.locator('[data-guide="home"]').first().click();
  await guide.locator('[data-guide="leave"]').click();
  await expect(guide).toContainText('再入場はできません');
  await guide.locator('[data-guide="time"]').click();
  await expect(guide).toBeHidden();
  await expect(page.locator('main.app')).not.toHaveAttribute('aria-hidden','true');
});

test('休館と営業情報エラーの警告は3択より優先される',async({page})=>{
  await page.goto(pathToFileURL(path.resolve('jounaisetumei-core.html')).href);
  const guide=page.locator('#exitGuideV2');
  await expect(guide).toBeVisible();
  await page.evaluate(()=>{
    const overlay=document.createElement('div');
    overlay.id='asoboonSpecialOverlay';
    overlay.dataset.kind='closed';
    overlay.className='show';
    document.querySelector('#timeView .stage').appendChild(overlay);
  });
  await expect(guide).toBeHidden();
  await expect(page.locator('main.app')).not.toHaveAttribute('aria-hidden','true');
});

test('公開ラッパーのiframeが確実にV5を読み込む',async({page})=>{
  await page.goto(pathToFileURL(path.resolve('jounaisetumei.html')).href);
  await expect(page.locator('#tabletCore')).toHaveAttribute('src',/jounaisetumei-core\.html\?tablet_release=v5-final-20261016-multilingual/);
});
