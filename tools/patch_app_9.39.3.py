# -*- coding: utf-8 -*-
"""9.39.3: إصلاح RT9392-01..04 في التطبيق والنسخة التجريبية (الكود نفسه). شغّله من جذر المستودع ثم tools/rebuild_html.py"""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = []
def rep(old, new): R.append((old, new))

# ---- RT9392-01: داخل المضيفة لا رجوع أبدًا إلى ثقة الملف ----
rep("""function trustedKeysFor(pack){ return Array.isArray(PINNED_TEACHER_KEYS) ? PINNED_TEACHER_KEYS : (Array.isArray(pack && pack.trustedTeacherKeys) ? pack.trustedTeacherKeys : []); }""",
"""/* 9.39.3 (RT9392-01): داخل الصفحة المضيفة تأتي الثقة منها وحدها؛ إن غابت المرساة فلا ثقة إطلاقًا (لا رجوع إلى قائمة الملف) */
function runningInHost(){ try { return window.parent !== window && !!window.parent.RIFAQ_HOST; } catch(e){ return false; } }
function trustedKeysFor(pack){
  if (Array.isArray(PINNED_TEACHER_KEYS)) return PINNED_TEACHER_KEYS;
  if (runningInHost()) return [];
  return Array.isArray(pack && pack.trustedTeacherKeys) ? pack.trustedTeacherKeys : [];
}
/* 9.39.3 (RT9392-02): التوقيع v4 يغطي محتوى الحزمة كله (كل ما قد يُعرض)، محسوبًا على البيانات كما وصلت قبل أي تطبيع */
function canonJSON(v, skipTopKey){
  function c(x, top){
    if (x === null || typeof x !== 'object'){ var s = JSON.stringify(x); return s === undefined ? undefined : s; }
    if (Array.isArray(x)) return '[' + x.map(function(e){ var s = c(e, false); return s === undefined ? 'null' : s; }).join(',') + ']';
    var ks = Object.keys(x).sort(), out = [];
    for (var i = 0; i < ks.length; i++){ if (top && ks[i] === skipTopKey) continue; var s = c(x[ks[i]], false); if (s !== undefined) out.push(JSON.stringify(ks[i]) + ':' + s); }
    return '{' + out.join(',') + '}';
  }
  return c(v, true);
}
var PACK_CANON_DIGEST = (function(){ try { return sha256b64(canonJSON(PACK_DATA, 'signature')).catch(function(){ return null; }); } catch(e){ return Promise.resolve(null); } })();""")

rep("""function giftTrustBadge(){ var t = {verified: ' — ✅ معتمد وموقّع من المعلم', untrusted: ' — ⚠️ التوقيع ليس من معلم مسجَّل لدى المشرف', invalid: ' — ❌ الاعتماد تغيّر بعد التوقيع', unsigned: ' — ℹ️ هذا الاعتماد بلا توقيع'};""",
"""function giftTrustBadge(){ var t = {verified: ' — ✅ معتمد وموقّع من المعلم', untrusted: ' — ⚠️ التوقيع ليس من معلم مسجَّل لدى المشرف', invalid: ' — ❌ الاعتماد تغيّر بعد التوقيع', unsigned: ' — ℹ️ هذا الاعتماد بلا توقيع', outdated: ' — ⚠️ توقيع بصيغة قديمة لا تثبت محتوى الملف كله؛ اطلب من المعلم إعادة إصداره'};""")

rep("""unsigned: 'ℹ️ ملاحظات المعلم بلا توقيع'}[RETURN_TRUST];""",
"""unsigned: 'ℹ️ ملاحظات المعلم بلا توقيع', outdated: '⚠️ توقيع ملاحظات المعلم بصيغة قديمة؛ اطلب إعادة الإرسال'}[RETURN_TRUST];""")

rep("""async function signGiftPack(pack){
  var k = await getTeacherSigningKey();
  var m = await giftManifest(pack);
  var sig = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, k.privateKey, new TextEncoder().encode(m));
  pack.signature = {alg: 'ECDSA-P256-SHA256', key: k.publicJwk, sig: b64FromBytes(new Uint8Array(sig)), signedAt: new Date().toISOString()};""",
"""async function contentManifest(pack, fresh){
  var d = (pack === PACK_DATA && !fresh) ? await PACK_CANON_DIGEST : await sha256b64(canonJSON(JSON.parse(JSON.stringify(pack)), 'signature'));
  if (!d) throw new Error('content digest unavailable');
  return JSON.stringify({v: 4, content: d});
}
async function signGiftPack(pack){
  var k = await getTeacherSigningKey();
  pack.signature = null; // لا يدخل في البيان، ويُستبعد صراحةً
  var m = await contentManifest(pack, true);
  var sig = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, k.privateKey, new TextEncoder().encode(m));
  pack.signature = {alg: 'ECDSA-P256-SHA256', mv: 4, key: k.publicJwk, sig: b64FromBytes(new Uint8Array(sig)), signedAt: new Date().toISOString()};""")

