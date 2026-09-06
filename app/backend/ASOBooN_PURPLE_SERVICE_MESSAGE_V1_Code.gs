/**
 * ASOBooN PURPLE Service Message backend v1.0.0
 * Purple-only / standalone Apps Script Web App.
 * Never place Channel Secret or AirWAIT API key in GitHub/client JS.
 *
 * Script Properties required:
 *   PURPLE_LINE_MINIAPP_CHANNEL_SECRET  (Developing internal channel secret)
 *   AIRWAIT_API_KEY                     (for background call monitoring)
 * Optional:
 *   PURPLE_LINE_MINIAPP_CHANNEL_ID      (defaults to 2011467470)
 *   PURPLE_SERVICE_TEMPLATE_NAME        (exact template name; _ja is appended if no language suffix)
 *   PURPLE_SERVICE_TEMPLATE_PARAMS_JSON (JSON object; supports {{receiptNo}}, {{waitTypeName}}, {{callstatusUrl}})
 */
const PSM1=Object.freeze({
  VERSION:'1.0.0',
  TZ:'Asia/Tokyo',
  SPREADSHEET_ID:'1dsQcmLMNxVb-uaR16zbqhqjeenoNg5VqMMWa3-1pj8Y',
  CHANNEL_ID_DEFAULT:'2011467470',
  CHANNEL_ID_PROP:'PURPLE_LINE_MINIAPP_CHANNEL_ID',
  CHANNEL_SECRET_PROP:'PURPLE_LINE_MINIAPP_CHANNEL_SECRET',
  AIRWAIT_KEY_PROP:'AIRWAIT_API_KEY',
  TEMPLATE_PROP:'PURPLE_SERVICE_TEMPLATE_NAME',
  TEMPLATE_PARAMS_PROP:'PURPLE_SERVICE_TEMPLATE_PARAMS_JSON',
  MAP:'PURPLE_SERVICE_MAP',
  CONTROL:'PURPLE_SERVICE_CONTROL',
  LOG:'PURPLE_SERVICE_LOG',
  STORE_ID:'KR01205179',
  ORIGIN:'https://asoboon.github.io',
  OAUTH:'https://api.line.me/oauth2/v3/token',
  NOTIFIER_TOKEN:'https://api.line.me/message/v3/notifier/token',
  NOTIFIER_SEND:'https://api.line.me/message/v3/notifier/send?target=service',
  AIRWAIT_LAST:'https://cl.airwait.jp/WCLP/api/external/stateless/store/getLastUpdDateStateless',
  AIRWAIT_RES:'https://cl.airwait.jp/WCLP/api/external/stateless/reservations',
  CALLSTATUS_URL:'https://asoboon.github.io/asoboon-stamp/purple-callstatus.html',
  CACHE_TTL:600,
  MAP_HEADERS:Object.freeze(['createdAt','updatedAt','businessDate','receiptNo','reserveId','waitTypeId','waitTypeName','notificationToken','expiresAt','remainingCount','sessionId','liffTokenHash','status','lastError','lastSentAt','templateName','source']),
  LOG_HEADERS:Object.freeze(['time','level','action','receiptNo','reserveId','endpoint','httpStatus','result','message'])
});

function setupPurpleServiceMessageV1(){
  const ss=psmBook_();
  ensurePsmSheet_(ss,PSM1.MAP,PSM1.MAP_HEADERS,1000);
  ensurePsmSheet_(ss,PSM1.LOG,PSM1.LOG_HEADERS,5000);
  ensurePsmControl_(ss);
  const props=PropertiesService.getScriptProperties();
  if(!props.getProperty(PSM1.CHANNEL_ID_PROP))props.setProperty(PSM1.CHANNEL_ID_PROP,PSM1.CHANNEL_ID_DEFAULT);
  removePsmTriggers_();
  ScriptApp.newTrigger('purpleServiceWorkerV1').timeBased().everyMinutes(1).create();
  logPsm_('INFO','SETUP','','','','','READY','v'+PSM1.VERSION);
  return psmHealth_();
}

