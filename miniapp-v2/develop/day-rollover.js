(()=>{'use strict';
const KEYS=Object.freeze({
  reservation:'asoboon_v2_current_reservation_develop_v1',
  call:'asoboon_v2_callstatus_develop_v1',
  session:'asoboon_v2_callstatus_session_develop_v1',
  pending:'asoboon_v2_pending_reception_develop_v1'
});
const TZ='Asia/Tokyo';
const CUTOFF_HOUR=18;
function jstParts(epoch=Date.now()){
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epoch)).map(x=>[x.type,x.value]));
}
function operationalDate(epoch=Date.now()){
  const p=jstParts(epoch);
  const dt=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+(Number(p.hour)>=CUTOFF_HOUR?1:0),12));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
}
function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function remove(key){try{localStorage.removeItem(key)}catch{}}
function datedValueIsStale(value,today){
  const d=String(value?.businessDate||value?.operationalDate||'').trim();
  return Boolean(d&&d!==today);
}
function pendingDate(value){
  const fp=String(value?.fingerprint||'');
  const m=fp.match(/^(\d{4}-\d{2}-\d{2})\|/);
  return m?m[1]:'';
}
function purgeStaleDay(){
  const today=operationalDate();
  const reservation=read(KEYS.reservation);
  const call=read(KEYS.call);
  const session=read(KEYS.session);
  const pending=read(KEYS.pending);
  if(datedValueIsStale(reservation,today))remove(KEYS.reservation);
  if(datedValueIsStale(call,today))remove(KEYS.call);
  if(datedValueIsStale(session,today))remove(KEYS.session);
  const pd=pendingDate(pending);
  if(pd&&pd!==today)remove(KEYS.pending);
  window.ASOBOON_V2_OPERATIONAL_DATE=today;
}
purgeStaleDay();
window.addEventListener('focus',purgeStaleDay);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)purgeStaleDay()});
})();
