import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync('miniapp-v2/shared/i18n-dictionary.js','utf8');
test('party-size guidance is translated into all six non-Japanese supported languages',()=>{
 const context={window:{}};
 vm.runInNewContext(src,context,{timeout:2000});
 const dict=context.window.ASOBOON_I18N_DICTIONARY;
 const entry=dict['人数の条件は満たしています。'];
 assert.ok(entry,'new validation copy must be translated, not a Japanese-only label');
 for(const lang of ['en','zh-CN','ko','vi','ne','kmr']){
  assert.equal(typeof entry[lang],'string',lang);
  assert.ok(entry[lang].length>5,lang);
  assert.ok(!/[\u3040-\u30ff]/.test(entry[lang]),lang);
 }
});
