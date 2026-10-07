// Test harness for the official Production Worker. Runtime is copied to /tmp and armed only there.
// - D1 is emulated with an in-memory SQLite database (node:sqlite), so real SQL runs.
// - AirWAIT / LINE / business-calendar HTTP calls are served by an in-process fake.
// Nothing here talks to the network, and no real data is touched.
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHmac } from 'node:crypto';

export const CHANNEL_ID = '2009884613';
export const ORIGIN = 'https://asoboon.github.io';
export const WORKER_URL = 'https://asoboon-miniapp-v2-production-gateway.asoboon425.workers.dev/';
export const OA_SECRET = 'test-oa-channel-secret';
export const DIAG_TOKEN = 'test-diagnostics-token-0123456789abcdef';

class D1Statement {
  constructor(d1, sql, args = []) { this.d1 = d1; this.sql = sql; this.args = args; }
  bind(...args) { return new D1Statement(this.d1, this.sql, args.map(v => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v))); }
  async run() { return this.runSync(); }
  runSync() {
    const r = this.d1.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(r.changes || 0), last_row_id: Number(r.lastInsertRowid || 0) } };
  }
  async first() { const row = this.d1.db.prepare(this.sql).get(...this.args); return row ? { ...row } : null; }
  async all() { return { success: true, results: this.d1.db.prepare(this.sql).all(...this.args).map(r => ({ ...r })) }; }
}

