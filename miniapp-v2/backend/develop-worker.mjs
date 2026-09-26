/**
 * ASOBooN MINI App v2 - Developing Worker wrapper
 * LINE call notification is mandatory before AirWAIT reservation creation.
 * Official Developing only. Review/Published are not imported or modified.
 */
import gateway from '../../develop-gateway.runtime.mjs';
import {
  serviceHealth,
  prepareReservationNotification,
  finalizeReservationNotification,
  serviceStatus,
  runServiceMessageWorker,
  sendObservedCallNotification,
} from './develop-service-message.js';

const ALLOWED_ORIGIN = 'https://asoboon.github.io';
const LINE_CHANNEL_ID = '2009884611';
const AIRWAIT_ORIGIN = 'https://airwait.jp';
const DEVELOP_TEST_WAIT_TYPE_ID = '0042';
const AIR_RESERVATIONS = 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations';
const AIR_LAST_UPDATE = 'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless';
const AIR_WAIT_INFO = 'https://airwait.jp/WCSP/api/20160600/external/stateless/store/getWaitInfo';
// Crowd is read-only display data and intentionally independent from LINE reception write slots.
const CROWD_ONLINE_WAIT_TYPE_IDS = new Set(['0024','0027','0030','0032','0034','0036','0038']);
const CROWD_SLOT_KEYS = Object.freeze({
  '0024':'10:00',
  '0027':'14:00',
  '0030':'10:00',
  '0032':'12:30',
  '0034':'15:00',
  '0036':'10:00',
  '0038':'13:30',
});
const BOARD_SLOT_SPECS = Object.freeze({
  '平日':Object.freeze([
    Object.freeze({ key:'weekday', label:'本日の呼出状況', waitTypeIds:Object.freeze(['0023','0025']), nameTokens:Object.freeze(['すぐ入場','14:00','14時']) }),
  ]),
  '平日特定日':Object.freeze([
    Object.freeze({ key:'10:00', label:'10:00の回', waitTypeIds:Object.freeze(['0035','0036']), nameTokens:Object.freeze(['10:00','10時']) }),
    Object.freeze({ key:'13:30', label:'13:30の回', waitTypeIds:Object.freeze(['0037','0038']), nameTokens:Object.freeze(['13:30','13時30分','13時半']) }),
  ]),
  '土日祝日':Object.freeze([
    Object.freeze({ key:'10:00', label:'10:00の回', waitTypeIds:Object.freeze(['0029','0030']), nameTokens:Object.freeze(['10:00','10時']) }),
    Object.freeze({ key:'12:30', label:'12:30の回', waitTypeIds:Object.freeze(['0031','0032']), nameTokens:Object.freeze(['12:30','12時30分','12時半']) }),
    Object.freeze({ key:'15:00', label:'15:00の回', waitTypeIds:Object.freeze(['0033','0034']), nameTokens:Object.freeze(['15:00','15時']) }),
  ]),
  '休館':Object.freeze([]),
});

const BUSINESS_CALENDAR_API = 'https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec';
const BUSINESS_DAY_CACHE_MS = 30 * 60 * 1000;
const BUSINESS_DAY_STALE_FALLBACK_MS = 12 * 60 * 60 * 1000;
const EXTERNAL_READ_TIMEOUT_MS = 8 * 1000;
const BUSINESS_CALENDAR_READ_TIMEOUT_MS = 5 * 1000;
const RECONCILE_CACHE_MS = 5 * 1000;
const BOARD_BROWSER_TIMEOUT_BUDGET_MS = 20 * 1000;
const BOARD_SNAPSHOT_STALE_FALLBACK_MS = 3 * 60 * 1000;
const BOARD_PAGE_CONCURRENCY = 4;
const VALID_BUSINESS_TYPES = new Set(['平日','平日特定日','土日祝日','休館']);
const businessDayCache = new Map();
const businessDayInflight = new Map();
let reconcileAllCache = { savedAt:0, rows:[] };
let reconcileAllInflight = null;
const boardSnapshotMemory = new Map();
const boardSnapshotInflight = new Map();
const DEVELOPING_SERVICE_TEMPLATE_NAME = 'yourturn_s_w_ja';
const DEVELOPING_SERVICE_TEMPLATE_PARAMS = JSON.stringify({
  turn:'{{receiptNo}}',
  btn1_url:'{{callstatusUrl}}',
  btn2_url:'https://miniapp.line.me/2009884611-bDgDzGrN?view=entry',
});

