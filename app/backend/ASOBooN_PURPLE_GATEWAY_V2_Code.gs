/**
 * ASOBooN PURPLE Gateway v2.1.0
 * Purple-only Apps Script Web App.
 *
 * Safety rules
 * - Browser never receives AirWAIT API key / LINE Channel Secret / notification token.
 * - Periodic AirWAIT monitoring calls getLastUpdDateStateless first. Reservation list is fetched only when changed.
 * - Ambiguous AirWAIT create / LINE token issue / LINE send outcomes are fail-closed and are never auto-replayed.
 * - A LIFF access token is represented only by SHA-256 hash and can be consumed once.
 */
const PG2 = Object.freeze({
  VERSION: '2.1.0',
  TZ: 'Asia/Tokyo',
  ORIGIN: 'https://asoboon.github.io',
  STORE_ID: 'KR01205179',
  SS_PROP: 'PURPLE_V2_SPREADSHEET_ID',
  AIRWAIT_KEY_PROP: 'AIRWAIT_API_KEY',
  CHANNEL_ID_PROP: 'PURPLE_LINE_MINIAPP_CHANNEL_ID',
  CHANNEL_ID_DEFAULT: '2011467470',
  CHANNEL_SECRET_PROP: 'PURPLE_LINE_MINIAPP_CHANNEL_SECRET',
  TEMPLATE_PROP: 'PURPLE_SERVICE_TEMPLATE_NAME',
  TEMPLATE_PARAMS_PROP: 'PURPLE_SERVICE_TEMPLATE_PARAMS_JSON',
  LAST_MARKER_PROP: 'PURPLE_V2_LAST_MARKER',
  RETRY_PENDING_PROP: 'PURPLE_V2_RETRY_PENDING',
  CONTROL: 'PURPLE_V2_CONTROL',
  MAP: 'PURPLE_V2_MAP',
  CALLS: 'PURPLE_V2_CALLS',
  SNAPSHOT: 'PURPLE_V2_SNAPSHOT',
  LOG: 'PURPLE_V2_LOG',
  WAIT_TYPES: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/wait/type/get',
  CREATE: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',
  LAST: 'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless',
  RESERVATIONS: 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  OAUTH: 'https://api.line.me/oauth2/v3/token',
  NOTIFIER_TOKEN: 'https://api.line.me/message/v3/notifier/token',
  NOTIFIER_SEND: 'https://api.line.me/message/v3/notifier/send?target=service',
  CALLSTATUS_PERMANENT_BASE: 'https://miniapp.line.me/2011467470-Gk5C3lWf/',
  REQUEST_TTL: 600,
  PENDING_STALE_MS: 30000,
  MAX_SAFE_RETRIES: 3,
  MAP_HEADERS: Object.freeze([
    'createdAt','updatedAt','businessDate','receiptNo','bindingId','bindingMode','reserveId',
    'waitTypeId','waitTypeName','notificationToken','expiresAt','remainingCount','sessionId',
    'status','lastError','lastSentAt','templateName','source','requestId',
    'liffTokenHash','retryCount','nextRetryAt','lastHttpStatus','callDetectedAt'
  ]),
  CALL_HEADERS: Object.freeze(['businessDate','receiptNo','waitTypeId','firstSeenAt','lastSeenAt']),
  SNAPSHOT_HEADERS: Object.freeze(['number','waitTypeId','waitTypeName','status','isCalling']),
  LOG_HEADERS: Object.freeze(['time','level','action','receiptNo','bindingId','httpStatus','result','message'])
});

function setupPurpleGatewayV2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('紫V2管理用スプレッドシートから Apps Script を開いて実行してください。');
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PG2.SS_PROP, ss.getId());
  if (!props.getProperty(PG2.CHANNEL_ID_PROP)) props.setProperty(PG2.CHANNEL_ID_PROP, PG2.CHANNEL_ID_DEFAULT);
  ensurePg2Sheet_(ss, PG2.MAP, PG2.MAP_HEADERS, 1200);
  ensurePg2Sheet_(ss, PG2.CALLS, PG2.CALL_HEADERS, 2000);
  ensurePg2Sheet_(ss, PG2.SNAPSHOT, PG2.SNAPSHOT_HEADERS, 500);
  ensurePg2Sheet_(ss, PG2.LOG, PG2.LOG_HEADERS, 5000);
  ensurePg2Control_(ss);
  props.deleteProperty(PG2.LAST_MARKER_PROP);
  props.setProperty(PG2.RETRY_PENDING_PROP, 'FALSE');
  removePg2Triggers_();
  ScriptApp.newTrigger('purpleGatewayWorkerV2').timeBased().everyMinutes(1).create();
  pg2Log_('INFO','SETUP','','','', 'READY', 'v' + PG2.VERSION);
  return pg2Health_();
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || 'health');
  const callback = String(p.callback || '');
  let result;
  try {
    if (action === 'health') result = pg2Health_();
    else if (action === 'waitTypes') result = pg2WaitTypes_();
    else if (action === 'snapshot') result = pg2Snapshot_();
    else if (action === 'requestStatus') result = pg2RequestStatus_(String(p.requestId || ''));
    else if (action === 'reservationStatus') result = pg2ReservationStatus_(p);
    else if (action === 'callInfo') result = pg2CallInfo_(p);
    else result = {ok:false,error:'UNKNOWN_ACTION',version:PG2.VERSION};
  } catch (err) {
    result = {ok:false,error:pg2SafeError_(err),version:PG2.VERSION};
  }
  return pg2Out_(result, callback);
}

function doPost(e) {
  const p = Object.assign({}, (e && e.parameter) || {});
  const requestId = pg2RequestId_(p.requestId);
  p.requestId = requestId;
  const action = String(p.action || '');
  let result;
  const lock = LockService.getScriptLock();
  let acquired = false;
  try {
    acquired = lock.tryLock(12000);
    if (!acquired) throw new Error('PURPLE_GATEWAY_BUSY_RETRY');
    if (action === 'createReservation') result = pg2CreateReservation_(p);
    else if (action === 'issueServiceToken') result = pg2IssueServiceToken_(p);
    else throw new Error('UNKNOWN_ACTION');
  } catch (err) {
    result = {ok:false,stored:false,ambiguous:Boolean(err && err.ambiguous),error:pg2SafeError_(err),version:PG2.VERSION};
    pg2Log_('ERROR', action || 'POST', pg2Receipt_(p.receiptNo), '', Number(err && err.httpStatus || 0) || '', err && err.ambiguous ? 'AMBIGUOUS' : 'ERROR', result.error);
  } finally {
    if (acquired) try { lock.releaseLock(); } catch (_) {}
  }
  pg2CacheRequest_(requestId, result);
  return pg2Out_(result, '');
}

