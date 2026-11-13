# -*- coding: utf-8 -*-
"""9.39.12: اختبار دخان على محرك WebKit (محرك Safari في آيفون)، لأن كل الاختبارات الأخرى على Chromium وحده.
لا يغني عن هاتف حقيقي، ولا يختبر الميكروفون (WebKit في Playwright بلا ميكروفون وهمي).
يفحص: صفحة الإطلاق، وفتح التطبيق في الصفحة المضيفة (إطار blob)، والتسجيل الأولي والموافقة، وعرض كل سؤال،
وإبراز الكلمة المسؤول عنها، ودرسًا كاملًا، وجلسة اختبار، وبقاء التقدم بعد إعادة التحميل، والاستوديو تحت CSP.
التشغيل: RIFAQ_SITE=_site python3 -I tests/test_webkit_smoke.py   (RIFAQ_BROWSER=chromium للتجربة المحلية)"""
import asyncio, os, subprocess, sys, time
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.environ.get('RIFAQ_SITE', os.path.join(HERE, '..', '_site')))
BROWSER = os.environ.get('RIFAQ_BROWSER', 'webkit')
PORT = 8791
R = []
def rec(n, ok, d=''):
    R.append((n, bool(ok))); print(('PASS' if ok else 'FAIL'), n, '|', str(d)[:400], flush=True)

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

