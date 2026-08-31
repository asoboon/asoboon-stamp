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
function requireConfig(){const c=LEGACY();const key=String(c.airwaitApiKey||'');const storeId=String(c.airwaitStoreId||'');if(!key||!storeId)throw new Error('AirWAITの接続設定がありません。');return{key,storeId}}
async function post(url,body){const {key}=requireConfig();const res=await fetch(`${url}?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams(body),cache:'no-store',credentials:'omit'});let d;try{d=await res.json()}catch{throw new Error(`AirWAITから正常な応答を受け取れませんでした（HTTP ${res.status}）`)}if(!res.ok)throw new Error(`AirWAITに接続できませんでした（HTTP ${res.status}）`);return d}
async function getWaitTypes(){const {storeId}=requireConfig();const d=await post(ENDPOINTS.waitTypes,{storeId});if(!ok(d))throw new Error(d?.resultCode?.defaultMessage||'受付枠を取得できませんでした。');return Array.isArray(d?.innerDto?.waitTypeList)?d.innerDto.waitTypeList:[]}
async function getWaitInfo(){const {key,storeId}=requireConfig();const u=new URL(ENDPOINTS.waitInfo);u.searchParams.set('key',key);u.searchParams.set('storeId',storeId);const res=await fetch(u.toString(),{cache:'no-store',credentials:'omit'});let d;try{d=await res.json()}catch{throw new Error('残り人数を取得できませんでした。')}if(!res.ok||!ok(d))throw new Error(d?.resultCode?.defaultMessage||'残り人数を取得できませんでした。');return d?.innerDto?.stores?.[0]||null}
function friendlyError(d){const code=resultCode(d);const map={'3527':'本日の発券上限に達しています。','3528':'本日の受付は停止しています。','3532':'この人数では受付できません。人数をご確認ください。','3537':'本日の受付は終了しています。','3539':'現在この受付を利用できません。スタッフへお声がけください。','3557':'現在は受付時間外です。','3558':'選択した回は現在受付時間外です。別の回をご確認ください。','3593':'受付人数がこの回の条件に合いません。'};return map[code]||d?.resultCode?.defaultMessage||'受付できませんでした。'}
async function createReservation({adults,paidChildren,infants,waitTypeId}){const {storeId}=requireConfig();const d=await post(ENDPOINTS.create,{storeId,numPerson:String(adults),numPersonChild:String(Number(paidChildren||0)+Number(infants||0)),waitTypeId:String(waitTypeId),langType:'KeyJPN',autoPrintFlg:'false'});if(!ok(d))throw new Error(friendlyError(d));const dto=d?.innerDto||{};if(dto.reserveId==null||dto.receiptNo==null)throw new Error('受付番号を取得できませんでした。');return{reserveId:String(dto.reserveId),receiptNo:String(dto.receiptNo),shortUrl:dto.shortUrl?String(dto.shortUrl):''}}
window.ASOBOON_AIRWAIT=Object.freeze({endpoints:ENDPOINTS,resultCode,ok,getWaitTypes,getWaitInfo,createReservation});
})();
