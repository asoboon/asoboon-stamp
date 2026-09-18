(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
const TEST_WAIT_TYPE_ID='0042';
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
function patch(){queued=false;if(view()!=='reception')return;
 const web=root.querySelector('#recWeb'),onsite=root.querySelector('#recOnsite'),methods=root.querySelector('.rec-methods'),loc=root.querySelector('#recLocation'),status=root.querySelector('#recStatus'),dayLabel=String(root.querySelector('#recDay strong')?.textContent||'').trim(),plainWeekday=dayLabel==='平日';
 if(onsite){onsite.hidden=true;onsite.style.display='none';onsite.setAttribute('aria-hidden','true');onsite.tabIndex=-1;onsite.disabled=true}
 if(loc){loc.hidden=true;loc.style.display='none';loc.setAttribute('aria-hidden','true')}
 if(methods)methods.classList.add('v22-anywhere-methods');
 if(web){
   web.classList.add('active','v22-anywhere');web.setAttribute('aria-current','true');
   const icon=web.querySelector(':scope > span:first-child'),strong=web.querySelector('strong'),small=web.querySelector('small');
   if(plainWeekday){
     if(icon&&icon.textContent!=='🧪')icon.textContent='🧪';
     if(strong&&strong.textContent!=='Developingテスト受付')strong.textContent='Developingテスト受付';
     if(small&&small.textContent!=='通常平日は0042テスト枠のみ利用できます。')small.textContent='通常平日は0042テスト枠のみ利用できます。';
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
       if(strong)strong.textContent='通常平日の実受付は現地です';
       if(span)span.textContent='Developingでは「入場不可テスト」だけ毎日テストできます。';
     }else{
       if(strong)strong.textContent='現在地の確認は不要です';
       if(span)span.textContent='LINEミニアプリから、どこにいても受付できます。';
     }
   }
 }
 const slots=root.querySelectorAll('#recSlots [data-rec-slot]');
 slots.forEach(btn=>{
   const isTest=String(btn.dataset.recSlot||'')===TEST_WAIT_TYPE_ID;
   btn.hidden=Boolean(plainWeekday&&!isTest);
   if(btn.hidden)btn.style.display='none';else btn.style.removeProperty('display');
 });
 root.querySelector('.v22-weekday-stop')?.remove();
 if(status&&plainWeekday&&root.querySelector('#recSlots [data-rec-slot="0042"]')&&!/受付中|送信|完了|結果|確認しています/.test(String(status.textContent||''))){
   status.textContent='🧪 Developing：通常平日の実受付は現地です。「入場不可テスト」は実受付テストできます。';
 }
 if(status&&/location\s*stale|locationstale/i.test(String(status.textContent||'')))status.textContent='受付を確定できませんでした。もう一度お試しください。';
}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(patch,0));
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
