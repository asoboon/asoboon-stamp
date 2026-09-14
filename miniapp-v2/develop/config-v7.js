(()=>{'use strict';
const base=window.ASOBOON_V2_COMMON||{};
const routes=Object.freeze({
  ...(base.routes||{}),
  price:'price',
  reservationdetail:'reservationdetail',
  info:'info'
});
const labels=Object.freeze({
  ...(base.labels||{}),
  reception:'受付',
  price:'料金',
  reservationdetail:'受付詳細',
  info:'その他のご案内'
});
window.ASOBOON_V2_COMMON=Object.freeze({
  ...base,
  version:'2.2.0-prototype-v7',
  routes,
  labels
});
})();
