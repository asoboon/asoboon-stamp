(()=>{
'use strict';
// Waiting-time show v2. Replaces the old 100+ small idle events with a handful of big,
// fast gags built from the existing POMPON / CHIRU sprites. Rules: characters are large,
// a gag lasts 3-4 seconds at real speed, nothing lingers on top of the numbers, and any
// real data change aborts the gag at once.
const M=window.ASOBOON_BOARD_EFFECTS,CA=window.ASOBOON_BOARD_CHARACTER_ASSETS,FW=window.ASOBOON_BOARD_FOURTH_WALL_ASSETS;
if(!M||!CA)return;
const CONFIG={ENABLED:true,FIRST_DELAY_MS:6000,GAP_MIN_MS:12000,GAP_MAX_MS:20000,REAL_CHANGE_COOLDOWN_MS:12000};
const diag={version:'2.0.0',played:0,aborted:0,last:'',playing:'',skippedBusy:0};
let scope=null,nextAt=Infinity,bag=[];
const now=()=>Date.now();
const rand=(a,b)=>a+Math.random()*(b-a);
const statusBusy=()=>{const d=window.ASOBOON_BOARD_ANIMATIONS?.getDiagnostics?.();return Boolean(d&&(d.running>0||d.queuedNow>0))};

function context(sc){
  const W=innerWidth,H=innerHeight;
  const put=el=>{el.classList.add('show-actor');el.style.transform='translate3d(-300vw,0,0)';if(!sc.add(el,'front'))throw new Error('aborted');return el};
  const sheet=(url,cols,rows,map)=>(name,size)=>{
    const el=document.createElement('div');el._s=size;el._map=map;
    el.style.width=el.style.height=size+'px';
    el.style.backgroundImage='url("'+url+'")';el.style.backgroundSize=(size*cols)+'px '+(size*rows)+'px';
    c.pose(el,name);return put(el);
  };
  const c={W,H,
    at:(x,y,extra='')=>'translate3d('+x+'px,'+y+'px,0) '+extra,
    A:(el,frames,ms,o={})=>sc.animate(el,frames,{duration:ms,fill:'both',easing:'linear',...o}),
    wait:ms=>sc.wait(ms),
    pose:(el,name)=>{const d=el._map[name];if(d)el.style.backgroundPosition=(-d.col*el._s)+'px '+(-d.row*el._s)+'px'},
    fw:(family,n,width)=>{
      const f=FW?.FAMILIES?.[family];if(!f)throw new Error('no-asset');
      const k=width/f.cellW,h=f.cellH*k,i=n-1,el=document.createElement('div');
      el._w=width;el._h=h;el.style.width=width+'px';el.style.height=h+'px';
      el.style.backgroundImage='url("'+f.url+'")';el.style.backgroundSize=(width*f.cols)+'px '+(h*f.rows)+'px';
      el.style.backgroundPosition=(-(i%f.cols)*width)+'px '+(-Math.floor(i/f.cols)*h)+'px';
      return put(el);
    },
    mid:(el,yFrac)=>[(W-el._w)/2,H*yFrac-el._h/2],
    shake:(px,ms)=>{const b=document.querySelector('.board');if(b)sc.animate(b,[0,.15,.35,.55,.78,1].map((o,i)=>({offset:o,transform:'translate3d('+(i%2?px:-px)*(1-o)+'px,'+(i%2?-px:px)*.6*(1-o)+'px,0)'})),{duration:ms,easing:'linear'})},
  };
  c.char=sheet(CA.CHARACTER_ATLAS,5,6,CA.CHARACTERS);
  c.fx=sheet(CA.EFFECT_ATLAS,5,4,CA.EFFECTS);
  return c;
}

const GAGS={
  async dash(c){
    const s=c.W*.5,y=c.H*.56,p=c.char('pompon_dash',s),q=c.char('chiru_chase',s*.85),dust=c.fx('dust_trail',s*.7);
    const run=(el,from,to,yy,ms,delay,flip)=>c.A(el,[0,.25,.5,.75,1].map(k=>({offset:k,transform:c.at(from+(to-from)*k,yy+((k*4)%2?-c.H*.025:0),flip?'scaleX(-1)':'')})),ms,{delay});
    await Promise.all([run(p,-s,c.W,y,1100,0),run(dust,-s*1.6,c.W-s*.6,y+s*.3,1100,0),run(q,-s,c.W,y+s*.1,1100,260)]);
    c.pose(p,'pompon_cannot_stop');c.pose(q,'chiru_angry');
    await Promise.all([run(p,c.W,-s,y-c.H*.2,900,0,true),run(q,c.W,-s,y-c.H*.14,900,300,true)]);
  },
  async peek(c){
    const s=c.W*.95,x=(c.W-s)/2,down=c.H,up=c.H-s*.62,p=c.char('pompon_peek',s);
    await c.A(p,[{transform:c.at(x,down)},{transform:c.at(x,up-30),offset:.7},{transform:c.at(x,up)}],450,{easing:'cubic-bezier(.2,.9,.3,1)'});
    await c.A(p,[{transform:c.at(x,up,'rotate(0deg)')},{transform:c.at(x-40,up,'rotate(-7deg)')},{transform:c.at(x+40,up,'rotate(7deg)')},{transform:c.at(x,up,'rotate(0deg)')}],1100);
    c.pose(p,'pompon_smug');
    await c.A(p,[{transform:c.at(x,up,'scale(1)')},{transform:c.at(x,up-40,'scale(1.08)')},{transform:c.at(x,up,'scale(1)')}],500);
    await c.wait(350);c.pose(p,'pompon_shocked');
    await c.A(p,[{transform:c.at(x,up-50)},{transform:c.at(x,down+40)}],320,{delay:180,easing:'cubic-bezier(.6,0,1,.6)'});
  },
  async smash(c){
    const faces=[['pompon',3],['duo',5],['duo',6],['duo',2]],pick=faces[Math.floor(Math.random()*faces.length)];
    const crack=c.fw('cracks',1,c.W*.95),[kx,ky]=c.mid(crack,.5);
    await c.A(crack,[{opacity:0,transform:c.at(kx,ky,'scale(.4)')},{opacity:1,transform:c.at(kx,ky,'scale(1.08)'),offset:.6},{opacity:1,transform:c.at(kx,ky,'scale(1)')}],220);
    c.shake(14,300);await c.wait(380);
    const boom=c.fw('impacts',1,c.W*1.1),[bx,by]=c.mid(boom,.5);
    c.A(boom,[{opacity:1,transform:c.at(bx,by,'scale(.3)')},{opacity:0,transform:c.at(bx,by,'scale(1.5)')}],420);
    c.shake(26,450);
    const face=c.fw(pick[0],pick[1],c.W*1.08),[fx,fy]=c.mid(face,.5);
    await c.A(face,[{transform:c.at(fx,fy,'scale(.2)')},{transform:c.at(fx,fy,'scale(1.14)'),offset:.6},{transform:c.at(fx,fy,'scale(1)')}],360,{easing:'cubic-bezier(.2,.9,.3,1)'});
    await c.A(face,[0,-2,0,2,0].map((r,i)=>({transform:c.at(fx,fy-(i%2?16:0),'scale('+(i%2?1.04:1)+') rotate('+r+'deg)')})),1500);
    await Promise.all([c.A(face,[{opacity:1,transform:c.at(fx,fy,'scale(1)')},{opacity:0,transform:c.at(fx,fy,'scale(.5)')}],300),c.A(crack,[{opacity:1},{opacity:0}],500)]);
  },
  async ball(c){
    const s=c.W*.55,y=c.H*.5,stop=c.W*.5-s*.5,p=c.char('pompon_ballride',s);
    await c.A(p,[0,.2,.4,.6,.8,1].map((k,i)=>({offset:k,transform:c.at(-s+(stop+s)*k,y+(i%2?-18:0),'rotate('+(i%2?7:-7)+'deg)')})),1400);
    c.pose(p,'pompon_oops');c.shake(16,300);
    const b=c.fx('impact_starburst',s*.9);c.A(b,[{opacity:1,transform:c.at(stop+s*.1,y,'scale(.4)')},{opacity:0,transform:c.at(stop+s*.1,y,'scale(1.6)')}],400);
    await c.A(p,[{transform:c.at(stop,y,'scale(1.15,.85)')},{transform:c.at(stop,y,'scale(1)')}],300);
    c.pose(p,'pompon_fly');
    await c.A(p,[{transform:c.at(stop,y,'rotate(0deg)')},{transform:c.at(stop+c.W*.2,y-c.H*.3,'rotate(160deg)'),offset:.5},{transform:c.at(c.W+20,-s,'rotate(360deg)')}],800,{easing:'cubic-bezier(.3,0,.8,.7)'});
  },
  async drop(c){
    const s=c.W*.6,x=(c.W-s)/2,y=c.H*.5,q=c.char('chiru_shocked',s);
    await c.A(q,[{transform:c.at(x,-s,'scale(.9,1.2)')},{transform:c.at(x,y,'scale(.9,1.2)'),offset:.8},{transform:c.at(x,y+s*.12,'scale(1.25,.72)'),offset:.9},{transform:c.at(x,y,'scale(1)')}],620,{easing:'cubic-bezier(.6,0,1,.7)'});
    c.shake(18,300);
    const d=c.fx('dust_impact',s);c.A(d,[{opacity:1,transform:c.at(x,y+s*.45,'scale(.6)')},{opacity:0,transform:c.at(x,y+s*.3,'scale(1.5)')}],600);
    const z=c.fx('dizzy_stars',s*.6);c.A(z,[{opacity:1,transform:c.at(x+s*.2,y-s*.25,'rotate(0deg)')},{opacity:1,transform:c.at(x+s*.2,y-s*.25,'rotate(360deg)'),offset:.85},{opacity:0,transform:c.at(x+s*.2,y-s*.25,'rotate(420deg)')}],1300);
    await c.wait(900);c.pose(q,'chiru_sigh');await c.wait(600);c.pose(q,'chiru_dodge');
    await c.A(q,[{transform:c.at(x,y)},{transform:c.at(x+c.W*.3,y-c.H*.12),offset:.4},{transform:c.at(c.W+20,y+c.H*.05)}],520);
  },
  async duo(c){
    const s=c.W*.85,x=(c.W-s)/2,y=c.H*.42,d=c.char('duo_fly',s);
    await c.A(d,[{transform:c.at(-s,c.H*.8,'rotate(-18deg) scale(.7)')},{transform:c.at(c.W,c.H*.05,'rotate(-18deg) scale(1.15)')}],800,{easing:'cubic-bezier(.3,0,.7,1)'});
    c.pose(d,'duo_runaway_crash');
    await c.A(d,[{transform:c.at(c.W,c.H*.1,'rotate(14deg)')},{transform:c.at(x,y,'rotate(0deg)')}],420,{delay:250,easing:'cubic-bezier(.5,0,1,.8)'});
    c.shake(22,350);
    const b=c.fx('impact_burst',s);c.A(b,[{opacity:1,transform:c.at(x,y,'scale(.4)')},{opacity:0,transform:c.at(x,y,'scale(1.6)')}],450);
    c.pose(d,'duo_entangled');
    await c.A(d,[{transform:c.at(x,y,'rotate(0deg) scale(1.1)')},{transform:c.at(x,y,'rotate(20deg) scale(1)')},{transform:c.at(x,y,'rotate(-14deg) scale(1)')},{transform:c.at(x,y,'rotate(0deg) scale(1)')}],900);
    c.pose(d,'duo_oh_no');
    await c.A(d,[{transform:c.at(x,y)},{transform:c.at(x,y-40),offset:.25},{transform:c.at(x,c.H+20)}],520,{delay:300,easing:'cubic-bezier(.6,0,1,.6)'});
  },
  async paw(c){
    const f=c.fw('pompon',1,c.W*1.12),[x,y]=c.mid(f,.5);
    await c.A(f,[{transform:c.at(x,y,'scale(2)')},{transform:c.at(x,y,'scale(.94)'),offset:.7},{transform:c.at(x,y,'scale(1)')}],300,{easing:'cubic-bezier(.6,0,1,.7)'});
    c.shake(30,450);await c.wait(700);
    await c.A(f,[{transform:c.at(x,y,'scale(1)')},{transform:c.at(x,y,'scale(.9)'),offset:.4},{transform:c.at(x,y,'scale(1.1)'),offset:.7},{transform:c.at(x,y,'scale(1)')}],420);
    c.shake(20,350);await c.wait(800);
    await c.A(f,[{opacity:1,transform:c.at(x,y,'scale(1)')},{opacity:0,transform:c.at(x,y,'scale(.5)')}],280);
  },
};
const IDS=Object.freeze(Object.keys(GAGS));

function abort(reason='abort'){
  if(scope){diag.aborted+=1;const s=scope;scope=null;s.abort(reason)}
}
async function play(id){
  if(scope||!CONFIG.ENABLED||M.isReduced?.()||!GAGS[id])return false;
  const sc=scope=M.createScope('show-'+id,1/Math.max(.05,M.getSlowdown?.()||1));
  diag.playing=id;diag.last=id;diag.played+=1;
  try{await GAGS[id](context(sc))}catch{}
  finally{sc.cleanup();if(scope===sc)scope=null;diag.playing='';nextAt=now()+rand(CONFIG.GAP_MIN_MS,CONFIG.GAP_MAX_MS)}
  return true;
}
function next(){
  if(!bag.length)bag=IDS.slice().sort(()=>Math.random()-.5).filter((id,i,a)=>!(i===a.length-1&&id===diag.last));
  return bag.pop()||IDS[0];
}
function onBaseline(){
  abort('baseline');nextAt=now()+CONFIG.FIRST_DELAY_MS;
  void CA.preloadAll?.();void FW?.preloadFamilies?.(['cracks','impacts','pompon','duo']);
}
function onStableUpdate(){
  if(scope||!CONFIG.ENABLED||now()<nextAt)return Promise.resolve(false);
  if(statusBusy()){diag.skippedBusy+=1;return Promise.resolve(false)}
  return play(next());
}
function onRealChange(){abort('real-change');nextAt=now()+CONFIG.REAL_CHANGE_COOLDOWN_MS}
function onCommunicationError(){abort('communication-error');nextAt=now()+CONFIG.REAL_CHANGE_COOLDOWN_MS}
function suspend(reason='inactive'){abort(reason);nextAt=Infinity}
function setConfig(patch={}){for(const k of Object.keys(CONFIG))if(k in patch)CONFIG[k]=patch[k];return{...CONFIG}}
window.ASOBOON_BOARD_SHOW=Object.freeze({
  version:diag.version,gags:IDS,play,abort,onBaseline,onStableUpdate,onRealChange,onCommunicationError,suspend,setConfig,
  getConfig:()=>({...CONFIG}),getDiagnostics:()=>({...diag,nextInMs:Number.isFinite(nextAt)?Math.max(0,nextAt-now()):null}),
});
})();
