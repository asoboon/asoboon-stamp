(()=>{
'use strict';
function ensureStyle(){
  if(document.getElementById('asbTestSlotStyle'))return;
  const s=document.createElement('style');s.id='asbTestSlotStyle';s.textContent=`
.slot.asb-test-slot{border-color:#b88835;box-shadow:0 0 0 1px rgba(240,188,75,.18),0 10px 26px rgba(0,0,0,.16)}
.slot.asb-test-slot .slothead{background:linear-gradient(180deg,#3c3018,#261f12)}
.slot.asb-test-slot .slotstatus{background:#5b4518;color:#ffe08b}
#asbTestModeNotice{margin-top:9px;padding:10px 11px;border-left:4px solid #e0aa41;border-radius:10px;background:#332814;color:#ffe6a4;font-size:.68rem;line-height:1.5;font-weight:900}
`;document.head.appendChild(s);
}
function notice(on){
  let el=document.getElementById('asbTestModeNotice');
  if(!on){el?.remove();return}
  if(el)return;
  const scheduler=document.querySelector('.scheduler');if(!scheduler?.parentElement)return;
  el=document.createElement('div');el.id='asbTestModeNotice';
  el.textContent='🧪 TEST MODE｜AirWAITで有効になっている「テスト」枠をスタッフAUTOだけに表示しています。お客様向け受付には表示しません。';
  scheduler.parentElement.insertBefore(el,scheduler.nextSibling);
}
function decorate(){
  ensureStyle();let found=false;
  for(const slot of document.querySelectorAll('.slot')){
    const name=slot.querySelector('.slotname');if(!name)continue;
    const raw=String(name.textContent||'').normalize('NFKC');
    const isTest=/テスト/.test(raw);
    slot.classList.toggle('asb-test-slot',isTest);
    if(!isTest)continue;
    found=true;
    if(!raw.startsWith('🧪 TEST｜'))name.textContent=`🧪 TEST｜${name.textContent}`;
    const schedule=slot.querySelector('.scheduleline strong');if(schedule&&schedule.textContent==='00:00')schedule.textContent='TEST';
  }
  notice(found);
}
new MutationObserver(decorate).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
setInterval(decorate,1200);setTimeout(decorate,250);
})();
