/* ===== 9.25: قناة الرد، ولوحة المتابعة للمعلم، وملخص ولي الأمر ===== */
var REPLY_CHANNELS = {text: '📝 نص', audio: '🎙️ صوت', both: '📝🎙️ نص وصوت'};
function setReplyChannel(ev){
  var v = ev.target.value; if (!REPLY_CHANNELS[v]) return;
  PACK_DATA.replyChannel = v; showTeacherReview();
}
async function rosterSaveCurrent(){
  try {
    var roster = (await keyDbGet('roster')) || {};
    var sid = String(PACK_DATA.studentId || PACK_DATA.studentName || 'unknown').slice(0, 64);
    var pend = Object.keys(PACK_DATA.studentAudios || {}).filter(function(k){ return (PACK_DATA.studentAudios[k] || {}).status === 'pending'; }).length;
    var sa = PACK_DATA.studentAssessment || {};
    var prev = roster[sid] || {};
    roster[sid] = {name: String(PACK_DATA.studentName || '').slice(0, 60), at: new Date().toISOString(), receivedAt: prev.receivedAt || new Date().toISOString(), deletedAt: prev.deletedAt || null, submittedAt: PACK_DATA.submittedAt || null,
      pending: pend, rated: Object.keys(PACK_DATA.teacherRatings || {}).length, mastered: (sa.mastered || []).length, pendingConcepts: (sa.pending || []).length, escalated: (sa.escalated || []).slice(0, 10)};
    await keyDbPut('roster', roster);
  } catch(e){ console.warn('roster', e); }
}
async function openRoster(){
  var roster = (await keyDbGet('roster')) || {};
  var ids = Object.keys(roster);
  var ov = document.createElement('div');
  ov.id = 'roster-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:520px;width:100%;padding:18px;max-height:90vh;overflow:auto';
  var rows = ids.map(function(id){
    var r = roster[id]; var overdue = r.submittedAt && assessTeacherReplyOverdue(r.submittedAt, new Date().toISOString());
    return '<div data-style="border:1px solid #e3e8ef;border-radius:12px;padding:10px;margin:8px 0"><b>' + escapeHTML(r.name || id) + '</b>' +
      '<div data-style="font-size:.85rem;color:#555">تسجيلات معلقة: ' + r.pending + ' · مُقيَّمة: ' + r.rated + ' · مفاهيم متقنة: ' + r.mastered + '/' + (r.mastered + r.pendingConcepts) +
      (r.escalated && r.escalated.length ? ' · محالة: ' + escapeHTML(r.escalated.join('، ')) : '') + (overdue ? ' · <span data-style="color:#b3261e">⏰ تجاوز 48 ساعة</span>' : '') + '</div>' +
      (retentionDue(r, new Date().toISOString()) ? '<div data-style="font-size:.85rem;color:#8a4b00;margin-top:6px">⏳ مرّ ' + TEACHER_RETENTION_DAYS + ' يومًا على استلام هذا الإرسال. احذف الملف الذي فتحته من جهازك، ثم اضغط: <button type="button" class="btn" data-call="' + escAttrSafe(JSON.stringify(['markRosterDeleted', id])) + '">تم الحذف</button></div>' : (r.deletedAt ? '<div data-style="font-size:.8rem;color:#2e7d32">✔ حُذف من الجهاز بتاريخ ' + escAttrSafe(new Date(r.deletedAt).toLocaleDateString('ar')) + '</div>' : '')) + '</div>';
  }).join('') || '<p>لا توجد إرسالات محفوظة بعد. تُضاف الإرسالات عند فتحها في شاشة المراجعة.</p>';
  card.innerHTML = '<h3 data-style="margin:0 0 8px">📋 لوحة المتابعة</h3>' + rows + '<div data-style="text-align:left"><button type="button" id="roster-close" class="btn">إغلاق</button></div>';
  ov.appendChild(card); document.body.appendChild(ov);
  document.getElementById('roster-close').onclick = function(){ ov.remove(); };
}
function buildParentSummary(){
  var st = STATE.assess || {}; var mastered = [], pending = [];
  var secs = (CURRICULUM || []).filter(function(s){ return !s._synthetic; });
  secs.forEach(function(s){ var c = (st.concepts || {})[s.id]; if (c && c.mastered) mastered.push(s.title); else pending.push(s.title); });
  var rc = {mastered: 0, good: 0, needs: 0, unusable: 0};
  Object.keys(PACK_DATA.teacherRatings || {}).forEach(function(k){ var v = normRating(PACK_DATA.teacherRatings[k]); if (rc[v] !== undefined) rc[v]++; });
  var lines = ['ملخص الأسبوع — ' + (STATE.student && STATE.student.name || ''), '', 'أحكام أتقنها: ' + (mastered.length ? mastered.join('، ') : 'لا يوجد بعد'), 'أحكام قيد التدريب: ' + (pending.length ? pending.join('، ') : 'لا يوجد'), '',
    'تقييم المعلم للتلاوة: متقن ' + rc.mastered + ' · جيد ' + rc.good + ' · يحتاج تدريبًا ' + rc.needs + (rc.unusable ? ' · لا يصلح للتقييم ' + rc.unusable : ''), '', 'ملاحظة: هذا الملخص لا يتضمن أي تسجيل صوتي.'];
  return lines.join('\n');
}
function showParentSummary(){
  var txt = buildParentSummary();
  var ov = document.createElement('div');
  ov.id = 'parent-summary';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  ov.innerHTML = '<div data-style="background:#fff;color:#222;border-radius:18px;max-width:480px;width:100%;padding:18px"><h3 data-style="margin:0 0 8px">📄 ملخص لولي الأمر</h3><textarea rows="12" readonly data-style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cfd8dc;border-radius:12px;font:inherit">' + escapeHTML(txt) + '</textarea><div data-style="text-align:left;margin-top:8px"><button type="button" id="ps-close" class="btn">إغلاق</button></div></div>';
  document.body.appendChild(ov);
  document.getElementById('ps-close').onclick = function(){ ov.remove(); };
}
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

