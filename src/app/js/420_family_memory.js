/* ===== 9.26: الذكرى العائلية وسياسة احتفاظ المعلم ===== */
var TEACHER_RETENTION_DAYS = 30;
function escAttrSafe(v){ return String(v).replace(/[&"<>]/g, function(c){ return {'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]; }); }
async function exportFamilyArchive(){
  if (!confirm('سيُنشأ ملف يحوي صوت الطفل. احفظه بعناية، ولا تشاركه إلا مع أفراد أسرته. هل تريد المتابعة؟')) return;
  var ids = Object.keys(STATE.studentAudios || {}), parts = [];
  for (var i = 0; i < ids.length; i++){
    var blob = await dbGet(ids[i]); if (!blob) continue;
    var src = await blobToBase64(blob);
    if (!AUD_DATA_RE.test(src)) continue;
    var when = (STATE.studentAudios[ids[i]] || {}).updatedAt || '';
    parts.push('<section><h2>' + escAttrSafe(ids[i]) + '</h2><p>' + (when ? escAttrSafe(new Date(when).toLocaleDateString('ar')) : '') + '</p><audio controls preload="none" src="' + src + '"></audio></section>');
  }
  if (!parts.length){ alert('لا توجد تسجيلات لأرشفتها.'); return; }
  var name = escAttrSafe((STATE.student && STATE.student.name) || 'طالب');
  var html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; media-src data:; style-src \'unsafe-inline\'"><title>ذكرى ' + name + '</title></head><body><h1>ذكرى تعلّم ' + name + '</h1><p>هذا الملف يحوي صوت الطفل. احفظه في مكان آمن.</p>' + parts.join('') + '</body></html>';
  var url = URL.createObjectURL(new Blob([html], {type: 'text/html;charset=utf-8'}));
  var a = document.createElement('a'); a.href = url; a.download = 'ذكرى_' + (STATE.student && STATE.student.name || 'طالب').replace(/[\\/:*?"<>|]/g, '_') + '.html';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  STATE.archiveExports = (STATE.archiveExports || 0) + 1; save();
}
async function markRosterDeleted(sid){
  var roster = (await keyDbGet('roster')) || {};
  if (!roster[sid]) return;
  roster[sid].deletedAt = new Date().toISOString();
  await keyDbPut('roster', roster);
  await forgetInHost(null, sid);
  var ov = document.getElementById('roster-overlay'); if (ov) ov.remove();
  openRoster();
}
function retentionDue(entry, nowIso){
  var ref = entry.receivedAt || entry.at; if (!ref) return false;
  return (new Date(nowIso).getTime() - new Date(ref).getTime()) > TEACHER_RETENTION_DAYS * 86400000 && !entry.deletedAt;
}


