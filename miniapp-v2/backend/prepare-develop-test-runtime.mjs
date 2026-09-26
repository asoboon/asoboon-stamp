import { readFileSync, writeFileSync } from 'node:fs';

const sourcePath = 'miniapp-v2/backend/develop-gateway.js';
const outputPath = 'develop-gateway.runtime.mjs';
let s = readFileSync(sourcePath, 'utf8');

function replaceOnce(oldText, newText) {
  const count = s.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`Expected exactly one runtime patch match, got ${count}: ${oldText.slice(0, 120)}`);
  }
  s = s.replace(oldText, newText);
}

replaceOnce("  VERSION: '1.0.dev1',", "  VERSION: '1.9.dev-businessday-cache-shape-fix',");
replaceOnce(
  "  ONSITE_OPEN_MIN: 9 * 60 + 30,",
  "  ONSITE_OPEN_MIN: 9 * 60 + 30,\n  DEVELOP_TEST_WAIT_TYPE_ID: '0042',\n  DEVELOP_TEST_AMBIGUOUS_RECYCLE_MS: 30 * 1000,\n  CALLSTATUS_SESSION_TTL_MS: 12 * 60 * 60 * 1000,\n  STALE_CREATE_INFLIGHT_MS: 2 * 60 * 1000,"
);
replaceOnce(
  "  AIR_CREATE: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',",
  "  AIR_CREATE: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',\n  AIR_RESERVATIONS: 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',"
);
replaceOnce(
  "    createEnabled: String(env.CREATE_ENABLED || '0') === '1',",
  "    createEnabled: String(env.CREATE_ENABLED || '0') === '1',\n    developTestWaitTypeId: CFG.DEVELOP_TEST_WAIT_TYPE_ID,\n    callstatusEnabled: true,"
);
replaceOnce(
  "      const p = await readBody(request);\n      const action = String(p.action || '');\n      if (action !== 'createReservation') return out(request, { ok: false, error: 'UNKNOWN_ACTION', version: CFG.VERSION }, 400);\n\n      const requestId = normalizeRequestId(p.requestId);",
  "      const p = await readBody(request);\n      const action = String(p.action || '');\n      if (action === 'recoverReservationSession') return out(request, await recoverReservationSession(env, p));\n      if (action === 'reservationStatus') return out(request, await reservationStatus(env, p));\n      if (action !== 'createReservation') return out(request, { ok: false, error: 'UNKNOWN_ACTION', version: CFG.VERSION }, 400);\n\n      const requestId = normalizeRequestId(p.requestId);"
);
replaceOnce(
  "    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_system_state (\n      key TEXT PRIMARY KEY,\n      value TEXT NOT NULL,\n      updated_at INTEGER NOT NULL\n    )`),",
  "    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_reservation_sessions (\n      token_hash TEXT PRIMARY KEY,\n      user_hash TEXT NOT NULL,\n      business_date TEXT NOT NULL,\n      reserve_id TEXT NOT NULL,\n      receipt_no TEXT NOT NULL,\n      wait_type_id TEXT NOT NULL,\n      created_at INTEGER NOT NULL,\n      expires_at INTEGER NOT NULL\n    )`),\n    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_v2_reservation_sessions_user\n      ON v2_reservation_sessions(user_hash,business_date,expires_at)`),\n    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_v2_reservation_sessions_expires\n      ON v2_reservation_sessions(expires_at)`),\n    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_system_state (\n      key TEXT PRIMARY KEY,\n      value TEXT NOT NULL,\n      updated_at INTEGER NOT NULL\n    )`),"
);
replaceOnce(
  "async function ensureSchema(env) {\n  await env.DB.batch([",
  "let gatewaySchemaReady = null;\nasync function ensureSchema(env) {\n  if (gatewaySchemaReady) return await gatewaySchemaReady;\n  gatewaySchemaReady = env.DB.batch(["
);
replaceOnce(
  "  ]);\n}\n\nasync function health(env) {",
  "  ]).catch(e => { gatewaySchemaReady = null; throw e; });\n  return await gatewaySchemaReady;\n}\n\nasync function health(env) {"
);

