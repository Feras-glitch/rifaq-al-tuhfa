/* ===== الحالة والتخزين: ملفات الطلاب وlocalStorage وIndexedDB ===== */
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

/* 9.39.4 (RT9393-01): استئناف كل حذف معلّق عند الإقلاع (لا عند فتح القاعدة فقط)، ومنع هذه النافذة من استعادة طفل محذوف */
function resumePendingDeletions(){
  var tombs = readTombs(); if (!tombs.length) return;
  var mine = tombFor(DB_NAME, STORAGE_KEY);
  if (mine) CHILD_DATA_DELETED = true;
  tombs.forEach(function(t){
    try { if (t.s) localStorage.removeItem(t.s); } catch(e){}
    deleteDbFully(t.d, t.s).then(function(){ if (mine && (t.d === DB_NAME || t.s === STORAGE_KEY)){ alert('اكتمل حذف بيانات هذا الطالب من هذا الجهاز. سيُعاد فتح التطبيق.'); location.reload(); } }, function(e){ console.warn('pending delete failed', e); });
  });
  if (mine) setTimeout(function(){ if (tombFor(DB_NAME, STORAGE_KEY)) { try { showModal('⏳ حذف بيانات الطالب لم يكتمل', 'التطبيق مفتوح في نافذة أو تبويب آخر يمنع الحذف. أغلق النوافذ الأخرى؛ سيكتمل الحذف تلقائيًا. لن يُحفظ شيء لهذا الطالب حتى يكتمل.', [{label: 'حسنًا', class: 'primary', action: closeModal}]); } catch(e){} } }, 1200);
}
function realSections(){ return CURRICULUM.filter(function(s){ return !s._synthetic; }); }
function recalcStats(){
  var tP = 0, comp = 0, perf = 0, att = 0;
  realSections().forEach(function(s){ /* 9.39.10: الاختبار والمراجعة ليسا أقسامًا من المنهج */
    var pr = STATE.progress[s.id];
    if (pr){
      tP += pr.bestScore || 0;
      if (pr.stars > 0) comp++;
      if (pr.stars === 3) perf++;
      att += pr.attempts || 0;
    }
  });
  STATE.stats = {totalPoints: tP, completedSections: comp, perfectSections: perf, totalAttempts: att};
}
