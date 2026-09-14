(()=>{'use strict';
const status=window.ASOBOON_HOME_STATUS_SNAPSHOT;
if(!status)return;
window.dispatchEvent(new CustomEvent('asoboon:v8-home-status',{detail:status}));
})();
