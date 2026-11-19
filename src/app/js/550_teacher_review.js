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
function beginTeacherFeedback(id){
  teacherFeedbackTarget = id; teacherFeedbackData = null; teacherFeedbackChunks = [];
  $('teacher-feedback-label').textContent = 'تعليق على «' + itemLabelById(id) + '» قبل رفضه من '+genderWord(PACK_DATA.teacherGender || 'boy','المعلم','المعلمة')+'.';
  try { $('teacher-feedback-text').placeholder = genderWord(PACK_DATA.teacherGender || 'boy', 'اكتب', 'اكتبي') + ' ملاحظتك للطالب هنا (اختياري إذا سجلت صوتًا)'; } catch(e){}
  $('teacher-feedback-preview').classList.add('hidden'); $('teacher-feedback-preview').removeAttribute('src');
  $('teacher-feedback-confirm').disabled = false; $('teacher-feedback-text').value = '';
  $('teacher-feedback-record').disabled = false; $('teacher-feedback-record').textContent = '🎙️ {ابدأ|ابدئي} التسجيل';
  $('teacher-feedback-status').textContent = 'يلزم تعليق واحد على الأقل (صوتي أو كتابي) قبل تأكيد الرفض.';
  $('teacher-feedback-modal').classList.remove('hidden');
}
async function toggleTeacherFeedbackRecording(){
  if (teacherFeedbackRecorder && teacherFeedbackRecorder.state === 'recording'){ teacherFeedbackRecorder.stop(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof window.MediaRecorder === 'undefined'){ alert('التسجيل الصوتي يحتاج متصفحًا يدعم الميكروفون وMediaRecorder.'); return; }
  try{
    teacherFeedbackStream = await navigator.mediaDevices.getUserMedia({audio:true});
    var fbMimes = ['audio/webm;codecs=opus','audio/webm','audio/mp4'];
    var fbMime = fbMimes.find(function(m){ return typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m); });
    teacherFeedbackRecorder = fbMime ? new MediaRecorder(teacherFeedbackStream,{mimeType:fbMime}) : new MediaRecorder(teacherFeedbackStream); teacherFeedbackChunks = [];
    teacherFeedbackRecorder.ondataavailable = function(e){ if (e.data && e.data.size) teacherFeedbackChunks.push(e.data); };
    teacherFeedbackRecorder.onstop = async function(){
      teacherFeedbackStream.getTracks().forEach(function(t){t.stop();});
      var blob = new Blob(teacherFeedbackChunks,{type:teacherFeedbackRecorder.mimeType || (teacherFeedbackChunks[0] && teacherFeedbackChunks[0].type) || 'audio/webm'});
      teacherFeedbackData = await blobToDataURL(blob);
      $('teacher-feedback-preview').src = teacherFeedbackData; $('teacher-feedback-preview').classList.remove('hidden');
      $('teacher-feedback-confirm').disabled = false; $('teacher-feedback-record').textContent = '🔄 إعادة التسجيل';
      $('teacher-feedback-status').textContent = 'تم التسجيل. استمع إليه ثم أكد الرفض.';
    };
    teacherFeedbackRecorder.start(); $('teacher-feedback-record').textContent = '⏹️ إيقاف التسجيل';
    $('teacher-feedback-status').textContent = '🔴 جارٍ تسجيل التعليق...';
  }catch(e){ alert('تعذر تشغيل الميكروفون: ' + e.message); }
}
function confirmTeacherRejection(){
  var noteText = ($('teacher-feedback-text').value || '').trim().slice(0, 400);
  if (!teacherFeedbackTarget || (!teacherFeedbackData && !noteText)){ alert('سجّل تعليقًا صوتيًا أو اكتب ملاحظة قبل تأكيد الرفض.'); return; }
  var reviewScroll = window.scrollY || document.documentElement.scrollTop || 0;
  var rec = PACK_DATA.studentAudios[teacherFeedbackTarget];
  rec.status = 'rejected';
  PACK_DATA.teacherFeedbacks = PACK_DATA.teacherFeedbacks || {};
  PACK_DATA.teacherNotes = PACK_DATA.teacherNotes || {};
  if (teacherFeedbackData){ rec.feedback = teacherFeedbackData; PACK_DATA.teacherFeedbacks[teacherFeedbackTarget] = teacherFeedbackData; }
  else { delete rec.feedback; delete PACK_DATA.teacherFeedbacks[teacherFeedbackTarget]; }
  if (noteText) PACK_DATA.teacherNotes[teacherFeedbackTarget] = noteText; else delete PACK_DATA.teacherNotes[teacherFeedbackTarget];
  $('teacher-feedback-modal').classList.add('hidden');
  teacherFeedbackTarget = null; teacherFeedbackData = null; showTeacherReview();
  requestAnimationFrame(function(){ window.scrollTo(0, reviewScroll); });
}
function cancelTeacherFeedback(){
  if (teacherFeedbackRecorder && teacherFeedbackRecorder.state === 'recording') teacherFeedbackRecorder.stop();
  if (teacherFeedbackStream) teacherFeedbackStream.getTracks().forEach(function(t){t.stop();});
  $('teacher-feedback-modal').classList.add('hidden'); teacherFeedbackTarget = null; teacherFeedbackData = null;
}
function renderTFViewInner(){
  var ids = Object.keys(STATE.studentAudios);
  var rejectedCount = 0, approvedCount = 0;
  var html = '';
  CURRICULUM.forEach(function(sec){
    (sec.items || []).forEach(function(it){
      var rec = STATE.studentAudios[it.id];
      var inPack = PACK_DATA.studentAudios && PACK_DATA.studentAudios[it.id];
      if (!rec && !inPack) return;
      var packStatus = inPack ? inPack.status : 'pending';
      var localStatus = rec ? (rec.status || 'pending') : packStatus;
      var effectiveStatus = packStatus === 'rejected' && localStatus === 'pending' ? 'pending' : packStatus;
      // after re-record, local status becomes 'pending'
      if (localStatus === 'pending' && packStatus === 'rejected') effectiveStatus = 'pending';

      if (packStatus === 'approved'){ approvedCount++; }
      if (packStatus === 'rejected' && localStatus !== 'pending') rejectedCount++;

      html += tfItemHTML(it.id, it.text, detectTextType({text: it.text}), packStatus, localStatus);
    });
    (sec.questions || []).forEach(function(q){
      var rec = STATE.studentAudios[q.id];
      var inPack = PACK_DATA.studentAudios && PACK_DATA.studentAudios[q.id];
      if (!rec && !inPack) return;
      var packStatus = inPack ? inPack.status : 'pending';
      var localStatus = rec ? (rec.status || 'pending') : packStatus;
      if (packStatus === 'approved') approvedCount++;
      if (packStatus === 'rejected' && localStatus !== 'pending') rejectedCount++;
      html += tfItemHTML(q.id, q.text, detectTextType(q), packStatus, localStatus);
    });
  });
  $('tf-list').innerHTML = html || '<div class="notice info">لا توجد تسجيلات بعد.</div>';
  $('tf-summary').innerHTML = 'لديك ' + rejectedCount + ' تسجيل يحتاج إلى إعادة. أعد التسجيل ثم أرسل الملف الجديد إلى المعلم.';
  $('tf-sub').textContent = (PACK_DATA.studentName || '') + ' — ' + rejectedCount + ' بحاجة لمراجعة';
}
function tfItemHTML(id, text, type, packStatus, localStatus){ var h = tfItemHTMLInner(id, text, type, packStatus, localStatus), x = studentRatingNote(id); return x ? h.replace(/<\/div>\s*$/, x + '</div>') : h; }
 // 9.39.15 (ق6)
