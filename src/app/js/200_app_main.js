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

var CURRICULUM = PACK_DATA.curriculum || [
  {id:"sec_1",title:"المقدمة والتعريف",emoji:"📖",
   items:[{id:"v1",text:"يَقُولُ رَاجِي رَحْمَةِ الْغَفُورِ<br>دَوْمًا سُلَيْمَانُ هُوَ الْجَمْزُورِي",desc:"يبدأ الناظم."}],
   questions:[{id:"q1_1",type:"multiple_choice",text:"من هو الناظم؟",options:["أ","ب"],answer:1,explanation:"...",points:10}]}
];

var PACKAGE_ID = PACK_DATA.packageId || ('pack_' + simpleHash(JSON.stringify({sheikh:PACK_DATA.sheikhName||'', student:PACK_DATA.studentName||'', curriculum:(PACK_DATA.curriculum||[]).map(function(x){return x.id;}).join('|')})));
var STORE_NS = RIFAQ_CHANNEL === 'beta' ? 'beta_' : ''; // 9.39.14 (D8): تقدّم الطفل في التجريبي منفصل عن الرئيسي
var STORAGE_BASE = STORE_NS + 'tohfa_student_state_' + PACKAGE_ID;
var ACTIVE_PROFILE_KEY = STORAGE_BASE + '_active';
/* 9.39.5 (R12): مساحة التخزين (الحالة + قاعدة الصوت) تُشتق من معرّف الطفل لا من اسمه، فطفلان بالاسم نفسه لا يتشاركان بياناتهما.
   الترحيل بلا نقل بيانات: الملف الشخصي القديم المسمّى بالاسم يُسجَّل في خريطة المعرّفات بمفاتيحه القديمة كما هي، فلا يضيع شيء. */
var DB_BASE = STORE_NS + 'tohfa_student_audio_' + PACKAGE_ID;
var ID_MAP_KEY = STORAGE_BASE + '_idmap', ACTIVE_ID_KEY = STORAGE_BASE + '_active_id';
function idMap(){ try { var m = JSON.parse(localStorage.getItem(ID_MAP_KEY) || '{}'); return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {}; } catch(e){ return {}; } }
function setIdMap(m){ try { localStorage.setItem(ID_MAP_KEY, JSON.stringify(m)); } catch(e){} }
function legacyKeysForName(n){ var h = simpleHash(String(n || '').trim().toLowerCase()); return {s: STORAGE_BASE + '_' + h, d: DB_BASE + '_' + h}; }
function keysForId(id){ var m = idMap()[id]; if (m && typeof m.s === 'string' && typeof m.d === 'string') return {s: m.s, d: m.d}; var h = simpleHash('id|' + id); return {s: STORAGE_BASE + '_id_' + h, d: DB_BASE + '_id_' + h}; }
function registerProfile(id, keys, name){ var m = idMap(); m[id] = {s: keys.s, d: keys.d, name: String(name || '').slice(0, 80), at: Date.now()}; setIdMap(m); try { localStorage.setItem(ACTIVE_ID_KEY, id); } catch(e){} }
function forgetProfileId(id){ try { var m = idMap(); if (id && m[id]) { delete m[id]; setIdMap(m); } if (id && localStorage.getItem(ACTIVE_ID_KEY) === id) localStorage.removeItem(ACTIVE_ID_KEY); } catch(e){} }
function readStateAt(k){ try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch(e){ return null; } }
function resolveInitialProfile(){
  var guest = {s: STORAGE_BASE + '_guest', d: DB_BASE + '_guest', id: null};
  try {
    var packId = PACK_DATA.studentId ? String(PACK_DATA.studentId) : '';
    if (packId){
      if (idMap()[packId]) { var K0 = keysForId(packId); return {s: K0.s, d: K0.d, id: packId}; }
      if (PACK_DATA.studentName){
        var L = legacyKeysForName(PACK_DATA.studentName), st = readStateAt(L.s);
        if (st && st.student && (st.student.id === packId || !st.student.id)) { registerProfile(packId, L, PACK_DATA.studentName); return {s: L.s, d: L.d, id: packId}; }
      }
      var K = keysForId(packId); registerProfile(packId, K, PACK_DATA.studentName); return {s: K.s, d: K.d, id: packId};
    }
    var act = localStorage.getItem(ACTIVE_ID_KEY);
    if (act && idMap()[act]) { var K1 = keysForId(act); return {s: K1.s, d: K1.d, id: act}; }
    var legacyName = localStorage.getItem(ACTIVE_PROFILE_KEY) || '';
    if (legacyName){
      var L2 = legacyKeysForName(legacyName), st2 = readStateAt(L2.s);
      if (st2){ var id2 = (st2.student && st2.student.id) || newStudentId(); registerProfile(id2, L2, legacyName); return {s: L2.s, d: L2.d, id: id2}; }
    }
  } catch(e){ console.warn('profile resolve failed', e); }
  return guest;
}
var INITIAL_PROFILE = resolveInitialProfile();
var CURRENT_PROFILE_ID = INITIAL_PROFILE.id;
var INITIAL_PROFILE_NAME = PACK_DATA.studentName || localStorage.getItem(ACTIVE_PROFILE_KEY) || '';
var STORAGE_KEY = INITIAL_PROFILE.s;
var TEACHER_STATE = {name:'', gender:'boy', photo:null};
function simpleHash(v){var h=2166136261;for(var i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
var STATE = {
  student: {name:'', gender:'boy', photo:null, supervisorName:'', supervisorGender:'boy'},
  progress: {},
  stats: {totalPoints:0, completedSections:0, perfectSections:0, totalAttempts:0},
  studentAudios: {},
  role: null,
  sawSplash: false,
  recipientOnboarded: false
};

function $(id){ return document.getElementById(id); }
function escapeHTML(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]; });
}
function genderWord(gender, male, female){ return gender === 'girl' ? female : male; }
function personAvatarHTML(photo, gender, alt, size){
  var px = size || 46;
  var safeAlt = escapeHTML(alt || '');
  if (photo) return '<span class="person-avatar" data-style="width:'+px+'px;height:'+px+'px"><img data-media="'+mediaRef('img', photo)+'" alt="'+safeAlt+'"></span>';
  var emoji = gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️';
  return '<span class="person-avatar person-avatar-placeholder" data-style="width:'+px+'px;height:'+px+'px">'+emoji+'</span>';
}
function audioPersonBlock(photo, gender, name, label, audio, extraClass){
  if (!audio) return '';
  return '<div class="person-audio '+(extraClass||'')+'">'+personAvatarHTML(photo,gender,name,34)+'<div class="person-audio-main"><div class="person-audio-label">'+escapeHTML(label)+(name ? ' — '+escapeHTML(name) : '')+'</div><audio controls data-media="'+mediaRef('aud', audio)+'"></audio></div></div>';
}
function giftSourceTerms(giverGender, recipientGender, teacherGender){
  var giverFemale = giverGender === 'girl', recipientFemale = recipientGender === 'girl', teacherFemale = teacherGender === 'girl';
  return {
    role: giverFemale ? '🎓 صاحبة الإهداء' : '🎓 صاحب الإهداء',
    description: giverFemale ? 'هذه زميلتك صاحبة التسجيلات المعتمدة.' : 'هذا زميلك صاحب التسجيلات المعتمدة.',
    teacher: 'تحت إشراف '+(teacherFemale ? 'المعلمة' : 'المعلم'),
    action: recipientFemale ? 'سجّلي بصوتك أنت، ثم أرسلي تسجيلاتك إلى '+(teacherFemale ? 'المعلمة' : 'المعلم')+'، ومن ثم تهدين ملفك لزميلاتك وأصدقائك لتنشرين النفع.' : 'سجّل بصوتك أنت، ثم أرسل تسجيلاتك إلى '+(teacherFemale ? 'المعلمة' : 'المعلم')+'، ومن ثم تهدي ملفك لزملائك وأصدقائك لتنشر النفع.'
  };
}
function normalizeState(raw){
  raw = raw && typeof raw === 'object' ? raw : {};
  var base = {student:{name:'',gender:'boy',photo:null,supervisorName:'',supervisorGender:'boy'},progress:{},stats:{totalPoints:0,completedSections:0,perfectSections:0,totalAttempts:0},studentAudios:{},role:null,sawSplash:false,recipientOnboarded:false};
  base.student = Object.assign(base.student, raw.student || {});
  base.progress = (raw.progress && typeof raw.progress === 'object') ? raw.progress : {};
  base.stats = Object.assign(base.stats, raw.stats || {});
  base.studentAudios = (raw.studentAudios && typeof raw.studentAudios === 'object') ? raw.studentAudios : {};
  base.role = raw.role || null; base.sawSplash = !!raw.sawSplash; base.recipientOnboarded = !!raw.recipientOnboarded;
  /* 9.39 (R01): حالة التقييم كانت تُسقَط عند كل تحميل، فتضيع نتائج الاختبار النهائي والمراجعة المتباعدة */
  if (raw.assess && typeof raw.assess === 'object' && !Array.isArray(raw.assess)){
    var a = raw.assess;
    base.assess = {
      concepts: (a.concepts && typeof a.concepts === 'object') ? a.concepts : {},
      examDone: (a.examDone && typeof a.examDone === 'object') ? a.examDone : {},
      examPlan: (a.examPlan && typeof a.examPlan === 'object') ? a.examPlan : null,
      lastExam: (a.lastExam && typeof a.lastExam === 'object') ? a.lastExam : null,
      examFailedConcepts: Array.isArray(a.examFailedConcepts) ? a.examFailedConcepts : [],
      submittedAt: typeof a.submittedAt === 'string' ? a.submittedAt : null,
      history: Array.isArray(a.history) ? a.history : []
    };
    Object.keys(a).forEach(function(k){ if (!(k in base.assess)) base.assess[k] = a[k]; });
  }
  if (raw.consent && typeof raw.consent === 'object') base.consent = raw.consent;
  if (raw.stars && typeof raw.stars === 'object') base.stars = raw.stars;
  if (raw.giftExcluded && typeof raw.giftExcluded === 'object') base.giftExcluded = raw.giftExcluded;
  /* 9.39.12: كان تقييم المعلم (9.39.11) يُسقَط عند كل تحميل فلا يصل إلى الشهادة؛ وسجل الإجابات جديد */
  if (raw.teacherRatings && typeof raw.teacherRatings === 'object' && !Array.isArray(raw.teacherRatings)){
    base.teacherRatings = {}; Object.keys(raw.teacherRatings).slice(0, 200).forEach(function(k){ var v = normRating(raw.teacherRatings[k]); if (v) base.teacherRatings[String(k).slice(0, 64)] = v; }); // 9.39.15: ترحيل «لم يُطبَّق»
  }
  if (Array.isArray(raw.respLog)) base.respLog = raw.respLog.slice(-1500);
  /* 9.39.13: الأسئلة التي رآها الطفل في كل درس (ق3-ب)، وآخر نسخة احتياطية وعلامة الاستعادة (D12) */
  if (raw.quizSeen && typeof raw.quizSeen === 'object' && !Array.isArray(raw.quizSeen)){
    base.quizSeen = {}; Object.keys(raw.quizSeen).slice(0, 60).forEach(function(k){ if (Array.isArray(raw.quizSeen[k])) base.quizSeen[safeIdString(k)] = raw.quizSeen[k].slice(0, 200).map(safeIdString); });
  }
  if (typeof raw.lastBackupAt === 'string') base.lastBackupAt = raw.lastBackupAt.slice(0, 40);
  if (isFinite(Number(raw.lessonsAtBackup))) base.lessonsAtBackup = Number(raw.lessonsAtBackup) || 0;
  if (isFinite(Number(raw.backupNagAt))) base.backupNagAt = Number(raw.backupNagAt) || 0;
  if (raw.restored && typeof raw.restored === 'object') base.restored = cleanRestored(raw.restored);
  return base;
}
function save(){
  if (isCurrentChildDeleted()) return false; // 9.39.4: العلامة الدائمة تُفحص في كل نافذة، لا متغير هذه النافذة وحدها
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
    return true;
  } catch(e) {
    console.warn('localStorage save failed', e);
    try { toast('⚠️ تعذر حفظ بعض بيانات التقدم محليًا. صدّر عملك الآن.'); } catch(_) {}
    return false;
  }
}
function load(){
  try { var r = localStorage.getItem(STORAGE_KEY); if (r) STATE = normalizeState(JSON.parse(r)); else STATE = normalizeState(STATE); }
  catch(e){ STATE = normalizeState(STATE); console.warn('state load failed', e); }
}
function syncPackStatuses(){
  // In an approved gift, inherited recordings are reference material only.
  if (PACK_DATA.packageType === 'approved_gift') return;
  var packRecords = PACK_DATA.studentAudios || {}, needCheck = false;
  STATE.studentAudios = STATE.studentAudios || {};
  Object.keys(packRecords).forEach(function(id){
    var fromPack = packRecords[id] || {};
    var local = STATE.studentAudios[id];
    // 9.39.5 (R03): التسجيل المحلي يبقى «قيد المراجعة» فقط إن كان أحدث من النسخة التي قرّر فيها المعلم (v).
    // إن كان القرار على النسخة نفسها أو أحدث منها يُطبَّق القرار. الحزم القديمة بلا v تبقى على السلوك السابق.
    if (isNewerLocalRecording(local, fromPack)) return; // 9.39.6: بالمعرّف لا بالساعة
    if (legacyNeedsAudioCheck(local, fromPack)) { needCheck = true; return; } // 9.39.8: لا قرار قبل مطابقة الصوت
    STATE.studentAudios[id] = {status: fromPack.status || 'pending', v: fromPack.v || ''};
  });
  if (needCheck) setTimeout(function(){ reconcileLegacyDecisions(); }, 0);
}
/* 9.39.5 (R12): إذا وُجد على الجهاز طالب بالاسم نفسه يُسأل المستخدم: هل هو نفسه؟ وإلا يُنشأ ملف مستقل بمعرّف جديد */
function chooseProfileForName(name){
  var n = String(name || '').trim().toLowerCase(), m = idMap();
  var cands = Object.keys(m).filter(function(id){ return String(m[id].name || '').trim().toLowerCase() === n; });
  var L = legacyKeysForName(name), lst = readStateAt(L.s), legacyId = null;
  if (lst && !Object.keys(m).some(function(id){ return m[id].s === L.s; })) legacyId = (lst.student && lst.student.id) || ('stu_legacy_' + simpleHash(L.s));
  if (!cands.length && !legacyId) return {id: newStudentId(), existing: false};
  if (confirm('يوجد على هذا الجهاز طالب مسجَّل باسم «' + String(name).trim() + '».\n\nإن كان هذا أنت وتريد متابعة تقدّمك فاضغط «موافق».\nإن كنت طالبًا آخر بالاسم نفسه فاضغط «إلغاء» ليُنشأ لك ملف مستقل لا يختلط بغيره.')){
    if (cands.length) return {id: cands[cands.length - 1], existing: true};
    registerProfile(legacyId, L, name); return {id: legacyId, existing: true};
  }
  return {id: newStudentId(), existing: false};
}
function switchStudentProfile(name, id){
  var clean = (name || '').trim();
  if (!clean) return;
  id = id || CURRENT_PROFILE_ID || newStudentId();
  var K = keysForId(id);
  registerProfile(id, K, clean);
  CURRENT_PROFILE_ID = id;
  if (K.s === STORAGE_KEY && K.d === DB_NAME) { localStorage.setItem(ACTIVE_PROFILE_KEY, clean); syncPackStatuses(); return; }
  STORAGE_KEY = K.s; DB_NAME = K.d;
  localStorage.setItem(ACTIVE_PROFILE_KEY, clean);
  STATE = {student:{name:'',gender:'boy',photo:null,supervisorName:'',supervisorGender:'boy'},progress:{},stats:{totalPoints:0,completedSections:0,perfectSections:0,totalAttempts:0},studentAudios:{},role:STATE.role,sawSplash:STATE.sawSplash,recipientOnboarded:STATE.recipientOnboarded};
  load();
  syncPackStatuses();
}

