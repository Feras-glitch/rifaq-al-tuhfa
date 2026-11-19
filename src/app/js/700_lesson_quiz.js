/* ===== 9.39.13 (ق3-ب): اختبار الدرس 15 سؤالًا على الأكثر =====
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
/* محاولة الدرس: نسخة من القسم بأسئلتها المسحوبة، تفضّل ما لم يُجب عنه الطفل بعد */
function lessonQuizAttempt(sec){
  var seen = (STATE.quizSeen && Array.isArray(STATE.quizSeen[sec.id])) ? STATE.quizSeen[sec.id] : [];
  var qs = sampleLessonQuestions(sec.questions, seen);
  return Object.assign({}, sec, {questions: qs.map(function(q){ return Object.assign({}, q); }), _full: sec, _answered: []});
}
/* 9.41.1: السؤال يُعدّ «مرئيًا» حين يجيب عنه الطفل (من logResponse)، فاختبار فُتح ثم تُرك لا يستهلك أسئلته.
   حين تكتمل الدورة (أُجيب عن أسئلة الدرس كلها) تبدأ دورة جديدة بما أُجيب في المحاولة الحالية. */
function markLessonSeen(att, qid){
  if (!att || !att._full || !qid) return;
  var full = att._full; STATE.quizSeen = STATE.quizSeen || {};
  var seen = Array.isArray(STATE.quizSeen[full.id]) ? STATE.quizSeen[full.id].slice() : [];
  att._answered = att._answered || [];
  if (att._answered.indexOf(qid) < 0) att._answered.push(qid);
  if (seen.indexOf(qid) < 0) seen.push(qid);
  STATE.quizSeen[full.id] = seen.length >= (full.questions || []).length ? att._answered.slice() : seen;
}
