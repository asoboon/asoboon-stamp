from pathlib import Path
import json,re,hashlib,subprocess,sys,tempfile
P=Path('boonjump/index.html'); s=P.read_text(); before=s

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1, got {n}')
    s=s.replace(old,new,1)

def rx(pattern,new,label,flags=re.S):
    global s
    s2,n=re.subn(pattern,lambda m:new,s,count=1,flags=flags)
    if n!=1: raise SystemExit(f'{label}: expected 1, got {n}')
    s=s2

def blk(txt,a,b):
    m=re.search(a+'(.*?)'+b,txt,re.S); return m.group(0) if m else None

protected={
 'CARS':(r"  const CARS = \[",r"\n  \];\n  const SUPPORT_ITEMS"),
 'GARAGE_GUIDE':(r"  const GARAGE_GUIDE = \{",r"\n  \};\n\n\n  const SELECTOR_GUIDE"),
 'SOUND':(r"  const Sound=\{",r"\n  const prevent ="),
 'AIR_COMMAND':(r"  const AIR_COMMAND_SECONDS=3;",r"\n  const colorMix="),
 'PAYLOAD':(r"  const worldScorePayload=",r"\n  const updateLocalRegistration=")
}
hashes={k:hashlib.sha256(blk(before,*v).encode()).hexdigest() for k,v in protected.items()}

one('<link rel="manifest" href="./manifest.webmanifest">','<link rel="manifest" href="./manifest.webmanifest">\n  <link rel="stylesheet" href="./technique-ui-v741.css?v=741-technique-ui">','stylesheet')
one('Ver.7.3.0 アドバイザー反映','Ver.7.4.1 技選択UI','meta version')
one('<meta name="boonjump-build" content="2026-08-16-advisor-polish-v730">','<meta name="boonjump-build" content="2026-08-17-technique-ui-v741">','meta build')
one("const APP_VERSION = '7.3.0';","const APP_VERSION = '7.4.1';",'app version')
one("const BUILD = '2026-08-16-advisor-polish-v730';","const BUILD = '2026-08-17-technique-ui-v741';",'js build')
one('const SCHEMA = 8;','const SCHEMA = 9;','schema')

one('3 COMBOを決めて、空中でAIR COMMAND！','3 COMBOを決めて、大ジャンプ！','home eyebrow')
one('ACCEL → TURBO → NITROで飛び出して、<br>最後は10個の矢印を4方向ボタンで決めろ！','ACCEL → TURBO → NITRO。<br>3回のタイミングで飛距離を伸ばそう！','home lead')
one('<small>いまのマシン</small>','<small>🏎️ マシン</small>','machine label')
rx(r'''          <div class="current-car-copy">(.*?)          </div>\n        </div>\n\n        <button class="primary huge" id="playButton" type="button">このマシンで飛ぶ</button>\n        <div class="home-air-tip support-home-tip" id="homeSupportTip" aria-label="装備中のサポートアイテム">\n          <b id="homeSupportName">サポート：なし</b><span id="homeSupportEffect">3回の操作だけで飛ぶ標準スタイル</span><strong id="homeSupportHint">車庫でいつでも付け替えできます</strong>\n        </div>''',
'''          <div class="current-car-copy">\1          </div>\n          <button class="home-machine-change" id="homeMachineChange" type="button">変更</button>\n        </div>\n\n        <button class="home-technique-card" id="homeSupportTip" type="button" aria-label="技を変更" hidden>\n          <span class="home-technique-icon" id="homeTechniqueIcon">⭐</span>\n          <span class="home-technique-copy"><small>🎮 技</small><strong id="homeSupportName">通常</strong><span id="homeSupportEffect">いつもの3回操作で勝負</span></span>\n          <em class="home-technique-change" id="homeSupportHint">変更</em>\n        </button>\n        <button class="primary huge" id="playButton" type="button">🚀 このマシンで飛ぶ！</button>''','home cards')

one('''    </section>\n\n    <section class="screen" id="gachaScreen" aria-labelledby="gachaTitle">''','''    </section>\n\n    <section class="screen" id="techniqueScreen" aria-labelledby="techniqueTitle">\n      <div class="panel technique-panel">\n        <div class="panel-head technique-head">\n          <button class="icon-button" data-back="home" type="button" aria-label="戻る">‹</button>\n          <div><small>🎮 技</small><h2 id="techniqueTitle">好きな技を選ぶ</h2></div>\n          <div class="technique-current"><small>いまの技</small><b id="supportEquippedName">通常</b></div>\n        </div>\n        <p class="technique-intro">今回どんな遊び方で挑戦するか、好きな技を1つ選ぼう。カードをタップしたらすぐ決定！</p>\n        <div class="technique-grid" id="supportItemGrid" aria-label="技一覧"></div>\n      </div>\n    </section>\n\n    <section class="screen" id="gachaScreen" aria-labelledby="gachaTitle">''','tech screen')

