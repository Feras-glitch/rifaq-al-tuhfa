import asyncio, json, re, os, html as H
from playwright.async_api import async_playwright
D = '/home/claude/v939'
RESULTS = []
def rec(name, ok, detail=''):
    RESULTS.append((name, bool(ok), detail)); print(('PASS' if ok else 'FAIL'), name, '|', str(detail)[:200])
LEAK = re.compile(r'\{[^{}|]*\|[^{}]*\}')
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']

async def newpage(b, **kw):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar', permissions=['microphone'], accept_downloads=True, **kw)
    page = await ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append('pageerror:' + str(e)[:200]))
    page.on('console', lambda m: errs.append(m.type + ':' + m.text[:200]) if m.type == 'error' or 'Content Security' in m.text else None)
    page.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    return ctx, page, errs

async def setup_student(page, name='مريم أحمد', gender='girl', consent=True, share=True):
    await page.wait_for_timeout(500)
    await page.evaluate("continueFromSplash()")
    await page.fill('#setup-name', name)
    await page.click('#setup-' + ('girl' if gender == 'girl' else 'boy'))
    await page.evaluate("saveSetup()"); await page.wait_for_timeout(500)
    if consent:
        await page.fill('#consent-name', 'أحمد محمود')
        cbs = await page.query_selector_all('input[type=checkbox]')
        vis = [c for c in cbs if await c.is_visible()]
        for i, c in enumerate(vis):
            if i == 2 and not share: continue
            if not await c.is_checked(): await c.check()
        await page.get_by_text('حفظ وابدأ').click()
    else:
        await page.evaluate("document.getElementById('consent-no') && document.getElementById('consent-no').click()")
    await page.wait_for_timeout(300)

async def record(page, sec, item):
    await page.evaluate(f"openSection('{sec}')"); await page.wait_for_timeout(400)
    btn = page.locator(f'[data-call*="startRec\\",\\"{item}"]').first
    # move to card containing the button
    for _ in range(6):
        if await btn.is_visible(): break
        nx = page.get_by_text('التالي ›')
        if await nx.count() and await nx.first.is_visible(): await nx.first.click(); await page.wait_for_timeout(250)
    await btn.click(); await page.wait_for_timeout(3500)
    await page.locator(f'[data-call*="startRec\\",\\"{item}"]').first.click(); await page.wait_for_timeout(1500)

