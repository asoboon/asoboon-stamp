/** ASOBooN Model backend — 10_Airwait.gs */
const ASB_CACHE_KEY_WAIT_TYPES = 'asb:wait-types:rc2';
const ASB_CACHE_KEY_WAIT_INFO = 'asb:wait-info:rc2';

function asbRawWaitTypes_(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) {
    const cached = cache.get(ASB_CACHE_KEY_WAIT_TYPES);
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }
  }
  const d = asbAirPost_(ASB_API.waitTypes, { storeId: asbProp_(ASB_PROP.STORE_ID) });
  const list = Array.isArray(d && d.innerDto && d.innerDto.waitTypeList) ? d.innerDto.waitTypeList : [];
  try { cache.put(ASB_CACHE_KEY_WAIT_TYPES, JSON.stringify(list), 60); } catch (_) {}
  return list;
}

/**
 * スタッフ監視/AUTO用。WEB・時間指定で使う待ち項目も含める。
 * dispFlg=falseでも実予約が存在し得るため、運用対象では表示フラグを条件にしない。
 */
function asbOperationalWaitTypes_() {
  const list = asbRawWaitTypes_(false).filter(x => !asbOperationalBlockedWaitType_(x));
  return { ok: true, version: ASB_VERSION, waitTypeList: list };
}

/** お客様の現地受付作成に使用してよい待ち項目だけ。 */
function asbCustomerWaitTypes_() {
  const list = asbRawWaitTypes_(false).filter(asbDisplayed_).filter(x => !asbCustomerBlockedWaitType_(x));
  return { ok: true, version: ASB_VERSION, waitTypeList: list };
}

function asbWaitInfo_(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) {
    const cached = cache.get(ASB_CACHE_KEY_WAIT_INFO);
    if (cached) {
      try { return { ok: true, version: ASB_VERSION, innerDto: JSON.parse(cached), cached: true }; } catch (_) {}
    }
  }
  const d = asbAirGet_(ASB_API.waitInfo, { storeId: asbProp_(ASB_PROP.STORE_ID) });
  const inner = d.innerDto || {};
  try { cache.put(ASB_CACHE_KEY_WAIT_INFO, JSON.stringify(inner), 10); } catch (_) {}
  return { ok: true, version: ASB_VERSION, innerDto: inner, cached: false };
}

function asbInvalidatePublicCache_() {
  try { CacheService.getScriptCache().remove(ASB_CACHE_KEY_WAIT_INFO); } catch (_) {}
}

function asbReservations_(p) {
  const body = {
    storeId: asbProp_(ASB_PROP.STORE_ID),
    waitTypeId: asbText_(p.waitTypeId, 50),
    isEnabledStatus: asbText_(p.isEnabledStatus || '1', 10),
    status: asbText_(p.status || '', 10),
    sortStatus: asbText_(p.sortStatus || '0', 10),
    isDesc: asbText_(p.isDesc || '0', 10),
    start: String(Math.max(1, Number(p.start) || 1)),
    limit: String(Math.min(100, Math.max(1, Number(p.limit) || 100)))
  };
  Object.keys(body).forEach(k => body[k] === '' && delete body[k]);
  const d = asbAirPost_(ASB_API.reservations, body);
  return { ok: true, version: ASB_VERSION, innerDto: d.innerDto || {} };
}