rx(r'''\n\n          <section class="support-lab" id="supportLab" aria-label="サポートアイテム">.*?          </section>\n\n          <button class="selector-choose"''','''\n\n          <button class="selector-choose"''','garage tech removal')

one('>サポート発動！</div>','>技発動！</div>','flight label')
one('''<div class="result-air-drive" id="resultAirDrive">\n          <small>AIR COMMAND 結果</small><strong id="resultAirDriveBonus">0 / 10</strong><span id="resultAirDriveDetail">3.00秒 · ミス0 · 追加加速なし</span>\n        </div>''','''<div class="result-air-drive result-technique" id="resultAirDrive">\n          <small>🎮 今回の技</small><strong id="resultAirDriveBonus">⭐ 通常</strong><span id="resultAirDriveDetail">いつもの3回操作で挑戦</span>\n        </div>''','result shell')

one("none:{id:'none',icon:'◯',name:'装備なし',short:'3回だけで飛ぶ'","none:{id:'none',icon:'⭐',name:'通常',short:'3回だけで飛ぶ'",'normal name')
one('''  const SUPPORT_IDS=Object.freeze(Object.keys(SUPPORT_ITEMS));\n  const AIR_COMMAND_FIXED_COUNT=10;''','''  const SUPPORT_IDS=Object.freeze(Object.keys(SUPPORT_ITEMS));\n  const TECHNIQUE_UI=Object.freeze({\n    none:{icon:'⭐',name:'通常',effect:'いつもの3回操作で勝負',target:'はじめてにおすすめ',result:'いつもの3回操作で挑戦'},\n    slow_accel:{icon:'🐢',name:'ゆっくりアクセル',effect:'ACCELがゆっくり',target:'タイミングを狙いやすい',result:'ゆっくりACCELで挑戦'},\n    hyper_accel:{icon:'⚡',name:'高速アクセル',effect:'ACCELが高速に！',target:'うまく決めるほど加速',result:'高速ACCELで挑戦'},\n    pinpoint:{icon:'🎯',name:'ピンポイントスタート',effect:'SUPERが狭くなる',target:'難しいけど大加速',result:'ピンポイントSUPERに挑戦'},\n    trampoline:{icon:'🟣',name:'トランポリン',effect:'着地でもう1回ジャンプ',target:'かんたんにもうひと伸び',result:'着地ジャンプを狙った'},\n    air_command:{icon:'🧭',name:'エアコマンド',effect:'10個を3秒で入力',target:'最高記録を狙う！',result:'10個を3秒で入力'}\n  });\n  const techniqueUiFor=value=>TECHNIQUE_UI[String(value||'')]||TECHNIQUE_UI.none;\n  const AIR_COMMAND_FIXED_COUNT=10;''','tech metadata')

one("machineCore:0,\n    garage:","machineCore:0,supportId:'none',supportAirCount:AIR_COMMAND_FIXED_COUNT,\n    garage:",'default global tech')
one("    base.selected = CAR_BY_ID[selected] && base.garage[selected].owned ? selected : CARS.find(c=>base.garage[c.id].owned)?.id || 'boon';\n    base.best =", "    base.selected = CAR_BY_ID[selected] && base.garage[selected].owned ? selected : CARS.find(c=>base.garage[c.id].owned)?.id || 'boon';\n    const globalSupportKey=['supportId','techniqueId','playerSupportId','selectedSupportId'].find(key=>Object.prototype.hasOwnProperty.call(input,key));\n    if(globalSupportKey)base.supportId=normalizeSupportId(input[globalSupportKey]);else base.supportId=normalizeSupportId(base.garage[base.selected]?.supportId);\n    base.supportAirCount=AIR_COMMAND_FIXED_COUNT;\n    base.best =",'migration')
one("home:$('homeScreen'),gacha:$('gachaScreen')","home:$('homeScreen'),technique:$('techniqueScreen'),gacha:$('gachaScreen')",'screen map')
one("homeTune:$('homeTune'),homeSupportTip:","homeTune:$('homeTune'),homeMachineChange:$('homeMachineChange'),homeSupportTip:",'home machine ref')
one("homeSupportTip:$('homeSupportTip'),homeSupportName:","homeSupportTip:$('homeSupportTip'),homeTechniqueIcon:$('homeTechniqueIcon'),homeSupportName:",'home icon ref')
one(",supportLab:$('supportLab'),supportEquippedName:$('supportEquippedName'),supportItemGrid:$('supportItemGrid'),airCommandSetting:$('airCommandSetting'),airCountButtons:$('airCountButtons'),airCommandSettingNote:$('airCommandSettingNote'),selectorChoose:",",supportEquippedName:$('supportEquippedName'),supportItemGrid:$('supportItemGrid'),selectorChoose:",'tech refs')
one("const supportStateFor=id=>{const rec=getRecord(id);rec.supportId=normalizeSupportId(rec.supportId);rec.supportAirCount=normalizeAirCount(rec.supportAirCount);return{rec,item:SUPPORT_ITEMS[rec.supportId]||SUPPORT_ITEMS.none,id:rec.supportId,airCount:AIR_COMMAND_COUNT};};","const supportStateFor=id=>{const rec=getRecord(id);state.supportId=normalizeSupportId(state.supportId);state.supportAirCount=AIR_COMMAND_FIXED_COUNT;return{rec,item:SUPPORT_ITEMS[state.supportId]||SUPPORT_ITEMS.none,id:state.supportId,airCount:AIR_COMMAND_COUNT};};",'global support getter')
one("const supportFeatureUnlocked=()=>Math.max(0,Number(state?.plays)||0)>=3||CARS.some(car=>normalizeSupportId(getRecord(car.id)?.supportId)!=='none');","const supportFeatureUnlocked=()=>Math.max(0,Number(state?.plays)||0)>=3||normalizeSupportId(state?.supportId)!=='none'||CARS.some(car=>normalizeSupportId(getRecord(car.id)?.supportId)!=='none');",'unlock')

