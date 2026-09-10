/**
 * ASOBooN PURPLE Cloudflare Gateway v0.3.0
 * Purple staging only. Do not use as production without E2E verification.
 *
 * Bindings / secrets:
 *   DB                                 D1 binding
 *   AIRWAIT_API_KEY                    Secret
 *   PURPLE_LINE_MINIAPP_CHANNEL_SECRET Secret
 *
 * Public identifiers:
 *   AirWAIT storeId: KR01205179
 *   LINE MINI App developing channel: 2011467470
 *   LIFF: 2011467470-Gk5C3lWf
 *   Service message template: yourturn_s_w_ja
 */

const CFG = Object.freeze({
  VERSION: '2.1.cf03',
  STORE_ID: 'KR01205179',
  LINE_CHANNEL_ID: '2011467470',
  LIFF_BASE: 'https://miniapp.line.me/2011467470-Gk5C3lWf/',
  TEMPLATE_NAME: 'yourturn_s_w_ja',
  ALLOWED_ORIGIN: 'https://asoboon.github.io',
  AIR_LAST: 'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless',
  AIR_RESERVATIONS: 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  AIR_WAIT_TYPES: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/wait/type/get',
  AIR_CREATE: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',
  LINE_OAUTH: 'https://api.line.me/oauth2/v3/token',
  LINE_NOTIFIER_TOKEN: 'https://api.line.me/message/v3/notifier/token',
  LINE_NOTIFIER_SEND: 'https://api.line.me/message/v3/notifier/send?target=service',
  REQUEST_TTL_SEC: 600,
  SEND_RETRY_MAX: 3,
});

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return corsPreflight(request);

    try {
      const url = new URL(request.url);
      if (request.method === 'GET') {
        const action = String(url.searchParams.get('action') || 'health');
        let result;
        if (action === 'health') result = await health(env);
        else if (action === 'waitTypes') result = await waitTypes(env);
        else if (action === 'snapshot') result = await snapshot(env);
        else if (action === 'requestStatus') result = await requestStatus(env, url.searchParams.get('requestId'));
        else if (action === 'reservationStatus') result = await reservationStatus(env, url.searchParams);
        else if (action === 'callInfo') result = await callInfo(env, url.searchParams);
        else if (action === 'workerOnce') result = await workerOnce(env, { manual: true });
        else result = { ok: false, error: 'UNKNOWN_ACTION', version: CFG.VERSION };
        return output(request, result, url.searchParams.get('callback'));
      }

      if (request.method === 'POST') {
        enforcePurpleOrigin(request);
        const p = await readBody(request);
        const action = String(p.action || '');
        const requestId = normalizeRequestId(p.requestId) || makeRequestId();
        p.requestId = requestId;

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
        await cacheRequestResult(env, requestId, action, result);
        return output(request, result, null);
      }

      return output(request, { ok: false, error: 'METHOD_NOT_ALLOWED', version: CFG.VERSION }, null, 405);
    } catch (e) {
      return output(request, { ok: false, error: safeError(e), version: CFG.VERSION }, null, Number(e?.status || 500));
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(workerOnce(env, { manual: false }).catch(err => {
      console.error('purple worker failed', safeError(err));
    }));
  },
};

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = origin === CFG.ALLOWED_ORIGIN ? origin : CFG.ALLOWED_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  };
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

