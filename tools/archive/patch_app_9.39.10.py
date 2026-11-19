# -*- coding: utf-8 -*-
"""9.39.10: إصلاحات المراجعة الشاملة التي لا تحتاج قرار المالك (التفاعل، حسابات التقييم، مسار حذف بديل).
شغّله من جذر المستودع ثم tools/rebuild_html.py — قابل لإعادة التشغيل (كل تعديل يُطبَّق مرة واحدة ويُتحقق من تفرّده)."""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = []
def rep(old, new): R.append((old, new))

# ---------------- عام: التكبير، الأنماط ----------------
rep('content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"',
    'content="width=device-width,initial-scale=1,viewport-fit=cover"')
rep('.toast{position:fixed;bottom:20px;', '.toast{pointer-events:none;position:fixed;bottom:20px;')
rep('.modal{background:#fff;border-radius:20px;padding:22px;max-width:420px;width:100%;text-align:center}',
    '.modal{background:#fff;border-radius:20px;padding:22px;max-width:420px;width:100%;text-align:center;max-height:88vh;overflow:auto}')
rep('@media (prefers-reduced-motion:reduce){.qx-shake,.qx-pulse{animation:none}}',
    '@media (prefers-reduced-motion:reduce){.qx-shake,.qx-pulse{animation:none}.confetti{display:none}}\n'
    '/* 9.39.10: أهداف لمس لا تقل عن 44px، ومنع تكبير النقر المزدوج بلا منع التكبير، وخط يعرض علامات الضبط القرآنية */\n'
    '.btn,.option-btn,.qx-chip,.qx-color,.qx-tok{min-height:44px;touch-action:manipulation}\n'
    '.qx-letters .qx-tok{min-width:38px}\n'
    '.rec-actions .btn.rec-del{min-width:44px;flex:0 0 auto;padding:6px 10px;font-size:.85rem;background:#fff;color:#c62828;border:1.5px solid #ef9a9a}\n'
    'input[type=checkbox]{width:22px;height:22px;flex:0 0 auto}\n'
    '.qx-tok.tried{opacity:.45}\n'
    '.quran,.content-text,.qx-text{font-family:"Amiri Quran","KFGQPC Uthmanic Script HAFS","Noto Naskh Arabic","Scheherazade New","Amiri",Tahoma,Arial,sans-serif}\n'
    '.no-master{font-size:.82rem;color:#5d4037;background:#fff8e1;border-radius:10px;padding:6px 10px;margin:6px 0}\n'
    '.gift-details summary{cursor:pointer;font-weight:800;margin-top:6px}')

# ---------------- الرجوع في الهاتف + إزالة القصاصات عند تغيير الشاشة ----------------
rep("""  if (id !== 'view-certificate' && id !== 'view-preview') window.scrollTo(0, 0);
}""", """  if (id !== 'view-certificate' && id !== 'view-preview') window.scrollTo(0, 0);
  try { document.querySelectorAll('.confetti').forEach(function(c){ c.remove(); }); } catch(e){}
  navGuardSync(id);
}
/* 9.39.10: زر «رجوع» في الهاتف/المتصفح يعود داخل التطبيق (إلى الخريطة) بدل الخروج منه وفقد الاختبار الجاري */
var NAV_GUARD = false;
var NAV_DEEP = ['view-lesson','view-quiz','view-results','view-profile','view-certificate','view-preview'];
function currentViewId(){ for (var i = 0; i < NAV_DEEP.length; i++){ var el = document.getElementById(NAV_DEEP[i]); if (el && !el.classList.contains('hidden')) return NAV_DEEP[i]; } return null; }
function navGuardSync(id){
  if (NAV_DEEP.indexOf(id) < 0 || NAV_GUARD) return;
  try { history.pushState({rifaqNav: 1}, ''); NAV_GUARD = true; } catch(e){}
}
window.addEventListener('popstate', function(){
  if (!NAV_GUARD) return;
  NAV_GUARD = false;
  var cur = currentViewId(); if (!cur) return;
  if (cur === 'view-quiz' && !confirmLeaveQuiz()){ navGuardSync('view-quiz'); return; }
  if (cur === 'view-certificate' && typeof closeCertificate === 'function'){ try { closeCertificate(); return; } catch(e){} }
  goHome();
});""")

