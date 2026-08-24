/**
 * ASOBooN STAFF WAIT 設定
 *
 * IMPORTANT:
 * - GitHub Pages は公開Webです。秘密鍵・パスワード・管理者トークンをここへ書かないでください。
 * - 現在は demo モードで、そのままUIを試せます。
 * - Airウェイトの書き込みAPI仕様が確認できたら mode を "live" にして adapter 設定を追加します。
 */
window.ASOBOON_STAFF_CONFIG = {
  mode: "demo", // "demo" | "live"
  slots: ["10:00", "12:30", "15:00"],
  defaultSlot: "10:00",
  refreshMs: 12000,

  // live モード用。URL/認証方法はAPI仕様書確認後に確定してください。
  adapter: {
    reservationsEndpoint: "",
    actions: {
      call: "",
      hold: "",
      guide: "",
      updatePeople: ""
    }
  }
};
