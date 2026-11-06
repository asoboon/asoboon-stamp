/* BOON START v4 / isolated UI bridge for develop/boon-start-v4.html.
 * Display only: never sends reservations, changes AirWAIT status, or changes existing handlers.
 * Reads the actual reception/callstatus DOM produced by the existing application modules. */
(function () {
'use strict';
if (window.ASOBOON_MINT_V51_PREVIEW!==true) return;
var root=document.getElementById('app');
if (!root) return;
document.documentElement.classList.add('boon-v4','boon-v5-mint');
var currentView='', receptionPage=null, step=1, scheduled=false, lastReceipt='', successNotice=false;
var $=function(id){return document.getElementById(id);};
var escapeText=function(value){return String(value==null?'':value).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});};
var view=function(){return new URLSearchParams(location.search).get('view')||'home';};
function create(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function addClass(el,cls){if(el&&!el.classList.contains(cls))el.classList.add(cls);}
function isVisible(el){return !!el&&!el.hidden;}
function hasSlot(){return !!root.querySelector('.rec-slot.active:not([disabled])');}
function canContinuePeople(){var el=$('recPeopleMsg');return !!el&&el.classList.contains('ok');}
function makeWizard(page){
 if (!page || !$('recSlots')) return;
 if (receptionPage!==page){receptionPage=page;step=1;}
 addClass(page,'boon-v4-reception');
 // Condense the already-existing post-registration guidance without deleting it.
 // Customers still see the key action; details remain available on demand.
 var reminder=page.querySelector('.v13-after-reception');
 if(reminder&&!reminder.dataset.boonV51){
  var original=String(reminder.querySelector('span')?.textContent||'').trim();
  var details=create('details','boon-v51-help');
  var summary=create('summary','');
  var summaryCopy=create('span','boon-v51-help-copy');
  summaryCopy.appendChild(create('strong','','受付後は並ばなくてOK'));
  summaryCopy.appendChild(create('small','','順番になるとLINEでお知らせ'));
  summary.appendChild(summaryCopy);
  var body=create('p','',original||'呼出通知を受け取るまでお待ちください。');
  details.appendChild(summary);
  details.appendChild(body);
  reminder.replaceChildren(details);
  reminder.dataset.boonV51='1';
 }
 var adult=page.querySelector('.rec-person[data-v26-kind=adult] .v26-person-label');
 if(adult&&!adult.querySelector('.boon-v4-age-note')){var age=create('span','boon-v4-age-note','保護者は18歳以上');adult.appendChild(age);}
 var titles=page.querySelectorAll('.rec-title');
 addClass(titles[0],'boon-v4-slot-title');
 addClass(titles[1],'boon-v4-people-title');
 var progress=page.querySelector('#boonV4Progress');
 if(!progress){
  progress=create('div','boon-v4-progress');
  progress.id='boonV4Progress';
  progress.setAttribute('aria-label','受付手順');
  progress.innerHTML='<span data-boon-p="1">1 <b>受付枠</b></span><span data-boon-p="2">2 <b>人数</b></span><span data-boon-p="3">3 <b>内容確認</b></span>';
  var day=$('recDay'),wrap=page.querySelector('.rec-wrap');
  if(day&&day.parentNode)day.parentNode.insertBefore(progress,day);
  else if(wrap)wrap.insertBefore(progress,wrap.firstChild);
 }
 if(!page.querySelector('#boonV4StageIntro')){
  var intro=create('div','boon-v4-stage-intro');intro.id='boonV4StageIntro';
  progress.insertAdjacentElement('afterend',intro);
 }
 var people=page.querySelector('.rec-people');
 if(people&&!page.querySelector('#boonV5Team')){
  var team=create('div','boon-v5-team');team.id='boonV5Team';
  team.setAttribute('aria-label','人数と料金の目安');
  team.innerHTML='<span class="boon-v5-team-count"><small>TODAY’S TEAM</small><strong id="boonV5TeamTotal"></strong></span><strong class="boon-v5-team-price" id="boonV5TeamPrice"></strong>';
  people.insertAdjacentElement('afterend',team);
 }
 var nav=page.querySelector('#boonV4Nav');
 if(!nav){
  nav=create('div','boon-v4-actionbar');nav.id='boonV4Nav';
  nav.innerHTML='<button type="button" id="boonV4Continue" class="boon-v4-primary">次へ</button><button type="button" id="boonV4Back" class="boon-v4-secondary">前の画面へ戻る</button>';
  page.querySelector('.rec-wrap').appendChild(nav);
  var hint=create('p','boon-v51-hint');
  hint.id='boonV51ActionHint';hint.setAttribute('aria-live','polite');
  nav.querySelector('#boonV4Continue').insertAdjacentElement('afterend',hint);
  nav.querySelector('#boonV4Continue').setAttribute('aria-describedby','boonV51ActionHint');
  nav.querySelector('#boonV4Continue').addEventListener('click',function(){
   if(step===1&&hasSlot()){step=2;updateWizard(page);window.scrollTo({top:0,behavior:'smooth'});}
   else if(step===2&&canContinuePeople()){step=3;updateWizard(page);window.scrollTo({top:0,behavior:'smooth'});}
  });
  nav.querySelector('#boonV4Back').addEventListener('click',function(){
   if(step>1&&step<4){step--;updateWizard(page);window.scrollTo({top:0,behavior:'smooth'});}
  });
 }
 updateWizard(page);
}
function updateWizard(page){
 if(!page||!page.isConnected)return;
 var processing=$('recProcessing'),result=$('recResult');
 var effective=isVisible(processing)?4:(isVisible(result)?5:step);
 if(page.dataset.boonStage!==String(effective))page.dataset.boonStage=String(effective);
 var intro=page.querySelector('#boonV4StageIntro');
 var messages={
   1:['STEP 01 / START','あそぶ回を選ぼう'],
   2:['STEP 02 / TEAM','何人であそぶ？'],
   3:['STEP 03 / CHECK','内容を確認してスタート！'],
   4:['PROCESSING','受付情報を確認しています'],
   5:['RESULT','受付結果を確認しています']
 };
 if(intro&&intro.dataset.stage!==String(effective)){
  var message=messages[effective]||messages[1];
  intro.dataset.stage=String(effective);
  intro.innerHTML='<small>'+message[0]+'</small><strong>'+message[1]+'</strong>';
 }
 page.querySelectorAll('#recSlots .rec-slot').forEach(function(btn){
  var pressed=btn.classList.contains('active')?'true':'false';
  if(btn.getAttribute('aria-pressed')!==pressed)btn.setAttribute('aria-pressed',pressed);
 });
 page.querySelectorAll('[data-boon-p]').forEach(function(node){
  var n=Number(node.dataset.boonP);
  node.classList.toggle('active',effective===n);
  node.classList.toggle('done',effective>n);
  if(effective===n)node.setAttribute('aria-current','step');
  else node.removeAttribute('aria-current');
 });
 var next=page.querySelector('#boonV4Continue');
 var back=page.querySelector('#boonV4Back');
 if(next){
  var ready=step===1?hasSlot():step===2?canContinuePeople():false;
  next.disabled=!ready;
  var label=step===1?'この枠で人数を選ぶ':step===2?'内容を確認する':'次へ';
  if(next.textContent!==label)next.textContent=label;
  var hint=page.querySelector('#boonV51ActionHint');
  if(hint){
   var advice=ready||effective>2?'':step===1?'利用する回を選ぶと次へ進めます。':'人数の条件を確認してください。';
   if(hint.textContent!==advice)hint.textContent=advice;
   hint.hidden=!advice;
  }
 }
 if(back)back.hidden=step===1||effective>3;
 // Mirror only the already validated values from the existing reception calculator;
 // never derive totals or money independently in the decorative UI layer.
 var realTotal=$('recPeopleTotal'),realPrice=$('recPrice');
 var teamTotal=$('boonV5TeamTotal'),teamPrice=$('boonV5TeamPrice');
 if(teamTotal&&realTotal){
  var totalLabel=String(realTotal.textContent||'').trim();
  var display=totalLabel?totalLabel+'であそぶ！':'人数を確認中';
  if(teamTotal.textContent!==display)teamTotal.textContent=display;
 }
 if(teamPrice&&realPrice){
  var priceLabel=String(realPrice.textContent||'').trim();
  if(teamPrice.textContent!==priceLabel)teamPrice.textContent=priceLabel;
 }
 if(result && !result.hidden && /受付が完了しました/.test(result.textContent||'')){
  var receipt=String(result.querySelector('.rec-result strong')?.textContent||'').trim();
  if(receipt){
   result.classList.add('boon-v5-confirmed');
   if(!result.querySelector('.boon-v5-complete-hero')){
    var success=create('div','boon-v5-complete-hero');
    success.setAttribute('aria-label','受付が完了しました');
    success.innerHTML='<div class="boon-v5-complete-check" aria-hidden="true">✓</div><strong>受付できたよ！</strong><p>次はLINEの呼出通知を待とう。</p>';
    result.insertBefore(success,result.firstChild);
   }
  }
  if(receipt && receipt!==lastReceipt){
   lastReceipt=receipt;successNotice=true;
   try{sessionStorage.setItem('boon-v4-new-success',receipt);}catch(e){}
  }
 }
}
/* v5.5: strengthen signifiers without adding routes or changing status data.
 * Everything here is an existing button / route / card, never a new WEB CTA. */
var HOME_AFFORDANCE_COPY={
 ja:{call:'呼出状況を見る',callSub:'受付番号・待ち順・入場案内',today:'営業区分・利用時間を詳しく見る',
  timer:'遊べる時間を計算する',timerDone:'計算結果を確認する',
  crowd:'残り人数を見て、受付方法を選ぼう ↓',crowdEmpty:'各受付枠の残り人数を表示します'},
 en:{call:'Check queue status',callSub:'Ticket number · queue · entry',today:'View hours and play time',
  timer:'Calculate play time',timerDone:'View calculated time',
  crowd:'Choose session and check-in option ↓',crowdEmpty:'Spaces remaining by session'},
 'zh-CN':{call:'查看叫号状态',callSub:'取号号码·排队·入场',today:'查看营业与游玩时间',
  timer:'计算游玩时间',timerDone:'查看计算结果',
  crowd:'选择场次与取号方式 ↓',crowdEmpty:'各场次剩余名额'},
 vi:{call:'Xem lượt gọi',callSub:'Số vé · xếp hàng · vào cửa',today:'Xem giờ mở cửa và giờ chơi',
  timer:'Tính thời gian chơi',timerDone:'Xem kết quả',
  crowd:'Chọn lượt và cách đăng ký ↓',crowdEmpty:'Chỗ còn lại theo lượt'},
 ne:{call:'बोलावट स्थिति हेर्नुहोस्',callSub:'टिकट · पालो · प्रवेश',today:'आजको समय र खेल अवधि हेर्नुहोस्',
  timer:'खेल्ने समय गणना',timerDone:'नतिजा हेर्नुहोस्',
  crowd:'पालो र दर्ता तरिका रोज्नुहोस् ↓',crowdEmpty:'प्रत्येक पालोको बाँकी स्थान'},
 ko:{call:'호출 현황 보기',callSub:'접수번호 · 대기 · 입장',today:'오늘 운영 및 이용시간 보기',
  timer:'이용시간 계산하기',timerDone:'계산 결과 보기',
  crowd:'회차와 접수 방법 선택 ↓',crowdEmpty:'회차별 남은 인원'},
 kmr:{call:'Rewşa bangkirinê bibîne',callSub:'Hejmara bilêtê · rêz · ketin',today:'Demên vekirinê û lîstinê bibîne',
  timer:'Dema lîstinê hesab bike',timerDone:'Encamê bibîne',
  crowd:'Dem û rêbaza qeydkirinê hilbijêre ↓',crowdEmpty:'Cihên mayî ji bo her demê'}
};
function homeAffordanceCopy(){
 var locale=window.ASOBOON_I18N?.language||document.documentElement.lang||'ja';
 return HOME_AFFORDANCE_COPY[locale]||HOME_AFFORDANCE_COPY.en;
}
function enhanceHomeAffordances(home){
 var copy=homeAffordanceCopy();
 var today=home.querySelector('#v38Today');
 if(today){
  today.setAttribute('aria-label',copy.today);
  if(!today.querySelector('.v55-today-action')){
   var footer=create('span','v55-today-action');
   footer.setAttribute('aria-hidden','true');
   footer.innerHTML='<span class="v55-today-action-label"></span><i>→</i>';
   today.appendChild(footer);
  }
  var todayLabel=today.querySelector('.v55-today-action-label');
  if(todayLabel&&todayLabel.textContent!==copy.today)todayLabel.textContent=copy.today;
 }
 var timer=home.querySelector('#v38TimeguideShortcut');
 if(timer){
  var action=timer.querySelector('.v55-timer-action');
  if(!action){
   action=create('span','v55-timer-action');
   action.setAttribute('aria-hidden','true');
   action.innerHTML='<span class="v55-timer-action-label"></span><i>→</i>';
   var timerCopyParent=timer.querySelector('[data-timeguide-summary]')?.parentElement;
   if(timerCopyParent)timerCopyParent.appendChild(action);
  }
  var saved=timer.classList.contains('has-timeguide-result');
  var words=saved?copy.timerDone:copy.timer;
  var label=action?.querySelector('.v55-timer-action-label');
  if(label&&label.textContent!==words)label.textContent=words;
  var aria=words;
  if(timer.getAttribute('aria-label')!==aria)timer.setAttribute('aria-label',aria);
 }
 var call=home.querySelector('#v38Hero .v38-call-cta');
 if(call){
  var title=call.querySelector('.v38-call-cta-copy strong');
  var sub=call.querySelector('.v38-call-cta-copy small');
  if(title&&title.textContent!==copy.call)title.textContent=copy.call;
  if(sub&&sub.textContent!==copy.callSub)sub.textContent=copy.callSub;
  call.setAttribute('aria-label',copy.call+'。'+copy.callSub);
 }
 var slots=home.querySelector('#v38Slots');
 var heading=slots?.querySelector(':scope > h3');
 if(heading){
  var prompt=slots.querySelector(':scope > .v55-crowd-prompt');
  if(!prompt){
   prompt=create('p','v55-crowd-prompt');
   heading.insertAdjacentElement('afterend',prompt);
  }
  var available=!!slots.querySelector('.v38-crowd-channel:is(a,button)');
  var description=available?copy.crowd:copy.crowdEmpty;
  if(prompt.textContent!==description)prompt.textContent=description;
 }
}
function styleHome(){
 var home=root.querySelector('.v38-home, .v37-home, .v35-home');
 if(!home)return;
 addClass(home,'boon-v4-home');
 // A banner above the real HOME hero made it feel like a generic admin tool.
 var old=root.querySelector('#boonV4HomeTag');
 if(old)old.remove();
 var hero=home.querySelector('#v38Hero');
 // The separate BOON START / READY FOR FUN flag was removed by request.
 if(hero){var oldFlag=hero.querySelector('.boon-v4-home-flag');if(oldFlag)oldFlag.remove()}
 enhanceHomeAffordances(home);
}
function makeLamps(kind){
 var active=kind==='calling'?5:kind==='near'?4:kind==='hold'?2:0;
 var color=kind==='calling'?'green':kind==='near'?'red':kind==='hold'?'amber':'off';
 var lamps='';
 for(var i=0;i<5;i++)lamps+='<span class="boon-v4-lamp '+(i<active?color:'off')+'" aria-hidden="true"></span>';
 return '<div class="boon-v4-lights" aria-label="START LIGHTSは状態の補助表示"><small>START LIGHTS</small><div class="boon-v4-lamps">'+lamps+'</div></div>';
}
function heroModel(){
 var state=$('csState');
 if(!state)return null;
 var classes=state.classList;
 var raw=String($('csAhead')?.textContent||'').trim();
 var ahead=/^\d+$/.test(raw)?Number(raw):null;
 var receipt=String($('csReceipt')?.textContent||'—').trim()||'—';
 var checked=String($('csChecked')?.textContent||'—').trim()||'—';
 var message=String($('csError')?.textContent||'').trim();
 // Native callstatus also uses #csError for staff help when no reservation exists.
 // That guidance must not be misclassified as a network failure.
 var nativeTitle=String($('csTitle')?.textContent||'').trim();
 var nativeAction=String($('csMessage')?.textContent||'').trim();
 var noSession=nativeTitle==='本日の受付が見つかりません';
 var error=!noSession&&!!$('csError')&&!$('csError').hidden&&!!message;
 var phase=['calling','waiting','hold','processing','done','canceled','closed'].find(function(name){return classes.contains(name);})||'loading';
 var kind=phase==='waiting'&&ahead!==null&&ahead>0&&ahead<=3?'near':phase;
 if(error)kind='error';
 var name='受付情報を確認しています',action='受付情報を安全に照合しています',badge='状況を確認中';
 if(kind==='waiting'){name='まだ呼出前です';action='LINEの呼出通知をお待ちください。';badge='受付済み・呼出待ち';}
 if(kind==='near'){name='まもなくご案内の可能性があります';action='まだ呼出前です。LINEからの通知をお待ちください。';badge='受付済み・呼出待ち';}
 if(kind==='calling'){name='入場できます！';action='呼出後30分以内にASOBooN入口へお越しください。';badge='呼出中';}
 if(kind==='hold'){name='受付でご確認ください';action='受付番号をスタッフへお伝えください。';badge='保留中';}
 if(kind==='processing'){name='受付対応中です';action='スタッフの案内をご確認ください。';badge='受付対応中';}
 if(kind==='done'){name='ご案内済みです';action='不明な場合はスタッフへお尋ねください。';badge='案内済み';}
 if(kind==='canceled'){name='受付は取り消されています';action='元の受付番号では入場できません。';badge='取消済み';}
 if(kind==='closed'){name='本日の受付は終了しました';action='この受付の呼出状況表示は終了しています。';badge='受付終了';}
 if(kind==='error'){name='最新情報を取得できません';action='新しい受付を作り直さず、最新状況を再確認してください。';badge='更新失敗・以前の確認結果';}
 if(noSession){
  kind='no-reservation';
  var hasReceipt=receipt!=='—';
  name=hasReceipt?'受付番号を確認してください':nativeTitle;
  action=hasReceipt?'受付番号は保持されています。新しい受付を作り直さず、スタッフに番号をお伝えください。':(nativeAction||'LINE当日受付を完了すると、呼出状況がここに表示されます。');
  badge=hasReceipt?'受付番号を確認中':'本日の受付情報なし';
 }
 if(phase==='waiting'&&ahead===0&&!error){name='まだ呼出前です';action='前に0組ですが、まだ入場案内前です。LINEの通知をお待ちください。';badge='受付済み・呼出待ち';kind='waiting';}
 return {kind:kind,name:name,action:action,badge:badge,receipt:receipt,ahead:ahead,checked:checked,error:error,
  note:noSession?message:'',canStart:noSession&&receipt==='—'};
}
function renderHero(model){
 var showLamps=['waiting','near','calling'].includes(model.kind);
 var visual=showLamps?makeLamps(model.kind):'';
 var queue=model.ahead===null?'':(model.kind==='waiting'||model.kind==='near'
  ?'<div class="boon-v4-ahead"><small>あなたの前（待ち組数）</small><strong>'+model.ahead+'</strong><span>組</span></div>':'');
 var flag=model.kind==='calling'?'<div class="boon-v4-go">GO!</div>':'';
 var checkedAvailable=model.checked!=='—'&&model.checked!=='';
 var freshness=model.error?(checkedAvailable?'最後に確認できた時刻':'更新状況'):'最終確認';
 var stamp=checkedAvailable?escapeText(model.checked):(model.error?'時刻を取得できていません':'確認中');
 var noSession=model.kind==='no-reservation';
 var numberView=(!noSession||model.receipt!=='—')?'<div class="boon-v4-number"><span>受付番号</span><strong>'+escapeText(model.receipt)+'</strong></div>':'';
 var actionView=noSession&&model.canStart?'<button class="boon-v4-reception-entry" type="button" data-v7-view="reception">LINE受付へ進む</button>':'';
 var helpView=noSession&&model.note?'<p class="boon-v4-no-reservation-note">'+escapeText(model.note)+'</p>':'';
 return '<section class="boon-v4-call-hero '+escapeText(model.kind)+'" id="boonV4CallHero" aria-live="polite">'+
  '<div class="boon-v4-status-tag">'+escapeText(model.badge)+'</div>'+
  '<h2>'+escapeText(model.name)+'</h2>'+
  '<p class="boon-v4-next">'+escapeText(model.action)+'</p>'+visual+flag+
  numberView+actionView+helpView+
  queue+(noSession?'':'<p class="boon-v4-checked">'+freshness+' '+stamp+'</p>')+
  (model.error?'<p class="boon-v4-error">この表示を最新の呼出案内として扱わないでください。</p>':'')+
  '</section>';
}
function updateCallstatus(){
 var page=root.querySelector('.cs-page');
 if(!page||!$('csState'))return;
 addClass(page,'boon-v4-callstatus');
 var model=heroModel();
 if(!model)return;
 if(page.dataset.boonState!==model.kind)page.dataset.boonState=model.kind;
 var signature=JSON.stringify(model);
 if(page.dataset.boonSignature!==signature){
  page.dataset.boonSignature=signature;
  var original=$('boonV4CallHero'),html=renderHero(model);
  if(original)original.outerHTML=html;
  else page.querySelector('#csTop')?.insertAdjacentHTML('beforebegin',html);
 }
 // A success banner comes from the verified reservation create result, not from waiting status.
 var saved='';
 try{saved=sessionStorage.getItem('boon-v4-new-success')||'';}catch(e){}
 if(saved&&saved===model.receipt&&!page.querySelector('#boonV4DoneNotice')){
  var banner=create('div','boon-v4-done-notice','✓ 受付が完了しました。受付番号をご確認ください。');
  banner.id='boonV4DoneNotice';
  page.querySelector('#boonV4CallHero')?.insertAdjacentElement('beforebegin',banner);
  try{sessionStorage.removeItem('boon-v4-new-success');}catch(e){}
 }
}
function run(){
 scheduled=false;
 var v=view();
 if(v!==currentView){currentView=v;receptionPage=null;step=1;document.body.dataset.boonView=v;}
 if(v==='home')styleHome();
 if(v==='reception')makeWizard(root.querySelector('.page-card'));
 if(v==='callstatus')updateCallstatus();
}
function queue(){if(scheduled)return;scheduled=true;setTimeout(run,0);}
new MutationObserver(queue).observe(root,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class','hidden','disabled']});
window.addEventListener('asoboon:v2-route-rendered',queue);
window.addEventListener('asoboon:language-changed',queue);
window.addEventListener('popstate',queue);
root.addEventListener('click',function(event){
 if(view()!=='reception')return;
 var el=event.target.closest('[data-rec-slot], [data-rec-k]');
 if(!el)return;
 if(el.matches('[data-rec-k]')&&!el.disabled){
  var output=el.closest('.rec-stepper')?.querySelector('output');
  var before=output?.textContent;
  // Feedback happens only after the actual numeric value has changed.
  if(output){
   setTimeout(function(){
    if(!output.isConnected||output.textContent===before)return;
    output.classList.remove('boon-v5-bump');
    void output.offsetWidth;
    output.classList.add('boon-v5-bump');
    setTimeout(function(){if(output.isConnected)output.classList.remove('boon-v5-bump');},300);
   },0);
  }
 }
 setTimeout(queue,0);
},true);
run();
window.BOON_START_V51_MINT=Object.freeze({version:'5.1.0-preview-only',model:heroModel,readOnly:true});
})();