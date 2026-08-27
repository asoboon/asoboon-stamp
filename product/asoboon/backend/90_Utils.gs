/** ASOBooN Model backend — 90_Utils.gs */
function asbRequireStaff_(key) {
  const expected = asbProp_(ASB_PROP.STAFF_KEY);
  if (!key || !asbConstantTimeEqual_(String(key), String(expected))) throw new Error('スタッフ認証に失敗しました。');
}

function asbConstantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function asbProp_(name) {
  const v = PropertiesService.getScriptProperties().getProperty(name);
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

function asbPropOptional_(name) { return PropertiesService.getScriptProperties().getProperty(name) || ''; }

function asbBoolProp_(name, fallback) {
  const v = PropertiesService.getScriptProperties().getProperty(name);
  if (v == null || v === '') return fallback;
  return v === '1' || String(v).toLowerCase() === 'true';
}

function asbIntProp_(name, fallback) {
  const n = Number(PropertiesService.getScriptProperties().getProperty(name));
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function asbJsonProp_(name, fallback) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(name) || JSON.stringify(fallback)); } catch (_) { return fallback; }
}

function asbParsePost_(e) {
  const p = Object.assign({}, e && e.parameter || {});
  if (e && e.postData && e.postData.type && String(e.postData.type).includes('application/json')) {
    try { Object.assign(p, JSON.parse(e.postData.contents || '{}')); } catch (_) {}
  }
  return p;
}

function asbOutput_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][\w$\.]{0,120}$/.test(callback)) {
    return ContentService.createTextOutput(`${callback}(${json});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function asbJson_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function asbRowObj_(row, headers) { const o = {}; headers.forEach((h, i) => o[h] = row[i]); return o; }

function asbText_(v, max) { return String(v == null ? '' : v).normalize('NFKC').trim().slice(0, max || 500); }

function asbInt_(v, min, max) { const n = Math.floor(Number(v)); if (!Number.isFinite(n) || n < min || n > max) throw new Error('人数が不正です。'); return n; }

function asbRequestId_(v) { const s = String(v || '').trim(); return /^[A-Za-z0-9_-]{12,100}$/.test(s) ? s : ''; }

function asbReserveId_(v) { const s = String(v == null ? '' : v).normalize('NFKC').replace(/\D/g, ''); return s && s.length <= 12 ? s.padStart(12, '0') : ''; }

/**
 * AirWAITの呼出番号は、時間指定予約=T、割り込み登録=F の接頭辞を持つ場合がある。
 * 接頭辞を落とすと T208 と 208 を誤って同一予約として扱うため、必ず保持する。
 */
function asbReceiptKey_(v) {
  const s = String(v == null ? '' : v).normalize('NFKC').toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^([FT]?)(\d+)$/);
  if (!m) return s;
  const digits = m[2].replace(/^0+(?=\d)/, '') || '0';
  return m[1] + digits;
}

function asbRegistrationKind_(v) {
  const key = asbReceiptKey_(v);
  if (/^T\d+$/.test(key)) return 'TIME';
  if (/^F\d+$/.test(key)) return 'INTERRUPT';
  if (/^\d+$/.test(key)) return 'NORMAL';
  return 'OTHER';
}

function asbErrorCode_(err) { const s = String(err && err.message || err); if (/認証/.test(s)) return 'AUTH'; if (/AirWAIT/.test(s)) return 'AIRWAIT'; if (/受付時間外/.test(s)) return 'CLOSED'; return 'VALIDATION'; }

function asbRandomKey_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }

function asbAutoTriggerInstalled_() { return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'runASOBooNAutoCycle'); }

function asbToday_() { const p = asbJstParts_(); return `${p.year}-${p.month}-${p.day}`; }

function asbJstParts_() {
  const parts = Utilities.formatDate(new Date(), ASB_TZ, 'yyyy-MM-dd-HH-mm').split('-');
  return { year: parts[0], month: parts[1], day: parts[2], hour: parts[3], minute: parts[4] };
}

function asbNormalizeDay_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, ASB_TZ, 'yyyy-MM-dd');
  const s = String(v == null ? '' : v).trim();
  let m = s.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, ASB_TZ, 'yyyy-MM-dd');
}

function asbAddDays_(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + days));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
}
