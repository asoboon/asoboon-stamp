(()=>{'use strict';

const CHARACTER_ATLAS='./assets/pompon-chiru-atlas.webp?v=1';
const EFFECT_ATLAS='./assets/pompon-chiru-effects-atlas.webp?v=1';
const CHARACTER_CELL=256;
const EFFECT_CELL=256;

const CHARACTERS=Object.freeze({
  pompon_dash:{col:0,row:0},
  pompon_brake:{col:1,row:0},
  pompon_wobble:{col:2,row:0},
  chiru_exasperated:{col:3,row:0},
  chiru_chase:{col:0,row:1},
  duo_runaway_crash:{col:1,row:1},
  pompon_peek:{col:2,row:1},
  chiru_watch:{col:3,row:1},
  duo_surprised:{col:0,row:2},
  pompon_ballride:{col:1,row:2},
  pompon_fly:{col:2,row:2},
  chiru_shocked:{col:3,row:2},
  duo_fly:{col:0,row:3},
  chiru_retort:{col:1,row:3},
});

const EFFECTS=Object.freeze({
  dust_impact:{col:0,row:0,source:'motion_cluster_004'},
  speed_trail:{col:1,row:0,source:'motion_cluster_007'},
  exclamation:{col:2,row:0,source:'reaction_cluster_005'},
  anger:{col:3,row:0,source:'reaction_cluster_007'},
  sweat:{col:0,row:1,source:'reaction_cluster_008'},
  sparkle:{col:1,row:1,source:'reaction_cluster_014'},
  collision_arc:{col:2,row:1,source:'reaction_cluster_025'},
  stars:{col:3,row:1,source:'magic_cluster_003'},
});

let charPromise=null;
let effectPromise=null;
const preloadState={characters:false,effects:false,characterErrors:0,effectErrors:0};

function load(url,key){
  return new Promise(resolve=>{
    const image=new Image();
    image.decoding='async';
    image.onload=()=>{preloadState[key]=true;resolve(true)};
    image.onerror=()=>{preloadState[key+'Errors']=(preloadState[key+'Errors']||0)+1;resolve(false)};
    image.src=url;
    if(image.complete&&image.naturalWidth>0){preloadState[key]=true;resolve(true)}
  });
}
function preloadCharacters(){return charPromise||(charPromise=load(CHARACTER_ATLAS,'characters'))}
function preloadEffects(){return effectPromise||(effectPromise=load(EFFECT_ATLAS,'effects'))}
function preloadAll(){return Promise.all([preloadCharacters(),preloadEffects()])}

function createCharacter(name,className=''){
  const def=CHARACTERS[String(name||'')];
  if(!def)return null;
  const el=document.createElement('div');
  el.className='pc-sprite pc-character '+className;
  el.dataset.pcAsset=name;
  el.style.backgroundImage='url("'+CHARACTER_ATLAS+'")';
  el.style.backgroundSize=(CHARACTER_CELL*4)+'px '+(CHARACTER_CELL*4)+'px';
  el.style.backgroundPosition=(-def.col*CHARACTER_CELL)+'px '+(-def.row*CHARACTER_CELL)+'px';
  return el;
}
function createEffect(name,className=''){
  const def=EFFECTS[String(name||'')];
  if(!def)return null;
  const el=document.createElement('div');
  el.className='pc-sprite pc-effect '+className;
  el.dataset.pcEffect=name;
  el.style.backgroundImage='url("'+EFFECT_ATLAS+'")';
  el.style.backgroundSize=(EFFECT_CELL*4)+'px '+(EFFECT_CELL*2)+'px';
  el.style.backgroundPosition=(-def.col*EFFECT_CELL)+'px '+(-def.row*EFFECT_CELL)+'px';
  return el;
}
function diagnostics(){
  return{
    characterAtlas:CHARACTER_ATLAS,effectAtlas:EFFECT_ATLAS,
    characterCount:Object.keys(CHARACTERS).length,effectCount:Object.keys(EFFECTS).length,
    preload:{...preloadState},
  };
}

window.ASOBOON_BOARD_CHARACTER_ASSETS=Object.freeze({
  version:'1.0.0',
  CHARACTER_ATLAS,EFFECT_ATLAS,CHARACTERS,EFFECTS,
  preloadCharacters,preloadEffects,preloadAll,
  createCharacter,createEffect,diagnostics,
});
})();