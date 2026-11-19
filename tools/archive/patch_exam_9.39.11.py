# -*- coding: utf-8 -*-
"""9.39.11 (ق2-ب): الاختبار النهائي أداة قياس.
- بنك محجوز examQuestions لكل مفهوم (مجموعتان A/B) لا يظهر في الدروس؛ الاختبار والإعادة والمراجعة تسحب منه وحده.
- لكل مفهوم في كل جولة مجموعة واحدة بعدد حدّه الأدنى (3 للمفاهيم الكبرى، 2 لغيرها = 40 سؤالًا) على جلستين، والمجموعة تتناوب.
- لا كشف للجواب أثناء الاختبار، ولا تسامح مع الخطأ في الألعاب؛ الأخطاء مع الجواب والشرح في ملخص بعد الجلسة.
- الإعادة تشمل كل مفهوم لم يُتقن بعد (أخفق، أو اجتاز مرة واحدة).
- نجوم الدرس من المحاولة الأولى، وأفضل نتيجة تُحفظ منفصلة.
- الاختبار النهائي يظهر بعد إكمال الدروس كلها، ويُؤدّى مرة واحدة؛ بعده الإعادة والمراجعة.
- شهادة «الإتقان التام» = كل المفاهيم متقنة + تقييم معلم موثّق للتلاوة بلا «يحتاج تدريبًا».
شغّله من جذر المستودع بعد patch_app_9.39.11.py ثم tools/rebuild_html.py — قابل لإعادة التشغيل."""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = []
def rep(old, new): R.append((old, new))

# ---------------- المحرك (يختبره tests/test_assess.js كما هو) ----------------
rep('''var ASSESS_CFG = {finalSize: 70, bigConcepts:''', '''/* 9.39.11 (ق2-ب): حجم الاختبار = مجموع الحد الأدنى لكل مفهوم (لا تعبئة من أسئلة الدروس) */
var ASSESS_CFG = {finalSize: null, bigConcepts:''')
rep('''/* مجموعتان متمايزتان: بالتناوب بعد ترتيب ثابت */
function assessSplit(sections){
  var out = {};
  sections.forEach(function(s){
    var qs = (s.questions || []).map(function(q){ return q.id; });
    out[s.id] = {A: qs.filter(function(_, i){ return i % 2 === 0; }), B: qs.filter(function(_, i){ return i % 2 === 1; })};
  });
  return out;
}''', '''/* 9.39.11 (ق2-ب): البنك المحجوز examQuestions إن وُجد، وإلا أسئلة الدروس (منهج قديم بلا بنك) */
function assessPool(s){ return (s && Array.isArray(s.examQuestions) && s.examQuestions.length) ? s.examQuestions : ((s && s.questions) || []); }
/* مجموعتان متمايزتان: حسب الحقل set في البنك، وإلا بالتناوب بعد ترتيب ثابت */
function assessSplit(sections){
  var out = {};
  sections.forEach(function(s){
    var pool = assessPool(s), qs = pool.map(function(q){ return q.id; });
    var labeled = pool.length > 0 && pool.every(function(q){ return q && (q.set === 'A' || q.set === 'B'); });
    out[s.id] = labeled
      ? {A: pool.filter(function(q){ return q.set === 'A'; }).map(function(q){ return q.id; }), B: pool.filter(function(q){ return q.set === 'B'; }).map(function(q){ return q.id; })}
      : {A: qs.filter(function(_, i){ return i % 2 === 0; }), B: qs.filter(function(_, i){ return i % 2 === 1; })};
  });
  return out;
}
function assessExamSize(sections){ return sections.reduce(function(a, s){ return a + assessRequired(s.id); }, 0); }
/* المجموعة التالية لمفهوم: الأخرى غير آخر مجموعة سُئل منها (A أول مرة) */
function assessNextSet(state, id){ var c = state && state.concepts && state.concepts[id]; return (c && c.lastSet === 'A') ? 'B' : 'A'; }''')
rep('''/* تكوين الاختبار النهائي: حد أدنى لكل مفهوم، ثم تعبئة متوازنة حتى finalSize، بلا تكرار */
function assessBuildFinal(sections, rng, size){
  rng = rng || Math.random; size = size || ASSESS_CFG.finalSize;
  var split = assessSplit(sections), pick = [], used = {};
  function shuffle(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var pools = {};
  sections.forEach(function(s){ pools[s.id] = shuffle(split[s.id].A.concat(split[s.id].B)); });
  sections.forEach(function(s){
    var need = assessRequired(s.id), take = pools[s.id].slice(0, need);
    take.forEach(function(qid){ used[qid] = true; pick.push({sec: s.id, q: qid}); });
    pools[s.id] = pools[s.id].slice(need);
  });
  var remaining = size - pick.length, round = 0;
  while (remaining > 0){
    var progressed = false;
    sections.forEach(function(s){
      if (remaining <= 0) return;
      var p = pools[s.id].filter(function(qid){ return !used[qid]; });
      if (p.length){ var qid = p[0]; used[qid] = true; pick.push({sec: s.id, q: qid}); pools[s.id] = pools[s.id].filter(function(x){ return x !== qid; }); remaining--; progressed = true; }
    });
    if (!progressed) break;
    round++;
  }
  return pick;
}''', '''/* 9.39.11 (ق2-ب): جولة قياس — لكل مفهوم مجموعة واحدة (setFor[id]، وإلا A) بعدد حدّه الأدنى بالضبط، بلا تكرار.
   فالجولتان المتتاليتان لمفهوم واحد لا تشتركان في أي سؤال، وهو شرط الإتقان. */
function assessBuildFinal(sections, rng, setFor){
  rng = rng || Math.random; setFor = (setFor && typeof setFor === 'object') ? setFor : {};
  var split = assessSplit(sections), pick = [];
  function shuffle(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  sections.forEach(function(s){
    var set = setFor[s.id] === 'B' ? 'B' : 'A';
    shuffle(split[s.id][set]).slice(0, assessRequired(s.id)).forEach(function(qid){ pick.push({sec: s.id, q: qid, set: set}); });
  });
  return pick;
}''')

