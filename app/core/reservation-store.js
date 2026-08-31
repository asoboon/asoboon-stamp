/* ASOBooN 新ミニアプリ 予約ローカル保存 */
(()=>{
'use strict';
const C=()=>window.ASOBOON_APP_CONFIG||{};
function key(){return C().currentReservationKey||'asoboon_app_v2_current_reservation'}
function save(rec){const value={...rec,savedAt:Date.now()};localStorage.setItem(key(),JSON.stringify(value));return value}
function read(){try{const x=JSON.parse(localStorage.getItem(key())||'null');return x&&x.receiptNo?x:null}catch{return null}}
function readForDate(date){const x=read();return x&&String(x.operationalDate||'')===String(date||'')?x:null}
function clear(){try{localStorage.removeItem(key())}catch{}}
function safeAirwaitUrl(value){try{const u=new URL(String(value||''));return u.protocol==='https:'&&/(^|\.)airwait\.jp$/i.test(u.hostname)?u.href:''}catch{return''}}
window.ASOBOON_RESERVATION_STORE=Object.freeze({save,read,readForDate,clear,safeAirwaitUrl});
})();
