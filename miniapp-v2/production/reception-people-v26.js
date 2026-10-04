(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
let queued=false;
const view=()=>String(new URLSearchParams(location.search).get('view')||'home');
const configs=[
  {id:'recAdult',kind:'adult',mark:'大',label:'大人',meta:'保護者・同伴者',price:'600円'},
  {id:'recChild',kind:'child',mark:'子',label:'子ども',meta:'6か月〜小学6年生',price:'900円'},
  {id:'recInfant',kind:'infant',mark:'0',label:'0〜5か月',meta:'6か月未満',price:'0〜900円'}
];
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function decoratePerson(cfg){
  const out=root.querySelector('#'+cfg.id);if(!out)return;
  const person=out.closest('.rec-person'),stepper=out.closest('.rec-stepper');if(!person||!stepper)return;
  person.dataset.v26Kind=cfg.kind;
  let label=person.querySelector(':scope > span:not(.v26-person-icon)');
  if(label){
    label.classList.add('v26-person-label');
    setText(label.querySelector('strong'),cfg.label);
    setText(label.querySelector('small'),cfg.meta);
    let price=label.querySelector('.v26-price');
    if(!price){price=document.createElement('span');price.className='v26-price';label.appendChild(price)}
    setText(price,cfg.price);
  }
  if(!person.querySelector('.v26-person-icon')){
    const icon=document.createElement('span');icon.className='v26-person-icon';icon.setAttribute('aria-hidden','true');icon.textContent=cfg.mark;person.insertBefore(icon,label||person.firstChild);
  }
  if(!out.parentElement?.classList?.contains('v26-count')){
    const count=document.createElement('span');count.className='v26-count';
    stepper.insertBefore(count,out);count.appendChild(out);
    const unit=document.createElement('span');unit.className='v26-count-unit';unit.textContent='名';count.appendChild(unit);
  }
}
function updateTotal(){
  const total=String(root.querySelector('#recPeopleTotal')?.textContent||'').trim();
  const el=root.querySelector('[data-v26-people-total]');
  if(el&&total)setText(el,`合計 ${total}`);
}
function patch(){
  queued=false;if(view()!=='reception')return;
  const people=root.querySelector('.rec-people');if(!people)return;
  people.classList.add('v26-people');
  const titles=[...root.querySelectorAll('.rec-title')],title=titles[1];
  if(title&&!root.querySelector('.v26-people-head'))title.insertAdjacentHTML('afterend','<div class="v26-people-head"><span>− / ＋ で人数を選択</span><strong data-v26-people-total>合計 1名</strong></div>');
  configs.forEach(decoratePerson);
  if(!root.querySelector('.v26-infant-note'))people.insertAdjacentHTML('afterend','<div class="v26-infant-note"><strong>0〜5か月の料金</strong><span>6か月以上のお子さまが1人以上いる場合は追加料金なし。0〜5か月のお子さまのみの場合は1人目900円、2人目以降は無料です。</span></div>');
  updateTotal();
}
function queue(){if(queued)return;queued=true;queueMicrotask(patch)}
new MutationObserver(queue).observe(root,{childList:true,subtree:true});
root.addEventListener('click',e=>{if(e.target?.closest?.('.rec-stepper button'))setTimeout(updateTotal,0)},true);
root.addEventListener('change',()=>setTimeout(updateTotal,0),true);
window.addEventListener('popstate',()=>{setTimeout(patch,0);setTimeout(patch,100)});
patch();setTimeout(patch,80);setTimeout(patch,350);
})();
