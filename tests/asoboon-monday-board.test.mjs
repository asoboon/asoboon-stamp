import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(path,'utf8');
const pick = (source,pattern,label) => {
  const match=source.match(pattern);
  assert.ok(match,'Missing source function: '+label);
  return match[0];
};

for (const edition of ['develop','production']) {
  test(edition+': Monday contains exactly four actual AirWAIT queue types',()=>{
    const source=read('miniapp-v2/backend/'+edition+'-worker.mjs');
    const harness=vm.runInNewContext([
      pick(source,/const BOARD_SLOT_SPECS = Object.freeze\(\{[\s\S]*?\n\}\);/,'slot specs'),
      pick(source,/function boardDisplayType\([\s\S]*?\n\}/,'Monday routing'),
      pick(source,/function mondayWaitTypeVisible\([\s\S]*?\n\}/,'Monday visibility'),
      pick(source,/function boardSlotKey\([\s\S]*?\n\}/,'slot key'),
      '({specs:BOARD_SLOT_SPECS,resolve:boardDisplayType,slot:boardSlotKey,visible:mondayWaitTypeVisible})'
    ].join('\n'));
    const monday=harness.specs['月曜'];
    assert.equal(monday.length,1,'Current board has one all-day queue grid');
    assert.equal(monday[0].key,'weekday');
    assert.deepEqual(Array.from(monday[0].waitTypeIds),['0023','0024','0025','0027']);
    for (const [id,label] of [
      ['0023','すぐ入場受付【平日】'],
      ['0024','10時ご入場枠【WEB平日】'],
      ['0025','14時から【平日】'],
      ['0027','14時ご入場枠【WEB平日】']
    ]) {
      assert.equal(harness.slot({waitTypeId:id,waitTypeName:label},monday),'weekday',label+' must appear');
    }
    assert.equal(harness.slot({waitTypeId:'0030',waitTypeName:'10:00の回'},monday),'');
    const mondayTimeline=[
      ['2026-11-01T23:59:00Z', ['0023']],
      ['2026-11-02T00:00:00Z', ['0023','0024']],
      ['2026-11-02T03:59:00Z', ['0023','0024']],
      ['2026-11-02T04:00:00Z', ['0023','0024','0025','0027']],
      ['2026-11-02T04:29:00Z', ['0023','0024','0025','0027']],
      ['2026-11-02T04:30:00Z', ['0023','0025','0027']],
      ['2026-11-02T07:59:00Z', ['0023','0025','0027']],
      ['2026-11-02T08:00:00Z', []],
    ];
    for (const [iso,expected] of mondayTimeline){
      const active=['0023','0024','0025','0027'].filter(id=>harness.visible(id,new Date(iso)));
      assert.deepEqual(active,expected,edition+' '+iso);
    }
    assert.match(source,/boardType!=='月曜'\|\|mondayWaitTypeVisible/);
    assert.match(source,/boardType==='月曜'\?\{waitTypeId:/);

    assert.equal(harness.resolve('平日','2026-11-02'),'月曜');
    assert.equal(harness.resolve('平日','2026-11-09'),'月曜');
    assert.equal(harness.resolve('平日','2026-11-04'),'平日');
    for(const name of ['休館','平日特定日','土日祝日'])assert.equal(harness.resolve(name,'2026-11-02'),name);
    assert.ok(source.includes('const specs=BOARD_SLOT_SPECS[boardType]'));
    assert.ok(source.includes('    boardType,'));
    assert.ok(source.includes('getBoardRows(env,businessDate,businessType)'),'retain the shared regular-weekday snapshot cache');
  });
}

test('board renders Monday as a 17:00-close, 2h30 operating day without touching normal weekdays',()=>{
  const source=read('miniapp-v2/develop/board/board.js');
  const harness=vm.runInNewContext([
    pick(source,/^const BOARD_OPEN_MINUTE=.*;$/m,'opening'),
    pick(source,/^const CLOSE_MINUTES=.*;$/m,'closing'),
    pick(source,/function tokyoParts\([\s\S]*?\n\}/,'Tokyo clock'),
    pick(source,/function canonicalBusinessType\([\s\S]*?\n\}/,'business type'),
    pick(source,/function resolveBoardContext\([\s\S]*?\n\}/,'board context'),
    '({resolveBoardContext})'
  ].join('\n'));
  const check=(iso,type)=>harness.resolveBoardContext(new Date(iso),type);
  const monday=check('2026-11-02T01:00:00Z','月曜');
  assert.equal(monday.phase,'active');
  assert.equal(monday.slotKey,'weekday');
  assert.equal(monday.detail,'呼出状況を表示しています');
  assert.equal(check('2026-11-02T08:00:00Z','月曜').phase,'ended');
  assert.equal(check('2026-11-04T01:00:00Z','平日').detail,'時間制限なし');
  assert.equal(check('2026-11-02T01:00:00Z','休館').phase,'closed');
  assert.equal(check('2026-11-02T01:00:00Z','平日特定日').slotKey,'10:00');
  assert.equal(check('2026-11-01T03:00:00Z','土日祝日').slotKey,'12:30');
  assert.ok(source.includes('data?.boardType||data?.businessType'),'API routing must reach client rendering');
});

test('browser Monday visibility windows mirror the Worker and include exact overlap boundaries',()=>{
  const source=read('miniapp-v2/develop/board/board.js');
  const harness=vm.runInNewContext([
    pick(source,/function tokyoParts\([\s\S]*?\n\}/,'Tokyo clock'),
    pick(source,/function mondayWaitTypeVisible\([\s\S]*?\n\}/,'Monday client visibility'),
    '({visible:mondayWaitTypeVisible})'
  ].join('\n'));
  const entries=[
    ['2026-11-01T23:59:00Z',['0023']],
    ['2026-11-02T00:00:00Z',['0023','0024']],
    ['2026-11-02T03:59:00Z',['0023','0024']],
    ['2026-11-02T04:00:00Z',['0023','0024','0025','0027']],
    ['2026-11-02T04:29:00Z',['0023','0024','0025','0027']],
    ['2026-11-02T04:30:00Z',['0023','0025','0027']],
    ['2026-11-02T07:59:00Z',['0023','0025','0027']],
    ['2026-11-02T08:00:00Z',[]]
  ];
  for(const [iso,expected] of entries) {
    const found=['0023','0024','0025','0027'].filter(id=>harness.visible(id,new Date(iso)));
    assert.deepEqual(found,expected,iso);
  }
  assert.match(source,/context.businessType==='月曜'/);
  assert.match(source,/row=>mondayWaitTypeVisible\(String\(row\?\.waitTypeId\|\|''\),now\)/);
});
