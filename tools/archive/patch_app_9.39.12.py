# -*- coding: utf-8 -*-
"""9.39.12: إصلاحات مراجعة 13 نوفمبر التي لا تحتاج قرار المالك (التطبيق ونسخة التجربة).
- I1: الكلمة المسؤول عنها في أسئلة الاستخراج تُبرز بلون وخلفية (كانت الآية كلها ثقيلة فلا تتميز)، وتظهر في ملخص الاختبار.
- O3: لا تصدير «إعداد مشرف» من ملف الطالب؛ الإهداء يصدره المعلم بعد فحص إذن المشاركة.
- I4: لا تُعرض الأسماء العامة («الشيخ»، «المشرف») كأنها أسماء حقيقية في البداية والرئيسية.
- I6: سطر المصدر تحت الآية بخط عادي واتجاه من اليمين.
- A6: جلسة القياس المقطوعة تُستأنف من السؤال نفسه بعد إعادة التحميل.
- A4: سجل إجابات لكل سؤال (الدروس وجولات القياس) يُرسل مع ملف الطالب لتحليل الأسئلة بعد التجربة.
- إصلاح وجده التنفيذ: normalizeState كان يُسقط STATE.teacherRatings عند كل تحميل، فلا يصل تقييم المعلم إلى الشهادة.
- APP_VERSION يحمل رقم الإصدار الكامل.
قابل لإعادة التشغيل. شغّله من جذر المستودع بعد سكربتات 9.39.11 ثم tools/rebuild_html.py"""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
VERSION = '9.39.12'
R = []
def rep(old, new): R.append((old, new))

# ---------------- الإصدار ----------------
rep("var APP_VERSION = '9.39';", "var APP_VERSION = '" + VERSION + "';")

# ---------------- I1: إبراز الكلمة المسؤول عنها ----------------
rep(""".verse-text{font-family:'Traditional Arabic','Amiri',Tahoma,serif;font-size:1.7rem;line-height:2;color:#1a237e;font-weight:700;display:block}""",
""".verse-text{font-family:'Traditional Arabic','Amiri',Tahoma,serif;font-size:1.7rem;line-height:2;color:#1a237e;font-weight:700;display:block}
.verse-text b,.verse-text strong{color:#b71c1c;background:#ffe082;border-radius:8px;padding:0 .2em;-webkit-box-decoration-break:clone;box-decoration-break:clone}""")
rep(""".verse-source{display:block;margin-top:6px;font-size:.72rem;color:var(--muted);font-family:monospace;direction:ltr}""",
    """.verse-source{display:block;margin-top:6px;font-size:.75rem;color:var(--muted);font-family:inherit;direction:rtl}""")
rep("""      var qt = document.createElement('div'); qt.style.fontWeight = '700'; qt.textContent = plainText(GT(q.type === 'extraction' ? (q.text + ' — ' + (q.question || '')) : q.text)); it.appendChild(qt);""",
r"""      var qt = document.createElement('div'); qt.style.fontWeight = '700'; qt.textContent = plainText(GT(q.type === 'extraction' ? (q.text + ' — ' + (q.question || '')) : q.text)); it.appendChild(qt);
      var tw = targetWords(q); if (tw){ var tq = document.createElement('div'); tq.style.color = '#b71c1c'; tq.textContent = 'المقصود: «' + tw + '»'; it.appendChild(tq); } // 9.39.12 (I1)""")
rep("""function plainText(h){ var d = document.createElement('div');""",
r"""function targetWords(q){ var m = String((q && q.type === 'extraction' && q.text) || '').match(/<b>([\s\S]*?)<\/b>/g); return m ? m.map(function(x){ return plainText(x); }).join('، ') : ''; }
function plainText(h){ var d = document.createElement('div');""")

