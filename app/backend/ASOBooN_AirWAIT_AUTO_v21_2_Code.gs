/**
 * ASOBooN AirWAIT AUTO v21.2.2
 * AirWAIT担当部署回答準拠 / 安全初期化版
 *
 * 【AirWAIT APIルール】
 * 定期実行: 最終更新日時取得APIだけ（GASでは1分ごと）
 * 更新検知時だけ: 呼出番号取得API
 * 呼出中件数が減った時だけ: 予約呼出API
 *
 * 指定時刻到達時の初期呼出は各枠1日1回の単発処理。
 * 初期取得に失敗しても1分トリガーでは自動再試行しない。
 * lastUpdate失敗時は他のAirWAIT APIへ進まない。
 * 営業区分は共通「営業カレンダー」APIだけを正本にし、低頻度キャッシュする。
 */
const A21=Object.freeze({
  VERSION:'21.2.2',TZ:'Asia/Tokyo',ORIGIN:'https://asoboon.github.io',STORE_ID:'KR01205179',
  KEY_PROP:'AIRWAIT_API_KEY',SS_PROP:'AUTO21_SPREADSHEET_ID',
  CONTROL:'CONTROL',MAP:'RESERVE_MAP',LOG:'CALL_LOG',
  CALENDAR:'https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec',
  LAST:'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless',
  RES:'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  CALL:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/call',
  SCHEDULE:Object.freeze({'0042':'08:00','0023':'09:30','0025':'14:00','0035':'10:15','0037':'13:45','0029':'10:25','0031':'12:50','0033':'15:15'}),
  PROD:Object.freeze({'平日':Object.freeze(['0023','0025']),'平日特定日':Object.freeze(['0035','0037']),'土日祝日':Object.freeze(['0029','0031','0033']),'休館':Object.freeze([])})
});

function setupAutoV21(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('AUTO管理スプレッドシートから「拡張機能 → Apps Script」で開いてください。');
  const props=PropertiesService.getScriptProperties();
  props.setProperty(A21.SS_PROP,ss.getId());
  ensureControl_(ss);ensureMap_(ss);ensureLog_(ss);
  setControl_(ss,'systemVersion',A21.VERSION);
  setControl_(ss,'autoEnabled','FALSE');
  setControl_(ss,'testMode','TRUE');
  resetRuntime_();
  removeTriggers_();
  ScriptApp.newTrigger('autoWorkerV21').timeBased().everyMinutes(1).create();
  console.log('AUTO v21.2.2 setup complete: '+ss.getName()+' / '+ss.getId());
  console.log('安全初期化完了: autoEnabled=FALSE / testMode=TRUE');
}

function autoWorkerV21(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return;
  try{
    const ss=book_(),ctl=control_(ss);if(!bool_(ctl.autoEnabled))return;
    const now=new Date(),day=businessDay_(now,ctl);if(!day||day.isClosed||day.businessType==='休館')return;
    if(!withinHours_(day,ctl,now))return;
    const ids=activeIds_(day.businessType,ctl),sched=schedule_(ctl),due=ids.filter(id=>started_(id,sched,now));if(!due.length)return;

    initialStarts_(ss,due,ctl,now);

    let marker;try{marker=lastUpdate_()}catch(e){log_(ss,'LAST_UPDATE_ERROR','','','',String(e.message||e));return}
    const props=PropertiesService.getScriptProperties(),prev=props.getProperty('AUTO21_LAST_UPDATE')||'';
    if(!prev){props.setProperty('AUTO21_LAST_UPDATE',marker);return}
    if(marker===prev)return;

    let rows;try{rows=allReservations_()}catch(e){log_(ss,'RESERVATIONS_ERROR','','','',String(e.message||e));return}
    due.forEach(id=>updatedSlot_(ss,rows,id,ctl,now));
    props.setProperty('AUTO21_LAST_UPDATE',marker);
  }catch(e){try{log_(book_(),'WORKER_ERROR','','','',String(e.message||e))}catch(_){}console.error(e)}finally{try{lock.releaseLock()}catch(_){}}
}

