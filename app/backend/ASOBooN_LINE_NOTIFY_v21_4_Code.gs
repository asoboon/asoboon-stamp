/**
 * ASOBooN LINE 呼出通知 v21.4.0
 *
 * 目的:
 * - AirWAITの「呼出」とLINE通知を分離する。
 * - Chrome拡張・手動・将来のAPI自動呼出、どの方法で呼んでも通知する。
 * - autoEnabled / testMode には依存しない。
 * - 定期実行は最終更新日時APIだけ。更新時だけ受付一覧を取得する。
 * - LINEアクセストークンは検証にだけ使い、保存しない。
 *
 * 導入:
 * 1) ASOBooN_AUTO_v20 スプレッドシートに紐づくApps Scriptへこのコードを入れる。
 * 2) Script Properties に AIRWAIT_API_KEY / LINE_CHANNEL_ACCESS_TOKEN を設定する。
 * 3) setupLineNotifyV214() を1回実行する。
 * 4) 既存Web Appデプロイを「新しいバージョン」で更新する（URLは維持）。
 *
 * 注意:
 * - このコードはAirWAITの呼出APIを実行しない。
 * - 既存の自動呼出設定 autoEnabled / testMode は変更しない。
 */
const LN214=Object.freeze({
  VERSION:'21.4.0',
  TZ:'Asia/Tokyo',
  ORIGIN:'https://asoboon.github.io',
  STORE_ID:'KR01205179',
  AIRWAIT_KEY_PROP:'AIRWAIT_API_KEY',
  LINE_TOKEN_PROP:'LINE_CHANNEL_ACCESS_TOKEN',
  SS_PROP:'LINE_NOTIFY_SPREADSHEET_ID',
  MAP:'RESERVE_MAP',
  CONTROL:'CONTROL',
  LOG:'CALL_LOG',
  LAST:'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless',
  RES:'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  LINE_VERIFY:'https://api.line.me/oauth2/v2.1/verify',
  LINE_PROFILE:'https://api.line.me/v2/profile',
  LINE_PUSH:'https://api.line.me/v2/bot/message/push',
  LINE_BOT_PROFILE:'https://api.line.me/v2/bot/profile/',
  LINE_LOGIN_CHANNEL_ID:'2009888671',
  CALLSTATUS_LIFF:'https://miniapp.line.me/2009888671-57TOefc3/callstatus.html',
  REQUIRED_HEADERS:Object.freeze([
    'receivedAt','businessDate','waitTypeId','waitTypeName','receiptNo','reserveId',
    'bridgeStatus','calledAt','lastSeenStatus','retryCount','lastError','updatedAt',
    'lineUserId','lineLinkedAt','lineNotifiedAt','lineNotifyStatus'
  ])
});

function setupLineNotifyV214(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('ASOBooN_AUTO_v20 スプレッドシートからApps Scriptを開いて実行してください。');
  const props=PropertiesService.getScriptProperties();
  props.setProperty(LN214.SS_PROP,ss.getId());
  ensureLineMap_(ss);
  ensureLineControl_(ss);
  ensureLineLog_(ss);
  setControlValue_(ss,'lineNotifyEnabled','TRUE','LINE呼出通知監視。自動呼出autoEnabledとは独立して常時有効');
  setControlValue_(ss,'lineNotifyVersion',LN214.VERSION,'LINE通知専用監視バージョン');
  props.deleteProperty('LN214_LAST_UPDATE');
  removeLineNotifyTriggers_();
  ScriptApp.newTrigger('lineNotifyWorkerV214').timeBased().everyMinutes(1).create();
  logLine_(ss,'INFO','SETUP','','','LINE_NOTIFY_READY','v'+LN214.VERSION,0);
  console.log('LINE Notify v'+LN214.VERSION+' setup complete / '+ss.getName());
}

