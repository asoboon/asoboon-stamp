/* ASOBooN 新ミニアプリ AirWAIT client */
(()=>{
'use strict';
const LEGACY=()=>window.ASOBOON_RECEPTION_CONFIG||{};
const ENDPOINTS=Object.freeze({
  waitTypes:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/wait/type/get',
  create:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',
  waitInfo:'https://airwait.jp/WCSP/api/20160600/external/stateless/store/getWaitInfo'
});
function resultCode(d){return String(d?.resultCode?.code??'')}
function ok(d){return d?.success===true||resultCode(d)==='0000'}
function requireConfig(){
  const c=LEGACY();
  const key=String(c.airwaitApiKey||'');
  const storeId=String(c.airwaitStoreId||'');
  if(!key||!storeId)throw new Error('AirWAITの接続設定がありません。');
  return{key,storeId}
}
function makeAirwaitError(d,fallback='AirWAITで処理できませんでした。'){
  const code=resultCode(d)||'UNKNOWN';
  const err=new Error(friendlyError(d)||fallback);
  err.name='AirwaitError';
  err.code=code;
  err.airwaitMessage=String(d?.resultCode?.defaultMessage||'');
  err.validationResults=Array.isArray(d?.validationResults)?d.validationResults:[];
  return err
}
async function post(url,body){
  const {key}=requireConfig();
  const res=await fetch(`${url}?key=${encodeURIComponent(key)}`,{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
    body:new URLSearchParams(body),
    cache:'no-store',
    credentials:'omit'
  });
  let d;
  try{d=await res.json()}
  catch{
    const err=new Error(`AirWAITから正常な応答を受け取れませんでした（HTTP ${res.status}）`);
    err.name='AirwaitTransportError';
    err.httpStatus=res.status;
    throw err
  }
  if(!res.ok){
    const err=makeAirwaitError(d,`AirWAITに接続できませんでした（HTTP ${res.status}）`);
    err.httpStatus=res.status;
    throw err
  }
  return d
}
async function getWaitTypes(){
  const {storeId}=requireConfig();
  const d=await post(ENDPOINTS.waitTypes,{storeId});
  if(!ok(d))throw makeAirwaitError(d,'受付枠を取得できませんでした。');
  return Array.isArray(d?.innerDto?.waitTypeList)?d.innerDto.waitTypeList:[]
}
async function getWaitInfo(){
  const {key,storeId}=requireConfig();
  const u=new URL(ENDPOINTS.waitInfo);
  u.searchParams.set('key',key);
  u.searchParams.set('storeId',storeId);
  const res=await fetch(u.toString(),{cache:'no-store',credentials:'omit'});
  let d;
  try{d=await res.json()}
  catch{throw new Error('残り人数を取得できませんでした。')}
  if(!res.ok||!ok(d))throw makeAirwaitError(d,'残り人数を取得できませんでした。');
  return d?.innerDto?.stores?.[0]||null
}
function friendlyError(d){
  const code=resultCode(d);
  const map={
    '1000':'入力内容に誤りがあります。',
    '3509':'指定されたプリンタが見つかりません。',
    '3527':'本日の発券はできません。',
    '3528':'本日の利用を停止しています。',
    '3532':'人数が上限を超えています。',
    '3537':'本日の受付は終了しています。',
    '3539':'許可されていない操作です。AirWAIT側で予約登録権限をご確認ください。',
    '3557':'受付時間外です。',
    '3558':'選択した回は受付時間外です。',
    '3593':'受付人数が、この回の受付可能な最小人数を下回っています。'
  };
  return map[code]||d?.resultCode?.defaultMessage||'受付できませんでした。'
}
async function createReservation({adults,paidChildren,infants,waitTypeId}){
  const {storeId}=requireConfig();
  const d=await post(ENDPOINTS.create,{
    storeId,
    numPerson:String(adults),
    numPersonChild:String(Number(paidChildren||0)+Number(infants||0)),
    waitTypeId:String(waitTypeId),
    langType:'KeyJPN',
    autoPrintFlg:'false'
  });
  if(!ok(d))throw makeAirwaitError(d,'受付できませんでした。');
  const dto=d?.innerDto||{};
  if(dto.reserveId==null||dto.receiptNo==null)throw new Error('受付番号を取得できませんでした。');
  return{
    reserveId:String(dto.reserveId),
    receiptNo:String(dto.receiptNo),
    shortUrl:dto.shortUrl?String(dto.shortUrl):''
  }
}
window.ASOBOON_AIRWAIT=Object.freeze({
  endpoints:ENDPOINTS,
  resultCode,
  ok,
  getWaitTypes,
  getWaitInfo,
  createReservation
});
})();
