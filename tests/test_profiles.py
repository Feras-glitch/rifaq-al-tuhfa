# -*- coding: utf-8 -*-
"""9.41.3: ملفات الأطفال على جهاز واحد لا يمسح بعضها بعضًا، والشهادة تُطبع، والأبيات لا تُقصّ.
كل حالة هنا مسار كان يمسح تقدّم طفل أو يخفيه (من مراجعة خارجية، وجُرّب قبل الإصلاح):
  P1 استعادة نسخة احتياطية داخل ملف إهداء ثم إعادة الفتح
  P2 طفل غيّر اسمه بعد الإرسال ثم فتح ملف الإعادة من المعلم
  P3 ملف إرسال قديم (بلا معرّف) لطفل آخر يُفتح على جهاز الطفل
  P4 ملف إرسال حديث لطفل آخر على الجهاز نفسه (كان يبدّل الملف النشط فيفتح تطبيق الطفل فارغًا)
  P5 ملف إرسال الطفل نفسه يفتحه وليّه على جهازه
  P6 ملف إعادة قديم (بلا معرّف) لأخ على جهاز مشترك (يُفتح ملفه هو، ومرة بعد مرة)
الملفات نسخ من التطبيق المبني بنوع حزمة آخر؛ تُفتح بتجاوز سياسة المحتوى لأن تعديل الحزمة يغيّر بصمة السكربت.
التشغيل: python3 -I tests/test_profiles.py"""
import asyncio, os, sys, tempfile
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = open(os.path.join(ROOT, 'app', 'تطبيق_الطالب_والمعلم_v9.39.html'), encoding='utf-8').read()
TMP = tempfile.mkdtemp(prefix='rifaq_profiles_')
R = []
def rec(n, ok, d=''):
    R.append((n, bool(ok))); print(('PASS' if ok else 'FAIL'), n, '|', str(d)[:400], flush=True)

def variant(name, ptype, sid='', sname='', pid=None, extra=''):
    s = SRC
    for a, b in (('"packageType": "student_fresh"', '"packageType": "%s"' % ptype), ('"studentName": ""', '"studentName": "%s"' % sname),
                 ('"studentId": ""', '"studentId": "%s"' % sid), ('"packageId": "pack_s34"', '"packageId": "%s"%s' % (pid or 'pack_s34', extra))):
        assert s.count(a) >= 1, a
        s = s.replace(a, b, 1)
    p = os.path.join(TMP, name); open(p, 'w', encoding='utf-8').write(s)
    return 'file://' + p

STATE_JS = "(() => [STATE.student.name, Object.keys(STATE.progress).length, STATE.role, [...document.querySelectorAll('[id^=view-]:not(.hidden)')].map(v => v.id).join()])()"

async def open_page(ctx, url, w=390):
    pg = await ctx.new_page(); await pg.set_viewport_size({'width': w, 'height': 820})
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(url); await pg.wait_for_timeout(700); return pg

async def new_child(ctx, url, name):
    pg = await open_page(ctx, url)
    if await pg.evaluate("!document.getElementById('view-splash').classList.contains('hidden')"):
        await pg.evaluate("continueFromSplash()"); await pg.wait_for_timeout(250)
    await pg.fill('#setup-name', name); await pg.evaluate("saveSetup()"); await pg.wait_for_timeout(350)
    await pg.evaluate("STATE.progress.s0_muqaddima = {stars: 3, bestStars: 3, attempts: 1, bestScore: 40}; save()")
    return pg

