"""اختبار انحدار: النقر الحقيقي على خيارات الاختيار من متعدد يجب أن يُحتسب صحيحًا.
(كان الخلل: الزر يرسل نصًا بدل رقم الخيار، فتُحسب كل إجابة صحيحة خطأ. لم تكشفه الاختبارات السابقة لأنها تستدعي answer() مباشرة.)
الاستخدام: python3 t_realclick.py <ملف_التطبيق.html>"""
import sys
from playwright.sync_api import sync_playwright
f=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.on('dialog',lambda d:d.accept())
    pg.goto('file://'+f); pg.wait_for_timeout(400)
    pg.evaluate("continueFromSplash()"); pg.fill('#setup-name','اختبار'); pg.evaluate("saveSetup()"); pg.wait_for_timeout(120)
    pg.evaluate("openSection('s2_idhhar')"); pg.evaluate("startQuiz()"); pg.wait_for_timeout(150)
    idx=pg.evaluate("CURRENT.section.questions.findIndex(q=>q.type==='multiple_choice')")
    for _ in range(idx):
        pg.evaluate("(()=>{const q=CURRENT.section.questions[CURRENT.qIdx]; if(['multiple_choice','extraction','true_false'].includes(q.type)){answer(q.answer);} else {finishAnswer(true,q);} })()")
        if pg.evaluate("!!document.querySelector('#feedback-box button')"): pg.evaluate("document.querySelector('#feedback-box button').click()")
    q=pg.evaluate("CURRENT.section.questions[CURRENT.qIdx]")
    pg.click(f"#options .option-btn[data-idx='{q['answer']}']"); pg.wait_for_timeout(150)
    ok=pg.evaluate("document.querySelector('#feedback-box .feedback').className").strip()==('feedback')
    print('REAL CORRECT CLICK COUNTED CORRECT:', ok)
    b.close()
    sys.exit(0 if ok else 1)
