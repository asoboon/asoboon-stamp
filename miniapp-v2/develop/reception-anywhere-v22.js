(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
const devTools=()=>new URLSearchParams(location.search).get('dev')==='1';
function setHidden(sel,hidden){root.querySelectorAll(sel).forEach(el=>{el.hidden=hidden;if(hidden)el.style.display='none';else el.style.removeProperty('display')})}
function patch(){queued=false;if(view()!=='reception')return;const web=root.querySelector('#recWeb'),onsite=root.querySelector('#recOnsite'),methods=root.querySelector('.rec-methods'),loc=root.querySelector('#recLocation'),status=root.querySelector('#recStatus'),dayLabel=String(root.querySelector('#recDay strong')?.textContent||'').trim(),plainWeekday=dayLabel==='平日',dev=devTools();
 if(onsite){onsite.hidden=true;onsite.style.display='none';onsite.setAttribute('aria-hidden','true');onsite.tabIndex=-1;onsite.disabled=true}if(loc){loc.hidden=true;loc.style.display='none';loc.setAttribute('aria-hidden','true')}if(methods)methods.classList.add('v22-anywhere-methods');
 if(web){web.classList.add('active','v22-anywhere');web.setAttribute('aria-current','true');const icon=web.querySelector(':scope > span:first-child'),strong=web.querySelector('strong'),small=web.querySelector('small');if(plainWeekday){if(icon&&icon.textContent!=='🏢')icon.textContent='🏢';if(strong&&strong.textContent!=='通常平日は現地受付')strong.textContent='通常平日は現地受付';if(small&&small.textContent!=='ASOBooN入口でご案内します。')small.textContent='ASOBooN入口でご案内します。'}else{if(icon&&icon.textContent!=='🌐')icon.textContent='🌐';if(strong&&strong.textContent!=='LINE受付')strong.textContent='LINE受付';if(small&&small.textContent!=='どこからでも受付できます。')small.textContent='どこからでも受付できます。'}}
 if(methods){let note=root.querySelector('.v22-anywhere-note');if(!note){methods.insertAdjacentHTML('afterend','<div class="v22-anywhere-note"><strong></strong><span></span></div>');note=root.querySelector('.v22-anywhere-note')}if(note){const strong=note.querySelector('strong'),span=note.querySelector('span');if(plainWeekday){if(strong)strong.textContent='LINE当日受付は対象日のみ';if(span)span.textContent='通常平日はASOBooN入口で受付します。'}else{if(strong)strong.textContent='現在地の確認は不要です';if(span)span.textContent='LINEミニアプリから、どこにいても受付できます。'}}}
 const formSelectors=['.rec-methods','.rec-title','#recSlots','.rec-people','.rec-summary','#recPeopleMsg','.rec-agree','#recSubmit','.rec-safe'];
 if(plainWeekday&&!dev){
   formSelectors.forEach(sel=>setHidden(sel,true));
   root.querySelector('.v22-anywhere-note')?.setAttribute('hidden','');
   let stop=root.querySelector('.v22-weekday-stop');
   if(!stop){root.querySelector('#recDay')?.insertAdjacentHTML('afterend','<div class="v22-weekday-stop"><strong>通常平日は現地受付です</strong><span>9:30からASOBooN入口で受付します。LINE当日受付は対象日のみご利用いただけます。</span></div>');stop=root.querySelector('.v22-weekday-stop')}
   if(status)status.textContent='本日はLINE当日受付を行っていません。ASOBooN入口で受付してください。';
 }else{
   root.querySelector('.v22-weekday-stop')?.remove();
   root.querySelector('.v22-anywhere-note')?.removeAttribute('hidden');
 }
 if(status&&/location\s*stale|locationstale/i.test(String(status.textContent||'')))status.textContent='受付を確定できませんでした。もう一度お試しください。';
}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});window.addEventListener('popstate',()=>setTimeout(patch,0));patch();setTimeout(patch,80);setTimeout(patch,350);
})();
