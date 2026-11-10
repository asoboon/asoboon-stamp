(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;
let obs=null;
const qs=()=>new URLSearchParams(location.search);
const setText=(el,text)=>{if(!el)return;const localized=window.ASOBOON_I18N?.t(String(text))||text;if(el.textContent!==text&&el.textContent!==localized)el.textContent=text};
function currentView(){return String(qs().get('view')||'home')}
function isDevTools(){return qs().get('dev')==='1'}
function methodIcon(kind){if(kind==='onsite')return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2" stroke="currentColor" stroke-width="2"/></svg>';return '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 9h10M7 13h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'}
function ensureHead(){const head=root.querySelector('.page-head');if(!head)return;setText(head.querySelector('small'),'ASOBooN');setText(head.querySelector('h2'),'LINE当日受付');if(!head.querySelector('.rv7-head-note'))head.insertAdjacentHTML('beforeend','<div class="rv7-head-note">利用する回と人数を選んでください。</div>')}
function ensureSingleProgress(){
 const wizard=window.ASOBOON_MINT_V51_PREVIEW===true;
 document.body.classList.toggle('v7-reception-fallback',!wizard);
 if(wizard){
  // The official HOME already uses the accessible v51 three-stage wizard.
  root.querySelectorAll('.rv7-progress,.rv7-confirm-label,.rv7-consent-label').forEach(el=>el.remove());
  return;
 }
 // The noindex /production/index.html diagnostic route must also have a single
 // three-stage progress control, even when the official v51 wizard is not loaded.
 root.querySelectorAll('.rv7-confirm-label,.rv7-consent-label').forEach(el=>el.remove());
 const wrap=root.querySelector('.rec-wrap');if(!wrap)return;
 if(!wrap.querySelector('.rv7-progress'))wrap.insertAdjacentHTML('afterbegin',
  '<nav class="rv7-progress" aria-label="受付の3つの手順">'
  +'<button class="rv7-step" type="button" data-rv7-step="1"><b>1</b><span>利用する回</span></button>'
  +'<button class="rv7-step" type="button" data-rv7-step="2"><b>2</b><span>人数</span></button>'
  +'<button class="rv7-step" type="button" data-rv7-step="3"><b>3</b><span>確認・同意</span></button></nav>');
 const selected=Boolean(wrap.querySelector('.rec-slot.active:not([hidden])'));
 const valid=Boolean(wrap.querySelector('#recPeopleMsg.ok'));
 const current=selected?(valid?3:2):1;
 wrap.querySelectorAll('[data-rv7-step]').forEach(node=>{
  const index=Number(node.dataset.rv7Step);
  node.classList.toggle('done',index<current);
  node.classList.toggle('active',index===current);
  if(index===current)node.setAttribute('aria-current','step');
  else node.removeAttribute('aria-current');
 });
}
function replaceMethodIcons(){root.querySelectorAll('.rec-method').forEach(btn=>{const span=btn.querySelector(':scope > span:first-child');if(!span||span.dataset.rv7Icon==='1')return;span.dataset.rv7Icon='1';span.innerHTML=methodIcon(btn.classList.contains('onsite')?'onsite':'web')})}
function cleanLabels(){setText(root.querySelector('#recWeb strong'),'LINE受付');setText(root.querySelector('#recOnsite strong'),'LINE受付');const titles=root.querySelectorAll('.rec-title');setText(titles[0],'ご利用の回');setText(titles[1],'ご利用人数')}
function cleanCustomerCopy(){
 const dev=isDevTools();
 // A valid party size is not a confirmed, or even an available, reception slot.
 const peopleMessage=root.querySelector('#recPeopleMsg');
 if(peopleMessage?.classList.contains('ok')&&peopleMessage.textContent.trim()==='この人数で受付できます。')setText(peopleMessage,'人数の条件は満たしています。');
 const status=root.querySelector('#recStatus');
 if(status&&!dev){
   const t=String(status.textContent||'');
   if(/LINE接続|営業カレンダー|受付枠を確認しています/.test(t))setText(status,'受付できる内容を確認しています…');
   else if(/LINE本人確認・営業日・Gateway接続を確認しました/.test(t))setText(status,'受付できます。');
   else if(/受付枠を取得できません|Gateway|新Gateway/.test(t))setText(status,'受付情報を確認できませんでした。もう一度開き直してお試しください。');
   else if(/受付に必要な確認が完了していない/.test(t))setText(status,'ただいま受付を確定できません。しばらくしてからもう一度お試しください。');
   else if(/AirWAITへ受付を送信しています/.test(t))setText(status,'受付しています…');
   else if(/現在受付できる枠がありません|受付停止中/.test(t))setText(status,'現在受付できる枠がありません。最新の受付状況をご確認ください。');
   else if(/Developing|入場不可テスト/.test(t))setText(status,root.querySelector('.rec-day strong')?.textContent==='休館'?'本日は休館日です。':'受付できます。');
 }
 const loc=root.querySelector('#recLocationText');if(loc&&!dev&&/500m以内|精度/.test(String(loc.textContent||'')))setText(loc,'LINE受付では、ASOBooN付近にいることを現在地で確認します。');
 const agree=root.querySelector('.rec-agree span');if(agree&&!dev)setText(agree,'受付内容とご利用にあたっての案内を確認しました。受付ボタンは一度だけ押してください。');
 const submit=root.querySelector('#recSubmit');if(submit&&!dev&&/受付確定（確認待ち）/.test(String(submit.textContent||'')))setText(submit,'受付の準備中…');
}
function patch(){if(currentView()!=='reception'){document.body.classList.remove('v7-reception-active','v7-reception-fallback','dev-tools');return}const page=root.querySelector('.page-card');if(!page)return;document.body.classList.add('v7-reception-active');document.body.classList.toggle('dev-tools',isDevTools());setText(document.querySelector('.brand small'),'川口ハイウェイオアシス');ensureHead();ensureSingleProgress();replaceMethodIcons();cleanLabels();cleanCustomerCopy()}
function start(){
 obs=new MutationObserver(()=>queueMicrotask(patch));
 obs.observe(root,{subtree:true,childList:true,characterData:true});
 root.addEventListener('click',event=>{
  const tab=event.target?.closest?.('[data-rv7-step]');
  if(!tab||window.ASOBOON_MINT_V51_PREVIEW===true)return;
  const target={1:'.rec-slots',2:'.rec-people',3:'.rec-summary'}[tab.dataset.rv7Step];
  const dest=target&&root.querySelector(target);
  if(dest){dest.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
   dest.setAttribute('tabindex','-1');dest.focus({preventScroll:true})}
 },true);
 patch();setTimeout(patch,50);setTimeout(patch,300)
}
start();
})();
