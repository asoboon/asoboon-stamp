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
function faqPage(){return `<section class="page-card cm-hub" aria-label="よくある質問"><header class="cm-hub-head"><span class="cm-hub-eyebrow">HELP / FAQ</span><h1>よくある質問</h1><p>ご利用時の疑問をまとめました。</p></header><div class="cm-faq">
<details><summary>LINE受付とWEB受付は同じですか？</summary><p>別の受付方法です。LINEミニアプリでは店舗受付系の受付をご利用いただけます。</p></details>
<details><summary>受付番号を確認したい</summary><p>画面下の「呼出」から確認できます。通信エラー時も、保存済みの受付番号は消しません。</p></details>
<details><summary>呼び出されてから何分以内に行けばいいですか？</summary><p>呼出から30分を目安に受付へお越しください。実際の受付状態は「呼出」でご確認ください。</p></details>
<details><summary>館内で飲食できますか？</summary><p>館内でのお食事はできません。飲み物は指定された土足エリアでお願いします。</p></details>
<details><summary>一時退場したあと、戻れますか？</summary><p>再入場の方法は「一時退場・再入場」の案内からご確認ください。</p></details>
</div>${hubRow('ご利用案内へ戻る','案内トップ','guide','','↩')}</section>`}
function playPage(){return `<section class="page-card cm-hub" aria-label="あそび"><header class="cm-hub-head"><span class="cm-hub-eyebrow">ASOBooN PLAY</span><h1>あそび</h1><p>館内でも、待ち時間でも。遊びたいものを選んでね。</p></header><div class="cm-hub-list" aria-label="あそびの各項目">
${hubLink('ASOQUEST スタンプラリー','館内のQRから車のパーツを集めよう','miniapp-v2/production/asoquest/','★')}
${hubLink('ブーンRUN','障害物をよけて走ろう','boonrun/','▶')}
${hubLink('BOON MONSTER','モンスターと遊ぼう','boonmonster/','✦')}
</div><div class="cm-hub-tip"><strong>スタンプラリーに参加する方へ</strong><p>パーツの取得は館内の専用QRから行ってください。完成した画面をスタッフへ見せてね。</p></div>${hubRow('ホームへ戻る','空き状況を見る','home','','⌂')}</section>`}

window.ASOBOON_CHOCOMINT_HUBS=Object.freeze({guide:guidePage,play:playPage,faq:faqPage});
})();