function doGet(e){
  const p=e&&e.parameter||{};
  const action=String(p.action||'health');
  const callback=String(p.callback||'');
  let result;
  try{
    if(action==='health')result=psmHealth_();
    else if(action==='requestStatus')result=readPsmRequest_(String(p.requestId||''));
    else if(action==='reservationStatus')result=publicReservationStatus_(p);
    else result={ok:false,error:'UNKNOWN_ACTION',version:PSM1.VERSION};
  }catch(err){result={ok:false,error:safePsmError_(err),version:PSM1.VERSION};}
  return psmOut_(result,callback);
}

function doPost(e){
  const p=Object.assign({},e&&e.parameter||{});
  const requestId=psmRequestId_(p.requestId);
  let result;
  try{
    const action=String(p.action||'issueServiceToken');
    if(action!=='issueServiceToken')throw new Error('UNKNOWN_ACTION');
    result=issuePurpleServiceToken_(p);
  }catch(err){
    result={ok:false,stored:false,error:safePsmError_(err),version:PSM1.VERSION};
    logPsm_('ERROR','ISSUE',digitsPsm_(p.receiptNo),normalizeReserveIdPsm_(p.reserveId),PSM1.NOTIFIER_TOKEN,'','ERROR',result.error);
  }
  cachePsmRequest_(requestId,result);
  return psmOut_(result,'');
}

function issuePurpleServiceToken_(p){
  const ctl=psmControl_();
  if(!boolPsm_(ctl.enabled,false))throw new Error('PURPLE_SERVICE_DISABLED');
  const receiptNo=digitsPsm_(p.receiptNo).slice(0,12);
  const reserveId=normalizeReserveIdPsm_(p.reserveId);
  const waitTypeId=digitsPsm_(p.waitTypeId);
  const waitTypeName=String(p.waitTypeName||'').trim().slice(0,100);
  const businessDate=String(p.businessDate||p.operationalDay||p.day||'').trim().slice(0,10);
  const source=String(p.source||'purple').trim().slice(0,100);
  const liffAccessToken=String(p.liffAccessToken||'').trim();
  const sendFirst=boolPsm_(p.sendFirstMessage,false);
  if(!receiptNo||!reserveId||!/^\d{4}$/.test(waitTypeId))throw new Error('VALIDATION_ERROR');
  if(liffAccessToken.length<20)throw new Error('LIFF_ACCESS_TOKEN_REQUIRED');

  const tokenHash=sha256HexPsm_(liffAccessToken);
  const existing=findPsmMap_(receiptNo,reserveId);
  if(existing&&existing.liffTokenHash===tokenHash&&existing.notificationToken){
    if(sendFirst&&String(existing.status)!=='FIRST_MESSAGE_SENT'){
      const sent=sendServiceForRecord_(existing,{receiptNo,reserveId,waitTypeId,waitTypeName,businessDate,source});
      return publicPsmResult_(sent,true);
    }
    return publicPsmResult_(existing,true);
  }

  const channelToken=statelessChannelTokenPsm_();
  const r=UrlFetchApp.fetch(PSM1.NOTIFIER_TOKEN,{method:'post',contentType:'application/json; charset=UTF-8',headers:{Authorization:'Bearer '+channelToken},payload:JSON.stringify({liffAccessToken:liffAccessToken}),muteHttpExceptions:true,followRedirects:true});
  const code=r.getResponseCode();
  const body=String(r.getContentText()||'');
  logPsm_(code===200?'INFO':'ERROR','TOKEN_ISSUE',receiptNo,reserveId,'/message/v3/notifier/token',code,code===200?'OK':'ERROR',safeApiTextPsm_(body));
  if(code!==200)throw new Error('NOTIFIER_TOKEN_HTTP_'+code+' '+safeApiTextPsm_(body));
  const d=parseJsonPsm_(body,'notifier token');
  if(!d.notificationToken)throw new Error('NOTIFICATION_TOKEN_EMPTY');
  const now=new Date();
  let rec={
    createdAt:existing&&existing.createdAt||now,
    updatedAt:now,businessDate,receiptNo,reserveId,waitTypeId,waitTypeName,
    notificationToken:String(d.notificationToken),
    expiresAt:new Date(now.getTime()+Math.max(0,Number(d.expiresIn||0))*1000),
    remainingCount:Number(d.remainingCount||0),sessionId:String(d.sessionId||''),
    liffTokenHash:tokenHash,status:'TOKEN_READY',lastError:'',lastSentAt:'',templateName:'',source
  };
  rec=upsertPsmMap_(rec);
  if(sendFirst)rec=sendServiceForRecord_(rec,{receiptNo,reserveId,waitTypeId,waitTypeName,businessDate,source});
  return publicPsmResult_(rec,false);
}

