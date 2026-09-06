/**
 * ASOBooN PURPLE Service Message backend v1.3.0
 * Purple-only / standalone Apps Script Web App.
 *
 * Security / reliability rules:
 * - Channel Secret / AirWAIT API key are Script Properties only.
 * - LIFF access token is memory-only; only SHA-256 is stored immediately before notifier/token.
 * - Service notification token is server-side only.
 * - Production LINE Messaging API is never used.
 * - Registration is accepted only while the same AirWAIT receipt is still status=0 (waiting).
 * - Active AirWAIT call = status=0 (waiting) AND isCalling=1.
 * - Prefixed AirWAIT numbers (F/T) are never collapsed to a numeric receipt number.
 * - AirWAIT call matching is same-business-date + exact numeric receiptNo + waitTypeId.
 * - A send is persisted as PENDING before calling notifier/send. Unknown 5xx/network outcomes are never auto-retried.
 * - 429/channel-token failures may be retried because the service-message send itself was not accepted.
 *
 * Script Properties required:
 *   PURPLE_LINE_MINIAPP_CHANNEL_SECRET
 *   AIRWAIT_API_KEY
 * Optional:
 *   PURPLE_LINE_MINIAPP_CHANNEL_ID
 *   PURPLE_SERVICE_TEMPLATE_NAME
 *   PURPLE_SERVICE_TEMPLATE_PARAMS_JSON
 */
const PSM1 = Object.freeze({
  VERSION: '1.3.0',
  TZ: 'Asia/Tokyo',
  SPREADSHEET_ID: '1dsQcmLMNxVb-uaR16zbqhqjeenoNg5VqMMWa3-1pj8Y',
  CHANNEL_ID_DEFAULT: '2011467470',
  CHANNEL_ID_PROP: 'PURPLE_LINE_MINIAPP_CHANNEL_ID',
  CHANNEL_SECRET_PROP: 'PURPLE_LINE_MINIAPP_CHANNEL_SECRET',
  AIRWAIT_KEY_PROP: 'AIRWAIT_API_KEY',
  TEMPLATE_PROP: 'PURPLE_SERVICE_TEMPLATE_NAME',
  TEMPLATE_PARAMS_PROP: 'PURPLE_SERVICE_TEMPLATE_PARAMS_JSON',
  MAP: 'PURPLE_SERVICE_MAP',
  CONTROL: 'PURPLE_SERVICE_CONTROL',
  LOG: 'PURPLE_SERVICE_LOG',
  STORE_ID: 'KR01205179',
  ORIGIN: 'https://asoboon.github.io',
  OAUTH: 'https://api.line.me/oauth2/v3/token',
  NOTIFIER_TOKEN: 'https://api.line.me/message/v3/notifier/token',
  NOTIFIER_SEND: 'https://api.line.me/message/v3/notifier/send?target=service',
  AIRWAIT_LAST: 'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless',
  AIRWAIT_RES: 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  CALLSTATUS_PERMANENT_BASE: 'https://miniapp.line.me/2011467470-Gk5C3lWf/',
  CACHE_TTL: 600,
  RETRY_PENDING_PROP: 'PSM1_RETRY_PENDING',
  LAST_MARKER_PROP: 'PSM1_AIRWAIT_LAST',
  MAX_SAFE_RETRIES: 5,
  PENDING_STALE_MS: 2 * 60 * 1000,
  MAP_HEADERS: Object.freeze([
    'createdAt','updatedAt','businessDate','receiptNo','reserveId','waitTypeId','waitTypeName',
    'notificationToken','expiresAt','remainingCount','sessionId','liffTokenHash','status','lastError',
    'lastSentAt','templateName','source','callDetectedAt','retryCount','nextRetryAt','lastHttpStatus','requestId'
  ]),
  LOG_HEADERS: Object.freeze([
    'time','level','action','receiptNo','reserveId','method','endpoint','httpStatus','result','message'
  ])
});

function setupPurpleServiceMessageV1() {
  const ss = psmBook_();
  ensurePsmSheet_(ss, PSM1.MAP, PSM1.MAP_HEADERS, 1000);
  ensurePsmSheet_(ss, PSM1.LOG, PSM1.LOG_HEADERS, 5000);
  ensurePsmControl_(ss);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(PSM1.CHANNEL_ID_PROP)) props.setProperty(PSM1.CHANNEL_ID_PROP, PSM1.CHANNEL_ID_DEFAULT);
  props.deleteProperty(PSM1.RETRY_PENDING_PROP);
  props.deleteProperty(PSM1.LAST_MARKER_PROP);
  removePsmTriggers_();
  ScriptApp.newTrigger('purpleServiceWorkerV1').timeBased().everyMinutes(1).create();
  logPsm_('INFO','SETUP','','','LOCAL','setup','','READY','v' + PSM1.VERSION);
  return psmHealth_();
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || 'health');
  const callback = String(p.callback || '');
  let result;
  try {
    if (action === 'health') result = psmHealth_();
    else if (action === 'requestStatus') result = readPsmRequest_(String(p.requestId || ''));
    else if (action === 'reservationStatus') result = publicReservationStatus_(p);
    else result = {ok:false,error:'UNKNOWN_ACTION',version:PSM1.VERSION};
  } catch (err) {
    result = {ok:false,error:safePsmError_(err),version:PSM1.VERSION};
  }
  return psmOut_(result, callback);
}

