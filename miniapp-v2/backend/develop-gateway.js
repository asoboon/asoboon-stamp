/**
 * ASOBooN MINI App v2 - Official Developing Gateway
 * Environment: official Developing only (Channel ID 2009884611)
 *
 * Secrets (Cloudflare Worker Secrets):
 *   AIRWAIT_API_KEY
 *
 * Vars:
 *   CREATE_ENABLED = "0" | "1"   (default: 0)
 *
 * Binding:
 *   DB -> dedicated D1 database for official Developing
 *
 * NEVER put AirWAIT API keys, LINE secrets, LIFF access tokens, or notification
 * tokens in GitHub/browser code.
 */

const CFG = Object.freeze({
  VERSION: '1.0.dev1',
  ENVIRONMENT: 'official-develop',
  CHANNEL_ID: '2009884611',
  ALLOWED_ORIGIN: 'https://asoboon.github.io',
  STORE_ID: 'KR01205179',
  TZ: 'Asia/Tokyo',
  OPERATIONAL_CUTOFF_HOUR: 18,
  WEB_OPEN_MIN: 7 * 60,
  ONSITE_OPEN_MIN: 9 * 60 + 30,
  REQUEST_PENDING_TTL_MS: 10 * 60 * 1000,
  REQUEST_RESULT_TTL_MS: 24 * 60 * 60 * 1000,
  WAIT_TYPES_CACHE_MS: 10 * 60 * 1000,
  USER_ATTEMPT_LIMIT: 5,
  FACILITY: Object.freeze({ lat: 35.84895, lng: 139.74345 }),
  GEOFENCE: Object.freeze({ radiusM: 500, maxAccuracyM: 200, maxAgeMs: 2 * 60 * 1000 }),
  AIR_WAIT_TYPES: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/wait/type/get',
  AIR_CREATE: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',
  LINE_VERIFY: 'https://api.line.me/oauth2/v2.1/verify',
  LINE_PROFILE: 'https://api.line.me/v2/profile',
  BUSINESS_CALENDAR_API: 'https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec',
});

const SLOT_RULES = Object.freeze({
  '平日': Object.freeze(['0023', '0025']),
  '平日特定日': Object.freeze(['0035', '0037']),
  '土日祝日': Object.freeze(['0029', '0031', '0033']),
  '休館': Object.freeze([]),
});

const BUSINESS_RULES = Object.freeze({
  '平日': Object.freeze({ isClosed: false, closeMin: 17 * 60 }),
  '平日特定日': Object.freeze({ isClosed: false, closeMin: 17 * 60 }),
  '土日祝日': Object.freeze({ isClosed: false, closeMin: 18 * 60 }),
  '休館': Object.freeze({ isClosed: true, closeMin: null }),
});

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return preflight(request);
    try {
      requireAllowedOrigin(request);
      if (!env.DB) throw apiError('DB_NOT_CONFIGURED', 503);
      await ensureSchema(env);

      const url = new URL(request.url);
      if (request.method === 'GET') {
        const action = String(url.searchParams.get('action') || 'health');
        if (action === 'health') return out(request, await health(env));
        if (action === 'waitTypes') return out(request, await getWaitTypes(env));
        if (action === 'requestStatus') return out(request, await requestStatus(env, url.searchParams.get('requestId')));
        return out(request, { ok: false, error: 'UNKNOWN_ACTION', version: CFG.VERSION }, 404);
      }

      if (request.method !== 'POST') return out(request, { ok: false, error: 'METHOD_NOT_ALLOWED', version: CFG.VERSION }, 405);
      const p = await readBody(request);
      const action = String(p.action || '');
      if (action !== 'createReservation') return out(request, { ok: false, error: 'UNKNOWN_ACTION', version: CFG.VERSION }, 400);

      const requestId = normalizeRequestId(p.requestId);
      if (!requestId) return out(request, { ok: false, error: 'REQUEST_ID_REQUIRED', version: CFG.VERSION }, 400);

      const claim = await claimRequest(env, requestId, action);
      if (claim.cached) return out(request, claim.result, 200);
      if (!claim.owner) return out(request, { ok: true, pending: true, requestId, version: CFG.VERSION }, 202);

      let result;
      try {
        result = await createReservation(env, p, requestId);
      } catch (e) {
        result = {
          ok: false,
          stored: false,
          ambiguous: Boolean(e?.ambiguous),
          error: safeError(e),
          errorCode: String(e?.code || ''),
          version: CFG.VERSION,
        };
      }

      await finalizeRequest(env, requestId, action, result);
      return out(request, result, result.ok ? 200 : Number(result.ambiguous ? 409 : 400));
    } catch (e) {
      return out(request, { ok: false, error: safeError(e), version: CFG.VERSION }, Number(e?.status || 500));
    }
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const h = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  };
  if (origin === CFG.ALLOWED_ORIGIN) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function preflight(request) {
  try { requireAllowedOrigin(request); }
  catch { return new Response(null, { status: 403, headers: corsHeaders(request) }); }
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function requireAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== CFG.ALLOWED_ORIGIN) throw apiError('ORIGIN_NOT_ALLOWED', 403);
}