# ---------------- التعقيم: البنك يُعقَّم كأسئلة الدروس ----------------
rep('''        sec.questions = sec.questions.map(function(q){
          if (!q || typeof q !== 'object') { SANITIZE_REPORT.dropped++; return null; }
          if (QX.has(q.type)){ var r = QX.normalize(q); if (r.errors.length){ SANITIZE_REPORT.dropped++; console.warn('QX question dropped', q.id, r.errors); return null; } return r.q; }
          if (['multiple_choice', 'true_false', 'extraction', undefined].indexOf(q.type) < 0){ SANITIZE_REPORT.dropped++; return null; }
          return q;
        }).filter(Boolean);''', '''        var cleanQList = function(list){
          return (Array.isArray(list) ? list : []).map(function(q){
            if (!q || typeof q !== 'object') { SANITIZE_REPORT.dropped++; return null; }
            if (QX.has(q.type)){ var r = QX.normalize(q); if (r.errors.length){ SANITIZE_REPORT.dropped++; console.warn('QX question dropped', q.id, r.errors); return null; } if (q.set === 'A' || q.set === 'B') r.q.set = q.set; return r.q; }
            if (['multiple_choice', 'true_false', 'extraction', undefined].indexOf(q.type) < 0){ SANITIZE_REPORT.dropped++; return null; }
            return q;
          }).filter(Boolean);
        };
        sec.questions = cleanQList(sec.questions);
        if (sec.examQuestions !== undefined) sec.examQuestions = cleanQList(sec.examQuestions); // 9.39.11 (ق2-ب): البنك المحجوز''')
