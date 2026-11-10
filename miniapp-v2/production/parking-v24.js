(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
function route(){const p=new URLSearchParams(location.search);return{view:String(p.get('view')||'home'),panel:String(p.get('panel')||'')}}
const mapLink=(href,name,note,meta='',kind='')=>`<a class="v24-map ${kind}" data-external href="${href}" target="_blank" rel="noopener noreferrer"><span><strong>${name}</strong><small>${note}</small></span>${meta?`<b>${meta}</b>`:'<b>地図 ↗</b>'}</a>`;
function page(){return `<section class="page-card pv7-page v12-parking-page v24-parking-page">
 <div class="pv7-head"><span class="pv7-eyebrow">駐車場・アクセス</span><h1>どちらから来ますか？</h1><p>一般道と首都高では駐車場が別です。</p></div>
 <div class="pv7-body">
  <div class="v24-free"><span>P</span><strong>駐車料金 無料</strong><small>首都高は高速料金が別です。</small></div>
  <div class="v24-choice" role="group" aria-label="来場ルートを選択">
   <button type="button" data-v24-route="v24-general" aria-pressed="false" aria-expanded="false" aria-controls="v24-general"><span>一般道から</span><strong>東門・正門駐車場</strong><small>9:00〜18:00</small></button>
   <button type="button" data-v24-route="v24-highway" aria-pressed="false" aria-expanded="false" aria-controls="v24-highway"><span>首都高から</span><strong>川口PA（上り）</strong><small>駐車場24時間</small></button>
  </div>
  <p class="v24-select-hint">駐車場と行き方を表示します。</p>
  <span class="v24-route-announcement" role="status" aria-live="polite"></span>

  <section class="v24-section" id="v24-general" hidden>
   <div class="v24-section-head"><span>一般道から</span><h2>駐車場は全部で5か所</h2><p>東門側3か所・正門側2か所。地図で位置を比べて選べます。</p></div>
   <a class="v24-all-map" data-external target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/@?api=1&map_action=shortlist&place_ids=ChIJXXu6y1SVGGAR_0YLVUttt6Y,ChIJyZN4QJOVGGARXseqERsVP2Y,ChIJoRybHi2VGGARe61DT2GBGW0,ChIJYSPyO0CVGGAR8ny8dIbrVDU,ChIJzwHsNK-VGGARXntcgjBDg-4" aria-label="一般道側の駐車場5か所をGoogleマップでまとめて見る">
    <span class="v24-all-map-icon" aria-hidden="true">📍</span><span class="v24-all-map-copy"><strong>全5か所を地図で見る</strong><small>5つのピンを同時表示</small></span><b>開く ↗</b>
   </a>
   <div class="v24-alert"><strong>一部駐車場は閉鎖の案内があります</strong><p>Googleマップの「営業中」は参考です。現地の案内を優先し、一般道側は18:00までに出庫してください。</p><a data-external href="https://www.city.kawaguchi.lg.jp/soshiki/01120/035/iinakawaguchi/49590.html" target="_blank" rel="noopener noreferrer">川口市の閉鎖情報を確認 ↗</a></div>
   <h3 class="v24-lots-heading">駐車場を個別に見る</h3>
   <div class="v24-lots" aria-label="一般道側の駐車場5か所">
    <a class="v24-lot-row" data-external data-v24-lot="1" href="https://maps.app.goo.gl/hKcx4SKWdEYZHcPE6?g_st=ic" target="_blank" rel="noopener noreferrer"><span class="v24-lot-copy"><strong>東門駐車場①</strong><small>東門側｜徒歩 約3分</small></span><b>地図 ↗</b></a>
    <a class="v24-lot-row" data-external data-v24-lot="2" href="https://maps.app.goo.gl/kgT7ZqYLWhsQQZZW8?g_st=ic" target="_blank" rel="noopener noreferrer"><span class="v24-lot-copy"><strong>東門駐車場②</strong><small>東門側｜徒歩 約5分</small></span><b>地図 ↗</b></a>
    <a class="v24-lot-row" data-external data-v24-lot="3" href="https://maps.app.goo.gl/NJnqAPZWHYBngrzYA?g_st=ic" target="_blank" rel="noopener noreferrer"><span class="v24-lot-copy"><strong>東門駐車場③</strong><small>東門側｜徒歩 約10分</small></span><b>地図 ↗</b></a>
    <a class="v24-lot-row" data-external data-v24-lot="4" href="https://maps.app.goo.gl/wnq7keJLpMDo6GrC8?g_st=ic" target="_blank" rel="noopener noreferrer"><span class="v24-lot-copy"><strong>正門駐車場①</strong><small>正門側｜徒歩 約15分</small></span><b>地図 ↗</b></a>
    <a class="v24-lot-row" data-external data-v24-lot="5" href="https://maps.app.goo.gl/mYVyxfQSc3ZvMUzG7?g_st=ic" target="_blank" rel="noopener noreferrer"><span class="v24-lot-copy"><strong>正門駐車場②</strong><small>正門側｜徒歩 約20分</small></span><b>地図 ↗</b></a>
   </div>
   <details class="v24-more"><summary>利用時間と駐車台数を確認する</summary><div class="v24-more-body">
    <div class="v24-facts"><div><small>利用時間</small><strong>9:00〜18:00</strong></div><div><small>小型車</small><strong>通常時 332台</strong></div><div><small>その他</small><strong>障がい者3台・大型5台</strong></div></div>
   </div></details>
   <div class="v24-nav"><strong>カーナビ検索</strong><span>埼玉県川口市赤山986</span></div>
  </section>

  <section class="v24-section highway" id="v24-highway" hidden>
   <div class="v24-section-head"><span>首都高から</span><h2>川口PA（上り）へ</h2><p>高速川口線は上り線からのみ、川口ハイウェイオアシスへ直接入れます。</p></div>
   ${mapLink('https://maps.app.goo.gl/PE7zNw8WGpkhvbBZ6?g_st=ic','川口PA（川口ハイウェイオアシス）','ハイウェイオアシスへ直結','地図 ↗','highway primary')}
   <div class="v24-facts highway"><div><small>駐車場</small><strong>24時間</strong></div><div><small>普通車</small><strong>151台</strong></div><div><small>大型・障がい者</small><strong>52台・5台</strong></div></div>
   <div class="v24-route"><div><b>上り線</b><p>川口JCT方面または新井宿入口から、川口本線料金所の一番左のレーンを通り、そのまま入れます。</p></div><div><b>下り線</b><p>直接入れません。新井宿出口で降り、一般道側のイイナパーク川口駐車場をご利用ください。</p></div></div>
   <div class="v24-warning"><strong>車で首都高側から一般道へ直接出ることはできません</strong><p>川口ハイウェイオアシスを経由して、首都高と一般道を車で通り抜けることはできません。</p></div>
   <a class="v24-official" data-external href="https://www.kawaguchi-highwayoasis.com/access/" target="_blank" rel="noopener noreferrer">公式アクセス情報を見る ↗</a>
  </section>

  <div class="v24-safety" hidden><strong>駐車場から施設まで</strong><p>車の出入りに注意し、お子さまと手をつないでお進みください。</p></div>
 </div>
</section>`}
function patch(){queued=false;const s=route();if(s.view!=='parking'||s.panel==='info')return;const main=root.querySelector('main.view');if(!main||main.querySelector('.v24-parking-page'))return;main.innerHTML=page();main.dataset.pv7Key='parking:v24'}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
function selectArrival(button){
 const page=button.closest('.v24-parking-page');
 if(!page)return;
 const target=button.dataset.v24Route;
 if(target!=='v24-general'&&target!=='v24-highway')return;
 page.querySelectorAll('.v24-choice [data-v24-route]').forEach(choice=>{
  const chosen=choice.dataset.v24Route===target;
  choice.classList.toggle('is-selected',chosen);
  choice.setAttribute('aria-pressed',String(chosen));
  choice.setAttribute('aria-expanded',String(chosen));
 });
 page.querySelectorAll('.v24-section').forEach(section=>{section.hidden=section.id!==target});
 const hint=page.querySelector('.v24-select-hint');
 if(hint)hint.hidden=true;
 const announcement=page.querySelector('.v24-route-announcement');
 if(announcement)announcement.textContent=target==='v24-general'?'一般道側の駐車場をご案内します。':'首都高側の駐車場をご案内します。';
 const safety=page.querySelector('.v24-safety');
 if(safety)safety.hidden=false;
 const otherParking=page.querySelector('.v24-more');
 if(otherParking)otherParking.open=false;
 const section=page.querySelector('#'+target);
 if(section)requestAnimationFrame(()=>section.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
}
if(!root.dataset.v24ParkingBound){
 root.dataset.v24ParkingBound='1';
 root.addEventListener('click',e=>{
  const choice=e.target.closest?.('[data-v24-route]');
  if(choice)selectArrival(choice);
 });
}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});window.addEventListener('popstate',()=>setTimeout(patch,0));patch();setTimeout(patch,80);setTimeout(patch,350);
})();
