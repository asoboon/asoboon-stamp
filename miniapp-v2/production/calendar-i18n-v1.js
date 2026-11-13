/* Standalone business/event calendar locale bridge.
 * Reuses HOME's seven-language preference and 487-key dictionary.
 * Read-only DOM presentation: does not alter calendar API, operating dates,
 * venue schedule, booking rules, Instagram URLs or ticket data.
 */
(()=>{'use strict';
const ROOT=document.querySelector('main');if(!ROOT)return;
const LANGS={ja:'日本語 / Japanese',en:'English','zh-CN':'简体中文 / Chinese',vi:'Tiếng Việt / Vietnamese',ne:'नेपाली / Nepali',ko:'한국어 / Korean',kmr:'Kurmancî / Kurdish (Kurmanji)'};
const KEY='asoboon_miniapp_locale_v1';
const codes=['en','zh-CN','vi','ne','ko','kmr'];
const rows=[
['ホームへ戻る','Back to HOME','返回主页','Về trang chủ','गृहपृष्ठमा फर्कनुहोस्','홈으로 돌아가기','Vegere malperê'],
['新HOMEへ戻る','Back to HOME','返回主页','Về trang chủ','गृहपृष्ठमा फर्कनुहोस्','홈으로 돌아가기','Vegere malperê'],
['営業日カレンダー','Opening calendar','营业日历','Lịch hoạt động','खुल्ने दिनको पात्रो','영업일 달력','Salnameya rojên vekirî'],
['定休日や臨時の営業変更をご確認いただけます。','Check regular closing days and temporary changes.','查看固定休息日和临时营业调整。','Xem ngày nghỉ định kỳ và thay đổi lịch tạm thời.','नियमित बिदा र अस्थायी परिवर्तन हेर्नुहोस्।','정기 휴관일과 임시 운영 변경을 확인하세요.','Rojên girtina asayî û guherînên demkî kontrol bikin.'],
['前の月','Previous month','上个月','Tháng trước','अघिल्लो महिना','이전 달','Meha berê'],
['次の月','Next month','下个月','Tháng sau','अर्को महिना','다음 달','Meha din'],
['読み込み中','Loading','加载中','Đang tải','लोड हुँदैछ','불러오는 중','Tê barkirin'],
['月','Mon','周一','T2','सोम','월','Duş'],
['火','Tue','周二','T3','मङ्गल','화','Sêş'],
['水','Wed','周三','T4','बुध','수','Çarş'],
['木','Thu','周四','T5','बिही','목','Pêncş'],
['金','Fri','周五','T6','शुक्र','금','În'],
['土','Sat','周六','T7','शनि','토','Şemî'],
['日','Sun','周日','CN','आइत','일','Yekş'],
['日付','Date','日期','Ngày','मिति','날짜','Dîrok'],
['営業区分の色分け','Opening-day legend','营业类型图例','Chú giải ngày hoạt động','खुल्ने दिनको सङ्केत','영업 구분 범례','Nîşanên rojên vekirinê'],
['平日','Weekday','平日','Ngày thường','कार्यदिन','평일','Roja hefteyê'],
['平日特定日','Special weekday','特殊平日','Ngày thường đặc biệt','विशेष कार्यदिन','특정 평일','Roja taybet a hefteyê'],
['土日祝日','Weekends / holidays','周末及节假日','Cuối tuần / ngày lễ','सप्ताहन्त / बिदा','주말·공휴일','Dawiya hefteyê / betlan'],
['休館','Closed','闭馆','Đóng cửa','बन्द','휴관','Girtî'],
['休館日です。','Closed today.','今日闭馆。','Hôm nay đóng cửa.','आज बन्द छ।','휴관일입니다.','Îro girtî ye.'],
['今日','Today','今天','Hôm nay','आज','오늘','Îro'],
['営業日','Open day','营业日','Ngày mở cửa','खुल्ने दिन','영업일','Roja vekirî'],
['営業予定を確認しています…','Checking opening schedule…','正在查询营业日程…','Đang kiểm tra lịch hoạt động…','सञ्चालन तालिका जाँच गर्दै…','영업 일정을 확인 중입니다…','Bernameya vekirinê tê kontrolkirin…'],
['日付を選択してください','Please select a date','请选择日期','Hãy chọn ngày','कृपया मिति छान्नुहोस्','날짜를 선택해 주세요','Ji kerema xwe dîrokek hilbijêrin'],
['火曜日は定休日です。特別営業・臨時休業は営業日程に反映します。','Tuesdays are normally closed. Special opening and temporary closures appear in the calendar.','周二通常休馆。特别营业或临时休馆会显示在日历中。','Thứ Ba thường đóng cửa. Lịch sẽ hiển thị ngày mở cửa đặc biệt hoặc đóng cửa tạm thời.','मङ्गलबार नियमित बन्द हुन्छ। विशेष सञ्चालन र अस्थायी बन्द तालिकामा देखाइन्छ।','화요일은 정기 휴관일입니다. 특별 영업 및 임시 휴관은 달력에 반영됩니다.','Sêşeman bi gelemperî girtî ye. Vekirinên taybet û girtinên demkî di salnameyê de têne nîşandan.'],
['営業予定は変更になる場合があります。','Opening schedules may change.','营业安排可能变更。','Lịch hoạt động có thể thay đổi.','सञ्चालन तालिका परिवर्तन हुन सक्छ।','영업 일정은 변경될 수 있습니다.','Bernameya vekirinê dikare biguhere.'],
['ご利用案内を見る','Visitor guide','查看使用指南','Xem hướng dẫn','प्रयोग निर्देशिका हेर्नुहोस्','이용 안내 보기','Rêbernameya serdanê bibînin'],
['よくある質問を見る','Frequently asked questions','常见问题','Câu hỏi thường gặp','बारम्बार सोधिने प्रश्न','자주 묻는 질문 보기','Pirsên pir tên pirsîn'],
['営業情報を読み込めませんでした。','Unable to load opening information.','无法加载营业信息。','Không tải được thông tin hoạt động.','सञ्चालन जानकारी लोड गर्न सकिएन।','영업 정보를 불러오지 못했습니다.','Agahiyên vekirinê nehatin barkirin.'],
['営業時間','Opening hours','营业时间','Giờ mở cửa','खुल्ने समय','영업시간','Demjimêrên vekirinê'],
['利用時間','Play time','游玩时长','Thời gian chơi','खेल्ने समय','이용시간','Dema lîstinê'],
['時間制限なし','No time limit','不限时','Không giới hạn thời gian','समय सीमा छैन','시간 제한 없음','Sînora demê tune ye'],
['過ぎた日程','Past date','过去的日期','Ngày đã qua','बितेको मिति','지난 날짜','Dîroka derbasbûyî'],
['過ぎた日は薄く表示しています。','Past dates are dimmed.','过去的日期以浅色显示。','Ngày đã qua được làm mờ.','बितेका मिति फिक्का देखाइएका छन्।','지난 날짜는 흐리게 표시됩니다.','Dîrokên derbasbûyî bi rengê sivik têne nîşandan.'],
['営業情報を確認しています','Checking opening information','正在查询营业信息','Đang kiểm tra giờ mở cửa','सञ्चालन जानकारी जाँच गर्दै','영업 정보 확인 중','Agahiyên vekirinê têne kontrolkirin'],
['予定が表示されるまで少しお待ちください。','Please wait for the schedule.','请等待日程显示。','Vui lòng chờ lịch hiển thị.','तालिका देखिएसम्म पर्खनुहोस्।','일정이 표시될 때까지 잠시 기다려 주세요.','Heta bername were nîşandan hinekî bisekinin.'],
['再読み込み','Reload','重新加载','Tải lại','पुनः लोड','새로고침','Dîsa barke'],
['イベントカレンダー','Event calendar','活动日历','Lịch sự kiện','कार्यक्रम पात्रो','이벤트 달력','Salnameya bûyeran'],
['ASOBooNの開催予定','Upcoming at ASOBooN','ASOBooN活动预告','Sự kiện sắp diễn ra tại ASOBooN','ASOBooN का आगामी कार्यक्रम','ASOBooN 개최 예정','Bernameyên ASOBooN'],
['イベント予定','Upcoming events','活动预告','Sự kiện dự kiến','आगामी कार्यक्रम','이벤트 예정','Bûyerên pêşerojê'],
['今月のイベント','Events this month','本月活动','Sự kiện tháng này','यस महिनाका कार्यक्रम','이번 달 이벤트','Bûyerên vê mehê'],
['ASOBooN公式Instagramのイベント情報を、ここからまとめて確認できます。','View ASOBooN event updates from our official Instagram here.','在这里查看ASOBooN官方Instagram的活动信息。','Xem thông tin sự kiện từ Instagram chính thức của ASOBooN tại đây.','यहाँ ASOBooN को आधिकारिक Instagram का कार्यक्रम हेर्नुहोस्।','여기에서 ASOBooN 공식 인스타그램의 이벤트 소식을 확인하세요.','Agahiyên bûyerên ASOBooN ji Instagram-a fermî li vir bibînin.'],
['今月','This month','本月','Tháng này','यो महिना','이번 달','Vê mehê'],
['ASOBooN 公式Instagram','ASOBooN official Instagram','ASOBooN官方Instagram','Instagram chính thức của ASOBooN','ASOBooN आधिकारिक Instagram','ASOBooN 공식 인스타그램','Instagram-a fermî ya ASOBooN'],
['Instagramで開く ↗','Open Instagram ↗','在Instagram中打开 ↗','Mở Instagram ↗','Instagram खोल्नुहोस् ↗','인스타그램에서 열기 ↗','Di Instagramê de veke ↗'],
['ASOBooN公式Instagram イベント情報','ASOBooN official Instagram events','ASOBooN官方Instagram活动信息','Thông tin sự kiện Instagram ASOBooN','ASOBooN Instagram कार्यक्रम','ASOBooN 공식 인스타그램 이벤트','Bûyerên Instagram-a fermî ya ASOBooN'],
['投稿が表示されない場合は、','If posts do not appear,','如果帖子未显示，','Nếu không thấy bài đăng,','पोस्ट नदेखिएमा,','게시물이 보이지 않으면','Ger şandin xuya nebin,'],
['公式Instagram','official Instagram','官方Instagram','Instagram chính thức','आधिकारिक Instagram','공식 인스타그램','Instagram-a fermî'],
['をご確認ください。','please check the original page.','请查看原始页面。','vui lòng xem trang gốc.','मूल पृष्ठ हेर्नुहोस्।','원본 페이지를 확인해 주세요.','ji kerema xwe rûpela fermî kontrol bikin.'],
['※イベント内容・開催時間は、当日の混雑状況や運営上の都合により変更または中止となる場合があります。','Event details and times may change or be canceled depending on crowding or operating conditions.','活动内容和时间可能因当天拥挤程度或运营情况调整或取消。','Nội dung và thời gian sự kiện có thể thay đổi hoặc hủy do đông khách hay lý do vận hành.','भीड वा सञ्चालनका कारण कार्यक्रम र समय परिवर्तन वा रद्द हुन सक्छ।','혼잡 상황이나 운영 사정에 따라 이벤트 내용·시간이 변경 또는 취소될 수 있습니다.','Hûrgulî û demên bûyeran dikarin li gor qelebalixiyê an şertên xebatê biguherin an bên betalkirin.']
];
const extra=Object.fromEntries(rows.map(([ja,...texts])=>[ja,Object.fromEntries(codes.map((c,i)=>[c,texts[i]]))]));
const cache=new WeakMap(),attributes=new WeakMap(),originalTitle=document.title;
const locale=()=>{try{const saved=localStorage.getItem(KEY);return Object.hasOwn(LANGS,saved)?saved:'ja'}catch{return'ja'}};
const monthFmt=(lang,y,m)=>lang==='ja'?y+'年 '+m+'月':lang==='ko'?y+'년 '+m+'월':lang==='zh-CN'?y+'年'+m+'月':lang==='ne'?y+' / '+m:lang==='kmr'?m+' / '+y:new Intl.DateTimeFormat(lang,{year:'numeric',month:'long',timeZone:'Asia/Tokyo'}).format(new Date(Date.UTC(y,m-1,1)));
function translate(raw,lang){
 if(lang==='ja')return raw;
 const source=raw.trim();
 const current=window.ASOBOON_I18N_DICTIONARY?.[source];
 const tr=extra[source]?.[lang]||current?.[lang]||current?.en;
 if(tr)return raw.replace(source,tr);
 let m=source.match(/^(\d{4})年\s*(\d{1,2})月$/);
 if(m)return raw.replace(source,monthFmt(lang,Number(m[1]),Number(m[2])));
 m=source.match(/^(\d{1,2})月(\d{1,2})日$/);
 if(m)return raw.replace(source,lang==='ko'?m[1]+'월 '+m[2]+'일':lang==='zh-CN'?m[1]+'月'+m[2]+'日':m[2]+'/'+m[1]);
 m=source.match(/^営業時間\s*(.+)$/);
 if(m)return raw.replace(source,(extra['営業時間']?.[lang]||'Opening hours')+' '+m[1]);
 m=source.match(/^利用時間\s*(.+)$/);
 if(m)return raw.replace(source,(extra['利用時間']?.[lang]||'Play time')+' '+(extra[m[1]]?.[lang]||current?.en||m[1]));
 return raw;
}
function updateText(n,lang){
 if(!n?.parentElement||n.parentElement.closest('script,style,textarea,select,option,#asoboon-calendar-lang'))return;
 const old=cache.get(n),current=n.nodeValue||'',source=old?.last===current?old.raw:current;
 const tr=translate(source,lang);cache.set(n,{raw:source,last:tr});if(tr!==current)n.nodeValue=tr;
}
function updateAttrs(el,lang){
 const record=attributes.get(el)||{};
 for(const name of ['aria-label','title']){
  if(!el.hasAttribute(name))continue;
  const old=record[name],now=el.getAttribute(name)||'',source=old?.last===now?old.raw:now,tr=translate(source,lang);
  record[name]={raw:source,last:tr};if(now!==tr)el.setAttribute(name,tr);
 }
 attributes.set(el,record);
}
const bar=document.createElement('div');bar.id='asoboon-calendar-lang';
bar.innerHTML='<label for="asoboon-calendar-select">🌐 Language</label><select id="asoboon-calendar-select" aria-label="Choose language"></select>';
const select=bar.querySelector('select');
for(const [code,label] of Object.entries(LANGS)){const option=document.createElement('option');option.value=code;option.textContent=label;option.lang=code;select.appendChild(option)}
select.value=locale();ROOT.parentNode.insertBefore(bar,ROOT);
const css=document.createElement('style');css.textContent='#asoboon-calendar-lang{display:flex;justify-content:flex-end;align-items:center;gap:8px;width:min(100%,480px);margin:0 auto 8px;padding:4px 8px;border:2px solid #67CEBB;border-radius:13px;background:#251C1A;color:#FFF9F1;font:800 12px system-ui,sans-serif}#asoboon-calendar-lang label{white-space:nowrap}#asoboon-calendar-select{height:43px;width:min(205px,64%);min-width:120px;border:2px solid #67CEBB;border-radius:10px;background:#FFF9F1;color:#251C1A;font:750 12px system-ui,sans-serif}#asoboon-calendar-select:focus-visible{outline:3px solid #166D66;outline-offset:2px}@media(max-width:350px){#asoboon-calendar-lang{gap:5px;padding:4px}#asoboon-calendar-select{min-width:109px}}';
document.head.appendChild(css);
let scheduled=false;
function refresh(){
 scheduled=false;
 const lang=locale();
 const walk=document.createTreeWalker(ROOT,NodeFilter.SHOW_TEXT);
 while(walk.nextNode())updateText(walk.currentNode,lang);
 for(const el of ROOT.querySelectorAll('[aria-label],[title]'))updateAttrs(el,lang);
 document.documentElement.lang=lang;
 document.title=translate(originalTitle,lang);
}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(refresh,60)}
select.addEventListener('change',()=>{try{localStorage.setItem(KEY,select.value)}catch{}schedule()});
new MutationObserver(records=>{
 const external=records.some(r=>{
  if(r.type==='childList')return true;
  if(r.type==='attributes'){
   const prior=attributes.get(r.target)?.[r.attributeName];
   return !(prior&&r.target.getAttribute(r.attributeName)===prior.last);
  }
  const prior=cache.get(r.target);return !(prior&&r.target.nodeValue===prior.last);
 });
 if(external)schedule();
}).observe(ROOT,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title']});
window.ASOBOON_CALENDAR_I18N=Object.freeze({get language(){return locale()},languages:LANGS});
schedule();
})();