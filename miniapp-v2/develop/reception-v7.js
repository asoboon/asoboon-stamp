(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;
let obs=null;
const qs=()=>new URLSearchParams(location.search);
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
function currentView(){return String(qs().get('view')||'home')}
function isDevTools(){return qs().get('dev')==='1'}
function methodIcon(kind){if(kind==='onsite')return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2" stroke="currentColor" stroke-width="2"/></svg>';return '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 9h10M7 13h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'}
function ensureHead(){const head=root.querySelector('.page-head');if(!head)return;setText(head.querySelector('small'),'ASOBooN');setText(head.querySelector('h2'),'受付');if(!head.querySelector('.rv7-head-note'))head.insertAdjacentHTML('beforeend','<div class="rv7-head-note">利用する回と人数を選んで、内容を確認してください。</div>')}
function ensureProgress(){const wrap=root.querySelector('.rec-wrap');if(!wrap||wrap.querySelector('.rv7-progress'))return;wrap.insertAdjacentHTML('afterbegin','<div class="rv7-progress" aria-label="受付の流れ"><div class="rv7-step active" data-rv7-step="1"><b>1</b><span>利用する回</span></div><div class="rv7-step" data-rv7-step="2"><b>2</b><span>人数</span></div><div class="rv7-step" data-rv7-step="3"><b>3</b><span>確認</span></div></div>')}
function ensureConfirmLabel(){const summary=root.querySelector('.rec-summary');if(!summary)return;if(summary.previousElementSibling?.classList?.contains('rv7-confirm-label'))return;summary.insertAdjacentHTML('beforebegin','<div class="rv7-confirm-label"><b>3</b><span>内容を確認</span></div>')}
function replaceMethodIcons(){root.querySelectorAll('.rec-method').forEach(btn=>{const span=btn.querySelector(':scope > span:first-child');if(!span||span.dataset.rv7Icon==='1')return;span.dataset.rv7Icon='1';span.innerHTML=methodIcon(btn.classList.contains('onsite')?'onsite':'web')})}
function cleanLabels(){setText(root.querySelector('#recWeb strong'),'LINE受付');setText(root.querySelector('#recOnsite strong'),'現地受付');const titles=root.querySelectorAll('.rec-title');setText(titles[0],'ご利用の回');setText(titles[1],'ご利用人数')}
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
   else if(/Developing|入場不可テスト/.test(t))setText(status,root.querySelector('.rec-day strong')?.textContent==='休館'?'本日は休館日です。':'受付できます。');
 }
 const loc=root.querySelector('#recLocationText');if(loc&&!dev&&/500m以内|精度/.test(String(loc.textContent||'')))setText(loc,'現地受付では、ASOBooN付近にいることを現在地で確認します。');
 const agree=root.querySelector('.rec-agree span');if(agree&&!dev)setText(agree,'受付内容を確認しました。受付ボタンは一度だけ押してください。');
 /* DevelopingではGatewayから返された利用可能枠をそのまま選択可能にする。
    以前ここで0042を通常表示から隠していたため、テスト枠しかない場合に「利用する回」が選べなくなっていた。 */
 root.querySelectorAll('.rec-slot').forEach(btn=>{if(btn.hidden)btn.hidden=false});
 const submit=root.querySelector('#recSubmit');if(submit&&!dev&&/受付確定（確認待ち）/.test(String(submit.textContent||'')))setText(submit,'受付の準備中…');
}
function progressState(){const selected=Boolean([...root.querySelectorAll('.rec-slot.active')].find(x=>!x.hidden));const peopleOk=Boolean(root.querySelector('#recPeopleMsg.ok'));const agree=Boolean(root.querySelector('#recAgree:checked'));const steps=[...root.querySelectorAll('[data-rv7-step]')];steps.forEach(x=>x.classList.remove('active','done'));if(!selected){steps[0]?.classList.add('active');return}steps[0]?.classList.add('done');if(!peopleOk){steps[1]?.classList.add('active');return}steps[1]?.classList.add('done');steps[2]?.classList.add(agree?'done':'active')}
function patch(){if(currentView()!=='reception'){document.body.classList.remove('v7-reception-active','dev-tools');return}const page=root.querySelector('.page-card');if(!page)return;document.body.classList.add('v7-reception-active');document.body.classList.toggle('dev-tools',isDevTools());setText(document.querySelector('.brand small'),'川口ハイウェイオアシス');ensureHead();ensureProgress();ensureConfirmLabel();replaceMethodIcons();cleanLabels();cleanCustomerCopy();progressState()}
function start(){obs=new MutationObserver(()=>queueMicrotask(patch));obs.observe(root,{subtree:true,childList:true,characterData:true});root.addEventListener('change',()=>queueMicrotask(progressState),true);root.addEventListener('click',()=>setTimeout(progressState,0),true);patch();setTimeout(patch,50);setTimeout(patch,300)}
start();
})();