replaceOnce(
  "function enforceReceptionHours(day, mode) {\n  if (day.isClosed) throw apiError('CLOSED_DAY', 400);",
  "function enforceReceptionHours(day, mode, waitTypeId) {\n  if (waitTypeId === CFG.DEVELOP_TEST_WAIT_TYPE_ID) return;\n  if (day.isClosed) throw apiError('CLOSED_DAY', 400);"
);

replaceOnce(
  "  const hash = await userHash(line.userId);\n  await incrementAttempt(env, hash, serverDate);",
  "  const hash = await userHash(line.userId);"
);
replaceOnce(
  "  const day = await getBusinessDay(serverDate);",
  "  const day = await getBusinessDayCachedForCreate(env, serverDate);"
);
replaceOnce(
  "  const wt = await getWaitTypes(env, { force: true });",
  "  const wt = await getWaitTypesForCreate(env);"
);
replaceOnce(
  "  const userClaim = await claimUserDay(env, hash, serverDate, requestId, waitTypeId);\n  if (userClaim.existing) return userClaim.result;\n\n  await setRequestState(env, requestId, 'VALIDATED');",
  "  const userClaim = await claimUserDay(env, hash, serverDate, requestId, waitTypeId);\n  if (userClaim.existing) return userClaim.result;\n  if (waitTypeId !== CFG.DEVELOP_TEST_WAIT_TYPE_ID) {\n    try { await incrementAttempt(env, hash, serverDate); }\n    catch (e) { await releaseUserClaim(env, hash, serverDate, requestId); throw e; }\n  }\n\n  await setRequestState(env, requestId, 'VALIDATED');"
);
replaceOnce(
  "  enforceReceptionHours(day, mode);",
  "  enforceReceptionHours(day, mode, waitTypeId);"
);
replaceOnce(
  "  if (mode === 'onsite') validateLocation(p);",
  "  if (mode === 'onsite' && waitTypeId !== CFG.DEVELOP_TEST_WAIT_TYPE_ID) validateLocation(p);"
);
replaceOnce(
  "SELECT request_id,state,receipt_no,reserve_id,wait_type_id FROM v2_user_day_claims",
  "SELECT request_id,state,receipt_no,reserve_id,wait_type_id,updated_at FROM v2_user_day_claims"
);
replaceOnce(
  "  const e = apiError(state === 'AMBIGUOUS' ? 'EXISTING_AMBIGUOUS_RECEPTION_REQUIRES_MANUAL_REVIEW' : 'ACTIVE_RECEPTION_ALREADY_IN_PROGRESS', 409, state === 'AMBIGUOUS');\n  throw e;",
  "  if (state === 'CREATE_INFLIGHT' && Number(row.updated_at || 0) < now - CFG.STALE_CREATE_INFLIGHT_MS) {\n    await env.DB.prepare(\"UPDATE v2_user_day_claims SET state='AMBIGUOUS',updated_at=? WHERE user_hash=? AND business_date=? AND request_id=? AND state='CREATE_INFLIGHT'\")\n      .bind(Date.now(), hash, date, String(row.request_id || '')).run();\n    throw apiError('STALE_CREATE_INFLIGHT_REQUIRES_MANUAL_REVIEW', 409, true);\n  }\n  if (state === 'AMBIGUOUS' && waitTypeId === CFG.DEVELOP_TEST_WAIT_TYPE_ID && String(row.wait_type_id || '') === CFG.DEVELOP_TEST_WAIT_TYPE_ID && Number(row.updated_at || 0) < now - CFG.DEVELOP_TEST_AMBIGUOUS_RECYCLE_MS) {\n    await env.DB.batch([\n      env.DB.prepare(\"DELETE FROM v2_user_day_claims WHERE user_hash=? AND business_date=? AND request_id=? AND state='AMBIGUOUS' AND wait_type_id=?\").bind(hash,date,String(row.request_id||''),CFG.DEVELOP_TEST_WAIT_TYPE_ID),\n      env.DB.prepare(\"DELETE FROM v2_request_results WHERE request_id=? AND state='AMBIGUOUS'\").bind(String(row.request_id||''))\n    ]);\n    return await claimUserDay(env, hash, date, requestId, waitTypeId);\n  }\n  const e = apiError(state === 'AMBIGUOUS' ? 'EXISTING_AMBIGUOUS_RECEPTION_REQUIRES_MANUAL_REVIEW' : 'ACTIVE_RECEPTION_ALREADY_IN_PROGRESS', 409, state === 'AMBIGUOUS');\n  throw e;"
);

