/* ASOBooN LINE MINI App v2 / Production dark launch
 * Public identifiers only. Secrets never belong in browser code.
 * Reception creation remains intentionally disabled until the dedicated
 * Production Worker + D1 + LINE service-message path passes promotion gates.
 */
(()=>{'use strict';
window.ASOBOON_V2_ENV=Object.freeze({
  environment:'production',
  environmentLabel:'OFFICIAL',
  storageNamespace:'production',
  channelId:'2009884613',
  liffId:'2009884613-ELc6kolf',
  liffUrl:'https://miniapp.line.me/2009884613-ELc6kolf',
  endpoint:'https://asoboon.github.io/asoboon-stamp/home.html',
  assetBase:'https://asoboon.github.io/asoboon-stamp/miniapp-v2/production/',
  siteBase:'https://asoboon.github.io/asoboon-stamp/',
  backendUrl:'',
  backendEnvironment:'official-production',
  lineStoreOnly:true,
  officialHome:true,
  operationalFallbacks:Object.freeze({
    enabled:true,
    receptionUrl:'https://airwait.jp/WCSP/storeDetail?storeNo=AKR2298124918',
    callstatusUrl:'https://asoboon.github.io/asoboon-stamp/callstatus.html'
  }),
  featureFlags:Object.freeze({
    reception:true,
    receptionCreate:false,
    callstatus:true,
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
