(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
const choices=[
  {id:'adult',title:'大人だけ出る',sub:'黄色ホルダーを持つ保護者',icon:'person'},
  {id:'all',title:'全員で出る',sub:'あとで戻って遊ぶ',icon:'group'},
  {id:'return',title:'再入場する',sub:'一時退場から戻った',icon:'return'},
  {id:'exit',title:'今日は帰る',sub:'完全退場する',icon:'check'}
];
const iconPaths={
 person:'<circle cx="12" cy="7" r="3.1"/><path d="M6.5 20v-2.2a5.5 5.5 0 0 1 11 0V20"/><path d="M19 5v7m-3-3 3 3 3-3"/>',
 group:'<circle cx="9" cy="7" r="2.7"/><circle cx="17.5" cy="8.5" r="2.2"/><path d="M3.5 20v-2.5a5.5 5.5 0 0 1 11 0V20M16 15a4 4 0 0 1 4.5 4v1"/>',
 return:'<path d="M9 7 4 12l5 5"/><path d="M4.5 12H16a4.5 4.5 0 0 1 0 9h-2"/>',
 check:'<path d="M4.5 6.5h15v11h-15z"/><path d="m8 12 2.5 2.5 5-5"/><path d="M8 21h8"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
 alert:'<path d="m12 3 9 16H3z"/><path d="M12 9v4m0 3h.01"/>'
};
function icon(name){return '<svg class="entry-svg" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'+(iconPaths[name]||'')+'</svg>'}
function object(type){return '<span class="entry-object entry-object--'+type+'" aria-hidden="true"><i class="entry-object-shape"></i></span>'}
function needed(kind,label,description){
 return '<div class="entry-needed entry-needed--'+kind+'">'+object(kind)+'<div class="entry-needed-copy"><span class="entry-eyebrow">必要なもの</span><h2 tabindex="-1">'+label+'</h2><p>'+description+'</p></div></div>';
}
function steps(items){
 return '<section class="entry-checklist" aria-label="手順"><h3>やること</h3><ol class="entry-steps">'+items.map(x=>'<li>'+x+'</li>').join('')+'</ol></section>';
}
const timeNote='<p class="entry-note">'+icon('clock')+'<span><strong>一時退場中も利用時間は進みます。</strong></span></p>';
function notice(text,heading='ご注意'){
 return '<aside class="entry-warning" role="note">'+icon('alert')+'<div><strong>'+heading+'</strong><p>'+text+'</p></div></aside>';
}
const content={
 adult:needed('yellow','黄色ホルダー','大人だけ外出できるのは、黄色ホルダーをお持ちの保護者のみです。')
  +notice('お子さまだけを館内に残すことはできません。保護者全員が外出する場合は、お子さまも一緒に一時退場してください。','別の保護者が館内に残ってください')
  +steps(['<strong>黄色ホルダー</strong>をお持ちください。','退場前に<strong>スタッフへお声がけ</strong>ください。','戻るときは<strong>黄色ホルダーをスタッフへ提示</strong>してください。'])+timeNote,
 all:needed('receipt','レシートを保管','再入場するときに必要です。なくさずお持ちください。')
  +steps(['ロッカーの<strong>荷物をすべて取り出す</strong>。','赤ホルダーから<strong>レシートを抜いて持つ</strong>。','<strong>赤・黄色すべてのホルダーを返却</strong>ボックスへ入れ、退場前に<strong>スタッフへお声がけ</strong>ください。'])
  +'<p class="entry-guidance"><strong>戻るとき：</strong>保管したレシートをスタッフへお見せください。</p>'+timeNote,
 return:'<h2 tabindex="-1" class="entry-question">どちらをお持ちですか？</h2><p class="entry-question-lead">一時退場したときの持ち物を選んでください。</p>'
  +'<div class="entry-return-options">'+
    '<button type="button" data-entry-choice="returnAll">'+object('receipt')+'<span><strong>レシート</strong><small>全員で一時退場した</small></span><span class="entry-chevron" aria-hidden="true">›</span></button>'+
    '<button type="button" data-entry-choice="returnAdult">'+object('yellow')+'<span><strong>黄色ホルダー</strong><small>大人だけ一時退場した</small></span><span class="entry-chevron" aria-hidden="true">›</span></button>'+
    '<button type="button" class="entry-unknown" data-entry-choice="returnUnknown"><span><strong>どちらもない・分からない</strong><small>スタッフへの確認方法</small></span><span class="entry-chevron" aria-hidden="true">›</span></button>'+
   '</div>',
 returnAll:needed('receipt','レシートを提示','一時退場時に保管したレシートをご準備ください。')
  +steps(['ASOBooN入口の<strong>スタッフへレシートをお見せください</strong>。'])
  +'<p class="entry-guidance">レシートが見つからない場合は、スタッフへお声がけください。</p>'+timeNote,
 returnAdult:needed('yellow','黄色ホルダーを提示','外出時にお持ちになった黄色ホルダーをご準備ください。')
  +steps(['ASOBooN入口の<strong>スタッフへ黄色ホルダーをお見せください</strong>。'])+timeNote,
 returnUnknown:'<h2 tabindex="-1" class="entry-question">入口スタッフへお声がけください</h2>'
  +notice('レシート・黄色ホルダーが見当たらない場合は、入口のスタッフが状況を確認してご案内します。','持ち物がないとき')+timeNote,
 exit:'<h2 tabindex="-1" class="entry-question">今日はここで遊び終わり</h2>'
  +'<p class="entry-question-lead">お帰りになる前に、次の2つをご確認ください。</p>'
  +steps(['ロッカーを<strong>空にして、忘れ物がないか</strong>確認する。','<strong>赤・黄色すべてのホルダーを返却</strong>ボックスへ入れる。'])
  +notice('あとで戻って遊ぶ場合は、「全員で出る（あとで戻って遊ぶ）」をお選びください。','また戻って遊ぶ予定なら')
};
function route(){return String(new URLSearchParams(location.search).get('view')||'home')}
function page(){return '<section class="page-card pv7-page v25-entry-page"><div class="pv7-head v25-entry-head"><span class="pv7-eyebrow">利用中のご案内</span><h1>一時退場・再入場</h1><p>今、どうしたいですか？</p></div><div class="pv7-body"><div id="entryChoices" class="entry-options" aria-label="ご希望の操作">'+choices.map(c=>'<button type="button" class="entry-choice entry-choice--'+c.id+'" data-entry-choice="'+c.id+'"><span class="entry-choice-icon">'+icon(c.icon)+'</span><strong>'+c.title+'</strong><span class="entry-choice-sub">'+c.sub+'</span><span class="entry-choice-arrow" aria-hidden="true">›</span></button>').join('')+'</div><section id="entryDetail" class="entry-detail" aria-live="polite" hidden></section></div></section>'}
function show(id){
 const panel=root.querySelector('#entryDetail'),menu=root.querySelector('#entryChoices');if(!panel||!menu)return;
 if(id==='menu'){
  panel.hidden=true;panel.replaceChildren();menu.hidden=false;
  root.querySelector('.v25-entry-head p').textContent='今、どうしたいですか？';
  root.querySelector('.entry-choice')?.focus();return;
 }
 if(!Object.prototype.hasOwnProperty.call(content,id))return;
 menu.hidden=true;panel.hidden=false;
 root.querySelector('.v25-entry-head p').textContent='必要なものと手順をご確認ください。';
 const back=(id==='returnAll'||id==='returnAdult'||id==='returnUnknown')?'return':'menu';
 panel.innerHTML='<button type="button" class="entry-back" data-entry-choice="'+back+'">← '+(back==='return'?'持ち物を選び直す':'4つの選択肢へ戻る')+'</button>'+content[id];
 panel.querySelector('h2')?.focus({preventScroll:true});
 panel.scrollIntoView({block:'start',behavior:'auto'});
}
root.addEventListener('click',e=>{const button=e.target.closest?.('[data-entry-choice]');if(button&&route()==='entry')show(button.dataset.entryChoice)});
function patch(){queued=false;if(route()!=='entry')return;const main=root.querySelector('main.view');if(!main||main.querySelector('.v25-entry-page'))return;main.innerHTML=page();main.dataset.pv7Key='entry'}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(patch,0));
patch();
})();
