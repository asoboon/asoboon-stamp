/**
 * ASOBooN AirWAIT AUTO v21.1
 * AirWAIT担当部署回答準拠版
 *
 * 定期AirWAIT API:
 *   1. 最終更新日時取得だけ（Apps Scriptでは1分ごと）
 *   2. 更新検知時だけ呼出番号取得
 *   3. 呼出中件数の減少時だけ予約呼出
 *
 * 指定時刻到達時の初期呼出だけは、1枠1日1回の単発処理。
 * lastUpdate失敗時は他のAirWAIT APIへ進まない。
 */
const AUTO21 = Object.freeze({
  VERSION:'21.1.0', TZ:'Asia/Tokyo', ORIGIN:'https://asoboon.github.io', STORE_ID:'KR01205179',
  KEY_PROP:'AIRWAIT_API_KEY', SS_PROP:'AUTO21_SPREADSHEET_ID',
  CONTROL:'CONTROL', MAP:'RESERVE_MAP', LOG:'CALL_LOG',
  CALENDAR_API:'https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec',
  LAST_UPDATE:'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless',
  RESERVATIONS:'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  CALL:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/call',
  SCHEDULE:Object.freeze({'0042':'08:00','0023':'09:30','0025':'14:00','0035':'10:15','0037':'13:45','0029':'10:25','0031':'12:50','0033':'15:15'}),
  PROD:Object.freeze({'平日':Object.freeze(['0023','0025']),'平日特定日':Object.freeze(['0035','0037']),'土日祝日':Object.freeze(['0029','0031','0033']),'休館':Object.freeze([])})
});

function setupAutoV21(){
  const active=SpreadsheetApp.getActiveSpreadsheet();
  if(!active)throw new Error('AUTO管理スプレッドシートから「拡張機能 → Apps Script」で開いてください。');
  PropertiesService.getScriptProperties().setProperty(AUTO21.SS_PROP,active.getId());
  ensureControl_(active);ensureMap_(active);ensureLog_(active);
  removeAutoTriggers_();
  ScriptApp.newTrigger('autoWorkerV21').timeBased().everyMinutes(1).create();
  console.log('AUTO v21.1 setup complete: '+active.getName()+' / '+active.getId());
  console.log('安全初期値: autoEnabled=FALSE / testMode=TRUE');
}

function autoWorkerV21(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return;
  try{
    const ss=autoSpreadsheet_(),ctl=readControl_(ss);
    if(!bool_(ctl.autoEnabled))return;
    const now=new Date(),day=businessDay_(now,ctl);
    if(!day||day.isClosed||day.businessType==='休館')return;
    if(!withinBusinessHours_(day,ctl,now))return;
    const active=activeIds_(day.businessType,ctl),schedule=schedule_(ctl);
    const due=active.filter(id=>slotStarted_(id,schedule,now));
    if(!due.length)return;

    // 指定時刻到達時の単発・初期呼出。
    initialStarts_(ss,due,ctl,now);

    // ★ 毎回定期実行するAirWAIT APIはこれだけ。
    let marker;
    try{marker=lastUpdate_()}catch(e){log_(ss,'LAST_UPDATE_ERROR','','','',String(e.message||e));return}
    const props=PropertiesService.getScriptProperties(),prev=props.getProperty('AUTO21_LAST_UPDATE')||'';
    if(!prev){props.setProperty('AUTO21_LAST_UPDATE',marker);return}
    if(marker===prev)return;

    // 更新を検知した時だけ呼出番号取得API。
    let rows;
    try{rows=allReservations_()}catch(e){log_(ss,'RESERVATIONS_ERROR','','','',String(e.message||e));return}
    for(const id of due)updatedSlot_(ss,rows,id,ctl,now);
    props.setProperty('AUTO21_LAST_UPDATE',marker);
  }catch(e){try{log_(autoSpreadsheet_(),'WORKER_ERROR','','','',String(e.message||e))}catch(_){}console.error(e)}finally{try{lock.releaseLock()}catch(_){}}
}

