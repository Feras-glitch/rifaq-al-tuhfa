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
var _renderQuestionBase = renderQuestion;
renderQuestion = function(){
  var r = _renderQuestionBase.apply(this, arguments);
  try { addSheikhAudioToQuestion(); } catch(e){}
  return r;
};

/* 9.39.11 (ق5-أ): بوابة ولي الأمر — مسألة ضرب (عدد من رقمين × رقم واحد) قبل الإعدادات أو الحذف.
   لا تُحفظ نتيجة البوابة: كل فتح جديد يحتاج مسألة جديدة. ثلاث محاولات خاطئة توقف البوابة 30 ثانية. */
function toLatinDigits(s){ return String(s || '').replace(/[٠-٩]/g, function(d){ return String(d.charCodeAt(0) - 0x0660); }).replace(/[۰-۹]/g, function(d){ return String(d.charCodeAt(0) - 0x06F0); }).replace(/\s+/g, ''); }
/* 9.39.13 (D7): البوابة تسأل عن رمز ولي الأمر إن وُضع. المسألة الحسابية تبقى لجهاز بلا رمز (قبل الموافقة)،
   ولاستعادة رمز منسي بعد انتظار 60 ثانية، ثم يُطلب رمز جديد. والجهاز الموافَق عليه قبل 9.39.13 يضع رمزه بعد أول بوابة. */
