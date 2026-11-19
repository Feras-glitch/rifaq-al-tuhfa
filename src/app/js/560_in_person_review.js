/* ===== 9.40: مراجعة المعلم أو ولي الأمر على جهاز الطفل نفسه =====
   في البيت يجلس المعلم بجانب الطفل، فلا حاجة إلى إرسال ملف ثم انتظار ملف معاد. من «ملفي»: «مراجعة التسجيلات هنا»
   (خلف رمز ولي الأمر أو المسألة الحسابية). لكل تسجيل: استماع، ثم تقييم (متقن، جيد، يحتاج تدريبًا، لا يصلح للتقييم)
   وملاحظة اختيارية. «متقن» و«جيد» تعتمد التسجيل، و«يحتاج تدريبًا» تعيده للطفل ليسجّله من جديد.
   التقييم يُحفظ عند الطفل ويُحتسب في الشهادة، موسومًا «مراجعة حضورية» (بلا توقيع رقمي؛ الثقة هنا رمز ولي الأمر).
   مسار الملفات الموقّع باقٍ كما هو للمعلم البعيد. */
function inPersonRecordings(){
  var A = STATE.studentAudios || {};
  return Object.keys(A).filter(function(id){ return A[id] && typeof A[id] === 'object'; })
    .sort(function(a, b){ var pa = (A[a].status || 'pending') === 'pending' ? 0 : 1, pb = (A[b].status || 'pending') === 'pending' ? 0 : 1; return pa - pb; });
}
function openInPersonReview(){
  if (!inPersonRecordings().length){ toast('لا توجد تسجيلات بعد.'); return; }
  parentalGate(renderInPersonReview, 'مراجعة المعلم أو ولي الأمر للتسجيلات');
}
function closeInPersonReview(){ var o = document.getElementById('ipr-overlay'); if (o) o.remove(); try { showProfile(); } catch(e){} }
function inPersonSave(id, rating, note){
  var A = STATE.studentAudios || {}, r = A[id]; if (!r || !RATING_STATES[rating] && rating !== 'unusable') return false;
  r.status = (rating === 'mastered' || rating === 'good') ? 'approved' : 'rejected';
  r.reviewSource = 'in_person'; r.reviewedAt = new Date().toISOString();
  r.note = String(note || '').trim().slice(0, 400); if (!r.note) delete r.note;
  STATE.teacherRatings = STATE.teacherRatings || {}; STATE.teacherRatings[id] = rating;
  save(); return true;
}
function renderInPersonReview(){
  var old = document.getElementById('ipr-overlay'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'ipr-overlay'; ov.className = 'hifz-overlay';
  var box = document.createElement('div'); box.className = 'hifz-box'; ov.appendChild(box);
  var head = document.createElement('div'); head.className = 'hifz-head';
  var h3 = document.createElement('h3'); h3.textContent = '👨‍🏫 مراجعة التسجيلات هنا'; head.appendChild(h3);
  var x = document.createElement('button'); x.type = 'button'; x.className = 'btn ghost sm'; x.textContent = '✕'; x.setAttribute('aria-label', 'إغلاق'); x.addEventListener('click', closeInPersonReview); head.appendChild(x);
  box.appendChild(head);
  var intro = document.createElement('p'); intro.className = 'hifz-intro';
  intro.textContent = 'للمعلم أو ولي الأمر بجانب الطفل: استمع إلى كل تسجيل ثم قيّمه. «يحتاج تدريبًا» يعيده للطفل ليسجّله من جديد. معايير التقييم في دليل المعلم.';
  box.appendChild(intro);
  var A = STATE.studentAudios || {}, R = STATE.teacherRatings || {};
  inPersonRecordings().forEach(function(id){
    var r = A[id], card = document.createElement('div'); card.className = 'hifz-card';
    var t = document.createElement('div'); t.className = 'ipr-title'; t.textContent = itemLabelById(id); card.appendChild(t);
    var st = document.createElement('div'); st.className = 'hifz-num';
    var stText = function(){ var s = r.status || 'pending'; st.textContent = (s === 'approved' ? '✅ معتمد' : s === 'rejected' ? '🔁 يعيده الطفل' : '⏳ لم يُراجَع') + (r.reviewSource === 'in_person' ? ' · مراجعة حضورية' : '') + (R[id] && RATING_STATES[normRating(R[id])] ? ' · ' + RATING_STATES[normRating(R[id])] : ''); };
    stText(); card.appendChild(st);
    var row = document.createElement('div'); row.className = 'hifz-row';
    var play = document.createElement('button'); play.type = 'button'; play.className = 'btn primary sm'; play.textContent = '▶ استمع';
    play.addEventListener('click', function(){ playStudentRec(id); }); row.appendChild(play);
    card.appendChild(row);
    var note = document.createElement('textarea'); note.className = 'ipr-note'; note.rows = 2; note.maxLength = 400; note.placeholder = 'ملاحظة للطفل (اختيارية): مثلًا «أطل الغنة في النون المشددة»';
    note.value = r.note || ''; card.appendChild(note);
    var rates = document.createElement('div'); rates.className = 'hifz-row';
    ['mastered', 'good', 'needs', 'unusable'].forEach(function(k){
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'btn sm ' + (k === 'mastered' || k === 'good' ? 'success' : k === 'needs' ? 'gold' : 'ghost');
      b.textContent = k === 'unusable' ? RATING_UNUSABLE : RATING_STATES[k];
      b.addEventListener('click', function(){ if (inPersonSave(id, k, note.value)){ stText(); card.classList.remove('ok', 'again'); card.classList.add(k === 'mastered' || k === 'good' ? 'ok' : 'again'); toast('✔ حُفظ التقييم'); } });
      rates.appendChild(b);
    });
    card.appendChild(rates);
    box.appendChild(card);
  });
  var close = document.createElement('button'); close.type = 'button'; close.className = 'btn ghost block'; close.textContent = '↩ إنهاء المراجعة'; close.addEventListener('click', closeInPersonReview);
  box.appendChild(close);
  document.body.appendChild(ov);
}
/* زر المراجعة في «ملفي» وملاحظة المراجع تحت كل تسجيل */
function inPersonProfileExtras(){
  var list = document.getElementById('profile-recordings-list'); if (!list) return;
  var A = STATE.studentAudios || {};
  Array.prototype.forEach.call(list.children, function(row, i){
    var id = Object.keys(A)[i]; if (!id || !A[id] || !A[id].note || row.querySelector('.ipr-noteview')) return;
    var n = document.createElement('div'); n.className = 'ipr-noteview'; n.textContent = '📝 ' + A[id].note; row.style.flexWrap = 'wrap'; row.appendChild(n);
  });
  var old = document.getElementById('btn-in-person'); if (old) old.remove();
  if (!Object.keys(A).length) return;
  var b = document.createElement('button'); b.type = 'button'; b.id = 'btn-in-person'; b.className = 'btn purple block'; b.style.marginTop = '10px';
  b.textContent = '👨‍🏫 مراجعة التسجيلات هنا (للمعلم أو ولي الأمر)';
  b.addEventListener('click', openInPersonReview);
  list.parentNode.appendChild(b);
}
