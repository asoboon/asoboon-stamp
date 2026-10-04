(()=>{'use strict';

const M=window.ASOBOON_BOARD_EFFECTS;
const DEFAULT_LEVEL=3;
const RARE_RATE=0.13;
const MAX_CONCURRENT=1;
const MAX_BATCH=8;
const MAX_QUEUE=MAX_BATCH;
const MAX_CALL_GROUP=8;
const STATUS_BATCH_BUDGET_MS=9000;
const STATUS_PRIORITY=Object.freeze({call:4,cancel:3,hold:2,guided:1});
const CALL_GROUP_TIMING=Object.freeze({
  high:Object.freeze({
    single:Object.freeze({total:5800,stable:3600}),
    medium:Object.freeze({total:6200,stable:4000}),
    large:Object.freeze({total:6600,stable:4400}),
  }),
  low:Object.freeze({
    single:Object.freeze({total:4600,stable:3500}),
    medium:Object.freeze({total:5000,stable:3800}),
    large:Object.freeze({total:5400,stable:4100}),
  }),
});
const STATUS_RUNTIME_ESTIMATE_MS=Object.freeze({
  guided:Object.freeze({low:900,high:1500}),
  hold:Object.freeze({low:1000,high:1650}),
  cancel:Object.freeze({low:1050,high:1650}),
});
const STAGGER_MS=90;
const LEVEL_KEY='asoboon_call_board_animation_level_v1';
const RARE_KEY='asoboon_call_board_rare_enabled_v1';

let level=readLevel();
let rareEnabled=readRare();
let initialized=false;
let baselineSlot='';
let previous=new Map();
let queue=[];
let running=0;
let sequence=0;
let activeKind='';
let activeRunId=0;
const diagnostics={
  played:0,
  queued:0,
  dropped:0,
  activeFx:0,
  screenShakes:0,
  baselines:0,
  skippedLevelB:0,
  interruptedLevelB:0,
  budgetClosedBatches:0,
  callGroupSize:0,
  overflowCallCount:0,
  lastEvent:null,
  history:[],
};

const reducedQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
let reduced=Boolean(reducedQuery?.matches);
reducedQuery?.addEventListener?.('change',e=>{reduced=Boolean(e.matches)});

function readLevel(){
  try{
    const raw=localStorage.getItem(LEVEL_KEY);
    if(raw===null)return DEFAULT_LEVEL;
    const v=Number(raw);
    return Number.isInteger(v)&&v>=0&&v<=3?v:DEFAULT_LEVEL;
  }catch{return DEFAULT_LEVEL}
}
function readRare(){
  try{
    const v=localStorage.getItem(RARE_KEY);
    return v===null?true:v!=='0';
  }catch{return true}
}
function effectiveLevel(){return reduced?Math.min(level,1):level}
function choreoPhase(phase,attention='TARGET',budgets=null){
  return M?.setChoreographyPhase?.(phase,attention,budgets?{budgets}:{})||null;
}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function rowKey(row,index){
  if(row?.__key)return String(row.__key);
  const number=String(row?.number||'').trim();
  const order=Number(row?.order);
  return number+'::'+(Number.isFinite(order)?order:index+1);
}
function snapshot(rows){
  const map=new Map();
  (Array.isArray(rows)?rows:[]).forEach((row,index)=>{
    const key=rowKey(row,index);
    map.set(key,{key,number:String(row?.number||''),state:String(row?.state||'waiting'),order:Number(row?.order||index+1)});
  });
  return map;
}
function capture(grid){
  const frames=new Map();
  if(!grid)return frames;
  grid.querySelectorAll('.queue-card[data-row-key]').forEach(card=>{
    const key=String(card.dataset.rowKey||'');
    if(!key)return;
    const rect=card.getBoundingClientRect();
    const style=getComputedStyle(card);
    frames.set(key,{
      key,
      rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom},
      clone:card.cloneNode(true),
      vars:{
        numberSize:style.getPropertyValue('--number-size')||'34px',
        stateSize:style.getPropertyValue('--state-size')||'12px',
      },
    });
  });
  return frames;
}
function transitionKind(fromStatus,toStatus){
  if(toStatus==='canceled'&&fromStatus!=='canceled')return'cancel';
  if(toStatus==='calling'&&fromStatus!=='calling')return'call';
  if(toStatus==='done'&&fromStatus!=='done')return'guided';
  if(toStatus==='hold'&&fromStatus!=='hold')return'hold';
  return'';
}
function callGroupBucket(count){
  return count<=1?'single':count<=4?'medium':'large';
}
function callGroupTiming(count,lvl=effectiveLevel()){
  const mode=(reduced||lvl<=1)?'low':'high';
  return CALL_GROUP_TIMING[mode][callGroupBucket(Math.max(1,count))];
}
function levelBDuration(kind,lvl=effectiveLevel()){
  const t=LOCAL_STATUS_DURATION[kind]||LOCAL_STATUS_DURATION.guided;
  return lvl<=1?t.low:t.high;
}
function abortActiveForCall(reason='call-preempt'){
  if(!activeKind)return false;
  const interrupted=activeKind;
  activeRunId+=1;
  try{M?.abortAll?.('status-'+String(reason||'call-preempt'))}catch{}
  document.querySelectorAll(
    '.fx-local-status,.fx-local-card-ghost,.fx-special-number.call,.fx-special-screen.call,'+
    '.fx-pachinko-burst.call,.fx-status-signature.call,.fx-status-finale.call,.fx-impact-flash.call,.fx-foreground-shard'
  ).forEach(el=>{
    try{el.getAnimations?.({subtree:true}).forEach(a=>a.cancel())}catch{}
    el.remove();
  });
  if(interrupted==='call')diagnostics.interruptedCall=(diagnostics.interruptedCall||0)+1;
  else diagnostics.interruptedLevelB+=1;
  activeKind='';
  diagnostics.lastInterruptReason=String(reason||'call-preempt');
  return true;
}
function planRefreshEvents(events=[]){
  const calls=events.filter(x=>x.kind==='call').sort((a,b)=>(a.order||0)-(b.order||0));
  const levelB=events.filter(x=>x.kind!=='call').sort((a,b)=>{
    const p=(STATUS_PRIORITY[b.kind]||0)-(STATUS_PRIORITY[a.kind]||0);
    return p||((a.order||0)-(b.order||0));
  });

  const planned=[];
  let spent=0;
  let budgetClosed=false;

  if(calls.length){
    const members=calls.slice(0,MAX_CALL_GROUP);
    const overflow=Math.max(0,calls.length-members.length);
    const timing=callGroupTiming(members.length);
    diagnostics.callGroupSize=members.length;
    diagnostics.overflowCallCount+=overflow;
    planned.push({
      id:++sequence,
      key:'call-group:'+sequence,
      kind:'call',
      number:members[0]?.number||'',
      numbers:members.map(x=>x.number),
      members,
      fromStatus:'mixed',
      toStatus:'calling',
      order:Math.min(...members.map(x=>Number(x.order)||0)),
      frame:members[0]?.frame||null,
      grid:members[0]?.grid||null,
      estimatedMs:timing.total,
      stableMs:timing.stable,
      overflowCallCount:overflow,
    });
    spent+=timing.total;
  }

  const remainingSlots=Math.max(0,MAX_BATCH-planned.length);
  let acceptedLevelB=0;
  for(let i=0;i<levelB.length;i++){
    const evt=levelB[i];
    if(acceptedLevelB>=remainingSlots||budgetClosed){
      diagnostics.skippedLevelB+=1;
      continue;
    }
    const estimate=levelBDuration(evt.kind);
    if(spent+estimate>STATUS_BATCH_BUDGET_MS){
      budgetClosed=true;
      diagnostics.budgetClosedBatches+=1;
      diagnostics.skippedLevelB+=levelB.length-i;
      break;
    }
    planned.push({...evt,estimatedMs:estimate});
    acceptedLevelB+=1;
    spent+=estimate;
  }
  return{planned,spent,budgetClosed,calls:calls.length};
}
function observe({slotKey,rows,previousFrame,grid,onBeforeRealChange}={}){
  const next=snapshot(rows);
  const slot=String(slotKey||'');
  if(!initialized||baselineSlot!==slot){
    initialized=true;
    baselineSlot=slot;
    previous=next;
    queue.length=0;
    diagnostics.baselines+=1;
    return {baseline:true,changeCount:0,dataChangeCount:0,events:[]};
  }

  const events=[];
  let dataChangeCount=0;
  if(next.size!==previous.size)dataChangeCount+=Math.abs(next.size-previous.size)||1;

  for(const [key,now] of next){
    const before=previous.get(key);
    if(!before){
      dataChangeCount+=1;
      if(now.state==='calling'){
        events.push({
          id:++sequence,
          key,
          number:now.number,
          order:now.order,
          fromStatus:'absent',
          toStatus:'calling',
          kind:'call',
          frame:null,
          grid,
        });
      }
      continue;
    }
    if(before.state!==now.state||before.order!==now.order||before.number!==now.number)dataChangeCount+=1;
    const kind=transitionKind(before.state,now.state);
    if(!kind)continue;
    events.push({
      id:++sequence,
      key,
      number:now.number,
      order:now.order,
      fromStatus:before.state,
      toStatus:now.state,
      kind,
      frame:previousFrame?.get?.(key)||null,
      grid,
    });
  }
  for(const key of previous.keys())if(!next.has(key))dataChangeCount+=1;
  previous=next;
  pruneQueuedEvents(next);

  if(dataChangeCount>0&&typeof onBeforeRealChange==='function'){
    try{onBeforeRealChange({dataChangeCount,events})}catch{}
  }

  if(document.visibilityState!=='hidden'&&effectiveLevel()>0){
    const hasNewCall=events.some(x=>x.kind==='call');
    if(hasNewCall){
      abortActiveForCall('new-call');
      const oldLevelB=queue.filter(x=>x.kind!=='call').length;
      if(oldLevelB){
        diagnostics.skippedLevelB+=oldLevelB;
        queue=queue.filter(x=>x.kind==='call');
      }
    }

    const cards=new Map();
    grid?.querySelectorAll?.('.queue-card[data-row-key]').forEach(card=>cards.set(String(card.dataset.rowKey||''),card));
    const batch=planRefreshEvents(events);
    for(const evt of batch.planned){
      if(evt.kind==='call'){
        evt.members=evt.members.map(m=>({...m,element:cards.get(m.key)||null}));
      }else{
        evt.element=cards.get(evt.key)||null;
      }
      enqueue(evt,{deferPump:true});
    }
    pump();
  }
  return {
    baseline:false,
    changeCount:events.length,
    dataChangeCount,
    events:events.map(({number,fromStatus,toStatus,kind})=>({number,fromStatus,toStatus,kind})),
  };
}
function eventEstimateMs(evtOrKind){
  if(typeof evtOrKind==='object'&&evtOrKind?.kind==='call'){
    const count=Math.max(1,evtOrKind?.numbers?.length||1);
    return callGroupTiming(count).total;
  }
  const kind=typeof evtOrKind==='string'?evtOrKind:evtOrKind?.kind;
  return levelBDuration(kind);
}
function sortStatusQueue(list=queue){
  list.sort((a,b)=>{
    const priority=(STATUS_PRIORITY[b?.kind]||0)-(STATUS_PRIORITY[a?.kind]||0);
    if(priority)return priority;
    return (Number(a?.enqueuedAt)||0)-(Number(b?.enqueuedAt)||0);
  });
  return list;
}
function withinBatchBudget(evt,now=Date.now()){
  if(evt?.kind==='call')return true;
  const enqueuedAt=Number(evt?.enqueuedAt)||now;
  const estimate=Number(evt?.estimatedMs)||eventEstimateMs(evt);
  return Math.max(0,now-enqueuedAt)+estimate<=STATUS_BATCH_BUDGET_MS;
}
function pruneQueuedEvents(next){
  if(!queue.length)return;
  const before=queue.length;
  const latestByKey=new Map();
  const now=Date.now();
  for(const evt of queue){
    if(evt.kind==='call'&&Array.isArray(evt.members)){
      const members=evt.members.filter(m=>next?.get?.(m.key)?.state==='calling');
      if(!members.length)continue;
      evt.members=members;
      evt.numbers=members.map(m=>m.number);
      evt.number=evt.numbers[0]||'';
      const timing=callGroupTiming(evt.numbers.length);
      evt.estimatedMs=timing.total;
      evt.stableMs=timing.stable;
      latestByKey.set(evt.key,evt);
      continue;
    }
    const current=next?.get?.(evt.key);
    if(!current||current.state!==evt.toStatus||!withinBatchBudget(evt,now))continue;
    latestByKey.set(evt.key,evt);
  }
  queue=sortStatusQueue([...latestByKey.values()]).slice(0,MAX_QUEUE);
  diagnostics.dropped+=Math.max(0,before-queue.length);
}
function enqueue(evt,{deferPump=false}={}){
  const now=Date.now();
  const normalized={
    ...evt,
    element:null,
    enqueuedAt:Number(evt?.enqueuedAt)||now,
    estimatedMs:Number(evt?.estimatedMs)||eventEstimateMs(evt),
  };
  const duplicateIndex=queue.findIndex(x=>x.key===normalized.key);
  if(duplicateIndex>=0){
    queue[duplicateIndex]=normalized;
    diagnostics.dropped+=1;
  }else{
    queue.push(normalized);
  }
  sortStatusQueue(queue);
  if(queue.length>MAX_QUEUE){
    const removed=queue.splice(MAX_QUEUE);
    diagnostics.dropped+=removed.length;
    diagnostics.skippedLevelB+=removed.filter(x=>x.kind!=='call').length;
  }
  diagnostics.queued+=1;
  if(!deferPump)pump();
}
function pump(){
  while(running<MAX_CONCURRENT&&queue.length){
    const evt=queue.shift();
    if(!withinBatchBudget(evt)){
      if(evt.kind!=='call')diagnostics.skippedLevelB+=1;
      diagnostics.dropped+=1;
      continue;
    }
    running+=1;
    setTimeout(()=>{
      let liveElement=null;
      if(evt.kind==='call'){
        const first=evt.members?.[0];
        if(first){
          liveElement=[...document.querySelectorAll('.queue-card[data-row-key]')]
            .find(card=>String(card.dataset.rowKey||'')===String(first.key||''))||null;
        }
      }else{
        liveElement=[...document.querySelectorAll('.queue-card[data-row-key]')]
          .find(card=>String(card.dataset.rowKey||'')===String(evt.key||''))||null;
      }
      playStatusAnimation({...evt,element:liveElement}).catch(()=>{}).finally(()=>{
        running=Math.max(0,running-1);
        pump();
      });
    },0);
  }
}
async function playStatusAnimation({number,numbers,fromStatus,toStatus,element,frame,kind,stableMs}={}){
  const resolvedKind=kind||transitionKind(String(fromStatus||''),String(toStatus||''));
  if(!resolvedKind||effectiveLevel()===0)return;
  const runId=++activeRunId;
  activeKind=resolvedKind;
  const callNumbers=resolvedKind==='call'
    ?(Array.isArray(numbers)&&numbers.length?numbers:[number]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,MAX_CALL_GROUP)
    :[];
  diagnostics.played+=1;
  diagnostics.lastEvent={
    number:String(number||callNumbers[0]||''),
    numbers:[...callNumbers],
    kind:resolvedKind,
    fromStatus:String(fromStatus||''),
    toStatus:String(toStatus||'')
  };
  diagnostics.history.push({...diagnostics.lastEvent,at:Date.now()});
  diagnostics.history=diagnostics.history.slice(-30);
  diagnostics.activeFx+=1;
  const rare=resolvedKind==='call'&&rareEnabled&&effectiveLevel()>=3&&Math.random()<RARE_RATE;
  M?.beginChoreography?.(resolvedKind,{
    budgets:{typography:1,foreground:1,impact:2,reaction:2,secondary:1,flash:1}
  });
  try{
    if(resolvedKind==='call')await playCallAnimation({numbers:callNumbers,element,frame,rare,stableMs});
    else if(resolvedKind==='guided')await playGuidedAnimation({number,element,frame});
    else if(resolvedKind==='hold')await playHoldAnimation({number,element,frame});
    else if(resolvedKind==='cancel')await playCancelAnimation({number,element,frame});
  }finally{
    M?.endChoreography?.('complete');
    if(activeRunId===runId)activeKind='';
    diagnostics.activeFx=Math.max(0,diagnostics.activeFx-1);
  }
}

function stageFxLayer(){function stageFxLayer(){
  let layer=document.getElementById('boardFxLayer');
  if(layer)return layer;
  layer=document.createElement('div');
  layer.id='boardFxLayer';
  layer.className='board-fx-layer';
  layer.setAttribute('aria-hidden','true');
  (document.querySelector('.board')||document.body).appendChild(layer);
  return layer;
}
function overlayFxLayer(){
  return M?.getLayer?.('overlay')||stageFxLayer();
}
function currentFrame(element){
  if(!element)return null;
  const rect=element.getBoundingClientRect();
  const style=getComputedStyle(element);
  return{
    rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom},
    clone:element.cloneNode(true),
    vars:{
      numberSize:style.getPropertyValue('--number-size')||'34px',
      stateSize:style.getPropertyValue('--state-size')||'12px',
    },
  };
}
function ghostFrom(frame,className=''){
  if(!frame?.clone||!frame?.rect)return null;
  const ghost=frame.clone.cloneNode(true);
  ghost.removeAttribute('data-row-key');
  ghost.classList.remove('current-band','near-band');
  ghost.classList.add('fx-card-ghost');
  if(className)ghost.classList.add(className);
  const r=frame.rect;
  Object.assign(ghost.style,{
    position:'fixed',
    left:r.left+'px',
    top:r.top+'px',
    width:r.width+'px',
    height:r.height+'px',
    margin:'0',
  });
  ghost.style.setProperty('--number-size',frame.vars?.numberSize||'34px');
  ghost.style.setProperty('--state-size',frame.vars?.stateSize||'12px');
  stageFxLayer().appendChild(ghost);
  return ghost;
}
const LOCAL_STATUS_DURATION=Object.freeze({
  guided:Object.freeze({low:900,high:1500}),
  hold:Object.freeze({low:1000,high:1650}),
  cancel:Object.freeze({low:1050,high:1650}),
});
function localStatusDuration(kind,lvl){
  return levelBDuration(kind,lvl);
}
function localFxBounds(rect,{x=2.7,y=2.5}={}){
  const width=Math.max(rect.width,Math.min(innerWidth,rect.width*x));
  const height=Math.max(rect.height,Math.min(innerHeight,rect.height*y));
  const cx=rect.left+rect.width*.5,cy=rect.top+rect.height*.5;
  const left=clamp(cx-width*.5,0,Math.max(0,innerWidth-width));
  const top=clamp(cy-height*.5,0,Math.max(0,innerHeight-height));
  return{left,top,width,height,right:left+width,bottom:top+height,cx:cx-left,cy:cy-top};
}
function localStatusStage(kind,rect){
  const bounds=localFxBounds(rect);
  const el=document.createElement('div');
  el.className='fx-local-status '+String(kind||'guided');
  el.dataset.localStatus=String(kind||'guided');
  el.setAttribute('aria-hidden','true');
  Object.assign(el.style,{
    left:bounds.left+'px',
    top:bounds.top+'px',
    width:bounds.width+'px',
    height:bounds.height+'px',
  });
  el.style.setProperty('--local-cx',bounds.cx+'px');
  el.style.setProperty('--local-cy',bounds.cy+'px');
  el.style.setProperty('--card-w',rect.width+'px');
  el.style.setProperty('--card-h',rect.height+'px');
  overlayFxLayer().appendChild(el);
  return{el,bounds};
}
function localGhost(frame,kind){
  const ghost=ghostFrom(frame,'fx-'+kind+'-ghost');
  if(!ghost)return null;
  ghost.classList.add('fx-local-card-ghost');
  ghost.style.zIndex='12';
  return ghost;
}
function localStageFade(el,duration){
  const low=reduced||effectiveLevel()<=1;
  return animateElement(el,low?[
    {opacity:0},{opacity:.72,offset:.14},{opacity:.72,offset:.82},{opacity:0}
  ]:[
    {opacity:0},{opacity:1,offset:.08},{opacity:1,offset:.88},{opacity:0}
  ],{duration,easing:'linear',fill:'forwards',rawTiming:true});
}
async function playGuidedCardFx({element,frame}={}){
  const source=frame||currentFrame(element);
  if(!source?.rect)return;
  const lvl=effectiveLevel(),duration=localStatusDuration('guided',lvl);
  const ghost=localGhost(source,'guided');
  const {el,bounds}=localStatusStage('guided',source.rect);
  const jobs=[localStageFade(el,duration)];
  const low=reduced||lvl<=1;
  const travel=Math.min(source.rect.width*1.45,bounds.width*.54);
  if(ghost){
    jobs.push(animateElement(ghost,low?[
      {opacity:1,transform:'translate3d(0,0,0) scale(1)'},
      {opacity:1,transform:'translate3d(8px,0,0) scale(1)',offset:.72},
      {opacity:0,transform:'translate3d('+Math.min(34,travel)+'px,0,0) scale(.98)',offset:1}
    ]:[
      {opacity:1,transform:'translate3d(0,0,0) scale(1)'},
      {opacity:1,transform:'translate3d(-12px,0,0) scale(1.035)',offset:.18},
      {opacity:1,transform:'translate3d(4px,0,0) scale(1)',offset:.3},
      {opacity:.96,transform:'translate3d('+(travel*.45)+'px,-2px,0) scale(1.02) skewX(-3deg)',offset:.68},
      {opacity:0,filter:'blur(2px)',transform:'translate3d('+travel+'px,-7px,0) scale(.88) skewX(-10deg)',offset:1}
    ],{duration,easing:'cubic-bezier(.12,.72,.14,1)',fill:'forwards',rawTiming:true}));
  }
  if(!low){
    for(let i=0;i<6;i++){
      const streak=document.createElement('i');
      streak.className='fx-local-streak';
      streak.style.top=(bounds.cy-source.rect.height*.42+i*(source.rect.height*.17))+'px';
      streak.style.left=Math.max(8,bounds.cx-source.rect.width*.72)+'px';
      streak.style.width=Math.max(44,source.rect.width*(.48+(i%3)*.12))+'px';
      el.appendChild(streak);
      jobs.push(animateElement(streak,[
        {opacity:0,transform:'translate3d(-18px,0,0) scaleX(.35)'},
        {opacity:.95,transform:'translate3d(10px,0,0) scaleX(1)',offset:.24},
        {opacity:.82,transform:'translate3d('+(travel*.56)+'px,0,0) scaleX(1.55)',offset:.7},
        {opacity:0,transform:'translate3d('+travel+'px,0,0) scaleX(2.1)',offset:1}
      ],{duration:duration-i*28,delay:i*22,easing:'cubic-bezier(.1,.68,.14,1)',fill:'forwards',rawTiming:true}));
    }
  }
  await Promise.all(jobs);
  ghost?.remove();
  el.remove();
}
async function playHoldCardFx({element,frame}={}){
  const source=frame||currentFrame(element);
  if(!source?.rect)return;
  const lvl=effectiveLevel(),duration=localStatusDuration('hold',lvl);
  const ghost=localGhost(source,'hold');
  const {el,bounds}=localStatusStage('hold',source.rect);
  const jobs=[localStageFade(el,duration)];
  const low=reduced||lvl<=1;
  if(ghost){
    jobs.push(animateElement(ghost,low?[
      {opacity:1,transform:'translate3d(0,0,0) scale(1)'},
      {opacity:1,transform:'translate3d(5px,0,0) scale(1.01)',offset:.3},
      {opacity:1,transform:'translate3d(0,0,0) scale(1)',offset:.58},
      {opacity:0,transform:'translate3d(0,0,0) scale(1)',offset:1}
    ]:[
      {opacity:1,transform:'translate3d(0,0,0) scale(1)'},
      {opacity:1,transform:'translate3d(18px,0,0) scale(1.055)',offset:.18},
      {opacity:1,transform:'translate3d(-9px,0,0) scale(.985)',offset:.26},
      {opacity:1,transform:'translate3d(5px,0,0) scale(1.015)',offset:.33},
      {opacity:1,transform:'translate3d(0,0,0) scale(1)',offset:.42},
      {opacity:1,transform:'translate3d(0,0,0) scale(1)',offset:.82},
      {opacity:0,transform:'translate3d(0,0,0) scale(1)',offset:1}
    ],{duration,easing:'cubic-bezier(.14,.76,.16,1)',fill:'forwards',rawTiming:true}));
  }
  for(const side of ['left','right']){
    const clampEl=document.createElement('i');
    clampEl.className='fx-local-clamp '+side;
    clampEl.style.top=(bounds.cy-source.rect.height*.43)+'px';
    clampEl.style.height=(source.rect.height*.86)+'px';
    clampEl.style.left=(side==='left'
      ?bounds.cx-source.rect.width*.60
      :bounds.cx+source.rect.width*.48)+'px';
    el.appendChild(clampEl);
    const start=side==='left'?'translate3d(-80px,0,0)':'translate3d(80px,0,0)';
    const bite=side==='left'?'translate3d(8px,0,0)':'translate3d(-8px,0,0)';
    jobs.push(animateElement(clampEl,[
      {opacity:0,transform:start},
      {opacity:1,transform:'translate3d(0,0,0)',offset:.22},
      {opacity:1,transform:bite,offset:.28},
      {opacity:1,transform:'translate3d(0,0,0)',offset:.36},
      {opacity:1,transform:'translate3d(0,0,0)',offset:.86},
      {opacity:0,transform:'translate3d(0,0,0)',offset:1}
    ],{duration,easing:'cubic-bezier(.1,.72,.16,1)',fill:'forwards',rawTiming:true}));
  }
  if(!low){
    for(let i=0;i<6;i++){
      const spark=document.createElement('i');
      spark.className='fx-local-spark';
      spark.style.left=(bounds.cx+(i%2?1:-1)*source.rect.width*.46)+'px';
      spark.style.top=(bounds.cy-source.rect.height*.2+(i%3)*source.rect.height*.2)+'px';
      el.appendChild(spark);
      const dx=(i%2?1:-1)*(24+(i%3)*10),dy=-18+(i%3)*18;
      jobs.push(animateElement(spark,[
        {opacity:0,transform:'translate3d(-50%,-50%,0) scale(.2)'},
        {opacity:1,transform:'translate3d(calc(-50% + '+(dx*.25)+'px),calc(-50% + '+(dy*.25)+'px),0) scale(1)',offset:.22},
        {opacity:0,transform:'translate3d(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px),0) scale(.45)',offset:1}
      ],{duration:520+i*26,delay:320+i*24,easing:'ease-out',fill:'forwards',rawTiming:true}));
    }
  }
  await Promise.all(jobs);
  ghost?.remove();
  el.remove();
}
async function playCancelCardFx({element,frame}={}){
  const source=frame||currentFrame(element);
  if(!source?.rect)return;
  const lvl=effectiveLevel(),duration=localStatusDuration('cancel',lvl);
  const ghost=localGhost(source,'cancel');
  const {el,bounds}=localStatusStage('cancel',source.rect);
  const jobs=[localStageFade(el,duration)];
  const low=reduced||lvl<=1;
  if(ghost){
    jobs.push(animateElement(ghost,low?[
      {opacity:1,transform:'scale(1)'},
      {opacity:1,transform:'scale(.99)',offset:.64},
      {opacity:0,transform:'scale(.94)',offset:1}
    ]:[
      {opacity:1,transform:'translate3d(0,0,0) scale(1)'},
      {opacity:1,transform:'translate3d(0,0,0) scale(1)',offset:.30},
      {opacity:1,transform:'translate3d(-2px,1px,0) scale(1.01)',offset:.38},
      {opacity:1,transform:'translate3d(2px,-1px,0) scale(.995)',offset:.44},
      {opacity:.96,transform:'translate3d(0,0,0) scale(1)',offset:.49},
      {opacity:.62,transform:'translate3d(0,5px,0) scale(.93) rotate(1.5deg)',offset:.72},
      {opacity:0,filter:'blur(1.5px)',transform:'translate3d(0,18px,0) scale(.76) rotate(4deg)',offset:1}
    ],{duration,easing:'cubic-bezier(.16,.72,.16,1)',fill:'forwards',rawTiming:true}));
  }
  const crackAngles=[-26,24,86,156];
  crackAngles.forEach((deg,i)=>{
    const crack=document.createElement('i');
    crack.className='fx-local-crack';
    crack.style.left=bounds.cx+'px';
    crack.style.top=bounds.cy+'px';
    crack.style.width=(source.rect.width*(.38+(i%2)*.12))+'px';
    el.appendChild(crack);
    jobs.push(animateElement(crack,[
      {opacity:0,transform:'rotate('+deg+'deg) scaleX(0)'},
      {opacity:1,transform:'rotate('+deg+'deg) scaleX(1)',offset:.5},
      {opacity:1,transform:'rotate('+deg+'deg) scaleX(1)',offset:.82},
      {opacity:0,transform:'rotate('+deg+'deg) scaleX(1.05)',offset:1}
    ],{duration:480,delay:110+i*60,easing:'cubic-bezier(.2,.72,.18,1)',fill:'forwards',rawTiming:true}));
  });
  if(!low){
    const pieces=[...Array(4)].map((_,i)=>({size:26+(i%2)*10,large:true,i}))
      .concat([...Array(5)].map((_,i)=>({size:13+(i%3)*5,large:false,i:i+4})));
    pieces.forEach(({size,large,i})=>{
      const piece=document.createElement('i');
      piece.className='fx-local-shard '+(large?'large':'small');
      piece.style.left=bounds.cx+'px';
      piece.style.top=bounds.cy+'px';
      piece.style.width=size+'px';
      piece.style.height=Math.round(size*.68)+'px';
      el.appendChild(piece);
      const angle=(-155+i*(310/Math.max(1,pieces.length-1)))*Math.PI/180;
      const dist=Math.min(bounds.width,bounds.height)*(large?.38:.46);
      const dx=Math.cos(angle)*dist,dy=Math.sin(angle)*dist+(large?10:28);
      jobs.push(animateElement(piece,[
        {opacity:0,transform:'translate3d(-50%,-50%,0) rotate('+(i*21)+'deg) scale(.18)'},
        {opacity:1,transform:'translate3d(calc(-50% + '+(dx*.12)+'px),calc(-50% + '+(dy*.12)+'px),0) rotate('+(i*47)+'deg) scale(1.08)',offset:.18},
        {opacity:.9,transform:'translate3d(calc(-50% + '+(dx*.58)+'px),calc(-50% + '+(dy*.58)+'px),0) rotate('+(i*92)+'deg) scale(.86)',offset:.62},
        {opacity:0,transform:'translate3d(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px),0) rotate('+(i*144)+'deg) scale(.55)',offset:1}
      ],{duration:large?760:620,delay:(large?650:840)+(i%3)*22,easing:'cubic-bezier(.1,.66,.14,1)',fill:'forwards',rawTiming:true}));
    });
  }
  await Promise.all(jobs);
  ghost?.remove();
  el.remove();
}

function fitCallGroupNumbers(el){
  if(!el)return;
  const count=Math.max(1,Number(el.dataset.callCount)||1);
  const values=[...el.querySelectorAll('.fx-special-number-value')];
  for(const value of values){
    const cell=value.closest('.fx-call-cell');
    if(!cell)continue;
    const chars=String(value.textContent||'').length;
    const targetVh=count===1
      ?(chars<=4?24:chars===5?17:chars===6?14.5:14)
      :(count<=4?12.2:7.4);
    const minVh=chars>6?0:(count===1?14:count<=4?12:7);
    value.style.fontSize=(innerHeight*targetVh/100)+'px';
    value.style.setProperty('--call-fit-x','1');
    let rect=value.getBoundingClientRect(),cellRect=cell.getBoundingClientRect();
    const maxWidth=Math.max(1,cellRect.width*.92);
    if(rect.width>maxWidth){
      const xScale=maxWidth/rect.width;
      if(chars<=6&&xScale>=.82){
        value.style.setProperty('--call-fit-x',String(xScale));
      }else{
        const nextPx=Math.max(10,(innerHeight*targetVh/100)*xScale);
        value.style.fontSize=nextPx+'px';
      }
    }
    rect=value.getBoundingClientRect();
    value.dataset.renderHeightVh=String(rect.height/Math.max(1,innerHeight)*100);
    value.dataset.renderWidthRatio=String(rect.width/Math.max(1,cell.getBoundingClientRect().width));
    value.dataset.minHeightVh=String(minVh);
    value.dataset.guaranteedChars=String(chars<=6);
  }
}
function specialNumberTakeover(numbers,kind='call',{duration,stableMs}={}){
  const values=(Array.isArray(numbers)?numbers:[numbers]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,MAX_CALL_GROUP);
  if(!values.length||effectiveLevel()===0)return Promise.resolve();
  const timing=callGroupTiming(values.length);
  duration=Number(duration)||timing.total;
  stableMs=Number(stableMs)||timing.stable;
  M?.requestVisual?.('number',{priority:'essential'});

  const el=document.createElement('div');
  el.className='fx-special-number call';
  el.dataset.callCount=String(values.length);
  el.dataset.specialDuration=String(duration);
  el.dataset.stableReadableMs=String(stableMs);
  el.dataset.callLayout=values.length===1?'1x1':values.length===2?'1x2':values.length<=4?'1x'+values.length:values.length<=6?'2x3':'2x4';
  el.setAttribute('aria-hidden','true');

  const group=document.createElement('div');
  group.className='fx-call-group';
  for(const raw of values){
    const cell=document.createElement('div');
    cell.className='fx-call-cell';
    const num=document.createElement('div');
    num.className='fx-special-number-value';
    num.textContent=raw;
    num.dataset.chars=String(raw.length);
    cell.appendChild(num);
    group.appendChild(cell);
  }
  el.appendChild(group);
  overlayFxLayer().appendChild(el);
  fitCallGroupNumbers(el);

  const low=reduced||effectiveLevel()<=1;
  const introMs=low?500:1300;
  const outroMs=Math.max(400,duration-introMs-stableMs);
  const stableStart=clamp(introMs/duration,.05,.45);
  const stableEnd=clamp((duration-outroMs)/duration,stableStart+.2,.95);
  el.dataset.stableStart=String(stableStart);
  el.dataset.stableEnd=String(stableEnd);

  const frames=low?[
    {opacity:0,transform:'translate3d(0,0,0) scale(.975)',offset:0},
    {opacity:1,transform:'translate3d(0,0,0) scale(1)',offset:stableStart},
    {opacity:1,transform:'translate3d(0,0,0) scale(1)',offset:stableEnd},
    {opacity:0,transform:'translate3d(0,0,0) scale(1.012)',offset:1}
  ]:[
    {opacity:0,transform:'translate3d(0,22px,0) scale(.30) rotate(-2.2deg)',offset:0},
    {opacity:1,transform:'translate3d(0,-4px,0) scale(1.14) rotate(.7deg)',offset:Math.max(.06,stableStart*.48)},
    {opacity:1,transform:'translate3d(0,1px,0) scale(.965) rotate(-.22deg)',offset:Math.max(.1,stableStart*.70)},
    {opacity:1,transform:'translate3d(0,0,0) scale(1.028) rotate(.08deg)',offset:Math.max(.13,stableStart*.84)},
    {opacity:1,transform:'translate3d(0,0,0) scale(1) rotate(0)',offset:stableStart},
    {opacity:1,transform:'translate3d(0,0,0) scale(1) rotate(0)',offset:stableEnd},
    {opacity:1,transform:'translate3d(0,0,0) scale(1.012) rotate(0)',offset:Math.min(.98,stableEnd+(1-stableEnd)*.35)},
    {opacity:0,transform:'translate3d(0,0,0) scale(1.025) rotate(0)',offset:1}
  ];

  return animateElement(el,frames,{duration,easing:'cubic-bezier(.16,.82,.18,1)',fill:'forwards',rawTiming:true})
    .finally(()=>el.remove());
}
function pachinkoBurst(kind,rect,{duration=1150}={}){function pachinkoBurst(kind,rect,{duration=1150}={}){
  if(effectiveLevel()===0||!rect)return Promise.resolve();
  M?.requestVisual?.('secondary',{priority:'essential'});
  const el=document.createElement('div');
  el.className='fx-pachinko-burst '+String(kind||'call');
  el.setAttribute('aria-hidden','true');
  el.style.setProperty('--fx-x',(rect.left+rect.width*.5)+'px');
  el.style.setProperty('--fx-y',(rect.top+rect.height*.5)+'px');
  overlayFxLayer().appendChild(el);

  const frames=reduced?[
    {opacity:0,transform:'scale(.96)'},
    {opacity:.72,transform:'scale(1)',offset:.3},
    {opacity:0,transform:'scale(1.04)'}
  ]:[
    {opacity:0,transform:'scale(.82) rotate(-2deg)'},
    {opacity:1,transform:'scale(1.04) rotate(1deg)',offset:.18},
    {opacity:.9,transform:'scale(1)',offset:.56},
    {opacity:0,transform:'scale(1.14) rotate(2deg)'}
  ];
  return animateElement(el,frames,{duration,easing:'cubic-bezier(.14,.8,.2,1)',fill:'forwards',rawTiming:true})
    .finally(()=>el.remove());
}

function statusSignature(kind,{duration=1800}={}){
  if(effectiveLevel()===0)return Promise.resolve();
  const el=document.createElement('div');
  el.className='fx-status-signature '+String(kind||'call');
  el.setAttribute('aria-hidden','true');
  overlayFxLayer().appendChild(el);

  const low=reduced||effectiveLevel()<=1;
  const frames=low?[
    {opacity:0,transform:'scale(.995)'},
    {opacity:.72,transform:'scale(1)',offset:.18},
    {opacity:.72,transform:'scale(1)',offset:.82},
    {opacity:0,transform:'scale(1)',offset:1}
  ]:kind==='guided'?[
    {opacity:0,transform:'translate3d(-14vw,0,0) scaleX(.82)'},
    {opacity:1,transform:'translate3d(0,0,0) scaleX(1)',offset:.16},
    {opacity:.94,transform:'translate3d(9vw,0,0) scaleX(1.04)',offset:.72},
    {opacity:0,transform:'translate3d(34vw,0,0) scaleX(1.16)',offset:1}
  ]:kind==='hold'?[
    {opacity:0,transform:'translate3d(-7vw,0,0) scaleX(1.06)'},
    {opacity:1,transform:'translate3d(18px,0,0) scaleX(.98)',offset:.18},
    {opacity:1,transform:'translate3d(-10px,0,0) scaleX(1.02)',offset:.28},
    {opacity:.96,transform:'translate3d(4px,0,0) scaleX(.995)',offset:.38},
    {opacity:.9,transform:'translate3d(0,0,0) scaleX(1)',offset:.78},
    {opacity:0,transform:'translate3d(0,0,0) scaleX(1)',offset:1}
  ]:kind==='cancel'?[
    {opacity:0,transform:'scale(.96) rotate(0deg)'},
    {opacity:.9,transform:'scale(1) rotate(0deg)',offset:.18},
    {opacity:1,transform:'scale(1.015) rotate(.2deg)',offset:.68},
    {opacity:.72,transform:'scale(.94) rotate(1.8deg)',offset:.84},
    {opacity:0,transform:'scale(.74) rotate(5deg)',offset:1}
  ]:[
    {opacity:0,transform:'scale(.72)'},
    {opacity:1,transform:'scale(1.08)',offset:.14},
    {opacity:.98,transform:'scale(.98)',offset:.24},
    {opacity:.9,transform:'scale(1)',offset:.72},
    {opacity:0,transform:'scale(1.22)',offset:1}
  ];

  return animateElement(el,frames,{duration,easing:'cubic-bezier(.16,.82,.18,1)',fill:'forwards',rawTiming:true})
    .finally(()=>el.remove());
}


function statusFinale(kind,rect,{delay=0,duration=1200}={}){
  if(effectiveLevel()===0||!rect)return Promise.resolve();
  const level=effectiveLevel();
  const low=reduced||level<=1;
  const layer=overlayFxLayer();
  const el=document.createElement('div');
  el.className='fx-status-finale '+String(kind||'call');
  el.dataset.finalAct=String(kind||'call');
  el.setAttribute('aria-hidden','true');
  const cx=rect.left+rect.width*.5,cy=rect.top+rect.height*.5;
  el.style.setProperty('--fx-x',cx+'px');
  el.style.setProperty('--fx-y',cy+'px');
  layer.appendChild(el);

  if(low){
    return animateElement(el,[
      {opacity:0,transform:'scale(.995)'},
      {opacity:.38,transform:'scale(1)',offset:.16},
      {opacity:.38,transform:'scale(1)',offset:.84},
      {opacity:0,transform:'scale(1)',offset:1}
    ],{duration:Math.min(duration,1000),delay,easing:'ease-out',fill:'forwards',rawTiming:true}).finally(()=>el.remove());
  }

  const jobs=[];
  const rootFrames=kind==='guided'?[
    {opacity:0,transform:'translate3d(-3vw,0,0) scaleX(.94)'},
    {opacity:1,transform:'translate3d(0,0,0) scaleX(1)',offset:.18},
    {opacity:1,transform:'translate3d(4vw,0,0) scaleX(1.04)',offset:.72},
    {opacity:0,transform:'translate3d(10vw,0,0) scaleX(1.12)',offset:1}
  ]:kind==='hold'?[
    {opacity:0,transform:'scaleX(1.08)'},
    {opacity:1,transform:'scaleX(.99)',offset:.16},
    {opacity:1,transform:'scaleX(1)',offset:.92},
    {opacity:0,transform:'scaleX(1)',offset:1}
  ]:kind==='cancel'?[
    {opacity:0,transform:'scale(.985)'},
    {opacity:1,transform:'scale(1.01)',offset:.16},
    {opacity:1,transform:'scale(1)',offset:.72},
    {opacity:0,transform:'scale(.92)',offset:1}
  ]:[
    {opacity:0,transform:'scale(.72)'},
    {opacity:1,transform:'scale(1.06)',offset:.16},
    {opacity:.94,transform:'scale(1)',offset:.48},
    {opacity:0,transform:'scale(1.28)',offset:1}
  ];
  jobs.push(animateElement(el,rootFrames,{duration,delay,easing:'cubic-bezier(.16,.82,.18,1)',fill:'forwards',rawTiming:true}));

  if(kind==='call'){
    for(let i=0;i<3;i++){
      const crack=document.createElement('i');
      crack.className='fx-finale-crack call';
      crack.style.left=cx+'px';
      crack.style.top=cy+'px';
      crack.style.width=Math.round(rect.width*(.18+i*.055))+'px';
      const crackAngle=(-34+i*36)+'deg';
      el.appendChild(crack);
      jobs.push(animateElement(crack,[
        {opacity:0,transform:'rotate('+crackAngle+') scaleX(0)'},
        {opacity:1,transform:'rotate('+crackAngle+') scaleX(1)',offset:.52},
        {opacity:.9,transform:'rotate('+crackAngle+') scaleX(1)',offset:.78},
        {opacity:0,transform:'rotate('+crackAngle+') scaleX(1.08)',offset:1}
      ],{duration:Math.round(duration*.48),delay:delay+i*55,easing:'cubic-bezier(.18,.78,.2,1)',fill:'forwards',rawTiming:true}));
    }
    const count=10;
    for(let i=0;i<count;i++){
      const piece=document.createElement('i');
      piece.className='fx-finale-piece';
      const angle=(-Math.PI/2)+(Math.PI*2*i/count);
      const distance=Math.max(innerWidth,innerHeight)*(.20+(i%3)*.035);
      const size=34+(i%4)*10;
      Object.assign(piece.style,{left:cx+'px',top:cy+'px',width:size+'px',height:Math.round(size*.62)+'px'});
      el.appendChild(piece);
      const dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance;
      jobs.push(animateElement(piece,[
        {opacity:0,transform:'translate3d(-50%,-50%,0) rotate('+(i*21)+'deg) scale(.18)'},
        {opacity:1,transform:'translate3d(calc(-50% + '+(dx*.12)+'px),calc(-50% + '+(dy*.12)+'px),0) rotate('+(i*33)+'deg) scale(1.08)',offset:.18},
        {opacity:.88,transform:'translate3d(calc(-50% + '+(dx*.56)+'px),calc(-50% + '+(dy*.56)+'px),0) rotate('+(i*72)+'deg) scale(.96)',offset:.56},
        {opacity:0,transform:'translate3d(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px),0) rotate('+(i*118)+'deg) scale(.7)',offset:1}
      ],{duration:Math.round(duration*.82),delay:delay+Math.round(duration*.18),easing:'cubic-bezier(.12,.7,.18,1)',fill:'forwards',rawTiming:true}));
    }
  }else if(kind==='guided'){
    const gate=document.createElement('i');
    gate.className='fx-finale-gate';
    gate.style.left=(cx+rect.width*.43)+'px';
    gate.style.top=cy+'px';
    gate.style.height=Math.round(rect.height*.72)+'px';
    el.appendChild(gate);
    jobs.push(animateElement(gate,[
      {opacity:0,transform:'translate3d(-50%,-50%,0) scaleX(.08) scaleY(.54)'},
      {opacity:1,transform:'translate3d(-50%,-50%,0) scaleX(1) scaleY(1)',offset:.16},
      {opacity:1,transform:'translate3d(-50%,-50%,0) scaleX(1) scaleY(1)',offset:.76},
      {opacity:.9,transform:'translate3d(-50%,-50%,0) scaleX(.22) scaleY(.9)',offset:.91},
      {opacity:0,transform:'translate3d(-50%,-50%,0) scaleX(.02) scaleY(.72)',offset:1}
    ],{duration,delay,easing:'cubic-bezier(.12,.7,.16,1)',fill:'forwards',rawTiming:true}));
    for(let i=0;i<7;i++){
      const streak=document.createElement('i');
      streak.className='fx-finale-streak';
      const y=cy+((i-3)*Math.max(34,rect.height*.09));
      Object.assign(streak.style,{left:(cx-rect.width*.32)+'px',top:y+'px',width:(110+i*16)+'px'});
      el.appendChild(streak);
      jobs.push(animateElement(streak,[
        {opacity:0,transform:'translate3d(-12vw,0,0) scaleX(.35)'},
        {opacity:.92,transform:'translate3d(2vw,0,0) scaleX(1.1)',offset:.18},
        {opacity:.86,transform:'translate3d(28vw,0,0) scaleX(1.7)',offset:.62},
        {opacity:0,transform:'translate3d(86vw,0,0) scaleX(2.5)',offset:1}
      ],{duration:duration-(i*24),delay:delay+(i*18),easing:'cubic-bezier(.08,.66,.12,1)',fill:'forwards',rawTiming:true}));
    }
  }else if(kind==='hold'){
    const pin=document.createElement('i');
    pin.className='fx-finale-pin';
    pin.style.left=cx+'px';
    pin.style.top=cy+'px';
    el.appendChild(pin);
    jobs.push(animateElement(pin,[
      {opacity:0,transform:'translate3d(-50%,-50%,0) rotate(45deg) scale(.2)'},
      {opacity:0,transform:'translate3d(-50%,-50%,0) rotate(45deg) scale(.2)',offset:.12},
      {opacity:1,transform:'translate3d(-50%,-50%,0) rotate(45deg) scale(1.22)',offset:.18},
      {opacity:1,transform:'translate3d(-50%,-50%,0) rotate(45deg) scale(1)',offset:.25},
      {opacity:1,transform:'translate3d(-50%,-50%,0) rotate(45deg) scale(1)',offset:.94},
      {opacity:0,transform:'translate3d(-50%,-50%,0) rotate(45deg) scale(1)',offset:1}
    ],{duration,delay,easing:'cubic-bezier(.12,.74,.18,1)',fill:'forwards',rawTiming:true}));
    const board=document.querySelector('.board');
    if(board){
      jobs.push(animateElement(board,[
        {transform:'translate3d(0,0,0)'},
        {transform:'translate3d(0,0,0)',offset:.12},
        {transform:'translate3d(-7px,0,0)',offset:.16},
        {transform:'translate3d(5px,0,0)',offset:.20},
        {transform:'translate3d(-2px,0,0)',offset:.24},
        {transform:'translate3d(0,0,0)',offset:.3},
        {transform:'translate3d(0,0,0)',offset:1}
      ],{duration,delay,easing:'cubic-bezier(.18,.78,.2,1)',rawTiming:true}));
    }
    for(const side of ['left','right']){
      const lock=document.createElement('i');
      lock.className='fx-finale-lock '+side;
      lock.style.top=(cy-rect.height*.24)+'px';
      lock.style.height=(rect.height*.48)+'px';
      if(side==='left')lock.style.left=(cx-rect.width*.47)+'px';
      else lock.style.right=(innerWidth-(cx+rect.width*.47))+'px';
      el.appendChild(lock);
      const enter=side==='left'?'translate3d(-34vw,0,0)':'translate3d(34vw,0,0)';
      jobs.push(animateElement(lock,[
        {opacity:0,transform:enter},
        {opacity:1,transform:'translate3d(0,0,0)',offset:.14},
        {opacity:1,transform:side==='left'?'translate3d(10px,0,0)':'translate3d(-10px,0,0)',offset:.2},
        {opacity:1,transform:'translate3d(0,0,0)',offset:.26},
        {opacity:1,transform:'translate3d(0,0,0)',offset:.94},
        {opacity:0,transform:'translate3d(0,0,0)',offset:1}
      ],{duration,delay,easing:'cubic-bezier(.08,.72,.18,1)',fill:'forwards',rawTiming:true}));
    }
  }else if(kind==='cancel'){
    const crackAngles=[-24,28,104,198];
    crackAngles.forEach((deg,i)=>{
      const crack=document.createElement('i');
      crack.className='fx-finale-crack cancel';
      crack.style.left=cx+'px';
      crack.style.top=cy+'px';
      crack.style.width=Math.round(rect.width*(.23+(i%3)*.075))+'px';
      const crackAngle=deg+'deg';
      el.appendChild(crack);
      jobs.push(animateElement(crack,[
        {opacity:0,transform:'rotate('+crackAngle+') scaleX(0)'},
        {opacity:1,transform:'rotate('+crackAngle+') scaleX(1)',offset:.44},
        {opacity:1,transform:'rotate('+crackAngle+') scaleX(1)',offset:.86},
        {opacity:.15,transform:'rotate('+crackAngle+') scaleX(1.04)',offset:1}
      ],{duration:430,delay:delay+i*72,easing:'cubic-bezier(.2,.72,.18,1)',fill:'forwards',rawTiming:true}));
    });

    const voidEl=document.createElement('i');
    voidEl.className='fx-finale-void';
    voidEl.style.left=cx+'px';
    voidEl.style.top=cy+'px';
    el.appendChild(voidEl);
    jobs.push(animateElement(voidEl,[
      {opacity:0,transform:'translate3d(-50%,-50%,0) scale(.08)'},
      {opacity:0,transform:'translate3d(-50%,-50%,0) scale(.08)',offset:.22},
      {opacity:.92,transform:'translate3d(-50%,-50%,0) scale(.72)',offset:.48},
      {opacity:1,transform:'translate3d(-50%,-50%,0) scale(1)',offset:.72},
      {opacity:0,transform:'translate3d(-50%,-50%,0) scale(1.18)',offset:1}
    ],{duration,delay,easing:'cubic-bezier(.14,.72,.18,1)',fill:'forwards',rawTiming:true}));

    const largeCount=4;
    for(let i=0;i<largeCount;i++){
      const piece=document.createElement('i');
      piece.className='fx-finale-piece large';
      const angle=(-Math.PI*.88)+(Math.PI*1.76*i/Math.max(1,largeCount-1));
      const distance=Math.max(innerWidth,innerHeight)*(.28+(i%3)*.06);
      const size=58+(i%3)*18;
      Object.assign(piece.style,{left:cx+'px',top:cy+'px',width:size+'px',height:Math.round(size*.72)+'px'});
      el.appendChild(piece);
      const dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance+(i%2)*34;
      jobs.push(animateElement(piece,[
        {opacity:0,transform:'translate3d(-50%,-50%,0) rotate('+(i*23)+'deg) scale(.18)'},
        {opacity:1,transform:'translate3d(calc(-50% + '+(dx*.10)+'px),calc(-50% + '+(dy*.10)+'px),0) rotate('+(i*45)+'deg) scale(1.18)',offset:.16},
        {opacity:.98,transform:'translate3d(calc(-50% + '+(dx*.52)+'px),calc(-50% + '+(dy*.52)+'px),0) rotate('+(i*88)+'deg) scale(1)',offset:.58},
        {opacity:0,transform:'translate3d(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px),0) rotate('+(i*146)+'deg) scale(.7)',offset:1}
      ],{duration:880+(i%2)*70,delay:delay+500+i*26,easing:'cubic-bezier(.1,.66,.16,1)',fill:'forwards',rawTiming:true}));
    }

    const smallCount=5;
    for(let i=0;i<smallCount;i++){
      const piece=document.createElement('i');
      piece.className='fx-finale-piece small';
      const angle=(-Math.PI*.96)+(Math.PI*1.92*i/Math.max(1,smallCount-1));
      const distance=Math.max(innerWidth,innerHeight)*(.34+(i%4)*.05);
      const size=20+(i%4)*9;
      const startX=Math.cos(angle)*Math.max(32,rect.width*.10);
      const startY=Math.sin(angle)*Math.max(26,rect.height*.08);
      const dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance+70+(i%3)*28;
      Object.assign(piece.style,{left:cx+'px',top:cy+'px',width:size+'px',height:Math.round(size*.68)+'px'});
      el.appendChild(piece);
      jobs.push(animateElement(piece,[
        {opacity:0,transform:'translate3d(calc(-50% + '+startX+'px),calc(-50% + '+startY+'px),0) rotate('+(i*31)+'deg) scale(.2)'},
        {opacity:1,transform:'translate3d(calc(-50% + '+(startX+dx*.12)+'px),calc(-50% + '+(startY+dy*.12)+'px),0) rotate('+(i*62)+'deg) scale(1.1)',offset:.15},
        {opacity:.86,transform:'translate3d(calc(-50% + '+(dx*.62)+'px),calc(-50% + '+(dy*.62)+'px),0) rotate('+(i*118)+'deg) scale(.84)',offset:.62},
        {opacity:0,transform:'translate3d(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px),0) rotate('+(i*182)+'deg) scale(.42)',offset:1}
      ],{duration:700+(i%3)*45,delay:delay+745+(i%4)*24,easing:'cubic-bezier(.08,.62,.14,1)',fill:'forwards',rawTiming:true}));
    }
  }

  return Promise.all(jobs).finally(()=>el.remove());
}

function animateElement(el,keyframes,options={}){
  if(!el?.animate)return Promise.resolve();
  const opts={...options};
  const rawTiming=Boolean(opts.rawTiming);
  delete opts.rawTiming;
  const testTiming=Boolean(window.__ASOBOON_BOARD_TEST_TIMING__);
  const scale=value=>(rawTiming&&!testTiming)?value:(M?M.ms(value):value);
  if(Number.isFinite(Number(opts.duration)))opts.duration=scale(opts.duration);
  if(Number.isFinite(Number(opts.delay)))opts.delay=scale(opts.delay);
  if(Number.isFinite(Number(opts.endDelay)))opts.endDelay=scale(opts.endDelay);
  const animation=el.animate(keyframes,opts);
  return animation.finished.catch(()=>{});
}
function waitMs(ms,{rawTiming=false}={}){
  const testTiming=Boolean(window.__ASOBOON_BOARD_TEST_TIMING__);
  const delay=(rawTiming&&!testTiming)?ms:(M?M.ms(ms):ms);
  return new Promise(resolve=>setTimeout(resolve,delay));
}
function flashFrame(kind,rect,{duration=180}={}){
  if(reduced||effectiveLevel()<2||!rect)return Promise.resolve();
  if(M?.requestVisual&&!M.requestVisual('flash',{priority:'primary'}))return Promise.resolve();
  const el=document.createElement('div');el.className='fx-impact-flash '+kind;overlayFxLayer().appendChild(el);
  el.style.setProperty('--fx-x',(rect.left+rect.width*.5)+'px');el.style.setProperty('--fx-y',(rect.top+rect.height*.5)+'px');
  return animateElement(el,[{opacity:0},{opacity:.92,offset:.18},{opacity:.18,offset:.52},{opacity:0}],{duration,easing:'linear',fill:'forwards',rawTiming:true}).finally(()=>el.remove());
}
function foregroundShards(rect,{count=7,duration=1250}={}){
  if(reduced||effectiveLevel()<2||!rect)return Promise.resolve();
  if(M?.requestVisual&&!M.requestVisual('foreground',{priority:'secondary'}))return Promise.resolve();
  const layer=overlayFxLayer(),cx=rect.left+rect.width*.5,cy=rect.top+rect.height*.5;
  const quality=String(M?.getEffectiveQuality?.()||'HIGH').toUpperCase();
  const cap=quality==='LOW'?4:quality==='MEDIUM'?5:8;
  const total=Math.max(3,Math.min(cap,count)),jobs=[];
  for(let i=0;i<total;i++){
    const el=document.createElement('i');el.className='fx-foreground-shard';
    const baseAngle=(-145+i*(290/Math.max(1,total-1)))*Math.PI/180;
    const distance=Math.max(innerWidth,innerHeight)*(.34+(i%3)*.08),size=42+(i%4)*18;
    const angle=M?.rerouteRay?.({x:cx,y:cy},baseAngle,distance,{radius:size*.62})??baseAngle;
    Object.assign(el.style,{left:cx+'px',top:cy+'px',width:size+'px',height:Math.round(size*.58)+'px'});layer.appendChild(el);
    el.dataset.compositionGuard='v3';
    const dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance;
    jobs.push(animateElement(el,[
      {opacity:0,transform:'translate3d(-50%,-50%,0) rotate('+(i*19)+'deg) scale(.25)'},
      {opacity:1,transform:'translate3d(calc(-50% + '+(dx*.18)+'px),calc(-50% + '+(dy*.18)+'px),0) rotate('+(i*31)+'deg) scale(1.12)',offset:.2},
      {opacity:.94,transform:'translate3d(calc(-50% + '+(dx*.58)+'px),calc(-50% + '+(dy*.58)+'px),0) rotate('+(i*57)+'deg) scale(1)',offset:.62},
      {opacity:0,transform:'translate3d(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px),0) rotate('+(i*88)+'deg) scale(.82)'}
    ],{duration:duration+i*35,easing:'cubic-bezier(.14,.72,.18,1)',fill:'forwards',rawTiming:true}).finally(()=>el.remove()));
  }
  return Promise.all(jobs);
}
function impactFreeze(ms=260){return waitMs(reduced?40:ms,{rawTiming:true})}
function specialScreen(kind,rect,{duration=1700,delay=0}={}){
  if(!rect||effectiveLevel()===0)return Promise.resolve();
  const el=document.createElement('div');
  el.className='fx-special-screen '+kind;
  el.style.setProperty('--fx-x',(rect.left+rect.width*.5)+'px');
  el.style.setProperty('--fx-y',(rect.top+rect.height*.5)+'px');
  stageFxLayer().appendChild(el);
  const frames=reduced?[
    {opacity:0},{opacity:.34,offset:.35},{opacity:0}
  ]:[
    {opacity:0,transform:'scale(.985)'},
    {opacity:.94,transform:'scale(1.012)',offset:.2},
    {opacity:.76,transform:'scale(1)',offset:.72},
    {opacity:0,transform:'scale(1.025)'}
  ];
  return animateElement(el,frames,{duration,delay,easing:'cubic-bezier(.18,.82,.2,1)',fill:'forwards',rawTiming:true}).finally(()=>el.remove());
}
function screenReaction(kind,{duration=760}={}){
  if(reduced||effectiveLevel()<2)return Promise.resolve();
  const board=document.querySelector('.board');if(!board)return Promise.resolve();
  diagnostics.screenShakes+=1;
  const frames=kind==='guided'?[
    {transform:'translate3d(0,0,0)'},
    {transform:'translate3d(-12px,0,0) skewX(-.55deg)',offset:.28},
    {transform:'translate3d(7px,0,0) skewX(.25deg)',offset:.58},
    {transform:'translate3d(0,0,0)'}
  ]:kind==='hold'?[
    {transform:'translate3d(0,0,0)'},
    {transform:'translate3d(15px,0,0)',offset:.22},
    {transform:'translate3d(-9px,0,0)',offset:.43},
    {transform:'translate3d(5px,0,0)',offset:.62},
    {transform:'translate3d(0,0,0)'}
  ]:kind==='cancel'?[
    {transform:'translate3d(0,0,0) rotate(0)'},
    {transform:'translate3d(-9px,3px,0) rotate(-.14deg)',offset:.2},
    {transform:'translate3d(10px,-3px,0) rotate(.14deg)',offset:.38},
    {transform:'translate3d(-6px,-2px,0) rotate(-.09deg)',offset:.58},
    {transform:'translate3d(4px,2px,0) rotate(.05deg)',offset:.76},
    {transform:'translate3d(0,0,0) rotate(0)'}
  ]:[
    {transform:'translate3d(0,0,0) scale(1)'},
    {transform:'translate3d(0,9px,0) scale(.991)',offset:.24},
    {transform:'translate3d(0,-5px,0) scale(1.005)',offset:.5},
    {transform:'translate3d(0,2px,0) scale(.999)',offset:.74},
    {transform:'translate3d(0,0,0) scale(1)'}
  ];
  return animateElement(board,frames,{duration,easing:'cubic-bezier(.2,.82,.2,1)',rawTiming:true});
}
function shakeBoard(){
  if(reduced||effectiveLevel()<2)return Promise.resolve();
  const board=document.querySelector('.board');
  if(!board)return Promise.resolve();
  diagnostics.screenShakes+=1;
  return animateElement(board,[
    {transform:'translate3d(0,0,0)'},
    {transform:'translate3d(-3px,1px,0)'},
    {transform:'translate3d(3px,-1px,0)'},
    {transform:'translate3d(-2px,-1px,0)'},
    {transform:'translate3d(2px,1px,0)'},
    {transform:'translate3d(0,0,0)'},
  ],{duration:170,easing:'linear',rawTiming:true});
}
function rectFor(element,frame){
  if(element){
    const r=element.getBoundingClientRect();
    return{left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
  }
  return frame?.rect||null;
}
function specialFocusRect(){
  const width=Math.max(1,Math.min(innerWidth*.92,1120));
  const height=Math.max(1,Math.min(innerHeight*.52,760));
  const left=(innerWidth-width)*.5;
  const top=(innerHeight-height)*.5;
  return{left,top,width,height,right:left+width,bottom:top+height};
}

async function playCallAnimation({numbers,element,frame,rare,stableMs}){
  const values=(Array.isArray(numbers)?numbers:[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,MAX_CALL_GROUP);
  if(!values.length)return;
  const focusRect=specialFocusRect();
  const lvl=effectiveLevel();
  const timing=callGroupTiming(values.length,lvl);
  const duration=timing.total;
  stableMs=Number(stableMs)||timing.stable;

  choreoPhase('anticipation','NUMBER');
  const screen=specialScreen('call',focusRect,{duration});
  const numberFx=specialNumberTakeover(values,'call',{duration,stableMs});
  const burst=pachinkoBurst('call',focusRect,{duration:Math.min(1280,duration)});
  const signature=statusSignature('call',{duration});
  const finale=statusFinale('call',focusRect,{duration:lvl<=1?520:900});
  const particles=runParticles('call',focusRect,{rare,level:lvl,secondary:true});
  const reaction=screenReaction('call',{duration:lvl<=1?280:820});
  const flash=flashFrame('call',focusRect,{duration:lvl<=1?90:190});

  choreoPhase('impact','NUMBER',{impact:2,secondary:1,flash:1});
  await Promise.all([screen,numberFx,burst,signature,finale,particles,reaction,flash]);
  choreoPhase('aftermath','NUMBER');
}
async function playGuidedAnimation({element,frame}){
  choreoPhase('action','TARGET',{impact:1,secondary:1,flash:0});
  await playGuidedCardFx({element,frame});
  choreoPhase('aftermath','TARGET');
}
async function playHoldAnimation({element,frame}){
  choreoPhase('action','TARGET',{impact:1,secondary:1,flash:0});
  await playHoldCardFx({element,frame});
  choreoPhase('aftermath','TARGET');
}
async function playCancelAnimation({frame,element}){
  choreoPhase('impact','TARGET',{impact:1,secondary:1,flash:0});
  await playCancelCardFx({element,frame});
  choreoPhase('aftermath','TARGET');
}
function runParticles(kind,rect,{rare=false,level:requested=3,secondary=false}={}){
  if(!rect||effectiveLevel()===0)return Promise.resolve();
  const lvl=Math.min(effectiveLevel(),requested);
  const q=M?.quality?.()||{particleScale:1,maxParticles:20};
  const scope=M?.createScope?.('status-particles:'+kind);
  if(!scope)return Promise.resolve();

  const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  const desired=lvl<=1?5:lvl===2?9:12;
  const base=Math.max(4,Math.min(12,q.maxParticles,Math.round(desired*q.particleScale)));
  const particles=[];
  const palette=rare?['#ffd84f','#ff8b31','#71e4a0','#5ad7ff','#ff72ad']:['#ffd84f','#ff8b31','#73dda0','#ffffff'];
  const rand=(a,b)=>a+Math.random()*(b-a);

  if(kind==='call'){
    const count=Math.min(12,q.maxParticles,base+(rare?3:0));
    for(let i=0;i<count;i++){
      const a=rand(0,Math.PI*2),speed=rand(85,rare?280:220);
      particles.push({type:i%5===0?'star':i%4===0?'smoke':'dot',x:cx,y:cy,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-rand(0,45),size:rand(8,rare?18:15),color:palette[i%palette.length],rot:rand(0,Math.PI*2),spin:rand(-4,4)});
    }
  }else if(kind==='guided'){
    for(let i=0;i<base;i++)particles.push({type:i%4===0?'star':'line',x:cx-rand(0,rect.width*.5),y:cy+rand(-rect.height*.55,rect.height*.55),vx:rand(220,420),vy:rand(-38,38),size:rand(8,17),color:palette[i%palette.length],rot:0,spin:0});
  }else if(kind==='hold'){
    for(let i=0;i<Math.max(4,Math.floor(base*.7));i++)particles.push({type:i%2?'smoke':'line',x:rect.left+rect.width*.2,y:rect.bottom-rand(4,14),vx:rand(-110,-35),vy:rand(-75,-15),size:rand(8,18),color:i%2?'#dfe6e7':'#ffd84f',rot:0,spin:0});
  }else{
    for(let i=0;i<base;i++){
      const a=rand(-Math.PI*.95,-Math.PI*.05),speed=rand(70,220);
      particles.push({type:'shard',x:cx,y:cy,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-rand(8,48),size:rand(8,18),color:i%3===0?'#ffffff':i%3===1?'#839196':'#526268',rot:rand(0,6),spin:rand(-7,7)});
    }
  }

  const baseDuration=lvl<=1?420:kind==='call'?(rare?1400:1250):kind==='guided'?1000:kind==='hold'?1000:1200;
  return scope.canvas(baseDuration,(ctx,p,elapsed)=>{
    const t=elapsed/(M?.getSlowdown?.()||1);
    if(kind==='call'){
      const ringP=secondary?clamp((p-.05)/.55,0,1):clamp((p-.24)/.52,0,1);
      if(ringP>0&&ringP<1){
        ctx.save();
        ctx.strokeStyle=rare?'rgba(255,216,79,'+(1-ringP)+')':'rgba(115,221,160,'+(1-ringP)+')';
        ctx.lineWidth=rare?10:8;
        ctx.beginPath();ctx.arc(cx,cy,18+ringP*(rare?260:210),0,Math.PI*2);ctx.stroke();
        ctx.restore();
      }
    }
    for(const a of particles){
      const gravity=(a.type==='smoke'?10:a.type==='line'?0:95);
      const x=a.x+a.vx*t;
      const y=a.y+a.vy*t+gravity*t*t*.5;
      const alpha=Math.max(0,1-p*(a.type==='smoke'?.82:1));
      ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(a.rot+a.spin*t);
      if(a.type==='star')drawStar(ctx,a.size,a.color);
      else if(a.type==='smoke'){ctx.fillStyle=a.color;ctx.globalAlpha=alpha*.28;ctx.beginPath();ctx.arc(0,0,a.size*(1+p*1.5),0,Math.PI*2);ctx.fill()}
      else if(a.type==='line'){ctx.strokeStyle=a.color;ctx.lineWidth=Math.max(4,a.size*.34);ctx.beginPath();ctx.moveTo(-a.size*3,0);ctx.lineTo(a.size*2.3,0);ctx.stroke()}
      else if(a.type==='shard'){ctx.fillStyle=a.color;ctx.beginPath();ctx.moveTo(-a.size*.8,-a.size*.5);ctx.lineTo(a.size,.05*a.size);ctx.lineTo(-a.size*.25,a.size*.7);ctx.closePath();ctx.fill()}
      else{ctx.fillStyle=a.color;ctx.beginPath();ctx.arc(0,0,a.size,0,Math.PI*2);ctx.fill()}
      ctx.restore();
    }
  }).finally(()=>scope.cleanup());
}
function drawStar(ctx,r,color){
  ctx.fillStyle=color;
  ctx.beginPath();
  for(let i=0;i<10;i++){
    const a=-Math.PI/2+i*Math.PI/5;
    const rr=i%2===0?r:r*.43;
    const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();ctx.fill();
}

function setLevel(value){
  const n=clamp(Math.round(Number(value)||0),0,3);
  level=n;
  try{localStorage.setItem(LEVEL_KEY,String(n))}catch{}
  return level;
}
function setRareEnabled(value){
  rareEnabled=Boolean(value);
  try{localStorage.setItem(RARE_KEY,rareEnabled?'1':'0')}catch{}
  return rareEnabled;
}
function getDiagnostics(){
  return{
    ...diagnostics,
    history:diagnostics.history.map(x=>({...x})),
    queuedNow:queue.length,
    running,
    level,
    effectiveLevel:effectiveLevel(),
    rareEnabled,
    reduced,
    baselineSlot,
    globalSlowdown:M?.getSlowdown?.()||1,
    statusAnimationsChecked:4,
    fullScreenStatusCount:1,
    localStatusCount:3,
    statusAssetPolicy:'generated-only',
    statusWebpAssets:false,
    slowdownCoverage:4,
    statusTimingMode:'wall-clock',
    maxCallGroupSize:MAX_CALL_GROUP,
    maxSpecialDurationMs:6600,
    maxReducedSpecialDurationMs:5400,
    queueLimit:MAX_QUEUE,
    statusBatchBudgetMs:STATUS_BATCH_BUDGET_MS,
    maxEstimatedStatusRuntimeMs:6600,
    activeKind,
    qualityLevel:M?.getQuality?.()||'AUTO',
    effectiveQuality:M?.getEffectiveQuality?.()||'HIGH',
    sharedCanvasCount:M?.diagnostics?.().sharedCanvasCount||0,
  };
}
function resetForTest(){
  initialized=false;baselineSlot='';previous=new Map();queue.length=0;running=0;sequence=0;activeKind='';activeRunId+=1;
  diagnostics.played=0;diagnostics.queued=0;diagnostics.dropped=0;diagnostics.activeFx=0;diagnostics.screenShakes=0;diagnostics.baselines=0;
  diagnostics.skippedLevelB=0;diagnostics.interruptedLevelB=0;diagnostics.interruptedCall=0;diagnostics.budgetClosedBatches=0;diagnostics.callGroupSize=0;diagnostics.overflowCallCount=0;
  diagnostics.lastEvent=null;diagnostics.history=[];
  document.getElementById('boardFxLayer')?.remove();
}

window.ASOBOON_BOARD_ANIMATIONS=Object.freeze({
  version:'1.13.0',
  capture,
  observe,
  playStatusAnimation,
  setLevel,
  getLevel:()=>level,
  setRareEnabled,
  isRareEnabled:()=>rareEnabled,
  getDiagnostics,
  resetForTest,
});
})();
