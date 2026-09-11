/* ASOBooN LINE MINI App v2 / common public config
 * No secrets here. Environment-specific identifiers belong in each env.js.
 */
(()=>{'use strict';
const ROUTES=Object.freeze({
  home:'home',
  reception:'reception',
  callstatus:'callstatus',
  timeguide:'timeguide',
  first:'first',
  entry:'entry',
  rules:'rules',
  stamp:'stamp',
  omikuji:'omikuji',
  game:'game',
  parking:'parking'
});
const CONFIG=Object.freeze({
  appName:'ASOBooN',
  version:'2.0.1-newhome',
  timeZone:'Asia/Tokyo',
  routes:ROUTES,
  prices:Object.freeze({adult:600,child:900,infant:0}),
  limits:Object.freeze({maxTotalPeople:10,childrenPerAdult:3}),
  labels:Object.freeze({
    before:'来場前',inside:'館内',
    reception:'当日受付',callstatus:'呼出状況',timeguide:'何時まであそべる？'
  })
});
window.ASOBOON_V2_COMMON=CONFIG;
})();
