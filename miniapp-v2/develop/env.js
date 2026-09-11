/* ASOBooN LINE MINI App v2 / Developing environment
 * Public identifiers only. Never put secrets in this file.
 */
(()=>{'use strict';
window.ASOBOON_V2_ENV=Object.freeze({
  environment:'develop',
  environmentLabel:'DEVELOPING',
  channelId:'2009884611',
  liffId:'2009884611-bDgDzGrN',
  liffUrl:'https://miniapp.line.me/2009884611-bDgDzGrN',
  endpoint:'https://asoboon.github.io/asoboon-stamp/miniapp-v2/develop/',
  backendUrl:'https://asoboon-miniapp-v2-develop-gateway.asoboon425.workers.dev/',
  backendEnvironment:'official-develop',
  developTestWaitType:Object.freeze({
    waitTypeId:'0042',
    label:'入場不可テスト',
    detail:'Developing専用 / AirWAIT現地受付枠'
  }),
  featureFlags:Object.freeze({
    reception:true,
    receptionCreate:true,
    callstatus:false,
    serviceMessage:false,
    timeguide:true,
    firstGuide:true,
    entryGuide:true,
    rules:true,
    stamp:false,
    omikuji:false,
    game:false,
    parking:true
  })
});
})();
