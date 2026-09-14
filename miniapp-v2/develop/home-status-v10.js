(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const RES_KEY='asoboon_v2_current_reservation_develop_v1';
const CALL_KEY='asoboon_v2_callstatus_develop_v1';
const SESSION_KEY='asoboon_v2_callstatus_session_develop_v1';
const TIMEOUT_MS=8000;
let timer=0,running=false,seq=0;
const currentView=()=>String(new URLSearchParams(location.search).get('view')||'home');
const readJSON=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const writeJSON=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));return true}catch{return false}};
const removeKey=key=>{try{localStorage.removeItem(key)}catch{}};
const emit=detail=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail}));
function stop(){seq+=1;running=false;if(timer){clearTimeout(timer);timer=0}}
function schedule(ms){if(timer){clearTimeout(timer);timer=0}if(!ms||currentView()!=='home'||document.visibilityState!=='visible')return;timer=setTimeout(()=>{timer=0;void refresh()},ms)}
function delayFor(d){const s=String(d?.state||'');if(['calling','done','canceled'].includes(s))return 0;if(['hold','processing'].includes(s))return 60000;if(s==='waiting'){const n=Number(d.aheadCount);if(Number.isFinite(n)&&n<=1)return 5000;if(Number.isFinite(n)&&n<=5)return 15000;if(Number.isFinite(n)&&n<=20)return 60000;return 180000}return 30000}
function cachedReservation(){return readJSON(RES_KEY)||readJSON(CALL_KEY)||null}
function validSession(cached){const s=readJSON(SESSION_KEY);if(!s?.sessionToken)return null;if(Number(s.expiresAt||0)<=Date.now()+15000)return null;if(cached?.receiptNo&&String(s.receiptNo||'')!==String(cached.receiptNo||''))return null;if(cached?.businessDate&&String(s.businessDate||'')!==String(cached.businessDate||''))return null;return s}
async function post(action,body={}){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),TIMEOUT_MS);try{const r=await fetch(E.backendUrl,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',signal:ctrl.signal,headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Accept:'application/json'},body:new URLSearchParams(Object.entries({action,...body}).map(([k,v])=>[k,String(v??'')]))});let d=null;try{d=await r.json()}catch{}if(!r.ok)throw Error(String(d?.error||`HTTP ${r.status}`));return d||{}}finally{clearTimeout(t)}}
async function recover(cached){if(!window.liff||!liff.isInClient?.()||!liff.isLoggedIn?.())return null;const token=String(liff.getAccessToken?.()||'');if(token.length<20)return null;const d=await post('recoverReservationSession',{liffAccessToken:token,businessDate:String(cached?.businessDate||'')});if(!d?.ok||!d.found)return null;const s={sessionToken:String(d.sessionToken||''),businessDate:String(d.businessDate||''),receiptNo:String(d.receiptNo||''),waitTypeId:String(d.waitTypeId||''),expiresAt:Number(d.expiresAt||0),cachedAt:Date.now()};if(s.sessionToken.length<32)return null;writeJSON(SESSION_KEY,s);writeJSON(CALL_KEY,{businessDate:s.businessDate,receiptNo:s.receiptNo,waitTypeId:s.waitTypeId,cachedAt:Date.now()});return s}
function normalize(d,cached){const receipt=String(d?.receiptNo||cached?.receiptNo||'—');if(!d?.found)return{kind:'sync',receipt,message:'受付情報をまだ確認できません。下の「呼出状況」から最新情報をご確認ください。'};const s=String(d.state||'');if(s==='waiting'){const ahead=Number(d.aheadCount);return Number.isFinite(ahead)?{kind:'waiting',receipt,ahead}:{kind:'sync',receipt,message:'最新の順番を確認できません。下の「呼出状況」からご確認ください。'}}if(s==='calling')return{kind:'calling',receipt};if(['hold','processing','done'].includes(s))return{kind:'guide',receipt};if(s==='canceled')return{kind:'none',receipt,canceled:true};return{kind:'sync',receipt,message:'受付状況を確認できません。下の「呼出状況」からご確認ください。'}}
async function refresh(){if(currentView()!=='home'||running)return;running=true;const my=++seq;try{const cached=cachedReservation();if(!cached?.receiptNo){emit({kind:'none'});return}emit({kind:'sync',receipt:String(cached.receiptNo),message:'最新の受付状況を確認しています…'});let session=validSession(cached);if(!session){removeKey(SESSION_KEY);session=await recover(cached)}if(my!==seq||currentView()!=='home')return;if(!session){emit({kind:'sync',receipt:String(cached.receiptNo),message:'受付状況を自動取得できません。下の「呼出状況」からご確認ください。'});schedule(30000);return}let d;try{d=await post('reservationStatus',{sessionToken:session.sessionToken})}catch(e){if(/SESSION/i.test(String(e?.message||''))){removeKey(SESSION_KEY);session=await recover(cached);if(session)d=await post('reservationStatus',{sessionToken:session.sessionToken});else throw e}else throw e}if(my!==seq||currentView()!=='home')return;const n=normalize(d,cached);emit(n);schedule(delayFor(d))}catch{if(my===seq&&currentView()==='home'){const cached=cachedReservation();emit({kind:'sync',receipt:String(cached?.receiptNo||'—'),message:'受付状況を自動取得できません。下の「呼出状況」からご確認ください。'});schedule(30000)}}finally{if(my===seq)running=false}}
function start(){stop();if(currentView()==='home')setTimeout(()=>void refresh(),0)}
window.addEventListener('popstate',()=>setTimeout(start,0));
window.addEventListener('focus',()=>{if(currentView()==='home')void refresh()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(timer){clearTimeout(timer);timer=0}}else if(currentView()==='home')void refresh()});
window.addEventListener('asoboon:v2-liff-ready',()=>{if(currentView()==='home')void refresh()});
window.ASOBOON_V10_HOME_STATUS=Object.freeze({refresh,start,stop});
start();
})();