export default {
  async fetch(request, env, ctx) {
    env = withDevelopingServiceDefaults(env);
    const url = new URL(request.url);
    const action = String(url.searchParams.get('action') || '');

    if (request.method === 'GET' && action === 'createDiagnostics') {
      if (!originAllowed(request)) return json(request, { ok:false, error:'ORIGIN_NOT_ALLOWED' }, 403);
      try { return json(request, await getCreateDiagnostics(env)); }
      catch (e) { return json(request, { ok:false, error:safeError(e) }, Number(e?.status || 503)); }
    }

    if (request.method === 'GET' && action === 'crowdRemaining') {
      if (!originAllowed(request)) return json(request, { ok:false, error:'ORIGIN_NOT_ALLOWED' }, 403);
      try { return json(request, await getCrowdRemaining(request, env, ctx)); }
      catch (e) { return json(request, { ok:false, error:safeError(e) }, Number(e?.status || 503)); }
    }

    if (request.method === 'GET' && action === 'boardStatus') {
      if (!originAllowed(request)) return json(request, { ok:false, error:'ORIGIN_NOT_ALLOWED' }, 403);
      try { return json(request, await getBoardStatus(env)); }
      catch (e) { return json(request, { ok:false, error:safeError(e) }, Number(e?.status || 503)); }
    }

    if (request.method === 'GET' && action === 'businessDay') {
      if (!originAllowed(request)) return json(request, { ok:false, error:'ORIGIN_NOT_ALLOWED' }, 403);
      try { return json(request, await getBusinessDayProxy(url.searchParams.get('date'), env)); }
      catch (e) { return json(request, { ok:false, error:safeError(e) }, Number(e?.status || 503)); }
    }

    if (request.method === 'GET' && action === 'serviceMessageStatus') {
      if (!originAllowed(request)) return json(request, { ok:false, error:'ORIGIN_NOT_ALLOWED' }, 403);
      try { return json(request, await serviceStatus(env, Object.fromEntries(url.searchParams.entries()))); }
      catch (e) { return json(request, { ok:false, found:false, error:safeError(e) }, Number(e?.status || 500)); }
    }

    if (request.method === 'GET' && (action === 'health' || !action)) {
      const base = await gateway.fetch(request, env, ctx);
      let body;
      try { body = await base.clone().json(); }
      catch { return base; }

      const baseCreateEnabled = body?.createEnabled === true;
      try { Object.assign(body, await serviceHealth(env)); }
      catch (e) {
        Object.assign(body, {
          serviceMessageEnabled:true,
          serviceMessageReady:false,
          serviceMessageMandatoryBeforeCreate:true,
          serviceMessageCronEnabled:true,
          serviceMessageHealthError:safeError(e),
        });
      }
      body.baseCreateEnabled = baseCreateEnabled;
      body.nativeCancelEnabled = true;
      body.crowdSnapshotFallbackEnabled = true;
      body.lineReceptionStoreOnly = true;
      if (body.serviceMessageMandatoryBeforeCreate === true && body.serviceMessageReady !== true) {
        body.createEnabled = false;
        body.createBlockedReason = body.serviceMessageHealthError
          ? 'LINE_NOTIFICATION_HEALTH_UNAVAILABLE'
          : 'LINE_NOTIFICATION_NOT_READY';
      } else {
        body.createEnabled = baseCreateEnabled;
        body.createBlockedReason = baseCreateEnabled ? '' : 'BASE_CREATE_GATE_DISABLED';
      }
      return new Response(JSON.stringify(body), { status:base.status, headers:base.headers });
    }

    let createPayload = null;
    let adoptPayload = null;
    let reservationStatusPayload = null;
    let cancelReservationPayload = null;
    if (request.method === 'POST') {
      try {
        const postPayload = await readBody(request.clone());
        const postAction = String(postPayload?.action || '');
        if (postAction === 'createReservation') createPayload = postPayload;
        if (postAction === 'adoptOfficialWebReception') adoptPayload = postPayload;
        if (postAction === 'reservationStatus') reservationStatusPayload = postPayload;
        if (postAction === 'cancelReservation') cancelReservationPayload = postPayload;
      } catch {
        createPayload = null;
        adoptPayload = null;
        reservationStatusPayload = null;
        cancelReservationPayload = null;
      }
    }

    if (createPayload && originAllowed(request)) {
      try {
        await prepareReservationNotification(env, createPayload);
      } catch (e) {
        const notificationError = safeError(e);
        const reopenRequired = String(e?.code || '') === 'LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP' && !e?.ambiguous;
        return json(request, {
          ok:false,
          stored:false,
          notificationRequired:true,
          notificationReady:false,
          ambiguous:false,
          notificationAmbiguous:Boolean(e?.ambiguous),
          error:reopenRequired
            ? '同じ日にもう一度受付できます。新しい受付のLINE通知を準備するため、ミニアプリをいったん完全に閉じて、開き直してから受付してください。'
            : 'LINE呼出通知を準備できないため、受付は作成されていません。もう一度お試しください。',
          errorCode:reopenRequired ? 'LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP' : 'LINE_NOTIFICATION_NOT_READY',
          notificationError,
        }, Number(e?.status || 503));
      }
    }

    if (cancelReservationPayload) {
      if (!originAllowed(request)) return json(request,{ok:false,error:'ORIGIN_NOT_ALLOWED'},403);
      try { return json(request, await cancelReservationInMiniapp(env, cancelReservationPayload)); }
      catch (e) { return json(request,{ok:false,canceled:false,error:safeError(e)},Number(e?.status||502)); }
    }

    let base = await gateway.fetch(request, env, ctx);
    if (reservationStatusPayload) {
      const statusResponse = await reconcileReservationStatus(request, env, base, reservationStatusPayload);
      queueObservedCallNotification(env, statusResponse, ctx);
      return statusResponse;
    }

    if (adoptPayload) {
      let body;
      try { body = await base.clone().json(); }
      catch { return base; }
      if (!(base.ok && body?.ok === true && body?.stored === true && body?.receiptNo && body?.reserveId)) return base;
      const handoffRequestId=String(adoptPayload?.handoffRequestId||'');
      if(!handoffRequestId)return json(request,{ok:false,stored:false,error:'OFFICIAL_WEB_HANDOFF_REQUEST_ID_REQUIRED'},400);
      try {
        body.serviceMessage = await finalizeReservationNotification(env, { ...adoptPayload, requestId:handoffRequestId }, body);
        body.notificationReady = body.serviceMessage?.ready === true;
      } catch (e) {
        body.serviceMessage = { ok:false, ready:false, status:'FINALIZE_PENDING', error:safeError(e) };
        body.notificationReady = false;
      }
      return new Response(JSON.stringify(body), { status:base.status, headers:base.headers });
    }

    if (!createPayload) return base;

    let body;
    try { body = await base.clone().json(); }
    catch { return base; }

    if (
      base.ok &&
      body?.ok === true &&
      body?.stored === true &&
      body?.alreadyExists === true &&
      await releaseTerminalPreviousClaim(env, createPayload, body)
    ) {
      const retryRequest = rebuildCreateRequest(request, createPayload);
      base = await gateway.fetch(retryRequest, env, ctx);
      try { body = await base.clone().json(); }
      catch { return base; }
    }

    if (!(base.ok && body?.ok === true && body?.stored === true && body?.receiptNo && body?.reserveId)) return base;

    try {
      body.serviceMessage = await finalizeReservationNotification(env, createPayload, body);
      body.notificationReady = body.serviceMessage?.ready === true;
    } catch (e) {
      body.serviceMessage = { ok:false, ready:false, status:'FINALIZE_PENDING', error:safeError(e) };
      body.notificationReady = false;
    }
    return new Response(JSON.stringify(body), { status:base.status, headers:base.headers });
  },

  async scheduled(event, env, ctx) {
    env = withDevelopingServiceDefaults(env);
    ctx.waitUntil(runServiceMessageWorker(env).catch(e => console.error('service-message-worker', safeError(e))));
  },
};

function queueObservedCallNotification(env, response, ctx) {
  const job = (async () => {
    let body;
    try { body = await response.clone().json(); } catch { return; }
    if (!(body?.ok === true && body?.found === true)) return;
    await sendObservedCallNotification(env, body);
  })();
  const guarded = job.catch(e => console.warn('CALLSTATUS_IMMEDIATE_NOTIFY_FAILED', safeError(e)));
  if (typeof ctx?.waitUntil === 'function') ctx.waitUntil(guarded);
  else void guarded;
}

async function getCreateDiagnostics(env) {
  if (!env?.DB) throw apiError('DB_NOT_CONFIGURED',503);
  const now=Date.now();
  const since=now-24*60*60*1000;
  const attempts=[];
  try{
    const r=await env.DB.prepare(`SELECT created_at,business_date,wait_type_id,mode,upstream_http,result_code,error_key,airwait_message
      FROM v2_create_diagnostics WHERE created_at>=? ORDER BY created_at DESC LIMIT 20`).bind(since).all();
    for(const row of Array.isArray(r?.results)?r.results:[]){
      attempts.push({
        source:'create-diagnostic',
        createdAt:Number(row.created_at||0),
        businessDate:String(row.business_date||''),
        waitTypeId:String(row.wait_type_id||''),
        mode:String(row.mode||''),
        upstreamHttp:Number(row.upstream_http||0),
        resultCode:String(row.result_code||''),
        error:String(row.error_key||''),
        airwaitMessage:String(row.airwait_message||'').slice(0,300),
      });
    }
  }catch(e){
    if(!/no such table/i.test(String(e?.message||e||''))) throw e;
  }

  const legacy=[];
  try{
    const r=await env.DB.prepare(`SELECT rr.state,rr.result_json,rr.updated_at,
        COALESCE(c.business_date,'') AS business_date,
        COALESCE(c.wait_type_id,'') AS wait_type_id
      FROM v2_request_results rr
      LEFT JOIN v2_service_token_claims c ON c.request_id=rr.request_id
      WHERE rr.action='createReservation' AND rr.state IN ('REJECTED','AMBIGUOUS') AND rr.updated_at>=?
      ORDER BY rr.updated_at DESC LIMIT 20`).bind(since).all();
    for(const row of Array.isArray(r?.results)?r.results:[]){
      let value={};
      try{value=JSON.parse(String(row.result_json||'{}'))||{}}catch{}
      legacy.push({
        source:'request-result',
        createdAt:Number(row.updated_at||0),
        businessDate:String(row.business_date||''),
        waitTypeId:String(row.wait_type_id||''),
        state:String(row.state||''),
        ambiguous:Boolean(value?.ambiguous),
        resultCode:String(value?.errorCode||'').slice(0,40),
        error:String(value?.error||'').slice(0,120),
        version:String(value?.version||'').slice(0,80),
      });
    }
  }catch(e){
    if(!/no such table/i.test(String(e?.message||e||''))) throw e;
  }

  const confirmed=[];
  try{
    const r=await env.DB.prepare(`SELECT business_date,wait_type_id,updated_at
      FROM v2_user_day_claims
      WHERE state='CONFIRMED' AND updated_at>=?
      ORDER BY updated_at DESC LIMIT 50`).bind(now-7*24*60*60*1000).all();
    for(const row of Array.isArray(r?.results)?r.results:[]){
      confirmed.push({
        businessDate:String(row.business_date||''),
        waitTypeId:String(row.wait_type_id||''),
        updatedAt:Number(row.updated_at||0),
      });
    }
  }catch(e){
    if(!/no such table/i.test(String(e?.message||e||''))) throw e;
  }

  const liveWaitTypes=[];
  let receipt2510={found:false};
  try{
    const rows=await fetchAllReservationsForReconcile(env);
    const agg=new Map();
    for(const row of rows){
      const id=String(row?.waitTypeId||'');
      if(id){
        const cur=agg.get(id)||{waitTypeId:id,waitTypeName:String(row?.waitTypeName||''),total:0,waiting:0,calling:0,hold:0,done:0,canceled:0,processing:0};
        cur.total+=1;
        const state=reservationState(row);
        if(Object.prototype.hasOwnProperty.call(cur,state))cur[state]+=1;
        agg.set(id,cur);
      }
    }
    liveWaitTypes.push(...Array.from(agg.values()).sort((a,b)=>a.waitTypeId.localeCompare(b.waitTypeId)));
    const m=selectTicketMatch(rows,'2510');
    receipt2510=m.row?{
      found:true,
      number:String(m.row.number||''),
      waitTypeId:String(m.row.waitTypeId||''),
      waitTypeName:String(m.row.waitTypeName||''),
      status:String(m.row.status||''),
      isCalling:String(m.row.isCalling||'0'),
      state:reservationState(m.row),
      ambiguous:Boolean(m.ambiguous),
      matchMode:String(m.mode||''),
      scannedRows:rows.length,
    }:{found:false,ambiguous:Boolean(m.ambiguous),candidateCount:Number(m.count||0),scannedRows:rows.length};
  }catch(e){
    liveWaitTypes.push({error:safeError(e)});
    receipt2510={found:false,error:safeError(e)};
  }

  return {
    ok:true,
    source:'Developing sanitized create diagnostics / no user identity',
    fetchedAt:new Date().toISOString(),
    attempts,
    legacy,
    confirmed,
    liveWaitTypes,
    receipt2510,
  };
}

