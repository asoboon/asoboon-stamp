/**
 * ASOBooN PURPLE Gateway - Production Simulation v1
 * Version: 2.1.cf10
 *
 * PURPLE / STAGING ONLY.
 * This file intentionally keeps the public HTTP contract used by the current
 * Purple LINE MINI App, while moving AirWAIT monitoring to a single internal
 * scheduler path designed for ~1,000 calls/day and 10-20 simultaneous calls.
 *
 * Existing bindings / secrets on this Worker:
 *   DB                                 D1 binding
 *   AIRWAIT_API_KEY                    Secret
 *   PURPLE_LINE_MINIAPP_CHANNEL_SECRET Secret
 *
 * Scheduler integration:
 *   A separate Worker binds to this Worker with a Cloudflare Service Binding
 *   named GATEWAY and invokes the RPC methods schedulerPlan() / workerTick().
 *   The notification worker path is therefore not exposed as a public URL.
 */

import { WorkerEntrypoint } from "cloudflare:workers";

const CFG = Object.freeze({
  VERSION: '2.1.cf13',
  ARCHITECTURE: 'PURPLE_PRODSIM_V1',
  SNAPSHOT_FORMAT: 'cf10-delta-v1',
  SCHEMA_VERSION: 'cf10-2',

  STORE_ID: 'KR01205179',
  LINE_CHANNEL_ID: '2011467470',
  LIFF_BASE: 'https://miniapp.line.me/2011467470-Gk5C3lWf/',
  TEMPLATE_NAME: 'yourturn_s_w_ja',
  ALLOWED_ORIGIN: 'https://asoboon.github.io',
  TZ: 'Asia/Tokyo',

  AIR_LAST: 'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless',
  AIR_RESERVATIONS: 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  AIR_WAIT_TYPES: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/wait/type/get',
  AIR_WAIT_INFO: 'https://airwait.jp/WCSP/api/20160600/external/stateless/store/getWaitInfo',
  AIR_CREATE: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',
  CROWD_ONLINE_WAIT_TYPE_IDS: Object.freeze(['0030', '0032', '0034', '0036', '0038']),

  LINE_OAUTH: 'https://api.line.me/oauth2/v3/token',
  LINE_NOTIFIER_TOKEN: 'https://api.line.me/message/v3/notifier/token',
  LINE_NOTIFIER_SEND: 'https://api.line.me/message/v3/notifier/send?target=service',

  BUSINESS_CALENDAR_API: 'https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec',
  CALENDAR_CACHE_MS: 20 * 60 * 60 * 1000,

  // Monitoring starts at 09:50 by explicit ASOBooN operating rule.
  MONITOR_START_MIN: 9 * 60 + 50,
  FAST_WINDOWS: Object.freeze([
    Object.freeze([9 * 60 + 50, 10 * 60 + 45]),
    Object.freeze([12 * 60 + 20, 13 * 60 + 10]),
    Object.freeze([13 * 60 + 20, 14 * 60 + 10]),
    Object.freeze([14 * 60 + 45, 15 * 60 + 30]),
  ]),

  REQUEST_TTL_SEC: 600,
  REQUEST_PENDING_TTL_SEC: 600,
  SEND_RETRY_MAX: 3,
  SEND_BATCH_LIMIT: 20,
  SEND_CONCURRENCY: 5,
  SEND_RETRY_BASE_MS: 30 * 1000,
  LOCK_MS: 45 * 1000,
  EVENT_LOG_KEEP_DAYS: 14,
});

// Isolate-local stateless channel access-token cache. This is intentionally
// not persisted to D1. It is only a performance optimization.
let channelTokenCache = { token: '', expiresAt: 0 };

export default class PurpleGateway extends WorkerEntrypoint {
  async fetch(request) {
    return handleHttp(request, this.env);
  }

  // RPC only: called from the Scheduler Worker through a Service Binding.
  async schedulerPlan(meta = {}) {
    return getSchedulerPlan(this.env, meta);
  }

  // RPC only: centralized AirWAIT poll + delta sync + LINE service-message send.
  async workerTick(meta = {}) {
    return runWorkerTick(this.env, meta);
  }

  // RPC only: scheduler completion/error telemetry.
  async schedulerComplete(meta = {}) {
    return recordSchedulerComplete(this.env, meta);
  }

  // RPC only: lets the Scheduler's public health endpoint verify the binding.
  async schedulerHealth() {
    const h = await health(this.env);
    const plan = await getSchedulerPlan(this.env, { recordEvent: false, source: 'scheduler-health' });
    return {
      ok: Boolean(h.ok),
      gatewayVersion: CFG.VERSION,
      architecture: CFG.ARCHITECTURE,
      plan,
    };
  }
}

/* ---------------------------------------------------------------------- */
/* HTTP contract for current Purple pages                                 */
/* ---------------------------------------------------------------------- */

async function handleHttp(request, env) {
  if (request.method === 'OPTIONS') return corsPreflight(request);

  try {
    const url = new URL(request.url);

    if (request.method === 'GET') {
      const action = String(url.searchParams.get('action') || 'health');
      let result;

      if (action === 'health') result = await health(env);
      else if (action === 'waitTypes') result = await waitTypes(env);
      else if (action === 'crowdRemaining') result = await crowdRemaining(env);
      // IMPORTANT: snapshot is D1 read-only. Browser traffic never polls AirWAIT.
      else if (action === 'snapshot') result = await snapshot(env);
      else if (action === 'lookupSnapshot') result = await lookupSnapshot(env, url.searchParams);
      else if (action === 'ticketStatus') result = await ticketStatus(env, url.searchParams);
      else if (action === 'requestStatus') result = await requestStatus(env, url.searchParams.get('requestId'));
      else if (action === 'reservationStatus') result = await reservationStatus(env, url.searchParams);
      else if (action === 'callInfo') result = await callInfo(env, url.searchParams);
      else if (action === 'cronStatus' || action === 'systemStatus') result = await systemStatus(env);
      else if (action === 'schedule') result = await publicSchedule(env);
      // Deliberately disabled: production-like staging does not expose a public send trigger.
      else if (action === 'workerOnce') result = {
        ok: false,
        error: 'PUBLIC_WORKER_TRIGGER_DISABLED',
        message: '通知ワーカーはService Binding経由のSchedulerのみ実行できます。',
        version: CFG.VERSION,
      };
      else result = { ok: false, error: 'UNKNOWN_ACTION', version: CFG.VERSION };

      return output(request, result, url.searchParams.get('callback'));
    }

    if (request.method === 'POST') {
      enforcePurpleOrigin(request);
      const p = await readBody(request);
      const action = String(p.action || '');
      const requestId = normalizeRequestId(p.requestId) || makeRequestId();
      p.requestId = requestId;

      const claim = await claimRequestId(env, requestId, action);
      if (claim.cached) return output(request, claim.result, null);
      if (!claim.owner) {
        // no-cors callers ignore this response and keep polling requestStatus.
        return output(request, { ok: true, pending: true, requestId, version: CFG.VERSION }, null, 202);
      }

      let result;
      try {
        if (action === 'createReservation') result = await createReservation(env, p);
        else if (action === 'issueServiceToken') result = await issueServiceToken(env, p);
        else throw apiError('UNKNOWN_ACTION', 400, false);
      } catch (e) {
        result = {
          ok: false,
          stored: false,
          ambiguous: Boolean(e && e.ambiguous),
          error: safeError(e),
          version: CFG.VERSION,
        };
      }

      await finalizeRequestResult(env, requestId, action, result);
      return output(request, result, null);
    }

    return output(request, { ok: false, error: 'METHOD_NOT_ALLOWED', version: CFG.VERSION }, null, 405);
  } catch (e) {
    return output(request, { ok: false, error: safeError(e), version: CFG.VERSION }, null, Number(e?.status || 500));
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
  if (origin === CFG.ALLOWED_ORIGIN) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function corsPreflight(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function output(request, payload, callback, status = 200) {
  const headers = corsHeaders(request);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]{0,120}$/.test(String(callback))) {
    headers['Content-Type'] = 'application/javascript; charset=utf-8';
    return new Response(`${callback}(${JSON.stringify(payload)});`, { status, headers });
  }
  headers['Content-Type'] = 'application/json; charset=utf-8';
  return new Response(JSON.stringify(payload, null, 2), { status, headers });
}

async function readBody(request) {
  const ct = (request.headers.get('Content-Type') || '').toLowerCase();
  if (ct.includes('application/json')) return await request.json();
  const text = await request.text();
  return Object.fromEntries(new URLSearchParams(text));
}

function enforcePurpleOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== CFG.ALLOWED_ORIGIN) throw apiError('ORIGIN_NOT_ALLOWED', 403, false);
}

/* ---------------------------------------------------------------------- */
/* Schema / health / telemetry                                             */
/* ---------------------------------------------------------------------- */

