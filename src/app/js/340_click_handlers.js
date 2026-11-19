/* ===== 9.20: معالجات النقر دون سمات onclick (متوافق مع CSP بلا unsafe-inline للسكربت) =====
   كل زر يحمل data-call="[اسم, وسيط, ...]". المُرسِل يحدد الدالة بالاسم، والمُنفِّذ يتحقق من أنها دالة معروفة. */
function ACT(name){ var args = Array.prototype.slice.call(arguments, 1); var payload = JSON.stringify([name].concat(args)); return ' data-call="' + String(payload).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '"'; }
function clickById(id){ var el = document.getElementById(id); if (el) el.click(); }
var CALLABLE_ALLOW = ["showGiftContents", "toggleOtherRule", "playVerse", "stopVerse", "answer", "applyNoteCode", "cancelTeacherFeedback", "clickById", "closeCertificate", "closePreview", "confirmTeacherRejection", "continueFromSplash", "deleteStudentRec", "doDownloadPreview", "doSharePreview", "downloadCertificate", "editProfile", "exportApprovedPack", "exportReturnedPack", "goHome", "handleReviewTeacherPhoto", "handleSetupPhoto", "markRosterDeleted", "nextFromResults", "openGuardianSettings", "openRoster", "openSection", "playStudentRec", "printCertificate", "saveSetup", "setRating", "setReview", "setReplyChannel", "setSetupGender", "shareCertificate", "showCertificate", "showExportDialog", "showProfile", "showReset", "startFinalExam", "startNewStudent", "startQuiz", "startRec", "startRetest", "startReviewSession", "toggleTeacherFeedbackRecording", "uploadReplacementAudio"]; /* 9.39: قائمة الدوال التي يجوز استدعاؤها من data-call/data-change */
document.addEventListener('click', function(ev){
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-call]') : null;
  if (!el) return;
  var spec; try { spec = JSON.parse(el.getAttribute('data-call')); } catch(e){ return; }
  if (!Array.isArray(spec) || typeof spec[0] !== 'string') return;
  var fn = window[spec[0]];
  if (CALLABLE_ALLOW && CALLABLE_ALLOW.indexOf(spec[0]) < 0){ console.warn('action not allowed', spec[0]); return; }
  if (typeof fn !== 'function' || !/^[A-Za-z_]\w*$/.test(spec[0])) { console.warn('unknown action', spec[0]); return; }
  fn.apply(null, spec.slice(1));
});

/* 9.20: أحداث التغيير (اختيار الملفات) بالمنطق نفسه؛ تمرَّر الحدث دائمًا */
document.addEventListener('change', function(ev){
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-change]') : null;
  if (!el) return;
  var name = el.getAttribute('data-change'); var fn = window[name];
  if (CALLABLE_ALLOW && CALLABLE_ALLOW.indexOf(name) < 0) return;
  if (typeof fn !== 'function' || !/^[A-Za-z_]\w*$/.test(name)) return;
  var arg = el.getAttribute('data-change-arg');
  if (arg !== null) fn.call(null, ev, arg); else fn.call(null, ev);
});

/* 9.20: CSP بلا unsafe-inline للسكربت: التجزئة تُحسب من نص السكربت الفعلي في الملف المُصدَّر */
async function cspWithScriptHash(html){
  var a = html.indexOf('<script>'), b = html.lastIndexOf('<\/script>');
  if (a < 0 || b < a) return html;
  var body = html.substring(a + 8, b);
  var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  var h = b64FromBytes(new Uint8Array(digest));
  return html.replace(/script-src 'sha256-[A-Za-z0-9+\/=_-]+';/, "script-src 'sha256-" + h + "';");
}

/* 9.20: الصوت والصور لا تدخل HTML كنص أبدًا: تُسجَّل القيمة المُتحقَّق منها في سجل داخلي،
   ويحمل العنصر مرجعًا فقط (data-media)، ثم يُنشأ الرابط عبر DOM بعد الإدراج. */
var MEDIA_REG = {}; var MEDIA_SEQ = 0;
function mediaRef(kind, v){
  var val = kind === 'aud' ? audSrc(v) : imgSrc(v);
  if (!val) return '';
  var key = 'm' + (++MEDIA_SEQ); MEDIA_REG[key] = val; return key;
}
function hydrateMedia(root){
  if (!root || !root.querySelectorAll) return;
  applyDataStyles(root);
  var list = root.matches && root.matches('[data-media]') ? [root] : [];
  Array.prototype.forEach.call(root.querySelectorAll('[data-media]'), function(el){ list.push(el); });
  list.forEach(function(el){
    var key = el.getAttribute('data-media'); el.removeAttribute('data-media');
    var val = MEDIA_REG[key]; if (!val) return;
    if (el.tagName === 'AUDIO' && !AUD_DATA_RE.test(val)) return;
    if (el.tagName === 'IMG' && !IMG_DATA_RE.test(val)) return;
    el.src = val;
  });
}

/* 9.21: الأنماط المضمّنة في HTML مُمنوعة بسياسة CSP، فتُكتب في data-style وتُطبَّق عبر CSSOM بعد التحقق */
var STYLE_BAD_RE = /url\(|expression\(|@import|javascript:|[<>\\]/i;
function applyDataStyles(root){
  if (!root || !root.querySelectorAll) return;
  var list = root.matches && root.matches('[data-style]') ? [root] : [];
  Array.prototype.forEach.call(root.querySelectorAll('[data-style]'), function(el){ list.push(el); });
  list.forEach(function(el){
    var v = el.getAttribute('data-style') || ''; el.removeAttribute('data-style');
    if (STYLE_BAD_RE.test(v)) return;
    el.style.cssText = v;
  });
}