function doPost(e) {
  const p = Object.assign({}, (e && e.parameter) || {});
  const requestId = psmRequestId_(p.requestId);
  p.requestId = requestId;
  const lock = LockService.getScriptLock();
  let acquired = false;
  let result;
  try {
    acquired = lock.tryLock(12000);
    if (!acquired) throw new Error('PURPLE_SERVICE_BUSY_RETRY');
    if (String(p.action || 'issueServiceToken') !== 'issueServiceToken') throw new Error('UNKNOWN_ACTION');
    result = issuePurpleServiceToken_(p);
  } catch (err) {
    result = {ok:false,stored:false,error:safePsmError_(err),version:PSM1.VERSION};
    logPsm_('ERROR','ISSUE',canonicalReceiptNoPsm_(p.receiptNo),normalizeReserveIdPsm_(p.reserveId),'POST','/message/v3/notifier/token',Number(err && err.httpStatus || 0) || '',err && err.ambiguous ? 'AMBIGUOUS' : 'ERROR',result.error);
  } finally {
    if (acquired) try { lock.releaseLock(); } catch (_) {}
  }
  cachePsmRequest_(requestId, result);
  return psmOut_(result, '');
}

function issuePurpleServiceToken_(p) {
  const ctl = psmControl_();
  if (!boolPsm_(ctl.enabled, false)) throw new Error('PURPLE_SERVICE_DISABLED');
  const receiptNo = canonicalReceiptNoPsm_(p.receiptNo);
  const reserveId = normalizeReserveIdPsm_(p.reserveId);
  const waitTypeId = normalizeWaitTypeIdPsm_(p.waitTypeId);
  const submittedWaitTypeName = String(p.waitTypeName || '').trim().slice(0,100);
  const businessDate = normalizeDatePsm_(p.businessDate || p.operationalDay || p.day);
  const source = String(p.source || 'purple').trim().slice(0,100);
  const requestId = psmRequestId_(p.requestId);
  const liffAccessToken = String(p.liffAccessToken || '').trim();
  const sendFirst = boolPsm_(p.sendFirstMessage, false);
  if (!receiptNo || !reserveId || !waitTypeId || !businessDate) throw new Error('VALIDATION_ERROR');
  if (businessDate !== jstDatePsm_(new Date())) throw new Error('AIRWAIT_BUSINESS_DATE_MISMATCH');
  if (liffAccessToken.length < 20) throw new Error('LIFF_ACCESS_TOKEN_REQUIRED');

  let existing = findPsmMap_(receiptNo, reserveId, businessDate);
  if (existing && existing.notificationToken) {
    if (isExpiredPsm_(existing)) {
      existing.status = 'TOKEN_EXPIRED'; existing.lastError = 'service notification token expired'; upsertPsmMap_(existing);
      throw new Error('SERVICE_NOTIFICATION_TOKEN_EXPIRED_NEW_ACTION_REQUIRED');
    }
    if (Number(existing.remainingCount || 0) <= 0) {
      existing.status = 'TOKEN_EXHAUSTED'; existing.lastError = 'remainingCount=0'; upsertPsmMap_(existing);
      throw new Error('SERVICE_NOTIFICATION_TOKEN_EXHAUSTED_NEW_ACTION_REQUIRED');
    }
    existing.requestId = requestId;
    existing.source = source;
    upsertPsmMap_(existing);
    if (sendFirst && canSendPsm_(existing) && !['FIRST_MESSAGE_SENT','CALL_MESSAGE_SENT'].includes(String(existing.status || ''))) {
      return publicPsmResult_(sendServiceForRecord_(existing,{receiptNo,reserveId,waitTypeId,waitTypeName:existing.waitTypeName || submittedWaitTypeName,businessDate,source},'FIRST_MESSAGE_SENT'),true);
    }
    return publicPsmResult_(existing, true);
  }
  if (existing && ['TOKEN_ISSUE_AMBIGUOUS','TOKEN_ISSUE_PENDING'].includes(String(existing.status || ''))) throw new Error('TOKEN_ISSUE_REQUIRES_MANUAL_REVIEW');

  const airwaitRow = verifyRegistrationAgainstAirwait_(receiptNo, waitTypeId);
  const authoritativeWaitTypeName = String(airwaitRow.waitTypeName || submittedWaitTypeName || '').trim().slice(0,100);
  const tokenHash = sha256HexPsm_(liffAccessToken);
  const usedBy = findPsmMapByTokenHash_(tokenHash);
  if (usedBy && (!existing || Number(usedBy._row) !== Number(existing._row))) throw new Error('LIFF_ACCESS_TOKEN_ALREADY_USED');
  if (existing && String(existing.liffTokenHash || '') === tokenHash) throw new Error('LIFF_ACCESS_TOKEN_ALREADY_USED');

  const channelToken = statelessChannelTokenPsm_();
  const now = new Date();
  let rec = existing || {};
  Object.assign(rec,{createdAt:rec.createdAt || now,updatedAt:now,businessDate,receiptNo,reserveId,waitTypeId,waitTypeName:authoritativeWaitTypeName,notificationToken:'',expiresAt:'',remainingCount:0,sessionId:'',liffTokenHash:tokenHash,status:'TOKEN_ISSUE_PENDING',lastError:'',lastSentAt:'',templateName:'',source,callDetectedAt:rec.callDetectedAt || '',retryCount:0,nextRetryAt:'',lastHttpStatus:'',requestId});
  rec = upsertPsmMap_(rec);

  let response;
  try {
    response = UrlFetchApp.fetch(PSM1.NOTIFIER_TOKEN,{method:'post',contentType:'application/json; charset=UTF-8',headers:{Authorization:'Bearer ' + channelToken},payload:JSON.stringify({liffAccessToken:liffAccessToken}),muteHttpExceptions:true,followRedirects:true});
  } catch (fetchErr) {
    rec.status = 'TOKEN_ISSUE_AMBIGUOUS'; rec.lastError = 'NOTIFIER_TOKEN_NETWORK_AMBIGUOUS ' + safePsmError_(fetchErr); rec.lastHttpStatus = ''; upsertPsmMap_(rec);
    const err = new Error(rec.lastError); err.ambiguous = true; throw err;
  }
  const code = response.getResponseCode();
  const text = String(response.getContentText() || '');
  logPsm_(code === 200 ? 'INFO' : 'ERROR','TOKEN_ISSUE',receiptNo,reserveId,'POST','/message/v3/notifier/token',code,code === 200 ? 'OK' : (code >= 500 ? 'AMBIGUOUS' : 'ERROR'),safeApiTextPsm_(text));
  if (code !== 200) {
    const err = httpPsmError_('NOTIFIER_TOKEN',code,text);
    rec.status = err.ambiguous ? 'TOKEN_ISSUE_AMBIGUOUS' : 'TOKEN_ISSUE_ERROR'; rec.lastError = safePsmError_(err); rec.lastHttpStatus = code; upsertPsmMap_(rec); throw err;
  }
  let data;
  try { data = parseJsonPsm_(text,'notifier token'); }
  catch (parseErr) {
    rec.status = 'TOKEN_ISSUE_AMBIGUOUS'; rec.lastError = 'NOTIFIER_TOKEN_200_PARSE_AMBIGUOUS ' + safePsmError_(parseErr); rec.lastHttpStatus = 200; upsertPsmMap_(rec);
    const err = new Error(rec.lastError); err.ambiguous = true; throw err;
  }
  if (!data.notificationToken) {
    rec.status = 'TOKEN_ISSUE_AMBIGUOUS'; rec.lastError = 'NOTIFICATION_TOKEN_EMPTY_AFTER_200'; rec.lastHttpStatus = 200; upsertPsmMap_(rec);
    const err = new Error(rec.lastError); err.ambiguous = true; throw err;
  }
  rec.notificationToken = String(data.notificationToken);
  rec.expiresAt = new Date(Date.now() + Math.max(0,Number(data.expiresIn || 0)) * 1000);
  rec.remainingCount = Number(data.remainingCount || 0);
  rec.sessionId = String(data.sessionId || '');
  rec.lastHttpStatus = 200;
  rec.updatedAt = new Date();
  if (rec.remainingCount <= 0 || isExpiredPsm_(rec)) {
    rec.status = rec.remainingCount <= 0 ? 'TOKEN_EXHAUSTED' : 'TOKEN_EXPIRED'; rec.lastError = 'issued token is not sendable'; upsertPsmMap_(rec);
    throw new Error('SERVICE_NOTIFICATION_TOKEN_NOT_SENDABLE_AFTER_ISSUE');
  }
  rec.status = 'TOKEN_READY'; rec.lastError = ''; rec = upsertPsmMap_(rec);
  PropertiesService.getScriptProperties().setProperty(PSM1.RETRY_PENDING_PROP,'TRUE');
  if (sendFirst) rec = sendServiceForRecord_(rec,{receiptNo,reserveId,waitTypeId,waitTypeName:authoritativeWaitTypeName,businessDate,source},'FIRST_MESSAGE_SENT');
  return publicPsmResult_(rec,false);
}

