/* ASOBooN reservation policy — production waitTypeId master.
 * 営業日判定は asoboon-calendar.js / 営業日カレンダーを正本にする。
 * 受付枠は名称・時刻で推測せず waitTypeId で固定判定する。
 * 営業日カレンダー取得不能時は誤表示を避けるため fail closed。
 */
(()=>{
'use strict';

const TIME_ZONE='Asia/Tokyo';
const CALENDAR_API='https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec';
const CACHE_MS=60*1000;
let cached=null,cachedAt=0,inflight=null,jsonpSeq=0;

const MODES=Object.freeze({
  '平日':Object.freeze({
    label:'平日',
    allowedWaitTypeIds:Object.freeze(['0023','0025'])
  }),
  '平日特定日':Object.freeze({
    label:'平日特定日',
    allowedWaitTypeIds:Object.freeze(['0035','0037'])
  }),
  '土日祝日':Object.freeze({
    label:'土日祝日',
    allowedWaitTypeIds:Object.freeze(['0029','0031','0033'])
  }),
  '休館':Object.freeze({
    label:'休館',
    allowedWaitTypeIds:Object.freeze([])
  })
});

/* 本番ミニアプリでは絶対に表示しない枠。
 * 0000 指定なし
 * 0022 ご待機者専用
 * 0024/0027 既存WEB平日（月曜例外を含む）
 * 0030/0032/0034 既存WEB整理券
 * 0036/0038 既存WEB平日特定日
 * 0041 オレンジパス
 * 0042 テスト
 */
const BLOCKED_IDS=Object.freeze([
  '0000','0022','0024','0027','0030','0032','0034','0036','0038','0041','0042'
]);
const BLOCKED_NAMES=Object.freeze(['テスト','ご待機者専用','待機者専用','WEB','オレンジパス']);

function norm(v){return String(v??'').normalize('NFKC').trim()}
function extractTime(value){
  const s=norm(value);let m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)/);
  if(m)return`${String(Number(m[1])).padStart(2,'0')}:${m[2]}`;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*([0-5]?\d)\s*分/);if(m)return`${String(Number(m[1])).padStart(2,'0')}:${String(Number(m[2])).padStart(2,'0')}`;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*半/);if(m)return`${String(Number(m[1])).padStart(2,'0')}:30`;
  m=s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時/);return m?`${String(Number(m[1])).padStart(2,'0')}:00`:'';
}

function normalizeShared(d){
  const type=norm(d?.businessType);
  if(!MODES[type])throw new Error('営業区分を取得できませんでした');
  return Object.freeze({
    ok:true,
    businessType:type,
    operationalDate:String(d?.operationalDate||''),
    isClosed:Boolean(d?.isClosed)||type==='休館',
    mode:MODES[type],
    source:'shared-calendar',
    raw:d
  });
}
function objects(payload){
  const out=[];const add=v=>{if(v&&typeof v==='object'&&!Array.isArray(v)&&!out.includes(v))out.push(v)};
  add(payload);
  const keys=['day','calendar','current','data','result','row','businessDay','operation','operational','settings','setting','config','today','business','schedule'];
  keys.forEach(k=>add(payload?.[k]));
  for(const parent of [...out])keys.forEach(k=>add(parent?.[k]));
  return out;
}
function valueFrom(payload,keys){
  for(const obj of objects(payload))for(const key of keys){
    const v=obj?.[key];
    if(v!==undefined&&v!==null&&String(v).trim()!=='')return v;
  }
  return undefined;
}
function normalizeBusinessType(payload){
  const raw=valueFrom(payload,['businessType','businessDayType','type','category','営業区分','営業日区分']);
  const s=norm(raw);
  if(MODES[s])return s;
  if(/休館|休業|closed/i.test(s))return'休館';
  if(/平日特定/.test(s))return'平日特定日';
  if(/土日|祝|2\.5|2時間30分/.test(s))return'土日祝日';
  if(/平日/.test(s))return'平日';
  throw new Error('営業区分を取得できませんでした');
}
function normalizeDay(payload){
  const businessType=normalizeBusinessType(payload);
  const operationalDate=String(valueFrom(payload,['operationalDate','businessDate','targetDate','運用日','営業日'])||'').trim();
  return Object.freeze({
    ok:true,
    businessType,
    operationalDate,
    isClosed:businessType==='休館',
    mode:MODES[businessType],
    source:'direct-calendar',
    raw:payload
  });
}

