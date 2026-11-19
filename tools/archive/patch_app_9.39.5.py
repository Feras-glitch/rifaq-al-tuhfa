# -*- coding: utf-8 -*-
"""9.39.5: R12 (التخزين بمعرّف الطفل + ترحيل بلا نقل بيانات)، R03/R09 (نسخة لكل تسجيل)، R08 (إهداء جزئي ببيان واضح).
شغّله من جذر المستودع ثم tools/rebuild_html.py — قابل لإعادة التشغيل."""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = []
def rep(old, new): R.append((old, new))

# ================= R12: ملف شخصي بمعرّف الطفل =================
rep("""var INITIAL_PROFILE_NAME = PACK_DATA.studentName || localStorage.getItem(ACTIVE_PROFILE_KEY) || '';
var STORAGE_KEY = INITIAL_PROFILE_NAME ? STORAGE_BASE + '_' + simpleHash(INITIAL_PROFILE_NAME.trim().toLowerCase()) : STORAGE_BASE + '_guest';""",
"""/* 9.39.5 (R12): مساحة التخزين (الحالة + قاعدة الصوت) تُشتق من معرّف الطفل لا من اسمه، فطفلان بالاسم نفسه لا يتشاركان بياناتهما.
   الترحيل بلا نقل بيانات: الملف الشخصي القديم المسمّى بالاسم يُسجَّل في خريطة المعرّفات بمفاتيحه القديمة كما هي، فلا يضيع شيء. */
var DB_BASE = 'tohfa_student_audio_' + PACKAGE_ID;
var ID_MAP_KEY = STORAGE_BASE + '_idmap', ACTIVE_ID_KEY = STORAGE_BASE + '_active_id';
function idMap(){ try { var m = JSON.parse(localStorage.getItem(ID_MAP_KEY) || '{}'); return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {}; } catch(e){ return {}; } }
function setIdMap(m){ try { localStorage.setItem(ID_MAP_KEY, JSON.stringify(m)); } catch(e){} }
function legacyKeysForName(n){ var h = simpleHash(String(n || '').trim().toLowerCase()); return {s: STORAGE_BASE + '_' + h, d: DB_BASE + '_' + h}; }
function keysForId(id){ var m = idMap()[id]; if (m && typeof m.s === 'string' && typeof m.d === 'string') return {s: m.s, d: m.d}; var h = simpleHash('id|' + id); return {s: STORAGE_BASE + '_id_' + h, d: DB_BASE + '_id_' + h}; }
function registerProfile(id, keys, name){ var m = idMap(); m[id] = {s: keys.s, d: keys.d, name: String(name || '').slice(0, 80), at: Date.now()}; setIdMap(m); try { localStorage.setItem(ACTIVE_ID_KEY, id); } catch(e){} }
function forgetProfileId(id){ try { var m = idMap(); if (id && m[id]) { delete m[id]; setIdMap(m); } if (id && localStorage.getItem(ACTIVE_ID_KEY) === id) localStorage.removeItem(ACTIVE_ID_KEY); } catch(e){} }
function readStateAt(k){ try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch(e){ return null; } }
function resolveInitialProfile(){
  var guest = {s: STORAGE_BASE + '_guest', d: DB_BASE + '_guest', id: null};
  try {
    var packId = PACK_DATA.studentId ? String(PACK_DATA.studentId) : '';
    if (packId){
      if (idMap()[packId]) { var K0 = keysForId(packId); return {s: K0.s, d: K0.d, id: packId}; }
      if (PACK_DATA.studentName){
        var L = legacyKeysForName(PACK_DATA.studentName), st = readStateAt(L.s);
        if (st && st.student && (st.student.id === packId || !st.student.id)) { registerProfile(packId, L, PACK_DATA.studentName); return {s: L.s, d: L.d, id: packId}; }
      }
      var K = keysForId(packId); registerProfile(packId, K, PACK_DATA.studentName); return {s: K.s, d: K.d, id: packId};
    }
    var act = localStorage.getItem(ACTIVE_ID_KEY);
    if (act && idMap()[act]) { var K1 = keysForId(act); return {s: K1.s, d: K1.d, id: act}; }
    var legacyName = localStorage.getItem(ACTIVE_PROFILE_KEY) || '';
    if (legacyName){
      var L2 = legacyKeysForName(legacyName), st2 = readStateAt(L2.s);
      if (st2){ var id2 = (st2.student && st2.student.id) || newStudentId(); registerProfile(id2, L2, legacyName); return {s: L2.s, d: L2.d, id: id2}; }
    }
  } catch(e){ console.warn('profile resolve failed', e); }
  return guest;
}
var INITIAL_PROFILE = resolveInitialProfile();
var CURRENT_PROFILE_ID = INITIAL_PROFILE.id;
var INITIAL_PROFILE_NAME = PACK_DATA.studentName || localStorage.getItem(ACTIVE_PROFILE_KEY) || '';
var STORAGE_KEY = INITIAL_PROFILE.s;""")

