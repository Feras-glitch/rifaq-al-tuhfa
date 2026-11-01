import sys, json, re, shutil
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1.json',encoding='utf8'))
pack={"packageId":"pack_tc","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"curriculum":cur}
make('/home/claude/s19.html','/home/claude/t/tc_fresh.html',pack)
errs=[]; log=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    res={}
    for label,consent in (('with',True),):
        ctx=b.new_context(permissions=['microphone'],accept_downloads=True); pg=ctx.new_page()
        pg.on('pageerror',lambda e:errs.append(str(e)[:100])); pg.on('dialog',lambda d:d.accept())
        pg.goto('file:///home/claude/t/tc_fresh.html'); pg.wait_for_timeout(400)
        pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(120)
        if consent: pg.evaluate("() => { STATE.student.consent={v:2,guardian:'أم سلمى',at:'2026-10-01T10:00:00Z',permissions:{record:true,review:true,shareWithPeers:false},excludedRecordings:{}}; save(); return 1; }")
        else: pg.evaluate("() => { STATE.student.consent=null; save(); return 1; }")
        pg.evaluate("openSection('s3_idgham')"); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(700); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(500)
        with pg.expect_download() as dl: pg.evaluate("doExportStudent('submission')")
        f=f'/home/claude/t/tc_sub_{label}.html'; shutil.copy(dl.value.path(),f)
        tp=b.new_context().new_page(); tp.on('pageerror',lambda e:errs.append('T:'+str(e)[:100])); tp.on('dialog',lambda d:d.accept())
        tp.goto('file://'+f); tp.wait_for_timeout(500)
        tp.evaluate("showTeacherReview && showTeacherReview()"); tp.wait_for_timeout(300)
        res[label]=tp.inner_text('#review-consent-line') if tp.query_selector('#review-consent-line') else None
    # variant without consent (older package): strip the field
    import copy
    h=open('/home/claude/t/tc_sub_with.html',encoding='utf8').read()
    pk=json.loads(re.search(r'var PACK_DATA = (\{.*?\});\n/\* ===PACK_DATA_END',h,re.S).group(1)); pk['studentConsent']=None
    make('/home/claude/t/tc_sub_with.html','/home/claude/t/tc_sub_without.html',pk)
    tp=b.new_context().new_page(); tp.on('dialog',lambda d:d.accept())
    tp.goto('file:///home/claude/t/tc_sub_without.html'); tp.wait_for_timeout(500)
    tp.evaluate("showTeacherReview && showTeacherReview()"); tp.wait_for_timeout(300)
    res['without']=tp.inner_text('#review-consent-line')
    b.close()
log.append(res); print(res); print('ERRORS',errs)
