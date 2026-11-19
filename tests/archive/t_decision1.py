import sys, json, re, shutil
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1_full.json',encoding='utf8'))['sections']
def fresh(out):
    make('/home/claude/s19.html',out,{"packageId":"pack_d1","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"trustedTeacherKeys":[],"curriculum":cur})
def pj(f):
    h=open(f,encoding='utf8').read(); return json.loads(re.search(r'var PACK_DATA = (\{.*?\});\n/\* ===PACK_DATA_END',h,re.S).group(1))
R={}
def child_flow(b, name, share, exclude=False, tag=''):
    fresh('/home/claude/t/d1_fresh.html')
    ctx=b.new_context(permissions=['microphone'],accept_downloads=True); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:90])); pg.on('dialog',lambda d:d.accept())
    pg.goto('file:///home/claude/t/d1_fresh.html'); pg.wait_for_timeout(400)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name',name); pg.evaluate("saveSetup()"); pg.wait_for_timeout(120)
    pg.evaluate("openSection('s3_idgham')"); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(300)
    pg.fill('#consent-name','ولي '+name)
    pg.check('#consent-record'); pg.check('#consent-review')
    if share: pg.check('#consent-share')
    pg.click('#consent-ok'); pg.wait_for_timeout(700)
    pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(300)
    pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(400)
    if exclude:
        pg.evaluate("openGuardianSettings()"); pg.wait_for_timeout(150)
        pg.evaluate("document.querySelectorAll('.gs-rec').forEach(cb=>cb.checked=false)")
        pg.click('#gs-save'); pg.wait_for_timeout(150)
    with pg.expect_download() as dl: pg.evaluate("doExportStudent('submission')")
    f=f'/home/claude/t/d1_sub_{tag}.html'; shutil.copy(dl.value.path(),f); pg.close()
    return f, errs
def teacher_gift(b, sub, tag):
    tp=b.new_context(accept_downloads=True).new_page(); errs=[]
    tp.on('pageerror',lambda e:errs.append('T:'+str(e)[:90])); tp.on('dialog',lambda d:d.accept())
    tp.goto('file://'+sub); tp.wait_for_timeout(500)
    tp.evaluate("document.getElementById('review-teacher-name').value='أحمد'"); tp.evaluate("setReview('r3_1','approved')")
    with tp.expect_download() as dl: tp.evaluate("exportApprovedPack()")
    g=f'/home/claude/t/d1_gift_{tag}.html'; shutil.copy(dl.value.path(),g)
    tk=tp.evaluate("getTeacherSigningKey().then(k=>k.publicJwk)")
    tp.close(); return g, tk, errs
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    # A: share = off (default)
    sa,ea=child_flow(b,'سلمى',False,tag='a'); ga,tk,eg=teacher_gift(b,sa,'a')
    g=pj(ga); R['A share-off: groups']=[x['name'] for x in g['approvedPeerRecordings']]; R['A consent in gift']=g.get('studentConsent')
    # B: share = on
    sb,_=child_flow(b,'ليلى',True,tag='b'); gb,tkb,_=teacher_gift(b,sb,'b'); gbp=pj(gb)
    R['B share-on: groups']=[(x['name'],x.get('shareable')) for x in gbp['approvedPeerRecordings']]
    # C: share on, but recording excluded
    sc,_=child_flow(b,'نور',True,exclude=True,tag='c'); gc,_,_=teacher_gift(b,sc,'c'); gcp=pj(gc)
    R['C excluded: groups']=[(x['name'],len(x['audios'])) for x in gcp['approvedPeerRecordings']]
    # D: tamper shareable flag in B -> signature must fail when trusted
    dpk=pj(gb); dpk['trustedTeacherKeys']=[tkb]; dpk['approvedPeerRecordings'][-1]['shareable']=False
    make(gb,'/home/claude/t/d1_tamper.html',dpk)
    # E: legacy v1 consent must not satisfy hasConsent
    pg=b.new_context().new_page(); pg.on('dialog',lambda d:d.accept()); pg.on('pageerror',lambda e:errs.append('E:'+str(e)[:80]))
    pg.goto('file:///home/claude/t/d1_fresh.html'); pg.wait_for_timeout(400)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','قديم'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(120)
    pg.evaluate("() => { STATE.student.consent={v:1,guardian:'ولي',at:'x'}; save(); return 1; }")
    pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(300)
    R['E legacy v1 -> reconsent required']=pg.evaluate("!!document.getElementById('consent-overlay')")
    # F: tamper check at recipient
    rp=b.new_context().new_page(); rp.on('dialog',lambda d:d.accept())
    rp.goto('file:///home/claude/t/d1_tamper.html'); rp.wait_for_timeout(500)
    R['D tamper shareable -> GIFT_TRUST']=rp.evaluate('GIFT_TRUST')
    b.close()
for k,v in R.items(): print(k,'=>',json.dumps(v,ensure_ascii=False)[:160])