function parentalGate(onPass, purpose){
  if (guardianPinSet()){ pinGate(onPass, purpose); return; }
  arithmeticGate(function(){ if (hasConsent()) pinSetupDialog(onPass, 'ضع رمزًا من 4 أرقام لولي الأمر. سيُطلب بدل المسألة الحسابية من الآن.'); else onPass(); }, purpose);
}
function arithmeticGate(onPass, purpose, waitSec){
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
  if (waitSec > 0){ // 9.39.13 (D7): استعادة الرمز المنسي حاجز صبر لا يحتمله طفل
    ok.disabled = true; inp.disabled = true; var left = waitSec;
    var tick = function(){ if (!document.body.contains(ov)) return; if (left <= 0){ ok.disabled = false; inp.disabled = false; msg.textContent = ''; try { inp.focus(); } catch(e){} return; } msg.textContent = '⏳ انتظر ' + left + ' ثانية ثم اكتب الناتج.'; left--; setTimeout(tick, 1000); };
    tick();
  }
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
function guardianPinSet(){ var p = STATE.student && STATE.student.guardianPin; return !!(p && typeof p.h === 'string' && typeof p.s === 'string'); }
function guardianPinProblem(a, b){
  a = toLatinDigits(a); b = toLatinDigits(b);
  if (!/^[0-9]{4}$/.test(a)) return 'رمز ولي الأمر أربعة أرقام.';
  if (a !== b) return 'الرمزان غير متطابقين.';
  if (/^(\d)\1{3}$/.test(a) || '0123456789'.indexOf(a) >= 0 || '9876543210'.indexOf(a) >= 0) return 'اختر رمزًا لا يسهل تخمينه (لا 1111 ولا 1234).';
  return '';
}
async function guardianPinHash(pin, salt){ return sha256b64('rifaq-guardian-pin|' + salt + '|' + toLatinDigits(pin)); }
async function setGuardianPin(pin){
  var u = new Uint8Array(16); crypto.getRandomValues(u); var salt = b64FromBytes(u);
  STATE.student = STATE.student || {};
  STATE.student.guardianPin = {s: salt, h: await guardianPinHash(pin, salt), at: new Date().toISOString()};
  save();
}
function gateShell(title, text){
  var old = document.getElementById('parent-gate'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'parent-gate';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:380px;width:100%;padding:18px;text-align:center;line-height:1.8';
  var h = document.createElement('h3'); h.style.cssText = 'margin:0 0 6px'; h.textContent = title;
  var p = document.createElement('p'); p.style.cssText = 'margin:0 0 8px'; p.textContent = text;
  card.appendChild(h); card.appendChild(p); ov.appendChild(card); document.body.appendChild(ov);
  return {ov: ov, card: card};
}
function pinInput(id, ph){
  var i = document.createElement('input'); i.id = id; i.type = 'password'; i.setAttribute('inputmode', 'numeric'); i.setAttribute('autocomplete', 'off'); i.maxLength = 4; i.placeholder = ph || '••••';
  i.style.cssText = 'width:130px;font-size:1.4rem;letter-spacing:.4em;text-align:center;padding:8px;border:2px solid #cfd8dc;border-radius:12px;direction:ltr;margin:4px';
  return i;
}
function pinGate(onPass, purpose){
  var g = gateShell('🔒 لولي الأمر فقط', (purpose || 'هذه الإعدادات لولي الأمر.') + ' اكتب رمز ولي الأمر:');
  var inp = pinInput('parent-gate-pin'); g.card.appendChild(inp);
  var msg = document.createElement('div'); msg.id = 'parent-gate-msg'; msg.style.cssText = 'min-height:1.6em;color:#b3261e;font-size:.9rem;margin:6px 0'; g.card.appendChild(msg);
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
  var ok = document.createElement('button'); ok.type = 'button'; ok.id = 'parent-gate-ok'; ok.className = 'btn primary'; ok.textContent = 'متابعة';
  var cancel = document.createElement('button'); cancel.type = 'button'; cancel.id = 'parent-gate-cancel'; cancel.className = 'btn ghost'; cancel.textContent = 'إلغاء';
  row.appendChild(ok); row.appendChild(cancel); g.card.appendChild(row);
  var forgot = document.createElement('button'); forgot.type = 'button'; forgot.id = 'parent-gate-forgot'; forgot.className = 'btn ghost'; forgot.textContent = 'نسيت الرمز؟';
  forgot.style.cssText = 'margin-top:8px;font-size:.85rem'; g.card.appendChild(forgot);
  var tries = 0;
  async function check(){
    if (ok.disabled) return;
    var p = STATE.student.guardianPin, v = toLatinDigits(inp.value);
    if (/^[0-9]{4}$/.test(v) && await guardianPinHash(v, p.s) === p.h){ g.ov.remove(); onPass(); return; }
    tries++; inp.value = '';
    if (tries >= 3){
      ok.disabled = true; inp.disabled = true; msg.textContent = 'محاولات كثيرة. انتظر 30 ثانية.';
      setTimeout(function(){ if (!document.body.contains(g.ov)) return; ok.disabled = false; inp.disabled = false; tries = 0; msg.textContent = ''; }, 30000);
      return;
    }
    msg.textContent = 'الرمز غير صحيح.';
  }
  ok.onclick = check;
  cancel.onclick = function(){ g.ov.remove(); };
  forgot.onclick = function(){ g.ov.remove(); arithmeticGate(function(){ pinSetupDialog(onPass, 'ضع رمزًا جديدًا لولي الأمر (4 أرقام).'); }, 'استعادة رمز ولي الأمر.', 60); };
  inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') check(); });
  try { inp.focus(); } catch(e){}
}
function pinSetupDialog(onDone, text){
  var g = gateShell('🔑 رمز ولي الأمر', text || 'ضع رمزًا من 4 أرقام.');
  var a = pinInput('pin-new', 'الرمز'), b = pinInput('pin-new2', 'أعده'); g.card.appendChild(a); g.card.appendChild(b);
  var msg = document.createElement('div'); msg.id = 'pin-new-msg'; msg.style.cssText = 'min-height:1.6em;color:#b3261e;font-size:.9rem;margin:6px 0'; g.card.appendChild(msg);
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
  var ok = document.createElement('button'); ok.type = 'button'; ok.id = 'pin-new-ok'; ok.className = 'btn success'; ok.textContent = 'حفظ الرمز';
  var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn ghost'; cancel.textContent = 'إلغاء';
  row.appendChild(ok); row.appendChild(cancel); g.card.appendChild(row);
  ok.onclick = async function(){
    var e = guardianPinProblem(a.value, b.value); if (e){ msg.textContent = e; return; }
    ok.disabled = true;
    try { await setGuardianPin(a.value); } catch(x){ ok.disabled = false; msg.textContent = 'تعذّر حفظ الرمز.'; return; }
    g.ov.remove(); toast('🔑 حُفظ رمز ولي الأمر.'); onDone();
  };
  cancel.onclick = function(){ g.ov.remove(); };
  try { a.focus(); } catch(e){}
}
function openGuardianSettings(){ parentalGate(openGuardianSettingsInner); }
function openGuardianSettingsInner(){
  var c = STATE.student && STATE.student.consent;
  var hasC = !!(c && c.v === CONSENT_VERSION);
  var ov = document.createElement('div');
  ov.id = 'guardian-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  if (!hasC){
    var card0 = document.createElement('div');
    card0.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:440px;width:100%;padding:18px;font-size:1rem;line-height:1.8';
    card0.innerHTML = '<h3 data-style="margin:0 0 8px">⚙️ إعدادات ولي الأمر</h3><p>لا توجد موافقة مسجّلة على هذا الجهاز بعد؛ تُطلب عند أول تسجيل صوتي.</p>' +
      '<p data-style="font-size:.85rem"><b>التصفير:</b> يحذف تقدّم الطالب وبياناته من هذا الجهاز.</p>' +
      '<button type="button" id="gs-delete" class="btn" data-style="background:#b3261e;color:#fff">🔄 تصفير: حذف بيانات الطالب من هذا الجهاز</button>' +
      '<div data-style="display:flex;justify-content:flex-end;margin-top:10px"><button type="button" id="gs-close" class="btn">إغلاق</button></div>';
    ov.appendChild(card0); document.body.appendChild(ov);
    guardianExtras(card0, ov); // 9.39.13 (D12، D7)
    $('gs-close').onclick = function(){ ov.remove(); };
    $('gs-delete').onclick = function(){ ov.remove(); deleteChildDataOnDevice(); };
    return;
  }
  var rows = Object.keys(STATE.studentAudios || {}).filter(function(k){ return STATE.studentAudios[k] && STATE.studentAudios[k].status !== undefined; }).map(function(k){
    var ex = !!(c.excludedRecordings && c.excludedRecordings[k]);
    return '<label data-style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" class="gs-rec" data-id="'+k+'" '+(ex?'':'checked')+'> شارِك تسجيل: '+escapeHTML(itemLabelById(k))+'</label>';
  }).join('') || '<p>لا توجد تسجيلات بعد.</p>';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:440px;width:100%;padding:18px;font-size:1rem;line-height:1.8;max-height:92vh;overflow:auto';
  card.innerHTML = '<h3 data-style="margin:0 0 8px">⚙️ إعدادات ولي الأمر</h3>' +
    '<label data-style="display:flex;gap:8px;align-items:center;margin:10px 0"><input id="gs-share" type="checkbox" '+(c.permissions && c.permissions.shareWithPeers ? 'checked' : '')+'> <b>السماح بمشاركة التسجيلات المعتمدة مع زملاء</b></label>' +
    '<p data-style="margin:6px 0">يمكنك استبعاد أي تسجيل بعينه:</p>' + rows +
    '<p data-style="font-size:.85rem;color:#555">تطبيق الإعدادات على الحزم المصدَّرة من الآن. الملفات التي نُسخت سابقًا لا تُسترجع.</p>' +
    '<hr><p data-style="font-size:.85rem"><b>حذف البيانات:</b> يحذف تسجيلات الطفل وتقدمه وموافقته من هذا الجهاز. لا يحذف ملف الحزمة المحفوظ ولا ما أُرسل إلى المعلم أو الزملاء.</p>' +
    '<button type="button" id="gs-summary" class="btn">📄 ملخص لولي الأمر</button> ' +
    '<button type="button" id="gs-report" class="btn">🖨️ تقرير للطباعة</button> ' +
    '<button type="button" id="gs-archive" class="btn">💾 تصدير ذكرى العائلة</button> ' +
    '<button type="button" id="gs-delete" class="btn" data-style="background:#b3261e;color:#fff">🔄 تصفير: حذف بيانات الطالب من هذا الجهاز</button>' +
    '<div data-style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button type="button" id="gs-close" class="btn">إغلاق</button><button type="button" id="gs-save" class="btn success">حفظ</button></div>';
  ov.appendChild(card); document.body.appendChild(ov);
  guardianExtras(card, ov); // 9.39.13 (D12، D7)
  $('gs-close').onclick = function(){ ov.remove(); };
  $('gs-delete').onclick = function(){ deleteChildDataOnDevice(); };
  $('gs-summary').onclick = function(){ showParentSummary(); };
  $('gs-archive').onclick = function(){ exportFamilyArchive(); };
  $('gs-report').onclick = function(){ showPrintableReport(); };
  $('gs-save').onclick = function(){
    var ex = {};
    Array.prototype.forEach.call(document.querySelectorAll('.gs-rec'), function(cb){ if (!cb.checked) ex[cb.getAttribute('data-id')] = true; });
    c.permissions = c.permissions || {record: true, review: true};
    c.permissions.shareWithPeers = !!$('gs-share').checked;
    c.excludedRecordings = ex;
    save(); ov.remove(); alert('تم حفظ الإعدادات.');
  };
}
/* مؤشر مستوى الصوت + تنبيه الصمت */
function startLevelMeter(stream, onSilence){
  var box = document.createElement('div');
  box.id = 'rec-meter';
  box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9998;background:#263238;color:#fff;border-radius:14px;padding:10px 12px;font-size:.95rem';
  box.innerHTML = '<div id="rec-meter-msg">🎙️ يتم التسجيل…</div><div data-style="height:10px;background:#455a64;border-radius:6px;margin-top:6px;overflow:hidden"><div id="rec-meter-bar" data-style="height:100%;width:0;background:#66bb6a;transition:width .08s"></div></div>';
  document.body.appendChild(box);
  var ctx = null, raf = 0, quietSince = Date.now(), warned = false;
  try {
    var AC = window.AudioContext || window.webkitAudioContext; ctx = new AC();
    var src = ctx.createMediaStreamSource(stream); var an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
    var buf = new Uint8Array(an.fftSize);
    (function tick(){
      an.getByteTimeDomainData(buf); var sum = 0;
      for (var i = 0; i < buf.length; i++){ var v = (buf[i] - 128) / 128; sum += v * v; }
      var rms = Math.sqrt(sum / buf.length);
      var bar = $('rec-meter-bar'); if (bar) bar.style.width = Math.min(100, Math.round(rms * 300)) + '%';
      if (rms > REC_SILENCE_LEVEL){ quietSince = Date.now(); warned = false; $('rec-meter-msg').textContent = '🎙️ يتم التسجيل…'; }
      else if (!warned && Date.now() - quietSince > REC_SILENCE_MS){ warned = true; $('rec-meter-msg').textContent = '🔇 لا أسمع صوتك! اقترب من الميكروفون واقرأ بصوت واضح.'; if (onSilence) onSilence(); }
      raf = setTimeout(tick, 100);
    })();
  } catch(e){ $('rec-meter-msg').textContent = '🎙️ يتم التسجيل…'; }
  return function stop(){ clearTimeout(raf); try { if (ctx) ctx.close(); } catch(e){} var b = $('rec-meter'); if (b) b.remove(); };
}

async function startRec(itemId){
  var packRec = PACK_DATA.studentAudios && PACK_DATA.studentAudios[itemId];
  var isGiftPackage = PACK_DATA.packageType === 'approved_gift' || PACK_DATA.approved === true;
  var ownRec = STATE.studentAudios && STATE.studentAudios[itemId];
  if (!isGiftPackage && packRec && packRec.status === 'approved' && (!ownRec || ownRec.status === 'approved')){ alert('هذا التسجيل معتمد ولا يمكن تغييره.'); return; }
  if (activeRec){
    if (activeId === itemId && activeRec.state === 'recording'){ activeRec.stop(); return; }
    alert('يوجد تسجيل نشط.'); return;
  }
  if (!hasConsent()){ ensureConsent(function(){ startRec(itemId); }); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof window.MediaRecorder === 'undefined'){ alert('لا يتاح تسجيل الميكروفون في هذا المتصفح أو السياق. افتح الملف عبر HTTPS/localhost، أو استخدم خيار رفع تسجيل جاهز.'); return; }
  try {
    updateRecordingUI(itemId, 'starting');
    var stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true}});
    var stopMeter = null, maxTimer = null, interrupted = null;
    var mimeCandidates = ['audio/webm;codecs=opus','audio/webm','audio/mp4'];
    var chosenMime = mimeCandidates.find(function(m){ return typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m); });
    var rec;
    try {
      rec = chosenMime ? new MediaRecorder(stream,{mimeType:chosenMime,audioBitsPerSecond:24000}) : new MediaRecorder(stream,{audioBitsPerSecond:24000});
    } catch(_e) {
      rec = chosenMime ? new MediaRecorder(stream,{mimeType:chosenMime}) : new MediaRecorder(stream);
    }
    activeRec = rec; activeId = itemId; chunks = [];
    rec.ondataavailable = function(e){ if (e.data.size > 0) chunks.push(e.data); };
    rec.onerror = function(){ interrupted = 'تعطّل التسجيل فجأة، وحُفظ ما سُجّل حتى الآن.'; try { rec.stop(); } catch(e){} };
    try { var at = stream.getAudioTracks()[0]; if (at) at.onended = function(){ interrupted = 'انقطع الميكروفون، وحُفظ ما سُجّل حتى الآن.'; try { rec.stop(); } catch(e){} }; } catch(e){}
    var onVis = function(){ if (document.hidden && rec.state === 'recording'){ interrupted = 'خرجت من التطبيق أثناء التسجيل، فحُفظ ما سُجّل حتى الآن.'; try { rec.stop(); } catch(e){} } };
    document.addEventListener('visibilitychange', onVis);
    rec.onstop = async function(){
      updateRecordingUI(itemId, 'saving');
      clearTimeout(maxTimer); document.removeEventListener('visibilitychange', onVis);
      if (stopMeter) stopMeter();
      try { stream.getTracks().forEach(function(t){ t.stop(); }); } catch(e){}
      if (interrupted) alert(interrupted);
      var blob = new Blob(chunks, {type: rec.mimeType || (chunks[0] && chunks[0].type) || 'audio/webm'});
      try {
if (Date.now() - recStartedAt < REC_MIN_MS && !interrupted){ toast(GT('⏱️ التسجيل قصير جدًا، هل {قرأت|قرأتِ} الآية كاملة؟ {أعد|أعيدي} التسجيل.')); activeRec = null; activeId = null; chunks = []; updateRecordingUI(itemId, false); return; }
        await dbPut(itemId, blob);
                STATE.studentAudios[itemId] = {status: 'pending', updatedAt: new Date().toISOString(), rid: newRecId(), partial: !!interrupted};
        if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[itemId] && PACK_DATA.studentAudios[itemId].status === 'rejected') {
          // Keep the teacher's original feedback and the master/reference audio available to the student.
          // A new student recording must never erase the teacher's correction.
          if (PACK_DATA.studentAudios[itemId]) PACK_DATA.studentAudios[itemId].feedback = PACK_DATA.teacherFeedbacks && PACK_DATA.teacherFeedbacks[itemId] ? PACK_DATA.teacherFeedbacks[itemId] : PACK_DATA.studentAudios[itemId].feedback;
        }
        save();
      } catch(e){ alert('فشل الحفظ: ' + e.message); }
      activeRec = null; activeId = null; chunks = [];
      updateRecordingUI(itemId, false);
      // if we are in TF view, re-render it
      if (!$('view-tf').classList.contains('hidden')) renderTFView();
      else renderLesson();
    };
    rec.start();
    var recStartedAt = Date.now();
    updateRecordingUI(itemId, true);
    stopMeter = startLevelMeter(stream, null);
    maxTimer = setTimeout(function(){
      if (rec.state === 'recording'){ alert('وصل التسجيل إلى الحد الأقصى (' + Math.round(REC_MAX_MS / 60000 * 10) / 10 + ' دقيقة) وتوقّف تلقائيًا.'); try { rec.stop(); } catch(e){} }
    }, REC_MAX_MS);
  } catch(e){
    updateRecordingUI(itemId, false);
    showModal('🎙️ الميكروفون لا يعمل الآن', GT('{اطلب|اطلبي} من أحد الكبار أن يسمح للتطبيق باستخدام الميكروفون، ثم {جرّب|جرّبي} مرة أخرى.') +
      '\n\nللكبار: الإذن مرفوض أو لا يوجد ميكروفون (' + String(e && e.name || 'خطأ') + '). افتح إعدادات المتصفح أو الجهاز واسمح بالميكروفون. إن فتحت الملف مباشرة من مجلد على الجهاز فافتحه من تطبيق «رفاق التحفة» أو موقعه.',
      [{label: 'حسنًا', class: 'primary', action: closeModal}]);
    activeRec = null; activeId = null;
  }
}

