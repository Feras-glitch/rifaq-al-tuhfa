# -*- coding: utf-8 -*-
"""9.39.11: إضافات المادة العلمية بقرار المالك، تُطبَّق على كل نسخ المنهج معًا (المصدر JSON، والتطبيق، والتجربة، والاستوديو):
- ق3-ب: أسئلة استخراج مختلطة بالرسم الإملائي (لا تُحل من علامات المصحف) تُلحق بآخر أسئلة الدروس s2، s3، s4، s5، s7.
  تحمل "recite": false فلا تدخل قائمة تسجيل الشيخ في الاستوديو (نصها إملائي لا عثماني).
- ق2-ب: بنك الاختبار المحجوز examQuestions لكل مفهوم (مجموعتان A/B) لا يظهر في الدروس.
المدخلات: curriculum/drafts/lesson_items_9.39.11.json و curriculum/drafts/exam_bank_9.39.11.json (مسودتان تنتظران مراجعة الشيخ، علامتهما needsSheikhReview).
قابل لإعادة التشغيل: كل سؤال يُضاف مرة واحدة (بمعرّفه). شغّله من جذر المستودع ثم tools/rebuild_html.py"""
import json, re, sys, os

SRC = 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'
APP = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
STUDIO = 'studio/استوديو_المشرف_v9.39.html'
LESSON = sys.argv[1] if len(sys.argv) > 1 else 'curriculum/drafts/lesson_items_9.39.11.json'
BANK = sys.argv[2] if len(sys.argv) > 2 else 'curriculum/drafts/exam_bank_9.39.11.json'

lesson = json.load(open(LESSON, encoding='utf-8'))['add']
bank = json.load(open(BANK, encoding='utf-8'))['bank'] if os.path.exists(BANK) else None

def apply(secs):
    by = {s['id']: s for s in secs}
    ids = {x['id'] for s in secs for x in (s.get('items') or []) + (s.get('questions') or []) + (s.get('examQuestions') or [])}
    added = 0
    for sid, qs in lesson.items():
        s = by[sid]
        for q in qs:
            if q['id'] in ids: continue
            q = dict(q); q['recite'] = False
            s['questions'].append(q); ids.add(q['id']); added += 1
    if bank is not None:
        for sid, qs in bank.items():
            s = by[sid]
            have = {q['id'] for q in s.get('examQuestions') or []}
            ex = s.setdefault('examQuestions', [])
            for q in qs:
                if q['id'] in have: continue
                assert q['id'] not in ids, 'id collision ' + q['id']
                ex.append(dict(q)); ids.add(q['id']); added += 1
    return added

def main():
    src = json.load(open(SRC, encoding='utf-8'))
    n = apply(src['sections'])
    src['meta']['additions_9_39_11'] = ('ق3-ب: ' + str(sum(len(v) for v in lesson.values())) + ' سؤال استخراج مختلط بالرسم الإملائي في الإظهار والإدغام والإقلاب والإخفاء والميم الساكنة '
        '(لا تُحل من علامات الضبط، وحكم عنوان الدرس لا يتجاوز نصف أجوبة الاستخراج في s3–s5)؛ '
        + ('ق2-ب: بنك اختبار محجوز examQuestions (مجموعتان A/B لكل مفهوم) لا يظهر في الدروس. ' if bank is not None else '')
        + 'كلها مسودة تنتظر مراجعة الشيخ قبل التوزيع.')
    open(SRC, 'w', encoding='utf-8').write(json.dumps(src, ensure_ascii=False, indent=1))
    print('source +', n)
    RX = re.compile(r'(var PACK_DATA = )(.*?)(;\n/\* ===PACK_DATA_END)', re.S)
    for f in APP:
        s = open(f, encoding='utf-8').read(); m = RX.search(s)
        pk = json.loads(m.group(2)); assert json.dumps(pk, ensure_ascii=False) == m.group(2)
        n = apply(pk['curriculum'])
        s = s[:m.start(2)] + json.dumps(pk, ensure_ascii=False) + s[m.end(2):]
        open(f, 'w', encoding='utf-8').write(s); print(f, '+', n)
    s = open(STUDIO, encoding='utf-8').read()
    m = re.search(r'^(var CURRICULUM = )(.*)(;)$', s, re.M)
    cur = json.loads(m.group(2)); assert json.dumps(cur, ensure_ascii=False) == m.group(2)
    n = apply(cur)
    s = s[:m.start(2)] + json.dumps(cur, ensure_ascii=False) + s[m.end(2):]
    open(STUDIO, 'w', encoding='utf-8').write(s); print(STUDIO, '+', n)

if __name__ == '__main__':
    main()