function initialStarts_(ss,due,ctl,now){
  const p=PropertiesService.getScriptProperties(),date=jstDate_(now);
  const need=due.filter(id=>p.getProperty(key_('START',date,id))!=='1'&&p.getProperty(key_('START_ATTEMPT',date,id))!=='1');
  if(!need.length)return;

  // 定期トリガーから受付一覧APIを繰り返さないため、取得前に「試行済み」を立てる。
  need.forEach(id=>p.setProperty(key_('START_ATTEMPT',date,id),'1'));

  let rows;
  try{rows=allReservations_()}
  catch(e){
    need.forEach(id=>log_(ss,'INITIAL_RESERVATIONS_ERROR',id,'','',String(e.message||e)+' / 自動再試行なし'));
    return;
  }

  need.forEach(id=>{
    const r=fill_(ss,forType_(rows,id),id,ctl,'INITIAL_AT_START');
    p.setProperty(key_('START',date,id),'1');
    p.setProperty(key_('COUNT',date,id),String(r.after));
    if(r.called>0||r.after>0)p.setProperty(key_('PRIMED',date,id),'1');
  });
}

function retryInitialSlotV21(waitTypeId){
  const id=String(waitTypeId||'').trim();
  if(!/^\d{4}$/.test(id))throw new Error('waitTypeId は4桁で指定してください。');
  const p=PropertiesService.getScriptProperties(),date=jstDate_(new Date());
  p.deleteProperty(key_('START_ATTEMPT',date,id));
  p.deleteProperty(key_('START',date,id));
  console.log('初回呼出の再試行を許可しました: '+date+' / '+id+'。次のautoWorkerV21で1回だけ再試行します。');
}

function updatedSlot_(ss,rows,id,ctl,now){
  const p=PropertiesService.getScriptProperties(),date=jstDate_(now),list=forType_(rows,id);
  const current=calling_(list).length,waiting=waiting_(list),countKey=key_('COUNT',date,id),primeKey=key_('PRIMED',date,id);
  const prevRaw=p.getProperty(countKey),prev=prevRaw===null?null:Number(prevRaw);let primed=p.getProperty(primeKey)==='1',after=current;

  if(!primed&&current===0&&waiting.length){const r=fill_(ss,list,id,ctl,'INITIAL_AFTER_START');after=r.after;if(r.called>0||after>0)p.setProperty(primeKey,'1');p.setProperty(countKey,String(after));return}
  if(prev===null){p.setProperty(countKey,String(current));return}

  if(current<prev){const r=fill_(ss,list,id,ctl,'REPLENISH_AFTER_DECREASE');after=r.after;if(after===0&&waiting_(list).length===0)p.deleteProperty(primeKey)}
  p.setProperty(countKey,String(after));
}

function fill_(ss,list,id,ctl,reason){
  const target=Math.max(1,Math.min(30,Number(ctl.targetCalling||10))),current=calling_(list).length;
  const candidates=waiting_(list).slice(0,Math.max(0,target-current));let called=0;
  for(const row of candidates){
    const no=receipt_(row),rid=reserveId_(row)||mapped_(ss,no,id);
    if(!rid){log_(ss,'SKIP_MISSING_RESERVE_ID',id,no,'',reason);continue}
    try{call_(rid,String(ctl.callingMethodType||'00'));called++;log_(ss,'CALLED',id,no,rid,reason);Utilities.sleep(1200)}
    catch(e){log_(ss,'CALL_ERROR',id,no,rid,String(e.message||e));break}
  }
  return{called:called,after:current+called};
}

function lastUpdate_(){
  const u=A21.LAST+'?key='+encodeURIComponent(apiKey_())+'&storeId='+encodeURIComponent(A21.STORE_ID);
  const r=UrlFetchApp.fetch(u,{method:'get',headers:{Origin:A21.ORIGIN},muteHttpExceptions:true,followRedirects:true});
  if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('lastUpdate HTTP '+r.getResponseCode());
  const d=parse_(r.getContentText(),'lastUpdate');if(!ok_(d))throw new Error(msg_(d,'lastUpdate API error'));
  const m=marker_(d);if(!m)throw new Error('lastUpdate markerを取得できません。');return m;
}

