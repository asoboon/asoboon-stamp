(function () {
  "use strict";

  const config = window.ASOBOON_STAFF_CONFIG || {};
  const adapter = window.ASOBoonAirWait.create(config);
  const slots = Array.isArray(config.slots) && config.slots.length ? config.slots : ["10:00", "12:30", "15:00"];

  const state = {
    slot: slots.includes(config.defaultSlot) ? config.defaultSlot : slots[0],
    reservations: [],
    busyIds: new Set(),
    editingId: null,
    editingAdult: 0,
    editingChild: 0,
    toastTimer: null,
    refreshTimer: null
  };

  const el = {
    slotTabs: document.getElementById("slotTabs"),
    waitingCount: document.getElementById("waitingCount"),
    callingCount: document.getElementById("callingCount"),
    holdCount: document.getElementById("holdCount"),
    guidedCount: document.getElementById("guidedCount"),
    nextNumber: document.getElementById("nextNumber"),
    nextPeople: document.getElementById("nextPeople"),
    nextMeta: document.getElementById("nextMeta"),
    callNextBtn: document.getElementById("callNextBtn"),
    listTitle: document.getElementById("listTitle"),
    reservationList: document.getElementById("reservationList"),
    lastUpdated: document.getElementById("lastUpdated"),
    refreshBtn: document.getElementById("refreshBtn"),
    connectionBadge: document.getElementById("connectionBadge"),
    modal: document.getElementById("peopleModal"),
    modalTitle: document.getElementById("peopleModalTitle"),
    adultCount: document.getElementById("adultCount"),
    childCount: document.getElementById("childCount"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    savePeopleBtn: document.getElementById("savePeopleBtn"),
    toast: document.getElementById("toast")
  };

  const statusLabel = {
    waiting: "待機",
    calling: "呼出中",
    hold: "保留",
    guided: "案内済"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function currentList() {
    return state.reservations
      .filter(x => String(x.slot) === String(state.slot))
      .sort((a, b) => {
        const ta = Date.parse(a.reservedAt || "") || 0;
        const tb = Date.parse(b.reservedAt || "") || 0;
        if (ta !== tb) return ta - tb;
        return Number(a.number || 0) - Number(b.number || 0);
      });
  }

  function nextWaiting() {
    return currentList().find(x => x.status === "waiting");
  }

  function renderTabs() {
    el.slotTabs.innerHTML = slots.map(slot => `
      <button class="slot-tab ${slot === state.slot ? "active" : ""}" type="button" data-slot="${escapeHtml(slot)}">
        ${escapeHtml(slot)}
      </button>
    `).join("");
  }

  function renderSummary(list) {
    const count = status => list.filter(x => x.status === status).length;
    el.waitingCount.textContent = count("waiting");
    el.callingCount.textContent = count("calling");
    el.holdCount.textContent = count("hold");
    el.guidedCount.textContent = count("guided");
  }

  function renderNext() {
    const next = nextWaiting();
    if (!next) {
      el.nextNumber.textContent = "—";
      el.nextPeople.textContent = "—";
      el.nextMeta.textContent = "待機中の受付はありません";
      el.callNextBtn.disabled = true;
      return;
    }
    el.nextNumber.textContent = `No.${next.number}`;
    el.nextPeople.textContent = `大${next.adult} / 子${next.child}`;
    el.nextMeta.textContent = `予約順の先頭・${state.slot}枠`;
    el.callNextBtn.disabled = state.busyIds.has(String(next.id));
    el.callNextBtn.dataset.id = String(next.id);
  }

  function actionButton(action, label, id, primary) {
    return `<button class="action-btn ${primary ? "primary" : ""}" type="button" data-action="${action}" data-id="${escapeHtml(id)}">${label}</button>`;
  }

  function renderList(list) {
    el.listTitle.textContent = `${state.slot}枠`;
    if (!list.length) {
      el.reservationList.innerHTML = `<div class="empty-state">この時間枠の受付はありません</div>`;
      return;
    }

    el.reservationList.innerHTML = list.map(item => {
      const busy = state.busyIds.has(String(item.id));
      return `
        <article class="reservation-row ${busy ? "busy" : ""}" data-row-id="${escapeHtml(item.id)}">
          <div class="row-main">
            <div class="row-top">
              <span class="res-number">No.${escapeHtml(item.number)}</span>
              <span class="status-chip status-${escapeHtml(item.status)}">${escapeHtml(statusLabel[item.status] || item.status)}</span>
              <span class="people-pill">大${escapeHtml(item.adult)} / 子${escapeHtml(item.child)}</span>
            </div>
            <p class="row-meta">予約順 ${list.indexOf(item) + 1}番目</p>
          </div>
          <div class="row-actions">
            ${actionButton("call", "呼出", item.id, item.status === "waiting")}
            ${actionButton("hold", "保留", item.id, false)}
            ${actionButton("guide", "案内", item.id, false)}
            ${actionButton("people", "人数", item.id, false)}
          </div>
        </article>
      `;
    }).join("");
  }

  function render() {
    const list = currentList();
    renderTabs();
    renderSummary(list);
    renderNext();
    renderList(list);
    el.connectionBadge.textContent = adapter.kind === "live" ? "LIVE" : "DEMO";
    el.connectionBadge.className = `badge ${adapter.kind === "live" ? "badge-live" : "badge-demo"}`;
  }

  function showToast(message, isError) {
    clearTimeout(state.toastTimer);
    el.toast.textContent = message;
    el.toast.className = `toast ${isError ? "error" : ""}`;
    el.toast.hidden = false;
    state.toastTimer = setTimeout(() => { el.toast.hidden = true; }, isError ? 3800 : 1800);
  }

  function patchLocal(id, patch) {
    const item = state.reservations.find(x => String(x.id) === String(id));
    if (item) Object.assign(item, patch);
  }

  async function refresh(silent) {
    try {
      const data = await adapter.fetchReservations();
      state.reservations = Array.isArray(data) ? data : [];
      el.lastUpdated.textContent = `更新 ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      render();
    } catch (err) {
      el.connectionBadge.textContent = "ERROR";
      el.connectionBadge.className = "badge badge-error";
      if (!silent) showToast(err.message || "更新に失敗しました", true);
    }
  }

  async function runAction(id, type) {
    const item = state.reservations.find(x => String(x.id) === String(id));
    if (!item || state.busyIds.has(String(id))) return;

    const previous = { ...item };
    const optimisticStatus = type === "call" ? "calling" : type === "hold" ? "hold" : type === "guide" ? "guided" : null;
    if (optimisticStatus) patchLocal(id, { status: optimisticStatus });
    state.busyIds.add(String(id));
    render();

    try {
      if (type === "call") await adapter.callReservation(id);
      if (type === "hold") await adapter.holdReservation(id);
      if (type === "guide") await adapter.guideReservation(id);
      showToast(type === "call" ? `No.${item.number} を呼び出しました` : type === "hold" ? `No.${item.number} を保留にしました` : `No.${item.number} を案内済みにしました`);
      if (adapter.kind === "live") await refresh(true);
    } catch (err) {
      Object.assign(item, previous);
      showToast(err.message || "操作に失敗しました", true);
    } finally {
      state.busyIds.delete(String(id));
      render();
    }
  }

  function openPeopleModal(id) {
    const item = state.reservations.find(x => String(x.id) === String(id));
    if (!item) return;
    state.editingId = String(id);
    state.editingAdult = Number(item.adult || 0);
    state.editingChild = Number(item.child || 0);
    el.modalTitle.textContent = `No.${item.number}`;
    renderCounters();
    el.modal.hidden = false;
  }

  function closePeopleModal() {
    el.modal.hidden = true;
    state.editingId = null;
  }

  function renderCounters() {
    el.adultCount.textContent = state.editingAdult;
    el.childCount.textContent = state.editingChild;
  }

  async function savePeople() {
    const id = state.editingId;
    if (!id) return;
    const item = state.reservations.find(x => String(x.id) === String(id));
    if (!item) return;
    const previous = { adult: item.adult, child: item.child };
    patchLocal(id, { adult: state.editingAdult, child: state.editingChild });
    closePeopleModal();
    render();
    try {
      await adapter.updatePeople(id, state.editingAdult, state.editingChild);
      showToast(`No.${item.number} の人数を変更しました`);
      if (adapter.kind === "live") await refresh(true);
    } catch (err) {
      patchLocal(id, previous);
      render();
      showToast(err.message || "人数変更に失敗しました", true);
    }
  }

  el.slotTabs.addEventListener("click", e => {
    const btn = e.target.closest("[data-slot]");
    if (!btn) return;
    state.slot = btn.dataset.slot;
    render();
  });

  el.callNextBtn.addEventListener("click", () => {
    const id = el.callNextBtn.dataset.id;
    if (id) runAction(id, "call");
  });

  el.reservationList.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "people") openPeopleModal(id);
    else runAction(id, action);
  });

  el.refreshBtn.addEventListener("click", () => refresh(false));
  el.closeModalBtn.addEventListener("click", closePeopleModal);
  el.modal.addEventListener("click", e => { if (e.target === el.modal) closePeopleModal(); });
  el.savePeopleBtn.addEventListener("click", savePeople);

  document.querySelectorAll("[data-counter]").forEach(btn => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.dataset.delta || 0);
      if (btn.dataset.counter === "adult") state.editingAdult = Math.max(0, state.editingAdult + delta);
      if (btn.dataset.counter === "child") state.editingChild = Math.max(0, state.editingChild + delta);
      renderCounters();
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh(true);
  });

  async function start() {
    renderTabs();
    await refresh(false);
    const ms = Math.max(5000, Number(config.refreshMs || 12000));
    state.refreshTimer = setInterval(() => {
      if (!document.hidden && adapter.kind === "live") refresh(true);
    }, ms);
  }

  start();
})();
