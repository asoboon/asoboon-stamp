/* ASOBooN hidden reservation RC3 — day/slot policy.
 * AirWAIT側は待ち項目を有効のまま維持し、ミニアプリ側で利用日に応じて表示/受付を絞る。
 * このファイルにAPIキー等の秘密情報を入れないこと。
 */
window.ASOBOON_RESERVATION_POLICY = Object.freeze({
  version: '2026-08-28-rc3.1',
  timezone: 'Asia/Tokyo',

  // ASOBooN営業日は毎日18:00 JSTで翌日に切り替える。
  // 18:00〜18:59は翌営業日の準備時間、19:00から翌日予約の解禁判定へ進む。
  businessDayCutoffHour: 18,

  // まずは現行検証で確認できている平日特定日をRC3標準にする。
  // 本番切替前に、実際の運用カレンダーに合わせて exceptions を埋める。
  modes: Object.freeze({
    weekdaySpecial: Object.freeze({
      label: '平日特定日',
      includeNamePatterns: ['平日特定日'],
      includeTimes: ['10:15', '13:45']
    }),
    twoHalfHour: Object.freeze({
      label: '2時間30分日',
      includeNamePatterns: ['土日祝', '2.5', '2時間30分'],
      includeTimes: ['10:00', '12:30', '15:00']
    }),
    closed: Object.freeze({
      label: '休館日',
      includeNamePatterns: [],
      includeTimes: []
    })
  }),

  // 曜日ベースの安全な初期値。
  // 月曜=2.5h、火曜=休館、土日=2.5h。
  // 水〜金は平日特定日の現行検証枠を使う。
  defaultModeByWeekday: Object.freeze({
    0: 'twoHalfHour',
    1: 'twoHalfHour',
    2: 'closed',
    3: 'weekdaySpecial',
    4: 'weekdaySpecial',
    5: 'weekdaySpecial',
    6: 'twoHalfHour'
  }),

  // 日別変更はここだけで行う。
  // 例: '2026-09-21': { mode: 'twoHalfHour' }
  // mode の代わりに waitTypeIds: ['0001','0002'] を指定すればIDで完全固定できる。
  exceptions: Object.freeze({
    '2026-08-28': Object.freeze({ mode: 'weekdaySpecial' })
  }),

  // AirWAIT上には存在していても、予約画面には絶対に出さない。
  blockedWaitTypeIds: Object.freeze(['0042']),
  blockedNamePatterns: Object.freeze(['テスト', 'ご待機者専用', '待機者専用', 'WEB']),

  // 前日19:00予約はMUST。ただしreserve/createに日付指定がないため、
  // AirWAITの正式な翌日登録方法が確認できるまでは誤予約防止のためfalse。
  // 確認後、このフラグと実装方式を同時に切り替える。
  nextDayReservationVerified: false,
  nextDayOpenHour: 19
});
