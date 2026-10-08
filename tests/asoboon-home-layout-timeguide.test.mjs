import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('timeguide persists a same-environment HOME result and clears invalid input',()=>{
  const s=read('miniapp-v2/shared/timeguide.js');
  assert.match(s,/const STORAGE_NS=String\(E\.storageNamespace\|\|E\.environment\|\|'develop'\)/);
  assert.match(s,/asoboon_v2_timeguide_\$\{STORAGE_NS\}_v1/);
  assert.match(s,/localStorage\.setItem\(HOME_RESULT_KEY/);
  assert.match(s,/localStorage\.removeItem\(HOME_RESULT_KEY/);
  assert.match(s,/asoboon:v2-timeguide-updated/);
  assert.match(s,/saved\?\.entryTime\|\|defaultEntry\(day\)/);
});

for(const env of ['develop','production']){
  test(env+' HOME puts surprise vote above guides and event calendar below play content',()=>{
    const s=read('miniapp-v2/'+env+'/home-v38.js');
    const surprise=s.indexOf('<section id="v38Surprise"');
    const guide=s.indexOf('<section class="v38-guide">');
    const play=s.indexOf('<section class="v38-play">');
    const calendar=s.indexOf('<section class="v38-calendar-section">');
    const help=s.indexOf('<section class="v38-help">');
    assert.ok(surprise>=0&&guide>=0&&play>=0&&calendar>=0&&help>=0);
    assert.ok(surprise<guide,'surprise vote should occupy the former event-calendar position');
    assert.ok(play<calendar,'event calendar should move to the former surprise-vote position');
    assert.ok(calendar<help,'event calendar should remain before help');
  });

  test(env+' HOME reflects the saved play-time result',()=>{
    const s=read('miniapp-v2/'+env+'/home-v38.js');
    assert.match(s,new RegExp("TIMEGUIDE_KEY='asoboon_v2_timeguide_"+env+"_v1'"));
    assert.match(s,/function patchTimeguideShortcut\(\)/);
    assert.match(s,/data-timeguide-title/);
    assert.match(s,/end\+'まで遊べる'/);
    assert.match(s,/asoboon:v2-timeguide-updated/);
  });
}

test('cache keys load the new HOME/timeguide code',()=>{
  const dev=read('miniapp-v2/develop/index.html');
  const prod=read('miniapp-v2/production/index.html');
  assert.match(dev,/shared\/timeguide\.js\?v=20261004-02/);
  assert.match(dev,/home-v38\.js\?v=20261006-01/);
  assert.match(prod,/production-app\.js\?v=[a-f0-9]{12}/);
  const bundle=read('miniapp-v2/production/production-app.js');
  const routes=read('miniapp-v2/production/production-routes.js');
  assert.doesNotMatch(bundle,/miniapp-v2\/shared\/timeguide\.js/);
  assert.match(routes,/miniapp-v2\/shared\/timeguide\.js/);
  assert.match(bundle,/miniapp-v2\/production\/home-v38\.js/);
});

