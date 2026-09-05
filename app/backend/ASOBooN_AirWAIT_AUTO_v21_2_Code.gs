/**
 * ASOBooN AirWAIT AUTO v21.3.0
 * AirWAIT担当部署回答準拠 / LINE呼出通知対応
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
 *
 * 【LINE通知】
 * ミニアプリからLINEアクセストークンを一時受信し、LINE APIで検証してuserIdだけ保存。
 * アクセストークンはスプレッドシート・ログ・Script Propertiesへ保存しない。
 * AirWAIT呼出成功後にだけMessaging APIで1回通知する。
 * LINE通知失敗はAirWAIT呼出を失敗扱いにしない。
 */
const A21=Object.freeze({
  VERSION:'21.3.0',TZ:'Asia/Tokyo',ORIGIN:'https://asoboon.github.io',STORE_ID:'KR01205179',
  KEY_PROP:'AIRWAIT_API_KEY',SS_PROP:'AUTO21_SPREADSHEET_ID',
  LINE_TOKEN_PROP:'LINE_CHANNEL_ACCESS_TOKEN',LINE_LOGIN_CHANNEL_ID:'2009888671',
  CONTROL:'CONTROL',MAP:'RESERVE_MAP',LOG:'CALL_LOG',
  CALENDAR:'https://script.google.com/macros/s/AKfycbwxuGMi8rxbD9RkNPSLc3VE6w2F3xcUQh8TS8UpMRAIiCCN5wUhUG05smSkMZFZ_1OVNw/exec',
  LAST:'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless',
  RES:'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  CALL:'https://cl.airwait.jp/WCLP/api/20160600/external/stateless/reserve/call',
  LINE_VERIFY:'https://api.line.me/oauth2/v2.1/verify',
  LINE_PROFILE:'https://api.line.me/v2/profile',
  LINE_PUSH:'https://api.line.me/v2/bot/message/push',
  CALLSTATUS_LIFF:'https://miniapp.line.me/2009888671-57TOefc3/callstatus.html',
  SCHEDULE:Object.freeze({'0042':'08:00','0023':'09:30','0025':'14:00','0035':'10:15','0037':'13:45','0029':'10:25','0031':'12:50','0033':'15:15'}),
  PROD:Object.freeze({'平日':Object.freeze(['0023','0025']),'平日特定日':Object.freeze(['0035','0037']),'土日祝日':Object.freeze(['0029','0031','0033']),'休館':Object.freeze([])}),
  MAP_HEADERS:Object.freeze(['receivedAt','receiptNo','reserveId','waitTypeId','waitTypeName','operationalDay','source','adults','paidChildren','infants','totalPeople','updatedAt','lineUserId','lineLinkedAt','lineNotifiedAt','lineNotifyStatus'])
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
  console.log('AUTO v21.3.0 setup complete: '+ss.getName()+' / '+ss.getId());
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
    notifyCallingRows_(ss,rows,due);
    due.forEach(id=>updatedSlot_(ss,rows,id,ctl,now));
    props.setProperty('AUTO21_LAST_UPDATE',marker);
  }catch(e){try{log_(book_(),'WORKER_ERROR','','','',String(e.message||e))}catch(_){}console.error(e)}finally{try{lock.releaseLock()}catch(_){}}
}

function initialStarts_(ss,due,ctl,now){
  const p=PropertiesService.getScriptProperties(),date=jstDate_(now);
  const need=due.filter(id=>p.getProperty(key_('START',date,id))!=='1'&&p.getProperty(key_('START_ATTEMPT',date,id))!=='1');
  if(!need.length)return;
  need.forEach(id=>p.setProperty(key_('START_ATTEMPT',date,id),'1'));
  let rows;
  try{rows=allReservations_()}
  catch(e){need.forEach(id=>log_(ss,'INITIAL_RESERVATIONS_ERROR',id,'','',String(e.message||e)+' / 自動再試行なし'));return}
  notifyCallingRows_(ss,rows,due);
  need.forEach(id=>{
    const r=fill_(ss,forType_(rows,id),id,ctl,'INITIAL_AT_START');
    p.setProperty(key_('START',date,id),'1');p.setProperty(key_('COUNT',date,id),String(r.after));
    if(r.called>0||r.after>0)p.setProperty(key_('PRIMED',date,id),'1');
  });
}

