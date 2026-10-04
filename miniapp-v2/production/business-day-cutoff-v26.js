(()=>{'use strict';
const base=window.ASOBOON_V2_BUSINESS_DAY;
if(!base||typeof base.getByDate!=='function')return;
const TZ='Asia/Tokyo';
const CUTOFF_HOUR=19;
const CACHE_KEY='asoboon_miniapp_v2_business_day_v1';
const FRESH_CACHE_MS=30*60*1000;
const STALE_CACHE_MS=12*60*60*1000;
const PRIMARY_WAIT_MS=5600;
const JSONP_WAIT_MS=4200;
let lastGood=null,lastGoodAt=0,seq=0;
const pad=v=>String(v).padStart(2,'0');
const timeout=(ms,code='BUSINESS_DAY_REFRESH_TIMEOUT')=>new Promise((_,reject)=>setTimeout(()=>reject(Error(code)),ms));
function operationalDate(epoch=Date.now()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epoch)).map(x=>[x.type,x.value]));
  const dt=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+(Number(p.hour)>=CUTOFF_HOUR?1:0),12));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`;
}
function normalizeDate(value){
  if(typeof base.normalizeDate==='function')return base.normalizeDate(value);
  const s=String(value??'').normalize('NFKC').trim().replace(/\//g,'-'),m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return'';
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]),dt=new Date(Date.UTC(y,mo-1,d,12));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d)return'';
  return `${y}-${pad(mo)}-${pad(d)}`;
}
function normalizePayload(payload,date,source){
  if(!payload||payload.ok!==true)throw Error(String(payload?.message||payload?.error||payload?.code||'BUSINESS_DAY_UNAVAILABLE'));
  const type=String(payload.businessType||'').normalize('NFKC').trim(),rule=base.rules?.[type];
  if(!rule)throw Error(`BUSINESS_DAY_TYPE_INVALID:${type||'(empty)'}`);
  const returned=normalizeDate(payload.operationalDate||payload.calendarDate||date);
  if(returned!==date)throw Error('BUSINESS_DAY_DATE_MISMATCH');
  return Object.freeze({ok:true,version:String(base.version||'')+'+develop-cutoff19-v26',source,operationalDate:date,businessType:String(rule.businessType||type),isClosed:Boolean(rule.isClosed),durationMinutes:rule.durationMinutes,durationLabel:String(rule.durationLabel||''),closingTime:rule.closingTime??null,note:String(payload.note||''),weekday:String(payload.weekday||'')});
}
function readCache(date,maxAge){
  try{
    const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}'),v=x?.[date],savedAt=Number(v?.savedAt||0);
    if(!v||!savedAt||Date.now()-savedAt>maxAge)return null;
    return normalizePayload(v.payload,date,maxAge>FRESH_CACHE_MS?'develop-stale-cache':'develop-cache');
  }catch{return null}
}
function writeCache(date,payload){
  try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');x[date]={savedAt:Date.now(),payload};localStorage.setItem(CACHE_KEY,JSON.stringify(x))}catch{}
}
function remember(result){if(result?.ok){lastGood=result;lastGoodAt=Date.now()}return result}
function memoryFallback(date){return lastGood?.ok&&String(lastGood.operationalDate||'')===date&&Date.now()-lastGoodAt<=FRESH_CACHE_MS?Object.freeze({...lastGood,source:'develop-memory-fallback'}):null}
function fetchJsonp(date){
  return new Promise((resolve,reject)=>{
    const api=String(base.apiUrl||'').trim();if(!/^https:\/\//.test(api)){reject(Error('BUSINESS_DAY_JSONP_UNAVAILABLE'));return}
    const cb=`__asoboonV2DayRescue_${Date.now()}_${++seq}`,s=document.createElement('script');let done=false;
    const timer=setTimeout(()=>finish(Error('BUSINESS_DAY_JSONP_TIMEOUT')),JSONP_WAIT_MS);
    function finish(err,value){if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch{}try{s.remove()}catch{}err?reject(err):resolve(value)}
    window[cb]=value=>finish(null,value);s.onerror=()=>finish(Error('BUSINESS_DAY_JSONP_LOAD_ERROR'));
    const u=new URL(api);u.searchParams.set('action','current');u.searchParams.set('date',date);u.searchParams.set('callback',cb);u.searchParams.set('_',Date.now());s.src=u.toString();s.async=true;document.head.appendChild(s);
  });
}
async function rescue(date){
  const payload=await fetchJsonp(date),result=normalizePayload(payload,date,'develop-jsonp-rescue');writeCache(date,payload);return remember(result);
}
async function getByDate(value,options={}){
  const date=normalizeDate(value);if(!date)throw Error('BUSINESS_DAY_DATE_INVALID');
  const force=Boolean(options&&options.force);
  try{
    const result=await Promise.race([base.getByDate(date,{...options,force}),timeout(PRIMARY_WAIT_MS)]);
    return remember(result);
  }catch(primaryError){
    const mem=memoryFallback(date);if(mem)return mem;
    const fresh=readCache(date,FRESH_CACHE_MS);if(fresh)return remember(fresh);
    try{return await rescue(date)}catch(rescueError){
      const stale=readCache(date,STALE_CACHE_MS);if(stale)return remember(stale);
      const err=Error('BUSINESS_DAY_REFRESH_TIMEOUT');err.cause={primaryError,rescueError};throw err;
    }
  }
}
async function getCurrent(options={}){return getByDate(operationalDate(),options)}
window.ASOBOON_V2_BUSINESS_DAY=Object.freeze({...base,version:String(base.version||'')+'+develop-cutoff19-v26',cutoffHour:CUTOFF_HOUR,operationalDate,getCurrent,getByDate});
})();