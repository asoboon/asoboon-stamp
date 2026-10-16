/* ASOBooN venue tablet: licensed repository effects + WebAudio + character-styled multilingual device TTS. */
(function ASOBooNAudio20261016(){
  'use strict';
  if(window.__ASOBOON_AUDIO__)return;
  const root=document.getElementById('exitGuideV2');
  const cin=document.getElementById('eg-cinema');
  if(!root||!cin)return;
  const soundsBase='./assets/audio/runtime/common/';
  const cues={
    tap:'ui-tap.mp3',
    charge:'ultimate-ready.mp3',
    impact:'judge-critical.mp3',
    resolve:'judge-super.mp3',
    warning:'miss.mp3'
  };
  const locales={ja:'ja-JP',en:'en-US',zh:'zh-CN',vi:'vi-VN',ko:'ko-KR',ne:'ne-NP',tl:'fil-PH',my:'my-MM'};
  const volumeLabels={
    ja:'効果音',en:'FX volume',zh:'音效',vi:'Âm thanh',ko:'효과음',ne:'ध्वनि',tl:'Effects',my:'အသံအကျိုးသက်ရောက်မှု'
  };
  const buttonText={
    ja:['🔊 音 ON','🔇 音 OFF'],
    en:['🔊 Sound ON','🔇 Sound OFF'],
    zh:['🔊 声音开','🔇 静音'],
    vi:['🔊 Có âm','🔇 Tắt âm'],
    ko:['🔊 소리 켬','🔇 소리 끔'],
    ne:['🔊 आवाज चालु','🔇 आवाज बन्द'],
    tl:['🔊 Tunog ON','🔇 Tunog OFF'],
    my:['🔊 အသံဖွင့်','🔇 အသံပိတ်']
  };
  // Friendly, character-like one-line narration, NOT a fictional prerecorded voice.
  // The on-screen safety instructions remain the authority; do not paraphrase rules here.
  const prompts={
    family:{
      ja:'レシートは大切に持っていてね！ 戻るときは、受付で見せてね！',
      en:'Keep your receipt safe! Show it at reception when you return!',
      zh:'请保管好收据！回来时在前台出示哦！',
      vi:'Nhớ giữ biên lai nhé! Khi quay lại, hãy đưa cho lễ tân xem!',
      ko:'영수증을 꼭 챙겨 주세요! 돌아올 때 안내 데스크에 보여주세요!',
      ne:'रसिद सुरक्षित राख्नुहोस्! फर्कँदा स्वागत कक्षमा देखाउनुहोस्!',
      tl:'Ingatan ang resibo! Ipakita ito sa reception sa pagbabalik!',
      my:'ပြေစာကို သေချာသိမ်းပါ။ ပြန်လာသည့်အခါ ဧည့်ကြိုဌာနတွင် ပြပါ။'
    },
    adult:{
      ja:'黄色ホルダーを持っているかな？ 画面で選んでね！',
      en:'Do you have a yellow holder? Please choose on the screen!',
      zh:'您有黄色卡套吗？请选择屏幕上的选项！',
      vi:'Bạn có thẻ màu vàng không? Hãy chọn trên màn hình nhé!',
      ko:'노란색 홀더가 있나요? 화면에서 선택해 주세요!',
      ne:'पहेँलो होल्डर छ? कृपया स्क्रिनमा छान्नुहोस्!',
      tl:'May dilaw na holder ba kayo? Pumili sa screen!',
      my:'အဝါရောင် holder ရှိပါသလား။ မျက်နှာပြင်မှာ ရွေးပါ။'
    },
    'adult-yes':{
      ja:'黄色ホルダーを持ってお出かけしてね！ 戻るときは受付へ！',
      en:'Take your yellow holder with you! Show it at reception when you return!',
      zh:'外出时请带好黄色卡套！回来时在前台出示！',
      vi:'Mang theo thẻ màu vàng nhé! Khi quay lại, hãy trình ở lễ tân!',
      ko:'노란색 홀더를 가지고 외출하세요! 돌아올 때 안내 데스크에서 보여주세요!',
      ne:'पहेँलो होल्डर साथमा लैजानुहोस्! फर्कँदा स्वागत कक्षमा देखाउनुहोस्!',
      tl:'Dalhin ang dilaw na holder! Ipakita sa reception sa pagbabalik!',
      my:'အဝါရောင် holder ကို ယူသွားပါ။ ပြန်လာလျှင် ဧည့်ကြိုဌာနတွင် ပြပါ။'
    },
    'adult-no':{
      ja:'ちょっと待ってね！ 外出する前に、受付スタッフに確認してね。',
      en:'Please wait! Ask reception staff before you go outside.',
      zh:'请稍等！外出前请先向前台工作人员确认。',
      vi:'Chờ một chút! Hãy hỏi nhân viên lễ tân trước khi ra ngoài.',
      ko:'잠깐만요! 외출 전에 안내 데스크 직원에게 확인해 주세요.',
      ne:'एकछिन पर्खनुहोस्! बाहिर जानुअघि स्वागत कक्षमा सोध्नुहोस्।',
      tl:'Sandali! Magtanong muna sa reception bago lumabas.',
      my:'ခဏစောင့်ပါ။ အပြင်မထွက်မီ ဧည့်ကြိုဝန်ထမ်းကို မေးပါ။'
    },
    leave:{
      ja:'忘れ物はないかな？ ホルダーと鍵を返してから、お帰りください！',
      en:'Check for your belongings! Return all holders and the locker key before leaving!',
      zh:'请检查随身物品！离园前归还卡套和钥匙！',
      vi:'Kiểm tra hành lý nhé! Hãy trả thẻ giữ và chìa khóa trước khi về!',
      ko:'두고 가는 물건이 없는지 확인해 주세요! 홀더와 열쇠를 반납하고 귀가하세요!',
      ne:'सामान जाँच्नुहोस्! घर जानुअघि होल्डर र साँचो फिर्ता गर्नुहोस्!',
      tl:'Tingnan kung may naiwan! Isauli ang mga holder at susi bago umuwi!',
      my:'ပစ္စည်းကျန်မကျန် စစ်ပါ။ ပြန်မသွားမီ holder နှင့် သော့ကို ပြန်အပ်ပါ။'
    }
  };
  let muted=false,volumeLevel=85,ctx=null,master=null,limiter=null,sceneTimers=[],sceneNodes=[],voiceTimer=0;
  let lastDestination=null,lastCueAt=0,lastSpoken='',voiceAvailable=null,failures=0;
  const buffers=new Map();
  const button=document.createElement('button');
  button.type='button';
  button.id='eg-audio-toggle';
  button.setAttribute('aria-label','音声と効果音を切り替える');
  button.setAttribute('aria-pressed','true');
  const volumePack=document.createElement('div');
  volumePack.id='eg-audio-volume-pack';
  const sliderLabel=document.createElement('label');
  sliderLabel.htmlFor='eg-audio-volume';
  sliderLabel.textContent='効果音';
  const slider=document.createElement('input');
  slider.type='range';slider.id='eg-audio-volume';
  slider.min='20';slider.max='100';slider.step='5';slider.value=String(volumeLevel);
  slider.setAttribute('aria-label','効果音の音量');
  const sliderValue=document.createElement('output');
  sliderValue.id='eg-audio-volume-value';
  sliderValue.htmlFor=slider.id;
  volumePack.append(button,sliderLabel,slider,sliderValue);
  document.body.appendChild(volumePack);
  const css=document.createElement('style');
  css.id='eg-audio-styles';
  css.textContent=`
    #eg-audio-toggle{position:fixed;z-index:430;top:57px;left:15px;min-height:35px;border:1px solid #bed5e8;border-radius:99px;padding:7px 13px;background:#164a70;color:white;font-size:clamp(11px,1.35vw,14px);font-weight:900;box-shadow:0 4px 14px #041a334d;cursor:pointer;touch-action:manipulation}
    #exitGuideV2 .eg-header #eg-audio-toggle{position:static;left:auto;right:auto;top:auto;z-index:auto;flex:0 0 auto;box-shadow:none;padding:6px 10px}
    #eg-audio-toggle:focus-visible{outline:3px solid #ffdc49;outline-offset:3px}
    #eg-audio-toggle[aria-pressed=false]{background:#42535e}
    #eg-audio-volume-pack{position:fixed;z-index:430;top:57px;left:15px;display:flex;align-items:center;gap:7px;max-width:calc(100vw - 32px);padding:4px 7px;border-radius:13px;background:rgba(10,44,69,.94);color:#fff;box-shadow:0 3px 14px #021b3675}
    #eg-audio-volume-pack #eg-audio-toggle{position:static;inset:auto;flex:0 0 auto;box-shadow:none}
    #eg-audio-volume-pack label{font-size:12px;font-weight:900;white-space:nowrap}
    #eg-audio-volume-pack input[type=range]{width:clamp(70px,10vw,130px);min-width:55px;min-height:35px;accent-color:#ffe366;cursor:pointer;touch-action:pan-x}
    #eg-audio-volume-pack output{font:900 12px/1 -apple-system,sans-serif;min-width:33px;text-align:right;font-variant-numeric:tabular-nums}
    #exitGuideV2 .eg-header #eg-audio-volume-pack{position:static;inset:auto;flex:0 1 auto;box-shadow:none;max-width:46%;padding:2px 5px}
    @media(max-width:850px){#eg-audio-volume-pack label{display:none}#exitGuideV2 .eg-header #eg-audio-volume-pack{max-width:42%}}
    @media(max-width:650px){#eg-audio-volume-pack{left:7px;top:52px;gap:4px}#eg-audio-volume-pack input[type=range]{width:65px}#eg-audio-volume-pack output{min-width:27px;font-size:11px}}
    #eg-cinema.active ~ #eg-audio-volume-pack{visibility:hidden}
    @media(max-width:650px){#eg-audio-toggle{top:52px;left:7px;padding:6px 9px}}
  `;
  document.head.appendChild(css);
  const locale=()=>locales[root.dataset.lang]?root.dataset.lang:'ja';
  function updateButton(){
    const lang=locale();
    const text=(buttonText[lang]||buttonText.ja)[muted?1:0];
    if(button.textContent!==text)button.textContent=text;
    button.setAttribute('aria-pressed',String(!muted));
    button.setAttribute('lang',locales[lang]);
    const label=volumeLabels[lang]||volumeLabels.ja;
    if(sliderLabel.textContent!==label)sliderLabel.textContent=label;
    slider.setAttribute('aria-label',label);
    button.setAttribute('aria-label',text);
  }
  function connectAudio(){
    if(ctx)return ctx;
    const API=window.AudioContext||window.webkitAudioContext;
    if(!API)return null;
    try{
      ctx=new API({latencyHint:'interactive'});
      limiter=ctx.createDynamicsCompressor();
      limiter.threshold.value=-17;
      limiter.knee.value=7;
      limiter.ratio.value=10;
      limiter.attack.value=.002;
      limiter.release.value=.16;
      master=ctx.createGain();
      master.gain.value=.95*volumeLevel/100; // Boost old .34 level and retain dynamics protection.
      limiter.connect(master);
      master.connect(ctx.destination);
      return ctx;
    }catch(error){failures++;return null;}
  }
  async function preload(){
    const audio=connectAudio();
    if(!audio)return;
    await Promise.all(Object.entries(cues).map(async([key,name])=>{
      try{
        const res=await fetch(soundsBase+name,{cache:'force-cache'});
        if(!res.ok)throw Error('sfx '+res.status);
        const buffer=await audio.decodeAudioData(await res.arrayBuffer());
        buffers.set(key,buffer);
      }catch(error){failures++;}
    }));
  }
  // Prefetch after load. The first customer tap unlocks AudioContext per iOS Safari policy.
  if(document.readyState==='complete')preload();
  else window.addEventListener('load',preload,{once:true});
  function unlock(){
    if(muted)return null;
    const audio=connectAudio();
    if(audio?.state==='suspended'){
      try{audio.resume().catch(()=>{});}catch(error){}
    }
    return audio;
  }
  function schedule(fn,delay){
    const id=window.setTimeout(fn,delay);
    sceneTimers.push(id);
  }
  function oscillator(frequency,endFrequency,startTime,duration,volume=.2,type='sine'){
    if(!ctx||!limiter||muted)return;
    try{
      const osc=ctx.createOscillator(),vol=ctx.createGain();
      osc.type=type;
      osc.frequency.setValueAtTime(frequency,startTime);
      if(endFrequency!==frequency)osc.frequency.exponentialRampToValueAtTime(Math.max(30,endFrequency),startTime+duration);
      vol.gain.setValueAtTime(.0001,startTime);
      vol.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),startTime+.008);
      vol.gain.exponentialRampToValueAtTime(.0001,startTime+duration);
      osc.connect(vol).connect(limiter);
      osc.start(startTime);osc.stop(startTime+duration+.01);
      sceneNodes.push(osc);
      osc.onended=()=>{osc.disconnect();vol.disconnect();sceneNodes=sceneNodes.filter(x=>x!==osc);};
    }catch(error){failures++;}
  }
  function sample(key,delay=0,level=.5){
    if(muted||!ctx||!limiter)return false;
    const buff=buffers.get(key);
    if(!buff)return false;
    try{
      const source=ctx.createBufferSource(),vol=ctx.createGain();
      source.buffer=buff;vol.gain.value=level;
      // Play short compressed cue; lengthy original assets never delay navigation or speech.
      source.playbackRate.value=Math.max(1,buff.duration/.24);
      source.connect(vol).connect(limiter);
      source.start(ctx.currentTime+Math.max(0,delay));
      sceneNodes.push(source);
      source.onended=()=>{source.disconnect();vol.disconnect();sceneNodes=sceneNodes.filter(x=>x!==source);};
      return true;
    }catch(error){failures++;return false;}
  }
  function cancelVoice(){
    clearTimeout(voiceTimer);
    try{window.speechSynthesis?.cancel();}catch(error){}
  }
  function stopScene(){
    sceneTimers.forEach(clearTimeout);sceneTimers=[];
    for(const node of sceneNodes){try{node.stop();}catch(error){}}
    sceneNodes=[];
    cancelVoice();
  }
  function start(destination,hasAnimation=true){
    stopScene();
    lastDestination=destination;lastCueAt=performance.now();
    if(muted)return;
    const audio=unlock();
    // The guide is now rendered immediately in this same gesture; voice is started there.
    if(!audio)return;
    const now=audio.currentTime+.006;
    sample('tap',0,.62);
    oscillator(780,1000,now,.085,.17,'triangle');
    if(!hasAnimation){
      oscillator(810,1160,now+.04,.12,.13,'sine');
      return;
    }
    if(destination==='adult-no'){
      // A cautionary cue, never a success celebration.
      oscillator(390,210,now+.03,.12,.24,'triangle');
      sample('warning',.105,.43);
      oscillator(225,145,now+.14,.10,.14,'sine');
      return;
    }
    oscillator(170,1220,now+.025,.095,.19,'sawtooth'); // Quick charge
    sample('charge',.035,.48);
    oscillator(100,51,now+.115,.09,.32,'triangle'); // Gate impact at 115ms
    oscillator(950,360,now+.115,.07,.14,'square');
    sample('impact',.115,.74);
    oscillator(320,880,now+.205,.075,.18,'sine'); // Light release
    sample('resolve',.21,.47);
  }
  function pickVoice(lang){
    const synth=window.speechSynthesis;
    if(!synth)return null;
    let voices=[];
    try{voices=synth.getVoices()||[];}catch(error){}
    if(!voices.length)return null;
    const wanted=locales[lang].toLowerCase();
    const targetPrefix=wanted.split('-')[0];
    const candidates=voices.filter(v=>v.lang?.toLowerCase()===wanted||v.lang?.toLowerCase().split('-')[0]===targetPrefix);
    if(!candidates.length)return null;
    const full=candidates.filter(v=>v.lang?.toLowerCase()===wanted);
    const group=full.length?full:candidates;
    const preferred=/kyoko|samantha|female|mei-jia|xiaoxiao|yuna|sun-hi|natural|enhanced|premium/i;
    return group.find(v=>preferred.test(v.name||''))||group[0];
  }
  function announce(destination){
    cancelVoice();
    if(muted||!prompts[destination])return;
    const lang=locale(),text=prompts[destination][lang];
    if(!text)return;
    // Called synchronously from render() inside the user's tap.
    // No timeout: Safari voice permission requires a real user gesture.
    {
      if(muted||document.hidden)return;
      const synth=window.speechSynthesis;
      if(!synth||!window.SpeechSynthesisUtterance)return;
      const voices=(()=>{try{return synth.getVoices()||[];}catch(e){return [];}})();
      const voice=pickVoice(lang);
      // If iPad has voice list but not this language, do not speak wrong-language instructions.
      if(voices.length&&!voice){voiceAvailable=false;return;}
      try{
        const utter=new SpeechSynthesisUtterance(text);
        utter.lang=locales[lang];
        if(voice)utter.voice=voice;
        utter.pitch=destination==='adult-no'?1.12:1.36;
        utter.rate=lang==='ja'?(destination==='adult-no'?.98:1.07):1.02;
        utter.volume=1.0; // Max browser speech setting; iPad system volume still applies.
        lastSpoken=text;voiceAvailable=true;
        synth.cancel();
        synth.speak(utter);
      }catch(error){failures++;voiceAvailable=false;}
    }
  }
  function setMuted(next){
    muted=Boolean(next);
    if(muted){stopScene();if(master&&ctx)master.gain.setTargetAtTime(.0001,ctx.currentTime,.015);}
    else{
      if(master&&ctx)master.gain.setTargetAtTime(.95*volumeLevel/100,ctx.currentTime,.025);
      // Explicit tap unlocks WebAudio, but silence until the visitor selects an action.
      unlock();
    }
    updateButton();
  }
  // Keep the combined sound and volume control beside Back without obscuring it.
  function placeAudioControl(){
    const header=root.querySelector('.eg-detail .eg-header');
    if(header){
      if(volumePack.parentElement!==header)header.insertBefore(volumePack,header.querySelector('.eg-route'));
    }else if(volumePack.parentElement!==document.body){
      document.body.appendChild(volumePack);
    }
  }
  new MutationObserver(placeAudioControl).observe(root,{childList:true,subtree:true});
  placeAudioControl();
  button.addEventListener('click',()=>setMuted(!muted));
  function setVolume(next){
    const value=Number(next);
    if(!Number.isFinite(value))return;
    volumeLevel=Math.min(100,Math.max(20,Math.round(value/5)*5));
    slider.value=String(volumeLevel);
    sliderValue.value=volumeLevel+'%';
    if(master&&ctx&&!muted)master.gain.setTargetAtTime(.95*volumeLevel/100,ctx.currentTime,.018);
  }
  slider.addEventListener('input',()=>setVolume(slider.value));
  setVolume(volumeLevel);
  const langObserver=new MutationObserver(updateButton);
  langObserver.observe(root,{attributes:true,attributeFilter:['data-lang']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScene();});
  window.addEventListener('pagehide',stopScene);
  function resetForNextVisitor(){stopScene();setMuted(false);}
  window.__ASOBOON_AUDIO__={
    start,announce,stop:stopScene,resetForNextVisitor,setMuted,setVolume,
    prompt:(destination,lang=locale())=>prompts[destination]?.[lang]||null,
    state:()=>({enabled:!muted,locale:locale(),cachedSounds:buffers.size,lastDestination,
      voiceAvailable,lastSpoken,failures,cuesReady:[...buffers.keys()],durationMs:310,volumeLevel,masterGain:.95*volumeLevel/100})
  };
  updateButton();
})();
