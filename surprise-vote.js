
(() => {
  'use strict';

  const DEFAULTS = {
    API_URL: '',
    LIFF_ID: '2009888671-57TOefc3',
    HOME_URL: './home.html?mode=inside',
    POLL_INTERVAL_MIN_MS: 25000,
    POLL_INTERVAL_MAX_MS: 35000,
    COMPLETED_POLL_INTERVAL_MIN_MS: 45000,
    COMPLETED_POLL_INTERVAL_MAX_MS: 60000,
    SYNC_IDLE_MIN_MS: 1200,
    SYNC_IDLE_MAX_MS: 1800,
    SYNC_TAP_BATCH_MIN: 17,
    SYNC_TAP_BATCH_MAX: 23,
    RETRY_MIN_MS: 500,
    RETRY_MAX_MS: 2000,
    RESUME_REFRESH_STALE_MS: 10000,
    INITIAL_JITTER_MAX_MS: 3000,
    FINAL_SYNC_GRACE_MS: 20000,
    DAILY_RESET_HOUR: 18,
    REQUEST_TIMEOUT_MS: 12000,
    MAX_POINTS: 100
  };

  const CFG = Object.freeze({
    ...DEFAULTS,
    ...(window.ASOBOON_SURPRISE_VOTE_CONFIG || {})
  });

  const PAGE_PARAMS =
    new URLSearchParams(location.search);

  const DEMO =
    PAGE_PARAMS.get('demo') === '1';

  const EMBEDDED =
    PAGE_PARAMS.get('embedded') === '1';

  const DEMO_STORAGE_KEY = 'asoboon-surprise-demo-v2';

  const reduced =
    !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = id => document.getElementById(id);

  const els = {
    homeLink: $('homeLink'),
    loading: $('loadingState'),
    idle: $('idleState'),
    idleTitle: $('idleTitle'),
    idleText: $('idleText'),
    error: $('errorState'),
    errorTitle: $('errorTitle'),
    errorText: $('errorText'),
    retry: $('retryBtn'),
    vote: $('voteState'),
    result: $('resultState'),
    standings: $('standingsState'),
    standingsCountdown: $('standingsCountdown'),
    standingsList: $('standingsList'),
    standingsUpdated: $('standingsUpdated'),
    standingsRefresh: $('standingsRefresh'),
    eventTime: $('eventTimeLabel'),
    timebar: $('timebar'),
    countdown: $('countdown'),
    remaining: $('remaining'),
    walletFill: $('walletFill'),
    activeName: $('activeName'),
    activeMine: $('activeMine'),
    combo: $('combo'),
    comboValue: $('comboValue'),
    pushBtn: $('pushBtn'),
    tapFx: $('tapFx'),
    syncText: $('syncText'),
    race: $('race'),
    candidates: $('candidates'),
    resultEventTime: $('resultEventTime'),
    winnerName: $('winnerName'),
    winnerPoints: $('winnerPoints'),
    resultList: $('resultList'),
    completion: $('completion'),
    completionText: $('completionText'),
    completionSummary: $('completionSummary'),
    completionClose: $('completionClose'),
    burst: $('burst'),
    milestone: $('milestone'),
    demoReset: $('demoResetBtn')
  };

  const state = {
    mode: 'loading',
    event: null,
    voterKey: '',
    selected: '',
    alloc: {},
    serverAlloc: {},
    serverTotals: {},
    localTotals: {},
    used: 0,
    remaining: Number(CFG.MAX_POINTS || 100),
    combo: 0,
    dirty: false,
    syncing: false,
    pendingTaps: 0,
    nextSyncTapTarget: 20,
    syncTimer: null,
    pollTimer: null,
    countdownTimer: null,
    dailyResetTimer: null,
    lastStatusAt: 0,
    serverOffsetMs: 0,
    expired: false,
    completionShown: false,
    rankVisible: false,
    standingsOpen: false,
    upcomingRefreshStarted: false,
    optionButtons: new Map()
  };

  const fxPool = [];
  let fxIndex = 0;
  let milestoneTimer = null;

  function fmt(value) {
    return Math.max(0, Number(value) || 0)
      .toLocaleString('ja-JP');
  }

  function sumAlloc(obj) {
    return Object.values(obj || {})
      .reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  }

  function copyAlloc(obj) {
    const out = {};
    Object.entries(obj || {}).forEach(([key, value]) => {
      const n = Math.max(0, Math.floor(Number(value) || 0));
      if (n > 0) out[key] = n;
    });
    return out;
  }

  function sameAlloc(a, b) {
    const keys = new Set([
      ...Object.keys(a || {}),
      ...Object.keys(b || {})
    ]);
    for (const key of keys) {
      if (Number(a?.[key] || 0) !== Number(b?.[key] || 0)) {
        return false;
      }
    }
    return true;
  }

  function randomInt(min, max) {
    const lo = Math.ceil(Number(min) || 0);
    const hi = Math.floor(Number(max) || lo);
    return lo + Math.floor(Math.random() * Math.max(1, hi - lo + 1));
  }

  function nextBatchTarget() {
    return randomInt(
      CFG.SYNC_TAP_BATCH_MIN || 17,
      CFG.SYNC_TAP_BATCH_MAX || 23
    );
  }

  function syncIdleDelay() {
    return randomInt(
      CFG.SYNC_IDLE_MIN_MS || 1200,
      CFG.SYNC_IDLE_MAX_MS || 1800
    );
  }

  function pollDelay() {
    const completed =
      state.used >= Number(CFG.MAX_POINTS || 100);

    return completed
      ? randomInt(
          CFG.COMPLETED_POLL_INTERVAL_MIN_MS || 45000,
          CFG.COMPLETED_POLL_INTERVAL_MAX_MS || 60000
        )
      : randomInt(
          CFG.POLL_INTERVAL_MIN_MS || 25000,
          CFG.POLL_INTERVAL_MAX_MS || 35000
        );
  }

  function retryDelay() {
    return randomInt(
      CFG.RETRY_MIN_MS || 500,
      CFG.RETRY_MAX_MS || 2000
    );
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  }

  function finalSyncRemainingMs() {
    const explicit = Date.parse(state.event?.settle_end || '');
    if (Number.isFinite(explicit)) return explicit - serverNowMs();

    const end = Date.parse(state.event?.vote_end || '');
    if (!Number.isFinite(end)) return 0;
    return end + Number(CFG.FINAL_SYNC_GRACE_MS || 20000) - serverNowMs();
  }

  function jstHour() {
    try {
      const hour = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        hour12: false
      }).format(new Date(serverNowMs()));
      return Number(hour) % 24;
    } catch (_) {
      return new Date(serverNowMs()).getHours();
    }
  }

  function clearDailyPendingState() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || '';
        if (key.startsWith('asoboon-surprise-pending-v1:')) {
          keys.push(key);
        }
      }
      keys.forEach(key => localStorage.removeItem(key));
    } catch (_) {}
  }

  function enforceDailyReset() {
    if (DEMO || jstHour() < Number(CFG.DAILY_RESET_HOUR || 18)) {
      return false;
    }

    clearDailyPendingState();
    state.event = null;
    state.alloc = {};
    state.serverAlloc = {};
    state.serverTotals = {};
    state.localTotals = {};
    state.used = 0;
    state.remaining = Number(CFG.MAX_POINTS || 100);
    state.dirty = false;
    state.pendingTaps = 0;
    state.expired = true;
    state.selected = '';

    els.idleTitle.textContent = '本日のイベント投票は終了しました';
    els.idleText.textContent = '投票は毎日18:00にリセットされます。';
    show('idle');
    return true;
  }

  function show(name) {
    ['loading', 'idle', 'error', 'vote', 'standings', 'result'].forEach(key => {
      els[key].hidden = key !== name;
    });
    state.mode = name;
  }

  function setSync(text, error = false) {
    els.syncText.textContent = text;
    els.syncText.classList.toggle('error', error);
  }

  function vibrate(pattern) {
    if (reduced || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch (_) {}
  }

  function setHomeLinks() {
    const url = CFG.HOME_URL || './home.html?mode=inside';

    document.querySelectorAll('a[href*="home.html"]').forEach(link => {
      if (EMBEDDED && window.parent && window.parent !== window) {
        link.href = '#';
        link.target = '_self';
        link.addEventListener('click', event => {
          event.preventDefault();
          window.parent.postMessage(
            { type: 'asoboon:restore-home-frame' },
            location.origin
          );
        });
        return;
      }

      link.href = url;
      link.target = '_top';
    });
  }

  function createFxPool() {
    if (reduced) return;
    for (let i = 0; i < 14; i += 1) {
      const span = document.createElement('span');
      span.className = 'tap-plus';
      span.textContent = '+1';
      els.tapFx.appendChild(span);
      fxPool.push(span);
    }
  }

  function spawnPlus() {
    if (reduced || !fxPool.length) return;
    const span = fxPool[fxIndex++ % fxPool.length];
    span.classList.remove('go');
    span.style.setProperty(
      '--dx',
      Math.round((Math.random() - 0.5) * 100) + 'px'
    );
    void span.offsetWidth;
    span.classList.add('go');
  }

  function pulsePush() {
    els.pushBtn.classList.add('hit');
    setTimeout(() => els.pushBtn.classList.remove('hit'), 55);
    els.combo.classList.add('pop');
    setTimeout(() => els.combo.classList.remove('pop'), 85);
    if (state.combo % 4 === 0) vibrate(7);
  }

  function showMilestone(text) {
    clearTimeout(milestoneTimer);
    els.milestone.textContent = text;
    els.milestone.classList.remove('show');
    void els.milestone.offsetWidth;
    els.milestone.classList.add('show');
    milestoneTimer = setTimeout(() => {
      els.milestone.classList.remove('show');
    }, 760);
  }

  function updatePowerStage() {
    const used = Math.max(0, Number(state.used || 0));
    let stage = '0';

    if (used >= 100) stage = '100';
    else if (used >= 90) stage = '90';
    else if (used >= 75) stage = '75';
    else if (used >= 50) stage = '50';
    else if (used >= 25) stage = '25';

    document.body.dataset.voteStage = stage;
  }

  function flashPowerStage(stage) {
    if (reduced) return;
    const app = document.querySelector('.app');
    if (!app) return;

    app.classList.remove('power-stage-hit');
    app.dataset.powerHit = String(stage);
    void app.offsetWidth;
    app.classList.add('power-stage-hit');

    setTimeout(() => {
      app.classList.remove('power-stage-hit');
    }, 900);
  }

  function milestoneAfterTap() {
    updatePowerStage();

    if ([25, 50, 75, 90, 100].includes(state.used)) {
      flashPowerStage(state.used);

      if (state.used === 100) {
        vibrate([30, 25, 55, 30, 95]);
      } else if (state.used >= 75) {
        vibrate([20, 18, 40]);
      } else {
        vibrate([14, 14, 24]);
      }
    }

    if (state.used === 95) {
      showMilestone('あと5！');
    } else if (state.used === 99) {
      showMilestone('あと1！');
    }
  }

  function requestId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return (
      Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2)
    );
  }

  async function sha256Hex(value) {
    if (crypto?.subtle && window.TextEncoder) {
      const bytes = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return [...new Uint8Array(digest)]
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }

    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return 'fallback-' + (hash >>> 0).toString(16);
  }

  function loadLiffSdk() {
    if (window.liff) return Promise.resolve(window.liff);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-asoboon-liff-sdk="1"]'
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(window.liff), {
          once: true
        });
        existing.addEventListener(
          'error',
          () => reject(new Error('LINE連携を読み込めませんでした。')),
          { once: true }
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      script.async = true;
      script.dataset.asoboonLiffSdk = '1';
      script.onload = () => resolve(window.liff);
      script.onerror = () =>
        reject(new Error('LINE連携を読み込めませんでした。'));
      document.head.appendChild(script);
    });
  }

  function getGuestId() {
    const key = 'asoboon-surprise-vote-guest-v1';
    let value = '';
    try {
      value = localStorage.getItem(key) || '';
      if (!value) {
        value = requestId();
        localStorage.setItem(key, value);
      }
    } catch (_) {
      value = requestId();
    }
    return value;
  }

  async function getVoterKey() {
    if (DEMO) return 'demo-voter';

    // Embedded inside HOME: do not initialize the legacy stamp LIFF.
    // This avoids LIFF-to-LIFF transitions and uses the stable device guest key.
    if (EMBEDDED) {
      return await sha256Hex('guest:' + getGuestId());
    }

    if (CFG.LIFF_ID) {
      try {
        const liff = await loadLiffSdk();
        await liff.init({ liffId: CFG.LIFF_ID });

        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          if (profile?.userId) {
            return await sha256Hex(
              'line:' + String(profile.userId)
            );
          }
        }
      } catch (error) {
        console.warn('[surprise-vote] LINE identity fallback', error);
      }
    }

    return await sha256Hex('guest:' + getGuestId());
  }

  function pendingStorageKey() {
    if (!state.event?.id || !state.voterKey) return '';
    return (
      'asoboon-surprise-pending-v1:' +
      state.event.id + ':' +
      state.voterKey.slice(0, 18)
    );
  }

  function loadPending() {
    const key = pendingStorageKey();
    if (!key) return {};
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      return copyAlloc(raw);
    } catch (_) {
      return {};
    }
  }

  function savePending() {
    const key = pendingStorageKey();
    if (!key) return;
    try {
      if (!state.dirty && sameAlloc(state.alloc, state.serverAlloc)) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(state.alloc));
      }
    } catch (_) {}
  }

  function mergePending(serverAlloc, pending) {
    const merged = copyAlloc(serverAlloc);
    Object.entries(pending || {}).forEach(([id, value]) => {
      merged[id] = Math.max(
        Number(merged[id] || 0),
        Number(value || 0)
      );
    });

    if (sumAlloc(merged) > Number(CFG.MAX_POINTS || 100)) {
      return copyAlloc(serverAlloc);
    }

    return merged;
  }

  function encodeTargets(obj) {
    return Object.entries(obj || {})
      .filter(([, value]) => Number(value) > 0)
      .map(([id, value]) =>
        encodeURIComponent(id) + ':' +
        Math.floor(Number(value) || 0)
      )
      .join(',');
  }

  function jsonp(params) {
    if (DEMO) {
      if (params.action === 'vote') {
        return Promise.resolve(makeDemoVoteResponse(params));
      }
      return Promise.resolve(makeDemoStatus());
    }

    if (!CFG.API_URL) {
      return Promise.reject(
        new Error('投票APIがまだ設定されていません。')
      );
    }

    return new Promise((resolve, reject) => {
      const callback =
        '__asoboonSurprise_' +
        Date.now() + '_' +
        Math.floor(Math.random() * 1000000);

      const script = document.createElement('script');
      let finished = false;

      const timer = setTimeout(() => {
        finish(new Error('サーバーから返答がありません。'));
      }, Number(CFG.REQUEST_TIMEOUT_MS || 12000));

      function finish(error, data) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);

        try {
          delete window[callback];
        } catch (_) {
          window[callback] = undefined;
        }

        if (script.parentNode) script.parentNode.removeChild(script);
        error ? reject(error) : resolve(data);
      }

      window[callback] = data => finish(null, data);
      script.onerror = () =>
        finish(new Error('通信に失敗しました。'));

      const query = new URLSearchParams({
        ...params,
        callback,
        _: String(Date.now())
      });

      script.src =
        CFG.API_URL +
        (CFG.API_URL.includes('?') ? '&' : '?') +
        query.toString();

      document.head.appendChild(script);
    });
  }

  function updateServerClock(data) {
    const serverNow = Date.parse(data?.now || '');
    if (Number.isFinite(serverNow)) {
      state.serverOffsetMs = serverNow - Date.now();
    }
  }

  function serverNowMs() {
    return Date.now() + state.serverOffsetMs;
  }

  function optionsFromEvent() {
    return Array.isArray(state.event?.options)
      ? state.event.options
      : [];
  }

  function rankMap() {
    const sorted = optionsFromEvent()
      .map(option => ({
        id: option.id,
        total: Number(state.localTotals[option.id] || 0)
      }))
      .sort((a, b) => b.total - a.total);

    const out = {};
    let last = null;
    let rank = 0;

    sorted.forEach((item, index) => {
      if (last === null || item.total !== last) {
        rank = index + 1;
      }
      out[item.id] = rank;
      last = item.total;
    });

    return out;
  }

  function recalcLocalTotals() {
    state.localTotals = { ...state.serverTotals };
    Object.keys(state.alloc).forEach(id => {
      const unsynced = Math.max(
        0,
        Number(state.alloc[id] || 0) -
        Number(state.serverAlloc[id] || 0)
      );
      state.localTotals[id] =
        Number(state.serverTotals[id] || 0) + unsynced;
    });
  }

  function chooseInitialCandidate() {
    if (state.selected &&
        optionsFromEvent().some(o => o.id === state.selected)) {
      return;
    }

    let best = '';
    let bestValue = 0;

    optionsFromEvent().forEach(option => {
      const mine = Number(state.alloc[option.id] || 0);
      if (mine > bestValue) {
        bestValue = mine;
        best = option.id;
      }
    });

    state.selected = best;
  }

  function makeCandidateButton(option, ranks) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'candidate' +
      (state.selected === option.id ? ' selected' : '');
    button.dataset.option = option.id;

    const name = document.createElement('span');
    name.className = 'candidate-name';
    name.textContent = option.name;

    const rank = document.createElement('span');
    rank.className = 'candidate-rank';
    rank.textContent = state.rankVisible
      ? (ranks[option.id] || '-') + '位'
      : '？';

    const mine = document.createElement('span');
    mine.className = 'candidate-mine';
    mine.textContent =
      'あなた：' +
      fmt(state.alloc[option.id] || 0) +
      ' ASOBooN';

    const total = document.createElement('span');
    total.className = 'candidate-total';
    total.textContent = state.rankVisible
      ? 'みんな：' +
        fmt(state.localTotals[option.id] || 0) +
        ' ASOBooN'
      : '100 ASOBooNを使い切ると公開';

    button.append(name, rank, mine, total);
    button.addEventListener('click', () => {
      selectCandidate(option.id);
    });

    state.optionButtons.set(option.id, {
      button,
      rank,
      mine,
      total
    });

    return button;
  }

  function renderCandidates() {
    const ranks = rankMap();
    state.optionButtons.clear();
    els.candidates.textContent = '';

    optionsFromEvent().forEach(option => {
      els.candidates.appendChild(
        makeCandidateButton(option, ranks)
      );
    });
  }

  function updateCandidateStats() {
    const ranks = rankMap();

    optionsFromEvent().forEach(option => {
      const refs = state.optionButtons.get(option.id);
      if (!refs) return;

      refs.button.classList.toggle(
        'selected',
        state.selected === option.id
      );

      refs.rank.textContent = state.rankVisible
        ? (ranks[option.id] || '-') + '位'
        : '？';

      refs.button.classList.toggle(
        'rank-locked',
        !state.rankVisible
      );

      refs.mine.textContent =
        'あなた：' +
        fmt(state.alloc[option.id] || 0) +
        ' ASOBooN';

      refs.total.textContent = state.rankVisible
        ? 'みんな：' +
          fmt(state.localTotals[option.id] || 0) +
          ' ASOBooN'
        : '100 ASOBooNを使い切ると公開';
    });

    renderRace(ranks);
  }

  function renderRace(ranks = rankMap()) {
    if (!state.rankVisible) {
      els.race.innerHTML =
        '<strong>まずは自分の100 ASOBooNを選ぼう！</strong>' +
        '<span>みんなの順位は100 ASOBooNを使い切ると公開</span>';
      return;
    }

    const options = optionsFromEvent()
      .map(option => ({
        ...option,
        total: Number(state.localTotals[option.id] || 0)
      }))
      .sort((a, b) => b.total - a.total);

    const current = options.find(
      option => option.id === state.selected
    );

    if (!current) {
      els.race.innerHTML =
        '<strong>どれに入れるかは自由！</strong>' +
        '<span>100を全部ひとつに入れても、分けてもOK</span>';
      return;
    }

    const first = options[0];
    const second = options[1];

    if (ranks[current.id] === 1) {
      const gap = second
        ? Math.max(0, current.total - second.total)
        : 0;

      els.race.innerHTML =
        '<strong>🔥 現在1位！</strong>' +
        '<span>2位と ' + fmt(gap) + ' ASOBooN差</span>';
      return;
    }

    const diff =
      Math.max(1, first.total - current.total + 1);

    els.race.innerHTML =
      '<strong>みんなであと ' +
      fmt(diff) +
      ' ASOBooNで1位！</strong>' +
      '<span>現在 ' +
      (ranks[current.id] || '-') +
      '位</span>';
  }

  function renderVote(full = true) {
    if (!state.event) return;

    const max =
      Number(state.event.max_points || CFG.MAX_POINTS || 100);

    els.eventTime.textContent =
      String(state.event.event_time || '') +
      ' 開催イベントをみんなで決めよう！';

    els.remaining.textContent = state.remaining;
    els.walletFill.style.width =
      Math.max(0, Math.min(100, (state.remaining / max) * 100)) +
      '%';

    els.comboValue.textContent = state.combo;
    els.combo.classList.toggle('is-fever', state.combo >= 50);
    updatePowerStage();

    const current = optionsFromEvent().find(
      option => option.id === state.selected
    );

    if (current) {
      els.activeName.textContent =
        current.name + 'を応援中！';
      els.activeMine.textContent =
        'あなたは ' +
        fmt(state.alloc[current.id] || 0) +
        ' ASOBooN 投票';
    } else if (state.remaining <= 0) {
      els.activeName.textContent =
        '100 ASOBooN 投票完了！';
      els.activeMine.textContent =
        '投票ありがとうございました';
    } else {
      els.activeName.textContent =
        '下からイベントを選んでね！';
      els.activeMine.textContent =
        '候補を選ぶとPUSHできます';
    }

    els.pushBtn.disabled =
      state.expired ||
      state.remaining <= 0 ||
      !state.selected;

    if (state.remaining <= 0) {
      setSync('100 ASOBooNをすべて投票しました');
    }

    if (full) renderCandidates();
    else updateCandidateStats();
  }

  function selectCandidate(id) {
    if (state.expired || state.remaining <= 0) return;
    if (!optionsFromEvent().some(option => option.id === id)) return;

    if (state.selected !== id) {
      state.selected = id;
      state.combo = 0;
      vibrate(12);
      renderVote(false);
    }
  }

  function localRemainingMs() {
    const end = Date.parse(state.event?.vote_end || '');
    if (!Number.isFinite(end)) return Infinity;
    return end - serverNowMs();
  }

  function updateCountdown() {
    if (state.mode !== 'vote' || !state.event) return;

    const remainingMs = localRemainingMs();

    if (!Number.isFinite(remainingMs)) {
      els.countdown.textContent = '--:--';
      return;
    }

    if (remainingMs <= 0) {
      els.countdown.textContent = '終了';
      els.timebar.classList.add('urgent');

      if (!state.expired) {
        state.expired = true;
        els.pushBtn.disabled = true;
        setSync('投票締切です。最後の保存を確認しています…');
        syncNow(true)
          .catch(() => {})
          .finally(() => {
            setTimeout(() => refreshStatus(true), 280);
          });
      }
      return;
    }

    const totalSec = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    els.timebar.classList.toggle(
      'urgent',
      remainingMs <= 10 * 60 * 1000
    );

    if (remainingMs < 60 * 1000) {
      els.countdown.textContent =
        String(seconds).padStart(2, '0') + '秒';
    } else if (hours > 0) {
      els.countdown.textContent =
        String(hours).padStart(2, '0') + ':' +
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0');
    } else {
      els.countdown.textContent =
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0');
    }
  }

  function renderFastAfterTap(id) {
    const max =
      Number(state.event?.max_points || CFG.MAX_POINTS || 100);

    els.remaining.textContent = state.remaining;
    els.walletFill.style.width =
      Math.max(0, Math.min(100, (state.remaining / max) * 100)) +
      '%';

    els.comboValue.textContent = state.combo;
    els.combo.classList.toggle('is-fever', state.combo >= 50);

    const current = optionsFromEvent().find(
      option => option.id === id
    );

    if (current) {
      els.activeMine.textContent =
        'あなたは ' +
        fmt(state.alloc[id] || 0) +
        ' ASOBooN 投票';
    }

    updateCandidateStats();
  }

  function castVote() {
    if (
      state.mode !== 'vote' ||
      state.expired ||
      !state.selected ||
      state.remaining <= 0 ||
      els.pushBtn.disabled
    ) {
      return;
    }

    const id = state.selected;

    state.alloc[id] =
      Number(state.alloc[id] || 0) + 1;

    state.used += 1;
    state.remaining -= 1;
    state.combo += 1;
    state.pendingTaps += 1;
    state.dirty = true;

    state.localTotals[id] =
      Number(state.localTotals[id] || 0) + 1;

    savePending();
    pulsePush();
    spawnPlus();
    renderFastAfterTap(id);
    milestoneAfterTap();
    scheduleSync();

    if (state.remaining <= 0) {
      els.pushBtn.disabled = true;
      setSync('100 ASOBooNを保存しています…');

      syncNow(true)
        .then(() => {
          if (
            !state.dirty &&
            state.used >= Number(CFG.MAX_POINTS || 100)
          ) {
            showCompletion();
          }
        })
        .catch(error => {
          setSync(
            error?.code === 'BUSY_RETRY'
              ? '投票が集中しています。自動で保存を続けます…'
              : '通信が不安定です。投票内容は端末に保持しています',
            error?.code !== 'BUSY_RETRY'
          );
        });
    }
  }

  function scheduleSync() {
    clearTimeout(state.syncTimer);

    const nearDeadline =
      localRemainingMs() <= Number(CFG.FINAL_SYNC_GRACE_MS || 20000);

    if (
      nearDeadline ||
      state.pendingTaps >= state.nextSyncTapTarget
    ) {
      syncNow(false).catch(() => {});
      return;
    }

    state.syncTimer = setTimeout(() => {
      syncNow(false).catch(() => {});
    }, syncIdleDelay());
  }

  async function syncNow(finalAttempt = false) {
    if (DEMO) {
      saveDemoAlloc(state.alloc);
      state.serverAlloc = copyAlloc(state.alloc);
      state.serverTotals = { ...state.localTotals };
      state.dirty = false;
      state.pendingTaps = 0;
      state.nextSyncTapTarget = nextBatchTarget();
      setSync('投票を保存しました');
      return;
    }

    if (
      !state.dirty ||
      state.syncing ||
      !state.event ||
      !state.voterKey
    ) {
      return;
    }

    state.syncing = true;
    clearTimeout(state.syncTimer);
    setSync('投票を保存中…');

    const snapshot = copyAlloc(state.alloc);

    try {
      const data = await jsonp({
        action: 'vote',
        eventId: state.event.id,
        voterKey: state.voterKey,
        targets: encodeTargets(snapshot),
        requestId: requestId()
      });

      updateServerClock(data);

      if (!data?.ok) {
        if (data?.busy || data?.errorCode === 'BUSY_RETRY') {
          const busy = new Error(data?.error || '投票が混み合っています。');
          busy.code = 'BUSY_RETRY';
          busy.retryAfterMs = Number(data?.retryAfterMs || retryDelay());
          throw busy;
        }

        if (
          data?.mode &&
          data.mode !== 'voting' &&
          data.mode !== 'settling'
        ) {
          await refreshStatus(true);
          return;
        }
        throw new Error(data?.error || '投票の保存に失敗しました。');
      }

      const serverAlloc =
        copyAlloc(data.user?.allocations || snapshot);

      const currentDesired = copyAlloc(state.alloc);
      const mergedDesired = { ...currentDesired };

      Object.entries(serverAlloc).forEach(([id, value]) => {
        mergedDesired[id] = Math.max(
          Number(mergedDesired[id] || 0),
          Number(value || 0)
        );
      });

      if (
        sumAlloc(mergedDesired) >
        Number(CFG.MAX_POINTS || 100)
      ) {
        state.alloc = serverAlloc;
      } else {
        state.alloc = mergedDesired;
      }

      state.serverAlloc = serverAlloc;

      if (Array.isArray(data.options) && data.options.length) {
        state.serverTotals = {};
        data.options.forEach(option => {
          state.serverTotals[option.id] =
            Number(option.total || 0);
        });
      }

      state.used = Math.min(
        Number(CFG.MAX_POINTS || 100),
        sumAlloc(state.alloc)
      );

      state.remaining = Math.max(
        0,
        Number(CFG.MAX_POINTS || 100) - state.used
      );

      state.dirty =
        !sameAlloc(state.alloc, state.serverAlloc);

      state.pendingTaps = state.dirty
        ? Object.keys(state.alloc).reduce(
            (sum, id) =>
              sum +
              Math.max(
                0,
                Number(state.alloc[id] || 0) -
                Number(state.serverAlloc[id] || 0)
              ),
            0
          )
        : 0;

      if (!state.dirty) {
        state.nextSyncTapTarget = nextBatchTarget();
      }

      recalcLocalTotals();
      savePending();
      renderVote(false);

      setSync(
        state.dirty
          ? '追加の投票を続けて保存します'
          : '投票を保存しました'
      );

      if (state.dirty) {
        setTimeout(() => {
          syncNow(false).catch(() => {});
        }, 70);
      }

      if (data.mode && data.mode !== 'voting') {
        setTimeout(() => refreshStatus(true), 220);
      }
    } catch (error) {
      state.dirty = true;
      savePending();

      const message =
        String(error?.message || error);

      if (error?.code === 'BUSY_RETRY') {
        setSync('投票が集中しています。自動で保存を続けます…');
      } else if (/締切|終了|受付/.test(message)) {
        state.expired = true;
        setSync('投票は締め切られました', true);
        setTimeout(() => refreshStatus(true), 250);
      } else {
        setSync(
          '通信が不安定です。投票内容は端末に保持しています',
          true
        );

        if (!finalAttempt) {
          setTimeout(() => {
            if (state.dirty) {
              syncNow(false).catch(() => {});
            }
          }, retryDelay());
        }
      }

      throw error;
    } finally {
      state.syncing = false;

      const normalRetry =
        state.dirty && !state.expired && !finalAttempt;

      const finalRetry =
        state.dirty &&
        finalAttempt &&
        finalSyncRemainingMs() > 0;

      if (normalRetry || finalRetry) {
        clearTimeout(state.syncTimer);
        state.syncTimer = setTimeout(() => {
          syncNow(finalRetry).catch(() => {});
        }, retryDelay());
      }
    }
  }

  function applyVotingStatus(data, initial = false) {
    const previousMode = state.mode;
    const keepStandings =
      state.standingsOpen ||
      previousMode === 'standings';

    state.event = data.event;
    state.expired = false;
    state.rankVisible =
      data.rank_visible === true ||
      Number(data.user?.used || 0) >= Number(CFG.MAX_POINTS || 100);

    const serverAlloc =
      copyAlloc(data.user?.allocations || {});

    state.serverAlloc = serverAlloc;

    const pending = initial ? loadPending() : {};
    if (initial && Object.keys(pending).length) {
      state.alloc = mergePending(serverAlloc, pending);
    } else if (!state.dirty) {
      state.alloc = serverAlloc;
    } else {
      const desired = copyAlloc(state.alloc);
      Object.entries(serverAlloc).forEach(([id, value]) => {
        desired[id] = Math.max(
          Number(desired[id] || 0),
          Number(value || 0)
        );
      });

      state.alloc =
        sumAlloc(desired) <= Number(CFG.MAX_POINTS || 100)
          ? desired
          : serverAlloc;
    }

    state.serverTotals = {};
    (data.event?.options || []).forEach(option => {
      state.serverTotals[option.id] =
        Number(option.total || 0);
    });

    state.used = Math.min(
      Number(CFG.MAX_POINTS || 100),
      sumAlloc(state.alloc)
    );

    state.remaining = Math.max(
      0,
      Number(CFG.MAX_POINTS || 100) - state.used
    );

    state.dirty =
      !sameAlloc(state.alloc, state.serverAlloc);

    state.pendingTaps = state.dirty
      ? Math.max(0, state.used - sumAlloc(state.serverAlloc))
      : 0;

    recalcLocalTotals();
    chooseInitialCandidate();

    const fullyCompleted =
      state.used >= Number(CFG.MAX_POINTS || 100);

    state.completionShown = fullyCompleted;

    const openCompletedOnLoad =
      initial &&
      previousMode === 'loading' &&
      fullyCompleted &&
      state.rankVisible &&
      !state.dirty;

    if (
      fullyCompleted &&
      state.rankVisible &&
      !state.dirty &&
      (keepStandings || openCompletedOnLoad)
    ) {
      state.standingsOpen = true;
      show('standings');
      renderStandings();
      updateStandingsCountdown();
    } else {
      show('vote');
      renderVote(true);
      updateCountdown();
    }

    if (state.dirty) {
      savePending();
      setTimeout(() => {
        syncNow(data.mode === 'settling').catch(() => {});
      }, 120);
    } else {
      savePending();
    }
  }

  function formatStandingsClock(ms) {
    if (!Number.isFinite(ms)) return '--:--';
    if (ms <= 0) return '終了';

    const totalSec = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    return hours > 0
      ? String(hours).padStart(2, '0') + ':' +
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0')
      : String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0');
  }

  function updateStandingsCountdown() {
    if (!els.standingsCountdown || state.mode !== 'standings') return;

    const remainingMs = localRemainingMs();
    els.standingsCountdown.textContent =
      formatStandingsClock(remainingMs);

    els.standingsCountdown.classList.toggle(
      'urgent',
      Number.isFinite(remainingMs) &&
      remainingMs > 0 &&
      remainingMs <= 10 * 60 * 1000
    );
  }

  function standingsUpdatedText() {
    try {
      return (
        new Date(serverNowMs()).toLocaleTimeString(
          'ja-JP',
          {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Tokyo'
          }
        ) +
        ' 更新'
      );
    } catch (_) {
      return '最新状況を取得しました';
    }
  }

  function renderStandings() {
    if (
      !state.event ||
      !state.rankVisible ||
      state.used < Number(CFG.MAX_POINTS || 100)
    ) {
      return false;
    }

    const ranks = rankMap();
    const options = optionsFromEvent()
      .map(option => ({
        ...option,
        total: Number(state.serverTotals[option.id] || 0),
        mine: Number(state.alloc[option.id] || 0),
        rank: ranks[option.id] || '-'
      }))
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return String(a.name).localeCompare(String(b.name), 'ja');
      });

    const leaderTotal = Math.max(
      1,
      ...options.map(option => option.total)
    );

    els.standingsList.textContent = '';

    options.forEach(option => {
      const row = document.createElement('article');
      row.className =
        'standings-row' +
        (Number(option.rank) === 1 ? ' is-leader' : '') +
        (option.mine > 0 ? ' has-mine' : '');

      const head = document.createElement('div');
      head.className = 'standings-row-head';

      const rank = document.createElement('span');
      rank.className = 'standings-rank';
      rank.textContent = option.rank + '位';

      const name = document.createElement('strong');
      name.className = 'standings-name';
      name.textContent = option.name;

      const points = document.createElement('span');
      points.className = 'standings-points';
      points.textContent =
        fmt(option.total) + ' ASOBooN';

      head.append(rank, name, points);

      const track = document.createElement('div');
      track.className = 'standings-track';

      const fill = document.createElement('div');
      fill.className = 'standings-fill';
      fill.style.width =
        Math.max(
          option.total > 0 ? 5 : 0,
          Math.min(100, (option.total / leaderTotal) * 100)
        ) + '%';

      track.appendChild(fill);

      const mine = document.createElement('div');
      mine.className = 'standings-mine';
      mine.textContent =
        option.mine > 0
          ? 'あなた：' + fmt(option.mine) + ' ASOBooN'
          : 'あなたの投票：0';

      row.append(head, track, mine);
      els.standingsList.appendChild(row);
    });

    els.standingsUpdated.textContent =
      standingsUpdatedText();

    updateStandingsCountdown();
    return true;
  }

  function renderResult(data) {
    const event = data.event || {};
    const options = [...(event.options || [])]
      .sort((a, b) => Number(b.total || 0) - Number(a.total || 0));

    els.resultEventTime.textContent =
      String(event.event_time || '') + ' 開催イベント';

    if (data.winner) {
      els.winnerName.textContent = data.winner.name;
      els.winnerPoints.textContent =
        fmt(data.winner.total) + ' ASOBooN';
    } else {
      els.winnerName.textContent = '結果を確認中';
      els.winnerPoints.textContent =
        'スタッフが確認しています';
    }

    els.resultList.textContent = '';

    options.forEach((option, index) => {
      const row = document.createElement('div');
      row.className = 'result-row';

      const rank = document.createElement('span');
      rank.className = 'r';
      rank.textContent = (index + 1) + '位';

      const name = document.createElement('span');
      name.className = 'n';
      name.textContent = option.name;

      const points = document.createElement('span');
      points.className = 'p';
      points.textContent =
        fmt(option.total) + ' ASOBooN';

      row.append(rank, name, points);
      els.resultList.appendChild(row);
    });

    show('result');
  }

  function formatUpcomingDate_(dateValue) {
    const match = String(dateValue || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';

    const d = new Date(Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    ));

    const weekday = ['日','月','火','水','木','金','土'][d.getUTCDay()];

    return (
      Number(match[2]) +
      '/' +
      Number(match[3]) +
      '（' +
      weekday +
      '）'
    );
  }

  function updateUpcomingState() {
    if (state.mode !== 'idle' || !state.event?.vote_start) return;

    const start = Date.parse(state.event.vote_start);
    if (!Number.isFinite(start)) return;

    const remainingMs = start - serverNowMs();

    if (remainingMs <= 0) {
      if (!state.upcomingRefreshStarted) {
        state.upcomingRefreshStarted = true;
        setTimeout(() => {
          refreshStatus(true).finally(() => {
            state.upcomingRefreshStarted = false;
          });
        }, 250);
      }
      return;
    }

    const totalSec = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const clock =
      (hours > 0 ? String(hours).padStart(2, '0') + ':' : '') +
      String(minutes).padStart(2, '0') + ':' +
      String(seconds).padStart(2, '0');

    const prefix =
      String(els.idleText.dataset.upcomingPrefix || '');

    els.idleText.textContent =
      prefix +
      '投票は ' +
      new Date(start).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo'
      }) +
      ' から！\n' +
      '開始まで ' +
      clock +
      '\n\n' +
      '100 ASOBooNを、やってみたいイベントに自由に投票！\n' +
      '好きな1つに全部入れても、いくつかに分けてもOK。\n' +
      'みんなの投票でサプライズイベントが決まります。';
  }

  function applyStatus(data, initial = false) {
    updateServerClock(data);

    if (!data?.ok) {
      throw new Error(data?.error || 'イベント情報を取得できませんでした。');
    }

    if (data.mode === 'voting' && data.event) {
      applyVotingStatus(data, initial);
      return;
    }

    if (data.mode === 'settling' && data.event) {
      applyVotingStatus(data, initial);
      state.expired = true;
      els.pushBtn.disabled = true;
      els.countdown.textContent = '集計中';
      els.timebar.classList.add('urgent');
      setSync(
        state.dirty
          ? '最後の投票を保存しています…'
          : 'みんなの投票を集計しています…'
      );
      return;
    }

    state.event = data.event || null;
    state.expired = true;
    state.selected = '';
    state.rankVisible = false;
    state.standingsOpen = false;

    if (data.mode === 'result' && data.event) {
      state.standingsOpen = false;
      renderResult(data);
      return;
    }

    if (data.mode === 'upcoming' && data.event) {
      const dateText = formatUpcomingDate_(data.event.date);
      els.idleTitle.textContent =
        '次回のサプライズ投票';

      els.idleText.dataset.upcomingPrefix =
        (dateText ? dateText + ' ' : '') +
        String(data.event.event_time || '') +
        ' 開催\n';

      show('idle');
      updateUpcomingState();
      return;
    }

    if (data.mode === 'configuration_error') {
      els.idleTitle.textContent = 'イベント情報を準備しています';
      els.idleText.dataset.upcomingPrefix = '';
      els.idleText.textContent =
        'ただいまスタッフが確認中です。少し時間をおいて、もう一度ご確認ください。';
      show('idle');
      return;
    }

    els.idleTitle.textContent = 'サプライズ投票';
    els.idleText.dataset.upcomingPrefix = '';
    els.idleText.textContent =
      '現在、受付中の投票はありません。\n\n' +
      '100 ASOBooNを、やってみたいイベントに自由に投票！\n' +
      '好きな1つに全部入れても、いくつかに分けてもOK。\n' +
      'みんなの投票でサプライズイベントが決まります。\n\n' +
      '次回の開催をお楽しみに！';
    show('idle');
  }

  async function refreshStatus(force = false) {
    if (DEMO) {
      const demo = makeDemoStatus();
      applyStatus(demo, state.mode === 'loading' || force);
      return;
    }

    try {
      const params = { action: 'status' };
      if (state.voterKey) params.voterKey = state.voterKey;

      let data = await jsonp(params);
      updateServerClock(data);

      if (
        (data?.mode === 'voting' || data?.mode === 'settling') &&
        !state.voterKey
      ) {
        state.voterKey = await getVoterKey();
        data = await jsonp({
          action: 'status',
          voterKey: state.voterKey
        });
      }

      const initial =
        force ||
        state.mode === 'loading' ||
        state.event?.id !== data?.event?.id;

      state.lastStatusAt = Date.now();
      applyStatus(data, initial);
    } catch (error) {
      if (state.mode === 'vote' && !force) {
        setSync(
          '順位の更新に失敗しました。投票は続けられます',
          true
        );
        return;
      }

      if (state.mode === 'standings' && !force) {
        if (els.standingsUpdated) {
          els.standingsUpdated.textContent =
            '更新に失敗しました。表示中の順位は直前の状況です。';
        }
        return;
      }

      showError(error);
    }
  }

  function showError(error) {
    show('error');
    els.errorTitle.textContent = '投票を開けませんでした';
    els.errorText.textContent =
      String(error?.message || error || '通信エラーが発生しました。');
  }

  function showCompletion() {
    if (state.completionShown) return;
    state.completionShown = true;

    els.completionClose.disabled = false;
    els.completionClose.textContent =
      'みんなの現在の結果を見る';

    els.completionText.textContent =
      'あなたの100 ASOBooN';

    if (els.completionSummary) {
      els.completionSummary.textContent = '';

      optionsFromEvent()
        .map(option => ({
          name: option.name,
          mine: Number(state.alloc[option.id] || 0)
        }))
        .filter(item => item.mine > 0)
        .sort((a, b) => b.mine - a.mine)
        .forEach(item => {
          const row = document.createElement('div');
          row.className = 'completion-summary-row';

          const name = document.createElement('span');
          name.textContent = item.name;

          const value = document.createElement('strong');
          value.textContent = fmt(item.mine);

          row.append(name, value);
          els.completionSummary.appendChild(row);
        });
    }

    if (!reduced) burst();

    els.completion.classList.add('show');
    els.completion.setAttribute('aria-hidden', 'false');
    vibrate([30, 35, 60, 40, 110]);
  }

  async function hideCompletion() {
    const max = Number(CFG.MAX_POINTS || 100);

    els.completionClose.disabled = true;
    els.completionClose.textContent = '最新状況を取得中…';
    state.standingsOpen = true;

    await refreshStatus(true);

    if (
      state.rankVisible &&
      state.used >= max &&
      !state.dirty &&
      state.mode === 'standings'
    ) {
      els.completion.classList.remove('show');
      els.completion.setAttribute('aria-hidden', 'true');
      els.completionClose.disabled = false;
      els.completionClose.textContent = 'みんなの現在の結果を見る';

      window.scrollTo({
        top: 0,
        behavior: reduced ? 'auto' : 'smooth'
      });
      return;
    }

    state.standingsOpen = false;
    els.completionClose.disabled = false;
    els.completionClose.textContent = 'もう一度確認する';
    els.completionText.textContent =
      '投票は保存されています。現在の結果をもう一度確認してください。';
  }

  function burst() {
    els.burst.textContent = '';

    const colors = [
      '#f0c54f',
      '#e75431',
      '#1d6953',
      '#fff4c9',
      '#4da3d9'
    ];

    for (let i = 0; i < 42; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti';
      piece.style.setProperty(
        '--x',
        Math.round((Math.random() - 0.5) * 520) + 'px'
      );
      piece.style.setProperty(
        '--y',
        Math.round((Math.random() - 0.25) * 620) + 'px'
      );
      piece.style.setProperty(
        '--r',
        Math.round(Math.random() * 720 - 360) + 'deg'
      );
      piece.style.setProperty(
        '--c',
        colors[i % colors.length]
      );
      els.burst.appendChild(piece);
      requestAnimationFrame(() => piece.classList.add('go'));
    }

    setTimeout(() => {
      els.burst.textContent = '';
    }, 1100);
  }

  function scheduleNextPoll() {
    clearTimeout(state.pollTimer);
    state.pollTimer = setTimeout(async () => {
      try {
        if (!document.hidden && !enforceDailyReset()) {
          await refreshStatus(false);
        }
      } finally {
        scheduleNextPoll();
      }
    }, pollDelay());
  }

  function startTimers() {
    clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(() => {
      updateCountdown();
      updateStandingsCountdown();
      updateUpcomingState();
    }, 250);

    scheduleNextPoll();

    clearInterval(state.dailyResetTimer);
    state.dailyResetTimer = setInterval(() => {
      enforceDailyReset();
    }, 1000);
  }

  function bindEvents() {
    els.retry.addEventListener('click', () => {
      show('loading');
      refreshStatus(true);
    });

    if (DEMO && els.demoReset) {
      els.demoReset.hidden = false;
      els.demoReset.addEventListener('click', () => {
        try {
          localStorage.removeItem(DEMO_STORAGE_KEY);
        } catch (_) {}

        state.alloc = {};
        state.serverAlloc = {};
        state.serverTotals = {};
        state.localTotals = {};
        state.used = 0;
        state.remaining = Number(CFG.MAX_POINTS || 100);
        state.combo = 0;
        state.pendingTaps = 0;
        state.dirty = false;
        state.selected = '';
        state.expired = false;
        state.completionShown = false;
        state.rankVisible = false;
        state.standingsOpen = false;

        els.completion.classList.remove('show');
        els.completion.setAttribute('aria-hidden', 'true');

        show('loading');
        refreshStatus(true);
      });
    }

    els.completionClose.addEventListener('click', hideCompletion);

    if (els.standingsRefresh) {
      els.standingsRefresh.addEventListener('click', async () => {
        if (
          state.used < Number(CFG.MAX_POINTS || 100) ||
          !state.rankVisible
        ) {
          return;
        }

        els.standingsRefresh.disabled = true;
        els.standingsRefresh.textContent = '更新中…';

        try {
          state.standingsOpen = true;
          await refreshStatus(false);
        } finally {
          els.standingsRefresh.disabled = false;
          els.standingsRefresh.textContent = '最新に更新';
        }
      });
    }

    els.pushBtn.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button === 0) {
        event.preventDefault();
        castVote();
      }
    });

    els.pushBtn.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        castVote();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        if (
          !enforceDailyReset() &&
          Date.now() - state.lastStatusAt >
            Number(CFG.RESUME_REFRESH_STALE_MS || 10000)
        ) {
          refreshStatus(false).catch(() => {});
        }
        scheduleNextPoll();
      } else {
        clearTimeout(state.pollTimer);
        savePending();
      }
    });

    window.addEventListener('pageshow', () => {
      if (
        !enforceDailyReset() &&
        Date.now() - state.lastStatusAt >
          Number(CFG.RESUME_REFRESH_STALE_MS || 10000)
      ) {
        refreshStatus(false).catch(() => {});
      }
    });

    window.addEventListener('online', () => {
      if (!enforceDailyReset()) {
        refreshStatus(false).catch(() => {});
      }
    });

    window.addEventListener('pagehide', savePending);
  }

  function loadDemoAlloc() {
    if (!DEMO) return {};
    try {
      const raw = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || '{}');
      const alloc = copyAlloc(raw?.allocations || raw || {});
      return sumAlloc(alloc) <= Number(CFG.MAX_POINTS || 100)
        ? alloc
        : {};
    } catch (_) {
      return {};
    }
  }

  function saveDemoAlloc(alloc) {
    if (!DEMO) return;
    try {
      localStorage.setItem(
        DEMO_STORAGE_KEY,
        JSON.stringify({
          allocations: copyAlloc(alloc),
          savedAt: Date.now()
        })
      );
    } catch (_) {}
  }

  function makeDemoStatus() {
    const now = new Date();
    const end = new Date(now.getTime() + 42 * 60 * 1000);
    const allocations = loadDemoAlloc();
    const used = Math.min(
      Number(CFG.MAX_POINTS || 100),
      sumAlloc(allocations)
    );

    const options = [
      { id: 'c1', name: 'パラバルーン（グリーン）' },
      { id: 'c2', name: 'パラバルーン（ボールプール）' },
      { id: 'c3', name: '宝探し' },
      { id: 'c4', name: 'だるまさんが隠れた' },
      { id: 'c5', name: 'ふわふわベッド' },
      { id: 'c6', name: '跳び箱' },
      { id: 'c7', name: '赤ちゃんイベント' },
      { id: 'c8', name: '鬼ごっこ' }
    ].map(option => ({
      ...option,
      total: Number(allocations[option.id] || 0)
    }));

    return {
      ok: true,
      now: now.toISOString(),
      mode: 'voting',
      event: {
        id: 'demo-1100',
        event_time: '11:00',
        vote_end: end.toISOString(),
        settle_end: new Date(
          end.getTime() + Number(CFG.FINAL_SYNC_GRACE_MS || 20000)
        ).toISOString(),
        max_points: 100,
        options
      },
      rank_visible: used >= Number(CFG.MAX_POINTS || 100),
      user: {
        used,
        remaining:
          Math.max(0, Number(CFG.MAX_POINTS || 100) - used),
        allocations
      }
    };
  }

  function makeDemoVoteResponse(params) {
    const targets = {};
    String(params.targets || '')
      .split(',')
      .filter(Boolean)
      .forEach(part => {
        const [id, raw] = part.split(':');
        targets[decodeURIComponent(id)] =
          Math.max(0, Number(raw) || 0);
      });

    saveDemoAlloc(targets);
    const base = makeDemoStatus();

    return {
      ...base,
      options: base.event.options
    };
  }

  async function init() {
    setHomeLinks();
    createFxPool();
    state.nextSyncTapTarget = nextBatchTarget();
    bindEvents();
    startTimers();
    show('loading');

    try {
      if (!DEMO && !CFG.API_URL) {
        throw new Error(
          '投票APIが未設定です。surprise-vote-config.js に専用GASのURLを設定してください。'
        );
      }

      if (enforceDailyReset()) return;

      if (!DEMO) {
        await sleep(
          randomInt(0, Number(CFG.INITIAL_JITTER_MAX_MS || 3000))
        );
      }

      await refreshStatus(true);
    } catch (error) {
      showError(error);
    }
  }

  init();
})();
