(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
const icons=[
 '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 9h10l2 3v6H5v-6l2-3Z" stroke="currentColor" stroke-width="2"/><path d="M8 14h3M9.5 12.5v3M15.5 13.5h.01M17.5 15.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
 '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 20h12M8 20V9h8v11M7 9h10l-1-4H8L7 9Z" stroke="currentColor" stroke-width="2"/><path d="M12 5V3" stroke="currentColor" stroke-width="2"/></svg>',
 '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 18h12M8 18v-4h8v4M9 14l1-7h4l1 7M9 7h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
];
function patch(){const items=root.querySelectorAll('.v7-play-item');items.forEach((item,i)=>{const slot=item.querySelector('.v7-play-icon');if(!slot||slot.dataset.svgReady==='1')return;slot.dataset.svgReady='1';slot.innerHTML=icons[i]||icons[0]})}
new MutationObserver(()=>queueMicrotask(patch)).observe(root,{childList:true,subtree:true});patch();setTimeout(patch,80);
})();
