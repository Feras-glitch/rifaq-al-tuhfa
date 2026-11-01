import re, sys, json
p = 'app.html'
s = open(p, encoding='utf-8').read()
orig = s
def rep(old, new, count=1, label=''):
    global s
    n = s.count(old)
    assert n >= 1, f'NOT FOUND [{label}]: {old[:80]!r}'
    if count == 1:
        assert n == 1, f'AMBIGUOUS ({n}) [{label}]: {old[:80]!r}'
    s = s.replace(old, new)

# ---- version
rep("var APP_VERSION = '9.38';", "var APP_VERSION = '9.39';", label='ver')

# ---- R01: keep assess in normalizeState
rep("""  base.role = raw.role || null; base.sawSplash = !!raw.sawSplash; base.recipientOnboarded = !!raw.recipientOnboarded;
  return base;""",
"""  base.role = raw.role || null; base.sawSplash = !!raw.sawSplash; base.recipientOnboarded = !!raw.recipientOnboarded;
  /* 9.39 (R01): حالة التقييم كانت تُسقَط عند كل تحميل، فتضيع نتائج الاختبار النهائي والمراجعة المتباعدة */
  if (raw.assess && typeof raw.assess === 'object' && !Array.isArray(raw.assess)){
    var a = raw.assess;
    base.assess = {
      concepts: (a.concepts && typeof a.concepts === 'object') ? a.concepts : {},
      examDone: (a.examDone && typeof a.examDone === 'object') ? a.examDone : {},
      examPlan: (a.examPlan && typeof a.examPlan === 'object') ? a.examPlan : null,
      lastExam: (a.lastExam && typeof a.lastExam === 'object') ? a.lastExam : null,
      examFailedConcepts: Array.isArray(a.examFailedConcepts) ? a.examFailedConcepts : [],
      submittedAt: typeof a.submittedAt === 'string' ? a.submittedAt : null,
      history: Array.isArray(a.history) ? a.history : []
    };
    Object.keys(a).forEach(function(k){ if (!(k in base.assess)) base.assess[k] = a[k]; });
  }
  if (raw.consent && typeof raw.consent === 'object') base.consent = raw.consent;
  if (raw.stars && typeof raw.stars === 'object') base.stars = raw.stars;
  if (raw.giftExcluded && typeof raw.giftExcluded === 'object') base.giftExcluded = raw.giftExcluded;
  return base;""", label='R01')

# ---- undefined letter (5th option) + option shuffle with stable original index
rep("""    opts.innerHTML = q.options.map(function(o, i){
      var L = ['أ','ب','ج','د'];
      return '<button class="option-btn" data-idx="' + i + '" ' + ACT('answer', i) + '><span class="opt-letter">' + L[i] + '</span> ' + o + '</button>';
    }).join('');""",
"""/* 9.39: الحروف حتى ستة خيارات (كان الخامس يظهر undefined)، والخيارات تُخلط عند كل عرض مع إبقاء المؤشر الأصلي للتصحيح */
    var L = ['أ','ب','ج','د','هـ','و'];
    var order = q.options.map(function(_, i){ return i; });
    for (var oi = order.length - 1; oi > 0; oi--){ var oj = Math.floor(Math.random() * (oi + 1)); var ot = order[oi]; order[oi] = order[oj]; order[oj] = ot; }
    opts.innerHTML = order.map(function(i, pos){ return '<button class="option-btn" data-idx="' + i + '" ' + ACT('answer', i) + '><span class="opt-letter">' + (L[pos] || (pos + 1)) + '</span> ' + q.options[i] + '</button>'; }).join('');""", label='letters')

# ---- R06: carry trustedTeacherKeys in student export
rep("""      approvedStudentAudios: {}, // single source: approvedPeerRecordings""",
"""      approvedStudentAudios: {}, // single source: approvedPeerRecordings
      trustedTeacherKeys: Array.isArray(PACK_DATA.trustedTeacherKeys) ? PACK_DATA.trustedTeacherKeys : [], // 9.39 (R06): سلسلة الثقة كانت تنقطع هنا""", label='R06')

