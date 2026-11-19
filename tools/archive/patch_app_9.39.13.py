# -*- coding: utf-8 -*-
"""9.39.13: تنفيذ قرارات المالك (13 نوفمبر 2026، «واثق على جميع توصياتك») — الدفعة الأولى، في التطبيق ونسخة التجربة.
- D3: خطأ واحد مسموح في جولة المفهوم ذي الأسئلة الثلاثة؛ ذو السؤالين يبقى بلا خطأ. الإتقان ما زال جولتين ناجحتين متتاليتين.
- D4-ب: ملخص الاختبار لا يكشف الجواب الصحيح ولا شرح السؤال؛ يدل على الدرس والبيت للمراجعة.
- D4-ج: 24 ساعة على الأقل بين جولتين للمفهوم نفسه (الإعادة والمراجعة).
- ق3-ب: اختبار الدرس 15 سؤالًا على الأكثر في كل محاولة، بنسبة أنواع الأسئلة وأحكامها كما في الدرس، والأسئلة غير المرئية أولًا.
- D7: رمز ولي الأمر (4 أرقام) يوضع عند الموافقة ويُحفظ ببصمة؛ نسيانه: مسألة حسابية بعد انتظار 60 ثانية ثم رمز جديد.
- D6: بعد تسجيل مشرف، الملف غير الموثّق يُعرض بالمنهج المعتمد المدمج (تحقنه الصفحة المضيفة) لا بمنهجه.
- D12: نسخة احتياطية واستعادة لتقدّم الطفل خلف بوابة ولي الأمر، والتسجيلات اختيارية، وتذكير كل درسين،
       وعلامة «مستعاد من نسخة احتياطية» تصل المعلم.
قابل لإعادة التشغيل. شغّله من جذر المستودع بعد سكربتات 9.39.12 ثم tools/rebuild_html.py"""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
VERSION = '9.39.13'
R = []
def rep(old, new): R.append((old, new))

# ---------------- الإصدار ----------------
rep("var APP_VERSION = '9.39.12';", "var APP_VERSION = '" + VERSION + "';")

# ---------------- D3 + D4-ج: محرك القياس ----------------
rep("""  escalateAfter: 4, reviewDays: [1, 3, 7, 14], reviewEveryDays: 30, teacherReplyHours: 48};""",
    """  escalateAfter: 4, reviewDays: [1, 3, 7, 14], reviewEveryDays: 30, teacherReplyHours: 48,
  allowWrong3: 1, minGapHours: 24}; // 9.39.13: D3 (خطأ واحد في المفهوم الثلاثي) وD4-ج (24 ساعة بين جولتين للمفهوم نفسه)""")
rep("""function assessRequired(id){ return ASSESS_CFG.bigConcepts.indexOf(id) >= 0 ? 3 : 2; }""",
    """function assessRequired(id){ return ASSESS_CFG.bigConcepts.indexOf(id) >= 0 ? 3 : 2; }
/* 9.39.13 (D3): جولة المفهوم ناجحة إن لم تتجاوز أخطاؤها المسموح: خطأ واحد إن كانت أسئلته ثلاثة فأكثر، ولا خطأ في السؤالين */
function assessRoundPassed(n, wrong){ n = Number(n) || 0; wrong = Number(wrong) || 0; return n > 0 && wrong <= (n >= 3 ? ASSESS_CFG.allowWrong3 : 0); }
/* 9.39.13 (D4-ج): أول وقت تُتاح فيه جولة جديدة للمفهوم (بالمللي ثانية)، أو 0 إن كان متاحًا الآن */
function assessReadyAt(state, id){ var c = state && state.concepts && state.concepts[id]; var t = c && c.lastAt ? new Date(c.lastAt).getTime() : NaN; return isFinite(t) ? t + ASSESS_CFG.minGapHours * 3600000 : 0; }
function assessIsReady(state, id, nowIso){ return assessReadyAt(state, id) <= new Date(nowIso).getTime(); }""")
rep("""  c.lastSet = setName;
  c.lastQs = cur;
  return c;""", """  c.lastSet = setName;
  c.lastQs = cur;
  c.lastAt = nowIso; // 9.39.13 (D4-ج)
  return c;""")
rep("""/* تسجيل جولة لمفهوم: setName = 'A' أو 'B'، passed = أجاب 100% */""",
    """/* تسجيل جولة لمفهوم: setName = 'A' أو 'B'، passed = نجحت الجولة (assessRoundPassed) */""")
rep("""  results.forEach(function(r){
    var sid = map[r.id]; if (!sid) return;
    verdict[sid] = verdict[sid] || {ok: true, sets: {}};
    if (!r.ok) verdict[sid].ok = false;
  });""", """  results.forEach(function(r){
    var sid = map[r.id]; if (!sid) return;
    verdict[sid] = verdict[sid] || {ok: true, n: 0, wrong: 0, sets: {}};
    verdict[sid].n++; if (!r.ok) verdict[sid].wrong++;
  });
  Object.keys(verdict).forEach(function(sid){ verdict[sid].ok = assessRoundPassed(verdict[sid].n, verdict[sid].wrong); }); // 9.39.13 (D3)""")
rep("""  results.forEach(function(r){ var sid = map[r.id]; if (!sid) return; verdict[sid] = (verdict[sid] !== false) && !!r.ok; });
  var now = new Date().toISOString();
  Object.keys(verdict).forEach(function(sid){
    var passed = !!verdict[sid];""", """  var cnt = {}; // 9.39.13 (D3)
  results.forEach(function(r){ var sid = map[r.id]; if (!sid) return; cnt[sid] = cnt[sid] || {n: 0, wrong: 0}; cnt[sid].n++; if (!r.ok) cnt[sid].wrong++; verdict[sid] = true; });
  var now = new Date().toISOString();
  Object.keys(verdict).forEach(function(sid){
    var passed = assessRoundPassed(cnt[sid].n, cnt[sid].wrong);""")

