import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const DL = require('../miniapp-v2/shared/asoquest-deeplink.js');
const read = p => fs.readFileSync(p, 'utf8');

const PROD_ENDPOINT = 'https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/';
const DEV_ENDPOINT = 'https://asoboon.github.io/asoboon-stamp/miniapp-v2/develop/';
const PROD_ASOQUEST = 'https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/asoquest/';
const LIFF_ID = '2009888671-57TOefc3';

/* Verbatim port of LIFF SDK (static.line-scdn.net/liff/edge/2/sdk.js) decodeState(), used by liff.init()
 * to compute the URL it location.replace()s to when `liff.state` is present. */
function sdkDecodeState(endpointUrl, t) {
  const attachSlashAtStart = e => `${e && e.length > 0 && !e.startsWith('/') ? '/' : ''}${e}`;
  const hasTrailingSlash = e => {
    const n = e.indexOf('?'), r = e.indexOf('#');
    const t2 = n === -1 && r === -1 ? e.length : n === -1 ? r : r === -1 ? n : Math.min(n, r);
    return t2 > 0 && e[t2 - 1] === '/';
  };
  t = t.replace(/\n/g, '%0D%0A');
  const r = hasTrailingSlash(endpointUrl) || hasTrailingSlash(t);
  const i = new URL(endpointUrl), o = i.origin, a = i.pathname, s = i.search;
  const c = new URL(`${o}${attachSlashAtStart(t)}`), u = c.pathname, l = c.search, f = c.hash;
  const d = `${s}${s ? l.replace(/\?/g, '&') : l}`;
  let h = `${a}${attachSlashAtStart(u)}`.replace('//', '/');
  h = attachSlashAtStart(`${h}`);
  if (h.endsWith('/') && !r) h = h.substring(0, h.length - 1);
  return `${o}${h}${d}${f}`.replace(/%0D%0A/g, '\n');
}

/* What the LINE first hop hands the endpoint: endpoint + ?liff.state=<suffix of the permanent link> */
const firstHop = (endpoint, suffix) => `${endpoint}?liff.state=${encodeURIComponent(suffix)}`;

const PARTS = ['engine', 'wheel', 'headlight', 'fin', 'grille', 'key'];

test('SDK decodeState: permanent-link path is RELATIVE to the endpoint (spec reading confirmed against SDK code)', () => {
  assert.equal(sdkDecodeState(PROD_ENDPOINT, '/asoquest/?part=engine&src=nfc'), `${PROD_ASOQUEST}?part=engine&src=nfc`);
  assert.equal(sdkDecodeState(PROD_ENDPOINT, '?aq=engine&src=nfc'), `${PROD_ENDPOINT}?aq=engine&src=nfc`);
});

for (const src of ['nfc', 'qr']) {
  for (const part of PARTS) {
    test(`aq=${part}&src=${src}: liff.state first hop -> part/${part}`, () => {
      const url = new URL(firstHop(PROD_ENDPOINT, `?aq=${part}&src=${src}`));
      assert.deepEqual(
        (({ kind, part: p, station, src: s, via }) => ({ kind, part: p, station, src: s, via }))(DL.parse(url.search)),
        { kind: 'part', part, station: '', src, via: 'liff.state' }
      );
    });
    test(`aq=${part}&src=${src}: direct (2nd hop) -> part/${part}`, () => {
      const dl = DL.parse(`?aq=${part}&src=${src}`);
      assert.equal(dl.part, part); assert.equal(dl.src, src); assert.equal(dl.via, 'direct');
    });
    test(`legacy /asoquest/?part=${part}&src=${src} via liff.state -> part/${part}`, () => {
      const url = new URL(firstHop(PROD_ENDPOINT, `/asoquest/?part=${part}&src=${src}`));
      const dl = DL.parse(url.search);
      assert.equal(dl.kind, 'part'); assert.equal(dl.part, part); assert.equal(dl.src, src);
    });
  }
  test(`ENGINE START aq=start&src=${src}`, () => {
    const dl = DL.parse(new URL(firstHop(PROD_ENDPOINT, `?aq=start&src=${src}`)).search);
    assert.equal(dl.kind, 'start'); assert.equal(dl.station, 'engine'); assert.equal(dl.part, ''); assert.equal(dl.src, src);
    const legacy = DL.parse(new URL(firstHop(PROD_ENDPOINT, `/asoquest/?station=engine&src=${src}`)).search);
    assert.equal(legacy.kind, 'start'); assert.equal(legacy.station, 'engine');
  });
}

test('light alias and uppercase are normalised; unknown src is dropped', () => {
  assert.equal(DL.parse('?aq=LIGHT').part, 'headlight');
  assert.equal(DL.parse('?aq=Engine&src=NFC').src, 'nfc');
  assert.equal(DL.parse('?aq=engine&src=evil').src, '');
});

test('doubly-encoded liff.state is tolerated', () => {
  const once = encodeURIComponent('?aq=wheel&src=qr');
  const twice = encodeURIComponent(once);
  assert.equal(DL.parse(`?liff.state=${twice}`).part, 'wheel');
  assert.equal(DL.parse(`?liff.state=${once}`).part, 'wheel');
});

