/** ASOBooN STAFF WAIT v0.2 */
window.ASOBOON_STAFF_CONFIG = {
  mode: "live",
  slots: ["10:00", "12:30", "15:00"],
  defaultSlot: "10:00",
  refreshMs: 10000,
  reservationsEndpoint: "https://cl.airwait.jp/WCLP/api/external/stateless/reservations",
  // 土休日特定日：Airウェイト「受付番号の範囲」正本
  slotRanges: {
    "10:00": [[1001, 1199], [2001, 2199]],
    "12:30": [[1201, 1399], [2201, 2399]],
    "15:00": [[1501, 1699], [2501, 2699]]
  }
};