function retryInitialSlotV21(waitTypeId){
  const id=String(waitTypeId||'').trim();if(!/^\d{4}$/.test(id))throw new Error('waitTypeId は4桁で指定してください。');
  const p=PropertiesService.getScriptProperties(),date=jstDate_(new Date());
  p.deleteProperty(key_('START_ATTEMPT',date,id));p.deleteProperty(key_('START',date,id));
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
    try{
      call_(rid,String(ctl.callingMethodType||'00'));
      called++;log_(ss,'CALLED',id,no,rid,reason);
      try{notifyLineForCall_(ss,no,id,rid)}catch(lineErr){log_(ss,'LINE_NOTIFY_ERROR',id,no,rid,String(lineErr.message||lineErr))}
      Utilities.sleep(1200);
    }catch(e){log_(ss,'CALL_ERROR',id,no,rid,String(e.message||e));break}
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
  try{const cached=JSON.parse(props.getProperty(cacheKey)||'null');if(cached&&cached.apiUrl===apiUrl&&Date.now()-Number(cached.savedAt||0)<ttlMin*60000){const day=cached.day,type=String(day&&day.businessType||'');if(day&&Object.prototype.hasOwnProperty.call(A21.PROD,type))return day}}catch(_){}
  const u=apiUrl+'?action=current&date='+encodeURIComponent(date);
  const r=UrlFetchApp.fetch(u,{method:'get',muteHttpExceptions:true,followRedirects:true});if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('営業カレンダー HTTP '+r.getResponseCode());
  const d=parse_(r.getContentText(),'calendar');if(!d||d.ok!==true)throw new Error(String(d&&d.message||'営業カレンダーを取得できません。'));
  const type=String(d.businessType||'').trim();if(!Object.prototype.hasOwnProperty.call(A21.PROD,type))throw new Error('未対応の営業区分: '+type);
  const day={businessType:type,isClosed:Boolean(d.isClosed)||type==='休館',operationalDate:String(d.operationalDate||date),closingTime:String(d.closingTime||(type==='土日祝日'?'18:00':'17:00'))};
  props.setProperty(cacheKey,JSON.stringify({savedAt:Date.now(),apiUrl:apiUrl,day:day}));props.getKeys().filter(k=>/^AUTO21_CALENDAR_/.test(k)&&k!==cacheKey).forEach(k=>props.deleteProperty(k));return day;
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

function doPost(e){
  let requestId='';
  try{
    const p=Object.assign({},e&&e.parameter||{}),rid=normRid_(p.reserveId),no=String(p.receiptNo||'').normalize('NFKC').replace(/\D/g,''),id=String(p.waitTypeId||'').trim();
    requestId=bridgeRequestId_(p.bridgeRequestId);
    if(!rid||!no||!/^\d{4}$/.test(id))throw new Error('VALIDATION_ERROR');
    let lineUserId='',lineError='',lineNotifyReady=false;
    const token=String(p.lineAccessToken||'');
    if(token){try{lineUserId=resolveLineUserId_(token);lineNotifyReady=messagingReachable_(lineUserId)}catch(err){lineError=String(err.message||err)}}
    const saved=upsertMap_(book_(),{receivedAt:new Date(),receiptNo:no,reserveId:rid,waitTypeId:id,waitTypeName:String(p.waitTypeName||''),operationalDay:String(p.operationalDay||''),source:String(p.source||''),adults:String(p.adults||''),paidChildren:String(p.paidChildren||''),infants:String(p.infants||''),totalPeople:String(p.totalPeople||''),lineUserId:lineUserId,lineLinkedAt:lineUserId?new Date():'',lineNotifyStatus:lineUserId?(lineNotifyReady?'READY':'LINKED_NOT_REACHABLE'):''});
    const linked=Boolean(saved&&saved.lineUserId);
    if(linked&&!lineNotifyReady&&String(saved.lineNotifyStatus||'')==='READY')lineNotifyReady=true;
    const status={ok:true,stored:true,lineLinked:Boolean(linked&&lineNotifyReady),lineIdentityLinked:linked,lineNotifyReady:lineNotifyReady,lineError:lineError?safeLineError_(lineError):''};
    cacheBridgeStatus_(requestId,status);
    return out_(status);
  }catch(err){const status={ok:false,stored:false,lineLinked:false,error:String(err.message||err)};cacheBridgeStatus_(requestId,status);return out_(status)}
}

function doGet(e){
  const p=e&&e.parameter||{},a=String(p.action||'health'),cb=String(p.callback||'');let result;
  if(a==='health')result={ok:true,service:'ASOBooN AirWAIT AUTO',version:A21.VERSION,periodicAirwaitApi:'lastUpdate-only',lineTokenConfigured:lineTokenConfigured_()};
  else if(a==='status')try{const c=control_(book_());result={ok:true,version:A21.VERSION,autoEnabled:bool_(c.autoEnabled),testMode:bool_(c.testMode),targetCalling:Number(c.targetCalling||10),lineTokenConfigured:lineTokenConfigured_()}}catch(err){result={ok:false,error:String(err.message||err)}}
  else if(a==='bridgeStatus')result=readBridgeStatus_(bridgeRequestId_(p.requestId));
  else result={ok:false,error:'UNKNOWN_ACTION'};
  return out_(result,cb);
}

function resolveLineUserId_(accessToken){
  const token=String(accessToken||'').trim();if(!token)throw new Error('LINE_TOKEN_EMPTY');
  const vr=UrlFetchApp.fetch(A21.LINE_VERIFY+'?access_token='+encodeURIComponent(token),{method:'get',muteHttpExceptions:true,followRedirects:true});
  if(vr.getResponseCode()!==200)throw new Error('LINE_TOKEN_VERIFY_HTTP_'+vr.getResponseCode());
  const vd=parse_(vr.getContentText(),'line token verify');
  if(String(vd.client_id||'')!==A21.LINE_LOGIN_CHANNEL_ID)throw new Error('LINE_CHANNEL_MISMATCH');
  if(Number(vd.expires_in||0)<=0)throw new Error('LINE_TOKEN_EXPIRED');
  const pr=UrlFetchApp.fetch(A21.LINE_PROFILE,{method:'get',headers:{Authorization:'Bearer '+token},muteHttpExceptions:true,followRedirects:true});
  if(pr.getResponseCode()!==200)throw new Error('LINE_PROFILE_HTTP_'+pr.getResponseCode());
  const pd=parse_(pr.getContentText(),'line profile'),uid=String(pd.userId||'').trim();
  if(!/^U[0-9a-f]{32}$/i.test(uid))throw new Error('LINE_USER_ID_INVALID');
  return uid;
}

function messagingReachable_(userId){
  const uid=String(userId||'').trim(),token=lineChannelAccessToken_();
  if(!uid||!token)return false;
  const r=UrlFetchApp.fetch('https://api.line.me/v2/bot/profile/'+encodeURIComponent(uid),{method:'get',headers:{Authorization:'Bearer '+token},muteHttpExceptions:true,followRedirects:true});
  return r.getResponseCode()===200;
}

function notifyCallingRows_(ss,rows,ids){
  const allowed=new Set((ids||[]).map(String));
  for(const row of rows||[]){
    const id=String(row&&row.waitTypeId||'');if(!allowed.has(id))continue;
    if(!callFlag_(row&&row.isCalling)||String(row&&row.status||'')==='1')continue;
    const no=receipt_(row);if(!no||!mappedRecord_(ss,no,id))continue;
    const rid=reserveId_(row)||mapped_(ss,no,id);
    try{notifyLineForCall_(ss,no,id,rid)}catch(e){log_(ss,'LINE_NOTIFY_ERROR',id,no,rid,String(e.message||e))}
  }
}

function notifyLineForCall_(ss,no,id,rid){
  const rec=mappedRecord_(ss,no,id);if(!rec){log_(ss,'LINE_NOTIFY_SKIP',id,no,rid,'MAP_NOT_FOUND');return false}
  if(String(rec.lineNotifiedAt||'').trim()){log_(ss,'LINE_NOTIFY_SKIP',id,no,rid,'ALREADY_SENT');return true}
  const uid=String(rec.lineUserId||'').trim();if(!uid){setMapFields_(ss,no,id,{lineNotifyStatus:'SKIP_NO_LINE_USER'});log_(ss,'LINE_NOTIFY_SKIP',id,no,rid,'NO_LINE_USER');return false}
  const token=lineChannelAccessToken_();if(!token){setMapFields_(ss,no,id,{lineNotifyStatus:'SKIP_NO_CHANNEL_TOKEN'});log_(ss,'LINE_NOTIFY_SKIP',id,no,rid,'LINE_CHANNEL_ACCESS_TOKEN未設定');return false}
  const type=String(rec.waitTypeName||'').trim(),text=['🔔 ASOBooNからお呼び出しです！','受付番号 '+String(no)+'番',type?type:'','ご入場いただけます。受付までお越しください。','呼出後30分以内に受付へお越しください。','呼出状況はこちら',A21.CALLSTATUS_LIFF].filter(Boolean).join('\n');
  const body=JSON.stringify({to:uid,messages:[{type:'text',text:text}],notificationDisabled:false});
  const retryKey=Utilities.getUuid();let lastCode=0,lastText='';
  for(let attempt=1;attempt<=2;attempt++){
    const r=UrlFetchApp.fetch(A21.LINE_PUSH,{method:'post',headers:{Authorization:'Bearer '+token,'X-Line-Retry-Key':retryKey},contentType:'application/json; charset=UTF-8',payload:body,muteHttpExceptions:true,followRedirects:true});
    lastCode=r.getResponseCode();lastText=String(r.getContentText()||'');
    if(lastCode>=200&&lastCode<300){setMapFields_(ss,no,id,{lineNotifiedAt:new Date(),lineNotifyStatus:'SENT'});log_(ss,'LINE_NOTIFIED',id,no,rid,'Messaging API accepted');return true}
    if(!(lastCode===429||lastCode>=500))break;
    Utilities.sleep(600);
  }
  setMapFields_(ss,no,id,{lineNotifyStatus:'ERROR_HTTP_'+lastCode});log_(ss,'LINE_NOTIFY_ERROR',id,no,rid,'HTTP '+lastCode+' '+safeApiMessage_(lastText));return false;
}

function lineChannelAccessToken_(){return String(PropertiesService.getScriptProperties().getProperty(A21.LINE_TOKEN_PROP)||'').trim()}
function lineTokenConfigured_(){return Boolean(lineChannelAccessToken_())}
function safeLineError_(s){return String(s||'').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').slice(0,180)}
function safeApiMessage_(text){try{const d=JSON.parse(text);return String(d&&d.message||'').slice(0,180)}catch(_){return String(text||'').slice(0,180)}}
function bridgeRequestId_(v){const s=String(v||'').trim();return/^[A-Za-z0-9_-]{8,100}$/.test(s)?s:''}
function cacheBridgeStatus_(requestId,status){if(!requestId)return;try{CacheService.getScriptCache().put('AUTO21_BRIDGE_'+requestId,JSON.stringify(Object.assign({at:Date.now()},status)),600)}catch(_){}}
function readBridgeStatus_(requestId){if(!requestId)return{ok:false,found:false,error:'REQUEST_ID_INVALID'};try{const raw=CacheService.getScriptCache().get('AUTO21_BRIDGE_'+requestId);if(!raw)return{ok:true,found:false};const d=JSON.parse(raw);return Object.assign({found:true},d)}catch(_){return{ok:false,found:false,error:'BRIDGE_STATUS_ERROR'}}}

function book_(){const id=PropertiesService.getScriptProperties().getProperty(A21.SS_PROP);if(!id)throw new Error('AUTO管理スプレッドシート未登録。先に setupAutoV21 を実行してください。');return SpreadsheetApp.openById(id)}
function ensureControl_(ss){let sh=ss.getSheetByName(A21.CONTROL);if(!sh)sh=ss.insertSheet(A21.CONTROL);const defs=[['systemVersion',A21.VERSION],['autoEnabled','FALSE'],['targetCalling','10'],['testMode','TRUE'],['testWaitTypeId','0042'],['callingMethodType','00'],['calendarApiUrl',A21.CALENDAR],['calendarCacheMinutes','360'],['slotScheduleJson',JSON.stringify(A21.SCHEDULE)]],have={};if(sh.getLastRow())sh.getRange(1,1,sh.getLastRow(),2).getDisplayValues().forEach(r=>{const k=String(r[0]||'').trim();if(k)have[k]=1});const add=defs.filter(r=>!have[r[0]]);if(add.length)sh.getRange(sh.getLastRow()+1,1,add.length,2).setValues(add);return sh}
function setControl_(ss,k,v){const sh=ensureControl_(ss),last=sh.getLastRow();if(last){const keys=sh.getRange(1,1,last,1).getDisplayValues().flat();const i=keys.findIndex(x=>String(x).trim()===k);if(i>=0){sh.getRange(i+1,2).setValue(v);return}}sh.appendRow([k,v])}
function ensureMap_(ss){let sh=ss.getSheetByName(A21.MAP);if(!sh)sh=ss.insertSheet(A21.MAP);if(!sh.getLastRow()){sh.getRange(1,1,1,A21.MAP_HEADERS.length).setValues([A21.MAP_HEADERS.slice()])}else{const lastCol=Math.max(1,sh.getLastColumn()),headers=sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(x=>String(x||'').trim());const missing=A21.MAP_HEADERS.filter(h=>headers.indexOf(h)<0);if(missing.length)sh.getRange(1,lastCol+1,1,missing.length).setValues([missing])}const hm=headerMap_(sh);['receiptNo','reserveId','waitTypeId','lineUserId'].forEach(k=>{if(hm[k])sh.getRange(2,hm[k],Math.max(1,sh.getMaxRows()-1),1).setNumberFormat('@')});return sh}
function ensureLog_(ss){let sh=ss.getSheetByName(A21.LOG);if(!sh)sh=ss.insertSheet(A21.LOG);const h=['at','event','waitTypeId','receiptNo','reserveId','detail'];if(!sh.getLastRow())sh.getRange(1,1,1,h.length).setValues([h]);sh.getRange('C:E').setNumberFormat('@');return sh}
function control_(ss){const sh=ensureControl_(ss),o={};if(sh.getLastRow())sh.getRange(1,1,sh.getLastRow(),2).getDisplayValues().forEach(r=>{const k=String(r[0]||'').trim();if(k)o[k]=r[1]});return o}
function headerMap_(sh){const headers=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getDisplayValues()[0],m={};headers.forEach((h,i)=>{const k=String(h||'').trim();if(k)m[k]=i+1});return m}
function rowObject_(sh,row,hm){const vals=sh.getRange(row,1,1,sh.getLastColumn()).getDisplayValues()[0],o={};Object.keys(hm).forEach(k=>o[k]=vals[hm[k]-1]);o._row=row;return o}
function findMapRow_(sh,no,id){const hm=headerMap_(sh),last=sh.getLastRow();if(last<2||!hm.receiptNo||!hm.waitTypeId)return null;const values=sh.getRange(2,1,last-1,sh.getLastColumn()).getDisplayValues();for(let i=values.length-1;i>=0;i--){if(String(values[i][hm.receiptNo-1])===String(no)&&String(values[i][hm.waitTypeId-1])===String(id))return i+2}return null}
function upsertMap_(ss,x){const sh=ensureMap_(ss),hm=headerMap_(sh),row=findMapRow_(sh,x.receiptNo,x.waitTypeId)||sh.getLastRow()+1,existing=row<=sh.getLastRow()?rowObject_(sh,row,hm):{};const data={receivedAt:x.receivedAt||existing.receivedAt||new Date(),receiptNo:x.receiptNo,reserveId:x.reserveId,waitTypeId:x.waitTypeId,waitTypeName:x.waitTypeName||existing.waitTypeName||'',operationalDay:x.operationalDay||existing.operationalDay||'',source:x.source||existing.source||'',adults:x.adults||existing.adults||'',paidChildren:x.paidChildren||existing.paidChildren||'',infants:x.infants||existing.infants||'',totalPeople:x.totalPeople||existing.totalPeople||'',updatedAt:new Date(),lineUserId:x.lineUserId||existing.lineUserId||'',lineLinkedAt:x.lineUserId?(x.lineLinkedAt||new Date()):(existing.lineLinkedAt||''),lineNotifiedAt:existing.lineNotifiedAt||'',lineNotifyStatus:existing.lineNotifiedAt?(existing.lineNotifyStatus||'SENT'):(x.lineNotifyStatus||existing.lineNotifyStatus||'')};Object.keys(data).forEach(k=>{if(hm[k])sh.getRange(row,hm[k]).setValue(data[k])});return rowObject_(sh,row,hm)}
function mappedRecord_(ss,no,id){const sh=ensureMap_(ss),row=findMapRow_(sh,no,id);return row?rowObject_(sh,row,headerMap_(sh)):null}
function mapped_(ss,no,id){const r=mappedRecord_(ss,no,id);return r?normRid_(r.reserveId):''}
function setMapFields_(ss,no,id,fields){const sh=ensureMap_(ss),row=findMapRow_(sh,no,id);if(!row)return false;const hm=headerMap_(sh);Object.keys(fields||{}).forEach(k=>{if(hm[k])sh.getRange(row,hm[k]).setValue(fields[k])});if(hm.updatedAt)sh.getRange(row,hm.updatedAt).setValue(new Date());return true}
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
function out_(o,callback){const json=JSON.stringify(o),cb=String(callback||'');if(cb&&/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb))return ContentService.createTextOutput(cb+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON)}
function removeTriggers_(){ScriptApp.getProjectTriggers().forEach(t=>{if(['autoWorkerV21','autoWorker','autoWorkerV20'].includes(t.getHandlerFunction()))ScriptApp.deleteTrigger(t)})}
function resetRuntime_(){const p=PropertiesService.getScriptProperties();p.getKeys().filter(k=>/^AUTO21_/.test(k)&&k!==A21.SS_PROP).forEach(k=>p.deleteProperty(k))}
function resetAutoV21State(){resetRuntime_();console.log('AUTO v21 runtime state reset. AIRWAIT_API_KEY / spreadsheet binding は保持。')}
function testAutoV21Health(){const ss=book_(),ctl=control_(ss),day=businessDay_(new Date(),ctl);console.log(JSON.stringify({version:A21.VERSION,spreadsheet:ss.getName(),control:ctl,businessDay:day,lastUpdate:lastUpdate_(),lineTokenConfigured:lineTokenConfigured_()},null,2))}
function testLineMessagingConfigV21(){const token=lineChannelAccessToken_();if(!token)throw new Error('Script Properties に LINE_CHANNEL_ACCESS_TOKEN がありません。');const r=UrlFetchApp.fetch('https://api.line.me/v2/bot/info',{method:'get',headers:{Authorization:'Bearer '+token},muteHttpExceptions:true});console.log(JSON.stringify({http:r.getResponseCode(),ok:r.getResponseCode()===200,body:safeApiMessage_(r.getContentText())},null,2))}
