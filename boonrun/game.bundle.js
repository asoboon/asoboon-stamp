'use strict';
window.__BOONRUN_BOOT={phase:'script-loaded',at:Date.now()};
/* BOON RUN v1.1 foundation data
 * Coordinate system used by the game/validator:
 * - logical viewport: 1600 x 720
 * - X increases to the right
 * - vertical physics uses height above road (0 = road surface)
 * - car remains at fixed screen X; world scrolls left
 */

const PHYSICS = Object.freeze({
  logicalWidth: 1600,
  logicalHeight: 720,
  fixedHz: 120,
  dt: 1 / 120,
  gravity: 2400,
  jump1Velocity: 850,
  jump2Velocity: 720,
  baseScrollPxPerSec: 580,
  maxSpeedMultiplier: 1.65,
  pxPerMeter: 20,
  carCenterX: 260,
  baseCarHitbox: { width: 92, height: 48 },
  visualCarBox: { width: 112, height: 66 },
  inputBufferMs: 120,
  inputSampleTicks: 2, // inputs are explored every 1/60s; physics still runs at 120Hz
  scoreFuelPerMeter: 0.05,
  itemHitbox: { width: 48, height: 48 },
  itemVisualSize: 80,
  secondJumpAssist: 0.40, // early second tap adds lift instead of cancelling the first jump
});

const DERIVED = Object.freeze({
  jump1AirTime: (2 * PHYSICS.jump1Velocity) / PHYSICS.gravity,
  jump1Height: (PHYSICS.jump1Velocity ** 2) / (2 * PHYSICS.gravity),
  jump2ExtraHeight: (PHYSICS.jump2Velocity ** 2) / (2 * PHYSICS.gravity),
  baseKmH: (PHYSICS.baseScrollPxPerSec / PHYSICS.pxPerMeter) * 3.6,
  maxKmH: (PHYSICS.baseScrollPxPerSec * PHYSICS.maxSpeedMultiplier / PHYSICS.pxPerMeter) * 3.6,
});

const SPEED_STEPS = Object.freeze([
  1.00, 1.05, 1.10, 1.15, 1.20, 1.25, 1.30,
  1.35, 1.40, 1.45, 1.50, 1.55, 1.60, 1.65,
]);

const ITEM_LANES = Object.freeze({
  GROUND: 52, // no jump required on flat road
  AIR1: 185,  // requires one jump from flat road
  AIR2: 245,  // high lane; solution is vehicle-specific (2nd jump / big hop / rocket hold)
});

const OBSTACLES = Object.freeze({
  CONE: {
    type: 'CONE', width: 20, height: 30, visualWidth: 24, visualHeight: 34, unlockM: 0,
    answer: 'JUMP1', measuredWindowMs: { speed100: 191, speed165: 318 },
  },
  BARRIER: {
    type: 'BARRIER', width: 40, height: 30, visualWidth: 46, visualHeight: 34, unlockM: 260,
    answer: 'JUMP1', measuredWindowMs: { speed100: 118, speed165: 276 },
  },
  CRATE: {
    type: 'CRATE', width: 34, height: 138, visualWidth: 38, visualHeight: 140, unlockM: 1000,
    answer: 'DOUBLE_JUMP_OR_COMMIT', measuredWindowMs: { speed100: 155, speed165: 298 },
  },
  PIT: {
    type: 'PIT', temporalWidthMs: 285, unlockM: 1900,
    answer: 'JUMP1_LANDING', measuredWindowMs: { speed100: 310, speed165: 310 },
  },
  ROLLTIRE: {
    type: 'ROLLTIRE', width: 36, height: 42, visualWidth: 42, visualHeight: 48, ownLeftPxPerSec: 135, unlockM: 3600,
    answer: 'JUMP1_TIMING', measuredWindowMs: { speed100: 159, speed165: 266 },
  },
  LOWBEAM: {
    type: 'LOWBEAM', width: 180, thickness: 20, lowerEdge: 92, unlockM: 5200,
    answer: 'NO_JUMP',
  },
  DRONE: {
    type: 'DRONE', width: 58, height: 22, visualWidth: 70, visualHeight: 30, lowerEdge: 88, unlockM: 520,
    answer: 'NO_JUMP',
  },
  ARCH: {
    type: 'ARCH', pillarWidth: 28, pillarHeight: 42,
    roofWidth: 170, roofLowerEdge: 218, unlockM: 7600,
    answer: 'JUMP1_ONLY', measuredWindowMs: { speed100: 204, speed165: 331 },
  },
});

// Minimum recovery time from the end of the first obstacle family to the next.
// Values are conservative measurements at 165% speed. Pattern definitions are
// intentionally looser than these values unless the pattern itself is a challenge.
const MIN_GAP_MS = Object.freeze({
  CONE:      { CONE:180, BARRIER:240, CRATE:220, PIT:260, ROLLTIRE:190, DRONE:520, LOWBEAM:520, ARCH:220 },
  BARRIER:   { CONE:180, BARRIER:240, CRATE:220, PIT:260, ROLLTIRE:190, DRONE:560, LOWBEAM:560, ARCH:220 },
  CRATE:     { CONE:220, BARRIER:220, CRATE:760, PIT:240, ROLLTIRE:220, DRONE:720, LOWBEAM:720, ARCH:620 },
  PIT:       { CONE:180, BARRIER:200, CRATE:240, PIT:220, ROLLTIRE:200, DRONE:580, LOWBEAM:580, ARCH:220 },
  ROLLTIRE:  { CONE:180, BARRIER:240, CRATE:220, PIT:220, ROLLTIRE:260, DRONE:560, LOWBEAM:560, ARCH:220 },
  DRONE:     { CONE:520, BARRIER:560, CRATE:720, PIT:520, ROLLTIRE:560, DRONE:260, LOWBEAM:300, ARCH:560 },
  LOWBEAM:   { CONE:520, BARRIER:560, CRATE:720, PIT:500, ROLLTIRE:560, DRONE:300, LOWBEAM:220, ARCH:560 },
  ARCH:      { CONE:200, BARRIER:220, CRATE:520, PIT:220, ROLLTIRE:220, DRONE:560, LOWBEAM:560, ARCH:220 },
});

const ITEMS = Object.freeze({
  FUEL_S: {
    type: 'FUEL_S', kind: 'fuel', amount: 20, visualSize: 80, hitbox: 48,
    balanceRole: 'basic',
  },
  FUEL_L: {
    type: 'FUEL_L', kind: 'fuel', amount: 40, visualSize: 80, hitbox: 48,
    balanceRole: 'risk-reward',
  },
  FULL: {
    type: 'FULL', kind: 'fuel-full', amount: 'TO_FULL', visualSize: 84, hitbox: 48,
    balanceRole: 'rare-bonus',
  },
  SHIELD: {
    type: 'SHIELD', kind: 'special', hitbox: 48,
    charges: 1, expiresAfterM: 650,
    balanceRole: 'mistake-insurance',
  },
  MAGNET: {
    type: 'MAGNET', kind: 'special', hitbox: 48,
    durationM: 280, radiusPx: 200, attracts: ['FUEL_S','FUEL_L','FULL'],
    balanceRole: 'route-bypass',
  },
  BOOST: {
    type: 'BOOST', kind: 'special', hitbox: 48,
    durationSec: 2.4, scrollMultiplier: 1.32, invulnerable: true, fuelBurnMultiplier: 1.75,
    balanceRole: 'short-relief',
  },
});

// Fuel supply is controlled by distance debt rather than raw random spawn chance.
// Ratios are supply / base-car consumption. FULL and special items do not count
// toward the guaranteed budgets.
const FUEL_ZONES = Object.freeze([
  // Supply/consumption ratio for a neutral car. Early game teaches fuel,
  // mid/late game requires CHOICE/COMMIT pickups instead of SAFE-only cruising.
  { fromM: 0,     toM: 1500,  safeRatio: 1.18, allRatio: 1.30 },
  { fromM: 1500,  toM: 4000,  safeRatio: 1.00, allRatio: 1.20 },
  { fromM: 4000,  toM: 8000,  safeRatio: 0.86, allRatio: 1.18 },
  { fromM: 8000,  toM: 15000, safeRatio: 0.76, allRatio: 1.20 },
  { fromM: 15000, toM: Infinity, safeRatio: 0.65, allRatio: 1.24 },
]);

const FUEL_RULES = Object.freeze({
  baseConsumptionPerM: PHYSICS.scoreFuelPerMeter,
  startFuel: 100,
  safeItemPreferred: 'FUEL_S',
  optionalItems: ['FUEL_S','FUEL_L'],
  fullTankCountsAsGuaranteedSupply: false,
  invariant: 'A ranked car can run forever if it collects enough optional fuel; SAFE-only is intentionally insufficient in ENDLESS.',
  rankedPerfectSupplyFloor: 1.05,
});

// Ranked car physics must all remain within the validated envelope.
// Abilities are deterministic: no random death-save and no random jump physics.
const CARS = Object.freeze([
  {
    id:'boon', name:'ブーンピックアップ', rarity:'R', role:'ARMORED_HEAVY',
    hitboxScale:1.18, visualScale:1.12, jumpScale:0.82, secondJumpScale:1.22, gravityScale:1.12,
    fuelMax:100, fuelRate:1.15, maxJumps:2,
    ability:{ id:'ARMOR_RAM', armorMax:2, smashTypes:['CONE','BARRIER'], smashFuelCost:5,
      text:'HEAVY。1段目は低く重い。2段目だけ強烈なサス反発。ARMOR最大2でCONE/BARRIERを突破し、1回ごとに燃料5消費' },
  },
  {
    id:'wagon', name:'スマートワゴン', rarity:'R', role:'FLOAT_CONTROL',
    hitboxScale:0.98, visualScale:0.98, jumpScale:0.76, secondJumpScale:0.98, gravityScale:0.66,
    fuelMax:100, fuelRate:1.00, maxJumps:2,
    inputBufferMs:260,
    ability:{ id:'FLOAT_CONTROL', text:'FLOAT。1段目は低めでも長く浮く。2段目でしっかり高度を足す。地上障害に強いがドローン/ロービーム前は降りにくい' },
  },
  {
    id:'buggy', name:'ラッキーバギー', rarity:'SR', role:'COMMIT_HOP',
    hitboxScale:0.94, visualScale:0.96, jumpScale:1.40, secondJumpScale:1.00, gravityScale:1.16,
    fuelMax:100, fuelRate:1.05, maxJumps:1,
    ability:{ id:'COMMIT_HOP', archBreakFuelCost:12, text:'COMMIT。2段なし。1タップが超大ジャンプになり、飛んだ後の修正不能。アーチ天井は燃料12で破壊' },
  },
  {
    id:'bike', name:'パワーバイク', rarity:'SR', role:'PRECISION_FUEL',
    hitboxScale:0.60, visualScale:0.62, jumpScale:0.78, secondJumpScale:1.42, gravityScale:1.34,
    fuelMax:60, fuelRate:1.12, maxJumps:2,
    ability:{ id:'FUEL_STEP', secondJumpFuelCost:4,
      text:'QUICK。1段目は低く鋭くすぐ落ちる。2段目だけ強烈に跳ね上がる。最小ボディ・タンク60・2段ごとに燃料4' },
  },
  {
    id:'sport', name:'ニトロスポーツ', rarity:'SR', role:'OVERDRIVE',
    hitboxScale:0.90, visualScale:0.92, jumpScale:0.98, secondJumpScale:1.08, gravityScale:1.10,
    fuelMax:95, fuelRate:1.08, maxJumps:2, speedMultiplier:1.14,
    ability:{ id:'NITRO', nitroMax:30, fuelPickupCharge:8, closeCharge:6, overflowToNitro:true,
      durationSec:2.2, scrollMultiplier:1.65, invulnerable:true, boostFuelMultiplier:2.50,
      text:'FAST。常時14%高速で判断時間が短い。ジャンプも戻りが速い。FUEL/CLOSEでNITRO、発動中は爆速無敵・燃料×2.5' },
  },
  {
    id:'ssr', name:'コズミックファントム', rarity:'EXR', role:'DEATH_BET',
    hitboxScale:1.00, visualScale:0.90, jumpScale:0.94, secondJumpScale:1.00, gravityScale:1.00,
    fuelMax:100, fuelRate:1.06, maxJumps:2,
    ability:{ id:'PHANTOM_RESERVE', closeNeeded:2, saveFuelCost:35, saveInvulnSec:1.2,
      text:'STANDARD。低めで素直な1段＋基準2段。CLOSE×2を攻めてPHANTOM READY。致死回避は燃料35、PIT/GAS欠には無効' },
  },
  {
    id:'princess', name:'プリンセス・スターライナー', rarity:'SSR', role:'RISK_CHAIN',
    hitboxScale:1.02, visualScale:1.04, jumpScale:0.84, secondJumpScale:1.00, gravityScale:0.96,
    fuelMax:100, fuelRate:1.12, maxJumps:2,
    ability:{ id:'RISK_STAR', maxStars:5, decayEveryM:700,
      fuelRateByStars:[1.12,1.06,1.00,0.94,0.88,0.80], jumpBonusByStars:[1,1,1.03,1.06,1.08,1.10],
      thirdJumpMinStars:3, thirdJumpCost:1, thirdJumpScale:0.94,
      text:'GROW。1段目は低め、2段目で高く飛ぶ。危険燃料でSTAR成長し、ジャンプ力と燃費が上昇。★3から星を使う3段ジャンプへ変化' },
  },
  {
    id:'secret', name:'無敵のロケットアソブーン人間', rarity:'SECRET', role:'ROCKET_DANGER',
    ranked:true, secret:true, hitboxScale:0.72, visualScale:0.82, jumpScale:1.00, secondJumpScale:1.00, gravityScale:0.88,
    fuelMax:82, fuelRate:1.00, maxJumps:0,
    ability:{ id:'ROCKET_DANGER', thrustAccel:3150, maxRiseSpeed:610, maxFallSpeed:650, thrustFuelMultiplier:3.0,
      dangerNeeded:3, invincibleSec:3.0, invincibleSpeedMultiplier:1.28,
      text:'長押しでロケット上昇、離すと落下。噴射中は燃料消費×3。CLOSE×3で3秒だけ無敵になる' },
  },
]);

const ENVELOPE_CARS = Object.freeze([
  // Real-world boundary profiles. Avoid impossible hybrid cars that no player can actually select.
  { id:'GROUND_WORST', hitboxScale:1.18, jumpScale:0.82, secondJumpScale:1.22, gravityScale:1.12, maxJumps:2 },
  { id:'CEILING_WORST', hitboxScale:0.98, jumpScale:0.90, secondJumpScale:0.98, gravityScale:0.66, maxJumps:2 },
  { id:'SMALL_WORST', hitboxScale:0.60, jumpScale:0.78, secondJumpScale:1.42, gravityScale:1.34, maxJumps:2 },
]);

const J = sec => Number((sec / DERIVED.jump1AirTime).toFixed(6));
const O = (sec, type, extra={}) => ({ type, atJ:J(sec), ...extra });

