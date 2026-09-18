(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
function state(){const p=new URLSearchParams(location.search);return{view:String(p.get('view')||'home'),panel:String(p.get('panel')||'')}}
function page(){return `<section class="page-card pv7-page v27-first-page">
 <div class="pv7-head v27-first-head">
  <span class="pv7-eyebrow">初めての方</span>
  <h1>はじめてでも、この3つだけ</h1>
  <p>当日受付して、待って、呼ばれたら入口へ。まずはこの流れだけ分かれば大丈夫です。</p>
 </div>
 <div class="pv7-body">
  <div class="v27-flow" aria-label="初めての方の利用の流れ">
   <article class="v27-step reception">
    <div class="v27-num">01</div>
    <div class="v27-step-copy">
     <span class="v27-kicker">来場前</span>
     <h2>当日受付</h2>
     <strong>対象日はLINE・通常平日は現地</strong>
     <p>オンライン受付対象日は7:00からLINEで順番を取れます。通常平日はASOBooN入口で受付します。</p>
    </div>
   </article>
   <div class="v27-arrow" aria-hidden="true">↓</div>
   <article class="v27-step waiting">
    <div class="v27-num">02</div>
    <div class="v27-step-copy">
     <span class="v27-kicker">呼ばれるまで</span>
     <h2>LINE受付の日は順番を確認</h2>
     <strong>HOMEで「あなたの前 ○組」を確認</strong>
     <p>LINEで順番を取った日は、入口で並ばずに呼出状況を確認できます。</p>
    </div>
   </article>
   <div class="v27-arrow" aria-hidden="true">↓</div>
   <article class="v27-step called">
    <div class="v27-num">03</div>
    <div class="v27-step-copy">
     <span class="v27-kicker">呼ばれたら</span>
     <h2>ASOBooN入口へ</h2>
     <strong>呼出後30分以内</strong>
     <p>LINE受付の日は通知後、受付番号をスタッフへ見せてください。現地受付の日はスタッフの案内に沿ってお進みください。</p>
    </div>
   </article>
  </div>
  <div class="v27-finish" aria-label="入場までの最後の流れ"><span>受付番号を見せる</span><b>→</b><span>会計</span><b>→</b><strong>入場！</strong></div>
  <div class="v27-basic"><div><small>対象</small><strong>0歳〜小学6年生</strong></div><div><small>人数</small><strong>保護者1名につき子ども3名まで</strong></div></div>
  <button class="pv7-primary v27-primary" type="button" data-pv7-view="reception">当日受付を確認する</button>
  <button class="pv7-text-btn" type="button" data-pv7-view="first" data-pv7-panel="price">料金を見る</button>
 </div>
</section>`}
function patch(){queued=false;const s=state();if(s.view!=='first'||s.panel)return;const main=root.querySelector('main.view');if(!main||main.querySelector('.v27-first-page'))return;main.innerHTML=page();main.dataset.pv7Key='first:main'}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(patch,0));
patch();
})();