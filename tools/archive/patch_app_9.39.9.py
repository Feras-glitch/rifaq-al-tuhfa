# -*- coding: utf-8 -*-
"""9.39.9: RT9398-01 — مقارنة بصمة الصوت مربوطة بالحساب والقاعدة ومفتاح الحالة والتسجيل الذي بدأت عليه.
شغّله من جذر المستودع ثم tools/rebuild_html.py — قابل لإعادة التشغيل."""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
OLD = """var _legacyReconcile = null;
function reconcileLegacyDecisions(){
  if (_legacyReconcile) return _legacyReconcile;
  _legacyReconcile = (async function(){
    var packRecords = PACK_DATA.studentAudios || {}, changed = 0;
    var ids = Object.keys(packRecords).filter(function(id){ return legacyNeedsAudioCheck(STATE.studentAudios && STATE.studentAudios[id], packRecords[id]); });
    for (var i = 0; i < ids.length; i++){
      var id = ids[i], fp = packRecords[id];
      try {
        var m = /^data:[^,]*;base64,(.*)$/.exec(String(fp.audio || ''));
        if (!m) continue; // لا صوت في الحزمة للمقارنة: يبقى قيد المراجعة
        var blob = await dbGet(id);
        if (!blob) continue; // لا صوت محلي للمقارنة: يبقى قيد المراجعة
        var a = await sha256OfBytes(new Uint8Array(await blob.arrayBuffer()));
        var b = await sha256OfBytes(bytesFromB64(m[1]));
        var cur = STATE.studentAudios[id];
        if (a === b && legacyNeedsAudioCheck(cur, fp)){ STATE.studentAudios[id] = {status: fp.status || 'pending', v: fp.v || ''}; changed++; }
      } catch(e){ console.warn('legacy decision check failed', id, e); }
    }
    if (changed){ save(); try { if ($('view-home') && !$('view-home').classList.contains('hidden')) renderHome(); } catch(e){} }
    return changed;
  })();
  _legacyReconcile.then(function(){ _legacyReconcile = null; }, function(){ _legacyReconcile = null; });
  return _legacyReconcile;
}"""
NEW = """/* 9.39.9 (RT9398-01): كل مقارنة مربوطة بسياقها (الطالب، مفتاح الحالة، قاعدة الصوت، كائن الحالة، وسجل التسجيل نفسه).
   تُلغى نتيجتها إن تغيّر أي منها أثناء الحساب (تبديل الطالب مثلًا)، ولكل سياق مقارنته المستقلة. */
var _legacyReconcile = null;
function legacyContext(){ return {pid: CURRENT_PROFILE_ID, s: STORAGE_KEY, d: DB_NAME, st: STATE}; }
function sameLegacyContext(c){ return !!c && c.pid === CURRENT_PROFILE_ID && c.s === STORAGE_KEY && c.d === DB_NAME && c.st === STATE; }
function reconcileLegacyDecisions(){
  if (_legacyReconcile && sameLegacyContext(_legacyReconcile.ctx)) return _legacyReconcile.p;
  var ctx = legacyContext();
  var run = {ctx: ctx, p: null};
  run.p = (async function(){
    var packRecords = PACK_DATA.studentAudios || {}, changed = 0;
    var ids = Object.keys(packRecords).filter(function(id){ return legacyNeedsAudioCheck(ctx.st.studentAudios && ctx.st.studentAudios[id], packRecords[id]); });
    for (var i = 0; i < ids.length; i++){
      if (!sameLegacyContext(ctx)) return changed; // تغيّر الطالب أو مساحة التخزين: لا نتيجة لهذا السياق في غيره
      var id = ids[i], fp = packRecords[id], startRec = ctx.st.studentAudios[id];
      try {
        var m = /^data:[^,]*;base64,(.*)$/.exec(String(fp.audio || ''));
        if (!m) continue; // لا صوت في الحزمة للمقارنة: يبقى قيد المراجعة
        var blob = await dbGetFrom(ctx.d, id);
        if (!blob) continue; // لا صوت محلي للمقارنة: يبقى قيد المراجعة
        var a = await sha256OfBytes(new Uint8Array(await blob.arrayBuffer()));
        var b = await sha256OfBytes(bytesFromB64(m[1]));
        /* لا يُكتب القرار إلا في السياق الذي بدأ فيه الحساب، وعلى سجل التسجيل نفسه دون تغيّر */
        if (a === b && sameLegacyContext(ctx) && STATE.studentAudios[id] === startRec && legacyNeedsAudioCheck(startRec, fp)){
          STATE.studentAudios[id] = {status: fp.status || 'pending', v: fp.v || ''}; changed++;
        }
      } catch(e){ console.warn('legacy decision check failed', id, e); }
    }
    if (changed && sameLegacyContext(ctx)){ save(); try { if ($('view-home') && !$('view-home').classList.contains('hidden')) renderHome(); } catch(e){} }
    return changed;
  })();
  _legacyReconcile = run;
  run.p.then(function(){ if (_legacyReconcile === run) _legacyReconcile = null; }, function(){ if (_legacyReconcile === run) _legacyReconcile = null; });
  return run.p;
}
/* قراءة صوت من قاعدة محددة بالاسم (لا من قاعدة الطالب الحالي) */
function dbGetFrom(name, key){
  if (name === DB_NAME) return dbGet(key);
  return new Promise(function(res){
    try {
      var q = indexedDB.open(name);
      q.onupgradeneeded = function(){ try { q.transaction.abort(); } catch(e){} res(null); };
      q.onsuccess = function(){ var db = q.result; try { if (!db.objectStoreNames.contains(STORE)){ db.close(); res(null); return; }
        var g = db.transaction(STORE, 'readonly').objectStore(STORE).get(key); g.onsuccess = function(){ db.close(); res(g.result || null); }; g.onerror = function(){ db.close(); res(null); }; } catch(e){ try { db.close(); } catch(x){} res(null); } };
      q.onerror = function(){ res(null); };
    } catch(e){ res(null); }
  });
}"""
for f in FILES:
    s = open(f, encoding='utf-8').read()
    if NEW not in s:
        if s.count(OLD) != 1: sys.exit('%s: no unique match' % f)
        s = s.replace(OLD, NEW)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
