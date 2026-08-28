(()=>{
'use strict';

const CENTER={lat:35.84895,lng:139.74345};
const RADIUS_M=500;
const OPEN_HOUR=9;
const OPEN_MINUTE=30;
const VERIFY_MAX_AGE_MS=2*60*1000;
const MAX_ACCEPT_ACCURACY_M=200;
const CREATE_PATH='/external/stateless/reserve/create';
const $=id=>document.getElementById(id);

const G={verified:false,checking:false,distance:null,accuracy:null,verifiedAt:0,lastError:''};

// 他のRC3コードからも参照できる共通状態。
window.ASOBOON_LOCATION_GATE_STATE={required:true,allowed:false,verifiedAt:0,maxAgeMs:VERIFY_MAX_AGE_MS};

function jst(){
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date()).map(x=>[x.type,x.value]));
}
function isOpenTime(){
  const p=jst(),mins=Number(p.hour)*60+Number(p.minute);
  return mins>=OPEN_HOUR*60+OPEN_MINUTE;
}
function rad(v){return v*Math.PI/180}
function distanceM(lat1,lng1,lat2,lng2){
  const R=6371000,dLat=rad(lat2-lat1),dLng=rad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLng/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function syncGlobal(){
  const allowed=G.verified&&isOpenTime()&&Date.now()-G.verifiedAt<=VERIFY_MAX_AGE_MS;
  window.ASOBOON_LOCATION_GATE_STATE.allowed=allowed;
  window.ASOBOON_LOCATION_GATE_STATE.verifiedAt=G.verifiedAt||0;
  return allowed;
}
function stale(){return !syncGlobal()}
function hasReservationResult(){
  return ($('currentCard')&&!$('currentCard').hidden)||($('successCard')&&!$('successCard').hidden)||($('unknownCard')&&!$('unknownCard').hidden);
}
function status(text,kind='info'){
  const e=$('geoStatus');if(!e)return;
  e.className=`msg ${kind}`;e.textContent=text;e.hidden=false;
}
function applyGate(){
  const flow=$('flow');
  const check=$('geoCheck');
  const gate=$('geoGate');
  if(!flow||!gate)return;

  const allowed=syncGlobal();

  if(hasReservationResult()){
    gate.hidden=true;
    return;
  }
  gate.hidden=false;

  if(!isOpenTime()){
    G.verified=false;G.verifiedAt=0;syncGlobal();
    flow.hidden=true;
    if(check){check.disabled=true;check.textContent='9:30から現在地確認できます';}
    status('現地受付は9:30から開始します。9:30以降、ASOBooNから半径500m以内で予約できます。','warn');
    return;
  }

  if(check){
    check.disabled=G.checking;
    check.textContent=G.checking?'現在地を確認中…':(allowed?'✓ 現在地確認済み':'現在地を確認する');
  }

  // RC3本体が非同期処理でflowを再表示しても、位置確認前は必ず閉じる。
  flow.hidden=!allowed;

  if(allowed){
    const d=Math.round(G.distance||0),a=Math.round(G.accuracy||0);
    status(`✓ 現在地を確認しました（ASOBooNから約${d}m / GPS精度 約${a}m）。現地受付を利用できます。`,'ok');
  }else if(!G.checking&&!G.lastError){
    status('現地受付を利用するには現在地確認が必要です。ASOBooNから半径500m以内でのみ予約できます。','info');
  }
}
function geoErrorMessage(err){
  if(err&&err.code===1)return'位置情報が許可されていません。ブラウザの位置情報を許可して、もう一度お試しください。';
  if(err&&err.code===2)return'現在地を取得できませんでした。電波状況を確認して、もう一度お試しください。';
  if(err&&err.code===3)return'現在地の確認がタイムアウトしました。もう一度お試しください。';
  return'現在地を確認できませんでした。もう一度お試しください。';
}
function verifyLocation(){
  if(G.checking)return Promise.resolve(false);
  if(!isOpenTime()){applyGate();return Promise.resolve(false);}
  if(!navigator.geolocation){
    G.verified=false;G.verifiedAt=0;
    G.lastError='この端末では位置情報を利用できません。';
    status(G.lastError,'bad');applyGate();return Promise.resolve(false);
  }

  G.checking=true;G.verified=false;G.verifiedAt=0;G.lastError='';syncGlobal();applyGate();
  return new Promise(resolve=>{
    navigator.geolocation.getCurrentPosition(pos=>{
      G.checking=false;
      const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude),accuracy=Math.max(0,Number(pos.coords.accuracy)||0);
      const d=distanceM(lat,lng,CENTER.lat,CENTER.lng);
      G.distance=d;G.accuracy=accuracy;

      // 精度が粗い位置情報は500m判定に使わない。
      if(!Number.isFinite(accuracy)||accuracy>MAX_ACCEPT_ACCURACY_M){
        G.verified=false;G.verifiedAt=0;
        G.lastError=`位置情報の精度が十分ではありません（GPS精度 約${Math.round(accuracy||0)}m）。屋外や窓際などで、もう一度確認してください。`;
        status(G.lastError,'warn');applyGate();resolve(false);return;
      }

      // 誤差を含めても500m圏内と言える場合だけ許可する。
      if(d+accuracy<=RADIUS_M){
        G.verified=true;G.verifiedAt=Date.now();G.lastError='';
        syncGlobal();applyGate();resolve(true);return;
      }

      // 中心点は500m以内でも誤差円が境界を跨ぐ場合は再測位。
      if(d<=RADIUS_M||d-accuracy<=RADIUS_M){
        G.verified=false;G.verifiedAt=0;
        G.lastError=`500m境界付近のため現在地を確定できません（推定 約${Math.round(d)}m / GPS精度 約${Math.round(accuracy)}m）。少し待ってからもう一度確認してください。`;
        status(G.lastError,'warn');applyGate();resolve(false);return;
      }

      G.verified=false;G.verifiedAt=0;
      G.lastError=`現在地はASOBooNから約${Math.round(d)}mです。現地受付は半径500m以内でのみ利用できます。`;
      status(G.lastError,'bad');applyGate();resolve(false);
    },err=>{
      G.checking=false;G.verified=false;G.verifiedAt=0;G.lastError=geoErrorMessage(err);
      syncGlobal();status(G.lastError,'bad');applyGate();resolve(false);
    },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  });
}

// 最終防衛線：位置確認が通っていない状態ではAirWAITのreserve/create自体を送信しない。
const nativeFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  let url='';
  try{url=typeof input==='string'?input:String(input?.url||input||'')}catch{}
  if(url.includes(CREATE_PATH)&&stale()){
    G.verified=false;G.verifiedAt=0;syncGlobal();
    applyGate();
    status('予約確定には現在地確認が必要です。ASOBooNから半径500m以内で現在地を確認してください。','bad');
    return Promise.reject(new Error('現在地確認が完了していないため予約できません。'));
  }
  return nativeFetch(input,init);
};

