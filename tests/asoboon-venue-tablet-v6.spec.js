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
  await expect(page.locator('#eg-cinema')).toBeHidden();
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
  await expect(page.locator('#tabletCore')).toHaveAttribute('src',/jounaisetumei-core\.html\?tablet_release=v5-step-sound-voice-20261016-r100/);
  const source=await page.locator('body').textContent();
  expect(source).not.toMatch(/退場時間|asoboon-calendar/);
  await expect(page.frameLocator('#tabletCore').locator('#exitGuideV2')).toBeVisible();
});

const touchSizes=[
  ['iPad landscape',1194,834,8],
  ['iPad portrait',834,1194,5],
  ['small iPad',1024,768,8],
  ['phone',375,812,5],
  ['small phone',320,640,5],
  ['desktop',1440,900,8]
];

for(const [name,width,height,columns] of touchSizes){
  test('v6 kiosk touch targets / no overlap / multilingual taps: '+name,async({page})=>{
    await page.setViewportSize({width,height});
    await page.goto(target,{waitUntil:'domcontentloaded'});
    const bar=page.locator('#eg-final-languages');
    await expect(bar.locator('button')).toHaveCount(8);
    // Wait for the existing 0.55s entrance animation before measuring stable hit targets.
    await page.waitForTimeout(650);
    const qa=await page.evaluate(()=>{
      const nav=document.querySelector('#eg-final-languages');
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
      const buttons=[...nav.querySelectorAll('button')];
      const rects=[
        ['language',nav],['volume',document.getElementById('eg-audio-volume-pack')],
        ['motion',document.querySelector('.eg-home .eg-motion-switch')],
        ['fullscreen',document.querySelector('.eg-home .eg-fullscreen-switch')],
        ['title',document.querySelector('.eg-home h1')]
      ].filter(([_,e])=>!!e).map(([n,e])=>({name:n,...box(e)}));
      const collisions=[];
      for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
        let a=rects[i],b=rects[j];
        if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 &&
           Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)collisions.push(a.name+'/'+b.name);
      }
      const fit=buttons.map(b=>{
        const x=box(b),hit=document.elementFromPoint((x.x+x.right)/2,(x.y+x.bottom)/2);
        return {width:x.width,height:x.height,clipped:b.scrollWidth>b.clientWidth+2||b.scrollHeight>b.clientHeight+2,
          covered:!(hit===b||b.contains(hit)),fontSize:parseFloat(getComputedStyle(b).fontSize)};
      });
      const actions=[...document.querySelectorAll('.eg-home .eg-choice-action')].map(b=>{
        const s=getComputedStyle(b);
        return {width:box(b).width,height:box(b).height,fontSize:parseFloat(s.fontSize),
          clipped:b.scrollWidth>b.clientWidth+2||b.scrollHeight>b.clientHeight+2};
      });
      return {fit,collisions,columns:getComputedStyle(nav).gridTemplateColumns.split(' ').length,
        scrollWidth:document.documentElement.scrollWidth,width:innerWidth,actions};
    });
    expect(qa.columns,'language column count').toBe(columns);
    expect(qa.collisions,'controls must never overlap').toEqual([]);
    for(const button of qa.fit){
      expect(button.width,'button width').toBeGreaterThanOrEqual(48);
      expect(button.height,'button height').toBeGreaterThanOrEqual(52);
      expect(button.fontSize,'readable labels').toBeGreaterThanOrEqual(15);
      expect(button.clipped,'language must be fully legible').toBe(false);
      expect(button.covered,'button must receive tap').toBe(false);
    }
    expect(qa.scrollWidth,'unwanted horizontal overflow').toBeLessThanOrEqual(width+1);
    if(width<=420){
      expect(qa.actions).toHaveLength(3);
      for(const action of qa.actions){
        expect(action.height).toBeGreaterThanOrEqual(46);
        expect(action.clipped).toBe(false);
      }
    }
    await bar.locator('[data-locale="en"]').click();
    await expect(bar.locator('[data-locale="en"]')).toHaveAttribute('aria-pressed','true');
    await expect(bar.locator('[data-locale="ja"]')).toHaveAttribute('aria-pressed','false');
    await expect(page.locator('#exitGuideV2 .eg-intro h1')).toHaveText('Leaving & returning');
    await page.locator('#exitGuideV2 [data-guide="family"]').click();
    await expect(page.locator('#exitGuideV2')).toContainText('Remove the receipt',{timeout:3500});
    await page.locator('#exitGuideV2 [data-stepper-action="next"]').click();
    await expect(page.locator('#exitGuideV2 [data-stepper-action="prev"]')).toBeVisible();
  });
}

test('v6 kiosk language buttons come before action cards in keyboard order',async({page})=>{
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#eg-final-languages button')).toHaveCount(8);
  await page.keyboard.press('Tab');
  await expect(page.locator('#eg-final-languages [data-locale="ja"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#eg-final-languages [data-locale="en"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#eg-final-languages [data-locale="en"]')).toHaveAttribute('aria-pressed','true');
});

