import sys, json, re, shutil
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1.json',encoding='utf8'))
pack={"packageId":"pack_pt","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"curriculum":cur}
make('/home/claude/s19.html','/home/claude/t/pt_fresh.html',pack)
errs=[]; log=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    ctx=b.new_context(permissions=['microphone'],accept_downloads=True); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)[:100])); pg.on('dialog',lambda d:(log.append(('alert',d.message[:60])),d.accept()))
    pg.goto('file:///home/claude/t/pt_fresh.html'); pg.wait_for_timeout(400)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(120)
    pg.evaluate("() => { STATE.student.consent={v:2,guardian:'أم سلمى',at:'x',permissions:{record:true,review:true,shareWithPeers:false},excludedRecordings:{}}; save(); return 1; }")
    pg.evaluate("openSection('s3_idgham')"); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(800)
    pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(900)
    log.append(('partial flag stored', pg.evaluate("STATE.studentAudios.r3_1 && STATE.studentAudios.r3_1.partial")))
    pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false})")
    with pg.expect_download() as dl: pg.evaluate("doExportStudent('submission')")
    shutil.copy(dl.value.path(),'/home/claude/t/pt_sub.html')
    tp=b.new_context().new_page(); tp.on('pageerror',lambda e:errs.append('T:'+str(e)[:100])); tp.on('dialog',lambda d:d.accept())
    tp.goto('file:///home/claude/t/pt_sub.html'); tp.wait_for_timeout(500)
    tp.evaluate("showTeacherReview && showTeacherReview()"); tp.wait_for_timeout(300)
    log.append(('teacher sees partial warning', 'تسجيل ناقص' in tp.inner_text('#review-list')))
    b.close()
for l in log: print(l)
print('ERRORS',errs)