function install(){
  const btn=$('geoCheck');if(btn)btn.addEventListener('click',verifyLocation);

  // 位置確認前・9:30前の操作はキャプチャ段階で止める。
  document.addEventListener('click',e=>{
    const target=e.target&&e.target.closest&&e.target.closest('#slotList [data-id],#reviewBtn,#modalConfirm');
    if(!target)return;
    if(!isOpenTime()||stale()){
      e.preventDefault();e.stopImmediatePropagation();
      if(isOpenTime()&&!G.checking)verifyLocation();
      else applyGate();
      return;
    }
  },true);

  // RC3本体がflowのhidden属性を書き換えても即座にゲートを再適用。
  const flow=$('flow');
  if(flow){
    new MutationObserver(()=>{
      if(!hasReservationResult()&&!syncGlobal()&&!flow.hidden)flow.hidden=true;
    }).observe(flow,{attributes:true,attributeFilter:['hidden']});
  }

  applyGate();
  setInterval(()=>{
    if(stale()&&G.verified){G.verified=false;G.verifiedAt=0;}
    applyGate();
  },5000);
  window.addEventListener('pageshow',()=>{G.verified=false;G.verifiedAt=0;syncGlobal();applyGate()});
  window.addEventListener('online',applyGate);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){
      if(stale()){G.verified=false;G.verifiedAt=0;syncGlobal();}
      applyGate();
    }
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
