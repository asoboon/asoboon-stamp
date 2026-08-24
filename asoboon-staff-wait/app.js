(function () {
  "use strict";

  const config = window.ASOBOON_STAFF_CONFIG || {};
  const adapter = window.ASOBoonAirWait.create(config);
  const slots = config.slots || ["10:00", "12:30", "15:00"];

  const state = {
    slot: slots.includes(config.defaultSlot) ? config.defaultSlot : slots[0],
    reservations: [],
    toastTimer: null,
    refreshTimer: null,
    loading: false
  };

  const $ = id => document.getElementById(id);
  const el = {
    slotTabs: $("slotTabs"), waitingCount: $("waitingCount"), callingCount: $("callingCount"), holdCount: $("holdCount"), guidedCount: $("guidedCount"),
    nextNumber: $("nextNumber"), nextStatus: $("nextStatus"), nextMeta: $("nextMeta"), callNextBtn: $("callNextBtn"),
    listTitle: $("listTitle"), reservationList: $("reservationList"), lastUpdated: $("lastUpdated"), refreshBtn: $("refreshBtn"),
    connectionBadge: $("connectionBadge"), notice: $("notice"), settingsBtn: $("settingsBtn"), settingsModal: $("settingsModal"),
    settingsForm: $("settingsForm"), closeSettingsBtn: $("closeSettingsBtn"), clearSettingsBtn: $("clearSettingsBtn"),
    apiKeyInput: $("apiKeyInput"), storeIdInput: $("storeIdInput"), storeNoInput: $("storeNoInput"), toast: $("toast")
  };

  const statusLabel = {
    waiting: "待機", calling: "呼出中", hold: "保留", guided: "案内済", processing: "対応中", cancelled: "取消", unknown: "不明"
  };

  function esc(v) {
    return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  // APIが受付時間の昇順で返すため、ここでは番号順に並べ替えない。
  // WEB枠と店頭枠を混ぜた「本当の受付順」を守る。
  function currentList() {
    return state.reservations.filter(x => x.slot === state.slot).sort((a, b) => a.orderIndex - b.orderIndex);
  }

  function nextWaiting() {
    return currentList().find(x => x.status === "waiting");
  }

  function renderTabs() {
    el.slotTabs.innerHTML = slots.map(slot => `<button class="slot-tab ${slot === state.slot ? "active" : ""}" type="button" data-slot="${esc(slot)}">${esc(slot)}</button>`).join("");
  }

  function renderSummary(list) {
    const c = s => list.filter(x => x.status === s).length;
    el.waitingCount.textContent = c("waiting");
    el.callingCount.textContent = c("calling");
    el.holdCount.textContent = c("hold");
    el.guidedCount.textContent = c("guided");
  }

  function renderNext() {
    const row = nextWaiting();
    if (!row) {
      el.nextNumber.textContent = "—";
      el.nextStatus.textContent = "—";
      el.nextMeta.textContent = adapter.hasCredentials() ? "この枠に待機中の受付はありません" : "API設定後に実データを表示します";
      el.callNextBtn.disabled = true;
      return;
    }
    el.nextNumber.textContent = `No.${row.number}`;
    el.nextStatus.textContent = statusLabel[row.status] || row.status;
    el.nextMeta.textContent = `${state.slot}枠・Airウェイト受付時間順の先頭`;
    // reserveIdが一覧APIから取得できるまでは誤操作防止で無効化。
    el.callNextBtn.disabled = true;
  }

  function renderList(list) {
    el.listTitle.textContent = `${state.slot}枠`;
    if (!adapter.hasCredentials()) {
      el.reservationList.innerHTML = `<div class="empty-state">「API設定」から、この端末にAirウェイトの設定を登録してください。</div>`;
      return;
    }
    if (!list.length) {
      el.reservationList.innerHTML = `<div class="empty-state">この時間枠の受付はありません</div>`;
      return;
    }
    el.reservationList.innerHTML = list.map((item, i) => `
      <article class="reservation-row">
        <div class="row-main">
          <div class="row-top">
            <span class="res-number">No.${esc(item.number)}</span>
            <span class="status-chip status-${esc(item.status)}">${esc(statusLabel[item.status] || item.status)}</span>
          </div>
          <p class="row-meta">受付順 ${i + 1}番目${item.waitTypeName ? ` ・ ${esc(item.waitTypeName)}` : ""}</p>
        </div>
        <div class="row-actions one-col">
          <button class="action-btn" type="button" disabled>呼出</button>
          <button class="action-btn" type="button" disabled>保留</button>
          <button class="action-btn" type="button" disabled>案内</button>
        </div>
      </article>`).join("");
  }

  function render() {
    const list = currentList();
    renderTabs(); renderSummary(list); renderNext(); renderList(list);
    if (adapter.hasCredentials()) {
      el.connectionBadge.textContent = "LIVE";
      el.connectionBadge.className = "badge badge-live";
      el.notice.hidden = true;
    } else {
      el.connectionBadge.textContent = "未設定";
      el.connectionBadge.className = "badge badge-demo";
      el.notice.textContent = "ダミー番号や番号帯からの生成は一切しません。APIが返した実受付番号だけを表示します。";
      el.notice.hidden = false;
    }
  }

  function toast(msg, error = false) {
    clearTimeout(state.toastTimer);
    el.toast.textContent = msg;
    el.toast.className = `toast ${error ? "error" : ""}`;
    el.toast.hidden = false;
    state.toastTimer = setTimeout(() => { el.toast.hidden = true; }, error ? 4500 : 2200);
  }

  async function refresh(silent = false) {
    if (state.loading) return;
    if (!adapter.hasCredentials()) { render(); openSettings(true); return; }
    state.loading = true;
    el.refreshBtn.disabled = true;
    try {
      const rows = await adapter.fetchReservations();
      state.reservations = rows;
      el.lastUpdated.textContent = `更新 ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      render();
    } catch (e) {
      el.connectionBadge.textContent = "ERROR";
      el.connectionBadge.className = "badge badge-error";
      el.notice.textContent = e.message || "Airウェイトの取得に失敗しました";
      el.notice.hidden = false;
      if (!silent) toast(e.message || "取得に失敗しました", true);
    } finally {
      state.loading = false;
      el.refreshBtn.disabled = false;
    }
  }

  function openSettings(first = false) {
    const c = adapter.getCredentials();
    el.apiKeyInput.value = "";
    el.storeIdInput.value = c?.storeId || "";
    el.storeNoInput.value = c?.storeNo || "";
    el.settingsModal.hidden = false;
    if (!first) setTimeout(() => el.apiKeyInput.focus(), 30);
  }
  function closeSettings() { if (adapter.hasCredentials()) el.settingsModal.hidden = true; }

  el.slotTabs.addEventListener("click", e => {
    const b = e.target.closest("[data-slot]");
    if (!b) return;
    state.slot = b.dataset.slot;
    render();
  });
  el.refreshBtn.addEventListener("click", () => refresh(false));
  el.settingsBtn.addEventListener("click", () => openSettings(false));
  el.closeSettingsBtn.addEventListener("click", closeSettings);
  el.settingsModal.addEventListener("click", e => { if (e.target === el.settingsModal) closeSettings(); });
  el.settingsForm.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      adapter.setCredentials({ apiKey: el.apiKeyInput.value, storeId: el.storeIdInput.value, storeNo: el.storeNoInput.value });
      el.settingsModal.hidden = true;
      toast("API設定を保存しました");
      await refresh(false);
    } catch (err) { toast(err.message || "設定を保存できません", true); }
  });
  el.clearSettingsBtn.addEventListener("click", () => {
    if (!confirm("この端末に保存したAirウェイトAPI設定を削除しますか？")) return;
    adapter.clearCredentials();
    state.reservations = [];
    el.settingsModal.hidden = true;
    render();
    toast("API設定を削除しました");
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && adapter.hasCredentials()) refresh(true); });

  async function start() {
    render();
    if (adapter.hasCredentials()) await refresh(false);
    else openSettings(true);
    state.refreshTimer = setInterval(() => { if (!document.hidden && adapter.hasCredentials()) refresh(true); }, Math.max(5000, Number(config.refreshMs || 10000)));
  }
  start();
})();
