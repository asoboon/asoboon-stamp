import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('User sees actionable guidance instead of raw identity errors',()=>{
 const source=readFileSync('miniapp-v2/shared/reception.js','utf8');
 const built=readFileSync('miniapp-v2/production/production-routes.js','utf8');
 for(const script of [source,built]){
  assert.match(script,/LINE_PROFILE_INVALID:'LINEの本人情報を確認できませんでした/);
  assert.match(script,/LINE_PROFILE_SCOPE_REQUIRED:'LINEプロフィールの利用許可が必要です/);
  assert.match(script,/LINE_PROFILE_TEMPORARILY_UNAVAILABLE:'LINEの本人確認サービスが一時的に混雑しています/);
 }
});
test('Production profile verification remains fail-closed and retries only transient upstream errors',()=>{
 const source=readFileSync('miniapp-v2/backend/production-worker.mjs','utf8');
 const gateway=readFileSync('miniapp-v2/backend/production-gateway.js','utf8');
 assert.match(source,/if\(!scopes\.has\('profile'\)\)throw apiError\('LINE_PROFILE_SCOPE_REQUIRED',403\)/);
 assert.match(source,/attempt===0&&\(pr\.status===429\|\|pr\.status>=500\)/);
 assert.match(source,/throw apiError\('LINE_PROFILE_REAUTHORIZE',401\)/);
 assert.match(source,/throw apiError\('LINE_PROFILE_TEMPORARILY_UNAVAILABLE',503\)/);
 assert.match(gateway,/LINE_PROFILE_TEMPORARILY_UNAVAILABLE/);
 assert.match(gateway,/attempt===0/);
 assert.match(source,/await assertCreateRequestOwner\(env, createPayload\)/);
});