# D4-ج في الإعادة والمراجعة
rep("""  if (!ids.length){ alert('لا توجد مفاهيم تحتاج إعادة.'); return; }
  var secs = assessSections().filter(function(s){ return ids.indexOf(s.id) >= 0; });""",
    """  if (!ids.length){ alert('لا توجد مفاهيم تحتاج إعادة.'); return; }
  /* 9.39.13 (D4-ج): لا جولة للمفهوم نفسه قبل مرور 24 ساعة على جولته السابقة */
  var nowR = new Date().toISOString(), readyIds = ids.filter(function(id){ return assessIsReady(STATE.assess, id, nowR); });
  if (!readyIds.length){ alert(GT('⏳ الإعادة التالية متاحة ' + assessWaitText(ids) + '. المراجعة بعد يوم تثبّت الحفظ أكثر من الإعادة الفورية.')); return; }
  ids = readyIds;
  var secs = assessSections().filter(function(s){ return ids.indexOf(s.id) >= 0; });""")
rep("""  var st = STATE.assess || {}; var due = assessDueReviews(st, new Date().toISOString());
  if (!due.length){ toast('👍 لا توجد مراجعات مستحقة الآن.'); return; }""",
    """  var st = STATE.assess || {}; var nowV = new Date().toISOString(); var due = assessDueReviews(st, nowV).filter(function(id){ return assessIsReady(st, id, nowV); }); // 9.39.13 (D4-ج)
  if (!due.length){ toast('👍 لا توجد مراجعات مستحقة الآن.'); return; }""")
rep("""    var rt = document.getElementById('btn-retest'); if (rt) rt.classList.toggle('hidden', !(st && Array.isArray(st.pendingRetest) && st.pendingRetest.length));""",
    """    var rt = document.getElementById('btn-retest'); if (rt) rt.classList.toggle('hidden', !(st && Array.isArray(st.pendingRetest) && st.pendingRetest.length));
    if (rt && st && Array.isArray(st.pendingRetest) && st.pendingRetest.length){ // 9.39.13 (D4-ج)
      var nowB = new Date().toISOString(), anyReady = st.pendingRetest.some(function(id){ return assessIsReady(st, id, nowB); });
      rt.textContent = anyReady ? '🔁 إعادة المفاهيم التي لم تُتقن بعد' : ('🔁 الإعادة متاحة ' + assessWaitText(st.pendingRetest));
    }""")

# ---------------- D4-ب: ملخص الاختبار بلا الجواب الصحيح ----------------
rep("""      var ca = correctAnswerText(q); if (ca){ var a = document.createElement('div'); a.style.color = 'var(--success)'; a.textContent = 'الإجابة الصحيحة: ' + ca; it.appendChild(a); }
      if (q.explanation){ var ex = document.createElement('div'); ex.style.color = '#444'; ex.textContent = plainText(GT(q.explanation)); it.appendChild(ex); }""",
    """      /* 9.39.13 (D4-ب): لا جواب صحيح ولا شرح السؤال (الشرح يكشفه غالبًا)، فالسؤال قد يعود في جولة قادمة.
         يُدلّ الطفل على الدرس والبيت ليراجع الحكم نفسه. */
      var rv = document.createElement('div'); rv.style.color = '#1a3a6b'; rv.textContent = examReviewPointer(q, (sec._map || {})[q.id]); it.appendChild(rv);""")
rep("""var _finishQuizExamBase = finishQuiz;""", """/* 9.39.13 (D4-ب): «للمراجعة: درس كذا — البيت كذا» من مرجع البيت في الشرح، دون الشرح نفسه */
function examReviewPointer(q, sid){
  var m = String((q && q.explanation) || '').match(/\\((?:ال)?(بيتا?|الأبيات)\\s*([^)]*)\\)/);
  var bayt = m ? ('البيت ' + String(m[2]).trim()) : '';
  return GT('📖 للمراجعة: درس «' + (sid ? conceptTitle(sid) : '') + '»' + (bayt ? ' — ' + bayt : '') + '. {أعد|أعيدي} قراءة الحكم، ثم {جرّب|جرّبي} في الجولة القادمة.');
}
function assessWaitText(ids){
  var t = 0; (ids || []).forEach(function(id){ var r = assessReadyAt(STATE.assess, id); if (r && (!t || r < t)) t = r; });
  var h = Math.max(1, Math.ceil((t - Date.now()) / 3600000));
  return 'بعد ' + (h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : arCount(h, 'ساعة', 'ساعتان', 'ساعات'));
}
var _finishQuizExamBase = finishQuiz;""")

# ---------------- حالة الطالب: حقول جديدة تبقى بعد إعادة التحميل ----------------
rep("""  if (Array.isArray(raw.respLog)) base.respLog = raw.respLog.slice(-1500);
  return base;""", """  if (Array.isArray(raw.respLog)) base.respLog = raw.respLog.slice(-1500);
  /* 9.39.13: الأسئلة التي رآها الطفل في كل درس (ق3-ب)، وآخر نسخة احتياطية وعلامة الاستعادة (D12) */
  if (raw.quizSeen && typeof raw.quizSeen === 'object' && !Array.isArray(raw.quizSeen)){
    base.quizSeen = {}; Object.keys(raw.quizSeen).slice(0, 60).forEach(function(k){ if (Array.isArray(raw.quizSeen[k])) base.quizSeen[safeIdString(k)] = raw.quizSeen[k].slice(0, 200).map(safeIdString); });
  }
  if (typeof raw.lastBackupAt === 'string') base.lastBackupAt = raw.lastBackupAt.slice(0, 40);
  if (isFinite(Number(raw.lessonsAtBackup))) base.lessonsAtBackup = Number(raw.lessonsAtBackup) || 0;
  if (isFinite(Number(raw.backupNagAt))) base.backupNagAt = Number(raw.backupNagAt) || 0;
  if (raw.restored && typeof raw.restored === 'object') base.restored = cleanRestored(raw.restored);
  return base;""")

# ---------------- D7: رمز ولي الأمر في الموافقة ----------------
rep("""    '<input id="consent-name" type="text" maxlength="60" data-style="width:100%;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:12px;font:inherit">' +""",
    """    '<input id="consent-name" type="text" maxlength="60" data-style="width:100%;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:12px;font:inherit">' +
    (guardianPinSet() ? '' : '<label data-style="display:block;margin:10px 0 4px">رمز ولي الأمر (4 أرقام) — يُطلب قبل الإعدادات والتصفير، فلا {تخبر|تخبري} به الطفل:</label>' +
      '<div data-style="display:flex;gap:8px"><input id="consent-pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="4" placeholder="الرمز" data-style="flex:1;min-width:0;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:12px;font:inherit;text-align:center;direction:ltr">' +
      '<input id="consent-pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="4" placeholder="أعده" data-style="flex:1;min-width:0;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:12px;font:inherit;text-align:center;direction:ltr"></div>') +""")
