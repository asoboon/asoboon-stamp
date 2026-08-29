(()=>{
'use strict';

const nativeFetch=window.fetch.bind(window);
const CENTER={lat:35.84895,lng:139.74345};
const RADIUS_M=500;
const VERIFY_MAX_AGE_MS=2*60*1000;
const TEST_OPEN_MINUTES=8*60;
const NORMAL_OPEN_MINUTES=9*60+30;
const CLOSE_MINUTES=18*60;
const CURRENT_RESERVATION_KEY='asoboon_current_reservation_v3';
const RESERVE_MAP_KEY='asoboon_reserve_map_v1';
const AUTO_V20_GAS_URL='https://script.google.com/macros/s/AKfycbzWxUtJp15E6mCNaHwHiwe0i54pkHHE0C_pJ8LbdDRmbnEu5hOAjr1hUHVoRFQBYGXftA/exec';
const AUTO_BRIDGE_PENDING_KEY='asoboon_auto_v20_bridge_pending_v1';
const G={verified:false,verifiedAt:0,distance:null,accuracy:null,checking:false,lastError:''};
window.ASOBOON_ONSITE_TEST_IDS=window.ASOBOON_ONSITE_TEST_IDS||new Set();

function receiptKey(v){return String(v??'').normalize('NFKC').replace(/\D/g,'').replace(/^0+(?=\d)/,'')}
function jstParts(){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]))}
function todayJst(){const p=jstParts();return`${p.year}-${p.month}-${p.day}`}
function nowMinutes(){const p=jstParts();return Number(p.hour)*60+Number(p.minute)}
function openNow(){const m=nowMinutes();return m>=TEST_OPEN_MINUTES&&m<CLOSE_MINUTES}
function normalOpenNow(){const m=nowMinutes();return m>=NORMAL_OPEN_MINUTES&&m<CLOSE_MINUTES}
function rad(v){return v*Math.PI/180}
function distanceM(a,b,c,d){const R=6371000,dl=rad(c-a),dn=rad(d-b),x=Math.sin(dl/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dn/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function valid(){return openNow()&&G.verified&&Date.now()-G.verifiedAt<=VERIFY_MAX_AGE_MS}
function errorText(e){if(e?.code===1)return'位置情報が許可されていません。端末の位置情報を許可してください。';if(e?.code===2)return'現在地を取得できませんでした。電波状況を確認してください。';if(e?.code===3)return'現在地の確認がタイムアウトしました。もう一度お試しください。';return'現在地を確認できませんでした。'}
function verify(){
  if(G.checking)return Promise.resolve(false);
  if(!openNow()){G.verified=false;G.verifiedAt=0;G.lastError='テスト受付は8:00〜18:00です。通常枠は9:30から受付できます。';return Promise.resolve(false)}
  if(!navigator.geolocation){G.lastError='この端末では位置情報を利用できません。';return Promise.resolve(false)}
  G.checking=true;G.lastError='';
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(pos=>{
    G.checking=false;
    const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude),acc=Math.max(0,Number(pos.coords.accuracy)||0),dist=distanceM(lat,lng,CENTER.lat,CENTER.lng);
    G.distance=dist;G.accuracy=acc;
    if(dist<=RADIUS_M&&acc<=200){G.verified=true;G.verifiedAt=Date.now();G.lastError='';resolve(true);return}
    G.verified=false;G.verifiedAt=0;
    if(acc>200){G.lastError=`GPS精度が十分ではありません（約${Math.round(acc)}m）。少し待って再確認してください。`;resolve(false);return}
    if(dist-acc<=RADIUS_M){G.lastError=`500m境界付近です（約${Math.round(dist)}m / 精度約${Math.round(acc)}m）。もう一度確認してください。`;resolve(false);return}
    G.lastError=`ASOBooNから約${Math.round(dist)}mです。現地受付は半径500m以内限定です。`;resolve(false);
  },e=>{G.checking=false;G.verified=false;G.verifiedAt=0;G.lastError=errorText(e);resolve(false)},{enableHighAccuracy:true,timeout:12000,maximumAge:10000}));
}

function bodyWaitTypeId(body){
  try{
    if(body instanceof URLSearchParams)return String(body.get('waitTypeId')||'');
    if(typeof body==='string')return String(new URLSearchParams(body).get('waitTypeId')||'');
    if(body&&typeof body==='object'&&'waitTypeId' in body)return String(body.waitTypeId||'');
  }catch{}
  return '';
}

function rememberCurrentReservation(){
  try{
    const rec=JSON.parse(localStorage.getItem(CURRENT_RESERVATION_KEY)||'null');
    if(!rec?.receiptNo||!rec?.reserveId)return;
    const key=receiptKey(rec.receiptNo);if(!key)return;
    const map=JSON.parse(localStorage.getItem(RESERVE_MAP_KEY)||'{}')||{};
    map[key]={reserveId:String(rec.reserveId),receiptNo:String(rec.receiptNo),waitTypeId:String(rec.waitTypeId||''),waitTypeName:String(rec.waitTypeName||''),operationalDay:String(rec.operationalDay||''),savedAt:Date.now()};
    const keys=Object.keys(map);
    if(keys.length>500){keys.sort((a,b)=>Number(map[a]?.savedAt||0)-Number(map[b]?.savedAt||0)).slice(0,keys.length-500).forEach(k=>delete map[k])}
    localStorage.setItem(RESERVE_MAP_KEY,JSON.stringify(map));
  }catch{}
}

