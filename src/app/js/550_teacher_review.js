/* حالات التقدير وبنك الملاحظات الجاهزة */
var RATING_STATES = {mastered: '✅ متقن', good: '👍 جيد', needs: '🔁 يحتاج تدريبًا'};
var RATING_UNUSABLE = '🔇 لا يصلح للتقييم';
var NOTE_BANK = ['الغنة قصيرة', 'المد أقل من المطلوب', 'الإدغام غير واضح', 'الإظهار غير واضح', 'الإقلاب يحتاج تكرارًا', 'الإخفاء ثقيل، خفّف الغنة', 'المخرج غير دقيق', 'أحسنت، والحكم يحتاج تركيزًا أكبر'];
/* ===== مراجعة المعلم: التقييم والملاحظات وعرض الطفل لها ===== */
function handleReviewTeacherPhoto(event){
  var file = event.target.files && event.target.files[0]; if (!file) return;
  if (!imageFileLooksValid(file)){ alert('اختر ملف صورة صحيحًا.'); event.target.value=''; return; }
  var reader = new FileReader();
  reader.onerror=function(){ alert('تعذرت قراءة الصورة.'); event.target.value=''; };
  reader.onload=function(ev){
    var img=new Image(); img.onerror=function(){ alert('تعذر قراءة الصورة في هذا المتصفح.'); event.target.value=''; };
    img.onload=function(){ try{ var out=compressCanvasImage(img,480,300*1024,.82); PACK_DATA.teacherPhoto=out; var im=$('review-teacher-photo-img'); var ph=$('review-teacher-photo-placeholder'); im.src=out; im.classList.remove('hidden'); ph.classList.add('hidden'); var av=document.querySelector('#review-people-strip .review-person-card:nth-child(2) .mini-avatar'); if(av) av.innerHTML='<img data-media="'+mediaRef('img', out)+'" alt="صورة المعلم">'; }catch(e){ alert('تعذر تجهيز الصورة.'); } };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}
function showTeacherReview(){
  var previousScroll = window.scrollY || document.documentElement.scrollTop || 0;
  var teacherInput = $('review-teacher-name');
  if (teacherInput && !teacherInput.value) teacherInput.value = TEACHER_STATE.name || PACK_DATA.teacherName || '';
  var teacherPhotoImg = $('review-teacher-photo-img'), teacherPhotoPh = $('review-teacher-photo-placeholder');
  if (teacherPhotoImg && PACK_DATA.teacherPhoto){ teacherPhotoImg.src=PACK_DATA.teacherPhoto; teacherPhotoImg.classList.remove('hidden'); if(teacherPhotoPh) teacherPhotoPh.classList.add('hidden'); }
  if (!PACK_DATA.studentName){ alert('لا يوجد ملف طالب.'); return; }
  $('review-student-name').textContent = 'تسجيلات الطالب: ' + (PACK_DATA.studentName || '');
  (function(){ // 9.39.11 (ق1-ب)
    var rs = refStatusLine(), rb = document.getElementById('review-ref-line');
    if (!rs){ if (rb) rb.remove(); return; }
    if (!rb){ rb = document.createElement('div'); rb.id = 'review-ref-line'; rb.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:12px;font-size:.9rem;line-height:1.8'; var rl0 = $('review-list'); if (rl0 && rl0.parentNode) rl0.parentNode.insertBefore(rb, rl0); }
    rb.style.background = rs.ok ? '#e8f5e9' : '#ffebee'; rb.style.color = rs.ok ? '#1b5e20' : '#b71c1c'; rb.textContent = rs.text;
  })();
  teacherSigningStatus().then(function(st){
    var sb = document.getElementById('review-sign-line');
    if (!sb){ sb = document.createElement('div'); sb.id = 'review-sign-line'; sb.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:12px;font-size:.9rem'; var rl2 = $('review-list'); if (rl2 && rl2.parentNode) rl2.parentNode.insertBefore(sb, rl2); }
    sb.style.background = st.ok ? '#e8f5e9' : '#fff3e0'; sb.style.color = st.ok ? '#1b5e20' : '#e65100'; sb.textContent = st.text;
  }).catch(function(){});
  (function(){
    var ab = document.getElementById('review-assess-line');
    if (!ab){ ab = document.createElement('div'); ab.id = 'review-assess-line'; ab.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:12px;font-size:.9rem;background:#eef4ff;color:#1a3a6b'; var rl3 = $('review-list'); if (rl3 && rl3.parentNode) rl3.parentNode.insertBefore(ab, rl3); }
    var sa = PACK_DATA.studentAssessment;
    var overdue = PACK_DATA.submittedAt && assessTeacherReplyOverdue(PACK_DATA.submittedAt, new Date().toISOString()) && !PACK_DATA.teacherRepliedAt;
    var chSel = document.getElementById('review-reply-channel');
    if (!chSel){ chSel = document.createElement('select'); chSel.id = 'review-reply-channel'; chSel.setAttribute('data-change', 'setReplyChannel'); chSel.style.cssText = 'width:100%;padding:8px;border-radius:10px;border:1px solid #cfd8dc;margin:6px 0'; var rl4 = $('review-list'); if (rl4 && rl4.parentNode) rl4.parentNode.insertBefore(chSel, rl4); }
    chSel.innerHTML = Object.keys(REPLY_CHANNELS).map(function(k){ return '<option value="' + k + '"' + ((PACK_DATA.replyChannel || 'text') === k ? ' selected' : '') + '>قناة الرد: ' + REPLY_CHANNELS[k] + '</option>'; }).join('');
    rosterSaveCurrent();
    var rbtn = document.getElementById('btn-roster');
    if (!rbtn){ rbtn = document.createElement('button'); rbtn.id = 'btn-roster'; rbtn.type = 'button'; rbtn.className = 'btn ghost block'; rbtn.textContent = '📋 لوحة المتابعة'; rbtn.setAttribute('data-call', '["openRoster"]'); var rl5 = $('review-list'); if (rl5 && rl5.parentNode) rl5.parentNode.insertBefore(rbtn, rl5); }
    var pendingCount = Object.keys(PACK_DATA.studentAudios || {}).filter(function(k){ return (PACK_DATA.studentAudios[k] || {}).status === 'pending'; }).length;
    var alertLine = (overdue ? ' ⏰ تجاوز الرد مهلة 48 ساعة.' : '') + (pendingCount > 10 ? ' ⚠️ التسجيلات المعلقة ' + pendingCount + ' (الحد الموصى به 10): راجع دفعة أولًا.' : '');
    var _secT = function(id){ var s = CURRICULUM.find(function(x){ return x.id === id; }); return s ? s.title : id; };
    var _le = sa && sa.lastExam, _leTxt = _le ? ' · آخر اختبار: ' + _le.correct + '/' + _le.total + (_le.wrong && _le.wrong.length ? ' (أخطاء في ' + _le.wrong.length + ' سؤالًا)' : '') : '';
    if (sa && sa.restored) _leTxt += ' · ' + restoredNote(sa.restored); // 9.39.13 (D12)
    ab.textContent = (sa ? ('📊 الاختبار النظري: متقن ' + sa.mastered.length + '، قيد التدريب ' + sa.pending.length + (sa.escalated.length ? '، محالة للمعلم: ' + sa.escalated.map(_secT).join('، ') : '') + _leTxt) : '📊 لا توجد نتائج اختبار نظري مرسلة بعد.') + alertLine;
  })();
  (function(){
    var box = document.getElementById('review-consent-line');
    if (!box){ box = document.createElement('div'); box.id = 'review-consent-line'; box.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:12px;font-size:.9rem'; var rl = $('review-list'); if (rl && rl.parentNode) rl.parentNode.insertBefore(box, rl); }
    var c = PACK_DATA.studentConsent;
    if (c && (c.v === 1 || c.v === 2) && c.guardian){
      var when = c.at ? new Date(c.at).toLocaleDateString('ar') : '';
      box.style.background = '#e8f5e9'; box.style.color = '#1b5e20';
      box.textContent = '🛡️ موافقة ولي الأمر: ' + c.guardian + (when ? ' (بتاريخ ' + when + ')' : '');
    } else {
      box.style.background = '#fff3e0'; box.style.color = '#e65100';
      box.textContent = '⚠️ لا توجد موافقة ولي أمر مسجّلة لهذا الملف. لا تعتمد تسجيلات الطفل قبل التأكد منها.';
    }
  })();
  var reviewHeader = document.getElementById('review-people-strip');
  if (!reviewHeader){
    reviewHeader = document.createElement('div'); reviewHeader.id='review-people-strip'; reviewHeader.className='review-person-strip';
    var stats = document.querySelector('#view-teacher-review .review-stats');
    stats.parentNode.insertBefore(reviewHeader, stats.nextSibling);
  }
  var studentAvatar = PACK_DATA.studentPhoto ? '<img data-media="'+mediaRef('img', PACK_DATA.studentPhoto)+'" alt="صورة الطالب">' : '<span>'+((PACK_DATA.studentGender==='girl')?'🧚‍♀️':'🦸‍♂️')+'</span>';
  var teacherAvatar = PACK_DATA.teacherPhoto ? '<img data-media="'+mediaRef('img', PACK_DATA.teacherPhoto)+'" alt="صورة المعلم">' : '<span>'+((PACK_DATA.teacherGender==='girl')?'👩‍🏫':'👨‍🏫')+'</span>';
  reviewHeader.innerHTML = '<div class="review-person-card"><div class="mini-avatar">'+studentAvatar+'</div><div><div class="mini-label">'+(PACK_DATA.studentGender==='girl' ? 'الطالبة صاحبة التسجيلات' : 'الطالب صاحب التسجيلات')+'</div><div class="mini-name">'+escapeHTML(PACK_DATA.studentName || '—')+'</div></div></div><div class="review-person-card"><div class="mini-avatar">'+teacherAvatar+'</div><div><div class="mini-label">المعلم المراجع</div><div class="mini-name">'+escapeHTML(PACK_DATA.teacherName || 'لم يُحدد بعد')+'</div></div></div>';

  var items = [];
  CURRICULUM.forEach(function(sec){
    (sec.items || []).forEach(function(it){
      if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[it.id]) items.push({id: it.id, text: it.text, qpc: it.qpc, type: detectTextType({text: it.text})});
    });
    (sec.questions || []).forEach(function(q){
      if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[q.id]) items.push({id: q.id, text: q.text, qpc: q.qpc, type: detectTextType(q)});
    });
  });

  var approved = 0;
  var h = '';
  items.forEach(function(it){
    var rec = PACK_DATA.studentAudios[it.id];
    var status = rec.status || 'pending';
    if (status === 'approved') approved++;
    h += '<div class="review-item ' + (status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : '') + '">';
    h += '<div class="head"><div class="dot"></div><div class="label">' + escapeHTML(itemLabelById(it.id)) + '</div>';
    h += '<div class="status ' + status + '">' + (status === 'approved' ? '✅ معتمد' : status === 'rejected' ? '❌ مرفوض' : '⏳ قيد المراجعة') + '</div></div>';
    h += '<div class="text' + (it.type === 'quran' ? ' quran' : '') + '">' + (it.type === 'quran' ? quranHTML(it.text, it, it.id) : highlightPivot(it.text, it.id)) + '</div>'; // 9.39.15 (ق6-ب)، 9.39.17
    h += audioPersonBlock(PACK_DATA.studentPhoto, PACK_DATA.studentGender || 'boy', PACK_DATA.studentName || '', '🎙️ تسجيل الطالب / الطالبة', rec.audio, 'review-student-audio');
    if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[it.id] && PACK_DATA.studentAudios[it.id].partial) h += '<div class="notice warn" data-style="font-size:.85rem">⚠️ هذا التسجيل ناقص: انقطع الميكروفون أو خرج الطفل من التطبيق أثناءه.</div>';
    if (PACK_DATA.teacherNotes && PACK_DATA.teacherNotes[it.id]) h += '<div class="teacher-comment"><b>📝 ملاحظتك المكتوبة:</b><div>' + escapeHTML(String(PACK_DATA.teacherNotes[it.id])) + '</div></div>';
    h += ratingBlockHTML(it); // 9.39.15 (ق6)
    h += '<select class="note-bank" data-change="applyNoteCode" data-change-arg="' + it.id + '" data-style="width:100%;padding:8px;border-radius:10px;border:1px solid #cfd8dc;margin-bottom:6px"><option value="">— اختر ملاحظة جاهزة —</option>' + NOTE_BANK.map(function(n){ return '<option value="' + n + '">' + n + '</option>'; }).join('') + '</select>';
    h += '<div class="review-actions">';
    h += '<button class="btn success" ' + ACT('setReview', it.id, 'approved') + ' type="button">✅ اعتماد</button>';
    h += '<button class="btn danger" ' + ACT('setReview', it.id, 'rejected') + ' type="button">❌ رفض</button>';
    h += '</div></div>';
  });
  if (!items.length) h = '<div class="notice warn">لا توجد تسجيلات للمراجعة.</div>';
  $('review-list').innerHTML = h;
  $('review-approved-count').textContent = approved;
  show('view-teacher-review');
  requestAnimationFrame(function(){ window.scrollTo(0, previousScroll); });
}
/* يُستدعى أثناء تعقيم الملف عند الإقلاع، قبل تعريف RATING_STATES، فلا يعتمد عليه */
function normRating(v){ v = String(v || ''); if (v === 'notapplied') return 'needs'; return ({mastered: 1, good: 1, needs: 1, unusable: 1})[v] ? v : ''; }
function setRating(id, state){
  if ((!RATING_STATES[state] && state !== 'unusable') || !PACK_DATA.studentAudios || !PACK_DATA.studentAudios[id]) return;
  PACK_DATA.teacherRatings = PACK_DATA.teacherRatings || {};
  PACK_DATA.teacherRatings[id] = state;
  showTeacherReview();
}
function applyNoteCode(ev, id){
  var code = ev.target.value; if (!code) return;
  PACK_DATA.teacherNotes = PACK_DATA.teacherNotes || {};
  PACK_DATA.teacherNotes[id] = ((PACK_DATA.teacherNotes[id] ? PACK_DATA.teacherNotes[id] + ' — ' : '') + code).slice(0, 400);
  showTeacherReview();
}
function setReview(id, status){
  if (!PACK_DATA.studentAudios[id]) return;
  var reviewScroll = window.scrollY || document.documentElement.scrollTop || 0;
  PACK_DATA.teacherName = ($('review-teacher-name') && $('review-teacher-name').value.trim()) || TEACHER_STATE.name || PACK_DATA.teacherName || '';
  TEACHER_STATE.name = PACK_DATA.teacherName;
  if (!PACK_DATA.teacherName){ alert('اكتب اسم المعلم المراجع أولاً.'); return; }
  if (status === 'rejected'){ beginTeacherFeedback(id); return; }
  PACK_DATA.studentAudios[id].status = 'approved';
  delete PACK_DATA.studentAudios[id].feedback;
  if (PACK_DATA.teacherNotes) delete PACK_DATA.teacherNotes[id];
  if (PACK_DATA.teacherFeedbacks) delete PACK_DATA.teacherFeedbacks[id];
  showTeacherReview();
  requestAnimationFrame(function(){ window.scrollTo(0, reviewScroll); });
}