rep("""  $('consent-ok').onclick = function(){
    var name = ($('consent-name').value || '').trim().slice(0, 60);
    if (name.length < 3){ $('consent-err').textContent = 'اكتب اسم ولي الأمر (٣ أحرف على الأقل).'; return; }
    if (!$('consent-record').checked || !$('consent-review').checked){ $('consent-err').textContent = 'الموافقتان الأولى والثانية مطلوبتان للتسجيل.'; return; }
    STATE.student = STATE.student || {};""", """  $('consent-ok').onclick = async function(){
    var name = ($('consent-name').value || '').trim().slice(0, 60);
    if (name.length < 3){ $('consent-err').textContent = 'اكتب اسم ولي الأمر (٣ أحرف على الأقل).'; return; }
    var pinErr = $('consent-pin') ? guardianPinProblem($('consent-pin').value, $('consent-pin2').value) : ''; // 9.39.13 (D7)
    if (pinErr){ $('consent-err').textContent = pinErr; return; }
    if (!$('consent-record').checked || !$('consent-review').checked){ $('consent-err').textContent = 'الموافقتان الأولى والثانية مطلوبتان للتسجيل.'; return; }
    if ($('consent-pin')){ try { await setGuardianPin($('consent-pin').value); } catch(e){ $('consent-err').textContent = 'تعذّر حفظ الرمز على هذا الجهاز.'; return; } }
    STATE.student = STATE.student || {};""")

# ---------------- D7: البوابة — الرمز أولًا، والمسألة الحسابية للاستعادة ----------------
rep("""function parentalGate(onPass, purpose){
  var old = document.getElementById('parent-gate'); if (old) old.remove();""",
    """/* 9.39.13 (D7): البوابة تسأل عن رمز ولي الأمر إن وُضع. المسألة الحسابية تبقى لجهاز بلا رمز (قبل الموافقة)،
   ولاستعادة رمز منسي بعد انتظار 60 ثانية، ثم يُطلب رمز جديد. والجهاز الموافَق عليه قبل 9.39.13 يضع رمزه بعد أول بوابة. */
function parentalGate(onPass, purpose){
  if (guardianPinSet()){ pinGate(onPass, purpose); return; }
  arithmeticGate(function(){ if (hasConsent()) pinSetupDialog(onPass, 'ضع رمزًا من 4 أرقام لولي الأمر. سيُطلب بدل المسألة الحسابية من الآن.'); else onPass(); }, purpose);
}
function arithmeticGate(onPass, purpose, waitSec){
  var old = document.getElementById('parent-gate'); if (old) old.remove();""")
rep("""  newQ();
  function check(){
    if (ok.disabled) return;
    if (toLatinDigits(inp.value) === String(a * b)){ ov.remove(); onPass(); return; }""",
    """  newQ();
  if (waitSec > 0){ // 9.39.13 (D7): استعادة الرمز المنسي حاجز صبر لا يحتمله طفل
    ok.disabled = true; inp.disabled = true; var left = waitSec;
    var tick = function(){ if (!document.body.contains(ov)) return; if (left <= 0){ ok.disabled = false; inp.disabled = false; msg.textContent = ''; try { inp.focus(); } catch(e){} return; } msg.textContent = '⏳ انتظر ' + left + ' ثانية ثم اكتب الناتج.'; left--; setTimeout(tick, 1000); };
    tick();
  }
  function check(){
    if (ok.disabled) return;
    if (toLatinDigits(inp.value) === String(a * b)){ ov.remove(); onPass(); return; }""")
