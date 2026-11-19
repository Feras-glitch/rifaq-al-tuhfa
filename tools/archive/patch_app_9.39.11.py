# -*- coding: utf-8 -*-
"""9.39.11: تنفيذ قرارات المالك على مراجعة 9.39.10.
ق1-ب: توقيع المشرف للمادة المرجعية + شهادة معلم لكل مجموعة تسجيلات زملاء (يسد RT9399-01).
ق5-أ: بوابة حسابية لولي الأمر قبل الإعدادات والحذف، ونقل زر التصفير من الرئيسية إلى إعدادات ولي الأمر.
شغّله من جذر المستودع ثم tools/rebuild_html.py — قابل لإعادة التشغيل (كل تعديل يُطبَّق مرة واحدة ويُتحقق من تفرّده)."""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = []
def rep(old, new): R.append((old, new))

# ======================================================================
# ق5-أ: زر التصفير يخرج من الرئيسية، والإعدادات خلف بوابة حسابية
# ======================================================================
rep('''      <button class="btn ghost" data-call="[&quot;showReset&quot;]" type="button" data-style="flex:0 0 60px;min-width:60px">🔄</button>
''', '')

rep('''function openGuardianSettings(){
  var c = STATE.student && STATE.student.consent;
  if (!c || c.v !== CONSENT_VERSION){ alert('لا توجد موافقة مسجّلة بعد.'); return; }
  var ov = document.createElement('div');''',
r'''/* 9.39.11 (ق5-أ): بوابة ولي الأمر — مسألة ضرب (عدد من رقمين × رقم واحد) قبل الإعدادات أو الحذف.
   لا تُحفظ نتيجة البوابة: كل فتح جديد يحتاج مسألة جديدة. ثلاث محاولات خاطئة توقف البوابة 30 ثانية. */
function toLatinDigits(s){ return String(s || '').replace(/[٠-٩]/g, function(d){ return String(d.charCodeAt(0) - 0x0660); }).replace(/[۰-۹]/g, function(d){ return String(d.charCodeAt(0) - 0x06F0); }).replace(/\s+/g, ''); }
function parentalGate(onPass, purpose){
  var old = document.getElementById('parent-gate'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'parent-gate';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:380px;width:100%;padding:18px;text-align:center;line-height:1.8';
  var h = document.createElement('h3'); h.style.cssText = 'margin:0 0 6px'; h.textContent = '🔒 لولي الأمر فقط';
  var p = document.createElement('p'); p.style.cssText = 'margin:0 0 8px'; p.textContent = (purpose || 'هذه الإعدادات لولي الأمر.') + ' اكتب ناتج الضرب للمتابعة:';
  var q = document.createElement('div'); q.id = 'parent-gate-q'; q.style.cssText = 'font-size:1.7rem;font-weight:800;direction:ltr;margin:6px 0';
  var inp = document.createElement('input'); inp.id = 'parent-gate-answer'; inp.type = 'text'; inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('autocomplete', 'off'); inp.maxLength = 4;
  inp.style.cssText = 'width:120px;font-size:1.3rem;text-align:center;padding:8px;border:2px solid #cfd8dc;border-radius:12px;direction:ltr';
  var msg = document.createElement('div'); msg.id = 'parent-gate-msg'; msg.style.cssText = 'min-height:1.6em;color:#b3261e;font-size:.9rem;margin:6px 0';
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
  var ok = document.createElement('button'); ok.type = 'button'; ok.id = 'parent-gate-ok'; ok.className = 'btn primary'; ok.textContent = 'متابعة';
  var cancel = document.createElement('button'); cancel.type = 'button'; cancel.id = 'parent-gate-cancel'; cancel.className = 'btn ghost'; cancel.textContent = 'إلغاء';
  row.appendChild(ok); row.appendChild(cancel);
  [h, p, q, inp, msg, row].forEach(function(e){ card.appendChild(e); });
  ov.appendChild(card); document.body.appendChild(ov);
  var a = 0, b = 0, tries = 0;
  function newQ(){ do { a = 12 + Math.floor(Math.random() * 88); } while (a % 10 === 0 || a % 11 === 0); b = 3 + Math.floor(Math.random() * 7); q.textContent = a + ' × ' + b + ' = ?'; inp.value = ''; }
  newQ();
  function check(){
    if (ok.disabled) return;
    if (toLatinDigits(inp.value) === String(a * b)){ ov.remove(); onPass(); return; }
    tries++;
    if (tries >= 3){
      ok.disabled = true; inp.disabled = true; msg.textContent = 'محاولات كثيرة. انتظر 30 ثانية.';
      setTimeout(function(){ if (!document.body.contains(ov)) return; ok.disabled = false; inp.disabled = false; tries = 0; msg.textContent = ''; newQ(); }, 30000);
      return;
    }
    msg.textContent = 'الإجابة غير صحيحة. هذه مسألة أخرى.'; newQ();
  }
  ok.onclick = check;
  cancel.onclick = function(){ ov.remove(); };
  inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') check(); });
  try { inp.focus(); } catch(e){}
}
function openGuardianSettings(){ parentalGate(openGuardianSettingsInner); }
function openGuardianSettingsInner(){
  var c = STATE.student && STATE.student.consent;
  var hasC = !!(c && c.v === CONSENT_VERSION);
  var ov = document.createElement('div');''')