async function ensureAuxSchema(env) {
  const current = await getSystemState(env, 'schema_version');
  if (current === CFG.SCHEMA_VERSION) return;

  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS purple_event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      level TEXT NOT NULL DEFAULT 'INFO',
      event TEXT NOT NULL,
      receipt_no TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT ''
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_purple_event_log_ts ON purple_event_log(ts)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_purple_event_log_event_ts ON purple_event_log(event, ts)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_airwait_snapshot_receipt ON airwait_snapshot(business_date, receipt_no)`),
  ]);
  await setSystemState(env, 'schema_version', CFG.SCHEMA_VERSION);
}

async function health(env) {
  await ensureAuxSchema(env);
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('notification_bindings','airwait_snapshot','request_results','system_state')"
  ).first();
  const coreCount = Number(row?.n || 0);
  const logRow = await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='purple_event_log'").first();
  const logConfigured = Number(logRow?.n || 0) === 1;
  const schedulerLastEventAt = Number(await getSystemState(env, 'scheduler_last_event_at') || 0);
  const schedulerFresh = schedulerLastEventAt > 0 && Date.now() - schedulerLastEventAt <= 90 * 1000;

  return {
    ok: coreCount === 4 && logConfigured && Boolean(env.AIRWAIT_API_KEY) && Boolean(env.PURPLE_LINE_MINIAPP_CHANNEL_SECRET),
    service: 'ASOBooN PURPLE Gateway',
    version: CFG.VERSION,
    architecture: CFG.ARCHITECTURE,
    storageConfigured: coreCount === 4,
    spreadsheetConfigured: coreCount === 4, // compatibility alias for current Purple UI
    eventLogConfigured: logConfigured,
    airwaitKeyConfigured: Boolean(env.AIRWAIT_API_KEY),
    channelSecretConfigured: Boolean(env.PURPLE_LINE_MINIAPP_CHANNEL_SECRET),
    templateConfigured: true,
    enabled: true,
    workerEnabled: schedulerFresh,
    schedulerFresh,
    schedulerLastEventAt: schedulerLastEventAt ? new Date(schedulerLastEventAt).toISOString() : '',
    testMode: true,
    schedulerModel: 'SERVICE_BINDING_CRON_10S_60S',
    browserHitsAirwait: false,
    sendBatchLimit: CFG.SEND_BATCH_LIMIT,
    sendConcurrency: CFG.SEND_CONCURRENCY,
    expectedTables: 4,
    foundTables: coreCount,
  };
}

async function logEvent(env, event, detail = {}, level = 'INFO', receiptNo = '') {
  try {
    const safe = JSON.stringify(detail, (_, v) => {
      if (typeof v === 'string' && v.length > 500) return v.slice(0, 500);
      return v;
    }).slice(0, 1800);
    await env.DB.prepare(
      'INSERT INTO purple_event_log(ts,level,event,receipt_no,detail) VALUES(?,?,?,?,?)'
    ).bind(Date.now(), String(level), String(event), String(receiptNo || ''), safe).run();
  } catch (_) {}
}

async function purgeOldLogsOncePerDay(env) {
  const today = jstDate();
  const key = 'event_log_last_purge_date';
  if (await getSystemState(env, key) === today) return;
  const cutoff = Date.now() - CFG.EVENT_LOG_KEEP_DAYS * 24 * 60 * 60 * 1000;
  try {
    await env.DB.prepare('DELETE FROM purple_event_log WHERE ts < ?').bind(cutoff).run();
    await setSystemState(env, key, today);
  } catch (_) {}
}

/* ---------------------------------------------------------------------- */
/* ASOBooN operating calendar + scheduler plan                             */
/* ---------------------------------------------------------------------- */

async function getBusinessCalendar(env, date = jstDate()) {
  const key = `calendar:${date}`;
  const raw = await getSystemState(env, key);
  if (raw) {
    try {
      const cached = JSON.parse(raw);
      if (cached && cached.date === date && Date.now() - Number(cached.fetchedAt || 0) < CFG.CALENDAR_CACHE_MS) {
        return { ...cached, source: 'd1-cache' };
      }
    } catch (_) {}
  }

  const url = new URL(CFG.BUSINESS_CALENDAR_API);
  url.searchParams.set('action', 'current');
  url.searchParams.set('date', date);
  url.searchParams.set('_', String(Date.now()));

  let res;
  try {
    res = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store' });
  } catch (e) {
    if (raw) {
      try {
        const stale = JSON.parse(raw);
        // Same-day previously validated value is safer than guessing from weekday.
        if (stale && stale.date === date) return { ...stale, source: 'stale-validated-cache', stale: true };
      } catch (_) {}
    }
    throw apiError('BUSINESS_CALENDAR_NETWORK_ERROR', 502, false);
  }

  const text = await res.text();
  let d;
  try { d = JSON.parse(text); }
  catch { throw apiError('BUSINESS_CALENDAR_INVALID_JSON', 502, false); }

  if (!res.ok || d?.ok !== true) throw apiError(`BUSINESS_CALENDAR_HTTP_${res.status}`, res.status || 502, false);

  const operationalDate = normalizeDate(d.operationalDate || d.calendarDate || date);
  const businessType = String(d.businessType || '').trim();
  if (operationalDate !== date) throw apiError('BUSINESS_CALENDAR_DATE_MISMATCH', 502, false);
  if (!['平日', '平日特定日', '土日祝日', '休館'].includes(businessType)) {
    throw apiError('BUSINESS_CALENDAR_TYPE_INVALID', 502, false);
  }

  const closingTime = businessType === '土日祝日' ? '18:00' : (businessType === '休館' ? '' : '17:00');
  const value = {
    date,
    businessType,
    isClosed: businessType === '休館',
    closingTime,
    note: String(d.note || '').slice(0, 200),
    fetchedAt: Date.now(),
  };
  await setSystemState(env, key, JSON.stringify(value));
  return { ...value, source: 'calendar-api' };
}

async function getSchedulerPlan(env, meta = {}) {
  await ensureAuxSchema(env);
  const now = Date.now();
  const parts = jstParts(now);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const minute = Number(parts.hour) * 60 + Number(parts.minute);

  let calendar;
  try {
    calendar = await getBusinessCalendar(env, date);
  } catch (e) {
    if (meta.recordEvent !== false) {
      await setSystemState(env, 'scheduler_last_event_at', String(now));
      await setSystemState(env, 'scheduler_last_plan', 'STOP');
      await setSystemState(env, 'scheduler_last_error', safeError(e));
      await setSystemState(env, 'scheduler_last_cron', String(meta.cron || ''));
    }
    return {
      ok: false,
      version: CFG.VERSION,
      mode: 'STOP',
      reason: 'CALENDAR_ERROR',
      error: safeError(e),
      jst: `${date} ${parts.hour}:${parts.minute}:${parts.second}`,
    };
  }

  let mode = 'STOP';
  let reason = '';
  let closingMin = 0;

  if (calendar.isClosed) {
    reason = 'CLOSED_DAY';
  } else {
    closingMin = calendar.businessType === '土日祝日' ? 18 * 60 : 17 * 60;
    if (minute < CFG.MONITOR_START_MIN) reason = 'BEFORE_MONITOR_START';
    else if (minute >= closingMin) reason = 'AFTER_CLOSING';
    else if (CFG.FAST_WINDOWS.some(([start, end]) => minute >= start && minute < end)) {
      mode = 'FAST';
      reason = 'FAST_WINDOW';
    } else {
      mode = 'NORMAL';
      reason = 'OPEN_NORMAL';
    }
  }

  if (meta.recordEvent !== false) {
    await setSystemState(env, 'scheduler_last_event_at', String(now));
    await setSystemState(env, 'scheduler_last_plan', mode);
    await setSystemState(env, 'scheduler_last_plan_reason', reason);
    await setSystemState(env, 'scheduler_last_cron', String(meta.cron || ''));
    await setSystemState(env, 'scheduler_last_scheduled_time', String(meta.scheduledTime || ''));
    await setSystemState(env, 'scheduler_last_error', '');
  }

  return {
    ok: true,
    version: CFG.VERSION,
    mode,
    reason,
    businessDate: date,
    businessType: calendar.businessType,
    closingTime: calendar.closingTime,
    calendarSource: calendar.source,
    jst: `${date} ${parts.hour}:${parts.minute}:${parts.second}`,
    fastIntervalsSec: mode === 'FAST' ? 10 : (mode === 'NORMAL' ? 60 : null),
  };
}

async function publicSchedule(env) {
  return getSchedulerPlan(env, { recordEvent: false, source: 'public-status' });
}

async function recordSchedulerComplete(env, meta = {}) {
  const now = Date.now();
  if (meta.error) {
    await setSystemState(env, 'scheduler_last_error_at', String(now));
    await setSystemState(env, 'scheduler_last_error', String(meta.error).slice(0, 500));
    await logEvent(env, 'SCHEDULER_ERROR', { error: String(meta.error).slice(0, 500), mode: meta.mode || '' }, 'ERROR');
  } else {
    await setSystemState(env, 'scheduler_last_ok_at', String(now));
    await setSystemState(env, 'scheduler_last_summary', JSON.stringify(meta).slice(0, 1800));
  }
  return { ok: true, version: CFG.VERSION };
}

/* ---------------------------------------------------------------------- */
/* AirWAIT                                                                 */
/* ---------------------------------------------------------------------- */

async function airGetLast(env) {
  const url = new URL(CFG.AIR_LAST);
  url.searchParams.set('storeId', CFG.STORE_ID);
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json', 'corWclpKeyCd': env.AIRWAIT_API_KEY },
  });
  const text = await res.text();
  const d = parseJson(text, 'AIRWAIT_LAST_PARSE');
  if (!res.ok || d?.success !== true || d?.resultCode?.code !== '0000') {
    throw apiError(`AIRWAIT_LAST_ERROR HTTP_${res.status} RC_${d?.resultCode?.code || 'NONE'}`, res.status || 502, false);
  }
  const marker = String(d?.innerDto?.lastUpdDate || '').trim();
  if (!marker) throw apiError('AIRWAIT_LAST_MARKER_EMPTY', 502, false);
  return { marker, currentDate: String(d?.innerDto?.currentDate || '') };
}

async function airPost(env, endpoint, payload, label) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'corWclpKeyCd': env.AIRWAIT_API_KEY,
    },
    body: new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v ?? '')])),
  });
  const text = await res.text();
  const d = parseJson(text, `AIRWAIT_${label}_PARSE`);
  if (!res.ok || d?.success !== true || d?.resultCode?.code !== '0000') {
    const e = apiError(`AIRWAIT_${label}_ERROR HTTP_${res.status} RC_${d?.resultCode?.code || 'NONE'}`, res.status || 502, false);
    e.airwaitResultCode = d?.resultCode?.code || '';
    throw e;
  }
  return d;
}

async function waitTypes(env) {
  const d = await airPost(env, CFG.AIR_WAIT_TYPES, { storeId: CFG.STORE_ID }, 'WAIT_TYPES');
  const list = Array.isArray(d?.innerDto?.waitTypeList) ? d.innerDto.waitTypeList : [];
  return {
    ok: true,
    version: CFG.VERSION,
    waitTypes: list.map(x => ({
      waitTypeId: String(x?.waitTypeId || ''),
      waitTypeName: String(x?.waitTypeName || ''),
      dispFlg: x?.dispFlg !== false,
      usageDispType: String(x?.usageDispType || ''),
    })),
  };
}

// Purple-only read path. Never derives people from reservation rows or GROUP units.
async function crowdRemaining(env) {
  if (!env.AIRWAIT_API_KEY) throw apiError('AIRWAIT_KEY_UNAVAILABLE', 503, false);
  const url = new URL(CFG.AIR_WAIT_INFO);
  url.searchParams.set('key', env.AIRWAIT_API_KEY);
  url.searchParams.set('storeId', CFG.STORE_ID);
  let res;
  try {
    res = await fetch(url, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(8000) });
  } catch (_) {
    throw apiError('AIRWAIT_WAIT_INFO_NETWORK_ERROR', 502, false);
  }
  if (!res.ok) throw apiError(`AIRWAIT_WAIT_INFO_HTTP_${res.status}`, 502, false);
  const d = parseJson(await res.text(), 'AIRWAIT_WAIT_INFO');
  if (!(d?.success === true || d?.resultCode?.code === '0000')) {
    throw apiError(`AIRWAIT_WAIT_INFO_RC_${d?.resultCode?.code || 'NONE'}`, 502, false);
  }
  const store = d?.innerDto?.stores?.[0];
  if (!store || !Array.isArray(store.waitDetails)) {
    throw apiError('AIRWAIT_WAIT_DETAILS_UNAVAILABLE', 502, false);
  }
  const typeResponse = await airPost(env, CFG.AIR_WAIT_TYPES, { storeId: CFG.STORE_ID }, 'WAIT_TYPES');
  const types = (Array.isArray(typeResponse?.innerDto?.waitTypeList) ? typeResponse.innerDto.waitTypeList : []).filter(type =>
    CFG.CROWD_ONLINE_WAIT_TYPE_IDS.includes(String(type?.waitTypeId || '')) &&
    String(type?.usageDispType || '') === 'KeyONLINE_RECEPTION_ONLY'
  );
  const norm = value => String(value || '').normalize('NFKC').replace(/\s+/g, '').trim();
  const details = store.waitDetails.map(row => ({
    detailedWaitType: String(row?.detailedWaitType || '').slice(0, 120),
    reserveUnit: String(row?.reserveUnit || ''),
    remainingNum: row?.remainingNum,
  }));
  const slots = types.map(type => {
    const matches = details.filter(row => norm(row.detailedWaitType) === norm(type.waitTypeName));
    const matched = matches.length === 1 ? matches[0] : null;
    const raw = matched?.remainingNum;
    const n = typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw)) ? Number(raw) : NaN;
    const person = matched?.reserveUnit === 'PERSON' && Number.isSafeInteger(n) && n >= 0;
    return {
      waitTypeId: String(type.waitTypeId),
      waitTypeName: String(type.waitTypeName || ''),
      detailedWaitType: matched?.detailedWaitType || '',
      reserveUnit: matched?.reserveUnit || '',
      remaining: person ? n : null,
      evidence: matches.length !== 1 ? `MATCH_COUNT_${matches.length}` : (person ? 'PERSON' : 'UNVERIFIED_UNIT_OR_VALUE'),
      statusFields: Object.fromEntries(Object.entries(type)
        .filter(([key, value]) => /(?:status|rcpt|accept|start|end)/i.test(key) &&
          (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
        .map(([key, value]) => [key, String(value).slice(0, 40)])),
    };
  });
  return {
    ok: true,
    version: CFG.VERSION,
    source: 'AirWAIT getWaitInfo',
    fetchedAt: new Date().toISOString(),
    slots,
    storeStatusFields: Object.fromEntries(Object.entries(store)
      .filter(([key, value]) => /(?:status|rcpt|open|close)/i.test(key) &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))
      .map(([key, value]) => [key, String(value).slice(0, 40)])),
    // Names and units only: permits mapping audit without exposing GROUP counts.
    observedDetails: store.waitDetails.map(row => ({
      detailedWaitType: String(row?.detailedWaitType || '').slice(0, 120),
      reserveUnit: String(row?.reserveUnit || ''),
      statusFieldNames: Object.keys(row || {}).filter(key => /(?:status|rcpt|open|close)/i.test(key)),
    })),
  };
}

async function allReservations(env, filters = {}) {
  const out = [];
  let start = 1;
  let total = Infinity;
  let guard = 0;

  while (start <= total && guard++ < 40) {
    const payload = {
      storeId: CFG.STORE_ID,
      sortStatus: '0',
      isDesc: '0',
      start: String(start),
      limit: '100',
      ...Object.fromEntries(Object.entries(filters)
        .filter(([, v]) => v !== undefined && v !== null && String(v) !== '')
        .map(([k, v]) => [k, String(v)])),
    };

    const d = await airPost(env, CFG.AIR_RESERVATIONS, payload, 'RESERVATIONS');
    const list = Array.isArray(d?.innerDto?.reservations) ? d.innerDto.reservations : [];
    total = Number(d?.innerDto?.count ?? list.length);
    out.push(...list);
    if (!list.length || start + list.length > total) break;
    start += list.length;
  }
  return out;
}

async function findLiveReservation(env, receiptNo, waitTypeId) {
  const rows = (await allReservations(env, { waitTypeId, status: '0' })).filter(row =>
    normalizeReceipt(row?.number ?? row?.receiptNo) === receiptNo && String(row?.waitTypeId || '') === waitTypeId
  );
  return rows.length === 1 ? rows[0] : null;
}

async function createReservation(env, p) {
  const waitTypeId = normalizeWaitType(p.waitTypeId);
  const adults = intInRange(p.adults, 1, 10);
  const paidChildren = intInRange(p.paidChildren, 0, 10);
  const infants = intInRange(p.infants, 0, 10);
  const total = adults + paidChildren + infants;

  if (!waitTypeId || total < 1 || total > 10 || paidChildren + infants > adults * 3) {
    throw apiError('VALIDATION_ERROR', 400, false);
  }

  let res;
  try {
    res = await fetch(CFG.AIR_CREATE, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'corWclpKeyCd': env.AIRWAIT_API_KEY,
      },
      body: new URLSearchParams({
        storeId: CFG.STORE_ID,
        numPerson: String(adults),
        numPersonChild: String(paidChildren + infants),
        waitTypeId,
        langType: 'KeyJPN',
        autoPrintFlg: 'false',
      }),
    });
  } catch (e) {
    throw apiError('AIRWAIT_CREATE_NETWORK_AMBIGUOUS_MANUAL_REVIEW', 502, true);
  }

  const text = await res.text();
  let d;
  try { d = JSON.parse(text); }
  catch { throw apiError('AIRWAIT_CREATE_2XX_PARSE_AMBIGUOUS_MANUAL_REVIEW', res.status || 502, true); }

  if (!res.ok) throw apiError(`AIRWAIT_CREATE_HTTP_${res.status}`, res.status, res.status >= 500);
  if (d?.success !== true || d?.resultCode?.code !== '0000') {
    throw apiError(`AIRWAIT_CREATE_ERROR RC_${d?.resultCode?.code || 'NONE'}`, 400, false);
  }

  const dto = d?.innerDto || {};
  const reserveId = normalizeReserveId(dto.reserveId);
  const receiptNo = normalizeReceipt(dto.receiptNo);
  if (!reserveId || !receiptNo) throw apiError('AIRWAIT_CREATE_200_RESULT_AMBIGUOUS_MANUAL_REVIEW', 502, true);

  // Immediate local visibility; the centralized monitor will later reconcile it.
  const businessDate = jstDate();
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO airwait_snapshot
      (business_date,wait_type_id,receipt_no,reserve_id,wait_type_name,status,is_calling,first_seen_at,last_seen_at)
     VALUES (?,?,?,?,?,'0',0,?,?)
     ON CONFLICT(business_date,wait_type_id,receipt_no) DO UPDATE SET
       reserve_id=excluded.reserve_id,status='0',is_calling=0,last_seen_at=excluded.last_seen_at`
  ).bind(businessDate, waitTypeId, receiptNo, reserveId, '', now, now).run();

  // Do not copy the latest AirWAIT marker here. The next monitor tick should observe
  // the upstream change and perform an authoritative reconciliation.
  await logEvent(env, 'RESERVATION_CREATED', { waitTypeId, reserveId: reserveId ? 'present' : '' }, 'INFO', receiptNo);

  return {
    ok: true,
    stored: true,
    version: CFG.VERSION,
    reserveId,
    receiptNo,
    shortUrl: String(dto.shortUrl || ''),
    businessDate,
    operationalDate: businessDate,
  };
}

