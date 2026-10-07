/**
 * ASOBooN MINI App v2 - Official Production Gateway (dark launch)
 * Environment: official Production only (Channel ID 2009884613)
 *
 * Secrets (Cloudflare Worker Secrets):
 *   AIRWAIT_API_KEY
 *
 * Vars:
 *   CREATE_ENABLED = "0" | "1"   (default: 0)
 *
 * Binding:
 *   DB -> dedicated D1 database for official Production
 *
 * NEVER put AirWAIT API keys, LINE secrets, LIFF access tokens, or notification
 * tokens in GitHub/browser code.
 */

const CFG = Object.freeze({
  VERSION: '1.1.prod-security1',
  ENVIRONMENT: 'official-production',
  CHANNEL_ID: '2009884613',
  ALLOWED_ORIGIN: 'https://asoboon.github.io',
  STORE_ID: 'KR01205179',
  STORE_NO: 'AKR2298124918',
  TZ: 'Asia/Tokyo',
  OPERATIONAL_CUTOFF_HOUR: 19,
  // Internal mode='web' is the LINE MINI App path. It intentionally uses
  // AirWAIT STORE_RECEPTION_ONLY waitTypes and opens with onsite reception.
  WEB_OPEN_MIN: 9 * 60 + 25,
  ONSITE_OPEN_MIN: 9 * 60 + 25,
  PRODUCTION_CREATE_ARMED: false,
  REQUEST_PENDING_TTL_MS: 10 * 60 * 1000,
  REQUEST_RESULT_TTL_MS: 24 * 60 * 60 * 1000,
  WAIT_TYPES_CACHE_MS: 10 * 60 * 1000,
  OFFICIAL_WEB_HANDOFF_TTL_MS: 15 * 60 * 1000,
  USER_ATTEMPT_LIMIT: 5,
  RATE_WINDOW_MS: 10 * 60 * 1000,
  RATE_LIMITS: Object.freeze({
    create: Object.freeze({ user: 4, ip: 20 }),
    requestStatus: Object.freeze({ user: 120, ip: 300 }),
    waitTypes: Object.freeze({ ip: 60 }),
    businessDay: Object.freeze({ ip: 60 }),
    cancelReservation: Object.freeze({ user: 10, ip: 30 }),
    reservationStatus: Object.freeze({ user: 180, ip: 360 }),
    crowd: Object.freeze({ ip: 120 }),
  }),
  AIR_WAIT_TYPES: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/wait/type/get',
  AIR_CREATE: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',
  AIR_RESERVATIONS: 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  LINE_VERIFY: 'https://api.line.me/oauth2/v2.1/verify',
  LINE_PROFILE: 'https://api.line.me/v2/profile',
  BUSINESS_CALENDAR_API: 'https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec',
});