# بلا موافقة مسجّلة: تفتح الإعدادات بخيار التصفير وحده (كان: تنبيه «لا توجد موافقة» ولا شيء غيره)
rep('''  ov.id = 'guardian-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  var rows = ''',
'''  ov.id = 'guardian-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  if (!hasC){
    var card0 = document.createElement('div');
    card0.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:440px;width:100%;padding:18px;font-size:1rem;line-height:1.8';
    card0.innerHTML = '<h3 data-style="margin:0 0 8px">⚙️ إعدادات ولي الأمر</h3><p>لا توجد موافقة مسجّلة على هذا الجهاز بعد؛ تُطلب عند أول تسجيل صوتي.</p>' +
      '<p data-style="font-size:.85rem"><b>التصفير:</b> يحذف تقدّم الطالب وبياناته من هذا الجهاز.</p>' +
      '<button type="button" id="gs-delete" class="btn" data-style="background:#b3261e;color:#fff">🔄 تصفير: حذف بيانات الطالب من هذا الجهاز</button>' +
      '<div data-style="display:flex;justify-content:flex-end;margin-top:10px"><button type="button" id="gs-close" class="btn">إغلاق</button></div>';
    ov.appendChild(card0); document.body.appendChild(ov);
    $('gs-close').onclick = function(){ ov.remove(); };
    $('gs-delete').onclick = function(){ ov.remove(); deleteChildDataOnDevice(); };
    return;
  }
  var rows = ''')

rep('''    '<button type="button" id="gs-delete" class="btn" data-style="background:#b3261e;color:#fff">🗑️ حذف بيانات الطالب من هذا الجهاز</button>' +
    '<div data-style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">''',
    '''    '<button type="button" id="gs-delete" class="btn" data-style="background:#b3261e;color:#fff">🔄 تصفير: حذف بيانات الطالب من هذا الجهاز</button>' +
    '<div data-style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">''')

rep('''function showReset(){
  /* 9.39.10: المسار المحمي نفسه لحذف بيانات الطفل (علامة دائمة، إبلاغ النوافذ، لا إعلان قبل الاكتمال، حذف النسخ في المضيفة) */
  return deleteChildDataOnDevice();
}''', '''function showReset(){
  /* 9.39.10: المسار المحمي نفسه لحذف بيانات الطفل (علامة دائمة، إبلاغ النوافذ، لا إعلان قبل الاكتمال، حذف النسخ في المضيفة)
     9.39.11 (ق5-أ): لم يعد له زر في الرئيسية، ويمر ببوابة ولي الأمر أينما استُدعي */
  parentalGate(function(){ deleteChildDataOnDevice(); }, 'التصفير يحذف بيانات الطالب من هذا الجهاز.');
}''')

