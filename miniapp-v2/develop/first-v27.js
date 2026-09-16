(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
function state(){const p=new URLSearchParams(location.search);return{view:String(p.get('view')||'home'),panel:String(p.get('panel')||'')}}
function page(){return `<section class="page-card pv7-page v27-first-page">
 <div class="pv7-head v27-first-head">
  <span class="pv7-eyebrow">初めての方</span>
  <h1>はじめてでも、この3つだけ</h1>
  <p>受付して、待って、呼ばれたら入口へ。まずはこの流れだけ分かれば大丈夫です。</p>
 </div>
 <div class="pv7-body">
  <span class="v12-first-locker v27-locker-sentinel" hidden aria-hidden="true"></span>
  <div class="v27-flow" aria-label="初めての方の利用の流れ">
   <article class="v27-step reception">
    <div class="v27-num">01</div>
    <div class="v27-step-copy">
     <span class="v27-kicker">来場前</span>
     <h2>LINEで受付</h2>
     <strong>当日7:00〜・どこからでも</strong>
     <p>利用する回と人数を選んで受付します。</p>
    </div>
   </article>
   <div class="v27-arrow" aria-hidden="true">↓</div>
   <article class="v27-step waiting">
    <div class="v27-num">02</div>
    <div class="v27-step-copy">
     <span class="v27-kicker">呼ばれるまで</span>
     <h2>入口に並ばなくてOK</h2>
     <strong>HOMEで「あなたの前 ○組」を確認</strong>
     <p>順番になるまで、入口で並んで待つ必要はありません。</p>
    </div>
   </article>
   <div class="v27-arrow" aria-hidden="true">↓</div>
   <article class="v27-step called">
    <div class="v27-num">03</div>
    <div class="v27-step-copy">
     <span class="v27-kicker">呼ばれたら</span>
     <h2>ASOBooN入口へ</h2>
     <strong>呼出後30分以内</strong>
     <p>LINEでお知らせします。TODAY PASSの受付番号をスタッフへ見せて、会計後に入場です。</p>
    </div>
   </article>
  </div>

  <div class="v27-finish" aria-label="入場までの最後の流れ">
   <span>受付番号を見せる</span><b>→</b><span>会計</span><b>→</b><strong>入場！</strong>
  </div>

  <div class="v27-basic">
   <div><small>対象</small><strong>0歳〜小学6年生</strong></div>
   <div><small>人数</small><strong>保護者1名につき子ども3名まで</strong></div>
  </div>

  <button class="pv7-primary v27-primary" type="button" data-pv7-view="reception">LINEで受付する</button>
  <button class="pv7-text-btn" type="button" data-pv7-view="first" data-pv7-panel="price">料金を見る</button>
 </div>
</section>`}
function patch(){queued=false;const s=state();if(s.view!=='first'||s.panel)return;const main=root.querySelector('main.view');if(!main||main.querySelector('.v27-first-page'))return;main.innerHTML=page();main.dataset.pv7Key='first:main'}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(patch,0));
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