function pg2Health_() {
  const props = PropertiesService.getScriptProperties();
  let ctl = {};
  try { ctl = pg2Control_(); } catch (_) {}
  return {
    ok: true,
    service: 'ASOBooN PURPLE Gateway',
    version: PG2.VERSION,
    spreadsheetConfigured: Boolean(props.getProperty(PG2.SS_PROP)),
    airwaitKeyConfigured: Boolean(props.getProperty(PG2.AIRWAIT_KEY_PROP)),
    channelSecretConfigured: Boolean(props.getProperty(PG2.CHANNEL_SECRET_PROP)),
    templateConfigured: Boolean(String(props.getProperty(PG2.TEMPLATE_PROP) || '').trim()),
    enabled: pg2Bool_(ctl.enabled, false),
    workerEnabled: pg2Bool_(ctl.workerEnabled, false),
    testMode: pg2Bool_(ctl.testMode, true),
    retryPending: props.getProperty(PG2.RETRY_PENDING_PROP) === 'TRUE'
  };
}

function pg2WaitTypes_() {
  pg2RequireOperational_();
  const d = pg2AirwaitPost_(PG2.WAIT_TYPES, {storeId:PG2.STORE_ID}, 'WAIT_TYPES');
  const list = Array.isArray(d && d.innerDto && d.innerDto.waitTypeList) ? d.innerDto.waitTypeList : [];
  return {
    ok:true,
    version:PG2.VERSION,
    waitTypes:list.map(function(x){
      return {
        waitTypeId:String(x && x.waitTypeId || ''),
        waitTypeName:String(x && x.waitTypeName || ''),
        dispFlg:x && x.dispFlg !== false,
        usageDispType:String(x && x.usageDispType || '')
      };
    })
  };
}

function pg2Snapshot_() {
  pg2RequireOperational_();
  const snap = pg2RefreshSnapshot_(false);
  return {
    ok:true,
    version:PG2.VERSION,
    businessDate:pg2OperationalDate_(new Date()),
    serverNow:new Date().toISOString(),
    marker:snap.marker,
    changed:snap.changed,
    rows:snap.rows
  };
}

function pg2CreateReservation_(p) {
  pg2RequireOperational_();
  const waitTypeId = pg2WaitTypeId_(p.waitTypeId);
  const adults = pg2Int_(p.adults, 1, 10);
  const paidChildren = pg2Int_(p.paidChildren, 0, 10);
  const infants = pg2Int_(p.infants, 0, 10);
  const total = adults + paidChildren + infants;
  if (!waitTypeId || adults < 1 || paidChildren < 0 || infants < 0 || total < 1 || total > 10 || paidChildren + infants > adults * 3) throw new Error('VALIDATION_ERROR');
  const d = pg2AirwaitCreate_({
    storeId: PG2.STORE_ID,
    numPerson: String(adults),
    numPersonChild: String(paidChildren + infants),
    waitTypeId: waitTypeId,
    langType: 'KeyJPN',
    autoPrintFlg: 'false'
  });
  const dto = (d && d.innerDto) || {};
  const reserveId = pg2ReserveId_(dto.reserveId);
  const receiptNo = pg2Receipt_(dto.receiptNo);
  if (!reserveId || !receiptNo) {
    const err = new Error('AIRWAIT_CREATE_200_RESULT_AMBIGUOUS_MANUAL_REVIEW');
    err.ambiguous = true; err.httpStatus = 200; throw err;
  }
  PropertiesService.getScriptProperties().deleteProperty(PG2.LAST_MARKER_PROP);
  return {
    ok:true,
    stored:true,
    version:PG2.VERSION,
    reserveId:reserveId,
    receiptNo:receiptNo,
    shortUrl:String(dto.shortUrl || ''),
    businessDate:pg2OperationalDate_(new Date())
  };
}

