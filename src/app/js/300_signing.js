/* ===== 9.18: توقيع الاعتماد الرقمي (ECDSA P-256) ===== */
var SIG_KEY_ID = '__teacher_sign_key__';
/* مفتاح المعلم يجب أن يكون واحدًا لكل المتصفح، لا لكل طفل: لذلك يُحفظ في قاعدة مستقلة عن قاعدة كل حزمة */
var KEYDB_NAME = 'tohfa_teacher_keys', KEYDB_STORE = 'keys';
function openKeyDB(){
  return new Promise(function(res, rej){
    var r = indexedDB.open(KEYDB_NAME, 1);
    r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains(KEYDB_STORE)) r.result.createObjectStore(KEYDB_STORE); };
    r.onsuccess = function(){ res(r.result); };
    r.onerror = function(){ rej(r.error); };
  });
}
async function keyDbGet(key){
  var db = await openKeyDB();
  return new Promise(function(res, rej){ var tx = db.transaction(KEYDB_STORE, 'readonly'); var q = tx.objectStore(KEYDB_STORE).get(key); q.onsuccess = function(){ res(q.result || null); }; q.onerror = function(){ rej(q.error); }; });
}
async function keyDbPut(key, val){
  var db = await openKeyDB();
  return new Promise(function(res, rej){ var tx = db.transaction(KEYDB_STORE, 'readwrite'); tx.objectStore(KEYDB_STORE).put(val, key); tx.oncomplete = function(){ res(true); }; tx.onerror = function(){ rej(tx.error); }; });
}
var GIFT_TRUST = null; // unsigned | untrusted | invalid | verified
var RETURN_TRUST = null; // حالة توقيع ملاحظات المعلم في ملف الإعادة
function b64FromBytes(u8){ var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
function bytesFromB64(b){ var s = atob(b), u8 = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }
function giftTrustBadge(){ var t = {verified: ' — ✅ معتمد وموقّع من المعلم', untrusted: ' — ⚠️ التوقيع ليس من معلم مسجَّل لدى المشرف', invalid: ' — ❌ الاعتماد تغيّر بعد التوقيع', unsigned: ' — ℹ️ هذا الاعتماد بلا توقيع', outdated: ' — ⚠️ توقيع بصيغة قديمة لا تثبت محتوى الملف كله؛ اطلب من المعلم إعادة إصداره'}; return GIFT_TRUST ? (t[GIFT_TRUST] || '') : ''; }
function jwkThumb(k){ return JSON.stringify([k.crv, k.x, k.y]); }
async function sha256b64(str){ var d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str))); return b64FromBytes(new Uint8Array(d)); }
/* البيان: ما يُعتمد بالضبط (معرّف الحزمة وكل مجموعة وكل تسجيل بخلاصته) */
async function giftManifest(pack){  // used for both approved gifts and teacher-returned packs
  var groups = [];
  var pg = Array.isArray(pack.approvedPeerRecordings) ? pack.approvedPeerRecordings : [];
  for (var i = 0; i < pg.length; i++){
    var g = pg[i] || {}, audios = [], keys = Object.keys(g.audios || {}).sort();
    for (var j = 0; j < keys.length; j++){
      var r = g.audios[keys[j]] || {};
      audios.push({k: keys[j], st: String(r.status || ''), h: await sha256b64(r.audio || '')});
    }
    groups.push({id: String(g.id || ''), name: String(g.name || ''), gender: String(g.gender || ''), sh: g.shareable === true, audios: audios});
  }
  // v2 (DECISION-002 / ت1): يغطي المنهج، وتعليقات المعلم، وتسجيلات الشيخ، والحالات، لا الاعتماد وحده
  var masters = await sha256b64(JSON.stringify(pack.masterAudios || {}));
  var curr = await sha256b64(JSON.stringify(pack.curriculum || []));
  var notes = await sha256b64(JSON.stringify(pack.teacherNotes || {}));
  var fb = await sha256b64(JSON.stringify(pack.teacherFeedbacks || {}));
  var st = {}; Object.keys(pack.studentAudios || {}).sort().forEach(function(k){ st[k] = String((pack.studentAudios[k] || {}).status || ''); });
  var rat = await sha256b64(JSON.stringify(pack.teacherRatings || {}));
  /* 9.39 (R02): v3 يغطي صوت كل تسجيل للطالب وهويته وهوية المعلم وبصمات قائمة المفاتيح الموثوقة */
  var sa = {}; var sKeys = Object.keys(pack.studentAudios || {}).sort();
  for (var si = 0; si < sKeys.length; si++){ var sr = (pack.studentAudios || {})[sKeys[si]] || {}; sa[sKeys[si]] = await sha256b64(String(sr.audio || '')); }
  var tk = (Array.isArray(pack.trustedTeacherKeys) ? pack.trustedTeacherKeys : []).map(function(k){ try { return jwkThumb(k); } catch(e){ return ''; } }).sort();
  return JSON.stringify({v: 3, packageId: String(pack.packageId || ''), packageType: String(pack.packageType || ''), sourceGiftStudentName: String(pack.sourceGiftStudentName || ''), studentId: String(pack.studentId || ''), studentName: String(pack.studentName || ''), teacherName: String(pack.teacherName || ''), trustedKeys: tk, groups: groups, masters: masters, curr: curr, notes: notes, fb: fb, statuses: st, studentAudioHashes: sa, rat: rat});
}
async function getTeacherSigningKey(){
  var rec = await keyDbGet(SIG_KEY_ID);
  if (rec && rec.privateKey && rec.publicJwk) return rec;
  var pair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign', 'verify']);
  var jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  var pub = {kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y};
  rec = {privateKey: pair.privateKey, publicJwk: pub, createdAt: new Date().toISOString()};
  await keyDbPut(SIG_KEY_ID, rec);
  return rec;
}
async function contentManifest(pack, fresh){
  var d = (pack === PACK_DATA && !fresh) ? await PACK_CANON_DIGEST : await sha256b64(canonJSON(JSON.parse(JSON.stringify(pack)), 'signature'));
  if (!d) throw new Error('content digest unavailable');
  return JSON.stringify({v: 4, content: d});
}
async function signGiftPack(pack){
  var k = await getTeacherSigningKey();
  pack.signature = null; // لا يدخل في البيان، ويُستبعد صراحةً
  var m = await contentManifest(pack, true);
  var sig = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, k.privateKey, new TextEncoder().encode(m));
  pack.signature = {alg: 'ECDSA-P256-SHA256', mv: 4, key: k.publicJwk, sig: b64FromBytes(new Uint8Array(sig)), signedAt: new Date().toISOString()};
  return pack;
}
async function verifyGiftPack(pack){
  if (pack === PACK_DATA && PACK_PROTO_TAMPERED) return 'invalid'; // 9.39.2: بيانات بنماذج أولية خفية = ملف معدَّل
  var sg = pack.signature;
  if (!sg || !sg.key || !sg.sig) return 'unsigned';
  var trusted = trustedKeysFor(pack);
  var th = jwkThumb(sg.key);
  if (!trusted.some(function(t){ return t && jwkThumb(t) === th; })) return 'untrusted';
  if (sg.mv !== 4) return 'outdated'; // v3 لا يغطي كل الحقول المعروضة؛ لا يُقبل كاعتماد موثّق
  try {
    var key = await crypto.subtle.importKey('jwk', {kty: sg.key.kty, crv: sg.key.crv, x: sg.key.x, y: sg.key.y, ext: true}, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
    var m = await contentManifest(pack);
    var ok = await crypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, key, bytesFromB64(sg.sig), new TextEncoder().encode(m));
    return ok ? 'verified' : 'invalid';
  } catch(e){ return 'invalid'; }
}
