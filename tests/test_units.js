// 9.41: اختبارات وحدات لكل وحدة مصدرية فيها منطق خالص، تُحمَّل من ملفها في src كما يُبنى في التطبيق.
// التشغيل: node tests/test_units.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/'@@[A-Z_0-9]+@@'/g, "''").replace(/@@[A-Z_0-9]+@@/g, 'null');
let fails = 0, n = 0;
const ok = (c, m, info) => { n++; if (!c) { fails++; console.log('FAIL', m, info === undefined ? '' : JSON.stringify(info).slice(0, 300)); } else console.log('ok', m); };
function load(files, stubs){ const ctx = Object.assign({console}, stubs || {}); vm.createContext(ctx); files.forEach(f => vm.runInContext(rd(f), ctx, {filename: f})); return ctx; }
// دالة واحدة من وحدة لها كود يعمل عند التحميل: من «function الاسم(» إلى أول «}» في أول السطر
function only(file, names, stubs, ctxIn){
  const src = rd(file), parts = [];
  names.forEach(nm => {
    const L = src.split('\n'), i = L.findIndex(l => l.startsWith('function ' + nm + '(') || l.startsWith('async function ' + nm + '('));
    if (i < 0) throw new Error('no ' + nm + ' in ' + file);
    let j = i; if (!/}\s*$/.test(L[i]) || L[i].split('{').length !== L[i].split('}').length) { while (L[j] !== '}') j++; }
    parts.push(L.slice(i, j + 1).join('\n'));
  });
  const ctx = ctxIn || Object.assign({console}, stubs || {}); if (!ctxIn) vm.createContext(ctx); vm.runInContext(parts.join('\n'), ctx); return ctx;
}

// ---------------- src/shared/100_qx_core.js: أنواع الأسئلة
{
  const Q = load(['src/shared/100_qx_core.js']).QX;
  ok(Q.has('listen') && Q.has('hunt') && Q.has('classify') && !Q.has('script'), 'QX: known types only');
  const good = Q.normalize({id: 'L1', type: 'listen', text: 'اسمع', word: 'مِنْ خَوْفٍ', rule: 'إظهار', lahn: 'إخفاء النون', explanation: 'x', tolerance: 3});
  ok(!good.errors.length && good.q.tolerance === 0 && good.q._x.word === 'مِنْ خَوْفٍ', 'QX listen: valid question, derived fields in _x, tolerance forced to 0', good);
  const bad = Q.normalize({id: 'L2', type: 'listen', text: 'اسمع', word: '', rule: '', lahn: ''});
  ok(['الكلمة المقروءة فارغة', 'الحكم فارغ', 'التعليل فارغ'].every(e => bad.errors.includes(e)) && bad.errors.some(e => e.indexOf('القراءة الخاطئة') >= 0), 'QX listen: empty word, rule, lahn and explanation are errors', bad.errors);
  const long = Q.normalize({id: 'L3', type: 'listen', text: 'اسمع', word: 'و'.repeat(500), rule: 'r', lahn: 'l'});
  ok(long.q._x.word.length === 160, 'QX listen: rendered word is capped at 160');
  const cur = JSON.parse(rd('curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json')).sections;
  const qx = cur.flatMap(s => s.questions.concat(s.examQuestions || [])).filter(q => Q.has(q.type));
  const errs = qx.map(q => [q.id, Q.normalize(q).errors]).filter(x => x[1].length);
  ok(qx.length > 40 && !errs.length, 'QX: every curriculum question of a QX type normalizes cleanly (' + qx.length + ')', errs.slice(0, 3));
}