function asbCreateReservation_(p) {
  const adults = asbInt_(p.adults, 1, 10);
  const paidChildren = asbInt_(p.paidChildren, 0, 10);
  const infants = asbInt_(p.infants, 0, 10);
  const children = paidChildren + infants;
  const total = adults + children;
  if (total > 10) throw new Error('1受付は合計10名までです。');
  if (children > adults * 3) throw new Error('保護者1名につき子ども3名までです。');

  const expectedDay = asbExpectedReceptionDay_();
  if (!expectedDay.open) throw new Error('現在は受付時間外です。');
  if (expectedDay.isTomorrow && !asbBoolProp_(ASB_PROP.NEXT_DAY_READY, false)) {
    throw new Error('翌日受付のAirWAIT営業日切替仕様が未確認のため受付できません。');
  }
  const operationalDay = asbNormalizeDay_(p.operationalDay);
  if (operationalDay !== expectedDay.day) throw new Error('受付日が現在の受付時間帯と一致しません。');

  const waitTypeId = asbText_(p.waitTypeId, 50);
  const customerTypes = asbCustomerWaitTypes_().waitTypeList;
  const slot = customerTypes.find(x => String(x.waitTypeId) === waitTypeId);
  if (!slot) throw new Error('この受付枠は現地受付の対象外です。');

  // 受付確定直前はキャッシュを使わずAirWAITから最新値を取得する。
  // remainingNum は「残り受付可能数」なので、単位を人数と決めつけず 0 のみ確実に拒否する。
  const remaining = asbRemainingForSlot_(slot, true);
  if (remaining.known && remaining.value <= 0) throw new Error('この回は受付上限に達しました。別の回をお選びください。');

  const d = asbAirPost_(ASB_API.create, {
    storeId: asbProp_(ASB_PROP.STORE_ID),
    numPerson: String(adults),
    numPersonChild: String(children),
    waitTypeId,
    langType: 'KeyJPN',
    autoPrintFlg: 'false'
  });
  const dto = d.innerDto || {};
  const reserveId = asbReserveId_(dto.reserveId);
  const receiptNo = asbText_(dto.receiptNo, 50);
  if (!reserveId || !receiptNo) throw new Error('AirWAITから受付番号を取得できませんでした。');

  const statusToken = asbRandomKey_();
  const rec = {
    reserveId,
    receiptNo,
    waitTypeId,
    waitTypeName: asbText_(slot.waitTypeName || '入場受付', 120),
    operationalDay,
    adults,
    paidChildren,
    infants,
    totalPeople: total,
    source: 'asoboon-model',
    statusToken
  };
  asbUpsertReservation_(rec);
  asbInvalidatePublicCache_();
  asbEvent_('RESERVATION_CREATED', reserveId, receiptNo, waitTypeId, `${total} people`);
  return {
    reserveId,
    receiptNo,
    waitTypeId,
    waitTypeName: rec.waitTypeName,
    shortUrl: dto.shortUrl || null,
    operationalDay,
    totalPeople: total,
    statusToken
  };
}

/**
 * 顧客端末の状態照会。
 * 呼出番号一覧APIには reserveId / 受付日がないため、過去日の同番号取消を
 * 今日の取消と誤認しないよう「取消一覧の番号一致だけ」では取消確定しない。
 */
function asbReservationStatus_(p) {
  const reserveId = asbReserveId_(p.reserveId);
  const token = asbText_(p.statusToken, 200);
  if (!reserveId || !token) return { ok: false, error: 'invalid reservation status request' };
  let row = asbFindReservation_(reserveId);
  if (!row || row.statusToken !== token) return { ok: false, error: 'not found' };

  let statusKnown = false;
  if (row.waitTypeId && row.receiptNo) {
    try {
      const active = asbFetchAllReservations_(row.waitTypeId, { isEnabledStatus: '1', sortStatus: '0', isDesc: '0' }, 500);
      const key = asbReceiptKey_(row.receiptNo);
      const hit = active.find(x => asbReceiptKey_(x && x.number) === key);
      if (hit) {
        statusKnown = true;
        const patch = {
          airwaitStatus: String(hit.status == null ? '' : hit.status),
          isCalling: String(hit.isCalling) === '1' ? '1' : '0'
        };
        asbUpdateReservation_(reserveId, patch);
        Object.assign(row, patch);
      }
    } catch (_) {}
  }

  return {
    ok: true,
    reserveId,
    receiptNo: row.receiptNo,
    waitTypeId: row.waitTypeId,
    waitTypeName: row.waitTypeName,
    operationalDay: row.operationalDay,
    totalPeople: row.totalPeople,
    airwaitStatus: String(row.airwaitStatus || '0'),
    isCalling: String(row.isCalling || '0'),
    statusKnown,
    cancelled: String(row.airwaitStatus || '') === '3' || Boolean(row.cancelledAt)
  };
}