# ---------------- شريط الاختبار: تأكيد قبل الإعادة/الدرس السابق ----------------
rep("""  bar.appendChild(mk('‹ الدرس السابق', function(){ if (prev) openSection(prev.id); }, !prev || synthetic));
  bar.appendChild(mk('↺ إعادة الاختبار', function(){ if (synthetic){ alert('الاختبار النهائي يُعاد من الخريطة بخطة جديدة.'); return; } startQuiz(); }, synthetic));""",
"""  bar.appendChild(mk('‹ الدرس السابق', function(){ if (prev && confirmLeaveQuiz()) openSection(prev.id); }, !prev || synthetic));
  bar.appendChild(mk('↺ إعادة الاختبار', function(){ if (synthetic){ toast('الاختبار النهائي يُعاد من الخريطة بخطة جديدة.'); return; } if (confirmLeaveQuiz()) startQuiz(); }, synthetic));""")
rep("""    b.style.cssText = 'flex:1;min-width:90px;padding:6px 8px;font-size:.85rem';""",
    """    b.style.cssText = 'flex:1;min-width:90px;min-height:44px;padding:6px 8px;font-size:.85rem';""")

# ---------------- التغذية الراجعة: ظاهرة دائمًا وبلغة الطفل ----------------
rep("""  fb.appendChild(btn);
}
function showFB(isCorrect, expl){""", """  fb.appendChild(btn);
  /* 9.39.10: الشرح بعد الإجابة كان يقع تحت حافة الشاشة الصغيرة فلا يراه الطفل */
  try { var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; fb.scrollIntoView({block: 'nearest', behavior: rm ? 'auto' : 'smooth'}); } catch(e){ try { fb.scrollIntoView(false); } catch(x){} }
}
function showFB(isCorrect, expl){""")
rep("""'❌ الإجابة غير دقيقة هذه المرة. {راجع|راجعي} التوضيح أدناه ثم {انتقل|انتقلي} إلى ال""",
    """'🤔 ليست هذه الإجابة. {انظر|انظري} السبب هنا 👇 ثم {انتقل|انتقلي} إلى ال""")

# ---------------- الألعاب: النقر المكرر على الخطأ نفسه لا يُحسب خطأً ثانيًا ----------------
rep("""          if (b.classList.contains('ok')) return;
          if (p.hit){ b.classList.add('ok'); found++;""", """          if (b.classList.contains('ok') || b.dataset.tried) return; /* 9.39.10: نقرة مكررة على الخطأ نفسه */
          if (p.hit){ b.classList.add('ok'); found++;""")
rep("""          else { b.classList.add('bad'); shake(b); api.mistake('ليس هنا، {ابحث|ابحثي} مرة أخرى'); setTimeout(function(){ b.classList.remove('bad'); }, 700); }""",
    """          else { b.dataset.tried = '1'; b.classList.add('bad'); shake(b); api.mistake('ليس هنا، {ابحث|ابحثي} مرة أخرى'); setTimeout(function(){ b.classList.remove('bad'); b.classList.add('tried'); }, 700); }""")
rep("""        if (t.rule === x.rules[cur]){ b.classList.add('ok');""", """        b._tried = b._tried || {};
        if (t.rule !== x.rules[cur] && b._tried[cur]) { shake(b); return; } /* 9.39.10: اللون الخطأ نفسه على الكلمة نفسها لا يُحسب مرتين */
        if (t.rule === x.rules[cur]){ b.classList.add('ok');""")
rep("""        else { shake(b); api.mistake(t.rule ? 'هذه الكلمة لها حكم آخر' : 'ليس في هذه الكلمة حكم من هذه الأحكام'); }""",
    """        else { b._tried[cur] = true; shake(b); api.mistake(t.rule ? 'هذه الكلمة لها حكم آخر' : 'ليس في هذه الكلمة حكم من هذه الأحكام'); }""")
rep("""        else { api.mistake('هذه ليست الكلمة المناسبة'); shake(c); shake(o.el); }""",
    """        else { c._tried = c._tried || []; if (c._tried.indexOf(o) >= 0){ shake(c); return; } c._tried.push(o); api.mistake('هذه ليست الكلمة المناسبة'); shake(c); shake(o.el); }""")

