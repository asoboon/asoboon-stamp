(()=>{'use strict';

const DEFAULT_SLOWDOWN=2.5;
const STORAGE_KEY='asoboon_board_global_slowdown_v1';
const reducedQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');
let reduced=Boolean(reducedQuery?.matches);
let slowdown=readSlowdown();
const scopes=new Set();

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function readSlowdown(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw===null)return DEFAULT_SLOWDOWN;
    const value=Number(raw);
    return Number.isFinite(value)&&value>0?clamp(value,.02,5):DEFAULT_SLOWDOWN;
  }catch{return DEFAULT_SLOWDOWN}
}
function persist(){
  try{localStorage.setItem(STORAGE_KEY,String(slowdown))}catch{}
}
function ms(base){
  const n=Math.max(0,Number(base)||0);
  return Math.max(1,n*slowdown);
}
function setSlowdown(value,{persistValue=true}={}){
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0)return slowdown;
  slowdown=clamp(n,.02,5);
  if(persistValue)persist();
  applyCssTiming();
  return slowdown;
}
function applyCssTiming(){
  const root=document.documentElement;
  root.style.setProperty('--board-motion-scale',String(slowdown));
  root.style.setProperty('--board-transition-fast',ms(90)+'ms');
  root.style.setProperty('--board-transition-normal',ms(180)+'ms');
  root.style.setProperty('--board-transition-slow',ms(300)+'ms');
}
reducedQuery?.addEventListener?.('change',e=>{reduced=Boolean(e.matches)});

function getLayer(which='back'){
  const id=which==='front'?'boardFxFrontLayer':'boardFxBackLayer';
  let layer=document.getElementById(id);
  if(layer)return layer;
  layer=document.createElement('div');
  layer.id=id;
  layer.className=which==='front'?'board-fx-front-layer':'board-fx-back-layer';
  layer.setAttribute('aria-hidden','true');
  (document.querySelector('.board')||document.body).appendChild(layer);
  return layer;
}

function createScope(label='effect'){
  const controller=new AbortController();
  const nodes=new Set();
  const animations=new Set();
  const timers=new Set();
  const rafs=new Set();
  let cleaned=false;

  const scope={
    label,
    signal:controller.signal,
    add(node,which='back'){
      if(!node)return node;
      getLayer(which).appendChild(node);
      nodes.add(node);
      return node;
    },
    animate(el,keyframes,options={}){
      if(!el?.animate||controller.signal.aborted)return Promise.resolve();
      const opts={...options};
      if(Number.isFinite(Number(opts.duration)))opts.duration=ms(opts.duration);
      if(Number.isFinite(Number(opts.delay)))opts.delay=ms(opts.delay);
      if(Number.isFinite(Number(opts.endDelay)))opts.endDelay=ms(opts.endDelay);
      const animation=el.animate(keyframes,opts);
      animations.add(animation);
      return animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));
    },
    wait(baseMs){
      if(controller.signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{
          timers.delete(timer);
          controller.signal.removeEventListener('abort',onAbort);
          resolve();
        },ms(baseMs));
        timers.add(timer);
        const onAbort=()=>{
          clearTimeout(timer);
          timers.delete(timer);
          controller.signal.removeEventListener('abort',onAbort);
          reject(new DOMException('Aborted','AbortError'));
        };
        controller.signal.addEventListener('abort',onAbort,{once:true});
      });
    },
    later(baseMs,fn){
      if(controller.signal.aborted)return null;
      const timer=setTimeout(()=>{
        timers.delete(timer);
        if(!controller.signal.aborted)fn?.();
      },ms(baseMs));
      timers.add(timer);
      return timer;
    },
    raf(baseDuration,draw){
      if(controller.signal.aborted)return Promise.reject(new DOMException('Aborted','AbortError'));
      const duration=ms(baseDuration);
      const started=performance.now();
      return new Promise(resolve=>{
        const tick=now=>{
          if(controller.signal.aborted){resolve();return}
          const p=clamp((now-started)/duration,0,1);
          try{draw?.(p,(now-started)/1000,duration)}catch{}
          if(p<1){
            const id=requestAnimationFrame(tick);
            rafs.add(id);
          }else resolve();
        };
        const id=requestAnimationFrame(tick);
        rafs.add(id);
      });
    },
    abort(reason='aborted'){
      if(!controller.signal.aborted)controller.abort(reason);
      scope.cleanup();
    },
    cleanup(){
      if(cleaned)return;
      cleaned=true;
      for(const animation of animations){try{animation.cancel()}catch{}}
      animations.clear();
      for(const timer of timers)clearTimeout(timer);
      timers.clear();
      for(const id of rafs)cancelAnimationFrame(id);
      rafs.clear();
      for(const node of nodes){try{node.remove()}catch{}}
      nodes.clear();
      scopes.delete(scope);
    },
    stats(){
      return{label,nodes:nodes.size,animations:animations.size,timers:timers.size,rafs:rafs.size,aborted:controller.signal.aborted};
    },
  };
  scopes.add(scope);
  return scope;
}

function abortAll(reason='abort-all'){
  for(const scope of [...scopes])scope.abort(reason);
}
function diagnostics(){
  return{
    slowdown,
    defaultSlowdown:DEFAULT_SLOWDOWN,
    reduced,
    activeScopes:scopes.size,
    scopes:[...scopes].map(x=>x.stats()),
  };
}

applyCssTiming();

window.ASOBOON_BOARD_EFFECTS=Object.freeze({
  version:'1.0.0',
  DEFAULT_SLOWDOWN,
  ms,
  setSlowdown,
  getSlowdown:()=>slowdown,
  isReduced:()=>reduced,
  getLayer,
  createScope,
  abortAll,
  diagnostics,
});
})();