rep("""  if (!trusted.some(function(t){ return t && jwkThumb(t) === th; })) return 'untrusted';
  try {
    var key = await crypto.subtle.importKey('jwk', {kty: sg.key.kty, crv: sg.key.crv, x: sg.key.x, y: sg.key.y, ext: true}, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
    var m = await giftManifest(pack);""",
"""  if (!trusted.some(function(t){ return t && jwkThumb(t) === th; })) return 'untrusted';
  if (sg.mv !== 4) return 'outdated'; // v3 لا يغطي كل الحقول المعروضة؛ لا يُقبل كاعتماد موثّق
  try {
    var key = await crypto.subtle.importKey('jwk', {kty: sg.key.kty, crv: sg.key.crv, x: sg.key.x, y: sg.key.y, ext: true}, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
    var m = await contentManifest(pack);""")

# ---- RT9392-03: الحذف لا يُعلن قبل اكتماله فعلًا، ويُستأنف إن لم يكتمل ----
rep("""function openDB(){
  if (_dbConn && _dbConnName === DB_NAME) return _dbConn;
  var name = DB_NAME;
  _dbConnName = name;
  _dbConn = new Promise(function(res, rej){""",
"""/* 9.39.3 (RT9392-03): حذف قاعدة التسجيلات لا يُعدّ ناجحًا إلا عند onsuccess. علامة الحذف المعلّق تبقى حتى يكتمل،
   وأي فتح لاحق للقاعدة ينتظر اكتمال الحذف أولًا فلا تعود البيانات ولا تُكتب فوقها */
var PENDING_DEL_KEY = 'rifaq_pending_db_delete_v1';
var CHILD_DATA_DELETED = false;
var _dbDeleting = {};
function pendingDbDeletes(){ try { var a = JSON.parse(localStorage.getItem(PENDING_DEL_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch(e){ return []; } }
function markPendingDbDelete(name, on){
  try { var a = pendingDbDeletes().filter(function(x){ return x !== name; }); if (on) a.push(name);
    if (a.length) localStorage.setItem(PENDING_DEL_KEY, JSON.stringify(a)); else localStorage.removeItem(PENDING_DEL_KEY); } catch(e){}
}
function deleteDbFully(name){
  if (_dbDeleting[name]) return _dbDeleting[name];
  markPendingDbDelete(name, true);
  _dbDeleting[name] = new Promise(function(res, rej){
    var req = indexedDB.deleteDatabase(name);
    req.onsuccess = function(){ markPendingDbDelete(name, false); delete _dbDeleting[name]; res(true); };
    req.onerror = function(){ delete _dbDeleting[name]; rej(req.error || new Error('delete failed')); };
    req.onblocked = function(){ console.warn('indexedDB delete blocked: another connection is open'); };
  });
  return _dbDeleting[name];
}
function openDB(){
  if (_dbConn && _dbConnName === DB_NAME) return _dbConn;
  var name = DB_NAME;
  _dbConnName = name;
  var pre = (_dbDeleting[name] || pendingDbDeletes().indexOf(name) >= 0) ? deleteDbFully(name) : Promise.resolve();
  _dbConn = pre.then(function(){ return new Promise(function(res, rej){""")

rep("""    req.onerror = function(){ if (_dbConnName === name) { _dbConn = null; _dbConnName = null; } rej(req.error); };
    req.onblocked = function(){ console.warn('indexedDB open blocked'); };
  });
  return _dbConn;
}""",
"""    req.onerror = function(){ if (_dbConnName === name) { _dbConn = null; _dbConnName = null; } rej(req.error); };
    req.onblocked = function(){ console.warn('indexedDB open blocked'); };
  }); }, function(e){ if (_dbConnName === name) { _dbConn = null; _dbConnName = null; } throw e; });
  return _dbConn;
}""")

rep("""async function dbPut(key, blob){
  var db = await openDB();""",
"""async function dbPut(key, blob){
  if (CHILD_DATA_DELETED) throw new Error('child data deleted on this device');
  var db = await openDB();""")

rep("""function save(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));""",
"""function save(){
  if (CHILD_DATA_DELETED) return false; // 9.39.3: لا حفظ متأخر يعيد بيانات طفل حُذفت
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));""")

