/* ===== 9.23: الاختبار النهائي النظري (70 سؤالًا تغطي كل المفاهيم) ===== */
function assessSections(){ return CURRICULUM.filter(function(s){ return !s._synthetic; }); }
function assessPushSection(fin){ fin._synthetic = true; var i = CURRICULUM.findIndex(function(x){ return x.id === fin.id; }); if (i >= 0) CURRICULUM[i] = fin; else CURRICULUM.push(fin); }
function assessQuestionsFrom(picks){ var secs = assessSections(), byId = {}; secs.forEach(function(s){ (s.questions || []).concat(s.examQuestions || []).forEach(function(q){ byId[q.id] = {q: q, sec: s.id}; }); }); var map = {}; var qs = picks.filter(function(p){ return byId[p.q]; }).map(function(p){ map[p.q] = p.sec; return Object.assign({}, byId[p.q].q); }); return {questions: qs, map: map}; }

/* ===== 9.29: الاختبار النهائي على جلستين (كل مفهوم داخل جلسة واحدة كاملًا) ===== */
function assessPlanExam(){
  var secs = assessSections(), st0 = STATE.assess || assessEmptyState(), setFor = {};
  secs.forEach(function(s){ setFor[s.id] = assessNextSet(st0, s.id); });
  var pick = assessBuildFinal(secs, null, setFor);
  var bySec = {}; pick.forEach(function(p){ (bySec[p.sec] = bySec[p.sec] || []).push(p.q); });
  var groups = Object.keys(bySec).map(function(k){ return {sec: k, q: bySec[k]}; });
  groups.sort(function(a,b){ return b.q.length - a.q.length; });
  var half = Math.ceil(pick.length / 2), s1 = [], s2 = [], n1 = 0;
  groups.forEach(function(g){ if (n1 < half) { s1.push(g); n1 += g.q.length; } else s2.push(g); });
  var flat = function(arr){ var out = []; arr.forEach(function(g){ g.q.forEach(function(qid){ out.push({sec: g.sec, q: qid}); }); }); return out; };
  return {sessions: [flat(s1), flat(s2)], setFor: setFor};
}
/* 9.39.11 (ق2-ب): الاختبار النهائي بعد إكمال الدروس كلها */
function lessonsDoneCount(){ return realSections().filter(function(s){ var pr = STATE.progress && STATE.progress[s.id]; return pr && pr.stars > 0; }).length; }
function allLessonsDone(){ return lessonsDoneCount() === realSections().length; }
function startFinalExam(sessionNo){
  STATE.assess = STATE.assess || assessEmptyState();
  if (!allLessonsDone()){ toast(GT('يُفتح الاختبار النهائي بعد إكمال الدروس كلها (' + lessonsDoneCount() + '/' + realSections().length + ').')); return; }
  if (STATE.assess.finalDone){ toast(GT('{أديت|أديتِ} الاختبار النهائي. {تابع|تابعي} بإعادة ما لم يُتقن بعد.')); return; }
  var plan = STATE.assess.examPlan;
  if (!plan || !plan.setFor){ plan = assessPlanExam(); STATE.assess.examPlan = plan; save(); }
  var no = (sessionNo === 2) ? 1 : 0;
  if (!(STATE.assess.examDone && STATE.assess.examDone[no + 1]) && resumeExam('final_exam', no + 1)) return; // 9.39.12 (A6)
  var picks = plan.sessions[no];
  if (!picks || !picks.length){ alert('لا توجد أسئلة لهذه الجلسة.'); return; }
  if (STATE.assess.examDone && STATE.assess.examDone[no + 1]){ alert(GT('هذه الجلسة اكتملت. {ابدأ|ابدئي} الجلسة الأخرى.')); return; }
  var built = assessQuestionsFrom(picks);
  assessPushSection({id: 'final_exam', title: '🎓 الاختبار النهائي — الجلسة ' + (no + 1), emoji: '🎓', items: [], questions: built.questions, _map: built.map, _session: no + 1, _exam: true, _setFor: plan.setFor});
  CURRENT.examResults = [];
  openSection('final_exam'); startQuiz();
}