rx(r'''const support=supportStateFor\(currentCar\.id\),supportUnlocked=supportFeatureUnlocked\(\);if\(el\.homeSupportTip\).*?el\.homeSupportHint\.textContent=.*?;''',
'''const support=supportStateFor(currentCar.id),supportUi=techniqueUiFor(support.id),supportUnlocked=supportFeatureUnlocked();if(el.homeSupportTip)el.homeSupportTip.hidden=!supportUnlocked;if(el.homeTechniqueIcon)el.homeTechniqueIcon.textContent=supportUi.icon;if(el.homeSupportName)el.homeSupportName.textContent=supportUi.name;if(el.homeSupportEffect)el.homeSupportEffect.textContent=supportUi.target;if(el.homeSupportHint)el.homeSupportHint.textContent='変更';''','home render')
one('    renderTuneLab();\n    renderSupportLab();\n    el.selectorChoose.disabled=!owned;','    renderTuneLab();\n    el.selectorChoose.disabled=!owned;','garage render')

rx(r'''  const renderSupportLab=\(\)=>\{.*?\n  const renderTuneLab=''','''  const renderTechniquePicker=()=>{\n    if(!el.supportItemGrid||!el.supportEquippedName)return;\n    const featureUnlocked=supportFeatureUnlocked(),stateInfo=activeSupport(),selectedUi=techniqueUiFor(stateInfo.id);el.supportEquippedName.textContent=selectedUi.name;\n    if(!featureUnlocked){el.supportItemGrid.innerHTML='<div class="technique-lock-card"><b>🔒 技は3回遊ぶと解放！</b><span>まずはACCEL・TURBO・NITROの3回操作を楽しもう。</span></div>';return;}\n    el.supportItemGrid.innerHTML='';\n    SUPPORT_IDS.forEach(id=>{const ui=techniqueUiFor(id),button=document.createElement('button'),selected=stateInfo.id===id;button.type='button';button.className=`technique-card${selected?' selected':''}`;button.dataset.supportId=id;button.setAttribute('aria-pressed',String(selected));button.innerHTML=`<span class="technique-icon">${ui.icon}</span><b>${ui.name}</b><span class="technique-effect">${ui.effect}</span><span class="technique-target">${ui.target}</span><span class="technique-selected">✓ 選択中</span>`;button.onclick=()=>{state.supportId=id;state.supportAirCount=AIR_COMMAND_FIXED_COUNT;save();renderHome();renderTechniquePicker();showScreen('home');};el.supportItemGrid.appendChild(button);});\n  };\n  const renderTuneLab=''' ,'picker')

one("SUPPORT_ITEMS[normalizeSupportId(rec.bestMeta.supportId)]?.name||'装備なし'","techniqueUiFor(normalizeSupportId(rec.bestMeta.supportId)).name",'record display')
one("support=SUPPORT_ITEMS[normalizeSupportId(row.support_id)]","support=techniqueUiFor(normalizeSupportId(row.support_id))",'rank display')

