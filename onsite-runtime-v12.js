(()=>{
'use strict';
const nativeFetch=window.fetch.bind(window);
const CENTER={lat:35.84895,lng:139.74345};
const RADIUS_M=500;
const VERIFY_MAX_AGE_MS=2*60*1000;
const OPEN_MINUTES=9*60+30;
const G={verified:false,verifiedAt:0,distance:null,accuracy:null,checking:false,lastError:''};

function jstParts(){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]))}
function openNow(){const p=jstParts(),m=Number(p.hour)*60+Number(p.minute);return m>=OPEN_MINUTES&&m<18*60}
function rad(v){return v*Math.PI/180}
function distanceM(a,b,c,d){const R=6371000,dl=rad(c-a),dn=rad(d-b),x=Math.sin(dl/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dn/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function valid(){return openNow()&&G.verified&&Date.now()-G.verifiedAt<=VERIFY_MAX_AGE_MS}
function errorText(e){if(e?.code===1)return'位置情報が許可されていません。端末の位置情報を許可してください。';if(e?.code===2)return'現在地を取得できませんでした。電波状況を確認してください。';if(e?.code===3)return'現在地の確認がタイムアウトしました。もう一度お試しください。';return'現在地を確認できませんでした。';}
function verify(){
  if(G.checking)return Promise.resolve(false);
  if(!openNow()){G.verified=false;G.verifiedAt=0;G.lastError='現地受付は9:30〜18:00です。';return Promise.resolve(false)}
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

window.ASOBOON_ONSITE_GATE={CENTER,RADIUS_M,VERIFY_MAX_AGE_MS,state:G,verify,valid,openNow};

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:String(input?.url||'');
  const isCreate=/\/reserve\/create(?:\?|$)/i.test(url);
  if(isCreate&&!valid()){
    const err=new Error('現地受付は、ASOBooNから半径500m以内で現在地確認を完了してから確定してください。');
    err.code='ASOBOON_LOCATION_REQUIRED';
    throw err;
  }
  const isAirWait=/airwait\.jp|cl\.airwait\.jp/i.test(url);
  const attempts=isAirWait?2:1;
  let lastError;
  for(let attempt=1;attempt<=attempts;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    let abortForward;
    try{
      if(init.signal){if(init.signal.aborted)controller.abort();else{abortForward=()=>controller.abort();init.signal.addEventListener('abort',abortForward,{once:true})}}
      return await nativeFetch(input,{...init,signal:controller.signal});
    }catch(error){lastError=error;if(attempt<attempts&&!isCreate)await new Promise(r=>setTimeout(r,700));else if(attempt<attempts&&error?.code!=='ASOBOON_LOCATION_REQUIRED')await new Promise(r=>setTimeout(r,700));}
    finally{clearTimeout(timer);if(init.signal&&abortForward)init.signal.removeEventListener('abort',abortForward)}
  }
  throw lastError||new Error('通信に失敗しました');
};
})();