async function fetchJson(){
  const u=new URL(CALENDAR_API);
  u.searchParams.set('action','current');
  u.searchParams.set('_',String(Date.now()));
  const r=await fetch(u.toString(),{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'follow'});
  if(!r.ok)throw new Error(`営業日API HTTP ${r.status}`);
  return r.json();
}
function fetchJsonp(){
  return new Promise((resolve,reject)=>{
    const cb=`__asoboonReservationPolicy_${Date.now()}_${++jsonpSeq}`;
    const s=document.createElement('script');let settled=false;
    const done=(err,val)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      try{delete window[cb]}catch{window[cb]=undefined}
      s.remove();err?reject(err):resolve(val);
    };
    const timer=setTimeout(()=>done(new Error('営業日API timeout')),8000);
    window[cb]=v=>done(null,v);
    s.onerror=()=>done(new Error('営業日APIを読み込めませんでした'));
    const u=new URL(CALENDAR_API);
    u.searchParams.set('action','current');
    u.searchParams.set('callback',cb);
    u.searchParams.set('_',String(Date.now()));
    s.src=u.toString();s.async=true;document.head.appendChild(s);
  });
}
async function directCurrent(){
  try{return normalizeDay(await fetchJson())}
  catch(_){return normalizeDay(await fetchJsonp())}
}
async function requestCurrent(){
  let lastError=null;
  try{
    if(window.ASOBOON_CALENDAR?.getCurrent){
      return normalizeShared(await window.ASOBOON_CALENDAR.getCurrent({force:true}));
    }
  }catch(e){lastError=e}
  try{return await directCurrent()}catch(e){lastError=e}
  /* 月曜や平日特定日など例外日があるため曜日推測はしない。 */
  throw new Error(String(lastError?.message||'営業日カレンダーに接続できませんでした'));
}
async function getCurrentDay(options={}){
  const force=Boolean(options.force);
  if(!force&&cached&&Date.now()-cachedAt<CACHE_MS)return cached;
  if(inflight&&!force)return inflight;
  inflight=(async()=>{const d=await requestCurrent();cached=d;cachedAt=Date.now();return d})();
  try{return await inflight}finally{inflight=null}
}

function isBlocked(slot){
  const id=String(slot?.waitTypeId??'');
  const name=norm(slot?.waitTypeName??slot?.name??'');
  if(BLOCKED_IDS.includes(id))return true;
  return BLOCKED_NAMES.some(p=>name.includes(p));
}
function isAllowedSlot(slot,businessType){
  const type=norm(businessType),mode=MODES[type];
  if(!mode||type==='休館'||isBlocked(slot))return false;
  const id=String(slot?.waitTypeId??'');
  return mode.allowedWaitTypeIds.includes(id);
}
function allowedReason(slot,businessType){
  if(isAllowedSlot(slot,businessType))return'OK';
  if(isBlocked(slot))return'BLOCKED';
  if(norm(businessType)==='休館')return'CLOSED';
  return'WAIT_TYPE_ID_MISMATCH';
}

window.ASOBOON_RESERVATION_POLICY=Object.freeze({
  version:'2026-08-31-production-waittype-master-1',
  timezone:TIME_ZONE,
  calendarApiUrl:CALENDAR_API,
  modes:MODES,
  blockedWaitTypeIds:BLOCKED_IDS,
  blockedNamePatterns:BLOCKED_NAMES,
  businessDayCutoffHour:18,
  nextDayOpenHour:19,
  nextDayReservationVerified:false,
  extractTime,
  getCurrentDay,
  isAllowedSlot,
  allowedReason
});
})();