rep('''        sec.questions.forEach(function(q){
          q.id = reg(q.id);
          ['text','question','hint','source','explanation'].forEach(function(f){ if (q[f] !== undefined && q[f] !== null) q[f] = safeHTML(q[f]); });''', '''        sec.questions.concat(sec.examQuestions || []).forEach(function(q){
          q.id = reg(q.id);
          if (q.set !== 'A' && q.set !== 'B') delete q.set;
          ['text','question','hint','source','explanation'].forEach(function(f){ if (q[f] !== undefined && q[f] !== null) q[f] = safeHTML(q[f]); });''')

# ---------------- بناء الجولات ----------------
rep('''function assessQuestionsFrom(picks){ var secs = assessSections(), byId = {}; secs.forEach(function(s){ s.questions.forEach(function(q){ byId[q.id] = {q: q, sec: s.id}; }); }); var map = {}; var qs = picks.map(function(p){ map[p.q] = p.sec; return Object.assign({}, byId[p.q].q); }); return {questions: qs, map: map}; }''',
'''function assessQuestionsFrom(picks){ var secs = assessSections(), byId = {}; secs.forEach(function(s){ (s.questions || []).concat(s.examQuestions || []).forEach(function(q){ byId[q.id] = {q: q, sec: s.id}; }); }); var map = {}; var qs = picks.filter(function(p){ return byId[p.q]; }).map(function(p){ map[p.q] = p.sec; return Object.assign({}, byId[p.q].q); }); return {questions: qs, map: map}; }''')
rep('''function assessPlanExam(){
  var secs = assessSections();
  var pick = assessBuildFinal(secs);''', '''function assessPlanExam(){
  var secs = assessSections(), st0 = STATE.assess || assessEmptyState(), setFor = {};
  secs.forEach(function(s){ setFor[s.id] = assessNextSet(st0, s.id); });
  var pick = assessBuildFinal(secs, null, setFor);''')
rep('''  return {sessions: [flat(s1), flat(s2)]};
}''', '''  return {sessions: [flat(s1), flat(s2)], setFor: setFor};
}
/* 9.39.11 (ق2-ب): الاختبار النهائي بعد إكمال الدروس كلها */
function lessonsDoneCount(){ return realSections().filter(function(s){ var pr = STATE.progress && STATE.progress[s.id]; return pr && pr.stars > 0; }).length; }
function allLessonsDone(){ return lessonsDoneCount() === realSections().length; }''')
rep('''function startFinalExam(sessionNo){
  STATE.assess = STATE.assess || assessEmptyState();
  var plan = STATE.assess.examPlan;
  if (!plan){ plan = assessPlanExam(); STATE.assess.examPlan = plan; save(); }''', '''function startFinalExam(sessionNo){
  STATE.assess = STATE.assess || assessEmptyState();
  if (!allLessonsDone()){ toast(GT('يُفتح الاختبار النهائي بعد إكمال الدروس كلها (' + lessonsDoneCount() + '/' + realSections().length + ').')); return; }
  if (STATE.assess.finalDone){ toast(GT('{أديت|أديتِ} الاختبار النهائي. {تابع|تابعي} بإعادة ما لم يُتقن بعد.')); return; }
  var plan = STATE.assess.examPlan;
  if (!plan || !plan.setFor){ plan = assessPlanExam(); STATE.assess.examPlan = plan; save(); }''')
rep('''  assessPushSection({id: 'final_exam', title: '🎓 الاختبار النهائي — الجلسة ' + (no + 1), emoji: '🎓', items: [], questions: built.questions, _map: built.map, _session: no + 1});''',
    '''  assessPushSection({id: 'final_exam', title: '🎓 الاختبار النهائي — الجلسة ' + (no + 1), emoji: '🎓', items: [], questions: built.questions, _map: built.map, _session: no + 1, _exam: true, _setFor: plan.setFor});''')
