
/* 9.39.2: مفتاح "__proto__" في النص الحرفي لـ PACK_DATA يصنع نموذجًا أوليًا خفيًا: لا تراه Object.keys
   (التي يستعملها التعقيم وبيان التوقيع) بينما يراه البحث المباشر، فيُعرض تسجيل غير موقَّع داخل إهداء «موثّق».
   نعيد بناء كل كائن من خصائصه الذاتية قبل أي استعمال، ونعلّم الملف معدَّلًا إن وُجد ذلك. */
var PACK_PROTO_TAMPERED = false;
PACK_DATA = (function deproto(v, depth){
  if (v === null || typeof v !== 'object') return v;
  if (depth > 40) { PACK_PROTO_TAMPERED = true; return null; }
  if (Array.isArray(v)){
    if (Object.getPrototypeOf(v) !== Array.prototype) PACK_PROTO_TAMPERED = true;
    var a = []; for (var i = 0; i < v.length; i++) a.push(deproto(v[i], depth + 1)); return a;
  }
  if (Object.getPrototypeOf(v) !== Object.prototype) PACK_PROTO_TAMPERED = true;
  var o = {};
  Object.keys(v).forEach(function(k){ if (k !== '__proto__') o[k] = deproto(v[k], depth + 1); });
  return o;
})(PACK_DATA, 0);
/* 9.39.2: مرساة الثقة. تحقنها الصفحة المضيفة من إعداد التطبيق المثبَّت (web/trusted-teachers.json).
   null = ملف مستقل خارج التطبيق: الثقة من قائمة الملف نفسه (ذاتية، قيد معلن). */
var PINNED_TEACHER_KEYS = null; /* RIFAQ_PINNED_KEYS */
/* 9.39.11 (ق1-ب): مرساة المشرف — {keys: مفاتيح المشرفين، refDigests: بصمات المادة المرجعية المدمجة في الإصدار نفسه}.
   null = ملف مستقل خارج التطبيق: لا مرساة، فتُعرض المادة كما هي (قيد معلن). */
var PINNED_SUPERVISOR = null; /* RIFAQ_PINNED_SUPERVISOR */
var BUILTIN_CURRICULUM = null; /* RIFAQ_BUILTIN_CURRICULUM */
var RIFAQ_CHANNEL = 'main'; /* RIFAQ_CHANNEL */
/* 9.39.15 (ق6): الحكم المحوري لكل مهمة تسجيل ومعايير تقييمه (مسودة لاعتماد الشيخ)، من curriculum/rating_criteria.json */
var RATING_CRITERIA = @@RATING_CRITERIA@@;
/* 9.39.14 (D8): 'beta' في نسخة /beta/ فقط (يكتبها tools/build_web.py --channel beta). */
/* 9.39.13 (D6): تحقنه الصفحة المضيفة (منهج الإصدار نفسه) حين يختلف منهج الملف عنه وفي التطبيق مشرف مسجَّل */
/* 9.39.3 (RT9392-01): داخل الصفحة المضيفة تأتي الثقة منها وحدها؛ إن غابت المرساة فلا ثقة إطلاقًا (لا رجوع إلى قائمة الملف) */
function runningInHost(){ try { return window.parent !== window && !!window.parent.RIFAQ_HOST; } catch(e){ return false; } }
function trustedKeysFor(pack){
  if (Array.isArray(PINNED_TEACHER_KEYS)) return PINNED_TEACHER_KEYS;
  if (runningInHost()) return [];
  return Array.isArray(pack && pack.trustedTeacherKeys) ? pack.trustedTeacherKeys : [];
}
/* 9.39.3 (RT9392-02): التوقيع v4 يغطي محتوى الحزمة كله (كل ما قد يُعرض)، محسوبًا على البيانات كما وصلت قبل أي تطبيع */
function canonJSON(v, skipTopKey){
  function c(x, top){
    if (x === null || typeof x !== 'object'){ var s = JSON.stringify(x); return s === undefined ? undefined : s; }
    if (Array.isArray(x)) return '[' + x.map(function(e){ var s = c(e, false); return s === undefined ? 'null' : s; }).join(',') + ']';
    var ks = Object.keys(x).sort(), out = [];
    for (var i = 0; i < ks.length; i++){ if (top && ks[i] === skipTopKey) continue; var s = c(x[ks[i]], false); if (s !== undefined) out.push(JSON.stringify(ks[i]) + ':' + s); }
    return '{' + out.join(',') + '}';
  }
  return c(v, true);
}
var PACK_CANON_DIGEST = (function(){ try { return sha256b64(canonJSON(PACK_DATA, 'signature')).catch(function(){ return null; }); } catch(e){ return Promise.resolve(null); } })();
/* 9.39.11 (ق1-ب، RT9399-01): المادة المرجعية = ما يعدّه المشرف في الاستوديو (المنهج، تلاوات الشيخ، أسماء المرجع وصوره، الترحيب).
   تُلتقط هنا كما وصلت قبل أي تطبيع، فتُحسب بصمتها وتُصدَّر كما هي، فلا تتغير البصمة عبر الطالب ← المعلم ← المهدى إليه،
   ولا يدخلها ما يضيفه التطبيق أثناء العمل (مثل أقسام الاختبار النهائي). */
