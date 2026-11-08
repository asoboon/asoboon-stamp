/* Lightweight persistent four-tab navigation, outside HOME's critical bundle. */
(()=>{'use strict';
const root=document.getElementById('app');if(!root)return;
const GUIDE_VIEWS=['guide','first','entry','rules','timeguide','parking','faq'];
const NAV_TITLES={
 ja:['ホーム','呼出','ご利用案内','あそび'],
 en:['Home','Calls','Guide','Play'],
 'zh-CN':['首页','叫号','使用指南','游玩'],
 vi:['Trang chủ','Gọi số','Hướng dẫn','Vui chơi'],
 ne:['गृहपृष्ठ','बोलावट','मार्गदर्शन','खेल'],
 ko:['홈','호출','이용 안내','놀이'],
 kmr:['Malper','Bangkirin','Rêber','Lîstin']
};
function locale(){try{return window.ASOBOON_I18N?.language||localStorage.getItem('asoboon_miniapp_locale_v1')||'ja'}catch{return'ja'}}

function tabIcon(key){const shapes={home:'<path d="m3 10 9-7 9 7v11H3z"/><path d="M9 21v-7h6v7"/>',callstatus:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',guide:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',play:'<path d="M7 6v12l11-6z"/>'};return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${shapes[key]||shapes.home}</svg>`}
function backView(){if((new URLSearchParams(location.search).get('view')||'home')==='callstatus'&&new URLSearchParams(location.search).has('panel'))return'callstatus';if(GUIDE_VIEWS.includes((new URLSearchParams(location.search).get('view')||'home'))&&(new URLSearchParams(location.search).get('view')||'home')!=='guide')return'guide';if(['stamp','omikuji','game'].includes((new URLSearchParams(location.search).get('view')||'home')))return'play';return'home'}

window.ASOBOON_CHOCOMINT_BACK=backView;
function mountNavigation(){
 if(window.ASOBOON_ASOQUEST_HANDOFF)return;
 let nav=root.querySelector(':scope > .cm-bottom-nav');
 if(!nav){nav=document.createElement('nav');nav.className='cm-bottom-nav';root.appendChild(nav)}
 const view=new URLSearchParams(location.search).get('view')||'home';
 const active=view==='callstatus'?'callstatus':GUIDE_VIEWS.includes(view)?'guide':view==='play'||['game','stamp','omikuji'].includes(view)?'play':'home';
 const labels=NAV_TITLES[locale()]||NAV_TITLES.ja;
 const items=['home','callstatus','guide','play'].map((view,i)=>[view,labels[i]]);
 const content=items.map(([v,label])=>`<button type="button" class="cm-nav-tab${active===v?' is-current':''}" data-v7-view="${v}" ${active===v?'aria-current="page"':''} aria-label="${label}">${tabIcon(v)}<span>${label}</span></button>`).join('');
 if(nav.innerHTML!==content)nav.innerHTML=content;
 nav.setAttribute('aria-label','主なメニュー');
 const back=root.querySelector('#backBtn');if(back)back.setAttribute('aria-label',backView()==='guide'?'ご利用案内に戻る':backView()==='play'?'あそびに戻る':'ホームに戻る');
}
window.addEventListener('asoboon:v2-route-rendered',mountNavigation);
window.addEventListener('popstate',mountNavigation);
window.addEventListener('asoboon:language-changed',mountNavigation);
mountNavigation();
})();