rep("""var DB_BASE = 'tohfa_student_audio_' + PACKAGE_ID;
var DB_NAME = DB_BASE + '_' + (INITIAL_PROFILE_NAME ? simpleHash(INITIAL_PROFILE_NAME.trim().toLowerCase()) : 'guest');""",
"""var DB_NAME = INITIAL_PROFILE.d;""")

rep("""function switchStudentProfile(name){
  var clean = (name || '').trim();
  if (!clean) return;
  var nextKey = STORAGE_BASE + '_' + simpleHash(clean.toLowerCase());
  if (nextKey === STORAGE_KEY) { localStorage.setItem(ACTIVE_PROFILE_KEY, clean); syncPackStatuses(); return; }
  STORAGE_KEY = nextKey; DB_NAME = DB_BASE + '_' + simpleHash(clean.toLowerCase());
  localStorage.setItem(ACTIVE_PROFILE_KEY, clean);""",
"""/* 9.39.5 (R12): إذا وُجد على الجهاز طالب بالاسم نفسه يُسأل المستخدم: هل هو نفسه؟ وإلا يُنشأ ملف مستقل بمعرّف جديد */
function chooseProfileForName(name){
  var n = String(name || '').trim().toLowerCase(), m = idMap();
  var cands = Object.keys(m).filter(function(id){ return String(m[id].name || '').trim().toLowerCase() === n; });
  var L = legacyKeysForName(name), lst = readStateAt(L.s), legacyId = null;
  if (lst && !Object.keys(m).some(function(id){ return m[id].s === L.s; })) legacyId = (lst.student && lst.student.id) || ('stu_legacy_' + simpleHash(L.s));
  if (!cands.length && !legacyId) return {id: newStudentId(), existing: false};
  if (confirm('يوجد على هذا الجهاز طالب مسجَّل باسم «' + String(name).trim() + '».\\n\\nإن كان هذا أنت وتريد متابعة تقدّمك فاضغط «موافق».\\nإن كنت طالبًا آخر بالاسم نفسه فاضغط «إلغاء» ليُنشأ لك ملف مستقل لا يختلط بغيره.')){
    if (cands.length) return {id: cands[cands.length - 1], existing: true};
    registerProfile(legacyId, L, name); return {id: legacyId, existing: true};
  }
  return {id: newStudentId(), existing: false};
}
function switchStudentProfile(name, id){
  var clean = (name || '').trim();
  if (!clean) return;
  id = id || CURRENT_PROFILE_ID || newStudentId();
  var K = keysForId(id);
  registerProfile(id, K, clean);
  CURRENT_PROFILE_ID = id;
  if (K.s === STORAGE_KEY && K.d === DB_NAME) { localStorage.setItem(ACTIVE_PROFILE_KEY, clean); syncPackStatuses(); return; }
  STORAGE_KEY = K.s; DB_NAME = K.d;
  localStorage.setItem(ACTIVE_PROFILE_KEY, clean);""")