function sendServiceForRecord_(rec,ctx,successStatus) {
  if (!canSendPsm_(rec)) throw new Error('SERVICE_NOTIFICATION_TOKEN_NOT_SENDABLE');
  const template = templateNamePsm_();
  if (!template) throw new Error('SERVICE_TEMPLATE_NOT_CONFIGURED');
  const params = templateParamsPsm_(Object.assign({},ctx || {},rec || {}));
  const channelToken = statelessChannelTokenPsm_();
  const pendingStatus = successStatus === 'CALL_MESSAGE_SENT' ? 'CALL_SEND_PENDING' : 'FIRST_SEND_PENDING';
  rec.status = pendingStatus; rec.lastError = ''; rec.lastHttpStatus = ''; rec.updatedAt = new Date(); rec = upsertPsmMap_(rec);
  let response;
  try {
    response = UrlFetchApp.fetch(PSM1.NOTIFIER_SEND,{method:'post',contentType:'application/json; charset=UTF-8',headers:{Authorization:'Bearer ' + channelToken},payload:JSON.stringify({templateName:template,params:params,notificationToken:String(rec.notificationToken || '')}),muteHttpExceptions:true,followRedirects:true});
  } catch (fetchErr) {
    rec.status = successStatus === 'CALL_MESSAGE_SENT' ? 'CALL_SEND_AMBIGUOUS' : 'FIRST_SEND_AMBIGUOUS'; rec.lastError = 'NOTIFIER_SEND_NETWORK_AMBIGUOUS ' + safePsmError_(fetchErr); rec.lastHttpStatus = ''; upsertPsmMap_(rec);
    const err = new Error(rec.lastError); err.ambiguous = true; err.httpStatus = 0; throw err;
  }
  const code = response.getResponseCode();
  const text = String(response.getContentText() || '');
  logPsm_(code === 200 ? 'INFO' : 'ERROR','SERVICE_SEND',rec.receiptNo,rec.reserveId,'POST','/message/v3/notifier/send?target=service',code,code === 200 ? 'OK' : (code >= 500 ? 'AMBIGUOUS' : 'ERROR'),safeApiTextPsm_(text));
  if (code !== 200) {
    const err = httpPsmError_('NOTIFIER_SEND',code,text);
    rec.lastError = safePsmError_(err); rec.lastHttpStatus = code;
    if (err.ambiguous) rec.status = successStatus === 'CALL_MESSAGE_SENT' ? 'CALL_SEND_AMBIGUOUS' : 'FIRST_SEND_AMBIGUOUS';
    else if (err.retryable) rec.status = successStatus === 'CALL_MESSAGE_SENT' ? 'CALL_SEND_RETRY' : 'FIRST_SEND_ERROR';
    else rec.status = successStatus === 'CALL_MESSAGE_SENT' ? 'CALL_SEND_ERROR' : 'FIRST_SEND_ERROR';
    upsertPsmMap_(rec); throw err;
  }
  let data;
  try { data = parseJsonPsm_(text,'notifier send'); }
  catch (parseErr) {
    rec.status = successStatus === 'CALL_MESSAGE_SENT' ? 'CALL_SEND_AMBIGUOUS' : 'FIRST_SEND_AMBIGUOUS'; rec.lastError = 'NOTIFIER_SEND_200_PARSE_AMBIGUOUS ' + safePsmError_(parseErr); rec.lastHttpStatus = 200; upsertPsmMap_(rec);
    const err = new Error(rec.lastError); err.ambiguous = true; err.httpStatus = 200; throw err;
  }
  rec.notificationToken = String(data.notificationToken || '');
  rec.expiresAt = Number(data.expiresIn || 0) > 0 ? new Date(Date.now() + Number(data.expiresIn) * 1000) : new Date(0);
  rec.remainingCount = Number(data.remainingCount || 0);
  rec.sessionId = String(data.sessionId || rec.sessionId || '');
  rec.status = String(successStatus || 'MESSAGE_SENT');
  rec.lastError = ''; rec.lastSentAt = new Date(); rec.templateName = template; rec.retryCount = 0; rec.nextRetryAt = ''; rec.lastHttpStatus = 200;
  return upsertPsmMap_(rec);
}

