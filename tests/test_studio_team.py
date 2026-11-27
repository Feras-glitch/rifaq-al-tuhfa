# -*- coding: utf-8 -*-
"""9.41: التسجيل بفريق في الاستوديو. عضو الفريق يدخل بلا استمارة ويختار دوره، ويسجّل في جلسة متتابعة،
ويصدّر حزمة؛ والمشرف على جهاز آخر يدمجها، ويرفض تسجيلًا تغيّر نصه، ويستورد ملفات مسمّاة؛ والملف النهائي
لا يصدّره إلا من كتب الأسماء.
التشغيل: python3 -I tests/test_studio_team.py"""
import asyncio, json, os, struct, sys, tempfile
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STUDIO = 'file://' + os.path.join(ROOT, 'studio', 'استوديو_المشرف.html')
ARGS = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
R = []
def rec(n, ok, d=''):
    R.append((n, bool(ok))); print(('PASS' if ok else 'FAIL'), n, '|', str(d)[:500], flush=True)

def wav(path):
    data = b'\x00\x00' * 8000
    open(path, 'wb').write(b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, 8000, 16000, 2, 16) + b'data' + struct.pack('<I', len(data)) + data)

async def main():
    tmp = tempfile.mkdtemp(prefix='rifaq_team_')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True, locale='ar')
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.goto(STUDIO); await pg.wait_for_timeout(500)

        # T1 عضو الفريق: بلا أسماء، دور الشيخ افتراضيًا، والمجموعات المعروضة نصيبه وحده
        await pg.click('#btn-team-member'); await pg.wait_for_timeout(500)
        v = await pg.evaluate("[recRole(), [...document.querySelectorAll('.group')].map(g => g.dataset.group), roleItems().length, RECORDING_LIST.filter(x => x.group === 'quran' || x.group === 'listen').length]")
        rec('T1 team member enters without the form; sheikh role shows only Quran and listening groups', v[0] == 'sheikh' and v[1] == ['quran', 'listen'] and v[2] == v[3] and v[2] > 90, v)

        # T2 الجلسة المتتابعة: سجّل ← احفظ ← التالي، والعدّاد يتقدم
        await pg.click('#btn-rec-session'); await pg.wait_for_timeout(300)
        first = await pg.evaluate("REC_SESSION.ids[0]")
        await pg.click('.rs-rec'); await pg.wait_for_timeout(1100)
        recording = await pg.evaluate("[!!activeRecorder, document.querySelector('.rs-nav .btn.gold, .rs-nav .btn.ghost:last-child').disabled]")
        await pg.click('.rs-rec'); await pg.wait_for_timeout(900)
        saved = await pg.evaluate("[Object.keys(STATE.recordings), document.getElementById('rs-status').textContent]")
        await pg.click('.rs-nav .btn.gold'); await pg.wait_for_timeout(200)
        await pg.click('.rs-rec'); await pg.wait_for_timeout(900); await pg.click('.rs-rec'); await pg.wait_for_timeout(900)
        pos = await pg.evaluate("[REC_SESSION.i, Object.keys(STATE.recordings).length]")
        await pg.click('.rs-top .btn'); await pg.wait_for_timeout(300)
        hint = await pg.evaluate("document.querySelector('.team-hint').textContent")
        rec('T2 session records item by item; navigation is locked while recording', recording[0] and recording[1] and saved[0] == [first] and '✅' in saved[1] and pos == [1, 2] and ' 2 من ' in hint, (recording, saved, pos, hint[-12:]))

        # T3 الحزمة: نوعها ودورها وبصمة نص كل تسجيل
        async with pg.expect_download() as dl:
            await pg.click("[data-call='[\"exportRecBundle\"]']")
        bundle = os.path.join(tmp, 'bundle.json'); await (await dl.value).save_as(bundle)
        J = json.load(open(bundle, encoding='utf-8'))
        okh = await pg.evaluate("(ids) => ids.every(id => { var x = RECORDING_LIST.find(y => y.id === id); return x && recTextHash(x); })", list(J['items']))
        rec('T3 bundle carries role, recordings and a text fingerprint per item', J['type'] == 'rifaq_recordings' and J['v'] == 1 and J['role'] == 'sheikh' and len(J['items']) == 2 and all(r['data'].startswith('data:audio/') and r['h'] for r in J['items'].values()) and okh, {k: J[k] for k in ('type', 'role')})

        # T4 عضو الفريق لا يصدّر الملف النهائي بلا أسماء
        await pg.click('#btn-export'); await pg.wait_for_timeout(300)
        t = await pg.evaluate("document.getElementById('modal-title').textContent")
        rec('T4 final file needs the names (team member is told to send the bundle)', 'المشرف' in t, t)

        # T5 جهاز المشرف: دمج الحزمة
        ctx2 = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar')
        p2 = await ctx2.new_page(); p2.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await p2.goto(STUDIO); await p2.wait_for_timeout(400)
        await p2.fill('#in-sheikh-name', 'الشيخ'); await p2.fill('#in-supervisor-name', 'المشرف')
        await p2.click("[data-call='[\"startStudio\"]']"); await p2.wait_for_timeout(600)
        await p2.evaluate("setRecRole('all')")
        await p2.set_input_files('#in-rec-bundle', bundle); await p2.wait_for_timeout(1200)
        m = await p2.evaluate("async () => [Object.keys(STATE.recordings).sort(), document.getElementById('modal-body').textContent, (await dbGetAllKeys()).length]")
        rec('T5 supervisor merges the bundle into the workspace (saved to IndexedDB)', m[0] == sorted(J['items']) and 'أُضيف 2' in m[1] and m[2] == 2, m)
        await p2.evaluate("closeModal()")

        # T6 تسجيل تغيّر نصه بعد تسجيله لا يُدمج، والتعارض يُسأل عنه
        J2 = json.loads(json.dumps(J)); k0 = list(J2['items'])[0]; J2['items'][k0]['h'] = 'changed'
        b2 = os.path.join(tmp, 'b2.json'); json.dump(J2, open(b2, 'w', encoding='utf-8'))
        await p2.set_input_files('#in-rec-bundle', b2); await p2.wait_for_timeout(1000)
        q = await p2.evaluate("[document.getElementById('modal-title').textContent, document.querySelectorAll('#modal-actions button').length]")
        await p2.click('#modal-actions button.ghost'); await p2.wait_for_timeout(600)
        msg = await p2.evaluate("document.getElementById('modal-body').textContent")
        rec('T6 changed text is refused, conflicts ask which to keep', 'موجودة' in q[0] and q[1] == 2 and 'نصه تغيّر' in msg and 'أُبقي تسجيلك' in msg, (q, msg))
        await p2.evaluate("closeModal()")

        # T7 ملفات صوتية مسمّاة برقم العنصر
        g = os.path.join(tmp, '_greeting_male.wav'); x = os.path.join(tmp, 'no_such_item.wav'); wav(g); wav(x)
        await p2.set_input_files('#in-named-audio', [g, x]); await p2.wait_for_timeout(1500)
        n = await p2.evaluate("[!!STATE.recordings._greeting_male, document.getElementById('modal-body').textContent]")
        rec('T7 named audio files land on their item; unknown names are reported', n[0] and 'أُضيف 1' in n[1] and 'no_such_item' in n[1], n)
        await p2.evaluate("closeModal()")

        # T8 ورقة التسجيل: رقم كل عنصر ونصه للدور
        await p2.evaluate("setRecRole('reciter'); openRecSheet()")
        sh = await p2.evaluate("[document.querySelectorAll('#rec-sheet tbody tr').length, roleItems('reciter').length, document.querySelector('#rec-sheet tbody code').textContent]")
        await p2.evaluate("closeRecSheet()")
        rec('T8 recording sheet lists every item of the role with its file name', sh[0] == sh[1] and sh[0] >= 61 and sh[2].endswith('__v1'), sh)

        rec('T9 no page errors', not errs, errs[:3])
        await b.close()
    passed = sum(1 for r in R if r[1]); print('\nSUMMARY: %d / %d' % (passed, len(R)))
    sys.exit(0 if passed == len(R) else 1)

asyncio.run(main())
