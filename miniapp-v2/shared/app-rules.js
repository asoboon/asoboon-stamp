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
const PRICES=Object.freeze({adult:600,child:900,infantFirstWhenNoPaidChild:900,infantAdditional:0});
function count(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0}
function priceFor({adult=0,child=0,infant=0}={}){
  const a=count(adult),c=count(child),i=count(infant);
  /* 0〜5か月は「お子さま2人目以降」に当たれば無料。
   * 6か月以上の有料こどもが1人以上いる場合、0〜5か月は全員無料。
   * 0〜5か月だけの場合は、最初の1人のみ900円、2人目以降は無料。
   */
  const chargedInfants=(i>0&&c===0)?1:0;
  return a*PRICES.adult+c*PRICES.child+chargedInfants*PRICES.infantFirstWhenNoPaidChild;
}
const RULES=Object.freeze({
  version:'1.0.2',
  timeZone:'Asia/Tokyo',
  operationalCutoffHour:18,
  onsiteOpen:'09:30',
  prices:PRICES,
  limits:Object.freeze({maxTotalPeople:10,childrenPerAdult:3}),
  slotRules:SLOT_RULES,
  geofence:Object.freeze({lat:35.84895,lng:139.74345,radiusM:500,maxAccuracyM:200,maxAgeMs:2*60*1000}),
  slotsFor(type){return SLOT_RULES[String(type||'').trim()]||Object.freeze([])},
  priceFor
});
window.ASOBOON_V2_RULES=RULES;
})();
