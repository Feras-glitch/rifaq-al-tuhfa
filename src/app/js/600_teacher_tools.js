/* ===== 9.25: قناة الرد، ولوحة المتابعة للمعلم، وملخص ولي الأمر ===== */
var REPLY_CHANNELS = {text: '📝 نص', audio: '🎙️ صوت', both: '📝🎙️ نص وصوت'};
function setReplyChannel(ev){
  var v = ev.target.value; if (!REPLY_CHANNELS[v]) return;
  PACK_DATA.replyChannel = v; showTeacherReview();
}
async function rosterSaveCurrent(){
  try {
    var roster = (await keyDbGet('roster')) || {};
    var sid = String(PACK_DATA.studentId || PACK_DATA.studentName || 'unknown').slice(0, 64);
    var pend = Object.keys(PACK_DATA.studentAudios || {}).filter(function(k){ return (PACK_DATA.studentAudios[k] || {}).status === 'pending'; }).length;
    var sa = PACK_DATA.studentAssessment || {};
    var prev = roster[sid] || {};
    roster[sid] = {name: String(PACK_DATA.studentName || '').slice(0, 60), at: new Date().toISOString(), receivedAt: prev.receivedAt || new Date().toISOString(), deletedAt: prev.deletedAt || null, submittedAt: PACK_DATA.submittedAt || null,
      pending: pend, rated: Object.keys(PACK_DATA.teacherRatings || {}).length, mastered: (sa.mastered || []).length, pendingConcepts: (sa.pending || []).length, escalated: (sa.escalated || []).slice(0, 10)};
    await keyDbPut('roster', roster);
  } catch(e){ console.warn('roster', e); }
}
async function openRoster(){
  var roster = (await keyDbGet('roster')) || {};
  var ids = Object.keys(roster);
  var ov = document.createElement('div');
  ov.id = 'roster-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:520px;width:100%;padding:18px;max-height:90vh;overflow:auto';
  var rows = ids.map(function(id){
    var r = roster[id]; var overdue = r.submittedAt && assessTeacherReplyOverdue(r.submittedAt, new Date().toISOString());
    return '<div data-style="border:1px solid #e3e8ef;border-radius:12px;padding:10px;margin:8px 0"><b>' + escapeHTML(r.name || id) + '</b>' +
      '<div data-style="font-size:.85rem;color:#555">تسجيلات معلقة: ' + r.pending + ' · مُقيَّمة: ' + r.rated + ' · مفاهيم متقنة: ' + r.mastered + '/' + (r.mastered + r.pendingConcepts) +
      (r.escalated && r.escalated.length ? ' · محالة: ' + escapeHTML(r.escalated.join('، ')) : '') + (overdue ? ' · <span data-style="color:#b3261e">⏰ تجاوز 48 ساعة</span>' : '') + '</div>' +
      (retentionDue(r, new Date().toISOString()) ? '<div data-style="font-size:.85rem;color:#8a4b00;margin-top:6px">⏳ مرّ ' + TEACHER_RETENTION_DAYS + ' يومًا على استلام هذا الإرسال. احذف الملف الذي فتحته من جهازك، ثم اضغط: <button type="button" class="btn" data-call="' + escAttrSafe(JSON.stringify(['markRosterDeleted', id])) + '">تم الحذف</button></div>' : (r.deletedAt ? '<div data-style="font-size:.8rem;color:#2e7d32">✔ حُذف من الجهاز بتاريخ ' + escAttrSafe(new Date(r.deletedAt).toLocaleDateString('ar')) + '</div>' : '')) + '</div>';
  }).join('') || '<p>لا توجد إرسالات محفوظة بعد. تُضاف الإرسالات عند فتحها في شاشة المراجعة.</p>';
  card.innerHTML = '<h3 data-style="margin:0 0 8px">📋 لوحة المتابعة</h3>' + rows + '<div data-style="text-align:left"><button type="button" id="roster-close" class="btn">إغلاق</button></div>';
  ov.appendChild(card); document.body.appendChild(ov);
  document.getElementById('roster-close').onclick = function(){ ov.remove(); };
}
function buildParentSummary(){
  var st = STATE.assess || {}; var mastered = [], pending = [];
  var secs = (CURRICULUM || []).filter(function(s){ return !s._synthetic; });
  secs.forEach(function(s){ var c = (st.concepts || {})[s.id]; if (c && c.mastered) mastered.push(s.title); else pending.push(s.title); });
  var rc = {mastered: 0, good: 0, needs: 0, unusable: 0};
  Object.keys(PACK_DATA.teacherRatings || {}).forEach(function(k){ var v = normRating(PACK_DATA.teacherRatings[k]); if (rc[v] !== undefined) rc[v]++; });
  var lines = ['ملخص الأسبوع — ' + (STATE.student && STATE.student.name || ''), '', 'أحكام أتقنها: ' + (mastered.length ? mastered.join('، ') : 'لا يوجد بعد'), 'أحكام قيد التدريب: ' + (pending.length ? pending.join('، ') : 'لا يوجد'), '',
    'تقييم المعلم للتلاوة: متقن ' + rc.mastered + ' · جيد ' + rc.good + ' · يحتاج تدريبًا ' + rc.needs + (rc.unusable ? ' · لا يصلح للتقييم ' + rc.unusable : ''), '', 'ملاحظة: هذا الملخص لا يتضمن أي تسجيل صوتي.'];
  return lines.join('\n');
}
function showParentSummary(){
  var txt = buildParentSummary();
  var ov = document.createElement('div');
  ov.id = 'parent-summary';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  ov.innerHTML = '<div data-style="background:#fff;color:#222;border-radius:18px;max-width:480px;width:100%;padding:18px"><h3 data-style="margin:0 0 8px">📄 ملخص لولي الأمر</h3><textarea rows="12" readonly data-style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cfd8dc;border-radius:12px;font:inherit">' + escapeHTML(txt) + '</textarea><div data-style="text-align:left;margin-top:8px"><button type="button" id="ps-close" class="btn">إغلاق</button></div></div>';
  document.body.appendChild(ov);
  document.getElementById('ps-close').onclick = function(){ ov.remove(); };
}











window.addEventListener('storage', function(e){
  if (e.key !== PENDING_DEL_KEY || CHILD_DATA_DELETED || !tombFor(DB_NAME, STORAGE_KEY)) return;
  CHILD_DATA_DELETED = true;
  try { if (_dbConn) _dbConn.then(function(db){ try { db.close(); } catch(x){} }, function(){}); } catch(x){}
  _dbConn = null; _dbConnName = null;
  alert('حُذفت بيانات هذا الطالب من نافذة أخرى على هذا الجهاز. سيُعاد فتح التطبيق.');
  location.reload();
});
