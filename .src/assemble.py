#!/usr/bin/env python3
"""把 .src/sec/* 拼回单文件 index.html。改完任意段落后跑一次即可。"""
import pathlib, sys

SEC = [
    '00_head.html',
    '01_data.js', '02_util.js', '03_icons.js', '04_state.js',
    '05_fx.js', '06_news.js', '07_sim.js', '08_actions.js', '08b_ai.js',
    '09_tutorial.js', '10_casino.js', '11_persist.js', '12_ui.js',
    '12b_views.js', '12c_charts.js', '12d_events.js',
]
root = pathlib.Path(__file__).parent
out = []
for name in SEC:
    f = root / 'sec' / name
    if not f.exists():
        sys.exit('missing section: ' + name)
    out.append(f.read_text().rstrip('\n'))
html = '\n'.join(out) + '\n'
target = root.parent / 'index.html'
target.write_text(html)
print(f'assembled {len(html)} bytes / {html.count(chr(10)) + 1} lines -> {target}')
