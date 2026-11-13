const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const url=pathToFileURL(path.resolve('jounaisetumei-core.html')).href;
const sizes=[{width:1194,height:834},{width:834,height:1194},{width:375,height:812},{width:320,height:568}];
test.use({reducedMotion:'reduce'});
async function noScroll(page,label){
  await page.waitForTimeout(820);
  const report=await page.evaluate(()=>{
    const root=document.querySelector('#exitGuideV2'),bar=document.querySelector('#eg-final-languages');
    const active=root.querySelector('.eg-page:not([hidden])');
    const candidates=[...active.querySelectorAll('.eg-intro,.eg-options,.eg-choice,.eg-bottom,.eg-header,.eg-detail-title,.eg-detail-lead,.eg-question,.eg-answer,.eg-stepper-progress,.eg-step:not([hidden]),.eg-stepper-pin,.eg-hint:not([hidden]),.eg-actions,.eg-stepper-controls,.eg-no-case h2,.eg-no-case p')].filter(el=>{
      const cs=getComputedStyle(el);
      return el.getClientRects().length&&cs.display!=='none'&&cs.visibility!=='hidden';
    });
    const bounds=candidates.map(el=>({name:el.className,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,clipped:el.classList.contains('eg-step')&&el.scrollHeight>el.clientHeight+3}));
    const bad=bounds.filter(e=>e.top< -2||e.bottom>innerHeight+2||e.clipped);
    const buttons=[...bar.querySelectorAll('button')].map(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {lang:el.dataset.locale,height:r.height,width:r.width,covered:hit!==el&&!el.contains(hit),clipped:el.scrollWidth>el.clientWidth+2||el.scrollHeight>el.clientHeight+2}});
    return {rootOverflow:getComputedStyle(root).overflowY,docOverflow:getComputedStyle(document.documentElement).overflowY,bodyOverflow:getComputedStyle(document.body).overflowY,rootScroll:root.scrollHeight-root.clientHeight,scrollX:document.documentElement.scrollWidth-innerWidth,bad,buttons,lang:root.dataset.lang};
  });
  expect(report.rootOverflow,label).toBe('hidden');
  expect(report.bodyOverflow,label).toBe('hidden');
  expect(report.docOverflow,label).toBe('hidden');
  expect(report.rootScroll,label).toBe(0);
  expect(report.scrollX,label).toBeLessThanOrEqual(1);
  expect(report.bad,label+' offscreen or clipped').toEqual([]);
  expect(report.buttons,label+' language count').toHaveLength(8);
  expect(report.buttons.filter(b=>b.covered||b.clipped||b.height<56||b.width<48),label+' broken language hitboxes').toEqual([]);
}
for(const size of sizes){
 test('venue truly one screen '+size.width+'x'+size.height,async({page})=>{
  await page.setViewportSize(size);await page.goto(url);
  await page.locator('#eg-final-languages button').first().waitFor();
  const root=page.locator('#exitGuideV2');
  for(const lang of ['ja','en','zh','vi','ko','ne','tl','my']){
    await page.locator('[data-locale="'+lang+'"]').click();
    await noScroll(page,'home '+lang+' '+size.width);
  }
  for(const route of ['family','adult-yes','adult-no','leave']){
    await page.goto(url);
    if(route.startsWith('adult'))await root.locator('[data-guide="adult"]').click();
    await root.locator('[data-guide="'+route+'"]').click();
    const steps=route==='family'?3:route==='adult-yes'||route==='leave'?2:1;
    for(let i=0;i<steps;i++){
      await noScroll(page,route+' step '+(i+1)+' '+size.width);
      if(i<steps-1)await root.locator('[data-stepper-action="next"]').click();
    }
  }
 });
}