function pg2IssueServiceToken_(p) {
  pg2RequireOperational_();
  const receiptNo = pg2Receipt_(p.receiptNo);
  const waitTypeId = pg2WaitTypeId_(p.waitTypeId);
  const businessDate = pg2Date_(p.businessDate || p.day || p.operationalDay);
  const bindingMode = String(p.bindingMode || (p.reserveId ? 'onsite' : 'web')).toLowerCase() === 'web' ? 'web' : 'onsite';
  const reserveId = bindingMode === 'onsite' ? pg2ReserveId_(p.reserveId) : '';
  const waitTypeName = String(p.waitTypeName || '').trim().slice(0,100);
  const source = String(p.source || 'purple-v2').trim().slice(0,100);
  const requestId = pg2RequestId_(p.requestId);
  const liffAccessToken = String(p.liffAccessToken || '').trim();
  if (!receiptNo || !waitTypeId || !businessDate || (bindingMode === 'onsite' && !reserveId)) throw new Error('VALIDATION_ERROR');
  if (businessDate !== pg2OperationalDate_(new Date())) throw new Error('AIRWAIT_BUSINESS_DATE_MISMATCH');
  if (liffAccessToken.length < 20) throw new Error('LIFF_ACCESS_TOKEN_REQUIRED');

  const row = pg2FindLiveReservation_(receiptNo, waitTypeId);
  if (!row) throw new Error('AIRWAIT_RESERVATION_NOT_VERIFIED');
  if (String(row.status || '') !== '0') throw new Error('AIRWAIT_RESERVATION_NOT_WAITING');

  const bindingId = bindingMode === 'onsite'
    ? 'RID:' + reserveId
    : 'WEB:' + businessDate + ':' + waitTypeId + ':' + receiptNo;
  let existing = pg2FindMap_(businessDate, bindingId);
  if (existing && existing.notificationToken) {
    if (pg2Expired_(existing)) {
      existing.status = 'TOKEN_EXPIRED'; existing.lastError = 'service notification token expired'; existing.updatedAt = new Date(); pg2UpsertMap_(existing);
      throw new Error('SERVICE_NOTIFICATION_TOKEN_EXPIRED_NEW_ACTION_REQUIRED');
    }
    if (Number(existing.remainingCount || 0) <= 0) {
      existing.status = 'TOKEN_EXHAUSTED'; existing.lastError = 'remainingCount=0'; existing.updatedAt = new Date(); pg2UpsertMap_(existing);
      throw new Error('SERVICE_NOTIFICATION_TOKEN_EXHAUSTED_NEW_ACTION_REQUIRED');
    }
    existing.updatedAt = new Date();
    existing.requestId = requestId;
    existing.source = source;
    pg2UpsertMap_(existing);
    return pg2PublicMap_(existing, true);
  }
  if (existing && ['TOKEN_ISSUE_PENDING','TOKEN_ISSUE_AMBIGUOUS'].indexOf(String(existing.status || '')) >= 0) throw new Error('TOKEN_ISSUE_REQUIRES_MANUAL_REVIEW');

  const tokenHash = pg2Sha256Hex_(liffAccessToken);
  const usedBy = pg2FindMapByTokenHash_(tokenHash);
  if (usedBy) throw new Error('LIFF_ACCESS_TOKEN_ALREADY_USED');

  // Channel token acquisition is safe to retry because notifier/token has not been called yet.
  const channelToken = pg2ChannelToken_();
  const now = new Date();
  const rec = existing || {};
  Object.assign(rec, {
    createdAt:rec.createdAt || now,
    updatedAt:now,
    businessDate:businessDate,
    receiptNo:receiptNo,
    bindingId:bindingId,
    bindingMode:bindingMode,
    reserveId:reserveId,
    waitTypeId:waitTypeId,
    waitTypeName:waitTypeName || String(row.waitTypeName || ''),
    notificationToken:'',
    expiresAt:'',
    remainingCount:0,
    sessionId:'',
    status:'TOKEN_ISSUE_PENDING',
    lastError:'',
    lastSentAt:'',
    templateName:'',
    source:source,
    requestId:requestId,
    liffTokenHash:tokenHash,
    retryCount:0,
    nextRetryAt:'',
    lastHttpStatus:'',
    callDetectedAt:rec.callDetectedAt || ''
  });
  pg2UpsertMap_(rec);

  let response;
  try {
    response = UrlFetchApp.fetch(PG2.NOTIFIER_TOKEN, {
      method:'post',
      contentType:'application/json; charset=UTF-8',
      headers:{Authorization:'Bearer ' + channelToken},
      payload:JSON.stringify({liffAccessToken:liffAccessToken}),
      muteHttpExceptions:true,
      followRedirects:true
    });
  } catch (fetchErr) {
    rec.status = 'TOKEN_ISSUE_AMBIGUOUS'; rec.lastError = 'NOTIFIER_TOKEN_NETWORK_AMBIGUOUS ' + pg2SafeError_(fetchErr); rec.updatedAt = new Date(); rec.lastHttpStatus = ''; pg2UpsertMap_(rec);
    const err = new Error(rec.lastError); err.ambiguous = true; throw err;
  }
  const code = response.getResponseCode();
  const text = String(response.getContentText() || '');
  if (code !== 200) {
    const err = pg2HttpError_('NOTIFIER_TOKEN', code, text);
    if (code >= 500) err.ambiguous = true;
    rec.status = err.ambiguous ? 'TOKEN_ISSUE_AMBIGUOUS' : 'TOKEN_ISSUE_ERROR'; rec.lastError = pg2SafeError_(err); rec.updatedAt = new Date(); rec.lastHttpStatus = code; pg2UpsertMap_(rec);
    throw err;
  }
  let tokenData;
  try { tokenData = pg2Json_(text, 'notifier token'); }
  catch (parseErr) {
    rec.status = 'TOKEN_ISSUE_AMBIGUOUS'; rec.lastError = 'NOTIFIER_TOKEN_200_PARSE_AMBIGUOUS'; rec.updatedAt = new Date(); rec.lastHttpStatus = 200; pg2UpsertMap_(rec);
    const err = new Error(rec.lastError); err.ambiguous = true; err.httpStatus = 200; throw err;
  }
  if (!tokenData.notificationToken) {
    rec.status = 'TOKEN_ISSUE_AMBIGUOUS'; rec.lastError = 'NOTIFICATION_TOKEN_EMPTY_AFTER_200'; rec.updatedAt = new Date(); rec.lastHttpStatus = 200; pg2UpsertMap_(rec);
    const err = new Error(rec.lastError); err.ambiguous = true; err.httpStatus = 200; throw err;
  }

  rec.notificationToken = String(tokenData.notificationToken);
  rec.expiresAt = new Date(Date.now() + Math.max(0, Number(tokenData.expiresIn || 0)) * 1000);
  rec.remainingCount = Number(tokenData.remainingCount || 0);
  rec.sessionId = String(tokenData.sessionId || '');
  rec.status = 'TOKEN_READY';
  rec.lastError = '';
  rec.updatedAt = new Date();
  rec.lastHttpStatus = 200;
  if (rec.remainingCount <= 0 || pg2Expired_(rec)) {
    rec.status = rec.remainingCount <= 0 ? 'TOKEN_EXHAUSTED' : 'TOKEN_EXPIRED'; rec.lastError = 'issued token is not sendable'; pg2UpsertMap_(rec);
    throw new Error('SERVICE_NOTIFICATION_TOKEN_NOT_SENDABLE_AFTER_ISSUE');
  }
  pg2UpsertMap_(rec);
  PropertiesService.getScriptProperties().setProperty(PG2.RETRY_PENDING_PROP, 'TRUE');
  return pg2PublicMap_(rec, false);
}

