/* ===== الإهداء وتسجيلات الزملاء ===== */
function giftSourceTerms(giverGender, recipientGender, teacherGender){
  var giverFemale = giverGender === 'girl', recipientFemale = recipientGender === 'girl', teacherFemale = teacherGender === 'girl';
  return {
    role: giverFemale ? '🎓 صاحبة الإهداء' : '🎓 صاحب الإهداء',
    description: giverFemale ? 'هذه زميلتك صاحبة التسجيلات المعتمدة.' : 'هذا زميلك صاحب التسجيلات المعتمدة.',
    teacher: 'تحت إشراف '+(teacherFemale ? 'المعلمة' : 'المعلم'),
    action: recipientFemale ? 'سجّلي بصوتك أنت، ثم أرسلي تسجيلاتك إلى '+(teacherFemale ? 'المعلمة' : 'المعلم')+'، ومن ثم تهدين ملفك لزميلاتك وأصدقائك لتنشرين النفع.' : 'سجّل بصوتك أنت، ثم أرسل تسجيلاتك إلى '+(teacherFemale ? 'المعلمة' : 'المعلم')+'، ومن ثم تهدي ملفك لزملائك وأصدقائك لتنشر النفع.'
  };
}
function buildGiftContents(groups, masters){
  masters = (masters && typeof masters === 'object') ? masters : {};
  var have = {};
  (groups || []).forEach(function(g){ Object.keys((g && g.audios) || {}).forEach(function(k){ var r = g.audios[k]; if (r && r.audio && r.status === 'approved') have[k] = (have[k] || 0) + 1; }); });
  var secs = [], byId = {}, total = 0, withPeer = 0, withMaster = 0, noAudio = 0;
  curriculumTasks(masters).forEach(function(t){
    var s = byId[t.sec]; if (!s){ s = byId[t.sec] = {id: String(t.sec), title: String(t.secTitle || '').slice(0, 80), total: 0, withPeer: 0, withMaster: 0, items: []}; secs.push(s); }
    var m = !!masters[t.id], p = !!have[t.id];
    s.total++; total++;
    if (m){ s.withMaster++; withMaster++; }
    if (!m && !p) noAudio++;
    if (p){ s.withPeer++; withPeer++; s.items.push({id: String(t.id), kind: t.kind, label: t.label, peers: have[t.id], master: m}); }
  });
  return {v: 2, totalTasks: total, withPeer: withPeer, withMaster: withMaster, noAudio: noAudio, complete: total > 0 && withPeer === total, sections: secs};
}
function giftContentsText(gc){
  if (!gc || !Array.isArray(gc.sections)) return '';
  /* 9.39.6 (RT9395-02): كل جملة هنا تُشتق من الأصوات الموجودة فعلًا؛ لا وعد بتلاوة غير موجودة */
  var T = gc.totalTasks || 0, M = gc.withMaster || 0, P = gc.withPeer || 0, N = gc.noAudio || 0;
  var masterLine = !T ? '' : (M === T ? '📿 تلاوة الشيخ موجودة في كل المهام (' + T + ').' : (M ? '📿 تلاوة الشيخ موجودة في ' + M + ' من ' + T + ' مهمة فقط.' : '⚠️ لا توجد تلاوة مرجعية للشيخ في هذا الإهداء.'));
  var lines = ['📚 ما ستتعلمه: المنهج كاملًا (' + gc.sections.length + ' درسًا) بالشرح والأبيات والاختبارات.', masterLine,
    '🎧 تسجيلات زميل معتمدة من المعلم في ' + P + ' من ' + T + ' مهمة' + (gc.complete ? ' (كل المهام).' : '.')];
  if (N) lines.push('🔇 ' + N + ' مهمة بلا أي صوت مرجعي (لا تلاوة شيخ ولا تسجيل زميل): تعتمد فيها على الشرح والنص.');
  lines.push('');
  gc.sections.forEach(function(s){
    var parts = [];
    if (s.withPeer) parts.push('تسجيل زميل في ' + s.withPeer + ' من ' + s.total);
    if (typeof s.withMaster === 'number') parts.push(s.withMaster === s.total ? 'تلاوة الشيخ في كلها' : (s.withMaster ? 'تلاوة الشيخ في ' + s.withMaster + ' من ' + s.total : 'بلا تلاوة شيخ'));
    lines.push((s.withPeer ? '✅ ' : '○ ') + s.title + (parts.length ? ' — ' + parts.join('، ') : ''));
    (s.items || []).forEach(function(it){ lines.push('    • ' + it.kind + (it.label ? ': ' + it.label : '') + (it.master === false ? ' (زميل فقط، بلا تلاوة شيخ)' : '')); });
  });
  return lines.join('\n');
}
function trustedPeerGroups(){ return peerAudiosAllowed() ? normalizePeerGroups().filter(peerGroupVerified) : []; }
 // 9.39.11 (ق1-ب)
