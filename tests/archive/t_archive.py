import json,sys,re,base64
sys.path.insert(0,'/home/claude/t')
from mkpack import make
from playwright.sync_api import sync_playwright
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1_full.json',encoding='utf8'))['sections']
make('/home/claude/s26.html','/home/claude/t/arch26.html',{"packageId":"pack_arch","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.26","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"trustedTeacherKeys":[],"curriculum":cur})
out=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(accept_downloads=True); pg=ctx.new_page(); errs=[]; v=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:80])); pg.on('dialog',lambda d:d.accept())
    pg.on('console', lambda m: v.append(m.text[:50]) if 'Content Security' in m.text else None)
    pg.goto('file:///home/claude/t/arch26.html'); pg.wait_for_timeout(500)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(150)
    pg.evaluate("() => { STATE.student.consent={v:2,guardian:'ولي سلمى',at:'x',permissions:{record:true,review:true,shareWithPeers:false},excludedRecordings:{}}; STATE.studentAudios={r3_1:{status:'pending',updatedAt:'2026-10-01T00:00:00Z'}}; save(); return 1; }")
    # seed a recording blob in the audio store
    pg.evaluate("dbPut('r3_1', new Blob([new Uint8Array([1,2,3,4])], {type:'audio/webm;codecs=opus'}))"); pg.wait_for_timeout(200)
    pg.evaluate("openGuardianSettings()"); pg.wait_for_timeout(200)
    with pg.expect_download() as dl: pg.evaluate("document.getElementById('gs-archive').click()")
    f=str(dl.value.path()); html=open(f,encoding='utf8').read()
    out.append(('archive has audio data', 'data:audio/webm' in html, 'file name', dl.value.suggested_filename[:20]))
    out.append(('archive has no script', '<script' not in html.lower()))
    rp=b.new_page(); rv=[]; rp.on('console', lambda m: rv.append(m.text[:40]) if 'Content Security' in m.text else None)
    rp.goto('file://'+f); rp.wait_for_timeout(300)
    out.append(('archive opens, csp violations', len(rv)))
    # teacher retention: roster entry received long ago
    pg.evaluate("keyDbPut('roster', {'stu_old': {name:'قديم', at:'2026-08-01T00:00:00Z', receivedAt:'2026-08-01T00:00:00Z', submittedAt:'2026-08-01T00:00:00Z', pending:0, rated:1, mastered:0, pendingConcepts:16, escalated:[]}})")
    pg.evaluate("openRoster()"); pg.wait_for_timeout(400)
    out.append(('retention reminder shown', pg.evaluate("document.getElementById('roster-overlay').innerText.includes('مرّ 30 يومًا')")))
    pg.evaluate("markRosterDeleted('stu_old')"); pg.wait_for_timeout(400)
    out.append(('after mark deleted', pg.evaluate("document.getElementById('roster-overlay') ? document.getElementById('roster-overlay').innerText.includes('حُذف') : false")))
    out.append(('page errors', errs[:2], 'csp', len(v)))
    b.close()
for o in out: print(o)
