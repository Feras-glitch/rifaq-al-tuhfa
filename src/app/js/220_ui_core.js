/* ===== أدوات الواجهة: العرض والتنقل والرسائل ===== */
/* 9.39.10: زر «رجوع» في الهاتف/المتصفح يعود داخل التطبيق (إلى الخريطة) بدل الخروج منه وفقد الاختبار الجاري */
var NAV_GUARD = false;
var NAV_DEEP = ['view-lesson','view-quiz','view-results','view-profile','view-certificate','view-preview'];
function currentViewId(){ for (var i = 0; i < NAV_DEEP.length; i++){ var el = document.getElementById(NAV_DEEP[i]); if (el && !el.classList.contains('hidden')) return NAV_DEEP[i]; } return null; }
function navGuardSync(id){
  if (NAV_DEEP.indexOf(id) < 0 || NAV_GUARD) return;
  try { history.pushState({rifaqNav: 1}, ''); NAV_GUARD = true; } catch(e){}
}
window.addEventListener('popstate', function(){
  if (!NAV_GUARD) return;
  NAV_GUARD = false;
  var cur = currentViewId(); if (!cur) return;
  if (cur === 'view-quiz' && !confirmLeaveQuiz()){ navGuardSync('view-quiz'); return; }
  if (cur === 'view-certificate' && typeof closeCertificate === 'function'){ try { closeCertificate(); return; } catch(e){} }
  goHome();
});
function detectTextType(q){
  if (q.textType) return q.textType;
  if (!q.text) return 'prose';
  if (q.text.indexOf('﴿') !== -1) return 'quran';
  return 'poem';
}
function termsForType(t){
  if (t === 'quran') return {masterBtn:'🎧 اسمع تلاوة الشيخ', recBtn:'🎙️ اتلُ الآية', recAgain:'🔄 {أعد|أعيدي} التلاوة', playBtn:'🔊 اسمع تلاوتك', badge:'📿 آية قرآنية'};
  if (t === 'poem') return {masterBtn:'🎧 اسمع إنشاد الشيخ', recBtn:'🎙️ أنشد البيت', recAgain:'🔄 {أعد|أعيدي} الإنشاد', playBtn:'🔊 اسمع إنشادك', badge:'📖 بيت منظوم'};
  return {masterBtn:'🎧 اسمع التسجيل', recBtn:'🎙️ سجّل', recAgain:'🔄 أعد', playBtn:'🔊 اسمع تسجيلك', badge:'📝 سؤال'};
}
function teacherByline(){
  var g = PACK_DATA.teacherGender === 'girl' ? 'المعلمة' : 'المعلم', n = String(PACK_DATA.teacherName || '').trim();
  if (!n || n === 'المعلم' || n === 'المعلمة') return g;
  if (/^(ال(شيخ|شيخة|معلم|معلمة|أستاذ|أستاذة|مقرئ|مقرئة)|أ\.|د\.)/.test(n)) return n;
  return g + ' ' + n;
}
function hasTeacherFeedbacks(){
  return !!(PACK_DATA.teacherFeedbacks && Object.keys(PACK_DATA.teacherFeedbacks).length > 0);
}


