/* 9.41: التسجيل بفريق — كل شخص يسجّل نصيبه على جهازه، ثم يدمج المشرف الحزم ويصدّر الملف النهائي.
   الأدوار: الشيخ (الآيات و«اسمع وميّز»)، منشد المتن (الأبيات)، المشرف (التحيات). جلسة متتابعة تعرض عنصرًا واحدًا كبيرًا
   بلا تنقّل، وحزمة JSON تحمل لكل تسجيل بصمة نصه، فلا يُدمج تسجيل نصٍّ تغيّر بعد مراجعة الشيخ. */
var REC_ROLES = {
  all:        {label: '👥 الكل',        groups: ['greetings', 'matn', 'quran', 'listen'], hint: 'كل التسجيلات على هذا الجهاز.'},
  sheikh:     {label: '🎙️ الشيخ',       groups: ['quran', 'listen'], hint: 'الآيات القرآنية، وقراءتا كل سؤال «اسمع وميّز» (الصحيحة والخاطئة عمدًا كما هو مكتوب).'},
  reciter:    {label: '📖 منشد المتن',  groups: ['matn'], hint: 'أبيات المتن بيتًا بيتًا، بإيقاع إنشاد ثابت.'},
  supervisor: {label: '🎁 المشرف',      groups: ['greetings'], hint: 'التحيات الثلاث، ثم دمج حزم الفريق وتصدير الملف النهائي.'}
};
var REC_ROLE_KEY = 'rifaq_studio_role_v1';
var REC_SESSION = null;   // {ids: [...], i: 0}

function recRole(){ try { var r = localStorage.getItem(REC_ROLE_KEY); if (REC_ROLES[r]) return r; } catch(e){} return 'all'; }
function setRecRole(r){
  if (!REC_ROLES[r]) return;
  try { localStorage.setItem(REC_ROLE_KEY, r); } catch(e){}
  REC_ROLES[r].groups.forEach(function(g){ STATE.openGroups[g] = true; });
  renderStudio();
}
function roleItems(role){
  var g = REC_ROLES[role || recRole()].groups;
  return RECORDING_LIST.filter(function(x){ return g.indexOf(x.group) >= 0 && !x.legacy; });
}
function recTextHash(x){ return reviewHash(String(x.group) + '|' + String(x.text || '')); }

function teamBarHTML(){
  var role = recRole(), items = roleItems(role), done = items.filter(function(x){ return STATE.recordings[x.id]; }).length;
  var h = '<div class="card team-bar"><h2>👥 من يسجّل على هذا الجهاز؟</h2><div class="team-roles">';
  Object.keys(REC_ROLES).forEach(function(k){
    h += '<button type="button" class="chip' + (k === role ? ' on' : '') + '" data-call=\'["setRecRole","' + k + '"]\'>' + REC_ROLES[k].label + '</button>';
  });
  h += '</div><div class="notice info team-hint">' + REC_ROLES[role].hint + ' <b>' + done + ' من ' + items.length + '</b></div>';
  if (done < items.length) h += '<button class="btn primary block" type="button" id="btn-rec-session" data-call=\'["openRecSession"]\'>▶️ جلسة تسجيل متتابعة (' + (items.length - done) + ' متبقٍّ)</button>';
  else h += '<div class="notice success">✅ سُجّل نصيب هذا الدور كله.</div>';
  h += '<div class="team-io">' +
    '<button class="btn ghost" type="button" data-call=\'["exportRecBundle"]\'>📤 أرسل تسجيلاتي (حزمة)</button>' +
    '<button class="btn ghost" type="button" data-call=\'["clickById","in-rec-bundle"]\'>📥 ادمج حزمة من الفريق</button>' +
    '<button class="btn ghost" type="button" data-call=\'["clickById","in-named-audio"]\'>📁 ملفات صوتية مسمّاة</button>' +
    '<button class="btn ghost" type="button" data-call=\'["openRecSheet"]\'>🖨️ ورقة التسجيل</button>' +
    '</div><div class="notice team-note">الحزمة ملف واحد فيه تسجيلات هذا الدور؛ يرسله صاحبه إلى المشرف فيدمجه. والملفات المسمّاة لمن سجّل خارج الاستوديو (بمسجّل احترافي مثلًا): اسم الملف هو رقم العنصر في «ورقة التسجيل»، مثل <code>r2_1.m4a</code>.</div></div>';
  return h;
}