function out(request, payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function readBody(request) {
  const ct = String(request.headers.get('Content-Type') || '').toLowerCase();
  if (ct.includes('application/json')) return await request.json();
  return Object.fromEntries(new URLSearchParams(await request.text()));
}

async function ensureSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_request_results (
      request_id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      state TEXT NOT NULL,
      result_json TEXT NOT NULL DEFAULT '',
      ambiguous INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_v2_request_results_expires
      ON v2_request_results(expires_at)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_user_day_claims (
      user_hash TEXT NOT NULL,
      business_date TEXT NOT NULL,
      request_id TEXT NOT NULL,
      state TEXT NOT NULL,
      receipt_no TEXT NOT NULL DEFAULT '',
      reserve_id TEXT NOT NULL DEFAULT '',
      wait_type_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(user_hash,business_date)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_user_attempts (
      user_hash TEXT NOT NULL,
      business_date TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(user_hash,business_date)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_system_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
  ]);
}

async function health(env) {
  return {
    ok: true,
    version: CFG.VERSION,
    environment: CFG.ENVIRONMENT,
    officialDevelopEnabled: true,
    acceptedClientIds: [CFG.CHANNEL_ID],
    createRequiresVerifiedLiff: true,
    createEnabled: String(env.CREATE_ENABLED || '0') === '1',
    dbConfigured: Boolean(env.DB),
    airwaitKeyConfigured: Boolean(env.AIRWAIT_API_KEY),
    storeId: CFG.STORE_ID,
    allowedOrigin: CFG.ALLOWED_ORIGIN,
    browserHitsAirwait: false,
  };
}

async function verifyLineUser(accessToken) {
  const token = String(accessToken || '').trim();
  if (token.length < 20) throw apiError('LINE_ACCESS_TOKEN_REQUIRED', 401);

  const verifyUrl = new URL(CFG.LINE_VERIFY);
  verifyUrl.searchParams.set('access_token', token);
  const vr = await fetch(verifyUrl, { headers: { Accept: 'application/json' } });
  const v = await safeJson(vr, 'LINE_VERIFY');
  if (!vr.ok) throw apiError('LINE_TOKEN_VERIFY_FAILED', 401);
  if (String(v.client_id || '') !== CFG.CHANNEL_ID) throw apiError('LINE_CHANNEL_MISMATCH', 403);
  if (Number(v.expires_in || 0) <= 0) throw apiError('LINE_TOKEN_EXPIRED', 401);
  const scopes = new Set(String(v.scope || '').split(/\s+/).filter(Boolean));
  if (!scopes.has('profile')) throw apiError('LINE_PROFILE_SCOPE_REQUIRED', 403);

  const pr = await fetch(CFG.LINE_PROFILE, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const profile = await safeJson(pr, 'LINE_PROFILE');
  if (!pr.ok || !profile?.userId) throw apiError('LINE_PROFILE_FAILED', 401);
  return { userId: String(profile.userId), clientId: String(v.client_id), expiresIn: Number(v.expires_in) };
}

async function userHash(userId) {
  return sha256Hex(`${CFG.CHANNEL_ID}:${String(userId || '')}`);
}

function jstParts(epoch = Date.now()) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: CFG.TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(epoch)).map(x => [x.type, x.value]));
}

function operationalDate(epoch = Date.now()) {
  const p = jstParts(epoch);
  const dt = new Date(Date.UTC(+p.year, +p.month - 1, +p.day + (+p.hour >= CFG.OPERATIONAL_CUTOFF_HOUR ? 1 : 0), 12));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
}

function currentMinute(epoch = Date.now()) {
  const p = jstParts(epoch);
  return Number(p.hour) * 60 + Number(p.minute);
}