function lineNotifyWorkerV214(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return;
  const started=Date.now();
  try{
    const ss=lineBook_();
    const ctl=lineControl_(ss);
    if(!boolLine_(ctl.lineNotifyEnabled,true))return;

    let marker;
    try{marker=lineLastUpdate_()}
    catch(e){logLine_(ss,'ERROR','LAST_UPDATE','','','ERROR',String(e.message||e),Date.now()-started);return}

    const props=PropertiesService.getScriptProperties();
    const prev=props.getProperty('LN214_LAST_UPDATE')||'';
    if(prev&&marker===prev)return;

    let rows;
    try{rows=lineAllReservations_()}
    catch(e){logLine_(ss,'ERROR','RESERVATIONS','','','ERROR',String(e.message||e),Date.now()-started);return}

    notifyMappedCallingRowsV214_(ss,rows);
    props.setProperty('LN214_LAST_UPDATE',marker);
  }catch(e){
    try{logLine_(lineBook_(),'ERROR','WORKER','','','ERROR',String(e.message||e),Date.now()-started)}catch(_){}
    console.error(e);
  }finally{
    try{lock.releaseLock()}catch(_){}
  }
}

function doPost(e){
  let requestId='';
  try{
    const p=Object.assign({},e&&e.parameter||{});
    requestId=bridgeRequestIdV214_(p.bridgeRequestId);
    const receiptNo=digits_(p.receiptNo);
    const reserveId=normalizeReserveIdV214_(p.reserveId);
    const waitTypeId=String(p.waitTypeId||'').trim();
    if(!receiptNo||!reserveId||!/^\d{4}$/.test(waitTypeId))throw new Error('VALIDATION_ERROR');

    const token=String(p.lineAccessToken||'').trim();
    if(!token)throw new Error('LINE_TOKEN_REQUIRED');

    const ss=lineBook_();
    const lineUserId=resolveLineUserIdV214_(token);
    if(!lineUserId)throw new Error('LINE_USER_ID_EMPTY');

    const reachable=messagingReachableV214_(lineUserId);
    if(!reachable){
      const saved=upsertLineMap_(ss,{
        receiptNo,reserveId,waitTypeId,
        waitTypeName:String(p.waitTypeName||''),
        businessDate:String(p.operationalDay||p.businessDate||''),
        lineUserId,
        lineNotifyStatus:'LINKED_NOT_REACHABLE',
        bridgeStatus:'LINE_LINK_FAILED'
      });
      const status={ok:true,stored:true,lineLinked:false,lineIdentityLinked:true,lineNotifyReady:false,error:'LINE_OFFICIAL_ACCOUNT_NOT_REACHABLE'};
      cacheBridgeV214_(requestId,status);
      logLine_(ss,'WARN','LINE_LINK',waitTypeId,receiptNo,'NOT_REACHABLE','公式LINEの友だち状態/Provider/トークンを確認',0);
      return outV214_(status);
    }

    const saved=upsertLineMap_(ss,{
      receiptNo,reserveId,waitTypeId,
      waitTypeName:String(p.waitTypeName||''),
      businessDate:String(p.operationalDay||p.businessDate||''),
      lineUserId,
      lineNotifyStatus:'READY',
      bridgeStatus:'LINE_LINKED'
    });

    let testPushSent=false;
    const source=String(p.source||'');
    if(/staff-line-link/i.test(source)){
      const text=[
        '✅ ASOBooN LINE呼出通知 接続確認',
        '受付番号 '+receiptNo+'番',
        '呼出時にもこのトークへ通知します。'
      ].join('\n');
      testPushSent=sendLinePushV214_(lineUserId,text,'LINK_TEST_'+reserveId);
      if(testPushSent){
        setLineMapFields_(ss,receiptNo,waitTypeId,{lineNotifyStatus:'READY_TEST_SENT'});
        logLine_(ss,'INFO','LINE_LINK_TEST',waitTypeId,receiptNo,'SENT','接続確認メッセージ送信',0);
      }else{
        setLineMapFields_(ss,receiptNo,waitTypeId,{lineNotifyStatus:'LINK_TEST_FAILED',lastError:'接続確認メッセージ送信失敗'});
      }
    }

    const lineLinked=source.match(/staff-line-link/i)?testPushSent:true;
    const status={
      ok:lineLinked,
      stored:true,
      lineLinked,
      lineIdentityLinked:true,
      lineNotifyReady:true,
      testPushSent,
      error:lineLinked?'':'LINE_TEST_PUSH_FAILED'
    };
    cacheBridgeV214_(requestId,status);
    return outV214_(status);
  }catch(err){
    const status={ok:false,stored:false,lineLinked:false,lineIdentityLinked:false,error:String(err.message||err)};
    cacheBridgeV214_(requestId,status);
    return outV214_(status);
  }
}

