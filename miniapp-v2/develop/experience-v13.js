(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const F=E.featureFlags||{};
const root=document.getElementById('app');
if(!root)return;
let latest=window.ASOBOON_HOME_STATUS_SNAPSHOT||null,queued=false;
const state=()=>{const p=new URLSearchParams(location.search);return{view:String(p.get('view')||'home'),panel:String(p.get('panel')||'')}};
const fmtTime=ms=>{try{return new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Number(ms||Date.now())))}catch{return'--:--'}};
function freshness(d){const t=fmtTime(d?.checkedAt);return d?.source==='cache'?`前回 ${t} ・ 最新情報を確認中`:`${t} 更新`}
function ensureMeta(hero,d){let meta=hero.querySelector('.v13-status-meta');if(!meta){meta=document.createElement('div');meta.className='v13-status-meta';meta.innerHTML='<span class="v13-live-dot"></span><span class="v13-status-text"></span><button type="button" data-v13-refresh>更新</button>';const ticket=hero.querySelector('.v7-ticket');const target=ticket||hero.querySelector('.v7-call-title')||hero.querySelector('.v7-simple');if(target)target.insertAdjacentElement('afterend',meta)}if(!meta)return;const dot=meta.querySelector('.v13-live-dot'),label=meta.querySelector('.v13-status-text');const live=d?.source!=='cache';const cls=`v13-live-dot${live?' live':''}`;if(dot&&dot.className!==cls)dot.className=cls;const text=freshness(d);if(label&&label.textContent!==text)label.textContent=text}
function patchHome(){if(state().view!=='home')return;const home=root.querySelector('.v7-home');if(!home)return;const hero=home.querySelector('#v7Hero');if(hero){if(hero.getAttribute('aria-live')!=='polite')hero.setAttribute('aria-live','polite');if(hero.getAttribute('aria-atomic')!=='true')hero.setAttribute('aria-atomic','true');hero.querySelectorAll('.v13-next,.v13-call-window').forEach(x=>x.remove())}const d=latest;if(d&&hero){const kind=String(d.kind||'sync');if(['waiting','calling','guide'].includes(kind))ensureMeta(hero,d)}const play=home.querySelector('.v7-play');if(play){const any=Boolean(F.game||F.omikuji||F.stamp);if(play.hidden===any)play.hidden=!any}const shortcut=home.querySelector('.v9-status-shortcut');if(shortcut&&d){const hide=String(d.kind||'')==='none';if(shortcut.hidden!==hide)shortcut.hidden=hide}}
function patchReception(){if(state().view!=='reception')return;const wrap=root.querySelector('.rec-wrap');if(!wrap||wrap.querySelector('.v13-after-reception'))return;const progress=wrap.querySelector('.rv7-progress');const html='<div class="v13-after-reception"><strong>受付後は並ばなくてOK</strong><span>HOMEで「あと○組」を確認できます。順番になるとLINEでお知らせします。</span></div>';if(progress)progress.insertAdjacentHTML('afterend',html);else wrap.insertAdjacentHTML('afterbegin',html)}
function patchEntry(){if(state().view!=='entry')return;const body=root.querySelector('.pv7-page .pv7-body');if(!body)return;const practical=body.querySelector('.v12-practical');if(practical&&!practical.querySelector('.v13-entry-note'))practical.insertAdjacentHTML('beforeend','<div class="v13-entry-note"><strong>ポイント</strong><span>ロッカーは1回のお会計につき1つ。一時退場する場合は、退場前にスタッフへお声がけください。</span></div>')}
function patchParking(){const s=state();if(s.view!=='parking'||s.panel==='info')return;const page=root.querySelector('.v12-parking-page');if(!page)return;if(page.getAttribute('aria-label')!=='駐車場・アクセス')page.setAttribute('aria-label','駐車場・アクセス');const free=page.querySelector('.v12-free');if(free&&free.getAttribute('role')!=='status')free.setAttribute('role','status')}
function patch(){queued=false;patchHome();patchReception();patchEntry();patchParking()}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
window.addEventListener('asoboon:v8-home-status',e=>{latest=e.detail||null;queue()});
window.addEventListener('popstate',()=>setTimeout(patch,0));
root.addEventListener('click',e=>{const b=e.target?.closest?.('[data-v13-refresh]');if(!b)return;e.preventDefault();b.disabled=true;b.textContent='更新中…';try{window.ASOBOON_V13_HOME_STATUS?.refresh?.()}finally{setTimeout(()=>{b.disabled=false;b.textContent='更新'},1200)}},true);
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
