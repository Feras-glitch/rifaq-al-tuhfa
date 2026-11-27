# -*- coding: utf-8 -*-
"""يستخرج السكربت المضمَّن من التطبيق والاستوديو المبنيين، وينسخ سكربتات الموقع، إلى مجلد يفحصه ESLint.
التشغيل: python3 -I tools/lint/extract_scripts.py <مجلد الإخراج>   (بعد tools/build.py وtools/build_web.py _site)"""
import os, re, shutil, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for name, src in (('app.js', 'app/تطبيق_الطالب_والمعلم.html'), ('studio.js', 'studio/استوديو_المشرف.html')):
    html = open(os.path.join(ROOT, src), encoding='utf-8').read()
    parts = re.findall(r'<script>(.*?)</script>', html, flags=re.S)
    assert parts, 'no inline script in ' + src
    # بيانات الحزمة والخطوط سطور طويلة لا تفيد الفحص؛ تبقى كما هي حتى تطابق أرقام الأسطر الملف المبني
    open(os.path.join(out, name), 'w', encoding='utf-8').write('\n'.join(parts))
    print(name, sum(len(p) for p in parts))
for f in ('web/host.js', 'web/launcher.js', '_site/sw.js'):
    p = os.path.join(ROOT, f)
    if os.path.exists(p): shutil.copy2(p, os.path.join(out, os.path.basename(f))); print(os.path.basename(f))
