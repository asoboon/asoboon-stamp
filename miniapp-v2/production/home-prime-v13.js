(()=>{'use strict';
const RES_KEY='asoboon_v2_current_reservation_production_v1';
const CALL_KEY='asoboon_v2_callstatus_production_v1';
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
function cachedReservation(){
  const today=String(window.ASOBOON_V2_OPERATIONAL_DATE||'');
  if(!today)return null;
  for(const item of [read(RES_KEY),read(CALL_KEY)]){
    if(item?.receiptNo&&String(item.businessDate||'')===today)return item;
  }
  return null;
}
try{localStorage.removeItem('asoboon_v2_home_status_production_v1')}catch{}
const cached=cachedReservation();
if(!cached)return;
const status={kind:'pending',receipt:String(cached.receiptNo),source:'local',checkedAt:Date.now()};
window.ASOBOON_HOME_STATUS_SNAPSHOT=status;
const announce=()=>{if(window.ASOBOON_HOME_STATUS_SNAPSHOT===status)window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:status}))};
if(typeof requestAnimationFrame==='function')requestAnimationFrame(announce);else setTimeout(announce,0);
})();
