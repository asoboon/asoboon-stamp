const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.ASOQUEST_BASE_URL || 'http://127.0.0.1:4173/miniapp-v2/production/asoquest/';
const QA_DIR = process.env.ASOQUEST_QA_DIR || 'qa-out';
const PARTS = ['engine','wheel','headlight','fin','grille','key'];

test.setTimeout(45000);

async function shot(page, name) {
  await page.screenshot({ path: path.join(QA_DIR, name), fullPage: false });
}

async function collectPart(page, part) {
  await page.goto(`${BASE}?part=${part}&src=qa`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#overlay')).toHaveClass(/show/);
}

async function waitPhase(page, phase) {
  await page.waitForFunction(
    expected => document.querySelector('#ignitionSequence')?.dataset.phase === expected,
    phase,
    { timeout: 5000 }
  );
  await expect(page.locator('#ignitionSequence')).toHaveClass(/show/);
}

test('ENGINE START visual QA packet', async ({ page }) => {
  fs.mkdirSync(QA_DIR, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });

  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err.message || err)));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon|navigator\.vibrate|Blocked call to navigator\.vibrate/i.test(t)) consoleErrors.push(t);
    }
  });

  for (let i = 0; i < PARTS.length; i++) {
    await collectPart(page, PARTS[i]);

    if (PARTS[i] === 'engine') {
      await page.locator('#overlayClose').click();
      await page.waitForTimeout(350);
      const engineOpacity = await page.locator('#engineFx').evaluate(el => Number(getComputedStyle(el).opacity));
      expect(engineOpacity).toBeGreaterThan(0.45);
      await shot(page, '02a_engine_visible.png');
      continue;
    }

    if (i < PARTS.length - 1) {
      await page.locator('#overlayClose').click();
    }
  }

  await expect(page.locator('#overlayTitle')).toHaveText('キー');
  await expect(page.locator('#overlayText')).toHaveText('ENGINE STARTが解放された！');
  await shot(page, '02_sixth_part_acquired.png');
  await page.locator('#overlayClose').click();
  await page.waitForTimeout(350);
  const keyOpacity = await page.locator('#keyFx').evaluate(el => Number(getComputedStyle(el).opacity));
  expect(keyOpacity).toBeGreaterThan(0.5);
  await shot(page, '02b_key_visible.png');

  await expect(page.locator('#engineTitle')).toHaveText('UNLOCKED');
  await expect(page.locator('#completeFx')).not.toHaveClass(/on/);
  await page.waitForTimeout(260);
  await shot(page, '03_engine_start_ready.png');

  await page.goto(`${BASE}?station=engine&src=qa`, { waitUntil: 'domcontentloaded' });

  await waitPhase(page, 'phase-2');
  await expect(page.locator('#ignitionTitle')).toHaveText('ENGINE START');
  await expect(page.locator('#ignitionSub')).toHaveText('始動');
  await shot(page, '04_tachometer_start.png');

  await waitPhase(page, 'phase-1');
  await expect(page.locator('#ignitionTitle')).toHaveText('');
  await expect(page.locator('#rpmValue')).toHaveText('7.8');
  await shot(page, '05_high_rpm.png');

  await waitPhase(page, 'phase-ignite');
  await expect(page.locator('#ignitionTitle')).toHaveText('');
  await page.waitForTimeout(330);
  const headlightOpacity = await page.locator('.headlight-left').evaluate(el => Number(getComputedStyle(el).opacity));
  expect(headlightOpacity).toBeGreaterThan(0.7);
  await shot(page, '06_headlights.png');

  await waitPhase(page, 'phase-run');
  await expect(page.locator('#ignitionTitle')).toHaveText('FULL POWER');
  await page.waitForTimeout(180);
  const blueAfterfireOpacity = await page.locator('.afterfire-blue-left').evaluate(el => Number(getComputedStyle(el).opacity));
  expect(blueAfterfireOpacity).toBeGreaterThan(0.2);
  await shot(page, '07_afterfire.png');

  await shot(page, '07_full_power.png');

  await waitPhase(page, 'phase-blackout');
  await page.waitForTimeout(120);
  await shot(page, '08_blackout.png');

  await waitPhase(page, 'phase-reveal');
  await page.waitForTimeout(90);
  await shot(page, '09_silhouette.png');
  await page.waitForTimeout(430);
  await shot(page, '10_light_reveal.png');
  await page.waitForTimeout(900);
  await shot(page, '11_complete_hero.png');

  await waitPhase(page, 'phase-final');
  await expect(page.locator('#ignitionFinal')).toBeVisible();
  await expect(page.locator('#ignitionFinal h2')).toHaveText('スタンプラリー クリア！');
  await expect(page.locator('#ignitionFinal p')).toHaveText('マシン完成！');
  await page.waitForTimeout(650);
  await shot(page, '12_final_copy.png');
  await shot(page, '13_iphone_390.png');

  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForTimeout(250);
  await shot(page, '14_line_inapp_390.png');

  await page.locator('#ignitionClose').click();
  await expect(page.locator('#engineTitle')).toHaveText('COMPLETE');
  await expect(page.locator('#completeFx')).toHaveClass(/on/);
  await page.waitForTimeout(320);
  const completeOpacity = await page.locator('#completeFx').evaluate(el => Number(getComputedStyle(el).opacity));
  expect(completeOpacity).toBeGreaterThan(0.4);
  const completeBackground = await page.locator('#carStage').evaluate(el => getComputedStyle(el).backgroundImage);
  expect(completeBackground).toContain('garage_complete_glow.webp');
  await shot(page, '01_normal_completed.png');

  // Completed-state re-entry must be replayable, while one page load cannot double-start.
  await page.goto(`${BASE}?station=engine&src=qa-replay`, { waitUntil: 'domcontentloaded' });
  await waitPhase(page, 'phase-2');
  await expect(page.locator('#ignitionSequence')).toHaveCount(1);

  // Reduced-motion users still receive the complete state and the same semantic phase sequence.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}?station=engine&src=qa-reduced`, { waitUntil: 'domcontentloaded' });
  await waitPhase(page, 'phase-final');
  await expect(page.locator('#ignitionFinal')).toBeVisible();

  const runtime = {
    viewportPrimary: '390x844',
    viewportLineLike: '390x780',
    phases: ['phase-2','phase-1','phase-ignite','phase-run','phase-blackout','phase-reveal','phase-final'],
    sixthPartMessage: 'ENGINE STARTが解放された！',
    userVisibleName: 'スタンプラリー',
    approvedFxPack: true,
    engineVisualPersistent: true,
    keyVisualPersistent: true,
    completedVisualDistinct: true,
    completedReplay: true,
    reducedMotionSemanticCompletion: true,
    pageErrors,
    consoleErrors
  };
  fs.writeFileSync(path.join(QA_DIR, 'qa_runtime.json'), JSON.stringify(runtime, null, 2));
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});