# ---- R07: gift must not carry identity/assessment unless shared
rep("""    newPack.sourceGiftStudentName = PACK_DATA.studentName || '';
    newPack.sourceGiftStudentPhoto = PACK_DATA.studentPhoto || null;
    newPack.sourceGiftStudentGender = PACK_DATA.studentGender || 'boy';""",
"""    /* 9.39 (R07): بيانات الطفل الخاصة لا تنتقل إلى الإهداء إطلاقًا، واسمه وصورته فقط عند إذن المشاركة */
    ['studentName','studentId','studentPhoto','studentGender','studentAssessment','teacherRatings','teacherNotes','teacherFeedbacks','reviewCount','submissionVersion','teacherRepliedAt','studentConsent'].forEach(function(k){ delete newPack[k]; });
    var _gc = PACK_DATA.studentConsent || {};
    var _gShare = !!(_gc.v === 2 && _gc.permissions && _gc.permissions.shareWithPeers === true);
    newPack.sourceGiftStudentName = _gShare ? (PACK_DATA.studentName || '') : '';
    newPack.sourceGiftStudentPhoto = _gShare ? (PACK_DATA.studentPhoto || null) : null;
    newPack.sourceGiftStudentGender = _gShare ? (PACK_DATA.studentGender || 'boy') : 'boy';""", label='R07')

# ---- R04: scoped, awaited deletion
rep("""    if (indexedDB.databases){
      var dbs = await indexedDB.databases();
      for (var i = 0; i < dbs.length; i++){ if (dbs[i].name && dbs[i].name.indexOf(DB_BASE) === 0) indexedDB.deleteDatabase(dbs[i].name); }
    } else { indexedDB.deleteDatabase(DB_NAME); }
  } catch(e){ console.warn('db delete', e); }
  try {
    Object.keys(localStorage).forEach(function(k){ if (k.indexOf(STORAGE_BASE) === 0 || k === ACTIVE_PROFILE_KEY) localStorage.removeItem(k); });
  } catch(e){}
  alert('تم حذف بيانات الطالب من هذا الجهاز. سيُعاد فتح التطبيق.');""",
"""    /* 9.39 (R04): الحذف يخص الطفل الحالي وحده (قاعدته ومفتاح حالته)، ويُنتظر اكتمال الحذف قبل الإعلان */
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
  alert('تم حذف بيانات هذا الطالب من هذا الجهاز. سيُعاد فتح التطبيق.');""", label='R04')

# ---- R02: manifest v3 covers student audio hashes, identities, trusted keys
rep("""  var rat = await sha256b64(JSON.stringify(pack.teacherRatings || {}));
  return JSON.stringify({v: 2, packageId: String(pack.packageId || ''), packageType: String(pack.packageType || ''), sourceGiftStudentName: String(pack.sourceGiftStudentName || ''), groups: groups, masters: masters, curr: curr, notes: notes, fb: fb, statuses: st, rat: rat});""",
"""  var rat = await sha256b64(JSON.stringify(pack.teacherRatings || {}));
  /* 9.39 (R02): v3 يغطي صوت كل تسجيل للطالب وهويته وهوية المعلم وبصمات قائمة المفاتيح الموثوقة */
  var sa = {}; var sKeys = Object.keys(pack.studentAudios || {}).sort();
  for (var si = 0; si < sKeys.length; si++){ var sr = (pack.studentAudios || {})[sKeys[si]] || {}; sa[sKeys[si]] = await sha256b64(String(sr.audio || '')); }
  var tk = (Array.isArray(pack.trustedTeacherKeys) ? pack.trustedTeacherKeys : []).map(function(k){ try { return jwkThumb(k); } catch(e){ return ''; } }).sort();
  return JSON.stringify({v: 3, packageId: String(pack.packageId || ''), packageType: String(pack.packageType || ''), sourceGiftStudentName: String(pack.sourceGiftStudentName || ''), studentId: String(pack.studentId || ''), studentName: String(pack.studentName || ''), teacherName: String(pack.teacherName || ''), trustedKeys: tk, groups: groups, masters: masters, curr: curr, notes: notes, fb: fb, statuses: st, studentAudioHashes: sa, rat: rat});""", label='R02')

# ---- CALLABLE_ALLOW active
names = set(re.findall(r"ACT\('([A-Za-z_]\w*)'", s))
names |= set(re.findall(r'data-call="\[&quot;([A-Za-z_]\w*)&quot;', s))
names |= set(re.findall(r'data-call=\\?"\[\\"([A-Za-z_]\w*)\\"', s))
names |= set(re.findall(r"data-call=\"\[\\\"([A-Za-z_]\w*)", s))
names |= set(re.findall(r'data-call="\["([A-Za-z_]\w*)"', s))
names |= set(re.findall(r"'\[\"([A-Za-z_]\w*)\"", s))
names |= set(re.findall(r'data-change="([A-Za-z_]\w*)"', s))
names |= set(re.findall(r"data-change=\\?\"([A-Za-z_]\w*)", s))
names = sorted(n for n in names if n not in ('answer_',))
rep("var CALLABLE_ALLOW = null;",
    "var CALLABLE_ALLOW = " + json.dumps(names, ensure_ascii=False) + "; /* 9.39: قائمة الدوال التي يجوز استدعاؤها من data-call/data-change */", label='allow-decl')
