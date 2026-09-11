/* ASOBooN LINE MINI App v2 / reception rules */
(()=>{'use strict';
const SLOT_RULES=Object.freeze({
  '平日':Object.freeze([
    Object.freeze({waitTypeId:'0023',label:'すぐ入場',detail:'受付後、順番にご案内します'}),
    Object.freeze({waitTypeId:'0025',label:'14:00から',detail:'14:00以降のご案内枠'})
  ]),
  '平日特定日':Object.freeze([
    Object.freeze({waitTypeId:'0035',label:'10:00の回',detail:'10:00からの3時間利用'}),
    Object.freeze({waitTypeId:'0037',label:'13:30の回',detail:'13:30からの3時間利用'})
  ]),
  '土日祝日':Object.freeze([
    Object.freeze({waitTypeId:'0029',label:'10:00の回',detail:'10:00からの2時間30分利用'}),
    Object.freeze({waitTypeId:'0031',label:'12:30の回',detail:'12:30からの2時間30分利用'}),
    Object.freeze({waitTypeId:'0033',label:'15:00の回',detail:'15:00からの2時間30分利用'})
  ]),
  '休館':Object.freeze([])
});
const RULES=Object.freeze({
  version:'1.0.0',
  timeZone:'Asia/Tokyo',
  operationalCutoffHour:18,
  onsiteOpen:'09:30',
  prices:Object.freeze({adult:600,child:900,infantFirst:900,infantAdditional:0}),
  limits:Object.freeze({maxTotalPeople:10,childrenPerAdult:3}),
  slotRules:SLOT_RULES,
  geofence:Object.freeze({lat:35.84895,lng:139.74345,radiusM:500,maxAccuracyM:200,maxAgeMs:2*60*1000}),
  slotsFor(type){return SLOT_RULES[String(type||'').trim()]||Object.freeze([])},
  priceFor({adult=0,child=0,infant=0}={}){return Math.max(0,+adult||0)*600+Math.max(0,+child||0)*900+(Math.max(0,+infant||0)>0?900:0)}
});
window.ASOBOON_V2_RULES=RULES;
})();
