(()=>{'use strict';
const base=window.ASOBOON_V2_BUSINESS_DAY;
if(!base||typeof base.getByDate!=='function')return;
const TZ='Asia/Tokyo';
const CUTOFF_HOUR=19;
const pad=v=>String(v).padStart(2,'0');
function operationalDate(epoch=Date.now()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(epoch)).map(x=>[x.type,x.value]));
  const dt=new Date(Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day)+(Number(p.hour)>=CUTOFF_HOUR?1:0),12));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`;
}
function getCurrent(options={}){return base.getByDate(operationalDate(),options)}
window.ASOBOON_V2_BUSINESS_DAY=Object.freeze({...base,version:String(base.version||'')+'+develop-cutoff19-v25',cutoffHour:CUTOFF_HOUR,operationalDate,getCurrent});
})();
