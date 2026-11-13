(function(){'use strict';
 const style=document.createElement('style');style.id='eg-v9-one-screen-style';style.textContent="/* All visitor instructions must fit within one viewport; no user scroll. */\n#exitGuideV2 .eg-home .eg-intro,#exitGuideV2 .eg-home .eg-bottom{animation:none!important;transform:none!important} /* safety note must never animate offscreen */\nhtml,body,#exitGuideV2{overflow:clip!important;overscroll-behavior:none!important}\n#exitGuideV2{height:100dvh!important;max-height:100dvh!important;min-height:0!important;overflow:clip!important}\n#exitGuideV2 .eg-page{height:100dvh!important;min-height:0!important;max-height:100dvh!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;box-sizing:border-box!important}\n#exitGuideV2 .eg-detail{min-height:0!important;gap:clamp(4px,.8dvh,9px)!important;padding-bottom:max(9px,env(safe-area-inset-bottom))!important}\n#exitGuideV2 .eg-detail .eg-header{padding-bottom:3px!important;min-height:0!important}\n#exitGuideV2 .eg-detail .eg-route{padding:4px 8px!important}\n#exitGuideV2 .eg-detail-title{font-size:clamp(20px,3vw,33px)!important;line-height:1.12!important}\n#exitGuideV2 .eg-detail-lead{font-size:clamp(13px,1.7vw,18px)!important}\n#exitGuideV2 .eg-detail .eg-question{margin:0!important;font-size:clamp(18px,2.6vw,26px)!important}\n#exitGuideV2 .eg-detail .eg-question-sub{font-size:clamp(13px,1.7vw,16px)!important}\n#exitGuideV2 .eg-detail .eg-answer-buttons{min-height:0!important;flex:1 1 0!important}\n#exitGuideV2 .eg-detail .eg-answer{min-height:0!important;height:100%!important}\n#exitGuideV2 .eg-detail .eg-steps{min-height:0!important;flex:1 1 0!important;grid-auto-rows:minmax(0,1fr)!important}\n#exitGuideV2 .eg-stepper-active .eg-steps{min-height:0!important}\n#exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]){min-height:0!important;overflow:hidden!important}\n#exitGuideV2 .eg-detail .eg-hint{flex:0 0 auto!important;padding:clamp(5px,.9dvh,9px) 12px!important;font-size:clamp(12px,1.5vw,15px)!important;min-height:0!important}\n#exitGuideV2 .eg-detail .eg-hint strong{font-size:inherit!important}\n#exitGuideV2 .eg-detail .eg-yellow-picture{padding:0!important;max-height:clamp(34px,8dvh,84px)!important;min-height:0!important}\n#exitGuideV2 .eg-detail .eg-yellow-picture .eg-holder{transform:scale(.66) rotate(-5deg);transform-origin:center top}\n#exitGuideV2 .eg-stepper-progress{flex:0 0 auto!important}\n#exitGuideV2 .eg-stepper-controls{flex:0 0 auto!important}\n#exitGuideV2 .eg-stepper-next,#exitGuideV2 .eg-stepper-prev{min-height:clamp(56px,7dvh,76px)!important}\n#exitGuideV2 .eg-detail .eg-actions{display:none!important} /* Back is available in the header; avoid duplicate footer taking space */\n#exitGuideV2 .eg-home{min-height:0!important;height:100dvh!important}\n#exitGuideV2 .eg-home .eg-illustration{min-height:0!important}\n@media(max-height:850px){\n #exitGuideV2 .eg-page{gap:5px!important}\n #exitGuideV2 .eg-detail .eg-step:not([hidden]){padding:9px 14px!important}\n #exitGuideV2 .eg-detail .eg-step:not([hidden]) strong{font-size:clamp(18px,3vw,28px)!important}\n #exitGuideV2 .eg-detail .eg-step:not([hidden]) p{font-size:clamp(13px,1.7vw,17px)!important;margin-top:4px!important}\n #exitGuideV2 .eg-detail .eg-hint{font-size:13px!important}\n #exitGuideV2 .eg-detail .eg-header{max-height:56px}\n #exitGuideV2 .eg-home .eg-illustration{flex:0 1 75px!important;max-height:75px!important}\n #exitGuideV2 .eg-home .eg-choice{padding:6px 9px!important;gap:3px!important}\n #exitGuideV2 .eg-home .eg-bottom{min-height:0!important}\n #exitGuideV2 .eg-home .eg-note{padding:6px 9px!important;font-size:clamp(11px,1.4vw,13px)!important}\n #exitGuideV2 .eg-home .eg-time{padding:6px 10px!important}\n}\n@media(max-width:900px){\n #exitGuideV2 .eg-home .eg-options{min-height:0!important}\n #exitGuideV2 .eg-home .eg-choice{min-height:0!important}\n #exitGuideV2 .eg-home .eg-illustration{max-height:80px!important}\n}\n@media(max-width:599px){\n :root{--eg-voice-nav-height:68px!important;--eg-voice-tools-top:calc(var(--eg-voice-nav-top) + 74px)!important;--eg-voice-page-top:calc(var(--eg-voice-tools-top) + 73px)!important}\n /* one accessible language button on small screens; choices open in a fixed modal */\n #eg-final-languages{display:none!important}\n #eg-kiosk-language-trigger{display:block!important}\n #exitGuideV2 .eg-page{padding-left:8px!important;padding-right:8px!important;padding-bottom:6px!important}\n #exitGuideV2 .eg-home{gap:3px!important}\n #exitGuideV2 .eg-home .eg-intro{padding:0!important}\n #exitGuideV2 .eg-home h1{font-size:clamp(19px,5vw,25px)!important}\n #exitGuideV2 .eg-home .eg-intro p{font-size:12px!important;margin:0!important}\n #exitGuideV2 .eg-home .eg-options{display:flex!important;flex-direction:column!important;gap:4px!important}\n #exitGuideV2 .eg-home .eg-choice{animation:none!important;transform:none!important;display:grid!important;grid-template-columns:34px minmax(0,1fr)!important;grid-template-rows:auto auto!important;justify-items:start!important;align-content:center!important;min-height:0!important;padding:5px 7px!important;gap:2px 7px!important}\n #exitGuideV2 .eg-home .eg-choice-index{grid-row:1/span 2!important;width:32px!important;height:32px!important;font-size:19px!important}\n #exitGuideV2 .eg-home .eg-choice-title{grid-column:2!important;font-size:clamp(17px,4.4vw,22px)!important;line-height:1.1!important}\n #exitGuideV2 .eg-home .eg-illustration{display:none!important}\n #exitGuideV2 .eg-home .eg-choice-sub{grid-column:2!important;font-size:12px!important;padding:1px 4px!important;width:auto!important;min-height:0!important}\n #exitGuideV2 .eg-home .eg-choice-action{grid-column:2!important;grid-row:2!important;justify-self:end!important;width:auto!important;min-height:30px!important;font-size:12px!important;padding:3px 7px!important}\n #exitGuideV2 .eg-home .eg-bottom{display:none!important}\n #exitGuideV2 .eg-detail{gap:4px!important}\n #exitGuideV2 .eg-detail .eg-header{gap:4px!important}\n #exitGuideV2 .eg-back{padding:5px 8px!important;font-size:13px!important;min-height:42px!important}\n #exitGuideV2 .eg-route{font-size:13px!important;line-height:1.1!important}\n #exitGuideV2 .eg-detail-title{font-size:clamp(17px,4.6vw,23px)!important}\n #exitGuideV2 .eg-detail-lead{font-size:12px!important}\n #exitGuideV2 .eg-detail .eg-question{font-size:clamp(17px,4vw,22px)!important}\n #exitGuideV2 .eg-detail .eg-steps .eg-step:not([hidden]){padding:6px!important;gap:3px!important}\n #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]){flex-direction:row!important;justify-content:center!important;align-items:center!important;text-align:left!important}\n #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]) .eg-num{width:39px!important;height:39px!important;font-size:23px!important}\n #exitGuideV2 .eg-detail .eg-step:not([hidden]) strong{font-size:clamp(16px,4.2vw,21px)!important;line-height:1.16!important}\n #exitGuideV2 .eg-detail .eg-step:not([hidden]) p{font-size:clamp(12px,3.3vw,15px)!important;line-height:1.2!important}\n #exitGuideV2 .eg-detail .eg-minisymbol{display:none!important}\n #exitGuideV2 .eg-stepper-progress{font-size:13px!important}\n #exitGuideV2 .eg-stepper-controls{gap:5px!important}\n #exitGuideV2 .eg-stepper-next,#exitGuideV2 .eg-stepper-prev{min-height:53px!important;font-size:16px!important}\n #exitGuideV2 .eg-hint{padding:3px 7px!important;font-size:12px!important;line-height:1.15!important}\n #exitGuideV2 .eg-hint b{height:25px!important;width:25px!important;font-size:17px!important}\n #exitGuideV2 .eg-detail .eg-yellow-picture{display:none!important}\n #exitGuideV2 .eg-detail .eg-answer{min-height:0!important;font-size:clamp(20px,5vw,27px)!important}\n #exitGuideV2 .eg-detail .eg-answer-buttons{gap:5px!important;overflow:clip!important}\n}\n@media(max-height:620px){\n #exitGuideV2 .eg-detail .eg-quiet{display:none!important}\n #exitGuideV2 .eg-detail .eg-yellow-picture{display:none!important}\n #exitGuideV2 .eg-detail .eg-hint{font-size:12px!important;padding:4px 8px!important}\n #exitGuideV2 .eg-home .eg-intro p{display:none!important}\n}\n";style.textContent += `
@media(max-height:550px){
 :root{--eg-voice-nav-height:68px!important;--eg-voice-tools-top:calc(var(--eg-voice-nav-top) + 70px)!important;--eg-voice-page-top:calc(var(--eg-voice-tools-top) + 73px)!important}
 #eg-final-languages{display:none!important}
 #exitGuideV2 .eg-page{padding-top:var(--eg-voice-page-top)!important;gap:3px!important}
 #exitGuideV2 .eg-home .eg-options{min-height:0!important}
 #exitGuideV2 .eg-home .eg-bottom{display:none!important}
 #exitGuideV2 .eg-home .eg-illustration{display:none!important}
 #exitGuideV2 .eg-home .eg-choice{min-height:0!important;padding:3px 7px!important;gap:2px!important}
 #exitGuideV2 .eg-home .eg-choice-title{font-size:15px!important}
 #exitGuideV2 .eg-home .eg-choice-action{min-height:36px!important}
 #exitGuideV2 .eg-detail .eg-header{max-height:40px!important}
 #exitGuideV2 .eg-detail .eg-detail-title{font-size:16px!important;line-height:1.1!important}
 #exitGuideV2 .eg-detail .eg-question{font-size:16px!important;line-height:1.1!important}
 #exitGuideV2 .eg-detail .eg-question-sub{font-size:12px!important;line-height:1.1!important}
 #exitGuideV2 .eg-detail .eg-hint{padding:3px!important;font-size:11px!important}
 #exitGuideV2 .eg-detail .eg-step:not([hidden]) strong{font-size:16px!important}
 #exitGuideV2 .eg-detail .eg-step:not([hidden]) p{font-size:12px!important;margin-top:0!important}
 #exitGuideV2 .eg-stepper-controls button{min-height:50px!important}
 #exitGuideV2 .eg-detail .eg-answer-buttons{min-height:80px!important;overflow:clip!important}
 #exitGuideV2 .eg-detail .eg-answer{min-height:80px!important;font-size:18px!important}
 #exitGuideV2 .eg-detail .eg-answer small{font-size:12px!important}
}
`;
 style.textContent += `
 @media(max-width:599px), (max-height:550px){
  #exitGuideV2 .eg-home .eg-bottom{display:block!important;flex:0 0 auto!important;min-height:0!important}
  #exitGuideV2 .eg-home .eg-note{display:block!important;font-size:11px!important;line-height:1.16!important;padding:3px 5px!important;border-radius:5px!important}
  #exitGuideV2 .eg-home .eg-options{flex:1 1 0!important;min-height:0!important}
  #exitGuideV2 .eg-home .eg-choice{min-height:0!important}
 }
 `;
 style.textContent += `
 @media(max-width:599px){
  #exitGuideV2 .eg-detail .eg-answer-buttons{max-height:calc(100dvh - 345px)!important;min-height:0!important}
  #exitGuideV2 .eg-detail .eg-answer{max-height:100%!important;min-height:0!important}
 }
 @media(max-height:550px){
  #exitGuideV2 .eg-home .eg-options{max-height:calc(100dvh - 275px)!important;flex:1 1 auto!important}
  #exitGuideV2 .eg-home .eg-choice{max-height:calc(100dvh - 275px)!important;min-height:0!important;overflow:clip!important}
  #exitGuideV2 .eg-detail .eg-answer-buttons{max-height:calc(100dvh - 275px)!important;min-height:0!important}
  #exitGuideV2 .eg-detail .eg-answer{max-height:100%!important;min-height:0!important}
 }
`;
 style.textContent += `
@media(max-height:550px){
 #exitGuideV2 .eg-home .eg-choice{animation:none!important;transform:none!important;display:grid!important;grid-template-columns:34px minmax(0,1fr)!important;grid-template-rows:auto auto 38px!important;gap:0 4px!important;padding:3px 5px!important;align-content:space-around!important;min-height:0!important;overflow:clip!important}
 #exitGuideV2 .eg-home .eg-choice-index{grid-column:1!important;grid-row:1/span 2!important;width:30px!important;height:30px!important;font-size:17px!important}
 #exitGuideV2 .eg-home .eg-choice-title{grid-column:2!important;grid-row:1!important;font-size:clamp(12px,1.8vw,17px)!important;line-height:1.05!important}
 #exitGuideV2 .eg-home .eg-choice-sub{grid-column:2!important;grid-row:2!important;width:100%!important;font-size:11px!important;line-height:1!important;padding:0!important;border:0!important;background:transparent!important;color:inherit!important}
 #exitGuideV2 .eg-home .eg-choice-action{grid-column:1/span 2!important;grid-row:3!important;width:100%!important;max-width:none!important;height:38px!important;min-height:38px!important;font-size:12px!important;padding:2px 5px!important;margin:0!important;line-height:1.05!important}
 #exitGuideV2 .eg-home .eg-choice-action svg{display:none!important}
 #exitGuideV2 .eg-detail .eg-answer-buttons{min-height:0!important;grid-template-rows:minmax(0,1fr)!important}
 #exitGuideV2 .eg-detail .eg-answer{min-height:0!important;max-height:100%!important;padding:3px!important;gap:2px!important;font-size:16px!important;line-height:1!important}
 #exitGuideV2 .eg-detail .eg-answer small{font-size:11px!important;line-height:1.1!important}
}
`;style.textContent += "#exitGuideV2 .eg-detail .eg-answer{animation:none!important;transform:none!important}";document.head.appendChild(style);
 const compactQuery=window.matchMedia('(max-width:599px), (max-height:550px)');
 function ensureCompactTrigger(){if(!compactQuery.matches||document.getElementById('eg-kiosk-language-trigger'))return;
   const source=document.querySelector('#eg-final-languages');if(!source)return;
   const trigger=document.createElement('button');trigger.id='eg-kiosk-language-trigger';trigger.type='button';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.textContent='🌐 日本語 ▾';
   const modal=document.createElement('div');modal.id='eg-kiosk-language-dialog';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Language / 言語');
   const close=document.createElement('button');close.type='button';close.className='eg-kiosk-close';close.textContent='×';close.setAttribute('aria-label','Close language selection');
   const grid=document.createElement('div');grid.className='eg-kiosk-lang-grid';
   const refresh=()=>{const selected=source.querySelector('button[aria-pressed="true"]');trigger.textContent='🌐 '+(selected?.textContent||'日本語')+' ▾';};
   const show=()=>{grid.replaceChildren(...[...source.querySelectorAll('button')].map(b=>{const c=b.cloneNode(true);c.removeAttribute('id');c.addEventListener('click',()=>{b.click();refresh();hide()});return c}));modal.hidden=false;trigger.setAttribute('aria-expanded','true');close.focus();};
   const hide=()=>{modal.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();};
   close.addEventListener('click',hide);modal.addEventListener('click',e=>{if(e.target===modal)hide()});trigger.addEventListener('click',show);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)hide()});
   modal.append(close,grid);document.body.append(trigger,modal);refresh();
   const triggerStyle=document.createElement('style');triggerStyle.textContent=`
   #eg-kiosk-language-trigger{position:fixed;display:none;top:max(6px,env(safe-area-inset-top));left:7px;right:7px;height:64px;z-index:460;box-sizing:border-box;border:2px solid #0d699e;border-radius:12px;background:#fff;color:#0c4d75;font:900 21px/1.1 system-ui;box-shadow:0 3px 9px #1233}
   @media(max-width:599px), (max-height:550px){#eg-kiosk-language-trigger{display:block!important}}
   #eg-kiosk-language-dialog[hidden]{display:none!important}
   #eg-kiosk-language-dialog{position:fixed;inset:0;z-index:5000;display:flex;flex-direction:column;align-items:stretch;justify-content:center;gap:9px;padding:10px;background:rgba(4,20,35,.90);box-sizing:border-box}
   #eg-kiosk-language-dialog .eg-kiosk-close{position:absolute;right:12px;top:8px;width:52px;height:52px;background:#fff;color:#093f60;border:0;border-radius:9px;font-size:32px}
   #eg-kiosk-language-dialog .eg-kiosk-lang-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;width:100%;max-height:calc(100dvh - 80px)}
   #eg-kiosk-language-dialog .eg-kiosk-lang-grid button{min-height:clamp(52px,12dvh,78px);background:#fff;color:#153b54;border:2px solid #ccc;border-radius:10px;padding:4px 2px;font:800 clamp(13px,3.8vw,18px)/1.15 system-ui;overflow-wrap:anywhere}
   #eg-kiosk-language-dialog .eg-kiosk-lang-grid button[aria-pressed=true]{background:#1075a3;color:white}
   `;document.head.appendChild(triggerStyle);
 }
 ensureCompactTrigger();
 window.addEventListener('resize',()=>{ensureCompactTrigger();if(!compactQuery.matches){const dialog=document.getElementById('eg-kiosk-language-dialog');if(dialog)dialog.hidden=true;}});
})();