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
  await expect(cin).toHaveAttribute('data-played','true');
  const state=await page.evaluate(()=>({v5:!!window.__asoboonExitGuideV5,played:document.querySelector('#eg-cinema')?.dataset.played,particles:document.querySelector('#eg-cinema')?.dataset.particleCount}));
  expect(state).toEqual({v5:true,played:'true',particles:'190'});
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
    document.body.append(overlay);
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


test('横向きiPadで3択だけを全画面表示し、旧退場時間画面を表示しない',async({page})=>{
  await page.setViewportSize({width:1194,height:834});
  await page.goto(target);
  const guide=page.locator('#exitGuideV2');
  await expect(guide).toBeVisible();
  await expect(page.locator('main.app')).toBeHidden();
  await expect(page.locator('#timeView')).toHaveCount(0);
  await expect(guide.locator('[data-guide="time"]')).toHaveCount(0);
  await expect(guide.locator('[data-guide="family"]')).toBeVisible();
  await expect(guide.locator('[data-guide="adult"]')).toBeVisible();
  await expect(guide.locator('[data-guide="leave"]')).toBeVisible();
  const view=await page.evaluate(()=>{
    const r=document.querySelector('#exitGuideV2').getBoundingClientRect();
    const cards=[...document.querySelectorAll('.eg-choice')].map(e=>e.getBoundingClientRect());
    return {x:r.x,y:r.y,w:r.width,h:r.height,viewportW:innerWidth,viewportH:innerHeight,
      cardBounds:cards.map(c=>({left:c.left,right:c.right,top:c.top,bottom:c.bottom}))};
  });
  expect(view.x).toBe(0);expect(view.y).toBe(0);
  expect(view.w).toBe(view.viewportW);expect(view.h).toBe(view.viewportH);
  for(const c of view.cardBounds){
    expect(c.left).toBeGreaterThanOrEqual(0);
    expect(c.right).toBeLessThanOrEqual(view.viewportW+1);
    expect(c.top).toBeGreaterThanOrEqual(0);
    expect(c.bottom).toBeLessThanOrEqual(view.viewportH+1);
  }
  await page.locator('#eg-final-languages [data-locale="en"]').click();
  await expect(guide.locator('.eg-intro h1')).toHaveText('Leaving & returning');
  await expect(guide.locator('[data-kiosk-fullscreen]')).toContainText('Full screen');
});
test('全画面操作がブラウザAPIを呼び、非対応環境でも案内を表示する',async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await page.goto(target);
  const guide=page.locator('#exitGuideV2');
  await expect(guide.locator('[data-kiosk-fullscreen]')).toBeVisible();
  await page.evaluate(()=>{
    document.documentElement.requestFullscreen=undefined;
    document.documentElement.webkitRequestFullscreen=undefined;
  });
  await guide.locator('[data-kiosk-fullscreen]').click();
  await expect(page.locator('#eg-landscape-fullscreen-tip')).toContainText('ホーム画面に追加');
  await expect(guide).toBeVisible();
});
test('横画面でも8言語とV5の全画面演出を維持',async({page})=>{
  await page.setViewportSize({width:1024,height:768});
  await page.goto(target);
  await page.locator('#eg-final-languages [data-locale="ko"]').click();
  await expect(page.locator('#exitGuideV2 .eg-intro h1')).toContainText('외출 및 재입장 안내');
  await page.locator('#exitGuideV2 [data-guide="adult"]').click();
  await expect(page.locator('#eg-cinema')).toHaveAttribute('data-played','true');
  await expect(page.locator('#exitGuideV2')).toContainText('노란색 홀더를 가지고 계신가요?',{timeout:5000});
});
test('音ON/OFFと8言語の音声が即時案内を妨げない',async({page})=>{
  await page.goto(target);
  const guide=page.locator('#exitGuideV2');
  const audio=page.locator('#eg-audio-toggle');
  await expect(audio).toBeVisible();
  await expect(audio).toHaveAttribute('aria-pressed','true');
  const audioAssets=['ui-tap.mp3','ultimate-ready.mp3','judge-critical.mp3','judge-super.mp3','miss.mp3'];
  for(const asset of audioAssets)expect(require('node:fs').existsSync(path.resolve('assets/audio/runtime/common',asset))).toBe(true);
  for(const lang of ['ja','en','zh','vi','ko','ne','tl','my']){
    await page.locator('#eg-final-languages [data-locale="'+lang+'"]').click();
    const text=await page.evaluate(lang=>window.__ASOBOON_AUDIO__?.prompt('family',lang),lang);
    expect(typeof text).toBe('string');expect(text.trim().length).toBeGreaterThan(8);
  }
  await page.locator('#eg-final-languages [data-locale="en"]').click();
  await expect(audio).toContainText('Sound ON');
  await audio.click();
  await expect(audio).toContainText('Sound OFF');
  await expect(audio).toHaveAttribute('aria-pressed','false');
  await audio.click();
  const state=await page.evaluate(()=>window.__ASOBOON_AUDIO__?.state());
  expect(state.enabled).toBe(true);
  expect(state.locale).toBe('en');
  expect(state.durationMs).toBe(310);
  await guide.locator('[data-guide="family"]').click();
  await expect(guide).toContainText('Remove the receipt from the RED holder');
  expect(await page.evaluate(()=>window.__ASOBOON_AUDIO__?.state().lastDestination)).toBe('family');
  await expect(guide.locator('[data-guide="time"]')).toHaveCount(0);
});

