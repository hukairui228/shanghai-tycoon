#!/usr/bin/env python3
"""把 .src/game/* 按文件名顺序拼成根目录的 index.html（新版商战）。"""
import pathlib, sys
root = pathlib.Path(__file__).parent
files = sorted((root / 'game').glob('*'))
if len(sys.argv) > 1:
    files = [f for f in files if not f.name.startswith('90_')] + [pathlib.Path(sys.argv[1])]
parts = [f.read_text().rstrip('\n') for f in files if f.suffix in ('.html', '.js')]
html = '\n'.join(parts) + '\n})();\n</script>\n'
out = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else root.parent / 'index.html'
out.write_text(html)
print(f'assembled {len(html)} bytes / {html.count(chr(10)) + 1} lines -> {out}')
