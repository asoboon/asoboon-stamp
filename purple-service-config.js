/* ASOBooN PURPLE Gateway client config v2.1
 * Purple-only. Public identifiers and a staff-configured Web App URL only.
 * NEVER put Channel Secret, AirWAIT API key, LIFF access tokens or notification tokens here.
 */
(()=>{'use strict';
const BACKEND_KEY='asoboon_purple_gateway_backend_url_v2';
const RESULT_KEY='asoboon_purple_service_message_v2';
const validBackend=v=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/.test(String(v||''));
let backendUrl='';
try{const saved=String(localStorage.getItem(BACKEND_KEY)||'').trim();if(validBackend(saved))backendUrl=saved}catch(_){ }
window.ASOBOON_PURPLE_SERVICE_CONFIG=Object.freeze({
  version:'2.1.0',
  liffId:'2011467470-Gk5C3lWf',
  liffUrl:'https://miniapp.line.me/2011467470-Gk5C3lWf/',
  backendUrl,
  backendConfigKey:BACKEND_KEY,
  backendVersionPrefix:'2.1.',
  requestTimeoutMs:12000,
  statusPollMs:[400,800,1200,1800,2600,3600,5000],
  snapshotPollMs:15000,
  resultKey:RESULT_KEY,
  validBackend
});
})();
