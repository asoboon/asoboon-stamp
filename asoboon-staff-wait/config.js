/** ASOBooN STAFF WAIT v0.3
 * 受付番号帯では分類しない。
 * Airウェイト reservations[].number をそのまま表示し、
 * waitTypeName で 10:00 / 12:30 / 15:00 にまとめる。
 */
window.ASOBOON_STAFF_CONFIG = {
  mode: "live",
  version: "0.3",
  slots: ["10:00", "12:30", "15:00"],
  defaultSlot: "10:00",
  refreshMs: 10000,
  reservationsEndpoint: "https://cl.airwait.jp/WCLP/api/external/stateless/reservations",

  // 2026-08-21 に共有された Airウェイト「待ち項目・待ち時間」画面の名称を正本にする。
  // 数字の範囲ではなく、待ち項目名で各入場回へまとめる。
  slotWaitTypeNames: {
    "10:00": [
      "10時25分頃入場【土休日特定日】",
      "10時ご入場枠【WEB整理券】"
    ],
    "12:30": [
      "12時50分頃入場【土休日特定日】",
      "12時半ご入場枠【WEB整理券】"
    ],
    "15:00": [
      "15時15分頃入場時間【土休日特定日】",
      "15時ご入場枠【WEB整理券】"
    ]
  }
};
