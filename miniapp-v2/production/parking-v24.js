(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
function route(){const p=new URLSearchParams(location.search);return{view:String(p.get('view')||'home'),panel:String(p.get('panel')||'')}}
const mapLink=(href,name,note,meta='',kind='')=>`<a class="v24-map ${kind}" data-external href="${href}" target="_blank" rel="noopener noreferrer"><span><strong>${name}</strong><small>${note}</small></span>${meta?`<b>${meta}</b>`:'<b>地図 ↗</b>'}</a>`;
function page(){return `<section class="page-card pv7-page v12-parking-page v24-parking-page">
 <div class="pv7-head"><span class="pv7-eyebrow">駐車場・アクセス</span><h1>どちらから来ますか？</h1><p>一般道側と首都高側で、入る駐車場が異なります。</p></div>
 <div class="pv7-body">
  <div class="v24-free"><span>P</span><strong>駐車料金 無料</strong><small>首都高をご利用の場合、高速料金は別途かかります。</small></div>
  <div class="v24-choice" aria-label="来場ルートを選ぶ">
   <button type="button" data-v24-scroll="v24-general"><span>一般道から</span><strong>東門・正門駐車場</strong><small>9:00〜18:00</small></button>
   <button type="button" data-v24-scroll="v24-highway"><span>首都高から</span><strong>川口PA（上り）</strong><small>駐車場24時間</small></button>
  </div>

  <section class="v24-section" id="v24-general">
   <div class="v24-section-head"><span>一般道から</span><h2>まず、この2つから選ぶ</h2><p>近さなら東門①。台数を優先するなら正門①。</p></div>
   <div class="v24-pick-grid">
    <article class="v24-pick recommended"><span class="v24-pick-tag">近さ重視</span><h3>東門駐車場①</h3><strong>徒歩 約3分</strong><p>ASOBooNに比較的近く、最初の候補におすすめです。</p>${mapLink('https://maps.app.goo.gl/hKcx4SKWdEYZHcPE6?g_st=ic','東門駐車場①','Googleマップで開く','地図 ↗','primary')}</article>
    <article class="v24-pick"><span class="v24-pick-tag capacity">台数重視</span><h3>正門駐車場①</h3><strong>徒歩 約15分</strong><p>距離はありますが、東門側が混雑しているときの候補です。</p>${mapLink('https://maps.app.goo.gl/wnq7keJLpMDo6GrC8?g_st=ic','正門駐車場①','Googleマップで開く','地図 ↗')}</article>
   </div>
   <div class="v24-facts"><div><small>利用時間</small><strong>9:00〜18:00</strong></div><div><small>小型車</small><strong>通常時 332台</strong></div><div><small>その他</small><strong>障がい者3台・大型5台</strong></div></div>
   <div class="v24-alert"><strong>一般道側駐車場は一部閉鎖の案内があります</strong><p>現地の案内を優先してください。18:00までに出庫できるようご利用ください。</p><a data-external href="https://www.city.kawaguchi.lg.jp/soshiki/01120/035/iinakawaguchi/49590.html" target="_blank" rel="noopener noreferrer">川口市の最新案内を見る ↗</a></div>
   <details class="v24-more"><summary>ほかの一般道側駐車場を見る</summary><div class="v24-more-body">
    ${mapLink('https://maps.app.goo.gl/kgT7ZqYLWhsQQZZW8?g_st=ic','東門駐車場②','東門側・台数少なめ','徒歩 約5分')}
    ${mapLink('https://maps.app.goo.gl/NJnqAPZWHYBngrzYA?g_st=ic','東門駐車場③','東門側の予備候補','徒歩 約10分')}
    ${mapLink('https://maps.app.goo.gl/mYVyxfQSc3ZvMUzG7?g_st=ic','正門駐車場②','距離はあるが台数多め','徒歩 約20分')}
   </div></details>
   <div class="v24-nav"><strong>カーナビ検索</strong><span>埼玉県川口市赤山986</span></div>
  </section>

  <section class="v24-section highway" id="v24-highway">
   <div class="v24-section-head"><span>首都高から</span><h2>川口PA（上り）へ</h2><p>高速川口線は上り線からのみ、川口ハイウェイオアシスへ直接入れます。</p></div>
   ${mapLink('https://maps.app.goo.gl/PE7zNw8WGpkhvbBZ6?g_st=ic','川口PA（川口ハイウェイオアシス）','ハイウェイオアシスへ直結','地図 ↗','highway primary')}
   <div class="v24-facts highway"><div><small>駐車場</small><strong>24時間</strong></div><div><small>普通車</small><strong>151台</strong></div><div><small>大型・障がい者</small><strong>52台・5台</strong></div></div>
   <div class="v24-route"><div><b>上り線</b><p>川口JCT方面または新井宿入口から、川口本線料金所の一番左のレーンを通り、そのまま入れます。</p></div><div><b>下り線</b><p>直接入れません。新井宿出口で降り、一般道側のイイナパーク川口駐車場をご利用ください。</p></div></div>
   <div class="v24-warning"><strong>車で首都高側から一般道へ直接出ることはできません</strong><p>川口ハイウェイオアシスを経由して、首都高と一般道を車で通り抜けることはできません。</p></div>
   <a class="v24-official" data-external href="https://www.kawaguchi-highwayoasis.com/access/" target="_blank" rel="noopener noreferrer">公式アクセス情報を見る ↗</a>
  </section>

  <div class="v24-safety"><strong>駐車場から施設まで</strong><p>車の出入りに注意し、お子さまと手をつないでお進みください。</p></div>
 </div>
</section>`}
function patch(){queued=false;const s=route();if(s.view!=='parking'||s.panel==='info')return;const main=root.querySelector('main.view');if(!main||main.querySelector('.v24-parking-page'))return;main.innerHTML=page();main.dataset.pv7Key='parking:v24'}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
if(!root.dataset.v24ParkingBound){root.dataset.v24ParkingBound='1';root.addEventListener('click',e=>{const b=e.target.closest?.('[data-v24-scroll]');if(!b)return;const el=document.getElementById(b.dataset.v24Scroll);if(el)el.scrollIntoView({behavior:'smooth',block:'start'})})}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});window.addEventListener('popstate',()=>setTimeout(patch,0));patch();setTimeout(patch,80);setTimeout(patch,350);
})();
