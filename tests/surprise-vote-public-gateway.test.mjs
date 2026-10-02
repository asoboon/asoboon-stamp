import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../app/backend/surprise-vote-public-gateway/worker.js';

class FakeDB {
  constructor(seed = null) {
    this.row = seed;
  }
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async first() {
            if (/SELECT value, updated_at/i.test(sql)) return db.row;
            return null;
          },
          async run() {
            if (/INSERT INTO surprise_vote_public_state/i.test(sql)) {
              db.row = { value: String(args[1]), updated_at: Number(args[2]) };
            }
            return { success: true };
          },
        };
      },
      async run() { return { success: true }; },
    };
  }
}

function resultPayload() {
  const now = Date.now();
  return {
    ok: true,
    version: 'test-origin',
    mode: 'result',
    daily_reset: '23:59',
    selected_event_id: '20261002-1400',
    event: {
      id: '20261002-1400',
      date: '2026-10-02',
      event_time: '14:00',
      vote_start: new Date(now - 3_600_000).toISOString(),
      vote_end: new Date(now - 1_800_000).toISOString(),
      result_end: new Date(now + 3_600_000).toISOString(),
      options: [{ id: 'c1', name: '宝探し', total: 100 }],
    },
    day_events: [{ id: '20261002-1400', vote_start: new Date(now - 3_600_000).toISOString() }],
    winner: { id: 'c1', name: '宝探し', total: 100 },
  };
}

function ctx() {
  const pending = [];
  return {
    pending,
    waitUntil(promise) { pending.push(Promise.resolve(promise)); },
  };
}

const origin = 'https://asoboon.github.io';

test('first public status fetches origin and persists D1 snapshot', async () => {
  const oldFetch = globalThis.fetch;
  const payload = resultPayload();
  globalThis.fetch = async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  try {
    const env = { DB: new FakeDB() };
    const res = await worker.fetch(new Request('https://worker.test/?action=status', {
      headers: { Origin: origin },
    }), env, ctx());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), origin);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.edge_cache, 'origin');
    assert.equal(data.winner.name, '宝探し');
    assert.ok(env.DB.row);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('health never needs origin and reports snapshot state', async () => {
  const payload = resultPayload();
  const env = {
    DB: new FakeDB({
      value: JSON.stringify(payload),
      updated_at: Date.now(),
    }),
  };
  const res = await worker.fetch(new Request('https://worker.test/?action=health', {
    headers: { Origin: origin },
  }), env, ctx());
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.snapshotReady, true);
  assert.equal(data.architecture, 'SURPRISE_VOTE_PUBLIC_D1_V1');
});

test('OPTIONS exposes only the trusted GitHub Pages origin', async () => {
  const env = { DB: new FakeDB() };
  const trusted = await worker.fetch(new Request('https://worker.test/', {
    method: 'OPTIONS', headers: { Origin: origin },
  }), env, ctx());
  assert.equal(trusted.status, 204);
  assert.equal(trusted.headers.get('access-control-allow-origin'), origin);

  const other = await worker.fetch(new Request('https://worker.test/', {
    method: 'OPTIONS', headers: { Origin: 'https://example.com' },
  }), env, ctx());
  assert.equal(other.headers.get('access-control-allow-origin'), null);
});

test('browser cannot write through the public gateway', async () => {
  const env = { DB: new FakeDB() };
  const res = await worker.fetch(new Request('https://worker.test/?action=status', {
    method: 'POST', headers: { Origin: origin }, body: 'x=1',
  }), env, ctx());
  assert.equal(res.status, 405);
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.error, 'METHOD_NOT_ALLOWED');
});