var REF_KEYS = ['curriculum','masterAudios','sheikhName','sheikhPhoto','sheikhGender','supervisorName','supervisorPhoto','supervisorGender','poemReciterName','poemReciterPhoto','schoolName','schoolLogo','welcomeAudioNeutral','welcomeAudioMale','welcomeAudioFemale','journeyTitle','projectTitle','trackTitle','seriesTitle'];
function refFieldsOf(p){ var o = {}; REF_KEYS.forEach(function(k){ if (p && Object.prototype.hasOwnProperty.call(p, k) && p[k] !== undefined) o[k] = p[k]; }); return o; }
function structCopy(v){ if (v === null || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(structCopy); var o = {}; Object.keys(v).forEach(function(k){ o[k] = structCopy(v[k]); }); return o; }
function cleanCertObj(c, verKey){
  if (!c || typeof c !== 'object' || !c.key || typeof c.key !== 'object') return null;
  var o = {alg: 'ECDSA-P256-SHA256', key: {kty: 'EC', crv: 'P-256', x: String(c.key.x || '').slice(0, 100), y: String(c.key.y || '').slice(0, 100)}, sig: String(c.sig || '').slice(0, 200), signedAt: String(c.signedAt || '').slice(0, 40)};
  o[verKey || 'v'] = Number(c[verKey || 'v']) || 0;
  return o;
}
var REF_RAW = structCopy(refFieldsOf(PACK_DATA));
var REF_CERT_RAW = cleanCertObj(PACK_DATA.refCert);
var REF_CANON_DIGEST = (function(){ try { return sha256b64(canonJSON(REF_RAW)).catch(function(){ return null; }); } catch(e){ return Promise.resolve(null); } })();
var REF_SIG = null;    // valid | invalid | unsigned — صحة توقيع المادة المرجعية بالمفتاح المرفق
var REF_TRUST = null;  // verified | builtin | unconfigured | untrusted | invalid | unsigned | unavailable
var REF_HIDDEN = false; // صحيح = أُخفيت تلاوات الشيخ وهويات المرجع لأنها غير موثّقة في تطبيق فيه مشرفون مسجَّلون

// Runtime sanity check: exported files must retain the application constants.
if (typeof APP_VERSION === 'undefined') { throw new Error('APP_VERSION bootstrap missing'); }

// Compatibility is intentionally non-blocking: older student packages are migrated
// in memory so a package created by 8.x/9.x can still be reviewed and re-exported.
(function normalizePackCompatibility(){
  try {
    PACK_SOURCE_VERSION = String(PACK_DATA.appVersion || 'legacy');
    if (!PACK_DATA.schemaVersion) PACK_DATA.schemaVersion = 1;
    if (!PACK_DATA.packageType) PACK_DATA.packageType = 'student_fresh';
    PACK_COMPATIBLE = true;
    // Legacy compatibility: older packages may still carry the duplicate Quran-reciter fields.
    // The canonical identity is always Sheikh / Quran Reciter.
    if (!PACK_DATA.sheikhName && PACK_DATA.quranReciterName) PACK_DATA.sheikhName = PACK_DATA.quranReciterName;
    if (!PACK_DATA.sheikhPhoto && PACK_DATA.quranReciterPhoto) PACK_DATA.sheikhPhoto = PACK_DATA.quranReciterPhoto;
    PACK_DATA.appVersion = APP_VERSION;
    PACK_DATA.schemaVersion = SCHEMA_VERSION;
    // Approved gift recordings belong to the giver as an educational reference,
    // never to the recipient's own studentAudios namespace.
    if (PACK_DATA.packageType === 'approved_gift') {
      if (!PACK_DATA.approvedStudentAudios && PACK_DATA.studentAudios) PACK_DATA.approvedStudentAudios = PACK_DATA.studentAudios;
      PACK_DATA.approvedStudentAudios = PACK_DATA.approvedStudentAudios || {};
      PACK_DATA.studentAudios = {};
    }
  } catch(e) {
    PACK_COMPATIBLE = false;
    console.warn('pack compatibility normalization failed', e);
  }
})();

