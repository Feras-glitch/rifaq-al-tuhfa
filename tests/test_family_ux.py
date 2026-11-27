# -*- coding: utf-8 -*-
"""9.42: ما يراه الطفل وولي الأمر والمعلم، وما يُنزَّل أول مرة (من مراجعة الخصم الشاملة).
  F1 بعد إدخال الاسم: بطاقة قصيرة للطفل لا نموذج قانوني    F2 النموذج خلف بوابة ولي الأمر، وزرّاه ظاهران كاملين
  F3 قفل الرمز لا يصفّره «إلغاء» وإعادة الفتح              F4 استعادة الرمز تترك أثرًا في الإعدادات
  F5 الإعدادات: النسخ قبل الحذف، ودليل الانتقال، ومفتاح الخروج  F6 الخريطة: زر الإرسال، ومدخل ولي الأمر، و«ملفي» ظاهر دائمًا
  F7 تنبيه آيفون داخل التطبيق                              F8 تكبير الخط يُحفظ ولا يقصّ الأبيات
  F9 «من يتعلّم الآن؟» على جهاز فيه طفلان                   F10 «عندي نسخة احتياطية» في شاشة الإعداد
  F11 سجل الأعطال يصل النسخة الاحتياطية والإعدادات
  T1 مراجعة المعلم: قائمة مطوية وانتقال تلقائي للملفات الكبيرة   T2 والملف الصغير كما كان
  P1 التخزين المسبق بلا تكرار ولا استوديو                  P2 التطبيق وقالب المضيفة يعملان دون إنترنت   P3 الاستوديو يعمل دون إنترنت بعد أول فتح
التشغيل: python3 -I tests/test_family_ux.py"""
import asyncio, json, os, re, subprocess, sys, tempfile
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8794; BASE = 'http://127.0.0.1:%d' % PORT
SITE = tempfile.mkdtemp(prefix='rifaq_family_site_')
R = []
def rec(n, ok, d=''):
    R.append((n, bool(ok))); print(('PASS' if ok else 'FAIL'), n, '|', str(d)[:420], flush=True)

VIEW = "[...document.querySelectorAll('[id^=view-]:not(.hidden)')].map(v => v.id).join()"
CONSENT = """async () => { await setGuardianPin('2580'); STATE.student.consent = {v: CONSENT_VERSION, guardian: 'أبو فرح', at: new Date().toISOString(), permissions: {record: true, review: true, shareWithPeers: false}, excludedRecordings: {}}; save(); }"""
IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

async def page(ctx, url='/app/', w=390, h=780):
    pg = await ctx.new_page(); await pg.set_viewport_size({'width': w, 'height': h})
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(BASE + url); await pg.wait_for_timeout(900); return pg

async def child(ctx, name='فرح', dismiss=True, consent=False):
    pg = await page(ctx)
    await pg.evaluate("continueFromSplash()"); await pg.wait_for_timeout(250)
    await pg.fill('#setup-name', name); await pg.evaluate("saveSetup()"); await pg.wait_for_timeout(700)
    if dismiss and await pg.locator('#consent-intro-no').count(): await pg.click('#consent-intro-no')
    if consent: await pg.evaluate(CONSENT)
    return pg

async def solve_gate(pg):
    q = await pg.inner_text('#parent-gate-q'); m = re.findall(r'\d+', q)
    await pg.fill('#parent-gate-answer', str(int(m[0]) * int(m[1]))); await pg.click('#parent-gate-ok'); await pg.wait_for_timeout(350)

