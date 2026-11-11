const {test:voiceTest,expect:voiceExpect}=require('@playwright/test');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const audioUrl=pathToFileURL(path.resolve('jounaisetumei-core.html')).href;
const manifest=require('../assets/owner-voice/manifest.json');
const langs=['ja','en','zh','vi','ko','ne','tl','my'];

function expected(lang,route,step=null){
  const row=manifest.allPromptTexts[lang].find(x=>x.route===route&&(x.step||null)===(step||null));
  voiceExpect(row,'missing voice mapping '+lang+'/'+route+'/'+step).toBeDefined();
  return row;
}
async function snapshot(page){
  return page.evaluate(()=>({
    state:window.__ASOBOON_OWNER_VOICE__.state(),
    plays:window.__ownerPlayed.slice(),
    pauses:window.__ownerPaused.slice(),
    oldSpeech:window.__oldSpeech.length,
    sfx:window.__ASOBOON_AUDIO__.state()
  }));
}
function checkPlay(snap,lang,route,step=null){
  const row=expected(lang,route,step);
  voiceExpect(snap.state.productionEnabled).toBe(true);
  voiceExpect(snap.state.lang).toBe(lang);
  voiceExpect(snap.state.lastFile).toBe('./assets/owner-voice/'+row.file);
  voiceExpect(snap.plays.at(-1).src).toContain('/assets/owner-voice/'+row.file);
  voiceExpect(snap.plays.at(-1).src).toContain('volume_master=20261111-v2');
  voiceExpect(snap.plays.at(-1).volume).toBeGreaterThan(0);
  voiceExpect(snap.oldSpeech,'native speechSynthesis must not replace owner voice').toBe(0);
  voiceExpect(snap.state.missing).toBe(0);
  voiceExpect(snap.state.playbackErrors).toBe(0);
  return row;
}

