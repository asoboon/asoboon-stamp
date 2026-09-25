(()=>{'use strict';

const IDLE=window.ASOBOON_BOARD_IDLE_EVENTS;
const CHAR=window.ASOBOON_BOARD_CHARACTER_EVENTS;
const ASSETS=window.ASOBOON_BOARD_CHARACTER_ASSETS;
if(!IDLE||!CHAR)return;

const CHARACTER_CATEGORIES=new Set(['POMPON_CAMEO','CHIRU_CAMEO','POMPON_STORY','DUO_STORY','RARE_STORY']);
const STORY_CATEGORIES=new Set(['POMPON_STORY','DUO_STORY','RARE_STORY']);
const DEFAULT_WEIGHTS=Object.freeze({
  WORLD:65,
  POMPON_CAMEO:13,
  CHIRU_CAMEO:7,
  POMPON_STORY:7,
  DUO_STORY:5,
  RARE_STORY:3,
});
const CONFIG={
  weights:{...DEFAULT_WEIGHTS},
  REAL_CHANGE_COOLDOWN_MS:15000,
  CHARACTER_FORCE_AFTER_MS:60000,
  POMPON_STORY_MIN_MS:30000,
  DUO_STORY_MIN_MS:40000,
  RARE_STORY_MIN_MS:180000,
  RECENT_BEATS:8,
  MAX_CHAR_IN_LAST_FIVE:3,
};

let ready=false;
let cooldownUntil=0;
let lastCharacterAt=0;
let lastPomponStoryAt=0;
let lastDuoStoryAt=0;
let lastRareAt=0;
let beatHistory=[];
let eventHistory=[];
let sequence=0;
const diagnostics={
  attempts:0,played:0,world:0,character:0,skipped:0,realInterrupts:0,suspends:0,
  lastDecision:'none',lastEvent:null,history:[],
};

function isCharacter(category){return CHARACTER_CATEGORIES.has(String(category||''))}
function isStory(category){return STORY_CATEGORIES.has(String(category||''))}
function statusFxBusy(){
  const d=window.ASOBOON_BOARD_ANIMATIONS?.getDiagnostics?.();
  return Boolean(d&&(Number(d.activeFx||0)>0||Number(d.queuedNow||0)>0||Number(d.running||0)>0));
}
function recentCharacterCount(list=beatHistory,n=5){
  return list.slice(-n).filter(x=>isCharacter(x.category)).length;
}
function consecutiveCharacters(list=beatHistory){
  let n=0;
  for(let i=list.length-1;i>=0;i--){if(isCharacter(list[i].category))n++;else break}
  return n;
}
function weightedPick(weights,random=Math.random){
  const entries=Object.entries(weights).filter(([,v])=>Number(v)>0);
  const total=entries.reduce((n,[,v])=>n+Number(v),0);
  if(total<=0)return'WORLD';
  let r=random()*total;
  for(const [key,value] of entries){r-=Number(value);if(r<=0)return key}
  return entries.at(-1)?.[0]||'WORLD';
}
function eligibleWeights(now,list=beatHistory,state=null){
  const st=state||{lastCharacterAt,lastPomponStoryAt,lastDuoStoryAt,lastRareAt};
  const w={...CONFIG.weights};
  if(recentCharacterCount(list,5)>=CONFIG.MAX_CHAR_IN_LAST_FIVE||consecutiveCharacters(list)>=2){
    for(const k of CHARACTER_CATEGORIES)w[k]=0;
    w.WORLD=Math.max(1,w.WORLD);
    return w;
  }
  if(now-Number(st.lastPomponStoryAt||0)<CONFIG.POMPON_STORY_MIN_MS)w.POMPON_STORY=0;
  if(now-Number(st.lastDuoStoryAt||0)<CONFIG.DUO_STORY_MIN_MS)w.DUO_STORY=0;
  if(now-Number(st.lastRareAt||0)<CONFIG.RARE_STORY_MIN_MS)w.RARE_STORY=0;

  if(now-Number(st.lastCharacterAt||0)>=CONFIG.CHARACTER_FORCE_AFTER_MS){
    w.WORLD=0;
    const charTotal=[...CHARACTER_CATEGORIES].reduce((n,k)=>n+Number(w[k]||0),0);
    if(charTotal<=0){w.POMPON_CAMEO=1}
  }
  return w;
}
function recordBeat(category,eventId,now=Date.now()){
  const row={sequence:++sequence,category:String(category||'WORLD'),eventId:String(eventId||''),at:now};
  beatHistory.push(row);beatHistory=beatHistory.slice(-Math.max(12,CONFIG.RECENT_BEATS*2));
  if(eventId){eventHistory.push(String(eventId));eventHistory=eventHistory.slice(-CONFIG.RECENT_BEATS)}
  if(isCharacter(row.category)){
    lastCharacterAt=now;
    if(row.category==='POMPON_STORY')lastPomponStoryAt=now;
    if(row.category==='DUO_STORY')lastDuoStoryAt=now;
    if(row.category==='RARE_STORY')lastRareAt=now;
  }
  diagnostics.lastDecision=row.category;
  diagnostics.lastEvent=row;
  diagnostics.history.push({...row});
  diagnostics.history=diagnostics.history.slice(-60);
  return row;
}
function chooseCategory(now=Date.now(),random=Math.random){
  return weightedPick(eligibleWeights(now),random);
}
function recentCharacterEvents(){
  return eventHistory.filter(Boolean).slice(-CONFIG.RECENT_BEATS);
}
async function playCharacterCategory(category,grid){
  const recent=recentCharacterEvents();
  if(category==='RARE_STORY'){
    const choices=['BALL_RIDE_FAIL','DUO_CHASE_CRASH','PEEK_DISCOVERY'];
    const filtered=choices.filter(x=>!recent.includes(x));
    const id=(filtered.length?filtered:choices)[Math.floor(Math.random()*(filtered.length||choices.length))];
    return CHAR.play(id,{grid});
  }
  return CHAR.playRandom(category,{grid,recent});
}

async function onStableUpdate({grid}={}){
  diagnostics.attempts+=1;
  const now=Date.now();
  if(!ready){diagnostics.skipped+=1;diagnostics.lastDecision='not-ready';return{played:false,reason:'not-ready'}}
  if(document.visibilityState==='hidden'){diagnostics.skipped+=1;diagnostics.lastDecision='hidden';return{played:false,reason:'hidden'}}
  if(now<cooldownUntil){diagnostics.skipped+=1;diagnostics.lastDecision='cooldown';return{played:false,reason:'cooldown'}}
  if(CHAR.isRunning?.()||IDLE.getDiagnostics?.().running){diagnostics.skipped+=1;diagnostics.lastDecision='busy';return{played:false,reason:'busy'}}
  if(statusFxBusy()){diagnostics.skipped+=1;diagnostics.lastDecision='real-fx-busy';return{played:false,reason:'real-fx-busy'}}

  const category=chooseCategory(now);
  let result;
  if(category==='WORLD'){
    result=await IDLE.playWorldForDirector?.({grid:grid||document.getElementById('queueGrid')});
  }else{
    result=await playCharacterCategory(category,grid||document.getElementById('queueGrid'));
  }
  if(result?.played){
    diagnostics.played+=1;
    if(category==='WORLD')diagnostics.world+=1;else diagnostics.character+=1;
    recordBeat(category,result.id||'',now);
    return{played:true,category,id:result.id||''};
  }
  diagnostics.skipped+=1;
  diagnostics.lastDecision='play-failed:'+category;
  return{played:false,reason:result?.reason||'play-failed',category};
}
function onBaseline(){
  ready=true;
  const now=Date.now();
  cooldownUntil=now+10000;
  if(!lastCharacterAt)lastCharacterAt=now;
  IDLE.onBaseline?.();
  const warm=()=>void ASSETS?.preloadAll?.();
  if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:4000});else setTimeout(warm,500);
}
function onRealChange(){
  diagnostics.realInterrupts+=1;
  CHAR.cancel?.('real-status-change');
  IDLE.onRealChange?.();
  cooldownUntil=Date.now()+CONFIG.REAL_CHANGE_COOLDOWN_MS;
}
function onCommunicationError(){
  CHAR.cancel?.('communication-error');
  IDLE.onCommunicationError?.();
  cooldownUntil=Math.max(cooldownUntil,Date.now()+10000);
}
function suspend(reason='inactive'){
  diagnostics.suspends+=1;
  ready=false;
  CHAR.cancel?.('director-suspend:'+reason);
  IDLE.cancelIdleEvent?.('director-suspend:'+reason);
}
function setConfig(patch={}){
  if(patch.weights&&typeof patch.weights==='object'){
    for(const k of Object.keys(DEFAULT_WEIGHTS))if(k in patch.weights)CONFIG.weights[k]=Math.max(0,Number(patch.weights[k])||0);
  }
  for(const k of ['REAL_CHANGE_COOLDOWN_MS','CHARACTER_FORCE_AFTER_MS','POMPON_STORY_MIN_MS','DUO_STORY_MIN_MS','RARE_STORY_MIN_MS']){
    if(k in patch)CONFIG[k]=Math.max(0,Number(patch[k])||0);
  }
  if('MAX_CHAR_IN_LAST_FIVE'in patch)CONFIG.MAX_CHAR_IN_LAST_FIVE=Math.max(0,Math.min(5,Math.round(Number(patch.MAX_CHAR_IN_LAST_FIVE)||0)));
  return getConfig();
}
function getConfig(){return{...CONFIG,weights:{...CONFIG.weights}}}
function getDiagnostics(){
  return{
    ...diagnostics,history:diagnostics.history.map(x=>({...x})),ready,
    cooldownRemainingMs:Math.max(0,cooldownUntil-Date.now()),
    beatHistory:beatHistory.map(x=>({...x})),eventHistory:[...eventHistory],
    lastCharacterAt,lastPomponStoryAt,lastDuoStoryAt,lastRareAt,
    characterRate:diagnostics.played?diagnostics.character/diagnostics.played:0,
  };
}
function resetForTest(){
  CHAR.cancel?.('test-reset');IDLE.cancelIdleEvent?.('test-reset');
  ready=true;cooldownUntil=0;lastCharacterAt=Date.now();lastPomponStoryAt=0;lastDuoStoryAt=0;lastRareAt=0;beatHistory=[];eventHistory=[];sequence=0;
  for(const k of Object.keys(diagnostics)){if(typeof diagnostics[k]==='number')diagnostics[k]=0}
  diagnostics.lastDecision='none';diagnostics.lastEvent=null;diagnostics.history=[];
}
function simulateForTest(beats=10000,seed=12345){
  let s=(Number(seed)||1)>>>0;
  const rand=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296};
  const list=[];
  let st={lastCharacterAt:0,lastPomponStoryAt:0,lastDuoStoryAt:0,lastRareAt:0};
  const counts={WORLD:0,POMPON_CAMEO:0,CHIRU_CAMEO:0,POMPON_STORY:0,DUO_STORY:0,RARE_STORY:0};
  let maxGap=0,lastCharBeat=0;
  for(let i=1;i<=Math.max(1,beats);i++){
    const now=i*10000;
    const weights=(()=>{
      const w={...CONFIG.weights};
      const recentChar=list.slice(-5).filter(x=>isCharacter(x.category)).length;
      let consecutive=0;for(let j=list.length-1;j>=0;j--){if(isCharacter(list[j].category))consecutive++;else break}
      if(recentChar>=CONFIG.MAX_CHAR_IN_LAST_FIVE||consecutive>=2){for(const k of CHARACTER_CATEGORIES)w[k]=0;w.WORLD=Math.max(1,w.WORLD);return w}
      if(now-st.lastPomponStoryAt<CONFIG.POMPON_STORY_MIN_MS)w.POMPON_STORY=0;
      if(now-st.lastDuoStoryAt<CONFIG.DUO_STORY_MIN_MS)w.DUO_STORY=0;
      if(now-st.lastRareAt<CONFIG.RARE_STORY_MIN_MS)w.RARE_STORY=0;
      if(now-st.lastCharacterAt>=CONFIG.CHARACTER_FORCE_AFTER_MS){w.WORLD=0;if([...CHARACTER_CATEGORIES].reduce((n,k)=>n+(w[k]||0),0)<=0)w.POMPON_CAMEO=1}
      return w;
    })();
    const category=weightedPick(weights,rand);
    counts[category]=(counts[category]||0)+1;
    list.push({category,at:now});if(list.length>16)list.shift();
    if(isCharacter(category)){
      maxGap=Math.max(maxGap,(i-lastCharBeat)*10);lastCharBeat=i;st.lastCharacterAt=now;
      if(category==='POMPON_STORY')st.lastPomponStoryAt=now;
      if(category==='DUO_STORY')st.lastDuoStoryAt=now;
      if(category==='RARE_STORY')st.lastRareAt=now;
    }
  }
  maxGap=Math.max(maxGap,(Math.max(1,beats)-lastCharBeat)*10);
  const character=Object.entries(counts).filter(([k])=>isCharacter(k)).reduce((n,[,v])=>n+v,0);
  return{beats:Math.max(1,beats),counts,characterRate:character/Math.max(1,beats),maxCharacterGapSeconds:maxGap};
}

window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR=Object.freeze({
  version:'1.0.0',onBaseline,onRealChange,onStableUpdate,onCommunicationError,suspend,
  setConfig,getConfig,getDiagnostics,resetForTest,simulateForTest,
});
})();