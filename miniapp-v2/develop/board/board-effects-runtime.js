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
  const id=which==='front'?'boardFxFrontLayer':'boardFxBackLayer';
  let layer=document.getElementById(id);
  if(layer)return layer;
  layer=document.createElement('div');layer.id=id;
  layer.className=which==='front'?'board-fx-front-layer':'board-fx-back-layer';
  layer.setAttribute('aria-hidden','true');
  (document.querySelector('.board')||document.body).appendChild(layer);
  return layer;
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
      for(const animation of animations){try{animation.cancel()}catch{}}animations.clear();
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
function resetPerformanceBaseline(){baselineDomCount=document.getElementsByTagName('*').length;peakDomCount=baselineDomCount;maxFrameTasks=0;maxCanvasJobs=0;qualityChanges=0;longTasks=0;frameSamples=[];frameEma=16.7;fpsEma=60}
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
    scopes:[...scopes].map(x=>x.stats()),
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
  version:'2.2.0',DEFAULT_SLOWDOWN,LOW_SPEC_FALLBACK,QUALITY_MODES,
  ms,setSlowdown,getSlowdown:()=>slowdown,
  setQuality,getQuality:()=>qualityMode,getEffectiveQuality:()=>effectiveQualityName(),quality,
  isReduced:()=>reduced,getLayer,createScope,abortAll,
  sharedCanvas:ensureSharedCanvas,runCanvas,runFrameTask,resetPerformanceBaseline,diagnostics,
});
})();
