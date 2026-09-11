/**
 * ASOBooN MINI App v2 - Developing-only LINE Service Message bridge
 * This module is only loaded by the official Developing Worker wrapper.
 * It never runs in Review/Published.
 */

const SM = Object.freeze({
  VERSION: '1.0.dev1',
  CHANNEL_ID: '2009884611',
  STORE_ID: 'KR01205179',
  TZ: 'Asia/Tokyo',
  LINE_OAUTH: 'https://api.line.me/oauth2/v3/token',
  NOTIFIER_TOKEN: 'https://api.line.me/message/v3/notifier/token',
  NOTIFIER_SEND: 'https://api.line.me/message/v3/notifier/send?target=service',
  AIR_RESERVATIONS: 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  CALLSTATUS_URL: 'https://miniapp.line.me/2009884611-bDgDzGrN?view=callstatus',
  PENDING_STALE_MS: 2 * 60 * 1000,
  RETRY_DELAY_MS: 60 * 1000,
});

export async function serviceHealth(env) {
  await ensureServiceSchema(env);
  return {
    serviceMessageEnabled: true,
    serviceMessageVersion: SM.VERSION,
    serviceMessageChannelId: SM.CHANNEL_ID,
    serviceMessageChannelSecretConfigured: Boolean(String(env.LINE_MINIAPP_CHANNEL_SECRET || '').trim()),
    serviceMessageTemplateConfigured: Boolean(normalizeTemplateName(env.SERVICE_MESSAGE_TEMPLATE_NAME)),
    serviceMessageTemplateParamsConfigured: Boolean(String(env.SERVICE_MESSAGE_TEMPLATE_PARAMS_JSON || '').trim()),
    serviceMessageCronEnabled: true,
  };
}

