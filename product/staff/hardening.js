(()=>{
'use strict';
const base=window.QueueProductAPI,C=window.QUEUE_PRODUCT_CONFIG||{};
if(!base)return;
const recent=new Map(),dedupeMs=Number(C.callDedupeMs||60000);
function dayKey(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:C.timezone||'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value])),today=`${p.year}-${p.month}-${p.day}`;if(Number(p.hour)<Number(C.nextDayOpenHour??19))return today;const[y,m,d]=today.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d+1,12));return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`}
async function staffSnapshot(){const d=await base.staffSnapshot();if(!d||!Array.isArray(d.reservations))return d;const day=dayKey();return{...d,reservations:d.reservations.filter(x=>String(x.operationalDay||'')===day)}}
async function reservations(waitTypeId,extra={}){if(base.demoMode)return base.reservations(waitTypeId,extra);const out=[];let start=Math.max(1,Number(extra.start)||1),total=1,guard=0;do{const d=await base.reservations(waitTypeId,{...extra,start:String(start),limit:'100'}),rows=Array.isArray(d?.innerDto?.reservations)?d.innerDto.reservations:[];out.push(...rows);total=Number(d?.innerDto?.count||rows.length);if(!rows.length||rows.length<100)break;start+=rows.length}while(out.length<total&&guard++<30);return{ok:true,innerDto:{reservations:out,count:total}}}
async function callReservation(reserveId,extra={}){const id=String(reserveId||''),last=recent.get(id)||0;if(Date.now()-last<dedupeMs)return{ok:true,reserveId:id,deduped:true};recent.set(id,Date.now());try{return await base.callReservation(id,extra)}catch(e){recent.delete(id);throw e}}
window.QueueProductAPI=Object.freeze({...base,staffSnapshot,reservations,callReservation});
})();
