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
    externalCallReady: asbBoolProp_(ASB_PROP.EXTERNAL_CALL_READY, false),
    nextDayReady: asbBoolProp_(ASB_PROP.NEXT_DAY_READY, false),
    admissionPolicyReady: asbBoolProp_(ASB_PROP.ADMISSION_POLICY_READY, false),
    admissionGroups: asbJsonProp_(ASB_PROP.ADMISSION_GROUPS, {}),
    triggerInstalled: asbAutoTriggerInstalled_(),
    autoEngine: 'server',
    autoPool: asbIntProp_(ASB_PROP.AUTO_POOL, 10),
    autoStopTime: asbPropOptional_(ASB_PROP.AUTO_STOP_TIME) || '18:00',
    pendingGraceMs: asbIntProp_(ASB_PROP.AUTO_PENDING_MS, 120000),
    poolScope: 'explicit-admission-group',
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
  if (enabled && !asbBoolProp_(ASB_PROP.EXTERNAL_CALL_READY, false)) {
    throw new Error('WEB・時間指定予約のreserveId取得方法が未確認のためAUTOをONにできません。');
  }
  if (enabled && !asbBoolProp_(ASB_PROP.ADMISSION_POLICY_READY, false)) {
    throw new Error('WEB・現地の入場回グループ/優先順が未確認のためAUTOをONにできません。');
  }
  if (enabled) {
    const slots = asbOperationalWaitTypes_().waitTypeList;
    asbAdmissionGroups_(slots); // 設定不整合ならここで拒否
  }
  if (enabled && !asbAutoTriggerInstalled_()) installASOBooNAutoTrigger();
  const props = PropertiesService.getScriptProperties();
  const now = new Date().toISOString();
  props.setProperty(ASB_PROP.AUTO_ENABLED, enabled ? '1' : '0');
  props.setProperty(ASB_PROP.AUTO_UPDATED_AT, now);
  asbEvent_(enabled ? 'AUTO_ON' : 'AUTO_OFF', '', '', '', 'server auto / explicit admission groups');
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
    if (!asbBoolProp_(ASB_PROP.EXTERNAL_CALL_READY, false)) {
      asbSafetyStop_('WEB・時間指定予約のreserveId取得方法が未確認です。');
      return { ok: false, stopped: 'external-id-disabled' };
    }
    if (!asbBoolProp_(ASB_PROP.ADMISSION_POLICY_READY, false)) {
      asbSafetyStop_('WEB・現地の入場回グループ/優先順が未確認です。');
      return { ok: false, stopped: 'admission-policy-disabled' };
    }
    if (asbAfterStopTime_()) return { ok: true, skipped: 'after-stop-time' };

    const day = asbToday_();
    const slots = asbOperationalWaitTypes_().waitTypeList;
    let groups;
    try {
      groups = asbAdmissionGroups_(slots);
    } catch (err) {
      asbSafetyStop_(`入場回設定エラー: ${String(err && err.message || err).slice(0, 300)}`);
      return { ok: false, stopped: 'admission-group-error', error: String(err && err.message || err) };
    }
    const ledger = asbGetReservations_(day);
    const pool = asbIntProp_(ASB_PROP.AUTO_POOL, 10);
    let called = 0;

    for (const group of groups) {
      if (!asbSlotStarted_(group.start)) continue;
      let guard = 0;
      while (guard++ < pool) {
        // 呼出の直前ごとに再取得。スタッフ手動呼出とAirWAIT側の状態変化を反映する。
        const entries = asbFetchAdmissionEntries_(group);
        group.slots.forEach(slot => {
          const rows = entries.filter(x => String(x.slot.waitTypeId) === String(slot.waitTypeId)).map(x => x.row);
          asbSyncLedgerFromAirwait_(ledger, slot.waitTypeId, rows);
        });

        if (asbEffectiveCallingCount_(entries, ledger, group) >= pool) break;

        // ADMISSION_GROUPS_JSON のwaitTypeId配列順が優先順。
        // 各waitType内はAirWAITの受付時間昇順をそのまま守る。
        const waiting = entries
          .filter(x => String(x.row.status) === '0' && String(x.row.isCalling) !== '1')
          .sort((a, b) => a.slotOrder - b.slotOrder || a.rowOrder - b.rowOrder);
        if (!waiting.length) break;

        const candidate = waiting[0];
        const target = asbResolveCallTarget_(ledger, candidate.row, candidate.slot);
        if (!target) {
          const number = asbText_(candidate.row.number, 50);
          const kind = asbRegistrationKind_(candidate.row.number);
          if (kind === 'TIME' || kind === 'INTERRUPT' || /WEB/i.test(String(candidate.slot.waitTypeName || ''))) {
            asbSafetyStop_(`外部予約 ${number} のreserveIdを解決できません。AirWAITの外部予約ID取得仕様を確認してください。`);
            return { ok: false, stopped: 'external-id-missing', receiptNo: number };
          }
          asbEvent_('AUTO_HOLD_UNLINKED_ONSITE', '', number, String(candidate.slot.waitTypeId), 'onsite waiting row is not linked');
          break;
        }

        try {
          asbCallReservation_(target.reserveId, target.receiptNo, target.waitTypeId);
          target.isCalling = '1';
          target.calledAt = new Date().toISOString();
          called++;
          Utilities.sleep(600);
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
  const body = { storeId: asbProp_(ASB_PROP.STORE_ID), reserveId: asbReserveId_(reserveId), callingMethodType: method };
  const counter = props.getProperty(ASB_PROP.COUNTER_ID) || '';
  if (counter) body.counterId = counter;
  const d = asbAirPost_(url, body);
  asbUpdateReservation_(reserveId, { isCalling: '1', airwaitStatus: '0', calledAt: new Date().toISOString() });
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
  const limitTotal = Math.max(100, Number(maxRows) || 3000), all = [];
  let start = 1;
  for (let page = 0; page < 40 && all.length < limitTotal; page++) {
    const body = Object.assign({ storeId: asbProp_(ASB_PROP.STORE_ID), waitTypeId: String(waitTypeId), start: String(start), limit: '100' }, extra || {});
    const d = asbAirPost_(ASB_API.reservations, body), inner = d.innerDto || {}, rows = Array.isArray(inner.reservations) ? inner.reservations : [];
    all.push.apply(all, rows);
    const count = Number(inner.count || 0);
    if (!rows.length || rows.length < 100 || (count && all.length >= count)) break;
    start += rows.length;
  }
  return all.slice(0, limitTotal);
}

/**
 * ADMISSION_GROUPS_JSON 例:
 * {"10:15":["WEB_WAITTYPE_ID","ONSITE_WAITTYPE_ID"],"13:45":["WEB2","ONSITE2"]}
 * 配列順がその入場回の優先順。未設定/不正IDはAUTOを安全停止する。
 */
function asbAdmissionGroups_(slots) {
  if (!asbBoolProp_(ASB_PROP.ADMISSION_POLICY_READY, false)) throw new Error('ADMISSION_GROUP_POLICY_READY is false');
  const cfg = asbJsonProp_(ASB_PROP.ADMISSION_GROUPS, {});
  const keys = Object.keys(cfg || {});
  if (!keys.length) throw new Error('ADMISSION_GROUPS_JSON is empty');
  const byId = new Map((slots || []).map(s => [String(s.waitTypeId || ''), s]));
  const used = new Set(), groups = [];

  keys.forEach(rawStart => {
    const m = String(rawStart).match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!m) throw new Error(`invalid admission start: ${rawStart}`);
    const start = `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
    const ids = cfg[rawStart];
    if (!Array.isArray(ids) || !ids.length) throw new Error(`empty admission group: ${rawStart}`);
    const groupSlots = ids.map(v => {
      const id = String(v);
      if (used.has(id)) throw new Error(`waitTypeId duplicated across groups: ${id}`);
      const slot = byId.get(id);
      if (!slot) throw new Error(`configured waitTypeId not found: ${id}`);
      used.add(id);
      return slot;
    });
    groups.push({ key: start, start, slots: groupSlots });
  });

  return groups.sort((a, b) => a.start.localeCompare(b.start));
}

function asbFetchAdmissionEntries_(group) {
  const entries = [];
  (group.slots || []).forEach((slot, slotOrder) => {
    const rows = asbFetchAllReservations_(slot.waitTypeId, { isEnabledStatus: '1', sortStatus: '0', isDesc: '0' });
    rows.forEach((row, rowOrder) => entries.push({ slot, row, slotOrder, rowOrder }));
  });
  return entries;
}

function asbResolveCallTarget_(ledger, row, slot) {
  // 現時点ではASOBooN台帳にreserveIdがある予約のみ解決可能。
  // WEB/時間指定のreserveId取得方法がAirWAITから回答されたら、この関数を拡張し、
  // 実予約で照合成功後に AIRWAIT_EXTERNAL_RESERVE_ID_READY=1 とする。
  return asbLinkLedger_(ledger, row, slot && slot.waitTypeId);
}

function asbEffectiveCallingCount_(entries, ledger, group) {
  const actual = entries.filter(x => String(x.row.status) === '0' && String(x.row.isCalling) === '1');
  const actualIds = new Set();
  actual.forEach(x => {
    const rec = asbLinkLedger_(ledger, x.row, x.slot.waitTypeId);
    if (rec && rec.reserveId) actualIds.add(String(rec.reserveId));
  });
  const groupIds = new Set((group.slots || []).map(x => String(x.waitTypeId)));
  const recentPending = (ledger || []).filter(rec => {
    if (!groupIds.has(String(rec.waitTypeId))) return false;
    if (actualIds.has(String(rec.reserveId))) return false;
    if (String(rec.airwaitStatus || '0') !== '0' || String(rec.isCalling) !== '1') return false;
    return asbIsRecentCall_(rec.calledAt);
  }).length;
  return actual.length + recentPending;
}

function asbIsRecentCall_(calledAt) {
  const t = Date.parse(String(calledAt || ''));
  if (!Number.isFinite(t)) return false;
  const grace = Math.max(30000, asbIntProp_(ASB_PROP.AUTO_PENDING_MS, 120000));
  return Date.now() - t >= 0 && Date.now() - t < grace;
}

function asbSyncLedgerFromAirwait_(ledger, waitTypeId, rows) {
  rows.forEach(row => {
    const rec = asbLinkLedger_(ledger, row, waitTypeId);
    if (!rec) return;
    const status = String(row.status == null ? '' : row.status);
    let isCalling = String(row.isCalling) === '1' ? '1' : '0';
    if (status === '0' && isCalling === '0' && String(rec.isCalling) === '1' && asbIsRecentCall_(rec.calledAt)) isCalling = '1';
    if (status === '4') isCalling = '0';
    const patch = { airwaitStatus: status, isCalling };
    asbUpdateReservation_(rec.reserveId, patch);
    Object.assign(rec, patch);
  });
}

function asbLinkLedger_(ledger, airRow, waitTypeId) {
  const number = asbReceiptKey_(airRow && airRow.number), typeId = String(waitTypeId || airRow && airRow.waitTypeId || '');
  const exact = ledger.find(x => String(x.waitTypeId) === typeId && asbReceiptKey_(x.receiptNo) === number);
  if (exact) return exact;
  const hits = ledger.filter(x => asbReceiptKey_(x.receiptNo) === number);
  return hits.length === 1 ? hits[0] : null;
}

function asbSlotStart_(slot) {
  const overrides = asbJsonProp_(ASB_PROP.SLOT_OVERRIDES, {}), id = String(slot.waitTypeId || '');
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
  const parts = String(hhmm).split(':').map(Number), now = asbJstParts_();
  return Number(now.hour) * 60 + Number(now.minute) >= parts[0] * 60 + parts[1];
}

function asbAfterStopTime_() {
  const stop = asbPropOptional_(ASB_PROP.AUTO_STOP_TIME) || '18:00', parts = stop.split(':').map(Number), now = asbJstParts_();
  return Number(now.hour) * 60 + Number(now.minute) >= parts[0] * 60 + parts[1];
}

function asbExpectedReceptionDay_() {
  const p = asbJstParts_(), h = Number(p.hour), base = `${p.year}-${p.month}-${p.day}`;
  if (h >= 18 && h < 19) return { open: false, day: base, isTomorrow: false };
  if (h >= 19) return { open: true, day: asbAddDays_(base, 1), isTomorrow: true };
  return { open: true, day: base, isTomorrow: false };
}
