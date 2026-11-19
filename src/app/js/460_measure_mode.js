/* ===== 9.39.11 (ق2-ب): وضع القياس في الاختبار النهائي والإعادة والمراجعة ===== */
function inExamMode(){ return !!(CURRENT.section && CURRENT.section._exam); }
function finishAnswerExam(correct, q){
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
}
