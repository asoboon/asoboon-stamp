/* Korean + Kurmanji additions for previously English-fallback core labels.
 * Draft translations must be reviewed by native speakers before claiming
 * legally authoritative or culturally final text. Japanese rules stay primary.
 * No alteration to ticket status, fee calculation, AirWAIT or cancellations.
 */
(()=>{'use strict';
const entries=[
["Choose a session, then tap its card to check in. Online and LINE spaces are shown separately.","원하는 이용 회차를 확인하고 카드를 누르면 접수 화면으로 이동합니다. WEB과 LINE의 잔여 인원은 별도로 표시됩니다.","Dora xwe hilbijêrin û li kartê bixin da ku biçin rûpela qeydkirinê. Cihên mayî yên WEB û LINE cuda têne nîşandan."],
["Spaces are indicative and may change before your ticket is confirmed.","표시된 잔여 인원은 참고용이며 접수가 확정되기 전에 바뀔 수 있습니다.","Hejmara cihên mayî tenê ji bo agahiyê ye û berî piştrastkirina qeydkirinê dikare biguhere."],
["Securely verifying your LINE identity and ticket.","LINE 본인 확인 및 접수 정보를 안전하게 확인하고 있습니다.","Nasnameya we ya LINE û agahiyên qeydkirinê bi ewlehî têne kontrolkirin."],
["While open, updates run every 8–45 seconds depending on status. During congestion we retry more slowly. Updates stop in the background; LINE call notifications remain important.","화면이 열려 있는 동안 상태에 따라 약 8~45초마다 확인합니다. 접속이 몰리면 확인 간격을 늘려 재시도합니다. 화면을 닫으면 통신이 중지되므로 LINE 호출 알림을 확인해 주세요.","Dema rûpel vekirî be, li gor rewşê her 8–45 çirkeyan tê kontrolkirin. Dema qelebalixiyê em hêdîtir dîsa kontrol dikin. Dema rûpel were girtin nûkirin disekine; agahdariyên bangkirina LINE bişopînin."],
["Today's schedule could not be loaded. Check-in is paused for safety.","오늘의 영업 정보를 불러오지 못했습니다. 안전을 위해 접수 확정을 일시 중지했습니다.","Bernameya vekirina îro nehate barkirin. Ji bo ewlehiyê piştrastkirina qeydkirinê hatiye rawestandin."],
["Move blocks through the jungle","블록을 움직여 정글을 탐험하세요","Blokan biguhezînin û di daristanê de pêşve biçin"],
["BOON JUMP","BOON JUMP","BOON JUMP"],
["Three taps to jump farther","세 번 탭하여 더 멀리 점프하세요","Sê caran li ekranê bixin da ku dûrtir baz bidin"],
["BOON RUN","BOON RUN","BOON RUN"],
["Run and dodge obstacles","달리면서 장애물을 피하세요","Bazdin û ji astengiyan dûr bikevin"],
["See today's fortune","오늘의 운세 보기","Bextê xwe yê îro bibînin"],
["Today's LINE check-in","오늘의 LINE 접수","Qeydkirina LINE ya îro"],
["After 9:30, choose your session and party size to get a ticket.","9:30 이후 이용 회차와 인원을 선택하여 접수해 주세요.","Piştî 9:30, dora lîstinê û hejmara kesan hilbijêrin da ku qeydkirinê bikin."],
["Choose session","이용 회차 선택","Dora lîstinê hilbijêrin"],
["No need to stand in line after getting a ticket","접수 후에는 줄을 서서 기다리지 않아도 됩니다","Piştî girtina hejmarê ne hewce ye di rêzê de bisekinin"],
["Check your place in line on the queue status screen. LINE will notify you when called.","호출 현황 화면에서 대기 순서를 확인할 수 있습니다. 차례가 되면 LINE으로 알려드립니다.","Rêza xwe li rûpela rewşa bangkirinê kontrol bikin. Dema rêza we were, LINE dê we agahdar bike."],
["You can check in now.","지금 접수할 수 있습니다.","Niha dikarin qeydkirinê bikin."],
["Use − / + to set the number of people","− / + 버튼으로 인원을 선택하세요","Bi − / + hejmara kesan hilbijêrin"],
["Parents / accompanying adults","보호자·동반 성인","Dêûbav / mezinên hevdem"],
["6 months to grade 6","생후 6개월부터 초등학교 6학년까지","Ji 6 mehan heta pola şeşem a dibistana seretayî"],
["Under 6 months","생후 6개월 미만","Di bin 6 mehan de"],
["¥0–900","0~900엔","0–900 yen"],
["Fee for infants under 6 months","생후 6개월 미만 영아 요금","Biha ji bo zarokên di bin 6 mehan de"],
["If at least one child is 6 months or older, there is no extra charge for infants under 6 months. If only infants aged 0–5 months visit, the first costs ¥900 and additional infants are free.","생후 6개월 이상 어린이가 한 명 이상 있으면 6개월 미만 영아에게 추가 요금이 없습니다. 0~5개월 영아만 방문하는 경우 첫째는 900엔, 둘째부터 무료입니다.","Ger herî kêm zarokek 6 mehî an mezintir hebe, ji bo zarokên di bin 6 mehan de pereyê zêde nayê xwestin. Ger tenê zarokên 0–5 mehî tên, ji bo yê yekem 900 yen e û yên din belaş in."],
["Review details","내용 확인","Agahiyan kontrol bikin"],
["Ticket information","접수 정보","Agahiyên qeydkirinê"],
["Visit date","이용일","Roja serdanê"],
["Party details","인원 내역","Hûrguliyên kesan"],
["Total","합계","Bi tevahî"],
["people","명","kes"],
["groups","팀","kom"],
["groups total","전체 팀 수","Hejmara koman"],
["LINE notifications:","LINE 알림:","Agahdariyên LINE:"],
["Your queue status updates automatically.","대기 순서는 자동으로 업데이트됩니다.","Rewşa rêza we bixweber nû dibe."],
["Your turn is getting closer","차례가 가까워지고 있습니다","Rêza we nêzîk dibe"],
["LINE will notify you when your turn comes.","차례가 되면 LINE으로 알려드립니다.","Dema rêza we were, LINE dê we agahdar bike."],
["Refresh queue status","호출 현황 새로고침","Rewşa bangkirinê nû bikin"],
["10:00 session","10:00 회차","Dora 10:00"],
["12:30 session","12:30 회차","Dora 12:30"],
["15:00 session","15:00 회차","Dora 15:00"],
["Weekends and holidays","주말 및 공휴일","Dawiya hefteyê û rojên betlanê"],
["Kawaguchi Highway Oasis","가와구치 하이웨이 오아시스","Kawaguchi Highway Oasis"],
["ASOBooN office 048-420-9780","ASOBooN 사무실 048-420-9780","Ofîsa ASOBooN 048-420-9780"],
["This session is unavailable. Please check the latest availability.","선택한 회차는 현재 이용할 수 없습니다. 최신 접수 현황을 확인해 주세요.","Ev dora lîstinê niha berdest nîne. Ji kerema xwe cihên mayî yên herî nû kontrol bikin."],
["This is not a session for today. Reopen the app and check the latest availability.","선택한 회차는 오늘의 회차가 아닙니다. 앱을 다시 열고 최신 접수 현황을 확인해 주세요.","Ev ne dora îro ye. Sepanê dîsa vekin û cihên mayî yên herî nû kontrol bikin."],
["The selected session does not match the check-in method. Reopen the screen.","선택한 회차와 접수 방법이 일치하지 않습니다. 화면을 다시 열어 주세요.","Dora hilbijartî bi rêbaza qeydkirinê re li hev nayê. Rûpelê dîsa vekin."],
["Check-in is unavailable at this time.","현재 접수할 수 없습니다.","Niha qeydkirin berdest nîne."],
["This party size cannot be registered. Check the number of people.","이 인원으로는 접수할 수 없습니다. 인원수를 확인해 주세요.","Bi vê hejmara kesan qeydkirin nayê kirin. Hejmara kesan kontrol bikin."],
["The chosen session could not be registered. Check current availability and try again.","선택한 회차의 접수를 처리하지 못했습니다. 최신 잔여 인원을 확인한 뒤 다시 시도해 주세요.","Qeydkirina dora hilbijartî nehat temamkirin. Cihên mayî kontrol bikin û dîsa biceribînin."],
["Check-in is currently closed.","현재 접수 시간 외입니다.","Niha demê qeydkirinê nîne."],
["This session is not accepting tickets right now.","이 회차는 현재 접수를 받지 않습니다.","Ev dora niha qeydkirinê qebûl nake."],
["The selected session does not meet the minimum number of guests.","선택한 회차의 최소 인원 조건을 충족하지 못했습니다.","Ev dora şertê herî kêm yê hejmara kesan pêk nayîne."],
["Unable to verify your check-in details. Reopen the screen and try again.","접수 내용을 확인할 수 없습니다. 화면을 다시 열고 시도해 주세요.","Agahiyên qeydkirina we nehatin piştrastkirin. Rûpelê dîsa vekin û biceribînin."],
["Could not confirm your ticket.","접수를 확정하지 못했습니다.","Qeydkirina we nehat piştrastkirin."],
["Cancellation is taking longer than expected. Do not book again; check the latest ticket status.","취소 처리에 시간이 걸리고 있습니다. 다시 접수하지 말고 최신 접수 상태를 확인해 주세요.","Betalkirin dirêjtir dibe. Qeydkirina nû nekin; rewşa herî nû ya qeydkirinê kontrol bikin."],
["Could not verify the cancellation result. Refresh your ticket status to check.","취소 결과를 확인하지 못했습니다. 접수 상태를 새로고침하여 확인해 주세요.","Encama betalkirinê nehat piştrastkirin. Rewşa qeydkirinê nû bikin û kontrol bikin."],
["Cancellation was unsuccessful. Refresh ticket status and try again.","취소하지 못했습니다. 접수 상태를 새로고침하고 다시 시도해 주세요.","Betalkirin bi ser neket. Rewşa qeydkirinê nû bikin û dîsa biceribînin."],
["This ticket has already been admitted and cannot be canceled.","이미 입장 안내가 완료되어 이 접수는 취소할 수 없습니다.","Ji bo vê hejmarê rêberiya têketinê hatiye kirin, ji ber vê yekê nayê betalkirin."],
["Staff are processing your ticket. Please ask staff for help.","직원이 접수를 처리 중입니다. 직원에게 문의해 주세요.","Karmend qeydkirina we pêvajoyê dikin. Ji kerema xwe ji karmendan bipirsin."],
["This ticket has already been canceled.","이 접수는 이미 취소되었습니다.","Ev qeydkirin berê hatiye betalkirin."],
["Please reopen the Mini App to refresh identity verification and try again.","본인 확인 정보를 새로고침하려면 미니앱을 다시 열고 시도해 주세요.","Ji bo nûkirina piştrastkirina nasnameyê sepanê dîsa vekin û biceribînin."],
["Could not verify cancellation details. Please try again shortly.","취소 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.","Agahiyên betalkirinê nehatin kontrolkirin. Ji kerema xwe piştî demeke kurt dîsa biceribînin."],
["Could not refresh","새로고침하지 못했습니다","Nûkirin bi ser neket"],
["High traffic. Retrying in about 90 seconds.","접속이 몰려 약 90초 후 다시 확인합니다.","Ji ber qelebalixiya girêdanê piştî nêzîkî 90 çirkeyan dîsa tê kontrolkirin."],
["Check your connection and try again.","인터넷 연결을 확인하고 다시 시도해 주세요.","Girêdana xwe kontrol bikin û dîsa biceribînin."]
/* MORE_ROWS */
];
const table=()=>window.ASOBOON_I18N_DICTIONARY;
let done=false,last={};
function apply(){
 if(done)return true;
 const dict=table();
 if(!dict||Object.keys(dict).length<480)return false;
 const byEnglish=new Map();
 for(const entry of Object.values(dict)){
  if(!entry||typeof entry.en!=='string')continue;
  if(!byEnglish.has(entry.en))byEnglish.set(entry.en,[]);
  byEnglish.get(entry.en).push(entry);
 }
 const missing=[];
 let filled=0;
 for(const [english,korean,kurmanji] of entries){
  const items=byEnglish.get(english)||[];
  if(!items.length){missing.push(english);continue;}
  for(const entry of items){
   if(!entry.ko){entry.ko=korean;filled++;}
   if(!entry.kmr){entry.kmr=kurmanji;filled++;}
  }
 }
 done=true;
 last={mapped:entries.length,filled,unmatched:missing,
  keys:Object.keys(dict).length,
  missingKo:Object.values(dict).filter(v=>!v.ko).length,
  missingKmr:Object.values(dict).filter(v=>!v.kmr).length};
 window.ASOBOON_KO_KMR_COVERAGE=Object.freeze({...last});
 window.dispatchEvent(new Event('asoboon:v2-route-rendered'));
 return true;
}
let attempts=0;
function retry(){if(!apply()&&attempts++<60)setTimeout(retry,120)}
window.addEventListener('load',retry);
retry();
})();
