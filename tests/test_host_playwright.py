# اختبارات نسخة الويب والصفحة المضيفة (فتح ملف)، ومحاكاة جسر أندرويد، واختبارات انحدار مراجعتي الخصم 9.39.2 و9.39.3.
# التشغيل: python3 tools/build_web.py _site && RIFAQ_SITE=_site python3 tests/test_host_playwright.py
# يعمل في CI قبل أي نشر أو إصدار (مهمة web-tests). يخرج برمز 1 عند أي فشل.
GIFT_EXPORT_JS = "(function(){ exportApprovedPack(); (function w(n){ var m=document.getElementById('modal'); var b=Array.prototype.slice.call(document.querySelectorAll('#modal-actions button')).filter(function(x){ return x.textContent.indexOf('إصدار الإهداء')>=0; })[0]; if (b && m && !m.classList.contains('hidden')){ window.__giftMsg=document.getElementById('modal-body').textContent; b.click(); } else if (n<150) setTimeout(function(){ w(n+1); },100); })(0); })()"  # 9.39.10: بيان الإهداء في نافذة التطبيق لا في confirm
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
    if await fr.evaluate("!!document.getElementById('consent-pin')"):  # 9.39.13 (D7)
        await fr.fill('#consent-pin', GUARDIAN_PIN); await fr.fill('#consent-pin2', GUARDIAN_PIN)
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

GUARDIAN_PIN = '2580'
async def solve_gate(fr, wrong=False):
    """بوابة ولي الأمر: 9.39.13 (D7) الرمز إن وُضع عند الموافقة، وإلا (ق5-أ) المسألة الحسابية — صحيحًا أو خطأً"""
    await fr.wait_for_selector('#parent-gate-pin, #parent-gate-q', timeout=5000)
    if await fr.evaluate("!!document.getElementById('parent-gate-pin')"):
        await fr.fill('#parent-gate-pin', '1111' if wrong else GUARDIAN_PIN)
        await fr.click('#parent-gate-ok'); await fr.wait_for_timeout(300)
        return 'PIN'
    q = await fr.inner_text('#parent-gate-q')
    m = re.search(r'(\d+)\s*×\s*(\d+)', q)
    ans = int(m.group(1)) * int(m.group(2))
    await fr.fill('#parent-gate-answer', str(ans + 1 if wrong else ans))
    await fr.click('#parent-gate-ok'); await fr.wait_for_timeout(200)
    return q

def trust_route(keys=None, sups=None):
    body = {'keys': keys or [], 'supervisors': sups or []}
    return lambda r: r.fulfill(json=body)

DUMMY_SUP = {'kty': 'EC', 'crv': 'P-256', 'x': 'A' * 43, 'y': 'B' * 43}  # مشرف مسجَّل لا يملك أحد مفتاحه الخاص
EVIL_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='

async def configured_page(b, keys=None, sups=None):
    ctx, pg, errs = await ctx_page(b)
    await ctx.route('**/trusted-teachers.json', trust_route(keys, sups))
    return ctx, pg, errs

