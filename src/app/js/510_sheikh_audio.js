/* ===== 9.36: تلاوة الشيخ لكل سؤال قرآني (إن سجّلها الشيخ في الاستوديو) ===== */
function addSheikhAudioToQuestion(){
  var q = CURRENT.section && CURRENT.section.questions && CURRENT.section.questions[CURRENT.qIdx];
  if (!q || !PACK_DATA.masterAudios) return;
  var src = PACK_DATA.masterAudios[q.id];
  if (!src) return;
  var ref = mediaRef('aud', src); if (!ref) return;
  var host = document.getElementById('question-text'); if (!host || document.getElementById('sheikh-q-audio')) return;
  var box = document.createElement('div'); box.id = 'sheikh-q-audio'; box.style.cssText = 'margin:6px 0';
  var lab = document.createElement('div'); lab.style.cssText = 'font-size:.85rem;color:#555'; lab.textContent = '🎧 استمع إلى تلاوة الشيخ ثم أجب:';
  var au = document.createElement('audio'); au.controls = true; au.setAttribute('data-media', ref); au.preload = 'none';
  box.appendChild(lab); box.appendChild(au); host.appendChild(box);
}

/* 9.39.11 (ق5-أ): بوابة ولي الأمر — مسألة ضرب (عدد من رقمين × رقم واحد) قبل الإعدادات أو الحذف.
   لا تُحفظ نتيجة البوابة: كل فتح جديد يحتاج مسألة جديدة. ثلاث محاولات خاطئة توقف البوابة 30 ثانية. */
/* 9.39.13 (D7): البوابة تسأل عن رمز ولي الأمر إن وُضع. المسألة الحسابية تبقى لجهاز بلا رمز (قبل الموافقة)،
   ولاستعادة رمز منسي بعد انتظار 60 ثانية، ثم يُطلب رمز جديد. والجهاز الموافَق عليه قبل 9.39.13 يضع رمزه بعد أول بوابة. */







/* 9.39.10: زرّا «إعادة المفاهيم المخفقة» و«جلسة المراجعة» يظهران فقط حين يوجد ما يُعاد أو يُراجَع (كانا ينتهيان بتنبيه «لا يوجد») */


 // ليس درجة: ضجيج أو صمت أو انقطاع، ويُطلب إعادة التسجيل