async function maybeCompressAudio(file){
  if (!file || !file.size || file.size <= 3*1024*1024) return file;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || typeof MediaRecorder === 'undefined') return file;
  var ctx = null;
  try {
    var buf = await file.arrayBuffer();
    ctx = new AC();
    var audioBuffer = await ctx.decodeAudioData(buf.slice(0));
    if (!audioBuffer || !audioBuffer.duration) throw new Error('تعذر فك ترميز الصوت');
    var dest = ctx.createMediaStreamDestination();
    var mimes = ['audio/webm;codecs=opus','audio/webm','audio/mp4'];
    var mime = mimes.find(function(m){ return typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m); });
    var recorder;
    try { recorder = mime ? new MediaRecorder(dest.stream,{mimeType:mime,audioBitsPerSecond:24000}) : new MediaRecorder(dest.stream,{audioBitsPerSecond:24000}); }
    catch(_e){ recorder = mime ? new MediaRecorder(dest.stream,{mimeType:mime}) : new MediaRecorder(dest.stream); }
    var chunks=[];
    recorder.ondataavailable=function(e){ if(e.data && e.data.size) chunks.push(e.data); };
    var out = await new Promise(function(resolve,reject){
      recorder.onerror=function(){ reject(new Error('فشل ضغط الصوت')); };
      recorder.onstop=function(){
        var blob=new Blob(chunks,{type:recorder.mimeType || (chunks[0]&&chunks[0].type) || 'audio/webm'});
        resolve(blob);
      };
      var source=ctx.createBufferSource(); source.buffer=audioBuffer; source.connect(dest);
      source.onended=function(){ if(recorder.state==='recording') recorder.stop(); };
      try { recorder.start(250); source.start(0); } catch(e){ reject(e); }
    });
    if (out && out.size && out.size < file.size) return out;
  } catch(e){ console.warn('audio compression skipped',e); }
  finally { if(ctx) try{ await ctx.close(); }catch(_e){} }
  return file;
}