async def main():
    subprocess.check_call([sys.executable, '-I', os.path.join(ROOT, 'tools', 'build_web.py'), SITE], stdout=subprocess.DEVNULL)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '-d', SITE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1.2)
    try:
      async with async_playwright() as p:
        b = await p.chromium.launch()
        fresh = lambda **k: b.new_context(locale='ar', service_workers='block', accept_downloads=True, **k)

        # F10 + F1 + F2
        ctx = await fresh(); pg = await page(ctx)
        await pg.evaluate("continueFromSplash()"); await pg.wait_for_timeout(250)
        hb = await pg.evaluate("[!document.getElementById('btn-have-backup').classList.contains('hidden'), CALLABLE_ALLOW.indexOf('restoreBackupPick') >= 0]")
        await pg.fill('#setup-name', 'فرح'); await pg.evaluate("saveSetup()"); await pg.wait_for_timeout(800)
        f1 = await pg.evaluate("[!!document.getElementById('consent-intro'), !!document.getElementById('consent-overlay'), document.getElementById('consent-intro').innerText.trim().split(/\\s+/).length, %s]" % VIEW)
        rec('F10 first-run setup offers «عندي نسخة احتياطية»', hb == [True, True], hb)
        rec('F1 after entering the name the child sees a short card, not the legal form', f1[0] and not f1[1] and f1[2] <= 30 and 'view-home' in f1[3], f1)
        await pg.click('#consent-intro-yes'); await pg.wait_for_timeout(300)
        gated = await pg.evaluate("[!!document.getElementById('parent-gate-q'), !!document.getElementById('consent-overlay')]")
        await solve_gate(pg)
        box = await pg.evaluate("(() => { var o = document.getElementById('consent-ok').getBoundingClientRect(), n = document.getElementById('consent-no').getBoundingClientRect(); return [Math.round(o.top), Math.round(o.bottom), Math.round(n.bottom), innerHeight, o.height >= 40]; })()")
        await pg.fill('#consent-name', 'أبو فرح'); await pg.fill('#consent-pin', '2580'); await pg.fill('#consent-pin2', '2580')
        await pg.check('#consent-record'); await pg.check('#consent-review'); await pg.click('#consent-ok'); await pg.wait_for_timeout(500)
        done = await pg.evaluate("[hasConsent(), guardianPinSet(), !!document.getElementById('consent-overlay')]")
        rec('F2 the consent form is behind the guardian gate, its two buttons fully on screen, and it saves',
            gated == [True, False] and box[0] >= 0 and box[1] <= box[3] and box[2] <= box[3] and box[4] and done == [True, True, False], (gated, box, done))

        # F3
        await pg.evaluate("openGuardianSettings()"); await pg.wait_for_timeout(250)
        for w in ('1357', '1358', '1359'):
            await pg.fill('#parent-gate-pin', w); await pg.click('#parent-gate-ok'); await pg.wait_for_timeout(200)
        l1 = await pg.evaluate("document.getElementById('parent-gate-ok').disabled")
        await pg.click('#parent-gate-cancel'); await pg.evaluate("openGuardianSettings()"); await pg.wait_for_timeout(250)
        l2 = await pg.evaluate("[document.getElementById('parent-gate-ok').disabled, document.getElementById('parent-gate-msg').textContent]")
        await pg.reload(); await pg.wait_for_timeout(900); await pg.evaluate("openGuardianSettings()"); await pg.wait_for_timeout(250)
        l3 = await pg.evaluate("document.getElementById('parent-gate-ok').disabled")
        rec('F3 the PIN lock survives «إلغاء», reopening, and a page reload', l1 and l2[0] and 'انتظر' in l2[1] and l3, (l1, l2, l3))
        await pg.evaluate("pinFailClear(); document.getElementById('parent-gate').remove()")

        # F4 + F5
        await pg.evaluate("STATE.student.pinResetAt = '2026-11-20T10:00:00.000Z'; save(); openGuardianSettings()"); await pg.wait_for_timeout(250)
        await pg.fill('#parent-gate-pin', '2580'); await pg.click('#parent-gate-ok'); await pg.wait_for_timeout(350)
        f4 = await pg.evaluate("[!!document.getElementById('gs-pin-reset'), (document.getElementById('gs-pin-reset') || {}).textContent || '']")
        order = await pg.evaluate("""(() => { var f = (a, b) => !!(document.getElementById(a).compareDocumentPosition(document.getElementById(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
            return [f('gs-summary', 'gs-backup-box'), f('gs-backup-box', 'gs-share'), f('gs-share', 'gs-delete'), f('gs-backup', 'gs-delete'), !!document.getElementById('gs-move')]; })()""")
        await pg.click('#gs-move'); await pg.wait_for_timeout(200)
        guide = await pg.evaluate("[!!document.getElementById('move-guide'), document.querySelectorAll('#move-guide li').length, document.getElementById('move-guide').getAttribute('role')]")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        esc1 = await pg.evaluate("[!!document.getElementById('move-guide'), !!document.getElementById('guardian-overlay')]")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        esc2 = await pg.evaluate("!!document.getElementById('guardian-overlay')")
        rec('F4 a PIN reset through «نسيت الرمز» is shown to the guardian', f4[0] and '2026-11-20' in f4[1], f4)
        rec('F5 guardian settings: reports, then backup, then sharing, delete last; move-device guide; Escape closes one layer at a time',
            order == [True, True, True, True, True] and guide == [True, 4, 'dialog'] and esc1 == [False, True] and esc2 is False, (order, guide, esc1, esc2))

        # F6
        f6a = await pg.evaluate("[!!document.getElementById('home-send-btn'), !!document.getElementById('ios-install-hint')]")
        await pg.evaluate("STATE.studentAudios.s0_x = {status: 'pending', rid: 'r1'}; STATE.studentAudios.s0_y = {status: 'pending', rid: 'r2', sentAt: '2026-11-01'}; save(); goHome()"); await pg.wait_for_timeout(250)
        f6 = await pg.evaluate("""[(document.getElementById('home-send-btn') || {}).textContent || '', document.getElementById('home-guardian-btn').offsetParent !== null,
            getComputedStyle(document.querySelector('#view-home .top-actions')).position, document.getElementById('modal').getAttribute('role'), document.getElementById('feedback-box').getAttribute('aria-live')]""")
        await pg.click('#home-send-btn'); await pg.wait_for_timeout(250)
        m_open = await pg.evaluate("!document.getElementById('modal').classList.contains('hidden')")
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        m_closed = await pg.evaluate("document.getElementById('modal').classList.contains('hidden')")
        rec('F6 home: «أرسل لمعلمك» appears only with unsent recordings, guardian entry is on the map, «ملفي» stays on screen',
            f6a == [False, False] and '(1)' in f6[0] and f6[1] and f6[2] == 'sticky' and f6[3] == 'dialog' and f6[4] == 'polite' and m_open and m_closed, (f6a, f6, m_open, m_closed))

        # F11
        await pg.evaluate("logClientError('boom-test', 'https://x/y/app.js:12')")
        async with pg.expect_download() as dl: await pg.evaluate("makeBackup(false)")
        bk = json.load(open(await (await dl.value).path(), encoding='utf-8'))
        await pg.evaluate("openGuardianSettings()"); await pg.wait_for_timeout(250); await pg.fill('#parent-gate-pin', '2580'); await pg.click('#parent-gate-ok'); await pg.wait_for_timeout(350)
        eb = await pg.evaluate("(document.getElementById('gs-errlog') || {}).textContent || ''")
        rec('F11 a client error is kept on the device, travels with the backup, and is reachable from guardian settings',
            any(e.get('m') == 'boom-test' and e.get('w') == 'app.js:12' for e in bk.get('errlog', [])) and '(1)' in eb, (bk.get('errlog'), eb))
        await pg.evaluate("document.getElementById('guardian-overlay').remove()")

        # F8
        await pg.evaluate("showProfile(); toggleBigText()"); await pg.wait_for_timeout(150)
        b1 = await pg.evaluate("[document.documentElement.classList.contains('big-text'), document.getElementById('btn-big-text').getAttribute('aria-pressed'), parseFloat(getComputedStyle(document.documentElement).fontSize)]")
        await pg.set_viewport_size({'width': 360, 'height': 760}); await pg.reload(); await pg.wait_for_timeout(1000)
        cut = await pg.evaluate("""() => { var bad = 0, n = 0; realSections().forEach(function(s){ openSection(s.id); document.querySelectorAll('#lesson-content .lesson-card').forEach(function(x){ x.classList.remove('hidden'); x.style.display = 'block'; });
            document.querySelectorAll('#lesson-content .poem-verse .v-a, #lesson-content .poem-verse .v-b').forEach(function(e){ n++; var r = e.getBoundingClientRect(), c = e.closest('.content-text').getBoundingClientRect(); if (r.left < c.left - 1 || r.right > c.right + 1) bad++; }); });
            return [document.documentElement.classList.contains('big-text'), n, bad, document.documentElement.scrollWidth > innerWidth + 1]; }""")
        rec('F8 «تكبير الخط» enlarges text, is remembered after reload, and clips no verse at 360 px', b1[0] and b1[1] == 'true' and b1[2] > 18 and cut[0] and cut[1] >= 100 and cut[2] == 0 and not cut[3], (b1, cut))
        await pg.evaluate("toggleBigText()"); await pg.close()

        # F9
        pg = await page(ctx)
        one = await pg.evaluate("!!document.getElementById('profile-chooser')")
        await pg.evaluate("(() => { switchStudentProfile('دلال', newStudentId()); STATE.student.name = 'دلال'; STATE.student.id = CURRENT_PROFILE_ID; STATE.sawSplash = true; STATE.role = 'student'; save(); })()"); await pg.close()
        pg = await page(ctx)
        ch = await pg.evaluate("[[...document.querySelectorAll('#profile-chooser .pc-child')].map(b => b.lastChild.textContent.trim()).sort(), STATE.student.name]")
        await pg.locator('#profile-chooser .pc-child', has_text='فرح').click(); await pg.wait_for_timeout(1500)
        after = await pg.evaluate("[STATE.student.name, !!document.getElementById('profile-chooser'), %s]" % VIEW)
        await pg.reload(); await pg.wait_for_timeout(900)
        again = await pg.evaluate("[STATE.student.name, !!document.getElementById('profile-chooser')]")
        await ctx.close()
        rec('F9 «من يتعلّم الآن؟» lists both children on a shared device, switches with one tap, and asks once per session',
            one is False and ch == [['دلال', 'فرح'], 'دلال'] and after[0] == 'فرح' and not after[1] and 'view-home' in after[2] and again == ['فرح', False], (one, ch, after, again))

        # F7
        ctx = await fresh(user_agent=IPHONE, has_touch=True, is_mobile=True); pg = await child(ctx)
        i1 = await pg.evaluate("[!!document.getElementById('ios-install-hint'), (document.getElementById('ios-install-hint') || {}).textContent || '']")
        await pg.click('#ios-install-hint button'); await pg.wait_for_timeout(150); await pg.reload(); await pg.wait_for_timeout(900)
        i2 = await pg.evaluate("!!document.getElementById('ios-install-hint')")
        await pg.evaluate("localStorage.setItem(IOS_HINT_KEY, String(Date.now() - 4 * 86400000)); goHome()"); await pg.wait_for_timeout(150)
        i3 = await pg.evaluate("!!document.getElementById('ios-install-hint')")
        await ctx.close()
        rec('F7 on iPhone outside the home screen the app itself warns about Safari clearing data; «فهمت» hides it for three days', i1[0] and 'الشاشة الرئيسية' in i1[1] and not i2 and i3, (i1, i2, i3))

        # T1 + T2
        ctx = await fresh(); pg = await page(ctx, w=390, h=780)
        mk = """n => { var ids = []; CURRICULUM.forEach(function(s){ (s.items || []).forEach(function(i){ ids.push(i.id); }); }); ids = ids.slice(0, n);
              PACK_DATA.studentAudios = {}; ids.forEach(function(id){ PACK_DATA.studentAudios[id] = {audio: 'data:audio/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYU4BnQI0VSalmQCgq17FAAw9CQE2AQAZ3aGFtbXlXQUAGd2hhbW15RIlACECPQAAAAAAAFlSua0AxrkAu14EBY8WBAZyBACK1nEADdW5khkAFVl9WUDglhohAA1ZQOIOBAeBABrCBCLqBCB9DtnVAIueBAKNAHIEAAIAwAQCdASoIAAgAAUAmJaQAA3AA/vz0AAA=', status: 'pending'}; });
              PACK_DATA.studentName = 'علي'; REVIEW_OPEN = null; REVIEW_FILTER = 'all'; showTeacherReview(); document.getElementById('review-teacher-name').value = 'المعلم'; return ids; }"""
        ids = await pg.evaluate(mk, 9); await pg.wait_for_timeout(300)
        t0 = await pg.evaluate("[document.querySelectorAll('#review-list .review-item').length, document.querySelectorAll('#review-list .review-item.collapsed').length, document.querySelectorAll('#review-list audio').length, document.querySelectorAll('#review-list button').length, document.getElementById('review-progress').textContent, document.querySelector('#review-list .review-item:not(.collapsed)').getAttribute('data-item')]")
        await pg.click('#review-list .review-item:not(.collapsed) .review-actions .btn.success'); await pg.wait_for_timeout(350)
        t1 = await pg.evaluate("[document.getElementById('review-progress').textContent, document.querySelector('#review-list .review-item:not(.collapsed)').getAttribute('data-item'), PACK_DATA.studentAudios[%s].status]" % json.dumps(ids[0]))
        await pg.locator('#review-list .review-item.collapsed .head').nth(4).click(); await pg.wait_for_timeout(250)
        t2 = await pg.evaluate("[document.querySelectorAll('#review-list .review-item:not(.collapsed)').length, document.querySelector('#review-list .review-item:not(.collapsed)').getAttribute('data-item')]")
        await pg.evaluate("reviewFilter('pending')"); await pg.wait_for_timeout(200)
        t3 = await pg.evaluate("document.querySelectorAll('#review-list .review-item').length")
        rec('T1 a large submission shows a collapsed list with one recording open, moves to the next unreviewed after a decision, and filters the unreviewed',
            t0[:3] == [9, 8, 1] and t0[3] <= 22 and t0[4] == 'روجع 0 من 9' and t0[5] == ids[0] and t1 == ['روجع 1 من 9', ids[1], 'approved'] and t2[0] == 1 and t2[1] not in (ids[0], ids[1]) and t3 == 8, (t0, t1, t2, t3))
        await pg.evaluate(mk, 3); await pg.wait_for_timeout(300)
        s = await pg.evaluate("[document.querySelectorAll('#review-list .review-item').length, document.querySelectorAll('#review-list .review-item.collapsed').length, !!document.getElementById('review-tools'), document.querySelectorAll('#review-list audio').length]")
        await ctx.close()
        rec('T2 a small submission keeps the full layout', s == [3, 0, False, 3], s)

        # P1
        sw = open(os.path.join(SITE, 'sw.js'), encoding='utf-8').read()
        pre = json.loads(re.search(r'const PRECACHE = (\[.*?\]);', sw, re.S).group(1))
        size = sum(os.path.getsize(os.path.join(SITE, u[2:])) for u in pre)
        rec('P1 precache holds the student app page and host template only, no studio or trial, no duplicate short paths (was 10.8 MB)',
            './app/index.html' in pre and './app/template.txt' in pre and not [u for u in pre if 'studio' in u or 'trial' in u or u.endswith('/app/')] and size < 3.4 * 1024 * 1024, (len(pre), round(size / 1048576, 2)))

        # P2 + P3
        ctx = await b.new_context(locale='ar'); pg = await ctx.new_page(); await pg.goto(BASE + '/index.html')
        for _ in range(60):
            await pg.wait_for_timeout(250)
            if await pg.evaluate("(async () => { var r = await navigator.serviceWorker.getRegistration(); if (!r || !r.active || r.active.state !== 'activated') return false; var k = await caches.keys(); if (!k.length) return false; return !!(await caches.match('./app/index.html')); })()"): break
        await pg.reload(); await pg.wait_for_timeout(600)
        await ctx.set_offline(True)
        await pg.goto(BASE + '/app/'); await pg.wait_for_timeout(900)
        off_app = await pg.evaluate("typeof STATE !== 'undefined' && document.querySelectorAll('[id^=view-]:not(.hidden)').length > 0")
        await pg.goto(BASE + '/index.html'); await pg.wait_for_timeout(300)
        tpl = await pg.evaluate("fetch('./app/template.txt').then(r => r.text()).then(t => [t.length > 1000000, t.indexOf('PACK_DATA_START') > 0], e => [String(e)])")
        # الاستوديو: لا نسخة له في المخزن قبل أول فتح (وضع «دون إنترنت» في بعض إصدارات المتصفح لا يقطع طلبات عامل الخدمة، فنفحص المخزن نفسه)
        HAS = "(async () => !!(await caches.match(new URL('./studio/', location.href).href)) || !!(await caches.match(new URL('./studio/index.html', location.href).href)))()"
        st_before = await pg.evaluate(HAS)
        await ctx.set_offline(False); await pg.goto(BASE + '/studio/'); await pg.wait_for_timeout(1500)
        await pg.goto(BASE + '/index.html'); await pg.wait_for_timeout(300); st_cached = await pg.evaluate(HAS)
        await ctx.set_offline(True); await pg.goto(BASE + '/studio/'); await pg.wait_for_timeout(700)
        st_after = await pg.evaluate("document.title")
        await ctx.close()
        rec('P2 offline: the student app opens from /app/ and the host template is served from the cache', off_app and tpl == [True, True], (off_app, tpl))
        rec('P3 the studio is not downloaded up front; after one online visit it is cached and opens offline', st_before is False and st_cached is True and 'استوديو' in st_after, (st_before, st_cached, st_after))
        await b.close()
    finally:
        srv.terminate()
    passed = sum(1 for r in R if r[1]); print('\nSUMMARY: %d / %d' % (passed, len(R)))
    sys.exit(0 if passed == len(R) else 1)

asyncio.run(main())