/* ---------- الجلسة المتتابعة */
function openRecSession(){
  var ids = roleItems().filter(function(x){ return !STATE.recordings[x.id]; }).map(function(x){ return x.id; });
  if (!ids.length) return;
  REC_SESSION = {ids: ids, i: 0};
  var v = document.getElementById('rec-session');
  if (!v){ v = document.createElement('div'); v.id = 'rec-session'; v.className = 'rec-session'; document.body.appendChild(v); }
  v.classList.remove('hidden');
  renderRecSession();
}
function closeRecSession(){
  if (activeRecorder) return;
  REC_SESSION = null;
  var v = document.getElementById('rec-session'); if (v) v.classList.add('hidden');
  renderStudio();
}
function recSessionItem(){ if (!REC_SESSION) return null; var id = REC_SESSION.ids[REC_SESSION.i]; return RECORDING_LIST.filter(function(x){ return x.id === id; })[0] || null; }
function renderRecSession(){
  var v = document.getElementById('rec-session'); if (!v || !REC_SESSION) return;
  var it = recSessionItem(), n = REC_SESSION.ids.length;
  if (!it){
    v.innerHTML = '<div class="rs-card"><div class="rs-done">✅ انتهت الجلسة: سُجّل ' + REC_SESSION.ids.filter(function(id){ return STATE.recordings[id]; }).length + ' من ' + n + '.</div>' +
      '<button class="btn primary block" type="button" data-call=\'["closeRecSession"]\'>رجوع إلى الاستوديو</button></div>';
    return;
  }
  var recording = activeRecorder && activeItemId === it.id, has = !!STATE.recordings[it.id];
  v.innerHTML = '<div class="rs-card">' +
    '<div class="rs-top"><span>' + REC_ROLES[recRole()].label + ' · ' + (REC_SESSION.i + 1) + ' من ' + n + '</span>' +
    '<button class="btn ghost sm" type="button" data-call=\'["closeRecSession"]\'' + (recording ? ' disabled' : '') + '>✕ إنهاء</button></div>' +
    '<div class="progress-track"><div style="width:' + Math.round(REC_SESSION.i / n * 100) + '%"></div></div>' +
    '<div class="rs-label">' + it.label + (it.short && it.short !== it.label ? ' <span class="rs-short">(' + it.short + ')</span>' : '') + '</div>' +
    '<div class="rs-text' + (it.isQuran ? ' quran' : '') + '">' + studioSafeHTML(it.text) + '</div>' +
    '<div class="rs-status" id="rs-status">' + (recording ? '🔴 جارٍ التسجيل… اضغط «إيقاف» حين تنتهي' : has ? '✅ حُفظ. استمع، ثم انتقل إلى التالي أو أعد.' : 'اضغط «سجّل» واقرأ النص، ثم «إيقاف».') + '</div>' +
    '<div class="rs-actions">' +
    '<button class="btn ' + (recording ? 'danger' : 'primary') + ' rs-rec" type="button" data-call=\'["recSessionToggle"]\'>' + (recording ? '⏹️ إيقاف وحفظ' : has ? '🔄 أعد التسجيل' : '🎙️ سجّل') + '</button>' +
    (has && !recording ? '<button class="btn success" type="button" data-call=\'["playRecording","' + it.id + '"]\'>🔊 استمع</button>' : '') +
    '</div><div class="rs-nav">' +
    '<button class="btn ghost" type="button" data-call=\'["recSessionMove","-1"]\'' + (recording || REC_SESSION.i === 0 ? ' disabled' : '') + '>‹ السابق</button>' +
    '<button class="btn ' + (has ? 'gold' : 'ghost') + '" type="button" data-call=\'["recSessionMove","1"]\'' + (recording ? ' disabled' : '') + '>' + (has ? 'التالي ›' : 'تخطَّ ›') + '</button>' +
    '</div></div>';
}
async function recSessionToggle(){
  var it = recSessionItem(); if (!it) return;
  await startRec(it.id);
  renderRecSession();
}
function recSessionMove(d){
  if (!REC_SESSION || activeRecorder) return;
  REC_SESSION.i = Math.max(0, Math.min(REC_SESSION.ids.length, REC_SESSION.i + Number(d)));
  renderRecSession();
}
/* يُستدعى بعد حفظ أي تسجيل (من startRec) */
function recSessionAfterSave(itemId){ if (REC_SESSION) renderRecSession(); }