rep("""  try { if (typeof _dbConn !== 'undefined' && _dbConn){ var db = await _dbConn; try { db.close(); } catch(e){} } } catch(e){}
  _dbConn = null; _dbConnName = null;
  try {
    /* 9.39 (R04): الحذف يخص الطفل الحالي وحده (قاعدته ومفتاح حالته)، ويُنتظر اكتمال الحذف قبل الإعلان */
    await new Promise(function(resolve){
      var req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve;
      setTimeout(resolve, 4000);
    });
  } catch(e){ console.warn('db delete', e); }
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (localStorage.getItem(ACTIVE_PROFILE_KEY) === INITIAL_PROFILE_NAME) localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch(e){}
  await forgetInHost(PACK_DATA.packageId || PACKAGE_ID, PACK_DATA.studentId || (STATE.student && STATE.student.id) || null);
  alert('تم حذف بيانات هذا الطالب من هذا الجهاز. سيُعاد فتح التطبيق.');
  location.reload();
}""",
"""  CHILD_DATA_DELETED = true;
  var dbName = DB_NAME;
  try { if (typeof _dbConn !== 'undefined' && _dbConn){ var db = await _dbConn; try { db.close(); } catch(e){} } } catch(e){}
  _dbConn = null; _dbConnName = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (localStorage.getItem(ACTIVE_PROFILE_KEY) === INITIAL_PROFILE_NAME) localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch(e){}
  await forgetInHost(PACK_DATA.packageId || PACKAGE_ID, PACK_DATA.studentId || (STATE.student && STATE.student.id) || null);
  /* 9.39 (R04) + 9.39.3 (RT9392-03): لا إعلان نجاح إلا بعد onsuccess الفعلي لحذف قاعدة التسجيلات */
  var del = deleteDbFully(dbName).then(function(){ return 'ok'; }, function(){ return 'error'; });
  var r = await Promise.race([del, new Promise(function(res){ setTimeout(function(){ res('pending'); }, 6000); })]);
  if (r === 'ok'){ alert('تم حذف بيانات هذا الطالب من هذا الجهاز. سيُعاد فتح التطبيق.'); location.reload(); return; }
  alert('⚠️ الحذف لم يكتمل بعد: ' + (r === 'error' ? 'تعذّر حذف قاعدة التسجيلات على هذا الجهاز.' : 'التطبيق مفتوح في نافذة أو تبويب آخر يمنع حذف التسجيلات.') +
    '\\nأغلق النوافذ الأخرى للتطبيق. سيكتمل الحذف تلقائيًا، وإن لم يكتمل فسيُعاد عند فتح التطبيق مرة أخرى قبل أي استعمال للتسجيلات.');
  del.then(function(x){ if (x === 'ok'){ alert('اكتمل حذف بيانات هذا الطالب من هذا الجهاز. سيُعاد فتح التطبيق.'); location.reload(); } });
}""")

# ---- (لاحقة) RT9392-02: تسجيلات الزملاء لا تُعرض في الإهداء أو الإعادة إلا إذا كان التوقيع موثّقًا ----
R2 = [("""function peerAudioBlocks(itemId){
  var groups = normalizePeerGroups(), out = [];""",
"""function peerAudiosAllowed(){
  /* 9.39.3 (RT9392-02): أصوات الأطفال الآخرين تُعرض فقط بعد التحقق من اعتماد معلم موثوق لمحتوى الملف كله */
  if (PACK_DATA.packageType === 'approved_gift' || PACK_DATA.approved === true) return GIFT_TRUST === 'verified';
  if (PACK_DATA.packageType === 'student_returned') return RETURN_TRUST === 'verified';
  return true;
}
function peerAudioBlocks(itemId){
  if (!peerAudiosAllowed()) return '';
  var groups = normalizePeerGroups(), out = [];"""),
("P.signature = {alg: 'ECDSA-P256-SHA256', key: {kty:", "P.signature = {alg: 'ECDSA-P256-SHA256', mv: (P.signature.mv === 4 ? 4 : 3), key: {kty:")]
R.extend(R2)
for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new in s:
            continue  # مطبَّق مسبقًا (الأداة قابلة لإعادة التشغيل)
        n = s.count(old)
        if n != 1:
            sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:90]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s)
    print('patched', f)

# ---- R11 (من التقرير الأول): بوابة الموافقة على مستوى الدالة لرفع ملف بديل وللإرسال ----
R3 = [("""async function uploadReplacementAudio(event, itemId){
  var file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;""",
"""async function uploadReplacementAudio(event, itemId){
  var file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  /* 9.39.3 (R11): مسار رفع الملف يخضع لبوابة الموافقة نفسها التي يخضع لها الميكروفون */
  if (!hasConsent()){ ensureConsent(function(){ alert('تم حفظ الموافقة. اختر الملف الصوتي مرة أخرى.'); }); return; }"""),
("""async function doExportStudent(exportKind){
  exportKind = exportKind || 'submission';
  closeModal();""",
"""async function doExportStudent(exportKind){
  exportKind = exportKind || 'submission';
  /* 9.39.3 (R11): لا إرسال لتسجيلات طفل دون موافقة ولي أمر سارية، أيًّا كان المسار الذي استُدعيت منه الدالة */
  if (exportKind !== 'gift' && Object.keys(STATE.studentAudios || {}).length && !hasConsent()){ closeModal(); ensureConsent(function(){ doExportStudent(exportKind); }); return; }
  closeModal();""")]
for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R3:
        if new in s: continue
        assert s.count(old) == 1, (f, old[:60])
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('R11 patched', f)
