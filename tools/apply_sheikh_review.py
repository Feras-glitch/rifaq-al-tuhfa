#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""يدمج ملف «مراجعة الشيخ» المصدَّر من الاستوديو في المنهج المصدر.

التشغيل:  python3 -I tools/apply_sheikh_review.py "مراجعة_الشيخ_….json" [--dry-run]
- لكل قرار يُعاد حساب بصمة نص الوحدة كما يحسبها الاستوديو. إن اختلفت (تغيّر النص بعد المراجعة) يُتخطّى القرار ويُذكر.
- «صحيح»: يُزال review = pending (ومعه prev إن وُجد: اعتُمدت الصيغة الجديدة)، ويُضاف reviewed = {by, at}.
- «يُحذف»: يُحذف السؤال من المنهج (المهام وأبيات المتن لا تُحذف آليًا؛ تُذكر في التقرير).
- «يحتاج تعديلًا»: لا يتغير شيء آليًا؛ يُكتب في تقرير docs/reviews/sheikh_review_<التاريخ>.md لينفّذه المطوّر ثم يعيد عرضه على الشيخ.
بعده: python3 -I tools/build.py (وأداة خط المصحف إن تغيّر نص قرآني)."""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUR = os.path.join(ROOT, 'curriculum', 'منهج_المرحلة1_كامل_معتمد_v1.3.json')
FIELDS = ['type', 'text', 'desc', 'question', 'options', 'answer', 'explanation', 'source', 'ayah', 'unit', 'pairs', 'pieces', 'sentence', 'distractors', 'items', 'extraRules', 'tolerance', 'hint']


def review_hash(s):
    """مطابقة reviewHash في src/studio/js/400_sheikh_review.js: FNV-1a على وحدات UTF-16"""
    h = 0x811c9dc5
    b = s.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) % 2 ** 32
    return '%08x' % h


def content(x):
    return json.dumps({f: x[f] for f in FIELDS if f in x}, ensure_ascii=False, separators=(',', ':'))


def units(C):
    for s in C['sections']:
        for it in s.get('items') or []:
            yield 'item:' + it['id'], s, 'items', it
        for key in ('questions', 'examQuestions'):
            for q in s.get(key) or []:
                yield 'q:' + q['id'], s, key, q


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    if len(args) != 1: sys.exit(__doc__)
    R = json.load(open(args[0], encoding='utf-8'))
    if R.get('type') != 'rifaq_sheikh_review' or R.get('v') != 1 or not isinstance(R.get('decisions'), dict):
        sys.exit('ليس ملف مراجعة شيخ صالحًا')
    who = str(R.get('reviewer') or '').strip()[:80]
    if not who: sys.exit('ملف المراجعة بلا اسم مراجع')
    day = str(R.get('exportedAt') or '')[:10] or 'unknown'
    C = json.load(open(CUR, encoding='utf-8'))
    U = {uid: (s, key, x) for uid, s, key, x in units(C)}
    ok = drop = 0; stale, missing, edits, drops_items = [], [], [], []
    for uid, d in R['decisions'].items():
        if uid not in U: missing.append(uid); continue
        s, key, x = U[uid]
        if not isinstance(d, dict) or d.get('d') not in ('ok', 'edit', 'drop'): continue
        if d.get('h') != review_hash(content(x)): stale.append(uid); continue
        note = str(d.get('note') or '').strip()
        if d['d'] == 'ok':
            x.pop('review', None); x.pop('prev', None)
            x['reviewed'] = {'by': who, 'at': day}
            ok += 1
        elif d['d'] == 'drop':
            if key == 'items': drops_items.append((uid, s['id'], note)); continue
            s[key] = [q for q in s[key] if q is not x]; drop += 1
            edits.append(('حذف', uid, s['id'], note))
        else:
            edits.append(('تعديل', uid, s['id'], note))
    log = C['meta'].setdefault('scientificReviewLog', [])
    log.append({'reviewer': who, 'date': day, 'approved': ok, 'deleted': drop, 'toEdit': sum(1 for e in edits if e[0] == 'تعديل'), 'stale': len(stale)})
    tot = sum(1 for _ in units(C)); rev = sum(1 for _, _, _, x in units(C) if x.get('reviewed'))
    C['meta']['scientificReviewCoverage'] = {'units': tot, 'reviewed': rev, 'pending': sum(1 for _, _, _, x in units(C) if x.get('review') == 'pending')}
    print('اعتُمد %d، حُذف %d، للتعديل %d، تغيّر نصه بعد المراجعة %d، غير موجود %d' % (ok, drop, sum(1 for e in edits if e[0] == 'تعديل'), len(stale), len(missing)))
    print('التغطية: %d من %d وحدة مراجَعة' % (rev, tot))
    if dry: print('(تجربة: لم يُكتب شيء)'); return
    open(CUR, 'w', encoding='utf-8').write(json.dumps(C, ensure_ascii=False, indent=1) + '\n')
    if edits or stale or drops_items or missing:
        os.makedirs(os.path.join(ROOT, 'docs', 'reviews'), exist_ok=True)
        p = os.path.join(ROOT, 'docs', 'reviews', 'sheikh_review_%s.md' % day)
        L = ['# مراجعة %s — %s' % (who, day), '', 'ما يحتاج عملًا من المطوّر بعد دمج المراجعة. بعد التنفيذ تُعرض الوحدات المعدَّلة على الشيخ مرة أخرى.', '']
        if edits:
            L += ['| القرار | الوحدة | القسم | ملاحظة الشيخ |', '|---|---|---|---|']
            L += ['| %s | `%s` | %s | %s |' % (a, u, sid, n.replace('|', '¦').replace('\n', ' ')) for a, u, sid, n in edits]
        if drops_items: L += ['', '## طلب حذف مهمة أو أبيات (لا يُنفَّذ آليًا)'] + ['- `%s` (%s): %s' % (u, sid, n) for u, sid, n in drops_items]
        if stale: L += ['', '## تغيّر نصها بعد المراجعة (تُعاد إلى الشيخ)'] + ['- `%s`' % u for u in stale]
        if missing: L += ['', '## غير موجودة في المنهج الحالي'] + ['- `%s`' % u for u in missing]
        open(p, 'w', encoding='utf-8').write('\n'.join(L) + '\n'); print('التقرير:', os.path.relpath(p, ROOT))


if __name__ == '__main__':
    main()