function purpleGatewayWorkerV2() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return;
  try {
    const ctl = pg2Control_();
    if (!pg2Bool_(ctl.enabled,false) || !pg2Bool_(ctl.workerEnabled,false)) return;
    const props = PropertiesService.getScriptProperties();
    const marker = pg2AirwaitLastUpdate_();
    const previousMarker = props.getProperty(PG2.LAST_MARKER_PROP) || '';
    const retryPending = props.getProperty(PG2.RETRY_PENDING_PROP) === 'TRUE';
    const snapshotExists = pg2SnapshotExists_();
    if (previousMarker && marker === previousMarker && !retryPending && snapshotExists) return;

    let rows;
    if (!snapshotExists || marker !== previousMarker) rows = pg2RefreshSnapshotWithMarker_(marker, true).rows;
    else rows = pg2ReadSnapshot_();

    const businessDate = pg2OperationalDate_(new Date());
    pg2ObserveCalls_(businessDate, rows);
    const maps = pg2MapsForDate_(businessDate);
    const now = Date.now();
    let keepRetryPending = false;

    maps.forEach(function(rec){
      if (!rec.notificationToken) return;
      let status = String(rec.status || '');
      if (['CALL_MESSAGE_SENT','CALL_SEND_AMBIGUOUS','CALL_SEND_ERROR','CALL_SEND_GAVE_UP','TOKEN_EXPIRED','TOKEN_EXHAUSTED'].indexOf(status) >= 0) return;
      if (status === 'CALL_SEND_PENDING') {
        const age = now - pg2Epoch_(rec.updatedAt);
        if (age >= PG2.PENDING_STALE_MS) {
          rec.status = 'CALL_SEND_AMBIGUOUS'; rec.lastError = 'stale CALL_SEND_PENDING; delivery outcome unknown'; rec.nextRetryAt = ''; rec.updatedAt = new Date(); pg2UpsertMap_(rec);
        } else keepRetryPending = true;
        return;
      }
      if (pg2Expired_(rec)) {
        rec.status = 'TOKEN_EXPIRED'; rec.lastError = 'service notification token expired'; rec.updatedAt = new Date(); rec.nextRetryAt = ''; pg2UpsertMap_(rec); return;
      }
      if (Number(rec.remainingCount || 0) <= 0) {
        rec.status = 'TOKEN_EXHAUSTED'; rec.lastError = 'remainingCount=0'; rec.updatedAt = new Date(); rec.nextRetryAt = ''; pg2UpsertMap_(rec); return;
      }
      const row = rows.find(function(x){ return pg2Receipt_(x && (x.number != null ? x.number : x.receiptNo)) === String(rec.receiptNo) && String(x && x.waitTypeId || '') === String(rec.waitTypeId); });
      if (!row || String(row.status || '') !== '0' || !pg2CallFlag_(row.isCalling)) return;
      if (!rec.callDetectedAt) { rec.callDetectedAt = new Date(); rec.updatedAt = new Date(); pg2UpsertMap_(rec); }
      const nextAt = pg2Epoch_(rec.nextRetryAt);
      if (status === 'CALL_SEND_RETRY' && nextAt && nextAt > now) { keepRetryPending = true; return; }

      try {
        pg2SendCallMessage_(rec);
      } catch (err) {
        if (err && err.ambiguous === true) return;
        const count = Number(rec.retryCount || 0) + 1;
        rec.retryCount = count;
        rec.lastError = pg2SafeError_(err);
        rec.lastHttpStatus = Number(err && err.httpStatus || 0) || '';
        rec.updatedAt = new Date();
        if (err && err.retryable === true && count <= PG2.MAX_SAFE_RETRIES) {
          const delaySec = [0,60,120,300][Math.min(count,3)] || 300;
          rec.status = 'CALL_SEND_RETRY'; rec.nextRetryAt = new Date(Date.now() + delaySec * 1000); keepRetryPending = true;
        } else {
          rec.status = err && err.retryable === true ? 'CALL_SEND_GAVE_UP' : 'CALL_SEND_ERROR'; rec.nextRetryAt = '';
        }
        pg2UpsertMap_(rec);
        pg2Log_('ERROR','CALL_NOTIFY',rec.receiptNo,rec.bindingId,rec.lastHttpStatus,rec.status,rec.lastError);
      }
    });

    props.setProperty(PG2.LAST_MARKER_PROP, marker);
    props.setProperty(PG2.RETRY_PENDING_PROP, keepRetryPending ? 'TRUE' : 'FALSE');
  } catch (err) {
    PropertiesService.getScriptProperties().setProperty(PG2.RETRY_PENDING_PROP, 'TRUE');
    pg2Log_('ERROR','WORKER','','','', 'ERROR', pg2SafeError_(err));
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function pg2SendCallMessage_(rec) {
  const templateName = String(PropertiesService.getScriptProperties().getProperty(PG2.TEMPLATE_PROP) || '').trim();
  if (!templateName) throw new Error('SERVICE_TEMPLATE_NOT_CONFIGURED');

  // Channel token step is safe to retry; do it before marking the send as pending.
  const channelToken = pg2ChannelToken_();
  const params = pg2TemplateParams_(rec);
  rec.status = 'CALL_SEND_PENDING'; rec.updatedAt = new Date(); rec.lastError = ''; rec.lastHttpStatus = ''; pg2UpsertMap_(rec);

  let response;
  try {
    response = UrlFetchApp.fetch(PG2.NOTIFIER_SEND, {
      method:'post',
      contentType:'application/json; charset=UTF-8',
      headers:{Authorization:'Bearer ' + channelToken},
      payload:JSON.stringify({templateName:templateName,params:params,notificationToken:String(rec.notificationToken || '')}),
      muteHttpExceptions:true,
      followRedirects:true
    });
  } catch (fetchErr) {
    rec.status = 'CALL_SEND_AMBIGUOUS'; rec.lastError = 'NOTIFIER_SEND_NETWORK_AMBIGUOUS ' + pg2SafeError_(fetchErr); rec.updatedAt = new Date(); rec.lastHttpStatus = ''; pg2UpsertMap_(rec);
    const e = new Error(rec.lastError); e.ambiguous = true; e.httpStatus = 0; throw e;
  }

  const code = response.getResponseCode();
  const text = String(response.getContentText() || '');
  if (code !== 200) {
    const e = pg2HttpError_('NOTIFIER_SEND', code, text);
    e.httpStatus = code;
    if (code >= 500) e.ambiguous = true;
    else if (code === 429) e.retryable = true;
    rec.status = e.ambiguous ? 'CALL_SEND_AMBIGUOUS' : (e.retryable ? 'CALL_SEND_RETRY' : 'CALL_SEND_ERROR');
    rec.lastError = pg2SafeError_(e); rec.lastHttpStatus = code; rec.updatedAt = new Date(); pg2UpsertMap_(rec);
    throw e;
  }

  let d;
  try { d = pg2Json_(text, 'notifier send'); }
  catch (parseErr) {
    rec.status = 'CALL_SEND_AMBIGUOUS'; rec.lastError = 'NOTIFIER_SEND_200_PARSE_AMBIGUOUS'; rec.lastHttpStatus = 200; rec.updatedAt = new Date(); pg2UpsertMap_(rec);
    const e = new Error(rec.lastError); e.ambiguous = true; e.httpStatus = 200; throw e;
  }

  rec.notificationToken = String(d.notificationToken || rec.notificationToken || '');
  rec.expiresAt = new Date(Date.now() + Math.max(0, Number(d.expiresIn || 0)) * 1000);
  rec.remainingCount = Number(d.remainingCount || 0);
  rec.sessionId = String(d.sessionId || rec.sessionId || '');
  rec.status = 'CALL_MESSAGE_SENT'; rec.lastError = ''; rec.lastSentAt = new Date(); rec.updatedAt = new Date(); rec.templateName = templateName;
  rec.retryCount = 0; rec.nextRetryAt = ''; rec.lastHttpStatus = 200;
  pg2UpsertMap_(rec);
  pg2Log_('INFO','CALL_NOTIFY',rec.receiptNo,rec.bindingId,200,'SENT','calling detected');
  return rec;
}

function pg2ReservationStatus_(p) {
  const businessDate = pg2Date_(p.businessDate || p.day || p.date) || pg2OperationalDate_(new Date());
  const receiptNo = pg2Receipt_(p.receiptNo || p.number);
  const waitTypeId = pg2WaitTypeId_(p.waitTypeId);
  const reserveId = pg2ReserveId_(p.reserveId);
  let rec = null;
  if (reserveId) rec = pg2FindMap_(businessDate, 'RID:' + reserveId);
  if (!rec && receiptNo && waitTypeId) {
    const maps = pg2MapsForDate_(businessDate);
    rec = maps.find(function(x){ return String(x.receiptNo) === receiptNo && String(x.waitTypeId) === waitTypeId; }) || null;
  }
  return rec ? pg2PublicMap_(rec, true) : {ok:true,found:false,version:PG2.VERSION};
}

function pg2CallInfo_(p) {
  const businessDate = pg2Date_(p.businessDate || p.day || p.date) || pg2OperationalDate_(new Date());
  const receiptNo = pg2Receipt_(p.receiptNo || p.number);
  const waitTypeId = pg2WaitTypeId_(p.waitTypeId);
  if (!receiptNo || !waitTypeId) return {ok:false,error:'VALIDATION_ERROR',version:PG2.VERSION};
  const sh = pg2Book_().getSheetByName(PG2.CALLS);
  const rows = pg2SheetObjects_(sh);
  const rec = rows.find(function(x){ return String(x.businessDate) === businessDate && String(x.receiptNo) === receiptNo && String(x.waitTypeId) === waitTypeId; });
  return rec ? {ok:true,found:true,version:PG2.VERSION,firstSeenAt:pg2DateText_(rec.firstSeenAt),lastSeenAt:pg2DateText_(rec.lastSeenAt)} : {ok:true,found:false,version:PG2.VERSION};
}

function pg2ObserveCalls_(businessDate, rows) {
  const sh = pg2Book_().getSheetByName(PG2.CALLS);
  const existing = pg2SheetObjects_(sh);
  const now = new Date();
  rows.forEach(function(row){
    if (String(row && row.status || '') !== '0' || !pg2CallFlag_(row && row.isCalling)) return;
    const receiptNo = pg2Receipt_(row && (row.number != null ? row.number : row.receiptNo));
    const waitTypeId = pg2WaitTypeId_(row && row.waitTypeId);
    if (!receiptNo || !waitTypeId) return;
    const found = existing.find(function(x){ return String(x.businessDate) === businessDate && String(x.receiptNo) === receiptNo && String(x.waitTypeId) === waitTypeId; });
    if (found) {
      const rowNo = Number(found.__row || 0); if (rowNo > 1) sh.getRange(rowNo,5).setValue(now);
    } else {
      sh.appendRow([businessDate,receiptNo,waitTypeId,now,now]);
      existing.push({businessDate:businessDate,receiptNo:receiptNo,waitTypeId:waitTypeId,firstSeenAt:now,lastSeenAt:now,__row:sh.getLastRow()});
    }
  });
}

function pg2RequestStatus_(requestId) {
  const id = pg2RequestId_(requestId);
  if (!id) return {ok:false,found:false,error:'REQUEST_ID_REQUIRED',version:PG2.VERSION};
  const raw = CacheService.getScriptCache().get('PG2_REQ_' + id);
  if (!raw) return {ok:true,found:false,version:PG2.VERSION};
  try { return Object.assign({found:true}, JSON.parse(raw)); }
  catch (_) { return {ok:false,found:false,error:'REQUEST_CACHE_INVALID',version:PG2.VERSION}; }
}

function pg2CacheRequest_(requestId, result) {
  const id = pg2RequestId_(requestId);
  if (!id) return;
  try { CacheService.getScriptCache().put('PG2_REQ_' + id, JSON.stringify(result), PG2.REQUEST_TTL); } catch (_) {}
}

function pg2RequireOperational_() {
  const h = pg2Health_();
  if (!h.spreadsheetConfigured) throw new Error('PURPLE_SPREADSHEET_NOT_CONFIGURED');
  if (!h.airwaitKeyConfigured) throw new Error('PURPLE_AIRWAIT_KEY_NOT_CONFIGURED');
  if (!h.testMode) throw new Error('PURPLE_TEST_MODE_REQUIRED');
  if (!h.enabled) throw new Error('PURPLE_SERVICE_DISABLED');
}

function pg2AirwaitPost_(url, payload, label) {
  const key = pg2AirwaitKey_();
  let response;
  try {
    response = UrlFetchApp.fetch(url + '?key=' + encodeURIComponent(key), {
      method:'post',headers:{Origin:PG2.ORIGIN},contentType:'application/x-www-form-urlencoded; charset=UTF-8',payload:payload,muteHttpExceptions:true,followRedirects:true
    });
  } catch (fetchErr) {
    throw new Error('AIRWAIT_' + label + '_NETWORK ' + pg2SafeError_(fetchErr));
  }
  const code = response.getResponseCode();
  const text = String(response.getContentText() || '');
  if (code < 200 || code >= 300) throw pg2HttpError_('AIRWAIT_' + label, code, text);
  const d = pg2Json_(text, label);
  if (!pg2AirwaitOk_(d)) throw new Error('AIRWAIT_' + label + '_ERROR ' + pg2ApiText_(text));
  return d;
}

function pg2AirwaitCreate_(payload) {
  const key = pg2AirwaitKey_();
  let response;
  try {
    response = UrlFetchApp.fetch(PG2.CREATE + '?key=' + encodeURIComponent(key), {
      method:'post',headers:{Origin:PG2.ORIGIN},contentType:'application/x-www-form-urlencoded; charset=UTF-8',payload:payload,muteHttpExceptions:true,followRedirects:true
    });
  } catch (fetchErr) {
    const e = new Error('AIRWAIT_CREATE_NETWORK_AMBIGUOUS_MANUAL_REVIEW ' + pg2SafeError_(fetchErr)); e.ambiguous = true; e.httpStatus = 0; throw e;
  }
  const code = response.getResponseCode();
  const text = String(response.getContentText() || '');
  if (code < 200 || code >= 300) {
    const e = pg2HttpError_('AIRWAIT_CREATE', code, text); e.httpStatus = code; if (code >= 500) e.ambiguous = true; throw e;
  }
  let d;
  try { d = pg2Json_(text, 'create reservation'); }
  catch (parseErr) {
    const e = new Error('AIRWAIT_CREATE_2XX_PARSE_AMBIGUOUS_MANUAL_REVIEW'); e.ambiguous = true; e.httpStatus = code; throw e;
  }
  if (!pg2AirwaitOk_(d)) throw new Error('AIRWAIT_CREATE_ERROR ' + pg2ApiText_(text));
  return d;
}

function pg2AirwaitLastUpdate_() {
  const url = PG2.LAST + '?key=' + encodeURIComponent(pg2AirwaitKey_()) + '&storeId=' + encodeURIComponent(PG2.STORE_ID);
  let response;
  try { response = UrlFetchApp.fetch(url,{method:'get',headers:{Origin:PG2.ORIGIN},muteHttpExceptions:true,followRedirects:true}); }
  catch (fetchErr) { throw new Error('AIRWAIT_LAST_NETWORK ' + pg2SafeError_(fetchErr)); }
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('AIRWAIT_LAST_HTTP_' + code);
  const d = pg2Json_(response.getContentText(), 'airwait last');
  if (!pg2AirwaitOk_(d)) throw new Error('AIRWAIT_LAST_ERROR');
  const marker = pg2FindMarker_(d);
  if (!marker) throw new Error('AIRWAIT_LAST_MARKER_EMPTY');
  return marker;
}

function pg2FindMarker_(payload) {
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

function pg2RefreshSnapshot_(force) {
  const marker = pg2AirwaitLastUpdate_();
  return pg2RefreshSnapshotWithMarker_(marker, Boolean(force));
}

function pg2RefreshSnapshotWithMarker_(marker, force) {
  const props = PropertiesService.getScriptProperties();
  const previous = props.getProperty(PG2.LAST_MARKER_PROP) || '';
  if (!force && previous && marker === previous && pg2SnapshotExists_()) return {rows:pg2ReadSnapshot_(),marker:marker,changed:false};
  const publicRows = pg2AllReservations_().map(pg2PublicReservation_).filter(function(r){ return r.number && r.waitTypeId; });
  pg2WriteSnapshot_(publicRows);
  props.setProperty(PG2.LAST_MARKER_PROP, marker);
  return {rows:publicRows,marker:marker,changed:true};
}

function pg2SnapshotExists_() {
  const sh = pg2Book_().getSheetByName(PG2.SNAPSHOT);
  return Boolean(sh && sh.getLastRow() >= 2);
}

function pg2ReadSnapshot_() {
  const sh = pg2Book_().getSheetByName(PG2.SNAPSHOT);
  if (!sh || sh.getLastRow() < 2) return [];
  return pg2SheetObjects_(sh).map(function(x){
    return {number:pg2Receipt_(x.number),waitTypeId:pg2WaitTypeId_(x.waitTypeId),waitTypeName:String(x.waitTypeName || ''),status:String(x.status || ''),isCalling:pg2CallFlag_(x.isCalling) ? '1' : '0'};
  }).filter(function(x){ return x.number && x.waitTypeId; });
}

function pg2WriteSnapshot_(rows) {
  const sh = ensurePg2Sheet_(pg2Book_(), PG2.SNAPSHOT, PG2.SNAPSHOT_HEADERS, Math.max(500, rows.length + 20));
  if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,PG2.SNAPSHOT_HEADERS.length).clearContent();
  if (rows.length) sh.getRange(2,1,rows.length,PG2.SNAPSHOT_HEADERS.length).setValues(rows.map(function(r){ return PG2.SNAPSHOT_HEADERS.map(function(h){ return r[h] == null ? '' : r[h]; }); }));
}

function pg2AllReservations_(filters) {
  const key = pg2AirwaitKey_();
  const out = [];
  let start = 1, total = Infinity, guard = 0;
  while (start <= total && guard++ < 40) {
    const payload = {storeId:PG2.STORE_ID,sortStatus:'0',isDesc:'0',start:String(start),limit:'100'};
    Object.keys(filters || {}).forEach(function(k){ const v = filters[k]; if (v !== undefined && v !== null && String(v) !== '') payload[k] = String(v); });
    const response = UrlFetchApp.fetch(PG2.RESERVATIONS + '?key=' + encodeURIComponent(key), {
      method:'post',headers:{Origin:PG2.ORIGIN},contentType:'application/x-www-form-urlencoded; charset=UTF-8',payload:payload,muteHttpExceptions:true,followRedirects:true
    });
    const code = response.getResponseCode(), text = String(response.getContentText() || '');
    if (code < 200 || code >= 300) throw pg2HttpError_('AIRWAIT_RESERVATIONS', code, text);
    const d = pg2Json_(text, 'reservations');
    if (!pg2AirwaitOk_(d)) throw new Error('AIRWAIT_RESERVATIONS_ERROR');
    const list = Array.isArray(d && d.innerDto && d.innerDto.reservations) ? d.innerDto.reservations : [];
    total = Number(d && d.innerDto && d.innerDto.count || list.length);
    Array.prototype.push.apply(out, list);
    if (!list.length || start + list.length > total) break;
    start += list.length;
  }
  return out;
}

function pg2FindLiveReservation_(receiptNo, waitTypeId) {
  const rows = pg2AllReservations_({waitTypeId:waitTypeId,status:'0',sortStatus:'0',isDesc:'0'}).filter(function(row){
    return pg2Receipt_(row && (row.number != null ? row.number : row.receiptNo)) === receiptNo && String(row && row.waitTypeId || '') === waitTypeId;
  });
  return rows.length === 1 ? rows[0] : null;
}

function pg2PublicReservation_(row) {
  return {
    number:pg2Receipt_(row && (row.number != null ? row.number : row.receiptNo)),
    waitTypeId:String(row && row.waitTypeId || ''),
    waitTypeName:String(row && row.waitTypeName || ''),
    status:String(row && row.status || ''),
    isCalling:pg2CallFlag_(row && row.isCalling) ? '1' : '0'
  };
}

function pg2ChannelToken_() {
  const props = PropertiesService.getScriptProperties();
  const secret = String(props.getProperty(PG2.CHANNEL_SECRET_PROP) || '').trim();
  if (!secret) throw new Error('PURPLE_CHANNEL_SECRET_NOT_CONFIGURED');
  const clientId = String(props.getProperty(PG2.CHANNEL_ID_PROP) || PG2.CHANNEL_ID_DEFAULT).trim();
  let response;
  try {
    response = UrlFetchApp.fetch(PG2.OAUTH, {
      method:'post',contentType:'application/x-www-form-urlencoded',payload:{grant_type:'client_credentials',client_id:clientId,client_secret:secret},muteHttpExceptions:true,followRedirects:true
    });
  } catch (fetchErr) {
    const e = new Error('CHANNEL_TOKEN_NETWORK ' + pg2SafeError_(fetchErr)); e.retryable = true; e.httpStatus = 0; throw e;
  }
  const code = response.getResponseCode(), text = String(response.getContentText() || '');
  if (code !== 200) {
    const e = pg2HttpError_('CHANNEL_TOKEN', code, text); e.httpStatus = code; if (code === 429 || code >= 500) e.retryable = true; throw e;
  }
  const d = pg2Json_(text, 'channel token');
  if (!d.access_token) throw new Error('CHANNEL_ACCESS_TOKEN_EMPTY');
  return String(d.access_token);
}

function pg2TemplateParams_(rec) {
  const raw = String(PropertiesService.getScriptProperties().getProperty(PG2.TEMPLATE_PARAMS_PROP) || '').trim();
  let obj = {};
  if (raw) obj = pg2Json_(raw, 'template params');
  if (!obj || Array.isArray(obj) || typeof obj !== 'object') throw new Error('TEMPLATE_PARAMS_NOT_OBJECT');
  const values = {
    receiptNo:String(rec.receiptNo || ''),
    waitTypeName:String(rec.waitTypeName || ''),
    callstatusUrl:PG2.CALLSTATUS_PERMANENT_BASE + '?view=callstatus&number=' + encodeURIComponent(String(rec.receiptNo || '')) + '&date=' + encodeURIComponent(String(rec.businessDate || ''))
  };
  const replace = function(v){ return String(v == null ? '' : v).replace(/\{\{(receiptNo|waitTypeName|callstatusUrl)\}\}/g, function(_, k){ return values[k] || ''; }); };
  const out = {};
  Object.keys(obj).slice(0,30).forEach(function(k){ out[String(k).slice(0,50)] = replace(obj[k]).slice(0,1000); });
  return out;
}

function pg2PublicMap_(rec, already) {
  return {
    ok:true,stored:true,found:true,version:PG2.VERSION,alreadyIssued:Boolean(already),
    receiptNo:String(rec.receiptNo || ''),bindingId:String(rec.bindingId || ''),bindingMode:String(rec.bindingMode || ''),reserveId:String(rec.reserveId || ''),
    waitTypeId:String(rec.waitTypeId || ''),status:String(rec.status || ''),remainingCount:Number(rec.remainingCount || 0),
    expiresAt:pg2DateText_(rec.expiresAt),lastSentAt:pg2DateText_(rec.lastSentAt),retryCount:Number(rec.retryCount || 0),error:String(rec.lastError || '')
  };
}

function pg2FindMap_(businessDate, bindingId) {
  const rows = pg2SheetObjects_(pg2Book_().getSheetByName(PG2.MAP));
  return rows.find(function(x){ return String(x.businessDate) === businessDate && String(x.bindingId) === bindingId; }) || null;
}

function pg2FindMapByTokenHash_(hash) {
  if (!hash) return null;
  const rows = pg2SheetObjects_(pg2Book_().getSheetByName(PG2.MAP));
  for (let i=rows.length-1;i>=0;i--) if (String(rows[i].liffTokenHash || '') === String(hash)) return rows[i];
  return null;
}

function pg2MapsForDate_(businessDate) {
  return pg2SheetObjects_(pg2Book_().getSheetByName(PG2.MAP)).filter(function(x){ return String(x.businessDate) === businessDate; });
}

function pg2UpsertMap_(rec) {
  const sh = ensurePg2Sheet_(pg2Book_(), PG2.MAP, PG2.MAP_HEADERS, 1200);
  const rows = pg2SheetObjects_(sh);
  let found = null;
  if (rec.__row) found = {__row:Number(rec.__row)};
  if (!found) found = rows.find(function(x){ return String(x.businessDate) === String(rec.businessDate) && String(x.bindingId) === String(rec.bindingId); }) || null;
  const values = PG2.MAP_HEADERS.map(function(h){ return rec[h] == null ? '' : rec[h]; });
  if (found && Number(found.__row || 0) > 1) { sh.getRange(found.__row,1,1,values.length).setValues([values]); rec.__row = found.__row; }
  else { sh.appendRow(values); rec.__row = sh.getLastRow(); }
  return rec;
}

function pg2Expired_(rec) {
  const t = rec && rec.expiresAt ? new Date(rec.expiresAt).getTime() : 0;
  return t > 0 && t <= Date.now();
}

function pg2Book_() {
  const id = String(PropertiesService.getScriptProperties().getProperty(PG2.SS_PROP) || '').trim();
  if (!id) throw new Error('PURPLE_SPREADSHEET_NOT_CONFIGURED');
  return SpreadsheetApp.openById(id);
}

function ensurePg2Sheet_(ss, name, headers, rows) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getMaxRows() < rows) sh.insertRowsAfter(sh.getMaxRows(), rows - sh.getMaxRows());
  if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  const current = sh.getRange(1,1,1,headers.length).getValues()[0].map(String);
  if (headers.some(function(h,i){ return current[i] !== h; })) sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  return sh;
}