const CROWD_SNAPSHOT_KEY='crowd_remaining_snapshot_v1';
const CROWD_SNAPSHOT_MAX_AGE_MS=30*60*1000;

async function readCrowdSnapshot(env){
  if(!await ensureWorkerStateTable(env))return null;
  try{
    const row=await env.DB.prepare('SELECT value,updated_at FROM v2_system_state WHERE key=? LIMIT 1').bind(CROWD_SNAPSHOT_KEY).first();
    if(!row)return null;
    const value=JSON.parse(String(row.value||''));
    if(value?.ok!==true||!Array.isArray(value?.slots)||!value.slots.length)return null;
    return{savedAt:Number(row.updated_at||0),value};
  }catch(e){console.warn('CROWD_SNAPSHOT_READ_FAILED',safeError(e));return null}
}
async function writeCrowdSnapshot(env,value){
  if(!await ensureWorkerStateTable(env))return;
  try{
    await env.DB.prepare('INSERT INTO v2_system_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at')
      .bind(CROWD_SNAPSHOT_KEY,JSON.stringify(value),Date.now()).run();
  }catch(e){console.warn('CROWD_SNAPSHOT_WRITE_FAILED',safeError(e))}
}
async function getCrowdRemaining(request,env,ctx){
  const cached=await readCrowdSnapshot(env);
  try{
    const fresh=await fetchCrowdRemainingFresh(request,env,ctx);
    if(!Array.isArray(fresh?.slots)||!fresh.slots.length)throw apiError('AIRWAIT_CROWD_EMPTY',502);
    await writeCrowdSnapshot(env,fresh);
    return{...fresh,stale:false,cacheSource:'airwait-fresh'};
  }catch(e){
    const age=cached?Date.now()-Number(cached.savedAt||0):Infinity;
    if(cached&&age<=CROWD_SNAPSHOT_MAX_AGE_MS){
      return{...cached.value,ok:true,stale:true,staleAgeMs:age,cacheSource:'d1-stale',warning:safeError(e)};
    }
    throw e;
  }
}

