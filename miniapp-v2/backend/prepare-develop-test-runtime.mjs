import { readFileSync, writeFileSync } from 'node:fs';

const sourcePath = 'miniapp-v2/backend/develop-gateway.js';
const outputPath = 'develop-gateway.runtime.mjs';
let s = readFileSync(sourcePath, 'utf8');

function replaceOnce(oldText, newText) {
  const count = s.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`Expected exactly one runtime patch match, got ${count}: ${oldText.slice(0, 120)}`);
  }
  s = s.replace(oldText, newText);
}

replaceOnce("  VERSION: '1.0.dev1',", "  VERSION: '1.1.dev-test-slot',");
replaceOnce(
  "  ONSITE_OPEN_MIN: 9 * 60 + 30,",
  "  ONSITE_OPEN_MIN: 9 * 60 + 30,\n  DEVELOP_TEST_WAIT_TYPE_ID: '0042',"
);
replaceOnce(
  "    createEnabled: String(env.CREATE_ENABLED || '0') === '1',",
  "    createEnabled: String(env.CREATE_ENABLED || '0') === '1',\n    developTestWaitTypeId: CFG.DEVELOP_TEST_WAIT_TYPE_ID,"
);
replaceOnce(
  "function enforceReceptionHours(day, mode) {\n  if (day.isClosed) throw apiError('CLOSED_DAY', 400);",
  "function enforceReceptionHours(day, mode, waitTypeId) {\n  if (waitTypeId === CFG.DEVELOP_TEST_WAIT_TYPE_ID) return;\n  if (day.isClosed) throw apiError('CLOSED_DAY', 400);"
);

replaceOnce(
`function validateWaitType(waitTypes, day, mode, waitTypeId) {
  const allowed = SLOT_RULES[day.businessType] || [];
  if (!allowed.includes(waitTypeId)) throw apiError('WAIT_TYPE_NOT_ALLOWED_FOR_DAY', 400);
  const w = waitTypes.find(x => x.waitTypeId === waitTypeId);
  if (!w || w.dispFlg === false) throw apiError('WAIT_TYPE_NOT_AVAILABLE', 400);
  const usage = String(w.usageDispType || '');
  if (usage) {
    const allowedUsage = mode === 'web' ? ['01', '03'] : ['01', '02'];
    if (!allowedUsage.includes(usage)) throw apiError('WAIT_TYPE_MODE_MISMATCH', 400);
  }
  return w;
}`,
`function isStoreReceptionUsage(usage) {
  const u = String(usage || '');
  return !u || ['01', '02', 'KeyALL', 'KeySTORE_RECEPTION_ONLY'].includes(u);
}

function validateWaitType(waitTypes, day, mode, waitTypeId) {
  const isDevelopTest = waitTypeId === CFG.DEVELOP_TEST_WAIT_TYPE_ID;
  const allowed = SLOT_RULES[day.businessType] || [];
  if (!isDevelopTest && !allowed.includes(waitTypeId)) throw apiError('WAIT_TYPE_NOT_ALLOWED_FOR_DAY', 400);
  const w = waitTypes.find(x => x.waitTypeId === waitTypeId);
  if (!w) throw apiError('WAIT_TYPE_NOT_AVAILABLE', 400);
  if (!isDevelopTest && w.dispFlg === false) throw apiError('WAIT_TYPE_NOT_AVAILABLE', 400);
  if (!isStoreReceptionUsage(w.usageDispType)) throw apiError('WAIT_TYPE_MODE_MISMATCH', 400);
  return w;
}`
);

replaceOnce(
  "  enforceReceptionHours(day, mode);",
  "  enforceReceptionHours(day, mode, waitTypeId);"
);

writeFileSync(outputPath, s, 'utf8');
console.log(`Prepared ${outputPath} with Developing-only AirWAIT test slot 0042 support.`);