function ensurePg2Control_(ss) {
  let sh = ss.getSheetByName(PG2.CONTROL);
  if (!sh) sh = ss.insertSheet(PG2.CONTROL);
  const defaults = [['key','value'],['version',PG2.VERSION],['enabled','FALSE'],['workerEnabled','FALSE'],['testMode','TRUE']];
  if (sh.getLastRow() < 2) sh.getRange(1,1,defaults.length,2).setValues(defaults);
  else {
    const values = sh.getDataRange().getDisplayValues();
    const seen = {};
    for (let i=1;i<values.length;i++) seen[String(values[i][0] || '').trim()] = i + 1;
    defaults.slice(1).forEach(function(row){
      if (seen[row[0]]) { if (row[0] === 'version') sh.getRange(seen[row[0]],2).setValue(row[1]); }
      else sh.appendRow(row);
    });
  }
  sh.setFrozenRows(1);
  return sh;
}

function pg2Control_() {
  const sh = pg2Book_().getSheetByName(PG2.CONTROL);
  const values = sh.getDataRange().getValues();
  const out = {};
  for (let i=1;i<values.length;i++) out[String(values[i][0] || '').trim()] = values[i][1];
  return out;
}

function pg2SheetObjects_(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  const lastColumn = Math.max(1, sh.getLastColumn());
  const values = sh.getRange(1,1,sh.getLastRow(),lastColumn).getValues();
  const headers = values[0].map(String);
  return values.slice(1).map(function(row, idx){
    const o = {__row:idx + 2};
    headers.forEach(function(h,i){ if (h) o[h] = row[i]; });
    return o;
  }).filter(function(o){ return Object.keys(o).some(function(k){ return k !== '__row' && String(o[k] == null ? '' : o[k]).trim() !== ''; }); });
}

