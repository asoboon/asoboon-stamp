/* ASOBooN 新ミニアプリ AUTO呼出 / LINE通知 連携ブリッジ
 * 受付成功表示はこの通信を待たない。
 * LINEアクセストークンは永続保存しない。
 */
(()=>{
'use strict';
const C=()=>window.ASOBOON_APP_CONFIG||{};
const inflight=new Set();
let lineTokenProvider=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function normalizeReserveId(v){const d=String(v??'').normalize('NFKC').replace(/\D/g,'');if(!d||d.length>12)return'';return d.padStart(12,'0')}
function makeRequestId(){try{if(crypto?.randomUUID)return'b_'+crypto.randomUUID()}catch{}return'b_'+Date.now()+'_'+Math.random().toString(36).slice(2,14)}
function readSent(){try{return JSON.parse(localStorage.getItem(C().autoBridgeSentKey)||'{}')||{}}catch{return{}}}
function isSent(p){const id=normalizeReserveId(p?.reserveId);return !!(id&&readSent()[id])}
function markSent(p){try{const id=normalizeReserveId(p?.reserveId);if(!id)return;const m=readSent();m[id]=Date.now();const cutoff=Date.now()-7*86400000;Object.keys(m).forEach(k=>{if(Number(m[k]||0)<cutoff)delete m[k]});localStorage.setItem(C().autoBridgeSentKey,JSON.stringify(m))}catch{}}
function safePayload(p){const x={...p};delete x.lineAccessToken;delete x.idToken;return x}
function savePending(p){try{localStorage.setItem(C().autoBridgePendingKey,JSON.stringify({...safePayload(p),queuedAt:Date.now()}))}catch{}}
function clearPending(p){try{const x=JSON.parse(localStorage.getItem(C().autoBridgePendingKey)||'null');if(x&&normalizeReserveId(x.reserveId)===normalizeReserveId(p.reserveId))localStorage.removeItem(C().autoBridgePendingKey)}catch{}}
function setLineTokenProvider(fn){lineTokenProvider=typeof fn==='function'?fn:null}
async function lineTokenFor(payload){if(payload?.lineAccessToken)return String(payload.lineAccessToken);if(!lineTokenProvider)return'';try{return String(await lineTokenProvider()||'')}catch{return''}}
function validBridgeUrl(url){return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?|$)/.test(String(url||''))}
function jsonpStatus(requestId,timeout=4500){return new Promise((resolve,reject)=>{const url=String(C().autoBridgeUrl||'');if(!validBridgeUrl(url))return reject(new Error('bridge url'));const cb='__asoboon_bridge_'+Date.now()+'_'+Math.random().toString(36).slice(2);const u=new URL(url);u.searchParams.set('action','bridgeStatus');u.searchParams.set('requestId',requestId);u.searchParams.set('callback',cb);u.searchParams.set('_',Date.now());const s=document.createElement('script');let done=false;const finish=(err,val)=>{if(done)return;done=true;clearTimeout(t);try{delete window[cb]}catch{}s.remove();err?reject(err):resolve(val)};window[cb]=v=>finish(null,v);s.src=u.toString();s.onerror=()=>finish(new Error('bridge status'));document.head.appendChild(s);const t=setTimeout(()=>finish(new Error('bridge timeout')),timeout)})}
async function confirmStatus(requestId){for(const ms of [250,450,750,1100]){await sleep(ms);try{const s=await jsonpStatus(requestId);if(s?.found)return s}catch{}}return null}
async function send(payload){
  const url=String(C().autoBridgeUrl||'');
  const reserveId=normalizeReserveId(payload?.reserveId);
  if(!validBridgeUrl(url)||!reserveId||!payload?.receiptNo||!payload?.waitTypeId)return{ok:false,error:'VALIDATION_ERROR'};
  if(isSent(payload))return{ok:true,stored:true,alreadySent:true};
  if(inflight.has(reserveId))return{ok:false,error:'INFLIGHT'};
  inflight.add(reserveId);
  const p={...safePayload(payload),reserveId,source:C().autoBridgeSource||'asoboon-app-v2',bridgeRequestId:String(payload?.bridgeRequestId||makeRequestId())};
  savePending(p);
  try{
    const token=await lineTokenFor(payload);
    const post={...p};
    if(token)post.lineAccessToken=token;
    await fetch(url,{method:'POST',mode:'no-cors',credentials:'omit',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams(Object.fromEntries(Object.entries(post).map(([k,v])=>[k,String(v??'')]))),cache:'no-store',keepalive:true});
    const status=await confirmStatus(p.bridgeRequestId);
    if(status?.ok&&status?.stored){markSent(p);clearPending(p);return status}
    return{ok:false,stored:false,error:'BRIDGE_NOT_CONFIRMED',requestId:p.bridgeRequestId};
  }catch{return{ok:false,stored:false,error:'BRIDGE_POST_FAILED',requestId:p.bridgeRequestId}}
  finally{inflight.delete(reserveId)}
}
function queue(payload){return send(payload)}
async function retryPending(){try{const p=JSON.parse(localStorage.getItem(C().autoBridgePendingKey)||'null');if(!p?.reserveId||Date.now()-Number(p.queuedAt||0)>24*60*60*1000){if(p)localStorage.removeItem(C().autoBridgePendingKey);return null}if(isSent(p)){clearPending(p);return{ok:true,alreadySent:true}}return await send(p)}catch{return null}}
window.addEventListener('online',()=>{void retryPending()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void retryPending()});setTimeout(()=>{void retryPending()},900);
window.ASOBOON_AUTO_BRIDGE=Object.freeze({normalizeReserveId,send,queue,retryPending,setLineTokenProvider});
})();
