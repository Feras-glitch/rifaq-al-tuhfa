/* ===== 9.42: الخريطة للأسرة: تنبيه آيفون، زر الإرسال، تكبير الخط، اختيار الطفل، مفتاح الخروج ===== */
var STORAGE_PERSISTED = null;
try { if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(function(ok){ STORAGE_PERSISTED = !!ok; }, function(){}); } catch(e){}

/* آيفون وآيباد خارج الشاشة الرئيسية: Safari يمحو تخزين الموقع بعد 7 أيام من استعماله دون تفاعل مع الموقع.
   التنبيه كان في صفحة الموقع الرئيسية وصفحة فتح الملف فقط، والطفل الذي يفتح التطبيق مباشرة لا يمر بهما. */
var IOS_HINT_KEY = STORAGE_BASE + '_ios_hint';
function isIosBrowserTab(){
  try {
    var ua = navigator.userAgent || '';
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!ios || location.protocol === 'file:') return false;
    var standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return !standalone;
  } catch(e){ return false; }
}
function iosHintDue(){
  if (!isIosBrowserTab()) return false;
  try { var t = Number(localStorage.getItem(IOS_HINT_KEY)) || 0; return Date.now() - t > 3 * 86400000; } catch(e){ return true; }
}
function dismissIosHint(){ try { localStorage.setItem(IOS_HINT_KEY, String(Date.now())); } catch(e){} var x = document.getElementById('ios-install-hint'); if (x) x.remove(); }

function unsentRecordingsCount(){
  var a = STATE.studentAudios || {};
  return Object.keys(a).filter(function(k){ return a[k] && (a[k].status === 'pending' || !a[k].status) && !a[k].sentAt; }).length;
}
/* ما يُعرض أعلى الخريطة بحسب الحال: تنبيه آيفون، وزر «أرسل لمعلمك» حين توجد تسجيلات لم تُرسل (كان الزر داخل «ملفي» فقط) */
function renderHomeExtras(){
  var box = document.getElementById('home-extras'); if (!box) return;
  box.innerHTML = '';
  if (iosHintDue()){
    var n = document.createElement('div'); n.id = 'ios-install-hint'; n.className = 'notice warn';
    var t = document.createElement('span'); t.textContent = '📲 على آيفون وآيباد: أضف التطبيق إلى الشاشة الرئيسية (زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية»)، وإلا قد يمحو Safari تقدّمك وتسجيلاتك بعد أسبوع دون استعمال. ';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.textContent = 'فهمت'; b.setAttribute('data-call', '["dismissIosHint"]');
    n.appendChild(t); n.appendChild(b); box.appendChild(n);
  }
  /* مراجعة مستحقة من المفاهيم المتقنة: كانت شريطًا يختفي بعد 15 ثانية وزرًّا داخل «ملفي» */
  try {
    var nowV = new Date().toISOString(), st = STATE.assess || null;
    var due = st && st.concepts ? assessDueReviews(st, nowV).filter(function(id){ return assessIsReady(st, id, nowV); }) : [];
    if (due.length){
      var rv = document.createElement('button'); rv.type = 'button'; rv.id = 'home-review-btn'; rv.className = 'btn gold block';
      rv.textContent = '🔄 مراجعة مستحقة اليوم (' + due.length + ')'; rv.setAttribute('data-call', '["startReviewSession"]'); box.appendChild(rv);
    }
  } catch(e){}
  var isGift = PACK_DATA.packageType === 'approved_gift' && !STATE.recipientOnboarded;
  var u = unsentRecordingsCount();
  if (u > 0 && STATE.role !== 'teacher' && !isGift){
    var s = document.createElement('button'); s.type = 'button'; s.id = 'home-send-btn'; s.className = 'btn primary block';
    s.textContent = '📨 ' + (STATE.student.gender === 'girl' ? 'أرسلي' : 'أرسل') + ' تسجيلاتك لمعلمك (' + u + ')';
    s.setAttribute('data-call', '["showExportDialog","submission"]'); box.appendChild(s);
  }
}

