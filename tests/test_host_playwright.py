# اختبارات نسخة الويب والصفحة المضيفة (فتح ملف) ومحاكاة جسر أندرويد. شغّل tools/build_web.py أولًا.
# H7 يحتاج إهداءً موقَّعًا بمفتاح موثوق داخله: RIFAQ_SIGNED_GIFT=مسار (ينتجه tests/test_v939_playwright.py باسم t_gift1.html).
import asyncio, json, re, os, base64, subprocess, sys, time
from playwright.async_api import async_playwright

SITE = os.environ.get('RIFAQ_SITE', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_site'))
PORT = 8765
BASE = f'http://localhost:{PORT}'
OUT = os.environ.get('RIFAQ_TEST_OUT', '/tmp/rifaq_hosttest')
os.makedirs(OUT, exist_ok=True)
R = []
def rec(n, ok, d=''):
    R.append((n, bool(ok), str(d)[:220])); print(('PASS' if ok else 'FAIL'), n, '|', str(d)[:220])

ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']

async def ctx_page(b, init=None):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar', permissions=['microphone'], accept_downloads=True)
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)[:160]))
    pg.on('console', lambda m: errs.append(m.type + ':' + m.text[:200]) if (m.type == 'error' or 'Content Security' in m.text or 'Refused' in m.text) else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    return ctx, pg, errs

def F(pg):  # the app frame
    return pg.frame_locator('#frame')

async def appframe(pg):
    for _ in range(40):
        for fr in pg.frames:
            if fr != pg.main_frame and fr.url.startswith('blob:'):
                try:
                    if await fr.evaluate("typeof PACK_DATA !== 'undefined' && typeof STATE !== 'undefined'"): return fr
                except Exception: pass
        await pg.wait_for_timeout(150)
    raise RuntimeError('app frame not found')

async def setup_student(fr, name='مريم أحمد'):
    await fr.evaluate("continueFromSplash()")
    await fr.fill('#setup-name', name); await fr.click('#setup-girl')
    await fr.evaluate("saveSetup()"); await fr.wait_for_timeout(400)
    await fr.fill('#consent-name', 'أحمد محمود')
    for c in await fr.query_selector_all('input[type=checkbox]'):
        if await c.is_visible() and not await c.is_checked(): await c.check()
    await fr.click('text=حفظ وابدأ'); await fr.wait_for_timeout(300)

async def record(fr, sec='s2_idhhar', item='r2_1'):
    await fr.evaluate(f"openSection('{sec}')"); await fr.wait_for_timeout(300)
    btn = fr.locator(f'[data-call*="startRec\\",\\"{item}"]').first
    for _ in range(5):
        if await btn.is_visible(): break
        await fr.click('text=التالي ›'); await fr.wait_for_timeout(200)
    await btn.click(); await fr.wait_for_timeout(3200)
    await fr.locator(f'[data-call*="startRec\\",\\"{item}"]').first.click(); await fr.wait_for_timeout(1200)

async def open_file(pg, path):
    await pg.set_input_files('#file-in', path)
    return await appframe(pg)

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', SITE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=ARGS)

            # H1 launcher + SW
            ctx, pg, errs = await ctx_page(b)
            await pg.goto(BASE + '/index.html'); await pg.wait_for_timeout(2500)
            sw = await pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!(r&&(r.active||r.installing||r.waiting)))")
            cards = await pg.eval_on_selector_all('a.card', 'els=>els.map(e=>e.getAttribute("href"))')
            rec('H1 launcher loads, SW registered, 4 cards', not errs and sw and len(cards) == 4, (errs[:2], sw, cards))
            await ctx.close()

            # H2 host ?src=app: student flow + export
            ctx, pg, errs = await ctx_page(b)
            await pg.goto(BASE + '/open.html?src=app'); fr = await appframe(pg)
            await setup_student(fr); await record(fr)
            async with pg.expect_download(timeout=30000) as dl:
                await fr.evaluate("showExportDialog('submission')"); await fr.wait_for_timeout(300)
                await fr.evaluate("document.querySelectorAll('#modal button').forEach(b=>{ if(b.textContent.includes('إرسال للمعلم')) b.click(); })")
            d = await dl.value; sub = f'{OUT}/sub.html'; await d.save_as(sub)
            rec('H2 app in host: setup, record, export submission (no CSP/JS errors)', not errs and os.path.getsize(sub) > 100000, (errs[:3], os.path.getsize(sub)))
            # H3 assess persists across host reload (R01 in host context)
            await fr.evaluate("STATE.assess = STATE.assess || assessEmptyState(); STATE.assess.examDone={1:true}; save()")
            await pg.reload(); fr = await appframe(pg)
            ed = await fr.evaluate("JSON.stringify(STATE.assess && STATE.assess.examDone)")
            rec('H3 state persists after reloading host', ed == '{"1":true}', ed)
            await ctx.close()

            # H4 teacher opens submission via host file picker, approves, exports gift
            ctxT, pT, errsT = await ctx_page(b)
            await pT.goto(BASE + '/open.html'); frT = await open_file(pT, sub)
            body = await frT.inner_text('body')
            rec('H4 submission opens as teacher view', 'صفحة مراجعة المعلم' in body and 'مريم أحمد' in body, body[:120].replace('\n', ' | '))
            title = await pT.inner_text('#cur-title')
            rec('H4b host title shows kind + name', 'إرسال للمراجعة' in title and 'مريم' in title, title)
            await frT.fill('#review-teacher-name', 'الشيخ محمود')
            await frT.click('[data-call*="setReview\\",\\"r2_1\\",\\"approved"]'); await frT.wait_for_timeout(300)
            async with pT.expect_download(timeout=30000) as dl:
                await frT.evaluate("exportApprovedPack()")
            d = await dl.value; gift = f'{OUT}/gift.html'; await d.save_as(gift)
            rec('H5 teacher exports gift from host', os.path.getsize(gift) > 100000 and not errsT, (errsT[:3], os.path.getsize(gift)))
            # recent list
            await pT.click('#go-home'); await pT.goto(BASE + '/open.html'); await pT.wait_for_timeout(600)
            items = await pT.eval_on_selector_all('#recent li .r-name', 'els=>els.map(e=>e.textContent)')
            rec('H6 recent list holds the opened submission', any('إرسال للمراجعة' in i for i in items), items)
            await pT.click('#recent li .r-open'); frT2 = await appframe(pT)
            rec('H6b reopen from recent works', 'صفحة مراجعة المعلم' in await frT2.inner_text('body'), '')
            await ctxT.close()

            # H7 gift signed in 9.39 standalone (from v9.39 tests, trusted key inside) stays verified when opened via host
            ctxR, pR, errsR = await ctx_page(b)
            await pR.goto(BASE + '/open.html'); frR = await open_file(pR, os.environ.get('RIFAQ_SIGNED_GIFT', '/tmp/t_gift1.html'))
            trust = await frR.evaluate("GIFT_TRUST")
            rec('H7 signed gift opened via host (code rebuilt from template) still verified', trust == 'verified', trust)
            await ctxR.close()

            # H8 malicious file: extra script + tampered code outside PACK_DATA never runs
            src = open(sub, encoding='utf-8').read()
            evil = src.replace('<body', '<script>window.top.PWNED=1;document.title="PWNED"</script><body', 1)
            evil = evil.replace('function GT(t){', 'function GT(t){ try{window.top.PWNED2=1}catch(e){}', 1)
            open(f'{OUT}/evil.html', 'w', encoding='utf-8').write(evil)
            ctxE, pE, errsE = await ctx_page(b)
            await pE.goto(BASE + '/open.html'); frE = await open_file(pE, f'{OUT}/evil.html'); await pE.wait_for_timeout(600)
            pw = await pE.evaluate("[window.PWNED, window.PWNED2]")
            rec('H8 injected code in opened file never executes', pw == [None, None], pw)
            # non-rifaq file rejected
            open(f'{OUT}/other.html', 'w').write('<html><body><script>window.top.X=1</script>hi</body></html>')
            await pE.click('#open-btn'); await pE.set_input_files('#file-in', f'{OUT}/other.html'); await pE.wait_for_timeout(500)
            err = await pE.inner_text('#err'); x = await pE.evaluate("window.X")
            rec('H9 non-Rifaq HTML rejected with message, not run', 'ليس ملفًا من ملفات رفاق التحفة' in err and x is None, err[:80])
            await ctxE.close()

            # H10 studio + trial through host
            ctxS, pS, errsS = await ctx_page(b)
            await pS.goto(BASE + '/open.html?src=studio'); await pS.wait_for_timeout(1200)
            st = await pS.frame_locator('#frame').locator('body').inner_text()
            await pS.goto(BASE + '/open.html?src=trial'); frTr = await appframe(pS)
            pd = await frTr.evaluate("PACK_DATA.packageId")
            rec('H10 studio and trial open in host', 'استوديو' in st and pd == 'pack_kids_stage1' and not errsS, (pd, errsS[:2]))
            await ctxS.close()

            # H11 Android bridge simulation: download in frame -> Filesystem.writeFile + Share
            init = """
              window.__calls = [];
              window.Capacitor = { isNativePlatform: () => true,
                nativePromise: (pl, m, o) => { window.__calls.push([pl, m, o]);
                  if (m === 'writeFile') return Promise.resolve({ uri: 'file:///cache/' + o.path });
                  if (m === 'getLaunchUrl') return Promise.resolve({});
                  return Promise.resolve({}); },
                nativeCallback: (pl, m, o, cb) => { window.__calls.push([pl, m, o]); return 'cb1'; } };
            """
            ctxA, pA, errsA = await ctx_page(b, init=init)
            await pA.goto(BASE + '/index.html'); await pA.wait_for_timeout(600)
            hrefs = await pA.eval_on_selector_all('a.card', 'els=>els.map(e=>e.getAttribute("href"))')
            await pA.goto(BASE + '/open.html?src=app'); frA = await appframe(pA)
            await setup_student(frA, 'سارة'); await record(frA)
            await frA.evaluate("showExportDialog('submission')"); await frA.wait_for_timeout(300)
            await frA.evaluate("document.querySelectorAll('#modal button').forEach(b=>{ if(b.textContent.includes('إرسال للمعلم')) b.click(); })")
            await pA.wait_for_timeout(3500)
            calls = await pA.evaluate("window.__calls.map(c=>[c[0],c[1],c[2]&&c[2].path||c[2]&&c[2].eventName||'', c[2]&&c[2].data?c[2].data.length:0, c[2]&&c[2].files||null])")
            wr = [c for c in calls if c[1] == 'writeFile']
            sh = [c for c in calls if c[0] == 'Share']
            data_ok = False
            full = await pA.evaluate("(window.__calls.find(c=>c[1]==='writeFile'&&c[2].directory==='CACHE')||[])[2]")
            if full:
                html = base64.b64decode(full['data']).decode('utf-8')
                data_ok = '"packageType":"student_submission"' in html.replace(' ', '') or 'student_submission' in html
            rec('H11 Android: launcher routes via host', all(h.startswith('./open.html') for h in hrefs if 'trial' in h or 'app' in h or 'studio' in h), hrefs)
            rec('H12 Android: export -> Documents copy + cache + Share sheet with real file', len(wr) == 2 and len(sh) == 1 and data_ok and any(c[1] == 'addListener' for c in calls), [c[:3] + [c[3]] for c in calls])
            await ctxA.close()
            await b.close()
    finally:
        srv.terminate()
    print('\nSUMMARY:', sum(1 for r in R if r[1]), '/', len(R))
    json.dump(R, open(f'{OUT}/results.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

asyncio.run(main())
