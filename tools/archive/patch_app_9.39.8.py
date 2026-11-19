# -*- coding: utf-8 -*-
"""9.39.8: RT9397-01 — التسجيل القديم بلا rid لا يأخذ القرار بتساوي الوقت وحده؛ يلزم تطابق بصمة الصوت.
شغّله من جذر المستودع ثم tools/rebuild_html.py — قابل لإعادة التشغيل."""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = [
("""  var pv = fromPack && fromPack.v ? String(fromPack.v) : '';
  return !pv || pv !== String(local.updatedAt);
}""",
"""  var pv = fromPack && fromPack.v ? String(fromPack.v) : '';
  return !pv || pv !== String(local.updatedAt);
}
/* 9.39.8 (RT9397-01): تساوي الوقت لا يثبت تطابق الصوت. التسجيل القديم بلا rid ذو الوقت المطابق يبقى «قيد المراجعة»
   حتى تُقارن بصمة صوته المحفوظ على الجهاز ببصمة الصوت الذي قرّر فيه المعلم؛ فإن تطابقتا طُبِّق القرار، وإلا بقي قيد المراجعة */
function legacyNeedsAudioCheck(local, fromPack){
  return !!(local && local.status === 'pending' && !local.rid && local.updatedAt && fromPack && fromPack.v && String(fromPack.v) === String(local.updatedAt));
}
async function sha256OfBytes(u8){ var d = await crypto.subtle.digest('SHA-256', u8); return b64FromBytes(new Uint8Array(d)); }
var _legacyReconcile = null;
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
}"""),
("""    if (isNewerLocalRecording(local, fromPack)) return; // 9.39.6: بالمعرّف لا بالساعة
    STATE.studentAudios[id] = {status: fromPack.status || 'pending', v: fromPack.v || ''};
  });
}""",
"""    if (isNewerLocalRecording(local, fromPack)) return; // 9.39.6: بالمعرّف لا بالساعة
    if (legacyNeedsAudioCheck(local, fromPack)) { needCheck = true; return; } // 9.39.8: لا قرار قبل مطابقة الصوت
    STATE.studentAudios[id] = {status: fromPack.status || 'pending', v: fromPack.v || ''};
  });
  if (needCheck) setTimeout(function(){ reconcileLegacyDecisions(); }, 0);
}"""),
("""  var packRecords = PACK_DATA.studentAudios || {};
  STATE.studentAudios = STATE.studentAudios || {};
  Object.keys(packRecords).forEach(function(id){
    var fromPack = packRecords[id] || {};
    var local = STATE.studentAudios[id];""",
"""  var packRecords = PACK_DATA.studentAudios || {}, needCheck = false;
  STATE.studentAudios = STATE.studentAudios || {};
  Object.keys(packRecords).forEach(function(id){
    var fromPack = packRecords[id] || {};
    var local = STATE.studentAudios[id];"""),
]
for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new in s: continue
        if s.count(old) != 1: sys.exit('%s: no unique match for %s' % (f, old[:70]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
