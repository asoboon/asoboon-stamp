(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
function route(){return String(new URLSearchParams(location.search).get('view')||'home')}
function page(){return `<section class="page-card pv7-page v25-entry-page">
 <div class="pv7-head v25-entry-head"><span class="pv7-eyebrow">入場・退場</span><h1>入場・退場</h1><p>呼出から入場、一時退場・再入場までを確認できます。</p></div>
 <div class="pv7-body">
  <section class="v25-entry-section">
   <div class="v25-section-title"><span>01</span><div><h2>呼出〜入場</h2><p>「入場できます！」になったら、受付番号を準備してください。</p></div></div>
   <div class="v25-flow">
    <div class="v25-step"><b>1</b><div><strong>LINE通知を確認</strong><small>順番になるとLINEでお知らせします。</small></div></div>
    <div class="v25-step"><b>2</b><div><strong>受付番号を準備</strong><small>呼出状況に表示される受付番号をご用意ください。</small></div></div>
    <div class="v25-step important"><b>3</b><div><strong>呼出後30分以内に受付へ</strong><small>受付番号をスタッフへお見せください。</small></div></div>
    <div class="v25-step"><b>4</b><div><strong>受付・会計 → 入場</strong><small>会計後、1回のお会計につきロッカーを1つ貸し出します。</small></div></div>
   </div>
  </section>
  <section class="v25-entry-section reentry">
   <div class="v25-section-title"><span>02</span><div><h2>一時退場・再入場</h2><p>外出する方によって手順が異なります。</p></div></div>
   <div class="v25-common-alert"><strong>共通ルール</strong><p>お子さまだけを館内に残して、保護者全員が外出することはできません。</p><p>一時退場中も利用時間は進みます。</p></div>
   <div class="v25-choice-grid" aria-label="一時退場の種類"><div class="v25-choice all"><span>ご家族全員で外へ</span><strong>レシートを保管</strong><small>戻るときに必要です</small></div><div class="v25-choice adult"><span>保護者だけ外へ</span><strong>黄色ホルダー</strong><small>館内に別の保護者が必要</small></div></div>
   <article class="v25-reentry-card all"><div class="v25-card-head"><span>ご家族全員で外へ出る</span><h3>全員で一時退場する場合</h3></div><ol class="v25-steps"><li><b>1</b><div><strong>ロッカーを空にする</strong><small>荷物を残したまま外へ出ないでください。</small></div></li><li><b>2</b><div><strong>赤ホルダーからレシートを抜いて保管</strong><small>再入場時に必要です。なくさないようにお持ちください。</small></div></li><li><b>3</b><div><strong>すべてのホルダーを返却</strong><small>返却ボックスへ入れてから一時退場してください。</small></div></li><li><b>4</b><div><strong>再入場時にレシートを提示</strong><small>スタッフが確認後、再入場できます。</small></div></li></ol><div class="v25-ticket-note"><strong>再入場にはレシートが必要です</strong></div></article>
   <article class="v25-reentry-card adult"><div class="v25-card-head"><span>保護者だけ外へ出る</span><h3>大人だけ外出する場合</h3></div><p class="v25-adult-lead">黄色ホルダーをお持ちの保護者のみ外出できます。</p><div class="v25-condition"><b>条件</b><strong>館内に別の保護者が残っていること</strong></div></article>
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