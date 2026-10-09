import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const JS='miniapp-v2/production/entry-v25.js';
const CSS='miniapp-v2/production/entry-v25.css';
test('entry routes preserve original operational rules and offer missing receipt fallback',()=>{
  const js=readFileSync(JS,'utf8');
  for(const id of ['adult','all','return','returnAll','returnAdult','returnUnknown','exit'])assert.match(js,new RegExp('(?:\\b|\\x27)'+id+'(?:\\b|\\x27)'));
  for(const term of ['黄色ホルダー','レシートを保管','赤・黄色すべてのホルダー','スタッフへお声がけ','お子さまだけを館内に残すことはできません','一時退場中も利用時間は進みます','どちらもない・分からない'])assert.ok(js.includes(term),term);
  assert.match(js,/data-entry-choice/);
  assert.match(js,/持ち物を選び直す/);
  assert.match(js,/4つの選択肢へ戻る/);
});
test('entry uses inline symbols and CSS objects without photos or external image assets',()=>{
  const js=readFileSync(JS,'utf8'),css=readFileSync(CSS,'utf8');
  assert.match(js,/<svg class="entry-svg"/);
  assert.match(css,/entry-object--receipt/);
  assert.match(css,/entry-object--yellow/);
  assert.doesNotMatch(js,/<img|<picture|https?:\/\//);
  assert.doesNotMatch(css,/@import|url\(/i);
});
test('production deferred bundle includes the revised entry page but leaves initial bundle image-free',()=>{
  const routes=readFileSync('miniapp-v2/production/production-routes.js','utf8');
  const styles=readFileSync('miniapp-v2/production/production-routes.css','utf8');
  assert.match(routes,/どちらもない・分からない/);
  assert.match(styles,/entry-choice--adult/);
  assert.match(readFileSync('miniapp-v2/production/bundle-sources.json','utf8'),/entry-v25.css/);
});
