import sys, json
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1.json',encoding='utf8'))
pack={"packageId":"pack_c","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"curriculum":cur}
make('/home/claude/s19.html','/home/claude/t/c_fresh.html',pack)
errs=[]; log=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    ctx=b.new_context(permissions=['microphone'],accept_downloads=True); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append('JS:'+str(e)[:120])); pg.on('dialog',lambda d:(log.append(('dialog',d.message[:100])),d.accept()))
    pg.goto('file:///home/claude/t/c_fresh.html'); pg.wait_for_timeout(500)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(150)
    pg.evaluate("() => { STATE.student.consent={v:2,guardian:'أم سلمى',at:'x',permissions:{record:true,review:true,shareWithPeers:false},excludedRecordings:{}}; save(); return 1; }")
    pg.evaluate("openSection('s2_idhhar')"); pg.wait_for_timeout(150)
    # A) max duration auto-stop (shortened)
    pg.evaluate("REC_MAX_MS=1500"); pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(3000)
    log.append(('A max stop: recording state after 3s', pg.evaluate("!!activeRec"), 'status', pg.evaluate("STATE.studentAudios.r2_1 && STATE.studentAudios.r2_1.status")))
    # B) silence prompt (everything counts as quiet)
    pg.evaluate("REC_MAX_MS=60000; REC_SILENCE_MS=400; REC_SILENCE_LEVEL=5")
    pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(1200)
    log.append(('B silence message', pg.evaluate("document.getElementById('rec-meter-msg') && document.getElementById('rec-meter-msg').textContent")))
    pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(500)
    # C) leaving the app mid-recording stops and keeps partial
    pg.evaluate("REC_SILENCE_LEVEL=0.012; REC_SILENCE_MS=6000")
    pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(800)
    pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_timeout(900)
    log.append(('C leave-app stopped', not pg.evaluate("!!activeRec"), 'saved', pg.evaluate("STATE.studentAudios.r2_1 && STATE.studentAudios.r2_1.status")))
    pg.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false})")
    # D) stop button still works normally, meter removed
    pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(500); pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(700)
    log.append(('D normal stop, meter gone', not pg.evaluate("!!document.getElementById('rec-meter')")))
    b.close()
for l in log: print(l)
print('ERRORS',errs)
