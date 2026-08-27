/* Public settings only. Never put API keys or staff secrets in this file. */
window.QUEUE_PRODUCT_CONFIG = Object.freeze({
  productVersion: '1.0.0',
  demoMode: false,
  brandName: 'YOUR FACILITY',
  backendUrl: 'https://script.google.com/macros/s/REPLACE_ME/exec',
  homeUrl: './',
  callStatusUrl: './status.html',
  locale: 'ja-JP',
  timezone: 'Asia/Tokyo',
  staffKeyStorageKey: 'queue_product_staff_key',
  requestTimeoutMs: 10000,
  mutationPollMs: 650,
  mutationMaxPolls: 12,

  // Reception schedule
  receptionCloseHour: 18,
  nextDayOpenHour: 19,

  // Public UI / backend-authoritative validation hints
  maxTotalPeople: 10,
  childrenPerAdult: 3,
  priceAdult: 600,
  priceChild: 900,
  waiverText: '施設の利用ルール・スタッフの案内に従ってご利用ください。安全のため、保護者の方はお子さまから目を離さないようお願いいたします。',

  // Wait-type filtering
  blockedWaitTypeIds: [],
  blockedNamePatterns: ['テスト','ご待機者専用','待機者専用'],

  // Staff operations
  staffRefreshMs: 10000,
  autoCallingPool: 10,
  autoCallGapMs: 1200,
  autoStopTime: '18:00',
  slotStartOverrides: {}
});
