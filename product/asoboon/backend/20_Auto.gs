/** ASOBooN Model backend — 20_Auto.gs */
function asbStaffSnapshot_() {
  const day = asbToday_();
  return {
    ok: true,
    version: ASB_VERSION,
    operationalDay: day,
    reservations: asbGetReservations_(day),
    autoEnabled: asbBoolProp_(ASB_PROP.AUTO_ENABLED, false),
    autoUpdatedAt: asbPropOptional_(ASB_PROP.AUTO_UPDATED_AT) || '',
    callEnabled: asbBoolProp_(ASB_PROP.CALL_ENABLED, false),
    triggerInstalled: asbAutoTriggerInstalled_(),
    autoEngine: 'server',
    autoPool: asbIntProp_(ASB_PROP.AUTO_POOL, 10),
    autoStopTime: asbPropOptional_(ASB_PROP.AUTO_STOP_TIME) || '18:00',
    callConfig: {
      method: asbPropOptional_(ASB_PROP.CALL_METHOD) || 'KeyNORMAL',
      counterConfigured: Boolean(asbPropOptional_(ASB_PROP.COUNTER_ID)),
      customUrl: Boolean(asbPropOptional_(ASB_PROP.CALL_URL))
    }
  };
}

function asbSetAuto_(p) {
  const enabled = String(p.enabled) === '1' || String(p.enabled).toLowerCase() === 'true';
  if (enabled && !asbBoolProp_(ASB_PROP.CALL_ENABLED, false)) {
    throw new Error('AirWAIT呼出APIが未確認のためAUTOをONにできません。');
  }
  if (enabled && !asbAutoTriggerInstalled_()) installASOBooNAutoTrigger();
  const props = PropertiesService.getScriptProperties();
  const now = new Date().toISOString();
  props.setProperty(ASB_PROP.AUTO_ENABLED, enabled ? '1' : '0');
  props.setProperty(ASB_PROP.AUTO_UPDATED_AT, now);
  asbEvent_(enabled ? 'AUTO_ON' : 'AUTO_OFF', '', '', '', 'server auto');
  return { enabled, updatedAt: now, triggerInstalled: asbAutoTriggerInstalled_() };
}