function hiddenPeerGroupCount(){ return peerAudiosAllowed() ? normalizePeerGroups().filter(function(g){ return !peerGroupVerified(g); }).length : 0; }
function displayedGiftContents(){ return buildGiftContents(trustedPeerGroups(), PACK_DATA.masterAudios); }
function giftContentsDisplayText(){
  var txt = giftContentsText(displayedGiftContents());
  if (!PACK_DATA.giftContents) txt += '\n\nℹ️ هذا الإهداء صادر بإصدار سابق، فهذا الوصف محسوب من محتوى الملف.';
  if (!peerAudiosAllowed()) txt += '\n\n⚠️ الاعتماد غير موثّق، فلا تُعرض تسجيلات الزملاء ولا تُحسب في هذا الوصف.';
  else if (hiddenPeerGroupCount()) txt += '\n\n⚠️ لم تُعرض تسجيلات ' + hiddenPeerGroupCount() + ' من الزملاء لأنها لا تحمل اعتماد معلم مسجَّل.';
  if (REF_HIDDEN) txt += '\n\n⚠️ تلاوات الشيخ في هذا الملف غير موقّعة من مشرف مسجَّل، فأُخفيت.';
  return txt;
}
function renderGiftContentsBox(b){
  var txt = giftContentsDisplayText(), parts = txt.split('\n\n');
  var head = parts.shift() || '', rest = parts.join('\n\n');
  b.textContent = '';
  var h = document.createElement('div'); h.textContent = head; b.appendChild(h);
  if (rest){
    var d = document.createElement('details'); d.className = 'gift-details';
    var s = document.createElement('summary'); s.textContent = '📋 تفاصيل الدروس'; d.appendChild(s);
    var body = document.createElement('div'); body.textContent = rest; d.appendChild(body); b.appendChild(d);
  }
}
function refreshGiftContentsBox(){ var b = document.getElementById('gift-contents-box'); if (b) renderGiftContentsBox(b); }
function showGiftContents(){
  var txt = giftContentsDisplayText(); // التنبيه صار داخل giftContentsDisplayText
  showModal('🎁 ماذا في هذا الإهداء؟', txt, [{label: 'حسنًا', class: 'primary', action: closeModal}]);
}
function normalizePeerGroups(){
  var groups = Array.isArray(PACK_DATA.approvedPeerRecordings) ? PACK_DATA.approvedPeerRecordings : [];
  if (!groups.length && PACK_DATA.approvedStudentAudios && Object.keys(PACK_DATA.approvedStudentAudios).length){
    groups = [{id: PACK_DATA.sourceGiftPackageId || PACK_DATA.packageId || 'giver', name: PACK_DATA.sourceGiftStudentName || PACK_DATA.studentName || '', gender: PACK_DATA.sourceGiftStudentGender || 'boy', photo: PACK_DATA.sourceGiftStudentPhoto || null, audios: PACK_DATA.approvedStudentAudios}];
  }
  return groups;
}
function peerAudiosAllowed(){
  /* 9.39.3 (RT9392-02): أصوات الأطفال الآخرين تُعرض فقط بعد التحقق من اعتماد معلم موثوق لمحتوى الملف كله */
  if (PACK_DATA.packageType === 'approved_gift' || PACK_DATA.approved === true) return GIFT_TRUST === 'verified';
  if (PACK_DATA.packageType === 'student_returned') return RETURN_TRUST === 'verified';
  return true;
}
function peerAudioBlocks(itemId){
  if (!peerAudiosAllowed()) return '';
  var groups = trustedPeerGroups(), out = [];
  groups.forEach(function(g){
    var r = g.audios && g.audios[itemId];
    if (r && r.audio && r.status === 'approved') out.push(audioPersonBlock(g.photo, g.gender || 'boy', g.name || '', '🎧 تسجيل ' + genderWord(g.gender || 'boy','زميلك','زميلتك'), r.audio, 'giver-person-audio'));
  });
  return out.join('');
}