replaceOnce(
`function validateWaitType(waitTypes, day, mode, waitTypeId) {
  const allowed = SLOT_RULES[mode]?.[day.businessType] || [];
  if (!allowed.includes(waitTypeId)) throw apiError('WAIT_TYPE_NOT_ALLOWED_FOR_DAY', 400);
  const w = waitTypes.find(x => x.waitTypeId === waitTypeId);
  if (!w || w.dispFlg === false) throw apiError('WAIT_TYPE_NOT_AVAILABLE', 400);
  const regularWeekdayLine = mode === 'web' && day.businessType === '平日';
  if (!regularWeekdayLine && !usageMatchesMode(w.usageDispType, mode)) throw apiError('WAIT_TYPE_MODE_MISMATCH', 400);
  if (regularWeekdayLine) {
    const u=String(w.usageDispType||'');
    if (u && !['01','02','03','KeyALL','KeySTORE_RECEPTION_ONLY','KeyONLINE_RECEPTION_ONLY'].includes(u)) throw apiError('WAIT_TYPE_MODE_MISMATCH', 400);
  }
  return w;
}`,
`function validateWaitType(waitTypes, day, mode, waitTypeId) {
  const isDevelopTest = waitTypeId === CFG.DEVELOP_TEST_WAIT_TYPE_ID;
  const allowed = SLOT_RULES[mode]?.[day.businessType] || [];
  if (!isDevelopTest && !allowed.includes(waitTypeId)) throw apiError('WAIT_TYPE_NOT_ALLOWED_FOR_DAY', 400);
  const w = waitTypes.find(x => x.waitTypeId === waitTypeId);
  if (!w) throw apiError('WAIT_TYPE_NOT_AVAILABLE', 400);
  if (isDevelopTest) {
    const u = String(w.usageDispType || '');
    if (u && !['01','02','KeyALL','KeySTORE_RECEPTION_ONLY'].includes(u)) throw apiError('WAIT_TYPE_MODE_MISMATCH', 400);
    return w;
  }
  if (w.dispFlg === false) throw apiError('WAIT_TYPE_NOT_AVAILABLE', 400);
  const regularWeekdayLine = mode === 'web' && day.businessType === '平日';
  if (!regularWeekdayLine && !usageMatchesMode(w.usageDispType, mode)) throw apiError('WAIT_TYPE_MODE_MISMATCH', 400);
  if (regularWeekdayLine) {
    const u=String(w.usageDispType||'');
    if (u && !['01','02','03','KeyALL','KeySTORE_RECEPTION_ONLY','KeyONLINE_RECEPTION_ONLY'].includes(u)) throw apiError('WAIT_TYPE_MODE_MISMATCH', 400);
  }
  return w;
}`
);

