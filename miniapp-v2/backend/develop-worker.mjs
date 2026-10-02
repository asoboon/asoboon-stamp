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
  sendCancellationNotification,
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
// AirWAIT getWaitInfo uses a display label for the weekday immediate-entry pool
// instead of the waitType master name/time. Keep this read-only alias explicit.
const CROWD_DETAIL_ALIASES = Object.freeze({
  '0024':Object.freeze(['すぐ入場受付【平日】']),
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
const SURPRISE_VOTE_PUBLIC_API = 'https://script.google.com/macros/s/AKfycbx2feW0JIP2aPmS2FX62D07etcaZE4Iq3FtqViLtpp0lsk0Z9aw3YuBQa94gtpH5Z3I/exec';
const SURPRISE_VOTE_PUBLIC_CACHE_MS = 5 * 60 * 1000;
const SURPRISE_VOTE_PUBLIC_STALE_MS = 12 * 60 * 60 * 1000;
const SURPRISE_VOTE_PUBLIC_TIMEOUT_MS = 25 * 1000;
const SURPRISE_VOTE_PUBLIC_STATE_KEY = 'surprise_vote_public_status:v1';
const BUSINESS_DAY_CACHE_MS = 30 * 60 * 1000;
const BUSINESS_DAY_STALE_FALLBACK_MS = 12 * 60 * 60 * 1000;
const EXTERNAL_READ_TIMEOUT_MS = 8 * 1000;
const BUSINESS_CALENDAR_READ_TIMEOUT_MS = 5 * 1000;
const RECONCILE_CACHE_MS = 5 * 1000;
const BOARD_BROWSER_TIMEOUT_BUDGET_MS = 20 * 1000;
const BOARD_SNAPSHOT_STALE_FALLBACK_MS = 3 * 60 * 1000;
const BOARD_PAGE_CONCURRENCY = 4;
const CONCURRENCY_AUDIT_KEY = 'concurrency_integrity_snapshot_v1';
const CONCURRENCY_AUDIT_LOOKBACK_MS = 10 * 60 * 1000;
const CONCURRENCY_AUDIT_GRACE_MS = 2 * 60 * 1000;
const CONCURRENCY_AUDIT_ROW_LIMIT = 5000;
const CONCURRENCY_AUDIT_TARGET_CLIENTS = 300;
const VALID_BUSINESS_TYPES = new Set(['平日','平日特定日','土日祝日','休館']);
const businessDayCache = new Map();
const businessDayInflight = new Map();
let reconcileAllCache = { savedAt:0, rows:[] };
let reconcileAllInflight = null;
const boardSnapshotMemory = new Map();
const boardSnapshotInflight = new Map();
let surpriseVotePublicMemory = { savedAt:0, data:null };
let surpriseVotePublicInflight = null;
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

    if (request.method === 'POST' && url.pathname === '/line-webhook') {
      return await handleOfficialLineWebhook(request, env, ctx);
    }

    if (request.method === 'GET' && action === 'createDiagnostics') {
      const denied = diagnosticsDenied(request, env);
      if (denied) return denied;
      try { return json(request, await getCreateDiagnostics(env)); }
      catch (e) { return json(request, { ok:false, error:safeError(e) }, Number(e?.status || 503)); }
    }

    if (request.method === 'GET' && action === 'concurrencyAudit') {
      const denied = diagnosticsDenied(request, env);
      if (denied) return denied;
      try { return json(request, await runConcurrencyIntegrityAudit(env)); }
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

    if (request.method === 'GET' && action === 'surpriseVotePublicStatus') {
      if (!originAllowed(request)) return json(request, { ok:false, error:'ORIGIN_NOT_ALLOWED' }, 403);
      try { return json(request, await getSurpriseVotePublicStatus(env, ctx)); }
      catch (e) { return json(request, { ok:false, error:safeError(e) }, Number(e?.status || 503)); }
    }

    if (request.method === 'GET' && action === 'businessDay') {
      if (!originAllowed(request)) return json(request, { ok:false, error:'ORIGIN_NOT_ALLOWED' }, 403);
      try { return json(request, await getBusinessDayProxy(url.searchParams.get('date'), env)); }
      catch (e) { return json(request, { ok:false, error:safeError(e) }, Number(e?.status || 503)); }
    }

    if (request.method === 'GET' && action === 'serviceMessageStatus') {
      const denied = diagnosticsDenied(request, env);
      if (denied) return denied;
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
      body.concurrencyIntegrityAuditEnabled = true;
      body.concurrencyIntegrityAuditTargetClients = CONCURRENCY_AUDIT_TARGET_CLIENTS;
      body.concurrencyIntegrityAuditHotPathWrites = false;
      body.concurrencyIntegrityAuditScheduledEveryMinute = true;
      body.officialLineCancelWebhookEnabled = true;
      body.officialLineWebhookPath = '/line-webhook';
      body.officialLineWebhookSecretConfigured = Boolean(String(env.LINE_OA_CHANNEL_SECRET || '').trim());
      body.officialLineAccessTokenConfigured = Boolean(String(env.LINE_OA_CHANNEL_ACCESS_TOKEN || '').trim());
      body.officialLineCancelReady = body.officialLineWebhookSecretConfigured && body.officialLineAccessTokenConfigured;
      body.officialLineCancelOneToOneOnly = true;
      body.officialLineWebhookFastAck = true;
      body.officialLineReserveIdNormalizer = 'strict-12-digit';
      body.officialLineCancelFlowVersion = '2.0-immediate-reply-then-push';
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
    let recoverReservationPayload = null;
    let cancelReservationPayload = null;
    if (request.method === 'POST') {
      try {
        const postPayload = await readBody(request.clone());
        const postAction = String(postPayload?.action || '');
        if (postAction === 'createReservation') createPayload = postPayload;
        if (postAction === 'adoptOfficialWebReception') adoptPayload = postPayload;
        if (postAction === 'reservationStatus') reservationStatusPayload = postPayload;
        if (postAction === 'recoverReservationSession') recoverReservationPayload = postPayload;
        if (postAction === 'cancelReservation') cancelReservationPayload = postPayload;
      } catch {
        createPayload = null;
        adoptPayload = null;
        reservationStatusPayload = null;
        recoverReservationPayload = null;
        cancelReservationPayload = null;
      }
    }

    if (createPayload && originAllowed(request)) {
      // A requestId belongs to the LINE user who first used it. Check before a
      // notification token is issued, so a replayed requestId can never attach
      // another user's LINE token to an existing reservation.
      try { await assertCreateRequestOwner(env, createPayload); }
      catch (e) {
        return json(request, { ok:false, stored:false, ambiguous:false, error:safeError(e) }, Number(e?.status || 403));
      }
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

    if (reservationStatusPayload) {
      try { await repairReservationSessionWaitType(env,reservationStatusPayload); }
      catch(e){ console.warn('CALLSTATUS_AUTHORITATIVE_WAITTYPE_REPAIR_FAILED',safeError(e)); }
    }
    if (recoverReservationPayload) {
      try { await repairRecoveryClaimWaitType(env,recoverReservationPayload); }
      catch(e){ console.warn('CALLSTATUS_RECOVERY_WAITTYPE_REPAIR_FAILED',safeError(e)); }
    }

    let base = await gateway.fetch(request, env, ctx);
    if (reservationStatusPayload) {
      const statusResponse = await reconcileReservationStatus(request, env, base, reservationStatusPayload);
      try { await persistTerminalClaimFromStatus(env,reservationStatusPayload,statusResponse); }
      catch(e){ console.warn('CALLSTATUS_TERMINAL_PERSIST_FAILED',safeError(e)); }
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
    if (body?.alreadyExists === true) return base;

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
    ctx.waitUntil(runConcurrencyIntegrityAudit(env).catch(e => console.error('concurrency-integrity-audit', safeError(e))));
    ctx.waitUntil(refreshSurpriseVotePublicStatus(env, ctx).catch(e => console.warn('surprise-vote-public-warm', safeError(e))));
  },
};

function surpriseVotePublicPhaseSafe(data, savedAt=0, maxAge=SURPRISE_VOTE_PUBLIC_CACHE_MS) {
  if (!data || data.ok !== true) return false;
  const now = Date.now();
  const age = now - Number(savedAt || 0);
  if (age < 0 || age > maxAge) return false;

  const event = data.event || {};
  const start = Date.parse(event.vote_start || '');
  const end = Date.parse(event.vote_end || '');
  const settleEnd = Date.parse(event.settle_end || '');

  if (data.mode === 'upcoming') return !Number.isFinite(start) || now < start;
  if (data.mode === 'voting') {
    return (!Number.isFinite(start) || now >= start) && (!Number.isFinite(end) || now < end);
  }
  if (data.mode === 'settling') {
    return (!Number.isFinite(end) || now >= end) && (!Number.isFinite(settleEnd) || now < settleEnd);
  }
  if (data.mode === 'result') {
    // A finished result stays useful until the next round actually opens.
    // result_end only controls the old "current phase" highlight; it must not
    // force every later page view back to slow GAS reads.
    const selectedStart = Date.parse(event.vote_start || '');
    const laterStarts = (Array.isArray(data.day_events) ? data.day_events : [])
      .map(item => Date.parse(item?.vote_start || ''))
      .filter(value => Number.isFinite(value) && (!Number.isFinite(selectedStart) || value > selectedStart));
    if (laterStarts.length && now >= Math.min(...laterStarts)) return false;

    const date = String(event.date || '').trim();
    const reset = String(data.daily_reset || '18:00').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(reset)) {
      const resetAt = Date.parse(`${date}T${reset}:00+09:00`);
      if (Number.isFinite(resetAt) && now >= resetAt) return false;
    }
    return true;
  }
  if (data.mode === 'idle') return age < Math.min(maxAge, 60 * 1000);
  return age < Math.min(maxAge, 30 * 1000);
}

function surpriseVotePublicCacheValid(data, savedAt=0) {
  return surpriseVotePublicPhaseSafe(data, savedAt, SURPRISE_VOTE_PUBLIC_CACHE_MS);
}

function surpriseVotePublicStaleUsable(data, savedAt=0) {
  return surpriseVotePublicPhaseSafe(data, savedAt, SURPRISE_VOTE_PUBLIC_STALE_MS);
}

function surpriseVotePublicForClient(data, source) {
  const out = JSON.parse(JSON.stringify(data || {}));
  delete out.user;
  out.now = new Date().toISOString();
  out.edge_cache = source;
  return out;
}

async function readSurpriseVotePublicD1(env) {
  if (!await ensureWorkerStateTable(env)) return null;
  try {
    const row = await env.DB.prepare(
      'SELECT value,updated_at FROM v2_system_state WHERE key=? LIMIT 1'
    ).bind(SURPRISE_VOTE_PUBLIC_STATE_KEY).first();
    if (!row) return null;
    const data = JSON.parse(String(row.value || ''));
    if (!data || data.ok !== true) return null;
    return { savedAt:Number(row.updated_at || 0), data };
  } catch (e) {
    console.warn('SURPRISE_VOTE_PUBLIC_D1_READ_FAILED', safeError(e));
    return null;
  }
}

async function writeSurpriseVotePublicD1(env, savedAt, data) {
  if (!await ensureWorkerStateTable(env)) return;
  try {
    await env.DB.prepare(
      'INSERT INTO v2_system_state(key,value,updated_at) VALUES(?,?,?) ' +
      'ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at'
    ).bind(
      SURPRISE_VOTE_PUBLIC_STATE_KEY,
      JSON.stringify(data),
      Number(savedAt || Date.now())
    ).run();
  } catch (e) {
    console.warn('SURPRISE_VOTE_PUBLIC_D1_WRITE_FAILED', safeError(e));
  }
}

async function getSurpriseVotePublicStatus(env, ctx) {
  if (surpriseVotePublicCacheValid(surpriseVotePublicMemory.data, surpriseVotePublicMemory.savedAt)) {
    return surpriseVotePublicForClient(surpriseVotePublicMemory.data, 'memory');
  }

  const cacheKey = new Request('https://asoboon.internal/surprise-vote/public-status');
  let edgeBox = null;
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      edgeBox = await cached.json();
      if (surpriseVotePublicCacheValid(edgeBox?.data, edgeBox?.savedAt)) {
        surpriseVotePublicMemory = { savedAt:Number(edgeBox.savedAt || Date.now()), data:edgeBox.data };
        return surpriseVotePublicForClient(edgeBox.data, 'edge');
      }
    }
  } catch {}

  const d1 = await readSurpriseVotePublicD1(env);
  if (d1 && surpriseVotePublicCacheValid(d1.data, d1.savedAt)) {
    surpriseVotePublicMemory = { savedAt:d1.savedAt, data:d1.data };
    return surpriseVotePublicForClient(d1.data, 'd1');
  }

  // Never make a visitor wait for a GAS cold start. If the snapshot is still
  // semantically safe, serve it now and refresh it in the background.
  const stale =
    (d1 && surpriseVotePublicStaleUsable(d1.data, d1.savedAt) && d1) ||
    (edgeBox && surpriseVotePublicStaleUsable(edgeBox.data, edgeBox.savedAt) && edgeBox) ||
    (surpriseVotePublicStaleUsable(surpriseVotePublicMemory.data, surpriseVotePublicMemory.savedAt)
      ? surpriseVotePublicMemory
      : null);

  if (stale) {
    const refreshJob = refreshSurpriseVotePublicStatus(env, ctx)
      .catch(e => console.warn('surprise-vote-public-refresh', safeError(e)));
    if (ctx?.waitUntil) ctx.waitUntil(refreshJob);
    surpriseVotePublicMemory = { savedAt:Number(stale.savedAt || 0), data:stale.data };
    return surpriseVotePublicForClient(stale.data, 'stale');
  }

  // First-ever cache miss: start warming immediately, but fail fast so the
  // browser can use its direct GAS fallback instead of waiting twice.
  const warmJob = refreshSurpriseVotePublicStatus(env, ctx)
    .catch(e => console.warn('surprise-vote-public-first-warm', safeError(e)));
  if (ctx?.waitUntil) ctx.waitUntil(warmJob);
  throw apiError('SURPRISE_VOTE_PUBLIC_WARMING', 503);
}

async function refreshSurpriseVotePublicStatus(env, ctx) {
  if (surpriseVotePublicInflight) return await surpriseVotePublicInflight;

  surpriseVotePublicInflight = (async()=>{
    const url = new URL(SURPRISE_VOTE_PUBLIC_API);
    url.searchParams.set('action','status');
    url.searchParams.set('_',String(Date.now()));

    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), SURPRISE_VOTE_PUBLIC_TIMEOUT_MS);
    let data;
    try {
      const response = await fetch(url.toString(), {
        method:'GET',
        headers:{ Accept:'application/json' },
        cache:'no-store',
        signal:controller.signal,
      });
      if (!response.ok) throw apiError(`SURPRISE_VOTE_HTTP_${response.status}`, 503);
      data = await response.json();
    } finally {
      clearTimeout(timer);
    }

    if (!data || data.ok !== true) throw apiError('SURPRISE_VOTE_PUBLIC_STATUS_INVALID', 503);
    delete data.user;
    const savedAt = Date.now();
    surpriseVotePublicMemory = { savedAt, data };

    const jobs = [writeSurpriseVotePublicD1(env, savedAt, data)];
    try {
      const cacheKey = new Request('https://asoboon.internal/surprise-vote/public-status');
      const cacheResponse = new Response(JSON.stringify({ savedAt, data }), {
        headers:{ 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'public, max-age=300' },
      });
      jobs.push(caches.default.put(cacheKey, cacheResponse));
    } catch {}

    const persist = Promise.allSettled(jobs);
    if (ctx?.waitUntil) ctx.waitUntil(persist);
    else await persist;

    return surpriseVotePublicForClient(data, 'origin');
  })();

  try { return await surpriseVotePublicInflight; }
  finally { surpriseVotePublicInflight = null; }
}

