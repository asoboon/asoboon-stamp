(()=>{'use strict';
const CHAR=window.ASOBOON_BOARD_CHARACTER_EVENTS;
const SOURCEFX=window.ASOBOON_BOARD_SOURCE_EFFECTS;
const ASSETS=window.ASOBOON_BOARD_CHARACTER_ASSETS;
const LEGACY_IDLE=window.ASOBOON_BOARD_IDLE_EVENTS||null;
if(!CHAR||!SOURCEFX)return;

const CHARACTER_CATEGORIES=new Set(['POMPON_CAMEO','CHIRU_CAMEO','POMPON_STORY','DUO_STORY','RARE_STORY']);
const DEFAULT_WEIGHTS=Object.freeze({SOURCE_FX:65,POMPON_CAMEO:13,CHIRU_CAMEO:7,POMPON_STORY:7,DUO_STORY:5,RARE_STORY:3});
const CONFIG={weights:{...DEFAULT_WEIGHTS},REAL_CHANGE_COOLDOWN_MS:15000,CHARACTER_FORCE_AFTER_MS:60000,POMPON_STORY_MIN_MS:30000,DUO_STORY_MIN_MS:40000,RARE_STORY_MIN_MS:180000,RECENT_BEATS:8,MAX_CHAR_IN_LAST_FIVE:3};
let ready=false,cooldownUntil=0,lastCharacterAt=0,lastPomponStoryAt=0,lastDuoStoryAt=0,lastRareAt=0,beatHistory=[],eventHistory=[],sequence=0;
const diagnostics={attempts:0,played:0,sourceFx:0,character:0,skipped:0,realInterrupts:0,suspends:0,lastDecision:'none',lastEvent:null,history:[]};

function isCharacter(c){return CHARACTER_CATEGORIES.has(String(c||''))}
function statusFxBusy(){const d=window.ASOBOON_BOARD_ANIMATIONS?.getDiagnostics?.();return Boolean(d&&(Number(d.activeFx||0)>0||Number(d.queuedNow||0)>0||Number(d.running||0)>0))}
function recentCharacterCount(list=beatHistory,n=5){return list.slice(-n).filter(x=>isCharacter(x.category)).length}
function consecutiveCharacters(list=beatHistory){let n=0;for(let i=list.length-1;i>=0;i--){if(isCharacter(list[i].category))n++;else break}return n}
function weightedPick(weights,random=Math.random){const e=Object.entries(weights).filter(([,v])=>Number(v)>0),total=e.reduce((n,[,v])=>n+Number(v),0);if(total<=0)return'SOURCE_FX';let r=random()*total;for(const [k,v] of e){r-=Number(v);if(r<=0)return k}return e.at(-1)?.[0]||'SOURCE_FX'}
function eligibleWeights(now,list=beatHistory,state=null){
  const st=state||{lastCharacterAt,lastPomponStoryAt,lastDuoStoryAt,lastRareAt},w={...CONFIG.weights};
  if(recentCharacterCount(list,5)>=CONFIG.MAX_CHAR_IN_LAST_FIVE||consecutiveCharacters(list)>=2){for(const k of CHARACTER_CATEGORIES)w[k]=0;w.SOURCE_FX=Math.max(1,w.SOURCE_FX);return w}
  if(now-Number(st.lastPomponStoryAt||0)<CONFIG.POMPON_STORY_MIN_MS)w.POMPON_STORY=0;
  if(now-Number(st.lastDuoStoryAt||0)<CONFIG.DUO_STORY_MIN_MS)w.DUO_STORY=0;
  if(now-Number(st.lastRareAt||0)<CONFIG.RARE_STORY_MIN_MS)w.RARE_STORY=0;
  if(now-Number(st.lastCharacterAt||0)>=CONFIG.CHARACTER_FORCE_AFTER_MS){w.SOURCE_FX=0;if([...CHARACTER_CATEGORIES].reduce((n,k)=>n+Number(w[k]||0),0)<=0)w.POMPON_CAMEO=1}
  return w;
}
function recordBeat(category,eventId,now=Date.now()){
  const row={sequence:++sequence,category:String(category),eventId:String(eventId||''),at:now};beatHistory.push(row);beatHistory=beatHistory.slice(-16);
  if(eventId){eventHistory.push(String(eventId));eventHistory=eventHistory.slice(-CONFIG.RECENT_BEATS)}
  if(isCharacter(category)){lastCharacterAt=now;if(category==='POMPON_STORY')lastPomponStoryAt=now;if(category==='DUO_STORY')lastDuoStoryAt=now;if(category==='RARE_STORY')lastRareAt=now}
  diagnostics.lastDecision=category;diagnostics.lastEvent=row;diagnostics.history.push({...row});diagnostics.history=diagnostics.history.slice(-60);return row;
}
function chooseCategory(now=Date.now(),random=Math.random){return weightedPick(eligibleWeights(now),random)}
function recentEvents(){return eventHistory.slice(-CONFIG.RECENT_BEATS)}
async function playCharacter(category,grid){
  return CHAR.playRandom(category,{grid,recent:recentEvents()});
}
async function onStableUpdate({grid}={}){
  diagnostics.attempts++;const now=Date.now();
  if(!ready){diagnostics.skipped++;diagnostics.lastDecision='not-ready';return{played:false,reason:'not-ready'}}
  if(document.visibilityState==='hidden'){diagnostics.skipped++;diagnostics.lastDecision='hidden';return{played:false,reason:'hidden'}}
  if(now<cooldownUntil){diagnostics.skipped++;diagnostics.lastDecision='cooldown';return{played:false,reason:'cooldown'}}
  if(CHAR.isRunning?.()||SOURCEFX.isRunning?.()){diagnostics.skipped++;diagnostics.lastDecision='busy';return{played:false,reason:'busy'}}
  if(statusFxBusy()){diagnostics.skipped++;diagnostics.lastDecision='real-fx-busy';return{played:false,reason:'real-fx-busy'}}
  const category=chooseCategory(now);
  const result=category==='SOURCE_FX'?await SOURCEFX.playRandom({recent:recentEvents()}):await playCharacter(category,grid||document.getElementById('queueGrid'));
  if(result?.played){diagnostics.played++;if(category==='SOURCE_FX')diagnostics.sourceFx++;else diagnostics.character++;recordBeat(category,result.id||'',now);return{played:true,category,id:result.id||''}}
  diagnostics.skipped++;diagnostics.lastDecision='play-failed:'+category;return{played:false,category,reason:result?.reason||'play-failed'};
}
function onBaseline(){ready=true;const now=Date.now();cooldownUntil=now+10000;if(!lastCharacterAt)lastCharacterAt=now;const warm=()=>void ASSETS?.preloadAll?.();if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:4000});else setTimeout(warm,500)}
function onRealChange(){diagnostics.realInterrupts++;CHAR.cancel?.('real-status-change');SOURCEFX.cancel?.('real-status-change');LEGACY_IDLE?.onRealChange?.();cooldownUntil=Date.now()+CONFIG.REAL_CHANGE_COOLDOWN_MS}
function onCommunicationError(){CHAR.cancel?.('communication-error');SOURCEFX.cancel?.('communication-error');LEGACY_IDLE?.onCommunicationError?.();cooldownUntil=Math.max(cooldownUntil,Date.now()+10000)}
function suspend(reason='inactive'){diagnostics.suspends++;ready=false;CHAR.cancel?.('director-suspend:'+reason);SOURCEFX.cancel?.('director-suspend:'+reason);LEGACY_IDLE?.cancelIdleEvent?.('director-suspend:'+reason)}
function setConfig(patch={}){
  if(patch.weights&&typeof patch.weights==='object'){
    const incoming={...patch.weights};if('WORLD'in incoming&&!('SOURCE_FX'in incoming))incoming.SOURCE_FX=incoming.WORLD;
    for(const k of Object.keys(DEFAULT_WEIGHTS))if(k in incoming)CONFIG.weights[k]=Math.max(0,Number(incoming[k])||0);
  }
  for(const k of ['REAL_CHANGE_COOLDOWN_MS','CHARACTER_FORCE_AFTER_MS','POMPON_STORY_MIN_MS','DUO_STORY_MIN_MS','RARE_STORY_MIN_MS'])if(k in patch)CONFIG[k]=Math.max(0,Number(patch[k])||0);
  if('MAX_CHAR_IN_LAST_FIVE'in patch)CONFIG.MAX_CHAR_IN_LAST_FIVE=Math.max(0,Math.min(5,Math.round(Number(patch.MAX_CHAR_IN_LAST_FIVE)||0)));
  return getConfig();
}
function getConfig(){return{...CONFIG,weights:{...CONFIG.weights}}}
function getDiagnostics(){return{...diagnostics,history:diagnostics.history.map(x=>({...x})),ready,cooldownRemainingMs:Math.max(0,cooldownUntil-Date.now()),beatHistory:beatHistory.map(x=>({...x})),eventHistory:[...eventHistory],lastCharacterAt,lastPomponStoryAt,lastDuoStoryAt,lastRareAt,characterRate:diagnostics.played?diagnostics.character/diagnostics.played:0,legacyIdleInNormalRotation:false}}
function resetForTest(){CHAR.cancel?.('test-reset');SOURCEFX.cancel?.('test-reset');ready=true;cooldownUntil=0;lastCharacterAt=Date.now();lastPomponStoryAt=0;lastDuoStoryAt=0;lastRareAt=0;beatHistory=[];eventHistory=[];sequence=0;for(const k of Object.keys(diagnostics))if(typeof diagnostics[k]==='number')diagnostics[k]=0;diagnostics.lastDecision='none';diagnostics.lastEvent=null;diagnostics.history=[]}
function simulateForTest(beats=10000,seed=12345){
  let seedv=(Number(seed)||1)>>>0;const rand=()=>{seedv=(1664525*seedv+1013904223)>>>0;return seedv/4294967296};let list=[],st={lastCharacterAt:0,lastPomponStoryAt:0,lastDuoStoryAt:0,lastRareAt:0};const counts={SOURCE_FX:0,POMPON_CAMEO:0,CHIRU_CAMEO:0,POMPON_STORY:0,DUO_STORY:0,RARE_STORY:0};let maxGap=0,lastCharBeat=0;
  for(let i=1;i<=Math.max(1,beats);i++){const now=i*10000,w={...CONFIG.weights};const rc=list.slice(-5).filter(x=>isCharacter(x.category)).length;let cc=0;for(let j=list.length-1;j>=0;j--){if(isCharacter(list[j].category))cc++;else break}
    if(rc>=CONFIG.MAX_CHAR_IN_LAST_FIVE||cc>=2){for(const k of CHARACTER_CATEGORIES)w[k]=0;w.SOURCE_FX=Math.max(1,w.SOURCE_FX)}
    else{if(now-st.lastPomponStoryAt<CONFIG.POMPON_STORY_MIN_MS)w.POMPON_STORY=0;if(now-st.lastDuoStoryAt<CONFIG.DUO_STORY_MIN_MS)w.DUO_STORY=0;if(now-st.lastRareAt<CONFIG.RARE_STORY_MIN_MS)w.RARE_STORY=0;if(now-st.lastCharacterAt>=CONFIG.CHARACTER_FORCE_AFTER_MS){w.SOURCE_FX=0;if([...CHARACTER_CATEGORIES].reduce((n,k)=>n+(w[k]||0),0)<=0)w.POMPON_CAMEO=1}}
    const c=weightedPick(w,rand);counts[c]++;list.push({category:c});if(list.length>16)list.shift();if(isCharacter(c)){maxGap=Math.max(maxGap,(i-lastCharBeat)*10);lastCharBeat=i;st.lastCharacterAt=now;if(c==='POMPON_STORY')st.lastPomponStoryAt=now;if(c==='DUO_STORY')st.lastDuoStoryAt=now;if(c==='RARE_STORY')st.lastRareAt=now}}
  maxGap=Math.max(maxGap,(Math.max(1,beats)-lastCharBeat)*10);const ch=Object.entries(counts).filter(([k])=>isCharacter(k)).reduce((n,[,v])=>n+v,0);return{beats:Math.max(1,beats),counts,characterRate:ch/Math.max(1,beats),maxCharacterGapSeconds:maxGap};
}
window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR=Object.freeze({version:'3.0.0',onBaseline,onRealChange,onStableUpdate,onCommunicationError,suspend,setConfig,getConfig,getDiagnostics,resetForTest,simulateForTest});
})();