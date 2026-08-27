/** ASOBooN Model backend — 00_Config.gs */
/**
 * ASOBooN Reception Model Backend 1.0.0-rc1
 * Secrets must live in Apps Script Script Properties only.
 */
const ASB_VERSION = '1.0.0-rc1';
const ASB_TZ = 'Asia/Tokyo';

const ASB_PROP = Object.freeze({
  SHEET_ID: 'ASOBOON_SHEET_ID',
  AIRWAIT_KEY: 'AIRWAIT_API_KEY',
  STORE_ID: 'AIRWAIT_STORE_ID',
  STAFF_KEY: 'STAFF_KEY',
  CALL_ENABLED: 'AIRWAIT_CALL_ENABLED',
  CALL_URL: 'AIRWAIT_CALL_API_URL',
  CALL_METHOD: 'AIRWAIT_CALLING_METHOD',
  COUNTER_ID: 'AIRWAIT_COUNTER_ID',
  AUTO_ENABLED: 'AUTO_ENABLED',
  AUTO_UPDATED_AT: 'AUTO_UPDATED_AT',
  AUTO_POOL: 'AUTO_POOL',
  AUTO_STOP_TIME: 'AUTO_STOP_TIME',
  SLOT_OVERRIDES: 'SLOT_OVERRIDES_JSON',
  BLOCKED_PATTERNS: 'BLOCKED_NAME_PATTERNS_JSON',
  BLOCKED_IDS: 'BLOCKED_WAIT_TYPE_IDS_JSON'
});

const ASB_SHEET = Object.freeze({
  RES: 'reservations',
  EVENTS: 'events',
  MUT: 'mutations'
});

const ASB_RES_HEADERS = [
  'createdAt','updatedAt','operationalDay','reserveId','receiptNo','waitTypeId',
  'waitTypeName','adults','paidChildren','infants','totalPeople','source',
  'airwaitStatus','isCalling','calledAt','cancelledAt','statusToken'
];
const ASB_EVENT_HEADERS = ['at','type','reserveId','receiptNo','waitTypeId','message'];
const ASB_MUT_HEADERS = ['createdAt','updatedAt','requestId','action','scope','status','resultJson','errorCode','errorMessage'];

const ASB_API = Object.freeze({
  waitTypes: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/wait/type/get',
  waitInfo: 'https://airwait.jp/WCSP/api/20160600/external/stateless/store/getWaitInfo',
  create: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/create',
  reservations: 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  callDefault: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/call'
});

function setupASOBooNModel() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('台帳スプレッドシートから Apps Script を開いて実行してください。');
  const props = PropertiesService.getScriptProperties();
  props.setProperty(ASB_PROP.SHEET_ID, ss.getId());
  if (!props.getProperty(ASB_PROP.STAFF_KEY)) props.setProperty(ASB_PROP.STAFF_KEY, asbRandomKey_());
  if (props.getProperty(ASB_PROP.CALL_ENABLED) == null) props.setProperty(ASB_PROP.CALL_ENABLED, '0');
  if (props.getProperty(ASB_PROP.AUTO_ENABLED) == null) props.setProperty(ASB_PROP.AUTO_ENABLED, '0');
  if (!props.getProperty(ASB_PROP.AUTO_UPDATED_AT)) props.setProperty(ASB_PROP.AUTO_UPDATED_AT, new Date().toISOString());
  if (!props.getProperty(ASB_PROP.AUTO_POOL)) props.setProperty(ASB_PROP.AUTO_POOL, '10');
  if (!props.getProperty(ASB_PROP.AUTO_STOP_TIME)) props.setProperty(ASB_PROP.AUTO_STOP_TIME, '18:00');
  if (!props.getProperty(ASB_PROP.CALL_METHOD)) props.setProperty(ASB_PROP.CALL_METHOD, 'KeyNORMAL');
  if (!props.getProperty(ASB_PROP.BLOCKED_PATTERNS)) {
    props.setProperty(ASB_PROP.BLOCKED_PATTERNS, JSON.stringify(['WEB','テスト','ご待機者専用','待機者専用']));
  }
  if (!props.getProperty(ASB_PROP.SLOT_OVERRIDES)) props.setProperty(ASB_PROP.SLOT_OVERRIDES, '{}');
  if (!props.getProperty(ASB_PROP.BLOCKED_IDS)) props.setProperty(ASB_PROP.BLOCKED_IDS, JSON.stringify(['0042']));

  ss.setSpreadsheetTimeZone(ASB_TZ);
  const res = asbEnsureSheet_(ss, ASB_SHEET.RES, ASB_RES_HEADERS);
  asbEnsureSheet_(ss, ASB_SHEET.EVENTS, ASB_EVENT_HEADERS);
  asbEnsureSheet_(ss, ASB_SHEET.MUT, ASB_MUT_HEADERS);
  res.getRange('D:F').setNumberFormat('@');
  SpreadsheetApp.flush();
  return checkASOBooNModel();
}

