/* ===== 9.39.12 (A4): سجل إجابات لكل سؤال — يُرسل مع ملف الطالب لحساب صعوبة كل سؤال وتمييزه بعد التجربة =====
   k: L درس، F1/F2 جلستا الاختبار النهائي، R إعادة، V مراجعة · s: المفهوم · q: السؤال · c: صحيح؟ · a: رقم محاولة الدرس */
function logResponse(q, correct){
  var sec = CURRENT.section || {}; if (!q || !q.id) return;
  var k = sec.id === 'final_exam' ? ('F' + (sec._session || '')) : sec.id === 'retest_session' ? 'R' : sec.id === 'review_session' ? 'V' : 'L';
  var s = sec._exam ? ((sec._map || {})[q.id] || '') : sec.id;
  var a = k === 'L' ? (((STATE.progress || {})[sec.id] || {}).attempts || 0) + 1 : 0;
  var L = STATE.respLog = Array.isArray(STATE.respLog) ? STATE.respLog : [];
  L.push({t: new Date().toISOString().slice(0, 16), k: k, s: String(s).slice(0, 64), q: String(q.id).slice(0, 64), c: correct ? 1 : 0, a: a});
  if (L.length > 1500) L.splice(0, L.length - 1500);
  if (k === 'L') markLessonSeen(sec, q.id);
}
