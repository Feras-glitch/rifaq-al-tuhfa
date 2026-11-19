/* ===== 9.32: شريط تنقل داخل الاختبار: الرئيسية، الدرس السابق، إعادة الاختبار ===== */
function quizNavPrevSection(){
  var list = CURRICULUM.filter(function(s){ return !s._synthetic; });
  var cur = CURRENT.section && CURRENT.section.id;
  var i = list.findIndex(function(s){ return s.id === cur; });
  return i > 0 ? list[i - 1] : null;
}
function ensureQuizNav(){
  var view = document.getElementById('view-quiz'); if (!view) return;
  var old = document.getElementById('quiz-nav'); if (old) old.remove();
  var synthetic = !!(CURRENT.section && CURRENT.section._synthetic);
  var prev = quizNavPrevSection();
  var bar = document.createElement('div'); bar.id = 'quiz-nav';
  bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:space-between;margin:0 0 8px';
  function mk(label, fn, disabled){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.textContent = label; b.disabled = !!disabled;
    b.style.cssText = 'flex:1;min-width:90px;min-height:44px;padding:6px 8px;font-size:.85rem';
    b.addEventListener('click', fn); return b;
  }
  bar.appendChild(mk('⌂ الخريطة', function(){ goHome(); }, false));
  bar.appendChild(mk('‹ الدرس السابق', function(){ if (prev && confirmLeaveQuiz()) openSection(prev.id); }, !prev || synthetic));
  bar.appendChild(mk('↺ إعادة الاختبار', function(){ if (synthetic){ toast('الاختبار النهائي يُعاد من الخريطة بخطة جديدة.'); return; } if (confirmLeaveQuiz()) startQuiz(); }, synthetic));
  view.insertBefore(bar, view.firstChild);
  var home = bar.firstChild; // تأكيد الخروج من اختبار جارٍ
  if (home && !home._confirmBound){
    home._confirmBound = true;
    home.addEventListener('click', function(ev){ if (!confirmLeaveQuiz()){ ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
  }
}