async function getBusinessDay(date) {
  const u = new URL(CFG.BUSINESS_CALENDAR_API);
  u.searchParams.set('action', 'current');
  u.searchParams.set('date', date);
  u.searchParams.set('_', String(Date.now()));
  const r = await fetch(u, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  const d = await safeJson(r, 'BUSINESS_CALENDAR');
  if (!r.ok || d?.ok !== true) throw apiError('BUSINESS_CALENDAR_UNAVAILABLE', 503);
  const type = String(d.businessType || '').normalize('NFKC').trim();
  const rule = BUSINESS_RULES[type];
  if (!rule) throw apiError('BUSINESS_TYPE_INVALID', 503);
  const returned = normalizeDate(d.operationalDate || d.calendarDate || date);
  if (returned !== date) throw apiError('BUSINESS_DATE_MISMATCH', 503);
  return { operationalDate: date, businessType: type, ...rule };
}

function enforceReceptionHours(day, mode) {
  if (day.isClosed) throw apiError('CLOSED_DAY', 400);
  const min = currentMinute();
  const open = mode === 'onsite' ? CFG.ONSITE_OPEN_MIN : CFG.WEB_OPEN_MIN;
  if (min < open) throw apiError(mode === 'onsite' ? 'ONSITE_NOT_OPEN_YET' : 'WEB_NOT_OPEN_YET', 400);
  if (min >= Number(day.closeMin || 0)) throw apiError('RECEPTION_CLOSED_FOR_DAY', 400);
}

async function getWaitTypes(env, { force = false } = {}) {
  const now = Date.now();
  if (!force) {
    const row = await env.DB.prepare('SELECT value,updated_at FROM v2_system_state WHERE key=? LIMIT 1')
      .bind('wait_types_cache').first();
    if (row && now - Number(row.updated_at || 0) < CFG.WAIT_TYPES_CACHE_MS) {
      try { return { ok: true, cached: true, waitTypes: JSON.parse(String(row.value || '[]')), version: CFG.VERSION }; }
      catch {}
    }
  }
  if (!env.AIRWAIT_API_KEY) throw apiError('AIRWAIT_KEY_NOT_CONFIGURED', 503);
  const r = await fetch(CFG.AIR_WAIT_TYPES, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      corWclpKeyCd: env.AIRWAIT_API_KEY,
    },
    body: new URLSearchParams({ storeId: CFG.STORE_ID }),
  });
  const d = await safeJson(r, 'AIRWAIT_WAIT_TYPES');
  if (!r.ok || d?.success !== true || d?.resultCode?.code !== '0000') throw apiError('AIRWAIT_WAIT_TYPES_FAILED', 502);
  const raw = Array.isArray(d?.innerDto?.waitTypeList) ? d.innerDto.waitTypeList : [];
  const waitTypes = raw.map(x => ({
    waitTypeId: normalizeWaitType(x.waitTypeId),
    waitTypeName: String(x.waitTypeName || ''),
    dispFlg: x.dispFlg !== false && String(x.dispFlg) !== '0',
    usageDispType: String(x.usageDispType || ''),
  })).filter(x => x.waitTypeId);
  await env.DB.prepare(`INSERT INTO v2_system_state(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
    .bind('wait_types_cache', JSON.stringify(waitTypes), now).run();
  return { ok: true, cached: false, waitTypes, version: CFG.VERSION };
}

function validateWaitType(waitTypes, day, mode, waitTypeId) {
  const allowed = SLOT_RULES[day.businessType] || [];
  if (!allowed.includes(waitTypeId)) throw apiError('WAIT_TYPE_NOT_ALLOWED_FOR_DAY', 400);
  const w = waitTypes.find(x => x.waitTypeId === waitTypeId);
  if (!w || w.dispFlg === false) throw apiError('WAIT_TYPE_NOT_AVAILABLE', 400);
  const usage = String(w.usageDispType || '');
  if (usage) {
    const allowedUsage = mode === 'web' ? ['01', '03'] : ['01', '02'];
    if (!allowedUsage.includes(usage)) throw apiError('WAIT_TYPE_MODE_MISMATCH', 400);
  }
  return w;
}

async function createReservation(env, p, requestId) {
  if (String(env.CREATE_ENABLED || '0') !== '1') throw apiError('CREATE_DISABLED', 503);
  if (!env.AIRWAIT_API_KEY) throw apiError('AIRWAIT_KEY_NOT_CONFIGURED', 503);

  const mode = String(p.mode || '').toLowerCase() === 'onsite' ? 'onsite' : 'web';
  const adults = intInRange(p.adults, 1, 10);
  const paidChildren = intInRange(p.paidChildren, 0, 10);
  const infants = intInRange(p.infants, 0, 10);
  const total = adults + paidChildren + infants;
  if (total < 1 || total > 10 || paidChildren + infants > adults * 3) throw apiError('PEOPLE_VALIDATION_ERROR', 400);
  const waitTypeId = normalizeWaitType(p.waitTypeId);
  if (!waitTypeId) throw apiError('WAIT_TYPE_REQUIRED', 400);

  const requestedDate = normalizeDate(p.operationalDate);
  const serverDate = operationalDate();
  if (!requestedDate || requestedDate !== serverDate) throw apiError('OPERATIONAL_DATE_MISMATCH', 400);

  const line = await verifyLineUser(p.liffAccessToken);
  const hash = await userHash(line.userId);
  await incrementAttempt(env, hash, serverDate);

  const day = await getBusinessDay(serverDate);
  enforceReceptionHours(day, mode);
  if (mode === 'onsite') validateLocation(p);

  const wt = await getWaitTypes(env, { force: true });
  validateWaitType(wt.waitTypes, day, mode, waitTypeId);

  const userClaim = await claimUserDay(env, hash, serverDate, requestId, waitTypeId);
  if (userClaim.existing) return userClaim.result;

  await setRequestState(env, requestId, 'VALIDATED');
  await setRequestState(env, requestId, 'AIRWAIT_CREATE_INFLIGHT');

  let res;
  try {
    res = await fetch(CFG.AIR_CREATE, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        corWclpKeyCd: env.AIRWAIT_API_KEY,
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
  } catch {
    await markUserClaim(env, hash, serverDate, 'AMBIGUOUS');
    throw apiError('AIRWAIT_CREATE_NETWORK_AMBIGUOUS_MANUAL_REVIEW', 502, true);
  }

  const text = await res.text();
  let d;
  try { d = JSON.parse(text); }
  catch {
    const amb = res.ok || res.status >= 500;
    if (amb) await markUserClaim(env, hash, serverDate, 'AMBIGUOUS');
    else await releaseUserClaim(env, hash, serverDate, requestId);
    throw apiError(amb ? 'AIRWAIT_CREATE_RESPONSE_AMBIGUOUS_MANUAL_REVIEW' : 'AIRWAIT_CREATE_INVALID_RESPONSE', 502, amb);
  }

  if (!res.ok) {
    const amb = res.status >= 500;
    if (amb) await markUserClaim(env, hash, serverDate, 'AMBIGUOUS');
    else await releaseUserClaim(env, hash, serverDate, requestId);
    throw apiError(`AIRWAIT_CREATE_HTTP_${res.status}`, res.status, amb);
  }

  if (d?.success !== true || d?.resultCode?.code !== '0000') {
    await releaseUserClaim(env, hash, serverDate, requestId);
    throw airwaitResultError(d?.resultCode?.code);
  }

  const dto = d?.innerDto || {};
  const reserveId = normalizeReserveId(dto.reserveId);
  const receiptNo = normalizeReceipt(dto.receiptNo);
  if (!reserveId || !receiptNo) {
    await markUserClaim(env, hash, serverDate, 'AMBIGUOUS');
    throw apiError('AIRWAIT_CREATE_200_RESULT_AMBIGUOUS_MANUAL_REVIEW', 502, true);
  }

  const result = {
    ok: true,
    stored: true,
    ambiguous: false,
    version: CFG.VERSION,
    businessDate: serverDate,
    operationalDate: serverDate,
    reserveId,
    receiptNo,
    shortUrl: String(dto.shortUrl || ''),
    waitTime: Number(dto.waitTime || 0),
    waitCount: Number(dto.waitCount || 0),
    waitCountPerson: Number(dto.waitCountPerson || 0),
  };

  await env.DB.prepare(`UPDATE v2_user_day_claims SET state='CONFIRMED',receipt_no=?,reserve_id=?,updated_at=?
    WHERE user_hash=? AND business_date=? AND request_id=?`)
    .bind(receiptNo, reserveId, Date.now(), hash, serverDate, requestId).run();
  await setRequestState(env, requestId, 'CONFIRMED');
  return result;
}

function validateLocation(p) {
  const lat = Number(p.latitude), lng = Number(p.longitude), accuracy = Number(p.accuracy), ts = Number(p.locationTimestamp);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(accuracy) || !Number.isFinite(ts)) throw apiError('LOCATION_REQUIRED', 400);
  const age = Date.now() - ts;
  if (age < -30_000 || age > CFG.GEOFENCE.maxAgeMs) throw apiError('LOCATION_STALE', 400);
  if (accuracy < 0 || accuracy > CFG.GEOFENCE.maxAccuracyM) throw apiError('LOCATION_ACCURACY_TOO_LOW', 400);
  const distance = distanceM(CFG.FACILITY.lat, CFG.FACILITY.lng, lat, lng);
  if (distance > CFG.GEOFENCE.radiusM) throw apiError('OUTSIDE_ONSITE_GEOFENCE', 403);
}

async function incrementAttempt(env, hash, date) {
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO v2_user_attempts(user_hash,business_date,attempt_count,updated_at) VALUES(?,?,1,?)
    ON CONFLICT(user_hash,business_date) DO UPDATE SET attempt_count=attempt_count+1,updated_at=excluded.updated_at`)
    .bind(hash, date, now).run();
  const row = await env.DB.prepare('SELECT attempt_count FROM v2_user_attempts WHERE user_hash=? AND business_date=?')
    .bind(hash, date).first();
  if (Number(row?.attempt_count || 0) > CFG.USER_ATTEMPT_LIMIT) throw apiError('DAILY_ATTEMPT_LIMIT_REACHED', 429);
}

