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
    var m = PACK_RE.exec(text);
    if (!m) throw new Error('الملف ناقص أو تالف: لم تُعثر على بيانات الحزمة كاملة.');
    var pack;
    try { pack = JSON.parse(m[1]); } catch (e) { throw new Error('بيانات الحزمة في الملف تالفة ولا يمكن قراءتها.'); }
    if (!pack || typeof pack !== 'object' || Array.isArray(pack)) throw new Error('بيانات الحزمة في الملف غير صالحة.');
    return pack;
  }

  function packLabel(pack) {
    var kind = KIND[pack.packageType] || KIND.student_fresh;
    var who = pack.studentName || pack.sourceGiftStudentName || pack.supervisorName || pack.sheikhName || '';
    return { kind: kind, who: String(who).slice(0, 60) };
  }

  /* يحقن البيانات في القالب ويعيد حساب تجزئة السكربت في CSP (بالطريقة نفسها التي يصدّر بها التطبيق) */
  function buildHtml(pack) {
    return getTemplate().then(function (tpl) {
      var json = JSON.stringify(pack).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--')
        .replace(/[\u2028\u2029]/g, function (c) { return c === '\u2028' ? '\\u2028' : '\\u2029'; });
      var html = tpl.replace(PACK_RE, function () {
        return '/* ===PACK_DATA_START=== */\nvar PACK_DATA = ' + json + ';\n/* ===PACK_DATA_END=== */';
      });
      var a = html.indexOf('<script>'), b = html.lastIndexOf('</script>');
      if (a < 0 || b < a) throw new Error('template script not found');
      return sha256b64(html.substring(a + 8, b)).then(function (h) {
        return html.replace(/script-src 'sha256-[A-Za-z0-9+\/=_-]+';/, "script-src 'sha256-" + h + "';");
      });
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
    getTemplate().then(function (tpl) { showHtml(tpl, 'تطبيق الطالب والمعلم'); })
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
      return (all || []).sort(function (a, b) { return b.savedAt - a.savedAt; });
    });
  }
  function saveRecent(name, pack) {
    var json = JSON.stringify(pack);
    return sha256hex(json).then(function (h) {
      var lab = packLabel(pack);
      var rec = { id: h.slice(0, 24), name: String(name || 'ملف').slice(0, 120), kind: lab.kind, who: lab.who, savedAt: Date.now(), size: json.length, json: json };
      return tx('readwrite', function (s) { s.put(rec); }).then(function () {
        return listRecent().then(function (all) {
          var extra = all.slice(MAX_RECENT);
          if (!extra.length) return;
          return tx('readwrite', function (s) { extra.forEach(function (r) { s.delete(r.id); }); });
        });
      });
    });
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
        m.textContent = r.name + ' · ' + new Date(r.savedAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + Math.max(1, Math.round(r.size / 1024)) + ' ك.ب';
        b.appendChild(n); b.appendChild(m);
        b.addEventListener('click', function () { openRecent(r.id); });
        var d = document.createElement('button'); d.type = 'button'; d.className = 'r-del'; d.textContent = 'حذف'; d.title = 'حذف من هذه القائمة';
        d.addEventListener('click', function () {
          if (!confirm('حذف هذا الملف من قائمة الملفات الأخيرة على هذا الجهاز؟\n(لا يحذف تقدّم الطالب ولا الملف الأصلي)')) return;
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
    return blobToBase64(blob).then(function (data) {
      var savedCopy = CAP.nativePromise('Filesystem', 'writeFile', { path: 'RifaqAlTuhfa/' + safe, data: data, directory: 'DOCUMENTS', recursive: true })
        .then(function () { return true; }, function () { return false; });
      return savedCopy.then(function (ok) {
        return CAP.nativePromise('Filesystem', 'writeFile', { path: 'share/' + safe, data: data, directory: 'CACHE', recursive: true })
          .then(function (res) {
            toast(ok ? '✅ حُفظت نسخة في: المستندات / RifaqAlTuhfa\nاختر الآن طريقة الإرسال.' : '✅ الملف جاهز. اختر طريقة الإرسال أو الحفظ.', 6000);
            return CAP.nativePromise('Share', 'share', { title: safe, dialogTitle: 'إرسال الملف أو حفظه', files: [res.uri] })
              .catch(function (e) { if (!/cancel/i.test(String(e && (e.message || e)))) throw e; });
          });
      });
    });
  }

  /* أندرويد: «فتح باستخدام رفاق التحفة» من واتساب أو مدير الملفات */
  function openUri(uri) {
    if (!uri || !/^(content|file):/i.test(uri)) return;
    loading.hidden = false; panel.hidden = true;
    CAP.nativePromise('Filesystem', 'readFile', { path: uri, encoding: 'utf8' }).then(function (r) {
      var name = decodeURIComponent(String(uri).split('/').pop() || 'ملف');
      return openText(name, r && r.data);
    }).catch(function (e) { showError('تعذّرت قراءة الملف الذي فُتح: ' + (e && e.message || e)); });
  }
  if (IS_CAP) {
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

  window.RIFAQ_HOST = { openText: openText, buildHtml: buildHtml, extractPack: extractPack }; // للاختبار
})();