function initialStarts_(ss,due,ctl,now){
  const props=PropertiesService.getScriptProperties(),date=jstDate_(now);
  const need=due.filter(id=>props.getProperty(stateKey_('START_SEEN',date,id))!=='1');
  if(!need.length)return;
  let rows;try{rows=allReservations_()}catch(e){log_(ss,'INITIAL_RESERVATIONS_ERROR','','','',String(e.message||e));return}
  for(const id of need){
    const result=fillPool_(ss,rowsFor_(rows,id),id,ctl,'INITIAL_AT_START');
    props.setProperty(stateKey_('START_SEEN',date,id),'1');
    props.setProperty(stateKey_('CALLING',date,id),String(result.callingAfter));
    if(result.called>0||result.callingAfter>0)props.setProperty(stateKey_('PRIMED',date,id),'1');
  }
}

function updatedSlot_(ss,rows,id,ctl,now){
  const props=PropertiesService.getScriptProperties(),date=jstDate_(now),slotRows=rowsFor_(rows,id);
  const current=callingRows_(slotRows).length,waiting=waitingRows_(slotRows);
  const cKey=stateKey_('CALLING',date,id),pKey=stateKey_('PRIMED',date,id);
  const prevRaw=props.getProperty(cKey),prev=prevRaw===null?null:Number(prevRaw);
  let primed=props.getProperty(pKey)==='1',after=current;

  // 開始時に待ち0だった場合、開始後最初の受付を「初期呼出」とする。
  if(!primed&&current===0&&waiting.length>0){
    const r=fillPool_(ss,slotRows,id,ctl,'INITIAL_AFTER_START');after=r.callingAfter;
    if(r.called>0||after>0){props.setProperty(pKey,'1');primed=true}
    props.setProperty(cKey,String(after));return;
  }
  if(prev===null){props.setProperty(cKey,String(current));return}

  // ★ AirWAIT回答どおり、呼出中件数が減った場合だけ予約呼出APIへ進む。
  if(current<prev){
    const r=fillPool_(ss,slotRows,id,ctl,'REPLENISH_AFTER_DECREASE');after=r.callingAfter;
    if(after===0&&waitingRows_(slotRows).length===0){props.deleteProperty(pKey);primed=false}
  }
  props.setProperty(cKey,String(after));
}

function fillPool_(ss,slotRows,id,ctl,reason){
  const target=Math.max(1,Math.min(30,Number(ctl.targetCalling||10))),current=callingRows_(slotRows).length;
  const candidates=waitingRows_(slotRows).slice(0,Math.max(0,target-current));let called=0;
  for(const row of candidates){
    const no=receipt_(row),rid=reserveId_(row)||mappedReserveId_(ss,no,id);
    if(!rid){log_(ss,'SKIP_MISSING_RESERVE_ID',id,no,'',reason);continue}
    try{call_(rid,String(ctl.callingMethodType||'00'));called++;log_(ss,'CALLED',id,no,rid,reason);Utilities.sleep(1200)}
    catch(e){log_(ss,'CALL_ERROR',id,no,rid,String(e.message||e));break}
  }
  return{called:called,callingAfter:current+called};
}

function lastUpdate_(){
  const u=AUTO21.LAST_UPDATE+'?key='+encodeURIComponent(apiKey_())+'&storeId='+encodeURIComponent(AUTO21.STORE_ID);
  const r=UrlFetchApp.fetch(u,{method:'get',headers:{Origin:AUTO21.ORIGIN},muteHttpExceptions:true,followRedirects:true});
  if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('lastUpdate HTTP '+r.getResponseCode());
  const d=jsonParse_(r.getContentText(),'lastUpdate');if(!apiOk_(d))throw new Error(apiMessage_(d,'lastUpdate API error'));
  const marker=updateMarker_(d);if(!marker)throw new Error('lastUpdate markerを取得できません。');return marker;
}

function allReservations_(){
  const out=[];let start=1,total=Infinity,guard=0;
  while(start<=total&&guard++<40){const p=reservationsPage_(start);total=p.count||p.rows.length;out.push.apply(out,p.rows);if(!p.rows.length||start+p.rows.length>total)break;start+=p.rows.length}return out;
}