export async function registerReservationNotification(env, p, result) {
  await ensureServiceSchema(env);
  const businessDate = normalizeDate(result?.businessDate || result?.operationalDate || p?.operationalDate);
  const receiptNo = normalizeReceipt(result?.receiptNo);
  const reserveId = normalizeReserveId(result?.reserveId);
  const waitTypeId = normalizeWaitType(result?.waitTypeId || p?.waitTypeId);
  const requestId = normalizeRequestId(p?.requestId);
  const liffAccessToken = String(p?.liffAccessToken || '').trim();
  if (!businessDate || !receiptNo || !reserveId || !waitTypeId) {
    return { ok: false, ready: false, status: 'REGISTRATION_DATA_INVALID' };
  }

  const existing = await getServiceRow(env, businessDate, reserveId);
  if (existing) {
    const status = String(existing.status || '');
    return {
      ok: Boolean(existing.notification_token),
      ready: Boolean(existing.notification_token),
      alreadyRegistered: true,
      status,
      remainingCount: Number(existing.remaining_count || 0),
      error: String(existing.last_error || ''),
    };
  }

  const now = Date.now();
  const secret = String(env.LINE_MINIAPP_CHANNEL_SECRET || '').trim();
  if (!secret) {
    await insertRegistrationState(env, {
      businessDate, receiptNo, reserveId, waitTypeId, requestId,
      status: 'CHANNEL_SECRET_MISSING', lastError: 'LINE_MINIAPP_CHANNEL_SECRET_NOT_CONFIGURED', now,
    });
    return { ok: false, ready: false, status: 'CHANNEL_SECRET_MISSING', error: 'LINE_MINIAPP_CHANNEL_SECRET_NOT_CONFIGURED' };
  }
  if (liffAccessToken.length < 20) {
    await insertRegistrationState(env, {
      businessDate, receiptNo, reserveId, waitTypeId, requestId,
      status: 'LIFF_TOKEN_MISSING', lastError: 'LIFF_ACCESS_TOKEN_REQUIRED', now,
    });
    return { ok: false, ready: false, status: 'LIFF_TOKEN_MISSING', error: 'LIFF_ACCESS_TOKEN_REQUIRED' };
  }

  const claim = await env.DB.prepare(`INSERT OR IGNORE INTO v2_service_messages
    (business_date,receipt_no,reserve_id,wait_type_id,request_id,status,last_error,last_http_status,notification_token,expires_at,remaining_count,session_id,notified_at,next_retry_at,created_at,updated_at)
    VALUES(?,?,?,?,?,'TOKEN_ISSUE_PENDING','',0,'',0,0,'',0,0,?,?)`)
    .bind(businessDate, receiptNo, reserveId, waitTypeId, requestId, now, now).run();
  if (Number(claim?.meta?.changes || 0) !== 1) {
    const row = await getServiceRow(env, businessDate, reserveId);
    return {
      ok: Boolean(row?.notification_token), ready: Boolean(row?.notification_token), alreadyRegistered: true,
      status: String(row?.status || 'UNKNOWN'), remainingCount: Number(row?.remaining_count || 0), error: String(row?.last_error || ''),
    };
  }

  let channelToken;
  try {
    channelToken = await issueChannelToken(env);
  } catch (e) {
    await updateIssueFailure(env, businessDate, reserveId, 'CHANNEL_TOKEN_ERROR', e);
    return { ok: false, ready: false, status: 'CHANNEL_TOKEN_ERROR', error: safeError(e) };
  }

  let response;
  try {
    response = await fetch(SM.NOTIFIER_TOKEN, {
      method: 'POST',
      headers: { Authorization: `Bearer ${channelToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ liffAccessToken }),
    });
  } catch (e) {
    await updateIssueFailure(env, businessDate, reserveId, 'TOKEN_ISSUE_AMBIGUOUS', apiError(`NOTIFIER_TOKEN_NETWORK ${safeError(e)}`, 0, true));
    return { ok: false, ready: false, ambiguous: true, status: 'TOKEN_ISSUE_AMBIGUOUS', error: safeError(e) };
  }

  const text = await response.text();
  if (!response.ok) {
    const ambiguous = response.status >= 500;
    const e = apiError(`NOTIFIER_TOKEN_HTTP_${response.status} ${safeApiText(text)}`, response.status, ambiguous);
    await updateIssueFailure(env, businessDate, reserveId, ambiguous ? 'TOKEN_ISSUE_AMBIGUOUS' : 'TOKEN_ISSUE_ERROR', e);
    return { ok: false, ready: false, ambiguous, status: ambiguous ? 'TOKEN_ISSUE_AMBIGUOUS' : 'TOKEN_ISSUE_ERROR', error: safeError(e) };
  }

  let data;
  try { data = JSON.parse(text); }
  catch {
    const e = apiError('NOTIFIER_TOKEN_200_INVALID_JSON', 200, true);
    await updateIssueFailure(env, businessDate, reserveId, 'TOKEN_ISSUE_AMBIGUOUS', e);
    return { ok: false, ready: false, ambiguous: true, status: 'TOKEN_ISSUE_AMBIGUOUS', error: e.message };
  }
  const notificationToken = String(data?.notificationToken || '').trim();
  const remainingCount = Number(data?.remainingCount || 0);
  const expiresIn = Number(data?.expiresIn || 0);
  if (!notificationToken || remainingCount <= 0 || expiresIn <= 0) {
    const e = apiError('NOTIFIER_TOKEN_200_NOT_SENDABLE', 200, true);
    await updateIssueFailure(env, businessDate, reserveId, 'TOKEN_ISSUE_AMBIGUOUS', e);
    return { ok: false, ready: false, ambiguous: true, status: 'TOKEN_ISSUE_AMBIGUOUS', error: e.message };
  }

  await env.DB.prepare(`UPDATE v2_service_messages
    SET status='TOKEN_READY',last_error='',last_http_status=200,notification_token=?,expires_at=?,remaining_count=?,session_id=?,updated_at=?
    WHERE business_date=? AND reserve_id=?`)
    .bind(notificationToken, now + expiresIn * 1000, remainingCount, String(data?.sessionId || ''), Date.now(), businessDate, reserveId).run();
  return { ok: true, ready: true, status: 'TOKEN_READY', remainingCount };
}

export async function serviceStatus(env, params) {
  await ensureServiceSchema(env);
  const businessDate = normalizeDate(params?.businessDate || params?.date);
  const receiptNo = normalizeReceipt(params?.receiptNo || params?.number);
  if (!businessDate || !receiptNo) return { ok: false, found: false, error: 'VALIDATION_ERROR', version: SM.VERSION };
  const row = await env.DB.prepare(`SELECT business_date,receipt_no,reserve_id,wait_type_id,status,last_error,last_http_status,
    remaining_count,expires_at,notified_at,next_retry_at,created_at,updated_at
    FROM v2_service_messages WHERE business_date=? AND receipt_no=? ORDER BY updated_at DESC LIMIT 1`)
    .bind(businessDate, receiptNo).first();
  if (!row) return { ok: true, found: false, version: SM.VERSION };
  return publicRow(row);
}

export async function runServiceMessageWorker(env) {
  await ensureServiceSchema(env);
  const now = Date.now();
  await env.DB.prepare(`UPDATE v2_service_messages
    SET status='CALL_SEND_AMBIGUOUS',last_error='stale CALL_SEND_PENDING; delivery outcome unknown',updated_at=?
    WHERE status='CALL_SEND_PENDING' AND updated_at<? AND notified_at=0`)
    .bind(now, now - SM.PENDING_STALE_MS).run();

  const rowsResult = await env.DB.prepare(`SELECT * FROM v2_service_messages
    WHERE business_date=? AND notified_at=0 AND notification_token<>''
      AND status IN ('TOKEN_READY','CALL_SEND_RETRY')
      AND (next_retry_at=0 OR next_retry_at<=?)
    ORDER BY created_at ASC LIMIT 200`).bind(jstDate(now), now).all();
  const pending = Array.isArray(rowsResult?.results) ? rowsResult.results : [];
  if (!pending.length) return { ok: true, checked: 0, sent: 0, version: SM.VERSION };
  if (!env.AIRWAIT_API_KEY) throw apiError('AIRWAIT_KEY_NOT_CONFIGURED', 503);

  const byWaitType = new Map();
  for (const rec of pending) {
    const wt = normalizeWaitType(rec.wait_type_id);
    if (!wt) continue;
    if (!byWaitType.has(wt)) byWaitType.set(wt, await fetchAirwaitReservations(env, wt));
  }

  let sent = 0;
  for (const rec of pending) {
    const rows = byWaitType.get(String(rec.wait_type_id)) || [];
    const own = rows.find(r => sameTicket(r.number, rec.receipt_no));
    if (!own || String(own.status || '') !== '0' || String(own.isCalling || '0') !== '1') continue;
    const result = await sendCallMessage(env, rec, own);
    if (result.sent) sent += 1;
  }
  return { ok: true, checked: pending.length, sent, version: SM.VERSION };
}

async function sendCallMessage(env, rec, airwaitRow) {
  const templateName = normalizeTemplateName(env.SERVICE_MESSAGE_TEMPLATE_NAME);
  if (!templateName) {
    await setRowError(env, rec, 'TEMPLATE_NOT_CONFIGURED', 'SERVICE_MESSAGE_TEMPLATE_NAME_NOT_CONFIGURED', 0);
    return { sent: false };
  }
  if (!String(env.LINE_MINIAPP_CHANNEL_SECRET || '').trim()) {
    await setRowError(env, rec, 'CHANNEL_SECRET_MISSING', 'LINE_MINIAPP_CHANNEL_SECRET_NOT_CONFIGURED', 0);
    return { sent: false };
  }
  if (Number(rec.expires_at || 0) <= Date.now() || Number(rec.remaining_count || 0) <= 0) {
    await setRowError(env, rec, 'TOKEN_NOT_SENDABLE', 'SERVICE_NOTIFICATION_TOKEN_EXPIRED_OR_EXHAUSTED', 0);
    return { sent: false };
  }

  const claimed = await env.DB.prepare(`UPDATE v2_service_messages SET status='CALL_SEND_PENDING',last_error='',last_http_status=0,updated_at=?
    WHERE business_date=? AND reserve_id=? AND notified_at=0 AND status IN ('TOKEN_READY','CALL_SEND_RETRY')`)
    .bind(Date.now(), rec.business_date, rec.reserve_id).run();
  if (Number(claimed?.meta?.changes || 0) !== 1) return { sent: false };

  let channelToken;
  try { channelToken = await issueChannelToken(env); }
  catch (e) {
    await setRowError(env, rec, 'CALL_SEND_RETRY', safeError(e), Number(e?.status || 0), Date.now() + SM.RETRY_DELAY_MS);
    return { sent: false };
  }

  const params = buildTemplateParams(env, {
    receiptNo: rec.receipt_no,
    reserveId: rec.reserve_id,
    waitTypeId: rec.wait_type_id,
    waitTypeName: String(airwaitRow?.waitTypeName || ''),
    businessDate: rec.business_date,
    callstatusUrl: SM.CALLSTATUS_URL,
  });

  let response;
  try {
    response = await fetch(SM.NOTIFIER_SEND, {
      method: 'POST',
      headers: { Authorization: `Bearer ${channelToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ templateName, params, notificationToken: String(rec.notification_token) }),
    });
  } catch (e) {
    await setRowError(env, rec, 'CALL_SEND_AMBIGUOUS', `NOTIFIER_SEND_NETWORK ${safeError(e)}`, 0);
    return { sent: false, ambiguous: true };
  }

  const text = await response.text();
  if (!response.ok) {
    if (response.status === 429) {
      await setRowError(env, rec, 'CALL_SEND_RETRY', `NOTIFIER_SEND_HTTP_429 ${safeApiText(text)}`, 429, Date.now() + SM.RETRY_DELAY_MS);
      return { sent: false };
    }
    const ambiguous = response.status >= 500;
    await setRowError(env, rec, ambiguous ? 'CALL_SEND_AMBIGUOUS' : 'CALL_SEND_ERROR', `NOTIFIER_SEND_HTTP_${response.status} ${safeApiText(text)}`, response.status);
    return { sent: false, ambiguous };
  }

  let data;
  try { data = JSON.parse(text); }
  catch {
    await setRowError(env, rec, 'CALL_SEND_AMBIGUOUS', 'NOTIFIER_SEND_200_INVALID_JSON', 200);
    return { sent: false, ambiguous: true };
  }
  const nextToken = String(data?.notificationToken || '').trim();
  const remainingCount = Number(data?.remainingCount || 0);
  const expiresIn = Number(data?.expiresIn || 0);
  await env.DB.prepare(`UPDATE v2_service_messages SET status='CALL_MESSAGE_SENT',last_error='',last_http_status=200,
    notification_token=?,remaining_count=?,expires_at=?,session_id=?,notified_at=?,next_retry_at=0,updated_at=?
    WHERE business_date=? AND reserve_id=?`)
    .bind(nextToken, remainingCount, expiresIn > 0 ? Date.now() + expiresIn * 1000 : Number(rec.expires_at || 0),
      String(data?.sessionId || rec.session_id || ''), Date.now(), Date.now(), rec.business_date, rec.reserve_id).run();
  return { sent: true };
}

