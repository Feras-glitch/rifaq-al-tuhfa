# -*- coding: utf-8 -*-
"""يولّد docs/TEACHER_RUBRIC.md من curriculum/rating_criteria_9.39.15.json، فلا تختلف الوثيقة عما يراه المعلم في التطبيق.
التشغيل: python3 -I tools/gen_rubric_doc.py   (ثم tools/patch_app_9.39.15.py يضمّن الملف نفسه في التطبيق)"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = json.load(open(os.path.join(ROOT, 'curriculum', 'rating_criteria_9.39.15.json'), encoding='utf-8'))
CUR = json.load(open(os.path.join(ROOT, 'curriculum', 'منهج_المرحلة1_كامل_معتمد_v1.3.json'), encoding='utf-8'))
items = {it['id']: (s['title'], it) for s in CUR['sections'] for it in s['items']}

def cell(t):
    return str(t).replace('|', '\\|')

out = []
out.append('# دليل المعلم لتقييم التلاوة (الإصدار 9.39.15، قرار ق6)')
out.append('')
out.append('> **' + C['meta']['status'] + '.** هذه الوثيقة مولَّدة من `curriculum/rating_criteria_9.39.15.json` بالأداة `tools/gen_rubric_doc.py`، والتطبيق يعرض النص نفسه للمعلم عند التقييم. أي تعديل يُكتب في ملف JSON، ثم تُولَّد الوثيقة ويُبنى التطبيق.')
out.append('')
out.append('## المقياس')
for k in ('mastered', 'good', 'needs', 'unusable'):
    out.append('- ' + C['meta']['scale'][k])
out.append('')
out.append('«لم يُطبَّق» في الإصدارات السابقة صارت «يحتاج تدريبًا»، وتُرحَّل آليًا في الملفات القديمة.')
out.append('')
out.append('## وحدة التقييم: الحكم المحوري')
for n in C['meta']['notes']:
    out.append('- ' + n)
out.append('- في شاشة المراجعة يظهر الحكم المحوري لكل تسجيل، وموضعه مظللًا في الآية (إلا فواتح السور)، ومعاييره تحت «📏 معايير التقييم».')
out.append('- علامات «ملاحظة على حكم آخر»: ' + '، '.join(C['other'].values()) + '. تصل الطفل تنبيهًا تحت تسجيله.')
out.append('')
out.append('## شرط شهادة «الإتقان التام»')
out.append('كل المفاهيم متقنة في الاختبار، وتقييم موثّق من معلم مسجَّل، ولا «يحتاج تدريبًا» في أي حكم محوري. «جيد» يكفي (قرار ق6-هـ). «لا يصلح للتقييم» ليس تقييمًا، فلا يُحسب.')
out.append('')
out.append('## معايير كل حكم')
out.append('| الحكم | ما يُصغى إليه | ✅ متقن | 👍 جيد | 🔁 يحتاج تدريبًا |')
out.append('|---|---|---|---|---|')
for code, r in C['rules'].items():
    out.append('| **%s** | %s | %s | %s | %s |' % (cell(r['label']), cell(r['listen']), cell(r['mastered']), cell(r['good']), cell(r['needs'])))
out.append('')
out.append('## مهام التسجيل الـ%d وحكمها المحوري' % len(C['tasks']))
out.append('| المهمة | الدرس | الحكم المحوري | الموضع (من سطر «مهمتك») |')
out.append('|---|---|---|---|')
for tid, code in C['tasks'].items():
    title, it = items[tid]
    phr = re.findall(r'«([^»]+)»', re.sub(r'<br>.*', '', it.get('desc', '')))
    out.append('| `%s` | %s | %s | %s |' % (tid, cell(title), cell(C['rules'][code]['label']), cell('، '.join('«%s»' % p for p in phr))))
out.append('')
out.append('## للشيخ: نقاط تحتاج قراره')
out.append('- **الإخفاء الشفوي:** إطباق خفيف أم فرجة يسيرة؟ المعيار يقول «على الوجه الذي يعتمده الشيخ».')
out.append('- **المد المتصل والمنفصل والصلة الكبرى:** أربع أم خمس حركات؟ المعيار يقبل الاثنين ويطلب التسوية بين المتصل والمنفصل.')
out.append('- **مد اللين عند الوقف:** حركتان أم أربع أم ست، أم كلها مقبولة؟ المعيار يقبلها كلها بمقدار ثابت.')
out.append('- **صياغة كل خانة:** تُعتمد كما هي، أو تُعدَّل في ملف JSON.')
out.append('')
out.append('## قواعد للاتساق بين المعلمين')
out.append('1. قيّم الحكم المحوري وحده بالمعيار المكتوب، لا بالانطباع العام عن التلاوة.')
out.append('2. عند الشك بين درجتين، اختر الأدنى منهما.')
out.append('3. الملاحظة المكتوبة تذكر الحكم والخطوة التالية في جملة واحدة (مثال: «الغنة قصيرة، أطيلي الغنة في الميم»).')
out.append('4. قبل التجربة الميدانية: جلسة معايرة (`docs/RATING_CALIBRATION.md`).')
out.append('')
out.append('## بنك الملاحظات الجاهز (ما يظهر في التطبيق)')
out.append('الغنة قصيرة · المد أقل من المطلوب · الإدغام غير واضح · الإظهار غير واضح · الإقلاب يحتاج تكرارًا · الإخفاء ثقيل، خففي الغنة · المخرج غير دقيق · أحسنتِ، أعيدي الحكم بتركيز أكبر')
out.append('')
out.append('## مدة المراجعة')
out.append('- حد موصى به: 10 تسجيلات في الجلسة.')
out.append('- الرد خلال 48 ساعة. التطبيق ينبّه عند التجاوز.')
open(os.path.join(ROOT, 'docs', 'TEACHER_RUBRIC.md'), 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print('docs/TEACHER_RUBRIC.md', len(C['rules']), 'rules,', len(C['tasks']), 'tasks')
