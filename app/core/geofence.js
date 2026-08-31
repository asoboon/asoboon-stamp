/* ASOBooN 新ミニアプリ 現地受付ジオフェンス */
(()=>{
'use strict';
const STORAGE_KEY='asoboon_v2_geofence_session';
const C=()=>window.ASOBOON_APP_CONFIG?.geofence||{};
const state={verified:false,verifiedAt:0,distanceM:null,accuracyM:null,checking:false,error:''};
const rad=v=>v*Math.PI/180;
function distanceM(a,b,c,d){const R=6371000,dl=rad(c-a),dn=rad(d-b),x=Math.sin(dl/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dn/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function restore(){try{const x=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');if(!x)return;state.verified=Boolean(x.verified);state.verifiedAt=Number(x.verifiedAt||0);state.distanceM=Number.isFinite(Number(x.distanceM))?Number(x.distanceM):null;state.accuracyM=Number.isFinite(Number(x.accuracyM))?Number(x.accuracyM):null}catch{}}
function persist(){try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify({verified:state.verified,verifiedAt:state.verifiedAt,distanceM:state.distanceM,accuracyM:state.accuracyM}))}catch{}}
function clear(){state.verified=false;state.verifiedAt=0;state.distanceM=null;state.accuracyM=null;state.error='';try{sessionStorage.removeItem(STORAGE_KEY)}catch{}}
function valid(){const c=C();const ok=state.verified&&Date.now()-state.verifiedAt<=Number(c.verifyMaxAgeMs||120000);if(!ok&&state.verified)clear();return ok}
function errorText(e){if(e?.code===1)return'位置情報が許可されていません。端末の位置情報を許可してください。';if(e?.code===2)return'現在地を取得できませんでした。電波状況を確認してください。';if(e?.code===3)return'現在地の確認がタイムアウトしました。もう一度お試しください。';return'現在地を確認できませんでした。'}
function verify(){
  if(state.checking)return Promise.resolve(false);
  if(valid())return Promise.resolve(true);
  if(!navigator.geolocation){state.error='この端末では位置情報を利用できません。';return Promise.resolve(false)}
  const c=C();state.checking=true;state.error='';
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(pos=>{
    state.checking=false;
    const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude),acc=Math.max(0,Number(pos.coords.accuracy)||0),dist=distanceM(lat,lng,Number(c.lat),Number(c.lng));
    state.distanceM=dist;state.accuracyM=acc;
    if(dist<=Number(c.radiusM||500)&&acc<=Number(c.maxAccuracyM||200)){
      state.verified=true;state.verifiedAt=Date.now();persist();resolve(true);return;
    }
    state.verified=false;state.verifiedAt=0;persist();
    if(acc>Number(c.maxAccuracyM||200)){state.error=`GPS精度が十分ではありません（約${Math.round(acc)}m）。少し待って再確認してください。`;resolve(false);return}
    if(dist-acc<=Number(c.radiusM||500)){state.error=`500m境界付近です（約${Math.round(dist)}m / 精度約${Math.round(acc)}m）。もう一度確認してください。`;resolve(false);return}
    state.error=`ASOBooNから約${Math.round(dist)}mです。現地受付は半径${Number(c.radiusM||500)}m以内限定です。`;resolve(false);
  },e=>{state.checking=false;state.verified=false;state.verifiedAt=0;state.error=errorText(e);persist();resolve(false)},{enableHighAccuracy:true,timeout:12000,maximumAge:10000}))
}
restore();valid();
window.ASOBOON_GEOFENCE=Object.freeze({state,verify,valid,clear,distanceM});
})();