rep("""    switchStudentProfile(name);
    STATE.student = {id:newStudentId(), name:name, gender:setupGender, photo:setupPhoto, supervisorName:'', supervisorGender:'boy'};""",
"""    switchStudentProfile(name, newStudentId()); // 9.39.5: مستلم الإهداء ملف مستقل دائمًا، فلا يطغى على طالب بالاسم نفسه
    STATE.student = {id:CURRENT_PROFILE_ID, name:name, gender:setupGender, photo:setupPhoto, supervisorName:'', supervisorGender:'boy'};""")

rep("""  if (name !== (STATE.student.name || '') && name.toLowerCase() !== String(PACK_DATA.studentName || '').trim().toLowerCase()) switchStudentProfile(name);
  localStorage.setItem(ACTIVE_PROFILE_KEY, name);
  STATE.student.name = name;
  STATE.student.gender = setupGender;
  STATE.student.photo = setupPhoto;
  if (!STATE.student.id) STATE.student.id = PACK_DATA.studentId || newStudentId();""",
"""  var curName = String(STATE.student.name || '').trim().toLowerCase();
  var packOwn = !!PACK_DATA.studentId && name.toLowerCase() === String(PACK_DATA.studentName || '').trim().toLowerCase();
  var _wantNew = SETUP_NEW_STUDENT; SETUP_NEW_STUDENT = false;
  if ((name.toLowerCase() !== curName || _wantNew) && !packOwn) switchStudentProfile(name, chooseProfileForName(name).id);
  else if (!CURRENT_PROFILE_ID) switchStudentProfile(name, STATE.student.id || PACK_DATA.studentId || newStudentId());
  localStorage.setItem(ACTIVE_PROFILE_KEY, name);
  STATE.student.name = name;
  STATE.student.gender = setupGender;
  STATE.student.photo = setupPhoto;
  STATE.student.id = CURRENT_PROFILE_ID || STATE.student.id || PACK_DATA.studentId || newStudentId();""")

rep("""  markPendingDbDelete(dbName, true, STORAGE_KEY); // أولًا: العلامة الدائمة، فلا تعيد نافذة أخرى كتابة الحالة بعد مسحها""",
"""  markPendingDbDelete(dbName, true, STORAGE_KEY); // أولًا: العلامة الدائمة، فلا تعيد نافذة أخرى كتابة الحالة بعد مسحها
  forgetProfileId(CURRENT_PROFILE_ID); // 9.39.5 (R12): يزول الملف الشخصي من خريطة المعرّفات""")

# ================= R03: قرار المعلم يُطبَّق على النسخة نفسها من التسجيل =================
rep("""    // A locally re-recorded item stays pending; otherwise mirror the authoritative package status.
    if (local && local.status === 'pending' && local.updatedAt) return;
    STATE.studentAudios[id] = {status: fromPack.status || 'pending'};""",
"""    // 9.39.5 (R03): التسجيل المحلي يبقى «قيد المراجعة» فقط إن كان أحدث من النسخة التي قرّر فيها المعلم (v).
    // إن كان القرار على النسخة نفسها أو أحدث منها يُطبَّق القرار. الحزم القديمة بلا v تبقى على السلوك السابق.
    if (local && local.status === 'pending' && local.updatedAt){
      var lt = Date.parse(local.updatedAt) || 0, pv = fromPack.v ? (Date.parse(fromPack.v) || 0) : 0;
      if (!pv || lt > pv) return;
    }
    STATE.studentAudios[id] = {status: fromPack.status || 'pending', v: fromPack.v || ''};""")

