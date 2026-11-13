# -*- coding: utf-8 -*-
"""يضبط رقم الإصدار في كل مكان دفعة واحدة: التطبيق ونسخة التجربة والاستوديو وحزمة أندرويد (وويندوز إن وُجدت).
tools/build_web.py يرفض البناء إن اختلف الرقم بينها. بعده: python3 -I tools/rebuild_html.py
التشغيل: python3 -I tools/set_version.py 9.39.13"""
import json, os, re, sys

if len(sys.argv) != 2 or not re.fullmatch(r'\d+\.\d+(\.\d+)?', sys.argv[1]):
    sys.exit('usage: set_version.py X.Y.Z')
V = sys.argv[1]
for f in ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html', 'studio/استوديو_المشرف_v9.39.html']:
    s = open(f, encoding='utf-8').read()
    s2, n = re.subn(r"var APP_VERSION = '[^']*';", "var APP_VERSION = '" + V + "';", s, count=1)
    if n != 1: sys.exit('APP_VERSION not found in ' + f)
    if s2 != s: open(f, 'w', encoding='utf-8').write(s2)
    print(f, V)
for pj in ['native/android/package.json', 'native/windows/package.json']:
    if not os.path.exists(pj): continue
    raw = open(pj, encoding='utf-8').read()
    raw2, n = re.subn(r'("version":\s*")[^"]*(")', lambda m: m.group(1) + V + m.group(2), raw, count=1)
    if n != 1: sys.exit('version not found in ' + pj)
    json.loads(raw2)
    if raw2 != raw: open(pj, 'w', encoding='utf-8').write(raw2)
    print(pj, V)
