(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const SAFE_VIEWS=new Set(['home','reception','callstatus','timeguide','first','entry','rules','parking','stamp','omikuji','game']);
const initialParams=new URLSearchParams(location.search);
const initialView=String(initialParams.get('view')||'home');
const initialPanel=String(initialParams.get('panel')||'');
const initialDev=String(initialParams.get('dev')||'');
const initialMenu=String(initialParams.get('menu')||initialParams.get('mode')||'before')==='inside'?'inside':'before';
function baseUrl(){const u=new URL(E.endpoint||location.href,location.href);u.search='';u.hash='';return u}
function currentMenu(){const p=new URLSearchParams(location.search);return String(p.get('menu')||p.get('mode')||initialMenu)==='inside'?'inside':'before'}
function navigate(view,panel='',replace=false){
  const v=String(view||'').trim();
  if(!SAFE_VIEWS.has(v))return;
  const p=String(panel||'').trim(),menu=currentMenu();
  document.body.classList.add('v33-route-pending');
  const u=baseUrl();
  u.searchParams.set('view',v);
  u.searchParams.set('mode',menu);
  u.searchParams.set('menu',menu);
  if(p)u.searchParams.set('panel',p);
  const st={asoboonV2:true,v7:true,view:v,panel:p,menu};
  if(replace)history.replaceState(st,'',u.href);else history.pushState(st,'',u.href);
  window.dispatchEvent(new PopStateEvent('popstate',{state:st}));
  window.scrollTo({top:0,behavior:'smooth'});
}
function restoreInitialExtras(){
  if(!SAFE_VIEWS.has(initialView))return;
  const u=new URL(location.href);
  let changed=false;
  if(initialPanel&&!u.searchParams.get('panel')){u.searchParams.set('panel',initialPanel);changed=true}
  if(initialDev==='1'&&!u.searchParams.get('dev')){u.searchParams.set('dev','1');changed=true}
  if(!u.searchParams.get('menu')){u.searchParams.set('menu',initialMenu);changed=true}
  if(!u.searchParams.get('mode')){u.searchParams.set('mode',initialMenu);changed=true}
  if(!changed)return;
  history.replaceState({asoboonV2:true,v7:true,view:initialView,panel:initialPanel,menu:initialMenu},'',u.href);
  window.dispatchEvent(new PopStateEvent('popstate',{state:{asoboonV2:true,v7:true,view:initialView,panel:initialPanel,menu:initialMenu}}));
}
document.addEventListener('click',e=>{
  const target=e.target?.closest?.('[data-v7-view],[data-pv7-view],[data-view],#backBtn');
  if(!target||target.disabled)return;
  const isBack=target.id==='backBtn';
  const view=isBack?'home':(target.dataset.v7View||target.dataset.pv7View||target.dataset.view||'');
  if(!SAFE_VIEWS.has(String(view)))return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  navigate(view,isBack?'':(target.dataset.v7Panel||target.dataset.pv7Panel||''),isBack);
},true);
window.addEventListener('asoboon:v2-liff-ready',()=>setTimeout(restoreInitialExtras,0),{once:true});
window.ASOBOON_V7_NAVIGATE=navigate;
})();