async function health(env) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('notification_bindings','airwait_snapshot','request_results','system_state')"
  ).first();
  const tableCount = Number(row?.n || 0);
  return {
    ok: tableCount === 4 && Boolean(env.AIRWAIT_API_KEY) && Boolean(env.PURPLE_LINE_MINIAPP_CHANNEL_SECRET),
    service: 'ASOBooN PURPLE Gateway',
    version: CFG.VERSION,
    storageConfigured: tableCount === 4,
    spreadsheetConfigured: tableCount === 4,
    airwaitKeyConfigured: Boolean(env.AIRWAIT_API_KEY),
    channelSecretConfigured: Boolean(env.PURPLE_LINE_MINIAPP_CHANNEL_SECRET),
    templateConfigured: true,
    enabled: true,
    workerEnabled: true,
    testMode: true,
    expectedTables: 4,
    foundTables: tableCount,
  };
}

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
      'Origin': CFG.ALLOWED_ORIGIN,
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
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && String(v) !== '').map(([k, v]) => [k, String(v)])),
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
        'Origin': CFG.ALLOWED_ORIGIN,
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
    const err = apiError('AIRWAIT_CREATE_NETWORK_AMBIGUOUS_MANUAL_REVIEW', 502, true);
    err.cause = e;
    throw err;
  }

  const text = await res.text();
  let d;
  try { d = JSON.parse(text); }
  catch {
    throw apiError('AIRWAIT_CREATE_2XX_PARSE_AMBIGUOUS_MANUAL_REVIEW', res.status || 502, true);
  }

  if (!res.ok) throw apiError(`AIRWAIT_CREATE_HTTP_${res.status}`, res.status, res.status >= 500);
  if (d?.success !== true || d?.resultCode?.code !== '0000') {
    throw apiError(`AIRWAIT_CREATE_ERROR RC_${d?.resultCode?.code || 'NONE'}`, 400, false);
  }

  const dto = d?.innerDto || {};
  const reserveId = normalizeReserveId(dto.reserveId);
  const receiptNo = normalizeReceipt(dto.receiptNo);
  if (!reserveId || !receiptNo) throw apiError('AIRWAIT_CREATE_200_RESULT_AMBIGUOUS_MANUAL_REVIEW', 502, true);

  return {
    ok: true,
    stored: true,
    version: CFG.VERSION,
    reserveId,
    receiptNo,
    shortUrl: String(dto.shortUrl || ''),
    businessDate: businessDateJst(),
    operationalDate: businessDateJst(),
  };
}