async function exportApprovedPack(){
  try {
    var st0 = await teacherSigningStatus();
    if (!st0.ok && !confirm(st0.text + '\n\nهل تريد الإصدار على أي حال؟')) return;
  } catch(e){}
  var approvedCount = 0;
  var approvedAudios = {};
  Object.keys(PACK_DATA.studentAudios || {}).forEach(function(k){
    var r = PACK_DATA.studentAudios[k];
    if (r.status === 'approved'){
      approvedAudios[k] = {audio: r.audio, status: 'approved'};
      approvedCount++;
    }
  });
  var totalSubmitted = Object.keys(PACK_DATA.studentAudios || {}).length;
  /* 9.39.5 (R08 — قرار المالك): يجوز الإهداء الجزئي، بشرط تسجيل معتمد واحد على الأقل، وبيان صريح بما يتضمنه وما سيتعلمه المهدى إليه */
  if (approvedCount === 0){ alert('لا يمكن إصدار الإهداء: لا يوجد أي تسجيل معتمد بعد.'); return; }
  var _c = PACK_DATA.studentConsent || {};
  var _share = !!(_c.v === 2 && _c.permissions && _c.permissions.shareWithPeers === true);
  var _excl = _c.excludedRecordings || {}, _own = {};
  if (_share) Object.keys(approvedAudios).forEach(function(k){ if (!_excl[k]) _own[k] = approvedAudios[k]; });
  /* 9.39.11 (ق1-ب): لا ينتقل من تسجيلات الزملاء الموروثة إلا ما يحمل شهادة صحيحة من معلم مسجَّل */
  var _inhAll = normalizePeerGroups().filter(function(g){ return g && g.shareable === true; }), _inherited = [], _dropped = [];
  for (var _gi = 0; _gi < _inhAll.length; _gi++){ var _gs = await verifyPeerGroup(_inhAll[_gi]); if (_gs === 'verified') _inherited.push(_inhAll[_gi]); else _dropped.push((_inhAll[_gi].name || 'زميل') + ' (' + (PEER_WHY[_gs] || _gs) + ')'); }
  var preview = buildGiftContents(_inherited.concat([{audios: _own}]), PACK_DATA.masterAudios);
  var notIncluded = totalSubmitted - approvedCount;
  var msg = '🎁 ما يتضمنه الإهداء:\n' + giftContentsText(preview) +
    (notIncluded ? '\n\nلن يدخل الإهداء ' + notIncluded + ' تسجيل لم يُعتمد بعد (قيد المراجعة أو مرفوض).' : '') +
    (!_share ? '\n\nℹ️ ولي أمر الطالب لم يأذن بمشاركة تسجيلاته، فلن تدخل تسجيلاته الإهداء.' : '') +
    (_dropped.length ? '\n\n⚠️ لن تنتقل تسجيلات زملاء موروثة: ' + _dropped.join('، ') + '.' : '') +
    (REF_HIDDEN ? '\n\n⚠️ المادة المرجعية في هذا الملف غير موقّعة من مشرف مسجَّل؛ لن تنتقل تلاوات الشيخ ولا أسماء المرجع.' : '') +
    '\n\nهل تريد إصدار الإهداء بهذا المحتوى؟';
  /* 9.39.10: كان البيان (20 سطرًا وأكثر) في confirm المتصفح، فيُقطع في WebView أندرويد ولا يُقرأ */
  var go = await new Promise(function(res){
    showModal('🎁 قبل إصدار الإهداء', msg, [
      {label: '🎁 إصدار الإهداء', class: 'primary', action: function(){ closeModal(); res(true); }},
      {label: 'إلغاء', class: 'ghost', action: function(){ closeModal(); res(false); }}
    ]);
  });
  if (!go) return;
  await buildAndDownload({
    studentAudios: approvedAudios,
    packageType: 'approved_gift',
    approved: true,
    teacherFeedbacks: {},
    inheritedGroups: _inherited,
    filename: 'إعداد_المشرف.html',
    successMessage: 'تم إنشاء إعداد المشرف المعتمد. شاركه مع الطالب المستفيد.'
  });
}

async function exportReturnedPack(){
  var rejectedCount = 0;
  Object.keys(PACK_DATA.studentAudios || {}).forEach(function(k){
    if (PACK_DATA.studentAudios[k].status === 'rejected') rejectedCount++;
  });
  if (rejectedCount === 0){
    if (!confirm('لا توجد تسجيلات مرفوضة. سيُعاد الملف بحالات المراجعة الحالية.\n\nمتابعة؟')) return;
  }
  var missingFeedback = [];
  Object.keys(PACK_DATA.studentAudios || {}).forEach(function(k){
    var r = PACK_DATA.studentAudios[k];
    if (r.status === 'rejected' && !(r.feedback || (PACK_DATA.teacherFeedbacks && PACK_DATA.teacherFeedbacks[k]) || (PACK_DATA.teacherNotes && PACK_DATA.teacherNotes[k]))) missingFeedback.push(k);
  });
  if (missingFeedback.length){ alert('لا يمكن إعادة الملف: اكتب أو سجّل تعليقًا لكل تسجيل مرفوض. العناصر: ' + missingFeedback.join('، ')); return; }
  var feedbacks = {};
  Object.keys(PACK_DATA.studentAudios || {}).forEach(function(k){
    var r = PACK_DATA.studentAudios[k];
    if (r.status === 'rejected' && (r.feedback || (PACK_DATA.teacherFeedbacks && PACK_DATA.teacherFeedbacks[k]))) feedbacks[k] = r.feedback || PACK_DATA.teacherFeedbacks[k];
  });
  var notes = {};
  Object.keys(PACK_DATA.studentAudios || {}).forEach(function(k){
    var r2 = PACK_DATA.studentAudios[k];
    if (r2.status === 'rejected' && PACK_DATA.teacherNotes && PACK_DATA.teacherNotes[k]) notes[k] = String(PACK_DATA.teacherNotes[k]).slice(0, 400);
  });
  await buildAndDownload({
    studentAudios: PACK_DATA.studentAudios,
    packageType: 'student_returned',
    approved: false,
    teacherFeedbacks: feedbacks,
    teacherNotes: notes,
    filename: 'إعادة_للطالب_' + (PACK_DATA.studentName || 'طالب') + '.html',
    successMessage: 'تم إنشاء ملف العودة للطالب وتنزيله على جهاز المعلم. أرسله للطالب عبر وسيلة مشاركة مناسبة.'
  });
}

