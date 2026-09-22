const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app/backend/purple-cloudflare-gateway/worker.js'), 'utf8')
  .replace('import { WorkerEntrypoint } from "cloudflare:workers";', '')
  .replace('export default class PurpleGateway', 'class PurpleGateway');

function makeGateway(details, { types, waitInfoStatus = 200 } = {}) {
  const requests = [];
  const defaultTypes = [
    { waitTypeId: '0030', waitTypeName: '10時ご入場枠【WEB整理券】', usageDispType: 'KeyONLINE_RECEPTION_ONLY' },
    { waitTypeId: '0032', waitTypeName: '12時半ご入場枠【WEB整理券】', usageDispType: 'KeyONLINE_RECEPTION_ONLY' },
    { waitTypeId: '0029', waitTypeName: '現地受付', usageDispType: 'KeySTORE_RECEPTION_ONLY' },
  ];
  const fetch = async (input, options = {}) => {
    const url = String(input);
    requests.push({ url, method: options.method || 'GET' });
    if (url.includes('getWaitInfo')) {
      return new Response(JSON.stringify({
        success: true, resultCode: { code: '0000' },
        innerDto: { stores: [{ waitDetails: details }] },
      }), { status: waitInfoStatus });
    }
    if (url.includes('/wait/type/get')) {
      return new Response(JSON.stringify({
        success: true, resultCode: { code: '0000' },
        innerDto: { waitTypeList: types || defaultTypes },
      }));
    }
    throw new Error(`unexpected upstream: ${url}`);
  };
  const context = { WorkerEntrypoint: class {}, fetch, URL, URLSearchParams, Response, AbortSignal, Date, Object, String, Number, Array, Boolean, Error };
  vm.runInNewContext(`${source}\nglobalThis.testCrowdRemaining = crowdRemaining;`, context);
  return { run: () => context.testCrowdRemaining({ AIRWAIT_API_KEY: 'TEST_SECRET' }), requests };
}

test('accepts only exact PERSON units and exact wait-type names', async () => {
  const gateway = makeGateway([
    { detailedWaitType: '10時ご入場枠【WEB整理券】', reserveUnit: 'PERSON', remainingNum: 35 },
    { detailedWaitType: '12時半ご入場枠【WEB整理券】', reserveUnit: 'GROUP', remainingNum: 8 },
    { detailedWaitType: '現地受付', reserveUnit: 'PERSON', remainingNum: 100 },
  ]);
  const result = await gateway.run();
  assert.equal(result.slots.find(x => x.waitTypeId === '0030').remaining, 35);
  assert.equal(result.slots.find(x => x.waitTypeId === '0030').reserveUnit, 'PERSON');
  assert.equal(result.slots.find(x => x.waitTypeId === '0032').remaining, null);
  assert.equal(result.slots.find(x => x.waitTypeId === '0032').evidence, 'UNVERIFIED_UNIT_OR_VALUE');
  assert.equal(result.slots.some(x => x.waitTypeId === '0029'), false);
  assert.equal(JSON.stringify(result).includes('TEST_SECRET'), false);
  assert.equal(gateway.requests.length, 2);
  assert.equal(gateway.requests.some(x => x.url.includes('/reservations')), false);
});

test('ambiguous, missing, and negative remaining values fail closed', async () => {
  const gateway = makeGateway([
    { detailedWaitType: '10時ご入場枠【WEB整理券】', reserveUnit: 'PERSON', remainingNum: 35 },
    { detailedWaitType: '10時ご入場枠【WEB整理券】', reserveUnit: 'PERSON', remainingNum: 36 },
    { detailedWaitType: '12時半ご入場枠【WEB整理券】', reserveUnit: 'PERSON', remainingNum: -1 },
  ]);
  const result = await gateway.run();
  assert.equal(result.slots[0].remaining, null);
  assert.equal(result.slots[0].evidence, 'MATCH_COUNT_2');
  assert.equal(result.slots[1].remaining, null);
});

test('AirWAIT HTTP failure does not become zero remaining', async () => {
  const gateway = makeGateway([], { waitInfoStatus: 503 });
  await assert.rejects(gateway.run(), /AIRWAIT_WAIT_INFO_HTTP_503/);
});