# ---------------- O3: لا إهداء من ملف الطالب ----------------
rep("""    <button class="btn gold block" data-style="margin-top:10px" data-call="[&quot;showExportDialog&quot;, &quot;gift&quot;]" type="button" id="btn-export-home">🎓 تصدير إعداد المشرف المعتمد</button>
""", "")
rep("""function showExportDialog(exportKind){
  exportKind = exportKind || 'submission';
""", """function showExportDialog(exportKind){
  exportKind = exportKind || 'submission';
  if (exportKind === 'gift'){ showModal('🎁 الإهداء', 'الإهداء يصدره المعلم بعد مراجعة التسجيلات والتحقق من إذن ولي الأمر بالمشاركة. أرسل تسجيلاتك للمعلم.', [{label: 'حسنًا', class: 'primary', action: closeModal}]); return; } // 9.39.12 (O3)
""")
rep("""async function doExportStudent(exportKind){
  exportKind = exportKind || 'submission';
""", """async function doExportStudent(exportKind){
  exportKind = exportKind || 'submission';
  /* 9.39.12 (O3): كان هذا المسار يصدّر تسجيلات الطفل واسمه وصورته في «إهداء» غير موقّع دون فحص إذن المشاركة */
  if (exportKind === 'gift'){ showExportDialog('gift'); return; }
""")

# ---------------- I4: الأسماء العامة ----------------
rep("""function buildSplash(){""", """function isGenericName(n){ n = String(n || '').trim(); return !n || ['الشيخ', 'المشرف', 'المشرفة', 'المعلم', 'المعلمة', '—'].indexOf(n) >= 0; } // 9.39.12 (I4)
function buildSplash(){""")
rep("""  } else {
    $('splash-badge').textContent = '🎓 إعداد تعليمي';
    $('splash-role').textContent = 'المشرف';
    $('splash-name').textContent = PACK_DATA.supervisorName || PACK_DATA.sheikhName || '—';
  }""", """  } else {
    var spN = PACK_DATA.supervisorName || PACK_DATA.sheikhName || '';
    $('splash-badge').textContent = '🎓 إعداد تعليمي';
    if (isGenericName(spN)){ $('splash-from').textContent = 'مرحبًا بك في'; $('splash-role').textContent = 'رفاق التحفة'; $('splash-name').textContent = 'منهج تحفة الأطفال'; }
    else { $('splash-role').textContent = 'المشرف'; $('splash-name').textContent = spN; }
  }""")
rep("""  var sub = 'في رحاب القرآن · رفاق التحفة' + (PACK_DATA.sheikhName ? ' · المادة التعليمية: ' + PACK_DATA.sheikhName : '');""",
    """  var sub = 'في رحاب القرآن · رفاق التحفة' + (!isGenericName(PACK_DATA.sheikhName) ? ' · المادة التعليمية: ' + PACK_DATA.sheikhName : '');""")

# ---------------- حالة الطالب: تقييم المعلم وسجل الإجابات يبقيان بعد إعادة التحميل ----------------
rep("""  if (raw.giftExcluded && typeof raw.giftExcluded === 'object') base.giftExcluded = raw.giftExcluded;
  return base;""", """  if (raw.giftExcluded && typeof raw.giftExcluded === 'object') base.giftExcluded = raw.giftExcluded;
  /* 9.39.12: كان تقييم المعلم (9.39.11) يُسقَط عند كل تحميل فلا يصل إلى الشهادة؛ وسجل الإجابات جديد */
  if (raw.teacherRatings && typeof raw.teacherRatings === 'object' && !Array.isArray(raw.teacherRatings)){
    base.teacherRatings = {}; Object.keys(raw.teacherRatings).slice(0, 200).forEach(function(k){ var v = raw.teacherRatings[k]; if (typeof v === 'string') base.teacherRatings[String(k).slice(0, 64)] = v.slice(0, 20); });
  }
  if (Array.isArray(raw.respLog)) base.respLog = raw.respLog.slice(-1500);
  return base;""")

# ---------------- A4 + A6: سجل الإجابات واستئناف الجلسة ----------------
rep("""  if (!inExamMode()) return _finishAnswerExamBase.apply(this, arguments);""",
    """  if (!inExamMode()){ try { if (CURRENT.section && !CURRENT.section._synthetic) logResponse(q, correct); } catch(e){} return _finishAnswerExamBase.apply(this, arguments); }""")
