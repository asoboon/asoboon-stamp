import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const config=readFileSync('.github/workflows/deploy-miniapp-v2-production-gateway.yml','utf8');
test('read prewarm deployment inputs are quoted strings (not YAML booleans)',()=>{
  assert.match(config,/public_read_prewarm:\s*\n\s+description:[^\n]*\n\s+type: choice\s*\n\s+options: \["off", "on"\]\s*\n\s+default: "off"/);
  assert.match(config,/PRODUCTION_CREATE_ENABLED: \$\{\{ github\.event\.inputs\.mode == 'live'/);
  assert.match(config,/PUBLIC_READ_PREWARM_ENABLED: \$\{\{ github\.event\.inputs\.public_read_prewarm == 'on'/);
  assert.match(config,/x\.publicReadPrewarmEnabled!==\(process\.env\.PUBLIC_READ_PREWARM_ENABLED==="1"\)/);
});
