window.ASOBOON_CALLTIME_CONFIG = Object.freeze({
  version: "5.3.6",
  // Apps Scriptのウェブアプリをデプロイ後、/exec URLに置換
  webAppUrl: "https://script.google.com/macros/s/AKfycbxkI54t2MdxrF-y7JQ-FhwUL4xsHvxWyxfZrQmn5Uu4JzKXhgm0QT8W7sVXpXzkpOKwWA/exec",
  parkingUrl: "./home.html?mode=before&view=parking",
  callWindowMinutes: 30,
  monitorPollMs: 2000,
  safetyFullPollMs: 15000,
  degradedPollMs: 5000,
  maxTrustedGapMs: 15000,
  lookupRetryMs: 5000,
  lookupRetryCount: 12,
  backendHealthRetryMs: 5000,
  backendHealthCheckMs: 30000,
  autoResumeRetryMs: 5000
});