rep('''  var secs = assessSections().filter(function(s){ return ids.indexOf(s.id) >= 0; });
  var size = secs.reduce(function(a, s){ return a + assessRequired(s.id); }, 0);
  var built = assessQuestionsFrom(assessBuildFinal(secs, null, size));
  assessPushSection({id: 'retest_session', title: '🔁 إعادة المفاهيم', emoji: '🔁', items: [], questions: built.questions, _map: built.map});''',
'''  var secs = assessSections().filter(function(s){ return ids.indexOf(s.id) >= 0; });
  /* 9.39.11 (ق2-ب): المجموعة الأخرى لكل مفهوم، والجلسة لا تتجاوز نحو 20 سؤالًا (مفاهيم كاملة)؛ الباقي في الإعادة التالية */
  var cap = 20, acc = 0; secs = secs.filter(function(s){ var n = assessRequired(s.id); if (acc > 0 && acc + n > cap) return false; acc += n; return true; });
  var setFor = {}; secs.forEach(function(s){ setFor[s.id] = assessNextSet(STATE.assess, s.id); });
  var built = assessQuestionsFrom(assessBuildFinal(secs, null, setFor));
  if (!built.questions.length){ toast('لا توجد أسئلة لهذه الإعادة.'); return; }
  assessPushSection({id: 'retest_session', title: '🔁 إعادة المفاهيم', emoji: '🔁', items: [], questions: built.questions, _map: built.map, _exam: true, _setFor: setFor});''')
rep('''    var c = st.concepts[id]; var nextSet = (c && c.lastSet === 'A') ? 'B' : 'A';
    var split = (function(){ var qq = s.questions.map(function(q){ return q.id; }); return {A: qq.filter(function(_, i){ return i % 2 === 0; }), B: qq.filter(function(_, i){ return i % 2 === 1; })}; })();
    split[nextSet].forEach(function(qid){ var q = s.questions.find(function(x){ return x.id === qid; }); if (q){ qs.push(Object.assign({}, q)); map[qid] = id; } });''',
'''    var nextSet = assessNextSet(st, id), pool = assessPool(s); // 9.39.11 (ق2-ب): من البنك المحجوز
    assessBuildFinal([s], null, (function(){ var o = {}; o[id] = nextSet; return o; })()).forEach(function(p){ var q = pool.find(function(x){ return x.id === p.q; }); if (q){ qs.push(Object.assign({}, q)); map[p.q] = id; } });''')
rep('''  assessPushSection({id: 'review_session', title: '🔄 المراجعة', emoji: '🔄', items: [], questions: qs, _map: map, _setFor: (function(){''',
    '''  assessPushSection({id: 'review_session', title: '🔄 المراجعة', emoji: '🔄', items: [], questions: qs, _map: map, _exam: true, _setFor: (function(){''')

# ---------------- تطبيق النتائج: المجموعة معروفة من الخطة، والإعادة لكل ما لم يُتقن ----------------
rep('''    var allA = items.every(function(r){ return split[sid].A.indexOf(r.id) >= 0; });
    var allB = items.every(function(r){ return split[sid].B.indexOf(r.id) >= 0; });
    // جولة الاختبار المختلطة مجموعة مستقلة بذاتها: كل اختبار له معرّف خاص به
    var setName = allA ? 'A' : (allB ? 'B' : ('X' + now));''', '''    var allA = items.every(function(r){ return split[sid].A.indexOf(r.id) >= 0; });
    var allB = items.every(function(r){ return split[sid].B.indexOf(r.id) >= 0; });
    // 9.39.11 (ق2-ب): المجموعة معروفة من خطة الجولة؛ الاستنتاج للجولات القديمة فقط
    var setName = (sec._setFor && (sec._setFor[sid] === 'A' || sec._setFor[sid] === 'B')) ? sec._setFor[sid] : (allA ? 'A' : (allB ? 'B' : ('X' + now)));''')
rep('''  var split = (function(){ var out = {}; assessSections().forEach(function(s){ var qs = s.questions.map(function(q){ return q.id; }); out[s.id] = {A: qs.filter(function(_, i){ return i % 2 === 0; }), B: qs.filter(function(_, i){ return i % 2 === 1; })}; }); return out; })();''',
    '''  var split = assessSplit(assessSections());''')
