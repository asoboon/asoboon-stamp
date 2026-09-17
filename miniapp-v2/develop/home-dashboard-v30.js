(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let latest=window.ASOBOON_HOME_STATUS_SNAPSHOT||null;
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
function round5(x){return Math.max(5,Math.round(x/5)*5)}
function etaText(n){if(n<=5)return'まもなく';const center=Math.max(1,n*.30);if(center<=4)return'約5分以内';let lo=round5(center*.83),hi=round5(center*1.17);if(hi<=lo)hi=lo+5;return`約${lo}〜${hi}分`}
function waitingMarkup(n){return `<div class="v30-home-wait"><div class="v30-wait-top"><span class="v30-status-dot" aria-hidden="true"></span><strong>呼出待ち</strong></div><div class="v30-wait-main"><div class="v30-ahead"><small>あなたの前</small><div><strong>${n}</strong><span>組</span></div></div><div class="v30-eta"><small>待ち時間の目安</small><strong>${etaText(n)}</strong></div></div><p>順番になるとLINEでお知らせします。</p><button class="v30-callstatus" type="button" data-v7-view="callstatus">呼出状況を見る <span>›</span></button></div>`}
function patch(){if(view()!=='home')return;const d=latest||window.ASOBOON_HOME_STATUS_SNAPSHOT;if(String(d?.kind||'')!=='waiting')return;const n=Number(d?.ahead);if(!Number.isFinite(n))return;const hero=root.querySelector('#v7Hero');if(!hero)return;const sig=String(d?.receipt||'')+'|'+n;if(hero.dataset.v30Sig===sig&&hero.querySelector('.v30-home-wait'))return;hero.dataset.v30Sig=sig;hero.className='v7-hero v30-home-hero';hero.innerHTML=waitingMarkup(n)}
window.addEventListener('asoboon:v8-home-status',e=>{latest=e.detail||null;if(view()==='home')setTimeout(patch,0)});
window.addEventListener('popstate',()=>setTimeout(()=>{latest=window.ASOBOON_HOME_STATUS_SNAPSHOT||latest;patch()},0));
window.addEventListener('focus',()=>setTimeout(patch,0));
patch();setTimeout(patch,80);setTimeout(patch,350);
})();