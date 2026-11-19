/* ===== Pack sanitisation (B2): package content is untrusted, e.g. a student file opened by a teacher ===== */
var SAFE_TAGS = {BR:1,B:1,I:1,U:1,STRONG:1,EM:1,SPAN:1,SMALL:1,SUB:1,SUP:1};
var DROP_TAGS = {SCRIPT:1,STYLE:1,IFRAME:1,OBJECT:1,EMBED:1,LINK:1,META:1,TEMPLATE:1,NOSCRIPT:1,SVG:1,MATH:1,FORM:1,INPUT:1,BUTTON:1,TEXTAREA:1,SELECT:1,BASE:1,FRAME:1,FRAMESET:1};
function safeHTML(html){
  if (html === null || html === undefined) return '';
  var doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html), 'text/html');
  (function walk(node){
    Array.prototype.slice.call(node.childNodes).forEach(function(ch){
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1){ node.removeChild(ch); return; }
      var tag = String(ch.tagName).toUpperCase();
      if (DROP_TAGS[tag]){ node.removeChild(ch); return; }
      if (!SAFE_TAGS[tag]){ walk(ch); while (ch.firstChild) node.insertBefore(ch.firstChild, ch); node.removeChild(ch); return; }
      Array.prototype.slice.call(ch.attributes).forEach(function(a){
        if (!(a.name === 'class' && /^[\w\- ]{1,60}$/.test(a.value))) ch.removeAttribute(a.name);
      });
      walk(ch);
    });
  })(doc.body);
  return doc.body.innerHTML;
}
var SANITIZE_REPORT = {images:0, audios:0, ids:0, dropped:0};
function safeImageURL(v){
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/]+=*$/.test(v)) return v;
  SANITIZE_REPORT.images++; return null;
}
function safeAudioURL(v){
  if (v === null || v === undefined || v === '') return v === '' ? '' : null;
  if (typeof v === 'string' && /^data:(audio|video)\/[a-z0-9.+\-]+(;codecs=[a-z0-9.,\-]+)?;base64,[A-Za-z0-9+\/]*=*$/i.test(v)) return v;
  if (typeof v === 'string' && /^data:application\/octet-stream;base64,[A-Za-z0-9+\/]*=*$/.test(v)) return v;
  SANITIZE_REPORT.audios++; return null;
}
function safeIdString(id){
  var c = String(id === null || id === undefined ? '' : id).replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 64);
  return c || '_';
}
(function sanitizePackData(){
  try {
    var P = PACK_DATA, idMap = {};
    ['studentPhoto','teacherPhoto','sheikhPhoto','supervisorPhoto','poemReciterPhoto','sourceGiftStudentPhoto','schoolLogo','quranReciterPhoto'].forEach(function(k){
      if (k in P) P[k] = safeImageURL(P[k]);
    });
    ['welcomeAudioNeutral','welcomeAudioMale','welcomeAudioFemale'].forEach(function(k){ if (k in P) P[k] = safeAudioURL(P[k]); });
    // curriculum: ids become attribute-safe, rich text is whitelisted
    // المنهج يُعقَّم في كتلة مستقلة: فشله لا يوقف تعقيم الصوت وبيانات الموافقة
    try {
    if (Array.isArray(P.curriculum)){
      var reg = function(o){ var n = safeIdString(o); if (n !== String(o)){ idMap[String(o)] = n; SANITIZE_REPORT.ids++; } return n; };
      P.curriculum.forEach(function(sec){
        if (!sec || typeof sec !== 'object') return;
        sec.id = reg(sec.id); sec.title = safeHTML(sec.title); sec.emoji = escapeHTML(String(sec.emoji || '📖'));
        sec.items = (Array.isArray(sec.items) ? sec.items : []).filter(function(x){ return x && typeof x === 'object'; }); sec.questions = (Array.isArray(sec.questions) ? sec.questions : []).filter(function(x){ return x && typeof x === 'object'; });
        var cleanQList = function(list){
          return (Array.isArray(list) ? list : []).map(function(q){
            if (!q || typeof q !== 'object') { SANITIZE_REPORT.dropped++; return null; }
            if (QX.has(q.type)){ var r = QX.normalize(q); if (r.errors.length){ SANITIZE_REPORT.dropped++; console.warn('QX question dropped', q.id, r.errors); return null; } if (q.set === 'A' || q.set === 'B') r.q.set = q.set; if (q.review === 'pending') r.q.review = 'pending'; if (q.qpc) r.q.qpc = q.qpc; return r.q; }
            if (['multiple_choice', 'true_false', 'extraction', undefined].indexOf(q.type) < 0){ SANITIZE_REPORT.dropped++; return null; }
            return q;
          }).filter(Boolean);
        };
        sec.questions = cleanQList(sec.questions);
        if (sec.examQuestions !== undefined) sec.examQuestions = cleanQList(sec.examQuestions); // 9.39.11 (ق2-ب): البنك المحجوز
        sec.items.forEach(function(it){ it.id = reg(it.id); it.text = safeHTML(it.text); if (it.desc) it.desc = safeHTML(it.desc); var qp = cleanQpc(it.qpc); if (qp) it.qpc = qp; else delete it.qpc; });
        sec.questions.concat(sec.examQuestions || []).forEach(function(q){
          q.id = reg(q.id);
          if (q.set !== 'A' && q.set !== 'B') delete q.set;
          if (q.review !== 'pending') delete q.review; // 9.39.14 (D5)
          if (q.prev && typeof q.prev === 'object' && !Array.isArray(q.prev) && typeof q.prev.text === 'string'){
            var pv = {}; ['text','question','source'].forEach(function(f){ if (typeof q.prev[f] === 'string') pv[f] = safeHTML(q.prev[f]); }); var pq = cleanQpc(q.prev.qpc); if (pq) pv.qpc = pq; q.prev = pv;
          } else delete q.prev;
          ['text','question','hint','source','explanation'].forEach(function(f){ if (q[f] !== undefined && q[f] !== null) q[f] = safeHTML(q[f]); });
          if (Array.isArray(q.options)) q.options = q.options.map(function(o){ return safeHTML(o); });
          q.points = Number(q.points) > 0 ? Number(q.points) : 10;
          if (q.textType !== undefined && q.textType !== 'quran' && q.textType !== 'poem') delete q.textType;
          var qq = cleanQpc(q.qpc); if (qq) q.qpc = qq; else delete q.qpc; // 9.39.17
        });
      });
    } else if (P.curriculum) P.curriculum = null;
    } catch(e){ console.error('curriculum sanitise failed', e); P.curriculum = []; SANITIZE_REPORT.dropped++; }
    var remapKeys = function(map){
      if (!map || typeof map !== 'object') return map;
      Object.keys(idMap).forEach(function(o){ if (o in map){ map[idMap[o]] = map[o]; delete map[o]; } });
      return map;
    };
    var cleanRec = function(map, field){
      if (!map || typeof map !== 'object') return map;
      remapKeys(map);
      Object.keys(map).forEach(function(k){
        var r = map[k];
        if (field === null) map[k] = safeAudioURL(r);
        else if (r && typeof r === 'object'){
          if ('audio' in r) r.audio = safeAudioURL(r.audio);
          if (typeof r.feedback === 'string') r.feedback = safeAudioURL(r.feedback);
        }
      });
      return map;
    };
    if (Array.isArray(P.trustedTeacherKeys)){
      P.trustedTeacherKeys = P.trustedTeacherKeys.filter(function(k){ return k && k.kty === 'EC' && k.crv === 'P-256' && /^[A-Za-z0-9_\-]{20,100}$/.test(String(k.x)) && /^[A-Za-z0-9_\-]{20,100}$/.test(String(k.y)); }).map(function(k){ return {kty:'EC', crv:'P-256', x:String(k.x), y:String(k.y)}; });
    } else P.trustedTeacherKeys = [];
    if (P.signature && typeof P.signature === 'object'){
      var sk = P.signature.key || {};
      P.signature = {alg: 'ECDSA-P256-SHA256', mv: (P.signature.mv === 4 ? 4 : 3), key: {kty: 'EC', crv: 'P-256', x: String(sk.x || ''), y: String(sk.y || '')}, sig: String(P.signature.sig || '').slice(0, 200), signedAt: String(P.signature.signedAt || '').slice(0, 40)};
    } else P.signature = null;
    P.refCert = cleanCertObj(P.refCert); // 9.39.11 (ق1-ب): يُتحقق منه على اللقطة الأصلية REF_CERT_RAW
    if (P.studentAudios && typeof P.studentAudios === 'object'){
      Object.keys(P.studentAudios).forEach(function(k){ var r = P.studentAudios[k]; if (r && typeof r === 'object') r.partial = r.partial === true; });
    }
    if (P.studentAssessment && typeof P.studentAssessment === 'object'){
      var sa = P.studentAssessment, clean = function(a){ return (Array.isArray(a) ? a : []).map(function(x){ return String(x).slice(0, 64); }).slice(0, 40); };
      var le0 = (sa.lastExam && typeof sa.lastExam === 'object') ? sa.lastExam : null, rd0 = (sa.rounds && typeof sa.rounds === 'object' && !Array.isArray(sa.rounds)) ? sa.rounds : {}, rd = {};
      Object.keys(rd0).slice(0, 40).forEach(function(k){ var o = rd0[k] || {}; rd[String(k).slice(0, 64)] = {r: Math.max(0, Math.min(9999, Number(o.r) || 0)), f: Math.max(0, Math.min(9999, Number(o.f) || 0))}; });
      P.studentAssessment = {v: 1, mastered: clean(sa.mastered), pending: clean(sa.pending), escalated: clean(sa.escalated), at: String(sa.at || '').slice(0, 40),
        lastExam: le0 ? {at: String(le0.at || '').slice(0, 40), total: Math.max(0, Math.min(999, Number(le0.total) || 0)), correct: Math.max(0, Math.min(999, Number(le0.correct) || 0)), wrong: clean(le0.wrong)} : null, rounds: rd,
        log: (Array.isArray(sa.log) ? sa.log : []).slice(-1500).map(function(e){ e = (e && typeof e === 'object') ? e : {}; return {t: String(e.t || '').slice(0, 20), k: String(e.k || '').slice(0, 3), s: safeIdString(e.s), q: safeIdString(e.q), c: e.c ? 1 : 0, a: Math.max(0, Math.min(999, Number(e.a) || 0))}; }),
        restored: (sa.restored && typeof sa.restored === 'object') ? cleanRestored(sa.restored) : null}; // 9.39.12 (A4)، 9.39.13 (D12)
    } else P.studentAssessment = null;
    P.submittedAt = P.submittedAt ? String(P.submittedAt).slice(0, 40) : null;
    if (P.teacherRatings && typeof P.teacherRatings === 'object'){
      var rr = {}; // 9.39.15 (ق6-أ): «لم يُطبَّق» القديمة تصير «يحتاج تدريبًا»
      Object.keys(P.teacherRatings).slice(0, 300).forEach(function(k){ var v = normRating(P.teacherRatings[k]); if (v) rr[safeIdString(k)] = v; });
      P.teacherRatings = rr;
    } else P.teacherRatings = {};
    if (P.teacherOtherRules && typeof P.teacherOtherRules === 'object' && !Array.isArray(P.teacherOtherRules)){
      var orr = {}; Object.keys(P.teacherOtherRules).slice(0, 300).forEach(function(k){ var a = P.teacherOtherRules[k]; if (!Array.isArray(a)) return; a = a.map(String).filter(function(x){ return RATING_CRITERIA.other[x]; }).slice(0, 12); if (a.length) orr[safeIdString(k)] = a; });
      P.teacherOtherRules = orr;
    } else P.teacherOtherRules = {};
    if (P.studentConsent && typeof P.studentConsent === 'object'){
      var pc = P.studentConsent.permissions || {}, exr = P.studentConsent.excludedRecordings || {};
      P.studentConsent = {v: Number(P.studentConsent.v) === 2 ? 2 : 1, guardian: String(P.studentConsent.guardian || '').replace(/[<>]/g, '').slice(0, 60), at: String(P.studentConsent.at || '').slice(0, 40),
        permissions: {record: pc.record === true, review: pc.review === true, shareWithPeers: pc.shareWithPeers === true}, excludedRecordings: Object.keys(exr).slice(0, 200).reduce(function(o,k){ o[String(k).slice(0,64)] = true; return o; }, {})};
      if (P.studentConsent.v === 1) P.studentConsent.permissions = {record: true, review: true, shareWithPeers: false};
    } else P.studentConsent = null;
    if (P.teacherNotes && typeof P.teacherNotes === 'object'){
      remapKeys(P.teacherNotes);
      Object.keys(P.teacherNotes).forEach(function(k){ P.teacherNotes[k] = String(P.teacherNotes[k] === null || P.teacherNotes[k] === undefined ? '' : P.teacherNotes[k]).slice(0, 400); });
    } else P.teacherNotes = {};
    cleanRec(P.masterAudios, null); cleanRec(P.teacherFeedbacks, null);
    cleanRec(P.studentAudios, 'rec'); cleanRec(P.approvedStudentAudios, 'rec'); cleanRec(P.recipientStudentAudios, 'rec');
    if (Array.isArray(P.approvedPeerRecordings)) P.approvedPeerRecordings.forEach(function(g){
      if (!g || typeof g !== 'object') return;
      g.photo = safeImageURL(g.photo); g.shareable = g.shareable === true; g.name = String(g.name || ''); g.id = String(g.id || ''); g.gender = g.gender === 'girl' ? 'girl' : 'boy';
      cleanRec(g.audios, 'rec');
      g.cert = cleanCertObj(g.cert); // 9.39.11 (ق1-ب)
    });
    ['studentGender','teacherGender','supervisorGender','sourceGiftStudentGender'].forEach(function(k){ if (k in P && P[k] !== 'girl') P[k] = 'boy'; });
    // legacy duplicate: peer groups are the single source of approved audio
    if (Array.isArray(P.approvedPeerRecordings) && P.approvedPeerRecordings.length && P.approvedStudentAudios && Object.keys(P.approvedStudentAudios).length) P.approvedStudentAudios = {};
    if (SANITIZE_REPORT.images || SANITIZE_REPORT.audios || SANITIZE_REPORT.ids || SANITIZE_REPORT.dropped) console.warn('pack sanitised', SANITIZE_REPORT);
  } catch(e) { console.error('sanitizePackData failed', e); }
})();