// ---------------- src/app/js/540_hifz.js: المراجعة المتباعدة لحفظ المتن
{
  let now = Date.parse('2026-01-01T00:00:00Z'), saves = 0;
  const STATE = {};
  const ctx = load(['src/app/js/540_hifz.js'], {
    STATE, save: () => { saves++; }, Date: Object.assign(function(...a){ return a.length ? new Date(...a) : new Date(now); }, {now: () => now, parse: Date.parse}),
    plainText: s => String(s).replace(/<[^>]+>/g, '').trim(),
    realSections: () => [{id: 's0', title: 'مقدمة', items: [{id: 'm0', type: 'poem', text: 'v1<br>v2'}]}],
    matnVerses: it => it.text.split('<br>'), verseKey: (id, i) => id + '__v' + i
  });
  ctx.Date.prototype = Date.prototype;
  const days = h => Math.round((Date.parse(h.due) - now) / 864e5);
  let h = ctx.hifzMark('m0__v1', true); ok(h.b === 1 && days(h) === 1 && saves === 1, 'hifz: first «حفظته» → box 1, due in 1 day', h);
  h = ctx.hifzMark('m0__v1', true); h = ctx.hifzMark('m0__v1', true); ok(h.b === 3 && days(h) === 7 && h.n === 3, 'hifz: third → box 3, due in 7 days', h);
  ok(ctx.hifzSolidCount() === 1, 'hifz: box ≥ 3 counts as solid');
  h = ctx.hifzMark('m0__v1', false); ok(h.b === 0 && days(h) === 0, 'hifz: «لم أحفظه» → back to box 0, due now', h);
  for (let i = 0; i < 10; i++) h = ctx.hifzMark('m0__v2', true);
  ok(h.b === 6 && days(h) === 60, 'hifz: box is capped at 6 (60 days)', h);
  ctx.hifzMark('m0__v1', true);                                   // due tomorrow
  ok(ctx.hifzDue(new Date(now).toISOString()).length === 0, 'hifz: nothing due today');
  ok(ctx.hifzDue(new Date(now + 2 * 864e5).toISOString()).map(v => v.key).join() === 'm0__v1', 'hifz: due after its interval passes');
  ok(JSON.stringify(ctx.hifzVerseParts('<span class="v-a">صدر</span><span class="v-b">عجز</span>')) === '["صدر","عجز"]', 'hifz: verse split into its two halves');
}

// ---------------- src/app/js/310_supervisor_signing.js: قناة المحتوى (الرئيسي يعرض ما راجعه الشيخ)
{
  const mk = () => [{id: 's1', items: [{id: 'a', desc: 'جديد', review: 'pending', prev: {desc: 'قديم'}}, {id: 'b', desc: 'ثابت'}, {id: 'c', desc: 'جديد كله', review: 'pending'}],
    questions: [{id: 'q1', text: 'ثابت'}, {id: 'q2', text: 'جديد', review: 'pending'}, {id: 'q3', text: 'جديد', qpc: {p: 1}, review: 'pending', prev: {text: 'قديم', question: 'س؟'}}],
    examQuestions: [{id: 'e1', review: 'pending'}]}, {id: 'syn', _synthetic: true, questions: [{id: 'z', review: 'pending'}]}];
  const ctx = only('src/app/js/310_supervisor_signing.js', ['contentChannelFilter'], {RIFAQ_CHANNEL: 'main'});
  const secs = mk(), hidden = ctx.contentChannelFilter(secs), s = secs[0];
  ok(hidden === 3, 'channel main: counts pending questions only (items not counted)', hidden);
  ok(s.items.map(x => x.id + ':' + x.desc).join() === 'a:قديم,b:ثابت' && !('prev' in s.items[0]) && !('review' in s.items[0]), 'channel main: pending item shows its previous desc; new item without prev is hidden', s.items);
  ok(s.questions.map(q => q.id + ':' + q.text).join() === 'q1:ثابت,q3:قديم' && s.questions[1].question === 'س؟' && !('qpc' in s.questions[1]), 'channel main: question falls back to prev text (its new glyphs dropped), new one hidden', s.questions);
  ok(s.examQuestions.length === 0 && secs[1].questions.length === 1, 'channel main: reserved bank hidden; synthetic sections untouched');
  const ctxB = only('src/app/js/310_supervisor_signing.js', ['contentChannelFilter'], {RIFAQ_CHANNEL: 'beta'});
  const sb = mk(); ok(ctxB.contentChannelFilter(sb) === 0 && sb[0].items[0].desc === 'جديد' && sb[0].questions.length === 3, 'channel beta: everything shown as is');
}