rep("""function openGuardianSettings(){ parentalGate(openGuardianSettingsInner); }""",
    """function guardianPinSet(){ var p = STATE.student && STATE.student.guardianPin; return !!(p && typeof p.h === 'string' && typeof p.s === 'string'); }
function guardianPinProblem(a, b){
  a = toLatinDigits(a); b = toLatinDigits(b);
  if (!/^[0-9]{4}$/.test(a)) return 'رمز ولي الأمر أربعة أرقام.';
  if (a !== b) return 'الرمزان غير متطابقين.';
  if (/^(\\d)\\1{3}$/.test(a) || '0123456789'.indexOf(a) >= 0 || '9876543210'.indexOf(a) >= 0) return 'اختر رمزًا لا يسهل تخمينه (لا 1111 ولا 1234).';
  return '';
}
async function guardianPinHash(pin, salt){ return sha256b64('rifaq-guardian-pin|' + salt + '|' + toLatinDigits(pin)); }
async function setGuardianPin(pin){
  var u = new Uint8Array(16); crypto.getRandomValues(u); var salt = b64FromBytes(u);
  STATE.student = STATE.student || {};
  STATE.student.guardianPin = {s: salt, h: await guardianPinHash(pin, salt), at: new Date().toISOString()};
  save();
}
function gateShell(title, text){
  var old = document.getElementById('parent-gate'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'parent-gate';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:380px;width:100%;padding:18px;text-align:center;line-height:1.8';
  var h = document.createElement('h3'); h.style.cssText = 'margin:0 0 6px'; h.textContent = title;
  var p = document.createElement('p'); p.style.cssText = 'margin:0 0 8px'; p.textContent = text;
  card.appendChild(h); card.appendChild(p); ov.appendChild(card); document.body.appendChild(ov);
  return {ov: ov, card: card};
}
function pinInput(id, ph){
  var i = document.createElement('input'); i.id = id; i.type = 'password'; i.setAttribute('inputmode', 'numeric'); i.setAttribute('autocomplete', 'off'); i.maxLength = 4; i.placeholder = ph || '••••';
  i.style.cssText = 'width:130px;font-size:1.4rem;letter-spacing:.4em;text-align:center;padding:8px;border:2px solid #cfd8dc;border-radius:12px;direction:ltr;margin:4px';
  return i;
}
function pinGate(onPass, purpose){
  var g = gateShell('🔒 لولي الأمر فقط', (purpose || 'هذه الإعدادات لولي الأمر.') + ' اكتب رمز ولي الأمر:');
  var inp = pinInput('parent-gate-pin'); g.card.appendChild(inp);
  var msg = document.createElement('div'); msg.id = 'parent-gate-msg'; msg.style.cssText = 'min-height:1.6em;color:#b3261e;font-size:.9rem;margin:6px 0'; g.card.appendChild(msg);
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
  var ok = document.createElement('button'); ok.type = 'button'; ok.id = 'parent-gate-ok'; ok.className = 'btn primary'; ok.textContent = 'متابعة';
  var cancel = document.createElement('button'); cancel.type = 'button'; cancel.id = 'parent-gate-cancel'; cancel.className = 'btn ghost'; cancel.textContent = 'إلغاء';
  row.appendChild(ok); row.appendChild(cancel); g.card.appendChild(row);
  var forgot = document.createElement('button'); forgot.type = 'button'; forgot.id = 'parent-gate-forgot'; forgot.className = 'btn ghost'; forgot.textContent = 'نسيت الرمز؟';
  forgot.style.cssText = 'margin-top:8px;font-size:.85rem'; g.card.appendChild(forgot);
  var tries = 0;
  async function check(){
    if (ok.disabled) return;
    var p = STATE.student.guardianPin, v = toLatinDigits(inp.value);
    if (/^[0-9]{4}$/.test(v) && await guardianPinHash(v, p.s) === p.h){ g.ov.remove(); onPass(); return; }
    tries++; inp.value = '';
    if (tries >= 3){
      ok.disabled = true; inp.disabled = true; msg.textContent = 'محاولات كثيرة. انتظر 30 ثانية.';
      setTimeout(function(){ if (!document.body.contains(g.ov)) return; ok.disabled = false; inp.disabled = false; tries = 0; msg.textContent = ''; }, 30000);
      return;
    }
    msg.textContent = 'الرمز غير صحيح.';
  }
  ok.onclick = check;
  cancel.onclick = function(){ g.ov.remove(); };
  forgot.onclick = function(){ g.ov.remove(); arithmeticGate(function(){ pinSetupDialog(onPass, 'ضع رمزًا جديدًا لولي الأمر (4 أرقام).'); }, 'استعادة رمز ولي الأمر.', 60); };
  inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') check(); });
  try { inp.focus(); } catch(e){}
}
function pinSetupDialog(onDone, text){
  var g = gateShell('🔑 رمز ولي الأمر', text || 'ضع رمزًا من 4 أرقام.');
  var a = pinInput('pin-new', 'الرمز'), b = pinInput('pin-new2', 'أعده'); g.card.appendChild(a); g.card.appendChild(b);
  var msg = document.createElement('div'); msg.id = 'pin-new-msg'; msg.style.cssText = 'min-height:1.6em;color:#b3261e;font-size:.9rem;margin:6px 0'; g.card.appendChild(msg);
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
  var ok = document.createElement('button'); ok.type = 'button'; ok.id = 'pin-new-ok'; ok.className = 'btn success'; ok.textContent = 'حفظ الرمز';
  var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn ghost'; cancel.textContent = 'إلغاء';
  row.appendChild(ok); row.appendChild(cancel); g.card.appendChild(row);
  ok.onclick = async function(){
    var e = guardianPinProblem(a.value, b.value); if (e){ msg.textContent = e; return; }
    ok.disabled = true;
    try { await setGuardianPin(a.value); } catch(x){ ok.disabled = false; msg.textContent = 'تعذّر حفظ الرمز.'; return; }
    g.ov.remove(); toast('🔑 حُفظ رمز ولي الأمر.'); onDone();
  };
  cancel.onclick = function(){ g.ov.remove(); };
  try { a.focus(); } catch(e){}
}
function openGuardianSettings(){ parentalGate(openGuardianSettingsInner); }""")

# ---------------- D12: النسخة الاحتياطية والاستعادة في إعدادات ولي الأمر ----------------
rep("""    ov.appendChild(card0); document.body.appendChild(ov);
    $('gs-close').onclick = function(){ ov.remove(); };""", """    ov.appendChild(card0); document.body.appendChild(ov);
    guardianExtras(card0, ov); // 9.39.13 (D12، D7)
    $('gs-close').onclick = function(){ ov.remove(); };""")
rep("""  ov.appendChild(card); document.body.appendChild(ov);
  $('gs-close').onclick = function(){ ov.remove(); };
  $('gs-delete').onclick = function(){ deleteChildDataOnDevice(); };""", """  ov.appendChild(card); document.body.appendChild(ov);
  guardianExtras(card, ov); // 9.39.13 (D12، D7)
  $('gs-close').onclick = function(){ ov.remove(); };
  $('gs-delete').onclick = function(){ deleteChildDataOnDevice(); };""")

# التصدير إلى المعلم: علامة الاستعادة، وتعقيمها وعرضها لديه
rep("""function assessForExport(){
  var st = STATE.assess, log = (Array.isArray(STATE.respLog) ? STATE.respLog : []).slice(-1500);
  if ((!st || !st.concepts) && !log.length) return null;""", """function assessForExport(){
  var st = STATE.assess, log = (Array.isArray(STATE.respLog) ? STATE.respLog : []).slice(-1500);
  if ((!st || !st.concepts) && !log.length && !STATE.restored) return null;""")
rep("""    rounds: rounds, log: log};
}""", """    rounds: rounds, log: log, restored: STATE.restored ? cleanRestored(STATE.restored) : null}; // 9.39.13 (D12)
}""")
rep("""c: e.c ? 1 : 0, a: Math.max(0, Math.min(999, Number(e.a) || 0))}; })}; // 9.39.12 (A4)""",
    """c: e.c ? 1 : 0, a: Math.max(0, Math.min(999, Number(e.a) || 0))}; }),
        restored: (sa.restored && typeof sa.restored === 'object') ? cleanRestored(sa.restored) : null}; // 9.39.12 (A4)، 9.39.13 (D12)""")