rep('''  var pend = (STATE.assess.pendingRetest || []).slice();
  Object.keys(verdict).forEach(function(sid){
    if (verdict[sid].ok) pend = pend.filter(function(x){ return x !== sid; });
    else if (pend.indexOf(sid) < 0) pend.push(sid);
  });
  STATE.assess.pendingRetest = pend;
  if (sec._session){
    STATE.assess.examDone = STATE.assess.examDone || {};
    STATE.assess.examDone[sec._session] = true;
    if (STATE.assess.examDone[1] && STATE.assess.examDone[2]){ STATE.assess.examPlan = null; STATE.assess.examDone = null; }
  }''', '''  /* 9.39.11 (ق2-ب): الإعادة لكل مفهوم لم يُتقن بعد — أخفق، أو اجتاز مرة واحدة ويحتاج جولة ثانية بالمجموعة الأخرى */
  var pend = (STATE.assess.pendingRetest || []).slice();
  STATE.assess.lastVerdict = {};
  Object.keys(verdict).forEach(function(sid){
    var c = st.concepts[sid] || {};
    STATE.assess.lastVerdict[sid] = {ok: !!verdict[sid].ok, mastered: !!c.mastered};
    if (c.mastered) pend = pend.filter(function(x){ return x !== sid; });
    else if (pend.indexOf(sid) < 0) pend.push(sid);
  });
  STATE.assess.pendingRetest = pend;
  if (sec._session){
    STATE.assess.examDone = STATE.assess.examDone || {};
    STATE.assess.examDone[sec._session] = true;
    if (STATE.assess.examDone[1] && STATE.assess.examDone[2]){ STATE.assess.finalDone = true; STATE.assess.finalAt = now; STATE.assess.examPlan = null; }
  }''')

# ---------------- نجوم الدرس من المحاولة الأولى ----------------
rep('''  if (!sec._synthetic) STATE.progress[sec.id] = {
    bestScore: Math.max(prev.bestScore, CURRENT.score),
    stars: Math.max(prev.stars, stars),
    attempts: (prev.attempts || 0) + 1
  };''', '''  /* 9.39.11 (ق2-ب): نجوم الدرس من المحاولة الأولى (قياس)، وأفضل نتيجة ونجومها تُحفظ منفصلة (تدريب) */
  if (!sec._synthetic) STATE.progress[sec.id] = {
    bestScore: Math.max(prev.bestScore || 0, CURRENT.score),
    stars: (prev.attempts > 0 && prev.stars > 0) ? prev.stars : stars,
    bestStars: Math.max(prev.bestStars || prev.stars || 0, stars),
    attempts: (prev.attempts || 0) + 1
  };''')