export class FakeD1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { return new D1Statement(this, sql); }
  async batch(statements) {
    this.db.exec('BEGIN');
    try { const out = statements.map(s => s.runSync()); this.db.exec('COMMIT'); return out; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  async exec(sql) { this.db.exec(sql); return { count: 1 }; }
  rows(sql, ...args) { return this.db.prepare(sql).all(...args).map(r => ({ ...r })); }
  clear() {
    for (const { name } of this.rows("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")) {
      this.db.exec(`DELETE FROM "${name}"`);
    }
  }
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}
function withUrl(response, url) { Object.defineProperty(response, 'url', { value: url }); return response; }

export class FakeWorld {
  constructor() { this.reset(); }
  reset() {
    this.users = new Map();          // liffAccessToken -> LINE userId
    this.tokenCounter = 0;
    this.reservations = [];          // AirWAIT rows
    this.nextNumber = new Map();     // waitTypeId -> next receipt number
    this.nextReserve = 100000000001;
    this.sent = [];                  // LINE service messages actually sent
    this.replies = [];               // LINE OA replies
    this.pushes = [];                // LINE OA pushes
    this.calls = [];                 // every outbound URL
    this.businessType = '土日祝日';
  }
  issueLiffToken(userId) {
    this.tokenCounter += 1;
    const token = `liff-${userId}-${this.tokenCounter}-xxxxxxxxxxxxxxxx`;
    this.users.set(token, userId);
    return token;
  }
  setNextNumber(waitTypeId, n) { this.nextNumber.set(waitTypeId, n); }
  row(reserveId) { return this.reservations.find(r => r.reserveId === reserveId); }
  recipientOf(message) { return String(message.notificationToken || '').split(':')[1] || ''; }

  async fetch(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
    const method = String(init.method || 'GET').toUpperCase();
    this.calls.push(`${method} ${url.origin}${url.pathname}`);
    const form = () => new URLSearchParams(typeof init.body === 'string' ? init.body : init.body?.toString?.() || '');
    const body = () => (typeof init.body === 'string' ? JSON.parse(init.body) : {});

    if (url.href.startsWith('https://api.line.me/oauth2/v2.1/verify')) {
      const userId = this.users.get(url.searchParams.get('access_token'));
      return userId ? json({ client_id: CHANNEL_ID, expires_in: 3600, scope: 'profile openid' }) : json({ error: 'invalid_request' }, 400);
    }
    if (url.href === 'https://api.line.me/v2/profile') {
      const token = String(new Headers(init.headers).get('Authorization') || '').replace(/^Bearer /, '');
      const userId = this.users.get(token);
      return userId ? json({ userId, displayName: 'test' }) : json({ message: 'invalid' }, 401);
    }
    if (url.href === 'https://api.line.me/oauth2/v3/token') return json({ access_token: 'channel-token', expires_in: 900 });
    if (url.href === 'https://api.line.me/message/v3/notifier/token') {
      const userId = this.users.get(body().liffAccessToken);
      if (!userId) return json({ message: 'invalid liff token' }, 400);
      return json({ notificationToken: `nt:${userId}:0`, remainingCount: 5, expiresIn: 3600, sessionId: `s-${userId}` });
    }
    if (url.href.startsWith('https://api.line.me/message/v3/notifier/send')) {
      const b = body();
      this.sent.push(b);
      const [, userId, n] = String(b.notificationToken).split(':');
      return json({ notificationToken: `nt:${userId}:${Number(n) + 1}`, remainingCount: 4, expiresIn: 3600, sessionId: `s-${userId}` });
    }
    if (url.href === 'https://api.line.me/v2/bot/message/reply') { this.replies.push(body()); return json({}); }
    if (url.href === 'https://api.line.me/v2/bot/message/push') { this.pushes.push(body()); return json({}); }

    if (url.hostname === 'script.google.com') {
      const action = url.searchParams.get('action');
      if (action === 'status') {
        return json({ ok:true, mode:'idle', event:null, day_events:[], daily_reset:'18:00' });
      }
      const date = url.searchParams.get('date');
      return json({ ok: true, businessType: this.businessType, operationalDate: date, calendarDate:date, weekday:'土', note:'' });
    }
    if (url.pathname.endsWith('/wait/type/get')) {
      const storeIds = ['0023', '0025', '0029', '0031', '0033', '0035', '0037'];
      const onlineIds = ['0024','0027','0030','0032','0034','0036','0038'];
      const rows = [
        ...storeIds.map(id => ({ waitTypeId:id, waitTypeName:`枠${id}`, dispFlg:true, usageDispType:'KeySTORE_RECEPTION_ONLY' })),
        ...onlineIds.map(id => ({ waitTypeId:id, waitTypeName:`枠${id}`, dispFlg:true, usageDispType:'KeyONLINE_RECEPTION_ONLY' })),
      ];
      return json({ success: true, resultCode: { code: '0000' }, innerDto: { waitTypeList: rows } });
    }
    if (url.pathname.endsWith('/store/getWaitInfo')) {
      const onlineIds = ['0024','0027','0030','0032','0034','0036','0038'];
      return json({ success:true, resultCode:{code:'0000'}, innerDto:{ stores:[{ onlineRcptCode:'OPEN', waitDetails:onlineIds.map((id,i)=>({ detailedWaitType:`枠${id}`, reserveUnit:'PERSON', remainingNum:300-i*20 })) }] } });
    }
    if (url.pathname.endsWith('/store/getLastUpdDateStateless')) {
      return json({ success:true, resultCode:{code:'0000'}, innerDto:{lastUpdDate:'2026-10-03T12:00:00+09:00'} });
    }
    if (url.pathname.endsWith('/reserve/create')) {
      const f = form();
      const waitTypeId = f.get('waitTypeId');
      const n = this.nextNumber.get(waitTypeId) ?? 1;
      this.nextNumber.set(waitTypeId, n + 1);
      const reserveId = String(this.nextReserve++).padStart(12, '0');
      const p = `cap-${reserveId}`;
      this.reservations.push({ number: String(n), waitTypeId, waitTypeName: `枠${waitTypeId}`, status: '0', isCalling: '0', reserveId, p });
      return json({ success: true, resultCode: { code: '0000' }, innerDto: { reserveId, receiptNo: String(n), shortUrl: `https://airwait.jp/s/${reserveId}`, waitTime: 0, waitCount: 0 } });
    }
    if (url.pathname.endsWith('/stateless/reservations')) {
      const f = form();
      const filter = f.get('waitTypeId');
      const rows = this.reservations.filter(r => !filter || r.waitTypeId === filter)
        .map(({ number, waitTypeId, waitTypeName, status, isCalling }) => ({ number, waitTypeId, waitTypeName, status, isCalling }));
      return json({ success: true, resultCode: { code: '0000' }, innerDto: { count: rows.length, reservations: rows } });
    }
    // AirWAIT customer cancel pages (reached only through the stored shortUrl).
    if (url.hostname === 'airwait.jp' && url.pathname.startsWith('/s/')) {
      const r = this.row(url.pathname.slice(3));
      return withUrl(new Response('<html></html>', { status: 200 }), `https://airwait.jp/WCSP/reserve/detail?storeNo=AKR&reserveId=${r.reserveId}&p=${r.p}`);
    }
    if (url.hostname === 'airwait.jp' && url.pathname === '/WCSP/cancel/confirm') {
      return withUrl(new Response('<meta name="_csrf" content="csrf-ok">', { status: 200 }), url.href);
    }
    if (url.hostname === 'airwait.jp' && url.pathname === '/WCSP/cancel/complete') {
      const f = form();
      const r = this.row(f.get('reserveId'));
      if (r && f.get('p') === r.p) r.status = '3';
      return withUrl(new Response('ok', { status: 200 }), url.href);
    }
    throw new Error(`Unexpected outbound fetch in test: ${method} ${url.href}`);
  }
}

export function prepareRuntime({ armed = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'asoboon-production-test-'));
  let gateway = readFileSync(resolve('miniapp-v2/backend/production-gateway.js'), 'utf8');
  const gate = "PRODUCTION_CREATE_ARMED: false";
  if (!gateway.includes(gate)) throw new Error('Production hard gate marker not found');
  if (armed) gateway = gateway.replace(gate, "PRODUCTION_CREATE_ARMED: true");
  writeFileSync(join(dir, 'production-gateway.mjs'), gateway);
  writeFileSync(join(dir, 'production-service-message.mjs'), readFileSync(resolve('miniapp-v2/backend/production-service-message.js'), 'utf8'));
  let worker = readFileSync(resolve('miniapp-v2/backend/production-worker.mjs'), 'utf8');
  worker = worker.replace("./production-gateway.js", "./production-gateway.mjs");
  worker = worker.replace("./production-service-message.js", "./production-service-message.mjs");
  writeFileSync(join(dir, 'production-worker.mjs'), worker);
  return pathToFileURL(join(dir, 'production-worker.mjs')).href;
}

