import sys, json, re, shutil
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1.json',encoding='utf8'))
pack={"packageId":"pack_kids1","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.17","sheikhName":"الشيخ","poemReciterName":"المنشد","supervisorName":"المشرف","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"curriculum":cur}
make('/home/claude/s19.html','/home/claude/t/kids_fresh.html',pack)
def ext(path):
    h=open(path,encoding='utf8').read()
    return json.loads(re.search(r'var PACK_DATA = (\{.*?\});\n/\* ===PACK_DATA_END',h,re.S).group(1))
errs=[]; log=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    def page():
        c=b.new_context(permissions=['microphone'],accept_downloads=True); pg=c.new_page()
        pg.on('pageerror',lambda e:errs.append('JS:'+str(e)[:100])); pg.on('dialog',lambda d:(errs.append('DLG:'+d.message[:80]),d.accept()))
        pg.on('console',lambda m: errs.append('CSP:'+m.text[:100]) if 'Content Security' in m.text else None); return pg
    # 1) student (one persistent browser profile, like a real phone)
    sctx=b.new_context(permissions=['microphone'],accept_downloads=True)
    def spage():
        pg=sctx.new_page(); pg.on('pageerror',lambda e:errs.append('JS:'+str(e)[:100])); pg.on('dialog',lambda d:(errs.append('DLG:'+d.message[:80]),d.accept())); return pg
    pg=spage(); pg.goto('file:///home/claude/t/kids_fresh.html'); pg.wait_for_timeout(500)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(300)
    pg.evaluate("() => { STATE.student.consent={v:2,guardian:'أم سلمى',at:'x',permissions:{record:true,review:true,shareWithPeers:false},excludedRecordings:{}}; save(); return 1; }")
    for sec,rid in (('s2_idhhar','r2_1'),('s3_idgham','r3_1')):
        pg.evaluate(f"openSection('{sec}')"); pg.wait_for_timeout(200)
        pg.evaluate(f"startRec('{rid}')"); pg.wait_for_timeout(1000); pg.evaluate(f"startRec('{rid}')"); pg.wait_for_timeout(700)
    # quiz: run section 3 quiz (extraction + mc + tf), answer first option each time
    pg.evaluate("openSection('s3_idgham')"); pg.evaluate("startQuiz()"); pg.wait_for_timeout(200)
    n=pg.evaluate("CURRENT.section.questions.length"); types=[]
    for i in range(n):
        types.append(pg.evaluate("CURRENT.section.questions[CURRENT.qIndex!==undefined?CURRENT.qIndex:0].type") if False else '')
        try: pg.evaluate("answer(0)")
        except Exception as e: errs.append('answer-fail:'+str(e)[:60])
        pg.wait_for_timeout(120)
        try: pg.evaluate("nextQuestion()")
        except Exception: pass
    log.append(('quiz ran questions',n))
    with pg.expect_download() as dl: pg.evaluate("doExportStudent('submission')")
    shutil.copy(dl.value.path(),'/home/claude/t/kids_sub1.html')
    sub=ext('/home/claude/t/kids_sub1.html'); log.append(('submission type',sub['packageType'],'recordings',sorted(sub['studentAudios'].keys())))
    # 2) teacher: reject r2_1 with TEXT ONLY, approve r3_1, return
    pg=page(); pg.goto('file:///home/claude/t/kids_sub1.html'); pg.wait_for_timeout(700)
    log.append(('teacher role',pg.evaluate("STATE.role")))
    pg.evaluate("document.getElementById('review-teacher-name').value='الأستاذ أحمد'")
    pg.evaluate("setReview('r3_1','approved')"); pg.wait_for_timeout(150)
    pg.evaluate("setReview('r2_1','rejected')"); pg.wait_for_timeout(200)
    pg.fill('#teacher-feedback-text','أحسنت! لكن أخرجت النون خافتة؛ أظهرها واضحة عند «أنعمت». <img src=x onerror="window.__pwn=1">')
    pg.evaluate("confirmTeacherRejection()"); pg.wait_for_timeout(300)
    log.append(('statuses',pg.evaluate("JSON.stringify(Object.fromEntries(Object.entries(PACK_DATA.studentAudios).map(([k,v])=>[k,v.status])))"),'note saved',pg.evaluate("!!(PACK_DATA.teacherNotes&&PACK_DATA.teacherNotes.r2_1)")))
    # empty-note rejection must be refused
    pg.evaluate("setReview('r3_1','rejected')"); pg.wait_for_timeout(150)
    pg.evaluate("document.getElementById('teacher-feedback-text').value=''"); pg.evaluate("confirmTeacherRejection()"); pg.wait_for_timeout(150)
    log.append(('empty rejection refused (r3_1 still approved?)',pg.evaluate("PACK_DATA.studentAudios.r3_1.status")))
    pg.evaluate("cancelTeacherFeedback()")
    with pg.expect_download() as dl: pg.evaluate("exportReturnedPack()")
    shutil.copy(dl.value.path(),'/home/claude/t/kids_returned.html')
    ret=ext('/home/claude/t/kids_returned.html'); log.append(('returned type',ret['packageType'],'notes keys',list(ret.get('teacherNotes',{}).keys()),'audio feedback keys',list(ret['teacherFeedbacks'].keys())))
    # 3) student sees note, re-records, resubmits  (same phone)
    pg=spage(); pg.goto('file:///home/claude/t/kids_returned.html'); pg.wait_for_timeout(700)
    pg.evaluate("continueFromSplash()"); pg.wait_for_timeout(400)
    tfhtml=pg.evaluate("document.getElementById('tf-list').innerText")
    log.append(('returned view: note shown','أظهرها واضحة' in tfhtml,'| raw <img> executed?',pg.evaluate("window.__pwn===1"),'| markup leaked as text?','<img' in tfhtml))
    log.append(('returned view: statuses', 'إعادة التسجيل' in tfhtml, 'معتمد' in tfhtml))
    pg.evaluate("document.getElementById('re-record-btn-r2_1').click()"); pg.wait_for_timeout(1000)
    pg.evaluate("document.getElementById('re-record-btn-r2_1').click()"); pg.wait_for_timeout(800)
    tf2=pg.evaluate("document.getElementById('tf-list').innerText")
    log.append(('after re-record: waiting for teacher','بانتظار المعلم' in tf2))
    with pg.expect_download() as dl: pg.evaluate("doExportStudent('submission')")
    shutil.copy(dl.value.path(),'/home/claude/t/kids_sub2.html')
    sub2=ext('/home/claude/t/kids_sub2.html'); log.append(('resubmission',sub2['packageType'],'reviewCount',sub2.get('reviewCount'),'studentName',sub2.get('studentName')))
    # 4) teacher approves all -> gift
    pg=page(); pg.goto('file:///home/claude/t/kids_sub2.html'); pg.wait_for_timeout(700)
    pg.evaluate("document.getElementById('review-teacher-name').value='الأستاذ أحمد'")
    for k in ('r2_1','r3_1'): pg.evaluate(f"setReview('{k}','approved')"); pg.wait_for_timeout(100)
    with pg.expect_download() as dl: pg.evaluate("exportApprovedPack()")
    shutil.copy(dl.value.path(),'/home/claude/t/kids_gift.html')
    g=ext('/home/claude/t/kids_gift.html'); log.append(('gift',g['packageType'],'groups',[x['name'] for x in g['approvedPeerRecordings']],'notes carried?',g.get('teacherNotes')))
    b.close()
for l in log: print(l)
print('ERRORS:',errs)