async function assertCreateRequestOwner(env, payload) {
  if (!env?.DB) return;
  const requestId = String(payload?.requestId || '').trim();
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(requestId)) return; // gateway rejects it with REQUEST_ID_REQUIRED
  const hash = await verifyCancelLineUser(payload?.liffAccessToken);
  let recorded = '';
  try {
    const row = await env.DB.prepare('SELECT * FROM v2_request_results WHERE request_id=? LIMIT 1').bind(requestId).first();
    recorded = String(row?.user_hash || '');
  } catch (e) { if (!/no such table/i.test(String(e?.message || e))) throw e; }
  let claimed = '';
  try {
    const claim = await env.DB.prepare('SELECT user_hash FROM v2_user_day_claims WHERE request_id=? LIMIT 1').bind(requestId).first();
    claimed = String(claim?.user_hash || '');
  } catch (e) { if (!/no such table/i.test(String(e?.message || e))) throw e; }
  const owner = recorded || claimed;
  if (owner && owner !== hash) throw apiError('REQUEST_OWNER_MISMATCH', 403);
}

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

function rollingPeak(timestamps, windowMs) {
  const xs=(Array.isArray(timestamps)?timestamps:[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  let left=0,best=0;
  for(let right=0;right<xs.length;right+=1){
    while(left<=right&&xs[right]-xs[left]>=windowMs)left+=1;
    best=Math.max(best,right-left+1);
  }
  return best;
}

function countStates(rows) {
  const out={};
  for(const row of Array.isArray(rows)?rows:[]){
    const key=String(row?.state||'UNKNOWN');
    out[key]=(out[key]||0)+1;
  }
  return out;
}

async function readConcurrencyIntegritySnapshot(env) {
  if(!await ensureWorkerStateTable(env))return null;
  const row=await env.DB.prepare('SELECT value,updated_at FROM v2_system_state WHERE key=? LIMIT 1')
    .bind(CONCURRENCY_AUDIT_KEY).first();
  if(!row)return null;
  try{
    const value=JSON.parse(String(row.value||''));
    return value&&typeof value==='object'?{...value,snapshotAgeMs:Math.max(0,Date.now()-Number(row.updated_at||0))}:null;
  }catch{return null}
}

async function runConcurrencyIntegrityAudit(env) {
  if(!env?.DB)throw apiError('DB_NOT_CONFIGURED',503);
  await ensureWorkerStateTable(env);
  // Ensures notification tables exist. This is local D1 work only; no LINE/AirWAIT call.
  await serviceHealth(env);

  const now=Date.now();
  const since=now-CONCURRENCY_AUDIT_LOOKBACK_MS;
  const businessDate=currentOperationalDate(now);

  let requestRows=[];
  try{
    const r=await env.DB.prepare(`SELECT request_id,user_hash,state,created_at,updated_at
      FROM v2_request_results WHERE action='createReservation'
      ORDER BY created_at DESC LIMIT ${CONCURRENCY_AUDIT_ROW_LIMIT}`).all();
    requestRows=Array.isArray(r?.results)?r.results:[];
  }catch(e){
    if(!/no such column:\s*user_hash/i.test(String(e?.message||e)))throw e;
    const r=await env.DB.prepare(`SELECT request_id,'' AS user_hash,state,created_at,updated_at
      FROM v2_request_results WHERE action='createReservation'
      ORDER BY created_at DESC LIMIT ${CONCURRENCY_AUDIT_ROW_LIMIT}`).all();
    requestRows=Array.isArray(r?.results)?r.results:[];
  }
  const recentRequests=requestRows.filter(row=>Number(row?.created_at||0)>=since);

  const claimsResult=await env.DB.prepare(`SELECT user_hash,business_date,request_id,state,receipt_no,reserve_id,wait_type_id,created_at,updated_at
    FROM v2_user_day_claims WHERE business_date=?
    ORDER BY created_at DESC LIMIT ${CONCURRENCY_AUDIT_ROW_LIMIT}`).bind(businessDate).all();
  const claims=Array.isArray(claimsResult?.results)?claimsResult.results:[];

  const messagesResult=await env.DB.prepare(`SELECT business_date,receipt_no,reserve_id,wait_type_id,request_id,status,notified_at,created_at,updated_at
    FROM v2_service_messages WHERE business_date=?
    ORDER BY created_at DESC LIMIT ${CONCURRENCY_AUDIT_ROW_LIMIT}`).bind(businessDate).all();
  const messages=Array.isArray(messagesResult?.results)?messagesResult.results:[];

  const confirmationsResult=await env.DB.prepare(`SELECT business_date,reserve_id,receipt_no,request_id,status,sent_at,created_at,updated_at
    FROM v2_service_confirmations WHERE business_date=?
    ORDER BY created_at DESC LIMIT ${CONCURRENCY_AUDIT_ROW_LIMIT}`).bind(businessDate).all();
  const confirmations=Array.isArray(confirmationsResult?.results)?confirmationsResult.results:[];

  const requestById=new Map(requestRows.map(row=>[String(row?.request_id||''),row]));
  const messageByReserve=new Map(messages.map(row=>[String(row?.reserve_id||''),row]));
  const confirmationByReserve=new Map(confirmations.map(row=>[String(row?.reserve_id||''),row]));
  const reserveCounts=new Map();
  const slotReceiptCounts=new Map();

  const identity={
    requestOwnerMismatch:0,
    serviceBindingMismatch:0,
    confirmationBindingMismatch:0,
    duplicateReserveId:0,
    duplicateSlotReceipt:0,
  };
  const delivery={
    requestBindingMissing:0,
    serviceBindingMissing:0,
    confirmationMissing:0,
    staleCreateInflight:0,
  };

  for(const claim of claims){
    const userHash=String(claim?.user_hash||'');
    const requestId=String(claim?.request_id||'');
    const reserveId=String(claim?.reserve_id||'');
    const receiptNo=String(claim?.receipt_no||'');
    const waitTypeId=String(claim?.wait_type_id||'');
    const state=String(claim?.state||'');
    const age=Math.max(0,now-Number(claim?.created_at||claim?.updated_at||now));

    if(reserveId)reserveCounts.set(reserveId,(reserveCounts.get(reserveId)||0)+1);
    if(receiptNo&&waitTypeId){
      const key=`${businessDate}|${waitTypeId}|${receiptNo}`;
      slotReceiptCounts.set(key,(slotReceiptCounts.get(key)||0)+1);
    }

    const request=requestById.get(requestId);
    if(request){
      const owner=String(request?.user_hash||'');
      if(owner&&userHash&&owner!==userHash)identity.requestOwnerMismatch+=1;
    }else if(age>=CONCURRENCY_AUDIT_GRACE_MS){
      delivery.requestBindingMissing+=1;
    }

    if(state==='CREATE_INFLIGHT'&&age>=CONCURRENCY_AUDIT_GRACE_MS)delivery.staleCreateInflight+=1;

    if(reserveId&&receiptNo&&waitTypeId){
      const message=messageByReserve.get(reserveId);
      if(message){
        if(String(message.request_id||'')!==requestId||String(message.receipt_no||'')!==receiptNo||String(message.wait_type_id||'')!==waitTypeId){
          identity.serviceBindingMismatch+=1;
        }
      }else if(age>=CONCURRENCY_AUDIT_GRACE_MS&&['CONFIRMED','COMPLETED','CANCELED'].includes(state)){
        delivery.serviceBindingMissing+=1;
      }

      const confirmation=confirmationByReserve.get(reserveId);
      if(confirmation){
        if(String(confirmation.request_id||'')!==requestId||String(confirmation.receipt_no||'')!==receiptNo){
          identity.confirmationBindingMismatch+=1;
        }
      }else if(age>=CONCURRENCY_AUDIT_GRACE_MS&&['CONFIRMED','COMPLETED','CANCELED'].includes(state)){
        delivery.confirmationMissing+=1;
      }
    }
  }

  identity.duplicateReserveId=[...reserveCounts.values()].filter(n=>n>1).length;
  identity.duplicateSlotReceipt=[...slotReceiptCounts.values()].filter(n=>n>1).length;
  const identityIssues=Object.values(identity).reduce((a,b)=>a+Number(b||0),0);
  const deliveryIssues=Object.values(delivery).reduce((a,b)=>a+Number(b||0),0);
  const recentTimes=recentRequests.map(row=>Number(row?.created_at||0));

  const summary={
    ok:identityIssues===0&&deliveryIssues===0,
    status:identityIssues>0?'critical':deliveryIssues>0?'warning':'ok',
    source:'D1 post-facto concurrency integrity audit; no user identity exposed',
    auditedAt:new Date(now).toISOString(),
    businessDate,
    lookbackMs:CONCURRENCY_AUDIT_LOOKBACK_MS,
    burst:{
      targetConcurrentClients:CONCURRENCY_AUDIT_TARGET_CLIENTS,
      createRequestsSeen:recentRequests.length,
      peak1s:rollingPeak(recentTimes,1000),
      peak5s:rollingPeak(recentTimes,5000),
      peak30s:rollingPeak(recentTimes,30000),
      requestStates:countStates(recentRequests),
    },
    bindings:{
      claimsAudited:claims.length,
      serviceRowsAudited:messages.length,
      confirmationRowsAudited:confirmations.length,
      claimStates:countStates(claims),
    },
    identityIntegrity:{ok:identityIssues===0,issueCount:identityIssues,...identity},
    deliveryIntegrity:{ok:deliveryIssues===0,issueCount:deliveryIssues,...delivery},
    sampleTruncated:{
      requests:requestRows.length>=CONCURRENCY_AUDIT_ROW_LIMIT,
      claims:claims.length>=CONCURRENCY_AUDIT_ROW_LIMIT,
      messages:messages.length>=CONCURRENCY_AUDIT_ROW_LIMIT,
      confirmations:confirmations.length>=CONCURRENCY_AUDIT_ROW_LIMIT,
    },
    hotPathWritesAdded:0,
  };

  await env.DB.prepare(`INSERT INTO v2_system_state(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
    .bind(CONCURRENCY_AUDIT_KEY,JSON.stringify(summary),now).run();

  if(identityIssues>0)console.error('CONCURRENCY_IDENTITY_INTEGRITY_CRITICAL',JSON.stringify(summary.identityIntegrity));
  else if(deliveryIssues>0)console.warn('CONCURRENCY_DELIVERY_INTEGRITY_WARNING',JSON.stringify(summary.deliveryIntegrity));
  return summary;
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
  let reconcileRows=[];
  try{
    reconcileRows=await fetchAllReservationsForReconcile(env);
    const agg=new Map();
    for(const row of reconcileRows){
      const id=String(row?.waitTypeId||'');
      if(!id)continue;
      const cur=agg.get(id)||{waitTypeId:id,waitTypeName:String(row?.waitTypeName||''),total:0,waiting:0,calling:0,hold:0,done:0,canceled:0,processing:0};
      cur.total+=1;
      const state=reservationState(row);
      if(Object.prototype.hasOwnProperty.call(cur,state))cur[state]+=1;
      agg.set(id,cur);
    }
    liveWaitTypes.push(...Array.from(agg.values()).sort((a,b)=>a.waitTypeId.localeCompare(b.waitTypeId)));
  }catch(e){
    liveWaitTypes.push({error:safeError(e)});
  }

  const cancelReadiness=[];
  try{
    const r=await env.DB.prepare(`SELECT c.business_date,c.wait_type_id,c.reserve_id,c.receipt_no,c.updated_at,rr.result_json
      FROM v2_user_day_claims c
      LEFT JOIN v2_request_results rr ON rr.request_id=c.request_id
      WHERE c.state='CONFIRMED' AND c.updated_at>=?
      ORDER BY c.updated_at DESC LIMIT 12`).bind(now-2*24*60*60*1000).all();
    for(const row of Array.isArray(r?.results)?r.results:[]){
      let result={};try{result=row?.result_json?JSON.parse(String(row.result_json)):{};}catch{}
      const rawShort=String(result?.shortUrl||'').trim();
      let shortHost='';try{shortHost=rawShort?new URL(rawShort).hostname:''}catch{}
      const match=selectTicketMatch(reconcileRows,String(row?.receipt_no||''));
      const liveState=reservationState(match?.row||null);
      const reserve=String(row?.reserve_id||'');
      cancelReadiness.push({
        businessDate:String(row?.business_date||''),
        waitTypeId:String(row?.wait_type_id||''),
        updatedAt:Number(row?.updated_at||0),
        reserveIdValid:/^\d{12}$/.test(reserve),
        hasRequestResult:Boolean(row?.result_json),
        hasShortUrl:Boolean(rawShort),
        shortUrlHost:shortHost,
        liveMatch:Boolean(match?.row),
        liveState,
        cancellable:['waiting','calling','hold'].includes(liveState),
      });
    }
  }catch(e){
    cancelReadiness.push({error:safeError(e)});
  }

  let concurrencyAudit=null;
  try{concurrencyAudit=await runConcurrencyIntegrityAudit(env)}
  catch(e){concurrencyAudit={ok:false,status:'unavailable',error:safeError(e)}}

  return {
    ok:true,
    source:'Developing sanitized create diagnostics / no user identity',
    fetchedAt:new Date().toISOString(),
    attempts,
    legacy,
    confirmed,
    liveWaitTypes,
    cancelReadiness,
    concurrencyAudit,
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
    const aliasNames=Array.isArray(CROWD_DETAIL_ALIASES[waitTypeId])?CROWD_DETAIL_ALIASES[waitTypeId]:[];
    const aliasMatches=aliasNames.length
      ?details.filter(row=>aliasNames.some(name=>norm(row.detailedWaitType)===norm(name)))
      :[];
    const slotMatches=expectedSlot?details.filter(row=>row.slotKey===expectedSlot):[];
    const matchMode=exactMatches.length===1
      ?'exact-name'
      :exactMatches.length===0&&aliasMatches.length===1
        ?'alias-name'
        :exactMatches.length===0&&aliasMatches.length===0&&slotMatches.length===1
          ?'time-key'
          :'';
    const matched=matchMode==='exact-name'
      ?exactMatches[0]
      :matchMode==='alias-name'
        ?aliasMatches[0]
        :matchMode==='time-key'
          ?slotMatches[0]
          :null;
    const raw=matched?.remainingNum;
    const n=(typeof raw==='number'||(typeof raw==='string'&&/^\d+$/.test(raw)))?Number(raw):NaN;
    const valid=matched?.reserveUnit==='PERSON'&&Number.isSafeInteger(n)&&n>=0&&n<=350;
    const matchCount=exactMatches.length>0
      ?exactMatches.length
      :aliasMatches.length>0
        ?aliasMatches.length
        :slotMatches.length;
    const evidence=!matched
      ?(matchCount>1?'AMBIGUOUS_MATCH':'NO_MATCH')
      :(valid?'PERSON':'UNVERIFIED_UNIT_OR_VALUE');
    diagnostics.push({
      waitTypeId,
      waitTypeName:waitTypeName.slice(0,120),
      expectedSlot,
      exactMatchCount:exactMatches.length,
      aliasMatchCount:aliasMatches.length,
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
  for(let start=101;start<=total&&start<=99999;start+=100)starts.push(start);
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

const CALLSTATUS_CLOSE_BY_WAITTYPE=Object.freeze({
  '0023':'17:00','0024':'17:00','0025':'17:00','0027':'17:00',
  '0035':'17:00','0036':'17:00','0037':'17:00','0038':'17:00',
  '0029':'18:00','0030':'18:00','0031':'18:00','0032':'18:00','0033':'18:00','0034':'18:00',
  '0042':'19:00',
});
function closeEpochForReservation(businessDate,waitTypeId){
  const date=normalizeDate(businessDate),hm=String(CALLSTATUS_CLOSE_BY_WAITTYPE[String(waitTypeId||'')]||'');
  if(!date||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hm))return 0;
  const ms=Date.parse(date+'T'+hm+':00+09:00');
  return Number.isFinite(ms)?ms:0;
}
function closedReservationFallback(body){
  const closeAt=closeEpochForReservation(body?.businessDate,body?.waitTypeId);
  if(!closeAt||Date.now()<closeAt)return null;
  return{
    ...body,
    ok:true,
    found:true,
    state:'closed',
    status:'closed',
    isCalling:false,
    aheadCount:null,
    queueRank:null,
    activeCount:0,
    checkedAt:Date.now(),
    syntheticTerminal:true,
    terminalReason:'BUSINESS_DAY_CLOSED',
    closedAt:closeAt,
    reconciledBy:'business-close-fallback',
  };
}

async function repairReservationSessionWaitType(env,payload){
  if(!env?.DB)return;
  const rawToken=String(payload?.sessionToken||'').trim();
  if(rawToken.length<32||rawToken.length>256)return;
  const tokenHash=await sha256Hex(rawToken);
  const session=await env.DB.prepare('SELECT user_hash,business_date,reserve_id,receipt_no,wait_type_id,expires_at FROM v2_reservation_sessions WHERE token_hash=? LIMIT 1')
    .bind(tokenHash).first();
  if(!session)return;
  await authoritativeWaitTypeForSession(env,session,{tokenHash});
}
async function repairRecoveryClaimWaitType(env,payload){
  if(!env?.DB)return;
  const userHash=await verifyCancelLineUser(payload?.liffAccessToken);
  const date=normalizeDate(payload?.businessDate||'')||currentJstDate();
  const row=await env.DB.prepare(`SELECT c.user_hash,c.business_date,c.reserve_id,c.receipt_no,c.wait_type_id,c.request_id,t.wait_type_id AS token_wait_type
    FROM v2_user_day_claims c
    LEFT JOIN v2_service_token_claims t ON t.request_id=c.request_id
    WHERE c.user_hash=? AND c.business_date=? AND c.state='CONFIRMED'
    ORDER BY c.updated_at DESC LIMIT 1`).bind(userHash,date).first();
  const authoritative=String(row?.token_wait_type||'');
  if(!row||!/^\d{4}$/.test(authoritative)||authoritative===String(row.wait_type_id||''))return;
  await env.DB.prepare(`UPDATE v2_user_day_claims SET wait_type_id=?,updated_at=?
    WHERE user_hash=? AND business_date=? AND request_id=? AND state='CONFIRMED'`)
    .bind(authoritative,Date.now(),String(row.user_hash||''),String(row.business_date||''),String(row.request_id||'')).run();
}

async function authoritativeWaitTypeForSession(env,session,{tokenHash=''}={}){
  if(!env?.DB||!session)return String(session?.wait_type_id||'');
  let row=null;
  try{
    row=await env.DB.prepare(`SELECT c.request_id,c.wait_type_id AS claim_wait_type,t.wait_type_id AS token_wait_type
      FROM v2_user_day_claims c
      LEFT JOIN v2_service_token_claims t ON t.request_id=c.request_id
      WHERE c.user_hash=? AND c.business_date=? AND c.reserve_id=? AND c.receipt_no=?
      LIMIT 1`)
      .bind(
        String(session.user_hash||''),
        String(session.business_date||''),
        String(session.reserve_id||''),
        String(session.receipt_no||'')
      ).first();
  }catch{}
  const tokenWait=String(row?.token_wait_type||'');
  const claimWait=String(row?.claim_wait_type||'');
  const current=String(session?.wait_type_id||'');
  const authoritative=/^\d{4}$/.test(tokenWait)?tokenWait:/^\d{4}$/.test(claimWait)?claimWait:current;
  if(authoritative&&authoritative!==claimWait){
    try{
      await env.DB.prepare(`UPDATE v2_user_day_claims SET wait_type_id=?,updated_at=?
        WHERE user_hash=? AND business_date=? AND reserve_id=? AND receipt_no=?`)
        .bind(authoritative,Date.now(),String(session.user_hash||''),String(session.business_date||''),String(session.reserve_id||''),String(session.receipt_no||'')).run();
    }catch{}
  }
  if(authoritative&&tokenHash&&authoritative!==current){
    try{
      await env.DB.prepare('UPDATE v2_reservation_sessions SET wait_type_id=? WHERE token_hash=?')
        .bind(authoritative,String(tokenHash)).run();
    }catch{}
  }
  return authoritative||current;
}

async function persistTerminalClaimFromStatus(env,payload,response){
  if(!env?.DB||!payload||!response?.ok)return false;
  let body=null;try{body=await response.clone().json()}catch{return false}
  const state=String(body?.state||'');
  const nextState=state==='done'?'COMPLETED':state==='canceled'?'CANCELED':'';
  if(!nextState||body?.found!==true)return false;
  const rawToken=String(payload?.sessionToken||'').trim();
  if(rawToken.length<32)return false;
  const tokenHash=await sha256Hex(rawToken);
  const session=await env.DB.prepare('SELECT user_hash,business_date,reserve_id,receipt_no,wait_type_id,expires_at FROM v2_reservation_sessions WHERE token_hash=? LIMIT 1')
    .bind(tokenHash).first();
  if(!session||Number(session.expires_at||0)<=Date.now())return false;
  if(body?.reserveId&&String(body.reserveId)!==String(session.reserve_id||''))return false;
  if(body?.receiptNo&&String(body.receiptNo)!==String(session.receipt_no||''))return false;
  const waitTypeId=String(body?.waitTypeId||session.wait_type_id||'');
  const changed=await env.DB.prepare(`UPDATE v2_user_day_claims SET state=?,updated_at=?
    WHERE user_hash=? AND business_date=? AND reserve_id=? AND receipt_no=? AND wait_type_id=? AND state='CONFIRMED'`)
    .bind(nextState,Date.now(),String(session.user_hash||''),String(session.business_date||''),String(session.reserve_id||''),String(session.receipt_no||''),waitTypeId).run();
  return Number(changed?.meta?.changes||0)===1;
}

async function reconcileReservationStatus(request, env, base, payload) {
  let body;
  try { body = await base.clone().json(); }
  catch { return base; }

  if (!(base.ok && body?.ok === true && body?.found === false && body?.receiptNo)) return base;
  if (!env?.AIRWAIT_API_KEY) return base;

  try {
    const rawToken=String(payload?.sessionToken||'').trim();
    const tokenHash=rawToken.length>=32?await sha256Hex(rawToken):'';
    let session=null;
    if(tokenHash&&env?.DB){
      session=await env.DB.prepare('SELECT user_hash,business_date,reserve_id,receipt_no,wait_type_id,expires_at FROM v2_reservation_sessions WHERE token_hash=? LIMIT 1')
        .bind(tokenHash).first();
    }
    const authoritativeWaitTypeId=session
      ? await authoritativeWaitTypeForSession(env,session,{tokenHash})
      : String(body.waitTypeId||'');

    const rows = await fetchAllReservationsForReconcile(env);
    const scopedRows=authoritativeWaitTypeId
      ? rows.filter(r=>String(r?.waitTypeId||'')===authoritativeWaitTypeId)
      : [];
    const match = selectTicketMatch(scopedRows, body.receiptNo);
    const candidate = match.row;

    if (!candidate) {
      const closed=closedReservationFallback({...body,waitTypeId:authoritativeWaitTypeId||String(body.waitTypeId||'')});
      return new Response(JSON.stringify(closed||{
        ...body,
        waitTypeId:authoritativeWaitTypeId||String(body.waitTypeId||''),
        reconcileTried:true,
        reconcileAmbiguous:match.ambiguous,
        reconcileCandidateCount:match.count,
        reconcileExhaustive:true,
        reconcileReason:authoritativeWaitTypeId?'RECEIPT_NOT_IN_AUTHORITATIVE_WAIT_TYPE':'AUTHORITATIVE_WAIT_TYPE_UNAVAILABLE',
      }), { status:base.status, headers:base.headers });
    }

    const candidateWaitTypeId = String(candidate.waitTypeId || authoritativeWaitTypeId || '');
    const queueRows = scopedRows;
    const active = queueRows.filter(r => ['0','1','4'].includes(String(r.status || '')));
    const activeIndex = active.findIndex(r => sameTicket(r.number, body.receiptNo));
    const aheadCount = activeIndex >= 0
      ? active.slice(0, activeIndex).filter(r => ['0','4'].includes(String(r.status || ''))).length
      : null;

    return new Response(JSON.stringify({
      ...body,
      found:true,
      reserveId:String(session?.reserve_id||body.reserveId||''),
      waitTypeId:candidateWaitTypeId,
      waitTypeName:String(candidate.waitTypeName || ''),
      status:String(candidate.status || ''),
      isCalling:String(candidate.isCalling || '0') === '1',
      state:reservationState(candidate),
      aheadCount,
      queueRank:activeIndex >= 0 ? activeIndex + 1 : null,
      activeCount:active.length,
      checkedAt:Date.now(),
      reconcileTried:true,
      reconciledBy:'authoritative-wait-type-only',
    }), { status:base.status, headers:base.headers });
  } catch (e) {
    console.warn('CALLSTATUS_RECONCILE_FAILED', safeError(e));
    const closed=closedReservationFallback(body);
    if(closed){
      return new Response(JSON.stringify({...closed,reconcileTried:true,reconcileReason:'RECONCILE_FAILED_AFTER_CLOSE'}),{status:base.status,headers:base.headers});
    }
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
  const escaped=String(name||'').replace(/[.*+?^$()|[\]\\]/g,'\\$&');
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
function mergeCancelResponseCookies(jar,response){
  const raw=responseCookieHeader(response);
  if(!raw)return;
  for(const pair of raw.split(/;\s*/)){
    const eq=pair.indexOf('=');
    if(eq<=0)continue;
    const name=pair.slice(0,eq).trim();
    const value=pair.slice(eq+1).trim();
    if(name)jar.set(name,value);
  }
}

function cancelCookieHeader(jar){
  return Array.from(jar.entries()).map(([name,value])=>`${name}=${value}`).join('; ');
}

function assertAirwaitRedirectUrl(value){
  let url;
  try{url=new URL(String(value||''));}catch{throw apiError('CANCEL_REDIRECT_INVALID',502)}
  const host=String(url.hostname||'').toLowerCase();
  if(url.protocol!=='https:'||!(host==='airwait.jp'||host.endsWith('.airwait.jp')))throw apiError('CANCEL_REDIRECT_INVALID',502);
  return url;
}

async function fetchCancelHtmlWithCookieJar(startUrl,timeoutMs=10000){
  let current=assertAirwaitRedirectUrl(startUrl);
  const jar=new Map();
  for(let redirectCount=0;redirectCount<=8;redirectCount+=1){
    const headers={Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0'};
    const cookie=cancelCookieHeader(jar);
    if(cookie)headers.Cookie=cookie;
    const response=await fetchWithCancelTimeout(current.toString(),{redirect:'manual',headers},timeoutMs);
    mergeCancelResponseCookies(jar,response);
    if([301,302,303,307,308].includes(response.status)){
      const location=String(response.headers.get('location')||'');
      if(!location)throw apiError('CANCEL_REDIRECT_LOCATION_MISSING',502);
      current=assertAirwaitRedirectUrl(new URL(location,current).toString());
      continue;
    }
    const html=await response.text();
    return{response,html,url:current.toString(),cookie:cancelCookieHeader(jar)};
  }
  throw apiError('CANCEL_TOO_MANY_REDIRECTS',502);
}

async function waitForCanceledReservation(env,receiptNo,waitTypeId=''){
  let row=null;
  for(const delayMs of [350,650,1000,1500,2000]){
    await new Promise(resolve=>setTimeout(resolve,delayMs));
    row=await currentReservationRow(env,receiptNo,waitTypeId);
    if(reservationState(row)==='canceled')return row;
  }
  return row;
}

async function markCanceledUserClaim(env,session){
  if(!env?.DB||!session)return;
  await env.DB.prepare(`UPDATE v2_user_day_claims SET state='CANCELED',updated_at=?
    WHERE user_hash=? AND business_date=? AND reserve_id=? AND receipt_no=? AND state='CONFIRMED'`)
    .bind(Date.now(),String(session.user_hash||''),String(session.business_date||''),String(session.reserve_id||''),String(session.receipt_no||'')).run();
}

async function finalizeCancellationState(env,session,waitTypeId,cancelSource){
  await markCanceledUserClaim(env,session);
  let notification={ok:true,sent:false,reason:'NOT_ATTEMPTED'};
  try{
    notification=await sendCancellationNotification(env,{
      businessDate:String(session.business_date||''),
      receiptNo:String(session.receipt_no||''),
      reserveId:String(session.reserve_id||''),
      waitTypeId:String(waitTypeId||session.wait_type_id||''),
      cancelSource:String(cancelSource||'airwait'),
    });
  }catch(e){
    console.warn('CANCEL_NOTIFICATION_FAILED',safeError(e));
    notification={ok:false,sent:false,error:safeError(e)};
  }
  return notification;
}


function currentJstDate(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
// Operational date with the 19:00 JST daily switch (same rule as reception).
function currentOperationalDate(epoch=Date.now()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(epoch)).map(x=>[x.type,x.value]));
  const dt=new Date(Date.UTC(+p.year,+p.month-1,+p.day+(+p.hour>=19?1:0),12));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
}
async function lineUserHash(userId){
  return await sha256Hex(`${LINE_CHANNEL_ID}:${String(userId||'')}`);
}
function timingSafeEqualText(a,b){
  const x=new TextEncoder().encode(String(a||'')),y=new TextEncoder().encode(String(b||''));
  if(x.length!==y.length||!x.length)return false;
  let diff=0;for(let i=0;i<x.length;i+=1)diff|=x[i]^y[i];
  return diff===0;
}
// Diagnostics are Developing-only and require an explicit secret. Origin is not authentication.
function diagnosticsDenied(request,env){
  const expected=String(env?.DEVELOP_DIAGNOSTICS_TOKEN||'').trim();
  if(expected.length<32)return json(request,{ok:false,error:'NOT_FOUND'},404);
  const provided=String(request.headers.get('X-ASOBooN-Diagnostics')||'').trim();
  if(!timingSafeEqualText(provided,expected))return json(request,{ok:false,error:'DIAGNOSTICS_AUTH_REQUIRED'},401);
  return null;
}
// Fixed-window per-user limiter stored in D1 (shared table with the gateway).
let rateLimitTableReady=false;
async function enforceUserRateLimit(env,scope,userHash,limit,windowMs){
  if(!env?.DB||!userHash)return;
  const now=Date.now(),windowStart=Math.floor(now/windowMs)*windowMs,key=`${scope}:${userHash}:${windowStart}`;
  if(!rateLimitTableReady){
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL)`).run();
    rateLimitTableReady=true;
  }
  await env.DB.prepare(`INSERT INTO v2_rate_limits(key,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=count+1`).bind(key,windowStart+windowMs).run();
  const row=await env.DB.prepare('SELECT count FROM v2_rate_limits WHERE key=? LIMIT 1').bind(key).first();
  if(Math.random()<0.02)await env.DB.prepare('DELETE FROM v2_rate_limits WHERE expires_at<?').bind(now).run();
  if(Number(row?.count||0)>limit)throw apiError('RATE_LIMITED',429);
}
function officialLineWaitTypeLabel(waitTypeId){
  const id=String(waitTypeId||'');
  for(const specs of Object.values(BOARD_SLOT_SPECS)){
    for(const spec of specs){
      if(Array.isArray(spec.waitTypeIds)&&spec.waitTypeIds.includes(id))return String(spec.label||'受付');
    }
  }
  return id===DEVELOP_TEST_WAIT_TYPE_ID?'入場不可テスト':'本日の受付';
}
async function verifyOfficialLineSignature(rawBody,signature,secret){
  const sec=String(secret||'').trim(), sig=String(signature||'').trim();
  if(!sec||!sig)return false;
  let provided;
  try{provided=Uint8Array.from(atob(sig),c=>c.charCodeAt(0));}catch{return false}
  const key=await crypto.subtle.importKey(
    'raw',new TextEncoder().encode(sec),{name:'HMAC',hash:'SHA-256'},false,['sign']
  );
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(String(rawBody||''))));
  if(provided.length!==digest.length)return false;
  let diff=0;
  for(let i=0;i<digest.length;i+=1)diff|=provided[i]^digest[i];
  return diff===0;
}
async function replyOfficialLine(env,replyToken,messages){
  const token=String(env.LINE_OA_CHANNEL_ACCESS_TOKEN||'').trim();
  if(!token)throw apiError('LINE_OA_CHANNEL_ACCESS_TOKEN_NOT_CONFIGURED',503);
  const list=(Array.isArray(messages)?messages:[messages]).filter(Boolean).slice(0,5);
  if(!list.length)return;
  const response=await fetchWithCancelTimeout('https://api.line.me/v2/bot/message/reply',{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({replyToken:String(replyToken||''),messages:list}),
  },8000);
  const text=await response.text();
  if(!response.ok)throw apiError('LINE_OA_REPLY_HTTP_'+response.status+' '+String(text||'').slice(0,160),502);
}
async function pushOfficialLine(env,userId,messages){
  const token=String(env.LINE_OA_CHANNEL_ACCESS_TOKEN||'').trim();
  const to=String(userId||'').trim();
  if(!token)throw apiError('LINE_OA_CHANNEL_ACCESS_TOKEN_NOT_CONFIGURED',503);
  if(!to)throw apiError('LINE_OA_PUSH_USER_REQUIRED',400);
  const list=(Array.isArray(messages)?messages:[messages]).filter(Boolean).slice(0,5);
  if(!list.length)return;
  const response=await fetchWithCancelTimeout('https://api.line.me/v2/bot/message/push',{
    method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({to,messages:list}),
  },8000);
  const text=await response.text();
  if(!response.ok)throw apiError('LINE_OA_PUSH_HTTP_'+response.status+' '+String(text||'').slice(0,160),502);
}
function normalizeOfficialReserveId(value){
  const raw=String(value??'').normalize('NFKC').trim();
  if(!/^\d{1,12}$/.test(raw))return'';
  return raw.padStart(12,'0');
}
async function loadOfficialLineClaim(env,userHash,businessDate='',reserveId=''){
  if(!env?.DB)return null;
  const user=String(userHash||'');
  const date=normalizeDate(businessDate||'');
  const reserve=normalizeOfficialReserveId(reserveId||'');
  if(date&&reserve){
    return await env.DB.prepare(`SELECT user_hash,business_date,request_id,reserve_id,receipt_no,wait_type_id,state,updated_at
      FROM v2_user_day_claims
      WHERE user_hash=? AND business_date=? AND reserve_id=? AND state='CONFIRMED'
      ORDER BY updated_at DESC LIMIT 1`).bind(user,date,reserve).first();
  }
  return await env.DB.prepare(`SELECT user_hash,business_date,request_id,reserve_id,receipt_no,wait_type_id,state,updated_at
    FROM v2_user_day_claims
    WHERE user_hash=? AND business_date=? AND state='CONFIRMED'
    ORDER BY updated_at DESC LIMIT 1`).bind(user,currentOperationalDate()).first();
}
function officialLinePostbackParams(data){
  try{return new URLSearchParams(String(data||''));}catch{return new URLSearchParams()}
}
function officialLineStatusMessage(claim,state){
  const receipt=String(claim?.receipt_no||'');
  const slot=officialLineWaitTypeLabel(claim?.wait_type_id);
  const stateLabel=state==='calling'?'呼び出し中':state==='hold'?'保留中':'受付中';
  return{
    type:'template',
    altText:'現在の受付を確認しました',
    template:{
      type:'buttons',
      title:'現在の受付',
      text:`受付番号 ${receipt}\n${slot}\n状態：${stateLabel}`,
      actions:[
        {type:'postback',label:'キャンセルする',data:`asoboon=cancel_confirm&d=${claim.business_date}&r=${claim.reserve_id}`,displayText:'この受付をキャンセルしたい'},
        {type:'postback',label:'やめる',data:'asoboon=cancel_abort',displayText:'キャンセルしない'},
      ],
    },
  };
}
function officialLineConfirmMessage(claim){
  const receipt=String(claim?.receipt_no||'');
  return{
    type:'template',
    altText:'キャンセル確認',
    template:{
      type:'confirm',
      text:`受付番号 ${receipt} をキャンセルしますか？`,
      actions:[
        {type:'postback',label:'キャンセルする',data:`asoboon=cancel_execute&d=${claim.business_date}&r=${claim.reserve_id}`,displayText:'キャンセルする'},
        {type:'postback',label:'やめる',data:'asoboon=cancel_abort',displayText:'やめる'},
      ],
    },
  };
}
async function officialLineActiveReservation(env,userHash){
  const claim=await loadOfficialLineClaim(env,userHash);
  if(!claim)return{claim:null,row:null,state:'none'};
  const row=await currentReservationRow(env,String(claim.receipt_no||''),String(claim.wait_type_id||''));
  const state=reservationState(row);
  if(state==='canceled'){
    await finalizeCancellationState(env,claim,String(row?.waitTypeId||claim.wait_type_id||''),'airwait');
    return{claim,row,state};
  }
  return{claim,row,state};
}
async function processOfficialLineEvent(env,event){
  if(String(event?.source?.type||'')!=='user')return;
  const userId=String(event?.source?.userId||'');
  const replyToken=String(event?.replyToken||'');
  if(!userId||!replyToken)return;
  // Same identity hash as reception and in-app cancel: SHA256(channelId:userId).
  const userHash=await lineUserHash(userId);

  if(event?.type==='message'&&event?.message?.type==='text'){
    const text=String(event.message.text||'').normalize('NFKC').trim();
    if(!['受付確認・キャンセル','受付確認','キャンセル','キャンセルしたい'].includes(text))return;
    const current=await officialLineActiveReservation(env,userHash);
    if(!current.claim){
      await replyOfficialLine(env,replyToken,{type:'text',text:'現在、有効な受付は見つかりませんでした。'});
      return;
    }
    if(current.state==='canceled'){
      await replyOfficialLine(env,replyToken,{type:'text',text:`受付番号 ${current.claim.receipt_no} はキャンセル済みです。`});
      return;
    }
    if(!['waiting','calling','hold'].includes(current.state)){
      await replyOfficialLine(env,replyToken,{type:'text',text:'現在の受付はキャンセルできる状態ではありません。'});
      return;
    }
    await replyOfficialLine(env,replyToken,officialLineStatusMessage(current.claim,current.state));
    return;
  }

  if(event?.type!=='postback')return;
  const p=officialLinePostbackParams(event?.postback?.data);
  const intent=String(p.get('asoboon')||'');
  if(intent==='cancel_abort'){
    await replyOfficialLine(env,replyToken,{type:'text',text:'キャンセルを中止しました。受付はそのままです。'});
    return;
  }
  const businessDate=String(p.get('d')||'');
  const reserveId=String(p.get('r')||'');
  const claim=await loadOfficialLineClaim(env,userHash,businessDate,reserveId);
  if(!claim){
    await replyOfficialLine(env,replyToken,{type:'text',text:'対象の受付が見つかりません。すでにキャンセル済みの可能性があります。'});
    return;
  }
  if(intent==='cancel_confirm'){
    await replyOfficialLine(env,replyToken,officialLineConfirmMessage(claim));
    return;
  }
  if(intent==='cancel_execute'){
    await replyOfficialLine(env,replyToken,{
      type:'text',
      text:`受付番号 ${claim.receipt_no} のキャンセル処理を開始しました。完了まで少しお待ちください。`
    });
    try{
      const result=await cancelReservationForTrustedSession(env,claim,'manual');
      const suffix=result?.alreadyCanceled?'（すでにキャンセル済みでした）':'';
      await pushOfficialLine(env,userId,{
        type:'text',
        text:`受付番号 ${claim.receipt_no} のキャンセルが完了しました。${suffix}`
      });
    }catch(e){
      console.warn('OFFICIAL_LINE_CANCEL_FAILED',safeError(e));
      try{
        await pushOfficialLine(env,userId,{
          type:'text',
          text:'キャンセルを完了できませんでした。受付は自動では消していません。もう一度お試しいただくか、スタッフへお声がけください。'
        });
      }catch(pushError){
        console.warn('OFFICIAL_LINE_CANCEL_FAILURE_PUSH_FAILED',safeError(pushError));
      }
    }
    return;
  }
}
async function handleOfficialLineWebhook(request,env,ctx){
  const secret=String(env.LINE_OA_CHANNEL_SECRET||'').trim();
  if(!secret)return new Response('LINE OA webhook secret not configured',{status:503});
  const rawBody=await request.text();
  const signature=String(request.headers.get('x-line-signature')||'');
  if(!await verifyOfficialLineSignature(rawBody,signature,secret)){
    return new Response('invalid signature',{status:401});
  }
  let payload;
  try{payload=JSON.parse(rawBody||'{}')}catch{return new Response('invalid json',{status:400})}
  const events=Array.isArray(payload?.events)?payload.events:[];
  for(const event of events){
    const job=(async()=>{
      try{await processOfficialLineEvent(env,event)}
      catch(e){console.warn('OFFICIAL_LINE_WEBHOOK_EVENT_FAILED',safeError(e))}
    })();
    if(ctx?.waitUntil)ctx.waitUntil(job);
    else await job;
  }
  return new Response('OK',{status:200,headers:{'Content-Type':'text/plain;charset=UTF-8'}});
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
  return await lineUserHash(userId);
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
async function currentReservationRow(env,receiptNo,waitTypeId=''){
  reconcileAllCache={savedAt:0,rows:[]};
  reconcileAllInflight=null;
  const rows=await fetchAllReservationsForReconcile(env);
  const scoped=String(waitTypeId||'')
    ? rows.filter(r=>String(r?.waitTypeId||'')===String(waitTypeId))
    : [];
  return selectTicketMatch(scoped,receiptNo).row||null;
}
async function cancelReservationInMiniapp(env,p){
  if(!env?.DB)throw apiError('DB_NOT_CONFIGURED',503);
  const rawToken=String(p?.sessionToken||'').trim();
  if(rawToken.length<32||rawToken.length>256)throw apiError('CALLSTATUS_SESSION_REQUIRED',401);
  const tokenHash=await sha256Hex(rawToken);
  const now=Date.now();
  let session=await env.DB.prepare('SELECT user_hash,business_date,reserve_id,receipt_no,wait_type_id,expires_at FROM v2_reservation_sessions WHERE token_hash=? LIMIT 1').bind(tokenHash).first();
  if(!session||Number(session.expires_at||0)<=now)throw apiError('CALLSTATUS_SESSION_EXPIRED',401);
  const lineHash=await verifyCancelLineUser(p?.liffAccessToken);
  if(String(session.user_hash||'')!==lineHash)throw apiError('CANCEL_SESSION_USER_MISMATCH',403);
  await enforceUserRateLimit(env,'cancel',lineHash,10,10*60*1000);
  const authoritativeWaitTypeId=await authoritativeWaitTypeForSession(env,session,{tokenHash});
  session={...session,wait_type_id:authoritativeWaitTypeId};
  try{
    return await cancelReservationForTrustedSession(env,session,'manual');
  }catch(originalError){
    try{
      const live=await currentReservationRow(env,String(session.receipt_no||''),String(session.wait_type_id||''));
      if(reservationState(live)==='canceled'){
        const notification=await finalizeCancellationState(
          env,
          session,
          String(live?.waitTypeId||session.wait_type_id||''),
          'airwait'
        );
        return{
          ok:true,
          canceled:true,
          state:'canceled',
          recoveredAfterError:true,
          receiptNo:String(session.receipt_no||''),
          businessDate:String(session.business_date||''),
          waitTypeId:String(live?.waitTypeId||session.wait_type_id||''),
          notification,
          checkedAt:Date.now(),
        };
      }
    }catch(reconcileError){
      console.warn('MINIAPP_CANCEL_RECONCILE_FAILED',safeError(reconcileError));
    }
    throw originalError;
  }
}
async function cancelReservationForTrustedSession(env,session,cancelSource='manual'){
  if(!env?.DB||!session?.user_hash||!session?.business_date||!session?.reserve_id||!session?.receipt_no){
    throw apiError('CANCEL_TRUSTED_SESSION_INVALID',400);
  }
  const before=await currentReservationRow(env,String(session.receipt_no||''),String(session.wait_type_id||''));
  const beforeState=reservationState(before);
  if(beforeState==='canceled'){
    const notification=await finalizeCancellationState(env,session,String(before?.waitTypeId||session.wait_type_id||''),'airwait');
    return{ok:true,canceled:true,alreadyCanceled:true,state:'canceled',receiptNo:String(session.receipt_no||''),businessDate:String(session.business_date||''),waitTypeId:String(before?.waitTypeId||session.wait_type_id||''),notification,checkedAt:Date.now()};
  }
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
  const confirm=await fetchCancelHtmlWithCookieJar(confirmUrl.toString(),10000);
  const confirmResponse=confirm.response;
  const confirmHtml=confirm.html;
  if(!confirmResponse.ok||new URL(confirm.url).pathname!=='/WCSP/cancel/confirm')throw apiError('CANCEL_CONFIRM_UNAVAILABLE',502);
  const csrf=htmlMetaContent(confirmHtml,'_csrf');
  if(!csrf)throw apiError('CANCEL_CSRF_UNAVAILABLE',502);

  const completeUrl=new URL('/WCSP/cancel/complete',AIRWAIT_ORIGIN);
  completeUrl.searchParams.set('queryStoreNo',storeNo);
  const headers={Accept:'text/html,application/xhtml+xml','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',Origin:AIRWAIT_ORIGIN,Referer:confirmUrl.toString(),'User-Agent':'Mozilla/5.0'};
  if(confirm.cookie)headers.Cookie=confirm.cookie;
  let postResponse=null,postError=null;
  try{
    postResponse=await fetchWithCancelTimeout(completeUrl.toString(),{method:'POST',redirect:'follow',headers,body:new URLSearchParams({storeNo,reserveId,p:capability,_csrf:csrf})},12000);
    await postResponse.text();
  }catch(e){postError=e}

  const after=await waitForCanceledReservation(env,String(session.receipt_no||''),String(session.wait_type_id||''));
  const afterState=reservationState(after);
  if(afterState!=='canceled'){
    if(postError)throw apiError('CANCEL_RESULT_UNKNOWN',502);
    throw apiError('CANCEL_NOT_CONFIRMED_HTTP_'+String(postResponse?.status||0),502);
  }

  const notification=await finalizeCancellationState(env,session,String(after?.waitTypeId||session.wait_type_id||''),String(cancelSource||'manual'));
  return{ok:true,canceled:true,state:'canceled',receiptNo:String(session.receipt_no||''),businessDate:String(session.business_date||''),waitTypeId:String(after?.waitTypeId||session.wait_type_id||''),notification,checkedAt:Date.now()};
}
async function fetchAllReservationsForReconcile(env, { force=false }={}) {
  const now = Date.now();
  if (!force && reconcileAllCache.rows.length && now - reconcileAllCache.savedAt < RECONCILE_CACHE_MS) {
    return reconcileAllCache.rows;
  }
  if (reconcileAllInflight) return await reconcileAllInflight;

  const job = (async () => {
    const rows = [];
    let start = 1;
    let total = Infinity;
    let page = 0;
    const maxPages = 1000; // AirWAIT start supports up to 99,999; do not truncate late receipt numbers.
    while (rows.length < total && start <= 99999 && page < maxPages) {
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
    const waitTypeId = String(existing.waitTypeId || '');
    if (!/^\d{4}$/.test(waitTypeId) || !existing.reserveId) return false;
    // A fresh AirWAIT read is required before releasing duplicate protection.
    const rows = (await fetchAllReservationsForReconcile(env, { force:true }))
      .filter(r => String(r?.waitTypeId || '') === waitTypeId);
    const match = selectTicketMatch(rows, existing.receiptNo);
    const own = match.row;
    if (!own || !['2','3'].includes(String(own.status || ''))) return false;

    const claim = await env.DB.prepare(`SELECT user_hash,business_date,request_id,reserve_id,receipt_no,wait_type_id
      FROM v2_user_day_claims
      WHERE business_date=? AND reserve_id=? AND receipt_no=? AND wait_type_id=? AND state='CONFIRMED'
      LIMIT 1`)
      .bind(
        String(existing.businessDate || createPayload.operationalDate || ''),
        String(existing.reserveId || ''),
        String(existing.receiptNo || ''),
        waitTypeId,
      ).first();
    if (!claim?.user_hash || !claim?.request_id) return false;

    const removed = await env.DB.prepare(`DELETE FROM v2_user_day_claims
      WHERE user_hash=? AND business_date=? AND request_id=? AND reserve_id=? AND receipt_no=? AND wait_type_id=? AND state='CONFIRMED'`)
      .bind(
        String(claim.user_hash),
        String(claim.business_date),
        String(claim.request_id),
        String(claim.reserve_id),
        String(claim.receipt_no),
        String(claim.wait_type_id),
      ).run();
    if (Number(removed?.meta?.changes || 0) !== 1) return false;

    // The first gateway pass cached alreadyExists under the new requestId.
    // Drop only that cache entry so the retry can perform exactly one new create.
    await env.DB.prepare(`DELETE FROM v2_request_results WHERE request_id=?`)
      .bind(String(createPayload.requestId || '')).run();
    return true;
  } catch (e) {
    console.warn('TERMINAL_PREVIOUS_CLAIM_RELEASE_FAILED', safeError(e));
    return false;
  }
}
async function fetchDevelopTestReservations(env, filters={}) {
  const rows = [];
  let start = 1,total=Infinity,page=0;
  while(rows.length<total&&start<=99999&&page<1000) {
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
    total = Number(d?.innerDto?.count || part.length || 0);
    if (!part.length || rows.length >= total) break;
    start += part.length;
    page += 1;
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