test('liff.state may sit next to other LIFF params (liff.referrer, liffClientId, ...)', () => {
  const s = `?liffClientId=2009888671&liffRedirectUri=${encodeURIComponent('https://x/y')}&liff.state=${encodeURIComponent('?aq=key&src=nfc')}&liff.referrer=`;
  assert.equal(DL.parse(s).part, 'key');
});

test('plain ASOQUEST path without params -> ASOQUEST top; unknown aq -> ASOQUEST top (never HOME)', () => {
  assert.equal(DL.parse(`?liff.state=${encodeURIComponent('/asoquest/')}`).kind, 'top');
  assert.equal(DL.parse('?aq=nonsense').kind, 'top');
});

test('non-ASOQUEST entries are NOT claimed (router regression)', () => {
  for (const s of ['', '?view=home', '?view=reception&mode=before', '?view=callstatus', '?view=timeguide&mode=inside',
    `?liff.state=${encodeURIComponent('?view=reception')}`, `?liff.state=${encodeURIComponent('/surprise-vote.html')}`]) {
    assert.equal(DL.parse(s), null, s || '(empty)');
  }
});

test('legacy direct ?part=... on the endpoint is still honoured (old printed URLs)', () => {
  assert.equal(DL.parse('?part=engine&src=nfc').part, 'engine');
  assert.equal(DL.parse('?station=engine').kind, 'start');
});

test('target resolution: same ASOQUEST for both environments, derived from the shared script URL (no env mixing)', () => {
  const SCRIPT = 'https://asoboon.github.io/asoboon-stamp/miniapp-v2/shared/asoquest-deeplink.js?v=1';
  const viaScript = DL.targetBaseFor(SCRIPT, null, new URL(DEV_ENDPOINT));
  assert.equal(viaScript.href, PROD_ASOQUEST);
  assert.equal(DL.targetBaseFor('', { endpoint: PROD_ENDPOINT }, new URL(PROD_ENDPOINT)).href, PROD_ASOQUEST);
  assert.equal(DL.targetBaseFor('', { endpoint: DEV_ENDPOINT }, new URL(DEV_ENDPOINT)).href, PROD_ASOQUEST);
  assert.equal(DL.buildTarget(DL.parse('?aq=engine&src=nfc'), viaScript).href, `${PROD_ASOQUEST}?part=engine&src=nfc`);
  assert.equal(DL.buildTarget(DL.parse('?aq=start&src=qr'), viaScript).href, `${PROD_ASOQUEST}?station=engine&src=qr`);
  assert.equal(DL.safeTarget(viaScript, new URL(PROD_ENDPOINT)), true);
  assert.equal(DL.safeTarget(viaScript, new URL('https://evil.example/')), false);
});

function fakeWindow(url, env) {
  const loc = new URL(url);
  const calls = [];
  const styles = [];
  const classList = new Set();
  const timers = [];
  const appended = [];
  const w = {
    location: Object.assign(loc, { replace: u => calls.push(u) }),
    ASOBOON_V2_ENV: env,
    document: {
      head: { appendChild: s => styles.push(s) },
      createElement: () => ({ style: {}, append() {}, prepend() {}, addEventListener() {} }),
      documentElement: { appendChild: n => appended.push(n), classList: { add: c => classList.add(c), remove: c => classList.delete(c) } },
      readyState: 'complete', body: { appendChild() {} }, addEventListener() {},
      currentScript: { src: 'https://asoboon.github.io/asoboon-stamp/miniapp-v2/shared/asoquest-deeplink.js?v=2' }
    },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: { userAgent: 'test' }
  };
  return { w, calls, classList, timers, appended };
}

test('boot(): redirects synchronously to ASOQUEST and marks HANDOFF (no liff.init path)', () => {
  const env = { environment: 'production', endpoint: PROD_ENDPOINT };
  const { w, calls, classList } = fakeWindow(firstHop(PROD_ENDPOINT, '?aq=grille&src=nfc'), env);
  DL.boot(w);
  assert.deepEqual(calls, [`${PROD_ASOQUEST}?part=grille&src=nfc`]);
  assert.equal(w.ASOBOON_ASOQUEST_HANDOFF, 'redirect');
  assert.equal(classList.has('aq-go'), true);
});

test('boot(): works with NO env.js loaded (runs first in <head>) and for the develop endpoint', () => {
  for (const ep of [PROD_ENDPOINT, DEV_ENDPOINT]) {
    const { w, calls } = fakeWindow(firstHop(ep, '?aq=fin&src=qr'), undefined);
    DL.boot(w);
    assert.deepEqual(calls, [`${PROD_ASOQUEST}?part=fin&src=qr`], ep);
  }
});

test('boot(): slow navigation never reveals HOME; after 8s a retry/HOME screen is appended instead', () => {
  const { w, calls, classList, timers, appended } = fakeWindow(firstHop(PROD_ENDPOINT, '?aq=key&src=nfc'), undefined);
  DL.boot(w);
  assert.equal(timers.length, 1); assert.equal(timers[0].ms, 8000);
  timers[0].fn();
  assert.equal(classList.has('aq-go'), true, 'aq-go (HOME hidden) must stay on');
  assert.equal(appended.length, 1);
  assert.equal(calls.length, 1);
});

