(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
const choices=[
 ['adult','大人だけ一時退場する','お子さまは館内に残ります'],
 ['all','全員で一時退場する','あとで戻って遊びます'],
 ['return','一時退場から戻ってきた','再入場の方法を確認します'],
 ['exit','今日は帰る（完全退場）','ご利用を終えます']
];
const timeNote='<p class="entry-note">一時退場中も利用時間は進みます。</p>';
function steps(items){return '<ol class="entry-steps">'+items.map(x=>'<li>'+x+'</li>').join('')+'</ol>'}
const content={
 adult:'<h2 tabindex="-1">黄色ホルダーをお持ちください</h2><p>大人だけの外出は、黄色ホルダーをお持ちの保護者に限ります。</p><div class="entry-warning"><strong>館内に別の保護者が残る必要があります</strong><p>お子さまだけを館内に残すことはできません。保護者全員が外出する場合は、お子さまも一緒に一時退場してください。</p></div>'+steps(['退場前にスタッフへお声がけください。','戻るときは、黄色ホルダーをスタッフへお見せください。'])+timeNote,
 all:'<h2 tabindex="-1">レシートを保管してください</h2><p>再入場するときに必要です。</p>'+steps(['ロッカーの荷物をすべて取り出します。','赤ホルダーからレシートを抜いて、お持ちください。','赤・黄色すべてのホルダーを返却ボックスへ入れ、退場前にスタッフへお声がけください。'])+'<p class="entry-note">戻るときは、保管したレシートをスタッフへお見せください。</p>'+timeNote,
 return:'<h2 tabindex="-1">どのように一時退場しましたか？</h2><div class="entry-options"><button type="button" data-entry-choice="returnAll">全員で一時退場した<span>レシートを持っています</span></button><button type="button" data-entry-choice="returnAdult">大人だけ一時退場した<span>黄色ホルダーを持っています</span></button></div>',
 returnAll:'<h2 tabindex="-1">レシートをスタッフへお見せください</h2><p>一時退場時に保管したレシートをご準備ください。</p><p class="entry-note">レシートが見つからない場合は、スタッフへお声がけください。</p>'+timeNote,
 returnAdult:'<h2 tabindex="-1">黄色ホルダーをスタッフへお見せください</h2><p>外出時にお持ちになった黄色ホルダーをご提示ください。</p>'+timeNote,
 exit:'<h2 tabindex="-1">お荷物とホルダーをご確認ください</h2>'+steps(['ロッカーを空にし、忘れ物がないか確認します。','赤・黄色すべてのホルダーを返却ボックスへ入れます。'])+'<p class="entry-note">また戻って遊ぶ場合は「全員で一時退場する」をお選びください。</p>'
};
function route(){return String(new URLSearchParams(location.search).get('view')||'home')}
function page(){return '<section class="page-card pv7-page v25-entry-page"><div class="pv7-head v25-entry-head"><span class="pv7-eyebrow">利用中のご案内</span><h1>一時退場・再入場</h1><p>今したいことをお選びください。</p></div><div class="pv7-body"><div id="entryChoices" class="entry-options">'+choices.map(([id,title,sub])=>'<button type="button" data-entry-choice="'+id+'"><strong>'+title+'</strong><span>'+sub+'</span></button>').join('')+'</div><section id="entryDetail" class="entry-detail" hidden></section></div></section>'}
function show(id){
 const panel=root.querySelector('#entryDetail'),menu=root.querySelector('#entryChoices');if(!panel||!menu)return;
 if(id==='menu'){panel.hidden=true;panel.replaceChildren();menu.hidden=false;menu.querySelector('button')?.focus();return}
 if(!content[id])return;
 menu.hidden=true;panel.hidden=false;
 panel.innerHTML='<button type="button" class="entry-back" data-entry-choice="'+(id.startsWith('return')&&id!=='return'?'return':'menu')+'">← 選び直す</button>'+content[id];
 panel.querySelector('h2')?.focus();
}
root.addEventListener('click',e=>{const button=e.target.closest?.('[data-entry-choice]');if(button&&route()==='entry')show(button.dataset.entryChoice)});
function patch(){queued=false;if(route()!=='entry')return;const main=root.querySelector('main.view');if(!main||main.querySelector('.v25-entry-page'))return;main.innerHTML=page();main.dataset.pv7Key='entry'}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(patch,0));
patch();
})();