# ================= R09: إعادة الإرسال تحمل المعتمد سابقًا، وكل تسجيل يحمل نسخته =================
rep("""        var prevRec = packRecords[id];
        if (PACK_DATA.packageType !== 'approved_gift' && STATE.role !== 'friend' && prevRec && prevRec.status === 'approved') continue;
        var blob = await dbGet(id);
        if (blob) {
          studentAudiosOut[id] = {audio: await blobToBase64(blob), status:'pending', partial: !!(STATE.studentAudios[id] && STATE.studentAudios[id].partial)};
        } else if (prevRec && prevRec.audio) {
          studentAudiosOut[id] = {audio:prevRec.audio, status:prevRec.status === 'rejected' ? 'rejected' : 'pending', partial: prevRec.partial === true};
        }""",
"""        var prevRec = packRecords[id];
        var localRec = STATE.studentAudios[id] || {};
        /* 9.39.5 (R09): التسجيل المعتمد سابقًا يُحمل كما هو (بصوته وحالته ونسخته) ما لم يُعد الطفل تسجيله بعد الاعتماد */
        var reRecorded = !!(prevRec && localRec.status === 'pending' && localRec.updatedAt && (!prevRec.v || (Date.parse(localRec.updatedAt) || 0) > (Date.parse(prevRec.v) || 0)));
        if (PACK_DATA.packageType !== 'approved_gift' && STATE.role !== 'friend' && prevRec && prevRec.status === 'approved' && !reRecorded){
          if (prevRec.audio) studentAudiosOut[id] = {audio: prevRec.audio, status: 'approved', v: prevRec.v || ''};
          continue;
        }
        var blob = await dbGet(id);
        if (blob) {
          studentAudiosOut[id] = {audio: await blobToBase64(blob), status:'pending', partial: !!localRec.partial, v: localRec.updatedAt || ''};
        } else if (prevRec && prevRec.audio) {
          studentAudiosOut[id] = {audio:prevRec.audio, status:prevRec.status === 'rejected' ? 'rejected' : 'pending', partial: prevRec.partial === true, v: prevRec.v || ''};
        }""")

rep("""      if (!Object.keys(studentAudiosOut).length && !(exportKind !== 'gift' && STATE.assess && STATE.assess.lastExam)){ alert('لا توجد تسجيلات أو نتائج اختبار للإرسال.'); return; }""",
"""      var newForReview = Object.keys(studentAudiosOut).filter(function(k){ return studentAudiosOut[k].status !== 'approved'; }).length;
      if (!newForReview && !(exportKind !== 'gift' && STATE.assess && STATE.assess.lastExam)){ alert('لا توجد تسجيلات جديدة أو نتائج اختبار للإرسال. التسجيلات المعتمدة سابقًا محفوظة لدى المعلم.'); return; }""")