RUN_SESSION_JS = """async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; const sec = CURRENT.section;
  while (CURRENT.section === sec && CURRENT.qIdx < sec.questions.length && !document.getElementById('view-quiz').classList.contains('hidden')) {
    const q = sec.questions[CURRENT.qIdx];
    if (QX.has(q.type)) finishCustom(q, 0); else answer(q.answer);
    n++; await sleep(15);
    const btn = document.querySelector('#feedback-box button'); if (!btn) break; btn.click(); await sleep(15);
  }
  return n;
}"""

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', SITE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); BASE = 'http://localhost:%d' % PORT
    try:
        async with async_playwright() as p:
            b = await getattr(p, BROWSER).launch()
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar')
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:200]))

            await pg.goto(BASE + '/index.html'); await pg.wait_for_timeout(1500)
            ver = await pg.evaluate("document.getElementById('ver').textContent")
            rec('W1 launcher loads', 'الإصدار' in ver and not errs, (ver, errs[:2]))

            await pg.goto(BASE + '/open.html?src=app'); fr = await appframe(pg)
            await ev(fr, "continueFromSplash()"); await fr.fill('#setup-name', 'دلال'); await fr.click('#setup-girl')
            await ev(fr, "saveSetup()"); await fr.wait_for_timeout(500)
            await fr.fill('#consent-name', 'ولي الأمر')
            for c in [c for c in await fr.query_selector_all('input[type=checkbox]') if await c.is_visible()]: await c.check()
            await fr.click('text=حفظ وابدأ'); await fr.wait_for_timeout(500)
            home = await ev(fr, "[STATE.student.name, !!(STATE.student.consent && STATE.student.consent.v), document.querySelectorAll('#section-list > *').length]")
            rec('W2 app opens in the host frame; setup and consent saved', home[0] == 'دلال' and home[1] and home[2] >= 16 and not errs, (home, errs[:2]))

            vis = await ev(fr, """(() => { var out = {n: 0, bad: [], errs: []};
              openSection('s2_idhhar'); startQuiz(); var keep = CURRENT.section.questions;
              var all = []; realSections().forEach(function(s){ all = all.concat(s.questions || [], s.examQuestions || []); });
              all.forEach(function(q){
                try { CURRENT.section.questions = [Object.assign({}, q)]; CURRENT.qIdx = 0; renderQuestion(); out.n++;
                  if (q.type === 'extraction'){ var vt = document.querySelector('#view-quiz .verse-text'), b = vt && vt.querySelector('b');
                    if (!b){ out.bad.push(q.id); return; } var a = getComputedStyle(vt), c = getComputedStyle(b);
                    if (a.backgroundColor === c.backgroundColor && a.color === c.color) out.bad.push(q.id); }
                } catch(e){ out.errs.push(q.id + ':' + e.message); } });
              CURRENT.section.questions = keep; return out; })()""")
            rec('W3 every lesson and bank question renders; target word highlighted', vis['n'] >= 260 and not vis['bad'] and not vis['errs'], (vis['n'], vis['bad'][:5], vis['errs'][:3]))

            await ev(fr, "openSection('s2_idhhar'); startQuiz()")
            n = await ev(fr, RUN_SESSION_JS); await fr.wait_for_timeout(400)
            lesson = await ev(fr, "[!document.getElementById('view-results').classList.contains('hidden'), (STATE.progress.s2_idhhar || {}).stars || 0]")
            rec('W4 a full lesson quiz completes with stars', n > 5 and lesson[0] and lesson[1] >= 1 and not errs, (n, lesson, errs[:2]))

            await ev(fr, "realSections().forEach(function(s){ STATE.progress[s.id] = STATE.progress[s.id] || {stars: 1, attempts: 1, bestScore: 0}; }); save(); startFinalExam(1)")
            await fr.wait_for_timeout(300)
            n2 = await ev(fr, RUN_SESSION_JS); await fr.wait_for_timeout(400)
            ex = await ev(fr, "[!!document.getElementById('exam-report'), !!(STATE.assess.examDone || {})[1]]")
            rec('W5 final exam session 1 completes with its summary', n2 >= 15 and ex[0] and ex[1] and not errs, (n2, ex, errs[:2]))

            # W6: إغلاق التطبيق وفتحه من جديد (صفحة جديدة في السياق نفسه، كما يفعل الطفل).
            # في تشغيل CI الأول على WebKit لم ينطلق حدث load للتنقّل الثاني خلال 30 ثانية؛ فنفصل
            # «التقدّم باقٍ» (W6) عن «اكتمال تحميل الصفحة» (W6b) ونسجّل الطلبات المعلّقة لتشخيصه.
            await pg.close()
            pg = await ctx.new_page(); pending = {}
            pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
            pg.on('request', lambda r: pending.__setitem__(r.url[:100], r.resource_type))
            pg.on('requestfinished', lambda r: pending.pop(r.url[:100], None))
            pg.on('requestfailed', lambda r: pending.pop(r.url[:100], None))
            try:
                await pg.goto(BASE + '/open.html?src=app', wait_until='domcontentloaded'); fr = await appframe(pg, 40)
                await ev(fr, "continueFromSplash()"); await fr.wait_for_timeout(300)
                kept = await ev(fr, "[STATE.student.name, !!(STATE.assess && (STATE.assess.examDone || {})[1]), (STATE.respLog || []).length]")
                rec('W6 progress survives closing and reopening (localStorage)', kept[0] == 'دلال' and kept[1] and kept[2] > 20, kept)
            except Exception as e:
                rec('W6 progress survives closing and reopening (localStorage)', False, (repr(e)[:200], list(pending.items())[:6]))
            try:
                await pg.wait_for_load_state('load', timeout=15000); loaded = True
            except Exception:
                loaded = False
            sw = await pg.evaluate("[document.readyState, !!(navigator.serviceWorker && navigator.serviceWorker.controller)]")
            rec('W6b reopened page finishes loading (no hung request)', loaded, (sw, list(pending.items())[:6]))
            await ctx.close()

            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar')
            pg = await ctx.new_page(); errs2 = []; cons = []
            pg.on('pageerror', lambda e: errs2.append(str(e)[:200]))
            pg.on('console', lambda m: cons.append(m.text[:160]) if 'Content Security Policy' in m.text or 'Refused' in m.text else None)
            await pg.goto(BASE + '/studio/index.html'); await pg.wait_for_timeout(1000)
            await pg.fill('#in-sheikh-name', 'الشيخ أيمن'); await pg.fill('#in-supervisor-name', 'فراس')
            await pg.click('text=ابدأ الاستوديو'); await pg.wait_for_timeout(800)
            groups = await pg.evaluate("document.querySelectorAll('.group').length")
            await pg.click('.group-header >> nth=0'); await pg.wait_for_timeout(300)
            rec('W7 studio runs under its CSP; delegated buttons work', groups >= 3 and not errs2 and not cons, (groups, errs2[:2], cons[:2]))

            await pg.goto(BASE + '/open.html?src=trial'); fr = await appframe(pg)
            rec('W8 trial file opens through the host', await ev(fr, "realSections().length") == 16 and not errs2, errs2[:2])
            await b.close()
    finally:
        srv.terminate()
    passed = sum(1 for r in R if r[1]); print('\nSUMMARY: %d / %d (%s)' % (passed, len(R), BROWSER))
    sys.exit(0 if passed == len(R) else 1)

asyncio.run(main())
