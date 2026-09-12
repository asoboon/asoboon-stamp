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

replaceOnce("  VERSION: '1.0.dev1',", "  VERSION: '1.3.dev-loadguard',");
replaceOnce(
  "  ONSITE_OPEN_MIN: 9 * 60 + 30,",
  "  ONSITE_OPEN_MIN: 9 * 60 + 30,\n  DEVELOP_TEST_WAIT_TYPE_ID: '0042',\n  CALLSTATUS_SESSION_TTL_MS: 36 * 60 * 60 * 1000,\n  BUSINESS_DAY_CACHE_MS: 60 * 1000,\n  RESERVATION_SNAPSHOT_CACHE_MS: 5 * 1000,\n  RESERVATION_SNAPSHOT_STALE_MS: 30 * 1000,"
);
replaceOnce(
  "  AIR_CREATE: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',",
  "  AIR_CREATE: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',\n  AIR_RESERVATIONS: 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',"
);
replaceOnce(
  "      await ensureSchema(env);",
  "      await ensureSchemaOnce(env);"
);
replaceOnce(
  "        if (action === 'waitTypes') return out(request, await getWaitTypes(env));",
  "        if (action === 'waitTypes') return out(request, await getWaitTypesShared(env));"
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
  "    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_reservation_sessions (\n      token_hash TEXT PRIMARY KEY,\n      user_hash TEXT NOT NULL,\n      business_date TEXT NOT NULL,\n      reserve_id TEXT NOT NULL,\n      receipt_no TEXT NOT NULL,\n      wait_type_id TEXT NOT NULL,\n      created_at INTEGER NOT NULL,\n      expires_at INTEGER NOT NULL\n    )`),\n    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_v2_reservation_sessions_user\n      ON v2_reservation_sessions(user_hash,business_date,expires_at)`),\n    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_system_state (\n      key TEXT PRIMARY KEY,\n      value TEXT NOT NULL,\n      updated_at INTEGER NOT NULL\n    )`),"
);
replaceOnce(
  "async function ensureSchema(env) {",
  `let runtimeSchemaReadyPromise = null;
async function ensureSchemaOnce(env) {
  if (!runtimeSchemaReadyPromise) {
    runtimeSchemaReadyPromise = ensureSchema(env).catch(e => {
      runtimeSchemaReadyPromise = null;
      throw e;
    });
  }
  return runtimeSchemaReadyPromise;
}

async function ensureSchema(env) {`
);
replaceOnce(
  "async function getBusinessDay(date) {",
  `const runtimeBusinessDayCache = new Map();
const runtimeBusinessDayInflight = new Map();
async function getBusinessDayCached(date) {
  const now = Date.now();
  const cached = runtimeBusinessDayCache.get(date);
  if (cached && now - cached.savedAt < CFG.BUSINESS_DAY_CACHE_MS) return cached.value;
  if (runtimeBusinessDayInflight.has(date)) return runtimeBusinessDayInflight.get(date);
  const job = getBusinessDay(date).then(value => {
    runtimeBusinessDayCache.set(date, { savedAt: Date.now(), value });
    return value;
  });
  runtimeBusinessDayInflight.set(date, job);
  try { return await job; }
  finally { runtimeBusinessDayInflight.delete(date); }
}

async function getBusinessDay(date) {`
);
replaceOnce(
  "async function getWaitTypes(env, { force = false } = {}) {",
  `let runtimeWaitTypesInflight = null;
async function getWaitTypesShared(env) {
  if (runtimeWaitTypesInflight) return runtimeWaitTypesInflight;
  const job = getWaitTypes(env);
  runtimeWaitTypesInflight = job;
  try { return await job; }
  finally { if (runtimeWaitTypesInflight === job) runtimeWaitTypesInflight = null; }
}

async function getWaitTypes(env, { force = false } = {}) {`
);
replaceOnce(
  "function enforceReceptionHours(day, mode) {\n  if (day.isClosed) throw apiError('CLOSED_DAY', 400);",
  "function enforceReceptionHours(day, mode, waitTypeId) {\n  if (waitTypeId === CFG.DEVELOP_TEST_WAIT_TYPE_ID) return;\n  if (day.isClosed) throw apiError('CLOSED_DAY', 400);"
);
replaceOnce(
  "  await incrementAttempt(env, hash, serverDate);",
  "  if (waitTypeId !== CFG.DEVELOP_TEST_WAIT_TYPE_ID) await incrementAttempt(env, hash, serverDate);"
);
replaceOnce(
  "  const day = await getBusinessDay(serverDate);",
  "  const day = await getBusinessDayCached(serverDate);"
);
replaceOnce(
  "  const wt = await getWaitTypes(env, { force: true });",
  "  const wt = await getWaitTypesShared(env);"
);

