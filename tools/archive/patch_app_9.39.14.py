# -*- coding: utf-8 -*-
"""9.39.14: قرارات المالك — الدفعة الثانية (D8 وD5)، في التطبيق ونسخة التجربة.
- D8: قناة تجريبية. RIFAQ_CHANNEL قيمته 'main' في المصدر، ويجعله tools/build_web.py --channel beta 'beta' في نسخة /beta/
  (ويعيد حساب CSP). تخزين الطفل في التجريبي منفصل (بادئة beta_) فلا تختلط بيانات النسختين على الجهاز؛
  مفاتيح توقيع المعلم مشتركة عمدًا، فهوية المعلم واحدة.
- D5: على الموقع الرئيسي يُخفى كل سؤال review = pending (لم يراجعه الشيخ): البنك المحجوز والأسئلة الإملائية تُحذف،
  والسؤال الذي حُوّل وله صيغة سابقة (prev) يعود إليها. البنك الفارغ يجعل الاختبار النهائي يرجع إلى أسئلة الدروس.
  وفي التجريبي يظهر كل شيء للأسرة والمراجعة.
قابل لإعادة التشغيل. شغّله من جذر المستودع بعد سكربتات 9.39.13 ثم tools/rebuild_html.py"""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = []
def rep(old, new): R.append((old, new))

rep("""var BUILTIN_CURRICULUM = null; /* RIFAQ_BUILTIN_CURRICULUM */""",
    """var BUILTIN_CURRICULUM = null; /* RIFAQ_BUILTIN_CURRICULUM */
var RIFAQ_CHANNEL = 'main'; /* RIFAQ_CHANNEL */
/* 9.39.14 (D8): 'beta' في نسخة /beta/ فقط (يكتبها tools/build_web.py --channel beta). */""")
rep("""var STORAGE_BASE = 'tohfa_student_state_' + PACKAGE_ID;""",
    """var STORE_NS = RIFAQ_CHANNEL === 'beta' ? 'beta_' : ''; // 9.39.14 (D8): تقدّم الطفل في التجريبي منفصل عن الرئيسي
var STORAGE_BASE = STORE_NS + 'tohfa_student_state_' + PACKAGE_ID;""")
rep("""var DB_BASE = 'tohfa_student_audio_' + PACKAGE_ID;""",
    """var DB_BASE = STORE_NS + 'tohfa_student_audio_' + PACKAGE_ID;""")
# التعقيم يحفظ علامة المراجعة والصيغة السابقة
rep("""if (q.set === 'A' || q.set === 'B') r.q.set = q.set; return r.q; }""",
    """if (q.set === 'A' || q.set === 'B') r.q.set = q.set; if (q.review === 'pending') r.q.review = 'pending'; return r.q; }""")
rep("""          if (q.set !== 'A' && q.set !== 'B') delete q.set;""",
    """          if (q.set !== 'A' && q.set !== 'B') delete q.set;
          if (q.review !== 'pending') delete q.review; // 9.39.14 (D5)
          if (q.prev && typeof q.prev === 'object' && !Array.isArray(q.prev) && typeof q.prev.text === 'string'){
            var pv = {}; ['text','question','source'].forEach(function(f){ if (typeof q.prev[f] === 'string') pv[f] = safeHTML(q.prev[f]); }); q.prev = pv;
          } else delete q.prev;""")
rep("""var REF_CURRICULUM_REPLACED = false;""",
    """var REF_CURRICULUM_REPLACED = false;
/* 9.39.14 (D5): المحتوى الذي لم يراجعه الشيخ لا يظهر على الموقع الرئيسي */
var CONTENT_HIDDEN = 0;
function contentChannelFilter(secs){
  if (RIFAQ_CHANNEL === 'beta' || !Array.isArray(secs)) return 0;
  var n = 0;
  var fix = function(list){ return (Array.isArray(list) ? list : []).map(function(q){
    if (!q || q.review !== 'pending') return q;
    n++;
    if (q.prev && typeof q.prev.text === 'string'){ var r = Object.assign({}, q, {text: q.prev.text}); if (typeof q.prev.question === 'string') r.question = q.prev.question; if (typeof q.prev.source === 'string') r.source = q.prev.source; delete r.prev; delete r.review; return r; }
    return null;
  }).filter(Boolean); };
  secs.forEach(function(s){
    if (!s || typeof s !== 'object' || s._synthetic) return;
    s.questions = fix(s.questions);
    if (Array.isArray(s.examQuestions)) s.examQuestions = fix(s.examQuestions);
  });
  return n;
}
function applyContentChannel(){ CONTENT_HIDDEN = contentChannelFilter(CURRICULUM); }""")
rep("""  applyRefPolicy();
  setTimeout(showDueReviewBanner, 1200);""", """  applyRefPolicy();
  applyContentChannel(); // 9.39.14 (D5): بعد استبدال المنهج غير الموثّق إن حدث
  setTimeout(showDueReviewBanner, 1200);""")

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new and new in s: continue
        n = s.count(old)
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:110]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