function asbRemainingForSlot_(slot, fresh) {
  try {
    const info = asbWaitInfo_(fresh === true);
    const stores = Array.isArray(info && info.innerDto && info.innerDto.stores) ? info.innerDto.stores : [];
    const details = stores.length && Array.isArray(stores[0].waitDetails) ? stores[0].waitDetails : [];
    const target = asbNormName_(slot && slot.waitTypeName);
    const hit = details.find(x => asbNormName_(x && x.detailedWaitType) === target);
    if (!hit || hit.remainingNum == null) return { known: false, value: null };
    const n = Number(hit.remainingNum);
    return Number.isFinite(n) ? { known: true, value: n } : { known: false, value: null };
  } catch (_) {
    return { known: false, value: null };
  }
}

function asbDisplayed_(x) {
  const v = x && x.dispFlg;
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
}

function asbCustomerBlockedWaitType_(x) {
  const id = String(x && x.waitTypeId || '');
  const name = String(x && x.waitTypeName || '').normalize('NFKC');
  const blockedIds = asbJsonProp_(ASB_PROP.BLOCKED_IDS, ['0042']).map(String);
  const patterns = asbJsonProp_(ASB_PROP.BLOCKED_PATTERNS, ['WEB','テスト','ご待機者専用','待機者専用']);
  return blockedIds.includes(id) || patterns.some(p => name.toLowerCase().includes(String(p).normalize('NFKC').toLowerCase()));
}

function asbOperationalBlockedWaitType_(x) {
  const id = String(x && x.waitTypeId || '');
  const name = String(x && x.waitTypeName || '').normalize('NFKC');
  const blockedIds = asbJsonProp_(ASB_PROP.BLOCKED_IDS, ['0042']).map(String);
  const patterns = asbJsonProp_(ASB_PROP.OP_BLOCKED_PATTERNS, ['テスト','ご待機者専用','待機者専用']);
  return blockedIds.includes(id) || patterns.some(p => name.toLowerCase().includes(String(p).normalize('NFKC').toLowerCase()));
}

function asbNormName_(v) {
  return String(v == null ? '' : v).normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

function asbAirPost_(url, body) { return asbAirRequest_(url, 'post', body); }
function asbAirGet_(url, params) { return asbAirRequest_(url, 'get', params); }

function asbAirRequest_(base, method, params) {
  const key = asbProp_(ASB_PROP.AIRWAIT_KEY);
  let finalUrl = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(key);
  const opts = { method, followRedirects: true, muteHttpExceptions: true, headers: { Accept: 'application/json' } };
  if (method === 'post') {
    opts.contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
    opts.payload = params || {};
  } else {
    const q = Object.keys(params || {}).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]))).join('&');
    if (q) finalUrl += '&' + q;
  }
  const response = UrlFetchApp.fetch(finalUrl, opts);
  const http = response.getResponseCode();
  const text = response.getContentText();
  let data;
  try { data = JSON.parse(text); } catch (_) { throw new Error('AirWAIT response parse error / HTTP ' + http); }
  const code = String(data && data.resultCode && data.resultCode.code || '');
  if (http < 200 || http >= 300) throw new Error('AirWAIT HTTP ' + http);
  if (!(data && data.success === true) && code !== '0000') {
    const msg = String(data && data.resultCode && data.resultCode.defaultMessage || 'AirWAIT API error');
    const vr = Array.isArray(data && data.validationResults) ? data.validationResults.map(x => `${x.field || ''}:${x.msg || ''}`).join(' / ') : '';
    throw new Error(`AirWAIT ${code || '?'}: ${msg}${vr ? ' / ' + vr : ''}`);
  }
  return data;
}
