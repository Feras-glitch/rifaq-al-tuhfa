import json, sys, copy
from playwright.sync_api import sync_playwright
sys.path.insert(0,'/home/claude/t')
from mkpack import make
cur=json.load(open('/home/claude/kids/kids_curriculum_stage1_full.json',encoding='utf8'))['sections']
EVIL_AUD='data:audio/webm;base64,AAAA" onerror="window.__pwn=1" x="'
EVIL_IMG='x" onerror="window.__pwn=1" x="'
res=[]
def build(name, ptype, broken):
    c=copy.deepcopy(cur)
    if broken: c[0]['items'].append(None)
    pack={"packageId":"pack_inj3","packageType":ptype,"schemaVersion":2,"appVersion":"9.19","sheikhName":"الشيخ","teacherName":"المعلم","teacherGender":"boy","teacherPhoto":EVIL_IMG,"sheikhPhoto":EVIL_IMG,"supervisorPhoto":EVIL_IMG,"studentName":"سلمى","studentId":"stu_x","studentGender":"girl","studentPhoto":EVIL_IMG,
          "masterAudios":{},"studentAudios":{"r3_1":{"audio":EVIL_AUD,"status":"rejected" if ptype=='student_returned' else "pending","feedback":None}},
          "approvedPeerRecordings":[{"id":"g1","name":"ليلى","gender":"girl","photo":EVIL_IMG,"shareable":True,"audios":{"r3_1":{"audio":EVIL_AUD,"status":"approved"}}}],
          "teacherNotes":{"r3_1":"ملاحظة"},"curriculum":c}
    f=f'/home/claude/t/inj3_{name}.html'; make('/home/claude/s19.html',f,pack); return f
with sync_playwright() as p:
    b=p.chromium.launch()
    for ptype in ('student_submission','student_returned','approved_gift'):
        for broken in (False,True):
            name=f"{ptype}_{'broken' if broken else 'ok'}"
            f=build(name,ptype,broken); pg=b.new_page(); errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e)[:60])); pg.on('dialog',lambda d:d.accept())
            pg.goto('file://'+f); pg.wait_for_timeout(500)
            try:
                if ptype=='student_submission': pg.evaluate("showTeacherReview && showTeacherReview()")
                else:
                    pg.evaluate("continueFromSplash()"); pg.wait_for_timeout(200)
                    try: pg.evaluate("renderTFView()")
                    except Exception: pass
                    try: pg.evaluate("openSection('s3_idgham')")
                    except Exception: pass
            except Exception as e: errs.append('nav:'+str(e)[:50])
            pg.wait_for_timeout(300)
            html=pg.evaluate("document.body.innerHTML")
            res.append((name,'pwned',pg.evaluate("window.__pwn===1"),'attr-in-dom','onerror="window.__pwn' in html,'errs',errs[:1]))
            pg.close()
    b.close()
for r in res: print(r)
