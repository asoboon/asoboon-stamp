(()=>{'use strict';

const M=window.ASOBOON_BOARD_EFFECTS;
const SOURCEFX=window.ASOBOON_BOARD_SOURCE_EFFECTS||null;
const CHAR=window.ASOBOON_BOARD_CHARACTER_EVENTS||null;
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
  try{
    if(resolvedKind==='call')await playCallAnimation({number,element,frame,rare});
    else if(resolvedKind==='guided')await playGuidedAnimation({number,element,frame});
    else if(resolvedKind==='hold')await playHoldAnimation({number,element,frame});
    else if(resolvedKind==='cancel')await playCancelAnimation({number,element,frame});
  }finally{
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
  const el=document.createElement('div');
  el.className='fx-onomatopoeia '+kind+(giant?' giant':'');
  el.textContent=text;
  const cx=rect.left+rect.width*.5,cy=rect.top+rect.height*.5;
  el.style.left=clamp(cx,giant?window.innerWidth*.18:70,giant?window.innerWidth*.82:window.innerWidth-70)+'px';
  el.style.top=clamp(cy,giant?window.innerHeight*.2:55,giant?window.innerHeight*.8:window.innerHeight-55)+'px';
  overlayFxLayer().appendChild(el);
  const rawDuration=duration??(reduced?360:(giant?1320:760));
  const animation=el.animate(giant?[
    {opacity:0,transform:'translate(-50%,-50%) scale(.22) rotate(-10deg)'},
    {opacity:1,transform:'translate(-50%,-50%) scale(1.34) rotate(4deg)',offset:.2},
    {opacity:1,transform:'translate(-50%,-50%) scale(.98) rotate(-2deg)',offset:.46},
    {opacity:1,transform:'translate(-50%,-50%) scale(1.04) rotate(0deg)',offset:.8},
    {opacity:0,transform:'translate(-50%,-56%) scale(1.1) rotate(1deg)'},
  ]:[
    {opacity:0,transform:'translate(-50%,-50%) scale(.55) rotate(-7deg)'},
    {opacity:1,transform:'translate(-50%,-50%) scale(1.18) rotate(3deg)',offset:.28},
    {opacity:1,transform:'translate(-50%,-50%) scale(1) rotate(-1deg)',offset:.68},
    {opacity:0,transform:'translate(-50%,-62%) scale(1.04) rotate(0deg)'},
  ],{duration:M?M.ms(rawDuration):rawDuration,delay:M?M.ms(delay):delay,easing:'cubic-bezier(.2,.85,.28,1)',fill:'forwards'});
  return animation.finished.catch(()=>{}).finally(()=>el.remove());
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
  const el=document.createElement('div');el.className='fx-impact-flash '+kind;overlayFxLayer().appendChild(el);
  el.style.setProperty('--fx-x',(rect.left+rect.width*.5)+'px');el.style.setProperty('--fx-y',(rect.top+rect.height*.5)+'px');
  return animateElement(el,[{opacity:0},{opacity:.92,offset:.18},{opacity:.18,offset:.52},{opacity:0}],{duration,easing:'linear',fill:'forwards'}).finally(()=>el.remove());
}
function foregroundShards(rect,{count=7,duration=1250}={}){
  if(reduced||effectiveLevel()<2||!rect)return Promise.resolve();
  const layer=overlayFxLayer(),cx=rect.left+rect.width*.5,cy=rect.top+rect.height*.5;
  const total=Math.max(4,Math.min(8,count)),jobs=[];
  for(let i=0;i<total;i++){
    const el=document.createElement('i');el.className='fx-foreground-shard';
    const angle=(-145+i*(290/Math.max(1,total-1)))*Math.PI/180;
    const distance=Math.max(innerWidth,innerHeight)*(.34+(i%3)*.08),size=42+(i%4)*18;
    Object.assign(el.style,{left:cx+'px',top:cy+'px',width:size+'px',height:Math.round(size*.58)+'px'});layer.appendChild(el);
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
  const screen=specialScreen('call',rect,{duration:lvl<=1?760:2700});
  await Promise.all([onomatopoeia('キタ！',rect,'call',{duration:lvl<=1?420:760}),element?animateElement(element,[{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1.06)'}],{duration:lvl<=1?300:620,fill:'forwards'}):Promise.resolve()]);
  const character=CHAR?.playCallDelivery?.({number,rect,element,level:lvl,rare})||Promise.resolve();
  await waitMs(lvl<=1?70:300);
  const boom=onomatopoeia('ドォォン！！',rect,'call',{giant:true,duration:lvl<=1?560:1520});
  const sourceFx=SOURCEFX?.playStatusReaction?.('call',{rect,level:lvl})||Promise.resolve();
  const reaction=screenReaction('call',{duration:lvl<=1?340:960});
  const flash=flashFrame('call',rect,{duration:lvl<=1?90:180});
  const elementPulse=element?animateElement(element,lvl<=1?[
    {transform:'scale(1)'},
    {transform:'scale(1.055)'},
    {transform:'scale(1)'},
  ]:[
    {transform:'scale(1)'},
    {transform:'scale(1.34)',offset:.22},
    {transform:'scale(.92)',offset:.4},
    {transform:'scale(1.12)',offset:.6},
    {transform:'scale(.98)',offset:.78},
    {transform:'scale(1)'},
  ],{duration:lvl<=1?520:1740,easing:'cubic-bezier(.18,.92,.22,1)'}):Promise.resolve();
  await Promise.all([boom,sourceFx,reaction,flash,elementPulse]);
  await impactFreeze(lvl<=1?50:300);
  await character;
  await Promise.all([screen,element?animateElement(element,[{transform:'scale(1.04)'},{transform:'scale(1)'}],{duration:lvl<=1?220:620,fill:'forwards'}):Promise.resolve()]);
}
async function playGuidedAnimation({element,frame}){
  const source=frame||currentFrame(element);
  const rect=source?.rect||rectFor(element,source);
  if(!rect)return;
  const lvl=effectiveLevel();
  const ghost=ghostFrom(source,'fx-guided-ghost');
  const screen=specialScreen('guided',rect,{duration:lvl<=1?720:2650});
  await onomatopoeia('ググッ…',rect,'guided',{duration:lvl<=1?300:620});
  const sourceFx=SOURCEFX?.playStatusReaction?.('guided',{rect,level:lvl})||Promise.resolve();
  const character=CHAR?.playStatusAccent?.('guided',{rect})||Promise.resolve();
  const reaction=screenReaction('guided',{duration:lvl<=1?300:900});
  const launch=onomatopoeia('シュッ！！',rect,'guided',{giant:true,duration:lvl<=1?420:980});
  let flight=Promise.resolve();
  if(ghost){
    flight=animateElement(ghost,lvl<=1?[
      {opacity:.9,transform:'translate3d(0,0,0) scale(1)'},
      {opacity:1,transform:'translate3d(42vw,-3vh,0) scale(.9)'},
      {opacity:0,transform:'translate3d(82vw,-5vh,0) scale(.76)'},
    ]:[
      {opacity:1,transform:'translate3d(0,0,0) rotate(0) scale(1)'},
      {opacity:1,transform:'translate3d(0,0,0) rotate(0) scale(1.06)',offset:.18},
      {opacity:1,transform:'translate3d(30px,-4px,0) rotate(1deg) scale(1.09)',offset:.34},
      {opacity:1,transform:'translate3d(72vw,-8vh,0) rotate(7deg) scale(.82)',offset:.88},
      {opacity:0,transform:'translate3d(96vw,-10vh,0) rotate(9deg) scale(.7)'},
    ],{duration:lvl<=1?460:1580,easing:'cubic-bezier(.16,.72,.14,1)',fill:'forwards'}).finally(()=>ghost.remove());
  }
  const settle=element?animateElement(element,[
    {transform:'scale(1.08)'},
    {transform:'scale(1.02)',offset:.55},
    {transform:'scale(1)'},
  ],{duration:lvl<=1?340:1120,easing:'ease-out'}):Promise.resolve();
  await Promise.all([flight,settle,sourceFx,reaction,launch]);
  await impactFreeze(lvl<=1?30:180);
  await onomatopoeia('ビューン！！',rect,'guided',{giant:true,duration:lvl<=1?420:1040});
  await Promise.all([screen,character]);
}
async function playHoldAnimation({element,frame}){
  const rect=rectFor(element,frame);
  if(!rect)return;
  const lvl=effectiveLevel();
  const screen=specialScreen('hold',rect,{duration:lvl<=1?760:2900});
  const screech=onomatopoeia('キキキキィー！！',rect,'hold',{giant:true,duration:lvl<=1?560:1460});
  const sourceFx=SOURCEFX?.playStatusReaction?.('hold',{rect,level:lvl})||Promise.resolve();
  const character=CHAR?.playStatusAccent?.('hold',{rect})||Promise.resolve();
  const reaction=screenReaction('hold',{duration:lvl<=1?340:1080});
  const motion=element?animateElement(element,lvl<=1?[
    {transform:'translateX(-4px)'},
    {transform:'translateX(7px)'},
    {transform:'translateX(0)'},
  ]:[
    {transform:'translate3d(-12px,0,0) rotate(-.7deg)'},
    {transform:'translate3d(20px,0,0) rotate(1.2deg)',offset:.22},
    {transform:'translate3d(-10px,0,0) rotate(-1deg)',offset:.4},
    {transform:'translate3d(7px,0,0) rotate(.7deg)',offset:.58},
    {transform:'translate3d(-4px,0,0) rotate(-.35deg)',offset:.76},
    {transform:'translate3d(0,0,0) rotate(0)'},
  ],{duration:lvl<=1?360:1280,easing:'cubic-bezier(.16,.86,.2,1)'}):Promise.resolve();
  await Promise.all([screech,motion,sourceFx,reaction]);
  await impactFreeze(lvl<=1?60:320);
  await onomatopoeia('ピタッ！！',rect,'hold',{giant:true,duration:lvl<=1?480:1220});
  await Promise.all([screen,character]);
}
async function playCancelAnimation({frame,element}){
  const source=frame||currentFrame(element);
  const rect=source?.rect||rectFor(element,source);
  if(!rect)return;
  const lvl=effectiveLevel();
  const ghost=ghostFrom(source,'fx-cancel-ghost');
  if(ghost)attachCracks(ghost);
  const screen=specialScreen('cancel',rect,{duration:lvl<=1?820:3900});
  await onomatopoeia('ミシ…',rect,'cancel',{duration:lvl<=1?440:940});
  await impactFreeze(lvl<=1?50:420);
  const character=CHAR?.playStatusAccent?.('cancel',{rect})||Promise.resolve();
  await waitMs(lvl<=1?80:520);
  const breakText=onomatopoeia('バァァァリン！！',rect,'cancel',{giant:true,duration:lvl<=1?620:1780});
  const reaction=screenReaction('cancel',{duration:lvl<=1?380:1240});
  const sourceFx=SOURCEFX?.playStatusReaction?.('cancel',{rect,level:lvl})||Promise.resolve();
  const shards=foregroundShards(rect,{count:lvl<=1?4:6,duration:lvl<=1?620:1480});
  const flash=flashFrame('cancel',rect,{duration:lvl<=1?100:210});
  let shatter=Promise.resolve();
  if(ghost){
    shatter=animateElement(ghost,lvl<=1?[
      {opacity:1,transform:'scale(1)'},
      {opacity:.72,transform:'scale(1.03)'},
      {opacity:0,transform:'scale(.93) translateY(9px)'},
    ]:[
      {opacity:1,transform:'scale(1) rotate(0)'},
      {opacity:1,transform:'scale(1.07) rotate(-.7deg)',offset:.2},
      {opacity:1,transform:'scale(.99) rotate(.8deg)',offset:.38},
      {opacity:.52,transform:'scale(.94) rotate(2deg) translateY(9px)',offset:.62},
      {opacity:.16,transform:'scale(.76) rotate(5deg) translateY(42px)',offset:.78},
      {opacity:0,transform:'scale(.7) rotate(6deg) translateY(64px)'},
    ],{duration:lvl<=1?500:1720,easing:'cubic-bezier(.18,.78,.2,1)',fill:'forwards'}).finally(()=>ghost.remove());
  }
  await Promise.all([breakText,reaction,sourceFx,shatter,shards,flash]);
  await impactFreeze(lvl<=1?60:340);
  await character;
  await onomatopoeia('ガシャン！',rect,'cancel',{giant:true,duration:lvl<=1?480:1120});
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
  version:'1.4.0',
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
