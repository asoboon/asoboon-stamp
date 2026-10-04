(()=>{'use strict';
const slots=Object.freeze({
 '平日':Object.freeze([{waitTypeId:'0023',label:'午前枠',detail:'Reviewテスト受付'},{waitTypeId:'0025',label:'午後枠',detail:'Reviewテスト受付'}]),
 '平日特定日':Object.freeze([{waitTypeId:'0035',label:'10:00回',detail:'Reviewテスト受付'},{waitTypeId:'0037',label:'13:30回',detail:'Reviewテスト受付'}]),
 '土日祝日':Object.freeze([{waitTypeId:'0029',label:'10:00回',detail:'Reviewテスト受付'},{waitTypeId:'0031',label:'12:30回',detail:'Reviewテスト受付'},{waitTypeId:'0033',label:'15:00回',detail:'Reviewテスト受付'}]),
 '休館':Object.freeze([])
});
window.ASOBOON_V2_RULES=Object.freeze({version:'1.0-review',lineReceptionOpen:'00:00',onsiteOpen:'00:00',limits:Object.freeze({maxTotalPeople:10,childrenPerAdult:3}),slotsFor:(type)=>slots[String(type)]||Object.freeze([]),priceFor:({adult=1,child=0,infant=0}={})=>Number(adult)*600+Number(child)*900+(Number(infant)>0?900:0)});
})();