async function buildAndDownload(opts){
  // The app is a self-contained HTML file; serialize the current document directly.
  

  var isGiftExport = (opts.packageType === 'approved_gift' || opts.approved === true);
  /* 9.39.10: الاسم المكتوب في الحقل الآن أولًا (كان يُهمل إن كُتب بعد الاعتماد فيصدر الإهداء باسم «المعلم») */
  var effectiveTeacherName = (($('review-teacher-name') && $('review-teacher-name').value.trim()) || TEACHER_STATE.name || PACK_DATA.teacherName || '');
  if (effectiveTeacherName){ PACK_DATA.teacherName = effectiveTeacherName; TEACHER_STATE.name = effectiveTeacherName; }
  var effectiveTeacherGender = PACK_DATA.teacherGender || 'boy';
  var effectiveTeacherPhoto = PACK_DATA.teacherPhoto || null;
  var newPack = Object.assign({}, PACK_DATA, {
    supervisorName: (PACK_DATA.supervisorName || ''),
     teacherName: effectiveTeacherName,
     teacherGender: effectiveTeacherGender,
     teacherPhoto: effectiveTeacherPhoto,
    supervisorPhoto: PACK_DATA.supervisorPhoto || null,
    studentAudios: opts.studentAudios,
    packageType: opts.packageType || (opts.approved ? 'approved_gift' : 'student_returned'),
    approved: opts.approved,
    teacherFeedbacks: opts.teacherFeedbacks,
    teacherNotes: opts.teacherNotes || {},
    appVersion: APP_VERSION,
    sourceAppVersion: PACK_SOURCE_VERSION,
    schemaVersion: SCHEMA_VERSION
  });
  // بيانات الطفل الأصلي لا تُنقل إلى ملف الإهداء: الموافقة الأبوية ملك لصاحبها وحده
  newPack.studentConsent = null;
  if (newPack.packageType === 'student_returned' || isGiftExport) newPack.teacherRepliedAt = new Date().toISOString();
  // توقيع الاعتماد يخص حزمة الاعتماد وحدها، ولا يُنقل إلى أي حزمة أخرى
  if (!isGiftExport) newPack.signature = null;
  if (isGiftExport){
    // The recipient must enter a completely new identity when opening the gift.
    /* 9.39 (R07): بيانات الطفل الخاصة لا تنتقل إلى الإهداء إطلاقًا، واسمه وصورته فقط عند إذن المشاركة */
    ['studentName','studentId','studentPhoto','studentGender','studentAssessment','teacherRatings','teacherOtherRules','teacherNotes','teacherFeedbacks','reviewCount','submissionVersion','teacherRepliedAt','studentConsent'].forEach(function(k){ delete newPack[k]; });
    var _gc = PACK_DATA.studentConsent || {};
    var _gShare = !!(_gc.v === 2 && _gc.permissions && _gc.permissions.shareWithPeers === true);
    newPack.sourceGiftStudentName = _gShare ? (PACK_DATA.studentName || '') : '';
    newPack.sourceGiftStudentPhoto = _gShare ? (PACK_DATA.studentPhoto || null) : null;
    newPack.sourceGiftStudentGender = _gShare ? (PACK_DATA.studentGender || 'boy') : 'boy';
    // القرار DECISION-001: لا تُضمَّن أي تسجيلات إلا بإذن مشاركة صريح، والمجموعات القديمة بلا علامة إذن تُستبعد
    // 9.39.11 (ق1-ب): المجموعات الموروثة هي التي تحققت شهادتها في exportApprovedPack، وتنتقل بحقولها كما شُهدت
    var inheritedGroups = (opts.inheritedGroups || []).map(function(g){ return {id: g.id, name: g.name, gender: g.gender, photo: g.photo || null, audios: g.audios || {}, shareable: true, cert: g.cert}; });
    var ownCons = PACK_DATA.studentConsent || {};
    var ownShare = !!(ownCons.v === 2 && ownCons.permissions && ownCons.permissions.shareWithPeers === true);
    var ownExcluded = ownCons.excludedRecordings || {};
    var ownAudios = {};
    Object.keys(opts.studentAudios || {}).forEach(function(k){ if (!ownExcluded[k]) ownAudios[k] = opts.studentAudios[k]; });
    var currentGroup = {id: PACK_DATA.studentId || PACK_DATA.packageId || PACKAGE_ID, name: PACK_DATA.studentName || '', gender: PACK_DATA.studentGender || 'boy', photo: PACK_DATA.studentPhoto || null, audios: ownAudios, shareable: ownShare};
    if (!ownShare){ console.info('DECISION-001: لم تُضمَّن تسجيلات الطالب في الإهداء (لا إذن مشاركة).'); }
    var mergedGroups = inheritedGroups.filter(function(g){ return g.id !== currentGroup.id; });
    if (ownShare && Object.keys(ownAudios).length){
      try { currentGroup.cert = await signPeerGroup(currentGroup); } catch(e){ alert('تعذّر توقيع تسجيلات الطالب: ' + e.message); return; }
      mergedGroups.push(currentGroup);
    }
    newPack.approvedPeerRecordings = mergedGroups;
    newPack.giftContents = buildGiftContents(mergedGroups, newPack.masterAudios || PACK_DATA.masterAudios); // 9.39.5/9.39.6: يدخل في التوقيع v4
    newPack.approvedStudentAudios = {}; // audio lives once, inside approvedPeerRecordings
    newPack.studentAudios = {};
    newPack.studentName = '';
    newPack.studentGender = 'boy';
    newPack.studentPhoto = null;
    newPack.studentId = '';
    newPack.reviewCount = 0;
    newPack.submissionVersion = 0;
    newPack.recipientSetupRequired = true;
    newPack.recipientStudentAudios = {};
  }

  applyRefExport(newPack); // 9.39.11 (ق1-ب): المادة المرجعية كما وصلت (بشهادتها) أو بلا شهادة إن لم تُوثَّق
  if (isGiftExport) newPack.giftContents = buildGiftContents(newPack.approvedPeerRecordings || [], newPack.masterAudios);
  if (isGiftExport || newPack.packageType === 'student_returned'){ try { await signGiftPack(newPack); } catch(e){ alert('تعذّر توقيع الحزمة: ' + e.message); return; } }
  var packJSON = JSON.stringify(newPack).replace(/<\//g, '<\\/');
  var newBlock = '/* ===PACK_DATA_START=== */\nvar PACK_DATA = ' + packJSON + ';\n/* ===PACK_DATA_END=== */';
  if (TEMPLATE_HEAD === null){ alert('تعذر تجهيز قالب التصدير النظيف. أعد فتح الملف ثم حاول مرة أخرى.'); return; }
  var replaced = TEMPLATE_HEAD + newBlock + TEMPLATE_TAIL;
 replaced = await cspWithScriptHash(replaced);
  var byteSize = new Blob([replaced]).size; // حجم البايتات الفعلي لا طول السلسلة
  if (byteSize > MAX_HTML_WARN_BYTES && !confirm('حجم الملف الناتج ' + Math.round(byteSize/1048576) + ' ميغابايت، وقد يتعذر إرساله عبر تطبيقات المراسلة. هل تريد المتابعة؟')) return;

  var blob = new Blob([replaced], {type: 'text/html;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (isGiftExport ? 'إعداد_المشرف.html' : opts.filename.replace(/[\\/:*?"<>|]/g, '_'));
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);

  showModal('🎉 تم تجهيز الملف وتنزيله', (opts.successMessage || 'حجم الملف: ' + Math.round(byteSize / 1024) + ' كيلوبايت.') + '\n\nتنبيه: لا يُرسل الملف تلقائيًا؛ شاركه يدويًا مع الشخص المقصود.',
    [{label: '👍', class: 'success', action: closeModal}]);
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

function tfItemHTML(id, text, type, packStatus, localStatus){ var h = tfItemHTMLInner(id, text, type, packStatus, localStatus), x = studentRatingNote(id); return x ? h.replace(/<\/div>\s*$/, x + '</div>') : h; } // 9.39.15 (ق6)
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

function showExportDialog(exportKind){
  exportKind = exportKind || 'submission';
  if (exportKind === 'gift'){ showModal('🎁 الإهداء', 'الإهداء يصدره المعلم بعد مراجعة التسجيلات والتحقق من إذن ولي الأمر بالمشاركة. أرسل تسجيلاتك للمعلم.', [{label: 'حسنًا', class: 'primary', action: closeModal}]); return; } // 9.39.12 (O3)
  if (!STATE.student.name){ alert('أكمل بياناتك أولاً.'); return; }
  var recCount = Object.keys(STATE.studentAudios).length;
  if (recCount === 0){
    showModal('لا يمكن الإصدار', 'لم تسجّل شيئاً بعد.', [{label: 'حسناً', class: 'primary', action: closeModal}]);
    return;
  }
  showModal(exportKind === 'gift' ? '🎓 تصدير إعداد المشرف' : '📨 إرسال للمراجعة', 'سيتم تضمين ' + recCount + ' تسجيل في ' + (exportKind === 'gift' ? 'إعداد المشرف' : 'ملف المراجعة') + '.', [
    {label: exportKind === 'gift' ? '🎓 تصدير إعداد المشرف' : '📨 إرسال للمعلم', class: exportKind === 'gift' ? 'gold' : 'primary', action: function(){ doExportStudent(exportKind); }},
    {label: 'إلغاء', class: 'ghost', action: closeModal}
  ]);
}

/* 9.39: عنوان مقروء للعنصر في صفحة المعلم بدل المعرّف الخام */
function itemLabelById(id){
  for (var i = 0; i < CURRICULUM.length; i++){
    var sec = CURRICULUM[i];
    var its = (sec.items || []).concat(sec.questions || []);
    for (var j = 0; j < its.length; j++){
      if (its[j].id !== id) continue;
      var txt = '';
      var raw = String(its[j].text || its[j].ayah || '').replace(/<br\s*\/?>/gi, ' ').replace(/<\/(span|div|p)>/gi, ' ');
      try { var d = new DOMParser().parseFromString('<body>' + raw, 'text/html'); txt = (d.body.textContent || '').replace(/\s+/g, ' ').trim(); } catch(e){}
      if (txt.length > 48) txt = txt.slice(0, 48) + '…';
      return (sec.title || '') + (txt ? ' · ' + txt : ''); /* 9.39.10: بلا المعرّف الداخلي */
    }
  }
  return String(id);
}
function arabicReviewOrdinal(n){
  var ones=['','الأولى','الثانية','الثالثة','الرابعة','الخامسة','السادسة','السابعة','الثامنة','التاسعة','العاشرة'];
  if (ones[n]) return ones[n];
  if (n===11) return 'الحادية عشرة'; if (n===12) return 'الثانية عشرة';
  return 'رقم ' + n;
}

async function doExportStudent(exportKind){
  exportKind = exportKind || 'submission';
  /* 9.39.12 (O3): كان هذا المسار يصدّر تسجيلات الطفل واسمه وصورته في «إهداء» غير موقّع دون فحص إذن المشاركة */
  if (exportKind === 'gift'){ showExportDialog('gift'); return; }
  /* 9.39.3 (R11): لا إرسال لتسجيلات طفل دون موافقة ولي أمر سارية، أيًّا كان المسار الذي استُدعيت منه الدالة */
  if (exportKind !== 'gift' && Object.keys(STATE.studentAudios || {}).length && !hasConsent()){ closeModal(); ensureConsent(function(){ doExportStudent(exportKind); }); return; }
  closeModal();
  var btn = $('btn-export-home');
  if (!btn) btn = $('btn-reexport');
  var orig = btn ? btn.textContent : '🎁';
  if (btn) btn.disabled = true;
  try {
    // Never block export because an older package version is being re-exported.
    // The new package is always stamped with the current application/schema version.
    PACK_DATA.appVersion = APP_VERSION;
    PACK_DATA.schemaVersion = SCHEMA_VERSION;
    if (btn) btn.textContent = '⏳ فحص حجم البيانات...';
    var rawBytes = 0;
    var idsForSize = Object.keys(STATE.studentAudios || {});
    for (var si=0; si<idsForSize.length; si++){ var sb = await dbGet(idsForSize[si]); if (sb) rawBytes += sb.size || 0; }
    if (rawBytes > 20 * 1024 * 1024){ alert('حجم التسجيلات المحلية كبير جدًا (' + Math.round(rawBytes/1024/1024) + ' MB). الحد الآمن لملف HTML واحد هو 20 MB من الصوت الخام.'); return; }
    // Keep export independent from fetch/file:// restrictions.
    

    if (btn) btn.textContent = '⏳ تحويل التسجيلات...';
    var studentAudiosOut = {};
    var packRecords = PACK_DATA.studentAudios || {};
    var approvedReferenceAudios = PACK_DATA.approvedStudentAudios || {};
    var allPackIds = Object.keys(packRecords);
    if (exportKind === 'gift') {
      var allApproved = allPackIds.length > 0 && allPackIds.every(function(k){ return packRecords[k] && packRecords[k].status === 'approved'; });
      if (!allApproved){ alert('إعداد المشرف متاح بعد اعتماد جميع التسجيلات الموجودة في الملف.'); return; }
      allPackIds.forEach(function(k){ if (packRecords[k] && packRecords[k].status === 'approved') studentAudiosOut[k] = {audio:packRecords[k].audio, status:'approved'}; });
    } else {
      // The teacher must review only the current learner's recordings.
      // Approved recordings from the giver are carried separately as approvedStudentAudios.
      var ids = Object.keys(STATE.studentAudios || {});
      for (var i = 0; i < ids.length; i++){
        var id = ids[i];
        if (btn) btn.textContent = '⏳ ' + (i + 1) + '/' + ids.length;
        var prevRec = packRecords[id];
        var localRec = STATE.studentAudios[id] || {};
        /* 9.39.5 (R09): التسجيل المعتمد سابقًا يُحمل كما هو (بصوته وحالته ونسخته) ما لم يُعد الطفل تسجيله بعد الاعتماد */
        var reRecorded = !!(prevRec && isNewerLocalRecording(localRec, prevRec)); // 9.39.6: بالمعرّف لا بالساعة
        if (PACK_DATA.packageType !== 'approved_gift' && STATE.role !== 'friend' && prevRec && prevRec.status === 'approved' && !reRecorded){
          if (prevRec.audio) studentAudiosOut[id] = {audio: prevRec.audio, status: 'approved', v: prevRec.v || ''};
          continue;
        }
        var blob = await dbGet(id);
        if (blob) {
          studentAudiosOut[id] = {audio: await blobToBase64(blob), status:'pending', partial: !!localRec.partial, v: localRec.rid || localRec.updatedAt || ''};
        } else if (prevRec && prevRec.audio) {
          studentAudiosOut[id] = {audio:prevRec.audio, status:prevRec.status === 'rejected' ? 'rejected' : 'pending', partial: prevRec.partial === true, v: prevRec.v || ''};
        }
      }
      var newForReview = Object.keys(studentAudiosOut).filter(function(k){ return studentAudiosOut[k].status !== 'approved'; }).length;
      if (!newForReview && !(exportKind !== 'gift' && STATE.assess && STATE.assess.lastExam)){ alert('لا توجد تسجيلات جديدة أو نتائج اختبار للإرسال. التسجيلات المعتمدة سابقًا محفوظة لدى المعلم.'); return; }
    }

    var isGiftRecipient = PACK_DATA.packageType === 'approved_gift' && !!STATE.student.name;
    var exportStudentId = (isGiftRecipient ? (STATE.student.id || ('stu_' + simpleHash((PACK_DATA.packageId || PACKAGE_ID) + '|recipient|' + STATE.student.name.trim().toLowerCase()))) : (PACK_DATA.studentId || STATE.student.id || ('stu_' + simpleHash(PACKAGE_ID + '|' + STATE.student.name.trim().toLowerCase()))));
    var exportPackageId = ((isGiftRecipient || STATE.role === 'friend') && exportKind !== 'gift') ? ('sub_' + simpleHash(PACKAGE_ID + '|' + exportStudentId + '|' + STATE.student.name)) : PACKAGE_ID;
    var fullPack = {
      packageId: exportPackageId,
      sourceGiftPackageId: PACK_DATA.packageType === 'approved_gift' ? (PACK_DATA.packageId || PACKAGE_ID) : (PACK_DATA.sourceGiftPackageId || ''),
      sourceGiftStudentName: (exportKind === 'gift' ? (STATE.student.name || PACK_DATA.studentName || '') : (PACK_DATA.packageType === 'approved_gift' ? (PACK_DATA.sourceGiftStudentName || PACK_DATA.studentName || '') : (PACK_DATA.sourceGiftStudentName || ''))),
      sourceGiftStudentPhoto: (exportKind === 'gift' ? (STATE.student.photo || PACK_DATA.studentPhoto || null) : (PACK_DATA.sourceGiftStudentPhoto || null)),
      packageType: exportKind === 'gift' ? 'approved_gift' : 'student_submission',
      reviewCount: (Number(PACK_DATA.reviewCount || PACK_DATA.submissionVersion) || 0) + 1,
      submissionVersion: (Number(PACK_DATA.submissionVersion || PACK_DATA.reviewCount) || 0) + 1,
      schemaVersion: SCHEMA_VERSION,
      sheikhName: PACK_DATA.sheikhName,
      poemReciterName: PACK_DATA.poemReciterName || '',
      journeyTitle: PACK_DATA.journeyTitle || 'رفاق التحفة',
      projectTitle: PACK_DATA.projectTitle || 'رحلة طالب العلم',
      trackTitle: PACK_DATA.trackTitle || 'في رحاب القرآن',
      seriesTitle: PACK_DATA.seriesTitle || 'سلسلة التجويد',
      sheikhPhoto: PACK_DATA.sheikhPhoto,
      schoolName: PACK_DATA.schoolName,
      schoolLogo: PACK_DATA.schoolLogo,
      welcomeAudioNeutral: PACK_DATA.welcomeAudioNeutral,
      welcomeAudioMale: PACK_DATA.welcomeAudioMale,
      welcomeAudioFemale: PACK_DATA.welcomeAudioFemale,
      masterAudios: PACK_DATA.masterAudios,
      appVersion: APP_VERSION,
      sourceAppVersion: PACK_SOURCE_VERSION,
      studentId: exportStudentId,
      studentName: exportKind === 'gift' ? '' : STATE.student.name,
      studentConsent: exportKind === 'gift' ? null : consentForExport(),
      studentAssessment: exportKind === 'gift' ? null : assessForExport(),
      submittedAt: exportKind === 'gift' ? null : new Date().toISOString(),
      studentGender: exportKind === 'gift' ? 'boy' : STATE.student.gender,
      studentPhoto: exportKind === 'gift' ? null : STATE.student.photo,
      supervisorName: PACK_DATA.supervisorName || PACK_DATA.sheikhName || '',
      supervisorPhoto: PACK_DATA.supervisorPhoto || null,
      supervisorGender: PACK_DATA.supervisorGender || 'boy',
      poemReciterPhoto: PACK_DATA.poemReciterPhoto || null,
      studentAudios: studentAudiosOut,
      approvedStudentAudios: {}, // single source: approvedPeerRecordings
      trustedTeacherKeys: Array.isArray(PACK_DATA.trustedTeacherKeys) ? PACK_DATA.trustedTeacherKeys : [], // 9.39 (R06): سلسلة الثقة كانت تنقطع هنا
      approvedPeerRecordings: normalizePeerGroups(),
      teacherName: PACK_DATA.teacherName || '',
      teacherGender: PACK_DATA.teacherGender || 'boy',
      teacherPhoto: PACK_DATA.teacherPhoto || null,
      teacherFeedbacks: {},
      curriculum: CURRICULUM,
      isDemo: false,
      approved: exportKind === 'gift'
    };
    applyRefExport(fullPack); // 9.39.11 (ق1-ب)

    if (btn) btn.textContent = '⏳ بناء الملف...';
    var packJSON = JSON.stringify(fullPack).replace(/<\//g, '<\\/');
    var newBlock = '/* ===PACK_DATA_START=== */\nvar PACK_DATA = ' + packJSON + ';\n/* ===PACK_DATA_END=== */';
    if (TEMPLATE_HEAD === null){ alert('تعذر تجهيز قالب التصدير النظيف. أعد فتح الملف ثم حاول مرة أخرى.'); return; }
    var replaced = TEMPLATE_HEAD + newBlock + TEMPLATE_TAIL;
    replaced = await cspWithScriptHash(replaced);
    var byteSize = new Blob([replaced]).size; // حجم البايتات الفعلي لا طول السلسلة
    if (byteSize > MAX_HTML_WARN_BYTES && !confirm('حجم الملف الناتج ' + Math.round(byteSize/1048576) + ' ميغابايت، وقد يتعذر إرساله عبر تطبيقات المراسلة. هل تريد المتابعة؟')) return;

    var safe = STATE.student.name.replace(/[\\/:*?"<>|]/g, '_');
    var reviewRound = (Number(PACK_DATA.reviewCount || PACK_DATA.submissionVersion) || 0) + 1;
    var reviewOrdinal = arabicReviewOrdinal(reviewRound);
    var blob = new Blob([replaced], {type: 'text/html;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = (exportKind === 'gift' ? 'إعداد_المشرف_' : 'إرسال_للمراجعة_' + reviewOrdinal + '_') + safe + '.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
    var sizeKB = Math.round(byteSize / 1024);
    if (exportKind !== 'gift'){ try { var _now = new Date().toISOString(); Object.keys(fullPack.studentAudios || {}).forEach(function(k){ if (STATE.studentAudios[k] && fullPack.studentAudios[k].status === 'pending') STATE.studentAudios[k].sentAt = _now; }); save(); } catch(e){} }
    showModal('🎉 تم تجهيز الملف وتنزيله', (exportKind === 'gift' ? 'تم إنشاء إعداد المشرف المعتمد. شاركه مع الطالب المستفيد.' : 'تم إنشاء ملف المراجعة رقم ' + reviewRound + ' وتنزيله على جهازك. أرسله إلى المعلم') + ' · الحجم: ' + sizeKB + ' كيلوبايت.\n\nلا يُرسل الملف تلقائيًا.', [{label: '👍', class: 'success', action: closeModal}]);
  } catch(e){
    alert('فشل الإصدار: ' + e.message);
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = orig; }
  }
}

/* الشهادة */
function hashString(str){ var h = 0; for (var i = 0; i < str.length; i++){ h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return h; }
function generateCertId(){
  var d = new Date();
  var s = d.getFullYear().toString() + (d.getMonth()+1).toString().padStart(2,'0') + d.getDate().toString().padStart(2,'0');
  var h = Math.abs(hashString((STATE.student.name || '') + s)).toString(36).toUpperCase().slice(0, 6);
  return 'TTA-' + s + '-' + h;
}
function certLevel(){
  var secs = realSections(), cs = (STATE.assess && STATE.assess.concepts) || {};
  var mastered = secs.filter(function(s){ return cs[s.id] && cs[s.id].mastered; }).length;
  var r = STATE.teacherRatings || {}, keys = Object.keys(r);
  keys = keys.filter(function(k){ var v = normRating(r[k]); return v && v !== 'unusable'; }); // 9.39.15 (ق6-هـ): «جيد» يكفي، و«لا يصلح» ليس تقييمًا
  return {allMastered: secs.length > 0 && mastered === secs.length, mastered: mastered, rated: keys.length, needs: keys.filter(function(k){ return normRating(r[k]) === 'needs'; }).length};
}
function buildCertData(){
  var s = STATE.student;
  var stats = STATE.stats;
  var _n = realSections().length;
  /* 9.39.11 (ق2-ب): «الإتقان» يعني إتقان كل المفاهيم في جولات القياس (لا نجوم الدروس)، مع تقييم معلم موثّق للتلاوة بلا «يحتاج تدريبًا» */
  var lv = certLevel(), isF = s.gender === 'girl';
  var isPerfect = lv.allMastered && lv.rated > 0 && lv.needs === 0;
  var W = function(m, f){ return isF ? f : m; };
  var desc = isPerfect ? W('أتمّ جميع أقسام منهج تحفة الأطفال، وأتقن أحكامها في الاختبار النهائي، واعتمد معلمه تلاوته.', 'أتمّت جميع أقسام منهج تحفة الأطفال، وأتقنت أحكامها في الاختبار النهائي، واعتمد معلمها تلاوتها.')
    : lv.allMastered ? (W('أتقن أحكام منهج تحفة الأطفال في الاختبار النهائي.', 'أتقنت أحكام منهج تحفة الأطفال في الاختبار النهائي.') + (lv.needs ? ' وتحتاج التلاوة تدريبًا في ' + arCount(lv.needs, 'موضع', 'موضعين', 'مواضع') + '.' : ' وتقييم المعلم للتلاوة لم يصل بعد.'))
    : (W('أتمّ ', 'أتمّت ') + stats.completedSections + ' من ' + _n + ' أقسام' + (lv.mastered ? '، ' + W('وأتقن ', 'وأتقنت ') + lv.mastered + ' من مفاهيمها.' : '.'));
  var now = new Date();
  var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return {
    name: s.name || '—',
    role: isPerfect ? (isF ? '🏆 بطلة المنهج بإتقان تام' : '🏆 بطل المنهج بإتقان تام') : lv.allMastered ? (isF ? '🏆 متقنة لأحكام المنهج' : '🏆 متقن لأحكام المنهج') : (isF ? '🏆 متقدمة في المنهج' : '🏆 متقدم في المنهج'),
    desc: desc, isF: isF,
    points: stats.totalPoints, completed: stats.completedSections,
    total: _n, perfect: lv.mastered,
    sheikhName: PACK_DATA.sheikhName || PACK_DATA.quranReciterName || '—',
    sheikhLabel: 'القارئ',
    supervisorName: STATE.student.supervisorName || '',
    supervisorLabel: STATE.student.supervisorGender === 'girl' ? 'بإشراف المعلمة' : 'بإشراف المعلم',
    schoolName: PACK_DATA.schoolName || '', schoolLogo: PACK_DATA.schoolLogo || null,
    date: 'حُرّرت في ' + now.getDate() + ' من ' + months[now.getMonth()] + ' ' + now.getFullYear() + 'م',
    certId: 'رقم الشهادة: ' + generateCertId(),
    sealText: isPerfect ? 'ختم الإتقان' : 'ختم الاعتماد',
    photo: s.photo, gender: s.gender
  };
}
function showCertificate(){
  var d = buildCertData();
  var ph = $('cert-photo');
  if (d.photo) ph.innerHTML = '<img data-media="' + mediaRef('img', d.photo) + '" alt="">';
  else ph.innerHTML = '<span class="emoji">' + (d.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️') + '</span>';
  $('cert-name').textContent = d.name;
  $('cert-role').textContent = d.role;
  $('cert-desc').textContent = d.desc;
  if (d.schoolName){
    $('cert-school-box').style.display = 'flex';
    $('cert-school-name').textContent = d.schoolName;
    var lb = $('cert-school-logo');
    if (d.schoolLogo) lb.innerHTML = '<img data-media="' + mediaRef('img', d.schoolLogo) + '" alt="">';
    else lb.innerHTML = '<div class="cert-school-logo-ph">🏫</div>';
  } else $('cert-school-box').style.display = 'none';
  $('cert-stats').innerHTML =
    '<div class="cert-stat"><div class="n">' + d.points + '</div><div class="l">نقطة</div></div>' +
    '<div class="cert-stat"><div class="n">' + d.completed + '/' + d.total + '</div><div class="l">أقسام</div></div>' +
    '<div class="cert-stat"><div class="n">' + d.perfect + '</div><div class="l">مفاهيم متقنة</div></div>';
  $('cert-sheikh-label').textContent = d.sheikhLabel;
  $('cert-sheikh-name').textContent = d.sheikhName;
  if (d.supervisorName){
    $('cert-supervisor-sign').style.display = 'block';
    $('cert-supervisor-label').textContent = d.supervisorLabel;
    $('cert-supervisor-name').textContent = d.supervisorName;
  } else $('cert-supervisor-sign').style.display = 'none';
  $('cert-seal').innerHTML = d.sealText.replace(' ', '<br>');
  $('cert-date').textContent = d.date;
  $('cert-id').textContent = d.certId;
  show('view-certificate');
  confetti(40);
}
function closeCertificate(){ show('view-home'); }
function printCertificate(){
  document.body.classList.add('printing-cert');
  var after = function(){ document.body.classList.remove('printing-cert'); window.removeEventListener('afterprint', after); };
  window.addEventListener('afterprint', after);
  setTimeout(function(){ window.print(); }, 100);
  setTimeout(after, 4000);
}
var LAST_CERT_BLOB = null;
function loadImage(src){
  return new Promise(function(resolve){
    if (!src){ resolve(null); return; }
    var img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = function(){ resolve(img); };
    img.onerror = function(){ resolve(null); };
    img.src = src;
  });
}
function roundRectPath(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawEmoji(ctx, emoji, x, y, size){
  ctx.save(); ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji",Tahoma';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y); ctx.restore();
}
function drawCenterText(ctx, text, x, y, maxWidth){
  var words = text.split(' '); var line = ''; var lineHeight = parseInt(ctx.font, 10) * 1.4; var cy = y;
  for (var i = 0; i < words.length; i++){
    var test = line + (line ? ' ' : '') + words[i];
    if (ctx.measureText(test).width > maxWidth && line){ ctx.fillText(line, x, cy); cy += lineHeight; line = words[i]; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
  return cy;
}
async function renderCertificateToBlob(){
  var d = buildCertData();
  var W = 1200, H = 1700, scale = 2;
  var canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  var ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  var bg = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, H);
  bg.addColorStop(0, '#fffbe6'); bg.addColorStop(1, '#fffdf5');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 6; ctx.strokeRect(20, 20, W-40, H-40);
  ctx.strokeStyle = '#FFC107'; ctx.lineWidth = 2; ctx.strokeRect(34, 34, W-68, H-68);
  ctx.strokeStyle = '#FFC10766'; ctx.lineWidth = 1; ctx.strokeRect(46, 46, W-92, H-92);
  ctx.font = '28px Tahoma'; ctx.fillStyle = '#b8860b';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦', 60, 80); ctx.textAlign = 'right'; ctx.fillText('✦', W-60, 80);
  ctx.textBaseline = 'bottom'; ctx.fillText('✦', W-60, H-50);
  ctx.textAlign = 'left'; ctx.fillText('✦', 60, H-50);
  drawEmoji(ctx, '🏅', W/2, 130, 100);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8b6f00'; ctx.font = 'bold 78px Tahoma'; ctx.fillText('شهادة إتقان', W/2, 260);
  ctx.fillStyle = '#6b7280'; ctx.font = 'bold 28px Tahoma'; ctx.fillText('منهج تحفة الأطفال', W/2, 305);
  var cy = 345;
  if (d.schoolName){
    var sbW = 460, sbH = 80; var sx = (W - sbW) / 2;
    ctx.fillStyle = '#fffdf5'; roundRectPath(ctx, sx, cy, sbW, sbH, 16); ctx.fill();
    ctx.strokeStyle = '#FFC10766'; ctx.lineWidth = 2; ctx.stroke();
    var logo = d.schoolLogo ? await loadImage(d.schoolLogo) : null;
    var lcx = sx + 55, lcy = cy + sbH/2;
    if (logo){ ctx.save(); ctx.beginPath(); ctx.arc(lcx, lcy, 26, 0, Math.PI*2); ctx.clip(); ctx.drawImage(logo, lcx-26, lcy-26, 52, 52); ctx.restore(); }
    else { ctx.fillStyle = '#283593'; ctx.beginPath(); ctx.arc(lcx, lcy, 26, 0, Math.PI*2); ctx.fill(); drawEmoji(ctx, '🏫', lcx, lcy+2, 30); }
    ctx.textAlign = 'right'; ctx.fillStyle = '#6b7280'; ctx.font = 'bold 16px Tahoma';
    ctx.fillText('بمدرسة', sx + sbW - 20, cy + 28);
    ctx.fillStyle = '#8b6f00'; ctx.font = 'bold 26px Tahoma';
    ctx.fillText(d.schoolName, sx + sbW - 20, cy + 60);
    ctx.textAlign = 'center'; cy += sbH + 25;
  }
  var divY = cy + 15;
  ctx.strokeStyle = '#FFC107'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W/2-140, divY); ctx.lineTo(W/2-30, divY);
  ctx.moveTo(W/2+30, divY); ctx.lineTo(W/2+140, divY);
  ctx.stroke();
  ctx.fillStyle = '#FFC107'; ctx.font = '24px Tahoma'; ctx.fillText('✿', W/2, divY+8);
  cy = divY + 40;
  var pcx = W/2, pcy = cy + 90, pr = 90;
  ctx.fillStyle = '#FFC107'; ctx.beginPath(); ctx.arc(pcx, pcy, pr+12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fffdf5'; ctx.beginPath(); ctx.arc(pcx, pcy, pr+8, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(pcx, pcy, pr+4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fffdf5'; ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI*2); ctx.fill();
  var ph = d.photo ? await loadImage(d.photo) : null;
  if (ph){ ctx.save(); ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI*2); ctx.clip(); ctx.drawImage(ph, pcx-pr, pcy-pr, pr*2, pr*2); ctx.restore(); }
  else drawEmoji(ctx, d.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️', pcx, pcy+5, 130);
  cy = pcy + pr + 50;
  ctx.fillStyle = '#6b7280'; ctx.font = 'bold 24px Tahoma'; ctx.textAlign = 'center';
  ctx.fillText('تتشرف هذه الشهادة بأن تمنح', W/2, cy);
  cy += 70;
  ctx.fillStyle = '#283593'; ctx.font = 'bold 76px Tahoma';
  ctx.fillText(d.name, W/2, cy);
  cy += 40;
  var roleTxt = d.role.replace('🏆 ', '').trim();
  ctx.font = 'bold 26px Tahoma';
  var rW = ctx.measureText(roleTxt).width + 60;
  var rH = 50; var rX = (W - rW) / 2; var rY = cy;
  var rg = ctx.createLinearGradient(rX, 0, rX + rW, 0);
  rg.addColorStop(0, '#FFC107'); rg.addColorStop(1, '#FFD54F');
  ctx.fillStyle = rg;
  roundRectPath(ctx, rX, rY, rW, rH, 25); ctx.fill();
  ctx.fillStyle = '#6b4d00'; ctx.textBaseline = 'middle';
  ctx.fillText(roleTxt, W/2, rY + rH/2 + 2);
  ctx.textBaseline = 'alphabetic';
  cy += rH + 55;
  ctx.fillStyle = '#374151'; ctx.font = '22px Tahoma';
  cy = drawCenterText(ctx, d.desc, W/2, cy, 820);
  cy += 65;
  drawEmoji(ctx, '⭐', W/2-80, cy, 60);
  drawEmoji(ctx, '⭐', W/2, cy, 60);
  drawEmoji(ctx, '⭐', W/2+80, cy, 60);
  cy += 70;
  var sD = [{n:String(d.points),l:'نقطة'},{n:d.completed+'/'+d.total,l:'أقسام'},{n:String(d.perfect),l:'إتقان'}];
  var bw = 160, bh = 90, gap = 16;
  var tw = sD.length*bw + (sD.length-1)*gap;
  var bx0 = (W - tw)/2;
  sD.forEach(function(s,i){
    var bx = bx0 + i*(bw+gap);
    ctx.fillStyle = '#fffdf5'; roundRectPath(ctx, bx, cy, bw, bh, 14); ctx.fill();
    ctx.strokeStyle = '#FFC10766'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#8b6f00'; ctx.font = 'bold 30px Tahoma'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.n, bx + bw/2, cy + 34);
    ctx.fillStyle = '#6b7280'; ctx.font = 'bold 15px Tahoma';
    ctx.fillText(s.l, bx + bw/2, cy + 66);
  });
  ctx.textBaseline = 'alphabetic';
  cy += bh + 40;
  ctx.strokeStyle = '#c5cae9'; ctx.lineWidth = 1.5; ctx.setLineDash([6,6]);
  ctx.beginPath(); ctx.moveTo(140, cy); ctx.lineTo(W-140, cy); ctx.stroke();
  ctx.setLineDash([]);
  cy += 40;
  var sigSlots = d.supervisorName
    ? [{x: W/2-200, label: d.sheikhLabel, name: d.sheikhName}, {x: W/2+200, label: d.supervisorLabel, name: d.supervisorName}]
    : [{x: W/2, label: d.sheikhLabel, name: d.sheikhName}];
  sigSlots.forEach(function(sig){
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b7280'; ctx.font = 'bold 16px Tahoma';
    ctx.fillText(sig.label, sig.x, cy);
    ctx.strokeStyle = '#28359344'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sig.x-100, cy+30); ctx.lineTo(sig.x+100, cy+30); ctx.stroke();
    ctx.fillStyle = '#283593'; ctx.font = 'bold 22px Tahoma';
    ctx.fillText(sig.name, sig.x, cy+60);
  });
  ctx.fillStyle = '#6b7280'; ctx.font = 'bold 18px Tahoma'; ctx.textAlign = 'center';
  ctx.fillText(d.date, W/2, H-110);
  ctx.fillStyle = '#9ca3af'; ctx.font = '15px monospace';
  ctx.fillText(d.certId, W/2, H-80);
  return new Promise(function(resolve){
    canvas.toBlob(function(blob){ resolve(blob); }, 'image/png', 0.95);
  });
}
function blobToDataURL(blob){
  return new Promise(function(resolve){
    var r = new FileReader();
    r.onload = function(){ resolve(r.result); };
    r.readAsDataURL(blob);
  });
}
async function ensureCertBlob(){
  if (LAST_CERT_BLOB) return LAST_CERT_BLOB;
  try { LAST_CERT_BLOB = await renderCertificateToBlob(); return LAST_CERT_BLOB; }
  catch(e){ alert('تعذر توليد صورة الشهادة'); return null; }
}
function showPreview(src){ $('preview-img').src = src; show('view-preview'); }
function closePreview(){ show('view-certificate'); }
async function shareCertificate(){
  var blob = await ensureCertBlob(); if (!blob) return;
  var url = await blobToDataURL(blob); showPreview(url);
}
async function doSharePreview(){
  var blob = LAST_CERT_BLOB;
  if (!blob){ toast('جارٍ التحضير...'); blob = await ensureCertBlob(); }
  if (!blob) return;
  var d = buildCertData();
  var file = new File([blob], 'شهادة_' + d.name + '.png', {type: 'image/png'});
  if (navigator.canShare && navigator.canShare({files: [file]})){
    try { await navigator.share({files: [file], title: 'شهادة إتقان'}); return; }
    catch(e){ if (e.name === 'AbortError') return; }
  }
  await downloadImageFallback(blob, d.name);
  toast('📋 نُسخت الشهادة');
}
async function downloadCertificate(){
  var blob = await ensureCertBlob(); if (!blob) return;
  await downloadImageFallback(blob, buildCertData().name);
}
async function downloadImageFallback(blob, name){
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'شهادة_' + name + '.png';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
  toast('💾 تم تنزيل الشهادة');
}
function doDownloadPreview(){ closePreview(); downloadCertificate(); }

function blobToBase64(blob){
  return new Promise(function(res, rej){
    var r = new FileReader();
    r.onload = function(){ res(r.result); };
    r.onerror = function(){ rej(r.error); };
    r.readAsDataURL(blob);
  });
}
function showModal(t, b, actions){
  $('modal-title').textContent = t;
  $('modal-body').textContent = b;
  var a = $('modal-actions'); a.innerHTML = '';
  actions.forEach(function(x){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ' + (x.class || 'primary');
    btn.textContent = x.label; btn.style.margin = '4px';
    btn.onclick = x.action;
    a.appendChild(btn);
  });
  $('modal').classList.remove('hidden');
}
function closeModal(){ $('modal').classList.add('hidden'); }
function showReset(){
  /* 9.39.10: المسار المحمي نفسه لحذف بيانات الطفل (علامة دائمة، إبلاغ النوافذ، لا إعلان قبل الاكتمال، حذف النسخ في المضيفة)
     9.39.11 (ق5-أ): لم يعد له زر في الرئيسية، ويمر ببوابة ولي الأمر أينما استُدعي */
  parentalGate(function(){ deleteChildDataOnDevice(); }, 'التصفير يحذف بيانات الطالب من هذا الجهاز.');
}
function confetti(n){
  var c = ['#FFC107','#E91E63','#2196F3','#4CAF50','#FF5722','#9C27B0','#00BCD4'];
  for (var i = 0; i < (n || 30); i++){
    var e = document.createElement('div');
    e.className = 'confetti';
    e.style.left = Math.random()*100 + '%';
    e.style.background = c[Math.floor(Math.random()*c.length)];
    e.style.animationDuration = (1.5 + Math.random()*1.5) + 's';
    document.body.appendChild(e);
    setTimeout(function(){ e.remove(); }, 3500);
  }
}
function toast(m){
  var e = document.createElement('div');
  e.className = 'toast'; e.textContent = m;
  document.body.appendChild(e);
  setTimeout(function(){ e.remove(); }, 3000);
}

/* 9.39.4 (RT9393-01): استئناف كل حذف معلّق عند الإقلاع (لا عند فتح القاعدة فقط)، ومنع هذه النافذة من استعادة طفل محذوف */
function resumePendingDeletions(){
  var tombs = readTombs(); if (!tombs.length) return;
  var mine = tombFor(DB_NAME, STORAGE_KEY);
  if (mine) CHILD_DATA_DELETED = true;
  tombs.forEach(function(t){
    try { if (t.s) localStorage.removeItem(t.s); } catch(e){}
    deleteDbFully(t.d, t.s).then(function(){ if (mine && (t.d === DB_NAME || t.s === STORAGE_KEY)){ alert('اكتمل حذف بيانات هذا الطالب من هذا الجهاز. سيُعاد فتح التطبيق.'); location.reload(); } }, function(e){ console.warn('pending delete failed', e); });
  });
  if (mine) setTimeout(function(){ if (tombFor(DB_NAME, STORAGE_KEY)) { try { showModal('⏳ حذف بيانات الطالب لم يكتمل', 'التطبيق مفتوح في نافذة أو تبويب آخر يمنع الحذف. أغلق النوافذ الأخرى؛ سيكتمل الحذف تلقائيًا. لن يُحفظ شيء لهذا الطالب حتى يكتمل.', [{label: 'حسنًا', class: 'primary', action: closeModal}]); } catch(e){} } }, 1200);
}
window.addEventListener('storage', function(e){
  if (e.key !== PENDING_DEL_KEY || CHILD_DATA_DELETED || !tombFor(DB_NAME, STORAGE_KEY)) return;
  CHILD_DATA_DELETED = true;
  try { if (_dbConn) _dbConn.then(function(db){ try { db.close(); } catch(x){} }, function(){}); } catch(x){}
  _dbConn = null; _dbConnName = null;
  alert('حُذفت بيانات هذا الطالب من نافذة أخرى على هذا الجهاز. سيُعاد فتح التطبيق.');
  location.reload();
});
