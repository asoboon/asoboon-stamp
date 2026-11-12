const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const target=pathToFileURL(path.resolve('jounaisetumei-core.html')).href;

test('v7: 72px language buttons, 56px kiosk controls, all sizes with no clipping',async({page})=>{
 for(const [width,height,minFont] of [[320,640,18],[375,812,20],[834,1194,20],[1024,768,20],[1194,834,20],[1440,900,20]]){
  await page.setViewportSize({width,height});
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#eg-final-languages button')).toHaveCount(8);
  await page.waitForTimeout(660);
  const r=await page.evaluate(()=>{
   const nav=document.querySelector('#eg-final-languages');
   const root=document.getElementById('exitGuideV2');
   const buttons=[...nav.querySelectorAll('button')];
   const controls=[document.getElementById('eg-audio-toggle'),document.getElementById('eg-audio-volume'),root.querySelector('.eg-home .eg-motion-switch'),root.querySelector('.eg-home .eg-fullscreen-switch')];
   return {buttons:buttons.map(x=>({h:x.getBoundingClientRect().height,w:x.getBoundingClientRect().width,font:parseFloat(getComputedStyle(x).fontSize),clipped:x.scrollWidth>x.clientWidth+1||x.scrollHeight>x.clientHeight+1})),
    controls:controls.map(x=>({h:x.getBoundingClientRect().height,w:x.getBoundingClientRect().width})),
    pageW:document.documentElement.scrollWidth};
  });
  for(const x of r.buttons){expect(x.h).toBeGreaterThanOrEqual(70);expect(x.w).toBeGreaterThanOrEqual(48);expect(x.font).toBeGreaterThanOrEqual(minFont);expect(x.clipped).toBe(false);}
  for(const x of r.controls){expect(x.h).toBeGreaterThanOrEqual(52);expect(x.w).toBeGreaterThanOrEqual(48);}
  expect(r.pageW).toBeLessThanOrEqual(width+1);
 }
});

test('v7: click cue short; voice starts on user tap; 540ms cinema finishes without truncation',async({page})=>{
 await page.addInitScript(()=>{
  const events=[];
  window.__HIME_V7_EVENTS__=events;
  const p=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){events.push({type:'voice.play',t:performance.now(),src:(this.src||'').slice(-70)});return p.apply(this,args)};
  const o=OscillatorNode.prototype.start;
  OscillatorNode.prototype.start=function(...args){events.push({type:'osc.start',t:performance.now()});return o.apply(this,args)};
  document.addEventListener('click',e=>{
   const btn=e.target.closest('button[data-guide]');
   if(btn)events.push({type:'click',route:btn.dataset.guide,t:performance.now()});
  },true);
 });
 await page.setViewportSize({width:1194,height:834});
 await page.goto(target,{waitUntil:'domcontentloaded'});
 await page.locator('#eg-final-languages button').first().waitFor();
 await page.waitForTimeout(650);
 await page.locator('[data-guide="family"]').click();
 await expect(page.locator('#eg-cinema')).toHaveClass(/active/);
 await page.waitForTimeout(270);
 const mid=await page.evaluate(()=>{
  const cin=document.querySelector('#eg-cinema');
  const title=cin.querySelector('.cin-title');
  return {active:cin.classList.contains('active'),
   cssDuration:getComputedStyle(title).animationDuration,cssOpacity:Number(getComputedStyle(title).opacity),
   route:document.querySelector('#exitGuideV2').dataset.guideScreen,
   times:window.__HIME_V7_EVENTS__,
   owner:window.__ASOBOON_OWNER_VOICE__?.state?.()};
 });
 expect(mid.active).toBe(true);
 expect(mid.cssDuration).toBe('0.54s');
 expect(mid.cssOpacity).toBeGreaterThan(.05);
 expect(mid.route).toBe('family');
 const click=mid.times.find(e=>e.type==='click'&&e.route==='family');
 const voice=mid.times.find(e=>e.type==='voice.play');
 expect(voice).toBeTruthy();
 expect(voice.t-click.t).toBeGreaterThanOrEqual(0);
 expect(voice.t-click.t).toBeLessThan(170);
 expect(mid.times.filter(e=>e.type==='osc.start').length).toBeLessThanOrEqual(2);
 expect(mid.owner?.productionEnabled).toBe(true);
 await page.waitForTimeout(330);
 await expect(page.locator('#eg-cinema')).not.toHaveClass(/active/);
 await expect(page.locator('[data-stepper-action="next"]')).toBeVisible();
});

test('v7: receipt and holders animate at the actual displayed step, not during hidden steps',async({page})=>{
 await page.goto(target,{waitUntil:'domcontentloaded'});
 await page.locator('#eg-final-languages button').first().waitFor();
 await page.locator('[data-guide="family"]').click();
 await page.waitForTimeout(650);
 // Before reaching step 2/3, these props are hidden and must not have played.
 const hidden=await page.evaluate(()=>{
  const root=document.querySelector('#exitGuideV2');
  return ['.eg-receipt','.eg-two-holders'].map(sel=>{
   const e=root.querySelector(sel),step=e.closest('.eg-step');
   return {hidden:step.hidden,animation:getComputedStyle(e).animationName};
  });
 });
 expect(hidden).toEqual([{hidden:true,animation:'none'},{hidden:true,animation:'none'}]);
 await page.locator('[data-stepper-action="next"]').click();
 const receipt=await page.evaluate(()=>{
  const e=document.querySelector('#exitGuideV2 .eg-step:not([hidden]) .eg-receipt');
  return {exists:!!e,animation:e&&getComputedStyle(e).animationName,visible:e&&!e.closest('.eg-step').hidden};
 });
 expect(receipt).toEqual({exists:true,animation:'eg-delight-peek',visible:true});
 await page.locator('[data-stepper-action="next"]').click();
 const holder=await page.evaluate(()=>{
  const e=document.querySelector('#exitGuideV2 .eg-step:not([hidden]) .eg-two-holders');
  return {exists:!!e,animation:e&&getComputedStyle(e).animationName,visible:e&&!e.closest('.eg-step').hidden};
 });
 expect(holder).toEqual({exists:true,animation:'eg-delight-holders',visible:true});
});

test('v7: motion off respects visitor preference and renders instruction immediately',async({page})=>{
 await page.goto(target,{waitUntil:'domcontentloaded'});
 await page.locator('#eg-final-languages button').first().waitFor();
 await page.locator('[data-motion-toggle]').click();
 await page.locator('[data-guide="family"]').click();
 await expect(page.locator('#exitGuideV2')).toHaveAttribute('data-guide-screen','family');
 await expect(page.locator('#eg-cinema')).not.toHaveClass(/active/);
 await expect(page.locator('[data-stepper-action="next"]')).toBeVisible();
 await page.locator('[data-stepper-action="next"]').click();
 const anim=await page.locator('#exitGuideV2 .eg-step:not([hidden]) .eg-receipt').evaluate(e=>getComputedStyle(e).animationName);
 expect(anim).toBe('none');
});