/* ---------------------------------------------------------------------- */
/* Centralized snapshot: D1 is the read model, AirWAIT is polled only here */
/* ---------------------------------------------------------------------- */

async function readSnapshot(env, businessDate = jstDate()) {
  const { results } = await env.DB.prepare(
    `SELECT receipt_no AS number, wait_type_id AS waitTypeId, wait_type_name AS waitTypeName,
            status, CAST(is_calling AS TEXT) AS isCalling, first_seen_at AS firstSeenAt,
            last_seen_at AS lastSeenAt
     FROM airwait_snapshot
     WHERE business_date=?
     ORDER BY CAST(receipt_no AS INTEGER) ASC`
  ).bind(businessDate).all();
  return results || [];
}

async function reconcileSnapshot(env, marker) {
  const businessDate = jstDate();
  const upstream = (await allReservations(env, { isEnabledStatus: '1' })).map(r => ({
    number: normalizeReceipt(r?.number ?? r?.receiptNo),
    waitTypeId: normalizeWaitType(r?.waitTypeId),
    waitTypeName: String(r?.waitTypeName || ''),
    status: String(r?.status ?? ''),
    isCalling: callFlag(r?.isCalling) ? 1 : 0,
  })).filter(r => r.number && r.waitTypeId);

  const current = await readSnapshot(env, businessDate);
  const existing = new Map(current.map(r => [`${r.waitTypeId}|${r.number}`, r]));
  const incoming = new Map(upstream.map(r => [`${r.waitTypeId}|${r.number}`, r]));
  const now = Date.now();

  const writes = [];
  let inserted = 0, updated = 0, removed = 0, callTransitions = 0;

  for (const row of upstream) {
    const key = `${row.waitTypeId}|${row.number}`;
    const old = existing.get(key);
    const changed = !old ||
      String(old.waitTypeName || '') !== row.waitTypeName ||
      String(old.status || '') !== row.status ||
      (callFlag(old.isCalling) ? 1 : 0) !== row.isCalling;

    if (!changed) continue;
    if (!old) inserted++;
    else updated++;
    if ((!old || !callFlag(old.isCalling)) && row.isCalling === 1) callTransitions++;

    writes.push(env.DB.prepare(
      `INSERT INTO airwait_snapshot
        (business_date,wait_type_id,receipt_no,reserve_id,wait_type_name,status,is_calling,first_seen_at,last_seen_at)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(business_date,wait_type_id,receipt_no) DO UPDATE SET
         wait_type_name=excluded.wait_type_name,
         status=excluded.status,
         is_calling=excluded.is_calling,
         last_seen_at=excluded.last_seen_at`
    ).bind(
      businessDate, row.waitTypeId, row.number, null, row.waitTypeName,
      row.status, row.isCalling, old ? Number(old.firstSeenAt || now) : now, now
    ));
  }

  for (const [key, old] of existing) {
    if (incoming.has(key)) continue;
    removed++;
    writes.push(env.DB.prepare(
      'DELETE FROM airwait_snapshot WHERE business_date=? AND wait_type_id=? AND receipt_no=?'
    ).bind(businessDate, String(old.waitTypeId || ''), String(old.number || '')));
  }

  for (let i = 0; i < writes.length; i += 50) {
    await env.DB.batch(writes.slice(i, i + 50));
  }

  await setSystemState(env, 'airwait_snapshot_marker', marker);
  await setSystemState(env, 'airwait_snapshot_updated_at', String(now));
  await setSystemState(env, 'airwait_snapshot_format', CFG.SNAPSHOT_FORMAT);

  const summary = {
    marker,
    upstreamRows: upstream.length,
    inserted,
    updated,
    removed,
    callTransitions,
    writes: writes.length,
  };
  await logEvent(env, 'AIRWAIT_DELTA_SYNC', summary);
  return { rows: upstream, summary };
}