async function claimUserDay(env, hash, date, requestId, waitTypeId) {
  const now = Date.now();
  const r = await env.DB.prepare(`INSERT OR IGNORE INTO v2_user_day_claims
    (user_hash,business_date,request_id,state,receipt_no,reserve_id,wait_type_id,created_at,updated_at)
    VALUES(?,?,?,'CREATE_INFLIGHT','','',?,?,?)`)
    .bind(hash, date, requestId, waitTypeId, now, now).run();
  if (Number(r?.meta?.changes || 0) === 1) return { existing: false };
  const row = await env.DB.prepare(`SELECT request_id,state,receipt_no,reserve_id,wait_type_id FROM v2_user_day_claims
    WHERE user_hash=? AND business_date=? LIMIT 1`).bind(hash, date).first();
  if (!row) throw apiError('USER_DAY_CLAIM_FAILED', 409);
  const state = String(row.state || '');
  if (state === 'CONFIRMED' && row.receipt_no && row.reserve_id) {
    return { existing: true, result: {
      ok: true, stored: true, alreadyExists: true, version: CFG.VERSION,
      businessDate: date, operationalDate: date,
      receiptNo: String(row.receipt_no), reserveId: String(row.reserve_id),
      waitTypeId: String(row.wait_type_id || ''), shortUrl: '',
    }};
  }
  const e = apiError(state === 'AMBIGUOUS' ? 'EXISTING_AMBIGUOUS_RECEPTION_REQUIRES_MANUAL_REVIEW' : 'ACTIVE_RECEPTION_ALREADY_IN_PROGRESS', 409, state === 'AMBIGUOUS');
  throw e;
}