voiceTest.describe('venue tablet owner-voice and per-step SFX',()=>{
  voiceTest.use({viewport:{width:1194,height:834},reducedMotion:'no-preference'});
  voiceTest.beforeEach(async({page})=>{
    await page.addInitScript(()=>{
      window.__ownerPlayed=[];
      window.__ownerPaused=[];
      const oldPause=HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.pause=function(){window.__ownerPaused.push(this.src);return oldPause.call(this);};
      window.__oldSpeech=[];
      HTMLMediaElement.prototype.play=function(){
        window.__ownerPlayed.push({src:this.src,volume:this.volume});
        return Promise.resolve();
      };
      Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{
        getVoices:()=>[],cancel:()=>{},
        speak:utter=>window.__oldSpeech.push({text:utter.text,lang:utter.lang})
      }});
      window.SpeechSynthesisUtterance=class SpeechSynthesisUtterance{constructor(text){this.text=text;}};
    });
    await page.goto(audioUrl);
    await page.waitForFunction(()=>window.__ASOBOON_OWNER_VOICE__?.state().productionEnabled);
  });

  voiceTest('first choice plays STEP 1; Next/back changes owner audio and keeps light cue',async({page})=>{
    const root=page.locator('#exitGuideV2');
    await root.locator('[data-guide="family"]').click();
    let info=await snapshot(page);
    voiceExpect(info.plays.length).toBe(1);
    voiceExpect(info.pauses.length,'same-language refresh must not stop narration').toBe(0);
    const first=checkPlay(info,'ja','family');
    voiceExpect(first.text).toContain('ロッカーの荷物を全部出す');
    voiceExpect(first.text).toContain('一時退場中も利用時間は進みます。');
    await root.locator('[data-stepper-action="next"]').click();
    info=await snapshot(page);
    voiceExpect(info.plays.length).toBe(2);
    voiceExpect(checkPlay(info,'ja','family','2').text).toContain('赤ホルダーからレシートを抜く');
    voiceExpect(info.sfx.lastDestination).toBe('family-step');
    await root.locator('[data-stepper-action="next"]').click();
    info=await snapshot(page);
    voiceExpect(info.plays.length).toBe(3);
    voiceExpect(checkPlay(info,'ja','family','3').text).toContain('受付でレシートを見せてください');
    await root.locator('[data-stepper-action="prev"]').click();
    info=await snapshot(page);
    voiceExpect(info.plays.length).toBe(4);
    voiceExpect(checkPlay(info,'ja','family','2').text).toContain('赤ホルダーからレシートを抜く');
  });

  voiceTest('all eight languages select correct owner audio on real visitor taps',async({page})=>{
    const root=page.locator('#exitGuideV2');
    for(const lang of langs){
      await page.locator('#eg-final-languages [data-locale="'+lang+'"]').click();
      await root.locator('[data-guide="family"]').click();
      const info=await snapshot(page);
      const row=checkPlay(info,lang,'family');
      voiceExpect(row.text.length).toBeGreaterThan(20);
      await root.locator('[data-guide="home"]').first().click();
    }
    voiceExpect((await snapshot(page)).plays.length).toBe(8);
  });

  voiceTest('mute silences owner speech, then resumes only on an explicit tap',async({page})=>{
    const root=page.locator('#exitGuideV2');
    await root.locator('[data-guide="family"]').click();
    const initial=await snapshot(page);
    voiceExpect(initial.plays.length).toBe(1);
    await page.locator('#eg-audio-toggle').click();
    const stopped=await snapshot(page);
    voiceExpect(stopped.pauses.length,'mute must stop in-flight owner recording').toBeGreaterThan(initial.pauses.length);
    await root.locator('[data-stepper-action="next"]').click();
    let info=await snapshot(page);
    voiceExpect(info.plays.length).toBe(1);
    voiceExpect(info.sfx.enabled).toBe(false);
    await page.locator('#eg-audio-toggle').click();
    await root.locator('[data-stepper-action="next"]').click();
    info=await snapshot(page);
    voiceExpect(info.plays.length).toBe(2);
    voiceExpect(checkPlay(info,'ja','family','3').text).toContain('ホルダーと鍵をすべて返す');
  });

  voiceTest('leave warns no re-entry; no-holder warning uses its specific owner clip',async({page})=>{
    const root=page.locator('#exitGuideV2');
    await root.locator('[data-guide="leave"]').click();
    let info=await snapshot(page);
    voiceExpect(checkPlay(info,'ja','leave').text).toContain('再入場はできません。');
    await root.locator('[data-stepper-action="next"]').click();
    info=await snapshot(page);
    voiceExpect(checkPlay(info,'ja','leave','2').text).toContain('再入場はできません。');
    await root.locator('[data-guide="home"]').first().click();
    await root.locator('[data-guide="adult"]').click();
    await root.locator('[data-guide="adult-no"]').click();
    info=await snapshot(page);
    voiceExpect(info.sfx.lastDestination).toBe('adult-no');
    voiceExpect(checkPlay(info,'ja','adult-no').text).toContain('受付スタッフに確認');
  });

  voiceTest('switching language cancels the prior owner recording',async({page})=>{
    const root=page.locator('#exitGuideV2');
    await root.locator('[data-guide="family"]').click();
    const initial=await snapshot(page);
    voiceExpect(initial.pauses.length).toBe(0);
    await page.locator('#eg-final-languages [data-locale="en"]').click();
    await page.waitForFunction(()=>window.__ASOBOON_OWNER_VOICE__?.state().lang==='en');
    await voiceExpect.poll(async()=>(await snapshot(page)).pauses.length).toBeGreaterThan(initial.pauses.length);
  });

  voiceTest('all 72 owner audio assets exist, without publishing reference recordings',()=>{
    voiceExpect(manifest.enabled).toBe(true);
    voiceExpect(manifest.readyCount).toBe(72);
    for(const lang of langs){
      const rows=manifest.allPromptTexts[lang];
      voiceExpect(rows).toHaveLength(9);
      for(const row of rows){
        const file=path.resolve('assets/owner-voice',row.file);
        voiceExpect(fs.statSync(file).size).toBeGreaterThan(1000);
        voiceExpect(manifest.entries[lang][row.text]).toBe('./assets/owner-voice/'+row.file);
      }
    }
    const assets=path.resolve('assets/owner-voice');
    voiceExpect(fs.readdirSync(assets,{recursive:true}).some(x=>/\.(?:wav|m4a)$/i.test(x))).toBe(false);
  });
});