async function snapshot(env) {
  // Browser reads D1 only. This prevents hundreds of customer devices from
  // hammering AirWAIT's last-update API.
  const businessDate = jstDate();
  const rows = await readSnapshot(env, businessDate);
  const marker = await getSystemState(env, 'airwait_snapshot_marker');
  const updatedAt = Number(await getSystemState(env, 'airwait_snapshot_updated_at') || 0);

  return {
    ok: true,
    version: CFG.VERSION,
    businessDate,
    serverNow: new Date().toISOString(),
    marker: marker || '',
    changed: false,
    snapshotUpdatedAt: updatedAt ? new Date(updatedAt).toISOString() : '',
    snapshotAgeSec: updatedAt ? Math.max(0, Math.floor((Date.now() - updatedAt) / 1000)) : null,
    rows: rows.map(r => ({
      number: String(r.number || ''),
      waitTypeId: String(r.waitTypeId || ''),
      waitTypeName: String(r.waitTypeName || ''),
      status: String(r.status || ''),
      isCalling: callFlag(r.isCalling) ? '1' : '0',
    })),
  };
}

async function lookupSnapshot(env, p) {
  const businessDate = jstDate();
  const receiptNo = normalizeReceipt(p.get('receiptNo') || p.get('number'));
  if (!receiptNo) return { ok: false, found: false, error: 'VALIDATION_ERROR', version: CFG.VERSION };

  const { results: matches } = await env.DB.prepare(
    `SELECT receipt_no AS number,wait_type_id AS waitTypeId,wait_type_name AS waitTypeName,
            status,CAST(is_calling AS TEXT) AS isCalling
     FROM airwait_snapshot WHERE business_date=? AND receipt_no=?`
  ).bind(businessDate, receiptNo).all();

  const found = matches || [];
  if (!found.length) return { ok: true, found: false, version: CFG.VERSION, businessDate };
  if (found.length !== 1) {
    return { ok: false, found: false, error: 'AIRWAIT_RECEIPT_AMBIGUOUS', version: CFG.VERSION, businessDate };
  }

  const current = found[0];
  const { results: group } = await env.DB.prepare(
    `SELECT receipt_no AS number,wait_type_id AS waitTypeId,wait_type_name AS waitTypeName,
            status,CAST(is_calling AS TEXT) AS isCalling
     FROM airwait_snapshot
     WHERE business_date=? AND wait_type_id=?
     ORDER BY CAST(receipt_no AS INTEGER) ASC`
  ).bind(businessDate, String(current.waitTypeId || '')).all();

  const updatedAt = Number(await getSystemState(env, 'airwait_snapshot_updated_at') || 0);
  return {
    ok: true,
    found: true,
    version: CFG.VERSION,
    businessDate,
    current,
    rows: group || [],
    snapshotUpdatedAt: updatedAt ? new Date(updatedAt).toISOString() : '',
    snapshotAgeSec: updatedAt ? Math.max(0, Math.floor((Date.now() - updatedAt) / 1000)) : null,
  };
}

async function ticketStatus(env, p) {
  const businessDate = jstDate();
  const receiptNo = normalizeReceipt(p.get('receiptNo') || p.get('number'));
  const waitTypeId = normalizeWaitType(p.get('waitTypeId'));
  if (!receiptNo || !waitTypeId) return { ok: false, found: false, error: 'VALIDATION_ERROR', version: CFG.VERSION };

  const row = await env.DB.prepare(
    `SELECT receipt_no AS number,wait_type_id AS waitTypeId,wait_type_name AS waitTypeName,
            status,CAST(is_calling AS TEXT) AS isCalling
     FROM airwait_snapshot
     WHERE business_date=? AND wait_type_id=? AND receipt_no=? LIMIT 1`
  ).bind(businessDate, waitTypeId, receiptNo).first();

  const updatedAt = Number(await getSystemState(env, 'airwait_snapshot_updated_at') || 0);
  return {
    ok: true,
    found: Boolean(row),
    version: CFG.VERSION,
    businessDate,
    row: row || null,
    snapshotUpdatedAt: updatedAt ? new Date(updatedAt).toISOString() : '',
    snapshotAgeSec: updatedAt ? Math.max(0, Math.floor((Date.now() - updatedAt) / 1000)) : null,
  };
}

