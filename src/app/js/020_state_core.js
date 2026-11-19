
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
/* 9.39.15 (ق6): الحكم المحوري لكل مهمة تسجيل ومعايير تقييمه (مسودة لاعتماد الشيخ)، من curriculum/rating_criteria_9.39.15.json */
var RATING_CRITERIA = {"rules":{"idhhar":{"label":"الإظهار","listen":"النون الساكنة أو التنوين قبل حرف الحلق.","mastered":"النون تُنطق من طرف اللسان واضحة، بلا إطالة غنة ولا سكت، ثم حرف الحلق مباشرة.","good":"النون واضحة مع غنة يسيرة أو تردد قصير.","needs":"غنة ممدودة كأنه إخفاء، أو إدغام النون في حرف الحلق، أو حذفها، أو تحريكها."},"idgham_n":{"label":"الإدغام بلا غنة","listen":"النون الساكنة أو التنوين قبل اللام أو الراء.","mastered":"تُدغم النون فتُسمع لام أو راء مشددة، بلا أثر للنون ولا غنة.","good":"الإدغام صحيح مع أثر غنة خفيف.","needs":"إظهار النون، أو غنة واضحة، أو لام أو راء بلا تشديد."},"idgham_g":{"label":"الإدغام بغنة","listen":"النون الساكنة أو التنوين قبل الياء أو النون أو الميم أو الواو.","mastered":"تُدغم النون في الحرف التالي مع غنة بمقدار حركتين.","good":"الإدغام صحيح والغنة أقصر أو أطول قليلًا.","needs":"إظهار النون، أو إدغام بلا غنة."},"iqlab":{"label":"الإقلاب","listen":"النون الساكنة أو التنوين قبل الباء.","mastered":"تُقلب النون ميمًا مخفاة بغنة بمقدار حركتين، والشفتان منطبقتان بلا ضغط.","good":"القلب صحيح والغنة ناقصة قليلًا.","needs":"نون صريحة بلا قلب، أو إطباق بقوة مع ميم ظاهرة، أو غنة أقل من حركتين."},"ikhfa":{"label":"الإخفاء","listen":"النون الساكنة أو التنوين قبل أحد حروف الإخفاء الخمسة عشر.","mastered":"النون بين الإظهار والإدغام، بغنة بمقدار حركتين، واللسان يتهيأ لمخرج الحرف التالي.","good":"الإخفاء صحيح والغنة أقصر أو أطول قليلًا.","needs":"نون ظاهرة صريحة من طرف اللسان، أو إدغامها في الحرف التالي، أو حذف الغنة."},"ghunna":{"label":"الغنة في النون والميم المشددتين","listen":"النون أو الميم المشددة.","mastered":"غنة كاملة بمقدار حركتين في كل موضع.","good":"غنة أقصر قليلًا في موضع.","needs":"لا غنة، أو تشديد بلا غنة، أو إطالة مفرطة."},"ikhfa_sh":{"label":"الإخفاء الشفوي","listen":"الميم الساكنة قبل الباء.","mastered":"تُخفى الميم بغنة بمقدار حركتين، على الوجه الذي يعتمده الشيخ في الشفتين (إطباق خفيف أو فرجة يسيرة).","good":"الإخفاء صحيح والغنة ناقصة قليلًا.","needs":"ميم ظاهرة صريحة بلا غنة، أو ضغط الشفتين بقوة."},"idhhar_sh":{"label":"الإظهار الشفوي","listen":"الميم الساكنة قبل غير الباء والميم.","mastered":"الميم ساكنة واضحة من الشفتين، بلا غنة زائدة ولا سكت.","good":"واضحة مع غنة يسيرة.","needs":"إخفاء الميم، أو تحريكها، أو حذفها."},"lam_q":{"label":"اللام القمرية","listen":"لام «ال» قبل حرف قمري.","mastered":"اللام ساكنة واضحة، ثم الحرف التالي.","good":"واضحة مع تردد يسير.","needs":"إدغام اللام في الحرف التالي، أو تحريكها."},"lam_sh":{"label":"اللام الشمسية","listen":"لام «ال» قبل حرف شمسي.","mastered":"اللام لا تُنطق، والحرف بعدها مشدد.","good":"التشديد خفيف قليلًا.","needs":"نطق اللام، أو حرف بلا تشديد."},"lam_fil":{"label":"لام الفعل","listen":"اللام الساكنة في الفعل قبل غير اللام والراء.","mastered":"اللام ساكنة واضحة قبل الحرف التالي.","good":"واضحة مع تردد يسير.","needs":"إدغام اللام في الحرف التالي، أو تحريكها."},"mithl":{"label":"إدغام المثلين الصغير","listen":"الميم الساكنة قبل الميم.","mastered":"تُدغم الميم الأولى في الثانية فتُسمع ميم مشددة بغنة بمقدار حركتين.","good":"الإدغام صحيح والغنة أقصر قليلًا.","needs":"إظهار الميم الأولى، أو إدغام بلا غنة."},"badal":{"label":"مد البدل","listen":"حرف المد بعد همز.","mastered":"مد بمقدار حركتين.","good":"زيادة أو نقص يسير.","needs":"قصر شديد، أو مد أربع حركات فأكثر."},"iwad":{"label":"مد العوض","listen":"الوقف على تنوين النصب.","mastered":"يُبدل التنوين ألفًا تُمد حركتين عند الوقف.","good":"الألف أقصر أو أطول قليلًا.","needs":"الوقف بالتنوين، أو بالسكون بلا ألف."},"muttasil":{"label":"المد المتصل","listen":"حرف المد بعده همز في الكلمة نفسها.","mastered":"مد بمقدار أربع أو خمس حركات.","good":"المقدار قريب (ثلاث أو ست).","needs":"قصر إلى حركتين، أو مد مفرط."},"munfasil":{"label":"المد المنفصل","listen":"حرف المد في آخر كلمة والهمز في أول التالية.","mastered":"مد بمقدار أربع أو خمس حركات، مساويًا لما مُدّ به المتصل.","good":"المقدار صحيح مع اختلاف يسير عن المتصل.","needs":"قصر إلى حركتين، أو مد مفرط."},"leen":{"label":"مد اللين","listen":"الواو أو الياء الساكنة بعد فتح عند الوقف.","mastered":"الوقف بالسكون، والمد حركتان أو أربع أو ست، بمقدار ثابت.","good":"المقدار يتغير قليلًا بين الموضعين.","needs":"الوقف بالحركة، أو مد مفرط، أو تحويل اللين إلى مد بحرف آخر."},"sila_s":{"label":"الصلة الصغرى","listen":"هاء الضمير بين متحركين وليس بعدها همز.","mastered":"تُوصل الهاء بواو أو ياء بمقدار حركتين في الوصل.","good":"الصلة أقصر أو أطول قليلًا.","needs":"حذف الصلة، أو مدها أربع حركات فأكثر."},"sila_k":{"label":"الصلة الكبرى","listen":"هاء الضمير بين متحركين وبعدها همزة قطع.","mastered":"تُوصل الهاء بمد بمقدار أربع أو خمس حركات، كالمنفصل.","good":"المقدار قريب.","needs":"مدها حركتين فقط، أو حذف الصلة."},"lazim_k":{"label":"المد اللازم الكلمي المثقل","listen":"حرف المد بعده حرف مشدد في الكلمة نفسها.","mastered":"مد بمقدار ست حركات، ثم الحرف المشدد.","good":"المقدار قريب من ست.","needs":"مد أقل من أربع، أو فك التشديد."},"lazim_h":{"label":"المد اللازم الحرفي","listen":"أسماء حروف فواتح السور التي هجاؤها ثلاثة أحرف أوسطها حرف مد.","mastered":"مد بمقدار ست حركات في كل حرف من هذه الحروف، مع نطق أسماء الحروف كاملة.","good":"المقدار قريب من ست في حرف أو أكثر.","needs":"قصر الحرف، أو قراءته كلمة لا أسماء حروف."}},"tasks":{"r2_1":"idhhar","r3_1":"idgham_n","r3_2":"idgham_g","r4_1":"iqlab","r5_1":"ikhfa","r5_2":"ikhfa","r6_1":"ghunna","r6_2":"ghunna","r7_1":"ikhfa_sh","r7_2":"idhhar_sh","r8_1":"lam_q","r8_2":"lam_sh","rec_lamfil_1":"lam_fil","rm_1":"mithl","r9_1":"badal","r9_2":"iwad","r10_1":"muttasil","r10_2":"munfasil","r11_1":"leen","r11_2":"sila_s","r11_3":"sila_k","rec_lin_1":"leen","r12_1":"lazim_k","rf_1":"lazim_h","rf_2":"lazim_h","rf_3":"lazim_h"},"other":{"idhhar":"الإظهار","idgham":"الإدغام","iqlab":"الإقلاب","ikhfa":"الإخفاء","ghunna":"الغنة","meem":"الميم الساكنة","lam":"اللام","madd":"المد","makhraj":"مخرج حرف","waqf":"الوقف والابتداء"}};
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
var REF_TRUST = null;  // verified | builtin | unconfigured | untrusted | invalid | unsigned
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

