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
      cached=normalized;
      cachedAt=Date.now();
      return normalized;
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

      let style=doc.getElementById('asoboonFacilityLightTheme');
      if(!style){
        style=doc.createElement('style');
        style.id='asoboonFacilityLightTheme';
        doc.head.appendChild(style);
      }

      style.textContent=`
        :root{
          color-scheme:light!important;
          --void:#f4f1e8!important;
          --deep:#ffffff!important;
          --panel:#ffffff!important;
          --panel2:#fffdf7!important;
          --cyan:#116c84!important;
          --cyan2:#116c84!important;
          --white:#15232d!important;
          --muted:#4f5f69!important;
          --amber:#e7a918!important;
          --orange:#e68016!important;
          --violet:#52638e!important;
          --red:#b93440!important;
          --green:#1d744e!important;
          --line:#ccc8bd!important;
          --shadow:0 10px 28px rgba(31,41,48,.12)!important;
          --mode-color:#e68016!important;
          --mode-color-soft:#fff0c8!important;
          --mode-color-glow:rgba(230,128,22,.10)!important;
        }

        html,body{
          color:#15232d!important;
          background:#f4f1e8!important;
        }

        body{
          background:linear-gradient(180deg,#fbfaf5 0%,#f1eee4 100%)!important;
        }

        .ambient,.star-streak,.frame::before,.hero::after,.orbit,.power-meter{
          display:none!important;
        }

        .app{background:transparent!important}
        .topbar{align-items:stretch!important}

        .brand{
          color:#15232d!important;
          border:2px solid #d6d1c5!important;
          border-radius:18px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:0 5px 18px rgba(31,41,48,.09)!important;
        }
        .brand::before{background:#e68016!important;box-shadow:none!important}
        .brand strong{color:#15232d!important}
        .brand small{color:#4f606b!important}
        .status-dot{background:#1d744e!important;box-shadow:none!important;animation:none!important}

        #asoboonTabletAutoMode,.staff-mode{
          border:1px solid #d3cec2!important;
          color:#34434d!important;
          background:#fff!important;
          box-shadow:none!important;
          clip-path:none!important;
          border-radius:12px!important;
        }
        .staff-mode>span{color:#566771!important}
        .staff-mode button{
          border-color:#cbc5b8!important;
          color:#374650!important;
          background:#f5f2ea!important;
        }
        .staff-mode button.asoboon-manual-active,.staff-mode button.active{
          color:#2e2103!important;
          border-color:#c98b08!important;
          background:#ffd45a!important;
          box-shadow:none!important;
        }

        .icon-btn{
          color:#1f2e37!important;
          border:2px solid #d0cabc!important;
          border-radius:14px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:0 4px 12px rgba(31,41,48,.08)!important;
        }

        .frame{
          padding:0!important;
          border:2px solid #d3cec2!important;
          border-radius:28px!important;
          background:#fff!important;
          box-shadow:0 12px 34px rgba(31,41,48,.10)!important;
        }

        .shell{
          border-radius:26px!important;
          color:#15232d!important;
          background:#fff!important;
        }
        .shell::before{display:none!important}

        .hero,.page-head{
          color:#15232d!important;
          border-bottom:1px solid #dfd9cc!important;
          background:linear-gradient(135deg,#fff0bd 0%,#fff8df 58%,#fff 100%)!important;
        }
        .hero small,.page-head small{color:#6e4b00!important;opacity:1!important}
        .hero h1,.page-head h2{color:#15232d!important;text-shadow:none!important}
        .hero p,.page-head p{color:#455660!important}

        .time-grid,.detail-body{background:#fff!important}

        .stage{
          border:4px solid #26343d!important;
          border-radius:24px!important;
          color:#15232d!important;
          background:#fffdf6!important;
          box-shadow:0 6px 20px rgba(31,41,48,.08)!important;
        }
        .live-row{color:#485b65!important;opacity:1!important}
        .live-dot{background:#1d744e!important;box-shadow:none!important}
        .current-clock{color:#354750!important;opacity:1!important}
        .plan-label{color:#6d4900!important;opacity:1!important;font-weight:1000!important}
        .entry-time{color:#0f1d25!important;text-shadow:none!important}
        .status-message{
          color:#251b00!important;
          border:2px solid #bd8500!important;
          background:#ffd45a!important;
          box-shadow:none!important;
          text-shadow:none!important;
        }
        .status-note{color:#455761!important}

        #asoboonClosingTime{
          color:#fff!important;
          border:0!important;
          background:#26343d!important;
          box-shadow:none!important;
          font-size:clamp(1rem,2dvh,1.32rem)!important;
          min-height:50px!important;
          padding:9px 24px!important;
        }

        .notice{
          color:#2f3e47!important;
          border:1px solid #ddd6c8!important;
          border-left:6px solid #e7a918!important;
          background:#fff6dc!important;
          box-shadow:none!important;
        }

        .home-exit-lead{color:#33444e!important}
        .home-exit-lead-line{background:#bdb7aa!important}
        .home-exit-arrows span{border-color:#a96508!important}
        .mission-btn,.home-exit-button{
          color:#251b00!important;
          border:3px solid #9b5a07!important;
          border-radius:22px!important;
          clip-path:none!important;
          background:linear-gradient(180deg,#ffda68,#efad24)!important;
          box-shadow:0 8px 0 #ad6810,0 14px 24px rgba(85,58,14,.16)!important;
          animation:none!important;
        }
        .mission-btn *,.home-exit-button *{color:#251b00!important}
        .mission-btn .subtap,.home-exit-button-sub,.home-exit-button-arrow{color:#4b3505!important}

        .tabs{gap:12px!important}
        .tab-btn{
          color:#1f2f38!important;
          border:2px solid #d1cbbf!important;
          border-radius:18px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:0 5px 16px rgba(31,41,48,.07)!important;
          animation:none!important;
        }
        .tab-btn .tab-icon{color:#1f2f38!important;border:1px solid #ddd6c9!important;background:#f4f0e6!important;box-shadow:none!important}
        .tab-kicker{color:#684700!important}
        .tab-main{color:#182831!important}
        .tab-sub{color:#465963!important}
        .tab-btn.active{
          color:#251b00!important;
          border-color:#bd8500!important;
          background:#ffda70!important;
          box-shadow:0 7px 18px rgba(91,65,15,.12)!important;
        }
        .tab-btn.active *{color:#251b00!important}

        .section-card{
          color:#15232d!important;
          border:2px solid #d7d1c5!important;
          border-radius:20px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:0 6px 18px rgba(31,41,48,.07)!important;
        }

        /* High-contrast reset for legacy white text inside light cards. */
        .section-card h3,.section-card h4,.section-card p,.section-card span,
        .section-card strong,.section-card small,.section-card em,
        .partial-section-card h3,.partial-section-card h4,
        .partial-section-card span,.partial-section-card strong,.partial-section-card small,
        .adult-only-panel h4,.adult-only-panel span,.adult-only-panel strong,.adult-only-panel small{
          color:#15232d!important;
        }
        .section-card>p{color:#455761!important}

        .family-key-rule,.important-rule,.yellow-holder-meaning{
          color:#2d2203!important;
          border-color:#c18b10!important;
          border-left-color:#c18b10!important;
          background:#fff0b6!important;
          box-shadow:none!important;
        }
        .family-key-rule em{color:#664600!important}
        .family-key-rule strong,.important-rule strong,.yellow-holder-meaning strong{color:#2d2203!important}
        .family-key-rule small,.important-rule span,.yellow-holder-meaning span{color:#4f4326!important}

        .step{
          color:#15232d!important;
          border-color:#d2ccc0!important;
          border-radius:16px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:none!important;
          animation:none!important;
        }
        .step.done{
          color:#123f2c!important;
          border-color:#8bc3a7!important;
          background:#e4f5ec!important;
        }
        .step-copy strong{color:#15232d!important}
        .step-copy small{color:#455761!important}
        .step-emphasis{color:#755000!important}

        .partial-kind-btn,.choice-btn,.return-btn,.small-action,.adult-choice-reset{
          color:#1d2e37!important;
          border:2px solid #c9c2b5!important;
          border-radius:16px!important;
          clip-path:none!important;
          background:#fff!important;
          box-shadow:0 5px 14px rgba(31,41,48,.07)!important;
          animation:none!important;
        }
        .partial-kind-btn *,.choice-btn *,.return-btn *,.small-action *,.adult-choice-reset *{
          color:#1d2e37!important;
        }
        .choice-btn.yes{
          color:#251b00!important;
          border-color:#c18b10!important;
          background:#ffe993!important;
        }
        .choice-btn.yes *{color:#251b00!important}

        .decision-result,.adult-result,.mixed-exit-result{
          color:#15232d!important;
          border:2px solid #d0c9bc!important;
          border-radius:20px!important;
          background:#f8f6ef!important;
          box-shadow:none!important;
        }
        .decision-result *,.adult-result *,.mixed-exit-result *{color:#15232d!important}

        .adult-result.ok{
          color:#123f2c!important;
          background:#dff3e8!important;
          border-color:#69a985!important;
        }
        .adult-result.ok *{color:#123f2c!important}
        .adult-result.ng{
          color:#6f2029!important;
          background:#f9e1e4!important;
          border-color:#c95d68!important;
        }
        .adult-result.ng *{color:#6f2029!important}
        .adult-result.exchange{
          color:#2e2203!important;
          background:#ffe59a!important;
          border-color:#bf8200!important;
        }
        .adult-result.exchange *{color:#2e2203!important}

        .mixed-exit-result{
          background:#fff0b6!important;
          border-color:#c18b10!important;
        }
        .mixed-exit-kicker{color:#664600!important}
        .mixed-exit-result strong{color:#15232d!important}
        .mixed-exit-result small{color:#455761!important}

        .complete-banner{
          color:#123f2c!important;
          border-color:#76b394!important;
          background:#e3f4eb!important;
        }
        .complete-banner *{color:#123f2c!important}

        .rule-bar,.exit-no-reentry{
          color:#681f27!important;
          border-left-color:#b93440!important;
          background:#f9e2e5!important;
        }
        .rule-bar *,.exit-no-reentry *{color:#681f27!important}

        #section-exit .exit-section-card{background:#fff!important}
        #section-exit .exit-return-hero{
          border-color:#bc8610!important;
          color:#2d2203!important;
          background:#fff0b6!important;
          box-shadow:none!important;
        }
        #section-exit .exit-return-hero *{color:#2d2203!important}
        #section-exit .exit-return-kicker{
          color:#5c4000!important;
          border-color:#bc8610!important;
          background:#ffe38a!important;
        }
        #section-exit .exit-return-box{
          color:#073523!important;
          border-color:#fff!important;
          background:#8bdeb3!important;
          box-shadow:0 8px 0 #489f72!important;
        }
        #section-exit .exit-return-box *{color:#073523!important}
        #section-exit .exit-return-box-mark{
          color:#fff!important;
          background:#14583e!important;
        }
        #section-exit .exit-no-reentry-mark{
          color:#fff!important;
          background:#b93440!important;
        }
        #section-exit .exit-confirm-btn{
          color:#17323d!important;
          border-color:#45849a!important;
          background:#e7f5f9!important;
        }
        #section-exit .exit-confirm-btn *{color:#17323d!important}

        .step-overlay-backdrop{
          background:rgba(245,242,233,.95)!important;
          backdrop-filter:blur(3px)!important;
          -webkit-backdrop-filter:blur(3px)!important;
        }
        .step-overlay-card{color:#15232d!important;background:#fff!important;box-shadow:none!important}
        .step-overlay-card h3,.step-overlay-card p,.step-overlay-card span,.step-overlay-card strong,.step-overlay-card small{
          color:#15232d!important;
        }
        .step-overlay-rule{
          color:#2d2203!important;
          border-color:#bc8610!important;
          border-left-color:#bc8610!important;
          background:#fff0b6!important;
          box-shadow:none!important;
        }
        .step-overlay-rule *{color:#2d2203!important}
        .step-overlay-kicker{color:#664600!important}
        .step-overlay-number{color:#15232d!important;text-shadow:none!important}
        .step-overlay-title{color:#15232d!important}
        .step-overlay-desc{color:#455761!important}
        .step-overlay-button{
          color:#251b00!important;
          border:2px solid #985707!important;
          background:#ffd45a!important;
          box-shadow:0 6px 0 #ad6810!important;
        }
        .step-overlay-button *{color:#251b00!important}
        .step-overlay-close{color:#26363f!important;border-color:#c6bfb2!important;background:#f0ece3!important}

        #asoboonSpecialOverlay{color:#15232d!important;background:#fffdf6!important}
        #asoboonSpecialOverlay .special-kicker{color:#664600!important}
        #asoboonSpecialOverlay .special-symbol{color:#15232d!important;text-shadow:none!important}
        #asoboonSpecialOverlay .special-message{
          color:#251b00!important;
          border-color:#bc8610!important;
          background:#ffd45a!important;
          box-shadow:none!important;
        }
        #asoboonSpecialOverlay .special-close{color:#fff!important;border:0!important;background:#26343d!important;box-shadow:none!important}
        #asoboonSpecialOverlay[data-kind="closed"],#asoboonSpecialOverlay[data-kind="error"]{background:#fff6f7!important}
        #asoboonSpecialOverlay[data-kind="closed"] .special-message,
        #asoboonSpecialOverlay[data-kind="error"] .special-message{
          color:#6f2029!important;
          border-color:#c95d68!important;
          background:#f9dfe2!important;
        }
        #asoboonSpecialOverlay[data-kind="closed"] .special-close,
        #asoboonSpecialOverlay[data-kind="error"] .special-close{
          color:#fff!important;
          background:#a8323d!important;
        }

        .toast{color:#fff!important;border:0!important;border-radius:14px!important;clip-path:none!important;background:#26343d!important;box-shadow:0 8px 24px rgba(31,41,48,.18)!important}
        .boot{color:#15232d!important;background:#f4f1e8!important}
        .boot-core{display:none!important}
        .boot-title{color:#15232d!important}
        .boot-sub{color:#664600!important}
        .boot-progress{background:#ddd7ca!important}
        .boot-progress span{background:#e7a918!important;box-shadow:none!important}

        /* Last-pass contrast guards for legacy selectors with !important. */
        .family-key-rule b{color:#2d2203!important}
        .yellow-holder-meaning b{color:#2d2203!important}
        .partial-kind-icon{color:#1d2e37!important}
        .adult-result-icon{color:inherit!important}
        .adult-result-title,.adult-result-rule{color:inherit!important}
        .mixed-exit-icon{color:#2d2203!important}
        .exit-final-rule span{color:#681f27!important}
        .subtap{color:#455761!important}

        *,*::before,*::after{text-shadow:none!important}

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

  function getRule(businessType){
    return RULES[String(businessType||'').trim()]||null;
  }

  window.ASOBOON_CALENDAR=Object.freeze({
    version:'2026-08-31.2',
    apiUrl:API_URL,
    timeZone:TIME_ZONE,
    cutoffHour:CUTOFF_HOUR,
    rules:RULES,
    getRule,
    getCalendarDate,
    getOperationalDate,
    getCurrent
  });

  installJounaiLightTheme();
})();
