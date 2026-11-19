import json,sys,re,shutil
sys.path.insert(0,'/home/claude/t')
from mkpack import make
from playwright.sync_api import sync_playwright
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1_full.json',encoding='utf8'))['sections']
make('/home/claude/s24.html','/home/claude/t/rt24.html',{"packageId":"pack_rt","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.24","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"trustedTeacherKeys":[],"curriculum":cur})
JS="""(a)=>{const mode=a.mode, target=a.target; const q=CURRENT.section.questions[CURRENT.qIdx];
 const sid=(CURRENT.section._map||{})[q.id];
 const wrong = (mode==='exam' && sid===target) || (mode==='retest_fail' && false);
 if(['multiple_choice','extraction','true_false'].includes(q.type)){const n=(q.type==='true_false')?2:q.options.length; answer(wrong?((q.answer+1)%n):q.answer);}
 else { finishAnswer(!wrong,q); } }"""
def run(pg, sid_name):
    n=pg.evaluate("CURRENT.section.questions.length")
    for i in range(n):
        pg.evaluate(JS, {'mode':sid_name[0],'target':sid_name[1]}); pg.wait_for_timeout(15)
        if pg.evaluate("!!document.querySelector('#feedback-box button')"):
            pg.evaluate("document.querySelector('#feedback-box button').click()"); pg.wait_for_timeout(15)
    pg.wait_for_timeout(200)
out=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:80])); pg.on('dialog',lambda d:d.accept())
    pg.goto('file:///home/claude/t/rt24.html'); pg.wait_for_timeout(500)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(150)
    pg.evaluate("document.getElementById('btn-final-exam').click()"); pg.wait_for_timeout(300)
    run(pg, ['exam','s4_iqlab'])
    out.append(('pendingRetest after exam', pg.evaluate("JSON.stringify(STATE.assess.pendingRetest)")))
    pg.evaluate("startRetest()"); pg.wait_for_timeout(300)
    out.append(('retest questions', pg.evaluate("CURRENT.section.questions.length")))
    run(pg, ['exam', None])
    out.append(('pendingRetest after clean retest', pg.evaluate("JSON.stringify(STATE.assess.pendingRetest)")))
    # review session: make a concept mastered and due
    pg.evaluate("(()=>{const c=assessConcept(STATE.assess,'s0_muqaddima'); c.mastered=true; c.lastSet='A'; c.nextReview=new Date(Date.now()-1000).toISOString(); save(); return 1})()")
    pg.evaluate("startReviewSession()"); pg.wait_for_timeout(300)
    out.append(('review set size', pg.evaluate("CURRENT.section.questions.length")))
    run(pg, ['exam', None])
    out.append(('review reviewIndex', pg.evaluate("STATE.assess.concepts['s0_muqaddima'].reviewIndex")))
    out.append(('review next due in days', pg.evaluate("Math.round((new Date(STATE.assess.concepts['s0_muqaddima'].nextReview)-Date.now())/86400000)")))
    out.append(('errs', errs[:2]))
    b.close()
for o in out: print(o)
