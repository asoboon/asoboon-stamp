/* ASOQUEST v4 — one-day, serverless, image-asset-free lane.
   Existing stamp rally is intentionally untouched.
   Progress is stored only in this browser's localStorage, keyed by Japan date. */
(() => {
  'use strict';

  const CONFIG = {
    TOTAL: 6,
    STORAGE_PREFIX: 'asoquest:v4',
    TIME_ZONE: 'Asia/Tokyo'
  };

  const PARTS = [
    { id: 'wheel',    no: '01', name: 'タイヤ',     icon: '🛞' },
    { id: 'steering', no: '02', name: 'ハンドル',   icon: '◉' },
    { id: 'battery',  no: '03', name: 'バッテリー', icon: '🔋' },
    { id: 'engine',   no: '04', name: 'エンジン',   icon: '⚙️' },
    { id: 'light',    no: '05', name: 'ライト',     icon: '💡' },
    { id: 'key',      no: '06', name: 'キー',       icon: '🔑' }
  ];
  const PART_IDS = new Set(PARTS.map(p => p.id));

  const state = {
    partId: '',
    station: '',
    source: readSource(),
    acquired: [],
    completed: false,
    storageKey: ''
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    loading: $('loading'), loadingLabel: $('loadingLabel'), progressBadge: $('progressBadge'), partsCount: $('partsCount'),
    partsGrid: $('partsGrid'), carStage: $('carStage'), carPulse: $('carPulse'), machineState: $('machineState'),
    machinePanel: document.querySelector('.machinePanel'), headline: $('headline'), subline: $('subline'),
    engineCard: $('engineCard'), engineTitle: $('engineTitle'), engineHint: $('engineHint'), engineLock: $('engineLock'),
    resultOverlay: $('resultOverlay'), resultKicker: $('resultKicker'), resultTitle: $('resultTitle'), resultText: $('resultText'),
    shortageOverlay: $('shortageOverlay'), missingNumber: $('missingNumber'), missingInline: $('missingInline'),
    completeOverlay: $('completeOverlay'), completeTitle: $('completeTitle'), completeText: $('completeText'),
    errorOverlay: $('errorOverlay'), errorTitle: $('errorTitle'), errorText: $('errorText')
  };

  document.addEventListener('DOMContentLoaded', init);
  $('resultClose').addEventListener('click', () => {
    closeOverlay(els.resultOverlay);
    cleanRouteInPlace();
  });
  $('shortageClose').addEventListener('click', () => {
    closeOverlay(els.shortageOverlay);
    cleanRouteInPlace();
  });
  $('completeClose').addEventListener('click', () => {
    closeOverlay(els.completeOverlay);
    cleanRouteInPlace();
    renderStatus();
  });
  $('errorRetry').addEventListener('click', () => location.reload());
  $('refreshBtn').addEventListener('click', () => {
    cleanRouteInPlace();
    loadState();
    renderStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  function init() {
    try {
      setLoading('アソクエを起動しています');
      assertStorageAvailable();
      state.storageKey = `${CONFIG.STORAGE_PREFIX}:${japanDateKey()}`;
      cleanupOldKeys();

      const route = readRoute();
      state.partId = route.partId;
      state.station = route.station;
      loadState();

      let result = { action: 'status', acquired: [...state.acquired], count: state.acquired.length };
      if (state.partId) result = collectPart(state.partId);
      else if (state.station === 'engine') result = checkEngine();

      renderStatus();
      hideLoading();

      if (state.partId) handleCollectResult(result);
      else if (state.station === 'engine') handleEngineResult(result);
    } catch (err) {
      hideLoading();
      showError(err);
    }
  }

  function readRoute() {
    const p = new URLSearchParams(location.search);
    const partId = String(p.get('part') || '').trim().toLowerCase();
    const station = String(p.get('station') || '').trim().toLowerCase();
    return {
      partId: PART_IDS.has(partId) ? partId : '',
      station: station === 'engine' ? 'engine' : ''
    };
  }

  function readSource() {
    const p = new URLSearchParams(location.search);
    const source = String(p.get('src') || p.get('source') || '').trim().toLowerCase();
    return source === 'nfc' || source === 'qr' ? source : 'unknown';
  }

  function japanDateKey() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: CONFIG.TIME_ZONE,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  function assertStorageAvailable() {
    const testKey = '__asoquest_storage_test__';
    try {
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
    } catch (_) {
      throw userError('STORAGE_UNAVAILABLE', 'このブラウザでは遊べません', 'ブラウザのプライベート設定やサイトデータ設定をご確認ください。');
    }
  }

  function loadState() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(state.storageKey) || '{}');
    } catch (_) {
      saved = {};
    }
    state.acquired = Array.isArray(saved.acquired)
      ? [...new Set(saved.acquired.filter(id => PART_IDS.has(id)))]
      : [];
    state.completed = Boolean(saved.completed);
  }

  function saveState(extra = {}) {
    const payload = {
      version: 4,
      date: japanDateKey(),
      acquired: [...state.acquired],
      completed: Boolean(state.completed),
      updatedAt: new Date().toISOString(),
      lastSource: state.source,
      ...extra
    };
    localStorage.setItem(state.storageKey, JSON.stringify(payload));
  }

  function collectPart(partId) {
    if (!PART_IDS.has(partId)) return { action: 'collect', collectStatus: 'invalid' };

    const already = state.acquired.includes(partId);
    if (!already) {
      state.acquired.push(partId);
      saveState({ lastAction: 'collect', lastPart: partId });
    }

    return {
      action: 'collect',
      collectStatus: already ? 'already' : 'new',
      currentPart: partId,
      acquired: [...state.acquired],
      count: state.acquired.length,
      total: CONFIG.TOTAL
    };
  }

  function checkEngine() {
    const missing = Math.max(0, CONFIG.TOTAL - state.acquired.length);
    if (missing > 0) {
      saveState({ lastAction: 'engine_locked' });
      return {
        action: 'engine',
        engineStatus: 'locked',
        missing,
        acquired: [...state.acquired],
        count: state.acquired.length,
        total: CONFIG.TOTAL
      };
    }

    state.completed = true;
    saveState({ lastAction: 'engine_clear', completedAt: new Date().toISOString() });
    return {
      action: 'engine',
      engineStatus: 'clear',
      missing: 0,
      acquired: [...state.acquired],
      count: state.acquired.length,
      total: CONFIG.TOTAL
    };
  }

  function cleanupOldKeys() {
    // One-day game: today gets a fresh key automatically. Keep only today's v4 record.
    const current = state.storageKey;
    const prefix = `${CONFIG.STORAGE_PREFIX}:`;
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && key !== current) localStorage.removeItem(key);
      }
    } catch (_) {}
  }

  function renderStatus() {
    const count = state.acquired.length;
    els.progressBadge.innerHTML = `<b>${count}</b><span>/ 6</span>`;
    els.partsCount.textContent = `${count} / 6`;
    els.carStage.dataset.count = String(count);
    document.querySelectorAll('.part').forEach(el => el.classList.toggle('acquired', state.acquired.includes(el.dataset.part)));
    renderPartCards();

    const ready = count >= CONFIG.TOTAL;
    els.machinePanel.classList.toggle('ready', ready);
    els.engineCard.classList.toggle('ready', ready);
    els.engineCard.classList.toggle('locked', !ready);

    if (ready) {
      els.machineState.textContent = state.completed ? 'MISSION COMPLETE' : 'MACHINE READY';
      els.headline.textContent = state.completed ? 'アソクエ クリア！' : 'パーツがぜんぶそろった！';
      els.subline.textContent = state.completed ? 'きょうのミッション完了！' : 'ENGINE STARTを探して、マシンを起動しよう。';
      els.engineTitle.textContent = state.completed ? 'COMPLETE' : 'UNLOCKED';
      els.engineHint.textContent = state.completed ? 'エンジン始動成功！' : 'ENGINE STARTへ行こう！';
      els.engineLock.textContent = state.completed ? '🏁' : '⚡';
    } else {
      const missing = CONFIG.TOTAL - count;
      els.machineState.textContent = count ? `ASSEMBLY ${count} / 6` : 'MACHINE OFFLINE';
      els.headline.textContent = count ? `あと${missing}こで完成！` : '6つのパーツを見つけよう！';
      els.subline.textContent = '館内を探して、スマホをタッチ。';
      els.engineTitle.textContent = 'LOCKED';
      els.engineHint.textContent = `あと${missing}こ集めると起動できます`;
      els.engineLock.textContent = '🔒';
    }
  }

  function partIconSvg(id) {
    const icons = {
      wheel: `<svg viewBox="0 0 64 64"><circle class="i-stroke" cx="32" cy="32" r="24"/><circle class="i-stroke" cx="32" cy="32" r="12"/><path class="i-stroke" d="M32 20v24M20 32h24M23.5 23.5l17 17M40.5 23.5l-17 17"/></svg>`,
      steering: `<svg viewBox="0 0 64 64"><circle class="i-stroke" cx="32" cy="32" r="24"/><circle class="i-fill" cx="32" cy="32" r="6"/><path class="i-stroke" d="M32 32v19M32 32L16 21M32 32l16-11"/></svg>`,
      battery: `<svg viewBox="0 0 64 64"><rect class="i-stroke" x="10" y="19" width="44" height="33" rx="6"/><path class="i-stroke" d="M20 19v-7h9v7M36 19v-7h9v7M18 34h12M24 28v12M38 34h9"/></svg>`,
      engine: `<svg viewBox="0 0 64 64"><path class="i-stroke" d="M12 30h9V20h11v7h12l6 7h8v18H49l-5 6H24l-5-6h-9V36h2Z"/><path class="i-stroke" d="M28 36h15M28 43h15"/></svg>`,
      light: `<svg viewBox="0 0 64 64"><circle class="i-stroke" cx="27" cy="32" r="17"/><path class="i-stroke" d="M44 24h12M47 32h11M44 40h12"/><path class="i-fill i-accent" d="M18 22q18 10 0 20q8-10 0-20Z"/></svg>`,
      key: `<svg viewBox="0 0 64 64"><circle class="i-stroke" cx="21" cy="23" r="11"/><path class="i-stroke" d="M29 31l23 23M43 45h8v-8M37 39h8v-8"/></svg>`
    };
    return icons[id] || '';
  }

  function renderPartCards() {
    els.partsGrid.innerHTML = PARTS.map(p => {
      const got = state.acquired.includes(p.id);
      return `<div class="partCard ${got ? 'acquired' : ''}">${got ? '<span class="checkBadge">✓</span>' : ''}<span class="partIcon">${partIconSvg(p.id)}</span><strong>${p.name}</strong><small>${got ? 'FOUND' : 'NOT FOUND'} · ${p.no}</small></div>`;
    }).join('');
    document.querySelectorAll('#segmentBar i').forEach((el, idx) => el.classList.toggle('on', idx < state.acquired.length));
  }

  function handleCollectResult(result) {
    const part = PARTS.find(p => p.id === state.partId);
    if (!part) return;

    if (result.collectStatus === 'new') {
      els.resultKicker.textContent = 'PART GET!';
      els.resultTitle.textContent = part.name;
      els.resultText.textContent = state.acquired.length >= CONFIG.TOTAL
        ? 'これでパーツがぜんぶそろった！'
        : 'マシンにパーツがついた！';
      fireCarPulse();
      vibrate([35, 25, 70, 30, 110]);
      showOverlay(els.resultOverlay);
    } else if (result.collectStatus === 'already') {
      els.resultKicker.textContent = 'ALREADY FOUND';
      els.resultTitle.textContent = part.name;
      els.resultText.textContent = 'このパーツはもう見つけているよ！';
      showOverlay(els.resultOverlay);
    }
  }

  function handleEngineResult(result) {
    if (result.engineStatus === 'locked') {
      const missing = Number(result.missing ?? Math.max(0, CONFIG.TOTAL - state.acquired.length));
      els.missingNumber.textContent = String(missing);
      els.missingInline.textContent = String(missing);
      vibrate([45, 45, 45]);
      showOverlay(els.shortageOverlay);
      return;
    }
    if (result.engineStatus === 'clear') runEngineSequence();
  }

  function runEngineSequence() {
    showOverlay(els.completeOverlay);
    els.completeOverlay.classList.remove('cleared');
    els.completeTitle.textContent = 'ENGINE START';
    els.completeText.textContent = 'マシンを起動中…';
    vibrate([40, 40, 70, 40, 130, 50, 220]);

    setTimeout(() => {
      els.completeTitle.textContent = 'IGNITION!';
      els.completeText.textContent = 'エンジン始動！';
      vibrate([80, 35, 160]);
    }, 1350);

    setTimeout(() => {
      els.completeTitle.textContent = 'GO!';
      els.completeText.textContent = 'アソクエ コンプリート！';
      els.completeOverlay.classList.add('cleared');
      vibrate([45, 25, 45, 25, 180]);
    }, 2550);
  }

  function fireCarPulse() {
    els.carPulse.classList.remove('fire');
    requestAnimationFrame(() => els.carPulse.classList.add('fire'));
  }

  function setLoading(text) {
    els.loadingLabel.textContent = text;
    els.loading.classList.add('show');
    els.loading.setAttribute('aria-hidden', 'false');
  }
  function hideLoading() {
    els.loading.classList.remove('show');
    els.loading.setAttribute('aria-hidden', 'true');
  }
  function showOverlay(el) {
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
  }
  function closeOverlay(el) {
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
  }
  function showError(err) {
    els.errorTitle.textContent = err?.title || '読み込めませんでした';
    els.errorText.textContent = err?.userMessage || err?.message || 'もう一度お試しください。';
    showOverlay(els.errorOverlay);
  }
  function vibrate(pattern) {
    try { navigator.vibrate?.(pattern); } catch (_) {}
  }
  function userError(code, title, userMessage) {
    const e = new Error(code);
    e.code = code;
    e.title = title;
    e.userMessage = userMessage;
    return e;
  }
  function cleanHomeUrl() {
    const u = new URL(location.href);
    ['part', 'station', 'src', 'source'].forEach(k => u.searchParams.delete(k));
    return u.toString();
  }
  function cleanRouteInPlace() {
    try { history.replaceState(null, '', cleanHomeUrl()); } catch (_) {}
  }
})();
