/* Public settings only. Never put API keys or staff secrets in this file. */
window.QUEUE_PRODUCT_CONFIG = Object.freeze({
  productVersion: '1.0.0',
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
  maxTotalPeople: 10,
  childrenPerAdult: 3,
  priceAdult: 600,
  priceChild: 900
});
