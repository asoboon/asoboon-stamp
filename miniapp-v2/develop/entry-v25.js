(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
function route(){return String(new URLSearchParams(location.search).get('view')||'home')}
function page(){return `<section class="page-card pv7-page v25-entry-page">
 <div class="pv7-head v25-entry-head"><span class="pv7-eyebrow">利用中のご案内</span><h1>一時退場・再入場</h1><p>外へ出るとき、戻るとき、利用を終えるときに必要なことだけまとめています。</p></div>
 <div class="pv7-body">
  <section class="v25-glance" aria-label="まず確認する3つ">
   <div class="v25-glance-card time"><small>一時退場中</small><strong>利用時間は進みます</strong></div>
   <div class="v25-glance-card receipt"><small>ご家族全員で外へ</small><strong>レシートを保管</strong></div>
   <div class="v25-glance-card holder"><small>保護者だけ外へ</small><strong>黄色ホルダー</strong></div>
  </section>
  <section class="v25-entry-section reentry">
   <div class="v25-section-title"><span>01</span><div><h2>一時退場</h2><p>外出する方によって手順が異なります。</p></div></div>
   <div class="v25-common-alert"><strong>お子さまだけを館内に残せません</strong><p>保護者全員が外出する場合は、お子さまも一緒に一時退場してください。</p></div>
   <div class="v25-choice-grid" aria-label="一時退場の種類"><div class="v25-choice all"><span>ご家族全員で外へ</span><strong>レシートを保管</strong><small>再入場するときに必要です</small></div><div class="v25-choice adult"><span>保護者だけ外へ</span><strong>黄色ホルダー</strong><small>館内に別の保護者が必要</small></div></div>
   <article class="v25-reentry-card all"><div class="v25-card-head"><span>ご家族全員で外へ出る</span><h3>全員で一時退場する場合</h3></div><ol class="v25-steps"><li><b>1</b><div><strong>ロッカーを空にする</strong><small>荷物を残したまま外へ出ないでください。</small></div></li><li><b>2</b><div><strong>レシートを抜いて保管</strong><small>赤ホルダーのレシートは再入場時に必要です。</small></div></li><li><b>3</b><div><strong>すべてのホルダーを返却</strong><small>返却ボックスへ入れてから一時退場してください。</small></div></li></ol><div class="v25-ticket-note"><strong>再入場にはレシートが必要です</strong></div></article>
   <article class="v25-reentry-card adult"><div class="v25-card-head"><span>保護者だけ外へ出る</span><h3>大人だけ外出する場合</h3></div><p class="v25-adult-lead">黄色ホルダーをお持ちの保護者のみ外出できます。</p><div class="v25-condition"><b>条件</b><strong>館内に別の保護者が残っていること</strong></div></article>
  </section>
  <section class="v25-entry-section reentry">
   <div class="v25-section-title"><span>02</span><div><h2>再入場</h2><p>一時退場した方法に合わせて確認してください。</p></div></div>
   <article class="v25-reentry-card all"><div class="v25-card-head"><span>ご家族全員で一時退場した場合</span><h3>レシートをスタッフへ提示</h3></div><p class="v25-adult-lead">一時退場時に保管したレシートをスタッフへお見せください。</p></article>
   <article class="v25-reentry-card adult"><div class="v25-card-head"><span>保護者だけ外出した場合</span><h3>黄色ホルダーを提示</h3></div><p class="v25-adult-lead">戻る際に黄色ホルダーをスタッフへお見せください。</p></article>
  </section>
  <section class="v25-entry-section exit">
   <div class="v25-section-title"><span>03</span><div><h2>退場</h2><p>最後に2点だけ確認してください。</p></div></div>
   <div class="v25-exit-grid"><div><small>01</small><strong>ロッカーを空にする</strong><span>忘れ物がないか確認</span></div><div><small>02</small><strong>ホルダーを返却</strong><span>赤・黄色とも返却ボックスへ</span></div></div>
   <div class="v25-holder-guide"><strong>ホルダーの見方</strong><div><span class="red">赤</span><p>1回のお会計につき1つ</p></div><div><span class="yellow">黄</span><p>大人が複数いる場合、追加の保護者へお渡しします</p></div></div>
  </section>
 </div>
</section>`}
function patch(){queued=false;if(route()!=='entry')return;const main=root.querySelector('main.view');if(!main||main.querySelector('.v25-entry-page'))return;main.innerHTML=page();main.dataset.pv7Key='entry'}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(patch,0));
patch();
})();