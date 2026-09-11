/* ASOBooN PURPLE app rules v1.0
 * Purple/staging only. No production LIFF IDs, GAS write endpoints, API keys,
 * access tokens or notification tokens belong in this file.
 */
(()=>{
  'use strict';
  const SLOT_RULES=Object.freeze({
    '平日':Object.freeze([
      Object.freeze({waitTypeId:'0023',label:'すぐ入場',detail:'受付後、順番にご案内します',callStart:'09:30'}),
      Object.freeze({waitTypeId:'0025',label:'14:00から',detail:'14:00以降のご案内枠',callStart:'14:00'})
    ]),
    '平日特定日':Object.freeze([
      Object.freeze({waitTypeId:'0035',label:'10:15頃から',detail:'10:15頃から順番にご案内します',callStart:'10:15'}),
      Object.freeze({waitTypeId:'0037',label:'13:45頃から',detail:'13:45頃から順番にご案内します',callStart:'13:45'})
    ]),
    '土日祝日':Object.freeze([
      Object.freeze({waitTypeId:'0029',label:'10:25頃から',detail:'10:25頃から順番にご案内します',callStart:'10:25'}),
      Object.freeze({waitTypeId:'0031',label:'12:50頃から',detail:'12:50頃から順番にご案内します',callStart:'12:50'}),
      Object.freeze({waitTypeId:'0033',label:'15:15頃から',detail:'15:15頃から順番にご案内します',callStart:'15:15'})
    ]),
    '休館':Object.freeze([])
  });
  const RULES=Object.freeze({
    version:'1.0.0',
    phase:'PURPLE',
    timeZone:'Asia/Tokyo',
    operationalCutoffHour:18,
    onsiteOpen:'09:30',
    prices:Object.freeze({adult:600,child:900,infant:0}),
    limits:Object.freeze({maxTotalPeople:10,childrenPerAdult:3}),
    slotRules:SLOT_RULES,
    geofence:Object.freeze({lat:35.84895,lng:139.74345,radiusM:500,maxAccuracyM:200,verifyMaxAgeMs:2*60*1000}),
    slotsFor(businessType){return SLOT_RULES[String(businessType||'').trim()]||Object.freeze([])}
  });
  window.ASOBOON_PURPLE_APP_RULES=RULES;
})();
