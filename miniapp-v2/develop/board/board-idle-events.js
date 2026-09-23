(()=>{'use strict';

const M=window.ASOBOON_BOARD_EFFECTS;
const WORLD=window.ASOBOON_BOARD_WORLD;
const STORAGE_KEY='asoboon_call_board_idle_config_v1';
const DEFAULT_CONFIG=Object.freeze({
  ANIMATION_ENABLED:true,
  ANIMATION_LEVEL:3,
  IDLE_EVENTS_ENABLED:true,
  IDLE_EVENT_CHANCE:.80,
  RARE_EVENTS_ENABLED:true,
  REAL_CHANGE_COOLDOWN_MS:15000,
  INITIAL_QUIET_MS:10000,
  IDLE_POST_COOLDOWN_MIN_MS:6000,
  IDLE_POST_COOLDOWN_MAX_MS:9000,
  RECENT_HISTORY:8,
  TIER_WEIGHTS:Object.freeze({small:.40,medium:.25,large:.12,rare:.03}),
});
const CONFIG={...DEFAULT_CONFIG,...readStoredConfig(),TIER_WEIGHTS:{...DEFAULT_CONFIG.TIER_WEIGHTS}};
const reducedQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
let reduced=Boolean(reducedQuery?.matches);
reducedQuery?.addEventListener?.('change',e=>{reduced=Boolean(e.matches)});

let ready=false;
let running=false;
let currentAbort=null;
let activeAnimations=new Set();
let activeTimers=new Set();
let recentIdleEvents=[];
let cooldownUntil=0;
let lastStableAt=0;
let sequence=0;
let storyStage=0;
let lastEventAt=0;

const diagnostics={
  attempts:0,
  played:0,
  none:0,
  skipped:0,
  canceled:0,
  realInterrupts:0,
  cleanupRuns:0,
  lastEvent:null,
  history:[],
  lastDecision:'none',
};

const IDLE_EVENTS=Object.freeze([
  {id:'shooting-star',tier:'small',kind:'pass',shape:'star',color:'#ffd84f',size:.75,duration:760},
  {id:'tiny-cloud',tier:'small',kind:'cloud',color:'#dceff4',size:.7,duration:1250},
  {id:'card-wiggle',tier:'small',kind:'cards',pattern:'wiggle',count:1,duration:520},
  {id:'card-hop-wave',tier:'small',kind:'cards',pattern:'hop-wave',count:7,duration:760},
  {id:'micro-sparkles',tier:'small',kind:'particles',style:'sparkle',count:10,duration:650},
  {id:'road-light',tier:'small',kind:'pass',shape:'line',color:'#78e5ff',size:.65,duration:620},
  {id:'light-orb',tier:'small',kind:'pass',shape:'orb',color:'#73dda0',size:.7,duration:850},
  {id:'few-confetti',tier:'small',kind:'particles',style:'confetti',count:8,duration:900},
  {id:'corner-peek',tier:'small',kind:'peek',shape:'orb',color:'#ff8b31',size:.55,duration:760},
  {id:'orbit-star',tier:'small',kind:'orbit',shape:'star',color:'#ffd84f',size:.65,duration:950},
  {id:'dot-wave',tier:'small',kind:'particles',style:'dots-wave',count:18,duration:800},
  {id:'smoke-puff',tier:'small',kind:'particles',style:'smoke',count:7,duration:650},
  {id:'single-speed-line',tier:'small',kind:'pass',shape:'speed-line',color:'#ffffff',size:.7,duration:480},
  {id:'small-ring',tier:'small',kind:'ring',color:'#73dda0',size:.65,duration:720},
  {id:'card-sheen',tier:'small',kind:'cards',pattern:'sheen',count:3,duration:700},

  {id:'giant-star-pass',tier:'medium',kind:'pass',shape:'star',color:'#ffd84f',size:1.55,duration:900},
  {id:'wind-tilt',tier:'medium',kind:'cards',pattern:'wind',count:10,duration:880},
  {id:'bouncing-ball',tier:'medium',kind:'ball',color:'#ff8b31',size:1.0,duration:1200},
  {id:'rocket-shape',tier:'medium',kind:'pass',shape:'rocket',color:'#78e5ff',size:1.0,duration:700},
  {id:'color-rings',tier:'medium',kind:'ring',color:'#ff8b31',secondary:'#73dda0',size:1.15,duration:900},
  {id:'shadow-dash',tier:'medium',kind:'pass',shape:'shadow',color:'#0b1012',size:1.25,duration:560},
  {id:'giant-arrow',tier:'medium',kind:'pass',shape:'arrow',color:'#73dda0',size:1.15,duration:760},
  {id:'object-drop',tier:'medium',kind:'drop',shape:'orb',color:'#ffd84f',size:1.1,duration:900},
  {id:'card-wave',tier:'medium',kind:'cards',pattern:'wave',count:14,duration:950},
  {id:'constellation',tier:'medium',kind:'constellation',color:'#78e5ff',count:9,duration:1250},
  {id:'dot-stream',tier:'medium',kind:'particles',style:'stream',count:34,duration:920},
  {id:'mini-tornado',tier:'medium',kind:'tornado',color:'#dceff4',count:22,duration:1050},
  {id:'confetti-medium',tier:'medium',kind:'particles',style:'confetti',count:24,duration:1050},
  {id:'domino-cards',tier:'medium',kind:'cards',pattern:'domino',count:12,duration:960},
  {id:'center-wave',tier:'medium',kind:'ring',color:'#78e5ff',size:1.6,duration:920},
  {id:'giant-exclamation',tier:'medium',kind:'drop',shape:'exclamation',color:'#ffd84f',size:1.25,duration:900},
  {id:'pinball',tier:'medium',kind:'ball',color:'#73dda0',size:.8,duration:1300,bounces:5},
  {id:'light-hop-cards',tier:'medium',kind:'cards',pattern:'light-hop',count:10,duration:980},
  {id:'radial-background',tier:'medium',kind:'background',style:'radial',color:'#ff8b31',duration:850},
  {id:'afterimage-pass',tier:'medium',kind:'pass',shape:'afterimage',color:'#78e5ff',size:1.1,duration:650},
  {id:'mystery-orb-dash',tier:'medium',kind:'story-orb',stage:2,color:'#ff8b31',size:.9,duration:800,story:'orb'},

  {id:'giant-drop',tier:'large',kind:'drop',shape:'ball',color:'#ff8b31',size:1.8,duration:1100},
  {id:'hyper-pass',tier:'large',kind:'pass',shape:'speed-block',color:'#78e5ff',size:1.7,duration:540},
  {id:'comic-burst',tier:'large',kind:'burst',color:'#ffd84f',count:44,duration:1050},
  {id:'giant-wave',tier:'large',kind:'ring',color:'#73dda0',secondary:'#78e5ff',size:2.1,duration:1100},
  {id:'star-swarm',tier:'large',kind:'particles',style:'stars',count:48,duration:1200},
  {id:'all-card-jump',tier:'large',kind:'cards',pattern:'jump-all',count:999,duration:920},
  {id:'giant-ball',tier:'large',kind:'ball',color:'#ffd84f',size:1.9,duration:1350,bounces:3},
  {id:'depth-ring',tier:'large',kind:'ring',color:'#78e5ff',size:2.5,duration:1200},
  {id:'confetti-storm',tier:'large',kind:'particles',style:'confetti',count:58,duration:1300},
  {id:'smoke-star',tier:'large',kind:'burst',style:'smoke-star',color:'#dceff4',count:34,duration:1150},
  {id:'collision-pop',tier:'large',kind:'collision',color:'#ff8b31',secondary:'#73dda0',duration:1050},
  {id:'board-float-drop',tier:'large',kind:'cards',pattern:'float-drop',count:999,duration:1050},
  {id:'scatter-illusion',tier:'large',kind:'cards',pattern:'scatter',count:16,duration:980},
  {id:'giant-arrow-fast',tier:'large',kind:'pass',shape:'arrow',color:'#ffd84f',size:2.0,duration:600},
  {id:'chain-three',tier:'large',kind:'sequence',steps:['pass','ring','particles'],color:'#73dda0',duration:1350},
  {id:'mystery-orb-drop',tier:'large',kind:'story-orb',stage:3,color:'#ff8b31',size:1.5,duration:1050,story:'orb'},

  {id:'mega-star-depth',tier:'rare',kind:'depth',shape:'star',color:'#ffd84f',size:3.0,duration:1450},
  {id:'space-window',tier:'rare',kind:'background',style:'space',color:'#78e5ff',duration:1600},
  {id:'confetti-glitter',tier:'rare',kind:'particles',style:'confetti-stars',count:90,duration:1500},
  {id:'burst-all-jump',tier:'rare',kind:'sequence',steps:['burst','jump-all'],color:'#ffd84f',duration:1450},
  {id:'mystery-eye-peek',tier:'rare',kind:'peek',shape:'eye',color:'#73dda0',size:2.2,duration:1350},
  {id:'giant-ball-impact',tier:'rare',kind:'drop',shape:'ball',color:'#ff8b31',size:2.8,duration:1400},
  {id:'triple-flyby',tier:'rare',kind:'sequence',steps:['triple-pass'],color:'#78e5ff',duration:1350},
  {id:'alternate-world',tier:'rare',kind:'background',style:'world',color:'#ff8b31',duration:1700},
  {id:'star-depth-swarm',tier:'rare',kind:'depth',shape:'stars',color:'#ffd84f',size:2.4,duration:1500},
  {id:'mini-chain-world',tier:'rare',kind:'sequence',steps:['ring','pass','burst'],color:'#73dda0',duration:1600},
  {id:'mystery-orb-peek',tier:'rare',kind:'story-orb',stage:1,color:'#ff8b31',size:1.4,duration:1150,story:'orb'},
]);

function readStoredConfig(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return{};
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==='object'?parsed:{};
  }catch{return{}}
}
function persist(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify({
      ANIMATION_ENABLED:Boolean(CONFIG.ANIMATION_ENABLED),
      ANIMATION_LEVEL:clamp(Math.round(Number(CONFIG.ANIMATION_LEVEL)||0),0,3),
      IDLE_EVENTS_ENABLED:Boolean(CONFIG.IDLE_EVENTS_ENABLED),
      IDLE_EVENT_CHANCE:clamp(Number(CONFIG.IDLE_EVENT_CHANCE)||0,0,1),
      RARE_EVENTS_ENABLED:Boolean(CONFIG.RARE_EVENTS_ENABLED),
      IDLE_POST_COOLDOWN_MIN_MS:Number(CONFIG.IDLE_POST_COOLDOWN_MIN_MS),
      IDLE_POST_COOLDOWN_MAX_MS:Number(CONFIG.IDLE_POST_COOLDOWN_MAX_MS),
    }));
  }catch{}
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function effectiveLevel(){return reduced?Math.min(Number(CONFIG.ANIMATION_LEVEL)||0,1):clamp(Number(CONFIG.ANIMATION_LEVEL)||0,0,3)}
function realFxBusy(){
  const d=window.ASOBOON_BOARD_ANIMATIONS?.getDiagnostics?.();
  return Boolean(d&&(d.activeFx>0||d.running>0||d.queuedNow>0));
}
function layer(){
  let el=document.getElementById('boardIdleLayer');
  if(el)return el;
  el=document.createElement('div');
  el.id='boardIdleLayer';
  el.className='board-idle-layer';
  el.setAttribute('aria-hidden','true');
  const shell=document.querySelector('.queue-shell');
  if(shell)shell.insertBefore(el,shell.firstChild);
  else(document.querySelector('.board')||document.body).appendChild(el);
  return el;
}
function clearLayer(){
  const el=document.getElementById('boardIdleLayer');
  if(el)el.replaceChildren();
}
function trackAnimation(animation){
  if(!animation)return Promise.resolve();
  activeAnimations.add(animation);
  return animation.finished.catch(()=>{}).finally(()=>activeAnimations.delete(animation));
}
function animate(el,keyframes,options={}){
  if(!el?.animate)return Promise.resolve();
  const opts={...options};
  if(Number.isFinite(Number(opts.duration)))opts.duration=M?M.ms(opts.duration):opts.duration;
  if(Number.isFinite(Number(opts.delay)))opts.delay=M?M.ms(opts.delay):opts.delay;
  if(Number.isFinite(Number(opts.endDelay)))opts.endDelay=M?M.ms(opts.endDelay):opts.endDelay;
  return trackAnimation(el.animate(keyframes,opts));
}
function wait(ms,signal){
  if(signal?.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
      activeTimers.delete(timer);
      signal?.removeEventListener?.('abort',onAbort);
      resolve();
    },M?M.ms(ms):Math.max(0,ms));
    activeTimers.add(timer);
    const onAbort=()=>{
      clearTimeout(timer);
      activeTimers.delete(timer);
      signal?.removeEventListener?.('abort',onAbort);
      reject(new DOMException('Aborted','AbortError'));
    };
    signal?.addEventListener?.('abort',onAbort,{once:true});
  });
}
function cleanup(){
  for(const animation of activeAnimations){try{animation.cancel()}catch{}}
  activeAnimations.clear();
  for(const timer of activeTimers)clearTimeout(timer);
  activeTimers.clear();
  clearLayer();
  document.querySelectorAll('.queue-card').forEach(card=>{card.style.willChange='';card.style.filter=''});
  diagnostics.cleanupRuns+=1;
}
function cancelIdleEvent(reason='manual'){
  if(!running&&!currentAbort)return false;
  diagnostics.canceled+=1;
  if(currentAbort&&!currentAbort.signal.aborted)currentAbort.abort(reason);
  currentAbort=null;
  running=false;
  cleanup();
  return true;
}
function onBaseline(){
  ready=true;
  cooldownUntil=Date.now()+Number(CONFIG.INITIAL_QUIET_MS??10000);
  lastStableAt=Date.now();
}
function onRealChange(){
  diagnostics.realInterrupts+=1;
  cancelIdleEvent('real-status-change');
  cooldownUntil=Date.now()+Number(CONFIG.REAL_CHANGE_COOLDOWN_MS??15000);
  lastStableAt=Date.now();
}
function onCommunicationError(){
  cancelIdleEvent('communication-error');
  cooldownUntil=Math.max(cooldownUntil,Date.now()+10000);
}
async function onStableUpdate({grid}={}){
  diagnostics.attempts+=1;
  lastStableAt=Date.now();
  if(!ready){diagnostics.skipped+=1;diagnostics.lastDecision='not-ready';return{played:false,reason:'not-ready'}}
  if(!CONFIG.ANIMATION_ENABLED||!CONFIG.IDLE_EVENTS_ENABLED||effectiveLevel()===0){diagnostics.skipped+=1;diagnostics.lastDecision='disabled';return{played:false,reason:'disabled'}}
  if(document.visibilityState==='hidden'){diagnostics.skipped+=1;diagnostics.lastDecision='hidden';return{played:false,reason:'hidden'}}
  if(Date.now()<cooldownUntil){diagnostics.skipped+=1;diagnostics.lastDecision='cooldown';return{played:false,reason:'cooldown'}}
  if(running){diagnostics.skipped+=1;diagnostics.lastDecision='idle-running';return{played:false,reason:'idle-running'}}
  if(realFxBusy()){diagnostics.skipped+=1;diagnostics.lastDecision='real-fx-busy';return{played:false,reason:'real-fx-busy'}}
  if(Math.random()>clamp(Number(CONFIG.IDLE_EVENT_CHANCE)||0,0,1)){diagnostics.none+=1;diagnostics.lastDecision='none';return{played:false,reason:'none'}}

  const tier=pickTier();
  const event=pickEvent(tier);
  if(!event){diagnostics.skipped+=1;diagnostics.lastDecision='no-event';return{played:false,reason:'no-event'}}
  diagnostics.lastDecision='play:'+event.id;
  await playIdleEvent(event,{grid:grid||document.getElementById('queueGrid')});
  return{played:true,id:event.id,tier:event.tier};
}
function pickTier(){
  const w=CONFIG.TIER_WEIGHTS||DEFAULT_CONFIG.TIER_WEIGHTS;
  const total=Number(w.small||0)+Number(w.medium||0)+Number(w.large||0)+(CONFIG.RARE_EVENTS_ENABLED?Number(w.rare||0):0);
  let r=Math.random()*Math.max(total,.0001);
  for(const tier of ['small','medium','large','rare']){
    if(tier==='rare'&&!CONFIG.RARE_EVENTS_ENABLED)continue;
    r-=Number(w[tier]||0);
    if(r<=0)return tier;
  }
  return CONFIG.RARE_EVENTS_ENABLED?'rare':'large';
}
function pickEvent(tier){
  const recent=new Set(recentIdleEvents.slice(-Number(CONFIG.RECENT_HISTORY||8)));
  let candidates=IDLE_EVENTS.filter(e=>e.tier===tier&&!recent.has(e.id));
  if(!candidates.length)candidates=IDLE_EVENTS.filter(e=>e.tier===tier);
  if(storyStage>0){
    const wanted=storyStage===1?2:storyStage===2?3:1;
    const story=candidates.filter(e=>e.story==='orb'&&e.stage===wanted);
    if(story.length&&Math.random()<.38)candidates=story;
  }
  return candidates[Math.floor(Math.random()*candidates.length)]||null;
}
async function playIdleEvent(event,{grid}={}){
  if(!event||running||realFxBusy()||document.visibilityState==='hidden')return;
  running=true;
  currentAbort=new AbortController();
  const signal=currentAbort.signal;
  const lvl=effectiveLevel();
  const directive=WORLD?.directives?.[event.id]||null;
  const stagedEvent=directive?{...event,duration:Math.max(420,Math.round(directive.coreBaseMs*.55))}:event;
  const runtimeScope=M?.createScope?.('idle-core:'+event.id)||null;
  const abortRuntime=()=>runtimeScope?.abort?.('idle-abort');
  signal.addEventListener('abort',abortRuntime,{once:true});
  diagnostics.played+=1;
  diagnostics.lastEvent={id:event.id,tier:event.tier,emotion:directive?.emotion||null,resident:directive?.resident||null,at:Date.now()};
  diagnostics.history.push({...diagnostics.lastEvent});
  diagnostics.history=diagnostics.history.slice(-40);
  recentIdleEvents.push(event.id);
  recentIdleEvents=recentIdleEvents.slice(-Number(CONFIG.RECENT_HISTORY||8));
  lastEventAt=Date.now();
  if(event.story==='orb')storyStage=event.stage||0;

  try{
    const worldJob=WORLD?.playIdleCompanion?.(stagedEvent,directive,{grid,signal,level:lvl})||Promise.resolve();
    const coreJob=playDefinition(stagedEvent,{grid,signal,level:lvl,runtimeScope});
    await Promise.allSettled([coreJob,worldJob]);
  }catch{}
  finally{
    signal.removeEventListener('abort',abortRuntime);
    runtimeScope?.cleanup?.();
    if(currentAbort?.signal===signal)currentAbort=null;
    running=false;
    cleanup();
    const quietMin=Math.max(0,Number(CONFIG.IDLE_POST_COOLDOWN_MIN_MS??6000));
    const quietMax=Math.max(quietMin,Number(CONFIG.IDLE_POST_COOLDOWN_MAX_MS??9000));
    const quietMs=quietMin+Math.floor(Math.random()*(quietMax-quietMin+1));
    cooldownUntil=Math.max(cooldownUntil,Date.now()+quietMs);
  }
}
function boardRect(){
  const shell=document.querySelector('.queue-shell');
  const r=shell?.getBoundingClientRect();
  return r||{left:0,top:0,width:window.innerWidth,height:window.innerHeight,right:window.innerWidth,bottom:window.innerHeight};
}
function createShape(def,cls=''){
  const el=document.createElement('div');
  el.className='idle-shape '+cls;
  el.dataset.shape=def.shape||'orb';
  el.style.setProperty('--idle-color',def.color||'#ffd84f');
  if(def.secondary)el.style.setProperty('--idle-color-2',def.secondary);
  layer().appendChild(el);
  return el;
}
function randomBetween(a,b){return a+Math.random()*(b-a)}
function chooseDirection(){
  return ['left','right','top','bottom'][Math.floor(Math.random()*4)];
}
function signalGuard(signal){if(signal?.aborted)throw new DOMException('Aborted','AbortError')}
async function playDefinition(def,ctx){
  signalGuard(ctx.signal);
  const players={
    pass:playPass,cloud:playCloud,cards:playCards,particles:playParticles,peek:playPeek,
    orbit:playOrbit,ring:playRing,ball:playBall,drop:playDrop,constellation:playConstellation,
    tornado:playTornado,background:playBackground,burst:playBurst,collision:playCollision,
    sequence:playSequence,depth:playDepth,'story-orb':playStoryOrb,
  };
  const fn=players[def.kind]||playPass;
  await fn(def,ctx);
}
async function playPass(def,{signal,level}){
  const r=boardRect(),direction=chooseDirection(),el=createShape(def,'idle-pass');
  const scale=(def.size||1)*(level<=1?.72:1);
  let from,to;
  if(direction==='left'||direction==='right'){
    const y=randomBetween(r.top+r.height*.15,r.bottom-r.height*.15);
    from={x:direction==='left'?r.left-160:r.right+160,y};
    to={x:direction==='left'?r.right+180:r.left-180,y:y+randomBetween(-70,70)};
  }else{
    const x=randomBetween(r.left+r.width*.12,r.right-r.width*.12);
    from={x,y:direction==='top'?r.top-160:r.bottom+160};
    to={x:x+randomBetween(-90,90),y:direction==='top'?r.bottom+180:r.top-180};
  }
  Object.assign(el.style,{left:from.x+'px',top:from.y+'px'});
  const duration=Math.max(320,def.duration*(level<=1?.72:1));
  signalGuard(signal);
  await animate(el,[
    {opacity:0,transform:`translate(-50%,-50%) scale(${scale*.75}) rotate(-12deg)`},
    {opacity:.96,offset:.15,transform:`translate(-50%,-50%) translate(${(to.x-from.x)*.12}px,${(to.y-from.y)*.12}px) scale(${scale}) rotate(0deg)`},
    {opacity:.96,offset:.78,transform:`translate(-50%,-50%) translate(${(to.x-from.x)*.78}px,${(to.y-from.y)*.78}px) scale(${scale}) rotate(8deg)`},
    {opacity:0,transform:`translate(-50%,-50%) translate(${to.x-from.x}px,${to.y-from.y}px) scale(${scale*.88}) rotate(14deg)`},
  ],{duration,easing:'cubic-bezier(.18,.76,.24,1)',fill:'forwards'});
}
async function playCloud(def,ctx){
  const el=createShape(def,'idle-cloud');
  const r=boardRect(),y=randomBetween(r.top+r.height*.12,r.top+r.height*.55);
  el.style.left=(r.left-120)+'px';el.style.top=y+'px';
  await animate(el,[{opacity:0,transform:'translate(-50%,-50%) scale(.7)'},{opacity:.72,offset:.2,transform:'translate(25vw,-50%) scale(.8)'},{opacity:.72,offset:.8,transform:'translate(80vw,-50%) scale(.85)'},{opacity:0,transform:'translate(110vw,-50%) scale(.8)'}],{duration:def.duration,easing:'linear',fill:'forwards'});
}
function cards(grid,count){
  const all=[...(grid||document.getElementById('queueGrid'))?.querySelectorAll?.('.queue-card')||[]];
  if(count>=all.length)return all;
  const start=Math.max(0,Math.floor(Math.random()*Math.max(1,all.length-count)));
  return all.slice(start,start+count);
}
async function playCards(def,{grid,signal,level}){
  const list=cards(grid,def.count||6);
  if(!list.length)return;
  const pattern=def.pattern||'wiggle';
  const promises=[];
  list.forEach((card,i)=>{
    signalGuard(signal);
    card.style.willChange='transform,filter';
    let frames;
    if(pattern==='wiggle')frames=[{transform:'rotate(0)'},{transform:'rotate(-2deg)'},{transform:'rotate(2deg)'},{transform:'rotate(0)'}];
    else if(pattern==='hop-wave'||pattern==='light-hop')frames=[{transform:'translateY(0)'},{transform:`translateY(${level<=1?-3:-8}px) scale(1.02)`},{transform:'translateY(0)'}];
    else if(pattern==='wind')frames=[{transform:'rotate(0)'},{transform:'rotate(-3deg) translateX(-2px)'},{transform:'rotate(2deg) translateX(2px)'},{transform:'rotate(0)'}];
    else if(pattern==='wave')frames=[{transform:'translateY(0)'},{transform:'translateY(-6px) rotate(-1deg)'},{transform:'translateY(3px) rotate(1deg)'},{transform:'translateY(0)'}];
    else if(pattern==='domino')frames=[{transform:'rotate(0)'},{transform:'rotate(5deg)'},{transform:'rotate(-1deg)'},{transform:'rotate(0)'}];
    else if(pattern==='sheen')frames=(M?.getEffectiveQuality?.()==='HIGH'?[{filter:'brightness(1)'},{filter:'brightness(1.28)'},{filter:'brightness(1)'}]:[{transform:'scale(1)'},{transform:'scale(1.025)'},{transform:'scale(1)'}]);
    else if(pattern==='jump-all')frames=[{transform:'translateY(0)'},{transform:`translateY(${level<=1?-4:-12}px) scale(1.025)`},{transform:'translateY(0)'}];
    else if(pattern==='float-drop')frames=[{transform:'translateY(0)'},{transform:'translateY(-7px)',offset:.45},{transform:'translateY(3px)',offset:.72},{transform:'translateY(0)'}];
    else if(pattern==='scatter')frames=[{transform:'translate(0,0) rotate(0)'},{transform:`translate(${randomBetween(-10,10)}px,${randomBetween(-8,8)}px) rotate(${randomBetween(-3,3)}deg)`},{transform:'translate(0,0) rotate(0)'}];
    else frames=[{transform:'scale(1)'},{transform:'scale(1.03)'},{transform:'scale(1)'}];
    const delay=(pattern.includes('wave')||pattern==='domino'||pattern==='hop-wave')?i*36:i*16;
    promises.push(animate(card,frames,{duration:def.duration*(level<=1?.7:1),delay,easing:'cubic-bezier(.2,.75,.24,1)'}));
  });
  await Promise.all(promises);
}
async function playParticles(def,{signal,level,runtimeScope}){
  const r=boardRect();
  const q=M?.quality?.()||{particleScale:1,maxParticles:20};
  const count=Math.max(3,Math.min(q.maxParticles,Math.floor((def.count||12)*(level<=1?.3:level===2?.65:q.particleScale))));
  const p=[];
  const palette=['#ffd84f','#ff8b31','#73dda0','#78e5ff','#ffffff'];
  for(let i=0;i<count;i++)p.push({
    x:randomBetween(r.left,r.right),
    y:def.style==='stream'?randomBetween(r.top+r.height*.25,r.top+r.height*.75):randomBetween(r.top,r.bottom),
    vx:randomBetween(-110,150),
    vy:def.style==='confetti'||def.style==='confetti-stars'?randomBetween(35,105):randomBetween(-70,60),
    size:randomBetween(7,16),
    rot:randomBetween(0,6.2),
    spin:randomBetween(-4,4),
    color:palette[i%palette.length]
  });
  const duration=def.duration*(level<=1?.7:1);
  const scope=runtimeScope||M?.createScope?.('idle-particles');
  if(!scope)return;
  try{
    await scope.canvas(duration,(ctx,progress,elapsed)=>{
      const motionT=elapsed/(M?.getSlowdown?.()||1);
      for(const a of p){
        const x=a.x+a.vx*motionT;
        const y=a.y+a.vy*motionT+(def.style==='confetti'||def.style==='confetti-stars'?36*motionT*motionT:0);
        const alpha=Math.max(0,1-progress*.92);
        ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(a.rot+a.spin*motionT);
        if(def.style==='stars'||def.style==='confetti-stars'||def.style==='sparkle')drawStar(ctx,a.size,a.color);
        else if(def.style==='smoke'){ctx.fillStyle=a.color;ctx.globalAlpha*=.28;ctx.beginPath();ctx.arc(0,0,a.size*(1+progress*1.5),0,Math.PI*2);ctx.fill()}
        else if(def.style==='dots-wave'||def.style==='stream'){ctx.fillStyle=a.color;ctx.beginPath();ctx.arc(0,Math.sin(motionT*7+a.x*.02)*12,a.size*.72,0,Math.PI*2);ctx.fill()}
        else{ctx.fillStyle=a.color;ctx.fillRect(-a.size,-a.size*.34,a.size*2,a.size*.68)}
        ctx.restore();
      }
    });
  }finally{
    if(!runtimeScope)scope.cleanup?.();
  }
}
function drawStar(ctx,r,color){
  ctx.fillStyle=color;ctx.beginPath();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2===0?r:r*.42,x=Math.cos(a)*rr,y=Math.sin(a)*rr;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}
  ctx.closePath();ctx.fill();
}
async function playPeek(def,{signal,level}){
  const r=boardRect(),el=createShape(def,'idle-peek'),side=chooseDirection();
  const scale=(def.size||1)*(level<=1?.65:1);
  let x=r.left-40,y=randomBetween(r.top+70,r.bottom-70),tx=55,ty=0;
  if(side==='right'){x=r.right+40;tx=-55}
  if(side==='top'){x=randomBetween(r.left+70,r.right-70);y=r.top-40;tx=0;ty=55}
  if(side==='bottom'){x=randomBetween(r.left+70,r.right-70);y=r.bottom+40;tx=0;ty=-55}
  el.style.left=x+'px';el.style.top=y+'px';
  await animate(el,[{opacity:0,transform:`translate(-50%,-50%) scale(${scale*.8})`},{opacity:.9,offset:.28,transform:`translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(${scale})`},{opacity:.9,offset:.68,transform:`translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(${scale})`},{opacity:0,transform:`translate(-50%,-50%) scale(${scale*.85})`}],{duration:def.duration*(level<=1?.72:1),easing:'ease-in-out',fill:'forwards'});
}
async function playOrbit(def,{grid,signal,level,runtimeScope}){
  const target=cards(grid,1)[0];if(!target)return;
  const r=target.getBoundingClientRect(),el=createShape(def,'idle-orbit');
  el.style.left=(r.left+r.width/2)+'px';el.style.top=(r.top+r.height/2)+'px';
  const radius=Math.max(22,Math.min(r.width,r.height)*.72);
  const scope=runtimeScope||M?.createScope?.('idle-orbit');
  if(!scope)return;
  try{
    await scope.raf(def.duration*(level<=1?.7:1),(progress)=>{
      const a=progress*Math.PI*2;
      el.style.transform=`translate(-50%,-50%) translate(${Math.cos(a)*radius}px,${Math.sin(a)*radius}px) scale(${(def.size||1)*(level<=1?.65:1)})`;
      el.style.opacity=String(Math.sin(progress*Math.PI));
    });
  }finally{
    if(!runtimeScope)scope.cleanup?.();
  }
}
async function playRing(def,{signal,level}){
  const r=boardRect(),el=createShape(def,'idle-ring');
  el.style.left=randomBetween(r.left+r.width*.28,r.right-r.width*.28)+'px';
  el.style.top=randomBetween(r.top+r.height*.25,r.bottom-r.height*.25)+'px';
  const scale=(def.size||1)*(level<=1?.55:1);
  await animate(el,[{opacity:.8,transform:'translate(-50%,-50%) scale(.08)'},{opacity:.55,offset:.45,transform:`translate(-50%,-50%) scale(${scale})`},{opacity:0,transform:`translate(-50%,-50%) scale(${scale*1.45})`}],{duration:def.duration*(level<=1?.7:1),easing:'cubic-bezier(.15,.7,.2,1)',fill:'forwards'});
}
async function playBall(def,{signal,level}){
  const r=boardRect(),el=createShape({...def,shape:'ball'},'idle-ball');
  const scale=(def.size||1)*(level<=1?.7:1);
  el.style.left=(r.left-70)+'px';el.style.top=(r.top+r.height*.25)+'px';
  const b=def.bounces||3;
  const frames=[];
  for(let i=0;i<=b*2;i++){const q=i/(b*2);frames.push({offset:q,opacity:i===0||i===b*2?0:1,transform:`translate(calc(-50% + ${q*(r.width+150)}px),calc(-50% + ${Math.sin(q*Math.PI*b)*-Math.min(110,r.height*.28)+q*r.height*.5}px)) scale(${scale}) rotate(${q*540}deg)`})}
  await animate(el,frames,{duration:def.duration*(level<=1?.72:1),easing:'linear',fill:'forwards'});
}
async function playDrop(def,{signal,level}){
  const r=boardRect(),el=createShape(def,'idle-drop');
  const x=randomBetween(r.left+r.width*.18,r.right-r.width*.18),scale=(def.size||1)*(level<=1?.65:1);
  el.style.left=x+'px';el.style.top=(r.top-120)+'px';
  await animate(el,[{opacity:0,transform:`translate(-50%,-50%) translateY(-40px) scale(${scale*.75})`},{opacity:1,offset:.18,transform:`translate(-50%,-50%) translateY(20px) scale(${scale})`},{opacity:1,offset:.58,transform:`translate(-50%,-50%) translateY(${r.height*.62}px) scale(${scale*1.05})`},{opacity:0,transform:`translate(-50%,-50%) translateY(${r.height*.72}px) scale(${scale*.9})`}],{duration:def.duration*(level<=1?.72:1),easing:'cubic-bezier(.22,.78,.25,1)',fill:'forwards'});
  if(level>=2&&!reduced){const board=document.querySelector('.board');void animate(board,[{transform:'translateY(0)'},{transform:'translateY(2px)'},{transform:'translateY(-1px)'},{transform:'translateY(0)'}],{duration:140})}
}
async function playConstellation(def,{signal,level}){
  const r=boardRect(),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('idle-svg');svg.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);svg.style.left=r.left+'px';svg.style.top=r.top+'px';layer().appendChild(svg);
  const q=M?.quality?.()||{decorations:1};const pointCount=Math.max(4,Math.min(6,Math.round((level<=1?4:6)*q.decorations)));
  const pts=[];for(let i=0;i<pointCount;i++)pts.push([randomBetween(r.width*.08,r.width*.92),randomBetween(r.height*.12,r.height*.88)]);
  for(let i=0;i<pts.length-1;i++){const line=document.createElementNS(svg.namespaceURI,'line');line.setAttribute('x1',pts[i][0]);line.setAttribute('y1',pts[i][1]);line.setAttribute('x2',pts[i+1][0]);line.setAttribute('y2',pts[i+1][1]);line.setAttribute('stroke',def.color||'#78e5ff');line.setAttribute('stroke-width','2');line.setAttribute('stroke-dasharray','8 12');line.setAttribute('opacity','.65');svg.appendChild(line)}
  for(const [x,y] of pts){const c=document.createElementNS(svg.namespaceURI,'circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r','4');c.setAttribute('fill','#fff');svg.appendChild(c)}
  await animate(svg,[{opacity:0},{opacity:.8,offset:.35},{opacity:.8,offset:.7},{opacity:0}],{duration:def.duration*(level<=1?.72:1),fill:'forwards'});
}
async function playTornado(def,{signal,level}){
  const r=boardRect(),el=createShape(def,'idle-tornado');
  el.style.left=(r.left+r.width*.18)+'px';el.style.top=(r.bottom-30)+'px';
  const dist=r.width*.68,scale=level<=1?.6:1;
  await animate(el,[{opacity:0,transform:`translate(-50%,-50%) scale(${scale*.6}) rotate(0)`},{opacity:.7,offset:.18,transform:`translate(-50%,-50%) translateX(${dist*.18}px) scale(${scale}) rotate(180deg)`},{opacity:.7,offset:.78,transform:`translate(-50%,-50%) translateX(${dist*.78}px) scale(${scale}) rotate(720deg)`},{opacity:0,transform:`translate(-50%,-50%) translateX(${dist}px) scale(${scale*.8}) rotate(900deg)`}],{duration:def.duration*(level<=1?.72:1),easing:'linear',fill:'forwards'});
}
async function playBackground(def,{signal,level}){
  const el=document.createElement('div');el.className='idle-background '+(def.style||'radial');el.style.setProperty('--idle-color',def.color||'#78e5ff');layer().appendChild(el);
  await animate(el,[{opacity:0,transform:'scale(1.04)'},{opacity:level<=1?.16:.42,offset:.3,transform:'scale(1)'},{opacity:level<=1?.12:.34,offset:.72,transform:'scale(1.02)'},{opacity:0,transform:'scale(1.05)'}],{duration:def.duration*(level<=1?.7:1),easing:'ease-in-out',fill:'forwards'});
}
async function playBurst(def,ctx){
  await Promise.all([
    playRing({...def,size:def.tier==='rare'?2.6:1.8,duration:def.duration*.85},ctx),
    playParticles({...def,style:def.style==='smoke-star'?'smoke':'stars',count:def.count||38,duration:def.duration},ctx),
  ]);
}
async function playCollision(def,{signal,level}){
  const r=boardRect(),a=createShape({...def,shape:'orb'},'idle-collision'),b=createShape({...def,shape:'orb',color:def.secondary||'#73dda0'},'idle-collision');
  a.style.left=(r.left-80)+'px';b.style.left=(r.right+80)+'px';a.style.top=b.style.top=(r.top+r.height*.52)+'px';
  const dx=r.width*.5+80;
  await Promise.all([
    animate(a,[{opacity:0,transform:'translate(-50%,-50%)'},{opacity:1,offset:.3,transform:`translate(calc(-50% + ${dx*.7}px),-50%)`},{opacity:0,transform:`translate(calc(-50% + ${dx}px),-50%) scale(.4)`}],{duration:def.duration,fill:'forwards'}),
    animate(b,[{opacity:0,transform:'translate(-50%,-50%)'},{opacity:1,offset:.3,transform:`translate(calc(-50% - ${dx*.7}px),-50%)`},{opacity:0,transform:`translate(calc(-50% - ${dx}px),-50%) scale(.4)`}],{duration:def.duration,fill:'forwards'}),
    (async()=>{await wait(Math.floor(def.duration*.55),signal);await playRing({...def,size:1.5,duration:520},{signal,level})})(),
  ]);
}
async function playSequence(def,ctx){
  const steps=def.steps||[];
  for(const step of steps){
    signalGuard(ctx.signal);
    if(step==='pass')await playPass({...def,shape:'orb',duration:420},ctx);
    else if(step==='ring')await playRing({...def,size:1.3,duration:460},ctx);
    else if(step==='particles')await playParticles({...def,style:'stars',count:22,duration:520},ctx);
    else if(step==='burst')await playBurst({...def,count:30,duration:620},ctx);
    else if(step==='jump-all')await playCards({...def,pattern:'jump-all',count:999,duration:620},ctx);
    else if(step==='triple-pass')await Promise.all([0,1,2].map(async(_,i)=>{await wait(i*130,ctx.signal);await playPass({...def,shape:i===1?'star':'orb',duration:520},{...ctx})}));
  }
}
async function playDepth(def,{signal,level}){
  const r=boardRect(),q=M?.quality?.()||{decorations:1},count=def.shape==='stars'?(level<=1?4:Math.max(4,Math.min(12,Math.round(12*q.decorations)))):1,promises=[];
  for(let i=0;i<count;i++){
    const el=createShape({...def,shape:def.shape==='stars'?'star':def.shape},'idle-depth');
    el.style.left=randomBetween(r.left+r.width*.12,r.right-r.width*.12)+'px';el.style.top=randomBetween(r.top+r.height*.12,r.bottom-r.height*.12)+'px';
    promises.push(animate(el,[{opacity:0,transform:'translate(-50%,-50%) scale(.04)'},{opacity:.85,offset:.42,transform:`translate(-50%,-50%) scale(${(def.size||1)*(level<=1?.6:1)*.48})`},{opacity:0,transform:`translate(-50%,-50%) scale(${(def.size||1)*(level<=1?.8:1)})`}],{duration:def.duration*(level<=1?.72:1),delay:i*18,easing:'cubic-bezier(.12,.72,.2,1)',fill:'forwards'}));
  }
  await Promise.all(promises);
}
async function playStoryOrb(def,ctx){
  if(def.stage===1)await playPeek({...def,shape:'eye'},ctx);
  else if(def.stage===2)await playPass({...def,shape:'orb'},ctx);
  else await playDrop({...def,shape:'orb'},ctx);
}

