const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.ASOBOON_PURPLE_BASE_URL || 'http://127.0.0.1:4173/home-purple.html';
const values = [
  [0, 0, 350],
  [155, 50, 195],
  [279, 90, 71],
  [309, 99, 41],
  [310, 100, 40],
  [315, 100, 35],
  [350, 100, 0],
  [400, 100, 0],
];

async function panel(page) {
  const child = page.frameLocator('#miniappCore');
  await expect(child.locator('#purpleCrowdPanel')).toBeVisible();
  return child.locator('#purpleCrowdPanel');
}

for (const [current, percent, remaining] of values) {
  test(`purple crowd demo ${current} people`, async ({ page }) => {
    await page.goto(`${BASE}?crowdDemo=${current}&crowdDemoSlot=15%3A00%E5%9B%9E`, { waitUntil: 'domcontentloaded' });
    const box = await panel(page);
    await expect(box).toContainText(`混雑目安${percent}%`);
    await expect(box).toContainText(`受付 ${current.toLocaleString('ja-JP')} / 350名`);
    await expect(box).toContainText(`残り ${remaining}名`);
    await expect(box).toContainText('15:00回');
    const progress = box.locator('[role="progressbar"]');
    await expect(progress).toHaveAttribute('aria-valuenow', String(percent));
  });
}

test('reception closed remains independent from crowd figures', async ({ page }) => {
  await page.goto(`${BASE}?crowdDemo=315&crowdClosed=1`, { waitUntil: 'domcontentloaded' });
  const box = await panel(page);
  await expect(box).toContainText('受付終了');
  await expect(box).toContainText('混雑目安100%');
  await expect(box).toContainText('残り 35名');
});

test('API failure never renders zero people', async ({ page }) => {
  await page.route('https://asoboon-purple-gateway.asoboon425.workers.dev/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false,"error":"TEST_FAILURE"}' }));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const box = await panel(page);
  await expect(box).toContainText('混雑情報を取得できません');
  await expect(box).not.toContainText('受付 0 / 350名');
  await expect(box).not.toContainText('残り 350名');
});

for (const width of [320, 375, 390, 430]) {
  test(`purple crowd responsive ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}?crowdDemo=315`, { waitUntil: 'domcontentloaded' });
    const box = await panel(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await expect(box.locator('[role="progressbar"]')).toBeVisible();
    await expect(box).toContainText('残り 35名');
    const output = path.join('test-results', 'purple-crowd');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, `crowd-315-${width}.png`), fullPage: true });
    await box.screenshot({ path: path.join(output, `crowd-card-315-${width}.png`) });
  });
}