function sendServiceForRecord_(rec,ctx){
  const template=templateNamePsm_();
  if(!template)throw new Error('SERVICE_TEMPLATE_NOT_CONFIGURED');
  const params=templateParamsPsm_(Object.assign({},ctx||{},rec||{}));
  const channelToken=statelessChannelTokenPsm_();
  const body={templateName:template,params:params,notificationToken:String(rec.notificationToken||'')};
  if(!body.notificationToken)throw new Error('NOTIFICATION_TOKEN_EMPTY');
  const r=UrlFetchApp.fetch(PSM1.NOTIFIER_SEND,{method:'post',contentType:'application/json; charset=UTF-8',headers:{Authorization:'Bearer '+channelToken},payload:JSON.stringify(body),muteHttpExceptions:true,followRedirects:true});
  const code=r.getResponseCode();
  const text=String(r.getContentText()||'');
  logPsm_(code===200?'INFO':'ERROR','SERVICE_SEND',rec.receiptNo,rec.reserveId,'/message/v3/notifier/send?target=service',code,code===200?'OK':'ERROR',safeApiTextPsm_(text));
  if(code!==200){
    rec.status='SEND_ERROR';rec.lastError='NOTIFIER_SEND_HTTP_'+code+' '+safeApiTextPsm_(text);rec.updatedAt=new Date();
    upsertPsmMap_(rec);throw new Error(rec.lastError);
  }
  const d=parseJsonPsm_(text,'notifier send');
  rec.notificationToken=String(d.notificationToken||'');
  rec.expiresAt=new Date(Date.now()+Math.max(0,Number(d.expiresIn||0))*1000);
  rec.remainingCount=Number(d.remainingCount||0);
  rec.sessionId=String(d.sessionId||rec.sessionId||'');
  rec.status='FIRST_MESSAGE_SENT';rec.lastError='';rec.lastSentAt=new Date();rec.updatedAt=new Date();rec.templateName=template;
  return upsertPsmMap_(rec);
}

