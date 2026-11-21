/* ASOBooN authoritative five operating profiles.
 * Calendar businessType remains one of four original values. Monday is a
 * display/WEB availability subcategory ONLY when original type === '平日'.
 * Pure read-only rules; never writes AirWAIT or changes queue/call groupings.
 */
(()=>{'use strict';
const opening=Object.freeze({WEB:420,LINE_STORE:570});
const mode=Object.freeze({WEB:'KeyONLINE_RECEPTION_ONLY',LINE_STORE:'KeySTORE_RECEPTION_ONLY'});
const channel=(id,entry,name)=>Object.freeze({id,entry,name});
const round=(key,title,web,line)=>Object.freeze({
 key,title,web:web||null,line:line||null,forecast:false
});
const define=(key,title,forecast,rounds)=>Object.freeze({
 key,title,forecast,rounds:Object.freeze(rounds.map(r=>Object.freeze({...r,forecast})))
});
const profiles=Object.freeze({
 WEEKDAY_MONDAY:define('WEEKDAY_MONDAY','通常平日（月曜）',false,[
  round('weekday_am','午前の回',channel('0024','10:00','10時ご入場枠【WEB平日】'),channel('0023','すぐ入場','すぐ入場受付【平日】')),
  round('weekday_14','14:00の回',channel('0027','14:00','14時ご入場枠【WEB平日】'),channel('0025','14:00から','14時から【平日】'))
 ]),
 WEEKDAY_OTHER:define('WEEKDAY_OTHER','通常平日',false,[
  round('weekday_walkin','すぐ入場',null,channel('0023','すぐ入場','すぐ入場受付【平日】')),
  round('weekday_14','14:00から',null,channel('0025','14:00から','14時から【平日】'))
 ]),
 SPECIAL_WEEKDAY:define('SPECIAL_WEEKDAY','平日特定日',true,[
  round('special_10','10:00の回',channel('0036','10:00','10時ご入場枠【WEB平日特定日】'),channel('0035','10:15','10時15分から【平日特定日】')),
  round('special_1330','13:30の回',channel('0038','13:30','13時半ご入場枠【WEB平日特定日】'),channel('0037','13:45','13時45分から【平日特定日】'))
 ]),
 WEEKEND_HOLIDAY:define('WEEKEND_HOLIDAY','土日祝日',true,[
  round('weekend_10','10:00の回',channel('0030','10:00','10時ご入場枠【WEB整理券】'),channel('0029','10:25頃','10時25分頃入場【土休日特定日】')),
  round('weekend_1230','12:30の回',channel('0032','12:30','12時半ご入場枠【WEB整理券】'),channel('0031','12:50頃','12時50分頃入場【土休日特定日】')),
  round('weekend_15','15:00の回',channel('0034','15:00','15時ご入場枠【WEB整理券】'),channel('0033','15:15頃','15時15分頃入場時間【土休日特定日】'))
 ]),
 CLOSED:define('CLOSED','休館日',false,[])
});
function validDate(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const [y,m,d]=s.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d,12));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d;
}
function resolve(day,expectedDate){
 if(day?.ok!==true||day?.stale===true||/stale|fallback/i.test(String(day?.source||''))||
    !validDate(day?.operationalDate)||expectedDate&&day.operationalDate!==expectedDate)return null;
 const type=String(day.businessType||'').normalize('NFKC').trim();
 let key;
 if(type==='平日'){
  const [y,m,d]=day.operationalDate.split('-').map(Number);
  key=new Date(Date.UTC(y,m-1,d,12)).getUTCDay()===1?'WEEKDAY_MONDAY':'WEEKDAY_OTHER';
 }else key=({'平日特定日':'SPECIAL_WEEKDAY','土日祝日':'WEEKEND_HOLIDAY','休館':'CLOSED'})[type];
 return key?profiles[key]:null;
}
function expectedIds(profile){
 return new Set((profile?.rounds||[]).flatMap(r=>[r.web?.id,r.line?.id].filter(Boolean)));
}
function expectedChannel(profile,id){
 for(const r of profile?.rounds||[]){
  if(r.web?.id===id)return {round:r,channel:'WEB',meta:r.web,usage:mode.WEB};
  if(r.line?.id===id)return {round:r,channel:'LINE_STORE',meta:r.line,usage:mode.LINE_STORE};
 }
 return null;
}
function reconcile(profile,{slots=[],publicFlags=null,verified=false,minute=0,closed=false}={}){
 const expected=expectedIds(profile),regular=new Set(Object.values(profiles).flatMap(p=>[...expectedIds(p)])),actual=new Map(),problems=[];
 const flags=publicFlags instanceof Map?publicFlags:null;
 if(!profile)return {expected,actual,problems:[{reason:'CALENDAR_UNKNOWN'}],verified:false};
 for(const item of slots){
  const id=String(item?.waitTypeId||''),ref=expectedChannel(profile,id);
  if(!id)continue;
  if(!ref){
   if(verified&&regular.has(id))problems.push({reason:'UNEXPECTED_PUBLISHED',id});
   continue;
  }
  if(item.usageDispType!==ref.usage){
   problems.push({reason:'WRONG_CHANNEL',id});continue;
  }
  // Exactly one live published record per ID is required.
  if(actual.has(id)){actual.delete(id);problems.push({reason:'DUPLICATE_ID',id});continue}
  actual.set(id,item);
 }
 for(const r of profile.rounds){
  for(const [channel,meta] of [['WEB',r.web],['LINE_STORE',r.line]]){
   if(!meta)continue;
   const publicNow=minute>=opening[channel]&&!closed;
   const slot=actual.get(meta.id);
   if(verified&&publicNow&&(flags?.get(meta.id)===false||!slot))
    problems.push({reason:'NOT_PUBLISHED',id:meta.id,channel});
  }
 }
 if(!verified)problems.push({reason:'AIRWAIT_UNVERIFIED'});
 if(profile.key==='CLOSED'&&slots.some(x=>expected.size===0))problems.push({reason:'CLOSED_DAY_HAS_PUBLISHED_SLOTS'});
 return {expected,actual,problems,verified};
}
window.ASOBOON_OPERATING_PROFILES=Object.freeze({version:'2026-11-21.1',profiles,opening,mode,validDate,resolve,expectedIds,expectedChannel,reconcile,web:(day,date)=>resolve(day,date)?.rounds.some(r=>r.web)===true});
})();