# ======================================================================
# ق1-ب: مرساة المشرف (تحقنها الصفحة المضيفة) + لقطة المادة المرجعية كما وصلت
# ======================================================================
rep('''var PINNED_TEACHER_KEYS = null; /* RIFAQ_PINNED_KEYS */
''', '''var PINNED_TEACHER_KEYS = null; /* RIFAQ_PINNED_KEYS */
/* 9.39.11 (ق1-ب): مرساة المشرف — {keys: مفاتيح المشرفين، refDigests: بصمات المادة المرجعية المدمجة في الإصدار نفسه}.
   null = ملف مستقل خارج التطبيق: لا مرساة، فتُعرض المادة كما هي (قيد معلن). */
var PINNED_SUPERVISOR = null; /* RIFAQ_PINNED_SUPERVISOR */
''')

rep('''var PACK_CANON_DIGEST = (function(){ try { return sha256b64(canonJSON(PACK_DATA, 'signature')).catch(function(){ return null; }); } catch(e){ return Promise.resolve(null); } })();
''', r'''var PACK_CANON_DIGEST = (function(){ try { return sha256b64(canonJSON(PACK_DATA, 'signature')).catch(function(){ return null; }); } catch(e){ return Promise.resolve(null); } })();
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
''')

# التعقيم: شهادة المرجع وشهادات المجموعات تُعاد بناؤها بحقول معروفة فقط
rep('''      g.photo = safeImageURL(g.photo); g.shareable = g.shareable === true; g.name = String(g.name || ''); g.id = String(g.id || ''); g.gender = g.gender === 'girl' ? 'girl' : 'boy';
      cleanRec(g.audios, 'rec');''',
'''      g.photo = safeImageURL(g.photo); g.shareable = g.shareable === true; g.name = String(g.name || ''); g.id = String(g.id || ''); g.gender = g.gender === 'girl' ? 'girl' : 'boy';
      cleanRec(g.audios, 'rec');
      g.cert = cleanCertObj(g.cert); // 9.39.11 (ق1-ب)''')
rep('''    } else P.signature = null;
    if (P.studentAudios && typeof P.studentAudios === 'object'){''',
'''    } else P.signature = null;
    P.refCert = cleanCertObj(P.refCert); // 9.39.11 (ق1-ب): يُتحقق منه على اللقطة الأصلية REF_CERT_RAW
    if (P.studentAudios && typeof P.studentAudios === 'object'){''')

# ======================================================================
# ق1-ب: التحقق والتوقيع
# ======================================================================
rep('''/* حالة التوقيع التي يراها المعلم قبل إصدار إعداد المشرف */
async function teacherSigningStatus(){''', r'''/* ===== 9.39.11 (ق1-ب): توقيع المشرف للمادة المرجعية + شهادة معلم لكل مجموعة تسجيلات زملاء =====
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
  PACK_DATA.masterAudios = {};
  ['welcomeAudioNeutral','welcomeAudioMale','welcomeAudioFemale','sheikhPhoto','supervisorPhoto','poemReciterPhoto','schoolLogo'].forEach(function(k){ PACK_DATA[k] = null; });
  PACK_DATA.sheikhName = 'الشيخ'; PACK_DATA.supervisorName = ''; PACK_DATA.poemReciterName = ''; PACK_DATA.schoolName = '';
}
function refStatusLine(){
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
async function teacherSigningStatus(){''')

# العرض: تسجيلات الزملاء تُعرض فقط من المجموعات ذات الشهادة الصحيحة
rep('''function displayedGiftContents(){ return buildGiftContents(peerAudiosAllowed() ? normalizePeerGroups() : [], PACK_DATA.masterAudios); }''',
    '''function trustedPeerGroups(){ return peerAudiosAllowed() ? normalizePeerGroups().filter(peerGroupVerified) : []; } // 9.39.11 (ق1-ب)
function hiddenPeerGroupCount(){ return peerAudiosAllowed() ? normalizePeerGroups().filter(function(g){ return !peerGroupVerified(g); }).length : 0; }
function displayedGiftContents(){ return buildGiftContents(trustedPeerGroups(), PACK_DATA.masterAudios); }''')
rep('''  if (!peerAudiosAllowed()) txt += '\\n\\n⚠️ الاعتماد غير موثّق، فلا تُعرض تسجيلات الزملاء ولا تُحسب في هذا الوصف.';''',
    '''  if (!peerAudiosAllowed()) txt += '\\n\\n⚠️ الاعتماد غير موثّق، فلا تُعرض تسجيلات الزملاء ولا تُحسب في هذا الوصف.';
  else if (hiddenPeerGroupCount()) txt += '\\n\\n⚠️ لم تُعرض تسجيلات ' + hiddenPeerGroupCount() + ' من الزملاء لأنها لا تحمل اعتماد معلم مسجَّل.';
  if (REF_HIDDEN) txt += '\\n\\n⚠️ تلاوات الشيخ في هذا الملف غير موقّعة من مشرف مسجَّل، فأُخفيت.';''')
