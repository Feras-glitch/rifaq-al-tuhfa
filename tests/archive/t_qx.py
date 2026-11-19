import sys, json, re
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1.json',encoding='utf8'))
# adversarial question added to a fresh section
evil={"id":"evil","title":"اختبار حقن","emoji":"💣","items":[{"id":"ev_i","type":"poem","text":"بيت"}],"questions":[
 {"id":"e1","type":"classify","text":"<img src=x onerror=\"window.__pwn=1\">صنّف","explanation":"<img src=x onerror=\"window.__pwn=1\">","items":{"<img src=x onerror=\"window.__pwn=1\">":["<script>window.__pwn=1</script>","b"],"س":["c"]}},
 {"id":"e2","type":"hunt","text":"x","explanation":"y","ayah":"<img src=x onerror=\"window.__pwn=1\"> [[a]]"},
 {"id":"e3","type":"unknown_type","text":"x","explanation":"y"},
 {"id":"e4","type":"match","text":"x","explanation":"y","pairs":[["a","b"]]}]}
pack={"packageId":"pack_qx","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.17","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"curriculum":cur+[evil]}
make('/home/claude/s19.html','/home/claude/t/qx_fresh_full.html',pack)
errs=[]; log=[]
def solve(pg,q):
    t=q['type']
    if t=='classify':
        for b,items in q['items'].items():
            for it in items:
                pg.click(f".qx-chip:text-is('{it}')")
                pg.click(f".qx-basket:has(.qx-basket-title:text-is('🧺 {b}'))")
    elif t=='hunt':
        x=pg.evaluate("CURRENT.section.questions[CURRENT.qIdx]._x.words")
        toks=pg.query_selector_all('.qx-tok')
        flat=[p for w in x for p in w]
        for i,p in enumerate(flat):
            if p['hit']: toks[i].click()
    elif t=='paint':
        x=pg.evaluate("CURRENT.section.questions[CURRENT.qIdx]._x")
        toks=pg.query_selector_all('.qx-tok')
        for i,tk in enumerate(x['tokens']):
            if tk['rule']:
                pg.click(f".qx-color:text-is('{tk['rule']}')"); toks[i].click()
    elif t=='match':
        cols=pg.query_selector_all('.qx-col')
        for a,b in q['pairs']:
            pg.click(f".qx-col:nth-child(1) .qx-chip:text-is('{a}')"); pg.click(f".qx-col:nth-child(2) .qx-chip:text-is('{b}')")
    elif t=='order':
        for pc in q['pieces']: pg.click(f".qx-tray .qx-chip:text-is('{pc}')")
    elif t=='cloze':
        for m in re.findall(r'\{\{([^}]+)\}\}',q['sentence']): pg.click(f".qx-tray .qx-chip:not([disabled]):text-is('{m}')")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context().new_page()
    pg.on('pageerror',lambda e:errs.append('JS:'+str(e)[:120])); pg.on('dialog',lambda d:(errs.append('DLG:'+d.message[:60]),d.accept()))
    pg.on('console',lambda m: errs.append('CSP:'+m.text[:90]) if 'Content Security' in m.text else None)
    pg.goto('file:///home/claude/t/qx_fresh_full.html'); pg.wait_for_timeout(500)
    log.append(('sanitize report (evil pack)',pg.evaluate("JSON.stringify(SANITIZE_REPORT)")))
    log.append(('evil section questions kept',pg.evaluate("CURRICULUM.filter(s=>s.id==='evil')[0].questions.map(q=>q.id).join(',')")))
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','اختبار'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(300)
    for sec in cur:
        pg.evaluate(f"openSection('{sec['id']}')"); pg.wait_for_timeout(80); pg.evaluate("startQuiz()")
        for q in sec['questions']:
            if q['type'] in ('multiple_choice','extraction','true_false'):
                pg.evaluate(f"answer({json.dumps(q['answer'])})")
            else:
                try: solve(pg,q)
                except Exception as e: errs.append(f"solve-fail {q['id']}: {str(e)[:90]}")
            pg.wait_for_timeout(30)
            fb=pg.query_selector('#feedback-box button')
            if fb: fb.click()
            else: errs.append(f"no feedback after {q['id']}")
        log.append((sec['id'],len(sec['questions']),pg.evaluate(f"JSON.stringify(STATE.progress['{sec['id']}'])")))
    # mistakes path: wrong classify twice => counted wrong
    pg.evaluate("openSection('s7_meem')"); pg.evaluate("startQuiz()")
    idx=[i for i,q in enumerate(next(s for s in cur if s['id']=='s7_meem')['questions'])]
    qs=next(s for s in cur if s['id']=='s7_meem')['questions']
    for i,q in enumerate(qs):
        if q['id']=='i7_1': break
        pg.evaluate("document.querySelector('#options') && 0")
        # fast-forward earlier questions
        if q['type'] in ('multiple_choice','extraction','true_false'): pg.evaluate(f"answer({json.dumps(q['answer'])})")
        else: solve(pg,q)
        pg.query_selector('#feedback-box button').click()
    pg.click(".qx-chip:text-is('أَلَمْ تَرَ')"); pg.click(".qx-basket:has(.qx-basket-title:text-is('🧺 إدغام'))")
    pg.click(".qx-chip:text-is('لَمْ يَلِدْ')"); pg.click(".qx-basket:has(.qx-basket-title:text-is('🧺 إدغام'))")
    pg.click(".qx-chip:text-is('هُمْ عَن')"); pg.click(".qx-basket:has(.qx-basket-title:text-is('🧺 إدغام'))")
    log.append(('3 wrong drops -> mistakes counter',pg.inner_text('.qx-mis')))
    # finish correctly
    solve(pg,qs[[q['id'] for q in qs].index('i7_1')])
    pg.wait_for_timeout(100)
    log.append(('finished with 3 mistakes (tolerance 2) -> feedback title',pg.inner_text('#feedback-box .title')))
    # evil section render (the questions that survived)
    pg.evaluate("openSection('evil')"); pg.evaluate("startQuiz()"); pg.wait_for_timeout(200)
    html=pg.evaluate("document.querySelector('#question-text').innerHTML+document.querySelector('#options').innerHTML")
    log.append(('evil render: no <img/<script elements',('<img' not in html.lower() or 'lt;img' in html) and '<script' not in html.lower(), 'pwn?',pg.evaluate("window.__pwn===1")))
    b.close()
for l in log: print(l)
print('ERRORS:',errs)
