(() => {
'use strict';
const PARTS=[{id:'engine',name:'エンジン',no:'01'},{id:'wheel',name:'タイヤ',no:'02'},{id:'headlight',name:'ライト',no:'03'},{id:'fin',name:'フィン',no:'04'},{id:'grille',name:'グリル',no:'05'},{id:'key',name:'キー',no:'06'}];
const IDS=new Set(PARTS.map(function(x){return x.id;}));
const RESET_HOUR_JST=19;
const STORAGE_PREFIX='asoquest:v9:';
let activeCycle=resetCycleKey();
let resetTimer=null;
let state={acquired:[],complete:false};
const $=function(id){return document.getElementById(id);};

document.addEventListener('DOMContentLoaded',function(){
  cleanupOldProgress();
  load();
  hydrateAcquiredAssets();
  const route=readRoute();
  if(route.part) collect(route.part);
  if(route.engine) engineCheck();
  render();
  document.body.classList.add('assets-ready');
  scheduleNextReset();
  window.setInterval(checkResetBoundary,60000);
});
$('ignitionClose').addEventListener('click',closeIgnitionSequence);
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
  try{
    localStorage.setItem(storageKey(),JSON.stringify({
      acquired:state.acquired,
      complete:state.complete,
      cycle:activeCycle,
      resetHourJst:RESET_HOUR_JST,
      updatedAt:new Date().toISOString()
    }));
  }catch(e){}
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
function millisecondsUntilNextReset(now){
  const nowMs=(now||new Date()).getTime();
  const jst=new Date(nowMs+9*60*60*1000);
  const y=jst.getUTCFullYear(),m=jst.getUTCMonth(),d=jst.getUTCDate();
  let target=Date.UTC(y,m,d,RESET_HOUR_JST-9,0,0,0);
  if(target<=nowMs) target+=24*60*60*1000;
  return Math.max(0,target-nowMs);
}
function scheduleNextReset(){
  if(resetTimer) window.clearTimeout(resetTimer);
  resetTimer=window.setTimeout(function(){
    checkResetBoundary();
    scheduleNextReset();
  },millisecondsUntilNextReset()+100);
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
function collect(id){
  const found=PARTS.find(function(x){return x.id===id;});
  if(!found)return;
  const fresh=!state.acquired.includes(id);
  ensurePartAssets(id);
  if(fresh){
    state.acquired.push(id);
    save();
    fxFor(id);
    pulse();
    if(state.acquired.length===6) ensureCompleteAsset();
  }
  show(fresh?'パーツゲット！':'ゲット済み！',found.name,fresh?(state.acquired.length===6?'パーツが全部そろった！':'マシンにパーツが追加された！'):'このパーツはもう集めてあるよ！');
}
function engineCheck(){
  const missing=6-state.acquired.length;
  if(missing>0){
    show('ENGINE START','まだ足りない！','あと'+missing+'こ集めよう！');
    try{if(navigator.vibrate)navigator.vibrate([45,45,45]);}catch(e){}
    return;
  }
  state.complete=true;
  save();
  ensureCompleteAsset();
  render();
  runIgnitionSequence();
}
function runIgnitionSequence(){
  const seq=$('ignitionSequence');
  if(!seq){
    document.body.classList.add('machine-flash');
    if($('completeFx'))$('completeFx').classList.add('on','celebrate');
    pulse();
    show('MISSION COMPLETE','アソクエ クリア！','マシン完成！ ミッションクリア！','clear');
    return;
  }
  seq.classList.remove('show','phase-2','phase-1','phase-ignite','phase-run','phase-final');
  $('ignitionCount').textContent='3';
  $('ignitionTitle').textContent='IGNITION';
  $('ignitionSub').textContent='マシンを起動しています';
  buildIgnitionParticles();
  document.body.classList.add('ignition-active');
  void seq.offsetWidth;
  seq.classList.add('show');
  try{if(navigator.vibrate)navigator.vibrate([40,80,40]);}catch(e){}

  setTimeout(function(){
    if(!seq.classList.contains('show'))return;
    seq.classList.add('phase-2');
    $('ignitionCount').textContent='2';
  },650);
  setTimeout(function(){
    if(!seq.classList.contains('show'))return;
    seq.classList.add('phase-1');
    $('ignitionCount').textContent='1';
    try{if(navigator.vibrate)navigator.vibrate([55,70,55]);}catch(e){}
  },1250);
  setTimeout(function(){
    if(!seq.classList.contains('show'))return;
    seq.classList.add('phase-ignite');
    $('ignitionCount').textContent='';
    $('ignitionTitle').textContent='ENGINE START';
    $('ignitionSub').textContent='IGNITION!';
    document.body.classList.add('machine-flash','machine-running');
    if($('completeFx'))$('completeFx').classList.add('on','celebrate');
    pulse();
    try{if(navigator.vibrate)navigator.vibrate([85,35,120,35,180,45,220]);}catch(e){}
  },1900);
  setTimeout(function(){
    if(!seq.classList.contains('show'))return;
    seq.classList.add('phase-run');
    $('ignitionTitle').textContent='FULL POWER';
    $('ignitionSub').textContent='マシン完成！';
  },2750);
  setTimeout(function(){
    if(!seq.classList.contains('show'))return;
    seq.classList.add('phase-final');
  },3850);
}
function buildIgnitionParticles(){
  const root=$('ignitionParticles');
  if(!root)return;
  root.innerHTML='';
  for(let i=0;i<26;i++){
    const p=document.createElement('i');
    p.style.setProperty('--x',String((i*37)%101)+'%');
    p.style.setProperty('--d',String(0.55+(i%7)*0.08)+'s');
    p.style.setProperty('--delay',String((i%9)*0.035)+'s');
    p.style.setProperty('--size',String(2+(i%4))+'px');
    root.appendChild(p);
  }
}
function closeIgnitionSequence(){
  const seq=$('ignitionSequence');
  if(seq)seq.classList.remove('show','phase-2','phase-1','phase-ignite','phase-run','phase-final');
  document.body.classList.remove('ignition-active','machine-running');
  document.body.classList.add('machine-flash');
  if($('completeFx'))$('completeFx').classList.add('on','celebrate');
  cleanUrl();
}
function render(){
  const n=state.acquired.length;
  $('countTop').textContent=n;$('partsCount').textContent=n+' / 6';
  document.querySelectorAll('#segments i').forEach(function(e,i){e.classList.toggle('on',i<n);});
  document.querySelectorAll('[data-part-layer]').forEach(function(e){
    const on=state.acquired.includes(e.dataset.partLayer);
    if(on) ensureImage(e);
    e.classList.toggle('on',on);
  });
  $('partsGrid').innerHTML=PARTS.map(function(p){const on=state.acquired.includes(p.id);return '<div class="part-card '+(on?'on':'')+'">'+(on?'<i class="check">✓</i>':'')+'<strong>'+p.name+'</strong><small>'+(on?'GET':'???')+' · '+p.no+'</small></div>';}).join('');
  const ready=n===6;$('engineCard').classList.toggle('ready',ready);
  $('engineTitle').textContent=state.complete?'COMPLETE':ready?'UNLOCKED':'LOCKED';
  $('engineHint').textContent=state.complete?'エンジン始動成功！':ready?'ENGINE STARTへ行こう！':'あと'+(6-n)+'こ集めると起動できます';
  $('engineLock').textContent=state.complete?'🏁':ready?'⚡':'🔒';
  $('machineState').textContent=state.complete?'MISSION COMPLETE':ready?'起動準備OK！':n?'組み立て中':'マシン未完成';
  $('headline').textContent=state.complete?'アソクエ クリア！':ready?'パーツが全部そろった！':n?'あと'+(6-n)+'こ！':'6つのパーツを集めて、マシンを完成させよう！';
  $('subline').textContent=state.complete?'マシン完成！ ミッションクリア！':ready?'最後の「ENGINE START」へ！':'館内のスポットを探して、スマホでチェック！';
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
function ensureImage(img){
  if(!img||img.getAttribute('src')) return;
  const src=img.dataset.src;
  if(src) img.setAttribute('src',src);
}
function ensurePartAssets(id){
  document.querySelectorAll('[data-part-layer="'+id+'"]').forEach(ensureImage);
}
function ensureCompleteAsset(){
  ensureImage($('completeFx'));
}
function hydrateAcquiredAssets(){
  state.acquired.forEach(ensurePartAssets);
  if(state.acquired.length===6||state.complete) ensureCompleteAsset();
}
})();