async function issueChannelToken(env) {
  const secret = String(env.LINE_MINIAPP_CHANNEL_SECRET || '').trim();
  if (!secret) throw apiError('LINE_MINIAPP_CHANNEL_SECRET_NOT_CONFIGURED', 503);
  const response = await fetch(SM.LINE_OAUTH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: SM.CHANNEL_ID, client_secret: secret }),
  });
  const text = await response.text();
  if (!response.ok) throw apiError(`CHANNEL_TOKEN_HTTP_${response.status} ${safeApiText(text)}`, response.status);
  let data;
  try { data = JSON.parse(text); } catch { throw apiError('CHANNEL_TOKEN_INVALID_JSON', 502, response.status >= 500); }
  if (!data?.access_token) throw apiError('CHANNEL_ACCESS_TOKEN_EMPTY', 502);
  return String(data.access_token);
}

async function fetchAirwaitReservations(env, waitTypeId) {
  const out = [];
  let start = 1;
  for (let page = 0; page < 20; page += 1) {
    const response = await fetch(SM.AIR_RESERVATIONS, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        corWclpKeyCd: env.AIRWAIT_API_KEY,
      },
      body: new URLSearchParams({ storeId: SM.STORE_ID, waitTypeId, sortStatus: '0', isDesc: '0', start: String(start), limit: '100' }),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { throw apiError('AIRWAIT_RESERVATIONS_INVALID_JSON', 502, response.status >= 500); }
    if (!response.ok || data?.success !== true || data?.resultCode?.code !== '0000') throw apiError(`AIRWAIT_RESERVATIONS_FAILED_${response.status}`, 502);
    const part = Array.isArray(data?.innerDto?.reservations) ? data.innerDto.reservations : [];
    const total = Number(data?.innerDto?.count || part.length || 0);
    out.push(...part.map(x => ({
      number: String(x?.number || ''), waitTypeId: normalizeWaitType(x?.waitTypeId), waitTypeName: String(x?.waitTypeName || ''),
      status: String(x?.status || ''), isCalling: String(x?.isCalling || '0'),
    })));
    if (!part.length || out.length >= total) break;
    start += part.length;
  }
  return out;
}

