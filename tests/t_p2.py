import json,sys,re,shutil
sys.path.insert(0,'/home/claude/t')
from mkpack import make
from playwright.sync_api import sync_playwright
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1_full.json',encoding='utf8'))['sections']
fake='data:audio/webm;codecs=opus;base64,AAAAGGZ0eXBzZ'
pk={"packageId":"pack_p2","packageType":"student_submission","schemaVersion":2,"appVersion":"9.25","sheikhName":"الشيخ","teacherName":"","teacherGender":"boy","studentName":"سلمى","studentId":"stu_p2","studentGender":"girl","masterAudios":{},"studentAudios":{"r3_1":{"audio":fake,"status":"pending"}},"trustedTeacherKeys":[],"teacherRatings":{},"curriculum":cur}
make('/home/claude/s25.html','/home/claude/t/p2_sub.html',pk)
out=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(accept_downloads=True); tp=ctx.new_page(); errs=[]; v=[]
    tp.on('pageerror',lambda e:errs.append(str(e)[:80])); tp.on('dialog',lambda d:d.accept())
    tp.on('console', lambda m: v.append(m.text[:50]) if 'Content Security' in m.text else None)
    tp.goto('file:///home/claude/t/p2_sub.html'); tp.wait_for_timeout(500)
    tp.evaluate("showTeacherReview()"); tp.wait_for_timeout(400)
    out.append(('roster button', tp.evaluate("!!document.getElementById('btn-roster')")))
    out.append(('channel select', tp.evaluate("!!document.getElementById('review-reply-channel')")))
    tp.evaluate("(()=>{const s=document.getElementById('review-reply-channel'); s.value='both'; s.dispatchEvent(new Event('change',{bubbles:true}));})()"); tp.wait_for_timeout(300)
    out.append(('channel set', tp.evaluate("PACK_DATA.replyChannel")))
    tp.evaluate("document.getElementById('btn-roster').click()"); tp.wait_for_timeout(500)
    out.append(('roster overlay', tp.evaluate("!!document.getElementById('roster-overlay')")))
    tp.evaluate("document.getElementById('roster-close').click()")
    out.append(('roster saved', tp.evaluate("keyDbGet('roster').then(r=>Object.keys(r||{}).length)")))
    out.append(('errs', errs[:2], 'csp', len(v)))
    b.close()
for o in out: print(o)
