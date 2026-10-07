[Reading 210 lines from start (total: 210 lines, 0 remaining)]

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('playwright-core/lib/utilsBundle');

const BASE = process.env.ASOQUEST_BASE_URL || 'http://127.0.0.1:4173/miniapp-v2/production/asoquest/';
const QA_DIR = process.env.ASOQUEST_QA_DIR || 'qa-out';
test.setTimeout(60000);
// Sampling a 650ms blackout from outside the page is load-sensitive on a busy CI box; the in-app timers are exact
// (see RHYTHM_MS). Retries absorb scheduler hiccups only - real timing is asserted from in-page phase marks.
test.describe.configure({ retries: 2 });
const phaseOf = page => page.locator('#ignitionSequence').getAttribute('data-phase');

/* JST 19:00 cycle key, same rule as the app */
function cycleKey(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 3600e3);
  const d = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - (jst.getUTCHours() >= 19 ? 0 : 1)));
  return d.toISOString().slice(0, 10);
}

async function seed6of6(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(key => localStorage.setItem(`asoquest:v9:${key}`, JSON.stringify({
    acquired: ['engine', 'wheel', 'headlight', 'fin', 'grille', 'key'], complete: false, cycle: key, resetHourJst: 19
  })), cycleKey());
}

/* records every class change of the sequence with a high-resolution timestamp */
async function recordPhases(page) {
  await page.addInitScript(() => {
    window.__marks = [];
    const start = () => {
      const el = document.getElementById('ignitionSequence');
      if (!el) return requestAnimationFrame(start);
      const log = () => window.__marks.push({ t: performance.now(), cls: el.className, phase: el.dataset.phase });
      new MutationObserver(log).observe(el, { attributes: true, attributeFilter: ['class', 'data-phase'] });
    };
    start();
  });
}
const marks = page => page.evaluate(() => window.__marks);
const firstWith = (ms, re) => ms.find(m => re.test(m.cls));
const waitPhase = (page, phase, timeout = 9000) => page.waitForFunction(
  p => document.querySelector('#ignitionSequence')?.dataset.phase === p, phase, { timeout });

function luminance(buf) {
  const png = PNG.sync.read(buf);
  let sum = 0;
  const n = png.width * png.height;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    sum += 0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2];
  }
  return sum / n;
}
async function snap(page, name) {
  fs.mkdirSync(QA_DIR, { recursive: true });
  const buf = await page.screenshot({ path: path.join(QA_DIR, name) });
  return luminance(buf);
}
const op = (page, sel) => page.locator(sel).first().evaluate(el => Number(getComputedStyle(el).opacity));
const vis = (page, sel) => page.locator(sel).first().evaluate(el => getComputedStyle(el).visibility);