rx(r'''if\(el\.resultAirDrive\)\{const enabled=attempt\.supportId==='air_command'.*?\}\}if\(el\.resultGrowth\)''','''if(el.resultAirDrive){const usedId=normalizeSupportId(attempt.supportId),ui=techniqueUiFor(usedId),correct=Number(attempt.airCommandCorrect||0),wrong=Number(attempt.airCommandWrong||0),count=Number(attempt.airCommandCount||AIR_COMMAND_COUNT),grade=airCommandGrade(correct,count),ratio=correct/Math.max(1,count),tone=usedId==='air_command'?(ratio>=1?'perfect':ratio>=.70?'burst':ratio>=.40?'boost':correct>0?'nice':'none'):'none';let detail=ui.result;if(usedId==='air_command')detail=`${correct} / ${count} 成功｜${grade}｜ミス ${wrong}`;else if(usedId==='trampoline')detail=flight.supportTrampolineUsed?'着地ジャンプ発動！':'今回は着地ジャンプなし';el.resultAirDrive.hidden=false;el.resultAirDrive.className=`result-air-drive result-technique ${tone}`;el.resultAirDriveBonus.textContent=`${ui.icon} ${ui.name}`;el.resultAirDriveDetail.textContent=detail;}if(el.resultGrowth)''','result render')
one("'🧰 サポートアイテム解放！'","'🎉 技が使えるようになった！'",'unlock title')
one("'3コンボに慣れてきたら、車庫で1つだけ装備して遊び方を変えられます。'","'好きな技を1つ選んで、新しい飛び方に挑戦しよう！'",'unlock body')
one("el.airDriveFeedback.textContent='エアコマンド装備時だけ追加チャレンジ';","el.airDriveFeedback.textContent='エアコマンドの時だけ追加チャレンジ';",'air visible copy')

needle="  el.selectorChoose.addEventListener('click',()=>{const car=CAR_BY_ID[selectorPreviewId],rec=car&&getRecord(car.id);if(!car||!rec?.owned)return;if(car.id!==currentCar.id){currentCar=car;state.selected=car.id;save();renderHome();}renderGarage();schedule(()=>showScreen('home'),90);});"
one(needle,needle+"\n  el.homeMachineChange?.addEventListener('click',()=>{selectorPreviewId=currentCar.id;renderGarage();showScreen('garage');});\n  el.homeSupportTip?.addEventListener('click',()=>{if(!supportFeatureUnlocked())return;renderTechniquePicker();showScreen('technique');});",'home events')
one("setSupport(id,supportId,_airCount=10){if(!CAR_BY_ID[id])return false;const rec=getRecord(id);rec.owned=true;rec.supportId=normalizeSupportId(supportId);rec.supportAirCount=AIR_COMMAND_COUNT;save();renderHome();renderGarage();return true;},","setSupport(id,supportId,_airCount=10){if(!CAR_BY_ID[id])return false;const rec=getRecord(id);rec.owned=true;state.supportId=normalizeSupportId(supportId);state.supportAirCount=AIR_COMMAND_COUNT;save();renderHome();renderGarage();return true;},",'debug compat')
one("navigator.serviceWorker.register('./sw.js?v=730-advisor'","navigator.serviceWorker.register('./sw.js?v=741-technique-ui'",'sw query')

P.write_text(s)

swp=Path('boonjump/sw.js'); sw=swp.read_text(); sw0=sw
if sw.count('const BUILD = "2026-08-16-advisor-polish-v730";')!=1: raise SystemExit('sw build mismatch')
sw=sw.replace('const BUILD = "2026-08-16-advisor-polish-v730";','const BUILD = "2026-08-17-technique-ui-v741";',1)
if sw.count('  "./index.html",\n  "./ranking-client.js?v=730-advisor",')!=1: raise SystemExit('sw precache anchor mismatch')
sw=sw.replace('  "./index.html",\n  "./ranking-client.js?v=730-advisor",','  "./index.html",\n  "./technique-ui-v741.css?v=741-technique-ui",\n  "./ranking-client.js?v=730-advisor",',1)
swp.write_text(sw)

mp=Path('boonjump/manifest.webmanifest'); data=json.loads(mp.read_text()); data['description']='最初は3コンボに集中し、3回遊ぶと好きな技を選べるASOBooNのブーンジャンプ'; mp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

for k,v in protected.items():
    now=blk(s,*v); h=hashlib.sha256(now.encode()).hexdigest() if now else ''
    if h!=hashes[k]: raise SystemExit(f'protected block changed: {k}')

checks=[
 "const AIR_COMMAND_FIXED_COUNT=10;","const AIR_COMMAND_SECONDS=3;","state.supportId=id","showScreen('home')",
 "supportId:normalizeSupportId(attempt&&attempt.supportId)","airCommandCorrect:Math.max(0,Math.min(10",
 "id=\"techniqueScreen\"","class=\"technique-grid\"","🎉 技が使えるようになった！"
]
for x in checks:
    if x not in s: raise SystemExit('missing contract: '+x)
for x in ['サポートアイテム','付け替え','取り外し','装備なし']:
    if x in re.sub(r'/\*.*?\*/','',s,flags=re.S): raise SystemExit('legacy visible term remains: '+x)
print('BOONJUMP technique UI patch applied and protected blocks verified')
