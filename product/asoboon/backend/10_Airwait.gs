/** ASOBooN Model backend — 10_Airwait.gs */
function asbPublicWaitTypes_() {
  const d = asbAirPost_(ASB_API.waitTypes, { storeId: asbProp_(ASB_PROP.STORE_ID) });
  const raw = Array.isArray(d && d.innerDto && d.innerDto.waitTypeList) ? d.innerDto.waitTypeList : [];
  const list = raw.filter(asbDisplayed_).filter(x => !asbBlockedWaitType_(x));
  return { ok: true, version: ASB_VERSION, waitTypeList: list };
}

function asbWaitInfo_() {
  const d = asbAirGet_(ASB_API.waitInfo, { storeId: asbProp_(ASB_PROP.STORE_ID) });
  return { ok: true, version: ASB_VERSION, innerDto: d.innerDto || {} };
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
  const operationalDay = asbNormalizeDay_(p.operationalDay);
  if (operationalDay !== expectedDay.day) throw new Error('受付日が現在の受付時間帯と一致しません。');

  const waitTypeId = asbText_(p.waitTypeId, 50);
  const publicTypes = asbPublicWaitTypes_().waitTypeList;
  const slot = publicTypes.find(x => String(x.waitTypeId) === waitTypeId);
  if (!slot) throw new Error('この受付枠は現地受付の対象外です。');

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

function asbReservationStatus_(p) {
  const reserveId = asbReserveId_(p.reserveId);
  const token = asbText_(p.statusToken, 200);
  if (!reserveId || !token) return { ok: false, error: 'invalid reservation status request' };
  let row = asbFindReservation_(reserveId);
  if (!row || row.statusToken !== token) return { ok: false, error: 'not found' };
  if (String(row.airwaitStatus || '') !== '3' && row.waitTypeId && row.receiptNo) {
    try {
      const cancelled = asbFetchAllReservations_(row.waitTypeId, { status: '3', sortStatus: '0', isDesc: '1' }, 500);
      const hit = cancelled.some(x => asbReceiptKey_(x && x.number) === asbReceiptKey_(row.receiptNo));
      if (hit) {
        asbUpdateReservation_(reserveId, { airwaitStatus: '3', isCalling: '0', cancelledAt: new Date().toISOString() });
        row = asbFindReservation_(reserveId) || row;
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
    cancelled: String(row.airwaitStatus || '') === '3' || Boolean(row.cancelledAt)
  };
}

function asbDisplayed_(x) {
  const v = x && x.dispFlg;
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
}

function asbBlockedWaitType_(x) {
  const name = String(x && x.waitTypeName || '').normalize('NFKC');
  const patterns = asbJsonProp_(ASB_PROP.BLOCKED_PATTERNS, ['WEB','テスト','ご待機者専用','待機者専用']);
  return patterns.some(p => name.toLowerCase().includes(String(p).normalize('NFKC').toLowerCase()));
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
