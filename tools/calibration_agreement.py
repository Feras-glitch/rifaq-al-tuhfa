# -*- coding: utf-8 -*-
"""9.39.15 (ق6-د): حساب الاتفاق في جلسة معايرة تقييم التلاوة (docs/RATING_CALIBRATION.md).
المدخل: ملف CSV بثلاثة أعمدة: المقيِّم, التسجيل, الدرجة.
  الدرجة: متقن | جيد | يحتاج تدريبًا | لا يصلح   (أو mastered | good | needs | unusable)
  المقيِّم «الشيخ» (أو sheikh) هو المرجع.
المخرج: لكل معلم: عدد الاتفاق التام مع الشيخ، وعدد الخلاف بفارق درجتين، وهل تحققت العتبة (6 من 8، ولا فارق درجتين)،
وقائمة كل خلاف ليُناقش. «لا يصلح» يُعدّ خلافًا إن لم يتفقا عليه، ولا يُحسب له فارق درجات.
التشغيل: python3 -I tools/calibration_agreement.py جلسة.csv [--need 6] [--of 8]"""
import csv, sys

LEVEL = {'متقن': 3, 'mastered': 3, 'جيد': 2, 'good': 2, 'يحتاج تدريبًا': 1, 'يحتاج تدريبا': 1, 'needs': 1, 'لا يصلح': 0, 'unusable': 0}
NAME = {3: 'متقن', 2: 'جيد', 1: 'يحتاج تدريبًا', 0: 'لا يصلح'}
REF = {'الشيخ', 'sheikh'}

def main():
    args = [a for a in sys.argv[1:]]
    need = int(args[args.index('--need') + 1]) if '--need' in args else 6
    of = int(args[args.index('--of') + 1]) if '--of' in args else 8
    path = [a for a in args if not a.startswith('--') and not a.isdigit()][0]
    grades = {}
    with open(path, encoding='utf-8-sig', newline='') as fh:
        for row in csv.reader(fh):
            if len(row) < 3 or not row[0].strip() or row[0].strip() in ('المقيِّم', 'المقيم', 'rater'): continue
            r, rec, g = row[0].strip(), row[1].strip(), row[2].strip()
            if g not in LEVEL: sys.exit('درجة غير معروفة: %s (%s، %s)' % (g, r, rec))
            grades.setdefault(r, {})[rec] = LEVEL[g]
    ref = next((r for r in grades if r in REF), None)
    if not ref: sys.exit('لا تقييم للشيخ في الملف (اسم المقيِّم «الشيخ»).')
    recs = sorted(grades[ref])
    if len(recs) != of: print('تنبيه: عدد تسجيلات الشيخ %d، والمتوقع %d.' % (len(recs), of))
    ok_all = True
    for r in sorted(grades):
        if r == ref: continue
        same = far = 0; diffs = []
        for rec in recs:
            a, b = grades[ref][rec], grades[r].get(rec)
            if b is None: diffs.append('%s: لم يُقيَّم' % rec); continue
            if a == b: same += 1; continue
            if a and b and abs(a - b) >= 2: far += 1
            diffs.append('%s: الشيخ %s، %s %s' % (rec, NAME[a], r, NAME[b]))
        passed = same >= need and far == 0
        ok_all = ok_all and passed
        print('%s: اتفاق تام %d من %d، وخلاف بفارق درجتين %d — %s' % (r, same, len(recs), far, 'تحققت العتبة ✅' if passed else 'لم تتحقق ❌'))
        for d in diffs: print('   - ' + d)
    print('النتيجة: ' + ('كل المعلمين جاهزون للتجربة.' if ok_all else 'ناقشوا الخلافات، وعدّلوا وصف الحكم، ثم أعيدوا الجلسة بتسجيلات جديدة.'))
    sys.exit(0 if ok_all else 2)

if __name__ == '__main__':
    main()