function purpleServiceWorkerV1() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return;
  try {
    const ctl = psmControl_();
    if (!boolPsm_(ctl.enabled,false) || !boolPsm_(ctl.workerEnabled,false)) return;
    const props = PropertiesService.getScriptProperties();
    const marker = airwaitLastUpdatePsm_();
    const previousMarker = props.getProperty(PSM1.LAST_MARKER_PROP) || '';
    const retryPending = props.getProperty(PSM1.RETRY_PENDING_PROP) === 'TRUE';
    if (previousMarker && marker === previousMarker && !retryPending) return;
    const today = jstDatePsm_(new Date());
    const rows = airwaitCallingReservationsPsm_();
    const now = Date.now();
    let keepRetryPending = false;
    for (const row of rows) {
      if (String(row && row.status || '') !== '0' || !callFlagPsm_(row && row.isCalling)) continue;
      const receiptNo = exactAirwaitNumericNumberPsm_(row && row.number);
      const waitTypeId = normalizeWaitTypeIdPsm_(row && row.waitTypeId);
      if (!receiptNo || !waitTypeId) continue;
      const rec = findPsmMapByCall_(receiptNo,waitTypeId,today);
      if (!rec || !rec.notificationToken) continue;
      const status = String(rec.status || '');
      if (status === 'CALL_MESSAGE_SENT') continue;
      if (['CALL_SEND_AMBIGUOUS','CALL_SEND_ERROR','CALL_SEND_GAVE_UP'].includes(status)) continue;
      if (status === 'CALL_SEND_PENDING') {
        const age = now - epochPsm_(rec.updatedAt);
        if (age >= PSM1.PENDING_STALE_MS) { rec.status = 'CALL_SEND_AMBIGUOUS'; rec.lastError = 'stale CALL_SEND_PENDING; delivery outcome unknown'; rec.nextRetryAt = ''; upsertPsmMap_(rec); }
        else keepRetryPending = true;
        continue;
      }
      if (!rec.callDetectedAt) { rec.callDetectedAt = new Date(); upsertPsmMap_(rec); }
      if (isExpiredPsm_(rec)) { rec.status = 'TOKEN_EXPIRED'; rec.lastError = 'service notification token expired'; rec.nextRetryAt = ''; upsertPsmMap_(rec); continue; }
      if (Number(rec.remainingCount || 0) <= 0) { rec.status = 'TOKEN_EXHAUSTED'; rec.lastError = 'remainingCount=0'; rec.nextRetryAt = ''; upsertPsmMap_(rec); continue; }
      const nextAt = epochPsm_(rec.nextRetryAt);
      if (nextAt && nextAt > now) { keepRetryPending = true; continue; }
      try {
        sendServiceForRecord_(rec,{receiptNo,waitTypeId,reserveId:rec.reserveId,waitTypeName:rec.waitTypeName,businessDate:rec.businessDate,source:'purple-worker'},'CALL_MESSAGE_SENT');
        logPsm_('INFO','CALL_NOTIFY',receiptNo,rec.reserveId,'LOCAL','AirWAIT','','SENT','active calling detected');
      } catch (err) {
        if (err && err.ambiguous === true) continue;
        const count = Number(rec.retryCount || 0) + 1;
        rec.retryCount = count; rec.lastError = safePsmError_(err); rec.lastHttpStatus = Number(err && err.httpStatus || 0) || '';
        if (err && err.retryable === true && count <= PSM1.MAX_SAFE_RETRIES) {
          const delay = [0,60,120,300,600,900][Math.min(count,5)] || 900;
          rec.status = 'CALL_SEND_RETRY'; rec.nextRetryAt = new Date(Date.now() + delay * 1000); keepRetryPending = true;
        } else { rec.status = err && err.retryable === true ? 'CALL_SEND_GAVE_UP' : 'CALL_SEND_ERROR'; rec.nextRetryAt = ''; }
        upsertPsmMap_(rec);
        logPsm_('ERROR','CALL_NOTIFY',receiptNo,rec.reserveId,'POST','/message/v3/notifier/send?target=service',rec.lastHttpStatus,rec.status,rec.lastError);
      }
    }
    props.setProperty(PSM1.LAST_MARKER_PROP,marker);
    props.setProperty(PSM1.RETRY_PENDING_PROP,keepRetryPending ? 'TRUE' : 'FALSE');
  } catch (err) {
    PropertiesService.getScriptProperties().setProperty(PSM1.RETRY_PENDING_PROP,'TRUE');
    logPsm_('ERROR','WORKER','','','LOCAL','AirWAIT','','ERROR',safePsmError_(err));
  } finally { try { lock.releaseLock(); } catch (_) {} }
}