async function fetchCrowdRemainingFresh(request, env, ctx) {
  if (!env?.AIRWAIT_API_KEY) throw apiError('AIRWAIT_KEY_NOT_CONFIGURED', 503);

  const typesUrl = new URL(request.url);
  typesUrl.searchParams.set('action','waitTypes');
  const typesRequest = new Request(typesUrl.toString(), { method:'GET', headers:request.headers });
  const typesResponse = await gateway.fetch(typesRequest, env, ctx);
  let typesBody=null;try{typesBody=await typesResponse.json()}catch{}
  if (!typesResponse.ok || typesBody?.ok !== true || !Array.isArray(typesBody.waitTypes)) {
    throw apiError('AIRWAIT_CROWD_WAIT_TYPES_FAILED', 502);
  }

  const infoUrl = new URL(AIR_WAIT_INFO);
  infoUrl.searchParams.set('key', env.AIRWAIT_API_KEY);
  infoUrl.searchParams.set('storeId','KR01205179');
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), EXTERNAL_READ_TIMEOUT_MS);
  let infoResponse;
  try {
    infoResponse = await fetch(infoUrl, { method:'GET', cache:'no-store', signal:ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw apiError('AIRWAIT_CROWD_TIMEOUT', 504);
    throw e;
  } finally { clearTimeout(timer); }

  let d=null;try{d=await infoResponse.json()}catch{}
  if (!infoResponse.ok || !(d?.success === true || d?.resultCode?.code === '0000')) {
    throw apiError('AIRWAIT_CROWD_INFO_FAILED_HTTP_' + infoResponse.status + '_RC_' + String(d?.resultCode?.code || 'NONE'), 502);
  }
  const store = d?.innerDto?.stores?.[0];
  if (!store || !Array.isArray(store.waitDetails)) throw apiError('AIRWAIT_CROWD_DETAILS_UNAVAILABLE', 502);

  const norm=v=>String(v||'').normalize('NFKC').replace(/\s+/g,'').trim();
  const slotKeyFromText=value=>{
    const t=norm(value);
    let m=t.match(/(?:^|[^0-9])(\d{1,2}):(\d{2})(?:[^0-9]|$)/);
    if(m){
      const h=Number(m[1]),min=Number(m[2]);
      if(h<=23&&min<=59)return String(h).padStart(2,'0')+':'+String(min).padStart(2,'0');
    }
    m=t.match(/(?:^|[^0-9])(\d{1,2})時(半|([0-5]?\d)分?)?/);
    if(!m)return'';
    const h=Number(m[1]),min=m[2]==='半'?30:Number(m[3]||0);
    return h<=23&&min<=59?String(h).padStart(2,'0')+':'+String(min).padStart(2,'0'):'';
  };
  const details=store.waitDetails.map((row,index)=>({
    index,
    detailedWaitType:String(row?.detailedWaitType||'').slice(0,120),
    reserveUnit:String(row?.reserveUnit||''),
    remainingNum:row?.remainingNum,
    slotKey:slotKeyFromText(row?.detailedWaitType),
  }));
  const targetTypes=typesBody.waitTypes.filter(type=>
    CROWD_ONLINE_WAIT_TYPE_IDS.has(String(type?.waitTypeId||'')) &&
    String(type?.usageDispType||'') === 'KeyONLINE_RECEPTION_ONLY'
  );
  const diagnostics=[];
  const slots=targetTypes.map(type=>{
    const waitTypeId=String(type?.waitTypeId||'');
    const waitTypeName=String(type?.waitTypeName||'');
    const expectedSlot=String(CROWD_SLOT_KEYS[waitTypeId]||slotKeyFromText(waitTypeName)||'');
    const exactMatches=details.filter(row=>norm(row.detailedWaitType)===norm(waitTypeName));
    const slotMatches=expectedSlot?details.filter(row=>row.slotKey===expectedSlot):[];
    const matchMode=exactMatches.length===1?'exact-name':exactMatches.length===0&&slotMatches.length===1?'time-key':'';
    const matched=matchMode==='exact-name'?exactMatches[0]:matchMode==='time-key'?slotMatches[0]:null;
    const raw=matched?.remainingNum;
    const n=(typeof raw==='number'||(typeof raw==='string'&&/^\d+$/.test(raw)))?Number(raw):NaN;
    const valid=matched?.reserveUnit==='PERSON'&&Number.isSafeInteger(n)&&n>=0&&n<=350;
    const matchCount=exactMatches.length>0?exactMatches.length:slotMatches.length;
    const evidence=!matched
      ?(matchCount>1?'AMBIGUOUS_MATCH':'NO_MATCH')
      :(valid?'PERSON':'UNVERIFIED_UNIT_OR_VALUE');
    diagnostics.push({
      waitTypeId,
      waitTypeName:waitTypeName.slice(0,120),
      expectedSlot,
      exactMatchCount:exactMatches.length,
      slotMatchCount:slotMatches.length,
      matchMode:matchMode||'none',
      matchedName:String(matched?.detailedWaitType||'').slice(0,120),
      reserveUnit:String(matched?.reserveUnit||''),
      remainingReadable:Number.isSafeInteger(n)&&n>=0&&n<=350,
      evidence,
    });
    return {
      waitTypeId,
      waitTypeName,
      slotKey:expectedSlot,
      detailedWaitType:matched?.detailedWaitType||'',
      reserveUnit:matched?.reserveUnit||'',
      remaining:valid?n:null,
      matchMode:matchMode||'none',
      evidence,
    };
  });
  return {
    ok:true,
    source:'AirWAIT getWaitInfo',
    fetchedAt:new Date().toISOString(),
    onlineReception:{
      enabled:Boolean(store?.onlineRcptFlg),
      code:String(store?.onlineRcptCode||''),
    },
    slots,
    diagnostics,
    observedDetails:details.map(row=>({
      detailedWaitType:row.detailedWaitType,
      reserveUnit:row.reserveUnit,
      slotKey:row.slotKey,
      remaining:row.reserveUnit==='PERSON'&&Number.isSafeInteger(Number(row.remainingNum))?Number(row.remainingNum):null,
    })),
  };
}

function tokyoCalendarDate(date=new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date).map(x=>[x.type,x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function fetchAirwaitLastUpdate(env) {
  const u=new URL(AIR_LAST_UPDATE);
  u.searchParams.set('storeId','KR01205179');
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),Math.min(EXTERNAL_READ_TIMEOUT_MS,5000));
  let r;
  try{
    r=await fetch(u,{
      method:'GET',
      headers:{Accept:'application/json',corWclpKeyCd:env.AIRWAIT_API_KEY},
      cache:'no-store',
      signal:ctrl.signal,
    });
  }catch(e){
    if(e?.name==='AbortError') throw apiError('AIRWAIT_LAST_UPDATE_TIMEOUT',504);
    throw e;
  }finally{clearTimeout(timer)}
  let d=null;try{d=await r.json()}catch{}
  if(!r.ok||d?.success!==true||d?.resultCode?.code!=='0000')throw apiError('AIRWAIT_LAST_UPDATE_FAILED',502);
  return String(d?.innerDto?.lastUpdDate||'');
}

async function fetchBoardReservationPage(env,start=1){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),EXTERNAL_READ_TIMEOUT_MS);
  let r;
  try{
    r=await fetch(AIR_RESERVATIONS,{
      method:'POST',
      headers:{
        Accept:'application/json',
        'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
        corWclpKeyCd:env.AIRWAIT_API_KEY,
      },
      body:new URLSearchParams({
        storeId:'KR01205179',
        sortStatus:'0',
        isDesc:'0',
        start:String(start),
        limit:'100',
      }),
      cache:'no-store',
      signal:ctrl.signal,
    });
  }catch(e){
    if(e?.name==='AbortError')throw apiError('AIRWAIT_BOARD_TIMEOUT',504);
    throw e;
  }finally{clearTimeout(timer)}
  let d=null;try{d=await r.json()}catch{}
  if(!r.ok||d?.success!==true||d?.resultCode?.code!=='0000')throw apiError('AIRWAIT_BOARD_FAILED',502);
  const part=Array.isArray(d?.innerDto?.reservations)?d.innerDto.reservations:[];
  return{
    count:Number(d?.innerDto?.count||part.length||0),
    rows:part.map(x=>({
      number:String(x?.number||''),
      waitTypeId:String(x?.waitTypeId||''),
      waitTypeName:String(x?.waitTypeName||''),
      status:String(x?.status||''),
      isCalling:String(x?.isCalling||'0'),
    })),
  };
}

async function fetchBoardReservationsFresh(env){
  const first=await fetchBoardReservationPage(env,1);
  const total=Math.max(0,Number(first.count||0));
  const starts=[];
  for(let start=101;start<=total&&starts.length<19;start+=100)starts.push(start);
  const pages=[first];
  for(let i=0;i<starts.length;i+=BOARD_PAGE_CONCURRENCY){
    const batch=starts.slice(i,i+BOARD_PAGE_CONCURRENCY);
    const values=await Promise.all(batch.map(start=>fetchBoardReservationPage(env,start)));
    pages.push(...values);
  }
  return pages.flatMap(page=>page.rows);
}

async function readBoardSnapshotD1(env,businessDate){
  if(!await ensureWorkerStateTable(env))return null;
  try{
    const row=await env.DB.prepare('SELECT value,updated_at FROM v2_system_state WHERE key=? LIMIT 1')
      .bind('board_snapshot:'+businessDate).first();
    if(!row)return null;
    const value=JSON.parse(String(row.value||''));
    if(String(value?.businessDate||'')!==businessDate||!Array.isArray(value?.rows))return null;
    return{savedAt:Number(row.updated_at||0),value};
  }catch(e){console.warn('BOARD_SNAPSHOT_READ_FAILED',safeError(e));return null}
}

async function writeBoardSnapshotD1(env,businessDate,value){
  if(!await ensureWorkerStateTable(env))return;
  try{
    await env.DB.prepare('INSERT INTO v2_system_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at')
      .bind('board_snapshot:'+businessDate,JSON.stringify(value),Date.now()).run();
  }catch(e){console.warn('BOARD_SNAPSHOT_WRITE_FAILED',safeError(e))}
}