/* تكبير الخط: للأصغر سنًّا ولضعاف البصر. يُحفظ على الجهاز لا في ملف الطفل */
var BIG_TEXT_KEY = STORAGE_BASE + '_bigtext';
function applyBigText(){
  var on = false; try { on = localStorage.getItem(BIG_TEXT_KEY) === '1'; } catch(e){}
  document.documentElement.classList.toggle('big-text', on);
  var b = document.getElementById('btn-big-text'); if (b){ b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? '🔎 خط عادي' : '🔎 تكبير الخط'; }
  return on;
}
function toggleBigText(){
  var on = !document.documentElement.classList.contains('big-text');
  try { if (on) localStorage.setItem(BIG_TEXT_KEY, '1'); else localStorage.removeItem(BIG_TEXT_KEY); } catch(e){}
  applyBigText();
}

/* «من يتعلّم الآن؟»: على جهاز فيه أكثر من طفل تُعرض صورهم عند الفتح، بدل زر «تبديل الطالب» المخفي في الإعداد.
   تُعرض مرة في كل جلسة للتطبيق العادي فقط (لا لملف وصل باسم طفل بعينه، ولا للإهداء ولا للمراجعة). */
function profilesOnDevice(){
  var m = idMap(), out = [];
  Object.keys(m).forEach(function(id){
    var st = readStateAt(m[id].s); if (!st || !st.student || !String(st.student.name || '').trim()) return;
    out.push({id: id, name: String(st.student.name).slice(0, 40), gender: st.student.gender === 'girl' ? 'girl' : 'boy', photo: st.student.photo || null, lessons: Object.keys(st.progress || {}).length});
  });
  return out;
}
function maybeShowProfileChooser(){
  if (PACK_DATA.packageType !== 'student_fresh' || PACK_DATA.studentId || PACK_DATA.studentName) return false;
  try { if (sessionStorage.getItem('rifaq_child_picked') === '1') return false; } catch(e){}
  var list = profilesOnDevice(); if (list.length < 2) return false;
  if (document.getElementById('profile-chooser')) return true;
  var ov = document.createElement('div'); ov.id = 'profile-chooser'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'من يتعلّم الآن؟');
  var card = document.createElement('div'); card.className = 'pc-card';
  var h = document.createElement('h2'); h.style.cssText = 'margin:0;color:#283593'; h.textContent = '👋 من يتعلّم الآن؟'; card.appendChild(h);
  var grid = document.createElement('div'); grid.className = 'pc-grid';
  list.forEach(function(c){
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pc-child'; b.setAttribute('data-call', JSON.stringify(['pickProfile', c.id])); b.setAttribute('data-profile', c.id);
    var av = document.createElement('div'); av.className = 'pc-av';
    var src = c.photo ? imgSrc(c.photo) : '';
    if (src && IMG_DATA_RE.test(src)){ var im = document.createElement('img'); im.alt = ''; im.src = src; av.appendChild(im); } else av.textContent = c.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️';
    var nm = document.createElement('div'); nm.textContent = c.name;
    b.appendChild(av); b.appendChild(nm); grid.appendChild(b);
  });
  card.appendChild(grid); ov.appendChild(card); document.body.appendChild(ov);
  try { grid.querySelector('button').focus(); } catch(e){}
  return true;
}
function pickProfile(id){
  var m = idMap(); if (!m[id]) return;
  try { sessionStorage.setItem('rifaq_child_picked', '1'); } catch(e){}
  var ov = document.getElementById('profile-chooser'); if (ov) ov.remove();
  if (id === CURRENT_PROFILE_ID) return;
  try { localStorage.setItem(ACTIVE_ID_KEY, id); } catch(e){}
  STALE_TAB = true; // لا حفظ من حالة الطفل السابق قبل إعادة التحميل
  location.reload();
}

/* مفتاح الخروج يغلق أعلى نافذة مفتوحة تقبل الإغلاق (لا يغلق نموذج الموافقة ولا بوابة فيها عدّ تنازلي) */
document.addEventListener('keydown', function(e){
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.tagName !== 'BUTTON' && e.target.hasAttribute('data-call')){ e.preventDefault(); e.target.click(); return; }
  if (e.key !== 'Escape') return;
  var ids = ['move-guide', 'consent-intro', 'parent-gate', 'guardian-overlay'];
  for (var i = 0; i < ids.length; i++){ var el = document.getElementById(ids[i]); if (el){ el.remove(); return; } }
  var m = document.getElementById('modal'); if (m && !m.classList.contains('hidden')) closeModal();
});
