/*
 * ASOBooN 継続AUTO 自動呼出 v13
 * AirWAIT公式回答（2026-08-28）反映:
 * callingMethodType 00=通常呼出 / 01=窓口呼出 / 02=両方
 */
window.ASOBOON_RECEPTION_CONFIG = Object.freeze({
  airwaitApiKey: "lYwyf5yYCOSpQjg9xAJ9Fp80phVvYDHI",
  airwaitStoreId: "KR01205179",
  ledgerWebAppUrl: "https://script.google.com/macros/s/AKfycbzpU0Tkz8U-HRxH0iFdjxZ3ZajkRkVRO4cFsG1dWA16RQfKbyJEtxP0tgPwjj_yrk8eNw/exec",

  nextDayOpenHour: 19,
  receptionCloseHour: 18,

  priceAdult: 600,
  priceChild: 900,
  maxTotalPeople: 10,
  childrenPerAdult: 3,

  blockedWaitTypeIds: ["0042"],
  blockedNamePatterns: ["テスト","ご待機者専用","待機者専用"],

  customerRefreshMs: 15000,

  // staffRefreshMs は旧AUTO本体との互換用。v13が可変監視へ置き換える。
  staffRefreshMs: 10000,
  staffFastRefreshMs: 10000,
  staffNormalRefreshMs: 30000,

  // 通常時30秒監視でも正常にfresh判定できる余裕を持たせる。
  maxFreshAgeMs: 45000,

  autoCallingPool: 10,
  autoCallGapMs: 1200,

  // AirWAIT公式回答の通常呼出指定値。
  normalCallingMethodType: "00",

  // AirWAIT待ち項目から実際の開始時刻を取得できるまでのフォールバック。
  staffFastWindows: [
    {start:"10:00",end:"10:45"},
    {start:"12:30",end:"13:00"},
    {start:"13:30",end:"14:00"},
    {start:"15:00",end:"15:30"}
  ],
  staffFastFirstSlotMinutes: 45,
  staffFastOtherSlotMinutes: 30,

  autoStopTime: "18:00",
  slotStartOverrides: {}
});
