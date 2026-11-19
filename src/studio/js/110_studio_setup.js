/* شاشة الإعداد: الصور والأسماء وبدء الاستوديو والجلسات */
function $(id){ return document.getElementById(id); }
function log(msg, data){
  var t = new Date().toLocaleTimeString();
  var line = '[' + t + '] ' + msg;
  if (data !== undefined){ try { line += ' ' + JSON.stringify(data); } catch(e){} }
  var el = $('log');
  if (el) el.textContent = line + '\n' + el.textContent;
}

function optimizedImageData(file, maxBytes, maxSide, format, quality, onDone, onError){
  if (!file) return;
  if (!(file.type && /^image\//i.test(file.type)) && !/\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name||'')) { onError('اختر ملف صورة.'); return; }
  var reader = new FileReader();
  reader.onerror = function(){ onError('تعذرت قراءة الصورة. اختر صورة أخرى.'); };
  reader.onload = function(ev){
    var img = new Image();
    img.onerror = function(){ onError('هذا النوع من الصور لا يستطيع المتصفح قراءته مباشرة. إذا كانت HEIC/HEIF فاختر JPG أو PNG.'); };
    img.onload = function(){
      try {
        if (!img.naturalWidth || !img.naturalHeight) throw new Error('invalid dimensions');
        var side = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var out = null;
        for (var pass=0; pass<4 && !out; pass++){
          var canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(img.naturalWidth*side));
          canvas.height=Math.max(1,Math.round(img.naturalHeight*side));
          var ctx=canvas.getContext('2d'); if(!ctx) throw new Error('canvas unavailable');
          ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          var q=quality;
          for(var qi=0;qi<5;qi++){
            var candidate=canvas.toDataURL('image/jpeg',q);
            var bytes=Math.floor(candidate.split(',')[1].length*3/4);
            if(bytes<=maxBytes || (canvas.width<=500 && q<=0.62)){ out=candidate; break; }
            q=Math.max(0.62,q-0.07);
          }
          side*=0.82;
        }
        if(!out) throw new Error('image too large');
        onDone(out);
      } catch(err){ onError('تعذر تجهيز الصورة. اختر صورة أخرى.'); }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
function handleSupervisorPhoto(event){
  var file = event.target.files && event.target.files[0]; if (!file) return;
  optimizedImageData(file, 2*1024*1024, 1000, 'image/jpeg', 0.88, function(data){
    STATE.supervisorPhoto = data; $('supervisor-photo-img').src = data;
    $('supervisor-photo-img').classList.remove('hidden'); $('supervisor-photo-placeholder').classList.add('hidden');
  }, function(msg){ alert(msg); event.target.value=''; });
}
function handleSheikhPhoto(event){
  var file = event.target.files && event.target.files[0]; if (!file) return;
  optimizedImageData(file, 2*1024*1024, 1000, 'image/jpeg', 0.88, function(data){
    STATE.sheikhPhoto = data; $('sheikh-photo-img').src = data;
    $('sheikh-photo-img').classList.remove('hidden'); $('sheikh-photo-placeholder').classList.add('hidden');
  }, function(msg){ alert(msg); event.target.value=''; });
}
function handlePoemReciterPhoto(event){
  var file = event.target.files && event.target.files[0]; if (!file) return;
  optimizedImageData(file, 2*1024*1024, 1000, 'image/jpeg', 0.88, function(data){
    STATE.poemReciterPhoto = data; $('poem-reciter-photo-img').src = data;
    $('poem-reciter-photo-img').classList.remove('hidden'); $('poem-reciter-photo-placeholder').classList.add('hidden');
  }, function(msg){ alert(msg); event.target.value=''; });
}
function handleSchoolLogo(event){
  var file = event.target.files && event.target.files[0]; if (!file) return;
  optimizedImageData(file, 1*1024*1024, 1200, 'image/png', 1, function(data){
    STATE.schoolLogo = data; $('school-logo-img').src = data;
    $('school-logo-img').classList.remove('hidden'); $('school-logo-placeholder').classList.add('hidden');
  }, function(msg){ alert(msg); event.target.value=''; });
}

function startStudio(){
  var sheikhName = $('in-sheikh-name').value.trim();
  var supervisorName = $('in-supervisor-name').value.trim();
  var err = document.getElementById('setup-err');
  function need(id, msg){ if (err){ err.textContent = msg; err.classList.remove('hidden'); } var el = document.getElementById(id); if (el){ el.focus(); el.scrollIntoView({block: 'center'}); } }
  if (!sheikhName){ need('in-sheikh-name', '✍️ اكتب اسم الشيخ / قارئ القرآن أولًا.'); return; }
  if (!supervisorName){ need('in-supervisor-name', '✍️ اكتب اسم المشرف أولًا.'); return; }
  if (err) err.classList.add('hidden');
  STATE.sheikhName = sheikhName;
  STATE.supervisorName = supervisorName;
  STATE.poemReciterName = ($('in-poem-reciter').value || '').trim();
  STATE.schoolName = $('in-school-name').value.trim();
  $('studio-sub').textContent = 'إعداد المشرف: ' + STATE.supervisorName + (STATE.schoolName ? ' — ' + STATE.schoolName : '');
  loadExistingRecordings().then(function(){
    renderStudio();
    $('view-setup').classList.add('hidden');
    $('view-studio').classList.remove('hidden');
    log('studio-started', {sheikh: STATE.sheikhName, supervisor: STATE.supervisorName, total: TOTAL});
  });
}

/* 9.41: عضو الفريق (الشيخ أو المنشد على جهازه) يدخل بلا استمارة؛ الملف النهائي يصدّره المشرف */
function startTeamMember(){
  STATE.sheikhName = ($('in-sheikh-name').value || '').trim();
  STATE.supervisorName = ($('in-supervisor-name').value || '').trim();
  STATE.poemReciterName = ($('in-poem-reciter').value || '').trim();
  if (recRole() === 'all' || recRole() === 'supervisor') try { localStorage.setItem(REC_ROLE_KEY, 'sheikh'); } catch(e){}
  $('studio-sub').textContent = 'تسجيل جزء من الفريق — اختر دورك، ثم أرسل حزمة تسجيلاتك إلى المشرف';
  loadExistingRecordings().then(function(){
    renderStudio();
    $('view-setup').classList.add('hidden');
    $('view-studio').classList.remove('hidden');
    log('team-member-started', {role: recRole()});
  });
}
function backToSetup(){ closeModal(); $('view-studio').classList.add('hidden'); $('view-setup').classList.remove('hidden'); window.scrollTo(0, 0); }

async function loadExistingRecordings(){
  try {
    var keys = await dbGetAllKeys();
    for (var i = 0; i < keys.length; i++){
      var blob = await dbGet(keys[i]);
      if (blob) STATE.recordings[keys[i]] = blob;
    }
  } catch(e){ log('load-failed', {message: e.message}); }
}


async function newWorkspace(){
  if (!confirm('بدء جلسة جديدة فارغة؟ لن تُحذف ملفات HTML التي صدّرتها سابقًا، لكن تسجيلات الجلسة الحالية لن تظهر في الجلسة الجديدة.')) return;
  try { var db=await openDB(); db.close(); } catch(e){}
  WORKSPACE_ID = 'ws_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10);
  sessionStorage.setItem(WORKSPACE_KEY, WORKSPACE_ID);
  DB_NAME = 'tohfa_studio_v913_' + WORKSPACE_ID; /* 9.39 (R10): البادئة نفسها التي يُفتح بها الملف، وإلا اختفت التسجيلات بعد التحديث */
  STATE.recordings = {};
  renderStudio();
  log('workspace-reset', {workspace:WORKSPACE_ID});
  alert('بدأت جلسة جديدة فارغة.');
}

