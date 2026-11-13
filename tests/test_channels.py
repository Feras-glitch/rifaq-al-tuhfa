# -*- coding: utf-8 -*-
"""9.39.14: الموقع الرئيسي والنسخة التجريبية (/beta/) على أصل واحد، كما يُنشران.
D8: القناة في كل ملف، وتخزين الطفل وذاكرة «الأخيرة» منفصلان، ولكل منهما عامل خدمة ومخزن لا يمسح الآخر.
D5: الرئيسي يخفي كل سؤال لم يراجعه الشيخ (review = pending)، ويعيد المحوَّل إلى صيغته السابقة؛ والتجريبي يعرض كل شيء.
التشغيل: python3 -I tests/test_channels.py   (يبني الموقعين بنفسه في مجلد مؤقت)"""
import asyncio, os, shutil, subprocess, sys, tempfile, time
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
BROWSER = os.environ.get('RIFAQ_BROWSER', 'chromium')
PORT = 8793
R = []
def rec(n, ok, d=''):
    R.append((n, bool(ok))); print(('PASS' if ok else 'FAIL'), n, '|', str(d)[:600], flush=True)

def ev(t, js, *a):
    return asyncio.wait_for(t.evaluate(js, *a), 30)

async def appframe(pg, timeout=20):
    for _ in range(timeout * 10):
        for f in pg.frames:
            if f != pg.main_frame and f.url.startswith('blob:'):
                try:
                    if await f.evaluate("typeof PACK_DATA !== 'undefined' && typeof STATE !== 'undefined' && typeof REF_TRUST !== 'undefined' && REF_TRUST !== null"):
                        await asyncio.sleep(0.4); return f
                except Exception: pass
        await asyncio.sleep(0.1)
    raise RuntimeError('app frame not found')

PROBE = """(() => { var pend = 0, bank = 0, mx = 0, n = 0;
  realSections().forEach(function(s){ (s.questions || []).concat(s.examQuestions || []).forEach(function(q){ n++; if (q.review === 'pending') pend++; if (/^mx_/.test(q.id)) mx++; });
    bank += (s.examQuestions || []).length; });
  var s3 = realSections().find(function(s){ return s.id === 's3_idgham'; }), x = s3.questions.find(function(q){ return q.id === 'x3_1'; });
  return {ch: RIFAQ_CHANNEL, hidden: CONTENT_HIDDEN, pend: pend, bank: bank, mx: mx, n: n, s3: s3.questions.length, x31: x.text, x31src: x.source, key: STORAGE_KEY, secs: realSections().length}; })()"""