for(const [deviceWidth,deviceHeight] of [[375,812],[320,640]]){
  test('v6 foreign script controls and readable full-width CTAs at '+deviceWidth+'px',async({page})=>{
    await page.setViewportSize({width:deviceWidth,height:deviceHeight});
    await page.goto(target,{waitUntil:'domcontentloaded'});
    const bar=page.locator('#eg-final-languages');
    await expect(bar.locator('button')).toHaveCount(8);
    // The existing intro animation occupies the first 0.55 seconds of boot.
    await page.waitForTimeout(650);
    for(const lang of ['ja','en','zh','vi','ko','ne','tl','my']){
      await bar.locator('[data-locale="'+lang+'"]').click();
      await page.waitForTimeout(90);
      const ui=await page.evaluate(()=>{
        const root=document.querySelector('#exitGuideV2');
        const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};
        const els=[document.getElementById('eg-audio-volume-pack'),
          root.querySelector('.eg-home .eg-motion-switch'),
          root.querySelector('.eg-home .eg-fullscreen-switch'),
          root.querySelector('.eg-home .eg-intro h1')];
        const rects=els.map(box),overlaps=[];
        for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
          const a=rects[i],b=rects[j];
          if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 &&
             Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)overlaps.push([i,j]);
        }
        const cards=[...root.querySelectorAll('.eg-home [data-guide]')].slice(0,3);
        const content=cards.map(card=>{
          const r=box(card);
          const parts=['.eg-choice-title','.eg-choice-sub','.eg-choice-action'].map(sel=>{
            const el=card.querySelector(sel);const x=box(el);
            return {w:x.w,h:x.h,contained:x.x>=r.x-1&&x.right<=r.right+1,
              clipped:el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2};
          });
          return {parts};
        });
        const motion=els[1],fullscreen=els[2];
        return {lang:root.getAttribute('lang'),overflowX:getComputedStyle(root).overflowX,
          selected:[...document.querySelectorAll('#eg-final-languages [aria-pressed="true"]')].map(x=>x.dataset.locale),
          controls:rects,overlaps,content,
          aria:[motion.getAttribute('aria-label'),fullscreen.getAttribute('aria-label')],
          labels:[motion.textContent.replace(/\s+/g,' ').trim(),fullscreen.textContent.replace(/\s+/g,' ').trim()]};
      });
      expect(ui.lang).toBe(lang);
      expect(ui.selected).toEqual([lang]);
      expect(ui.overflowX).toBe('hidden');
      expect(ui.overlaps,'secondary controls overlap in '+lang).toEqual([]);
      expect(ui.controls[1].w).toBeGreaterThanOrEqual(48);
      expect(ui.controls[2].w).toBeGreaterThanOrEqual(48);
      expect(ui.aria,'translated aria for icon-only controls').toEqual(ui.labels);
      for(const card of ui.content){
        expect(card.parts).toHaveLength(3);
        for(const part of card.parts){
          expect(part.contained,'no content beyond card border').toBe(true);
          expect(part.clipped,'no translated text cropped').toBe(false);
        }
        expect(card.parts[2].h,'CTA height').toBeGreaterThanOrEqual(48);
      }
    }
  });
}


test('v6 translated middle-width toolbar controls never overlap',async({page})=>{
  for(const width of [421,500,600,650,768,834,901,1024,1194]){
    await page.setViewportSize({width,height:900});
    await page.goto(target,{waitUntil:'domcontentloaded'});
    await expect(page.locator('#eg-final-languages button')).toHaveCount(8);
    await page.waitForTimeout(650); // Existing 0.55-second entrance animation.
    for(const lang of ['ja','en','zh','vi','ko','ne','tl','my']){
      await page.locator('#eg-final-languages [data-locale="'+lang+'"]').click();
      const qa=await page.evaluate(()=>{
        const root=document.querySelector('#exitGuideV2');
        const els=[
          document.getElementById('eg-audio-volume-pack'),
          root.querySelector('.eg-home .eg-motion-switch'),
          root.querySelector('.eg-home .eg-fullscreen-switch'),
          root.querySelector('.eg-home .eg-intro h1')
        ];
        const rects=els.map(e=>e.getBoundingClientRect());
        const collisions=[];
        for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
          const a=rects[i],b=rects[j];
          if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 &&
             Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1){
            collisions.push([i,j]);
          }
        }
        const hit=els.slice(0,3).map(e=>{
          const x=e.getBoundingClientRect();
          const center=document.elementFromPoint(x.left+x.width/2,x.top+x.height/2);
          return e===center||e.contains(center);
        });
        return {lang:root.dataset.lang,collisions,hit};
      });
      expect(qa.lang).toBe(lang);
      expect(qa.collisions,'no overlapping localized controls at '+width+'px / '+lang).toEqual([]);
      expect(qa.hit,'center of toolbar should remain tappable at '+width+'px / '+lang).toEqual([true,true,true]);
    }
  }
});