const SLOT_RULES = Object.freeze({
  onsite: Object.freeze({
    '平日': Object.freeze(['0023', '0025']),
    '平日特定日': Object.freeze(['0035', '0037']),
    '土日祝日': Object.freeze(['0029', '0031', '0033']),
    '休館': Object.freeze([]),
  }),
  web: Object.freeze({
    '平日': Object.freeze(['0023', '0025']),
    '平日特定日': Object.freeze(['0035', '0037']),
    '土日祝日': Object.freeze(['0029', '0031', '0033']),
    '休館': Object.freeze([]),
  }),
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
      await ensureRequestOwnerColumn(env);

      const url = new URL(request.url);
      if (request.method === 'GET') {
        const action = String(url.searchParams.get('action') || 'health');
        if (action === 'health') return out(request, await health(env));
        if (action === 'waitTypes') {
          await enforceRequestRateLimit(env, request, 'waitTypes');
          return out(request, await getWaitTypes(env));
        }
        // Results are only returned to the verified owner through POST requestStatus.
        if (action === 'requestStatus') return out(request, { ok: false, found: false, error: 'REQUEST_STATUS_REQUIRES_LINE_IDENTITY', version: CFG.VERSION }, 401);
        return out(request, { ok: false, error: 'UNKNOWN_ACTION', version: CFG.VERSION }, 404);
      }

      if (request.method !== 'POST') return out(request, { ok: false, error: 'METHOD_NOT_ALLOWED', version: CFG.VERSION }, 405);
      const p = await readBody(request);
      const action = String(p.action || '');
      if (action !== 'createReservation') {
        if (action === 'requestStatus') return out(request, await requestStatusForUser(env, p, request));
        return out(request, { ok: false, error: 'UNKNOWN_ACTION', version: CFG.VERSION }, 400);
      }

      const requestId = normalizeRequestId(p.requestId);
      if (!requestId) return out(request, { ok: false, error: 'REQUEST_ID_REQUIRED', version: CFG.VERSION }, 400);

      // The idempotency key belongs to the LINE user who created it. Identity is
      // verified before the request record is read, so a leaked requestId alone
      // never reveals or re-binds someone else's reservation.
      const line = await verifyLineUser(p.liffAccessToken);
      const ownerHash = await userHash(line.userId);
      const claim = await claimRequest(env, requestId, action, ownerHash);
      if (claim.forbidden) return out(request, { ok: false, stored: false, error: 'REQUEST_OWNER_MISMATCH', version: CFG.VERSION }, 403);
      if (claim.cached) return out(request, publicResult(claim.result), 200);
      if (!claim.owner) return out(request, { ok: true, pending: true, requestId, version: CFG.VERSION }, 202);

      let result;
      try {
        await enforceRequestRateLimit(env, request, 'create', ownerHash);
        result = await createReservation(env, p, requestId, line);
      } catch (e) {
        if (action === 'createReservation') await recordCreateDiagnostic(env, p, e);
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
      return out(request, publicResult(result), result.ok ? 200 : Number(result.ambiguous ? 409 : 400));
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
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_create_diagnostics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      business_date TEXT NOT NULL DEFAULT '',
      wait_type_id TEXT NOT NULL DEFAULT '',
      mode TEXT NOT NULL DEFAULT '',
      upstream_http INTEGER NOT NULL DEFAULT 0,
      result_code TEXT NOT NULL DEFAULT '',
      error_key TEXT NOT NULL DEFAULT '',
      airwait_message TEXT NOT NULL DEFAULT ''
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_v2_create_diagnostics_created
      ON v2_create_diagnostics(created_at)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_official_web_handoffs (
      request_id TEXT PRIMARY KEY,
      user_hash TEXT NOT NULL,
      business_date TEXT NOT NULL,
      wait_type_id TEXT NOT NULL,
      adults INTEGER NOT NULL DEFAULT 1,
      paid_children INTEGER NOT NULL DEFAULT 0,
      infants INTEGER NOT NULL DEFAULT 0,
      baseline_json TEXT NOT NULL DEFAULT '[]',
      state TEXT NOT NULL DEFAULT 'PENDING',
      receipt_no TEXT NOT NULL DEFAULT '',
      reserve_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_v2_official_web_handoffs_user
      ON v2_official_web_handoffs(user_hash,business_date,expires_at)`),
    env.DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_official_web_handoffs_receipt
      ON v2_official_web_handoffs(business_date,receipt_no) WHERE receipt_no<>''`),
  ]);
}

