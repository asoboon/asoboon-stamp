(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
function baseUrl(){const u=new URL(E.endpoint||location.href,location.href);u.search='';u.hash='';return u}
function navigate(view){
  const v=String(view||'').trim();
  if(!v)return;
  const u=baseUrl();
  u.searchParams.set('view',v);
  u.searchParams.set('mode','before');
  history.pushState({asoboonV2:true,v7:true},'',u.href);
  window.dispatchEvent(new PopStateEvent('popstate',{state:{asoboonV2:true,v7:true}}));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.addEventListener('click',e=>{
  const target=e.target?.closest?.('[data-v7-view]');
  if(!target||target.disabled)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  navigate(target.dataset.v7View);
},true);
window.ASOBOON_V7_NAVIGATE=navigate;
})();
