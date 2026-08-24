/*
 * ASOBooN 入場受付 / 自動呼出
 * GitHub upload package v0.5
 *
 * GAS Web App URL は設定済みです。
 * AirWAIT APIキーだけ、現在利用中のキーを下の1か所へ入れてください。
 *
 * STAFF_KEY はここには入れません。
 * スタッフ画面を初回表示した時に端末へ入力します。
 */
window.ASOBOON_RECEPTION_CONFIG = Object.freeze({
  airwaitApiKey: "ここに現在利用中のAirWAIT_APIキーを入れる",
  airwaitStoreId: "KR01205179",

  ledgerWebAppUrl: "https://script.google.com/macros/s/AKfycbzpU0Tkz8U-HRxH0iFdjxZ3ZajkRkVRO4cFsG1dWA16RQfKbyJEtxP0tgPwjj_yrk8eNw/exec",

  // 受付運用時間（日本時間）
  // 00:00〜17:59 = 本日
  // 18:00〜18:59 = 受付準備中
  // 19:00〜23:59 = 翌日
  nextDayOpenHour: 19,
  receptionCloseHour: 18,

  priceAdult: 600,
  priceChild: 900,
  maxTotalPeople: 10,
  childrenPerAdult: 3,

  blockedWaitTypeIds: ["0042"],
  blockedNamePatterns: ["テスト", "ご待機者専用", "待機者専用"],

  customerRefreshMs: 15000,
  staffRefreshMs: 5000,
  defaultCallingPool: 5
});
