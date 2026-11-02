# -*- coding: utf-8 -*-
"""9.39.4: RT9393-01 — حماية الحذف عبر النوافذ وإعادة التحميل. شغّله من جذر المستودع ثم tools/rebuild_html.py (قابل لإعادة التشغيل)"""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = []
def rep(old, new): R.append((old, new))

rep("""var PENDING_DEL_KEY = 'rifaq_pending_db_delete_v1';
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
    req.onsuccess = function(){ markPendingDbDelete(name, false); delete _dbDeleting[name]; res(true); };""",
"""/* 9.39.4 (RT9393-01): علامة الحذف دائمة ومشتركة بين النوافذ: تحمل قاعدة الصوت ومفتاح الحالة معًا، وتُفحص عند الإقلاع
   وعند كل حفظ أو كتابة صوت في أي نافذة، ويُبلَّغ بها كل نافذة مفتوحة عبر حدث storage. لا يكفي متغير في ذاكرة نافذة واحدة. */
var PENDING_DEL_KEY = 'rifaq_pending_db_delete_v1';
var CHILD_DATA_DELETED = false;
var _dbDeleting = {};
function readTombs(){
  try { var a = JSON.parse(localStorage.getItem(PENDING_DEL_KEY) || '[]'); if (!Array.isArray(a)) return [];
    return a.map(function(x){ return typeof x === 'string' ? {d: x, s: null} : (x && typeof x.d === 'string' ? {d: x.d, s: typeof x.s === 'string' ? x.s : null, at: x.at} : null); }).filter(Boolean);
  } catch(e){ return []; }
}
function writeTombs(a){ try { if (a.length) localStorage.setItem(PENDING_DEL_KEY, JSON.stringify(a)); else localStorage.removeItem(PENDING_DEL_KEY); } catch(e){} }
function pendingDbDeletes(){ return readTombs().map(function(t){ return t.d; }); }
function tombFor(dbName, stateKey){ return readTombs().some(function(t){ return t.d === dbName || (!!stateKey && t.s === stateKey); }); }
function isCurrentChildDeleted(){ return CHILD_DATA_DELETED || tombFor(DB_NAME, STORAGE_KEY); }
function markPendingDbDelete(name, on, stateKey){
  var a = readTombs().filter(function(t){ return t.d !== name; });
  if (on) a.push({d: name, s: stateKey || null, at: Date.now()});
  writeTombs(a);
}
function deleteDbFully(name, stateKey){
  if (_dbDeleting[name]) return _dbDeleting[name];
  var prev = readTombs().filter(function(t){ return t.d === name; })[0];
  stateKey = stateKey || (prev && prev.s) || null;
  markPendingDbDelete(name, true, stateKey);
  _dbDeleting[name] = new Promise(function(res, rej){
    var req = indexedDB.deleteDatabase(name);
    req.onsuccess = function(){
      try { if (stateKey) localStorage.removeItem(stateKey); } catch(e){} // حالة ربما أعادت نافذة أخرى كتابتها قبل أن تعلم بالحذف
      markPendingDbDelete(name, false); delete _dbDeleting[name]; res(true);
    };""")

rep("""async function dbPut(key, blob){
  if (CHILD_DATA_DELETED) throw new Error('child data deleted on this device');""",
"""async function dbPut(key, blob){
  if (isCurrentChildDeleted()) throw new Error('child data deleted on this device');""")

rep("""  if (CHILD_DATA_DELETED) return false; // 9.39.3: لا حفظ متأخر يعيد بيانات طفل حُذفت""",
"""  if (isCurrentChildDeleted()) return false; // 9.39.4: العلامة الدائمة تُفحص في كل نافذة، لا متغير هذه النافذة وحدها""")

rep("""  CHILD_DATA_DELETED = true;
  var dbName = DB_NAME;
  try { if (typeof _dbConn !== 'undefined' && _dbConn){ var db = await _dbConn; try { db.close(); } catch(e){} } } catch(e){}
  _dbConn = null; _dbConnName = null;
  try {
    localStorage.removeItem(STORAGE_KEY);""",
"""  CHILD_DATA_DELETED = true;
  var dbName = DB_NAME;
  markPendingDbDelete(dbName, true, STORAGE_KEY); // أولًا: العلامة الدائمة، فلا تعيد نافذة أخرى كتابة الحالة بعد مسحها
  try { if (typeof _dbConn !== 'undefined' && _dbConn){ var db = await _dbConn; try { db.close(); } catch(e){} } } catch(e){}
  _dbConn = null; _dbConnName = null;
  try {
    localStorage.removeItem(STORAGE_KEY);""")

rep("""  var del = deleteDbFully(dbName).then(function(){ return 'ok'; }, function(){ return 'error'; });""",
"""  var del = deleteDbFully(dbName, STORAGE_KEY).then(function(){ return 'ok'; }, function(){ return 'error'; });""")

rep("""(async function boot(){
  load();""",
"""/* 9.39.4 (RT9393-01): استئناف كل حذف معلّق عند الإقلاع (لا عند فتح القاعدة فقط)، ومنع هذه النافذة من استعادة طفل محذوف */
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
(async function boot(){
  resumePendingDeletions();
  load();""")

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new in s: continue
        n = s.count(old)
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:90]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
