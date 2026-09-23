(()=>{'use strict';

const M=window.ASOBOON_BOARD_EFFECTS;
const RESIDENTS=Object.freeze({
  orb:Object.freeze({id:'orb',role:'好奇心旺盛な丸',className:'resident-orb'}),
  star:Object.freeze({id:'star',role:'調子に乗りがちな星',className:'resident-star'}),
  ball:Object.freeze({id:'ball',role:'勢いだけはすごい巨大ボール',className:'resident-ball'}),
  square:Object.freeze({id:'square',role:'真面目なのに毎回ずれる四角',className:'resident-square'}),
  shadow:Object.freeze({id:'shadow',role:'何をしているか分からない影',className:'resident-shadow'}),
  eye:Object.freeze({id:'eye',role:'画面外から覗きたがる目',className:'resident-eye'}),
});

const DIRECTIVES=Object.freeze({
  'shooting-star':d('かわいい','star','ricochet',980,'星が慎重に近づく→カードにぶつかる→自分だけ跳ね返る→照れたように退場'),
  'tiny-cloud':d('謎','orb','bad-hide',1050,'雲が来る→丸が隠れる→半分見えている→気づいて慌てて引っ込む'),
  'card-wiggle':d('笑い','square','push-fail',1000,'四角がカードを押す→動かない→力む→自分が後ろへ飛ぶ'),
  'card-hop-wave':d('笑い','star','miss-jump',1050,'星が連鎖ジャンプを真似る→一つだけタイミングを外す→跳ね返る'),
  'micro-sparkles':d('かわいい','star','show-off',1000,'小さな星が光を集める→得意げに回る→回りすぎてふらつく'),
  'road-light':d('ド派手','square','wrong-way',1000,'光が進行方向へ走る→四角が追う→逆向きだったと気づき戻る'),
  'light-orb':d('謎','orb','peek-switch',1050,'光る丸が端から覗く→引っ込む→反対側からまた覗く'),
  'few-confetti':d('かわいい','orb','confetti-sneeze',1050,'紙吹雪が少し落ちる→丸が見上げる→くしゃみの反動で紙吹雪が増える'),
  'corner-peek':d('笑い','orb','bad-hide',1100,'丸が隠れたつもりで覗く→半分出ている→気づいてゆっくり引っ込む'),
  'orbit-star':d('笑い','star','orbit-dizzy',1100,'星が華麗に周回→回りすぎる→ふらふら逆走して退場'),
  'dot-wave':d('謎','shadow','follow-wave',1050,'点の波が来る→影が追う→波が反転→影も慌てて反転'),
  'smoke-puff':d('笑い','square','puff-surprise',1000,'小煙がぽふっ→四角が覗く→二度目のぽふっで飛び上がる'),
  'single-speed-line':d('謎','shadow','late-chase',1000,'一本の線が通る→間→影が遅れて全力で追いかける'),
  'small-ring':d('かわいい','orb','ring-stuck',1050,'小リングが広がる→丸が通ろうとする→一瞬はまる→ぽんと抜ける'),
  'card-sheen':d('かわいい','star','polish-slip',1000,'星がカードを磨く→ピカッ→磨きすぎて滑って画面外へ'),

  'giant-star-pass':d('笑い','star','too-big',1500,'巨大星が格好よく入ろうとする→大きすぎて入らない→横向きで無理やり通る'),
  'wind-tilt':d('笑い','square','wind-fight',1450,'強風予兆→四角が踏ん張る→耐えたと思う→最後の弱い風で転がる'),
  'bouncing-ball':d('笑い','orb','ball-chase',1500,'巨大ボールが跳ねる→丸が逃げる→追いつかれる寸前→逆にボールへ乗る'),
  'rocket-shape':d('笑い','star','rocket-backfire',1400,'ロケット風図形発進→星が真似する→逆噴射で後ろへ飛ぶ'),
  'color-rings':d('ド派手','orb','ring-chain',1450,'リングが奥から迫る→丸が避ける→次々来る→最後だけ丸を連れていく'),
  'shadow-dash':d('謎','shadow','double-back',1400,'巨大な影が通過→静寂→同じ影が反対向きにゆっくり戻る'),
  'giant-arrow':d('笑い','square','wrong-way',1450,'巨大矢印出現→四角が従う→矢印が急に反転→四角も慌てて戻る'),
  'object-drop':d('笑い','orb','fakeout-drop',1500,'巨大物体が落ちそう→溜め→ぽふっ→小星一個→遅れて本当の衝撃'),
  'card-wave':d('ド派手','star','surf-fail',1500,'カードの波→星がサーフィン→調子に乗る→最後の波で弾かれる'),
  'constellation':d('謎','eye','connect-look',1550,'点がつながる→目が追う→完成しそう→最後の一点だけ逃げる'),
  'dot-stream':d('謎','orb','swim-wrong',1450,'丸い点が大量に流れる→丸が泳ぐ→流れと逆だったと気づく'),
  'mini-tornado':d('笑い','square','tornado-hat',1500,'小竜巻接近→四角が避ける→竜巻が頭上で帽子のように止まる→飛んでいく'),
  'confetti-medium':d('ド派手','star','confetti-proud',1450,'紙吹雪→星が主役顔→紙吹雪が星だけ避ける→追いかける'),
  'domino-cards':d('笑い','square','domino-save-fail',1500,'カードが順に傾く→四角が止めようとする→自分も一緒に傾く'),
  'center-wave':d('ド派手','orb','wave-bounce',1450,'中央衝撃波→丸が構える→波で跳ぶ→二周目で予想外に高く跳ぶ'),
  'giant-exclamation':d('笑い','eye','exclamation-scare',1450,'巨大！落下→目が覗く→びっくりして引っ込む→反対側から確認'),
  'pinball':d('笑い','ball','pinball-confused',1550,'ボールがピンボール→勢い増す→急停止→自分で逆方向へ転がる'),
  'light-hop-cards':d('かわいい','star','hop-copy',1450,'光がカード間を移動→星が真似→一拍遅れて追いつく'),
  'radial-background':d('ド派手','shadow','radial-run',1450,'背景放射→影が中央へ走る→中央寸前で怖気づきUターン'),
  'afterimage-pass':d('謎','shadow','afterimage-return',1400,'高速残像だけ通る→本体が見えない→後からゆっくり本体が戻る'),
  'mystery-orb-dash':d('笑い','orb','story-chase',1500,'いつもの丸が再登場→急いで横切る→巨大ボールが遅れて追う'),

  'giant-drop':d('笑い','ball','too-big-drop',2100,'巨大ボール落下予兆→入らない→少し縮む→まだ入らない→諦めて横から転がる'),
  'hyper-pass':d('ド派手','shadow','hyper-return',2000,'猛烈な通過→全画面風圧→静寂→小さくなって反対から戻る'),
  'comic-burst':d('ド派手','star','burst-ride',2100,'大爆発予兆→コミカル爆発→星が爆風に乗る→着地失敗でぽよん'),
  'giant-wave':d('ド派手','orb','wave-surf',2100,'巨大衝撃波→丸が逃げる→途中から波に乗る→降り方が分からない'),
  'star-swarm':d('ド派手','star','swarm-late',2100,'星の大群→一斉通過→一個だけ遅刻→急いで追う'),
  'all-card-jump':d('笑い','square','jump-late',2000,'全カード構える→一斉ジャンプ→四角だけ遅れてジャンプ→誰もいない'),
  'giant-ball':d('笑い','orb','ball-chase',2150,'巨大ボール横断→丸が逃げる→画面外衝突→丸がヨロヨロ戻る'),
  'depth-ring':d('ド派手','eye','ring-depth',2100,'奥から巨大リング→画面全体へ→目がリングの穴から覗く'),
  'confetti-storm':d('ド派手','square','confetti-buried',2100,'大量紙吹雪→四角が耐える→埋もれたように見える→ひょこっと出る'),
  'smoke-star':d('謎','star','smoke-reveal',2050,'大きな煙雲→何かいる→溜め→中から小さな星一個→突然巨大化'),
  'collision-pop':d('笑い','orb','collision-fake',2050,'左右から接近→大衝突と思わせる→ぽん→二人が反対方向へ跳ねる'),
  'board-float-drop':d('ド派手','square','float-brag',2100,'画面全体浮上→四角が得意げ→ドスン→四角だけ一拍遅れて落ちる'),
  'scatter-illusion':d('笑い','square','scatter-panic',2050,'カードが散ったように見える→四角が慌てて集める→全部勝手に戻る'),
  'giant-arrow-fast':d('ド派手','orb','arrow-dodge',2000,'巨大矢印高速通過→丸が避ける→戻ってきた矢印に二度見'),
  'chain-three':d('完全予想外','star','chain-mistake',2200,'3演出連鎖→星が順番を真似る→3個目だけ先走って失敗'),
  'mystery-orb-drop':d('笑い','orb','story-ride',2150,'いつもの丸が巨大ボールに乗って登場→得意げ→最後にぽよんと落ちる'),

  'mega-star-depth':d('ド派手','star','mega-too-close',2850,'超巨大星が奥から接近→迫る→近すぎる→慌てて後退'),
  'space-window':d('謎','eye','space-peek',3000,'背景が宇宙化→静かな間→巨大な目が端から宇宙を覗く→見つかって消える'),
  'confetti-glitter':d('ド派手','star','glitter-sneeze',2900,'大量紙吹雪＋キラキラ→星が吸い込む→くしゃみのように全画面へ再放出'),
  'burst-all-jump':d('完全予想外','square','double-fakeout',3000,'大爆発→全番号ジャンプ→静止→四角だけ遅れてさらに大ジャンプ'),
  'mystery-eye-peek':d('謎','eye','bad-hide',2900,'巨大な目が覗く→引っ込む→別の端から覗く→隠れたつもりで半分残る'),
  'giant-ball-impact':d('ド派手','ball','impact-bounce',3000,'超巨大ボール接近→画面衝撃→跳ね返る→もう一度小さく戻ってくる'),
  'triple-flyby':d('完全予想外','shadow','triple-wrong-way',2950,'3物体連続通過→3つ目だけ逆走→1・2個目も追って戻る'),
  'alternate-world':d('謎','orb','world-confused',3050,'背景が別世界→丸が入る→戸惑う→出口を間違え何度も戻る'),
  'star-depth-swarm':d('ド派手','star','swarm-crash',3000,'星が奥から大量飛来→整列→一個だけ列に入れず周囲を回る'),
  'mini-chain-world':d('謎','orb','story-offscreen',3100,'短い3連鎖→丸が画面外へ走る→見えない所でドン→反対側からふらふら戻る'),
  'mystery-orb-peek':d('かわいい','orb','story-peek',2900,'いつもの丸が左下から少し覗く→見つかったように隠れる→最後に反対側から一瞬だけ再登場'),
});

function d(emotion,resident,gag,coreBaseMs,story){
  return Object.freeze({
    emotion,resident,gag,coreBaseMs,story,
    phases:Object.freeze({anticipation:.18,action:.42,climax:.20,afterglow:.20}),
    fullScreen:true,slowdown:true,cleanup:true,
  });
}

const emotionCounts=()=>Object.values(DIRECTIVES).reduce((a,x)=>(a[x.emotion]=(a[x.emotion]||0)+1,a),{});
const STORY_ARCS=Object.freeze({
  orb:Object.freeze(['bad-hide','peek-switch','ball-chase','story-ride','offscreen-bonk']),
  star:Object.freeze(['show-off','miss-jump','rocket-backfire','orbit-dizzy','wrong-way']),
  square:Object.freeze(['push-fail','wrong-way','wind-fight','domino-save-fail','jump-late']),
  eye:Object.freeze(['bad-hide','exclamation-scare','connect-look','space-peek','peek-switch']),
});
const storyState={
  orb:0,star:0,square:0,eye:0,
  lastResidents:[],
  scenes:0,
  lastStoryScene:-99,
  lastStoryResident:null,
};

function stageRect(){
  const board=document.querySelector('.board');
  const r=board?.getBoundingClientRect();
  return r||{left:0,top:0,width:innerWidth,height:innerHeight,right:innerWidth,bottom:innerHeight};
}
function make(scope,className,which='back'){
  const el=document.createElement('div');
  el.className=className;
  return scope.add(el,which);
}
function resident(scope,id,which='back'){
  const spec=RESIDENTS[id]||RESIDENTS.orb;
  const el=make(scope,'world-resident '+spec.className,which);
  el.dataset.resident=spec.id;
  el.setAttribute('aria-hidden','true');
  return el;
}
function position(el,x,y,size=1){
  el.style.left=x+'px';el.style.top=y+'px';
  el.style.setProperty('--resident-scale',String(size));
}

const GAG_FAMILIES=Object.freeze({
  hide:new Set(['bad-hide','peek-switch','connect-look','space-peek','story-peek','exclamation-scare']),
  push:new Set(['push-fail','domino-save-fail','wind-fight','float-brag']),
  reverse:new Set(['wrong-way','double-back','hyper-return','afterimage-return','triple-wrong-way','swim-wrong','world-confused','radial-run','arrow-dodge']),
  oversize:new Set(['too-big','too-big-drop','mega-too-close']),
  chase:new Set(['ball-chase','story-chase','late-chase','follow-wave']),
  ride:new Set(['story-ride','burst-ride','wave-surf','surf-fail']),
  fakeout:new Set(['fakeout-drop','double-fakeout','smoke-reveal','collision-fake']),
  offscreen:new Set(['story-offscreen','ricochet','impact-bounce','rocket-backfire']),
  bounce:new Set(['miss-jump','jump-late','wave-bounce','hop-copy','ring-stuck','pinball-confused']),
  spin:new Set(['orbit-dizzy','show-off','confetti-proud','swarm-late','swarm-crash']),
  sneeze:new Set(['confetti-sneeze','glitter-sneeze','puff-surprise']),
  slip:new Set(['polish-slip']),
  brake:new Set(['chain-mistake','ring-chain','ring-depth']),
  panic:new Set(['confetti-buried','scatter-panic','tornado-hat']),
});
function gagFamily(gag){
  for(const [family,set] of Object.entries(GAG_FAMILIES))if(set.has(gag))return family;
  return'cross';
}

function hashText(text){
  let h=2166136261;
  for(const ch of String(text||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}
function motionSignature(eventId){
  const h=hashText(eventId);
  const sides=['left','right','top','bottom'];
  const exits=['right','left','bottom','top'];
  const residents=['orb','star','square','eye','shadow','ball'];
  return Object.freeze({
    code:(h>>>0).toString(36),
    entrance:sides[h%4],
    exit:exits[(h>>>3)%4],
    lane:.18+((h>>>5)%61)/100,
    scale:.82+((h>>>11)%49)/100,
    tilt:-14+((h>>>17)%29),
    pause:90+((h>>>22)%251),
    cameo:residents[(h>>>7)%residents.length],
    cameoMode:['peek','chase','copy','late','bonk'][(h>>>13)%5],
    flip:Boolean((h>>>19)&1),
  });
}
async function playCameo(scope,eventId,primary,{level=3}={}){
  if(level<=1)return;
  const sig=motionSignature(eventId);
  if(sig.cameo===primary&&sig.cameoMode!=='copy')return;
  const r=stageRect(),el=resident(scope,sig.cameo,'back');
  const y=r.top+r.height*(sig.lane>.72?.72:sig.lane<.2?.24:sig.lane);
  const fromLeft=sig.entrance==='left'||sig.entrance==='top';
  position(el,fromLeft?r.left-72:r.right+72,y,.62+sig.scale*.24);
  const dx=(fromLeft?1:-1)*r.width;
  if(sig.cameoMode==='peek'){
    await scope.animate(el,[
      {opacity:0,transform:'translate(-50%,-50%) translateX(0) scale(.7)'},
      {opacity:.88,offset:.35,transform:`translate(-50%,-50%) translateX(${fromLeft?70:-70}px) scale(.9)`},
      {opacity:.88,offset:.68,transform:`translate(-50%,-50%) translateX(${fromLeft?48:-48}px) scale(.85)`},
      {opacity:0,transform:'translate(-50%,-50%) translateX(0) scale(.72)'},
    ],{duration:420+sig.pause,easing:'ease-in-out',fill:'forwards'});
  }else if(sig.cameoMode==='late'){
    await scope.wait(80+sig.pause*.45);
    await scope.animate(el,[
      {opacity:0,transform:'translate(-50%,-50%)'},
      {opacity:1,offset:.14,transform:`translate(-50%,-50%) translateX(${dx*.18}px) rotate(${sig.tilt}deg)`},
      {opacity:1,offset:.72,transform:`translate(-50%,-50%) translateX(${dx*.75}px) rotate(${-sig.tilt}deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(${dx*1.06}px) rotate(${sig.tilt*2}deg)`},
    ],{duration:520+sig.pause,easing:'cubic-bezier(.16,.72,.2,1)',fill:'forwards'});
  }else if(sig.cameoMode==='bonk'){
    await scope.animate(el,[
      {opacity:0,transform:'translate(-50%,-50%) scale(.7)'},
      {opacity:1,offset:.28,transform:`translate(-50%,-50%) translateX(${dx*.34}px) scale(.9)`},
      {opacity:1,offset:.5,transform:`translate(-50%,-50%) translateX(${dx*.42}px) scale(.82,.98)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(${dx*.18}px) translateY(-80px) rotate(${-220*(fromLeft?1:-1)}deg) scale(.72)`},
    ],{duration:560+sig.pause,easing:'cubic-bezier(.18,.8,.22,1)',fill:'forwards'});
  }else if(sig.cameoMode==='copy'){
    await scope.animate(el,[
      {opacity:0,transform:'translate(-50%,-50%) scale(.7)'},
      {opacity:1,offset:.22,transform:`translate(-50%,-50%) translateX(${dx*.2}px) scale(.88)`},
      {opacity:1,offset:.52,transform:`translate(-50%,-50%) translateX(${dx*.32}px) translateY(-30px) rotate(${sig.tilt}deg)`},
      {opacity:.9,offset:.72,transform:`translate(-50%,-50%) translateX(${dx*.38}px) translateY(8px) rotate(${-sig.tilt}deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(${dx*.7}px) scale(.72)`},
    ],{duration:620+sig.pause,easing:'cubic-bezier(.16,.74,.22,1)',fill:'forwards'});
  }else{
    await scope.animate(el,[
      {opacity:0,transform:'translate(-50%,-50%)'},
      {opacity:1,offset:.18,transform:`translate(-50%,-50%) translateX(${dx*.18}px)`},
      {opacity:1,offset:.76,transform:`translate(-50%,-50%) translateX(${dx*.72}px) rotate(${sig.tilt}deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(${dx*1.04}px) rotate(${sig.tilt*1.5}deg)`},
    ],{duration:590+sig.pause,easing:'cubic-bezier(.16,.72,.2,1)',fill:'forwards'});
  }
}
function allCards(grid=document.getElementById('queueGrid')){
  return [...(grid?.querySelectorAll?.('.queue-card')||[])];
}
function stageWash(scope,color='#78e5ff',strength=.18){
  const el=make(scope,'world-stage-wash','back');
  el.style.setProperty('--world-color',color);
  return scope.animate(el,[
    {opacity:0,transform:'scale(1.03)'},
    {opacity:strength,transform:'scale(1)',offset:.25},
    {opacity:strength*.72,transform:'scale(1.012)',offset:.7},
    {opacity:0,transform:'scale(1.035)'},
  ],{duration:520,easing:'ease-in-out',fill:'forwards'});
}
function speedField(scope,color='#fff',direction=1){
  const el=make(scope,'world-speed-field','back');
  el.style.setProperty('--world-color',color);
  return scope.animate(el,[
    {opacity:0,transform:`translateX(${-direction*24}vw)`},
    {opacity:.58,offset:.25,transform:'translateX(0)'},
    {opacity:.34,offset:.72,transform:`translateX(${direction*8}vw)`},
    {opacity:0,transform:`translateX(${direction*22}vw)`},
  ],{duration:650,easing:'cubic-bezier(.16,.72,.2,1)',fill:'forwards'});
}
function rippleCards(scope,grid,intensity=1,pattern='wave'){
  const list=allCards(grid);
  const jobs=[];
  list.forEach((card,i)=>{
    const row=Math.floor(i/7),delay=(pattern==='center'?Math.abs(i-list.length/2)*10:(i%9)*12+row*8);
    let frames;
    if(pattern==='brake')frames=[{transform:'translateX(0)'},{transform:`translateX(${-5*intensity}px) rotate(-.6deg)`},{transform:`translateX(${3*intensity}px) rotate(.3deg)`},{transform:'translateX(0)'}];
    else if(pattern==='jump')frames=[{transform:'translateY(0)'},{transform:`translateY(${-8*intensity}px) scale(1.015)`},{transform:'translateY(0)'}];
    else frames=[{transform:'translateY(0)'},{transform:`translateY(${-4*intensity}px)`},{transform:`translateY(${2*intensity}px)`},{transform:'translateY(0)'}];
    jobs.push(scope.animate(card,frames,{duration:260,delay,easing:'cubic-bezier(.2,.78,.22,1)'}));
  });
  return Promise.all(jobs);
}
function stageBump(scope,intensity=1){
  const board=document.querySelector('.board');
  if(!board||M.isReduced())return Promise.resolve();
  return scope.animate(board,[
    {transform:'translate3d(0,0,0)'},
    {transform:`translate3d(${-4*intensity}px,${2*intensity}px,0)`},
    {transform:`translate3d(${4*intensity}px,${-2*intensity}px,0)`},
    {transform:`translate3d(${-2*intensity}px,${1*intensity}px,0)`},
    {transform:'translate3d(0,0,0)'},
  ],{duration:150,easing:'linear'});
}

async function residentGag(scope,directive,{grid,level=3}={}){
  const r=stageRect(),id=directive.resident||'orb',rawGag=directive.gag,gag=gagFamily(rawGag),sig=motionSignature(directive.eventId||rawGag);
  const el=resident(scope,id,'back');
  const s=level<=1?.72:1;
  if(level<=1){
    position(el,r.left+r.width*.12,r.top+r.height*.72,s*.72);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) scale(${s*.68})`},
      {opacity:.75,transform:`translate(-50%,-50%) scale(${s*.82})`,offset:.45},
      {opacity:0,transform:`translate(-50%,-50%) translateX(18px) scale(${s*.75})`},
    ],{duration:360,easing:'ease-in-out',fill:'forwards'});
    return;
  }
  const left=r.left-70,right=r.right+70,midY=r.top+r.height*sig.lane;
  position(el,sig.flip?right:left,midY,s*sig.scale);

  const cross=(extra='')=>scope.animate(el,[
    {opacity:0,transform:`translate(-50%,-50%) scale(${s*.8*sig.scale}) rotate(${sig.tilt}deg)`},
    {opacity:1,offset:.14,transform:`translate(calc(-50% + ${(sig.flip?-1:1)*r.width*.18}px),-50%) scale(${s*sig.scale}) rotate(${sig.tilt*.35}deg) ${extra}`},
    {opacity:1,offset:.7,transform:`translate(calc(-50% + ${(sig.flip?-1:1)*r.width*.78}px),-50%) scale(${s*sig.scale}) rotate(${-sig.tilt*.35}deg) ${extra}`},
    {opacity:0,transform:`translate(calc(-50% + ${(sig.flip?-1:1)*(r.width+150)}px),-50%) scale(${s*.88*sig.scale}) rotate(${sig.tilt}deg) ${extra}`},
  ],{duration:directive.coreBaseMs*.78+sig.pause,easing:'cubic-bezier(.14,.72,.2,1)',fill:'forwards'});

  if(gag==='hide'){
    position(el,left+18,midY,s);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) translateX(-20px) scale(${s})`},
      {opacity:1,offset:.26,transform:`translate(-50%,-50%) translateX(60px) scale(${s})`},
      {opacity:1,offset:.58,transform:`translate(-50%,-50%) translateX(42px) scale(${s})`},
      {opacity:1,offset:.78,transform:`translate(-50%,-50%) translateX(64px) scale(${s}) rotate(5deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(-35px) scale(${s*.9})`},
    ],{duration:directive.coreBaseMs,easing:'ease-in-out',fill:'forwards'});
  }else if(gag==='push'){
    const x=r.left+r.width*.28;position(el,x,midY,s);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) translateX(-80px) scale(${s})`},
      {opacity:1,offset:.22,transform:`translate(-50%,-50%) translateX(-8px) scale(${s})`},
      {opacity:1,offset:.55,transform:`translate(-50%,-50%) translateX(8px) scale(${s*.96},${s*1.04})`},
      {opacity:1,offset:.66,transform:`translate(-50%,-50%) translateX(0) scale(${s})`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(-45vw) rotate(-280deg) scale(${s*.82})`},
    ],{duration:directive.coreBaseMs,easing:'cubic-bezier(.18,.72,.2,1)',fill:'forwards'});
    void rippleCards(scope,grid,.7,'wave');
  }else if(gag==='reverse'){
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) translateX(0) scale(${s})`},
      {opacity:1,offset:.18,transform:`translate(-50%,-50%) translateX(${r.width*.72}px) scale(${s})`},
      {opacity:1,offset:.52,transform:`translate(-50%,-50%) translateX(${r.width*.86}px) scale(${s}) rotate(8deg)`},
      {opacity:1,offset:.66,transform:`translate(-50%,-50%) translateX(${r.width*.72}px) scale(${s}) rotate(-8deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(-100px) scale(${s*.9}) rotate(-4deg)`},
    ],{duration:directive.coreBaseMs,easing:'cubic-bezier(.16,.76,.2,1)',fill:'forwards'});
  }else if(gag==='oversize'){
    position(el,r.left-10,midY,s*2.5);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) translateX(-25vw) scale(${s*2.2})`},
      {opacity:1,offset:.28,transform:`translate(-50%,-50%) translateX(12vw) scale(${s*2.7})`},
      {opacity:1,offset:.52,transform:`translate(-50%,-50%) translateX(8vw) scale(${s*2.7}) rotate(-4deg)`},
      {opacity:1,offset:.7,transform:`translate(-50%,-50%) translateX(16vw) scale(${s*1.7}) rotate(90deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(115vw) scale(${s*1.7}) rotate(90deg)`},
    ],{duration:directive.coreBaseMs,easing:'cubic-bezier(.18,.7,.22,1)',fill:'forwards'});
  }else if(gag==='chase'){
    const chaser=resident(scope,'ball','back');position(chaser,left-140,midY+20,s*1.45);
    await Promise.all([
      cross(),
      scope.animate(chaser,[
        {opacity:0,transform:`translate(-50%,-50%) translateX(-80px) scale(${s*1.2})`},
        {opacity:1,offset:.24,transform:`translate(-50%,-50%) translateX(${r.width*.2}px) scale(${s*1.45}) rotate(90deg)`},
        {opacity:1,offset:.75,transform:`translate(-50%,-50%) translateX(${r.width*.77}px) scale(${s*1.45}) rotate(520deg)`},
        {opacity:0,transform:`translate(-50%,-50%) translateX(${r.width+180}px) scale(${s*1.3}) rotate(720deg)`},
      ],{duration:directive.coreBaseMs*.92,delay:110,easing:'cubic-bezier(.18,.7,.22,1)',fill:'forwards'}),
    ]);
  }else if(gag==='ride'){
    const ball=resident(scope,'ball','back');position(ball,left,midY+18,s*1.55);position(el,left,midY-36,s*.85);
    await Promise.all([
      scope.animate(ball,[
        {opacity:0,transform:`translate(-50%,-50%) translateX(-80px) scale(${s*1.4}) rotate(0)`},
        {opacity:1,offset:.18,transform:`translate(-50%,-50%) translateX(${r.width*.18}px) scale(${s*1.55}) rotate(110deg)`},
        {opacity:1,offset:.72,transform:`translate(-50%,-50%) translateX(${r.width*.78}px) scale(${s*1.55}) rotate(560deg)`},
        {opacity:0,transform:`translate(-50%,-50%) translateX(${r.width+180}px) scale(${s*1.45}) rotate(760deg)`},
      ],{duration:directive.coreBaseMs,easing:'linear',fill:'forwards'}),
      scope.animate(el,[
        {opacity:0,transform:`translate(-50%,-50%) translateX(-80px) translateY(-40px) scale(${s*.8})`},
        {opacity:1,offset:.2,transform:`translate(-50%,-50%) translateX(${r.width*.2}px) translateY(-42px) scale(${s*.9})`},
        {opacity:1,offset:.72,transform:`translate(-50%,-50%) translateX(${r.width*.76}px) translateY(-44px) rotate(8deg) scale(${s*.9})`},
        {opacity:0,transform:`translate(-50%,-50%) translateX(${r.width*.82}px) translateY(95px) rotate(260deg) scale(${s*.82})`},
      ],{duration:directive.coreBaseMs,delay:40,easing:'cubic-bezier(.16,.72,.2,1)',fill:'forwards'}),
    ]);
  }else if(gag==='fakeout'){
    position(el,r.left+r.width*.5,r.top+r.height*.48,s);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) scale(.1)`},
      {opacity:.95,offset:.26,transform:`translate(-50%,-50%) scale(${s*.28})`},
      {opacity:.95,offset:.55,transform:`translate(-50%,-50%) scale(${s*.3})`},
      {opacity:1,offset:.72,transform:`translate(-50%,-50%) scale(${s*2.2})`},
      {opacity:0,transform:`translate(-50%,-50%) scale(${s*3.8}) rotate(35deg)`},
    ],{duration:directive.coreBaseMs,easing:'cubic-bezier(.18,.78,.2,1)',fill:'forwards'});
    void stageBump(scope,.85);
  }else if(gag==='offscreen'){
    await cross();
    await scope.wait(120);
    void stageBump(scope,.65);
    position(el,right+30,midY+40,s*.8);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) translateX(60px) rotate(10deg)`},
      {opacity:1,offset:.22,transform:`translate(-50%,-50%) translateX(-80px) rotate(-9deg)`},
      {opacity:1,offset:.62,transform:`translate(-50%,-50%) translateX(-125px) rotate(7deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(-210px) rotate(-4deg)`},
    ],{duration:directive.coreBaseMs*.5,easing:'ease-out',fill:'forwards'});
  }else if(gag==='bounce'){
    position(el,r.left+r.width*.42,r.bottom+30,s);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) translateY(60px) scale(${s})`},
      {opacity:1,offset:.22,transform:`translate(-50%,-50%) translateY(-90px) scale(${s}) rotate(-8deg)`},
      {opacity:1,offset:.45,transform:`translate(-50%,-50%) translateY(24px) scale(${s*.92}) rotate(4deg)`},
      {opacity:1,offset:.68,transform:`translate(-50%,-50%) translateY(-42px) scale(${s}) rotate(-3deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateY(120px) scale(${s*.86}) rotate(12deg)`},
    ],{duration:directive.coreBaseMs,easing:'cubic-bezier(.18,.78,.22,1)',fill:'forwards'});
  }else if(gag==='spin'){
    position(el,r.left+r.width*.5,midY,s);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) scale(${s*.7}) rotate(0)`},
      {opacity:1,offset:.2,transform:`translate(-50%,-50%) scale(${s}) rotate(40deg)`},
      {opacity:1,offset:.58,transform:`translate(-50%,-50%) scale(${s}) rotate(760deg)`},
      {opacity:1,offset:.78,transform:`translate(-50%,-50%) translateX(22px) scale(${s*.92}) rotate(820deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(140px) scale(${s*.8}) rotate(890deg)`},
    ],{duration:directive.coreBaseMs,easing:'cubic-bezier(.16,.72,.2,1)',fill:'forwards'});
  }else if(gag==='sneeze'){
    position(el,r.left+r.width*.46,midY,s);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) scale(${s*.8})`},
      {opacity:1,offset:.25,transform:`translate(-50%,-50%) scale(${s})`},
      {opacity:1,offset:.5,transform:`translate(-50%,-50%) scale(${s*.82},${s*1.18})`},
      {opacity:1,offset:.62,transform:`translate(-50%,-50%) scale(${s*1.28},${s*.78}) rotate(-5deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(180px) rotate(220deg) scale(${s*.85})`},
    ],{duration:directive.coreBaseMs,easing:'cubic-bezier(.18,.8,.22,1)',fill:'forwards'});
    void rippleCards(scope,grid,.65,'wave');
  }else if(gag==='slip'){
    position(el,r.left+r.width*.24,midY,s);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) translateX(-80px) scale(${s})`},
      {opacity:1,offset:.22,transform:`translate(-50%,-50%) translateX(0) scale(${s})`},
      {opacity:1,offset:.5,transform:`translate(-50%,-50%) translateX(30px) rotate(0)`},
      {opacity:1,offset:.7,transform:`translate(-50%,-50%) translateX(190px) rotate(170deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(55vw) rotate(420deg) scale(${s*.8})`},
    ],{duration:directive.coreBaseMs,easing:'cubic-bezier(.12,.78,.18,1)',fill:'forwards'});
  }else if(gag==='brake'){
    position(el,r.left+r.width*.3,midY,s);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) translateX(-100px) scale(${s})`},
      {opacity:1,offset:.28,transform:`translate(-50%,-50%) translateX(150px) scale(${s})`},
      {opacity:1,offset:.45,transform:`translate(-50%,-50%) translateX(195px) scale(${s*.92},${s*1.08})`},
      {opacity:1,offset:.62,transform:`translate(-50%,-50%) translateX(170px) rotate(-4deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(135px) rotate(3deg) scale(${s*.9})`},
    ],{duration:directive.coreBaseMs,easing:'cubic-bezier(.14,.82,.2,1)',fill:'forwards'});
    void rippleCards(scope,grid,.8,'brake');
  }else if(gag==='panic'){
    position(el,r.left+r.width*.5,midY,s);
    await scope.animate(el,[
      {opacity:0,transform:`translate(-50%,-50%) scale(${s*.7})`},
      {opacity:1,offset:.18,transform:`translate(-50%,-50%) scale(${s})`},
      {opacity:1,offset:.38,transform:`translate(-50%,-50%) translate(-18px,-8px) rotate(-8deg)`},
      {opacity:1,offset:.56,transform:`translate(-50%,-50%) translate(20px,7px) rotate(9deg)`},
      {opacity:1,offset:.72,transform:`translate(-50%,-50%) translate(-12px,5px) rotate(-5deg)`},
      {opacity:0,transform:`translate(-50%,-50%) translateX(-55vw) rotate(-120deg) scale(${s*.85})`},
    ],{duration:directive.coreBaseMs,easing:'cubic-bezier(.18,.78,.22,1)',fill:'forwards'});
  }else{
    await cross();
  }
}

async function playIdleCompanion(event,directive,{grid,signal,level=3}={}){
  if(!M||!directive)return;
  const scope=M.createScope('world-idle:'+event.id);
  const abort=()=>scope.abort('idle-interrupt');
  signal?.addEventListener?.('abort',abort,{once:true});
  storyState.scenes+=1;
  storyState.lastResidents.push(directive.resident);
  storyState.lastResidents=storyState.lastResidents.slice(-8);
  let sceneDirective={...directive,eventId:event.id};
  const arc=STORY_ARCS[directive.resident];
  const canStory=arc&&storyState.scenes-storyState.lastStoryScene>=2;
  if(canStory&&Math.random()<.48){
    const stage=storyState[directive.resident]||0;
    sceneDirective={...directive,eventId:event.id,gag:arc[stage%arc.length],story:directive.story+'／前回から続く住人の小話'};
    storyState[directive.resident]=(stage+1)%arc.length;
    storyState.lastStoryScene=storyState.scenes;
    storyState.lastStoryResident=directive.resident;
  }
  try{
    const colors={笑い:'#ffb84d',ド派手:'#78e5ff',謎:'#8f91ff',かわいい:'#ff9bc5','完全予想外':'#73dda0'};
    const color=colors[directive.emotion]||'#78e5ff';
    const anticipation=stageWash(scope,color,directive.emotion==='ド派手'?.24:.14);
    await scope.wait(level<=1?70:120);
    const gag=residentGag(scope,sceneDirective,{grid,level});
    const cameo=playCameo(scope,event.id,sceneDirective.resident,{level});
    const field=level<=1?Promise.resolve():speedField(scope,color,Math.random()<.5?1:-1);
    await scope.wait(level<=1?100:Math.max(120,directive.coreBaseMs*.33));
    const climax=Promise.all([
      level<=1?Promise.resolve():(directive.emotion==='ド派手'||directive.emotion==='完全予想外'?stageBump(scope,directive.emotion==='完全予想外'?1.05:.75):Promise.resolve()),
      rippleCards(scope,grid,level<=1?.2:(directive.emotion==='ド派手'?1:.55),directive.emotion==='笑い'?'brake':'wave'),
    ]);
    await Promise.allSettled([anticipation,gag,cameo,field,climax]);
    await scope.wait(level<=1?70:160);
  }finally{
    signal?.removeEventListener?.('abort',abort);
    scope.cleanup();
  }
}

async function playStatusReaction(kind,{grid,signal,level=3,rect}={}){
  if(!M)return;
  const scope=M.createScope('world-status:'+kind);
  const abort=()=>scope.abort('status-abort');
  signal?.addEventListener?.('abort',abort,{once:true});
  const color=kind==='call'?'#73dda0':kind==='guided'?'#78e5ff':kind==='hold'?'#ffd84f':'#dfe7ea';
  try{
    const wash=stageWash(scope,color,level<=1?.12:(kind==='call'?.46:.28));
    const speed=level<=1?Promise.resolve():speedField(scope,color,kind==='guided'?1:-1);
    const cards=kind==='call'
      ?rippleCards(scope,grid,level<=1?.2:1.2,'jump')
      :kind==='hold'?rippleCards(scope,grid,level<=1?.16:.85,'brake')
      :rippleCards(scope,grid,level<=1?.14:.75,'wave');
    const gagDirective=kind==='call'?d('ド派手','orb','offscreen-bonk',1250,'呼出衝撃で住人が吹き飛び、あとから戻る')
      :kind==='guided'?d('笑い','star','late-chase',900,'出発風圧を星が追いかける')
      :kind==='hold'?d('笑い','square','push-fail',900,'世界ごと急ブレーキ')
      :d('笑い','star','ricochet',950,'パリンに驚いて星が跳ね返る');
    const gag=residentGag(scope,gagDirective,{grid,level});
    const bump=kind==='call'?stageBump(scope,1.2):kind==='hold'?stageBump(scope,.75):stageBump(scope,.45);
    await Promise.allSettled([wash,speed,cards,gag,bump]);
  }finally{
    signal?.removeEventListener?.('abort',abort);
    scope.cleanup();
  }
}

function audit(events){
  const source=Array.isArray(events)?events:[];
  return source.map(e=>{
    const dir=DIRECTIVES[e.id];
    const phaseExtra=dir?480:0;
    const revisedBase=(dir?.coreBaseMs||e.duration||0)+phaseExtra;
    return{
      id:e.id,
      tier:e.tier,
      kind:e.kind,
      emotion:dir?.emotion||'未分類',
      resident:dir?.resident||null,
      gag:dir?.gag||null,
      previousMs:Number(e.duration||0),
      revisedBaseMs:revisedBase,
      revisedAtCurrentSlowdownMs:Math.round(M?M.ms(revisedBase):revisedBase),
      anticipation:Boolean(dir),
      action:Boolean(dir),
      climax:Boolean(dir),
      afterglow:Boolean(dir),
      fullScreen:Boolean(dir?.fullScreen),
      slowdown:Boolean(dir?.slowdown),
      cleanup:Boolean(dir?.cleanup),
      story:dir?.story||'',
      signature:motionSignature(e.id).code,
      entrance:motionSignature(e.id).entrance,
      exit:motionSignature(e.id).exit,
      cameo:motionSignature(e.id).cameo,
      cameoMode:motionSignature(e.id).cameoMode,
    };
  });
}
function diagnostics(events=[]){
  const report=audit(events);
  return{
    residentCount:Object.keys(RESIDENTS).length,
    residents:Object.values(RESIDENTS),
    directiveCount:Object.keys(DIRECTIVES).length,
    unmappedGags:[...new Set(Object.values(DIRECTIVES).map(x=>x.gag).filter(x=>gagFamily(x)==='cross'))],
    emotionCounts:emotionCounts(),
    storyState:{...storyState,lastResidents:[...storyState.lastResidents]},storyArcs:Object.fromEntries(Object.entries(STORY_ARCS).map(([k,v])=>[k,[...v]])),
    auditCount:report.length,
    fullScreenCount:report.filter(x=>x.fullScreen).length,
    slowdownCount:report.filter(x=>x.slowdown).length,
    cleanupCount:report.filter(x=>x.cleanup).length,
  };
}
function resetForTest(){
  storyState.orb=0;storyState.star=0;storyState.square=0;storyState.eye=0;storyState.lastResidents=[];storyState.scenes=0;storyState.lastStoryScene=-99;storyState.lastStoryResident=null;
}

window.ASOBOON_BOARD_WORLD=Object.freeze({
  version:'1.0.0',
  residents:RESIDENTS,
  directives:DIRECTIVES,
  playIdleCompanion,
  playStatusReaction,
  audit,
  diagnostics,
  resetForTest,
});
})();