# -*- coding: utf-8 -*-
"""9.39.11 (ق1-ب): الاستوديو — مفتاح توقيع المشرف، وتوقيع المادة المرجعية في كل ملف يصدره.
شغّله من جذر المستودع قبل tools/rebuild_html.py — قابل لإعادة التشغيل."""
import sys
SFILE = 'studio/استوديو_المشرف_v9.39.html'
RS = []
def reps(old, new): RS.append((old, new))

reps('''    <div class="notice" style="font-size:.85rem">يُدرج هذا المفتاح في الملف، فيتحقق تطبيق الطفل من أن الاعتماد صادر عن المعلم. كل مفتاح في سطر منفصل أو داخل مصفوفة JSON.</div>
''', '''    <div class="notice" style="font-size:.85rem">يُدرج هذا المفتاح في الملف، فيتحقق تطبيق الطفل من أن الاعتماد صادر عن المعلم. كل مفتاح في سطر منفصل أو داخل مصفوفة JSON.</div>
    <button class="btn ghost" id="btn-sup-key" onclick="showSupervisorPublicKey()" type="button" style="margin:6px 0">🔑 مفتاح توقيع المشرف (لإعداد التطبيق)</button>
    <div id="sup-key-box" class="notice hidden" style="font-size:.85rem"></div>
''')

reps('''async function exportSheikhPack(){
  var done = Object.keys(STATE.recordings).length;''', r'''/* ===== 9.39.11 (ق1-ب): مفتاح توقيع المشرف =====
   يُنشأ مرة واحدة على هذا الجهاز (المفتاح الخاص غير قابل للاستخراج)، ويوقّع «المادة المرجعية» في كل ملف يصدره الاستوديو:
   المنهج، وتلاوات الشيخ، وأسماء المرجع وصوره، وصوت الترحيب. التطبيق المثبَّت يعرض التلاوات والأسماء فقط إن كان المفتاح
   العام مسجَّلًا في قائمة supervisors في web/trusted-teachers.json — فلا يستطيع ملف معدَّل أن يضيف «تلاوة شيخ» من عنده. */
var SUP_KEYDB = 'rifaq_supervisor_keys_v1', SUP_KEY_ID = 'supervisor_sig_v1';
var STUDIO_REF_KEYS = ['curriculum','masterAudios','sheikhName','sheikhPhoto','sheikhGender','supervisorName','supervisorPhoto','supervisorGender','poemReciterName','poemReciterPhoto','schoolName','schoolLogo','welcomeAudioNeutral','welcomeAudioMale','welcomeAudioFemale','journeyTitle','projectTitle','trackTitle','seriesTitle'];
function supKeyDb(){
  return new Promise(function(res, rej){
    var r = indexedDB.open(SUP_KEYDB, 1);
    r.onupgradeneeded = function(){ if (!r.result.objectStoreNames.contains('keys')) r.result.createObjectStore('keys'); };
    r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); };
  });
}
async function supKeyTx(mode, fn){
  var db = await supKeyDb();
  return new Promise(function(res, rej){ var tx = db.transaction('keys', mode); var q = fn(tx.objectStore('keys')); tx.oncomplete = function(){ res(q && q.result); }; tx.onerror = function(){ rej(tx.error); }; });
}
async function getSupervisorSigningKey(){
  var rec = await supKeyTx('readonly', function(st){ return st.get(SUP_KEY_ID); });
  if (rec && rec.privateKey && rec.publicJwk) return rec;
  var pair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign', 'verify']);
  var jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  rec = {privateKey: pair.privateKey, publicJwk: {kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y}, createdAt: new Date().toISOString()};
  await supKeyTx('readwrite', function(st){ return st.put(rec, SUP_KEY_ID); });
  return rec;
}
function studioB64(buf){ var u8 = new Uint8Array(buf), s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
/* مطابقة حرفيًا لـ canonJSON في التطبيق: مفاتيح مرتبة، والقيم غير المعرّفة تسقط */
function studioCanonJSON(v){
  function c(x){
    if (x === null || typeof x !== 'object'){ var s = JSON.stringify(x); return s === undefined ? undefined : s; }
    if (Array.isArray(x)) return '[' + x.map(function(e){ var s = c(e); return s === undefined ? 'null' : s; }).join(',') + ']';
    var ks = Object.keys(x).sort(), out = [];
    for (var i = 0; i < ks.length; i++){ var s = c(x[ks[i]]); if (s !== undefined) out.push(JSON.stringify(ks[i]) + ':' + s); }
    return '{' + out.join(',') + '}';
  }
  return c(v);
}
async function studioSignRef(packData){
  var embedded = JSON.parse(JSON.stringify(packData)); // ما سيقرؤه التطبيق بالضبط
  var ref = {};
  STUDIO_REF_KEYS.forEach(function(k){ if (Object.prototype.hasOwnProperty.call(embedded, k) && embedded[k] !== undefined) ref[k] = embedded[k]; });
  var d = studioB64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(studioCanonJSON(ref))));
  var k = await getSupervisorSigningKey();
  var sig = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, k.privateKey, new TextEncoder().encode(JSON.stringify({v: 1, ref: d})));
  return {alg: 'ECDSA-P256-SHA256', v: 1, key: k.publicJwk, sig: studioB64(sig), signedAt: new Date().toISOString()};
}
async function showSupervisorPublicKey(){
  var box = $('sup-key-box');
  try {
    var k = await getSupervisorSigningKey();
    box.textContent = '';
    var p = document.createElement('div'); p.textContent = 'هذا المفتاح العام للمشرف (لا يحوي أي سر). أضفه داخل قائمة "supervisors" في الملف web/trusted-teachers.json ثم ابنِ إصدارًا جديدًا من التطبيق. كل ملف يُصدر من هذا الاستوديو يحمل توقيعه.';
    var pre = document.createElement('pre'); pre.id = 'sup-key-json'; pre.style.cssText = 'direction:ltr;text-align:left;white-space:pre-wrap;word-break:break-all;background:#f1f5f9;padding:8px;border-radius:8px;font-size:.75rem';
    pre.textContent = JSON.stringify(k.publicJwk);
    box.appendChild(p); box.appendChild(pre); box.classList.remove('hidden');
  } catch(e){ box.textContent = 'تعذّر إنشاء مفتاح المشرف في هذا المتصفح: ' + (e && e.message || e); box.classList.remove('hidden'); }
}
async function exportSheikhPack(){
  var done = Object.keys(STATE.recordings).length;''')