# ---------------- نصوص النتيجة مجنّسة ----------------
rep("""  var titles = ['', 'محاولة جيدة!', 'أداء رائع!', 'أنت بطل! 🌟'];
  var msgs = ['', 'استمر في التدريب', 'اقتربت من الكمال ✨', 'ممتاز، استمر 🎉'];
  $('result-title').textContent = titles[stars] || 'أحسنت';
  $('result-message').textContent = msgs[stars] || 'استمر';""",
"""  var titles = ['', 'محاولة جيدة!', 'أداء رائع!', '{أنت بطل|أنتِ بطلة}! 🌟'];
  var msgs = ['', '{استمر|استمري} في التدريب', '{اقتربت|اقتربتِ} من الكمال ✨', 'ممتاز، {استمر|استمري} 🎉'];
  $('result-title').textContent = GT(titles[stars] || '{أحسنت|أحسنتِ}');
  $('result-message').textContent = GT(msgs[stars] || '{استمر|استمري}');""")

# ---------------- عدّ الأقسام والنقاط بلا الأقسام الاصطناعية (الاختبار والمراجعة) ----------------
rep("""function recalcStats(){
  var tP = 0, comp = 0, perf = 0, att = 0;
  CURRICULUM.forEach(function(s){""", """function realSections(){ return CURRICULUM.filter(function(s){ return !s._synthetic; }); }
function recalcStats(){
  var tP = 0, comp = 0, perf = 0, att = 0;
  realSections().forEach(function(s){ /* 9.39.10: الاختبار والمراجعة ليسا أقسامًا من المنهج */""")
rep("""  var prev = STATE.progress[sec.id] || {bestScore: 0, stars: 0, attempts: 0};
  STATE.progress[sec.id] = {
    bestScore: Math.max(prev.bestScore, CURRENT.score),
    stars: Math.max(prev.stars, stars),
    attempts: (prev.attempts || 0) + 1
  };""", """  var prev = STATE.progress[sec.id] || {bestScore: 0, stars: 0, attempts: 0};
  if (!sec._synthetic) STATE.progress[sec.id] = {
    bestScore: Math.max(prev.bestScore, CURRENT.score),
    stars: Math.max(prev.stars, stars),
    attempts: (prev.attempts || 0) + 1
  };""")
rep("""  var completed = 0, totalStars = 0, maxStars = CURRICULUM.length * 3;
  CURRICULUM.forEach(function(sec){""", """  var _real = realSections();
  var completed = 0, totalStars = 0, maxStars = _real.length * 3;
  _real.forEach(function(sec){""")
rep("""  $('progress-label').textContent = completed + ' من ' + CURRICULUM.length + ' أقسام — '""",
    """  $('progress-label').textContent = completed + ' من ' + _real.length + ' أقسام — '""")
rep("""'/' + CURRICULUM.length + ' · إتقان: '""", """'/' + realSections().length + ' · إتقان: '""")
rep("""  var isPerfect = stats.perfectSections === CURRICULUM.length && stats.completedSections === CURRICULUM.length;""",
    """  var _n = realSections().length;
  var isPerfect = stats.perfectSections === _n && stats.completedSections === _n;""")
rep("""    : (isF ? 'أتمّت ' + stats.completedSections + ' من ' + CURRICULUM.length + ' أقسام.' : 'أتمّ ' + stats.completedSections + ' من ' + CURRICULUM.length + ' أقسام.');""",
    """    : (isF ? 'أتمّت ' + stats.completedSections + ' من ' + _n + ' أقسام.' : 'أتمّ ' + stats.completedSections + ' من ' + _n + ' أقسام.');""")
rep("""    total: CURRICULUM.length, perfect: stats.perfectSections,""", """    total: _n, perfect: stats.perfectSections,""")
rep("""function nextFromResults(){
  var idx = CURRICULUM.findIndex(function(s){ return s.id === CURRENT.section.id; });
  if (idx + 1 < CURRICULUM.length) openSection(CURRICULUM[idx + 1].id);
  else goHome();""", """function nextFromResults(){
  var _r = realSections();
  var idx = _r.findIndex(function(s){ return s.id === CURRENT.section.id; });
  if (idx >= 0 && idx + 1 < _r.length) openSection(_r[idx + 1].id);
  else goHome();""")