// 55 authored pattern roots. atJ is speed-normalized: 1.0 = one base first-jump airtime.
// The generator converts it at spawn: deltaPx = atJ * jump1AirTime * currentScrollSpeed.
const PATTERNS = Object.freeze([
  {id:'P001_CONE',d:1,minM:0,tags:['GROUND'],events:[O(0,'CONE')]},
  {id:'P002_BARRIER',d:1,minM:300,tags:['GROUND'],events:[O(0,'BARRIER')]},
  {id:'P003_CONE_FUEL',d:1,minM:0,tags:['SAFE','FUEL'],events:[O(0,'CONE'),O(.50,'FUEL_S',{lane:'GROUND',required:true})]},
  {id:'P004_BARRIER_FUEL',d:1,minM:300,tags:['SAFE','FUEL'],events:[O(0,'BARRIER'),O(.55,'FUEL_S',{lane:'GROUND',required:true})]},
  {id:'P005_CONE_CONE',d:1,minM:450,tags:['SEQUENCE'],events:[O(0,'CONE'),O(.80,'CONE')]},
  {id:'P006_CONE_BARRIER',d:1,minM:600,tags:['SEQUENCE'],events:[O(0,'CONE'),O(.85,'BARRIER')]},
  {id:'P007_BARRIER_CONE',d:1,minM:600,tags:['SEQUENCE'],events:[O(0,'BARRIER'),O(.80,'CONE')]},
  {id:'P008_REST_FUEL',d:1,minM:0,tags:['REST','SAFE','FUEL'],events:[O(0,'FUEL_S',{lane:'GROUND',required:true})]},

  {id:'P009_CRATE',d:2,minM:1000,tags:['DOUBLE'],events:[O(0,'CRATE')]},
  {id:'P010_CONE_CRATE',d:2,minM:1200,tags:['DOUBLE','SEQUENCE'],events:[O(0,'CONE'),O(.90,'CRATE')]},
  {id:'P011_CRATE_CONE',d:2,minM:1200,tags:['DOUBLE','SEQUENCE'],events:[O(0,'CRATE'),O(.90,'CONE')]},
  {id:'P012_BARRIER_CRATE',d:2,minM:1200,tags:['DOUBLE','SEQUENCE'],events:[O(0,'BARRIER'),O(.95,'CRATE')]},
  {id:'P013_CRATE_BARRIER',d:2,minM:1200,tags:['DOUBLE','SEQUENCE'],events:[O(0,'CRATE'),O(.95,'BARRIER')]},
  {id:'P014_PIT',d:2,minM:1900,tags:['GAP'],events:[O(0,'PIT')]},
  {id:'P015_CONE_PIT',d:2,minM:2200,tags:['GAP','SEQUENCE'],events:[O(0,'CONE'),O(.90,'PIT')]},
  {id:'P016_PIT_CONE',d:2,minM:2200,tags:['GAP','SEQUENCE'],events:[O(0,'PIT'),O(.90,'CONE')]},
  {id:'P017_BARRIER_PIT',d:2,minM:2200,tags:['GAP','SEQUENCE'],events:[O(0,'BARRIER'),O(1.00,'PIT')]},
  {id:'P018_PIT_BARRIER',d:2,minM:2200,tags:['GAP','SEQUENCE'],events:[O(0,'PIT'),O(.95,'BARRIER')]},
  {id:'P019_CONE_FUEL2',d:2,minM:1500,tags:['CHOICE','FUEL'],events:[O(0,'CONE'),O(.35,'FUEL_L',{lane:'AIR2',required:true})]},
  {id:'P020_PIT_FUEL2',d:2,minM:2200,tags:['CHOICE','FUEL','GAP'],events:[O(0,'PIT'),O(.35,'FUEL_L',{lane:'AIR2',required:true})]},

  {id:'P021_ROLL',d:3,minM:3800,tags:['MOVING'],events:[O(0,'ROLLTIRE')]},
  {id:'P022_CONE_ROLL',d:3,minM:3800,tags:['MOVING','SEQUENCE'],events:[O(0,'CONE'),O(.85,'ROLLTIRE')]},
  {id:'P023_ROLL_CONE',d:3,minM:3800,tags:['MOVING','SEQUENCE'],events:[O(0,'ROLLTIRE'),O(.85,'CONE')]},
  {id:'P024_BARRIER_ROLL',d:3,minM:3800,tags:['MOVING','SEQUENCE'],events:[O(0,'BARRIER'),O(.90,'ROLLTIRE')]},
  {id:'P025_ROLL_BARRIER',d:3,minM:3800,tags:['MOVING','SEQUENCE'],events:[O(0,'ROLLTIRE'),O(.90,'BARRIER')]},
  {id:'P026_PIT_ROLL',d:3,minM:3800,tags:['MOVING','GAP'],events:[O(0,'PIT'),O(.90,'ROLLTIRE')]},
  {id:'P027_ROLL_PIT',d:3,minM:3800,tags:['MOVING','GAP'],events:[O(0,'ROLLTIRE'),O(.95,'PIT')]},
  {id:'P028_CRATE_ROLL',d:3,minM:3800,tags:['MOVING','DOUBLE'],events:[O(0,'CRATE'),O(1.40,'ROLLTIRE')]},
  {id:'P029_ROLL_CRATE',d:3,minM:3800,tags:['MOVING','DOUBLE'],events:[O(0,'ROLLTIRE'),O(1.05,'CRATE')]},
  {id:'P030_TRIPLE_GROUND',d:3,minM:3600,tags:['SEQUENCE'],events:[O(0,'CONE'),O(.70,'BARRIER'),O(1.48,'CONE')]},

  {id:'P031_LOWBEAM',d:4,minM:5600,tags:['NOJUMP'],events:[O(0,'LOWBEAM')]},
  {id:'P032_LOWBEAM_CONE',d:4,minM:5600,tags:['NOJUMP','SEQUENCE'],events:[O(0,'LOWBEAM'),O(.95,'CONE')]},
  {id:'P033_CONE_LOWBEAM',d:4,minM:5600,tags:['NOJUMP','SEQUENCE'],events:[O(0,'CONE'),O(1.10,'LOWBEAM')]},
  {id:'P034_LOWBEAM_BARRIER',d:4,minM:5600,tags:['NOJUMP','SEQUENCE'],events:[O(0,'LOWBEAM'),O(1.00,'BARRIER')]},
  {id:'P035_BARRIER_LOWBEAM',d:4,minM:5600,tags:['NOJUMP','SEQUENCE'],events:[O(0,'BARRIER'),O(1.15,'LOWBEAM')]},
  {id:'P036_LOWBEAM_PIT',d:4,minM:5600,tags:['NOJUMP','GAP'],events:[O(0,'LOWBEAM'),O(1.00,'PIT')]},
  {id:'P037_PIT_LOWBEAM',d:4,minM:5600,tags:['NOJUMP','GAP'],events:[O(0,'PIT'),O(1.10,'LOWBEAM')]},
  {id:'P038_RISK_FUEL_CAGE',d:4,minM:5600,tags:['COMMIT','FUEL','NOJUMP'],events:[O(0,'LOWBEAM'),O(.75,'FUEL_L',{lane:'AIR1',required:true}),O(1.50,'LOWBEAM')]},
  {id:'P039_LOWBEAM_SAFE_FUEL',d:4,minM:5600,tags:['SAFE','FUEL','NOJUMP'],events:[O(0,'LOWBEAM'),O(.70,'FUEL_S',{lane:'GROUND',required:true})]},
  {id:'P040_LOWBEAM_ROLL',d:4,minM:5600,tags:['NOJUMP','MOVING'],events:[O(0,'LOWBEAM'),O(1.60,'ROLLTIRE')]},

  {id:'P041_ARCH',d:5,minM:8200,tags:['ONEJUMP'],events:[O(0,'ARCH')]},
  {id:'P042_ARCH_CONE',d:5,minM:8200,tags:['ONEJUMP','SEQUENCE'],events:[O(0,'ARCH'),O(.95,'CONE')]},
  {id:'P043_CONE_ARCH',d:5,minM:8200,tags:['ONEJUMP','SEQUENCE'],events:[O(0,'CONE'),O(1.05,'ARCH')]},
  {id:'P044_ARCH_CRATE',d:5,minM:8200,tags:['ONEJUMP','DOUBLE'],events:[O(0,'ARCH'),O(1.10,'CRATE')]},
  {id:'P045_CRATE_ARCH',d:5,minM:8200,tags:['DOUBLE','ONEJUMP'],events:[O(0,'CRATE'),O(1.30,'ARCH')]},
  {id:'P046_ARCH_PIT_LOW',d:5,minM:8200,tags:['ONEJUMP','GAP','NOJUMP'],events:[O(0,'ARCH'),O(1.00,'PIT'),O(2.15,'LOWBEAM')]},
  {id:'P047_LOW_ARCH_FUEL2',d:5,minM:8200,tags:['COMMIT','ONEJUMP','FUEL'],events:[O(0,'LOWBEAM'),O(1.00,'ARCH'),O(1.55,'FUEL_L',{lane:'AIR2',required:true})]},

  {id:'P048_DRONE',d:2,minM:650,tags:['NOJUMP','AIR_HAZARD'],events:[O(0,'DRONE')]},
  {id:'P049_DRONE_SAFE_FUEL',d:2,minM:700,tags:['NOJUMP','SAFE','FUEL'],events:[O(0,'DRONE'),O(.82,'FUEL_S',{lane:'GROUND',required:true})]},
  {id:'P050_CONE_DRONE',d:2,minM:1000,tags:['NOJUMP','SEQUENCE'],events:[O(0,'CONE'),O(1.32,'DRONE')]},
  {id:'P051_DRONE_CONE',d:2,minM:1000,tags:['NOJUMP','SEQUENCE'],events:[O(0,'DRONE'),O(.95,'CONE')]},
  {id:'P052_BARRIER_DRONE',d:2,minM:1200,tags:['NOJUMP','SEQUENCE'],events:[O(0,'BARRIER'),O(1.36,'DRONE')]},
  {id:'P053_DRONE_BARRIER',d:2,minM:1200,tags:['NOJUMP','SEQUENCE'],events:[O(0,'DRONE'),O(1.00,'BARRIER')]},
  {id:'P054_DRONE_AIR_FUEL',d:3,minM:3000,tags:['CHOICE','NOJUMP','FUEL'],events:[O(0,'DRONE'),O(1.25,'FUEL_L',{lane:'AIR1',required:true})]},
  {id:'P055_DRONE_CRATE',d:3,minM:3400,tags:['NOJUMP','DOUBLE','SEQUENCE'],events:[O(0,'DRONE'),O(1.15,'CRATE')]},
]);

const PATTERN_RULES = Object.freeze({
  rankedMinInputMarginMs: 50,
  riskTargetHalfWindowMs: [70,120],
  hardPatternsAllowedInRanked: false,
  riskFamilies: ['DRONE','LOWBEAM','ARCH','PIT','AIR2'],
  classifications: {
    SAFE: 'mandatory routeから追加入力0',
    CHOICE: '取得に追加入力1、または任意の別ルート',
    COMMIT: '追加入力1以上かつ次の障害へ復帰制約あり',
    HARD: '許容幅50ms未満。ランキング生成禁止',
  },
});

function carPhysics(car) {
  const scale = car.hitboxScale ?? 1;
  return {
    id: car.id,
    width: PHYSICS.baseCarHitbox.width * scale,
    height: PHYSICS.baseCarHitbox.height * scale,
    jump1: PHYSICS.jump1Velocity * (car.jumpScale ?? 1),
    jump2: PHYSICS.jump2Velocity * (car.secondJumpScale ?? car.jumpScale ?? 1),
    gravityScale: car.gravityScale ?? 1,
    maxJumps: car.maxJumps ?? 2,
    visualScale: car.visualScale ?? 1,
  };
}

function speedPx(multiplier) {
  return PHYSICS.baseScrollPxPerSec * multiplier;
}

function fuelZoneAt(meters) {
  return FUEL_ZONES.find(z => meters >= z.fromM && meters < z.toM) ?? FUEL_ZONES.at(-1);
}


const BUILD = '2026-08-11-playable-v1.0.21-wheel-sync-fix';
const CLIENT_VERSION = '1.0.21';
const STORE_KEY = 'asoboonBoonrun.v1';
const JUMP_STORE_KEY = 'asoboonBoonjump.v2';
const COURSE_SEED = 0xB00B2026;
const ROAD_Y = 575;
const FIXED_DT = PHYSICS.dt;
const MAX_FRAME_DT = 0.05;
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const fmt = n => `${Math.floor(Number(n)||0).toLocaleString()}m`;
const lerp = (a,b,t)=>a+(b-a)*t;

const CAR_BY_ID = Object.fromEntries(CARS.map(c=>[c.id,c]));
const RANKED_CARS = CARS.filter(c=>c.ranked!==false);
const RUN_RANKING = window.BOON_RUN_RANKING || null;
const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map(p=>[p.id,p]));
const CAR_COLORS = {
  boon:['#ffb51c','#ffec7a'], wagon:['#20dfe5','#baffff'], buggy:['#47dd68','#e0ff67'], bike:['#ff5a2d','#ffc65a'],
  sport:['#f12958','#ff7a92'], ssr:['#6b55ff','#5feaff'], princess:['#ff8ad8','#ffffff'], secret:['#ff672c','#fff05a']
};
const CAR_VISUAL_WIDTH = {boon:155,wagon:145,buggy:142,bike:100,sport:140,ssr:142,princess:150,secret:145};
const CAUSE_LABEL = {CONE:'コーン',BARRIER:'バリケード',CRATE:'木箱',PIT:'落下',ROLLTIRE:'タイヤ',DRONE:'低空ドローン',LOWBEAM:'ロービーム',ARCH:'アーチ',gas:'GAS欠',quit:'終了'};
const ABILITY_SHORT = {
  boon:'🛻 HEAVY', wagon:'☁ FLOAT', buggy:'⬆ COMMIT', bike:'🏍 QUICK', sport:'⚡ FAST', ssr:'🌌 STANDARD', princess:'★ GROW', secret:'🚀 ROCKET'
};
const HANDLING_LABEL = {
  boon:'重い｜低い1段 → 強烈2段', wagon:'浮く｜低い1段・長い滞空・強い2段', buggy:'一発｜超大ジャンプ・修正不可', bike:'鋭い｜低い1段 → 強烈2段',
  sport:'高速｜短い判断時間・速い落下', ssr:'素直｜低め1段＋基準2段＋CLOSE勝負', princess:'成長｜低め1段→★で性能と入力段数が変化', secret:'別操作｜HOLD上昇 / RELEASE落下'
};
const HOME_GUIDE = {
  boon:[['TAP','重く低い1段'],['TAP×2','強烈サス2段'],['🛡','ARMORで小障害突破']],
  wagon:[['TAP','低めにふわっと長時間滞空'],['TAP×2','強い2段で高度を追加'],['↓','降りたい時に降りにくい']],
  buggy:[['TAP','一発超大ジャンプ'],['×2','空中修正なし'],['⛽','アーチ破壊は−12']],
  bike:[['TAP','低く鋭く・すぐ落下'],['TAP×2','強烈2段・燃料−4'],['🏍','最小ボディで精密回避']],
  sport:[['FAST','常時14%高速'],['TAP×2','クイック2段'],['⚡','NITROで爆速無敵']],
  ssr:[['TAP','低めで素直な1段ジャンプ'],['CLOSE×2','PHANTOM'],['⛽','SAVEは−35']],
  princess:[['RISK','危険燃料で★成長'],['★3','3段ジャンプへ進化'],['700m','★が1つ減る']],
  secret:[['HOLD','ロケット上昇'],['RELEASE','即落下へ'],['CLOSE×3','3秒無敵']]
};

// ONE SHOT SPECIAL: every car gets one deliberately rule-breaking moment per run.
// The special is never random and is legal for ranked play. The player chooses when to spend it.
const SPECIALS = Object.freeze({
  boon:{name:'TITAN BREAK',short:'TITAN',duration:5.0,color:'#ffe04a',sub:'巨大重戦車化｜地上障害を粉砕＋ARMOR全回復'},
  wagon:{name:'ZERO GRAVITY',short:'ZERO-G',duration:4.0,color:'#55efff',sub:'重力ほぼゼロ｜タップで上昇微調整'},
  buggy:{name:'SKY RODEO',short:'RODEO',duration:5.0,color:'#a9ff52',sub:'普段は禁止の空中キックを3回だけ解禁'},
  bike:{name:'LIGHTNING MODE',short:'LIGHT',duration:6.0,color:'#57dfff',sub:'極小判定＋2段燃料0＋鋭いレスポンス'},
  sport:{name:'OVERDRIVE',short:'OVER',duration:4.0,color:'#ff4a8e',sub:'速度上限突破＋完全突破｜終了時FUEL−18'},
  ssr:{name:'DIMENSION SHIFT',short:'SHIFT',duration:5.0,color:'#a26cff',sub:'異次元化｜PIT以外を完全すり抜け'},
  princess:{name:'ROYAL ASCENSION',short:'ASCEND',duration:8.0,color:'#ff78dc',sub:'即★5＋STAR停止＋3段ジャンプ無制限'},
  secret:{name:'FINAL IGNITION',short:'IGNITE',duration:4.0,color:'#ffe73f',sub:'燃料0消費＋完全無敵＋最大推力'}
});

function makeDefaultState(){
  return {
    version:1, build:BUILD, selected:'wagon', best:0, plays:0, totalDistance:0, sound:true,
    carRecords:Object.fromEntries(CARS.map(c=>[c.id,{best:0,plays:0,total:0}])),
    deaths:{gas:0,crash:{}}, stats:{fuel:0,jumps:0,doubleJumps:0,boosts:0,close:0},
    updatedAt:new Date().toISOString()
  };
}
function loadState(){
  const base=makeDefaultState();
  try{
    const raw=JSON.parse(localStorage.getItem(STORE_KEY)||'null');
    if(raw&&typeof raw==='object'){
      Object.assign(base,raw);
      base.carRecords={...makeDefaultState().carRecords,...(raw.carRecords||{})};
      base.deaths={gas:Number(raw.deaths?.gas)||0,crash:{...(raw.deaths?.crash||{})}};
      base.stats={...makeDefaultState().stats,...(raw.stats||{})};
    }
  }catch{}
  if(!CAR_BY_ID[base.selected]) base.selected='wagon';
  return base;
}
function saveState(){
  state.updatedAt=new Date().toISOString();
  try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch{}
}
function getOwnedCars(){
  const owned=new Set(['wagon','boon']);
  try{
    const jump=JSON.parse(localStorage.getItem(JUMP_STORE_KEY)||'null');
    const garage=jump?.garage||jump?.carRecords||{};
    if(garage.suv?.owned&&!garage.bike) garage.bike=garage.suv;
    CARS.forEach(c=>{if(garage[c.id]?.owned)owned.add(c.id);});
  }catch{}
  return owned;
}
let state=loadState();
let ownedCars=getOwnedCars();