async function reservationStatus(env, p) {
  const businessDate = normalizeDate(p.get('businessDate') || p.get('day') || p.get('date')) || jstDate();
  const receiptNo = normalizeReceipt(p.get('receiptNo') || p.get('number'));
  const waitTypeId = normalizeWaitType(p.get('waitTypeId'));
  const reserveId = normalizeReserveId(p.get('reserveId'));
  let row = null;

  if (reserveId) {
    row = await env.DB.prepare(
      'SELECT * FROM notification_bindings WHERE business_date=? AND reserve_id=? ORDER BY updated_at DESC LIMIT 1'
    ).bind(businessDate, reserveId).first();
  }
  if (!row && receiptNo && waitTypeId) {
    row = await env.DB.prepare(
      'SELECT * FROM notification_bindings WHERE business_date=? AND receipt_no=? AND wait_type_id=? LIMIT 1'
    ).bind(businessDate, receiptNo, waitTypeId).first();
  }
  return row ? publicBinding(row, true) : { ok: true, found: false, version: CFG.VERSION };
}

async function callInfo(env, p) {
  const businessDate = normalizeDate(p.get('businessDate') || p.get('day') || p.get('date')) || jstDate();
  const receiptNo = normalizeReceipt(p.get('receiptNo') || p.get('number'));
  const waitTypeId = normalizeWaitType(p.get('waitTypeId'));
  if (!receiptNo || !waitTypeId) return { ok: false, error: 'VALIDATION_ERROR', version: CFG.VERSION };

  const row = await env.DB.prepare(
    'SELECT is_calling,last_seen_at FROM airwait_snapshot WHERE business_date=? AND receipt_no=? AND wait_type_id=? LIMIT 1'
  ).bind(businessDate, receiptNo, waitTypeId).first();

  if (!row || !callFlag(row.is_calling)) return { ok: true, found: false, version: CFG.VERSION };
  const t = Number(row.last_seen_at || Date.now());
  return {
    ok: true,
    found: true,
    version: CFG.VERSION,
    firstSeenAt: new Date(t).toISOString(),
    lastSeenAt: new Date(t).toISOString(),
  };
}

/* ---------------------------------------------------------------------- */
/* LINE token issue / send                                                 */
/* ---------------------------------------------------------------------- */

async function lineChannelToken(env) {
  const now = Date.now();
  if (channelTokenCache.token && channelTokenCache.expiresAt > now + 60 * 1000) {
    return channelTokenCache.token;
  }

  let res;
  try {
    res = await fetch(CFG.LINE_OAUTH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CFG.LINE_CHANNEL_ID,
        client_secret: env.PURPLE_LINE_MINIAPP_CHANNEL_SECRET,
      }),
    });
  } catch {
    throw apiError('CHANNEL_TOKEN_NETWORK', 502, false);
  }

  const text = await res.text();
  const d = parseJson(text, 'CHANNEL_TOKEN_PARSE');
  if (!res.ok || !d?.access_token) throw apiError(`CHANNEL_TOKEN_HTTP_${res.status}`, res.status || 502, false);

  const expiresIn = Math.max(60, Number(d.expires_in || 900));
  channelTokenCache = {
    token: String(d.access_token),
    expiresAt: now + expiresIn * 1000,
  };
  return channelTokenCache.token;
}

async function issueServiceToken(env, p) {
  const receiptNo = normalizeReceipt(p.receiptNo);
  const waitTypeId = normalizeWaitType(p.waitTypeId);
  const businessDate = normalizeDate(p.businessDate || p.day || p.operationalDay);
  const bindingMode = String(p.bindingMode || (p.reserveId ? 'onsite' : 'web')).toLowerCase() === 'web' ? 'web' : 'onsite';
  const reserveId = bindingMode === 'onsite' ? normalizeReserveId(p.reserveId) : '';
  const waitTypeName = String(p.waitTypeName || '').trim().slice(0, 100);
  const source = String(p.source || 'purple-cloudflare').trim().slice(0, 100);
  const requestId = normalizeRequestId(p.requestId) || makeRequestId();
  const liffAccessToken = String(p.liffAccessToken || '').trim();

  if (!receiptNo || !waitTypeId || !businessDate || (bindingMode === 'onsite' && !reserveId)) {
    throw apiError('VALIDATION_ERROR', 400, false);
  }
  if (businessDate !== jstDate()) throw apiError('AIRWAIT_BUSINESS_DATE_MISMATCH', 400, false);
  if (liffAccessToken.length < 20) throw apiError('LIFF_ACCESS_TOKEN_REQUIRED', 400, false);

  // A one-time live verification is intentional here. Registration must not bind
  // a guessed receipt number solely from the D1 read model.
  const live = await findLiveReservation(env, receiptNo, waitTypeId);
  if (!live) throw apiError('AIRWAIT_RESERVATION_NOT_VERIFIED', 404, false);
  if (String(live.status || '') !== '0') throw apiError('AIRWAIT_RESERVATION_NOT_WAITING', 409, false);
  if (callFlag(live.isCalling)) throw apiError('AIRWAIT_RESERVATION_ALREADY_CALLING', 409, false);

  const existing = await env.DB.prepare(
    'SELECT * FROM notification_bindings WHERE business_date=? AND wait_type_id=? AND receipt_no=? LIMIT 1'
  ).bind(businessDate, waitTypeId, receiptNo).first();

  if (existing?.notification_token) {
    if (Number(existing.notification_token_expires_at || 0) <= Date.now()) {
      throw apiError('SERVICE_NOTIFICATION_TOKEN_EXPIRED_NEW_ACTION_REQUIRED', 409, false);
    }
    if (Number(existing.remaining_count || 0) <= 0) {
      throw apiError('SERVICE_NOTIFICATION_TOKEN_EXHAUSTED_NEW_ACTION_REQUIRED', 409, false);
    }
    return publicBinding(existing, true);
  }

  if (existing && ['TOKEN_ISSUE_PENDING', 'TOKEN_ISSUE_AMBIGUOUS'].includes(String(existing.state || ''))) {
    throw apiError('TOKEN_ISSUE_REQUIRES_MANUAL_REVIEW', 409, false);
  }

  const tokenHash = await sha256Hex(liffAccessToken);
  const used = await env.DB.prepare(
    'SELECT binding_id FROM notification_bindings WHERE liff_token_hash=? LIMIT 1'
  ).bind(tokenHash).first();
  if (used) throw apiError('LIFF_ACCESS_TOKEN_ALREADY_USED', 409, false);

  const channelToken = await lineChannelToken(env);
  const now = Date.now();
  const bindingId = bindingMode === 'onsite' ? `RID:${reserveId}` : `WEB:${businessDate}:${waitTypeId}:${receiptNo}`;

  await env.DB.prepare(
    `INSERT INTO notification_bindings
      (binding_id,business_date,receipt_no,binding_mode,reserve_id,wait_type_id,wait_type_name,
       notification_token,notification_token_expires_at,remaining_count,session_id,liff_token_hash,
       state,send_state,template_name,request_id,source,call_detected_at,send_claimed_at,last_sent_at,
       last_http_status,retry_count,next_retry_at,last_error,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(business_date,wait_type_id,receipt_no) DO UPDATE SET
       binding_id=excluded.binding_id,binding_mode=excluded.binding_mode,reserve_id=excluded.reserve_id,
       wait_type_name=excluded.wait_type_name,liff_token_hash=excluded.liff_token_hash,
       state='TOKEN_ISSUE_PENDING',send_state='WAITING',template_name=excluded.template_name,
       request_id=excluded.request_id,source=excluded.source,last_error='',updated_at=excluded.updated_at`
  ).bind(
    bindingId, businessDate, receiptNo, bindingMode, reserveId || null, waitTypeId,
    waitTypeName || String(live.waitTypeName || ''), '', null, 0, '', tokenHash,
    'TOKEN_ISSUE_PENDING', 'WAITING', CFG.TEMPLATE_NAME, requestId, source,
    null, null, null, null, 0, null, '', now, now
  ).run();

  let res;
  try {
    res = await fetch(CFG.LINE_NOTIFIER_TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': `Bearer ${channelToken}`,
      },
      body: JSON.stringify({ liffAccessToken }),
    });
  } catch {
    await markTokenIssueFailure(env, bindingId, 'TOKEN_ISSUE_AMBIGUOUS', 'NOTIFIER_TOKEN_NETWORK_AMBIGUOUS', null);
    await logEvent(env, 'LINE_TOKEN_ISSUE_AMBIGUOUS', { reason: 'network' }, 'ERROR', receiptNo);
    throw apiError('NOTIFIER_TOKEN_NETWORK_AMBIGUOUS', 502, true);
  }

  const text = await res.text();
  if (!res.ok) {
    const ambiguous = res.status >= 500;
    await markTokenIssueFailure(
      env,
      bindingId,
      ambiguous ? 'TOKEN_ISSUE_AMBIGUOUS' : 'TOKEN_ISSUE_ERROR',
      `NOTIFIER_TOKEN_HTTP_${res.status}`,
      res.status
    );
    await logEvent(env, 'LINE_TOKEN_ISSUE_ERROR', { httpStatus: res.status, ambiguous }, 'ERROR', receiptNo);
    throw apiError(`NOTIFIER_TOKEN_HTTP_${res.status}`, res.status, ambiguous);
  }

  let d;
  try { d = JSON.parse(text); }
  catch {
    await markTokenIssueFailure(env, bindingId, 'TOKEN_ISSUE_AMBIGUOUS', 'NOTIFIER_TOKEN_200_PARSE_AMBIGUOUS', 200);
    throw apiError('NOTIFIER_TOKEN_200_PARSE_AMBIGUOUS', 502, true);
  }

  if (!d?.notificationToken) {
    await markTokenIssueFailure(env, bindingId, 'TOKEN_ISSUE_AMBIGUOUS', 'NOTIFICATION_TOKEN_EMPTY_AFTER_200', 200);
    throw apiError('NOTIFICATION_TOKEN_EMPTY_AFTER_200', 502, true);
  }

  const expiresAt = Date.now() + Math.max(0, Number(d.expiresIn || 0)) * 1000;
  const remainingCount = Number(d.remainingCount || 0);
  await env.DB.prepare(
    `UPDATE notification_bindings SET
       notification_token=?,notification_token_expires_at=?,remaining_count=?,session_id=?,
       state=?,send_state='WAITING',last_error='',last_http_status=200,updated_at=?
     WHERE binding_id=?`
  ).bind(
    String(d.notificationToken), expiresAt, remainingCount, String(d.sessionId || ''),
    remainingCount > 0 && expiresAt > Date.now() ? 'TOKEN_READY' : (remainingCount <= 0 ? 'TOKEN_EXHAUSTED' : 'TOKEN_EXPIRED'),
    Date.now(), bindingId
  ).run();

  await logEvent(env, 'LINE_TOKEN_READY', { remainingCount, expiresAt }, 'INFO', receiptNo);
  const saved = await env.DB.prepare('SELECT * FROM notification_bindings WHERE binding_id=? LIMIT 1').bind(bindingId).first();
  if (!saved || saved.state !== 'TOKEN_READY') throw apiError('SERVICE_NOTIFICATION_TOKEN_NOT_SENDABLE_AFTER_ISSUE', 409, false);
  return publicBinding(saved, false);
}

