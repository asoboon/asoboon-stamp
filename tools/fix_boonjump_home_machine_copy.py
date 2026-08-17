from pathlib import Path
p=Path('boonjump/index.html')
s=p.read_text()
bad='<div class="current-car-copy">\x01          </div>'
good='''<div class="current-car-copy">\n            <small>🏎️ マシン</small>\n            <strong id="homeCarName">ブーンピックアップ</strong>\n            <span id="homeCarTrait">はじめてでも飛ばしやすい</span>\n            <em id="homeTune">強化 Lv.0</em>\n          </div>'''
if s.count(bad)!=1:
    raise SystemExit(f'broken HOME machine copy marker count={s.count(bad)}')
s=s.replace(bad,good,1)
for required in ['id="homeCarName"','id="homeCarTrait"','id="homeTune"','id="homeMachineChange"']:
    if s.count(required)!=1:
        raise SystemExit(f'HOME machine contract failed: {required} count={s.count(required)}')
if '\x01' in s:
    raise SystemExit('control character U+0001 remains in index.html')
p.write_text(s)
print('HOME machine copy restored; control-character QA PASS')