function purpleServiceWorkerV1(){
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(4000))return;
  try{
    const ctl=psmControl_();
    if(!boolPsm_(ctl.enabled,false)||!boolPsm_(ctl.workerEnabled,false))return;
    const marker=airwaitLastUpdatePsm_();
    const props=PropertiesService.getScriptProperties();
    const prev=props.getProperty('PSM1_AIRWAIT_LAST')||'';
    if(prev&&marker===prev)return;
    const rows=airwaitReservationsPsm_();
    for(const row of rows){
      if(!(callFlagPsm_(row&&row.isCalling)||String(row&&row.status||'')==='1'))continue;
      const receiptNo=digitsPsm_(row&&(row.number!=null?row.number:row.receiptNo));
      const waitTypeId=String(row&&row.waitTypeId||'').trim();
      const reserveId=reserveIdPsm_(row);
      if(!receiptNo||!waitTypeId)continue;
      const rec=findPsmMapByCall_(receiptNo,waitTypeId,reserveId);
      if(!rec||!rec.notificationToken)continue;
      if(/^CALL_MESSAGE_SENT$/.test(String(rec.status||'')))continue;
      if(Number(rec.remainingCount||0)<=0)continue;
      try{
        const ctx={receiptNo,waitTypeId,reserveId:reserveId||rec.reserveId,waitTypeName:rec.waitTypeName,businessDate:rec.businessDate,source:'purple-worker'};
        const sent=sendServiceForRecord_(rec,ctx);
        sent.status='CALL_MESSAGE_SENT';sent.updatedAt=new Date();upsertPsmMap_(sent);
        logPsm_('INFO','CALL_NOTIFY',receiptNo,sent.reserveId,'AirWAIT','','SENT','calling detected');
      }catch(err){logPsm_('ERROR','CALL_NOTIFY',receiptNo,rec.reserveId,'AirWAIT','','ERROR',safePsmError_(err));}
    }
    props.setProperty('PSM1_AIRWAIT_LAST',marker);
  }catch(err){logPsm_('ERROR','WORKER','','','AirWAIT','','ERROR',safePsmError_(err));}
  finally{try{lock.releaseLock()}catch(_){}}
}

function psmHealth_(){
  let ctl={};try{ctl=psmControl_()}catch(_){}
  const props=PropertiesService.getScriptProperties();
  return{
    ok:true,service:'ASOBooN PURPLE Service Message',version:PSM1.VERSION,
    channelId:channelIdPsm_(),channelSecretConfigured:Boolean(props.getProperty(PSM1.CHANNEL_SECRET_PROP)),
    airwaitKeyConfigured:Boolean(props.getProperty(PSM1.AIRWAIT_KEY_PROP)),templateConfigured:Boolean(templateNamePsm_()),
    enabled:boolPsm_(ctl.enabled,false),workerEnabled:boolPsm_(ctl.workerEnabled,false),testMode:boolPsm_(ctl.testMode,true)
  };
}

function publicReservationStatus_(p){
  const receiptNo=digitsPsm_(p.receiptNo),reserveId=normalizeReserveIdPsm_(p.reserveId);
  if(!receiptNo||!reserveId)return{ok:false,error:'VALIDATION_ERROR'};
  const rec=findPsmMap_(receiptNo,reserveId);
  return rec?publicPsmResult_(rec,true):{ok:true,found:false,version:PSM1.VERSION};
}

function publicPsmResult_(rec,already){
  return{ok:true,stored:true,found:true,version:PSM1.VERSION,alreadyIssued:Boolean(already),receiptNo:String(rec.receiptNo||''),reserveId:String(rec.reserveId||''),status:String(rec.status||''),remainingCount:Number(rec.remainingCount||0),expiresAt:dateTextPsm_(rec.expiresAt),sessionIdPresent:Boolean(rec.sessionId),templateName:String(rec.templateName||''),lastSentAt:dateTextPsm_(rec.lastSentAt),error:String(rec.lastError||'')};
}

function statelessChannelTokenPsm_(){
  const secret=String(PropertiesService.getScriptProperties().getProperty(PSM1.CHANNEL_SECRET_PROP)||'').trim();
  if(!secret)throw new Error('CHANNEL_SECRET_NOT_CONFIGURED');
  const r=UrlFetchApp.fetch(PSM1.OAUTH,{method:'post',contentType:'application/x-www-form-urlencoded',payload:{grant_type:'client_credentials',client_id:channelIdPsm_(),client_secret:secret},muteHttpExceptions:true,followRedirects:true});
  const code=r.getResponseCode(),text=String(r.getContentText()||'');
  logPsm_(code===200?'INFO':'ERROR','CHANNEL_TOKEN','','','/oauth2/v3/token',code,code===200?'OK':'ERROR',safeApiTextPsm_(text));
  if(code!==200)throw new Error('CHANNEL_TOKEN_HTTP_'+code+' '+safeApiTextPsm_(text));
  const d=parseJsonPsm_(text,'channel token');if(!d.access_token)throw new Error('CHANNEL_ACCESS_TOKEN_EMPTY');return String(d.access_token);
}

