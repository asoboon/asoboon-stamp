const {test:voiceTest,expect:voiceExpect}=require('@playwright/test');
const audioPath=require('node:path');
const {pathToFileURL}=require('node:url');
const audioUrl=pathToFileURL(audioPath.resolve('jounaisetumei-core.html')).href;
voiceTest.describe('venue tablet per-step SFX and localized voice',()=>{
  voiceTest.use({viewport:{width:1194,height:834},reducedMotion:'no-preference'});
  voiceTest.beforeEach(async({page})=>{
    await page.addInitScript(()=>{
      window.__spoken=[];
      window.__cancelCount=0;
      const voices=['ja-JP','en-US','zh-CN','vi-VN','ko-KR','ne-NP','fil-PH','my-MM'].map(lang=>({lang,name:'Test-'+lang}));
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
        getVoices:()=>voices,
        cancel:()=>window.__cancelCount++,
        speak:utter=>window.__spoken.push({text:utter.text,lang:utter.lang,volume:utter.volume})
      }});
      window.SpeechSynthesisUtterance=class SpeechSynthesisUtterance{
        constructor(text){this.text=text;}
      };
    });
    await page.goto(audioUrl);
  });

  voiceTest('first choice speaks only STEP 1; Next/back changes voice and plays light cue',async({page})=>{
    const root=page.locator('#exitGuideV2');
    await root.locator('[data-guide="family"]').click();
    const initial=await page.evaluate(()=>({last:window.__spoken.at(-1),audio:window.__ASOBOON_AUDIO__.state()}));
    voiceExpect(initial.last.text).toContain('ロッカーの荷物を全部出す');
    voiceExpect(initial.last.text).not.toContain('レシートは大切に持っていてね');
    voiceExpect(initial.last.text).toContain('一時退場中も利用時間は進みます。');
    await root.locator('[data-stepper-action="next"]').click();
    const second=await page.evaluate(()=>({last:window.__spoken.at(-1),audio:window.__ASOBOON_AUDIO__.state()}));
    voiceExpect(second.last.text).toContain('赤ホルダーからレシートを抜く');
    voiceExpect(second.last.text).not.toContain('ロッカーの荷物を全部出す');
    voiceExpect(second.audio.lastDestination).toBe('family-step');
    await root.locator('[data-stepper-action="next"]').click();
    const third=await page.evaluate(()=>window.__spoken.at(-1).text);
    voiceExpect(third).toContain('ホルダーと鍵をすべて返す');
    voiceExpect(third).toContain('受付でレシートを見せてください');
    await root.locator('[data-stepper-action="prev"]').click();
    const previous=await page.evaluate(()=>({last:window.__spoken.at(-1).text,spoken:window.__spoken.length,cancels:window.__cancelCount}));
    voiceExpect(previous.last).toContain('赤ホルダーからレシートを抜く');
    voiceExpect(previous.spoken).toBe(4);
    voiceExpect(previous.cancels).toBeGreaterThan(3);
  });

  voiceTest('all eight languages speak their translated first step on real taps',async({page})=>{
    const cases=[
      ['ja','ja-JP','ロッカーの荷物'],
      ['en','en-US','locker'],
      ['zh','zh-CN','储物柜'],
      ['vi','vi-VN','tủ'],
      ['ko','ko-KR','사물함'],
      ['ne','ne-NP','लकर'],
      ['tl','fil-PH','locker'],
      ['my','my-MM','လော့ကာ']
    ];
    const root=page.locator('#exitGuideV2');
    for(const [language,langTag,needle] of cases){
      await page.locator('#eg-final-languages [data-locale="'+language+'"]').click();
      await root.locator('[data-guide="family"]').click();
      const info=await page.evaluate(()=>window.__spoken.at(-1));
      voiceExpect(info.lang).toBe(langTag);
      voiceExpect(info.text).toContain(needle);
      voiceExpect(info.volume).toBe(1);
      await root.locator('[data-guide="home"]').first().click();
    }
  });

  voiceTest('mute silences both audio and voice, then resumes on explicit tap',async({page})=>{
    const root=page.locator('#exitGuideV2');
    await root.locator('[data-guide="family"]').click();
    const firstCount=await page.evaluate(()=>window.__spoken.length);
    await page.locator('#eg-audio-toggle').click();
    await root.locator('[data-stepper-action="next"]').click();
    const muted=await page.evaluate(()=>({count:window.__spoken.length,audio:window.__ASOBOON_AUDIO__.state()}));
    voiceExpect(muted.count).toBe(firstCount);
    voiceExpect(muted.audio.enabled).toBe(false);
    await page.locator('#eg-audio-toggle').click();
    await root.locator('[data-stepper-action="next"]').click();
    const after=await page.evaluate(()=>({count:window.__spoken.length,latest:window.__spoken.at(-1).text}));
    voiceExpect(after.count).toBe(firstCount+1);
    voiceExpect(after.latest).toContain('ホルダーと鍵をすべて返す');
  });

  voiceTest('leaving warns no re-entry aloud; no-holder warning keeps its own spoken guidance',async({page})=>{
    const root=page.locator('#exitGuideV2');
    await root.locator('[data-guide="leave"]').click();
    const leaveFirst=await page.evaluate(()=>window.__spoken.at(-1).text);
    voiceExpect(leaveFirst).toContain('再入場はできません。');
    await root.locator('[data-stepper-action="next"]').click();
    const leaveLast=await page.evaluate(()=>window.__spoken.at(-1).text);
    voiceExpect(leaveLast).toContain('再入場はできません。');
    await root.locator('[data-guide="home"]').first().click();
    await root.locator('[data-guide="adult"]').click();
    await root.locator('[data-guide="adult-no"]').click();
    const warning=await page.evaluate(()=>({last:window.__spoken.at(-1).text,route:window.__ASOBOON_AUDIO__.state().lastDestination}));
    voiceExpect(warning.route).toBe('adult-no');
    voiceExpect(warning.last).toContain('受付スタッフに確認');
  });
});