function reservationsPage_(start){
  const u=AUTO21.RESERVATIONS+'?key='+encodeURIComponent(apiKey_());
  const r=UrlFetchApp.fetch(u,{method:'post',headers:{Origin:AUTO21.ORIGIN},contentType:'application/x-www-form-urlencoded; charset=UTF-8',payload:{storeId:AUTO21.STORE_ID,sortStatus:'0',isDesc:'0',start:String(start),limit:'100'},muteHttpExceptions:true});
  if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('reservations HTTP '+r.getResponseCode());
  const d=jsonParse_(r.getContentText(),'reservations');if(!apiOk_(d))throw new Error(apiMessage_(d,'reservations API error'));
  return{count:Number(d&&d.innerDto&&d.innerDto.count||0),rows:Array.isArray(d&&d.innerDto&&d.innerDto.reservations)?d.innerDto.reservations:[]};
}

function call_(reserveId,method){
  const u=AUTO21.CALL+'?key='+encodeURIComponent(apiKey_());
  const r=UrlFetchApp.fetch(u,{method:'post',headers:{Origin:AUTO21.ORIGIN},contentType:'application/x-www-form-urlencoded; charset=UTF-8',payload:{storeId:AUTO21.STORE_ID,reserveId:normalizeReserveId_(reserveId),callingMethodType:String(method||'00')},muteHttpExceptions:true});
  if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('reserve/call HTTP '+r.getResponseCode());
  const d=jsonParse_(r.getContentText(),'reserve/call');if(!apiOk_(d))throw new Error(apiMessage_(d,'reserve/call API error'));return d;
}

function businessDay_(now,ctl){
  if(bool_(ctl.testMode))return{businessType:'TEST',isClosed:false,operationalDate:jstDate_(now),closingTime:'18:00'};
  const base=String(ctl.calendarApiUrl||AUTO21.CALENDAR_API),u=base+'?action=current&date='+encodeURIComponent(jstDate_(now));
  const r=UrlFetchApp.fetch(u,{method:'get',muteHttpExceptions:true,followRedirects:true});
  if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('営業日カレンダー HTTP '+r.getResponseCode());
  const d=jsonParse_(r.getContentText(),'calendar');if(!d||d.ok!==true)throw new Error(String(d&&d.message||'営業日カレンダーを取得できません。'));
  const type=String(d.businessType||'').trim();if(!Object.prototype.hasOwnProperty.call(AUTO21.PROD,type))throw new Error('未対応の営業区分: '+type);
  return{businessType:type,isClosed:Boolean(d.isClosed)||type==='休館',operationalDate:String(d.operationalDate||jstDate_(now)),closingTime:String(d.closingTime||(type==='土日祝日'?'18:00':'17:00'))};
}

function withinBusinessHours_(day,ctl,now){
  const open=bool_(ctl.testMode)?clockMin_('08:00'):clockMin_('09:30'),close=clockMin_(day.closingTime||'18:00'),m=jstMinutes_(now);return m>=open&&m<close;
}
function activeIds_(type,ctl){return bool_(ctl.testMode)?[String(ctl.testWaitTypeId||'0042')]:(AUTO21.PROD[type]||[]).slice()}
function schedule_(ctl){const x=Object.assign({},AUTO21.SCHEDULE),raw=String(ctl.slotScheduleJson||'').trim();if(raw){try{const c=JSON.parse(raw);Object.keys(c||{}).forEach(k=>{if(/^\d{4}$/.test(k)&&/^\d{2}:\d{2}$/.test(String(c[k])))x[k]=String(c[k])})}catch(_){}}return x}
function slotStarted_(id,s,now){return /^\d{2}:\d{2}$/.test(String(s[id]||''))&&jstMinutes_(now)>=clockMin_(s[id])}
function rowsFor_(rows,id){return rows.filter(r=>String(r&&r.waitTypeId||'')===String(id))}
function callingRows_(rows){return rows.filter(isCalling_)}
function waitingRows_(rows){return rows.filter(r=>String(r&&r.status||'')==='0'&&!callingFlag_(r&&r.isCalling)).sort((a,b)=>receiptNumber_(a)-receiptNumber_(b))}
function isCalling_(r){return callingFlag_(r&&r.isCalling)&&String(r&&r.status||'')!=='1'}
function callingFlag_(v){return v===true||v===1||v==='1'||String(v).toLowerCase()==='true'}
function receipt_(r){return String(r&&(r.number!=null?r.number:r.receiptNo)||'').normalize('NFKC').replace(/\D/g,'')}
function receiptNumber_(r){const n=Number(receipt_(r));return Number.isFinite(n)?n:Number.MAX_SAFE_INTEGER}
function reserveId_(r){for(const v of [r&&r.reserveId,r&&r.reserveID,r&&r.reservationId,r&&r.reservationID]){const x=normalizeReserveId_(v);if(x)return x}return''}
function normalizeReserveId_(v){const d=String(v==null?'':v).normalize('NFKC').replace(/\D/g,'');return!d||d.length>12?'':d.padStart(12,'0')}

