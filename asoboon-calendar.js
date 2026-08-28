/* ASOBooN shared business-day / operational settings client.
 * Source of truth: Google Apps Script web app backed by 営業日カレンダー / 運用設定.
 * Explicit values returned by the backend always win; weekday rules are fallback only.
 */
(()=>{
  'use strict';

  const API_URL='https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec';
  const TIME_ZONE='Asia/Tokyo';
  const CUTOFF_HOUR=18;
  const CACHE_MS=60*1000;

  const RULES=Object.freeze({
    '休館':Object.freeze({businessType:'休館',isClosed:true,duration:null,durationLabel:'休館日',closingTime:null}),
    '平日':Object.freeze({businessType:'平日',isClosed:false,duration:0,durationLabel:'時間制限なし',closingTime:'17:00'}),
    '土日祝日':Object.freeze({businessType:'土日祝日',isClosed:false,duration:150,durationLabel:'2時間30分',closingTime:'18:00'}),
    '平日特定日':Object.freeze({businessType:'平日特定日',isClosed:false,duration:180,durationLabel:'3時間',closingTime:'17:00'})
  });

  let cached=null;
  let cachedAt=0;
  let inflight=null;
  let jsonpSeq=0;

  const pad=n=>String(n).padStart(2,'0');

  function jstParts(date=new Date()){
    return Object.fromEntries(
      new Intl.DateTimeFormat('en-CA',{
        timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
      }).formatToParts(date).map(x=>[x.type,x.value])
    );
  }

  function addDays(ymd,days){
    const [y,m,d]=String(ymd).split('-').map(Number);
    const x=new Date(Date.UTC(y,m-1,d+Number(days||0),12,0,0));
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth()+1)}-${pad(x.getUTCDate())}`;
  }

  function getCalendarDate(date=new Date()){
    const p=jstParts(date);
    return `${p.year}-${p.month}-${p.day}`;
  }

  function getOperationalDate(date=new Date()){
    const p=jstParts(date);
    const calendarDate=`${p.year}-${p.month}-${p.day}`;
    return Number(p.hour)>=CUTOFF_HOUR?addDays(calendarDate,1):calendarDate;
  }

  function pick(obj,keys){
    if(!obj||typeof obj!=='object') return undefined;
    for(const key of keys){
      const value=obj[key];
      if(value!==undefined&&value!==null&&String(value).trim()!=='') return value;
    }
    return undefined;
  }

  function candidateObjects(payload){
    const out=[];
    const add=v=>{if(v&&typeof v==='object'&&!Array.isArray(v)&&!out.includes(v)) out.push(v)};
    add(payload);
    const keys=['day','calendar','current','data','result','row','businessDay','operation','operational','settings','setting','config','today','business','schedule'];
    keys.forEach(k=>add(payload?.[k]));
    for(const parent of [...out]) keys.forEach(k=>add(parent?.[k]));
    return out;
  }

  function valueFrom(payload,keys){
    for(const obj of candidateObjects(payload)){
      const value=pick(obj,keys);
      if(value!==undefined) return value;
    }
    return undefined;
  }

  function extractBusinessType(payload){
    const value=valueFrom(payload,['businessType','businessDayType','type','category','営業区分','営業日区分']);
    if(value===undefined) return '';
    const normalized=String(value).trim();
    if(RULES[normalized]) return normalized;
    if(/休館|休業|closed/i.test(normalized)) return '休館';
    if(/平日特定/.test(normalized)) return '平日特定日';
    if(/土日|祝|2\.5|2時間30分/.test(normalized)) return '土日祝日';
    if(/平日/.test(normalized)) return '平日';
    return '';
  }

  function extractDate(payload,keys){
    const value=valueFrom(payload,keys);
    if(value!==undefined&&/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) return String(value).trim();
    return '';
  }

  function parseBoolean(value){
    if(typeof value==='boolean') return value;
    const s=String(value??'').trim().toLowerCase();
    if(['1','true','yes','on','closed','休館','休業'].includes(s)) return true;
    if(['0','false','no','off','open','営業'].includes(s)) return false;
    return null;
  }

  function parseDuration(value){
    if(value===undefined||value===null||value==='') return null;
    if(typeof value==='number'&&Number.isFinite(value)) return Math.max(0,Math.round(value));
    const s=String(value).normalize('NFKC').trim();
    if(/無制限|制限なし|フリー|unlimited/i.test(s)) return 0;
    if(/^\d+(?:\.\d+)?$/.test(s)) return Math.max(0,Math.round(Number(s)));
    let m=s.match(/(\d+(?:\.\d+)?)\s*(?:h|時間)/i);
    if(m){
      const hours=Number(m[1]);
      const mm=s.match(/(\d+)\s*分/);
      return Math.round(hours*60+(mm?Number(mm[1]):0));
    }
    m=s.match(/(\d+)\s*分/);
    return m?Math.max(0,Number(m[1])):null;
  }

  function parseClock(value){
    if(value===undefined||value===null||value==='') return '';
    if(value instanceof Date&&!Number.isNaN(value.getTime())) return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    if(typeof value==='number'&&Number.isFinite(value)){
      const n=Math.round(value);
      if(n>=0&&n<=24) return `${pad(n)}:00`;
      if(n>=0&&n<24*60) return `${pad(Math.floor(n/60))}:${pad(n%60)}`;
    }
    const s=String(value).normalize('NFKC').trim();
    let m=s.match(/(?:^|\D)([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)(?:\D|$)/);
    if(m) return `${pad(Number(m[1]))}:${m[2]}`;
    m=s.match(/(?:^|\D)([01]?\d|2[0-3])\s*時\s*([0-5]?\d)?\s*分?/);
    if(m) return `${pad(Number(m[1]))}:${pad(Number(m[2]||0))}`;
    return '';
  }

  function durationLabel(minutes,explicit){
    if(explicit!==undefined&&explicit!==null&&String(explicit).trim()!=='') return String(explicit).trim();
    if(minutes===null) return '休館日';
    if(minutes===0) return '時間制限なし';
    if(minutes%60===0) return `${minutes/60}時間`;
    const h=Math.floor(minutes/60),m=minutes%60;
    return h?`${h}時間${m}分`:`${m}分`;
  }

  function normalize(payload){
    const businessType=extractBusinessType(payload);
    if(!businessType) throw new Error('営業区分を取得できませんでした');
    const fallback=RULES[businessType];
    const operationalDate=extractDate(payload,['operationalDate','businessDate','targetDate','運用日','営業日'])||getOperationalDate();
    const calendarDate=extractDate(payload,['calendarDate','date','日付'])||getCalendarDate();

    const closedRaw=valueFrom(payload,['isClosed','closed','isHoliday','休館','休館日']);
    const parsedClosed=parseBoolean(closedRaw);
    const isClosed=parsedClosed===null?fallback.isClosed:parsedClosed;

    const durationRaw=valueFrom(payload,['duration','durationMinutes','playMinutes','playTimeMinutes','useMinutes','usageMinutes','利用時間分','利用時間','滞在時間']);
    const parsedDuration=parseDuration(durationRaw);
    const duration=isClosed?null:(parsedDuration===null?fallback.duration:parsedDuration);

    const closingRaw=valueFrom(payload,['closingTime','closeTime','businessCloseTime','endTime','close','closing','閉館時刻','閉館時間','営業終了時刻','営業終了']);
    const parsedClosing=parseClock(closingRaw);
    const closingTime=isClosed?null:(parsedClosing||fallback.closingTime);

    const explicitLabel=valueFrom(payload,['durationLabel','playTimeLabel','利用時間表示','利用時間ラベル']);

    return Object.freeze({
      ok:true,
      source:'operational-settings-api',
      businessType,
      operationalDate,
      calendarDate,
      cutoff:'18:00',
      isClosed,
      duration,
      durationLabel:durationLabel(duration,explicitLabel),
      closingTime,
      raw:payload
    });
  }

  async function fetchJson(){
    const url=new URL(API_URL);
    url.searchParams.set('action','current');
    url.searchParams.set('_',String(Date.now()));
    const res=await fetch(url.toString(),{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'follow'});
    if(!res.ok) throw new Error(`営業日API HTTP ${res.status}`);
    return res.json();
  }

  function fetchJsonp(){
    return new Promise((resolve,reject)=>{
      const cb=`__asoboonCalendarJsonp_${Date.now()}_${++jsonpSeq}`;
      const script=document.createElement('script');
      const timer=setTimeout(()=>cleanup(new Error('営業日API timeout')),8000);
      function cleanup(error,value){
        clearTimeout(timer);
        try{delete window[cb]}catch{window[cb]=undefined}
        script.remove();
        if(error) reject(error); else resolve(value);
      }
      window[cb]=value=>cleanup(null,value);
      script.onerror=()=>cleanup(new Error('営業日APIを読み込めませんでした'));
      const url=new URL(API_URL);
      url.searchParams.set('action','current');
      url.searchParams.set('callback',cb);
      url.searchParams.set('_',String(Date.now()));
      script.src=url.toString();
      script.async=true;
      document.head.appendChild(script);
    });
  }

  async function requestCurrent(){
    try{return await fetchJson()}
    catch(fetchError){
      try{return await fetchJsonp()}
      catch(jsonpError){
        const error=new Error('営業日カレンダーに接続できませんでした');
        error.cause={fetchError,jsonpError};
        throw error;
      }
    }
  }

  async function getCurrent(options={}){
    const force=Boolean(options.force);
    if(!force&&cached&&Date.now()-cachedAt<CACHE_MS) return cached;
    if(inflight&&!force) return inflight;
    inflight=(async()=>{
      const payload=await requestCurrent();
      const normalized=normalize(payload);
      cached=normalized;cachedAt=Date.now();return normalized;
    })();
    try{return await inflight}finally{inflight=null}
  }

  function getRule(businessType){return RULES[String(businessType||'').trim()]||null}

  window.ASOBOON_CALENDAR=Object.freeze({
    version:'2026-08-28.3',apiUrl:API_URL,timeZone:TIME_ZONE,cutoffHour:CUTOFF_HOUR,
    rules:RULES,getRule,getCalendarDate,getOperationalDate,getCurrent
  });
})();
