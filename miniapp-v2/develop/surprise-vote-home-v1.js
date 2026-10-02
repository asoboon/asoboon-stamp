(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;

function helpNode(){return root.querySelector('.v38-help')}

function render(){
  const el=helpNode();
  if(!el)return;
  el.dataset.surpriseMode='idle';
  el.innerHTML=
    '<a class="v38-surprise-cta is-idle" href="./surprise-vote.html">'+
      '<span class="v38-surprise-badge">イベント投票</span>'+
      '<span class="v38-surprise-copy">'+
        '<strong>今日のイベント投票</strong>'+
        '<small>今日の開催回・投票時間・結果はこちら</small>'+
      '</span>'+
      '<span class="v38-surprise-arrow" aria-hidden="true">›</span>'+
    '</a>';
}

window.addEventListener('asoboon:v2-route-rendered',()=>setTimeout(render,0));
window.addEventListener('asoboon:v8-home-status',()=>setTimeout(render,0));
setTimeout(render,0);
})();
