/* ===== 9.33: مسار الرحلة، وأزرار ما بعد الاختبار، ومراجعة الأخطاء، وتأكيد الخروج ===== */
function trackStatus(sec){
  var pr = (STATE.progress || {})[sec.id];
  if (pr && pr.stars > 0) return 'done';
  if (pr && pr.attempts > 0) return 'current';
  return 'todo';
}
function renderTrack(){
  var home = document.getElementById('view-home'); if (!home) return;
  var old = document.getElementById('home-track'); if (old) old.remove();
  var secs = CURRICULUM.filter(function(s){ return !s._synthetic; });
  var box = document.createElement('div'); box.id = 'home-track';
  box.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:0 0 12px';
  var icon = {done: '✅', current: '🟡', todo: '⚪'};
  var nextIdx = secs.findIndex(function(s){ return trackStatus(s) !== 'done'; });
  secs.forEach(function(s, i){
    var st = trackStatus(s);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost';
    b.style.cssText = 'padding:4px 8px;font-size:.8rem;min-width:0' + (i === nextIdx ? ';border:2px solid #e0a800' : '');
    b.textContent = icon[st] + ' ' + (i + 1);
    b.title = s.title;
    b.addEventListener('click', function(){ openSection(s.id); });
    box.appendChild(b);
  });
  var fx = (STATE.assess && STATE.assess.examDone) || {};
  var note = document.createElement('div'); note.style.cssText = 'width:100%;text-align:center;font-size:.8rem;color:#555';
  note.textContent = !allLessonsDone() ? ('الاختبار النهائي: يُفتح بعد إكمال الدروس (' + lessonsDoneCount() + '/' + realSections().length + ')')
    : ((STATE.assess && STATE.assess.finalDone) ? 'الاختبار النهائي: اكتمل ✅' : ('الاختبار النهائي: ' + (fx[1] ? 'الجلسة الأولى ✅' : 'الجلسة الأولى ⚪') + ' · ' + (fx[2] ? 'الجلسة الثانية ✅' : 'الجلسة الثانية ⚪')));
  box.appendChild(note);
  home.insertBefore(box, home.firstChild);
}
var _renderHomeBase = renderHome;
renderHome = function(){ var r = _renderHomeBase.apply(this, arguments); renderTrack(); return r; };
var _goHomeBase = goHome;
goHome = function(){ var r = _goHomeBase.apply(this, arguments); renderTrack(); return r; };
var _finishAnswerBase = finishAnswer;
finishAnswer = function(correct, q){
  if (!correct && CURRENT.section && !CURRENT.section._synthetic){ CURRENT.wrongIds = CURRENT.wrongIds || []; if (CURRENT.wrongIds.indexOf(q.id) < 0) CURRENT.wrongIds.push(q.id); }
  return _finishAnswerBase.apply(this, arguments);
};
function nextSectionAfter(id){
  var list = CURRICULUM.filter(function(s){ return !s._synthetic; });
  var i = list.findIndex(function(s){ return s.id === id; });
  return (i >= 0 && i + 1 < list.length) ? list[i + 1] : null;
}
function reviewWrongAnswers(){
  var sec = CURRENT.section, ids = CURRENT.wrongIds || [];
  var qs = (sec.questions || []).filter(function(q){ return ids.indexOf(q.id) >= 0; }).map(function(q){ return Object.assign({}, q); });
  if (!qs.length){ alert('لا توجد أخطاء للمراجعة.'); return; }
  assessPushSection({id: 'review_wrong', title: '🔁 مراجعة ما أخطأت فيه', emoji: '🔁', items: [], questions: qs, _map: {}});
  CURRENT.wrongIds = [];
  openSection('review_wrong'); startQuiz();
}
function addResultsNav(){
  var res = document.getElementById('view-results'); if (!res) return;
  var old = document.getElementById('results-nav'); if (old) old.remove();
  var sec = CURRENT.section || {};
  var wrongCount = (CURRENT.wrongIds || []).length;
  var box = document.createElement('div'); box.id = 'results-nav';
  box.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:12px';
  function mk(label, fn){ var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.addEventListener('click', fn); return b; }
  if (!sec._synthetic && wrongCount > 0) box.appendChild(mk('🔁 مراجعة ما أخطأت فيه (' + wrongCount + ')', reviewWrongAnswers));
  var nx = !sec._synthetic ? nextSectionAfter(sec.id) : null;
  if (nx) box.appendChild(mk('الدرس التالي ›', function(){ openSection(nx.id); }));
  box.appendChild(mk('⌂ الخريطة', function(){ goHome(); }));
  if (!sec._synthetic) box.appendChild(mk('↺ إعادة هذا الاختبار', function(){ startQuiz(); }));
  res.appendChild(box);
}
var _finishQuizBase = finishQuiz;
finishQuiz = function(){
  var r = _finishQuizBase.apply(this, arguments);
  addResultsNav();
  return r;
};
var _startQuizBase2 = startQuiz;
startQuiz = function(){ CURRENT.wrongIds = []; CURRENT.examWrong = []; return _startQuizBase2.apply(this, arguments); };
