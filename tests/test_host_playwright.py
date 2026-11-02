# اختبارات نسخة الويب والصفحة المضيفة (فتح ملف)، ومحاكاة جسر أندرويد، واختبارات انحدار مراجعتي الخصم 9.39.2 و9.39.3.
# التشغيل: python3 tools/build_web.py _site && RIFAQ_SITE=_site python3 tests/test_host_playwright.py
# يعمل في CI قبل أي نشر أو إصدار (مهمة web-tests). يخرج برمز 1 عند أي فشل.
import asyncio, json, re, os, base64, subprocess, sys, time, shutil, hashlib
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.abspath(os.environ.get('RIFAQ_SITE', os.path.join(HERE, '..', '_site')))
OUT = os.environ.get('RIFAQ_TEST_OUT', '/tmp/rifaq_hosttest')
PORT = 8765
os.makedirs(OUT, exist_ok=True)
R = []
def rec(n, ok, d=''):
    R.append((n, bool(ok), str(d)[:220])); print(('PASS' if ok else 'FAIL'), n, '|', str(d)[:220], flush=True)

ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
PACK_RE = re.compile(r'(var PACK_DATA = )(.*?)(;\n/\* ===PACK_DATA_END)', re.S)

def serve(site, port):
    p = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '-d', site], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1); return p