test('ボタンを押した同じ処理内で説明へ切り替わる',async({page})=>{
  await page.goto(target);
  const immediate=await page.evaluate(()=>{
    const begin=performance.now();
    document.querySelector('#exitGuideV2 [data-guide="adult"]').click();
    return {
      elapsed:performance.now()-begin,
      hasQuestion:document.querySelector('#exitGuideV2')?.innerText.includes('黄色ホルダーを持っていますか？'),
      screen:window.__ASOBOON_CINEMA_TEST__?.screen(),
      played:document.querySelector('#eg-cinema')?.dataset.played
    };
  });
  expect(immediate.hasQuestion).toBe(true);
  expect(immediate.screen).toBe('adult');
  expect(immediate.played).toBe('true');
  expect(immediate.elapsed).toBeLessThan(400);
  await expect(page.locator('#exitGuideV2 [data-guide="adult-no"]')).toBeVisible();
  await page.locator('#exitGuideV2 [data-guide="adult-no"]').click();
  await expect(page.locator('#exitGuideV2')).toContainText('外出前に受付スタッフへ確認してください。');
});

test('音量スライダーで効果音を調節できる・音声設定も維持',async({page})=>{
  await page.goto(target);
  const guide=page.locator('#exitGuideV2');
  const audio=page.locator('#eg-audio-toggle');
  const slider=page.locator('#eg-audio-volume');
  await expect(audio).toBeVisible();
  await expect(slider).toBeVisible();
  await expect(slider).toHaveValue('100');
  await expect(page.locator('#eg-audio-volume-value')).toHaveText('100%');
  let sound=await page.evaluate(()=>window.__ASOBOON_AUDIO__?.state());
  expect(sound.volumeLevel).toBe(100);
  expect(sound.boostGain).toBeCloseTo(2.2,3);
  expect(sound.outputGain).toBeCloseTo(.92,3);
  await audio.click();await audio.click(); // Unlock the real AudioContext for gain smoothing.
  await slider.evaluate(node=>{node.value='20';node.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.locator('#eg-audio-volume-value')).toHaveText('20%');
  await expect.poll(async()=>page.evaluate(()=>window.__ASOBOON_AUDIO__.state().outputGain)).toBeCloseTo(.184,3);
  sound=await page.evaluate(()=>window.__ASOBOON_AUDIO__?.state());
  expect(sound.boostGain).toBeCloseTo(2.2,3);
  expect(sound.outputTarget).toBeCloseTo(.184,3);
  expect(sound.previewCount).toBe(0);
  await page.locator('#eg-final-languages [data-locale="en"]').click();
  await expect(slider).toHaveAttribute('aria-label','FX volume');
  await expect(audio).toContainText('Sound ON');
  await guide.locator('[data-guide="adult"]').click();
  await expect(guide).toContainText('Do you have a YELLOW holder?');
  await expect(slider).toBeVisible();
  await audio.click();
  await expect(audio).toHaveAttribute('aria-pressed','false');
  await expect(slider).toHaveValue('20');
  await expect.poll(async()=>page.evaluate(()=>window.__ASOBOON_AUDIO__.state().outputGain)).toBeCloseTo(0,3);
  await audio.click();
  await expect(audio).toHaveAttribute('aria-pressed','true');
  await guide.locator('[data-guide="home"]').first().click();
  await expect(slider).toBeVisible();
  await expect(guide.locator('[data-guide="time"]')).toHaveCount(0);
});

test('効果音プレビューはドラッグ中に鳴らず、離した時だけ短く鳴る・ミュート中は無音',async({page})=>{
  await page.goto(target);
  const slider=page.locator('#eg-audio-volume');
  const box=await slider.boundingBox();
  await page.mouse.move(box.x+box.width-5,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.4,box.y+box.height/2,{steps:5});
  expect(await page.evaluate(()=>window.__ASOBOON_AUDIO__.state().previewCount)).toBe(0);
  await page.mouse.up();
  expect(await page.evaluate(()=>window.__ASOBOON_AUDIO__.state().previewCount)).toBe(1);
  await page.locator('#eg-audio-toggle').click();
  await slider.focus();
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(()=>window.__ASOBOON_AUDIO__.state().previewCount)).toBe(1);
  await page.evaluate(()=>window.__ASOBOON_AUDIO__.resetForNextVisitor());
  const state=await page.evaluate(()=>window.__ASOBOON_AUDIO__.state());
  expect(state.enabled).toBe(true);
  expect(state.previewCount).toBe(1); // Reset/unmute never plays a test sound.
});

