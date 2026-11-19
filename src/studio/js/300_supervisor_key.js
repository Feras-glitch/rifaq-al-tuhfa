/* ===== 9.39.11 (ق1-ب): مفتاح توقيع المشرف =====
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
  var done = Object.keys(STATE.recordings).length;
  if (done === 0){ alert('لا توجد تسجيلات.'); return; }

  var btn = $('btn-export');
  var origText = btn.textContent;
  btn.disabled = true;

  try {
    btn.textContent = '⏳ تجهيز قالب الطالب المضمّن...';
    var appHTML;
    try {
      appHTML = getEmbeddedStudentTemplate();
    } catch(e){
      btn.disabled = false; btn.textContent = origText;
      alert('تعذر تجهيز قالب الطالب المضمّن: ' + (e && e.message ? e.message : e));
      return;
    }

    if (appHTML.indexOf('/* ===PACK_DATA_START=== */') === -1 || appHTML.indexOf('/* ===PACK_DATA_END=== */') === -1 || appHTML.indexOf('/* ===PACK_DATA_END=== */') <= appHTML.indexOf('/* ===PACK_DATA_START=== */')){
      btn.disabled = false; btn.textContent = origText;
      alert('القالب لا يحتوي على العلامات المطلوبة.');
      return;
    }

    btn.textContent = '⏳ تحويل التسجيلات (' + done + ')...';
    var masterAudios = {};
    var welcomeAudioNeutral = null, welcomeAudioMale = null, welcomeAudioFemale = null;
    var ids = Object.keys(STATE.recordings);
    var rawBytes = ids.reduce(function(sum,id){ return sum + ((STATE.recordings[id] && STATE.recordings[id].size) || 0); }, 0);
    if (rawBytes > 20 * 1024 * 1024){ alert('حجم التسجيلات كبير جدًا (' + Math.round(rawBytes/1024/1024) + ' MB). الحد الآمن للتصدير هو 20 MB للمواد الصوتية الخام.'); return; }
    btn.textContent = '⏳ تحويل التسجيلات (' + ids.length + ')...';
    // Convert sequentially to avoid large Promise.all memory spikes on phones.
    for (var ci=0; ci<ids.length; ci++){
      var id = ids[ci];
      btn.textContent = '⏳ تحويل التسجيلات (' + (ci+1) + '/' + ids.length + ')...';
      var b64 = await blobToBase64(STATE.recordings[id]);
      if (id === '_greeting_neutral') welcomeAudioNeutral = b64;
      else if (id === '_greeting_male') welcomeAudioMale = b64;
      else if (id === '_greeting_female') welcomeAudioFemale = b64;
      else masterAudios[id] = b64;
    }

    var trustedKeys = [];
    try { trustedKeys = parseTrustedKeysInput(($('in-trusted-keys') && $('in-trusted-keys').value) || ''); }
    catch(e){ btn.disabled = false; btn.textContent = origText; alert('مفتاح المعلم غير صالح: ' + e.message); return; }
    var packData = {
      trustedTeacherKeys: trustedKeys,
      packageId: 'curr_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10),
      packageType: 'student_fresh',
      reviewCount: 0,
      submissionVersion: 0,
      sheikhName: STATE.sheikhName || '—',
      supervisorName: STATE.supervisorName || '',
      supervisorPhoto: STATE.supervisorPhoto || null,
      poemReciterName: STATE.poemReciterName || '',
      poemReciterPhoto: STATE.poemReciterPhoto || null,
      journeyTitle: 'رفاق التحفة',
      projectTitle: 'رحلة طالب العلم',
      trackTitle: 'في رحاب القرآن',
      seriesTitle: 'سلسلة التجويد',
      sheikhPhoto: STATE.sheikhPhoto || null,
      schoolName: STATE.schoolName || '',
      schoolLogo: STATE.schoolLogo || null,
      welcomeAudioNeutral: welcomeAudioNeutral,
      welcomeAudioMale: welcomeAudioMale,
      welcomeAudioFemale: welcomeAudioFemale,
      masterAudios: masterAudios,
      appVersion: APP_VERSION,
      schemaVersion: 2,
      sourceAppVersion: APP_VERSION,
      curriculum: CURRICULUM,
      isDemo: false
    };
    btn.textContent = '⏳ توقيع المادة المرجعية...';
    try { packData.refCert = await studioSignRef(packData); }
    catch(e){
      if (!confirm('تعذّر توقيع المادة المرجعية بمفتاح المشرف (' + (e && e.message || e) + ').\n\nالتطبيق الذي سُجّل فيه مفتاح المشرف سيخفي تلاوات الشيخ في ملف غير موقّع. هل تريد التصدير بلا توقيع؟')){ btn.disabled = false; btn.textContent = origText; return; }
      packData.refCert = null;
    }

    btn.textContent = '⏳ بناء الملف...';
    var packJSON = JSON.stringify(packData).replace(/<\//g, '<\\/');
    var newBlock = '/* ===PACK_DATA_START=== */\nvar PACK_DATA = ' + packJSON + ';\n/* ===PACK_DATA_END=== */';
    var startIdx = appHTML.indexOf('/* ===PACK_DATA_START=== */');
    var endIdx = appHTML.indexOf('/* ===PACK_DATA_END=== */');
    if (startIdx === -1 || endIdx === -1){
      btn.disabled = false; btn.textContent = origText;
      alert('علامات PACK_DATA غير موجودة.');
      return;
    }
    var replaced = appHTML.substring(0, startIdx) + newBlock + appHTML.substring(endIdx + '/* ===PACK_DATA_END=== */'.length);
    replaced = await studioCspWithScriptHash(replaced);

    var safeName = STATE.supervisorName.replace(/[\\/:*?"<>|]/g, '_');
    var blob = new Blob([replaced], {type: 'text/html;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'رحلة_طالب_العلم_رفاق_التحفة_' + safeName + '.html';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);

    var sizeKB = Math.round(replaced.length / 1024);
    log('exported', {items: done, sizeKB: sizeKB});
    btn.disabled = false; btn.textContent = origText;
    showModal('🎉 تم التصدير!', 'ملف رفاق التحفة التعليمي بحجم ' + sizeKB + ' كيلوبايت.\n\nيمكن توزيعه على الطلاب للتعلم والتدريب.', [{label: '👍 حسناً', class: 'success', action: closeModal}]);
  } catch(e){
    log('export-failed', {message: e.message});
    btn.disabled = false; btn.textContent = origText;
    alert('فشل التصدير: ' + e.message);
  }
}

(function boot(){
  log('studio-ready', {total: TOTAL, version: APP_VERSION, workspace: WORKSPACE_ID});
})();
