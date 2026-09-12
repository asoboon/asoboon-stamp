/**
 * ASOBooN MINI App v2 - Developing-only LINE Service Message bridge.
 * Notification readiness is mandatory BEFORE AirWAIT create.
 * This module is loaded only by the official Developing Worker wrapper.
 */
const SM = Object.freeze({
  VERSION: '2.2.dev5',
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
  EXTERNAL_TIMEOUT_MS: 8 * 1000,
  CRON_SCAN_LIMIT: 1200,
});

let schemaReady = null;
let channelTokenCache = { token:'', expiresAt:0 };
let channelTokenInflight = null;

export async function serviceHealth(env) {
  await ensureServiceSchema(env);
  const secretReady = Boolean(String(env.LINE_MINIAPP_CHANNEL_SECRET || '').trim());
  const templateReady = Boolean(normalizeTemplateName(env.SERVICE_MESSAGE_TEMPLATE_NAME));
  const paramsReady = templateParamsValid(env.SERVICE_MESSAGE_TEMPLATE_PARAMS_JSON);
  return {
    serviceMessageEnabled: true,
    serviceMessageVersion: SM.VERSION,
    serviceMessageChannelId: SM.CHANNEL_ID,
    serviceMessageChannelSecretConfigured: secretReady,
    serviceMessageTemplateConfigured: templateReady,
    serviceMessageTemplateParamsConfigured: paramsReady,
    serviceMessageReady: secretReady && templateReady && paramsReady,
    serviceMessageMandatoryBeforeCreate: true,
    serviceMessageCronEnabled: true,
    serviceMessageImmediateObservationEnabled: true,
    serviceMessageReusableUnboundToken: true,
  };
}

