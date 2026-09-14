(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const RES_KEY='asoboon_v2_current_reservation_develop_v1';
const SESSION_KEY='asoboon_v2_callstatus_session_develop_v1';
const CALL_KEY='asoboon_v2_callstatus_develop_v1';
const REQUEST_TIMEOUT_MS=10000;
let timer=0,generation=0,busy=false;

const readJSON=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const writeJSON=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const removeKey=key=>{try{localStorage.removeItem(key)}catch{}};
const currentView=()=>String(new URLSearchParams(location.search).get('view')||'home');
const emit=detail=>window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail}));
const backendReady=()=>Boolean(E.backendUrl&&/^https:\/\//.test(String(E.backendUrl)));

function stop(){generation+=1;if(timer){clearTimeout(timer);timer=0}busy=false}
function cachedReservation(){return readJSON(RES_KEY)||readJSON(CALL_KEY)||null}
function delayFor(d){
  if(!d?.found)return 12000;
  const s=String(d.state||'');
  if(['calling','done','canceled'].includes(s))return 0;
  if(['hold','processing'].includes(s))return 60000;
  if(s==='waiting'){
    const n=Number(d.aheadCount);
    if(Number.isFinite(n)&&n<=1)return 5000;
    if(Number.isFinite(n)&&n<=5)return 15000;
    if(Number.isFinite(n)&&n<=20)return 60000;
    return 180000;
  }
  return 60000;
}
function schedule(ms,gen=generation){
  if(timer){clearTimeout(timer);timer=0}
  if(!ms||gen!==generation||currentView()!=='home'||document.visibilityState!=='visible')return;
  timer=setTimeout(()=>{timer=0;void refresh()},ms);
}
async function gatewayPost(action,body={}){
  if(!backendReady())throw Error('受付状況を確認できません。');
  const ctrl=new AbortController();
  const t=setTimeout(()=>ctrl.abort(),REQUEST_TIMEOUT_MS);
  try{
    const r=await fetch(E.backendUrl,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',signal:ctrl.signal,headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Accept:'application/json'},body:new URLSearchParams(Object.entries({action,...body}).map(([k,v])=>[k,String(v??'')]))});
    let d=null;try{d=await r.json()}catch{}
    if(!r.ok)throw Error(String(d?.error||`HTTP ${r.status}`));
    return d||{};
  }catch(e){if(e?.name==='AbortError')throw Error('受付状況の確認に時間がかかっています。');throw e}
  finally{clearTimeout(t)}
}
async function waitForLine(){
  if(window.liff&&liff.isInClient?.()&&liff.isLoggedIn?.())return;
  await Promise.race([new Promise(resolve=>window.addEventListener('asoboon:v2-liff-ready',resolve,{once:true})),new Promise(resolve=>setTimeout(resolve,7000))]);
  if(!window.liff||!liff.isInClient?.()||!liff.isLoggedIn?.())throw Error('LINEとの接続を確認しています。');
}
async function recoverSession(cached){
  await waitForLine();
  const token=String(liff.getAccessToken?.()||'');
  if(token.length<20)throw Error('LINEとの接続を確認しています。');
  const d=await gatewayPost('recoverReservationSession',{liffAccessToken:token,businessDate:String(cached?.businessDate||'')});
  if(!d?.ok)throw Error('受付情報を確認できません。');
  if(!d.found)return null;
  const session={sessionToken:String(d.sessionToken||''),businessDate:String(d.businessDate||''),receiptNo:String(d.receiptNo||''),waitTypeId:String(d.waitTypeId||''),expiresAt:Number(d.expiresAt||0),cachedAt:Date.now()};
  if(session.sessionToken.length<32)throw Error('受付情報を確認できません。');
  writeJSON(SESSION_KEY,session);
  writeJSON(CALL_KEY,{businessDate:session.businessDate,receiptNo:session.receiptNo,waitTypeId:session.waitTypeId,cachedAt:Date.now()});
  return session;
}
async function ensureSession(cached){
  const s=readJSON(SESSION_KEY);
  const receiptMatches=!cached?.receiptNo||String(s?.receiptNo||'')===String(cached.receiptNo||'');
  const dateMatches=!cached?.businessDate||String(s?.businessDate||'')===String(cached.businessDate||'');
  if(s?.sessionToken&&Number(s.expiresAt||0)>Date.now()+30000&&receiptMatches&&dateMatches)return s;
  removeKey(SESSION_KEY);
  return recoverSession(cached);
}
function normalize(d,cached){
  const receipt=String(d?.receiptNo||cached?.receiptNo||'—');
  if(!d?.found)return{kind:'sync',receipt,message:'受付情報を確認しています。'};
  const state=String(d.state||'');
  if(state==='waiting'){
    const ahead=Number(d.aheadCount);
    return Number.isFinite(ahead)?{kind:'waiting',receipt,ahead,title:'呼出待ち'}:{kind:'sync',receipt,message:'最新の順番を確認しています。'};
  }
  if(state==='calling')return{kind:'calling',receipt,title:'入場できます'};
  if(['hold','processing','done'].includes(state))return{kind:'guide',receipt,title:'ご案内中'};
  if(state==='canceled')return{kind:'none',receipt,canceled:true,title:'受付取消'};
  return{kind:'sync',receipt,message:'最新の受付状況を確認しています。'};
}
async function refresh(){
  if(currentView()!=='home'||busy)return;
  const gen=generation;busy=true;
  try{
    const cached=cachedReservation();
    if(!cached?.receiptNo){emit({kind:'none'});return}
    let session=await ensureSession(cached);
    if(gen!==generation||currentView()!=='home')return;
    if(!session){emit({kind:'none'});return}
    let d;
    try{d=await gatewayPost('reservationStatus',{sessionToken:session.sessionToken})}
    catch(e){
      if(/SESSION/i.test(String(e?.message||''))){removeKey(SESSION_KEY);session=await recoverSession(cached);if(!session){emit({kind:'none'});return}d=await gatewayPost('reservationStatus',{sessionToken:session.sessionToken})}
      else throw e;
    }
    if(gen!==generation||currentView()!=='home')return;
    emit(normalize(d,cached));
    schedule(delayFor(d),gen);
  }catch(e){
    if(gen===generation&&currentView()==='home'){
      const cached=cachedReservation();
      emit({kind:'sync',receipt:String(cached?.receiptNo||'—'),message:'受付状況を確認しています。通信状況をご確認ください。'});
      schedule(30000,gen);
    }
  }finally{busy=false}
}
function start(){stop();if(currentView()!=='home')return;generation+=1;void refresh()}
window.addEventListener('popstate',()=>setTimeout(start,0));
window.addEventListener('focus',()=>{if(currentView()==='home')void refresh()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(timer){clearTimeout(timer);timer=0}}else if(currentView()==='home')void refresh()});
window.addEventListener('asoboon:v2-liff-ready',()=>{if(currentView()==='home')void refresh()});
window.ASOBOON_V8_HOME_STATUS=Object.freeze({refresh,start,stop});
start();
})();
