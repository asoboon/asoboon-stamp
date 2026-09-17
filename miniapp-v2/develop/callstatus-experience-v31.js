(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
function round5(x){return Math.max(5,Math.round(x/5)*5)}
function etaText(n){if(n<=5)return'まもなく';const center=Math.max(1,n*.30);if(center<=4)return'約5分以内';let lo=round5(center*.83),hi=round5(center*1.17);if(hi<=lo)hi=lo+5;return`約${lo}〜${hi}分`}
function stageFor(n){if(n<=3)return 5;if(n<=5)return 4;if(n<=10)return 3;if(n<=20)return 2;return 1}
function stageMessage(n){if(n<=3)return'もうすぐです！';if(n<=5)return'入場の準備をお願いします';if(n<=10)return'そろそろ近づいてきました';if(n<=20)return'少しずつ近づいています';return'まだ時間があります'}
function lights(stage,tone='wait'){let out='';for(let i=1;i<=5;i++)out+=`<span class="v31-light${i<=stage?' is-on':''} ${tone}" aria-hidden="true"><i></i></span>`;return out}
function waitingMarkup(n){const stage=stageFor(n);return `<div class="v31-kicker">START LIGHTS</div><div class="v31-ahead-label">あなたの前</div><div class="v31-count"><strong>${n}</strong><span>組</span></div><div class="v31-lights" aria-label="入場までの目安 5段階中${stage}段階">${lights(stage)}</div><div class="v31-stage-message">${stageMessage(n)}</div><div class="v31-eta"><small>待ち時間の目安</small><strong>${etaText(n)}</strong></div><p class="v31-notify">順番になるとLINEでお知らせします。</p>`}
function callingMarkup(){return `<div class="v31-kicker">START LIGHTS</div><div class="v31-lights calling" aria-hidden="true">${lights(5,'go')}</div><div class="v31-go">GO!</div><h2>入場できます！</h2><p class="v31-call-limit"><strong>呼出後30分以内</strong>にASOBooN入口へお越しください。</p><p class="v31-call-guide">受付番号は下のTODAY PASSをスタッフにお見せください。</p>`}
function ensureStage(page){let stage=page.querySelector('.v31-stage');if(stage)return stage;stage=document.createElement('section');stage.className='v31-stage';stage.hidden=true;stage.setAttribute('aria-live','polite');const ticket=page.querySelector('.cs-ticket');if(ticket)ticket.before(stage);else page.querySelector('.cs-body')?.prepend(stage);return stage}
function clearMode(page,stage){page.classList.remove('v31-mode-waiting','v31-mode-calling');stage.hidden=true;stage.removeAttribute('data-v31-sig')}
function patch(){queued=false;if(view()!=='callstatus')return;const page=root.querySelector('.cs-page');if(!page)return;const state=page.querySelector('#csState');if(!state)return;const stage=ensureStage(page);const isCalling=state.classList.contains('calling');const isWaiting=state.classList.contains('waiting');if(isCalling){page.classList.remove('v31-mode-waiting');page.classList.add('v31-mode-calling');const sig='calling';if(stage.dataset.v31Sig!==sig){stage.dataset.v31Sig=sig;stage.className='v31-stage v31-stage-calling';stage.innerHTML=callingMarkup()}stage.hidden=false;return}if(isWaiting){const n=Number(String(page.querySelector('#csAhead')?.textContent||'').trim());if(!Number.isFinite(n)){clearMode(page,stage);return}page.classList.remove('v31-mode-calling');page.classList.add('v31-mode-waiting');const sig=`waiting|${n}`;if(stage.dataset.v31Sig!==sig){stage.dataset.v31Sig=sig;stage.className=`v31-stage v31-stage-waiting stage-${stageFor(n)}`;stage.innerHTML=waitingMarkup(n)}stage.hidden=false;return}clearMode(page,stage)}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','hidden']});
window.addEventListener('popstate',()=>setTimeout(patch,0));
window.addEventListener('focus',()=>setTimeout(patch,0));
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