function templateNamePsm_(){
  let t=String(PropertiesService.getScriptProperties().getProperty(PSM1.TEMPLATE_PROP)||'').trim();
  if(!t){try{t=String(psmControl_().templateName||'').trim()}catch(_){} }
  if(t&&!/_(?:ja|en|zh-TW|th|id|ko)$/.test(t))t+='_ja';
  return t.slice(0,30);
}

function templateParamsPsm_(ctx){
  const raw=String(PropertiesService.getScriptProperties().getProperty(PSM1.TEMPLATE_PARAMS_PROP)||'{}').trim()||'{}';
  let obj=parseJsonPsm_(raw,'template params');if(!obj||Array.isArray(obj)||typeof obj!=='object')throw new Error('TEMPLATE_PARAMS_NOT_OBJECT');
  const vars={receiptNo:String(ctx.receiptNo||''),waitTypeName:String(ctx.waitTypeName||''),callstatusUrl:PSM1.CALLSTATUS_URL,businessDate:String(ctx.businessDate||''),reserveId:String(ctx.reserveId||'')};
  const out={};Object.keys(obj).slice(0,30).forEach(k=>{let v=String(obj[k]==null?'':obj[k]);Object.keys(vars).forEach(n=>{v=v.split('{{'+n+'}}').join(vars[n])});out[String(k).slice(0,50)]=v.slice(0,1000)});return out;
}

function airwaitLastUpdatePsm_(){
  const key=airwaitKeyPsm_();
  const u=PSM1.AIRWAIT_LAST+'?key='+encodeURIComponent(key)+'&storeId='+encodeURIComponent(PSM1.STORE_ID);
  const r=UrlFetchApp.fetch(u,{method:'get',headers:{Origin:PSM1.ORIGIN},muteHttpExceptions:true,followRedirects:true});
  if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('AIRWAIT_LAST_HTTP_'+r.getResponseCode());
  const d=parseJsonPsm_(r.getContentText(),'airwait last');if(!airwaitOkPsm_(d))throw new Error('AIRWAIT_LAST_ERROR');
  const x=d&&d.innerDto||d&&d.dto||d;const marker=String(x&&(x.lastUpdDate||x.lastUpdateDate||x.updatedAt||x.updateDate)||'');if(!marker)throw new Error('AIRWAIT_LAST_MARKER_EMPTY');return marker;
}

function airwaitReservationsPsm_(){
  const out=[];let start=1,total=Infinity,guard=0;
  while(start<=total&&guard++<40){
    const u=PSM1.AIRWAIT_RES+'?key='+encodeURIComponent(airwaitKeyPsm_());
    const r=UrlFetchApp.fetch(u,{method:'post',headers:{Origin:PSM1.ORIGIN},contentType:'application/x-www-form-urlencoded; charset=UTF-8',payload:{storeId:PSM1.STORE_ID,sortStatus:'0',isDesc:'0',start:String(start),limit:'100'},muteHttpExceptions:true,followRedirects:true});
    if(r.getResponseCode()<200||r.getResponseCode()>=300)throw new Error('AIRWAIT_RES_HTTP_'+r.getResponseCode());
    const d=parseJsonPsm_(r.getContentText(),'airwait reservations');if(!airwaitOkPsm_(d))throw new Error('AIRWAIT_RES_ERROR');
    const inner=d&&d.innerDto||{};const rows=Array.isArray(inner.reservations)?inner.reservations:[];total=Number(inner.count||rows.length);out.push.apply(out,rows);if(!rows.length)break;start+=rows.length;
  }
  return out;
}