const els={
  screens:{menu:$('menuScreen'),garage:$('garageScreen'),records:$('recordsScreen'),ranking:$('rankingScreen'),game:$('gameScreen')},
  homeBest:$('homeBest'),homeCarImage:$('homeCarImage'),selectedCarLabel:$('selectedCarLabel'),playCountLabel:$('playCountLabel'),howtoIcon1:$('howtoIcon1'),howtoText1:$('howtoText1'),howtoIcon2:$('howtoIcon2'),howtoText2:$('howtoText2'),howtoIcon3:$('howtoIcon3'),howtoText3:$('howtoText3'),
  startButton:$('startButton'),garageButton:$('garageButton'),recordsButton:$('recordsButton'),rankingButton:$('rankingButton'),soundButton:$('soundButton'),
  carGrid:$('carGrid'),recordBest:$('recordBest'),recordTotal:$('recordTotal'),recordPlays:$('recordPlays'),recordCars:$('recordCars'),
  canvas:$('gameCanvas'),viewport:$('gameViewport'),pauseButton:$('pauseButton'),abilityBadge:$('abilityBadge'),distanceLabel:$('distanceLabel'),milestoneLabel:$('milestoneLabel'),
  fuelBar:$('fuelBar'),fuelLabel:$('fuelLabel'),fuelBox:document.querySelector('.fuel-box'),extraMeter:$('extraMeter'),startGuide:$('startGuide'),countdown:$('countdown'),toast:$('toast'),flash:$('flash'),
  pauseModal:$('pauseModal'),resumeButton:$('resumeButton'),restartButton:$('restartButton'),quitButton:$('quitButton'),
  resultModal:$('resultModal'),resultReason:$('resultReason'),resultDistance:$('resultDistance'),newBest:$('newBest'),resultCar:$('resultCar'),resultBest:$('resultBest'),resultCause:$('resultCause'),
  retryButton:$('retryButton'),resultSubmitButton:$('resultSubmitButton'),resultRankingButton:$('resultRankingButton'),resultRankingStatus:$('resultRankingStatus'),resultGarageButton:$('resultGarageButton'),resultMenuButton:$('resultMenuButton'),
  rankingMachineSelect:$('rankingMachineSelect'),rankingOverallButton:$('rankingOverallButton'),rankingStatus:$('rankingStatus'),rankingMe:$('rankingMe'),rankingList:$('rankingList'),rankingNameModal:$('rankingNameModal'),rankingNameInput:$('rankingNameInput'),rankingNameSave:$('rankingNameSave'),rankingNameCancel:$('rankingNameCancel'),
  specialButton:$('specialButton'),specialBanner:$('specialBanner'),specialBannerName:$('specialBannerName'),specialBannerSub:$('specialBannerSub'),
  highwayBoard:$('highwayBoard'),highwayBoardTag:$('highwayBoardTag'),highwayBoardMessage:$('highwayBoardMessage'),
  debugButton:$('debugButton'),debugPanel:$('debugPanel')
};
const ctx=els.canvas.getContext('2d',{alpha:false});
ctx.imageSmoothingEnabled=true;

function showScreen(name){
  Object.entries(els.screens).forEach(([k,node])=>node.classList.toggle('active',k===name));
  document.body.classList.toggle('in-game',name==='game');
}
const BOONJUMP_SYNC_CARS=new Set(['boon','wagon','buggy','bike','sport','ssr','princess','secret']);
const BOONJUMP_SYNC_VERSION='121-wheel';
const SYNC_WHEEL_LAYOUT={
  boon:{rear:{x:230,y:188,w:90,h:90},front:{x:600,y:188,w:90,h:90}},
  wagon:{rear:{x:224,y:185,w:92,h:92},front:{x:510,y:185,w:92,h:92}},
  buggy:{rear:{x:220,y:181,w:88,h:88},front:{x:550,y:181,w:88,h:88}},
  bike:{rear:{x:170,y:170,w:64,h:71},front:{x:542,y:168,w:62,h:70}},
  sport:{rear:{x:185,y:180,w:92,h:92},front:{x:535,y:180,w:92,h:92}},
  ssr:{rear:{x:90,y:172,w:78,h:86},front:{x:518,y:182,w:66,h:73}},
  princess:{rear:{x:256,y:186,w:96,h:96},front:{x:561,y:186,w:96,h:96}}
};
function carAssetLocal(id){return `./assets/cars/${id}-body.png`;}
function carPartAsset(id,part='body'){
  const suffix=part==='rear'?'rear-wheel':part==='front'?'front-wheel':part;
  return `../boonjump/assets/cars/${id}-${suffix}.png?run-sync=${BOONJUMP_SYNC_VERSION}`;
}
// Static previews always start with a complete local car so a failed live sync can never remove wheels.
function carAsset(id){return carAssetLocal(id);}
function loadDetachedImage(src){return new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src;});}
function drawSyncedWheel(cc,img,v){if(!img||!v)return;cc.drawImage(img,v.x-v.w/2,v.y-v.h/2,v.w,v.h);}
async function syncCompositePreview(img,id){
  if(!img||!BOONJUMP_SYNC_CARS.has(id))return;
  const body=await loadDetachedImage(carPartAsset(id,'body'));if(!body?.naturalWidth)return;
  try{
    const cv=document.createElement('canvas');cv.width=760;cv.height=280;const cc=cv.getContext('2d');cc.drawImage(body,0,0,760,280);
    if(id!=='secret'){
      const layout=SYNC_WHEEL_LAYOUT[id];if(!layout)return;
      const [rear,front]=await Promise.all([loadDetachedImage(carPartAsset(id,'rear')),loadDetachedImage(carPartAsset(id,'front'))]);
      if(!rear?.naturalWidth||!front?.naturalWidth)return;
      drawSyncedWheel(cc,rear,layout.rear);drawSyncedWheel(cc,front,layout.front);
    }
    img.src=cv.toDataURL('image/png');
  }catch(_){/* local complete fallback remains visible */}
}
function bindCarImageFallback(img,id){if(!img)return;img.onerror=()=>{img.onerror=null;img.src=carAssetLocal(id);};syncCompositePreview(img,id);}
function currentCar(){return CAR_BY_ID[state.selected]||CAR_BY_ID.wagon;}
function renderMenu(){
  const car=currentCar();
  els.homeBest.textContent=fmt(state.best);
  bindCarImageFallback(els.homeCarImage,car.id);
  els.homeCarImage.src=carAsset(car.id);
  els.selectedCarLabel.textContent=car.name;
  els.playCountLabel.textContent=`PLAY ${state.plays.toLocaleString()}`;
  els.soundButton.textContent=state.sound?'🔊':'🔇';
  const guide=HOME_GUIDE[car.id]||HOME_GUIDE.wagon;
  [1,2,3].forEach((n,i)=>{els[`howtoIcon${n}`].textContent=guide[i][0];els[`howtoText${n}`].textContent=guide[i][1];});
}
function renderGarage(){
  ownedCars=getOwnedCars();
  els.carGrid.innerHTML='';
  CARS.forEach(car=>{
    const owned=ownedCars.has(car.id);
    const rec=state.carRecords[car.id]||{best:0,plays:0};
    const b=document.createElement('button');
    b.className=`car-card${state.selected===car.id?' selected':''}${owned?'':' locked'}`;
    b.type='button'; b.dataset.car=car.id;b.setAttribute('aria-pressed',String(state.selected===car.id));
    b.setAttribute('aria-label',owned?`${car.name}。${car.ability.text}`:`未解放。${car.id==='secret'?'ブーンジャンプ通常7台コンプリートで解放':'ブーンジャンプで獲得すると解放'}`);
    b.innerHTML=`<span class="rarity">${car.rarity}</span>${state.selected===car.id?'<span class="selected-mark">✓ 選択中</span>':''}<img src="${carAsset(car.id)}" alt=""><h3>${owned?car.name:'？？？？？？'}</h3>${owned?`<div class="handling">${HANDLING_LABEL[car.id]}</div><div class="special-chip">⚡ 最終奥義・1回限り｜${SPECIALS[car.id].name}</div>`:''}<p>${owned?car.ability.text:(car.id==='secret'?'🔒 ブーンジャンプ通常7台コンプリートで解放':'🔒 ブーンジャンプで獲得すると解放')}</p><div class="best">RUN BEST ${fmt(rec.best)}</div>`;
    els.carGrid.appendChild(b);
    bindCarImageFallback(b.querySelector('img'),car.id);
  });
}
function renderRecords(){
  els.recordBest.textContent=fmt(state.best); els.recordTotal.textContent=fmt(state.totalDistance); els.recordPlays.textContent=state.plays.toLocaleString();
  els.recordCars.innerHTML='';
  CARS.forEach(car=>{
    const rec=state.carRecords[car.id]||{best:0,plays:0,total:0};
    const row=document.createElement('div');row.className='record-row';
    row.innerHTML=`<img src="${carAsset(car.id)}" alt=""><div><h3>${car.name}</h3><p>${ABILITY_SHORT[car.id]}｜PLAY ${rec.plays||0}</p></div><strong>${fmt(rec.best)}</strong>`;
    els.recordCars.appendChild(row);
    bindCarImageFallback(row.querySelector('img'),car.id);
  });
}

class SoundEngine{
  constructor(){this.ctx=null;this.engine=null;this.engineGain=null;}
  ensure(){
    if(!state.sound)return false;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return false;
      if(!this.ctx)this.ctx=new AC();
      if(this.ctx.state==='suspended'){const p=this.ctx.resume();if(p&&typeof p.catch==='function')p.catch(()=>{});}
      return true;
    }catch(err){console.warn('[BOONRUN] audio disabled',err);return false;}
  }
  tone(freq=440,dur=.08,type='sine',gain=.04,slide=0){
    if(!state.sound||!this.ensure()||!this.ctx)return;
    try{const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),t+dur);g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+dur+.02);}catch(err){console.warn('[BOONRUN] tone skipped',err);}
  }
  jump(second=false){this.tone(second?520:390,.09,'square',.025,second?260:180);}
  fuel(big=false){this.tone(big?880:720,.10,'sine',.04,260);setTimeout(()=>this.tone(big?1180:920,.08,'sine',.025),55);}
  crash(){this.tone(120,.32,'sawtooth',.09,-70);this.tone(62,.38,'square',.05,-20);}
  gas(){this.tone(180,.15,'sawtooth',.04,-70);setTimeout(()=>this.tone(110,.25,'sawtooth',.03,-50),130);}
  close(){this.tone(980,.055,'square',.018,120);}
  special(){this.tone(540,.11,'sine',.04,400);setTimeout(()=>this.tone(940,.15,'sine',.04,300),80);}
  milestone(){this.tone(660,.10,'triangle',.03,220);setTimeout(()=>this.tone(990,.12,'triangle',.03,200),90);}
}
const sound=new SoundEngine();

class RNG{
  constructor(seed=COURSE_SEED){this.s=seed>>>0;}
  next(){let x=this.s;x^=x<<13;x^=x>>>17;x^=x<<5;this.s=x>>>0;return this.s/4294967296;}
  pick(a){return a[Math.floor(this.next()*a.length)%a.length];}
}

const images=new Map();
function loadImage(src,fallback=''){
  if(images.has(src))return images.get(src);
  const img=new Image();
  if(fallback)img.onerror=()=>{if(img.__boonrunFallbackUsed)return;img.__boonrunFallbackUsed=true;img.src=fallback;};
  img.src=src;images.set(src,img);return img;
}
CARS.forEach(c=>{
  loadImage(carAssetLocal(c.id));
  if(BOONJUMP_SYNC_CARS.has(c.id)){
    loadImage(carPartAsset(c.id,'body'));
    if(c.id!=='secret'){loadImage(carPartAsset(c.id,'rear'));loadImage(carPartAsset(c.id,'front'));}
  }
});

let run=null, raf=0, lastTime=0, accumulator=0;
function makeRun(car){
  const cp=carPhysics(car);
  return {
    token:`${Date.now()}-${Math.random()}`, car, cp, phase:'countdown', distance:0, displayDistance:0, speedMult:1, baseSpeed:PHYSICS.baseScrollPxPerSec, scrollSpeed:PHYSICS.baseScrollPxPerSec,
    fuel:Number.isFinite(car.fuelMax)?car.fuelMax:100, fuelMax:Number.isFinite(car.fuelMax)?car.fuelMax:100,
    y:0, vy:0, jumpsUsed:0, onGround:true, pendingJumpMs:0,
    objects:[], particles:[], rng:new RNG(COURSE_SEED), spawnCursorX:PHYSICS.logicalWidth+300, patternIndex:0, lastPattern:null,
    safeDebt:0, optionalDebt:0, lastFuelZone:0, nextSpecialAt:4200, specialIndex:0, nextFullAt:11800,
    invulnerableUntil:0, shieldUntilM:0, shield:false, magnetUntilM:0, itemBoostUntilSec:0, nitroUntilSec:0, nitro:0,
    fuelPickups:0, luckyCount:0, stars:0, lastEfficientFuelM:0, phantomClose:0, phantomReady:false, armor:car.ability?.armorMax||0, droneTutorialShown:false, crateTutorialShown:false, obstacleTipsShown:{},
    elapsed:0, gameTime:0, endReason:null, endCause:null, startedAt:performance.now(),
    nextMilestone:1000, tutorial:true, lastPatternEndType:null, lastPatternEndX:0, patternHistory:[],
    stats:{fuel:0,jumps:0,doubleJumps:0,boosts:0,close:0,abilityUse:0,riskFuel:0,boostTime:0}, rankingSession:null,rankingEligible:false,rankingSessionError:'',rocketThrust:false,rocketDanger:0,rocketInvincibleUntil:0, rewardFxUntil:0,rewardFxKind:'',rewardFxStrength:0,
    specialUsed:false,specialStartedAt:0,specialUntil:0,specialCharges:0,specialFuelPending:0,specialFuelSettled:false,
    debug:{invincible:false}
  };
}
function speedMultiplierAt(m){
  // v1.0.20: remove the observed 3km difficulty cliff. Speed still reaches the
  // same 1.65 endless cap, but the 2–6km learning band gets more preview time.
  if(m<800)return lerp(1,1.08,m/800);
  if(m<3000)return lerp(1.08,1.22,(m-800)/2200);
  if(m<6000)return lerp(1.22,1.40,(m-3000)/3000);
  if(m<10000)return lerp(1.40,1.56,(m-6000)/4000);
  if(m<20000)return lerp(1.56,1.65,(m-10000)/10000);
  return 1.65;
}
function difficultyRange(m){
  // 0–3.2km: learn the core vocabulary. 3.2–5km: introduce d3 without d4.
  // 5km+: real midgame. 20km+ remains the same d4–5 endless band.
  if(m<600)return [1,1];
  if(m<3200)return [1,2];
  if(m<5000)return [1,3];
  if(m<7000)return [2,4];
  if(m<10000)return [2,5];
  if(m<20000)return [3,5];
  return [4,5];
}
function patternFuelValue(p){let sum=0;p.events.forEach(e=>{if(e.type==='FUEL_S')sum+=20;if(e.type==='FUEL_L')sum+=40;});return sum;}
function eligiblePatterns(m){
  const [lo,hi]=difficultyRange(m);
  let pool=PATTERNS.filter(p=>p.minM<=m&&p.d>=lo&&p.d<=hi);
  // First 300m is a true onboarding lane: one cone or free fuel only.
  if(m<300){const ids=new Set(['P001_CONE','P003_CONE_FUEL','P008_REST_FUEL']);pool=pool.filter(p=>ids.has(p.id));}
  return pool;
}
function patternGapSecAt(m,d){
  // Preserve validated within-pattern timings. The live-player data showed that the
  // old 3km transition (.48 -> .38s plus new moving hazards) was too abrupt.
  if(m<300)return 1.10;
  if(m<800)return .95;
  if(m<1500)return .82;
  if(m<2500)return .70;
  if(m<3500)return .62;
  if(m<5000)return .56;
  if(m<7000)return d>=4?.62:.50;
  if(m<10000)return d>=4?.58:.46;
  return d>=4?.55:.42;
}
function crateTutorialFor(carId){
  return ({
    boon:'木箱｜2段ジャンプ',
    wagon:'木箱｜2段ジャンプ',
    buggy:'木箱｜大ジャンプ1回',
    bike:'木箱｜2段ジャンプ・FUEL−4',
    sport:'木箱｜2段ジャンプ',
    ssr:'木箱｜2段ジャンプ',
    princess:'木箱｜2段ジャンプ',
    secret:'木箱｜長押しで上昇'
  })[carId]||'木箱｜ジャンプ';
}
function obstacleTipFor(type,carId){
  if(type==='CONE')return carId==='boon'?'コーン｜ARMORなら突破OK':'コーン｜ジャンプ';
  if(type==='BARRIER')return carId==='boon'?'バリケード｜ARMORなら突破OK':'バリケード｜ジャンプ';
  if(type==='DRONE')return 'ドローン｜ジャンプ禁止';
  if(type==='CRATE')return crateTutorialFor(carId);
  if(type==='PIT')return 'ピット｜ジャンプ';
  if(type==='ROLLTIRE')return 'タイヤ｜ジャンプ';
  if(type==='LOWBEAM')return 'ロービーム｜ジャンプ禁止';
  if(type==='ARCH')return carId==='buggy'?'アーチ｜屋根破壊 FUEL−12':'アーチ｜1段ジャンプ';
  return '';
}
function queuePatternTip(p){
  if(!run||!p)return;
  const type=p.events.map(e=>e.type).find(t=>OBSTACLES[t]&&!run.obstacleTipsShown[t]);
  if(!type)return;
  run.obstacleTipsShown[type]=true;
  const text=obstacleTipFor(type,run.car.id);
  if(text)setTimeout(()=>highwayInfo(text,(type==='DRONE'||type==='LOWBEAM'||type==='ARCH')?'WARN':'INFO',3800),100);
}
function choosePattern(){
  const m=run.distance, pool=eligiblePatterns(m);
  const safeNeed=run.safeDebt>=18;
  const optionalNeed=run.optionalDebt>=18 && m>=500;
  let candidates=pool;
  if(safeNeed){const x=pool.filter(p=>p.tags.includes('SAFE')&&p.tags.includes('FUEL'));if(x.length)candidates=x;}
  else if(optionalNeed){const x=pool.filter(p=>(p.tags.includes('CHOICE')||p.tags.includes('COMMIT'))&&p.tags.includes('FUEL'));if(x.length)candidates=x;}
  else{
    const nonFuel=pool.filter(p=>!p.tags.includes('FUEL')||p.tags.includes('REST'));
    if(nonFuel.length)candidates=nonFuel;
  }
  // avoid identical recent patterns and overloading high difficulty back-to-back
  const recent=new Set(run.patternHistory.slice(-3));
  let filtered=candidates.filter(p=>!recent.has(p.id)); if(!filtered.length)filtered=candidates;
  // Learning-band recovery: avoid stacking d3 immediately after d3 before 5km.
  // This does not change any authored pattern; it only gives the player a recovery question.
  if(m<5000&&run.lastPattern?.d>=3){const easier=filtered.filter(p=>p.d<=2||p.tags.includes('REST'));if(easier.length&&run.rng.next()<.72)filtered=easier;}
  if(run.lastPattern?.d>=4){const easier=filtered.filter(p=>p.d<=3||p.tags.includes('REST'));if(easier.length&&run.rng.next()<.62)filtered=easier;}
  const p=run.rng.pick(filtered.length?filtered:pool);
  queuePatternTip(p);
  run.patternHistory.push(p.id); if(run.patternHistory.length>8)run.patternHistory.shift();
  const val=patternFuelValue(p);
  if(p.tags.includes('SAFE'))run.safeDebt=Math.max(0,run.safeDebt-val);
  if(p.tags.includes('CHOICE')||p.tags.includes('COMMIT'))run.optionalDebt=Math.max(0,run.optionalDebt-val);
  return p;
}
function eventWidth(type,speed){
  const o=OBSTACLES[type];
  if(type==='PIT')return speed*(o.temporalWidthMs/1000);
  if(type==='ARCH')return o.roofWidth;
  return o?.width||48;
}
function spawnPattern(){
  const p=choosePattern(); if(!p)return;
  const speed=run.scrollSpeed;
  let root=Math.max(run.spawnCursorX,PHYSICS.logicalWidth+300);
  // conservative gap using measured type pair matrix
  const firstType=p.events.find(e=>OBSTACLES[e.type])?.type;
  if(run.lastPatternEndType&&firstType){const ms=MIN_GAP_MS[run.lastPatternEndType]?.[firstType]||250;root=Math.max(root,run.lastPatternEndX+speed*ms/1000);}
  let lastX=root,lastType=run.lastPatternEndType;
  p.events.forEach((ev,idx)=>{
    const x=root+ev.atJ*DERIVED.jump1AirTime*speed;
    const obj=makeObject(ev,x,speed,p.id,idx);run.objects.push(obj);
    lastX=Math.max(lastX,x+eventWidth(ev.type,speed));
    if(OBSTACLES[ev.type])lastType=ev.type;
  });
  run.lastPattern=p;run.lastPatternEndType=lastType;run.lastPatternEndX=lastX;
  run.spawnCursorX=lastX+speed*patternGapSecAt(run.distance,p.d);
}
function makeObject(ev,x,speed,patternId,index){
  const obj={id:`${patternId}-${index}-${run.patternIndex++}`,type:ev.type,x,patternId,dead:false,collected:false,destroyed:false,near:false,nearTriggered:false,lane:ev.lane||'GROUND',required:!!ev.required};
  if(OBSTACLES[ev.type]){
    const d=OBSTACLES[ev.type]; Object.assign(obj,d);
    if(ev.type==='PIT')obj.width=speed*(d.temporalWidthMs/1000);
    if(ev.type==='ROLLTIRE')obj.ownSpeed=d.ownLeftPxPerSec;
  }else if(ITEMS[ev.type]) Object.assign(obj,ITEMS[ev.type]);
  return obj;
}
function updateFuelDebts(dm){
  const z=fuelZoneAt(run.distance);
  const base=PHYSICS.scoreFuelPerMeter*dm;
  run.safeDebt+=base*z.safeRatio;
  run.optionalDebt+=base*(z.allRatio-z.safeRatio);
}
function maybeSpawnSpecial(){
  if(run.distance>=run.nextFullAt){run.objects.push(makeObject({type:'FULL',lane:'AIR1'},PHYSICS.logicalWidth+520,run.scrollSpeed,'FULLBONUS',Math.floor(run.nextFullAt)));run.nextFullAt+=12000;}
  if(run.distance<run.nextSpecialAt)return;
  const types=['BOOST','MAGNET','SHIELD']; const type=types[run.specialIndex%types.length];run.specialIndex++;
  run.objects.push(makeObject({type,lane:'GROUND'},PHYSICS.logicalWidth+420,run.scrollSpeed,'SPECIAL',run.specialIndex));
  run.nextSpecialAt+=4000;
}
function ensureWorld(){while(run.spawnCursorX<PHYSICS.logicalWidth+1800)spawnPattern();}

