const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.ASOBOON_PURPLE_BASE_URL || 'http://127.0.0.1:4173/home-purple.html';
const values = [[350,0],[195,50],[71,90],[41,99],[40,100],[35,100],[0,100]];

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

test('normal access does not use demo or unverified API data', async ({ page }) => {
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  const box=await panel(page);
  await expect(box).toContainText('混雑情報を取得できません');
  await expect(box.locator('[role="progressbar"]')).toHaveCount(0);
  await expect(box).not.toContainText('受付残り');
});

test('old currentCount demo parameter is ignored', async ({ page }) => {
  await page.goto(`${BASE}?crowdDemo=315`, { waitUntil:'domcontentloaded' });
  const box=await panel(page);
  await expect(box).toContainText('混雑情報を取得できません');
});

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
