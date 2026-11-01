import sys,json
from playwright.sync_api import sync_playwright
from mkpack import *
def evil():
    g=gift(); c=g['curriculum'][0]
    c['title']='<img src=x onerror="window.__pwn=1">عنوان'
    c['id']="a');window.__pwn=1;//"
    c['items'][0]['text']='بيت<script>window.__pwn=1</script><b onmouseover="window.__pwn=1">ب</b>'
    c['items'][0]['desc']='<svg onload="window.__pwn=1"></svg>شرح'
    c['questions'][0]['text']='<iframe src="javascript:window.__pwn=1"></iframe>س؟'
    c['questions'][0]['options']=['<img src=x onerror="window.__pwn=1">أ','ب','<a href="javascript:window.__pwn=1">ج</a>']
    c['questions'][0]['explanation']='<img src=x onerror="window.__pwn=1">'
    g['teacherPhoto']='x" onerror="window.__pwn=1'
    g['sourceGiftStudentPhoto']='javascript:window.__pwn=1'
    g['masterAudios']={'v1':'x" onerror="window.__pwn=1'}
    g['approvedPeerRecordings'][0]['photo']='x" onerror="window.__pwn=1'
    g['approvedPeerRecordings'][0]['audios']['v1']['audio']='x" onerror="window.__pwn=1" a="'
    g['approvedPeerRecordings'][0]['name']='<img src=x onerror="window.__pwn=1">'
    return g
def run(label,src):
    make(src,'/home/claude/t/evil.html',evil())
    with sync_playwright() as p:
        b=p.chromium.launch(); pg=b.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)[:80])); pg.on('dialog',lambda d:d.accept())
        pg.goto('file:///home/claude/t/evil.html'); pg.wait_for_timeout(500)
        pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','x'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(300)
        try:
            pg.evaluate("openSection(CURRICULUM[0].id)"); pg.wait_for_timeout(400)
            pg.evaluate("startQuiz()"); pg.wait_for_timeout(300); pg.evaluate("answer(0)"); pg.wait_for_timeout(300)
        except Exception as e: errs.append('flow:'+str(e)[:60])
        pg.wait_for_timeout(500)
        print(label,'pwned:',pg.evaluate("window.__pwn===1"),'| sanitize report:',pg.evaluate("typeof SANITIZE_REPORT!=='undefined'?JSON.stringify(SANITIZE_REPORT):'n/a'"),'| errs:',errs[:2])
        b.close()

run('v9.17 ','/home/claude/s19.html')
