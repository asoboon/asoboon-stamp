(()=>{'use strict';

const DEFAULT_SLOWDOWN=2.5;
const LOW_SPEC_FALLBACK=true;
const SLOWDOWN_KEY='asoboon_board_global_slowdown_v2';
const QUALITY_KEY='asoboon_board_quality_v1';
const QUALITY_MODES=Object.freeze(['AUTO','HIGH','MEDIUM','LOW']);
const QUALITY_PROFILES=Object.freeze({
  HIGH:Object.freeze({name:'HIGH',particleScale:1,canvasScale:1,maxParticles:20,decorations:1,shadows:true,blur:true}),
  MEDIUM:Object.freeze({name:'MEDIUM',particleScale:.58,canvasScale:.85,maxParticles:12,decorations:.7,shadows:false,blur:false}),
  LOW:Object.freeze({name:'LOW',particleScale:.32,canvasScale:.68,maxParticles:8,decorations:.42,shadows:false,blur:false}),
});

const reducedQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
let reduced=Boolean(reducedQuery?.matches);
let slowdown=readNumber(SLOWDOWN_KEY,DEFAULT_SLOWDOWN,.02,5);
let qualityMode=readQuality();
let autoQuality='HIGH';
let lastQualityChange=0;
let longTasks=0;
let frameSamples=[];
let frameEma=16.7;
let fpsEma=60;

const scopes=new Set();
const frameTasks=new Set();
let rafId=0;
let lastFrameAt=0;
let monitoring=true;
let sharedCanvas=null;
let sharedCtx=null;
let sharedCanvasUsers=0;
let baselineDomCount=document.getElementsByTagName('*').length;
let peakDomCount=baselineDomCount;
let maxFrameTasks=0;
let maxCanvasJobs=0;
let qualityChanges=0;
const canvasJobs=new Set();
let canvasDirty=false;

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function readNumber(key,fallback,min,max){
  try{
    const raw=localStorage.getItem(key);
    if(raw===null)return fallback;
    const value=Number(raw);
    return Number.isFinite(value)?clamp(value,min,max):fallback;
  }catch{return fallback}
}
function readQuality(){
  try{
    const raw=String(localStorage.getItem(QUALITY_KEY)||'AUTO').toUpperCase();
    return QUALITY_MODES.includes(raw)?raw:'AUTO';
  }catch{return'AUTO'}
}
function persist(){
  try{
    localStorage.setItem(SLOWDOWN_KEY,String(slowdown));
    localStorage.setItem(QUALITY_KEY,qualityMode);
  }catch{}
}
function ms(base){return Math.max(1,(Math.max(0,Number(base)||0))*slowdown)}
// Stop an animation early without retaining the cancelled Animation target subtree.
function releaseAnimation(animation){
  if(!animation)return;
  try{animation.effect?.updateTiming?.({fill:'none'})}catch{}
  try{animation.finish()}
  catch{try{animation.cancel();animation.effect=null}catch{}}
}
function effectiveQualityName(){
  if(reduced)return'LOW';
  return qualityMode==='AUTO'?autoQuality:qualityMode;
}
function quality(){return QUALITY_PROFILES[effectiveQualityName()]||QUALITY_PROFILES.HIGH}
function applyEnvironment(){
  const root=document.documentElement;
  root.style.setProperty('--board-motion-scale',String(slowdown));
  root.style.setProperty('--board-transition-fast',ms(90)+'ms');
  root.style.setProperty('--board-transition-normal',ms(180)+'ms');
  root.style.setProperty('--board-transition-slow',ms(300)+'ms');
  root.dataset.boardQuality=effectiveQualityName().toLowerCase();
  root.classList.toggle('board-reduced-motion',reduced);
}
function setSlowdown(value,{persistValue=true}={}){
  const n=Number(value);if(!Number.isFinite(n)||n<=0)return slowdown;
  slowdown=clamp(n,.02,5);if(persistValue)persist();applyEnvironment();return slowdown;
}
function setQuality(value,{persistValue=true}={}){
  const mode=String(value||'AUTO').toUpperCase();
  if(!QUALITY_MODES.includes(mode))return qualityMode;
  qualityMode=mode;if(persistValue)persist();applyEnvironment();return qualityMode;
}
function setAutoQuality(next){
  if(!['HIGH','MEDIUM','LOW'].includes(next)||autoQuality===next)return;
  autoQuality=next;qualityChanges+=1;lastQualityChange=performance.now();applyEnvironment();resizeSharedCanvas();
}
function evaluateQuality(now){
  if(qualityMode!=='AUTO'||reduced)return;
  if(now-lastQualityChange<5000)return;
  const recent=frameSamples.slice(-90);
  if(recent.length<20)return;
  const avg=recent.reduce((a,b)=>a+b,0)/recent.length;
  const slow=recent.filter(x=>x>28).length/recent.length;
  const verySlow=recent.filter(x=>x>45).length/recent.length;
  if(autoQuality==='HIGH'&&(avg>22||slow>.18||longTasks>=2))setAutoQuality('MEDIUM');
  else if(autoQuality==='MEDIUM'&&(avg>31||verySlow>.12||longTasks>=4))setAutoQuality('LOW');
  else if(autoQuality==='LOW'&&avg<19&&slow<.06&&longTasks===0)setAutoQuality('MEDIUM');
  else if(autoQuality==='MEDIUM'&&avg<18&&slow<.04&&longTasks===0)setAutoQuality('HIGH');
  if(now-lastQualityChange>9000)longTasks=Math.max(0,longTasks-1);
}
function mainLoop(now){
  rafId=0;
  if(lastFrameAt){
    const delta=Math.min(250,Math.max(1,now-lastFrameAt));
    frameSamples.push(delta);if(frameSamples.length>180)frameSamples.shift();
    frameEma=frameEma*.92+delta*.08;fpsEma=fpsEma*.9+(1000/delta)*.1;
    evaluateQuality(now);
  }
  lastFrameAt=now;
  const domNow=document.getElementsByTagName('*').length;
  if(domNow>peakDomCount)peakDomCount=domNow;
  if(frameTasks.size>maxFrameTasks)maxFrameTasks=frameTasks.size;
  if(canvasJobs.size>maxCanvasJobs)maxCanvasJobs=canvasJobs.size;

  for(const task of [...frameTasks]){
    if(task.signal?.aborted){frameTasks.delete(task);task.resolve?.();continue}
    const p=clamp((now-task.started)/task.duration,0,1);
    try{task.draw?.(p,(now-task.started)/1000,task.duration,now)}catch{}
    if(p>=1){frameTasks.delete(task);task.resolve?.()}
  }

  if(canvasJobs.size){
    ensureSharedCanvas();
    const rect={width:innerWidth,height:innerHeight};
    if(sharedCtx){
      sharedCtx.setTransform(1,0,0,1,0,0);
      sharedCtx.clearRect(0,0,sharedCanvas.width,sharedCanvas.height);
      const scale=sharedCanvas.width/Math.max(1,rect.width);
      sharedCtx.setTransform(scale,0,0,scale,0,0);
      for(const job of [...canvasJobs]){
        if(job.signal?.aborted){canvasJobs.delete(job);job.resolve?.();continue}
        const p=clamp((now-job.started)/job.duration,0,1);
        try{job.draw?.(sharedCtx,p,(now-job.started)/1000,job.duration,quality())}catch{}
        if(p>=1){canvasJobs.delete(job);job.resolve?.()}
      }
      canvasDirty=true;
    }
  }else if(canvasDirty&&sharedCtx){
    sharedCtx.setTransform(1,0,0,1,0,0);sharedCtx.clearRect(0,0,sharedCanvas.width,sharedCanvas.height);canvasDirty=false;
  }

  if(monitoring||frameTasks.size||canvasJobs.size)scheduleLoop();
}
function scheduleLoop(){if(!rafId)rafId=requestAnimationFrame(mainLoop)}
function runFrameTask(scope,baseDuration,draw){
  if(scope?.signal?.aborted)return Promise.resolve();
  return new Promise(resolve=>{
    const task={scope,signal:scope?.signal,started:performance.now(),duration:ms(baseDuration),draw,resolve};
    frameTasks.add(task);scheduleLoop();
  });
}
function runCanvas(scope,baseDuration,draw){
  if(scope?.signal?.aborted)return Promise.resolve();
  ensureSharedCanvas();sharedCanvasUsers+=1;
  return new Promise(resolve=>{
    const done=()=>{sharedCanvasUsers=Math.max(0,sharedCanvasUsers-1);resolve()};
    canvasJobs.add({scope,signal:scope?.signal,started:performance.now(),duration:ms(baseDuration),draw,resolve:done});
    scheduleLoop();
  });
}
function ensureSharedCanvas(){
  if(sharedCanvas&&sharedCtx){resizeSharedCanvas();return sharedCanvas}
  sharedCanvas=document.createElement('canvas');
  sharedCanvas.id='boardSharedFxCanvas';sharedCanvas.className='board-shared-fx-canvas';
  sharedCanvas.setAttribute('aria-hidden','true');
  (document.querySelector('.board')||document.body).appendChild(sharedCanvas);
  sharedCtx=sharedCanvas.getContext('2d',{alpha:true,desynchronized:true});
  resizeSharedCanvas();return sharedCanvas;
}
function resizeSharedCanvas(){
  if(!sharedCanvas)return;
  const q=quality();const dpr=Math.min(devicePixelRatio||1,1.15)*q.canvasScale;
  const w=Math.max(1,Math.round(innerWidth*dpr)),h=Math.max(1,Math.round(innerHeight*dpr));
  if(sharedCanvas.width!==w||sharedCanvas.height!==h){sharedCanvas.width=w;sharedCanvas.height=h}
  sharedCanvas.style.width=innerWidth+'px';sharedCanvas.style.height=innerHeight+'px';
}
function getLayer(which='back'){
  const key=which==='overlay'?'overlay':which==='front'?'front':'back';
  const id=key==='overlay'?'boardFxOverlayLayer':key==='front'?'boardFxFrontLayer':'boardFxBackLayer';
  let layer=document.getElementById(id);
  if(layer)return layer;
  layer=document.createElement('div');layer.id=id;
  layer.className=key==='overlay'?'board-fx-overlay-layer':key==='front'?'board-fx-front-layer':'board-fx-back-layer';
  layer.setAttribute('aria-hidden','true');
  (document.querySelector('.board')||document.body).appendChild(layer);
  return layer;
}

const compositionStats={snapshots:0,adjustments:0,textPlacements:0,rayReroutes:0};
function compositionBoardRect(){
  const r=document.querySelector('.board')?.getBoundingClientRect?.();
  return r||{left:0,top:0,width:innerWidth,height:innerHeight,right:innerWidth,bottom:innerHeight};
}
function characterAnchorPoint(el,key='CENTER',space='viewport'){
  if(!el?.getBoundingClientRect)return null;
  const r=el.getBoundingClientRect();
  if(!r.width||!r.height)return null;
  const assets=window.ASOBOON_BOARD_CHARACTER_ASSETS;
  const anchors=assets?.CHARACTER_ANCHORS?.[el.dataset?.pcAsset]||{CENTER:[.5,.5]};
  const raw=anchors[key]||anchors.CENTER||[.5,.5];
  const flip=Number(el.dataset?.sceneFlip)||1;
  const nx=flip<0?1-Number(raw[0]):Number(raw[0]),ny=Number(raw[1]);
  const viewport={x:r.left+r.width*nx,y:r.top+r.height*ny};
  if(space!=='local')return viewport;
  const board=compositionBoardRect();
  return{x:viewport.x-board.left,y:viewport.y-board.top};
}
function characterVisibilityRect(el){
  if(!el?.isConnected||el.dataset?.pcSuppressed==='1')return null;
  const r=el.getBoundingClientRect?.();if(!r||!r.width||!r.height)return null;
  const style=getComputedStyle(el);
  if(style.visibility==='hidden'||style.display==='none'||Number(style.opacity)===0)return null;
  const board=compositionBoardRect();
  if(r.right<board.left-80||r.left>board.right+80||r.bottom<board.top-80||r.top>board.bottom+80)return null;
  return r;
}
function normalizedVisualRect(el,zone,space='viewport',kind='face'){
  const r=characterVisibilityRect(el);if(!r||!Array.isArray(zone))return null;
  const board=compositionBoardRect(),flip=Number(el.dataset?.sceneFlip)||1;
  const rawX=Number(zone[0]),ny=Number(zone[1]),nw=Number(zone[2]),nh=Number(zone[3]);
  const nx=flip<0?1-rawX:rawX;
  const width=Math.max(kind==='body'?72:36,r.width*nw);
  const height=Math.max(kind==='body'?82:34,r.height*nh);
  const x=r.left+r.width*nx,y=r.top+r.height*ny;
  const out={left:x-width/2,top:y-height/2,width,height,right:x+width/2,bottom:y+height/2,asset:String(el.dataset?.pcAsset||''),owner:String(el.dataset?.pcOwner||''),kind};
  if(space!=='local')return out;
  return{...out,left:out.left-board.left,right:out.right-board.left,top:out.top-board.top,bottom:out.bottom-board.top};
}
function safeRectsForCharacter(el,kind='face',space='viewport'){
  const r=characterVisibilityRect(el);if(!r)return[];
  const assets=window.ASOBOON_BOARD_CHARACTER_ASSETS;
  const visual=assets?.CHARACTER_VISUAL_ZONES?.[el.dataset?.pcAsset];
  if(kind==='body'){
    if(visual?.body)return[normalizedVisualRect(el,visual.body,space,'body')].filter(Boolean);
    const p=characterAnchorPoint(el,'BODY','viewport');if(!p)return[];
    const zone=[(p.x-r.left)/r.width,(p.y-r.top)/r.height,.62,.66];
    return[normalizedVisualRect(el,zone,space,'body')].filter(Boolean);
  }
  if(Array.isArray(visual?.faces)&&visual.faces.length){
    return visual.faces.map(zone=>normalizedVisualRect(el,zone,space,'face')).filter(Boolean);
  }
  const p=characterAnchorPoint(el,'FACE_SAFE','viewport');if(!p)return[];
  const zone=[(p.x-r.left)/r.width,(p.y-r.top)/r.height,.34,.28];
  return[normalizedVisualRect(el,zone,space,'face')].filter(Boolean);
}
function safeRectForCharacter(el,kind='face',space='viewport'){
  return safeRectsForCharacter(el,kind,space)[0]||null;
}
function compositionSnapshot(){
  const characters=[];
  document.querySelectorAll('.pc-character[data-pc-asset]').forEach(el=>{
    const faces=safeRectsForCharacter(el,'face','viewport');
    const body=safeRectForCharacter(el,'body','viewport');
    if(faces.length||body)characters.push({asset:String(el.dataset?.pcAsset||''),owner:String(el.dataset?.pcOwner||''),faces,face:faces[0]||null,body});
  });
  compositionStats.snapshots+=1;
  return{characters,faces:characters.flatMap(x=>x.faces||[]),bodies:characters.map(x=>x.body).filter(Boolean)};
}
function rectFromCenter(x,y,width,height){return{left:x-width/2,top:y-height/2,width,height,right:x+width/2,bottom:y+height/2}}
function intersectionArea(a,b){
  if(!a||!b)return 0;
  const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
  const h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  return w*h;
}
function overlapRatio(a,b){
  const inter=intersectionArea(a,b);if(!inter)return 0;
  const aa=Math.max(1,a.width*a.height),ba=Math.max(1,b.width*b.height);
  return inter/Math.min(aa,ba);
}
function clampCenter(point,width,height){
  const margin=8;
  return{
    x:clamp(Number(point.x)||0,width/2+margin,Math.max(width/2+margin,innerWidth-width/2-margin)),
    y:clamp(Number(point.y)||0,height/2+margin,Math.max(height/2+margin,innerHeight-height/2-margin))
  };
}
function resolveEffectPoint(point,{width=90,height=90,phase='reaction'}={}){
  const original=clampCenter(point,width,height),snap=compositionSnapshot();
  const threshold=phase==='impact'?.46:.10,margin=phase==='impact'?3:12;
  let current={...original},adjusted=false,before=0,after=0;
  const scoreCandidate=(candidate)=>{
    const box=rectFromCenter(candidate.x,candidate.y,width,height);
    let overlap=0;
    for(const face of snap.faces)overlap+=Math.max(0,overlapRatio(box,face)-threshold)*12000;
    const travel=Math.hypot(candidate.x-original.x,candidate.y-original.y);
    return overlap+travel*.7;
  };
  for(let pass=0;pass<2;pass++){
    const box=rectFromCenter(current.x,current.y,width,height);
    const hit=snap.faces.map(face=>({face,ratio:overlapRatio(box,face)})).sort((a,b)=>b.ratio-a.ratio)[0];
    if(!hit||hit.ratio<=threshold){after=hit?.ratio||0;break}
    if(pass===0)before=hit.ratio;
    const f=hit.face;
    const candidates=[
      {x:f.left-width/2-margin,y:current.y},
      {x:f.right+width/2+margin,y:current.y},
      {x:current.x,y:f.top-height/2-margin},
      {x:current.x,y:f.bottom+height/2+margin},
    ].map(p=>clampCenter(p,width,height));
    candidates.sort((a,b)=>scoreCandidate(a)-scoreCandidate(b));
    current=candidates[0]||current;adjusted=true;
  }
  if(adjusted)compositionStats.adjustments+=1;
  return{...current,adjusted,overlapBefore:before,overlapAfter:after};
}
function chooseOverlayPlacement(targetRect,{width=320,height=120,giant=false}={}){
  const target=targetRect||{left:innerWidth*.4,top:innerHeight*.45,width:innerWidth*.2,height:innerHeight*.1,right:innerWidth*.6,bottom:innerHeight*.55};
  const cx=target.left+target.width/2,cy=target.top+target.height/2;
  const dx=Math.max(width*.32,Math.min(innerWidth*.23,260));
  const dy=Math.max(height*.75,Math.min(innerHeight*.13,220));
  const candidates=[
    {x:cx,y:cy},
    {x:cx-dx,y:cy-dy},{x:cx+dx,y:cy-dy},
    {x:cx-dx,y:cy+dy},{x:cx+dx,y:cy+dy},
    {x:cx,y:cy-dy*1.25},{x:cx,y:cy+dy*1.25},
    {x:innerWidth*.5,y:innerHeight*.24},{x:innerWidth*.5,y:innerHeight*.76},
  ].map(p=>clampCenter(p,width,height));
  const snap=compositionSnapshot();
  const targetBox={left:target.left,top:target.top,width:target.width,height:target.height,right:target.right??target.left+target.width,bottom:target.bottom??target.top+target.height};
  const score=(p)=>{
    const box=rectFromCenter(p.x,p.y,width,height);
    let value=0;
    for(const face of snap.faces)value+=overlapRatio(box,face)*18000;
    for(const body of snap.bodies)value+=overlapRatio(box,body)*(giant?1600:900);
    value+=overlapRatio(box,targetBox)*(giant?1300:700);
    value+=Math.hypot(p.x-cx,p.y-cy)*.16;
    return value;
  };
  candidates.sort((a,b)=>score(a)-score(b));
  compositionStats.textPlacements+=1;
  return{...(candidates[0]||{x:cx,y:cy}),faces:snap.faces.length};
}
function rayHitsFace(start,angle,distance,radius,faces){
  const dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance;
  for(const t of [.18,.32,.48,.66,.82]){
    const x=start.x+dx*t,y=start.y+dy*t;
    for(const f of faces){
      if(x>=f.left-radius&&x<=f.right+radius&&y>=f.top-radius&&y<=f.bottom+radius)return true;
    }
  }
  return false;
}
function rerouteRay(start,angle,distance,{radius=28}={}){
  const snap=compositionSnapshot(),offsets=[0,18,-18,36,-36,54,-54].map(v=>v*Math.PI/180);
  let best=angle;
  for(const off of offsets){
    const candidate=angle+off;
    if(!rayHitsFace(start,candidate,distance,radius,snap.faces)){best=candidate;break}
  }
  if(Math.abs(best-angle)>.001)compositionStats.rayReroutes+=1;
  return best;
}


const CHOREO_DEFAULT_BUDGETS=Object.freeze({typography:1,foreground:1,impact:2,reaction:2,secondary:1,flash:1});
const choreographyStats={begins:0,phases:0,reactionWindows:0,budgetDrops:0,adaptiveTypography:0};
let choreography=null,lastChoreography=null;
function choreographySnapshot(state=choreography){
  if(!state)return null;
  return{
    scene:state.scene,
    phase:state.phase,
    attention:state.attention,
    phaseSeq:state.phaseSeq,
    budgets:{...state.budgets},
    counts:{...state.counts},
    dropped:{...state.dropped},
    history:state.history.map(x=>({...x})),
  };
}
function applyChoreographyState(){
  const root=document.documentElement;
  if(!choreography){
    delete root.dataset.boardChoreoScene;
    delete root.dataset.boardChoreoPhase;
    delete root.dataset.boardAttentionOwner;
    return;
  }
  root.dataset.boardChoreoScene=String(choreography.scene||'');
  root.dataset.boardChoreoPhase=String(choreography.phase||'');
  root.dataset.boardAttentionOwner=String(choreography.attention||'');
}
function beginChoreography(scene,{budgets={}}={}){
  if(choreography)endChoreography('replaced');
  choreography={
    scene:String(scene||'scene'),
    phase:'setup',
    attention:'TARGET',
    phaseSeq:0,
    budgets:{...CHOREO_DEFAULT_BUDGETS,...budgets},
    counts:{},
    dropped:{},
    history:[{phase:'setup',attention:'TARGET',at:performance.now()}],
  };
  choreographyStats.begins+=1;
  applyChoreographyState();
  return choreographySnapshot();
}
function setChoreographyPhase(phase,attention='TARGET',{budgets=null}={}){
  if(!choreography)beginChoreography('implicit');
  choreography.phase=String(phase||'beat');
  choreography.attention=String(attention||'TARGET').toUpperCase();
  choreography.phaseSeq+=1;
  choreography.counts={};
  if(budgets)choreography.budgets={...choreography.budgets,...budgets};
  choreography.history.push({phase:choreography.phase,attention:choreography.attention,at:performance.now()});
  choreography.history=choreography.history.slice(-24);
  choreographyStats.phases+=1;
  if(choreography.phase==='reaction'){
    choreographyStats.reactionWindows+=1;
  }
  applyChoreographyState();
  return choreographySnapshot();
}
function requestVisual(channel,{priority='secondary'}={}){
  if(!choreography)return true;
  const key=String(channel||'secondary');
  const next=(choreography.counts[key]||0)+1;
  const limit=Number(choreography.budgets[key]??choreography.budgets.secondary??1);
  if(priority==='essential'||next<=limit){
    choreography.counts[key]=next;
    return true;
  }
  choreography.dropped[key]=(choreography.dropped[key]||0)+1;
  choreographyStats.budgetDrops+=1;
  return false;
}
function endChoreography(reason='complete'){
  if(!choreography)return null;
  choreography.history.push({phase:'end',attention:choreography.attention,reason,at:performance.now()});
  lastChoreography=choreographySnapshot(choreography);
  choreography=null;
  applyChoreographyState();
  return lastChoreography;
}
function chooseTypographyPlacement(targetRect,{width=320,height=120,giant=false}={}){
  const target=targetRect||{left:innerWidth*.4,top:innerHeight*.45,width:innerWidth*.2,height:innerHeight*.1,right:innerWidth*.6,bottom:innerHeight*.55};
  const cx=target.left+target.width/2,cy=target.top+target.height/2;
  const snap=compositionSnapshot();
  const scales=giant?[1,.9,.8,.72]:[1,.92,.84];
  const targetBox={left:target.left,top:target.top,width:target.width,height:target.height,right:target.right??target.left+target.width,bottom:target.bottom??target.top+target.height};
  let best=null;
  for(const scale of scales){
    const w=width*scale,h=height*scale;
    const dx=Math.max(w*.32,Math.min(innerWidth*.23,260));
    const dy=Math.max(h*.75,Math.min(innerHeight*.13,220));
    const candidates=[
      {x:cx,y:cy},
      {x:cx-dx,y:cy-dy},{x:cx+dx,y:cy-dy},
      {x:cx-dx,y:cy+dy},{x:cx+dx,y:cy+dy},
      {x:cx,y:cy-dy*1.25},{x:cx,y:cy+dy*1.25},
      {x:innerWidth*.5,y:innerHeight*.22},{x:innerWidth*.5,y:innerHeight*.78},
    ].map(p=>clampCenter(p,w,h));
    for(const p of candidates){
      const box=rectFromCenter(p.x,p.y,w,h);
      let faceOverlap=0,bodyOverlap=0;
      for(const face of snap.faces)faceOverlap=Math.max(faceOverlap,overlapRatio(box,face));
      for(const body of snap.bodies)bodyOverlap=Math.max(bodyOverlap,overlapRatio(box,body));
      const targetOverlap=overlapRatio(box,targetBox);
      const score=faceOverlap*26000+bodyOverlap*(giant?1800:1000)+targetOverlap*(giant?1600:800)+Math.hypot(p.x-cx,p.y-cy)*.12+(1-scale)*1900;
      if(!best||score<best.score)best={...p,scale,score,faceOverlap,bodyOverlap,targetOverlap};
    }
  }
  choreographyStats.adaptiveTypography+=1;
  compositionStats.textPlacements+=1;
  return best||{x:cx,y:cy,scale:1,score:0,faceOverlap:0,bodyOverlap:0,targetOverlap:0};
}

function createScope(label='effect',timeScale=1){
  const controller=new AbortController();
  const scopeScale=Math.max(.25,Math.min(3,Number(timeScale)||1));
  const nodes=new Set(),animations=new Set(),timers=new Set();
  let cleaned=false;
  const scope={
    label,signal:controller.signal,
    add(node,which='back'){if(!node)return node;if(cleaned||controller.signal.aborted){try{node.remove()}catch{}return null}getLayer(which).appendChild(node);nodes.add(node);return node},
    animate(el,keyframes,options={}){
      if(!el?.animate||controller.signal.aborted)return Promise.resolve();
      const opts={...options};
      if(Number.isFinite(Number(opts.duration)))opts.duration=ms(opts.duration*scopeScale);
      if(Number.isFinite(Number(opts.delay)))opts.delay=ms(opts.delay*scopeScale);
      if(Number.isFinite(Number(opts.endDelay)))opts.endDelay=ms(opts.endDelay*scopeScale);
      const animation=el.animate(keyframes,opts);animations.add(animation);
      return animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));
    },
    wait(baseMs){
      if(controller.signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{timers.delete(timer);controller.signal.removeEventListener('abort',onAbort);resolve()},ms(baseMs*scopeScale));
        timers.add(timer);
        const onAbort=()=>{clearTimeout(timer);timers.delete(timer);controller.signal.removeEventListener('abort',onAbort);reject(new DOMException('Aborted','AbortError'))};
        controller.signal.addEventListener('abort',onAbort,{once:true});
      });
    },
    later(baseMs,fn){
      if(controller.signal.aborted)return null;
      const timer=setTimeout(()=>{timers.delete(timer);if(!controller.signal.aborted)fn?.()},ms(baseMs*scopeScale));timers.add(timer);return timer;
    },
    raf(baseDuration,draw){return runFrameTask(scope,baseDuration*scopeScale,draw)},
    canvas(baseDuration,draw){return runCanvas(scope,baseDuration*scopeScale,draw)},
    abort(reason='aborted'){if(!controller.signal.aborted)controller.abort(reason);scope.cleanup()},
    cleanup(){
      if(cleaned)return;cleaned=true;
      for(const animation of animations)releaseAnimation(animation);animations.clear();
      for(const timer of timers)clearTimeout(timer);timers.clear();
      for(const task of [...frameTasks])if(task.scope===scope){frameTasks.delete(task);task.resolve?.()}
      for(const job of [...canvasJobs])if(job.scope===scope){canvasJobs.delete(job);job.resolve?.()}
      for(const node of nodes){try{node.remove()}catch{}}nodes.clear();
      scopes.delete(scope);
    },
    stats(){return{label,nodes:nodes.size,animations:animations.size,timers:timers.size,aborted:controller.signal.aborted}},
  };
  scopes.add(scope);return scope;
}
function abortAll(reason='abort-all'){for(const scope of [...scopes])scope.abort(reason)}
function resetPerformanceBaseline(){baselineDomCount=document.getElementsByTagName('*').length;peakDomCount=baselineDomCount;maxFrameTasks=0;maxCanvasJobs=0;qualityChanges=0;longTasks=0;frameSamples=[];frameEma=16.7;fpsEma=60;compositionStats.snapshots=0;compositionStats.adjustments=0;compositionStats.textPlacements=0;compositionStats.rayReroutes=0;choreographyStats.begins=0;choreographyStats.phases=0;choreographyStats.reactionWindows=0;choreographyStats.budgetDrops=0;choreographyStats.adaptiveTypography=0}
function diagnostics(){
  return{
    slowdown,defaultSlowdown:DEFAULT_SLOWDOWN,reduced,
    qualityMode,effectiveQuality:effectiveQualityName(),qualityProfile:{...quality()},
    frameMs:Math.round(frameEma*10)/10,fps:Math.round(fpsEma*10)/10,longTasks,
    activeScopes:scopes.size,frameTasks:frameTasks.size,canvasJobs:canvasJobs.size,rafLoopCount:rafId?1:0,
    sharedCanvasCount:sharedCanvas?1:0,
    baselineDomCount,domCount:document.getElementsByTagName('*').length,peakDomCount,domDeltaPeak:peakDomCount-baselineDomCount,
    maxFrameTasks,maxCanvasJobs,qualityChanges,
    activeTimers:[...scopes].reduce((n,x)=>n+(x.stats?.().timers||0),0),
    jsHeapUsed:performance.memory?.usedJSHeapSize||null,
    scopes:[...scopes].map(x=>x.stats()),composition:{...compositionStats},choreography:{active:choreographySnapshot(),last:lastChoreography?{...lastChoreography,history:lastChoreography.history.map(x=>({...x}))}:null,stats:{...choreographyStats}},
  };
}