async function markUserClaim(env, hash, date, state) {
  await env.DB.prepare('UPDATE v2_user_day_claims SET state=?,updated_at=? WHERE user_hash=? AND business_date=?')
    .bind(state, Date.now(), hash, date).run();
}

async function releaseUserClaim(env, hash, date, requestId) {
  await env.DB.prepare(`DELETE FROM v2_user_day_claims WHERE user_hash=? AND business_date=? AND request_id=? AND state='CREATE_INFLIGHT'`)
    .bind(hash, date, requestId).run();
}

async function claimRequest(env, requestId, action) {
  const now = Date.now();
  const r = await env.DB.prepare(`INSERT OR IGNORE INTO v2_request_results
    (request_id,action,state,result_json,ambiguous,created_at,updated_at,expires_at)
    VALUES(?,?,'RECEIVED','',0,?,?,?)`)
    .bind(requestId, action, now, now, now + CFG.REQUEST_PENDING_TTL_MS).run();
  if (Number(r?.meta?.changes || 0) === 1) return { owner: true, cached: false };
  const row = await env.DB.prepare('SELECT state,result_json,expires_at FROM v2_request_results WHERE request_id=? LIMIT 1').bind(requestId).first();
  if (!row) return { owner: false, cached: false };
  const state = String(row.state || '');
  if (['CONFIRMED','REJECTED','AMBIGUOUS'].includes(state) && row.result_json) {
    try { return { owner: false, cached: true, result: JSON.parse(String(row.result_json)) }; } catch {}
  }
  if (Number(row.expires_at || 0) < now) {
    return { owner: false, cached: true, result: {
      ok: false, stored: false, ambiguous: true,
      error: 'STALE_REQUEST_REQUIRES_MANUAL_REVIEW', version: CFG.VERSION,
    }};
  }
  return { owner: false, cached: false };
}

