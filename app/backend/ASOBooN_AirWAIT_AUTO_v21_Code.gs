/**
 * ASOBooN AirWAIT AUTO v21
 * 2026-08-31
 *
 * AirWAIT担当部署の正式回答に合わせた構成:
 * 1) 定期実行するAirWAIT APIは「外部向け最終更新日時取得（Stateless）」のみ
 * 2) 更新検知時だけ「外部向け呼出番号取得API」を実行
 * 3) 呼出中件数の減少を検知した場合だけ「外部向け予約呼出API」を実行
 *
 * 補足:
 * - Apps Scriptの時間トリガーは最短1分のため、1分ごとに最終更新日時だけ確認する。
 * - 各枠の指定時刻到達時の「初期呼出」は1枠1日1回だけ実行する。
 *   これは定期ポーリングではない。開始時に待ちが0件なら、開始後最初の受付を初期呼出として扱う。
 * - lastUpdate取得失敗時にreservationsへフォールバックしない（fail closed）。
 * - 営業区分は共通の「営業日カレンダー」APIだけを正本にする。
 * - AIRWAIT_API_KEY はScript Propertiesに保存し、コードへ書かない。
 */

const AUTO21 = Object.freeze({
  VERSION: '21.0.0',
  TZ: 'Asia/Tokyo',
  ORIGIN: 'https://asoboon.github.io',
  STORE_ID: 'KR01205179',
  API_KEY_PROPERTY: 'AIRWAIT_API_KEY',
  CONTROL_SHEET: 'CONTROL',
  MAP_SHEET: 'RESERVE_MAP',
  LOG_SHEET: 'CALL_LOG',
  CALENDAR_API: 'https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec',
  LAST_UPDATE_URL: 'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless',
  RESERVATIONS_URL: 'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  CALL_URL: 'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/call',
  DEFAULT_SCHEDULE: Object.freeze({
    '0042': '08:00',
    '0023': '09:30',
    '0025': '14:00',
    '0035': '10:15',
    '0037': '13:45',
    '0029': '10:25',
    '0031': '12:50',
    '0033': '15:15'
  }),
  PRODUCTION_BY_BUSINESS_TYPE: Object.freeze({
    '平日': Object.freeze(['0023','0025']),
    '平日特定日': Object.freeze(['0035','0037']),
    '土日祝日': Object.freeze(['0029','0031','0033']),
    '休館': Object.freeze([])
  })
});

function setupAutoV21() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('このGASをAUTO管理スプレッドシートから開いてください。');
  ensureControlSheet_(ss);
  ensureMapSheet_(ss);
  ensureLogSheet_(ss);
  removeWorkerTriggers_();
  ScriptApp.newTrigger('autoWorkerV21').timeBased().everyMinutes(1).create();
  console.log('AUTO v21 setup complete. 初期値は autoEnabled=FALSE / testMode=TRUE です。');
}

