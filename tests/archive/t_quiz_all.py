import json
from playwright.sync_api import sync_playwright
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1.json',encoding='utf8'))
errs=[]; res=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append('JS:'+str(e)[:100])); pg.on('dialog',lambda d:(errs.append('DLG:'+d.message[:60]),d.accept()))
    pg.on('console',lambda m: errs.append('CSP:'+m.text[:90]) if 'Content Security' in m.text else None)
    pg.goto('file:///home/claude/t/kids_fresh.html'); pg.wait_for_timeout(500)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','اختبار'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(300)
    for sec in cur:
        pg.evaluate(f"openSection('{sec['id']}')"); pg.wait_for_timeout(120)
        lesson_ok = pg.evaluate("document.getElementById('lesson-content').innerText.length")
        pg.evaluate("startQuiz()"); pg.wait_for_timeout(100)
        for q in sec['questions']:
            ans = json.dumps(q['answer'])
            pg.evaluate(f"answer({ans})"); pg.wait_for_timeout(60)
            pg.evaluate("document.querySelector('#feedback-box button').click()")
            pg.wait_for_timeout(40)
        prog = pg.evaluate(f"JSON.stringify(STATE.progress['{sec['id']}']||null)")
        res.append((sec['id'], len(sec['questions']), lesson_ok, prog))
    b.close()
for r in res: print(r)
print('ERRORS:', errs)