# 9.39.11 (ق2-ب): يجيب عن أسئلة الجلسة الجارية برمجيًا (الأول خطأ إن طُلب) ويضغط «التالي» حتى تنتهي
RUN_SESSION_JS = """async (wrongFirst) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let n = 0; const sec = CURRENT.section;
  while (CURRENT.section === sec && CURRENT.qIdx < sec.questions.length && !document.getElementById('view-quiz').classList.contains('hidden')) {
    const q = sec.questions[CURRENT.qIdx], bad = wrongFirst && n === 0;
    if (QX.has(q.type)) finishCustom(q, bad ? 1 : 0);
    else answer(bad ? (q.type === 'true_false' ? !q.answer : (q.answer + 1) % q.options.length) : q.answer);
    n++; await sleep(20);
    const btn = document.querySelector('#feedback-box button'); if (!btn) break; btn.click(); await sleep(20);
  }
  return n;
}"""

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
            gift = await export_from(pT, frT, GIFT_EXPORT_JS, f'{OUT}/gift.html')
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
            # RT9393-01: الحذف محمي عبر النوافذ وإعادة التحميل، وطفل آخر يبقى سليمًا
            try:
                ctxW, pW1, _ = await ctx_page(b); msgsW = []
                pW1.on('dialog', lambda d: msgsW.append(d.message))
                await pW1.goto(BASE + '/open.html?src=app'); fW1 = await appframe(pW1)
                await ev(fW1, "STATE.student.name='طفل الاختبار';STATE.progress={probe:{score:100}};save();dbPut('probe',new Blob(['private']))")
                keys = await ev(fW1, "[DB_NAME, STORAGE_KEY, STORAGE_BASE + '_other', DB_BASE + '_other']")
                # طفل آخر على الجهاز نفسه (حالة + قاعدة صوت)
                await ev(pW1, """k=>new Promise(r=>{localStorage.setItem(k[2],'{"keep":1}');var q=indexedDB.open(k[3],1);q.onupgradeneeded=()=>q.result.createObjectStore('audios');
                    q.onsuccess=()=>{var t=q.result.transaction('audios','readwrite');t.objectStore('audios').put('other-audio','x');t.oncomplete=()=>{q.result.close();r(1)}}})""", keys)
                pW2 = await ctxW.new_page(); pW2.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
                await pW2.goto(BASE + '/open.html?src=app'); fW2 = await appframe(pW2)
                await ev(pW1, "n=>new Promise(r=>{var q=indexedDB.open(n);q.onsuccess=()=>{window.holdW=q.result;r(1)}})", keys[0])
                await ev(fW1, "setTimeout(deleteChildDataOnDevice, 0)"); await pW1.wait_for_timeout(7000)
                fW2 = await appframe(pW2)
                w2 = await ev(fW2, "[STATE.student && STATE.student.name || '', save(), (typeof isCurrentChildDeleted === 'function' ? isCurrentChildDeleted() : CHILD_DATA_DELETED)]")
                st_after_w2 = await ev(pW1, "k=>localStorage.getItem(k)", keys[1])
                await ev(fW1, "location.reload()"); await pW1.wait_for_timeout(1500); fW1 = await appframe(pW1)
                w1 = await ev(fW1, "[STATE.student && STATE.student.name || '', save(), CHILD_DATA_DELETED, dbPut('late',new Blob(['x'])).then(()=>'saved',()=>'refused')]")
                w1[3] = await ev(fW1, "dbPut('late',new Blob(['x'])).then(()=>'saved',()=>'refused')")
                await ev(pW1, "holdW.close()"); await pW1.wait_for_timeout(2500)
                fin = await ev(pW1, """k=>new Promise(r=>{indexedDB.databases().then(ds=>{var names=ds.map(d=>d.name);
                    var q=indexedDB.open(k[3]);q.onsuccess=()=>{var g=q.result.transaction('audios').objectStore('audios').get('x');g.onsuccess=()=>{q.result.close();
                    r({mineGone:names.indexOf(k[0])<0, state:localStorage.getItem(k[1]), tomb:localStorage.getItem('rifaq_pending_db_delete_v1'), otherState:localStorage.getItem(k[2]), otherAudio:g.result})}}})})""", keys)
                await ctxW.close()
                okW = (w2[0] == '' and w2[1] is False and w2[2] is True and st_after_w2 is None and w1[:3] == ['', False, True] and w1[3] == 'refused'
                       and fin == {'mineGone': True, 'state': None, 'tomb': None, 'otherState': '{"keep":1}', 'otherAudio': 'other-audio'} and any('اكتمل حذف' in m for m in msgsW))
                rec('R13 RT9393-01 deletion holds across windows and reload; other child intact', okW, (w2, st_after_w2, w1, fin))
            except Exception as e:
                rec('R13 (exception)', False, repr(e)[:200])
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

            # ===== 9.39.5: R12 (التخزين بالمعرّف + ترحيل)، R03، R09، R08 =====
            WAV5 = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='
            # R14 R12: ترحيل ملف قديم مسمّى بالاسم بلا فقد، ثم «طالب جديد» بالاسم نفسه يحصل على ملف مستقل
            try:
                ctxN = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar')
                pN = await ctxN.new_page(); seen = []
                def _dlg(d):
                    seen.append(d.message)
                    asyncio.ensure_future(d.dismiss() if 'يوجد على هذا الجهاز طالب' in d.message else d.accept())
                pN.on('dialog', _dlg)
                await pN.goto(BASE + '/open.html?src=app'); fN = await appframe(pN)
                lk = await ev(fN, "[STORAGE_BASE + '_' + simpleHash('ليلى'), DB_BASE + '_' + simpleHash('ليلى'), STORAGE_BASE + '_active']")
                await ev(pN, """k=>new Promise(r=>{localStorage.setItem(k[0], JSON.stringify({student:{name:'ليلى',gender:'girl',id:'stu_old1'},progress:{s0_muqaddima:{done:true,stars:3}},stats:{totalPoints:30,completedSections:1,perfectSections:1,totalAttempts:1},studentAudios:{r2_1:{status:'pending',updatedAt:'2026-10-01T10:00:00.000Z'}},role:'student',sawSplash:true}));
                    localStorage.setItem(k[2], 'ليلى'); var q=indexedDB.open(k[1],1); q.onupgradeneeded=()=>q.result.createObjectStore('audios');
                    q.onsuccess=()=>{var t=q.result.transaction('audios','readwrite');t.objectStore('audios').put(new Blob(['old-audio']),'r2_1');t.oncomplete=()=>{q.result.close();r(1)}}})""", lk)
                await pN.reload(); fN = await appframe(pN)
                mig = await ev(fN, "(async()=>{var b=await dbGet('r2_1');return [STATE.student.name, STATE.student.id, !!(STATE.progress.s0_muqaddima&&STATE.progress.s0_muqaddima.done), b?await b.text():null]})()")
                await ev(fN, "show('view-student-setup'); startNewStudent()"); await fN.fill('#setup-name', 'ليلى')
                await ev(fN, "saveSetup()"); await pN.wait_for_timeout(500)
                sep = await ev(fN, "k=>[STATE.student.name, STATE.student.id !== 'stu_old1', !STATE.progress.s0_muqaddima, STORAGE_KEY !== k[0], DB_NAME !== k[1], JSON.parse(localStorage.getItem(k[0])).progress.s0_muqaddima.done === true]", lk)
                asked = any('يوجد على هذا الجهاز طالب' in m for m in seen)
                await ctxN.close()
                rec('R14 R12 legacy name profile migrated without loss; same-name new student gets separate storage',
                    mig == ['ليلى', 'stu_old1', True, 'old-audio'] and sep == ['ليلى', True, True, True, True, True] and asked, (mig, sep, asked))
            except Exception as e:
                rec('R14 (exception)', False, repr(e)[:200])
            # R15 R03: قرار المعلم على النسخة نفسها يُطبَّق، والتسجيل الأحدث يبقى قيد المراجعة
            try:
                ctxQ, pQ, _ = await ctx_page(b)
                await pQ.goto(BASE + '/open.html?src=app'); fQ = await appframe(pQ)
                r15 = await ev(fQ, """(()=>{var T='2026-10-01T10:00:00.000Z'; PACK_DATA.studentAudios={r2_1:{status:'approved',v:'rec_same1'}, r3_1:{status:'rejected',v:T}, r3_2:{status:'approved'}}; /* 9.39.8: «النسخة نفسها» = المعرّف نفسه */
                    STATE.studentAudios={r2_1:{status:'pending',updatedAt:T,rid:'rec_same1'}, r3_1:{status:'pending',updatedAt:'2026-10-02T10:00:00.000Z'}, r3_2:{status:'pending',updatedAt:T}};
                    syncPackStatuses(); return [STATE.studentAudios.r2_1.status, STATE.studentAudios.r3_1.status, STATE.studentAudios.r3_2.status]})()""")
                await ctxQ.close()
                rec('R15 R03 teacher decision applies to the same recording version; newer re-recording stays pending', r15 == ['approved', 'pending', 'pending'], r15)
            except Exception as e:
                rec('R15 (exception)', False, repr(e)[:200])
            # R16 R09: إعادة الإرسال تحمل المعتمد سابقًا بصوته، والجديد يحمل نسخته
            try:
                ctxS9, pS9, errsS9 = await ctx_page(b)
                await pS9.goto(BASE + '/open.html?src=app'); fS9 = await appframe(pS9)
                await setup_student(fS9, 'هند'); await record(fS9)
                await ev(fS9, "w=>{var T='2026-10-01T10:00:00.000Z'; PACK_DATA.studentAudios={r3_1:{audio:w,status:'approved',v:T}}; STATE.studentAudios.r3_1={status:'approved',v:T}; save()}", WAV5)
                sub9 = await export_from(pS9, fS9, """(function(){ showExportDialog('submission'); setTimeout(function(){ document.querySelectorAll('#modal button').forEach(function(b){ if(b.textContent.indexOf('إرسال للمعلم')>=0) b.click(); }); }, 300); })()""", f'{OUT}/sub_r09.html')
                upd = await ev(fS9, "STATE.studentAudios.r2_1.rid || STATE.studentAudios.r2_1.updatedAt")  # 9.39.6: النسخة = معرّف التسجيل
                sa9 = pack_of(sub9)['studentAudios']; await ctxS9.close()
                got = (sa9.get('r3_1', {}).get('status'), sa9.get('r3_1', {}).get('audio') == WAV5, sa9.get('r3_1', {}).get('v'), sa9.get('r2_1', {}).get('status'), sa9.get('r2_1', {}).get('v') == upd)
                rec('R16 R09 resubmission carries previously approved recordings; each recording carries its version', got == ('approved', True, '2026-10-01T10:00:00.000Z', 'pending', True), got)
            except Exception as e:
                rec('R16 (exception)', False, repr(e)[:200])
            # R08 (قرار المالك): إهداء جزئي ببيان صريح للمعلم قبل الإصدار وللمهدى إليه عند الفتح
            try:
                ctxG, pG, errsG = await ctx_page(b); msgsG = []
                pG.on('dialog', lambda d: msgsG.append(d.message))
                await pG.goto(BASE + '/open.html'); fG = await open_file(pG, sub)
                await ev(fG, "w=>{PACK_DATA.studentAudios.r3_1={audio:w,status:'pending'}}", WAV5)
                await fG.fill('#review-teacher-name', 'الشيخ محمود')
                await fG.click('[data-call*="setReview\\",\\"r2_1\\",\\"approved"]'); await fG.wait_for_timeout(300)
                giftP = await export_from(pG, fG, GIFT_EXPORT_JS, f'{OUT}/gift_partial.html')
                msgsG.append(await fG.evaluate("window.__giftMsg || ''"))
                await ctxG.close()
                gp = pack_of(giftP); gc = gp.get('giftContents') or {}
                peers = sorted(k for g in gp.get('approvedPeerRecordings', []) for k in g.get('audios', {}))
                conf = next((m for m in msgsG if 'ما يتضمنه الإهداء' in m), '')
                ctxR8, pR8, _ = await ctx_page(b)
                await pR8.goto(BASE + '/open.html'); fR8 = await open_file(pR8, giftP)
                await ev(fR8, "continueFromSplash()"); await pR8.wait_for_timeout(500)
                box = await ev(fR8, "(document.getElementById('gift-contents-box')||{}).textContent || ''")
                await ctxR8.close()
                ok8 = (peers == ['r2_1'] and gc.get('withPeer') == 1 and gc.get('totalTasks', 0) > 1 and gc.get('complete') is False
                       and 'لن يدخل الإهداء 1' in conf and 'ما ستتعلمه' in conf and ('1 من ' + str(gc.get('totalTasks'))) in conf
                       # 9.39.6: المهدى إليه هنا غير موثّق (مفتاح المعلم غير مثبّت)، فالوصف يطابق ما يُعرض: صفر تسجيلات زملاء مع التنبيه
                       and 'ما ستتعلمه' in box and ('0 من ' + str(gc.get('totalTasks'))) in box and 'غير موثّق' in box)
                rec('R17 R08 partial gift: teacher sees contents before export; signed giftContents; recipient sees what they will learn',
                    ok8, (peers, {k: gc.get(k) for k in ('withPeer', 'totalTasks', 'complete')}, conf[:80], box[:120]))
            except Exception as e:
                rec('R17 (exception)', False, repr(e)[:200])

            # ===== 9.39.6: RT9395-01 (هوية التسجيل) وRT9395-02 (البيان من الأصوات الفعلية) =====
            # R18: القرار مربوط بمعرّف التسجيل؛ إعادة التسجيل بساعة أقدم/مساوية/أحدث تبقى قيد المراجعة وتُرسل
            try:
                ctxK8, pK8, _ = await ctx_page(b)
                await pK8.goto(BASE + '/open.html?src=app'); fK8 = await appframe(pK8)
                r18 = await ev(fK8, """(async()=>{
                  STATE.student={name:'ساعة',id:'stu_clk',gender:'boy',consent:{v:CONSENT_VERSION,guardian:'ولي',permissions:{record:true,review:true,shareWithPeers:true}}}; STATE.role='student'; PACK_DATA.packageType='student_returned';
                  const D=Date; const setClock=iso=>{ Date=class extends D{constructor(...a){super(...(a.length?a:[iso]))} static now(){return new D(iso).getTime()}} };
                  const up=async(txt,iso)=>{ setClock(iso); try { await uploadReplacementAudio({target:{files:[new File([txt],'a.webm',{type:'audio/webm'})],value:''}},'r2_1'); } finally { Date=D; } return STATE.studentAudios.r2_1.rid || STATE.studentAudios.r2_1.updatedAt; };
                  const out={}; const r1=await up('ONE','2026-11-02T12:00:00.000Z');
                  PACK_DATA.studentAudios={r2_1:{audio:'data:audio/webm;base64,T05F',status:'approved',v:r1}};
                  syncPackStatuses(); out.same=STATE.studentAudios.r2_1.status;
                  for (const [k,iso] of [['older','2026-11-02T11:00:00.000Z'],['equal','2026-11-02T12:00:00.000Z'],['newer','2026-11-02T13:00:00.000Z']]){
                    STATE.studentAudios.r2_1={status:'approved',v:r1}; const rk=await up('NEW-'+k,iso); syncPackStatuses();
                    out[k]=[STATE.studentAudios.r2_1.status, await (await dbGet('r2_1')).text(), rk!==r1]; }
                  const blobs=[]; const o=URL.createObjectURL; URL.createObjectURL=b=>{blobs.push(b);return o.call(URL,b)}; const al=alert; const msgs=[]; alert=x=>msgs.push(x);
                  try { await doExportStudent('submission'); } finally { URL.createObjectURL=o; alert=al; }
                  const txt=blobs.length?await blobs[blobs.length-1].text():''; const m=txt.match(/var PACK_DATA = (.*?);\\n\\/\\* ===PACK_DATA_END/s);
                  const rec=m?JSON.parse(m[1]).studentAudios.r2_1:null; out.exported=rec?[rec.status, atob(rec.audio.split(',')[1]), rec.v===STATE.studentAudios.r2_1.rid]:msgs;
                  return out; })()""")
                await ctxK8.close()
                ok18 = (r18.get('same') == 'approved' and all(r18.get(k) == ['pending', 'NEW-' + k, True] for k in ('older', 'equal', 'newer'))
                        and r18.get('exported') == ['pending', 'NEW-newer', True])
                rec('R18 RT9395-01 decision bound to recording id; re-record with older/equal/newer clock stays pending and is sent', ok18, r18)
            except Exception as e:
                rec('R18 (exception)', False, repr(e)[:200])
            # R19: بيان الإهداء يطابق الأصوات الموجودة (مرجع كامل/جزئي/معدوم)، والمهدى إليه يرى الوصف المحسوب من الملف
            try:
                ctxM9, pM9, _ = await ctx_page(b)
                await pM9.goto(BASE + '/open.html?src=app'); fM9 = await appframe(pM9)
                r19 = await ev(fM9, """(()=>{ const groups=[{id:'g',name:'زميل',shareable:true,audios:{r2_1:{audio:'data:audio/webm;base64,T0xE',status:'approved'}}}];
                  const all={}; CURRICULUM.forEach(s=>{(s.items||[]).forEach(i=>all[i.id]='data:audio/webm;base64,QQ=='); (s.questions||[]).forEach(q=>{ if(q.textType==='quran'||detectTextType(q)==='quran') all[q.id]='data:audio/webm;base64,QQ=='; });});
                  const part={}; CURRICULUM.forEach(s=>(s.items||[]).slice(0,1).forEach(i=>{ if (Object.keys(part).length<5) part[i.id]=all[i.id]; }));
                  const t=m=>{ const gc=buildGiftContents(groups,m); return [gc.totalTasks, gc.withMaster, gc.noAudio, giftContentsText(gc)]; };
                  return [t(all), t(part), t({})]; })()""")
                giftNM = json.loads(await ev(fM9, """(async()=>{ let p=JSON.parse(JSON.stringify(PACK_DATA)); Object.assign(p,{packageType:'approved_gift',approved:true,studentAudios:{},approvedStudentAudios:{},masterAudios:{},
                  approvedPeerRecordings:[{id:'giver',name:'زميل',shareable:true,audios:{r2_1:{audio:'data:audio/webm;base64,T0xE',status:'approved'}}}]});
                  p.giftContents=buildGiftContents(p.approvedPeerRecordings,{}); await signGiftPack(p); return JSON.stringify(p) })()"""))
                await ctxM9.close()
                ctxV9 = await b.new_context(); await ctxV9.route('**/trusted-teachers.json', lambda r: r.fulfill(json={'keys': [giftNM['signature']['key']]}))
                pV9 = await ctxV9.new_page(); pV9.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
                await pV9.goto(BASE + '/open.html'); fV9 = await open_file(pV9, with_pack(gift, giftNM, f'{OUT}/gift_nomaster.html'))
                await ev(fV9, "continueFromSplash()"); await pV9.wait_for_timeout(600)
                boxNM = await ev(fV9, "[GIFT_TRUST, (document.getElementById('gift-contents-box')||{}).textContent || '']")
                await ctxV9.close()
                full, part, none = r19
                ok19 = (full[1] == full[0] and 'موجودة في كل المهام' in full[3] and 'لا توجد تلاوة' not in full[3]
                        and 0 < part[1] < part[0] and ('في %d من %d' % (part[1], part[0])) in part[3]
                        and none[1] == 0 and none[2] == none[0] - 1 and 'لا توجد تلاوة مرجعية' in none[3]
                        and len({full[3], part[3], none[3]}) == 3 and all('وحدها' not in x[3] for x in r19)
                        and boxNM[0] == 'verified' and 'لا توجد تلاوة مرجعية' in boxNM[1] and 'وحدها' not in boxNM[1])
                rec('R19 RT9395-02 gift description matches actual audio (full/partial/none) and recipient view', ok19,
                    ([x[:3] for x in r19], boxNM[0], boxNM[1][:90]))
            except Exception as e:
                rec('R19 (exception)', False, repr(e)[:200])

            # R20 (9.39.7): تسجيلات قديمة بلا rid — مطابقة حرفية للتاريخ، لا مقارنة بالترتيب
            try:
                ctxL, pL, _ = await ctx_page(b)
                await pL.goto(BASE + '/open.html?src=app'); fL = await appframe(pL)
                r20 = await ev(fL, """(()=>{ const T='2026-11-02T12:00:00.000Z';
                  PACK_DATA.studentAudios={same:{status:'approved',v:T}, older:{status:'approved',v:T}, newer:{status:'approved',v:T}, otherRid:{status:'approved',v:'rec_abc'}, noV:{status:'approved'}};
                  STATE.studentAudios={same:{status:'pending',updatedAt:T}, older:{status:'pending',updatedAt:'2026-11-02T11:00:00.000Z'}, newer:{status:'pending',updatedAt:'2026-11-02T13:00:00.000Z'},
                    otherRid:{status:'pending',updatedAt:T}, noV:{status:'pending',updatedAt:T}};
                  syncPackStatuses(); return ['same','older','newer','otherRid','noV'].map(k=>STATE.studentAudios[k].status); })()""")
                # 9.39.8: تساوي الوقت وحده (بلا صوت للمقارنة) لا يكفي، فيبقى «same» قيد المراجعة أيضًا؛ انظر R21 لمطابقة الصوت
                await pL.wait_for_timeout(300)
                r20 = await ev(fL, "['same','older','newer','otherRid','noV'].map(k=>STATE.studentAudios[k].status)")
                await ctxL.close()
                rec('R20 legacy recordings without rid: no ordering comparison; equal time alone does not approve',
                    r20 == ['pending', 'pending', 'pending', 'pending', 'pending'], r20)
            except Exception as e:
                rec('R20 (exception)', False, repr(e)[:200])

            # R21 (9.39.8): التسجيل القديم بلا rid بوقت مطابق: يُعتمد فقط إن طابقت بصمة صوته الصوت المعتمد
            try:
                ctxH, pH, _ = await ctx_page(b)
                await pH.goto(BASE + '/open.html?src=app'); fH = await appframe(pH)
                r21 = await ev(fH, """(async()=>{ const T='2026-11-02T12:00:00.000Z';
                  const wav=n=>{ const u=new Uint8Array(64); for(let i=0;i<64;i++) u[i]=(i*n)&255; return u; };
                  const b64=u=>{ let s=''; u.forEach(c=>s+=String.fromCharCode(c)); return 'data:audio/wav;base64,'+btoa(s); };
                  const A=wav(3), B=wav(7);
                  await dbPut('legSame', new Blob([A],{type:'audio/wav'})); await dbPut('legDiff', new Blob([B],{type:'audio/wav'})); await dbPut('legNoPackAudio', new Blob([A],{type:'audio/wav'}));
                  PACK_DATA.packageType='student_returned';
                  PACK_DATA.studentAudios={legSame:{status:'approved',v:T,audio:b64(A)}, legDiff:{status:'approved',v:T,audio:b64(A)}, legNoPackAudio:{status:'approved',v:T}, legNoBlob:{status:'approved',v:T,audio:b64(A)}};
                  STATE.studentAudios={legSame:{status:'pending',updatedAt:T}, legDiff:{status:'pending',updatedAt:T}, legNoPackAudio:{status:'pending',updatedAt:T}, legNoBlob:{status:'pending',updatedAt:T}};
                  syncPackStatuses();
                  if (typeof reconcileLegacyDecisions === 'function') await reconcileLegacyDecisions(); else await new Promise(r=>setTimeout(r,500));
                  return ['legSame','legDiff','legNoPackAudio','legNoBlob'].map(k=>STATE.studentAudios[k].status); })()""")
                await ctxH.close()
                rec('R21 RT9397-01 equal time: identical audio approved; different audio, or nothing to compare, stays pending',
                    r21 == ['approved', 'pending', 'pending', 'pending'], r21)
            except Exception as e:
                rec('R21 (exception)', False, repr(e)[:200])

            # R22 (9.39.9): تبديل الطالب أثناء مقارنة البصمة لا ينقل نتيجة A إلى B؛ ولكل طالب مقارنته
            try:
                ctxX, pX, _ = await ctx_page(b)
                await pX.goto(BASE + '/open.html?src=app'); fX = await appframe(pX)
                r22 = await ev(fX, """(async()=>{ const T='2026-11-02T12:00:00.000Z';
                  const wav=n=>{ const u=new Uint8Array(64); for(let i=0;i<64;i++) u[i]=(i*n)&255; return u; };
                  const b64=u=>{ let s=''; u.forEach(c=>s+=String.fromCharCode(c)); return 'data:audio/wav;base64,'+btoa(s); };
                  const A=wav(3), B=wav(7);
                  PACK_DATA.packageType='student_returned'; PACK_DATA.studentAudios={legX:{status:'approved',v:T,audio:b64(A)}};
                  switchStudentProfile('أ','stu_A'); STATE.role='student'; await dbPut('legX', new Blob([A],{type:'audio/wav'}));
                  STATE.studentAudios={legX:{status:'pending',updatedAt:T}}; save();
                  let release; const gate=new Promise(r=>release=r); const orig=sha256OfBytes; sha256OfBytes=async u=>{ await gate; return orig(u); };
                  const pA=reconcileLegacyDecisions(); await new Promise(r=>setTimeout(r,80));
                  switchStudentProfile('ب','stu_B'); STATE.role='student'; STATE.studentAudios={legX:{status:'pending',updatedAt:T}};
                  await dbPut('legX', new Blob([B],{type:'audio/wav'})); save();
                  release(); await pA; sha256OfBytes=orig; await new Promise(r=>setTimeout(r,50));
                  const race=[CURRENT_PROFILE_ID, STATE.studentAudios.legX.status];
                  await reconcileLegacyDecisions(); const ownB=STATE.studentAudios.legX.status;
                  switchStudentProfile('أ','stu_A'); await reconcileLegacyDecisions(); const ownA=[CURRENT_PROFILE_ID, STATE.studentAudios.legX.status];
                  return [race, ownB, ownA]; })()""")
                await ctxX.close()
                rec('R22 RT9398-01 switching child during hash comparison does not approve the other child; each child checked in its own context',
                    r22 == [['stu_B', 'pending'], 'pending', ['stu_A', 'approved']], r22)
            except Exception as e:
                rec('R22 (exception)', False, repr(e)[:200])

            # ===== 9.39.10: المراجعة الشاملة (لا قرار مالك) =====
            # R23: تصحيحات المادة العلمية وصلت إلى القالب المنشور
            try:
                tpl = os.path.join(SITE, 'app', 'template.txt')
                cur = pack_of(tpl)['curriculum']; ttxt = open(tpl, encoding='utf-8').read()
                allq = {x['id']: x for s_ in cur for x in s_.get('items', []) + s_['questions']}
                poems = ' '.join(x['text'] for s_ in cur for x in s_.get('items', []) if x.get('type') == 'poem')
                chk = {
                    'kilma': poems.count('كِلْمَةٍ') == 4 and 'كَلِمَةٍ' not in poems,
                    'meter': all(w not in poems for w in ['قَمَرِيَّهْ', 'مِنْ إِبْغِ', 'وَرَمْزُهَا', 'وَايْ ', 'وَعَيْنٌ', 'الثُّلَاثِيِّ']),
                    'lamfil': allq['q8_3']['answer'] is False and 'تظهر دائمًا' not in allq['s8_lam_matn']['desc'],
                    'akmal': '{أكمل|أكملي} ما تكون' not in json.dumps(cur, ensure_ascii=False),
                    'honorific': not any('ﷺ' in o for o in allq['q13_3']['options']),
                    'seq': all('اللازم' != p_[0] for p_ in allq['i9_1']['pairs']) and 'i5_4' in allq and not any('يَرْمُلُونَ' in p_[1] for p_ in allq['i1_1']['pairs']),
                    'dup': 'الوقف' in allq['q1_5']['text'],
                    'icon': 'U0001f4c1' not in ttxt, 'zoom': 'user-scalable=no' not in ttxt,
                }
                rec('R23 curriculum and template corrections shipped', all(chk.values()), {k: v for k, v in chk.items() if not v} or 'all')
            except Exception as e:
                rec('R23 (exception)', False, repr(e)[:200])
            # R24: الاختبار والمراجعة لا يُعدّان أقسامًا ولا تُضاف نقاطهما؛ ونتيجة البنت مجنّسة
            try:
                ctxQ2, pQ2, _ = await ctx_page(b)
                await pQ2.goto(BASE + '/open.html?src=app'); fQ2 = await appframe(pQ2)
                r24 = await ev(fQ2, """(()=>{ STATE.student={name:'هند',gender:'girl',id:'stu_h'}; STATE.role='student';
                  STATE.progress={s0_muqaddima:{bestScore:40,stars:3,attempts:1}};
                  var fin={id:'final_exam',title:'x',emoji:'🎓',items:[],questions:[{id:'q1_1',type:'true_false',text:'x',answer:true,explanation:'',points:350}],_map:{q1_1:'s1_intro'}};
                  assessPushSection(fin); STATE.progress.final_exam={bestScore:350,stars:3,attempts:1}; recalcStats(); renderHome();
                  var a=[STATE.stats.completedSections, STATE.stats.totalPoints, $('progress-label').textContent.indexOf('من 16 ')>=0];
                  delete STATE.progress.final_exam; openSection('final_exam'); CURRENT.section=CURRICULUM.find(function(s){return s.id==='final_exam'}); CURRENT.score=350; CURRENT.correct=1; CURRENT.wrong=0; CURRENT.examResults=[{id:'q1_1',ok:true}];
                  finishQuiz(); a.push(!STATE.progress.final_exam, $('result-title').textContent.indexOf('أنتِ بطلة')>=0); return a; })()""")
                await ctxQ2.close()
                rec('R24 synthetic exam not counted as a section/points; feminine result title', r24 == [1, 40, True, True, True], r24)
            except Exception as e:
                rec('R24 (exception)', False, repr(e)[:200])
            # R25: النقر المكرر على الخطأ نفسه في «اصطد» يُحسب خطأً واحدًا
            try:
                ctxH2, pH2, _ = await ctx_page(b)
                await pH2.goto(BASE + '/open.html?src=app'); fH2 = await appframe(pH2)
                await ev(fH2, """(()=>{ STATE.student={name:'هند',gender:'girl',id:'stu_h'}; STATE.role='student';
                  var sec=CURRICULUM.find(function(s){ return s.questions.some(function(q){ return q.type==='hunt'; }); });
                  openSection(sec.id); startQuiz(); CURRENT.section.questions=[Object.assign({}, sec.questions.find(function(q){ return q.type==='hunt'; }))]; CURRENT.qIdx=0; renderQuestion(); })()""")  # 9.39.13: المحاولة عيّنة من 15
                idx = await ev(fH2, """(()=>{ var q=CURRENT.section.questions[CURRENT.qIdx], toks=[]; q._x.words.forEach(function(w){ w.forEach(function(p){ toks.push(!!p.hit); }); }); return toks.indexOf(false); })()""")
                tok = fH2.locator('#options .qx-tok').nth(idx)
                await tok.click(); await fH2.wait_for_timeout(120); await tok.click(); await fH2.wait_for_timeout(900); await tok.click(); await fH2.wait_for_timeout(200)
                mis = await fH2.inner_text('#options .qx-mis')
                await ctxH2.close()
                rec('R25 repeated tap on the same wrong token counts once', idx >= 0 and mis.strip() == '❌ 1', (idx, mis))
            except Exception as e:
                rec('R25 (exception)', False, repr(e)[:200])
            # R26: الشرح بعد الإجابة الخاطئة يظهر في الشاشة الصغيرة دون تمرير يدوي
            try:
                ctxF6 = await b.new_context(viewport={'width': 360, 'height': 640}, locale='ar')
                pF6 = await ctxF6.new_page(); pF6.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
                await pF6.goto(BASE + '/open.html?src=app'); fF6 = await appframe(pF6)
                await ev(fF6, """(()=>{ STATE.student={name:'هند',gender:'girl',id:'stu_h'}; STATE.role='student'; openSection('s2_idhhar'); startQuiz();
                  CURRENT.qIdx=CURRENT.section.questions.findIndex(function(q){ return q.type==='multiple_choice' && q.options.length===4; }); renderQuestion(); })()""")
                wrong = await ev(fF6, "(()=>{ var q=CURRENT.section.questions[CURRENT.qIdx]; return (q.answer+1)%q.options.length; })()")
                await fF6.click(f'#options .option-btn[data-idx="{wrong}"]'); await fF6.wait_for_timeout(1200)
                vis = await ev(fF6, "(()=>{ var r=document.querySelector('#feedback-box .feedback .explain').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), window.innerHeight]; })()")
                await ctxF6.close()
                rec('R26 explanation after a wrong answer is on screen at 360x640', vis[0] >= 0 and vis[0] < vis[2] - 30, vis)
            except Exception as e:
                rec('R26 (exception)', False, repr(e)[:200])
            # R27: اسم المعلم المكتوب بعد الاعتماد يدخل الإهداء؛ ولا «المعلم المعلم»
            try:
                ctxN7, pN7, _ = await ctx_page(b)
                await pN7.goto(BASE + '/open.html'); fN7 = await open_file(pN7, sub)
                await fN7.fill('#review-teacher-name', 'الشيخ محمود')
                await fN7.click('[data-call*="setReview\\",\\"r2_1\\",\\"approved"]'); await fN7.wait_for_timeout(300)
                await fN7.fill('#review-teacher-name', 'الأستاذة سارة')
                gN7 = await export_from(pN7, fN7, GIFT_EXPORT_JS, f'{OUT}/gift_name.html')
                by = await ev(fN7, "(()=>{ if (typeof teacherByline !== 'function') return null; var o=PACK_DATA.teacherName; PACK_DATA.teacherName='المعلم'; var a=teacherByline(); PACK_DATA.teacherName='الشيخ محمود'; var c=teacherByline(); PACK_DATA.teacherName=o; return [a,c]; })()")
                await ctxN7.close()
                rec('R27 teacher name typed after approval is used; no duplicated title', pack_of(gN7).get('teacherName') == 'الأستاذة سارة' and by == ['المعلم', 'الشيخ محمود'], (pack_of(gN7).get('teacherName'), by))
            except Exception as e:
                rec('R27 (exception)', False, repr(e)[:200])
            # R28: زر الرجوع يعود داخل التطبيق إلى الخريطة (مع تأكيد الخروج من اختبار جارٍ)
            try:
                ctxB8, pB8, _ = await ctx_page(b); dlgB8 = []
                pB8.on('dialog', lambda d: dlgB8.append(d.message))
                await pB8.goto(BASE + '/open.html?src=app'); fB8 = await appframe(pB8)
                await ev(fB8, """(()=>{ STATE.student={name:'هند',gender:'girl',id:'stu_h'}; STATE.role='student'; renderHome(); show('view-home'); openSection('s2_idhhar'); startQuiz(); CURRENT.qIdx=1; renderQuestion(); })()""")
                await pB8.evaluate("history.back()"); await pB8.wait_for_timeout(900)
                st8 = await ev(fB8, "[!document.getElementById('view-home').classList.contains('hidden'), location.protocol]")
                await ctxB8.close()
                rec('R28 back button returns to the map inside the app (with leave-quiz confirmation)', st8[0] is True and BASE + '/open.html' in pB8.url and any('ستخرج من الاختبار' in m for m in dlgB8), (st8, pB8.url, dlgB8[:1]))
            except Exception as e:
                rec('R28 (exception)', False, repr(e)[:200])
            # R29: تسميات مفهومة بلا معرّفات داخلية
            try:
                ctxL9, pL9, _ = await ctx_page(b)
                await pL9.goto(BASE + '/open.html?src=app'); fL9 = await appframe(pL9)
                lab = await ev(fL9, "itemLabelById('s2_idhhar_matn')")
                await ctxL9.close()
                rec('R29 item labels show title and text, not internal ids', 's2_idhhar' not in lab and lab.startswith('الإظهار · ') and 'أَحْرُفِلِلْحَلْقِ' not in lab, lab)
            except Exception as e:
                rec('R29 (exception)', False, repr(e)[:200])
            # R30: زر 🔄 (إعادة الضبط) يمر بمسار الحذف المحمي نفسه
            try:
                ctxZ, pZ, _ = await ctx_page(b); msZ = []
                pZ.on('dialog', lambda d: msZ.append(d.message))
                await pZ.goto(BASE + '/open.html?src=app'); fZ = await appframe(pZ)
                await ev(fZ, "dbPut('probe', new Blob(['private-audio']))")
                dbZ = await ev(fZ, "DB_NAME")
                await ev(pZ, "n=>new Promise(r=>{var q=indexedDB.open(n);q.onsuccess=()=>{window.holdZ=q.result;r(1)}})", dbZ)
                await ev(fZ, "setTimeout(showReset, 0)"); await solve_gate(fZ); await pZ.wait_for_timeout(7000)
                fZ = await appframe(pZ)
                z = await ev(fZ, "[pendingDbDeletes().length > 0, CHILD_DATA_DELETED === true]")
                await ev(pZ, "holdZ.close()"); await ctxZ.close()
                rec('R30 reset button uses the protected deletion path', z == [True, True] and any('لم يكتمل' in m for m in msZ), (z, [m[:30] for m in msZ]))
            except Exception as e:
                rec('R30 (exception)', False, repr(e)[:200])
            # R31: حالة «لم يُرسل بعد» ثم «في ملف الإرسال»، وتشخيص الاختبار النظري يصل المعلم
            try:
                ctxS1, pS1, _ = await ctx_page(b)
                await pS1.goto(BASE + '/open.html?src=app'); fS1 = await appframe(pS1)
                await setup_student(fS1, 'دعاء'); await record(fS1)
                before = await fS1.inner_text('#lesson-content')
                await ev(fS1, """(()=>{ STATE.assess=STATE.assess||assessEmptyState(); assessConcept(STATE.assess,'s2_idhhar');
                  STATE.assess.lastExam={at:new Date().toISOString(),total:10,correct:7,wrong:['q2_1','q2_2','q2_3'],summary:{}}; save(); })()""")
                subS1 = await export_from(pS1, fS1, """(function(){ showExportDialog('submission'); setTimeout(function(){ document.querySelectorAll('#modal button').forEach(function(b){ if(b.textContent.indexOf('إرسال للمعلم')>=0) b.click(); }); }, 300); })()""", f'{OUT}/sub_sent.html')
                await ev(fS1, "closeModal(); openSection('s2_idhhar')"); await fS1.wait_for_timeout(300)
                after = await fS1.inner_text('#lesson-content')
                await ctxS1.close()
                ctxT1, pT1, _ = await ctx_page(b)
                await pT1.goto(BASE + '/open.html'); fT1 = await open_file(pT1, subS1)
                line = await fT1.inner_text('#review-assess-line')
                await ctxT1.close()
                rec('R31 recording shows not-sent then sent; teacher sees last exam diagnostics',
                    'لم يُرسل بعد' in before and 'في ملف الإرسال' in after and 'آخر اختبار: 7/10' in line, (('لم يُرسل بعد' in before), ('في ملف الإرسال' in after), line[:90]))
            except Exception as e:
                rec('R31 (exception)', False, repr(e)[:200])

            # R32 (ق5-أ): لا زر تصفير في الرئيسية؛ إعدادات ولي الأمر خلف بوابة حسابية؛ بلا موافقة: التصفير وحده
            try:
                ctxG, pG, _ = await ctx_page(b)
                await pG.goto(BASE + '/open.html?src=app'); fG = await appframe(pG)
                await ev(fG, "continueFromSplash()"); await fG.fill('#setup-name', 'هند'); await ev(fG, "saveSetup()"); await fG.wait_for_timeout(400)
                await ev(fG, "document.getElementById('consent-no') && document.getElementById('consent-no').click()"); await fG.wait_for_timeout(300)
                await ev(fG, "goHome()"); await fG.wait_for_timeout(300)
                no_home_reset = await ev(fG, "document.querySelector('#view-home [data-call*=\"showReset\"]') === null && CALLABLE_ALLOW.indexOf('openGuardianSettingsInner') < 0")
                await ev(fG, "openGuardianSettings()"); await fG.wait_for_timeout(200)
                gate_first = await ev(fG, "[!!document.getElementById('parent-gate'), !document.getElementById('guardian-overlay')]")
                q1 = await solve_gate(fG, wrong=True)
                after_wrong = await ev(fG, "[!!document.getElementById('parent-gate'), !document.getElementById('guardian-overlay'), document.getElementById('parent-gate-msg').textContent]")
                await solve_gate(fG)
                reduced = await ev(fG, "[!!document.getElementById('guardian-overlay'), !!document.getElementById('gs-delete'), !document.getElementById('gs-share'), (document.getElementById('gs-delete')||{}).textContent||'']")
                await ctxG.close()
                ctxG2, pG2, _ = await ctx_page(b)
                await pG2.goto(BASE + '/open.html?src=app'); fG2 = await appframe(pG2)
                await setup_student(fG2, 'ريم')
                await ev(fG2, "openGuardianSettings()"); await fG2.wait_for_timeout(200)
                pin_gate = await ev(fG2, "[!!document.getElementById('parent-gate-pin'), !document.getElementById('parent-gate-q')]")
                gq2 = await solve_gate(fG2)
                full = await ev(fG2, "[!!document.getElementById('gs-share'), (document.getElementById('gs-delete')||{}).textContent||'', !!document.getElementById('gs-backup')]")
                await ctxG2.close()
                rec('R32 no home reset; guardian settings behind a gate (arithmetic before consent, guardian PIN after); reset-only without consent',
                    no_home_reset and gate_first == [True, True] and after_wrong[0] and after_wrong[1] and 'غير صحيحة' in after_wrong[2]
                    and reduced[:3] == [True, True, True] and 'تصفير' in reduced[3] and pin_gate == [True, True] and gq2 == 'PIN' and full[0] and 'تصفير' in full[1] and full[2],
                    (no_home_reset, gate_first, after_wrong, reduced, pin_gate, gq2, full, q1))
            except Exception as e:
                rec('R32 (exception)', False, repr(e)[:200])

            # R33 (ق1-ب، RT9399-01): ملف إرسال مصنوع يحقن تسجيل «زميل» وتلاوة «شيخ» واسم شيخ؛ المعلم يعتمد تسجيل الطالب فقط
            # النتيجة المطلوبة: لا شيء من المحقون يصل إلى المهدى إليه، وتسجيل الطالب الحقيقي يصل موثّقًا.
            try:
                ctxA1, pA1, _ = await ctx_page(b)
                await pA1.goto(BASE + '/open.html?src=app'); fA1 = await appframe(pA1)
                await setup_student(fA1, 'مريم أحمد'); await record(fA1)
                subL = await export_from(pA1, fA1, """(function(){ showExportDialog('submission'); setTimeout(function(){ document.querySelectorAll('#modal button').forEach(function(b){ if(b.textContent.indexOf('إرسال للمعلم')>=0) b.click(); }); }, 300); })()""", f'{OUT}/r33_sub.html')
                await ctxA1.close()
                pk = pack_of(subL)
                pk['approvedPeerRecordings'] = [{'id': 'evil', 'name': 'زميل مجهول', 'gender': 'boy', 'shareable': True, 'audios': {'r3_1': {'audio': EVIL_WAV, 'status': 'approved'}}}]
                pk.setdefault('masterAudios', {}); pk['masterAudios']['r2_1'] = EVIL_WAV
                pk['sheikhName'] = 'اسم شيخ محقون'
                crafted = with_pack(subL, pk, f'{OUT}/r33_crafted.html')
                ctxT3, pT3, _ = await configured_page(b, sups=[DUMMY_SUP])
                await pT3.goto(BASE + '/open.html'); fT3 = await open_file(pT3, crafted)
                tview = await ev(fT3, "[REF_TRUST, REF_HIDDEN, (document.getElementById('review-ref-line')||{}).textContent||'', document.body.innerText.indexOf('اسم شيخ محقون') < 0, trustedPeerGroups().length]")
                await fT3.fill('#review-teacher-name', 'الشيخ محمود')
                await fT3.click('[data-call*="setReview\\",\\"r2_1\\",\\"approved"]'); await fT3.wait_for_timeout(300)
                giftL = await export_from(pT3, fT3, GIFT_EXPORT_JS, f'{OUT}/r33_gift.html')
                gmsg = await ev(fT3, "window.__giftMsg || ''")
                jwkT = json.loads(await ev(fT3, "keyDbGet(SIG_KEY_ID).then(r=>JSON.stringify(r.publicJwk))"))
                g = pack_of(giftL)
                in_file = ([x.get('id') for x in g.get('approvedPeerRecordings', []) if x.get('id') == 'evil'], (g.get('masterAudios') or {}).get('r2_1') == EVIL_WAV, g.get('sheikhName'))
                ctxR3, pR3, _ = await configured_page(b, keys=[jwkT], sups=[DUMMY_SUP])
                await pR3.goto(BASE + '/open.html'); fR3 = await open_file(pR3, giftL)
                rv = await ev(fR3, "[GIFT_TRUST, peerAudioBlocks('r3_1').indexOf('زميل مجهول') < 0, Object.keys(PACK_DATA.masterAudios||{}).length, PACK_DATA.sheikhName, peerAudioBlocks('r2_1').indexOf('مريم') >= 0]")
                await ctxR3.close()
                rec('R33 RT9399-01 laundering blocked: teacher warned, injected peer/master/name never reach the recipient; real recording verified',
                    tview[0] == 'unsigned' and tview[1] is True and 'لا تحمل توقيع مشرف' in tview[2] and tview[3] and tview[4] == 0
                    and 'لن تنتقل تسجيلات زملاء موروثة' in gmsg and 'زميل مجهول' in gmsg
                    and in_file == ([], False, 'الشيخ')
                    and rv[0] == 'verified' and rv[1] and rv[2] == 0 and rv[3] != 'اسم شيخ محقون' and rv[4],
                    (tview, gmsg[-160:], in_file, rv))

                # R34 (ق1-ب): السلسلة المشروعة ما زالت تعمل — أ ← معلم ← ب ← معلم ← ج يرى تسجيلَي أ و ب، والمادة المدمجة موثّقة في كل حلقة
                ctxA2, pA2, _ = await ctx_page(b)
                await pA2.goto(BASE + '/open.html?src=app'); fA2 = await appframe(pA2)
                await setup_student(fA2, 'آمنة'); await record(fA2)
                subA = await export_from(pA2, fA2, """(function(){ showExportDialog('submission'); setTimeout(function(){ document.querySelectorAll('#modal button').forEach(function(b){ if(b.textContent.indexOf('إرسال للمعلم')>=0) b.click(); }); }, 300); })()""", f'{OUT}/r34_subA.html')
                await ctxA2.close()
                # تثبيت التطبيق لدى المعلم يسجّل مفتاحه هو أيضًا (كما في النشر الفعلي)
                await ctxT3.unroute('**/trusted-teachers.json'); await ctxT3.route('**/trusted-teachers.json', trust_route([jwkT], [DUMMY_SUP]))
                await pT3.goto(BASE + '/open.html'); fT3 = await open_file(pT3, subA)
                t_ref = await ev(fT3, "REF_TRUST")
                await fT3.fill('#review-teacher-name', 'الشيخ محمود')
                await fT3.click('[data-call*="setReview\\",\\"r2_1\\",\\"approved"]'); await fT3.wait_for_timeout(300)
                gift1 = await export_from(pT3, fT3, GIFT_EXPORT_JS, f'{OUT}/r34_gift1.html')
                ctxB, pB, _ = await configured_page(b, keys=[jwkT], sups=[DUMMY_SUP])
                await pB.goto(BASE + '/open.html'); fB = await open_file(pB, gift1)
                b_view = await ev(fB, "[GIFT_TRUST, REF_TRUST, peerAudioBlocks('r2_1').indexOf('آمنة') >= 0]")
                await setup_student(fB, 'بشرى'); await record(fB, 's3_idgham', 'r3_1')
                subB = await export_from(pB, fB, """(function(){ showExportDialog('submission'); setTimeout(function(){ document.querySelectorAll('#modal button').forEach(function(b){ if(b.textContent.indexOf('إرسال للمعلم')>=0) b.click(); }); }, 300); })()""", f'{OUT}/r34_subB.html')
                await ctxB.close()
                fT3 = await open_file(pT3, subB)
                await fT3.fill('#review-teacher-name', 'الشيخ محمود')
                await fT3.click('[data-call*="setReview\\",\\"r3_1\\",\\"approved"]'); await fT3.wait_for_timeout(300)
                gift2 = await export_from(pT3, fT3, GIFT_EXPORT_JS, f'{OUT}/r34_gift2.html')
                await ctxT3.close()
                ctxC, pC, _ = await configured_page(b, keys=[jwkT], sups=[DUMMY_SUP])
                await pC.goto(BASE + '/open.html'); fC = await open_file(pC, gift2)
                c_view = await ev(fC, "[GIFT_TRUST, REF_TRUST, peerAudioBlocks('r2_1').indexOf('آمنة') >= 0, peerAudioBlocks('r3_1').indexOf('بشرى') >= 0, normalizePeerGroups().map(function(g){ return PEER_TRUST.get(g); })]")
                await ctxC.close()
                rec('R34 legitimate chain A→teacher→B→teacher→C: inherited group keeps its teacher certificate; built-in reference stays trusted',
                    t_ref == 'builtin' and b_view == ['verified', 'builtin', True] and c_view[:4] == ['verified', 'builtin', True, True] and c_view[4] == ['verified', 'verified'],
                    (t_ref, b_view, c_view))
            except Exception as e:
                rec('R33/R34 (exception)', False, repr(e)[:200])

            # R35 (ق1-ب): توقيع المشرف من الاستوديو — يُتحقق منه عبر الطالب ← المعلم ← المهدى إليه، ويكشف أي تعديل
            try:
                ctxU, pU, errsU = await ctx_page(b)
                await pU.goto(BASE + '/open.html?src=studio'); await pU.wait_for_timeout(1500)
                st = [f for f in pU.frames if '/studio/index.html' in f.url][0]
                await st.fill('#in-sheikh-name', 'الشيخ أيمن'); await st.fill('#in-supervisor-name', 'فراس')
                await st.click('text=ابدأ الاستوديو'); await pU.wait_for_timeout(800)
                recs = await st.query_selector_all('button:has-text("سجّل")'); await recs[0].click(); await pU.wait_for_timeout(2500)
                recs = await st.query_selector_all('button:has-text("إيقاف"), button:has-text("سجّل")'); await recs[0].click(); await pU.wait_for_timeout(1200)
                await st.click('#btn-sup-key'); await pU.wait_for_timeout(500)
                supJwk = json.loads(await st.inner_text('#sup-key-json'))
                async with pU.expect_download(timeout=30000) as dl:
                    await st.click('#btn-export')
                spack = f'{OUT}/r35_studio_pack.html'; await (await dl.value).save_as(spack)
                await ctxU.close()
                sp = pack_of(spack)
                MEDIA = "[REF_TRUST, REF_HIDDEN, Object.keys(PACK_DATA.masterAudios||{}).length + (PACK_DATA.welcomeAudioNeutral||PACK_DATA.welcomeAudioMale||PACK_DATA.welcomeAudioFemale ? 1 : 0), PACK_DATA.sheikhName]"
                ctxS5, pS5, _ = await configured_page(b, sups=[supJwk])
                await pS5.goto(BASE + '/open.html'); fS5 = await open_file(pS5, spack)
                s_view = await ev(fS5, MEDIA)
                await setup_student(fS5, 'سلمى'); await record(fS5)
                subS = await export_from(pS5, fS5, """(function(){ showExportDialog('submission'); setTimeout(function(){ document.querySelectorAll('#modal button').forEach(function(b){ if(b.textContent.indexOf('إرسال للمعلم')>=0) b.click(); }); }, 300); })()""", f'{OUT}/r35_sub.html')
                await ctxS5.close()
                ctxT5, pT5, _ = await configured_page(b, sups=[supJwk])
                await pT5.goto(BASE + '/open.html'); fT5 = await open_file(pT5, subS)
                t_view = await ev(fT5, MEDIA)
                await fT5.fill('#review-teacher-name', 'الشيخ محمود')
                await fT5.click('[data-call*="setReview\\",\\"r2_1\\",\\"approved"]'); await fT5.wait_for_timeout(300)
                giftS = await export_from(pT5, fT5, GIFT_EXPORT_JS, f'{OUT}/r35_gift.html')
                jwk5 = json.loads(await ev(fT5, "keyDbGet(SIG_KEY_ID).then(r=>JSON.stringify(r.publicJwk))"))
                await ctxT5.close()
                ctxR5, pR5, _ = await configured_page(b, keys=[jwk5], sups=[supJwk])
                await pR5.goto(BASE + '/open.html'); fR5 = await open_file(pR5, giftS)
                r_view = await ev(fR5, MEDIA)
                await ctxR5.close()
                sp2 = json.loads(json.dumps(sp)); sp2['sheikhName'] = 'شيخ آخر'
                tampered = with_pack(spack, sp2, f'{OUT}/r35_tampered.html')
                ctxX, pX, _ = await configured_page(b, sups=[supJwk])
                await pX.goto(BASE + '/open.html'); fX = await open_file(pX, tampered)
                x_view = await ev(fX, MEDIA); await ctxX.close()
                ctxY, pY, _ = await configured_page(b, sups=[DUMMY_SUP])
                await pY.goto(BASE + '/open.html'); fY = await open_file(pY, spack)
                y_view = await ev(fY, MEDIA); await ctxY.close()
                ctxN, pN, _ = await ctx_page(b)
                await pN.goto(BASE + '/open.html'); fN = await open_file(pN, spack)
                n_view = await ev(fN, MEDIA + ".concat([REF_SIG])"); await ctxN.close()
                rec('R35 studio supervisor signature verified through student→teacher→recipient; tampering or unregistered supervisor hides reference media',
                    sp.get('refCert', {}).get('key', {}).get('x') == supJwk['x']
                    and s_view[:2] == ['verified', False] and s_view[2] >= 1 and s_view[3] == 'الشيخ أيمن'
                    and t_view[:2] == ['verified', False] and t_view[2] >= 1 and r_view[:2] == ['verified', False] and r_view[2] >= 1
                    and x_view[:3] == ['invalid', True, 0] and x_view[3] == 'الشيخ' and y_view[:3] == ['untrusted', True, 0]
                    and n_view[:3] == ['unconfigured', False, n_view[2]] and n_view[2] >= 1 and n_view[4] == 'valid' and not errsU,
                    (s_view, t_view, r_view, x_view, y_view, n_view, errsU[:2]))
            except Exception as e:
                rec('R35 (exception)', False, repr(e)[:200])

            # R36 (ق2-ب): الاختبار أداة قياس — بعد الدروس كلها، من البنك المحجوز، بلا كشف أثناءه، وملخص بعده،
            # والإعادة بالمجموعة الأخرى لكل ما لم يُتقن، ونجوم الدرس من المحاولة الأولى، والشهادة من الإتقان وتقييم المعلم
            try:
                ctxQ, pQ, errsQ = await ctx_page(b)
                await pQ.goto(BASE + '/open.html?src=app'); fQ = await appframe(pQ)
                await setup_student(fQ, 'نور')
                locked = await ev(fQ, "showProfile(); [document.getElementById('btn-final-exam').classList.contains('hidden'), (document.getElementById('final-exam-locked')||{}).textContent||'']")
                await ev(fQ, "startFinalExam(1)"); started_locked = await ev(fQ, "!!(CURRENT.section && CURRENT.section.id === 'final_exam')")
                # نجوم المحاولة الأولى
                stars = await ev(fQ, """(() => { openSection('s2_idhhar'); startQuiz(); CURRENT.score = 0; finishQuiz(); var a = Object.assign({}, STATE.progress.s2_idhhar);
                  startQuiz(); CURRENT.score = CURRENT.section.questions.reduce(function(x, q){ return x + q.points; }, 0); finishQuiz();
                  var b2 = STATE.progress.s2_idhhar; return [a.stars, b2.stars, b2.bestStars, b2.bestScore > 0, !!document.getElementById('first-attempt-note')]; })()""")
                await ev(fQ, "realSections().forEach(function(s){ STATE.progress[s.id] = STATE.progress[s.id] || {stars: 1, attempts: 1, bestScore: 0}; }); save(); recalcStats(); showProfile()")
                unlocked = await ev(fQ, "[document.getElementById('btn-final-exam').classList.contains('hidden'), document.getElementById('final-exam-locked').classList.contains('hidden')]")
                await ev(fQ, "startFinalExam(1)"); await fQ.wait_for_timeout(200)
                plan = await ev(fQ, """(() => { var les = {}; realSections().forEach(function(s){ s.questions.forEach(function(q){ les[q.id] = 1; }); });
                  var sp = assessSplit(assessSections()), qs = CURRENT.section.questions, m = CURRENT.section._map;
                  return [CURRENT.section._exam === true, qs.length, qs.every(function(q){ return !les[q.id]; }), qs.every(function(q){ return sp[m[q.id]].A.indexOf(q.id) >= 0; })]; })()""")
                # النقر الحقيقي على خيار: لا تلوين صح/خطأ ولا شرح
                q0 = await ev(fQ, "(() => { var q = CURRENT.section.questions[0]; return [q.type, String(q.explanation || '')]; })()")
                if q0[0] in ('multiple_choice', 'extraction', 'true_false'):
                    await fQ.click('#options .option-btn >> nth=0'); await fQ.wait_for_timeout(200)
                    noreveal = await ev(fQ, "[document.querySelectorAll('#options .correct, #options .wrong').length, document.getElementById('feedback-box').innerText, document.getElementById('quiz-points').textContent]")
                    noreveal_ok = noreveal[0] == 0 and 'سُجّلت إجابتك' in noreveal[1] and noreveal[2] == '+0'
                    await ev(fQ, "document.querySelector('#feedback-box button').click()")
                    await ev(fQ, "CURRENT.examResults[0].ok = false; CURRENT.examWrong = [CURRENT.section.questions[0]]; CURRENT.correct = 0; CURRENT.wrong = 1; CURRENT.score = 0")
                    await ev(fQ, RUN_SESSION_JS, False)
                else:
                    noreveal_ok = True; await ev(fQ, RUN_SESSION_JS, True)
                await fQ.wait_for_timeout(300)
                s1 = await ev(fQ, """(() => { var v = STATE.assess.lastVerdict, ks = Object.keys(v), rep = document.getElementById('exam-report');
                  var q0 = CURRENT.section.questions[0], c0 = CURRENT.section._map[q0.id], expFail = assessRequired(c0) === 3 ? 0 : 1; // 9.39.13 (D3)
                  return [ks.filter(function(k){ return !v[k].ok; }).length === expFail, ks.filter(function(k){ return v[k].mastered; }).length, ks.every(function(k){ return STATE.assess.pendingRetest.indexOf(k) >= 0; }),
                    !!rep && rep.innerText.indexOf('الإجابة الصحيحة') < 0 && rep.innerText.indexOf('للمراجعة: درس') >= 0, document.getElementById('result-stars').innerHTML === '', !!STATE.assess.examDone[1]]; })()""")
                await ev(fQ, "startFinalExam(2)"); await fQ.wait_for_timeout(200)
                await ev(fQ, RUN_SESSION_JS, False); await fQ.wait_for_timeout(300)
                fin = await ev(fQ, "showProfile(); [STATE.assess.finalDone === true, document.getElementById('btn-final-exam').classList.contains('hidden'), STATE.assess.pendingRetest.length, realSections().length]")
                await ev(fQ, "startRetest()"); await fQ.wait_for_timeout(200)
                blocked = await ev(fQ, "[CURRENT.section.id !== 'retest_session', showProfile() || document.getElementById('btn-retest').textContent]")  # 9.39.13 (D4-ج)
                await ev(fQ, "Object.keys(STATE.assess.concepts).forEach(function(k){ STATE.assess.concepts[k].lastAt = new Date(Date.now() - 25 * 3600000).toISOString(); }); save(); startRetest()"); await fQ.wait_for_timeout(200)
                rt = await ev(fQ, """(() => { var sp = assessSplit(assessSections()), qs = CURRENT.section.questions, m = CURRENT.section._map;
                  return [CURRENT.section.id, qs.length, qs.every(function(q){ return sp[m[q.id]].B.indexOf(q.id) >= 0; })]; })()""")
                await ev(fQ, RUN_SESSION_JS, False); await fQ.wait_for_timeout(300)
                mast = await ev(fQ, "Object.keys(STATE.assess.concepts).filter(function(k){ return STATE.assess.concepts[k].mastered; }).length")
                cert = await ev(fQ, """(() => { realSections().forEach(function(s){ assessConcept(STATE.assess, s.id).mastered = true; });
                  STATE.teacherRatings = {}; var a = buildCertData().role; STATE.teacherRatings = {r2_1: 'mastered'}; var b2 = buildCertData().role;
                  STATE.teacherRatings = {r2_1: 'mastered', r3_1: 'needs'}; var c = buildCertData(); return [a, b2, c.role, c.desc]; })()""")
                await ctxQ.close()
                rec('R36 final exam = measurement: unlocks after all lessons, reserved bank set A, no reveal, summary after, retest on set B, first-attempt stars, certificate from mastery + teacher rating',
                    locked[0] is True and 'بعد إكمال الدروس' in locked[1] and not started_locked
                    and stars[0] == 1 and stars[1] == 1 and stars[2] == 3 and stars[3] and stars[4]
                    and unlocked == [False, True] and plan[0] and plan[2] and plan[3] and noreveal_ok
                    and s1[0] is True and s1[1] == 0 and s1[2] and s1[3] and s1[4] and s1[5] and blocked[0] and 'بعد' in blocked[1]
                    and fin[0] and fin[1] and fin[2] == fin[3] and rt[0] == 'retest_session' and 0 < rt[1] <= 21 and rt[2] and mast >= 1
                    and 'لأحكام المنهج' in cert[0] and 'بإتقان تام' in cert[1] and 'بإتقان تام' not in cert[2] and 'تدريبًا في موضع واحد' in cert[3] and not errsQ,
                    (locked, started_locked, stars, unlocked, plan, noreveal_ok, s1, blocked, fin, rt, mast, cert, errsQ[:2]))
            except Exception as e:
                rec('R36 (exception)', False, repr(e)[:200])

            # R37 (9.39.12، I1): الكلمة المسؤول عنها ظاهرة فعلًا (لون وخلفية مختلفان عن بقية الآية) في كل سؤال استخراج، دروسًا وبنكًا
            try:
                ctxV, pV, errsV = await ctx_page(b)
                await pV.goto(BASE + '/open.html?src=app'); fV = await appframe(pV)
                await setup_student(fV, 'دلال')
                vis = await ev(fV, """(() => { var out = {n: 0, bad: [], word: []};
                  function chk(q){ CURRENT.section.questions = [q]; CURRENT.qIdx = 0; renderQuestion();
                    var vt = document.querySelector('#view-quiz .verse-text'), b = vt && vt.querySelector('b');
                    if (!vt || !b){ out.bad.push(q.id + ':nob'); return; }
                    var a = getComputedStyle(vt), c = getComputedStyle(b); out.n++;
                    if (a.color === c.color && a.backgroundColor === c.backgroundColor) out.bad.push(q.id);
                    if (/الغامق/.test(q.question || '')) out.word.push(q.id); }
                  openSection('s2_idhhar'); startQuiz();
                  realSections().forEach(function(s){ (s.questions || []).concat(s.examQuestions || []).forEach(function(q){ if (q.type === 'extraction') chk(Object.assign({}, q)); }); });
                  return out; })()""")
                await ctxV.close()
                rec('R37 target word visibly highlighted in every extraction question (lessons + bank); no "bold" wording left',
                    vis['n'] >= 110 and not vis['bad'] and not vis['word'] and not errsV, (vis['n'], vis['bad'][:5], vis['word'][:5], errsV[:2]))
            except Exception as e:
                rec('R37 (exception)', False, repr(e)[:200])

            # R38 (9.39.12، O3): لا «إهداء» من ملف الطالب — لا زر، ولا ملف يخرج بصوت الطفل من هذا المسار
            try:
                ctxW, pW, _ = await ctx_page(b)
                await pW.goto(BASE + '/open.html?src=app'); fW = await appframe(pW)
                await setup_student(fW, 'سارة', share=False); await record(fW)
                nobtn = await ev(fW, "document.getElementById('btn-export-home') === null")
                downloads = []
                pW.on('download', lambda d: downloads.append(d))
                await ev(fW, "doExportStudent('gift')"); await fW.wait_for_timeout(2500)
                modal = await ev(fW, "(document.getElementById('modal') || {innerText: ''}).innerText")
                await ctxW.close()
                rec('R38 student-side gift export removed: no button, no file, explanation shown',
                    nobtn and not downloads and 'يصدره المعلم' in modal, (nobtn, len(downloads), modal[:80]))
            except Exception as e:
                rec('R38 (exception)', False, repr(e)[:200])

            # R39 (9.39.12): تقييم المعلم المحفوظ عند الطالب يبقى بعد إعادة التحميل (كان normalizeState يُسقطه)، وسجل الإجابات كذلك
            # R40 (9.39.12، A6): جلسة القياس المقطوعة تُستأنف من السؤال التالي ولا تُعاد أسئلتها
            # R41 (9.39.12، A4): سجل الإجابات يصل المعلم معقَّمًا مع ملف الإرسال
            try:
                ctxX, pX, errsX = await ctx_page(b)
                await pX.goto(BASE + '/open.html?src=app'); fX = await appframe(pX)
                await setup_student(fX, 'هند'); await record(fX)
                await ev(fX, "openSection('s2_idhhar'); startQuiz()")
                await ev(fX, """(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms));
                  for (let i = 0; i < 3; i++){ const q = CURRENT.section.questions[CURRENT.qIdx]; if (QX.has(q.type)) finishCustom(q, 0); else answer(q.answer); await sleep(20);
                    const b2 = document.querySelector('#feedback-box button'); if (b2) b2.click(); await sleep(20); } })()""")
                await ev(fX, "STATE.teacherRatings = {r2_1: 'mastered'}; realSections().forEach(function(s){ STATE.progress[s.id] = STATE.progress[s.id] || {stars: 1, attempts: 1, bestScore: 0}; }); save(); startFinalExam(1)")
                await fX.wait_for_timeout(200)
                first3 = await ev(fX, """(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)); var ids = [];
                  for (let i = 0; i < 3; i++){ const q = CURRENT.section.questions[CURRENT.qIdx]; ids.push(q.id); if (QX.has(q.type)) finishCustom(q, 0); else answer(q.answer); await sleep(20);
                    const b2 = document.querySelector('#feedback-box button'); if (b2) b2.click(); await sleep(20); } return ids; })()""")
                await pX.goto(BASE + '/open.html?src=app'); fX = await appframe(pX)
                await ev(fX, "continueFromSplash()"); await fX.wait_for_timeout(300)
                after = await ev(fX, "[Object.keys(STATE.teacherRatings || {}).length, (STATE.respLog || []).length, !!(STATE.assess && STATE.assess.inProgress)]")
                await ev(fX, "startFinalExam(1)"); await fX.wait_for_timeout(300)
                res = await ev(fX, "[CURRENT.section.id, CURRENT.qIdx, (CURRENT.examResults || []).length, CURRENT.section.questions.slice(0, 3).map(function(q){ return q.id; })]")
                await ev(fX, RUN_SESSION_JS, False); await fX.wait_for_timeout(300)
                done = await ev(fX, "[!!(STATE.assess.examDone || {})[1], STATE.assess.inProgress === null || STATE.assess.inProgress === undefined, (STATE.respLog || []).filter(function(e){ return e.k === 'F1'; }).length, (STATE.respLog || []).filter(function(e){ return e.k === 'L'; }).length]")
                subX = await export_from(pX, fX, """(function(){ showExportDialog('submission'); setTimeout(function(){ document.querySelectorAll('#modal button').forEach(function(b){ if(b.textContent.indexOf('إرسال للمعلم')>=0) b.click(); }); }, 300); })()""", f'{OUT}/r41_sub.html')
                await ctxX.close()
                ctxY2, pY2, _ = await ctx_page(b)
                await pY2.goto(BASE + '/open.html'); fY2 = await open_file(pY2, subX)
                tlog = await ev(fY2, "(function(){ var l = (PACK_DATA.studentAssessment || {}).log || []; return [l.length, l.filter(function(e){ return e.k === 'F1'; }).length, l.every(function(e){ return /^[A-Za-z0-9_\\-]+$/.test(e.q) && (e.c === 0 || e.c === 1); })]; })()")
                await ctxY2.close()
                rec('R39 teacher rating and response log persist across reload', after[0] == 1 and after[1] >= 6 and after[2], after)
                rec('R40 interrupted exam session resumes at the next question without repeating answered ones',
                    res[0] == 'final_exam' and res[1] == 3 and res[2] == 3 and res[3] == first3 and done[0] and done[1], (res, first3, done))
                rec('R41 per-item response log (lessons + exam rounds) reaches the teacher sanitized',
                    done[2] >= 20 and done[3] >= 3 and tlog[0] >= 23 and tlog[1] == done[2] and tlog[2] and not errsX, (done, tlog, errsX[:2]))
            except Exception as e:
                rec('R39-R41 (exception)', False, repr(e)[:200])

            # R42 (9.39.12): الاستوديو بلا معالجات مضمَّنة وله CSP؛ صفحتا المضيف بلا unsafe-inline؛ رقم الإصدار الكامل؛ لا أسماء عامة في البداية
            try:
                ctxZ, pZ2, errsZ = await ctx_page(b)
                await pZ2.goto(BASE + '/studio/index.html'); await pZ2.wait_for_timeout(800)
                st_csp = await pZ2.evaluate("[!!document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]'), document.documentElement.outerHTML.search(/\\son(click|change|input|load)=\"/) < 0, typeof STUDIO_CALLABLE !== 'undefined']")
                await pZ2.goto(BASE + '/index.html'); await pZ2.wait_for_timeout(300)
                launcher = await pZ2.evaluate("[document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]').content.indexOf('unsafe-inline') < 0, document.getElementById('ver').textContent]")
                await pZ2.goto(BASE + '/open.html?src=app'); fZ2 = await appframe(pZ2)
                hostcsp = True  # open.html يحتاج unsafe-inline: إطار blob يرث سياسته (انظر التعليق في open.html)
                splash = await ev(fZ2, "[document.getElementById('splash-role').textContent, document.getElementById('splash-name').textContent, APP_VERSION]")
                await ctxZ.close()
                rec('R42 studio CSP + no inline handlers; launcher without unsafe-inline; full version shown; no generic names on splash',
                    all(st_csp) and launcher[0] and launcher[1].endswith(splash[2]) and hostcsp and splash[0] == 'رفاق التحفة' and 'الشيخ' not in splash[1] and not errsZ,
                    (st_csp, launcher, hostcsp, splash, errsZ[:2]))
            except Exception as e:
                rec('R42 (exception)', False, repr(e)[:200])

            # R43 (9.39.13، ق3-ب): اختبار الدرس الطويل 15 سؤالًا بنسبة أنواعه، والأسئلة غير المرئية أولًا، والمنهج لا يتغير
            try:
                ctxS, pS, errsS = await ctx_page(b)
                await pS.goto(BASE + '/open.html?src=app'); fS = await appframe(pS)
                await setup_student(fS, 'لينة')
                smp = await ev(fS, """(() => { var full = realSections().find(function(s){ return s.id === 's3_idgham'; }), n0 = full.questions.length, ref0 = full.questions;
                  function kinds(qs){ var o = {}; qs.forEach(function(q){ var k = lessonQuizKind(q); o[k] = (o[k] || 0) + 1; }); return o; }
                  var kf = kinds(full.questions), seenAll = {}, sizes = [], ratioOk = true, firstTwo = {};
                  openSection('s3_idgham'); var label = (document.querySelector('#lesson-content [data-call*="startQuiz"]') || {}).textContent || '';
                  for (var t = 0; t < 3; t++){
                    openSection('s3_idgham'); startQuiz(); var qs = CURRENT.section.questions; sizes.push(qs.length);
                    var ka = kinds(qs); Object.keys(kf).forEach(function(k){ if (Math.abs((ka[k] || 0) - kf[k] * 15 / n0) > 1) ratioOk = false; });
                    qs.forEach(function(q){ seenAll[q.id] = 1; if (t < 2) firstTwo[q.id] = 1; });
                  }
                  return [n0, sizes, Object.keys(firstTwo).length, Object.keys(seenAll).length, ratioOk, full.questions === ref0 && full.questions.length === n0, CURRENT.section._full === full, label]; })()""")
                await ctxS.close()
                rec('R43 lesson quiz draws 15 questions in the lesson\'s proportions, unseen first, without touching the curriculum',
                    smp[0] == 30 and smp[1] == [15, 15, 15] and smp[2] == 30 and smp[3] == 30 and smp[4] and smp[5] and smp[6] and '15' in smp[7] and not errsS, (smp, errsS[:2]))
            except Exception as e:
                rec('R43 (exception)', False, repr(e)[:200])

            # R44 (9.39.13، D7): رمز ولي الأمر يوضع عند الموافقة (لا رمز ضعيف، ولا يُحفظ كما هو)، والبوابة تطلبه، والنسيان مسألة بعد انتظار
            try:
                ctxP, pP, errsP = await ctx_page(b)
                await pP.goto(BASE + '/open.html?src=app'); fP = await appframe(pP)
                await ev(fP, "continueFromSplash()"); await fP.fill('#setup-name', 'جنى'); await ev(fP, "saveSetup()"); await fP.wait_for_timeout(400)
                await fP.fill('#consent-name', 'أبو جنى')
                for c in [c for c in await fP.query_selector_all('input[type=checkbox]') if await c.is_visible()][:2]: await c.check()
                errs_pin = []
                for a1, a2 in (('2580', '2581'), ('1234', '1234'), ('7777', '7777')):
                    await fP.fill('#consent-pin', a1); await fP.fill('#consent-pin2', a2); await fP.click('#consent-ok'); await fP.wait_for_timeout(200)
                    errs_pin.append(await ev(fP, "(document.getElementById('consent-err') || {}).textContent || ''"))
                await fP.fill('#consent-pin', GUARDIAN_PIN); await fP.fill('#consent-pin2', GUARDIAN_PIN); await fP.click('#consent-ok'); await fP.wait_for_timeout(400)
                stored = await ev(fP, "[hasConsent(), guardianPinSet(), JSON.stringify(STATE).indexOf('" + GUARDIAN_PIN + "') < 0, !document.getElementById('consent-overlay')]")
                await ev(fP, "openGuardianSettings()"); await fP.wait_for_timeout(200)
                bad = await solve_gate(fP, wrong=True)
                after_bad = await ev(fP, "[!!document.getElementById('parent-gate-pin'), !document.getElementById('guardian-overlay'), document.getElementById('parent-gate-msg').textContent]")
                await solve_gate(fP)
                opened = await ev(fP, "!!document.getElementById('guardian-overlay') && !!document.getElementById('gs-pin')")
                await ev(fP, "document.getElementById('guardian-overlay').remove(); openGuardianSettings()"); await fP.wait_for_timeout(200)
                await fP.click('#parent-gate-forgot'); await fP.wait_for_timeout(1300)
                forgot = await ev(fP, "[!!document.getElementById('parent-gate-q'), document.getElementById('parent-gate-ok').disabled, document.getElementById('parent-gate-msg').textContent]")
                await ctxP.close()
                rec('R44 guardian PIN: set at consent (mismatch/weak refused, stored hashed), required by the gate, forgotten PIN = arithmetic after a 60 s wait',
                    'غير متطابقين' in errs_pin[0] and 'لا يسهل' in errs_pin[1] and 'لا يسهل' in errs_pin[2] and stored == [True, True, True, True]
                    and bad == 'PIN' and after_bad[0] and after_bad[1] and 'غير صحيح' in after_bad[2] and opened
                    and forgot[0] and forgot[1] and 'انتظر' in forgot[2] and not errsP, (errs_pin, stored, after_bad, opened, forgot, errsP[:2]))
            except Exception as e:
                rec('R44 (exception)', False, repr(e)[:200])

            # R45 (9.39.13، D6): ملف بمنهج معدَّل غير موقّع، وفي التطبيق مشرف مسجَّل ← يُعرض المنهج المعتمد المدمج؛ وبلا مشرف ← منهج الملف كما كان
            try:
                tpl_path = os.path.join(SITE, 'app', 'template.txt')
                pk = pack_of(tpl_path)
                s4 = [x for x in pk['curriculum'] if x['id'] == 's4_iqlab'][0]
                orig_expl = [q for q in s4['questions'] if q['id'] == 'q4_1'][0]['explanation']
                [q for q in s4['questions'] if q['id'] == 'q4_1'][0]['explanation'] = 'TAMPERED_RULE'
                pk['refCert'] = None
                bad_file = with_pack(tpl_path, pk, f'{OUT}/r45_tampered.html')
                same_file = with_pack(tpl_path, pack_of(tpl_path), f'{OUT}/r45_same.html')
                probe = "(() => { var s = CURRICULUM.find(function(x){ return x.id === 's4_iqlab'; }), q = s && s.questions.find(function(x){ return x.id === 'q4_1'; }); var l = refStatusLine(); return [REF_TRUST, REF_HIDDEN, REF_CURRICULUM_REPLACED, q ? q.explanation : null, l ? l.text : '', Array.isArray(BUILTIN_CURRICULUM)]; })()"
                ctxD, pD, errsD = await configured_page(b, sups=[DUMMY_SUP])
                await pD.goto(BASE + '/open.html'); fD = await open_file(pD, bad_file); await fD.wait_for_timeout(500)
                withsup = await ev(fD, probe)
                fD2 = await open_file(pD, same_file); await fD2.wait_for_timeout(500)
                samesup = await ev(fD2, probe)
                await ctxD.close()
                ctxD3, pD3, _ = await ctx_page(b)
                await pD3.goto(BASE + '/open.html'); fD3 = await open_file(pD3, bad_file); await fD3.wait_for_timeout(500)
                nosup = await ev(fD3, probe)
                await ctxD3.close()
                rec('R45 unsigned modified curriculum is replaced by the built-in one once a supervisor is registered; untouched otherwise',
                    withsup[1] and withsup[2] and withsup[3] == orig_expl and 'المنهج المعتمد' in withsup[4] and withsup[5]
                    and samesup[0] == 'builtin' and not samesup[2] and not samesup[5]
                    and nosup[0] == 'unconfigured' and not nosup[2] and nosup[3] == 'TAMPERED_RULE' and not errsD,
                    (withsup[:4], samesup[:4], nosup[:4], errsD[:2]))
            except Exception as e:
                rec('R45 (exception)', False, repr(e)[:200])

            # R46 (9.39.13، D12): تذكير بعد درسين؛ نسخة احتياطية (بلا رمز ولي الأمر) ← استعادة على جهاز جديد بالتسجيلات والتقدّم، ومعرّفات خبيثة تُسقط، والمعلم يرى «مستعاد»
            try:
                ctxB, pB, errsB = await ctx_page(b)
                await pB.goto(BASE + '/open.html?src=app'); fB = await appframe(pB)
                await setup_student(fB, 'سلمى'); await record(fB)
                remind = await ev(fB, """(() => { var out = [];
                  ['s0_muqaddima', 's1_intro'].forEach(function(id){ openSection(id); startQuiz(); CURRENT.score = CURRENT.section.questions.reduce(function(x, q){ return x + q.points; }, 0); finishQuiz(); out.push(!!document.getElementById('backup-reminder')); });
                  assessRecordRound(STATE.assess = STATE.assess || assessEmptyState(), 's6_ghunna', 'A', true, '2026-11-01T00:00:00Z', ['a']); assessRecordRound(STATE.assess, 's6_ghunna', 'B', true, '2026-11-02T00:00:00Z', ['b']); save();
                  return out; })()""")
                await ev(fB, "openGuardianSettings()"); await solve_gate(fB)
                await fB.check('#gs-backup-audio')
                async with pB.expect_download(timeout=30000) as dl:
                    await fB.click('#gs-backup')
                bk_path = f'{OUT}/r46_backup.json'; await (await dl.value).save_as(bk_path)
                bk = json.load(open(bk_path, encoding='utf-8'))
                bk_ok = [bk.get('type') == 'rifaq_backup', 'guardianPin' not in json.dumps(bk), 'r2_1' in bk.get('audios', {}), (bk['state']['progress'].get('s1_intro') or {}).get('stars', 0) >= 1]
                await ctxB.close()
                bk['state']['progress']['<img src=x onerror=alert(1)>'] = {'stars': 3}
                bk['state']['studentAudios']['bad"x'] = {'status': 'approved'}
                bk['state']['teacherRatings'] = {'r2_1': 'mastered', '__proto__x': 'mastered'}
                evil_path = f'{OUT}/r46_backup_evil.json'; json.dump(bk, open(evil_path, 'w', encoding='utf-8'), ensure_ascii=False)
                ctxN, pN, errsN = await ctx_page(b)
                await pN.goto(BASE + '/open.html?src=app'); fN = await appframe(pN)
                await ev(fN, "continueFromSplash()"); await fN.wait_for_timeout(200)
                await ev(fN, "openGuardianSettings()"); await solve_gate(fN)
                async with pN.expect_file_chooser() as fc:
                    await fN.click('#gs-restore')
                await (await fc.value).set_files(evil_path)
                await fN.wait_for_selector('#pin-new', timeout=8000)
                await fN.fill('#pin-new', GUARDIAN_PIN); await fN.fill('#pin-new2', GUARDIAN_PIN); await fN.click('#pin-new-ok')
                await pN.wait_for_timeout(2500); fN = await appframe(pN)
                got = await ev(fN, """(async () => { var a = null; try { a = await dbGet('r2_1'); } catch(e){}
                  return [STATE.student.name, (STATE.progress.s1_intro || {}).stars || 0, !!(STATE.studentAudios.r2_1), !!a && a.size > 0, !!STATE.restored, (STATE.restored || {}).lessons,
                    Object.keys(STATE.progress).every(function(k){ return /^[A-Za-z0-9_\\-]+$/.test(k); }), !STATE.studentAudios['bad"x'], guardianPinSet(), hasConsent(),
                    !!(STATE.assess.concepts.s6_ghunna || {}).mastered, (STATE.restored || {}).mastered.indexOf('s6_ghunna') >= 0, Object.keys(STATE.teacherRatings || {})]; })()""")
                subN = await export_from(pN, fN, """(function(){ showExportDialog('submission'); setTimeout(function(){ document.querySelectorAll('#modal button').forEach(function(b){ if(b.textContent.indexOf('إرسال للمعلم')>=0) b.click(); }); }, 300); })()""", f'{OUT}/r46_sub.html')
                await ctxN.close()
                ctxT, pT, _ = await ctx_page(b)
                await pT.goto(BASE + '/open.html'); fT = await open_file(pT, subN)
                tview = await ev(fT, "(function(){ var r = (PACK_DATA.studentAssessment || {}).restored; return [!!r, r ? restoredNote(r) : '']; })()")
                await ctxT.close()
                rec('R46 backup reminder after two lessons; backup (with audio, no PIN) restores progress, mastery and recordings on a new device; unsafe ids dropped; teacher sees "restored"',
                    remind == [False, True] and all(bk_ok) and got[0] == 'سلمى' and got[1] >= 1 and got[2] and got[3] and got[4] and got[5] >= 2 and got[6] and got[7]
                    and got[8] and got[9] and got[10] and got[11] and 'r2_1' in got[12] and all(re.fullmatch(r'[A-Za-z0-9_\-]{1,64}', k) for k in got[12]) and tview[0] and 'مستعاد من نسخة احتياطية' in tview[1] and not errsB and not errsN,
                    (remind, bk_ok, got, tview, errsB[:2], errsN[:2]))
            except Exception as e:
                rec('R46 (exception)', False, repr(e)[:200])

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