test('実WebAudioレンダリングでFXのピークを抑え、20%を最大より十分静かにする',async({page})=>{
  // Real browser DSP, rendered offline: exercises the production graph and MP3
  // cues without sending test sounds to speakers or mocking audio nodes.
  await page.addInitScript(()=>{
    window.AudioContext=function(){
      return window.__offlineAudio=new OfflineAudioContext(1,48000,48000);
    };
  });
  await page.route('http://audio.test/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/'){
      const level=url.searchParams.get('level')==='20'?20:100;
      await route.fulfill({contentType:'text/html',body:`<!doctype html><div id="exitGuideV2"></div><div id="eg-cinema"></div><script src="/jounaisetumei-audio.js"></script><script>window.__ASOBOON_AUDIO__.setVolume(${level});</script>`});
    }else if(url.pathname==='/jounaisetumei-audio.js'||/^\/assets\/audio\/runtime\/common\/[a-z-]+\.mp3$/.test(url.pathname)){
      await route.fulfill({path:path.resolve('.'+url.pathname)});
    }else await route.abort();
  });
  async function render(level,overload=false){
    await page.goto('http://audio.test/?level='+level);
    await expect.poll(async()=>page.evaluate(()=>window.__ASOBOON_AUDIO__.state().cachedSounds)).toBe(5);
    return page.evaluate(async overload=>{
      // Stress overlapping cues by scheduling repeatedly on the offline clock.
      // The normal start() cancels previous scenes, so retain scheduled sources
      // by using repeated slider commits for the overload case instead.
      if(overload){
        for(let i=0;i<100;i++)document.querySelector('#eg-audio-volume').dispatchEvent(new Event('change'));
      }else window.__ASOBOON_AUDIO__.start('family');
      const rendered=await window.__offlineAudio.startRendering();
      const data=rendered.getChannelData(0);
      let peak=0,sum=0;
      for(const sample of data){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}
      return {peak,rms:Math.sqrt(sum/data.length),failures:window.__ASOBOON_AUDIO__.state().failures};
    },overload);
  }
  const full=await render(100),low=await render(20),overload=await render(100,true);
  expect(full.failures).toBe(0);expect(low.failures).toBe(0);expect(overload.failures).toBe(0);
  expect(full.rms).toBeGreaterThan(.01);
  expect(full.peak).toBeLessThan(.877);
  expect(low.rms/full.rms).toBeCloseTo(.2,2);
  expect(low.peak/full.peak).toBeCloseTo(.2,2);
  expect(overload.peak).toBeGreaterThan(.1);
  expect(overload.peak).toBeLessThan(.877);
});

// Run micro-theater regression in the existing mandatory V5 browser CI job.
require('./asoboon-venue-tablet-delight-cases.cjs');

require('./asoboon-venue-tablet-stepper-cases.cjs');
