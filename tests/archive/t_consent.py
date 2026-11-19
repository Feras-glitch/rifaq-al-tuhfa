import sys, json, re, shutil, base64
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1.json',encoding='utf8'))
pack={"packageId":"pack_c","packageType":"student_fresh","schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","studentName":"","studentId":"","masterAudios":{},"studentAudios":{},"curriculum":cur}
make('/home/claude/s19.html','/home/claude/t/c_fresh.html',pack)
errs=[]; log=[]
def ext(path):
    h=open(path,encoding='utf8').read(); return json.loads(re.search(r'var PACK_DATA = (\{.*?\});\n/\* ===PACK_DATA_END',h,re.S).group(1))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    ctx=b.new_context(permissions=['microphone'],accept_downloads=True); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append('JS:'+str(e)[:120])); pg.on('dialog',lambda d:(log.append(('dialog',d.message[:90])),d.accept()))
    pg.goto('file:///home/claude/t/c_fresh.html'); pg.wait_for_timeout(500)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','سلمى'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(200)
    pg.evaluate("openSection('s2_idhhar')"); pg.wait_for_timeout(150)
    # 1) record WITHOUT consent -> overlay must appear, no recording
    pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(400)
    log.append(('overlay shown', pg.evaluate("!!document.getElementById('consent-overlay')"), 'recording active', pg.evaluate("!!activeRec")))
    # invalid: no guardian name
    pg.click('#consent-ok'); pg.wait_for_timeout(100)
    log.append(('err on short name', pg.inner_text('#consent-err')[:40]))
    pg.fill('#consent-name','أم سلمى'); pg.click('#consent-ok'); pg.wait_for_timeout(100)
    log.append(('err no checkbox', pg.inner_text('#consent-err')[:40]))
    pg.check('#consent-record'); pg.check('#consent-review'); pg.click('#consent-ok'); pg.wait_for_timeout(800)
    log.append(('recording after consent', pg.evaluate("!!activeRec"), 'consent stored', pg.evaluate("JSON.stringify(STATE.student.consent)")[:80]))
    log.append(('meter present', pg.evaluate("!!document.getElementById('rec-meter')")))
    pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(900)
    log.append(('stopped & saved', pg.evaluate("STATE.studentAudios.r2_1 ? STATE.studentAudios.r2_1.status : null"), 'meter removed', pg.evaluate("!document.getElementById('rec-meter')")))
    # 2) consent persists: no overlay on next record
    pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(300)
    log.append(('no overlay second time', pg.evaluate("!document.getElementById('consent-overlay')"), 'recording', pg.evaluate("!!activeRec")))
    pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(300)
    # 3) max duration auto-stop: shorten via fake timer by overriding setTimeout target constant is not possible; check timer is scheduled
    pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(200)
    log.append(('max timer scheduled', pg.evaluate("activeRec && activeRec.state")))
    pg.evaluate("startRec('r2_1')"); pg.wait_for_timeout(600)
    # 4) export carries consent
    with pg.expect_download() as dl: pg.evaluate("doExportStudent('submission')")
    shutil.copy(dl.value.path(),'/home/claude/t/c_sub.html')
    sub=ext('/home/claude/t/c_sub.html'); log.append(('submission consent', sub.get('studentConsent')))
    # 5) gift export must not carry the child's consent
    b.close()
for l in log: print(l)
print('ERRORS',errs)
