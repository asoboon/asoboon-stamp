import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync('miniapp-v2/production/home-v38.js','utf8');
const start=src.indexOf('function patchToday(){');
const end=src.indexOf('\nfunction readTimeguideResult()',start);
assert.ok(start>=0&&end>start);
const render=src.slice(start,end);

function evaluate(day,compact,dayError=''){
 const values=Array.from({length:3},()=>({textContent:''}));
 let closed=null;
 const box={querySelectorAll:()=>values,classList:{toggle:(label,on)=>{assert.equal(label,'closed');closed=on;}}};
 const root={querySelector:sel=>sel==='#v38Today'?box:null};
 const setText=(el,value)=>{if(el)el.textContent=String(value)};
 runInNewContext(render+'\npatchToday();',{root,window:{ASOBOON_MINT_V51_PREVIEW:compact},day,dayError,T:{loading:'読み込み中'},setText});
 return {values:values.map(x=>x.textContent),closed};
}

test('classic rollback keeps the original three field meanings',()=>{
 const day={isClosed:false,businessType:'土日祝日',durationLabel:'2時間30分',closingTime:'18:00'};
 assert.deepEqual(evaluate(day,false),{values:['土日祝日','2時間30分','18:00'],closed:false});
 assert.deepEqual(evaluate(day,undefined),{values:['土日祝日','2時間30分','18:00'],closed:false});
});
test('compact mint HOME presents only real business facts',()=>{
 const day={isClosed:false,businessType:'土日祝日',durationLabel:'2時間30分',closingTime:'18:00'};
 assert.deepEqual(evaluate(day,true),{values:['今日の営業','土日祝 10:00〜18:00','2時間30分制'],closed:false});
});
test('weekday unlimited and closed day remain truthful in both modes',()=>{
 const weekday={isClosed:false,businessType:'平日',durationLabel:'無制限',closingTime:'17:00'};
 assert.deepEqual(evaluate(weekday,true).values,['今日の営業','平日 10:00〜17:00','無制限']);
 const closed={isClosed:true,businessType:'休館日',durationLabel:'',closingTime:''};
 assert.deepEqual(evaluate(closed,true),{values:['今日の営業','休館日',''],closed:true});
 assert.deepEqual(evaluate(closed,false),{values:['休館','—','—'],closed:true});
});
test('unavailable business day never shows invented hours',()=>{
 assert.deepEqual(evaluate(null,true,'API_ERROR').values,['今日の営業','取得不可','']);
 assert.deepEqual(evaluate(null,false,'API_ERROR').values,['取得できません','—','—']);
});
