(function () {
  "use strict";

  const DEMO_KEY = "asoboon_staff_wait_demo_v1";

  function nowIso() {
    return new Date().toISOString();
  }

  function makeDemoData() {
    const defs = [
      ["10:00", 101, 12],
      ["12:30", 201, 10],
      ["15:00", 301, 9]
    ];
    const data = [];
    defs.forEach(([slot, start, count], slotIndex) => {
      for (let i = 0; i < count; i += 1) {
        data.push({
          id: `${slot.replace(":", "")}-${start + i}`,
          number: start + i,
          slot,
          adult: 1 + ((i + slotIndex) % 2),
          child: 1 + ((i * 2 + slotIndex) % 3),
          status: i === 0 && slotIndex === 0 ? "calling" : "waiting",
          reservedAt: new Date(Date.now() - (count - i) * 62000 - slotIndex * 10000).toISOString(),
          updatedAt: nowIso()
        });
      }
    });
    return data;
  }

  function loadDemo() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    const created = makeDemoData();
    saveDemo(created);
    return created;
  }

  function saveDemo(data) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function sortReservations(list) {
    return [...list].sort((a, b) => {
      const ta = Date.parse(a.reservedAt || "") || 0;
      const tb = Date.parse(b.reservedAt || "") || 0;
      if (ta !== tb) return ta - tb;
      return Number(a.number || 0) - Number(b.number || 0);
    });
  }

  function createDemoAdapter() {
    let data = loadDemo();

    const mutate = async (id, patch) => {
      const target = data.find(x => String(x.id) === String(id));
      if (!target) throw new Error("受付データが見つかりません");
      Object.assign(target, patch, { updatedAt: nowIso() });
      saveDemo(data);
      return { ...target };
    };

    return {
      kind: "demo",
      async fetchReservations() {
        return sortReservations(data);
      },
      async callReservation(id) {
        return mutate(id, { status: "calling" });
      },
      async holdReservation(id) {
        return mutate(id, { status: "hold" });
      },
      async guideReservation(id) {
        return mutate(id, { status: "guided" });
      },
      async updatePeople(id, adult, child) {
        return mutate(id, { adult, child });
      },
      async resetDemo() {
        data = makeDemoData();
        saveDemo(data);
        return sortReservations(data);
      }
    };
  }

  function createLiveAdapter(config) {
    const adapterConfig = config.adapter || {};
    const actions = adapterConfig.actions || {};

    async function request(url, options) {
      if (!url) {
        throw new Error("本番APIのURLが未設定です。API仕様確認後に config.js を設定してください。");
      }
      const res = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        ...options
      });
      if (!res.ok) throw new Error(`APIエラー ${res.status}`);
      const type = res.headers.get("content-type") || "";
      return type.includes("application/json") ? res.json() : res.text();
    }

    /**
     * 重要:
     * AirウェイトAPIの実データ形状・書き込みエンドポイントは、
     * 仕様書確認後にこの normalizeReservations / actionRequest へ合わせてください。
     * 推測で本番APIを叩かないため、現時点では明示的に未設定としています。
     */
    function normalizeReservations(payload) {
      const raw = Array.isArray(payload) ? payload : (payload && payload.reservations) || [];
      return sortReservations(raw.map((item, index) => ({
        id: item.id ?? item.reservationId ?? item.number ?? index,
        number: item.number ?? item.ticketNumber ?? item.receptionNumber ?? "—",
        slot: item.slot ?? item.entryTime ?? item.category ?? "",
        adult: Number(item.adult ?? item.adults ?? 0),
        child: Number(item.child ?? item.children ?? 0),
        status: item.status ?? "waiting",
        reservedAt: item.reservedAt ?? item.createdAt ?? item.receptionAt ?? "",
        updatedAt: item.updatedAt ?? ""
      })));
    }

    async function actionRequest(url, body) {
      return request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }

    return {
      kind: "live",
      async fetchReservations() {
        const payload = await request(adapterConfig.reservationsEndpoint, { method: "GET" });
        return normalizeReservations(payload);
      },
      async callReservation(id) {
        return actionRequest(actions.call, { id });
      },
      async holdReservation(id) {
        return actionRequest(actions.hold, { id });
      },
      async guideReservation(id) {
        return actionRequest(actions.guide, { id });
      },
      async updatePeople(id, adult, child) {
        return actionRequest(actions.updatePeople, { id, adult, child });
      }
    };
  }

  window.ASOBoonAirWait = {
    create(config) {
      return config.mode === "live" ? createLiveAdapter(config) : createDemoAdapter();
    }
  };
})();