function psmHealth_() {
  let ctl = {}; try { ctl = psmControl_(); } catch (_) {}
  const props = PropertiesService.getScriptProperties();
  return {ok:true,service:'ASOBooN PURPLE Service Message',version:PSM1.VERSION,channelId:channelIdPsm_(),channelSecretConfigured:Boolean(props.getProperty(PSM1.CHANNEL_SECRET_PROP)),airwaitKeyConfigured:Boolean(props.getProperty(PSM1.AIRWAIT_KEY_PROP)),templateConfigured:Boolean(templateNamePsm_()),templateParamsConfigured:Boolean(String(props.getProperty(PSM1.TEMPLATE_PARAMS_PROP) || '').trim()),enabled:boolPsm_(ctl.enabled,false),workerEnabled:boolPsm_(ctl.workerEnabled,false),testMode:boolPsm_(ctl.testMode,true),retryPending:props.getProperty(PSM1.RETRY_PENDING_PROP) === 'TRUE'};
}

function testPurpleBackendPreflightV1() {
  const h = psmHealth_();
  if (!h.channelSecretConfigured) throw new Error('CHANNEL_SECRET_NOT_CONFIGURED');
  if (!h.airwaitKeyConfigured) throw new Error('AIRWAIT_API_KEY_NOT_CONFIGURED');
  const token = statelessChannelTokenPsm_();
  const marker = airwaitLastUpdatePsm_();
  const calling = airwaitCallingReservationsPsm_();
  console.log(JSON.stringify({version:PSM1.VERSION,channelTokenIssued:Boolean(token),lastUpdate:marker,activeCallingCount:calling.length,templateConfigured:h.templateConfigured},null,2));
}

function resetPurpleCallSendStateV1(receiptNo,reserveId,businessDate) {
  const r = findPsmMap_(canonicalReceiptNoPsm_(receiptNo),normalizeReserveIdPsm_(reserveId),normalizeDatePsm_(businessDate));
  if (!r) throw new Error('PURPLE_RECORD_NOT_FOUND');
  if (!r.notificationToken) throw new Error('PURPLE_NOTIFICATION_TOKEN_MISSING');
  if (!canSendPsm_(r)) throw new Error('PURPLE_NOTIFICATION_TOKEN_NOT_SENDABLE');
  r.status = 'TOKEN_READY'; r.lastError = ''; r.retryCount = 0; r.nextRetryAt = ''; r.lastHttpStatus = ''; r.callDetectedAt = '';
  upsertPsmMap_(r);
  PropertiesService.getScriptProperties().setProperty(PSM1.RETRY_PENDING_PROP,'TRUE');
  return publicPsmResult_(r,true);
}

function publicReservationStatus_(p) {
  const receiptNo = canonicalReceiptNoPsm_(p.receiptNo);
  const reserveId = normalizeReserveIdPsm_(p.reserveId);
  const date = normalizeDatePsm_(p.businessDate || p.date);
  if (!receiptNo || !reserveId || !date) return {ok:false,error:'VALIDATION_ERROR',version:PSM1.VERSION};
  const rec = findPsmMap_(receiptNo,reserveId,date);
  return rec ? publicPsmResult_(rec,true) : {ok:true,found:false,version:PSM1.VERSION};
}

function publicPsmResult_(rec,already) {
  return {ok:true,stored:true,found:true,version:PSM1.VERSION,alreadyIssued:Boolean(already),receiptNo:String(rec.receiptNo || ''),reserveId:String(rec.reserveId || ''),status:String(rec.status || ''),remainingCount:Number(rec.remainingCount || 0),expiresAt:dateTextPsm_(rec.expiresAt),sessionIdPresent:Boolean(rec.sessionId),templateName:String(rec.templateName || ''),lastSentAt:dateTextPsm_(rec.lastSentAt),retryCount:Number(rec.retryCount || 0),error:String(rec.lastError || '')};
}

function requestResultPsm_(rec) {
  rec = reconcileOnePendingPsm_(rec);
  const out = publicPsmResult_(rec,true);
  const status = String(rec.status || '');
  if (['TOKEN_ISSUE_PENDING','FIRST_SEND_PENDING','CALL_SEND_PENDING'].includes(status)) return {ok:true,found:false,version:PSM1.VERSION};
  if (/(?:ERROR|AMBIGUOUS|GAVE_UP)$/.test(status) || status.includes('_ERROR')) out.ok = false;
  return out;
}

function reconcileOnePendingPsm_(rec) {
  if (!rec) return rec;
  const status = String(rec.status || '');
  const map = {TOKEN_ISSUE_PENDING:'TOKEN_ISSUE_AMBIGUOUS',FIRST_SEND_PENDING:'FIRST_SEND_AMBIGUOUS',CALL_SEND_PENDING:'CALL_SEND_AMBIGUOUS'};
  if (!map[status]) return rec;
  const updated = epochPsm_(rec.updatedAt);
  if (!updated || Date.now() - updated < PSM1.PENDING_STALE_MS) return rec;
  rec.status = map[status]; rec.lastError = 'stale ' + status + '; external API outcome unknown'; rec.nextRetryAt = '';
  return upsertPsmMap_(rec);
}

function statelessChannelTokenPsm_() {
  const secret = String(PropertiesService.getScriptProperties().getProperty(PSM1.CHANNEL_SECRET_PROP) || '').trim();
  if (!secret) throw new Error('CHANNEL_SECRET_NOT_CONFIGURED');
  let response;
  try {
    response = UrlFetchApp.fetch(PSM1.OAUTH,{method:'post',contentType:'application/x-www-form-urlencoded',payload:{grant_type:'client_credentials',client_id:channelIdPsm_(),client_secret:secret},muteHttpExceptions:true,followRedirects:true});
  } catch (fetchErr) {
    const err = new Error('CHANNEL_TOKEN_NETWORK ' + safePsmError_(fetchErr)); err.retryable = true; err.httpStatus = 0; throw err;
  }
  const code = response.getResponseCode();
  const text = String(response.getContentText() || '');
  logPsm_(code === 200 ? 'INFO' : 'ERROR','CHANNEL_TOKEN','','','POST','/oauth2/v3/token',code,code === 200 ? 'OK' : 'ERROR',safeApiTextPsm_(text));
  if (code !== 200) throw httpPsmError_('CHANNEL_TOKEN',code,text);
  const data = parseJsonPsm_(text,'channel token');
  if (!data.access_token) throw new Error('CHANNEL_ACCESS_TOKEN_EMPTY');
  return String(data.access_token);
}

