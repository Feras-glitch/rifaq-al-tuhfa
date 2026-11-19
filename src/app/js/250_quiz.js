/* ===== الاختبار: عرض السؤال والإجابة والنتيجة ===== */
function startQuiz(){
  var sec = CURRENT.section;
  if (sec && sec._full) sec = CURRENT.section = sec._full; // «إعادة الاختبار» تسحب من الدرس كاملًا
  if (sec && !sec._synthetic && (sec.questions || []).length > LESSON_QUIZ_MAX) CURRENT.section = lessonQuizAttempt(sec); // 9.39.13 (ق3-ب)
  CURRENT.wrongIds = []; CURRENT.examWrong = [];
  CURRENT.qIdx = 0; CURRENT.score = 0; CURRENT.correct = 0; CURRENT.wrong = 0;
  renderQuestion();
  show('view-quiz');
  ensureQuizNav(); // 9.32
}
function renderQuestion(){
  renderQuestionContent();
  try { addSheikhAudioToQuestion(); } catch(e){} // 9.36
}
function renderQuestionContent(){
  var sec = CURRENT.section;
  var q = sec.questions[CURRENT.qIdx];
  var total = sec.questions.length, cur = CURRENT.qIdx + 1;
  $('quiz-counter').textContent = cur + ' / ' + total;
  $('quiz-points').textContent = '+' + CURRENT.score;
  $('quiz-progress').style.width = ((cur - 1) / total * 100) + '%';
  $('feedback-box').innerHTML = '';
  var qHtml = '';
  if (QX.has(q.type)){
    $('question-text').innerHTML = '<span class="question-badge badge-mc">' + QX.types[q.type].label + '</span><div data-style="margin-top:8px">' + GT(q.text) + '</div>' + (q.hint ? '<div class="verse-hint">💡 ' + GT(q.hint) + '</div>' : '');
    renderQX(q); return;
  }
  if (q.type === 'extraction'){
    var t = detectTextType(q);
    var T = termsForType(t);
    var bCls = t === 'quran' ? 'badge-extract-quran' : 'badge-extract-poem';
    qHtml = '<span class="question-badge ' + bCls + '">' + T.badge + '</span>';
    qHtml += '<div class="verse-box' + (t === 'quran' ? ' quran' : '') + '">';
    qHtml += '<span class="verse-text"' + (t === 'poem' ? ' data-style="font-size:1.35rem"' : '') + '>' + (t === 'quran' ? quranHTML(q.text, q) : q.text) + '</span>';
    if (q.hint) qHtml += '<span class="verse-hint">💡 ' + GT(q.hint) + '</span>';
    if (q.source) qHtml += '<span class="verse-source">' + q.source + '</span>';
    qHtml += '</div><div class="extract-points">❓ ' + GT(q.question) + '</div>';
  } else if (q.type === 'true_false'){
    qHtml = '<span class="question-badge badge-tf">✅ صواب أو خطأ</span><div data-style="margin-top:8px">🤔 ' + GT(q.text) + '</div>';
  } else {
    qHtml = '<span class="question-badge badge-mc">🔤 اختيار متعدد</span><div data-style="margin-top:8px">' + GT(q.text) + '</div>';
  }
  $('question-text').innerHTML = qHtml;
  var opts = $('options');
  if (q.type === 'true_false'){
    opts.innerHTML = '<button class="option-btn" data-idx="true" data-call="[&quot;answer&quot;, true]"><span class="opt-letter">✓</span> صحيح</button>' +
                     '<button class="option-btn" data-idx="false" data-call="[&quot;answer&quot;, false]"><span class="opt-letter">✗</span> خطأ</button>';
  } else {
/* 9.39: الحروف حتى ستة خيارات (كان الخامس يظهر undefined)، والخيارات تُخلط عند كل عرض مع إبقاء المؤشر الأصلي للتصحيح */
    var L = ['أ','ب','ج','د','هـ','و'];
    var order = q.options.map(function(_, i){ return i; });
    for (var oi = order.length - 1; oi > 0; oi--){ var oj = Math.floor(Math.random() * (oi + 1)); var ot = order[oi]; order[oi] = order[oj]; order[oj] = ot; }
    opts.innerHTML = order.map(function(i, pos){ return '<button class="option-btn" data-idx="' + i + '" ' + ACT('answer', i) + '><span class="opt-letter">' + (L[pos] || (pos + 1)) + '</span> ' + q.options[i] + '</button>'; }).join('');
  }
}
function answer(choice){
  if (inExamMode()){ // 9.39.11 (ق2-ب): وضع القياس — لا يُكشف الصحيح أثناء الجلسة
    var qe = CURRENT.section.questions[CURRENT.qIdx];
    document.querySelectorAll('#options .option-btn').forEach(function(b){ b.disabled = true; if (String(b.dataset.idx) === String(choice)) b.classList.add('chosen'); });
    finishAnswer(choice === qe.answer, qe); return;
  }
  var q = CURRENT.section.questions[CURRENT.qIdx];
  var correct = (choice === q.answer);
  document.querySelectorAll('#options .option-btn').forEach(function(b){ b.disabled = true; });
  var chB = null, corB = null;
  document.querySelectorAll('#options .option-btn').forEach(function(b){
    var idx = b.dataset.idx;
    if (String(idx) === String(choice)) chB = b;
    if (String(idx) === String(q.answer)) corB = b;
  });
  if (correct){ if (chB) chB.classList.add('correct'); }
  else { if (chB) chB.classList.add('wrong'); if (corB) corB.classList.add('correct'); }
  finishAnswer(correct, q);
}
function finishAnswer(correct, q){
  if (inExamMode()){ finishAnswerExam(correct, q); return; } // 9.39.11 (ق2-ب)
  try { if (CURRENT.section && !CURRENT.section._synthetic) logResponse(q, correct); } catch(e){} // 9.39.12 (A4)
  if (!correct && CURRENT.section && !CURRENT.section._synthetic){ CURRENT.wrongIds = CURRENT.wrongIds || []; if (CURRENT.wrongIds.indexOf(q.id) < 0) CURRENT.wrongIds.push(q.id); } // 9.33: «راجع ما أخطأت فيه»
  if (CURRENT.section && CURRENT.section._synthetic) { CURRENT.examResults = CURRENT.examResults || []; CURRENT.examResults.push({id: q.id, ok: !!correct}); }
  if (correct){
    CURRENT.score += q.points; CURRENT.correct++;
    confetti(q.type === 'extraction' ? 30 : 20);
    showFB(true, q.explanation);
  } else {
    CURRENT.wrong++;
    showFB(false, q.explanation);
  }
  $('quiz-points').textContent = '+' + CURRENT.score;
  var fb = $('feedback-box');
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn primary block';
  btn.style.marginTop = '14px';
  btn.textContent = (CURRENT.qIdx + 1 < CURRENT.section.questions.length) ? '➡️ السؤال التالي' : '🎉 شاهد النتيجة';
  btn.onclick = function(){
    CURRENT.qIdx++;
    if (CURRENT.qIdx < CURRENT.section.questions.length) renderQuestion();
    else finishQuiz();
  };
  fb.appendChild(btn);
  /* 9.39.10: الشرح بعد الإجابة كان يقع تحت حافة الشاشة الصغيرة فلا يراه الطفل */
  try { var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; fb.scrollIntoView({block: 'nearest', behavior: rm ? 'auto' : 'smooth'}); } catch(e){ try { fb.scrollIntoView(false); } catch(x){} }
}
function showFB(isCorrect, expl){
  expl = GT(expl);
  var t = isCorrect ? (Math.random() < 0.5 ? '✅ {أحسنت|أحسنتِ}!' : '🌟 ممتاز!') : '🤔 ليست هذه الإجابة. {انظر|انظري} السبب هنا 👇 ثم {انتقل|انتقلي} إلى السؤال التالي';
  $('feedback-box').innerHTML = '<div class="feedback' + (isCorrect ? '' : ' wrong') + '"><div class="title">' + t + '</div><div class="explain">' + expl + '</div></div>';
}
function finishQuiz(){
  var prevSnap = (CURRENT.section && !CURRENT.section._synthetic && STATE.progress[CURRENT.section.id]) ? Object.assign({}, STATE.progress[CURRENT.section.id]) : null;
  var sec = CURRENT.section;
  if (sec.id === 'final_exam' || sec.id === 'retest_session'){ assessApplyExam(); }
  if (sec.id === 'review_session'){ assessApplyReview(); }
  var totalP = sec.questions.reduce(function(a, q){ return a + q.points; }, 0);
  var pct = totalP ? CURRENT.score / totalP : 0;
  // مكافأة الجهد: إكمال الاختبار يمنح نجمة، والنتيجة الجيدة والممتازة تضيفان نجمتين
  var stars = 1 + (pct >= 0.7 ? 1 : 0) + (pct >= 0.95 ? 1 : 0);
  var prev = STATE.progress[sec.id] || {bestScore: 0, stars: 0, attempts: 0};
  /* 9.39.11 (ق2-ب): نجوم الدرس من المحاولة الأولى (قياس)، وأفضل نتيجة ونجومها تُحفظ منفصلة (تدريب) */
  if (!sec._synthetic) STATE.progress[sec.id] = {
    bestScore: Math.max(prev.bestScore || 0, CURRENT.score),
    stars: (prev.attempts > 0 && prev.stars > 0) ? prev.stars : stars,
    bestStars: Math.max(prev.bestStars || prev.stars || 0, stars),
    attempts: (prev.attempts || 0) + 1
  };
  recalcStats();
  save();
  showResults(stars, pct);
  addResultsNav(); // 9.33
  if (sec._exam && STATE.assess && STATE.assess.inProgress){ STATE.assess.inProgress = null; save(); } // 9.39.12 (A6): اكتملت الجلسة
  renderExamReport();
  firstAttemptNote(sec, prevSnap);
  try { if (!sec._synthetic) maybeBackupReminder(); } catch(e){} // 9.39.13 (D12)
}
function showResults(stars, pct){
  var el = $('result-stars');
  var h = '';
  for (var i = 0; i < 3; i++) h += '<span class="star' + (i < stars ? ' earned' : '') + '">⭐</span>';
  el.innerHTML = h;
  var titles = ['', 'محاولة جيدة!', 'أداء رائع!', '{أنت بطل|أنتِ بطلة}! 🌟'];
  var msgs = ['', '{استمر|استمري} في التدريب', '{اقتربت|اقتربتِ} من الكمال ✨', 'ممتاز، {استمر|استمري} 🎉'];
  $('result-title').textContent = GT(titles[stars] || '{أحسنت|أحسنتِ}');
  $('result-message').textContent = GT(msgs[stars] || '{استمر|استمري}');
  $('result-score').textContent = CURRENT.score;
  $('result-correct').textContent = '✅ ' + CURRENT.correct;
  $('result-wrong').textContent = '❌ ' + CURRENT.wrong;
  $('result-circle').style.setProperty('--deg', Math.round(pct * 360) + 'deg');
  if (stars === 3) confetti(60);
  show('view-results');
  if (inExamMode()){ $('result-stars').innerHTML = ''; $('result-title').textContent = '📋 انتهت الجلسة'; $('result-message').textContent = GT('{اقرأ|اقرئي} الملخص أدناه'); } // القياس بالمفاهيم لا بالنجوم
}
function nextFromResults(){
  var _r = realSections();
  var idx = _r.findIndex(function(s){ return s.id === CURRENT.section.id; });
  if (idx >= 0 && idx + 1 < _r.length) openSection(_r[idx + 1].id);
  else goHome();
}