function isAudioFile(file){
  if (!file) return false;
  if (file.type && /^audio\//i.test(file.type)) return true;
  return /\.(mp3|m4a|aac|wav|ogg|oga|webm|mp4|opus)$/i.test(file.name || '');
}

async function uploadReplacementAudio(event, itemId){
  var file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;
  /* 9.39.3 (R11): مسار رفع الملف يخضع لبوابة الموافقة نفسها التي يخضع لها الميكروفون */
  if (!hasConsent()){ ensureConsent(function(){ alert('تم حفظ الموافقة. اختر الملف الصوتي مرة أخرى.'); }); return; }
  if (!isAudioFile(file)){ alert('اختر ملفًا صوتيًا صالحًا.'); return; }
  if (file.size > 12 * 1024 * 1024){ alert('حجم التسجيل كبير جدًا (أكثر من 12 ميجابايت). اختر تسجيلًا أقصر أو ملفًا مضغوطًا.'); return; }
  try {
    toast('⏳ جاري تجهيز وضغط التسجيل إذا لزم...');
    var prepared = await maybeCompressAudio(file);
    await dbPut(itemId, prepared);
    STATE.studentAudios[itemId] = {status:'pending', updatedAt:new Date().toISOString(), rid: newRecId(), source: prepared !== file ? 'uploaded-compressed' : 'uploaded-replacement'};
    // Preserve the teacher correction while the student prepares the new recording.
    if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[itemId] && PACK_DATA.teacherFeedbacks && PACK_DATA.teacherFeedbacks[itemId]) { PACK_DATA.studentAudios[itemId].feedback = PACK_DATA.teacherFeedbacks[itemId]; }
    save();
    renderTFView();
    toast('✅ حُفظ التسجيل البديل، وأصبح بانتظار مراجعة المعلم.');
  } catch(err){ alert('تعذر حفظ التسجيل البديل: ' + (err && err.message ? err.message : err)); }
}

async function playStudentRec(itemId){
  // In TF view use the pack audio; in lesson use IndexedDB
  var blob = await dbGet(itemId);
  if (!blob){
    var inPack = PACK_DATA.studentAudios && PACK_DATA.studentAudios[itemId];
    if (inPack && inPack.audio){
      document.querySelectorAll('audio').forEach(function(a){ try{ a.pause(); }catch(e){} });
      var au = new Audio(inPack.audio);
      au.play().catch(function(){});
      return;
    }
    alert('التسجيل مفقود'); return;
  }
  document.querySelectorAll('audio').forEach(function(a){ try{ a.pause(); }catch(e){} });
  var url = URL.createObjectURL(blob);
  var audio = new Audio(url);
  audio.onended = function(){ URL.revokeObjectURL(url); };
  audio.play().catch(function(){});
}
async function deleteStudentRec(itemId){
  if (!confirm('حذف هذا التسجيل؟')) return;
  await dbDel(itemId);
  delete STATE.studentAudios[itemId];
  save();
  renderLesson();
}