rep("""  fb.appendChild(btn);
  try { fb.scrollIntoView({block: 'nearest'}); } catch(e){}
};
function targetWords(q){""", """  fb.appendChild(btn);
  try { fb.scrollIntoView({block: 'nearest'}); } catch(e){}
  try { logResponse(q, correct); examSnapshot(); } catch(e){} // 9.39.12 (A4، A6)
};
/* ===== 9.39.12 (A4): سجل إجابات لكل سؤال — يُرسل مع ملف الطالب لحساب صعوبة كل سؤال وتمييزه بعد التجربة =====
   k: L درس، F1/F2 جلستا الاختبار النهائي، R إعادة، V مراجعة · s: المفهوم · q: السؤال · c: صحيح؟ · a: رقم محاولة الدرس */
function logResponse(q, correct){
  var sec = CURRENT.section || {}; if (!q || !q.id) return;
  var k = sec.id === 'final_exam' ? ('F' + (sec._session || '')) : sec.id === 'retest_session' ? 'R' : sec.id === 'review_session' ? 'V' : 'L';
  var s = sec._exam ? ((sec._map || {})[q.id] || '') : sec.id;
  var a = k === 'L' ? (((STATE.progress || {})[sec.id] || {}).attempts || 0) + 1 : 0;
  var L = STATE.respLog = Array.isArray(STATE.respLog) ? STATE.respLog : [];
  L.push({t: new Date().toISOString().slice(0, 16), k: k, s: String(s).slice(0, 64), q: String(q.id).slice(0, 64), c: correct ? 1 : 0, a: a});
  if (L.length > 1500) L.splice(0, L.length - 1500);
}
/* ===== 9.39.12 (A6): جلسة القياس المقطوعة تُستأنف من السؤال التالي، فلا تُعاد أسئلة أُجيب عنها ===== */
function examSnapshot(){
  var sec = CURRENT.section; if (!sec || !sec._exam) return;
  STATE.assess = STATE.assess || assessEmptyState();
  STATE.assess.inProgress = {kind: sec.id, session: sec._session || 0, title: String(sec.title || ''), qids: sec.questions.map(function(x){ return x.id; }), map: sec._map || {}, setFor: sec._setFor || null,
    idx: CURRENT.qIdx + 1, results: (CURRENT.examResults || []).slice(), wrong: (CURRENT.examWrong || []).map(function(x){ return x.id; }),
    score: CURRENT.score, correct: CURRENT.correct, wrongN: CURRENT.wrong, at: new Date().toISOString()};
  save();
}
function resumeExam(kind, session){
  var ip = STATE.assess && STATE.assess.inProgress;
  if (!ip || ip.kind !== kind || (ip.session || 0) !== (session || 0) || !Array.isArray(ip.qids)) return false;
  var built = assessQuestionsFrom(ip.qids.map(function(id){ return {q: id, sec: (ip.map || {})[id]}; }));
  if (built.questions.length !== ip.qids.length || !(ip.idx < ip.qids.length)){ STATE.assess.inProgress = null; save(); return false; }
  assessPushSection({id: kind, title: ip.title, emoji: kind === 'final_exam' ? '🎓' : kind === 'retest_session' ? '🔁' : '🔄', items: [], questions: built.questions, _map: built.map, _session: ip.session || undefined, _exam: true, _setFor: ip.setFor});
  openSection(kind); startQuiz();
  CURRENT.examResults = (ip.results || []).slice();
  CURRENT.examWrong = (ip.wrong || []).map(function(id){ return built.questions.find(function(x){ return x.id === id; }); }).filter(Boolean);
  CURRENT.score = Number(ip.score) || 0; CURRENT.correct = Number(ip.correct) || 0; CURRENT.wrong = Number(ip.wrongN) || 0; CURRENT.qIdx = ip.idx;
  renderQuestion();
  toast('↩️ تُستأنف الجلسة من السؤال ' + (ip.idx + 1) + ' من ' + ip.qids.length);
  return true;
}
function targetWords(q){""")
rep("""  var no = (sessionNo === 2) ? 1 : 0;
  var picks = plan.sessions[no];""", """  var no = (sessionNo === 2) ? 1 : 0;
  if (!(STATE.assess.examDone && STATE.assess.examDone[no + 1]) && resumeExam('final_exam', no + 1)) return; // 9.39.12 (A6)
  var picks = plan.sessions[no];""")