// ---------------- src/app/js/200_sanitize.js: روابط الوسائط والمعرّفات من ملف غير موثوق
{
  const R = {images: 0, audios: 0};
  const ctx = only('src/app/js/200_sanitize.js', ['safeImageURL', 'safeAudioURL', 'safeIdString'], {SANITIZE_REPORT: R});
  ok(ctx.safeImageURL('data:image/png;base64,AAAA') === 'data:image/png;base64,AAAA', 'sanitize: png data URL kept');
  ok(ctx.safeImageURL('javascript:alert(1)') === null && ctx.safeImageURL('data:image/svg+xml;base64,AAAA') === null && R.images === 2, 'sanitize: script and SVG image URLs dropped and counted');
  ok(ctx.safeAudioURL('data:audio/webm;codecs=opus;base64,AAAA') && ctx.safeAudioURL('https://x/y.mp3') === null && ctx.safeAudioURL('') === '', 'sanitize: audio only as data URL');
  ok(ctx.safeIdString('a b<script>') === 'a_b_script_' && ctx.safeIdString('') === '_' && ctx.safeIdString('x'.repeat(99)).length === 64, 'sanitize: ids made attribute-safe and capped');
}

// ---------------- src/studio/js/150_recording_team.js: حزمة التسجيلات
{
  const RECORDING_LIST = [{id: 'r1', group: 'quran', text: '﴿آية﴾'}, {id: 'v1', group: 'matn', text: 'بيت'}, {id: 'old', group: 'matn', legacy: true, text: ''}];
  const STATE = {recordings: {v1: {size: 1}}};
  const ctx = load(['src/studio/js/400_sheikh_review.js', 'src/studio/js/150_recording_team.js'], {
    RECORDING_LIST, STATE, localStorage: {getItem: () => 'sheikh', setItem(){}}, atob: s => Buffer.from(s, 'base64').toString('binary'), Blob, document: {}, CURRICULUM: []
  });
  ok(ctx.roleItems('sheikh').map(x => x.id).join() === 'r1' && ctx.roleItems('reciter').map(x => x.id).join() === 'v1', 'team: role items by group (legacy excluded)');
  const audio = 'data:audio/webm;base64,' + Buffer.from('abc').toString('base64');
  ok(ctx.dataURLToBlob(audio).size === 3 && ctx.dataURLToBlob('data:text/html;base64,AAAA') === null, 'team: only audio data URLs become recordings');
  const h = x => ctx.recTextHash(x);
  ok(h(RECORDING_LIST[0]) !== h({id: 'r1', group: 'quran', text: '﴿آية أخرى﴾'}), 'team: fingerprint changes with the text');
  const plan = ctx.planRecBundle({type: 'rifaq_recordings', v: 1, items: {
    r1: {h: h(RECORDING_LIST[0]), data: audio}, v1: {h: h(RECORDING_LIST[1]), data: audio}, x9: {h: 'z', data: audio},
    old: {h: h(RECORDING_LIST[2]), data: audio}}});
  ok(plan.add.map(x => x.id).join() === 'r1' && plan.conflict.map(x => x.id).join() === 'v1' && plan.unknown.join() === 'x9,old', 'team: plan splits new, conflicting and unknown (legacy refused)', plan);
  const ch = ctx.planRecBundle({type: 'rifaq_recordings', v: 1, items: {r1: {h: 'stale', data: audio}}});
  ok(ch.changed.join() === 'r1' && !ch.add.length, 'team: a recording whose text changed is not merged');
  ok(ctx.planRecBundle({type: 'other'}) === null && ctx.planRecBundle(null) === null, 'team: non-bundle files are rejected');
}

