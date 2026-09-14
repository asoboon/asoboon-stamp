(()=>{'use strict';
const CURRENT='asoboon_v2_current_reservation_develop_v1';
const CALL='asoboon_v2_callstatus_develop_v1';
const HISTORY='asoboon_v2_receipt_history_develop_v1';
const LAST='asoboon_v2_last_receipt_develop_v1';
const MAX=20;
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
function normalize(rec,state=''){if(!rec?.receiptNo)return null;return{receiptNo:String(rec.receiptNo),reserveId:String(rec.reserveId||''),businessDate:String(rec.businessDate||''),businessType:String(rec.businessType||''),waitTypeId:String(rec.waitTypeId||''),waitTypeLabel:String(rec.waitTypeLabel||rec.waitTypeName||''),adults:Number(rec.adults||0),paidChildren:Number(rec.paidChildren||0),infants:Number(rec.infants||0),totalPeople:Number(rec.totalPeople||0),totalPrice:Number(rec.totalPrice||0),mode:String(rec.mode||'web'),state:String(state||rec.state||''),savedAt:Date.now()}}
function archive(rec,state=''){const item=normalize(rec,state);if(!item)return null;let list=read(HISTORY);if(!Array.isArray(list))list=[];const old=list.find(x=>String(x?.receiptNo||'')===item.receiptNo&&String(x?.businessDate||'')===item.businessDate);const merged={...(old||{}),...item,savedAt:Date.now()};list=[merged,...list.filter(x=>!(String(x?.receiptNo||'')===item.receiptNo&&String(x?.businessDate||'')===item.businessDate))].slice(0,MAX);write(HISTORY,list);write(LAST,merged);return merged}
function archiveCurrent(state=''){const cur=read(CURRENT);if(cur?.receiptNo)return archive(cur,state);const call=read(CALL);if(call?.receiptNo)return archive(call,state);return null}
function markCurrentCanceled(){const cur=read(CURRENT);if(cur?.receiptNo)write(CURRENT,{...cur,state:'canceled',canceledAt:Date.now()});const call=read(CALL);if(call?.receiptNo)write(CALL,{...call,state:'canceled',canceledAt:Date.now()})}
function getAll(){const x=read(HISTORY);return Array.isArray(x)?x:[]}
function getLatest(){const last=read(LAST);if(last?.receiptNo)return last;return getAll()[0]||null}
window.addEventListener('asoboon:v8-home-status',e=>{const d=e.detail||{};if(d.canceled)markCurrentCanceled();archiveCurrent(String(d.canceled?'canceled':d.kind||''))});
window.addEventListener('asoboon:v2-reservation-saved',e=>archive(e.detail||{},'waiting'));
window.addEventListener('popstate',()=>archiveCurrent());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)archiveCurrent()});
window.ASOBOON_V22_RESERVATION_HISTORY=Object.freeze({archive,archiveCurrent,getAll,getLatest});
archiveCurrent();setTimeout(()=>archiveCurrent(),500);setTimeout(()=>archiveCurrent(),1800);
})();