rep('''function peerAudioBlocks(itemId){
  if (!peerAudiosAllowed()) return '';
  var groups = normalizePeerGroups(), out = [];''', '''function peerAudioBlocks(itemId){
  if (!peerAudiosAllowed()) return '';
  var groups = trustedPeerGroups(), out = [];''')

# الإهداء: المجموعات الموروثة تنتقل فقط بشهادة صحيحة، ومجموعة الطالب الحالي تُشهد الآن
rep('''  var _inherited = normalizePeerGroups().filter(function(g){ return g && g.shareable === true; });
  var preview = buildGiftContents(_inherited.concat([{audios: _own}]), PACK_DATA.masterAudios);''',
'''  /* 9.39.11 (ق1-ب): لا ينتقل من تسجيلات الزملاء الموروثة إلا ما يحمل شهادة صحيحة من معلم مسجَّل */
  var _inhAll = normalizePeerGroups().filter(function(g){ return g && g.shareable === true; }), _inherited = [], _dropped = [];
  for (var _gi = 0; _gi < _inhAll.length; _gi++){ var _gs = await verifyPeerGroup(_inhAll[_gi]); if (_gs === 'verified') _inherited.push(_inhAll[_gi]); else _dropped.push((_inhAll[_gi].name || 'زميل') + ' (' + (PEER_WHY[_gs] || _gs) + ')'); }
  var preview = buildGiftContents(_inherited.concat([{audios: _own}]), PACK_DATA.masterAudios);''')
rep('''    (!_share ? '\\n\\nℹ️ ولي أمر الطالب لم يأذن بمشاركة تسجيلاته، فلن تدخل تسجيلاته الإهداء.' : '') +''',
    '''    (!_share ? '\\n\\nℹ️ ولي أمر الطالب لم يأذن بمشاركة تسجيلاته، فلن تدخل تسجيلاته الإهداء.' : '') +
    (_dropped.length ? '\\n\\n⚠️ لن تنتقل تسجيلات زملاء موروثة: ' + _dropped.join('، ') + '.' : '') +
    (REF_HIDDEN ? '\\n\\n⚠️ المادة المرجعية في هذا الملف غير موقّعة من مشرف مسجَّل؛ لن تنتقل تلاوات الشيخ ولا أسماء المرجع.' : '') +''')
rep('''    teacherFeedbacks: {},
    filename: 'إعداد_المشرف.html',''', '''    teacherFeedbacks: {},
    inheritedGroups: _inherited,
    filename: 'إعداد_المشرف.html',''')
rep('''    var inheritedGroups = normalizePeerGroups().filter(function(g){ return g && g.shareable === true; }).map(function(g){ return {id:g.id || ('giver_'+simpleHash(g.name||'')), name:g.name||'', gender:g.gender||'boy', photo:g.photo||null, audios:g.audios||{}, shareable:true}; });''',
    '''    // 9.39.11 (ق1-ب): المجموعات الموروثة هي التي تحققت شهادتها في exportApprovedPack، وتنتقل بحقولها كما شُهدت
    var inheritedGroups = (opts.inheritedGroups || []).map(function(g){ return {id: g.id, name: g.name, gender: g.gender, photo: g.photo || null, audios: g.audios || {}, shareable: true, cert: g.cert}; });''')
rep('''    if (ownShare && Object.keys(ownAudios).length) mergedGroups.push(currentGroup);
    newPack.approvedPeerRecordings = mergedGroups;''',
'''    if (ownShare && Object.keys(ownAudios).length){
      try { currentGroup.cert = await signPeerGroup(currentGroup); } catch(e){ alert('تعذّر توقيع تسجيلات الطالب: ' + e.message); return; }
      mergedGroups.push(currentGroup);
    }
    newPack.approvedPeerRecordings = mergedGroups;''')
