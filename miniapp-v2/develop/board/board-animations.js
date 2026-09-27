(()=>{'use strict';

const M=window.ASOBOON_BOARD_EFFECTS;
const SOURCEFX=window.ASOBOON_BOARD_SOURCE_EFFECTS||null;
const DEFAULT_LEVEL=3;
const RARE_RATE=0.13;
const MAX_CONCURRENT=1;
const MAX_BATCH=8;
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
const diagnostics={
  played:0,
  queued:0,
  dropped:0,
  activeFx:0,
  screenShakes:0,
  baselines:0,
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
      continue;
    }
    if(before.state!==now.state||before.order!==now.order||before.number!==now.number)dataChangeCount+=1;
    const kind=transitionKind(before.state,now.state);
    if(!kind)continue;
    events.push({
      id:++sequence,
      key,
      number:now.number,
      fromStatus:before.state,
      toStatus:now.state,
      kind,
      frame:previousFrame?.get?.(key)||null,
      grid,
    });
  }
  for(const key of previous.keys())if(!next.has(key))dataChangeCount+=1;
  previous=next;

  if(dataChangeCount>0&&typeof onBeforeRealChange==='function'){
    try{onBeforeRealChange({dataChangeCount,events})}catch{}
  }

  if(document.visibilityState!=='hidden'&&effectiveLevel()>0){
    const cards=new Map();
    grid?.querySelectorAll?.('.queue-card[data-row-key]').forEach(card=>cards.set(String(card.dataset.rowKey||''),card));
    for(const evt of events.slice(0,MAX_BATCH)){
      evt.element=cards.get(evt.key)||null;
      enqueue(evt);
    }
    if(events.length>MAX_BATCH)diagnostics.dropped+=events.length-MAX_BATCH;
  }
  return {
    baseline:false,
    changeCount:events.length,
    dataChangeCount,
    events:events.map(({number,fromStatus,toStatus,kind})=>({number,fromStatus,toStatus,kind})),
  };
}
function enqueue(evt){
  queue.push(evt);
  diagnostics.queued+=1;
  pump();
}
function pump(){
  while(running<MAX_CONCURRENT&&queue.length){
    const evt=queue.shift();
    const delay=running*STAGGER_MS;
    running+=1;
    setTimeout(()=>{
      playStatusAnimation(evt).catch(()=>{}).finally(()=>{
        running=Math.max(0,running-1);
        pump();
      });
    },M?M.ms(delay):delay);
  }
}
async function playStatusAnimation({number,fromStatus,toStatus,element,frame,kind}={}){
  const resolvedKind=kind||transitionKind(String(fromStatus||''),String(toStatus||''));
  if(!resolvedKind||effectiveLevel()===0)return;
  diagnostics.played+=1;
  diagnostics.lastEvent={number:String(number||''),kind:resolvedKind,fromStatus:String(fromStatus||''),toStatus:String(toStatus||'')};
  diagnostics.history.push({...diagnostics.lastEvent,at:Date.now()});
  diagnostics.history=diagnostics.history.slice(-30);
  diagnostics.activeFx+=1;
  const rare=resolvedKind==='call'&&rareEnabled&&effectiveLevel()>=3&&Math.random()<RARE_RATE;
  M?.beginChoreography?.(resolvedKind,{
    budgets:{typography:1,foreground:1,impact:2,reaction:2,secondary:1,flash:1}
  });
  try{
    if(resolvedKind==='call')await playCallAnimation({number,element,frame,rare});
    else if(resolvedKind==='guided')await playGuidedAnimation({number,element,frame});
    else if(resolvedKind==='hold')await playHoldAnimation({number,element,frame});
    else if(resolvedKind==='cancel')await playCancelAnimation({number,element,frame});
  }finally{
    M?.endChoreography?.('complete');
    diagnostics.activeFx=Math.max(0,diagnostics.activeFx-1);
  }
}

