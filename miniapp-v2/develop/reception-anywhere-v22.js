(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
const TEST_WAIT_TYPE_ID='0042';
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};

function ensureTestSection(){
  const slots=root.querySelector('#recSlots');
  if(!slots)return null;
  let section=root.querySelector('.v22-dev-test');
  if(!section){
    section=document.createElement('section');
    section.className='v22-dev-test';
    section.innerHTML='<div class="v22-dev-test-head"><span>🧪 DEVELOPING ONLY</span><h3>テスト受付</h3><p>実際のお客様向け受付ではありません。Developing環境の動作確認専用です。</p></div><div class="v22-dev-test-slot"></div><div class="v22-dev-test-note">本番ミニアプリには表示されません。</div>';
    const peopleTitle=[...root.querySelectorAll('.rec-title')].find(el=>/ご利用人数/.test(String(el.textContent||'')));
    if(peopleTitle)peopleTitle.insertAdjacentElement('beforebegin',section);
    else slots.insertAdjacentElement('afterend',section);
  }
  return section;
}

function moveTestSlot(){
  const section=ensureTestSection();if(!section)return null;
  const holder=section.querySelector('.v22-dev-test-slot');
  const current=root.querySelector('#recSlots [data-rec-slot="'+TEST_WAIT_TYPE_ID+'"][data-rec-available="1"]');
  root.querySelectorAll('#recSlots [data-rec-slot]:not([data-rec-slot="'+TEST_WAIT_TYPE_ID+'"])').forEach(el=>el.remove());
  if(current)holder.replaceChildren(current);
  const duplicates=[...holder.querySelectorAll('[data-rec-slot="'+TEST_WAIT_TYPE_ID+'"]')];
  duplicates.slice(1).forEach(el=>el.remove());
  const test=holder.querySelector('[data-rec-slot="'+TEST_WAIT_TYPE_ID+'"]')||null;
  if(test){
    test.hidden=false;
    test.style.removeProperty('display');
    test.classList.add('v22-test-slot');
    setText(test.querySelector('strong'),'入場不可テスト');
    setText(test.querySelector('small'),'0042 / Developing専用 AirWAITテスト枠');
  }
  section.hidden=!test;
  return test;
}

function patch(){
  queued=false;if(view()!=='reception')return;
  const test=moveTestSlot();
  const slotTitle=[...root.querySelectorAll('.rec-title')].find(el=>/ご利用の回/.test(String(el.textContent||'')));
  if(slotTitle)slotTitle.hidden=true;
  const slotsBox=root.querySelector('#recSlots');if(slotsBox)slotsBox.hidden=true;
  root.querySelector('.rec-methods')?.remove();
  root.querySelector('#recLocation')?.remove();
  root.querySelector('.v22-anywhere-note')?.remove();
  setText(root.querySelector('#recModeLabel'),'Developingテスト');
  const submit=root.querySelector('#recSubmit');
  if(test&&submit&&!submit.disabled&&!/受付中/.test(String(submit.textContent||'')))setText(submit,'テスト受付をする');
}

function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
window.addEventListener('popstate',()=>setTimeout(patch,0));
patch();setTimeout(patch,80);setTimeout(patch,350);
})();