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
} from './develop-service-message.js';

const ALLOWED_ORIGIN = 'https://asoboon.github.io';
const DEVELOP_TEST_WAIT_TYPE_ID = '0042';
const AIR_RESERVATIONS = 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations';
const BUSINESS_CALENDAR_API = 'https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec';
const BUSINESS_DAY_CACHE_MS = 60 * 1000;
const EXTERNAL_READ_TIMEOUT_MS = 8 * 1000;
const VALID_BUSINESS_TYPES = new Set(['平日','平日特定日','土日祝日','休館']);
const businessDayCache = new Map();
const businessDayInflight = new Map();
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

    if (request.method === 'GET' && action === 'businessDay') {
      if (!originAllowed(request)) return json(request, { ok:false, error:'ORIGIN_NOT_ALLOWED' }, 403);
      try { return json(request, await getBusinessDayProxy(url.searchParams.get('date'))); }
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
    if (request.method === 'POST') {
      try {
        createPayload = await readBody(request.clone());
        if (String(createPayload?.action || '') !== 'createReservation') createPayload = null;
      } catch { createPayload = null; }
    }

    if (createPayload && originAllowed(request)) {
      try {
        await prepareReservationNotification(env, createPayload);
      } catch (e) {
        return json(request, {
          ok:false,
          stored:false,
          notificationRequired:true,
          notificationReady:false,
          ambiguous:false,
          notificationAmbiguous:Boolean(e?.ambiguous),
          error:'LINE呼出通知を準備できないため、受付は作成されていません。もう一度お試しください。',
          errorCode:'LINE_NOTIFICATION_NOT_READY',
          notificationError:safeError(e),
        }, Number(e?.status || 503));
      }
    }

    let base = await gateway.fetch(request, env, ctx);
    if (!createPayload) return base;

    let body;
    try { body = await base.clone().json(); }
    catch { return base; }

    if (
      base.ok &&
      body?.ok === true &&
      body?.stored === true &&
      body?.alreadyExists === true &&
      String(createPayload.waitTypeId || '') === DEVELOP_TEST_WAIT_TYPE_ID &&
      String(body.waitTypeId || '') === DEVELOP_TEST_WAIT_TYPE_ID &&
      await releaseCanceledDevelopTestClaim(env, createPayload, body)
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

async function getBusinessDayProxy(value) {
  const date = normalizeDate(value);
  if (!date) throw apiError('BUSINESS_DATE_INVALID', 400);
  const now = Date.now();
  const cached = businessDayCache.get(date);
  if (cached && now - cached.savedAt < BUSINESS_DAY_CACHE_MS) return { ...cached.value, cached:true };
  if (businessDayInflight.has(date)) return businessDayInflight.get(date);

  const job = (async () => {
    const u = new URL(BUSINESS_CALENDAR_API);
    u.searchParams.set('action','current');
    u.searchParams.set('date',date);
    u.searchParams.set('_',String(Date.now()));
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), EXTERNAL_READ_TIMEOUT_MS);
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
    return valueOut;
  })();
  businessDayInflight.set(date,job);
  try { return await job; }
  finally { if (businessDayInflight.get(date) === job) businessDayInflight.delete(date); }
}

async function releaseCanceledDevelopTestClaim(env, createPayload, existing) {
  if (!env?.DB || !env?.AIRWAIT_API_KEY) return false;
  try {
    const activeRows = await fetchDevelopTestReservations(env, { isEnabledStatus:'1' });
    if (activeRows.some(r => sameTicket(r.number, existing.receiptNo))) return false;

    const canceledRows = await fetchDevelopTestReservations(env, { status:'3' });
    const own = canceledRows.find(r => sameTicket(r.number, existing.receiptNo));
    if (!own) return false;

    const claim = await env.DB.prepare(`SELECT user_hash,business_date,request_id,reserve_id,receipt_no,wait_type_id
      FROM v2_user_day_claims
      WHERE business_date=? AND reserve_id=? AND receipt_no=? AND wait_type_id=? AND state='CONFIRMED'
      LIMIT 1`)
      .bind(
        String(existing.businessDate || createPayload.operationalDate || ''),
        String(existing.reserveId || ''),
        String(existing.receiptNo || ''),
        DEVELOP_TEST_WAIT_TYPE_ID,
      ).first();
    if (!claim?.user_hash || !claim?.request_id) return false;

    const del = await env.DB.prepare(`DELETE FROM v2_user_day_claims
      WHERE user_hash=? AND business_date=? AND request_id=? AND reserve_id=? AND receipt_no=? AND wait_type_id=? AND state='CONFIRMED'`)
      .bind(
        String(claim.user_hash),
        String(claim.business_date),
        String(claim.request_id),
        String(claim.reserve_id),
        String(claim.receipt_no),
        DEVELOP_TEST_WAIT_TYPE_ID,
      ).run();
    if (Number(del?.meta?.changes || 0) !== 1) return false;

    await env.DB.batch([
      env.DB.prepare('DELETE FROM v2_request_results WHERE request_id=?').bind(String(createPayload.requestId || '')),
      env.DB.prepare('DELETE FROM v2_request_results WHERE request_id=?').bind(String(claim.request_id || '')),
    ]);

    return true;
  } catch (e) {
    console.warn('DEVELOP_TEST_CANCELED_CLAIM_RELEASE_FAILED', safeError(e));
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

function ticketIdentity(value) {
  const k=String(value||'').normalize('NFKC').toUpperCase().replace(/[\s\-ー]/g,'');
  const m=k.match(/^([FT]?)(\d+)$/);
  return m ? m[1]+m[2].replace(/^0+(?=\d)/,'') : '';
}
function sameTicket(number, receiptNo) {
  const a=ticketIdentity(number),b=ticketIdentity(receiptNo);
  return Boolean(a&&b&&a===b);
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
