/* CHOCO MINT SODA route content: lazy-loaded only off HOME. */
(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function siteHref(path){return new URL(path, E.siteBase||'https://asoboon.github.io/asoboon-stamp/').href}
function hubRow(title,sub,view,panel='',icon='›'){
 return `<button type="button" class="cm-hub-row" data-v7-view="${esc(view)}"${panel?` data-v7-panel="${esc(panel)}"`:''}><span class="cm-hub-icon" aria-hidden="true">${esc(icon)}</span><span class="cm-hub-label"><strong>${esc(title)}</strong><small>${esc(sub)}</small></span><span class="cm-hub-chevron" aria-hidden="true">›</span></button>`;
}
function hubLink(title,sub,path,icon='›'){
 return `<a class="cm-hub-row" href="${esc(siteHref(path))}" data-external="1" target="_blank" rel="noopener noreferrer"><span class="cm-hub-icon" aria-hidden="true">${esc(icon)}</span><span class="cm-hub-label"><strong>${esc(title)}</strong><small>${esc(sub)}（別の画面で開く）</small></span><span class="cm-hub-chevron" aria-hidden="true">↗</span></a>`;
}
function guidePage(){return `<section class="page-card cm-hub" aria-label="ご利用案内"><header class="cm-hub-head"><span class="cm-hub-eyebrow">ASOBooN GUIDE</span><h1>ご利用案内</h1><p>知りたい内容を選んでください。</p></header><div class="cm-hub-list" aria-label="ご利用案内の各項目">
${hubRow('アソブーンタイマー','入場・終了の時刻を確認','timeguide','','◷')}
${hubRow('初めての方','受付から入場までの流れ','first','','？')}
${hubRow('料金','大人600円・子ども900円','first','price','¥')}
${hubRow('館内ルール','安全に遊ぶためのお約束','rules','','✓')}
${hubRow('駐車場・アクセス','車でお越しの方へ','parking','','P')}
${hubRow('一時退場・再入場','外出と戻り方をご案内','entry','','↩')}
${hubLink('営業日カレンダー','休館日・営業予定','miniapp-v2/production/business-calendar.html','▦')}
${hubLink('イベントカレンダー','イベント情報を見る','miniapp-v2/production/event-calendar.html','☆')}
${hubRow('よくある質問','困ったときはこちら','faq','','!')}
</div>${hubRow('ホームへ戻る','営業状況・空き状況を見る','home','','⌂')}</section>`}
function faqPage(){queueMicrotask(applyFaqLabels);return `<section class="page-card cm-hub" aria-label="よくある質問"><header class="cm-hub-head"><span class="cm-hub-eyebrow">HELP / FAQ</span><h1>よくある質問</h1><p>知りたい項目をタップして答えを確認できます。予約からご利用後まで、このアプリでご案内します。</p></header><div class="cm-faq-find" role="search" aria-label="質問を探す"><label for="cmFaqQuery">質問を検索</label><div class="cm-faq-find-field"><input id="cmFaqQuery" type="search" autocomplete="off" placeholder="例：料金・駐車場・再入場" aria-controls="cmFaqList" /><button id="cmFaqClear" type="button" hidden aria-label="検索文字を消去">消す</button></div><p id="cmFaqResult" role="status" aria-live="polite">16件の質問</p></div><div id="cmFaqList" class="cm-faq" aria-label="ご利用に関するよくある質問">
<details><summary>受付は何時から始まりますか？</summary><p>WEB受付は対象日の7:00から、LINEミニアプリの当日受付は9:30からです。通常の開館は10:00です。受付開始と開館の時刻は異なります。</p></details>
<details><summary>今日の受付枠・残人数はどこで確認するの？</summary><p>HOMEの「受付の空き状況」に、WEB・LINEそれぞれの残り人数と混雑予想を表示します。最新の確認時刻も一緒に確認してください。</p></details>
<details><summary>残人数が「—」や「確認中」の場合は？</summary><p>AirWAITで人数を確認できない、またはその枠が非公開の場合です。「0人」「満員」「空きあり」のどれとも断定できません。HOMEを開き直すと再確認されます。</p></details>
<details><summary>WEB受付とLINE受付は同じですか？</summary><p>別の受付方法です。WEB受付はAirWAITのWEB受付、LINE受付はミニアプリの店舗受付系です。開始時間と空き人数はそれぞれ違います。</p></details>
<details><summary>受付番号・呼出の順番を知りたい</summary><p>画面下の「呼出」から番号と呼出状態を確認できます。受付後はそこで最新状態を確かめてください。</p></details>
<details><summary>呼出されたら何分以内に行けばいい？</summary><p>呼出から30分以内にASOBooN入口の受付へお越しください。30分経過後は自動キャンセルの対象です。各回の最終入場時刻にもご注意ください。</p></details>
<details><summary>受付をキャンセルしたい</summary><p>画面下の「呼出」で受付内容を確認し、取消操作を行えます。再度受付する場合は公開されている枠を確認してください。</p></details>
<details><summary>受付枠が全部なくなったら？</summary><p>非公開の枠は受付できません。予約枠の公開状態が変わることがありますが、表示されていない空きを保証することはできません。営業予定は営業日カレンダーでご確認ください。</p></details>
<details><summary>今日の営業時間・定休日は？</summary><p>通常は平日10:00〜17:00、土日祝10:00〜18:00、定休日は火曜日です。臨時変更や平日特定日はHOMEの「今日の営業」と営業日カレンダーに表示されます。</p></details>
<details><summary>何時間遊べますか？</summary><p>通常平日は時間無制限、平日特定日は3時間、土日祝・月曜は2時間30分が基本です。入場日の営業区分で変わります。「アソブーンタイマー」で終了時刻の目安を確認できます。</p></details>
<details><summary>入場料金はいくら？</summary><p>大人600円・子ども900円です。生後6か月未満のお子さまは、同じ会計に子どもが複数いる場合の2人目以降が無料です。詳しくは「料金」案内をご確認ください。</p></details>
<details><summary>乳幼児向けの場所はある？</summary><p>0歳〜1歳6か月のお子さま向けの「オレンジ・ポンド」があります。利用対象を守って安全に遊びましょう。</p></details>
<details><summary>館内で飲食できますか？</summary><p>館内での食事はできません。飲み物は土足エリアでお願いします。遊具エリアには持ち込まないでください。</p></details>
<details><summary>一時退場してから再入場できる？</summary><p>「一時退場・再入場」に目的ごとの手順があります。再入場時には当日のレシートを提示してください。ホルダーの取り扱いと戻る場所も確認できます。</p></details>
<details><summary>ロッカーはありますか？</summary><p>小ロッカー約37L、大ロッカー約50Lがあります。利用時は鍵や貴重品の管理にご注意ください。</p></details>
<details><summary>車以外でも行ける？ 駐車場は？</summary><p>ASOBooNは川口ハイウェイオアシス内にあり、一般道からも来場できます。高速道路側と一般道側で入口が違うため、「駐車場・アクセス」をご確認ください。</p></details>
</div><div class="cm-hub-list" aria-label="関連する案内へ進む">
${hubRow('本日の受付枠','WEB・LINE残人数を見る','home','','⌂')}
${hubRow('呼出状況','受付番号と入場案内','callstatus','','◷')}
${hubRow('料金','ご利用料金の詳しい案内','first','price','¥')}
${hubRow('一時退場・再入場','外出・戻り方','entry','','↩')}
${hubRow('館内ルール','安全・飲食など','rules','','✓')}
${hubRow('駐車場・アクセス','行き方・駐車場','parking','','P')}
${hubRow('ご利用案内へ戻る','案内トップ','guide','','‹')}
</div></section>`}
function playPage(){return `<section class="page-card cm-hub" aria-label="あそび"><header class="cm-hub-head"><span class="cm-hub-eyebrow">ASOBooN PLAY</span><h1>あそび</h1><p>館内でも、待ち時間でも。遊びたいものを選んでね。</p></header><div class="cm-hub-list" aria-label="あそびの各項目">
${hubLink('ASOQUEST スタンプラリー','館内のQRから車のパーツを集めよう','miniapp-v2/production/asoquest/','★')}
${hubLink('ブーンRUN','障害物をよけて走ろう','boonrun/','▶')}
${hubLink('ブーンジャンプ','3タップで飛距離勝負','boonjump/','▶')}
${hubLink('BOON パズル','ブロックを動かしてゴールを目指そう','https://asoboon.github.io/asoboon-3d/boon-block-next/?v=23','▦')}
</div><div class="cm-hub-tip"><strong>スタンプラリーに参加する方へ</strong><p>パーツの取得は館内の専用QRから行ってください。完成した画面をスタッフへ見せてね。</p></div>${hubRow('ホームへ戻る','空き状況を見る','home','','⌂')}</section>`}

function applyFaqLabels(){
 const query=document.getElementById('cmFaqQuery');
 if(!query||!query.closest('#app'))return;
 const t=window.ASOBOON_I18N?.t||((x)=>x);
 const label=document.querySelector('.cm-faq-find label');
 if(label)label.textContent=t('質問を検索');
 query.placeholder=t('例：料金・駐車場・再入場');
 const clear=document.getElementById('cmFaqClear');
 if(clear){clear.textContent=t('消す');clear.setAttribute('aria-label',t('検索文字を消去'))}
 updateFaqResults();
}
function updateFaqResults(){
 const input=document.getElementById('cmFaqQuery'),list=document.getElementById('cmFaqList');
 if(!input||!list||!list.closest('#app'))return;
 const needle=String(input.value||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'').trim();
 let count=0;
 for(const item of list.querySelectorAll(':scope > details')){
   const haystack=String(item.textContent||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
   const show=!needle||haystack.includes(needle);item.hidden=!show;if(show)count++;
 }
 const notices={
  ja:{found:n=>n+'件見つかりました',none:'一致する質問がありません。別の言葉でもお試しください。',all:'16件の質問'},
  en:{found:n=>n+' results',none:'No matching questions. Try another word.',all:'16 questions'},
  'zh-CN':{found:n=>n+'个结果',none:'没有找到匹配的问题。请尝试其他关键词。',all:'16个问题'},
  vi:{found:n=>n+' kết quả',none:'Không tìm thấy câu hỏi. Hãy thử từ khác.',all:'16 câu hỏi'},
  ne:{found:n=>n+' नतिजा',none:'मिल्ने प्रश्न छैन। अर्को शब्द प्रयास गर्नुहोस्।',all:'१६ प्रश्न'},
  ko:{found:n=>n+'개 검색됨',none:'일치하는 질문이 없습니다. 다른 단어를 입력하세요.',all:'질문 16개'},
  kmr:{found:n=>n+' encam',none:'Pirsek li gorî lêgerînê tune ye. Peyveke din biceribîne.',all:'16 pirs'}
 };
 const lang=window.ASOBOON_I18N?.language||'ja';
 const words=notices[lang]||notices.en;
 const result=document.getElementById('cmFaqResult');if(result)result.textContent=needle?(count?words.found(count):words.none):words.all;
 const clear=document.getElementById('cmFaqClear');if(clear)clear.hidden=!needle;
}
const app=document.getElementById('app');
if(app){
 app.addEventListener('input',e=>{if(e.target?.id==='cmFaqQuery')updateFaqResults()});
 app.addEventListener('click',e=>{if(e.target?.id!=='cmFaqClear')return;const input=document.getElementById('cmFaqQuery');if(!input)return;input.value='';updateFaqResults();input.focus()});
}
window.addEventListener('asoboon:language-changed',()=>queueMicrotask(applyFaqLabels));
window.addEventListener('asoboon:v2-route-rendered',()=>queueMicrotask(applyFaqLabels));
window.ASOBOON_CHOCOMINT_HUBS=Object.freeze({guide:guidePage,play:playPage,faq:faqPage});
})();