replaceOnce(
`function validateWaitType(waitTypes, day, mode, waitTypeId) {
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
}`,
`function isStoreReceptionUsage(usage) {
  const u = String(usage || '');
  return !u || ['01', '02', 'KeyALL', 'KeySTORE_RECEPTION_ONLY'].includes(u);
}

function validateWaitType(waitTypes, day, mode, waitTypeId) {
  const isDevelopTest = waitTypeId === CFG.DEVELOP_TEST_WAIT_TYPE_ID;
  const allowed = SLOT_RULES[day.businessType] || [];
  if (!isDevelopTest && !allowed.includes(waitTypeId)) throw apiError('WAIT_TYPE_NOT_ALLOWED_FOR_DAY', 400);
  const w = waitTypes.find(x => x.waitTypeId === waitTypeId);
  if (!w) throw apiError('WAIT_TYPE_NOT_AVAILABLE', 400);
  if (!isDevelopTest && w.dispFlg === false) throw apiError('WAIT_TYPE_NOT_AVAILABLE', 400);
  if (!isStoreReceptionUsage(w.usageDispType)) throw apiError('WAIT_TYPE_MODE_MISMATCH', 400);
  return w;
}`
);

replaceOnce(
  "  enforceReceptionHours(day, mode);",
  "  enforceReceptionHours(day, mode, waitTypeId);"
);

