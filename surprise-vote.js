
(() => {
  'use strict';

  const DEFAULTS = {
    API_URL: '',
    LIFF_ID: '2009888671-57TOefc3',
    HOME_URL: './home.html?mode=inside',
    POLL_INTERVAL_MS: 8000,
    SYNC_IDLE_MS: 650,
    SYNC_TAP_BATCH: 8,
    REQUEST_TIMEOUT_MS: 12000,
    MAX_POINTS: 100
  };

  const CFG = Object.freeze({
    ...DEFAULTS,
    ...(window.ASOBOON_SURPRISE_VOTE_CONFIG || {})
  });

  const DEMO =
    new URLSearchParams(location.search).get('demo') === '1';
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
    syncTimer: null,
    pollTimer: null,
    countdownTimer: null,
    serverOffsetMs: 0,
    expired: false,
    completionShown: false,
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

  function show(name) {
    ['loading', 'idle', 'error', 'vote', 'result'].forEach(key => {
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

  function milestoneAfterTap() {
    if ([10, 30, 50, 75].includes(state.combo)) {
      const text =
        state.combo === 50
          ? '🔥 50 COMBO FEVER!'
          : state.combo + ' COMBO!';
      showMilestone(text);
      vibrate(state.combo >= 50 ? [18, 18, 32] : [13, 15, 18]);
    }

    if (state.used === 90) {
      showMilestone('あと10 ASOBooN！');
      vibrate([18, 18, 30]);
    } else if (state.used === 95) {
      showMilestone('あと5！');
      vibrate([18, 18, 35]);
    } else if (state.used === 99) {
      showMilestone('あと1！');
      vibrate([22, 20, 42]);
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
    rank.textContent = (ranks[option.id] || '-') + '位';

    const mine = document.createElement('span');
    mine.className = 'candidate-mine';
    mine.textContent =
      'あなた：' +
      fmt(state.alloc[option.id] || 0) +
      ' ASOBooN';

    const total = document.createElement('span');
    total.className = 'candidate-total';
    total.textContent =
      'みんな：' +
      fmt(state.localTotals[option.id] || 0) +
      ' ASOBooN';

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

      refs.rank.textContent =
        (ranks[option.id] || '-') + '位';

      refs.mine.textContent =
        'あなた：' +
        fmt(state.alloc[option.id] || 0) +
        ' ASOBooN';

      refs.total.textContent =
        'みんな：' +
        fmt(state.localTotals[option.id] || 0) +
        ' ASOBooN';
    });

    renderRace(ranks);
  }

  function renderRace(ranks = rankMap()) {
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
          if (state.used >= Number(CFG.MAX_POINTS || 100)) {
            showCompletion();
          }
        })
        .catch(() => {
          setSync(
            '通信が不安定です。投票内容は端末に保持しています',
            true
          );
        });
    }
  }

  function scheduleSync() {
    clearTimeout(state.syncTimer);

    const nearDeadline = localRemainingMs() <= 15000;

    if (
      nearDeadline ||
      state.pendingTaps >= Number(CFG.SYNC_TAP_BATCH || 8)
    ) {
      syncNow(false).catch(() => {});
      return;
    }

    state.syncTimer = setTimeout(() => {
      syncNow(false).catch(() => {});
    }, Number(CFG.SYNC_IDLE_MS || 650));
  }

  async function syncNow(finalAttempt = false) {
    if (DEMO) {
      saveDemoAlloc(state.alloc);
      state.serverAlloc = copyAlloc(state.alloc);
      state.serverTotals = { ...state.localTotals };
      state.dirty = false;
      state.pendingTaps = 0;
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
        if (data?.mode && data.mode !== 'voting') {
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
      state.serverTotals = {};

      (data.options || []).forEach(option => {
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

      if (/締切|終了|受付/.test(message)) {
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
          }, 1500);
        }
      }

      throw error;
    } finally {
      state.syncing = false;

      if (state.dirty && !state.expired && !finalAttempt) {
        clearTimeout(state.syncTimer);
        state.syncTimer = setTimeout(() => {
          syncNow(false).catch(() => {});
        }, 850);
      }
    }
  }

  function applyVotingStatus(data, initial = false) {
    state.event = data.event;
    state.expired = false;

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

    state.completionShown =
      state.used >= Number(CFG.MAX_POINTS || 100);

    show('vote');
    renderVote(true);
    updateCountdown();

    if (state.dirty) {
      savePending();
      setTimeout(() => {
        syncNow(false).catch(() => {});
      }, 120);
    } else {
      savePending();
    }
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

  function applyStatus(data, initial = false) {
    updateServerClock(data);

    if (!data?.ok) {
      throw new Error(data?.error || 'イベント情報を取得できませんでした。');
    }

    if (data.mode === 'voting' && data.event) {
      applyVotingStatus(data, initial);
      return;
    }

    state.event = data.event || null;
    state.expired = true;
    state.selected = '';

    if (data.mode === 'result' && data.event) {
      renderResult(data);
      return;
    }

    els.idleTitle.textContent = '現在、投票はありません';
    els.idleText.textContent =
      '開催中の投票がある時間に、館内HOMEからお入りください。';
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
        data?.mode === 'voting' &&
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

      applyStatus(data, initial);
    } catch (error) {
      if (state.mode === 'vote' && !force) {
        setSync(
          '順位の更新に失敗しました。投票は続けられます',
          true
        );
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

    els.completionText.textContent =
      '100 ASOBooNをすべて投票しました！';

    if (!reduced) burst();

    els.completion.classList.add('show');
    els.completion.setAttribute('aria-hidden', 'false');
    vibrate([30, 35, 60, 40, 110]);
  }

  function hideCompletion() {
    els.completion.classList.remove('show');
    els.completion.setAttribute('aria-hidden', 'true');
    renderVote(false);

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: reduced ? 'auto' : 'smooth'
    });
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

  function startTimers() {
    clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(updateCountdown, 250);

    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => {
      if (!document.hidden) {
        refreshStatus(false).catch(() => {});
      }
    }, Math.max(5000, Number(CFG.POLL_INTERVAL_MS || 8000)));
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

        els.completion.classList.remove('show');
        els.completion.setAttribute('aria-hidden', 'true');

        show('loading');
        refreshStatus(true);
      });
    }

    els.completionClose.addEventListener('click', hideCompletion);

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
        refreshStatus(false);
      } else {
        savePending();
      }
    });

    window.addEventListener('pageshow', () => refreshStatus(false));
    window.addEventListener('online', () => refreshStatus(false));
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
        max_points: 100,
        options
      },
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
    bindEvents();
    startTimers();
    show('loading');

    try {
      if (!DEMO && !CFG.API_URL) {
        throw new Error(
          '投票APIが未設定です。surprise-vote-config.js に専用GASのURLを設定してください。'
        );
      }

      await refreshStatus(true);
    } catch (error) {
      showError(error);
    }
  }

  init();
})();
