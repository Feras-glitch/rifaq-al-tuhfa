import json,sys,re,shutil
sys.path.insert(0,'/home/claude/t')
from mkpack import make
from playwright.sync_api import sync_playwright
h=open('/home/claude/t/d1_sub_b.html',encoding='utf8').read()
pk=json.loads(re.search(r'var PACK_DATA = (\{.*?\});\n/\* ===PACK_DATA_END',h,re.S).group(1))
make('/home/claude/s24.html','/home/claude/t/rating_sub.html',{**pk,'trustedTeacherKeys':[],'teacherRatings':{}})
out=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(accept_downloads=True); tp=ctx.new_page(); errs=[]
    tp.on('pageerror',lambda e:errs.append(str(e)[:80])); tp.on('dialog',lambda d:d.accept())
    tp.goto('file:///home/claude/t/rating_sub.html'); tp.wait_for_timeout(500)
    tp.evaluate("document.getElementById('review-teacher-name').value='أحمد'")
    tp.evaluate("showTeacherReview()"); tp.wait_for_timeout(300)
    out.append(('rating buttons', tp.evaluate("document.querySelectorAll('.rating-row button').length")))
    tp.evaluate("document.querySelector('.rating-row button').click()"); tp.wait_for_timeout(300)
    out.append(('rating set', tp.evaluate("JSON.stringify(PACK_DATA.teacherRatings)")))
    tp.evaluate("(()=>{const s=document.querySelector('select.note-bank'); s.value='الغنة قصيرة'; s.dispatchEvent(new Event('change',{bubbles:true}));})()"); tp.wait_for_timeout(300)
    out.append(('note set', tp.evaluate("JSON.stringify(PACK_DATA.teacherNotes)")))
    tp.evaluate("setReview('r3_1','rejected')")
    tp.evaluate("PACK_DATA.teacherNotes.r3_1 = 'الغنة قصيرة'")
    with tp.expect_download() as dl: tp.evaluate("exportReturnedPack()")
    shutil.copy(dl.value.path(),'/home/claude/t/rating_ret.html')
    rp=ctx.new_page(); rp.on('pageerror',lambda e:errs.append('C:'+str(e)[:80])); rp.on('dialog',lambda d:d.accept())
    rp.goto('file:///home/claude/t/rating_ret.html'); rp.wait_for_timeout(500)
    rp.evaluate("continueFromSplash()"); rp.wait_for_timeout(200); rp.evaluate("renderTFView()"); rp.wait_for_timeout(200)
    txt=rp.evaluate("document.getElementById('tf-list').innerText")
    out.append(('child sees rating summary', 'تقييم المعلم' in txt))
    out.append(('errs', errs[:3]))
    b.close()
for o in out: print(o)
