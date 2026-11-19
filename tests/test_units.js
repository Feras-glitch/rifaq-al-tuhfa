// 9.41: اختبارات وحدات لكل وحدة مصدرية فيها منطق خالص، تُحمَّل من ملفها في src كما يُبنى في التطبيق.
// التشغيل: node tests/test_units.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/'@@[A-Z_0-9]+@@'/g, "''").replace(/@@[A-Z_0-9]+@@/g, 'null');
let fails = 0, n = 0;
const ok = (c, m, info) => { n++; if (!c) { fails++; console.log('FAIL', m, info === undefined ? '' : JSON.stringify(info).slice(0, 300)); } else console.log('ok', m); };
function load(files, stubs){ const ctx = Object.assign({console}, stubs || {}); vm.createContext(ctx); files.forEach(f => vm.runInContext(rd(f), ctx, {filename: f})); return ctx; }
// دالة واحدة من وحدة لها كود يعمل عند التحميل: من «function الاسم(» إلى أول «}» في أول السطر
function only(file, names, stubs){
  const src = rd(file), parts = [];
  names.forEach(nm => {
    const L = src.split('\n'), i = L.findIndex(l => l.startsWith('function ' + nm + '(') || l.startsWith('async function ' + nm + '('));
    if (i < 0) throw new Error('no ' + nm + ' in ' + file);
    let j = i; if (!/}\s*$/.test(L[i]) || L[i].split('{').length !== L[i].split('}').length) { while (L[j] !== '}') j++; }
    parts.push(L.slice(i, j + 1).join('\n'));
  });
  const ctx = Object.assign({console}, stubs || {}); vm.createContext(ctx); vm.runInContext(parts.join('\n'), ctx); return ctx;
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

console.log(fails ? `\n${fails} FAILED of ${n}` : `\nALL ${n} PASSED`);
process.exit(fails ? 1 : 0);