async function getBoardRows(env,businessDate,businessType){
  const key=businessDate+'::'+businessType;
  if(boardSnapshotInflight.has(key))return await boardSnapshotInflight.get(key);
  const job=(async()=>{
    let snapshot=boardSnapshotMemory.get(key)||null;
    if(!snapshot){
      const stored=await readBoardSnapshotD1(env,businessDate);
      if(stored&&String(stored.value?.businessType||'')===businessType){
        snapshot={savedAt:stored.savedAt,...stored.value};
        boardSnapshotMemory.set(key,snapshot);
      }
    }

    let lastUpdDate='';
    try{lastUpdDate=await fetchAirwaitLastUpdate(env)}catch(e){
      console.warn('BOARD_LAST_UPDATE_READ_FAILED',safeError(e));
    }

    if(snapshot&&lastUpdDate&&String(snapshot.lastUpdDate||'')===lastUpdDate){
      return{rows:snapshot.rows,stale:false,cacheSource:snapshot.cacheSource||'snapshot',lastUpdDate};
    }

    try{
      const rows=await fetchBoardReservationsFresh(env);
      const value={businessDate,businessType,lastUpdDate,rows,cacheSource:'airwait-fresh'};
      const fresh={savedAt:Date.now(),...value};
      boardSnapshotMemory.set(key,fresh);
      await writeBoardSnapshotD1(env,businessDate,value);
      return{rows,stale:false,cacheSource:'airwait-fresh',lastUpdDate};
    }catch(e){
      if(snapshot&&Date.now()-Number(snapshot.savedAt||0)<=BOARD_SNAPSHOT_STALE_FALLBACK_MS){
        console.warn('BOARD_USING_STALE_SNAPSHOT',safeError(e));
        return{
          rows:snapshot.rows,
          stale:true,
          staleAgeMs:Date.now()-Number(snapshot.savedAt||0),
          cacheSource:'snapshot-stale',
          lastUpdDate:String(snapshot.lastUpdDate||lastUpdDate||''),
          warning:safeError(e),
        };
      }
      throw e;
    }
  })();
  boardSnapshotInflight.set(key,job);
  try{return await job}
  finally{if(boardSnapshotInflight.get(key)===job)boardSnapshotInflight.delete(key)}
}

function boardActiveNow(businessType,date=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false
  }).formatToParts(date).map(x=>[x.type,x.value]));
  const m=Number(p.hour||0)*60+Number(p.minute||0);
  if(m<8*60)return false;
  if(businessType==='平日'||businessType==='平日特定日')return m<17*60;
  if(businessType==='土日祝日')return m<18*60;
  return false;
}

async function getBoardStatus(env) {
  if (!env?.AIRWAIT_API_KEY) throw apiError('AIRWAIT_KEY_NOT_CONFIGURED', 503);
  const businessDate=tokyoCalendarDate();
  const day=await getBusinessDayProxy(businessDate, env);
  const businessType=String(day?.businessType||'');
  const specs=BOARD_SLOT_SPECS[businessType]||Object.freeze([]);

  let boardRows={rows:[],stale:false,cacheSource:'inactive',lastUpdDate:''};
  if(boardActiveNow(businessType)){
    boardRows=await getBoardRows(env,businessDate,businessType);
  }

  const slots = specs.map(spec => {
    const target = boardRows.rows.filter(row => boardSlotKey(row,specs) === spec.key);
    return {
      key:spec.key,
      label:spec.label,
      count:target.length,
      rows:target.map((row,index)=>({
        number:String(row?.number || ''),
        state:boardReservationState(row),
        order:index + 1,
      })),
    };
  });
  return {
    ok:true,
    source:'AirWAIT reservations + ASOBooN business calendar / read-only sanitized board feed',
    fetchedAt:new Date().toISOString(),
    refreshAfterMs:10000,
    requestBudgetMs:BOARD_BROWSER_TIMEOUT_BUDGET_MS,
    businessDate,
    businessType,
    isClosed:businessType==='休館',
    weekday:String(day?.weekday||''),
    note:String(day?.note||''),
    stale:Boolean(boardRows.stale),
    staleAgeMs:Number(boardRows.staleAgeMs||0),
    cacheSource:String(boardRows.cacheSource||''),
    lastUpdDate:String(boardRows.lastUpdDate||''),
    warning:String(boardRows.warning||''),
    slots,
  };
}


function boardSlotKey(row,specs=[]) {
  const id = String(row?.waitTypeId || '');
  for (const spec of specs) {
    if (spec.waitTypeIds.includes(id)) return spec.key;
  }
  const name = String(row?.waitTypeName || '').normalize('NFKC').replace(/\s+/g,'');
  for (const spec of specs) {
    if ((spec.nameTokens||[]).some(token=>name.includes(String(token).normalize('NFKC').replace(/\s+/g,'')))) return spec.key;
  }
  return '';
}

function boardReservationState(row) {
  const status = String(row?.status || '');
  const isCalling = String(row?.isCalling || '') === '1';
  if (status === '3') return 'canceled';
  if (status === '2') return 'done';
  if (status === '1') return 'hold';
  if (status === '4') return 'processing';
  if (status === '0' && isCalling) return 'calling';
  return 'waiting';
}
let workerStateTableReady=null;
async function ensureWorkerStateTable(env){
  if(!env?.DB)return false;
  if(workerStateTableReady)return await workerStateTableReady;
  workerStateTableReady=env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_system_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run().then(()=>true).catch(e=>{workerStateTableReady=null;console.warn('BUSINESS_DAY_CACHE_TABLE_FAILED',safeError(e));return false});
  return await workerStateTableReady;
}
async function readBusinessDayD1(env,date){
  if(!await ensureWorkerStateTable(env))return null;
  try{
    const row=await env.DB.prepare('SELECT value,updated_at FROM v2_system_state WHERE key=? LIMIT 1').bind('business_day:'+date).first();
    if(!row)return null;
    const value=JSON.parse(String(row.value||''));
    const returned=normalizeDate(value?.operationalDate||value?.calendarDate||'');
    const businessType=String(value?.businessType||'').normalize('NFKC').trim();
    if(returned!==date||!VALID_BUSINESS_TYPES.has(businessType))return null;
    return{savedAt:Number(row.updated_at||0),value:{...value,ok:true,operationalDate:date,calendarDate:date,businessType}};
  }catch(e){console.warn('BUSINESS_DAY_CACHE_READ_FAILED',safeError(e));return null}
}
async function writeBusinessDayD1(env,date,value){
  if(!await ensureWorkerStateTable(env))return;
  try{
    await env.DB.prepare('INSERT INTO v2_system_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at')
      .bind('business_day:'+date,JSON.stringify(value),Date.now()).run();
  }catch(e){console.warn('BUSINESS_DAY_CACHE_WRITE_FAILED',safeError(e))}
}
async function getBusinessDayProxy(value, env) {
  const date = normalizeDate(value);
  if (!date) throw apiError('BUSINESS_DATE_INVALID', 400);
  const now = Date.now();
  const cached = businessDayCache.get(date);
  if (cached && now - cached.savedAt < BUSINESS_DAY_CACHE_MS) return { ...cached.value, cached:true, cacheSource:'memory' };

  const d1=await readBusinessDayD1(env,date);
  if(d1 && now-d1.savedAt < BUSINESS_DAY_CACHE_MS){
    businessDayCache.set(date,{savedAt:d1.savedAt,value:d1.value});
    return{...d1.value,cached:true,cacheSource:'d1'};
  }
  if (businessDayInflight.has(date)) return businessDayInflight.get(date);

  const job = (async () => {
    try{
      const u = new URL(BUSINESS_CALENDAR_API);
      u.searchParams.set('action','current');
      u.searchParams.set('date',date);
      u.searchParams.set('_',String(Date.now()));
      const ctrl = new AbortController();
      const timer = setTimeout(()=>ctrl.abort(), BUSINESS_CALENDAR_READ_TIMEOUT_MS);
      let r;
      try { r = await fetch(u,{headers:{Accept:'application/json'},cache:'no-store',signal:ctrl.signal}); }
      catch(e){ if(e?.name==='AbortError') throw apiError('BUSINESS_CALENDAR_TIMEOUT',504); throw e; }
      finally { clearTimeout(timer); }
      let d=null;try{d=await r.json()}catch{}
      if (!r.ok || d?.ok !== true) throw apiError('BUSINESS_CALENDAR_UNAVAILABLE',503);
      const returned = normalizeDate(d.operationalDate || d.calendarDate || date);
      const businessType = String(d.businessType || '').normalize('NFKC').trim();
      if (returned !== date || !VALID_BUSINESS_TYPES.has(businessType)) throw apiError('BUSINESS_CALENDAR_INVALID',503);
      const valueOut = {
        ok:true,
        source:'develop-worker-cache',
        operationalDate:date,
        calendarDate:date,
        businessType,
        note:String(d.note||''),
        weekday:String(d.weekday||''),
        cached:false,
      };
      businessDayCache.set(date,{savedAt:Date.now(),value:valueOut});
      await writeBusinessDayD1(env,date,valueOut);
      return valueOut;
    }catch(e){
      const fallback=businessDayCache.get(date);
      if(fallback&&Date.now()-fallback.savedAt<BUSINESS_DAY_STALE_FALLBACK_MS){
        return{...fallback.value,cached:true,stale:true,cacheSource:'memory-stale'};
      }
      const stored=d1||await readBusinessDayD1(env,date);
      if(stored&&Date.now()-stored.savedAt<BUSINESS_DAY_STALE_FALLBACK_MS){
        businessDayCache.set(date,{savedAt:stored.savedAt,value:stored.value});
        return{...stored.value,cached:true,stale:true,cacheSource:'d1-stale'};
      }
      throw e;
    }
  })();
  businessDayInflight.set(date,job);
  try { return await job; }
  finally { if (businessDayInflight.get(date) === job) businessDayInflight.delete(date); }
}

