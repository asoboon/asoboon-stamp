(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;
const RES_KEY='asoboon_v2_current_reservation_develop_v1';
let queued=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function routeState(){const p=new URLSearchParams(location.search);return{view:String(p.get('view')||'home'),panel:String(p.get('panel')||'')}}
function readJSON(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function yen(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('ja-JP')+'円':'—'}
function dateLabel(v){const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${Number(m[2])}月${Number(m[3])}日`:String(v||'—')}
function setBrand(){const s=document.querySelector('.brand small');if(s)s.textContent='川口ハイウェイオアシス'}
function clearClasses(){document.body.classList.remove('v7-page-active','v7-callstatus-active','v7-timeguide-active','v7-content-active')}
function shell(tag,title,lead,body){return `<section class="page-card pv7-page"><div class="pv7-head"><span class="pv7-eyebrow">${esc(tag)}</span><h1>${esc(title)}</h1><p>${esc(lead)}</p></div><div class="pv7-body">${body}</div></section>`}
function button(label,view,panel='',kind='primary'){return `<button class="${kind==='text'?'pv7-text-btn':kind==='secondary'?'pv7-secondary-btn':'pv7-primary'}" type="button" data-pv7-view="${esc(view)}"${panel?` data-pv7-panel="${esc(panel)}"`:''}>${esc(label)}</button>`}
function pricePage(){return shell('料金','料金','人数に合わせた合計金額は受付画面で自動計算します。',`
<div class="pv7-list">
 <div class="pv7-band" style="--band:var(--pv7-orange)"><div><strong>おとな</strong><small>保護者・同伴者</small></div><b>600円</b></div>
 <div class="pv7-band" style="--band:var(--pv7-blue)"><div><strong>こども</strong><small>6か月〜小学6年生</small></div><b>900円</b></div>
 <div class="pv7-band" style="--band:var(--pv7-green)"><div><strong>0〜5か月</strong><small>お子さま2人目以降にあたる場合は追加料金なし</small></div><b>0〜900円</b></div>
</div>
<div class="pv7-callout orange"><strong>0〜5か月のお子さま</strong><br>お子さま1人目にあたる場合は900円。2人目以降にあたる場合は追加料金なしです。</div>
<div class="pv7-callout"><strong>人数の上限</strong><br>保護者1名につきお子さま3名まで。1組の受付は合計10名までです。</div>
${button('受付へ進む','reception')}`)}
function firstPage(){return shell('初めての方','はじめてのASOBooN','来場前にこれだけ分かれば大丈夫。受付から入場までを5つに絞りました。',`
<div class="pv7-section"><h2>利用できる方</h2><p>0歳から小学6年生までのお子さまと保護者の方がご利用いただけます。保護者1名につき、お子さま3名までです。</p></div>
<div class="pv7-section"><h2>利用の流れ</h2><div class="pv7-timeline">
 <div class="pv7-step"><b>1</b><div><strong>LINEミニアプリで受付</strong><small>利用する回と人数を選びます。</small></div></div>
 <div class="pv7-step"><b>2</b><div><strong>順番を待つ</strong><small>HOMEで「あと○組」を確認できます。</small></div></div>
 <div class="pv7-step"><b>3</b><div><strong>LINEで呼出</strong><small>順番になるとLINEでお知らせします。</small></div></div>
 <div class="pv7-step"><b>4</b><div><strong>受付・会計</strong><small>受付番号を準備してASOBooN入口へ。</small></div></div>
 <div class="pv7-step"><b>5</b><div><strong>入場して遊ぶ</strong><small>館内の案内とスタッフの案内に沿ってご利用ください。</small></div></div>
</div></div>
<div class="pv7-callout blue"><strong>呼出前に入口へ並ぶ必要はありません。</strong><br>現在の順番はHOMEと呼出状況で確認できます。</div>
${button('受付へ進む','reception')}${button('料金を見る','first','price','text')}`)}
function entryPage(){return shell('入場・退場','入場・退場','受付から退場まで、いま何をすればいいかを一本道で確認できます。',`
<div class="pv7-roadflow">
 <div class="pv7-roadstep"><b>1</b><strong>受付を完了</strong><small>受付番号が発行されたら受付完了です。</small></div>
 <div class="pv7-roadstep"><b>2</b><strong>呼出を待つ</strong><small>HOMEの「あと○組」を確認しながらお待ちください。</small></div>
 <div class="pv7-roadstep"><b>3</b><strong>LINE通知を確認</strong><small>「入場できます！」になったらASOBooN入口へ。呼出後30分以内を目安にお越しください。</small></div>
 <div class="pv7-roadstep"><b>4</b><strong>受付・会計</strong><small>受付番号をスタッフへお見せください。</small></div>
 <div class="pv7-roadstep"><b>5</b><strong>入場・退場</strong><small>館内の案内とスタッフの案内に沿ってご利用ください。</small></div>
</div>
<div class="pv7-callout green">呼出前に入口へ並び直す必要はありません。HOMEとLINE通知で現在の状態を確認できます。</div>
${button('呼出状況を確認する','callstatus','','secondary')}`)}
function rulesPage(){return shell('館内ルール','たのしく遊ぶための4つの約束','禁止事項を並べるのではなく、みんなが安心して遊ぶための大切なことをまとめています。',`
<div class="pv7-promise"><b>1</b><div><strong>保護者の方と一緒に</strong><small>お子さまから目を離さず、一緒に館内をお楽しみください。</small></div></div>
<div class="pv7-promise"><b>2</b><div><strong>周りのお友だちも大切に</strong><small>ぶつかったり、ほかのお子さまの遊びを妨げる行為にはご注意ください。</small></div></div>
<div class="pv7-promise"><b>3</b><div><strong>遊び方を考えながら</strong><small>子どもの挑戦を大切にしながら、重大な事故につながる危険は避けて遊びましょう。</small></div></div>
<div class="pv7-promise"><b>4</b><div><strong>困ったときはスタッフへ</strong><small>けが・迷子・体調不良・遊具の不具合などは近くのスタッフへお知らせください。</small></div></div>
<div class="pv7-callout green">安全のためスタッフからお声がけする場合があります。館内での案内を優先してください。</div>`)}
function infoPage(){return shell('その他のご案内','その他のご案内','営業時間や施設の基本情報をまとめています。',`
<div class="pv7-list">
 <div class="pv7-band" style="--band:var(--pv7-road)"><div><strong>平日</strong><small>営業時間</small></div><b>10:00〜17:00</b></div>
 <div class="pv7-band" style="--band:var(--pv7-orange)"><div><strong>土日祝</strong><small>営業時間</small></div><b>10:00〜18:00</b></div>
 <div class="pv7-band" style="--band:var(--pv7-green)"><div><strong>定休日</strong><small>営業カレンダーにより変更する場合があります</small></div><b>火曜</b></div>
</div>
<div class="pv7-section"><h2>場所</h2><p>ASOBooNは川口ハイウェイオアシス内にあります。</p></div>
<div class="pv7-section"><h2>対象</h2><p>0歳〜小学6年生。保護者1名につきお子さま3名までご利用いただけます。</p></div>
<div class="pv7-callout blue">当日の営業区分・受付可能な回は「受付」画面で最新情報を確認してください。</div>
${button('受付を確認する','reception')}${button('利用時間の目安を見る','timeguide','','secondary')}`)}
function detailPage(){const r=readJSON(RES_KEY);if(!r?.receiptNo)return shell('受付詳細','本日の受付はありません','受付が完了すると、ここに受付番号や利用回が表示されます。',`<div class="pv7-callout">受付が完了すると、このページに受付内容を表示します。</div>${button('受付する','reception')}`);
 const kids=Number(r.paidChildren||0)+Number(r.infants||0);return shell('受付詳細','受付詳細','現在この端末に保存されている本日の受付内容です。',`
<div class="pv7-list">
 <div class="pv7-row"><span>受付番号</span><strong>${esc(r.receiptNo)}</strong></div>
 <div class="pv7-row"><span>受付日</span><strong>${esc(dateLabel(r.businessDate))}</strong></div>
 <div class="pv7-row"><span>利用する回</span><strong>${esc(r.waitTypeLabel||r.waitTypeName||'受付枠')}</strong></div>
 <div class="pv7-row"><span>受付方法</span><strong>${r.mode==='onsite'?'現地受付':'LINE受付'}</strong></div>
 <div class="pv7-row"><span>人数</span><strong>おとな ${Number(r.adults||0)}名 / こども ${kids}名</strong></div>
 <div class="pv7-row"><span>料金目安</span><strong>${esc(yen(r.totalPrice))}</strong></div>
</div>
<div class="pv7-callout green">順番・呼出状態はAirWAITの最新情報を「呼出状況」で確認します。</div>
${button('呼出状況を見る','callstatus','','secondary')}
<div class="pv7-callout orange"><strong>受付の取り消し</strong><br>オンライン取消はまだ有効化していません。誤操作を防ぐため、プロト版では取消ボタンを表示していません。</div>`)}
function replaceMain(html,key){const main=root.querySelector('main.view');if(!main)return false;if(main.dataset.pv7Key===key)return true;main.innerHTML=html;main.dataset.pv7Key=key;return true}
function patchCallstatus(){const page=root.querySelector('.cs-page');if(!page)return;document.body.classList.add('v7-page-active','v7-callstatus-active');const s=page.querySelector('.page-head small'),h=page.querySelector('.page-head h2');if(s)s.textContent='CALL STATUS';if(h)h.textContent='呼出状況';const refresh=page.querySelector('#csRefresh');if(refresh&&!page.querySelector('.pv7-detail-link'))refresh.insertAdjacentHTML('afterend','<button class="pv7-text-btn pv7-detail-link" type="button" data-pv7-view="callstatus" data-pv7-panel="detail">受付詳細を見る</button>')}
function patchTimeguide(){const page=root.querySelector('.tg-page');if(!page)return;document.body.classList.add('v7-page-active','v7-timeguide-active');const s=page.querySelector('.page-head small'),h=page.querySelector('.page-head h2');if(s)s.textContent='PLAY TIME';if(h)h.textContent='利用時間の目安';const body=page.querySelector('.tg-body');if(body&&!body.querySelector('.pv7-time-warning'))body.insertAdjacentHTML('afterbegin','<div class="pv7-time-warning"><strong>これは目安計算です。</strong><br>入場時刻を自分で選んで計算します。実際の入場時刻を自動判定しているわけではありません。</div>')}
function apply(){queued=false;clearClasses();setBrand();const {view,panel}=routeState();if(view==='home'||view==='reception')return;
 if(view==='callstatus'&&panel==='detail'){try{window.ASOBOON_V2_CALLSTATUS?.unmount?.()}catch{}document.body.classList.add('v7-page-active','v7-content-active');replaceMain(detailPage(),'callstatus:detail');return}
 if(view==='callstatus'){patchCallstatus();return}
 if(view==='timeguide'){patchTimeguide();return}
 if(view==='first'){document.body.classList.add('v7-page-active','v7-content-active');replaceMain(panel==='price'?pricePage():firstPage(),`first:${panel||'main'}`);return}
 if(view==='entry'){document.body.classList.add('v7-page-active','v7-content-active');replaceMain(entryPage(),'entry');return}
 if(view==='rules'){document.body.classList.add('v7-page-active','v7-content-active');replaceMain(rulesPage(),'rules');return}
 if(view==='parking'){document.body.classList.add('v7-page-active','v7-content-active');replaceMain(infoPage(),'parking:info');return}
}
function queue(){if(queued)return;queued=true;queueMicrotask(apply)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(apply,0));
apply();setTimeout(apply,50);setTimeout(apply,300);
})();
