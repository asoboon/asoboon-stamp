(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;
let timer=0,running=false,seq=0;
const currentView=()=>String(new URLSearchParams(location.search).get('view')||'home');
const emit=detail=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail}));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function stop(){seq+=1;running=false;if(timer){clearTimeout(timer);timer=0}const probe=document.getElementById('v9HomeStatusProbe');if(probe)probe.remove()}
function schedule(ms){if(timer){clearTimeout(timer);timer=0}if(!ms||currentView()!=='home'||document.visibilityState!=='visible')return;timer=setTimeout(()=>{timer=0;void refresh()},ms)}
function delayFor(kind,ahead){if(kind==='calling'||kind==='none')return 0;if(kind==='guide')return 60000;if(kind==='waiting'){const n=Number(ahead);if(Number.isFinite(n)&&n<=1)return 5000;if(Number.isFinite(n)&&n<=5)return 15000;if(Number.isFinite(n)&&n<=20)return 60000;return 180000}return 30000}
function parseProbe(probe){
 const box=probe.querySelector('#csState');
 const title=String(probe.querySelector('#csTitle')?.textContent||'').trim();
 const receipt=String(probe.querySelector('#csReceipt')?.textContent||'').trim().replace(/番$/,'')||'—';
 const aheadText=String(probe.querySelector('#csAhead')?.textContent||'').trim();
 const ahead=/^\d+$/.test(aheadText)?Number(aheadText):null;
 const c=box?.classList;
 if(c?.contains('waiting'))return Number.isFinite(ahead)?{kind:'waiting',receipt,ahead,title}:{kind:'sync',receipt,message:'最新の順番を確認しています。'};
 if(c?.contains('calling'))return{kind:'calling',receipt,title};
 if(c?.contains('hold')||c?.contains('processing')||c?.contains('done'))return{kind:'guide',receipt,title};
 if(c?.contains('canceled'))return{kind:'none',receipt,canceled:true,title};
 if(/本日の受付が見つかりません/.test(title))return{kind:'none'};
 const err=String(probe.querySelector('#csError')?.textContent||'').trim();
 return{kind:'sync',receipt,message:err||'受付情報を確認しています。'};
}
async function refresh(){
 if(currentView()!=='home'||running)return;
 const mod=window.ASOBOON_V2_CALLSTATUS;
 if(!mod?.render||!mod?.mount){emit({kind:'sync',message:'受付情報を確認しています。'});schedule(5000);return}
 running=true;const my=++seq;
 const old=document.getElementById('v9HomeStatusProbe');if(old)old.remove();
 const probe=document.createElement('div');probe.id='v9HomeStatusProbe';probe.setAttribute('aria-hidden','true');probe.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';probe.innerHTML=mod.render();document.body.appendChild(probe);
 emit({kind:'sync',receipt:String(probe.querySelector('#csReceipt')?.textContent||'—'),message:'受付情報を確認しています。'});
 try{
   mod.mount();
   let result=null;
   for(let i=0;i<48;i++){
     if(my!==seq||currentView()!=='home')return;
     await sleep(250);
     result=parseProbe(probe);
     if(result.kind!=='sync')break;
     const title=String(probe.querySelector('#csTitle')?.textContent||'');
     const err=String(probe.querySelector('#csError')?.textContent||'');
     if(/更新できません|見つかりません/.test(title)||err)break;
   }
   if(my!==seq||currentView()!=='home')return;
   result=result||parseProbe(probe);
   emit(result);
   schedule(delayFor(result.kind,result.ahead));
 }catch(e){
   if(my===seq&&currentView()==='home'){emit({kind:'sync',message:'受付状況を確認しています。通信状況をご確認ください。'});schedule(30000)}
 }finally{
   try{mod.unmount?.()}catch{}
   probe.remove();
   if(my===seq)running=false;
 }
}
function start(){stop();if(currentView()==='home'){setTimeout(()=>void refresh(),0)}}
window.addEventListener('popstate',()=>setTimeout(start,0));
window.addEventListener('focus',()=>{if(currentView()==='home')void refresh()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(timer){clearTimeout(timer);timer=0}}else if(currentView()==='home')void refresh()});
window.addEventListener('asoboon:v2-liff-ready',()=>{if(currentView()==='home')void refresh()});
window.ASOBOON_V9_HOME_STATUS=Object.freeze({refresh,start,stop});
start();
})();