# ================= R08: إهداء جزئي ببيان «ما في الإهداء» و«ما ستتعلمه» =================
rep("""function normalizePeerGroups(){""",
"""/* 9.39.5 (R08): بيان محتوى الإهداء — يُبنى عند الإصدار ويدخل في التوقيع، ويُعرض للمعلم قبل الإصدار وللمهدى إليه عند الفتح */
function plainText(h){ return String(h || '').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim(); }
function curriculumTasks(){
  var out = [];
  (CURRICULUM || []).forEach(function(sec){
    if (!sec || sec._synthetic) return;
    (sec.items || []).forEach(function(it){ out.push({id: it.id, sec: sec.id, secTitle: sec.title, kind: it.type === 'quran' ? 'آية' : (it.type === 'poem' ? 'أبيات المتن' : 'نص'), label: plainText(it.text).slice(0, 70)}); });
    (sec.questions || []).forEach(function(q){ if ((q.textType === 'quran' || detectTextType(q) === 'quran') && PACK_DATA.masterAudios && PACK_DATA.masterAudios[q.id]) out.push({id: q.id, sec: sec.id, secTitle: sec.title, kind: 'آية', label: plainText(q.text).slice(0, 70)}); });
  });
  return out;
}
function buildGiftContents(groups){
  var have = {};
  (groups || []).forEach(function(g){ Object.keys((g && g.audios) || {}).forEach(function(k){ var r = g.audios[k]; if (r && r.audio && r.status === 'approved') have[k] = (have[k] || 0) + 1; }); });
  var secs = [], byId = {}, total = 0, withPeer = 0;
  curriculumTasks().forEach(function(t){
    var s = byId[t.sec]; if (!s){ s = byId[t.sec] = {id: String(t.sec), title: String(t.secTitle || '').slice(0, 80), total: 0, withPeer: 0, items: []}; secs.push(s); }
    s.total++; total++;
    if (have[t.id]){ s.withPeer++; withPeer++; s.items.push({id: String(t.id), kind: t.kind, label: t.label, peers: have[t.id]}); }
  });
  return {v: 1, totalTasks: total, withPeer: withPeer, complete: total > 0 && withPeer === total, sections: secs};
}
function giftContentsText(gc){
  if (!gc || !Array.isArray(gc.sections)) return '';
  var lines = ['📚 ما ستتعلمه: المنهج كاملًا (' + gc.sections.length + ' درسًا) بالشرح والأبيات والاختبارات وتلاوة الشيخ.',
    '🎧 تسجيلات زميل معتمدة من المعلم في ' + gc.withPeer + ' من ' + gc.totalTasks + ' مهمة' + (gc.complete ? ' (الإهداء كامل).' : '. المهام الأخرى فيها تلاوة الشيخ وحدها.'), ''];
  gc.sections.forEach(function(s){
    lines.push((s.withPeer ? '✅ ' : '○ ') + s.title + (s.withPeer ? ' — تسجيل زميل في ' + s.withPeer + ' من ' + s.total : ''));
    (s.items || []).forEach(function(it){ lines.push('    • ' + it.kind + (it.label ? ': ' + it.label : '')); });
  });
  return lines.join('\\n');
}
function showGiftContents(){
  var gc = PACK_DATA.giftContents;
  var txt = gc ? giftContentsText(gc) : 'هذا الإهداء صادر بإصدار سابق لا يحمل بيانًا بمحتواه.';
  if (GIFT_TRUST !== 'verified') txt += '\\n\\n⚠️ الاعتماد غير موثّق، فلن تُعرض تسجيلات الزملاء.';
  showModal('🎁 ماذا في هذا الإهداء؟', txt, [{label: 'حسنًا', class: 'primary', action: closeModal}]);
}
function normalizePeerGroups(){""")

rep("""  var totalSubmitted = Object.keys(PACK_DATA.studentAudios || {}).length;
  if (approvedCount === 0 || approvedCount !== totalSubmitted || Object.keys(approvedAudios).length !== totalSubmitted){
    alert('لا يمكن إصدار إعداد المشرف بعد. يجب مراجعة واعتماد جميع التسجيلات المطلوبة أولاً. المعتمد: ' + approvedCount + ' من ' + totalSubmitted);
    return;
  }""",
"""  var totalSubmitted = Object.keys(PACK_DATA.studentAudios || {}).length;
  /* 9.39.5 (R08 — قرار المالك): يجوز الإهداء الجزئي، بشرط تسجيل معتمد واحد على الأقل، وبيان صريح بما يتضمنه وما سيتعلمه المهدى إليه */
  if (approvedCount === 0){ alert('لا يمكن إصدار الإهداء: لا يوجد أي تسجيل معتمد بعد.'); return; }
  var _c = PACK_DATA.studentConsent || {};
  var _share = !!(_c.v === 2 && _c.permissions && _c.permissions.shareWithPeers === true);
  var _excl = _c.excludedRecordings || {}, _own = {};
  if (_share) Object.keys(approvedAudios).forEach(function(k){ if (!_excl[k]) _own[k] = approvedAudios[k]; });
  var _inherited = normalizePeerGroups().filter(function(g){ return g && g.shareable === true; });
  var preview = buildGiftContents(_inherited.concat([{audios: _own}]));
  var notIncluded = totalSubmitted - approvedCount;
  var msg = '🎁 ما يتضمنه الإهداء:\\n' + giftContentsText(preview) +
    (notIncluded ? '\\n\\nلن يدخل الإهداء ' + notIncluded + ' تسجيل لم يُعتمد بعد (قيد المراجعة أو مرفوض).' : '') +
    (!_share ? '\\n\\nℹ️ ولي أمر الطالب لم يأذن بمشاركة تسجيلاته، فلن تدخل تسجيلاته الإهداء.' : '') +
    '\\n\\nهل تريد إصدار الإهداء بهذا المحتوى؟';
  if (!confirm(msg)) return;""")