async function health(env) {
  return {
    ok: true,
    version: CFG.VERSION,
    environment: CFG.ENVIRONMENT,
    officialDevelopEnabled: false,
    officialProductionEnabled: true,
    productionCreateArmed: CFG.PRODUCTION_CREATE_ARMED,
    acceptedClientIds: [CFG.CHANNEL_ID],
    createRequiresVerifiedLiff: true,
    createEnabled: productionCreateEnabled(env),
    dbConfigured: Boolean(env.DB),
    airwaitKeyConfigured: Boolean(env.AIRWAIT_API_KEY),
    storeId: CFG.STORE_ID,
    createStoreNoFallbackEnabled: Boolean(CFG.STORE_NO),
    officialWebHandoffEnabled: false,
    allowedOrigin: CFG.ALLOWED_ORIGIN,
    browserHitsAirwait: false,
    operationalCutoffHour: CFG.OPERATIONAL_CUTOFF_HOUR,
    lineReceptionOpen: '09:25',
    lineReceptionUsesStoreOnly: true,
    rateLimitScopes: Object.keys(CFG.RATE_LIMITS),
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

function enforceReceptionHours(day, mode, epoch = Date.now()) {
  if (day.isClosed) throw apiError('CLOSED_DAY', 400);
  const min = currentMinute(epoch);
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

function usageMatchesMode(usage) {
  const u = String(usage || '');
  return u === '02' || u === 'KeySTORE_RECEPTION_ONLY';
}

function validateWaitType(waitTypes, day, mode, waitTypeId) {
  const allowed = SLOT_RULES[mode]?.[day.businessType] || [];
  if (!allowed.includes(waitTypeId)) throw apiError('WAIT_TYPE_NOT_ALLOWED_FOR_DAY', 400);
  const w = waitTypes.find(x => x.waitTypeId === waitTypeId);
  if (!w || w.dispFlg === false) throw apiError('WAIT_TYPE_NOT_AVAILABLE', 400);
  if (!usageMatchesMode(w.usageDispType, mode)) throw apiError('WAIT_TYPE_MODE_MISMATCH', 400);
  return w;
}

async function createReservation(env, p, requestId, verifiedLine = null) {
  if (!productionCreateEnabled(env)) throw apiError('CREATE_DISABLED', 503);
  if (!env.AIRWAIT_API_KEY) throw apiError('AIRWAIT_KEY_NOT_CONFIGURED', 503);

  // Production LINE reception is always the store-reception path.
  // Client-supplied mode/location fields are untrusted and intentionally ignored.
  const mode = 'web';
  const adults = strictIntField(p.adults, 'adults', 1, 10);
  const paidChildren = strictIntField(p.paidChildren, 'paidChildren', 0, 10);
  const infants = strictIntField(p.infants, 'infants', 0, 10);
  validatePartySize(adults, paidChildren, infants);
  const waitTypeId = normalizeWaitType(p.waitTypeId);
  if (!waitTypeId) throw apiError('WAIT_TYPE_REQUIRED', 400);

  const requestedDate = normalizeDate(p.operationalDate);
  const serverDate = operationalDate();
  if (!requestedDate || requestedDate !== serverDate) throw apiError('OPERATIONAL_DATE_MISMATCH', 400);

  const line = verifiedLine || await verifyLineUser(p.liffAccessToken);
  const hash = await userHash(line.userId);

  const day = await getBusinessDay(serverDate);
  enforceReceptionHours(day, mode);

  const wt = await getWaitTypes(env, { force: true });
  const waitType = validateWaitType(wt.waitTypes, day, mode, waitTypeId);

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
    await markUserClaim(env, hash, serverDate, 'AMBIGUOUS');
    throw apiError('AIRWAIT_CREATE_RESPONSE_AMBIGUOUS_MANUAL_REVIEW', 502, true);
  }

  let resultCode = String(d?.resultCode?.code || '');
  let usedStoreNoFallback = false;

  // Some AirWAIT stores are readable by storeId but reserve/create returns 3201
  // for that identifier. 3201 is a definitive rejection (no reservation was
  // created), so it is safe to retry exactly once with the documented storeNo.
  if (d?.success === false && resultCode === '3201' && CFG.STORE_NO) {
    let retryRes;
    try {
      retryRes = await fetch(CFG.AIR_CREATE, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          corWclpKeyCd: env.AIRWAIT_API_KEY,
        },
        body: new URLSearchParams({
          storeNo: CFG.STORE_NO,
          numPerson: String(adults),
          numPersonChild: String(paidChildren + infants),
          waitTypeId,
          langType: 'KeyJPN',
          autoPrintFlg: 'false',
        }),
      });
    } catch {
      await markUserClaim(env, hash, serverDate, 'AMBIGUOUS');
      const e=apiError('AIRWAIT_CREATE_STORENO_NETWORK_AMBIGUOUS_MANUAL_REVIEW',502,true);
      e.airwaitIdentifier='storeNo';
      throw e;
    }

    const retryText = await retryRes.text();
    let retryData;
    try { retryData = JSON.parse(retryText); }
    catch {
      await markUserClaim(env, hash, serverDate, 'AMBIGUOUS');
      const e=apiError('AIRWAIT_CREATE_STORENO_RESPONSE_AMBIGUOUS_MANUAL_REVIEW',502,true);
      e.airwaitHttp=Number(retryRes.status||0);
      e.airwaitIdentifier='storeNo';
      throw e;
    }

    res = retryRes;
    d = retryData;
    resultCode = String(d?.resultCode?.code || '');
    usedStoreNoFallback = true;
  }

  const createOutcome = classifyAirwaitCreateResult(res.ok, res.status, d);
  if (createOutcome.kind === 'REJECTED') {
    await releaseUserClaim(env, hash, serverDate, requestId);
    throw airwaitResultError(resultCode, { httpStatus:res.status, message:airwaitResultMessage(d) });
  }
  if (createOutcome.kind !== 'SUCCESS') {
    await markUserClaim(env, hash, serverDate, 'AMBIGUOUS');
    const e=apiError('AIRWAIT_CREATE_RESULT_AMBIGUOUS_MANUAL_REVIEW', 502, true, resultCode);
    e.airwaitHttp=Number(res.status||0);
    e.airwaitMessage=airwaitResultMessage(d);
    throw e;
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
    createIdentifier: usedStoreNoFallback ? 'storeNo-fallback' : 'storeId',
  };

  await env.DB.prepare(`UPDATE v2_user_day_claims SET state='CONFIRMED',receipt_no=?,reserve_id=?,updated_at=?
    WHERE user_hash=? AND business_date=? AND request_id=?`)
    .bind(receiptNo, reserveId, Date.now(), hash, serverDate, requestId).run();
  await setRequestState(env, requestId, 'CONFIRMED');
  return result;
}