function autoWorkerV21() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error('AUTO管理スプレッドシートを取得できません。');
    const ctl = readControl_(ss);
    if (!asBool_(ctl.autoEnabled)) return;

    const now = new Date();
    const day = getBusinessDay_(now, ctl);
    if (!day || day.isClosed || day.businessType === '休館') return;

    const activeIds = activeWaitTypeIds_(day.businessType, ctl);
    if (!activeIds.length) return;

    const schedule = schedule_(ctl);
    const dueIds = activeIds.filter(id => isSlotStarted_(id, schedule, now));
    if (!dueIds.length) return;

    // 指定時刻到達時の初期呼出。各枠1日1回。待ちが0ならPRIMEDにせず、後続の最初の受付を初期呼出にする。
    processInitialStarts_(ss, dueIds, day, ctl, now);

    // ★ 定期実行するAirWAIT APIはここだけ。
    let marker;
    try {
      marker = getLastUpdate_();
    } catch (error) {
      log_(ss, 'LAST_UPDATE_ERROR', '', '', '', String(error.message || error));
      return; // 絶対にreservationsへフォールバックしない
    }

    const props = PropertiesService.getScriptProperties();
    const prevMarker = props.getProperty('AUTO21_LAST_UPDATE') || '';
    if (!prevMarker) {
      props.setProperty('AUTO21_LAST_UPDATE', marker);
      return;
    }
    if (marker === prevMarker) return;

    // 更新を検知した時だけ呼出番号取得APIへ進む。
    let rows;
    try {
      rows = getAllReservations_();
    } catch (error) {
      log_(ss, 'RESERVATIONS_ERROR', '', '', '', String(error.message || error));
      return;
    }

    for (const waitTypeId of dueIds) {
      processUpdatedSlot_(ss, rows, waitTypeId, day, ctl, now);
    }

    // 更新処理が正常に終わった時だけマーカーを進める。
    props.setProperty('AUTO21_LAST_UPDATE', marker);
  } catch (error) {
    try { log_(SpreadsheetApp.getActiveSpreadsheet(), 'WORKER_ERROR', '', '', '', String(error.message || error)); } catch (_) {}
    console.error(error);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function processInitialStarts_(ss, dueIds, day, ctl, now) {
  const props = PropertiesService.getScriptProperties();
  const date = jstDate_(now);
  const need = dueIds.filter(id => props.getProperty(stateKey_('START_SEEN', date, id)) !== '1');
  if (!need.length) return;

  // 指定時刻到達に伴う単発取得。定期ポーリングではない。
  let rows;
  try {
    rows = getAllReservations_();
  } catch (error) {
    log_(ss, 'INITIAL_RESERVATIONS_ERROR', '', '', '', String(error.message || error));
    return;
  }

  for (const id of need) {
    const result = fillInitialPool_(ss, rows, id, day, ctl, now);
    props.setProperty(stateKey_('START_SEEN', date, id), '1');
    if (result.primed) props.setProperty(stateKey_('PRIMED', date, id), '1');
    props.setProperty(stateKey_('CALLING', date, id), String(result.callingAfter));
  }
}

function processUpdatedSlot_(ss, rows, waitTypeId, day, ctl, now) {
  const props = PropertiesService.getScriptProperties();
  const date = jstDate_(now);
  const slotRows = rowsForWaitType_(rows, waitTypeId);
  const currentCalling = callingRows_(slotRows).length;
  const waiting = waitingRows_(slotRows);
  const callingKey = stateKey_('CALLING', date, waitTypeId);
  const primedKey = stateKey_('PRIMED', date, waitTypeId);
  const prevRaw = props.getProperty(callingKey);
  const prevCalling = prevRaw === null ? null : Number(prevRaw);
  let primed = props.getProperty(primedKey) === '1';
  let callingAfter = currentCalling;

  // 指定時刻後、開始時に待ちが0だった場合の「最初の初期呼出」。
  if (!primed && currentCalling === 0 && waiting.length > 0) {
    const result = fillPool_(ss, slotRows, waitTypeId, ctl, now, 'INITIAL_AFTER_START');
    callingAfter = result.callingAfter;
    primed = result.called > 0 || callingAfter > 0;
    if (primed) props.setProperty(primedKey, '1');
    props.setProperty(callingKey, String(callingAfter));
    return;
  }

  if (prevCalling === null) {
    props.setProperty(callingKey, String(currentCalling));
    return;
  }

  // AirWAIT回答どおり「呼出中件数の減少」を検知した時だけ呼出APIへ進む。
  if (currentCalling < prevCalling) {
    const result = fillPool_(ss, slotRows, waitTypeId, ctl, now, 'REPLENISH_AFTER_DECREASE');
    callingAfter = result.callingAfter;

    // 呼出中0・待ち0まで完全に空になったら、次の新規受付を再び「初期呼出」として扱えるようにする。
    if (callingAfter === 0 && waitingRows_(slotRows).length === 0) {
      props.deleteProperty(primedKey);
      primed = false;
    }
  }

  props.setProperty(callingKey, String(callingAfter));
}

function fillInitialPool_(ss, rows, waitTypeId, day, ctl, now) {
  const slotRows = rowsForWaitType_(rows, waitTypeId);
  return fillPool_(ss, slotRows, waitTypeId, ctl, now, 'INITIAL_AT_START');
}

function fillPool_(ss, slotRows, waitTypeId, ctl, now, reason) {
  const target = Math.max(1, Math.min(30, Number(ctl.targetCalling || 10)));
  const current = callingRows_(slotRows).length;
  const shortage = Math.max(0, target - current);
  if (!shortage) return { called: 0, callingAfter: current };

  const candidates = waitingRows_(slotRows).slice(0, shortage);
  let called = 0;
  for (const row of candidates) {
    const receiptNo = receiptNo_(row);
    const reserveId = reserveId_(row) || findMappedReserveId_(ss, receiptNo, waitTypeId);
    if (!reserveId) {
      log_(ss, 'SKIP_MISSING_RESERVE_ID', waitTypeId, receiptNo, '', reason);
      continue;
    }
    try {
      callReservation_(reserveId, String(ctl.callingMethodType || '00'));
      called++;
      log_(ss, 'CALLED', waitTypeId, receiptNo, reserveId, reason);
      Utilities.sleep(1200);
    } catch (error) {
      log_(ss, 'CALL_ERROR', waitTypeId, receiptNo, reserveId, String(error.message || error));
      break; // 実呼出エラー時は連続呼出を止める
    }
  }
  return { called: called, callingAfter: current + called };
}

function getLastUpdate_() {
  const key = airwaitKey_();
  const url = AUTO21.LAST_UPDATE_URL + '?key=' + encodeURIComponent(key) + '&storeId=' + encodeURIComponent(AUTO21.STORE_ID);
  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Origin: AUTO21.ORIGIN },
    muteHttpExceptions: true,
    followRedirects: true
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('lastUpdate HTTP ' + code);
  const data = parseJson_(res.getContentText(), 'lastUpdate');
  if (!apiOk_(data)) throw new Error(resultMessage_(data, 'lastUpdate API error'));
  const marker = extractUpdateMarker_(data);
  if (!marker) throw new Error('lastUpdate markerを取得できません。');
  return marker;
}

