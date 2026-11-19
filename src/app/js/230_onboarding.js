/* ===== الترحيب وإعداد الطالب ===== */
var setupGender = 'boy', setupPhoto = null;
function buildSetup(){
  var isTeacher = STATE.role === 'teacher';
  var profile = isTeacher ? TEACHER_STATE : STATE.student;
  $('setup-name').value = isTeacher ? (TEACHER_STATE.name || PACK_DATA.teacherName || '') : (detectMode() === 'friend' ? '' : (profile.name || PACK_DATA.studentName || ''));
  setSetupGender(profile.gender || 'boy');
  var isGiftRecipient = detectMode() === 'friend';
  setupPhoto = (isGiftRecipient ? null : (profile.photo || null));
  var giftCard = $('gift-source-card');
  if (giftCard) giftCard.classList.toggle('hidden', !isGiftRecipient);
  if (isGiftRecipient) {
    var giverName = PACK_DATA.sourceGiftStudentName || 'زميلك';
    var giverGender = PACK_DATA.sourceGiftStudentGender || 'boy';
    var recipientGender = profile.gender || 'boy';
    var teacherGender = PACK_DATA.teacherGender || 'boy';
    var gt = giftSourceTerms(giverGender, recipientGender, teacherGender);
    $('gift-source-name').textContent = giverName;
    $('gift-source-role').textContent = gt.role;
    $('gift-source-description').textContent = gt.description + giftTrustBadge();
    /* 9.39.5 (R08): بيان ما في الإهداء وما سيتعلمه المهدى إليه، قبل أن يبدأ */
    var gcBox = document.getElementById('gift-contents-box');
    if (!gcBox){ gcBox = document.createElement('div'); gcBox.id = 'gift-contents-box'; gcBox.className = 'notice'; gcBox.style.cssText = 'white-space:pre-line;font-size:.84rem;margin-top:10px;text-align:right'; giftCard.appendChild(gcBox); }
    renderGiftContentsBox(gcBox);
    $('gift-teacher-line').textContent = gt.teacher + (PACK_DATA.teacherName ? ' ' + PACK_DATA.teacherName : '');
    $('gift-source-action').textContent = gt.action;
    var giverPhoto = PACK_DATA.sourceGiftStudentPhoto || null;
    var giverAvatar = $('gift-source-avatar');
    if (giverPhoto) giverAvatar.innerHTML = '<img data-media="' + mediaRef('img', giverPhoto) + '" alt="صورة صاحب الإهداء">';
    else giverAvatar.innerHTML = '<span class="emoji">🌟</span>';
    var gsCard = $('gift-supervisor-card');
    if (gsCard) gsCard.classList.remove('hidden');
    var gsName = $('gift-supervisor-name'); if (gsName) gsName.textContent = PACK_DATA.teacherName || '—';
    var gsAvatar = $('gift-supervisor-avatar');
    if (gsAvatar) gsAvatar.innerHTML = PACK_DATA.teacherPhoto ? '<img data-media="'+mediaRef('img', PACK_DATA.teacherPhoto)+'" alt="صورة المعلم">' : '<span class="emoji">'+(teacherGender === 'girl' ? '👩‍🏫' : '👨‍🏫')+'</span>';
  } else {
    var gsCard2 = $('gift-supervisor-card'); if (gsCard2) gsCard2.classList.add('hidden');
  }
  if (setupPhoto){
    $('setup-photo-img').src = setupPhoto;
    $('setup-photo-img').classList.remove('hidden');
    $('setup-photo-placeholder').classList.add('hidden');
  } else {
    $('setup-photo-img').removeAttribute('src');
    $('setup-photo-img').classList.add('hidden');
    $('setup-photo-placeholder').classList.remove('hidden');
  }
  if (STATE.role === 'teacher') $('setup-title').textContent = 'بيانات المعلم المراجع';
  else if (detectMode() === 'friend') $('setup-title').textContent = 'بيانات مستلم الإعداد';
  else $('setup-title').textContent = 'قبل أن نبدأ';
  /* 9.40: «طالب جديد / تبديل الطالب» لا معنى له في أول تشغيل، ولا لمستلم الإهداء */
  if ($('btn-new-student')) $('btn-new-student').classList.toggle('hidden', STATE.role === 'teacher' || isGiftRecipient || !String(STATE.student.name || '').trim());
}
var SETUP_NEW_STUDENT = false;
function startNewStudent(){
  if (STATE.role === 'teacher') return;
  SETUP_NEW_STUDENT = true; // 9.39.5 (R12)
  $('setup-name').value = ''; setupPhoto = null;
  $('setup-photo-img').removeAttribute('src'); $('setup-photo-img').classList.add('hidden');
  $('setup-photo-placeholder').classList.remove('hidden');
  setSetupGender('boy'); $('setup-name').focus();
}
function setSetupGender(g){
  setupGender = g;
  $('setup-boy').classList.toggle('selected', g === 'boy');
  $('setup-girl').classList.toggle('selected', g === 'girl');
  var _ni = $('setup-name'); if (_ni) _ni.placeholder = (g === 'girl' ? 'اكتبي' : 'اكتب') + ' اسمك الكامل';
}
function imageFileLooksValid(file){
  if (!file) return false;
  if (file.type && /^image\//i.test(file.type)) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '');
}
function dataUrlBytes(dataUrl){
  var comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  var b64 = dataUrl.slice(comma+1);
  return Math.floor(b64.length * 3 / 4);
}
function compressCanvasImage(img, maxSide, maxBytes, qualityStart){
  var side = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  for (var pass=0; pass<4; pass++){
    var canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(img.naturalWidth*side));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*side));
    var ctx=canvas.getContext('2d'); if(!ctx) throw new Error('canvas');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    var q=qualityStart;
    for (var qi=0; qi<5; qi++){
      var out=canvas.toDataURL('image/jpeg',q);
      if(dataUrlBytes(out)<=maxBytes || (canvas.width<=480 && q<=0.62)) return out;
      q=Math.max(0.62,q-0.07);
    }
    side*=0.82;
  }
  return canvas.toDataURL('image/jpeg',0.62);
}
function handleSetupPhoto(event){
  var file = event.target.files && event.target.files[0]; if (!file) return;
  if (!imageFileLooksValid(file)){ alert('{اختر|اختاري} ملف صورة.'); event.target.value=''; return; }
  var reader = new FileReader();
  reader.onerror = function(){ alert('تعذرت قراءة الصورة. {اختر|اختاري} صورة أخرى.'); event.target.value=''; };
  reader.onload = function(e){
    var img = new Image();
    img.onerror = function(){ alert('هذا النوع من الصور لا يستطيع المتصفح قراءته مباشرة. إذا كانت HEIC/HEIF فاختر JPG أو PNG.'); event.target.value=''; };
    img.onload = function(){
      try {
        setupPhoto=compressCanvasImage(img, 800, 220*1024, 0.78);
        $('setup-photo-img').src=setupPhoto; $('setup-photo-img').classList.remove('hidden'); $('setup-photo-placeholder').classList.add('hidden');
      } catch(err){ alert('تعذر تجهيز الصورة. {اختر|اختاري} صورة أخرى.'); event.target.value=''; }
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveSetup(){
  var name = ($('setup-name').value || '').trim();
  if (!name){ toast('✍️ اكتب اسمك أولًا / اكتبي اسمك أولًا'); try { $('setup-name').focus(); } catch(e){} return; }
  if (STATE.role === 'teacher') {
    TEACHER_STATE.name = name; TEACHER_STATE.gender = setupGender; TEACHER_STATE.photo = setupPhoto;
    PACK_DATA.teacherName = name;
    PACK_DATA.teacherGender = setupGender;
    PACK_DATA.teacherPhoto = setupPhoto || null;
    showTeacherReview(); return;
  }
  var currentMode = detectMode();
  if (currentMode === 'friend') {
    // Switch storage namespace (localStorage + IndexedDB) to the recipient BEFORE saving,
    // otherwise state is written under the guest keys and lost on the next load.
    switchStudentProfile(name, newStudentId()); // 9.39.5: مستلم الإهداء ملف مستقل دائمًا، فلا يطغى على طالب بالاسم نفسه
    STATE.student = {id:CURRENT_PROFILE_ID, name:name, gender:setupGender, photo:setupPhoto, supervisorName:'', supervisorGender:'boy'};
    STATE.progress = {};
    STATE.stats = {totalPoints:0,completedSections:0,perfectSections:0,totalAttempts:0};
    STATE.studentAudios = {};
    STATE.role = 'student';
    STATE.recipientOnboarded = true;
    localStorage.setItem(ACTIVE_PROFILE_KEY, name);
    save();
    applyTheme();
    show('view-home'); renderHome();
    toast('🎁 أهلاً بك يا ' + name + '! هذه إعداداتك التعليمية الجديدة.'); confetti(30);
    askConsentAfterSetup();
    return;
  }
  var curName = String(STATE.student.name || '').trim().toLowerCase();
  var packOwn = !!PACK_DATA.studentId && name.toLowerCase() === String(PACK_DATA.studentName || '').trim().toLowerCase();
  var _wantNew = SETUP_NEW_STUDENT; SETUP_NEW_STUDENT = false;
  if ((name.toLowerCase() !== curName || _wantNew) && !packOwn) switchStudentProfile(name, chooseProfileForName(name).id);
  else if (!CURRENT_PROFILE_ID) switchStudentProfile(name, STATE.student.id || PACK_DATA.studentId || newStudentId());
  localStorage.setItem(ACTIVE_PROFILE_KEY, name);
  STATE.student.name = name;
  STATE.student.gender = setupGender;
  STATE.student.photo = setupPhoto;
  STATE.student.id = CURRENT_PROFILE_ID || STATE.student.id || PACK_DATA.studentId || newStudentId();
  save();
  applyTheme();
  if (currentMode === 'student-returned') {
    renderTFView(); show('view-tf'); toast('أهلاً يا ' + name + '! راجع ملاحظات المعلم.');
    askConsentAfterSetup();
    return;
  }
  show('view-home'); renderHome();
  toast('🎉 أهلاً يا ' + name + '!'); confetti(30);
  askConsentAfterSetup();
}
function applyTheme(){
  document.body.classList.remove('theme-boy','theme-girl');
  document.body.classList.add('theme-' + (STATE.student.gender || 'boy'));
}


function detectMode(){
  var type = PACK_DATA.packageType;
  if (type === 'student_returned') return 'student-returned';
  if (type === 'approved_gift' || PACK_DATA.approved === true) return 'friend';
  if (type === 'student_submission' || type === 'teacher_review') return 'teacher-review';
  if (PACK_DATA.studentName) return 'user-choice';
  if (hasTeacherFeedbacks()) return 'student-returned';
  return 'student-fresh';
}
function isGenericName(n){ n = String(n || '').trim(); return !n || ['الشيخ', 'المشرف', 'المشرفة', 'المعلم', 'المعلمة', '—'].indexOf(n) >= 0; }
 // 9.39.12 (I4)
function buildSplash(){
  var isGirl = false;
  var av = $('splash-avatar');
  var mode = detectMode();
  if (mode === 'friend' && PACK_DATA.sourceGiftStudentPhoto) av.innerHTML = '<img data-media="' + mediaRef('img', PACK_DATA.sourceGiftStudentPhoto) + '" alt="صورة صاحب الإهداء">';
  else if (PACK_DATA.supervisorPhoto || PACK_DATA.sheikhPhoto) av.innerHTML = '<img data-media="' + mediaRef('img', (PACK_DATA.supervisorPhoto || PACK_DATA.sheikhPhoto)) + '" alt="">';
  else av.innerHTML = '<span class="emoji">🌟</span>';

  var skipBtn = document.querySelector('.splash-skip');
  if (skipBtn) skipBtn.textContent = mode === 'teacher-review' ? '👨‍🏫 فتح شاشة المراجعة' : mode === 'student-returned' ? '📢 عرض ملاحظات المعلم' : '← تخطي';
  var splash = $('view-splash');
  splash.classList.remove('teacher-mode','friend-mode','returned-mode');
  /* 9.40: في الفتح العادي زر «ابدأ» واضح بدل «تخطي»، ولا شارة «إعداد تعليمي» لا تعني للطفل شيئًا */
  var plain = mode !== 'friend' && mode !== 'student-returned' && mode !== 'teacher-review' && mode !== 'user-choice';
  if (skipBtn){ skipBtn.classList.toggle('start', plain); if (plain) skipBtn.textContent = '▶ ابدأ'; }
  $('splash-badge').classList.toggle('hidden', plain);

  if (mode === 'friend'){
    splash.classList.add('friend-mode');
    var sg = PACK_DATA.sourceGiftStudentGender || 'boy';
    var tg = PACK_DATA.teacherGender || 'boy';
    $('splash-badge').textContent = '🎓 إعداد المشرف';
    $('splash-from').textContent = 'إهداء من ' + (sg === 'girl' ? 'زميلتك ' : 'زميلك ') + (PACK_DATA.sourceGiftStudentName || (sg === 'girl' ? 'إحدى زميلاتك' : 'أحد زملائك'));
    $('splash-role').textContent = sg === 'girl' ? 'إهداء من زميلتك' : 'إهداء من زميلك';
    $('splash-name').textContent = 'بإشراف ' + (tg === 'girl' ? 'المعلمة' : 'المعلم') + (PACK_DATA.teacherName && PACK_DATA.teacherName !== 'المعلم' ? ' ' + PACK_DATA.teacherName : '');
    $('splash-hint').textContent = '{أدخل|أدخلي} اسمك وجنسك وصورتك، ثم تبدأ رحلتك أنت.';
  } else if (mode === 'student-returned'){
    splash.classList.add('returned-mode');
    $('splash-badge').textContent = '📢 تعليقات المعلم';
    $('splash-from').textContent = '{راجع|راجعي} تسجيلاتك';
    $('splash-role').textContent = 'تعليقات المعلم';
    $('splash-name').textContent = 'بانتظارك ' + (PACK_DATA.studentName || '') + '!';
    $('splash-hint').textContent = 'اضغط تخطي لعرض تعليقات المعلم.';
  } else if (mode === 'teacher-review'){
    splash.classList.add('teacher-mode');
    $('splash-badge').textContent = '📨 ملف مراجعة الطالب';
    $('splash-from').textContent = 'هذا الملف مخصص للمعلم المشرف';
    $('splash-role').textContent = 'مراجعة تسجيلات الطالب';
    $('splash-name').textContent = PACK_DATA.studentName || '—';
    $('splash-hint').textContent = 'اضغط للمتابعة إلى شاشة مراجعة التسجيلات.';
  } else {
    var spN = PACK_DATA.supervisorName || PACK_DATA.sheikhName || '';
    $('splash-badge').textContent = '🎓 إعداد تعليمي';
    if (isGenericName(spN)){ $('splash-from').textContent = 'مرحبًا بك في'; $('splash-role').textContent = 'رفاق التحفة'; $('splash-name').textContent = 'منهج تحفة الأطفال'; }
    else { $('splash-role').textContent = 'المشرف'; $('splash-name').textContent = spN; }
  }

  var g = $('splash-greetings'); g.innerHTML = '';
  var hasN = !!PACK_DATA.welcomeAudioNeutral;
  var hasM = !!PACK_DATA.welcomeAudioMale;
  var hasF = !!PACK_DATA.welcomeAudioFemale;
  if (hasN || hasM || hasF) {
    var h = document.createElement('div');
    h.style.cssText = 'font-size:.82rem;opacity:.9;margin-bottom:8px;width:100%';
    h.textContent = '🎧 {اسمع|اسمعي} التحية:';
    g.appendChild(h);
    if (hasN) g.appendChild(makeGreetBtn('🎧 عامة', PACK_DATA.welcomeAudioNeutral));
    if (hasM) g.appendChild(makeGreetBtn('👦 للأولاد', PACK_DATA.welcomeAudioMale));
    if (hasF) g.appendChild(makeGreetBtn('👧 للبنات', PACK_DATA.welcomeAudioFemale));
  }

  var rc = $('splash-role-choice');
  rc.innerHTML = '';
  if (mode === 'teacher-review'){
    rc.className = 'role-choice';
    var tb = document.createElement('button'); tb.type='button'; tb.className='teacher'; tb.textContent='👨‍🏫 فتح شاشة المراجعة';
    tb.onclick=function(){ STATE.role='teacher'; save(); continueFromSplash(); };
    rc.appendChild(tb);
  } else if (mode === 'user-choice'){
    rc.className = 'role-choice';
    rc.innerHTML = '<div data-style="font-size:.9rem;margin-bottom:6px;opacity:.9">من أنت؟</div>';
    var t = document.createElement('button');
    t.type = 'button'; t.className = 'teacher';
    t.textContent = '👨‍🏫 المعلم المشرف (مراجعة)';
    t.onclick = function(){ STATE.role = 'teacher'; save(); continueFromSplash(); };
    var s = document.createElement('button');
    s.type = 'button'; s.className = 'student';
    s.textContent = '👦 الطالب صاحب الملف';
    s.onclick = function(){ STATE.role = 'student'; save(); continueFromSplash(); };
    rc.appendChild(t); rc.appendChild(s);
  } else {
    rc.className = '';
  }
}
function makeGreetBtn(label, src){
  var b = document.createElement('button');
  b.type = 'button'; b.textContent = label;
  b.onclick = function(){
    document.querySelectorAll('audio').forEach(function(a){ try{ a.pause(); }catch(e){} });
    document.querySelectorAll('.splash-greetings button').forEach(function(x){ x.classList.remove('playing'); });
    var audio = new Audio(src);
    audio.play().catch(function(){});
    b.classList.add('playing');
    audio.onended = function(){ b.classList.remove('playing'); };
  };
  return b;
}
function continueFromSplash(){
  STATE.sawSplash = true; save();
  var mode = detectMode();
  // Package mode is authoritative: never let a stale local role or the Skip button turn a teacher package into a student session.
  if (mode === 'teacher-review') STATE.role = 'teacher';
  else if (mode === 'student-returned') STATE.role = 'student';
  else if (mode === 'friend') STATE.role = 'friend';
  else if (!STATE.role) STATE.role = 'student';

  if (STATE.role === 'teacher' && (PACK_DATA.packageType === 'student_submission' || PACK_DATA.packageType === 'teacher_review')){
    // A submission package is a teacher-review package. Never route it through
    // the student's profile/setup screen, even when this browser has stale state.
    showTeacherReview();
    return;
  }
  if (mode === 'friend' && STATE.recipientOnboarded && STATE.student && STATE.student.name) {
    // 9.41.1: الإقلاب يوجّه هذا الطفل إلى الخريطة؛ وإن وصل إلى هنا بأي طريق فلا يُمسح تقدّمه
    STATE.role = 'student'; save(); applyTheme(); show('view-home'); renderHome(); return;
  }
  if (mode === 'friend') {
    // Every approved gift starts with a fresh recipient profile. Never inherit the giver's profile.
    STATE.student = {name:'', gender:'boy', photo:null, supervisorName:'', supervisorGender:'boy'};
    STATE.progress = {};
    STATE.stats = {totalPoints:0,completedSections:0,perfectSections:0,totalAttempts:0};
    STATE.studentAudios = {};
    STATE.role = 'friend';
    STATE.sawSplash = true;
    save();
    buildSetup(); show('view-student-setup');
    return;
  }
  if (mode === 'student-returned' || STATE.role === 'student'){
    if (STATE.student.name){
      applyTheme();
      if (mode === 'student-returned') { renderTFView(); show('view-tf'); }
      else { show('view-home'); renderHome(); }
    } else {
      buildSetup();
      show('view-student-setup');
    }
  } else if (STATE.role === 'teacher'){
    buildSetup();
    show('view-student-setup');
  } else {
    buildSetup();
    show('view-student-setup');
  }
}
function editProfile(){ buildSetup(); show('view-student-setup'); }
