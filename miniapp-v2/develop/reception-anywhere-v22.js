(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
const TEST_WAIT_TYPE_ID='0042';
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};

function ensureTestSection(){
  const slots=root.querySelector('#recSlots');
  if(!slots)return null;
  let section=root.querySelector('.v22-dev-test');
  if(!section){
    section=document.createElement('section');
    section.className='v22-dev-test';
    section.innerHTML='<div class="v22-dev-test-head"><span>🧪 DEVELOPING ONLY</span><h3>テスト受付</h3><p>実際のお客様向け受付ではありません。Developing環境の動作確認専用です。</p></div><div class="v22-dev-test-slot"></div><div class="v22-dev-test-note">本番ミニアプリには表示されません。</div>';
    const peopleTitle=[...root.querySelectorAll('.rec-title')].find(el=>/ご利用人数/.test(String(el.textContent||'')));
    if(peopleTitle)peopleTitle.insertAdjacentElement('beforebegin',section);
    else slots.insertAdjacentElement('afterend',section);
  }
  return section;
}

function moveTestSlot(){
  const section=ensureTestSection();
  if(!section)return null;
  const holder=section.querySelector('.v22-dev-test-slot');
  const current=root.querySelector('[data-rec-slot="0042"]');
  if(current&&current.parentElement!==holder)holder.appendChild(current);
  const test=holder?.querySelector('[data-rec-slot="0042"]')||null;
  if(test){
    test.hidden=false;
    test.style.removeProperty('display');
    test.classList.add('v22-test-slot');
    const strong=test.querySelector('strong');
    const small=test.querySelector('small');
    setText(strong,'入場不可テスト');
    setText(small,'0042 / Developing専用 AirWAITテスト枠');
  }
  section.hidden=!test;
  return test;
}

function patch(){queued=false;if(view()!=='reception')return;
 const web=root.querySelector('#recWeb'),onsite=root.querySelector('#recOnsite'),methods=root.querySelector('.rec-methods'),loc=root.querySelector('#recLocation'),status=root.querySelector('#recStatus'),dayLabel=String(root.querySelector('#recDay strong')?.textContent||'').trim(),plainWeekday=dayLabel==='平日',closed=dayLabel==='休館';
 if(onsite){onsite.hidden=true;onsite.style.display='none';onsite.setAttribute('aria-hidden','true');onsite.tabIndex=-1;onsite.disabled=true}
 if(loc){loc.hidden=true;loc.style.display='none';loc.setAttribute('aria-hidden','true')}
 if(methods)methods.classList.add('v22-anywhere-methods');

 if(web){
   web.classList.add('active','v22-anywhere');web.setAttribute('aria-current','true');
   const icon=web.querySelector(':scope > span:first-child'),strong=web.querySelector('strong'),small=web.querySelector('small');
   if(plainWeekday){
     if(icon&&icon.textContent!=='🏢')icon.textContent='🏢';
     if(strong&&strong.textContent!=='通常平日は現地受付')strong.textContent='通常平日は現地受付';
     if(small&&small.textContent!=='ASOBooN入口でご案内します。')small.textContent='ASOBooN入口でご案内します。';
   }else if(closed){
     if(icon&&icon.textContent!=='—')icon.textContent='—';
     if(strong&&strong.textContent!=='本日は休館日です')strong.textContent='本日は休館日です';
     if(small&&small.textContent!=='通常の受付は行っていません。')small.textContent='通常の受付は行っていません。';
   }else{
     if(icon&&icon.textContent!=='🌐')icon.textContent='🌐';
     if(strong&&strong.textContent!=='LINE受付')strong.textContent='LINE受付';
     if(small&&small.textContent!=='どこからでも受付できます。')small.textContent='どこからでも受付できます。';
   }
 }

 if(methods){
   let note=root.querySelector('.v22-anywhere-note');
   if(!note){methods.insertAdjacentHTML('afterend','<div class="v22-anywhere-note"><strong></strong><span></span></div>');note=root.querySelector('.v22-anywhere-note')}
   if(note){
     const strong=note.querySelector('strong'),span=note.querySelector('span');
     if(plainWeekday){
       setText(strong,'本日の実受付は現地です');
       setText(span,'9:30からASOBooN入口で受付します。LINE当日受付は対象日のみです。');
     }else if(closed){
       setText(strong,'本日は休館日です');
       setText(span,'通常の受付は行っていません。');
     }else{
       setText(strong,'現在地の確認は不要です');
       setText(span,'LINEミニアプリから、どこにいても受付できます。');
     }
   }
 }

 const test=moveTestSlot();
 const testSelected=Boolean(test&&test.classList.contains('active'));
 const modeLabel=root.querySelector('#recModeLabel');
 const submit=root.querySelector('#recSubmit');
 if(testSelected){
   setText(modeLabel,'Developingテスト');
   if(submit&&!submit.disabled&&!/受付中/.test(String(submit.textContent||'')))setText(submit,'テスト受付をする');
 }
 const slotTitle=[...root.querySelectorAll('.rec-title')].find(el=>/ご利用の回/.test(String(el.textContent||'')));
 const regularSlots=[...root.querySelectorAll('#recSlots [data-rec-slot]')];
 const noRegular=plainWeekday||closed||regularSlots.length===0;
 if(slotTitle)slotTitle.hidden=noRegular;
 const slotsBox=root.querySelector('#recSlots');
 if(slotsBox)slotsBox.hidden=noRegular;

 if(status&&plainWeekday&&test&&!/受付中|送信|完了|結果|確認しています/.test(String(status.textContent||''))){
   setText(status,'本日は現地受付です。下の紫色の「入場不可テスト」はDeveloping専用で毎日利用できます。');
 }
 if(status&&closed&&test&&!/受付中|送信|完了|結果|確認しています/.test(String(status.textContent||''))){
   setText(status,'本日は休館日です。下の紫色の「入場不可テスト」はDeveloping専用で利用できます。');
 }
 if(status&&!plainWeekday&&!closed&&test&&/Developing：AirWAIT現地枠/.test(String(status.textContent||''))){
   setText(status,'受付できます。下の紫色のブロックはDeveloping専用テストです。');
 }
 if(status&&/location\s*stale|locationstale/i.test(String(status.textContent||'')))setText(status,'受付を確定できませんでした。もう一度お試しください。');
}

function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(patch,0));
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