function startGame(){
  try{
    window.__BOONRUN_BOOT={phase:'starting',at:Date.now()};
    sound.ensure();
    try{if(window.screen&&screen.orientation&&typeof screen.orientation.lock==='function'){const p=screen.orientation.lock('landscape');if(p&&typeof p.catch==='function')p.catch(()=>{});}}catch{}
    const car=currentCar(); if(!ownedCars.has(car.id)){state.selected='wagon';saveState();}
    run=makeRun(currentCar()); const token=run.token; showScreen('game'); els.resultModal.hidden=true;els.pauseModal.hidden=true;els.startGuide.classList.remove('hidden');setStartGuide();
    document.body.dataset.car=run.car.id; resetHud();resetHighwayBoard();ensureWorld();render();
    if(RUN_RANKING){RUN_RANKING.startSession(run.car.id,BUILD,CLIENT_VERSION).then(s=>{if(run&&run.token===token){run.rankingSession=s;run.rankingEligible=true;if(els.resultModal&&!els.resultModal.hidden){els.resultSubmitButton.disabled=false;els.resultSubmitButton.textContent='🌍 この記録を世界ランキングへ';}}}).catch(err=>{if(run&&run.token===token){run.rankingEligible=false;run.rankingSessionError=String(err&&err.message||err);}});}
    window.__BOONRUN_BOOT={phase:'countdown',car:run.car.id,objects:run.objects.length,at:Date.now()};
    countdownStart();
  }catch(err){
    console.error('[BOONRUN] START FAILED',err);
    showFatalError('ゲームを開始できませんでした',err);
  }
}
function setStartGuide(){
  if(!run)return;
  const guides={
    boon:['HEAVY｜1段目は低い','2段目だけ強烈サス反発｜ARMORでCONE/BARRIER突破'],
    wagon:['FLOAT｜低く長く浮く','2段目でしっかり上へ｜DRONE/LOWBEAM前は早めに判断'],
    buggy:['COMMIT｜1タップ超大ジャンプ','2段なし・空中修正なし｜飛ぶ前に決める'],
    bike:['QUICK｜低い1段から鋭い2段','すぐ落ちる精密操作｜2段ごとに燃料−4'],
    sport:['FAST｜常時14%高速','判断時間が短い｜NITRO中は爆速無敵・燃料×2.5'],
    ssr:['STANDARD｜最も素直な操作','CLOSE×2でPHANTOM｜危険を攻めて保険を作る'],
    princess:['GROW｜危険燃料で操作性が成長','★3から3段ジャンプ｜STAR維持が鍵'],
    secret:['ROCKET｜タップジャンプではない','HOLD上昇 / RELEASE落下｜噴射中FUEL×3']
  };
  const g=guides[run.car.id]||['タップでジャンプ','空中タップで2段ジャンプ'];
  const sp=SPECIALS[run.car.id];
  els.startGuide.innerHTML=`<span>${g[0]}</span><small>${g[1]}</small><em>⚡ 最終奥義 ${sp.name}｜1プレイ1回限り　　赤・橙＝回避 ／ 緑・金＝突破OK</em>`;
}
function startAbilityToast(){
  const t={boon:'ピックアップ｜ARMOR ×2',wagon:'ワゴン｜長時間フロート',buggy:'バギー｜大ジャンプ1回',bike:'バイク｜2段でFUEL−4',sport:'スポーツ｜常時高速',ssr:'ファントム｜CLOSE×2',princess:'プリンセス｜危険燃料でSTAR',secret:'ロケット｜長押しで上昇'}[run?.car.id];
  if(t)setTimeout(()=>highwayInfo(t,'INFO',4200),180);
}
function countdownStart(){
  run.phase='countdown';const token=run.token;let n=3;els.countdown.textContent='3';
  const tick=()=>{if(!run||run.token!==token||run.phase!=='countdown')return;n--;if(n>0){els.countdown.textContent=n;sound.tone(440+n*80,.08,'square',.025);setTimeout(tick,550);}else{els.countdown.textContent='GO!';sound.tone(820,.13,'square',.035,260);setTimeout(()=>{if(!run||run.token!==token)return;els.countdown.textContent='';run.phase='running';lastTime=performance.now();accumulator=0;cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);startAbilityToast();setTimeout(()=>els.startGuide.classList.add('hidden'),2300);},480);}};
  sound.tone(600,.08,'square',.025);setTimeout(tick,550);
}
function restartGame(){els.pauseModal.hidden=true;els.resultModal.hidden=true;startGame();}
function pauseGame(auto=false){if(!run||run.phase!=='running')return;run.rocketThrust=false;run.phase='paused';cancelAnimationFrame(raf);els.pauseModal.hidden=false;if(auto)els.pauseModal.querySelector('h2').textContent='横向きに戻してね';else els.pauseModal.querySelector('h2').textContent='一時停止';}
function resumeGame(){if(!run||run.phase!=='paused')return;els.pauseModal.hidden=true;run.phase='running';lastTime=performance.now();accumulator=0;raf=requestAnimationFrame(loop);}
function quitGame(){if(!run)return;els.pauseModal.hidden=true;cancelAnimationFrame(raf);run=null;showScreen('menu');renderMenu();}

function specialActive(){return !!run&&run.specialUsed&&run.gameTime<run.specialUntil;}
function specialRemaining(){return specialActive()?Math.max(0,run.specialUntil-run.gameTime):0;}
function specialBreaks(obj){
  if(!specialActive()||!obj)return false;
  if(run.car.id==='boon')return ['CONE','BARRIER','CRATE','ROLLTIRE'].includes(obj.type);
  if(run.car.id==='sport'||run.car.id==='secret')return true;
  if(run.car.id==='ssr')return obj.type!=='PIT';
  return false;
}
function showSpecialBanner(){
  const sp=SPECIALS[run.car.id];
  els.specialBanner.dataset.car=run.car.id;els.specialBannerName.textContent=sp.name;els.specialBannerSub.textContent=sp.sub;
  els.specialBanner.style.setProperty('--special-color',sp.color);els.specialBanner.classList.remove('show');void els.specialBanner.offsetWidth;els.specialBanner.classList.add('show');
  setTimeout(()=>els.specialBanner.classList.remove('show'),1050);
}
function activateSpecial(){
  if(!run||run.phase!=='running'||run.specialUsed)return;
  sound.ensure();const sp=SPECIALS[run.car.id];run.specialUsed=true;run.specialStartedAt=run.gameTime;run.specialUntil=run.gameTime+sp.duration;run.stats.abilityUse++;
  if(run.car.id==='boon'){run.armor=run.car.ability.armorMax||2;}
  if(run.car.id==='wagon'){run.vy=Math.max(run.vy,90);run.onGround=false;}
  if(run.car.id==='buggy'){run.specialCharges=3;}
  if(run.car.id==='sport'){run.specialFuelPending=18;run.specialFuelSettled=false;}
  if(run.car.id==='princess'){run.stars=run.car.ability.maxStars;run.lastEfficientFuelM=run.distance;}
  if(run.car.id==='secret'){run.vy=Math.max(run.vy,420);run.onGround=false;}
  showSpecialBanner();highwayInfo(`最終奥義｜${sp.name} 発動`,'SPECIAL',2800);rewardFx(run.car.id==='ssr'?'phantom':run.car.id==='princess'?'magenta':run.car.id==='secret'?'rocket':'gold',1.05,1);flash('phantom');
  burst(PHYSICS.carCenterX,ROAD_Y-run.y-45,sp.color,32);sound.tone(run.car.id==='boon'?105:run.car.id==='princess'?880:520,.18,'sawtooth',.045,420);setTimeout(()=>sound.special(),70);updateSpecialHud();
}
function updateSpecialHud(){
  if(!run||!els.specialButton)return;const sp=SPECIALS[run.car.id];els.specialButton.style.setProperty('--special-color',sp.color);els.specialButton.dataset.car=run.car.id;
  els.specialButton.classList.toggle('active',specialActive());els.specialButton.classList.toggle('used',run.specialUsed&&!specialActive());els.specialButton.disabled=run.phase!=='running'||(run.specialUsed&&!specialActive());
  if(specialActive()){els.specialButton.innerHTML=`<small>最終奥義・発動中</small><b>⚡ ${sp.short}</b><em>${specialRemaining().toFixed(1)}秒</em>`;}
  else if(run.specialUsed){els.specialButton.innerHTML=`<small>1プレイ1回限り</small><b>使用済み</b><em>${sp.short}</em>`;}
  else{els.specialButton.innerHTML=`<small>1プレイ1回限り</small><b>⚡ 最終奥義</b><em>${sp.short}｜残り1回</em>`;}
}

function requestJump(){
  if(!run||run.phase!=='running')return;sound.ensure();
  if(run.car.id==='secret')return;
  if(run.car.id==='wagon'&&specialActive()){run.vy=Math.min(360,Math.max(80,run.vy)+185);run.onGround=false;run.stats.jumps++;spawnDust(3,'#6ff4ff');sound.tone(610,.05,'sine',.02,160);return;}
  if(run.car.id==='buggy'&&specialActive()&&!run.onGround&&run.specialCharges>0){run.specialCharges--;run.vy=Math.max(run.vy,PHYSICS.jump2Velocity*1.16);run.stats.jumps++;run.stats.doubleJumps++;burst(PHYSICS.carCenterX,ROAD_Y-run.y-20,'#a9ff52',9);toast(`SKY KICK ×${run.specialCharges}`);sound.tone(760,.06,'square',.025,180);return;}
  if(run.car.id==='princess'&&specialActive()&&!run.onGround&&run.jumpsUsed>=2){run.vy=Math.max(run.vy,PHYSICS.jump2Velocity*1.02);run.jumpsUsed=3;run.stats.jumps++;run.stats.doubleJumps++;burst(PHYSICS.carCenterX,ROAD_Y-run.y-18,'#ff78dc',8);sound.tone(820,.055,'sine',.022,160);return;}
  if(run.onGround){doJump('first');return;}
  if(run.jumpsUsed<run.cp.maxJumps){
    if(run.car.id==='bike'&&!specialActive()){
      const cost=run.car.ability.secondJumpFuelCost||4;
      if(run.fuel<cost){toast('2段FUEL不足!');sound.tone(170,.08,'square',.03,-60);return;}
      run.fuel=Math.max(0,run.fuel-cost);run.stats.abilityUse++;toast(`FUEL STEP −${cost}⛽`);
    }else if(run.car.id==='bike'&&specialActive()){toast('LIGHTNING STEP 0⛽');}
    doJump('second');return;
  }
  if(run.car.id==='princess'){
    const a=run.car.ability;
    if(run.stars>=a.thirdJumpMinStars && run.jumpsUsed<3){
      const earnedBonus=run.car.ability.jumpBonusByStars?.[run.stars]||1;
      run.stars=Math.max(0,run.stars-a.thirdJumpCost);run.stats.abilityUse++;
      doJump('third',earnedBonus);toast(`STAR STEP! ★${run.stars}`);sound.special();return;
    }
  }
  run.pendingJumpMs=run.car.inputBufferMs??PHYSICS.inputBufferMs;
}
function doJump(kind='first',starBonusOverride=null){
  const second=kind==='second',third=kind==='third';
  const starBonus=starBonusOverride??(run.car.id==='princess'?(run.car.ability.jumpBonusByStars?.[run.stars]||1):1);
  let vel=third?PHYSICS.jump2Velocity*(run.car.ability?.thirdJumpScale??.92)*starBonus:(second?run.cp.jump2:run.cp.jump1)*starBonus;
  if(run.car.id==='bike'&&specialActive())vel*=1.10;
  // v1.0.14: every vehicle keeps the same input grammar, but its jump arc is intentionally distinct.
  // Second-jump impulse preserves existing lift so early double taps remain intuitive.
  run.vy=second?Math.max(vel,run.vy+vel*(PHYSICS.secondJumpAssist||0)):vel;run.onGround=false;run.jumpsUsed=third?3:(second?2:1);run.pendingJumpMs=0;
  run.stats.jumps++; if(second||third)run.stats.doubleJumps++;
  const jumpTone={boon:[255,390],wagon:[360,470],buggy:[210,210],bike:[510,760],sport:[430,650],ssr:[390,520],princess:[470,680]}[run.car.id]||[390,520];
  sound.tone((second||third)?jumpTone[1]:jumpTone[0],run.car.id==='wagon'?.12:.075,run.car.id==='buggy'?'sawtooth':'square',.023,(second||third)?180:110);
  const jumpFx={boon:'#ffca45',wagon:'#bff7ff',buggy:'#b7ff55',bike:'#ff8a3d',sport:'#ff4f83',ssr:'#8d7cff',princess:'#ff9ee8'}[run.car.id]||'#d8f4ff';
  spawnDust(third?9:(second?6:4),jumpFx);
}