async function markTokenIssueFailure(env, bindingId, state, error, status) {
  await env.DB.prepare(
    'UPDATE notification_bindings SET state=?,last_error=?,last_http_status=?,updated_at=? WHERE binding_id=?'
  ).bind(state, error, status, Date.now(), bindingId).run();
}

function templateParams(rec) {
  const callstatusUrl = `${CFG.LIFF_BASE}?view=callstatus&number=${encodeURIComponent(String(rec.receipt_no || ''))}&date=${encodeURIComponent(String(rec.business_date || ''))}`;
  // Purple template limitation: all fixed-label buttons currently return to the
  // call-status page. Before production certification, choose semantically exact
  // template destinations or a better matching approved template.
  return {
    turn: `受付番号${String(rec.receipt_no || '')}番`,
    btn1_url: callstatusUrl,
    btn2_url: callstatusUrl,
    btn3_url: callstatusUrl,
    btn4_url: callstatusUrl,
  };
}

async function claimBindingForSend(env, bindingId, now) {
  const claim = await env.DB.prepare(
    `UPDATE notification_bindings SET send_state='SENDING',send_claimed_at=?,updated_at=?
     WHERE binding_id=?
       AND send_state IN ('WAITING','READY','RETRY')
       AND call_detected_at IS NOT NULL
       AND notification_token<>''
       AND remaining_count>0
       AND notification_token_expires_at>?
       AND (next_retry_at IS NULL OR next_retry_at<=?)`
  ).bind(now, now, bindingId, now, now).run();
  return Number(claim?.meta?.changes || 0) === 1;
}

async function sendOneWithToken(env, rec, channelToken) {
  const now = Date.now();
  if (!await claimBindingForSend(env, rec.binding_id, now)) return { sent: false, skipped: true };

  let res;
  try {
    res = await fetch(CFG.LINE_NOTIFIER_SEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': `Bearer ${channelToken}`,
      },
      body: JSON.stringify({
        templateName: CFG.TEMPLATE_NAME,
        params: templateParams(rec),
        notificationToken: String(rec.notification_token || ''),
      }),
    });
  } catch {
    await env.DB.prepare(
      `UPDATE notification_bindings SET send_state='AMBIGUOUS',last_error='NOTIFIER_SEND_NETWORK_AMBIGUOUS',updated_at=? WHERE binding_id=?`
    ).bind(Date.now(), rec.binding_id).run();
    await logEvent(env, 'LINE_SEND_AMBIGUOUS', { reason: 'network' }, 'ERROR', rec.receipt_no);
    return { sent: false, ambiguous: true };
  }

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429) {
      const retryCount = Number(rec.retry_count || 0) + 1;
      const retry = retryCount <= CFG.SEND_RETRY_MAX;
      const retryAfterHeader = Number(res.headers.get('Retry-After') || 0);
      const backoff = retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : Math.min(5 * 60 * 1000, CFG.SEND_RETRY_BASE_MS * Math.pow(2, retryCount - 1));
      await env.DB.prepare(
        `UPDATE notification_bindings SET send_state=?,retry_count=?,next_retry_at=?,last_http_status=?,last_error=?,updated_at=? WHERE binding_id=?`
      ).bind(
        retry ? 'RETRY' : 'ERROR', retryCount, retry ? Date.now() + backoff : null,
        res.status, `NOTIFIER_SEND_HTTP_${res.status}`, Date.now(), rec.binding_id
      ).run();
      await logEvent(env, 'LINE_SEND_429', { retryCount, retry, backoffMs: backoff }, retry ? 'WARN' : 'ERROR', rec.receipt_no);
      return { sent: false, retry };
    }

    if (res.status >= 500) {
      // Fail closed: the server may have accepted the send before returning/failing.
      await env.DB.prepare(
        `UPDATE notification_bindings SET send_state='AMBIGUOUS',last_http_status=?,last_error=?,updated_at=? WHERE binding_id=?`
      ).bind(res.status, `NOTIFIER_SEND_HTTP_${res.status}_AMBIGUOUS`, Date.now(), rec.binding_id).run();
      await logEvent(env, 'LINE_SEND_AMBIGUOUS', { httpStatus: res.status }, 'ERROR', rec.receipt_no);
      return { sent: false, ambiguous: true };
    }

    await env.DB.prepare(
      `UPDATE notification_bindings SET send_state='ERROR',last_http_status=?,last_error=?,updated_at=? WHERE binding_id=?`
    ).bind(res.status, `NOTIFIER_SEND_HTTP_${res.status}`, Date.now(), rec.binding_id).run();
    await logEvent(env, 'LINE_SEND_ERROR', { httpStatus: res.status }, 'ERROR', rec.receipt_no);
    return { sent: false, error: true };
  }

  let d;
  try { d = JSON.parse(text); }
  catch {
    await env.DB.prepare(
      `UPDATE notification_bindings SET send_state='AMBIGUOUS',last_http_status=200,last_error='NOTIFIER_SEND_200_PARSE_AMBIGUOUS',updated_at=? WHERE binding_id=?`
    ).bind(Date.now(), rec.binding_id).run();
    await logEvent(env, 'LINE_SEND_AMBIGUOUS', { httpStatus: 200, reason: 'invalid_json' }, 'ERROR', rec.receipt_no);
    return { sent: false, ambiguous: true };
  }

  const expiresAt = Date.now() + Math.max(0, Number(d.expiresIn || 0)) * 1000;
  const remainingCount = Number(d.remainingCount || 0);
  await env.DB.prepare(
    `UPDATE notification_bindings SET
       notification_token=?,notification_token_expires_at=?,remaining_count=?,session_id=?,
       state=?,send_state='SENT',last_sent_at=?,last_http_status=200,retry_count=0,next_retry_at=NULL,last_error='',updated_at=?
     WHERE binding_id=?`
  ).bind(
    String(d.notificationToken || rec.notification_token || ''), expiresAt, remainingCount, String(d.sessionId || rec.session_id || ''),
    remainingCount <= 0 ? 'TOKEN_EXHAUSTED' : (expiresAt <= Date.now() ? 'TOKEN_EXPIRED' : 'TOKEN_READY'),
    Date.now(), Date.now(), rec.binding_id
  ).run();

  await logEvent(env, 'LINE_SEND_OK', { httpStatus: 200, remainingCount }, 'INFO', rec.receipt_no);
  return { sent: true };
}