test('finale rhythm: FULL POWER -> FLASH -> BLACKOUT -> REVEAL -> HERO -> COPY (timing, darkness, no UI in blackout)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/vibrate|favicon/i.test(m.text())) errors.push(m.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await recordPhases(page);
  await seed6of6(page);
  await page.goto(`${BASE}?station=engine&src=qa`, { waitUntil: 'domcontentloaded' });

  await waitPhase(page, 'phase-run');
  await page.waitForTimeout(250);
  const headlightPower = await op(page, '.headlight-left');
  expect(await phaseOf(page), 'sampled inside FULL POWER').toBe('phase-run');
  const lumPower = await snap(page, '20_full_power.png');
  expect(headlightPower).toBeGreaterThan(0.7);

  await waitPhase(page, 'phase-blackout');
  await page.waitForTimeout(150);
  // everything is dropped: text, tachometer, headlights, afterfire, exhaust, garage, UI (read in one go, before any screenshot)
  const dark = await page.evaluate(() => {
    const q = sel => document.querySelector(`#ignitionSequence ${sel}`);
    const cs = sel => getComputedStyle(q(sel));
    const fx = ['.headlight-left', '.headlight-right', '.afterfire-blue-left', '.afterfire-blue-right', '.afterfire-orange-left',
      '.exhaust-glow', '.spark-burst-asset', '.ignition-flash-asset', '.bg-ignition', '.bg-complete', '.complete-aura', '.floor-reflection'];
    return {
      phase: document.getElementById('ignitionSequence').dataset.phase,
      hidden: ['.ignition-copy', '.tachometer', '#ignitionFinal'].map(s => [s, cs(s).visibility]),
      fx: fx.map(s => [s, Number(cs(s).opacity)]),
      car: Number(cs('.ignition-car-hero .car-layers').opacity)
    };
  });
  expect(dark.phase, 'sampled inside BLACKOUT').toBe('phase-blackout');
  for (const [sel, v] of dark.hidden) expect(v, sel).toBe('hidden');
  for (const [sel, o] of dark.fx) expect(o, sel).toBeLessThan(0.02);
  expect(dark.car).toBeLessThan(0.05);
  const lumBlack = await snap(page, '21_blackout.png');
  expect(await phaseOf(page), 'screenshot was taken inside BLACKOUT').toBe('phase-blackout');
  expect(lumBlack, `blackout luminance ${lumBlack}`).toBeLessThan(10);
  expect(lumPower, 'FULL POWER must be much brighter than blackout').toBeGreaterThan(lumBlack * 3);

  await waitPhase(page, 'phase-reveal');
  // sample at fixed offsets from the start of phase-reveal (screenshots themselves cost ~100ms)
  const sinceReveal = () => page.evaluate(() => {
    const r = window.__marks.find(m => /phase-reveal/.test(m.cls));
    return r ? performance.now() - r.t : 0;
  });
  const at = async ms => { for (let i = 0; i < 400 && (await sinceReveal()) < ms; i++) await page.waitForTimeout(15); };
  await at(40);
  const lumSilhouette = await snap(page, '22_silhouette.png');
  await at(560);
  const lumLight = await snap(page, '23_light_reveal.png');
  await at(1400);
  const lumHero = await snap(page, '24_complete_hero.png');
  expect(await page.locator('#ignitionSequence').getAttribute('data-phase'), 'hero is shown before the copy').toBe('phase-reveal');
  expect(lumSilhouette).toBeLessThan(lumLight);
  expect(lumLight).toBeLessThan(lumHero);
  expect(lumSilhouette, 'silhouette stage is still dark').toBeLessThan(lumHero * 0.7);
  // text only arrives after the hero has been shown
  expect(await op(page, '#ignitionFinal')).toBeLessThan(0.05);

  await waitPhase(page, 'phase-final');
  await page.waitForTimeout(700);
  await snap(page, '25_final_copy.png');
  await expect(page.locator('#ignitionFinal h2')).toHaveText('スタンプラリー クリア！');
  await expect(page.locator('#ignitionFinal p')).toHaveText('マシン完成！');
  // no dev-status texts, no constant fire in the final
  const copy = await page.locator('#ignitionSequence').innerText();
  expect(copy).not.toMatch(/HIGH RPM|HEADLIGHTS|アフターファイヤー|AFTERFIRE/i);
  expect(await op(page, '.afterfire-orange-left')).toBeLessThan(0.02);
  expect(await op(page, '.headlight-left')).toBeLessThan(0.45);

  // the car is the main character: not overlapped by the copy panel, fully inside the horizontal frame
  const car = await page.locator('#ignitionCarHero .car-layers').boundingBox();
  const panel = await page.locator('#ignitionFinal').boundingBox();
  expect(car.y + car.height, 'car must not be covered by the copy panel').toBeLessThanOrEqual(panel.y + 1);
  expect(await op(page, '#ignitionSequence .ignition-car-hero .car-layers')).toBeGreaterThan(0.98);

  // ---- measured rhythm ----
  const ms = await marks(page);
  const t = re => firstWith(ms, re)?.t;
  const run = t(/phase-run/), flash = t(/is-flash/), black = t(/phase-blackout/), reveal = t(/phase-reveal/), final = t(/phase-final/);
  const flashLen = black - flash;
  const blackLen = reveal - black;
  const heroHold = final - reveal;
  console.log('RHYTHM_MS', JSON.stringify({ powerToFlash: Math.round(flash - run), flash: Math.round(flashLen), blackout: Math.round(blackLen), revealToFinal: Math.round(heroHold), runToFinal: Math.round(final - run) }));
  expect(flashLen).toBeGreaterThan(100); expect(flashLen).toBeLessThan(240);        // impact only, never a held white screen
  expect(blackLen).toBeGreaterThan(520); expect(blackLen).toBeLessThan(820);        // 0.5-0.8s of "...?"
  expect(heroHold).toBeGreaterThan(1500); expect(heroHold).toBeLessThan(2400);      // car is admired before the copy
  expect(errors).toEqual([]);
  fs.writeFileSync(path.join(QA_DIR, 'finale_rhythm.json'), JSON.stringify({ flashLen, blackLen, heroHold, lumPower, lumBlack, lumSilhouette, lumLight, lumHero }, null, 2));
});