function startQuiz(){
  CURRENT.qIdx = 0; CURRENT.score = 0; CURRENT.correct = 0; CURRENT.wrong = 0;
  renderQuestion();
  show('view-quiz');
}
function renderQuestion(){
  var sec = CURRENT.section;
  var q = sec.questions[CURRENT.qIdx];
  var total = sec.questions.length, cur = CURRENT.qIdx + 1;
  $('quiz-counter').textContent = cur + ' / ' + total;
  $('quiz-points').textContent = '+' + CURRENT.score;
  $('quiz-progress').style.width = ((cur - 1) / total * 100) + '%';
  $('feedback-box').innerHTML = '';
  var qHtml = '';
  if (QX.has(q.type)){
    $('question-text').innerHTML = '<span class="question-badge badge-mc">' + QX.types[q.type].label + '</span><div data-style="margin-top:8px">' + GT(q.text) + '</div>' + (q.hint ? '<div class="verse-hint">💡 ' + GT(q.hint) + '</div>' : '');
    renderQX(q); return;
  }
  if (q.type === 'extraction'){
    var t = detectTextType(q);
    var T = termsForType(t);
    var bCls = t === 'quran' ? 'badge-extract-quran' : 'badge-extract-poem';
    qHtml = '<span class="question-badge ' + bCls + '">' + T.badge + '</span>';
    qHtml += '<div class="verse-box' + (t === 'quran' ? ' quran' : '') + '">';
    qHtml += '<span class="verse-text"' + (t === 'poem' ? ' data-style="font-size:1.35rem"' : '') + '>' + (t === 'quran' ? quranHTML(q.text, q) : q.text) + '</span>';
    if (q.hint) qHtml += '<span class="verse-hint">💡 ' + GT(q.hint) + '</span>';
    if (q.source) qHtml += '<span class="verse-source">' + q.source + '</span>';
    qHtml += '</div><div class="extract-points">❓ ' + GT(q.question) + '</div>';
  } else if (q.type === 'true_false'){
    qHtml = '<span class="question-badge badge-tf">✅ صواب أو خطأ</span><div data-style="margin-top:8px">🤔 ' + GT(q.text) + '</div>';
  } else {
    qHtml = '<span class="question-badge badge-mc">🔤 اختيار متعدد</span><div data-style="margin-top:8px">' + GT(q.text) + '</div>';
  }
  $('question-text').innerHTML = qHtml;
  var opts = $('options');
  if (q.type === 'true_false'){
    opts.innerHTML = '<button class="option-btn" data-idx="true" data-call="[&quot;answer&quot;, true]"><span class="opt-letter">✓</span> صحيح</button>' +
                     '<button class="option-btn" data-idx="false" data-call="[&quot;answer&quot;, false]"><span class="opt-letter">✗</span> خطأ</button>';
  } else {
/* 9.39: الحروف حتى ستة خيارات (كان الخامس يظهر undefined)، والخيارات تُخلط عند كل عرض مع إبقاء المؤشر الأصلي للتصحيح */
    var L = ['أ','ب','ج','د','هـ','و'];
    var order = q.options.map(function(_, i){ return i; });
    for (var oi = order.length - 1; oi > 0; oi--){ var oj = Math.floor(Math.random() * (oi + 1)); var ot = order[oi]; order[oi] = order[oj]; order[oj] = ot; }
    opts.innerHTML = order.map(function(i, pos){ return '<button class="option-btn" data-idx="' + i + '" ' + ACT('answer', i) + '><span class="opt-letter">' + (L[pos] || (pos + 1)) + '</span> ' + q.options[i] + '</button>'; }).join('');
  }
}
function answer(choice){
  var q = CURRENT.section.questions[CURRENT.qIdx];
  var correct = (choice === q.answer);
  document.querySelectorAll('#options .option-btn').forEach(function(b){ b.disabled = true; });
  var chB = null, corB = null;
  document.querySelectorAll('#options .option-btn').forEach(function(b){
    var idx = b.dataset.idx;
    if (String(idx) === String(choice)) chB = b;
    if (String(idx) === String(q.answer)) corB = b;
  });
  if (correct){ if (chB) chB.classList.add('correct'); }
  else { if (chB) chB.classList.add('wrong'); if (corB) corB.classList.add('correct'); }
  finishAnswer(correct, q);
}
function finishAnswer(correct, q){
  if (CURRENT.section && CURRENT.section._synthetic) { CURRENT.examResults = CURRENT.examResults || []; CURRENT.examResults.push({id: q.id, ok: !!correct}); }
  if (correct){
    CURRENT.score += q.points; CURRENT.correct++;
    confetti(q.type === 'extraction' ? 30 : 20);
    showFB(true, q.explanation);
  } else {
    CURRENT.wrong++;
    showFB(false, q.explanation);
  }
  $('quiz-points').textContent = '+' + CURRENT.score;
  var fb = $('feedback-box');
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn primary block';
  btn.style.marginTop = '14px';
  btn.textContent = (CURRENT.qIdx + 1 < CURRENT.section.questions.length) ? '➡️ السؤال التالي' : '🎉 شاهد النتيجة';
  btn.onclick = function(){
    CURRENT.qIdx++;
    if (CURRENT.qIdx < CURRENT.section.questions.length) renderQuestion();
    else finishQuiz();
  };
  fb.appendChild(btn);
  /* 9.39.10: الشرح بعد الإجابة كان يقع تحت حافة الشاشة الصغيرة فلا يراه الطفل */
  try { var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; fb.scrollIntoView({block: 'nearest', behavior: rm ? 'auto' : 'smooth'}); } catch(e){ try { fb.scrollIntoView(false); } catch(x){} }
}
function showFB(isCorrect, expl){
  expl = GT(expl);
  var t = isCorrect ? (Math.random() < 0.5 ? '✅ {أحسنت|أحسنتِ}!' : '🌟 ممتاز!') : '🤔 ليست هذه الإجابة. {انظر|انظري} السبب هنا 👇 ثم {انتقل|انتقلي} إلى السؤال التالي';
  $('feedback-box').innerHTML = '<div class="feedback' + (isCorrect ? '' : ' wrong') + '"><div class="title">' + t + '</div><div class="explain">' + expl + '</div></div>';
}
function finishQuiz(){
  var sec = CURRENT.section;
  if (sec.id === 'final_exam' || sec.id === 'retest_session'){ assessApplyExam(); }
  if (sec.id === 'review_session'){ assessApplyReview(); }
  var totalP = sec.questions.reduce(function(a, q){ return a + q.points; }, 0);
  var pct = totalP ? CURRENT.score / totalP : 0;
  // مكافأة الجهد: إكمال الاختبار يمنح نجمة، والنتيجة الجيدة والممتازة تضيفان نجمتين
  var stars = 1 + (pct >= 0.7 ? 1 : 0) + (pct >= 0.95 ? 1 : 0);
  var prev = STATE.progress[sec.id] || {bestScore: 0, stars: 0, attempts: 0};
  /* 9.39.11 (ق2-ب): نجوم الدرس من المحاولة الأولى (قياس)، وأفضل نتيجة ونجومها تُحفظ منفصلة (تدريب) */
  if (!sec._synthetic) STATE.progress[sec.id] = {
    bestScore: Math.max(prev.bestScore || 0, CURRENT.score),
    stars: (prev.attempts > 0 && prev.stars > 0) ? prev.stars : stars,
    bestStars: Math.max(prev.bestStars || prev.stars || 0, stars),
    attempts: (prev.attempts || 0) + 1
  };
  recalcStats();
  save();
  showResults(stars, pct);
}
function realSections(){ return CURRICULUM.filter(function(s){ return !s._synthetic; }); }
function recalcStats(){
  var tP = 0, comp = 0, perf = 0, att = 0;
  realSections().forEach(function(s){ /* 9.39.10: الاختبار والمراجعة ليسا أقسامًا من المنهج */
    var pr = STATE.progress[s.id];
    if (pr){
      tP += pr.bestScore || 0;
      if (pr.stars > 0) comp++;
      if (pr.stars === 3) perf++;
      att += pr.attempts || 0;
    }
  });
  STATE.stats = {totalPoints: tP, completedSections: comp, perfectSections: perf, totalAttempts: att};
}
function showResults(stars, pct){
  var el = $('result-stars');
  var h = '';
  for (var i = 0; i < 3; i++) h += '<span class="star' + (i < stars ? ' earned' : '') + '">⭐</span>';
  el.innerHTML = h;
  var titles = ['', 'محاولة جيدة!', 'أداء رائع!', '{أنت بطل|أنتِ بطلة}! 🌟'];
  var msgs = ['', '{استمر|استمري} في التدريب', '{اقتربت|اقتربتِ} من الكمال ✨', 'ممتاز، {استمر|استمري} 🎉'];
  $('result-title').textContent = GT(titles[stars] || '{أحسنت|أحسنتِ}');
  $('result-message').textContent = GT(msgs[stars] || '{استمر|استمري}');
  $('result-score').textContent = CURRENT.score;
  $('result-correct').textContent = '✅ ' + CURRENT.correct;
  $('result-wrong').textContent = '❌ ' + CURRENT.wrong;
  $('result-circle').style.setProperty('--deg', Math.round(pct * 360) + 'deg');
  if (stars === 3) confetti(60);
  show('view-results');
}
function nextFromResults(){
  var _r = realSections();
  var idx = _r.findIndex(function(s){ return s.id === CURRENT.section.id; });
  if (idx >= 0 && idx + 1 < _r.length) openSection(_r[idx + 1].id);
  else goHome();
}

