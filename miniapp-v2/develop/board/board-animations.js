(()=>{'use strict';

const M=window.ASOBOON_BOARD_EFFECTS;
const WORLD=window.ASOBOON_BOARD_WORLD;
const DEFAULT_LEVEL=3;
const RARE_RATE=0.13;
const MAX_CONCURRENT=2;
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

function fxLayer(){
  let layer=document.getElementById('boardFxLayer');
  if(layer)return layer;
  layer=document.createElement('div');
  layer.id='boardFxLayer';
  layer.className='board-fx-layer';
  layer.setAttribute('aria-hidden','true');
  (document.querySelector('.board')||document.body).appendChild(layer);
  return layer;
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
  fxLayer().appendChild(ghost);
  return ghost;
}
function onomatopoeia(text,rect,kind){
  if(!rect||effectiveLevel()===0)return null;
  const el=document.createElement('div');
  el.className='fx-onomatopoeia '+kind;
  el.textContent=text;
  const above=rect.top>82;
  el.style.left=clamp(rect.left+rect.width*.5,70,window.innerWidth-70)+'px';
  el.style.top=(above?rect.top-14:rect.bottom+18)+'px';
  fxLayer().appendChild(el);
  const duration=(M?M.ms(reduced?360:720):(reduced?360:720));
  const anim=el.animate([
    {opacity:0,transform:'translate(-50%,-50%) scale(.55) rotate(-7deg)'},
    {opacity:1,transform:'translate(-50%,-50%) scale(1.18) rotate(3deg)',offset:.28},
    {opacity:1,transform:'translate(-50%,-50%) scale(1) rotate(-1deg)',offset:.62},
    {opacity:0,transform:'translate(-50%,-62%) scale(1.04) rotate(0deg)'},
  ],{duration,easing:'cubic-bezier(.2,.85,.28,1)',fill:'forwards'});
  anim.finished.catch(()=>{}).finally(()=>el.remove());
  return el;
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

async function playCallAnimation({element,frame,rare}){
  const target=currentFrame(element)||frame;
  const rect=rectFor(element,target);
  if(!rect)return;
  const lvl=effectiveLevel();
  const ghost=ghostFrom(target,'fx-call-ghost');
  onomatopoeia(rare?'ドッカーン!!':'ドカン！',rect,'call');
  const particles=runParticles('call',rect,{rare,level:lvl});
  const world=WORLD?.playStatusReaction?.('call',{grid:element?.closest?.('.queue-grid')||document.getElementById('queueGrid'),level:lvl,rect})||Promise.resolve();
  const elementPulse=element?animateElement(element,lvl<=1?[
    {transform:'scale(1)'},
    {transform:'scale(1.045)'},
    {transform:'scale(1)'},
  ]:[
    {transform:'scale(1)'},
    {transform:'scale(1.13)',offset:.34},
    {transform:'scale(.96)',offset:.54},
    {transform:'scale(1.055)',offset:.74},
    {transform:'scale(1)'},
  ],{duration:lvl<=1?420:1120,delay:lvl<=1?0:260,easing:'cubic-bezier(.22,.9,.24,1)' }):Promise.resolve();

  let flight=Promise.resolve();
  if(ghost){
    flight=animateElement(ghost,lvl<=1?[
      {opacity:.2,transform:'translate3d(-20px,-12px,0) scale(.92)'},
      {opacity:.9,transform:'translate3d(0,0,0) scale(1.03)'},
      {opacity:0,transform:'translate3d(0,0,0) scale(1)'},
    ]:[
      {opacity:.15,transform:'translate3d(-68vw,-18vh,0) rotate(-7deg) scale(.62)'},
      {opacity:1,transform:'translate3d(14px,-10px,0) rotate(1deg) scale(1.14)',offset:.68},
      {opacity:1,transform:'translate3d(-5px,4px,0) rotate(-.5deg) scale(.98)',offset:.84},
      {opacity:0,transform:'translate3d(0,0,0) rotate(0) scale(1)'},
    ],{duration:lvl<=1?430:1300,easing:'cubic-bezier(.12,.82,.18,1)',fill:'forwards'}).finally(()=>ghost.remove());
  }
  if(!reduced&&lvl>=2)setTimeout(()=>{void shakeBoard()},M?M.ms(480):480);
  if(rare&&!reduced) setTimeout(()=>{void runParticles('call',rect,{rare:true,level:lvl,secondary:true})},M?M.ms(360):360);
  await Promise.all([flight,particles,elementPulse,world]);
}
async function playGuidedAnimation({element,frame}){
  const source=frame||currentFrame(element);
  const rect=source?.rect||rectFor(element,source);
  if(!rect)return;
  const lvl=effectiveLevel();
  const ghost=ghostFrom(source,'fx-guided-ghost');
  onomatopoeia('ビューン！',rect,'guided');
  const particles=runParticles('guided',rect,{level:lvl});
  const world=WORLD?.playStatusReaction?.('guided',{grid:document.getElementById('queueGrid'),level:lvl,rect})||Promise.resolve();
  const useFilter=(M?.getEffectiveQuality?.()||'HIGH')==='HIGH';
  const settle=element?animateElement(element,useFilter?[
    {transform:'scale(1.04)',filter:'brightness(1.15)'},
    {transform:'scale(1)',filter:'brightness(1)'},
  ]:[
    {transform:'scale(1.04)'},
    {transform:'scale(1)'},
  ],{duration:lvl<=1?300:900,easing:'ease-out'}):Promise.resolve();
  let flight=Promise.resolve();
  if(ghost){
    flight=animateElement(ghost,lvl<=1?[
      {opacity:.85,transform:'translate3d(0,0,0) scale(1)'},
      {opacity:0,transform:'translate3d(18px,-4px,0) scale(.96)'},
    ]:[
      {opacity:1,transform:'translate3d(0,0,0) rotate(0) scale(1)'},
      {opacity:1,transform:'translate3d(18px,-3px,0) rotate(1deg) scale(1.04)',offset:.18},
      {opacity:.15,transform:'translate3d(58vw,-9vh,0) rotate(6deg) scale(.82)'},
    ],{duration:lvl<=1?360:1050,easing:'cubic-bezier(.2,.7,.14,1)',fill:'forwards'}).finally(()=>ghost.remove());
  }
  await Promise.all([flight,particles,settle,world]);
}
async function playHoldAnimation({element,frame}){
  const rect=rectFor(element,frame);
  if(!rect)return;
  const lvl=effectiveLevel();
  onomatopoeia('ピタッ！',rect,'hold');
  const particles=runParticles('hold',rect,{level:lvl});
  const world=WORLD?.playStatusReaction?.('hold',{grid:document.getElementById('queueGrid'),level:lvl,rect})||Promise.resolve();
  const motion=element?animateElement(element,lvl<=1?[
    {transform:'translateX(0)'},
    {transform:'translateX(4px)'},
    {transform:'translateX(-3px)'},
    {transform:'translateX(0)'},
  ]:[
    {transform:'translate3d(0,0,0) rotate(0)'},
    {transform:'translate3d(14px,0,0) rotate(1deg)',offset:.25},
    {transform:'translate3d(-8px,0,0) rotate(-.8deg)',offset:.45},
    {transform:'translate3d(6px,0,0) rotate(.6deg)',offset:.6},
    {transform:'translate3d(-4px,0,0) rotate(-.35deg)',offset:.75},
    {transform:'translate3d(0,0,0) rotate(0)'},
  ],{duration:lvl<=1?320:1000,easing:'cubic-bezier(.2,.8,.25,1)'}):Promise.resolve();
  await Promise.all([motion,particles,world]);
}
async function playCancelAnimation({frame,element}){
  const source=frame||currentFrame(element);
  const rect=source?.rect||rectFor(element,source);
  if(!rect)return;
  const lvl=effectiveLevel();
  const ghost=ghostFrom(source,'fx-cancel-ghost');
  if(ghost)attachCracks(ghost);
  onomatopoeia('パリン！',rect,'cancel');
  const particles=runParticles('cancel',rect,{level:lvl});
  const world=WORLD?.playStatusReaction?.('cancel',{grid:document.getElementById('queueGrid'),level:lvl,rect})||Promise.resolve();
  let shatter=Promise.resolve();
  if(ghost){
    shatter=animateElement(ghost,lvl<=1?[
      {opacity:1,transform:'scale(1)'},
      {opacity:.7,transform:'scale(1.02)'},
      {opacity:0,transform:'scale(.96) translateY(8px)'},
    ]:[
      {opacity:1,transform:'scale(1) rotate(0)'},
      {opacity:1,transform:'scale(1.045) rotate(-.5deg)',offset:.26},
      {opacity:.5,transform:'scale(.98) rotate(1deg) translateY(4px)',offset:.56},
      {opacity:0,transform:'scale(.84) rotate(3deg) translateY(26px)'},
    ],{duration:lvl<=1?380:1200,easing:'cubic-bezier(.2,.75,.22,1)',fill:'forwards'}).finally(()=>ghost.remove());
  }
  await Promise.all([shatter,particles,world]);
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
    fullScreenStatusCount:WORLD?4:0,
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
  version:'1.0.0',
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