function templateNamePsm_() {
  let t = String(PropertiesService.getScriptProperties().getProperty(PSM1.TEMPLATE_PROP) || '').trim();
  if (!t) try { t = String(psmControl_().templateName || '').trim(); } catch (_) {}
  if (t && !/_(?:ja|en|zh-TW|th|id|ko)$/.test(t)) t += '_ja';
  return t.slice(0,30);
}

function templateParamsPsm_(ctx) {
  const raw = String(PropertiesService.getScriptProperties().getProperty(PSM1.TEMPLATE_PARAMS_PROP) || '{}').trim() || '{}';
  const obj = parseJsonPsm_(raw,'template params');
  if (!obj || Array.isArray(obj) || typeof obj !== 'object') throw new Error('TEMPLATE_PARAMS_NOT_OBJECT');
  const vars = {receiptNo:String(ctx.receiptNo || ''),waitTypeName:String(ctx.waitTypeName || ''),businessDate:String(ctx.businessDate || ''),reserveId:String(ctx.reserveId || ''),callstatusUrl:callstatusPermanentPsm_(ctx)};
  const out = {};
  Object.keys(obj).slice(0,30).forEach(function(k) {
    let v = String(obj[k] == null ? '' : obj[k]);
    Object.keys(vars).forEach(function(name) { v = v.split('{{' + name + '}}').join(vars[name]); });
    out[String(k).slice(0,50)] = v.slice(0,1000);
  });
  return out;
}

function callstatusPermanentPsm_(ctx) {
  return PSM1.CALLSTATUS_PERMANENT_BASE + '?view=callstatus&number=' + encodeURIComponent(String(ctx.receiptNo || '')) + '&date=' + encodeURIComponent(String(ctx.businessDate || ''));
}

function verifyRegistrationAgainstAirwait_(receiptNo,waitTypeId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const rows = airwaitReservationsPageAll_({waitTypeId:waitTypeId,status:'0',sortStatus:'0',isDesc:'0'});
    for (const row of rows) {
      const rowNo = exactAirwaitNumericNumberPsm_(row && row.number);
      const rowWaitTypeId = normalizeWaitTypeIdPsm_(row && row.waitTypeId);
      if (rowNo === receiptNo && rowWaitTypeId === waitTypeId && String(row && row.status || '') === '0') return row;
    }
    if (attempt < 2) Utilities.sleep((attempt + 1) * 400);
  }
  throw new Error('AIRWAIT_RESERVATION_NOT_VERIFIED');
}

function airwaitLastUpdatePsm_() {
  const url = PSM1.AIRWAIT_LAST + '?key=' + encodeURIComponent(airwaitKeyPsm_()) + '&storeId=' + encodeURIComponent(PSM1.STORE_ID);
  const response = UrlFetchApp.fetch(url,{method:'get',headers:{Origin:PSM1.ORIGIN},muteHttpExceptions:true,followRedirects:true});
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('AIRWAIT_LAST_HTTP_' + code);
  const data = parseJsonPsm_(response.getContentText(),'airwait last');
  if (!airwaitOkPsm_(data)) throw new Error('AIRWAIT_LAST_ERROR');
  const marker = findMarkerPsm_(data);
  if (!marker) throw new Error('AIRWAIT_LAST_MARKER_EMPTY');
  return marker;
}

function findMarkerPsm_(payload) {
  const names = ['lastUpdDate','lastUpdate','lastUpdateDate','lastUpdatedAt','updateDate','updatedAt','lastUpdDateStateless'];
  const seen = [];
  function walk(v,depth) {
    if (!v || typeof v !== 'object' || depth > 5 || seen.indexOf(v) >= 0) return '';
    seen.push(v);
    for (const k of names) if (v[k] != null && String(v[k]).trim()) return String(v[k]).trim();
    for (const k of Object.keys(v)) if (/last.*upd|update.*date|updated/i.test(k) && v[k] != null && typeof v[k] !== 'object' && String(v[k]).trim()) return String(v[k]).trim();
    for (const k of Object.keys(v)) { const found = walk(v[k],depth + 1); if (found) return found; }
    return '';
  }
  return walk(payload,0);
}

function airwaitCallingReservationsPsm_() { return airwaitReservationsPageAll_({status:'0',isCalling:'1',sortStatus:'1',isDesc:'0'}); }

function airwaitReservationsPageAll_(filters) {
  const out = [];
  let start = 1;
  let total = Infinity;
  let guard = 0;
  while (start <= total) {
    if (++guard > 100) throw new Error('AIRWAIT_RES_PAGINATION_LIMIT');
    const url = PSM1.AIRWAIT_RES + '?key=' + encodeURIComponent(airwaitKeyPsm_());
    const payload = {storeId:PSM1.STORE_ID,start:String(start),limit:'100'};
    Object.keys(filters || {}).forEach(function(k) { const v = filters[k]; if (v !== undefined && v !== null && String(v) !== '') payload[k] = String(v); });
    const response = UrlFetchApp.fetch(url,{method:'post',headers:{Origin:PSM1.ORIGIN},contentType:'application/x-www-form-urlencoded; charset=UTF-8',payload:payload,muteHttpExceptions:true,followRedirects:true});
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) throw new Error('AIRWAIT_RES_HTTP_' + code);
    const data = parseJsonPsm_(response.getContentText(),'airwait reservations');
    if (!airwaitOkPsm_(data)) throw new Error('AIRWAIT_RES_ERROR');
    const inner = (data && data.innerDto) || {};
    const rows = Array.isArray(inner.reservations) ? inner.reservations : [];
    const count = Number(inner.count);
    total = Number.isFinite(count) && count >= 0 ? count : rows.length;
    Array.prototype.push.apply(out,rows);
    if (!rows.length) break;
    start += rows.length;
  }
  return out;
}