function runASOBooNAutoCycle() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { ok: false, skipped: 'locked' };
  try {
    if (!asbBoolProp_(ASB_PROP.AUTO_ENABLED, false)) return { ok: true, skipped: 'auto-off' };
    if (!asbBoolProp_(ASB_PROP.CALL_ENABLED, false)) {
      asbSafetyStop_('AirWAIT呼出APIが未確認です。');
      return { ok: false, stopped: 'call-disabled' };
    }
    if (asbAfterStopTime_()) return { ok: true, skipped: 'after-stop-time' };

    const day = asbToday_();
    const slots = asbPublicWaitTypes_().waitTypeList;
    const ledger = asbGetReservations_(day);
    let called = 0;

    for (const slot of slots) {
      const start = asbSlotStart_(slot);
      if (!start || !asbSlotStarted_(start)) continue;

      const activeRows = asbFetchAllReservations_(slot.waitTypeId, { isEnabledStatus: '1', sortStatus: '0', isDesc: '0' });
      asbSyncLedgerFromAirwait_(ledger, slot.waitTypeId, activeRows);
      const cancelledRows = asbFetchAllReservations_(slot.waitTypeId, { status: '3', sortStatus: '0', isDesc: '1' }, 500);
      asbSyncCancelled_(ledger, slot.waitTypeId, cancelledRows);

      let callingCount = activeRows.filter(r => String(r.status) !== '1' && String(r.isCalling) === '1').length;
      const waitingRows = activeRows.filter(r => String(r.status) === '0' && String(r.isCalling) !== '1');
      const pool = asbIntProp_(ASB_PROP.AUTO_POOL, 10);

      for (const row of waitingRows) {
        if (callingCount >= pool) break;
        const rec = asbLinkLedger_(ledger, row, slot.waitTypeId);
        if (!rec) {
          asbEvent_('AUTO_HOLD_UNLINKED', '', asbText_(row.number, 50), String(slot.waitTypeId), 'first waiting row is unlinked');
          break;
        }
        try {
          asbCallReservation_(rec.reserveId, rec.receiptNo, rec.waitTypeId);
          callingCount++;
          called++;
          Utilities.sleep(500);
        } catch (err) {
          asbSafetyStop_(`呼出APIエラー: ${String(err && err.message || err).slice(0, 300)}`);
          return { ok: false, stopped: 'call-error', error: String(err && err.message || err) };
        }
      }
    }
    return { ok: true, called, at: new Date().toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function asbCallReservation_(reserveId, receiptNo, waitTypeId) {
  const props = PropertiesService.getScriptProperties();
  const method = props.getProperty(ASB_PROP.CALL_METHOD) || 'KeyNORMAL';
  const url = props.getProperty(ASB_PROP.CALL_URL) || ASB_API.callDefault;
  const body = {
    storeId: asbProp_(ASB_PROP.STORE_ID),
    reserveId: asbReserveId_(reserveId),
    callingMethodType: method
  };
  const counter = props.getProperty(ASB_PROP.COUNTER_ID) || '';
  if (counter) body.counterId = counter;
  const d = asbAirPost_(url, body);
  asbUpdateReservation_(reserveId, { isCalling: '1', calledAt: new Date().toISOString() });
  asbEvent_('CALLED', reserveId, receiptNo || '', waitTypeId || '', `method=${method}`);
  return d;
}

function asbSafetyStop_(message) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(ASB_PROP.AUTO_ENABLED, '0');
  props.setProperty(ASB_PROP.AUTO_UPDATED_AT, new Date().toISOString());
  asbEvent_('AUTO_SAFETY_STOP', '', '', '', message);
}

function asbFetchAllReservations_(waitTypeId, extra, maxRows) {
  const limitTotal = Math.max(100, Number(maxRows) || 3000);
  const all = [];
  let start = 1;
  for (let page = 0; page < 40 && all.length < limitTotal; page++) {
    const body = Object.assign({
      storeId: asbProp_(ASB_PROP.STORE_ID),
      waitTypeId: String(waitTypeId),
      start: String(start),
      limit: '100'
    }, extra || {});
    const d = asbAirPost_(ASB_API.reservations, body);
    const inner = d.innerDto || {};
    const rows = Array.isArray(inner.reservations) ? inner.reservations : [];
    all.push.apply(all, rows);
    const count = Number(inner.count || 0);
    if (!rows.length || rows.length < 100 || (count && all.length >= count)) break;
    start += rows.length;
  }
  return all.slice(0, limitTotal);
}

function asbSyncLedgerFromAirwait_(ledger, waitTypeId, rows) {
  rows.forEach(row => {
    const rec = asbLinkLedger_(ledger, row, waitTypeId);
    if (!rec) return;
    asbUpdateReservation_(rec.reserveId, { airwaitStatus: String(row.status == null ? '' : row.status), isCalling: String(row.isCalling) === '1' ? '1' : '0' });
  });
}

function asbSyncCancelled_(ledger, waitTypeId, rows) {
  rows.forEach(row => {
    const rec = asbLinkLedger_(ledger, row, waitTypeId);
    if (!rec) return;
    asbUpdateReservation_(rec.reserveId, { airwaitStatus: '3', isCalling: '0', cancelledAt: new Date().toISOString() });
  });
}

function asbLinkLedger_(ledger, airRow, waitTypeId) {
  const number = asbReceiptKey_(airRow && airRow.number);
  const typeId = String(waitTypeId || airRow && airRow.waitTypeId || '');
  const exact = ledger.find(x => String(x.waitTypeId) === typeId && asbReceiptKey_(x.receiptNo) === number);
  if (exact) return exact;
  const hits = ledger.filter(x => asbReceiptKey_(x.receiptNo) === number);
  return hits.length === 1 ? hits[0] : null;
}

function asbSlotStart_(slot) {
  const overrides = asbJsonProp_(ASB_PROP.SLOT_OVERRIDES, {});
  const id = String(slot.waitTypeId || '');
  if (overrides[id] && /^\d{1,2}:\d{2}$/.test(String(overrides[id]))) return String(overrides[id]);
  const s = String(slot.waitTypeName || '').normalize('NFKC');
  let m = s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)/);
  if (m) return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
  m = s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*([0-5]?\d)\s*分/);
  if (m) return `${String(Number(m[1])).padStart(2, '0')}:${String(Number(m[2])).padStart(2, '0')}`;
  m = s.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*時\s*半/);
  if (m) return `${String(Number(m[1])).padStart(2, '0')}:30`;
  return '';
}

function asbSlotStarted_(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const now = asbJstParts_();
  return Number(now.hour) * 60 + Number(now.minute) >= h * 60 + m;
}

function asbAfterStopTime_() {
  const stop = asbPropOptional_(ASB_PROP.AUTO_STOP_TIME) || '18:00';
  const [h, m] = stop.split(':').map(Number);
  const now = asbJstParts_();
  return Number(now.hour) * 60 + Number(now.minute) >= h * 60 + m;
}

function asbExpectedReceptionDay_() {
  const p = asbJstParts_();
  const h = Number(p.hour);
  const base = `${p.year}-${p.month}-${p.day}`;
  if (h >= 18 && h < 19) return { open: false, day: base };
  if (h >= 19) return { open: true, day: asbAddDays_(base, 1) };
  return { open: true, day: base };
}
