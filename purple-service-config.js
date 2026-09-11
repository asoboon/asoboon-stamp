/* ASOBooN PURPLE Gateway client config v2.3 CF11
 * Purple-only. Cloudflare Worker backend.
 * NEVER put Channel Secret, AirWAIT API key, LIFF access tokens or notification tokens here.
 */
(()=>{'use strict';
const RESULT_KEY='asoboon_purple_service_message_v2';
const BACKEND_URL='https://asoboon-purple-gateway.asoboon425.workers.dev/';
const validBackend=v=>/^https:\/\/asoboon-purple-gateway\.asoboon425\.workers\.dev\/?(?:\?.*)?$/.test(String(v||''));
window.ASOBOON_PURPLE_SERVICE_CONFIG=Object.freeze({
  version:'2.3.0-cf11',
  liffId:'2011467470-Gk5C3lWf',
  liffUrl:'https://miniapp.line.me/2011467470-Gk5C3lWf/',
  backendUrl:BACKEND_URL,
  backendConfigKey:'',
  backendVersionPrefix:'2.1.cf11',
  requestTimeoutMs:12000,
  statusPollMs:[400,800,1200,1800,2600,3600,5000],
  snapshotPollMs:60000,
  resultKey:RESULT_KEY,
  validBackend
});
})();