function updatePlayer(dt){
  if(run.car.id==='secret'){
    const a=run.car.ability,ignite=specialActive();
    if(run.rocketThrust&&run.fuel>0)run.vy=Math.min(ignite?760:(a.maxRiseSpeed||610),run.vy+(a.thrustAccel||3150)*(ignite?1.55:1)*dt);
    else run.vy=Math.max(-(a.maxFallSpeed||650),run.vy-PHYSICS.gravity*(run.cp.gravityScale||.88)*dt);
    run.y+=run.vy*dt;
    const maxY=430;
    if(run.y<=0){run.y=0;if(run.vy<0)run.vy=0;run.onGround=true;}else run.onGround=false;
    if(run.y>=maxY){run.y=maxY;if(run.vy>0)run.vy=0;}
    return;
  }
  if(run.car.id==='wagon'&&specialActive()){
    run.vy-=PHYSICS.gravity*.10*dt;run.y+=run.vy*dt;
    if(run.y<=0){run.y=0;run.vy=0;run.onGround=true;run.jumpsUsed=0;}else run.onGround=false;
    if(run.y>=430){run.y=430;if(run.vy>0)run.vy=0;}return;
  }
  run.pendingJumpMs=Math.max(0,run.pendingJumpMs-dt*1000);
  if(!run.onGround){run.vy-=PHYSICS.gravity*(run.cp.gravityScale||1)*dt;run.y+=run.vy*dt;if(run.y<=0){run.y=0;run.vy=0;run.onGround=true;run.jumpsUsed=0;spawnDust(6,'#cddae7');if(run.pendingJumpMs>0)doJump('first');}}
}
function playerRect(expand=0){
  const lightning=(run.car.id==='bike'&&specialActive())?.72:1;
  const w=run.cp.width*lightning+expand*2,h=run.cp.height*lightning+expand*2;
  return {x:PHYSICS.carCenterX-w/2,y:ROAD_Y-run.y-h-expand*0,w,h};
}
function rectsIntersect(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function obstacleRects(obj){
  if(obj.destroyed||obj.dead)return[];
  switch(obj.type){
    case'CONE':case'BARRIER':case'CRATE':case'ROLLTIRE':return[{x:obj.x,y:ROAD_Y-obj.height,w:obj.width,h:obj.height}];
    case'DRONE':return[{x:obj.x,y:ROAD_Y-obj.lowerEdge-obj.height,w:obj.width,h:obj.height}];
    case'LOWBEAM':return[{x:obj.x,y:ROAD_Y-obj.lowerEdge-obj.thickness,w:obj.width,h:obj.thickness}];
    case'ARCH':return[
      {x:obj.x,y:ROAD_Y-obj.pillarHeight,w:obj.pillarWidth,h:obj.pillarHeight},
      {x:obj.x+obj.roofWidth-obj.pillarWidth,y:ROAD_Y-obj.pillarHeight,w:obj.pillarWidth,h:obj.pillarHeight},
      {x:obj.x,y:ROAD_Y-obj.roofLowerEdge-38,w:obj.roofWidth,h:38}
    ];
    default:return[];
  }
}
function itemRect(obj){
  const centerH=ITEM_LANES[obj.lane]??ITEM_LANES.GROUND;const s=obj.hitbox||PHYSICS.itemHitbox.width;
  return {x:obj.x-s/2,y:ROAD_Y-centerH-s/2,w:s,h:s};
}
function isPitCollision(obj,pr){
  if(obj.type!=='PIT')return false;const overlap=pr.x<obj.x+obj.width&&pr.x+pr.w>obj.x;return overlap&&run.y<18;
}
function itemBoostActive(){return !!run&&run.itemBoostUntilSec>run.gameTime;}
function nitroActive(){return !!run&&run.car.id==='sport'&&run.nitroUntilSec>run.gameTime;}
function anyBoostActive(){return itemBoostActive()||nitroActive();}
function activeBoostMultiplier(){
  let m=1;
  if(itemBoostActive())m=Math.max(m,ITEMS.BOOST.scrollMultiplier||1.32);
  if(nitroActive())m=Math.max(m,run.car.ability.scrollMultiplier||1.65);
  return m;
}
function handleCollision(obj){
  if(specialBreaks(obj)){const sp=SPECIALS[run.car.id];obj.destroyed=true;burst(obj.x,ROAD_Y-40,sp.color,22);rewardFx(run.car.id==='ssr'?'phantom':'gold',.24,.72);sound.tone(run.car.id==='boon'?95:180,.045,'square',.018,120);return false;}
  if(run.debug.invincible||run.gameTime<run.invulnerableUntil||(run.car.id==='secret'&&run.gameTime<run.rocketInvincibleUntil)){obj.destroyed=true;burst(obj.x,ROAD_Y-40,'#ffe45c',14);return false;}
  if(anyBoostActive()){obj.destroyed=true;burst(obj.x,ROAD_Y-50,'#ff9b38',14);sound.tone(140,.05,'square',.025,180);return false;}
  // Pickup: ARMOR is contact protection, not a ground-only ram. Any CONE/BARRIER contact consumes one finite charge.
  if(run.car.id==='boon' && run.armor>0 && (run.car.ability.smashTypes||[]).includes(obj.type)){
    const cost=run.car.ability.smashFuelCost||5;
    run.armor--;run.fuel=Math.max(0,run.fuel-cost);run.stats.abilityUse++;obj.destroyed=true;
    burst(obj.x,ROAD_Y-35,'#ffc441',18);toast(`ARMOR ${run.armor}/2 ｜ −${cost}⛽`);rewardFx('gold',.50,.78);sound.tone(110,.08,'square',.03,120);
    if(run.fuel<=0){endGame('gas','gas');return true;}return false;
  }
  // Buggy: its one huge jump is intentionally too tall for ARCH. It can commit through the roof, but must pay fuel.
  if(run.car.id==='buggy' && obj.type==='ARCH' && run.y>40){
    const cost=run.car.ability.archBreakFuelCost||12;
    if(run.fuel>=cost){run.fuel=Math.max(0,run.fuel-cost);run.stats.abilityUse++;obj.destroyed=true;burst(obj.x,ROAD_Y-run.y,'#e8ff55',18);toast(`ROOF BREAK! −${cost}⛽`);sound.tone(150,.08,'square',.03,120);if(run.fuel<=0){endGame('gas','gas');return true;}return false;}
  }
  // Phantom: earned by CLOSE, paid with a brutal fuel cost, never saves PIT/GAS-out.
  if(run.car.id==='ssr' && run.phantomReady && obj.type!=='PIT'){
    const cost=run.car.ability.saveFuelCost||35;
    if(run.fuel>=cost){run.fuel=Math.max(0,run.fuel-cost);run.stats.abilityUse++;run.phantomReady=false;run.phantomClose=0;run.invulnerableUntil=run.gameTime+(run.car.ability.saveInvulnSec||1.2);obj.destroyed=true;
      burst(obj.x,ROAD_Y-50,'#8a7cff',24);toast(`PHANTOM SAVE! −${cost}⛽`);flash('phantom');sound.special();if(run.fuel<=0){endGame('gas','gas');return true;}return false;}
  }
  if(run.shield){run.shield=false;obj.destroyed=true;burst(obj.x,ROAD_Y-60,'#6feaff',22);toast('SHIELD SAVE!');flash('phantom');sound.special();return false;}
  endGame('crash',obj.type);return true;
}
function checkCollisions(){
  const pr=playerRect(0),nearPr=playerRect(26);
  for(const obj of run.objects){
    if(obj.dead||obj.collected||obj.destroyed)continue;
    if(ITEMS[obj.type]){
      const ir=itemRectWithMagnet(obj);
      if(run.magnetUntilM>run.distance&&['FUEL_S','FUEL_L','FULL'].includes(obj.type)){
        const pcx=PHYSICS.carCenterX,pcy=ROAD_Y-run.y-run.cp.height*.5,icx=ir.x+ir.w/2,icy=ir.y+ir.h/2,dx=pcx-icx,dy=pcy-icy,d=Math.hypot(dx,dy);
        if(d<ITEMS.MAGNET.radiusPx){obj.magnetPulled=true;obj.x+=dx*0.18; const targetH=ROAD_Y-pcy; const cur=ITEM_LANES[obj.lane]??52; if(Math.abs(dy)>2)obj.magnetYOffset=(obj.magnetYOffset||0)+dy*.18;}
      }
      const rr=itemRectWithMagnet(obj);
      if(rectsIntersect(pr,rr))pickup(obj);
      continue;
    }
    if(obj.type==='PIT'){
      if(isPitCollision(obj,pr)){if(handleCollision(obj))return;}
      else if(!obj.nearTriggered&&obj.x+obj.width<pr.x){obj.nearTriggered=true;}
      continue;
    }
    const rects=obstacleRects(obj);let hit=false,near=false;
    for(const r of rects){if(rectsIntersect(pr,r)){hit=true;break;}if(rectsIntersect(nearPr,r))near=true;}
    if(hit){if(handleCollision(obj))return;}
    else if(near)obj.near=true;
    if(!obj.nearTriggered&&obj.near&&objectRight(obj)<pr.x){obj.nearTriggered=true;triggerClose(obj);}
  }
}
function itemRectWithMagnet(obj){const r=itemRect(obj);if(obj.magnetYOffset){r.y+=obj.magnetYOffset;}return r;}
function objectRight(obj){if(obj.type==='ARCH')return obj.x+obj.roofWidth;if(obj.type==='PIT')return obj.x+obj.width;return obj.x+(obj.width||48);}
function triggerClose(){
  run.stats.close++;sound.close();toast(`CLOSE! ×${run.stats.close}`);rewardFx('close',.34,.72);
  if(run.car.id==='sport'){
    const a=run.car.ability;run.nitro=Math.min(a.nitroMax,run.nitro+(a.closeCharge||0));
    if(run.nitro>=a.nitroMax){run.nitro=0;activateBoost('NITRO',a.durationSec,a.scrollMultiplier);}
  }
  if(run.car.id==='ssr'&&!run.phantomReady){
    run.phantomClose++;
    const a=run.car.ability;
    if(run.phantomClose>=a.closeNeeded){run.phantomClose=a.closeNeeded;run.phantomReady=true;toast('PHANTOM READY!');flash('phantom');rewardFx('phantom',.85,1);sound.special();}
  }
  if(run.car.id==='secret'&&run.gameTime>=run.rocketInvincibleUntil){
    const a=run.car.ability;run.rocketDanger++;
    if(run.rocketDanger>=a.dangerNeeded){run.rocketDanger=0;run.rocketInvincibleUntil=run.gameTime+a.invincibleSec;run.stats.abilityUse++;toast('INVINCIBLE ROCKET!');flash('phantom');rewardFx('rocket',1.05,1);sound.special();}
  }
}
function pickup(obj){
  obj.collected=true;run.stats.fuel+=['FUEL_S','FUEL_L','FULL'].includes(obj.type)?1:0;
  if(['FUEL_S','FUEL_L','FULL'].includes(obj.type)){
    const before=run.fuel;let amount=obj.type==='FULL'?run.fuelMax:ITEMS[obj.type].amount;run.fuel=Math.min(run.fuelMax,run.fuel+amount);const overflow=Math.max(0,before+amount-run.fuelMax);
    run.fuelPickups++;sound.fuel(obj.type!=='FUEL_S');flash('fuel');burst(obj.x,itemRect(obj).y,obj.type==='FULL'?'#ffe95c':'#8dde78',obj.type==='FULL'?18:9);
    if(obj.type==='FULL')rewardFx('gold',.72,.92);
    if(run.car.id==='sport'){const a=run.car.ability;run.nitro=Math.min(a.nitroMax,run.nitro+a.fuelPickupCharge+overflow);if(run.nitro>=a.nitroMax){run.nitro=0;activateBoost('NITRO',a.durationSec,a.scrollMultiplier);}}
    const pickupTags=PATTERN_BY_ID[obj.patternId]?.tags||[];const isRiskRoute=(pickupTags.includes('CHOICE')||pickupTags.includes('COMMIT'));const earnedRisk=isRiskRoute&&!obj.magnetPulled;if(earnedRisk){run.stats.riskFuel++;rewardFx('risk',.52,.84);}
    if(run.car.id==='princess'&&earnedRisk){run.stars=Math.min(run.car.ability.maxStars,run.stars+1);run.lastEfficientFuelM=run.distance;toast(`RISK STAR ×${run.stars}`);if(run.stars===run.car.ability.maxStars)sound.special();}
    return;
  }
  if(obj.type==='BOOST'){activateBoost('BOOST',ITEMS.BOOST.durationSec,ITEMS.BOOST.scrollMultiplier);sound.special();}
  if(obj.type==='MAGNET'){run.magnetUntilM=run.distance+ITEMS.MAGNET.durationM;toast(`MAGNET ${ITEMS.MAGNET.durationM}m`);rewardFx('cyan',.72,.9);sound.special();}
  if(obj.type==='SHIELD'){if(run.car.id==='boon'){run.armor=Math.min(run.car.ability.armorMax||2,run.armor+1);toast(`ARMOR REPAIR ${run.armor}/2`);}else{run.shield=true;run.shieldUntilM=run.distance+ITEMS.SHIELD.expiresAfterM;toast('SHIELD ×1');}rewardFx(obj.type==='SHIELD'?'violet':'cyan',.72,.9);sound.special();}
}
function activateBoost(reason,duration=3,multiplier=1.35){
  if(reason==='NITRO'&&run.car.id==='sport')run.nitroUntilSec=Math.max(run.nitroUntilSec,run.gameTime+duration);
  else run.itemBoostUntilSec=Math.max(run.itemBoostUntilSec,run.gameTime+duration);
  run.stats.boosts++;toast(`${reason}!`);rewardFx(reason==='NITRO'?'magenta':'gold',.9,1);
}

function updateAbilities(dt){
  if(run.shield&&run.distance>=run.shieldUntilM){run.shield=false;toast('SHIELD END');}
  if(run.car.id==='sport'&&run.specialUsed&&!specialActive()&&!run.specialFuelSettled&&run.specialFuelPending>0){const cost=run.specialFuelPending;run.specialFuelSettled=true;run.specialFuelPending=0;run.fuel=Math.max(0,run.fuel-cost);toast(`OVERDRIVE END −${cost}⛽`);if(run.fuel<=0){endGame('gas','gas');return;}}
  if(run.car.id==='princess'&&!specialActive()&&run.stars>0&&run.distance-run.lastEfficientFuelM>=run.car.ability.decayEveryM){run.stars--;run.lastEfficientFuelM+=run.car.ability.decayEveryM;toast(`STAR ×${run.stars}`);}
}
function effectiveFuelRate(){
  let rate=run.car.fuelRate||1;
  if(run.car.id==='princess'){const arr=run.car.ability.fuelRateByStars;rate=arr[run.stars]??rate;}
  if(nitroActive())rate*=run.car.ability.boostFuelMultiplier||2.5;
  else if(itemBoostActive())rate*=ITEMS.BOOST.fuelBurnMultiplier||1.75;
  if(run.car.id==='secret'){if(specialActive()||run.gameTime<run.rocketInvincibleUntil)return 0;if(run.rocketThrust)rate*=run.car.ability.thrustFuelMultiplier||3;}
  return rate;
}
function updateWorld(dt){
  const boostActive=anyBoostActive();run.speedMult=speedMultiplierAt(run.distance);let specialMult=activeBoostMultiplier();if(run.car.id==='sport'&&specialActive())specialMult=Math.max(specialMult,1.72);if(run.car.id==='secret'&&specialActive())specialMult=Math.max(specialMult,1.65);else if(run.car.id==='secret'&&run.gameTime<run.rocketInvincibleUntil)specialMult*=run.car.ability.invincibleSpeedMultiplier||1.28;const carSpeed=run.car.speedMultiplier||1;run.scrollSpeed=run.baseSpeed*run.speedMult*carSpeed*specialMult;
  const dx=run.scrollSpeed*dt,dm=dx/PHYSICS.pxPerMeter;
  run.distance+=dm;run.displayDistance=run.distance;run.gameTime+=dt;
  updateFuelDebts(dm);
  run.fuel-=dm*PHYSICS.scoreFuelPerMeter*effectiveFuelRate();if(run.fuel<=0){run.fuel=0;endGame('gas','gas');return;}
  if(boostActive||(specialActive()&&(run.car.id==='sport'||run.car.id==='secret'))||(run.car.id==='secret'&&run.gameTime<run.rocketInvincibleUntil))run.stats.boostTime+=dt*1000;
  for(const obj of run.objects){if(obj.dead)continue;obj.x-=dx;if(obj.type==='ROLLTIRE')obj.x-=(obj.ownSpeed||0)*dt;if(objectRight(obj)<-180)obj.dead=true;}
  run.spawnCursorX-=dx;run.lastPatternEndX-=dx;
  maybeSpawnSpecial();ensureWorld();run.objects=run.objects.filter(o=>!o.dead&&!o.collected&&objectRight(o)>-200);
  if(run.distance>=run.nextMilestone){milestone(run.nextMilestone);run.nextMilestone+=1000;}
}
function milestone(m){els.milestoneLabel.textContent=`${m/1000} km`;sound.milestone();rewardFx('milestone',1.1,1);highwayInfo(`走行距離｜${m.toLocaleString()}m 突破`,'INFO',2600);setTimeout(()=>{if(els.milestoneLabel.textContent===`${m/1000} km`)els.milestoneLabel.textContent='';},1100);}
function step(dt){
  if(!run||run.phase!=='running')return;updatePlayer(dt);updateAbilities(dt);if(!run||run.phase!=='running')return;updateWorld(dt);if(!run||run.phase!=='running')return;checkCollisions();updateParticles(dt);updateHud();
}
function loop(t){
  if(!run||run.phase!=='running')return;const frame=Math.min(MAX_FRAME_DT,Math.max(0,(t-lastTime)/1000));lastTime=t;accumulator+=frame;let guard=0;while(accumulator>=FIXED_DT&&guard++<12){step(FIXED_DT);accumulator-=FIXED_DT;if(!run||run.phase!=='running')break;}render();if(run&&run.phase==='running')raf=requestAnimationFrame(loop);
}

function endGame(reason,cause){
  if(!run||run.phase==='ended')return;run.phase='ended';run.endReason=reason;run.endCause=cause;cancelAnimationFrame(raf);
  if(reason==='crash')sound.crash();else sound.gas();flash('hit');
  state.plays++;state.totalDistance+=Math.floor(run.distance);const rec=state.carRecords[run.car.id]||{best:0,plays:0,total:0};rec.plays=(rec.plays||0)+1;rec.total=(rec.total||0)+Math.floor(run.distance);
  const oldBest=rec.best||0;rec.best=Math.max(oldBest,Math.floor(run.distance));state.carRecords[run.car.id]=rec;const globalOld=state.best||0;state.best=Math.max(globalOld,Math.floor(run.distance));
  if(reason==='gas')state.deaths.gas=(state.deaths.gas||0)+1;else state.deaths.crash[cause]=(state.deaths.crash[cause]||0)+1;
  Object.keys(run.stats).forEach(k=>state.stats[k]=(state.stats[k]||0)+(run.stats[k]||0));saveState();run.finishedAtIso=new Date().toISOString();
  setTimeout(()=>showResult(oldBest),700);
}
function showResult(oldBest){
  if(!run)return;const d=Math.floor(run.distance),rec=state.carRecords[run.car.id];
  els.resultReason.textContent=run.endReason==='gas'?'GAS OUT!':'CRASH!';els.resultReason.style.background=run.endReason==='gas'?'#ff9b2e':'#ff425b';
  els.resultDistance.textContent=fmt(d);els.resultCar.textContent=run.car.name;els.resultBest.textContent=fmt(rec.best);els.resultCause.textContent=CAUSE_LABEL[run.endCause]||run.endCause||'-';
  els.newBest.hidden=!(d>oldBest);els.resultRankingStatus.hidden=true;els.resultRankingStatus.className='result-ranking-status';els.resultSubmitButton.disabled=!run.rankingEligible;els.resultSubmitButton.textContent=run.rankingEligible?'🌍 この記録を世界ランキングへ':'🌍 ランキング登録不可（通信なし）';els.resultModal.hidden=false;
}

function resetHud(){els.distanceLabel.textContent='0m';els.fuelBar.style.width='100%';els.fuelLabel.textContent=String(Math.ceil(run.fuelMax));els.extraMeter.textContent='';els.abilityBadge.textContent=ABILITY_SHORT[run.car.id];els.abilityBadge.classList.add('active');els.fuelBox.classList.remove('low','critical');updateSpecialHud();}
function updateHud(){
  els.distanceLabel.textContent=fmt(run.distance);const fuelPct=clamp(run.fuel/run.fuelMax*100,0,100);els.fuelBar.style.width=`${fuelPct}%`;els.fuelLabel.textContent=String(Math.ceil(run.fuel));els.fuelBox.classList.toggle('low',fuelPct<=30&&fuelPct>10);els.fuelBox.classList.toggle('critical',fuelPct<=10);
  let extra='';
  if(run.car.id==='boon')extra=`ARMOR ${run.armor}/${run.car.ability.armorMax} ｜ CONE/BARRIER接触を防ぐ`;
  if(run.car.id==='wagon')extra='ふわっと長く浮く ｜ 着地注意';
  if(run.car.id==='bike')extra='2段ジャンプ −4⛽ ｜ TANK 60';
  if(run.car.id==='sport')extra=`NITRO ${nitroActive()?'ACTIVE':`${Math.floor(run.nitro)}/${run.car.ability.nitroMax}`}${nitroActive()?' ｜ 燃料×2.5':''}${itemBoostActive()?' ｜ BOOST':''}`;
  if(run.car.id==='ssr')extra=`PHANTOM ${run.phantomReady?'READY':`${run.phantomClose}/${run.car.ability.closeNeeded}`} ｜ 発動−35⛽`;
  if(run.car.id==='princess')extra=`${'★'.repeat(run.stars)}${'☆'.repeat(5-run.stars)} ｜ 危険燃料で成長`;
  if(run.car.id==='buggy')extra='大ジャンプ1回だけ ｜ 空中修正なし';
  if(run.car.id==='secret')extra=run.gameTime<run.rocketInvincibleUntil?`無敵 ${(run.rocketInvincibleUntil-run.gameTime).toFixed(1)}秒 ｜ 噴射燃料0`:`${run.rocketThrust?'噴射中 燃料×3':'惰性飛行'} ｜ DANGER ${run.rocketDanger}/${run.car.ability.dangerNeeded}`;
  if(run.shield)extra+=(extra?' ｜ ':'')+'🛡 SHIELD';
  if(run.magnetUntilM>run.distance)extra+=(extra?' ｜ ':'')+'🧲 MAGNET';
  if(specialActive())extra+=(extra?' ｜ ':'')+`⚡ ${SPECIALS[run.car.id].name} ${specialRemaining().toFixed(1)}s`;
  els.extraMeter.textContent=extra;updateSpecialHud();
  if(DEBUG)renderDebugPanel();
}

function flash(kind){els.flash.className=`flash ${kind}`;setTimeout(()=>els.flash.className='flash',360);}
let boardQueue=[],boardTimer=0,boardBusy=false;
function resetHighwayBoard(){boardQueue=[];boardBusy=false;clearTimeout(boardTimer);if(!els.highwayBoard)return;els.highwayBoard.dataset.level='INFO';els.highwayBoardTag.textContent='走行案内';els.highwayBoardMessage.textContent='赤・橙＝回避　緑・金＝突破OK';}
function highwayInfo(text,level='INFO',duration=3400){
  if(!els.highwayBoard||!text)return;
  const last=boardQueue[boardQueue.length-1];if(last&&last.text===text)return;
  boardQueue.push({text:String(text),level,duration:Math.max(2400,duration||3400)});pumpHighwayBoard();
}
function pumpHighwayBoard(){
  if(boardBusy||!boardQueue.length||!els.highwayBoard)return;
  boardBusy=true;const m=boardQueue.shift();els.highwayBoard.dataset.level=m.level||'INFO';els.highwayBoardTag.textContent=m.level==='SPECIAL'?'最終奥義':m.level==='DANGER'?'危険情報':m.level==='WARN'?'注意情報':'走行案内';els.highwayBoardMessage.textContent=m.text;els.highwayBoard.classList.remove('bump');void els.highwayBoard.offsetWidth;els.highwayBoard.classList.add('bump');
  clearTimeout(boardTimer);boardTimer=setTimeout(()=>{boardBusy=false;pumpHighwayBoard();if(!boardQueue.length){els.highwayBoard.dataset.level='INFO';els.highwayBoardTag.textContent='走行案内';els.highwayBoardMessage.textContent='赤・橙＝回避　緑・金＝突破OK';}},m.duration);
}
let toastTimer=0;function toast(text){clearTimeout(toastTimer);els.toast.textContent=text;els.toast.classList.remove('show');void els.toast.offsetWidth;els.toast.classList.add('show');toastTimer=setTimeout(()=>els.toast.classList.remove('show'),900);}
function spawnDust(n,color){
  if(!run)return;
  n=Math.max(1,Math.ceil(n*.48));
  for(let i=0;i<n;i++)run.particles.push({x:PHYSICS.carCenterX-66+Math.random()*24,y:ROAD_Y-6,vx:-40-Math.random()*95,vy:-18-Math.random()*58,life:.22+Math.random()*.18,max:.42,size:2+Math.random()*5,color});
}
function burst(x,y,color,n){
  if(!run)return;
  n=Math.max(2,Math.ceil(n*.52));
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=45+Math.random()*150;run.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.22+Math.random()*.32,max:.56,size:2+Math.random()*5,color});}
}
function updateParticles(dt){for(const p of run.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=210*dt;}run.particles=run.particles.filter(p=>p.life>0);}

