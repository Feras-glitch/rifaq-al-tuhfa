/* تعليق المعلم الصوتي على تسجيل الطفل، وعرض التعليقات */
var teacherFeedbackTarget = null, teacherFeedbackRecorder = null, teacherFeedbackStream = null, teacherFeedbackChunks = [], teacherFeedbackData = null;
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
    /* 9.42: الجودة نفسها التي يُسجَّل بها الطفل (24 كيلوبت/ث)، فلا يتضخم ملف الإعادة بتعليقات المعلم */
    try { teacherFeedbackRecorder = fbMime ? new MediaRecorder(teacherFeedbackStream,{mimeType:fbMime,audioBitsPerSecond:24000}) : new MediaRecorder(teacherFeedbackStream,{audioBitsPerSecond:24000}); }
    catch(_e){ teacherFeedbackRecorder = fbMime ? new MediaRecorder(teacherFeedbackStream,{mimeType:fbMime}) : new MediaRecorder(teacherFeedbackStream); } teacherFeedbackChunks = [];
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
  reviewAdvance(teacherFeedbackTarget); var jumped = !!REVIEW_SCROLL_TO; // 9.42
  teacherFeedbackTarget = null; teacherFeedbackData = null; showTeacherReview();
  if (!jumped) requestAnimationFrame(function(){ window.scrollTo(0, reviewScroll); });
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
/* 9.41.1: ملف إعادة تغيّر بعد توقيع المعلم: يُعرض التسجيل بلا قرار ولا ملاحظة ولا تعليق صوتي */
function returnTampered(){ return PACK_DATA.packageType === 'student_returned' && RETURN_TRUST === 'invalid'; }
function tfItemHTMLInner(id, text, type, packStatus, localStatus){
  if (returnTampered()) packStatus = 'pending';
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