function showProfile(){
  var s = STATE.student;
  var av = $('profile-avatar');
  if (s.photo) av.innerHTML = '<img data-media="' + mediaRef('img', s.photo) + '" alt="">';
  else av.innerHTML = '<span class="emoji">' + (s.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️') + '</span>';
  $('profile-name').textContent = s.name || '—';
  $('profile-sub').textContent = s.gender === 'girl' ? '🌸 طالبة متميزة' : '⭐ طالب متميز';
  $('profile-points').textContent = STATE.stats.totalPoints || 0;
  $('profile-stats').textContent = 'أقسام: ' + (STATE.stats.completedSections || 0) + '/' + realSections().length + ' · مفاهيم متقنة: ' + certLevel().mastered + '/' + realSections().length;

  var list = $('profile-recordings-list');
  var keys = Object.keys(STATE.studentAudios);
  if (!keys.length){
    list.innerHTML = '<div class="notice info">لم تسجّل شيئاً بعد.</div>';
  } else {
    var h = '';
    keys.forEach(function(id){
      var status = STATE.studentAudios[id].status || 'pending';
      var label = status === 'approved' ? '✅ معتمد' : status === 'rejected' ? '❌ مرفوض' : (STATE.studentAudios[id].sentAt ? '⏳ بانتظار المعلم' : '💾 لم يُرسل بعد');
      h += '<div data-style="padding:10px;border-bottom:1px solid #eef0f6;display:flex;justify-content:space-between;align-items:center;gap:8px">';
      h += '<div data-style="font-weight:800;color:var(--primary);font-size:.88rem">' + escapeHTML(itemLabelById(id)) + '</div>';
      h += '<span class="pill">' + label + '</span></div>';
    });
    list.innerHTML = h;
  }
  show('view-profile');
}
function editProfile(){ buildSetup(); show('view-student-setup'); }
/* 9.39.10: زرّا «إعادة المفاهيم المخفقة» و«جلسة المراجعة» يظهران فقط حين يوجد ما يُعاد أو يُراجَع (كانا ينتهيان بتنبيه «لا يوجد») */
var _showProfileBase = showProfile;
showProfile = function(){
  var r = _showProfileBase.apply(this, arguments);
  try {
    var st = STATE.assess || null;
    var rt = document.getElementById('btn-retest'); if (rt) rt.classList.toggle('hidden', !(st && Array.isArray(st.pendingRetest) && st.pendingRetest.length));
    if (rt && st && Array.isArray(st.pendingRetest) && st.pendingRetest.length){ // 9.39.13 (D4-ج)
      var nowB = new Date().toISOString(), anyReady = st.pendingRetest.some(function(id){ return assessIsReady(st, id, nowB); });
      rt.textContent = anyReady ? '🔁 إعادة المفاهيم التي لم تُتقن بعد' : ('🔁 الإعادة متاحة ' + assessWaitText(st.pendingRetest));
    }
    var rv = document.getElementById('btn-review-session'); if (rv) rv.classList.toggle('hidden', !(st && st.concepts && assessDueReviews(st, new Date().toISOString()).length));
  } catch(e){}
  return r;
};

function handleReviewTeacherPhoto(event){
  var file = event.target.files && event.target.files[0]; if (!file) return;
  if (!imageFileLooksValid(file)){ alert('اختر ملف صورة صحيحًا.'); event.target.value=''; return; }
  var reader = new FileReader();
  reader.onerror=function(){ alert('تعذرت قراءة الصورة.'); event.target.value=''; };
  reader.onload=function(ev){
    var img=new Image(); img.onerror=function(){ alert('تعذر قراءة الصورة في هذا المتصفح.'); event.target.value=''; };
    img.onload=function(){ try{ var out=compressCanvasImage(img,480,300*1024,.82); PACK_DATA.teacherPhoto=out; var im=$('review-teacher-photo-img'); var ph=$('review-teacher-photo-placeholder'); im.src=out; im.classList.remove('hidden'); ph.classList.add('hidden'); var av=document.querySelector('#review-people-strip .review-person-card:nth-child(2) .mini-avatar'); if(av) av.innerHTML='<img data-media="'+mediaRef('img', out)+'" alt="صورة المعلم">'; }catch(e){ alert('تعذر تجهيز الصورة.'); } };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}

function showTeacherReview(){
  var previousScroll = window.scrollY || document.documentElement.scrollTop || 0;
  var teacherInput = $('review-teacher-name');
  if (teacherInput && !teacherInput.value) teacherInput.value = TEACHER_STATE.name || PACK_DATA.teacherName || '';
  var teacherPhotoImg = $('review-teacher-photo-img'), teacherPhotoPh = $('review-teacher-photo-placeholder');
  if (teacherPhotoImg && PACK_DATA.teacherPhoto){ teacherPhotoImg.src=PACK_DATA.teacherPhoto; teacherPhotoImg.classList.remove('hidden'); if(teacherPhotoPh) teacherPhotoPh.classList.add('hidden'); }
  if (!PACK_DATA.studentName){ alert('لا يوجد ملف طالب.'); return; }
  $('review-student-name').textContent = 'تسجيلات الطالب: ' + (PACK_DATA.studentName || '');
  (function(){ // 9.39.11 (ق1-ب)
    var rs = refStatusLine(), rb = document.getElementById('review-ref-line');
    if (!rs){ if (rb) rb.remove(); return; }
    if (!rb){ rb = document.createElement('div'); rb.id = 'review-ref-line'; rb.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:12px;font-size:.9rem;line-height:1.8'; var rl0 = $('review-list'); if (rl0 && rl0.parentNode) rl0.parentNode.insertBefore(rb, rl0); }
    rb.style.background = rs.ok ? '#e8f5e9' : '#ffebee'; rb.style.color = rs.ok ? '#1b5e20' : '#b71c1c'; rb.textContent = rs.text;
  })();
  teacherSigningStatus().then(function(st){
    var sb = document.getElementById('review-sign-line');
    if (!sb){ sb = document.createElement('div'); sb.id = 'review-sign-line'; sb.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:12px;font-size:.9rem'; var rl2 = $('review-list'); if (rl2 && rl2.parentNode) rl2.parentNode.insertBefore(sb, rl2); }
    sb.style.background = st.ok ? '#e8f5e9' : '#fff3e0'; sb.style.color = st.ok ? '#1b5e20' : '#e65100'; sb.textContent = st.text;
  }).catch(function(){});
  (function(){
    var ab = document.getElementById('review-assess-line');
    if (!ab){ ab = document.createElement('div'); ab.id = 'review-assess-line'; ab.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:12px;font-size:.9rem;background:#eef4ff;color:#1a3a6b'; var rl3 = $('review-list'); if (rl3 && rl3.parentNode) rl3.parentNode.insertBefore(ab, rl3); }
    var sa = PACK_DATA.studentAssessment;
    var overdue = PACK_DATA.submittedAt && assessTeacherReplyOverdue(PACK_DATA.submittedAt, new Date().toISOString()) && !PACK_DATA.teacherRepliedAt;
    var chSel = document.getElementById('review-reply-channel');
    if (!chSel){ chSel = document.createElement('select'); chSel.id = 'review-reply-channel'; chSel.setAttribute('data-change', 'setReplyChannel'); chSel.style.cssText = 'width:100%;padding:8px;border-radius:10px;border:1px solid #cfd8dc;margin:6px 0'; var rl4 = $('review-list'); if (rl4 && rl4.parentNode) rl4.parentNode.insertBefore(chSel, rl4); }
    chSel.innerHTML = Object.keys(REPLY_CHANNELS).map(function(k){ return '<option value="' + k + '"' + ((PACK_DATA.replyChannel || 'text') === k ? ' selected' : '') + '>قناة الرد: ' + REPLY_CHANNELS[k] + '</option>'; }).join('');
    rosterSaveCurrent();
    var rbtn = document.getElementById('btn-roster');
    if (!rbtn){ rbtn = document.createElement('button'); rbtn.id = 'btn-roster'; rbtn.type = 'button'; rbtn.className = 'btn ghost block'; rbtn.textContent = '📋 لوحة المتابعة'; rbtn.setAttribute('data-call', '["openRoster"]'); var rl5 = $('review-list'); if (rl5 && rl5.parentNode) rl5.parentNode.insertBefore(rbtn, rl5); }
    var pendingCount = Object.keys(PACK_DATA.studentAudios || {}).filter(function(k){ return (PACK_DATA.studentAudios[k] || {}).status === 'pending'; }).length;
    var alertLine = (overdue ? ' ⏰ تجاوز الرد مهلة 48 ساعة.' : '') + (pendingCount > 10 ? ' ⚠️ التسجيلات المعلقة ' + pendingCount + ' (الحد الموصى به 10): راجع دفعة أولًا.' : '');
    var _secT = function(id){ var s = CURRICULUM.find(function(x){ return x.id === id; }); return s ? s.title : id; };
    var _le = sa && sa.lastExam, _leTxt = _le ? ' · آخر اختبار: ' + _le.correct + '/' + _le.total + (_le.wrong && _le.wrong.length ? ' (أخطاء في ' + _le.wrong.length + ' سؤالًا)' : '') : '';
    if (sa && sa.restored) _leTxt += ' · ' + restoredNote(sa.restored); // 9.39.13 (D12)
    ab.textContent = (sa ? ('📊 الاختبار النظري: متقن ' + sa.mastered.length + '، قيد التدريب ' + sa.pending.length + (sa.escalated.length ? '، محالة للمعلم: ' + sa.escalated.map(_secT).join('، ') : '') + _leTxt) : '📊 لا توجد نتائج اختبار نظري مرسلة بعد.') + alertLine;
  })();
  (function(){
    var box = document.getElementById('review-consent-line');
    if (!box){ box = document.createElement('div'); box.id = 'review-consent-line'; box.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:12px;font-size:.9rem'; var rl = $('review-list'); if (rl && rl.parentNode) rl.parentNode.insertBefore(box, rl); }
    var c = PACK_DATA.studentConsent;
    if (c && (c.v === 1 || c.v === 2) && c.guardian){
      var when = c.at ? new Date(c.at).toLocaleDateString('ar') : '';
      box.style.background = '#e8f5e9'; box.style.color = '#1b5e20';
      box.textContent = '🛡️ موافقة ولي الأمر: ' + c.guardian + (when ? ' (بتاريخ ' + when + ')' : '');
    } else {
      box.style.background = '#fff3e0'; box.style.color = '#e65100';
      box.textContent = '⚠️ لا توجد موافقة ولي أمر مسجّلة لهذا الملف. لا تعتمد تسجيلات الطفل قبل التأكد منها.';
    }
  })();
  var reviewHeader = document.getElementById('review-people-strip');
  if (!reviewHeader){
    reviewHeader = document.createElement('div'); reviewHeader.id='review-people-strip'; reviewHeader.className='review-person-strip';
    var stats = document.querySelector('#view-teacher-review .review-stats');
    stats.parentNode.insertBefore(reviewHeader, stats.nextSibling);
  }
  var studentAvatar = PACK_DATA.studentPhoto ? '<img data-media="'+mediaRef('img', PACK_DATA.studentPhoto)+'" alt="صورة الطالب">' : '<span>'+((PACK_DATA.studentGender==='girl')?'🧚‍♀️':'🦸‍♂️')+'</span>';
  var teacherAvatar = PACK_DATA.teacherPhoto ? '<img data-media="'+mediaRef('img', PACK_DATA.teacherPhoto)+'" alt="صورة المعلم">' : '<span>'+((PACK_DATA.teacherGender==='girl')?'👩‍🏫':'👨‍🏫')+'</span>';
  reviewHeader.innerHTML = '<div class="review-person-card"><div class="mini-avatar">'+studentAvatar+'</div><div><div class="mini-label">'+(PACK_DATA.studentGender==='girl' ? 'الطالبة صاحبة التسجيلات' : 'الطالب صاحب التسجيلات')+'</div><div class="mini-name">'+escapeHTML(PACK_DATA.studentName || '—')+'</div></div></div><div class="review-person-card"><div class="mini-avatar">'+teacherAvatar+'</div><div><div class="mini-label">المعلم المراجع</div><div class="mini-name">'+escapeHTML(PACK_DATA.teacherName || 'لم يُحدد بعد')+'</div></div></div>';

  var items = [];
  CURRICULUM.forEach(function(sec){
    (sec.items || []).forEach(function(it){
      if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[it.id]) items.push({id: it.id, text: it.text, qpc: it.qpc, type: detectTextType({text: it.text})});
    });
    (sec.questions || []).forEach(function(q){
      if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[q.id]) items.push({id: q.id, text: q.text, qpc: q.qpc, type: detectTextType(q)});
    });
  });

  var approved = 0;
  var h = '';
  items.forEach(function(it){
    var rec = PACK_DATA.studentAudios[it.id];
    var status = rec.status || 'pending';
    if (status === 'approved') approved++;
    h += '<div class="review-item ' + (status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : '') + '">';
    h += '<div class="head"><div class="dot"></div><div class="label">' + escapeHTML(itemLabelById(it.id)) + '</div>';
    h += '<div class="status ' + status + '">' + (status === 'approved' ? '✅ معتمد' : status === 'rejected' ? '❌ مرفوض' : '⏳ قيد المراجعة') + '</div></div>';
    h += '<div class="text' + (it.type === 'quran' ? ' quran' : '') + '">' + (it.type === 'quran' ? quranHTML(it.text, it, it.id) : highlightPivot(it.text, it.id)) + '</div>'; // 9.39.15 (ق6-ب)، 9.39.17
    h += audioPersonBlock(PACK_DATA.studentPhoto, PACK_DATA.studentGender || 'boy', PACK_DATA.studentName || '', '🎙️ تسجيل الطالب / الطالبة', rec.audio, 'review-student-audio');
    if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[it.id] && PACK_DATA.studentAudios[it.id].partial) h += '<div class="notice warn" data-style="font-size:.85rem">⚠️ هذا التسجيل ناقص: انقطع الميكروفون أو خرج الطفل من التطبيق أثناءه.</div>';
    if (PACK_DATA.teacherNotes && PACK_DATA.teacherNotes[it.id]) h += '<div class="teacher-comment"><b>📝 ملاحظتك المكتوبة:</b><div>' + escapeHTML(String(PACK_DATA.teacherNotes[it.id])) + '</div></div>';
    h += ratingBlockHTML(it); // 9.39.15 (ق6)
    h += '<select class="note-bank" data-change="applyNoteCode" data-change-arg="' + it.id + '" data-style="width:100%;padding:8px;border-radius:10px;border:1px solid #cfd8dc;margin-bottom:6px"><option value="">— اختر ملاحظة جاهزة —</option>' + NOTE_BANK.map(function(n){ return '<option value="' + n + '">' + n + '</option>'; }).join('') + '</select>';
    h += '<div class="review-actions">';
    h += '<button class="btn success" ' + ACT('setReview', it.id, 'approved') + ' type="button">✅ اعتماد</button>';
    h += '<button class="btn danger" ' + ACT('setReview', it.id, 'rejected') + ' type="button">❌ رفض</button>';
    h += '</div></div>';
  });
  if (!items.length) h = '<div class="notice warn">لا توجد تسجيلات للمراجعة.</div>';
  $('review-list').innerHTML = h;
  $('review-approved-count').textContent = approved;
  show('view-teacher-review');
  requestAnimationFrame(function(){ window.scrollTo(0, previousScroll); });
}
var teacherFeedbackTarget = null, teacherFeedbackRecorder = null, teacherFeedbackStream = null, teacherFeedbackChunks = [], teacherFeedbackData = null;
var RATING_STATES = {mastered: '✅ متقن', good: '👍 جيد', needs: '🔁 يحتاج تدريبًا'}; // 9.39.15 (ق6-أ)
var RATING_UNUSABLE = '🔇 لا يصلح للتقييم'; // ليس درجة: ضجيج أو صمت أو انقطاع، ويُطلب إعادة التسجيل
/* يُستدعى أثناء تعقيم الملف عند الإقلاع، قبل تعريف RATING_STATES، فلا يعتمد عليه */
function normRating(v){ v = String(v || ''); if (v === 'notapplied') return 'needs'; return ({mastered: 1, good: 1, needs: 1, unusable: 1})[v] ? v : ''; }