async def ctx_page(b, init=None):
    ctx = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar', permissions=['microphone'], accept_downloads=True)
    if init: await ctx.add_init_script(init)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)[:160]))
    pg.on('console', lambda m: errs.append(m.type + ':' + m.text[:200]) if (m.type == 'error' or 'Content Security' in m.text or 'Refused' in m.text) else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    return ctx, pg, errs

async def appframe(pg, tries=40, not_url=None):
    for _ in range(tries):
        for fr in pg.frames:
            if fr != pg.main_frame and fr.url.startswith('blob:') and fr.url != not_url:
                try:
                    if await fr.evaluate("typeof PACK_DATA !== 'undefined' && typeof STATE !== 'undefined'"): return fr
                except Exception: pass
        await pg.wait_for_timeout(150)
    raise RuntimeError('app frame not found')

async def setup_student(fr, name='مريم أحمد', share=True):
    await fr.evaluate("continueFromSplash()")
    await fr.fill('#setup-name', name); await fr.click('#setup-girl')
    await fr.evaluate("saveSetup()"); await fr.wait_for_timeout(400)
    await fr.fill('#consent-name', 'أحمد محمود')
    boxes = [c for c in await fr.query_selector_all('input[type=checkbox]') if await c.is_visible()]
    for i, c in enumerate(boxes):
        if i == 2 and not share: continue
        if not await c.is_checked(): await c.check()
    await fr.click('text=حفظ وابدأ'); await fr.wait_for_timeout(300)

async def record(fr, sec='s2_idhhar', item='r2_1'):
    await fr.evaluate(f"openSection('{sec}')"); await fr.wait_for_timeout(300)
    btn = fr.locator(f'[data-call*="startRec\\",\\"{item}"]').first
    for _ in range(5):
        if await btn.is_visible(): break
        await fr.click('text=التالي ›'); await fr.wait_for_timeout(200)
    await btn.click(); await fr.wait_for_timeout(3200)
    await fr.locator(f'[data-call*="startRec\\",\\"{item}"]').first.click(); await fr.wait_for_timeout(1200)

async def export_from(pg, fr, js, path):
    async with pg.expect_download(timeout=30000) as dl:
        await fr.evaluate(js)
    d = await dl.value; await d.save_as(path); return path

async def open_file(pg, path):
    prev = None
    for fr in pg.frames:
        if fr != pg.main_frame and fr.url.startswith('blob:'): prev = fr.url
    await pg.set_input_files('#file-in', path)
    fr = await appframe(pg, not_url=prev)
    await fr.wait_for_function("typeof GIFT_TRUST !== 'undefined' && (PACK_DATA.packageType !== 'approved_gift' || GIFT_TRUST !== null)", timeout=10000)
    return fr

def pack_of(path):
    return json.loads(PACK_RE.search(open(path, encoding='utf-8').read()).group(2))

def with_pack(path, pack, out):
    src = open(path, encoding='utf-8').read(); m = PACK_RE.search(src)
    open(out, 'w', encoding='utf-8').write(src[:m.start(2)] + json.dumps(pack, ensure_ascii=False) + src[m.end(2):])
    return out

def ev(target, js, *a):
    return asyncio.wait_for(target.evaluate(js, *a), 20)

async def main():
    srv = serve(SITE, PORT); BASE = f'http://localhost:{PORT}'
    srv2 = None
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

            # H2 student in host + export submission
            ctx, pg, errs = await ctx_page(b)
            await pg.goto(BASE + '/open.html?src=app'); fr = await appframe(pg)
            await setup_student(fr); await record(fr)
            sub = await export_from(pg, fr, """(function(){ showExportDialog('submission'); setTimeout(function(){ document.querySelectorAll('#modal button').forEach(function(b){ if(b.textContent.indexOf('إرسال للمعلم')>=0) b.click(); }); }, 300); })()""", f'{OUT}/sub.html')
            rec('H2 app in host: setup, record, export submission', not errs and os.path.getsize(sub) > 100000, (errs[:3], os.path.getsize(sub)))
            await fr.evaluate("STATE.assess = STATE.assess || assessEmptyState(); STATE.assess.examDone={1:true}; save()")
            await pg.reload(); fr = await appframe(pg)
            rec('H3 state persists after reloading host', await fr.evaluate("JSON.stringify(STATE.assess && STATE.assess.examDone)") == '{"1":true}')
            await ctx.close()

            # H4-H6 teacher via host
            ctxT, pT, errsT = await ctx_page(b)
            await pT.goto(BASE + '/open.html'); frT = await open_file(pT, sub)
            body = await frT.inner_text('body')
            rec('H4 submission opens as teacher view', 'صفحة مراجعة المعلم' in body and 'مريم أحمد' in body)
            allow = await frT.evaluate("CALLABLE_ALLOW")
            rec('R7 «تم الحذف» (markRosterDeleted) is callable', 'markRosterDeleted' in allow, len(allow))
            await frT.fill('#review-teacher-name', 'الشيخ محمود')
            await frT.click('[data-call*="setReview\\",\\"r2_1\\",\\"approved"]'); await frT.wait_for_timeout(300)
            gift = await export_from(pT, frT, "exportApprovedPack()", f'{OUT}/gift.html')
            teacher_jwk = json.loads(await frT.evaluate("keyDbGet(SIG_KEY_ID).then(r=>JSON.stringify(r.publicJwk))"))
            rec('H5 teacher exports signed gift', os.path.getsize(gift) > 100000 and not errsT and pack_of(gift).get('signature'), errsT[:3])
            await pT.goto(BASE + '/open.html'); await pT.wait_for_timeout(600)
            items = await pT.eval_on_selector_all('#recent li .r-name', 'els=>els.map(e=>e.textContent)')
            meta = await pT.eval_on_selector_all('#recent li .r-meta', 'els=>els.map(e=>e.textContent)')
            rec('H6 recent list shows submission with 30-day expiry', any('إرسال للمراجعة' in i for i in items) and any('يُحذف تلقائيًا بعد 30' in m for m in meta), (items, meta[:1]))
            # R4 «تم الحذف» عند المعلم يحذف النسخة من الملفات الأخيرة
            await pT.click('#recent li .r-open'); frT2 = await appframe(pT)
            sid = await frT2.evaluate("PACK_DATA.studentId")
            await frT2.evaluate(f"markRosterDeleted({json.dumps(sid)})"); await pT.wait_for_timeout(800)
            left = await pT.evaluate("window.RIFAQ_HOST && indexedDB.open('rifaq_host_v1') && new Promise(r=>{var q=indexedDB.open('rifaq_host_v1');q.onsuccess=()=>{var t=q.result.transaction('recent').objectStore('recent').getAll();t.onsuccess=()=>r(t.result.map(x=>x.kind))}})")
            rec('R4a teacher «تم الحذف» purges the stored copy', not any('إرسال' in k for k in left), left)
            await ctxT.close()

            # R2 trust anchor: a gift whose key is only listed INSIDE the file must not be verified
            g = pack_of(gift); g['trustedTeacherKeys'] = [teacher_jwk]
            self_trusted = with_pack(gift, g, f'{OUT}/gift_selftrusted.html')
            ctxR, pR, errsR = await ctx_page(b)
            await pR.goto(BASE + '/open.html'); frR = await open_file(pR, self_trusted)
            # المهاجم يضع مفتاحه في القائمة ثم يعيد التوقيع داخل التطبيق نفسه
            forged = await frR.evaluate("""(async () => { PACK_DATA.trustedTeacherKeys = [PACK_DATA.signature.key];
                 await signGiftPack(PACK_DATA); return await verifyGiftPack(PACK_DATA); })()""")
            t0 = await frR.evaluate("GIFT_TRUST")
            rec('R2a gift trusted only by its own embedded list is NOT verified in the app', t0 == 'untrusted' and forged == 'untrusted', (t0, forged))
            await ctxR.close()
            # ... and IS verified when the installed app pins the teacher's key
            pinned_site = os.path.join(OUT, 'site_pinned')
            shutil.rmtree(pinned_site, ignore_errors=True); shutil.copytree(SITE, pinned_site)
            json.dump({'keys': [teacher_jwk]}, open(os.path.join(pinned_site, 'trusted-teachers.json'), 'w'))
            srv2 = serve(pinned_site, PORT + 1)
            ctxP, pP, errsP = await ctx_page(b)
            await pP.goto(f'http://localhost:{PORT + 1}/open.html'); frP = await open_file(pP, gift)
            tP = await frP.evaluate("GIFT_TRUST")
            g2 = pack_of(gift); grp = g2['approvedPeerRecordings'][0]; k0 = list(grp['audios'])[0]
            grp['audios'][k0]['audio'] = 'data:audio/webm;base64,QUJDREVG'
            await pP.click('#open-btn'); frP2 = await open_file(pP, with_pack(gift, g2, f'{OUT}/gift_tampered.html'))
            tP2 = await frP2.evaluate("GIFT_TRUST")
            rec('R2b pinned teacher key: genuine gift verified, tampered audio invalid', tP == 'verified' and tP2 == 'invalid', (tP, tP2))
            await ctxP.close()

            # ===== 9.39.3: انحدار مراجعة الخصم المستقلة (RT9392-01..04) =====
            # RT9392-01: علامة موضع المرساة داخل بيانات الملف لا تغيّر موضع الحقن (قائمة فارغة/غير فارغة/فشل التحميل)
            ctxF, pF, _ = await ctx_page(b)
            await pF.goto(BASE + '/open.html?src=app'); frF = await appframe(pF)
            attacker = json.loads(await frF.evaluate("""(async()=>{let k=await getTeacherSigningKey();let p=JSON.parse(JSON.stringify(PACK_DATA));
                Object.assign(p,{packageType:'approved_gift',approved:true,studentAudios:{},approvedStudentAudios:{},approvedPeerRecordings:[],trustedTeacherKeys:[k.publicJwk],
                reviewerMarker:'var PINNED_TEACHER_KEYS = null; /* RIFAQ_PINNED_KEYS */'});await signGiftPack(p);return JSON.stringify(p)})()"""))
            marker_gift = with_pack(gift, attacker, f'{OUT}/gift_marker.html')
            await ctxF.close()
            res = []
            for base, route in [(BASE, None), (f'http://localhost:{PORT + 1}', None), (f'http://localhost:{PORT + 1}', 'abort')]:
                ctxM, pM, _ = await ctx_page(b)
                if route: await pM.route('**/trusted-teachers.json', lambda r: r.abort())
                await pM.goto(base + '/open.html')
                try:
                    frM = await open_file(pM, marker_gift)
                    res.append((await frM.evaluate("GIFT_TRUST"), await frM.evaluate("JSON.stringify(PINNED_TEACHER_KEYS)")))
                except Exception as e:
                    res.append(('noframe', str(e)[:40]))
                if route:  # والإهداء الأصلي لا يُعدّ موثّقًا إن تعذّر تحميل المفاتيح (إغلاق آمن)
                    await pM.click('#open-btn'); frM2 = await open_file(pM, gift); res.append((await frM2.evaluate("GIFT_TRUST"), await frM2.evaluate("JSON.stringify(PINNED_TEACHER_KEYS)")))
                await ctxM.close()
            rec('R8 RT9392-01 marker inside data cannot unpin trust (empty, pinned, fetch-failed)',
                [r[0] for r in res] == ['untrusted'] * 4 and all(r[1] is not None and r[1].startswith('[') for r in res), res)
            try:
                # RT9392-02: كل حقل في الإهداء مغطى بالتوقيع؛ أي إضافة أو تغيير غير موقّع = invalid ولا يُعرض صوت الزملاء
                WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='
                def variant(fn, name):
                    pk = pack_of(gift); fn(pk); return with_pack(gift, pk, f'{OUT}/{name}.html')
                cases = [('legacy', lambda pk: pk.__setitem__('approvedStudentAudios', {'r2_1': {'audio': WAV, 'status': 'approved'}})),
                         ('photo', lambda pk: pk['approvedPeerRecordings'][0].__setitem__('photo', 'data:image/png;base64,iVBORw0KGgo=')),
                         ('sheikh', lambda pk: pk.__setitem__('sheikhName', 'اسم مزوّر')),
                         ('downgrade', lambda pk: pk['signature'].pop('mv', None))]
                ctxV, pV, errsV = await ctx_page(b)
                await pV.goto(f'http://localhost:{PORT + 1}/open.html'); frV = await open_file(pV, gift)
                k_audio = list(pack_of(gift)['approvedPeerRecordings'][0]['audios'])[0]
                good = (await frV.evaluate("GIFT_TRUST"), bool(await frV.evaluate(f"peerAudioBlocks({json.dumps(k_audio)})")))
                out = {}
                for name, fn in cases:
                    await pV.click('#open-btn'); frV = await open_file(pV, variant(fn, 'gift_' + name))
                    out[name] = (await frV.evaluate("GIFT_TRUST"), await frV.evaluate(f"peerAudioBlocks({json.dumps(k_audio)}) + peerAudioBlocks('r2_1')"))
                await ctxV.close()
                rec('R9 RT9392-02 unsigned additions/changes rejected and not shown; genuine still verified',
                    good == ('verified', True) and out['legacy'] == ('invalid', '') and out['photo'] == ('invalid', '') and out['sheikh'] == ('invalid', '') and out['downgrade'] == ('outdated', ''),
                    (good, {k: (v[0], len(v[1])) for k, v in out.items()}))
            except Exception as e:
                rec('R9 (exception)', False, repr(e)[:200])
            try:
                # RT9392-03: حذف محجوب = لا إعلان نجاح، والبيانات لا تُكتب؛ ثم يكتمل فعليًا ويُعلن بعد إغلاق الاتصال الحاجب
                ctxD3, pD3, _ = await ctx_page(b); msgs = []
                pD3.on('dialog', lambda d: msgs.append(d.message))
                await pD3.goto(BASE + '/open.html?src=app'); frD3 = await appframe(pD3)
                await ev(frD3, "dbPut('probe', new Blob(['private-audio']))")
                dbn = await ev(frD3, "DB_NAME")
                await ev(pD3, "n=>new Promise(r=>{var q=indexedDB.open(n);q.onsuccess=()=>{window.holdDB=q.result;r(1)}})", dbn)
                await ev(frD3, "setTimeout(deleteChildDataOnDevice, 0)"); await pD3.wait_for_timeout(7000)
                present = await ev(pD3, "()=>new Promise(r=>{var q=holdDB.transaction('audios').objectStore('audios').get('probe');q.onsuccess=async()=>r(q.result?await q.result.text():null)})")
                late = await ev(frD3, "dbPut('late', new Blob(['x'])).then(()=>'saved',()=>'refused')")
                pend = await ev(frD3, "pendingDbDeletes()")
                phase1 = (not any('تم حذف بيانات' in m for m in msgs), any('لم يكتمل' in m for m in msgs), present, late, dbn in pend)
                await ev(pD3, "holdDB.close()"); await pD3.wait_for_timeout(2500)
                gone = await ev(pD3, "n=>new Promise(r=>{var q=indexedDB.open(n);q.onupgradeneeded=()=>{};q.onsuccess=()=>{var has=q.result.objectStoreNames.contains('audios');q.result.close();r(!has)}})", dbn)
                mark = await ev(pD3, "localStorage.getItem('rifaq_pending_db_delete_v1')")
                phase2 = (any('اكتمل حذف' in m for m in msgs), gone, mark)
                await ctxD3.close()
                rec('R10 RT9392-03 blocked delete not announced, no late writes, completes for real afterwards',
                    phase1 == (True, True, 'private-audio', 'refused', True) and phase2 == (True, True, None), (phase1, phase2))
            except Exception as e:
                rec('R10 (exception)', False, repr(e)[:200])
            try:
                # RT9392-04: حذف ملفات طفل لا يمسّ ملفات طفل آخر في الحزمة نفسها
                ctxK, pK, _ = await ctx_page(b)
                await pK.goto(BASE + '/open.html'); await pK.wait_for_timeout(500)
                base_pk = pack_of(sub)
                for nm, sid, pid in [('a1', 'child-A', 'shared-package'), ('b1', 'child-B', 'shared-package'), ('a2', 'child-A', 'other-package'), ('f0', '', 'shared-package'), ('f9', '', 'third-package')]:
                    q = json.loads(json.dumps(base_pk)); q.update(studentId=sid, studentName=sid or 'بلا', packageId=pid, signature=None)
                    if not sid: q['packageType'] = 'student_fresh'
                    await pK.evaluate('(x)=>RIFAQ_HOST.openText(x.n, x.t)', {'n': nm + '.html', 't': open(with_pack(sub, q, f'{OUT}/k_{nm}.html'), encoding='utf-8').read()})
                    await pK.wait_for_timeout(300)
                listing = """async(a)=>{let c=()=>new Promise(r=>{let o=indexedDB.open('rifaq_host_v1');o.onsuccess=()=>{let q=o.result.transaction('recent').objectStore('recent').getAll();
                    q.onsuccess=()=>{o.result.close();r(q.result.map(x=>{let p=JSON.parse(x.json);return (p.studentId||'-')+'@'+p.packageId}).sort())}}});
                    let before=await c(); let n=await RIFAQ_HOST.forgetPack(a[0],a[1]); return [before,n,await c()]}"""
                r1 = await pK.evaluate(listing, ['shared-package', 'child-A'])
                r2 = await pK.evaluate(listing, ['third-package', None])
                await ctxK.close()
                rec('R11 RT9392-04 forgetPack removes only that child (all its packages) + identity-less file of the package',
                    len(r1[0]) == 5 and r1[2] == ['-@third-package', 'child-B@shared-package'] and r2[2] == ['child-B@shared-package'], (r1, r2))

            except Exception as e:
                rec('R11 (exception)', False, repr(e)[:200])
            # R11 (التقرير الأول): رفع ملف بديل والإرسال يخضعان لبوابة الموافقة على مستوى الدالة
            try:
                ctxC, pC, _ = await ctx_page(b); dls = []
                pC.on('download', lambda d: dls.append(d))
                await pC.goto(BASE + '/open.html?src=app'); frC = await appframe(pC)
                await frC.evaluate("""STATE.student={name:'بلا موافقة',gender:'boy',id:'stu_x',consent:null};STATE.role='student';STATE.studentAudios={r2_1:{status:'pending',updatedAt:Date.now()}};save()""")
                await frC.evaluate("doExportStudent('submission')"); await pC.wait_for_timeout(1500)
                gate1 = await frC.evaluate("!!document.getElementById('consent-name')")
                await frC.evaluate("closeModal()")
                up = await frC.evaluate("""(async()=>{let f=new File([new Uint8Array(400)],'a.webm',{type:'audio/webm'});let put=0;let o=dbPut;dbPut=async function(){put++;return o.apply(this,arguments)};
                    await uploadReplacementAudio({target:{files:[f],value:''}},'r3_1');dbPut=o;return [put,!!document.getElementById('consent-name')]})()""")
                await ctxC.close()
                rec('R12 R11 consent gate enforced in export and file-upload functions', gate1 and not dls and up == [0, True], (gate1, len(dls), up))
            except Exception as e:
                rec('R12 (exception)', False, repr(e)[:200])

            # R1 __proto__ injection rejected by host (and never shown)
            g3 = pack_of(gift); grp3 = g3['approvedPeerRecordings'][0]
            grp3['audios']['__proto__'] = {'r3_1': {'audio': 'data:audio/webm;base64,' + 'QUJD' * 10, 'status': 'approved'}}
            evil = with_pack(gift, g3, f'{OUT}/gift_proto.html')
            ctxE, pE, errsE = await ctx_page(b)
            await pE.goto(BASE + '/open.html'); await pE.set_input_files('#file-in', evil); await pE.wait_for_timeout(1200)
            err = await pE.inner_text('#err'); nfr = len([f for f in pE.frames if f.url.startswith('blob:')])
            rec('R1 host rejects __proto__-injected pack', 'معدَّل' in err and nfr == 0, err[:60])

            # H8/H9 injected code never runs; non-Rifaq file rejected
            src = open(sub, encoding='utf-8').read()
            code_evil = src.replace('<body', '<script>window.top.PWNED=1</script><body', 1).replace('function GT(t){', 'function GT(t){ try{window.top.PWNED2=1}catch(e){}', 1)
            open(f'{OUT}/evil.html', 'w', encoding='utf-8').write(code_evil)
            await pE.click('#open-btn'); await open_file(pE, f'{OUT}/evil.html'); await pE.wait_for_timeout(600)
            rec('H8 injected code in opened file never executes', await pE.evaluate("[window.PWNED, window.PWNED2]") == [None, None])
            open(f'{OUT}/other.html', 'w').write('<html><body><script>window.top.X=1</script>hi</body></html>')
            await pE.click('#open-btn'); await pE.set_input_files('#file-in', f'{OUT}/other.html'); await pE.wait_for_timeout(500)
            rec('H9 non-Rifaq HTML rejected, not run', 'ليس ملفًا من ملفات رفاق التحفة' in await pE.inner_text('#err') and await pE.evaluate("window.X") is None)

            # R5 crafted large file does not freeze the host (was quadratic regex)
            junk = ('/* ===PACK_DATA_START=== */ x ' * 60000)
            open(f'{OUT}/redos.html', 'w').write(junk)
            t = time.time(); await pE.click('#open-btn'); await pE.set_input_files('#file-in', f'{OUT}/redos.html')
            await pE.wait_for_function("document.getElementById('err').textContent.length > 0", timeout=20000)
            el = time.time() - t
            rec('R5 1.6 MB crafted file handled in < 2 s', el < 2, f'{el:.2f}s, {len(junk)//1024} KB')
            await ctxE.close()

            # R3 studio: crafted curriculum must not execute; approved curriculum still imports
            ctxS, pS, errsS = await ctx_page(b)
            await pS.goto(BASE + '/open.html?src=studio'); await pS.wait_for_timeout(1500)
            st = [f for f in pS.frames if '/studio/index.html' in f.url][0]
            await st.fill('#in-sheikh-name', 'الشيخ'); await st.fill('#in-supervisor-name', 'المشرف')
            await st.click('text=ابدأ الاستوديو'); await pS.wait_for_timeout(800)
            cur = [{'id': 's1', 'title': 'قسم', 'items': [{'id': 'r1', 'type': 'quran', 'text': '<img src=x onerror="window.top.PWNED_STUDIO=1">نص'}], 'questions': []}]
            json.dump(cur, open(f'{OUT}/evil_curr.json', 'w'))
            await st.set_input_files('#in-curriculum', f'{OUT}/evil_curr.json'); await pS.wait_for_timeout(1500)
            pw = await pS.evaluate("window.PWNED_STUDIO")
            cur_bad_id = [{'id': 's1', 'title': 'قسم', 'items': [{'id': "r1');window.top.PWNED_ID=1;('", 'type': 'quran', 'text': 'نص'}], 'questions': []}]
            json.dump(cur_bad_id, open(f'{OUT}/evil_id.json', 'w'))
            await st.set_input_files('#in-curriculum', f'{OUT}/evil_id.json'); await pS.wait_for_timeout(800)
            status_bad = await st.inner_text('#curr-status')
            rec('R3 studio: HTML in curriculum not executed; unsafe ids rejected', pw is None and '❌' in status_bad, (pw, status_bad[:60]))
            approved = os.path.join(HERE, '..', 'curriculum', 'منهج_المرحلة1_كامل_معتمد_v1.3.json')
            if os.path.exists(approved):
                await st.set_input_files('#in-curriculum', approved); await pS.wait_for_timeout(1500)
                ok_status = await st.inner_text('#curr-status')
                same = await st.evaluate("""(() => { var a = JSON.stringify(CURRICULUM); return a.indexOf('&amp;') < 0 && a.indexOf('&lt;') < 0 && CURRICULUM.length === 16; })()""")
                rec('R3b approved curriculum imports unchanged by sanitizer', '✅' in ok_status and same, ok_status[:60])
            await ctxS.close()

            # R4b child-data deletion purges the host copy of that pack
            ctxD, pD, errsD = await ctx_page(b)
            await pD.goto(BASE + '/open.html'); frD = await open_file(pD, gift)
            await frD.evaluate("continueFromSplash()"); await frD.fill('#setup-name', 'سارة'); await frD.evaluate("saveSetup()"); await pD.wait_for_timeout(400)
            await frD.evaluate("document.getElementById('consent-no') && document.getElementById('consent-no').click()")
            n_before = await pD.evaluate("new Promise(r=>{var q=indexedDB.open('rifaq_host_v1');q.onsuccess=()=>{var t=q.result.transaction('recent').objectStore('recent').count();t.onsuccess=()=>r(t.result)}})")
            await frD.evaluate("deleteChildDataOnDevice()"); await pD.wait_for_timeout(2500)
            n_after = await pD.evaluate("new Promise(r=>{var q=indexedDB.open('rifaq_host_v1');q.onsuccess=()=>{var t=q.result.transaction('recent').objectStore('recent').count();t.onsuccess=()=>r(t.result)}})")
            rec('R4b «حذف بيانات الطالب» also removes the stored copy', n_before >= 1 and n_after == n_before - 1, (n_before, n_after))
            # R6 expiry after 30 days
            await pD.evaluate("""new Promise(r=>{var q=indexedDB.open('rifaq_host_v1');q.onsuccess=()=>{var tx=q.result.transaction('recent','readwrite');
                tx.objectStore('recent').put({id:'old1',name:'old.html',kind:'📨',who:'قديم',savedAt:Date.now(),firstAt:Date.now()-31*86400000,size:10,json:'{}'});tx.oncomplete=()=>r(1)}})""")
            await pD.goto(BASE + '/open.html'); await pD.wait_for_timeout(800)
            names = await pD.eval_on_selector_all('#recent li .r-name', 'els=>els.map(e=>e.textContent)')
            still = await pD.evaluate("new Promise(r=>{var q=indexedDB.open('rifaq_host_v1');q.onsuccess=()=>{var t=q.result.transaction('recent').objectStore('recent').get('old1');t.onsuccess=()=>r(!!t.result)}})")
            rec('R6 copies older than 30 days are purged', not any('قديم' in n for n in names) and still is False, names)
            await ctxD.close()

            # H10 studio + trial through host
            ctxS, pS, errsS = await ctx_page(b)
            await pS.goto(BASE + '/open.html?src=trial'); frTr = await appframe(pS)
            rec('H10 trial opens in host', await frTr.evaluate("PACK_DATA.packageId") == 'pack_kids_stage1' and not errsS, errsS[:2])
            await ctxS.close()

            # H11/H12 Android bridge simulation: export -> cache only (no public Documents) + Share; cache cleaned at start
            init = """
              window.__calls = [];
              window.Capacitor = { isNativePlatform: () => true,
                nativePromise: (pl, m, o) => { window.__calls.push([pl, m, o]);
                  if (m === 'writeFile') return Promise.resolve({ uri: 'file:///cache/' + o.path });
                  return Promise.resolve({}); },
                nativeCallback: (pl, m, o, cb) => { window.__calls.push([pl, m, o]); return 'cb1'; } };
            """
            ctxA, pA, errsA = await ctx_page(b, init=init)
            await pA.goto(BASE + '/index.html'); await pA.wait_for_timeout(600)
            hrefs = await pA.eval_on_selector_all('a.card', 'els=>els.map(e=>e.getAttribute("href"))')
            rec('H11 Android: launcher routes via host', all(h.startswith('./open.html') for h in hrefs), hrefs)
            await pA.goto(BASE + '/open.html?src=app'); frA = await appframe(pA)
            await setup_student(frA, 'سارة'); await record(frA)
            await frA.evaluate("""(function(){ showExportDialog('submission'); setTimeout(function(){ document.querySelectorAll('#modal button').forEach(function(b){ if(b.textContent.indexOf('إرسال للمعلم')>=0) b.click(); }); }, 300); })()""")
            await pA.wait_for_timeout(3500)
            calls = await pA.evaluate("window.__calls.map(c=>[c[0],c[1],(c[2]&&(c[2].directory||''))+':'+(c[2]&&(c[2].path||c[2].eventName)||'')])")
            wr = [c for c in calls if c[1] == 'writeFile']
            ok = (len(wr) == 1 and wr[0][2].startswith('CACHE:share/') and not any('DOCUMENTS' in c[2] for c in calls)
                  and any(c[0] == 'Share' for c in calls) and any(c[1] == 'rmdir' for c in calls))
            rec('H12 Android: export writes app cache only + Share; old share cache cleaned', ok, calls)
            await ctxA.close()
            await b.close()
    finally:
        srv.terminate()
        if srv2: srv2.terminate()
    passed = sum(1 for r in R if r[1])
    print('\nSUMMARY:', passed, '/', len(R))
    json.dump(R, open(f'{OUT}/results.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    sys.exit(0 if passed == len(R) else 1)

asyncio.run(main())
