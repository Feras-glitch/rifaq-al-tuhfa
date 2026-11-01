#!/usr/bin/env python3
"""يزامن ملفات الإطار (qx_core.js, qx_ui.js, qx.css) داخل تطبيق الطالب والاستوديو، ويعيد تضمين القالب في الاستوديو.
الاستخدام:  python3 sync_qx.py Student_App_vX.html Developer_Studio_vX.html
- يعدّل الملفين في مكانهما. شغّل بعده: node qx_validate.js منهجك.json
"""
import sys, re, base64, pathlib
here = pathlib.Path(__file__).parent
core = (here / 'qx_core.js').read_text(encoding='utf8'); ui = (here / 'qx_ui.js').read_text(encoding='utf8'); css = (here / 'qx.css').read_text(encoding='utf8')
app_p, studio_p = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
a = app_p.read_text(encoding='utf8')
c0, u0, s0 = a.index('/* ===== QX core'), a.index('/* ===== QX UI'), a.index('/* ===== Pack sanitisation')
a = a[:c0] + core + '\n' + ui + '\n' + a[s0:]
k0 = a.index('/* ===== QX: أنماط'); k1 = a.index('</style>', k0)
a = a[:k0] + css + a[k1:]
app_p.write_text(a, encoding='utf8')
d = studio_p.read_text(encoding='utf8', errors='surrogateescape')
d0 = d.index('/* ===== QX core'); d1 = d.index('function studioValidateCurriculum')
d = d[:d0] + core + d[d1:]
b64 = base64.b64encode(a.encode('utf8')).decode()
d, n = re.subn(r"(EMBEDDED_STUDENT_TEMPLATE_B64\s*=\s*')[A-Za-z0-9+/=]+(')", lambda m: m.group(1) + b64 + m.group(2), d); assert n == 1
studio_p.write_text(d, encoding='utf8', errors='surrogateescape')
print('تمت المزامنة: التطبيق والاستوديو (والقالب المضمّن).')
