"""Offline integrity check for Crowns & Cards; standard Python 3 only."""
from html.parser import HTMLParser
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
errors = []
checked = set()


def check_local(path, label):
    path = path.strip().split('#', 1)[0].split('?', 1)[0]
    if not path or path.startswith(('http:', 'https:', 'data:', '#', '//')):
        return
    candidate = (ROOT / path).resolve()
    if not candidate.is_relative_to(ROOT) or not candidate.is_file():
        errors.append(f'{label}: отсутствует {path}')
    else:
        checked.add(candidate)


class References(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and 'src' in attrs:
            check_local(attrs['src'], 'index.html script')
        elif tag == 'link' and 'href' in attrs:
            check_local(attrs['href'], 'index.html link')
        elif tag == 'img' and 'src' in attrs:
            check_local(attrs['src'], 'index.html image')


References().feed((ROOT / 'index.html').read_text(encoding='utf-8'))
for css in (ROOT / 'css').glob('*.css'):
    contents = css.read_text(encoding='utf-8')
    for src in re.findall(r'url\(\s*[\'\"]?([^\)\'\"]+)', contents):
        check_local(str((css.parent / src).resolve().relative_to(ROOT)), f'{css.name} url')
for js in (ROOT / 'js').glob('*.js'):
    contents = js.read_text(encoding='utf-8')
    for path in set(re.findall(r'assets/[a-zA-Z0-9_/.-]+\.(?:webp|jpg|jpeg|png)', contents)):
        check_local(path, f'{js.name} image')

if errors:
    print('\n'.join(errors))
    raise SystemExit(1)
print(f'Проверка пройдена: {len(checked)} локальных файлов доступны.')
print('Эта проверка не заменяет запуск и тестирование игрового процесса в браузере.')