function render(){
  if(!run){return;}const c=ctx,w=PHYSICS.logicalWidth,h=PHYSICS.logicalHeight;c.save();
  if(run.car.id==='ssr'&&specialActive()){c.save();c.filter='saturate(.28) brightness(.82)';drawBackground(c,w,h);drawRoad(c,w,h);c.restore();}else{drawBackground(c,w,h);drawRoad(c,w,h);}
  drawObjects(c);drawParticles(c);drawCar(c);if(anyBoostActive()||(specialActive()&&(run.car.id==='sport'||run.car.id==='secret')))drawBoostFx(c);drawSpecialFx(c,w,h);drawRewardFx(c,w,h);c.restore();
}
function coursePalette(m){
  const day={skyTop:'#a9c3cf',skyBottom:'#dbe5e1',far:'#9eb1ad',near:'#7e9691',town:'#718385',rail:'#89979b',roadTop:'#48535b',roadBottom:'#3f4951',shoulder:'#343d44',edge:'#9ca8aa',line:'rgba(239,241,233,.42)',accent:'rgba(211,174,93,.24)'};
  const dusk={skyTop:'#8fa6b4',skyBottom:'#d9c7b2',far:'#8c9995',near:'#6e7c7c',town:'#5e6b72',rail:'#7f898c',roadTop:'#465058',roadBottom:'#3d464d',shoulder:'#323a41',edge:'#919b9e',line:'rgba(235,234,223,.38)',accent:'rgba(204,154,92,.22)'};
  const night={skyTop:'#354558',skyBottom:'#697078',far:'#5b6870',near:'#48565e',town:'#39454f',rail:'#687378',roadTop:'#3b464f',roadBottom:'#333d45',shoulder:'#2b333a',edge:'#78858a',line:'rgba(221,226,221,.32)',accent:'rgba(198,163,98,.18)'};
  const blend=(a,b,t)=>Object.fromEntries(Object.keys(a).map(k=>[k,(String(a[k]).startsWith('#')&&String(b[k]).startsWith('#'))?mix(a[k],b[k],t):(t<.5?a[k]:b[k])]));
  if(m<7000)return blend(day,dusk,clamp(m/7000,0,1));
  if(m<14500)return blend(dusk,night,clamp((m-7000)/7500,0,1));
  return night;
}
function drawBackground(c,w,h){
  const m=run.distance,p=coursePalette(m);
  const g=c.createLinearGradient(0,0,0,ROAD_Y);g.addColorStop(0,p.skyTop);g.addColorStop(1,p.skyBottom);c.fillStyle=g;c.fillRect(0,0,w,ROAD_Y);

  // A quiet fixed sky accent: scenery changes by colour, not by fast-moving objects.
  const nightA=clamp((m-9000)/6500,0,1),dayA=1-nightA;
  if(dayA>.02){c.save();c.globalAlpha=.18*dayA;c.fillStyle='#fff4cf';c.beginPath();c.arc(w*.78,118,42,0,Math.PI*2);c.fill();c.restore();}
  if(nightA>.02){c.save();c.globalAlpha=.20*nightA;c.fillStyle='#dfe8e9';c.beginPath();c.arc(w*.79,112,30,0,Math.PI*2);c.fill();c.globalAlpha=.18*nightA;c.fillStyle='#eef4f1';for(let i=0;i<18;i++){const xx=90+(i*211)%1420,yy=48+(i*67)%235;c.fillRect(xx,yy,1.5,1.5);}c.restore();}
  if(nightA>.08)drawShootingStar(c,w,nightA);

  // Background motion deliberately slow: the player's eye should stay on the road.
  drawSoftHills(c,.018,ROAD_Y-136,p.far,56,360);
  drawSoftHills(c,.038,ROAD_Y-78,p.near,38,285);
  drawFarTown(c,p,m);

  // One calm roadside rail, with sparse posts instead of rapid high-contrast repetition.
  c.fillStyle=p.rail;c.globalAlpha=.55;c.fillRect(0,ROAD_Y-37,w,3);
  const postOff=-(m*PHYSICS.pxPerMeter*.032)%320;
  for(let x=postOff-320;x<w+20;x+=320)c.fillRect(x,ROAD_Y-37,5,37);
  c.globalAlpha=1;
}
function drawSoftHills(c,factor,base,color,amp,period){
  c.beginPath();c.moveTo(0,ROAD_Y);
  for(let x=0;x<=PHYSICS.logicalWidth+64;x+=64){const wx=x+run.distance*PHYSICS.pxPerMeter*factor;const y=base-Math.sin(wx/period)*amp*.34-Math.sin(wx/(period*.58))*amp*.11;c.lineTo(x,y);}
  c.lineTo(PHYSICS.logicalWidth,ROAD_Y);c.closePath();c.fillStyle=color;c.fill();
}
function drawFarTown(c,p,m){
  const off=-(m*PHYSICS.pxPerMeter*.024)%430;
  c.save();c.globalAlpha=m<9000?.38:.28;c.fillStyle=p.town;
  for(let x=off-430;x<PHYSICS.logicalWidth+430;x+=430){const n=Math.floor((x-off)/430)+11,bh=52+((n*31)%54);c.fillRect(x,ROAD_Y-74-bh,66,bh);c.fillRect(x+92,ROAD_Y-74-bh*.58,38,bh*.58);c.fillRect(x+170,ROAD_Y-74-bh*.76,72,bh*.76);}
  c.restore();
}
function drawRoad(c,w,h){
  const p=coursePalette(run.distance);
  const rg=c.createLinearGradient(0,ROAD_Y,0,h);rg.addColorStop(0,p.roadTop);rg.addColorStop(1,p.roadBottom);c.fillStyle=rg;c.fillRect(0,ROAD_Y,w,h-ROAD_Y);
  c.fillStyle=p.shoulder;c.fillRect(0,ROAD_Y+101,w,h-ROAD_Y-101);
  c.fillStyle='rgba(255,255,255,.018)';c.fillRect(0,ROAD_Y+12,w,82);
  c.fillStyle=p.edge;c.globalAlpha=.52;c.fillRect(0,ROAD_Y,w,3);c.globalAlpha=1;

  // Fewer, longer lane markers reduce high-frequency optic flow.
  const off=-(run.distance*PHYSICS.pxPerMeter)%360;c.fillStyle=p.line;
  for(let x=off-360;x<w+20;x+=360)c.fillRect(x,ROAD_Y+62,132,5);
  c.fillStyle=p.accent;c.fillRect(0,ROAD_Y+116,w,3);
}
function drawObjects(c){
  const sorted=[...run.objects].sort((a,b)=>a.x-b.x);
  for(const o of sorted){if(o.dead||o.collected)continue;if(ITEMS[o.type])drawItem(c,o);else drawObstacle(c,o);}
}
function obstacleSignal(o){
  const powered=specialBreaks(o)||run.debug.invincible||run.gameTime<run.invulnerableUntil||anyBoostActive()||(run.car.id==='secret'&&run.gameTime<run.rocketInvincibleUntil);
  const armorBreak=run.car.id==='boon'&&run.armor>0&&(run.car.ability.smashTypes||[]).includes(o.type);
  if(powered||armorBreak)return {kind:'BREAK',color:'#83ff39',core:'#ffe84d'};
  return {kind:'DANGER',color:'#ff3048',core:'#ff9b2f'};
}
function drawObstacle(c,o){
  const x=o.x;c.save();if(o.destroyed)c.globalAlpha=.18;
  const signal=obstacleSignal(o);
  // Signal language: RED/ORANGE = avoid. LIME/GOLD = current state can break through it.
  c.save();c.globalCompositeOperation='lighter';const auraRects=o.type==='PIT'?[{x:o.x,y:ROAD_Y-8,w:o.width,h:18}]:obstacleRects(o);
  c.globalAlpha=o.destroyed?.08:.22;c.shadowColor=signal.color;c.shadowBlur=38;c.fillStyle=signal.color;for(const r of auraRects)c.fillRect(r.x-7,r.y-7,r.w+14,r.h+14);
  c.globalAlpha=o.destroyed?.12:.48;c.shadowBlur=30;c.strokeStyle=signal.color;c.lineWidth=9;for(const r of auraRects)c.strokeRect(r.x-5,r.y-5,r.w+10,r.h+10);
  c.globalAlpha=o.destroyed?.16:.96;c.shadowBlur=17;c.strokeStyle=signal.core;c.lineWidth=3;for(const r of auraRects)c.strokeRect(r.x-2,r.y-2,r.w+4,r.h+4);c.restore();
  // Obstacles use a crisp dark silhouette and a short contact shadow. The course stays calm; hazards do not.
  c.shadowColor='rgba(5,12,18,.58)';c.shadowBlur=7;c.shadowOffsetY=3;
  const outline='#13202a', ivory='#fff4dc', hazard='#ffd43b', orange='#ff6b2c', red='#f04d45';
  const groundShadow=(w,dx=0)=>{c.save();c.shadowBlur=0;c.fillStyle='rgba(4,10,15,.34)';c.beginPath();c.ellipse(x+dx+w/2,ROAD_Y+4,Math.max(13,w*.68),5,0,0,Math.PI*2);c.fill();c.restore();};
  const sr=auraRects[0];if(sr&&o.type!=='PIT'){c.save();c.shadowBlur=15;c.shadowColor=signal.color;c.fillStyle=signal.core;c.font='1000 17px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(signal.kind==='BREAK'?'✓':'!',sr.x+sr.w/2,Math.max(18,sr.y-13));c.restore();}
  switch(o.type){
    case'CONE':{
      groundShadow(o.width);c.fillStyle=orange;c.strokeStyle=outline;c.lineWidth=3;c.beginPath();c.moveTo(x+o.width*.5,ROAD_Y-o.height);c.lineTo(x+o.width,ROAD_Y);c.lineTo(x,ROAD_Y);c.closePath();c.fill();c.stroke();
      c.fillStyle=ivory;c.fillRect(x+o.width*.18,ROAD_Y-o.height*.56,o.width*.64,Math.max(4,o.height*.16));
      c.fillStyle=outline;c.fillRect(x-o.width*.20,ROAD_Y-5,o.width*1.40,5);break;}
    case'BARRIER':{
      groundShadow(o.width);c.fillStyle='#f5f3e8';c.strokeStyle=outline;c.lineWidth=3;roundRect(c,x,ROAD_Y-o.height,o.width,o.height,5);c.fill();c.stroke();c.save();c.beginPath();c.rect(x+1,ROAD_Y-o.height+1,o.width-2,o.height-2);c.clip();c.strokeStyle=red;c.lineWidth=7;for(let q=x-36;q<x+o.width+36;q+=22){c.beginPath();c.moveTo(q,ROAD_Y);c.lineTo(q+34,ROAD_Y-o.height);c.stroke();}c.restore();c.fillStyle=outline;c.fillRect(x+3,ROAD_Y,o.width-6,6);break;}
    case'CRATE':{
      groundShadow(o.width);c.fillStyle='#c57a32';c.strokeStyle=outline;c.lineWidth=3;roundRect(c,x,ROAD_Y-o.height,o.width,o.height,4);c.fill();c.stroke();
      c.strokeStyle='#ffd29a';c.lineWidth=3;c.strokeRect(x+4,ROAD_Y-o.height+5,o.width-8,o.height-10);
      c.strokeStyle='rgba(71,37,17,.88)';c.lineWidth=3;c.beginPath();c.moveTo(x+6,ROAD_Y-o.height+10);c.lineTo(x+o.width-6,ROAD_Y-10);c.moveTo(x+o.width-6,ROAD_Y-o.height+10);c.lineTo(x+6,ROAD_Y-10);c.stroke();
      c.fillStyle=hazard;c.fillRect(x-2,ROAD_Y-o.height-5,o.width+4,4);break;}
    case'PIT':{
      c.shadowBlur=0;c.fillStyle='#081018';c.fillRect(x,ROAD_Y-1,o.width,126);c.fillStyle='#02070b';c.fillRect(x+7,ROAD_Y+9,o.width-14,95);
      c.fillStyle=hazard;c.fillRect(x,ROAD_Y-6,o.width,6);c.fillStyle=outline;for(let q=x;q<x+o.width;q+=30)c.fillRect(q,ROAD_Y-6,14,6);
      c.fillStyle=ivory;c.globalAlpha=.86;c.fillRect(x,ROAD_Y-1,5,13);c.fillRect(x+o.width-5,ROAD_Y-1,5,13);c.globalAlpha=1;break;}
    case'ROLLTIRE':{
      groundShadow(o.width);c.translate(x+o.width/2,ROAD_Y-o.height/2);c.rotate(-(run.gameTime*4.2));c.strokeStyle='#05090d';c.lineWidth=Math.max(10,o.width*.31);c.beginPath();c.arc(0,0,o.width*.40,0,Math.PI*2);c.stroke();c.strokeStyle='#f2f5ef';c.lineWidth=4;c.beginPath();c.arc(0,0,o.width*.18,0,Math.PI*2);c.stroke();c.strokeStyle='#48ddff';c.lineWidth=2;for(let i=0;i<5;i++){const a=i*Math.PI*2/5;c.beginPath();c.moveTo(Math.cos(a)*o.width*.12,Math.sin(a)*o.width*.12);c.lineTo(Math.cos(a)*o.width*.31,Math.sin(a)*o.width*.31);c.stroke();}break;}
    case'DRONE':{
      const cy=ROAD_Y-o.lowerEdge-o.height/2;c.translate(x+o.width/2,cy);c.fillStyle='#273843';c.strokeStyle=ivory;c.lineWidth=2.5;roundRect(c,-o.width/2,-o.height/2,o.width,o.height,8);c.fill();c.stroke();
      c.fillStyle='#ff3d45';c.shadowBlur=14;c.shadowColor='rgba(255,44,55,.85)';c.beginPath();c.arc(0,0,6,0,Math.PI*2);c.fill();c.shadowBlur=5;c.shadowColor='rgba(5,12,18,.58)';c.strokeStyle='#e7f4f5';c.lineWidth=3;c.beginPath();c.moveTo(-o.width*.40,-o.height*.38);c.lineTo(-o.width*.58,-o.height*.72);c.moveTo(o.width*.40,-o.height*.38);c.lineTo(o.width*.58,-o.height*.72);c.stroke();
      c.strokeStyle='#e7f4f5';c.lineWidth=3;c.beginPath();c.moveTo(-o.width*.73,-o.height*.72);c.lineTo(-o.width*.46,-o.height*.72);c.moveTo(o.width*.46,-o.height*.72);c.lineTo(o.width*.73,-o.height*.72);c.stroke();
      c.fillStyle='rgba(255,61,69,.12)';c.beginPath();c.moveTo(-13,o.height/2);c.lineTo(13,o.height/2);c.lineTo(25,63);c.lineTo(-25,63);c.closePath();c.fill();
      c.fillStyle=hazard;c.font='900 14px system-ui';c.textAlign='center';c.fillText('低空',0,-19);break;}
    case'LOWBEAM':{
      c.shadowBlur=5;c.fillStyle=hazard;c.strokeStyle=outline;c.lineWidth=3;c.fillRect(x,ROAD_Y-o.lowerEdge-o.thickness,o.width,o.thickness);c.strokeRect(x,ROAD_Y-o.lowerEdge-o.thickness,o.width,o.thickness);
      c.fillStyle=outline;for(let q=x;q<x+o.width;q+=46)c.fillRect(q,ROAD_Y-o.lowerEdge-o.thickness,20,o.thickness);
      c.fillStyle='#f1f1e7';c.strokeStyle=outline;c.lineWidth=2;c.fillRect(x+14,ROAD_Y-o.lowerEdge,8,o.lowerEdge);c.strokeRect(x+14,ROAD_Y-o.lowerEdge,8,o.lowerEdge);c.fillRect(x+o.width-22,ROAD_Y-o.lowerEdge,8,o.lowerEdge);c.strokeRect(x+o.width-22,ROAD_Y-o.lowerEdge,8,o.lowerEdge);break;}
    case'ARCH':{
      c.fillStyle='#f0eee5';c.strokeStyle=outline;c.lineWidth=3;c.fillRect(x,ROAD_Y-o.pillarHeight,o.pillarWidth,o.pillarHeight);c.strokeRect(x,ROAD_Y-o.pillarHeight,o.pillarWidth,o.pillarHeight);c.fillRect(x+o.roofWidth-o.pillarWidth,ROAD_Y-o.pillarHeight,o.pillarWidth,o.pillarHeight);c.strokeRect(x+o.roofWidth-o.pillarWidth,ROAD_Y-o.pillarHeight,o.pillarWidth,o.pillarHeight);
      c.fillStyle=hazard;c.fillRect(x,ROAD_Y-o.roofLowerEdge-38,o.roofWidth,38);c.strokeRect(x,ROAD_Y-o.roofLowerEdge-38,o.roofWidth,38);c.fillStyle=outline;for(let q=x;q<x+o.roofWidth;q+=46)c.fillRect(q,ROAD_Y-o.roofLowerEdge-38,20,38);break;}
  }
  c.restore();
}
function drawItem(c,o){
  const r=itemRectWithMagnet(o),cx=r.x+r.w/2,cy=r.y+r.h/2,vis=o.visualSize||76;c.save();c.translate(cx,cy);const bob=Math.sin(run.gameTime*3.2+o.x*.006)*2;c.translate(0,bob);
  const tags=PATTERN_BY_ID[o.patternId]?.tags||[],risk=tags.includes('CHOICE')||tags.includes('COMMIT');
  if(o.type==='FUEL_S'||o.type==='FUEL_L'||o.type==='FULL'){
    const s=o.type==='FUEL_L'?vis*.86:vis*.74,isFull=o.type==='FULL';
    if(isFull||risk){c.shadowBlur=isFull?28:24;c.shadowColor=isFull?'#ffe85d':'#84ff5f';c.strokeStyle=isFull?'rgba(255,236,94,.98)':'rgba(133,255,91,.96)';c.lineWidth=3;c.beginPath();c.arc(0,0,s*.60+3*Math.sin(run.gameTime*5),0,Math.PI*2);c.stroke();}
    else{c.shadowBlur=20;c.shadowColor='#42f0c1';c.strokeStyle='rgba(74,244,199,.82)';c.lineWidth=2.5;c.beginPath();c.arc(0,0,s*.56+2*Math.sin(run.gameTime*4),0,Math.PI*2);c.stroke();}
    c.fillStyle=isFull?'#ffe34f':risk?'#78e85f':'#73b17a';roundRect(c,-s*.34,-s*.42,s*.68,s*.84,7);c.fill();c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=2;c.strokeRect(-s*.28,-s*.34,s*.56,s*.68);c.fillStyle='#203329';c.font=`800 ${Math.round(s*.28)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('F',0,1);
  }else{
    const color=o.type==='BOOST'?'#ffcf32':o.type==='MAGNET'?'#36e9ff':'#a878ff';
    c.shadowBlur=22;c.shadowColor=color;c.beginPath();c.arc(0,0,27+2*Math.sin(run.gameTime*5),0,Math.PI*2);c.fillStyle=color;c.fill();c.strokeStyle='rgba(255,255,255,.86)';c.lineWidth=2;c.stroke();c.fillStyle='#111923';c.font='900 22px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(o.type==='BOOST'?'⚡':o.type==='MAGNET'?'🧲':'🛡',0,1);
  }
  c.restore();
}
function drawRuntimeWheel(c,img,v,x,y,width,height){
  if(!img?.complete||!img.naturalWidth||!v)return;
  const cx=x+(v.x/760)*width,cy=y+(v.y/280)*height,ww=(v.w/760)*width,hh=(v.h/280)*height;
  c.save();c.translate(cx,cy);c.rotate((run.distance||0)*1.8);c.drawImage(img,-ww/2,-hh/2,ww,hh);c.restore();
}
function drawCar(c){
  const car=run.car;let width=CAR_VISUAL_WIDTH[car.id]||300;if(specialActive()&&car.id==='boon')width*=1.18;if(specialActive()&&car.id==='bike')width*=.88;const height=width*(280/760);const bob=run.onGround?Math.sin(run.gameTime*10)*.8:0;const x=PHYSICS.carCenterX-width*.50,y=ROAD_Y-run.y-height+bob+5;
  const localImg=images.get(carAssetLocal(car.id));const bodyImg=images.get(carPartAsset(car.id,'body'));const rearImg=images.get(carPartAsset(car.id,'rear'));const frontImg=images.get(carPartAsset(car.id,'front'));const layout=SYNC_WHEEL_LAYOUT[car.id];
  const bodyReady=BOONJUMP_SYNC_CARS.has(car.id)&&bodyImg?.complete&&bodyImg.naturalWidth>0;
  const wheelsReady=car.id==='secret'||(layout&&rearImg?.complete&&rearImg.naturalWidth>0&&frontImg?.complete&&frontImg.naturalWidth>0);
  c.save();if(run.car.id==='ssr'&&run.phantomReady){c.shadowBlur=28;c.shadowColor='#a068ff';}if(run.car.id==='princess'&&run.stars>=3){c.shadowBlur=Math.max(c.shadowBlur,18);c.shadowColor='#ff70d8';}if(run.gameTime<run.invulnerableUntil)c.globalAlpha=.84+.08*Math.sin(run.gameTime*7);if(run.car.id==='ssr'&&specialActive())c.globalAlpha=.55+.16*Math.sin(run.gameTime*11);
  c.shadowBlur=Math.max(c.shadowBlur,5);c.shadowColor='rgba(0,0,0,.28)';
  if(bodyReady&&wheelsReady){c.drawImage(bodyImg,x,y,width,height);if(car.id!=='secret'){drawRuntimeWheel(c,rearImg,layout.rear,x,y,width,height);drawRuntimeWheel(c,frontImg,layout.front,x,y,width,height);}}
  else if(localImg?.complete&&localImg.naturalWidth>0)c.drawImage(localImg,x,y,width,height);
  else{c.fillStyle=CAR_COLORS[car.id]?.[0]||'#5ee';roundRect(c,x,y+25,width,height-25,28);c.fill();}
  if(run.car.id==='secret'&&run.rocketThrust){const fx=x-5,fy=y+height*.62,pulse=.5+.5*Math.sin(run.gameTime*17),len=58+pulse*13;c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.62;const rg=c.createLinearGradient(fx-len,fy,fx+6,fy);rg.addColorStop(0,'rgba(218,91,45,0)');rg.addColorStop(.62,'rgba(225,138,73,.55)');rg.addColorStop(1,'rgba(244,226,165,.9)');c.fillStyle=rg;c.beginPath();c.moveTo(fx+4,fy-9);c.lineTo(fx-len,fy);c.lineTo(fx+4,fy+9);c.closePath();c.fill();c.restore();}
  if(run.car.id==='secret'&&run.gameTime<run.rocketInvincibleUntil){c.strokeStyle='rgba(255,238,64,.95)';c.lineWidth=4;c.shadowBlur=24;c.shadowColor='#ffe83e';c.beginPath();c.ellipse(PHYSICS.carCenterX,ROAD_Y-run.y-height*.5,width*.60,height*.80,0,0,Math.PI*2);c.stroke();}
  if(run.shield){c.strokeStyle='rgba(111,182,193,.62)';c.lineWidth=3;c.beginPath();c.ellipse(PHYSICS.carCenterX,ROAD_Y-run.y-height*.48,width*.57,height*.70,0,0,Math.PI*2);c.stroke();}
  if(run.car.id==='boon'){for(let i=0;i<(run.car.ability.armorMax||2);i++){c.fillStyle=i<run.armor?'#d7bd64':'rgba(255,255,255,.14)';c.fillRect(x+8+i*17,y-8,12,5);}}
  c.restore();
}
function drawSpecialFx(c,w,h){
  if(!specialActive())return;const sp=SPECIALS[run.car.id],t=run.gameTime-run.specialStartedAt,pulse=.5+.5*Math.sin(t*10),cx=PHYSICS.carCenterX,cy=ROAD_Y-run.y-42;c.save();c.globalCompositeOperation='lighter';
  if(run.car.id==='boon'){c.globalAlpha=.34;c.strokeStyle=sp.color;c.lineWidth=7;c.shadowBlur=30;c.shadowColor=sp.color;c.beginPath();c.ellipse(cx,cy,118+pulse*14,70+pulse*7,0,0,Math.PI*2);c.stroke();for(let i=0;i<3;i++){c.globalAlpha=.15;c.fillStyle=sp.color;c.fillRect(cx-150-i*32,cy+32+i*5,125,5);}}
  if(run.car.id==='wagon'){c.strokeStyle=sp.color;c.shadowBlur=25;c.shadowColor=sp.color;for(let i=0;i<3;i++){c.globalAlpha=.18+i*.08;c.lineWidth=3;c.beginPath();c.ellipse(cx,cy,82+i*25+pulse*5,34+i*12,0,0,Math.PI*2);c.stroke();}}
  if(run.car.id==='buggy'){c.strokeStyle=sp.color;c.shadowBlur=22;c.shadowColor=sp.color;c.lineWidth=4;c.globalAlpha=.42;c.beginPath();c.arc(cx,cy,66+pulse*12,0,Math.PI*2);c.stroke();for(let i=0;i<run.specialCharges;i++){c.fillStyle='#fff';c.beginPath();c.arc(cx-24+i*24,cy-64,6,0,Math.PI*2);c.fill();}}
  if(run.car.id==='bike'){c.strokeStyle=sp.color;c.shadowBlur=26;c.shadowColor=sp.color;c.lineWidth=4;c.globalAlpha=.50;for(let i=0;i<4;i++){const xx=cx-68+i*36,yy=cy-52+(i%2)*18;c.beginPath();c.moveTo(xx,yy);c.lineTo(xx+15,yy+18);c.lineTo(xx+4,yy+35);c.stroke();}}
  if(run.car.id==='sport'){c.globalAlpha=.34;c.fillStyle=sp.color;for(let i=0;i<5;i++){const yy=cy-38+i*18,len=190+i*18+pulse*40;c.fillRect(cx-len,yy,len-65,4);}c.globalAlpha=.18;c.fillStyle='#58f2ff';c.fillRect(0,ROAD_Y+20,w,4);}
  if(run.car.id==='ssr'){c.strokeStyle=sp.color;c.shadowBlur=34;c.shadowColor=sp.color;c.globalAlpha=.44;c.lineWidth=5;c.beginPath();c.ellipse(cx,cy,104+pulse*18,72+pulse*8,0,0,Math.PI*2);c.stroke();c.globalAlpha=.10;c.fillStyle=sp.color;c.fillRect(0,0,w,h);}
  if(run.car.id==='princess'){c.strokeStyle=sp.color;c.shadowBlur=30;c.shadowColor=sp.color;c.globalAlpha=.55;c.lineWidth=5;c.beginPath();c.moveTo(cx-34,cy);c.quadraticCurveTo(cx-130,cy-95,cx-145,cy+25);c.moveTo(cx+34,cy);c.quadraticCurveTo(cx+130,cy-95,cx+145,cy+25);c.stroke();c.fillStyle='#fff4a6';c.font='900 34px system-ui';c.textAlign='center';c.fillText('♛',cx,cy-72);}
  if(run.car.id==='secret'){c.strokeStyle=sp.color;c.shadowBlur=36;c.shadowColor=sp.color;c.globalAlpha=.58;c.lineWidth=6;c.beginPath();c.ellipse(cx,cy,104+pulse*18,72+pulse*12,0,0,Math.PI*2);c.stroke();c.globalAlpha=.33;c.fillStyle='#ff6b2d';c.beginPath();c.moveTo(cx-70,cy+10);c.lineTo(cx-300-pulse*90,cy+54);c.lineTo(cx-78,cy+58);c.closePath();c.fill();}
  c.restore();
}

function drawBoostFx(c){
  c.save();const x=PHYSICS.carCenterX-118,y=ROAD_Y-run.y-42,pulse=.5+.5*Math.sin(run.gameTime*13);c.globalAlpha=.78;
  const g=c.createLinearGradient(x-180,0,x+14,0);g.addColorStop(0,'rgba(255,55,170,0)');g.addColorStop(.50,'rgba(255,76,184,.62)');g.addColorStop(.82,'rgba(82,238,255,.82)');g.addColorStop(1,'rgba(255,247,176,.98)');c.fillStyle=g;
  for(let i=0;i<3;i++){const yy=y-17+i*17,len=138+18*Math.sin(run.gameTime*8+i*1.7)+pulse*10;c.beginPath();c.moveTo(x-20,yy);c.lineTo(x-len,yy+2);c.lineTo(x-24,yy+6);c.closePath();c.fill();}
  c.restore();
}
function drawParticles(c){for(const p of run.particles){c.globalAlpha=clamp(p.life/p.max,0,1);c.fillStyle=p.color;c.fillRect(p.x,p.y,p.size,p.size);c.globalAlpha=1;}}
function rewardFx(kind,duration=.55,strength=.8){if(!run)return;run.rewardFxUntil=Math.max(run.rewardFxUntil,run.gameTime+duration);run.rewardFxKind=kind;run.rewardFxStrength=strength;}
function rewardColor(kind){return ({close:'#40f4ff',risk:'#7cff4d',gold:'#ffe33f',cyan:'#2ee9ff',violet:'#a96cff',phantom:'#9a63ff',rocket:'#ffe43b',magenta:'#ff45c8',milestone:'#57e9ff'})[kind]||'#55eaff';}
function drawRewardFx(c,w,h){if(!run||run.gameTime>=run.rewardFxUntil)return;const remain=run.rewardFxUntil-run.gameTime,a=clamp(remain/.48,0,1)*(run.rewardFxStrength||.8),color=rewardColor(run.rewardFxKind);c.save();c.globalCompositeOperation='lighter';c.globalAlpha=.11*a;c.strokeStyle=color;c.lineWidth=8;c.shadowBlur=24;c.shadowColor=color;c.strokeRect(8,8,w-16,h-16);const pulse=1-clamp(remain/1.1,0,1),r=85+pulse*90;c.globalAlpha=.12*a;c.beginPath();c.arc(PHYSICS.carCenterX,ROAD_Y-run.y-45,r,0,Math.PI*2);c.stroke();c.restore();}
function drawShootingStar(c,w,nightA){if(REDUCED_MOTION)return;const cycle=9.4,phase=run.gameTime%cycle;if(phase>1.05)return;const k=Math.floor(run.gameTime/cycle),t=phase/1.05,startX=w*.93-((k*173)%280),startY=60+((k*97)%150),x=startX-t*410,y=startY+t*145,len=155;c.save();c.globalCompositeOperation='lighter';c.globalAlpha=nightA*Math.sin(Math.PI*t)*.95;const g=c.createLinearGradient(x-len,y-len*.35,x,y);g.addColorStop(0,'rgba(47,229,255,0)');g.addColorStop(.7,'rgba(98,239,255,.5)');g.addColorStop(1,'rgba(255,255,255,1)');c.strokeStyle=g;c.lineWidth=3;c.shadowBlur=16;c.shadowColor='#5eeaff';c.beginPath();c.moveTo(x-len,y-len*.35);c.lineTo(x,y);c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(x,y,3.2,0,Math.PI*2);c.fill();c.restore();}
function mix(a,b,t){const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16),ar=(pa>>16)&255,ag=(pa>>8)&255,ab=pa&255,br=(pb>>16)&255,bg=(pb>>8)&255,bb=pb&255;return`rgb(${Math.round(lerp(ar,br,t))},${Math.round(lerp(ag,bg,t))},${Math.round(lerp(ab,bb,t))})`;}
function roundRect(c,x,y,w,h,r){if(c.roundRect){c.beginPath();c.roundRect(x,y,w,h,r);}else{c.beginPath();c.rect(x,y,w,h);}}

function onOrientation(){if(run&&run.phase==='running'&&innerHeight>innerWidth)pauseGame(true);}
function renderDebugPanel(){if(!DEBUG||!run)return;els.debugPanel.innerHTML=`DIST ${run.distance.toFixed(1)}<br>SPEED ${(run.speedMult*100).toFixed(0)}% / ${run.scrollSpeed.toFixed(0)}px/s<br>FUEL ${run.fuel.toFixed(1)} / ${run.fuelMax}<br>SAFE debt ${run.safeDebt.toFixed(1)}<br>OPT debt ${run.optionalDebt.toFixed(1)}<br>JUMPS ${run.jumpsUsed}/${run.cp.maxJumps}${run.car.id==='princess'?'(+STAR)':''}<br>ARMOR ${run.armor||0} PHANTOM ${run.phantomReady?'READY':run.phantomClose}<br>SPECIAL ${run.specialUsed?(specialActive()?specialRemaining().toFixed(1)+'s':'USED'):'READY'}<br>PAT ${run.lastPattern?.id||'-'}<br>OBJ ${run.objects.length}<br><button data-dbg="fuel">FUEL+40</button><button data-dbg="jump">+5km</button><button data-dbg="inv">INV ${run.debug.invincible?'ON':'OFF'}</button>`;}


let rankingPeriod='all',rankingMachine='',pendingRankSubmit=false;
function rankCarName(id){return CAR_BY_ID[id]?.name||id||'-';}
function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function populateRankingMachines(){if(!els.rankingMachineSelect)return;els.rankingMachineSelect.innerHTML='<option value="">車種を選ぶ</option>'+CARS.map(c=>`<option value="${c.id}">${c.secret?'🚀 SECRET｜':''}${c.name}</option>`).join('');}
function renderRankingRows(data){const rows=(data?.rows||[]).slice(0,10);const myId=RUN_RANKING?.playerId?.()||'';els.rankingList.innerHTML=rows.length?rows.map(r=>`<div class="ranking-row ${r.rank===1?'top1':r.rank===2?'top2':r.rank===3?'top3':''} ${r.player_id===myId?'me':''}"><div class="rank">${r.rank<=3?['','🥇','🥈','🥉'][r.rank]:`#${r.rank}`}</div><div class="name">${escapeHtml(r.display_name)}<small>${escapeHtml(r.machine_name||rankCarName(r.machine_id))}</small></div><div class="distance">${fmt(r.distance)}</div></div>`).join(''):'<div class="ranking-row"><div class="name">まだ記録がありません。</div></div>';if(data?.me){els.rankingMe.hidden=false;els.rankingMe.innerHTML=`<div class="me-rank"><b>#${Number(data.me.rank)||'-'}</b><strong>${fmt(data.me.distance)}</strong></div><small>${escapeHtml(data.me.machine_name||rankCarName(data.me.machine_id)||'あなたのベスト')}</small>`;}else{els.rankingMe.hidden=false;els.rankingMe.innerHTML='<div class="me-rank"><b>--</b><strong>未登録</strong></div><small>記録を登録するとここに順位が表示されます</small>';}}
function syncRankingFilterUI(){if(els.rankingOverallButton)els.rankingOverallButton.classList.toggle('active',!rankingMachine);if(els.rankingMachineSelect)els.rankingMachineSelect.value=rankingMachine;}
async function loadRanking(){showScreen('ranking');syncRankingFilterUI();els.rankingStatus.textContent='ランキングを読み込み中…';els.rankingList.innerHTML='';if(!RUN_RANKING){els.rankingStatus.textContent='ランキング機能を読み込めませんでした。';return;}try{const d=await RUN_RANKING.leaderboard(rankingPeriod,rankingMachine,10);renderRankingRows(d);els.rankingStatus.textContent=`${rankingMachine?rankCarName(rankingMachine):'総合'} ｜ ${rankingPeriod==='today'?'今日':rankingPeriod==='week'?'今週':'歴代'} ｜ ${d.total_players||0}人`;}catch(err){els.rankingStatus.textContent=String(err&&err.message||err);}}
function buildRunSubmission(){if(!run||!run.rankingSession)return null;return {session_id:run.rankingSession.session_id,machine_id:run.car.id,distance:Math.floor(run.distance),play_time_ms:Math.max(250,Math.floor(run.gameTime*1000)),death_reason:run.endCause||run.endReason||'unknown',fuel_remaining:Number(run.fuel.toFixed(2)),jump_count:run.stats.jumps||0,double_jump_count:run.stats.doubleJumps||0,close_count:run.stats.close||0,ability_use_count:run.stats.abilityUse||0,boost_time_ms:Math.floor(run.stats.boostTime||0),risk_fuel_count:run.stats.riskFuel||0,played_at:run.finishedAtIso||new Date().toISOString(),source_build:BUILD,client_version:CLIENT_VERSION};}
async function submitCurrentRun(name){const payload=buildRunSubmission();if(!payload||!RUN_RANKING)return;els.resultSubmitButton.disabled=true;els.resultRankingStatus.hidden=false;els.resultRankingStatus.className='result-ranking-status';els.resultRankingStatus.textContent='世界ランキングへ登録中…';try{const d=await RUN_RANKING.submit(payload,name);els.resultRankingStatus.textContent=d.skipped?'登録済みの記録を超えていないため、ランキングはそのままです。':`登録しました！${d.player_rank?` 現在 ${d.player_rank.rank}位`:''}`;els.resultSubmitButton.textContent='✓ 世界ランキング登録済み';}catch(err){els.resultRankingStatus.className='result-ranking-status error';els.resultRankingStatus.textContent=String(err&&err.message||err);els.resultSubmitButton.disabled=false;}}
function requestRankSubmit(){if(!run?.rankingEligible)return;const name=RUN_RANKING?.playerName()||'';if(name){submitCurrentRun(name);return;}pendingRankSubmit=true;els.rankingNameInput.value='';els.rankingNameModal.hidden=false;setTimeout(()=>els.rankingNameInput.focus(),50);}

els.startButton.addEventListener('click',startGame);
els.rankingButton.addEventListener('click',()=>{rankingPeriod='all';rankingMachine='';document.querySelectorAll('[data-rank-period]').forEach(b=>b.classList.toggle('active',b.dataset.rankPeriod==='all'));syncRankingFilterUI();loadRanking();});
els.resultRankingButton.addEventListener('click',()=>{els.resultModal.hidden=true;rankingMachine=run?.car.id==='secret'?'secret':'';els.rankingMachineSelect.value=rankingMachine;loadRanking();});
els.resultSubmitButton.addEventListener('click',requestRankSubmit);
els.rankingNameSave.addEventListener('click',()=>{try{const n=RUN_RANKING.validateName(els.rankingNameInput.value);RUN_RANKING.setPlayerName(n);els.rankingNameModal.hidden=true;if(pendingRankSubmit){pendingRankSubmit=false;submitCurrentRun(n);}}catch(err){els.rankingNameInput.setCustomValidity(String(err&&err.message||err));els.rankingNameInput.reportValidity();els.rankingNameInput.setCustomValidity('');}});
els.rankingNameCancel.addEventListener('click',()=>{pendingRankSubmit=false;els.rankingNameModal.hidden=true;});
document.querySelectorAll('[data-rank-period]').forEach(b=>b.addEventListener('click',()=>{rankingPeriod=b.dataset.rankPeriod;document.querySelectorAll('[data-rank-period]').forEach(x=>x.classList.toggle('active',x===b));loadRanking();}));
els.rankingMachineSelect.addEventListener('change',()=>{rankingMachine=els.rankingMachineSelect.value;syncRankingFilterUI();loadRanking();});
if(els.rankingOverallButton)els.rankingOverallButton.addEventListener('click',()=>{rankingMachine='';syncRankingFilterUI();loadRanking();});

els.garageButton.addEventListener('click',()=>{renderGarage();showScreen('garage');});
els.recordsButton.addEventListener('click',()=>{renderRecords();showScreen('records');});
document.querySelectorAll('[data-back="menu"]').forEach(b=>b.addEventListener('click',()=>{showScreen('menu');renderMenu();}));
els.carGrid.addEventListener('click',e=>{const b=e.target.closest('[data-car]');if(!b)return;const id=b.dataset.car;if(!ownedCars.has(id)){toast('ブーンジャンプで解放しよう！');return;}state.selected=id;saveState();renderGarage();renderMenu();setTimeout(()=>showScreen('menu'),100);});
els.soundButton.addEventListener('click',()=>{state.sound=!state.sound;saveState();renderMenu();if(state.sound)sound.tone(620,.08,'sine',.03,180);});
els.pauseButton.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();pauseGame(false);});
els.specialButton.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();activateSpecial();});
els.resumeButton.addEventListener('click',resumeGame);els.restartButton.addEventListener('click',restartGame);els.quitButton.addEventListener('click',quitGame);els.retryButton.addEventListener('click',restartGame);
els.resultGarageButton.addEventListener('click',()=>{els.resultModal.hidden=true;run=null;renderGarage();showScreen('garage');});
els.resultMenuButton.addEventListener('click',()=>{els.resultModal.hidden=true;run=null;renderMenu();showScreen('menu');});
const gamePress=(e)=>{if(e.target&&typeof e.target.closest==='function'&&e.target.closest('button'))return;if(e.cancelable)e.preventDefault();if(run?.car.id==='secret'&&run.phase==='running'){run.rocketThrust=true;sound.ensure();return;}requestJump();};
const gameRelease=(e)=>{if(run?.car.id==='secret'){if(e&&e.cancelable)e.preventDefault();run.rocketThrust=false;}};
if('PointerEvent' in window){els.viewport.addEventListener('pointerdown',gamePress,{passive:false});els.viewport.addEventListener('pointerup',gameRelease,{passive:false});els.viewport.addEventListener('pointercancel',gameRelease,{passive:false});}
else{els.viewport.addEventListener('touchstart',gamePress,{passive:false});els.viewport.addEventListener('touchend',gameRelease,{passive:false});els.viewport.addEventListener('mousedown',gamePress,{passive:false});window.addEventListener('mouseup',gameRelease,{passive:false});}
window.addEventListener('keydown',e=>{if(e.code==='Space'||e.key==='ArrowUp'){e.preventDefault();if(run?.car.id==='secret')run.rocketThrust=true;else requestJump();}if(e.code==='KeyX'){e.preventDefault();activateSpecial();}if(e.key==='Escape'&&run?.phase==='running')pauseGame(false);});
window.addEventListener('keyup',e=>{if((e.code==='Space'||e.key==='ArrowUp')&&run?.car.id==='secret')run.rocketThrust=false;});
window.addEventListener('resize',onOrientation);document.addEventListener('visibilitychange',()=>{if(document.hidden&&run?.phase==='running')pauseGame(false);});
window.addEventListener('pagehide',saveState);
if(DEBUG){els.debugButton.hidden=false;els.debugButton.addEventListener('click',()=>els.debugPanel.hidden=!els.debugPanel.hidden);els.debugPanel.addEventListener('click',e=>{const b=e.target.closest('[data-dbg]');if(!b||!run)return;if(b.dataset.dbg==='fuel')run.fuel=Math.min(run.fuelMax,run.fuel+40);if(b.dataset.dbg==='jump'){run.distance+=5000;run.spawnCursorX=PHYSICS.logicalWidth+300;run.objects=[];}if(b.dataset.dbg==='inv')run.debug.invincible=!run.debug.invincible;});}

