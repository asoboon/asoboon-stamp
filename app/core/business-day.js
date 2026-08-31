/*
 * ASOBooN 新ミニアプリ 共通営業日エンジン
 *
 * 重要ルール:
 * - 営業区分の正本は Google スプレッドシート「営業日カレンダー」だけ。
 * - 曜日から営業区分を推測しない。
 * - API が取得できない / 値が不正な場合は fail closed（エラー）。
 * - 全ページはこのモジュールだけを経由して営業区分を取得する。
 */
(()=>{
  'use strict';

  const VERSION='2026-08-31.1';
  const API_URL='https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec';
  const TIME_ZONE='Asia/Tokyo';
  const CACHE_MS=60*1000;
  const CACHE_KEY='asoboon_v2_business_day_v1';

  const RULES=Object.freeze({
    '平日':Object.freeze({
      businessType:'平日',
      isClosed:false,
      durationMinutes:0,
      durationLabel:'時間制限なし',
      closingTime:'17:00'
    }),
    '平日特定日':Object.freeze({
      businessType:'平日特定日',
      isClosed:false,
      durationMinutes:180,
      durationLabel:'3時間',
      closingTime:'17:00'
    }),
    '土日祝日':Object.freeze({
      businessType:'土日祝日',
      isClosed:false,
      durationMinutes:150,
      durationLabel:'2時間30分',
      closingTime:'18:00'
    }),
    '休館':Object.freeze({
      businessType:'休館',
      isClosed:true,
      durationMinutes:null,
      durationLabel:'休館日',
      closingTime:null
    })
  });

  let inflight=new Map();
  let jsonpSeq=0;

  function pad(v){return String(v).padStart(2,'0')}

  function jstDate(){
    const p=Object.fromEntries(
      new Intl.DateTimeFormat('en-CA',{
        timeZone:TIME_ZONE,
        year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(new Date()).map(x=>[x.type,x.value])
    );
    return `${p.year}-${p.month}-${p.day}`;
  }

  function normalizeDate(value){
    const s=String(value??'').normalize('NFKC').trim().replace(/\//g,'-');
    const m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if(!m)return'';
    const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
    const dt=new Date(Date.UTC(y,mo-1,d,12,0,0));
    if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d)return'';
    return `${y}-${pad(mo)}-${pad(d)}`;
  }

  function readCache(date){
    try{
      const raw=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
      if(!raw||raw.date!==date||Date.now()-Number(raw.savedAt||0)>=CACHE_MS)return null;
      return normalizePayload(raw.payload,date,'cache');
    }catch{return null}
  }

  function writeCache(date,payload){
    try{localStorage.setItem(CACHE_KEY,JSON.stringify({date,savedAt:Date.now(),payload}))}catch{}
  }

  function clearCache(){
    try{localStorage.removeItem(CACHE_KEY)}catch{}
  }

  function normalizePayload(payload,requestedDate,source='api'){
    if(!payload||typeof payload!=='object')throw new Error('営業日APIの応答形式が不正です。');
    if(payload.ok!==true){
      throw new Error(String(payload.message||payload.code||'営業日を取得できませんでした。'));
    }

    const businessType=String(payload.businessType||'').normalize('NFKC').trim();
    const rule=RULES[businessType];
    if(!rule)throw new Error(`未対応の営業区分です: ${businessType||'(空欄)'}`);

    const operationalDate=normalizeDate(payload.operationalDate||payload.calendarDate||requestedDate);
    if(!operationalDate)throw new Error('営業日の返却日付が不正です。');
    if(requestedDate&&operationalDate!==requestedDate){
      throw new Error(`営業日APIの日付不一致: 要求 ${requestedDate} / 応答 ${operationalDate}`);
    }

    return Object.freeze({
      ok:true,
      version:VERSION,
      source,
      operationalDate,
      calendarDate:normalizeDate(payload.calendarDate)||operationalDate,
      weekday:String(payload.weekday||'').trim(),
      businessType:rule.businessType,
      isClosed:rule.isClosed,
      durationMinutes:rule.durationMinutes,
      durationLabel:rule.durationLabel,
      closingTime:rule.closingTime,
      note:String(payload.note||''),
      row:Number(payload.row||0)||null
    });
  }

  async function fetchJson(date){
    const u=new URL(API_URL);
    u.searchParams.set('action','current');
    u.searchParams.set('date',date);
    u.searchParams.set('_',String(Date.now()));
    const r=await fetch(u.toString(),{
      method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'follow'
    });
    if(!r.ok)throw new Error(`営業日API HTTP ${r.status}`);
    return r.json();
  }

  function fetchJsonp(date){
    return new Promise((resolve,reject)=>{
      const cb=`__asoboonBusinessDay_${Date.now()}_${++jsonpSeq}`;
      const script=document.createElement('script');
      let settled=false;
      const timer=setTimeout(()=>finish(new Error('営業日API timeout')),8000);
      function finish(error,value){
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        try{delete window[cb]}catch{window[cb]=undefined}
        script.remove();
        error?reject(error):resolve(value);
      }
      window[cb]=value=>finish(null,value);
      script.onerror=()=>finish(new Error('営業日APIを読み込めませんでした。'));
      const u=new URL(API_URL);
      u.searchParams.set('action','current');
      u.searchParams.set('date',date);
      u.searchParams.set('callback',cb);
      u.searchParams.set('_',String(Date.now()));
      script.src=u.toString();
      script.async=true;
      document.head.appendChild(script);
    });
  }

  async function request(date){
    let firstError=null;
    try{return await fetchJson(date)}
    catch(e){firstError=e}
    try{return await fetchJsonp(date)}
    catch(e){
      const err=new Error('営業日カレンダーに接続できませんでした。');
      err.cause={fetch:firstError,jsonp:e};
      throw err;
    }
  }

  async function getByDate(value,{force=false}={}){
    const date=normalizeDate(value);
    if(!date)throw new Error('日付形式が不正です。');

    if(!force){
      const cached=readCache(date);
      if(cached)return cached;
      if(inflight.has(date))return inflight.get(date);
    }

    const job=(async()=>{
      const payload=await request(date);
      const result=normalizePayload(payload,date,'calendar-api');
      writeCache(date,payload);
      return result;
    })();

    inflight.set(date,job);
    try{return await job}
    finally{inflight.delete(date)}
  }

  function getCurrent(options={}){
    return getByDate(jstDate(),options);
  }

  function getRule(businessType){
    return RULES[String(businessType||'').trim()]||null;
  }

  window.ASOBOON_BUSINESS_DAY=Object.freeze({
    version:VERSION,
    apiUrl:API_URL,
    timeZone:TIME_ZONE,
    cacheMs:CACHE_MS,
    rules:RULES,
    normalizeDate,
    getRule,
    getByDate,
    getCurrent,
    clearCache
  });
})();
