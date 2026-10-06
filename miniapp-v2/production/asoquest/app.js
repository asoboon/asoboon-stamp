(() => {
'use strict';
const PARTS=[{id:'engine',name:'エンジン',no:'01'},{id:'wheel',name:'タイヤ',no:'02'},{id:'headlight',name:'ライト',no:'03'},{id:'fin',name:'フィン',no:'04'},{id:'grille',name:'グリル',no:'05'},{id:'key',name:'キー',no:'06'}];
const IDS=new Set(PARTS.map(function(x){return x.id;}));
const RESET_HOUR_JST=19;
const STORAGE_PREFIX='asoquest:v9:';
let activeCycle=resetCycleKey();
let state={acquired:[],complete:false};
const $=function(id){return document.getElementById(id);};

document.addEventListener('DOMContentLoaded',async function(){
  await detectAssets();
  cleanupOldProgress();
  load();
  const route=readRoute();
  if(route.part) collect(route.part);
  if(route.engine) engineCheck();
  render();
  window.setInterval(checkResetBoundary,15000);
});
$('overlayClose').addEventListener('click',function(){
  $('overlay').classList.remove('show','clear-mode');
  if($('completeFx'))$('completeFx').classList.remove('celebrate');
  document.body.classList.remove('machine-flash');
  cleanUrl();
});

function resetCycleKey(now){
  const d=now||new Date();
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Tokyo',
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    hour12:false
  }).formatToParts(d);
  const get=function(type){return parts.find(function(p){return p.type===type;})?.value||'';};
  const y=Number(get('year')),m=Number(get('month')),day=Number(get('day'));
  let hour=Number(get('hour'));
  if(hour===24) hour=0;
  if(hour>=RESET_HOUR_JST){
    return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  }
  const prev=new Date(Date.UTC(y,m-1,day)-86400000);
  return String(prev.getUTCFullYear()).padStart(4,'0')+'-'+String(prev.getUTCMonth()+1).padStart(2,'0')+'-'+String(prev.getUTCDate()).padStart(2,'0');
}
function storageKey(){return STORAGE_PREFIX+activeCycle;}
function load(){
  activeCycle=resetCycleKey();
  try{
    const s=JSON.parse(localStorage.getItem(storageKey())||'{}');
    state.acquired=Array.isArray(s.acquired)?Array.from(new Set(s.acquired.filter(function(x){return IDS.has(x);}))) : [];
    state.complete=!!s.complete;
  }catch(e){
    state={acquired:[],complete:false};
  }
}
function save(){
  const cycle=resetCycleKey();
  if(cycle!==activeCycle){
    activeCycle=cycle;
    state={acquired:[],complete:false};
  }
  localStorage.setItem(storageKey(),JSON.stringify({
    acquired:state.acquired,
    complete:state.complete,
    cycle:activeCycle,
    resetHourJst:RESET_HOUR_JST,
    updatedAt:new Date().toISOString()
  }));
}
function cleanupOldProgress(){
  try{
    const current=STORAGE_PREFIX+resetCycleKey();
    for(let i=localStorage.length-1;i>=0;i--){
      const k=localStorage.key(i);
      if(!k) continue;
      if((k.startsWith('asoquest:v8:')||k.startsWith(STORAGE_PREFIX))&&k!==current){
        localStorage.removeItem(k);
      }
    }
  }catch(e){}
}
function checkResetBoundary(){
  const cycle=resetCycleKey();
  if(cycle===activeCycle) return;
  activeCycle=cycle;
  state={acquired:[],complete:false};
  cleanupOldProgress();
  cleanUrl();
  render();
}
function readRoute(){const p=new URLSearchParams(location.search);let part=(p.get('part')||'').toLowerCase();if(part==='light')part='headlight';return{part:IDS.has(part)?part:'',engine:(p.get('station')||'').toLowerCase()==='engine'};}
function cleanUrl(){const u=new URL(location.href);['part','station','src','source'].forEach(function(k){u.searchParams.delete(k);});history.replaceState(null,'',u);}
function collect(id){const found=PARTS.find(function(x){return x.id===id;});if(!found)return;const fresh=!state.acquired.includes(id);if(fresh){state.acquired.push(id);save();fxFor(id);pulse();}show(fresh?'PART GET!':'ALREADY FOUND',found.name,fresh?(state.acquired.length===6?'これで6つそろった！':'マシンにパーツがついた！'):'このパーツはもう見つけているよ！');}
function engineCheck(){
  const missing=6-state.acquired.length;
  if(missing>0){
    show('ENGINE START','まだ足りない！','あと'+missing+'こ あつめよう！');
    try{if(navigator.vibrate)navigator.vibrate([45,45,45]);}catch(e){}
    return;
  }
  state.complete=true;
  save();
  document.body.classList.add('machine-flash');
  if($('completeFx'))$('completeFx').classList.add('on','celebrate');
  pulse();
  try{if(navigator.vibrate)navigator.vibrate([60,35,90,35,160]);}catch(e){}
  show('ENGINE START','IGNITION!','エンジン始動！','clear');
  setTimeout(function(){
    if(!$('overlay').classList.contains('show'))return;
    $('overlayKicker').textContent='MISSION COMPLETE';
    $('overlayTitle').textContent='ASOQUEST CLEAR!';
    $('overlayText').textContent='6つのパーツを集めて、マシンが完成した！';
  },850);
}
function render(){
  const n=state.acquired.length;
  $('countTop').textContent=n;$('partsCount').textContent=n+' / 6';
  document.querySelectorAll('#segments i').forEach(function(e,i){e.classList.toggle('on',i<n);});
  document.querySelectorAll('[data-part-layer]').forEach(function(e){e.classList.toggle('on',state.acquired.includes(e.dataset.partLayer));});
  $('partsGrid').innerHTML=PARTS.map(function(p){const on=state.acquired.includes(p.id);return '<div class="part-card '+(on?'on':'')+'">'+(on?'<i class="check">✓</i>':'')+'<strong>'+p.name+'</strong><small>'+(on?'FOUND':'NOT FOUND')+' · '+p.no+'</small></div>';}).join('');
  const ready=n===6;$('engineCard').classList.toggle('ready',ready);
  $('engineTitle').textContent=state.complete?'COMPLETE':ready?'UNLOCKED':'LOCKED';
  $('engineHint').textContent=state.complete?'エンジン始動成功！':ready?'ENGINE STARTへ行こう！':'あと'+(6-n)+'こ集めると起動できます';
  $('engineLock').textContent=state.complete?'🏁':ready?'⚡':'🔒';
  $('machineState').textContent=state.complete?'MISSION COMPLETE':ready?'MACHINE READY':n?'ASSEMBLY '+n+' / 6':'MACHINE OFFLINE';
  $('headline').textContent=state.complete?'アソクエ クリア！':ready?'6つのパーツがそろった！':n?'あと'+(6-n)+'こで完成！':'6つのパーツを見つけよう！';
  $('subline').textContent=state.complete?'きょうのミッション完了！':ready?'ENGINE STARTを探して、マシンを起動しよう。':'館内を探して、スマホをタッチ。';
  if($('completeFx'))$('completeFx').classList.toggle('on',ready);
}
function fxFor(id){const el=id==='engine'?$('engineFx'):id==='key'?$('keyFx'):null;if(!el)return;el.classList.remove('fire');requestAnimationFrame(function(){el.classList.add('fire');});}
function pulse(){const p=$('carPulse');p.classList.remove('fire');requestAnimationFrame(function(){p.classList.add('fire');});try{if(navigator.vibrate)navigator.vibrate([35,25,70,30,100]);}catch(e){}}
function show(k,t,msg,mode){
  $('overlayKicker').textContent=k;
  $('overlayTitle').textContent=t;
  $('overlayText').textContent=msg;
  $('overlay').classList.toggle('clear-mode',mode==='clear');
  $('overlay').classList.add('show');
}
async function detectAssets(){const urls=Array.from(document.querySelectorAll('img[data-critical]')).map(function(i){return i.getAttribute('src');});const results=await Promise.all(urls.map(function(src){return new Promise(function(resolve){const i=new Image();i.onload=function(){resolve(true);};i.onerror=function(){resolve(false);};i.src=src+(src.includes('?')?'&probe=1':'?probe=1');});}));if(results.every(Boolean))document.body.classList.add('assets-ready');}
})();