function pg2Log_(level, action, receiptNo, bindingId, httpStatus, result, message) {
  try { ensurePg2Sheet_(pg2Book_(), PG2.LOG, PG2.LOG_HEADERS, 5000).appendRow([new Date(),level,action,receiptNo,bindingId,httpStatus,result,String(message || '').slice(0,500)]); }
  catch (_) {}
}

function pg2Out_(data, callback) {
  const json = JSON.stringify(data), cb = String(callback || '');
  if (cb && /^[A-Za-z_$][0-9A-Za-z_$]{0,80}$/.test(cb)) return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function pg2Json_(text, label) { try { return JSON.parse(String(text || '')); } catch (_) { throw new Error(String(label || 'JSON') + '_INVALID_JSON'); } }
function pg2SafeError_(err) { return String(err && err.message || err || 'UNKNOWN_ERROR').replace(/[\r\n\t]+/g,' ').slice(0,500); }
function pg2ApiText_(text) { return String(text || '').replace(/[\r\n\t]+/g,' ').slice(0,240); }
function pg2HttpError_(prefix, code, text) { const e = new Error(prefix + '_HTTP_' + Number(code || 0) + ' ' + pg2ApiText_(text)); e.httpStatus = Number(code || 0); return e; }
function pg2Bool_(v, fallback) { if (v === true || String(v).toUpperCase() === 'TRUE' || String(v) === '1') return true; if (v === false || String(v).toUpperCase() === 'FALSE' || String(v) === '0') return false; return Boolean(fallback); }
function pg2Int_(v, min, max) { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : min - 1; }
function pg2Receipt_(v) { const s = String(v == null ? '' : v).normalize('NFKC').trim(); return /^\d{1,12}$/.test(s) ? s.replace(/^0+(?=\d)/,'') : ''; }
function pg2ReserveId_(v) { const s = String(v == null ? '' : v).normalize('NFKC').trim(); return /^\d{1,12}$/.test(s) ? s.padStart(12,'0') : ''; }
function pg2WaitTypeId_(v) { const s = String(v == null ? '' : v).normalize('NFKC').trim(); return /^\d{4}$/.test(s) ? s : ''; }
function pg2Date_(v) { const s = String(v == null ? '' : v).normalize('NFKC').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function pg2JstDate_(d) { return Utilities.formatDate(d || new Date(), PG2.TZ, 'yyyy-MM-dd'); }
function pg2OperationalDate_(d) { const now = d || new Date(), hour = Number(Utilities.formatDate(now,PG2.TZ,'H')); return Utilities.formatDate(hour >= 18 ? new Date(now.getTime() + 24*60*60*1000) : now, PG2.TZ, 'yyyy-MM-dd'); }
function pg2DateText_(v) { if (!v) return ''; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? String(v || '') : Utilities.formatDate(d, PG2.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function pg2Epoch_(v) { if (!v) return 0; const d = v instanceof Date ? v : new Date(v); const n = d.getTime(); return Number.isFinite(n) ? n : 0; }
function pg2RequestId_(v) { const s = String(v || '').trim(); return /^[A-Za-z0-9_-]{8,120}$/.test(s) ? s : ''; }
function pg2CallFlag_(v) { return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true'; }
function pg2AirwaitKey_() { const key = String(PropertiesService.getScriptProperties().getProperty(PG2.AIRWAIT_KEY_PROP) || '').trim(); if (!key) throw new Error('PURPLE_AIRWAIT_KEY_NOT_CONFIGURED'); return key; }
function pg2AirwaitOk_(d) { return Boolean(d && (d.success === true || String(d.resultCode && d.resultCode.code || '') === '0000')); }
function pg2Sha256Hex_(value) { const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''), Utilities.Charset.UTF_8); return bytes.map(function(b){ const n = b < 0 ? b + 256 : b; return ('0' + n.toString(16)).slice(-2); }).join(''); }
function removePg2Triggers_() { ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction && t.getHandlerFunction() === 'purpleGatewayWorkerV2') ScriptApp.deleteTrigger(t); }); }
