(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const SAFE_VIEWS=new Set(['home','reception','callstatus','timeguide','first','entry','rules','parking','stamp','omikuji','game']);
const initialParams=new URLSearchParams(location.search);
const initialView=String(initialParams.get('view')||'home');
const initialPanel=String(initialParams.get('panel')||'');
const initialDev=String(initialParams.get('dev')||'');
function baseUrl(){const u=new URL(E.endpoint||location.href,location.href);u.search='';u.hash='';return u}
function navigate(view,panel=''){
  const v=String(view||'').trim();
  if(!SAFE_VIEWS.has(v))return;
  const p=String(panel||'').trim();
  const u=baseUrl();
  u.searchParams.set('view',v);
  u.searchParams.set('mode','before');
  if(p)u.searchParams.set('panel',p);
  history.pushState({asoboonV2:true,v7:true,view:v,panel:p},'',u.href);
  window.dispatchEvent(new PopStateEvent('popstate',{state:{asoboonV2:true,v7:true,view:v,panel:p}}));
  window.scrollTo({top:0,behavior:'smooth'});
}
function restoreInitialExtras(){
  if(!SAFE_VIEWS.has(initialView)||(!initialPanel&&!initialDev))return;
  const u=new URL(location.href);
  let changed=false;
  if(initialPanel&&!u.searchParams.get('panel')){u.searchParams.set('panel',initialPanel);changed=true}
  if(initialDev==='1'&&!u.searchParams.get('dev')){u.searchParams.set('dev','1');changed=true}
  if(!changed)return;
  history.replaceState({asoboonV2:true,v7:true,view:initialView,panel:initialPanel},'',u.href);
  window.dispatchEvent(new PopStateEvent('popstate',{state:{asoboonV2:true,v7:true,view:initialView,panel:initialPanel}}));
}
document.addEventListener('click',e=>{
  const target=e.target?.closest?.('[data-v7-view],[data-pv7-view]');
  if(!target||target.disabled)return;
  const view=target.dataset.v7View||target.dataset.pv7View||'';
  if(!SAFE_VIEWS.has(String(view)))return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  navigate(view,target.dataset.v7Panel||target.dataset.pv7Panel||'');
},true);
window.addEventListener('asoboon:v2-liff-ready',()=>setTimeout(restoreInitialExtras,0),{once:true});
window.ASOBOON_V7_NAVIGATE=navigate;
})();
