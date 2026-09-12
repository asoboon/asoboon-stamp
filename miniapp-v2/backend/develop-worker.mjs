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

      // Keep the underlying AirWAIT create capability separate from the effective
      // browser-facing gate. Developing may create only when LINE call delivery is ready.
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

    // Mandatory notification gate: never create an AirWAIT reception that cannot
    // later produce the required LINE call notification.
    if (createPayload && originAllowed(request)) {
      try {
        await prepareReservationNotification(env, createPayload);
      } catch (e) {
        // AirWAIT has not been called at this point. Even if LINE token issuance
        // was ambiguous, the reception itself is definitely NOT ambiguous.
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

    // Developing-only recovery for repeated E2E tests.
    // The base gateway intentionally keeps one confirmed claim per LINE user/day.
    // If that one claim is the dedicated 0042 test slot and AirWAIT explicitly says
    // it is canceled (status=3), release only that exact claim and retry the SAME
    // requestId. This avoids returning an old canceled ticket as alreadyExists while
    // preserving production-slot behavior and notification-token idempotency.
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
      // The token was already prepared before AirWAIT create. A failed bind is
      // reconciled by the scheduled worker from the confirmed gateway claim.
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

async function releaseCanceledDevelopTestClaim(env, createPayload, existing) {
  if (!env?.DB || !env?.AIRWAIT_API_KEY) return false;
  try {
    const rows = await fetchDevelopTestReservations(env);
    const own = rows.find(r => sameTicket(r.number, existing.receiptNo));
    if (!own || String(own.status || '') !== '3') return false;

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

    // The first base pass only rediscovered the canceled ticket; neutralize that
    // no-op attempt before the real create retry.
    await env.DB.prepare(`UPDATE v2_user_attempts
      SET attempt_count=CASE WHEN attempt_count>0 THEN attempt_count-1 ELSE 0 END,updated_at=?
      WHERE user_hash=? AND business_date=?`)
      .bind(Date.now(), String(claim.user_hash), String(claim.business_date)).run();

    // The same requestId was just finalized with alreadyExists. Remove only that
    // current request result so the base gateway can own and execute it once more.
    await env.DB.prepare('DELETE FROM v2_request_results WHERE request_id=?')
      .bind(String(createPayload.requestId || '')).run();

    return true;
  } catch (e) {
    console.warn('DEVELOP_TEST_CANCELED_CLAIM_RELEASE_FAILED', safeError(e));
    return false;
  }
}

async function fetchDevelopTestReservations(env) {
  const rows = [];
  let start = 1;
  for (let page = 0; page < 20; page += 1) {
    const r = await fetch(AIR_RESERVATIONS, {
      method:'POST',
      headers:{
        Accept:'application/json',
        'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
        corWclpKeyCd:env.AIRWAIT_API_KEY,
      },
      body:new URLSearchParams({
        storeId:'KR01205179',
        waitTypeId:DEVELOP_TEST_WAIT_TYPE_ID,
        sortStatus:'0',
        isDesc:'0',
        start:String(start),
        limit:'100',
      }),
      cache:'no-store',
    });
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

function sameTicket(number, receiptNo) {
  const key=v=>String(v||'').normalize('NFKC').toUpperCase().replace(/[\s\-ー]/g,'');
  const a=key(number),b=key(receiptNo);
  if(!a||!b)return false;
  if(a===b)return true;
  const ad=a.replace(/\D/g,''),bd=b.replace(/\D/g,'');
  return /^[FT]/.test(a)&&ad&&bd&&ad===bd;
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
  return {
    ...env,
    SERVICE_MESSAGE_TEMPLATE_NAME:
      String(env?.SERVICE_MESSAGE_TEMPLATE_NAME || '').trim() || DEVELOPING_SERVICE_TEMPLATE_NAME,
    SERVICE_MESSAGE_TEMPLATE_PARAMS_JSON:
      String(env?.SERVICE_MESSAGE_TEMPLATE_PARAMS_JSON || '').trim() || DEVELOPING_SERVICE_TEMPLATE_PARAMS,
  };
}
async function readBody(request) {
  const ct = String(request.headers.get('Content-Type') || '').toLowerCase();
  if (ct.includes('application/json')) return await request.json();
  return Object.fromEntries(new URLSearchParams(await request.text()));
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