export async function prepareReservationNotification(env, p) {
  await ensureServiceSchema(env);
  assertServiceConfig(env);

  const requestId = normalizeRequestId(p?.requestId);
  const businessDate = normalizeDate(p?.operationalDate);
  const waitTypeId = normalizeWaitType(p?.waitTypeId);
  const liffAccessToken = String(p?.liffAccessToken || '').trim();
  if (!requestId || !businessDate || !waitTypeId) throw apiError('SERVICE_PREPARE_DATA_INVALID', 400);
  if (liffAccessToken.length < 20) throw apiError('LIFF_ACCESS_TOKEN_REQUIRED_FOR_NOTIFICATION', 401);

  const tokenHash = await sha256Hex(liffAccessToken);
  const usage = await env.DB.prepare('SELECT request_id,status,created_at,updated_at FROM v2_service_liff_token_usage WHERE token_hash=? LIMIT 1').bind(tokenHash).first();
  if (usage && String(usage.request_id || '') !== requestId) {
    const adopted = await adoptReusableNotificationClaim(env, tokenHash, usage, requestId, businessDate, waitTypeId);
    if (adopted) return publicClaim(adopted, true);
    throw apiError('LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP', 409, true);
  }
  if (!usage) {
    const now = Date.now();
    const claimed = await env.DB.prepare(`INSERT OR IGNORE INTO v2_service_liff_token_usage
      (token_hash,request_id,status,created_at,updated_at) VALUES(?,?,'CLAIMED',?,?)`)
      .bind(tokenHash, requestId, now, now).run();
    if (Number(claimed?.meta?.changes || 0) !== 1) {
      const raced = await env.DB.prepare('SELECT request_id,status FROM v2_service_liff_token_usage WHERE token_hash=? LIMIT 1').bind(tokenHash).first();
      if (!raced || String(raced.request_id || '') !== requestId) throw apiError('LIFF_NOTIFICATION_TOKEN_ALREADY_CLAIMED_REOPEN_MINIAPP', 409, true);
    }
  }

  const existing = await getTokenClaim(env, requestId);
  if (existing) {
    if (String(existing.status) === 'TOKEN_READY' && existing.notification_token) return publicClaim(existing, true);
    if (String(existing.status) === 'TOKEN_ISSUE_PENDING') throw apiError('SERVICE_TOKEN_PREPARING', 409, true);
    if (String(existing.status) === 'TOKEN_ISSUE_AMBIGUOUS') throw apiError('SERVICE_TOKEN_ISSUE_AMBIGUOUS', 409, true);
    throw apiError(String(existing.last_error || existing.status || 'SERVICE_TOKEN_NOT_READY'), Number(existing.last_http_status || 503));
  }

  const now = Date.now();
  const insert = await env.DB.prepare(`INSERT OR IGNORE INTO v2_service_token_claims
    (request_id,business_date,wait_type_id,status,last_error,last_http_status,notification_token,expires_at,remaining_count,session_id,created_at,updated_at)
    VALUES(?,?,?,'TOKEN_ISSUE_PENDING','',0,'',0,0,'',?,?)`)
    .bind(requestId, businessDate, waitTypeId, now, now).run();
  if (Number(insert?.meta?.changes || 0) !== 1) {
    const raced = await getTokenClaim(env, requestId);
    if (raced?.status === 'TOKEN_READY' && raced.notification_token) return publicClaim(raced, true);
    throw apiError('SERVICE_TOKEN_PREPARING', 409, true);
  }

  let channelToken;
  try {
    channelToken = await issueChannelToken(env);
  } catch (e) {
    await setClaimError(env, requestId, 'CHANNEL_TOKEN_ERROR', e);
    await releaseLiffUsage(env, tokenHash, requestId);
    throw e;
  }

  let response;
  try {
    response = await fetchWithTimeout(SM.NOTIFIER_TOKEN, {
      method: 'POST',
      headers: { Authorization: `Bearer ${channelToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ liffAccessToken }),
    }, SM.EXTERNAL_TIMEOUT_MS);
  } catch (e) {
    const err = apiError(`NOTIFIER_TOKEN_NETWORK ${safeError(e)}`, 503, true);
    await setClaimError(env, requestId, 'TOKEN_ISSUE_AMBIGUOUS', err);
    throw err;
  }

  const text = await response.text();
  if (!response.ok) {
    const ambiguous = response.status >= 500;
    const err = apiError(`NOTIFIER_TOKEN_HTTP_${response.status} ${safeApiText(text)}`, response.status, ambiguous);
    await setClaimError(env, requestId, ambiguous ? 'TOKEN_ISSUE_AMBIGUOUS' : 'TOKEN_ISSUE_ERROR', err);
    if (!ambiguous) await releaseLiffUsage(env, tokenHash, requestId);
    throw err;
  }

  let data;
  try { data = JSON.parse(text); }
  catch {
    const err = apiError('NOTIFIER_TOKEN_200_INVALID_JSON', 502, true);
    await setClaimError(env, requestId, 'TOKEN_ISSUE_AMBIGUOUS', err);
    throw err;
  }

  const notificationToken = String(data?.notificationToken || '').trim();
  const remainingCount = Number(data?.remainingCount || 0);
  const expiresIn = Number(data?.expiresIn || 0);
  if (!notificationToken || remainingCount <= 0 || expiresIn <= 0) {
    const err = apiError('NOTIFIER_TOKEN_200_NOT_SENDABLE', 502, true);
    await setClaimError(env, requestId, 'TOKEN_ISSUE_AMBIGUOUS', err);
    throw err;
  }

  await env.DB.batch([
    env.DB.prepare(`UPDATE v2_service_token_claims SET
      status='TOKEN_READY',last_error='',last_http_status=200,notification_token=?,expires_at=?,remaining_count=?,session_id=?,updated_at=?
      WHERE request_id=? AND status='TOKEN_ISSUE_PENDING'`)
      .bind(notificationToken, now + expiresIn * 1000, remainingCount, String(data?.sessionId || ''), Date.now(), requestId),
    env.DB.prepare("UPDATE v2_service_liff_token_usage SET status='TOKEN_READY',updated_at=? WHERE token_hash=? AND request_id=?")
      .bind(Date.now(), tokenHash, requestId),
  ]);

  const ready = await getTokenClaim(env, requestId);
  if (!ready?.notification_token) throw apiError('SERVICE_TOKEN_STORE_FAILED', 503, true);
  return publicClaim(ready, false);
}

export async function finalizeReservationNotification(env, p, result) {
  await ensureServiceSchema(env);
  const requestId = normalizeRequestId(p?.requestId);
  const businessDate = normalizeDate(result?.businessDate || result?.operationalDate || p?.operationalDate);
  const receiptNo = normalizeReceipt(result?.receiptNo);
  const reserveId = normalizeReserveId(result?.reserveId);
  const waitTypeId = normalizeWaitType(result?.waitTypeId || p?.waitTypeId);
  if (!requestId || !businessDate || !receiptNo || !reserveId || !waitTypeId) throw apiError('SERVICE_FINALIZE_DATA_INVALID', 500);
  const claim = await getTokenClaim(env, requestId);
  if (!claim || claim.status !== 'TOKEN_READY' || !claim.notification_token) throw apiError('SERVICE_TOKEN_CLAIM_NOT_READY', 500, true);

  await bindClaimToReservation(env, claim, { businessDate, receiptNo, reserveId, waitTypeId, requestId });
  return { ok: true, ready: true, status: 'TOKEN_READY', remainingCount: Number(claim.remaining_count || 0), version: SM.VERSION };
}

export async function serviceStatus(env, params) {
  await ensureServiceSchema(env);
  const businessDate = normalizeDate(params?.businessDate || params?.date);
  const receiptNo = normalizeReceipt(params?.receiptNo || params?.number);
  if (!businessDate || !receiptNo) return { ok:false, found:false, error:'VALIDATION_ERROR', version:SM.VERSION };
  const row = await env.DB.prepare(`SELECT business_date,receipt_no,reserve_id,wait_type_id,status,last_error,last_http_status,
    remaining_count,expires_at,notified_at,next_retry_at,created_at,updated_at
    FROM v2_service_messages WHERE business_date=? AND receipt_no=? ORDER BY updated_at DESC LIMIT 1`)
    .bind(businessDate, receiptNo).first();
  if (!row) return { ok:true, found:false, version:SM.VERSION };
  return publicRow(row);
}

export async function sendObservedCallNotification(env, observation) {
  await ensureServiceSchema(env);
  const businessDate = normalizeDate(observation?.businessDate);
  const receiptNo = normalizeReceipt(observation?.receiptNo);
  const observedWaitType = normalizeWaitType(observation?.waitTypeId);
  const calling = observation?.isCalling === true || String(observation?.isCalling || '') === '1';
  if (!businessDate || !receiptNo || String(observation?.status || '') !== '0' || !calling) {
    return { ok:true, sent:false, reason:'NOT_CALLING', version:SM.VERSION };
  }

  let rec = await env.DB.prepare(`SELECT * FROM v2_service_messages
    WHERE business_date=? AND receipt_no=? AND notified_at=0
    ORDER BY updated_at DESC LIMIT 1`).bind(businessDate, receiptNo).first();

  if (!rec) {
    const pendingResult = await env.DB.prepare(`SELECT * FROM v2_service_messages
      WHERE business_date=? AND notified_at=0 AND notification_token<>''
      ORDER BY updated_at DESC LIMIT 500`).bind(businessDate).all();
    const candidates = (Array.isArray(pendingResult?.results) ? pendingResult.results : []).map(x => ({ ...x, number:x.receipt_no }));
    rec = selectTicketMatch(candidates, receiptNo).row;
  }
  if (!rec) return { ok:true, sent:false, reason:'SERVICE_ROW_NOT_FOUND', version:SM.VERSION };

  if (observedWaitType && String(rec.wait_type_id || '') !== observedWaitType) {
    await env.DB.prepare(`UPDATE v2_service_messages SET wait_type_id=?,updated_at=?
      WHERE business_date=? AND reserve_id=? AND notified_at=0`)
      .bind(observedWaitType, Date.now(), rec.business_date, rec.reserve_id).run();
    rec = { ...rec, wait_type_id:observedWaitType };
  }

  const result = await sendCallMessage(env, rec, {
    number:receiptNo,
    waitTypeId:observedWaitType || String(rec.wait_type_id || ''),
    waitTypeName:String(observation?.waitTypeName || ''),
    status:'0',
    isCalling:'1',
  });
  return { ok:true, ...result, version:SM.VERSION };
}

export async function runServiceMessageWorker(env) {
  await ensureServiceSchema(env);
  await reconcileConfirmedClaims(env);
  const now = Date.now();

  await env.DB.prepare(`UPDATE v2_service_messages SET status='CALL_SEND_AMBIGUOUS',
    last_error='stale CALL_SEND_PENDING; delivery outcome unknown',updated_at=?
    WHERE status='CALL_SEND_PENDING' AND updated_at<? AND notified_at=0`)
    .bind(now, now - SM.PENDING_STALE_MS).run();

  const rowsResult = await env.DB.prepare(`SELECT * FROM v2_service_messages
    WHERE business_date=? AND notified_at=0 AND notification_token<>''
      AND status IN ('TOKEN_READY','CALL_SEND_RETRY','TEMPLATE_NOT_CONFIGURED','CHANNEL_SECRET_MISSING')
      AND (next_retry_at=0 OR next_retry_at<=?)
    ORDER BY created_at ASC LIMIT ${SM.CRON_SCAN_LIMIT}`).bind(jstDate(now), now).all();
  const pending = Array.isArray(rowsResult?.results) ? rowsResult.results : [];
  if (!pending.length) return { ok:true, checked:0, sent:0, reconciled:true, version:SM.VERSION };
  assertServiceConfig(env);
  if (!env.AIRWAIT_API_KEY) throw apiError('AIRWAIT_KEY_NOT_CONFIGURED', 503);

  const byWaitType = new Map();
  for (const rec of pending) {
    const wt = normalizeWaitType(rec.wait_type_id);
    if (wt && !byWaitType.has(wt)) byWaitType.set(wt, await fetchAirwaitReservations(env, wt));
  }

  let allRows = null;
  let sent = 0;
  for (let rec of pending) {
    let match = selectTicketMatch(byWaitType.get(String(rec.wait_type_id)) || [], rec.receipt_no);
    if (!match.row && !match.ambiguous) {
      if (!allRows) allRows = await fetchAirwaitReservations(env, '');
      match = selectTicketMatch(allRows, rec.receipt_no);
      const correctedWaitType = normalizeWaitType(match.row?.waitTypeId);
      if (correctedWaitType && correctedWaitType !== String(rec.wait_type_id || '')) {
        await env.DB.prepare(`UPDATE v2_service_messages SET wait_type_id=?,updated_at=?
          WHERE business_date=? AND reserve_id=? AND notified_at=0`)
          .bind(correctedWaitType, Date.now(), rec.business_date, rec.reserve_id).run();
        rec = { ...rec, wait_type_id:correctedWaitType };
      }
    }

    const own = match.row;
    const retryEvidence = String(rec.status || '') === 'CALL_SEND_RETRY';
    const callingNow = Boolean(own && String(own.status || '') === '0' && String(own.isCalling || '0') === '1');
    if (!callingNow && !retryEvidence) continue;
    const result = await sendCallMessage(env, rec, own || { waitTypeName:'' });
    if (result.sent) sent += 1;
  }
  return { ok:true, checked:pending.length, sent, reconciled:true, version:SM.VERSION };
}

async function reconcileConfirmedClaims(env) {
  const r = await env.DB.prepare(`SELECT c.*,u.receipt_no,u.reserve_id,u.wait_type_id AS confirmed_wait_type
    FROM v2_service_token_claims c
    JOIN v2_user_day_claims u ON u.request_id=c.request_id AND u.business_date=c.business_date
    WHERE c.status='TOKEN_READY' AND c.notification_token<>'' AND u.state='CONFIRMED'
      AND u.receipt_no<>'' AND u.reserve_id<>'' LIMIT 1000`).all();
  for (const claim of (Array.isArray(r?.results) ? r.results : [])) {
    const receiptNo = normalizeReceipt(claim.receipt_no);
    const reserveId = normalizeReserveId(claim.reserve_id);
    const waitTypeId = normalizeWaitType(claim.confirmed_wait_type || claim.wait_type_id);
    if (!receiptNo || !reserveId || !waitTypeId) continue;
    await bindClaimToReservation(env, claim, {
      businessDate: String(claim.business_date), receiptNo, reserveId, waitTypeId, requestId: String(claim.request_id),
    });
  }
}

async function bindClaimToReservation(env, claim, x) {
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO v2_service_messages
    (business_date,receipt_no,reserve_id,wait_type_id,request_id,status,last_error,last_http_status,notification_token,expires_at,remaining_count,session_id,notified_at,next_retry_at,created_at,updated_at)
    VALUES(?,?,?,?,?,'TOKEN_READY','',200,?,?,?,?,0,0,?,?)
    ON CONFLICT(business_date,reserve_id) DO UPDATE SET
      receipt_no=excluded.receipt_no,wait_type_id=excluded.wait_type_id,request_id=excluded.request_id,
      notification_token=CASE WHEN v2_service_messages.notified_at=0 THEN excluded.notification_token ELSE v2_service_messages.notification_token END,
      expires_at=CASE WHEN v2_service_messages.notified_at=0 THEN excluded.expires_at ELSE v2_service_messages.expires_at END,
      remaining_count=CASE WHEN v2_service_messages.notified_at=0 THEN excluded.remaining_count ELSE v2_service_messages.remaining_count END,
      session_id=CASE WHEN v2_service_messages.notified_at=0 THEN excluded.session_id ELSE v2_service_messages.session_id END,
      updated_at=excluded.updated_at`)
    .bind(x.businessDate,x.receiptNo,x.reserveId,x.waitTypeId,x.requestId,String(claim.notification_token),
      Number(claim.expires_at||0),Number(claim.remaining_count||0),String(claim.session_id||''),now,now).run();
  await env.DB.batch([
    env.DB.prepare("UPDATE v2_service_liff_token_usage SET status='BOUND',updated_at=? WHERE request_id=?").bind(now, x.requestId),
    env.DB.prepare('DELETE FROM v2_service_token_claims WHERE request_id=?').bind(x.requestId),
  ]);
}

async function sendCallMessage(env, rec, airwaitRow) {
  assertServiceConfig(env);
  if (Number(rec.expires_at || 0) <= Date.now() || Number(rec.remaining_count || 0) <= 0) {
    await setRowError(env, rec, 'TOKEN_NOT_SENDABLE', 'SERVICE_NOTIFICATION_TOKEN_EXPIRED_OR_EXHAUSTED', 0);
    return { sent:false };
  }

  const claimed = await env.DB.prepare(`UPDATE v2_service_messages SET status='CALL_SEND_PENDING',last_error='',last_http_status=0,updated_at=?
    WHERE business_date=? AND reserve_id=? AND notified_at=0
      AND status IN ('TOKEN_READY','CALL_SEND_RETRY','TEMPLATE_NOT_CONFIGURED','CHANNEL_SECRET_MISSING')`)
    .bind(Date.now(), rec.business_date, rec.reserve_id).run();
  if (Number(claimed?.meta?.changes || 0) !== 1) return { sent:false };

  let channelToken;
  try { channelToken = await issueChannelToken(env); }
  catch (e) {
    await setRowError(env, rec, 'CALL_SEND_RETRY', safeError(e), Number(e?.status || 0), Date.now()+SM.RETRY_DELAY_MS);
    return { sent:false };
  }

  const params = buildTemplateParams(env, {
    receiptNo:rec.receipt_no,
    reserveId:rec.reserve_id,
    waitTypeId:rec.wait_type_id,
    waitTypeName:String(airwaitRow?.waitTypeName || ''),
    businessDate:rec.business_date,
    callstatusUrl:SM.CALLSTATUS_URL,
  });

  let response;
  try {
    response = await fetchWithTimeout(SM.NOTIFIER_SEND, {
      method:'POST',
      headers:{ Authorization:`Bearer ${channelToken}`,'Content-Type':'application/json',Accept:'application/json' },
      body:JSON.stringify({ templateName:normalizeTemplateName(env.SERVICE_MESSAGE_TEMPLATE_NAME), params, notificationToken:String(rec.notification_token) }),
    }, SM.EXTERNAL_TIMEOUT_MS);
  } catch (e) {
    await setRowError(env, rec, 'CALL_SEND_AMBIGUOUS', `NOTIFIER_SEND_NETWORK ${safeError(e)}`, 0);
    return { sent:false, ambiguous:true };
  }

  const text = await response.text();
  if (!response.ok) {
    if (response.status === 429) {
      await setRowError(env, rec, 'CALL_SEND_RETRY', `NOTIFIER_SEND_HTTP_429 ${safeApiText(text)}`, 429, Date.now()+SM.RETRY_DELAY_MS);
      return { sent:false };
    }
    const ambiguous = response.status >= 500;
    await setRowError(env, rec, ambiguous?'CALL_SEND_AMBIGUOUS':'CALL_SEND_ERROR', `NOTIFIER_SEND_HTTP_${response.status} ${safeApiText(text)}`, response.status);
    return { sent:false, ambiguous };
  }

  let data;
  try { data = JSON.parse(text); }
  catch {
    await setRowError(env, rec, 'CALL_SEND_AMBIGUOUS', 'NOTIFIER_SEND_200_INVALID_JSON', 200);
    return { sent:false, ambiguous:true };
  }
  const nextToken = String(data?.notificationToken || '').trim();
  const remainingCount = Number(data?.remainingCount || 0);
  const expiresIn = Number(data?.expiresIn || 0);
  await env.DB.prepare(`UPDATE v2_service_messages SET status='CALL_MESSAGE_SENT',last_error='',last_http_status=200,
    notification_token=?,remaining_count=?,expires_at=?,session_id=?,notified_at=?,next_retry_at=0,updated_at=?
    WHERE business_date=? AND reserve_id=?`)
    .bind(nextToken,remainingCount,expiresIn>0?Date.now()+expiresIn*1000:Number(rec.expires_at||0),
      String(data?.sessionId||rec.session_id||''),Date.now(),Date.now(),rec.business_date,rec.reserve_id).run();
  return { sent:true };
}

async function issueChannelToken(env) {
  const secret = String(env.LINE_MINIAPP_CHANNEL_SECRET || '').trim();
  if (!secret) throw apiError('LINE_MINIAPP_CHANNEL_SECRET_NOT_CONFIGURED', 503);
  const now = Date.now();
  if (channelTokenCache.token && channelTokenCache.expiresAt > now + 30_000) return channelTokenCache.token;
  if (channelTokenInflight) return await channelTokenInflight;
  channelTokenInflight = (async () => {
    const response = await fetchWithTimeout(SM.LINE_OAUTH, {
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
      body:new URLSearchParams({grant_type:'client_credentials',client_id:SM.CHANNEL_ID,client_secret:secret}),
    }, SM.EXTERNAL_TIMEOUT_MS);
    const text = await response.text();
    if (!response.ok) throw apiError(`CHANNEL_TOKEN_HTTP_${response.status} ${safeApiText(text)}`, response.status, response.status>=500);
    let data; try { data=JSON.parse(text); } catch { throw apiError('CHANNEL_TOKEN_INVALID_JSON',502,true); }
    if (!data?.access_token) throw apiError('CHANNEL_ACCESS_TOKEN_EMPTY',502);
    const token = String(data.access_token);
    const expiresIn = Math.max(60, Number(data.expires_in || 900));
    channelTokenCache = { token, expiresAt:Date.now()+expiresIn*1000 };
    return token;
  })();
  try { return await channelTokenInflight; }
  finally { channelTokenInflight = null; }
}

async function fetchAirwaitReservations(env, waitTypeId) {
  const out=[]; let start=1;
  for (let page=0; page<20; page+=1) {
    const params={storeId:SM.STORE_ID,sortStatus:'0',isDesc:'0',start:String(start),limit:'100'};
    if (normalizeWaitType(waitTypeId)) params.waitTypeId=normalizeWaitType(waitTypeId);
    const response=await fetchWithTimeout(SM.AIR_RESERVATIONS,{
      method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',corWclpKeyCd:env.AIRWAIT_API_KEY},
      body:new URLSearchParams(params),
    }, SM.EXTERNAL_TIMEOUT_MS);
    const text=await response.text(); let data;
    try { data=JSON.parse(text); } catch { throw apiError('AIRWAIT_RESERVATIONS_INVALID_JSON',502,response.status>=500); }
    if(!response.ok||data?.success!==true||data?.resultCode?.code!=='0000') throw apiError(`AIRWAIT_RESERVATIONS_FAILED_${response.status}`,502);
    const part=Array.isArray(data?.innerDto?.reservations)?data.innerDto.reservations:[];
    const total=Number(data?.innerDto?.count||part.length||0);
    out.push(...part.map(x=>({number:String(x?.number||''),waitTypeId:normalizeWaitType(x?.waitTypeId),waitTypeName:String(x?.waitTypeName||''),status:String(x?.status||''),isCalling:String(x?.isCalling||'0')})));
    if(!part.length||out.length>=total) break;
    start+=part.length;
  }
  return out;
}

async function ensureServiceSchema(env) {
  if(!env.DB) throw apiError('DB_NOT_CONFIGURED',503);
  if (schemaReady) return await schemaReady;
  schemaReady = env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_service_token_claims (
      request_id TEXT PRIMARY KEY,business_date TEXT NOT NULL,wait_type_id TEXT NOT NULL,status TEXT NOT NULL,
      last_error TEXT NOT NULL DEFAULT '',last_http_status INTEGER NOT NULL DEFAULT 0,notification_token TEXT NOT NULL DEFAULT '',
      expires_at INTEGER NOT NULL DEFAULT 0,remaining_count INTEGER NOT NULL DEFAULT 0,session_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_service_messages (
      business_date TEXT NOT NULL,receipt_no TEXT NOT NULL,reserve_id TEXT NOT NULL,wait_type_id TEXT NOT NULL,request_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,last_error TEXT NOT NULL DEFAULT '',last_http_status INTEGER NOT NULL DEFAULT 0,notification_token TEXT NOT NULL DEFAULT '',
      expires_at INTEGER NOT NULL DEFAULT 0,remaining_count INTEGER NOT NULL DEFAULT 0,session_id TEXT NOT NULL DEFAULT '',notified_at INTEGER NOT NULL DEFAULT 0,
      next_retry_at INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(business_date,reserve_id))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS v2_service_liff_token_usage (
      token_hash TEXT PRIMARY KEY,request_id TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v2_service_messages_receipt ON v2_service_messages(business_date,receipt_no)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v2_service_messages_pending ON v2_service_messages(business_date,status,notified_at,next_retry_at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v2_service_liff_usage_request ON v2_service_liff_token_usage(request_id)'),
  ]).catch(e=>{schemaReady=null;throw e});
  return await schemaReady;
}

async function adoptReusableNotificationClaim(env, tokenHash, usage, newRequestId, businessDate, waitTypeId) {
  if (String(usage?.status || '') !== 'TOKEN_READY') return null;
  const oldRequestId = normalizeRequestId(usage?.request_id);
  if (!oldRequestId || oldRequestId === newRequestId) return null;
  const oldClaim = await getTokenClaim(env, oldRequestId);
  if (!oldClaim || String(oldClaim.status || '') !== 'TOKEN_READY' || !String(oldClaim.notification_token || '')) return null;
  if (Number(oldClaim.expires_at || 0) <= Date.now() + 30_000 || Number(oldClaim.remaining_count || 0) <= 0) return null;

  const now = Date.now();
  const moved = await env.DB.prepare(`UPDATE v2_service_token_claims SET
    request_id=?,business_date=?,wait_type_id=?,updated_at=?
    WHERE request_id=? AND status='TOKEN_READY' AND notification_token<>''`)
    .bind(newRequestId, businessDate, waitTypeId, now, oldRequestId).run();
  if (Number(moved?.meta?.changes || 0) !== 1) return null;

  const usageMoved = await env.DB.prepare(`UPDATE v2_service_liff_token_usage SET
    request_id=?,status='TOKEN_READY',updated_at=?
    WHERE token_hash=? AND request_id=? AND status='TOKEN_READY'`)
    .bind(newRequestId, now, tokenHash, oldRequestId).run();
  if (Number(usageMoved?.meta?.changes || 0) !== 1) {
    await env.DB.prepare(`UPDATE v2_service_token_claims SET request_id=?,updated_at=?
      WHERE request_id=? AND status='TOKEN_READY'`)
      .bind(oldRequestId, Date.now(), newRequestId).run();
    return null;
  }
  return await getTokenClaim(env, newRequestId);
}

async function getTokenClaim(env, requestId){return await env.DB.prepare('SELECT * FROM v2_service_token_claims WHERE request_id=? LIMIT 1').bind(requestId).first();}
async function setClaimError(env,requestId,status,e){await env.DB.prepare('UPDATE v2_service_token_claims SET status=?,last_error=?,last_http_status=?,updated_at=? WHERE request_id=?').bind(status,safeError(e),Number(e?.status||0),Date.now(),requestId).run();}
async function setRowError(env,rec,status,message,httpStatus=0,nextRetryAt=0){await env.DB.prepare('UPDATE v2_service_messages SET status=?,last_error=?,last_http_status=?,next_retry_at=?,updated_at=? WHERE business_date=? AND reserve_id=?').bind(status,String(message||'').slice(0,500),Number(httpStatus||0),Number(nextRetryAt||0),Date.now(),rec.business_date,rec.reserve_id).run();}
async function releaseLiffUsage(env,tokenHash,requestId){await env.DB.prepare("DELETE FROM v2_service_liff_token_usage WHERE token_hash=? AND request_id=? AND status='CLAIMED'").bind(tokenHash,requestId).run();}

function assertServiceConfig(env){
  if(!String(env.LINE_MINIAPP_CHANNEL_SECRET||'').trim()) throw apiError('LINE_MINIAPP_CHANNEL_SECRET_NOT_CONFIGURED',503);
  if(!normalizeTemplateName(env.SERVICE_MESSAGE_TEMPLATE_NAME)) throw apiError('SERVICE_MESSAGE_TEMPLATE_NAME_NOT_CONFIGURED',503);
  if(!templateParamsValid(env.SERVICE_MESSAGE_TEMPLATE_PARAMS_JSON)) throw apiError('SERVICE_MESSAGE_TEMPLATE_PARAMS_NOT_CONFIGURED_OR_INVALID',503);
}
function templateParamsValid(raw){
  const s=String(raw||'').trim(); if(!s) return false;
  try { const x=JSON.parse(s); return Boolean(x&&typeof x==='object'&&!Array.isArray(x)); } catch { return false; }
}
function buildTemplateParams(env,vars){
  const raw=String(env.SERVICE_MESSAGE_TEMPLATE_PARAMS_JSON||'').trim(); let obj;
  try { obj=JSON.parse(raw); } catch { throw apiError('SERVICE_MESSAGE_TEMPLATE_PARAMS_INVALID_JSON',500); }
  if(!obj||typeof obj!=='object'||Array.isArray(obj)) throw apiError('SERVICE_MESSAGE_TEMPLATE_PARAMS_NOT_OBJECT',500);
  const out={}; for(const [key,value] of Object.entries(obj).slice(0,30)){
    let text=String(value??''); for(const [name,replacement] of Object.entries(vars)) text=text.split(`{{${name}}}`).join(String(replacement??''));
    out[String(key).slice(0,50)]=text.slice(0,1000);
  } return out;
}
function normalizeTemplateName(v){let s=String(v||'').trim();if(!s)return'';if(!/_(?:ja|en|zh-TW|th|id|ko)$/.test(s))s+='_ja';return s.slice(0,30);}
function publicClaim(row,reused){return{ok:true,ready:true,reused:Boolean(reused),status:'TOKEN_READY',remainingCount:Number(row.remaining_count||0),version:SM.VERSION};}
function publicRow(row){return{ok:true,found:true,version:SM.VERSION,businessDate:String(row.business_date||''),receiptNo:String(row.receipt_no||''),reserveId:String(row.reserve_id||''),waitTypeId:String(row.wait_type_id||''),status:String(row.status||''),error:String(row.last_error||''),lastHttpStatus:Number(row.last_http_status||0),remainingCount:Number(row.remaining_count||0),expiresAt:Number(row.expires_at||0),notifiedAt:Number(row.notified_at||0),nextRetryAt:Number(row.next_retry_at||0)};}
function jstDate(epoch=Date.now()){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:SM.TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(epoch)).map(x=>[x.type,x.value]));return`${p.year}-${p.month}-${p.day}`;}
function ticketParts(v){const k=String(v||'').normalize('NFKC').toUpperCase().replace(/[\s\-ー]/g,'');const m=k.match(/^([FT]?)(\d+)$/);return m?{prefix:m[1],digits:m[2].replace(/^0+(?=\d)/,'')}:null;}
function ticketIdentity(v){const p=ticketParts(v);return p?p.prefix+p.digits:'';}
function sameTicket(a,b){const x=ticketParts(a),y=ticketParts(b);if(!x||!y||!x.digits||!y.digits||x.digits!==y.digits)return false;if(x.prefix&&y.prefix&&x.prefix!==y.prefix)return false;return true;}
function selectTicketMatch(rows,receiptNo){const list=Array.isArray(rows)?rows:[];const target=ticketIdentity(receiptNo);const exact=target?list.filter(r=>ticketIdentity(r?.number)===target):[];if(exact.length===1)return{row:exact[0],ambiguous:false,count:1,mode:'exact'};if(exact.length>1)return{row:null,ambiguous:true,count:exact.length,mode:'exact'};const loose=list.filter(r=>sameTicket(r?.number,receiptNo));if(loose.length===1)return{row:loose[0],ambiguous:false,count:1,mode:'compatible'};return{row:null,ambiguous:loose.length>1,count:loose.length,mode:'compatible'};}
function normalizeWaitType(v){const s=String(v||'').trim();return /^\d{4}$/.test(s)?s:'';}
function normalizeReceipt(v){return ticketIdentity(v);}
function normalizeReserveId(v){const s=String(v??'').normalize('NFKC').trim();return /^\d{1,12}$/.test(s)?s.padStart(12,'0'):'';}
function normalizeRequestId(v){const s=String(v||'').trim();return /^[A-Za-z0-9_-]{8,120}$/.test(s)?s:'';}
function normalizeDate(v){const s=String(v||'').trim().replace(/\//g,'-'),m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(!m)return'';const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(Date.UTC(y,mo-1,d,12));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d)return'';return`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
async function sha256Hex(text){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text||'')));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function fetchWithTimeout(url,options={},ms=SM.EXTERNAL_TIMEOUT_MS){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),ms);try{return await fetch(url,{...options,signal:ctrl.signal})}catch(e){if(e?.name==='AbortError')throw apiError('EXTERNAL_REQUEST_TIMEOUT',504,true);throw e}finally{clearTimeout(timer)}}
function safeApiText(text){return String(text||'').replace(/[\r\n\t]+/g,' ').replace(/"(?:access_token|notificationToken|liffAccessToken|client_secret)"\s*:\s*"[^"]*"/gi,'"[REDACTED]"').slice(0,300);}
function safeError(e){return String(e?.message||e||'UNKNOWN_ERROR').replace(/[\r\n\t]+/g,' ').slice(0,500);}
function apiError(message,status=500,ambiguous=false){const e=new Error(String(message||'UNKNOWN_ERROR'));e.status=status;e.ambiguous=Boolean(ambiguous);return e;}