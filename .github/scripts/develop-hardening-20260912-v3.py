from pathlib import Path
src = Path('.github/scripts/develop-hardening-20260912-v2.py').read_text(encoding='utf-8')
exec(compile(src, '.github/scripts/develop-hardening-20260912-v2.py', 'exec'), {'__name__':'__main__'})
