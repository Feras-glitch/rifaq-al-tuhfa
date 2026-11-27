# -*- coding: utf-8 -*-
"""9.42: تقدّم الطفل لا يضيع بلا هجوم من أحد.
  D1 نافذتان مفتوحتان للطفل نفسه: القديمة لا تكتب فوق تقدّم الجديدة، بل تتحدّث
  D2 حالة تالفة في التخزين: تُعرض استعادة اللقطة التلقائية، والاستعادة تعيد التقدّم
  D3 لقطة فيها تقدّم لا تُستبدل بحالة فارغة
  D4 حذف بيانات الطفل يحذف اللقطة والحالة التالفة المحفوظة معها
كل حالة جُرّبت على 9.41.3 قبل الإصلاح (مراجعة الخصم الشاملة).
التشغيل: python3 -I tests/test_data_safety.py"""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(ROOT, 'app', 'تطبيق_الطالب_والمعلم.html'), encoding='utf-8').read()
TMP = tempfile.mkdtemp(prefix='rifaq_safety_')
APP = os.path.join(TMP, 'app.html'); open(APP, 'w', encoding='utf-8').write(SRC); APP = 'file://' + APP
R = []
def rec(n, ok, d=''):
    R.append((n, bool(ok))); print(('PASS' if ok else 'FAIL'), n, '|', str(d)[:400], flush=True)

async def open_page(ctx, url=APP):
    pg = await ctx.new_page(); await pg.set_viewport_size({'width': 390, 'height': 820})
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(url); await pg.wait_for_timeout(900); return pg

async def new_child(ctx, name='فرح'):
    pg = await open_page(ctx)
    await pg.evaluate("continueFromSplash()"); await pg.wait_for_timeout(250)
    await pg.fill('#setup-name', name); await pg.evaluate("saveSetup()"); await pg.wait_for_timeout(350)
    return pg

DONE = "STATE.progress.s0_muqaddima = {stars: 3, bestStars: 3, attempts: 1, bestScore: 40}; STATE.progress.s1_noon_tanween = {stars: 2, bestStars: 2, attempts: 1, bestScore: 30}; recalcStats(); save()"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        fresh = lambda: b.new_context(bypass_csp=True, locale='ar')

        # D1
        ctx = await fresh(); A = await new_child(ctx); B = await open_page(ctx)
        await A.evaluate(DONE)
        wrote = await B.evaluate("(() => { STATE.progress.s9_x = {stars: 1, bestStars: 1, attempts: 1, bestScore: 10}; return save(); })()")
        await B.wait_for_timeout(1500)
        b_now = await B.evaluate("Object.keys(STATE.progress).sort()")
        await A.reload(); await A.wait_for_timeout(800); a_now = await A.evaluate("Object.keys(STATE.progress).sort()")
        await ctx.close()
        rec('D1 a stale window does not overwrite newer progress; it refreshes instead',
            wrote is False and a_now == ['s0_muqaddima', 's1_noon_tanween'] and b_now == a_now, (wrote, a_now, b_now))

        # D2 (اللقطة تؤخذ من آخر حالة محفوظة عند أول حفظ في يوم جديد؛ نحاكي يومًا سابقًا)
        ctx = await fresh(); A = await new_child(ctx); await A.evaluate(DONE)
        await A.evaluate("(() => { takeSnapshot(true); var k = snapKey(STORAGE_KEY), s = JSON.parse(localStorage.getItem(k)); s.day = '2026-01-01'; localStorage.setItem(k, JSON.stringify(s)); localStorage.setItem(STORAGE_KEY, localStorage.getItem(STORAGE_KEY).slice(0, 200)); })()")
        await A.reload(); await A.wait_for_timeout(1500)
        offer = await A.evaluate("[!document.getElementById('modal').classList.contains('hidden'), document.getElementById('modal-body').textContent.includes('فرح'), STATE.student.name, !!localStorage.getItem(STORAGE_KEY + '_corrupt')]")
        await A.click('#modal-actions button.success'); await A.wait_for_timeout(1500)
        back = await A.evaluate("[STATE.student.name, Object.keys(STATE.progress).length, [...document.querySelectorAll('[id^=view-]:not(.hidden)')].map(v => v.id).join()]")
        await ctx.close()
        rec('D2 unreadable saved state: the automatic snapshot is offered, and restoring it brings the progress back',
            offer == [True, True, '', True] and back[0] == 'فرح' and back[1] == 2 and 'view-home' in back[2], (offer, back))

        # D3
        ctx = await fresh(); A = await new_child(ctx); await A.evaluate(DONE)
        r = await A.evaluate("""(() => { var k = snapKey(STORAGE_KEY), old = function(){ var s = JSON.parse(localStorage.getItem(k)); s.day = '2026-01-01'; localStorage.setItem(k, JSON.stringify(s)); SNAP_CHECKED = ''; };
            takeSnapshot(true); STATE.progress = {}; STATE.respLog = []; STATE.studentAudios = {}; save();   // الحالة المحفوظة صارت فارغة، واللقطة فيها درسان
            old(); save(); old(); save();                                                                  // أيام لاحقة: الحالة الفارغة لا تحل محل اللقطة
            var s2 = JSON.parse(localStorage.getItem(k)); return [s2.day, Object.keys(JSON.parse(s2.raw).progress).length]; })()""")
        await ctx.close()
        rec('D3 a snapshot holding progress is not replaced by an emptied state', r == ['2026-01-01', 2], r)

        # D4
        ctx = await fresh(); A = await new_child(ctx); await A.evaluate(DONE)
        r = await A.evaluate("""async () => { takeSnapshot(true); localStorage.setItem(STORAGE_KEY + '_corrupt', 'x'); var k = STORAGE_KEY;
            await deleteDbFully(DB_NAME, STORAGE_KEY); return [k, k + '_rev', k + '_snap', k + '_corrupt'].map(x => localStorage.getItem(x) === null); }""")
        await ctx.close()
        rec("D4 deleting the child's data removes the snapshot with it", r == [True, True, True, True], r)
        await b.close()
    passed = sum(1 for r in R if r[1]); print('\nSUMMARY: %d / %d' % (passed, len(R)))
    sys.exit(0 if passed == len(R) else 1)

asyncio.run(main())
