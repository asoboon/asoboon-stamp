/* ASOBooN HOME v6.13 — read-only forecast/availability presentation. */
(()=>{'use strict';
if(new URLSearchParams(location.search).get('boonTheme')==='classic')return;
const root=document.getElementById('app');if(!root)return;
const CACHE_KEY='asoboon_v2_crowd_snapshot_production_v1';
const L={
 ja:['混雑予想','入場回','WEB残り','LINE残り','※予約人数からの予想です。実際と異なる場合があります。','※予約人数ベース。「—」は未確認です。'],
 en:['Crowd forecast','Entry','WEB left','LINE left','Estimate: bookings ÷ 320. Actual crowd may differ due to cancellations.','— means booking count is unavailable.'],
 'zh-CN':['拥挤预测','入场场次','WEB剩余','LINE剩余','估算值：预约人数÷320。实际拥挤程度可能因取消而不同。','— 表示无法确认预约人数。'],
 ko:['혼잡 예상','입장 회차','WEB 잔여','LINE 잔여','예상치: 예약 인원÷320. 취소 등에 따라 실제 혼잡도는 다를 수 있습니다.','—는 예약 인원을 확인할 수 없다는 뜻입니다.'],
 vi:['Dự báo đông','Lượt vào','WEB còn','LINE còn','Ước tính: số người đăng ký ÷ 320. Thực tế có thể khác vì hủy lượt.','—: chưa xác nhận số người đăng ký.'],
 ne:['भीड अनुमान','प्रवेश समय','WEB बाँकी','LINE बाँकी','अनुमान: दर्ता भएका मानिस ÷ 320। रद्द हुँदा वास्तविक भीड फरक हुन सक्छ।','—: दर्ता संख्या उपलब्ध छैन।'],
 kmr:['Pêşbîniya qelebalixiyê','Dema ketinê','WEB mayî','LINE mayî','Texmîn: kesên tomarbûyî ÷ 320. Bi betalkirinê dikare biguhere.','—: hejmara tomarkiriyan nayê piştrastkirin.']
};
const days={
 en:['Sat/Sun/holiday','Special weekday','Weekday','Monday','2h 30m limit','3h limit','No time limit'],
 'zh-CN':['周末及节假日','特别平日','平日','周一','限时2小时30分','限时3小时','不限时'],
 ko:['주말·공휴일','특정 평일','평일','월요일','2시간 30분 제한','3시간 제한','시간 무제한'],
 vi:['Cuối tuần/ngày lễ','Ngày thường đặc biệt','Ngày thường','Thứ Hai','Giới hạn 2 giờ 30 phút','Giới hạn 3 giờ','Không giới hạn'],
 ne:['सप्ताहान्त/बिदा','विशेष कार्यदिन','कार्यदिन','सोमबार','२ घण्टा ३० मिनेट','३ घण्टा','समय सीमा छैन'],
 kmr:['Dawiya hefteyê/cejn','Roja taybet a hefteyê','Roja hefteyê','Duşem','2 saet 30 xulek','3 saet','Bê sînor']
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
  if(!node.dataset.v613Original||
      (actual!==lastRendered&&/(?:土日祝|土休日|平日|月曜|2時間30分|3時間|無制限)/.test(actual))){
   node.dataset.v613Original=actual;
  }
  const jp=node.dataset.v613Original||actual;
  let display=jp;
  if(lang!=='ja'&&dict){
   if(i===0){
    const names=[['平日特定日',dict[1]],['土日祝',dict[0]],['土休日',dict[0]],['平日',dict[2]],['月曜',dict[3]]];
    for(const [from,to] of names)if(display.includes(from)){display=display.replace(from,to);break}
   }else{
    display=jp.includes('2時間30分')?dict[4]:jp.includes('3時間')?dict[5]:jp.includes('無制限')?dict[6]:jp;
   }
  }
  copyTo(node,display);
  node.dataset.v613Rendered=display;
 }
}
function trustedBooked(time){
 try{
  const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
  const age=Date.now()-Number(c?.savedAt||0);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(!c||!Array.isArray(c.slots)||!Number.isFinite(c.savedAt)||age<0||age>90000||String(c.operationalDate||'')!==today)return null;
  const matched=c.slots.filter(s=>s.slotKey===time);
  if(matched.length!==1)return null;
  const s=matched[0],n=s.bookedPeople;
  // Only an explicitly verified, person-unit booked count may drive a forecast.
  if(s.bookedPeopleVerified!==true||s.bookedPeopleUnit!=='PERSON'||!Number.isSafeInteger(n)||n<0||n>10000)return null;
  return Math.round(n/320*100);
 }catch{return null}
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
 if(strongNode){strongNode.style.setProperty('font-size','16px','important');strongNode.style.setProperty('line-height','1.2','important')}
 if(unknown){
  const strong=node.querySelector('strong');
  if(strong)strong.textContent='—';
 }
 return node;
}
function buildBoard(){
 const slots=document.getElementById('v38Slots');if(!slots)return;
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
  const pct=trustedBooked(time);
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
 const hasUnknown=cards.some(x=>trustedBooked(x.querySelector('time')?.textContent?.match(/\d{1,2}:\d{2}/)?.[0]||'')===null);
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
 translateBusiness();buildBoard();
}
let pending=false;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;apply()})}
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
for(const event of ['asoboon:language-changed','asoboon:v8-home-status','asoboon:v2-route-rendered'])window.addEventListener(event,schedule);
schedule();
window.ASOBOON_HOME_FORECAST=Object.freeze({version:'6.13',basePeople:320,bookedVerifiedOnly:true});
})();
