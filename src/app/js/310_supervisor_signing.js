/* ===== 9.39.11 (ق1-ب): توقيع المشرف للمادة المرجعية + شهادة معلم لكل مجموعة تسجيلات زملاء =====
   RT9399-01: توقيع المعلم على الإهداء كان يغطي ما حُقن في ملف إرسال غير موقّع (تلاوات شيخ، اسم شيخ، تسجيلات «زملاء»)،
   فيصل إلى المهدى إليه «موثّقًا». الآن لا يستمد شيء من ذلك ثقته من توقيع المعلم على الإهداء:
   - المادة المرجعية تُقبل بتوقيع مشرف مسجَّل في التطبيق المثبَّت، أو ببصمة المادة المدمجة في الإصدار نفسه؛
   - كل مجموعة تسجيلات زملاء تحمل شهادة من المعلم الذي اعتمدها، ويتحقق منها كل من يستقبلها بنفسه. */
function supervisorKeys(){ return (PINNED_SUPERVISOR && Array.isArray(PINNED_SUPERVISOR.keys)) ? PINNED_SUPERVISOR.keys : []; }
async function ecdsaVerify(jwk, sigB64, text){
  var key = await crypto.subtle.importKey('jwk', {kty: 'EC', crv: 'P-256', x: String(jwk.x), y: String(jwk.y), ext: true}, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
  return crypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, key, bytesFromB64(String(sigB64)), new TextEncoder().encode(text));
}
async function computeRefTrust(){
  if (PACK_PROTO_TAMPERED){ REF_SIG = 'invalid'; return 'invalid'; }
  var d = await REF_CANON_DIGEST;
  var c = REF_CERT_RAW;
  if (!c || !c.key.x || !c.sig) REF_SIG = 'unsigned';
  else { try { REF_SIG = (d && c.v === 1 && await ecdsaVerify(c.key, c.sig, JSON.stringify({v: 1, ref: d}))) ? 'valid' : 'invalid'; } catch(e){ REF_SIG = 'invalid'; } }
  var pins = (PINNED_SUPERVISOR && Array.isArray(PINNED_SUPERVISOR.refDigests)) ? PINNED_SUPERVISOR.refDigests : [];
  if (d && pins.indexOf(d) >= 0) return 'builtin';
  var keys = supervisorKeys();
  if (REF_SIG === 'valid' && keys.some(function(k){ return k && jwkThumb(k) === jwkThumb(c.key); })) return 'verified';
  if (!keys.length) return 'unconfigured';
  return REF_SIG === 'valid' ? 'untrusted' : REF_SIG;
}
/* تُخفى تلاوات الشيخ وصور المرجع وأسماؤه إن لم تُوثَّق المادة في تطبيق سُجّل فيه مشرف. المنهج يبقى (معقَّمًا) مع تنبيه ظاهر. */
function applyRefPolicy(){
  REF_HIDDEN = supervisorKeys().length > 0 && REF_TRUST !== 'verified' && REF_TRUST !== 'builtin';
  if (!REF_HIDDEN) return;
  /* 9.39.13 (D6): منهج غير موثّق قد يعلّم حكمًا خاطئًا، والتنبيه لا يقرؤه طفل. فيُعرض المنهج المعتمد المدمج في الإصدار بدله
     (المصفوفة نفسها تُفرَّغ وتُملأ، فكل مرجع إليها يرى البديل). تسجيلات الطفل وتقدّمه تبقى كما هي. */
  if (Array.isArray(BUILTIN_CURRICULUM) && BUILTIN_CURRICULUM.length && Array.isArray(CURRICULUM)){
    var keepSyn = CURRICULUM.filter(function(s){ return s && s._synthetic; });
    CURRICULUM.length = 0;
    BUILTIN_CURRICULUM.forEach(function(s){ if (s && typeof s === 'object' && typeof s.id === 'string') CURRICULUM.push(s); });
    keepSyn.forEach(function(s){ CURRICULUM.push(s); });
    REF_CURRICULUM_REPLACED = true;
  }
  PACK_DATA.masterAudios = {};
  ['welcomeAudioNeutral','welcomeAudioMale','welcomeAudioFemale','sheikhPhoto','supervisorPhoto','poemReciterPhoto','schoolLogo'].forEach(function(k){ PACK_DATA[k] = null; });
  PACK_DATA.sheikhName = 'الشيخ'; PACK_DATA.supervisorName = ''; PACK_DATA.poemReciterName = ''; PACK_DATA.schoolName = '';
}
var REF_CURRICULUM_REPLACED = false;
/* 9.39.14 (D5): المحتوى الذي لم يراجعه الشيخ لا يظهر على الموقع الرئيسي */
var CONTENT_HIDDEN = 0;
function contentChannelFilter(secs){
  if (RIFAQ_CHANNEL === 'beta' || !Array.isArray(secs)) return 0;
  var n = 0;
  var fix = function(list){ return (Array.isArray(list) ? list : []).map(function(q){
    if (!q || q.review !== 'pending') return q;
    n++;
    if (q.prev && typeof q.prev.text === 'string'){ var r = Object.assign({}, q, {text: q.prev.text}); if (typeof q.prev.question === 'string') r.question = q.prev.question; if (typeof q.prev.source === 'string') r.source = q.prev.source; if (q.prev.qpc) r.qpc = q.prev.qpc; else delete r.qpc; delete r.prev; delete r.review; return r; }
    return null;
  }).filter(Boolean); };
  secs.forEach(function(s){
    if (!s || typeof s !== 'object' || s._synthetic) return;
    s.questions = fix(s.questions);
    if (Array.isArray(s.examQuestions)) s.examQuestions = fix(s.examQuestions);
  });
  return n;
}
function applyContentChannel(){ CONTENT_HIDDEN = contentChannelFilter(CURRICULUM); hideUnrecordedListening(CURRICULUM); }
/* 9.40: سؤال «اسمع وميّز» لا يظهر حتى تُسجَّل قراءتاه (الصحيحة والخاطئة عمدًا) في الاستوديو */
function listeningRecorded(q){ var A = PACK_DATA.masterAudios || {}; return !!(audSrc(A[q.id + '__ok']) && audSrc(A[q.id + '__lahn'])); }
function hideUnrecordedListening(secs){
  var n = 0;
  (secs || []).forEach(function(s){ if (!Array.isArray(s.questions)) return; s.questions = s.questions.filter(function(q){ var keep = !(q && q.type === 'listen') || listeningRecorded(q); if (!keep) n++; return keep; }); });
  return n;
}
function refStatusLine(){
  if (REF_HIDDEN && REF_CURRICULUM_REPLACED) return {ok: false, text: '⚠️ هذا الملف لا يحمل توقيع مشرف مسجَّل في هذا التطبيق، فعُرض المنهج المعتمد المدمج في التطبيق بدل منهجه، وأُخفيت تلاوات الشيخ وأسماء المرجع. تسجيلاتك وتقدّمك محفوظة.'};
  if (REF_HIDDEN) return {ok: false, text: '⚠️ المادة المرجعية في هذا الملف (المنهج وتلاوات الشيخ وأسماء المرجع) لا تحمل توقيع مشرف مسجَّل في هذا التطبيق' + (REF_TRUST === 'invalid' ? '، وقد تغيّرت بعد توقيعها' : '') + '. أُخفيت التلاوات والأسماء والصور، ولن تنتقل في أي ملف يُصدر منه.'};
  if (REF_TRUST === 'verified') return {ok: true, text: '✅ المادة المرجعية موقّعة من مشرف مسجَّل في هذا التطبيق.'};
  if (REF_TRUST === 'builtin') return {ok: true, text: '✅ المادة المرجعية هي المادة المدمجة في هذا الإصدار.'};
  return null; // لا مشرفين مسجَّلين: لا مرساة يُقارن بها (يُعرض كما كان)
}
/* هل تُصدَّر المادة المرجعية كما وصلت (مع شهادتها)؟ نعم إن كانت موثّقة، أو صحيحة التوقيع في تطبيق بلا مشرفين مسجَّلين. */
function refExportRaw(){ return REF_TRUST === 'verified' || REF_TRUST === 'builtin' || (REF_TRUST === 'unconfigured' && REF_SIG === 'valid'); }
function applyRefExport(pack){
  if (refExportRaw()){
    REF_KEYS.forEach(function(k){ if (Object.prototype.hasOwnProperty.call(REF_RAW, k)) pack[k] = REF_RAW[k]; else delete pack[k]; });
    pack.refCert = REF_CERT_RAW;
  } else {
    pack.refCert = null;
    if (Array.isArray(pack.curriculum)) pack.curriculum = pack.curriculum.filter(function(s){ return s && !s._synthetic; });
  }
  return pack;
}
/* شهادة مجموعة تسجيلات زميل: هويته المعروضة وكل تسجيل بحالته وبصمة صوته */
async function peerGroupPayload(g){
  var keys = Object.keys((g && g.audios) || {}).sort(), au = [];
  for (var i = 0; i < keys.length; i++){ var r = g.audios[keys[i]] || {}; au.push([keys[i], String(r.status || ''), await sha256b64(String(r.audio || ''))]); }
  return JSON.stringify({v: 1, id: String(g.id || ''), name: String(g.name || ''), gender: g.gender === 'girl' ? 'girl' : 'boy', sh: g.shareable === true, ph: await sha256b64(String(g.photo || '')), audios: au});
}
async function signPeerGroup(g){
  var k = await getTeacherSigningKey();
  var sig = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, k.privateKey, new TextEncoder().encode(await peerGroupPayload(g)));
  return {alg: 'ECDSA-P256-SHA256', v: 1, key: k.publicJwk, sig: b64FromBytes(new Uint8Array(sig)), signedAt: new Date().toISOString()};
}
async function verifyPeerGroup(g){
  if (PACK_PROTO_TAMPERED) return 'invalid';
  var c = g && g.cert;
  if (!c || !c.key || !c.key.x || !c.sig) return 'unsigned';
  var th = jwkThumb(c.key);
  if (!trustedKeysFor(PACK_DATA).some(function(t){ return t && jwkThumb(t) === th; })) return 'untrusted';
  if (c.v !== 1) return 'invalid';
  try { return (await ecdsaVerify(c.key, c.sig, await peerGroupPayload(g))) ? 'verified' : 'invalid'; } catch(e){ return 'invalid'; }
}
var PEER_TRUST = (typeof WeakMap === 'function') ? new WeakMap() : null;
async function computePeerTrust(){
  var gs = Array.isArray(PACK_DATA.approvedPeerRecordings) ? PACK_DATA.approvedPeerRecordings : [];
  for (var i = 0; i < gs.length; i++){ var g = gs[i]; if (g && typeof g === 'object' && PEER_TRUST){ try { PEER_TRUST.set(g, await verifyPeerGroup(g)); } catch(e){ PEER_TRUST.set(g, 'invalid'); } } }
}
function peerGroupVerified(g){ return !!(PEER_TRUST && g && typeof g === 'object' && PEER_TRUST.get(g) === 'verified'); }
var PEER_WHY = {unsigned: 'لا تحمل شهادة معلم', untrusted: 'شهادتها من معلم غير مسجَّل', invalid: 'تغيّرت بعد اعتمادها'};
/* حالة التوقيع التي يراها المعلم قبل إصدار إعداد المشرف */
async function teacherSigningStatus(){
  var rec = await keyDbGet(SIG_KEY_ID);
  var trusted = trustedKeysFor(PACK_DATA);
  if (!rec || !rec.publicJwk) return {code: 'nokey', ok: false, text: '🔑 لا يوجد مفتاح توقيع لديك بعد. سيُنشأ الآن عند الإصدار. أرسل مفتاحك إلى المشرف بعد ذلك (زر «عرض مفتاح التوقيع»).'};
  var th = jwkThumb(rec.publicJwk);
  if (!trusted.length) return {code: 'emptylist', ok: false, text: '⚠️ لا توجد مفاتيح موثوقة في هذا الإعداد. سيُصدر الملف لكن الأطفال لن يروا اعتمادًا موثّقًا حتى يضيف المشرف مفتاحك.'};
  if (trusted.some(function(t){ return t && jwkThumb(t) === th; })) return {code: 'trusted', ok: true, text: '✅ مفتاحك موثوق لدى المشرف، والاعتماد سيظهر موثّقًا للطفل.'};
  return {code: 'notlisted', ok: false, text: '⚠️ مفتاحك غير موجود في قائمة المشرف، لذلك سيظهر الاعتماد للطفل بلا توثيق. أرسل مفتاحك إلى المشرف ليضيفه.'};
}
async function showTeacherPublicKey(){
  var k = await getTeacherSigningKey();
  showModal('🔑 مفتاح توقيع المعلم', 'أرسل هذا النص إلى المشرف ليضعه في إعداد الاستوديو (مفاتيح المعلمين الموثوقة). لا يحتوي على أي سر.\n\n' + JSON.stringify(k.publicJwk), [{label: 'إغلاق', class: 'primary', action: closeModal}]);
}