async function sendPendingBatch(env) {
  const businessDate = jstDate();
  const now = Date.now();

  const { results } = await env.DB.prepare(
    `SELECT b.* FROM notification_bindings b
     JOIN airwait_snapshot s
       ON s.business_date=b.business_date
      AND s.wait_type_id=b.wait_type_id
      AND s.receipt_no=b.receipt_no
     WHERE b.business_date=?
       AND b.call_detected_at IS NOT NULL
       AND b.notification_token<>''
       AND b.remaining_count>0
       AND b.notification_token_expires_at>?
       AND b.send_state IN ('WAITING','READY','RETRY')
       AND (b.next_retry_at IS NULL OR b.next_retry_at<=?)
       AND s.status='0' AND s.is_calling=1
     ORDER BY b.call_detected_at ASC, b.created_at ASC
     LIMIT ?`
  ).bind(businessDate, now, now, CFG.SEND_BATCH_LIMIT).all();

  const candidates = results || [];
  if (!candidates.length) return { candidates: 0, sent: 0, ambiguous: 0, retried: 0, errors: 0, skipped: 0 };

  let channelToken;
  try {
    // Exactly one channel-token acquisition per batch (and often zero due isolate cache).
    channelToken = await lineChannelToken(env);
  } catch (e) {
    await logEvent(env, 'LINE_CHANNEL_TOKEN_ERROR', { error: safeError(e), candidates: candidates.length }, 'ERROR');
    return { candidates: candidates.length, sent: 0, ambiguous: 0, retried: candidates.length, errors: 0, skipped: 0, channelTokenError: true };
  }

  let sent = 0, ambiguous = 0, retried = 0, errors = 0, skipped = 0;
  for (let i = 0; i < candidates.length; i += CFG.SEND_CONCURRENCY) {
    const chunk = candidates.slice(i, i + CFG.SEND_CONCURRENCY);
    const outcomes = await Promise.all(chunk.map(rec => sendOneWithToken(env, rec, channelToken)));
    for (const r of outcomes) {
      if (r.sent) sent++;
      else if (r.ambiguous) ambiguous++;
      else if (r.retry) retried++;
      else if (r.error) errors++;
      else skipped++;
    }
  }

  return { candidates: candidates.length, sent, ambiguous, retried, errors, skipped };
}

/* ---------------------------------------------------------------------- */
/* Central worker tick                                                     */
/* ---------------------------------------------------------------------- */

async function acquireWorkerLease(env) {
  const now = Date.now();
  const until = now + CFG.LOCK_MS;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO system_state(key,value,updated_at) VALUES('worker_lease_until','0',?)`
  ).bind(now).run();

  const r = await env.DB.prepare(
    `UPDATE system_state SET value=?,updated_at=?
     WHERE key='worker_lease_until' AND CAST(value AS INTEGER) < ?`
  ).bind(String(until), now, String(now)).run();
  return Number(r?.meta?.changes || 0) === 1;
}

async function releaseWorkerLease(env) {
  try { await setSystemState(env, 'worker_lease_until', '0'); } catch (_) {}
}

async function quarantineStaleSending(env) {
  const cutoff = Date.now() - 60 * 1000;
  const r = await env.DB.prepare(
    `UPDATE notification_bindings
     SET send_state='AMBIGUOUS',last_error='STALE_SENDING_OUTCOME_UNKNOWN',updated_at=?
     WHERE business_date=? AND send_state='SENDING' AND send_claimed_at IS NOT NULL AND send_claimed_at<?`
  ).bind(Date.now(), jstDate(), cutoff).run();
  const count = Number(r?.meta?.changes || 0);
  if (count) await logEvent(env, 'STALE_SENDING_QUARANTINED', { count }, 'ERROR');
  return count;
}

async function markCallingBindings(env) {
  const businessDate = jstDate();
  const now = Date.now();
  const r = await env.DB.prepare(
    `UPDATE notification_bindings
     SET call_detected_at=COALESCE(call_detected_at,?),
         send_state=CASE WHEN send_state='WAITING' THEN 'READY' ELSE send_state END,
         updated_at=?
     WHERE business_date=?
       AND notification_token<>''
       AND remaining_count>0
       AND notification_token_expires_at>?
       AND (call_detected_at IS NULL OR send_state='WAITING')
       AND EXISTS (
         SELECT 1 FROM airwait_snapshot s
         WHERE s.business_date=notification_bindings.business_date
           AND s.wait_type_id=notification_bindings.wait_type_id
           AND s.receipt_no=notification_bindings.receipt_no
           AND s.status='0' AND s.is_calling=1
       )`
  ).bind(now, now, businessDate, now).run();
  const count = Number(r?.meta?.changes || 0);
  if (count) await logEvent(env, 'CALL_BINDINGS_READY', { count });
  return count;
}

async function runWorkerTick(env, meta = {}) {
  await ensureAuxSchema(env);
  await purgeOldLogsOncePerDay(env);

  const started = Date.now();
  const lease = await acquireWorkerLease(env);
  if (!lease) {
    return {
      ok: true,
      version: CFG.VERSION,
      skipped: true,
      reason: 'WORKER_LEASE_BUSY',
      durationMs: Date.now() - started,
    };
  }

  let changed = false;
  let syncSummary = null;
  let latestMarker = '';

  try {
    const latest = await airGetLast(env);
    latestMarker = latest.marker;
    const previous = await getSystemState(env, 'airwait_worker_marker');
    const snapshotMarker = await getSystemState(env, 'airwait_snapshot_marker');
    const snapshotFormat = await getSystemState(env, 'airwait_snapshot_format');

    changed = !previous || latest.marker !== previous || snapshotFormat !== CFG.SNAPSHOT_FORMAT;

    if (changed) {
      // If another centralized path already reconciled this exact marker in the
      // new format, reuse D1. Otherwise perform one authoritative active-list sync.
      if (!(snapshotMarker === latest.marker && snapshotFormat === CFG.SNAPSHOT_FORMAT)) {
        const synced = await reconcileSnapshot(env, latest.marker);
        syncSummary = synced.summary;
      }
      await setSystemState(env, 'airwait_worker_marker', latest.marker);
    }

    const quarantined = await quarantineStaleSending(env);
    const newlyReady = await markCallingBindings(env);
    const sends = await sendPendingBatch(env);

    const result = {
      ok: true,
      version: CFG.VERSION,
      markerChanged: changed,
      marker: latestMarker,
      sync: syncSummary,
      quarantined,
      newlyReady,
      ...sends,
      source: String(meta.source || 'scheduler'),
      slot: Number(meta.slot || 0),
      durationMs: Date.now() - started,
    };

    await setSystemState(env, 'worker_last_run_at', String(Date.now()));
    await setSystemState(env, 'worker_last_result', JSON.stringify(result).slice(0, 1800));
    await setSystemState(env, 'worker_last_error', '');
    return result;
  } catch (e) {
    const error = safeError(e);
    await setSystemState(env, 'worker_last_run_at', String(Date.now()));
    await setSystemState(env, 'worker_last_error', error);
    await setSystemState(env, 'worker_last_result', JSON.stringify({ ok: false, error, marker: latestMarker }).slice(0, 1800));
    await logEvent(env, 'WORKER_TICK_ERROR', { error, source: meta.source || '' }, 'ERROR');
    throw e;
  } finally {
    await releaseWorkerLease(env);
  }
}

/* ---------------------------------------------------------------------- */
/* Status / diagnostics                                                    */
/* ---------------------------------------------------------------------- */

async function systemStatus(env) {
  await ensureAuxSchema(env);
  const now = Date.now();
  const businessDate = jstDate();
  const plan = await getSchedulerPlan(env, { recordEvent: false, source: 'system-status' });

  const schedulerLastEventAt = Number(await getSystemState(env, 'scheduler_last_event_at') || 0);
  const schedulerLastOkAt = Number(await getSystemState(env, 'scheduler_last_ok_at') || 0);
  const workerLastRunAt = Number(await getSystemState(env, 'worker_last_run_at') || 0);
  const snapshotUpdatedAt = Number(await getSystemState(env, 'airwait_snapshot_updated_at') || 0);

  const counts = await env.DB.prepare(
    `SELECT
       COUNT(*) AS totalBindings,
       SUM(CASE WHEN send_state='SENT' THEN 1 ELSE 0 END) AS sent,
       SUM(CASE WHEN send_state IN ('READY','RETRY','WAITING') AND call_detected_at IS NOT NULL THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN send_state='AMBIGUOUS' THEN 1 ELSE 0 END) AS ambiguous,
       SUM(CASE WHEN send_state='SENDING' THEN 1 ELSE 0 END) AS inFlight,
       SUM(CASE WHEN send_state='ERROR' THEN 1 ELSE 0 END) AS errors
     FROM notification_bindings WHERE business_date=?`
  ).bind(businessDate).first();

  const snap = await env.DB.prepare(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status='0' AND is_calling=1 THEN 1 ELSE 0 END) AS calling
     FROM airwait_snapshot WHERE business_date=?`
  ).bind(businessDate).first();

  let workerLastResult = null;
  let schedulerSummary = null;
  try {
    const raw = await getSystemState(env, 'worker_last_result');
    workerLastResult = raw ? JSON.parse(raw) : null;
  } catch (_) {}
  try {
    const raw = await getSystemState(env, 'scheduler_last_summary');
    schedulerSummary = raw ? JSON.parse(raw) : null;
  } catch (_) {}

  return {
    ok: true,
    version: CFG.VERSION,
    architecture: CFG.ARCHITECTURE,
    serverNow: new Date(now).toISOString(),
    currentPlan: plan,
    scheduler: {
      lastEventAt: isoFromEpoch(schedulerLastEventAt),
      lastEventAgeSec: ageSec(now, schedulerLastEventAt),
      lastOkAt: isoFromEpoch(schedulerLastOkAt),
      lastPlan: await getSystemState(env, 'scheduler_last_plan'),
      lastPlanReason: await getSystemState(env, 'scheduler_last_plan_reason'),
      lastCron: await getSystemState(env, 'scheduler_last_cron'),
      lastError: await getSystemState(env, 'scheduler_last_error'),
      lastSummary: schedulerSummary,
    },
    worker: {
      lastRunAt: isoFromEpoch(workerLastRunAt),
      lastRunAgeSec: ageSec(now, workerLastRunAt),
      lastError: await getSystemState(env, 'worker_last_error'),
      lastResult: workerLastResult,
      marker: await getSystemState(env, 'airwait_worker_marker'),
    },
    snapshot: {
      marker: await getSystemState(env, 'airwait_snapshot_marker'),
      updatedAt: isoFromEpoch(snapshotUpdatedAt),
      ageSec: ageSec(now, snapshotUpdatedAt),
      total: Number(snap?.total || 0),
      calling: Number(snap?.calling || 0),
    },
    notifications: {
      totalBindings: Number(counts?.totalBindings || 0),
      sent: Number(counts?.sent || 0),
      pending: Number(counts?.pending || 0),
      ambiguous: Number(counts?.ambiguous || 0),
      inFlight: Number(counts?.inFlight || 0),
      errors: Number(counts?.errors || 0),
    },
  };
}