function allReservations_(){const out=[];let start=1,total=Infinity,guard=0;while(start<=total&&guard++<40){const p=resPage_(start);total=p.count||p.rows.length;out.push.apply(out,p.rows);if(!p.rows.length||start+p.rows.length>total)break;start+=p.rows.length}return out}
function resPage_(start){
  const u=A21.RES+'?key='+encodeURIComponent(apiKey_());
  const r=UrlFetchApp.fetch(u,{method:'post',headers:{Origin:A21.ORIGIN},contentType:'application/x-www-form-urlencoded; charset=UTF-8',payload:{storeId:A21.STORE_ID,sortStatus:'0',isDesc:'0',start:String(start),limit:'100'},muteHttpExceptions:true});
  if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('reservations HTTP '+r.getResponseCode());
  const d=parse_(r.getContentText(),'reservations');if(!ok_(d))throw new Error(msg_(d,'reservations API error'));
  return{count:Number(d&&d.innerDto&&d.innerDto.count||0),rows:Array.isArray(d&&d.innerDto&&d.innerDto.reservations)?d.innerDto.reservations:[]};
}
function call_(rid,method){
  const u=A21.CALL+'?key='+encodeURIComponent(apiKey_());
  const r=UrlFetchApp.fetch(u,{method:'post',headers:{Origin:A21.ORIGIN},contentType:'application/x-www-form-urlencoded; charset=UTF-8',payload:{storeId:A21.STORE_ID,reserveId:normRid_(rid),callingMethodType:String(method||'00')},muteHttpExceptions:true});
  if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('reserve/call HTTP '+r.getResponseCode());
  const d=parse_(r.getContentText(),'reserve/call');if(!ok_(d))throw new Error(msg_(d,'reserve/call API error'));return d;
}

function businessDay_(now,ctl){
  if(bool_(ctl.testMode))return{businessType:'TEST',isClosed:false,operationalDate:jstDate_(now),closingTime:'18:00'};
  const date=jstDate_(now),apiUrl=String(ctl.calendarApiUrl||A21.CALENDAR),ttlMin=Math.max(60,Math.min(1440,Number(ctl.calendarCacheMinutes||360)||360));
  const props=PropertiesService.getScriptProperties(),cacheKey='AUTO21_CALENDAR_'+date;
  try{
    const cached=JSON.parse(props.getProperty(cacheKey)||'null');
    if(cached&&cached.apiUrl===apiUrl&&Date.now()-Number(cached.savedAt||0)<ttlMin*60000){
      const day=cached.day,type=String(day&&day.businessType||'');
      if(day&&Object.prototype.hasOwnProperty.call(A21.PROD,type))return day;
    }
  }catch(_){}

  const u=apiUrl+'?action=current&date='+encodeURIComponent(date);
  const r=UrlFetchApp.fetch(u,{method:'get',muteHttpExceptions:true,followRedirects:true});if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('営業カレンダー HTTP '+r.getResponseCode());
  const d=parse_(r.getContentText(),'calendar');if(!d||d.ok!==true)throw new Error(String(d&&d.message||'営業カレンダーを取得できません。'));
  const type=String(d.businessType||'').trim();if(!Object.prototype.hasOwnProperty.call(A21.PROD,type))throw new Error('未対応の営業区分: '+type);
  const day={businessType:type,isClosed:Boolean(d.isClosed)||type==='休館',operationalDate:String(d.operationalDate||date),closingTime:String(d.closingTime||(type==='土日祝日'?'18:00':'17:00'))};
  props.setProperty(cacheKey,JSON.stringify({savedAt:Date.now(),apiUrl:apiUrl,day:day}));
  props.getKeys().filter(k=>/^AUTO21_CALENDAR_/.test(k)&&k!==cacheKey).forEach(k=>props.deleteProperty(k));
  return day;
}
function withinHours_(day,ctl,now){const open=bool_(ctl.testMode)?clock_('08:00'):clock_('09:30'),close=clock_(day.closingTime||'18:00'),m=jstMinutes_(now);return m>=open&&m<close}
function activeIds_(type,ctl){return bool_(ctl.testMode)?[String(ctl.testWaitTypeId||'0042')]:(A21.PROD[type]||[]).slice()}
function schedule_(ctl){const x=Object.assign({},A21.SCHEDULE),raw=String(ctl.slotScheduleJson||'').trim();if(raw)try{const c=JSON.parse(raw);Object.keys(c||{}).forEach(k=>{if(/^\d{4}$/.test(k)&&/^\d{2}:\d{2}$/.test(String(c[k])))x[k]=String(c[k])})}catch(_){}return x}
function started_(id,s,now){return /^\d{2}:\d{2}$/.test(String(s[id]||''))&&jstMinutes_(now)>=clock_(s[id])}

