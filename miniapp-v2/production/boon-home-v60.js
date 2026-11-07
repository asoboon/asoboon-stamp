/* ASOBooN HOME v6.0: read-only capacity summary, no booking/API writes. */
(function(){
'use strict';
if(window.ASOBOON_MINT_V51_PREVIEW!==true)return;
var root=document.getElementById('app');if(!root)return;
var copy={
 ja:['受付の空き状況','混雑予想','入場回','WEB残り','LINE残り','予約人数を320人で割った予想指数。実際の館内混雑とは異なります。','予約人数の確認中','受付人数を確認しています','今日の営業','土日祝','平日特定日','平日','休館日','無制限','時間','制'],
 en:['Reception availability','Crowd forecast','Session','Web left','LINE left','Forecast index: reservations / 320. Actual crowding may differ.','Booking count unavailable','Checking remaining spaces','Today’s hours','Weekend / holiday','Special weekday','Weekday','Closed','Unlimited','hours',' limit'],
 'zh-CN':['接待剩余名额','拥挤预测','入场时段','网页剩余','LINE剩余','预测指数为预约人数除以320，实际拥挤程度可能不同。','预约人数未确认','正在查询剩余名额','今日营业','周末及节假日','特殊工作日','工作日','休馆','不限时','小时','限制'],
 ko:['접수 잔여 인원','혼잡 예상','입장 회차','WEB 잔여','LINE 잔여','예약 인원 ÷ 320의 예상 지수입니다. 실제 혼잡과 다를 수 있습니다.','예약 인원 확인 중','잔여 인원 확인 중','오늘의 영업','주말·공휴일','특정 평일','평일','휴관','시간 무제한','시간','제'],
 vi:['Chỗ còn lại','Dự báo đông','Suất vào','Web còn','LINE còn','Chỉ số dự báo: số đặt chỗ / 320. Thực tế có thể khác.','Chưa có số đặt chỗ','Đang kiểm tra chỗ trống','Giờ mở cửa','Cuối tuần/ngày lễ','Ngày thường đặc biệt','Ngày thường','Đóng cửa','Không giới hạn','giờ',' giới hạn'],
 ne:['बाँकी स्थान','भीड अनुमान','प्रवेश समय','WEB बाँकी','LINE बाँकी','अनुमान: बुकिङ संख्या / ३२०। वास्तविक भीड फरक हुन सक्छ।','बुकिङ संख्या उपलब्ध छैन','बाँकी स्थान जाँच्दै','आजको समय','बिदा','विशेष कार्यदिन','कार्यदिन','बन्द','असीमित','घण्टा',' सीमा'],
 kmr:['Cihên mayî','Pêşbîniya qerebalixê','Dema ketinê','WEB mayî','LINE mayî','Nîşana pêşbîniyê: rezervasyon / 320. Rewşa rastîn cuda dibe.','Hejmara rezervasyonê nayê zanîn','Cihên mayî tên kontrolkirin','Demên îro','Dawiya hefteyê','Roja taybet','Roja karê','Girtî','Bê sînor','saet',' sînor']
};
function language(){var lang=String(document.documentElement.lang||'ja');return copy[lang]?lang:'ja'}
function rate(n){return Number.isSafeInteger(n)&&n>=0?Math.round(n/320*100):null}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function remaining(card,channel){
 var e=card.querySelector('.v38-crowd-channel--'+channel);if(!e)return null;
 var a=String(e.getAttribute('aria-label')||'');
 var m=a.match(/残り(\d+)人/);return m?Number(m[1]):null;
}
function getRows(slots){
 return Array.from(slots.querySelectorAll('.v38-crowd-card')).map(function(card){
 var time=card.querySelector('.v38-crowd-head time');
 var label=String(time?.textContent||'').replace(/回$/,'').trim();
 return {time:label,web:remaining(card,'web'),line:remaining(card,'onsite'),booked:null};
 }).filter(function(x){return !!x.time});
}
function getStatus(slots){
 if(slots.querySelector('.v38-crowd-empty'))return slots.querySelector('.v38-crowd-empty strong')?.textContent||'';
 if(slots.querySelector('.v38-slots-error'))return slots.querySelector('.v38-slots-error').textContent;
 return '';
}
function localizeDay(){
 var box=document.getElementById('v38Today');if(!box)return;
 var lang=language(),a=copy[lang];
 box.setAttribute('aria-label',a[8]);
 var label=document.querySelector('label[for="asoboon-language-select"]');
 if(label){var langLabel=lang==='ja'?'🌐 言語':'🌐 Language';if(label.textContent!==langLabel)label.textContent=langLabel;}

 var first=box.querySelector('span:first-child strong');
 if(first&&first.textContent!==(lang==='ja'?'今日の営業':a[8]))first.textContent=lang==='ja'?'今日の営業':a[8];
 var values=box.querySelectorAll(':scope > span > strong');
 for(var i=1;i<Math.min(values.length,3);i++){
  var v=values[i],current=String(v.textContent||'');
  if(/土日祝|平日|\d+時間|無制限|休館日|取得不可|読み込み中/.test(current)||!v.dataset.v60Source)v.dataset.v60Source=current;
  var raw=v.dataset.v60Source;
  if(!raw||lang==='ja'){if(raw&&v.textContent!==raw)v.textContent=raw;continue}
  var val=raw.replace(/平日特定日/g,a[10]).replace(/土日祝日|土日祝/g,a[9]).replace(/平日/g,a[11]).replace(/休館日/g,a[12]).replace(/無制限/g,a[13]).replace(/(\d+)時間(\d+)分制/g,function(_,h,m){return h+'h '+m+'m'}).replace(/(\d+)時間/g,function(_,n){return n+' '+a[14]}).replace(/制$/g,a[15]);
  if(v.textContent!==val)v.textContent=val;
 }
}
var last='';
function render(){
 var zone=document.getElementById('v58SessionsZone'),slots=document.getElementById('v38Slots');
 if(!zone||!slots)return;
 var fold=document.getElementById('v59SlotsFold');if(fold&&!fold.hidden)fold.hidden=true;
 var panel=document.getElementById('v60CapacityPanel');
 if(!panel){panel=el('section','v60-capacity');panel.id='v60CapacityPanel';panel.setAttribute('aria-label','受付の空き状況');zone.insertBefore(panel,zone.firstChild)}
 localizeDay();
 var lang=language(),a=copy[lang],rows=getRows(slots),status=getStatus(slots);
 var ageText=slots.querySelector('#v38CrowdAge')?.textContent||'';
 var matchedAge=ageText.match(/\d{1,2}:\d{2}/);
 var age=matchedAge?matchedAge[0]:'';

 var signature=JSON.stringify([lang,rows,status,age]);
 if(signature===last)return;last=signature;
 var head=el('div','v60-capacity-head'),meta=el('div','v60-head-meta');
 var btn=el('button','v60-refresh',lang==='ja'?'更新':'↻');
 btn.type='button';btn.setAttribute('aria-label',lang==='ja'?'残り人数を更新する':'Refresh remaining spaces');
 var nativeRefresh=slots.querySelector('#v38CrowdUpdate');
 if(!nativeRefresh||nativeRefresh.disabled)btn.disabled=true;
 btn.addEventListener('click',function(){var n=slots.querySelector('#v38CrowdUpdate');if(n&&!n.disabled)n.click()});
 meta.append(el('span','v60-capacity-age',age),btn);head.append(el('strong','',a[0]),meta);

 var table=el('table','v60-capacity-table'),col=el('colgroup');
 ['24%','22%','27%','27%'].forEach(function(w){var c=el('col');c.style.width=w;col.append(c)});table.append(col);
 var thead=el('thead'),tr=el('tr');for(var i=1;i<=4;i++)tr.append(el('th','',a[i]));thead.append(tr);table.append(thead);
 var tbody=el('tbody');
 rows.forEach(function(row){
  var tr=el('tr'),pct=rate(row.booked),fc=el('td',pct===null?'v60-unknown':'v60-forecast',pct===null?'—':pct+'%');
  if(pct!==null){var bar=el('span','v60-capacity-bar'),fill=el('i');fill.style.width=Math.min(100,pct)+'%';bar.append(fill);fc.append(bar)}
  tr.append(fc,el('td','',row.time));
  for(var val of [row.web,row.line])tr.append(el('td',val===null?'v60-unknown':val===0?'v60-zero':'',val===null?'—':val+'人'));
  tbody.append(tr);
 });
 if(!rows.length){var tr=el('tr'),td=el('td','v60-capacity-empty',status||a[7]);td.colSpan=4;tr.append(td);tbody.append(tr)}
 table.append(tbody);
 var note=el('p','v60-capacity-note',a[5]+(rows.length?' '+a[6]:''));
 panel.replaceChildren(head,table,note);
}
var pending=false;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;render()})}
new MutationObserver(function(records){
 if(records.some(function(r){
  var n=r.target;
  if(n===root||n.id==='v38Slots'||n.id==='v38Today'||n.id==='v58SessionsZone')return true;
  return n.classList?.contains('v38-home');
 }))schedule();
}).observe(root,{subtree:true,childList:true});
// The i18n runtime updates document.lang after dispatching its change event.
new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
window.addEventListener('asoboon:language-changed',function(){schedule();setTimeout(schedule,80)});

window.addEventListener('asoboon:v8-home-status',schedule);
window.addEventListener('asoboon:v2-route-rendered',schedule);
window.addEventListener('popstate',schedule);
window.BOON_HOME_V60=Object.freeze({version:'6.0',forecastPercent:rate,readOnly:true});
schedule();
})();