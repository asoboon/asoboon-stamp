(()=>{'use strict';

const slides=Array.isArray(window.ASOBOON_PRESENTATION_SLIDES)?window.ASOBOON_PRESENTATION_SLIDES:[];
const slidesPanel=document.getElementById('slidesPanel');
const wordsPanel=document.getElementById('wordsPanel');
const shell=document.getElementById('presentationShell');
const stage=document.getElementById('slideStage');
const zoomLayer=document.getElementById('zoomLayer');
const img=document.getElementById('slideImage');
const loading=document.getElementById('slideLoading');
const nowEl=document.getElementById('pageNow');
const totalEl=document.getElementById('pageTotal');
const prev=document.getElementById('prevSlide');
const next=document.getElementById('nextSlide');
const openWords=document.getElementById('openWords');
const backToSlides=document.getElementById('backToSlides');
const zoomToggle=document.getElementById('zoomToggle');
const gestureLabel=document.getElementById('gestureLabel');
const gestureHint=document.getElementById('gestureHint');

const MIN_SCALE=1;
const DOUBLE_TAP_SCALE=1.8;
const MAX_SCALE=3;
const UI_HIDE_MS=3000;
const HINT_KEY='asoboon:chief-story-gesture-hint-v1';

let index=0;
let scale=1,panX=0,panY=0;
let changeTimer=0,uiTimer=0,hintTimer=0;
let lastTapAt=0,lastTapX=0,lastTapY=0;
let gestureStart=null;
let pinchStart=null;
const pointers=new Map();

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const portraitViewport=()=>innerHeight>innerWidth;

function toLocalDelta(dx,dy){
  return portraitViewport()?{x:dy,y:-dx}:{x:dx,y:dy};
}
function visualSwipeDelta(dx,dy){
  return portraitViewport()?dy:dx;
}
function maxPan(){
  const w=stage?.clientWidth||innerWidth;
  const h=stage?.clientHeight||innerHeight;
  return{x:Math.max(0,w*(scale-1)/2),y:Math.max(0,h*(scale-1)/2)};
}
function clampPan(){
  const m=maxPan();
  panX=clamp(panX,-m.x,m.x);
  panY=clamp(panY,-m.y,m.y);
}
function applyTransform(animate=false){
  clampPan();
  zoomLayer.style.transition=animate?'transform .20s cubic-bezier(.2,.75,.25,1)':'none';
  zoomLayer.style.transform=`translate3d(${panX}px,${panY}px,0) scale(${scale})`;
  shell.classList.toggle('is-zoomed',scale>1.001);
  zoomToggle.textContent=scale>1.001?'全体表示':'⌕ 拡大';
  zoomToggle.setAttribute('aria-label',scale>1.001?'スライドを全体表示に戻す':'スライドを拡大');
  gestureLabel.textContent=scale>1.001?'ドラッグで移動':'左右にスワイプ';
}
function resetZoom(animate=false){
  scale=1;panX=0;panY=0;applyTransform(animate);
}
function setZoom(nextScale,animate=false){
  scale=clamp(nextScale,MIN_SCALE,MAX_SCALE);
  if(scale<=1.001){scale=1;panX=0;panY=0;}
  applyTransform(animate);
}
function toggleZoom(){
  if(scale>1.001)resetZoom(true);
  else{scale=DOUBLE_TAP_SCALE;panX=0;panY=0;applyTransform(true);}
  showUI();
}

function showUI(){
  shell.classList.remove('ui-hidden');
  clearTimeout(uiTimer);
  uiTimer=setTimeout(()=>{
    if(pointers.size===0&&!gestureHint.hidden)shell.classList.remove('ui-hidden');
    else if(pointers.size===0)shell.classList.add('ui-hidden');
  },UI_HIDE_MS);
}
function revealHintOnce(){
  let seen=false;
  try{seen=localStorage.getItem(HINT_KEY)==='1';}catch{}
  if(seen)return;
  gestureHint.hidden=false;
  shell.classList.remove('ui-hidden');
  clearTimeout(hintTimer);
  hintTimer=setTimeout(()=>{
    gestureHint.hidden=true;
    try{localStorage.setItem(HINT_KEY,'1');}catch{}
    showUI();
  },2600);
}

function preload(i){
  if(i<0||i>=slides.length)return;
  const p=new Image();p.src=slides[i];
}
function render(i,animate=true){
  if(!slides.length){
    loading.hidden=false;
    loading.textContent='資料を読み込めませんでした。';
    prev.disabled=next.disabled=true;
    return;
  }
  const target=clamp(i,0,slides.length-1);
  resetZoom(false);
  index=target;
  if(animate){
    img.classList.add('is-changing');
    clearTimeout(changeTimer);
    changeTimer=setTimeout(()=>img.classList.remove('is-changing'),150);
  }
  loading.hidden=false;
  loading.textContent='資料を読み込んでいます…';
  img.src=slides[index];
  img.alt='ASOBooN プレゼンテーション '+(index+1)+'枚目';
  nowEl.textContent=String(index+1);
  totalEl.textContent=String(slides.length);
  prev.disabled=index===0;
  next.disabled=index===slides.length-1;
  preload(index-1);preload(index+1);
  showUI();
}
img.addEventListener('load',()=>{loading.hidden=true;img.classList.remove('is-changing')});
img.addEventListener('error',()=>{loading.hidden=false;loading.textContent='このスライドを表示できませんでした。'});

function go(d){
  const n=index+d;
  if(n<0||n>=slides.length)return;
  render(n,true);
}
prev.addEventListener('click',()=>go(-1));
next.addEventListener('click',()=>go(1));
zoomToggle.addEventListener('click',toggleZoom);

function pointFromEvent(e){return{x:e.clientX,y:e.clientY}}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function center(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
function pointerValues(){return[...pointers.values()]}

shell.addEventListener('pointerdown',e=>{
  if(e.target.closest('button,a'))return;
  e.preventDefault();
  try{shell.setPointerCapture(e.pointerId);}catch{}
  pointers.set(e.pointerId,pointFromEvent(e));
  showUI();

  if(pointers.size===1){
    gestureStart={x:e.clientX,y:e.clientY,t:Date.now(),moved:false,lastX:e.clientX,lastY:e.clientY};
    pinchStart=null;
  }else if(pointers.size===2){
    const [a,b]=pointerValues();
    pinchStart={distance:Math.max(1,distance(a,b)),scale,center:center(a,b),panX,panY};
    gestureStart=null;
  }
},{passive:false});

shell.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  e.preventDefault();
  const prevPoint=pointers.get(e.pointerId);
  const nextPoint=pointFromEvent(e);
  pointers.set(e.pointerId,nextPoint);

  if(pointers.size>=2){
    const [a,b]=pointerValues();
    if(!pinchStart){
      pinchStart={distance:Math.max(1,distance(a,b)),scale,center:center(a,b),panX,panY};
    }
    const ratio=distance(a,b)/pinchStart.distance;
    scale=clamp(pinchStart.scale*ratio,MIN_SCALE,MAX_SCALE);
    const c=center(a,b);
    const d=toLocalDelta(c.x-pinchStart.center.x,c.y-pinchStart.center.y);
    panX=pinchStart.panX+d.x;
    panY=pinchStart.panY+d.y;
    if(scale<=1.001){scale=1;panX=0;panY=0;}
    applyTransform(false);
    return;
  }

  if(pointers.size===1&&gestureStart){
    const dx=nextPoint.x-prevPoint.x,dy=nextPoint.y-prevPoint.y;
    const total=Math.hypot(nextPoint.x-gestureStart.x,nextPoint.y-gestureStart.y);
    if(total>5)gestureStart.moved=true;
    if(scale>1.001){
      const d=toLocalDelta(dx,dy);
      panX+=d.x;panY+=d.y;
      applyTransform(false);
    }
    gestureStart.lastX=nextPoint.x;gestureStart.lastY=nextPoint.y;
  }
},{passive:false});

function finishPointer(e){
  if(!pointers.has(e.pointerId))return;
  const end=pointFromEvent(e);
  const wasCount=pointers.size;
  pointers.delete(e.pointerId);

  if(wasCount>=2){
    pinchStart=null;
    if(pointers.size===1){
      const p=pointerValues()[0];
      gestureStart={x:p.x,y:p.y,t:Date.now(),moved:false,lastX:p.x,lastY:p.y};
    }else gestureStart=null;
    showUI();
    return;
  }

  if(!gestureStart){showUI();return;}
  const dx=end.x-gestureStart.x,dy=end.y-gestureStart.y;
  const moved=Math.hypot(dx,dy);
  const elapsed=Date.now()-gestureStart.t;

  if(scale<=1.001&&elapsed<900&&Math.abs(visualSwipeDelta(dx,dy))>42&&moved>42){
    const delta=visualSwipeDelta(dx,dy);
    go(delta<0?1:-1);
    gestureStart=null;
    return;
  }

  if(moved<14&&elapsed<450){
    const now=Date.now();
    const doubleTap=now-lastTapAt<330&&Math.hypot(end.x-lastTapX,end.y-lastTapY)<34;
    if(doubleTap){
      lastTapAt=0;
      toggleZoom();
    }else{
      lastTapAt=now;lastTapX=end.x;lastTapY=end.y;
      showUI();
    }
  }else showUI();
  gestureStart=null;
}
shell.addEventListener('pointerup',finishPointer,{passive:false});
shell.addEventListener('pointercancel',finishPointer,{passive:false});

addEventListener('keydown',e=>{
  if(wordsPanel.hidden===false)return;
  if(e.key==='ArrowLeft')go(-1);
  if(e.key==='ArrowRight')go(1);
  if(e.key==='Escape'&&scale>1.001)resetZoom(true);
});
addEventListener('resize',()=>{clampPan();applyTransform(false)});

function showWords(){
  resetZoom(false);
  slidesPanel.hidden=true;
  wordsPanel.hidden=false;
  document.body.style.overflow='hidden';
  scrollTo(0,0);
}
function showSlides(){
  wordsPanel.hidden=true;
  slidesPanel.hidden=false;
  document.body.style.overflow='hidden';
  requestAnimationFrame(()=>{render(index,false);showUI();});
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
revealHintOnce();
})();