function forType_(rows,id){return rows.filter(r=>String(r&&r.waitTypeId||'')===String(id))}
function calling_(rows){return rows.filter(r=>callFlag_(r&&r.isCalling)&&String(r&&r.status||'')!=='1')}
function waiting_(rows){return rows.filter(r=>String(r&&r.status||'')==='0'&&!callFlag_(r&&r.isCalling)).sort((a,b)=>receiptNum_(a)-receiptNum_(b))}
function callFlag_(v){return v===true||v===1||v==='1'||String(v).toLowerCase()==='true'}
function receipt_(r){return String(r&&(r.number!=null?r.number:r.receiptNo)||'').normalize('NFKC').replace(/\D/g,'')}
function receiptNum_(r){const n=Number(receipt_(r));return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
function reserveId_(r){for(const v of [r&&r.reserveId,r&&r.reserveID,r&&r.reservationId,r&&r.reservationID]){const x=normRid_(v);if(x)return x}return''}
function normRid_(v){const d=String(v==null?'':v).normalize('NFKC').replace(/\D/g,'');return!d||d.length>12?'':d.padStart(12,'0')}

function doPost(e){try{const p=Object.assign({},e&&e.parameter||{}),rid=normRid_(p.reserveId),no=String(p.receiptNo||'').normalize('NFKC').replace(/\D/g,''),id=String(p.waitTypeId||'').trim();if(!rid||!no||!/^\d{4}$/.test(id))return out_({ok:false,error:'VALIDATION_ERROR'});upsertMap_(book_(),{receivedAt:new Date(),receiptNo:no,reserveId:rid,waitTypeId:id,waitTypeName:String(p.waitTypeName||''),operationalDay:String(p.operationalDay||''),source:String(p.source||''),adults:String(p.adults||''),paidChildren:String(p.paidChildren||''),infants:String(p.infants||''),totalPeople:String(p.totalPeople||'')});return out_({ok:true})}catch(err){return out_({ok:false,error:String(err.message||err)})}}
function doGet(e){const a=String(e&&e.parameter&&e.parameter.action||'health');if(a==='health')return out_({ok:true,service:'ASOBooN AirWAIT AUTO',version:A21.VERSION,periodicAirwaitApi:'lastUpdate-only'});if(a==='status')try{const c=control_(book_());return out_({ok:true,version:A21.VERSION,autoEnabled:bool_(c.autoEnabled),testMode:bool_(c.testMode),targetCalling:Number(c.targetCalling||10)})}catch(err){return out_({ok:false,error:String(err.message||err)})}return out_({ok:false,error:'UNKNOWN_ACTION'})}

function book_(){const id=PropertiesService.getScriptProperties().getProperty(A21.SS_PROP);if(!id)throw new Error('AUTO管理スプレッドシート未登録。先に setupAutoV21 を実行してください。');return SpreadsheetApp.openById(id)}
function ensureControl_(ss){let sh=ss.getSheetByName(A21.CONTROL);if(!sh)sh=ss.insertSheet(A21.CONTROL);const defs=[['systemVersion',A21.VERSION],['autoEnabled','FALSE'],['targetCalling','10'],['testMode','TRUE'],['testWaitTypeId','0042'],['callingMethodType','00'],['calendarApiUrl',A21.CALENDAR],['calendarCacheMinutes','360'],['slotScheduleJson',JSON.stringify(A21.SCHEDULE)]],have={};if(sh.getLastRow())sh.getRange(1,1,sh.getLastRow(),2).getDisplayValues().forEach(r=>{const k=String(r[0]||'').trim();if(k)have[k]=1});const add=defs.filter(r=>!have[r[0]]);if(add.length)sh.getRange(sh.getLastRow()+1,1,add.length,2).setValues(add);return sh}
function setControl_(ss,k,v){const sh=ensureControl_(ss),last=sh.getLastRow();if(last){const keys=sh.getRange(1,1,last,1).getDisplayValues().flat();const i=keys.findIndex(x=>String(x).trim()===k);if(i>=0){sh.getRange(i+1,2).setValue(v);return}}sh.appendRow([k,v])}
function ensureMap_(ss){let sh=ss.getSheetByName(A21.MAP);if(!sh)sh=ss.insertSheet(A21.MAP);const h=['receivedAt','receiptNo','reserveId','waitTypeId','waitTypeName','operationalDay','source','adults','paidChildren','infants','totalPeople','updatedAt'];if(!sh.getLastRow())sh.getRange(1,1,1,h.length).setValues([h]);sh.getRange('B:D').setNumberFormat('@');return sh}
function ensureLog_(ss){let sh=ss.getSheetByName(A21.LOG);if(!sh)sh=ss.insertSheet(A21.LOG);const h=['at','event','waitTypeId','receiptNo','reserveId','detail'];if(!sh.getLastRow())sh.getRange(1,1,1,h.length).setValues([h]);sh.getRange('C:E').setNumberFormat('@');return sh}
function control_(ss){const sh=ensureControl_(ss),o={};if(sh.getLastRow())sh.getRange(1,1,sh.getLastRow(),2).getDisplayValues().forEach(r=>{const k=String(r[0]||'').trim();if(k)o[k]=r[1]});return o}
function upsertMap_(ss,x){const sh=ensureMap_(ss),last=sh.getLastRow();let n=0;if(last>=2){const v=sh.getRange(2,2,last-1,3).getDisplayValues();for(let i=v.length-1;i>=0;i--)if(String(v[i][0])===x.receiptNo&&String(v[i][2])===x.waitTypeId){n=i+2;break}}const row=[x.receivedAt,x.receiptNo,x.reserveId,x.waitTypeId,x.waitTypeName,x.operationalDay,x.source,x.adults,x.paidChildren,x.infants,x.totalPeople,new Date()];sh.getRange(n||last+1,1,1,row.length).setValues([row])}
function mapped_(ss,no,id){const sh=ensureMap_(ss),last=sh.getLastRow();if(last<2)return'';const v=sh.getRange(2,2,last-1,3).getDisplayValues();for(let i=v.length-1;i>=0;i--)if(String(v[i][0])===String(no)&&String(v[i][2])===String(id))return normRid_(v[i][1]);return''}
function log_(ss,event,id,no,rid,detail){if(ss)ensureLog_(ss).appendRow([new Date(),String(event||''),String(id||''),String(no||''),String(rid||''),String(detail||'')])}

function apiKey_(){const k=PropertiesService.getScriptProperties().getProperty(A21.KEY_PROP);if(!k)throw new Error('Script Properties に AIRWAIT_API_KEY がありません。');return k}
function marker_(p){const names=['lastUpdDate','lastUpdate','lastUpdateDate','lastUpdatedAt','updateDate','updatedAt','lastUpdDateStateless'],seen=[];function walk(v,d){if(!v||typeof v!=='object'||d>5||seen.indexOf(v)>=0)return'';seen.push(v);for(const k of names)if(v[k]!=null&&String(v[k]).trim())return String(v[k]).trim();for(const k of Object.keys(v))if(/last.*upd|update.*date|updated/i.test(k)&&v[k]!=null&&typeof v[k]!=='object'&&String(v[k]).trim())return String(v[k]).trim();for(const k of Object.keys(v)){const x=walk(v[k],d+1);if(x)return x}return''}return walk(p,0)}
function ok_(d){return d&&(d.success===true||String(d.resultCode&&d.resultCode.code||'')==='0000')}
function msg_(d,f){return String(d&&d.resultCode&&d.resultCode.defaultMessage||f)}
function parse_(t,l){try{return JSON.parse(t)}catch(_){throw new Error(l+' JSON parse error')}}
function bool_(v){return v===true||v===1||v==='1'||String(v||'').toUpperCase()==='TRUE'}
function key_(k,d,id){return'AUTO21_'+k+'_'+d+'_'+id}
function clock_(t){const m=String(t||'').match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):0}
function jstDate_(d){return Utilities.formatDate(d,A21.TZ,'yyyy-MM-dd')}
function jstMinutes_(d){return Number(Utilities.formatDate(d,A21.TZ,'H'))*60+Number(Utilities.formatDate(d,A21.TZ,'m'))}
function out_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function removeTriggers_(){ScriptApp.getProjectTriggers().forEach(t=>{if(['autoWorkerV21','autoWorker','autoWorkerV20'].includes(t.getHandlerFunction()))ScriptApp.deleteTrigger(t)})}
function resetRuntime_(){const p=PropertiesService.getScriptProperties();p.getKeys().filter(k=>/^AUTO21_/.test(k)&&k!==A21.SS_PROP).forEach(k=>p.deleteProperty(k))}
function resetAutoV21State(){resetRuntime_();console.log('AUTO v21 runtime state reset. AIRWAIT_API_KEY / spreadsheet binding は保持。')}
function testAutoV21Health(){const ss=book_(),ctl=control_(ss),day=businessDay_(new Date(),ctl);console.log(JSON.stringify({version:A21.VERSION,spreadsheet:ss.getName(),control:ctl,businessDay:day,lastUpdate:lastUpdate_()},null,2))}