test('debug snapshot masks tokens and never stores the hash', () => {
  const secret = 'SECRET123';
  const st = encodeURIComponent(`?aq=engine&code=${secret}&access_token=${secret}`);
  const w = { location: Object.assign(new URL(`${PROD_ENDPOINT}?liff.state=${st}&code=${secret}&liffClientId=2009888671#access_token=${secret}`), {}), navigator: { userAgent: 'x' } };
  const snap = JSON.stringify(DL.snapshot(w, 'test'));
  assert.ok(!snap.includes(secret), snap);
  assert.match(snap, /"hashLength":\d+/);
  assert.match(snap, /aq=engine/);
});

test('boot(): non-ASOQUEST URLs are untouched', () => {
  const env = { environment: 'production', endpoint: PROD_ENDPOINT };
  for (const u of [PROD_ENDPOINT, `${PROD_ENDPOINT}?view=reception&mode=before`, `${PROD_ENDPOINT}?view=callstatus`, firstHop(PROD_ENDPOINT, '?view=timeguide')]) {
    const { w, calls } = fakeWindow(u, env);
    DL.boot(w);
    assert.deepEqual(calls, [], u); assert.equal(w.ASOBOON_ASOQUEST_HANDOFF, undefined, u);
  }
});

test('boot(): debug mode holds (no redirect, no liff.init) and never runs for normal users', () => {
  const env = { environment: 'production', endpoint: PROD_ENDPOINT };
  const { w, calls } = fakeWindow(firstHop(PROD_ENDPOINT, '?aq=engine&src=nfc&debug=asoquest'), env);
  DL.boot(w);
  assert.deepEqual(calls, []); assert.equal(w.ASOBOON_ASOQUEST_HANDOFF, 'hold');
  const normal = fakeWindow(firstHop(PROD_ENDPOINT, '?aq=engine&src=nfc'), env);
  DL.boot(normal.w); assert.equal(normal.w.ASOBOON_ASOQUEST_HANDOFF, 'redirect');
});

test('boot(): refuses a cross-origin target (script served from another origin)', () => {
  const { w, calls } = fakeWindow(`${PROD_ENDPOINT}?aq=engine`, undefined);
  w.document.currentScript = { src: 'https://evil.example/miniapp-v2/shared/asoquest-deeplink.js' };
  DL.boot(w);
  assert.deepEqual(calls, []);
});

test('static wiring: temp handoffAsoquestAfterLiff removed; script is first in <head> (after charset), before CSS/SDK/env/app', () => {
  for (const env of ['production', 'develop']) {
    const js = read(`miniapp-v2/${env}/app-stable-v36.js`);
    assert.doesNotMatch(js, /handoffAsoquestAfterLiff/);
    assert.match(js, /ASOBOON_ASOQUEST_HANDOFF/);
    const html = read(`miniapp-v2/${env}/index.html`);
    const iCharset = html.search(/<meta charset/i), iDl = html.indexOf('asoquest-deeplink.js');
    const iCss = html.indexOf('<link rel="stylesheet"'), iSdk = html.indexOf('liff/edge/2/sdk.js'), iEnv = html.indexOf('./env.js'), iApp = html.indexOf('app-stable-v36.js');
    assert.ok(iCharset >= 0 && iDl > iCharset, `${env}: after charset`);
    assert.ok(iDl < iCss && iDl < iSdk && iDl < iEnv && iDl < iApp, `${env}: deeplink script order`);
    assert.ok(html.indexOf('</head>') > iDl, `${env}: in <head>`);
    assert.match(html, /app-stable-v36\.js\?v=20261006-03/);
    assert.match(html, /asoquest-deeplink\.js\?v=20261006-02/);
  }
});

test('ASOQUEST save() cannot block the UI when storage fails (try/catch around setItem)', () => {
  const js = read('miniapp-v2/production/asoquest/app.js');
  assert.match(js, /try\{\s*localStorage\.setItem\(storageKey\(\)/);
  assert.match(read('miniapp-v2/production/asoquest/index.html'), /app\.js\?v=16/);
});

test('LIFF ids are not mixed between environments', () => {
  assert.match(read('miniapp-v2/production/env.js'), /liffId:'2009888671-57TOefc3'/);
  assert.match(read('miniapp-v2/develop/env.js'), /liffId:'2009884611-bDgDzGrN'/);
});

test('station_urls.csv (NFC) and station_urls_qr.csv are the 7 aq-form URLs', () => {
  const order = [...PARTS, 'start'];
  for (const [file, src] of [['station_urls.csv', 'nfc'], ['station_urls_qr.csv', 'qr']]) {
    const rows = read(`miniapp-v2/production/asoquest/${file}`).trim().split('\n').slice(1).map(l => l.split(',')[2]);
    assert.deepEqual(rows, order.map(k => `https://miniapp.line.me/${LIFF_ID}/?aq=${k}&src=${src}`));
  }
});
