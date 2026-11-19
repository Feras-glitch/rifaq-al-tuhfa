/* ===== الخريطة والدرس ===== */
var CURRENT = {section:null, qIdx:0, score:0, correct:0, wrong:0};

function openSection(sid){
  var sec = CURRICULUM.find(function(x){ return x.id === sid; });
  if (!sec) return;
  CURRENT.section = sec;
  renderLesson();
  show('view-lesson');
  var c = document.getElementById('lesson-content'); if (c) delete c.dataset.paged; // 9.28: بطاقات الدرس
  setTimeout(paginateLessonCards, 0);
}
function renderLessonContent(){
  var sec = CURRENT.section;
  var s = STATE.student;
  var av = $('lesson-avatar');
  if (s.photo) av.innerHTML = '<img data-media="' + mediaRef('img', s.photo) + '" alt="">';
  else av.innerHTML = '<span class="emoji">' + (s.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️') + '</span>';
  $('lesson-section-title').textContent = sec.emoji + ' ' + sec.title;

  var _tn = PACK_DATA.teacherName || PACK_DATA.supervisorName || '';
  var sub = 'بإشراف ' + (PACK_DATA.teacherGender === 'girl' ? 'المعلمة' : 'المعلم') + (_tn && _tn !== 'المعلم' ? ' ' + _tn : '');
  if (PACK_DATA.packageType === 'approved_gift' && PACK_DATA.sourceGiftStudentName) sub = 'إهداء من ' + (PACK_DATA.sourceGiftStudentGender === 'girl' ? 'زميلتك ' : 'زميلك ') + PACK_DATA.sourceGiftStudentName + ' · بإشراف ' + teacherByline();
  $('lesson-progress-label').textContent = sub;

  var html = '';
  sec.items.forEach(function(item){
    html += verseAudioCount(item) ? matnVersesHTML(item) : '<div class="content-text">' + quranHTML(item.text, item) + '</div>'; // 9.39.16 (ق4)، 9.39.17 (خط المصحف)
    if (item.desc) html += '<div class="desc-text">💡 ' + GT(item.desc) + '</div>';

    if (verseAudioCount(item)){ html += matnHeaderHTML(item); }
    else if (PACK_DATA.masterAudios && PACK_DATA.masterAudios[item.id]){
      var itemType = detectTextType({text: item.text});
      var masterPhoto = itemType === 'quran' ? PACK_DATA.sheikhPhoto : PACK_DATA.poemReciterPhoto;
      var masterGender = itemType === 'quran' ? 'boy' : 'boy';
      var masterName = itemType === 'quran' ? PACK_DATA.sheikhName : (itemType === 'poem' ? PACK_DATA.poemReciterName : '');
      var masterLabel = itemType === 'quran' ? '🎧 تلاوة الشيخ / قارئ القرآن' : (itemType === 'poem' ? '🎧 إنشاد منشد الأبيات' : '🎧 التسجيل المرجعي');
      html += audioPersonBlock(masterPhoto, masterGender, masterName, masterLabel, PACK_DATA.masterAudios[item.id], 'master-person-audio');
    } else {
      var _t0 = detectTextType({text: item.text});
      if (_t0 === 'quran' || _t0 === 'poem') html += '<div class="no-master">' + GT('🎧 لم يُضَف ' + (_t0 === 'quran' ? 'تسجيل الشيخ لهذه الآية' : 'إنشاد هذه الأبيات') + ' بعد. {اسأل|اسألي} معلمك عن القراءة الصحيحة.') + '</div>';
    }

    if (PACK_DATA.packageType === 'approved_gift') {
      html += peerAudioBlocks(item.id);
    } else {
      var rec = getStudentRec(item.id);
      if (rec) html += '<div class="student-rec-block"><b>🎧 تسجيلك:</b><audio controls data-media="' + mediaRef('aud', rec) + '"></audio></div>';
    }

    if ((STATE.role === 'student' || STATE.role === 'friend') && !STATE.studentAudios[item.id]) {
      html += '<div class="student-rec-block"><b>🎙️ تسجيلك (تدريب):</b><div class="rec-actions">';
      var lessonSafeId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      html += '<button id="lesson-rec-btn-' + lessonSafeId + '" class="btn primary" ' + ACT('startRec', item.id) + ' type="button">🎙️ {سجّل|سجّلي}</button>';
      html += '</div><div class="rec-status" id="rec-status-' + lessonSafeId + '">—</div></div>';
    } else if ((STATE.role === 'student' || STATE.role === 'friend') && STATE.studentAudios[item.id]) {
      var st = STATE.studentAudios[item.id].status || 'pending';
      var stLabel = st === 'approved' ? '✅ معتمد' : st === 'rejected' ? '❌ مرفوض' : (STATE.studentAudios[item.id].sentAt ? '⏳ في ملف الإرسال — بانتظار المعلم' : '💾 محفوظ عندك — لم يُرسل بعد');
      html += '<div class="student-rec-block"><b>🎙️ تسجيلك — ' + stLabel + ':</b><div class="rec-actions">';
      html += '<button class="btn success" ' + ACT('playStudentRec', item.id) + ' type="button">🔊 {اسمع|اسمعي}</button>';
      if (st !== 'approved'){
        var lessonSafeId2 = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_'); html += '<button id="lesson-rec-btn-' + lessonSafeId2 + '" class="btn gold" ' + ACT('startRec', item.id) + ' type="button">🔄 {أعد|أعيدي}</button>';
        html += '<button class="btn rec-del" ' + ACT('deleteStudentRec', item.id) + ' type="button" aria-label="حذف التسجيل" title="حذف التسجيل">🗑️</button>';
      }
      html += '</div></div>';
    }
  });
  // Quran reference recordings may belong to extraction questions rather than lesson items.
  // Expose them in the student lesson so the learner can listen, compare, record, and submit them.
  var quranRefs = (sec.questions || []).filter(function(q){ return q.textType === 'quran' || detectTextType(q) === 'quran'; });
  if (quranRefs.length){
    var quranCards = [];
    quranRefs.forEach(function(q){
      if (!PACK_DATA.masterAudios || !PACK_DATA.masterAudios[q.id]) return;
      var qid = q.id, qtext = q.text || '';
      var safeQid = String(qid).replace(/[^a-zA-Z0-9_-]/g, '_');
      var qrec = getStudentRec(qid);
      quranCards.push('<div class="content-text quran">' + quranHTML(qtext, q) + '</div>');
      quranCards.push(audioPersonBlock(PACK_DATA.sheikhPhoto, 'boy', PACK_DATA.sheikhName || '', '🎧 تلاوة الشيخ / قارئ القرآن', PACK_DATA.masterAudios[qid], 'master-person-audio'));
      if (PACK_DATA.packageType === 'approved_gift') quranCards.push(peerAudioBlocks(qid));
      else if (qrec) quranCards.push('<div class="student-rec-block"><b>🎧 تسجيلك السابق:</b><audio controls data-media="' + mediaRef('aud', qrec) + '"></audio></div>');
      var localQ = STATE.studentAudios[qid];
      if (!localQ){
        quranCards.push('<div class="student-rec-block"><b>🎙️ تسجيلك:</b><div class="rec-actions"><button id="lesson-rec-btn-' + safeQid + '" class="btn primary" ' + ACT('startRec', qid) + ' type="button">🎙️ {سجّل|سجّلي}</button></div><div class="rec-status" id="rec-status-' + safeQid + '">—</div></div>');
      } else {
        var qs = localQ.status || 'pending';
        quranCards.push('<div class="student-rec-block"><b>🎙️ تسجيلك — ' + (qs === 'approved' ? '✅ معتمد' : qs === 'rejected' ? '❌ مرفوض' : '⏳ قيد المراجعة') + ':</b><div class="rec-actions"><button class="btn success" ' + ACT('playStudentRec', qid) + ' type="button">🔊 اسمع</button>' + (qs !== 'approved' ? '<button id="lesson-rec-btn-' + safeQid + '" class="btn gold" ' + ACT('startRec', qid) + ' type="button">🔄 أعد</button>' : '') + '</div></div>');
      }
    });
    if (quranCards.length) html += '<div class="card" data-style="margin-top:18px"><h3 data-style="margin-top:0;color:var(--primary)">📿 تسجيلات القرآن المرجعية</h3><p data-style="color:var(--muted);font-size:.86rem">استمع إلى تلاوة الشيخ / قارئ القرآن، ثم {سجّل|سجّلي} تلاوتك أنت وأرسلها للمعلم.</p>' + quranCards.join('') + '</div>';
  }
  html += '<button class="btn primary block mt-20" data-call="[&quot;startQuiz&quot;]" type="button">🎯 {ابدأ|ابدئي} الاختبار (' + arCount(Math.min(sec.questions.length, LESSON_QUIZ_MAX), 'سؤال', 'سؤالان', 'أسئلة') + ')</button>'; // 9.39.13 (ق3-ب)
  html += '<button class="btn ghost block" data-style="margin-top:10px" data-call="[&quot;goHome&quot;]" type="button">🏠 رجوع</button>';
  $('lesson-content').innerHTML = html;
}
/* 9.39.5 (R08): بيان محتوى الإهداء — يُبنى عند الإصدار ويدخل في التوقيع، ويُعرض للمعلم قبل الإصدار وللمهدى إليه عند الفتح */
function curriculumTasks(masters){
  masters = masters || {};
  var out = [];
  (CURRICULUM || []).forEach(function(sec){
    if (!sec || sec._synthetic) return;
    (sec.items || []).forEach(function(it){ out.push({id: it.id, sec: sec.id, secTitle: sec.title, kind: it.type === 'quran' ? 'آية' : (it.type === 'poem' ? 'أبيات المتن' : 'نص'), label: plainText(it.text).slice(0, 70)}); });
    (sec.questions || []).forEach(function(q){ if ((q.textType === 'quran' || detectTextType(q) === 'quran') && masters[q.id]) out.push({id: q.id, sec: sec.id, secTitle: sec.title, kind: 'آية', label: plainText(q.text).slice(0, 70)}); });
  });
  return out;
}

function renderHome(){
  applyTheme();
  var s = STATE.student;
  var av = $('home-avatar');
  if (s.photo) av.innerHTML = '<img data-media="' + mediaRef('img', s.photo) + '" alt="">';
  else av.innerHTML = '<span class="emoji">' + (s.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️') + '</span>';
  $('home-name').textContent = s.name || '—';

  var sub = 'في رحاب القرآن · رفاق التحفة' + (!isGenericName(PACK_DATA.sheikhName) ? ' · المادة التعليمية: ' + PACK_DATA.sheikhName : '');
  if (PACK_DATA.packageType === 'approved_gift' && (PACK_DATA.sourceGiftStudentName || PACK_DATA.studentName)) {
    sub = 'إهداء من ' + (PACK_DATA.sourceGiftStudentGender === 'girl' ? 'زميلتك ' : 'زميلك ') + (PACK_DATA.sourceGiftStudentName || PACK_DATA.studentName || '—') + ' • بإشراف ' + teacherByline();
  }
  $('home-sub').textContent = sub;
  var refB = document.getElementById('home-ref-banner'); // 9.39.11 (ق1-ب)
  if (REF_HIDDEN){
    if (!refB){ refB = document.createElement('div'); refB.id = 'home-ref-banner'; refB.className = 'notice warn'; refB.style.cssText = 'margin:10px 0;font-size:.88rem'; var sl0 = $('section-list'); if (sl0 && sl0.parentNode) sl0.parentNode.insertBefore(refB, sl0); }
    refB.textContent = '⚠️ هذا الملف لا يحمل توقيع المشرف المعتمد، فأُخفيت تلاوات الشيخ. اطلب من معلمك الملف الأصلي.';
  } else if (refB) refB.remove();
  var gcBtn = document.getElementById('home-gift-contents-btn');
  if (PACK_DATA.packageType === 'approved_gift'){
    if (!gcBtn){ gcBtn = document.createElement('button'); gcBtn.id = 'home-gift-contents-btn'; gcBtn.type = 'button'; gcBtn.className = 'btn ghost'; gcBtn.style.cssText = 'margin-top:6px;font-size:.8rem;padding:4px 10px';
      gcBtn.textContent = '🎁 ماذا في هذا الإهداء؟'; gcBtn.setAttribute('data-call', '["showGiftContents"]'); $('home-sub').parentNode.appendChild(gcBtn); }
  } else if (gcBtn) gcBtn.remove();

  var _real = realSections();
  var completed = 0, totalStars = 0, maxStars = _real.length * 3;
  _real.forEach(function(sec){
    var pr = STATE.progress[sec.id];
    if (pr && pr.stars > 0) completed++;
    totalStars += (pr && pr.stars) || 0;
  });
  var pct = maxStars ? Math.round(totalStars / maxStars * 100) : 0;
  $('total-progress').style.width = pct + '%';
  $('total-points-pill').textContent = (STATE.stats.totalPoints || 0) + ' نقطة';
  $('progress-label').textContent = completed + ' من ' + _real.length + ' أقسام — ' + totalStars + '/' + maxStars + ' نجوم';

  var html = '';
  CURRICULUM.forEach(function(sec){
    var pr = STATE.progress[sec.id] || {stars: 0};
    var sh = '';
    for (var i = 1; i <= 3; i++) sh += '<span class="star' + (i <= pr.stars ? ' earned' : '') + '">⭐</span>';
    html += '<div class="section-card" ' + ACT('openSection', sec.id) + '>';
    html += '<div class="sec-icon">' + sec.emoji + '</div>';
    html += '<div class="sec-info"><h3>' + sec.title + '</h3>';
    html += '<div class="sec-meta">' + arCount(sec.items.length, 'عنصر', 'عنصران', 'عناصر') + ' · ' + arCount(sec.questions.length, 'سؤال', 'سؤالان', 'أسئلة') + '</div>';
    html += '<div class="sec-stars">' + sh + '</div></div>';
    html += '<span data-style="color:var(--muted);font-size:1.3rem">›</span></div>';
  });
  $('section-list').innerHTML = html;

  if (hasTeacherFeedbacks() && STATE.role !== 'friend'){
    // show feedback banner
  }
  renderTrack();
}
function goHome(){ renderHome(); show('view-home'); }
