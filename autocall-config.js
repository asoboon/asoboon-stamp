/*
 * ASOBooN 入場受付 / 時刻連動 自動呼出
 * Persistent AUTO v0.9
 *
 * GAS URL は設定済みです。
 * AirWAIT APIキーだけ、現在利用中のキーを下の1か所へ入れてください。
 *
 * STAFF_KEY はGitHubには入れません。
 * スタッフ画面で端末に1回だけ保存します。
 */
window.ASOBOON_RECEPTION_CONFIG = Object.freeze({
  airwaitApiKey: "ここに現在利用中のAirWAIT_APIキーを入れる",
  airwaitStoreId: "KR01205179",

  ledgerWebAppUrl: "https://script.google.com/macros/s/AKfycbzpU0Tkz8U-HRxH0iFdjxZ3ZajkRkVRO4cFsG1dWA16RQfKbyJEtxP0tgPwjj_yrk8eNw/exec",

  // 受付運用時間（日本時間）
  // 00:00〜17:59 = 本日
  // 18:00〜18:59 = 受付準備中
  // 19:00〜23:59 = 翌日受付
  nextDayOpenHour: 19,
  receptionCloseHour: 18,

  priceAdult: 600,
  priceChild: 900,
  maxTotalPeople: 10,
  childrenPerAdult: 3,

  blockedWaitTypeIds: ["0042"],
  blockedNamePatterns: ["テスト", "ご待機者専用", "待機者専用"],

  customerRefreshMs: 15000,

  // ===== 自動呼出 =====
  staffRefreshMs: 10000,

  // AirWAITと共有台帳の両方を正常取得できた直後だけAUTOを許可
  // 通信断・取得失敗時に古い情報のまま呼出し続けないための安全値
  maxFreshAgeMs: 20000,

  // 各回で「呼出中」を最大10組に保つ
  autoCallingPool: 10,

  // 1回の補充で連続呼出する際の間隔
  autoCallGapMs: 1200,

  // この時刻以降は「呼出だけ休止」します。
  // AUTO ON/OFF の設定自体はGASに保持され、翌日もそのままです。
  autoStopTime: "18:00",

  // 通常は待ち項目名から開始時刻を自動取得します。
  // 例: "10:00の回", "12:30〜", "14時の回", "13時30分"
  //
  // 後日、特殊日などで名前から読めない枠が出た時だけ
  // waitTypeId: "HH:MM" を追加すれば対応できます。
  slotStartOverrides: {
    // "0001": "10:00"
  }
});
