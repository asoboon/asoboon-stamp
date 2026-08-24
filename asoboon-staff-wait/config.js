/**
 * ASOBooN STAFF WAIT v0.4
 *
 * 入場枠は固定しない。
 * Airウェイト「外部向け待ち項目取得API」の dispFlg=true を正本にして、
 * その日に有効な入場回を自動生成する。
 */
window.ASOBOON_STAFF_CONFIG = {
  mode: "live",
  version: "0.4",
  refreshMs: 10000,

  waitTypesEndpoint: "https://cl.airwait.jp/WCLP/api/20160600/external/stateless/wait/type/get",
  reservationsEndpoint: "https://cl.airwait.jp/WCLP/api/external/stateless/reservations",

  /**
   * 入場回として扱う待ち項目の判定。
   * - 時刻を含む有効項目は対象
   * - 「すぐ入場」のように時刻がない入場受付も対象
   * - オレンジパス、ご待機者専用などは時間枠タブから除外
   */
  includeUntimedNamePatterns: ["すぐ入場"],
  excludeNamePatterns: ["オレンジパス", "ご待機者専用"],

  /**
   * 店頭枠の時刻がWEB枠より後ろに設定されている場合、同じ回として束ねる最大差。
   * 例:
   * 10:00 WEB + 10:15 店頭 -> 10:00
   * 13:30 WEB + 13:45 店頭 -> 13:30
   * 12:30 WEB + 12:50 店頭 -> 12:30
   * 10:00 WEB + 10:25 店頭 -> 10:00
   */
  mergeStoreAfterWebMinutes: 30
};
