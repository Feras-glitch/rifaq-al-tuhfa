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
function targetWords(q){ var m = String((q && q.type === 'extraction' && q.text) || '').match(/<b>([\s\S]*?)<\/b>/g); return m ? m.map(function(x){ return plainText(x); }).join('، ') : ''; }
function plainText(h){ var d = document.createElement('div'); d.innerHTML = String(h === undefined || h === null ? '' : h); return d.textContent.replace(/\s+/g, ' ').trim(); }
function correctAnswerText(q){
  if (q.type === 'true_false') return q.answer ? 'صحيح' : 'خطأ';
  if (Array.isArray(q.options) && typeof q.answer === 'number' && q.options[q.answer] !== undefined) return plainText(q.options[q.answer]);
  return '';
}
function conceptTitle(id){ var s = realSections().find(function(x){ return x.id === id; }); return s ? plainText(s.title) : id; }
function renderExamReport(){
  var res = document.getElementById('view-results'); if (!res) return;
  var old = document.getElementById('exam-report'); if (old) old.remove();
  var sec = CURRENT.section || {}; if (!sec._exam) return;
  var box = document.createElement('div'); box.id = 'exam-report'; box.className = 'card'; box.style.cssText = 'margin-top:12px;text-align:right';
  var h = document.createElement('h3'); h.style.cssText = 'margin:0 0 6px;color:var(--primary);font-size:1rem'; h.textContent = '📋 ملخص الجلسة: ' + CURRENT.correct + ' من ' + sec.questions.length; box.appendChild(h);
  var v = (STATE.assess && STATE.assess.lastVerdict) || {}, ok = [], once = [], again = [];
  Object.keys(v).forEach(function(sid){ if (v[sid].mastered) ok.push(conceptTitle(sid)); else if (v[sid].ok) once.push(conceptTitle(sid)); else again.push(conceptTitle(sid)); });
  [[ok, GT('✅ {أتقنت|أتقنتِ}: ')], [once, GT('⏳ {اجتزت|اجتزتِ} مرة، ويلزم نجاح ثانٍ بأسئلة أخرى: ')], [again, '🔁 يحتاج إعادة: ']].forEach(function(x){
    if (!x[0].length) return; var p = document.createElement('div'); p.style.cssText = 'font-size:.9rem;margin:4px 0;line-height:1.8'; p.textContent = x[1] + x[0].join('، '); box.appendChild(p);
  });
  var wrong = CURRENT.examWrong || [];
  if (wrong.length){
    var d = document.createElement('details'); d.open = true; d.className = 'gift-details';
    var sm = document.createElement('summary'); sm.textContent = GT('الأسئلة التي {أخطأت|أخطأتِ} فيها (' + wrong.length + ')'); d.appendChild(sm);
    wrong.forEach(function(q){
      var it = document.createElement('div'); it.className = 'exam-wrong'; it.style.cssText = 'border-top:1px solid #eef0f6;padding:8px 0;font-size:.9rem;line-height:1.8';
      var qt = document.createElement('div'); qt.style.fontWeight = '700'; qt.textContent = plainText(GT(q.type === 'extraction' ? (q.text + ' — ' + (q.question || '')) : q.text)); it.appendChild(qt);
      var tw = targetWords(q); if (tw){ var tq = document.createElement('div'); tq.style.color = '#b71c1c'; tq.textContent = 'المقصود: «' + tw + '»'; it.appendChild(tq); } // 9.39.12 (I1)
      /* 9.39.13 (D4-ب): لا جواب صحيح ولا شرح السؤال (الشرح يكشفه غالبًا)، فالسؤال قد يعود في جولة قادمة.
         يُدلّ الطفل على الدرس والبيت ليراجع الحكم نفسه. */
      var rv = document.createElement('div'); rv.style.color = '#1a3a6b'; rv.textContent = examReviewPointer(q, (sec._map || {})[q.id]); it.appendChild(rv);
      d.appendChild(it);
    });
    box.appendChild(d);
  }
  var nav = document.getElementById('results-nav');
  if (nav && nav.parentNode === res) res.insertBefore(box, nav); else res.appendChild(box);
}
/* 9.39.13 (D4-ب): «للمراجعة: درس كذا — البيت كذا» من مرجع البيت في الشرح، دون الشرح نفسه */
function examReviewPointer(q, sid){
  var m = String((q && q.explanation) || '').match(/\((?:ال)?(بيتا?|الأبيات)\s*([^)]*)\)/);
  var bayt = m ? ('البيت ' + String(m[2]).trim()) : '';
  return GT('📖 للمراجعة: درس «' + (sid ? conceptTitle(sid) : '') + '»' + (bayt ? ' — ' + bayt : '') + '. {أعد|أعيدي} قراءة الحكم، ثم {جرّب|جرّبي} في الجولة القادمة.');
}
function assessWaitText(ids){
  var t = 0; (ids || []).forEach(function(id){ var r = assessReadyAt(STATE.assess, id); if (r && (!t || r < t)) t = r; });
  var h = Math.max(1, Math.ceil((t - Date.now()) / 3600000));
  return 'بعد ' + (h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : arCount(h, 'ساعة', 'ساعتان', 'ساعات'));
}
/* بطاقة النتيجة في الاختبار: لا نجوم (القياس بالمفاهيم لا بالنجوم) */
/* أزرار الاختبار في الملف الشخصي: بعد إكمال الدروس، ومرة واحدة */
function updateExamButtons(){
  var st = STATE.assess || {}, done = allLessonsDone(), fd = !!st.finalDone, ed = st.examDone || {};
  var b1 = document.getElementById('btn-final-exam'), b2 = document.getElementById('btn-final-exam-2');
  if (b1) b1.classList.toggle('hidden', !done || fd || !!ed[1]);
  if (b2) b2.classList.toggle('hidden', !done || fd || !!ed[2]);
  var ipn = STATE.assess && STATE.assess.inProgress; // 9.39.12 (A6)
  if (ipn && ipn.kind === 'final_exam' && b1 && b2){ (ipn.session === 2 ? b2 : b1).textContent = '↩️ أكمل الجلسة ' + (ipn.session === 2 ? 'الثانية' : 'الأولى') + ' (من السؤال ' + (ipn.idx + 1) + ')'; }
  var lk = document.getElementById('final-exam-locked');
  if (!lk && b1 && b1.parentNode){ lk = document.createElement('div'); lk.id = 'final-exam-locked'; lk.className = 'notice info'; lk.style.cssText = 'font-size:.85rem;margin-top:10px'; b1.parentNode.insertBefore(lk, b1); }
  if (lk){
    if (!done){ lk.classList.remove('hidden'); lk.textContent = '🎓 الاختبار النهائي يُفتح بعد إكمال الدروس كلها (' + lessonsDoneCount() + '/' + realSections().length + ').'; }
    else if (fd){ lk.classList.remove('hidden'); lk.textContent = '🎓 ' + GT('{أديت|أديتِ}') + ' الاختبار النهائي. ' + ((st.pendingRetest || []).length ? 'أعد المفاهيم التي لم تُتقن بعد.' : 'المراجعات تظهر في مواعيدها.'); }
    else lk.classList.add('hidden');
  }
}
/* تقييم المعلم للتلاوة يُحفظ عند الطالب من ملف إعادة موثّق، لتُبنى عليه الشهادة */
/* تأكيد الخروج من اختبار جارٍ */
function confirmLeaveQuiz(){
  var qv = document.getElementById('view-quiz');
  var inProgress = qv && qv.offsetParent !== null && CURRENT.qIdx > 0 && CURRENT.qIdx < (CURRENT.section.questions || []).length;
  return !inProgress || confirm('ستخرج من الاختبار الحالي، وقد تفقد ما أنجزته فيه. هل تريد الخروج؟');
}


