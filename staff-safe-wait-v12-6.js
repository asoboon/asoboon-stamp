(()=>{
'use strict';
const C=window.ASOBOON_RECEPTION_CONFIG||{};
const KEY='asoboon_staff_key';
let blocked=false, pauseRequested=false, lastDecorated='';

function staffKey(){
  return String(localStorage.getItem(KEY)||localStorage.getItem('asoboon_staff_key_v8')||localStorage.getItem('asoboon_staff_key_v7')||localStorage.getItem('asoboon_staff_key_v6')||'').trim();
}
function log(msg){
  const el=document.getElementById('log');
  if(el) el.textContent=`[${new Date().toLocaleTimeString('ja-JP')}] ${msg}\n`+el.textContent;
}
function ensureNotice(){
  let el=document.getElementById('apiWaitNotice');
  if(el) return el;
  el=document.createElement('div');
  el.id='apiWaitNotice';
  el.className='notice';
  const scheduler=document.querySelector('.scheduler');
  if(scheduler?.parentElement) scheduler.parentElement.insertBefore(el,scheduler.nextSibling);
  return el;
}
function decorate(){
  if(!blocked) return;
  const notice=ensureNotice();
  notice.textContent='⏸ AirWAIT回答待ち：呼出API診断NGのためAUTO呼出を安全停止しています。受付取得・共有台帳・ID連携の監視は継続します。';
  notice.style.borderLeftColor='#ef7b70';
  notice.style.background='#40251e';
  notice.style.color='#ffd6cf';
  const state=document.getElementById('schedulerState');
  const desc=document.getElementById('schedulerDesc');
  if(state) state.textContent='AirWAIT回答待ち';
  if(desc) desc.textContent='呼出APIの確認が取れるまでAUTO呼出は停止。受付・台帳監視は継続中です。';
  const on=document.getElementById('resumeBtn');
  if(on){on.disabled=true;on.textContent='▶ AUTO ON（API確認後）';}
  const signature=`${state?.textContent||''}|${on?.disabled?'1':'0'}`;
  lastDecorated=signature;
}
async function requestPause(){
  if(pauseRequested) return;
  const key=staffKey();
  if(!key||!C.ledgerWebAppUrl) return;
  pauseRequested=true;
  try{
    await fetch(C.ledgerWebAppUrl,{
      method:'POST',mode:'no-cors',cache:'no-store',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({action:'setAutoEnabled',staffKey:key,enabled:'0'})
    });
    log('安全停止: 呼出API診断NGのためAUTOをOFFへ切替');
    setTimeout(()=>document.getElementById('refreshBtn')?.click(),1200);
  }catch(e){
    log(`安全停止要求失敗: ${e?.message||e}`);
  }
}
function detect(){
  const diag=document.getElementById('callDiag');
  const t=String(diag?.textContent||'');
  const deny=t.includes('仕様書記載の呼出区分がすべて拒否')||t.includes('KeyNORMALだけが拒否')||t.includes('KeyNORMAL)だけが拒否');
  if(deny&&!blocked){
    blocked=true;
    log('呼出API診断NGを検知。AUTOを安全停止します');
    requestPause();
  }
  if(blocked) decorate();
}

new MutationObserver(detect).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
setInterval(detect,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)detect()});
setTimeout(detect,500);
})();