replaceOnce(
  "function normalizeReceipt(v) { const m = String(v ?? '').normalize('NFKC').trim().toUpperCase().match(/^[FT]?(\\d{1,12})$/); return m ? m[1].replace(/^0+(?=\\d)/,'') : ''; }",
  "function normalizeReceipt(v) { const k=String(v??'').normalize('NFKC').trim().toUpperCase(); const m=k.match(/^([FT]?)(\\d{1,12})$/); return m ? m[1]+m[2].replace(/^0+(?=\\d)/,'') : ''; }"
);
replaceOnce(
  "  const vr = await fetch(verifyUrl, { headers: { Accept: 'application/json' } });",
  "  const vr = await fetchWithHardTimeout(verifyUrl, { headers: { Accept: 'application/json' } }, 8000, 'LINE_VERIFY_TIMEOUT');"
);
replaceOnce(
  "  const pr = await fetch(CFG.LINE_PROFILE, {",
  "  const pr = await fetchWithHardTimeout(CFG.LINE_PROFILE, {"
);
replaceOnce(
  "    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },\n  });\n  const profile = await safeJson(pr, 'LINE_PROFILE');",
  "    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },\n  }, 8000, 'LINE_PROFILE_TIMEOUT');\n  const profile = await safeJson(pr, 'LINE_PROFILE');"
);
replaceOnce(
  "  const r = await fetch(u, { headers: { Accept: 'application/json' }, cache: 'no-store' });",
  "  const r = await fetchWithHardTimeout(u, { headers: { Accept: 'application/json' }, cache: 'no-store' }, 8000, 'BUSINESS_CALENDAR_TIMEOUT');"
);
replaceOnce(
  "  const r = await fetch(CFG.AIR_WAIT_TYPES, {",
  "  const r = await fetchWithHardTimeout(CFG.AIR_WAIT_TYPES, {"
);
replaceOnce(
  "    body: new URLSearchParams({ storeId: CFG.STORE_ID }),\n  });\n  const d = await safeJson(r, 'AIRWAIT_WAIT_TYPES');",
  "    body: new URLSearchParams({ storeId: CFG.STORE_ID }),\n  }, 8000, 'AIRWAIT_WAIT_TYPES_TIMEOUT');\n  const d = await safeJson(r, 'AIRWAIT_WAIT_TYPES');"
);
replaceOnce(
  "    res = await fetch(CFG.AIR_CREATE, {",
  "    res = await fetchWithHardTimeout(CFG.AIR_CREATE, {"
);
replaceOnce(
  "        autoPrintFlg: 'false',\n      }),\n    });",
  "        autoPrintFlg: 'false',\n      }),\n    }, 20000, 'AIRWAIT_CREATE_TIMEOUT', true);"
);

const hardeningRuntime = String.raw`
async function fetchWithHardTimeout(url, options={}, ms=8000, label='EXTERNAL_TIMEOUT', ambiguous=false) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...options, signal:ctrl.signal }); }
  catch (e) {
    if (e?.name === 'AbortError') throw apiError(label, 504, ambiguous);
    throw e;
  } finally { clearTimeout(timer); }
}

let createWaitTypesCache = { savedAt:0, value:null };
let createWaitTypesInflight = null;
const CREATE_WAIT_TYPES_CACHE_MS = 5 * 1000;

async function getWaitTypesForCreate(env) {
  const now = Date.now();
  if (createWaitTypesCache.value && now - createWaitTypesCache.savedAt < CREATE_WAIT_TYPES_CACHE_MS) {
    return createWaitTypesCache.value;
  }
  if (createWaitTypesInflight) return await createWaitTypesInflight;
  const job = getWaitTypes(env, { force:true }).then(value => {
    createWaitTypesCache = { savedAt:Date.now(), value };
    return value;
  });
  createWaitTypesInflight = job;
  try { return await job; }
  finally { if (createWaitTypesInflight === job) createWaitTypesInflight = null; }
}

const createBusinessDayCache = new Map();
const createBusinessDayInflight = new Map();
const CREATE_BUSINESS_DAY_CACHE_MS = 30 * 60 * 1000;
const CREATE_BUSINESS_DAY_STALE_FALLBACK_MS = 12 * 60 * 60 * 1000;

function parseBusinessDayCacheRow(row,date){
  if(!row)return null;
  try{
    const value=JSON.parse(String(row.value||''));
    const rule=BUSINESS_RULES[value?.businessType];
    if(value?.operationalDate!==date||!rule)return null;
    return{savedAt:Number(row.updated_at||0),value:{...value,...rule}};
  }catch{return null}
}

async function getBusinessDayCachedForCreate(env, date) {
  const now = Date.now();
  const mem = createBusinessDayCache.get(date);
  if (mem && now - mem.savedAt < CREATE_BUSINESS_DAY_CACHE_MS) return mem.value;
  if (createBusinessDayInflight.has(date)) return await createBusinessDayInflight.get(date);

  const dbKey = 'business_day:' + date;
  const dbRow = await env.DB.prepare('SELECT value,updated_at FROM v2_system_state WHERE key=? LIMIT 1').bind(dbKey).first();
  const stored=parseBusinessDayCacheRow(dbRow,date);
  if (stored && now-stored.savedAt < CREATE_BUSINESS_DAY_CACHE_MS) {
    createBusinessDayCache.set(date,stored);
    return stored.value;
  }

  const job = (async () => {
    try{
      const value = await getBusinessDay(date);
      const savedAt=Date.now();
      createBusinessDayCache.set(date, { savedAt, value });
      await env.DB.prepare(
        'INSERT INTO v2_system_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at'
      ).bind(dbKey, JSON.stringify(value), savedAt).run();
      return value;
    }catch(e){
      const memoryFallback=createBusinessDayCache.get(date);
      if(memoryFallback&&Date.now()-memoryFallback.savedAt<CREATE_BUSINESS_DAY_STALE_FALLBACK_MS)return memoryFallback.value;
      if(stored&&Date.now()-stored.savedAt<CREATE_BUSINESS_DAY_STALE_FALLBACK_MS){
        createBusinessDayCache.set(date,stored);
        return stored.value;
      }
      throw e;
    }
  })();
  createBusinessDayInflight.set(date, job);
  try { return await job; }
  finally { if (createBusinessDayInflight.get(date) === job) createBusinessDayInflight.delete(date); }
}

`;
replaceOnce('function validateLocation(p) {', hardeningRuntime + 'function validateLocation(p) {');