# ---------------- الإتقان: جولتان ناجحتان بأسئلة غير مكررة فعلًا ----------------
rep("""function assessRecordRound(state, id, setName, passed, nowIso){
  var c = assessConcept(state, id); c.rounds++;
  if (passed){
    c.failStreak = 0;
    /* إتقان: جولتان متتاليتان ناجحتان بنسختين مختلفتين */
    if (c.lastPass && c.lastSet && c.lastSet !== setName && !c.mastered){ c.mastered = true; c.masteredAt = nowIso; c.nextReview = assessNextReview(nowIso, 0); }
    c.lastPass = true;
  } else {
    c.lastPass = false; c.failStreak++;
    if (c.failStreak >= ASSESS_CFG.escalateAfter) c.escalated = true;
  }
  c.lastSet = setName;
  return c;
}""", """function assessRecordRound(state, id, setName, passed, nowIso, qids){
  var c = assessConcept(state, id); c.rounds++;
  var cur = Array.isArray(qids) ? qids.map(String).slice(0, 60) : null;
  if (passed){
    c.failStreak = 0;
    /* إتقان: جولتان متتاليتان ناجحتان بأسئلة مختلفة فعلًا. 9.39.10: كانت الجولة المختلطة تُسمّى باسم فريد في كل مرة،
       فتُعدّ «مختلفة» ولو تكررت الأسئلة نفسها. الآن يُقارن ما سُئل فعلًا، ولا يُقبل أي سؤال مكرر بين الجولتين. */
    var distinct;
    if (cur && Array.isArray(c.lastQs)) distinct = !cur.some(function(q){ return c.lastQs.indexOf(q) >= 0; });
    else distinct = !!(c.lastSet && c.lastSet !== setName && /^[AB]$/.test(String(c.lastSet)) && /^[AB]$/.test(String(setName)));
    if (c.lastPass && distinct && !c.mastered){ c.mastered = true; c.masteredAt = nowIso; c.nextReview = assessNextReview(nowIso, 0); }
    c.lastPass = true;
  } else {
    c.lastPass = false; c.failStreak++;
    if (c.failStreak >= ASSESS_CFG.escalateAfter) c.escalated = true;
  }
  c.lastSet = setName;
  c.lastQs = cur;
  return c;
}""")
rep("""    var setName = allA ? 'A' : (allB ? 'B' : ('X' + now));
    assessRecordRound(st, sid, setName, verdict[sid].ok, now);""",
    """    var setName = allA ? 'A' : (allB ? 'B' : ('X' + now));
    assessRecordRound(st, sid, setName, verdict[sid].ok, now, items.map(function(r){ return r.id; }));""")
rep("""  STATE.assess.lastExam = {at: now, total: results.length, correct: results.filter(function(r){ return r.ok; }).length, summary: summary};""",
    """  STATE.assess.lastExam = {at: now, total: results.length, correct: results.filter(function(r){ return r.ok; }).length, summary: summary,
    wrong: results.filter(function(r){ return !r.ok; }).map(function(r){ return String(r.id); }).slice(0, 80)}; /* 9.39.10: للتشخيص لدى المعلم */""")
rep("""  Object.keys(verdict).forEach(function(sid){
    var passed = !!verdict[sid];
    assessRecordRound(st, sid, setFor[sid] || 'A', passed, now);""", """  Object.keys(verdict).forEach(function(sid){
    var passed = !!verdict[sid];
    assessRecordRound(st, sid, setFor[sid] || 'A', passed, now, results.filter(function(r){ return map[r.id] === sid; }).map(function(r){ return r.id; }));""")
rep("""  return {v: 1, mastered: summ.mastered.slice(0, 40), pending: summ.pending.slice(0, 40), escalated: summ.escalated.slice(0, 40), at: new Date().toISOString()};""",
    """  /* 9.39.10: بيانات تشخيصية للمعلم: آخر اختبار وما أُخطئ فيه، ومحاولات كل مفهوم */
  var le = st.lastExam || null, rounds = {};
  Object.keys(st.concepts || {}).slice(0, 40).forEach(function(k){ var c = st.concepts[k] || {}; rounds[k] = {r: Number(c.rounds) || 0, f: Number(c.failStreak) || 0}; });
  return {v: 2, mastered: summ.mastered.slice(0, 40), pending: summ.pending.slice(0, 40), escalated: summ.escalated.slice(0, 40), at: new Date().toISOString(),
    lastExam: le ? {at: String(le.at || '').slice(0, 40), total: Number(le.total) || 0, correct: Number(le.correct) || 0, wrong: (Array.isArray(le.wrong) ? le.wrong : []).map(String).slice(0, 80)} : null,
    rounds: rounds};""")
