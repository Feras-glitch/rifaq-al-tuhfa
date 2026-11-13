/* رفاق التحفة — الصفحة المضيفة (open.html)
 *
 * تشغّل التطبيق أو الاستوديو أو أي ملف حزمة داخل إطار، على الويب وأندرويد وويندوز.
 *
 * قاعدة الأمان: كود الملف المفتوح لا يُشغَّل أبدًا. نستخرج منه كتلة PACK_DATA (بيانات JSON فقط)،
 * ونحقنها في قالب التطبيق الموثوق المضمَّن (app/template.txt)، ثم نعيد حساب تجزئة CSP للسكربت.
 * فملف HTML معدَّل لا يستطيع تشغيل كود داخل التطبيق، والحزم القديمة تعمل بكود الإصدار الحالي.
 * التطبيق نفسه يعقّم PACK_DATA عند الإقلاع (sanitizePackData) ويتحقق من توقيع الاعتماد.
 *
 * أندرويد (Capacitor): WebView لا ينفّذ تنزيل <a download>، فنعترض التنزيل داخل الإطار
 * ونحفظ الملف في Documents/RifaqAlTuhfa ونفتح قائمة المشاركة. ونستقبل الملفات المفتوحة بـ«فتح باستخدام».
 * ويندوز (Electron): التنزيل يعمل أصلًا بنافذة حفظ؛ ونستقبل الملف المفتوح من سطر الأوامر عبر rifaqNative.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var frame = $('frame'), panel = $('panel'), loading = $('loading'), errBox = $('err');
  var CAP = window.Capacitor;
  var IS_CAP = !!(CAP && typeof CAP.isNativePlatform === 'function' && CAP.isNativePlatform());
  var NATIVE = window.rifaqNative || null; // Electron preload
  var MAX_BYTES = 80 * 1024 * 1024;
  var currentBlobUrl = null;

  var KIND = {
    student_fresh: '🎓 ملف طالب',
    student_submission: '📨 إرسال للمراجعة',
    student_returned: '🔄 معاد للتعديل',
    approved_gift: '🎁 إهداء معتمد',
    teacher_review: '👨‍🏫 مراجعة'
  };

  /* ---------- أدوات ---------- */
  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500);
  }
  function showError(msg) { errBox.textContent = msg; errBox.hidden = false; showPanel(); }
  function clearError() { errBox.hidden = true; errBox.textContent = ''; }
  function setTitle(s) { $('cur-title').textContent = s || 'رفاق التحفة'; document.title = s ? s + ' — رفاق التحفة' : 'رفاق التحفة'; }

  function b64(bytes) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function sha256b64(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (d) { return b64(new Uint8Array(d)); });
  }
  function sha256hex(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  function blobToBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result); res(s.slice(s.indexOf(',') + 1)); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  }

  /* ---------- القالب الموثوق واستخراج البيانات ---------- */
  var PACK_RE = /\/\* ===PACK_DATA_START=== \*\/\s*var PACK_DATA = ([\s\S]*?);\s*\/\* ===PACK_DATA_END=== \*\//;
  var templatePromise = null;
  function getTemplate() {
    if (!templatePromise) {
      templatePromise = fetch('./app/template.txt', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('template ' + r.status);
        return r.text();
      }).then(function (t) {
        if (!PACK_RE.test(t)) throw new Error('template has no PACK_DATA block');
        return t;
      });
      templatePromise.catch(function () { templatePromise = null; });
    }
    return templatePromise;
  }

  function extractPack(text) {
    if (typeof text !== 'string' || text.indexOf('===PACK_DATA_START===') < 0) {
      throw new Error('هذا ليس ملفًا من ملفات رفاق التحفة.\nافتح ملفًا صدر من التطبيق أو الاستوديو (إرسال للمراجعة، أو معاد للتعديل، أو إهداء، أو إعداد المشرف).');
    }
    // 9.39.2: بحث خطي بالعلامات بدل تعبير نمطي (كان ملف 1.5 ميغابايت مصنوع يجمّد الصفحة 6 ثوانٍ).
    // JSON لا يحوي سطرًا جديدًا خامًا، فأول «;\n/* ===PACK_DATA_END» بعد البداية هو النهاية الحقيقية.
    var S0 = '/* ===PACK_DATA_START=== */', V0 = 'var PACK_DATA = ', E0 = '/* ===PACK_DATA_END=== */';
    var a = text.indexOf(S0), v = a < 0 ? -1 : text.indexOf(V0, a), e = v < 0 ? -1 : text.indexOf(E0, v);
    if (a < 0 || v < 0 || v - (a + S0.length) > 4 || e < 0) throw new Error('الملف ناقص أو تالف: لم تُعثر على بيانات الحزمة كاملة.');
    var body = text.slice(v + V0.length, e).replace(/\s+$/, '');
    if (body.charAt(body.length - 1) !== ';') throw new Error('الملف ناقص أو تالف: لم تُعثر على بيانات الحزمة كاملة.');
    var m = [null, body.slice(0, -1)];
    var pack, proto = 0;
    // 9.39.2: نعيد كتابة البيانات نصًا حرفيًا في JavaScript، وفيه يصير "__proto__" نموذجًا أوليًا خفيًا
    // يخفي بيانات عن التعقيم وعن بيان التوقيع. لا ينتجه التطبيق أبدًا، فوجوده دليل تعديل: نرفض الملف.
    try { pack = JSON.parse(m[1], function (k, v) { if (k === '__proto__') { proto++; return undefined; } return v; }); }
    catch (e) { throw new Error('بيانات الحزمة في الملف تالفة ولا يمكن قراءتها.'); }
    if (proto) throw new Error('هذا الملف معدَّل بطريقة غير صالحة ولا يمكن فتحه.\nاطلب من المرسل إعادة تصديره من التطبيق.');
    if (!pack || typeof pack !== 'object' || Array.isArray(pack)) throw new Error('بيانات الحزمة في الملف غير صالحة.');
    return pack;
  }

  function packLabel(pack) {
    var kind = KIND[pack.packageType] || KIND.student_fresh;
    var who = pack.studentName || pack.sourceGiftStudentName || pack.supervisorName || pack.sheikhName || '';
    return { kind: kind, who: String(who).slice(0, 60) };
  }

  /* 9.39.2: مرساة الثقة — مفاتيح المعلمين المسجَّلين في هذا التطبيق المثبَّت (لا في الملف المفتوح)
     9.39.11 (ق1-ب): ومفاتيح المشرفين (supervisors) لتوقيع المادة المرجعية، وبصمات المادة المدمجة في هذا الإصدار */
  var trustPromise = null;
  function validJwk(k) {
    return k && typeof k === 'object' && k.kty === 'EC' && k.crv === 'P-256' &&
      /^[A-Za-z0-9_-]{43}$/.test(String(k.x)) && /^[A-Za-z0-9_-]{43}$/.test(String(k.y));
  }
  function cleanKeys(a) {
    return (Array.isArray(a) ? a : []).filter(validJwk).map(function (k) { return { kty: 'EC', crv: 'P-256', x: k.x, y: k.y }; });
  }
  function getTrust() {
    if (!trustPromise) {
      trustPromise = fetch('./trusted-teachers.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (j) { return { keys: cleanKeys(j && j.keys), supervisors: cleanKeys(j && j.supervisors) }; })
        .catch(function () { return { keys: [], supervisors: [] }; });
    }
    return trustPromise;
  }
  function getPinned() { return getTrust().then(function (t) { return t.keys; }); }

  /* بصمة المادة المرجعية — مطابقة حرفيًا لـ canonJSON/refFieldsOf في التطبيق */
  var REF_KEYS = ['curriculum', 'masterAudios', 'sheikhName', 'sheikhPhoto', 'sheikhGender', 'supervisorName', 'supervisorPhoto', 'supervisorGender', 'poemReciterName', 'poemReciterPhoto', 'schoolName', 'schoolLogo', 'welcomeAudioNeutral', 'welcomeAudioMale', 'welcomeAudioFemale', 'journeyTitle', 'projectTitle', 'trackTitle', 'seriesTitle'];
  function canonJSON(v) {
    function c(x) {
      if (x === null || typeof x !== 'object') { var s = JSON.stringify(x); return s === undefined ? undefined : s; }
      if (Array.isArray(x)) return '[' + x.map(function (e) { var s = c(e); return s === undefined ? 'null' : s; }).join(',') + ']';
      var ks = Object.keys(x).sort(), out = [];
      for (var i = 0; i < ks.length; i++) { var s = c(x[ks[i]]); if (s !== undefined) out.push(JSON.stringify(ks[i]) + ':' + s); }
      return '{' + out.join(',') + '}';
    }
    return c(v);
  }
  function refDigest(pack) {
    var o = {};
    REF_KEYS.forEach(function (k) { if (pack && Object.prototype.hasOwnProperty.call(pack, k) && pack[k] !== undefined) o[k] = pack[k]; });
    return sha256b64(canonJSON(o));
  }
  var builtinPromise = null;
  function builtinRefDigests() {
    if (!builtinPromise) {
      var one = function (p) { return p.then(function (t) { return refDigest(extractPack(t)); }).catch(function () { return null; }); };
      builtinPromise = Promise.all([
        one(getTemplate()),
        one(fetch('./trial/index.html', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('trial'); return r.text(); }))
      ]).then(function (a) { return a.filter(Boolean); });
    }
    return builtinPromise;
  }
  function getSupervisorPin() {
    return Promise.all([getTrust(), builtinRefDigests()]).then(function (r) { return { keys: r[0].supervisors, refDigests: r[1] }; });
  }

  var PIN_RE = /var PINNED_TEACHER_KEYS = [^\n]*?; \/\* RIFAQ_PINNED_KEYS \*\//;
  var SUP_RE = /var PINNED_SUPERVISOR = [^\n]*?; \/\* RIFAQ_PINNED_SUPERVISOR \*\//;
  /* 9.39.3 (RT9392-01): مرساة الثقة تُحقن في القالب الموثوق قبل إدخال أي بيانات من الملف المفتوح،
     فلا يمكن لنص داخل البيانات أن يطابق موضع الحقن. القالب يجب أن يحوي كل موضع مرة واحدة بالضبط. */
  function pinTemplate(tpl) {
    return Promise.all([getPinned(), getSupervisorPin()]).then(function (r) {
      [[PIN_RE, 'template trust anchor'], [SUP_RE, 'template supervisor anchor']].forEach(function (p) {
        var n = (tpl.match(new RegExp(p[0].source, 'g')) || []).length;
        if (n !== 1) throw new Error(p[1] + ' slot count = ' + n);
      });
      var esc = function (v) { return JSON.stringify(v).replace(/<\//g, '<\\/'); };
      return tpl.replace(PIN_RE, function () { return 'var PINNED_TEACHER_KEYS = ' + esc(r[0]) + '; /* RIFAQ_PINNED_KEYS */'; })
        .replace(SUP_RE, function () { return 'var PINNED_SUPERVISOR = ' + esc(r[1]) + '; /* RIFAQ_PINNED_SUPERVISOR */'; });
    });
  }
  /* يعيد حساب تجزئة السكربت في CSP (بالطريقة نفسها التي يصدّر بها التطبيق) */
  function rehashCsp(html) {
    var a = html.indexOf('<script>'), b = html.lastIndexOf('</script>');
    if (a < 0 || b < a) return Promise.reject(new Error('template script not found'));
    return sha256b64(html.substring(a + 8, b)).then(function (h) {
      return html.replace(/script-src 'sha256-[A-Za-z0-9+\/=_-]+';/, "script-src 'sha256-" + h + "';");
    });
  }
  function trustedTemplate() { return getTemplate().then(pinTemplate); }

  /* 9.39.13 (D6): منهج الإصدار نفسه يُحقن في التطبيق حين يختلف منهج الملف عنه وفي القائمة مشرف مسجَّل،
     فيعرضه التطبيق بدل منهج غير موثّق (التطبيق يقرر بعد التحقق من التوقيع). */
  var BUILTIN_RE = /var BUILTIN_CURRICULUM = [^\n]*?; \/\* RIFAQ_BUILTIN_CURRICULUM \*\//;
  function scriptJson(v) {
    return JSON.stringify(v).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--')
      .replace(/[\u2028\u2029]/g, function (c) { return c === '\u2028' ? '\\u2028' : '\\u2029'; });
  }
  function withBuiltinCurriculum(tpl, pack) {
    return getTrust().then(function (t) {
      if (!t.supervisors.length || !BUILTIN_RE.test(tpl)) return tpl;
      var own;
      try { own = extractPack(tpl).curriculum; } catch (e) { return tpl; }
      if (!Array.isArray(own) || canonJSON(own) === canonJSON(pack && pack.curriculum)) return tpl;
      var j = scriptJson(own);
      return tpl.replace(BUILTIN_RE, function () { return 'var BUILTIN_CURRICULUM = ' + j + '; /* RIFAQ_BUILTIN_CURRICULUM */'; });
    });
  }
  /* يحقن البيانات في القالب (بعد تثبيت مرساة الثقة) */
  function buildHtml(pack) {
    return trustedTemplate().then(function (tpl) { return withBuiltinCurriculum(tpl, pack); }).then(function (tpl) {
      var json = scriptJson(pack);
      var html = tpl.replace(PACK_RE, function () {
        return '/* ===PACK_DATA_START=== */\nvar PACK_DATA = ' + json + ';\n/* ===PACK_DATA_END=== */';
      });
      return rehashCsp(html);
    });
  }

  /* ---------- العرض ---------- */
  function showPanel() {
    frame.hidden = true; loading.hidden = true; panel.hidden = false;
    setTitle('');
    renderRecent();
  }
  function showFrameUrl(url, title) {
    clearError();
    if (currentBlobUrl && currentBlobUrl !== url) { var old = currentBlobUrl; setTimeout(function () { URL.revokeObjectURL(old); }, 2000); }
    currentBlobUrl = url.indexOf('blob:') === 0 ? url : null;
    panel.hidden = true; loading.hidden = false; frame.hidden = false;
    setTitle(title);
    frame.src = url;
  }
  function showHtml(html, title) {
    var url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    showFrameUrl(url, title);
  }

  frame.addEventListener('load', function () {
    loading.hidden = true;
    var w = null;
    try { w = frame.contentWindow; } catch (e) { w = null; }
    if (w) patchDownloads(w);
  });

  function openBuiltin(which) {
    if (which === 'studio') { showFrameUrl('./studio/index.html', 'استوديو المشرف'); return; }
    if (which === 'trial') {
      loading.hidden = false; panel.hidden = true;
      fetch('./trial/index.html').then(function (r) { return r.text(); })
        .then(function (t) { return buildHtml(extractPack(t)); })
        .then(function (html) { showHtml(html, 'تجربة المرحلة الأولى'); })
        .catch(function (e) { showError('تعذّر فتح التجربة: ' + (e && e.message || e)); });
      return;
    }
    loading.hidden = false; panel.hidden = true;
    trustedTemplate().then(rehashCsp).then(function (html) { showHtml(html, 'تطبيق الطالب والمعلم'); })
      .catch(function (e) { showError('تعذّر فتح التطبيق: ' + (e && e.message || e)); });
  }

  /* يفتح نص ملف حزمة: استخراج ← حفظ في «الأخيرة» ← بناء من القالب ← عرض */
  function openText(name, text) {
    clearError();
    if (text && text.length > MAX_BYTES) { showError('الملف كبير جدًا (' + Math.round(text.length / 1048576) + ' ميغابايت).'); return Promise.resolve(); }
    var pack;
    try { pack = extractPack(text); } catch (e) { showError(e.message); return Promise.resolve(); }
    loading.hidden = false; panel.hidden = true;
    var lab = packLabel(pack);
    return saveRecent(name, pack).catch(function () { /* الحفظ اختياري */ })
      .then(function () { return buildHtml(pack); })
      .then(function (html) { showHtml(html, lab.kind + (lab.who ? ' — ' + lab.who : '')); })
      .catch(function (e) { showError('تعذّر فتح الملف: ' + (e && e.message || e)); });
  }

  function readFile(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) { showError('الملف كبير جدًا.'); return; }
    var r = new FileReader();
    r.onload = function () { openText(file.name, String(r.result)); };
    r.onerror = function () { showError('تعذّرت قراءة الملف.'); };
    r.readAsText(file, 'utf-8');
  }

  /* ---------- الملفات الأخيرة (IndexedDB على هذا الجهاز) ---------- */
  var DB = 'rifaq_host_v1', STORE = 'recent', MAX_RECENT = 12;
  // DECISION-003: تسجيلات الطلاب لا تبقى على جهاز المعلم أكثر من 30 يومًا؛ نسخ «الملفات الأخيرة» تُحذف تلقائيًا بعدها
  var RECENT_TTL_MS = 30 * 24 * 3600 * 1000;
  function db() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('no idb')); return; }
      var q = indexedDB.open(DB, 1);
      q.onupgradeneeded = function () { q.result.createObjectStore(STORE, { keyPath: 'id' }); };
      q.onsuccess = function () { res(q.result); };
      q.onerror = function () { rej(q.error); };
    });
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, mode), s = t.objectStore(STORE), out;
        out = fn(s);
        t.oncomplete = function () { d.close(); res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { d.close(); rej(t.error); };
      });
    });
  }
  function listRecent() {
    return tx('readonly', function (s) { return s.getAll(); }).then(function (all) {
      var now = Date.now(), keep = [], old = [];
      (all || []).forEach(function (r) { ((now - (r.firstAt || r.savedAt)) > RECENT_TTL_MS ? old : keep).push(r); });
      var done = old.length ? tx('readwrite', function (s) { old.forEach(function (r) { s.delete(r.id); }); }).catch(function () { }) : Promise.resolve();
      return done.then(function () { return keep.sort(function (a, b) { return b.savedAt - a.savedAt; }); });
    });
  }
  function saveRecent(name, pack) {
    var json = JSON.stringify(pack);
    return sha256hex(json).then(function (h) {
      var lab = packLabel(pack);
      var id = h.slice(0, 24);
      return getRecent(id).catch(function () { return null; }).then(function (prev) {
        var rec = { id: id, name: String(name || 'ملف').slice(0, 120), kind: lab.kind, who: lab.who, savedAt: Date.now(), firstAt: (prev && prev.firstAt) || Date.now(), size: json.length, json: json };
        return tx('readwrite', function (s) { s.put(rec); });
      }).then(function () {
        return listRecent().then(function (all) {
          var extra = all.slice(MAX_RECENT);
          if (!extra.length) return;
          return tx('readwrite', function (s) { extra.forEach(function (r) { s.delete(r.id); }); });
        });
      });
    });
  }
  /* 9.39.2: يستدعيه التطبيق عند «حذف بيانات الطالب» وعند «تم الحذف» لدى المعلم */
  function forgetPack(packageId, studentId) {
    return listRecent().then(function (all) {
      /* 9.39.3 (RT9392-04): هوية الطفل حاسمة. مع studentId تُحذف ملفاته هو وحده (في أي حزمة)، إضافةً إلى ملف الحزمة
         نفسها الذي لا يحمل هوية أي طفل. لا تتسع مطابقة الحزمة أبدًا إلى ملفات طفل آخر. */
      var gone = all.filter(function (r) {
        try {
          var p = JSON.parse(r.json), sid = p && p.studentId ? String(p.studentId) : '';
          if (studentId) return sid === String(studentId) || (!sid && !!packageId && p.packageId === packageId);
          return !sid && !!packageId && p.packageId === packageId;
        } catch (e) { return false; }
      });
      if (!gone.length) return 0;
      return tx('readwrite', function (s) { gone.forEach(function (r) { s.delete(r.id); }); }).then(function () { return gone.length; });
    }).catch(function () { return 0; });
  }
  function getRecent(id) { return tx('readonly', function (s) { return s.get(id); }); }
  function delRecent(id) { return tx('readwrite', function (s) { s.delete(id); }); }

  function renderRecent() {
    listRecent().then(function (all) {
      var ul = $('recent'); ul.innerHTML = '';
      $('recent-box').hidden = !all.length;
      all.forEach(function (r) {
        var li = document.createElement('li');
        var b = document.createElement('button'); b.type = 'button'; b.className = 'r-open';
        var n = document.createElement('span'); n.className = 'r-name'; n.textContent = r.kind + (r.who ? ' — ' + r.who : '');
        var m = document.createElement('span'); m.className = 'r-meta';
        var left = Math.max(1, Math.ceil(((r.firstAt || r.savedAt) + RECENT_TTL_MS - Date.now()) / 86400000));
        m.textContent = r.name + ' · ' + new Date(r.savedAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + Math.max(1, Math.round(r.size / 1024)) + ' ك.ب · يُحذف تلقائيًا بعد ' + left + ' يومًا';
        b.appendChild(n); b.appendChild(m);
        b.addEventListener('click', function () { openRecent(r.id); });
        var d = document.createElement('button'); d.type = 'button'; d.className = 'r-del'; d.textContent = 'حذف'; d.title = 'حذف من هذه القائمة';
        d.addEventListener('click', function () {
          if (!confirm('حذف هذه النسخة المحفوظة على هذا الجهاز (وفيها تسجيلات الطالب)؟\nلا يحذف تقدّم الطالب في التطبيق ولا الملف الأصلي الذي وصلك.')) return;
          delRecent(r.id).then(renderRecent);
        });
        li.appendChild(b); li.appendChild(d); ul.appendChild(li);
      });
    }).catch(function () { $('recent-box').hidden = true; });
  }
  function openRecent(id) {
    loading.hidden = false; panel.hidden = true;
    getRecent(id).then(function (r) {
      if (!r) throw new Error('غير موجود');
      var pack = JSON.parse(r.json);
      r.savedAt = Date.now();
      tx('readwrite', function (s) { s.put(r); }).catch(function () { });
      return buildHtml(pack).then(function (html) { showHtml(html, r.kind + (r.who ? ' — ' + r.who : '')); });
    }).catch(function (e) { showError('تعذّر فتح الملف المحفوظ: ' + (e && e.message || e)); });
  }

  /* ---------- أندرويد: اعتراض التنزيل داخل الإطار ---------- */
  function patchDownloads(win) {
    if (!IS_CAP) return; // الويب وويندوز: التنزيل يعمل أصلًا
    try {
      if (win.__rifaqPatched) return;
      win.__rifaqPatched = true;
      var blobs = new Map();
      var origCreate = win.URL.createObjectURL;
      win.URL.createObjectURL = function (obj) {
        var u = origCreate.call(win.URL, obj);
        try { if (obj && typeof obj.size === 'number' && typeof obj.slice === 'function') { blobs.set(u, obj); if (blobs.size > 30) blobs.delete(blobs.keys().next().value); } } catch (e) { }
        return u;
      };
      var origClick = win.HTMLAnchorElement.prototype.click;
      win.HTMLAnchorElement.prototype.click = function () {
        var name = this.getAttribute('download'), href = this.href || '';
        if (name !== null && (href.indexOf('blob:') === 0 || href.indexOf('data:') === 0)) {
          var b = blobs.get(href);
          var p = b ? Promise.resolve(b) : fetch(href).then(function (r) { return r.blob(); });
          p.then(function (blob) { return nativeSave(blob, name || 'ملف'); })
            .catch(function (e) { toast('تعذّر حفظ الملف: ' + (e && e.message || e), 6000); });
          return;
        }
        return origClick.apply(this, arguments);
      };
    } catch (e) { console.warn('download patch failed', e); }
  }

  function nativeSave(blob, name) {
    var safe = String(name).replace(/[\\/:*?"<>|]/g, '_') || 'ملف';
    toast('⏳ جارٍ تجهيز الملف…', 20000);
    // 9.39.2: لا نسخ في التخزين العام (المستندات): ملفات الإرسال فيها تسجيلات الأطفال وبيانات الموافقة،
    // وتبقى بعد إزالة التطبيق ويقرؤها أي تطبيق آخر. نكتب في الذاكرة المؤقتة الخاصة بالتطبيق فقط،
    // في مجلد فريد لكل تصدير (فلا يكتب ملف فوق آخر بالاسم نفسه)، ونمسحها عند كل تشغيل.
    return blobToBase64(blob).then(function (data) {
      var dir = 'share/' + Date.now().toString(36);
      return CAP.nativePromise('Filesystem', 'writeFile', { path: dir + '/' + safe, data: data, directory: 'CACHE', recursive: true })
        .then(function (res) {
          toast('✅ الملف جاهز. اختر: واتساب أو Drive، أو «حفظ في الملفات» للاحتفاظ بنسخة.', 6000);
          return CAP.nativePromise('Share', 'share', { title: safe, dialogTitle: 'إرسال الملف أو حفظه', files: [res.uri] })
            .catch(function (e) { if (!/cancel/i.test(String(e && (e.message || e)))) throw e; });
        });
    });
  }

  /* أندرويد: «فتح باستخدام رفاق التحفة» من واتساب أو مدير الملفات */
  function openUri(uri) {
    if (!uri || !/^(content|file):/i.test(uri)) return;
    loading.hidden = false; panel.hidden = true;
    CAP.nativePromise('Filesystem', 'readFile', { path: uri, encoding: 'utf8' }).then(function (r) {
      var name = String(uri).split('/').pop() || 'ملف';
      try { name = decodeURIComponent(name); } catch (e) { /* اسم فيه % غير مرمَّز: نتركه كما هو */ }
      return openText(name, r && r.data);
    }).catch(function (e) { showError('تعذّرت قراءة الملف الذي فُتح: ' + (e && e.message || e)); });
  }
  if (IS_CAP) {
    CAP.nativePromise('Filesystem', 'rmdir', { path: 'share', directory: 'CACHE', recursive: true }).catch(function () { });
    try {
      CAP.nativeCallback('App', 'addListener', { eventName: 'appUrlOpen' }, function (res) { if (res && res.url) openUri(res.url); });
      CAP.nativePromise('App', 'getLaunchUrl', {}).then(function (r) { if (r && r.url) openUri(r.url); }, function () { });
    } catch (e) { console.warn('open-with unavailable', e); }
  }

  /* ويندوز: ملف مُمرَّر من سطر الأوامر أو «فتح باستخدام» */
  if (NATIVE && typeof NATIVE.onOpenFile === 'function') {
    NATIVE.onOpenFile(function (d) { if (d && typeof d.text === 'string') openText(d.name, d.text); });
  }

  /* ---------- الأحداث ---------- */
  $('clear-recent').addEventListener('click', function () {
    if (!confirm('حذف كل النسخ المحفوظة (وفيها تسجيلات الطلاب) من هذا الجهاز؟\nلا يحذف تقدّم الطلاب في التطبيق ولا الملفات الأصلية.')) return;
    listRecent().then(function (all) { return tx('readwrite', function (s) { all.forEach(function (r) { s.delete(r.id); }); }); }).then(renderRecent);
  });

  var input = $('file-in');
  input.addEventListener('change', function () { var f = input.files && input.files[0]; input.value = ''; readFile(f); });
  $('pick-btn').addEventListener('click', function () { input.click(); });
  $('open-btn').addEventListener('click', function () { if (!frame.hidden) { showPanel(); } input.click(); });

  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  document.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readFile(f); });

  /* ---------- البدء ---------- */
  var params = new URLSearchParams(location.search);
  var src = params.get('src');
  if (src === 'app' || src === 'studio' || src === 'trial') openBuiltin(src);
  else showPanel();
  if (NATIVE && typeof NATIVE.ready === 'function') NATIVE.ready();

  /* 9.39.12: تنبيه آيفون — الملف المفتوح من واتساب يُعرض معاينة لا تعمل، وSafari يمحو التخزين بعد أسبوع دون استعمال */
  try {
    var iosDev = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var iosStandalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    var iosNote = document.getElementById('ios-note');
    if (iosNote && iosDev && !iosStandalone && !window.Capacitor && !window.rifaqNative) iosNote.hidden = false;
  } catch (e) {}

  window.RIFAQ_HOST = { openText: openText, buildHtml: buildHtml, extractPack: extractPack, forgetPack: forgetPack };
})();
