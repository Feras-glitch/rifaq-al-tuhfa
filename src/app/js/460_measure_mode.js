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
  if (!inExamMode()){ try { if (CURRENT.section && !CURRENT.section._synthetic) logResponse(q, correct); } catch(e){} return _finishAnswerExamBase.apply(this, arguments); }
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
  try { logResponse(q, correct); examSnapshot(); } catch(e){} // 9.39.12 (A4، A6)
};
