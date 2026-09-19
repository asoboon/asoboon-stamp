(()=>{'use strict';
const RES_KEY='asoboon_v2_current_reservation_develop_v1';
const SNAP_KEY='asoboon_v2_home_status_develop_v1';
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const remove=key=>{try{localStorage.removeItem(key)}catch{}};
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
function currentReservation(){const r=read(RES_KEY);return r?.receiptNo?r:null}
function sameLiveStatus(rec,status){
  if(!rec?.receiptNo||!status)return false;
  if(String(status.receipt||'')!==String(rec.receiptNo))return false;
  return ['waiting','calling','guide','error'].includes(String(status.kind||''))||(status.kind==='none'&&status.canceled===true);
}
function provisional(rec,force=false){
  if(!rec?.receiptNo)return null;
  const current=window.ASOBOON_HOME_STATUS_SNAPSHOT||null;
  if(!force&&sameLiveStatus(rec,current))return current;
  const stored=read(SNAP_KEY);
  if(stored?.receiptNo&&String(stored.receiptNo)!==String(rec.receiptNo))remove(SNAP_KEY);
  const status={kind:'sync',receipt:String(rec.receiptNo),message:'受付は完了しています。最新の順番を確認しています…',source:'local',checkedAt:Date.now()};
  window.ASOBOON_HOME_STATUS_SNAPSHOT=status;
  window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:status}));
  return status;
}
function refreshHome(){
  if(view()!=='home')return;
  const rec=currentReservation();
  if(!rec?.receiptNo)return;
  provisional(rec,false);
  setTimeout(()=>{try{window.ASOBOON_V13_HOME_STATUS?.refresh?.()}catch{}},0);
}
window.addEventListener('asoboon:v2-reservation-saved',e=>{
  const rec=e?.detail?.receiptNo?e.detail:currentReservation();
  if(!rec?.receiptNo)return;
  provisional(rec,true);
  if(view()==='home')setTimeout(refreshHome,0);
});
window.addEventListener('popstate',()=>setTimeout(refreshHome,0));
window.addEventListener('focus',()=>setTimeout(refreshHome,0));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(refreshHome,0)});
refreshHome();
})();
