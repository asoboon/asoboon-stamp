(function () {
  "use strict";

  const CRED_KEY = "asoboon_staff_airwait_credentials_v1";

  function loadCredentials() {
    try {
      const raw = localStorage.getItem(CRED_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (!v || !v.apiKey || (!v.storeId && !v.storeNo)) return null;
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
    if (!clean.storeId && !clean.storeNo) throw new Error("店舗ID または 店舗NOを入力してください");
    if (clean.storeId && clean.storeNo) throw new Error("店舗IDと店舗NOはどちらか一方だけ入力してください");
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

  function normalizeName(v) {
    return String(v ?? "")
      .normalize("NFKC")
      .replace(/[\s\u3000]/g, "")
      .trim();
  }

  function buildNameMap(config) {
    const map = new Map();
    const src = config.slotWaitTypeNames || {};
    for (const [slot, names] of Object.entries(src)) {
      for (const name of names || []) map.set(normalizeName(name), slot);
    }
    return map;
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
    const waitTypeNameToSlot = buildNameMap(config);

    async function fetchPage(start) {
      if (!credentials) {
        const err = new Error("API設定が必要です");
        err.code = "NO_CREDENTIALS";
        throw err;
      }

      const params = new URLSearchParams({
        // API仕様: 0=受付時間、isDesc=0=昇順。
        // WEB・店頭の別に関係なく、Airウェイトが持つ本当の受付順を維持する。
        sortStatus: "0",
        isDesc: "0",
        start: String(start),
        limit: "100"
      });
      if (credentials.storeId) params.set("storeId", credentials.storeId);
      if (credentials.storeNo) params.set("storeNo", credentials.storeNo);

      const url = `${config.reservationsEndpoint}?key=${encodeURIComponent(credentials.apiKey)}`;
      const res = await fetch(url, {
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

      return {
        count: Number(data?.innerDto?.count || 0),
        rows: Array.isArray(data?.innerDto?.reservations) ? data.innerDto.reservations : []
      };
    }

    async function fetchAll() {
      let start = 1;
      let total = 0;
      const rows = [];
      do {
        const page = await fetchPage(start);
        total = page.count;
        rows.push(...page.rows);
        start += page.rows.length;
        if (!page.rows.length) break;
      } while (rows.length < total && rows.length < 5000);
      return rows;
    }

    return {
      kind: "live",
      hasCredentials() { return !!credentials; },
      getCredentials() {
        return credentials ? { storeId: credentials.storeId || "", storeNo: credentials.storeNo || "", apiKey: "" } : null;
      },
      setCredentials(v) { credentials = saveCredentials(v); },
      clearCredentials() { clearCredentials(); credentials = null; },

      async fetchReservations() {
        const rows = await fetchAll();
        return rows.map((row, index) => {
          const waitTypeName = String(row?.waitTypeName ?? "");
          const slot = waitTypeNameToSlot.get(normalizeName(waitTypeName)) || "";
          return {
            // number は Airウェイトの実レスポンスをそのまま保持する。
            // 数値化・桁追加・番号帯による変換は一切しない。
            id: `${String(row?.waitTypeId ?? "")}|${String(row?.number ?? "")}|${index}`,
            number: String(row?.number ?? ""),
            slot,
            status: statusFor(row),
            waitTypeId: String(row?.waitTypeId ?? ""),
            waitTypeName,
            isCalling: String(row?.isCalling ?? "0"),
            orderIndex: index
          };
        }).filter(x => x.slot && x.number !== "");
      },

      // reservations API は reserveId/version を返さない。
      // 別の正式な取得手段を確認できるまで書込みは行わない。
      async callReservation() {
        throw new Error("呼出に必要なreserveIdの取得方法を確認中です");
      },
      async holdReservation() {
        throw new Error("保留に必要なreserveId/versionの取得方法を確認中です");
      },
      async guideReservation() {
        throw new Error("案内に必要なreserveId/versionの取得方法を確認中です");
      }
    };
  }

  window.ASOBoonAirWait = { create };
})();