function airwaitKeyPsm_() { const key = String(PropertiesService.getScriptProperties().getProperty(PSM1.AIRWAIT_KEY_PROP) || '').trim(); if (!key) throw new Error('AIRWAIT_API_KEY_NOT_CONFIGURED'); return key; }
function airwaitOkPsm_(data) { return Boolean(data && (data.success === true || String(data.resultCode && data.resultCode.code || '') === '0000')); }
function callFlagPsm_(v) { return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true'; }
function canSendPsm_(rec) { return Boolean(rec && rec.notificationToken) && Number(rec.remainingCount || 0) > 0 && !isExpiredPsm_(rec); }
function isExpiredPsm_(rec) { if (!rec || !rec.expiresAt) return false; const t = epochPsm_(rec.expiresAt); return !t || t <= Date.now(); }
function epochPsm_(v) { if (!v) return 0; const d = v instanceof Date ? v : new Date(v); const n = d.getTime(); return Number.isFinite(n) ? n : 0; }
function jstDatePsm_(d) { return Utilities.formatDate(d,PSM1.TZ,'yyyy-MM-dd'); }
function psmBook_() { return SpreadsheetApp.openById(PSM1.SPREADSHEET_ID); }

function ensurePsmSheet_(ss,name,headers,rows) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(),rows - sh.getMaxRows());
  if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(),headers.length - sh.getMaxColumns());
  const got = sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
  if (headers.some(function(h,i) { return got[i] !== h; })) sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return sh;
}

function ensurePsmControl_(ss) {
  const sh = ss.getSheetByName(PSM1.CONTROL) || ss.insertSheet(PSM1.CONTROL);
  const defaults = [['key','value','note'],['version',PSM1.VERSION,'backend version'],['enabled','FALSE','Developing疎通完了後にTRUE'],['channelId',PSM1.CHANNEL_ID_DEFAULT,'Developing internal channel'],['templateName','','Waiting template API name'],['workerEnabled','FALSE','実送信テスト後にTRUE'],['testMode','TRUE','purple only']];
  if (sh.getLastRow() < 2) sh.getRange(1,1,defaults.length,3).setValues(defaults);
  else {
    const vals = sh.getDataRange().getDisplayValues();
    const seen = {};
    for (let i = 1; i < vals.length; i++) seen[String(vals[i][0] || '').trim()] = i + 1;
    for (let i = 1; i < defaults.length; i++) {
      const key = defaults[i][0], row = seen[key];
      if (row) { if (key === 'version') sh.getRange(row,2).setValue(PSM1.VERSION); }
      else sh.appendRow(defaults[i]);
    }
    if (String(sh.getRange(1,1).getDisplayValue()) !== 'key') sh.getRange(1,1,1,3).setValues([defaults[0]]);
  }
  sh.setFrozenRows(1);
  return sh;
}

function psmControl_() {
  const sh = psmBook_().getSheetByName(PSM1.CONTROL);
  if (!sh || sh.getLastRow() < 2) return {};
  const values = sh.getDataRange().getDisplayValues();
  const out = {};
  for (let i = 1; i < values.length; i++) { const key = String(values[i][0] || '').trim(); if (key) out[key] = values[i][1]; }
  return out;
}

function mapRowsPsm_() {
  const sh = psmBook_().getSheetByName(PSM1.MAP);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2,1,sh.getLastRow() - 1,PSM1.MAP_HEADERS.length).getValues();
  return values.map(function(row,index) { return rowPsm_(row,index + 2); });
}

function findPsmMap_(receiptNo,reserveId,businessDate) {
  const rows = mapRowsPsm_();
  for (let i = rows.length - 1; i >= 0; i--) {
    const o = rows[i];
    if (canonicalReceiptNoPsm_(o.receiptNo) !== canonicalReceiptNoPsm_(receiptNo)) continue;
    if (normalizeReserveIdPsm_(o.reserveId) !== normalizeReserveIdPsm_(reserveId)) continue;
    if (businessDate && normalizeDatePsm_(o.businessDate) !== normalizeDatePsm_(businessDate)) continue;
    return o;
  }
  return null;
}

function findPsmMapByCall_(receiptNo,waitTypeId,businessDate) {
  const rows = mapRowsPsm_();
  for (let i = rows.length - 1; i >= 0; i--) {
    const o = rows[i];
    if (canonicalReceiptNoPsm_(o.receiptNo) !== canonicalReceiptNoPsm_(receiptNo)) continue;
    if (normalizeWaitTypeIdPsm_(o.waitTypeId) !== normalizeWaitTypeIdPsm_(waitTypeId)) continue;
    if (normalizeDatePsm_(o.businessDate) !== normalizeDatePsm_(businessDate)) continue;
    return o;
  }
  return null;
}

function findPsmMapByTokenHash_(hash) { if (!hash) return null; const rows = mapRowsPsm_(); for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i].liffTokenHash || '') === String(hash)) return rows[i]; return null; }
function findPsmMapByRequestId_(requestId) { if (!requestId) return null; const rows = mapRowsPsm_(); for (let i = rows.length - 1; i >= 0; i--) if (String(rows[i].requestId || '') === String(requestId)) return rows[i]; return null; }
function rowPsm_(row,rowNumber) { const out = {_row:rowNumber}; PSM1.MAP_HEADERS.forEach(function(h,i) { out[h] = row[i]; }); return out; }

