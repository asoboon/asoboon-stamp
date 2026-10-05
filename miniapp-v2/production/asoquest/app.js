/* ASOQUEST v6 — one-day, serverless, image-asset-free LINE MINI App lane.
   Existing stamp rally and official home are intentionally untouched. */
(() => {
  'use strict';

  const CONFIG = { TOTAL: 6, STORAGE_PREFIX: 'asoquest:v6', TIME_ZONE: 'Asia/Tokyo' };
  const PARTS = [
    { id:'engine',    no:'01', name:'エンジン' },
    { id:'wheel',     no:'02', name:'タイヤ' },
    { id:'headlight', no:'03', name:'ライト' },
    { id:'fin',       no:'04', name:'フィン' },
    { id:'grille',    no:'05', name:'グリル' },
    { id:'key',       no:'06', name:'キー' }
  ];
  const PART_IDS = new Set(PARTS.map(p => p.id));

  const $ = id => document.getElementById(id);
  const els = {
    loading:$('loading'),loadingLabel:$('loadingLabel'),progressBadge:$('progressBadge'),partsCount:$('partsCount'),
    partsGrid:$('partsGrid'),carStage:$('carStage'),carPulse:$('carPulse'),machineState:$('machineState'),
    machinePanel:document.querySelector('.machinePanel'),headline:$('headline'),subline:$('subline'),
    engineCard:$('engineCard'),engineTitle:$('engineTitle'),engineHint:$('engineHint'),engineLock:$('engineLock'),
    resultOverlay:$('resultOverlay'),resultKicker:$('resultKicker'),resultTitle:$('resultTitle'),resultText:$('resultText'),
    shortageOverlay:$('shortageOverlay'),missingNumber:$('missingNumber'),missingInline:$('missingInline'),
    completeOverlay:$('completeOverlay'),completeTitle:$('completeTitle'),completeText:$('completeText'),
    errorOverlay:$('errorOverlay'),errorTitle:$('errorTitle'),errorText:$('errorText')
  };

  const state = { partId:'', station:'', source:readSource(), acquired:[], completed:false, storageKey:'' };

  document.addEventListener('DOMContentLoaded', init);
  $('resultClose').addEventListener('click',()=>{closeOverlay(els.resultOverlay);cleanRouteInPlace()});
  $('shortageClose').addEventListener('click',()=>{closeOverlay(els.shortageOverlay);cleanRouteInPlace()});
  $('completeClose').addEventListener('click',()=>{closeOverlay(els.completeOverlay);cleanRouteInPlace();renderStatus()});
  $('errorRetry').addEventListener('click',()=>location.reload());
  $('refreshBtn').addEventListener('click',()=>{cleanRouteInPlace();loadState();renderStatus();scrollTo({top:0,behavior:'smooth'})});

  function init(){
    try{
      setLoading('アソクエを起動しています');
      assertStorageAvailable();
      state.storageKey = `${CONFIG.STORAGE_PREFIX}:${japanDateKey()}`;
      cleanupOldKeys();
      const route=readRoute(); state.partId=route.partId; state.station=route.station; loadState();
      let result={action:'status',count:state.acquired.length};
      if(state.partId) result=collectPart(state.partId); else if(state.station==='engine') result=checkEngine();
      renderStatus(); hideLoading();
      if(state.partId) handleCollectResult(result); else if(state.station==='engine') handleEngineResult(result);
    }catch(err){hideLoading();showError(err)}
  }

  function readRoute(){
    const p=new URLSearchParams(location.search);
    let partId=String(p.get('part')||'').trim().toLowerCase();
    if(partId==='light') partId='headlight';
    const station=String(p.get('station')||'').trim().toLowerCase();
    return {partId:PART_IDS.has(partId)?partId:'',station:station==='engine'?'engine':''};
  }
  function readSource(){
    const p=new URLSearchParams(location.search); const s=String(p.get('src')||p.get('source')||'').trim().toLowerCase();
    return s==='nfc'||s==='qr'?s:'unknown';
  }
  function japanDateKey(){
    const ps=new Intl.DateTimeFormat('en-CA',{timeZone:CONFIG.TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const g=t=>ps.find(p=>p.type===t)?.value||''; return `${g('year')}-${g('month')}-${g('day')}`;
  }
  function assertStorageAvailable(){
    try{localStorage.setItem('__asoquest_test__','1');localStorage.removeItem('__asoquest_test__')}
    catch{throw userError('STORAGE_UNAVAILABLE','このブラウザでは遊べません','ブラウザのサイトデータ設定をご確認ください。')}
  }
  function loadState(){
    let saved={};try{saved=JSON.parse(localStorage.getItem(state.storageKey)||'{}')}catch{}
    state.acquired=Array.isArray(saved.acquired)?[...new Set(saved.acquired.filter(id=>PART_IDS.has(id)))]:[];
    state.completed=Boolean(saved.completed);
  }
  function saveState(extra={}){
    localStorage.setItem(state.storageKey,JSON.stringify({version:6,date:japanDateKey(),acquired:[...state.acquired],completed:Boolean(state.completed),updatedAt:new Date().toISOString(),lastSource:state.source,...extra}));
  }
  function collectPart(id){
    const already=state.acquired.includes(id);
    if(!already){state.acquired.push(id);saveState({lastAction:'collect',lastPart:id})}
    return {collectStatus:already?'already':'new',currentPart:id,count:state.acquired.length};
  }
  function checkEngine(){
    const missing=Math.max(0,CONFIG.TOTAL-state.acquired.length);
    if(missing){saveState({lastAction:'engine_locked'});return{engineStatus:'locked',missing}}
    state.completed=true;saveState({lastAction:'engine_clear',completedAt:new Date().toISOString()});return{engineStatus:'clear',missing:0};
  }
  function cleanupOldKeys(){
    const current=state.storageKey,prefix=`${CONFIG.STORAGE_PREFIX}:`;
    try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith(prefix)&&k!==current)localStorage.removeItem(k)}}catch{}
  }

  function renderStatus(){
    const count=state.acquired.length;
    els.progressBadge.innerHTML=`<b>${count}</b><span>/6</span>`;
    els.partsCount.textContent=`${count} / 6`;
    els.carStage.dataset.count=String(count);
    document.querySelectorAll('[data-part]').forEach(el=>{
      const id=el.dataset.part;if(PART_IDS.has(id))el.classList.toggle('acquired',state.acquired.includes(id));
    });
    renderPartCards();
    const ready=count>=CONFIG.TOTAL;
    els.machinePanel.classList.toggle('ready',ready);els.engineCard.classList.toggle('ready',ready);els.engineCard.classList.toggle('locked',!ready);
    if(ready){
      els.machineState.textContent=state.completed?'MISSION COMPLETE':'MACHINE READY';
      els.headline.textContent=state.completed?'アソクエ クリア！':'6つのパーツがそろった！';
      els.subline.textContent=state.completed?'きょうのミッション完了！':'ENGINE STARTを探して、マシンを起動しよう。';
      els.engineTitle.textContent=state.completed?'COMPLETE':'UNLOCKED';els.engineHint.textContent=state.completed?'エンジン始動成功！':'ENGINE STARTへ行こう！';els.engineLock.textContent=state.completed?'🏁':'⚡';
    }else{
      const missing=CONFIG.TOTAL-count;
      els.machineState.textContent=count?`ASSEMBLY ${count} / 6`:'MACHINE OFFLINE';
      els.headline.textContent=count?`あと${missing}こで完成！`:'6つのパーツを見つけよう！';
      els.subline.textContent='館内を探して、スマホをタッチ。';
      els.engineTitle.textContent='LOCKED';els.engineHint.textContent=`あと${missing}こ集めると起動できます`;els.engineLock.textContent='🔒';
    }
  }

  function partIconSvg(id){
    const m={
      engine:`<svg viewBox="0 0 64 64"><path class="i-stroke" d="M10 31h9V21h12v7h13l6 7h7v17h-9l-5 6H24l-5-6h-9V37h0Z"/><path class="i-stroke" d="M27 37h17M27 44h17"/></svg>`,
      wheel:`<svg viewBox="0 0 64 64"><circle class="i-stroke" cx="32" cy="32" r="24"/><circle class="i-stroke" cx="32" cy="32" r="12"/><path class="i-stroke" d="M32 20v24M20 32h24M23.5 23.5l17 17M40.5 23.5l-17 17"/></svg>`,
      headlight:`<svg viewBox="0 0 64 64"><circle class="i-stroke" cx="24" cy="32" r="15"/><circle class="i-stroke" cx="43" cy="32" r="15"/><path class="i-stroke" d="M53 22h7M55 32h7M53 42h7"/></svg>`,
      fin:`<svg viewBox="0 0 64 64"><path class="i-stroke" d="M8 45h37l11-26l-4 31H8Z"/><path class="i-stroke" d="M43 33h12"/><path class="i-fill i-accent" d="M49 31h10v5H49z"/></svg>`,
      grille:`<svg viewBox="0 0 64 64"><rect class="i-stroke" x="8" y="18" width="48" height="28" rx="5"/><path class="i-stroke" d="M14 25h36M14 32h36M14 39h36M20 20v24M30 20v24M40 20v24M50 20v24"/></svg>`,
      key:`<svg viewBox="0 0 64 64"><circle class="i-stroke" cx="21" cy="23" r="11"/><path class="i-stroke" d="M29 31l23 23M43 45h8v-8M37 39h8v-8"/></svg>`
    };return m[id]||'';
  }
  function renderPartCards(){
    els.partsGrid.innerHTML=PARTS.map(p=>{const got=state.acquired.includes(p.id);return `<div class="partCard ${got?'acquired':''}">${got?'<span class="checkBadge">✓</span>':''}<span class="partIcon">${partIconSvg(p.id)}</span><strong>${p.name}</strong><small>${got?'FOUND':'NOT FOUND'} · ${p.no}</small></div>`}).join('');
    document.querySelectorAll('#segmentBar i').forEach((el,i)=>el.classList.toggle('on',i<countFound()));
  }
  function countFound(){return state.acquired.length}
  function handleCollectResult(r){
    const p=PARTS.find(x=>x.id===state.partId);if(!p)return;
    els.resultKicker.textContent=r.collectStatus==='new'?'PART GET!':'ALREADY FOUND';
    els.resultTitle.textContent=p.name;
    els.resultText.textContent=r.collectStatus==='new'?(state.acquired.length>=CONFIG.TOTAL?'これでパーツがぜんぶそろった！':'マシンにパーツがついた！'):'このパーツはもう見つけているよ！';
    if(r.collectStatus==='new'){fireCarPulse();vibrate([35,25,70,30,110])}showOverlay(els.resultOverlay);
  }
  function handleEngineResult(r){
    if(r.engineStatus==='locked'){els.missingNumber.textContent=String(r.missing);els.missingInline.textContent=String(r.missing);vibrate([45,45,45]);showOverlay(els.shortageOverlay);return}
    if(r.engineStatus==='clear')runEngineSequence();
  }
  function runEngineSequence(){
    showOverlay(els.completeOverlay);els.completeOverlay.classList.remove('cleared');els.completeTitle.textContent='ENGINE START';els.completeText.textContent='マシンを起動中…';vibrate([40,40,70,40,130,50,220]);
    setTimeout(()=>{els.completeTitle.textContent='IGNITION!';els.completeText.textContent='エンジン始動！';vibrate([80,35,160])},1350);
    setTimeout(()=>{els.completeTitle.textContent='GO!';els.completeText.textContent='アソクエ コンプリート！';els.completeOverlay.classList.add('cleared');vibrate([45,25,45,25,180])},2550);
  }
  function fireCarPulse(){els.carPulse.classList.remove('fire');requestAnimationFrame(()=>els.carPulse.classList.add('fire'))}
  function setLoading(t){els.loadingLabel.textContent=t;els.loading.classList.add('show');els.loading.setAttribute('aria-hidden','false')}
  function hideLoading(){els.loading.classList.remove('show');els.loading.setAttribute('aria-hidden','true')}
  function showOverlay(el){el.classList.add('show');el.setAttribute('aria-hidden','false')}
  function closeOverlay(el){el.classList.remove('show');el.setAttribute('aria-hidden','true')}
  function showError(err){els.errorTitle.textContent=err?.title||'読み込めませんでした';els.errorText.textContent=err?.userMessage||err?.message||'もう一度お試しください。';showOverlay(els.errorOverlay)}
  function vibrate(pattern){try{navigator.vibrate?.(pattern)}catch{}}
  function userError(code,title,userMessage){const e=new Error(code);e.code=code;e.title=title;e.userMessage=userMessage;return e}
  function cleanHomeUrl(){const u=new URL(location.href);['part','station','src','source'].forEach(k=>u.searchParams.delete(k));return u.toString()}
  function cleanRouteInPlace(){try{history.replaceState(null,'',cleanHomeUrl())}catch{}}
})();