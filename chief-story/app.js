(()=>{'use strict';

const slides=Array.isArray(window.ASOBOON_PRESENTATION_SLIDES)?window.ASOBOON_PRESENTATION_SLIDES:[];
const slidesPanel=document.getElementById('slidesPanel');
const wordsPanel=document.getElementById('wordsPanel');
const shell=document.getElementById('presentationShell');
const img=document.getElementById('slideImage');
const loading=document.getElementById('slideLoading');
const nowEl=document.getElementById('pageNow');
const totalEl=document.getElementById('pageTotal');
const prev=document.getElementById('prevSlide');
const next=document.getElementById('nextSlide');
const openWords=document.getElementById('openWords');
const backToSlides=document.getElementById('backToSlides');

let index=0;
let startX=0,startY=0,startT=0;
let changeTimer=0;

function portraitViewport(){return innerHeight>innerWidth}
function preload(i){
  if(i<0||i>=slides.length)return;
  const p=new Image();p.src=slides[i];
}
function render(i,animate=true){
  if(!slides.length){
    loading.textContent='資料を読み込めませんでした。';
    prev.disabled=next.disabled=true;
    return;
  }
  index=Math.max(0,Math.min(slides.length-1,i));
  if(animate){
    img.classList.add('is-changing');
    clearTimeout(changeTimer);
    changeTimer=setTimeout(()=>img.classList.remove('is-changing'),150);
  }
  img.src=slides[index];
  img.alt='ASOBooN プレゼンテーション '+(index+1)+'枚目';
  nowEl.textContent=String(index+1);
  totalEl.textContent=String(slides.length);
  prev.disabled=index===0;
  next.disabled=index===slides.length-1;
  preload(index-1);preload(index+1);
}
img.addEventListener('load',()=>{loading.hidden=true;img.classList.remove('is-changing')});
img.addEventListener('error',()=>{loading.hidden=false;loading.textContent='このスライドを表示できませんでした。'});

function go(d){render(index+d,true)}
prev.addEventListener('click',()=>go(-1));
next.addEventListener('click',()=>go(1));

shell.addEventListener('touchstart',e=>{
  const t=e.changedTouches[0];if(!t)return;
  startX=t.clientX;startY=t.clientY;startT=Date.now();
},{passive:true});
shell.addEventListener('touchend',e=>{
  const t=e.changedTouches[0];if(!t)return;
  const dx=t.clientX-startX,dy=t.clientY-startY;
  const elapsed=Date.now()-startT;
  if(elapsed>900)return;
  // CSSで90度回しているportraitでは、見た目の左右スワイプ＝画面座標の上下移動。
  const delta=portraitViewport()?dy:dx;
  if(Math.abs(delta)<42)return;
  // portraitを時計回り90度に回しているため、上方向が「次」、下方向が「前」。
  go(delta<0?1:-1);
},{passive:true});

shell.addEventListener('pointerup',e=>{
  if(e.pointerType==='touch')return;
  // マウス/PCでは左右半分のクリックでも送れる。
  if(e.target.closest('button,a'))return;
  if(e.clientX<innerWidth*.42)go(-1);
  else if(e.clientX>innerWidth*.58)go(1);
});

addEventListener('keydown',e=>{
  if(wordsPanel.hidden===false)return;
  if(e.key==='ArrowLeft')go(-1);
  if(e.key==='ArrowRight')go(1);
});

function showWords(){
  slidesPanel.hidden=true;
  wordsPanel.hidden=false;
  document.body.style.overflow='hidden';
  scrollTo(0,0);
}
function showSlides(){
  wordsPanel.hidden=true;
  slidesPanel.hidden=false;
  document.body.style.overflow='hidden';
  requestAnimationFrame(()=>render(index,false));
}
openWords.addEventListener('click',showWords);
backToSlides.addEventListener('click',showSlides);

const words=[
  {tag:'IT / CLOUD',name:'SaaS',short:'インターネット経由で使う「完成したソフト」のサービス。',detail:'Software as a Service の略。買い切りソフトを端末に入れるというより、提供会社がソフトを運用・更新し、利用者はブラウザなどから使います。',aso:'予約・電子チケット・在庫管理など、施設運営を支える仕組みの説明で登場します。'},
  {tag:'PLAY',name:'Risky Play',short:'少しドキドキする挑戦を、子ども自身が選ぶ遊び。',detail:'結果が完全には読めず、スピード・高さ・バランスなどに挑戦する遊びを指す考え方です。「危険を放置する」という意味ではありません。',aso:'挑戦を全部止めるのではなく、子どもが判断できる範囲か、大人が取り除くべき危険かを分けて考える材料にしています。'},
  {tag:'SAFETY',name:'Risk と Hazard',short:'見守れる挑戦と、取り除くべき危険を分けて考える。',detail:'遊びに内在する「リスク」と、事故につながり子ども自身では判断しにくい「ハザード」を区別して安全を考える考え方です。',aso:'安全確認を最優先にしながら、見守る・支える・止めるを判断します。'},
  {tag:'LEARNING',name:'Edutainment',short:'Education（教育）× Entertainment（楽しさ）。',detail:'楽しさや体験の中に学びを組み込み、遊びながら知る・考える・試すことにつなげる考え方です。',aso:'「勉強させる」より、夢中で遊んだ結果として気づきや学びが残る体験を目指します。'},
  {tag:'ASOBOON',name:'プレイリーディング',short:'子どもが主役のまま、遊びが広がるきっかけをつくる。',detail:'スタッフが答えを決めるのではなく、声かけや実演で遊びの入口をつくり、子どもが夢中になったら一歩引く関わり方です。',aso:'「提案する → 一緒に遊び込む → 子どもが自分で進めたら身を引く」というイメージです。'},
  {tag:'MARKETING',name:'Customer Journey',short:'知る → 行きたい → 予約 → 来場 → また来たい、まで全部が体験。',detail:'お客様が施設を知ってから、利用し、その後また来たいと思うまでの一連の流れを捉える考え方です。',aso:'SNS、検索、予約、呼出、案内、再来場までを一つの体験として改善します。'},
  {tag:'BUSINESS',name:'垂直統合',short:'別々だった事業の段階を、一つのグループでつなぐこと。',detail:'たとえば「集客する」「業務システムを提供する」「実店舗を運営する」といった段階を一体で持つ考え方です。',aso:'プレゼンでは、アソビューの予約プラットフォーム・施設向けSaaS・実店舗という話で登場します。'},
  {tag:'DATA',name:'「2回目以上」回答割合',short:'この資料では、実際のリピート率そのものではありません。',detail:'アンケート回答者の中で「2回目以上」と答えた人の割合です。回答者の偏りもあり得るため、全来場者の再来場率と同じ意味ではありません。',aso:'数字を強く見せすぎず、他のデータや現場の声と一緒に見ています。'},
  {tag:'TECH',name:'NFC',short:'スマホを「かざす」だけで情報をやり取りする近距離通信。',detail:'Near Field Communication の略。交通系ICカードやタッチ決済などにも使われる技術です。',aso:'スタンプラリーなど「操作を減らして体験を始める」仕組みと相性が良い技術です。'},
  {tag:'UX',name:'タッチポイント',short:'お客様とASOBooNが接する、一つひとつの場所・瞬間。',detail:'Instagram、検索、予約画面、駐車場、受付、スタッフの声かけ、退場後のLINEなど、体験の接点を指します。',aso:'館内だけでなく、来場前から帰宅後までをひと続きの体験として見ます。'},
  {tag:'UX',name:'フリクション',short:'「面倒・不安・分かりにくい」など、次の行動を止める摩擦。',detail:'入力が多い、どこを押すか分からない、待ち時間が見えない、といった小さな不便もフリクションです。',aso:'予約や呼出状況を分かりやすくするのは、遊ぶ前のフリクションを減らす改善です。'},
  {tag:'DESIGN',name:'アフォーダンス',short:'環境やモノが「こう使えそう」と自然に感じさせる性質。',detail:'説明を読まなくても、押せそうなボタン、座れそうな形、登れそうな場所など、環境が行動の可能性を示す考え方です。',aso:'「触っちゃダメ」を増やすより、自然に「こっちで遊びたい」と思える環境をつくる発想につながります。'},
  {tag:'EXPERIENCE',name:'ゲーミフィケーション',short:'ゲームの仕組みを、ゲーム以外の体験に取り入れること。',detail:'スタンプ、進捗、達成、抽選、発見などを使って、行動そのものを少し楽しくする設計です。',aso:'アンケートをガチャにするなど、「お願い」を体験に変える時に使えます。'},
  {tag:'MARKETING',name:'リテンション',short:'一度来てくれた人との関係が続き、また利用してもらうこと。',detail:'新しいお客様を増やすだけでなく、既存のお客様が再び選んでくれる状態をつくる考え方です。',aso:'「一度選ばれる。もう一度選ばれる。」の後半にあたります。'},
  {tag:'MARKETING',name:'LTV',short:'一人のお客様との長い関係から生まれる価値。',detail:'Life Time Value の略。1回の売上だけでなく、継続利用や紹介などを含めて長期的な価値を見る考え方です。',aso:'「今日の来場者数」だけでなく、また来たいと思ってもらえる体験を重視する理由の一つです。'}
];

const grid=document.getElementById('wordGrid');
grid.innerHTML=words.map(w=>'<article class="word-card"><div class="word-tag">'+w.tag+'</div><h2>'+w.name+'</h2><p class="short">'+w.short+'</p><details><summary>もう少し詳しく</summary><p>'+w.detail+'</p><p><b>ASOBooNでは：</b>'+w.aso+'</p></details></article>').join('');

totalEl.textContent=String(slides.length||0);
render(0,false);
})();