rep("""      P.studentAssessment = {v: 1, mastered: clean(sa.mastered), pending: clean(sa.pending), escalated: clean(sa.escalated), at: String(sa.at || '').slice(0, 40)};""",
    """      var le0 = (sa.lastExam && typeof sa.lastExam === 'object') ? sa.lastExam : null, rd0 = (sa.rounds && typeof sa.rounds === 'object' && !Array.isArray(sa.rounds)) ? sa.rounds : {}, rd = {};
      Object.keys(rd0).slice(0, 40).forEach(function(k){ var o = rd0[k] || {}; rd[String(k).slice(0, 64)] = {r: Math.max(0, Math.min(9999, Number(o.r) || 0)), f: Math.max(0, Math.min(9999, Number(o.f) || 0))}; });
      P.studentAssessment = {v: 1, mastered: clean(sa.mastered), pending: clean(sa.pending), escalated: clean(sa.escalated), at: String(sa.at || '').slice(0, 40),
        lastExam: le0 ? {at: String(le0.at || '').slice(0, 40), total: Math.max(0, Math.min(999, Number(le0.total) || 0)), correct: Math.max(0, Math.min(999, Number(le0.correct) || 0)), wrong: clean(le0.wrong)} : null, rounds: rd};""")

# ---------------- المعلم: اسم المعلم يُقرأ من الحقل عند الإصدار؛ لا «المعلم المعلم» ----------------
rep("""  var effectiveTeacherName = (PACK_DATA.teacherName || ($('review-teacher-name') && $('review-teacher-name').value.trim()) || '');""",
    """  /* 9.39.10: الاسم المكتوب في الحقل الآن أولًا (كان يُهمل إن كُتب بعد الاعتماد فيصدر الإهداء باسم «المعلم») */
  var effectiveTeacherName = (($('review-teacher-name') && $('review-teacher-name').value.trim()) || TEACHER_STATE.name || PACK_DATA.teacherName || '');
  if (effectiveTeacherName){ PACK_DATA.teacherName = effectiveTeacherName; TEACHER_STATE.name = effectiveTeacherName; }""")
rep("""function hasTeacherFeedbacks(){""", """function teacherByline(){
  var g = PACK_DATA.teacherGender === 'girl' ? 'المعلمة' : 'المعلم', n = String(PACK_DATA.teacherName || '').trim();
  if (!n || n === 'المعلم' || n === 'المعلمة') return g;
  if (/^(ال(شيخ|شيخة|معلم|معلمة|أستاذ|أستاذة|مقرئ|مقرئة)|أ\\.|د\\.)/.test(n)) return n;
  return g + ' ' + n;
}
function hasTeacherFeedbacks(){""")
rep("""' • بإشراف ' + (PACK_DATA.teacherGender === 'girl' ? 'المعلمة ' : 'المعلم ') + (PACK_DATA.teacherName || '—');""",
    """' • بإشراف ' + teacherByline();""")
rep("""' · بإشراف ' + (PACK_DATA.teacherGender === 'girl' ? 'المعلمة ' : 'المعلم ') + (PACK_DATA.teacherName || '—');""",
    """' · بإشراف ' + teacherByline();""")
# زر ✕ في مراجعة المعلم كان يرميه إلى «رئيسية طالب» باسم «—» بلا رجوع
rep("""      <button class="btn ghost sm" data-call="[&quot;goHome&quot;]" type="button">✕</button>
    </div>
    <div class="review-stats">""", """    </div>
    <div class="review-stats">""")
rep("""  $('teacher-feedback-label').textContent = 'تعليق على العنصر ' + id + ' قبل رفضه من '+genderWord(PACK_DATA.teacherGender || 'boy','المعلم','المعلمة')+'.';""",
    """  $('teacher-feedback-label').textContent = 'تعليق على «' + itemLabelById(id) + '» قبل رفضه من '+genderWord(PACK_DATA.teacherGender || 'boy','المعلم','المعلمة')+'.';
  try { $('teacher-feedback-text').placeholder = genderWord(PACK_DATA.teacherGender || 'boy', 'اكتب', 'اكتبي') + ' ملاحظتك للطالب هنا (اختياري إذا سجلت صوتًا)'; } catch(e){}""")