function airwaitKeyPsm_(){const x=String(PropertiesService.getScriptProperties().getProperty(PSM1.AIRWAIT_KEY_PROP)||'').trim();if(!x)throw new Error('AIRWAIT_API_KEY_NOT_CONFIGURED');return x}
function airwaitOkPsm_(d){return d&&(d.success===true||String(d.resultCode&&d.resultCode.code||'')==='0000')}
function callFlagPsm_(v){return v===true||v===1||v==='1'||String(v).toLowerCase()==='true'}
function reserveIdPsm_(r){for(const v of [r&&r.reserveId,r&&r.reserveID,r&&r.reservationId,r&&r.reservationID]){const x=normalizeReserveIdPsm_(v);if(x)return x}return''}

function psmBook_(){return SpreadsheetApp.openById(PSM1.SPREADSHEET_ID)}
function ensurePsmSheet_(ss,name,headers,rows){let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getMaxRows()<rows)sh.insertRowsAfter(sh.getMaxRows(),rows-sh.getMaxRows());if(sh.getMaxColumns()<headers.length)sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());const got=sh.getRange(1,1,1,headers.length).getDisplayValues()[0];if(headers.some((h,i)=>got[i]!==h))sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);return sh}
function ensurePsmControl_(ss){const sh=ss.getSheetByName(PSM1.CONTROL)||ss.insertSheet(PSM1.CONTROL);const defaults=[['key','value','note'],['version',PSM1.VERSION,'backend version'],['enabled','FALSE','Developing疎通完了後にTRUE'],['channelId',PSM1.CHANNEL_ID_DEFAULT,'Developing internal channel'],['templateName','','queue management template'],['workerEnabled','FALSE','実送信テスト後にTRUE'],['testMode','TRUE','purple only']];if(sh.getLastRow()<2){sh.getRange(1,1,defaults.length,3).setValues(defaults)}else{const vals=sh.getDataRange().getDisplayValues(),seen={};for(let i=1;i<vals.length;i++)seen[String(vals[i][0]||'').trim()]=i+1;for(let i=1;i<defaults.length;i++){const k=defaults[i][0],r=seen[k];if(r){if(k==='version')sh.getRange(r,2).setValue(PSM1.VERSION)}else sh.appendRow(defaults[i])}if(String(sh.getRange(1,1).getDisplayValue())!=='key')sh.getRange(1,1,1,3).setValues([defaults[0]])}sh.setFrozenRows(1);return sh}
function psmControl_(){const sh=psmBook_().getSheetByName(PSM1.CONTROL);if(!sh)return{};const v=sh.getDataRange().getDisplayValues(),out={};for(let i=1;i<v.length;i++){const k=String(v[i][0]||'').trim();if(k)out[k]=v[i][1]}return out}

function findPsmMap_(receiptNo,reserveId){const sh=psmBook_().getSheetByName(PSM1.MAP);if(!sh||sh.getLastRow()<2)return null;const vals=sh.getRange(2,1,sh.getLastRow()-1,PSM1.MAP_HEADERS.length).getValues();for(let i=vals.length-1;i>=0;i--){const o=rowPsm_(vals[i],i+2);if(String(o.receiptNo)===String(receiptNo)&&normalizeReserveIdPsm_(o.reserveId)===normalizeReserveIdPsm_(reserveId))return o}return null}
function findPsmMapByCall_(receiptNo,waitTypeId,reserveId){const sh=psmBook_().getSheetByName(PSM1.MAP);if(!sh||sh.getLastRow()<2)return null;const vals=sh.getRange(2,1,sh.getLastRow()-1,PSM1.MAP_HEADERS.length).getValues();for(let i=vals.length-1;i>=0;i--){const o=rowPsm_(vals[i],i+2);if(String(o.receiptNo)!==String(receiptNo)||String(o.waitTypeId)!==String(waitTypeId))continue;if(reserveId&&normalizeReserveIdPsm_(o.reserveId)!==normalizeReserveIdPsm_(reserveId))continue;return o}return null}
function rowPsm_(row,rowNumber){const o={_row:rowNumber};PSM1.MAP_HEADERS.forEach((h,i)=>o[h]=row[i]);return o}
function upsertPsmMap_(rec){const sh=ensurePsmSheet_(psmBook_(),PSM1.MAP,PSM1.MAP_HEADERS,1000);let row=Number(rec._row||0);if(!row){const old=findPsmMap_(rec.receiptNo,rec.reserveId);row=old&&old._row||sh.getLastRow()+1;if(old&&!rec.createdAt)rec.createdAt=old.createdAt}rec._row=row;if(!rec.createdAt)rec.createdAt=new Date();rec.updatedAt=new Date();sh.getRange(row,1,1,PSM1.MAP_HEADERS.length).setValues([PSM1.MAP_HEADERS.map(h=>rec[h]==null?'':rec[h])]);return rec}

