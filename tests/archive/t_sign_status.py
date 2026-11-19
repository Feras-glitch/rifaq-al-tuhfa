import sys, json, re, shutil
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1.json',encoding='utf8'))
def fresh(trusted):
    pack={"packageId":"pack_ss","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"trustedTeacherKeys":trusted,"curriculum":cur}
    make('/home/claude/s19.html','/home/claude/t/ss_fresh.html',pack)
errs=[]; log=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    # student submission
    fresh([])
    ctx=b.new_context(permissions=['microphone'],accept_downloads=True); pg=ctx.new_page(); pg.on('dialog',lambda d:d.accept())
    pg.goto('file:///home/claude/t/ss_fresh.html'); pg.wait_for_timeout(400)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(120)
    pg.evaluate("() => { STATE.student.consent={v:2,guardian:'أم سلمى',at:'x',permissions:{record:true,review:true,shareWithPeers:false},excludedRecordings:{}}; save(); return 1; }")
    pg.evaluate("openSection('s3_idgham')"); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(700); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(400)
    with pg.expect_download() as dl: pg.evaluate("doExportStudent('submission')")
    shutil.copy(dl.value.path(),'/home/claude/t/ss_sub.html')
    # teacher, no key yet
    tctx=b.new_context(); tp=tctx.new_page(); tp.on('pageerror',lambda e:errs.append(str(e)[:100])); tp.on('dialog',lambda d:(log.append(('confirm-msg',d.message[:70])),d.dismiss()))
    tp.goto('file:///home/claude/t/ss_sub.html'); tp.wait_for_timeout(500)
    tp.evaluate("document.getElementById('review-teacher-name').value='أحمد'"); tp.evaluate("setReview('r3_1','approved')")
    tp.evaluate("showTeacherReview && showTeacherReview()"); tp.wait_for_timeout(300)
    log.append(('no key line', tp.inner_text('#review-sign-line')[:60]))
    tp.evaluate("exportApprovedPack()"); tp.wait_for_timeout(300)  # confirm dismissed -> no download
    log.append(('dismissed -> no key? (key created)', tp.evaluate("getTeacherSigningKey().then(k=>!!k)")))
    # key exists, list empty
    tp.evaluate("showTeacherReview && showTeacherReview()"); tp.wait_for_timeout(300)
    log.append(('empty list line', tp.inner_text('#review-sign-line')[:60]))
    tk=tp.evaluate("getTeacherSigningKey().then(k=>k.publicJwk)")
    # reload teacher with a trust list that does NOT include key
    other={"kty":"EC","crv":"P-256","x":"A"*43,"y":"B"*43}
    make('/home/claude/t/ss_sub.html','/home/claude/t/ss_sub_notlisted.html',{**json.loads(re.search(r'var PACK_DATA = (\{.*?\});\n/\* ===PACK_DATA_END',open('/home/claude/t/ss_sub.html',encoding='utf8').read(),re.S).group(1)),'trustedTeacherKeys':[other]})
    tp2=tctx.new_page(); tp2.on('pageerror',lambda e:errs.append('T2:'+str(e)[:100])); tp2.on('dialog',lambda d:d.dismiss())
    tp2.goto('file:///home/claude/t/ss_sub_notlisted.html'); tp2.wait_for_timeout(300)
    tp2.evaluate("setReview && 0"); tp2.evaluate("document.getElementById('review-teacher-name').value='أحمد'")
    tp2.evaluate("showTeacherReview && showTeacherReview()"); tp2.wait_for_timeout(300)
    log.append(('not-listed line (fresh browser, no key yet)', tp2.inner_text('#review-sign-line')[:60]))
    # trusted case: list contains the teacher's key of tp (same browser profile not shared) -> simulate by listing tp's key in the file
    trustedfile=json.loads(re.search(r'var PACK_DATA = (\{.*?\});\n/\* ===PACK_DATA_END',open('/home/claude/t/ss_sub.html',encoding='utf8').read(),re.S).group(1))
    trustedfile['trustedTeacherKeys']=[tk]
    make('/home/claude/t/ss_sub.html','/home/claude/t/ss_sub_trusted.html',trustedfile)
    tp3=tctx.new_page(); tp3.on('pageerror',lambda e:errs.append('T3:'+str(e)[:100])); tp3.on('dialog',lambda d:d.accept())
    tp3.goto('file:///home/claude/t/ss_sub_trusted.html'); tp3.wait_for_timeout(300)
    tp3.evaluate("showTeacherReview && showTeacherReview()"); tp3.wait_for_timeout(300)
    log.append(('trusted line (same browser key)', tp3.inner_text('#review-sign-line')[:60]))
    b.close()
for l in log: print(l)
print('ERRORS',errs)
