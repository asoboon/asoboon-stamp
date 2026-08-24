(function () {
  "use strict";

  const CRED_KEY = "asoboon_staff_airwait_credentials_v1";

  function loadCredentials() {
    try {
      const raw = localStorage.getItem(CRED_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (!v || !v.apiKey || !v.storeId) return null;
      return v;
    } catch (_) {
      return null;
    }
  }

  function saveCredentials(v) {
    const clean = {
      apiKey: String(v.apiKey || "").trim(),
      storeId: String(v.storeId || "").trim(),
      storeNo: String(v.storeNo || "").trim()
    };
    if (!clean.apiKey) throw new Error("APIキーを入力してください");
    if (!clean.storeId) throw new Error("アクティブ枠の自動取得には店舗ID（KR〜）が必要です");
    localStorage.setItem(CRED_KEY, JSON.stringify(clean));
    return clean;
  }

  function clearCredentials() {
    localStorage.removeItem(CRED_KEY);
  }

  function resultCode(data) {
    return String(data?.resultCode?.code ?? "");
  }

  function isSuccess(data) {
    return data?.success === true || resultCode(data) === "0000";
  }

  function boolValue(v) {
    return v === true || String(v).toLowerCase() === "true" || String(v) === "1";
  }

  function normalizeName(v) {
    return String(v ?? "").normalize("NFKC").replace(/[\s\u3000]/g, "").trim();
  }

  function parseJapaneseTime(name) {
    const s = normalizeName(name);
    const m = s.match(/(\d{1,2})時(?:(\d{1,2})分|半)?/);
    if (!m) return null;
    let hour = Number(m[1]);
    let minute = m[2] != null ? Number(m[2]) : (s.includes(`${m[1]}時半`) ? 30 : 0);
    if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  }

  function hhmm(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function isWebType(type) {
    return normalizeName(type.waitTypeName).includes("WEB");
  }

  function shouldIncludeType(type, config) {
    if (!boolValue(type.dispFlg)) return false;
    const name = normalizeName(type.waitTypeName);
    const excludes = (config.excludeNamePatterns || []).map(normalizeName);
    if (excludes.some(p => p && name.includes(p))) return false;
    if (parseJapaneseTime(name) != null) return true;
    const includes = (config.includeUntimedNamePatterns || []).map(normalizeName);
    return includes.some(p => p && name.includes(p));
  }

  function untimedLabel(name) {
    const s = String(name || "");
    if (/すぐ\s*入場/.test(s)) return "すぐ入場";
    return s.replace(/【.*?】/g, "").trim() || "その他";
  }

  /**
   * 有効待ち項目から、その日の「入場回」を自動生成する。
   * WEB待ち項目の時刻を基準時刻として、直後30分以内の店頭項目を同じ回へ束ねる。
   */
  function buildDynamicSlots(waitTypes, config) {
    const candidates = waitTypes
      .filter(t => shouldIncludeType(t, config))
      .map(t => ({
        waitTypeId: String(t.waitTypeId ?? ""),
        waitTypeName: String(t.waitTypeName ?? ""),
        dispNo: Number(t.dispNo ?? 9999),
        usageDispType: String(t.usageDispType ?? ""),
        timeMinutes: parseJapaneseTime(t.waitTypeName),
        web: isWebType(t)
      }));

    const timed = candidates.filter(x => x.timeMinutes != null);
    const webAnchors = timed.filter(x => x.web).sort((a, b) => a.timeMinutes - b.timeMinutes || a.dispNo - b.dispNo);
    const maxDelta = Math.max(0, Number(config.mergeStoreAfterWebMinutes || 30));
    const groups = new Map();

    function ensureGroup(key, label, sortMinutes, sortNo) {
      if (!groups.has(key)) groups.set(key, { key, label, sortMinutes, sortNo, waitTypes: [] });
      return groups.get(key);
    }

    // まずWEB枠を正式な回の基準にする。
    for (const w of webAnchors) {
      const key = `time-${w.timeMinutes}`;
      ensureGroup(key, hhmm(w.timeMinutes), w.timeMinutes, w.dispNo).waitTypes.push(w);
    }

    // 店頭枠は、同時刻〜30分前にある最も近いWEB枠へ束ねる。
    for (const row of timed.filter(x => !x.web)) {
      let anchor = null;
      let bestDelta = Infinity;
      for (const w of webAnchors) {
        const delta = row.timeMinutes - w.timeMinutes;
        if (delta >= 0 && delta <= maxDelta && delta < bestDelta) {
          anchor = w;
          bestDelta = delta;
        }
      }
      if (anchor) {
        const key = `time-${anchor.timeMinutes}`;
        ensureGroup(key, hhmm(anchor.timeMinutes), anchor.timeMinutes, Math.min(row.dispNo, anchor.dispNo)).waitTypes.push(row);
      } else {
        const key = `time-${row.timeMinutes}`;
        ensureGroup(key, hhmm(row.timeMinutes), row.timeMinutes, row.dispNo).waitTypes.push(row);
      }
    }

    // WEB枠がない時刻項目も漏らさない（上でWEB自身は追加済み）。
    for (const row of timed.filter(x => x.web)) {
      const key = `time-${row.timeMinutes}`;
      const g = ensureGroup(key, hhmm(row.timeMinutes), row.timeMinutes, row.dispNo);
      if (!g.waitTypes.some(x => x.waitTypeId === row.waitTypeId)) g.waitTypes.push(row);
    }

    // 「すぐ入場」など時刻を持たない有効な入場受付も別タブにする。
    for (const row of candidates.filter(x => x.timeMinutes == null)) {
      const key = `untimed-${row.waitTypeId}`;
      ensureGroup(key, untimedLabel(row.waitTypeName), 100000 + row.dispNo, row.dispNo).waitTypes.push(row);
    }

    return [...groups.values()]
      .map(g => ({
        ...g,
        waitTypeIds: [...new Set(g.waitTypes.map(x => x.waitTypeId))],
        waitTypeNames: [...new Set(g.waitTypes.map(x => x.waitTypeName))]
      }))
      .sort((a, b) => a.sortMinutes - b.sortMinutes || a.sortNo - b.sortNo);
  }

  function statusFor(row) {
    const s = String(row?.status ?? "");
    if (s === "0" && String(row?.isCalling ?? "0") === "1") return "calling";
    if (s === "0") return "waiting";
    if (s === "1") return "hold";
    if (s === "2") return "guided";
    if (s === "3") return "cancelled";
    if (s === "4") return "processing";
    return "unknown";
  }

  function create(config) {
    let credentials = loadCredentials();

    async function postForm(url, params) {
      if (!credentials) {
        const err = new Error("API設定が必要です");
        err.code = "NO_CREDENTIALS";
        throw err;
      }
      const endpoint = `${url}?key=${encodeURIComponent(credentials.apiKey)}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: params,
        cache: "no-store",
        credentials: "omit"
      });
      let data;
      try { data = await res.json(); }
      catch (_) { throw new Error(`AirウェイトからJSON以外の応答（HTTP ${res.status}）`); }
      if (!res.ok || !isSuccess(data)) {
        const msg = data?.resultCode?.defaultMessage || `HTTP ${res.status}`;
        throw new Error(`Airウェイト取得エラー：${resultCode(data) || "ERROR"} ${msg}`);
      }
      return data;
    }

    async function fetchActiveSlots() {
      const params = new URLSearchParams({ storeId: credentials.storeId });
      const data = await postForm(config.waitTypesEndpoint, params);
      const useWaitTypeFlg = boolValue(data?.innerDto?.useWaitTypeFlg);
      const waitTypes = Array.isArray(data?.innerDto?.waitTypeList) ? data.innerDto.waitTypeList : [];
      if (!useWaitTypeFlg) return [];
      return buildDynamicSlots(waitTypes, config);
    }

    async function fetchReservationPage(start) {
      const params = new URLSearchParams({
        storeId: credentials.storeId,
        // 0=受付時間、0=昇順。番号順には並べ替えない。
        sortStatus: "0",
        isDesc: "0",
        start: String(start),
        limit: "100"
      });
      const data = await postForm(config.reservationsEndpoint, params);
      return {
        count: Number(data?.innerDto?.count || 0),
        rows: Array.isArray(data?.innerDto?.reservations) ? data.innerDto.reservations : []
      };
    }

    async function fetchAllReservations() {
      let start = 1;
      let total = 0;
      const rows = [];
      do {
        const page = await fetchReservationPage(start);
        total = page.count;
        rows.push(...page.rows);
        start += page.rows.length;
        if (!page.rows.length) break;
      } while (rows.length < total && rows.length < 5000);
      return rows;
    }

    async function fetchDashboard() {
      // 先に当日の有効枠を正本として取得する。
      const slots = await fetchActiveSlots();
      const rows = await fetchAllReservations();
      const waitTypeToSlot = new Map();
      for (const slot of slots) {
        for (const id of slot.waitTypeIds) waitTypeToSlot.set(String(id), slot.key);
      }

      const reservations = rows.map((row, index) => ({
        id: `${String(row?.waitTypeId ?? "")}|${String(row?.number ?? "")}|${index}`,
        // Airウェイト実値を無加工で表示
        number: String(row?.number ?? ""),
        slotKey: waitTypeToSlot.get(String(row?.waitTypeId ?? "")) || "",
        status: statusFor(row),
        waitTypeId: String(row?.waitTypeId ?? ""),
        waitTypeName: String(row?.waitTypeName ?? ""),
        isCalling: String(row?.isCalling ?? "0"),
        orderIndex: index
      })).filter(x => x.slotKey && x.number !== "");

      return { slots, reservations };
    }

    return {
      kind: "live",
      hasCredentials() { return !!credentials; },
      getCredentials() {
        return credentials ? { storeId: credentials.storeId || "", storeNo: credentials.storeNo || "", apiKey: "" } : null;
      },
      setCredentials(v) { credentials = saveCredentials(v); },
      clearCredentials() { clearCredentials(); credentials = null; },
      fetchDashboard,

      async callReservation() { throw new Error("呼出に必要なreserveIdの取得方法を確認中です"); },
      async holdReservation() { throw new Error("保留に必要なreserveId/versionの取得方法を確認中です"); },
      async guideReservation() { throw new Error("案内に必要なreserveId/versionの取得方法を確認中です"); }
    };
  }

  window.ASOBoonAirWait = { create };
})();
