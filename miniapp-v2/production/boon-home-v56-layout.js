/*
 * BOON START HOME v5.6 — structural redesign of four existing UI controls.
 * Presentation-only. Moves DOM nodes instead of creating new booking actions.
 * Call/WEB reception/processing remain owned by the original app.
 */
(function(){
'use strict';
if(window.ASOBOON_MINT_V51_PREVIEW!==true)return;
const root=document.getElementById('app');
if(!root)return;
const copyByLang={
 ja:{heading:'今日のASOBooN',intro:'必要なことを、ここでサッと確認。',call:'呼出状況をチェック',callSub:'受付番号・待ち順・入場案内',callTag:'01 / 呼出状況',todayTag:'02 / 今日の営業',timerTag:'03 / あそべる時間',crowdTag:'04 / 本日の混雑状況',crowdTitle:'時間帯ごとの受付状況',crowdSub:'各回の残り人数と受付方法を確認'},
 en:{heading:'Your ASOBooN today',intro:'Everything you need, at a glance.',call:'Check your queue',callSub:'Ticket · queue · entry',callTag:'01 / QUEUE',todayTag:'02 / TODAY',timerTag:'03 / PLAY TIME',crowdTag:'04 / SESSION AVAILABILITY',crowdTitle:'Spaces by session',crowdSub:'Check remaining spaces and reception options'},
 'zh-CN':{heading:'今日的ASOBooN',intro:'一眼查看所需信息',call:'查看叫号状态',callSub:'取号号码·排队·入场',callTag:'01 / 叫号',todayTag:'02 / 今日营业',timerTag:'03 / 游玩时间',crowdTag:'04 / 余量',crowdTitle:'各场次余量',crowdSub:'查看剩余人数及取号方式'},
 vi:{heading:'ASOBooN hôm nay',intro:'Mọi thông tin trong một màn hình',call:'Kiểm tra lượt gọi',callSub:'Số vé · xếp hàng · vào cửa',callTag:'01 / LƯỢT GỌI',todayTag:'02 / HÔM NAY',timerTag:'03 / GIỜ CHƠI',crowdTag:'04 / CHỖ TRỐNG',crowdTitle:'Số chỗ theo lượt',crowdSub:'Xem chỗ trống và cách đăng ký'},
 ne:{heading:'आजको ASOBooN',intro:'आवश्यक जानकारी एकै ठाउँमा',call:'पालो जाँच्नुहोस्',callSub:'टिकट · पालो · प्रवेश',callTag:'01 / पालो',todayTag:'02 / आज',timerTag:'03 / खेल्ने समय',crowdTag:'04 / उपलब्धता',crowdTitle:'प्रत्येक पालोको बाँकी ठाउँ',crowdSub:'ठाउँ र दर्ता तरिका हेर्नुहोस्'},
 ko:{heading:'오늘의 ASOBooN',intro:'필요한 정보를 한눈에',call:'호출 현황 확인',callSub:'접수번호 · 대기 · 입장',callTag:'01 / 호출',todayTag:'02 / 오늘',timerTag:'03 / 이용시간',crowdTag:'04 / 남은 인원',crowdTitle:'시간대별 접수 현황',crowdSub:'남은 인원과 접수 방법을 확인'},
 kmr:{heading:'ASOBooN îro',intro:'Hemî agahiyên girîng li vir in',call:'Rêza bangkirinê bibîne',callSub:'Bilêt · rêz · ketin',callTag:'01 / RÊZ',todayTag:'02 / ÎRO',timerTag:'03 / DEM',crowdTag:'04 / CIHÊN MAYÎ',crowdTitle:'Cihên mayî li her demê',crowdSub:'Cihên mayî û awayê qeydkirinê bibîne'}
};
const locale=()=>String(window.ASOBOON_I18N?.language||document.documentElement.lang||'ja');
const dictionary=()=>copyByLang[locale()]||copyByLang.en;
const element=(name,className,text)=>{
 const e=document.createElement(name);e.className=className;
 if(text!=null)e.textContent=text;
 return e;
};
const label=(className,text)=>{
 const e=element('span',className,text);e.setAttribute('aria-hidden','true');return e;
};
const assignText=(node,text)=>{if(node&&node.textContent!==text)node.textContent=text;};
function mount(){
 if(new URLSearchParams(location.search).get('view')&&new URLSearchParams(location.search).get('view')!=='home')return;
 const home=root.querySelector('.v38-home');
 const hero=home?.querySelector('#v38Hero');
 const day=home?.querySelector('#v38Today');
 const timer=home?.querySelector('#v38TimeguideShortcut');
 const crowd=home?.querySelector('#v38Slots');
 if(!home||!hero||!day||!timer||!crowd)return;
 const t=dictionary();
 let deck=home.querySelector(':scope > #v56CommandDeck');
 if(!deck){
  deck=element('section','v56-command-deck');
  deck.id='v56CommandDeck';
  deck.setAttribute('aria-label','ASOBooN HOME');
  const mast=element('header','v56-deck-heading');
  mast.appendChild(label('v56-eyebrow','ASOBooN / CONTROL DECK'));
  mast.appendChild(element('h2','v56-heading-title'));
  mast.appendChild(element('p','v56-heading-sub'));
  deck.appendChild(mast);
  const call=element('section','v56-queue-tile');call.id='v56QueueTile';
  call.appendChild(label('v56-tile-tag',''));
  call.appendChild(element('div','v56-queue-slot'));
  deck.appendChild(call);
  const tiles=element('div','v56-utility-grid');
  const dayTile=element('section','v56-day-tile');dayTile.id='v56DayTile';
  dayTile.appendChild(label('v56-tile-tag',''));
  const timerTile=element('section','v56-timer-tile');timerTile.id='v56TimerTile';
  timerTile.appendChild(label('v56-tile-tag',''));
  tiles.appendChild(dayTile);tiles.appendChild(timerTile);
  deck.appendChild(tiles);
  hero.insertAdjacentElement('afterend',deck);
 }
 const callSlot=deck.querySelector('.v56-queue-slot');
 const originalCall=hero.querySelector('.v38-call-cta');
 if(originalCall){
  if(callSlot.firstElementChild!==originalCall)callSlot.replaceChildren(originalCall);
 }
 const dayTile=deck.querySelector('#v56DayTile');
 const timerTile=deck.querySelector('#v56TimerTile');
 if(day.parentElement!==dayTile)dayTile.appendChild(day);
 if(timer.parentElement!==timerTile)timerTile.appendChild(timer);
 deck.querySelector('#v56QueueTile').hidden=!callSlot.firstElementChild;
 // The native HOME source may update #v38Slots; its refresh/data bindings remain intact.
 let crowdStage=home.querySelector(':scope > #v56CrowdStage');
 if(!crowdStage){
  crowdStage=element('section','v56-crowd-stage');
  crowdStage.id='v56CrowdStage';
  const crowdTop=element('header','v56-crowd-top');
  crowdTop.appendChild(label('v56-crowd-tag',''));
  crowdTop.appendChild(element('h2','v56-crowd-title'));
  crowdTop.appendChild(element('p','v56-crowd-sub'));
  crowdStage.appendChild(crowdTop);
  deck.insertAdjacentElement('afterend',crowdStage);
 }
 if(crowd.parentElement!==crowdStage)crowdStage.appendChild(crowd);
 const call=callSlot.querySelector('.v38-call-cta');
 if(call){
  const text=call.querySelector('.v38-call-cta-copy strong');
  const sub=call.querySelector('.v38-call-cta-copy small');
  assignText(text,t.call);
  assignText(sub,t.callSub);
  const aria=t.call+' · '+t.callSub;
  if(call.getAttribute('aria-label')!==aria)call.setAttribute('aria-label',aria);
 }
 assignText(deck.querySelector('.v56-heading-title'),t.heading);
 assignText(deck.querySelector('.v56-heading-sub'),t.intro);
 assignText(deck.querySelector('#v56QueueTile .v56-tile-tag'),t.callTag);
 assignText(dayTile.querySelector('.v56-tile-tag'),t.todayTag);
 assignText(timerTile.querySelector('.v56-tile-tag'),t.timerTag);
 assignText(crowdStage.querySelector('.v56-crowd-tag'),t.crowdTag);
 assignText(crowdStage.querySelector('.v56-crowd-title'),t.crowdTitle);
 assignText(crowdStage.querySelector('.v56-crowd-sub'),t.crowdSub);
 home.classList.add('v56-command-home');
}
let pending=false;
function request(){
 if(pending)return;
 pending=true;
 setTimeout(()=>{pending=false;mount();},0);
}
new MutationObserver(request).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
window.addEventListener('asoboon:language-changed',request);
window.addEventListener('asoboon:v2-route-rendered',request);
window.addEventListener('popstate',request);
request();
window.BOON_HOME_V56=Object.freeze({version:'5.6.0-deck',presentationOnly:true});
})();