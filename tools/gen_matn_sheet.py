# -*- coding: utf-8 -*-
"""9.39.16 (ق4): ورقة مراجعة ضبط المتن للشيخ، مولَّدة من المنهج، قبل جلسة التسجيل بيتًا بيتًا.
تُطبع وتُعلَّم: لكل بيت «الضبط معتمد» أو التعديل المطلوب. الأبيات مرقمة كما يرقمها الاستوديو (البيت 1 إلى 61).
التشغيل: python3 -I tools/gen_matn_sheet.py   ← docs/MATN_REVIEW_SHEET.md"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = json.load(open(os.path.join(ROOT, 'curriculum', 'منهج_المرحلة1_كامل_معتمد_v1.3.json'), encoding='utf-8'))
ASK = {'فَالطَّبِيعِيُّ': 'يُسأل الشيخ: «فَالطَّبِيعِيُّ» أم «فَالطَّبِيعِيَّ» (خبر «يكون» مقدَّمًا)؟ أغلب الطبعات المعروفة بالنصب، وهذا من الذاكرة لا من مصدر مفتوح.'}

def plain(t):
    return re.sub(r'<[^>]+>', '', t).strip()

out = ['# ورقة مراجعة ضبط المتن (تحفة الأطفال، 61 بيتًا)', '',
       '> **الغرض (قرار ق4):** يعتمد الشيخ ضبط كل بيت أولًا، ثم يسجّله في الجلسة نفسها، فيطابق الصوت النص المعتمد.',
       '> **التسجيل:** في الاستوديو، مجموعة «المتن»، زر «🎙️ سجّل البيت التالي». الأبيات مرقمة هنا كما في الاستوديو.',
       '> **مولَّدة من المنهج** بالأداة `tools/gen_matn_sheet.py`. أي تعديل في الضبط يُكتب في المنهج، ثم تُولَّد الورقة من جديد.', '',
       '**إرشادات التسجيل:**',
       '- غرفة هادئة، والهاتف على بعد شبر.',
       '- إيقاع إنشاد ثابت في كل الأبيات.',
       '- نصف ثانية صمت في أول كل تسجيل وآخره.',
       '- البيت الواحد يستغرق 5 إلى 10 ثوانٍ تقريبًا.', '']
n = 0; asks = []
for s in C['sections']:
    for it in s['items']:
        if it.get('type') != 'poem': continue
        verses = [v.strip() for v in re.split(r'<br\s*/?>', it['text']) if v.strip()]
        out.append('## %s' % s['title']); out.append('')
        out.append('| البيت | الصدر | العجز | ✓ معتمد | التعديل |'); out.append('|---|---|---|---|---|')
        for v in verses:
            n += 1
            parts = [p.strip() for p in re.split(r'\s{2,}', plain(v)) if p.strip()]
            a, b = (parts + ['', ''])[:2] if len(parts) >= 2 else (plain(v), '')
            out.append('| %d | %s | %s | ☐ | |' % (n, a, b))
            for k, msg in ASK.items():
                if k in v: asks.append('- **البيت %d:** %s' % (n, msg))
        out.append('')
out.append('## أسئلة للشيخ')
out.extend(asks or ['- لا شيء.'])
out.append('')
out.append('المجموع: %d بيتًا.' % n)
open(os.path.join(ROOT, 'docs', 'MATN_REVIEW_SHEET.md'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('docs/MATN_REVIEW_SHEET.md', n, 'verses,', len(asks), 'questions')
assert n == 61, n