function doGet(e){
  const p=e&&e.parameter||{};
  const action=String(p.action||'health');
  const callback=String(p.callback||'');
  let result;
  if(action==='bridgeStatus')result=readBridgeV214_(bridgeRequestIdV214_(p.requestId));
  else if(action==='health')result={ok:true,service:'ASOBooN LINE Notify',version:LN214.VERSION,lineTokenConfigured:lineChannelTokenConfiguredV214_(),watcher:'lastUpdate-only'};
  else if(action==='status'){
    try{
      const ctl=lineControl_(lineBook_());
      result={ok:true,version:LN214.VERSION,lineNotifyEnabled:boolLine_(ctl.lineNotifyEnabled,true),lineTokenConfigured:lineChannelTokenConfiguredV214_()};
    }catch(err){result={ok:false,error:String(err.message||err)}}
  }else result={ok:false,error:'UNKNOWN_ACTION'};
  return outV214_(result,callback);
}

function notifyMappedCallingRowsV214_(ss,rows){
  for(const row of rows||[]){
    if(!callFlagV214_(row&&row.isCalling)||String(row&&row.status||'')==='1')continue;
    const waitTypeId=String(row&&row.waitTypeId||'').trim();
    const receiptNo=receiptV214_(row);
    if(!receiptNo||!waitTypeId)continue;
    const rec=findLineMapRecord_(ss,receiptNo,waitTypeId,jstDateV214_(new Date()));
    if(!rec)continue;
    if(String(rec.lineNotifiedAt||'').trim())continue;
    if(!String(rec.lineUserId||'').trim()){
      setLineMapFields_(ss,receiptNo,waitTypeId,{lineNotifyStatus:'SKIP_NO_LINE_USER'});
      continue;
    }
    const reserveId=reserveIdV214_(row)||normalizeReserveIdV214_(rec.reserveId);
    try{
      const sent=notifyLineForCallV214_(ss,rec,receiptNo,waitTypeId,reserveId);
      if(sent)logLine_(ss,'INFO','LINE_CALL_NOTIFY',waitTypeId,receiptNo,'SENT','AirWAIT呼出中を検知',0);
    }catch(e){
      setLineMapFields_(ss,receiptNo,waitTypeId,{lineNotifyStatus:'ERROR',lastError:String(e.message||e)});
      logLine_(ss,'ERROR','LINE_CALL_NOTIFY',waitTypeId,receiptNo,'ERROR',String(e.message||e),0);
    }
  }
}

function notifyLineForCallV214_(ss,rec,receiptNo,waitTypeId,reserveId){
  const uid=String(rec.lineUserId||'').trim();
  if(!uid)return false;
  if(String(rec.lineNotifiedAt||'').trim())return true;
  const type=String(rec.waitTypeName||'').trim();
  const text=[
    '🔔 ASOBooNからお呼び出しです！',
    '受付番号 '+receiptNo+'番',
    type,
    'ご入場いただけます。受付までお越しください。',
    '呼出後30分以内に受付へお越しください。',
    '呼出状況はこちら',
    LN214.CALLSTATUS_LIFF
  ].filter(Boolean).join('\n');
  const sent=sendLinePushV214_(uid,text,'CALL_'+(reserveId||receiptNo+'_'+waitTypeId));
  if(sent){
    setLineMapFields_(ss,receiptNo,waitTypeId,{calledAt:new Date(),lastSeenStatus:'CALLING',lineNotifiedAt:new Date(),lineNotifyStatus:'SENT',bridgeStatus:'CALLED_AND_NOTIFIED',lastError:''});
    return true;
  }
  setLineMapFields_(ss,receiptNo,waitTypeId,{lineNotifyStatus:'SEND_FAILED',lastError:'Messaging API送信失敗'});
  return false;
}