rep("""    var _le = sa && sa.lastExam, _leTxt = _le ? ' · آخر اختبار: ' + _le.correct + '/' + _le.total + (_le.wrong && _le.wrong.length ? ' (أخطاء في ' + _le.wrong.length + ' سؤالًا)' : '') : '';""",
    """    var _le = sa && sa.lastExam, _leTxt = _le ? ' · آخر اختبار: ' + _le.correct + '/' + _le.total + (_le.wrong && _le.wrong.length ? ' (أخطاء في ' + _le.wrong.length + ' سؤالًا)' : '') : '';
    if (sa && sa.restored) _leTxt += ' · ' + restoredNote(sa.restored); // 9.39.13 (D12)""")

# ---------------- D6: المنهج المدمج بدل غير الموثّق ----------------
rep("""var PINNED_SUPERVISOR = null; /* RIFAQ_PINNED_SUPERVISOR */""",
    """var PINNED_SUPERVISOR = null; /* RIFAQ_PINNED_SUPERVISOR */
var BUILTIN_CURRICULUM = null; /* RIFAQ_BUILTIN_CURRICULUM */
/* 9.39.13 (D6): تحقنه الصفحة المضيفة (منهج الإصدار نفسه) حين يختلف منهج الملف عنه وفي التطبيق مشرف مسجَّل */""")
rep("""  REF_HIDDEN = supervisorKeys().length > 0 && REF_TRUST !== 'verified' && REF_TRUST !== 'builtin';
  if (!REF_HIDDEN) return;""", """  REF_HIDDEN = supervisorKeys().length > 0 && REF_TRUST !== 'verified' && REF_TRUST !== 'builtin';
  if (!REF_HIDDEN) return;
  /* 9.39.13 (D6): منهج غير موثّق قد يعلّم حكمًا خاطئًا، والتنبيه لا يقرؤه طفل. فيُعرض المنهج المعتمد المدمج في الإصدار بدله
     (المصفوفة نفسها تُفرَّغ وتُملأ، فكل مرجع إليها يرى البديل). تسجيلات الطفل وتقدّمه تبقى كما هي. */
  if (Array.isArray(BUILTIN_CURRICULUM) && BUILTIN_CURRICULUM.length && Array.isArray(CURRICULUM)){
    var keepSyn = CURRICULUM.filter(function(s){ return s && s._synthetic; });
    CURRICULUM.length = 0;
    BUILTIN_CURRICULUM.forEach(function(s){ if (s && typeof s === 'object' && typeof s.id === 'string') CURRICULUM.push(s); });
    keepSyn.forEach(function(s){ CURRICULUM.push(s); });
    REF_CURRICULUM_REPLACED = true;
  }""")
rep("""function refStatusLine(){
  if (REF_HIDDEN) return""", """var REF_CURRICULUM_REPLACED = false;
function refStatusLine(){
  if (REF_HIDDEN && REF_CURRICULUM_REPLACED) return {ok: false, text: '⚠️ هذا الملف لا يحمل توقيع مشرف مسجَّل في هذا التطبيق، فعُرض المنهج المعتمد المدمج في التطبيق بدل منهجه، وأُخفيت تلاوات الشيخ وأسماء المرجع. تسجيلاتك وتقدّمك محفوظة.'};
  if (REF_HIDDEN) return""")

# ---------------- ق3-ب: زر الاختبار يذكر عدد أسئلة المحاولة ----------------
rep("""  html += '<button class="btn primary block mt-20" data-call="[&quot;startQuiz&quot;]" type="button">🎯 {ابدأ|ابدئي} الاختبار (' + arCount(sec.questions.length, 'سؤال', 'سؤالان', 'أسئلة') + ')</button>';""",
    """  html += '<button class="btn primary block mt-20" data-call="[&quot;startQuiz&quot;]" type="button">🎯 {ابدأ|ابدئي} الاختبار (' + arCount(Math.min(sec.questions.length, LESSON_QUIZ_MAX), 'سؤال', 'سؤالان', 'أسئلة') + ')</button>'; // 9.39.13 (ق3-ب)""")

