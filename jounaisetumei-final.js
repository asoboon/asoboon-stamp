/* ASOBooN venue tablet final localization + V5 cinematic amplification. External, no third-party dependencies. */
(function venueFinal(){
  'use strict';
  if(window.__ASOBOON_V5_FINAL_20261016__)return;
  window.__ASOBOON_V5_FINAL_20261016__=true;
  const root=document.getElementById('exitGuideV2'),cin=document.getElementById('eg-cinema');
  if(!root||!cin)return;
  const LANGS=[['ja','日本語'],['en','English'],['zh','简体中文'],['vi','Tiếng Việt'],['ko','한국어'],['ne','नेपाली'],['tl','Filipino'],['my','မြန်မာ']];
  // Each row: Japanese canonical text, followed by en, zh-Hans, vi, ko, ne, tl, my.
  const T=[
    ["一時退場中も利用時間は進みます。","Play time keeps running while you are outside.","外出期间游玩时间仍继续计算。","Thời gian chơi vẫn tiếp tục khi bạn ra ngoài.","외출 중에도 이용 시간이 계속 흐릅니다.","बाहिर हुँदा पनि खेल्ने समय चलिरहन्छ।","Tuloy ang oras ng paggamit habang nasa labas.","အပြင်ထွက်နေစဉ်လည်း ကစားချိန် ဆက်လက်တွက်ပါသည်။"],
    ["✨ 動き ON","✨ FX ON","✨ 动画开启","✨ Hiệu ứng BẬT","✨ 효과 켬","✨ प्रभाव चालु","✨ FX ON","✨ လှုပ်ရှားမှု ဖွင့်"],
    ["動き OFF","FX OFF","动画关闭","Hiệu ứng TẮT","효과 끔","प्रभाव बन्द","FX OFF","လှုပ်ရှားမှု ပိတ်"],
    ["この時間ごろに","Visitors who entered around","约在此时间","Khách vào khoảng giờ","이 시간에","लगभग यो समयमा","Mga pumasok bandang","ဤအချိန်ခန့် ဝင်လာသူများ"],
    ["入場した方は退場です","this time should leave now","入场的游客请离场","này cần ra về","입장한 분은 퇴장하세요","भित्र पसेका व्यक्तिहरू निस्कनुहोस्","ay dapat nang lumabas","ထွက်ချိန်ရောက်ပါပြီ"],
    ["中央の時刻が、いま退場する方の入場時刻です。","The large time shows when people due to leave entered.","中间的大数字是现在应该离场游客的入场时间。","Giờ lớn giữa màn hình là giờ vào của khách cần ra về.","중앙의 큰 시각은 현재 퇴장할 분의 입장 시각입니다.","बीचको ठूलो समय अहिले निस्कनुपर्ने व्यक्तिको प्रवेश समय हो।","Ang malaking oras sa gitna ay oras ng pagpasok ng dapat nang lumabas.","အလယ်ရှိအချိန်မှာ ယခုထွက်ရမည့်သူများ၏ ဝင်ချိန်ဖြစ်သည်။"],
    ["2時間30分利用","2 hr 30 min visit","游玩2小时30分钟","Vé 2 giờ 30 phút","2시간 30분 이용","२ घण्टा ३० मिनेट","2 oras 30 minuto","၂ နာရီ ၃၀ မိနစ်"],
    ["3時間利用","3 hr visit","游玩3小时","Vé 3 giờ","3시간 이용","३ घण्टा","3 oras","၃ နာရီ"],
    ["この時刻ごろに入場した方は、いま退場です","Visitors who entered around this time should leave now.","此时段入场的游客现在应离场。","Khách vào khoảng giờ này cần ra về ngay.","이 시각에 입장한 분은 지금 퇴장할 시간입니다.","यस समयमा प्रवेश गरेका व्यक्तिहरू अहिले निस्कनुपर्छ।","Dapat nang lumabas ang pumasok sa oras na ito.","ဤအချိန်တွင် ဝင်သူများ ယခုထွက်ရပါမည်။"],
    ["本日の営業開始前です","Not open yet today","今日尚未开园","Chưa mở cửa hôm nay","오늘 영업 시작 전입니다","आज अझै खुलेको छैन","Hindi pa bukas ngayon","ယနေ့ ဖွင့်ချိန်မရောက်သေးပါ"],
    ["まだ退場時間を迎えた方はいません","No visitors are due to leave yet","目前尚无人需要离场","Chưa có khách nào đến giờ ra về","아직 퇴장 시간이 된 분이 없습니다","अहिलेसम्म कसैको निस्कने समय भएको छैन","Wala pang kailangang lumabas","ထွက်ရမည့်သူ မရှိသေးပါ"],
    ["本日の営業は終了しました","Closed for today","今日营业已结束","Hôm nay đã đóng cửa","오늘 영업이 종료되었습니다","आजको सञ्चालन सकिएको छ","Sarado na para sa araw na ito","ယနေ့ ပိတ်ပါပြီ"],
    ["ごろに入場した方が、いま退場の目安です","Visitors who entered around the displayed time should leave now.","显示的入场时刻对应当前离场时间。","Khách vào khoảng giờ hiển thị nên ra về bây giờ.","표시된 시각에 입장한 분이 퇴장할 때입니다.","देखाइएको समयमा प्रवेश गर्नेहरूको निस्कने समय हो।","Dapat nang umalis ang pumasok sa ipinakitang oras.","ပြထားသည့်အချိန်တွင် ဝင်သူများ ယခုထွက်ရမည်။"],
    ["正確な入場時刻は、受付時の案内とレシートをご確認ください。","Check your receipt and reception details for the exact entry time.","准确入场时间请查看收据及前台说明。","Xem biên lai và hướng dẫn ở lễ tân để biết giờ vào chính xác.","정확한 입장 시각은 안내 및 영수증을 확인하세요.","सही प्रवेश समय रसिद र स्वागत कक्षको विवरणमा हेर्नुहोस्।","Tingnan ang resibo at tagubilin sa reception para sa eksaktong oras ng pagpasok.","ဝင်ချိန်အတိအကျကို ပြေစာနှင့် ဧည့်ကြိုဌာနအချက်အလက်၌ ကြည့်ပါ။"],
    ["表示時刻ごろに入場した方が、現在の退場目安です。","The time shown is the entry time of visitors due to exit.","显示的时间是现在应离场游客的入场时间。","Giờ hiển thị là giờ vào của khách cần ra về.","표시된 시각은 지금 퇴장할 분의 입장 시각입니다.","देखाइएको समय अहिले निस्कनुपर्नेहरूको प्रवेश समय हो।","Ang oras sa screen ay oras ng pagpasok ng mga dapat nang lumabas.","ပြထားသည့်အချိန်မှာ ယခုထွက်ရမည့်သူများ၏ ဝင်ချိန်ဖြစ်သည်။"],
    ["外に出る方はこちら","LEAVING THE VENUE?","要外出吗？","MUỐN RA NGOÀI?","외출하시나요?","बाहिर जानुहुन्छ?","LALABAS BA KAYO?","အပြင်ထွက်မည်လား။"],
    ["入退場の方法を見る","See how to leave or return","查看出入园方法","Xem cách ra ngoài / quay lại","외출·재입장 방법 보기","बाहिर जाने र फर्कने तरिका","Tingnan ang paglabas at pagbalik","ထွက်ခြင်း/ပြန်ဝင်ခြင်း ကြည့်ရန်"],
    ["一時退場・再入場・完全退場はこちら","Temporary exit / re-entry / final exit","临时外出／再次入场／正式离园","Ra ngoài tạm thời / quay lại / về hẳn","일시 외출·재입장·완전 퇴장","अस्थायी निकास / पुनःप्रवेश / अन्तिम निकास","Pansamantalang labas / balik / huling labas","ယာယီထွက် / ပြန်ဝင် / အပြီးထွက်"],
    ["本日は時間制限なくご利用いただけます","Unlimited play time today (until closing)","今天不限游玩时长（营业时间内）","Hôm nay chơi không giới hạn giờ (đến khi đóng cửa)","오늘은 폐장 시까지 시간제한 없이 이용할 수 있습니다","आज बन्द हुने समयसम्म कुनै समयसीमा छैन","Walang limitasyon sa oras ngayon (hanggang magsara)","ယနေ့ ပိတ်ချိန်အထိ အချိန်ကန့်သတ်ချက် မရှိပါ"],
['外に出るときのご案内','Leaving & returning','外出与返回指南','Hướng dẫn ra ngoài','외출 및 재입장 안내','बाहिर जाने र फर्कने 안내','Gabay sa paglabas','အပြင်ထွက်ခြင်း လမ်းညွှန်'],
['このあと、どうされますか？','What would you like to do?','您接下来要做什么？','Bạn muốn làm gì tiếp theo?','이제 어떻게 하시겠습니까?','अब के गर्न चाहनुहुन्छ?','Ano ang gusto ninyong gawin?','နောက်တစ်ဆင့် ဘာလုပ်လိုပါသလဲ။'],
['みんなで','Everyone','全家一起','Cả gia đình','가족 모두','सबैजना','Lahat','အားလုံး'],
['外に出る','Go outside','外出','Ra ngoài','외출하기','बाहिर जाने','Lalabas','အပြင်ထွက်မည်'],
['大人だけ','Adults only','仅大人','Chỉ người lớn','어른만','वयस्क मात्र','Matatanda lang','လူကြီးများသာ'],
['今日は','Today','今天','Hôm nay','오늘은','आज','Ngayong araw','ဒီနေ့'],
['帰る','Go home','离园','Về nhà','귀가하기','घर जाने','Uuwi','အိမ်ပြန်မည်'],
['あとで戻る','Returning later','稍后返回','Sẽ quay lại','나중에 재입장','पछि फर्कने','Babalik mamaya','နောက်မှ ပြန်ဝင်မည်'],
['もう戻らない','Not returning','不再返回','Không quay lại','재입장 안 함','फेरि नफर्कने','Hindi na babalik','ပြန်မဝင်တော့ပါ'],
['手順を見る','See the steps','查看步骤','Xem các bước','절차 보기','प्रक्रिया हेर्नुहोस्','Tingnan ang mga hakbang','အဆင့်များကြည့်ရန်'],
['※ 一部の大人と子どもが一緒に外出する場合は、受付スタッフへお声がけください。','If some adults and children leave together, please ask reception staff first.','如果部分大人和孩子一起外出，请先咨询前台工作人员。','Nếu một số người lớn và trẻ em cùng ra ngoài, hãy hỏi nhân viên lễ tân trước.','일부 보호자와 아이가 함께 외출할 경우 안내 데스크에 먼저 문의하세요.','केही वयस्क र बालबालिका सँगै बाहिर निस्कँदा पहिले स्वागत कक्षमा सोध्नुहोस्।','Kung may ilang matatanda at batang sabay na lalabas, magtanong muna sa reception.','လူကြီးနှင့်ကလေးအချို့ အတူထွက်မည်ဆိုပါက ဧည့်ကြိုဝန်ထမ်းကို အရင်မေးပါ။'],
['◷ 何時まで遊べる？','◷ Until what time?','◷ 可以玩到几点？','◷ Chơi đến mấy giờ?','◷ 몇 시까지 놀 수 있나요?','◷ कति बजेसम्म खेल्न पाइन्छ?','◷ Hanggang anong oras?','◷ ဘယ်အချိန်ထိ ကစားနိုင်မလဲ။'],
['退場時間の目安を確認する','Check your exit time','查看离场时间','Xem giờ ra về','퇴장 시간 확인','निस्कने समय हेर्नुहोस्','Tingnan ang oras ng paglabas','ထွက်ချိန်ကို ကြည့်ရန်'],
['← 3つの選択肢へ','← Back to 3 choices','← 返回3个选项','← Về 3 lựa chọn','← 세 가지 선택으로','← तीन विकल्पमा फर्कनुहोस्','← Balik sa 3 pagpipilian','← ရွေးချယ်စရာ ၃ ခုသို့'],
['最初の画面へ戻る','Back to start','返回首页','Về trang đầu','처음 화면으로','सुरुको पृष्ठमा फर्कनुहोस्','Bumalik sa simula','အစစာမျက်နှာသို့ ပြန်ရန်'],
['退場時間を見る','See exit time','查看离场时间','Xem giờ rời đi','퇴장 시간 보기','निस्कने समय हेर्नुहोस्','Tingnan ang exit time','ထွက်ချိန်ကို ကြည့်ရန်'],
['みんなで外に出る','Everyone goes outside','全家一起外出','Cả gia đình ra ngoài','가족 모두 외출','सबैजना बाहिर जाने','Lalabas ang lahat','အားလုံး အပြင်ထွက်မည်'],
['大人だけ外に出る','Only adults go outside','只有大人外出','Chỉ người lớn ra ngoài','어른만 외출','वयस्क मात्र बाहिर जाने','Matatanda lang ang lalabas','လူကြီးများသာ အပြင်ထွက်မည်'],
['今日は帰る','Leaving for today','今天结束游玩','Hôm nay về luôn','오늘 이용 종료','आज घर फर्कने','Uuwi na ngayong araw','ဒီနေ့ အိမ်ပြန်မည်'],
['あとで戻ってくるとき','If you will come back later','稍后还会回来时','Nếu bạn sẽ quay lại','나중에 재입장할 경우','पछि फेरि आउने भए','Kung babalik pa mamaya','နောက်မှ ပြန်လာမည်ဆိုလျှင်'],
['外に出る前に、次の3つをしてください。','Do these 3 things before leaving.','外出前请完成以下3步。','Trước khi ra ngoài, hãy làm 3 việc sau.','나가기 전에 다음 3가지를 해주세요.','बाहिर जानुअघि यी ३ काम गर्नुहोस्।','Gawin ang 3 ito bago lumabas.','မထွက်မီ ဤ ၃ ချက်ကို လုပ်ပါ။'],
['ロッカーの荷物を全部出す','Take all belongings from the locker','取出储物柜里的所有物品','Lấy hết đồ trong tủ','사물함의 물건 모두 꺼내기','लकरबाट सबै सामान निकाल्नुहोस्','Kunin ang lahat ng gamit sa locker','လော့ကာမှ ပစ္စည်းအားလုံးယူပါ'],
['忘れ物がないか確認してください。','Check that nothing is left behind.','检查是否有遗忘物品。','Kiểm tra xem có quên đồ không.','두고 가는 물건이 없는지 확인하세요.','केही छुटेको छैन भनेर जाँच गर्नुहोस्।','Siguraduhing walang naiwan.','ပစ္စည်းကျန်ခဲ့ခြင်း ရှိမရှိ စစ်ဆေးပါ။'],
['赤ホルダーからレシートを抜く','Remove the receipt from the RED holder','从红色卡套中取出收据','Lấy biên lai khỏi thẻ giữ màu ĐỎ','빨간 홀더에서 영수증 꺼내기','रातो होल्डरबाट रसिद निकाल्नुहोस्','Kunin ang resibo sa PULANG holder','အနီရောင် holder မှ ပြေစာယူပါ'],
['レシートは返さず、持って出てください。','KEEP the receipt. Do not return it.','收据请随身带走，不要交还。','GIỮ biên lai, không trả lại.','영수증은 반납하지 말고 가지고 나가세요.','रसिद फिर्ता नगर्नुहोस्, आफूसँग राख्नुहोस्।','ITAGO ang resibo. Huwag isauli.','ပြေစာကို မပြန်အပ်ဘဲ ယူသွားပါ။'],
['ホルダーと鍵をすべて返す','Return ALL holders and the locker key','归还所有卡套和储物柜钥匙','Trả TẤT CẢ thẻ giữ và chìa khóa','모든 홀더와 열쇠 반납하기','सबै होल्डर र लकरको साँचो फिर्ता गर्नुहोस्','Isauli ang LAHAT ng holder at susi','holder အားလုံးနှင့် သော့ကို ပြန်အပ်ပါ'],
['赤・黄色のホルダーを返却ボックスへ。','Put red and yellow holders in the return box.','把红色和黄色卡套放入回收箱。','Bỏ thẻ giữ màu đỏ và vàng vào hộp trả.','빨간색·노란색 홀더를 반납함에 넣으세요.','रातो र पहेँलो होल्डर फिर्ता बाकसमा राख्नुहोस्।','Ilagay ang pula at dilaw na holder sa return box.','အနီနှင့်အဝါ holder များကို ပြန်အပ်ပုံးထဲထည့်ပါ။'],
['戻るときは、受付でレシートを見せてください。','To re-enter, show the receipt at reception.','返回时请在前台出示收据。','Khi quay lại, trình biên lai tại quầy lễ tân.','돌아올 때 안내 데스크에 영수증을 보여주세요.','फर्कँदा स्वागत कक्षमा रसिद देखाउनुहोस्।','Sa pagbabalik, ipakita ang resibo sa reception.','ပြန်ဝင်ရာတွင် ဧည့်ကြိုဌာန၌ ပြေစာပြပါ။'],
['一時退場中も利用時間は進みます。レシートをなくした場合は受付へ。','Your play time continues while outside. If the receipt is lost, ask reception.','外出期间游玩时间仍继续计算。收据遗失请联系前台。','Thời gian sử dụng vẫn tiếp tục khi ra ngoài. Mất biên lai hãy hỏi lễ tân.','외출 중에도 이용 시간이 흐릅니다. 영수증을 잃으면 안내 데스크에 문의하세요.','बाहिर हुँदा पनि खेल्ने समय चलिरहन्छ। रसिद हराए स्वागत कक्षमा सोध्नुहोस्।','Tuloy ang oras ng paggamit habang nasa labas. Kung nawala ang resibo, magtanong sa reception.','အပြင်ထွက်နေစဉ်လည်း အသုံးပြုချိန် ဆက်လက်တွက်သည်။ ပြေစာပျောက်ပါက ဧည့်ကြိုကို မေးပါ။'],
['大人だけ、あとで戻ってくるとき','If only adults leave and return','只有大人外出后再返回','Nếu chỉ người lớn ra ngoài và quay lại','어른만 외출 후 돌아올 경우','वयस्क मात्र बाहिर गएर फर्कने भए','Kung matatanda lang ang lalabas at babalik','လူကြီးများသာ ထွက်ပြီး ပြန်လာမည်ဆိုလျှင်'],
['黄色ホルダー','Yellow holder','黄色卡套','Thẻ giữ màu vàng','노란색 홀더','पहेँलो होल्डर','Dilaw na holder','အဝါရောင် holder'],
['黄色ホルダーを持っていますか？','Do you have a YELLOW holder?','您有黄色卡套吗？','Bạn có thẻ giữ MÀU VÀNG không?','노란색 홀더를 가지고 계신가요?','तपाईंसँग पहेँलो होल्डर छ?','May DILAW na holder ba kayo?','အဝါရောင် holder ရှိပါသလား။'],
['お子さまのそばには、ほかの保護者が残ります。','Another guardian must stay with the children.','必须有另一位监护人留在馆内陪伴孩子。','Phải có người giám hộ khác ở lại cùng trẻ.','다른 보호자가 아이와 함께 남아 있어야 합니다.','बालबालिकासँग अर्को अभिभावक बस्नुपर्छ।','Dapat may ibang guardian na maiiwan kasama ng mga bata.','ကလေးများနှင့် အခြားအုပ်ထိန်းသူတစ်ဦး ကျန်ရပါမည်။'],
['✓ ある','✓ Yes','✓ 有','✓ Có','✓ 있음','✓ छ','✓ Meron','✓ ရှိသည်'],
['外出する方法を見る','See how to leave','查看外出方法','Xem cách ra ngoài','외출 방법 보기','बाहिर जाने तरिका हेर्नुहोस्','Tingnan kung paano lalabas','ထွက်နည်းကြည့်ရန်'],
['× ない','× No','× 没有','× Không','× 없음','× छैन','× Wala','× မရှိပါ'],
['必要な対応を見る','See what to do','查看应对方法','Xem việc cần làm','필요한 조치 보기','के गर्नुपर्छ हेर्नुहोस्','Tingnan ang dapat gawin','ဘာလုပ်ရမည် ကြည့်ရန်'],
['大人と子どもが一緒に一部だけ外出する場合は、受付スタッフへ。','If some adults and children leave together, ask reception.','如果部分大人与孩子一起外出，请咨询前台。','Nếu một số người lớn và trẻ em cùng ra ngoài, hãy hỏi lễ tân.','일부 보호자와 아이가 함께 외출하면 안내 데스크에 문의하세요.','केही वयस्क र बालबालिका सँगै निस्के स्वागत कक्षमा सोध्नुहोस्।','Kung may ilang matatanda at batang lalabas, magtanong sa reception.','လူကြီးနှင့် ကလေးအချို့ အတူထွက်ပါက ဧည့်ကြိုကို မေးပါ။'],
['黄色ホルダーを持って、外出できます','You may leave WITH the yellow holder','持黄色卡套可以外出','Bạn được ra ngoài KHI CÓ thẻ màu vàng','노란색 홀더를 가지고 외출할 수 있습니다','पहेँलो होल्डर लिएर बाहिर जान सक्नुहुन्छ','Puwedeng lumabas nang dala ang dilaw na holder','အဝါရောင် holder ဖြင့် အပြင်ထွက်နိုင်ပါသည်'],
['館内にお子さまと保護者が残る場合です。','Only if the children and another guardian stay inside.','前提是孩子和另一位监护人留在馆内。','Chỉ khi trẻ và một người giám hộ khác vẫn ở lại trong khu vui chơi.','아이와 다른 보호자가 시설 안에 남는 경우입니다.','बालबालिका र अर्को अभिभावक भित्रै बस्ने भए मात्र।','Kung ang mga bata at ibang guardian ay maiiwan sa loob.','ကလေးများနှင့် အခြားအုပ်ထိန်းသူတစ်ဦး အတွင်းတွင် ကျန်ရပါမည်။'],
['黄色ホルダーを持って外に出る','Take the yellow holder with you','带上黄色卡套外出','Mang theo thẻ màu vàng khi ra ngoài','노란색 홀더를 가지고 외출하기','पहेँलो होल्डर साथमा लिएर जानुहोस्','Dalhin ang dilaw na holder palabas','အဝါရောင် holder ကို ယူသွားပါ'],
['黄色ホルダーは返さず、外出する大人が持ちます。','Do not return it. The adult leaving must keep it.','不要归还。外出的大人须随身携带。','Không trả lại. Người lớn ra ngoài phải mang theo.','반납하지 말고 외출하는 어른이 가지고 가세요.','यो फिर्ता नगर्नुहोस्। बाहिर जाने वयस्कले बोक्नुपर्छ।','Huwag isauli; dalhin ito ng taong lalabas.','ပြန်မအပ်ပါနှင့်။ ထွက်မည့်လူကြီးက ကိုင်ထားပါ။'],
['ほかの保護者とお子さまは館内で遊べます','Other guardians and children can stay and play','其他监护人与孩子可以继续在馆内游玩','Người giám hộ khác và trẻ có thể tiếp tục chơi','다른 보호자와 아이는 계속 이용할 수 있습니다','अर्का अभिभावक र बालबालिका भित्र खेल्न सक्छन्','Puwedeng magpatuloy sa paglalaro ang ibang guardian at mga bata','ကျန်သော အုပ်ထိန်းသူနှင့်ကလေးများ ဆက်ကစားနိုင်ပါသည်'],
['黄色ホルダーを持たない方は、そのままご利用ください。','Those staying inside can continue playing.','留在馆内的人可继续游玩。','Người ở lại trong khu vui chơi có thể tiếp tục chơi.','안에 남는 분들은 그대로 이용하시면 됩니다.','भित्र बस्नेहरूले खेल जारी राख्न सक्छन्।','Ang maiiwan sa loob ay maaaring magpatuloy sa paglalaro.','အတွင်းတွင်ကျန်သူများ ဆက်လက်အသုံးပြုနိုင်ပါသည်။'],
['戻るときは、受付で黄色ホルダーを見せてください。','To re-enter, show the YELLOW holder at reception.','返回时请在前台出示黄色卡套。','Khi quay lại, trình thẻ MÀU VÀNG tại lễ tân.','돌아올 때 안내 데스크에 노란색 홀더를 보여주세요.','फर्कँदा स्वागत कक्षमा पहेँलो होल्डर देखाउनुहोस्।','Sa pagbabalik, ipakita ang DILAW na holder sa reception.','ပြန်ဝင်ရာတွင် ဧည့်ကြိုဌာန၌ အဝါရောင် holder ပြပါ။'],
['お子さまだけを残して、','You cannot leave','不能只留下孩子','Không được để trẻ ở lại','아이만 남겨두고','बच्चालाई मात्र छोडेर','Hindi maaaring iwan','ကလေးများကိုသာထားပြီး'],
['外出することはできません。','children alone.','独自外出。','một mình rồi ra ngoài.','외출할 수 없습니다.','बाहिर निस्कन पाइँदैन।','ang bata nang mag-isa.','အပြင်ထွက်ခွင့် မရှိပါ။'],
['黄色ホルダーがない場合、','If you have no yellow holder,','如果没有黄色卡套，','Nếu không có thẻ vàng,','노란색 홀더가 없다면','पहेँलो होल्डर छैन भने,','Kung walang dilaw na holder,','အဝါရောင် holder မရှိပါက၊'],
['外出前に受付スタッフへ確認してください。','ask reception BEFORE leaving.','外出前请先向前台确认。','hãy hỏi lễ tân TRƯỚC khi ra ngoài.','외출 전에 안내 데스크에 확인하세요.','बाहिर जानुअघि स्वागत कक्षमा सोध्नुहोस्।','magtanong sa reception BAGO lumabas.','မထွက်မီ ဧည့်ကြိုကို မေးပါ။'],
['黄色ホルダーは、大人2名以上で同じ会計をご利用の方にお渡ししています。','A yellow holder is issued when two or more adults are on the same admission payment.','同一笔付款中有两名及以上大人时发放黄色卡套。','Thẻ vàng được cấp khi có từ 2 người lớn trong cùng một hóa đơn.','같은 결제로 어른 2명 이상 이용 시 노란색 홀더를 드립니다.','एउटै भुक्तानीमा दुई वा बढी वयस्क भए पहेँलो होल्डर दिइन्छ।','Nagbibigay ng dilaw na holder kung may 2 o higit pang matatanda sa iisang bayad.','တစ်ကြိမ်တည်းငွေချေသည့် လူကြီး ၂ ဦးနှင့်အထက်ရှိမှ အဝါရောင် holder ပေးပါသည်။'],
['本日のご利用は、ここで終了です','Your visit ends here today','您今天的游玩到此结束','Lượt chơi hôm nay kết thúc tại đây','오늘 이용은 여기서 종료됩니다','आजको भ्रमण यहाँ सकिन्छ','Dito na nagtatapos ang pagbisita ninyo ngayon','ယနေ့ အသုံးပြုခြင်း ဤနေရာတွင် ပြီးဆုံးပါသည်'],
['帰る前に、次の2つをしてください。','Do these 2 things before going home.','离开前请完成以下2步。','Trước khi về, hãy làm 2 việc sau.','귀가 전에 다음 2가지를 해주세요.','घर जानुअघि यी २ काम गर्नुहोस्।','Gawin ang 2 ito bago umuwi.','အိမ်မပြန်မီ ဤ ၂ ချက်ကို လုပ်ပါ။'],
['忘れ物がないか、最後に確認してください。','Check once more for anything left behind.','最后检查是否有遗忘物品。','Kiểm tra lần cuối xem có quên đồ không.','두고 가는 물건이 없는지 마지막으로 확인하세요.','केही छुटेको छ कि अन्तिम पटक जाँच गर्नुहोस्।','Tiyaking walang naiwan bago umalis.','ပစ္စည်းကျန်ခဲ့ခြင်း ရှိမရှိ နောက်ဆုံးစစ်ပါ။'],
['赤・黄色のホルダーと鍵を返却ボックスへ。','Place red/yellow holders and the key in the return box.','将红色、黄色卡套和钥匙放入回收箱。','Bỏ thẻ đỏ/vàng và chìa khóa vào hộp trả.','빨간색·노란색 홀더와 열쇠를 반납함에 넣으세요.','रातो/पहेँलो होल्डर र साँचो फिर्ता बाकसमा राख्नुहोस्।','Ilagay ang pula/dilaw na holder at susi sa return box.','အနီ/အဝါ holder နှင့်သော့ကို ပြန်အပ်ပုံးထဲထည့်ပါ။'],
['返却が済んだら、そのままお帰りいただけます。','After returning everything, you may leave.','归还完毕后即可离开。','Trả xong, bạn có thể ra về.','반납 후 그대로 귀가하시면 됩니다.','सबै फिर्ता गरेपछि जान सक्नुहुन्छ।','Pagkatapos magsauli, maaari na kayong umuwi.','အားလုံးပြန်အပ်ပြီးပါက ပြန်နိုင်ပါသည်။'],
['本日のご利用を終了すると、再入場はできません。','Once you end today’s visit, RE-ENTRY IS NOT ALLOWED.','今天正式离园后，不可再次入场。','Khi kết thúc lượt chơi hôm nay, KHÔNG ĐƯỢC VÀO LẠI.','오늘 이용을 종료하면 재입장할 수 없습니다.','आजको भ्रमण समाप्त गरेपछि फेरि प्रवेश गर्न पाइँदैन।','Kapag natapos ang pagbisita, HINDI NA PUWEDENG BUMALIK.','ယနေ့ အသုံးပြုမှု ပြီးဆုံးပါက ပြန်ဝင်ခွင့် မရှိပါ။'],
['当てはまる状況を選択してください','Choose what applies to you','请选择符合您情况的选项','Chọn tình huống phù hợp','해당하는 상황을 선택하세요','आफूलाई मिल्ने विकल्प छान्नुहोस्','Piliin ang sitwasyon ninyo','သင့်အခြေအနေကို ရွေးချယ်ပါ'],
['アニメーション切り替え','Toggle effects','切换动画','Bật/tắt hiệu ứng','애니메이션 전환','एनिमेसन खोल्ने/बन्द गर्ने','I-on/i-off ang animation','လှုပ်ရှားမှု ဖွင့်/ပိတ်'],
['選択しました','SELECTED','已选择','ĐÃ CHỌN','선택 완료','छानियो','NAPILI','ရွေးချယ်ပြီး'],
['ご確認ください','PLEASE CHECK','请确认','VUI LÒNG KIỂM TRA','확인해 주세요','कृपया जाँच्नुहोस्','PAKI-SURI','စစ်ဆေးပါ'],
['必ず手順をご確認ください','CHECK THE INSTRUCTIONS','请务必确认步骤','HÃY ĐỌC KỸ HƯỚNG DẪN','반드시 안내를 확인하세요','निर्देशन ध्यानपूर्वक पढ्नुहोस्','SUNDIN ANG TAGUBILIN','လမ်းညွှန်ချက်ကို သေချာဖတ်ပါ'],
['このあとの手順をご案内','NEXT: WHAT TO DO','下一步操作','BƯỚC TIẾP THEO','다음 절차 안내','अब के गर्ने','SUSUNOD NA HAKBANG','နောက်ထပ်လုပ်ဆောင်ရန်'],
['外出できます','YOU MAY LEAVE','可以外出','CÓ THỂ RA NGOÀI','외출할 수 있습니다','बाहिर जान सक्नुहुन्छ','PUWEDE LUMABAS','အပြင်ထွက်နိုင်သည်'],
['外出できません','DO NOT LEAVE','不可外出','KHÔNG ĐƯỢC RA NGOÀI','외출할 수 없습니다','बाहिर जान पाइँदैन','BAWAL LUMABAS','အပြင်ထွက်ခွင့် မရှိပါ'],
['3つの選択肢','3 CHOICES','3个选项','3 LỰA CHỌN','3가지 선택','३ विकल्प','3 PAGPIPILIAN','ရွေးချယ်စရာ ၃ ခု'],
['退場時間','EXIT TIME','离场时间','GIỜ RA VỀ','퇴장 시간','निस्कने समय','ORAS NG PAGLABAS','ထွက်ချိန်'],
['レシート','RECEIPT','收据','BIÊN LAI','영수증','रसिद','RESIBO','ပြေစာ'],
['この時間ごろに 入場した方は退場です','Visitors who entered around this time should exit','此时间前后入场的游客请离场','Khách vào khoảng giờ này cần ra về','이 시간에 입장한 분은 퇴장할 시간입니다','यस समयमा प्रवेश गर्नेहरू निस्कने समय हो','Oras nang lumabas ng pumasok sa oras na ito','ဤအချိန်ဝန်းကျင် ဝင်လာသူများ ထွက်ချိန်ရောက်ပါပြီ'],
['正確な入場時刻はレシートをご確認ください。','Check your receipt for your exact entry time.','准确入场时间请查看收据。','Xem biên lai để biết giờ vào chính xác.','정확한 입장 시간은 영수증을 확인하세요.','ठ्याक्कै प्रवेश समय रसिदमा हेर्नुहोस्।','Tingnan ang resibo para sa eksaktong oras ng pagpasok.','ဝင်ချိန်အတိအကျကို ပြေစာတွင် ကြည့်ပါ။']
  ];
  const textMap=new Map(T.map(r=>[r[0],r]));
  function trLive(text){
    const value=tr(text);
    if(value!==text||lang==='ja')return value;
    const m=text.match(/^(?:営業開始は10:00です。)?最初の退場目安は(\d{2}:\d{2})です。$/);
    if(m){const t=m[1];const prefix=text.startsWith('営業開始')?{en:'Opens at 10:00. ',zh:'10:00开园。',vi:'Mở cửa lúc 10:00. ',ko:'10:00 개장. ',ne:'१०:०० बजे खुल्छ। ',tl:'Bukas 10:00. ',my:'၁၀:၀၀ ဖွင့်သည်။ '}[lang]||'':'';const parts={en:'First expected exit: ',zh:'最早离场时间：',vi:'Giờ ra về đầu tiên: ',ko:'첫 퇴장 예상: ',ne:'पहिलो निस्कने समय: ',tl:'Unang exit: ',my:'ပထမထွက်ချိန်: '}[lang]||'';return prefix+parts+t;}
    const close=text.match(/^この利用時間の日は(\d{2}:\d{2})閉館です。$/);
    if(close){const t=close[1];return ({en:'Closing time: ',zh:'闭园时间：',vi:'Giờ đóng cửa: ',ko:'폐장 시간: ',ne:'बन्द हुने समय: ',tl:'Oras ng pagsara: ',my:'ပိတ်ချိန်: '}[lang]||'')+t;}
    return value;
  }
  const timeView=document.getElementById('timeView');
  const baseText=new WeakMap();
  const baseAttr=new WeakMap();
  let lang='ja',idle=0,lastGuideMarkup='';
  function tr(text){
    const row=textMap.get(text);
    return row?(lang==='ja'?row[0]:row[Math.max(1,LANGS.findIndex(l=>l[0]===lang))]||row[0]):text;
  }
  const bar=document.createElement('nav');
  bar.id='eg-final-languages';
  bar.setAttribute('aria-label','Language / 言語 / 语言');
  bar.innerHTML=LANGS.map(([code,name])=>`<button type="button" data-locale="${code}" lang="${code}" aria-pressed="${code==='ja'}">${name}</button>`).join('');
  document.body.appendChild(bar);
  const style=document.createElement('style');
  style.id='eg-final-style';
  style.textContent=`
    #eg-final-languages{position:fixed;z-index:420;top:max(6px,env(safe-area-inset-top));left:6px;right:6px;display:flex;gap:4px;align-items:center;justify-content:center;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:5px;border:1px solid #b3ccd9;border-radius:12px;background:rgba(255,255,255,.97);box-shadow:0 4px 16px #1233;max-width:1080px;margin:auto}
    #eg-final-languages[hidden]{display:none!important}
    #eg-final-languages button{border:1px solid #cedfe9;border-radius:8px;padding:9px 7px;white-space:nowrap;color:#254256;background:#fff;font:800 clamp(10px,1.6vw,13px)/1.2 -apple-system,"Noto Sans",sans-serif;min-height:37px;flex:1 0 auto}
    #eg-final-languages button[aria-pressed="true"]{background:#0967a7;border-color:#0967a7;color:white;box-shadow:inset 0 -3px #06497a}
    #exitGuideV2 .eg-page{padding-top:max(75px,env(safe-area-inset-top) + 67px)!important}
    #exitGuideV2 .eg-motion-switch{top:57px!important;right:15px}
    #exitGuideV2:not([data-lang="ja"]) .eg-choice-title{font-size:clamp(19px,3.55vw,33px)!important;letter-spacing:-.025em}
    #exitGuideV2:not([data-lang="ja"]) .eg-step strong{font-size:clamp(18px,2.7vw,27px)}
    #exitGuideV2:not([data-lang="ja"]) .eg-step p{font-size:clamp(13px,1.9vw,18px)}
    #exitGuideV2:not([data-lang="ja"]) .eg-note{font-size:12px}
    #exitGuideV2:not([data-lang="ja"]) .eg-choice-action{font-size:clamp(13px,2vw,18px)}
    @media(max-height:800px){#exitGuideV2 .eg-page{padding-top:65px!important}#eg-final-languages button{padding:5px 5px;min-height:32px}}
    @media(max-width:650px){#eg-final-languages{justify-content:flex-start}#eg-final-languages button{flex:0 0 auto}}
    #eg-cinema .eg-final-rail,#eg-cinema .eg-final-vortex,#eg-cinema .eg-final-impact{position:absolute;inset:0;pointer-events:none}
    #eg-cinema .eg-final-vortex{z-index:1;opacity:0;background:repeating-conic-gradient(from -15deg at 50% 50%,transparent 0deg 8deg,var(--cin-accent,#06b8ff) 9deg 9.8deg,transparent 11deg 20deg);mix-blend-mode:screen;filter:drop-shadow(0 0 12px var(--cin-accent))}
    #eg-cinema.active .eg-final-vortex{animation:eg-final-speed 1.62s both}
    @keyframes eg-final-speed{0%{opacity:.08;transform:scale(.15) rotate(0)}22%{opacity:.33;transform:scale(.48) rotate(25deg);animation-timing-function:cubic-bezier(.04,.8,.24,1)}39%{opacity:.9;transform:scale(2.9) rotate(180deg)}47%{opacity:.04;transform:scale(3.3) rotate(190deg)}55%{opacity:.04}67%{opacity:.9;transform:scale(4.8) rotate(215deg)}90%,100%{opacity:0;transform:scale(9) rotate(300deg)}}
    #eg-cinema .eg-final-rail{z-index:4;display:grid;grid-template-columns:1fr 1fr;perspective:750px;opacity:0}
    #eg-cinema .eg-final-rail i{display:block;width:100%;height:100%;background:linear-gradient(110deg,#030b1a 0%,#144168 18%,var(--cin-accent) 37%,#fff 47%,#154f76 55%,#001021 77%,#000 100%);border-inline:7px solid rgba(255,255,255,.85);box-shadow:inset 0 0 80px #000,0 0 58px var(--cin-accent);clip-path:polygon(0 0,94% 0,100% 11%,94% 26%,100% 40%,94% 50%,100% 67%,93% 83%,100% 100%,0 100%)}
    #eg-cinema .eg-final-rail i:last-child{transform:scaleX(-1)}
    #eg-cinema.active .eg-final-rail{animation:eg-final-doors 1.62s both cubic-bezier(.16,.75,.19,1)}
    @keyframes eg-final-doors{0%,15%{opacity:1;transform:scaleX(1.9)}40%{opacity:1;transform:scaleX(.04)}47%,55%{opacity:1;transform:scaleX(0)}69%{opacity:1;transform:scaleX(1.7)}100%{opacity:0;transform:scaleX(2.4)}}
    #eg-cinema .eg-final-impact{z-index:5;opacity:0;background:radial-gradient(circle at 50% 50%,#fff 0 2%,var(--cin-accent) 7%,transparent 38%);mix-blend-mode:screen}
    #eg-cinema.active .eg-final-impact{animation:eg-final-hit 1.62s both}
    @keyframes eg-final-hit{0%,39%{opacity:0;transform:scale(.1)}43%{opacity:.93;transform:scale(.4)}49%{opacity:0;transform:scale(4)}60%{opacity:0}69%{opacity:.55;transform:scale(1.5)}83%,100%{opacity:0;transform:scale(5)}}
    #eg-cinema.active .cin-title{text-shadow:4px 5px 0 #00122b,8px 10px 0 var(--cin-accent),0 0 20px #fff,0 0 65px var(--cin-accent),0 0 110px var(--cin-accent)}
    #eg-cinema.eg-final-warning .eg-final-rail i{filter:saturate(.5);background:linear-gradient(115deg,#190e1a,#731d28,#ff6767,#fff,#631625,#1a0910)}
    #eg-cinema.eg-final-warning .cin-ribbon{background:linear-gradient(90deg,transparent,#8d2833,transparent)}
    @media(prefers-reduced-motion:reduce){#eg-cinema.eg-force-motion.active{display:block!important}#eg-cinema.eg-force-motion.active .eg-final-vortex{animation:eg-final-speed 1.62s both}#eg-cinema.eg-force-motion.active .eg-final-rail{animation:eg-final-doors 1.62s both}#eg-cinema.eg-force-motion.active .eg-final-impact{animation:eg-final-hit 1.62s both}}
    #exitGuideV2[data-lang="en"] .eg-receipt:after{content:'RECEIPT'}#exitGuideV2[data-lang="zh"] .eg-receipt:after{content:'收据'}#exitGuideV2[data-lang="vi"] .eg-receipt:after{content:'BIÊN LAI'}#exitGuideV2[data-lang="ko"] .eg-receipt:after{content:'영수증'}#exitGuideV2[data-lang="ne"] .eg-receipt:after{content:'रसिद'}#exitGuideV2[data-lang="tl"] .eg-receipt:after{content:'RESIBO'}#exitGuideV2[data-lang="my"] .eg-receipt:after{content:'ပြေစာ'}
  `;
  document.head.appendChild(style);
  const rail=document.createElement('div');rail.className='eg-final-rail';rail.setAttribute('aria-hidden','true');rail.innerHTML='<i></i><i></i>';
  const vortex=document.createElement('div');vortex.className='eg-final-vortex';vortex.setAttribute('aria-hidden','true');
  const impact=document.createElement('div');impact.className='eg-final-impact';impact.setAttribute('aria-hidden','true');
  cin.insertBefore(vortex,cin.firstChild);
  cin.appendChild(rail);cin.appendChild(impact);
  const options={
    family:['Everyone goes outside','全家一起外出','Cả gia đình ra ngoài','가족 모두 외출','सबैजना बाहिर जाने','Lalabas ang lahat','အားလုံး အပြင်ထွက်မည်'],
    adult:['Adults only','仅大人外出','Chỉ người lớn','어른만 외출','वयस्क मात्र','Matatanda lang','လူကြီးများသာ'],
    leave:['Go home today','今天离园','Về nhà hôm nay','오늘 귀가','आज घर जाने','Uuwi na','ဒီနေ့ အိမ်ပြန်မည်']
  };
  const originals=new WeakMap();
  function translateText(element){
    if(!element)return;
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(node.parentElement?.closest('.eg-choice-title'))continue;
      if(!originals.has(node))originals.set(node,node.nodeValue);
      const base=originals.get(node),plain=base.trim();
      if(!plain)continue;
      const tx=trLive(plain);
      const rendered=base.replace(plain,tx);
      if(node.nodeValue!==rendered)node.nodeValue=rendered;
    }
  }
  function translatedChoiceTitles(){
    root.querySelectorAll('.eg-choice[data-guide]').forEach(btn=>{
      const el=btn.querySelector('.eg-choice-title');
      const title=options[btn.dataset.guide];if(!el||!title)return;
      const label=lang==='ja'?({family:'みんなで外に出る',adult:'大人だけ外に出る',leave:'今日は帰る'})[btn.dataset.guide]:title[LANGS.findIndex(a=>a[0]===lang)-1];
      // Keep a visual two-line headline without replacing the SVG or entire card.
      const split=label.indexOf(' ');const cut=split>0&&label.length>13?split:-1;
      const first=cut>0?label.slice(0,cut):label;
      const rest=cut>0?label.slice(cut+1):'';
      if(el.dataset.translation===label)return;
      el.replaceChildren(document.createTextNode(first),document.createElement('br'),document.createTextNode(rest));
      if(!rest)el.querySelector('br')?.remove();
      el.dataset.translation=label;
    });
  }
  function translateAttrs(){
    root.querySelectorAll('[aria-label]').forEach(el=>{
      if(!baseAttr.has(el))baseAttr.set(el,el.getAttribute('aria-label'));
      const orig=baseAttr.get(el),target=tr(orig);
      if(el.getAttribute('aria-label')!==target)el.setAttribute('aria-label',target);
    });
  }
  function translateCinema(){
    if(!cin.classList.contains('active'))return;
    const cTitle=cin.querySelector('.cin-title');
    const baseTitle=cTitle.textContent;
    const index=LANGS.findIndex(x=>x[0]===lang)-1;
    const dest=Object.keys({family:1,adult:1,leave:1,'adult-yes':1,'adult-no':1,home:1,time:1}).find(key=>{
      const jp={family:'みんなで\n外に出る',adult:'大人だけ\n外に出る',leave:'今日は\n帰る','adult-yes':'外出できます','adult-no':'外出できません',home:'3つの選択肢',time:'退場時間'}[key];
      return baseTitle===jp||(lang!=='ja'&&baseTitle===({family:options.family,adult:options.adult,leave:options.leave}[key]?.[index]||tr(jp)));
    });
    if(dest){
      const original={family:'みんなで外に出る',adult:'大人だけ外に出る',leave:'今日は帰る','adult-yes':'外出できます','adult-no':'外出できません',home:'3つの選択肢',time:'退場時間'}[dest];
      const rendered=lang==='ja'?original:options[dest]?.[index]||tr(original);
      if(cTitle.textContent!==rendered)cTitle.textContent=rendered;
      cin.classList.toggle('eg-final-warning',dest==='adult-no');
    }
    for(const sel of ['.cin-label','.cin-ribbon']){
      const el=cin.querySelector(sel),original=el.textContent;
      if(textMap.has(original)){const value=tr(original);if(value!==original)el.textContent=value;}
    }
  }
  let inRefresh=false;
  function refresh(){
    if(inRefresh)return;
    inRefresh=true;
    try{
      root.dataset.lang=lang;root.setAttribute('lang',lang);
      root.querySelectorAll('[data-kiosk-fullscreen]').forEach(b=>{b.textContent=(fullscreenWords[lang]||fullscreenWords.ja)[0];});
      translateText(root);translatedChoiceTitles();translateAttrs();translateCinema();
      const motion=root.querySelector('[data-motion-toggle]')?.dataset.motion;
      cin.classList.toggle('eg-force-motion',motion==='on');
      bar.hidden=cin.classList.contains('active');
      bar.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.locale===lang)));
    }finally{inRefresh=false;}
  }
  new MutationObserver(refresh).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  new MutationObserver(refresh).observe(cin,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
  function resetIdle(){
    clearTimeout(idle);
    idle=setTimeout(()=>{lang='ja';refresh();},29750);
  }
  // A landscape iPad Web Clip can launch without Safari bars.
  // A fullscreen API call is best-effort; iPad Safari may not expose it.
  const fullscreenWords={
    ja:['⛶ 全画面','iPadを横向きにし、Safariの「共有」→「ホーム画面に追加」から起動すると全画面で使えます。'],
    en:['⛶ Full screen','Turn iPad sideways, then use Safari Share → Add to Home Screen for a full-screen view.'],
    zh:['⛶ 全屏','请横放iPad，并在Safari中选择“共享”→“添加到主屏幕”以全屏启动。'],
    vi:['⛶ Toàn màn hình','Xoay ngang iPad và chọn Safari Chia sẻ → Thêm vào Màn hình chính để xem toàn màn hình.'],
    ko:['⛶ 전체 화면','iPad를 가로로 놓고 Safari 공유 → 홈 화면에 추가로 실행하면 전체 화면이 됩니다.'],
    ne:['⛶ पूरा स्क्रिन','iPad तेर्सो राखेर Safari को Share → Add to Home Screen बाट खोल्नुहोस्।'],
    tl:['⛶ Full screen','Ihiga ang iPad at piliin ang Safari Share → Add to Home Screen para sa full screen.'],
    my:['⛶ မျက်နှာပြင်ပြည့်','iPad ကို အလျားလိုက်ထားပြီး Safari Share → Add to Home Screen ဖြင့် ဖွင့်ပါ။']
  };
  let fullscreenTipTimeout=0;
  function fullscreenTip(){
    let tip=document.getElementById('eg-landscape-fullscreen-tip');
    if(!tip){tip=document.createElement('div');tip.id='eg-landscape-fullscreen-tip';tip.setAttribute('role','status');tip.style.cssText='position:fixed;z-index:1800;left:6%;right:6%;bottom:max(25px,env(safe-area-inset-bottom));margin:auto;max-width:760px;padding:18px 22px;border-radius:18px;background:#09283deF;color:#fff;box-shadow:0 14px 50px #0009;font:800 clamp(15px,2.5vw,22px)/1.5 -apple-system,sans-serif;text-align:center;';document.body.appendChild(tip);}
    tip.textContent=(fullscreenWords[lang]||fullscreenWords.ja)[1];
    tip.hidden=false;
    clearTimeout(fullscreenTipTimeout);
    fullscreenTipTimeout=setTimeout(()=>{tip.hidden=true;},6500);
  }
  root.addEventListener('click',e=>{
    if(!e.target.closest('[data-kiosk-fullscreen]'))return;
    const el=document.documentElement;
    const request=el.requestFullscreen||el.webkitRequestFullscreen;
    if(!request){fullscreenTip();return;}
    try{
      const promise=request.call(el);
      if(promise&&typeof promise.then==='function'){
        promise.then(()=>{
          if(screen.orientation?.lock)screen.orientation.lock('landscape').catch(()=>{});
        }).catch(fullscreenTip);
      }
    }catch{fullscreenTip();}
  });
  bar.addEventListener('click',e=>{
    const b=e.target.closest('button[data-locale]');if(!b)return;
    lang=b.dataset.locale;refresh();resetIdle();
  });
  document.addEventListener('pointerdown',resetIdle,{passive:true});
  document.addEventListener('keydown',resetIdle);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){lang='ja';refresh();}});
  resetIdle();refresh();
})();