async function refreshSnapshot(env, marker) {
  const businessDate = businessDateJst();
  const rows = (await allReservations(env, { isEnabledStatus: '1' })).map(r => ({
    number: normalizeReceipt(r?.number ?? r?.receiptNo),
    waitTypeId: normalizeWaitType(r?.waitTypeId),
    waitTypeName: String(r?.waitTypeName || ''),
    status: String(r?.status ?? ''),
    isCalling: callFlag(r?.isCalling) ? 1 : 0,
  })).filter(r => r.number && r.waitTypeId);

  const now = Date.now();
  await env.DB.prepare('DELETE FROM airwait_snapshot WHERE business_date = ?').bind(businessDate).run();
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50).map(r => env.DB.prepare(
      `INSERT INTO airwait_snapshot
       (business_date,wait_type_id,receipt_no,reserve_id,wait_type_name,status,is_calling,first_seen_at,last_seen_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(businessDate, r.waitTypeId, r.number, null, r.waitTypeName, r.status, r.isCalling, now, now));
    if (batch.length) await env.DB.batch(batch);
  }
  await setSystemState(env, 'airwait_last_marker', marker);
  await setSystemState(env, 'airwait_snapshot_updated_at', String(now));
  return rows;
}

async function readSnapshot(env) {
  const businessDate = businessDateJst();
  const { results } = await env.DB.prepare(
    `SELECT receipt_no AS number, wait_type_id AS waitTypeId, wait_type_name AS waitTypeName,
            status, CAST(is_calling AS TEXT) AS isCalling
     FROM airwait_snapshot WHERE business_date = ? ORDER BY CAST(receipt_no AS INTEGER) ASC`
  ).bind(businessDate).all();
  return results || [];
}

async function snapshot(env) {
  let marker = await getSystemState(env, 'airwait_last_marker');
  let rows = await readSnapshot(env);
  if (!rows.length) {
    const latest = await airGetLast(env);
    marker = latest.marker;
    rows = await refreshSnapshot(env, marker);
  }
  return {
    ok: true,
    version: CFG.VERSION,
    businessDate: businessDateJst(),
    serverNow: new Date().toISOString(),
    marker: marker || '',
    changed: false,
    rows: rows.map(r => ({ ...r, isCalling: callFlag(r.isCalling) ? '1' : '0' })),
  };
}

async function reservationStatus(env, p) {
  const businessDate = normalizeDate(p.get('businessDate') || p.get('day') || p.get('date')) || businessDateJst();
  const receiptNo = normalizeReceipt(p.get('receiptNo') || p.get('number'));
  const waitTypeId = normalizeWaitType(p.get('waitTypeId'));
  const reserveId = normalizeReserveId(p.get('reserveId'));
  let row = null;
  if (reserveId) {
    row = await env.DB.prepare('SELECT * FROM notification_bindings WHERE business_date=? AND reserve_id=? ORDER BY updated_at DESC LIMIT 1')
      .bind(businessDate, reserveId).first();
  }
  if (!row && receiptNo && waitTypeId) {
    row = await env.DB.prepare('SELECT * FROM notification_bindings WHERE business_date=? AND receipt_no=? AND wait_type_id=? LIMIT 1')
      .bind(businessDate, receiptNo, waitTypeId).first();
  }
  return row ? publicBinding(row, true) : { ok: true, found: false, version: CFG.VERSION };
}

async function callInfo(env, p) {
  const businessDate = normalizeDate(p.get('businessDate') || p.get('day') || p.get('date')) || businessDateJst();
  const receiptNo = normalizeReceipt(p.get('receiptNo') || p.get('number'));
  const waitTypeId = normalizeWaitType(p.get('waitTypeId'));
  if (!receiptNo || !waitTypeId) return { ok: false, error: 'VALIDATION_ERROR', version: CFG.VERSION };
  const row = await env.DB.prepare(
    'SELECT is_calling,last_seen_at FROM airwait_snapshot WHERE business_date=? AND receipt_no=? AND wait_type_id=? LIMIT 1'
  ).bind(businessDate, receiptNo, waitTypeId).first();
  if (!row || !callFlag(row.is_calling)) return { ok: true, found: false, version: CFG.VERSION };
  return {
    ok: true,
    found: true,
    version: CFG.VERSION,
    firstSeenAt: new Date(Number(row.last_seen_at || Date.now())).toISOString(),
    lastSeenAt: new Date(Number(row.last_seen_at || Date.now())).toISOString(),
  };
}

async function lineChannelToken(env) {
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
  return String(d.access_token);
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

  if (!receiptNo || !waitTypeId || !businessDate || (bindingMode === 'onsite' && !reserveId)) throw apiError('VALIDATION_ERROR', 400, false);
  if (businessDate !== businessDateJst()) throw apiError('AIRWAIT_BUSINESS_DATE_MISMATCH', 400, false);
  if (liffAccessToken.length < 20) throw apiError('LIFF_ACCESS_TOKEN_REQUIRED', 400, false);

  const live = await findLiveReservation(env, receiptNo, waitTypeId);
  if (!live) throw apiError('AIRWAIT_RESERVATION_NOT_VERIFIED', 404, false);
  if (String(live.status || '') !== '0') throw apiError('AIRWAIT_RESERVATION_NOT_WAITING', 409, false);

  const existing = await env.DB.prepare(
    'SELECT * FROM notification_bindings WHERE business_date=? AND wait_type_id=? AND receipt_no=? LIMIT 1'
  ).bind(businessDate, waitTypeId, receiptNo).first();

  if (existing?.notification_token) {
    if (Number(existing.notification_token_expires_at || 0) <= Date.now()) throw apiError('SERVICE_NOTIFICATION_TOKEN_EXPIRED_NEW_ACTION_REQUIRED', 409, false);
    if (Number(existing.remaining_count || 0) <= 0) throw apiError('SERVICE_NOTIFICATION_TOKEN_EXHAUSTED_NEW_ACTION_REQUIRED', 409, false);
    return publicBinding(existing, true);
  }
  if (existing && ['TOKEN_ISSUE_PENDING', 'TOKEN_ISSUE_AMBIGUOUS'].includes(String(existing.state || ''))) {
    throw apiError('TOKEN_ISSUE_REQUIRES_MANUAL_REVIEW', 409, false);
  }

  const tokenHash = await sha256Hex(liffAccessToken);
  const used = await env.DB.prepare('SELECT binding_id FROM notification_bindings WHERE liff_token_hash=? LIMIT 1').bind(tokenHash).first();
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
    throw apiError('NOTIFIER_TOKEN_NETWORK_AMBIGUOUS', 502, true);
  }

  const text = await res.text();
  if (!res.ok) {
    const ambiguous = res.status >= 500;
    await markTokenIssueFailure(env, bindingId, ambiguous ? 'TOKEN_ISSUE_AMBIGUOUS' : 'TOKEN_ISSUE_ERROR', `NOTIFIER_TOKEN_HTTP_${res.status}`, res.status);
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
    `UPDATE notification_bindings SET notification_token=?,notification_token_expires_at=?,remaining_count=?,session_id=?,
     state=?,send_state='WAITING',last_error='',last_http_status=200,updated_at=? WHERE binding_id=?`
  ).bind(
    String(d.notificationToken), expiresAt, remainingCount, String(d.sessionId || ''),
    remainingCount > 0 && expiresAt > Date.now() ? 'TOKEN_READY' : (remainingCount <= 0 ? 'TOKEN_EXHAUSTED' : 'TOKEN_EXPIRED'),
    Date.now(), bindingId
  ).run();

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
  return {
    turn: `受付番号${String(rec.receipt_no || '')}番`,
    btn1_url: callstatusUrl,
    btn2_url: callstatusUrl,
    btn3_url: callstatusUrl,
    btn4_url: callstatusUrl,
  };
}

async function sendServiceMessage(env, rec) {
  const now = Date.now();
  const claim = await env.DB.prepare(
    `UPDATE notification_bindings SET send_state='SENDING',send_claimed_at=?,updated_at=?
     WHERE binding_id=? AND send_state IN ('WAITING','READY','RETRY') AND notification_token<>''
       AND remaining_count>0 AND notification_token_expires_at>?`
  ).bind(now, now, rec.binding_id, now).run();
  if (!Number(claim?.meta?.changes || 0)) return { sent: false, skipped: true };

  let channelToken;
  try {
    channelToken = await lineChannelToken(env);
  } catch (e) {
    await env.DB.prepare(
      `UPDATE notification_bindings SET send_state='RETRY',retry_count=retry_count+1,next_retry_at=?,last_error=?,updated_at=? WHERE binding_id=?`
    ).bind(Date.now() + 60000, safeError(e), Date.now(), rec.binding_id).run();
    return { sent: false, retry: true };
  }

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
    return { sent: false, ambiguous: true };
  }

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429) {
      const retryCount = Number(rec.retry_count || 0) + 1;
      const retry = retryCount <= CFG.SEND_RETRY_MAX;
      await env.DB.prepare(
        `UPDATE notification_bindings SET send_state=?,retry_count=?,next_retry_at=?,last_http_status=?,last_error=?,updated_at=? WHERE binding_id=?`
      ).bind(retry ? 'RETRY' : 'ERROR', retryCount, retry ? Date.now() + Math.min(300000, 60000 * retryCount) : null,
        res.status, `NOTIFIER_SEND_HTTP_${res.status}`, Date.now(), rec.binding_id).run();
      return { sent: false, retry };
    }
    if (res.status >= 500) {
      await env.DB.prepare(
        `UPDATE notification_bindings SET send_state='AMBIGUOUS',last_http_status=?,last_error=?,updated_at=? WHERE binding_id=?`
      ).bind(res.status, `NOTIFIER_SEND_HTTP_${res.status}_AMBIGUOUS`, Date.now(), rec.binding_id).run();
      return { sent: false, ambiguous: true };
    }
    await env.DB.prepare(
      `UPDATE notification_bindings SET send_state='ERROR',last_http_status=?,last_error=?,updated_at=? WHERE binding_id=?`
    ).bind(res.status, `NOTIFIER_SEND_HTTP_${res.status}`, Date.now(), rec.binding_id).run();
    return { sent: false, error: true };
  }

  let d;
  try { d = JSON.parse(text); }
  catch {
    await env.DB.prepare(
      `UPDATE notification_bindings SET send_state='AMBIGUOUS',last_http_status=200,last_error='NOTIFIER_SEND_200_PARSE_AMBIGUOUS',updated_at=? WHERE binding_id=?`
    ).bind(Date.now(), rec.binding_id).run();
    return { sent: false, ambiguous: true };
  }

  const expiresAt = Date.now() + Math.max(0, Number(d.expiresIn || 0)) * 1000;
  const remainingCount = Number(d.remainingCount || 0);
  await env.DB.prepare(
    `UPDATE notification_bindings SET notification_token=?,notification_token_expires_at=?,remaining_count=?,session_id=?,
     state=?,send_state='SENT',last_sent_at=?,last_http_status=200,retry_count=0,next_retry_at=NULL,last_error='',updated_at=?
     WHERE binding_id=?`
  ).bind(
    String(d.notificationToken || rec.notification_token || ''), expiresAt, remainingCount, String(d.sessionId || rec.session_id || ''),
    remainingCount <= 0 ? 'TOKEN_EXHAUSTED' : (expiresAt <= Date.now() ? 'TOKEN_EXPIRED' : 'TOKEN_READY'),
    Date.now(), Date.now(), rec.binding_id
  ).run();
  return { sent: true };
}

async function workerOnce(env, opts = {}) {
  const latest = await airGetLast(env);
  const previous = await getSystemState(env, 'airwait_last_marker');
  let rows = await readSnapshot(env);
  const changed = !previous || latest.marker !== previous || !rows.length;
  if (changed) rows = await refreshSnapshot(env, latest.marker);

  const businessDate = businessDateJst();
  const now = Date.now();
  const { results: candidates } = await env.DB.prepare(
    `SELECT b.* FROM notification_bindings b
     JOIN airwait_snapshot s
       ON s.business_date=b.business_date AND s.wait_type_id=b.wait_type_id AND s.receipt_no=b.receipt_no
     WHERE b.business_date=? AND b.notification_token<>'' AND b.remaining_count>0
       AND b.notification_token_expires_at>?
       AND s.status='0' AND s.is_calling=1
       AND b.send_state IN ('WAITING','READY','RETRY')
       AND (b.next_retry_at IS NULL OR b.next_retry_at<=?)`
  ).bind(businessDate, now, now).all();

  let sent = 0, ambiguous = 0, errors = 0, retried = 0;
  for (const rec of candidates || []) {
    if (!rec.call_detected_at) {
      await env.DB.prepare(
        `UPDATE notification_bindings SET call_detected_at=?,send_state=CASE WHEN send_state='WAITING' THEN 'READY' ELSE send_state END,updated_at=? WHERE binding_id=?`
      ).bind(Date.now(), Date.now(), rec.binding_id).run();
      rec.call_detected_at = Date.now();
      if (rec.send_state === 'WAITING') rec.send_state = 'READY';
    }
    const r = await sendServiceMessage(env, rec);
    if (r.sent) sent++;
    else if (r.ambiguous) ambiguous++;
    else if (r.retry) retried++;
    else if (r.error) errors++;
  }

  await setSystemState(env, 'worker_last_run_at', String(Date.now()));
  await setSystemState(env, 'worker_last_result', JSON.stringify({ changed, candidates: (candidates || []).length, sent, ambiguous, retried, errors }));
  return {
    ok: true,
    version: CFG.VERSION,
    manual: Boolean(opts.manual),
    markerChanged: changed,
    snapshotRows: rows.length,
    candidates: (candidates || []).length,
    sent,
    ambiguous,
    retried,
    errors,
    message: sent ? 'SERVICE_MESSAGE_SENT' : 'NO_MESSAGE_SENT',
  };
}

async function cacheRequestResult(env, requestId, action, result) {
  const now = Date.now();
  const expires = now + CFG.REQUEST_TTL_SEC * 1000;
  await env.DB.prepare(
    `INSERT INTO request_results(request_id,action,state,http_status,ambiguous,result_json,error,created_at,updated_at,expires_at)
     VALUES(?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(request_id) DO UPDATE SET state=excluded.state,http_status=excluded.http_status,ambiguous=excluded.ambiguous,
       result_json=excluded.result_json,error=excluded.error,updated_at=excluded.updated_at,expires_at=excluded.expires_at`
  ).bind(requestId, action || '', result?.ok ? 'DONE' : 'ERROR', null, result?.ambiguous ? 1 : 0,
    JSON.stringify(result || {}), String(result?.error || ''), now, now, expires).run();
  await env.DB.prepare('DELETE FROM request_results WHERE expires_at < ?').bind(now).run();
}

async function requestStatus(env, requestId) {
  const id = normalizeRequestId(requestId);
  if (!id) return { ok: false, found: false, error: 'REQUEST_ID_REQUIRED', version: CFG.VERSION };
  const row = await env.DB.prepare('SELECT result_json FROM request_results WHERE request_id=? AND expires_at>? LIMIT 1')
    .bind(id, Date.now()).first();
  if (!row) return { ok: true, found: false, version: CFG.VERSION };
  try { return { found: true, ...JSON.parse(String(row.result_json || '{}')) }; }
  catch { return { ok: false, found: false, error: 'REQUEST_CACHE_INVALID', version: CFG.VERSION }; }
}

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

function publicBinding(row, alreadyIssued) {
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
    status: String(row.state || ''),
    sendState: String(row.send_state || ''),
    remainingCount: Number(row.remaining_count || 0),
    expiresAt: isoOrEmpty(row.notification_token_expires_at),
    lastSentAt: isoOrEmpty(row.last_sent_at),
    retryCount: Number(row.retry_count || 0),
    error: String(row.last_error || ''),
  };
}

function normalizeReceipt(v) {
  const s = String(v ?? '').normalize('NFKC').trim();
  return /^\d{1,12}$/.test(s) ? s.replace(/^0+(?=\d)/, '') : '';
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
  return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function businessDateJst() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}

function intInRange(v, min, max) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
}

function callFlag(v) {
  return v === 1 || v === true || String(v) === '1' || String(v).toLowerCase() === 'true';
}

function normalizeRequestId(v) {
  const s = String(v ?? '').trim();
  return /^[A-Za-z0-9._:-]{8,120}$/.test(s) ? s : '';
}

function makeRequestId() {
  return `cf_${crypto.randomUUID()}`;
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseJson(text, label) {
  try { return JSON.parse(String(text || '')); }
  catch { throw apiError(label, 502, false); }
}

function isoOrEmpty(v) {
  const n = Number(v || 0);
  return n > 0 ? new Date(n).toISOString() : '';
}

function apiError(message, status = 500, ambiguous = false) {
  const e = new Error(message);
  e.status = status;
  e.ambiguous = ambiguous;
  return e;
}

function safeError(e) {
  return String(e?.message || e || 'UNKNOWN_ERROR').replace(/[\r\n\t]+/g, ' ').slice(0, 500);
}
