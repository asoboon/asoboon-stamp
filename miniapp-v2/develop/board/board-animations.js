(()=>{'use strict';

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
    const v=Number(localStorage.getItem(LEVEL_KEY));
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
function observe({slotKey,rows,previousFrame,grid}={}){
  const next=snapshot(rows);
  const slot=String(slotKey||'');
  if(!initialized||baselineSlot!==slot){
    initialized=true;
    baselineSlot=slot;
    previous=next;
    queue.length=0;
    diagnostics.baselines+=1;
    return;
  }

  const events=[];
  for(const [key,now] of next){
    const before=previous.get(key);
    if(!before)continue;
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
  previous=next;

  if(document.visibilityState==='hidden'||effectiveLevel()===0)return;
  const cards=new Map();
  grid?.querySelectorAll?.('.queue-card[data-row-key]').forEach(card=>cards.set(String(card.dataset.rowKey||''),card));
  for(const evt of events.slice(0,MAX_BATCH)){
    evt.element=cards.get(evt.key)||null;
    enqueue(evt);
  }
  if(events.length>MAX_BATCH)diagnostics.dropped+=events.length-MAX_BATCH;
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
    },delay);
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
  const duration=reduced?360:720;
  const anim=el.animate([
    {opacity:0,transform:'translate(-50%,-50%) scale(.55) rotate(-7deg)'},
    {opacity:1,transform:'translate(-50%,-50%) scale(1.18) rotate(3deg)',offset:.28},
    {opacity:1,transform:'translate(-50%,-50%) scale(1) rotate(-1deg)',offset:.62},
    {opacity:0,transform:'translate(-50%,-62%) scale(1.04) rotate(0deg)'},
  ],{duration,easing:'cubic-bezier(.2,.85,.28,1)',fill:'forwards'});
  anim.finished.catch(()=>{}).finally(()=>el.remove());
  return el;
}
function animateElement(el,keyframes,options){
  if(!el?.animate)return Promise.resolve();
  const animation=el.animate(keyframes,options);
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
  ],{duration:lvl<=1?420:760,delay:lvl<=1?0:330,easing:'cubic-bezier(.22,.9,.24,1)' }):Promise.resolve();

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
    ],{duration:lvl<=1?430:930,easing:'cubic-bezier(.12,.82,.18,1)',fill:'forwards'}).finally(()=>ghost.remove());
  }
  if(!reduced&&lvl>=2)setTimeout(()=>{void shakeBoard()},410);
  if(rare&&!reduced) setTimeout(()=>{void runParticles('call',rect,{rare:true,level:lvl,secondary:true})},240);
  await Promise.all([flight,particles,elementPulse]);
}
async function playGuidedAnimation({element,frame}){
  const source=frame||currentFrame(element);
  const rect=source?.rect||rectFor(element,source);
  if(!rect)return;
  const lvl=effectiveLevel();
  const ghost=ghostFrom(source,'fx-guided-ghost');
  onomatopoeia('ビューン！',rect,'guided');
  const particles=runParticles('guided',rect,{level:lvl});
  const settle=element?animateElement(element,[
    {transform:'scale(1.04)',filter:'brightness(1.15)'},
    {transform:'scale(1)',filter:'brightness(1)'},
  ],{duration:lvl<=1?300:520,easing:'ease-out'}):Promise.resolve();
  let flight=Promise.resolve();
  if(ghost){
    flight=animateElement(ghost,lvl<=1?[
      {opacity:.85,transform:'translate3d(0,0,0) scale(1)'},
      {opacity:0,transform:'translate3d(18px,-4px,0) scale(.96)'},
    ]:[
      {opacity:1,transform:'translate3d(0,0,0) rotate(0) scale(1)'},
      {opacity:1,transform:'translate3d(18px,-3px,0) rotate(1deg) scale(1.04)',offset:.18},
      {opacity:.15,transform:'translate3d(58vw,-9vh,0) rotate(6deg) scale(.82)'},
    ],{duration:lvl<=1?360:720,easing:'cubic-bezier(.2,.7,.14,1)',fill:'forwards'}).finally(()=>ghost.remove());
  }
  await Promise.all([flight,particles,settle]);
}
async function playHoldAnimation({element,frame}){
  const rect=rectFor(element,frame);
  if(!rect)return;
  const lvl=effectiveLevel();
  onomatopoeia('ピタッ！',rect,'hold');
  const particles=runParticles('hold',rect,{level:lvl});
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
  ],{duration:lvl<=1?320:650,easing:'cubic-bezier(.2,.8,.25,1)'}):Promise.resolve();
  await Promise.all([motion,particles]);
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
  let shatter=Promise.resolve();
  if(ghost){
    shatter=animateElement(ghost,lvl<=1?[
      {opacity:1,transform:'scale(1)'},
      {opacity:.7,transform:'scale(1.02)'},
      {opacity:0,transform:'scale(.96) translateY(8px)'},
    ]:[
      {opacity:1,transform:'scale(1) rotate(0)',filter:'blur(0)'},
      {opacity:1,transform:'scale(1.045) rotate(-.5deg)',filter:'blur(0)',offset:.26},
      {opacity:.5,transform:'scale(.98) rotate(1deg) translateY(4px)',filter:'blur(.5px)',offset:.56},
      {opacity:0,transform:'scale(.84) rotate(3deg) translateY(26px)',filter:'blur(2px)'},
    ],{duration:lvl<=1?380:720,easing:'cubic-bezier(.2,.75,.22,1)',fill:'forwards'}).finally(()=>ghost.remove());
  }
  await Promise.all([shatter,particles]);
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
  const layer=fxLayer();
  const canvas=document.createElement('canvas');
  canvas.className='fx-canvas';
  const dpr=Math.min(window.devicePixelRatio||1,1.5);
  const width=window.innerWidth,height=window.innerHeight;
  canvas.width=Math.max(1,Math.floor(width*dpr));
  canvas.height=Math.max(1,Math.floor(height*dpr));
  canvas.style.width=width+'px';
  canvas.style.height=height+'px';
  layer.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  if(!ctx){canvas.remove();return Promise.resolve()}
  ctx.scale(dpr,dpr);

  const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  const base=lvl<=1?8:lvl===2?22:36;
  const particles=[];
  const palette=rare?['#ffd84f','#ff8b31','#71e4a0','#5ad7ff','#ff72ad']:['#ffd84f','#ff8b31','#73dda0','#ffffff'];
  const push=(p)=>particles.push(p);
  const rand=(a,b)=>a+Math.random()*(b-a);

  if(kind==='call'){
    const count=base+(rare?24:0);
    for(let i=0;i<count;i++){
      const a=rand(0,Math.PI*2),speed=rand(55,rare?240:185);
      push({type:i%6===0?'star':i%5===0?'smoke':'dot',x:cx,y:cy,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-rand(0,45),size:rand(3,rare?10:8),color:palette[i%palette.length],rot:rand(0,Math.PI*2),spin:rand(-5,5)});
    }
    if(rare){
      for(let i=0;i<20;i++){
        const a=rand(0,Math.PI*2),speed=rand(80,210);
        push({type:'confetti',x:cx,y:cy,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-35,size:rand(4,8),color:palette[i%palette.length],rot:rand(0,6),spin:rand(-8,8)});
      }
    }
  }else if(kind==='guided'){
    for(let i=0;i<base;i++)push({type:i%5===0?'star':'line',x:cx-rand(0,rect.width*.4),y:cy+rand(-rect.height*.45,rect.height*.45),vx:rand(150,310),vy:rand(-30,30),size:rand(3,8),color:palette[i%palette.length],rot:0,spin:0});
  }else if(kind==='hold'){
    for(let i=0;i<Math.max(6,Math.floor(base*.55));i++)push({type:i%2?'smoke':'line',x:rect.left+rect.width*.2,y:rect.bottom-rand(4,12),vx:rand(-85,-20),vy:rand(-55,-10),size:rand(4,10),color:i%2?'#dfe6e7':'#ffd84f',rot:0,spin:0});
  }else if(kind==='cancel'){
    for(let i=0;i<base;i++){
      const a=rand(-Math.PI*.95,-Math.PI*.05),speed=rand(45,175);
      push({type:'shard',x:cx,y:cy,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-rand(5,35),size:rand(4,10),color:i%3===0?'#ffffff':i%3===1?'#839196':'#526268',rot:rand(0,6),spin:rand(-9,9)});
    }
  }

  const duration=lvl<=1?420:kind==='call'?(rare?1050:900):kind==='guided'?650:kind==='hold'?520:680;
  const start=performance.now();
  return new Promise(resolve=>{
    const tick=now=>{
      const elapsed=now-start;
      const p=clamp(elapsed/duration,0,1);
      ctx.clearRect(0,0,width,height);

      if(kind==='call'){
        const ringP=secondary?clamp((p-.05)/.55,0,1):clamp((p-.24)/.52,0,1);
        if(ringP>0&&ringP<1){
          ctx.save();
          ctx.strokeStyle=rare?'rgba(255,216,79,'+(1-ringP)+')':'rgba(115,221,160,'+(1-ringP)+')';
          ctx.lineWidth=rare?5:4;
          ctx.beginPath();ctx.arc(cx,cy,12+ringP*(rare?150:115),0,Math.PI*2);ctx.stroke();
          if(rare){
            ctx.strokeStyle='rgba(255,139,49,'+((1-ringP)*.8)+')';
            ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,7+ringP*205,0,Math.PI*2);ctx.stroke();
          }
          ctx.restore();
        }
      }

      for(const q of particles){
        const t=elapsed/1000;
        const gravity=(q.type==='smoke'?8:q.type==='line'?0:85);
        const x=q.x+q.vx*t;
        const y=q.y+q.vy*t+gravity*t*t*.5;
        const alpha=Math.max(0,1-p*(q.type==='smoke'?.82:1));
        ctx.save();
        ctx.globalAlpha=alpha;
        ctx.translate(x,y);
        ctx.rotate(q.rot+q.spin*t);
        if(q.type==='star')drawStar(ctx,q.size,q.color);
        else if(q.type==='smoke'){
          ctx.fillStyle=q.color;ctx.globalAlpha=alpha*.38;ctx.beginPath();ctx.arc(0,0,q.size*(1+p*1.8),0,Math.PI*2);ctx.fill();
        }else if(q.type==='line'){
          ctx.strokeStyle=q.color;ctx.lineWidth=Math.max(2,q.size*.35);ctx.beginPath();ctx.moveTo(-q.size*2.8,0);ctx.lineTo(q.size*2.2,0);ctx.stroke();
        }else if(q.type==='shard'){
          ctx.fillStyle=q.color;ctx.beginPath();ctx.moveTo(-q.size*.8,-q.size*.5);ctx.lineTo(q.size,.05*q.size);ctx.lineTo(-q.size*.25,q.size*.7);ctx.closePath();ctx.fill();
        }else if(q.type==='confetti'){
          ctx.fillStyle=q.color;ctx.fillRect(-q.size*.7,-q.size*.25,q.size*1.4,q.size*.5);
        }else{
          ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(0,0,q.size,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
      }

      if(p<1)requestAnimationFrame(tick);
      else{canvas.remove();resolve()}
    };
    requestAnimationFrame(tick);
  });
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