// ---------------- 9.41.1: إصلاحات مراجعة جيميناي المتحقَّق منها
{ // src/app/js/520_matn_verses.js: الأبيات المتتابعة بعنصر صوت واحد (آيفون يرفض عنصرًا جديدًا بعد مؤقت)
  let made = 0; const plays = [];
  class FakeAudio { constructor(){ made++; this.src = ''; } play(){ plays.push(this.src); return Promise.resolve(); } pause(){} }
  const ctx = only('src/app/js/520_matn_verses.js', ['stopVerse', 'playVerse'], {
    Audio: FakeAudio, VERSE_PLAYER: null, CURRICULUM: [{items: [{id: 'm', text: 'x'}]}], matnVerses: () => ['a', 'b', 'c'],
    PACK_DATA: {masterAudios: {m__v1: 'A1', m__v2: 'A2', m__v3: 'A3'}}, audSrc: x => x, verseKey: (id, i) => id + '__v' + i, safeIdString: x => x,
    document: {querySelectorAll: () => [], getElementById: () => null}, setTimeout: f => f()});
  const tok = ctx.playVerse('m', 0);
  tok.a.onended(); tok.a.onended(); tok.a.onended();
  ok(made === 1 && plays.join() === 'A1,A2,A3' && ctx.VERSE_PLAYER === null, 'verses: one audio element plays all verses in order', {made, plays});
  made = 0; plays.length = 0; const t3 = ctx.playVerse('m', 2, 3); t3.a.onended(); t3.a.onended();
  ok(made === 1 && plays.join() === 'A2,A2,A2', 'verses: ×3 repeats on the same element', {made, plays});
}
{ // src/app/js/700_lesson_quiz.js + 470_answer_log.js: «مرئي» = أُجيب عنه
  const STATE = {quizSeen: {}, progress: {}, respLog: []};
  const ctx = load(['src/app/js/700_lesson_quiz.js'], {STATE, save(){}});
  only('src/app/js/470_answer_log.js', ['logResponse'], null, ctx);
  const qs = Array.from({length: 30}, (_, i) => ({id: 'q' + i, type: 'multiple_choice'}));
  const sec = {id: 's', questions: qs};
  const a1 = ctx.lessonQuizAttempt(sec);
  ok(a1.questions.length === 15 && !STATE.quizSeen.s, 'quizSeen: opening a quiz marks nothing');
  ctx.CURRENT = {section: a1}; a1.questions.slice(0, 3).forEach(q => ctx.logResponse(q, true));
  ok(STATE.quizSeen.s.length === 3, 'quizSeen: each answered question is marked', STATE.quizSeen.s);
  a1.questions.slice(3).forEach(q => ctx.logResponse(q, true));
  const a2 = ctx.lessonQuizAttempt(sec), firstIds = a1.questions.map(q => q.id);
  ok(a2.questions.every(q => firstIds.indexOf(q.id) < 0), 'quizSeen: the next attempt brings the unanswered half');
  ctx.CURRENT = {section: a2}; a2.questions.forEach(q => ctx.logResponse(q, false));
  ok(STATE.quizSeen.s.length === 15 && STATE.quizSeen.s.every(id => a2.questions.some(q => q.id === id)), 'quizSeen: a full cycle restarts with this attempt\'s questions', STATE.quizSeen.s.length);
  const before = JSON.stringify(STATE.quizSeen); ctx.CURRENT = {section: {id: 'final_exam', _exam: true}}; ctx.logResponse({id: 'q1'}, true);
  ok(JSON.stringify(STATE.quizSeen) === before, 'quizSeen: final exam answers do not touch lesson cycles');
}
{ // src/app/js/310_supervisor_signing.js: قائمة الثقة لم تُحمَّل = تُخفى المادة المرجعية غير المدمجة
  const mk = (pin) => only('src/app/js/310_supervisor_signing.js', ['supervisorKeys', 'computeRefTrust', 'applyRefPolicy'], {
    PACK_PROTO_TAMPERED: false, REF_CANON_DIGEST: Promise.resolve('dig'), REF_CERT_RAW: null, REF_SIG: null, PINNED_SUPERVISOR: pin,
    REF_HIDDEN: false, REF_TRUST: null, BUILTIN_CURRICULUM: null, CURRICULUM: [], REF_CURRICULUM_REPLACED: false,
    PACK_DATA: {masterAudios: {x: 'A'}, sheikhName: 'ش'}, jwkThumb: k => k.x, ecdsaVerify: async () => true});
  (async () => {
    const c1 = mk({keys: [], refDigests: [], unavailable: true}); c1.REF_TRUST = await c1.computeRefTrust(); c1.applyRefPolicy();
    ok(c1.REF_TRUST === 'unavailable' && c1.REF_HIDDEN === true && !Object.keys(c1.PACK_DATA.masterAudios).length, 'trust: list failed to load → reference media hidden (fail closed)', [c1.REF_TRUST, c1.REF_HIDDEN]);
    const c2 = mk({keys: [], refDigests: ['dig'], unavailable: true}); c2.REF_TRUST = await c2.computeRefTrust(); c2.applyRefPolicy();
    ok(c2.REF_TRUST === 'builtin' && c2.REF_HIDDEN === false, 'trust: built-in material still shows when the list failed', c2.REF_TRUST);
    const c3 = mk({keys: [], refDigests: []}); c3.REF_TRUST = await c3.computeRefTrust(); c3.applyRefPolicy();
    ok(c3.REF_TRUST === 'unconfigured' && c3.REF_HIDDEN === false && c3.PACK_DATA.masterAudios.x === 'A', 'trust: an empty list that loaded stays «unconfigured» (today\'s behavior)', c3.REF_TRUST);
  })().then(() => {
    // src/app/js/555 + 210: ملف إعادة عُدّل بعد توقيع المعلم لا تُطبَّق قراراته
    const STATE = {studentAudios: {a: {status: 'pending', rid: 'r1'}}};
    const ctx = only('src/app/js/555_teacher_feedback.js', ['returnTampered'], {STATE, RETURN_TRUST: 'invalid', PACK_DATA: {packageType: 'student_returned', studentAudios: {a: {status: 'approved', v: 'r1'}}},
      isNewerLocalRecording: () => false, legacyNeedsAudioCheck: () => false});
    only('src/app/js/210_storage.js', ['syncPackStatuses'], null, ctx);
    ctx.syncPackStatuses();
    ok(STATE.studentAudios.a.status === 'pending', 'return file tampered after signing: teacher decisions are not applied', STATE.studentAudios.a);
    ctx.RETURN_TRUST = 'verified'; ctx.syncPackStatuses();
    ok(STATE.studentAudios.a.status === 'approved', 'return file verified: decisions applied', STATE.studentAudios.a);
    // src/app/js/605_file_delivery.js: على الحاسوب يُنزَّل الملف، ولا تُعرض نافذة المشاركة
    const d = only('src/app/js/605_file_delivery.js', ['canShareFile'], {navigator: {share(){}, canShare: () => true}, File, window: {matchMedia: () => ({matches: false})}});
    const m = only('src/app/js/605_file_delivery.js', ['canShareFile'], {navigator: {share(){}, canShare: () => true}, File, window: {matchMedia: () => ({matches: true})}});
    const n0 = only('src/app/js/605_file_delivery.js', ['canShareFile'], {navigator: {}, File, window: {matchMedia: () => ({matches: true})}});
    ok(d.canShareFile() === false && m.canShareFile() === true && n0.canShareFile() === false, 'delivery: share sheet only on touch devices that can share files');
    console.log(fails ? `\n${fails} FAILED of ${n}` : `\nALL ${n} PASSED`);
    process.exit(fails ? 1 : 0);
  });
}

