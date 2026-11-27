# -*- coding: utf-8 -*-
"""يلخّص تقرير ESLint (JSON): عدد المشاكل لكل ملف وقاعدة، وأول الأمثلة. يكتب تنبيهات تظهر في صفحة التشغيل على GitHub.
التشغيل: python3 -I tools/lint/summarize.py report.json"""
import collections, json, os, sys
rep = json.load(open(sys.argv[1], encoding='utf-8'))
tot_e = tot_w = 0
for f in rep:
    name = os.path.basename(f['filePath']); msgs = f.get('messages', [])
    e = sum(1 for m in msgs if m.get('severity') == 2); w = len(msgs) - e; tot_e += e; tot_w += w
    rules = collections.Counter(m.get('ruleId') or 'parse' for m in msgs)
    print('%s: %d errors, %d warnings %s' % (name, e, w, dict(rules)))
    for m in [m for m in msgs if m.get('severity') == 2][:12]:
        print('   %s:%s %s (%s)' % (name, m.get('line'), m.get('message'), m.get('ruleId')))
    if msgs:
        ex = '; '.join('%s@%s %s' % (m.get('ruleId') or 'parse', m.get('line'), str(m.get('message'))[:70]) for m in [m for m in msgs if m.get('severity') == 2][:6])
        print('::%s title=ESLint %s::%d errors, %d warnings. %s' % ('error' if e else 'warning', name, e, w, ex))
print('TOTAL: %d errors, %d warnings' % (tot_e, tot_w))
if not tot_e and not tot_w: print('::notice title=ESLint::clean')