function doPost(e){
  try{const p=Object.assign({},e&&e.parameter||{}),rid=normalizeReserveId_(p.reserveId),no=String(p.receiptNo||'').normalize('NFKC').replace(/\D/g,''),id=String(p.waitTypeId||'').trim();if(!rid||!no||!/^\d{4}$/.test(id))return out_({ok:false,error:'VALIDATION_ERROR'});const ss=autoSpreadsheet_();upsertMap_(ss,{receivedAt:new Date(),receiptNo:no,reserveId:rid,waitTypeId:id,waitTypeName:String(p.waitTypeName||''),operationalDay:String(p.operationalDay||''),source:String(p.source||''),adults:String(p.adults||''),paidChildren:String(p.paidChildren||''),infants:String(p.infants||''),totalPeople:String(p.totalPeople||'')});return out_({ok:true})}catch(e2){return out_({ok:false,error:String(e2.message||e2)})}
}
function doGet(e){const a=String(e&&e.parameter&&e.parameter.action||'health');if(a==='health')return out_({ok:true,service:'ASOBooN AirWAIT AUTO',version:AUTO21.VERSION,periodicAirwaitApi:'lastUpdate-only'});if(a==='status'){try{const c=readControl_(autoSpreadsheet_());return out_({ok:true,version:AUTO21.VERSION,autoEnabled:bool_(c.autoEnabled),testMode:bool_(c.testMode),targetCalling:Number(c.targetCalling||10)})}catch(err){return out_({ok:false,error:String(err.message||err)})}}return out_({ok:false,error:'UNKNOWN_ACTION'})}

