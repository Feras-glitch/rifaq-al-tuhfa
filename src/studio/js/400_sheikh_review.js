/* ===== 9.40: مراجعة الشيخ العلمية =====
   الشيخ يمرّ على كل ما في المنهج: شرح كل درس وأبيات المتن ومهام التلاوة، وكل سؤال (أسئلة الدروس وبنك الاختبار).
   لكل وحدة قرار: «صحيح» أو «يحتاج تعديلًا» (مع ملاحظة) أو «يُحذف». القرارات تُحفظ على هذا الجهاز ليكمل الشيخ متى شاء،
   ثم تُصدَّر في ملف JSON يدمجه المطوّر بالأداة tools/apply_sheikh_review.py.
   كل قرار يحمل بصمة نص الوحدة ساعة القرار: إن تغيّر النص بعدها عادت الوحدة «لم تُراجَع». */
var REVIEW_KEY = 'rifaq_sheikh_review_v1';
var REVIEW_VIEW = {section: '', filter: 'pending_first'};

function reviewHash(s){ // FNV-1a 32 — بصمة نص لا أمان (التحقق من التطابق فقط)
  var h = 0x811c9dc5; s = String(s);
  for (var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}
var REVIEW_FIELDS = ['type', 'text', 'desc', 'question', 'options', 'answer', 'explanation', 'source', 'ayah', 'unit', 'pairs', 'pieces', 'sentence', 'distractors', 'items', 'extraRules', 'tolerance', 'hint', 'word', 'rule', 'lahn'];
function reviewContent(x){
  var o = {}; REVIEW_FIELDS.forEach(function(f){ if (x[f] !== undefined) o[f] = x[f]; }); return JSON.stringify(o);
}
/* وحدات المراجعة بترتيب المنهج */
function reviewUnits(){
  var out = [];
  (CURRICULUM || []).forEach(function(s){
    (s.items || []).forEach(function(it){ out.push({uid: 'item:' + it.id, sec: s.id, kind: it.type === 'poem' ? 'matn' : 'task', x: it, pending: it.review === 'pending', h: reviewHash(reviewContent(it))}); });
    (s.questions || []).forEach(function(q){ out.push({uid: 'q:' + q.id, sec: s.id, kind: 'q', x: q, pending: q.review === 'pending', h: reviewHash(reviewContent(q))}); });
    (s.examQuestions || []).forEach(function(q){ out.push({uid: 'q:' + q.id, sec: s.id, kind: 'exam', x: q, pending: q.review === 'pending', h: reviewHash(reviewContent(q))}); });
  });
  return out;
}
function reviewLoad(){
  try { var r = JSON.parse(localStorage.getItem(REVIEW_KEY) || 'null'); if (r && typeof r === 'object' && r.decisions) return r; } catch(e){}
  return {reviewer: '', decisions: {}};
}
function reviewSave(st){ try { localStorage.setItem(REVIEW_KEY, JSON.stringify(st)); } catch(e){ alert('تعذّر حفظ المراجعة على هذا الجهاز: ' + e.name); } }
function reviewDecisionOf(st, u){ var d = st.decisions[u.uid]; return d && d.h === u.h ? d : null; }

function reviewEsc(s){ return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
function reviewGender(s){ return String(s || '').replace(/\{([^{}|]*)\|([^{}]*)\}/g, '$1 ($2)'); }
function reviewRich(s){ return studioSafeHTML(reviewGender(s)); }
function reviewMarked(s){ // [[كلمة]] أو [[كلمة|حكم]] في الصيد والتلوين
  return reviewEsc(s).replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, function(_, w, r){ return '<mark>' + w + '</mark>' + (r ? '<sub> (' + r + ')</sub>' : ''); });
}
var REVIEW_TYPE = {listen: 'اسمع وميّز', multiple_choice: 'اختيار من متعدد', true_false: 'صواب أو خطأ', extraction: 'استخراج من نص', match: 'توصيل', order: 'ترتيب', cloze: 'إكمال', classify: 'تصنيف في سلال', hunt: 'صيد', paint: 'تلوين'};
function reviewBody(u){
  var x = u.x, h = '';
  if (u.kind === 'matn' || u.kind === 'task'){
    h += '<div class="rv-text">' + reviewRich(x.text) + '</div>';
    if (x.desc) h += '<div class="rv-desc">' + reviewRich(x.desc) + '</div>';
    return h + reviewPrevHTML(x);
  }
  h += '<div class="rv-q">' + reviewRich(x.text) + '</div>';
  if (x.question) h += '<div class="rv-q2">❓ ' + reviewRich(x.question) + '</div>';
  if (x.source) h += '<div class="rv-src">' + reviewEsc(x.source) + '</div>';
  if (Array.isArray(x.options)) h += '<ol class="rv-opts">' + x.options.map(function(o, i){ return '<li' + (i === x.answer ? ' class="ok"' : '') + '>' + reviewRich(o) + (i === x.answer ? ' ✔' : '') + '</li>'; }).join('') + '</ol>';
  if (x.type === 'true_false') h += '<div class="rv-ans">الجواب: <b>' + (x.answer ? 'صحيح' : 'خطأ') + '</b></div>';
  if (x.type === 'hunt' || x.type === 'paint') h += '<div class="rv-text">' + reviewMarked(x.ayah) + '</div>' + (x.extraRules ? '<div class="rv-src">أحكام إضافية في اللوحة: ' + reviewEsc(x.extraRules.join('، ')) + '</div>' : '');
  if (Array.isArray(x.pairs)) h += '<table class="rv-pairs">' + x.pairs.map(function(p){ return '<tr><td>' + reviewEsc(p[0]) + '</td><td>⟵</td><td>' + reviewEsc(p[1]) + '</td></tr>'; }).join('') + '</table>';
  if (Array.isArray(x.pieces)) h += '<div class="rv-ans">الترتيب الصحيح: ' + x.pieces.map(reviewEsc).join(' ← ') + '</div>';
  if (x.sentence) h += '<div class="rv-text">' + reviewEsc(x.sentence).replace(/\{\{([^}]*)\}\}/g, '<mark>$1</mark>') + '</div>' + (x.distractors ? '<div class="rv-src">بدائل خاطئة: ' + x.distractors.map(reviewEsc).join('، ') + '</div>' : '');
  if (x.items && typeof x.items === 'object' && !Array.isArray(x.items)) h += '<table class="rv-pairs">' + Object.keys(x.items).map(function(k){ return '<tr><td><b>' + reviewEsc(k) + '</b></td><td>' + (x.items[k] || []).map(reviewEsc).join('، ') + '</td></tr>'; }).join('') + '</table>';
  if (x.type === 'listen') h += '<div class="rv-text">' + reviewEsc(x.word) + '</div><div class="rv-ans">الحكم: <b>' + reviewEsc(x.rule) + '</b></div><div class="rv-src">القراءة الخاطئة التي تُسجَّل عمدًا: ' + reviewEsc(x.lahn) + '</div>';
  if (x.explanation) h += '<div class="rv-expl">💡 ' + reviewRich(x.explanation) + '</div>';
  return h + reviewPrevHTML(x);
}
/* 9.41: ما تغيّر — الصيغة السابقة التي يعرضها الموقع الرئيسي حتى يعتمد الشيخ الجديدة */
function reviewPrevHTML(x){
  var p = x && x.prev; if (!p || typeof p !== 'object') return '';
  var parts = ['text', 'desc', 'question', 'source'].filter(function(f){ return typeof p[f] === 'string' && p[f] !== x[f]; });
  if (!parts.length) return '';
  return '<details class="rv-prev"><summary>↩️ الصيغة السابقة (المعروضة الآن على الموقع الرئيسي)</summary>' +
    parts.map(function(f){ return '<div class="rv-desc">' + reviewRich(p[f]) + '</div>'; }).join('') + '</details>';
}
function reviewSectionTitle(id){ var s = (CURRICULUM || []).find(function(x){ return x.id === id; }); return s ? (s.emoji || '') + ' ' + s.title : id; }

