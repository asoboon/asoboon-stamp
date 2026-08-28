(()=>{
'use strict';
const C=window.ASOBOON_RECEPTION_CONFIG||{};
const KEY='asoboon_staff_key';
let blocked=false,pauseRequested=false;
function staffKey(){return String(localStorage.getItem(KEY)||localStorage.getItem('asoboon_staff_key_v8')||localStorage.getItem('asoboon_staff_key_v7')||localStorage.getItem('asoboon_staff_key_v6')||'').trim()}
function log(msg){const el=document.getElementById('log');if(el)el.textContent=`[${new Date().toLocaleTimeString('ja-JP')}] ${msg}\n`+el.textContent}
function ensureNotice(){let el=document.getElementById('apiWaitNotice');if(el)return el;el=document.createElement('div');el.id='apiWaitNotice';el.className='notice';const scheduler=document.querySelector('.scheduler');if(scheduler?.parentElement)scheduler.parentElement.insertBefore(el,scheduler.nextSibling);return el}
function decorate(){
  if(!blocked)return;const notice=ensureNotice();
  notice.textContent='⏸ 呼出API診断NGのためAUTO呼出を安全停止しています。受付取得・共有台帳・ID連携の監視は継続します。';
  notice.style.borderLeftColor='#ef7b70';notice.style.background='#40251e';notice.style.color='#ffd6cf';
  const state=document.getElementById('schedulerState'),desc=document.getElementById('schedulerDesc'),on=document.getElementById('resumeBtn');
  if(state)state.textContent='AUTO安全停止';if(desc)desc.textContent='通常呼出 00 のAPI診断が通るまで実呼出は行いません。';if(on){on.disabled=true;on.textContent='▶ AUTO ON（API診断後）'}
}
async function requestPause(){
  if(pauseRequested)return;const key=staffKey();if(!key||!C.ledgerWebAppUrl)return;pauseRequested=true;
  try{await fetch(C.ledgerWebAppUrl,{method:'POST',mode:'no-cors',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action:'setAutoEnabled',staffKey:key,enabled:'0'})});log('安全停止: 呼出API診断NGのためAUTOをOFFへ切替');setTimeout(()=>document.getElementById('refreshBtn')?.click(),1200)}
  catch(e){log(`安全停止要求失敗: ${e?.message||e}`)}
}
function detect(){
  const t=String(document.getElementById('callDiag')?.textContent||'');
  if(t.includes('呼出API診断NG')&&!blocked){blocked=true;log('呼出API診断NGを検知。AUTOを安全停止します');requestPause()}
  if(blocked)decorate();
}
new MutationObserver(detect).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
setInterval(detect,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)detect()});setTimeout(detect,500);
})();
