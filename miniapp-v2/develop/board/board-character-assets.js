(()=>{'use strict';

const CHARACTER_ATLAS='./assets/pompon-chiru-atlas-v2.webp?v=3';
const EFFECT_ATLAS='./assets/pompon-chiru-effects-atlas-v2.webp?v=3';
const CELL=256;
const CHARACTER_COLS=5,CHARACTER_ROWS=6;
const EFFECT_COLS=5,EFFECT_ROWS=4;

const CHARACTERS=Object.freeze({
  pompon_dash:{col:0,row:0},pompon_brake:{col:1,row:0},pompon_cannot_stop:{col:2,row:0},pompon_wobble:{col:3,row:0},pompon_peek:{col:4,row:0},
  pompon_ballride:{col:0,row:1},pompon_smug:{col:1,row:1},pompon_fly:{col:2,row:1},pompon_oops:{col:3,row:1},pompon_shocked:{col:4,row:1},
  chiru_peek:{col:0,row:2},chiru_watch:{col:1,row:2},chiru_chase:{col:2,row:2},chiru_dodge:{col:3,row:2},chiru_exasperated:{col:4,row:2},
  chiru_shocked:{col:0,row:3},chiru_retort:{col:1,row:3},chiru_sneak:{col:2,row:3},chiru_angry:{col:3,row:3},chiru_sigh:{col:4,row:3},
  duo_chase:{col:0,row:4},duo_runaway_crash:{col:1,row:4},duo_surprised:{col:2,row:4},duo_fly:{col:3,row:4},duo_dodge:{col:4,row:4},
  duo_entangled:{col:0,row:5},duo_failure_scold:{col:1,row:5},duo_friendship_oops:{col:2,row:5},duo_oh_no:{col:3,row:5},duo_boast_disbelief:{col:4,row:5},
});

const CHARACTER_META=Object.freeze(Object.fromEntries(Object.keys(CHARACTERS).map(name=>[name,Object.freeze((()=>{
  const directionalRight=new Set([
    'pompon_dash','pompon_brake','pompon_cannot_stop','pompon_wobble','pompon_ballride','pompon_fly',
    'chiru_watch','chiru_chase','chiru_dodge','chiru_retort','chiru_sneak','chiru_angry'
  ]);
  const duo=name.startsWith('duo_');
  return{
    nativeFacing:directionalRight.has(name)?'right':duo?'duo':'front',
    flipSafe:directionalRight.has(name),
    gazePolicy:duo?'internal-duo':directionalRight.has(name)?'target-aware':'front-or-scene-defined'
  };
})())])));
const EFFECTS=Object.freeze({
  dust_streak:{col:0,row:0,source:'motion_part_005',semantic:'movement'},
  dust_impact:{col:1,row:0,source:'motion_part_008',semantic:'impact'},
  dust_trail:{col:2,row:0,source:'motion_part_025',semantic:'movement'},
  dust_burst:{col:3,row:0,source:'motion_part_035',semantic:'impact'},
  speed_slash:{col:4,row:0,source:'motion_part_076',semantic:'movement'},
  speed_lines:{col:0,row:1,source:'motion_part_091',semantic:'movement'},
  impact_burst:{col:1,row:1,source:'reaction_part_001',semantic:'impact'},
  impact_starburst:{col:2,row:1,source:'reaction_part_032',semantic:'impact'},
  alert_red:{col:3,row:1,source:'reaction_part_066',semantic:'alert'},
  exclamation:{col:4,row:1,source:'reaction_part_075',semantic:'alert'},
  question:{col:0,row:2,source:'reaction_part_073',semantic:'question'},
  sweat:{col:1,row:2,source:'reaction_part_077',semantic:'reaction'},
  anger:{col:2,row:2,source:'reaction_part_078',semantic:'anger'},
  dizzy_stars:{col:3,row:2,source:'reaction_part_099',semantic:'aftermath'},
  dizzy_spiral:{col:4,row:2,source:'reaction_part_100',semantic:'aftermath'},
  comic_star:{col:0,row:3,source:'reaction_part_102',semantic:'impact'},
  sparkle_gold:{col:1,row:3,source:'reaction_part_120',semantic:'success'},
  jump_arc:{col:2,row:3,source:'reaction_part_131',semantic:'trajectory'},
  magic_star:{col:3,row:3,source:'magic_part_003',semantic:'magic'},
  magic_sparkle:{col:4,row:3,source:'magic_part_007',semantic:'magic'},
});

const EFFECT_RULES=Object.freeze({
  movement:Object.freeze(['dust_streak','dust_trail','speed_slash','speed_lines']),
  impact:Object.freeze(['dust_impact','dust_burst','impact_burst','impact_starburst','comic_star']),
  success:Object.freeze(['sparkle_gold','magic_sparkle']),
  aftermath:Object.freeze(['dizzy_stars','dizzy_spiral']),
  alert:Object.freeze(['exclamation','alert_red']),
  question:Object.freeze(['question']),
  reaction:Object.freeze(['sweat']),
  anger:Object.freeze(['anger']),
  dodge:Object.freeze(['jump_arc','speed_slash']),
  ambient:Object.freeze(['magic_star','magic_sparkle','sparkle_gold','speed_lines','dust_streak']),
});
const STANDALONE_CHARACTERS=Object.freeze(['pompon_peek','chiru_peek','chiru_sneak']);
const DEFAULT_ANCHORS=Object.freeze({HEAD:[.5,.16],FACE:[.5,.26],FACE_SAFE:[.5,.26],HAND:[.72,.48],FEET:[.5,.88],BODY:[.5,.54],FULL_BODY:[.5,.52],CENTER:[.5,.5],IMPACT:[.72,.54],TRAIL_ORIGIN:[.22,.72],ENTRY_POINT:[.5,.62],LOOK_TARGET:[.82,.3]});
const CHARACTER_ANCHORS=Object.freeze(Object.fromEntries(Object.keys(CHARACTERS).map(name=>[name,Object.freeze({
  ...DEFAULT_ANCHORS,
  ...(name.includes('peek')?{FACE:[.5,.34],FACE_SAFE:[.5,.34],HAND:[.62,.58],ENTRY_POINT:[.5,.55],LOOK_TARGET:[.78,.36]}:{}),
  ...(name.includes('dash')||name.includes('chase')||name.includes('runaway')?{FEET:[.5,.82],IMPACT:[.82,.55],TRAIL_ORIGIN:[.12,.68]}:{}),
  ...(name.includes('fly')||name.includes('dodge')?{IMPACT:[.68,.48],TRAIL_ORIGIN:[.22,.62]}:{}),
  ...(name.startsWith('duo_')?{HEAD:[.5,.13],FACE:[.5,.25],HAND:[.76,.48],IMPACT:[.72,.56],TRAIL_ORIGIN:[.18,.7]}:{}),
})])));


const DEFAULT_VISUAL_ZONES=Object.freeze({
  faces:Object.freeze([Object.freeze([.5,.26,.34,.28])]),
  body:Object.freeze([.5,.54,.62,.66]),
});
function frozenVisual(faces,body){
  return Object.freeze({
    faces:Object.freeze(faces.map(z=>Object.freeze(z))),
    body:Object.freeze(body),
  });
}
function visualZonesFor(name){
  if(name.startsWith('duo_')){
    if(name==='duo_entangled')return frozenVisual([[.41,.31,.20,.20],[.68,.43,.20,.20]],[.5,.57,.9,.62]);
    if(name==='duo_runaway_crash')return frozenVisual([[.40,.29,.20,.20],[.69,.38,.20,.20]],[.5,.57,.9,.6]);
    if(name==='duo_chase')return frozenVisual([[.32,.39,.19,.19],[.66,.34,.21,.21]],[.5,.56,.9,.58]);
    return frozenVisual([[.36,.34,.21,.21],[.66,.34,.21,.21]],[.5,.56,.88,.6]);
  }
  const overrides={
    pompon_dash:[[[.67,.39,.27,.25]],[.5,.57,.9,.5]],
    pompon_brake:[[[.50,.33,.27,.25]],[.5,.58,.78,.62]],
    pompon_cannot_stop:[[[.55,.35,.28,.26]],[.5,.57,.8,.6]],
    pompon_wobble:[[[.53,.33,.28,.26]],[.5,.56,.78,.62]],
    pompon_ballride:[[[.53,.30,.27,.25]],[.5,.55,.78,.66]],
    pompon_fly:[[[.55,.35,.27,.25]],[.5,.55,.8,.58]],
    pompon_oops:[[[.54,.29,.27,.25]],[.5,.55,.72,.68]],
    pompon_shocked:[[[.50,.39,.29,.27]],[.5,.58,.78,.62]],
    chiru_watch:[[[.52,.36,.24,.23]],[.5,.57,.72,.7]],
    chiru_chase:[[[.57,.39,.24,.23]],[.5,.58,.78,.64]],
    chiru_dodge:[[[.54,.35,.24,.23]],[.5,.57,.78,.64]],
    chiru_shocked:[[[.50,.31,.25,.24]],[.5,.57,.72,.68]],
    chiru_retort:[[[.52,.30,.25,.24]],[.5,.57,.76,.68]],
    chiru_sneak:[[[.52,.34,.24,.23]],[.5,.57,.76,.66]],
    chiru_angry:[[[.52,.30,.25,.24]],[.5,.56,.74,.7]],
    chiru_sigh:[[[.50,.31,.25,.24]],[.5,.56,.72,.7]],
  };
  const hit=overrides[name];
  return hit?frozenVisual(hit[0],hit[1]):DEFAULT_VISUAL_ZONES;
}
const CHARACTER_VISUAL_ZONES=Object.freeze(Object.fromEntries(
  Object.keys(CHARACTERS).map(name=>[name,visualZonesFor(name)])
));

let charPromise=null,effectPromise=null;
const preloadState={characters:false,effects:false,characterErrors:0,effectErrors:0};

function load(url,key){
  return new Promise(resolve=>{
    const image=new Image();image.decoding='async';let settled=false;
    const done=ok=>{if(settled)return;settled=true;preloadState[key]=Boolean(ok);if(!ok)preloadState[key+'Errors']=(preloadState[key+'Errors']||0)+1;resolve(Boolean(ok))};
    image.onload=()=>done(true);image.onerror=()=>done(false);image.src=url;
    if(image.complete&&image.naturalWidth>0)done(true);
  });
}
function preloadCharacters(){return charPromise||(charPromise=load(CHARACTER_ATLAS,'characters'))}
function preloadEffects(){return effectPromise||(effectPromise=load(EFFECT_ATLAS,'effects'))}
function preloadAll(){return Promise.all([preloadCharacters(),preloadEffects()])}

function sprite(baseClass,name,def,url,cols,rows){
  if(!def)return null;
  const el=document.createElement('div');el.className='pc-sprite '+baseClass;
  if(baseClass.includes('character'))el.dataset.pcAsset=name;else el.dataset.pcEffect=name;
  el.style.backgroundImage='url("'+url+'")';
  el.style.backgroundSize=(CELL*cols)+'px '+(CELL*rows)+'px';
  el.style.backgroundPosition=(-def.col*CELL)+'px '+(-def.row*CELL)+'px';
  return el;
}
function createCharacter(name,className=''){return sprite('pc-character '+className,String(name||''),CHARACTERS[String(name||'')],CHARACTER_ATLAS,CHARACTER_COLS,CHARACTER_ROWS)}
function createEffect(name,className=''){return sprite('pc-effect '+className,String(name||''),EFFECTS[String(name||'')],EFFECT_ATLAS,EFFECT_COLS,EFFECT_ROWS)}
function validatePairing(effectName,requiredSemantic){
  if(!requiredSemantic)return Boolean(EFFECTS[String(effectName||'')]);
  const allowed=EFFECT_RULES[String(requiredSemantic||'')];
  return Array.isArray(allowed)&&allowed.includes(String(effectName||''));
}
function diagnostics(){return{version:'3.4.0',characterAtlas:CHARACTER_ATLAS,effectAtlas:EFFECT_ATLAS,characterCount:Object.keys(CHARACTERS).length,effectCount:Object.keys(EFFECTS).length,anchorCount:Object.keys(CHARACTER_ANCHORS).length,characterMetaCount:Object.keys(CHARACTER_META).length,visualZoneCount:Object.keys(CHARACTER_VISUAL_ZONES).length,standaloneCharacters:[...STANDALONE_CHARACTERS],effectRules:Object.fromEntries(Object.entries(EFFECT_RULES).map(([k,v])=>[k,[...v]])),preload:{...preloadState},sourcePolicy:'new-source-only'}}

window.ASOBOON_BOARD_CHARACTER_ASSETS=Object.freeze({
  version:'3.4.0',CHARACTER_ATLAS,EFFECT_ATLAS,CHARACTERS,CHARACTER_META,CHARACTER_VISUAL_ZONES,EFFECTS,EFFECT_RULES,STANDALONE_CHARACTERS,CHARACTER_ANCHORS,
  preloadCharacters,preloadEffects,preloadAll,createCharacter,createEffect,validatePairing,diagnostics,
});
})();