reps('''      curriculum: CURRICULUM,
      isDemo: false
    };
''', r'''      curriculum: CURRICULUM,
      isDemo: false
    };
    btn.textContent = '⏳ توقيع المادة المرجعية...';
    try { packData.refCert = await studioSignRef(packData); }
    catch(e){
      if (!confirm('تعذّر توقيع المادة المرجعية بمفتاح المشرف (' + (e && e.message || e) + ').\n\nالتطبيق الذي سُجّل فيه مفتاح المشرف سيخفي تلاوات الشيخ في ملف غير موقّع. هل تريد التصدير بلا توقيع؟')){ btn.disabled = false; btn.textContent = origText; return; }
      packData.refCert = null;
    }
''')

# ق3-ب: الأسئلة المكتوبة بالرسم الإملائي لا تُطلب تلاوتها من الشيخ؛ ق2-ب: بنك الاختبار يُفحص كأسئلة الدروس
reps('''      if (q.type === 'extraction' && q.textType === 'quran'){
        list.push(''', '''      if (q.type === 'extraction' && q.textType === 'quran' && q.recite !== false){
        list.push(''')
reps('''    (sec.items || []).concat(sec.questions || []).forEach(function(x){ if (x && x.id !== undefined && !STUDIO_ID_RE.test(String(x.id))) E.push('معرّف غير صالح: ' + String(x.id).slice(0, 40)); });''',
     '''    (sec.items || []).concat(sec.questions || [], sec.examQuestions || []).forEach(function(x){ if (x && x.id !== undefined && !STUDIO_ID_RE.test(String(x.id))) E.push('معرّف غير صالح: ' + String(x.id).slice(0, 40)); });''')
reps('''    (sec.questions || []).forEach(function(q){
      if (!q.id || ids[q.id]) E.push('معرّف سؤال مفقود أو مكرر: ' + q.id);''', '''    (sec.questions || []).concat(sec.examQuestions || []).forEach(function(q){
      if (!q.id || ids[q.id]) E.push('معرّف سؤال مفقود أو مكرر: ' + q.id);''')

s = open(SFILE, encoding='utf-8').read()
for old, new in RS:
    if new and new in s: continue
    n = s.count(old)
    if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (SFILE, n, old[:110]))
    s = s.replace(old, new)
open(SFILE, 'w', encoding='utf-8').write(s); print('patched', SFILE)
