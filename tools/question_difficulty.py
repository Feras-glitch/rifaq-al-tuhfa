# -*- coding: utf-8 -*-
"""تقرير صعوبة الأسئلة من النسخ الاحتياطية التي ترسلها الأسر طوعًا (9.42).
يقرأ سجل الإجابات (respLog) من ملف أو أكثر، ويرتّب الأسئلة بنسبة الخطأ في المحاولة الأولى لكل طفل.
يفيد التجربة الميدانية ومراجعة الشيخ: سؤال يخطئ فيه أغلب الأطفال إما صعب وإما صياغته ملتبسة.
لا خادم ولا تتبّع: الملفات تصل يدويًا، ولا يُطبع اسم أي طفل.

التشغيل: python3 -I tools/question_difficulty.py نسخة1.json [نسخة2.json ...] [--min 3] [--csv out.csv]
  --min N   أقل عدد من الأطفال أجابوا عن السؤال ليدخل التقرير (الافتراضي 3)"""
import argparse, collections, csv, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUR = os.path.join(ROOT, 'curriculum', 'منهج_المرحلة1_كامل_معتمد_v1.3.json')

def titles():
    t = {}
    try:
        c = json.load(open(CUR, encoding='utf-8'))
        for s in c.get('sections', []):
            for q in s.get('questions', []): t[q['id']] = (s.get('title', ''), str(q.get('text', ''))[:70], q.get('type', ''))
    except Exception: pass
    return t

def first_attempts(path):
    """لكل سؤال: نتيجة أول مرة أجاب فيها هذا الطفل (اختبار الدرس وحده، k == 'L')"""
    b = json.load(open(path, encoding='utf-8'))
    if b.get('type') != 'rifaq_backup': raise ValueError('ليس نسخة احتياطية من رفاق التحفة: ' + os.path.basename(path))
    seen = {}
    for r in (b.get('state') or {}).get('respLog') or []:
        if r.get('k') != 'L' or not r.get('q'): continue
        seen.setdefault(str(r['q']), 1 if r.get('c') else 0)
    return seen

def report(paths, min_children=3):
    agg = collections.defaultdict(lambda: [0, 0]); children = 0
    for p in paths:
        fa = first_attempts(p); children += 1
        for q, ok in fa.items(): agg[q][0] += 1; agg[q][1] += (0 if ok else 1)
    T = titles(); rows = []
    for q, (n, wrong) in agg.items():
        if n < min_children: continue
        sec, text, typ = T.get(q, ('', '', ''))
        rows.append({'question': q, 'section': sec, 'type': typ, 'children': n, 'wrong_first': wrong, 'wrong_pct': round(100.0 * wrong / n), 'text': text})
    rows.sort(key=lambda r: (-r['wrong_pct'], -r['children'], r['question']))
    return children, rows

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('files', nargs='+'); ap.add_argument('--min', type=int, default=3); ap.add_argument('--csv')
    a = ap.parse_args()
    children, rows = report(a.files, a.min)
    print('الأطفال: %d | الأسئلة التي أجاب عنها %d أطفال فأكثر: %d' % (children, a.min, len(rows)))
    print('| نسبة الخطأ أول مرة | أخطأ / أجاب | السؤال | الدرس | النص |\n|---|---|---|---|---|')
    for r in rows[:40]: print('| %d%% | %d / %d | %s | %s | %s |' % (r['wrong_pct'], r['wrong_first'], r['children'], r['question'], r['section'], r['text']))
    if a.csv:
        with open(a.csv, 'w', encoding='utf-8-sig', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=['question', 'section', 'type', 'children', 'wrong_first', 'wrong_pct', 'text']); w.writeheader(); w.writerows(rows)
        print('CSV:', a.csv)

if __name__ == '__main__':
    main()
