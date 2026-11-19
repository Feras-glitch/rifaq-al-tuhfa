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
    var fname = (exportKind === 'gift' ? 'إعداد_المشرف_' : 'إرسال_للمراجعة_' + reviewOrdinal + '_') + safe + '.html';
    var sizeKB = Math.round(byteSize / 1024);
    if (exportKind !== 'gift'){ try { var _now = new Date().toISOString(); Object.keys(fullPack.studentAudios || {}).forEach(function(k){ if (STATE.studentAudios[k] && fullPack.studentAudios[k].status === 'pending') STATE.studentAudios[k].sentAt = _now; }); save(); } catch(e){} }
    var doneMsg = (exportKind === 'gift' ? 'تم إنشاء إعداد المشرف المعتمد. شاركه مع الطالب المستفيد.' : 'تم إنشاء ملف المراجعة رقم ' + reviewRound + ' وتنزيله على جهازك. أرسله إلى المعلم') + ' · الحجم: ' + sizeKB + ' كيلوبايت.\n\nلا يُرسل الملف تلقائيًا.';
    if (canShareFile()) offerFile(blob, fname, '🎉 الملف جاهز', doneMsg.replace(' وتنزيله على جهازك', ''));
    else { downloadBlob(blob, fname); showModal('🎉 تم تجهيز الملف وتنزيله', doneMsg, [{label: '👍', class: 'success', action: closeModal}]); }
  } catch(e){
    alert('فشل الإصدار: ' + e.message);
  } finally {
    if (btn){ btn.disabled = false; btn.textContent = orig; }
  }
}
function blobToBase64(blob){
  return new Promise(function(res, rej){
    var r = new FileReader();
    r.onload = function(){ res(r.result); };
    r.onerror = function(){ rej(r.error); };
    r.readAsDataURL(blob);
  });
}