function showFatalError(title,err){
  let box=document.getElementById('runtimeError');
  if(!box){box=document.createElement('div');box.id='runtimeError';box.style.cssText='position:fixed;z-index:5000;inset:12px;display:grid;place-items:center;pointer-events:none';document.body.appendChild(box);}
  const detail=String(err&&err.message?err.message:err||'unknown error');
  box.innerHTML='<div style="pointer-events:auto;max-width:520px;background:#220b12;color:#fff;border:2px solid #ff5168;border-radius:18px;padding:18px;font:14px system-ui;box-shadow:0 20px 60px #000"><b style="font-size:18px">'+title+'</b><div style="margin-top:8px;color:#ffb5bf;word-break:break-all">'+detail.replace(/[<>&]/g,s=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[s]))+'</div><div style="margin-top:10px;font-size:11px;color:#aaa">Build '+BUILD+'</div></div>';
}
window.addEventListener('error',e=>{console.error('[BOONRUN] window error',e.error||e.message);showFatalError('ブーンRUNでエラーが発生しました',e.error||e.message);});
window.addEventListener('unhandledrejection',e=>{console.error('[BOONRUN] promise rejection',e.reason);showFatalError('ブーンRUNで処理エラーが発生しました',e.reason);});
window.__BOONRUN_TEST={
  build:BUILD,
  boot:()=>window.__BOONRUN_BOOT||null,
  status:()=>run?{phase:run.phase,distance:run.distance,fuel:run.fuel,fuelRate:effectiveFuelRate(),car:run.car.id,objects:run.objects.length,y:run.y,vy:run.vy,scrollSpeed:run.scrollSpeed,armor:run.armor,stars:run.stars,specialCharges:run.specialCharges,rocketThrust:run.rocketThrust,rocketDanger:run.rocketDanger,rocketInvincible:run.gameTime<run.rocketInvincibleUntil,specialUsed:run.specialUsed,specialActive:specialActive(),specialRemaining:specialRemaining(),rankingEligible:run.rankingEligible}:null,
  selectCar(id){if(CAR_BY_ID[id]){ownedCars.add(id);state.selected=id;saveState();renderMenu();return id;}return null;},
  start:startGame, jump:requestJump, special:activateSpecial, pause:()=>pauseGame(false),
  press(){if(run?.car.id==='secret')run.rocketThrust=true;else requestJump();}, release(){if(run)run.rocketThrust=false;},
  tick(n=1){for(let i=0;i<Math.max(1,Number(n)||1);i++){if(run?.phase==='running')step(FIXED_DT);}if(run)render();return this.status();},
  smoke(){try{const before=run&&run.distance;if(!run)startGame();return {ok:true,build:BUILD,before,boot:window.__BOONRUN_BOOT};}catch(err){return {ok:false,error:String(err&&err.stack||err)};}}
};
window.__BOONRUN_BOOT={phase:'ready',build:BUILD,at:Date.now()};
populateRankingMachines();renderMenu();renderGarage();
if('serviceWorker'in navigator&&location.protocol!=='file:'){navigator.serviceWorker.register('./sw.js').then(r=>r.update&&r.update()).catch(err=>console.warn('[BOONRUN] SW skipped',err));}