function getAllReservations_() {
  const out = [];
  let start = 1;
  let total = Infinity;
  let guard = 0;
  while (start <= total && guard++ < 40) {
    const page = getReservationsPage_(start);
    total = page.count || page.rows.length;
    out.push.apply(out, page.rows);
    if (!page.rows.length || start + page.rows.length > total) break;
    start += page.rows.length;
  }
  return out;
}

function getReservationsPage_(start) {
  const key = airwaitKey_();
  const url = AUTO21.RESERVATIONS_URL + '?key=' + encodeURIComponent(key);
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Origin: AUTO21.ORIGIN },
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    payload: {
      storeId: AUTO21.STORE_ID,
      sortStatus: '0',
      isDesc: '0',
      start: String(start),
      limit: '100'
    },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('reservations HTTP ' + code);
  const data = parseJson_(res.getContentText(), 'reservations');
  if (!apiOk_(data)) throw new Error(resultMessage_(data, 'reservations API error'));
  return {
    count: Number(data && data.innerDto && data.innerDto.count || 0),
    rows: Array.isArray(data && data.innerDto && data.innerDto.reservations) ? data.innerDto.reservations : []
  };
}

function callReservation_(reserveId, callingMethodType) {
  const key = airwaitKey_();
  const url = AUTO21.CALL_URL + '?key=' + encodeURIComponent(key);
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Origin: AUTO21.ORIGIN },
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    payload: {
      storeId: AUTO21.STORE_ID,
      reserveId: normalizeReserveId_(reserveId),
      callingMethodType: String(callingMethodType || '00')
    },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('reserve/call HTTP ' + code);
  const data = parseJson_(res.getContentText(), 'reserve/call');
  if (!apiOk_(data)) throw new Error(resultMessage_(data, 'reserve/call API error'));
  return data;
}

