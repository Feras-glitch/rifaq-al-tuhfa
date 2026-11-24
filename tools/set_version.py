# -*- coding: utf-8 -*-
"""يضبط رقم الإصدار: src/VERSION وحزمة أندرويد وملف قفلها وسطر «الإصدار الحالي» في README.md، ثم يبني التطبيق والاستوديو (tools/build.py).
التشغيل: python3 -I tools/set_version.py 9.40.0"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) != 2 or not re.fullmatch(r'\d+\.\d+(\.\d+)?', sys.argv[1]):
    sys.exit('usage: set_version.py X.Y.Z')
V = sys.argv[1]
open(os.path.join(ROOT, 'src', 'VERSION'), 'w', encoding='utf-8').write(V + '\n')
print('src/VERSION', V)
for pj in ['native/android/package.json', 'native/windows/package.json']:
    p = os.path.join(ROOT, pj)
    if not os.path.exists(p): continue
    raw = open(p, encoding='utf-8').read()
    raw2, n = re.subn(r'("version":\s*")[^"]*(")', lambda m: m.group(1) + V + m.group(2), raw, count=1)
    if n != 1: sys.exit('version not found in ' + pj)
    json.loads(raw2)
    if raw2 != raw: open(p, 'w', encoding='utf-8').write(raw2)
    print(pj, V)
    # 9.41.3: رقم الإصدار في ملف القفل يتبع package.json، فلا يختلفان ويرفض npm ci البناء
    lp = os.path.join(os.path.dirname(p), 'package-lock.json')
    if os.path.exists(lp):
        lraw = open(lp, encoding='utf-8').read(); L = json.loads(lraw)
        L['version'] = V; L['packages'][''].update(version=V)
        lraw2 = json.dumps(L, indent=2, ensure_ascii=False) + '\n'
        if lraw2 != lraw: open(lp, 'w', encoding='utf-8').write(lraw2)
        print(os.path.relpath(lp, ROOT), V)
# 9.41.1: README يذكر الإصدار الحالي، فيُحدَّث معه ولا يتقادم
rp = os.path.join(ROOT, 'README.md')
raw = open(rp, encoding='utf-8').read()
raw2, n = re.subn(r'(\*\*الإصدار الحالي: )[0-9.]+(\*\*)', lambda m: m.group(1) + V + m.group(2), raw, count=1)
if n != 1: sys.exit('version line not found in README.md')
if raw2 != raw: open(rp, 'w', encoding='utf-8').write(raw2)
print('README.md', V)
subprocess.check_call([sys.executable, '-I', os.path.join(ROOT, 'tools', 'build.py')])
