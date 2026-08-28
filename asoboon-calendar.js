/* ASOBooN shared business-day calendar client.
 * Source of truth: Google Apps Script web app backed by 営業日カレンダー.
 * No AirWAIT secrets belong in this file.
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
        timeZone:TIME_ZONE,
        year:'numeric',
        month:'2-digit',
        day:'2-digit',
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit',
        hourCycle:'h23'
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
    ['day','calendar','current','data','result','row','businessDay'].forEach(k=>add(payload?.[k]));
    if(payload?.data&&typeof payload.data==='object'){
      ['day','calendar','current','row','businessDay'].forEach(k=>add(payload.data?.[k]));
    }
    return out;
  }

  function extractBusinessType(payload){
    const keys=['businessType','businessDayType','type','category','営業区分'];
    for(const obj of candidateObjects(payload)){
      const value=pick(obj,keys);
      if(value!==undefined){
        const normalized=String(value).trim();
        if(RULES[normalized]) return normalized;
      }
    }
    return '';
  }

  function extractDate(payload,keys){
    for(const obj of candidateObjects(payload)){
      const value=pick(obj,keys);
      if(value!==undefined&&/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) return String(value).trim();
    }
    return '';
  }

  function normalize(payload){
    const businessType=extractBusinessType(payload);
    if(!businessType) throw new Error('営業区分を取得できませんでした');
    const rule=RULES[businessType];
    const operationalDate=extractDate(payload,['operationalDate','businessDate','targetDate'])||getOperationalDate();
    const calendarDate=extractDate(payload,['calendarDate','date'])||getCalendarDate();
    return Object.freeze({
      ok:true,
      source:'calendar-api',
      businessType,
      operationalDate,
      calendarDate,
      cutoff:'18:00',
      isClosed:rule.isClosed,
      duration:rule.duration,
      durationLabel:rule.durationLabel,
      closingTime:rule.closingTime,
      raw:payload
    });
  }

  async function fetchJson(){
    const url=new URL(API_URL);
    url.searchParams.set('action','current');
    url.searchParams.set('_',String(Date.now()));
    const res=await fetch(url.toString(),{
      method:'GET',
      mode:'cors',
      credentials:'omit',
      cache:'no-store',
      redirect:'follow'
    });
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
    try{
      return await fetchJson();
    }catch(fetchError){
      try{
        return await fetchJsonp();
      }catch(jsonpError){
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
      cached=normalized;
      cachedAt=Date.now();
      return normalized;
    })();
    try{
      return await inflight;
    }finally{
      inflight=null;
    }
  }

  function getRule(businessType){
    return RULES[String(businessType||'').trim()]||null;
  }

  window.ASOBOON_CALENDAR=Object.freeze({
    version:'2026-08-28.1',
    apiUrl:API_URL,
    timeZone:TIME_ZONE,
    cutoffHour:CUTOFF_HOUR,
    rules:RULES,
    getRule,
    getCalendarDate,
    getOperationalDate,
    getCurrent
  });
})();
