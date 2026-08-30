/* ASOBooN reservation policy — business-day aware slot filter.
 * 営業日判定は共通 asoboon-calendar.js を正本にする。
 * 取得不能時は誤判定しない曜日だけ安全フォールバックする。
 */
(()=>{
'use strict';

const TIME_ZONE='Asia/Tokyo';
const CALENDAR_API='https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec';
const CACHE_MS=60*1000;
let cached=null,cachedAt=0,inflight=null,jsonpSeq=0;

const MODES=Object.freeze({
  '平日':Object.freeze({label:'平日',includeNamePatterns:Object.freeze(['平日']),excludeNamePatterns:Object.freeze(['平日特定']),includeTimes:Object.freeze([])}),
  '平日特定日':Object.freeze({label:'平日特定日',includeNamePatterns:Object.freeze(['平日特定']),excludeNamePatterns:Object.freeze([]),includeTimes:Object.freeze(['10:00','13:30'])}),
  '土日祝日':Object.freeze({label:'土日祝日',includeNamePatterns:Object.freeze(['土日祝','土休日','2.5','2時間30分']),excludeNamePatterns:Object.freeze([]),includeTimes:Object.freeze(['10:00','12:30','15:00'])}),
  '休館':Object.freeze({label:'休館',includeNamePatterns:Object.freeze([]),excludeNamePatterns:Object.freeze([]),includeTimes:Object.freeze([])})
});
const BLOCKED_IDS=Object.freeze(['0042']);
const BLOCKED_NAMES=Object.freeze(['テスト','ご待機者専用','待機者専用','WEB']);

function norm(v){return String(v??'').normalize('NFKC').trim()}
function compact(v){return norm(v).replace(/\s+/g,'')}
function extractTime(value){
  const s=norm(value);let m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)/);
  if(m)return`${String(Number(m[1])).padStart(2,'0')}:${m[2]}`;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*([0-5]?\d)\s*分/);if(m)return`${String(Number(m[1])).padStart(2,'0')}:${String(Number(m[2])).padStart(2,'0')}`;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*半/);if(m)return`${String(Number(m[1])).padStart(2,'0')}:30`;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時/);return m?`${String(Number(m[1])).padStart(2,'0')}:00`:'';
}
function jstParts(){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(new Date()).map(x=>[x.type,x.value]))}
function safeWeekdayFallback(){
  const p=jstParts(),idx={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday];
  const operationalDate=`${p.year}-${p.month}-${p.day}`;
  if(idx===0||idx===1||idx===6)return Object.freeze({ok:true,businessType:'土日祝日',operationalDate,isClosed:false,mode:MODES['土日祝日'],source:'safe-weekday-fallback'});
  if(idx===2)return Object.freeze({ok:true,businessType:'休館',operationalDate,isClosed:true,mode:MODES['休館'],source:'safe-weekday-fallback'});
  return null;
}
function normalizeShared(d){
  const type=norm(d?.businessType);if(!MODES[type])throw new Error('営業区分を取得できませんでした');
  return Object.freeze({ok:true,businessType:type,operationalDate:String(d?.operationalDate||''),isClosed:Boolean(d?.isClosed)||type==='休館',mode:MODES[type],source:'shared-calendar',raw:d});
}
function objects(payload){const out=[];const add=v=>{if(v&&typeof v==='object'&&!Array.isArray(v)&&!out.includes(v))out.push(v)};add(payload);const keys=['day','calendar','current','data','result','row','businessDay','operation','operational','settings','setting','config','today','business','schedule'];keys.forEach(k=>add(payload?.[k]));for(const parent of [...out])keys.forEach(k=>add(parent?.[k]));return out}
function valueFrom(payload,keys){for(const obj of objects(payload))for(const key of keys){const v=obj?.[key];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v}return undefined}
function normalizeBusinessType(payload){const raw=valueFrom(payload,['businessType','businessDayType','type','category','営業区分','営業日区分']);const s=norm(raw);if(MODES[s])return s;if(/休館|休業|closed/i.test(s))return'休館';if(/平日特定/.test(s))return'平日特定日';if(/土日|祝|2\.5|2時間30分/.test(s))return'土日祝日';if(/平日/.test(s))return'平日';throw new Error('営業区分を取得できませんでした')}
function normalizeDay(payload){const businessType=normalizeBusinessType(payload);const operationalDate=String(valueFrom(payload,['operationalDate','businessDate','targetDate','運用日','営業日'])||'').trim();return Object.freeze({ok:true,businessType,operationalDate,isClosed:businessType==='休館',mode:MODES[businessType],source:'direct-calendar',raw:payload})}