rep("""  var st = STATE.assess || {}; var ids = st.pendingRetest || [];
  if (!ids.length){ alert('لا توجد مفاهيم تحتاج إعادة.'); return; }""", """  var st = STATE.assess || {}; var ids = st.pendingRetest || [];
  if (resumeExam('retest_session', 0)) return; // 9.39.12 (A6)
  if (!ids.length){ alert('لا توجد مفاهيم تحتاج إعادة.'); return; }""")
rep("""function startReviewSession(){
  var st = STATE.assess || {}; var due = assessDueReviews(st, new Date().toISOString());""", """function startReviewSession(){
  if (resumeExam('review_session', 0)) return; // 9.39.12 (A6)
  var st = STATE.assess || {}; var due = assessDueReviews(st, new Date().toISOString());""")
rep("""  var r = _finishQuizExamBase.apply(this, arguments);
  renderExamReport();""", """  var r = _finishQuizExamBase.apply(this, arguments);
  if (sec._exam && STATE.assess && STATE.assess.inProgress){ STATE.assess.inProgress = null; save(); } // 9.39.12 (A6): اكتملت الجلسة
  renderExamReport();""")
rep("""  var lk = document.getElementById('final-exam-locked');""", """  var ipn = STATE.assess && STATE.assess.inProgress; // 9.39.12 (A6)
  if (ipn && ipn.kind === 'final_exam' && b1 && b2){ (ipn.session === 2 ? b2 : b1).textContent = '↩️ أكمل الجلسة ' + (ipn.session === 2 ? 'الثانية' : 'الأولى') + ' (من السؤال ' + (ipn.idx + 1) + ')'; }
  var lk = document.getElementById('final-exam-locked');""")

# التصدير والتعقيم
rep("""function assessForExport(){
  var st = STATE.assess; if (!st || !st.concepts) return null;""", """function assessForExport(){
  var st = STATE.assess, log = (Array.isArray(STATE.respLog) ? STATE.respLog : []).slice(-1500);
  if ((!st || !st.concepts) && !log.length) return null;
  st = (st && st.concepts) ? st : assessEmptyState();""")
rep("""    rounds: rounds};
}""", """    rounds: rounds, log: log};
}""")
rep("""        lastExam: le0 ? {at: String(le0.at || '').slice(0, 40), total: Math.max(0, Math.min(999, Number(le0.total) || 0)), correct: Math.max(0, Math.min(999, Number(le0.correct) || 0)), wrong: clean(le0.wrong)} : null, rounds: rd};""",
    """        lastExam: le0 ? {at: String(le0.at || '').slice(0, 40), total: Math.max(0, Math.min(999, Number(le0.total) || 0)), correct: Math.max(0, Math.min(999, Number(le0.correct) || 0)), wrong: clean(le0.wrong)} : null, rounds: rd,
        log: (Array.isArray(sa.log) ? sa.log : []).slice(-1500).map(function(e){ e = (e && typeof e === 'object') ? e : {}; return {t: String(e.t || '').slice(0, 20), k: String(e.k || '').slice(0, 3), s: safeIdString(e.s), q: safeIdString(e.q), c: e.c ? 1 : 0, a: Math.max(0, Math.min(999, Number(e.a) || 0))}; })}; // 9.39.12 (A4)""")

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new and new in s: continue
        n = s.count(old)
        if not new and n == 0: continue
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:110]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
