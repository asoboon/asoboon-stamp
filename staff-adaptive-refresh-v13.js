(()=>{
'use strict';
const C=window.ASOBOON_RECEPTION_CONFIG||{};
const FAST=Math.max(5000,Number(C.staffFastRefreshMs||10000));
const NORMAL=Math.max(FAST,Number(C.staffNormalRefreshMs||30000));
const LEGACY=Math.max(1000,Number(C.staffRefreshMs||10000));
const FALLBACK=Array.isArray(C.staffFastWindows)&&C.staffFastWindows.length
  ? C.staffFastWindows
  : [{start:'10:00',end:'10:45'},{start:'12:30',end:'13:00'},{start:'13:30',end:'14:00'},{start:'15:00',end:'15:30'}];
const FIRST_MIN=Math.max(1,Number(C.staffFastFirstSlotMinutes||45));
const OTHER_MIN=Math.max(1,Number(C.staffFastOtherSlotMinutes||30));

const nativeSetInterval=window.setInterval.bind(window);
const nativeClearInterval=window.clearInterval.bind(window);
const nativeSetTimeout=window.setTimeout.bind(window);
const nativeClearTimeout=window.clearTimeout.bind(window);
let intercepted=false;
let lastMode='';

const pad=n=>String(n).padStart(2,'0');
function toMinutes(v){
  const m=String(v||'').normalize('NFKC').match(/^(\d{1,2}):(\d{2})$/);
  if(!m)return null;
  const h=Number(m[1]),mm=Number(m[2]);
  return h>=0&&h<24&&mm>=0&&mm<60?h*60+mm:null;
}
function fromMinutes(v){
  const n=Math.max(0,Math.min(1439,Math.round(v)));
  return `${pad(Math.floor(n/60))}:${pad(n%60)}`;
}
function extractStarts(){
  const out=new Set();
  const nodes=[...document.querySelectorAll('.scheduleline,.slotname')];
  for(const el of nodes){
    const text=String(el.textContent||'').normalize('NFKC');
    for(const m of text.matchAll(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?:\D|$)/g)){
      out.add(`${pad(Number(m[1]))}:${m[2]}`);
    }
  }
  return [...out].sort((a,b)=>toMinutes(a)-toMinutes(b));
}
function dynamicWindows(){
  const starts=extractStarts();
  if(!starts.length) return FALLBACK.map(x=>({start:String(x.start),end:String(x.end),source:'fallback'}));
  return starts.map((start,index)=>{
    const s=toMinutes(start);
    const duration=index===0?FIRST_MIN:OTHER_MIN;
    return {start,end:fromMinutes(s+duration),source:'slot'};
  });
}
function currentMinute(date=new Date()){
  return date.getHours()*60+date.getMinutes()+date.getSeconds()/60;
}
function currentWindow(date=new Date()){
  const now=currentMinute(date);
  return dynamicWindows().find(w=>{
    const s=toMinutes(w.start),e=toMinutes(w.end);
    return s!==null&&e!==null&&now>=s&&now<e;
  })||null;
}
function getRefreshMs(date=new Date()){
  return currentWindow(date)?FAST:NORMAL;
}
function nextBoundaryMs(date=new Date()){
  const now=currentMinute(date);
  let best=Infinity;
  for(const w of dynamicWindows()){
    for(const t of [toMinutes(w.start),toMinutes(w.end)]){
      if(t!==null&&t>now) best=Math.min(best,(t-now)*60000);
    }
  }
  return best;
}
function nextDelay(date=new Date()){
  const base=getRefreshMs(date);
  const boundary=nextBoundaryMs(date);
  return Number.isFinite(boundary)?Math.max(1000,Math.min(base,boundary+80)):base;
}
function ensureBadge(){
  let el=document.getElementById('adaptiveRefreshStatus');
  if(el)return el;
  const scheduler=document.querySelector('.scheduler');
  if(!scheduler)return null;
  el=document.createElement('div');
  el.id='adaptiveRefreshStatus';
  el.style.cssText='margin-top:9px;padding:8px 10px;border-radius:10px;background:#0b2731;border:1px solid #36515d;color:#bfe4f1;font-size:.66rem;font-weight:900;line-height:1.5';
  scheduler.appendChild(el);
  return el;
}
function updateBadge(){
  const el=ensureBadge();if(!el)return;
  const win=currentWindow();
  const mode=win?'fast':'normal';
  const next=win?`${win.start}〜${win.end}`:'通常時間帯';
  el.textContent=win?`⚡ 監視 10秒｜集中呼出 ${next}`:`◷ 監視 30秒｜${next}`;
  if(mode!==lastMode){
    lastMode=mode;
    const log=document.getElementById('log');
    if(log)log.textContent=`[${new Date().toLocaleTimeString('ja-JP')}] 監視周期を${win?'10秒（集中）':'30秒（通常）'}へ切替\n`+log.textContent;
  }
}

window.setInterval=function(callback,delay,...args){
  const ms=Number(delay);
  const source=typeof callback==='function'?String(callback):'';
  const looksLikeCore=!intercepted&&ms===LEGACY&&source.includes('refresh(false)');
  if(!looksLikeCore) return nativeSetInterval(callback,delay,...args);

  intercepted=true;
  const token={__asoboonAdaptive:true,id:null,cancelled:false};
  const run=async()=>{
    if(token.cancelled)return;
    try{await callback(...args)}catch(error){console.error('adaptive refresh failed',error)}
    if(token.cancelled)return;
    updateBadge();
    token.id=nativeSetTimeout(run,nextDelay());
  };
  token.id=nativeSetTimeout(run,nextDelay());
  updateBadge();
  console.info('ASOBooN adaptive refresh enabled', {fast:FAST,normal:NORMAL});
  return token;
};
window.clearInterval=function(id){
  if(id&&id.__asoboonAdaptive){id.cancelled=true;if(id.id!==null)nativeClearTimeout(id.id);return}
  return nativeClearInterval(id);
};

nativeSetInterval(updateBadge,1000);
window.ASOBOON_AUTO_RUNTIME=Object.freeze({
  version:'13.0-adaptive',fastMs:FAST,normalMs:NORMAL,
  getRefreshMs,getWindows:dynamicWindows,getCurrentWindow:currentWindow
});
})();
