/* Shared translation bridge for standalone business/event calendars.
   Display-only, same saved locale as the LINE Mini App; no backend or booking changes. */
(()=>{'use strict';
const KEY='asoboon_miniapp_locale_v1', TABLE=window.ASOBOON_I18N_DICTIONARY||{};
const LANGS=['ja','en','zh-CN','vi','ne','ko','kmr'];
let locale='ja';
try{const saved=localStorage.getItem(KEY);if(LANGS.includes(saved))locale=saved}catch{}
if(locale==='ja')return;
document.documentElement.lang=locale;
const source=new WeakMap(),attrs=new WeakMap();
const ignore='script,style,textarea,select,option,iframe,[data-no-i18n]';
const note={
 en:'Some calendar details may still appear in Japanese or English. On-site notices take precedence.',
 'zh-CN':'部分日历信息可能仍显示日语或英语。请以现场公告为准。',
 vi:'Một số thông tin lịch có thể còn bằng tiếng Nhật hoặc tiếng Anh. Vui lòng ưu tiên thông báo tại cơ sở.',
 ne:'क्यालेन्डरका केही जानकारी जापानी वा अङ्ग्रेजीमा देखिन सक्छन्। स्थलका सूचनालाई प्राथमिकता दिनुहोस्।',
 ko:'일부 달력 정보는 일본어 또는 영어로 표시될 수 있습니다. 현장 안내를 우선해 주세요.',
 kmr:'Hinek agahiyên salnameyê dikarin bi Japonî an Îngilîzî bin. Rêberiya li navendê bişopînin.'
};
function translateRaw(raw){
 const value=raw.trim();if(!value)return raw;
 const month=value.match(/^(\d{4})年\s*(\d{1,2})月$/);
 let translated;
 if(month){
  const [,year,mon]=month;
  translated=locale==='zh-CN'?year+'年'+mon+'月':
   locale==='ko'?year+'년 '+mon+'월':
   locale==='vi'?'Tháng '+mon+'/'+year:
   locale==='ne'?year+' साल '+mon+' महिना':
   locale==='kmr'?mon+'/'+year:mon+'/'+year;
 }else translated=TABLE[value]?.[locale]||TABLE[value]?.en||value;
 return raw.slice(0,raw.length-raw.trimStart().length)+translated+raw.slice(raw.trimEnd().length);
}
function translate(){
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  if(!node.parentElement||node.parentElement.closest(ignore))continue;
  const cur=node.nodeValue||'',prior=source.get(node);
  const raw=prior&&prior.last===cur?prior.raw:cur;
  const out=translateRaw(raw);
  source.set(node,{raw,last:out});
  if(cur!==out)node.nodeValue=out;
 }
 for(const el of document.body.querySelectorAll('[aria-label],[title],[placeholder]')){
  if(el.closest(ignore))continue;
  const prev=attrs.get(el)||{};
  for(const key of ['aria-label','title','placeholder']){
   if(!el.hasAttribute(key))continue;
   const cur=el.getAttribute(key)||'',p=prev[key];
   const raw=p&&p.last===cur?p.raw:cur;
   const out=translateRaw(raw);
   prev[key]={raw,last:out};
   if(out!==cur)el.setAttribute(key,out);
  }
  attrs.set(el,prev);
 }
}
const main=document.querySelector('main');
if(main){
 const info=document.createElement('p');
 info.setAttribute('role','note');info.setAttribute('data-no-i18n','1');
 info.className='asoboon-calendar-language-note';
 info.textContent=note[locale]||note.en;
 info.style.cssText='font:700 12px/1.45 system-ui,sans-serif;background:#FFF9F1;color:#251C1A;border:2px solid #67CEBB;border-radius:12px;padding:9px 11px;margin:0 0 12px;';
 main.insertBefore(info,main.firstChild);
}
let pending=false;
function schedule(){if(pending)return;pending=true;queueMicrotask(()=>{pending=false;translate()})}
new MutationObserver(records=>{
 if(records.some(r=>r.type==='childList'||(r.type==='characterData'&&!(source.get(r.target)?.last===r.target.nodeValue))||r.type==='attributes'))schedule();
}).observe(document.body,{childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder'],subtree:true});
window.addEventListener('pageshow',schedule);
schedule();
})();