function upsertPsmMap_(rec) {
  const sh = ensurePsmSheet_(psmBook_(),PSM1.MAP,PSM1.MAP_HEADERS,1000);
  let row = Number(rec._row || 0);
  if (!row) {
    const old = findPsmMap_(rec.receiptNo,rec.reserveId,rec.businessDate);
    row = old && old._row ? Number(old._row) : sh.getLastRow() + 1;
    if (old && !rec.createdAt) rec.createdAt = old.createdAt;
  }
  rec._row = row;
  if (!rec.createdAt) rec.createdAt = new Date();
  rec.updatedAt = new Date();
  sh.getRange(row,1,1,PSM1.MAP_HEADERS.length).setValues([PSM1.MAP_HEADERS.map(function(h) { return rec[h] == null ? '' : rec[h]; })]);
  return rec;
}

function logPsm_(level,action,receiptNo,reserveId,method,endpoint,httpStatus,result,message) { try { const sh = ensurePsmSheet_(psmBook_(),PSM1.LOG,PSM1.LOG_HEADERS,5000); sh.appendRow([new Date(),level,action,receiptNo,reserveId,method,endpoint,httpStatus,result,String(message || '').slice(0,500)]); } catch (_) {} }
function cachePsmRequest_(id,data) { if (!id) return; try { CacheService.getScriptCache().put('psm1_' + id,JSON.stringify(Object.assign({found:true},data)),PSM1.CACHE_TTL); } catch (_) {} }
function readPsmRequest_(id) { if (!id) return {ok:false,found:false,error:'REQUEST_ID_REQUIRED',version:PSM1.VERSION}; try { const cached = CacheService.getScriptCache().get('psm1_' + id); if (cached) return JSON.parse(cached); } catch (_) {} try { const rec = findPsmMapByRequestId_(id); if (rec) return Object.assign({found:true},requestResultPsm_(rec)); } catch (_) {} return {ok:true,found:false,version:PSM1.VERSION}; }
function psmRequestId_(v) { const x = String(v || '').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,100); return x || Utilities.getUuid(); }
function channelIdPsm_() { return String(PropertiesService.getScriptProperties().getProperty(PSM1.CHANNEL_ID_PROP) || PSM1.CHANNEL_ID_DEFAULT).trim(); }
function canonicalReceiptNoPsm_(v) { const s = String(v == null ? '' : v).normalize('NFKC').trim(); if (!/^\d{1,12}$/.test(s)) return ''; return s.replace(/^0+(?=\d)/,''); }
function exactAirwaitNumericNumberPsm_(v) { const s = String(v == null ? '' : v).normalize('NFKC').trim(); if (!/^\d{1,12}$/.test(s)) return ''; return canonicalReceiptNoPsm_(s); }
function normalizeWaitTypeIdPsm_(v) { const s = String(v == null ? '' : v).normalize('NFKC').trim(); return /^\d{4}$/.test(s) ? s : ''; }
function normalizeReserveIdPsm_(v) { const s = String(v == null ? '' : v).normalize('NFKC').trim(); if (!/^\d{1,12}$/.test(s)) return ''; return s.padStart(12,'0'); }
function normalizeDatePsm_(v) { const s = String(v == null ? '' : v).normalize('NFKC').trim().replace(/\//g,'-'); const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (!m) return ''; const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]); const dt = new Date(Date.UTC(y,mo - 1,d,12,0,0)); if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return ''; return y + '-' + String(mo).padStart(2,'0') + '-' + String(d).padStart(2,'0'); }
function boolPsm_(v,def) { if (v == null || String(v).trim() === '') return Boolean(def); return v === true || v === 1 || v === '1' || String(v).toUpperCase() === 'TRUE'; }
function dateTextPsm_(v) { if (!v) return ''; try { return Utilities.formatDate(v instanceof Date ? v : new Date(v),PSM1.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"); } catch (_) { return String(v); } }
function parseJsonPsm_(text,label) { try { return JSON.parse(String(text || '')); } catch (_) { throw new Error(String(label || 'JSON') + '_JSON_PARSE_ERROR'); } }
function safeApiTextPsm_(text) { return String(text || '').replace(/[\r\n\t]+/g,' ').replace(/"(access_token|notificationToken|liffAccessToken|client_secret)"\s*:\s*"[^"]*"/gi,'"$1":"[REDACTED]"').slice(0,300); }
function safePsmError_(e) { return String(e && e.message || e || 'UNKNOWN_ERROR').replace(/[\r\n\t]+/g,' ').slice(0,500); }
function sha256HexPsm_(text) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8).map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join(''); }
function httpPsmError_(prefix,code,text) { const n = Number(code || 0); const err = new Error(String(prefix || 'HTTP') + '_HTTP_' + n + ' ' + safeApiTextPsm_(text)); err.httpStatus = n; if (prefix === 'NOTIFIER_SEND') { err.retryable = n === 429; err.ambiguous = n >= 500; } else if (prefix === 'CHANNEL_TOKEN') { err.retryable = n === 429 || n >= 500; err.ambiguous = false; } else if (prefix === 'NOTIFIER_TOKEN') { err.retryable = false; err.ambiguous = n >= 500; } else { err.retryable = false; err.ambiguous = false; } return err; }
function psmOut_(data,callback) { const json = JSON.stringify(data), cb = String(callback || ''); if (cb && /^[A-Za-z_$][0-9A-Za-z_$]{0,80}$/.test(cb)) return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT); return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON); }
function removePsmTriggers_() { ScriptApp.getProjectTriggers().forEach(function(t) { if (t.getHandlerFunction && t.getHandlerFunction() === 'purpleServiceWorkerV1') ScriptApp.deleteTrigger(t); }); }