export function baseEnv(db, extra = {}) {
  return {
    DB: db,
    AIRWAIT_API_KEY: 'test-airwait-key',
    CREATE_ENABLED: '1',
    LINE_MINIAPP_CHANNEL_SECRET: 'test-miniapp-secret',
    LINE_OA_CHANNEL_SECRET: OA_SECRET,
    LINE_OA_CHANNEL_ACCESS_TOKEN: 'test-oa-access-token',
    SERVICE_MESSAGE_CONFIRM_TEMPLATE_NAME: 'waiting_req_d_w_ja',
    SERVICE_MESSAGE_CONFIRM_TEMPLATE_PARAMS_JSON: '{"number":"{{receiptNo}}"}',
    SERVICE_MESSAGE_CANCEL_TEMPLATE_NAME: 'user_cancle_s_ja',
    SERVICE_MESSAGE_CANCEL_TEMPLATE_PARAMS_JSON: '{"number":"{{receiptNo}}"}',
    SERVICE_MESSAGE_AUTO_CANCEL_TEMPLATE_NAME: 'auto_cancel_d_ja',
    SERVICE_MESSAGE_AUTO_CANCEL_TEMPLATE_PARAMS_JSON: '{"number":"{{receiptNo}}","cancel_reason":"{{cancelReason}}"}',
    ...extra,
  };
}

export function makeCtx() {
  const pending = [];
  return { waitUntil(p) { pending.push(Promise.resolve(p)); }, async drain() { while (pending.length) await pending.shift(); } };
}

export async function call(worker, env, { method = 'POST', body, query = {}, headers = {}, origin = ORIGIN } = {}) {
  const url = new URL(WORKER_URL);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const h = new Headers(headers);
  if (origin) h.set('Origin', origin);
  let payload;
  if (body) { h.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8'); payload = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v ?? '')])).toString(); }
  const ctx = makeCtx();
  const res = await worker.fetch(new Request(url, { method, headers: h, body: payload }), env, ctx);
  await ctx.drain();
  let data = null; try { data = await res.clone().json(); } catch {}
  return { status: res.status, data, text: data ? '' : await res.text() };
}

export function signOfficialLine(rawBody) {
  return createHmac('sha256', OA_SECRET).update(rawBody).digest('base64');
}