# ---------------- واجهة الاختبار: لا كشف، ولا تسامح، وملخص بعد الجلسة ----------------
rep('''var _startQuizBase2 = startQuiz;
startQuiz = function(){ CURRENT.wrongIds = []; return _startQuizBase2.apply(this, arguments); };''', r'''var _startQuizBase2 = startQuiz;
startQuiz = function(){ CURRENT.wrongIds = []; CURRENT.examWrong = []; return _startQuizBase2.apply(this, arguments); };
/* ===== 9.39.11 (ق2-ب): وضع القياس في الاختبار النهائي والإعادة والمراجعة ===== */
function inExamMode(){ return !!(CURRENT.section && CURRENT.section._exam); }
var _answerBase = answer;
answer = function(choice){
  if (!inExamMode()) return _answerBase.apply(this, arguments);
  var q = CURRENT.section.questions[CURRENT.qIdx];
  document.querySelectorAll('#options .option-btn').forEach(function(b){ b.disabled = true; if (String(b.dataset.idx) === String(choice)) b.classList.add('chosen'); });
  finishAnswer(choice === q.answer, q);
};
var _finishCustomBase = finishCustom;
finishCustom = function(q, mistakes){
  if (!inExamMode()) return _finishCustomBase.apply(this, arguments);
  finishAnswer(mistakes === 0, q); // لا تسامح مع الخطأ في ألعاب الاختبار
};
var _finishAnswerExamBase = finishAnswer;
finishAnswer = function(correct, q){
  if (!inExamMode()) return _finishAnswerExamBase.apply(this, arguments);
  CURRENT.examResults = CURRENT.examResults || []; CURRENT.examResults.push({id: q.id, ok: !!correct});
  if (correct){ CURRENT.score += q.points; CURRENT.correct++; }
  else { CURRENT.wrong++; CURRENT.examWrong = CURRENT.examWrong || []; CURRENT.examWrong.push(q); }
  var fb = $('feedback-box');
  fb.innerHTML = '<div class="feedback neutral"><div class="title">' + GT('✔️ سُجّلت إجابتك') + '</div><div class="explain">' + GT('النتيجة والشرح في ملخص آخر الجلسة.') + '</div></div>';
  var last = CURRENT.qIdx + 1 >= CURRENT.section.questions.length;
  var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn primary block'; btn.style.marginTop = '14px';
  btn.textContent = last ? '📋 ملخص الجلسة' : '➡️ السؤال التالي';
  btn.onclick = function(){ CURRENT.qIdx++; if (CURRENT.qIdx < CURRENT.section.questions.length) renderQuestion(); else finishQuiz(); };
  fb.appendChild(btn);
  try { fb.scrollIntoView({block: 'nearest'}); } catch(e){}
};
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
      var ca = correctAnswerText(q); if (ca){ var a = document.createElement('div'); a.style.color = 'var(--success)'; a.textContent = 'الإجابة الصحيحة: ' + ca; it.appendChild(a); }
      if (q.explanation){ var ex = document.createElement('div'); ex.style.color = '#444'; ex.textContent = plainText(GT(q.explanation)); it.appendChild(ex); }
      d.appendChild(it);
    });
    box.appendChild(d);
  }
  var nav = document.getElementById('results-nav');
  if (nav && nav.parentNode === res) res.insertBefore(box, nav); else res.appendChild(box);
}
var _finishQuizExamBase = finishQuiz;
finishQuiz = function(){
  var sec = CURRENT.section || {}, prev = (!sec._synthetic && STATE.progress[sec.id]) ? Object.assign({}, STATE.progress[sec.id]) : null;
  var r = _finishQuizExamBase.apply(this, arguments);
  renderExamReport();
  var note = document.getElementById('first-attempt-note'); if (note) note.remove();
  if (prev && prev.attempts > 0 && prev.stars > 0){
    note = document.createElement('div'); note.id = 'first-attempt-note'; note.className = 'notice info'; note.style.cssText = 'font-size:.85rem;margin-top:10px';
    var pr = STATE.progress[sec.id] || {};
    note.textContent = 'نجوم الدرس محسوبة من المحاولة الأولى (' + '⭐'.repeat(pr.stars || 0) + '). أفضل نتيجة لك: ' + (pr.bestScore || 0) + ' نقطة.';
    var nav2 = document.getElementById('results-nav'); var res2 = document.getElementById('view-results');
    if (res2){ if (nav2 && nav2.parentNode === res2) res2.insertBefore(note, nav2); else res2.appendChild(note); }
  }
  return r;
};
/* بطاقة النتيجة في الاختبار: لا نجوم (القياس بالمفاهيم لا بالنجوم) */
var _showResultsBase = showResults;
showResults = function(stars, pct){
  var r = _showResultsBase.apply(this, arguments);
  if (inExamMode()){ $('result-stars').innerHTML = ''; $('result-title').textContent = '📋 انتهت الجلسة'; $('result-message').textContent = GT('{اقرأ|اقرئي} الملخص أدناه'); }
  return r;
};
/* أزرار الاختبار في الملف الشخصي: بعد إكمال الدروس، ومرة واحدة */
function updateExamButtons(){
  var st = STATE.assess || {}, done = allLessonsDone(), fd = !!st.finalDone, ed = st.examDone || {};
  var b1 = document.getElementById('btn-final-exam'), b2 = document.getElementById('btn-final-exam-2');
  if (b1) b1.classList.toggle('hidden', !done || fd || !!ed[1]);
  if (b2) b2.classList.toggle('hidden', !done || fd || !!ed[2]);
  var lk = document.getElementById('final-exam-locked');
  if (!lk && b1 && b1.parentNode){ lk = document.createElement('div'); lk.id = 'final-exam-locked'; lk.className = 'notice info'; lk.style.cssText = 'font-size:.85rem;margin-top:10px'; b1.parentNode.insertBefore(lk, b1); }
  if (lk){
    if (!done){ lk.classList.remove('hidden'); lk.textContent = '🎓 الاختبار النهائي يُفتح بعد إكمال الدروس كلها (' + lessonsDoneCount() + '/' + realSections().length + ').'; }
    else if (fd){ lk.classList.remove('hidden'); lk.textContent = '🎓 ' + GT('{أديت|أديتِ}') + ' الاختبار النهائي. ' + ((st.pendingRetest || []).length ? 'أعد المفاهيم التي لم تُتقن بعد.' : 'المراجعات تظهر في مواعيدها.'); }
    else lk.classList.add('hidden');
  }
}
var _showProfileExamBase = showProfile;
showProfile = function(){ var r = _showProfileExamBase.apply(this, arguments); try { updateExamButtons(); } catch(e){} return r; };
/* تقييم المعلم للتلاوة يُحفظ عند الطالب من ملف إعادة موثّق، لتُبنى عليه الشهادة */
var _renderTFViewBase = renderTFView;
renderTFView = function(){
  try {
    if (RETURN_TRUST === 'verified' && PACK_DATA.teacherRatings && Object.keys(PACK_DATA.teacherRatings).length){
      STATE.teacherRatings = Object.assign({}, STATE.teacherRatings || {}, PACK_DATA.teacherRatings); save();
    }
  } catch(e){}
  return _renderTFViewBase.apply(this, arguments);
};''')

