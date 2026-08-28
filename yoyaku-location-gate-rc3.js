(()=>{
'use strict';

const CENTER={lat:35.84895,lng:139.74345};
const RADIUS_M=500;
const OPEN_HOUR=9;
const OPEN_MINUTE=30;
const VERIFY_MAX_AGE_MS=2*60*1000;
const $=id=>document.getElementById(id);

const G={verified:false,checking:false,distance:null,accuracy:null,verifiedAt:0,lastError:''};

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

  if(hasReservationResult()){
    gate.hidden=true;
    return;
  }
  gate.hidden=false;

  if(!isOpenTime()){
    G.verified=false;
    flow.hidden=true;
    if(check){check.disabled=true;check.textContent='9:30から現在地確認できます';}
    status('現地受付は9:30から開始します。9:30以降、ASOBooNから半径500m以内で予約できます。','warn');
    return;
  }

  if(check){check.disabled=G.checking;check.textContent=G.checking?'現在地を確認中…':(G.verified?'✓ 現在地確認済み':'現在地を確認する');}
  flow.hidden=!G.verified;
  if(G.verified){
    const d=Math.round(G.distance||0),a=Math.round(G.accuracy||0);
    status(`✓ 現在地を確認しました（ASOBooNから約${d}m / GPS精度 約${a}m）。現地受付を利用できます。`,'ok');
  } else if(!G.checking&&!G.lastError){
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
    G.lastError='この端末では位置情報を利用できません。';
    status(G.lastError,'bad');applyGate();return Promise.resolve(false);
  }
  G.checking=true;G.lastError='';applyGate();
  return new Promise(resolve=>{
    navigator.geolocation.getCurrentPosition(pos=>{
      G.checking=false;
      const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude),accuracy=Math.max(0,Number(pos.coords.accuracy)||0);
      const d=distanceM(lat,lng,CENTER.lat,CENTER.lng);
      G.distance=d;G.accuracy=accuracy;

      if(d<=RADIUS_M){
        G.verified=true;G.verifiedAt=Date.now();G.lastError='';
        applyGate();resolve(true);return;
      }
      // GPS誤差円が500m境界に重なる場合は、外と断定せず再測位を促す。
      if(d-accuracy<=RADIUS_M){
        G.verified=false;G.verifiedAt=0;
        G.lastError=`現在地の精度が十分ではありません（推定 約${Math.round(d)}m / 精度 約${Math.round(accuracy)}m）。少し待ってからもう一度確認してください。`;
        status(G.lastError,'warn');applyGate();resolve(false);return;
      }
      G.verified=false;G.verifiedAt=0;
      G.lastError=`現在地はASOBooNから約${Math.round(d)}mです。現地受付は半径500m以内でのみ利用できます。`;
      status(G.lastError,'bad');applyGate();resolve(false);
    },err=>{
      G.checking=false;G.verified=false;G.verifiedAt=0;G.lastError=geoErrorMessage(err);
      status(G.lastError,'bad');applyGate();resolve(false);
    },{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
  });
}

function stale(){return !G.verified||Date.now()-G.verifiedAt>VERIFY_MAX_AGE_MS;}

function install(){
  const btn=$('geoCheck');if(btn)btn.addEventListener('click',verifyLocation);

  // 位置確認前・9:30前の操作はキャプチャ段階で止める。
  document.addEventListener('click',e=>{
    const target=e.target&&e.target.closest&&e.target.closest('#slotList [data-id],#reviewBtn,#modalConfirm');
    if(!target)return;
    if(!isOpenTime()||!G.verified){
      e.preventDefault();e.stopImmediatePropagation();
      if(isOpenTime()&&!G.checking)verifyLocation();
      else applyGate();
      return;
    }
    if(target.id==='modalConfirm'&&stale()){
      e.preventDefault();e.stopImmediatePropagation();
      G.verified=false;
      status('予約確定前に現在地を再確認します。','info');
      verifyLocation();
    }
  },true);

  applyGate();
  setInterval(applyGate,15000);
  window.addEventListener('pageshow',applyGate);
  window.addEventListener('online',applyGate);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)applyGate();});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();