async def main():
    APP = variant('app.html', 'student_fresh')
    GIFT = variant('gift.html', 'approved_gift', pid='pack_gift_t', extra=', "approved": true')
    async with async_playwright() as p:
        b = await p.chromium.launch()
        fresh = lambda: b.new_context(bypass_csp=True, locale='ar', accept_downloads=True)

        # P1
        ctx = await fresh(); pg = await new_child(ctx, GIFT, 'فرح')
        async with pg.expect_download() as dl: await pg.evaluate("makeBackup(false)")
        bk = open(await (await dl.value).path(), encoding='utf-8').read()  # الملف الذي ينزّله التطبيق فعلًا
        await pg.evaluate("localStorage.clear()"); await pg.close()
        pg = await open_page(ctx, GIFT); await pg.evaluate("b => applyRestore(JSON.parse(b))", bk); await pg.wait_for_timeout(1500); await pg.close()
        pg = await open_page(ctx, GIFT); v = await pg.evaluate(STATE_JS); await ctx.close()
        rec('P1 backup restored inside a gift file survives reopening', v[0] == 'فرح' and v[1] == 1 and 'view-home' in v[3], v)

        # P2
        ctx = await fresh(); pg = await new_child(ctx, APP, 'فرح'); sid = await pg.evaluate("STATE.student.id")
        await pg.evaluate("STATE.student.name = 'فرح فراس'; save()"); await pg.close()
        pg = await open_page(ctx, variant('ret_same.html', 'student_returned', sid, 'فرح')); r = await pg.evaluate(STATE_JS); await pg.close()
        pg = await open_page(ctx, APP); a = await pg.evaluate(STATE_JS); await ctx.close()
        rec('P2 child renamed after sending: the teacher\'s returned file keeps progress and the new name', r[0] == 'فرح فراس' and r[1] == 1 and 'view-tf' in r[3] and a[:2] == ['فرح فراس', 1], (r, a))

        # P3 + P4 + P5 على جهاز واحد
        ctx = await fresh(); pg = await new_child(ctx, APP, 'دلال'); sid = await pg.evaluate("STATE.student.id"); await pg.close()
        out = []
        for name, url in (('legacy', variant('sub_legacy.html', 'student_submission', '', 'علي')),
                          ('modern', variant('sub_other.html', 'student_submission', 'stu_other1', 'علي')),
                          ('own', variant('sub_own.html', 'student_submission', sid, 'دلال'))):
            pg = await open_page(ctx, url); t = await pg.evaluate(STATE_JS + ".concat([document.getElementById('review-student-name').textContent])"); await pg.close()
            pg = await open_page(ctx, APP); c = await pg.evaluate(STATE_JS); await pg.close()
            out.append((name, t, c))
        await ctx.close()
        ok = all('view-teacher-review' in t[3] and c[:3] == ['دلال', 1, 'student'] and 'view-home' in c[3] for _, t, c in out)
        rec('P3–P5 a submission opened on the child\'s device (old, another child\'s, or her own) opens for review and leaves her app as it was', ok, out)

        # P6 ملف إعادة قديم (بلا معرّف) لأخ على جهاز مشترك: يُفتح ملفه هو، ولا يُمسّ ملف أخته، وإعادة فتحه تعود إلى ملفه لا إلى ملف فارغ جديد
        ctx = await fresh(); pg = await new_child(ctx, APP, 'دلال'); did = await pg.evaluate("STATE.student.id"); await pg.close()
        RET = variant('ret_legacy.html', 'student_returned', '', 'علي')
        pg = await open_page(ctx, RET); r1 = await pg.evaluate(STATE_JS)
        await pg.evaluate("STATE.student.name = 'علي'; STATE.progress.s0_muqaddima = {stars: 2, bestStars: 2, attempts: 1, bestScore: 30}; save()")
        dal = await pg.evaluate("id => { var k = keysForId(id).s, x = JSON.parse(localStorage.getItem(k) || '{}'); return [x.student && x.student.name, Object.keys(x.progress || {}).length]; }", did)
        await pg.evaluate("id => localStorage.setItem(ACTIVE_ID_KEY, id)", did); await pg.close()   # دلال تختار ملفها
        pg = await open_page(ctx, APP); a1 = await pg.evaluate(STATE_JS); await pg.close()
        pg = await open_page(ctx, RET); r2 = await pg.evaluate(STATE_JS); n = await pg.evaluate("Object.keys(idMap()).length"); await pg.close()
        await ctx.close()
        rec('P6 an old returned file for a sibling opens his own profile, again on reopening, and never touches his sister\'s',
            r1[2] == 'student' and dal == ['دلال', 1] and a1[:2] == ['دلال', 1] and r2[:2] == ['علي', 1] and n == 2, (r1, dal, a1, r2, n))

        # P7 الشهادة: العنوان بحسب الحال، والصورة من اللحظة، والطباعة تُظهرها
        ctx = await fresh(); pg = await new_child(ctx, APP, 'فرح')
        await pg.evaluate("document.querySelectorAll('#consent-overlay').forEach(e => e.remove()); LAST_CERT_BLOB = new Blob(['old']); showCertificate()")
        t1 = await pg.evaluate("[document.querySelector('#certificate-card .cert-title').textContent, LAST_CERT_BLOB === null, buildCertData().title]")
        await pg.evaluate("STATE.assess = STATE.assess || {}; STATE.assess.concepts = {}; realSections().forEach(function(s){ STATE.assess.concepts[s.id] = {mastered: true}; }); showCertificate()")
        t2 = await pg.evaluate("document.querySelector('#certificate-card .cert-title').textContent")
        await pg.evaluate("document.body.classList.add('printing-cert')"); await pg.emulate_media(media='print')
        vis = await pg.evaluate("[getComputedStyle(document.getElementById('certificate-card')).visibility, getComputedStyle(document.querySelector('#cert-name')).visibility]")
        await ctx.close()
        rec('P7 certificate: «تقدّم» before mastery and «إتقان» after, fresh image each time, visible when printed',
            t1 == ['شهادة تقدّم', True, 'شهادة تقدّم'] and t2 == 'شهادة إتقان' and vis == ['visible', 'visible'], (t1, t2, vis))

        # P8 الأبيات على أضيق الهواتف
        ctx = await fresh(); pg = await new_child(ctx, APP, 'فرح'); await pg.set_viewport_size({'width': 320, 'height': 800}); await pg.wait_for_timeout(200)
        cut = await pg.evaluate("""() => { document.querySelectorAll('#consent-overlay').forEach(e => e.remove()); var bad = [], n = 0;
          realSections().forEach(function(s){ openSection(s.id); document.querySelectorAll('#lesson-content .lesson-card').forEach(function(x){ x.classList.remove('hidden'); x.style.display = 'block'; });
            document.querySelectorAll('#lesson-content .poem-verse .v-a, #lesson-content .poem-verse .v-b').forEach(function(e){ n++; var r = e.getBoundingClientRect(), c = e.closest('.content-text').getBoundingClientRect();
              if (r.left < c.left - 1 || r.right > c.right + 1) bad.push(s.id); }); });
          return [n, bad.length]; }""")
        await ctx.close()
        rec('P8 no verse half is cut off on a 320-pixel phone', cut[0] >= 100 and cut[1] == 0, cut)

        # P9 شاشة مراجعة المعلم بلا زر يخرج إلى خريطة طالب فارغة
        ctx = await fresh(); pg = await open_page(ctx, variant('sub_x.html', 'student_submission', 'stu_x', 'علي'))
        x = await pg.evaluate("[!!document.querySelector('#view-teacher-review [data-call*=goHome]'), document.querySelector('#view-teacher-review .notice.info').textContent]")
        await ctx.close()
        rec('P9 teacher review has no exit to an empty student map, and states voice or written comment', not x[0] and 'صوتي أو كتابي' in x[1], x)
        await b.close()
    passed = sum(1 for r in R if r[1]); print('\nSUMMARY: %d / %d' % (passed, len(R)))
    sys.exit(0 if passed == len(R) else 1)

asyncio.run(main())
