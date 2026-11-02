import test from 'node:test';
import assert from 'node:assert/strict';
import { allHidden } from '../miniapp-v2/production/crowd-visibility.mjs';

const onsite=[{waitTypeId:'0023'},{waitTypeId:'0025'}];
const online=['0024','0027'];
const base=[...onsite.map(x=>x.waitTypeId),...online].map(waitTypeId=>({waitTypeId,dispFlg:false}));
test('all four reception types hidden means today is closed',()=>{
 assert.equal(allHidden(base,onsite,online),true);
});
test('one live LINE or WEB slot means not finished',()=>{
 assert.equal(allHidden(base.map(x=>x.waitTypeId==='0023'?{...x,dispFlg:true}:x),onsite,online),false);
 assert.equal(allHidden(base.map(x=>x.waitTypeId==='0024'?{...x,dispFlg:true}:x),onsite,online),false);
});
test('an absent type, invalid response or empty expected list is not proof of closure',()=>{
 assert.equal(allHidden(base.slice(1),onsite,online),null);
 assert.equal(allHidden(null,onsite,online),null);
 assert.equal(allHidden([],[],[]),null);
});
test('unknown flags are not proof of closure',()=>{
 assert.equal(allHidden(base.map(x=>x.waitTypeId==='0023'?{...x,dispFlg:'false'}:x),onsite,online),false);
});