async function ensureServiceSchema(env) {
  if (!env.DB) throw apiError('DB_NOT_CONFIGURED', 503);
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_service_messages (
      business_date TEXT NOT NULL,
      receipt_no TEXT NOT NULL,
      reserve_id TEXT NOT NULL,
      wait_type_id TEXT NOT NULL,
      request_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      last_error TEXT NOT NULL DEFAULT '',
      last_http_status INTEGER NOT NULL DEFAULT 0,
      notification_token TEXT NOT NULL DEFAULT '',
      expires_at INTEGER NOT NULL DEFAULT 0,
      remaining_count INTEGER NOT NULL DEFAULT 0,
      session_id TEXT NOT NULL DEFAULT '',
      notified_at INTEGER NOT NULL DEFAULT 0,
      next_retry_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(business_date,reserve_id)
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v2_service_messages_receipt ON v2_service_messages(business_date,receipt_no)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v2_service_messages_pending ON v2_service_messages(business_date,status,notified_at,next_retry_at)'),
  ]);
}

async function getServiceRow(env, businessDate, reserveId) {
  return await env.DB.prepare('SELECT * FROM v2_service_messages WHERE business_date=? AND reserve_id=? LIMIT 1')
    .bind(businessDate, reserveId).first();
}

async function insertRegistrationState(env, x) {
  await env.DB.prepare(`INSERT OR IGNORE INTO v2_service_messages
    (business_date,receipt_no,reserve_id,wait_type_id,request_id,status,last_error,last_http_status,notification_token,expires_at,remaining_count,session_id,notified_at,next_retry_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,0,'',0,0,'',0,0,?,?)`)
    .bind(x.businessDate, x.receiptNo, x.reserveId, x.waitTypeId, x.requestId || '', x.status, x.lastError || '', x.now, x.now).run();
}

