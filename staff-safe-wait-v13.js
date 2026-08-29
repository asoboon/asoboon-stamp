(()=>{
'use strict';
let blocked=false;
function log(msg){const el=document.getElementById('log');if(el)el.textContent=`[${new Date().toLocaleTimeString('ja-JP')}] ${msg}\n`+el.textContent}
function ensureNotice(){let el=document.getElementById('apiWaitNotice');if(el)return el;el=document.createElement('div');el.id='apiWaitNotice';el.className='notice';const scheduler=document.querySelector('.scheduler');if(scheduler?.parentElement)scheduler.parentElement.insertBefore(el,scheduler.nextSibling);return el}
function decorate(){
  if(!blocked)return;const notice=ensureNotice();
  notice.textContent='⏸ 呼出API診断NGのためAUTO呼出を安全停止しています。AirWAITの受付取得は継続します。';
  notice.style.borderLeftColor='#ef7b70';notice.style.background='#40251e';notice.style.color='#ffd6cf';
  const state=document.getElementById('schedulerState'),desc=document.getElementById('schedulerDesc'),on=document.getElementById('resumeBtn');
  if(state)state.textContent='AUTO安全停止';if(desc)desc.textContent='通常呼出 00 のAPI診断が通るまで実呼出は行いません。';if(on){on.disabled=true;on.textContent='▶ AUTO ON（API診断後）'}
}
function requestPause(){
  try{localStorage.setItem('asoboon_auto_enabled_v14','0')}catch{}
  log('安全停止: 呼出API診断NGのためこの端末のAUTOをOFFへ切替');
}
function detect(){
  const t=String(document.getElementById('callDiag')?.textContent||'');
  if(t.includes('呼出API診断NG')&&!blocked){blocked=true;log('呼出API診断NGを検知。AUTOを安全停止します');requestPause()}
  if(blocked)decorate();
}
new MutationObserver(detect).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
setInterval(detect,1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)detect()});setTimeout(detect,500);
})();