rep("""<button class="btn danger" id="teacher-feedback-record" """, """<button class="btn ghost" id="teacher-feedback-record" """)
rep("""<button class="btn success" id="teacher-feedback-confirm" """, """<button class="btn danger" id="teacher-feedback-confirm" """)
rep("""<button class="btn danger block" data-call="[&quot;exportReturnedPack&quot;]" type="button">""",
    """<button class="btn gold block" data-call="[&quot;exportReturnedPack&quot;]" type="button">""")
rep("""  nodes.forEach(function(t){ var v = GT(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; });
}""", """  nodes.forEach(function(t){ var v = GT(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; });
  try { var host = root.nodeType === 1 ? root : root.parentNode; if (host && host.querySelectorAll) host.querySelectorAll('[placeholder*="|"]').forEach(function(el){ var p = el.getAttribute('placeholder'); var v = GT(p); if (v !== p) el.setAttribute('placeholder', v); }); } catch(e){}
}""")
# تشخيص الاختبار النظري لدى المعلم
rep("""    ab.textContent = (sa ? ('📊 الاختبار النظري: متقن ' + sa.mastered.length + '، قيد التدريب ' + sa.pending.length + (sa.escalated.length ? '، محالة للمعلم: ' + sa.escalated.join('، ') : '')) : """,
    """    var _secT = function(id){ var s = CURRICULUM.find(function(x){ return x.id === id; }); return s ? s.title : id; };
    var _le = sa && sa.lastExam, _leTxt = _le ? ' · آخر اختبار: ' + _le.correct + '/' + _le.total + (_le.wrong && _le.wrong.length ? ' (أخطاء في ' + _le.wrong.length + ' سؤالًا)' : '') : '';
    ab.textContent = (sa ? ('📊 الاختبار النظري: متقن ' + sa.mastered.length + '، قيد التدريب ' + sa.pending.length + (sa.escalated.length ? '، محالة للمعلم: ' + sa.escalated.map(_secT).join('، ') : '') + _leTxt) : """)

# ---------------- تسميات مفهومة بدل المعرّفات الداخلية ----------------
rep("""      try { var d = new DOMParser().parseFromString('<body>' + String(its[j].text || its[j].ayah || ''), 'text/html'); txt = (d.body.textContent || '').replace(/\\s+/g, ' ').trim(); } catch(e){}
      if (txt.length > 48) txt = txt.slice(0, 48) + '…';
      return (sec.title || '') + (txt ? ' · ' + txt : '') + ' (' + id + ')';""",
    """      var raw = String(its[j].text || its[j].ayah || '').replace(/<br\\s*\\/?>/gi, ' ').replace(/<\\/(span|div|p)>/gi, ' ');
      try { var d = new DOMParser().parseFromString('<body>' + raw, 'text/html'); txt = (d.body.textContent || '').replace(/\\s+/g, ' ').trim(); } catch(e){}
      if (txt.length > 48) txt = txt.slice(0, 48) + '…';
      return (sec.title || '') + (txt ? ' · ' + txt : ''); /* 9.39.10: بلا المعرّف الداخلي */""")
rep("""> شارِك هذا التسجيل ('+k+')</label>'""", """> شارِك تسجيل: '+escapeHTML(itemLabelById(k))+'</label>'""")
rep("""  html += '<div class="head"><span data-style="font-weight:900;color:var(--primary)">' + id + '</span>' + badge + '</div>';""",
    """  html += '<div class="head"><span data-style="font-weight:900;color:var(--primary)">' + escapeHTML(itemLabelById(id)) + '</span>' + badge + '</div>';""")
rep(""" type="button">\\U0001f4c1 \\u0627""", """ type="button">📁 \\u0627""")

# ---------------- الدرس: حالة فارغة لتلاوة الشيخ، وحالة «لم يُرسل بعد»، وزر حذف صغير ----------------
rep("""      html += audioPersonBlock(masterPhoto, masterGender, masterName, masterLabel, PACK_DATA.masterAudios[item.id], 'master-person-audio');
    }
""", """      html += audioPersonBlock(masterPhoto, masterGender, masterName, masterLabel, PACK_DATA.masterAudios[item.id], 'master-person-audio');
    } else {
      var _t0 = detectTextType({text: item.text});
      if (_t0 === 'quran' || _t0 === 'poem') html += '<div class="no-master">' + GT('🎧 لم يُضَف ' + (_t0 === 'quran' ? 'تسجيل الشيخ لهذه الآية' : 'إنشاد هذه الأبيات') + ' بعد. {اسأل|اسألي} معلمك عن القراءة الصحيحة.') + '</div>';
    }
""")
rep("""      var stLabel = st === 'approved' ? '✅ معتمد' : st === 'rejected' ? '❌ مرفوض' : '⏳ قيد المراجعة';""",
    """      var stLabel = st === 'approved' ? '✅ معتمد' : st === 'rejected' ? '❌ مرفوض' : (STATE.studentAudios[item.id].sentAt ? '⏳ في ملف الإرسال — بانتظار المعلم' : '💾 محفوظ عندك — لم يُرسل بعد');""")
