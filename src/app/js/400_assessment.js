/* ===== 9.23: محرك التقييم النظري (منطق خالص، بلا DOM) =====
   - نسختان لكل مفهوم: مجموعتان متمايزتان من أسئلة القسم (A وB)، لا تتكرر سؤال بينهما.
   - الإتقان: 100% في جولتين متتاليتين بنسختين مختلفتين.
   - الاختبار النهائي: 70 سؤالًا، لكل مفهوم أدنى عدد (2، أو 3 للمفاهيم الكبيرة)، ولا تكرار.
   - بعد 4 جولات فاشلة متتالية لمفهوم: إحالة إلى المعلم.
   - مراجعة متباعدة بعد الإتقان: 1، 3، 7، 14 يومًا ثم كل 30 يومًا.
   - تذكير الرد على المعلم بعد 48 ساعة. */
/* 9.39.11 (ق2-ب): حجم الاختبار = مجموع الحد الأدنى لكل مفهوم (لا تعبئة من أسئلة الدروس) */
var ASSESS_CFG = {finalSize: null, bigConcepts: ['s1_intro','s3_idgham','s5_ikhfa','s9_madd1','s10_madd2','s11_madd3','s12_lazim','s12b_fawatih'],
  escalateAfter: 4, reviewDays: [1, 3, 7, 14], reviewEveryDays: 30, teacherReplyHours: 48,
  allowWrong3: 1, minGapHours: 24}; // 9.39.13: D3 (خطأ واحد في المفهوم الثلاثي) وD4-ج (24 ساعة بين جولتين للمفهوم نفسه)
function assessRequired(id){ return ASSESS_CFG.bigConcepts.indexOf(id) >= 0 ? 3 : 2; }
/* 9.39.13 (D3): جولة المفهوم ناجحة إن لم تتجاوز أخطاؤها المسموح: خطأ واحد إن كانت أسئلته ثلاثة فأكثر، ولا خطأ في السؤالين */
function assessRoundPassed(n, wrong){ n = Number(n) || 0; wrong = Number(wrong) || 0; return n > 0 && wrong <= (n >= 3 ? ASSESS_CFG.allowWrong3 : 0); }
/* 9.39.13 (D4-ج): أول وقت تُتاح فيه جولة جديدة للمفهوم (بالمللي ثانية)، أو 0 إن كان متاحًا الآن */
function assessReadyAt(state, id){ var c = state && state.concepts && state.concepts[id]; var t = c && c.lastAt ? new Date(c.lastAt).getTime() : NaN; return isFinite(t) ? t + ASSESS_CFG.minGapHours * 3600000 : 0; }
function assessIsReady(state, id, nowIso){ return assessReadyAt(state, id) <= new Date(nowIso).getTime(); }
/* 9.39.11 (ق2-ب): البنك المحجوز examQuestions إن وُجد، وإلا أسئلة الدروس (منهج قديم بلا بنك) */
function assessPool(s){ return (s && Array.isArray(s.examQuestions) && s.examQuestions.length) ? s.examQuestions : ((s && s.questions) || []); }
/* مجموعتان متمايزتان: حسب الحقل set في البنك، وإلا بالتناوب بعد ترتيب ثابت */
function assessSplit(sections){
  var out = {};
  sections.forEach(function(s){
    var pool = assessPool(s), qs = pool.map(function(q){ return q.id; });
    var labeled = pool.length > 0 && pool.every(function(q){ return q && (q.set === 'A' || q.set === 'B'); });
    out[s.id] = labeled
      ? {A: pool.filter(function(q){ return q.set === 'A'; }).map(function(q){ return q.id; }), B: pool.filter(function(q){ return q.set === 'B'; }).map(function(q){ return q.id; })}
      : {A: qs.filter(function(_, i){ return i % 2 === 0; }), B: qs.filter(function(_, i){ return i % 2 === 1; })};
  });
  return out;
}
function assessExamSize(sections){ return sections.reduce(function(a, s){ return a + assessRequired(s.id); }, 0); }
/* المجموعة التالية لمفهوم: الأخرى غير آخر مجموعة سُئل منها (A أول مرة) */
function assessNextSet(state, id){ var c = state && state.concepts && state.concepts[id]; return (c && c.lastSet === 'A') ? 'B' : 'A'; }
/* تحقق من الجدول: كل مفهوم يملك مجموعتين تكفيان لمعيار الإتقان */
function assessBlueprintGaps(sections){
  var split = assessSplit(sections), gaps = [];
  sections.forEach(function(s){
    var need = assessRequired(s.id);
    if (split[s.id].A.length < need || split[s.id].B.length < need) gaps.push({id: s.id, A: split[s.id].A.length, B: split[s.id].B.length, need: need});
  });
  return gaps;
}
/* 9.39.11 (ق2-ب): جولة قياس — لكل مفهوم مجموعة واحدة (setFor[id]، وإلا A) بعدد حدّه الأدنى بالضبط، بلا تكرار.
   فالجولتان المتتاليتان لمفهوم واحد لا تشتركان في أي سؤال، وهو شرط الإتقان. */