rep("""    newPack.approvedPeerRecordings = mergedGroups;
    newPack.approvedStudentAudios = {}; // audio lives once, inside approvedPeerRecordings""",
"""    newPack.approvedPeerRecordings = mergedGroups;
    newPack.giftContents = buildGiftContents(mergedGroups); // 9.39.5 (R08): يدخل في التوقيع v4
    newPack.approvedStudentAudios = {}; // audio lives once, inside approvedPeerRecordings""")

rep("""    $('gift-source-description').textContent = gt.description + giftTrustBadge();""",
"""    $('gift-source-description').textContent = gt.description + giftTrustBadge();
    /* 9.39.5 (R08): بيان ما في الإهداء وما سيتعلمه المهدى إليه، قبل أن يبدأ */
    var gcBox = document.getElementById('gift-contents-box');
    if (!gcBox){ gcBox = document.createElement('div'); gcBox.id = 'gift-contents-box'; gcBox.className = 'notice'; gcBox.style.cssText = 'white-space:pre-line;font-size:.84rem;margin-top:10px;text-align:right'; giftCard.appendChild(gcBox); }
    gcBox.textContent = PACK_DATA.giftContents ? giftContentsText(PACK_DATA.giftContents) : 'هذا الإهداء صادر بإصدار سابق لا يحمل بيانًا بمحتواه.';""")

rep('''var CALLABLE_ALLOW = ["answer",''', '''var CALLABLE_ALLOW = ["showGiftContents", "answer",''')

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new in s: continue
        n = s.count(old)
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:100]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)

# زر «ماذا في هذا الإهداء؟» في الصفحة الرئيسية للمهدى إليه
R2 = [("""  $('home-sub').textContent = sub;
""", """  $('home-sub').textContent = sub;
  var gcBtn = document.getElementById('home-gift-contents-btn');
  if (PACK_DATA.packageType === 'approved_gift'){
    if (!gcBtn){ gcBtn = document.createElement('button'); gcBtn.id = 'home-gift-contents-btn'; gcBtn.type = 'button'; gcBtn.className = 'btn ghost'; gcBtn.style.cssText = 'margin-top:6px;font-size:.8rem;padding:4px 10px';
      gcBtn.textContent = '🎁 ماذا في هذا الإهداء؟'; gcBtn.setAttribute('data-call', '["showGiftContents"]'); $('home-sub').parentNode.appendChild(gcBtn); }
  } else if (gcBtn) gcBtn.remove();
""")]
for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R2:
        if new in s: continue
        assert s.count(old) == 1, (f, old[:60]); s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('home btn', f)

# «طالب جديد» صريح: يمرّ على سؤال الاسم المكرر حتى لو طابق الاسم الحالي
R3 = [("""function startNewStudent(){
  if (STATE.role === 'teacher') return;""", """var SETUP_NEW_STUDENT = false;
function startNewStudent(){
  if (STATE.role === 'teacher') return;
  SETUP_NEW_STUDENT = true; // 9.39.5 (R12)""")]
for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R3:
        if new in s: continue
        assert s.count(old) == 1, (f, old[:60]); s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('new-student flag', f)