async def export_student(page, path):
    async with page.expect_download(timeout=30000) as dl:
        await page.evaluate("showExportDialog('submission')"); await page.wait_for_timeout(500)
        await page.evaluate("document.querySelectorAll('#modal button').forEach(b=>{ if(b.textContent.includes('إرسال للمعلم')) b.click(); })")
    d = await dl.value; await d.save_as(path); return path

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        cur = json.load(open(f'{D}/curriculum.json', encoding='utf-8'))['sections']
        QS = {q['id']: q for s in cur for q in s['questions']}

        # T1: load all three without errors
        for f in ['out_app', 'out_mobile', 'out_studio']:
            ctx, page, errs = await newpage(b)
            await page.goto(f'file://{D}/{f}.html'); await page.wait_for_timeout(1200)
            rec(f'T1 load {f} (no JS/CSP errors)', not errs, errs[:3])
            await ctx.close()

        # T2..T5: student UI
        ctx, page, errs = await newpage(b)
        await page.goto(f'file://{D}/out_app.html'); await page.wait_for_timeout(500)
        await page.evaluate("continueFromSplash()")
        ph0 = await page.get_attribute('#setup-name', 'placeholder')
        await page.click('#setup-girl'); ph1 = await page.get_attribute('#setup-name', 'placeholder')
        rec('T2 placeholder no template / feminine after girl', '{' not in ph0 and ph1 == 'اكتبي اسمك الكامل', (ph0, ph1))
        await page.fill('#setup-name', 'مريم أحمد'); await page.evaluate("saveSetup()"); await page.wait_for_timeout(400)
        await page.evaluate("document.getElementById('consent-no') && document.getElementById('consent-no').click()")
        home = await page.inner_text('body')
        rec('T3 counters Arabic agreement', 'أسئلة' in home and ' سؤال\n' not in home and 'عنصر ·' not in home, re.findall(r'[^\n]*(?:سؤال|أسئلة|عنصر|عناصر)[^\n]*', home)[:3])
        # render all questions
        bad = []; leaks = []; orders = []
        for s in cur:
            await page.evaluate(f"openSection('{s['id']}')"); await page.wait_for_timeout(60)
            lt = await page.inner_text('#view-lesson'); leaks += LEAK.findall(lt)
            await page.evaluate("startQuiz()"); await page.wait_for_timeout(60)
            for i, q in enumerate(s['questions']):
                await page.evaluate(f"CURRENT.qIdx={i}; renderQuestion()"); await page.wait_for_timeout(30)
                t = await page.inner_text('#view-quiz')
                if 'undefined' in t or 'NaN' in t or '[object' in t: bad.append(q['id'])
                leaks += LEAK.findall(t)
                if q['type'] in ('multiple_choice', 'extraction'):
                    orders.append(await page.evaluate("Array.from(document.querySelectorAll('#options .option-btn')).map(b=>b.dataset.idx).join('')"))
        rec('T4 no undefined/leaks in all 148 renders', not bad and not leaks, (bad[:5], leaks[:5]))
        rec('T5 options shuffled (not always natural order)', any(o != ''.join(str(i) for i in range(len(o))) for o in orders), orders[:8])
        # real click on correct answer in shuffled MC
        await page.evaluate("openSection('s2_idhhar')"); await page.evaluate("startQuiz()"); await page.wait_for_timeout(200)
        q = QS['q2_1']; idx = await page.evaluate("CURRENT.section.questions.findIndex(q=>q.id==='q2_1')")
        await page.evaluate(f"CURRENT.qIdx={idx}; renderQuestion()"); await page.wait_for_timeout(200)
        await page.locator(f'#options .option-btn[data-idx="{q["answer"]}"]').click(); await page.wait_for_timeout(300)
        fb = await page.inner_text('#feedback-box')
        rec('T6 real click on correct shuffled option scores', 'أحسنتِ' in fb or 'ممتاز' in fb, fb[:80])
        # wrong answer feedback feminine
        await page.evaluate(f"CURRENT.qIdx={idx}; renderQuestion()"); await page.wait_for_timeout(200)
        wrong = (q['answer'] + 1) % len(q['options'])
        await page.locator(f'#options .option-btn[data-idx="{wrong}"]').click(); await page.wait_for_timeout(300)
        fb = await page.inner_text('#feedback-box')
        rec('T7 wrong-answer feedback in feminine', 'راجعي' in fb and 'انتقلي' in fb, fb[:120])
        # T8: final exam then reload -> assess persists (R01)
        await page.evaluate("startFinalExam(1)"); await page.wait_for_timeout(300)
        n = await page.evaluate("CURRENT.section.questions.length")
        for i in range(n):
            qq = json.loads(await page.evaluate("JSON.stringify(CURRENT.section.questions[CURRENT.qIdx])"))
            if qq['type'] in ('multiple_choice', 'true_false', 'extraction'): await page.evaluate(f"answer({json.dumps(qq['answer'])})")
            else: await page.evaluate("finishAnswer(true, CURRENT.section.questions[CURRENT.qIdx])")
            await page.evaluate("var b=document.querySelector('#feedback-box button'); b&&b.click()")
        before = await page.evaluate("JSON.stringify(STATE.assess.examDone)")
        await page.reload(); await page.wait_for_timeout(800)
        after = await page.evaluate("JSON.stringify(STATE.assess && STATE.assess.examDone)")
        rec('T8 R01 assess survives reload', before == after and '1' in (after or ''), (before, after))
        rec('T2-7 no JS errors', not errs, errs[:3])
        await ctx.close()

        # T9: studio import of approved JSON + export with trusted key; chain of trust
        # first get a teacher key: open any submission in teacher ctx and export
        ctxT, pT, errsT = await newpage(b)
        # build a plain submission first
        ctxS, pS, errsS = await newpage(b)
        await pS.goto(f'file://{D}/out_app.html'); await setup_student(pS)
        await record(pS, 's2_idhhar', 'r2_1')
        sub0 = await export_student(pS, f'{D}/t_sub0.html'); await ctxS.close()
        await pT.goto('file://' + sub0); await pT.wait_for_timeout(800)
        await pT.fill('#review-teacher-name', 'الشيخ محمود')
        await pT.click('[data-call*="setReview\\",\\"r2_1\\",\\"approved"]'); await pT.wait_for_timeout(300)
        async with pT.expect_download(timeout=30000) as dl:
            await pT.evaluate("exportApprovedPack()")
        await (await dl.value).save_as(f'{D}/t_gift0.html')
        jwk = await pT.evaluate("keyDbGet(SIG_KEY_ID).then(r=>JSON.stringify(r.publicJwk))")
        rec('T9a teacher key generated', '"x"' in jwk, jwk[:60])
        # studio: import curriculum.json, add key, record one, export
        ctxU, pU, errsU = await newpage(b)
        await pU.goto(f'file://{D}/out_studio.html'); await pU.wait_for_timeout(600)
        await pU.fill('#in-sheikh-name', 'الشيخ أيمن'); await pU.fill('#in-supervisor-name', 'فراس')
        await pU.get_by_text('ابدأ الاستوديو').click(); await pU.wait_for_timeout(600)
        finp = await pU.query_selector('input[type=file][data-change="importCurriculum"], input[type=file]#curr-file, input[type=file]')
        # find the curriculum import input
        inputs = await pU.query_selector_all('input[type=file]')
        target = None
        for inp in inputs:
            acc = (await inp.get_attribute('accept')) or ''
            oc = (await inp.get_attribute('onchange')) or (await inp.get_attribute('data-change')) or ''
            if 'json' in acc.lower() or 'importCurriculum' in oc: target = inp
        if target:
            await target.set_input_files(f'{D}/curriculum.json'); await pU.wait_for_timeout(600)
            st = await pU.inner_text('#curr-status')
            rec('T9b R05 studio imports {meta,sections} file', '✅' in st, st[:120])
        else:
            rec('T9b R05 studio import input found', False, 'no input')
        recs = await pU.query_selector_all('button:has-text("سجّل")'); await recs[0].click(); await pU.wait_for_timeout(3000)
        recs = await pU.query_selector_all('button:has-text("إيقاف"), button:has-text("سجّل")'); await recs[0].click(); await pU.wait_for_timeout(1200)
        dbn0 = await pU.evaluate("DB_NAME")
        await pU.fill('#in-trusted-keys', jwk)
        async with pU.expect_download(timeout=30000) as dl:
            await pU.click('#btn-export')
        await (await dl.value).save_as(f'{D}/t_studio_pack.html')
        # R10: new session keeps prefix
        await pU.evaluate("newWorkspace && newWorkspace()") if await pU.evaluate("typeof newWorkspace==='function'") else None
        dbn1 = await pU.evaluate("DB_NAME")
        rec('T9c R10 studio DB prefix stable after new session', dbn0.split('_ws_')[0] == dbn1.split('_ws_')[0], (dbn0, dbn1))
        rec('T9 studio no JS errors', not errsU, errsU[:3])
        await ctxU.close()
        # student from studio pack
        ctxS, pS, errsS = await newpage(b)
        await pS.goto(f'file://{D}/t_studio_pack.html'); await setup_student(pS, share=True)
        tk0 = await pS.evaluate("JSON.stringify(PACK_DATA.trustedTeacherKeys)")
        await record(pS, 's2_idhhar', 'r2_1')
        sub1 = await export_student(pS, f'{D}/t_sub1.html')
        await ctxS.close()
        sub1_src = open(sub1, encoding='utf-8').read()
        tk_in_sub = '"trustedTeacherKeys"' in sub1_src and '"x"' in sub1_src
        rec('T10 R06 trustedTeacherKeys carried in submission', tk_in_sub and '"x"' in tk0, tk0[:60])
        # teacher approves (same ctxT, same key)
        await pT.goto('file://' + sub1); await pT.wait_for_timeout(800)
        tlabel = await pT.inner_text('#review-list')
        rec('T11 teacher sees item title not raw id', 'الإظهار' in tlabel and 'r2_1' in tlabel and 'الطالبة صاحبة' in (await pT.inner_text('body')), tlabel[:120].replace('\n', ' | '))
        await pT.fill('#review-teacher-name', 'الشيخ محمود')
        await pT.click('[data-call*="setReview\\",\\"r2_1\\",\\"approved"]'); await pT.wait_for_timeout(300)
        async with pT.expect_download(timeout=30000) as dl:
            await pT.evaluate("exportApprovedPack()")
        gift1 = f'{D}/t_gift1.html'; await (await dl.value).save_as(gift1)
        rec('T teacher no JS errors', not errsT, errsT[:3])
        await ctxT.close()
        # recipient opens gift
        ctxR, pR, errsR = await newpage(b)
        await pR.goto('file://' + gift1); await pR.wait_for_timeout(1200)
        trust = await pR.evaluate("GIFT_TRUST")
        pd = json.loads(await pR.evaluate("JSON.stringify(PACK_DATA)"))
        rec('T12 gift verified with studio-trusted key', trust == 'verified', trust)
        leak_fields = [k for k in ['studentName', 'studentId', 'studentPhoto', 'studentAssessment', 'teacherRatings', 'teacherNotes', 'teacherFeedbacks', 'studentConsent'] if pd.get(k)]
        rec('T13 R07 gift carries no private fields', not leak_fields and pd.get('sourceGiftStudentName') == 'مريم أحمد', (leak_fields, pd.get('sourceGiftStudentName')))
        # 9.39.3: التلاعب يكون في الملف نفسه (كما يفعل المهاجم) مع إعادة حساب تجزئة CSP؛ التحقق يجري على الملف كما وصل
        async def tampered_trust(mut, name):
            src = open(gift1, encoding='utf-8').read()
            m = re.search(r'(var PACK_DATA = )(.*?)(;\n/\* ===PACK_DATA_END)', src, re.S)
            pk = json.loads(m.group(2)); mut(pk)
            body = json.dumps(pk, ensure_ascii=False).replace('</', '<\\/')
            out = src[:m.start(2)] + body + src[m.end(2):]
            sc = re.search(r'<script>(.*?)</script>', out, re.S).group(1)
            import hashlib, base64
            h = base64.b64encode(hashlib.sha256(sc.encode()).digest()).decode()
            out = re.sub(r"script-src 'sha256-[^']+'", "script-src 'sha256-" + h + "'", out, count=1)
            fp = f'{D}/{name}.html'; open(fp, 'w', encoding='utf-8').write(out)
            ctxX, pX, errsX = await newpage(b); await pX.goto('file://' + fp); await pX.wait_for_timeout(1200)
            t = await pX.evaluate("GIFT_TRUST"); await ctxX.close(); return t
        def mut_audio(pk):
            g = pk['approvedPeerRecordings'][0]; g['audios'][sorted(g['audios'])[0]]['audio'] = 'data:audio/webm;base64,QUJD'
        t2 = await tampered_trust(mut_audio, 't_gift1_tamper_audio')
        rec('T14 tampered audio -> invalid', t2 == 'invalid', t2)
        def mut_keys(pk):
            pk['trustedTeacherKeys'].append({'kty':'EC','crv':'P-256','x':'A'*43,'y':'A'*43})
        t3 = await tampered_trust(mut_keys, 't_gift1_tamper_keys')
        rec('T15 R02 tampered trusted-key list -> invalid', t3 == 'invalid', t3)
        await ctxR.close()

        # T16: gift without share consent carries no name/photo
        ctxS, pS, errsS = await newpage(b)
        await pS.goto(f'file://{D}/t_studio_pack.html'); await setup_student(pS, name='سارة علي', share=False)
        await record(pS, 's2_idhhar', 'r2_1')
        sub2 = await export_student(pS, f'{D}/t_sub2.html'); await ctxS.close()
        ctxT2, pT2, _ = await newpage(b)
        await pT2.goto('file://' + sub2); await pT2.wait_for_timeout(800)
        await pT2.fill('#review-teacher-name', 'الشيخ محمود')
        await pT2.click('[data-call*="setReview\\",\\"r2_1\\",\\"approved"]'); await pT2.wait_for_timeout(300)
        async with pT2.expect_download(timeout=30000) as dl:
            await pT2.evaluate("exportApprovedPack()")
        gift2 = f'{D}/t_gift2.html'; await (await dl.value).save_as(gift2); await ctxT2.close()
        g2 = open(gift2, encoding='utf-8').read()
        m = re.search(r'var PACK_DATA = (.*?);\n/\* ===PACK_DATA_END', g2, re.S); pd2 = json.loads(m.group(1))
        rec('T16 R07 no-share gift: no name/photo/groups', pd2.get('sourceGiftStudentName') == '' and not pd2.get('sourceGiftStudentPhoto') and not pd2.get('approvedPeerRecordings') and 'سارة' not in m.group(1), (pd2.get('sourceGiftStudentName'), len(pd2.get('approvedPeerRecordings') or [])))

        # T17: delete scope (R04): two students, delete one
        ctxD, pD, errsD = await newpage(b)
        await pD.goto(f'file://{D}/out_app.html'); await setup_student(pD, name='طفل أول', gender='boy', consent=False)
        await pD.evaluate("STATE.progress['s0_muqaddima']={done:true}; save()")
        await pD.evaluate("show('view-student-setup'); startNewStudent()"); await pD.wait_for_timeout(400)
        await pD.fill('#setup-name', 'طفل ثان'); await pD.evaluate("saveSetup()"); await pD.wait_for_timeout(400)
        await pD.evaluate("document.getElementById('consent-no') && document.getElementById('consent-no').click()")
        keys_before = await pD.evaluate("Object.keys(localStorage).filter(k=>k.startsWith(STORAGE_BASE))")
        await pD.evaluate("deleteChildDataOnDevice()"); await pD.wait_for_timeout(2500)
        keys_after = await pD.evaluate("Object.keys(localStorage).filter(k=>k.startsWith(STORAGE_BASE))")
        first_kept = False
        for k in keys_after:
            v = await pD.evaluate(f"localStorage.getItem('{k}')") or ''
            if 'طفل أول' in v: first_kept = True
        rec('T17 R04 delete removes only current child', len(keys_before) >= 3 and len(keys_after) == len(keys_before) - 1 and first_kept, (keys_before, keys_after))
        await ctxD.close()

        # T18: lesson pagination preserved after recording
        ctxP, pP, errsP = await newpage(b)
        await pP.goto(f'file://{D}/out_app.html'); await setup_student(pP)
        await record(pP, 's2_idhhar', 'r2_1')
        t = await pP.inner_text('#view-lesson')
        rec('T18 pagination kept after recording', 'بطاقة 2 من 2' in t, re.findall(r'بطاقة \d من \d', t))
        await ctxP.close()

        # T19: curriculum fixes present in app and studio
        a = open(f'{D}/out_app.html', encoding='utf-8').read(); u = open(f'{D}/out_studio.html', encoding='utf-8').read()
        rec('T19 fabricated quote removed everywhere', 'جَوَازُ الإِدْغَامِ' not in a and 'جَوَازُ الإِدْغَامِ' not in u and 'ب (٢) + د (٤) + ا (١)' not in a and 'سورة 77،' not in a, '')
        await b.close()
    json.dump(RESULTS, open(f'{D}/test_results.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\nSUMMARY:', sum(1 for r in RESULTS if r[1]), '/', len(RESULTS), 'passed')

asyncio.run(main())