function setConfig(patch={}){
  for(const key of ['ANIMATION_ENABLED','IDLE_EVENTS_ENABLED','RARE_EVENTS_ENABLED'])if(key in patch)CONFIG[key]=Boolean(patch[key]);
  if('ANIMATION_LEVEL'in patch)CONFIG.ANIMATION_LEVEL=clamp(Math.round(Number(patch.ANIMATION_LEVEL)||0),0,3);
  if('IDLE_EVENT_CHANCE'in patch)CONFIG.IDLE_EVENT_CHANCE=clamp(Number(patch.IDLE_EVENT_CHANCE)||0,0,1);
  if('REAL_CHANGE_COOLDOWN_MS'in patch)CONFIG.REAL_CHANGE_COOLDOWN_MS=clamp(Number(patch.REAL_CHANGE_COOLDOWN_MS)||0,0,120000);
  if('INITIAL_QUIET_MS'in patch)CONFIG.INITIAL_QUIET_MS=clamp(Number(patch.INITIAL_QUIET_MS)||0,0,120000);
  if('IDLE_POST_COOLDOWN_MIN_MS'in patch)CONFIG.IDLE_POST_COOLDOWN_MIN_MS=clamp(Number(patch.IDLE_POST_COOLDOWN_MIN_MS)||0,0,120000);
  if('IDLE_POST_COOLDOWN_MAX_MS'in patch)CONFIG.IDLE_POST_COOLDOWN_MAX_MS=clamp(Number(patch.IDLE_POST_COOLDOWN_MAX_MS)||0,0,120000);
  if(CONFIG.IDLE_POST_COOLDOWN_MAX_MS<CONFIG.IDLE_POST_COOLDOWN_MIN_MS)CONFIG.IDLE_POST_COOLDOWN_MAX_MS=CONFIG.IDLE_POST_COOLDOWN_MIN_MS;
  persist();return getConfig();
}
function getConfig(){return{ANIMATION_ENABLED:Boolean(CONFIG.ANIMATION_ENABLED),ANIMATION_LEVEL:Number(CONFIG.ANIMATION_LEVEL),IDLE_EVENTS_ENABLED:Boolean(CONFIG.IDLE_EVENTS_ENABLED),IDLE_EVENT_CHANCE:Number(CONFIG.IDLE_EVENT_CHANCE),RARE_EVENTS_ENABLED:Boolean(CONFIG.RARE_EVENTS_ENABLED),REAL_CHANGE_COOLDOWN_MS:Number(CONFIG.REAL_CHANGE_COOLDOWN_MS),INITIAL_QUIET_MS:Number(CONFIG.INITIAL_QUIET_MS),IDLE_POST_COOLDOWN_MIN_MS:Number(CONFIG.IDLE_POST_COOLDOWN_MIN_MS),IDLE_POST_COOLDOWN_MAX_MS:Number(CONFIG.IDLE_POST_COOLDOWN_MAX_MS),TIER_WEIGHTS:{...CONFIG.TIER_WEIGHTS}}}
function getDiagnostics(){const audit=WORLD?.audit?.(IDLE_EVENTS)||[];return{...diagnostics,history:diagnostics.history.map(x=>({...x})),running,recentIdleEvents:[...recentIdleEvents],cooldownRemainingMs:Math.max(0,cooldownUntil-Date.now()),eventCount:IDLE_EVENTS.length,reduced,effectiveLevel:effectiveLevel(),storyStage,lastEventAt,activeAnimations:activeAnimations.size,activeTimers:activeTimers.size,visibilityState:document.visibilityState,ready,realFxBusy:realFxBusy(),globalSlowdown:M?.getSlowdown?.()||1,qualityLevel:M?.getQuality?.()||'AUTO',effectiveQuality:M?.getEffectiveQuality?.()||'HIGH',auditCount:audit.length,fullScreenCount:audit.filter(x=>x.fullScreen).length,slowdownCoverage:audit.filter(x=>x.slowdown).length,cleanupCoverage:audit.filter(x=>x.cleanup).length,emotionCounts:WORLD?.diagnostics?.(IDLE_EVENTS)?.emotionCounts||{}}}
function resetForTest(){
  cancelIdleEvent('test-reset');ready=false;running=false;currentAbort=null;recentIdleEvents=[];cooldownUntil=0;lastStableAt=0;sequence=0;storyStage=0;lastEventAt=0;
  for(const k of Object.keys(diagnostics)){if(typeof diagnostics[k]==='number')diagnostics[k]=0}
  diagnostics.lastEvent=null;diagnostics.history=[];
}

document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelIdleEvent('hidden')});

window.ASOBOON_BOARD_IDLE_EVENTS=Object.freeze({
  version:'1.0.0',
  events:IDLE_EVENTS,
  onBaseline,
  onRealChange,
  onStableUpdate,
  onCommunicationError,
  cancelIdleEvent,
  setConfig,
  getConfig,
  getDiagnostics,
  resetForTest,
  audit:()=>WORLD?.audit?.(IDLE_EVENTS)||[],
  playEventForTest:async(id,{grid=document.getElementById('queueGrid')}={})=>{
    const event=IDLE_EVENTS.find(x=>x.id===String(id||''));
    if(!event)throw new Error('UNKNOWN_IDLE_EVENT:'+id);
    const prevRunning=running;
    if(prevRunning)cancelIdleEvent('test-force');
    const prevQuiet=cooldownUntil;
    cooldownUntil=0;
    try{
      await playIdleEvent(event,{grid});
      return {id:event.id,played:true};
    }finally{
      cooldownUntil=prevQuiet;
    }
  },
});
})();