function sendLinePushV214_(userId,text,retrySeed){
  const token=lineChannelTokenV214_();
  if(!token)throw new Error('LINE_CHANNEL_ACCESS_TOKEN_NOT_CONFIGURED');
  const retryKey=uuidForRetry_(retrySeed);
  const body=JSON.stringify({to:String(userId),messages:[{type:'text',text:String(text)}],notificationDisabled:false});
  let lastCode=0,lastText='';
  for(let attempt=1;attempt<=2;attempt++){
    const r=UrlFetchApp.fetch(LN214.LINE_PUSH,{method:'post',headers:{Authorization:'Bearer '+token,'X-Line-Retry-Key':retryKey},contentType:'application/json; charset=UTF-8',payload:body,muteHttpExceptions:true,followRedirects:true});
    lastCode=r.getResponseCode();lastText=String(r.getContentText()||'');
    if(lastCode>=200&&lastCode<300)return true;
    if(!(lastCode===429||lastCode>=500))break;
    Utilities.sleep(600);
  }
  throw new Error('LINE_PUSH_HTTP_'+lastCode+' '+safeApiMessageV214_(lastText));
}

function resolveLineUserIdV214_(accessToken){
  const token=String(accessToken||'').trim();
  const vr=UrlFetchApp.fetch(LN214.LINE_VERIFY+'?access_token='+encodeURIComponent(token),{method:'get',muteHttpExceptions:true,followRedirects:true});
  if(vr.getResponseCode()!==200)throw new Error('LINE_TOKEN_VERIFY_HTTP_'+vr.getResponseCode());
  const vd=parseJsonV214_(vr.getContentText(),'LINE verify');
  if(String(vd.client_id||'')!==LN214.LINE_LOGIN_CHANNEL_ID)throw new Error('LINE_CHANNEL_MISMATCH');
  if(Number(vd.expires_in||0)<=0)throw new Error('LINE_TOKEN_EXPIRED');
  const pr=UrlFetchApp.fetch(LN214.LINE_PROFILE,{method:'get',headers:{Authorization:'Bearer '+token},muteHttpExceptions:true,followRedirects:true});
  if(pr.getResponseCode()!==200)throw new Error('LINE_PROFILE_HTTP_'+pr.getResponseCode());
  const pd=parseJsonV214_(pr.getContentText(),'LINE profile');
  const uid=String(pd.userId||'').trim();
  if(!/^U[0-9a-f]{32}$/i.test(uid))throw new Error('LINE_USER_ID_INVALID');
  return uid;
}

function messagingReachableV214_(userId){
  const token=lineChannelTokenV214_();
  if(!token)return false;
  const r=UrlFetchApp.fetch(LN214.LINE_BOT_PROFILE+encodeURIComponent(String(userId)),{method:'get',headers:{Authorization:'Bearer '+token},muteHttpExceptions:true,followRedirects:true});
  return r.getResponseCode()===200;
}

function lineLastUpdate_(){
  const u=LN214.LAST+'?key='+encodeURIComponent(airwaitKeyV214_())+'&storeId='+encodeURIComponent(LN214.STORE_ID);
  const r=UrlFetchApp.fetch(u,{method:'get',headers:{Origin:LN214.ORIGIN},muteHttpExceptions:true,followRedirects:true});
  if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('lastUpdate HTTP '+r.getResponseCode());
  const d=parseJsonV214_(r.getContentText(),'lastUpdate');
  if(!airwaitOkV214_(d))throw new Error(airwaitMessageV214_(d,'lastUpdate API error'));
  const marker=findMarkerV214_(d);
  if(!marker)throw new Error('lastUpdate marker empty');
  return marker;
}

function lineAllReservations_(){
  const out=[];let start=1,total=Infinity,guard=0;
  while(start<=total&&guard++<40){
    const p=lineReservationPage_(start);
    total=p.count||p.rows.length;
    out.push.apply(out,p.rows);
    if(!p.rows.length||start+p.rows.length>total)break;
    start+=p.rows.length;
  }
  return out;
}

