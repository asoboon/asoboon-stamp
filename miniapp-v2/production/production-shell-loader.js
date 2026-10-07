(()=>{'use strict';
if(window.ASOBOON_PRODUCTION_SHELL!==true)return;
const root=document.getElementById('app');
if(!root)return;
document.body.dataset.asoboonApp='miniapp-v2';
document.body.dataset.environment='production';
root.style.display='block';
root.innerHTML='<div style="padding:24px;text-align:center;font-family:system-ui,sans-serif;font-weight:800;color:#344">ASOBooNを読み込み中…</div>';
const CSS=[
 './miniapp-v2/shared/app.css?v=20261004-01','./miniapp-v2/shared/reception.css?v=20261004-01','./miniapp-v2/shared/callstatus.css?v=20261004-01','./miniapp-v2/shared/timeguide.css?v=20261004-01',
 './miniapp-v2/production/home-v7.css?v=20261004-01','./miniapp-v2/production/home-v7-polish.css?v=20261004-01','./miniapp-v2/production/home-v38.css?v=20261007-02','./miniapp-v2/production/surprise-vote-home-v1.css?v=20261004-01',
 './miniapp-v2/production/reception-v7.css?v=20261004-01','./miniapp-v2/production/reception-people-v26.css?v=20261004-01','./miniapp-v2/production/pages-v7.css?v=20261004-01','./miniapp-v2/production/pages-v7-polish.css?v=20261004-01','./miniapp-v2/production/pages-final-v33.css?v=20261004-01',
 './miniapp-v2/production/first-v27.css?v=20261007-02','./miniapp-v2/production/parking-v24.css?v=20261007-02','./miniapp-v2/production/entry-v25.css?v=20261007-02','./miniapp-v2/production/experience-v13.css?v=20261004-01','./miniapp-v2/production/ticket-pass-v17.css?v=20261004-01','./miniapp-v2/production/ticket-people-v28.css?v=20261004-01'
];
for(const href of CSS){const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l)}
const SCRIPTS=[
 'https://static.line-scdn.net/liff/edge/2/sdk.js',
 './miniapp-v2/shared/config-common.js?v=20261004-01','./miniapp-v2/production/env-facility.js?v=20261007-02','./miniapp-v2/production/day-rollover.js?v=20261004-01','./miniapp-v2/shared/business-day.js?v=20261004-01','./miniapp-v2/production/business-day-resilience-v23.js?v=20261004-01','./miniapp-v2/production/business-day-cutoff-v26.js?v=20261004-01','./miniapp-v2/shared/app-rules.js?v=20261004-01','./miniapp-v2/shared/reception.js?v=20261004-01','./miniapp-v2/shared/callstatus.js?v=20261004-01','./miniapp-v2/shared/timeguide.js?v=20261004-02',
 './miniapp-v2/production/app-stable-v36.js?v=20261007-02','./miniapp-v2/production/reservation-history-v22.js?v=20261004-01','./miniapp-v2/production/home-prime-v13.js?v=20261004-01','./miniapp-v2/production/home-v38.js?v=20261007-02','./miniapp-v2/production/surprise-vote-home-v1.js?v=20261004-01','./miniapp-v2/production/home-handoff-v14.js?v=20261004-01','./miniapp-v2/production/home-status-v13.js?v=20261004-01','./miniapp-v2/production/home-reservation-handoff-v26.js?v=20261004-01','./miniapp-v2/production/reception-v7.js?v=20261007-02','./miniapp-v2/production/reception-people-v26.js?v=20261004-01','./miniapp-v2/production/reception-anywhere-v22.js?v=20261004-01','./miniapp-v2/production/first-v27.js?v=20261007-02','./miniapp-v2/production/parking-v24.js?v=20261004-01','./miniapp-v2/production/entry-v25.js?v=20261004-01','./miniapp-v2/production/experience-v13.js?v=20261004-01','./miniapp-v2/production/ticket-pass-v17.js?v=20261004-01','./miniapp-v2/production/ticket-people-v28.js?v=20261004-01','./miniapp-v2/production/pages-final-v33.js?v=20261007-02'
];
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('PRODUCTION_ASSET_LOAD_FAILED:'+src));document.head.appendChild(s)});
(async()=>{try{for(const src of SCRIPTS)await load(src)}catch(e){console.error(e);root.innerHTML='<section style="padding:24px;font-family:system-ui,sans-serif"><h1>読み込みに失敗しました</h1><p>もう一度開き直してください。</p></section>'}})();
})();