const callstatusRuntime = String.raw`
const callstatusAirwaitCache = new Map();
const callstatusAirwaitInflight = new Map();
const CALLSTATUS_AIRWAIT_CACHE_MS = 5 * 1000;
const CALLSTATUS_AIRWAIT_TIMEOUT_MS = 8 * 1000;

function randomOpaqueToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function ticketParts(value) {
  const k = String(value || '').normalize('NFKC').toUpperCase().replace(/[\\s\\-ー]/g, '');
  const m = k.match(/^([FT]?)(\\d+)$/);
  if (!m) return null;
  return { prefix:m[1], digits:m[2].replace(/^0+(?=\\d)/, '') };
}

function ticketIdentity(value) {
  const p = ticketParts(value);
  return p ? p.prefix + p.digits : '';
}

function sameTicket(number, receiptNo) {
  const a = ticketParts(number), b = ticketParts(receiptNo);
  if (!a || !b || !a.digits || !b.digits || a.digits !== b.digits) return false;
  if (a.prefix && b.prefix && a.prefix !== b.prefix) return false;
  return true;
}

function selectTicketMatch(rows, receiptNo) {
  const list = Array.isArray(rows) ? rows : [];
  const target = ticketIdentity(receiptNo);
  const exact = target ? list.filter(r => ticketIdentity(r?.number) === target) : [];
  if (exact.length === 1) return { row:exact[0], ambiguous:false, count:1, mode:'exact' };
  if (exact.length > 1) return { row:null, ambiguous:true, count:exact.length, mode:'exact' };
  const loose = list.filter(r => sameTicket(r?.number, receiptNo));
  if (loose.length === 1) return { row:loose[0], ambiguous:false, count:1, mode:'compatible' };
  return { row:null, ambiguous:loose.length > 1, count:loose.length, mode:'compatible' };
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

async function recoverReservationSession(env, p) {
  const line = await verifyLineUser(p.liffAccessToken);
  const hash = await userHash(line.userId);
  const requestedDate = normalizeDate(p.businessDate);
  const targetDate = requestedDate || operationalDate();
  const row = await env.DB.prepare("SELECT request_id,business_date,reserve_id,receipt_no,wait_type_id,updated_at FROM v2_user_day_claims WHERE user_hash=? AND business_date=? AND state='CONFIRMED' AND receipt_no<>'' AND reserve_id<>'' ORDER BY updated_at DESC LIMIT 1")
    .bind(hash, targetDate).first();
  if (!row) return { ok: true, found: false, version: CFG.VERSION };
  let recoveredShortUrl = '';
  try {
    const resultRow = await env.DB.prepare('SELECT result_json FROM v2_request_results WHERE request_id=? LIMIT 1')
      .bind(String(row.request_id || '')).first();
    const result = resultRow?.result_json ? JSON.parse(String(resultRow.result_json)) : null;
    const rawUrl = String(result?.shortUrl || '').trim();
    const parsed = rawUrl ? new URL(rawUrl) : null;
    const host = String(parsed?.hostname || '').toLowerCase();
    if (parsed?.protocol === 'https:' && (host === 'airwait.jp' || host.endsWith('.airwait.jp'))) recoveredShortUrl = parsed.toString();
  } catch {}
  const rawToken = randomOpaqueToken();
  const tokenHash = await sha256Hex(rawToken);
  const now = Date.now();
  const expiresAt = now + CFG.CALLSTATUS_SESSION_TTL_MS;
  await env.DB.prepare('DELETE FROM v2_reservation_sessions WHERE expires_at<?').bind(now).run();
  await env.DB.prepare('INSERT INTO v2_reservation_sessions(token_hash,user_hash,business_date,reserve_id,receipt_no,wait_type_id,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(tokenHash, hash, String(row.business_date), String(row.reserve_id), String(row.receipt_no), String(row.wait_type_id || ''), now, expiresAt).run();

  return {
    ok: true,
    found: true,
    version: CFG.VERSION,
    sessionToken: rawToken,
    expiresAt,
    businessDate: String(row.business_date),
    reserveId: String(row.reserve_id),
    receiptNo: String(row.receipt_no),
    waitTypeId: String(row.wait_type_id || ''),
    shortUrl: recoveredShortUrl,
  };
}

async function fetchAirwaitReservationsUncached(env, waitTypeId) {
  if (!env.AIRWAIT_API_KEY) throw apiError('AIRWAIT_KEY_NOT_CONFIGURED', 503);
  const rows = [];
  let start = 1;
  let total = 0;
  for (let page = 0; page < 20; page += 1) {
    const body = new URLSearchParams({
      storeId: CFG.STORE_ID,
      sortStatus: '0',
      isDesc: '0',
      start: String(start),
      limit: '100',
    });
    if (waitTypeId) body.set('waitTypeId', String(waitTypeId));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CALLSTATUS_AIRWAIT_TIMEOUT_MS);
    let r;
    try {
      r = await fetch(CFG.AIR_RESERVATIONS, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          corWclpKeyCd: env.AIRWAIT_API_KEY,
        },
        body,
        cache: 'no-store',
        signal: ctrl.signal,
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw apiError('AIRWAIT_RESERVATIONS_TIMEOUT', 504);
      throw e;
    } finally { clearTimeout(timer); }
    const d = await safeJson(r, 'AIRWAIT_RESERVATIONS');
    if (!r.ok || d?.success !== true || d?.resultCode?.code !== '0000') {
      const rc = String(d?.resultCode?.code || 'NONE');
      throw apiError('AIRWAIT_RESERVATIONS_FAILED_HTTP_' + r.status + '_RC_' + rc, 502, false, rc);
    }
    const part = Array.isArray(d?.innerDto?.reservations) ? d.innerDto.reservations : [];
    total = Number(d?.innerDto?.count || part.length || 0);
    rows.push(...part.map(x => ({
      number: String(x?.number || ''),
      waitTypeId: normalizeWaitType(x?.waitTypeId) || String(x?.waitTypeId || ''),
      waitTypeName: String(x?.waitTypeName || ''),
      status: String(x?.status || ''),
      isCalling: String(x?.isCalling || '0'),
    })));
    if (!part.length || rows.length >= total) break;
    start += part.length;
  }
  return rows;
}

async function fetchAirwaitReservations(env, waitTypeId) {
  const key = String(waitTypeId || 'ALL');
  const now = Date.now();
  const cached = callstatusAirwaitCache.get(key);
  if (cached && now - cached.savedAt < CALLSTATUS_AIRWAIT_CACHE_MS) return cached.rows;
  if (callstatusAirwaitInflight.has(key)) return await callstatusAirwaitInflight.get(key);
  const job = fetchAirwaitReservationsUncached(env, waitTypeId).then(rows => {
    callstatusAirwaitCache.set(key, { savedAt: Date.now(), rows });
    return rows;
  });
  callstatusAirwaitInflight.set(key, job);
  try { return await job; }
  finally { if (callstatusAirwaitInflight.get(key) === job) callstatusAirwaitInflight.delete(key); }
}

async function reservationStatus(env, p) {
  const rawToken = String(p.sessionToken || '').trim();
  if (rawToken.length < 32 || rawToken.length > 256) throw apiError('CALLSTATUS_SESSION_REQUIRED', 401);
  const tokenHash = await sha256Hex(rawToken);
  const now = Date.now();
  const session = await env.DB.prepare('SELECT user_hash,business_date,reserve_id,receipt_no,wait_type_id,expires_at FROM v2_reservation_sessions WHERE token_hash=? LIMIT 1')
    .bind(tokenHash).first();
  if (!session || Number(session.expires_at || 0) <= now) throw apiError('CALLSTATUS_SESSION_EXPIRED', 401);

  const storedWaitTypeId = String(session.wait_type_id || '');
  let rows;
  let usedAllWaitTypesFallback = false;
  try {
    rows = await fetchAirwaitReservations(env, storedWaitTypeId);
  } catch (e) {
    const rc = String(e?.code || '');
    if (storedWaitTypeId && rc === '3556') {
      rows = await fetchAirwaitReservations(env, '');
      usedAllWaitTypesFallback = true;
    } else {
      throw e;
    }
  }

  const ownMatch = selectTicketMatch(rows, session.receipt_no);
  const own = ownMatch.row;
  if (!own) {
    return {
      ok: true,
      found: false,
      version: CFG.VERSION,
      businessDate: String(session.business_date),
      receiptNo: String(session.receipt_no),
      waitTypeId: storedWaitTypeId,
      checkedAt: now,
      reconcileTried: usedAllWaitTypesFallback,
      reconcileReason: usedAllWaitTypesFallback ? 'STALE_WAIT_TYPE_3556' : '',
      reconcileAmbiguous: Boolean(ownMatch.ambiguous),
      reconcileCandidateCount: Number(ownMatch.count || 0),
    };
  }

  const effectiveWaitTypeId = String(own.waitTypeId || storedWaitTypeId || '');
  if (usedAllWaitTypesFallback && effectiveWaitTypeId && effectiveWaitTypeId !== storedWaitTypeId) {
    await env.DB.prepare('UPDATE v2_reservation_sessions SET wait_type_id=? WHERE token_hash=?')
      .bind(effectiveWaitTypeId, tokenHash).run();
  }

  const queueRows = effectiveWaitTypeId
    ? rows.filter(r => String(r.waitTypeId || '') === effectiveWaitTypeId)
    : rows;
  const active = queueRows.filter(r => ['0', '1', '4'].includes(String(r.status || '')));
  const ownIdentity = ticketIdentity(own.number);
  const activeIndex = active.findIndex(r => ticketIdentity(r.number) === ownIdentity);
  const aheadCount = activeIndex >= 0
    ? active.slice(0, activeIndex).filter(r => ['0', '4'].includes(String(r.status || ''))).length
    : null;

  return {
    ok: true,
    found: true,
    version: CFG.VERSION,
    businessDate: String(session.business_date),
    receiptNo: String(session.receipt_no),
    reserveId: String(session.reserve_id),
    waitTypeId: effectiveWaitTypeId,
    waitTypeName: String(own.waitTypeName || ''),
    status: String(own.status || ''),
    isCalling: String(own.isCalling || '0') === '1',
    state: reservationState(own),
    aheadCount,
    queueRank: activeIndex >= 0 ? activeIndex + 1 : null,
    activeCount: active.length,
    checkedAt: now,
    reconciledBy: usedAllWaitTypesFallback ? 'all-wait-types-after-3556' : '',
  };
}

`;

replaceOnce('function validateLocation(p) {', callstatusRuntime + 'function validateLocation(p) {');

writeFileSync(outputPath, s, 'utf8');
console.log(`Prepared ${outputPath} with Developing-only AirWAIT test slot 0042 and hardened call-status support.`);