async function reconcileReservationStatus(request, env, base, payload) {
  let body;
  try { body = await base.clone().json(); }
  catch { return base; }

  if (!(base.ok && body?.ok === true && body?.found === false && body?.receiptNo)) return base;
  if (!env?.AIRWAIT_API_KEY) return base;

  try {
    const rows = await fetchAllReservationsForReconcile(env);
    const match = selectTicketMatch(rows, body.receiptNo);
    const candidate = match.row;

    if (!candidate) {
      return new Response(JSON.stringify({
        ...body,
        reconcileTried:true,
        reconcileAmbiguous:match.ambiguous,
        reconcileCandidateCount:match.count,
      }), { status:base.status, headers:base.headers });
    }

    const candidateWaitTypeId = String(candidate.waitTypeId || '');
    if (env.DB && candidateWaitTypeId && String(payload?.sessionToken || '').trim().length >= 32) {
      try {
        const tokenHash = await sha256Hex(String(payload.sessionToken).trim());
        await env.DB.prepare('UPDATE v2_reservation_sessions SET wait_type_id=? WHERE token_hash=?')
          .bind(candidateWaitTypeId, tokenHash).run();
        try {
          await env.DB.prepare(`UPDATE v2_service_messages SET wait_type_id=?,updated_at=?
            WHERE business_date=? AND receipt_no=? AND notified_at=0`)
            .bind(candidateWaitTypeId, Date.now(), String(body.businessDate || ''), String(body.receiptNo || '')).run();
        } catch (e) {
          console.warn('CALLSTATUS_RECONCILE_SERVICE_WAITTYPE_FAILED', safeError(e));
        }
      } catch (e) {
        console.warn('CALLSTATUS_RECONCILE_SESSION_UPDATE_FAILED', safeError(e));
      }
    }

    const queueRows = rows.filter(r => String(r.waitTypeId || '') === candidateWaitTypeId);
    const active = queueRows.filter(r => ['0','1','4'].includes(String(r.status || '')));
    const activeIndex = active.findIndex(r => sameTicket(r.number, body.receiptNo));
    const aheadCount = activeIndex >= 0
      ? active.slice(0, activeIndex).filter(r => ['0','4'].includes(String(r.status || ''))).length
      : null;

    return new Response(JSON.stringify({
      ...body,
      found:true,
      waitTypeId:candidateWaitTypeId || String(body.waitTypeId || ''),
      waitTypeName:String(candidate.waitTypeName || ''),
      status:String(candidate.status || ''),
      isCalling:String(candidate.isCalling || '0') === '1',
      state:reservationState(candidate),
      aheadCount,
      queueRank:activeIndex >= 0 ? activeIndex + 1 : null,
      activeCount:active.length,
      checkedAt:Date.now(),
      reconcileTried:true,
      reconciledBy:'all-wait-types-fallback',
    }), { status:base.status, headers:base.headers });
  } catch (e) {
    console.warn('CALLSTATUS_RECONCILE_FAILED', safeError(e));
    return base;
  }
}