function openSheikhReview(){
  var v = document.getElementById('view-review');
  if (!v){
    v = document.createElement('div'); v.id = 'view-review'; v.className = 'app';
    document.body.appendChild(v);
  }
  var st = reviewLoad();
  if (!st.reviewer && STATE && STATE.sheikhName) { st.reviewer = STATE.sheikhName; reviewSave(st); }
  REVIEW_VIEW.from = document.getElementById('view-studio').classList.contains('hidden') ? 'view-setup' : 'view-studio';
  document.getElementById('view-studio').classList.add('hidden');
  document.getElementById('view-setup').classList.add('hidden');
  v.classList.remove('hidden');
  renderSheikhReview();
  window.scrollTo(0, 0);
}
function closeSheikhReview(){
  var v = document.getElementById('view-review'); if (v) v.classList.add('hidden');
  document.getElementById(REVIEW_VIEW.from || 'view-setup').classList.remove('hidden');
  window.scrollTo(0, 0);
}
function reviewStats(units, st){
  var done = 0, pend = 0, pendDone = 0, edit = 0, drop = 0;
  units.forEach(function(u){ var d = reviewDecisionOf(st, u); if (d){ done++; if (d.d === 'edit') edit++; if (d.d === 'drop') drop++; } if (u.pending){ pend++; if (d) pendDone++; } });
  return {total: units.length, done: done, pend: pend, pendDone: pendDone, edit: edit, drop: drop};
}
function renderSheikhReview(){
  var v = document.getElementById('view-review'); if (!v) return;
  var st = reviewLoad(), units = reviewUnits(), S = reviewStats(units, st);
  var secs = (CURRICULUM || []).map(function(s){ return s.id; });
  if (!REVIEW_VIEW.section || secs.indexOf(REVIEW_VIEW.section) < 0) REVIEW_VIEW.section = secs[0] || '';
  var inSec = units.filter(function(u){ return u.sec === REVIEW_VIEW.section; });
  var f = REVIEW_VIEW.filter;
  var shown = inSec.filter(function(u){
    var d = reviewDecisionOf(st, u);
    if (f === 'undone') return !d; if (f === 'edit') return d && d.d !== 'ok'; if (f === 'pending') return u.pending; return true;
  });
  if (f === 'pending_first') shown.sort(function(a, b){ return (b.pending ? 1 : 0) - (a.pending ? 1 : 0); });
  var pct = S.total ? Math.round(S.done / S.total * 100) : 0;
  var h = '<div class="card"><h2>📋 مراجعة الشيخ العلمية</h2>' +
    '<div class="notice info">لكل وحدة: <b>✅ صحيح</b>، أو <b>✏️ يحتاج تعديلًا</b> (اكتب التعديل)، أو <b>🗑️ يُحذف</b>. تُحفظ قراراتك على هذا الجهاز، فتكمل متى شئت. في النهاية «تصدير ملف المراجعة» وأرسله إلى المشرف.<br>' +
    '<b>المعلّق</b> = ما لم يُعرض على الطلاب بعد لأنه ينتظر مراجعتك.</div>' +
    '<div class="form-group"><label>اسم المراجع</label><input type="text" id="rv-reviewer" maxlength="80" value="' + reviewEsc(st.reviewer) + '"></div>' +
    '<div class="rv-progress"><b>' + S.done + ' من ' + S.total + '</b> (' + pct + '%) · المعلّق: ' + S.pendDone + ' من ' + S.pend + ' · تعديل: ' + S.edit + ' · حذف: ' + S.drop + '</div>' +
    '<div class="progress-track"><div style="width:' + pct + '%"></div></div>' +
    '<div class="rv-bar"><select id="rv-section">' + secs.map(function(id){
      var us = units.filter(function(u){ return u.sec === id; }), dn = us.filter(function(u){ return reviewDecisionOf(st, u); }).length;
      return '<option value="' + reviewEsc(id) + '"' + (id === REVIEW_VIEW.section ? ' selected' : '') + '>' + reviewEsc(reviewSectionTitle(id)) + ' — ' + dn + '/' + us.length + '</option>'; }).join('') + '</select>' +
    '<select id="rv-filter">' + [['pending_first', 'الكل (المعلّق أولًا)'], ['pending', 'المعلّق فقط'], ['undone', 'ما لم أراجعه'], ['edit', 'ما طلبت تعديله أو حذفه']].map(function(o){ return '<option value="' + o[0] + '"' + (o[0] === f ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>';
  if (!shown.length) h += '<div class="notice info">لا شيء هنا بهذا المرشّح.</div>';
  shown.forEach(function(u){
    var d = reviewDecisionOf(st, u), stale = st.decisions[u.uid] && !d;
    var badge = u.kind === 'matn' ? '📖 أبيات المتن وشرح الدرس' : u.kind === 'task' ? '🎙️ مهمة تلاوة' : (u.kind === 'exam' ? '🎓 بنك الاختبار · ' : '❓ ') + (REVIEW_TYPE[u.x.type] || u.x.type);
    h += '<div class="card rv-card' + (d ? ' rv-' + d.d : '') + '" data-uid="' + reviewEsc(u.uid) + '">' +
      '<div class="rv-head"><span class="rv-badge">' + badge + '</span>' + (u.pending ? '<span class="rv-pend">معلّق</span>' : '') + '<span class="rv-id">' + reviewEsc(u.x.id) + '</span></div>' +
      (stale ? '<div class="notice warn">تغيّر النص بعد مراجعتك السابقة؛ راجعه من جديد.</div>' : '') +
      reviewBody(u) +
      '<div class="rv-actions">' +
      '<button type="button" class="btn sm' + (d && d.d === 'ok' ? ' success' : ' ghost') + '" data-call=\'["reviewDecide","' + u.uid + '","ok"]\'>✅ صحيح</button>' +
      '<button type="button" class="btn sm' + (d && d.d === 'edit' ? ' gold' : ' ghost') + '" data-call=\'["reviewDecide","' + u.uid + '","edit"]\'>✏️ يحتاج تعديلًا</button>' +
      '<button type="button" class="btn sm' + (d && d.d === 'drop' ? ' danger' : ' ghost') + '" data-call=\'["reviewDecide","' + u.uid + '","drop"]\'>🗑️ يُحذف</button></div>' +
      '<textarea class="rv-note" rows="2" placeholder="ملاحظة أو التعديل المطلوب (مطلوبة مع «يحتاج تعديلًا»)" data-note="' + reviewEsc(u.uid) + '">' + reviewEsc(d ? d.note || '' : '') + '</textarea>' +
      '</div>';
  });
  h += '<div class="card"><button type="button" class="btn success block" data-call=\'["exportSheikhReview"]\'>💾 تصدير ملف المراجعة</button>' +
    '<button type="button" class="btn ghost block" style="margin-top:10px" data-call=\'["closeSheikhReview"]\'>↩ رجوع</button></div>';
  v.innerHTML = h;
  var sel = document.getElementById('rv-section'); if (sel) sel.addEventListener('change', function(){ REVIEW_VIEW.section = sel.value; renderSheikhReview(); window.scrollTo(0, 0); });
  var fl = document.getElementById('rv-filter'); if (fl) fl.addEventListener('change', function(){ REVIEW_VIEW.filter = fl.value; renderSheikhReview(); });
  var rn = document.getElementById('rv-reviewer'); if (rn) rn.addEventListener('change', function(){ var s2 = reviewLoad(); s2.reviewer = rn.value.trim().slice(0, 80); reviewSave(s2); });
  Array.prototype.forEach.call(v.querySelectorAll('textarea[data-note]'), function(t){
    t.addEventListener('change', function(){ // تعديل الملاحظة بعد القرار يُحفظ مع القرار نفسه
      var s2 = reviewLoad(), uid = t.getAttribute('data-note'), d = s2.decisions[uid];
      if (d){ d.note = t.value.trim().slice(0, 2000); reviewSave(s2); }
    });
  });
}
function reviewDecide(uid, d){
  var u = reviewUnits().find(function(x){ return x.uid === uid; }); if (!u || ['ok', 'edit', 'drop'].indexOf(d) < 0) return;
  var card = document.querySelector('.rv-card[data-uid="' + uid.replace(/["\\]/g, '') + '"]');
  var note = card ? (card.querySelector('textarea[data-note]') || {}).value || '' : '';
  note = String(note).trim().slice(0, 2000);
  if (d === 'edit' && !note){ alert('اكتب التعديل المطلوب في خانة الملاحظة، ثم اضغط «يحتاج تعديلًا».'); var t = card && card.querySelector('textarea'); if (t) t.focus(); return; }
  var st = reviewLoad();
  var cur = reviewDecisionOf(st, u);
  if (cur && cur.d === d && note === (cur.note || '')) delete st.decisions[uid]; // الضغط مرة ثانية يلغي القرار
  else st.decisions[uid] = {d: d, note: note, h: u.h, at: new Date().toISOString()};
  var rn = document.getElementById('rv-reviewer'); if (rn && rn.value.trim()) st.reviewer = rn.value.trim().slice(0, 80);
  reviewSave(st);
  var y = window.scrollY; renderSheikhReview(); window.scrollTo(0, y);
}
function exportSheikhReview(){
  var st = reviewLoad(), units = reviewUnits(), S = reviewStats(units, st);
  var rn = document.getElementById('rv-reviewer'); if (rn && rn.value.trim()){ st.reviewer = rn.value.trim().slice(0, 80); reviewSave(st); }
  if (!st.reviewer){ alert('اكتب اسم المراجع أولًا.'); if (rn) rn.focus(); return; }
  var dec = {};
  units.forEach(function(u){ var d = reviewDecisionOf(st, u); if (d) dec[u.uid] = d; });
  if (!Object.keys(dec).length){ alert('لم تُسجَّل أي مراجعة بعد.'); return; }
  var out = {type: 'rifaq_sheikh_review', v: 1, reviewer: st.reviewer, exportedAt: new Date().toISOString(), appVersion: APP_VERSION,
    coverage: {units: S.total, reviewed: S.done, pending: S.pend, pendingReviewed: S.pendDone}, decisions: dec};
  var blob = new Blob([JSON.stringify(out, null, 1)], {type: 'application/json'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'مراجعة_الشيخ_' + st.reviewer.replace(/[\\\/:*?"<>|\s]+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  log('sheikh-review-exported', out.coverage);
}
