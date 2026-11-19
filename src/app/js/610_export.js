/* ===== التصدير: ملف الطالب وملف الإعادة وحزمة الإهداء ===== */
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
  var fname = (isGiftExport ? 'إعداد_المشرف.html' : opts.filename.replace(/[\\/:*?"<>|]/g, '_'));
  if (canShareFile()){ offerFile(blob, fname, '🎉 الملف جاهز', (opts.successMessage || 'حجم الملف: ' + Math.round(byteSize / 1024) + ' كيلوبايت.')); return; }
  downloadBlob(blob, fname);

  showModal('🎉 تم تجهيز الملف وتنزيله', (opts.successMessage || 'حجم الملف: ' + Math.round(byteSize / 1024) + ' كيلوبايت.') + '\n\nتنبيه: لا يُرسل الملف تلقائيًا؛ شاركه يدويًا مع الشخص المقصود.',
    [{label: '👍', class: 'success', action: closeModal}]);
}