function stageFxLayer(){
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
function onomatopoeia(text,rect,kind,{giant=false,delay=0,duration=null}={}){
  if(!rect||effectiveLevel()===0)return Promise.resolve();
  if(M?.requestVisual&&!M.requestVisual('typography',{priority:'primary'}))return Promise.resolve();
  const el=document.createElement('div');
  el.className='fx-onomatopoeia '+kind+(giant?' giant':'');
  el.textContent=text;
  el.style.visibility='hidden';
  overlayFxLayer().appendChild(el);
  const measuredWidth=Math.min(innerWidth*.94,Math.max(70,el.offsetWidth||0));
  const measuredHeight=Math.min(innerHeight*.32,Math.max(44,el.offsetHeight||0));
  const guardScale=giant?1.36:1.18;
  const guardWidth=Math.min(innerWidth*.96,measuredWidth*guardScale);
  const guardHeight=Math.min(innerHeight*.38,measuredHeight*guardScale);
  const fallback={x:rect.left+rect.width*.5,y:rect.top+rect.height*.5,scale:1};
  const placement=M?.chooseTypographyPlacement?.(rect,{width:guardWidth,height:guardHeight,giant})||
    M?.chooseOverlayPlacement?.(rect,{width:guardWidth,height:guardHeight,giant})||fallback;
  const layoutScale=Math.max(.68,Math.min(1,Number(placement.scale)||1));
  const ts=n=>Math.round(n*layoutScale*1000)/1000;
  el.style.left=placement.x+'px';
  el.style.top=placement.y+'px';
  el.style.visibility='';
  el.dataset.compositionGuard='v3';
  el.dataset.choreoScale=String(layoutScale);
  const rawDuration=duration??(reduced?360:(giant?1320:760));
  const animation=el.animate(giant?[
    {opacity:0,transform:'translate(-50%,-50%) scale('+ts(.22)+') rotate(-10deg)'},
    {opacity:1,transform:'translate(-50%,-50%) scale('+ts(1.34)+') rotate(4deg)',offset:.2},
    {opacity:1,transform:'translate(-50%,-50%) scale('+ts(.98)+') rotate(-2deg)',offset:.46},
    {opacity:1,transform:'translate(-50%,-50%) scale('+ts(1.04)+') rotate(0deg)',offset:.8},
    {opacity:0,transform:'translate(-50%,-56%) scale('+ts(1.1)+') rotate(1deg)'},
  ]:[
    {opacity:0,transform:'translate(-50%,-50%) scale('+ts(.55)+') rotate(-7deg)'},
    {opacity:1,transform:'translate(-50%,-50%) scale('+ts(1.18)+') rotate(3deg)',offset:.28},
    {opacity:1,transform:'translate(-50%,-50%) scale('+ts(1)+') rotate(-1deg)',offset:.68},
    {opacity:0,transform:'translate(-50%,-62%) scale('+ts(1.04)+') rotate(0deg)'},
  ],{duration:M?M.ms(rawDuration):rawDuration,delay:M?M.ms(delay):delay,easing:'cubic-bezier(.2,.85,.28,1)',fill:'forwards'});
  return animation.finished.catch(()=>{}).finally(()=>el.remove());
}

function specialTextRect(rect,zone='top'){
  const w=Math.max(rect?.width||220,Math.min(innerWidth*.62,680));
  const h=Math.max(rect?.height||100,Math.min(innerHeight*.1,150));
  const cx=innerWidth*.5;
  const cy=zone==='bottom'?innerHeight*.79:zone==='middle'?innerHeight*.5:innerHeight*.18;
  return{left:cx-w/2,top:cy-h/2,width:w,height:h,right:cx+w/2,bottom:cy+h/2};
}
function specialNumberTakeover(number,kind,{label='',status='',duration=1600}={}){
  const value=String(number||'').trim();
  if(!value||effectiveLevel()===0)return Promise.resolve();
  M?.requestVisual?.('number',{priority:'essential'});
  const el=document.createElement('div');
  el.className='fx-special-number '+String(kind||'call');
  el.dataset.specialNumber=value;
  el.setAttribute('aria-hidden','true');

  const kicker=document.createElement('div');
  kicker.className='fx-special-number-kicker';
  kicker.textContent=label;
  const num=document.createElement('div');
  num.className='fx-special-number-value';
  num.textContent=value;
  const sub=document.createElement('div');
  sub.className='fx-special-number-status';
  sub.textContent=status;
  el.append(kicker,num,sub);
  if(kind==='cancel')attachCracks(el);
  overlayFxLayer().appendChild(el);

  const low=reduced||effectiveLevel()<=1;
  const frames=kind==='guided'
    ?(low?[
      {opacity:0,transform:'translate3d(0,70px,0) scale(.64)'},
      {opacity:1,transform:'translate3d(0,0,0) scale(1)',offset:.34},
      {opacity:0,transform:'translate3d(66vw,-20px,0) scale(.76)'}
    ]:[
      {opacity:0,transform:'translate3d(-18vw,40px,0) scale(.46) skewX(-5deg)'},
      {opacity:1,transform:'translate3d(0,0,0) scale(1.18) skewX(1deg)',offset:.24},
      {opacity:1,transform:'translate3d(0,0,0) scale(.98)',offset:.45},
      {opacity:1,transform:'translate3d(18vw,-8px,0) scale(1.02) skewX(-2deg)',offset:.62},
      {opacity:0,transform:'translate3d(96vw,-34px,0) scale(.62) skewX(-8deg)'}
    ])
    :kind==='hold'
    ?(low?[
      {opacity:0,transform:'translate3d(-70px,0,0) scale(.72)'},
      {opacity:1,transform:'translate3d(10px,0,0) scale(1.04)',offset:.36},
      {opacity:1,transform:'translate3d(0,0,0) scale(1)',offset:.62},
      {opacity:0,transform:'translate3d(0,0,0) scale(1)'}
    ]:[
      {opacity:0,transform:'translate3d(-34vw,0,0) scale(.76) skewX(-7deg)'},
      {opacity:1,transform:'translate3d(42px,0,0) scale(1.2) skewX(2deg)',offset:.23},
      {opacity:1,transform:'translate3d(-22px,0,0) scale(.96)',offset:.31},
      {opacity:1,transform:'translate3d(12px,0,0) scale(1.04)',offset:.39},
      {opacity:1,transform:'translate3d(-5px,0,0) scale(1)',offset:.48},
      {opacity:1,transform:'translate3d(0,0,0) scale(1)',offset:.82},
      {opacity:0,transform:'translate3d(0,0,0) scale(1.04)'}
    ])
    :kind==='cancel'
    ?(low?[
      {opacity:0,transform:'scale(.62) rotate(-2deg)'},
      {opacity:1,transform:'scale(1.06) rotate(0)',offset:.34},
      {opacity:.86,transform:'scale(.96) rotate(1deg)',offset:.66},
      {opacity:0,transform:'scale(.78) rotate(4deg) translateY(36px)'}
    ]:[
      {opacity:0,transform:'scale(.36) rotate(-4deg)'},
      {opacity:1,transform:'scale(1.22) rotate(1deg)',offset:.2},
      {opacity:1,transform:'scale(.98) rotate(-1deg)',offset:.34},
      {opacity:1,transform:'scale(1.04) rotate(.5deg)',offset:.56},
      {opacity:.42,transform:'scale(.9) rotate(3deg) translateY(28px)',offset:.76},
      {opacity:0,transform:'scale(.62) rotate(7deg) translateY(90px)'}
    ])
    :(low?[
      {opacity:0,transform:'scale(.5)'},
      {opacity:1,transform:'scale(1.08)',offset:.34},
      {opacity:1,transform:'scale(1)',offset:.72},
      {opacity:0,transform:'scale(1.05)'}
    ]:[
      {opacity:0,transform:'scale(.16) rotate(-5deg)'},
      {opacity:1,transform:'scale(1.28) rotate(2deg)',offset:.18},
      {opacity:1,transform:'scale(.9) rotate(-1deg)',offset:.31},
      {opacity:1,transform:'scale(1.08) rotate(.4deg)',offset:.46},
      {opacity:1,transform:'scale(1)',offset:.78},
      {opacity:0,transform:'scale(1.06)'}
    ]);

  return animateElement(el,frames,{duration,easing:'cubic-bezier(.16,.88,.18,1)',fill:'forwards'})
    .finally(()=>el.remove());
}
function pachinkoBurst(kind,rect,{duration=1150}={}){
  if(effectiveLevel()===0||!rect)return Promise.resolve();
  M?.requestVisual?.('secondary',{priority:'essential'});
  const el=document.createElement('div');
  el.className='fx-pachinko-burst '+String(kind||'call');
  el.setAttribute('aria-hidden','true');
  el.style.setProperty('--fx-x',(rect.left+rect.width*.5)+'px');
  el.style.setProperty('--fx-y',(rect.top+rect.height*.5)+'px');
  const ring=document.createElement('i');
  ring.className='fx-pachinko-ring';
  el.appendChild(ring);
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
  const main=animateElement(el,frames,{duration,easing:'cubic-bezier(.14,.8,.2,1)',fill:'forwards'});
  const ringAnim=reduced?Promise.resolve():animateElement(ring,[
    {opacity:0,transform:'translate(-50%,-50%) scale(.08)'},
    {opacity:1,transform:'translate(-50%,-50%) scale(.58)',offset:.24},
    {opacity:.92,transform:'translate(-50%,-50%) scale(1.08)',offset:.62},
    {opacity:0,transform:'translate(-50%,-50%) scale(1.72)'}
  ],{duration:Math.max(420,duration*.86),easing:'cubic-bezier(.1,.76,.14,1)',fill:'forwards'});
  return Promise.all([main,ringAnim]).finally(()=>el.remove());
}

function animateElement(el,keyframes,options={}){
  if(!el?.animate)return Promise.resolve();
  const opts={...options};
  if(Number.isFinite(Number(opts.duration)))opts.duration=M?M.ms(opts.duration):opts.duration;
  if(Number.isFinite(Number(opts.delay)))opts.delay=M?M.ms(opts.delay):opts.delay;
  if(Number.isFinite(Number(opts.endDelay)))opts.endDelay=M?M.ms(opts.endDelay):opts.endDelay;
  const animation=el.animate(keyframes,opts);
  return animation.finished.catch(()=>{});
}
function waitMs(ms){return new Promise(resolve=>setTimeout(resolve,M?M.ms(ms):ms))}
function flashFrame(kind,rect,{duration=180}={}){
  if(reduced||effectiveLevel()<2||!rect)return Promise.resolve();
  if(M?.requestVisual&&!M.requestVisual('flash',{priority:'primary'}))return Promise.resolve();
  const el=document.createElement('div');el.className='fx-impact-flash '+kind;overlayFxLayer().appendChild(el);
  el.style.setProperty('--fx-x',(rect.left+rect.width*.5)+'px');el.style.setProperty('--fx-y',(rect.top+rect.height*.5)+'px');
  return animateElement(el,[{opacity:0},{opacity:.92,offset:.18},{opacity:.18,offset:.52},{opacity:0}],{duration,easing:'linear',fill:'forwards'}).finally(()=>el.remove());
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
    ],{duration:duration+i*35,easing:'cubic-bezier(.14,.72,.18,1)',fill:'forwards'}).finally(()=>el.remove()));
  }
  return Promise.all(jobs);
}
function impactFreeze(ms=260){return waitMs(reduced?40:ms)}
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
  return animateElement(el,frames,{duration,delay,easing:'cubic-bezier(.18,.82,.2,1)',fill:'forwards'}).finally(()=>el.remove());
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
  return animateElement(board,frames,{duration,easing:'cubic-bezier(.2,.82,.2,1)'});
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
  ],{duration:170,easing:'linear'});
}
function rectFor(element,frame){
  if(element){
    const r=element.getBoundingClientRect();
    return{left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
  }
  return frame?.rect||null;
}

async function playCallAnimation({number,element,frame,rare}){
  const target=currentFrame(element)||frame;
  const rect=rectFor(element,target);
  if(!rect)return;
  const lvl=effectiveLevel();

  choreoPhase('announce','NUMBER');
  const screen=specialScreen('call',rect,{duration:lvl<=1?980:3100});
  const burst=pachinkoBurst('call',rect,{duration:lvl<=1?620:1420});
  await Promise.all([
    onomatopoeia('呼出！',specialTextRect(rect,'top'),'call',{duration:lvl<=1?360:680}),
    element?animateElement(element,[{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:lvl<=1?280:560,fill:'forwards'}):Promise.resolve()
  ]);

  choreoPhase('impact','NUMBER',{typography:1,impact:2,secondary:1,flash:1});
  const numberFx=specialNumberTakeover(number,'call',{
    label:'ただいま呼出中',
    status:'ご案内します',
    duration:lvl<=1?980:1900
  });
  const boom=onomatopoeia('ドォォン！！',specialTextRect(rect,'bottom'),'call',{giant:true,duration:lvl<=1?520:1260});
  const sourceFx=SOURCEFX?.playStatusReaction?.('call',{rect,level:lvl})||Promise.resolve();
  const particles=runParticles('call',rect,{rare,level:lvl,secondary:true});
  const reaction=screenReaction('call',{duration:lvl<=1?300:820});
  const flash=flashFrame('call',rect,{duration:lvl<=1?100:210});
  await Promise.all([numberFx,boom,sourceFx,particles,reaction,flash,burst]);

  choreoPhase('aftermath','NUMBER');
  await impactFreeze(lvl<=1?50:220);
  await screen;
}
async function playGuidedAnimation({number,element,frame}){
  const source=frame||currentFrame(element);
  const rect=source?.rect||rectFor(element,source);
  if(!rect)return;
  const lvl=effectiveLevel();
  const ghost=ghostFrom(source,'fx-guided-ghost');

  choreoPhase('announce','NUMBER');
  const screen=specialScreen('guided',rect,{duration:lvl<=1?900:2850});
  await onomatopoeia('ご案内！',specialTextRect(rect,'top'),'guided',{duration:lvl<=1?320:620});

  choreoPhase('action','NUMBER',{typography:1,secondary:1,impact:2,flash:1});
  const numberFx=specialNumberTakeover(number,'guided',{
    label:'ご案内済み',
    status:'いってらっしゃい！',
    duration:lvl<=1?900:1660
  });
  const burst=pachinkoBurst('guided',rect,{duration:lvl<=1?560:1260});
  const sourceFx=SOURCEFX?.playStatusReaction?.('guided',{rect,level:lvl})||Promise.resolve();
  const particles=runParticles('guided',rect,{level:lvl,secondary:true});
  const reaction=screenReaction('guided',{duration:lvl<=1?280:780});
  const launch=onomatopoeia('ビューン！！',specialTextRect(rect,'bottom'),'guided',{giant:true,duration:lvl<=1?440:980});
  let flight=Promise.resolve();
  if(ghost){
    flight=animateElement(ghost,lvl<=1?[
      {opacity:.9,transform:'translate3d(0,0,0) scale(1)'},
      {opacity:0,transform:'translate3d(82vw,-5vh,0) scale(.76)'},
    ]:[
      {opacity:1,transform:'translate3d(0,0,0) rotate(0) scale(1.06)'},
      {opacity:1,transform:'translate3d(30px,-4px,0) rotate(1deg) scale(1.09)',offset:.22},
      {opacity:1,transform:'translate3d(72vw,-8vh,0) rotate(7deg) scale(.82)',offset:.82},
      {opacity:0,transform:'translate3d(96vw,-10vh,0) rotate(9deg) scale(.7)'},
    ],{duration:lvl<=1?460:1480,easing:'cubic-bezier(.16,.72,.14,1)',fill:'forwards'}).finally(()=>ghost.remove());
  }
  await Promise.all([numberFx,burst,sourceFx,particles,reaction,launch,flight]);
  choreoPhase('aftermath','NUMBER');
  await screen;
}
async function playHoldAnimation({number,element,frame}){
  const rect=rectFor(element,frame);
  if(!rect)return;
  const lvl=effectiveLevel();

  choreoPhase('action','NUMBER');
  const screen=specialScreen('hold',rect,{duration:lvl<=1?980:3050});
  const numberFx=specialNumberTakeover(number,'hold',{
    label:'保留',
    status:'そのままお待ちください',
    duration:lvl<=1?1080:1960
  });
  const burst=pachinkoBurst('hold',rect,{duration:lvl<=1?620:1440});
  const screech=onomatopoeia('キキィーッ！！',specialTextRect(rect,'top'),'hold',{giant:true,duration:lvl<=1?560:1260});
  const sourceFx=SOURCEFX?.playStatusReaction?.('hold',{rect,level:lvl})||Promise.resolve();
  const particles=runParticles('hold',rect,{level:lvl,secondary:true});
  const reaction=screenReaction('hold',{duration:lvl<=1?340:980});
  const motion=element?animateElement(element,lvl<=1?[
    {transform:'translateX(-4px)'},
    {transform:'translateX(7px)'},
    {transform:'translateX(0)'},
  ]:[
    {transform:'translate3d(-14px,0,0) rotate(-.8deg)'},
    {transform:'translate3d(24px,0,0) rotate(1.4deg)',offset:.22},
    {transform:'translate3d(-12px,0,0) rotate(-1deg)',offset:.4},
    {transform:'translate3d(8px,0,0) rotate(.7deg)',offset:.58},
    {transform:'translate3d(-4px,0,0) rotate(-.35deg)',offset:.76},
    {transform:'translate3d(0,0,0) rotate(0)'},
  ],{duration:lvl<=1?360:1180,easing:'cubic-bezier(.16,.86,.2,1)'}):Promise.resolve();

  await Promise.all([numberFx,burst,screech,sourceFx,particles,reaction,motion]);
  choreoPhase('impact','NUMBER');
  await impactFreeze(lvl<=1?60:300);
  await onomatopoeia('ピタッ！！',specialTextRect(rect,'bottom'),'hold',{giant:true,duration:lvl<=1?460:980});
  choreoPhase('aftermath','NUMBER');
  await screen;
}
async function playCancelAnimation({number,frame,element}){
  const source=frame||currentFrame(element);
  const rect=source?.rect||rectFor(element,source);
  if(!rect)return;
  const lvl=effectiveLevel();
  const ghost=ghostFrom(source,'fx-cancel-ghost');
  if(ghost)attachCracks(ghost);

  choreoPhase('omen','NUMBER');
  const screen=specialScreen('cancel',rect,{duration:lvl<=1?1040:3600});
  await onomatopoeia('ミシ…',specialTextRect(rect,'top'),'cancel',{duration:lvl<=1?420:760});
  await impactFreeze(lvl<=1?40:260);

  choreoPhase('impact','NUMBER',{typography:1,foreground:1,impact:2,secondary:1,flash:1});
  const numberFx=specialNumberTakeover(number,'cancel',{
    label:'取消',
    status:'受付を取り消しました',
    duration:lvl<=1?980:1780
  });
  const burst=pachinkoBurst('cancel',rect,{duration:lvl<=1?620:1380});
  const breakText=onomatopoeia('バァァァリン！！',specialTextRect(rect,'bottom'),'cancel',{giant:true,duration:lvl<=1?600:1420});
  const reaction=screenReaction('cancel',{duration:lvl<=1?360:1080});
  const sourceFx=SOURCEFX?.playStatusReaction?.('cancel',{rect,level:lvl})||Promise.resolve();
  const particles=runParticles('cancel',rect,{level:lvl,secondary:true});
  const shards=foregroundShards(rect,{count:lvl<=1?4:6,duration:lvl<=1?620:1320});
  const flash=flashFrame('cancel',rect,{duration:lvl<=1?110:230});
  let shatter=Promise.resolve();
  if(ghost){
    shatter=animateElement(ghost,lvl<=1?[
      {opacity:1,transform:'scale(1)'},
      {opacity:.68,transform:'scale(1.03)'},
      {opacity:0,transform:'scale(.9) translateY(12px)'},
    ]:[
      {opacity:1,transform:'scale(1) rotate(0)'},
      {opacity:1,transform:'scale(1.08) rotate(-.8deg)',offset:.2},
      {opacity:.52,transform:'scale(.92) rotate(2deg) translateY(10px)',offset:.58},
      {opacity:0,transform:'scale(.68) rotate(7deg) translateY(70px)'},
    ],{duration:lvl<=1?480:1500,easing:'cubic-bezier(.18,.78,.2,1)',fill:'forwards'}).finally(()=>ghost.remove());
  }
  await Promise.all([numberFx,burst,breakText,reaction,sourceFx,particles,shatter,shards,flash]);
  choreoPhase('aftermath','NUMBER');
  await onomatopoeia('ガシャン！',specialTextRect(rect,'middle'),'cancel',{giant:true,duration:lvl<=1?420:880});
  await screen;
}
function attachCracks(ghost){
  const crack=document.createElement('div');
  crack.className='fx-cracks';
  crack.innerHTML='<i></i><i></i><i></i><i></i><i></i>';
  ghost.appendChild(crack);
}

function runParticles(kind,rect,{rare=false,level:requested=3,secondary=false}={}){
  if(!rect||effectiveLevel()===0)return Promise.resolve();
  const lvl=Math.min(effectiveLevel(),requested);
  const q=M?.quality?.()||{particleScale:1,maxParticles:20};
  const scope=M?.createScope?.('status-particles:'+kind);
  if(!scope)return Promise.resolve();

  const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  const desired=lvl<=1?5:lvl===2?12:18;
  const base=Math.max(4,Math.min(q.maxParticles,Math.round(desired*q.particleScale)));
  const particles=[];
  const palette=rare?['#ffd84f','#ff8b31','#71e4a0','#5ad7ff','#ff72ad']:['#ffd84f','#ff8b31','#73dda0','#ffffff'];
  const rand=(a,b)=>a+Math.random()*(b-a);

  if(kind==='call'){
    const count=Math.min(q.maxParticles,base+(rare?4:0));
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
    fullScreenStatusCount:SOURCEFX?4:0,
    slowdownCoverage:4,
    qualityLevel:M?.getQuality?.()||'AUTO',
    effectiveQuality:M?.getEffectiveQuality?.()||'HIGH',
    sharedCanvasCount:M?.diagnostics?.().sharedCanvasCount||0,
  };
}
function resetForTest(){
  initialized=false;baselineSlot='';previous=new Map();queue.length=0;running=0;sequence=0;
  diagnostics.played=0;diagnostics.queued=0;diagnostics.dropped=0;diagnostics.activeFx=0;diagnostics.screenShakes=0;diagnostics.baselines=0;diagnostics.lastEvent=null;diagnostics.history=[];
  document.getElementById('boardFxLayer')?.remove();
}

window.ASOBOON_BOARD_ANIMATIONS=Object.freeze({
  version:'1.5.0',
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
