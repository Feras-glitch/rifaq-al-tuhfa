/* ===== التسجيل الصوتي للطفل: التسجيل والضغط والتشغيل والحذف ===== */
var activeRec = null, activeId = null, chunks = [];
function updateRecordingUI(itemId, state){
  var safeId = String(itemId).replace(/[^a-zA-Z0-9_-]/g, '_');
  var buttons = document.querySelectorAll('#re-record-btn-' + safeId + ', #rec-btn-' + safeId + ', #lesson-rec-btn-' + safeId);
  var recording = state === true || state === 'recording';
  var starting = state === 'starting';
  var saving = state === 'saving';
  buttons.forEach(function(btn){
    btn.disabled = false;
    btn.classList.remove('gold','ghost','primary','danger');
    if (recording){
      btn.textContent = '⏹️ إيقاف التسجيل';
      btn.classList.add('danger');
      btn.setAttribute('aria-pressed','true');
    } else if (starting){
      btn.textContent = '⏳ تهيئة التسجيل...';
      btn.classList.add('danger');
      btn.disabled = true;
      btn.setAttribute('aria-pressed','true');
    } else if (saving){
      btn.textContent = '💾 جارٍ حفظ التسجيل...';
      btn.classList.add('gold');
      btn.disabled = true;
      btn.setAttribute('aria-pressed','true');
    } else {
      btn.textContent = '🎙️ {أعد|أعيدي} التسجيل الآن';
      btn.classList.add('gold');
      btn.setAttribute('aria-pressed','false');
    }
  });
  var st=document.querySelector('#rec-status-' + safeId);
  if(st){
    if (recording){ st.textContent=GT('🔴 جارٍ التسجيل... {اضغط|اضغطي} الزر نفسه للإيقاف'); st.className='rec-status recording'; }
    else if (starting){ st.textContent='🎙️ جارٍ تشغيل الميكروفون...'; st.className='rec-status recording'; }
    else if (saving){ st.textContent='💾 جارٍ حفظ التسجيل...'; st.className='rec-status'; }
    else { st.textContent='جاهز لإعادة التسجيل'; st.className='rec-status'; }
  }
}

function getStudentRec(itemId){
  if (STATE.role === 'teacher'){
    var r2 = PACK_DATA.studentAudios && PACK_DATA.studentAudios[itemId];
    if (r2) return r2.audio;
  }
  return null;
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
async function maybeCompressAudio(file, onInfo){
  if (!file || !file.size || file.size <= 3*1024*1024) return file;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || typeof MediaRecorder === 'undefined') return file;
  var ctx = null;
  try {
    var buf = await file.arrayBuffer();
    ctx = new AC();
    var audioBuffer = await ctx.decodeAudioData(buf.slice(0));
    if (!audioBuffer || !audioBuffer.duration) throw new Error('تعذر فك ترميز الصوت');
    if (typeof onInfo === 'function') try { onInfo(Math.ceil(audioBuffer.duration)); } catch(e){} // 9.41.1: الضغط يستغرق مدة التسجيل نفسها
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
    var prepared = await maybeCompressAudio(file, function(sec){ toast('⏳ جارٍ ضغط التسجيل: نحو ' + sec + ' ثانية، لا تغلق التطبيق...'); });
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
  /* 9.41.1: رابط التشغيل السابق يُحرَّر عند تشغيل تسجيل آخر، فلا تتراكم الروابط إن أُوقف الصوت قبل نهايته */
  if (window.PLAY_REC_URL){ try { URL.revokeObjectURL(window.PLAY_REC_URL); } catch(e){} }
  var url = window.PLAY_REC_URL = URL.createObjectURL(blob);
  var audio = new Audio(url);
  audio.play().catch(function(){});
}
async function deleteStudentRec(itemId){
  if (!confirm('حذف هذا التسجيل؟')) return;
  await dbDel(itemId);
  delete STATE.studentAudios[itemId];
  save();
  renderLesson();
}
var REC_MAX_MS = 180000;
var REC_MIN_MS = 1500;
      // أقل مدة مقبولة لتسجيل: ثانية ونصف      // حد أقصى ثلاث دقائق للتسجيل الواحد
var REC_SILENCE_MS = 6000;
    // بعد هذه المدة بلا صوت يُنبَّه الطفل
var REC_SILENCE_LEVEL = 0.012;
