(()=>{'use strict';
const CHAR=window.ASOBOON_BOARD_CHARACTER_EVENTS;
const SOURCEFX=window.ASOBOON_BOARD_SOURCE_EFFECTS;
const FOURTH=window.ASOBOON_BOARD_FOURTH_WALL_EVENTS;
const ASSETS=window.ASOBOON_BOARD_CHARACTER_ASSETS;
const LEGACY_IDLE=window.ASOBOON_BOARD_IDLE_EVENTS||null;
if(!CHAR||!SOURCEFX||!FOURTH)return;

const CONFIG={
  REAL_CHANGE_COOLDOWN_MS:15000,
  CHARACTER_FORCE_AFTER_MS:25000,
  MEGA_MIN_MS:90000,
  QUIET_BEAT_MS:6500,
  INITIAL_SHOW_DELAY_MS:2000,
  MAX_PURE_FX_IN_ROW:1,
  HISTORY_LIMIT:80,
};
const SOURCE_IDS=Object.freeze([...(SOURCEFX.events||[])]);
const CHAR_EVENTS=Object.freeze([...(CHAR.events||[])]);
const FOURTH_EVENTS=Object.freeze([...(FOURTH.events||[])]);
const POMPON_CAMEOS=Object.freeze(CHAR_EVENTS.filter(x=>x.category==='POMPON_CAMEO').map(x=>x.id));
const CHIRU_CAMEOS=Object.freeze(CHAR_EVENTS.filter(x=>x.category==='CHIRU_CAMEO').map(x=>x.id));
const POMPON_STORIES=Object.freeze(CHAR_EVENTS.filter(x=>x.category==='POMPON_STORY').map(x=>x.id));
const DUO_STORIES=Object.freeze(CHAR_EVENTS.filter(x=>x.category==='DUO_STORY').map(x=>x.id));
const RARE_STORIES=Object.freeze(CHAR_EVENTS.filter(x=>x.category==='RARE_STORY').map(x=>x.id));
const MEGA_STORIES=Object.freeze(CHAR_EVENTS.filter(x=>x.category==='MEGA_STORY').map(x=>x.id));
const FOURTH_MICRO=Object.freeze(FOURTH_EVENTS.filter(x=>x.category==='FOURTH_WALL_MICRO').map(x=>x.id));
const FOURTH_STORY=Object.freeze(FOURTH_EVENTS.filter(x=>x.category==='FOURTH_WALL_STORY').map(x=>x.id));
const FOURTH_MEGA=Object.freeze(['FW_KNOCK_KNOCK_POMPON','FW_REPAIR_REBREAK_DUO','FW_DUO_RACE_OUT','FW_DUO_SHARED_BREAK'].filter(id=>FOURTH_STORY.includes(id)));
const FOURTH_BIG=Object.freeze(FOURTH_STORY.filter(id=>!FOURTH_MEGA.includes(id)));
const CHARACTER_CATEGORIES=new Set(['POMPON_CAMEO','CHIRU_CAMEO','POMPON_STORY','DUO_STORY','RARE_STORY','MEGA_STORY','FOURTH_WALL_STORY']);

const SHOW_ARCS=Object.freeze({
  BALL_CHAOS:Object.freeze({
    title:'巨大ボール大事故',
    beats:Object.freeze([
      Object.freeze({role:'OPENING',quiet:true,magnitude:'ZERO'}),
      Object.freeze({role:'SEED',choose:POMPON_CAMEOS,magnitude:'SMALL'}),
      Object.freeze({role:'DISTRACTION',choose:SOURCE_IDS,magnitude:'SMALL'}),
      Object.freeze({role:'CALLBACK',choose:POMPON_STORIES,magnitude:'MEDIUM'}),
      Object.freeze({role:'REACTION',choose:CHIRU_CAMEOS,magnitude:'SMALL'}),
      Object.freeze({role:'BIG',choose:RARE_STORIES.length?RARE_STORIES:['BALL_RIDE_FAIL'],magnitude:'BIG'}),
      Object.freeze({role:'CALLBACK',choose:DUO_STORIES,magnitude:'BIG'}),
      Object.freeze({role:'TENSION',quiet:true,magnitude:'ZERO'}),
      Object.freeze({role:'MEGA',event:'MEGA_GREAT_CRASH',fallback:'BALL_RIDE_FAIL',magnitude:'MEGA'}),
      Object.freeze({role:'AFTERMATH',choose:DUO_STORIES,magnitude:'MEDIUM'}),
      Object.freeze({role:'TAG',choose:FOURTH_MICRO,magnitude:'SMALL'}),
    ])
  }),
  CHASE_COMEDY:Object.freeze({
    title:'追いかけっこ騒動',
    beats:Object.freeze([
      Object.freeze({role:'OPENING',quiet:true,magnitude:'ZERO'}),
      Object.freeze({role:'SEED',choose:CHIRU_CAMEOS,magnitude:'SMALL'}),
      Object.freeze({role:'CALLBACK',choose:POMPON_CAMEOS,magnitude:'SMALL'}),
      Object.freeze({role:'STORY',choose:DUO_STORIES,magnitude:'MEDIUM'}),
      Object.freeze({role:'DISTRACTION',choose:SOURCE_IDS,magnitude:'SMALL'}),
      Object.freeze({role:'RISING',choose:POMPON_STORIES,magnitude:'MEDIUM'}),
      Object.freeze({role:'BIG',choose:DUO_STORIES,magnitude:'BIG'}),
      Object.freeze({role:'TENSION',quiet:true,magnitude:'ZERO'}),
      Object.freeze({role:'MEGA',event:'MEGA_SCREEN_TAKEOVER',fallback:'POMPON_WRONG_WAY_VICTORY',magnitude:'MEGA'}),
      Object.freeze({role:'AFTERMATH',choose:CHIRU_CAMEOS,magnitude:'SMALL'}),
      Object.freeze({role:'TAG',choose:FOURTH_MICRO,magnitude:'SMALL'}),
    ])
  }),
  FOURTH_WALL_MYSTERY:Object.freeze({
    title:'第四の壁ミステリー',
    beats:Object.freeze([
      Object.freeze({role:'OPENING',quiet:true,magnitude:'ZERO'}),
      Object.freeze({role:'SEED',choose:POMPON_CAMEOS,magnitude:'SMALL'}),
      Object.freeze({role:'OMEN',choose:FOURTH_MICRO,magnitude:'SMALL'}),
      Object.freeze({role:'CALLBACK',choose:POMPON_CAMEOS,magnitude:'SMALL'}),
      Object.freeze({role:'FALSE_ALARM',choose:FOURTH_MICRO,magnitude:'MEDIUM'}),
      Object.freeze({role:'REACTION',choose:CHIRU_CAMEOS,magnitude:'SMALL'}),
      Object.freeze({role:'RISING',choose:FOURTH_BIG.length?FOURTH_BIG:FOURTH_STORY,magnitude:'BIG'}),
      Object.freeze({role:'TENSION',quiet:true,magnitude:'ZERO'}),
      Object.freeze({role:'MEGA',choose:FOURTH_MEGA.length?FOURTH_MEGA:FOURTH_STORY,fallback:'FW_POMPON_FACE_POP',magnitude:'MEGA'}),
      Object.freeze({role:'AFTERMATH',choose:CHIRU_CAMEOS,magnitude:'SMALL'}),
      Object.freeze({role:'EPILOGUE',choose:DUO_STORIES,magnitude:'MEDIUM'}),
    ])
  }),
});

let ready=false,cooldownUntil=0,lastCharacterAt=0,lastMegaAt=0,sequence=0;
let currentArc='',currentArcTitle='',currentBeatIndex=0,arcBag=[],choiceBags=new Map(),forcedArcQueue=[];
let beatHistory=[],eventHistory=[],lastCategory='',pureFxStreak=0;
const diagnostics={
  attempts:0,played:0,quietBeats:0,character:0,sourceFx:0,fourthWall:0,megaPlayed:0,megaDeferred:0,
  livingCameos:0,callbacks:0,aftermaths:0,realInterrupts:0,suspends:0,arcsStarted:0,arcsCompleted:0,
  skipped:0,lastDecision:'none',lastEvent:null,history:[]
};

function shuffle(list,random=Math.random){
  const a=[...list];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function eventCategory(id){
  const key=String(id||'');
  if(SOURCE_IDS.includes(key))return'SOURCE_FX';
  const c=CHAR_EVENTS.find(x=>x.id===key);if(c)return c.category;
  const f=FOURTH_EVENTS.find(x=>x.id===key);if(f)return f.category;
  return'';
}
function isFourthCategory(category){return String(category||'').startsWith('FOURTH_WALL_')}
function isCharacterCategory(category){return CHARACTER_CATEGORIES.has(String(category||''))}
function isCharacterEvent(id){return isCharacterCategory(eventCategory(id))}
function statusFxBusy(){
  const d=window.ASOBOON_BOARD_ANIMATIONS?.getDiagnostics?.();
  return Boolean(d&&(Number(d.activeFx||0)>0||Number(d.queuedNow||0)>0||Number(d.running||0)>0));
}
function chooseFrom(pool,key,random=Math.random){
  const list=[...(Array.isArray(pool)?pool:[])].filter(Boolean);if(!list.length)return'';
  const bagKey=String(key||list.join('|'));
  let bag=choiceBags.get(bagKey);
  if(!Array.isArray(bag)||!bag.length){bag=shuffle(list,random);choiceBags.set(bagKey,bag)}
  let id=bag.shift()||'';
  if(id&&eventHistory.slice(-4).includes(id)&&bag.length){bag.push(id);id=bag.shift()||id}
  return id;
}
function refillArcBag(random=Math.random){arcBag=shuffle(Object.keys(SHOW_ARCS),random)}
function nextArc(random=Math.random){
  if(forcedArcQueue.length)return String(forcedArcQueue.shift()||'CHASE_COMEDY');
  if(!arcBag.length)refillArcBag(random);
  return String(arcBag.shift()||'CHASE_COMEDY');
}
function startArc(name='',random=Math.random){
  const key=SHOW_ARCS[name]?name:nextArc(random),arc=SHOW_ARCS[key];
  if(currentArc)diagnostics.arcsCompleted+=1;
  currentArc=key;currentArcTitle=arc.title;currentBeatIndex=0;diagnostics.arcsStarted+=1;
  diagnostics.lastDecision='arc-start:'+key;
  return arc;
}
function ensureArc(random=Math.random){
  if(!currentArc||!SHOW_ARCS[currentArc]||currentBeatIndex>=SHOW_ARCS[currentArc].beats.length)return startArc(nextArc(random),random);
  return SHOW_ARCS[currentArc];
}
function resolveBeatEvent(beat,now=Date.now(),random=Math.random){
  if(!beat||beat.quiet)return{eventId:'',category:'QUIET',mega:false,deferred:false};
  let eventId=beat.event||chooseFrom(beat.choose,currentArc+':'+currentBeatIndex+':'+beat.role,random);
  let mega=beat.role==='MEGA';
  let deferred=false;
  if(mega&&lastMegaAt&&now-lastMegaAt<CONFIG.MEGA_MIN_MS){
    eventId=String(beat.fallback||'')||chooseFrom(
      currentArc==='FOURTH_WALL_MYSTERY'?(FOURTH_BIG.length?FOURTH_BIG:FOURTH_STORY):POMPON_STORIES,
      currentArc+':mega-fallback',
      random
    );
    mega=false;deferred=true;
  }
  return{eventId,category:eventCategory(eventId),mega,deferred};
}
function recordBeat({role,eventId,category,magnitude,injected=false,quiet=false,mega=false,deferred=false},now=Date.now()){
  const row={
    sequence:++sequence,arc:currentArc,arcTitle:currentArcTitle,beat:currentBeatIndex,role:String(role||''),
    eventId:String(eventId||''),category:String(category||''),magnitude:String(magnitude||''),injected:Boolean(injected),
    quiet:Boolean(quiet),mega:Boolean(mega),deferred:Boolean(deferred),at:now
  };
  beatHistory.push(row);beatHistory=beatHistory.slice(-32);
  if(eventId){eventHistory.push(String(eventId));eventHistory=eventHistory.slice(-32)}
  if(eventId&&isCharacterEvent(eventId)){lastCharacterAt=now;diagnostics.character+=1}
  if(category==='SOURCE_FX'){diagnostics.sourceFx+=1;pureFxStreak+=1}else if(!quiet)pureFxStreak=0;
  if(isFourthCategory(category))diagnostics.fourthWall+=1;
  if(mega){lastMegaAt=now;diagnostics.megaPlayed+=1}
  if(deferred)diagnostics.megaDeferred+=1;
  if(role==='CALLBACK')diagnostics.callbacks+=1;
  if(role==='AFTERMATH'||role==='EPILOGUE')diagnostics.aftermaths+=1;
  diagnostics.lastDecision=quiet?'show-quiet':String(role||category||'show');
  diagnostics.lastEvent=row;diagnostics.history.push({...row});diagnostics.history=diagnostics.history.slice(-CONFIG.HISTORY_LIMIT);
}
async function playEvent(eventId,{grid}={}){
  const category=eventCategory(eventId);
  if(category==='SOURCE_FX')return SOURCEFX.play(eventId);
  if(isFourthCategory(category))return FOURTH.play(eventId);
  if(category)return CHAR.play(eventId,{grid:grid||document.getElementById('queueGrid')});
  return{played:false,reason:'unknown-event'};
}
function livingCameoId(){
  const recent=new Set(eventHistory.slice(-3));
  const pool=[...POMPON_CAMEOS,...CHIRU_CAMEOS].filter(id=>!recent.has(id));
  return chooseFrom(pool.length?pool:[...POMPON_CAMEOS,...CHIRU_CAMEOS],'living-cameo');
}
async function onStableUpdate({grid}={}){
  diagnostics.attempts++;const now=Date.now();
  if(!ready){diagnostics.skipped++;diagnostics.lastDecision='not-ready';return{played:false,reason:'not-ready'}}
  if(document.visibilityState==='hidden'){diagnostics.skipped++;diagnostics.lastDecision='hidden';return{played:false,reason:'hidden'}}
  if(now<cooldownUntil){diagnostics.skipped++;diagnostics.lastDecision='cooldown';return{played:false,reason:'cooldown'}}
  if(CHAR.isRunning?.()||SOURCEFX.isRunning?.()||FOURTH.isRunning?.()){diagnostics.skipped++;diagnostics.lastDecision='busy';return{played:false,reason:'busy'}}
  if(statusFxBusy()){diagnostics.skipped++;diagnostics.lastDecision='real-fx-busy';return{played:false,reason:'real-fx-busy'}}

  const arc=ensureArc(),beat=arc.beats[currentBeatIndex];
  if(!beat)return{played:false,reason:'no-beat'};

  if(now-lastCharacterAt>=CONFIG.CHARACTER_FORCE_AFTER_MS&&!beat.quiet){
    const planned=resolveBeatEvent(beat,now);
    if(!isCharacterCategory(planned.category)){
      const cameo=livingCameoId();
      const result=await playEvent(cameo,{grid});
      if(result?.played){
        diagnostics.played+=1;diagnostics.livingCameos+=1;
        recordBeat({role:'LIVING_CAMEO',eventId:result.id||cameo,category:eventCategory(result.id||cameo),magnitude:'SMALL',injected:true},now);
        return{played:true,arc:currentArc,role:'LIVING_CAMEO',id:result.id||cameo,injected:true,beat:currentBeatIndex};
      }
    }
  }

  if(beat.quiet){
    diagnostics.quietBeats+=1;
    recordBeat({role:beat.role,eventId:'',category:'QUIET',magnitude:beat.magnitude,quiet:true},now);
    currentBeatIndex+=1;cooldownUntil=now+CONFIG.QUIET_BEAT_MS;
    return{played:false,reason:'show-quiet',arc:currentArc,role:beat.role,beat:currentBeatIndex-1};
  }

  let resolved=resolveBeatEvent(beat,now);
  if(resolved.category==='SOURCE_FX'&&pureFxStreak>=CONFIG.MAX_PURE_FX_IN_ROW){
    const cameo=livingCameoId();
    resolved={eventId:cameo,category:eventCategory(cameo),mega:false,deferred:false,injected:true};
  }
  const result=await playEvent(resolved.eventId,{grid});
  if(result?.played){
    diagnostics.played+=1;
    recordBeat({
      role:beat.role,eventId:result.id||resolved.eventId,category:eventCategory(result.id||resolved.eventId),
      magnitude:beat.magnitude,injected:Boolean(resolved.injected),mega:resolved.mega,deferred:resolved.deferred
    },now);
    currentBeatIndex+=1;
    return{
      played:true,arc:currentArc,arcTitle:currentArcTitle,role:beat.role,magnitude:beat.magnitude,
      id:result.id||resolved.eventId,mega:resolved.mega,deferred:resolved.deferred,beat:currentBeatIndex-1
    };
  }
  diagnostics.skipped++;diagnostics.lastDecision='play-failed:'+String(resolved.category||'unknown');
  return{played:false,arc:currentArc,role:beat.role,reason:result?.reason||'play-failed'};
}
function onBaseline(){
  ready=true;const now=Date.now();cooldownUntil=now+CONFIG.INITIAL_SHOW_DELAY_MS;
  lastCharacterAt=now;lastMegaAt=now;
  if(!currentArc)startArc(nextArc());
  const warm=()=>void ASSETS?.preloadAll?.();if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:4000});else setTimeout(warm,500);
}
function onRealChange(){
  diagnostics.realInterrupts++;CHAR.cancel?.('real-status-change');SOURCEFX.cancel?.('real-status-change');FOURTH.cancel?.('real-status-change');
  LEGACY_IDLE?.onRealChange?.();cooldownUntil=Date.now()+CONFIG.REAL_CHANGE_COOLDOWN_MS;
}
function onCommunicationError(){
  CHAR.cancel?.('communication-error');SOURCEFX.cancel?.('communication-error');FOURTH.cancel?.('communication-error');
  LEGACY_IDLE?.onCommunicationError?.();cooldownUntil=Math.max(cooldownUntil,Date.now()+10000);
}
function suspend(reason='inactive'){
  diagnostics.suspends++;ready=false;CHAR.cancel?.('director-suspend:'+reason);SOURCEFX.cancel?.('director-suspend:'+reason);
  FOURTH.cancel?.('director-suspend:'+reason);LEGACY_IDLE?.cancelIdleEvent?.('director-suspend:'+reason);
}
function setConfig(patch={}){
  for(const k of ['REAL_CHANGE_COOLDOWN_MS','CHARACTER_FORCE_AFTER_MS','MEGA_MIN_MS','QUIET_BEAT_MS','INITIAL_SHOW_DELAY_MS']){
    if(k in patch)CONFIG[k]=Math.max(0,Number(patch[k])||0);
  }
  if('MAX_PURE_FX_IN_ROW'in patch)CONFIG.MAX_PURE_FX_IN_ROW=Math.max(0,Math.min(2,Math.round(Number(patch.MAX_PURE_FX_IN_ROW)||0)));
  return getConfig();
}
function getConfig(){
  return{...CONFIG,arcs:Object.fromEntries(Object.entries(SHOW_ARCS).map(([k,v])=>[k,{title:v.title,beats:v.beats.length}]))};
}
function getDiagnostics(){
  return{
    ...diagnostics,history:diagnostics.history.map(x=>({...x})),ready,
    cooldownRemainingMs:Math.max(0,cooldownUntil-Date.now()),currentArc,currentArcTitle,currentBeatIndex,
    currentRole:SHOW_ARCS[currentArc]?.beats?.[currentBeatIndex]?.role||'',beatHistory:beatHistory.map(x=>({...x})),
    eventHistory:[...eventHistory],lastCharacterAt,lastMegaAt,pureFxStreak,
    characterRate:diagnostics.played?diagnostics.character/diagnostics.played:0,
    sourceFxRate:diagnostics.played?diagnostics.sourceFx/diagnostics.played:0,
    scheduler:'show-director-v1',storyState:{arc:currentArc,beat:currentBeatIndex,totalBeats:SHOW_ARCS[currentArc]?.beats?.length||0},
    legacyIdleInNormalRotation:false,jackpotEvents:['MEGA_GREAT_CRASH','MEGA_SCREEN_TAKEOVER',...FOURTH_MEGA]
  };
}
function resetForTest(){
  CHAR.cancel?.('test-reset');SOURCEFX.cancel?.('test-reset');FOURTH.cancel?.('test-reset');
  ready=true;cooldownUntil=0;lastCharacterAt=Date.now();lastMegaAt=0;sequence=0;currentArc='';currentArcTitle='';currentBeatIndex=0;
  arcBag=[];choiceBags=new Map();forcedArcQueue=[];beatHistory=[];eventHistory=[];lastCategory='';pureFxStreak=0;
  for(const k of Object.keys(diagnostics))if(typeof diagnostics[k]==='number')diagnostics[k]=0;
  diagnostics.lastDecision='none';diagnostics.lastEvent=null;diagnostics.history=[];startArc('CHASE_COMEDY');
}
function setBagForTest(list=[]){
  forcedArcQueue=(Array.isArray(list)?list:[]).filter(x=>SHOW_ARCS[x]);currentArc='';currentBeatIndex=0;
  return[...forcedArcQueue];
}
function setShowForTest(name='CHASE_COMEDY',beat=0){
  forcedArcQueue=[];startArc(SHOW_ARCS[name]?name:'CHASE_COMEDY');currentBeatIndex=Math.max(0,Math.min(SHOW_ARCS[currentArc].beats.length-1,Number(beat)||0));
  return{arc:currentArc,beat:currentBeatIndex};
}
function simulateShowForTest(seed=12345){
  let state=(Number(seed)||1)>>>0;const rnd=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296};
  const rows=[];let megaSlots=0,quietBeats=0,pureFx=0,callbackBeats=0,aftermathBeats=0;
  for(const [arcName,arc] of Object.entries(SHOW_ARCS)){
    arc.beats.forEach((beat,index)=>{
      let eventId='';
      if(!beat.quiet){
        const pool=beat.event?[beat.event]:(beat.choose||[]);
        eventId=pool.length?pool[Math.floor(rnd()*pool.length)]||pool[0]:'';
      }
      const category=eventCategory(eventId);
      if(beat.quiet)quietBeats+=1;
      if(category==='SOURCE_FX')pureFx+=1;
      if(beat.role==='MEGA')megaSlots+=1;
      if(beat.role==='CALLBACK')callbackBeats+=1;
      if(beat.role==='AFTERMATH'||beat.role==='EPILOGUE')aftermathBeats+=1;
      rows.push({arc:arcName,index,role:beat.role,eventId,category,magnitude:beat.magnitude,quiet:Boolean(beat.quiet)});
    });
  }
  let maxNonCharacterGap=0,gap=0;
  for(const row of rows){
    if(row.quiet||!row.eventId||!isCharacterEvent(row.eventId)){gap+=1;maxNonCharacterGap=Math.max(maxNonCharacterGap,gap)}
    else gap=0;
  }
  return{
    scheduler:'show-director-v1',arcCount:Object.keys(SHOW_ARCS).length,totalBeats:rows.length,rows,
    quietBeats,pureFxBeats:pureFx,megaSlots,callbackBeats,aftermathBeats,maxNonCharacterGap,
    sourceFxShare:rows.length?pureFx/rows.length:0,jackpotEvents:['MEGA_GREAT_CRASH','MEGA_SCREEN_TAKEOVER',...FOURTH_MEGA]
  };
}
const simulateCycleForTest=simulateShowForTest;

window.ASOBOON_BOARD_ENTERTAINMENT_DIRECTOR=Object.freeze({
  version:'7.0.0',onBaseline,onRealChange,onStableUpdate,onCommunicationError,suspend,setConfig,getConfig,getDiagnostics,
  resetForTest,setBagForTest,setShowForTest,simulateShowForTest,simulateCycleForTest,showArcs:SHOW_ARCS
});
})();
