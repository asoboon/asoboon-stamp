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
,
["Could not verify the ticket result.","접수 결과를 확인할 수 없습니다.","Encama qeydkirinê nehat piştrastkirin."],
["Checking your previous ticket. Do not request another ticket.","이전 접수 결과를 확인하고 있습니다. 새로 접수하지 마세요.","Encama qeydkirina berê tê kontrolkirin. Qeydkirineke nû nekin."],
["Ticket confirmation is taking longer than expected.","접수 확인에 예상보다 시간이 걸리고 있습니다.","Piştrastkirina qeydkirinê ji ya texmînkirî dirêjtir dibe."],
["Check-in steps","접수 절차","Gavên qeydkirinê"],
["Checking available check-in options…","접수 가능한 항목을 확인하고 있습니다…","Vebijarkên qeydkirinê yên berdest têne kontrolkirin…"],
["Could not load check-in information. Reopen the app and try again.","접수 정보를 불러올 수 없습니다. 앱을 다시 열고 시도해 주세요.","Agahiyên qeydkirinê nehatin barkirin. Sepanê dîsa vekin û biceribînin."],
["Check-in is temporarily unavailable. Please try again later.","현재 접수를 확정할 수 없습니다. 잠시 후 다시 시도해 주세요.","Niha piştrastkirina qeydkirinê ne gengaz e. Ji kerema xwe piştre dîsa biceribînin."],
["The facility is closed today.","오늘은 휴관일입니다.","Navend îro girtî ye."],
["For on-site LINE check-in, your location near ASOBooN must be confirmed.","현장 LINE 접수는 ASOBooN 근처에 있다는 위치 확인이 필요합니다.","Ji bo qeydkirina LINE ya li cihê navendê, divê cihê we yê nêzî ASOBooN were piştrastkirin."],
["Preparing check-in…","접수를 준비하고 있습니다…","Qeydkirin tê amadekirin…"],
["Loading today's opening details.","오늘의 영업 정보를 불러오는 중입니다.","Agahiyên vekirina îro têne barkirin."],
["Within about 5 minutes","약 5분 이내","Di nêzîkî 5 deqeyan de"],
["Today's hours and play time","오늘의 영업시간 및 이용시간","Demjimêrên vekirina îro û dema lîstinê"],
["Quick tools","자주 쓰는 기능","Amûrên bilez"],
["Operator, contact and privacy information","운영·문의·개인정보 안내","Agahiyên rêvebir, pêwendî û parastina agahiyên kesane"],
["Please use the regular online check-in for now.","지금은 기존 WEB 접수를 이용해 주세요.","Ji kerema xwe niha qeydkirina WEB ya asayî bikar bînin."],
["Open online check-in","WEB 접수 열기","Qeydkirina WEB vekin"],
["View call status","호출 현황 보기","Rewşa bangkirinê bibînin"],
["Waiting to be called","호출 대기 중","Li benda bangkirinê"],
["View details","자세히 보기","Hûrguliyan bibînin"],
["Being called","호출 중","Bang li we tê kirin"],
["View ticket number","접수번호 보기","Hejmara qeydkirinê bibînin"],
["Already admitted","이미 안내 완료","Berê hatiye rêberkirin"],
["Check in for another session","다른 회차 접수하기","Ji bo doreke din qeydkirinê bikin"],
["Canceled","취소됨","Hatiye betalkirin"],
["Check-in closed","접수 종료","Qeydkirin girtî ye"],
["Go to visitor guide","이용 안내로 이동","Herin rêbernameya serdanê"],
["Unavailable","확인할 수 없음","Berdest nîne"],
["Entered","입력 완료","Hatiye têxistin"],
["No time limit","시간제한 없음","Sînora demê tune ye"],
["Until closing time","폐관 시각까지","Heta dema girtinê"],
["Play until","이용 가능 종료 시각","Heta vê demê bilîzin"],
["Open check-in","접수 화면 열기","Rûpela qeydkirinê vekin"],
["Immediate entry","즉시 입장","Têketina yekser"],
["Go to online check-in","WEB 접수 화면으로 이동","Herin qeydkirina WEB"],
["Checking online availability","WEB 접수 잔여 인원 확인 중","Cihên mayî yên WEB têne kontrolkirin"],
["Online and LINE spaces left","WEB 및 LINE 잔여 인원","Cihên mayî yên WEB û LINE"],
["High traffic; waiting to check again automatically","접속이 많아 자동 재확인을 기다리는 중입니다","Girêdan pir in; li benda kontrola bixweber a din e"],
["This session is unavailable. Reopen the app to check the latest status.","선택한 회차는 현재 이용할 수 없습니다. 최신 정보를 확인하려면 앱을 다시 열어 주세요.","Ev dora niha berdest nîne. Ji bo rewşa herî nû sepanê dîsa vekin."],
["The system returned an error. No ticket was issued. Reopen the screen and try again.","접수 시스템에서 오류가 발생했습니다. 접수번호는 발급되지 않았습니다. 화면을 다시 열고 시도해 주세요.","Pergala qeydkirinê xeletiyek vegerand. Hejmara qeydkirinê nehate dayîn. Rûpelê dîsa vekin û biceribînin."],
["Check-in progress","접수 진행 상황","Pêşveçûna qeydkirinê"],
["Steps to get a ticket","접수번호 발급 절차","Gavên wergirtina hejmarê"],
["Checking opening day and party size.","영업일과 인원수를 확인하고 있습니다.","Roja vekirinê û hejmara kesan têne kontrolkirin."],
["Waiting for the registration system","접수 시스템의 응답을 기다리는 중입니다","Li benda bersiva pergala qeydkirinê"],
["Confirmation may take longer when busy.","혼잡할 때는 확인에 시간이 더 걸릴 수 있습니다.","Dema qelebalixiyê piştrastkirin dikare dirêjtir bibe."],
["Requesting your ticket number","접수번호 발급을 요청하고 있습니다","Hejmara qeydkirinê tê xwestin"],
["Waiting for LINE notification setup and the ticket response.","LINE 알림 준비와 접수 결과를 기다리고 있습니다.","Li benda amadekirina agahdariya LINE û bersiva qeydkirinê ne."],
["Verifying your ticket result","접수 결과를 확인하고 있습니다","Encama qeydkirinê tê piştrastkirin"],
["The response is delayed. We are checking the same request ID without sending another ticket.","응답이 지연되어 새 접수를 보내지 않고 동일한 요청 ID로 결과를 확인하고 있습니다.","Bersiv dereng dikeve. Bêyî şandina qeydkirineke nû, em bi heman nasnameya daxwazê encamê kontrol dikin."],
["Checking your ticket details.","접수 내용을 확인하고 있습니다.","Agahiyên qeydkirina we têne kontrolkirin."],
["We are checking the same ticket without requesting another.","새로 접수하지 않고 기존 접수 결과만 확인하고 있습니다.","Bêyî daxwaza qeydkirineke nû, em encama heman qeydkirinê kontrol dikin."],
["seconds elapsed","초 경과","çirke derbas bûn"],
["The connection timed out.","연결 시간이 초과되었습니다.","Dema girêdanê qediya."],
["Ticket status check timed out.","접수 상태 확인 시간이 초과되었습니다.","Dema kontrolkirina rewşa qeydkirinê qediya."],
["Unable to verify your LINE account.","LINE 본인 확인 정보를 가져올 수 없습니다.","Nasnameya we ya LINE nehat piştrastkirin."],
["The ticket request timed out. We will check its result.","접수 요청 시간이 초과되었습니다. 결과를 확인하겠습니다.","Dema daxwaza qeydkirinê qediya. Emê encamê kontrol bikin."],
["LINE connection could not be verified. Close and reopen this Mini App.","LINE 연결을 확인할 수 없습니다. 미니앱을 닫았다가 다시 열어 주세요.","Girêdana LINE nehat piştrastkirin. Sepana biçûk bigirin û dîsa vekin."],
["Open this page from the LINE Mini App.","LINE 미니앱에서 이 페이지를 열어 주세요.","Vê rûpelê ji sepana biçûk a LINE vekin."],
["Unable to verify LINE sign-in.","LINE 로그인 여부를 확인할 수 없습니다.","Têketina LINE nehat piştrastkirin."],
["Checking remaining LINE spaces…","LINE 접수 잔여 인원을 확인하고 있습니다…","Cihên mayî yên qeydkirina LINE têne kontrolkirin…"],
["Could not check available spaces. You can still select a session.","잔여 인원을 확인할 수 없습니다. 이용 회차는 선택할 수 있습니다.","Hejmara cihên mayî nehat kontrolkirin. Hûn dikarin dora lîstinê hilbijêrin."],
["Location services are unavailable on this device.","이 기기에서는 위치 정보를 이용할 수 없습니다.","Di vê amûrê de karûbarên cihê berdest nînin."],
["Checking your location…","현재 위치를 확인하고 있습니다…","Cihê we tê kontrolkirin…"],
["Could not verify your location. Check location permissions.","위치를 확인할 수 없습니다. 위치 정보 권한을 확인해 주세요.","Cihê we nehat piştrastkirin. Destûra cihê kontrol bikin."],
["Checking LINE, opening calendar and available sessions…","LINE 연결, 영업 달력 및 접수 회차를 확인하고 있습니다…","Girêdana LINE, salnameya vekirinê û dorên berdest têne kontrolkirin…"]
,
["LINE verification is taking too long. Close and reopen this Mini App.","LINE 연결 확인에 시간이 오래 걸리고 있습니다. 미니앱을 닫았다가 다시 열어 주세요.","Piştrastkirina LINE zêde dirêj dibe. Sepana biçûk bigirin û dîsa vekin."],
["Opening calendar request timed out.","영업 달력 조회 시간이 초과되었습니다.","Dema daxwaza salnameya vekirinê qediya."],
["Unable to load the opening calendar.","영업 달력을 불러올 수 없습니다.","Salnameya rojên vekirî nehate barkirin."],
["Fetching available sessions timed out.","접수 회차 조회 시간이 초과되었습니다.","Dema standina dorên berdest qediya."],
["Registration gateway is unavailable.","접수 연결 서비스가 설정되어 있지 않습니다.","Dergeha qeydkirinê berdest nîne."],
["Unable to verify LINE connection.","LINE 연결을 확인할 수 없습니다.","Girêdana LINE nehat piştrastkirin."],
["No LINE sessions are available right now. Please check AirWAIT's latest status.","현재 LINE으로 접수 가능한 회차가 없습니다. AirWAIT의 최신 접수 현황을 확인해 주세요.","Niha dora qeydkirina LINE ya berdest tune ye. Rewşa herî nû ya AirWAIT kontrol bikin."],
["No sessions are available right now. Please check AirWAIT status.","현재 접수 가능한 회차가 없습니다. AirWAIT의 접수 현황을 확인해 주세요.","Niha dorên berdest tune ne. Rewşa AirWAIT kontrol bikin."],
["LINE identity, opening day and connection were checked. You may register.","LINE 본인 확인, 영업일 및 연결 확인이 완료되어 접수할 수 있습니다.","Nasnameya LINE, roja vekirinê û girêdan hatin kontrolkirin. Hûn dikarin qeydkirinê bikin."],
["Check-in is paused because required verification is incomplete.","필수 확인이 완료되지 않아 접수를 일시 중지했습니다.","Ji ber ku kontrolên pêwîst nehatine temamkirin, qeydkirin hatiye rawestandin."],
["Only the existing request is being rechecked; no new ticket request will be sent.","기존 접수 결과만 다시 확인하며 새로운 접수 요청은 보내지 않습니다.","Tenê daxwaza heyî dîsa tê kontrolkirin; daxwazeke nû nayê şandin."],
["Checking your ticket result. Do not request another ticket.","접수 결과를 확인하고 있습니다. 새로 접수하지 마세요.","Encama qeydkirina we tê kontrolkirin. Qeydkirineke nû nekin."],
["Checking your ticket safely. Do not request another ticket.","접수 결과를 안전하게 확인하고 있습니다. 새로 접수하지 마세요.","Encama qeydkirina we bi ewlehî tê kontrolkirin. Qeydkirineke nû nekin."],
["Checking the previous ticket result.","이전 접수 결과를 확인하고 있습니다.","Encama qeydkirina berê tê kontrolkirin."],
["Rechecking the previous ticket. Do not submit another request.","이전 접수 결과를 다시 확인하고 있습니다. 새 요청을 보내지 마세요.","Qeydkirina berê dîsa tê kontrolkirin. Daxwazeke nû neşînin."],
["Checking ticket processing.","접수 처리 상태를 확인하고 있습니다.","Pêvajoya qeydkirinê tê kontrolkirin."],
["We are continuing to check the existing request. Do not create another ticket.","기존 접수 요청의 결과를 계속 확인하고 있습니다. 새 접수를 만들지 마세요.","Em encama daxwaza heyî didomînin kontrolkirin. Qeydkirineke nû çênekin."],
["Checking the existing ticket is taking time. Do not register again.","기존 접수 확인에 시간이 걸리고 있습니다. 다시 접수하지 마세요.","Kontrolkirina qeydkirina heyî dirêj dibe. Dîsa qeydkirinê nekin."],
["No ticket was issued. Check your details and try again.","접수가 완료되지 않았습니다. 내용을 확인하고 다시 시도해 주세요.","Hejmara qeydkirinê nehate dayîn. Agahiyên xwe kontrol bikin û dîsa biceribînin."],
["The ticket result could not be automatically confirmed.","접수 결과를 자동으로 확정하지 못했습니다.","Encama qeydkirinê bixweber nehat piştrastkirin."],
["Do not register again. Use the button below to recheck the same ticket.","새로 접수하지 마세요. 아래 버튼으로 동일한 접수 결과를 다시 확인해 주세요.","Dîsa qeydkirinê nekin. Bi bişkoja jêr encama heman qeydkirinê dîsa kontrol bikin."],
["Automatic confirmation failed. Use the “Recheck ticket result” button below.","자동 확인에 실패했습니다. 아래의 ‘접수 결과 다시 확인’ 버튼을 눌러 주세요.","Piştrastkirina bixweber bi ser neket. Bişkoja ‘Encama qeydkirinê dîsa kontrol bike’ ya jêr bikar bînin."],
["The ticket result is not yet available.","접수 결과를 아직 확인할 수 없습니다.","Encama qeydkirinê hîn berdest nîne."],
["The ticket result is still unknown. Tap “Recheck ticket result” below.","접수 결과를 아직 확인하지 못했습니다. 아래의 ‘접수 결과 다시 확인’을 눌러 주세요.","Encama qeydkirinê hîn nayê zanîn. Li ‘Encama qeydkirinê dîsa kontrol bike’ ya jêr bixin."],
["LINE notification setup could not be verified. Do not resubmit; reopen the Mini App.","LINE 알림 준비 상태를 확인하지 못했습니다. 다시 접수하지 말고 미니앱을 다시 열어 주세요.","Amadekirina agahdariya LINE nehat piştrastkirin. Daxwaza nû neşînin; sepanê dîsa vekin."],
["Final verification of your ticket details…","접수 내용을 최종 확인하고 있습니다…","Kontrola dawî ya agahiyên qeydkirinê…"],
["The business day has changed. Please reopen check-in.","영업일이 변경되었습니다. 접수 화면을 다시 열어 주세요.","Roja xebatê guheriye. Ji kerema xwe rûpela qeydkirinê dîsa vekin."],
["Location verification is required.","위치 확인이 필요합니다.","Piştrastkirina cihê pêwîst e."],
["Requesting your ticket number…","접수번호 발급을 요청하고 있습니다…","Hejmara qeydkirinê tê xwestin…"],
["Automatic updates stopped","자동 업데이트 중지","Nûkirina bixweber rawestiya"],
["About every 6 seconds","약 6초마다","Nêzîkî her 6 çirkeyan"],
["About every 8 seconds","약 8초마다","Nêzîkî her 8 çirkeyan"],
["About every 15 seconds","약 15초마다","Nêzîkî her 15 çirkeyan"],
["About every 30 seconds","약 30초마다","Nêzîkî her 30 çirkeyan"],
["About every 45 seconds","약 45초마다","Nêzîkî her 45 çirkeyan"],
["About every 90 seconds","약 90초마다","Nêzîkî her 90 çirkeyan"],
["Estimated call time","예상 호출 시간","Dema texmînkirî ya bangkirinê"],
["Canceling…","취소 처리 중…","Tê betalkirin…"],
["Today's registration has ended","오늘의 접수가 종료되었습니다","Qeydkirina îro qediya"],
["Estimated before calling starts","호출 시작 전 예상 시간","Texmîna berî destpêka bangkirinê"],
["Estimated from people ahead","앞선 대기 팀 기준 예상 시간","Texmîna li gor komên li pêşiya we"],
["Estimated from the session's call start time and queue order. Actual calling may be earlier or later.","회차의 호출 시작 시각과 접수 순서로 계산한 예상 시간입니다. 실제 호출 시각은 달라질 수 있습니다.","Ev dem ji destpêka bangkirina dorê û rêza qeydkirinê hatiye texmînkirin. Dema rastîn dikare zûtir an derengtir be."],
["Estimated from the current queue. Actual timing may change. Watch LINE notifications and the latest status.","현재 대기 팀 수를 기준으로 한 예상 시간입니다. 실제 시간은 달라질 수 있으니 LINE 알림과 최신 현황을 확인해 주세요.","Ev texmîn li gor rêza bendê ya niha ye. Dem dikare biguhere. Agahdariyên LINE û rewşa herî nû bişopînin."],
["Connection is unstable.","통신 연결이 불안정합니다.","Girêdan ne aram e."],
["Automatic updates are active.","자동 업데이트가 작동 중입니다.","Nûkirina bixweber çalak e."],
["Showing the latest verified result.","마지막으로 확인된 결과를 표시하고 있습니다.","Encama herî dawî ya piştrastkirî tê nîşandan."],
["Preparing automatic updates.","자동 업데이트를 준비하고 있습니다.","Nûkirina bixweber tê amadekirin."],
["Checking ticket status","접수 상태를 확인하고 있습니다","Rewşa qeydkirinê tê kontrolkirin"],
["Session","회차","Dora lîstinê"],
["Queue status service is not configured.","호출 현황 서비스가 설정되지 않았습니다.","Karûbarê rewşa bangkirinê nehat saz kirin."],
["Unable to read the queue status response.","호출 현황 응답을 읽을 수 없습니다.","Bersiva rewşa bangkirinê nayê xwendin."],
["Unable to recover your ticket information.","접수 정보를 복원하지 못했습니다.","Agahiyên qeydkirinê nehatin vegerandin."],
["Unable to start queue status verification.","호출 현황 확인을 시작할 수 없습니다.","Kontrolkirina rewşa bangkirinê nayê destpêkirin."],
["High traffic. Waiting before checking again automatically.","접속이 많아 자동 재확인을 기다리고 있습니다.","Ji ber qelebalixiyê li benda kontrola bixweber a din e."],
["No ticket found for today","오늘 접수한 내역이 없습니다","Qeydkirina îro nehat dîtin"],
["Once you get a ticket, its call status will appear here automatically.","접수가 완료되면 이곳에 호출 현황이 자동으로 표시됩니다.","Dema ku hûn hejmarê bistînin, rewşa bangkirina wê li vir bixweber xuya dibe."],
["If you have a ticket but cannot see it, tell staff your ticket number.","접수번호가 있는데 화면에 보이지 않는다면 직원에게 번호를 알려 주세요.","Ger hejmara we hebe lê xuya nebe, hejmara qeydkirinê ji karmendan re bibêjin."],
["Immediate entry (weekday)","즉시 입장(평일)","Têketina yekser (rojên hefteyê)"],
["From 10:15 (special weekday)","10:15부터(특정 평일)","Ji 10:15 ve (roja taybet a hefteyê)"],
["From 13:45 (special weekday)","13:45부터(특정 평일)","Ji 13:45 ve (roja taybet a hefteyê)"],
["Entry around 10:25 (weekend/holiday)","약 10:25 입장(주말·공휴일)","Têketin nêzîkî 10:25 (dawiya hefteyê / betlan)"],
["Entry around 12:50 (weekend/holiday)","약 12:50 입장(주말·공휴일)","Têketin nêzîkî 12:50 (dawiya hefteyê / betlan)"],
["Entry around 15:15 (weekend/holiday)","약 15:15 입장(주말·공휴일)","Têketin nêzîkî 15:15 (dawiya hefteyê / betlan)"],
["The registration result is invalid.","접수 결과가 올바르지 않습니다.","Encama qeydkirinê ne derbasdar e."],
["Queue status check timed out.","호출 현황 확인 시간이 초과되었습니다.","Dema kontrolkirina rewşa bangkirinê qediya."],
["Please reopen the LINE Mini App.","LINE 미니앱을 다시 열어 주세요.","Ji kerema xwe sepana biçûk a LINE dîsa vekin."]


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
 // The published dictionary creates shortened label aliases before this
 // supplement runs. Reuse the verified full-phrase translation for those aliases.
 const aliases={
  'あそび':'あそびコンテンツ',
  '受付の流れ':'受付から入場まで',
  '駐車場と道順':'駐車場・行き方',
  '遊べる時間の目安を表示':'入場時刻から終了時刻の目安がわかります',
  'ブロック勝負':'ブロックを動かしてジャングル攻略',
  '3タップ勝負':'3タップで飛距離勝負',
  '障害物を回避':'障害物をかわして走ろう',
  '運勢を占う':'今日の運勢をチェック',
  '残人数は目安です。受付前に変わることがあります。':'表示人数は確認時点の目安です。受付確定までに変わる場合があります。'
 };
 for(const [short,original] of Object.entries(aliases)){
  const target=dict[short],source=dict[original];
  if(!target||!source)continue;
  for(const code of ['ko','kmr'])if(!target[code]&&source[code]){target[code]=source[code];filled++;}
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
/* Last-mile HOME labels do not use the 487-key dictionary: they are
 * dynamic clock fragments, conditional no-ticket labels and composite
 * accessibility labels. Correct only these observed literals across locales.
 * Cached raw Japanese is restored on Japanese selection; queue data untouched. */
const lastmile={
 '受付なし':{en:'No ticket required','zh-CN':'无需取号',vi:'Không cần lấy số',ne:'टिकट लिनु पर्दैन',ko:'접수 불필요',kmr:'Qeydkirin ne hewce ye'},
 '駐車場・アクセスを見る':{en:'Parking and directions','zh-CN':'查看停车场与路线',vi:'Xem bãi đỗ xe và đường đi',ne:'पार्किङ र बाटो हेर्नुहोस्',ko:'주차장·오시는 길 보기',kmr:'Park û rêyan bibînin'},
 'LINEミニアプリの受付へ':{en:'Go to LINE Mini App check-in','zh-CN':'前往LINE小程序取号',vi:'Đến phần đăng ký LINE Mini App',ne:'LINE मिनी एप दर्तामा जानुहोस्',ko:'LINE 미니앱 접수로 이동',kmr:'Herin qeydkirina sepana biçûk a LINE'}
};
const updateLabel={en:'Updated','zh-CN':'更新于',vi:'Cập nhật',ne:'अन्तिम अपडेट',ko:'최근 갱신',kmr:'Nûkirina dawî'};
const rawCache=new WeakMap(),ariaCache=new WeakMap();
let pending=false;
const currentLanguage=()=>window.ASOBOON_I18N?.language||'ja';
function fixPhrase(value,original,lang){
 if(lang==='ja')return original;
 const lead=original.match(/^\s*/)?.[0]||'',tail=original.match(/\s*$/)?.[0]||'';
 let body=original.trim();
 if(lastmile[body])return lead+(lastmile[body][lang]||body)+tail;
 const clock=body.match(/^最終更新\s*(\d{1,2}:\d{2})$/);
 if(clock)return lead+(updateLabel[lang]||'Updated')+' '+clock[1]+tail;
 if(body.includes('LINEミニアプリの受付へ')){
  const changed=body.replace('LINEミニアプリの受付へ',lastmile['LINEミニアプリの受付へ'][lang]||'Go to LINE Mini App check-in');
  return lead+changed+tail;
 }
 return value;
}
function adjust(){
 pending=false;
 const lang=currentLanguage(),app=document.getElementById('app');
 if(!app)return;
 const walker=document.createTreeWalker(app,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const n=walker.currentNode;
  if(!n.parentElement||n.parentElement.closest('script,style,select,option,textarea,[data-no-i18n]'))continue;
  const current=n.nodeValue||'',previous=rawCache.get(n);
  const original=previous&&previous.last===current?previous.raw:current;
  const next=fixPhrase(current,original,lang);
  if(next!==current)n.nodeValue=next;
  if(next!==current||previous)rawCache.set(n,{raw:original,last:next});
 }
 for(const el of app.querySelectorAll('[aria-label]')){
  const current=el.getAttribute('aria-label')||'',previous=ariaCache.get(el);
  const original=previous&&previous.last===current?previous.raw:current;
  const next=fixPhrase(current,original,lang);
  if(next!==current)el.setAttribute('aria-label',next);
  if(next!==current||previous)ariaCache.set(el,{raw:original,last:next});
 }
}
function queueFix(){
 if(pending)return;pending=true;setTimeout(adjust,110);
}
window.addEventListener('asoboon:language-changed',queueFix);
window.addEventListener('asoboon:v2-route-rendered',queueFix);
window.addEventListener('load',queueFix);
const appRoot=document.getElementById('app');
if(appRoot)new MutationObserver(records=>{
 if(records.some(r=>{
  if(r.type==='childList')return true;
  if(r.type==='attributes'){
   const s=ariaCache.get(r.target);
   return !s||r.target.getAttribute('aria-label')!==s.last;
  }
  const s=rawCache.get(r.target);
  return !s||r.target.nodeValue!==s.last;
 }))queueFix();
}).observe(appRoot,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label']});
queueFix();
})();
