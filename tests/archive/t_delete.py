from playwright.sync_api import sync_playwright
import json,sys
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1_full.json',encoding='utf8'))['sections']
make('/home/claude/s19.html','/home/claude/t/del_fresh.html',{"packageId":"pack_del","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"trustedTeacherKeys":[],"curriculum":cur})
R=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    ctx=b.new_context(permissions=['microphone']); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:80])); pg.on('dialog',lambda d:d.accept())
    pg.goto('file:///home/claude/t/del_fresh.html'); pg.wait_for_timeout(400)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(120)
    pg.fill('#consent-name','ولي') if False else None
    pg.evaluate("() => { STATE.student.consent={v:2,guardian:'ولي سلمى',at:'x',permissions:{record:true,review:true,shareWithPeers:false},excludedRecordings:{}}; save(); return 1; }")
    pg.evaluate("openSection('s3_idgham')"); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(500); pg.evaluate("startRec('r3_1')"); pg.wait_for_timeout(400)
    R.append(('before: rec', pg.evaluate("!!(STATE.studentAudios.r3_1)"), 'LS keys', pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('tohfa_student_state')).length")))
    pg.evaluate("deleteChildDataOnDevice()")  # reloads
    pg.wait_for_timeout(800)
    R.append(('after reload: consent', pg.evaluate("!!(STATE.student && STATE.student.consent)"), 'rec', pg.evaluate("Object.keys(STATE.studentAudios||{}).length")))
    R.append(('LS keys left', pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('tohfa_student_state')).length")))
    R.append(('db left', pg.evaluate("indexedDB.databases ? indexedDB.databases().then(d=>d.filter(x=>x.name.startsWith('tohfa_student_audio')).length) : -1")))
    R.append(('errs',errs[:2]))
    b.close()
for r in R: print(r)
