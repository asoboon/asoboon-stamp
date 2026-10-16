/* ASOBooN kiosk: progressive one-step instructions, no new API or persistent state. */
(function venueInstructionStepper(){
  'use strict';
  if(window.__ASOBOON_GUIDE_STEPPER__)return;
  const root=document.getElementById('exitGuideV2');
  if(!root)return;
  window.__ASOBOON_GUIDE_STEPPER__=true;

  const words={
    ja:{step:'ステップ',next:'次へ',prev:'前へ',done:'最初の画面へ戻る'},
    en:{step:'Step',next:'Next',prev:'Back',done:'Back to start'},
    zh:{step:'步骤',next:'下一步',prev:'上一步',done:'返回首页'},
    vi:{step:'Bước',next:'Tiếp theo',prev:'Quay lại',done:'Về màn hình đầu'},
    ko:{step:'단계',next:'다음',prev:'이전',done:'처음 화면으로'},
    ne:{step:'चरण',next:'अर्को',prev:'अघिल्लो',done:'सुरुमा फर्कनुहोस्'},
    tl:{step:'Hakbang',next:'Susunod',prev:'Bumalik',done:'Bumalik sa simula'},
    my:{step:'အဆင့်',next:'ရှေ့သို့',prev:'နောက်သို့',done:'အစသို့ ပြန်သွားရန်'}
  };

  const style=document.createElement('style');
  style.id='eg-stepper-style';
  style.textContent=`
    #exitGuideV2 .eg-steps .eg-step[hidden],
    #exitGuideV2 .eg-stepper-active .eg-detail-lead[hidden],
    #exitGuideV2 .eg-stepper-active .eg-hint[hidden],
    #exitGuideV2 .eg-stepper-active .eg-quiet[hidden],
    #exitGuideV2 .eg-stepper-active .eg-actions{display:none!important}
    #exitGuideV2 .eg-stepper-active{gap:clamp(7px,1.5dvh,13px)}
    #exitGuideV2 .eg-stepper-active .eg-detail-title{font-size:clamp(24px,3.8vw,37px);line-height:1.18;margin:0}
    #exitGuideV2 .eg-stepper-active .eg-steps{
      flex:1 1 auto;min-height:150px;display:grid;grid-template-columns:minmax(0,1fr);
      grid-auto-rows:minmax(0,1fr);gap:0
    }
    #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]){
      width:100%;height:100%;min-height:0;padding:clamp(14px,3.5vw,34px);
      gap:clamp(12px,3vw,30px);border-width:3px;align-items:center;
      animation:eg-stepper-in .24s both ease-out
    }
    #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]) .eg-num{
      width:clamp(56px,8vw,94px);height:clamp(56px,8vw,94px);
      font-size:clamp(30px,4.4vw,50px)
    }
    #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]) strong{
      font-size:clamp(25px,4.2vw,43px);line-height:1.28
    }
    #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]) p{
      font-size:clamp(17px,2.8vw,25px);line-height:1.4;margin-top:10px
    }
    #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]) .eg-minisymbol{
      width:clamp(54px,12vw,150px);transform:scale(1.13)
    }
    #exitGuideV2 .eg-stepper-progress{display:flex;gap:14px;align-items:center;justify-content:center;font-size:clamp(16px,2.5vw,22px);font-weight:950;color:#2d5268}
    #exitGuideV2 .eg-stepper-bar{display:flex;flex:1;max-width:330px;gap:7px}
    #exitGuideV2 .eg-stepper-dot{height:9px;flex:1;border-radius:99px;background:#d8e5ed}
    #exitGuideV2 .eg-stepper-dot.eg-done{background:var(--route-color,#0877cb)}
    #exitGuideV2 .eg-stepper-controls{display:flex;align-items:stretch;gap:13px}
    #exitGuideV2 .eg-stepper-prev,#exitGuideV2 .eg-stepper-next{min-height:clamp(64px,8.5dvh,86px);border-radius:18px;font-weight:1000;font-size:clamp(19px,2.8vw,27px)}
    #exitGuideV2 .eg-stepper-prev{flex:0 1 31%;color:#184662;background:#f4f9fc;border:2px solid #b5cbd8}
    #exitGuideV2 .eg-stepper-prev[hidden]{display:none!important}
    #exitGuideV2 .eg-stepper-next{flex:1;background:var(--route-color,#0877cb);color:white;border:2px solid transparent;box-shadow:0 5px 0 #062b3e2a}
    #exitGuideV2 .eg-stepper-next:active{transform:translateY(3px);box-shadow:0 2px 0 #062b3e2a}
    #exitGuideV2 .eg-stepper-pin{background:#fff9e7;border:2px solid #f0d994;border-radius:11px;color:#74520c;font-weight:900;font-size:clamp(13px,1.9vw,17px);padding:7px 13px;text-align:center}
    #exitGuideV2 .eg-stepper-active .eg-hint{padding:clamp(8px,1.6vw,14px);font-size:clamp(13px,1.8vw,16px)}
    #exitGuideV2 .eg-stepper-active .eg-hint strong{font-size:clamp(14px,2vw,18px)}
    #exitGuideV2 .eg-stepper-active .eg-hint b{height:34px;width:34px;font-size:21px}
    #exitGuideV2 .eg-stepper-active .eg-hint:not(.eg-danger){margin-top:0}
    @media(max-width:550px){
      #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]){flex-direction:column;justify-content:center;text-align:center;padding:14px;gap:10px}
      #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]) strong{font-size:clamp(22px,5.5vw,32px)}
      #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]) p{font-size:clamp(16px,4vw,20px)}
    }
    @media(max-height:600px){
      #exitGuideV2 .eg-stepper-active{gap:5px}
      #exitGuideV2 .eg-stepper-active .eg-steps{min-height:120px}
      #exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]){padding:8px 15px}
      #exitGuideV2 .eg-stepper-active .eg-stepper-next,#exitGuideV2 .eg-stepper-active .eg-stepper-prev{min-height:50px}
      #exitGuideV2 .eg-stepper-active .eg-hint{padding:7px}
    }
    @keyframes eg-stepper-in{from{opacity:.3;transform:translateX(12px)}to{opacity:1;transform:none}}
    @media(prefers-reduced-motion:reduce){#exitGuideV2 .eg-stepper-active .eg-steps .eg-step:not([hidden]){animation:none!important}}
    #exitGuideV2.eg-motion-off .eg-stepper-active .eg-steps .eg-step:not([hidden]){animation:none!important}
  `;
  document.head.appendChild(style);
  let state=null;

  function lang(){return words[root.dataset.lang]||words.ja;}
  function updateLabels(){
    if(!state)return;
    const l=lang(),{index,steps,progress,prev,next}=state;
    const number=progress.querySelector('.eg-stepper-number');
    const text=l.step+' '+(index+1)+' / '+steps.length;
    const back='‹  '+l.prev;
    const forward=index===steps.length-1?l.done+'  ↺':l.next+'  ›';
    const aria=index===steps.length-1?l.done:l.next;
    // final.js observes child changes and sets data-lang each refresh.
    // Writing unchanged text creates an infinite observer feedback loop.
    if(number.textContent!==text)number.textContent=text;
    if(prev.textContent!==back)prev.textContent=back;
    if(next.textContent!==forward)next.textContent=forward;
    if(prev.hidden!==(index===0))prev.hidden=index===0;
    if(next.getAttribute('aria-label')!==aria)next.setAttribute('aria-label',aria);
  }
  function show(n){
    if(!state)return;
    const s=state;
    s.index=Math.max(0,Math.min(s.steps.length-1,n));
    s.steps.forEach((el,i)=>{
      const visible=i===s.index;
      el.hidden=!visible;
      el.setAttribute('aria-hidden',String(!visible));
      el.setAttribute('aria-label',lang().step+' '+(i+1)+' / '+s.steps.length);
    });
    s.notices.forEach(el=>{el.hidden=s.index<s.steps.length-1&&!el.classList.contains('eg-danger');});
    s.progress.querySelectorAll('.eg-stepper-dot').forEach((dot,i)=>dot.classList.toggle('eg-done',i<=s.index));
    s.panel.dataset.step=String(s.index+1);
    updateLabels();
    root.scrollTop=0;
  }
  function init(){
    state=null;
    const panel=root.querySelector(':scope > .eg-detail');
    if(!panel||!['family','adult-yes','leave'].includes(root.dataset.guideScreen))return;
    const group=panel.querySelector('.eg-steps');
    const steps=[...(group?.children||[])].filter(x=>x.classList.contains('eg-step'));
    if(steps.length<2)return;
    const notices=[...panel.querySelectorAll(':scope > .eg-hint')];
    const lead=panel.querySelector('.eg-detail-lead');
    if(lead)lead.hidden=true;
    // A short, unavoidable disclaimer. The complete guidance appears at the last step.
    if(root.dataset.guideScreen==='family'){
      const pin=document.createElement('p');pin.className='eg-stepper-pin';
      pin.textContent='一時退場中も利用時間は進みます。';group.after(pin);
    }
    const progress=document.createElement('div');
    progress.className='eg-stepper-progress';
    progress.setAttribute('role','status');
    progress.setAttribute('aria-live','polite');
    const number=document.createElement('span');number.className='eg-stepper-number';progress.appendChild(number);
    const bar=document.createElement('div');bar.className='eg-stepper-bar';bar.setAttribute('aria-hidden','true');
    for(let i=0;i<steps.length;i++){const dot=document.createElement('i');dot.className='eg-stepper-dot';bar.appendChild(dot);}
    progress.appendChild(bar);
    const controls=document.createElement('div');controls.className='eg-stepper-controls';
    const prev=document.createElement('button');prev.className='eg-stepper-prev';prev.type='button';prev.dataset.stepperAction='prev';
    const next=document.createElement('button');next.className='eg-stepper-next';next.type='button';next.dataset.stepperAction='next';
    controls.append(prev,next);
    const heading=panel.querySelector('.eg-detail-title');
    (heading||panel.querySelector('.eg-header')).after(progress);
    const actions=panel.querySelector('.eg-actions');actions.before(controls);
    panel.classList.add('eg-stepper-active');
    state={panel,steps,notices,progress,prev,next,index:0};
    show(0);
  }
  // Original guide replaces the root's direct child synchronously on each route.
  const pageObserver=new MutationObserver(init);
  pageObserver.observe(root,{childList:true});
  const localeObserver=new MutationObserver(updateLabels);
  localeObserver.observe(root,{attributes:true,attributeFilter:['data-lang']});
  root.addEventListener('click',e=>{
    const button=e.target.closest('button[data-stepper-action]');
    if(!button||!state)return;
    e.preventDefault();e.stopPropagation();
    if(button.dataset.stepperAction==='prev')show(state.index-1);
    else if(state.index===state.steps.length-1){
      root.querySelector('.eg-header button[data-guide="home"]')?.click();
    }else show(state.index+1);
  });
  init();
})();