function startFinalExamOld(){
  STATE.assess = STATE.assess || assessEmptyState();
  var pick = assessBuildFinal(assessSections());
  var built = assessQuestionsFrom(pick);
  assessPushSection({id: 'final_exam', title: '🎓 الاختبار النهائي', emoji: '🎓', items: [], questions: built.questions, _map: built.map});
  CURRENT.examResults = [];
  openSection('final_exam'); startQuiz();
}
/* إعادة المفاهيم المخفقة فقط */
function startRetest(){
  var st = STATE.assess || {}; var ids = st.pendingRetest || [];
  if (resumeExam('retest_session', 0)) return; // 9.39.12 (A6)
  if (!ids.length){ alert('لا توجد مفاهيم تحتاج إعادة.'); return; }
  /* 9.39.13 (D4-ج): لا جولة للمفهوم نفسه قبل مرور 24 ساعة على جولته السابقة */
  var nowR = new Date().toISOString(), readyIds = ids.filter(function(id){ return assessIsReady(STATE.assess, id, nowR); });
  if (!readyIds.length){ alert(GT('⏳ الإعادة التالية متاحة ' + assessWaitText(ids) + '. المراجعة بعد يوم تثبّت الحفظ أكثر من الإعادة الفورية.')); return; }
  ids = readyIds;
  var secs = assessSections().filter(function(s){ return ids.indexOf(s.id) >= 0; });
  /* 9.39.11 (ق2-ب): المجموعة الأخرى لكل مفهوم، والجلسة لا تتجاوز نحو 20 سؤالًا (مفاهيم كاملة)؛ الباقي في الإعادة التالية */
  var cap = 20, acc = 0; secs = secs.filter(function(s){ var n = assessRequired(s.id); if (acc > 0 && acc + n > cap) return false; acc += n; return true; });
  var setFor = {}; secs.forEach(function(s){ setFor[s.id] = assessNextSet(STATE.assess, s.id); });
  var built = assessQuestionsFrom(assessBuildFinal(secs, null, setFor));
  if (!built.questions.length){ toast('لا توجد أسئلة لهذه الإعادة.'); return; }
  assessPushSection({id: 'retest_session', title: '🔁 إعادة المفاهيم', emoji: '🔁', items: [], questions: built.questions, _map: built.map, _exam: true, _setFor: setFor});
  CURRENT.examResults = [];
  openSection('retest_session'); startQuiz();
}
/* جلسة المراجعة المتباعدة: مجموعة بديلة لكل مفهوم مستحق */
function startReviewSession(){
  if (resumeExam('review_session', 0)) return; // 9.39.12 (A6)
  var st = STATE.assess || {}; var nowV = new Date().toISOString(); var due = assessDueReviews(st, nowV).filter(function(id){ return assessIsReady(st, id, nowV); }); // 9.39.13 (D4-ج)
  if (!due.length){ toast('👍 لا توجد مراجعات مستحقة الآن.'); return; }
  var secs = assessSections(), qs = [], map = {};
  due.forEach(function(id){
    var s = secs.find(function(x){ return x.id === id; }); if (!s) return;
    var nextSet = assessNextSet(st, id), pool = assessPool(s); // 9.39.11 (ق2-ب): من البنك المحجوز
    assessBuildFinal([s], null, (function(){ var o = {}; o[id] = nextSet; return o; })()).forEach(function(p){ var q = pool.find(function(x){ return x.id === p.q; }); if (q){ qs.push(Object.assign({}, q)); map[p.q] = id; } });
  });
  if (!qs.length){ toast('لا توجد أسئلة لهذه المراجعة.'); return; }
  assessPushSection({id: 'review_session', title: '🔄 المراجعة', emoji: '🔄', items: [], questions: qs, _map: map, _exam: true, _setFor: (function(){ var o = {}; due.forEach(function(id){ var c = st.concepts[id]; o[id] = (c && c.lastSet === 'A') ? 'B' : 'A'; }); return o; })()});
  CURRENT.examResults = [];
  openSection('review_session'); startQuiz();
}
function assessApplyExam(){
  var sec = CURRENT.section; var st = STATE.assess = STATE.assess || assessEmptyState();
  var results = CURRENT.examResults || []; var map = sec._map || {};
  var verdict = {};
  results.forEach(function(r){
    var sid = map[r.id]; if (!sid) return;
    verdict[sid] = verdict[sid] || {ok: true, n: 0, wrong: 0, sets: {}};
    verdict[sid].n++; if (!r.ok) verdict[sid].wrong++;
  });
  Object.keys(verdict).forEach(function(sid){ verdict[sid].ok = assessRoundPassed(verdict[sid].n, verdict[sid].wrong); }); // 9.39.13 (D3)
  var now = new Date().toISOString();
  var split = assessSplit(assessSections());
  Object.keys(verdict).forEach(function(sid){
    var items = results.filter(function(r){ return map[r.id] === sid; });
    var allA = items.every(function(r){ return split[sid].A.indexOf(r.id) >= 0; });
    var allB = items.every(function(r){ return split[sid].B.indexOf(r.id) >= 0; });
    // 9.39.11 (ق2-ب): المجموعة معروفة من خطة الجولة؛ الاستنتاج للجولات القديمة فقط
    var setName = (sec._setFor && (sec._setFor[sid] === 'A' || sec._setFor[sid] === 'B')) ? sec._setFor[sid] : (allA ? 'A' : (allB ? 'B' : ('X' + now)));
    assessRecordRound(st, sid, setName, verdict[sid].ok, now, items.map(function(r){ return r.id; }));
  });
  var summary = assessSummary(st, assessSections());
  STATE.assess.lastExam = {at: now, total: results.length, correct: results.filter(function(r){ return r.ok; }).length, summary: summary,
    wrong: results.filter(function(r){ return !r.ok; }).map(function(r){ return String(r.id); }).slice(0, 80)}; /* 9.39.10: للتشخيص لدى المعلم */
  /* 9.39.11 (ق2-ب): الإعادة لكل مفهوم لم يُتقن بعد — أخفق، أو اجتاز مرة واحدة ويحتاج جولة ثانية بالمجموعة الأخرى */
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
  }
  if (sec.id === 'retest_session') STATE.assess.pendingRetest = STATE.assess.pendingRetest.filter(function(x){ return x; });
  save();
}
function assessApplyReview(){
  var sec = CURRENT.section; var st = STATE.assess = STATE.assess || assessEmptyState();
  var results = CURRENT.examResults || []; var map = sec._map || {}; var setFor = sec._setFor || {};
  var verdict = {};
  var cnt = {}; // 9.39.13 (D3)
  results.forEach(function(r){ var sid = map[r.id]; if (!sid) return; cnt[sid] = cnt[sid] || {n: 0, wrong: 0}; cnt[sid].n++; if (!r.ok) cnt[sid].wrong++; verdict[sid] = true; });
  var now = new Date().toISOString();
  Object.keys(verdict).forEach(function(sid){
    var passed = assessRoundPassed(cnt[sid].n, cnt[sid].wrong);
    assessRecordRound(st, sid, setFor[sid] || 'A', passed, now, results.filter(function(r){ return map[r.id] === sid; }).map(function(r){ return r.id; }));
    if (passed) assessCompleteReview(st, sid, now);
  });
  save();
}
function assessForExport(){
  var st = STATE.assess, log = (Array.isArray(STATE.respLog) ? STATE.respLog : []).slice(-1500);
  if ((!st || !st.concepts) && !log.length && !STATE.restored) return null;
  st = (st && st.concepts) ? st : assessEmptyState();
  var summ = assessSummary(st, assessSections());
  /* 9.39.10: بيانات تشخيصية للمعلم: آخر اختبار وما أُخطئ فيه، ومحاولات كل مفهوم */
  var le = st.lastExam || null, rounds = {};
  Object.keys(st.concepts || {}).slice(0, 40).forEach(function(k){ var c = st.concepts[k] || {}; rounds[k] = {r: Number(c.rounds) || 0, f: Number(c.failStreak) || 0}; });
  return {v: 2, mastered: summ.mastered.slice(0, 40), pending: summ.pending.slice(0, 40), escalated: summ.escalated.slice(0, 40), at: new Date().toISOString(),
    lastExam: le ? {at: String(le.at || '').slice(0, 40), total: Number(le.total) || 0, correct: Number(le.correct) || 0, wrong: (Array.isArray(le.wrong) ? le.wrong : []).map(String).slice(0, 80)} : null,
    rounds: rounds, log: log, restored: STATE.restored ? cleanRestored(STATE.restored) : null}; // 9.39.13 (D12)
}
function showDueReviewBanner(){
  if (!STATE.assess || !STATE.assess.concepts) return;
  var due = assessDueReviews(STATE.assess, new Date().toISOString());
  if (!due.length) return;
  var names = due.map(function(id){ var s = CURRICULUM.find(function(x){ return x.id === id; }); return s ? s.title : id; }).join('، ');
  var b = document.createElement('div');
  b.id = 'review-banner';
  b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9000;background:#fff3c4;color:#5d4500;padding:10px 14px;font-size:.9rem;box-shadow:0 2px 6px rgba(0,0,0,.2)';
  b.textContent = '🔔 مراجعة مستحقة: ' + names;
  document.body.appendChild(b);
  setTimeout(function(){ if (b.parentNode) b.remove(); }, 15000);
}