function assessBuildFinal(sections, rng, setFor){
  rng = rng || Math.random; setFor = (setFor && typeof setFor === 'object') ? setFor : {};
  var split = assessSplit(sections), pick = [];
  function shuffle(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  sections.forEach(function(s){
    var set = setFor[s.id] === 'B' ? 'B' : 'A';
    shuffle(split[s.id][set]).slice(0, assessRequired(s.id)).forEach(function(qid){ pick.push({sec: s.id, q: qid, set: set}); });
  });
  return pick;
}
/* حالة الإتقان لكل مفهوم */
function assessEmptyState(){ return {concepts: {}}; }
function assessConcept(state, id){
  state.concepts[id] = state.concepts[id] || {lastSet: null, lastPass: false, streakPass: 0, failStreak: 0, rounds: 0, mastered: false, escalated: false, masteredAt: null, reviewIndex: 0, nextReview: null};
  return state.concepts[id];
}
/* تسجيل جولة لمفهوم: setName = 'A' أو 'B'، passed = نجحت الجولة (assessRoundPassed) */
function assessRecordRound(state, id, setName, passed, nowIso, qids){
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
  c.lastAt = nowIso; // 9.39.13 (D4-ج)
  return c;
}
/* تاريخ المراجعة التالية */
function assessNextReview(fromIso, index){
  var base = new Date(fromIso).getTime(), days;
  if (index < ASSESS_CFG.reviewDays.length) days = ASSESS_CFG.reviewDays[index];
  else days = ASSESS_CFG.reviewEveryDays;
  return new Date(base + days * 86400000).toISOString();
}
/* المراجعات المستحقة الآن */
function assessDueReviews(state, nowIso){
  var now = new Date(nowIso).getTime(), due = [];
  Object.keys(state.concepts).forEach(function(id){
    var c = state.concepts[id];
    if (c.mastered && c.nextReview && new Date(c.nextReview).getTime() <= now) due.push(id);
  });
  return due;
}
/* اجتياز المراجعة يُقدّم الموعد التالي */
function assessCompleteReview(state, id, nowIso){
  var c = state.concepts[id]; if (!c || !c.mastered) return c;
  c.reviewIndex++; c.nextReview = assessNextReview(nowIso, c.reviewIndex); return c;
}
/* تذكير المعلم: هل تجاوز الرد مهلة 48 ساعة؟ */
function assessTeacherReplyOverdue(submittedAtIso, nowIso){
  return (new Date(nowIso).getTime() - new Date(submittedAtIso).getTime()) > ASSESS_CFG.teacherReplyHours * 3600000;
}
/* ملخص للمعلم: مفاهيم متقنة، وغير متقنة، ومحالة */
function assessSummary(state, sections){
  var out = {mastered: [], pending: [], escalated: []};
  sections.forEach(function(s){
    var c = state.concepts[s.id];
    if (c && c.mastered) out.mastered.push(s.id);
    else out.pending.push(s.id);
    if (c && c.escalated) out.escalated.push(s.id);
  });
  return out;
}


var CONSENT_VERSION = 2;
var REC_MAX_MS = 180000;
var REC_MIN_MS = 1500;      // أقل مدة مقبولة لتسجيل: ثانية ونصف      // حد أقصى ثلاث دقائق للتسجيل الواحد
var REC_SILENCE_MS = 6000;    // بعد هذه المدة بلا صوت يُنبَّه الطفل
var REC_SILENCE_LEVEL = 0.012;
function hasConsent(){
  var c = STATE.student && STATE.student.consent;
  return !!(c && c.v === CONSENT_VERSION && c.guardian && c.permissions && c.permissions.record === true && c.permissions.review === true);
}
function consentForExport(){
  var c = STATE.student && STATE.student.consent;
  if (!c || c.v !== CONSENT_VERSION) return null;
  var perm = c.permissions || {};
  return {v: CONSENT_VERSION, guardian: String(c.guardian || '').slice(0, 60), at: String(c.at || '').slice(0, 40),
    permissions: {record: perm.record === true, review: perm.review === true, shareWithPeers: perm.shareWithPeers === true},
    excludedRecordings: Object.keys(c.excludedRecordings || {}).slice(0, 200).reduce(function(o,k){ o[String(k).slice(0,64)] = true; return o; }, {})};
}
function sharesWithPeers(){
  var c = STATE.student && STATE.student.consent;
  return !!(c && c.v === CONSENT_VERSION && c.permissions && c.permissions.shareWithPeers === true);
}
/* القرار DECISION-001: ثلاثة أذونات مستقلة، والمشاركة غير مفعّلة افتراضيًا */
function ensureConsent(onAccept){
  if (hasConsent()){ onAccept(); return; }
  var ov = document.createElement('div');
  ov.id = 'consent-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:440px;width:100%;padding:18px;font-size:1rem;line-height:1.8;max-height:92vh;overflow:auto';
  card.innerHTML = '<h3 data-style="margin:0 0 8px">🛡️ موافقة ولي الأمر</h3>' +
    '<label data-style="display:block;margin:8px 0 4px">اسم ولي الأمر:</label>' +
    '<input id="consent-name" type="text" maxlength="60" data-style="width:100%;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:12px;font:inherit">' +
    (guardianPinSet() ? '' : '<label data-style="display:block;margin:10px 0 4px">رمز ولي الأمر (4 أرقام) — يُطلب قبل الإعدادات والتصفير، فلا {تخبر|تخبري} به الطفل:</label>' +
      '<div data-style="display:flex;gap:8px"><input id="consent-pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="4" placeholder="الرمز" data-style="flex:1;min-width:0;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:12px;font:inherit;text-align:center;direction:ltr">' +
      '<input id="consent-pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="4" placeholder="أعده" data-style="flex:1;min-width:0;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:12px;font:inherit;text-align:center;direction:ltr"></div>') +
    '<label data-style="display:flex;gap:8px;align-items:flex-start;margin:12px 0"><input id="consent-record" type="checkbox" data-style="margin-top:6px"> <span><b>أوافق</b> على تسجيل صوت الطفل وحفظه على هذا الجهاز للتعلم.</span></label>' +
    '<label data-style="display:flex;gap:8px;align-items:flex-start;margin:12px 0"><input id="consent-review" type="checkbox" data-style="margin-top:6px"> <span><b>أوافق</b> على إرسال التسجيلات إلى المعلم للمراجعة التعليمية فقط.</span></label>' +
    '<label data-style="display:flex;gap:8px;align-items:flex-start;margin:12px 0;background:#f5f5f5;border-radius:10px;padding:8px"><input id="consent-share" type="checkbox" data-style="margin-top:6px"> <span><b>اختياري:</b> أوافق على أن تُضمَّن التسجيلات المعتمدة في حزم تصل إلى أطفال آخرين. يمكنني استبعاد أي تسجيل، وسحب هذه الموافقة في أي وقت (لا يسترجع ذلك ما سبق نسخه).</span></label>' +
    '<p id="consent-err" data-style="color:#b3261e;margin:4px 0;min-height:1.2em"></p>' +
    '<div data-style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button type="button" id="consent-no" class="btn">إلغاء</button><button type="button" id="consent-ok" class="btn success">حفظ وابدأ</button></div>';
  ov.appendChild(card); document.body.appendChild(ov);
  $('consent-no').onclick = function(){ ov.remove(); };
  $('consent-ok').onclick = async function(){
    var name = ($('consent-name').value || '').trim().slice(0, 60);
    if (name.length < 3){ $('consent-err').textContent = 'اكتب اسم ولي الأمر (٣ أحرف على الأقل).'; return; }
    var pinErr = $('consent-pin') ? guardianPinProblem($('consent-pin').value, $('consent-pin2').value) : ''; // 9.39.13 (D7)
    if (pinErr){ $('consent-err').textContent = pinErr; return; }
    if (!$('consent-record').checked || !$('consent-review').checked){ $('consent-err').textContent = 'الموافقتان الأولى والثانية مطلوبتان للتسجيل.'; return; }
    if ($('consent-pin')){ try { await setGuardianPin($('consent-pin').value); } catch(e){ $('consent-err').textContent = 'تعذّر حفظ الرمز على هذا الجهاز.'; return; } }
    STATE.student = STATE.student || {};
    STATE.student.consent = {v: CONSENT_VERSION, guardian: name, at: new Date().toISOString(),
      permissions: {record: true, review: true, shareWithPeers: !!$('consent-share').checked},
      excludedRecordings: {}};
    save(); ov.remove(); onAccept();
  };
}
/* لوحة ولي الأمر: تغيير المشاركة وسحبها واستبعاد تسجيلات بعينها */
/* DECISION-002 (الافتراضي المعتمد): حذف بيانات الطالب من هذا الجهاز فقط.
   يحذف: الحالة والموافقة والتقدّم، وكل قواعد الصوت الخاصة بهذه الحزمة.
   لا يحذف: ملف الحزمة نفسه (على الجهاز أو في التنزيلات)، ولا ما أُرسل إلى معلم أو زميل. */
/* 9.39.2: إن كان التطبيق يعمل داخل الصفحة المضيفة، نحذف أيضًا نسخ هذا الملف من «الملفات الأخيرة» */
async function forgetInHost(packageId, studentId){
  try { var h = window.parent !== window && window.parent.RIFAQ_HOST; if (h && typeof h.forgetPack === 'function') await h.forgetPack(packageId, studentId); } catch(e){ console.warn('host forget failed', e); }
}
async function deleteChildDataOnDevice(){
  if (!confirm('سيُحذف تسجيل الطفل وتقدّمه وموافقة ولي الأمر من هذا الجهاز. هل أنت متأكد؟')) return;
  if (!confirm('تأكيد نهائي: لا يمكن استرجاع هذه البيانات من الجهاز. متابعة؟')) return;
  CHILD_DATA_DELETED = true;
  var dbName = DB_NAME;
  markPendingDbDelete(dbName, true, STORAGE_KEY); // أولًا: العلامة الدائمة، فلا تعيد نافذة أخرى كتابة الحالة بعد مسحها
  forgetProfileId(CURRENT_PROFILE_ID); // 9.39.5 (R12): يزول الملف الشخصي من خريطة المعرّفات
  try { if (typeof _dbConn !== 'undefined' && _dbConn){ var db = await _dbConn; try { db.close(); } catch(e){} } } catch(e){}
  _dbConn = null; _dbConnName = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (localStorage.getItem(ACTIVE_PROFILE_KEY) === INITIAL_PROFILE_NAME) localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch(e){}
  await forgetInHost(PACK_DATA.packageId || PACKAGE_ID, PACK_DATA.studentId || (STATE.student && STATE.student.id) || null);
  /* 9.39 (R04) + 9.39.3 (RT9392-03): لا إعلان نجاح إلا بعد onsuccess الفعلي لحذف قاعدة التسجيلات */
  var del = deleteDbFully(dbName, STORAGE_KEY).then(function(){ return 'ok'; }, function(){ return 'error'; });
  var r = await Promise.race([del, new Promise(function(res){ setTimeout(function(){ res('pending'); }, 6000); })]);
  if (r === 'ok'){ alert('تم حذف بيانات هذا الطالب من هذا الجهاز. سيُعاد فتح التطبيق.'); location.reload(); return; }
  alert('⚠️ الحذف لم يكتمل بعد: ' + (r === 'error' ? 'تعذّر حذف قاعدة التسجيلات على هذا الجهاز.' : 'التطبيق مفتوح في نافذة أو تبويب آخر يمنع حذف التسجيلات.') +
    '\nأغلق النوافذ الأخرى للتطبيق. سيكتمل الحذف تلقائيًا، وإن لم يكتمل فسيُعاد عند فتح التطبيق مرة أخرى قبل أي استعمال للتسجيلات.');
  del.then(function(x){ if (x === 'ok'){ alert('اكتمل حذف بيانات هذا الطالب من هذا الجهاز. سيُعاد فتح التطبيق.'); location.reload(); } });
}

