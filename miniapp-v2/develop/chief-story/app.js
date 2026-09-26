(()=>{'use strict';

const facilityQuotes = [
  ["2026/4/26｜5回目以上｜絶対来る｜さいたま市","どなたも子ども好きな様子が伝わり、いつも親切な対応に感謝するばかりです。4才の子ども自身が『アソブーン行きたい』とリクエストしてくるほど気に入っています。砂場の砂の安全対策を初めてお聞きして、改めてボーネルンドさんの徹底ぶりに驚きました。他のボーネルンドの遊び場に比べてとても利用しやすい価格設定で助かります。"],
  ["2026/7/27｜5回目以上｜絶対来る｜草加市","1人で2人の子供を連れてきているので、どうしてもどちらかを見ることができない時間が出てきます。そんな時にどのスタッフの方も楽しく子供と遊んだり、おしゃべりをしてくれるので本当に助かります。子供も親切に対応してくれた方の顔は覚えているようで『この間遊んでくれた人だ！』と言っていました。来るたびに何かしら新しいものが増えているのでいつまでも飽きずにいられます。"],
  ["2026/3/9｜初回｜きっと来る｜練馬区","作ってたものを他のお友達に壊されてしまい泣いてしまって諦めた娘に、我慢したことを励ましシールを渡しに来てくれてた。壊されたものも少し直してくれていた。悔しかったり嫌な気持ちになっても、それを発達成長によい経験になる対応をしてくれた。安心して遊びに連れてこれると感じた。"],
  ["2026/4/10｜初回｜来る｜千葉県流山市","いままでロープのある遊具は怖く中々できず諦めてしまっていた娘（4歳）が、スタッフさんに声をかけてもらいながら渡りきった姿をみて感動しました😊"],
  ["2025/4/26｜初回｜絶対来る｜世田谷区","今まで行った室内遊び場の中で1番よかったです。スタッフさんもみな優しくて、施設も綺麗で、少し遠いですが、また来たいと思いました。"],
  ["2025/11/3｜5回目以上｜絶対来る｜川口市","毎回子供が送風機や宝探し楽しみにしています。他にも声かけていただき嬉しそうです(^^) どこに行きたいと聞くと今日もアソブーンと即答です。かなり気に入ってます"],
  ["2025/6/22｜5回目以上｜絶対来る｜川口市","特にボールプールは汚れがたまりやすく、床がザラザラしたりするので他の施設だと避けたりします。こちらはキレイなので安心して遊ばせられます。また空調設備も行き届いており、子供が夏でも目一杯遊んでも熱中症の危険がないので嬉しそうです。"],
  ["2025/11/9｜5回目以上｜絶対来る｜さいたま市","値段が安く、スタッフの皆さんがいつも笑顔で大好きな場所です。こんなにスタッフの方が親切でニコニコしている施設は多くないと思います。"],
  ["2026/8/31｜5回目以上｜絶対来る｜草加市","くるたび子供が思いっきり楽しんでいる。親は涼しく広くて過ごしやすいところで見守れるのは本当に助かる。ずっと今のままであり続けて欲しい。"],
  ["2026/9/22｜初回｜絶対来る｜世田谷区","パラバルーンのイベントは学校や幼稚園さながらの進行で素晴らしかったです！高い遊具も見守ってくださっており安心でした。"],
  ["2026/9/6｜5回目以上｜絶対来る｜新宿区","イベントはいつも子供のコントロールがうまく勉強になります。ボールを集めたり見守ってくださるスタッフさんもありがたいです。照明や遊具もリニューアル・追加されていて進化を感じます。"],
  ["2026/3/13｜5回目以上｜絶対来る｜さいたま市","いつも明るく笑顔で対応ありがとうございます。理不尽な親もいると思いますが、皆さんのおかげで助かっている家庭はたくさんあると思います"]
];

const personalQuotes = [
  ["2026/04/05｜初回｜川口市｜絶対来る","パラバルーンのお兄さんが最高でした！／とにかくパラバルーンのお兄さんが最高でした！！お兄さんに会いにまた来たい！"],
  ["2026/06/14｜初回｜横浜市｜絶対来る","跳び箱のお兄さんが子どもたちに優しく丁寧な対応で遊びを盛り上げてくれていて感動した"],
  ["2026/06/21｜初回｜中野区｜絶対来る","午前中のイベントのお兄さんがとても素敵でした。声掛けがとても丁寧で、安心感がありました。"],
  ["2026/05/02｜3回目｜川口市｜絶対来る","パラバルーンやってたお兄さんの子ども達との接し方がわかってる方なんだなー上手だなーとかんじた！"],
  ["2026/07/19｜2回目｜川口市","パラバルーンのお兄さんの説明の仕方、誘導の仕方が素晴らしかったです！"],
  ["2026/09/06｜3回目｜中野区","パラバルーンのイベントがよかったです！お兄さんの声かけが上手！！！"],
  ["2026/06/01｜初回｜草加市","男性のスタッフの方が、トランポリンの所で、跳び箱を挑戦させていたり、ボールプールの所で、風を飛ばして、ボールを浮かせて飛ばしたりしていて、遊びの楽しみ方を工夫していたのが、良かったと思います！"],
  ["2026/06/26｜初回｜絶対来る","外で遊んでいたら、男性の方が水遊びの所で子供と一緒に遊んでくれた、子供の扱いがとてもうまかった。"],
  ["2026/08/19｜初回","みなさん子供のために一生懸命にやってくださっていて、特に夏の暑い中外遊びに付き合ってくださっていた男性スタッフの方はありがたいと思いました。"],
  ["2025/11/09｜4回目｜川口市","妊婦なのであまりうごけず積極的に遊んでくださる男性のスタッフの方、ありがたかったです。"]
];

const qwall = rows => '<div class="quote-wall">'+rows.map(q=>'<article class="quote"><small>'+q[0]+'</small><p>「'+q[1]+'」</p></article>').join('')+'</div>';

const slides = [
  {k:"ASOBooN",t:"選ばれるための理由を、更新し続ける。",h:'<p class="lead">川口ハイウェイオアシスの親子の遊び場。<br>遊び・安全・スタッフ・仕組みを、少しずつアップデートしています。</p><div class="slide-footer">左右にスワイプしてご覧ください。</div>'},
  {k:"ABOUT",t:"ASOBooNって？",h:'<div class="slide-grid"><div class="mini-card"><b>2022.04.25 OPEN</b><span>川口ハイウェイオアシス内</span></div><div class="mini-card"><b>0歳〜小学6年生</b><span>親子で遊ぶ屋内外の遊び場</span></div><div class="mini-card"><b>ボーネルンド × 首都高速道路サービス</b><span>遊びの専門性と高速道路施設の新しい体験</span></div></div><p class="slide-footer">「遊具がある場所」だけではなく、親子の体験そのものを考えています。</p>'},
  {k:"VOICE",t:"まず、施設全体へのアンケートです。",h:qwall(facilityQuotes)+'<p class="slide-footer">※利用者アンケートの自由記述（原文）です。個人の感想であり、安全性や効果を保証するものではありません。</p>'},
  {k:"VOICE",t:"ちなみに、私個人に限って言えば。",h:qwall(personalQuotes)+'<p class="slide-footer">※利用者アンケートの自由記述（原文）です。</p>'},
  {k:"CHIEF",t:"チーフの仕事を、全部書き出してみた。",h:'<div class="big-number">96<small>の仕事</small></div><div class="pill-row"><span class="pill">受付</span><span class="pill">安全</span><span class="pill">スタッフ</span><span class="pill">売上</span><span class="pill">イベント</span><span class="pill">SNS</span><span class="pill">LINE</span><span class="pill">予約</span><span class="pill">行政・本社調整</span></div><p class="slide-footer">でも、大切にしてきたのは「仕事の数」ではありません。</p>'},
  {k:"BRAND",t:"何をもって、アソブーンらしさとするか。",h:'<p class="lead">ロゴや色だけではなく、<span class="accent">現場の一つひとつの判断</span>がブランドになる。</p><div class="slide-grid two"><div class="mini-card"><b>子どもへの関わり</b><span>止める？ 見守る？ 背中を押す？</span></div><div class="mini-card"><b>困りごとへの向き合い方</b><span>注意を増やす？ 環境を変える？</span></div></div>'},
  {k:"IDEA 01",t:"「注意する」より、環境を変える。",h:'<div class="slide-grid two"><div class="mini-card"><b>BEFORE</b><span>会計中に離れる／カード端末に触る<br>→「ここにいて」「触っちゃダメ」</span></div><div class="mini-card"><b>AFTER</b><span>触ってよいもの・気になるものを用意<br>→ 興味の向きを変える</span></div></div><p class="slide-footer">声かけだけで制御するより、自然に良い行動が生まれる環境を考える。</p>'},
  {k:"IDEA 02",t:"禁止ではなく、遊びの方向を変える。",h:'<div class="slide-grid two"><div class="mini-card"><b>「投げないで」</b><span>ではなく</span><p class="lead accent">「あそこを狙おう」</p></div><div class="mini-card"><b>「ぶつからないで」</b><span>だけではなく</span><p class="lead green">ぶつかっても大丈夫な環境へ</p></div></div>'},
  {k:"IDEA 03",t:"「暑い」を、ひとつにしない。",h:'<div class="slide-grid"><div class="mini-card"><b>高所・待機列</b><span>スポットクーラー＋ダクト<br>必要な場所へ冷気</span></div><div class="mini-card"><b>休憩スポット</b><span>テント＋スポットクーラー<br>身体を直接冷やす</span></div><div class="mini-card"><b>窓面</b><span>熱の侵入を抑える<br>原因ごとに打ち手を変える</span></div></div>'},
  {k:"IDEA 04",t:"モノではなく、必要な状態から考える。",h:'<div class="slide-grid"><div class="mini-card"><b>足を洗いたい</b><span>→ 不快感なく洗える状態<br>→ 洗濯機パン</span></div><div class="mini-card"><b>着替えたい</b><span>→ 人目を避けられる状態<br>→ テント</span></div><div class="mini-card"><b>水遊びしたい</b><span>→ 濡れても遊びやすい状態<br>→ 人工芝など</span></div></div>'},
  {k:"IDEA 05",t:"「やってほしい」を、体験に変える。",h:'<div class="slide-grid"><div class="mini-card"><b>アンケート</b><span>答えてほしい → ガチャ</span></div><div class="mini-card"><b>LINE登録</b><span>登録してほしい → NFCスタンプラリー</span></div><div class="mini-card"><b>お手紙</b><span>書いてほしい → 返事＋展示</span></div></div><p class="slide-footer">運営側のお願いを、お客さまにとっての「やってみたい」に変える。</p>'},
  {k:"PLAY",t:"RISKY PLAY × EDUTAINMENT",h:'<div class="slide-grid two"><div class="mini-card"><b>RISKY PLAY</b><p class="lead">少しドキドキする挑戦を、<br>自分で選ぶ遊び。</p></div><div class="mini-card"><b>EDUTAINMENT</b><p class="lead">「楽しい」が、自然と<br>学びになる体験。</p></div></div><p class="slide-footer">どちらも「子どもが主役」であることを大切にします。</p>'},
  {k:"SAFETY",t:"RISK ≠ HAZARD",h:'<div class="slide-grid two"><div class="mini-card"><b>RISK</b><span>子ども自身が見て、考えて、挑戦するか選べる危険性。</span></div><div class="mini-card"><b>HAZARD</b><span>子ども自身では気づきにくい、判断しにくい危険性。こちらは大人が取り除く。</span></div></div><p class="slide-footer">安全を軽く考えるのではなく、「何を見守り、何を除くか」を分けて考えます。</p>'},
  {k:"EDUTAINMENT",t:"遊び × 学び。",h:'<div class="slide-grid"><div class="mini-card"><b>キッザニア</b><span>職業・社会体験 → 仕事・経済・社会</span></div><div class="mini-card"><b>ちきゅうのにわ</b><span>自然・宇宙・ワークショップ → 地球・環境</span></div><div class="mini-card"><b>PLAY! PARK ERIC CARLE</b><span>絵本・身体・アート → 感覚・表現・好奇心</span></div></div>'},
  {k:"ASOBOON PLAY",t:"ASOBooNにも、すでにある。",h:'<div class="pill-row"><span class="pill">高い場所に登る</span><span class="pill">難しい遊具に挑戦</span><span class="pill">道具の使い方を考える</span><span class="pill">ごっこ遊びで人と関わる</span><span class="pill">川口の鋳物に触れる</span><span class="pill">イベントで初めてを体験する</span></div><p class="slide-footer">無意識にやってきたことを、言葉にして判断基準にする。</p>'},
  {k:"TEAM",t:"この2つを、チームの判断基準にする。",h:'<p class="lead">同じ行動を覚えるのではなく、<span class="accent">同じ目的と判断軸</span>を持つ。</p><div class="slide-grid two"><div class="mini-card"><b>何のため？</b><span>目的・前提・到達地点をそろえる。</span></div><div class="mini-card"><b>なぜ？</b><span>答えではなく、判断できる材料を共有する。</span></div></div>'},
  {k:"TEAM",t:"改善を、個人の工夫で終わらせない。",h:'<div class="slide-grid"><div class="mini-card"><b>01 方向をそろえる</b><span>目的・前提・到達地点</span></div><div class="mini-card"><b>02 「なぜ」を共有</b><span>判断できる材料を渡す</span></div><div class="mini-card"><b>03 挑戦をつくる</b><span>少し先の役割を任せる</span></div></div><div class="slide-grid two"><div class="mini-card"><b>04 経験を残す</b><span>振り返り → 研修 → 仕組み化</span></div><div class="mini-card"><b>GOAL</b><span>次の改善が、自分以外から生まれる。</span></div></div>'},
  {k:"KPI",t:"来場者数は減少。一方で、再来場層の回答割合は上昇。",h:'<div class="slide-grid two"><div class="mini-card"><b>2026年度 4〜8月 来場者数</b><div class="big-number">65,007<small>人</small></div><span>前年比 −3.0%</span></div><div class="mini-card"><b>「2回目以上」回答割合</b><div class="big-number">5/5<small>か月</small></div><span>前年超</span></div></div><p class="slide-footer">※「2回目以上」はアンケート回答者の構成比で、実際のリピート率そのものではありません。</p>'},
  {k:"POPULATION",t:"川口市 0〜10歳は、4年間で −10.9%。",h:'<div class="slide-grid two"><div class="mini-card"><b>2022</b><div class="big-number">52,153<small>人</small></div></div><div class="mini-card"><b>2026</b><div class="big-number">46,488<small>人</small></div></div></div><p class="lead">−5,665人。100人いたら約89人分になるイメージ。</p><p class="slide-footer">出典：川口市「かわぐちの人口 第4表 年齢別人口」各年1月1日現在</p>'},
  {k:"MARKET",t:"子どもの数は減っても、こども関連市場は伸びている。",h:'<div class="slide-grid two"><div class="mini-card"><b>2024年度</b><div class="big-number">約10.85<small>兆円</small></div></div><div class="mini-card"><b>2025年度 推計</b><div class="big-number">11.16<small>兆円</small></div><span>前年比 +2.9%</span></div></div><p class="slide-footer">出典：矢野経済研究所。6分野34市場の合計で、室内遊び場だけの市場規模ではありません。</p>'},
  {k:"MARKET",t:"30億円。",h:'<div class="big-number">30<small>億円</small></div><p class="lead">2026年4月30日、アソビュー株式会社が全国65店舗の「The Kids」を完全子会社化。</p><div class="pill-row"><span class="pill">予約プラットフォーム</span><span class="pill">施設向けSaaS</span><span class="pill">実店舗</span></div><p class="slide-footer">出典：アソビュー株式会社 2026/4/30</p>'},
  {k:"MARKET",t:"ちきゅうのにわ｜2023.03 → 2026",h:'<div class="big-number">19<small>店舗</small></div><p class="lead">2026年9月19日時点で営業中19店舗。</p><p class="slide-footer">新しい遊び場ブランドが、短期間で全国へ広がっています。</p>'},
  {k:"SAITAMA",t:"埼玉でも、親子の「選択肢」が増えている。",h:'<div class="slide-grid"><div class="mini-card"><b>Muchu Planet</b><span>本 × デジタル</span></div><div class="mini-card"><b>HILLTOP Kids Park</b><span>親の時間 × 子どもの遊び</span></div><div class="mini-card"><b>FUN VILLAGE</b><span>IP × 大型体験</span></div><div class="mini-card"><b>しまぐるランド</b><span>乳幼児特化 × 絵本IP</span></div><div class="mini-card"><b>ドコドコ</b><span>物語 × 没入体験</span></div><div class="mini-card"><b>ちきゅうのにわ</b><span>遊び × 学び × 五感</span></div></div><p class="slide-footer">さらに、埼玉おもちゃ美術館＝木育、こどもふっかパーク＝大型施設×公共価格など、競争軸そのものが広がっています。</p>'},
  {k:"WHY CHOOSE",t:"選ばれる理由を、更新し続ける。",h:'<div class="pill-row"><span class="pill">少子化</span><span class="pill">競争増</span><span class="pill">資本流入</span></div><p class="lead" style="margin-top:18px">一度選ばれる。<br><span class="accent">もう一度選ばれる。</span></p><p class="slide-footer">同じ魅力を同じように伝えるだけではなく、選ばれるための理由をつくり続ける。</p>'},
  {k:"CUSTOMER JOURNEY",t:"お客様は、ASOBooNにどうたどり着く？",h:'<div class="timeline"><div><b>01 知る</b><span>SNS・検索・口コミ</span></div><div><b>02 行きたい</b><span>写真・体験・料金</span></div><div><b>03 予約</b><span>LINE・予約</span></div><div><b>04 来場</b><span>呼出・案内</span></div><div><b>05 また来たい</b><span>余韻・季節・再接続</span></div></div><p class="slide-footer">館内に入ってからだけが「体験」ではありません。</p>'},
  {k:"UPDATE",t:"数字 × アンケート × 現場の声",h:'<p class="lead">すべてを一度に変えるのではなく、<span class="accent">今どこを良くするか</span>を決める。</p><div class="pill-row"><span class="pill">知る</span><span class="pill">行きたい</span><span class="pill">予約</span><span class="pill">来場</span></div><p class="slide-footer">重点は「原因の断定」ではなく、数字・アンケート・現場の声から置く仮説です。</p>'},
  {k:"NOW → NEXT",t:"顧客導線を、ひとつずつアップデートする。",h:'<div class="slide-grid two"><div class="mini-card"><b>NOW</b><span>Instagram／写真・動画／当日受付＋LINE／スタッフ案内／日々の体験改善</span></div><div class="mini-card"><b>NEXT</b><span>認知導線を増やす／来場判断を助ける／事前予約＋一本化／LINEで呼出状況／新体験＋再来場接点</span></div></div><p class="slide-footer">大きな一発ではなく、一つひとつの接点を改善する。</p>'},
  {k:"ASOBooN",t:"一度選ばれる。もう一度選ばれる。",h:'<p class="lead">子どもが「また行きたい」と言う。<br>保護者が「また連れて行きたい」と思う。<br><br>その理由を、これからも更新し続けます。</p><div class="slide-footer">ASOBooN｜川口ハイウェイオアシス</div>'}
];

const words = [
  {tag:"IT / CLOUD",name:"SaaS",short:"インターネット経由で使う「完成したソフト」のサービス。",detail:"Software as a Service の略。自分のパソコンに買い切りソフトを入れるというより、提供会社がソフトを運用・更新し、利用者はブラウザなどから使います。",aso:"この資料では、予約・電子チケット・在庫管理など、施設運営を支える仕組みの説明で登場します。",source:"https://cloud.google.com/saas?hl=ja"},
  {tag:"PLAY",name:"Risky Play",short:"少しドキドキする挑戦を、子ども自身が選ぶ遊び。",detail:"結果が完全には読めず、スピード・高さ・バランスなどに挑戦する遊びを指す考え方です。『危険を放置する』という意味ではありません。",aso:"ASOBooNでは、挑戦を全部止めるのではなく、子どもが判断できる範囲か、大人が取り除くべき危険かを分けて考える材料にしています。",source:"https://cps.ca/en/documents/position/outdoor-risky-play"},
  {tag:"SAFETY",name:"Risk と Hazard",short:"見守れる挑戦と、取り除くべき危険を分けて考える。",detail:"国土交通省の遊具安全指針では、子どもの遊びに内在するリスクと、事故につながるハザードを区別して安全確保を考えています。",aso:"ASOBooNでも『何でも止める』ではなく、安全確認を最優先にしながら、見守る・支える・止めるを判断します。保護者の見守りも必要です。",source:"https://www.mlit.go.jp/toshi/park/toshi_parkgreen_tk_000083.html"},
  {tag:"LEARNING",name:"Edutainment",short:"Education（教育）× Entertainment（楽しさ）。",detail:"楽しさや体験の中に学びを組み込み、遊びながら知る・考える・試すことにつなげる考え方です。",aso:"ASOBooNでは『勉強させる』より、夢中で遊んだ結果として気づきや学びが残る体験を目指します。",source:"https://www.sciencedirect.com/science/article/pii/S1877042815023411"},
  {tag:"ASOBOON",name:"プレイリーディング",short:"子どもが主役のまま、遊びが広がるきっかけをつくる。",detail:"ASOBooNで大切にしている関わり方の一つ。スタッフが答えを決めるのではなく、声かけや実演で遊びの入口をつくり、子どもが夢中になったら一歩引きます。",aso:"『提案する → 一緒に遊び込む → 子どもが自分で進めたら身を引く』というイメージです。",source:""},
  {tag:"MARKETING",name:"Customer Journey",short:"知る → 行きたい → 予約 → 来場 → また来たい、まで全部が体験。",detail:"お客様が施設を知ってから、実際に利用し、その後また来たいと思うまでの一連の流れを捉える考え方です。",aso:"ASOBooNでは館内だけでなく、SNS、検索、予約、呼出、案内、再来場までを一つの体験として改善します。",source:""},
  {tag:"BUSINESS",name:"垂直統合",short:"別々だった事業の段階を、一つのグループでつなぐこと。",detail:"たとえば『集客する』『業務システムを提供する』『実店舗を運営する』といった異なる段階を一体で持つ考え方です。",aso:"アソビューはThe Kidsの子会社化発表で、予約プラットフォーム・施設向けSaaS・実店舗を垂直統合すると説明しています。",source:"https://www.asoview.co.jp/news/articles/nk03IkYG"},
  {tag:"DATA",name:"「2回目以上」回答割合",short:"今回の資料では、実際のリピート率そのものではありません。",detail:"アンケートに答えてくれた方の中で『2回目以上』と答えた人の割合です。回答者の偏りもあり得るため、全来場者の再来場率と同じ意味ではありません。",aso:"数字を強く見せすぎず、『良い兆しの可能性』として他のデータや現場の声と一緒に見ています。",source:""}
];

const sources = [
  ["Google Cloud｜SaaSとは","https://cloud.google.com/saas?hl=ja"],
  ["国土交通省｜都市公園における遊具の管理","https://www.mlit.go.jp/toshi/park/toshi_parkgreen_tk_000083.html"],
  ["Canadian Paediatric Society｜Outdoor risky play","https://cps.ca/en/documents/position/outdoor-risky-play"],
  ["ScienceDirect｜Theoretical View to The Approach of The Edutainment","https://www.sciencedirect.com/science/article/pii/S1877042815023411"],
  ["アソビュー株式会社｜The Kidsを完全子会社化","https://www.asoview.co.jp/news/articles/nk03IkYG"]
];

const track=document.getElementById('slideTrack'), dots=document.getElementById('dots');
const now=document.getElementById('pageNow'), total=document.getElementById('pageTotal');
const prev=document.getElementById('prevSlide'), next=document.getElementById('nextSlide');
let index=0;

track.innerHTML=slides.map((s,i)=>'<article class="slide-wrap" data-i="'+i+'"><section class="slide"><div class="kicker">'+s.k+'</div><h2>'+s.t+'</h2>'+s.h+'</section></article>').join('');
dots.innerHTML=slides.map((_,i)=>'<span class="dot'+(i===0?' active':'')+'"></span>').join('');
total.textContent=String(slides.length);

const wraps=[...track.querySelectorAll('.slide-wrap')], dotEls=[...dots.children];
function setIndex(i,scroll){
  index=Math.max(0,Math.min(slides.length-1,i));
  now.textContent=String(index+1);
  prev.disabled=index===0;next.disabled=index===slides.length-1;
  dotEls.forEach((d,n)=>d.classList.toggle('active',n===index));
  if(scroll)wraps[index].scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
}
prev.addEventListener('click',()=>setIndex(index-1,true));
next.addEventListener('click',()=>setIndex(index+1,true));

let raf=0;
track.addEventListener('scroll',()=>{
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(()=>{
    const x=track.scrollLeft+track.clientWidth/2;
    let best=0,dist=Infinity;
    wraps.forEach((el,i)=>{const c=el.offsetLeft+el.offsetWidth/2,d=Math.abs(c-x);if(d<dist){dist=d;best=i}});
    if(best!==index)setIndex(best,false);
  });
},{passive:true});
track.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')setIndex(index-1,true);if(e.key==='ArrowRight')setIndex(index+1,true)});

const wordGrid=document.getElementById('wordGrid');
wordGrid.innerHTML=words.map(w=>'<article class="word-card"><div class="word-tag">'+w.tag+'</div><h2>'+w.name+'</h2><p class="short">'+w.short+'</p><details><summary>もう少し詳しく</summary><p>'+w.detail+'</p><p><b>ASOBooNでは：</b>'+w.aso+'</p>'+(w.source?'<a href="'+w.source+'" target="_blank" rel="noopener noreferrer">参考資料を開く ↗</a>':'')+'</details></article>').join('');

document.getElementById('sourceList').innerHTML=sources.map(s=>'<a href="'+s[1]+'" target="_blank" rel="noopener noreferrer">'+s[0]+' ↗</a>').join('');

const tabs=[...document.querySelectorAll('.tab')];
const panels={slides:document.getElementById('slidesPanel'),words:document.getElementById('wordsPanel')};
tabs.forEach(btn=>btn.addEventListener('click',()=>{
  const key=btn.dataset.tab;
  tabs.forEach(b=>b.classList.toggle('active',b===btn));
  Object.entries(panels).forEach(([k,p])=>p.classList.toggle('active',k===key));
  document.querySelector('.page-count').style.visibility=key==='slides'?'visible':'hidden';
  if(key==='slides')requestAnimationFrame(()=>setIndex(index,false));
  scrollTo({top:0,behavior:'smooth'});
}));

setIndex(0,false);
})();