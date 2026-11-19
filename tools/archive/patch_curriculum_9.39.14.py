# -*- coding: utf-8 -*-
"""9.39.14 (D5): كل سؤال لم يراجعه الشيخ يحمل review = pending، فيُخفى على الموقع الرئيسي ويظهر في /beta/.
- الأسئلة الإملائية المختلطة في الدروس (mx_*، 33) من 9.39.11.
- البنك المحجوز examQuestions (80) من 9.39.11.
- (أسئلة الإدغام الـ12 المحوّلة في 9.39.13 تحمل العلامة منذئذ، ومعها صيغتها السابقة.)
حين يراجع الشيخ سؤالًا يُحذف منه review (ومعه prev). يُطبَّق على المنهج المصدر ونسختي التطبيق والاستوديو. قابل لإعادة التشغيل."""
import json, re

SRC = 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'
APP = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
STUDIO = 'studio/استوديو_المشرف_v9.39.html'

def mark(secs):
    n = 0
    for s in secs:
        for q in s.get('questions') or []:
            if str(q.get('id', '')).startswith('mx_') and q.get('review') != 'pending':
                q['review'] = 'pending'; n += 1
        for q in s.get('examQuestions') or []:
            if q.get('review') != 'pending':
                q['review'] = 'pending'; n += 1
    return n

def count(secs):
    return sum(1 for s in secs for q in (s.get('questions') or []) + (s.get('examQuestions') or []) if q.get('review') == 'pending')

def main():
    src = json.load(open(SRC, encoding='utf-8'))
    n = mark(src['sections'])
    src['meta']['review_9_39_14'] = ('D5: كل سؤال لم يراجعه الشيخ يحمل review = pending: الإملائية المختلطة (33) والبنك المحجوز (80) '
        'وأسئلة الإدغام المحوّلة (12). تُخفى على الموقع الرئيسي وتظهر في /beta/. المراجعة تحذف العلامة.')
    open(SRC, 'w', encoding='utf-8').write(json.dumps(src, ensure_ascii=False, indent=1)); print(SRC, n, 'pending total', count(src['sections']))
    RX = re.compile(r'(var PACK_DATA = )(.*?)(;\n/\* ===PACK_DATA_END)', re.S)
    for f in APP:
        s = open(f, encoding='utf-8').read(); m = RX.search(s)
        pk = json.loads(m.group(2)); assert json.dumps(pk, ensure_ascii=False) == m.group(2)
        n = mark(pk['curriculum'])
        open(f, 'w', encoding='utf-8').write(s[:m.start(2)] + json.dumps(pk, ensure_ascii=False) + s[m.end(2):]); print(f, n, count(pk['curriculum']))
    s = open(STUDIO, encoding='utf-8').read()
    m = re.search(r'^(var CURRICULUM = )(.*)(;)$', s, re.M)
    cur = json.loads(m.group(2)); assert json.dumps(cur, ensure_ascii=False) == m.group(2)
    n = mark(cur)
    open(STUDIO, 'w', encoding='utf-8').write(s[:m.start(2)] + json.dumps(cur, ensure_ascii=False) + s[m.end(2):]); print(STUDIO, n, count(cur))

if __name__ == '__main__':
    main()