function lineReservationPage_(start){
  const u=LN214.RES+'?key='+encodeURIComponent(airwaitKeyV214_());
  const r=UrlFetchApp.fetch(u,{method:'post',headers:{Origin:LN214.ORIGIN},contentType:'application/x-www-form-urlencoded; charset=UTF-8',payload:{storeId:LN214.STORE_ID,sortStatus:'0',isDesc:'0',start:String(start),limit:'100'},muteHttpExceptions:true,followRedirects:true});
  if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('reservations HTTP '+r.getResponseCode());
  const d=parseJsonV214_(r.getContentText(),'reservations');
  if(!airwaitOkV214_(d))throw new Error(airwaitMessageV214_(d,'reservations API error'));
  return{count:Number(d&&d.innerDto&&d.innerDto.count||0),rows:Array.isArray(d&&d.innerDto&&d.innerDto.reservations)?d.innerDto.reservations:[]};
}

function lineBook_(){
  const id=PropertiesService.getScriptProperties().getProperty(LN214.SS_PROP);
  if(id)return SpreadsheetApp.openById(id);
  const active=SpreadsheetApp.getActiveSpreadsheet();
  if(active)return active;
  throw new Error('LINE_NOTIFY_SPREADSHEET_ID未設定。setupLineNotifyV214を実行してください。');
}

function ensureLineMap_(ss){
  let sh=ss.getSheetByName(LN214.MAP);if(!sh)sh=ss.insertSheet(LN214.MAP);
  const lastCol=Math.max(1,sh.getLastColumn());
  let headers=sh.getLastRow()?sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(x=>String(x||'').trim()):[];
  if(!headers.some(Boolean)){
    sh.getRange(1,1,1,LN214.REQUIRED_HEADERS.length).setValues([LN214.REQUIRED_HEADERS.slice()]);
  }else{
    const missing=LN214.REQUIRED_HEADERS.filter(h=>headers.indexOf(h)<0);
    if(missing.length)sh.getRange(1,lastCol+1,1,missing.length).setValues([missing]);
  }
  const hm=headerMapV214_(sh);
  ['waitTypeId','receiptNo','reserveId','lineUserId'].forEach(k=>{if(hm[k])sh.getRange(2,hm[k],Math.max(1,sh.getMaxRows()-1),1).setNumberFormat('@')});
  return sh;
}

function ensureLineControl_(ss){let sh=ss.getSheetByName(LN214.CONTROL);if(!sh)sh=ss.insertSheet(LN214.CONTROL);if(!sh.getLastRow())sh.getRange(1,1,1,3).setValues([['key','value','description']]);return sh}
function ensureLineLog_(ss){let sh=ss.getSheetByName(LN214.LOG);if(!sh)sh=ss.insertSheet(LN214.LOG);if(!sh.getLastRow())sh.getRange(1,1,1,8).setValues([['timestamp','level','action','waitTypeId','receiptNo','result','detail','durationMs']]);return sh}

function lineControl_(ss){
  const sh=ensureLineControl_(ss),out={};
  if(sh.getLastRow())sh.getRange(1,1,sh.getLastRow(),2).getDisplayValues().forEach(r=>{const k=String(r[0]||'').trim();if(k)out[k]=r[1]});
  return out;
}

function setControlValue_(ss,key,value,description){
  const sh=ensureLineControl_(ss),last=sh.getLastRow();
  if(last){const keys=sh.getRange(1,1,last,1).getDisplayValues().flat();const i=keys.findIndex(x=>String(x).trim()===key);if(i>=0){sh.getRange(i+1,2,1,2).setValues([[value,description]]);return}}
  sh.appendRow([key,value,description]);
}

function headerMapV214_(sh){const h=sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getDisplayValues()[0],m={};h.forEach((x,i)=>{const k=String(x||'').trim();if(k)m[k]=i+1});return m}
function rowObjectV214_(sh,row,hm){const vals=sh.getRange(row,1,1,sh.getLastColumn()).getDisplayValues()[0],o={};Object.keys(hm).forEach(k=>o[k]=vals[hm[k]-1]);o._row=row;return o}

function findLineMapRow_(sh,receiptNo,waitTypeId,businessDate){
  const hm=headerMapV214_(sh),last=sh.getLastRow();if(last<2)return null;
  const vals=sh.getRange(2,1,last-1,sh.getLastColumn()).getDisplayValues();
  let fallback=null;
  for(let i=vals.length-1;i>=0;i--){
    if(String(vals[i][hm.receiptNo-1])!==String(receiptNo)||String(vals[i][hm.waitTypeId-1])!==String(waitTypeId))continue;
    const row=i+2;
    if(hm.businessDate&&businessDate&&String(vals[i][hm.businessDate-1])===String(businessDate))return row;
    if(!fallback)fallback=row;
  }
  return fallback;
}