function tfItemHTMLInner(id, text, type, packStatus, localStatus){
  var isApproved = packStatus === 'approved';
  var isRejected = packStatus === 'rejected';
  var wasRerecorded = localStatus === 'pending' && isRejected;
  var cls = isApproved ? 'approved' : '';
  var badge = isApproved ? '<span class="badge approved">✅ معتمد من المعلم</span>'
             : isRejected && wasRerecorded ? '<span class="badge pending">⏳ أعدت التسجيل — بانتظار المعلم</span>'
             : isRejected ? '<span class="badge rejected">❌ بحاجة لإعادة التسجيل</span>'
             : '<span class="badge pending">⏳ قيد المراجعة</span>';
  var rawId = String(id);
  var safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  var jsId = "'" + rawId.replace(/'/g, "\\'") + "'";
  var pickerId = 'replace-audio-' + safeId;
  var attrId = String(rawId).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  var uploadButton = '<button class="btn ghost block" ' + ACT('clickById', pickerId) + ' type="button">📁 \u0627\u062e\u062a\u064a\u0627\u0631 \u062a\u0633\u062c\u064a\u0644 \u0635\u0648\u062a\u064a \u0628\u062f\u064a\u0644</button>' +
    '<input class="hidden" type="file" accept="audio/*" id="' + pickerId + '" data-change-arg="' + attrId + '" data-change="uploadReplacementAudio">';
  var html = '<div class="tf-item ' + cls + '">';
  html += '<div class="head"><span data-style="font-weight:900;color:var(--primary)">' + escapeHTML(itemLabelById(id)) + '</span>' + badge + '</div>';
  html += '<div class="text' + (type === 'quran' ? ' quran' : '') + '">' + (type === 'quran' ? quranHTML(text, qpcHolder(rawId)) : text) + '</div>';
  if (isRejected && !wasRerecorded){
    var fb = PACK_DATA.teacherFeedbacks && PACK_DATA.teacherFeedbacks[id];
    var master = PACK_DATA.masterAudios && PACK_DATA.masterAudios[id];
    if (master) { var mt = detectTextType({text:text}); var ml = mt === 'quran' ? '🎧 تلاوة الشيخ / قارئ القرآن' : (mt === 'poem' ? '🎧 إنشاد منشد الأبيات' : '🎧 التسجيل المرجعي'); var mp = mt === 'quran' ? PACK_DATA.sheikhPhoto : PACK_DATA.poemReciterPhoto; var mn = mt === 'quran' ? PACK_DATA.sheikhName : PACK_DATA.poemReciterName; html += audioPersonBlock(mp,'boy',mn,ml,master,'reference-audio'); html += '<div data-style="font-size:.78rem;color:var(--muted);margin-top:4px">استمع إلى المرجع ثم طبّق التصحيح في تسجيلك الجديد.</div>'; }
    html += '<div class="audio-section"><b>🎧 تسجيلك السابق:</b><audio controls data-media="' + mediaRef('aud', ((PACK_DATA.studentAudios[id] && PACK_DATA.studentAudios[id].audio) || '')) + '"></audio></div>';
    html += (PACK_DATA.teacherNotes && PACK_DATA.teacherNotes[id] ? '<div class="teacher-comment"><b>📝 ملاحظة ' + genderWord(PACK_DATA.teacherGender || 'boy','المعلم','المعلمة') + ':</b><div>' + escapeHTML(String(PACK_DATA.teacherNotes[id])) + '</div></div>' : '');
    if (fb) html += '<div class="teacher-comment">' + audioPersonBlock(PACK_DATA.teacherPhoto, PACK_DATA.teacherGender || 'boy', PACK_DATA.teacherName || '', '📢 '+genderWord(PACK_DATA.teacherGender || 'boy','تسجيل المعلم للتصحيح','تسجيل المعلمة للتصحيح'), fb, 'teacher-person-audio') + '<div data-style="font-size:.78rem;color:var(--muted);margin-top:4px">استمع إلى ملاحظة '+genderWord(PACK_DATA.teacherGender || 'boy','المعلم','المعلمة')+' وطبّق التصحيح في تسجيلك الجديد.</div></div>';
    html += '<div class="re-record-wrap"><div id="rec-status-' + safeId + '" class="rec-status">جاهز لإعادة التسجيل</div><button id="re-record-btn-' + safeId + '" class="btn gold block re-record-btn" ' + ACT('startRec', rawId) + ' type="button">🎙️ {أعد|أعيدي} التسجيل الآن</button></div>' + uploadButton;
  } else if (isApproved){
    html += '<div data-style="font-size:.88rem;color:var(--success);font-weight:800">تم الاعتماد 🎉</div>';
    html += '<div class="audio-section"><audio controls data-media="' + mediaRef('aud', ((PACK_DATA.studentAudios[id] && PACK_DATA.studentAudios[id].audio) || '')) + '"></audio></div>';
  } else if (wasRerecorded){
    var master2 = PACK_DATA.masterAudios && PACK_DATA.masterAudios[id];
    var fb2 = PACK_DATA.teacherFeedbacks && PACK_DATA.teacherFeedbacks[id];
    var previous2 = PACK_DATA.studentAudios && PACK_DATA.studentAudios[id] && PACK_DATA.studentAudios[id].audio;
    if (master2) { var mt2 = detectTextType({text:text}); var ml2 = mt2 === 'quran' ? '🎧 تلاوة الشيخ / قارئ القرآن' : (mt2 === 'poem' ? '🎧 إنشاد منشد الأبيات' : '🎧 التسجيل المرجعي'); var mp2 = mt2 === 'quran' ? PACK_DATA.sheikhPhoto : PACK_DATA.poemReciterPhoto; var mn2 = mt2 === 'quran' ? PACK_DATA.sheikhName : PACK_DATA.poemReciterName; html += audioPersonBlock(mp2,'boy',mn2,ml2,master2,'reference-audio'); html += '<div data-style="font-size:.78rem;color:var(--muted);margin-top:4px">استمع إلى التسجيل المرجعي وطبّق ملاحظة المعلم.</div>'; }
    if (previous2) html += '<div class="audio-section"><b>🎧 تسجيلك السابق:</b><audio controls data-media="' + mediaRef('aud', previous2) + '"></audio></div>';
    html += (PACK_DATA.teacherNotes && PACK_DATA.teacherNotes[id] ? '<div class="teacher-comment"><b>📝 ملاحظة ' + genderWord(PACK_DATA.teacherGender || 'boy','المعلم','المعلمة') + ':</b><div>' + escapeHTML(String(PACK_DATA.teacherNotes[id])) + '</div></div>' : '');
    if (fb2) html += '<div class="teacher-comment">' + audioPersonBlock(PACK_DATA.teacherPhoto, PACK_DATA.teacherGender || 'boy', PACK_DATA.teacherName || '', '📢 '+genderWord(PACK_DATA.teacherGender || 'boy','تسجيل المعلم للتصحيح','تسجيل المعلمة للتصحيح'), fb2, 'teacher-person-audio') + '<div data-style="font-size:.78rem;color:var(--muted);margin-top:4px">استمع إلى تصحيح '+genderWord(PACK_DATA.teacherGender || 'boy','المعلم','المعلمة')+' ثم قارن تسجيلك الجديد.</div></div>';
    html += '<div class="audio-section"><b>🎧 تسجيلك الجديد:</b><div>حُفظ التسجيل الجديد على هذا الجهاز.</div><button class="btn ghost" ' + ACT('playStudentRec', rawId) + ' type="button">▶️ استمع إلى التسجيل الجديد</button></div>';
    html += '<div class="re-record-btn"><div id="rec-status-' + safeId + '" class="rec-status">جاهز لإعادة التسجيل</div><button id="re-record-btn-' + safeId + '" class="btn ghost block" ' + ACT('startRec', rawId) + ' type="button">🔄 {أعد|أعيدي} التسجيل مرة أخرى</button>' + uploadButton + '</div>';
  } else {
    html += '<div data-style="font-size:.85rem;color:var(--muted)">لم يُراجع بعد.</div>';
  }
  html += '</div>';
  return html;
}
var teacherFeedbackTarget = null, teacherFeedbackRecorder = null, teacherFeedbackStream = null, teacherFeedbackChunks = [], teacherFeedbackData = null;
var RATING_STATES = {mastered: '✅ متقن', good: '👍 جيد', needs: '🔁 يحتاج تدريبًا'};
 // 9.39.15 (ق6-أ)
var RATING_UNUSABLE = '🔇 لا يصلح للتقييم';
var NOTE_BANK = ['الغنة قصيرة', 'المد أقل من المطلوب', 'الإدغام غير واضح', 'الإظهار غير واضح', 'الإقلاب يحتاج تكرارًا', 'الإخفاء ثقيل، خفّف الغنة', 'المخرج غير دقيق', 'أحسنتِ، أعيدي الحكم بتركيز أكبر'];
