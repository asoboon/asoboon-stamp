/* ASOBooN five-language display layer; reception data and identifiers remain unchanged. */
(()=>{'use strict';
const TABLE=window.ASOBOON_I18N_DICTIONARY;
if(!TABLE||Object.keys(TABLE).length<200)return; // Missing dictionary: show only the complete Japanese experience.
const LANGUAGES=Object.freeze({ja:'日本語','zh-CN':'简体中文',vi:'Tiếng Việt',en:'English',ne:'नेपाली'});
const KEY='asoboon_miniapp_locale_v1';
const app=document.getElementById('app');if(!app)return;
const cached=new WeakMap(),attributes=new WeakMap();
let language='ja',scheduled=false;
try{const value=localStorage.getItem(KEY);if(Object.hasOwn(LANGUAGES,value))language=value}catch{}
const page=()=>new URLSearchParams(location.search).get('view')||'home';
const isCore=()=>['home','reception','callstatus'].includes(page());
function dynamicText(value){
 const locale=language;
 if(TABLE[value]&&TABLE[value][locale])return TABLE[value][locale];
 if(value.startsWith('LINE内 · '))return (locale==='en'?'In LINE · ':locale==='zh-CN'?'LINE内 · ':locale==='vi'?'Trong LINE · ':'LINE भित्र · ')+value.slice('LINE内 · '.length);
 for(const prefix of ['① ','② ','③ ']){const entry=TABLE[prefix+value]?.[locale];if(entry)return entry.replace(/^[①②③]\s*/, '')}
 const people=locale==='en'?'people':locale==='zh-CN'?'人':locale==='vi'?'người':'जना';
 const session=locale==='en'?'session':locale==='zh-CN'?'场次':locale==='vi'?'lượt':'पालो';
 const minute=locale==='en'?'min':locale==='zh-CN'?'分钟':locale==='vi'?'phút':'मिनेट';
 const seconds=locale==='en'?'sec':locale==='zh-CN'?'秒':locale==='vi'?'giây':'सेकेन्ड';
 if(/^\d{1,2}:\d{2}の回$/.test(value))return value.replace('の回',' '+session);
 if(/^\d{1,2}:\d{2}回$/.test(value))return value.replace('回',' '+session);
 const duration=value.match(/^(\d+)時間(\d+)分$/);
 if(duration)return locale==='en'?duration[1]+' hr '+duration[2]+' min':locale==='zh-CN'?duration[1]+'小时'+duration[2]+'分钟':locale==='vi'?duration[1]+' giờ '+duration[2]+' phút':duration[1]+' घण्टा '+duration[2]+' मिनेट';
 const peopleSum=value.match(/^合計 (\d+)名$/);
 if(peopleSum)return locale==='en'?'Total '+peopleSum[1]+' people':locale==='zh-CN'?'合计 '+peopleSum[1]+'人':locale==='vi'?'Tổng '+peopleSum[1]+' người':'जम्मा '+peopleSum[1]+' जना';
 const groupCount=value.match(/^\/ (\d+)組中$/);
 if(groupCount)return locale==='en'?'/ '+groupCount[1]+' total groups':locale==='zh-CN'?'/ 共'+groupCount[1]+'组':locale==='vi'?'/ tổng '+groupCount[1]+' nhóm':'/ जम्मा '+groupCount[1]+' समूह';
 const stamp=value.match(/^(\d{1,2}:\d{2}) 確認時点の人数 ／ 自動更新中（約40秒ごと）$/);
 if(stamp)return locale==='en'?stamp[1]+' checked · Auto-refresh ~40 sec':locale==='zh-CN'?stamp[1]+'已确认 · 每约40秒自动刷新':locale==='vi'?stamp[1]+' đã kiểm tra · Tự cập nhật ~40 giây':stamp[1]+' जाँच · करिब ४० सेकेन्डमा अद्यावधिक';
 const staleAt=value.match(/^(\d{1,2}:\d{2}) 確認時点 ／ (.+)$/);
 if(staleAt){
  const prefix=locale==='en'?'Checked '+staleAt[1]+' / ':locale==='zh-CN'?staleAt[1]+'确认 / ':locale==='vi'?'Đã kiểm tra '+staleAt[1]+' / ':staleAt[1]+' जाँच / ';
  return prefix+dynamicText(staleAt[2]);
 }
 const callStart=value.match(/^呼出開始 (\d{1,2}:\d{2})$/);
 if(callStart)return (TABLE['呼出開始']?.[locale]||'Call start')+' '+callStart[1];
 const callTarget=value.match(/^あなた (\d{1,2}:\d{2})ごろ$/);
 if(callTarget)return locale==='en'?'Your estimate: around '+callTarget[1]:locale==='zh-CN'?'您的预计时间：'+callTarget[1]+'左右':locale==='vi'?'Giờ dự kiến của bạn: khoảng '+callTarget[1]:'तपाईंको अनुमान: करिब '+callTarget[1];
 const readTime=value.match(/^LINE受付の残り目安 ／ (\d{1,2}:\d{2}) 確認$/);
 if(readTime)return locale==='en'?'LINE spaces checked at '+readTime[1]:locale==='zh-CN'?'LINE名额 · '+readTime[1]+'确认':locale==='vi'?'Số chỗ LINE · đã kiểm tra '+readTime[1]:'LINE स्थान · '+readTime[1]+' जाँच';
 const heartbeat=value.match(/^自動更新は動作中です。最終取得 ([\d:]+) ／ 次の再確認まで (\d+)秒$/);
 if(heartbeat)return locale==='en'?'Auto-refresh active · Checked '+heartbeat[1]+' · Next in '+heartbeat[2]+' sec':locale==='zh-CN'?'自动更新中 · 最后确认'+heartbeat[1]+' · '+heartbeat[2]+'秒后再查':locale==='vi'?'Tự cập nhật · Lần cuối '+heartbeat[1]+' · Sau '+heartbeat[2]+' giây':'स्वतः अद्यावधिक · अन्तिम '+heartbeat[1]+' · '+heartbeat[2]+' सेकेन्डपछि';
 const opening=value.match(/^(\d{1,2})月(\d{1,2})日 の営業$/);
 if(opening)return locale==='en'?'Open on '+opening[1]+'/'+opening[2]:locale==='zh-CN'?opening[1]+'月'+opening[2]+'日营业':locale==='vi'?'Mở cửa ngày '+opening[2]+'/'+opening[1]:opening[2]+'/'+opening[1]+' को खुल्ने दिन';

 if(/^[\d,]+名$/.test(value))return value.replace('名',' '+people);
 if(/^[\d,]+組$/.test(value))return value.replace('組',' '+people);
 if(/^[\d,]+円$/.test(value))return locale==='zh-CN'?value.replace('円','日元'):'¥'+value.replace('円','');
 if(/^\d+秒$/.test(value))return value.replace('秒',' '+seconds);
 if(value==='名')return people;
 if(value==='組')return locale==='en'?'groups':locale==='zh-CN'?'组':locale==='vi'?'nhóm':'समूह';
 if(/^\d+分$/.test(value))return value.replace('分',' '+minute);
 if(/^\d{1,2}:\d{2}から$/.test(value)){
  const time=value.replace('から','');
  return locale==='en'?'From '+time:locale==='zh-CN'?time+'开始':locale==='vi'?'Từ '+time:time+' बजेदेखि';
 }
 const open=value.match(/^LINE当日受付は(\d{1,2}:\d{2})から$/);
 if(open){
  const time=open[1];
  return locale==='en'?'LINE check-in opens at '+time:locale==='zh-CN'?'LINE取号从'+time+'开始':locale==='vi'?'Đăng ký LINE mở lúc '+time:'LINE दर्ता '+time+' बजेदेखि';
 }
 const available=value.match(/^LINE受付の残り(\d+)名$/);
 if(available){
  const n=available[1];
  return locale==='en'?n+' LINE spaces left':locale==='zh-CN'?'LINE剩余'+n+'名':locale==='vi'?'LINE còn '+n+' chỗ':'LINE मा '+n+' स्थान बाँकी';
 }
 const day=value.match(/^(\d{1,2})月(\d{1,2})日$/);
 if(day)return locale==='zh-CN'?value:locale==='en'?day[1]+'/'+day[2]:locale==='vi'?'Ngày '+day[2]+'/'+day[1]:day[2]+'/'+day[1];
 return value;
}
function translateRaw(value){
 if(language==='ja')return value;
 const lead=value.match(/^\s*/)?.[0]||'';
 const tail=value.match(/\s*$/)?.[0]||'';
 return lead+dynamicText(value.trim())+tail;
}
function updateText(node){
 if(!node?.parentElement||node.parentElement.closest('script,style,textarea,select,option,#asoboon-language-bar,[data-no-i18n]'))return;
 const current=node.nodeValue||'';
 const previous=cached.get(node);
 const raw=previous&&previous.last===current?previous.raw:current;
 const translated=isCore()?translateRaw(raw):raw;
 cached.set(node,{raw,last:translated});
 if(current!==translated)node.nodeValue=translated;
}
function updateAttributes(el){
 const existing=attributes.get(el)||{};
 for(const name of ['aria-label','title','placeholder']){
  if(!el.hasAttribute(name))continue;
  const value=el.getAttribute(name)||'',previous=existing[name];
  const raw=previous&&previous.last===value?previous.raw:value;
  const out=isCore()?translateRaw(raw):raw;
  existing[name]={raw,last:out};
  if(out!==value)el.setAttribute(name,out);
 }
 attributes.set(el,existing);
}
function translate(){
 const walker=document.createTreeWalker(app,NodeFilter.SHOW_TEXT),nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes)updateText(node);
 for(const el of app.querySelectorAll('[aria-label],[title],[placeholder]'))updateAttributes(el);
 const legal=app.querySelector('.rec-disclaimer');
 let japanese=app.querySelector('#asoboon-japanese-legal-original');
 if(legal&&page()==='reception'&&language!=='ja'){
  if(!japanese){
   japanese=document.createElement('details');japanese.id='asoboon-japanese-legal-original';
   japanese.setAttribute('data-no-i18n','1');
   const original=['ご利用にあたって','ご利用にあたりお客様ご自身に関する以下の項目について施設では責任を負いかねますので、あらかじめお知らせいたします。','施設内での怪我、事故','お荷物の紛失、盗難','お客様同士のトラブル','施設内での衣服の汚れ','施設ご利用後の感染症罹患'];
   const heading=document.createElement('summary');heading.textContent='Original Japanese / 日本語原文';japanese.appendChild(heading);
   for(const item of original){const p=document.createElement('p');p.textContent=item;japanese.appendChild(p)}
   legal.appendChild(japanese);
  }
 }else if(japanese){japanese.remove()}
 document.documentElement.lang=isCore()?language:'ja';
 const note=document.getElementById('asoboon-language-note');
 if(note){
  note.hidden=isCore()||language==='ja';
  note.textContent=({
   en:'This section is currently available in Japanese.',
   'zh-CN':'此页面目前仅提供日语。',
   vi:'Trang này hiện chỉ có tiếng Nhật。',
   ne:'यो पृष्ठ अहिले जापानी भाषामा मात्र उपलब्ध छ।'
  })[language]||'';
 }
}
function schedule(){
 if(scheduled)return;scheduled=true;
 setTimeout(()=>{scheduled=false;translate()},35);
}
const bar=document.createElement('div');
bar.id='asoboon-language-bar';
bar.setAttribute('role','group');
bar.setAttribute('aria-label','Language selection');
bar.innerHTML='<label for="asoboon-language-select">🌐 Language</label><select id="asoboon-language-select" aria-label="Choose language"></select><span id="asoboon-language-note" hidden></span>';
const select=bar.querySelector('select');
for(const [code,label] of Object.entries(LANGUAGES)){
 const item=document.createElement('option');item.value=code;item.textContent=label;select.appendChild(item);
}
select.value=language;
const style=document.createElement('style');
style.textContent=[
 '#asoboon-language-bar{position:relative;z-index:45;box-sizing:border-box;display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:7px;width:min(100%,520px);margin:0 auto -2px;padding:max(env(safe-area-inset-top),8px) 13px 0;font-family:system-ui,-apple-system,sans-serif;color:#174c71;font-size:12px;font-weight:800}',
 '#asoboon-language-bar label{white-space:nowrap}',
 '#asoboon-language-select{min-height:42px;max-width:58%;padding:0 10px;border:2px solid #387daa;border-radius:11px;background:#fff;color:#124a6d;font-size:13px;font-weight:850}',
 '#asoboon-language-select:focus-visible{outline:3px solid #eda75a;outline-offset:2px}',
 '#asoboon-language-note{flex-basis:100%;font-size:11px;font-weight:700;line-height:1.35;color:#824e23;text-align:right}',
 '#asoboon-language-note[hidden]{display:none}',
 '#asoboon-japanese-legal-original{margin-top:9px;padding:8px;background:#f6f7f7;border:1px solid #e0e4e5;border-radius:10px;font-size:11px;line-height:1.5}',
 '#asoboon-japanese-legal-original summary{cursor:pointer;color:#255e83;font-weight:850}',
 '#asoboon-japanese-legal-original p{margin:6px 0;color:#4c5b64;font-size:11px;line-height:1.5}',
 'html:lang(ne) .rec-slot,html:lang(ne) .cs-state,html:lang(ne) .v38-hero{line-height:1.55}',
 '@media(max-width:350px){#asoboon-language-bar{gap:4px;padding-right:12px;padding-left:12px;font-size:11px}#asoboon-language-select{max-width:63%}}'
].join('\n');
document.head.appendChild(style);
app.parentNode.insertBefore(bar,app);
select.addEventListener('change',()=>{
 const next=select.value;
 if(!Object.hasOwn(LANGUAGES,next))return;
 language=next;
 try{localStorage.setItem(KEY,language)}catch{}
 schedule();
 window.dispatchEvent(new CustomEvent('asoboon:language-changed',{detail:{language}}));
});
new MutationObserver(records=>{
 const external=records.some(r=>{
   if(r.type==='childList')return true;
   const state=cached.get(r.target);
   return !(state&&r.target.nodeValue===state.last);
 });
 if(external)schedule();
}).observe(app,{subtree:true,childList:true,characterData:true});
window.addEventListener('asoboon:v2-route-rendered',schedule);
window.addEventListener('popstate',schedule);
window.ASOBOON_I18N=Object.freeze({
 get language(){return language},
 setLanguage(code){if(!Object.hasOwn(LANGUAGES,code))return false;select.value=code;select.dispatchEvent(new Event('change',{bubbles:true}));return true},
 t(key){return language==='ja'?key:dynamicText(key)},
 languages:LANGUAGES,
 missing(){if(!isCore()||language==='ja')return [];
  return [...new Set([...app.querySelectorAll('*')].filter(el=>el.children.length===0).map(el=>el.textContent.trim()).filter(x=>/[ぁ-んァ-ン一-龯]/.test(x)))].slice(0,100);
 }
});
schedule();
})();