async function fetchWithCancelTimeout(url,options={},timeoutMs=10000){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{return await fetch(url,{...options,signal:ctrl.signal})}
  catch(e){if(e?.name==='AbortError')throw apiError('CANCEL_UPSTREAM_TIMEOUT',504);throw e}
  finally{clearTimeout(timer)}
}
function htmlMetaContent(html,name){
  const escaped=String(name||'').replace(/[.*+?^$()|[\]\\]/g,'\\async function fetchAllReservationsForReconcile(env) {');
  const a=new RegExp('<meta[^>]+name=["\\\']'+escaped+'["\\\'][^>]+content=["\\\']([^"\\\']+)["\\\']','i').exec(String(html||''));
  const b=new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+name=["\\\']'+escaped+'["\\\']','i').exec(String(html||''));
  return String((a||b)?.[1]||'').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/&quot;/g,'"');
}
function responseCookieHeader(response){
  try{
    const headers=response?.headers;
    let values=[];
    if(typeof headers?.getSetCookie==='function')values=headers.getSetCookie();
    else{const raw=String(headers?.get('set-cookie')||'');if(raw)values=raw.split(/,(?=\s*[^;,=\s]+=)/)}
    return values.map(v=>String(v||'').split(';')[0].trim()).filter(Boolean).join('; ');
  }catch{return''}
}
async function verifyCancelLineUser(liffAccessToken){
  const token=String(liffAccessToken||'').trim();
  if(token.length<20||token.length>4096)throw apiError('LINE_ACCESS_TOKEN_REQUIRED',401);
  const verifyUrl=new URL('https://api.line.me/oauth2/v2.1/verify');
  verifyUrl.searchParams.set('access_token',token);
  const vr=await fetchWithCancelTimeout(verifyUrl.toString(),{headers:{Accept:'application/json'}},8000);
  let vd=null;try{vd=await vr.json()}catch{}
  if(!vr.ok||String(vd?.client_id||'')!==LINE_CHANNEL_ID)throw apiError('LINE_ACCESS_TOKEN_INVALID',401);
  const pr=await fetchWithCancelTimeout('https://api.line.me/v2/profile',{headers:{Authorization:'Bearer '+token,Accept:'application/json'}},8000);
  let pd=null;try{pd=await pr.json()}catch{}
  const userId=String(pd?.userId||'');
  if(!pr.ok||!userId)throw apiError('LINE_PROFILE_INVALID',401);
  return await sha256Hex(userId);
}
async function loadCancelShortUrl(env,session){
  const row=await env.DB.prepare("SELECT c.request_id,rr.result_json FROM v2_user_day_claims c JOIN v2_request_results rr ON rr.request_id=c.request_id WHERE c.user_hash=? AND c.business_date=? AND c.reserve_id=? AND c.receipt_no=? AND c.state='CONFIRMED' LIMIT 1")
    .bind(String(session.user_hash||''),String(session.business_date||''),String(session.reserve_id||''),String(session.receipt_no||'')).first();
  let result={};try{result=row?.result_json?JSON.parse(String(row.result_json)):{};}catch{}
  const raw=String(result?.shortUrl||'').trim();
  if(!raw)throw apiError('CANCEL_CAPABILITY_UNAVAILABLE',409);
  let u;try{u=new URL(raw)}catch{throw apiError('CANCEL_CAPABILITY_INVALID',409)}
  const host=String(u.hostname||'').toLowerCase();
  if(!['http:','https:'].includes(u.protocol)||!(host==='airwait.jp'||host.endsWith('.airwait.jp')))throw apiError('CANCEL_CAPABILITY_INVALID',409);
  u.protocol='https:';
  return u.toString();
}
async function currentReservationRow(env,receiptNo){
  reconcileAllCache={savedAt:0,rows:[]};
  reconcileAllInflight=null;
  const rows=await fetchAllReservationsForReconcile(env);
  return selectTicketMatch(rows,receiptNo).row||null;
}
async function cancelReservationInMiniapp(env,p){
  if(!env?.DB)throw apiError('DB_NOT_CONFIGURED',503);
  const rawToken=String(p?.sessionToken||'').trim();
  if(rawToken.length<32||rawToken.length>256)throw apiError('CALLSTATUS_SESSION_REQUIRED',401);
  const tokenHash=await sha256Hex(rawToken);
  const now=Date.now();
  const session=await env.DB.prepare('SELECT user_hash,business_date,reserve_id,receipt_no,wait_type_id,expires_at FROM v2_reservation_sessions WHERE token_hash=? LIMIT 1').bind(tokenHash).first();
  if(!session||Number(session.expires_at||0)<=now)throw apiError('CALLSTATUS_SESSION_EXPIRED',401);
  const lineHash=await verifyCancelLineUser(p?.liffAccessToken);
  if(String(session.user_hash||'')!==lineHash)throw apiError('CANCEL_SESSION_USER_MISMATCH',403);

  const before=await currentReservationRow(env,String(session.receipt_no||''));
  const beforeState=reservationState(before);
  if(beforeState==='canceled')return{ok:true,canceled:true,alreadyCanceled:true,state:'canceled',receiptNo:String(session.receipt_no||''),checkedAt:Date.now()};
  if(!['waiting','calling','hold'].includes(beforeState))throw apiError('CANCEL_NOT_ALLOWED_STATE_'+String(beforeState||'unknown').toUpperCase(),409);

  const shortUrl=await loadCancelShortUrl(env,session);
  const detailResponse=await fetchWithCancelTimeout(shortUrl,{redirect:'follow',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}},10000);
  await detailResponse.text();
  if(!detailResponse.ok)throw apiError('CANCEL_DETAIL_UNAVAILABLE',502);
  const detailUrl=new URL(detailResponse.url);
  const storeNo=String(detailUrl.searchParams.get('storeNo')||'');
  const reserveId=String(detailUrl.searchParams.get('reserveId')||'');
  const capability=String(detailUrl.searchParams.get('p')||'');
  if(!storeNo||!reserveId||!capability)throw apiError('CANCEL_CAPABILITY_MISSING',409);
  if(reserveId!==String(session.reserve_id||''))throw apiError('CANCEL_RESERVATION_MISMATCH',409);

  const confirmUrl=new URL('/WCSP/cancel/confirm',AIRWAIT_ORIGIN);
  confirmUrl.searchParams.set('storeNo',storeNo);
  confirmUrl.searchParams.set('reserveId',reserveId);
  confirmUrl.searchParams.set('p',capability);
  const confirmResponse=await fetchWithCancelTimeout(confirmUrl.toString(),{redirect:'follow',headers:{Accept:'text/html','User-Agent':'Mozilla/5.0'}},10000);
  const confirmHtml=await confirmResponse.text();
  if(!confirmResponse.ok||new URL(confirmResponse.url).pathname!=='/WCSP/cancel/confirm')throw apiError('CANCEL_CONFIRM_UNAVAILABLE',502);
  const csrf=htmlMetaContent(confirmHtml,'_csrf');
  if(!csrf)throw apiError('CANCEL_CSRF_UNAVAILABLE',502);
  const cookie=responseCookieHeader(confirmResponse);

  const completeUrl=new URL('/WCSP/cancel/complete',AIRWAIT_ORIGIN);
  completeUrl.searchParams.set('queryStoreNo',storeNo);
  const headers={Accept:'text/html,application/xhtml+xml','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Origin:AIRWAIT_ORIGIN,Referer:confirmUrl.toString(),'User-Agent':'Mozilla/5.0'};
  if(cookie)headers.Cookie=cookie;
  let postResponse=null,postError=null;
  try{
    postResponse=await fetchWithCancelTimeout(completeUrl.toString(),{method:'POST',redirect:'follow',headers,body:new URLSearchParams({storeNo,reserveId,p:capability,_csrf:csrf})},12000);
    await postResponse.text();
  }catch(e){postError=e}

  await new Promise(resolve=>setTimeout(resolve,350));
  const after=await currentReservationRow(env,String(session.receipt_no||''));
  const afterState=reservationState(after);
  if(afterState!=='canceled'){if(postError)throw apiError('CANCEL_RESULT_UNKNOWN',502);throw apiError('CANCEL_NOT_CONFIRMED_HTTP_'+String(postResponse?.status||0),502)}
  try{
    await env.DB.prepare("UPDATE v2_service_messages SET status='CANCELED',last_error='',updated_at=? WHERE business_date=? AND receipt_no=? AND notified_at=0")
      .bind(Date.now(),String(session.business_date||''),String(session.receipt_no||'')).run();
  }catch(e){console.warn('CANCEL_SERVICE_MESSAGE_UPDATE_FAILED',safeError(e))}
  return{ok:true,canceled:true,state:'canceled',receiptNo:String(session.receipt_no||''),businessDate:String(session.business_date||''),waitTypeId:String(after?.waitTypeId||session.wait_type_id||''),checkedAt:Date.now()};
}
async function fetchAllReservationsForReconcile(env) {
  const now = Date.now();
  if (reconcileAllCache.rows.length && now - reconcileAllCache.savedAt < RECONCILE_CACHE_MS) {
    return reconcileAllCache.rows;
  }
  if (reconcileAllInflight) return await reconcileAllInflight;

  const job = (async () => {
    const rows = [];
    let start = 1;
    let total = Infinity;
    let page = 0;
    const maxPages = 100; // up to 10,000 same-day records; receipt numbers can exceed 2,000.
    while (rows.length < total && page < maxPages) {
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),EXTERNAL_READ_TIMEOUT_MS);
      let r;
      try{
        r=await fetch(AIR_RESERVATIONS,{
          method:'POST',
          headers:{
            Accept:'application/json',
            'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
            corWclpKeyCd:env.AIRWAIT_API_KEY,
          },
          body:new URLSearchParams({
            storeId:'KR01205179',
            sortStatus:'0',
            isDesc:'0',
            start:String(start),
            limit:'100',
          }),
          cache:'no-store',
          signal:ctrl.signal,
        });
      }catch(e){
        if(e?.name==='AbortError')throw apiError('AIRWAIT_RECONCILE_TIMEOUT',504);
        throw e;
      }finally{clearTimeout(timer)}
      let d=null;try{d=await r.json()}catch{}
      if(!r.ok||d?.success!==true||d?.resultCode?.code!=='0000')throw apiError('AIRWAIT_RECONCILE_FAILED',502);
      const part=Array.isArray(d?.innerDto?.reservations)?d.innerDto.reservations:[];
      total=Math.max(0,Number(d?.innerDto?.count||part.length||0));
      rows.push(...part.map(x=>({
        number:String(x?.number||''),
        waitTypeId:String(x?.waitTypeId||''),
        waitTypeName:String(x?.waitTypeName||''),
        status:String(x?.status||''),
        isCalling:String(x?.isCalling||'0'),
      })));
      if(!part.length||rows.length>=total)break;
      start+=part.length;
      page+=1;
    }
    if(rows.length<total)throw apiError('AIRWAIT_RECONCILE_TRUNCATED',502);
    reconcileAllCache={savedAt:Date.now(),rows};
    return rows;
  })();

  reconcileAllInflight = job;
  try { return await job; }
  finally { if (reconcileAllInflight === job) reconcileAllInflight = null; }
}