rep('''  var fx = (STATE.assess && STATE.assess.examDone) || {};
  var note = document.createElement('div'); note.style.cssText = 'width:100%;text-align:center;font-size:.8rem;color:#555';
  note.textContent = 'الاختبار النهائي: ' + (fx[1] ? 'الجلسة الأولى ✅' : 'الجلسة الأولى ⚪') + ' · ' + (fx[2] ? 'الجلسة الثانية ✅' : 'الجلسة الثانية ⚪');''',
'''  var fx = (STATE.assess && STATE.assess.examDone) || {};
  var note = document.createElement('div'); note.style.cssText = 'width:100%;text-align:center;font-size:.8rem;color:#555';
  note.textContent = !allLessonsDone() ? ('الاختبار النهائي: يُفتح بعد إكمال الدروس (' + lessonsDoneCount() + '/' + realSections().length + ')')
    : ((STATE.assess && STATE.assess.finalDone) ? 'الاختبار النهائي: اكتمل ✅' : ('الاختبار النهائي: ' + (fx[1] ? 'الجلسة الأولى ✅' : 'الجلسة الأولى ⚪') + ' · ' + (fx[2] ? 'الجلسة الثانية ✅' : 'الجلسة الثانية ⚪')));''')

# ---------------- الشهادة: الإتقان من الاختبار وتقييم المعلم ----------------
rep('''  var _n = realSections().length;
  var isPerfect = stats.perfectSections === _n && stats.completedSections === _n;
  var isF = s.gender === 'girl';
  var desc = isPerfect
    ? (isF ? 'أتمّت جميع أقسام منهج تحفة الأطفال بإتقان كامل.' : 'أتمّ جميع أقسام منهج تحفة الأطفال بإتقان كامل.')
    : (isF ? 'أتمّت ' + stats.completedSections + ' من ' + _n + ' أقسام.' : 'أتمّ ' + stats.completedSections + ' من ' + _n + ' أقسام.');''',
'''  var _n = realSections().length;
  /* 9.39.11 (ق2-ب): «الإتقان» يعني إتقان كل المفاهيم في جولات القياس (لا نجوم الدروس)، مع تقييم معلم موثّق للتلاوة بلا «يحتاج تدريبًا» */
  var lv = certLevel(), isF = s.gender === 'girl';
  var isPerfect = lv.allMastered && lv.rated > 0 && lv.needs === 0;
  var W = function(m, f){ return isF ? f : m; };
  var desc = isPerfect ? W('أتمّ جميع أقسام منهج تحفة الأطفال، وأتقن أحكامها في الاختبار النهائي، واعتمد معلمه تلاوته.', 'أتمّت جميع أقسام منهج تحفة الأطفال، وأتقنت أحكامها في الاختبار النهائي، واعتمد معلمها تلاوتها.')
    : lv.allMastered ? (W('أتقن أحكام منهج تحفة الأطفال في الاختبار النهائي.', 'أتقنت أحكام منهج تحفة الأطفال في الاختبار النهائي.') + (lv.needs ? ' وتحتاج التلاوة تدريبًا في ' + arCount(lv.needs, 'موضع', 'موضعين', 'مواضع') + '.' : ' وتقييم المعلم للتلاوة لم يصل بعد.'))
    : (W('أتمّ ', 'أتمّت ') + stats.completedSections + ' من ' + _n + ' أقسام' + (lv.mastered ? '، ' + W('وأتقن ', 'وأتقنت ') + lv.mastered + ' من مفاهيمها.' : '.'));''')
