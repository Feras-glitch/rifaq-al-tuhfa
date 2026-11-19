import sys, json
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1.json',encoding='utf8'))
pack={"packageId":"pack_g","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"curriculum":cur}
make('/home/claude/s19.html','/home/claude/t/g_fresh.html',pack)
errs=[]; out={}
with sync_playwright() as p:
    b=p.chromium.launch()
    for gender in ('girl','boy'):
        pg=b.new_context().new_page(); pg.on('pageerror',lambda e:errs.append(str(e)[:100]))
        pg.goto('file:///home/claude/t/g_fresh.html'); pg.wait_for_timeout(400)
        pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','اختبار')
        pg.evaluate(f"() => {{ STATE.student.gender='{gender}'; return 1; }}")
        pg.evaluate("saveSetup()"); pg.wait_for_timeout(150)
        pg.evaluate("openSection('s2_idhhar')"); pg.wait_for_timeout(120)
        out[gender+' desc']=pg.inner_text('.desc-text')[:90]
        pg.evaluate("startQuiz()"); pg.wait_for_timeout(120)
        out[gender+' q']=pg.inner_text('#question-text')[:100]
        pg.evaluate("answer(0)"); pg.wait_for_timeout(100)
        out[gender+' fb']=pg.inner_text('#feedback-box')[:100] if pg.query_selector('#feedback-box') else ''
        pg.close()
    b.close()
for k,v in out.items(): print(k,'=>',v.replace('\n',' | '))
print('raw braces leaked?', any('{' in v or '|' in v for v in out.values()), 'ERR',errs)