try{
  if('PerformanceObserver'in window){
    const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.duration>=50)longTasks+=1});
    observer.observe({entryTypes:['longtask']});
  }
}catch{}
reducedQuery?.addEventListener?.('change',e=>{reduced=Boolean(e.matches);applyEnvironment()});
addEventListener('resize',resizeSharedCanvas,{passive:true});
document.addEventListener('visibilitychange',()=>{monitoring=!document.hidden;if(monitoring){lastFrameAt=0;scheduleLoop()}});
applyEnvironment();scheduleLoop();

window.ASOBOON_BOARD_EFFECTS=Object.freeze({
  version:'2.5.0',DEFAULT_SLOWDOWN,LOW_SPEC_FALLBACK,QUALITY_MODES,
  ms,setSlowdown,getSlowdown:()=>slowdown,
  setQuality,getQuality:()=>qualityMode,getEffectiveQuality:()=>effectiveQualityName(),quality,
  isReduced:()=>reduced,getLayer,createScope,abortAll,releaseAnimation,
  characterAnchorPoint,safeRectForCharacter,safeRectsForCharacter,compositionSnapshot,resolveEffectPoint,chooseOverlayPlacement,chooseTypographyPlacement,rerouteRay,overlapRatio,
  beginChoreography,setChoreographyPhase,requestVisual,endChoreography,getChoreography:()=>choreographySnapshot(),
  sharedCanvas:ensureSharedCanvas,runCanvas,runFrameTask,resetPerformanceBaseline,diagnostics,
});
})();
