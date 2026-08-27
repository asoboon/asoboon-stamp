/** ASOBooN Model backend — 30_Data.gs */
function asbSyncStatusesAction_(p) {
  let items;
  try { items = JSON.parse(String(p.items || '[]')); } catch (_) { throw new Error('invalid items JSON'); }
  if (!Array.isArray(items)) throw new Error('items must be array');
  items.slice(0, 3000).forEach(item => {
    const id = asbReserveId_(item.reserveId);
    if (!id) return;
    const status = asbText_(item.status, 20);
    const isCalling = String(item.isCalling) === '1' ? '1' : '0';
    const patch = { airwaitStatus: status, isCalling };
    if (status === '3') patch.cancelledAt = new Date().toISOString();
    asbUpdateReservation_(id, patch);
  });
  return { count: Math.min(items.length, 3000) };
}

function asbEventAction_(p) {
  asbEvent_(asbText_(p.type || 'EVENT', 50), asbReserveId_(p.reserveId), asbText_(p.receiptNo, 50), asbText_(p.waitTypeId, 50), asbText_(p.message, 500));
  return { ok: true };
}

function asbMutationStatus_(p) {
  const requestId = asbRequestId_(p.requestId);
  if (!requestId) return { ok: false, error: 'invalid requestId' };
  const row = asbGetMutation_(requestId);
  if (!row) return { ok: true, found: false };
  if (row.scope === 'staff') asbRequireStaff_(p.staffKey);
  let result = {};
  try { result = row.resultJson ? JSON.parse(row.resultJson) : {}; } catch (_) {}
  return { ok: true, found: true, status: row.status, action: row.action, result, errorCode: row.errorCode || '', errorMessage: row.errorMessage || '' };
}

function asbUpsertReservation_(rec) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = asbSheet_(ASB_SHEET.RES, ASB_RES_HEADERS);
    const row = asbFindReservationRow_(rec.reserveId);
    const now = new Date().toISOString();
    let created = now, status = '0', calling = '0', called = '', cancelled = '', oldToken = '';
    if (row > 0) {
      const old = sh.getRange(row, 1, 1, ASB_RES_HEADERS.length).getDisplayValues()[0];
      created = old[0] || now; status = old[12] || '0'; calling = old[13] || '0'; called = old[14] || ''; cancelled = old[15] || ''; oldToken = old[16] || '';
    }
    const values = [[created, now, rec.operationalDay, String(rec.reserveId), String(rec.receiptNo), String(rec.waitTypeId), rec.waitTypeName, rec.adults, rec.paidChildren, rec.infants, rec.totalPeople, rec.source, status, calling, called, cancelled, rec.statusToken || oldToken]];
    const target = row > 0 ? row : Math.max(2, sh.getLastRow() + 1);
    asbEnsureRows_(sh, target);
    sh.getRange(target, 4, 1, 3).setNumberFormat('@');
    sh.getRange(target, 1, 1, ASB_RES_HEADERS.length).setValues(values);
    SpreadsheetApp.flush();
    return { row: target, isNew: row < 1 };
  } finally { lock.releaseLock(); }
}

function asbUpdateReservation_(id, patch) {
  const sh = asbSheet_(ASB_SHEET.RES, ASB_RES_HEADERS);
  const row = asbFindReservationRow_(id);
  if (row < 1) return false;
  const values = sh.getRange(row, 1, 1, ASB_RES_HEADERS.length).getValues()[0];
  Object.keys(patch || {}).forEach(k => {
    const i = ASB_RES_HEADERS.indexOf(k);
    if (i >= 0) values[i] = patch[k];
  });
  values[1] = new Date().toISOString();
  sh.getRange(row, 1, 1, ASB_RES_HEADERS.length).setValues([values]);
  return true;
}

function asbGetReservations_(day) {
  const sh = asbSheet_(ASB_SHEET.RES, ASB_RES_HEADERS);
  const last = sh.getLastRow();
  if (last <= 1) return [];
  return sh.getRange(2, 1, last - 1, ASB_RES_HEADERS.length).getValues()
    .map(r => asbRowObj_(r, ASB_RES_HEADERS))
    .map(x => Object.assign({}, x, { operationalDay: asbNormalizeDay_(x.operationalDay), reserveId: asbReserveId_(x.reserveId) }))
    .filter(x => !day || x.operationalDay === day)
    .sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
}

function asbFindReservation_(id) {
  const rows = asbGetReservations_('');
  return rows.find(x => x.reserveId === asbReserveId_(id)) || null;
}

function asbFindReservationRow_(id) {
  const sh = asbSheet_(ASB_SHEET.RES, ASB_RES_HEADERS);
  const last = sh.getLastRow();
  if (last <= 1) return -1;
  const target = asbReserveId_(id);
  const values = sh.getRange(2, 4, last - 1, 1).getDisplayValues();
  for (let i = 0; i < values.length; i++) if (asbReserveId_(values[i][0]) === target) return i + 2;
  return -1;
}

function asbEvent_(type, reserveId, receiptNo, waitTypeId, message) {
  const sh = asbSheet_(ASB_SHEET.EVENTS, ASB_EVENT_HEADERS);
  sh.appendRow([new Date().toISOString(), type, reserveId || '', receiptNo || '', waitTypeId || '', message || '']);
}

function asbClaimMutation_(requestId, action, scope) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = asbSheet_(ASB_SHEET.MUT, ASB_MUT_HEADERS);
    if (asbFindMutationRow_(requestId) > 0) return false;
    const now = new Date().toISOString();
    const target = Math.max(2, sh.getLastRow() + 1);
    asbEnsureRows_(sh, target);
    sh.getRange(target, 1, 1, ASB_MUT_HEADERS.length).setValues([[now, now, requestId, action, scope, 'RECEIVED', '', '', '']]);
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

function asbSaveMutation_(m) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = asbSheet_(ASB_SHEET.MUT, ASB_MUT_HEADERS);
    const row = asbFindMutationRow_(m.requestId);
    const now = new Date().toISOString();
    let created = now;
    if (row > 0) created = sh.getRange(row, 1).getDisplayValue() || now;
    const values = [[created, now, m.requestId, m.action, m.scope, m.status, m.result == null ? '' : JSON.stringify(m.result), m.errorCode || '', m.errorMessage || '']];
    const target = row > 0 ? row : Math.max(2, sh.getLastRow() + 1);
    asbEnsureRows_(sh, target);
    sh.getRange(target, 1, 1, ASB_MUT_HEADERS.length).setValues(values);
  } finally { lock.releaseLock(); }
}

function asbGetMutation_(requestId) {
  const sh = asbSheet_(ASB_SHEET.MUT, ASB_MUT_HEADERS);
  const row = asbFindMutationRow_(requestId);
  if (row < 1) return null;
  return asbRowObj_(sh.getRange(row, 1, 1, ASB_MUT_HEADERS.length).getDisplayValues()[0], ASB_MUT_HEADERS);
}

function asbFindMutationRow_(requestId) {
  const sh = asbSheet_(ASB_SHEET.MUT, ASB_MUT_HEADERS);
  const last = sh.getLastRow();
  if (last <= 1) return -1;
  const values = sh.getRange(2, 3, last - 1, 1).getDisplayValues();
  for (let i = 0; i < values.length; i++) if (values[i][0] === requestId) return i + 2;
  return -1;
}

function asbSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(asbProp_(ASB_PROP.SHEET_ID));
  return asbEnsureSheet_(ss, name, headers);
}

function asbEnsureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sh;
}

function asbEnsureRows_(sh, row) {
  if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), row - sh.getMaxRows());
}