function isOnlineOnlyWaitType(usage) {
  const u=String(usage||'');
  return u==='03'||u==='KeyONLINE_RECEPTION_ONLY';
}

async function fetchOfficialReservations(env, waitTypeId) {
  if (!env?.AIRWAIT_API_KEY) throw apiError('AIRWAIT_KEY_NOT_CONFIGURED',503);
  const rows=[];
  let start=1,total=Infinity,page=0;
  while(rows.length<total&&start<=99999&&page<1000){
    const r=await fetch(CFG.AIR_RESERVATIONS,{
      method:'POST',
      headers:{
        Accept:'application/json',
        'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
        corWclpKeyCd:env.AIRWAIT_API_KEY,
      },
      body:new URLSearchParams({
        storeId:CFG.STORE_ID,
        waitTypeId:String(waitTypeId||''),
        sortStatus:'0',
        isDesc:'0',
        start:String(start),
        limit:'100',
      }),
      cache:'no-store',
    });
    const d=await safeJson(r,'AIRWAIT_OFFICIAL_RESERVATIONS');
    if(!r.ok||d?.success!==true||String(d?.resultCode?.code||'')!=='0000') throw apiError('AIRWAIT_OFFICIAL_RESERVATIONS_FAILED',502);
    const part=Array.isArray(d?.innerDto?.reservations)?d.innerDto.reservations:[];
    rows.push(...part.map(x=>({
      number:String(x?.number||''),
      waitTypeId:String(x?.waitTypeId||''),
      status:String(x?.status||''),
      isCalling:String(x?.isCalling||'0'),
    })));
    total=Number(d?.innerDto?.count||part.length||0);
    if(!part.length||rows.length>=total)break;
    start+=part.length;
    page+=1;
  }
  if(rows.length<total)throw apiError('AIRWAIT_OFFICIAL_RESERVATIONS_TRUNCATED',502);
  return rows;
}

async function syntheticAdoptReserveId(businessDate,waitTypeId,receiptNo){
  const hex=await sha256Hex(`official-web:${businessDate}:${waitTypeId}:${receiptNo}`);
  const n=BigInt('0x'+hex.slice(0,14))%1000000000000n;
  return n.toString().padStart(12,'0');
}