function autoSpreadsheet_(){const id=PropertiesService.getScriptProperties().getProperty(AUTO21.SS_PROP);if(!id)throw new Error('AUTO管理スプレッドシート未登録です。先に setupAutoV21 を実行してください。');return SpreadsheetApp.openById(id)}
function ensureControl_(ss){let sh=ss.getSheetByName(AUTO21.CONTROL);if(!sh)sh=ss.insertSheet(AUTO21.CONTROL);const defs=[['systemVersion',AUTO21.VERSION],['autoEnabled','FALSE'],['targetCalling','10'],['testMode','TRUE'],['testWaitTypeId','0042'],['callingMethodType','00'],['calendarApiUrl',AUTO21.CALENDAR_API],['slotScheduleJson',JSON.stringify(AUTO21.SCHEDULE)]],have={};if(sh.getLastRow()>0)sh.getRange(1,1,sh.getLastRow(),2).getDisplayValues().forEach(r=>{const k=String(r[0]||'').trim();if(k)have[k]=1});const add=defs.filter(r=>!have[r[0]]);if(add.length)sh.getRange(sh.getLastRow()+1,1,add.length,2).setValues(add);return sh}
function ensureMap_(ss){let sh=ss.getSheetByName(AUTO21.MAP);if(!sh)sh=ss.insertSheet(AUTO21.MAP);const h=['receivedAt','receiptNo','reserveId','waitTypeId','waitTypeName','operationalDay','source','adults','paidChildren','infants','totalPeople','updatedAt'];if(sh.getLastRow()===0)sh.getRange(1,1,1,h.length).setValues([h]);sh.getRange('B:D').setNumberFormat('@');return sh}
function ensureLog_(ss){let sh=ss.getSheetByName(AUTO21.LOG);if(!sh)sh=ss.insertSheet(AUTO21.LOG);const h=['at','event','waitTypeId','receiptNo','reserveId','detail'];if(sh.getLastRow()===0)sh.getRange(1,1,1,h.length).setValues([h]);sh.getRange('C:E').setNumberFormat('@');return sh}
function readControl_(ss){const sh=ensureControl_(ss),out={};if(sh.getLastRow())sh.getRange(1,1,sh.getLastRow(),2).getDisplayValues().forEach(r=>{const k=String(r[0]||'').trim();if(k)out[k]=r[1]});return out}
function upsertMap_(ss,x){const sh=ensureMap_(ss),last=sh.getLastRow();let rowNo=0;if(last>=2){const v=sh.getRange(2,2,last-1,3).getDisplayValues();for(let i=v.length-1;i>=0;i--)if(String(v[i][0])===x.receiptNo&&String(v[i][2])===x.waitTypeId){rowNo=i+2;break}}const row=[x.receivedAt,x.receiptNo,x.reserveId,x.waitTypeId,x.waitTypeName,x.operationalDay,x.source,x.adults,x.paidChildren,x.infants,x.totalPeople,new Date()];sh.getRange(rowNo||last+1,1,1,row.length).setValues([row])}
function mappedReserveId_(ss,no,id){const sh=ensureMap_(ss),last=sh.getLastRow();if(last<2)return'';const v=sh.getRange(2,2,last-1,3).getDisplayValues();for(let i=v.length-1;i>=0;i--)if(String(v[i][0])===String(no)&&String(v[i][2])===String(id))return normalizeReserveId_(v[i][1]);return''}
function log_(ss,event,id,no,rid,detail){if(!ss)return;ensureLog_(ss).appendRow([new Date(),String(event||''),String(id||''),String(no||''),String(rid||''),String(detail||'')])}
function apiKey_(){const k=PropertiesService.getScriptProperties().getProperty(AUTO21.KEY_PROP);if(!k)throw new Error('Script Properties に AIRWAIT_API_KEY がありません。');return k}
function updateMarker_(p){const pref=['lastUpdDate','lastUpdate','lastUpdateDate','lastUpdatedAt','updateDate','updatedAt','lastUpdDateStateless'],seen=[];function walk(v,d){if(!v||typeof v!=='object'||d>5||seen.indexOf(v)>=0)return'';seen.push(v);for(const k of pref)if(v[k]!=null&&String(v[k]).trim())return String(v[k]).trim();for(const k of Object.keys(v))if(/last.*upd|update.*date|updated/i.test(k)&&v[k]!=null&&typeof v[k]!=='object'&&String(v[k]).trim())return String(v[k]).trim();for(const k of Object.keys(v)){const x=walk(v[k],d+1);if(x)return x}return''}return walk(p,0)}
function apiOk_(d){return d&&(d.success===true||String(d.resultCode&&d.resultCode.code||'')==='0000')}
function apiMessage_(d,f){return String(d&&d.resultCode&&d.resultCode.defaultMessage||f)}
function jsonParse_(t,l){try{return JSON.parse(t)}catch(_){throw new Error(l+' JSON parse error')}}
function bool_(v){return v===true||v===1||v==='1'||String(v||'').toUpperCase()==='TRUE'}
function stateKey_(k,d,id){return'AUTO21_'+k+'_'+d+'_'+id}
function clockMin_(t){const m=String(t||'').match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):0}
function jstDate_(d){return Utilities.formatDate(d,AUTO21.TZ,'yyyy-MM-dd')}
function jstMinutes_(d){return Number(Utilities.formatDate(d,AUTO21.TZ,'H'))*60+Number(Utilities.formatDate(d,AUTO21.TZ,'m'))}
function out_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function removeAutoTriggers_(){ScriptApp.getProjectTriggers().forEach(t=>{if(['autoWorkerV21','autoWorker','autoWorkerV20'].indexOf(t.getHandlerFunction())>=0)ScriptApp.deleteTrigger(t)})}
function resetAutoV21State(){const p=PropertiesService.getScriptProperties();p.getKeys().filter(k=>/^AUTO21_/.test(k)&&k!==AUTO21.SS_PROP).forEach(k=>p.deleteProperty(k));console.log('AUTO v21 runtime state reset. AIRWAIT_API_KEY / spreadsheet binding は保持しました。')}
function testAutoV21Health(){const ss=autoSpreadsheet_(),ctl=readControl_(ss),day=businessDay_(new Date(),ctl);console.log(JSON.stringify({version:AUTO21.VERSION,spreadsheet:ss.getName(),control:ctl,businessDay:day,lastUpdate:lastUpdate_()},null,2))}