async def main():
    tmp = tempfile.mkdtemp(prefix='rifaq_ch_')
    site = os.path.join(tmp, 'site')
    subprocess.check_call([sys.executable, '-I', os.path.join(ROOT, 'tools', 'build_web.py'), site], stdout=subprocess.DEVNULL)
    subprocess.check_call([sys.executable, '-I', os.path.join(ROOT, 'tools', 'build_web.py'), os.path.join(site, 'beta'), '--channel', 'beta'], stdout=subprocess.DEVNULL)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', site], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); BASE = 'http://localhost:%d' % PORT
    try:
        async with async_playwright() as p:
            b = await getattr(p, BROWSER).launch()
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar')
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:200]))

            # C1 صفحتا الإطلاق
            await pg.goto(BASE + '/index.html'); await pg.wait_for_timeout(1500)
            lm = await pg.evaluate("[document.getElementById('ver').textContent, document.getElementById('beta-note').hidden]")
            await pg.goto(BASE + '/beta/index.html'); await pg.wait_for_timeout(1500)
            lb = await pg.evaluate("[document.getElementById('ver').textContent, document.getElementById('beta-note').hidden]")
            rec('C1 launcher: main plain, beta labelled with its note', 'تجريبي' not in lm[0] and lm[1] and 'تجريبي' in lb[0] and not lb[1], (lm, lb))

            # C2 الرئيسي: لا شيء لم يُراجَع، والمحوَّل بصيغته السابقة، والاختبار من أسئلة الدروس
            await pg.goto(BASE + '/open.html?src=app'); fr = await appframe(pg)
            m = await ev(fr, PROBE)
            await ev(fr, "realSections().forEach(function(s){ STATE.progress[s.id] = {stars: 1, attempts: 1, bestScore: 0}; }); STATE.student = {name: 'أمل', gender: 'girl', id: 'stu_channel_main'}; save(); startFinalExam(1)")
            await fr.wait_for_timeout(300)
            ex = await ev(fr, "(() => { var les = {}; realSections().forEach(function(s){ s.questions.forEach(function(q){ les[q.id] = 1; }); }); var qs = CURRENT.section.questions; return [CURRENT.section.id, qs.length, qs.every(function(q){ return les[q.id] && q.review !== 'pending'; })]; })()")
            rec('C2 main hides all 125 unreviewed questions (bank, mixed imla\'i, converted idgham back to Uthmani); final exam falls back to lesson questions',
                m['ch'] == 'main' and m['hidden'] == 125 and m['pend'] == 0 and m['bank'] == 0 and m['mx'] == 0 and m['s3'] == 18 and 'ۥ' in m['x31'] and m['x31src'] == '112:4 (نص تنزيل)'
                and m['secs'] == 16 and not m['key'].startswith('beta_') and ex[0] == 'final_exam' and ex[1] > 0 and ex[2] and not errs, (m, ex, errs[:2]))

            # C3 التجريبي: كل شيء ظاهر، وتخزين الطفل منفصل
            await pg.goto(BASE + '/beta/open.html?src=app'); fb = await appframe(pg)
            bt = await ev(fb, PROBE)
            fresh = await ev(fb, "[STATE.student.name || '', RIFAQ_HOST_DB()]".replace('RIFAQ_HOST_DB()', "(window.parent.RIFAQ_HOST || {}).db"))
            rec('C3 beta shows everything for review, with its own child storage and recent-files store',
                bt['ch'] == 'beta' and bt['hidden'] == 0 and bt['pend'] == 125 and bt['bank'] == 80 and bt['mx'] == 33 and bt['s3'] == 30 and 'ۥ' not in bt['x31'] and 'رسم إملائي' in bt['x31src']
                and bt['key'].startswith('beta_') and fresh[0] == '' and fresh[1] == 'beta_rifaq_host_v1' and not errs, (bt, fresh, errs[:2]))

            # C4 الرجوع إلى الرئيسي: تقدّم الطفل هناك باقٍ لم يمسّه التجريبي
            await pg.goto(BASE + '/open.html?src=app'); fr = await appframe(pg)
            back = await ev(fr, "[STATE.student.name, Object.keys(STATE.progress).length, (window.parent.RIFAQ_HOST || {}).db]")
            rec('C4 main progress intact after visiting beta', back[0] == 'أمل' and back[1] == 16 and back[2] == 'rifaq_host_v1', back)

            # C5 عاملا الخدمة ومخزناهما
            await pg.goto(BASE + '/index.html'); await pg.wait_for_timeout(2500)
            await pg.goto(BASE + '/beta/index.html'); await pg.wait_for_timeout(2500)
            sw = await pg.evaluate("""(async () => { var regs = await navigator.serviceWorker.getRegistrations(); var keys = await caches.keys();
              return [regs.map(function(r){ return new URL(r.scope).pathname; }).sort(), keys.some(function(k){ return /^rifaq-(?!beta-)/.test(k); }), keys.some(function(k){ return /^rifaq-beta-/.test(k); })]; })()""")
            await pg.goto(BASE + '/index.html'); await pg.wait_for_timeout(1500)
            sw2 = await pg.evaluate("(async () => { var keys = await caches.keys(); return keys.some(function(k){ return /^rifaq-beta-/.test(k); }); })()")
            rec('C5 one service worker per channel; each keeps its own cache (main does not wipe beta)', sw[0] == ['/', '/beta/'] and sw[1] and sw[2] and sw2, (sw, sw2))

            # C6 نسخة التجربة على الرئيسي تخفي أيضًا
            await pg.goto(BASE + '/open.html?src=trial'); ft = await appframe(pg)
            tr = await ev(ft, PROBE)
            rec('C6 trial file on main hides unreviewed content too', tr['ch'] == 'main' and tr['pend'] == 0 and tr['hidden'] == 125 and not errs, (tr['ch'], tr['pend'], tr['hidden'], errs[:2]))
            await b.close()
    finally:
        srv.terminate(); shutil.rmtree(tmp, ignore_errors=True)
    passed = sum(1 for r in R if r[1]); print('\nSUMMARY: %d / %d (%s)' % (passed, len(R), BROWSER))
    sys.exit(0 if passed == len(R) else 1)

asyncio.run(main())