async function adoptOfficialWebReception(env,p,requestId){
  const handoffRequestId=normalizeRequestId(p?.handoffRequestId);
  const requestedDate=normalizeDate(p?.operationalDate);
  const waitTypeId=normalizeWaitType(p?.waitTypeId);
  const receiptNo=normalizeReceipt(p?.receiptNo);
  if(!handoffRequestId||!requestedDate||!waitTypeId||!receiptNo) throw apiError('OFFICIAL_WEB_ADOPTION_INPUT_INVALID',400);

  const serverDate=operationalDate();
  if(requestedDate!==serverDate) throw apiError('OPERATIONAL_DATE_MISMATCH',400);
  const line=await verifyLineUser(p?.liffAccessToken);
  const hash=await userHash(line.userId);

  const handoff=await env.DB.prepare(`SELECT request_id,user_hash,business_date,wait_type_id,baseline_json,state,expires_at
    FROM v2_official_web_handoffs WHERE request_id=? LIMIT 1`).bind(handoffRequestId).first();
  if(!handoff) throw apiError('OFFICIAL_WEB_HANDOFF_NOT_FOUND',404);
  if(String(handoff.user_hash||'')!==hash) throw apiError('OFFICIAL_WEB_HANDOFF_OWNER_MISMATCH',403);
  if(String(handoff.business_date||'')!==serverDate||String(handoff.wait_type_id||'')!==waitTypeId) throw apiError('OFFICIAL_WEB_HANDOFF_MISMATCH',409);
  if(Number(handoff.expires_at||0)<Date.now()) throw apiError('OFFICIAL_WEB_HANDOFF_EXPIRED',409);
  if(String(handoff.state||'')==='CONFIRMED'){
    const row=await env.DB.prepare(`SELECT business_date,receipt_no,reserve_id,wait_type_id FROM v2_user_day_claims
      WHERE user_hash=? AND business_date=? AND state='CONFIRMED' LIMIT 1`).bind(hash,serverDate).first();
    if(row?.receipt_no&&row?.reserve_id)return{
      ok:true,stored:true,adopted:true,alreadyExists:true,version:CFG.VERSION,
      businessDate:serverDate,operationalDate:serverDate,
      receiptNo:String(row.receipt_no),reserveId:String(row.reserve_id),waitTypeId:String(row.wait_type_id||waitTypeId),shortUrl:'',
    };
  }

  let baseline=[];
  try{baseline=JSON.parse(String(handoff.baseline_json||'[]'))}catch{}
  if(Array.isArray(baseline)&&baseline.includes(receiptNo)) throw apiError('OFFICIAL_RECEIPT_NOT_NEW',409);

  const rows=await fetchOfficialReservations(env,waitTypeId);
  const matches=rows.filter(row=>normalizeReceipt(row?.number)===receiptNo);
  if(matches.length!==1) throw apiError(matches.length>1?'OFFICIAL_RECEIPT_AMBIGUOUS':'OFFICIAL_RECEIPT_NOT_FOUND',409);
  const own=matches[0];
  if(String(own.waitTypeId||'')!==waitTypeId) throw apiError('OFFICIAL_RECEIPT_WAIT_TYPE_MISMATCH',409);
  if(['2','3'].includes(String(own.status||''))) throw apiError('OFFICIAL_RECEIPT_TERMINAL',409);

  const reserveId=await syntheticAdoptReserveId(serverDate,waitTypeId,receiptNo);
  const now=Date.now();
  try{
    const changed=await env.DB.prepare(`UPDATE v2_official_web_handoffs
      SET state='CONFIRMED',receipt_no=?,reserve_id=?,updated_at=?
      WHERE request_id=? AND user_hash=? AND business_date=? AND state='PENDING'`)
      .bind(receiptNo,reserveId,now,handoffRequestId,hash,serverDate).run();
    if(Number(changed?.meta?.changes||0)!==1) throw apiError('OFFICIAL_WEB_HANDOFF_STATE_CHANGED',409);
  }catch(e){
    if(/UNIQUE|constraint/i.test(String(e?.message||e||''))) throw apiError('OFFICIAL_RECEIPT_ALREADY_LINKED',409);
    throw e;
  }

  const claim=await env.DB.prepare(`UPDATE v2_user_day_claims
    SET state='CONFIRMED',receipt_no=?,reserve_id=?,wait_type_id=?,updated_at=?
    WHERE user_hash=? AND business_date=? AND request_id=? AND state='OFFICIAL_WEB_PENDING'`)
    .bind(receiptNo,reserveId,waitTypeId,now,hash,serverDate,handoffRequestId).run();
  if(Number(claim?.meta?.changes||0)!==1){
    await env.DB.prepare(`UPDATE v2_official_web_handoffs SET state='PENDING',receipt_no='',reserve_id='',updated_at=? WHERE request_id=?`)
      .bind(Date.now(),handoffRequestId).run();
    throw apiError('OFFICIAL_WEB_CLAIM_NOT_PENDING',409);
  }

  return{
    ok:true,stored:true,adopted:true,ambiguous:false,version:CFG.VERSION,
    businessDate:serverDate,operationalDate:serverDate,reserveId,receiptNo,waitTypeId,shortUrl:'',
    createIdentifier:'official-web-adoption',
  };
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
  const row = await env.DB.prepare(`SELECT request_id,state,receipt_no,reserve_id,wait_type_id,updated_at FROM v2_user_day_claims
    WHERE user_hash=? AND business_date=? LIMIT 1`).bind(hash, date).first();
  if (!row) throw apiError('USER_DAY_CLAIM_FAILED', 409);
  const state = String(row.state || '');
  if(state==='OFFICIAL_WEB_PENDING'){
    const h=await env.DB.prepare('SELECT expires_at FROM v2_official_web_handoffs WHERE request_id=? LIMIT 1').bind(String(row.request_id||'')).first();
    if(!h||Number(h.expires_at||0)<now){
      await env.DB.batch([
        env.DB.prepare(`DELETE FROM v2_user_day_claims WHERE user_hash=? AND business_date=? AND request_id=? AND state='OFFICIAL_WEB_PENDING'`).bind(hash,date,String(row.request_id||'')),
        env.DB.prepare('DELETE FROM v2_official_web_handoffs WHERE request_id=?').bind(String(row.request_id||'')),
      ]);
      return await claimUserDay(env,hash,date,requestId,waitTypeId);
    }
    throw apiError('OFFICIAL_WEB_HANDOFF_ALREADY_PENDING',409);
  }
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

async function claimRequest(env, requestId, action, ownerHash = '') {
  const now = Date.now();
  const r = await env.DB.prepare(`INSERT OR IGNORE INTO v2_request_results
    (request_id,action,state,result_json,ambiguous,created_at,updated_at,expires_at,user_hash)
    VALUES(?,?,'RECEIVED','',0,?,?,?,?)`)
    .bind(requestId, action, now, now, now + CFG.REQUEST_PENDING_TTL_MS, String(ownerHash || '')).run();
  if (Number(r?.meta?.changes || 0) === 1) return { owner: true, cached: false };
  const row = await env.DB.prepare('SELECT state,result_json,expires_at,user_hash FROM v2_request_results WHERE request_id=? LIMIT 1').bind(requestId).first();
  if (!row) return { owner: false, cached: false };
  if (!(await requestOwnedBy(env, requestId, row, ownerHash))) return { owner: false, cached: false, forbidden: true };
  const state = String(row.state || '');
  if (['CONFIRMED','REJECTED','AMBIGUOUS','HANDOFF_PENDING'].includes(state) && row.result_json) {
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
  const state = result?.handoffRequired ? 'HANDOFF_PENDING' : result?.ok ? 'CONFIRMED' : result?.ambiguous ? 'AMBIGUOUS' : 'REJECTED';
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
  if (!['CONFIRMED','REJECTED','AMBIGUOUS','HANDOFF_PENDING'].includes(state)) return { ok: true, found: false, pending: true, state, version: CFG.VERSION };
  try { return { found: true, ...JSON.parse(String(row.result_json || '{}')) }; }
  catch { return { ok: false, found: false, error: 'REQUEST_RESULT_INVALID', version: CFG.VERSION }; }
}

/* ---------------------------------------------------------------------- */
/* Identity / ownership helpers (security audit 2026-10-01)               */
/* ---------------------------------------------------------------------- */

// shortUrl carries the AirWAIT cancel capability. It stays in D1 / Worker only.
function publicResult(result) {
  if (!result || typeof result !== 'object') return result;
  const { shortUrl, ...rest } = result;
  return rest;
}

let requestOwnerColumnReady = false;
async function ensureRequestOwnerColumn(env) {
  if (requestOwnerColumnReady) return;
  const cols = await env.DB.prepare('PRAGMA table_info(v2_request_results)').all();
  const names = new Set((Array.isArray(cols?.results) ? cols.results : []).map(c => String(c.name || '')));
  if (!names.has('user_hash')) {
    try { await env.DB.prepare("ALTER TABLE v2_request_results ADD COLUMN user_hash TEXT NOT NULL DEFAULT ''").run(); }
    catch (e) { if (!/duplicate column/i.test(String(e?.message || e))) throw e; }
  }
  requestOwnerColumnReady = true;
}

// Owner of a requestId: recorded user_hash, or (rows created before this
// column existed) the LINE user of the day claim created with that requestId.
async function requestOwnedBy(env, requestId, row, ownerHash) {
  const hash = String(ownerHash || '');
  if (!hash) return false;
  const recorded = String(row?.user_hash || '');
  if (recorded) return recorded === hash;
  const claim = await env.DB.prepare('SELECT user_hash FROM v2_user_day_claims WHERE request_id=? LIMIT 1').bind(requestId).first();
  if (claim?.user_hash) return String(claim.user_hash) === hash;
  // Legacy record without any owner: only a non-successful result may be shown.
  let parsed = null;
  try { parsed = row?.result_json ? JSON.parse(String(row.result_json)) : null; } catch {}
  return parsed?.ok !== true;
}

async function requestStatusForUser(env, p, request) {
  const id = normalizeRequestId(p?.requestId);
  if (!id) return { ok: false, found: false, error: 'REQUEST_ID_REQUIRED', version: CFG.VERSION };
  const line = await verifyLineUser(p?.liffAccessToken);
  const hash = await userHash(line.userId);
  await enforceRequestRateLimit(env, request, 'requestStatus', hash);
  const row = await env.DB.prepare('SELECT state,result_json,expires_at,user_hash FROM v2_request_results WHERE request_id=? LIMIT 1').bind(id).first();
  if (!row) return { ok: true, found: false, version: CFG.VERSION };
  if (!(await requestOwnedBy(env, id, row, hash))) return { ok: true, found: false, version: CFG.VERSION };
  return publicResult(await requestStatus(env, id));
}

// Fixed-window limiter in D1. Production scopes are separated by action and
// enforced against LINE-user identity and/or Cloudflare's connection IP.
async function enforceRateLimit(env, scope, hash, limit, windowMs) {
  if (!env?.DB || !hash) return;
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `${scope}:${hash}:${windowStart}`;
  await env.DB.prepare(`INSERT INTO v2_rate_limits(key,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=count+1`).bind(key, windowStart + windowMs).run();
  const row = await env.DB.prepare('SELECT count FROM v2_rate_limits WHERE key=? LIMIT 1').bind(key).first();
  if (Math.random() < 0.02) await env.DB.prepare('DELETE FROM v2_rate_limits WHERE expires_at<?').bind(now).run();
  if (Number(row?.count || 0) > limit) throw apiError('RATE_LIMITED', 429);
}

async function requestIpHash(request) {
  const ip=String(request?.headers?.get?.('CF-Connecting-IP')||'').trim() || 'missing';
  return sha256Hex(`ip:${ip}`);
}

async function enforceRequestRateLimit(env, request, scope, userHash='') {
  const policy=CFG.RATE_LIMITS[scope]||{};
  if(policy.user&&userHash) await enforceRateLimit(env,`${scope}:user`,userHash,Number(policy.user),CFG.RATE_WINDOW_MS);
  if(policy.ip){
    const ipHash=await requestIpHash(request);
    await enforceRateLimit(env,`${scope}:ip`,ipHash,Number(policy.ip),CFG.RATE_WINDOW_MS);
  }
}

const DEFINITIVE_CREATE_REJECTION_CODES = new Set([
  '1000','3201','3527','3528','3532','3537','3539','3556','3557','3558','3593'
]);

function isDefinitiveCreateRejection(d, code) {
  return d?.success === false && DEFINITIVE_CREATE_REJECTION_CODES.has(String(code||''));
}

function classifyAirwaitCreateResult(responseOk, httpStatus, d) {
  const code=String(d?.resultCode?.code||'');
  if(responseOk===true && d?.success===true && code==='0000') return {kind:'SUCCESS',code,httpStatus:Number(httpStatus||0)};
  if(isDefinitiveCreateRejection(d,code)) return {kind:'REJECTED',code,httpStatus:Number(httpStatus||0)};
  return {kind:'AMBIGUOUS',code,httpStatus:Number(httpStatus||0)};
}

function productionCreateEnabled(env) {
  return CFG.PRODUCTION_CREATE_ARMED === true && String(env?.CREATE_ENABLED||'0') === '1';
}

function airwaitResultError(code, meta={}) {
  const c = String(code || 'NONE');
  const known = {
    '1000': 'AIRWAIT_INPUT_ERROR',
    '3201': 'AIRWAIT_UNREGISTERED_DATA',
    '3527': 'AIRWAIT_NO_TICKETS_TODAY',
    '3528': 'AIRWAIT_RECEPTION_UNAVAILABLE',
    '3532': 'AIRWAIT_PEOPLE_OVER_LIMIT',
    '3537': 'AIRWAIT_RECEPTION_ENDED',
    '3539': 'AIRWAIT_UNAUTHORIZED_OPERATION',
    '3556': 'AIRWAIT_WAIT_TYPE_UNUSED',
    '3557': 'AIRWAIT_OUTSIDE_RECEPTION_TIME',
    '3558': 'AIRWAIT_WAIT_TYPE_OUTSIDE_TIME',
    '3593': 'AIRWAIT_BELOW_MIN_PEOPLE',
  };
  const e=apiError(known[c] || `AIRWAIT_CREATE_ERROR_RC_${c}`, 400, false, c);
  e.airwaitHttp=Number(meta?.httpStatus||0);
  e.airwaitMessage=String(meta?.message||'').replace(/[\r\n\t]+/g,' ').slice(0,300);
  return e;
}

function airwaitResultMessage(d){
  const candidates=[
    d?.resultCode?.defaultMessage,
    d?.resultCode?.message,
    d?.defaultMessage,
    d?.message,
    Array.isArray(d?.messages)?d.messages.join(' '):'',
  ];
  return String(candidates.find(v=>String(v||'').trim())||'').replace(/[\r\n\t]+/g,' ').slice(0,300);
}

async function recordCreateDiagnostic(env,p,e){
  if(!env?.DB)return;
  try{
    const now=Date.now();
    const businessDate=normalizeDate(p?.operationalDate||'');
    const waitTypeId=normalizeWaitType(p?.waitTypeId||'');
    const mode='line-store';
    const resultCode=String(e?.code||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40);
    const errorKey=safeError(e).slice(0,120);
    const airwaitMessage=String(e?.airwaitMessage||'').replace(/[\r\n\t]+/g,' ').slice(0,300);
    await env.DB.prepare(`INSERT INTO v2_create_diagnostics
      (created_at,business_date,wait_type_id,mode,upstream_http,result_code,error_key,airwait_message)
      VALUES(?,?,?,?,?,?,?,?)`)
      .bind(now,businessDate,waitTypeId,mode,Number(e?.airwaitHttp||0),resultCode,errorKey,airwaitMessage).run();
    await env.DB.prepare('DELETE FROM v2_create_diagnostics WHERE created_at<?').bind(now-7*24*60*60*1000).run();
  }catch(diagError){
    console.warn('CREATE_DIAGNOSTIC_WRITE_FAILED',safeError(diagError));
  }
}

function normalizeWaitType(v) { const s = String(v || '').trim(); return /^\d{4}$/.test(s) ? s : ''; }
function normalizeReceipt(v) { const m = String(v ?? '').normalize('NFKC').trim().toUpperCase().match(/^[FT]?(\d{1,12})$/); return m ? m[1].replace(/^0+(?=\d)/,'') : ''; }
function normalizeReserveId(v) { const s = String(v ?? '').normalize('NFKC').trim(); return /^\d{1,12}$/.test(s) ? s.padStart(12,'0') : ''; }
function normalizeRequestId(v) { const s = String(v || '').trim(); return /^[A-Za-z0-9_-]{8,120}$/.test(s) ? s : ''; }
function normalizeDate(v) { const s=String(v||'').trim().replace(/\//g,'-'),m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return'';const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(Date.UTC(y,mo-1,d,12));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d)return'';return`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function strictIntField(v,label,min,max){
  let n;
  if(typeof v==='number'){
    if(!Number.isSafeInteger(v)) throw apiError('PEOPLE_VALIDATION_ERROR',400);
    n=v;
  }else if(typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v)){
    n=Number(v);
  }else{
    throw apiError('PEOPLE_VALIDATION_ERROR',400);
  }
  if(!Number.isSafeInteger(n)||n<min||n>max) throw apiError('PEOPLE_VALIDATION_ERROR',400);
  return n;
}
function validatePartySize(adults,paidChildren,infants){
  const total=adults+paidChildren+infants;
  if(adults<1||total<1||total>10||paidChildren+infants>adults*3) throw apiError('PEOPLE_VALIDATION_ERROR',400);
  return total;
}
async function sha256Hex(text){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text||'')));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function safeJson(response,label){const text=await response.text();try{return JSON.parse(text)}catch{throw apiError(`${label}_INVALID_JSON`,502,response.status>=500)}}
function apiError(message,status=500,ambiguous=false,code=''){const e=new Error(String(message||'UNKNOWN_ERROR'));e.status=status;e.ambiguous=Boolean(ambiguous);e.code=String(code||'');return e;}
function safeError(e){return String(e?.message||e||'UNKNOWN_ERROR').replace(/[\r\n\t]+/g,' ').slice(0,500);}

export const __securityTest = Object.freeze({
  productionCreateEnabled,
  strictIntField,
  validatePartySize,
  operationalDate,
  enforceReceptionHours,
  usageMatchesMode,
  validateWaitType,
  isDefinitiveCreateRejection,
  classifyAirwaitCreateResult,
  rateLimits: CFG.RATE_LIMITS,
  claimRequest,
  claimUserDay,
  markUserClaim,
  finalizeRequest,
  requestOwnedBy,
});
