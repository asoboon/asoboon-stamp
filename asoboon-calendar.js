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

  function installJounaiLightTheme(){
    if(!/jounaisetumei/i.test(location.pathname)) return;

    const parentStyle=document.createElement('style');
    parentStyle.textContent='html,body,#tabletCore{background:#f4f1e8!important}';
    document.head.appendChild(parentStyle);

    const inject=()=>{
      const frame=document.getElementById('tabletCore');
      const doc=frame?.contentDocument;
      if(!doc?.head)return false;
      if(doc.getElementById('asoboonFacilityLightTheme'))return true;

      const style=doc.createElement('style');
      style.id='asoboonFacilityLightTheme';
      style.textContent=`
        :root{
          --void:#f4f1e8!important;
          --deep:#ffffff!important;
          --panel:#ffffff!important;
          --panel2:#fffdf7!important;
          --cyan:#167a96!important;
          --cyan2:#167a96!important;
          --white:#17232d!important;
          --muted:#5a6872!important;
          --amber:#f2b632!important;
          --orange:#ee8f22!important;
          --violet:#5f6fa7!important;
          --red:#cf3f49!important;
          --green:#23855c!important;
          --line:#d7d5cc!important;
          --shadow:0 10px 28px rgba(31,41,48,.12)!important;
          --mode-color:#ee8f22!important;
          --mode-color-soft:#fff1cf!important;
          --mode-color-glow:rgba(238,143,34,.12)!important;
        }

        html,body{
          color:#17232d!important;
          background:#f4f1e8!important;
        }

        body{
          background:linear-gradient(180deg,#faf8f1 0%,#f2efe5 100%)!important;
        }

        .ambient,.star-streak,.frame::before,.hero::after,.orbit,.power-meter{
          display:none!important;
        }

        .app{
          background:transparent!important;
        }

        .topbar{
          align-items:stretch!important;
        }

        .brand{
          color:#17232d!important;
          border:2px solid #dad6ca!important;
          border-radius:18px!important;
          clip-path:none!important;
          background:#ffffff!important;
          box-shadow:0 5px 18px rgba(31,41,48,.09)!important;
        }

        .brand::before{
          background:#ee8f22!important;
          box-shadow:none!important;
        }

        .brand small{
          color:#67747c!important;
        }

        .status-dot{
          background:#23855c!important;
          box-shadow:none!important;
          animation:none!important;
        }

        #asoboonTabletAutoMode,
        .staff-mode{
          border:1px solid #d9d5ca!important;
          color:#4d5b64!important;
          background:#fff!important;
          box-shadow:none!important;
          clip-path:none!important;
          border-radius:12px!important;
        }

        .staff-mode>span{
          color:#78848b!important;
        }

        .staff-mode button{
          border-color:#d4d0c5!important;
          color:#59656d!important;
          background:#f7f5ee!important;
        }

        .staff-mode button.asoboon-manual-active,
        .staff-mode button.active{
          color:#3a2a06!important;
          border-color:#e8a71f!important;
          background:#ffd966!important;
          box-shadow:none!important;
        }

        .icon-btn{
          color:#25323b!important;
          border:2px solid #d6d2c6!important;
          border-radius:14px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:0 4px 12px rgba(31,41,48,.08)!important;
        }

        .frame{
          padding:0!important;
          border:2px solid #d8d4c8!important;
          border-radius:28px!important;
          background:#fff!important;
          box-shadow:0 12px 34px rgba(31,41,48,.10)!important;
        }

        .shell{
          border-radius:26px!important;
          color:#17232d!important;
          background:#fff!important;
        }

        .shell::before{
          display:none!important;
        }

        .hero,.page-head{
          color:#17232d!important;
          border-bottom:1px solid #e4e0d5!important;
          background:linear-gradient(135deg,#fff4ce 0%,#fff9e8 58%,#ffffff 100%)!important;
        }

        .hero small,.page-head small{
          color:#8b630d!important;
          opacity:1!important;
        }

        .hero h1,.page-head h2{
          color:#17232d!important;
          text-shadow:none!important;
        }

        .hero p,.page-head p{
          color:#59666f!important;
        }

        .time-grid,.detail-body{
          background:#fff!important;
        }

        .stage{
          border:3px solid #28343c!important;
          border-radius:24px!important;
          color:#17232d!important;
          background:#fffdf7!important;
          box-shadow:0 6px 20px rgba(31,41,48,.08)!important;
        }

        .live-row{
          color:#65727a!important;
          opacity:1!important;
        }

        .live-dot{
          background:#23855c!important;
          box-shadow:none!important;
        }

        .current-clock{
          color:#49565f!important;
          opacity:1!important;
        }

        .plan-label{
          color:#7d5708!important;
          opacity:1!important;
          font-weight:1000!important;
        }

        .entry-time{
          color:#111c24!important;
          text-shadow:none!important;
        }

        .status-message{
          color:#302304!important;
          border:2px solid #dca520!important;
          background:#ffd966!important;
          box-shadow:none!important;
          text-shadow:none!important;
        }

        .status-note{
          color:#55636c!important;
        }

        #asoboonClosingTime{
          color:#ffffff!important;
          border:0!important;
          background:#26343d!important;
          box-shadow:none!important;
          font-size:clamp(1rem,2dvh,1.32rem)!important;
          min-height:50px!important;
          padding:9px 24px!important;
        }

        .notice{
          color:#3f4c55!important;
          border:1px solid #e2ddd0!important;
          border-left:6px solid #f2b632!important;
          background:#fff8e5!important;
          box-shadow:none!important;
        }

        .home-exit-lead{
          color:#4a5660!important;
        }

        .home-exit-lead-line{
          background:#c8c4b9!important;
        }

        .home-exit-arrows span{
          border-color:#c47c17!important;
        }

        .mission-btn,.home-exit-button{
          color:#2e2208!important;
          border:3px solid #b96f10!important;
          border-radius:22px!important;
          clip-path:none!important;
          background:linear-gradient(180deg,#ffd86a,#f4b632)!important;
          box-shadow:0 8px 0 #c27d18,0 14px 24px rgba(85,58,14,.16)!important;
          animation:none!important;
        }

        .mission-btn .subtap,.home-exit-button-sub{
          color:#5a430d!important;
        }

        .home-exit-button-arrow{
          color:#5a430d!important;
        }

        .tabs{
          gap:12px!important;
        }

        .tab-btn{
          color:#27343d!important;
          border:2px solid #d7d3c8!important;
          border-radius:18px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:0 5px 16px rgba(31,41,48,.07)!important;
          animation:none!important;
        }

        .tab-btn .tab-icon{
          color:#27343d!important;
          border:1px solid #e0dbce!important;
          background:#f7f4ea!important;
          box-shadow:none!important;
        }

        .tab-kicker{
          color:#875d09!important;
        }

        .tab-main{
          color:#1c2831!important;
        }

        .tab-sub{
          color:#65727a!important;
        }

        .tab-btn.active{
          color:#2f2307!important;
          border-color:#d39a19!important;
          background:#ffdf7e!important;
          box-shadow:0 7px 18px rgba(91,65,15,.12)!important;
        }

        .tab-btn.active .tab-icon{
          color:#2f2307!important;
          border-color:#c68d13!important;
          background:#fff3bf!important;
        }

        .tab-btn.active .tab-kicker,
        .tab-btn.active .tab-main,
        .tab-btn.active .tab-sub{
          color:#2f2307!important;
        }

        .section-card{
          color:#17232d!important;
          border:2px solid #ddd9ce!important;
          border-radius:20px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:0 6px 18px rgba(31,41,48,.07)!important;
        }

        .section-card h3,
        .partial-section-card>h3{
          color:#17232d!important;
        }

        .section-card>p{
          color:#5c6972!important;
        }

        .family-key-rule,.important-rule,.yellow-holder-meaning{
          color:#332706!important;
          border-color:#d7a326!important;
          border-left-color:#d7a326!important;
          background:#fff4c9!important;
          box-shadow:none!important;
        }

        .family-key-rule strong,.important-rule strong,.yellow-holder-meaning strong{
          color:#3d2d07!important;
        }

        .family-key-rule small,.important-rule span,.yellow-holder-meaning span{
          color:#51472e!important;
        }

        .step{
          color:#17232d!important;
          border-color:#d9d5ca!important;
          border-radius:16px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:none!important;
          animation:none!important;
        }

        .step.done{
          color:#17452f!important;
          border-color:#a7d6be!important;
          background:#eaf8f0!important;
        }

        .step-copy strong{
          color:#17232d!important;
        }

        .step-copy small{
          color:#637078!important;
        }

        .choice-btn,.return-btn,.small-action,.partial-kind-btn,.adult-choice-reset{
          color:#24313a!important;
          border:2px solid #cfcabf!important;
          border-radius:16px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:0 5px 14px rgba(31,41,48,.07)!important;
          animation:none!important;
        }

        .choice-btn.yes{
          color:#2f2307!important;
          border-color:#d7a326!important;
          background:#fff0b2!important;
        }

        .decision-result,.adult-result,.mixed-exit-result{
          border-radius:20px!important;
          box-shadow:none!important;
        }

        .adult-result.ok{
          color:#17452f!important;
          background:#dff5e9!important;
          border-color:#6eb58f!important;
        }

        .adult-result.ng{
          color:#74242c!important;
          background:#fde8ea!important;
          border-color:#d86b74!important;
        }

        .rule-bar,.exit-no-reentry{
          color:#70252d!important;
          border-left-color:#cf3f49!important;
          background:#fdebed!important;
        }

        #section-exit .exit-section-card{
          background:#fff!important;
        }

        #section-exit .exit-return-hero{
          border-color:#d4a12c!important;
          color:#302304!important;
          background:#fff4c9!important;
          box-shadow:none!important;
        }

        #section-exit .exit-return-lead,
        #section-exit .exit-return-finish{
          color:#302304!important;
        }

        #section-exit .exit-return-box{
          color:#083b29!important;
          border-color:#ffffff!important;
          background:#8ee2b7!important;
          box-shadow:0 8px 0 #4aa776!important;
        }

        .step-overlay-backdrop{
          background:rgba(245,242,233,.94)!important;
          backdrop-filter:blur(3px)!important;
          -webkit-backdrop-filter:blur(3px)!important;
        }

        .step-overlay-card{
          color:#17232d!important;
          background:#fff!important;
          box-shadow:none!important;
        }

        .step-overlay-rule{
          color:#342707!important;
          border-color:#d4a12c!important;
          border-left-color:#d4a12c!important;
          background:#fff4c9!important;
          box-shadow:none!important;
        }

        .step-overlay-rule strong,
        .step-overlay-rule span{
          color:#342707!important;
        }

        .step-overlay-kicker{
          color:#8a610b!important;
        }

        .step-overlay-number{
          color:#17232d!important;
          text-shadow:none!important;
        }

        .step-overlay-title{
          color:#17232d!important;
        }

        .step-overlay-desc{
          color:#53616a!important;
        }

        .step-overlay-button{
          color:#332706!important;
          border:2px solid #b87916!important;
          background:#ffd45e!important;
          box-shadow:0 6px 0 #c7851e!important;
        }

        .step-overlay-close{
          color:#38464f!important;
          border-color:#cbc7bc!important;
          background:#f2efe7!important;
        }

        #asoboonSpecialOverlay{
          color:#17232d!important;
          background:#fffdf6!important;
        }

        #asoboonSpecialOverlay .special-kicker{
          color:#7c5708!important;
        }

        #asoboonSpecialOverlay .special-symbol{
          color:#17232d!important;
          text-shadow:none!important;
        }

        #asoboonSpecialOverlay .special-message{
          color:#302304!important;
          border-color:#d5a126!important;
          background:#ffd966!important;
          box-shadow:none!important;
        }

        #asoboonSpecialOverlay .special-close{
          color:#fff!important;
          border:0!important;
          background:#26343d!important;
          box-shadow:none!important;
        }

        #asoboonSpecialOverlay[data-kind="closed"],
        #asoboonSpecialOverlay[data-kind="error"]{
          background:#fff7f7!important;
        }

        #asoboonSpecialOverlay[data-kind="closed"] .special-message,
        #asoboonSpecialOverlay[data-kind="error"] .special-message{
          color:#78252d!important;
          border-color:#d96a73!important;
          background:#fde4e7!important;
        }

        #asoboonSpecialOverlay[data-kind="closed"] .special-close,
        #asoboonSpecialOverlay[data-kind="error"] .special-close{
          color:#fff!important;
          background:#b83b46!important;
        }

        .toast{
          color:#fff!important;
          border:0!important;
          border-radius:14px!important;
          clip-path:none!important;
          background:#26343d!important;
          box-shadow:0 8px 24px rgba(31,41,48,.18)!important;
        }

        .boot{
          color:#17232d!important;
          background:#f4f1e8!important;
        }

        .boot-core{
          display:none!important;
        }

        .boot-title{
          color:#17232d!important;
        }

        .boot-sub{
          color:#7b650f!important;
        }

        .boot-progress{
          background:#e4dfd2!important;
        }

        .boot-progress span{
          background:#f2b632!important;
          box-shadow:none!important;
        }

        *,*::before,*::after{
          text-shadow:none!important;
        }

        @media (min-width:700px) and (max-width:900px) and (orientation:portrait){
          .brand{padding:14px 18px!important}
          .hero{padding:22px 24px 18px!important}
          .hero h1{font-size:2.45rem!important}
          .hero p{font-size:.95rem!important}
          .stage{border-width:4px!important}
          .plan-label{font-size:1rem!important}
          .entry-time{font-size:8.2rem!important}
          .status-message{font-size:1.38rem!important;padding:14px 20px!important}
          #asoboonClosingTime{font-size:1.28rem!important;min-height:58px!important;padding:10px 28px!important}
          .notice{font-size:.92rem!important;padding:14px 16px!important}
          .home-exit-button{min-height:122px!important}
          .home-exit-button-main{font-size:2rem!important}
          .home-exit-button-sub{font-size:1rem!important}
        }
      `;
      doc.head.appendChild(style);
      return true;
    };

    const bind=()=>{
      const frame=document.getElementById('tabletCore');
      if(!frame)return false;
      frame.addEventListener('load',()=>{inject();setTimeout(inject,250);setTimeout(inject,1000)});
      inject();
      return true;
    };

    if(!bind()){
      const timer=setInterval(()=>{if(bind())clearInterval(timer)},100);
      setTimeout(()=>clearInterval(timer),10000);
    }
  }

  function getRule(businessType){return RULES[String(businessType||'').trim()]||null}

  window.ASOBOON_CALENDAR=Object.freeze({
    version:'2026-08-31.1',apiUrl:API_URL,timeZone:TIME_ZONE,cutoffHour:CUTOFF_HOUR,
    rules:RULES,getRule,getCalendarDate,getOperationalDate,getCurrent
  });

  installJounaiLightTheme();
})();
