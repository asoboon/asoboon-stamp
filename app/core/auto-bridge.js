/* ASOBooN 新ミニアプリ AUTO呼出連携ブリッジ
 * お客様の受付成功表示はこの通信を待たない。
 */
(()=>{
'use strict';
const C=()=>window.ASOBOON_APP_CONFIG||{};
const inflight=new Set();
function normalizeReserveId(v){const d=String(v??'').normalize('NFKC').replace(/\D/g,'');if(!d||d.length>12)return'';return d.padStart(12,'0')}
function readSent(){try{return JSON.parse(localStorage.getItem(C().autoBridgeSentKey)||'{}')||{}}catch{return{}}}
function isSent(p){const id=normalizeReserveId(p?.reserveId);return !!(id&&readSent()[id])}
function markSent(p){try{const id=normalizeReserveId(p?.reserveId);if(!id)return;const m=readSent();m[id]=Date.now();const cutoff=Date.now()-7*86400000;Object.keys(m).forEach(k=>{if(Number(m[k]||0)<cutoff)delete m[k]});localStorage.setItem(C().autoBridgeSentKey,JSON.stringify(m))}catch{}}
function savePending(p){try{localStorage.setItem(C().autoBridgePendingKey,JSON.stringify({...p,queuedAt:Date.now()}))}catch{}}
function clearPending(p){try{const x=JSON.parse(localStorage.getItem(C().autoBridgePendingKey)||'null');if(x&&normalizeReserveId(x.reserveId)===normalizeReserveId(p.reserveId))localStorage.removeItem(C().autoBridgePendingKey)}catch{}}
async function send(payload){const url=String(C().autoBridgeUrl||'');const reserveId=normalizeReserveId(payload?.reserveId);if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(url)||!reserveId||!payload?.receiptNo||!payload?.waitTypeId)return false;if(isSent(payload)||inflight.has(reserveId))return true;inflight.add(reserveId);const p={...payload,reserveId,source:C().autoBridgeSource||'asoboon-app-v2'};savePending(p);try{await fetch(url,{method:'POST',mode:'no-cors',credentials:'omit',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams(Object.fromEntries(Object.entries(p).map(([k,v])=>[k,String(v??'')]))),cache:'no-store',keepalive:true});markSent(p);clearPending(p);return true}catch{return false}finally{inflight.delete(reserveId)}}
function queue(payload){void send(payload)}
function retryPending(){try{const p=JSON.parse(localStorage.getItem(C().autoBridgePendingKey)||'null');if(!p?.reserveId||Date.now()-Number(p.queuedAt||0)>24*60*60*1000){if(p)localStorage.removeItem(C().autoBridgePendingKey);return}if(isSent(p)){clearPending(p);return}void send(p)}catch{}}
window.addEventListener('online',retryPending);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')retryPending()});setTimeout(retryPending,700);
window.ASOBOON_AUTO_BRIDGE=Object.freeze({normalizeReserveId,send,queue,retryPending});
})();
