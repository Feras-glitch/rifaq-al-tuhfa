from playwright.sync_api import sync_playwright
import json,sys
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1_full.json',encoding='utf8'))['sections']
make('/home/claude/s19.html','/home/claude/t/g2.html',{"packageId":"pack_g2","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"trustedTeacherKeys":[],"curriculum":cur})
R=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for g in ('girl','boy'):
        pg=b.new_page(); pg.on('pageerror',lambda e:R.append(('ERR',str(e)[:60])))
        pg.goto('file:///home/claude/t/g2.html'); pg.wait_for_timeout(400)
        pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','اختبار'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(120)
        pg.evaluate(f"() => {{ STATE.student.gender='{g}'; return 1; }}")
        pg.evaluate("openSection('s2_idhhar')"); pg.wait_for_timeout(200)
        txt=pg.evaluate("document.getElementById('lesson-content')? document.getElementById('lesson-content').innerText : ''")
        R.append((g,'braces left:', '{' in txt or '|' in txt, 'sample:', txt[txt.find('ا'):][:0]))
        pg.evaluate("startQuiz()"); pg.wait_for_timeout(150)
        pg.evaluate("answer(1)"); pg.wait_for_timeout(150)
        fb=pg.evaluate("document.getElementById('feedback-box').innerText")
        R.append((g,'fb:', fb[:70].replace(chr(10),' | ')))
        pg.close()
    b.close()
for r in R: print(r)