function findLineMapRecord_(ss,receiptNo,waitTypeId,businessDate){const sh=ensureLineMap_(ss),row=findLineMapRow_(sh,receiptNo,waitTypeId,businessDate);return row?rowObjectV214_(sh,row,headerMapV214_(sh)):null}

function upsertLineMap_(ss,x){
  const sh=ensureLineMap_(ss),hm=headerMapV214_(sh),today=x.businessDate||jstDateV214_(new Date());
  const row=findLineMapRow_(sh,x.receiptNo,x.waitTypeId,today)||sh.getLastRow()+1;
  const existing=row<=sh.getLastRow()?rowObjectV214_(sh,row,hm):{};
  const data={
    receivedAt:existing.receivedAt||new Date(),
    businessDate:today,
    waitTypeId:x.waitTypeId,
    waitTypeName:x.waitTypeName||existing.waitTypeName||'',
    receiptNo:x.receiptNo,
    reserveId:x.reserveId||existing.reserveId||'',
    bridgeStatus:x.bridgeStatus||existing.bridgeStatus||'',
    calledAt:existing.calledAt||'',
    lastSeenStatus:existing.lastSeenStatus||'',
    retryCount:existing.retryCount||0,
    lastError:x.lastError||existing.lastError||'',
    updatedAt:new Date(),
    lineUserId:x.lineUserId||existing.lineUserId||'',
    lineLinkedAt:x.lineUserId?(existing.lineLinkedAt||new Date()):(existing.lineLinkedAt||''),
    lineNotifiedAt:existing.lineNotifiedAt||'',
    lineNotifyStatus:x.lineNotifyStatus||existing.lineNotifyStatus||''
  };
  Object.keys(data).forEach(k=>{if(hm[k])sh.getRange(row,hm[k]).setValue(data[k])});
  return rowObjectV214_(sh,row,hm);
}

function setLineMapFields_(ss,receiptNo,waitTypeId,fields){
  const sh=ensureLineMap_(ss),row=findLineMapRow_(sh,receiptNo,waitTypeId,jstDateV214_(new Date()));if(!row)return false;
  const hm=headerMapV214_(sh);
  Object.keys(fields||{}).forEach(k=>{if(hm[k])sh.getRange(row,hm[k]).setValue(fields[k])});
  if(hm.updatedAt)sh.getRange(row,hm.updatedAt).setValue(new Date());
  return true;
}

function logLine_(ss,level,action,waitTypeId,receiptNo,result,detail,durationMs){
  ensureLineLog_(ss).appendRow([new Date(),String(level||''),String(action||''),String(waitTypeId||''),String(receiptNo||''),String(result||''),String(detail||''),Number(durationMs||0)]);
}

