/* ASOBooN universal language picker: show the purpose in a language newcomers can recognize.
   Uses the existing native accessible select and original i18n engine; NEVER changes reservation logic. */
(()=>{'use strict';
const NAMES=Object.freeze({
 ja:{label:'日本語 / Japanese',lang:'ja'},
 'zh-CN':{label:'简体中文 / Chinese',lang:'zh-CN'},
 vi:{label:'Tiếng Việt / Vietnamese',lang:'vi'},
 en:{label:'English',lang:'en'},
 ne:{label:'नेपाली / Nepali',lang:'ne'},
 ko:{label:'한국어 / Korean',lang:'ko'},
 kmr:{label:'Kurmancî / Kurdish (Kurmanji)',lang:'kmr'}
});
function enhance(){
 const bar=document.getElementById('asoboon-language-bar');
 const select=document.getElementById('asoboon-language-select');
 if(!bar||!select)return false;
 if(bar.dataset.languageUx==='v1')return true;
 const label=bar.querySelector('label[for="asoboon-language-select"]');
 if(label)label.textContent='🌐 Language';
 bar.dataset.languageUx='v1';
 bar.setAttribute('aria-label','Language / 言語 / Ziman');
 select.setAttribute('aria-label','Choose language / 言語を選択 / Ziman hilbijêre');
 select.title='Choose a language / 言語を選択 / Ziman hilbijêre';
 for(const option of select.options){
  const name=NAMES[option.value];if(!name)continue;
  option.textContent=name.label;
  option.lang=name.lang;
  option.title=name.label;
 }
 // This message discloses partial English/Japanese fallback for some languages.
 // Make real room for it below the header instead of covering operating hours.
 const note=bar.querySelector('#asoboon-language-note');
 if(note){
  const syncNotice=()=>{
   const shown=!note.hidden&&Boolean(note.textContent.trim());
   document.body.classList.toggle('asoboon-language-note-shown',shown);
   if(shown){
    const h=Math.ceil(note.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--asoboon-language-note-height',Math.max(24,h)+'px');
   }else document.documentElement.style.removeProperty('--asoboon-language-note-height');
  };
  new MutationObserver(syncNotice).observe(note,{
   attributes:true,attributeFilter:['hidden'],childList:true,subtree:true,characterData:true
  });
  window.addEventListener('resize',syncNotice,{passive:true});
  window.addEventListener('asoboon:v2-route-rendered',syncNotice);
  syncNotice();
 }
 return true;
}
if(!enhance()){
 const observer=new MutationObserver(()=>{
  if(enhance())observer.disconnect();
 });
 observer.observe(document.documentElement,{subtree:true,childList:true});
 window.addEventListener('load',enhance,{once:true});
}
})();