async function fetchJson(){const u=new URL(CALENDAR_API);u.searchParams.set('action','current');u.searchParams.set('_',String(Date.now()));const r=await fetch(u.toString(),{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'follow'});if(!r.ok)throw new Error(`営業日API HTTP ${r.status}`);return r.json()}
function fetchJsonp(){return new Promise((resolve,reject)=>{const cb=`__asoboonReservationPolicy_${Date.now()}_${++jsonpSeq}`,s=document.createElement('script');let settled=false;const done=(err,val)=>{if(settled)return;settled=true;clearTimeout(timer);try{delete window[cb]}catch{window[cb]=undefined}s.remove();err?reject(err):resolve(val)};const timer=setTimeout(()=>done(new Error('営業日API timeout')),8000);window[cb]=v=>done(null,v);s.onerror=()=>done(new Error('営業日APIを読み込めませんでした'));const u=new URL(CALENDAR_API);u.searchParams.set('action','current');u.searchParams.set('callback',cb);u.searchParams.set('_',String(Date.now()));s.src=u.toString();s.async=true;document.head.appendChild(s)})}
async function directCurrent(){try{return normalizeDay(await fetchJson())}catch(_){return normalizeDay(await fetchJsonp())}}
async function requestCurrent(){
  let lastError=null;
  try{if(window.ASOBOON_CALENDAR?.getCurrent)return normalizeShared(await window.ASOBOON_CALENDAR.getCurrent({force:true}))}catch(e){lastError=e}
  try{return await directCurrent()}catch(e){lastError=e}
  const fallback=safeWeekdayFallback();if(fallback)return fallback;
  throw new Error(String(lastError?.message||'営業日カレンダーに接続できませんでした'));
}
async function getCurrentDay(options={}){const force=Boolean(options.force);if(!force&&cached&&Date.now()-cachedAt<CACHE_MS)return cached;if(inflight&&!force)return inflight;inflight=(async()=>{const d=await requestCurrent();cached=d;cachedAt=Date.now();return d})();try{return await inflight}finally{inflight=null}}

function isBlocked(slot){const id=String(slot?.waitTypeId??''),name=norm(slot?.waitTypeName??slot?.name??'');if(BLOCKED_IDS.includes(id))return true;return BLOCKED_NAMES.some(p=>name.includes(p))}
function isAllowedSlot(slot,businessType){const type=norm(businessType),mode=MODES[type];if(!mode||type==='休館'||isBlocked(slot))return false;const name=norm(slot?.waitTypeName??slot?.name??''),nameCompact=compact(name);if(!name)return false;if(mode.excludeNamePatterns.some(p=>nameCompact.includes(compact(p))))return false;if(!mode.includeNamePatterns.some(p=>nameCompact.includes(compact(p))))return false;if(mode.includeTimes.length){const time=extractTime(name);if(!time||!mode.includeTimes.includes(time))return false}return true}
function allowedReason(slot,businessType){if(isAllowedSlot(slot,businessType))return'OK';if(isBlocked(slot))return'BLOCKED';if(norm(businessType)==='休館')return'CLOSED';return'BUSINESS_TYPE_MISMATCH'}

window.ASOBOON_RESERVATION_POLICY=Object.freeze({version:'2026-08-30-business-calendar-2',timezone:TIME_ZONE,calendarApiUrl:CALENDAR_API,modes:MODES,blockedWaitTypeIds:BLOCKED_IDS,blockedNamePatterns:BLOCKED_NAMES,businessDayCutoffHour:18,nextDayOpenHour:19,nextDayReservationVerified:false,extractTime,getCurrentDay,isAllowedSlot,allowedReason});
})();