[Reading 350 lines from start (total: 350 lines, 0 remaining)]

(() => {
'use strict';
const PARTS=[{id:'engine',name:'エンジン',no:'01'},{id:'wheel',name:'タイヤ',no:'02'},{id:'headlight',name:'ライト',no:'03'},{id:'fin',name:'フィン',no:'04'},{id:'grille',name:'グリル',no:'05'},{id:'key',name:'キー',no:'06'}];
const IDS=new Set(PARTS.map(function(x){return x.id;}));
const RESET_HOUR_JST=19;
const STORAGE_PREFIX='asoquest:v9:';
let activeCycle=resetCycleKey();
let resetTimer=null;
let ignitionRunning=false;
let ignitionTimers=[];
const IGNITION_PHASES=['phase-2','phase-1','phase-ignite','phase-run','phase-blackout','phase-reveal','phase-final'];
/* ms from sequence start. Finale rhythm: FULL POWER -> short FLASH -> BLACKOUT -> SILHOUETTE/LIGHT REVEAL -> HERO -> COPY */
const IGNITION_TIMELINE={
  normal:{p2:260,p1:1280,ignite:2280,run:3180,flash:3920,blackout:4080,reveal:4730,final:6580},
  reduced:{p2:200,p1:700,ignite:1200,run:1700,flash:0,blackout:2300,reveal:2650,final:3500}
};
function ignitionTimeline(){
  let reduced=false;
  try{reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(e){}
  return reduced?IGNITION_TIMELINE.reduced:IGNITION_TIMELINE.normal;
}
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
  const freshMessage=fresh?(state.acquired.length===6?'ENGINE STARTが解放された！':'マシンにパーツが追加された！'):'このパーツはもう集めてあるよ！';
  show(fresh?'パーツゲット！':'ゲット済み！',found.name,freshMessage);
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
function clearIgnitionTimers(){
  ignitionTimers.forEach(function(id){window.clearTimeout(id);});
  ignitionTimers=[];
}
function queueIgnition(fn,ms){
  ignitionTimers.push(window.setTimeout(fn,ms));
}
function setIgnitionPhase(seq,phase,title,sub,rpm){
  IGNITION_PHASES.forEach(function(c){seq.classList.remove(c);});
  seq.classList.remove('is-flash');
  if(phase)seq.classList.add(phase);
  seq.dataset.phase=phase||'idle';
  if(title!==undefined)$('ignitionTitle').textContent=title;
  if(sub!==undefined)$('ignitionSub').textContent=sub;
  if(rpm!==undefined&&$('rpmValue'))$('rpmValue').textContent=rpm;
}
function runIgnitionSequence(){
  const seq=$('ignitionSequence');
  if(ignitionRunning)return;
  ignitionRunning=true;
  clearIgnitionTimers();

  if(!seq){
    document.body.classList.add('machine-flash');
    if($('completeFx'))$('completeFx').classList.add('on','celebrate');
    pulse();
    show('MISSION COMPLETE','スタンプラリー クリア！','マシン完成！','clear');
    ignitionRunning=false;
    return;
  }

  seq.classList.remove.apply(seq.classList,['show','is-flash'].concat(IGNITION_PHASES));
  seq.dataset.phase='idle';
  $('ignitionTitle').textContent='ENGINE START';
  $('ignitionSub').textContent='始動';
  if($('rpmValue'))$('rpmValue').textContent='0.8';

  buildIgnitionParticles();
  buildIgnitionCarHero();

  document.body.classList.add('ignition-active');
  document.body.classList.remove('machine-running');
  void seq.offsetWidth;
  seq.classList.add('show');
  try{if(navigator.vibrate)navigator.vibrate([35,65,35]);}catch(e){}

  const T=ignitionTimeline();
  const alive=function(){return seq.classList.contains('show');};

  queueIgnition(function(){
    if(!alive())return;
    setIgnitionPhase(seq,'phase-2','ENGINE START','始動','1.4');
    try{if(navigator.vibrate)navigator.vibrate([45,45,60]);}catch(e){}
  },T.p2);

  queueIgnition(function(){
    if(!alive())return;
    setIgnitionPhase(seq,'phase-1','','','7.8');
    document.body.classList.add('machine-running');
    try{if(navigator.vibrate)navigator.vibrate([55,28,70,28,90]);}catch(e){}
  },T.p1);

  queueIgnition(function(){
    if(!alive())return;
    setIgnitionPhase(seq,'phase-ignite','','','8.2');
    document.body.classList.add('machine-flash');
    pulse();
    try{if(navigator.vibrate)navigator.vibrate([70,35,110]);}catch(e){}
  },T.ignite);

  /* FULL POWER: the loud peak */
  queueIgnition(function(){
    if(!alive())return;
    setIgnitionPhase(seq,'phase-run','FULL POWER','','6.9');
    try{if(navigator.vibrate)navigator.vibrate([95,45,95,45,145]);}catch(e){}
  },T.run);

  /* A very short impact flash (not a white screen) */
  if(T.flash){
    queueIgnition(function(){
      if(!alive())return;
      seq.classList.add('is-flash');
    },T.flash);
  }

  /* BLACKOUT: drop everything - text, tachometer, lights, afterfire, garage */
  queueIgnition(function(){
    if(!alive())return;
    setIgnitionPhase(seq,'phase-blackout','','','');
  },T.blackout);

  /* SILHOUETTE -> LIGHT REVEAL -> COMPLETE HERO (staged by CSS delays inside phase-reveal) */
  queueIgnition(function(){
    if(!alive())return;
    setIgnitionPhase(seq,'phase-reveal','','','');
    if($('completeFx'))$('completeFx').classList.add('on','celebrate');
    try{if(navigator.vibrate)navigator.vibrate([30,60,45]);}catch(e){}
  },T.reveal);

  /* FINAL COPY after the car has been admired */
  queueIgnition(function(){
    if(!alive())return;
    setIgnitionPhase(seq,'phase-final','','','1.3');
    try{if(navigator.vibrate)navigator.vibrate([40,30,80]);}catch(e){}
  },T.final);
}
function buildIgnitionParticles(){
  const root=$('ignitionParticles');
  if(!root)return;
  root.innerHTML='';
  for(let i=0;i<26;i++){
    const p=document.createElement('i');
    p.style.setProperty('--x',String((i*37)%101)+'%');
    p.style.setProperty('--dx',String((i%2?-1:1)*(22+(i%6)*9))+'vw');
    p.style.setProperty('--d',String(0.55+(i%7)*0.08)+'s');
    p.style.setProperty('--delay',String((i%9)*0.035)+'s');
    p.style.setProperty('--size',String(2+(i%4))+'px');
    root.appendChild(p);
  }
}
function buildIgnitionCarHero(){
  const hero=$('ignitionCarHero');
  const source=$('carLayers');
  if(!hero||!source)return;
  hero.innerHTML='';
  const clone=source.cloneNode(true);
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach(function(el){el.removeAttribute('id');});
  clone.querySelectorAll('img').forEach(function(img){
    if(!img.getAttribute('src')&&img.dataset.src)img.setAttribute('src',img.dataset.src);
    if(img.dataset.partLayer&&state.acquired.includes(img.dataset.partLayer))img.classList.add('on');
  });
  clone.querySelectorAll('.complete-layer').forEach(function(el){el.classList.remove('on','celebrate');});
  hero.appendChild(clone);
}
function closeIgnitionSequence(){
  clearIgnitionTimers();
  ignitionRunning=false;
  const seq=$('ignitionSequence');
  if(seq){
    seq.classList.remove.apply(seq.classList,['show','is-flash'].concat(IGNITION_PHASES));
    seq.dataset.phase='idle';
  }
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
  $('headline').textContent=state.complete?'スタンプラリー クリア！':ready?'パーツが全部そろった！':n?'あと'+(6-n)+'こ！':'6つのパーツを集めて、マシンを完成させよう！';
  $('subline').textContent=state.complete?'マシン完成！':ready?'最後の「ENGINE START」へ！':'館内のスポットを探して、スマホでチェック！';
  if($('completeFx'))$('completeFx').classList.toggle('on',state.complete);
  document.body.classList.toggle('mission-complete',!!state.complete);
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

[executed on device: ikegamiryuusukenoMacBook-Air.local (f424c449-4795-4c08-b192-30c07117f2c8)]