function $(id){ return document.getElementById(id); }
function escapeHTML(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]; });
}
function genderWord(gender, male, female){ return gender === 'girl' ? female : male; }
function personAvatarHTML(photo, gender, alt, size){
  var px = size || 46;
  var safeAlt = escapeHTML(alt || '');
  if (photo) return '<span class="person-avatar" data-style="width:'+px+'px;height:'+px+'px"><img data-media="'+mediaRef('img', photo)+'" alt="'+safeAlt+'"></span>';
  var emoji = gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️';
  return '<span class="person-avatar person-avatar-placeholder" data-style="width:'+px+'px;height:'+px+'px">'+emoji+'</span>';
}
function audioPersonBlock(photo, gender, name, label, audio, extraClass){
  if (!audio) return '';
  return '<div class="person-audio '+(extraClass||'')+'">'+personAvatarHTML(photo,gender,name,34)+'<div class="person-audio-main"><div class="person-audio-label">'+escapeHTML(label)+(name ? ' — '+escapeHTML(name) : '')+'</div><audio controls data-media="'+mediaRef('aud', audio)+'"></audio></div></div>';
}
function show(id){
  ['view-splash','view-student-setup','view-home','view-lesson','view-quiz','view-results','view-profile','view-teacher-review','view-tf','view-certificate','view-preview'].forEach(function(v){
    var el = $(v); if(!el) return;
    el.classList.toggle('hidden', v !== id);
  });
  if (id !== 'view-certificate' && id !== 'view-preview') window.scrollTo(0, 0);
  try { document.querySelectorAll('.confetti').forEach(function(c){ c.remove(); }); } catch(e){}
  navGuardSync(id);
}
function toast(m){
  var e = document.createElement('div');
  e.className = 'toast'; e.textContent = m;
  document.body.appendChild(e);
  setTimeout(function(){ e.remove(); }, 3000);
}
function confetti(n){
  var c = ['#FFC107','#E91E63','#2196F3','#4CAF50','#FF5722','#9C27B0','#00BCD4'];
  for (var i = 0; i < (n || 30); i++){
    var e = document.createElement('div');
    e.className = 'confetti';
    e.style.left = Math.random()*100 + '%';
    e.style.background = c[Math.floor(Math.random()*c.length)];
    e.style.animationDuration = (1.5 + Math.random()*1.5) + 's';
    document.body.appendChild(e);
    setTimeout(function(){ e.remove(); }, 3500);
  }
}
function showModal(t, b, actions){
  $('modal-title').textContent = t;
  $('modal-body').textContent = b;
  var a = $('modal-actions'); a.innerHTML = '';
  actions.forEach(function(x){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ' + (x.class || 'primary');
    btn.textContent = x.label; btn.style.margin = '4px';
    btn.onclick = x.action;
    a.appendChild(btn);
  });
  $('modal').classList.remove('hidden');
}
function closeModal(){ $('modal').classList.add('hidden'); }
function showReset(){
  /* 9.39.10: المسار المحمي نفسه لحذف بيانات الطفل (علامة دائمة، إبلاغ النوافذ، لا إعلان قبل الاكتمال، حذف النسخ في المضيفة)
     9.39.11 (ق5-أ): لم يعد له زر في الرئيسية، ويمر ببوابة ولي الأمر أينما استُدعي */
  parentalGate(function(){ deleteChildDataOnDevice(); }, 'التصفير يحذف بيانات الطالب من هذا الجهاز.');
}
function plainText(h){ var d = document.createElement('div'); d.innerHTML = String(h === undefined || h === null ? '' : h); return d.textContent.replace(/\s+/g, ' ').trim(); }
function toLatinDigits(s){ return String(s || '').replace(/[٠-٩]/g, function(d){ return String(d.charCodeAt(0) - 0x0660); }).replace(/[۰-۹]/g, function(d){ return String(d.charCodeAt(0) - 0x06F0); }).replace(/\s+/g, ''); }
/* صيغة {مذكر|مؤنث} تُختار حسب جنس الطفل المسجَّل */
/* 9.39: تمييز العدد العربي للعدادات */
function arCount(n, one, two, few){ n = Number(n) || 0; if (n === 1) return one + ' واحد'; if (n === 2) return two; if (n >= 3 && n <= 10) return n + ' ' + few; return n + ' ' + one + (one.slice(-1) === 'ة' ? '' : 'ًا'); }
function GT(t){ if (t === null || t === undefined) return t; var fem = !!(STATE.student && STATE.student.gender === 'girl'); return String(t).replace(/\{([^{}|]*)\|([^{}]*)\}/g, function(_, m, f){ return fem ? f : m; }); }
