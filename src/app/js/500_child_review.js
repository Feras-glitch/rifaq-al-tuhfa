/* ===== 9.35: مراجعة بعين الطفل والأسرة والمعلم ===== */
/* 1) زر "اسمع الشرح" يقرأ الشرح بصوت الجهاز بالعربية (إن توفّر صوت عربي) */
function speakLessonExplanation(){
  if (!('speechSynthesis' in window)) { alert('الجهاز لا يدعم القراءة الصوتية.'); return; }
  var c = document.getElementById('lesson-content'); if (!c) return;
  var d = c.querySelector('.desc-text'); if (!d) return;
  var text = d.innerText || d.textContent || '';
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.lang = 'ar-SA'; u.rate = 0.8;
  window.speechSynthesis.speak(u);
}
function addListenButton(){
  var c = document.getElementById('lesson-content'); if (!c || document.getElementById('listen-lesson')) return;
  if (!('speechSynthesis' in window) || !c.querySelector('.desc-text')) return;
  var b = document.createElement('button'); b.type = 'button'; b.id = 'listen-lesson'; b.className = 'btn ghost';
  b.textContent = '🔊 اسمع الشرح'; b.style.cssText = 'margin:0 0 8px';
  b.addEventListener('click', speakLessonExplanation);
  c.insertBefore(b, c.firstChild);
}
var _openSectionBase2 = openSection;
openSection = function(sid){
  var r = _openSectionBase2.apply(this, arguments);
  var c = document.getElementById('lesson-content'); if (c) { var old = document.getElementById('listen-lesson'); if (old) old.remove(); }
  setTimeout(addListenButton, 30);
  return r;
};
/* 2) الموافقة الأبوية تُطلب عند حفظ بيانات الطالب، لا عند أول تسجيل (وقت الولي هنا) */
var _saveSetupBase = saveSetup;
saveSetup = function(){
  var r = _saveSetupBase.apply(this, arguments);
  setTimeout(function(){ if (STATE.student && STATE.student.name && !hasConsent()) ensureConsent(function(){}); }, 300);
  return r;
};
/* 3) زر "ابدأ الدرس التالي" واضح في الشاشة الرئيسية */
var _renderTrackBase = renderTrack;
renderTrack = function(){
  _renderTrackBase.apply(this, arguments);
  var home = document.getElementById('view-home'); if (!home) return;
  var old = document.getElementById('next-lesson-cta'); if (old) old.remove();
  var secs = CURRICULUM.filter(function(s){ return !s._synthetic; });
  var next = secs.find(function(s){ return trackStatus(s) !== 'done'; }) || secs[0];
  if (!next) return;
  var b = document.createElement('button'); b.type = 'button'; b.id = 'next-lesson-cta'; b.className = 'btn success block';
  b.textContent = '▶ ابدأ: ' + next.title; b.style.cssText = 'margin:0 0 12px;font-size:1.05rem';
  b.addEventListener('click', function(){ openSection(next.id); });
  var track = document.getElementById('home-track');
  home.insertBefore(b, track ? track.nextSibling : home.firstChild);
};