rep('''    role: isPerfect ? (isF ? '🏆 بطلة المنهج بإتقان تام' : '🏆 بطل المنهج بإتقان تام') : (isF ? '🏆 متقدمة في المنهج' : '🏆 متقدم في المنهج'),''',
    '''    role: isPerfect ? (isF ? '🏆 بطلة المنهج بإتقان تام' : '🏆 بطل المنهج بإتقان تام') : lv.allMastered ? (isF ? '🏆 متقنة لأحكام المنهج' : '🏆 متقن لأحكام المنهج') : (isF ? '🏆 متقدمة في المنهج' : '🏆 متقدم في المنهج'),''')
rep('''    total: _n, perfect: stats.perfectSections,''', '''    total: _n, perfect: lv.mastered,''')
rep('''    '<div class="cert-stat"><div class="n">' + d.perfect + '</div><div class="l">إتقان تام</div></div>';''',
    '''    '<div class="cert-stat"><div class="n">' + d.perfect + '</div><div class="l">مفاهيم متقنة</div></div>';''')
rep('''function buildCertData(){''', '''function certLevel(){
  var secs = realSections(), cs = (STATE.assess && STATE.assess.concepts) || {};
  var mastered = secs.filter(function(s){ return cs[s.id] && cs[s.id].mastered; }).length;
  var r = STATE.teacherRatings || {}, keys = Object.keys(r);
  return {allMastered: secs.length > 0 && mastered === secs.length, mastered: mastered, rated: keys.length, needs: keys.filter(function(k){ return r[k] === 'needs'; }).length};
}
function buildCertData(){''')
rep('''  $('profile-stats').textContent = 'أقسام: ' + (STATE.stats.completedSections || 0) + '/' + realSections().length + ' · إتقان: ' + (STATE.stats.perfectSections || 0);''',
    '''  $('profile-stats').textContent = 'أقسام: ' + (STATE.stats.completedSections || 0) + '/' + realSections().length + ' · مفاهيم متقنة: ' + certLevel().mastered + '/' + realSections().length;''')

# CSS للخيار المسجَّل والتغذية المحايدة
rep('''.option-btn.wrong .opt-letter{background:var(--danger);color:#fff}''', '''.option-btn.wrong .opt-letter{background:var(--danger);color:#fff}
.option-btn.chosen{border-color:#5c6bc0;background:#e8eaf6}
.feedback.neutral{background:#eef2ff;border-color:#c5cae9}''')

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new and new in s: continue
        n = s.count(old)
        if not new and n == 0: continue
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:110]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
