import sys, json, re, shutil, copy
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1.json',encoding='utf8'))
pack={"packageId":"pack_sig","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"curriculum":cur}
make('/home/claude/s19.html','/home/claude/t/sig_fresh.html',pack)
def ext(path):
    h=open(path,encoding='utf8').read(); return json.loads(re.search(r'var PACK_DATA = (\{.*?\});\n/\* ===PACK_DATA_END',h,re.S).group(1))
errs=[]; log=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    # --- student records and submits
    ctx=b.new_context(permissions=['microphone'],accept_downloads=True); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append('S:'+str(e)[:120])); pg.on('dialog',lambda d:d.accept())
    pg.goto('file:///home/claude/t/sig_fresh.html'); pg.wait_for_timeout(500)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(150)
    pg.evaluate("() => { STATE.student.consent={v:2,guardian:'أم سلمى',at:'x',permissions:{record:true,review:true,shareWithPeers:true},excludedRecordings:{}}; save(); return 1; }")
    pg.evaluate("openSection('s3_idgham')"); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(900); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(600)
    with pg.expect_download() as dl: pg.evaluate("doExportStudent('submission')")
    shutil.copy(dl.value.path(),'/home/claude/t/sig_sub.html')
    # --- teacher approves and exports gift (teacher creates signing key on first use)
    tctx=b.new_context(accept_downloads=True); tp=tctx.new_page()
    tp.on('pageerror',lambda e:errs.append('T:'+str(e)[:120])); tp.on('dialog',lambda d:d.accept())
    tp.goto('file:///home/claude/t/sig_sub.html'); tp.wait_for_timeout(600)
    tp.evaluate("document.getElementById('review-teacher-name').value='الأستاذ أحمد'"); tp.evaluate("setReview('r3_1','approved')")
    with tp.expect_download() as dl: tp.evaluate("exportApprovedPack()")
    shutil.copy(dl.value.path(),'/home/claude/t/sig_gift.html')
    tk=tp.evaluate("getTeacherSigningKey().then(k=>k.publicJwk)")
    g=ext('/home/claude/t/sig_gift.html')
    log.append(('gift has signature', bool(g.get('signature')), 'trusted list in gift', len(g.get('trustedTeacherKeys',[]))))
    def variant(name, mutate):
        pk=copy.deepcopy(g); mutate(pk); out=f'/home/claude/t/sig_{name}.html'; make('/home/claude/t/sig_gift.html', out, pk); return out
    def trust_it(pk): pk['trustedTeacherKeys']=[tk]
    vs={
      'valid': variant('valid', trust_it),
      'untrusted': variant('untrusted', lambda pk: pk.__setitem__('trustedTeacherKeys', [])),
      'tampered': variant('tampered', lambda pk: (trust_it(pk), pk['approvedPeerRecordings'][-1]['audios'].__setitem__(list(pk['approvedPeerRecordings'][-1]['audios'].keys())[0], {'status':'approved','audio':'data:audio/webm;base64,AAAAAAAA'}))),
      'unsigned': variant('unsigned', lambda pk: (trust_it(pk), pk.__setitem__('signature', None))),
      'status_flip': variant('flip', lambda pk: (trust_it(pk), pk['approvedPeerRecordings'][-1]['audios'][list(pk['approvedPeerRecordings'][-1]['audios'].keys())[0]].__setitem__('status','pending'))),
    }
    for k,f in vs.items():
        rp=b.new_context().new_page(); rp.on('pageerror',lambda e:errs.append(k+':'+str(e)[:100])); rp.on('dialog',lambda d:d.accept())
        rp.goto('file://'+f); rp.wait_for_timeout(500)
        log.append((k, rp.evaluate("GIFT_TRUST"), '|', rp.inner_text('#gift-source-description')[-60:] if rp.query_selector('#gift-source-description') else ''))
    b.close()
for l in log: print(l)
print('ERRORS',errs)
