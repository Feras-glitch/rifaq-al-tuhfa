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

