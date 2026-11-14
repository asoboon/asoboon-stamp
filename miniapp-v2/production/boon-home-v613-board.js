/* ASOBooN HOME v6.13 — read-only forecast/availability presentation. */
(()=>{'use strict';
if(new URLSearchParams(location.search).get('boonTheme')==='classic')return;
const root=document.getElementById('app');if(!root)return;
const CACHE_KEY='asoboon_v2_crowd_snapshot_production_v1';
const L={
 ja:['混雑予想','入場回','WEB残り','LINE残り','※公開中のWEB・LINE枠の残人数を320人から差し引いた参考値。非公開枠は加算しません。実際の館内滞在人数とは異なります。','※残り人数が確認できない回は「—」です。'],
 en:['Crowd forecast','Entry','WEB left','LINE left','Estimate: 320 minus verified remaining in published WEB/LINE slots, divided by 320. Not live attendance.','— means remaining people could not be verified.'],
 'zh-CN':['拥挤预测','入场场次','WEB剩余','LINE剩余','参考值：(320－WEB剩余－LINE剩余)÷320，非馆内实际人数。','— 表示剩余人数未确认。'],
 ko:['혼잡 예상','입장 회차','WEB 잔여','LINE 잔여','참고치: (320 − WEB 잔여 − LINE 잔여) ÷ 320. 실제 혼잡도와 다릅니다.','—는 잔여 인원을 확인할 수 없다는 뜻입니다.'],
 vi:['Dự báo đông','Lượt vào','WEB còn','LINE còn','Tham khảo: (320 − WEB còn − LINE còn) ÷ 320; không phải số khách thực tế.','—: chưa xác nhận được số người còn.'],
 ne:['भीड अनुमान','प्रवेश समय','WEB बाँकी','LINE बाँकी','अनुमान: (320 − WEB बाँकी − LINE बाँकी) ÷ 320। वास्तविक भीड होइन।','—: बाँकी संख्या पुष्टि भएको छैन।'],
 kmr:['Pêşbîniya qelebalixiyê','Dema ketinê','WEB mayî','LINE mayî','Texmîn: (320 − WEB mayî − LINE mayî) ÷ 320. Ne hejmara rastîn a mêvanan e.','—: hejmara mayî nehat piştrastkirin.']
};
const days={
 en:['Sat/Sun/holiday','Special weekday','Weekday','Monday','2h 30m limit','3h limit','No time limit','Closed'],
 'zh-CN':['周末及节假日','特别平日','平日','周一','限时2小时30分','限时3小时','不限时','休馆'],
 ko:['주말·공휴일','특정 평일','평일','월요일','2시간 30분 제한','3시간 제한','시간 무제한','휴관'],
 vi:['Cuối tuần/ngày lễ','Ngày thường đặc biệt','Ngày thường','Thứ Hai','Giới hạn 2 giờ 30 phút','Giới hạn 3 giờ','Không giới hạn','Đóng cửa'],
 ne:['सप्ताहान्त/बिदा','विशेष कार्यदिन','कार्यदिन','सोमबार','२ घण्टा ३० मिनेट','३ घण्टा','समय सीमा छैन','बन्द'],
 kmr:['Dawiya hefteyê/cejn','Roja taybet a hefteyê','Roja hefteyê','Duşem','2 saet 30 xulek','3 saet','Bê sînor','Girtî']
};
function language(){const l=String(window.ASOBOON_I18N?.language||document.documentElement.lang||'ja');return L[l]?l:l.startsWith('zh')?'zh-CN':'ja'}
function copyTo(node,str){if(node&&node.textContent!==str)node.textContent=str}
function elem(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function translateBusiness(){
 const target=document.querySelector('#v38Today');if(!target)return;
 const nodes=[target.querySelector('span:nth-child(2) strong'),target.querySelector('span:nth-child(3) strong')];
 const lang=language(),dict=days[lang];
 for(const [i,node] of nodes.entries()){
  if(!node)continue;
  const actual=node.textContent.trim();
  // Preserve the native Japanese value separately from this layer's translations.
  // A language switch must never promote our English/Chinese output to the source.
  const lastRendered=node.dataset.v613Rendered;
  if(!Object.prototype.hasOwnProperty.call(node.dataset,'v613Original')||actual!==lastRendered){
   node.dataset.v613Original=actual;
  }
  const jp=node.dataset.v613Original||actual;
  let display=jp;
  if(lang!=='ja'&&dict){
   if(i===0){
    if(jp==='休館日'||jp==='休館')display=dict[7]||jp;
    else{
      const names=[['平日特定日',dict[1]],['土日祝',dict[0]],['土休日',dict[0]],['平日',dict[2]],['月曜',dict[3]]];
      for(const [from,to] of names)if(display.includes(from)){display=display.replace(from,to);break}
    }
   }else{
    display=jp.includes('2時間30分')?dict[4]:jp.includes('3時間')?dict[5]:/(?:無制限|制限なし)/u.test(jp)?dict[6]:jp;
   }
  }
  copyTo(node,display);
  node.dataset.v613Rendered=display;
 }
}
function trustedBooked(card){
 // Use language-neutral values from the already verified native reception cards.
 // Never parse translated text (e.g. "残り80人" / "Left 80 people").
 function remaining(selector){
  const channel=card.querySelector(selector);
  const raw=channel?.querySelector('strong')?.getAttribute('data-v613-n');
  if(raw===null||!/^\d+$/.test(raw))return null;
  const n=Number(raw);
  return Number.isSafeInteger(n)&&n>=0&&n<=10000?n:null;
 }
 const web=remaining('.v38-crowd-channel--web');
 const line=remaining('.v38-crowd-channel--onsite');
 // Nonpublic (retired) channel has no remaining public quota; do not let
 // it prevent a verified single-channel projection.
 const retired=selector=>{
   const el=card.querySelector(selector);
   return el?.classList.contains('is-unavailable')&&
     el.querySelector('strong')?.textContent?.trim()==='受付なし';
 };
 const webRetired=retired('.v38-crowd-channel--web');
 const lineRetired=retired('.v38-crowd-channel--onsite');
 if((web===null&&!webRetired)||(line===null&&!lineRetired))return null;
 if(web===null&&line===null)return null;
 const liveWeb=web===null?0:web,liveLine=line===null?0:line;
 if(liveWeb+liveLine>320)return null;
 return Math.round((320-liveWeb-liveLine)/320*100);
}
function cloneAction(native,unknown){
 if(!native)return elem('span','v613-na','—');
 const node=native.cloneNode(true);
 node.removeAttribute('style');
 // Compact table cells are numbers, not duplicate full-sized reception buttons.
 // Keep the real link/button and its aria-label; remove redundant visual copy.
 node.querySelectorAll('.v38-crowd-tap,.v38-crowd-remain-label').forEach(e=>e.remove());
 if(node.firstElementChild?.tagName==='SPAN')node.firstElementChild.remove();
 for(const [prop,value] of Object.entries({
  'min-height':'44px','height':'44px','padding':'3px 9px 3px 3px',
  'margin':'0','border':'0','background':'transparent','box-shadow':'none',
  'border-radius':'7px','gap':'0'
 }))node.style.setProperty(prop,value,'important');
 const strongNode=node.querySelector('strong');
 if(strongNode){
  strongNode.style.setProperty('font-size','16px','important');
  strongNode.style.setProperty('line-height','1.2','important');
  // Reset the 45px legacy large-card min-height: the compact count itself
  // should shrink to its text height and sit at the centre of its 44px cell.
  strongNode.style.setProperty('min-height','0','important');
  strongNode.style.setProperty('height','auto','important');
  strongNode.style.setProperty('margin','0','important');
 }
 if(unknown){
  const strong=node.querySelector('strong');
  if(strong)strong.textContent='—';
 }
 return node;
}
const PUBLIC_GROUPS=Object.freeze([
 // Weekdays and special weekdays use different AirWAIT IDs. Never silently fall back
 // to tall legacy cards merely because a verified public slot is not a weekend ID.
 {title:'すぐ入場',web:null,line:'0023',forecast:false},
 {title:'10:00の回',web:'0024',line:null,forecast:false},
 {title:'14:00の回',web:'0027',line:'0025',forecast:false},
 {title:'10:00の回',web:'0036',line:'0035',forecast:false},
 {title:'13:30の回',web:'0038',line:'0037',forecast:false},
 {title:'10:00の回',web:'0030',line:'0029'},
 {title:'12:30の回',web:'0032',line:'0031'},
 {title:'15:00の回',web:'0034',line:'0033'}
]);
function publicGroupLabels(lang){
 return ({ja:['混雑予想','WEB受付','LINE・現地受付','未公開','受付枠'],en:['Crowd forecast','WEB check-in','LINE / On-site','Not published','Time'], 'zh-CN':['拥挤预测','WEB取号','LINE／现场','未公开','时段'],ko:['혼잡 예상','WEB 접수','LINE·현장','미공개','시간'],vi:['Dự báo đông','WEB','LINE / Tại chỗ','Chưa mở','Giờ'],ne:['भीड अनुमान','वेब','LINE/स्थल','खुलेको छैन','समय'],kmr:['Pêşbîniya qelebalixiyê','WEB','LINE / li cihê','Nehatiye vekirin','Dem']})[lang]||['Crowd forecast','WEB','LINE / On-site','Not published','Time'];
}
function publicCount(slot){return slot?.remainingVerified===true&&Number.isSafeInteger(slot.remaining)&&slot.remaining>=0&&slot.remaining<=350?slot.remaining:null}
function publicTime(name){const m=String(name||'').match(/(\d{1,2})時(?:(半)|([0-5]?\d)分)?/);return m?String(Number(m[1])).padStart(2,'0')+':'+String(m[2]?30:Number(m[3]||0)).padStart(2,'0'):''}
function publicChannel(slot,source,label){
 const cell=elem('div','v615-channel'+(!slot?' is-unpublished':''));
 cell.appendChild(elem('span','v615-channel-name',label));
 const num=publicCount(slot);
 const unit=({ja:'人',en:' people','zh-CN':'人',vi:' người',ne:' जना',ko:'명',kmr:' kes'})[language()]||'人';
 cell.appendChild(elem('strong','v615-channel-count',num===null?'—':num+unit));
 if(slot){
  const action=source?.querySelector('.v38-crowd-tap-hint > :is(a,button,small)');
  if(action){const clone=action.cloneNode(true);clone.classList.add('v615-channel-action');
   const lang=language(),online=slot.usageDispType==='KeyONLINE_RECEPTION_ONLY';
   const translations={
    ja:['WEBで受付する ↗','LINEで受付を確認 →'],
    en:['Get a WEB ticket ↗','Check LINE tickets →'],
    'zh-CN':['网页领取号码 ↗','查看LINE取号 →'],
    vi:['Lấy số qua WEB ↗','Kiểm tra LINE →'],
    ne:['WEB टिकट लिनुहोस् ↗','LINE टिकट जाँच्नुहोस् →'],
    ko:['WEB에서 접수 ↗','LINE 접수 확인 →'],
    kmr:['Li WEBê hejmar bistîne ↗','Hejmarên LINE kontrol bike →']
   };
   // Non-actionable labels (e.g. 'この枠は満員です') must never turn into a false booking CTA.
   if(clone.matches('a[href],button:not([disabled])')){
    const text=(translations[lang]||translations.ja)[online?0:1];
    clone.textContent=text;clone.setAttribute('aria-label',text);
   }
   else if(clone.matches('small,span')){clone.textContent=window.ASOBOON_I18N?.t?.(clone.textContent.trim())||clone.textContent}
   cell.appendChild(clone)}
 }
 return cell;
}
function buildPublicBoard(){
 const slots=document.getElementById('v38Slots');if(!slots)return;
 const data=window.ASOBOON_PUBLIC_RECEPTION_STATUS;
 const list=slots.querySelector(':scope > .v38-crowd-list');
 const existing=slots.querySelector('#v615SessionBoard');
 if(data?.verified!==true||!list){existing?.remove();slots.classList.remove('v615-public-ready');return}
 const ordered=[...(Array.isArray(data.slots)?data.slots:[])].filter(x=>['KeyONLINE_RECEPTION_ONLY','KeySTORE_RECEPTION_ONLY'].includes(x?.usageDispType))
   .sort((a,b)=>(a.usageDispType==='KeyONLINE_RECEPTION_ONLY'?0:1)-(b.usageDispType==='KeyONLINE_RECEPTION_ONLY'?0:1));
 const ids=new Set(PUBLIC_GROUPS.flatMap(g=>[g.web,g.line]));
 // On weekdays or if AirWAIT introduces an unrecognized slot, show the
 // native verified list instead of silently omitting a published option.
 if(!ordered.length||ordered.some(x=>!ids.has(String(x.waitTypeId)))){existing?.remove();slots.classList.remove('v615-public-ready');return}
 const cards=[...list.querySelectorAll(':scope > .v38-crowd-card')];
 if(cards.length!==ordered.length){existing?.remove();slots.classList.remove('v615-public-ready');return}
 const lang=language(),labels=publicGroupLabels(lang);
 const signature=JSON.stringify([lang,data.fetchedAt,ordered.map(x=>[x.waitTypeId,x.remaining,x.remainingVerified,x.waitTypeName]),cards.map(x=>x.textContent)]);
 if(existing?.dataset.signature===signature){slots.classList.add('v615-public-ready');return}
 const map=new Map(ordered.map((x,i)=>[String(x.waitTypeId),{slot:x,source:cards[i]}]));
 const board=elem('section','v615-session-board');board.id='v615SessionBoard';board.dataset.signature=signature;board.setAttribute('aria-label',labels[0]);
 for(const group of PUBLIC_GROUPS){
  const a=map.get(group.web),b=map.get(group.line);
  // AirWAIT removed both slots: do not show a ghost session.
  if(!a&&!b)continue;
  const web=publicCount(a?.slot),line=publicCount(b?.slot);
  const pct=group.forecast===false||web===null||line===null||web+line>320?null:Math.max(0,Math.min(100,Math.round((320-web-line)/320*100)));
  const card=elem('article','v615-session');
  const head=elem('div','v615-session-head');
  const groupTitle=group.title==='すぐ入場'?(lang==='ja'?'すぐ入場':({en:'Walk-in', 'zh-CN':'即时入场',vi:'Vào ngay',ne:'तुरुन्त प्रवेश',ko:'바로 입장',kmr:'Têketina rasterast'}[lang]||group.title)):lang==='ja'?group.title:group.title.replace('の回','');
  head.appendChild(elem('strong','v615-session-title',groupTitle));
  const forecast=elem('div','v615-session-forecast');
  forecast.appendChild(elem('span','v615-forecast-label',labels[0]));
  forecast.appendChild(elem('strong','v615-forecast-value',pct===null?'—':pct+'%'));
  head.appendChild(forecast);card.appendChild(head);
  const progress=elem('div','v615-forecast-track');progress.setAttribute('aria-hidden','true');
  const fill=elem('span','v615-forecast-fill');fill.style.width=(pct===null?0:pct)+'%';progress.appendChild(fill);card.appendChild(progress);
  const cells=elem('div','v615-channels');
  if(a)cells.appendChild(publicChannel(a.slot,a.source,labels[1]));
  if(b)cells.appendChild(publicChannel(b.slot,b.source,labels[2]));
  if(!a||!b)cells.classList.add('v615-single-channel');
  card.appendChild(cells);board.appendChild(card);
 }
 existing?.remove();slots.insertBefore(board,list);slots.classList.add('v615-public-ready');
}
function renderRetryState(){
 const intro=document.querySelector('#v58Primary .v58-intro'),flow=document.querySelector('#v58Flow');if(!intro||!flow)return;
 const state=flow.dataset.state,prior=intro.querySelector('#v615RetryStatus');
 if(state!=='error'&&state!=='pending'){prior?.remove();return}
 const receipt=String(window.ASOBOON_HOME_STATUS_SNAPSHOT?.receipt||'').trim();
 const kind=receipt?'call':'public';
 if(prior?.dataset.kind===kind)return;
 const shell=prior||elem('div','v615-retry-state');shell.id='v615RetryStatus';shell.dataset.kind=kind;
 shell.textContent='';
 shell.appendChild(elem('span','v615-retry-label',receipt?'受付番号は保存されています。自動で再確認中です。':'最新の受付枠を自動で再確認しています。'));
 const button=elem('button','v615-retry-button','今すぐ再確認 ↻');button.type='button';button.dataset.v615Retry=kind;shell.appendChild(button);
 if(!prior)intro.appendChild(shell);
}
function buildBoard(){
 const slots=document.getElementById('v38Slots');if(!slots)return;
 // The public AirWAIT-selectable list owns its own live display. Never
 // rebuild stale compact rows or hide the actual booking link.
 if(window.ASOBOON_PUBLIC_RECEPTION_STATUS!==undefined){
  slots.classList.remove('v613-board-ready');
  slots.querySelector('#v613Board')?.remove();
  buildPublicBoard();
  return;
 }
 const list=slots.querySelector(':scope > .v38-crowd-list');
 if(!list){slots.classList.remove('v613-board-ready');slots.querySelector('#v613Board')?.remove();return}
 const cards=[...list.querySelectorAll(':scope > .v38-crowd-card')];
 if(!cards.length)return;
 const lang=language(),labels=L[lang]||L.ja;
 const cache=(()=>{try{const x=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');return Number(x?.savedAt||0)}catch{return 0}})();
 const signature=[lang,cache,cards.map(x=>x.textContent.replace(/\s+/g,' ').trim()).join('|')].join('::');
 const existing=slots.querySelector('#v613Board');
 if(existing?.dataset.signature===signature)return;
 const board=elem('section','v613-board');board.id='v613Board';board.dataset.signature=signature;
 const grid=elem('div','v613-grid');grid.setAttribute('role','table');grid.setAttribute('aria-label',labels.join(' / '));
 const header=elem('div','v613-header');header.setAttribute('role','row');
 for(const title of labels.slice(0,4)){const col=elem('span','v613-header-cell',title);col.setAttribute('role','columnheader');header.appendChild(col)}
 grid.appendChild(header);
 for(const card of cards){
  const rawTime=card.querySelector('time')?.textContent?.trim()||'—';
  const time=rawTime.match(/\d{1,2}:\d{2}/)?.[0]||rawTime;
  const pct=trustedBooked(card);
  const row=elem('div','v613-row');row.setAttribute('role','row');
  const gauge=elem('div','v613-cell v613-gauge');gauge.setAttribute('role','cell');
  gauge.appendChild(elem('strong','v613-percent',pct===null?'—':pct+'%'));
  const track=elem('span','v613-track');track.setAttribute('aria-hidden','true');
  const bar=elem('span','v613-bar'+(pct>=100?' is-busy':''));bar.style.width=(pct===null?0:Math.min(100,pct))+'%';track.appendChild(bar);gauge.appendChild(track);
  const timeCell=elem('div','v613-cell v613-time',time);timeCell.setAttribute('role','cell');
  row.append(gauge,timeCell);
  const channels=[card.querySelector('.v38-crowd-channel--web'),card.querySelector('.v38-crowd-channel--onsite')];
  for(const channel of channels){const cell=elem('div','v613-cell v613-channel');cell.setAttribute('role','cell');cell.appendChild(cloneAction(channel,!!channel?.querySelector('.v38-crowd-unknown')));row.appendChild(cell)}
  grid.appendChild(row);
 }
 board.appendChild(grid);
 const hasUnknown=cards.some(x=>trustedBooked(x)===null);
 board.appendChild(elem('p','v613-footnote',hasUnknown?labels[5]:labels[4]));
 existing?.remove();slots.insertBefore(board,list);slots.classList.add('v613-board-ready');
}
function apply(){
 const shell=document.getElementById('v58Flow'),primary=document.getElementById('v58Primary');
 const day=document.getElementById('v58DayZone'),sessions=document.getElementById('v58SessionsZone');
 if(shell&&primary&&day&&sessions){
  if(shell.firstElementChild!==day)shell.insertBefore(day,shell.firstElementChild);
  if(day.nextElementSibling!==sessions)shell.insertBefore(sessions,day.nextSibling);
 }
 const fold=document.getElementById('v59SlotsFold');
 if(fold&&!fold.open)fold.open=true;
 translateBusiness();buildBoard();renderRetryState();
}
let pending=false;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply()})}
let lastPublicRetry=0;
root.addEventListener('click',e=>{
 if(!e.target?.closest?.('#v615RetrySlots'))return;
 if(Date.now()-lastPublicRetry<15000){e.stopImmediatePropagation();return}
 lastPublicRetry=Date.now();
},true);
root.addEventListener('click',e=>{
 const button=e.target?.closest?.('[data-v615-retry]');if(!button)return;
 if(button.disabled)return;
 button.disabled=true;button.textContent='確認しています…';
 if(button.dataset.v615Retry==='call'){window.ASOBOON_V13_HOME_STATUS?.refresh?.()}
 else document.querySelector('#v615RetrySlots')?.click();
 setTimeout(()=>{if(button.isConnected){button.disabled=false;button.textContent='今すぐ再確認 ↻'}},9000);
});
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
for(const event of ['asoboon:language-changed','asoboon:v8-home-status','asoboon:v2-route-rendered'])window.addEventListener(event,schedule);
schedule();
window.ASOBOON_HOME_FORECAST=Object.freeze({version:'6.14',basePeople:320,method:'remaining-proxy',bookedVerifiedOnly:false});
})();
