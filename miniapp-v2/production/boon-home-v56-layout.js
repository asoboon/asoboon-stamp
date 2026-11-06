/*
 * BOON START v5.8 — action-first HOME
 * Presentation only. Reuses the original reception, callstatus, day, capacity
 * and timer DOM nodes. No API calls, booking links, prices or state writes.
 * Verified live status comes from home-status-v13, not cached guesswork.
 */
(function(){
'use strict';
if(window.ASOBOON_MINT_V51_PREVIEW!==true)return;
const root=document.getElementById('app');
if(!root)return;
const copy={
ja:{eyebrow:'きょうのASOBooN',progress:['受付','呼出を確認','ご入場'],day:'今日の営業',dayHelp:'営業区分・遊べる時間・閉館時刻',slots:'受付枠の空き状況',slotsHelp:'下の数字は受付できる残り人数です。館内の混雑率ではありません。',timer:'あそべる時間',timerHelp:'入場後の終了時刻を確認する',default:['まずは、今日の受付','受付できる時間と方法を確認してください。'],open:['当日受付をする','利用する回と人数を選んで順番を取ります。'],saved:['受付番号を確認する','受付番号が保存されています。呼出の現在の状態を確認してください。'],pending:['呼出状況を確認中','受付番号は保存されています。最新情報を照合しています。'],waiting:['順番をお待ちください','呼出状況は自動で更新されます。'],calling:['入口へお越しください','呼出から30分以内に、受付番号を用意してASOBooN入口へ。'],hold:['入口スタッフに確認する','保留のため、受付番号を用意してスタッフへお声がけください。'],guided:['遊ぶ時間を確認する','ご案内済みです。タイマーと再入場案内をご利用ください。'],canceled:['受付は取り消されています','再度利用する場合は当日受付からお進みください。'],closed:['受付状況の確認は終了','この受付番号の呼出状況は終了しています。'],before:['受付開始までお待ちください','営業区分と受付開始時刻をご確認ください。'],ended:['本日の営業は終了しました','営業日カレンダーで次の営業日をご確認ください。'],error:['最新の状況を確認できません','受付番号は消えていません。呼出状況画面で再確認してください。'],loading:['情報を確認しています','読み込み完了後に、利用できる操作を表示します。'],none:['今日の受付を確認する','受付をしていない場合は、受付開始後に順番を取れます。']},
en:{eyebrow:'Your ASOBooN today',progress:['Check in','Check your turn','Enter'],day:'Today’s hours',dayHelp:'Business day · play duration · closing',slots:'Spaces left by session',slotsHelp:'These are remaining check-in spaces, not how crowded the play area is.',timer:'Play-time calculator',timerHelp:'Check your estimated finish time',default:['Check today’s reception','See available times and ways to check in.'],open:['Take a queue number','Choose a session and the number of visitors.'],saved:['Check your queue number','A queue number is saved. Check its current status.'],pending:['Checking queue status','Your number is saved. Verifying the latest status.'],waiting:['Please wait for your turn','Your queue status will refresh automatically.'],calling:['Please come to the entrance','Bring your queue number within 30 minutes of being called.'],hold:['Ask the entrance staff','Your queue is on hold. Please show your number.'],guided:['Check your play time','Entry guided. Use the timer or re-entry guide.'],canceled:['This queue was canceled','You can start reception again if available.'],closed:['Queue tracking finished','This queue number is no longer being tracked.'],before:['Reception has not opened','See today’s hours and opening time.'],ended:['Closed for today','See the calendar for the next open day.'],error:['Unable to check live status','Your number is not erased. Open queue status to retry.'],loading:['Checking information','Available actions will appear shortly.'],none:['Check today’s reception','After reception opens, take a queue number.']},
'zh-CN':{eyebrow:'今天的ASOBooN',progress:['取号','查看叫号','入场'],day:'今日营业',dayHelp:'营业类型、游玩时长、闭馆时间',slots:'各时段剩余名额',slotsHelp:'数字为可预约人数，并非场内拥挤程度。',timer:'游玩时间',timerHelp:'查看预计结束时间',default:['查看今日取号','确认可取号的时段和方式。'],open:['领取排队号码','选择时段和人数。'],saved:['查看排队号码','号码已保存。请确认最新状态。'],pending:['正在查询排队状态','号码已保存，正在确认。'],waiting:['请等待叫号','排队状态将自动更新。'],calling:['请前往入口','叫号后30分钟内带上号码前往入口。'],hold:['请咨询入口工作人员','排队已暂停，请出示号码。'],guided:['查看游玩时间','已引导入场，可查看计时器。'],canceled:['已取消取号','如需入场，请重新取号。'],closed:['排队状态已结束','此号码的状态查询已结束。'],before:['尚未开始取号','请确认取号开放时间。'],ended:['今日已结束营业','请查看下一个营业日。'],error:['无法确认最新状态','号码未被清除，请进入叫号页面重试。'],loading:['正在确认信息','稍后显示可用操作。'],none:['查看今日取号','开放后可领取排队号码。']},
ko:{eyebrow:'오늘의 ASOBooN',progress:['접수','호출 확인','입장'],day:'오늘의 영업',dayHelp:'영업 구분·이용 시간·폐관',slots:'시간대별 남은 접수 인원',slotsHelp:'표시 숫자는 남은 접수 인원이며 시설 혼잡도가 아닙니다.',timer:'놀이 시간 계산',timerHelp:'종료 예정 시간 확인',default:['오늘의 접수 확인','가능한 시간과 접수 방법을 확인하세요.'],open:['대기 번호 받기','시간대와 인원을 선택하세요.'],saved:['대기 번호 확인','번호가 저장되었습니다. 현재 호출 상태를 확인하세요.'],pending:['호출 상태 확인 중','번호는 저장되어 있으며 최신 상태를 확인 중입니다.'],waiting:['호출을 기다려 주세요','호출 상태는 자동 갱신됩니다.'],calling:['입구로 와 주세요','호출 후 30분 이내에 번호를 지참하세요.'],hold:['입구 직원에게 문의','보류 중입니다. 번호를 준비해 주세요.'],guided:['놀이 시간 확인','입장 안내가 완료되었습니다.'],canceled:['접수가 취소됨','필요하면 다시 접수하세요.'],closed:['접수 조회 종료','이 번호의 조회가 종료되었습니다.'],before:['접수 시작 전','오늘의 접수 시간을 확인하세요.'],ended:['오늘 영업 종료','다음 영업일을 확인하세요.'],error:['최신 상태 확인 불가','번호는 남아 있습니다. 호출 화면에서 다시 확인하세요.'],loading:['정보 확인 중','잠시 후 이용 가능한 기능을 표시합니다.'],none:['오늘의 접수 확인','접수 시작 후 번호를 받을 수 있습니다.']},
vi:{eyebrow:'ASOBooN hôm nay',progress:['Đăng ký','Kiểm tra lượt','Vào cửa'],day:'Giờ mở cửa hôm nay',dayHelp:'Loại ngày · thời gian chơi · giờ đóng',slots:'Chỗ còn lại theo lượt',slotsHelp:'Đây là số chỗ còn nhận đăng ký, không phải độ đông trong khu vui chơi.',timer:'Thời gian chơi',timerHelp:'Xem giờ kết thúc dự kiến',default:['Kiểm tra đăng ký hôm nay','Xem thời gian và cách đăng ký.'],open:['Lấy số thứ tự','Chọn lượt và số người.'],saved:['Kiểm tra số thứ tự','Số đã lưu. Hãy kiểm tra trạng thái hiện tại.'],pending:['Đang kiểm tra lượt','Số đã lưu, đang xác minh trạng thái.'],waiting:['Vui lòng chờ đến lượt','Trạng thái sẽ tự cập nhật.'],calling:['Vui lòng đến cửa vào','Mang số thứ tự đến trong vòng 30 phút.'],hold:['Hỏi nhân viên ở cửa','Lượt đang tạm giữ. Hãy xuất trình số.'],guided:['Xem thời gian chơi','Đã được hướng dẫn vào.'],canceled:['Lượt đã bị hủy','Có thể đăng ký lại nếu còn chỗ.'],closed:['Đã kết thúc theo dõi lượt','Không còn theo dõi số này.'],before:['Chưa mở đăng ký','Xem giờ bắt đầu hôm nay.'],ended:['Đã đóng cửa hôm nay','Xem lịch ngày mở tiếp theo.'],error:['Không kiểm tra được trạng thái','Số vẫn được lưu. Mở màn hình lượt để thử lại.'],loading:['Đang kiểm tra thông tin','Các thao tác sẽ xuất hiện sau.'],none:['Kiểm tra đăng ký hôm nay','Lấy số sau khi mở đăng ký.']},
ne:{eyebrow:'आजको ASOBooN',progress:['दर्ता','पालो हेर्नुहोस्','प्रवेश'],day:'आजको सञ्चालन',dayHelp:'खुल्ने दिन · खेल्ने अवधि · बन्द हुने समय',slots:'पालो अनुसार बाँकी ठाउँ',slotsHelp:'यो दर्ताका लागि बाँकी ठाउँ हो, भित्रको भीड होइन।',timer:'खेल्ने समय',timerHelp:'समाप्त हुने समय हेर्नुहोस्',default:['आजको दर्ता हेर्नुहोस्','दर्ता समय र तरिका हेर्नुहोस्।'],open:['पालो नम्बर लिनुहोस्','समय र व्यक्तिको संख्या छान्नुहोस्।'],saved:['पालो नम्बर जाँच्नुहोस्','नम्बर सुरक्षित छ। हालको अवस्था हेर्नुहोस्।'],pending:['पालो जाँच्दै','नम्बर सुरक्षित छ, अवस्था जाँच्दै छौँ।'],waiting:['पालो पर्खनुहोस्','अवस्था आफैँ अपडेट हुन्छ।'],calling:['प्रवेशद्वारमा आउनुहोस्','बोलाएको ३० मिनेटभित्र नम्बर लिएर आउनुहोस्।'],hold:['कर्मचारीलाई सोध्नुहोस्','पालो रोकिएको छ, नम्बर देखाउनुहोस्।'],guided:['खेल्ने समय जाँच्नुहोस्','प्रवेश निर्देशन पूरा भयो।'],canceled:['दर्ता रद्द भयो','आवश्यक भए फेरि दर्ता गर्नुहोस्।'],closed:['पालो हेर्ने समय सकियो','यो नम्बरको अवस्था अब देखाइँदैन।'],before:['दर्ता सुरु भएको छैन','आजको दर्ता समय हेर्नुहोस्।'],ended:['आज बन्द भयो','अर्को खुल्ने दिन हेर्नुहोस्।'],error:['अहिले अवस्था जाँच्न सकिएन','नम्बर मेटिएको छैन। फेरि प्रयास गर्नुहोस्।'],loading:['जानकारी जाँच्दै','केही क्षणमा कार्यहरू देखिन्छन्।'],none:['आजको दर्ता हेर्नुहोस्','दर्ता खुलेपछि नम्बर लिन सकिन्छ।']},
kmr:{eyebrow:'ASOBooN îro',progress:['Tomarkirin','Rêza bangê','Têketin'],day:'Vekirina îro',dayHelp:'Roj · dema lîstikê · girtin',slots:'Cihên mayî li her demê',slotsHelp:'Ev cihên mayî ji bo tomarkirinê ne; ne pîvana qelebalixiyê ye.',timer:'Dema lîstikê',timerHelp:'Dema dawiyê bibîne',default:['Tomarkirina îro bibîne','Dem û rêya tomarkirinê bibîne.'],open:['Hejmarekê bistîne','Dem û hejmara kesan hilbijêre.'],saved:['Hejmara xwe bibîne','Hejmar hatiye tomarkirin. Rewşa niha bibîne.'],pending:['Rewş tê kontrolkirin','Hejmar parastî ye; rewş tê kontrolkirin.'],waiting:['Li benda rêza xwe bimîne','Rewş dê nû bibe.'],calling:['Were deriyê ketinê','Di 30 xulekan de bi hejmarê were.'],hold:['Ji karmend bipirse','Rêz hatiye sekinandin. Hejmarê nîşan bide.'],guided:['Dema lîstikê bibîne','Rêberiya ketinê qediyaye.'],canceled:['Tomarkirin hat betalkirin','Ger hewce be ji nû ve tomar bike.'],closed:['Kontrola rêzê qediyaye','Ev hejmar êdî nayê şopandin.'],before:['Tomarkirin hîn venebûye','Dema destpêkê bibîne.'],ended:['Îro girtî ye','Roja din a vekirî bibîne.'],error:['Rewşa nû nayê standin','Hejmar nayê jêbirin. Dîsa biceribîne.'],loading:['Agahî tê kontrolkirin','Di demek nêzîk de vebijark xuya dibin.'],none:['Tomarkirina îro bibîne','Piştî vekirinê hejmar bistîne.']}
};
const el=(tag,cls,txt)=>{const n=document.createElement(tag);n.className=cls||'';if(txt!==undefined)n.textContent=txt;return n};
const set=(node,txt)=>{if(node&&node.textContent!==txt)node.textContent=txt};
function language(){
 const raw=String(window.ASOBOON_I18N?.language||document.documentElement.lang||'ja');
 if(copy[raw])return raw;
 if(raw.startsWith('zh'))return 'zh-CN';
 return raw.slice(0,2)==='ja'?'ja':copy[raw.slice(0,2)]?raw.slice(0,2):'en';
}
function currentKind(hero){
 const s=window.ASOBOON_HOME_STATUS_SNAPSHOT||{};
 const age=Date.now()-Number(s.checkedAt||0);
 const live=s.source==='live'&&age>=0&&age<360000;
 if(live&&['waiting','calling','hold','guided','canceled','closed','error','pending'].includes(s.kind))return {kind:s.kind,snapshot:s,live:true};
 if(s.kind==='pending'&&String(s.receipt||'').trim())return{kind:'pending',snapshot:s,live:false};
 if(hero.classList.contains('call-link'))return {kind:'saved',snapshot:s,live:false};
 for(const v of ['open','before','ended','closed','error','loading']){
  if(hero.classList.contains(v))return{kind:v,snapshot:s,live:false};
 }
 if(live&&s.kind==='none')return{kind:'none',snapshot:s,live:true};
 return{kind:'default',snapshot:s,live:false};
}
function make(){
 const shell=el('section','v58-flow');shell.id='v58Flow';
 const header=el('header','v58-header');
 header.appendChild(el('span','v58-eyebrow'));
 header.appendChild(el('h2','v58-header-title','BOON START'));
 shell.appendChild(header);
 const primary=el('section','v58-primary');primary.id='v58Primary';
 primary.setAttribute('aria-label','Next action');
 const phase=el('div','v58-phase');
 const phaseText=el('span','v58-phase-text');phaseText.id='v58Phase';
 phase.appendChild(phaseText);primary.appendChild(phase);
 const intro=el('div','v58-intro');intro.setAttribute('role','status');intro.setAttribute('aria-live','polite');
 intro.appendChild(el('h2','v58-next-title'));intro.appendChild(el('p','v58-next-summary'));
 primary.appendChild(intro);
 const lead=el('div','v58-native-action');lead.id='v58Lead';primary.appendChild(lead);
 shell.appendChild(primary);
 const path=el('div','v58-journey');path.id='v58Journey';
 for(let i=0;i<3;i++){const step=el('div','v58-step');step.dataset.step=String(i);step.appendChild(el('b','v58-step-number',String(i+1)));step.appendChild(el('span','v58-step-text'));path.appendChild(step)}
 shell.appendChild(path);
 const day=el('section','v58-day');day.id='v58DayZone';
 day.appendChild(el('h2','v58-section-title'));day.appendChild(el('p','v58-section-summary'));
 shell.appendChild(day);
 const timer=el('section','v58-timer');timer.id='v58TimerZone';
 timer.appendChild(el('h2','v58-section-title'));timer.appendChild(el('p','v58-section-summary'));
 shell.appendChild(timer);
 const sessions=el('section','v58-sessions');sessions.id='v58SessionsZone';
 sessions.appendChild(el('h2','v58-section-title'));sessions.appendChild(el('p','v58-section-summary'));
 shell.appendChild(sessions);
 return shell;
}
function mount(){
 const home=root.querySelector('.v38-home');
 const hero=home?.querySelector('#v38Hero');
 let day=home?.querySelector('#v38Today');
 const slots=home?.querySelector('#v38Slots'),timer=home?.querySelector('#v38TimeguideShortcut');
 if(!home||!hero||!day||!slots||!timer)return;
 // Business-day facts are informational. The original button pointed to the
 // timer, which made a static business label falsely appear tappable.
 // Keep the existing three values and native patchToday bindings unchanged.
 if(day.tagName==='BUTTON'){
  const passive=el('div',day.className+' v58-readonly-facts');
  passive.id='v38Today';
  passive.setAttribute('role','group');
  passive.setAttribute('aria-label','本日の営業情報');
  while(day.firstChild)passive.appendChild(day.firstChild);
  day.replaceWith(passive);
  day=passive;
 }
 let shell=home.querySelector(':scope > #v58Flow');
 if(!shell){shell=make();home.insertBefore(shell,hero)}
 const targetHero=shell.querySelector('#v58Lead');
 if(hero.parentElement!==targetHero)targetHero.appendChild(hero);
 const dayZone=shell.querySelector('#v58DayZone'),timerZone=shell.querySelector('#v58TimerZone'),sessionsZone=shell.querySelector('#v58SessionsZone');
 if(day.parentElement!==dayZone)dayZone.appendChild(day);
 if(timer.parentElement!==timerZone)timerZone.appendChild(timer);
 if(slots.parentElement!==sessionsZone)sessionsZone.appendChild(slots);
 const t=copy[language()],info=currentKind(hero),state=info.kind;
 if(shell.dataset.state!==state)shell.dataset.state=state;
 set(shell.querySelector('.v58-eyebrow'),t.eyebrow);
 set(shell.querySelector('#v58Phase'),t.eyebrow);
 const title=t[state]||t.default;
 let detail=title[1];
 if(state==='waiting'&&info.live&&Number.isSafeInteger(info.snapshot.ahead)&&info.snapshot.ahead>=0){
  detail=(language()==='ja'?'前に'+info.snapshot.ahead+'組。':'Ahead: '+info.snapshot.ahead+'. ')+detail;
 }
 set(shell.querySelector('.v58-next-title'),title[0]);
 set(shell.querySelector('.v58-next-summary'),detail);
 set(dayZone.querySelector('.v58-section-title'),t.day);
 set(dayZone.querySelector('.v58-section-summary'),t.dayHelp);
 set(timerZone.querySelector('.v58-section-title'),t.timer);
 set(timerZone.querySelector('.v58-section-summary'),t.timerHelp);
 set(sessionsZone.querySelector('.v58-section-title'),t.slots);
 set(sessionsZone.querySelector('.v58-section-summary'),t.slotsHelp);
 const oldTitle=slots.querySelector(':scope > h3');
 if(oldTitle&&oldTitle.textContent!==t.slots)oldTitle.textContent=t.slots;
 const steps=shell.querySelectorAll('.v58-step');
 const progress=state==='calling'?2:state==='guided'?3:['saved','pending','waiting','hold','error','closed'].includes(state)?1:0;
 steps.forEach((step,i)=>{
  set(step.querySelector('.v58-step-text'),t.progress[i]);
  const active=i<progress;
  if(step.classList.contains('is-complete')!==active)step.classList.toggle('is-complete',active);
 });
 const showJourney=!['before','ended','loading','default','none'].includes(state);
 if(shell.querySelector('#v58Journey').hidden!==!showJourney)shell.querySelector('#v58Journey').hidden=!showJourney;
 const visibleSlots=slots.textContent.trim().length>0&&state!=='ended';
 if(sessionsZone.hidden===visibleSlots)sessionsZone.hidden=!visibleSlots;
 if(!home.classList.contains('v58-action-first'))home.classList.add('v58-action-first');
}
let scheduled=false;
function request(){
 if(scheduled)return;
 scheduled=true;
 setTimeout(()=>{scheduled=false;mount()},16);
}
new MutationObserver(request).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
for(const event of ['asoboon:language-changed','asoboon:v8-home-status','asoboon:v2-timeguide-updated','asoboon:v2-route-rendered','popstate'])window.addEventListener(event,request);
request();
window.BOON_HOME_V58=Object.freeze({version:'5.8.0-action-first',presentationOnly:true,existingActionsOnly:true});
})();