function reservationState(row) {
  const status = String(row?.status || '');
  const isCalling = String(row?.isCalling || '') === '1';
  if (status === '3') return 'canceled';
  if (status === '2') return 'done';
  if (status === '4') return 'processing';
  if (status === '1') return 'hold';
  if (status === '0' && isCalling) return 'calling';
  if (status === '0') return 'waiting';
  return 'unknown';
}

async function releaseTerminalPreviousClaim(env, createPayload, existing) {
  if (!env?.DB || !env?.AIRWAIT_API_KEY) return false;
  try {
    const rows = await fetchAllReservationsForReconcile(env);
    const match = selectTicketMatch(rows, existing.receiptNo);
    const own = match.row;
    if (!own || !['2','3'].includes(String(own.status || ''))) return false;

    const claim = await env.DB.prepare(`SELECT user_hash,business_date,request_id,reserve_id,receipt_no,wait_type_id
      FROM v2_user_day_claims
      WHERE business_date=? AND reserve_id=? AND receipt_no=? AND state='CONFIRMED'
      LIMIT 1`)
      .bind(
        String(existing.businessDate || createPayload.operationalDate || ''),
        String(existing.reserveId || ''),
        String(existing.receiptNo || ''),
      ).first();
    if (!claim?.user_hash || !claim?.request_id) return false;

    const del = await env.DB.prepare(`DELETE FROM v2_user_day_claims
      WHERE user_hash=? AND business_date=? AND request_id=? AND reserve_id=? AND receipt_no=? AND state='CONFIRMED'`)
      .bind(
        String(claim.user_hash),
        String(claim.business_date),
        String(claim.request_id),
        String(claim.reserve_id),
        String(claim.receipt_no),
      ).run();
    if (Number(del?.meta?.changes || 0) !== 1) return false;

    await env.DB.batch([
      env.DB.prepare('DELETE FROM v2_request_results WHERE request_id=?').bind(String(createPayload.requestId || '')),
      env.DB.prepare('DELETE FROM v2_request_results WHERE request_id=?').bind(String(claim.request_id || '')),
    ]);
    return true;
  } catch (e) {
    console.warn('TERMINAL_PREVIOUS_CLAIM_RELEASE_FAILED', safeError(e));
    return false;
  }
}

async function fetchDevelopTestReservations(env, filters={}) {
  const rows = [];
  let start = 1;
  for (let page = 0; page < 20; page += 1) {
    const params = {
      storeId:'KR01205179',
      waitTypeId:DEVELOP_TEST_WAIT_TYPE_ID,
      sortStatus:'0',
      isDesc:'1',
      start:String(start),
      limit:'100',
      ...filters,
    };
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), EXTERNAL_READ_TIMEOUT_MS);
    let r;
    try {
      r = await fetch(AIR_RESERVATIONS, {
        method:'POST',
        headers:{
          Accept:'application/json',
          'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
          corWclpKeyCd:env.AIRWAIT_API_KEY,
        },
        body:new URLSearchParams(params),
        cache:'no-store',
        signal:ctrl.signal,
      });
    } catch(e){ if(e?.name==='AbortError') return []; throw e; }
    finally { clearTimeout(timer); }
    let d=null;try{d=await r.json()}catch{}
    if (!r.ok || d?.success !== true || d?.resultCode?.code !== '0000') return [];
    const part = Array.isArray(d?.innerDto?.reservations) ? d.innerDto.reservations : [];
    rows.push(...part.map(x=>({number:String(x?.number||''),status:String(x?.status||'')})));
    const total = Number(d?.innerDto?.count || part.length || 0);
    if (!part.length || rows.length >= total) break;
    start += part.length;
  }
  return rows;
}

function ticketParts(value) {
  const k=String(value||'').normalize('NFKC').toUpperCase().replace(/[\s\-ー]/g,'');
  const m=k.match(/^([FT]?)(\d+)$/);
  return m ? {prefix:m[1],digits:m[2].replace(/^0+(?=\d)/,'')} : null;
}
function ticketIdentity(value) {
  const p=ticketParts(value);
  return p ? p.prefix+p.digits : '';
}
function sameTicket(number, receiptNo) {
  const a=ticketParts(number),b=ticketParts(receiptNo);
  if(!a||!b||!a.digits||!b.digits||a.digits!==b.digits)return false;
  if(a.prefix&&b.prefix&&a.prefix!==b.prefix)return false;
  return true;
}
function selectTicketMatch(rows, receiptNo) {
  const list=Array.isArray(rows)?rows:[];
  const target=ticketIdentity(receiptNo);
  const exact=target?list.filter(r=>ticketIdentity(r?.number)===target):[];
  if(exact.length===1)return{row:exact[0],ambiguous:false,count:1,mode:'exact'};
  if(exact.length>1)return{row:null,ambiguous:true,count:exact.length,mode:'exact'};
  const loose=list.filter(r=>sameTicket(r?.number,receiptNo));
  if(loose.length===1)return{row:loose[0],ambiguous:false,count:1,mode:'compatible'};
  return{row:null,ambiguous:loose.length>1,count:loose.length,mode:'compatible'};
}

async function sha256Hex(value) {
  const b = new TextEncoder().encode(String(value || ''));
  const h = await crypto.subtle.digest('SHA-256', b);
  return Array.from(new Uint8Array(h), x=>x.toString(16).padStart(2,'0')).join('');
}

function rebuildCreateRequest(original, payload) {
  const headers = new Headers(original.headers);
  headers.set('Content-Type','application/x-www-form-urlencoded;charset=UTF-8');
  return new Request(original.url, {
    method:'POST',
    headers,
    body:new URLSearchParams(Object.entries(payload).map(([k,v])=>[k,String(v??'')])),
  });
}

function withDevelopingServiceDefaults(env) {
  // Developing owns this contract. Stale non-secret dashboard/workflow vars must
  // never override the verified template name, placeholders, or in-app routes.
  return {
    ...env,
    SERVICE_MESSAGE_TEMPLATE_NAME: DEVELOPING_SERVICE_TEMPLATE_NAME,
    SERVICE_MESSAGE_TEMPLATE_PARAMS_JSON: DEVELOPING_SERVICE_TEMPLATE_PARAMS,
  };
}
async function readBody(request) {
  const ct = String(request.headers.get('Content-Type') || '').toLowerCase();
  if (ct.includes('application/json')) return await request.json();
  return Object.fromEntries(new URLSearchParams(await request.text()));
}
function normalizeDate(v){
  const s=String(v||'').trim().replace(/\//g,'-'),m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(!m)return'';
  const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(Date.UTC(y,mo-1,d,12));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d)return'';
  return`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function originAllowed(request) { return String(request.headers.get('Origin') || '') === ALLOWED_ORIGIN; }
function corsHeaders(request) {
  const h = {
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Max-Age':'86400',
    'Cache-Control':'no-store',
    Vary:'Origin',
    'Content-Type':'application/json; charset=utf-8',
  };
  if (originAllowed(request)) h['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN;
  return h;
}
function json(request,payload,status=200){return new Response(JSON.stringify(payload),{status,headers:corsHeaders(request)});}
function safeError(e){return String(e?.message||e||'UNKNOWN_ERROR').replace(/[\r\n\t]+/g,' ').slice(0,500);}
function apiError(message,status=500){const e=new Error(String(message||'UNKNOWN_ERROR'));e.status=status;return e;}