function removeLineNotifyTriggers_(){ScriptApp.getProjectTriggers().forEach(t=>{if(t.getHandlerFunction()==='lineNotifyWorkerV214')ScriptApp.deleteTrigger(t)})}
function airwaitKeyV214_(){const k=String(PropertiesService.getScriptProperties().getProperty(LN214.AIRWAIT_KEY_PROP)||'').trim();if(!k)throw new Error('AIRWAIT_API_KEY_NOT_CONFIGURED');return k}
function lineChannelTokenV214_(){return String(PropertiesService.getScriptProperties().getProperty(LN214.LINE_TOKEN_PROP)||'').trim()}
function lineChannelTokenConfiguredV214_(){return Boolean(lineChannelTokenV214_())}
function digits_(v){return String(v==null?'':v).normalize('NFKC').replace(/\D/g,'')}
function normalizeReserveIdV214_(v){const d=digits_(v);return!d||d.length>12?'':d.padStart(12,'0')}
function receiptV214_(r){return digits_(r&&(r.number!=null?r.number:r.receiptNo))}
function reserveIdV214_(r){for(const v of [r&&r.reserveId,r&&r.reserveID,r&&r.reservationId,r&&r.reservationID]){const x=normalizeReserveIdV214_(v);if(x)return x}return''}
function callFlagV214_(v){return v===true||v===1||v==='1'||String(v).toLowerCase()==='true'}
function boolLine_(v,def){if(v==null||String(v).trim()==='')return !!def;return v===true||v===1||v==='1'||String(v).toUpperCase()==='TRUE'}
function jstDateV214_(d){return Utilities.formatDate(d,LN214.TZ,'yyyy-MM-dd')}
function parseJsonV214_(text,label){try{return JSON.parse(text)}catch(_){throw new Error(label+' JSON_PARSE_ERROR')}}
function airwaitOkV214_(d){return d&&(d.success===true||String(d.resultCode&&d.resultCode.code||'')==='0000')}
function airwaitMessageV214_(d,fallback){return String(d&&d.resultCode&&d.resultCode.defaultMessage||fallback)}
function safeApiMessageV214_(text){try{const d=JSON.parse(text);return String(d&&d.message||'').slice(0,180)}catch(_){return String(text||'').slice(0,180)}}
function bridgeRequestIdV214_(v){const s=String(v||'').trim();return/^[A-Za-z0-9_-]{8,100}$/.test(s)?s:''}
function cacheBridgeV214_(requestId,status){if(!requestId)return;try{CacheService.getScriptCache().put('LN214_BRIDGE_'+requestId,JSON.stringify(Object.assign({at:Date.now()},status)),600)}catch(_){}}
function readBridgeV214_(requestId){if(!requestId)return{ok:false,found:false,error:'REQUEST_ID_INVALID'};try{const raw=CacheService.getScriptCache().get('LN214_BRIDGE_'+requestId);if(!raw)return{ok:true,found:false};return Object.assign({found:true},JSON.parse(raw))}catch(_){return{ok:false,found:false,error:'BRIDGE_STATUS_ERROR'}}}
function outV214_(obj,callback){const json=JSON.stringify(obj),cb=String(callback||'');if(cb&&/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb))return ContentService.createTextOutput(cb+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON)}
function uuidForRetry_(seed){const s=String(seed||'');let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}const hex=(n)=>('00000000'+(n>>>0).toString(16)).slice(-8);return hex(h)+ '-' +hex(h^0x12345678).slice(0,4)+'-4'+hex(h^0x9abcdef0).slice(0,3)+'-a'+hex(h^0x13579bdf).slice(0,3)+'-'+hex(h^0x2468ace0)+hex(h^0xfedcba98).slice(0,4)}
function findMarkerV214_(p){const names=['lastUpdDate','lastUpdate','lastUpdateDate','lastUpdatedAt','updateDate','updatedAt','lastUpdDateStateless'],seen=[];function walk(v,d){if(!v||typeof v!=='object'||d>5||seen.indexOf(v)>=0)return'';seen.push(v);for(const k of names)if(v[k]!=null&&String(v[k]).trim())return String(v[k]).trim();for(const k of Object.keys(v))if(/last.*upd|update.*date|updated/i.test(k)&&v[k]!=null&&typeof v[k]!=='object'&&String(v[k]).trim())return String(v[k]).trim();for(const k of Object.keys(v)){const x=walk(v[k],d+1);if(x)return x}return''}return walk(p,0)}

function testLineNotifyHealthV214(){
  const ss=lineBook_(),ctl=lineControl_(ss);
  console.log(JSON.stringify({version:LN214.VERSION,spreadsheet:ss.getName(),lineNotifyEnabled:boolLine_(ctl.lineNotifyEnabled,true),lineTokenConfigured:lineChannelTokenConfiguredV214_(),lastUpdate:lineLastUpdate_()},null,2));
}

function testLineMessagingConfigV214(){
  const token=lineChannelTokenV214_();if(!token)throw new Error('LINE_CHANNEL_ACCESS_TOKEN_NOT_CONFIGURED');
  const r=UrlFetchApp.fetch('https://api.line.me/v2/bot/info',{method:'get',headers:{Authorization:'Bearer '+token},muteHttpExceptions:true});
  console.log(JSON.stringify({http:r.getResponseCode(),ok:r.getResponseCode()===200,body:safeApiMessageV214_(r.getContentText())},null,2));
}
