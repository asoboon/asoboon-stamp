(()=>{'use strict';
const CHAR=window.ASOBOON_BOARD_CHARACTER_EVENTS;
const SOURCEFX=window.ASOBOON_BOARD_SOURCE_EFFECTS;
const FOURTH=window.ASOBOON_BOARD_FOURTH_WALL_EVENTS;
const ASSETS=window.ASOBOON_BOARD_CHARACTER_ASSETS;
const LEGACY_IDLE=window.ASOBOON_BOARD_IDLE_EVENTS||null;
if(!CHAR||!SOURCEFX||!FOURTH)return;

const CHARACTER_CATEGORIES=new Set(['POMPON_CAMEO','CHIRU_CAMEO','POMPON_STORY','DUO_STORY','RARE_STORY','FOURTH_WALL_STORY']);
const FOURTH_CATEGORIES=new Set(['FOURTH_WALL_MICRO','FOURTH_WALL_STORY']);
const BAG_TEMPLATE=Object.freeze({
  SOURCE_FX:30,
  POMPON_CAMEO:4,
  CHIRU_CAMEO:4,
  POMPON_STORY:4,
  DUO_STORY:8,
  RARE_STORY:1,
  FOURTH_WALL_MICRO:12,
  FOURTH_WALL_STORY:14,
});
const CONFIG={
  REAL_CHANGE_COOLDOWN_MS:15000,
  CHARACTER_FORCE_AFTER_MS:60000,
  POMPON_STORY_MIN_MS:30000,
  DUO_STORY_MIN_MS:40000,
  RARE_STORY_MIN_MS:180000,
  FOURTH_WALL_MICRO_MIN_MS:20000,
  FOURTH_WALL_STORY_MIN_MS:45000,
  MAX_CHAR_IN_LAST_FIVE:3,
  MAX_FOURTH_IN_LAST_FIVE:2,
};
let ready=false,cooldownUntil=0,lastCharacterAt=0,lastPomponStoryAt=0,lastDuoStoryAt=0,lastRareAt=0,lastFourthMicroAt=0,lastFourthStoryAt=0;
let beatHistory=[],eventHistory=[],categoryBag=[],eventBags={},cycleNumber=0,cycleStartedAt=0,sequence=0;
const diagnostics={attempts:0,played:0,sourceFx:0,character:0,fourthWall:0,skipped:0,realInterrupts:0,suspends:0,cyclesCompleted:0,lastDecision:'none',lastEvent:null,history:[]};

function isCharacter(c){return CHARACTER_CATEGORIES.has(String(c||''))}
function isFourth(c){return FOURTH_CATEGORIES.has(String(c||''))}
function shuffle(list,random=Math.random){
  const a=[...list];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function categoryEvents(category){
  if(category==='SOURCE_FX')return [...(SOURCEFX.events||[])];
  if(isFourth(category))return (FOURTH.events||[]).filter(x=>x.category===category).map(x=>x.id);
  return (CHAR.events||[]).filter(x=>x.category===category).map(x=>x.id);
}
function buildCategoryBag(random=Math.random){
  const bag=[];
  for(const [category,count] of Object.entries(BAG_TEMPLATE))for(let i=0;i<count;i++)bag.push(category);
  categoryBag=shuffle(bag,random);
  eventBags={};
  for(const category of Object.keys(BAG_TEMPLATE))eventBags[category]=shuffle(categoryEvents(category),random);
  cycleNumber+=1;cycleStartedAt=Date.now();
  return categoryBag;
}
function nextEvent(category,random=Math.random){
  const all=categoryEvents(category);if(!all.length)return'';
  let bag=eventBags[category];
  if(!Array.isArray(bag)||!bag.length){bag=shuffle(all,random);eventBags[category]=bag}
  return bag.shift()||'';
}
function putBack(category,eventId){
  categoryBag.unshift(category);
  if(eventId){if(!Array.isArray(eventBags[category]))eventBags[category]=[];eventBags[category].unshift(eventId)}
}
function statusFxBusy(){const d=window.ASOBOON_BOARD_ANIMATIONS?.getDiagnostics?.();return Boolean(d&&(Number(d.activeFx||0)>0||Number(d.queuedNow||0)>0||Number(d.running||0)>0))}
function recentCharacterCount(n=5){return beatHistory.slice(-n).filter(x=>isCharacter(x.category)).length}
function consecutiveCharacters(){let n=0;for(let i=beatHistory.length-1;i>=0;i--){if(isCharacter(beatHistory[i].category))n++;else break}return n}
function recentFourthCount(n=5){return beatHistory.slice(-n).filter(x=>isFourth(x.category)).length}
function eligible(category,now,{ignoreCharacterForce=false}={}){
  if(isCharacter(category)&&(recentCharacterCount(5)>=CONFIG.MAX_CHAR_IN_LAST_FIVE||consecutiveCharacters()>=2))return false;
  if(category==='POMPON_STORY'&&now-lastPomponStoryAt<CONFIG.POMPON_STORY_MIN_MS)return false;
  if(category==='DUO_STORY'&&now-lastDuoStoryAt<CONFIG.DUO_STORY_MIN_MS)return false;
  if(category==='RARE_STORY'&&now-lastRareAt<CONFIG.RARE_STORY_MIN_MS)return false;
  if(isFourth(category)&&recentFourthCount(5)>=CONFIG.MAX_FOURTH_IN_LAST_FIVE)return false;
  if(category==='FOURTH_WALL_MICRO'&&now-lastFourthMicroAt<CONFIG.FOURTH_WALL_MICRO_MIN_MS)return false;
  if(category==='FOURTH_WALL_STORY'&&now-lastFourthStoryAt<CONFIG.FOURTH_WALL_STORY_MIN_MS)return false;
  if(!ignoreCharacterForce&&now-lastCharacterAt>=CONFIG.CHARACTER_FORCE_AFTER_MS&&(category==='SOURCE_FX'||category==='FOURTH_WALL_MICRO'))return false;
  return true;
}
function takeCategory(now=Date.now()){
  if(!categoryBag.length)buildCategoryBag();
  const forceCharacter=now-lastCharacterAt>=CONFIG.CHARACTER_FORCE_AFTER_MS;
  let idx=-1;
  for(let i=0;i<categoryBag.length;i++){
    const c=categoryBag[i];
    if(forceCharacter&&!isCharacter(c))continue;
    if(eligible(c,now)){idx=i;break}
  }
  if(idx<0){
    for(let i=0;i<categoryBag.length;i++){if(eligible(categoryBag[i],now,{ignoreCharacterForce:true})){idx=i;break}}
  }
  if(idx<0)return'SOURCE_FX';
  return categoryBag.splice(idx,1)[0];
}
function recordBeat(category,eventId,now=Date.now()){
  const row={sequence:++sequence,cycle:cycleNumber,category:String(category),eventId:String(eventId||''),at:now};
  beatHistory.push(row);beatHistory=beatHistory.slice(-16);
  if(eventId){eventHistory.push(String(eventId));eventHistory=eventHistory.slice(-16)}
  if(isCharacter(category)){
    lastCharacterAt=now;
    if(category==='POMPON_STORY')lastPomponStoryAt=now;
    if(category==='DUO_STORY')lastDuoStoryAt=now;
    if(category==='RARE_STORY')lastRareAt=now;
  }
  if(category==='FOURTH_WALL_MICRO')lastFourthMicroAt=now;
  if(category==='FOURTH_WALL_STORY')lastFourthStoryAt=now;
  if(categoryBag.length===0)diagnostics.cyclesCompleted+=1;
  diagnostics.lastDecision=category;diagnostics.lastEvent=row;diagnostics.history.push({...row});diagnostics.history=diagnostics.history.slice(-60);
}
async function onStableUpdate({grid}={}){
  diagnostics.attempts++;const now=Date.now();
  if(!ready){diagnostics.skipped++;diagnostics.lastDecision='not-ready';return{played:false,reason:'not-ready'}}
  if(document.visibilityState==='hidden'){diagnostics.skipped++;diagnostics.lastDecision='hidden';return{played:false,reason:'hidden'}}
  if(now<cooldownUntil){diagnostics.skipped++;diagnostics.lastDecision='cooldown';return{played:false,reason:'cooldown'}}
  if(CHAR.isRunning?.()||SOURCEFX.isRunning?.()||FOURTH.isRunning?.()){diagnostics.skipped++;diagnostics.lastDecision='busy';return{played:false,reason:'busy'}}
  if(statusFxBusy()){diagnostics.skipped++;diagnostics.lastDecision='real-fx-busy';return{played:false,reason:'real-fx-busy'}}
  const category=takeCategory(now),eventId=nextEvent(category);
  const result=category==='SOURCE_FX'?await SOURCEFX.play(eventId):isFourth(category)?await FOURTH.play(eventId):await CHAR.play(eventId,{grid:grid||document.getElementById('queueGrid')});
  if(result?.played){
    diagnostics.played++;if(category==='SOURCE_FX')diagnostics.sourceFx++;if(isCharacter(category))diagnostics.character++;if(isFourth(category))diagnostics.fourthWall++;
    recordBeat(category,result.id||eventId,now);
    return{played:true,category,id:result.id||eventId,cycle:cycleNumber,remainingInCycle:categoryBag.length};
  }
  putBack(category,eventId);
  diagnostics.skipped++;diagnostics.lastDecision='play-failed:'+category;
  return{played:false,category,reason:result?.reason||'play-failed'};
}
function onBaseline(){
  ready=true;const now=Date.now();cooldownUntil=now+10000;if(!lastCharacterAt)lastCharacterAt=now;
  if(!categoryBag.length)buildCategoryBag();
  const warm=()=>void ASSETS?.preloadAll?.();if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:4000});else setTimeout(warm,500);
}
function onRealChange(){diagnostics.realInterrupts++;CHAR.cancel?.('real-status-change');SOURCEFX.cancel?.('real-status-change');FOURTH.cancel?.('real-status-change');LEGACY_IDLE?.onRealChange?.();cooldownUntil=Date.now()+CONFIG.REAL_CHANGE_COOLDOWN_MS}
function onCommunicationError(){CHAR.cancel?.('communication-error');SOURCEFX.cancel?.('communication-error');FOURTH.cancel?.('communication-error');LEGACY_IDLE?.onCommunicationError?.();cooldownUntil=Math.max(cooldownUntil,Date.now()+10000)}
function suspend(reason='inactive'){diagnostics.suspends++;ready=false;CHAR.cancel?.('director-suspend:'+reason);SOURCEFX.cancel?.('director-suspend:'+reason);FOURTH.cancel?.('director-suspend:'+reason);LEGACY_IDLE?.cancelIdleEvent?.('director-suspend:'+reason)}
function setConfig(patch={}){
  for(const k of ['REAL_CHANGE_COOLDOWN_MS','CHARACTER_FORCE_AFTER_MS','POMPON_STORY_MIN_MS','DUO_STORY_MIN_MS','RARE_STORY_MIN_MS','FOURTH_WALL_MICRO_MIN_MS','FOURTH_WALL_STORY_MIN_MS'])if(k in patch)CONFIG[k]=Math.max(0,Number(patch[k])||0);
  if('MAX_CHAR_IN_LAST_FIVE'in patch)CONFIG.MAX_CHAR_IN_LAST_FIVE=Math.max(0,Math.min(5,Math.round(Number(patch.MAX_CHAR_IN_LAST_FIVE)||0)));
  if('MAX_FOURTH_IN_LAST_FIVE'in patch)CONFIG.MAX_FOURTH_IN_LAST_FIVE=Math.max(0,Math.min(5,Math.round(Number(patch.MAX_FOURTH_IN_LAST_FIVE)||0)));
  return getConfig();
}
function getConfig(){return{...CONFIG,bagTemplate:{...BAG_TEMPLATE}}}
function getDiagnostics(){return{...diagnostics,history:diagnostics.history.map(x=>({...x})),ready,cooldownRemainingMs:Math.max(0,cooldownUntil-Date.now()),beatHistory:beatHistory.map(x=>({...x})),eventHistory:[...eventHistory],lastCharacterAt,lastPomponStoryAt,lastDuoStoryAt,lastRareAt,lastFourthMicroAt,lastFourthStoryAt,characterRate:diagnostics.played?diagnostics.character/diagnostics.played:0,fourthWallRate:diagnostics.played?diagnostics.fourthWall/diagnostics.played:0,cycleNumber,cycleStartedAt,remainingInCycle:categoryBag.length,bagSize:Object.values(BAG_TEMPLATE).reduce((a,b)=>a+b,0),legacyIdleInNormalRotation:false,scheduler:'shuffle-bag-fourth-wall'}}
function resetForTest(){
  CHAR.cancel?.('test-reset');SOURCEFX.cancel?.('test-reset');FOURTH.cancel?.('test-reset');ready=true;cooldownUntil=0;lastCharacterAt=Date.now();lastPomponStoryAt=0;lastDuoStoryAt=0;lastRareAt=0;lastFourthMicroAt=0;lastFourthStoryAt=0;
  beatHistory=[];eventHistory=[];categoryBag=[];eventBags={};cycleNumber=0;cycleStartedAt=0;sequence=0;
  for(const k of Object.keys(diagnostics))if(typeof diagnostics[k]==='number')diagnostics[k]=0;
  diagnostics.lastDecision='none';diagnostics.lastEvent=null;diagnostics.history=[];buildCategoryBag();
}
function setBagForTest(list=[]){categoryBag=Array.isArray(list)?[...list]:[];eventBags={};cycleStartedAt=Date.now();return[...categoryBag]}
function simulateCycleForTest(seed=12345){
  let s=(Number(seed)||1)>>>0;const rnd=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296};
  const cats=[];for(const [c,n] of Object.entries(BAG_TEMPLATE))for(let i=0;i<n;i++)cats.push(c);
  const shuffled=shuffle(cats,rnd),bags={};
  for(const c of Object.keys(BAG_TEMPLATE))bags[c]=shuffle(categoryEvents(c),rnd);
  const seen=new Set(),counts={};
  for(const c of shuffled){
    counts[c]=(counts[c]||0)+1;
    if(!bags[c]?.length)bags[c]=shuffle(categoryEvents(c),rnd);
    const id=bags[c]?.shift();if(id)seen.add(id);
  }
  const all=[...SOURCEFX.events,...CHAR.events.map(x=>x.id),...FOURTH.events.map(x=>x.id)];
  return{slots:shuffled.length,counts,uniqueSeen:seen.size,totalPatterns:new Set(all).size,missing:[...new Set(all)].filter(x=>!seen.has(x)),characterRate:shuffled.filter(isCharacter).length/shuffled.length};
}

window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR=Object.freeze({version:'6.1.0',onBaseline,onRealChange,onStableUpdate,onCommunicationError,suspend,setConfig,getConfig,getDiagnostics,resetForTest,setBagForTest,simulateCycleForTest});
})();