/* 9.34: تقرير شهري قابل للطباعة للأسرة (بلا تسجيلات) */
function showPrintableReport(){
  var st = STATE.assess || {}; var rows = [];
  var secs = CURRICULUM.filter(function(s){ return !s._synthetic; });
  secs.forEach(function(s){
    var pr = (STATE.progress || {})[s.id] || {};
    var c = (st.concepts || {})[s.id] || {};
    rows.push('<tr><td>' + escapeHTML(s.title) + '</td><td>' + (c.mastered ? 'متقن' : 'قيد التدريب') + '</td><td>' + (pr.stars || 0) + ' نجوم</td><td>' + (pr.attempts || 0) + '</td></tr>');
  });
  var name = escapeHTML((STATE.student && STATE.student.name) || '');
  var ov = document.createElement('div'); ov.id = 'print-report-wrap';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:12px;box-sizing:border-box;overflow:auto';
  ov.innerHTML = '<div id="print-report" data-style="background:#fff;color:#222;border-radius:12px;max-width:640px;width:100%;padding:18px"><h2 data-style="margin:0 0 6px">تقرير تقدم: ' + name + '</h2><p data-style="margin:0 0 10px;font-size:.9rem">رفاق التحفة — المرحلة الأولى: أحكام تحفة الأطفال</p><table data-style="width:100%;border-collapse:collapse;font-size:.9rem"><tr><th data-style="text-align:right;border-bottom:1px solid #ccc">المفهوم</th><th data-style="border-bottom:1px solid #ccc">الإتقان</th><th data-style="border-bottom:1px solid #ccc">النجوم</th><th data-style="border-bottom:1px solid #ccc">المحاولات</th></tr>' + rows.join('') + '</table><p data-style="font-size:.8rem;color:#555">هذا التقرير لا يتضمن أي تسجيل صوتي.</p></div><div data-style="margin:10px 0;display:flex;gap:8px"><button type="button" id="pr-print" class="btn success">🖨️ طباعة</button><button type="button" id="pr-close" class="btn">إغلاق</button></div>';
  document.body.appendChild(ov);
  document.getElementById('pr-print').addEventListener('click', function(){ window.print(); });
  document.getElementById('pr-close').addEventListener('click', function(){ ov.remove(); });
}
/* نجوم الدرس من المحاولة الأولى؛ تنبيه بذلك عند الإعادة */
function firstAttemptNote(sec, prev){
  var note = document.getElementById('first-attempt-note'); if (note) note.remove();
  if (!(prev && prev.attempts > 0 && prev.stars > 0)) return;
  note = document.createElement('div'); note.id = 'first-attempt-note'; note.className = 'notice info'; note.style.cssText = 'font-size:.85rem;margin-top:10px';
  var pr = STATE.progress[sec.id] || {};
  note.textContent = 'نجوم الدرس محسوبة من المحاولة الأولى (' + '⭐'.repeat(pr.stars || 0) + '). أفضل نتيجة لك: ' + (pr.bestScore || 0) + ' نقطة.';
  var nav2 = document.getElementById('results-nav'); var res2 = document.getElementById('view-results');
  if (res2){ if (nav2 && nav2.parentNode === res2) res2.insertBefore(note, nav2); else res2.appendChild(note); }
}
/* 9.39.10: زرّا «إعادة المفاهيم المخفقة» و«جلسة المراجعة» يظهران فقط حين يوجد ما يُعاد أو يُراجَع */
function updateRetestButtons(){
  var st = STATE.assess || null;
  var rt = document.getElementById('btn-retest'); if (rt) rt.classList.toggle('hidden', !(st && Array.isArray(st.pendingRetest) && st.pendingRetest.length));
  if (rt && st && Array.isArray(st.pendingRetest) && st.pendingRetest.length){ // 9.39.13 (D4-ج)
    var nowB = new Date().toISOString(), anyReady = st.pendingRetest.some(function(id){ return assessIsReady(st, id, nowB); });
    rt.textContent = anyReady ? '🔁 إعادة المفاهيم التي لم تُتقن بعد' : ('🔁 الإعادة متاحة ' + assessWaitText(st.pendingRetest));
  }
  var rv = document.getElementById('btn-review-session'); if (rv) rv.classList.toggle('hidden', !(st && st.concepts && assessDueReviews(st, new Date().toISOString()).length));
}
