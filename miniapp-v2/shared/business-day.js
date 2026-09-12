/* ASOBooN LINE MINI App v2 / isolated business-day engine */
(()=>{'use strict';
const VERSION='1.1.0-worker-cache';
const E=window.ASOBOON_V2_ENV||{};
const API_URL='https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec';
const TIME_ZONE='Asia/Tokyo';
const CUTOFF_HOUR=18;
const CACHE_KEY='asoboon_miniapp_v2_business_day_v1';
const CACHE_MS=30*60*1000;
const RULES=Object.freeze({
  '平日':Object.freeze({businessType:'平日',isClosed:false,durationMinutes:0,durationLabel:'時間制限なし',closingTime:'17:00'}),
  '平日特定日':Object.freeze({businessType:'平日特定日',isClosed:false,durationMinutes:180,durationLabel:'3時間',closingTime:'17:00'}),
  '土日祝日':Object.freeze({businessType:'土日祝日',isClosed:false,durationMinutes:150,durationLabel:'2時間30分',closingTime:'18:00'}),
  '休館':Object.freeze({businessType:'休館',isClosed:true,durationMinutes:null,durationLabel:'休館日',closingTime:null})
});
const inflight=new Map();let seq=0;
const pad=v=>String(v).padStart(2,'0');
function normalizeDate(value){const s=String(value??'').normalize('NFKC').trim().replace(/\//g,'-');const m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return'';const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(Date.UTC(y,mo-1,d,12));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d)return'';return`${y}-${pad(mo)}-${pad(d)}`}
function operationalDate(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));const dt=new Date(Date.UTC(+p.year,+p.month-1,+p.day+(+p.hour>=CUTOFF_HOUR?1:0),12));return`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`}
function normalize(payload,requested,source='api'){if(!payload||payload.ok!==true)throw Error(String(payload?.message||payload?.error||payload?.code||'営業区分を取得できませんでした。'));const type=String(payload.businessType||'').normalize('NFKC').trim(),rule=RULES[type];if(!rule)throw Error(`未対応の営業区分です: ${type||'(空欄)'}`);const date=normalizeDate(payload.operationalDate||payload.calendarDate||requested);if(!date||date!==requested)throw Error('営業カレンダーの日付が一致しません。');return Object.freeze({ok:true,version:VERSION,source,operationalDate:date,businessType:rule.businessType,isClosed:rule.isClosed,durationMinutes:rule.durationMinutes,durationLabel:rule.durationLabel,closingTime:rule.closingTime,note:String(payload.note||''),weekday:String(payload.weekday||'')})}
function readCache(date){try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}'),v=x?.[date];if(!v||Date.now()-Number(v.savedAt||0)>CACHE_MS)return null;return normalize(v.payload,date,'cache')}catch{return null}}
function writeCache(date,payload){try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');x[date]={savedAt:Date.now(),payload};localStorage.setItem(CACHE_KEY,JSON.stringify(x))}catch{}}
async function fetchGateway(date){if(!E.backendUrl||!/^https:\/\//.test(String(E.backendUrl)))throw Error('gateway unavailable');const u=new URL(E.backendUrl);u.searchParams.set('action','businessDay');u.searchParams.set('date',date);u.searchParams.set('_',Date.now());const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6000);try{const r=await fetch(u,{cache:'no-store',credentials:'omit',signal:ctrl.signal,headers:{Accept:'application/json'}});if(!r.ok)throw Error(`営業カレンダーGateway HTTP ${r.status}`);const d=await r.json();if(d?.ok!==true)throw Error(String(d?.error||'営業カレンダーGateway error'));return d}finally{clearTimeout(timer)}}
async function fetchCors(date){const u=new URL(API_URL);u.searchParams.set('action','current');u.searchParams.set('date',date);u.searchParams.set('_',Date.now());const r=await fetch(u,{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error(`営業カレンダー HTTP ${r.status}`);return r.json()}
function fetchJsonp(date){return new Promise((resolve,reject)=>{const cb=`__asoboonV2Day_${Date.now()}_${++seq}`,s=document.createElement('script');let done=false;const timer=setTimeout(()=>finish(Error('営業カレンダー timeout')),8000);function finish(e,v){if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch{}s.remove();e?reject(e):resolve(v)}window[cb]=v=>finish(null,v);s.onerror=()=>finish(Error('営業カレンダーを読み込めませんでした。'));const u=new URL(API_URL);u.searchParams.set('action','current');u.searchParams.set('date',date);u.searchParams.set('callback',cb);u.searchParams.set('_',Date.now());s.src=u;s.async=true;document.head.appendChild(s)})}
async function request(date){try{return await fetchGateway(date)}catch(gatewayError){try{return await fetchCors(date)}catch(first){try{return await fetchJsonp(date)}catch(second){const e=Error('営業カレンダーに接続できませんでした。');e.cause={gatewayError,first,second};throw e}}}}
async function getByDate(value,{force=false}={}){const date=normalizeDate(value);if(!date)throw Error('日付形式が不正です。');if(!force){const cached=readCache(date);if(cached)return cached;if(inflight.has(date))return inflight.get(date)}const job=(async()=>{const payload=await request(date),result=normalize(payload,date,String(payload?.source||'api'));writeCache(date,payload);return result})();inflight.set(date,job);try{return await job}finally{inflight.delete(date)}}
function getCurrent(options={}){return getByDate(operationalDate(),options)}
window.ASOBOON_V2_BUSINESS_DAY=Object.freeze({version:VERSION,apiUrl:API_URL,timeZone:TIME_ZONE,cutoffHour:CUTOFF_HOUR,rules:RULES,normalizeDate,operationalDate,getByDate,getCurrent});
})();
