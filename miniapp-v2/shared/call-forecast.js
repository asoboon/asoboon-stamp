/* ASOBooN call-time reference forecast. Not an official admission appointment.
   Deliberately uses only a verified reservationStatus response; no extra calls. */
(()=>{'use strict';
const ROUNDS=Object.freeze({
 '0029':{start:'10:00',cutoff:'12:00'},
 '0031':{start:'12:30',cutoff:'14:30'},
 '0033':{start:'15:00'},
 '0035':{start:'10:00',cutoff:'13:00'},
 '0037':{start:'13:30'},
 '0025':{start:'14:00'}
});
function pace(rank,total){
 if(!Number.isFinite(rank)||rank<=0)return 0;
 const r=Math.max(1,Math.round(rank)),t=Math.max(r,Math.round(total||r));
 if(r<=20)return r/20*5;
 if(r<=60)return 5+(r-20)/10*5;
 return 25+Math.min(1,(r-60)/Math.max(1,t-60))*5;
}
function parseClock(value){
 const m=/^(\d{1,2}):(\d{2})$/.exec(String(value||''));
 return m?Number(m[1])*60+Number(m[2]):null;
}
function jstNow(epoch){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
  timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 }).formatToParts(new Date(epoch)).map(x=>[x.type,x.value]));
 return {date:parts.year+'-'+parts.month+'-'+parts.day,minutes:Number(parts.hour)*60+Number(parts.minute)};
}
function fmt(minutes){
 const n=Math.min(1439,Math.max(0,Math.round(minutes/5)*5));
 return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
}
function predict(status,nowEpoch=Date.now()){
 if(status?.ok!==true||status.found!==true||status.state!=='waiting')return null;
 const round=ROUNDS[String(status.waitTypeId||'')];
 if(!round)return null; // Includes immediate reception: no forecast.
 const ahead=status.aheadCount,rank=status.queueRank,total=status.activeCount;
 if(!Number.isSafeInteger(ahead)||ahead<0||!Number.isSafeInteger(rank)||rank<=0
    ||!Number.isSafeInteger(total)||total<rank)return null;
 const checked=Number(status.checkedAt);
 if(!Number.isFinite(checked)||checked<=0||Math.abs(nowEpoch-checked)>3*60*1000)return null;
 const now=jstNow(checked);
 if(String(status.businessDate||'')!==now.date)return null;
 const start=parseClock(round.start),cutoff=parseClock(round.cutoff);
 if(start===null||(cutoff!==null&&now.minutes>=cutoff))return null;
 const prestart=now.minutes<start;
 const estimated=prestart
  ?start+pace(rank,total)
  :now.minutes+pace(ahead+1,Math.max(total,ahead+1));
 if(cutoff!==null&&estimated>cutoff)return null;
 return Object.freeze({
  start:round.start,clock:fmt(estimated),prestart,
  soon:!prestart&&ahead<=2,ahead,
  method:'reference-queue-pace',checkedAt:checked
 });
}
window.ASOBOON_V2_CALL_FORECAST=Object.freeze({predict});
})();