function logPsm_(level,action,receiptNo,reserveId,endpoint,httpStatus,result,message){try{const sh=ensurePsmSheet_(psmBook_(),PSM1.LOG,PSM1.LOG_HEADERS,5000);sh.appendRow([new Date(),level,action,receiptNo,reserveId,endpoint,httpStatus,result,String(message||'').slice(0,500)])}catch(_){} }
function cachePsmRequest_(id,data){if(!id)return;try{CacheService.getScriptCache().put('psm1_'+id,JSON.stringify(Object.assign({found:true},data)),PSM1.CACHE_TTL)}catch(_){} }
function readPsmRequest_(id){if(!id)return{ok:false,found:false,error:'REQUEST_ID_REQUIRED'};try{const x=CacheService.getScriptCache().get('psm1_'+id);return x?JSON.parse(x):{ok:true,found:false,version:PSM1.VERSION}}catch(_){return{ok:false,found:false,error:'CACHE_ERROR',version:PSM1.VERSION}}}
function psmRequestId_(v){const x=String(v||'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,100);return x||Utilities.getUuid()}

function channelIdPsm_(){return String(PropertiesService.getScriptProperties().getProperty(PSM1.CHANNEL_ID_PROP)||PSM1.CHANNEL_ID_DEFAULT).trim()}
function digitsPsm_(v){return String(v==null?'':v).normalize('NFKC').replace(/\D/g,'')}
function normalizeReserveIdPsm_(v){const d=digitsPsm_(v);return!d||d.length>12?'':d.padStart(12,'0')}
function boolPsm_(v,def){if(v==null||String(v).trim()==='')return !!def;return v===true||v===1||v==='1'||String(v).toUpperCase()==='TRUE'}
function dateTextPsm_(v){if(!v)return'';try{return Utilities.formatDate(v instanceof Date?v:new Date(v),PSM1.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX")}catch(_){return String(v)}}
function parseJsonPsm_(text,label){try{return JSON.parse(String(text||''))}catch(_){throw new Error(String(label||'JSON')+'_JSON_PARSE_ERROR')}}
function safeApiTextPsm_(text){const s=String(text||'').replace(/[\r\n\t]+/g,' ').replace(/"(access_token|notificationToken|liffAccessToken|client_secret)"\s*:\s*"[^"]*"/gi,'"$1":"[REDACTED]"');return s.slice(0,300)}
function safePsmError_(e){return String(e&&e.message||e||'UNKNOWN_ERROR').replace(/[\r\n\t]+/g,' ').slice(0,500)}
function sha256HexPsm_(text){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('')}
function psmOut_(data,callback){const json=JSON.stringify(data);if(callback&&/^[A-Za-z_$][0-9A-Za-z_$\.]{0,80}$/.test(callback))return ContentService.createTextOutput(callback+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON)}
function removePsmTriggers_(){ScriptApp.getProjectTriggers().forEach(t=>{if(t.getHandlerFunction&&t.getHandlerFunction()==='purpleServiceWorkerV1')ScriptApp.deleteTrigger(t)})}
