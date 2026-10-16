/* ASOBooN venue tablet: one-shot prop theater. No new instructions, controls, sounds or network. */
(function ASOBooNDelightLayer1(){
  'use strict';
  if(window.__ASOBOON_DELIGHT_LAYER1__)return;
  const root=document.getElementById('exitGuideV2');
  if(!root)return;
  window.__ASOBOON_DELIGHT_LAYER1__=true;

  const routes=new Set(['family','adult','adult-yes','leave']);
  const style=document.createElement('style');
  style.id='eg-delight-layer1';
  style.textContent=`
    /* Replace older endless prop loops with gentle one-shot acting. */
    #exitGuideV2 .eg-detail .eg-receipt,
    #exitGuideV2 .eg-detail .eg-two-holders,
    #exitGuideV2 .eg-detail .eg-yellow-picture .eg-holder {
      animation:none!important;
    }
    @media(prefers-reduced-motion:no-preference){
    #exitGuideV2[data-delight-route="family"]:not(.eg-motion-off) .eg-detail .eg-receipt {
      animation:eg-delight-peek .88s .03s both ease-in-out!important;
      transform-origin:50% 95%;
    }
    #exitGuideV2[data-delight-route="family"]:not(.eg-motion-off) .eg-detail .eg-two-holders {
      animation:eg-delight-holders .94s .08s both ease-in-out!important;
      transform-origin:50% 75%;
    }
    #exitGuideV2[data-delight-route="family"]:not(.eg-motion-off) .eg-detail .eg-two-holders > svg {
      animation:eg-delight-key .76s .13s both ease-in-out!important;
      transform-origin:50% 15%;
    }
    #exitGuideV2[data-delight-route="adult"]:not(.eg-motion-off) .eg-detail .eg-yellow-picture .eg-holder {
      animation:eg-delight-yellow .94s .04s both ease-in-out!important;
      transform-origin:50% 5%;
    }
    #exitGuideV2[data-delight-route="adult-yes"]:not(.eg-motion-off) .eg-detail .eg-steps .eg-step:first-child .eg-holder {
      animation:eg-delight-proud .80s .05s both ease-out!important;
      transform-origin:50% 92%;
    }
    #exitGuideV2[data-delight-route="leave"]:not(.eg-motion-off) .eg-detail .eg-two-holders {
      animation:eg-delight-shuffle .99s .05s both ease-in-out!important;
      transform-origin:50% 85%;
    }
    #exitGuideV2[data-delight-route="leave"]:not(.eg-motion-off) .eg-detail .eg-two-holders > svg {
      animation:eg-delight-key .72s .16s both ease-in-out!important;
      transform-origin:50% 15%;
    }
    }
    @keyframes eg-delight-peek {
      0%,100%{transform:none}
      18%{transform:translateY(-11px) rotate(-6deg)}
      39%{transform:translateY(-15px) rotate(4deg)}
      64%{transform:translateY(-3px) rotate(-2deg)}
    }
    @keyframes eg-delight-holders {
      0%,100%{transform:scale(.75) rotate(0)}
      22%{transform:scale(.82) rotate(-5deg)}
      48%{transform:scale(.78) rotate(4deg)}
      70%{transform:scale(.75) rotate(-2deg)}
    }
    @keyframes eg-delight-key {
      0%,100%{transform:none}
      32%{transform:rotate(17deg) translateY(-5px)}
      61%{transform:rotate(-11deg)}
      82%{transform:rotate(4deg)}
    }
    @keyframes eg-delight-yellow {
      0%,100%{transform:rotate(-5deg)}
      23%{transform:rotate(12deg)}
      49%{transform:rotate(-12deg)}
      72%{transform:rotate(3deg)}
    }
    @keyframes eg-delight-proud {
      0%,100%{transform:none}
      30%{transform:translateY(-8px) scale(1.08) rotate(-4deg)}
      55%{transform:translateY(2px) scale(.97)}
      75%{transform:translateY(-3px) scale(1.025)}
    }
    @keyframes eg-delight-shuffle {
      0%,100%{transform:scale(.75)}
      19%{transform:scale(.75) translateX(-7px) rotate(-4deg)}
      40%{transform:scale(.75) translateX(7px) rotate(4deg)}
      62%{transform:scale(.75) translateX(-3px) rotate(-2deg)}
      78%{transform:scale(.75) translateX(2px)}
    }
    /* The visitor's motion setting and iPad accessibility preference win. */
    #exitGuideV2.eg-motion-off .eg-detail .eg-receipt,
    #exitGuideV2.eg-motion-off .eg-detail .eg-two-holders,
    #exitGuideV2.eg-motion-off .eg-detail .eg-two-holders > svg,
    #exitGuideV2.eg-motion-off .eg-detail .eg-holder {
      animation:none!important;
    }
    @media(prefers-reduced-motion:reduce){
      #exitGuideV2[data-delight-route] .eg-detail .eg-receipt,
      #exitGuideV2[data-delight-route] .eg-detail .eg-two-holders,
      #exitGuideV2[data-delight-route] .eg-detail .eg-two-holders > svg,
      #exitGuideV2[data-delight-route] .eg-detail .eg-holder {
        animation:none!important;
      }
    }
  `;
  document.head.appendChild(style);

  let sequence=0;
  function clear(){sequence++;delete root.dataset.delightRoute;}
  function motionAllowed(){
    return !root.classList.contains('eg-motion-off')
      && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      && !document.hidden;
  }
  // Capture identifies the visitor's explicit choice; the current guide handler
  // renders its instruction page synchronously later in this same click.
  // A frame callback runs after bubble-phase rendering (microtasks can run
  // between capture/bubble callbacks on Chromium).
  root.addEventListener('click',event=>{
    const button=event.target.closest('button[data-guide]');
    if(!button){
      if(event.target.closest('button[data-motion-toggle]'))clear();
      return;
    }
    const route=button.dataset.guide;
    clear();
    if(!routes.has(route))return; // home and safety warning are never comic
    const token=sequence;
    window.requestAnimationFrame(()=>{
      if(token!==sequence||!motionAllowed())return;
      if(!root.querySelector('.eg-detail'))return;
      if(window.__ASOBOON_CINEMA_TEST__?.screen?.()!==route)return;
      root.dataset.delightRoute=route;
    });
  },true);

  // Screens can also reset without a click (idle, tab return). Never retain
  // a prop animation across visitor sessions or across a motion-off toggle.
  const observer=new MutationObserver(()=>{
    if(root.querySelector('.eg-home')||root.classList.contains('eg-motion-off')||document.hidden)clear();
    else if(root.dataset.delightRoute&&!motionAllowed())clear();
  });
  observer.observe(root,{childList:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  window.addEventListener('pagehide',clear);
})();