# ---------------- كتلة 9.39.13 قبل الإقلاع: السحب، والنسخة الاحتياطية، والتذكير ----------------
BLOCK = r"""/* ===== 9.39.13 (ق3-ب): اختبار الدرس 15 سؤالًا على الأكثر =====
   الدرس الطويل (حتى 30 سؤالًا) ثقيل على طفل في جلسة واحدة، ونجوم الدرس من المحاولة الأولى.
   كل محاولة تسحب 15 سؤالًا: كل نوع (اختيار، صواب وخطأ، استخراج عثماني لكل حكم، استخراج إملائي لكل حكم…) بنسبته في الدرس
   (في حدود سؤال واحد)، والأسئلة التي لم يرها الطفل أولًا، فتُرى كلها في محاولتين.
   الأسئلة تبقى بترتيب الدرس. المنهج نفسه لا يتغير: المحاولة نسخة من القسم تحمل أسئلتها. */
var LESSON_QUIZ_MAX = 15;
function lessonQuizKind(q){
  if (q && q.type === 'extraction') return ((/^mx_/.test(String(q.id)) || /الرسم الإملائي/.test(String(q.question || ''))) ? 'xi:' : 'xu:') + String((q.options || [])[q.answer]).replace(/^ال/, '');
  return 'o:' + String(q && q.type);
}
/* لكل نوع حصته الصحيحة (floor)، والمقاعد الباقية للأنواع التي فيها أسئلة لم تُرَ بعد ثم الأكبر باقيًا:
   فكل نوع يبقى في حدود سؤال واحد من نسبته، ومحاولتان تكفيان لرؤية الدرس كله. */
function lessonQuizAlloc(sizes, N, unseen, rng){
  var keys = Object.keys(sizes), T = keys.reduce(function(a, k){ return a + sizes[k]; }, 0), alloc = {}, used = 0;
  if (T <= N){ keys.forEach(function(k){ alloc[k] = sizes[k]; }); return alloc; }
  var cand = keys.map(function(k){ var e = sizes[k] * N / T; alloc[k] = Math.floor(e); used += alloc[k]; return {k: k, r: e - alloc[k], u: (unseen[k] || 0) > alloc[k] ? 1 : 0, t: rng()}; });
  cand.sort(function(a, b){ return (b.u - a.u) || (b.r - a.r) || (a.t - b.t); });
  for (var i = 0; used < N && i < cand.length; i++){ if (cand[i].r > 0 && alloc[cand[i].k] < sizes[cand[i].k]){ alloc[cand[i].k]++; used++; } }
  return alloc;
}
function sampleLessonQuestions(all, seen, rng){
  rng = rng || Math.random; all = all || [];
  if (all.length <= LESSON_QUIZ_MAX) return all.slice();
  var groups = {}, sizes = {}, unseen = {}, seenSet = {}, pick = {};
  (seen || []).forEach(function(id){ seenSet[id] = 1; });
  all.forEach(function(q){ var k = lessonQuizKind(q); (groups[k] = groups[k] || []).push(q); sizes[k] = (sizes[k] || 0) + 1; if (!seenSet[q.id]) unseen[k] = (unseen[k] || 0) + 1; });
  var alloc = lessonQuizAlloc(sizes, LESSON_QUIZ_MAX, unseen, rng);
  function shuffle(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  Object.keys(groups).forEach(function(k){
    var g = shuffle(groups[k]);
    g.filter(function(q){ return !seenSet[q.id]; }).concat(g.filter(function(q){ return seenSet[q.id]; })).slice(0, alloc[k]).forEach(function(q){ pick[q.id] = 1; });
  });
  return all.filter(function(q){ return pick[q.id]; });
}
var _startQuizBase913 = startQuiz;
startQuiz = function(){
  var sec = CURRENT.section;
  if (sec && sec._full) sec = CURRENT.section = sec._full; // «إعادة الاختبار» تسحب من الدرس كاملًا
  if (sec && !sec._synthetic && (sec.questions || []).length > LESSON_QUIZ_MAX){
    STATE.quizSeen = STATE.quizSeen || {};
    var seen = Array.isArray(STATE.quizSeen[sec.id]) ? STATE.quizSeen[sec.id] : [];
    var qs = sampleLessonQuestions(sec.questions, seen), ids = qs.map(function(q){ return q.id; });
    var all = seen.concat(ids.filter(function(id){ return seen.indexOf(id) < 0; }));
    STATE.quizSeen[sec.id] = all.length >= sec.questions.length ? ids : all; // دورة اكتملت: تبدأ دورة جديدة
    save();
    CURRENT.section = Object.assign({}, sec, {questions: qs.map(function(q){ return Object.assign({}, q); }), _full: sec});
  }
  return _startQuizBase913.apply(this, arguments);
};

/* ===== 9.39.13 (D12): نسخة احتياطية واستعادة لتقدّم الطفل =====
   لماذا: أندرويد بلا مفتاح توقيع ثابت يمسح البيانات مع كل تحديث، وSafari يمحو تخزين الموقع بعد أسبوع دون استعمال،
   ومسح المتصفح أو تغيير الهاتف يضيّع كل شيء. النسخة ملف JSON يحفظه ولي الأمر؛ التسجيلات اختيارية.
   الملف غير موقّع، فيستطيع متمكّن تعديله؛ لذلك يرى المعلم «مستعاد من نسخة احتياطية» على ما جاء منها، ولا يُنقل رمز ولي الأمر. */
var BACKUP_TYPE = 'rifaq_backup', BACKUP_MAX_AUDIO = 20 * 1024 * 1024;
function cleanRestored(r){
  r = (r && typeof r === 'object') ? r : {};
  var clean = function(a){ return (Array.isArray(a) ? a : []).map(safeIdString).slice(0, 40); };
  return {at: String(r.at || '').slice(0, 40), backupAt: String(r.backupAt || '').slice(0, 40), app: String(r.app || '').slice(0, 20),
    nLog: Math.max(0, Math.min(1500, Number(r.nLog) || 0)), lessons: Math.max(0, Math.min(99, Number(r.lessons) || 0)), mastered: clean(r.mastered)};
}
function restoredNote(r){
  r = cleanRestored(r);
  return '⚠️ تقدّم مستعاد من نسخة احتياطية (نسخة ' + String(r.backupAt).slice(0, 10) + '، استُعيدت ' + String(r.at).slice(0, 10) + '). لم يُسجَّل على هذا الجهاز: ' +
    'الدروس المكتملة (' + r.lessons + ')، والمفاهيم المتقنة (' + r.mastered.length + ')' + (r.nLog ? '، وأول ' + r.nLog + ' إجابة في السجل' : '') + '.';
}
function blobFromDataURL(d){
  var m = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/.exec(String(d || '')); if (!m) return null;
  return new Blob([bytesFromB64(m[2])], {type: m[1]});
}
function downloadText(name, text, type){
  var blob = new Blob([text], {type: type || 'application/json;charset=utf-8'}), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
}
async function makeBackup(withAudio){
  var st = JSON.parse(JSON.stringify(STATE));
  if (st.student) delete st.student.guardianPin;            // الرمز لهذا الجهاز وحده
  delete st.role; delete st.sawSplash; delete st.recipientOnboarded;
  var audios = {}, total = 0, skipped = 0;
  if (withAudio){
    var ids = Object.keys(STATE.studentAudios || {});
    for (var i = 0; i < ids.length; i++){
      var b = null; try { b = await dbGet(ids[i]); } catch(e){}
      if (!b){ skipped++; continue; }
      total += b.size || 0;
      if (total > BACKUP_MAX_AUDIO){ alert('التسجيلات أكبر من 20 ميغابايت. حُفظت النسخة بلا التسجيلات الباقية.'); break; }
      audios[ids[i]] = await blobToBase64(b);
    }
  }
  var now = new Date().toISOString();
  var out = {type: BACKUP_TYPE, v: 1, app: APP_VERSION, at: now, packageId: String(PACK_DATA.packageId || PACKAGE_ID || ''), studentId: (STATE.student && STATE.student.id) || PACK_DATA.studentId || null,
    student: String((STATE.student && STATE.student.name) || ''), state: st, audios: audios};
  var nm = String((STATE.student && STATE.student.name) || 'طالب').replace(/[\\/:*?"<>|]/g, '_');
  downloadText('نسخة_احتياطية_' + nm + '_' + now.slice(0, 10) + '.json', JSON.stringify(out));
  STATE.lastBackupAt = now; STATE.lessonsAtBackup = lessonsDoneCount(); STATE.backupNagAt = STATE.lessonsAtBackup; save();
  toast('📦 حُفظت النسخة الاحتياطية' + (withAudio ? ' (التسجيلات: ' + Object.keys(audios).length + ')' : '') + '. احفظ الملف في مكان آمن.');
}
/* تعقيم حالة جاءت من ملف: معرّفات آمنة فقط، وأنواع وحدود معروفة */
function sanitizeBackupState(raw){
  var idOk = function(k){ return /^[A-Za-z0-9_\-]{1,64}$/.test(String(k)); };
  var st = normalizeState(raw);
  var stu = st.student || {}, s = {name: String(stu.name || '').slice(0, 60), gender: stu.gender === 'girl' ? 'girl' : 'boy', photo: safeImageURL(stu.photo),
    supervisorName: String(stu.supervisorName || '').slice(0, 60), supervisorGender: stu.supervisorGender === 'girl' ? 'girl' : 'boy'};
  if (typeof stu.id === 'string' && /^stu_[A-Za-z0-9_\-]{6,64}$/.test(stu.id)) s.id = stu.id;
  var c = stu.consent;
  if (c && typeof c === 'object' && c.v === CONSENT_VERSION){
    var pm = c.permissions || {};
    s.consent = {v: CONSENT_VERSION, guardian: String(c.guardian || '').slice(0, 60), at: String(c.at || '').slice(0, 40),
      permissions: {record: pm.record === true, review: pm.review === true, shareWithPeers: pm.shareWithPeers === true},
      excludedRecordings: Object.keys(c.excludedRecordings || {}).filter(idOk).slice(0, 200).reduce(function(o, k){ o[k] = true; return o; }, {})};
  }
  st.student = s;
  var pr = {}; Object.keys(st.progress || {}).filter(idOk).slice(0, 60).forEach(function(k){ var p = st.progress[k] || {};
    pr[k] = {bestScore: Math.max(0, Math.min(99999, Number(p.bestScore) || 0)), stars: Math.max(0, Math.min(3, Number(p.stars) || 0)), bestStars: Math.max(0, Math.min(3, Number(p.bestStars) || 0)), attempts: Math.max(0, Math.min(9999, Number(p.attempts) || 0))}; });
  st.progress = pr;
  var au = {}; Object.keys(st.studentAudios || {}).filter(idOk).slice(0, 200).forEach(function(k){ var a = st.studentAudios[k] || {};
    au[k] = {status: ['pending', 'approved', 'rejected'].indexOf(a.status) >= 0 ? a.status : 'pending'};
    ['v', 'updatedAt', 'rid', 'source', 'sentAt'].forEach(function(f){ if (typeof a[f] === 'string') au[k][f] = a[f].slice(0, 64); }); if (a.partial) au[k].partial = true; });
  st.studentAudios = au;
  if (st.assess){
    var cs = {}; Object.keys(st.assess.concepts || {}).filter(idOk).slice(0, 40).forEach(function(k){ var x = st.assess.concepts[k] || {};
      cs[k] = {lastSet: /^[AB]$/.test(String(x.lastSet)) ? x.lastSet : null, lastPass: !!x.lastPass, streakPass: Number(x.streakPass) || 0, failStreak: Number(x.failStreak) || 0, rounds: Number(x.rounds) || 0,
        mastered: !!x.mastered, escalated: !!x.escalated, masteredAt: x.masteredAt ? String(x.masteredAt).slice(0, 40) : null, reviewIndex: Number(x.reviewIndex) || 0,
        nextReview: x.nextReview ? String(x.nextReview).slice(0, 40) : null, lastAt: x.lastAt ? String(x.lastAt).slice(0, 40) : null,
        lastQs: Array.isArray(x.lastQs) ? x.lastQs.map(safeIdString).slice(0, 60) : null}; });
    var ed = st.assess.examDone || {};
    st.assess = {concepts: cs, examDone: {1: !!ed[1], 2: !!ed[2]}, examPlan: null, lastExam: null, examFailedConcepts: [], submittedAt: null, history: [],
      finalDone: !!st.assess.finalDone, finalAt: st.assess.finalAt ? String(st.assess.finalAt).slice(0, 40) : null,
      pendingRetest: (Array.isArray(st.assess.pendingRetest) ? st.assess.pendingRetest : []).filter(idOk).slice(0, 40), lastVerdict: {}, inProgress: null};
  }
  st.respLog = (Array.isArray(st.respLog) ? st.respLog : []).slice(-1500).map(function(e){ e = (e && typeof e === 'object') ? e : {};
    return {t: String(e.t || '').slice(0, 20), k: String(e.k || '').slice(0, 3), s: safeIdString(e.s), q: safeIdString(e.q), c: e.c ? 1 : 0, a: Math.max(0, Math.min(999, Number(e.a) || 0))}; });
  var tr = {}; Object.keys(st.teacherRatings || {}).filter(idOk).forEach(function(k){ tr[k] = String(st.teacherRatings[k]).slice(0, 20); }); st.teacherRatings = tr;
  delete st.restored; delete st.consent; delete st.stars; delete st.giftExcluded;
  st.role = 'student'; st.sawSplash = true;
  return st;
}
function restoreBackupPick(){
  var inp = document.getElementById('gs-restore-file');
  if (!inp){ inp = document.createElement('input'); inp.type = 'file'; inp.id = 'gs-restore-file'; inp.accept = '.json,application/json'; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', function(){ var f = inp.files && inp.files[0]; inp.value = ''; if (f) restoreBackupFromFile(f); }); }
  inp.click();
}
function restoreBackupFromFile(file){
  if (file.size > 40 * 1024 * 1024){ alert('الملف كبير جدًا.'); return; }
  var r = new FileReader();
  r.onload = function(){ var b; try { b = JSON.parse(String(r.result), function(k, v){ return k === '__proto__' ? undefined : v; }); } catch(e){ alert('هذا ليس ملف نسخة احتياطية صالحًا.'); return; } applyRestore(b); };
  r.onerror = function(){ alert('تعذّرت قراءة الملف.'); };
  r.readAsText(file, 'utf-8');
}
async function applyRestore(b){
  if (!b || b.type !== BACKUP_TYPE || b.v !== 1 || !b.state || typeof b.state !== 'object'){ alert('هذا ليس ملف نسخة احتياطية من رفاق التحفة.'); return null; }
  var st = sanitizeBackupState(b.state);
  if (!st.student.name){ alert('النسخة الاحتياطية لا تحمل اسم طالب.'); return null; }
  var bid = st.student.id || null;
  if (PACK_DATA.studentId && bid && String(PACK_DATA.studentId) !== bid){ alert('هذه النسخة لطالب آخر غير صاحب هذا الملف. افتح «تطبيق الطالب» من الموقع ثم استعد النسخة.'); return null; }
  var lessons = Object.keys(st.progress).filter(function(k){ return st.progress[k].stars > 0; }).length;
  var mastered = Object.keys((st.assess && st.assess.concepts) || {}).filter(function(k){ return st.assess.concepts[k].mastered; });
  if (!confirm('استعادة نسخة «' + st.student.name + '» المحفوظة في ' + String(b.at || '').slice(0, 10) + ' (الدروس المكتملة: ' + lessons + ')؟\n' +
    'إن كان لهذا الطالب تقدّم على هذا الجهاز فستحل النسخة محله. والمعلم سيرى أن التقدّم مستعاد من نسخة احتياطية.')) return null;
  var keepPin = STATE.student && STATE.student.guardianPin;
  switchStudentProfile(st.student.name, bid || CURRENT_PROFILE_ID || newStudentId());
  st.student.id = CURRENT_PROFILE_ID;
  if (keepPin) st.student.guardianPin = keepPin;
  var put = 0, audios = (b.audios && typeof b.audios === 'object') ? b.audios : {};
  for (var k in st.studentAudios){
    if (!Object.prototype.hasOwnProperty.call(st.studentAudios, k)) continue;
    var d = Object.prototype.hasOwnProperty.call(audios, k) ? safeAudioURL(audios[k]) : null, blob = d ? blobFromDataURL(d) : null;
    if (blob){ try { await dbPut(k, blob); put++; continue; } catch(e){} }
    var have = null; try { have = await dbGet(k); } catch(e){}
    if (!have) delete st.studentAudios[k]; // تسجيل بلا صوت على هذا الجهاز لا يُعرض كأنه موجود
  }
  st.restored = cleanRestored({at: new Date().toISOString(), backupAt: b.at, app: b.app, nLog: st.respLog.length, lessons: lessons, mastered: mastered});
  st.lastBackupAt = String(b.at || '').slice(0, 40); st.lessonsAtBackup = lessons; st.backupNagAt = lessons;
  STATE = st; recalcStats(); save();
  var done = function(){ alert('✅ اكتملت الاستعادة. الدروس المكتملة: ' + lessons + '، والتسجيلات: ' + put + '. سيُعاد فتح التطبيق.'); location.reload(); };
  if (hasConsent() && !guardianPinSet()) pinSetupDialog(done, 'ضع رمز ولي الأمر لهذا الجهاز (4 أرقام).'); else done();
  return {lessons: lessons, audios: put};
}
/* أزرار في إعدادات ولي الأمر: النسخة الاحتياطية، والاستعادة، وتغيير الرمز */
function guardianExtras(card, ov){
  var box = document.createElement('div'); box.id = 'gs-backup-box';
  box.style.cssText = 'border-top:1px solid #e0e0e0;margin-top:10px;padding-top:8px';
  var h = document.createElement('p'); h.style.cssText = 'margin:4px 0;font-size:.9rem';
  h.textContent = '📦 النسخة الاحتياطية: تحفظ تقدّم الطفل في ملف ليُستعاد إن مُسح التطبيق أو تغيّر الهاتف.' + (STATE.lastBackupAt ? ' آخر نسخة: ' + String(STATE.lastBackupAt).slice(0, 10) + '.' : ' لم تُحفظ نسخة بعد.');
  box.appendChild(h);
  var lab = document.createElement('label'); lab.style.cssText = 'display:flex;gap:8px;align-items:center;font-size:.85rem;margin:4px 0';
  var cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'gs-backup-audio'; lab.appendChild(cb); lab.appendChild(document.createTextNode('مع التسجيلات الصوتية (ملف أكبر)'));
  box.appendChild(lab);
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
  var mk = function(id, t, fn){ var x = document.createElement('button'); x.type = 'button'; x.id = id; x.className = 'btn'; x.textContent = t; x.onclick = fn; row.appendChild(x); return x; };
  mk('gs-backup', '📦 حفظ نسخة احتياطية', function(){ makeBackup(cb.checked); });
  mk('gs-restore', '📥 استعادة من نسخة', function(){ ov.remove(); restoreBackupPick(); });
  if (guardianPinSet()) mk('gs-pin', '🔑 تغيير رمز ولي الأمر', function(){ ov.remove(); pinSetupDialog(function(){}, 'ضع الرمز الجديد (4 أرقام).'); });
  box.appendChild(row);
  var last = card.lastElementChild;
  if (last) card.insertBefore(box, last); else card.appendChild(box);
}
/* تذكير لطيف بعد كل درسين جديدين منذ آخر نسخة */
function maybeBackupReminder(){
  var n = lessonsDoneCount(), base = Math.max(Number(STATE.lessonsAtBackup) || 0, Number(STATE.backupNagAt) || 0);
  if (n - base < 2) return;
  STATE.backupNagAt = n; save();
  var res = document.getElementById('view-results'); if (!res) return;
  var old = document.getElementById('backup-reminder'); if (old) old.remove();
  var box = document.createElement('div'); box.id = 'backup-reminder'; box.className = 'notice info'; box.style.cssText = 'font-size:.85rem;margin-top:10px';
  box.textContent = GT('📦 {أكملت|أكملتِ} ' + arCount(n, 'درس', 'درسين', 'دروس') + '. {اطلب|اطلبي} من ولي الأمر حفظ نسخة احتياطية من «⚙️ إعدادات ولي الأمر»، حتى لا يضيع التقدّم إن مُسح التطبيق.');
  var nav = document.getElementById('results-nav');
  if (nav && nav.parentNode === res) res.insertBefore(box, nav); else res.appendChild(box);
}
var _finishQuizBase913 = finishQuiz;
finishQuiz = function(){
  var sec = CURRENT.section || {};
  var r = _finishQuizBase913.apply(this, arguments);
  try { if (!sec._synthetic) maybeBackupReminder(); } catch(e){}
  return r;
};
"""
rep("""(async function boot(){""", BLOCK + """(async function boot(){""")

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new and new in s: continue
        n = s.count(old)
        if not new and n == 0: continue
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:110]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
