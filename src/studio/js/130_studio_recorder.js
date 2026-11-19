/* المسجِّل: تسجيل ورفع وتشغيل وحذف، ونافذة الحوار */
var activeRecorder = null, activeItemId = null, recChunks = [];

async function startRec(itemId){
  if (activeRecorder){
    if (activeItemId === itemId && activeRecorder.state === 'recording'){ activeRecorder.stop(); return; }
    alert('يوجد تسجيل نشط.'); return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ alert('متصفحك لا يدعم التسجيل.'); return; }
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof window.MediaRecorder === 'undefined'){ alert('التسجيل الصوتي يحتاج متصفحًا يدعم الميكروفون وMediaRecorder.'); return; }
    var stream = await navigator.mediaDevices.getUserMedia({audio: true});
    var mimeCandidates = ['audio/webm;codecs=opus','audio/webm','audio/mp4'];
    var chosenMime = mimeCandidates.find(function(m){ return typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m); });
    var rec;
    try { rec = chosenMime ? new MediaRecorder(stream,{mimeType:chosenMime,audioBitsPerSecond:48000}) : new MediaRecorder(stream,{audioBitsPerSecond:48000}); }
    catch(_e){ rec = chosenMime ? new MediaRecorder(stream,{mimeType:chosenMime}) : new MediaRecorder(stream); }
    activeRecorder = rec; activeItemId = itemId; recChunks = [];
    rec.ondataavailable = function(e){ if (e.data.size > 0) recChunks.push(e.data); };
    rec.onstop = async function(){
      try { stream.getTracks().forEach(function(t){ t.stop(); }); } catch(e){}
      var blob = new Blob(recChunks, {type: rec.mimeType || (recChunks[0] && recChunks[0].type) || 'audio/webm'});
      try { await dbPut(itemId, blob); STATE.recordings[itemId] = blob; log('saved', {itemId: itemId, size: blob.size}); }
      catch(e){ log('save-failed', {message: e.message}); }
      activeRecorder = null; activeItemId = null; recChunks = [];
      renderStudio(); recSessionAfterSave(itemId);
    };
    rec.start();
    var btn = document.querySelector('.rec-item[data-id="' + itemId + '"] .btn.primary, .rec-item[data-id="' + itemId + '"] .btn.gold');
    if (btn){ btn.textContent = '⏹️ إيقاف وحفظ'; btn.classList.remove('primary','gold'); btn.classList.add('danger'); }
    var status = $('status-' + itemId);
    if (status){ status.textContent = '🔴 جارٍ التسجيل...'; status.className = 'rec-status recording'; }
  } catch(e){
    alert('تعذر الوصول للميكروفون: ' + e.name);
    activeRecorder = null; activeItemId = null;
  }
}

async function playRecording(itemId){
  var blob = STATE.recordings[itemId]; if (!blob) return;
  document.querySelectorAll('audio').forEach(function(a){ try{ a.pause(); }catch(e){} });
  var url = URL.createObjectURL(blob);
  var audio = new Audio(url);
  audio.onended = function(){ URL.revokeObjectURL(url); };
  audio.play().catch(function(){});
}

async function deleteRec(itemId){
  if (!confirm('حذف هذا التسجيل؟')) return;
  await dbDelete(itemId);
  delete STATE.recordings[itemId];
  log('deleted', {itemId: itemId});
  renderStudio();
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
    if (!audioBuffer || !audioBuffer.duration) throw new Error('decode');
    if (typeof onInfo === 'function') try { onInfo(Math.ceil(audioBuffer.duration)); } catch(e){} // 9.41.1: الضغط يستغرق مدة التسجيل نفسها
    var dest = ctx.createMediaStreamDestination();
    var mimes=['audio/webm;codecs=opus','audio/webm','audio/mp4'];
    var mime=mimes.find(function(m){ return typeof MediaRecorder.isTypeSupported==='function' && MediaRecorder.isTypeSupported(m); });
    var recorder;
    try { recorder=mime?new MediaRecorder(dest.stream,{mimeType:mime,audioBitsPerSecond:48000}):new MediaRecorder(dest.stream,{audioBitsPerSecond:48000}); }
    catch(_e){ recorder=mime?new MediaRecorder(dest.stream,{mimeType:mime}):new MediaRecorder(dest.stream); }
    var chunks=[];
    recorder.ondataavailable=function(e){ if(e.data&&e.data.size) chunks.push(e.data); };
    var out=await new Promise(function(resolve,reject){
      recorder.onerror=function(){ reject(new Error('compression failed')); };
      recorder.onstop=function(){ resolve(new Blob(chunks,{type:recorder.mimeType||(chunks[0]&&chunks[0].type)||'audio/webm'})); };
      var source=ctx.createBufferSource(); source.buffer=audioBuffer; source.connect(dest);
      source.onended=function(){ if(recorder.state==='recording') recorder.stop(); };
      try{ recorder.start(250); source.start(0); }catch(e){ reject(e); }
    });
    if(out&&out.size&&out.size<file.size) return out;
  }catch(e){ console.warn('audio compression skipped',e); }
  finally{ if(ctx) try{ await ctx.close(); }catch(_e){} }
  return file;
}

function uploadRec(event, itemId){
  var file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  if (!(file.type && /^audio\//i.test(file.type)) && !/\.(mp3|m4a|aac|wav|ogg|oga|webm|mp4|opus)$/i.test(file.name||'')){ alert('اختر ملفًا صوتيًا صالحًا.'); return; }
  if (!file.size || file.size > 12*1024*1024){ alert('الملف فارغ أو أكبر من 12 ميجابايت.'); return; }
  (async function(){
    try {
      var prepared = await maybeCompressAudio(file, function(sec){ showModal('⏳ جارٍ ضغط التسجيل', 'الملف كبير، فيُضغط في نحو ' + sec + ' ثانية. لا تغلق الصفحة.', []); });
      closeModal();
      await dbPut(itemId, prepared);
      STATE.recordings[itemId] = prepared;
      log('uploaded', {itemId: itemId, name: file.name, compressed: prepared !== file, finalSize: prepared.size});
      renderStudio();
    } catch(e){ alert('فشل الرفع: ' + e.message); }
  })();
}

function showResetDialog(){
  showModal('تأكيد الحذف', 'سيتم حذف جميع التسجيلات. متابعة؟', [
    {label: '🗑️ احذف الكل', class: 'danger', action: async function(){
      await dbClear(); STATE.recordings = {}; closeModal(); renderStudio(); log('cleared');
    }},
    {label: 'إلغاء', class: 'ghost', action: closeModal}
  ]);
}
function showModal(title, body, actions){
  $('modal-title').textContent = title;
  $('modal-body').textContent = body;
  var act = $('modal-actions'); act.innerHTML = '';
  actions.forEach(function(a){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ' + (a.class || 'primary');
    btn.textContent = a.label; btn.style.margin = '4px';
    btn.onclick = a.action;
    act.appendChild(btn);
  });
  $('modal').classList.remove('hidden');
}
function closeModal(){ $('modal').classList.add('hidden'); }

async function blobToBase64(blob){
  return new Promise(function(res, rej){
    var r = new FileReader();
    r.onload = function(){ res(r.result); };
    r.onerror = function(){ rej(r.error); };
    r.readAsDataURL(blob);
  });
}

// قالب الطالب مضمّن داخل الاستوديو؛ لا يعتمد التصدير على fetch أو localhost.