test('finale at 390x780 (LINE in-app) keeps the whole car in frame under the copy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await seed6of6(page);
  await page.goto(`${BASE}?station=engine&src=qa`, { waitUntil: 'domcontentloaded' });
  await waitPhase(page, 'phase-final');
  await page.waitForTimeout(700);
  await snap(page, '26_final_390x780.png');
  const car = await page.locator('#ignitionCarHero .car-layers').boundingBox();
  const panel = await page.locator('#ignitionFinal').boundingBox();
  expect(car.y + car.height).toBeLessThanOrEqual(panel.y + 1);
  expect(panel.y + panel.height).toBeLessThanOrEqual(780);
  const h2 = await page.locator('#ignitionFinal h2').boundingBox();
  expect(h2.x).toBeGreaterThanOrEqual(0); expect(h2.x + h2.width).toBeLessThanOrEqual(390);   // "スタンプラリー クリア！" fits on one line
  expect(h2.height).toBeLessThan(60);
});

test('repeat / mash: reload during the sequence, and close mid-blackout leaves no stale timers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed6of6(page);
  for (let i = 0; i < 3; i++) await page.goto(`${BASE}?station=engine&src=qa${i}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#ignitionSequence')).toHaveCount(1);
  await waitPhase(page, 'phase-blackout');
  // close while dark (programmatic click: the button is hidden on purpose during blackout)
  await page.evaluate(() => document.getElementById('ignitionClose').click());
  await expect(page.locator('#ignitionSequence')).not.toHaveClass(/show/);
  await page.waitForTimeout(3000); // the old reveal/final timers must NOT revive the sequence
  const cls = await page.locator('#ignitionSequence').getAttribute('class');
  expect(cls).not.toMatch(/show|phase-reveal|phase-final|phase-blackout/);
  expect(await page.evaluate(() => document.body.classList.contains('ignition-active'))).toBe(false);
  await expect(page.locator('#engineTitle')).toHaveText('COMPLETE');
  // 6/6 state: completed garage look is applied on the main page
  expect(await page.evaluate(() => document.body.classList.contains('mission-complete'))).toBe(true);
  const bg = await page.locator('#carStage').evaluate(el => getComputedStyle(el).backgroundImage);
  expect(bg).toContain('garage_complete_glow.webp');
});

test('reduced motion keeps the rhythm (power -> short dark -> car -> clear) without staggered motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await recordPhases(page);
  await seed6of6(page);
  await page.goto(`${BASE}?station=engine&src=qa-reduced`, { waitUntil: 'domcontentloaded' });
  await waitPhase(page, 'phase-final', 9000);
  await page.waitForTimeout(300);
  const ms = await marks(page);
  const order = ['phase-run', 'phase-blackout', 'phase-reveal', 'phase-final'].map(p => firstWith(ms, new RegExp(p))?.t);
  expect(order.every(Boolean)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  expect(order[2] - order[1], 'short dark').toBeGreaterThan(150);
  expect(order[2] - order[1], 'short dark').toBeLessThan(500);
  expect(order[3] - order[0], 'whole reduced finale is shorter').toBeLessThan(2400);
  await expect(page.locator('#ignitionFinal h2')).toHaveText('スタンプラリー クリア！');
  expect(await op(page, '#ignitionSequence .ignition-car-hero .car-layers')).toBeGreaterThan(0.98);
  expect(await op(page, '.afterfire-orange-left')).toBeLessThan(0.02);
});

[executed on device: ikegamiryuusukenoMacBook-Air.local (f424c449-4795-4c08-b192-30c07117f2c8)]