async function updateIssueFailure(env, businessDate, reserveId, status, e) {
  await env.DB.prepare('UPDATE v2_service_messages SET status=?,last_error=?,last_http_status=?,updated_at=? WHERE business_date=? AND reserve_id=?')
    .bind(status, safeError(e), Number(e?.status || 0), Date.now(), businessDate, reserveId).run();
}

async function setRowError(env, rec, status, message, httpStatus = 0, nextRetryAt = 0) {
  await env.DB.prepare(`UPDATE v2_service_messages SET status=?,last_error=?,last_http_status=?,next_retry_at=?,updated_at=?
    WHERE business_date=? AND reserve_id=?`)
    .bind(status, String(message || '').slice(0, 500), Number(httpStatus || 0), Number(nextRetryAt || 0), Date.now(), rec.business_date, rec.reserve_id).run();
}

function buildTemplateParams(env, vars) {
  const raw = String(env.SERVICE_MESSAGE_TEMPLATE_PARAMS_JSON || '{}').trim() || '{}';
  let obj;
  try { obj = JSON.parse(raw); } catch { throw apiError('SERVICE_MESSAGE_TEMPLATE_PARAMS_INVALID_JSON', 500); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw apiError('SERVICE_MESSAGE_TEMPLATE_PARAMS_NOT_OBJECT', 500);
  const out = {};
  for (const [key, value] of Object.entries(obj).slice(0, 30)) {
    let text = String(value ?? '');
    for (const [name, replacement] of Object.entries(vars)) text = text.split(`{{${name}}}`).join(String(replacement ?? ''));
    out[String(key).slice(0, 50)] = text.slice(0, 1000);
  }
  return out;
}

function normalizeTemplateName(v) {
  let s = String(v || '').trim();
  if (!s) return '';
  if (!/_(?:ja|en|zh-TW|th|id|ko)$/.test(s)) s += '_ja';
  return s.slice(0, 30);
}

function publicRow(row) {
  return {
    ok: true, found: true, version: SM.VERSION,
    businessDate: String(row.business_date || ''), receiptNo: String(row.receipt_no || ''), reserveId: String(row.reserve_id || ''),
    waitTypeId: String(row.wait_type_id || ''), status: String(row.status || ''), error: String(row.last_error || ''),
    lastHttpStatus: Number(row.last_http_status || 0), remainingCount: Number(row.remaining_count || 0),
    expiresAt: Number(row.expires_at || 0), notifiedAt: Number(row.notified_at || 0), nextRetryAt: Number(row.next_retry_at || 0),
  };
}

function jstDate(epoch = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: SM.TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(epoch)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function ticketKey(v) { return String(v || '').normalize('NFKC').toUpperCase().replace(/[\s\-ー]/g, ''); }
function ticketDigits(v) { return ticketKey(v).replace(/\D/g, ''); }
function sameTicket(a, b) { const x=ticketKey(a),y=ticketKey(b);if(!x||!y)return false;if(x===y)return true;const xd=ticketDigits(x),yd=ticketDigits(y);return /^[A-Z]/.test(x)&&xd&&yd&&xd===yd; }
function normalizeWaitType(v) { const s=String(v||'').trim();return /^\d{4}$/.test(s)?s:''; }
function normalizeReceipt(v) { const m=String(v??'').normalize('NFKC').trim().toUpperCase().match(/^[FT]?(\d{1,12})$/);return m?m[1].replace(/^0+(?=\d)/,''):''; }
function normalizeReserveId(v) { const s=String(v??'').normalize('NFKC').trim();return /^\d{1,12}$/.test(s)?s.padStart(12,'0'):''; }
function normalizeRequestId(v) { const s=String(v||'').trim();return /^[A-Za-z0-9_-]{8,120}$/.test(s)?s:''; }
function normalizeDate(v) { const s=String(v||'').trim().replace(/\//g,'-'),m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return'';const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(Date.UTC(y,mo-1,d,12));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d)return'';return`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function safeApiText(text) { return String(text || '').replace(/[\r\n\t]+/g,' ').replace(/"(?:access_token|notificationToken|liffAccessToken|client_secret)"\s*:\s*"[^"]*"/gi,'"[REDACTED]"').slice(0,300); }
function safeError(e) { return String(e?.message || e || 'UNKNOWN_ERROR').replace(/[\r\n\t]+/g,' ').slice(0,500); }
function apiError(message,status=500,ambiguous=false){const e=new Error(String(message||'UNKNOWN_ERROR'));e.status=status;e.ambiguous=Boolean(ambiguous);return e;}
