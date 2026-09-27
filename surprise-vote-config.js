/*
 * ASOBooN サプライズイベント投票 設定
 *
 * surprise-vote-backend.gs を専用GoogleスプレッドシートのApps Scriptへ
 * デプロイ後、発行された /exec URL を API_URL に設定してください。
 *
 * 既存の受付・呼出・ランキングGASとは分離します。
 */
window.ASOBOON_SURPRISE_VOTE_CONFIG = Object.freeze({
  API_URL: "",
  LIFF_ID: "2009888671-57TOefc3",
  HOME_URL: "./home.html?mode=inside",
  POLL_INTERVAL_MS: 8000,
  HOME_REFRESH_MS: 60000,
  SYNC_IDLE_MS: 650,
  SYNC_TAP_BATCH: 8,
  REQUEST_TIMEOUT_MS: 12000,
  MAX_POINTS: 100
});
