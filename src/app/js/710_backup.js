/* ===== 9.39.13 (D12): نسخة احتياطية واستعادة لتقدّم الطفل =====
   لماذا: أندرويد بلا مفتاح توقيع ثابت يمسح البيانات مع كل تحديث، وSafari يمحو تخزين الموقع بعد أسبوع دون استعمال،
   ومسح المتصفح أو تغيير الهاتف يضيّع كل شيء. النسخة ملف JSON يحفظه ولي الأمر؛ التسجيلات اختيارية.
   الملف غير موقّع، فيستطيع متمكّن تعديله؛ لذلك يرى المعلم «مستعاد من نسخة احتياطية» على ما جاء منها، ولا يُنقل رمز ولي الأمر. */
var BACKUP_TYPE = 'rifaq_backup', BACKUP_MAX_AUDIO = 20 * 1024 * 1024;
function cleanRestored(r){
  r = (r && typeof r === 'object') ? r : {};
  var clean = function(a){ return (Array.isArray(a) ? a : []).map(safeIdString).slice(0, 40); };
  return {at: String(r.at || '').slice(0, 40), backupAt: String(r.backupAt || '').slice(0, 40), app: String(r.app || '').slice(0, 20),
    nLog: Math.max(0, Math.min(1500, Number(r.nLog) || 0)), lessons: Math.max(0, Math.min(99, Number(r.lessons) || 0)), mastered: clean(r.mastered)};
}
function restoredNote(r){
  r = cleanRestored(r);
  return '⚠️ تقدّم مستعاد من نسخة احتياطية (نسخة ' + String(r.backupAt).slice(0, 10) + '، استُعيدت ' + String(r.at).slice(0, 10) + '). لم يُسجَّل على هذا الجهاز: ' +
    'الدروس المكتملة (' + r.lessons + ')، والمفاهيم المتقنة (' + r.mastered.length + ')' + (r.nLog ? '، وأول ' + r.nLog + ' إجابة في السجل' : '') + '.';
}
function blobFromDataURL(d){
  var m = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/.exec(String(d || '')); if (!m) return null;
  return new Blob([bytesFromB64(m[2])], {type: m[1]});
}
function downloadText(name, text, type){
  var blob = new Blob([text], {type: type || 'application/json;charset=utf-8'}), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
}
async function makeBackup(withAudio){
  var st = JSON.parse(JSON.stringify(STATE));
  if (st.student) delete st.student.guardianPin;            // الرمز لهذا الجهاز وحده
  delete st.role; delete st.sawSplash; delete st.recipientOnboarded;
  var audios = {}, total = 0, skipped = 0;
  if (withAudio){
    var ids = Object.keys(STATE.studentAudios || {});
    for (var i = 0; i < ids.length; i++){
      var b = null; try { b = await dbGet(ids[i]); } catch(e){}
      if (!b){ skipped++; continue; }
      total += b.size || 0;
      if (total > BACKUP_MAX_AUDIO){ alert('التسجيلات أكبر من 20 ميغابايت. حُفظت النسخة بلا التسجيلات الباقية.'); break; }
      audios[ids[i]] = await blobToBase64(b);
    }
  }
  var now = new Date().toISOString();
  var out = {type: BACKUP_TYPE, v: 1, app: APP_VERSION, at: now, packageId: String(PACK_DATA.packageId || PACKAGE_ID || ''), studentId: (STATE.student && STATE.student.id) || PACK_DATA.studentId || null,
    student: String((STATE.student && STATE.student.name) || ''), state: st, audios: audios};
  var nm = String((STATE.student && STATE.student.name) || 'طالب').replace(/[\\/:*?"<>|]/g, '_');
  downloadText('نسخة_احتياطية_' + nm + '_' + now.slice(0, 10) + '.json', JSON.stringify(out));
  STATE.lastBackupAt = now; STATE.lessonsAtBackup = lessonsDoneCount(); STATE.backupNagAt = STATE.lessonsAtBackup; save();
  toast('📦 حُفظت النسخة الاحتياطية' + (withAudio ? ' (التسجيلات: ' + Object.keys(audios).length + ')' : '') + '. احفظ الملف في مكان آمن.');
}
/* تعقيم حالة جاءت من ملف: معرّفات آمنة فقط، وأنواع وحدود معروفة */
function sanitizeBackupState(raw){
  var idOk = function(k){ return /^[A-Za-z0-9_\-]{1,64}$/.test(String(k)); };
  var st = normalizeState(raw);
  var stu = st.student || {}, s = {name: String(stu.name || '').slice(0, 60), gender: stu.gender === 'girl' ? 'girl' : 'boy', photo: safeImageURL(stu.photo),
    supervisorName: String(stu.supervisorName || '').slice(0, 60), supervisorGender: stu.supervisorGender === 'girl' ? 'girl' : 'boy'};
  if (typeof stu.id === 'string' && /^stu_[A-Za-z0-9_\-]{6,64}$/.test(stu.id)) s.id = stu.id;
  var c = stu.consent;
  if (c && typeof c === 'object' && c.v === CONSENT_VERSION){
    var pm = c.permissions || {};
    s.consent = {v: CONSENT_VERSION, guardian: String(c.guardian || '').slice(0, 60), at: String(c.at || '').slice(0, 40),
      permissions: {record: pm.record === true, review: pm.review === true, shareWithPeers: pm.shareWithPeers === true},
      excludedRecordings: Object.keys(c.excludedRecordings || {}).filter(idOk).slice(0, 200).reduce(function(o, k){ o[k] = true; return o; }, {})};
  }
  st.student = s;
  var pr = {}; Object.keys(st.progress || {}).filter(idOk).slice(0, 60).forEach(function(k){ var p = st.progress[k] || {};
    pr[k] = {bestScore: Math.max(0, Math.min(99999, Number(p.bestScore) || 0)), stars: Math.max(0, Math.min(3, Number(p.stars) || 0)), bestStars: Math.max(0, Math.min(3, Number(p.bestStars) || 0)), attempts: Math.max(0, Math.min(9999, Number(p.attempts) || 0))}; });
  st.progress = pr;
  var au = {}; Object.keys(st.studentAudios || {}).filter(idOk).slice(0, 200).forEach(function(k){ var a = st.studentAudios[k] || {};
    au[k] = {status: ['pending', 'approved', 'rejected'].indexOf(a.status) >= 0 ? a.status : 'pending'};
    ['v', 'updatedAt', 'rid', 'source', 'sentAt', 'reviewSource', 'reviewedAt'].forEach(function(f){ if (typeof a[f] === 'string') au[k][f] = a[f].slice(0, 64); }); if (a.partial) au[k].partial = true;
    if (typeof a.note === 'string' && a.note) au[k].note = a.note.slice(0, 400); });
  st.studentAudios = au;
  if (st.assess){
    var cs = {}; Object.keys(st.assess.concepts || {}).filter(idOk).slice(0, 40).forEach(function(k){ var x = st.assess.concepts[k] || {};
      cs[k] = {lastSet: /^[AB]$/.test(String(x.lastSet)) ? x.lastSet : null, lastPass: !!x.lastPass, streakPass: Number(x.streakPass) || 0, failStreak: Number(x.failStreak) || 0, rounds: Number(x.rounds) || 0,
        mastered: !!x.mastered, escalated: !!x.escalated, masteredAt: x.masteredAt ? String(x.masteredAt).slice(0, 40) : null, reviewIndex: Number(x.reviewIndex) || 0,
        nextReview: x.nextReview ? String(x.nextReview).slice(0, 40) : null, lastAt: x.lastAt ? String(x.lastAt).slice(0, 40) : null,
        lastQs: Array.isArray(x.lastQs) ? x.lastQs.map(safeIdString).slice(0, 60) : null}; });
    var ed = st.assess.examDone || {};
    st.assess = {concepts: cs, examDone: {1: !!ed[1], 2: !!ed[2]}, examPlan: null, lastExam: null, examFailedConcepts: [], submittedAt: null, history: [],
      finalDone: !!st.assess.finalDone, finalAt: st.assess.finalAt ? String(st.assess.finalAt).slice(0, 40) : null,
      pendingRetest: (Array.isArray(st.assess.pendingRetest) ? st.assess.pendingRetest : []).filter(idOk).slice(0, 40), lastVerdict: {}, inProgress: null};
  }
  st.respLog = (Array.isArray(st.respLog) ? st.respLog : []).slice(-1500).map(function(e){ e = (e && typeof e === 'object') ? e : {};
    return {t: String(e.t || '').slice(0, 20), k: String(e.k || '').slice(0, 3), s: safeIdString(e.s), q: safeIdString(e.q), c: e.c ? 1 : 0, a: Math.max(0, Math.min(999, Number(e.a) || 0))}; });
  var tr = {}; Object.keys(st.teacherRatings || {}).filter(idOk).forEach(function(k){ tr[k] = String(st.teacherRatings[k]).slice(0, 20); }); st.teacherRatings = tr;
  delete st.restored; delete st.consent; delete st.stars; delete st.giftExcluded;
  st.role = 'student'; st.sawSplash = true;
  return st;
}
function restoreBackupPick(){
  var inp = document.getElementById('gs-restore-file');
  if (!inp){ inp = document.createElement('input'); inp.type = 'file'; inp.id = 'gs-restore-file'; inp.accept = '.json,application/json'; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', function(){ var f = inp.files && inp.files[0]; inp.value = ''; if (f) restoreBackupFromFile(f); }); }
  inp.click();
}
function restoreBackupFromFile(file){
  if (file.size > 40 * 1024 * 1024){ alert('الملف كبير جدًا.'); return; }
  var r = new FileReader();
  r.onload = function(){ var b; try { b = JSON.parse(String(r.result), function(k, v){ return k === '__proto__' ? undefined : v; }); } catch(e){ alert('هذا ليس ملف نسخة احتياطية صالحًا.'); return; } applyRestore(b); };
  r.onerror = function(){ alert('تعذّرت قراءة الملف.'); };
  r.readAsText(file, 'utf-8');
}
async function applyRestore(b){
  if (!b || b.type !== BACKUP_TYPE || b.v !== 1 || !b.state || typeof b.state !== 'object'){ alert('هذا ليس ملف نسخة احتياطية من رفاق التحفة.'); return null; }
  var st = sanitizeBackupState(b.state);
  if (!st.student.name){ alert('النسخة الاحتياطية لا تحمل اسم طالب.'); return null; }
  var bid = st.student.id || null;
  if (PACK_DATA.studentId && bid && String(PACK_DATA.studentId) !== bid){ alert('هذه النسخة لطالب آخر غير صاحب هذا الملف. افتح «تطبيق الطالب» من الموقع ثم استعد النسخة.'); return null; }
  var lessons = Object.keys(st.progress).filter(function(k){ return st.progress[k].stars > 0; }).length;
  var mastered = Object.keys((st.assess && st.assess.concepts) || {}).filter(function(k){ return st.assess.concepts[k].mastered; });
  if (!confirm('استعادة نسخة «' + st.student.name + '» المحفوظة في ' + String(b.at || '').slice(0, 10) + ' (الدروس المكتملة: ' + lessons + ')؟\n' +
    'إن كان لهذا الطالب تقدّم على هذا الجهاز فستحل النسخة محله. والمعلم سيرى أن التقدّم مستعاد من نسخة احتياطية.')) return null;
  var keepPin = STATE.student && STATE.student.guardianPin;
  switchStudentProfile(st.student.name, bid || CURRENT_PROFILE_ID || newStudentId());
  st.student.id = CURRENT_PROFILE_ID;
  if (keepPin) st.student.guardianPin = keepPin;
  var put = 0, audios = (b.audios && typeof b.audios === 'object') ? b.audios : {};
  for (var k in st.studentAudios){
    if (!Object.prototype.hasOwnProperty.call(st.studentAudios, k)) continue;
    var d = Object.prototype.hasOwnProperty.call(audios, k) ? safeAudioURL(audios[k]) : null, blob = d ? blobFromDataURL(d) : null;
    if (blob){ try { await dbPut(k, blob); put++; continue; } catch(e){} }
    var have = null; try { have = await dbGet(k); } catch(e){}
    if (!have) delete st.studentAudios[k]; // تسجيل بلا صوت على هذا الجهاز لا يُعرض كأنه موجود
  }
  st.restored = cleanRestored({at: new Date().toISOString(), backupAt: b.at, app: b.app, nLog: st.respLog.length, lessons: lessons, mastered: mastered});
  st.recipientOnboarded = true; // 9.41.3: طفل باسمه أكمل إعداده؛ فملف الإهداء لا يعامله بعد الاستعادة كمستلم جديد فيمسحه
  st.lastBackupAt = String(b.at || '').slice(0, 40); st.lessonsAtBackup = lessons; st.backupNagAt = lessons;
  STATE = st; recalcStats(); save();
  var done = function(){ alert('✅ اكتملت الاستعادة. الدروس المكتملة: ' + lessons + '، والتسجيلات: ' + put + '. سيُعاد فتح التطبيق.'); location.reload(); };
  if (hasConsent() && !guardianPinSet()) pinSetupDialog(done, 'ضع رمز ولي الأمر لهذا الجهاز (4 أرقام).'); else done();
  return {lessons: lessons, audios: put};
}
/* أزرار في إعدادات ولي الأمر: النسخة الاحتياطية، والاستعادة، وتغيير الرمز */
function guardianExtras(card, ov){
  var box = document.createElement('div'); box.id = 'gs-backup-box';
  box.style.cssText = 'border-top:1px solid #e0e0e0;margin-top:10px;padding-top:8px';
  var h = document.createElement('p'); h.style.cssText = 'margin:4px 0;font-size:.9rem';
  h.textContent = '📦 النسخة الاحتياطية: تحفظ تقدّم الطفل في ملف ليُستعاد إن مُسح التطبيق أو تغيّر الهاتف.' + (STATE.lastBackupAt ? ' آخر نسخة: ' + String(STATE.lastBackupAt).slice(0, 10) + '.' : ' لم تُحفظ نسخة بعد.');
  box.appendChild(h);
  var lab = document.createElement('label'); lab.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:.85rem;margin:4px 0';
  var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'gs-backup-audio'; lab.appendChild(cb); lab.appendChild(document.createTextNode('مع التسجيلات الصوتية (ملف أكبر)'));
  box.appendChild(lab);
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
  var mk = function(id, t, fn){ var x = document.createElement('button'); x.type = 'button'; x.id = id; x.className = 'btn'; x.textContent = t; x.onclick = fn; row.appendChild(x); return x; };
  mk('gs-backup', '📦 حفظ نسخة احتياطية', function(){ makeBackup(cb.checked); });
  mk('gs-restore', '📥 استعادة من نسخة', function(){ ov.remove(); restoreBackupPick(); });
  if (guardianPinSet()) mk('gs-pin', '🔑 تغيير رمز ولي الأمر', function(){ ov.remove(); pinSetupDialog(function(){}, 'ضع الرمز الجديد (4 أرقام).'); });
  box.appendChild(row);
  var last = card.lastElementChild;
  if (last) card.insertBefore(box, last); else card.appendChild(box);
}
/* تذكير لطيف بعد كل درسين جديدين منذ آخر نسخة */
function maybeBackupReminder(){
  var n = lessonsDoneCount(), base = Math.max(Number(STATE.lessonsAtBackup) || 0, Number(STATE.backupNagAt) || 0);
  if (n - base < 2) return;
  STATE.backupNagAt = n; save();
  var res = document.getElementById('view-results'); if (!res) return;
  var old = document.getElementById('backup-reminder'); if (old) old.remove();
  var box = document.createElement('div'); box.id = 'backup-reminder'; box.className = 'notice info'; box.style.cssText = 'font-size:.85rem;margin-top:10px';
  box.textContent = GT('📦 {أكملت|أكملتِ} ' + arCount(n, 'درس', 'درسين', 'دروس') + '. {اطلب|اطلبي} من ولي الأمر حفظ نسخة احتياطية من «⚙️ إعدادات ولي الأمر»، حتى لا يضيع التقدّم إن مُسح التطبيق.');
  var nav = document.getElementById('results-nav');
  if (nav && nav.parentNode === res) res.insertBefore(box, nav); else res.appendChild(box);
}
(async function boot(){
  resumePendingDeletions();
  load();
  try { REF_TRUST = await computeRefTrust(); } catch(e){ REF_TRUST = 'invalid'; }
  applyRefPolicy();
  applyContentChannel(); // 9.39.14 (D5): بعد استبدال المنهج غير الموثّق إن حدث
  QPC_LOADING = new Promise(function(r){ setTimeout(r, 150); }).then(qpcInit); // 9.39.17
  QPC_LOADING.then(function(){ try { qpcRefreshVisible(); } catch(e){} }); // 9.41.1
  setTimeout(showDueReviewBanner, 1200);
  if (PACK_DATA.packageType === 'approved_gift' || PACK_DATA.approved === true){
    try { GIFT_TRUST = await verifyGiftPack(PACK_DATA); } catch(e){ GIFT_TRUST = 'invalid'; }
    try { refreshGiftContentsBox(); } catch(e){}
  }
  if (PACK_DATA.packageType === 'student_returned'){
    try { RETURN_TRUST = await verifyGiftPack(PACK_DATA); } catch(e){ RETURN_TRUST = 'invalid'; }
  }
  try { await computePeerTrust(); } catch(e){}
  try { refreshGiftContentsBox(); } catch(e){}
  // Package role takes precedence over a stale role saved by a different file on this browser.
  if (PACK_DATA.packageType === 'student_submission' || PACK_DATA.packageType === 'teacher_review') STATE.role = 'teacher';
  else if (PACK_DATA.packageType === 'student_returned') STATE.role = 'student';
  else if (PACK_DATA.packageType === 'approved_gift' || PACK_DATA.approved === true) STATE.role = 'friend';
  else if (PACK_DATA.packageType === 'student_fresh') STATE.role = 'student';
  var isReviewPack = PACK_DATA.packageType === 'student_submission' || PACK_DATA.packageType === 'teacher_review'; // مساحتها منفصلة من resolveInitialProfile
  var samePackStudent = !!(PACK_DATA.studentId && ((STATE.student && STATE.student.id === String(PACK_DATA.studentId)) || CURRENT_PROFILE_ID === String(PACK_DATA.studentId)));
  if (!isReviewPack && PACK_DATA.studentName && STATE.student.name && PACK_DATA.studentName !== STATE.student.name && detectMode() !== 'friend' && !samePackStudent) {
    /* 9.41.3: الملف لطفل غير الطفل المحمَّل: لا يُمسح ملف المحمَّل، ويُفتح لصاحب الملف ملفه هو (بالمعرّف، أو باسمه
       في الملفات القديمة)، أو ملف جديد إن لم يكن له ملف على الجهاز. ونفس الطفل الذي غيّر اسمه بعد الإرسال لا يدخل هنا */
    var tid = PACK_DATA.studentId ? String(PACK_DATA.studentId) : profileIdForPackName(PACK_DATA.studentName);
    var hadState = !!readStateAt(keysForId(tid).s);
    switchStudentProfile(PACK_DATA.studentName, tid);
    if (!hadState) STATE = {student:{name:'',gender:PACK_DATA.studentGender||'boy',photo:PACK_DATA.studentPhoto||null,supervisorName:'',supervisorGender:'boy'},progress:{},stats:{totalPoints:0,completedSections:0,perfectSections:0,totalAttempts:0},studentAudios:{},role:null,sawSplash:false,recipientOnboarded:false};
    // Re-apply the package role (the profile now loaded is the file owner's own, or a fresh one).
    if (PACK_DATA.packageType === 'student_submission' || PACK_DATA.packageType === 'teacher_review') STATE.role = 'teacher';
    else if (PACK_DATA.packageType === 'student_returned') STATE.role = 'student';
    else if (PACK_DATA.packageType === 'approved_gift' || PACK_DATA.approved === true) STATE.role = 'friend';
    else if (PACK_DATA.packageType === 'student_fresh') STATE.role = 'student';
    save();
  }
  // Load student audios from IndexedDB into STATE.studentAudios statuses
  var mode = detectMode();
  // Package-type invariants: approved gifts can never enter teacher review.
  if (PACK_DATA.packageType === 'approved_gift') {
    if (STATE.recipientOnboarded && STATE.student && STATE.student.name) { STATE.role = 'student'; mode = 'student-fresh'; }
    else { STATE.role = 'friend'; mode = 'friend'; }
  }
  if (PACK_DATA.packageType === 'student_submission' || PACK_DATA.packageType === 'teacher_review') { STATE.role = 'teacher'; mode = 'teacher-review'; }
  if (PACK_DATA.packageType === 'student_returned') { STATE.role = 'student'; mode = 'student-returned'; }
  // Load pack audios into state for student mode
  syncPackStatuses();
  // Submission packages open directly in the teacher review screen. The package
  // type is authoritative; no splash/profile screen is allowed to turn it into
  // a student session on a browser that contains old local state.
  if (mode === 'teacher-review'){
    STATE.role = 'teacher';
    STATE.sawSplash = true;
    save();
    showTeacherReview();
    return;
  }
  if (mode === 'student-returned' && STATE.student.name && STATE.sawSplash){
    $('view-splash').classList.add('hidden');
    applyTheme();
    renderTFView();
    show('view-tf');
    return;
  }
  if (mode === 'friend'){
    // An approved gift is a reusable educational package, not the giver's student file.
    STATE.student = {name:'', gender:'boy', photo:null, supervisorName:'', supervisorGender:'boy'};
    STATE.progress = {};
    STATE.stats = {totalPoints:0,completedSections:0,perfectSections:0,totalAttempts:0};
    STATE.studentAudios = {};
    STATE.role = 'friend';
    STATE.sawSplash = true;
    save();
    $('view-splash').classList.add('hidden');
    buildSetup();
    show('view-student-setup');
    return;
  }
  if (mode === 'student-fresh' && STATE.student.name && STATE.sawSplash){
    $('view-splash').classList.add('hidden');
    applyTheme();
    show('view-home');
    renderHome();
    return;
  }
  buildSplash();
})();
