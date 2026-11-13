/* صفحة الإطلاق: تسجيل عامل الخدمة (للعمل دون إنترنت) وزر التثبيت. */
(function () {
  'use strict';

  var RIFAQ_CHANNEL = 'main'; /* RIFAQ_CHANNEL */
  /* 9.39.14 (D8): في النسخة التجريبية تنبيه ظاهر بأنها تجريبية، وأن تقدّم الطفل فيها منفصل عن الموقع الرئيسي */
  if (RIFAQ_CHANNEL === 'beta') {
    var bn = document.getElementById('beta-note'); if (bn) bn.hidden = false;
    document.documentElement.classList.add('beta');
  }
  var status = document.getElementById('sw-status');
  function say(msg) {
    if (!status) return;
    status.textContent = msg;
    status.hidden = false;
  }

  /* 0) داخل تطبيق أندرويد: كل شيء يمر عبر الصفحة المضيفة (open.html)
        لأنها تعالج حفظ الملفات وفتحها، ولا حاجة لعامل الخدمة ولا لزر التثبيت. */
  var CAP = window.Capacitor;
  var NATIVE = !!(window.rifaqNative || (CAP && typeof CAP.isNativePlatform === 'function' && CAP.isNativePlatform()));
  if (NATIVE) {
    document.documentElement.classList.add('native');
    Array.prototype.forEach.call(document.querySelectorAll('a[data-src]'), function (a) {
      a.setAttribute('href', './open.html?src=' + a.getAttribute('data-src'));
    });
    var ib = document.getElementById('install-box'); if (ib) ib.remove();
    Array.prototype.forEach.call(document.querySelectorAll('.web-only'), function (el) { el.remove(); });
    return;
  }

  /* 1) عامل الخدمة: نطاقه الجذر، فيغطي /app/ و/studio/ و/trial/ أيضًا. */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).then(
        function (reg) {
          if (navigator.serviceWorker.controller) {
            say('✅ جاهز للعمل دون إنترنت.');
          } else {
            say('⏳ يجري تحضير النسخة التي تعمل دون إنترنت…');
            if (reg.installing) {
              reg.installing.addEventListener('statechange', function () {
                if (this.state === 'activated') say('✅ جاهز للعمل دون إنترنت.');
              });
            }
          }
        },
        function () { say('تعذّر تحضير العمل دون إنترنت؛ التطبيق يعمل مع الاتصال.'); }
      );
    });
  }

  /* 2) زر التثبيت (أندرويد/ويندوز/كروم). */
  var deferred = null;
  var box = document.getElementById('install-box');
  var btn = document.getElementById('install-btn');

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (box) box.hidden = false;
  });

  if (btn) {
    btn.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function (c) {
        if (c && c.outcome === 'accepted') { if (box) box.hidden = true; }
        deferred = null;
      });
    });
  }

  window.addEventListener('appinstalled', function () {
    if (box) box.hidden = true;
    say('✅ تم تثبيت التطبيق على جهازك.');
  });

  /* 3) على iPhone/iPad لا يوجد beforeinstallprompt: نشرح الطريقة اليدوية. */
  /* 9.39.12: iPadOS يعرّف نفسه «Macintosh» مع شاشة لمس */
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
                   navigator.standalone === true;
  if (isIOS && !standalone && box) {
    box.hidden = false;
    var t = box.querySelector('.notice-t');
    var p = box.querySelector('p');
    if (t) t.textContent = '📲 للتثبيت على iPhone / iPad';
    if (p) p.textContent = 'من شريط Safari: زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية». هذا ضروري: بدونه قد يمحو Safari تقدّم الطفل وتسجيلاته بعد أسبوع دون استعمال. ولفتح ملف وصلك استعمل «فتح ملف وصلك» هنا، لا واتساب مباشرة.';
    if (btn) btn.hidden = true;
  }
})();