/* ---------------------------------------------------------------------- */
/* POST idempotency                                                        */
/* ---------------------------------------------------------------------- */

async function claimRequestId(env, requestId, action) {
  const now = Date.now();
  const expiresAt = now + CFG.REQUEST_PENDING_TTL_SEC * 1000;
  const insert = await env.DB.prepare(
    `INSERT OR IGNORE INTO request_results
      (request_id,action,state,http_status,ambiguous,result_json,error,created_at,updated_at,expires_at)
     VALUES(?,?, 'PENDING', NULL,0,'','',?,?,?)`
  ).bind(requestId, action || '', now, now, expiresAt).run();

  if (Number(insert?.meta?.changes || 0) === 1) return { owner: true, cached: false };

  const row = await env.DB.prepare(
    'SELECT state,result_json,expires_at FROM request_results WHERE request_id=? LIMIT 1'
  ).bind(requestId).first();

  if (!row) return { owner: false, cached: false };
  if (Number(row.expires_at || 0) <= now) {
    // Fail closed. A stale PENDING create may have succeeded upstream.
    return { owner: false, cached: true, result: {
      ok: false, stored: false, ambiguous: true,
      error: 'STALE_REQUEST_REQUIRES_MANUAL_REVIEW', version: CFG.VERSION,
    }};
  }
  if (String(row.state || '') === 'PENDING') return { owner: false, cached: false };
  try {
    return { owner: false, cached: true, result: JSON.parse(String(row.result_json || '{}')) };
  } catch {
    return { owner: false, cached: true, result: {
      ok: false, stored: false, error: 'REQUEST_CACHE_INVALID', version: CFG.VERSION,
    }};
  }
}

async function finalizeRequestResult(env, requestId, action, result) {
  const now = Date.now();
  const expires = now + CFG.REQUEST_TTL_SEC * 1000;
  await env.DB.prepare(
    `UPDATE request_results SET action=?,state=?,http_status=?,ambiguous=?,result_json=?,error=?,updated_at=?,expires_at=?
     WHERE request_id=?`
  ).bind(
    action || '', result?.ok ? 'DONE' : 'ERROR', null, result?.ambiguous ? 1 : 0,
    JSON.stringify(result || {}), String(result?.error || ''), now, expires, requestId
  ).run();

  // Small bounded cleanup. No full-table scan beyond indexed expires_at.
  await env.DB.prepare('DELETE FROM request_results WHERE expires_at < ?').bind(now).run();
}

async function requestStatus(env, requestId) {
  const id = normalizeRequestId(requestId);
  if (!id) return { ok: false, found: false, error: 'REQUEST_ID_REQUIRED', version: CFG.VERSION };
  const row = await env.DB.prepare(
    'SELECT state,result_json,expires_at FROM request_results WHERE request_id=? LIMIT 1'
  ).bind(id).first();
  if (!row || Number(row.expires_at || 0) <= Date.now()) return { ok: true, found: false, version: CFG.VERSION };
  if (String(row.state || '') === 'PENDING') return { ok: true, found: false, pending: true, version: CFG.VERSION };
  try { return { found: true, ...JSON.parse(String(row.result_json || '{}')) }; }
  catch { return { ok: false, found: false, error: 'REQUEST_CACHE_INVALID', version: CFG.VERSION }; }
}

/* ---------------------------------------------------------------------- */
/* D1 state                                                                */
/* ---------------------------------------------------------------------- */

async function getSystemState(env, key) {
  const row = await env.DB.prepare('SELECT value FROM system_state WHERE key=? LIMIT 1').bind(key).first();
  return row ? String(row.value || '') : '';
}

async function setSystemState(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO system_state(key,value,updated_at) VALUES(?,?,?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`
  ).bind(key, String(value ?? ''), Date.now()).run();
}

/* ---------------------------------------------------------------------- */
/* Utilities                                                               */
/* ---------------------------------------------------------------------- */

function publicBinding(row, alreadyIssued) {
  const sendState = String(row.send_state || '');
  const publicStatus = sendState === 'SENT' ? 'CALL_MESSAGE_SENT' : String(row.state || '');
  return {
    ok: true,
    stored: true,
    found: true,
    version: CFG.VERSION,
    alreadyIssued: Boolean(alreadyIssued),
    receiptNo: String(row.receipt_no || ''),
    bindingId: String(row.binding_id || ''),
    bindingMode: String(row.binding_mode || ''),
    reserveId: String(row.reserve_id || ''),
    waitTypeId: String(row.wait_type_id || ''),
    status: publicStatus,
    sendState,
    remainingCount: Number(row.remaining_count || 0),
    expiresAt: isoOrEmpty(row.notification_token_expires_at),
    lastSentAt: isoOrEmpty(row.last_sent_at),
    retryCount: Number(row.retry_count || 0),
    error: String(row.last_error || ''),
  };
}

function normalizeReceipt(v) {
  const s = String(v ?? '').normalize('NFKC').trim().toUpperCase();
  // AirWAIT spec: F = interrupt registration, T = time-specified reservation.
  const m = s.match(/^[FT]?(\d{1,12})$/);
  return m ? m[1].replace(/^0+(?=\d)/, '') : '';
}

function normalizeWaitType(v) {
  const s = String(v ?? '').trim();
  return /^\d{4}$/.test(s) ? s : '';
}

function normalizeReserveId(v) {
  const s = String(v ?? '').normalize('NFKC').trim();
  return /^\d{1,12}$/.test(s) ? s.padStart(12, '0') : '';
}

function normalizeDate(v) {
  const s = String(v ?? '').trim().replace(/\//g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return '';
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function jstParts(epoch = Date.now()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: CFG.TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(epoch)).map(x => [x.type, x.value]));
  return values;
}

function jstDate(epoch = Date.now()) {
  const p = jstParts(epoch);
  return `${p.year}-${p.month}-${p.day}`;
}

function intInRange(v, min, max) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : min - 1;
}

function callFlag(v) {
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
}

function normalizeRequestId(v) {
  const s = String(v || '').trim();
  return /^[A-Za-z0-9_-]{8,120}$/.test(s) ? s : '';
}

function makeRequestId() {
  return `cf10_${Date.now()}_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseJson(text, label) {
  try { return JSON.parse(String(text || '')); }
  catch { throw apiError(`${label}_INVALID_JSON`, 502, false); }
}

function isoOrEmpty(v) {
  const n = Number(v || 0);
  return n > 0 ? new Date(n).toISOString() : '';
}

function isoFromEpoch(v) {
  const n = Number(v || 0);
  return n > 0 ? new Date(n).toISOString() : '';
}

function ageSec(now, then) {
  const n = Number(then || 0);
  return n > 0 ? Math.max(0, Math.floor((Number(now) - n) / 1000)) : null;
}

function apiError(message, status = 500, ambiguous = false) {
  const e = new Error(String(message || 'UNKNOWN_ERROR'));
  e.status = Number(status || 500);
  e.ambiguous = Boolean(ambiguous);
  return e;
}

function safeError(e) {
  return String(e?.message || e || 'UNKNOWN_ERROR').replace(/[\r\n\t]+/g, ' ').slice(0, 500);
}
