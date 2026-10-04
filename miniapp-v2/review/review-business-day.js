(()=>{'use strict';
const E=window.ASOBOON_V2_ENV||{};const TZ='Asia/Tokyo',CUT=19;const pad=v=>String(v).padStart(2,'0');
function operationalDate(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));const d=new Date(Date.UTC(+p.year,+p.month-1,+p.day+(+p.hour>=CUT?1:0),12));return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`}
function value(date){return Object.freeze({ok:true,version:'1.0-review',source:'review-simulation',operationalDate:date,businessType:'土日祝日',isClosed:false,durationMinutes:150,durationLabel:'2時間30分',closingTime:'23:59',note:'LINE審査用テスト環境です。実際の営業終了時刻はHOME公開版の営業カレンダーに従います。',weekday:''})}
async function getByDate(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('日付形式が不正です。');return value(s)}
async function getCurrent(){return value(operationalDate())}
window.ASOBOON_V2_BUSINESS_DAY=Object.freeze({version:'1.0-review',timeZone:TZ,cutoffHour:CUT,operationalDate,getByDate,getCurrent});
})();