function savePendingBridge(payload){try{localStorage.setItem(AUTO_BRIDGE_PENDING_KEY,JSON.stringify({...payload,queuedAt:Date.now()}))}catch{}}
function clearPendingBridge(payload){try{const x=JSON.parse(localStorage.getItem(AUTO_BRIDGE_PENDING_KEY)||'null');if(x&&String(x.reserveId||'')===String(payload.reserveId||''))localStorage.removeItem(AUTO_BRIDGE_PENDING_KEY)}catch{}}

async function postAutoBridge(payload){
  const body=new URLSearchParams({
    receiptNo:String(payload.receiptNo||''),
    reserveId:String(payload.reserveId||''),
    waitTypeId:String(payload.waitTypeId||''),
    waitTypeName:String(payload.waitTypeName||''),
    operationalDay:String(payload.operationalDay||todayJst()),
    source:'onsite-runtime-auto-v21'
  });
  try{
    await nativeFetch(AUTO_V20_GAS_URL,{method:'POST',mode:'no-cors',credentials:'omit',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body,cache:'no-store',keepalive:true});
    clearPendingBridge(payload);
    console.info('[AUTO v21] reserveId bridge sent',payload.receiptNo,payload.waitTypeId);
    return true;
  }catch(error){
    console.warn('[AUTO v21] reserveId bridge failed',error);
    return false;
  }
}

function queueAutoBridge(payload){
  if(!payload?.receiptNo||!/^\d{12}$/.test(String(payload.reserveId||''))||!payload?.waitTypeId)return;
  savePendingBridge(payload);
  setTimeout(()=>{postAutoBridge(payload)},0);
  setTimeout(()=>{postAutoBridge(payload)},2200);
}

function backfillCurrentReservation(){
  try{
    const rec=JSON.parse(localStorage.getItem(CURRENT_RESERVATION_KEY)||'null');
    if(!rec?.receiptNo||!rec?.reserveId||!rec?.waitTypeId)return;
    queueAutoBridge({
      receiptNo:String(rec.receiptNo),
      reserveId:String(rec.reserveId),
      waitTypeId:String(rec.waitTypeId),
      waitTypeName:String(rec.waitTypeName||''),
      operationalDay:String(rec.operationalDay||todayJst())
    });
    console.info('[AUTO v21] current reservation backfill queued',rec.receiptNo,rec.waitTypeId);
  }catch(error){console.warn('[AUTO v21] current reservation backfill failed',error)}
}

async function bridgeCreateResponse(response,body){
  try{
    if(!response?.ok)return;
    const d=await response.json();
    const ok=d?.success===true||String(d?.resultCode?.code??'')==='0000';
    const dto=d?.innerDto||{};
    if(!ok||dto.reserveId==null||dto.receiptNo==null)return;
    const waitTypeId=bodyWaitTypeId(body);
    if(!waitTypeId)return;
    queueAutoBridge({
      receiptNo:String(dto.receiptNo),
      reserveId:String(dto.reserveId),
      waitTypeId,
      waitTypeName:waitTypeId==='0042'?'テスト入場不可':'',
      operationalDay:todayJst()
    });
  }catch(error){console.warn('[AUTO v21] create response parse failed',error)}
}

function retryPendingBridge(){
  try{
    const p=JSON.parse(localStorage.getItem(AUTO_BRIDGE_PENDING_KEY)||'null');
    if(!p?.reserveId||!p?.receiptNo||!p?.waitTypeId)return;
    if(Date.now()-Number(p.queuedAt||0)>24*60*60*1000){localStorage.removeItem(AUTO_BRIDGE_PENDING_KEY);return}
    postAutoBridge(p);
  }catch{}
}

window.ASOBOON_ONSITE_GATE={CENTER,RADIUS_M,VERIFY_MAX_AGE_MS,state:G,verify,valid,openNow,normalOpenNow,testOpenMinutes:TEST_OPEN_MINUTES,normalOpenMinutes:NORMAL_OPEN_MINUTES};

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const isCreate=/\/reserve\/create(?:\?|$)/i.test(url);
  if(isCreate){
    if(!valid()){
      const err=new Error('現地受付は、ASOBooNから半径500m以内で現在地確認を完了してから確定してください。');err.code='ASOBOON_LOCATION_REQUIRED';throw err;
    }
    if(!normalOpenNow()){
      const id=bodyWaitTypeId(init.body);
      if(!id||!window.ASOBOON_ONSITE_TEST_IDS.has(id)){
        const err=new Error('9:30まではテスト枠のみ受付できます。');err.code='ASOBOON_TEST_ONLY_BEFORE_0930';throw err;
      }
    }
  }
  const isAirWait=/airwait\.jp|cl\.airwait\.jp/i.test(url);
  const attempts=isCreate?1:(isAirWait?2:1);
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);let abortForward;
    try{
      if(init.signal){if(init.signal.aborted)controller.abort();else{abortForward=()=>controller.abort();init.signal.addEventListener('abort',abortForward,{once:true})}}
      const response=await nativeFetch(input,{...init,signal:controller.signal});
      if(isCreate){
        try{void bridgeCreateResponse(response.clone(),init.body)}catch{}
        setTimeout(rememberCurrentReservation,100);
      }
      return response;
    }catch(error){lastError=error;if(attempt<attempts)await new Promise(r=>setTimeout(r,700))}
    finally{clearTimeout(timer);if(init.signal&&abortForward)init.signal.removeEventListener('abort',abortForward)}
  }
  throw lastError||new Error('通信に失敗しました');
};

rememberCurrentReservation();
backfillCurrentReservation();
retryPendingBridge();
setTimeout(backfillCurrentReservation,1200);
setInterval(rememberCurrentReservation,700);
setInterval(retryPendingBridge,15000);
})();