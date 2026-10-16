(()=>{'use strict';
const D=window.ASOBOON_V2_BUSINESS_DAY||{};
const $=id=>document.getElementById(id),grid=$('bcGrid'),status=$('bcStatus'),detail=$('bcDetail');
const pad=n=>String(n).padStart(2,'0'),CACHE_KEY='asoboon_business_calendar_month_v2',CACHE_MS=12*60*60*1000,CACHE_FRESH_MS=5*60*1000;
function jstToday(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`}
function ymd(y,m,d){return `${y}-${pad(m+1)}-${pad(d)}`}
function parts(date){const [y,m,d]=date.split('-').map(Number);return{year:y,month:m,day:d}}
function monthKey(date){const{year,month}=parts(date);return year*12+month-1}
function fmtMonth(y,m){return `${y}年 ${m+1}月`}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function daysInMonth(y,m){return new Date(Date.UTC(y,m+1,0)).getUTCDate()}
function mondayOffset(y,m){return(new Date(Date.UTC(y,m,1)).getUTCDay()+6)%7}
function monthDates(y,m,today){const n=daysInMonth(y,m),p=parts(today),start=y===p.year&&m===p.month-1?p.day:1;return Array.from({length:Math.max(0,n-start+1)},(_,i)=>ymd(y,m,start+i))}
let today=jstToday(),currentMonth=monthKey(today),maxMonth=currentMonth+1;
let shownMonth=currentMonth,selectedDate=today,days=new Map(),loadToken=0,monthLoadingKey='';
function label(day){if(!day)return'';const type=String(day.businessType||'').normalize('NFKC').trim();if(day.isClosed||type==='休館')return'休館';return['平日','平日特定日','土日祝日'].includes(type)?type:'営業日'}
function categoryClass(day){if(!day||day.isClosed)return'';return({'平日':'type-weekday','平日特定日':'type-special','土日祝日':'type-weekend'})[String(day.businessType||'').normalize('NFKC').trim()]||''}
function monthCacheKey(year,month){return `${year}-${pad(month+1)}`}
function sourceAge(day){const at=Number(day?.fetchedAt||0);return at>0?Date.now()-at:Infinity}
function isFresh(day){const age=sourceAge(day);return day?.ok===true&&!day.stale&&age>=0&&age<CACHE_FRESH_MS}
function saveMonthCache(key,dates){try{const all=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}'),rows={};for(const date of dates){const day=days.get(date);if(day&&sourceAge(day)>=0&&sourceAge(day)<CACHE_MS)rows[date]={day}}all[key]={days:rows};localStorage.setItem(CACHE_KEY,JSON.stringify(all))}catch{}}
function restoreMonthCache(key,dates){try{const all=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}'),entry=all?.[key];if(!entry)return;for(const date of dates){const day=entry.days?.[date]?.day,age=sourceAge(day);if(day?.ok&&day.operationalDate===date&&age>=0&&age<CACHE_MS)days.set(date,day)}}catch{}}
function hasFreshMonthCache(key,dates){return dates.length>0&&dates.every(date=>isFresh(days.get(date)))}
function checkedLabel(day){const at=Number(day?.fetchedAt||0);return at?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(at))+' 確認時点':'確認時刻不明'}
function describe(day,date){if(!day)return'<p>営業情報を読み込めませんでした。</p>';const title=label(day),closed=Boolean(day.isClosed);detail.classList.toggle('closed',closed);let text=`<h2>${Number(date.slice(5,7))}月${Number(date.slice(8,10))}日 <span class="bc-badge">${esc(title)}</span></h2>`;if(closed)text+='<p>休館日です。</p>';else{text+=`<p>営業時間　10:00〜${esc(day.closingTime||'17:00')}</p>`;if(day.durationLabel&&day.durationLabel!=='時間制限なし')text+=`<p>利用時間　${esc(day.durationLabel)}</p>`}if(day.note)text+=`<p>${esc(day.note)}</p>`;text+=`<p>${esc(checkedLabel(day))}${isFresh(day)?'':' ／ 過去の情報（最新未確認）'}</p>`;detail.innerHTML=text}
function render(){const year=Math.floor(shownMonth/12),month=shownMonth%12;$('bcMonth').textContent=fmtMonth(year,month);$('bcPrev').disabled=shownMonth<=currentMonth;$('bcNext').disabled=shownMonth>=maxMonth;const offset=mondayOffset(year,month),count=daysInMonth(year,month),cells=[];for(let i=0;i<offset;i++)cells.push('<span class="bc-day blank" aria-hidden="true"></span>');for(let d=1;d<=count;d++){const date=ymd(year,month,d),isPast=date<today,day=days.get(date),state=day?(day.isClosed?'closed':'open'):'pending',isToday=date===today,isSelected=date===selectedDate;const statusText=day?label(day)+(isFresh(day)?'':'（過去情報）'):(isPast?'':'…');const classes=['bc-day',state,categoryClass(day),isPast?'past':'',isToday?'today':'',isSelected?'selected':''].filter(Boolean).join(' ');const aria=`${year}年${month+1}月${d}日${isToday?'、今日':''}${statusText?`、${statusText}`:''}`;cells.push(`<button class="${classes}" type="button" data-date="${date}" aria-label="${esc(aria)}" ${isPast||!day?'disabled':''}><span class="bc-number">${d}</span><span class="bc-state-mark ${statusText?'':'empty'}">${esc(day?label(day):statusText||'—')}</span>${day&&!isFresh(day)?'<span class="bc-state-mark">過去情報</span>':''}</button>`)}while(cells.length%7)cells.push('<span class="bc-day blank" aria-hidden="true"></span>');grid.innerHTML=cells.join('');const selected=days.get(selectedDate);if(selected)describe(selected,selectedDate);else if(selectedDate<today){detail.classList.remove('closed');detail.innerHTML='<h2>過ぎた日程</h2><p>過ぎた日は薄く表示しています。</p>'}else{detail.classList.remove('closed');detail.innerHTML='<h2>営業情報を確認しています</h2><p>予定が表示されるまで少しお待ちください。</p>'}}
function setStatus(text,isError=false){status.classList.toggle('error',isError);status.textContent=text}
async function loadMonth(force=false){
 const year=Math.floor(shownMonth/12),month=shownMonth%12,key=monthCacheKey(year,month),dates=monthDates(year,month,today);
 if(monthLoadingKey===key)return;
 const token=++loadToken;
 for(const date of dates)if(sourceAge(days.get(date))>=CACHE_MS)days.delete(date);
 restoreMonthCache(key,dates);render();
 if(!dates.length){setStatus('この月の営業予定はありません。');return}
 if(!force&&hasFreshMonthCache(key,dates)){setStatus('確認済みの営業予定を表示しています。');return}
 if(typeof D.getMonth!=='function'){setStatus('営業情報を読み込めません。画面を開き直してください。',true);return}
 const hadCached=dates.some(date=>days.has(date));setStatus(hadCached?'保存済みの予定を表示中です。最新情報を確認しています…':'営業予定を確認しています…');
 monthLoadingKey=key;let confirmed=new Set();
 try{
  const result=await D.getMonth(`${year}-${pad(month+1)}`,{fromDate:dates[0],force});
  if(token!==loadToken)return;
  for(const item of result.days||[])if(item?.ok&&dates.includes(item.operationalDate)){
   days.set(item.operationalDate,item);if(isFresh(item))confirmed.add(item.operationalDate);
  }
 }catch{}
 if(token!==loadToken)return;
 for(const date of dates)if(!confirmed.has(date)&&days.has(date))days.set(date,{...days.get(date),stale:true});
 saveMonthCache(key,dates);
 if(token!==loadToken)return;
 if(monthLoadingKey===key)monthLoadingKey='';
 render();const missing=dates.filter(date=>!days.has(date));
 if(missing.length||confirmed.size<dates.length){
  setStatus(missing.length?`営業情報を確認できない日があります（${missing.length}日）。`:'過去の情報を表示しています（最新未確認）。',true);
  const button=document.createElement('button');button.className='bc-retry';button.id='bcRetry';button.type='button';button.textContent='再読み込み';button.addEventListener('click',()=>loadMonth(true));status.append(' ',button);
 }else setStatus('確認済みの営業予定を表示しています。');
}
function move(delta){const next=shownMonth+delta;if(next<currentMonth||next>maxMonth)return;shownMonth=next;const year=Math.floor(next/12),month=next%12,first=monthDates(year,month,today)[0];selectedDate=first||today;loadMonth(false)}
function refreshDayWindow(){const next=jstToday();if(next===today)return;today=next;currentMonth=monthKey(today);maxMonth=currentMonth+1;shownMonth=currentMonth;selectedDate=today;monthLoadingKey='';days.clear();loadMonth(false)}
let focusCheckAt=0;
function refreshVisible(){
 const before=today;refreshDayWindow();
 if(today!==before)return;
 if(document.hidden||Date.now()-focusCheckAt<30000)return;
 focusCheckAt=Date.now();
 const y=Math.floor(shownMonth/12),m=shownMonth%12,key=monthCacheKey(y,m),dates=monthDates(y,m,today);
 if(monthLoadingKey!==key&&!hasFreshMonthCache(key,dates))void loadMonth(false);
}
setInterval(()=>{if(!document.hidden)refreshVisible()},30000);
window.addEventListener('pageshow',refreshVisible);
window.addEventListener('focus',refreshVisible);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshVisible()});
$('bcPrev').addEventListener('click',()=>move(-1));$('bcNext').addEventListener('click',()=>move(1));grid.addEventListener('click',e=>{const button=e.target.closest('[data-date]');if(!button)return;selectedDate=button.dataset.date;render()});
loadMonth(false);
})();