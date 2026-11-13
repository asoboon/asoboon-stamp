/* ASOBooN | All-route localization bridge.
 * Extends the existing 7-language dictionary to routes that were Japanese-only.
 * Never mutates ticket numbers, fees, AirWAIT state, click handlers or saved data.
 * Untranslated copy is disclosed rather than guessed or passed off as Kurmancî.
 */
(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
const LOCALES=new Set(['ja','en','zh-CN','vi','ne','ko','kmr']);
const CORE=new Set(['home','reception','callstatus']);
const KEYS='asoboon_miniapp_locale_v1';
let scheduled=false, lastStats={language:'ja',view:'home',translated:0,englishFallback:0,untranslated:0,examples:[]};
const cache=new WeakMap(),attrCache=new WeakMap();
const locale=()=>{let v=window.ASOBOON_I18N?.language;if(!LOCALES.has(v)){try{v=localStorage.getItem(KEYS)}catch{v='ja'}}return LOCALES.has(v)?v:'ja'};
const view=()=>new URLSearchParams(location.search).get('view')||'home';
const dictionary=()=>window.ASOBOON_I18N_DICTIONARY||{};
const kanji=/[\u3041-\u30ff\u3400-\u9fff]/;
const leftoverScript=/[\u0900-\u097f]/;
// Fix known preexisting dynamic-template fallthroughs, where the old runtime
// incorrectly used Nepali even after selecting Korean or Kurmancî.
function wrongLanguage(value,code){
 if(code!=='ko'&&code!=='kmr')return value;
 const leading=value.match(/^(\d{1,2}:\d{2}) बजेदेखि$/);
 if(leading)return code==='ko'?leading[1]+'부터':'Ji '+leading[1]+' ve';
 const opening=value.match(/^(\d{1,2}\/\d{1,2}) को खुल्ने दिन$/);
 if(opening)return code==='ko'?opening[1]+' 영업':'Open '+opening[1];
 const count=value.match(/^जम्मा\s+(\d+)\s+जना$/);
 if(count)return code==='ko'?'총 '+count[1]+'명':'Total '+count[1]+' people';
 const minute=value.match(/^(\d+) मिनेट$/);
 if(minute)return code==='ko'?minute[1]+'분':minute[1]+' deqe';
 return value;
}
function translated(value,language,stats){
 if(language==='ja'||!value.trim())return value;
 const raw=value.trim(),dict=dictionary();
 const lead=value.match(/^\s*/)?.[0]||'',tail=value.match(/\s*$/)?.[0]||'';
 let out=wrongLanguage(raw,language);
 if(out!==raw){stats.translated++;return lead+out+tail;}
 const entry=dict[raw];
 if(entry?.[language]){stats.translated++;return lead+entry[language]+tail;}
 if(entry?.en){stats.englishFallback++;return lead+entry.en+tail;}
 if(/^[①②③]\s+/.test(raw)){
  const m=raw.match(/^([①②③]\s+)(.+)$/),v=translated(m[2],language,stats);
  if(v!==m[2])return lead+m[1]+v+tail;
 }
 // Translate separable Japanese sentences only if each part is recognized;
 // never splice arbitrary Japanese and English inside a legal instruction.
 if(raw.includes('。')){
  const parts=raw.split('。').filter(Boolean),out=parts.map(p=>dict[p]?.[language]||dict[p]?.en||p);
  if(parts.length>1&&out.every((v,i)=>v!==parts[i])){
   stats.translated++;return lead+out.join(language==='zh-CN'?'。':'. ')+tail;
  }
 }
 if(kanji.test(raw)){
  stats.untranslated++;
  if(stats.examples.length<24)stats.examples.push(raw.slice(0,120));
 }
 return value;
}
function eligible(n){
 return n?.parentElement&&!n.parentElement.closest('script,style,textarea,select,option,[data-no-i18n],#asoboon-japanese-legal-original');
}
function replaceNode(n,language,stats){
 if(!eligible(n))return;
 const current=n.nodeValue||'',old=cache.get(n);
 const raw=old&&old.last===current?old.raw:current;
 const out=translated(raw,language,stats);
 cache.set(n,{raw,last:out});
 if(current!==out)n.nodeValue=out;
}
function replaceAttributes(el,language,stats){
 const old=attrCache.get(el)||{};
 for(const name of ['aria-label','title','placeholder']){
  if(!el.hasAttribute(name))continue;
  const current=el.getAttribute(name)||'',prior=old[name];
  const raw=prior&&prior.last===current?prior.raw:current;
  const out=translated(raw,language,stats);
  old[name]={raw,last:out};
  if(out!==current)el.setAttribute(name,out);
 }
 attrCache.set(el,old);
}
function refresh(){
 scheduled=false;
 const language=locale(),page=view();
 // The original runtime owns the three core routes; only intervene to correct
 // its confirmed wrong-language dynamic fallthroughs, not to compete with it.
 const stats={language,view:page,translated:0,englishFallback:0,untranslated:0,examples:[]};
 if(CORE.has(page)){
  if(language==='ko'||language==='kmr'){
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   while(walker.nextNode()){
    const n=walker.currentNode;
    if(!eligible(n)||!leftoverScript.test(n.nodeValue||''))continue;
    const out=wrongLanguage(n.nodeValue||'',language);
    if(out!==n.nodeValue){n.nodeValue=out;stats.translated++}
    else{stats.untranslated++;if(stats.examples.length<24)stats.examples.push(n.nodeValue.slice(0,120))}
   }
  }
 }else{
  if(language!=='ja'){
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   while(walker.nextNode())replaceNode(walker.currentNode,language,stats);
   for(const el of root.querySelectorAll('[aria-label],[title],[placeholder]')){
    if(!el.closest('[data-no-i18n],#asoboon-japanese-legal-original'))replaceAttributes(el,language,stats);
   }
  }else{
   // Restore literal Japanese originals on return to Japanese.
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
   while(walker.nextNode())replaceNode(walker.currentNode,'ja',stats);
   for(const el of root.querySelectorAll('[aria-label],[title],[placeholder]'))replaceAttributes(el,'ja',stats);
  }
  document.documentElement.lang=language;
  const note=document.getElementById('asoboon-language-note');
  if(note&&language!=='ja'){
   note.hidden=false;
   const copy={
    en:'Some instructions on this page may still appear in Japanese. Please ask a staff member if anything is unclear.',
    'zh-CN':'此页面的部分说明可能仍为日语。如有疑问，请咨询工作人员。',
    vi:'Một số hướng dẫn trên trang này vẫn có thể bằng tiếng Nhật. Nếu chưa rõ, vui lòng hỏi nhân viên.',
    ne:'यस पृष्ठका केही जानकारी अझै जापानी भाषामा हुन सक्छन्। नबुझेमा कर्मचारीलाई सोध्नुहोस्।',
    ko:'이 페이지의 일부 안내는 일본어로 표시될 수 있습니다. 이해하기 어려우면 직원에게 문의하세요.',
    kmr:'Hin agahiyên vê rûpelê dibe ku bi Japonî bin. Heke tiştek ne zelal be, ji karmendan bipirse.'
   };
   note.textContent=copy[language]||copy.en;
  }
 }
 lastStats=stats;
 window.dispatchEvent(new CustomEvent('asoboon:i18n-audited',{detail:{...stats,examples:[...stats.examples]}}));
}
function schedule(){
 if(scheduled)return;scheduled=true;
 setTimeout(refresh,85);
}
new MutationObserver(records=>{
 if(CORE.has(view()))return;
 if(records.some(r=>{
  if(r.type==='childList')return true;
  if(r.type==='attributes'){
   const attr=r.attributeName;const data=attrCache.get(r.target)?.[attr];
   return !(data&&r.target.getAttribute(attr)===data.last);
  }
  const data=cache.get(r.target);
  return !(data&&r.target.nodeValue===data.last);
 }))schedule();
}).observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder']});
window.addEventListener('asoboon:language-changed',schedule);
window.addEventListener('asoboon:v2-route-rendered',schedule);
window.addEventListener('popstate',schedule);
window.addEventListener('load',schedule);
window.ASOBOON_ROUTE_I18N=Object.freeze({audit(){return {...lastStats,examples:[...lastStats.examples]}},refresh:schedule});
schedule();
})();