async function setRequestState(env, requestId, state) {
  await env.DB.prepare('UPDATE v2_request_results SET state=?,updated_at=? WHERE request_id=?')
    .bind(state, Date.now(), requestId).run();
}

async function finalizeRequest(env, requestId, action, result) {
  const now = Date.now();
  const state = result?.ok ? 'CONFIRMED' : result?.ambiguous ? 'AMBIGUOUS' : 'REJECTED';
  await env.DB.prepare(`UPDATE v2_request_results SET action=?,state=?,result_json=?,ambiguous=?,updated_at=?,expires_at=? WHERE request_id=?`)
    .bind(action, state, JSON.stringify(result || {}), result?.ambiguous ? 1 : 0, now, now + CFG.REQUEST_RESULT_TTL_MS, requestId).run();
  await env.DB.prepare('DELETE FROM v2_request_results WHERE expires_at < ?').bind(now).run();
}

async function requestStatus(env, requestId) {
  const id = normalizeRequestId(requestId);
  if (!id) return { ok: false, found: false, error: 'REQUEST_ID_REQUIRED', version: CFG.VERSION };
  const row = await env.DB.prepare('SELECT state,result_json,expires_at FROM v2_request_results WHERE request_id=? LIMIT 1').bind(id).first();
  if (!row || Number(row.expires_at || 0) < Date.now()) return { ok: true, found: false, version: CFG.VERSION };
  const state = String(row.state || '');
  if (!['CONFIRMED','REJECTED','AMBIGUOUS'].includes(state)) return { ok: true, found: false, pending: true, state, version: CFG.VERSION };
  try { return { found: true, ...JSON.parse(String(row.result_json || '{}')) }; }
  catch { return { ok: false, found: false, error: 'REQUEST_RESULT_INVALID', version: CFG.VERSION }; }
}

function airwaitResultError(code) {
  const c = String(code || 'NONE');
  const known = {
    '3527': 'AIRWAIT_NO_TICKETS_TODAY',
    '3528': 'AIRWAIT_RECEPTION_UNAVAILABLE',
    '3532': 'AIRWAIT_PEOPLE_OVER_LIMIT',
    '3537': 'AIRWAIT_RECEPTION_ENDED',
    '3539': 'AIRWAIT_UNAUTHORIZED_OPERATION',
    '3557': 'AIRWAIT_OUTSIDE_RECEPTION_TIME',
    '3558': 'AIRWAIT_WAIT_TYPE_OUTSIDE_TIME',
    '3593': 'AIRWAIT_BELOW_MIN_PEOPLE',
  };
  return apiError(known[c] || `AIRWAIT_CREATE_ERROR_RC_${c}`, 400, false, c);
}

function normalizeWaitType(v) { const s = String(v || '').trim(); return /^\d{4}$/.test(s) ? s : ''; }
function normalizeReceipt(v) { const m = String(v ?? '').normalize('NFKC').trim().toUpperCase().match(/^[FT]?(\d{1,12})$/); return m ? m[1].replace(/^0+(?=\d)/,'') : ''; }
function normalizeReserveId(v) { const s = String(v ?? '').normalize('NFKC').trim(); return /^\d{1,12}$/.test(s) ? s.padStart(12,'0') : ''; }
function normalizeRequestId(v) { const s = String(v || '').trim(); return /^[A-Za-z0-9_-]{8,120}$/.test(s) ? s : ''; }
function normalizeDate(v) { const s=String(v||'').trim().replace(/\//g,'-'),m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return'';const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(Date.UTC(y,mo-1,d,12));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d)return'';return`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function intInRange(v,min,max){const n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:min-1;}
function distanceM(a,b,c,d){const R=6371000,rad=x=>x*Math.PI/180,x=rad(c-a),y=rad(d-b),q=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));}
async function sha256Hex(text){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text||'')));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function safeJson(response,label){const text=await response.text();try{return JSON.parse(text)}catch{throw apiError(`${label}_INVALID_JSON`,502,response.status>=500)}}
function apiError(message,status=500,ambiguous=false,code=''){const e=new Error(String(message||'UNKNOWN_ERROR'));e.status=status;e.ambiguous=Boolean(ambiguous);e.code=String(code||'');return e;}
function safeError(e){return String(e?.message||e||'UNKNOWN_ERROR').replace(/[\r\n\t]+/g,' ').slice(0,500);}