rep("""  var fn = window[spec[0]];
  if (typeof fn !== 'function' || !/^[A-Za-z_]\\w*$/.test(spec[0])) { console.warn('unknown action', spec[0]); return; }""",
"""  var fn = window[spec[0]];
  if (CALLABLE_ALLOW && CALLABLE_ALLOW.indexOf(spec[0]) < 0){ console.warn('action not allowed', spec[0]); return; }
  if (typeof fn !== 'function' || !/^[A-Za-z_]\\w*$/.test(spec[0])) { console.warn('unknown action', spec[0]); return; }""", label='allow-click')
rep("""  var name = el.getAttribute('data-change'); var fn = window[name];
  if (typeof fn !== 'function' || !/^[A-Za-z_]\\w*$/.test(name)) return;""",
"""  var name = el.getAttribute('data-change'); var fn = window[name];
  if (CALLABLE_ALLOW && CALLABLE_ALLOW.indexOf(name) < 0) return;
  if (typeof fn !== 'function' || !/^[A-Za-z_]\\w*$/.test(name)) return;""", label='allow-change')

# ---- gender: placeholder + masculine student-facing strings
rep("""  $('setup-boy').classList.toggle('selected', g === 'boy');
  $('setup-girl').classList.toggle('selected', g === 'girl');""",
"""  $('setup-boy').classList.toggle('selected', g === 'boy');
  $('setup-girl').classList.toggle('selected', g === 'girl');
  var _ni = $('setup-name'); if (_ni) _ni.placeholder = (g === 'girl' ? 'اكتبي' : 'اكتب') + ' اسمك الكامل';""", label='placeholder')
rep('placeholder="{اكتب|اكتبي} اسمك الكامل"', 'placeholder="اكتب اسمك الكامل"', label='ph-html')
rep("t.textContent = '⚠️ اكتملت المهمة مع بعض الأخطاء. راجع التوضيح أدناه';", "t.textContent = GT('⚠️ اكتملت المهمة مع بعض الأخطاء. {راجع|راجعي} التوضيح أدناه');", label='g1')
rep("recAgain:'🔄 أعد الإنشاد'", "recAgain:'🔄 {أعد|أعيدي} الإنشاد'", label='g2')
rep("alert('اكتب اسمك أولاً');", "alert('اكتب اسمك أولاً / اكتبي اسمك أولًا');", label='g3')
rep("'🔴 جارٍ التسجيل... اضغط الزر نفسه للإيقاف'", "GT('🔴 جارٍ التسجيل... {اضغط|اضغطي} الزر نفسه للإيقاف')", label='g4')
rep("alert('هذه الجلسة اكتملت. ابدأ الجلسة الأخرى.');", "alert(GT('هذه الجلسة اكتملت. {ابدأ|ابدئي} الجلسة الأخرى.'));", label='g5')
rep("alert('التسجيل قصير جدًا، هل قرأت الآية كاملة؟ أعد التسجيل.');", "alert(GT('التسجيل قصير جدًا، هل {قرأت|قرأتِ} الآية كاملة؟ {أعد|أعيدي} التسجيل.'));", label='g6')
# wrong-answer feedback
m = re.search(r"'❌ الإجابة غير دقيقة هذه المرة\. راجع التوضيح أدناه ثم انتقل إل[^']*'", s)
assert m, 'fb string'
rep(m.group(0), "'❌ الإجابة غير دقيقة هذه المرة. {راجع|راجعي} التوضيح أدناه ثم {انتقل|انتقلي} إلى السؤال التالي'", label='g7')

# ---- counters: Arabic number agreement
rep("""html += '<div class="sec-meta">' + sec.items.length + ' عنصر · ' + sec.questions.length + ' سؤال</div>';""",
"""html += '<div class="sec-meta">' + arCount(sec.items.length, 'عنصر', 'عنصران', 'عناصر') + ' · ' + arCount(sec.questions.length, 'سؤال', 'سؤالان', 'أسئلة') + '</div>';""", label='count1')
rep("""الاختبار (' + sec.questions.length + ' أسئلة)</button>';""", """الاختبار (' + arCount(sec.questions.length, 'سؤال', 'سؤالان', 'أسئلة') + ')</button>';""", label='count2')
rep("function GT(t){", """/* 9.39: تمييز العدد العربي للعدادات */
function arCount(n, one, two, few){ n = Number(n) || 0; if (n === 1) return one + ' واحد'; if (n === 2) return two; if (n >= 3 && n <= 10) return n + ' ' + few; return n + ' ' + one + (one.slice(-1) === 'ة' ? '' : 'ًا'); }
function GT(t){""", label='arCount')

