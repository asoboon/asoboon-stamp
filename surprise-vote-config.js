/*
 * ASOBooN サプライズイベント投票 設定
 *
 * surprise-vote-backend.gs を専用GoogleスプレッドシートのApps Scriptへ
 * デプロイ後、発行された /exec URL を API_URL に設定してください。
 *
 * 既存の受付・呼出・ランキングGASとは分離します。
 */
window.ASOBOON_SURPRISE_VOTE_CONFIG = Object.freeze({
  API_URL: "https://script.google.com/macros/s/AKfycbx2feW0JIP2aPmS2FX62D07etcaZE4Iq3FtqViLtpp0lsk0Z9aw3YuBQa94gtpH5Z3I/exec",
  LIFF_ID: "2009888671-57TOefc3",
  HOME_URL: "./home.html?mode=inside",
  POLL_INTERVAL_MIN_MS: 25000,
  POLL_INTERVAL_MAX_MS: 35000,
  COMPLETED_POLL_INTERVAL_MIN_MS: 45000,
  COMPLETED_POLL_INTERVAL_MAX_MS: 60000,
  SYNC_IDLE_MIN_MS: 1200,
  SYNC_IDLE_MAX_MS: 1800,
  SYNC_TAP_BATCH_MIN: 17,
  SYNC_TAP_BATCH_MAX: 23,
  RETRY_MIN_MS: 500,
  RETRY_MAX_MS: 2000,
  RESUME_REFRESH_STALE_MS: 10000,
  INITIAL_JITTER_MAX_MS: 3000,
  FINAL_SYNC_GRACE_MS: 20000,
  DAILY_RESET_HOUR: 18,
  REQUEST_TIMEOUT_MS: 12000,
  MAX_POINTS: 100
});