function getBusinessDay_(now, ctl) {
  if (asBool_(ctl.testMode)) return { businessType: 'TEST', isClosed: false, operationalDate: jstDate_(now), closingTime: '18:00' };
  const url = String(ctl.calendarApiUrl || AUTO21.CALENDAR_API) + '?action=current&date=' + encodeURIComponent(jstDate_(now));
  const res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true, followRedirects: true });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('営業日カレンダー HTTP ' + code);
  const data = parseJson_(res.getContentText(), 'calendar');
  if (!data || data.ok !== true) throw new Error(String(data && data.message || '営業日カレンダーを取得できません。'));
  const type = String(data.businessType || '').trim();
  if (!Object.prototype.hasOwnProperty.call(AUTO21.PRODUCTION_BY_BUSINESS_TYPE, type)) throw new Error('未対応の営業区分: ' + type);
  return {
    businessType: type,
    isClosed: Boolean(data.isClosed) || type === '休館',
    operationalDate: String(data.operationalDate || jstDate_(now)),
    closingTime: data.closingTime ? String(data.closingTime) : (type === '土日祝日' ? '18:00' : '17:00')
  };
}

function activeWaitTypeIds_(businessType, ctl) {
  if (asBool_(ctl.testMode)) return [String(ctl.testWaitTypeId || '0042')];
  return (AUTO21.PRODUCTION_BY_BUSINESS_TYPE[businessType] || []).slice();
}

function schedule_(ctl) {
  const base = Object.assign({}, AUTO21.DEFAULT_SCHEDULE);
  const raw = String(ctl.slotScheduleJson || '').trim();
  if (!raw) return base;
  try {
    const custom = JSON.parse(raw);
    Object.keys(custom || {}).forEach(k => { if (/^\d{4}$/.test(k) && /^\d{2}:\d{2}$/.test(String(custom[k]))) base[k] = String(custom[k]); });
  } catch (_) {}
  return base;
}

function isSlotStarted_(waitTypeId, schedule, now) {
  const start = schedule[String(waitTypeId)] || '';
  if (!/^\d{2}:\d{2}$/.test(start)) return false;
  return jstMinutes_(now) >= clockMinutes_(start);
}

function rowsForWaitType_(rows, id) {
  return rows.filter(r => String(r && r.waitTypeId || '') === String(id));
}

function callingRows_(rows) {
  return rows.filter(r => isCalling_(r));
}

function waitingRows_(rows) {
  return rows.filter(r => String(r && r.status || '') === '0' && !isCallingFlag_(r && r.isCalling))
    .sort((a,b) => receiptNumber_(a) - receiptNumber_(b));
}

function isCalling_(row) {
  return isCallingFlag_(row && row.isCalling) && String(row && row.status || '') !== '1';
}

function isCallingFlag_(v) {
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
}

function receiptNo_(row) {
  return String(row && (row.number != null ? row.number : row.receiptNo) || '').normalize('NFKC').replace(/[^0-9]/g, '');
}