# ---- "بإشراف المعلم المعلم"
rep("""$('splash-name').textContent = 'بإشراف ' + (tg === 'girl' ? 'المعلمة ' : 'المعلم ') + (PACK_DATA.teacherName || 'المعلم');""",
"""$('splash-name').textContent = 'بإشراف ' + (tg === 'girl' ? 'المعلمة' : 'المعلم') + (PACK_DATA.teacherName && PACK_DATA.teacherName !== 'المعلم' ? ' ' + PACK_DATA.teacherName : '');""", label='teacher-dup1')
rep("""  var sub = 'بإشراف ' + (PACK_DATA.teacherGender === 'girl' ? 'المعلمة ' : 'المعلم ') + (PACK_DATA.teacherName || PACK_DATA.supervisorName || '—');""",
"""  var _tn = PACK_DATA.teacherName || PACK_DATA.supervisorName || '';
  var sub = 'بإشراف ' + (PACK_DATA.teacherGender === 'girl' ? 'المعلمة' : 'المعلم') + (_tn && _tn !== 'المعلم' ? ' ' + _tn : '');""", label='teacher-dup2')

# ---- teacher page: item label + student gender
rep("""h += '<div class="head"><div class="dot"></div><div class="label">' + it.id + '</div>';""",
"""h += '<div class="head"><div class="dot"></div><div class="label">' + escapeHTML(itemLabelById(it.id)) + '</div>';""", label='item-label')
rep("""<div class="mini-label">الطالب صاحب التسجيلات</div>""", """<div class="mini-label">'+(PACK_DATA.studentGender==='girl' ? 'الطالبة صاحبة التسجيلات' : 'الطالب صاحب التسجيلات')+'</div>""", label='student-gender')
rep("function arabicReviewOrdinal(n){", """/* 9.39: عنوان مقروء للعنصر في صفحة المعلم بدل المعرّف الخام */
function itemLabelById(id){
  for (var i = 0; i < CURRICULUM.length; i++){
    var sec = CURRICULUM[i];
    var its = (sec.items || []).concat(sec.questions || []);
    for (var j = 0; j < its.length; j++){
      if (its[j].id !== id) continue;
      var txt = '';
      try { var d = new DOMParser().parseFromString('<body>' + String(its[j].text || its[j].ayah || ''), 'text/html'); txt = (d.body.textContent || '').replace(/\\s+/g, ' ').trim(); } catch(e){}
      if (txt.length > 48) txt = txt.slice(0, 48) + '…';
      return (sec.title || '') + (txt ? ' · ' + txt : '') + ' (' + id + ')';
    }
  }
  return String(id);
}
function arabicReviewOrdinal(n){""", label='itemLabel')

# ---- pagination survives re-render after recording
rep("""  if (!c || c.dataset.paged === '1') return;""", """  if (!c || c.dataset.paged === '1') return;
  var startIdx = Number(c.dataset.pageIdx || 0) || 0;""", label='pg1')
rep("""  c.dataset.paged = '1';
  show(0);
}""", """  c.dataset.paged = '1';
  show(Math.min(startIdx, total - 1));
}
/* 9.39: إعادة عرض الدرس (بعد تسجيل أو حذف) تحافظ على تقسيم البطاقات والبطاقة الحالية */
var _renderLessonBase = renderLesson;
renderLesson = function(){
  var c0 = document.getElementById('lesson-content');
  var keep = c0 && c0.dataset.paged === '1' ? (c0.dataset.pageIdx || '0') : null;
  var r = _renderLessonBase.apply(this, arguments);
  var c = document.getElementById('lesson-content');
  if (c){ delete c.dataset.paged; if (keep !== null) c.dataset.pageIdx = keep; setTimeout(paginateLessonCards, 0); }
  return r;
};""", label='pg2')
rep("""    label.textContent = 'بطاقة ' + (idx + 1) + ' من ' + total;""", """    label.textContent = 'بطاقة ' + (idx + 1) + ' من ' + total; c.dataset.pageIdx = String(idx);""", label='pg3')

open(p, 'w', encoding='utf-8').write(s)
print('patched; allowlist size', len(names)); print(names)
