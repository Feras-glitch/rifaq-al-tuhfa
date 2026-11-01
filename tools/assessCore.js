/* ===== 9.23: محرك التقييم النظري (منطق خالص، بلا DOM) =====
   - نسختان لكل مفهوم: مجموعتان متمايزتان من أسئلة القسم (A وB)، لا تتكرر سؤال بينهما.
   - الإتقان: 100% في جولتين متتاليتين بنسختين مختلفتين.
   - الاختبار النهائي: 70 سؤالًا، لكل مفهوم أدنى عدد (2، أو 3 للمفاهيم الكبيرة)، ولا تكرار.
   - بعد 4 جولات فاشلة متتالية لمفهوم: إحالة إلى المعلم.
   - مراجعة متباعدة بعد الإتقان: 1، 3، 7، 14 يومًا ثم كل 30 يومًا.
   - تذكير الرد على المعلم بعد 48 ساعة. */
var ASSESS_CFG = {finalSize: 70, bigConcepts: ['s1_intro','s3_idgham','s5_ikhfa','s9_madd1','s10_madd2','s11_madd3','s12_lazim','s12b_fawatih'],
  escalateAfter: 4, reviewDays: [1, 3, 7, 14], reviewEveryDays: 30, teacherReplyHours: 48};
function assessRequired(id){ return ASSESS_CFG.bigConcepts.indexOf(id) >= 0 ? 3 : 2; }
/* مجموعتان متمايزتان: بالتناوب بعد ترتيب ثابت */
function assessSplit(sections){
  var out = {};
  sections.forEach(function(s){
    var qs = (s.questions || []).map(function(q){ return q.id; });
    out[s.id] = {A: qs.filter(function(_, i){ return i % 2 === 0; }), B: qs.filter(function(_, i){ return i % 2 === 1; })};
  });
  return out;
}
/* تحقق من الجدول: كل مفهوم يملك مجموعتين تكفيان لمعيار الإتقان */
function assessBlueprintGaps(sections){
  var split = assessSplit(sections), gaps = [];
  sections.forEach(function(s){
    var need = assessRequired(s.id);
    if (split[s.id].A.length < need || split[s.id].B.length < need) gaps.push({id: s.id, A: split[s.id].A.length, B: split[s.id].B.length, need: need});
  });
  return gaps;
}
/* تكوين الاختبار النهائي: حد أدنى لكل مفهوم، ثم تعبئة متوازنة حتى finalSize، بلا تكرار */
function assessBuildFinal(sections, rng){
  rng = rng || Math.random;
  var split = assessSplit(sections), pick = [], used = {};
  function shuffle(a){ a = a.slice(); for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var pools = {};
  sections.forEach(function(s){ pools[s.id] = shuffle(split[s.id].A.concat(split[s.id].B)); });
  sections.forEach(function(s){
    var need = assessRequired(s.id), take = pools[s.id].slice(0, need);
    take.forEach(function(qid){ used[qid] = true; pick.push({sec: s.id, q: qid}); });
    pools[s.id] = pools[s.id].slice(need);
  });
  var remaining = ASSESS_CFG.finalSize - pick.length, round = 0;
  while (remaining > 0){
    var progressed = false;
    sections.forEach(function(s){
      if (remaining <= 0) return;
      var p = pools[s.id].filter(function(qid){ return !used[qid]; });
      if (p.length){ var qid = p[0]; used[qid] = true; pick.push({sec: s.id, q: qid}); pools[s.id] = pools[s.id].filter(function(x){ return x !== qid; }); remaining--; progressed = true; }
    });
    if (!progressed) break;
    round++;
  }
  return pick;
}
/* حالة الإتقان لكل مفهوم */
function assessEmptyState(){ return {concepts: {}}; }
function assessConcept(state, id){
  state.concepts[id] = state.concepts[id] || {lastSet: null, lastPass: false, streakPass: 0, failStreak: 0, rounds: 0, mastered: false, escalated: false, masteredAt: null, reviewIndex: 0, nextReview: null};
  return state.concepts[id];
}
/* تسجيل جولة لمفهوم: setName = 'A' أو 'B'، passed = أجاب 100% */
function assessRecordRound(state, id, setName, passed, nowIso){
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
if (typeof module !== 'undefined') module.exports = {ASSESS_CFG, assessRequired, assessSplit, assessBlueprintGaps, assessBuildFinal, assessEmptyState, assessConcept, assessRecordRound, assessNextReview, assessDueReviews, assessCompleteReview, assessTeacherReplyOverdue, assessSummary};
