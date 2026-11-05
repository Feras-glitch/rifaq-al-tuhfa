// 9.39.10: يختبر محرك التقييم كما هو داخل التطبيق نفسه (كانت النسخة المنفصلة tools/assessCore.js قد ابتعدت عنه)، على المنهج المعتمد.
// التشغيل: node tests/test_assess.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'app', 'تطبيق_الطالب_والمعلم_v9.39.html'), 'utf8');
const a = html.indexOf('var ASSESS_CFG'), b = html.indexOf('var CONSENT_VERSION', a);
if (a < 0 || b < 0) { console.log('FAIL cannot locate assessment engine in app'); process.exit(1); }
const ctx = {}; vm.createContext(ctx); vm.runInContext(html.slice(a, b), ctx);
const A = ctx;
const secs = JSON.parse(fs.readFileSync(path.join(ROOT, 'curriculum', 'منهج_المرحلة1_كامل_معتمد_v1.3.json'), 'utf8')).sections;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok', m); };
// 1 split disjoint
const sp = A.assessSplit(secs);
const disjoint = secs.every(s => !sp[s.id].A.some(x => sp[s.id].B.includes(x)));
ok(disjoint, 'versions A/B are disjoint for every concept');
// 2 blueprint gaps
const gaps = A.assessBlueprintGaps(secs);
console.log('gaps:', JSON.stringify(gaps));
// 3 final exam: size 70, no repeats, minimums met
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const exam = A.assessBuildFinal(secs, rng);
ok(exam.length === 70, 'final exam has 70 items (got ' + exam.length + ')');
ok(new Set(exam.map(e => e.q)).size === exam.length, 'no duplicate items in final exam');
const perSec = {}; exam.forEach(e => perSec[e.sec] = (perSec[e.sec] || 0) + 1);
const minOk = secs.every(s => (perSec[s.id] || 0) >= A.assessRequired(s.id) || (A.assessSplit(secs)[s.id].A.length + A.assessSplit(secs)[s.id].B.length) < A.assessRequired(s.id));
ok(minOk, 'every concept meets its minimum in the final exam');
ok(secs.every(s => (perSec[s.id] || 0) >= 2), 'every concept appears at least twice');
// 4 mastery rule: two consecutive passes with different versions
let st = A.assessEmptyState();
A.assessRecordRound(st,'s2_idhhar','A',true,'2026-10-01T00:00:00Z');
ok(!st.concepts['s2_idhhar'].mastered, 'one pass is not mastery');
A.assessRecordRound(st,'s2_idhhar','A',true,'2026-10-02T00:00:00Z');
ok(!st.concepts['s2_idhhar'].mastered, 'two passes on the SAME version is not mastery');
A.assessRecordRound(st,'s2_idhhar','B',true,'2026-10-03T00:00:00Z');
ok(st.concepts['s2_idhhar'].mastered, 'pass on A then pass on B = mastery');
// 5 failure breaks the streak; 4 fails escalate
st = A.assessEmptyState();
A.assessRecordRound(st,'s4_iqlab','A',true,'2026-10-01T00:00:00Z');
A.assessRecordRound(st,'s4_iqlab','B',false,'2026-10-02T00:00:00Z');
A.assessRecordRound(st,'s4_iqlab','A',true,'2026-10-03T00:00:00Z');
ok(!st.concepts['s4_iqlab'].mastered, 'fail between passes prevents mastery');
for (let i=0;i<4;i++) A.assessRecordRound(st,'s4_iqlab','B',false,'2026-10-0'+(4+i)+'T00:00:00Z');
ok(st.concepts['s4_iqlab'].escalated === true, 'four consecutive fails escalate to teacher');
// 6 spaced review schedule
st = A.assessEmptyState();
A.assessRecordRound(st,'s0_muqaddima','A',true,'2026-10-01T00:00:00Z');
A.assessRecordRound(st,'s0_muqaddima','B',true,'2026-10-01T00:00:00Z');
ok(A.assessDueReviews(st,'2026-10-01T23:00:00Z').length === 0, 'no review before 1 day');
ok(A.assessDueReviews(st,'2026-10-02T00:00:01Z').includes('s0_muqaddima'), 'review due after 1 day');
A.assessCompleteReview(st,'s0_muqaddima','2026-10-02T00:00:01Z');
ok(new Date(st.concepts['s0_muqaddima'].nextReview).getTime() - new Date('2026-10-02T00:00:01Z').getTime() === 3*86400000, 'after first review next is +3 days');
// 7 teacher reply overdue after 48h
ok(A.assessTeacherReplyOverdue('2026-10-01T00:00:00Z','2026-10-03T00:00:01Z') === true, 'reply overdue after 48h');
ok(A.assessTeacherReplyOverdue('2026-10-01T00:00:00Z','2026-10-02T23:00:00Z') === false, 'not overdue before 48h');
// 8 (9.39.10) mastery needs two passing rounds with NO repeated question (exam rounds get a unique set name each time)
st = A.assessEmptyState();
A.assessRecordRound(st,'s3_idgham','X1',true,'2026-10-01T00:00:00Z',['q3_1','q3_2']);
A.assessRecordRound(st,'s3_idgham','X2',true,'2026-10-02T00:00:00Z',['q3_1','q3_2']);
ok(!st.concepts['s3_idgham'].mastered, 'two exam passes with the SAME questions are not mastery');
A.assessRecordRound(st,'s3_idgham','X3',true,'2026-10-03T00:00:00Z',['q3_3','q3_4']);
ok(st.concepts['s3_idgham'].mastered, 'two consecutive passes with disjoint questions = mastery');
st = A.assessEmptyState();
A.assessRecordRound(st,'s5_ikhfa','X1',true,'2026-10-01T00:00:00Z',['q5_1','q5_2']);
A.assessRecordRound(st,'s5_ikhfa','X2',true,'2026-10-02T00:00:00Z',['q5_2','q5_3']);
ok(!st.concepts['s5_ikhfa'].mastered, 'one shared question between the two rounds blocks mastery');
st = A.assessEmptyState(); st.concepts.s6_ghunna = {lastSet: 'X123', lastPass: true, streakPass: 0, failStreak: 0, rounds: 1, mastered: false};
A.assessRecordRound(st,'s6_ghunna','X999',true,'2026-10-02T00:00:00Z');
ok(!st.concepts['s6_ghunna'].mastered, 'legacy exam rounds without question lists never count as different versions');
// 9 (9.39.10) the blueprint still holds for the corrected curriculum
ok(A.assessBlueprintGaps(secs).length === 0, 'every concept has enough questions in both sets');
console.log(fails ? 'FAILURES: '+fails : 'ALL PASSED');
process.exit(fails ? 1 : 0);