/* ---------- حزمة التسجيلات: تصدير ودمج */
async function exportRecBundle(){
  var role = recRole(), items = roleItems(role).filter(function(x){ return STATE.recordings[x.id]; });
  if (!items.length){ showModal('لا تسجيلات بعد', 'لم يُسجَّل شيء من نصيب «' + REC_ROLES[role].label + '» على هذا الجهاز.', [{label: 'حسنًا', class: 'primary', action: closeModal}]); return; }
  var out = {type: 'rifaq_recordings', v: 1, role: role, by: STATE.sheikhName || STATE.poemReciterName || STATE.supervisorName || '', at: new Date().toISOString(), appVersion: APP_VERSION, items: {}};
  for (var i = 0; i < items.length; i++){
    var x = items[i], b = STATE.recordings[x.id];
    out.items[x.id] = {h: recTextHash(x), data: await blobToBase64(b)};
  }
  var blob = new Blob([JSON.stringify(out)], {type: 'application/json'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'تسجيلات_' + role + '_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  log('bundle-exported', {role: role, count: items.length});
}
function dataURLToBlob(s){
  var m = /^data:(audio\/[a-z0-9.+\-]+(?:;codecs=[a-z0-9.,\-]+)?);base64,([A-Za-z0-9+\/]*=*)$/i.exec(String(s || ''));
  if (!m) return null;
  var bin = atob(m[2]), u8 = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], {type: m[1]});
}
/* يقرأ الحزمة ويقسمها: جديد، يتعارض مع تسجيل موجود، تغيّر نصه، غير معروف */
function planRecBundle(obj){
  var plan = {add: [], conflict: [], changed: [], unknown: [], bad: 0};
  if (!obj || obj.type !== 'rifaq_recordings' || obj.v !== 1 || !obj.items || typeof obj.items !== 'object') return null;
  Object.keys(obj.items).forEach(function(id){
    var r = obj.items[id], x = RECORDING_LIST.filter(function(y){ return y.id === id && !y.legacy; })[0];
    if (!x){ plan.unknown.push(id); return; }
    if (!r || r.h !== recTextHash(x)){ plan.changed.push(id); return; }
    var b = dataURLToBlob(r.data); if (!b || !b.size || b.size > 12 * 1024 * 1024){ plan.bad++; return; }
    (STATE.recordings[id] ? plan.conflict : plan.add).push({id: id, blob: b});
  });
  return plan;
}
async function applyRecPlan(plan, replace){
  var list = plan.add.concat(replace ? plan.conflict : []);
  for (var i = 0; i < list.length; i++){ await dbPut(list[i].id, list[i].blob); STATE.recordings[list[i].id] = list[i].blob; }
  renderStudio();
  var msg = 'أُضيف ' + plan.add.length + ' تسجيلًا' + (plan.conflict.length ? '، و' + (replace ? 'استُبدل ' : 'أُبقي تسجيلك في ') + plan.conflict.length : '') + '.';
  if (plan.changed.length) msg += '\n⚠️ ' + plan.changed.length + ' تسجيلًا لم يُدمج لأن نصه تغيّر بعد تسجيله (يُعاد تسجيله): ' + plan.changed.slice(0, 6).join('، ') + (plan.changed.length > 6 ? '…' : '');
  if (plan.unknown.length) msg += '\n⚠️ ' + plan.unknown.length + ' عنصرًا ليس في هذا المنهج.';
  if (plan.bad) msg += '\n⚠️ ' + plan.bad + ' تسجيلًا تالفًا أو كبيرًا جدًا.';
  log('bundle-merged', {added: plan.add.length, conflict: plan.conflict.length, replaced: !!replace, changed: plan.changed.length, unknown: plan.unknown.length});
  showModal('✅ دُمجت الحزمة', msg, [{label: 'حسنًا', class: 'primary', action: closeModal}]);
}
function importRecBundle(ev){
  var f = ev.target.files && ev.target.files[0]; ev.target.value = '';
  if (!f) return;
  if (f.size > 60 * 1024 * 1024){ showModal('الملف كبير جدًا', 'حجم الحزمة أكبر من 60 ميجابايت.', [{label: 'حسنًا', class: 'primary', action: closeModal}]); return; }
  var rd = new FileReader();
  rd.onload = function(){
    var obj = null; try { obj = JSON.parse(String(rd.result)); } catch(e){}
    var plan = planRecBundle(obj);
    if (!plan){ showModal('ليست حزمة تسجيلات', 'هذا الملف ليس «حزمة تسجيلات» من استوديو رفاق التحفة.', [{label: 'حسنًا', class: 'primary', action: closeModal}]); return; }
    if (!plan.conflict.length){ applyRecPlan(plan, false); return; }
    showModal('تسجيلات موجودة عندك', 'في الحزمة ' + plan.conflict.length + ' عنصرًا سجّلته أنت أيضًا على هذا الجهاز. أيّهما نُبقي؟', [
      {label: '📥 تسجيلات الحزمة', class: 'primary', action: function(){ closeModal(); applyRecPlan(plan, true); }},
      {label: '💾 تسجيلاتي', class: 'ghost', action: function(){ closeModal(); applyRecPlan(plan, false); }}
    ]);
  };
  rd.readAsText(f);
}
/* ملفات صوتية سُجّلت خارج الاستوديو: اسم الملف = رقم العنصر */
function importNamedAudio(ev){
  var files = Array.prototype.slice.call(ev.target.files || []); ev.target.value = '';
  if (!files.length) return;
  (async function(){
    var ok = [], unknown = [], bad = [], jobs = [], done = 0;
    files.forEach(function(f){
      var id = String(f.name || '').replace(/\.[A-Za-z0-9]{2,5}$/, '').trim();
      var x = RECORDING_LIST.filter(function(y){ return y.id === id && !y.legacy; })[0];
      if (!x){ unknown.push(f.name); return; }
      if (!(f.type && /^audio\//i.test(f.type)) && !/\.(mp3|m4a|aac|wav|ogg|oga|webm|mp4|opus)$/i.test(f.name || '')){ bad.push(f.name); return; }
      if (!f.size || f.size > 12 * 1024 * 1024){ bad.push(f.name); return; }
      jobs.push({f: f, id: id});
    });
    /* 9.41.1: الملف الأكبر من 3 ميجابايت يُضغط في زمن مدته، فتُعالَج ثلاثة ملفات معًا ويظهر التقدّم */
    var progress = function(){ showModal('⏳ جارٍ تجهيز الملفات', done + ' من ' + jobs.length + '\nالملف الكبير (WAV مثلًا) يُضغط في زمن مدته؛ الأسرع أن تُصدَّر الملفات من المسجّل بصيغة m4a أو mp3. لا تغلق الصفحة.', []); };
    if (jobs.length) progress();
    var next = 0;
    var worker = async function(){
      while (next < jobs.length){
        var j = jobs[next++];
        try { var p = await maybeCompressAudio(j.f); await dbPut(j.id, p); STATE.recordings[j.id] = p; ok.push(j.id); } catch(e){ bad.push(j.f.name); }
        done++; progress();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    renderStudio();
    log('named-audio', {ok: ok.length, unknown: unknown.length, bad: bad.length});
    showModal('📁 الملفات المسمّاة', 'أُضيف ' + ok.length + ' تسجيلًا.' + (unknown.length ? '\n⚠️ لا عنصر بهذا الاسم: ' + unknown.slice(0, 6).join('، ') + (unknown.length > 6 ? '…' : '') : '') + (bad.length ? '\n⚠️ ليست صوتًا صالحًا أو أكبر من 12 ميجابايت: ' + bad.slice(0, 6).join('، ') : ''), [{label: 'حسنًا', class: 'primary', action: closeModal}]);
  })();
}

/* ورقة التسجيل: رقم كل عنصر ونصه لهذا الدور، للطباعة أو للتسجيل خارج الاستوديو */
function openRecSheet(){
  var role = recRole(), items = roleItems(role);
  var v = document.getElementById('rec-sheet');
  if (!v){ v = document.createElement('div'); v.id = 'rec-sheet'; v.className = 'rec-sheet'; document.body.appendChild(v); }
  v.innerHTML = '<div class="rsh-bar"><button class="btn primary" type="button" data-call=\'["printRecSheet"]\'>🖨️ اطبع</button>' +
    '<button class="btn ghost" type="button" data-call=\'["closeRecSheet"]\'>✕ إغلاق</button></div>' +
    '<h2>ورقة التسجيل — ' + REC_ROLES[role].label + ' (' + items.length + ')</h2><p class="rsh-hint">' + REC_ROLES[role].hint + ' اسم كل ملف صوتي = رقمه في العمود الأول.</p>' +
    '<table class="rsh"><thead><tr><th>الرقم (اسم الملف)</th><th>النص</th><th>✓</th></tr></thead><tbody>' +
    items.map(function(x){ return '<tr><td dir="ltr"><code>' + x.id + '</code></td><td class="' + (x.isQuran ? 'quran' : '') + '"><div class="rsh-l">' + x.label + '</div>' + studioSafeHTML(x.text) + '</td><td>' + (STATE.recordings[x.id] ? '✅' : '') + '</td></tr>'; }).join('') +
    '</tbody></table>';
  v.classList.remove('hidden'); document.body.classList.add('sheet-open'); window.scrollTo(0, 0);
}
function closeRecSheet(){ var v = document.getElementById('rec-sheet'); if (v) v.classList.add('hidden'); document.body.classList.remove('sheet-open'); }
function printRecSheet(){ window.print(); }