rep('''  if (isGiftExport || newPack.packageType === 'student_returned'){ try { await signGiftPack(newPack); } catch(e){ alert('تعذّر توقيع الحزمة: ' + e.message); return; } }''',
    '''  applyRefExport(newPack); // 9.39.11 (ق1-ب): المادة المرجعية كما وصلت (بشهادتها) أو بلا شهادة إن لم تُوثَّق
  if (isGiftExport) newPack.giftContents = buildGiftContents(newPack.approvedPeerRecordings || [], newPack.masterAudios);
  if (isGiftExport || newPack.packageType === 'student_returned'){ try { await signGiftPack(newPack); } catch(e){ alert('تعذّر توقيع الحزمة: ' + e.message); return; } }''')

# إرسال الطالب
rep('''      curriculum: CURRICULUM,
      isDemo: false,
      approved: exportKind === 'gift'
    };
''', '''      curriculum: CURRICULUM,
      isDemo: false,
      approved: exportKind === 'gift'
    };
    applyRefExport(fullPack); // 9.39.11 (ق1-ب)
''')

# الإقلاع: الثقة بالمرجع وبالمجموعات قبل أي عرض
rep('''(async function boot(){
  resumePendingDeletions();
  load();''', '''(async function boot(){
  resumePendingDeletions();
  load();
  try { REF_TRUST = await computeRefTrust(); } catch(e){ REF_TRUST = 'invalid'; }
  applyRefPolicy();''')
rep('''  if (PACK_DATA.packageType === 'student_returned'){
    try { RETURN_TRUST = await verifyGiftPack(PACK_DATA); } catch(e){ RETURN_TRUST = 'invalid'; }
  }''', '''  if (PACK_DATA.packageType === 'student_returned'){
    try { RETURN_TRUST = await verifyGiftPack(PACK_DATA); } catch(e){ RETURN_TRUST = 'invalid'; }
  }
  try { await computePeerTrust(); } catch(e){}
  try { refreshGiftContentsBox(); } catch(e){}''')

# تنبيه ظاهر للمعلم وللطالب
rep('''  teacherSigningStatus().then(function(st){
    var sb = document.getElementById('review-sign-line');''', '''  (function(){ // 9.39.11 (ق1-ب)
    var rs = refStatusLine(), rb = document.getElementById('review-ref-line');
    if (!rs){ if (rb) rb.remove(); return; }
    if (!rb){ rb = document.createElement('div'); rb.id = 'review-ref-line'; rb.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:12px;font-size:.9rem;line-height:1.8'; var rl0 = $('review-list'); if (rl0 && rl0.parentNode) rl0.parentNode.insertBefore(rb, rl0); }
    rb.style.background = rs.ok ? '#e8f5e9' : '#ffebee'; rb.style.color = rs.ok ? '#1b5e20' : '#b71c1c'; rb.textContent = rs.text;
  })();
  teacherSigningStatus().then(function(st){
    var sb = document.getElementById('review-sign-line');''')
rep('''  $('home-sub').textContent = sub;
  var gcBtn = document.getElementById('home-gift-contents-btn');''', '''  $('home-sub').textContent = sub;
  var refB = document.getElementById('home-ref-banner'); // 9.39.11 (ق1-ب)
  if (REF_HIDDEN){
    if (!refB){ refB = document.createElement('div'); refB.id = 'home-ref-banner'; refB.className = 'notice warn'; refB.style.cssText = 'margin:10px 0;font-size:.88rem'; var sl0 = $('section-list'); if (sl0 && sl0.parentNode) sl0.parentNode.insertBefore(refB, sl0); }
    refB.textContent = '⚠️ هذا الملف لا يحمل توقيع المشرف المعتمد، فأُخفيت تلاوات الشيخ. اطلب من معلمك الملف الأصلي.';
  } else if (refB) refB.remove();
  var gcBtn = document.getElementById('home-gift-contents-btn');''')

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new and new in s: continue  # مطبَّق مسبقًا
        n = s.count(old)
        if not new and n == 0: continue  # حذف مطبَّق مسبقًا
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:110]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
