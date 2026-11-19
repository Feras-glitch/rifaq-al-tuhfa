# -*- coding: utf-8 -*-
"""9.39.12: تصحيحان في نصوص المنهج، يطبَّقان على كل نسخه معًا (المصدر، والتطبيق، والتجربة، والاستوديو، والمسودتان):
- I1: «الكلمة الغامقة» صارت «الكلمة الملوّنة». الكلمة المسؤول عنها تُبرز الآن بلون وخلفية،
  لأن الآية كلها تُعرض بخط ثقيل فلا يميّزها الوزن وحده.
- S1: النص الإملائي في 65 سؤالًا كتبه المشروع وقابله بنص تنزيل، وليس نص تنزيل نفسه. وشروط تنزيل تمنع نسبة نص معدَّل إليه.
  لذلك تغيّرت نسبة المصدر من «(نص تنزيل، بالرسم الإملائي)» إلى «(رسم إملائي، قوبل بنص تنزيل)».
قابل لإعادة التشغيل. شغّله من جذر المستودع ثم tools/rebuild_html.py"""
import json, re

SRC = 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'
APP = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
STUDIO = 'studio/استوديو_المشرف_v9.39.html'
DRAFTS = ['curriculum/drafts/lesson_items_9.39.11.json', 'curriculum/drafts/exam_bank_9.39.11.json']

WORDING = [('الكلمتين الغامقتين', 'الكلمتين الملوّنتين'), ('الكلمة الغامقة', 'الكلمة الملوّنة'), ('الحرف الغامق', 'الحرف الملوّن')]
OLD_SRC, NEW_SRC = '(نص تنزيل، بالرسم الإملائي)', '(رسم إملائي، قوبل بنص تنزيل)'

def fix_q(q):
    n = 0
    if isinstance(q.get('question'), str):
        t = q['question']
        for a, b in WORDING: t = t.replace(a, b)
        if t != q['question']: q['question'] = t; n += 1
    if isinstance(q.get('source'), str) and OLD_SRC in q['source']:
        q['source'] = q['source'].replace(OLD_SRC, NEW_SRC); n += 1
    return n

def fix_sections(secs):
    return sum(fix_q(q) for s in secs for q in (s.get('questions') or []) + (s.get('examQuestions') or []))

def main():
    src = json.load(open(SRC, encoding='utf-8'))
    n = fix_sections(src['sections'])
    src['meta']['fixes_9_39_12'] = ('«الكلمة الغامقة» صارت «الكلمة الملوّنة» في 91 سؤالًا، والكلمة تُبرز بلون وخلفية. '
        'والنص الإملائي في 65 سؤالًا يُنسب «(رسم إملائي، قوبل بنص تنزيل)» لا «نص تنزيل»، لأن تنزيل يمنع نسبة نص معدَّل إليه.')
    open(SRC, 'w', encoding='utf-8').write(json.dumps(src, ensure_ascii=False, indent=1)); print(SRC, n)
    RX = re.compile(r'(var PACK_DATA = )(.*?)(;\n/\* ===PACK_DATA_END)', re.S)
    for f in APP:
        s = open(f, encoding='utf-8').read(); m = RX.search(s)
        pk = json.loads(m.group(2)); assert json.dumps(pk, ensure_ascii=False) == m.group(2)
        n = fix_sections(pk['curriculum'])
        open(f, 'w', encoding='utf-8').write(s[:m.start(2)] + json.dumps(pk, ensure_ascii=False) + s[m.end(2):]); print(f, n)
    s = open(STUDIO, encoding='utf-8').read()
    m = re.search(r'^(var CURRICULUM = )(.*)(;)$', s, re.M)
    cur = json.loads(m.group(2)); assert json.dumps(cur, ensure_ascii=False) == m.group(2)
    n = fix_sections(cur)
    open(STUDIO, 'w', encoding='utf-8').write(s[:m.start(2)] + json.dumps(cur, ensure_ascii=False) + s[m.end(2):]); print(STUDIO, n)
    for f in DRAFTS:
        raw = open(f, encoding='utf-8').read(); d = json.loads(raw)
        groups = d.get('add') or d.get('bank') or {}
        n = sum(fix_q(q) for qs in groups.values() for q in qs)
        ind = 1 if raw.startswith('{\n ') and not raw.startswith('{\n  ') else 2
        open(f, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=ind) + ('\n' if raw.endswith('\n') else '')); print(f, n)

if __name__ == '__main__':
    main()