function receiptNumber_(row) {
  const n = Number(receiptNo_(row));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function reserveId_(row) {
  const candidates = [row && row.reserveId, row && row.reserveID, row && row.reservationId, row && row.reservationID];
  for (const v of candidates) {
    const id = normalizeReserveId_(v);
    if (id) return id;
  }
  return '';
}

function normalizeReserveId_(v) {
  const digits = String(v == null ? '' : v).normalize('NFKC').replace(/\D/g, '');
  if (!digits || digits.length > 12) return '';
  return digits.padStart(12, '0');
}

function doPost(e) {
  try {
    const p = Object.assign({}, e && e.parameter || {});
    const reserveId = normalizeReserveId_(p.reserveId);
    const receiptNo = String(p.receiptNo || '').normalize('NFKC').replace(/\D/g, '');
    const waitTypeId = String(p.waitTypeId || '').trim();
    if (!reserveId || !receiptNo || !/^\d{4}$/.test(waitTypeId)) return json_({ ok:false, error:'VALIDATION_ERROR' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureMapSheet_(ss);
    upsertMap_(ss, {
      receivedAt: new Date(), receiptNo: receiptNo, reserveId: reserveId, waitTypeId: waitTypeId,
      waitTypeName: String(p.waitTypeName || ''), operationalDay: String(p.operationalDay || ''),
      source: String(p.source || ''), adults: String(p.adults || ''), paidChildren: String(p.paidChildren || ''),
      infants: String(p.infants || ''), totalPeople: String(p.totalPeople || '')
    });
    return json_({ ok:true });
  } catch (error) {
    return json_({ ok:false, error:String(error.message || error) });
  }
}

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || 'health');
  if (action === 'health') return json_({ ok:true, service:'ASOBooN AirWAIT AUTO', version:AUTO21.VERSION, periodicAirwaitApi:'lastUpdate-only' });
  if (action === 'status') {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ctl = readControl_(ss);
    return json_({ ok:true, version:AUTO21.VERSION, autoEnabled:asBool_(ctl.autoEnabled), testMode:asBool_(ctl.testMode), targetCalling:Number(ctl.targetCalling || 10) });
  }
  return json_({ ok:false, error:'UNKNOWN_ACTION' });
}

function ensureControlSheet_(ss) {
  let sh = ss.getSheetByName(AUTO21.CONTROL_SHEET);
  if (!sh) sh = ss.insertSheet(AUTO21.CONTROL_SHEET);
  const defaults = [
    ['systemVersion', AUTO21.VERSION],
    ['autoEnabled', 'FALSE'],
    ['targetCalling', '10'],
    ['testMode', 'TRUE'],
    ['testWaitTypeId', '0042'],
    ['callingMethodType', '00'],
    ['calendarApiUrl', AUTO21.CALENDAR_API],
    ['slotScheduleJson', JSON.stringify(AUTO21.DEFAULT_SCHEDULE)]
  ];
  const existing = {};
  if (sh.getLastRow() > 0) sh.getRange(1,1,sh.getLastRow(),2).getValues().forEach(r => { const k=String(r[0]||'').trim(); if(k) existing[k]=true; });
  const add = defaults.filter(r => !existing[r[0]]);
  if (add.length) sh.getRange(sh.getLastRow()+1,1,add.length,2).setValues(add);
  return sh;
}

function ensureMapSheet_(ss) {
  let sh = ss.getSheetByName(AUTO21.MAP_SHEET);
  if (!sh) sh = ss.insertSheet(AUTO21.MAP_SHEET);
  const headers = ['receivedAt','receiptNo','reserveId','waitTypeId','waitTypeName','operationalDay','source','adults','paidChildren','infants','totalPeople','updatedAt'];
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.getRange('B:D').setNumberFormat('@');
  return sh;
}

function ensureLogSheet_(ss) {
  let sh = ss.getSheetByName(AUTO21.LOG_SHEET);
  if (!sh) sh = ss.insertSheet(AUTO21.LOG_SHEET);
  const headers = ['at','event','waitTypeId','receiptNo','reserveId','detail'];
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.getRange('C:E').setNumberFormat('@');
  return sh;
}

function readControl_(ss) {
  const sh = ensureControlSheet_(ss);
  const out = {};
  if (sh.getLastRow() < 1) return out;
  sh.getRange(1,1,sh.getLastRow(),2).getDisplayValues().forEach(r => { const k=String(r[0]||'').trim(); if(k) out[k]=r[1]; });
  return out;
}

function upsertMap_(ss, rec) {
  const sh = ensureMapSheet_(ss);
  const last = sh.getLastRow();
  let target = 0;
  if (last >= 2) {
    const vals = sh.getRange(2,2,last-1,3).getDisplayValues();
    for (let i=vals.length-1;i>=0;i--) {
      if (String(vals[i][0]) === rec.receiptNo && String(vals[i][2]) === rec.waitTypeId) { target = i+2; break; }
    }
  }
  const row = [rec.receivedAt,rec.receiptNo,rec.reserveId,rec.waitTypeId,rec.waitTypeName,rec.operationalDay,rec.source,rec.adults,rec.paidChildren,rec.infants,rec.totalPeople,new Date()];
  if (target) sh.getRange(target,1,1,row.length).setValues([row]);
  else sh.getRange(last+1,1,1,row.length).setValues([row]);
}

function findMappedReserveId_(ss, receiptNo, waitTypeId) {
  const sh = ensureMapSheet_(ss);
  const last = sh.getLastRow();
  if (last < 2) return '';
  const vals = sh.getRange(2,2,last-1,3).getDisplayValues();
  for (let i=vals.length-1;i>=0;i--) {
    if (String(vals[i][0]) === String(receiptNo) && String(vals[i][2]) === String(waitTypeId)) return normalizeReserveId_(vals[i][1]);
  }
  return '';
}

function log_(ss, event, waitTypeId, receiptNo, reserveId, detail) {
  if (!ss) return;
  const sh = ensureLogSheet_(ss);
  sh.appendRow([new Date(),String(event||''),String(waitTypeId||''),String(receiptNo||''),String(reserveId||''),String(detail||'')]);
}

function airwaitKey_() {
  const key = PropertiesService.getScriptProperties().getProperty(AUTO21.API_KEY_PROPERTY);
  if (!key) throw new Error('Script Properties に AIRWAIT_API_KEY がありません。');
  return key;
}

function extractUpdateMarker_(payload) {
  const preferred = ['lastUpdDate','lastUpdate','lastUpdateDate','lastUpdatedAt','updateDate','updatedAt','lastUpdDateStateless'];
  const seen = [];
  function walk(v, depth) {
    if (!v || typeof v !== 'object' || depth > 5 || seen.indexOf(v) >= 0) return '';
    seen.push(v);
    for (const key of preferred) if (v[key] != null && String(v[key]).trim()) return String(v[key]).trim();
    for (const key of Object.keys(v)) {
      if (/last.*upd|update.*date|updated/i.test(key) && v[key] != null && typeof v[key] !== 'object' && String(v[key]).trim()) return String(v[key]).trim();
    }
    for (const key of Object.keys(v)) { const found = walk(v[key], depth+1); if (found) return found; }
    return '';
  }
  return walk(payload,0);
}

function apiOk_(d) { return d && (d.success === true || String(d.resultCode && d.resultCode.code || '') === '0000'); }
function resultMessage_(d, fallback) { return String(d && d.resultCode && d.resultCode.defaultMessage || fallback); }
function parseJson_(text, label) { try { return JSON.parse(text); } catch (_) { throw new Error(label + ' JSON parse error'); } }
function asBool_(v) { return v === true || v === 1 || v === '1' || String(v||'').toUpperCase() === 'TRUE'; }
function stateKey_(kind, date, id) { return 'AUTO21_' + kind + '_' + date + '_' + id; }
function clockMinutes_(t) { const m=String(t||'').match(/^(\d{2}):(\d{2})$/); return m ? Number(m[1])*60+Number(m[2]) : 0; }
function jstDate_(d) { return Utilities.formatDate(d, AUTO21.TZ, 'yyyy-MM-dd'); }
function jstMinutes_(d) { return Number(Utilities.formatDate(d,AUTO21.TZ,'H'))*60 + Number(Utilities.formatDate(d,AUTO21.TZ,'m')); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function removeWorkerTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (['autoWorkerV21','autoWorker','autoWorkerV20'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
}

function resetAutoV21State() {
  const props = PropertiesService.getScriptProperties();
  props.getKeys().filter(k => /^AUTO21_/.test(k)).forEach(k => props.deleteProperty(k));
  console.log('AUTO v21 runtime state reset. AIRWAIT_API_KEY は削除していません。');
}

function testAutoV21Health() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ctl = readControl_(ss);
  const day = getBusinessDay_(new Date(), ctl);
  console.log(JSON.stringify({version:AUTO21.VERSION,control:ctl,businessDay:day,lastUpdate:getLastUpdate_()}, null, 2));
}
