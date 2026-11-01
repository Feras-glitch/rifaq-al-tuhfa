import sys, json, re, shutil, copy
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1_full.json',encoding='utf8'))['sections']
def pj(f):
    h=open(f,encoding='utf8').read(); return json.loads(re.search(r'var PACK_DATA = (\{.*?\});\n/\* ===PACK_DATA_END',h,re.S).group(1))
R={}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    # 1. child submits (with share on so the gift has a group)
    make('/home/claude/s19.html','/home/claude/t/s2_fresh.html',{"packageId":"pack_s2","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"trustedTeacherKeys":[],"curriculum":cur})
    ctx=b.new_context(permissions=['microphone'],accept_downloads=True); pg=ctx.new_page(); pg.on('dialog',lambda d:d.accept())
    pg.goto('file:///home/claude/t/s2_fresh.html'); pg.wait_for_timeout(400)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(120)
    pg.evaluate("() => { STATE.student.consent={v:2,guardian:'ولي سلمى',at:'x',permissions:{record:true,review:true,shareWithPeers:true},excludedRecordings:{}}; save(); return 1; }")
    pg.evaluate("openSection('s3_idgham')"); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(600); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(300)
    with pg.expect_download() as dl: pg.evaluate("doExportStudent('submission')")
    shutil.copy(dl.value.path(),'/home/claude/t/s2_sub.html')
    # 2. teacher: approve and gift; reject one record and return
    tp=b.new_context(accept_downloads=True).new_page(); tp.on('pageerror',lambda e:R.setdefault('err',[]).append(str(e)[:80])); tp.on('dialog',lambda d:d.accept())
    tp.goto('file:///home/claude/t/s2_sub.html'); tp.wait_for_timeout(500)
    tp.evaluate("document.getElementById('review-teacher-name').value='أحمد'")
    tp.evaluate("setReview('r3_1','rejected')"); tp.evaluate("PACK_DATA.teacherNotes={r3_1:'أعِد المد'}")
    tp.evaluate("PACK_DATA.teacherNotes.r3_1 && 1")
    with tp.expect_download() as dl: tp.evaluate("exportReturnedPack()")
    shutil.copy(dl.value.path(),'/home/claude/t/s2_ret.html')
    tk=tp.evaluate("getTeacherSigningKey().then(k=>k.publicJwk)")
    ret=pj('/home/claude/t/s2_ret.html'); R['returned signed']=bool(ret.get('signature'))
    # 3. variants of the returned pack with the teacher's key trusted
    def variant(name, fn):
        pk=copy.deepcopy(ret); pk['trustedTeacherKeys']=[tk]; fn(pk); out=f'/home/claude/t/s2_ret_{name}.html'; make('/home/claude/t/s2_ret.html',out,pk); return out
    vs={'ok':variant('ok',lambda pk:None),
        'note_tampered':variant('note',lambda pk: pk['teacherNotes'].__setitem__('r3_1','تم تغيير الملاحظة')),
        'curriculum_tampered':variant('curr',lambda pk: pk['curriculum'][0]['questions'][0].__setitem__('explanation','تعليل مزوّر')),
        'untrusted':variant('untr',lambda pk: pk.__setitem__('trustedTeacherKeys',[]))}
    for k,f in vs.items():
        rp=b.new_context().new_page(); rp.on('dialog',lambda d:d.accept()); rp.on('pageerror',lambda e:R.setdefault('rerr',[]).append(str(e)[:60]))
        rp.goto('file://'+f); rp.wait_for_timeout(500)
        R['returned '+k]=rp.evaluate('RETURN_TRUST')
        rp.close()
    # 4. gift still verifies after the curriculum digest change (recipient re-sanitises)
    tp.evaluate("setReview('r3_1','approved')")
    with tp.expect_download() as dl: tp.evaluate("exportApprovedPack()")
    shutil.copy(dl.value.path(),'/home/claude/t/s2_gift.html')
    g=pj('/home/claude/t/s2_gift.html'); g['trustedTeacherKeys']=[tk]; make('/home/claude/t/s2_gift.html','/home/claude/t/s2_gift_t.html',g)
    rp=b.new_context().new_page(); rp.on('dialog',lambda d:d.accept()); rp.goto('file:///home/claude/t/s2_gift_t.html'); rp.wait_for_timeout(500)
    R['gift verified after v2']=rp.evaluate('GIFT_TRUST')
    b.close()
for k,v in R.items(): print(k,'=>',json.dumps(v,ensure_ascii=False)[:120])