rep("""        html += '<button class="btn danger" ' + ACT('deleteStudentRec', item.id) + ' type="button">🗑️</button>';""",
    """        html += '<button class="btn rec-del" ' + ACT('deleteStudentRec', item.id) + ' type="button" aria-label="حذف التسجيل" title="حذف التسجيل">🗑️</button>';""")
rep("""    var sizeKB = Math.round(byteSize / 1024);
    showModal('🎉 تم تجهيز الملف وتنزيله',""", """    var sizeKB = Math.round(byteSize / 1024);
    if (exportKind !== 'gift'){ try { var _now = new Date().toISOString(); Object.keys(fullPack.studentAudios || {}).forEach(function(k){ if (STATE.studentAudios[k] && fullPack.studentAudios[k].status === 'pending') STATE.studentAudios[k].sentAt = _now; }); save(); } catch(e){} }
    showModal('🎉 تم تجهيز الملف وتنزيله',""")

# ---------------- رسائل الطفل: بلا نوافذ متصفح للمعلومات، وبلغة يفهمها ----------------
rep("""  if (!name){ alert('اكتب اسمك أولاً / اكتبي اسمك أولًا'); return; }""",
    """  if (!name){ toast('✍️ اكتب اسمك أولًا / اكتبي اسمك أولًا'); try { $('setup-name').focus(); } catch(e){} return; }""")
rep("""  if (!due.length){ alert('لا توجد مراجعات مستحقة الآن.'); return; }""", """  if (!due.length){ toast('👍 لا توجد مراجعات مستحقة الآن.'); return; }""")
rep("""  if (!qs.length){ alert('لا توجد أسئلة لهذه المراجعة.'); return; }""", """  if (!qs.length){ toast('لا توجد أسئلة لهذه المراجعة.'); return; }""")
rep("""alert(GT('التسجيل قصير جدًا، هل {قرأت|قرأتِ} الآية كاملة؟ {أعد|أعيدي} التسجيل.'));""",
    """toast(GT('⏱️ التسجيل قصير جدًا، هل {قرأت|قرأتِ} الآية كاملة؟ {أعد|أعيدي} التسجيل.'));""")
rep("""    alert('تعذر الوصول للميكروفون (' + e.name + '). تحقق من إذن الميكروفون وافتح الملف عبر HTTPS/localhost، أو استخدم خيار رفع تسجيل بديل.');""",
    """    showModal('🎙️ الميكروفون لا يعمل الآن', GT('{اطلب|اطلبي} من أحد الكبار أن يسمح للتطبيق باستخدام الميكروفون، ثم {جرّب|جرّبي} مرة أخرى.') +
      '\\n\\nللكبار: الإذن مرفوض أو لا يوجد ميكروفون (' + String(e && e.name || 'خطأ') + '). افتح إعدادات المتصفح أو الجهاز واسمح بالميكروفون. إن فتحت الملف مباشرة من مجلد على الجهاز فافتحه من تطبيق «رفاق التحفة» أو موقعه.',
      [{label: 'حسنًا', class: 'primary', action: closeModal}]);""")

# ---------------- «إعادة الضبط» 🔄 كانت تحذف بلا حماية الحذف (بلا علامة دائمة ولا انتظار اكتمال) ----------------
rep("""function showReset(){
  if (!confirm('حذف كل تقدمك وتسجيلاتك؟')) return;
  if (!confirm('متأكد؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  try { var req=indexedDB.deleteDatabase(DB_NAME); req.onsuccess=req.onerror=req.onblocked=function(){}; } catch(e){}
  location.reload();
}""", """function showReset(){
  /* 9.39.10: المسار المحمي نفسه لحذف بيانات الطفل (علامة دائمة، إبلاغ النوافذ، لا إعلان قبل الاكتمال، حذف النسخ في المضيفة) */
  return deleteChildDataOnDevice();
}""")

