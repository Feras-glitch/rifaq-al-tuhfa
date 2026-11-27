#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""9.40: بصمة وحدات مراجعة الشيخ في الاستوديو (JavaScript) تطابق بصمة أداة الدمج (Python) لكل وحدة في المنهج،
وأداة الدمج تطبّق القرارات كما ينبغي (اعتماد، حذف، تعديل، نص تغيّر) على نسخة مؤقتة من المنهج."""
import json, os, shutil, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import apply_sheikh_review as A  # noqa: E402
CUR = A.CUR
JS = os.path.join(ROOT, 'src', 'studio', 'js', '400_sheikh_review.js')
node = r'''
const fs = require('fs'), vm = require('vm');
const ctx = {CURRICULUM: JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).sections, studioSafeHTML: s => s, STATE: {}, log(){}, APP_VERSION: 'x'};
vm.createContext(ctx); vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);
const out = {}; ctx.reviewUnits().forEach(u => out[u.uid] = u.h); console.log(JSON.stringify(out));
'''
res = []
def rec(name, ok, detail=''):
    res.append(ok); print(('PASS' if ok else 'FAIL'), name, '|', str(detail)[:200])
js = json.loads(subprocess.check_output(['node', '-e', node, CUR, JS]).decode())
C = json.load(open(CUR, encoding='utf-8'))
py = {uid: A.review_hash(A.content(x)) for uid, _, _, x in A.units(C)}
diff = [k for k in py if js.get(k) != py[k]]
rec('S1 studio and merge tool agree on every unit fingerprint', not diff and set(js) == set(py) and len(py) > 300, (len(py), diff[:3]))
# الدمج على نسخة مؤقتة
tmp = tempfile.mkdtemp(); cur2 = os.path.join(tmp, 'cur.json'); shutil.copy(CUR, cur2)
pend = [(uid, x) for uid, _, key, x in A.units(C) if key == 'questions' and x.get('review') == 'pending' and x.get('prev')]
plain = [(uid, x) for uid, _, key, x in A.units(C) if key == 'questions' and x.get('review') == 'pending' and not x.get('prev')]
u_ok, u_drop, u_edit = pend[0], plain[0], plain[1]
dec = {u_ok[0]: {'d': 'ok', 'h': py[u_ok[0]], 'note': ''}, u_drop[0]: {'d': 'drop', 'h': py[u_drop[0]], 'note': 'مكرر'},
       u_edit[0]: {'d': 'edit', 'h': py[u_edit[0]], 'note': 'غيّر الخيار الثالث'}, plain[2][0]: {'d': 'ok', 'h': '00000000', 'note': ''}}
rv = os.path.join(tmp, 'r.json'); json.dump({'type': 'rifaq_sheikh_review', 'v': 1, 'reviewer': 'الشيخ المراجع', 'exportedAt': '2026-11-20T10:00:00Z', 'decisions': dec}, open(rv, 'w', encoding='utf-8'), ensure_ascii=False)
A.CUR = cur2; A.ROOT = tmp
sys.argv = ['x', rv]; A.main()
C2 = json.load(open(cur2, encoding='utf-8')); U2 = {uid: x for uid, _, _, x in A.units(C2)}
okq = U2.get(u_ok[0], {})
rec('S2 approval removes pending and prev, records reviewer', 'review' not in okq and 'prev' not in okq and okq.get('reviewed') == {'by': 'الشيخ المراجع', 'at': '2026-11-20'}, okq.get('reviewed'))
rec('S3 deletion removes the question', u_drop[0] not in U2)
rec('S4 edit and stale fingerprint change nothing', U2[u_edit[0]].get('review') == 'pending' and U2[plain[2][0]].get('review') == 'pending')
rep = open(os.path.join(tmp, 'docs', 'reviews', 'sheikh_review_2026-11-20.md'), encoding='utf-8').read()
rec('S5 report lists the edit note and the stale unit', 'غيّر الخيار الثالث' in rep and plain[2][0] in rep)
shutil.rmtree(tmp)
# S6: الواجهة في الاستوديو المبني نفسه: فتح المراجعة دون إعداد، قرار، رفض «تعديل» بلا ملاحظة، تصدير ملف يقبله الدمج
try:
    from playwright.sync_api import sync_playwright
    studio = os.path.join(ROOT, 'studio', 'استوديو_المشرف.html')
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(accept_downloads=True); errs = []; dialogs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: (dialogs.append(d.message), d.accept()))
        pg.goto('file://' + studio); pg.wait_for_timeout(800)
        pg.click('[data-call=\'["openSheikhReview"]\']'); pg.wait_for_timeout(300)
        pg.select_option('#rv-section', 's6_ghunna'); pg.fill('#rv-reviewer', 'الشيخ المراجع'); pg.dispatch_event('#rv-reviewer', 'change')
        cards = pg.query_selector_all('.rv-card'); n0 = len(cards)
        cards[0].query_selector('[data-call*="ok"]').click(); pg.wait_for_timeout(150)
        pg.query_selector_all('.rv-card')[1].query_selector('[data-call*="edit"]').click(); pg.wait_for_timeout(150)
        no_note = len(dialogs) == 1 and not pg.evaluate("reviewLoad().decisions['q:' + document.querySelectorAll('.rv-card')[1].dataset.uid.slice(2)]")
        with pg.expect_download() as dl:
            pg.click('[data-call=\'["exportSheikhReview"]\']')
        out = os.path.join(tempfile.mkdtemp(), 'r.json'); dl.value.save_as(out); b.close()
    R = json.load(open(out, encoding='utf-8'))
    good = R['reviewer'] == 'الشيخ المراجع' and len(R['decisions']) == 1 and all(d['h'] == py.get(u) for u, d in R['decisions'].items())
    rec('S6 studio review screen: decide, note required for edits, export accepted by the merge tool', n0 >= 10 and no_note and good and not errs, (n0, dialogs, R.get('coverage'), errs[:2]))
except Exception as e:
    rec('S6 (exception)', False, repr(e)[:200])
print('SUMMARY:', sum(res), '/', len(res))
sys.exit(0 if all(res) else 1)
