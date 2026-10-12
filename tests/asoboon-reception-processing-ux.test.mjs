import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('miniapp-v2/shared/reception.js','utf8');
const css=readFileSync('miniapp-v2/shared/reception.css','utf8');

function makeHarness(){
 const elements=new Map();
 const make=(id)=>{
   const classes=new Set();
   return {id,hidden:id==='recProcessing',textContent:'',classList:{
      toggle(name,on){if(on)classes.add(name);else classes.delete(name)},
      contains(name){return classes.has(name)}
   },scrollIntoView(){this.scrolled=true}};
 };
 for(const id of ['recProcessing','recProcessingTitle','recProcessingDetail','recProcessingWhy','recProcessingElapsed',
   'recProcessingStep1','recProcessingStep2','recProcessingStep3'])elements.set(id,make(id));
 let ticks=0,canceled=0;
 const context={
   window:{ASOBOON_V2_ENV:{environment:'production'},ASOBOON_V2_RULES:{}},
   location:{search:''},URLSearchParams,Intl,Date,Number,String,Math,Object,
   document:{getElementById(id){return elements.get(id)||null}},
   setInterval(){ticks++;return ticks},clearInterval(){canceled++}
 };
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,"window.__UX_TEST={startProcessing,setProcessingStage,stopProcessing,renderProcessing};})();"),context);
 return {elements,api:context.window.__UX_TEST,get ticks(){return ticks},get canceled(){return canceled}};
}
test('reception markup makes waiting purposeful without implying a confirmed reservation',()=>{
 const h=makeHarness();
 const html=vm.runInNewContext('window.ASOBOON_V2_RECEPTION.render()',{
   window:h.api?{ASOBOON_V2_ENV:{environment:'production'},ASOBOON_V2_RULES:{},ASOBOON_V2_RECEPTION:{render:()=>''}}:{},
 }).toString();
 assert.match(source,/id="recProcessing"/);
 assert.match(source,/id="recProcessingStep1"/);
 assert.match(source,/id="recProcessingStep2"/);
 assert.match(source,/id="recProcessingStep3"/);
 assert.match(source,/番号が表示されるまで、再度押さずにお待ちください/);
 assert.doesNotMatch(source,/id="recProcessingPercent"/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('only observable client phases are emphasized and loading always stops',()=>{
 const h=makeHarness(),e=id=>h.elements.get(id);
 h.api.startProcessing();
 assert.equal(e('recProcessing').hidden,false);
 assert.equal(e('recProcessingStep1').classList.contains('is-active'),true);
 assert.match(e('recProcessingTitle').textContent,/受付内容を確認/);
 h.api.setProcessingStage('send');
 assert.equal(e('recProcessingStep1').classList.contains('is-done'),true);
 assert.equal(e('recProcessingStep2').classList.contains('is-active'),true);
 assert.match(e('recProcessingDetail').textContent,/LINE通知/);
 h.api.setProcessingStage('verify');
 assert.equal(e('recProcessingStep3').classList.contains('is-active'),true);
 assert.match(e('recProcessingWhy').textContent,/新しい受付は発行せず/);
 assert.match(e('recProcessingDetail').textContent,/同じ受付ID/);
 h.api.stopProcessing();
 assert.equal(e('recProcessing').hidden,true);
 assert.equal(h.canceled,1);
});
test('ambiguous results remain protected by the existing no-reissue route',()=>{
 assert.match(source,/if\(isCreate\)\{setPendingPhase\(id,'awaiting-result'\);setProcessingStage\('verify'\)\}/);
 assert.match(source,/if\(r\?\.ambiguous\|\|\/AMBIGUOUS/);
 assert.match(source,/function lockAmbiguous\(requestId/);
 assert.match(source,/function completeConfirmed\(r,meta=\{\}\)\{stopProcessing\(\)/);
 assert.match(source,/function lockNotificationAmbiguous\(requestId\)\{stopProcessing\(\)/);
 assert.match(source,/stopProcessing\(\);S\.busy=false;status/);
});