# ---------------- بيان الإهداء للمعلم: نافذة قابلة للتمرير بدل confirm الطويل ----------------
rep("""    '\\n\\nهل تريد إصدار الإهداء بهذا المحتوى؟';
  if (!confirm(msg)) return;
  await buildAndDownload({""", """    '\\n\\nهل تريد إصدار الإهداء بهذا المحتوى؟';
  /* 9.39.10: كان البيان (20 سطرًا وأكثر) في confirm المتصفح، فيُقطع في WebView أندرويد ولا يُقرأ */
  var go = await new Promise(function(res){
    showModal('🎁 قبل إصدار الإهداء', msg, [
      {label: '🎁 إصدار الإهداء', class: 'primary', action: function(){ closeModal(); res(true); }},
      {label: 'إلغاء', class: 'ghost', action: function(){ closeModal(); res(false); }}
    ]);
  });
  if (!go) return;
  await buildAndDownload({""")

# ---------------- المهدى إليه: الملخص ظاهر، وتفاصيل الدروس قابلة للطي ----------------
rep("""function refreshGiftContentsBox(){ var b = document.getElementById('gift-contents-box'); if (b) b.textContent = giftContentsDisplayText(); }""",
    """function renderGiftContentsBox(b){
  var txt = giftContentsDisplayText(), parts = txt.split('\\n\\n');
  var head = parts.shift() || '', rest = parts.join('\\n\\n');
  b.textContent = '';
  var h = document.createElement('div'); h.textContent = head; b.appendChild(h);
  if (rest){
    var d = document.createElement('details'); d.className = 'gift-details';
    var s = document.createElement('summary'); s.textContent = '📋 تفاصيل الدروس'; d.appendChild(s);
    var body = document.createElement('div'); body.textContent = rest; d.appendChild(body); b.appendChild(d);
  }
}
function refreshGiftContentsBox(){ var b = document.getElementById('gift-contents-box'); if (b) renderGiftContentsBox(b); }""")
rep("""    gcBox.textContent = giftContentsDisplayText();""", """    renderGiftContentsBox(gcBox);""")

# ---------------- «ملفي»: أسماء التسجيلات مفهومة، وحالة الإرسال صادقة، ولا أزرار تنتهي بـ«لا يوجد» ----------------
rep("""      var label = status === 'approved' ? '✅ معتمد' : status === 'rejected' ? '❌ مرفوض' : '⏳ قيد المراجعة';
      h += '<div data-style="padding:10px;border-bottom:1px solid #eef0f6;display:flex;justify-content:space-between;align-items:center;gap:8px">';
      h += '<div data-style="font-weight:800;color:var(--primary);font-size:.88rem">' + id + '</div>';""",
"""      var label = status === 'approved' ? '✅ معتمد' : status === 'rejected' ? '❌ مرفوض' : (STATE.studentAudios[id].sentAt ? '⏳ بانتظار المعلم' : '💾 لم يُرسل بعد');
      h += '<div data-style="padding:10px;border-bottom:1px solid #eef0f6;display:flex;justify-content:space-between;align-items:center;gap:8px">';
      h += '<div data-style="font-weight:800;color:var(--primary);font-size:.88rem">' + escapeHTML(itemLabelById(id)) + '</div>';""")
rep("""function editProfile(){ buildSetup(); show('view-student-setup'); }""",
"""function editProfile(){ buildSetup(); show('view-student-setup'); }
/* 9.39.10: زرّا «إعادة المفاهيم المخفقة» و«جلسة المراجعة» يظهران فقط حين يوجد ما يُعاد أو يُراجَع (كانا ينتهيان بتنبيه «لا يوجد») */
var _showProfileBase = showProfile;
showProfile = function(){
  var r = _showProfileBase.apply(this, arguments);
  try {
    var st = STATE.assess || null;
    var rt = document.getElementById('btn-retest'); if (rt) rt.classList.toggle('hidden', !(st && Array.isArray(st.pendingRetest) && st.pendingRetest.length));
    var rv = document.getElementById('btn-review-session'); if (rv) rv.classList.toggle('hidden', !(st && st.concepts && assessDueReviews(st, new Date().toISOString()).length));
  } catch(e){}
  return r;
};""")

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new in s: continue  # مطبَّق مسبقًا (بما فيه الإدراجات التي يحتوي نصّها الجديد على القديم)
        n = s.count(old)
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:110]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