function checkASOBooNModel() {
  const props = PropertiesService.getScriptProperties();
  const required = [ASB_PROP.SHEET_ID, ASB_PROP.AIRWAIT_KEY, ASB_PROP.STORE_ID, ASB_PROP.STAFF_KEY];
  const missing = required.filter(k => !props.getProperty(k));
  return {
    ok: missing.length === 0,
    version: ASB_VERSION,
    missing,
    callEnabled: asbBoolProp_(ASB_PROP.CALL_ENABLED, false),
    autoEnabled: asbBoolProp_(ASB_PROP.AUTO_ENABLED, false),
    triggerInstalled: asbAutoTriggerInstalled_(),
    callMethod: props.getProperty(ASB_PROP.CALL_METHOD) || 'KeyNORMAL',
    callUrlConfigured: Boolean(props.getProperty(ASB_PROP.CALL_URL))
  };
}

function rotateASOBooNStaffKey() {
  const key = asbRandomKey_();
  PropertiesService.getScriptProperties().setProperty(ASB_PROP.STAFF_KEY, key);
  return key;
}

function installASOBooNAutoTrigger() {
  removeASOBooNAutoTrigger();
  ScriptApp.newTrigger('runASOBooNAutoCycle').timeBased().everyMinutes(1).create();
  asbEvent_('AUTO_TRIGGER_INSTALLED', '', '', '', 'every 1 minute');
  return { ok: true, installed: true };
}

function removeASOBooNAutoTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runASOBooNAutoCycle') ScriptApp.deleteTrigger(t);
  });
  return { ok: true, installed: false };
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || 'health');
  try {
    let out;
    if (action === 'health') out = asbHealth_();
    else if (action === 'publicConfig') out = asbPublicConfig_();
    else if (action === 'waitTypes') out = asbPublicWaitTypes_();
    else if (action === 'waitInfo') out = asbWaitInfo_();
    else if (action === 'mutationStatus') out = asbMutationStatus_(p);
    else if (action === 'reservationStatus') out = asbReservationStatus_(p);
    else if (action === 'staffSnapshot') { asbRequireStaff_(p.staffKey); out = asbStaffSnapshot_(); }
    else if (action === 'reservations') { asbRequireStaff_(p.staffKey); out = asbReservations_(p); }
    else out = { ok: false, error: 'unknown action' };
    return asbOutput_(out, p.callback);
  } catch (err) {
    return asbOutput_({ ok: false, version: ASB_VERSION, error: String(err && err.message || err) }, p.callback);
  }
}

function doPost(e) {
  const p = asbParsePost_(e);
  const action = String(p.action || '');
  const requestId = asbRequestId_(p.requestId);
  if (!requestId) return asbJson_({ ok: false, error: 'invalid requestId' });
  const staffActions = new Set(['setAutoEnabled','syncStatuses','event']);
  const scope = staffActions.has(action) ? 'staff' : 'public';

  try {
    if (scope === 'staff') asbRequireStaff_(p.staffKey);
    if (!asbClaimMutation_(requestId, action, scope)) return asbJson_({ ok: true, duplicate: true, requestId });
    let result;
    if (action === 'createReservation') result = asbCreateReservation_(p);
    else if (action === 'setAutoEnabled') result = asbSetAuto_(p);
    else if (action === 'syncStatuses') result = asbSyncStatusesAction_(p);
    else if (action === 'event') result = asbEventAction_(p);
    else throw new Error('unknown action');

    asbSaveMutation_({ requestId, action, scope, status: 'DONE', result, errorCode: '', errorMessage: '' });
    return asbJson_({ ok: true, requestId });
  } catch (err) {
    const code = asbErrorCode_(err);
    try {
      asbSaveMutation_({ requestId, action, scope, status: 'ERROR', result: null, errorCode: code, errorMessage: String(err && err.message || err).slice(0, 500) });
    } catch (_) {}
    return asbJson_({ ok: false, requestId, errorCode: code });
  }
}

function asbHealth_() {
  return {
    ok: true,
    version: ASB_VERSION,
    service: 'asoboon-reception-model',
    now: new Date().toISOString(),
    serverAuto: true,
    callEnabled: asbBoolProp_(ASB_PROP.CALL_ENABLED, false),
    triggerInstalled: asbAutoTriggerInstalled_()
  };
}

function asbPublicConfig_() {
  return {
    ok: true,
    version: ASB_VERSION,
    brandName: 'ASOBooN',
    maxTotalPeople: 10,
    childrenPerAdult: 3,
    serverAuto: true
  };
}