const callstatusRuntime = String.raw`
function randomOpaqueToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function ticketKey(value) {
  return String(value || '').normalize('NFKC').toUpperCase().replace(/[\\s\\-ー]/g, '');
}

function ticketDigits(value) {
  return ticketKey(value).replace(/\\D/g, '').replace(/^0+(?=\\d)/, '');
}

function sameTicket(number, receiptNo) {
  const a = ticketKey(number), b = ticketKey(receiptNo);
  if (!a || !b) return false;
  if (a === b) return true;
  const ad = ticketDigits(a), bd = ticketDigits(b);
  return ad && bd && ad === bd;
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
  let row = null;
  if (requestedDate) {
    row = await env.DB.prepare("SELECT business_date,reserve_id,receipt_no,wait_type_id,updated_at FROM v2_user_day_claims WHERE user_hash=? AND business_date=? AND state='CONFIRMED' AND receipt_no<>'' AND reserve_id<>'' LIMIT 1")
      .bind(hash, requestedDate).first();
  }
  if (!row) {
    row = await env.DB.prepare("SELECT business_date,reserve_id,receipt_no,wait_type_id,updated_at FROM v2_user_day_claims WHERE user_hash=? AND state='CONFIRMED' AND receipt_no<>'' AND reserve_id<>'' AND updated_at>=? ORDER BY updated_at DESC LIMIT 1")
      .bind(hash, Date.now() - CFG.CALLSTATUS_SESSION_TTL_MS).first();
  }
  if (!row) return { ok: true, found: false, version: CFG.VERSION };

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
  };
}

const runtimeReservationSnapshotInflight = new Map();
function parseReservationSnapshot(row) {
  if (!row?.value) return null;
  try { const v = JSON.parse(String(row.value)); return Array.isArray(v) ? v : null; }
  catch { return null; }
}

async function fetchAirwaitReservationsFresh(env, waitTypeId) {
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
    const r = await fetch(CFG.AIR_RESERVATIONS, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        corWclpKeyCd: env.AIRWAIT_API_KEY,
      },
      body,
      cache: 'no-store',
    });
    const d = await safeJson(r, 'AIRWAIT_RESERVATIONS');
    if (!r.ok || d?.success !== true || d?.resultCode?.code !== '0000') throw apiError('AIRWAIT_RESERVATIONS_FAILED', 502);
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
  const key = 'reservation_snapshot:' + String(waitTypeId || 'all');
  const now = Date.now();
  const cachedRow = await env.DB.prepare('SELECT value,updated_at FROM v2_system_state WHERE key=? LIMIT 1').bind(key).first();
  const cachedRows = parseReservationSnapshot(cachedRow);
  const age = cachedRow ? now - Number(cachedRow.updated_at || 0) : Infinity;
  if (cachedRows && age < CFG.RESERVATION_SNAPSHOT_CACHE_MS) return cachedRows;
  if (runtimeReservationSnapshotInflight.has(key)) return runtimeReservationSnapshotInflight.get(key);

  const job = (async () => {
    try {
      const rows = await fetchAirwaitReservationsFresh(env, waitTypeId);
      await env.DB.prepare(`INSERT INTO v2_system_state(key,value,updated_at) VALUES(?,?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`)
        .bind(key, JSON.stringify(rows), Date.now()).run();
      return rows;
    } catch (e) {
      if (cachedRows && age < CFG.RESERVATION_SNAPSHOT_STALE_MS) return cachedRows;
      throw e;
    }
  })();
  runtimeReservationSnapshotInflight.set(key, job);
  try { return await job; }
  finally { if (runtimeReservationSnapshotInflight.get(key) === job) runtimeReservationSnapshotInflight.delete(key); }
}

async function reservationStatus(env, p) {
  const rawToken = String(p.sessionToken || '').trim();
  if (rawToken.length < 32 || rawToken.length > 256) throw apiError('CALLSTATUS_SESSION_REQUIRED', 401);
  const tokenHash = await sha256Hex(rawToken);
  const now = Date.now();
  const session = await env.DB.prepare('SELECT user_hash,business_date,reserve_id,receipt_no,wait_type_id,expires_at FROM v2_reservation_sessions WHERE token_hash=? LIMIT 1')
    .bind(tokenHash).first();
  if (!session || Number(session.expires_at || 0) <= now) throw apiError('CALLSTATUS_SESSION_EXPIRED', 401);

  const rows = await fetchAirwaitReservations(env, String(session.wait_type_id || ''));
  const ownIndex = rows.findIndex(r => sameTicket(r.number, session.receipt_no));
  const own = ownIndex >= 0 ? rows[ownIndex] : null;
  if (!own) {
    return {
      ok: true,
      found: false,
      version: CFG.VERSION,
      businessDate: String(session.business_date),
      receiptNo: String(session.receipt_no),
      waitTypeId: String(session.wait_type_id || ''),
      checkedAt: now,
    };
  }

  const active = rows.filter(r => ['0', '1', '4'].includes(String(r.status || '')));
  const activeIndex = active.findIndex(r => sameTicket(r.number, session.receipt_no));
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
    waitTypeId: String(own.waitTypeId || session.wait_type_id || ''),
    waitTypeName: String(own.waitTypeName || ''),
    status: String(own.status || ''),
    isCalling: String(own.isCalling || '0') === '1',
    state: reservationState(own),
    aheadCount,
    queueRank: activeIndex >= 0 ? activeIndex + 1 : null,
    activeCount: active.length,
    checkedAt: now,
  };
}

`;

replaceOnce('function validateLocation(p) {', callstatusRuntime + 'function validateLocation(p) {');

writeFileSync(outputPath, s, 'utf8');
console.log(`Prepared ${outputPath} with Developing-only AirWAIT test slot 0042, load guards, and secure call-status support.`);
