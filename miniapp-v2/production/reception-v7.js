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
function ensureProgress(){const wrap=root.querySelector('.rec-wrap');if(!wrap||wrap.querySelector('.rv7-progress'))return;wrap.insertAdjacentHTML('afterbegin','<nav class="rv7-progress" aria-label="受付手順を移動"><button type="button" class="rv7-step active" data-rv7-step="1"><b>1</b><span>利用する回</span></button><button type="button" class="rv7-step" data-rv7-step="2"><b>2</b><span>人数</span></button><button type="button" class="rv7-step" data-rv7-step="3"><b>3</b><span>内容確認</span></button><button type="button" class="rv7-step" data-rv7-step="4"><b>4</b><span>利用案内</span></button></nav>')}
function ensureConfirmLabel(){const summary=root.querySelector('.rec-summary');if(!summary)return;if(summary.previousElementSibling?.classList?.contains('rv7-confirm-label'))return;summary.insertAdjacentHTML('beforebegin','<div class="rv7-confirm-label"><b>3</b><span>内容を確認</span></div>')}
function ensureConsentLabel(){const section=root.querySelector('.rec-disclaimer');if(section&&!section.previousElementSibling?.classList?.contains('rv7-consent-label'))section.insertAdjacentHTML('beforebegin','<div class="rv7-consent-label"><b>4</b><span>利用案内を確認</span></div>')}
function replaceMethodIcons(){root.querySelectorAll('.rec-method').forEach(btn=>{const span=btn.querySelector(':scope > span:first-child');if(!span||span.dataset.rv7Icon==='1')return;span.dataset.rv7Icon='1';span.innerHTML=methodIcon(btn.classList.contains('onsite')?'onsite':'web')})}
function cleanLabels(){setText(root.querySelector('#recWeb strong'),'LINE受付');setText(root.querySelector('#recOnsite strong'),'LINE受付');const titles=root.querySelectorAll('.rec-title');setText(titles[0],'ご利用の回');setText(titles[1],'ご利用人数')}
function cleanCustomerCopy(){
 const dev=isDevTools();
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
function progressState(){const selected=Boolean([...root.querySelectorAll('.rec-slot.active')].find(x=>!x.hidden));const peopleOk=Boolean(root.querySelector('#recPeopleMsg.ok'));const agree=Boolean(root.querySelector('#recAgree:checked'));const steps=[...root.querySelectorAll('[data-rv7-step]')];steps.forEach(x=>{x.classList.remove('active','done');x.removeAttribute('aria-current')});if(!selected){steps[0]?.classList.add('active');steps[0]?.setAttribute('aria-current','step');return}steps[0]?.classList.add('done');if(!peopleOk){steps[1]?.classList.add('active');steps[1]?.setAttribute('aria-current','step');return}steps[1]?.classList.add('done');steps[2]?.classList.add(agree?'done':'active');if(agree)steps[3]?.classList.add('active');steps.forEach(x=>{if(x.classList.contains('active'))x.setAttribute('aria-current','step');else x.removeAttribute('aria-current')})}
function patch(){if(currentView()!=='reception'){document.body.classList.remove('v7-reception-active','dev-tools');return}const page=root.querySelector('.page-card');if(!page)return;document.body.classList.add('v7-reception-active');document.body.classList.toggle('dev-tools',isDevTools());setText(document.querySelector('.brand small'),'川口ハイウェイオアシス');ensureHead();ensureProgress();ensureConfirmLabel();ensureConsentLabel();replaceMethodIcons();cleanLabels();cleanCustomerCopy();progressState()}
function start(){obs=new MutationObserver(()=>queueMicrotask(patch));obs.observe(root,{subtree:true,childList:true,characterData:true});root.addEventListener('change',()=>queueMicrotask(progressState),true);root.addEventListener('click',event=>{const tab=event.target?.closest?.('[data-rv7-step]');if(tab){const target={1:'.rec-slots',2:'.rec-people',3:'.rec-summary',4:'.rec-disclaimer'}[tab.dataset.rv7Step];const dest=target&&root.querySelector(target);if(dest){dest.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});dest.setAttribute('tabindex','-1');dest.focus({preventScroll:true});return}}setTimeout(progressState,0)},true);patch();setTimeout(patch,50);setTimeout(patch,300)}
start();
})();
