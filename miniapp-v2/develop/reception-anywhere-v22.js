(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false,forced=false;
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
function patch(){queued=false;if(view()!=='reception'){forced=false;return}const web=root.querySelector('#recWeb'),onsite=root.querySelector('#recOnsite'),methods=root.querySelector('.rec-methods'),loc=root.querySelector('#recLocation'),status=root.querySelector('#recStatus');
 if(onsite)onsite.remove();if(loc)loc.remove();if(methods)methods.classList.add('v22-anywhere-methods');
 if(web){web.classList.add('active','v22-anywhere');const icon=web.querySelector(':scope > span:first-child');if(icon&&icon.textContent!=='🌐')icon.textContent='🌐';const strong=web.querySelector('strong');if(strong&&strong.textContent!=='LINE受付')strong.textContent='LINE受付';const small=web.querySelector('small');if(small&&small.textContent!=='どこからでも受付できます。')small.textContent='どこからでも受付できます。';if(!forced){forced=true;web.click()}}
 if(methods&&!root.querySelector('.v22-anywhere-note'))methods.insertAdjacentHTML('afterend','<div class="v22-anywhere-note"><strong>現在地の確認は不要です</strong><span>LINEミニアプリから、どこにいても受付できます。</span></div>');
 if(status&&/location\s*stale|locationstale/i.test(String(status.textContent||'')))status.textContent='受付を確定できませんでした。もう一度お試しください。';
}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});window.addEventListener('popstate',()=>setTimeout(patch,0));patch();setTimeout(patch,80);setTimeout(patch,350);
})();
