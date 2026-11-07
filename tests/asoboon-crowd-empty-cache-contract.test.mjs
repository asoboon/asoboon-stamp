import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../miniapp-v2/production/home-v38.js',import.meta.url),'utf8');
const bundle=readFileSync(new URL('../miniapp-v2/production/production-app.js',import.meta.url),'utf8');

function closingPath(text) {
  const branch=text.indexOf("if(reason==='AIRWAIT_CROWD_EMPTY'){");
  assert.notEqual(branch,-1,'explicit end-of-reception branch exists');
  const next=text.indexOf('}else{',branch);
  assert.ok(next>branch,'end-of-reception branch is bounded');
  return text.slice(branch,next);
}
test('end-of-reception clears both live counts and persisted positive snapshot',()=>{
  for(const [name,code] of [['source',source],['production bundle',bundle]]){
    const body=closingPath(code);
    assert.match(body,/crowdSlots=null/);
    assert.match(body,/crowdClosed=true/);
    assert.match(code.slice(code.indexOf('}finally{',code.indexOf("if(reason==='AIRWAIT_CROWD_EMPTY'){"))),/if\(crowdClosed\)try\{localStorage\.removeItem\(CROWD_CACHE_KEY\)\}catch\{\}/,name);
  }
});
test('visibility check owns loading lock through its awaited decision',()=>{
  for(const code of [source,bundle]){
    const start=code.indexOf("if(!crowdClosed&&(crowdError||!validCrowdSlots().some(s=>s.web!==null||s.onsite!==null))&&day){");
    assert.notEqual(start,-1);
    const lockRelease=code.indexOf('crowdLoading=false;',start);
    assert.ok(lockRelease>code.indexOf('await m.check(',start),'request remains locked until visibility resolved');
  }
});