var DB_NAME = INITIAL_PROFILE.d;
var STORE = 'audios';
var _dbConn = null, _dbConnName = null;
/* 9.39.3 (RT9392-03): حذف قاعدة التسجيلات لا يُعدّ ناجحًا إلا عند onsuccess. علامة الحذف المعلّق تبقى حتى يكتمل،
   وأي فتح لاحق للقاعدة ينتظر اكتمال الحذف أولًا فلا تعود البيانات ولا تُكتب فوقها */
/* 9.39.4 (RT9393-01): علامة الحذف دائمة ومشتركة بين النوافذ: تحمل قاعدة الصوت ومفتاح الحالة معًا، وتُفحص عند الإقلاع
   وعند كل حفظ أو كتابة صوت في أي نافذة، ويُبلَّغ بها كل نافذة مفتوحة عبر حدث storage. لا يكفي متغير في ذاكرة نافذة واحدة. */
var PENDING_DEL_KEY = 'rifaq_pending_db_delete_v1';
var CHILD_DATA_DELETED = false;
var _dbDeleting = {};
function readTombs(){
  try { var a = JSON.parse(localStorage.getItem(PENDING_DEL_KEY) || '[]'); if (!Array.isArray(a)) return [];
    return a.map(function(x){ return typeof x === 'string' ? {d: x, s: null} : (x && typeof x.d === 'string' ? {d: x.d, s: typeof x.s === 'string' ? x.s : null, at: x.at} : null); }).filter(Boolean);
  } catch(e){ return []; }
}
function writeTombs(a){ try { if (a.length) localStorage.setItem(PENDING_DEL_KEY, JSON.stringify(a)); else localStorage.removeItem(PENDING_DEL_KEY); } catch(e){} }
function pendingDbDeletes(){ return readTombs().map(function(t){ return t.d; }); }
function tombFor(dbName, stateKey){ return readTombs().some(function(t){ return t.d === dbName || (!!stateKey && t.s === stateKey); }); }
function isCurrentChildDeleted(){ return CHILD_DATA_DELETED || tombFor(DB_NAME, STORAGE_KEY); }
function markPendingDbDelete(name, on, stateKey){
  var a = readTombs().filter(function(t){ return t.d !== name; });
  if (on) a.push({d: name, s: stateKey || null, at: Date.now()});
  writeTombs(a);
}
function deleteDbFully(name, stateKey){
  if (_dbDeleting[name]) return _dbDeleting[name];
  var prev = readTombs().filter(function(t){ return t.d === name; })[0];
  stateKey = stateKey || (prev && prev.s) || null;
  markPendingDbDelete(name, true, stateKey);
  _dbDeleting[name] = new Promise(function(res, rej){
    var req = indexedDB.deleteDatabase(name);
    req.onsuccess = function(){
      try { if (stateKey) localStorage.removeItem(stateKey); } catch(e){} // حالة ربما أعادت نافذة أخرى كتابتها قبل أن تعلم بالحذف
      markPendingDbDelete(name, false); delete _dbDeleting[name]; res(true);
    };
    req.onerror = function(){ delete _dbDeleting[name]; rej(req.error || new Error('delete failed')); };
    req.onblocked = function(){ console.warn('indexedDB delete blocked: another connection is open'); };
  });
  return _dbDeleting[name];
}
function openDB(){
  if (_dbConn && _dbConnName === DB_NAME) return _dbConn;
  var name = DB_NAME;
  _dbConnName = name;
  var pre = (_dbDeleting[name] || pendingDbDeletes().indexOf(name) >= 0) ? deleteDbFully(name) : Promise.resolve();
  _dbConn = pre.then(function(){ return new Promise(function(res, rej){
    var req = indexedDB.open(name, 1);
    req.onupgradeneeded = function(){
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = function(){
      var db = req.result;
      db.onversionchange = function(){ try { db.close(); } catch(e){} if (_dbConnName === name) { _dbConn = null; _dbConnName = null; } };
      res(db);
    };
    req.onerror = function(){ if (_dbConnName === name) { _dbConn = null; _dbConnName = null; } rej(req.error); };
    req.onblocked = function(){ console.warn('indexedDB open blocked'); };
  }); }, function(e){ if (_dbConnName === name) { _dbConn = null; _dbConnName = null; } throw e; });
  return _dbConn;
}
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e) {}
/* 9.39.6 (RT9395-01): هوية التسجيل رقم عشوائي يُنشأ مع كل تسجيل جديد، فلا تتأثر برجوع ساعة الجهاز أو تساويها */
function newRecId(){
  try { var u = new Uint8Array(12); crypto.getRandomValues(u); var s = ''; for (var i = 0; i < u.length; i++) s += ('0' + u[i].toString(16)).slice(-2); return 'rec_' + s; } catch(e){}
  return 'rec_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
/* هل التسجيل المحلي غير التسجيل الذي صدر عنه قرار الحزمة؟ بالمعرّف إن وُجد، وبالتاريخ للبيانات القديمة وحدها */
function isNewerLocalRecording(local, fromPack){
  if (!local || local.status !== 'pending') return false;
  if (local.rid) return String(fromPack && fromPack.v || '') !== local.rid;
  if (!local.updatedAt) return false;
  /* 9.39.7: التسجيل القديم بلا rid — في 9.39.5 كانت v هي updatedAt نفسه حرفيًا، فالمطابقة الحرفية تحدد التسجيل نفسه.
     لا مقارنة بالأقدم/الأحدث إطلاقًا، فرجوع الساعة أو تساويها لا يمنح تسجيلًا آخر قرارًا ليس له.
     الحزم الأقدم من 9.39.5 بلا v تبقى على سلوكها السابق (التسجيل المحلي يبقى قيد المراجعة). */
  var pv = fromPack && fromPack.v ? String(fromPack.v) : '';
  return !pv || pv !== String(local.updatedAt);
}
/* 9.39.8 (RT9397-01): تساوي الوقت لا يثبت تطابق الصوت. التسجيل القديم بلا rid ذو الوقت المطابق يبقى «قيد المراجعة»
   حتى تُقارن بصمة صوته المحفوظ على الجهاز ببصمة الصوت الذي قرّر فيه المعلم؛ فإن تطابقتا طُبِّق القرار، وإلا بقي قيد المراجعة */
function legacyNeedsAudioCheck(local, fromPack){
  return !!(local && local.status === 'pending' && !local.rid && local.updatedAt && fromPack && fromPack.v && String(fromPack.v) === String(local.updatedAt));
}
async function sha256OfBytes(u8){ var d = await crypto.subtle.digest('SHA-256', u8); return b64FromBytes(new Uint8Array(d)); }
/* 9.39.9 (RT9398-01): كل مقارنة مربوطة بسياقها (الطالب، مفتاح الحالة، قاعدة الصوت، كائن الحالة، وسجل التسجيل نفسه).
   تُلغى نتيجتها إن تغيّر أي منها أثناء الحساب (تبديل الطالب مثلًا)، ولكل سياق مقارنته المستقلة. */
var _legacyReconcile = null;
function legacyContext(){ return {pid: CURRENT_PROFILE_ID, s: STORAGE_KEY, d: DB_NAME, st: STATE}; }
function sameLegacyContext(c){ return !!c && c.pid === CURRENT_PROFILE_ID && c.s === STORAGE_KEY && c.d === DB_NAME && c.st === STATE; }
function reconcileLegacyDecisions(){
  if (_legacyReconcile && sameLegacyContext(_legacyReconcile.ctx)) return _legacyReconcile.p;
  var ctx = legacyContext();
  var run = {ctx: ctx, p: null};
  run.p = (async function(){
    var packRecords = PACK_DATA.studentAudios || {}, changed = 0;
    var ids = Object.keys(packRecords).filter(function(id){ return legacyNeedsAudioCheck(ctx.st.studentAudios && ctx.st.studentAudios[id], packRecords[id]); });
    for (var i = 0; i < ids.length; i++){
      if (!sameLegacyContext(ctx)) return changed; // تغيّر الطالب أو مساحة التخزين: لا نتيجة لهذا السياق في غيره
      var id = ids[i], fp = packRecords[id], startRec = ctx.st.studentAudios[id];
      try {
        var m = /^data:[^,]*;base64,(.*)$/.exec(String(fp.audio || ''));
        if (!m) continue; // لا صوت في الحزمة للمقارنة: يبقى قيد المراجعة
        var blob = await dbGetFrom(ctx.d, id);
        if (!blob) continue; // لا صوت محلي للمقارنة: يبقى قيد المراجعة
        var a = await sha256OfBytes(new Uint8Array(await blob.arrayBuffer()));
        var b = await sha256OfBytes(bytesFromB64(m[1]));
        /* لا يُكتب القرار إلا في السياق الذي بدأ فيه الحساب، وعلى سجل التسجيل نفسه دون تغيّر */
        if (a === b && sameLegacyContext(ctx) && STATE.studentAudios[id] === startRec && legacyNeedsAudioCheck(startRec, fp)){
          STATE.studentAudios[id] = {status: fp.status || 'pending', v: fp.v || ''}; changed++;
        }
      } catch(e){ console.warn('legacy decision check failed', id, e); }
    }
    if (changed && sameLegacyContext(ctx)){ save(); try { if ($('view-home') && !$('view-home').classList.contains('hidden')) renderHome(); } catch(e){} }
    return changed;
  })();
  _legacyReconcile = run;
  run.p.then(function(){ if (_legacyReconcile === run) _legacyReconcile = null; }, function(){ if (_legacyReconcile === run) _legacyReconcile = null; });
  return run.p;
}
/* قراءة صوت من قاعدة محددة بالاسم (لا من قاعدة الطالب الحالي) */
function dbGetFrom(name, key){
  if (name === DB_NAME) return dbGet(key);
  return new Promise(function(res){
    try {
      var q = indexedDB.open(name);
      q.onupgradeneeded = function(){ try { q.transaction.abort(); } catch(e){} res(null); };
      q.onsuccess = function(){ var db = q.result; try { if (!db.objectStoreNames.contains(STORE)){ db.close(); res(null); return; }
        var g = db.transaction(STORE, 'readonly').objectStore(STORE).get(key); g.onsuccess = function(){ db.close(); res(g.result || null); }; g.onerror = function(){ db.close(); res(null); }; } catch(e){ try { db.close(); } catch(x){} res(null); } };
      q.onerror = function(){ res(null); };
    } catch(e){ res(null); }
  });
}
function newStudentId(){
  try { if (window.crypto && crypto.randomUUID) return 'stu_' + crypto.randomUUID(); } catch(e) {}
  var a = ''; try { var u = new Uint8Array(16); crypto.getRandomValues(u); for (var i=0;i<u.length;i++) a += ('0'+u[i].toString(16)).slice(-2); } catch(e) { a = Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
  return 'stu_' + a;
}
async function dbPut(key, blob){
  if (isCurrentChildDeleted()) throw new Error('child data deleted on this device');
  var db = await openDB();
  return new Promise(function(res, rej){
    var tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = function(){ res(true); };
    tx.onerror = function(){ rej(tx.error); };
  });
}
async function dbGet(key){
  var db = await openDB();
  return new Promise(function(res, rej){
    var tx = db.transaction(STORE,'readonly');
    var r = tx.objectStore(STORE).get(key);
    r.onsuccess = function(){ res(r.result || null); };
    r.onerror = function(){ rej(r.error); };
  });
}
async function dbDel(key){
  var db = await openDB();
  return new Promise(function(res, rej){
    var tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = function(){ res(true); };
    tx.onerror = function(){ rej(tx.error); };
  });
}

function show(id){
  ['view-splash','view-student-setup','view-home','view-lesson','view-quiz','view-results','view-profile','view-teacher-review','view-tf','view-certificate','view-preview'].forEach(function(v){
    var el = $(v); if(!el) return;
    el.classList.toggle('hidden', v !== id);
  });
  if (id !== 'view-certificate' && id !== 'view-preview') window.scrollTo(0, 0);
  try { document.querySelectorAll('.confetti').forEach(function(c){ c.remove(); }); } catch(e){}
  navGuardSync(id);
}
/* 9.39.10: زر «رجوع» في الهاتف/المتصفح يعود داخل التطبيق (إلى الخريطة) بدل الخروج منه وفقد الاختبار الجاري */
var NAV_GUARD = false;
var NAV_DEEP = ['view-lesson','view-quiz','view-results','view-profile','view-certificate','view-preview'];
function currentViewId(){ for (var i = 0; i < NAV_DEEP.length; i++){ var el = document.getElementById(NAV_DEEP[i]); if (el && !el.classList.contains('hidden')) return NAV_DEEP[i]; } return null; }
function navGuardSync(id){
  if (NAV_DEEP.indexOf(id) < 0 || NAV_GUARD) return;
  try { history.pushState({rifaqNav: 1}, ''); NAV_GUARD = true; } catch(e){}
}
window.addEventListener('popstate', function(){
  if (!NAV_GUARD) return;
  NAV_GUARD = false;
  var cur = currentViewId(); if (!cur) return;
  if (cur === 'view-quiz' && !confirmLeaveQuiz()){ navGuardSync('view-quiz'); return; }
  if (cur === 'view-certificate' && typeof closeCertificate === 'function'){ try { closeCertificate(); return; } catch(e){} }
  goHome();
});
function detectTextType(q){
  if (q.textType) return q.textType;
  if (!q.text) return 'prose';
  if (q.text.indexOf('﴿') !== -1) return 'quran';
  return 'poem';
}
function termsForType(t){
  if (t === 'quran') return {masterBtn:'🎧 اسمع تلاوة الشيخ', recBtn:'🎙️ اتلُ الآية', recAgain:'🔄 {أعد|أعيدي} التلاوة', playBtn:'🔊 اسمع تلاوتك', badge:'📿 آية قرآنية'};
  if (t === 'poem') return {masterBtn:'🎧 اسمع إنشاد الشيخ', recBtn:'🎙️ أنشد البيت', recAgain:'🔄 {أعد|أعيدي} الإنشاد', playBtn:'🔊 اسمع إنشادك', badge:'📖 بيت منظوم'};
  return {masterBtn:'🎧 اسمع التسجيل', recBtn:'🎙️ سجّل', recAgain:'🔄 أعد', playBtn:'🔊 اسمع تسجيلك', badge:'📝 سؤال'};
}
function teacherByline(){
  var g = PACK_DATA.teacherGender === 'girl' ? 'المعلمة' : 'المعلم', n = String(PACK_DATA.teacherName || '').trim();
  if (!n || n === 'المعلم' || n === 'المعلمة') return g;
  if (/^(ال(شيخ|شيخة|معلم|معلمة|أستاذ|أستاذة|مقرئ|مقرئة)|أ\.|د\.)/.test(n)) return n;
  return g + ' ' + n;
}
function hasTeacherFeedbacks(){
  return !!(PACK_DATA.teacherFeedbacks && Object.keys(PACK_DATA.teacherFeedbacks).length > 0);
}
function detectMode(){
  var type = PACK_DATA.packageType;
  if (type === 'student_returned') return 'student-returned';
  if (type === 'approved_gift' || PACK_DATA.approved === true) return 'friend';
  if (type === 'student_submission' || type === 'teacher_review') return 'teacher-review';
  if (PACK_DATA.studentName) return 'user-choice';
  if (hasTeacherFeedbacks()) return 'student-returned';
  return 'student-fresh';
}

function isGenericName(n){ n = String(n || '').trim(); return !n || ['الشيخ', 'المشرف', 'المشرفة', 'المعلم', 'المعلمة', '—'].indexOf(n) >= 0; } // 9.39.12 (I4)
function buildSplash(){
  var isGirl = false;
  var av = $('splash-avatar');
  var mode = detectMode();
  if (mode === 'friend' && PACK_DATA.sourceGiftStudentPhoto) av.innerHTML = '<img data-media="' + mediaRef('img', PACK_DATA.sourceGiftStudentPhoto) + '" alt="صورة صاحب الإهداء">';
  else if (PACK_DATA.supervisorPhoto || PACK_DATA.sheikhPhoto) av.innerHTML = '<img data-media="' + mediaRef('img', (PACK_DATA.supervisorPhoto || PACK_DATA.sheikhPhoto)) + '" alt="">';
  else av.innerHTML = '<span class="emoji">👨‍🏫</span>';

  var skipBtn = document.querySelector('.splash-skip');
  if (skipBtn) skipBtn.textContent = mode === 'teacher-review' ? '👨‍🏫 فتح شاشة المراجعة' : mode === 'student-returned' ? '📢 عرض ملاحظات المعلم' : '← تخطي';
  var splash = $('view-splash');
  splash.classList.remove('teacher-mode','friend-mode','returned-mode');

  if (mode === 'friend'){
    splash.classList.add('friend-mode');
    var sg = PACK_DATA.sourceGiftStudentGender || 'boy';
    var tg = PACK_DATA.teacherGender || 'boy';
    $('splash-badge').textContent = '🎓 إعداد المشرف';
    $('splash-from').textContent = 'إهداء من ' + (sg === 'girl' ? 'زميلتك ' : 'زميلك ') + (PACK_DATA.sourceGiftStudentName || (sg === 'girl' ? 'إحدى زميلاتك' : 'أحد زملائك'));
    $('splash-role').textContent = sg === 'girl' ? 'إهداء من زميلتك' : 'إهداء من زميلك';
    $('splash-name').textContent = 'بإشراف ' + (tg === 'girl' ? 'المعلمة' : 'المعلم') + (PACK_DATA.teacherName && PACK_DATA.teacherName !== 'المعلم' ? ' ' + PACK_DATA.teacherName : '');
    $('splash-hint').textContent = '{أدخل|أدخلي} اسمك وجنسك وصورتك، ثم تبدأ رحلتك أنت.';
  } else if (mode === 'student-returned'){
    splash.classList.add('returned-mode');
    $('splash-badge').textContent = '📢 تعليقات المعلم';
    $('splash-from').textContent = '{راجع|راجعي} تسجيلاتك';
    $('splash-role').textContent = 'تعليقات المعلم';
    $('splash-name').textContent = 'بانتظارك ' + (PACK_DATA.studentName || '') + '!';
    $('splash-hint').textContent = 'اضغط تخطي لعرض تعليقات المعلم.';
  } else if (mode === 'teacher-review'){
    splash.classList.add('teacher-mode');
    $('splash-badge').textContent = '📨 ملف مراجعة الطالب';
    $('splash-from').textContent = 'هذا الملف مخصص للمعلم المشرف';
    $('splash-role').textContent = 'مراجعة تسجيلات الطالب';
    $('splash-name').textContent = PACK_DATA.studentName || '—';
    $('splash-hint').textContent = 'اضغط للمتابعة إلى شاشة مراجعة التسجيلات.';
  } else {
    var spN = PACK_DATA.supervisorName || PACK_DATA.sheikhName || '';
    $('splash-badge').textContent = '🎓 إعداد تعليمي';
    if (isGenericName(spN)){ $('splash-from').textContent = 'مرحبًا بك في'; $('splash-role').textContent = 'رفاق التحفة'; $('splash-name').textContent = 'منهج تحفة الأطفال'; }
    else { $('splash-role').textContent = 'المشرف'; $('splash-name').textContent = spN; }
  }

  var g = $('splash-greetings'); g.innerHTML = '';
  var hasN = !!PACK_DATA.welcomeAudioNeutral;
  var hasM = !!PACK_DATA.welcomeAudioMale;
  var hasF = !!PACK_DATA.welcomeAudioFemale;
  if (hasN || hasM || hasF) {
    var h = document.createElement('div');
    h.style.cssText = 'font-size:.82rem;opacity:.9;margin-bottom:8px;width:100%';
    h.textContent = '🎧 {اسمع|اسمعي} التحية:';
    g.appendChild(h);
    if (hasN) g.appendChild(makeGreetBtn('🎧 عامة', PACK_DATA.welcomeAudioNeutral));
    if (hasM) g.appendChild(makeGreetBtn('👦 للأولاد', PACK_DATA.welcomeAudioMale));
    if (hasF) g.appendChild(makeGreetBtn('👧 للبنات', PACK_DATA.welcomeAudioFemale));
  }

  var rc = $('splash-role-choice');
  rc.innerHTML = '';
  if (mode === 'teacher-review'){
    rc.className = 'role-choice';
    var tb = document.createElement('button'); tb.type='button'; tb.className='teacher'; tb.textContent='👨‍🏫 فتح شاشة المراجعة';
    tb.onclick=function(){ STATE.role='teacher'; save(); continueFromSplash(); };
    rc.appendChild(tb);
  } else if (mode === 'user-choice'){
    rc.className = 'role-choice';
    rc.innerHTML = '<div data-style="font-size:.9rem;margin-bottom:6px;opacity:.9">من أنت؟</div>';
    var t = document.createElement('button');
    t.type = 'button'; t.className = 'teacher';
    t.textContent = '👨‍🏫 المعلم المشرف (مراجعة)';
    t.onclick = function(){ STATE.role = 'teacher'; save(); continueFromSplash(); };
    var s = document.createElement('button');
    s.type = 'button'; s.className = 'student';
    s.textContent = '👦 الطالب صاحب الملف';
    s.onclick = function(){ STATE.role = 'student'; save(); continueFromSplash(); };
    rc.appendChild(t); rc.appendChild(s);
  } else {
    rc.className = '';
  }
}
function makeGreetBtn(label, src){
  var b = document.createElement('button');
  b.type = 'button'; b.textContent = label;
  b.onclick = function(){
    document.querySelectorAll('audio').forEach(function(a){ try{ a.pause(); }catch(e){} });
    document.querySelectorAll('.splash-greetings button').forEach(function(x){ x.classList.remove('playing'); });
    var audio = new Audio(src);
    audio.play().catch(function(){});
    b.classList.add('playing');
    audio.onended = function(){ b.classList.remove('playing'); };
  };
  return b;
}
function continueFromSplash(){
  STATE.sawSplash = true; save();
  var mode = detectMode();
  // Package mode is authoritative: never let a stale local role or the Skip button turn a teacher package into a student session.
  if (mode === 'teacher-review') STATE.role = 'teacher';
  else if (mode === 'student-returned') STATE.role = 'student';
  else if (mode === 'friend') STATE.role = 'friend';
  else if (!STATE.role) STATE.role = 'student';

  if (STATE.role === 'teacher' && (PACK_DATA.packageType === 'student_submission' || PACK_DATA.packageType === 'teacher_review')){
    // A submission package is a teacher-review package. Never route it through
    // the student's profile/setup screen, even when this browser has stale state.
    showTeacherReview();
    return;
  }
  if (mode === 'friend') {
    // Every approved gift starts with a fresh recipient profile. Never inherit the giver's profile.
    STATE.student = {name:'', gender:'boy', photo:null, supervisorName:'', supervisorGender:'boy'};
    STATE.progress = {};
    STATE.stats = {totalPoints:0,completedSections:0,perfectSections:0,totalAttempts:0};
    STATE.studentAudios = {};
    STATE.role = 'friend';
    STATE.sawSplash = true;
    save();
    buildSetup(); show('view-student-setup');
    return;
  }
  if (mode === 'student-returned' || STATE.role === 'student'){
    if (STATE.student.name){
      applyTheme();
      if (mode === 'student-returned') { renderTFView(); show('view-tf'); }
      else { show('view-home'); renderHome(); }
    } else {
      buildSetup();
      show('view-student-setup');
    }
  } else if (STATE.role === 'teacher'){
    buildSetup();
    show('view-student-setup');
  } else {
    buildSetup();
    show('view-student-setup');
  }
}

var setupGender = 'boy', setupPhoto = null;
function buildSetup(){
  var isTeacher = STATE.role === 'teacher';
  var profile = isTeacher ? TEACHER_STATE : STATE.student;
  $('setup-name').value = isTeacher ? (TEACHER_STATE.name || PACK_DATA.teacherName || '') : (detectMode() === 'friend' ? '' : (profile.name || PACK_DATA.studentName || ''));
  setSetupGender(profile.gender || 'boy');
  var isGiftRecipient = detectMode() === 'friend';
  setupPhoto = (isGiftRecipient ? null : (profile.photo || null));
  var giftCard = $('gift-source-card');
  if (giftCard) giftCard.classList.toggle('hidden', !isGiftRecipient);
  if (isGiftRecipient) {
    var giverName = PACK_DATA.sourceGiftStudentName || 'زميلك';
    var giverGender = PACK_DATA.sourceGiftStudentGender || 'boy';
    var recipientGender = profile.gender || 'boy';
    var teacherGender = PACK_DATA.teacherGender || 'boy';
    var gt = giftSourceTerms(giverGender, recipientGender, teacherGender);
    $('gift-source-name').textContent = giverName;
    $('gift-source-role').textContent = gt.role;
    $('gift-source-description').textContent = gt.description + giftTrustBadge();
    /* 9.39.5 (R08): بيان ما في الإهداء وما سيتعلمه المهدى إليه، قبل أن يبدأ */
    var gcBox = document.getElementById('gift-contents-box');
    if (!gcBox){ gcBox = document.createElement('div'); gcBox.id = 'gift-contents-box'; gcBox.className = 'notice'; gcBox.style.cssText = 'white-space:pre-line;font-size:.84rem;margin-top:10px;text-align:right'; giftCard.appendChild(gcBox); }
    renderGiftContentsBox(gcBox);
    $('gift-teacher-line').textContent = gt.teacher + (PACK_DATA.teacherName ? ' ' + PACK_DATA.teacherName : '');
    $('gift-source-action').textContent = gt.action;
    var giverPhoto = PACK_DATA.sourceGiftStudentPhoto || null;
    var giverAvatar = $('gift-source-avatar');
    if (giverPhoto) giverAvatar.innerHTML = '<img data-media="' + mediaRef('img', giverPhoto) + '" alt="صورة صاحب الإهداء">';
    else giverAvatar.innerHTML = '<span class="emoji">🌟</span>';
    var gsCard = $('gift-supervisor-card');
    if (gsCard) gsCard.classList.remove('hidden');
    var gsName = $('gift-supervisor-name'); if (gsName) gsName.textContent = PACK_DATA.teacherName || '—';
    var gsAvatar = $('gift-supervisor-avatar');
    if (gsAvatar) gsAvatar.innerHTML = PACK_DATA.teacherPhoto ? '<img data-media="'+mediaRef('img', PACK_DATA.teacherPhoto)+'" alt="صورة المعلم">' : '<span class="emoji">'+(teacherGender === 'girl' ? '👩‍🏫' : '👨‍🏫')+'</span>';
  } else {
    var gsCard2 = $('gift-supervisor-card'); if (gsCard2) gsCard2.classList.add('hidden');
  }
  if (setupPhoto){
    $('setup-photo-img').src = setupPhoto;
    $('setup-photo-img').classList.remove('hidden');
    $('setup-photo-placeholder').classList.add('hidden');
  } else {
    $('setup-photo-img').removeAttribute('src');
    $('setup-photo-img').classList.add('hidden');
    $('setup-photo-placeholder').classList.remove('hidden');
  }
  if (STATE.role === 'teacher') $('setup-title').textContent = 'بيانات المعلم المراجع';
  else if (detectMode() === 'friend') $('setup-title').textContent = 'بيانات مستلم الإعداد';
  else $('setup-title').textContent = 'قبل أن نبدأ';
  if ($('btn-new-student')) $('btn-new-student').classList.toggle('hidden', STATE.role === 'teacher');
}
var SETUP_NEW_STUDENT = false;
function startNewStudent(){
  if (STATE.role === 'teacher') return;
  SETUP_NEW_STUDENT = true; // 9.39.5 (R12)
  $('setup-name').value = ''; setupPhoto = null;
  $('setup-photo-img').removeAttribute('src'); $('setup-photo-img').classList.add('hidden');
  $('setup-photo-placeholder').classList.remove('hidden');
  setSetupGender('boy'); $('setup-name').focus();
}
function setSetupGender(g){
  setupGender = g;
  $('setup-boy').classList.toggle('selected', g === 'boy');
  $('setup-girl').classList.toggle('selected', g === 'girl');
  var _ni = $('setup-name'); if (_ni) _ni.placeholder = (g === 'girl' ? 'اكتبي' : 'اكتب') + ' اسمك الكامل';
}
function imageFileLooksValid(file){
  if (!file) return false;
  if (file.type && /^image\//i.test(file.type)) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '');
}
function dataUrlBytes(dataUrl){
  var comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  var b64 = dataUrl.slice(comma+1);
  return Math.floor(b64.length * 3 / 4);
}
function compressCanvasImage(img, maxSide, maxBytes, qualityStart){
  var side = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  for (var pass=0; pass<4; pass++){
    var canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.naturalWidth*side));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*side));
    var ctx=canvas.getContext('2d'); if(!ctx) throw new Error('canvas');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    var q=qualityStart;
    for (var qi=0; qi<5; qi++){
      var out=canvas.toDataURL('image/jpeg',q);
      if(dataUrlBytes(out)<=maxBytes || (canvas.width<=480 && q<=0.62)) return out;
      q=Math.max(0.62,q-0.07);
    }
    side*=0.82;
  }
  return canvas.toDataURL('image/jpeg',0.62);
}
function handleSetupPhoto(event){
  var file = event.target.files && event.target.files[0]; if (!file) return;
  if (!imageFileLooksValid(file)){ alert('{اختر|اختاري} ملف صورة.'); event.target.value=''; return; }
  var reader = new FileReader();
  reader.onerror = function(){ alert('تعذرت قراءة الصورة. {اختر|اختاري} صورة أخرى.'); event.target.value=''; };
  reader.onload = function(e){
    var img = new Image();
    img.onerror = function(){ alert('هذا النوع من الصور لا يستطيع المتصفح قراءته مباشرة. إذا كانت HEIC/HEIF فاختر JPG أو PNG.'); event.target.value=''; };
    img.onload = function(){
      try {
        setupPhoto=compressCanvasImage(img, 800, 220*1024, 0.78);
        $('setup-photo-img').src=setupPhoto; $('setup-photo-img').classList.remove('hidden'); $('setup-photo-placeholder').classList.add('hidden');
      } catch(err){ alert('تعذر تجهيز الصورة. {اختر|اختاري} صورة أخرى.'); event.target.value=''; }
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveSetup(){
  var name = ($('setup-name').value || '').trim();
  if (!name){ toast('✍️ اكتب اسمك أولًا / اكتبي اسمك أولًا'); try { $('setup-name').focus(); } catch(e){} return; }
  if (STATE.role === 'teacher') {
    TEACHER_STATE.name = name; TEACHER_STATE.gender = setupGender; TEACHER_STATE.photo = setupPhoto;
    PACK_DATA.teacherName = name;
    PACK_DATA.teacherGender = setupGender;
    PACK_DATA.teacherPhoto = setupPhoto || null;
    showTeacherReview(); return;
  }
  var currentMode = detectMode();
  if (currentMode === 'friend') {
    // Switch storage namespace (localStorage + IndexedDB) to the recipient BEFORE saving,
    // otherwise state is written under the guest keys and lost on the next load.
    switchStudentProfile(name, newStudentId()); // 9.39.5: مستلم الإهداء ملف مستقل دائمًا، فلا يطغى على طالب بالاسم نفسه
    STATE.student = {id:CURRENT_PROFILE_ID, name:name, gender:setupGender, photo:setupPhoto, supervisorName:'', supervisorGender:'boy'};
    STATE.progress = {};
    STATE.stats = {totalPoints:0,completedSections:0,perfectSections:0,totalAttempts:0};
    STATE.studentAudios = {};
    STATE.role = 'student';
    STATE.recipientOnboarded = true;
    localStorage.setItem(ACTIVE_PROFILE_KEY, name);
    save();
    applyTheme();
    show('view-home'); renderHome();
    toast('🎁 أهلاً بك يا ' + name + '! هذه إعداداتك التعليمية الجديدة.'); confetti(30);
    askConsentAfterSetup();
    return;
  }
  var curName = String(STATE.student.name || '').trim().toLowerCase();
  var packOwn = !!PACK_DATA.studentId && name.toLowerCase() === String(PACK_DATA.studentName || '').trim().toLowerCase();
  var _wantNew = SETUP_NEW_STUDENT; SETUP_NEW_STUDENT = false;
  if ((name.toLowerCase() !== curName || _wantNew) && !packOwn) switchStudentProfile(name, chooseProfileForName(name).id);
  else if (!CURRENT_PROFILE_ID) switchStudentProfile(name, STATE.student.id || PACK_DATA.studentId || newStudentId());
  localStorage.setItem(ACTIVE_PROFILE_KEY, name);
  STATE.student.name = name;
  STATE.student.gender = setupGender;
  STATE.student.photo = setupPhoto;
  STATE.student.id = CURRENT_PROFILE_ID || STATE.student.id || PACK_DATA.studentId || newStudentId();
  save();
  applyTheme();
  if (currentMode === 'student-returned') {
    renderTFView(); show('view-tf'); toast('أهلاً يا ' + name + '! راجع ملاحظات المعلم.');
    askConsentAfterSetup();
    return;
  }
  show('view-home'); renderHome();
  toast('🎉 أهلاً يا ' + name + '!'); confetti(30);
  askConsentAfterSetup();
}
function applyTheme(){
  document.body.classList.remove('theme-boy','theme-girl');
  document.body.classList.add('theme-' + (STATE.student.gender || 'boy'));
}

function renderHome(){
  applyTheme();
  var s = STATE.student;
  var av = $('home-avatar');
  if (s.photo) av.innerHTML = '<img data-media="' + mediaRef('img', s.photo) + '" alt="">';
  else av.innerHTML = '<span class="emoji">' + (s.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️') + '</span>';
  $('home-name').textContent = s.name || '—';

  var sub = 'في رحاب القرآن · رفاق التحفة' + (!isGenericName(PACK_DATA.sheikhName) ? ' · المادة التعليمية: ' + PACK_DATA.sheikhName : '');
  if (PACK_DATA.packageType === 'approved_gift' && (PACK_DATA.sourceGiftStudentName || PACK_DATA.studentName)) {
    sub = 'إهداء من ' + (PACK_DATA.sourceGiftStudentGender === 'girl' ? 'زميلتك ' : 'زميلك ') + (PACK_DATA.sourceGiftStudentName || PACK_DATA.studentName || '—') + ' • بإشراف ' + teacherByline();
  }
  $('home-sub').textContent = sub;
  var refB = document.getElementById('home-ref-banner'); // 9.39.11 (ق1-ب)
  if (REF_HIDDEN){
    if (!refB){ refB = document.createElement('div'); refB.id = 'home-ref-banner'; refB.className = 'notice warn'; refB.style.cssText = 'margin:10px 0;font-size:.88rem'; var sl0 = $('section-list'); if (sl0 && sl0.parentNode) sl0.parentNode.insertBefore(refB, sl0); }
    refB.textContent = '⚠️ هذا الملف لا يحمل توقيع المشرف المعتمد، فأُخفيت تلاوات الشيخ. اطلب من معلمك الملف الأصلي.';
  } else if (refB) refB.remove();
  var gcBtn = document.getElementById('home-gift-contents-btn');
  if (PACK_DATA.packageType === 'approved_gift'){
    if (!gcBtn){ gcBtn = document.createElement('button'); gcBtn.id = 'home-gift-contents-btn'; gcBtn.type = 'button'; gcBtn.className = 'btn ghost'; gcBtn.style.cssText = 'margin-top:6px;font-size:.8rem;padding:4px 10px';
      gcBtn.textContent = '🎁 ماذا في هذا الإهداء؟'; gcBtn.setAttribute('data-call', '["showGiftContents"]'); $('home-sub').parentNode.appendChild(gcBtn); }
  } else if (gcBtn) gcBtn.remove();

  var _real = realSections();
  var completed = 0, totalStars = 0, maxStars = _real.length * 3;
  _real.forEach(function(sec){
    var pr = STATE.progress[sec.id];
    if (pr && pr.stars > 0) completed++;
    totalStars += (pr && pr.stars) || 0;
  });
  var pct = maxStars ? Math.round(totalStars / maxStars * 100) : 0;
  $('total-progress').style.width = pct + '%';
  $('total-points-pill').textContent = (STATE.stats.totalPoints || 0) + ' نقطة';
  $('progress-label').textContent = completed + ' من ' + _real.length + ' أقسام — ' + totalStars + '/' + maxStars + ' نجوم';

  var html = '';
  CURRICULUM.forEach(function(sec){
    var pr = STATE.progress[sec.id] || {stars: 0};
    var sh = '';
    for (var i = 1; i <= 3; i++) sh += '<span class="star' + (i <= pr.stars ? ' earned' : '') + '">⭐</span>';
    html += '<div class="section-card" ' + ACT('openSection', sec.id) + '>';
    html += '<div class="sec-icon">' + sec.emoji + '</div>';
    html += '<div class="sec-info"><h3>' + sec.title + '</h3>';
    html += '<div class="sec-meta">' + arCount(sec.items.length, 'عنصر', 'عنصران', 'عناصر') + ' · ' + arCount(sec.questions.length, 'سؤال', 'سؤالان', 'أسئلة') + '</div>';
    html += '<div class="sec-stars">' + sh + '</div></div>';
    html += '<span data-style="color:var(--muted);font-size:1.3rem">›</span></div>';
  });
  $('section-list').innerHTML = html;

  if (hasTeacherFeedbacks() && STATE.role !== 'friend'){
    // show feedback banner
  }
  renderTrack();
}
function goHome(){ renderHome(); show('view-home'); }

var CURRENT = {section:null, qIdx:0, score:0, correct:0, wrong:0};

function openSection(sid){
  var sec = CURRICULUM.find(function(x){ return x.id === sid; });
  if (!sec) return;
  CURRENT.section = sec;
  renderLesson();
  show('view-lesson');
  var c = document.getElementById('lesson-content'); if (c) delete c.dataset.paged; // 9.28: بطاقات الدرس
  setTimeout(paginateLessonCards, 0);
}
function renderLessonContent(){
  var sec = CURRENT.section;
  var s = STATE.student;
  var av = $('lesson-avatar');
  if (s.photo) av.innerHTML = '<img data-media="' + mediaRef('img', s.photo) + '" alt="">';
  else av.innerHTML = '<span class="emoji">' + (s.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️') + '</span>';
  $('lesson-section-title').textContent = sec.emoji + ' ' + sec.title;

  var _tn = PACK_DATA.teacherName || PACK_DATA.supervisorName || '';
  var sub = 'بإشراف ' + (PACK_DATA.teacherGender === 'girl' ? 'المعلمة' : 'المعلم') + (_tn && _tn !== 'المعلم' ? ' ' + _tn : '');
  if (PACK_DATA.packageType === 'approved_gift' && PACK_DATA.sourceGiftStudentName) sub = 'إهداء من ' + (PACK_DATA.sourceGiftStudentGender === 'girl' ? 'زميلتك ' : 'زميلك ') + PACK_DATA.sourceGiftStudentName + ' · بإشراف ' + teacherByline();
  $('lesson-progress-label').textContent = sub;

  var html = '';
  sec.items.forEach(function(item){
    html += verseAudioCount(item) ? matnVersesHTML(item) : '<div class="content-text">' + quranHTML(item.text, item) + '</div>'; // 9.39.16 (ق4)، 9.39.17 (خط المصحف)
    if (item.desc) html += '<div class="desc-text">💡 ' + GT(item.desc) + '</div>';

    if (verseAudioCount(item)){ html += matnHeaderHTML(item); }
    else if (PACK_DATA.masterAudios && PACK_DATA.masterAudios[item.id]){
      var itemType = detectTextType({text: item.text});
      var masterPhoto = itemType === 'quran' ? PACK_DATA.sheikhPhoto : PACK_DATA.poemReciterPhoto;
      var masterGender = itemType === 'quran' ? 'boy' : 'boy';
      var masterName = itemType === 'quran' ? PACK_DATA.sheikhName : (itemType === 'poem' ? PACK_DATA.poemReciterName : '');
      var masterLabel = itemType === 'quran' ? '🎧 تلاوة الشيخ / قارئ القرآن' : (itemType === 'poem' ? '🎧 إنشاد منشد الأبيات' : '🎧 التسجيل المرجعي');
      html += audioPersonBlock(masterPhoto, masterGender, masterName, masterLabel, PACK_DATA.masterAudios[item.id], 'master-person-audio');
    } else {
      var _t0 = detectTextType({text: item.text});
      if (_t0 === 'quran' || _t0 === 'poem') html += '<div class="no-master">' + GT('🎧 لم يُضَف ' + (_t0 === 'quran' ? 'تسجيل الشيخ لهذه الآية' : 'إنشاد هذه الأبيات') + ' بعد. {اسأل|اسألي} معلمك عن القراءة الصحيحة.') + '</div>';
    }

    if (PACK_DATA.packageType === 'approved_gift') {
      html += peerAudioBlocks(item.id);
    } else {
      var rec = getStudentRec(item.id);
      if (rec) html += '<div class="student-rec-block"><b>🎧 تسجيلك:</b><audio controls data-media="' + mediaRef('aud', rec) + '"></audio></div>';
    }

    if ((STATE.role === 'student' || STATE.role === 'friend') && !STATE.studentAudios[item.id]) {
      html += '<div class="student-rec-block"><b>🎙️ تسجيلك (تدريب):</b><div class="rec-actions">';
      var lessonSafeId = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      html += '<button id="lesson-rec-btn-' + lessonSafeId + '" class="btn primary" ' + ACT('startRec', item.id) + ' type="button">🎙️ {سجّل|سجّلي}</button>';
      html += '</div><div class="rec-status" id="rec-status-' + lessonSafeId + '">—</div></div>';
    } else if ((STATE.role === 'student' || STATE.role === 'friend') && STATE.studentAudios[item.id]) {
      var st = STATE.studentAudios[item.id].status || 'pending';
      var stLabel = st === 'approved' ? '✅ معتمد' : st === 'rejected' ? '❌ مرفوض' : (STATE.studentAudios[item.id].sentAt ? '⏳ في ملف الإرسال — بانتظار المعلم' : '💾 محفوظ عندك — لم يُرسل بعد');
      html += '<div class="student-rec-block"><b>🎙️ تسجيلك — ' + stLabel + ':</b><div class="rec-actions">';
      html += '<button class="btn success" ' + ACT('playStudentRec', item.id) + ' type="button">🔊 {اسمع|اسمعي}</button>';
      if (st !== 'approved'){
        var lessonSafeId2 = String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_'); html += '<button id="lesson-rec-btn-' + lessonSafeId2 + '" class="btn gold" ' + ACT('startRec', item.id) + ' type="button">🔄 {أعد|أعيدي}</button>';
        html += '<button class="btn rec-del" ' + ACT('deleteStudentRec', item.id) + ' type="button" aria-label="حذف التسجيل" title="حذف التسجيل">🗑️</button>';
      }
      html += '</div></div>';
    }
  });
  // Quran reference recordings may belong to extraction questions rather than lesson items.
  // Expose them in the student lesson so the learner can listen, compare, record, and submit them.
  var quranRefs = (sec.questions || []).filter(function(q){ return q.textType === 'quran' || detectTextType(q) === 'quran'; });
  if (quranRefs.length){
    var quranCards = [];
    quranRefs.forEach(function(q){
      if (!PACK_DATA.masterAudios || !PACK_DATA.masterAudios[q.id]) return;
      var qid = q.id, qtext = q.text || '';
      var safeQid = String(qid).replace(/[^a-zA-Z0-9_-]/g, '_');
      var qrec = getStudentRec(qid);
      quranCards.push('<div class="content-text quran">' + quranHTML(qtext, q) + '</div>');
      quranCards.push(audioPersonBlock(PACK_DATA.sheikhPhoto, 'boy', PACK_DATA.sheikhName || '', '🎧 تلاوة الشيخ / قارئ القرآن', PACK_DATA.masterAudios[qid], 'master-person-audio'));
      if (PACK_DATA.packageType === 'approved_gift') quranCards.push(peerAudioBlocks(qid));
      else if (qrec) quranCards.push('<div class="student-rec-block"><b>🎧 تسجيلك السابق:</b><audio controls data-media="' + mediaRef('aud', qrec) + '"></audio></div>');
      var localQ = STATE.studentAudios[qid];
      if (!localQ){
        quranCards.push('<div class="student-rec-block"><b>🎙️ تسجيلك:</b><div class="rec-actions"><button id="lesson-rec-btn-' + safeQid + '" class="btn primary" ' + ACT('startRec', qid) + ' type="button">🎙️ {سجّل|سجّلي}</button></div><div class="rec-status" id="rec-status-' + safeQid + '">—</div></div>');
      } else {
        var qs = localQ.status || 'pending';
        quranCards.push('<div class="student-rec-block"><b>🎙️ تسجيلك — ' + (qs === 'approved' ? '✅ معتمد' : qs === 'rejected' ? '❌ مرفوض' : '⏳ قيد المراجعة') + ':</b><div class="rec-actions"><button class="btn success" ' + ACT('playStudentRec', qid) + ' type="button">🔊 اسمع</button>' + (qs !== 'approved' ? '<button id="lesson-rec-btn-' + safeQid + '" class="btn gold" ' + ACT('startRec', qid) + ' type="button">🔄 أعد</button>' : '') + '</div></div>');
      }
    });
    if (quranCards.length) html += '<div class="card" data-style="margin-top:18px"><h3 data-style="margin-top:0;color:var(--primary)">📿 تسجيلات القرآن المرجعية</h3><p data-style="color:var(--muted);font-size:.86rem">استمع إلى تلاوة الشيخ / قارئ القرآن، ثم {سجّل|سجّلي} تلاوتك أنت وأرسلها للمعلم.</p>' + quranCards.join('') + '</div>';
  }
  html += '<button class="btn primary block mt-20" data-call="[&quot;startQuiz&quot;]" type="button">🎯 {ابدأ|ابدئي} الاختبار (' + arCount(Math.min(sec.questions.length, LESSON_QUIZ_MAX), 'سؤال', 'سؤالان', 'أسئلة') + ')</button>'; // 9.39.13 (ق3-ب)
  html += '<button class="btn ghost block" data-style="margin-top:10px" data-call="[&quot;goHome&quot;]" type="button">🏠 رجوع</button>';
  $('lesson-content').innerHTML = html;
}
/* 9.39.5 (R08): بيان محتوى الإهداء — يُبنى عند الإصدار ويدخل في التوقيع، ويُعرض للمعلم قبل الإصدار وللمهدى إليه عند الفتح */
function curriculumTasks(masters){
  masters = masters || {};
  var out = [];
  (CURRICULUM || []).forEach(function(sec){
    if (!sec || sec._synthetic) return;
    (sec.items || []).forEach(function(it){ out.push({id: it.id, sec: sec.id, secTitle: sec.title, kind: it.type === 'quran' ? 'آية' : (it.type === 'poem' ? 'أبيات المتن' : 'نص'), label: plainText(it.text).slice(0, 70)}); });
    (sec.questions || []).forEach(function(q){ if ((q.textType === 'quran' || detectTextType(q) === 'quran') && masters[q.id]) out.push({id: q.id, sec: sec.id, secTitle: sec.title, kind: 'آية', label: plainText(q.text).slice(0, 70)}); });
  });
  return out;
}
function buildGiftContents(groups, masters){
  masters = (masters && typeof masters === 'object') ? masters : {};
  var have = {};
  (groups || []).forEach(function(g){ Object.keys((g && g.audios) || {}).forEach(function(k){ var r = g.audios[k]; if (r && r.audio && r.status === 'approved') have[k] = (have[k] || 0) + 1; }); });
  var secs = [], byId = {}, total = 0, withPeer = 0, withMaster = 0, noAudio = 0;
  curriculumTasks(masters).forEach(function(t){
    var s = byId[t.sec]; if (!s){ s = byId[t.sec] = {id: String(t.sec), title: String(t.secTitle || '').slice(0, 80), total: 0, withPeer: 0, withMaster: 0, items: []}; secs.push(s); }
    var m = !!masters[t.id], p = !!have[t.id];
    s.total++; total++;
    if (m){ s.withMaster++; withMaster++; }
    if (!m && !p) noAudio++;
    if (p){ s.withPeer++; withPeer++; s.items.push({id: String(t.id), kind: t.kind, label: t.label, peers: have[t.id], master: m}); }
  });
  return {v: 2, totalTasks: total, withPeer: withPeer, withMaster: withMaster, noAudio: noAudio, complete: total > 0 && withPeer === total, sections: secs};
}
function giftContentsText(gc){
  if (!gc || !Array.isArray(gc.sections)) return '';
  /* 9.39.6 (RT9395-02): كل جملة هنا تُشتق من الأصوات الموجودة فعلًا؛ لا وعد بتلاوة غير موجودة */
  var T = gc.totalTasks || 0, M = gc.withMaster || 0, P = gc.withPeer || 0, N = gc.noAudio || 0;
  var masterLine = !T ? '' : (M === T ? '📿 تلاوة الشيخ موجودة في كل المهام (' + T + ').' : (M ? '📿 تلاوة الشيخ موجودة في ' + M + ' من ' + T + ' مهمة فقط.' : '⚠️ لا توجد تلاوة مرجعية للشيخ في هذا الإهداء.'));
  var lines = ['📚 ما ستتعلمه: المنهج كاملًا (' + gc.sections.length + ' درسًا) بالشرح والأبيات والاختبارات.', masterLine,
    '🎧 تسجيلات زميل معتمدة من المعلم في ' + P + ' من ' + T + ' مهمة' + (gc.complete ? ' (كل المهام).' : '.')];
  if (N) lines.push('🔇 ' + N + ' مهمة بلا أي صوت مرجعي (لا تلاوة شيخ ولا تسجيل زميل): تعتمد فيها على الشرح والنص.');
  lines.push('');
  gc.sections.forEach(function(s){
    var parts = [];
    if (s.withPeer) parts.push('تسجيل زميل في ' + s.withPeer + ' من ' + s.total);
    if (typeof s.withMaster === 'number') parts.push(s.withMaster === s.total ? 'تلاوة الشيخ في كلها' : (s.withMaster ? 'تلاوة الشيخ في ' + s.withMaster + ' من ' + s.total : 'بلا تلاوة شيخ'));
    lines.push((s.withPeer ? '✅ ' : '○ ') + s.title + (parts.length ? ' — ' + parts.join('، ') : ''));
    (s.items || []).forEach(function(it){ lines.push('    • ' + it.kind + (it.label ? ': ' + it.label : '') + (it.master === false ? ' (زميل فقط، بلا تلاوة شيخ)' : '')); });
  });
  return lines.join('\n');
}
function trustedPeerGroups(){ return peerAudiosAllowed() ? normalizePeerGroups().filter(peerGroupVerified) : []; } // 9.39.11 (ق1-ب)
function hiddenPeerGroupCount(){ return peerAudiosAllowed() ? normalizePeerGroups().filter(function(g){ return !peerGroupVerified(g); }).length : 0; }
function displayedGiftContents(){ return buildGiftContents(trustedPeerGroups(), PACK_DATA.masterAudios); }
function giftContentsDisplayText(){
  var txt = giftContentsText(displayedGiftContents());
  if (!PACK_DATA.giftContents) txt += '\n\nℹ️ هذا الإهداء صادر بإصدار سابق، فهذا الوصف محسوب من محتوى الملف.';
  if (!peerAudiosAllowed()) txt += '\n\n⚠️ الاعتماد غير موثّق، فلا تُعرض تسجيلات الزملاء ولا تُحسب في هذا الوصف.';
  else if (hiddenPeerGroupCount()) txt += '\n\n⚠️ لم تُعرض تسجيلات ' + hiddenPeerGroupCount() + ' من الزملاء لأنها لا تحمل اعتماد معلم مسجَّل.';
  if (REF_HIDDEN) txt += '\n\n⚠️ تلاوات الشيخ في هذا الملف غير موقّعة من مشرف مسجَّل، فأُخفيت.';
  return txt;
}
function renderGiftContentsBox(b){
  var txt = giftContentsDisplayText(), parts = txt.split('\n\n');
  var head = parts.shift() || '', rest = parts.join('\n\n');
  b.textContent = '';
  var h = document.createElement('div'); h.textContent = head; b.appendChild(h);
  if (rest){
    var d = document.createElement('details'); d.className = 'gift-details';
    var s = document.createElement('summary'); s.textContent = '📋 تفاصيل الدروس'; d.appendChild(s);
    var body = document.createElement('div'); body.textContent = rest; d.appendChild(body); b.appendChild(d);
  }
}
function refreshGiftContentsBox(){ var b = document.getElementById('gift-contents-box'); if (b) renderGiftContentsBox(b); }
function showGiftContents(){
  var txt = giftContentsDisplayText(); // التنبيه صار داخل giftContentsDisplayText
  showModal('🎁 ماذا في هذا الإهداء؟', txt, [{label: 'حسنًا', class: 'primary', action: closeModal}]);
}
function normalizePeerGroups(){
  var groups = Array.isArray(PACK_DATA.approvedPeerRecordings) ? PACK_DATA.approvedPeerRecordings : [];
  if (!groups.length && PACK_DATA.approvedStudentAudios && Object.keys(PACK_DATA.approvedStudentAudios).length){
    groups = [{id: PACK_DATA.sourceGiftPackageId || PACK_DATA.packageId || 'giver', name: PACK_DATA.sourceGiftStudentName || PACK_DATA.studentName || '', gender: PACK_DATA.sourceGiftStudentGender || 'boy', photo: PACK_DATA.sourceGiftStudentPhoto || null, audios: PACK_DATA.approvedStudentAudios}];
  }
  return groups;
}
function peerAudiosAllowed(){
  /* 9.39.3 (RT9392-02): أصوات الأطفال الآخرين تُعرض فقط بعد التحقق من اعتماد معلم موثوق لمحتوى الملف كله */
  if (PACK_DATA.packageType === 'approved_gift' || PACK_DATA.approved === true) return GIFT_TRUST === 'verified';
  if (PACK_DATA.packageType === 'student_returned') return RETURN_TRUST === 'verified';
  return true;
}
function peerAudioBlocks(itemId){
  if (!peerAudiosAllowed()) return '';
  var groups = trustedPeerGroups(), out = [];
  groups.forEach(function(g){
    var r = g.audios && g.audios[itemId];
    if (r && r.audio && r.status === 'approved') out.push(audioPersonBlock(g.photo, g.gender || 'boy', g.name || '', '🎧 تسجيل ' + genderWord(g.gender || 'boy','زميلك','زميلتك'), r.audio, 'giver-person-audio'));
  });
  return out.join('');
}
function getStudentRec(itemId){
  if (STATE.role === 'teacher'){
    var r2 = PACK_DATA.studentAudios && PACK_DATA.studentAudios[itemId];
    if (r2) return r2.audio;
  }
  return null;
}

var activeRec = null, activeId = null, chunks = [];
function updateRecordingUI(itemId, state){
  var safeId = String(itemId).replace(/[^a-zA-Z0-9_-]/g, '_');
  var buttons = document.querySelectorAll('#re-record-btn-' + safeId + ', #rec-btn-' + safeId + ', #lesson-rec-btn-' + safeId);
  var recording = state === true || state === 'recording';
  var starting = state === 'starting';
  var saving = state === 'saving';
  buttons.forEach(function(btn){
    btn.disabled = false;
    btn.classList.remove('gold','ghost','primary','danger');
    if (recording){
      btn.textContent = '⏹️ إيقاف التسجيل';
      btn.classList.add('danger');
      btn.setAttribute('aria-pressed','true');
    } else if (starting){
      btn.textContent = '⏳ تهيئة التسجيل...';
      btn.classList.add('danger');
      btn.disabled = true;
      btn.setAttribute('aria-pressed','true');
    } else if (saving){
      btn.textContent = '💾 جارٍ حفظ التسجيل...';
      btn.classList.add('gold');
      btn.disabled = true;
      btn.setAttribute('aria-pressed','true');
    } else {
      btn.textContent = '🎙️ {أعد|أعيدي} التسجيل الآن';
      btn.classList.add('gold');
      btn.setAttribute('aria-pressed','false');
    }
  });
  var st=document.querySelector('#rec-status-' + safeId);
  if(st){
    if (recording){ st.textContent=GT('🔴 جارٍ التسجيل... {اضغط|اضغطي} الزر نفسه للإيقاف'); st.className='rec-status recording'; }
    else if (starting){ st.textContent='🎙️ جارٍ تشغيل الميكروفون...'; st.className='rec-status recording'; }
    else if (saving){ st.textContent='💾 جارٍ حفظ التسجيل...'; st.className='rec-status'; }
    else { st.textContent='جاهز لإعادة التسجيل'; st.className='rec-status'; }
  }
}

