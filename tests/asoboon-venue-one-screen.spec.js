const {test,expect}=require('@playwright/test');
const target='file:///Users/ikegamiryuusuke/hime/jobs/venue-owner-voice-20261111-01/v9-kurmanji-fit-20261113/jounaisetumei.html';
const sizes=[[1194,834],[834,1194],[375,812],[320,568],[844,390]];
for(const [width,height] of sizes){
 test('v9 zero-scroll and visible actions '+width+'x'+height,async({page})=>{
  await page.setViewportSize({width,height});await page.goto(target,{waitUntil:'domcontentloaded'});const frame=page.frameLocator('#tabletCore');
  const visit=async screen=>{
    const root=frame.locator('#exitGuideV2');
    if(await root.getAttribute('data-guide-screen')!=='home'){await root.locator('[data-guide="home"]').first().click();}
    if(screen==='home'){}
    else if(screen==='adult-yes'||screen==='adult-no'){await frame.locator('#exitGuideV2 [data-guide="adult"]').first().click();await root.locator('[data-guide="'+screen+'"]').first().click();}
    else{await root.locator('[data-guide="'+screen+'"]').first().click();}
    await page.waitForTimeout(260);
    const state=await root.evaluate(el=>{
      const p=el.querySelector('.eg-page');
      el.scrollTop=42;document.documentElement.scrollTop=42;document.body.scrollTop=42;
      const visible=Array.from(p.querySelectorAll('button')).filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none');
      const outside=visible.filter(e=>{let r=e.getBoundingClientRect();return r.bottom>innerHeight+1||r.top<-1||r.left<-1||r.right>innerWidth+1}).map(e=>({text:e.textContent.trim().slice(0,34),rect:e.getBoundingClientRect().toJSON()}));
      const note=p.querySelector('.eg-note');
      return {screen:el.dataset.guideScreen,overflow:getComputedStyle(el).overflowY,rootTop:el.scrollTop,htmlTop:document.documentElement.scrollTop,bodyTop:document.body.scrollTop,outside,note:note?{display:getComputedStyle(note).display,bottom:note.getBoundingClientRect().bottom}:null,visibleButtons:visible.length};
    });
    expect(state.screen).toBe(screen);
    expect(state.overflow).toBe('clip');
    expect(state.rootTop).toBe(0);
    expect(state.outside).toEqual([]);
    if(screen==='home'&&width<=599)expect(state.note.display).not.toBe('none');
    return state;
  };
  await visit('home');
  await visit('family');
  await visit('leave');
  await visit('adult');
  await visit('adult-yes');
  await visit('adult-no');
  if(width<=599||height<=550){
   const trigger=frame.locator('#eg-kiosk-language-trigger');
   await expect(trigger).toBeVisible();
   await trigger.click();
   await expect(frame.locator('#eg-kiosk-language-dialog .eg-kiosk-lang-grid button')).toHaveCount(8);
   await frame.locator('#eg-kiosk-language-dialog [data-locale="en"]').click();
   await expect(frame.locator('#exitGuideV2')).toHaveAttribute('lang','en');
  }
 });
}

test('v9 resize into compact mode preserves language selection and usable choices',async({page})=>{
  await page.setViewportSize({width:1194,height:834});
  await page.goto(target,{waitUntil:'domcontentloaded'});
  const frame=page.frameLocator('#tabletCore');
  await expect(frame.locator('#eg-final-languages')).toBeVisible();
  await page.setViewportSize({width:375,height:812});
  const trigger=frame.locator('#eg-kiosk-language-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(frame.locator('#eg-kiosk-language-dialog [data-locale]')).toHaveCount(8);
  await frame.locator('#eg-kiosk-language-dialog [data-locale="en"]').click();
  await expect(frame.locator('#exitGuideV2')).toHaveAttribute('lang','en');
  await page.setViewportSize({width:1194,height:834});
  await expect(trigger).toBeHidden();
  await expect(frame.locator('#eg-final-languages')).toBeVisible();
  await expect(frame.locator('#exitGuideV2')).toHaveAttribute('lang','en');
  await page.setViewportSize({width:375,height:812});
  await expect(trigger).toBeVisible();
  await expect(frame.locator('#exitGuideV2 .eg-choice')).toHaveCount(3);
});
