(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const F=E.featureFlags||{};
const root=document.getElementById('app');
if(!root)return;
let latest=window.ASOBOON_HOME_STATUS_SNAPSHOT||null,queued=false;
const state=()=>{const p=new URLSearchParams(location.search);return{view:String(p.get('view')||'home'),panel:String(p.get('panel')||'')}};
const fmtTime=ms=>{try{return new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Number(ms||Date.now())))}catch{return'--:--'}};
function waitingGuide(n){if(n<=2)return'入口へ向かう準備を。呼出通知が届いたら30分以内に受付へ。';if(n<=5)return'そろそろ入場準備を。受付番号を確認しておくとスムーズです。';if(n<=10)return'少しずつ近づいています。LINEの呼出通知をお待ちください。';return'呼出前に入口へ並ぶ必要はありません。LINE通知まで自由にお過ごしください。'}
function freshness(d){const t=fmtTime(d?.checkedAt);return d?.source==='cache'?`前回 ${t} ・ 最新情報を確認中`:`${t} 更新`}
function ensureMeta(hero,d){let meta=hero.querySelector('.v13-status-meta');if(!meta){meta=document.createElement('div');meta.className='v13-status-meta';const ticket=hero.querySelector('.v7-ticket');const target=ticket||hero.querySelector('.v7-call-title')||hero.querySelector('.v7-simple');if(target)target.insertAdjacentElement('afterend',meta)}if(!meta)return;const text=freshness(d);const live=d?.source!=='cache';meta.innerHTML=`<span class="v13-live-dot${live?' live':''}"></span><span>${text}</span><button type="button" data-v13-refresh>更新</button>`}
function patchHome(){if(state().view!=='home')return;const home=root.querySelector('.v7-home');if(!home)return;const hero=home.querySelector('#v7Hero');if(hero){hero.setAttribute('aria-live','polite');hero.setAttribute('aria-atomic','true')}const d=latest;if(d&&hero){const kind=String(d.kind||'sync');if(kind==='waiting'){const n=Number(d.ahead);let next=hero.querySelector('.v13-next');if(!next){next=document.createElement('div');next.className='v13-next';const msg=hero.querySelector('.v7-message');if(msg)msg.insertAdjacentElement('afterend',next)}if(next&&Number.isFinite(n))next.textContent=waitingGuide(n);ensureMeta(hero,d)}else if(kind==='calling'){if(!hero.querySelector('.v13-call-window')){const call=hero.querySelector('.v7-call-title');call?.insertAdjacentHTML('afterend','<div class="v13-call-window"><strong>呼出後30分以内</strong><span>ASOBooN入口へお越しください</span></div>')}ensureMeta(hero,d)}else if(kind==='guide'){ensureMeta(hero,d)}}const play=home.querySelector('.v7-play');if(play){const any=Boolean(F.game||F.omikuji||F.stamp);play.hidden=!any}const shortcut=home.querySelector('.v9-status-shortcut');if(shortcut&&d)shortcut.hidden=String(d.kind||'')==='none'}
function patchReception(){if(state().view!=='reception')return;const wrap=root.querySelector('.rec-wrap');if(!wrap||wrap.querySelector('.v13-after-reception'))return;const progress=wrap.querySelector('.rv7-progress');const html='<div class="v13-after-reception"><strong>受付後は並ばなくてOK</strong><span>HOMEで「あと○組」を確認できます。順番になるとLINEでお知らせします。</span></div>';if(progress)progress.insertAdjacentHTML('afterend',html);else wrap.insertAdjacentHTML('afterbegin',html)}
function patchEntry(){if(state().view!=='entry')return;const body=root.querySelector('.pv7-page .pv7-body');if(!body)return;const practical=body.querySelector('.v12-practical');if(practical&&!practical.querySelector('.v13-entry-note'))practical.insertAdjacentHTML('beforeend','<div class="v13-entry-note"><strong>ポイント</strong><span>ロッカーは1回のお会計につき1つ。一時退場する場合は、退場前にスタッフへお声がけください。</span></div>')}
function patchParking(){const s=state();if(s.view!=='parking'||s.panel==='info')return;const page=root.querySelector('.v12-parking-page');if(!page)return;page.setAttribute('aria-label','駐車場・アクセス');const free=page.querySelector('.v12-free');if(free)free.setAttribute('role','status')}
function patch(){queued=false;patchHome();patchReception();patchEntry();patchParking()}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
window.addEventListener('asoboon:v8-home-status',e=>{latest=e.detail||null;queue()});
window.addEventListener('popstate',()=>setTimeout(patch,0));
root.addEventListener('click',e=>{const b=e.target?.closest?.('[data-v13-refresh]');if(!b)return;e.preventDefault();b.disabled=true;b.textContent='更新中…';try{window.ASOBOON_V13_HOME_STATUS?.refresh?.()}finally{setTimeout(()=>{b.disabled=false;b.textContent='更新'},1200)}},true);
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
