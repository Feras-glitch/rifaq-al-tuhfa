/* ===== QX core: تطبيع وفحص أنواع الأسئلة التفاعلية (مصدر واحد للتطبيق والاستوديو وأداة الفحص) ===== */
var QX = (function(){
  var types = {};
  function str(v, max){ return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200); }
  function arr(v){ return Array.isArray(v) ? v : []; }
  var CLUSTER;
  try { CLUSTER = new RegExp('[^\\p{M}\\u0640][\\p{M}\\u0640]*|[\\p{M}\\u0640]+', 'gu'); } catch (e) { CLUSTER = /[^\u064B-\u065F\u0670\u06D6-\u06ED\u0640][\u064B-\u065F\u0670\u06D6-\u06ED\u0640]*/g; }
  function clusters(w){ return w.match(CLUSTER) || [w]; }
  function parseMarked(text, open, close){
    // returns {clean, spans:[[start,end,label]]}
    var clean = '', spans = [], i = 0, cur = null;
    text = String(text || '');
    while (i < text.length){
      if (text.substr(i, open.length) === open){ if (cur) return {err: 'علامة فتح داخل علامة'}; cur = {s: clean.length, label: ''}; i += open.length; continue; }
      if (cur && text.substr(i, close.length) === close){ cur.e = clean.length; spans.push(cur); cur = null; i += close.length; continue; }
      clean += text.charAt(i); i++;
    }
    if (cur) return {err: 'علامة فتح بلا إغلاق'};
    return {clean: clean, spans: spans};
  }
  function baseOf(q){
    var tol = typeof q.tolerance === 'number' && q.tolerance >= 0 ? Math.min(Math.floor(q.tolerance), 5) : 1;
    return {id: str(q.id, 64), type: q.type, text: str(q.text, 300), hint: str(q.hint, 200), explanation: String(q.explanation === null || q.explanation === undefined ? '' : q.explanation).slice(0, 600),
            points: Number(q.points) > 0 ? Number(q.points) : 10, tolerance: tol, source: str(q.source, 120)};
  }
  /* ---- classify: السلال ---- */
  types.classify = { label: '🧺 السلال', hint: 'اختر البطاقة ثم اضغط على سلتها', normalize: function(q){
    var out = baseOf(q), errs = [], buckets = [], items = [];
    if (q.items && !Array.isArray(q.items) && typeof q.items === 'object'){
      Object.keys(q.items).forEach(function(b){ var bi = buckets.length; buckets.push(str(b, 40)); arr(q.items[b]).forEach(function(t){ items.push({t: str(t, 80), b: bi}); }); });
    } else {
      arr(q.buckets).forEach(function(b){ buckets.push(str(b, 40)); });
      arr(q.items).forEach(function(it){ var bi = buckets.indexOf(str(it && it.to, 40)); if (bi < 0) errs.push('سلة غير معروفة: ' + (it && it.to)); else items.push({t: str(it.t, 80), b: bi}); });
    }
    if (buckets.length < 2 || buckets.length > 5) errs.push('عدد السلال يجب أن يكون 2–5');
    if (new Set(buckets).size !== buckets.length) errs.push('أسماء سلال مكررة');
    if (items.length < 2 || items.length > 12) errs.push('عدد البطاقات يجب أن يكون 2–12');
    if (items.some(function(i){ return !i.t; })) errs.push('بطاقة فارغة');
    out.buckets = buckets; out.items = items; return {q: out, errors: errs};
  }};
  /* ---- hunt: الصيد ---- */
  types.hunt = { label: '🎯 اصطد الحكم', hint: 'اضغط على الموضع الصحيح', normalize: function(q){
    var out = baseOf(q), errs = [], unit = q.unit === 'letter' ? 'letter' : 'word';
    var pm = parseMarked(q.ayah, '[[', ']]');
    if (pm.err){ errs.push(pm.err); out.words = []; out.unit = unit; return {q: out, errors: errs}; }
    var words = [], pos = 0, hits = 0;
    pm.clean.split(' ').forEach(function(w){
      if (!w){ pos += 1; return; }
      var parts = unit === 'letter' ? clusters(w) : [w], res = [], p = pos;
      parts.forEach(function(t){
        var hit = pm.spans.some(function(s){ return p < s.e && p + t.length > s.s; });
        res.push({t: t, hit: hit}); if (hit) hits++; p += t.length;
      });
      words.push(res); pos += w.length + 1;
    });
    if (!hits) errs.push('لا توجد مواضع صحيحة مؤشرة بـ [[ ]]');
    if (words.length < 1 || words.length > 60) errs.push('عدد الكلمات غير مناسب');
    out.words = words; out.unit = unit; out.total = hits; return {q: out, errors: errs};
  }};
  /* ---- paint: لوّن الآية ---- */
  types.paint = { label: '🎨 لوّن الآية', hint: 'اختر لونًا ثم اضغط على الكلمة المناسبة', normalize: function(q){
    var out = baseOf(q), errs = [];
    var pm = parseMarked(q.ayah, '[[', ']]');
    if (pm.err){ errs.push(pm.err); out.tokens = []; out.rules = []; return {q: out, errors: errs}; }
    // كل علامة [[كلمة|حكم]] تصبح رمزًا واحدًا؛ نعيد قراءة النص الأصلي لاستخراج التسمية
    var raw = String(q.ayah || ''), re = /\[\[([^\]|]+)\|([^\]]+)\]\]/g, m, marks = [];
    while ((m = re.exec(raw))) marks.push({word: str(m[1], 60), rule: str(m[2], 40), idx: m.index, len: m[0].length});
    if (/\[\[(?![^\]]*\|)/.test(raw)) errs.push('كل علامة يجب أن تكون [[كلمة|حكم]]');
    var tokens = [], last = 0, rules = [];
    marks.forEach(function(mk){
      raw.substring(last, mk.idx).split(' ').forEach(function(w){ w = str(w, 60); if (w) tokens.push({t: w, rule: null}); });
      tokens.push({t: mk.word, rule: mk.rule}); if (rules.indexOf(mk.rule) < 0) rules.push(mk.rule); last = mk.idx + mk.len;
    });
    raw.substring(last).split(' ').forEach(function(w){ w = str(w, 60); if (w) tokens.push({t: w, rule: null}); });
    arr(q.extraRules).forEach(function(r){ r = str(r, 40); if (r && rules.indexOf(r) < 0) rules.push(r); });
    if (!marks.length) errs.push('لا توجد كلمات مؤشرة');
    if (rules.length < 2 || rules.length > 6) errs.push('عدد الأحكام (الألوان) يجب أن يكون 2–6');
    if (tokens.length > 40) errs.push('نص طويل');
    out.tokens = tokens; out.rules = rules; out.total = marks.length; return {q: out, errors: errs};
  }};
  /* ---- match: وصّل ---- */
  types.match = { label: '🔗 وصّل', hint: 'اختر من اليمين ثم ما يناسبه من اليسار', normalize: function(q){
    var out = baseOf(q), errs = [], pairs = [];
    arr(q.pairs).forEach(function(p){ p = arr(p); var a = str(p[0], 60), b = str(p[1], 60); if (!a || !b) errs.push('زوج ناقص'); else pairs.push([a, b]); });
    if (pairs.length < 2 || pairs.length > 6) errs.push('عدد الأزواج يجب أن يكون 2–6');
    if (new Set(pairs.map(function(p){ return p[0]; })).size !== pairs.length) errs.push('عناصر مكررة في العمود الأول');
    if (new Set(pairs.map(function(p){ return p[1]; })).size !== pairs.length) errs.push('عناصر مكررة في العمود الثاني');
    out.pairs = pairs; return {q: out, errors: errs};
  }};
  /* ---- order: رتّب ---- */
  types.order = { label: '🚂 رتّب', hint: 'اضغط القطع بالترتيب الصحيح', normalize: function(q){
    var out = baseOf(q), errs = [];
    out.pieces = arr(q.pieces).map(function(p){ return str(p, 60); }).filter(Boolean);
    out.extra = arr(q.extra).map(function(p){ return str(p, 60); }).filter(Boolean).slice(0, 3);
    if (out.pieces.length < 2 || out.pieces.length > 8) errs.push('عدد القطع يجب أن يكون 2–8');
    if (new Set(out.pieces).size !== out.pieces.length) errs.push('قطع مكررة');
    return {q: out, errors: errs};
  }};
  /* ---- cloze: أكمل الفراغ ---- */
  types.cloze = { label: '✍️ أكمل', hint: 'اختر الكلمة المناسبة للفراغ', normalize: function(q){
    var out = baseOf(q), errs = [], parts = [], raw = String(q.sentence || ''), re = /\{\{([^}]+)\}\}/g, m, last = 0, blanks = 0;
    while ((m = re.exec(raw))){ if (m.index > last) parts.push({t: str(raw.substring(last, m.index), 200, true) || ' '}); parts.push({blank: str(m[1], 60)}); blanks++; last = m.index + m[0].length; }
    if (last < raw.length) parts.push({t: raw.substring(last).slice(0, 200)});
    // الحفاظ على الفراغات بين الأجزاء
    parts = []; last = 0; re.lastIndex = 0;
    while ((m = re.exec(raw))){ parts.push({t: raw.substring(last, m.index).slice(0, 200)}); parts.push({blank: str(m[1], 60)}); last = m.index + m[0].length; }
    parts.push({t: raw.substring(last).slice(0, 200)});
    if (blanks < 1 || blanks > 4) errs.push('عدد الفراغات يجب أن يكون 1–4');
    out.parts = parts; out.distractors = arr(q.distractors).map(function(p){ return str(p, 60); }).filter(Boolean).slice(0, 4);
    return {q: out, errors: errs};
  }};
  var BASE = ['id', 'type', 'text', 'hint', 'explanation', 'points', 'tolerance', 'source'];
  function normalize(q){
    var t = types[q && q.type]; if (!t) return {q: null, errors: ['نوع غير معروف: ' + (q && q.type)]};
    var r = t.normalize(q); if (!r.q.id) r.errors.push('معرّف السؤال فارغ'); if (!r.q.text) r.errors.push('نص التعليمات فارغ'); if (!r.q.explanation) r.errors.push('التعليل فارغ');
    // نحتفظ بحقول التأليف الأصلية (لتبقى العملية متكررة الأمان عند إعادة تحميل الحزمة) ونضع المشتق في _x
    var fin = {}, x = {};
    Object.keys(q).forEach(function(k){ if (k !== '_x') fin[k] = q[k]; });
    BASE.forEach(function(k){ fin[k] = r.q[k]; });
    Object.keys(r.q).forEach(function(k){ if (BASE.indexOf(k) < 0) x[k] = r.q[k]; });
    fin._x = x; return {q: fin, errors: r.errors};
  }
  return {types: types, has: function(t){ return !!types[t]; }, normalize: normalize, clusters: clusters, str: str};
})();
/* 9.39.2: المنهج المستورد كان يُدرج في الصفحة كـHTML خام، والمعرّف داخل onclick: منهج JSON مصنوع ينفّذ سكربتًا
   في منشأ يحوي تسجيلات الأطفال ومفتاح توقيع المعلم. نعقّم كل نص بقائمة الوسوم نفسها التي يستعملها التطبيق،
   ونرفض أي معرّف خارج [A-Za-z0-9_-]. */
var STUDIO_SAFE_TAGS = {BR:1,B:1,I:1,U:1,STRONG:1,EM:1,SPAN:1,SMALL:1,SUB:1,SUP:1};
var STUDIO_DROP_TAGS = {SCRIPT:1,STYLE:1,IFRAME:1,OBJECT:1,EMBED:1,LINK:1,META:1,TEMPLATE:1,NOSCRIPT:1,SVG:1,MATH:1,FORM:1,INPUT:1,BUTTON:1,TEXTAREA:1,SELECT:1,BASE:1,FRAME:1,FRAMESET:1,IMG:1,VIDEO:1,AUDIO:1};
function studioSafeHTML(html){
  if (html === null || html === undefined) return html;
  var doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html), 'text/html');
  (function walk(node){
    Array.prototype.slice.call(node.childNodes).forEach(function(ch){
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1){ node.removeChild(ch); return; }
      var tag = String(ch.tagName).toUpperCase();
      if (STUDIO_DROP_TAGS[tag]){ node.removeChild(ch); return; }
      if (!STUDIO_SAFE_TAGS[tag]){ walk(ch); while (ch.firstChild) node.insertBefore(ch.firstChild, ch); node.removeChild(ch); return; }
      Array.prototype.slice.call(ch.attributes).forEach(function(a){ if (!(a.name === 'class' && /^[\w\- ]{1,60}$/.test(a.value))) ch.removeAttribute(a.name); });
      walk(ch);
    });
  })(doc.body);
  return doc.body.innerHTML;
}
var STUDIO_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
var STUDIO_RAW_KEYS = {id:1, type:1, answer:1, points:1, textType:1, unit:1, tolerance:1};
function studioSanitizeCurriculum(v, key, depth){
  if (depth > 30) return null;
  if (typeof v === 'string') return STUDIO_RAW_KEYS[key] ? v : studioSafeHTML(v);
  if (Array.isArray(v)) return v.map(function(x){ return studioSanitizeCurriculum(x, key, depth + 1); });
  if (v && typeof v === 'object'){
    var o = {};
    Object.keys(v).forEach(function(k){ if (k !== '__proto__') o[k] = studioSanitizeCurriculum(v[k], k, depth + 1); });
    return o;
  }
  return v;
}
function studioValidateCurriculum(cur){
  var E = [], ids = {}, n = {};
  if (!Array.isArray(cur) || !cur.length) return {errors: ['الملف يجب أن يكون مصفوفة أقسام غير فارغة'], counts: {}};
  cur.forEach(function(sec){
    if (!sec || !sec.id || !sec.title){ E.push('قسم بلا id أو عنوان'); return; }
    if (!STUDIO_ID_RE.test(String(sec.id))) E.push('معرّف قسم غير صالح: ' + String(sec.id).slice(0, 40));
    (sec.items || []).concat(sec.questions || [], sec.examQuestions || []).forEach(function(x){ if (x && x.id !== undefined && !STUDIO_ID_RE.test(String(x.id))) E.push('معرّف غير صالح: ' + String(x.id).slice(0, 40)); });
    (sec.items || []).forEach(function(it){ if (!it.id || ids[it.id]) E.push('معرّف عنصر مفقود أو مكرر: ' + it.id); ids[it.id] = 1; if (!it.text) E.push(sec.id + '/' + it.id + ': نص فارغ'); });
    (sec.questions || []).concat(sec.examQuestions || []).forEach(function(q){
      if (!q.id || ids[q.id]) E.push('معرّف سؤال مفقود أو مكرر: ' + q.id); ids[q.id] = 1; n[q.type || 'multiple_choice'] = (n[q.type || 'multiple_choice'] || 0) + 1;
      if (QX.has(q.type)){ QX.normalize(q).errors.forEach(function(e){ E.push(sec.id + '/' + q.id + ' (' + q.type + '): ' + e); }); return; }
      if (q.type === 'true_false'){ if (typeof q.answer !== 'boolean') E.push(q.id + ': answer يجب true/false'); }
      else if (!q.type || q.type === 'multiple_choice' || q.type === 'extraction'){ if (!Array.isArray(q.options) || q.options.length < 2 || !(q.answer >= 0 && q.answer < q.options.length)) E.push(q.id + ': options/answer غير صالحة'); }
      else E.push(q.id + ': نوع غير معروف ' + q.type);
      if (!q.explanation) E.push(q.id + ': تعليل فارغ');
    });
  });
  return {errors: E, counts: n};
}
function importCurriculum(ev){
  var f = ev.target.files && ev.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function(){
    var st = $('curr-status'), data;
    try { data = JSON.parse(r.result); } catch (e){ st.className = 'notice warn'; st.textContent = '❌ الملف ليس JSON صالحًا: ' + e.message; return; }
    /* 9.39 (R05): ملف المنهج المعتمد بصيغة {meta, sections} يُقبل كما هو */
    if (data && !Array.isArray(data) && Array.isArray(data.sections)) data = data.sections;
    data = studioSanitizeCurriculum(data, '', 0);
    var v = studioValidateCurriculum(data);
    if (v.errors.length){ st.className = 'notice warn'; st.textContent = '❌ لم يُستورد المنهج (' + v.errors.length + ' خطأ): ' + v.errors.slice(0, 6).join(' | '); return; }
    CURRICULUM = data; RECORDING_LIST = buildRecordingList(); TOTAL = RECORDING_LIST.length;
    var keep = {}; RECORDING_LIST.forEach(function(x){ keep[x.id] = 1; });
    var dropped = 0; Object.keys(STATE.recordings).forEach(function(k){ if (!keep[k]){ delete STATE.recordings[k]; dropped++; } });
    st.className = 'notice'; st.textContent = '✅ استُورد المنهج: ' + data.length + ' قسمًا، الأسئلة: ' + JSON.stringify(v.counts) + (dropped ? ' — حُذف ' + dropped + ' تسجيلًا لعناصر لم تعد موجودة' : '');
    renderStudio();
  };
  r.readAsText(f, 'utf-8'); ev.target.value = '';
}

var VERSE_NO = 0;
function buildRecordingList(){
  var list = []; VERSE_NO = 0;
  list.push({id:'_greeting_neutral',group:'greetings',label:'🎁 التحية العامة',text:'التحية التي يسمعها كل الطلاب',short:'التحية العامة'});
  list.push({id:'_greeting_male',group:'greetings',label:'👦 تحية للأولاد',text:'التحية المخصصة للأولاد',short:'للأولاد'});
  list.push({id:'_greeting_female',group:'greetings',label:'👧 تحية للبنات',text:'التحية المخصصة للبنات',short:'للبنات'});
  CURRICULUM.forEach(function(sec){
    (sec.items || []).forEach(function(it){
      var isQ = it.type === 'quran';
      if (isQ){ list.push({id:it.id,group:'quran',label:it.id + ' — آية',text:it.text,short:sec.title,isQuran:true}); return; }
      /* 9.39.16 (ق4): بيت لكل تسجيل؛ وتسجيل القسم كاملًا (إصدار سابق) يظهر ما دام موجودًا */
      if (typeof STATE !== 'undefined' && STATE.recordings && STATE.recordings[it.id]) list.push({id:it.id,group:'matn',label:'تسجيل القسم كاملًا (قديم)',text:'',short:sec.title,isQuran:false,legacy:true});
      String(it.text || '').split(/<br\s*\/?>/i).map(function(v){ return v.trim(); }).filter(Boolean).forEach(function(v, i){
        VERSE_NO++; list.push({id:it.id + '__v' + (i + 1),group:'matn',label:'البيت ' + VERSE_NO,text:v,short:sec.title,isQuran:false,verse:VERSE_NO});
      });
    });
  });
  CURRICULUM.forEach(function(sec){
    (sec.questions || []).forEach(function(q){
      if (q.type === 'extraction' && q.textType === 'quran' && q.recite !== false){
        list.push({id:q.id,group:'quran',label:q.id + ' — آية',text:q.text,short:q.source || '',isQuran:true});
      }
    });
  });
  return list;
}

var RECORDING_LIST = buildRecordingList();
var TOTAL = RECORDING_LIST.length;

var STATE = {
  sheikhName:'', sheikhPhoto:null, supervisorName:'', supervisorPhoto:null, poemReciterName:'', poemReciterPhoto:null,
  schoolName:'', schoolLogo:null,
  recordings:{},
  openGroups:{greetings:true, matn:false, quran:false}
};

var WORKSPACE_KEY = 'tohfa_studio_workspace_v913';
var WORKSPACE_ID = sessionStorage.getItem(WORKSPACE_KEY);
if (!WORKSPACE_ID){ WORKSPACE_ID = 'ws_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10); sessionStorage.setItem(WORKSPACE_KEY, WORKSPACE_ID); }
var DB_NAME = 'tohfa_studio_v913_' + WORKSPACE_ID;
var STORE = 'recordings';

function openDB(){
  return new Promise(function(res, rej){
    var req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function(){
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = function(){ res(req.result); };
    req.onerror = function(){ rej(req.error); };
  });
}
async function dbPut(key, blob){
  var db = await openDB();
  return new Promise(function(res, rej){
    var tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = function(){ res(true); };
    tx.onerror = function(){ rej(tx.error); };
  });
}
async function dbGet(key){
  var db = await openDB();
  return new Promise(function(res, rej){
    var tx = db.transaction(STORE,'readonly');
    var r = tx.objectStore(STORE).get(key);
    r.onsuccess = function(){ res(r.result || null); };
    r.onerror = function(){ rej(r.error); };
  });
}
async function dbDelete(key){
  var db = await openDB();
  return new Promise(function(res, rej){
    var tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = function(){ res(true); };
    tx.onerror = function(){ rej(tx.error); };
  });
}
async function dbGetAllKeys(){
  var db = await openDB();
  return new Promise(function(res, rej){
    var tx = db.transaction(STORE,'readonly');
    var r = tx.objectStore(STORE).getAllKeys();
    r.onsuccess = function(){ res(r.result || []); };
    r.onerror = function(){ rej(r.error); };
  });
}
async function dbClear(){
  var db = await openDB();
  return new Promise(function(res, rej){
    var tx = db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = function(){ res(true); };
    tx.onerror = function(){ rej(tx.error); };
  });
}

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
  if (!sheikhName){ alert('اكتب اسم الشيخ / قارئ القرآن أولاً.'); return; }
  if (!supervisorName){ alert('اكتب اسم المشرف أولاً.'); return; }
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

function renderStudio(){
  RECORDING_LIST = buildRecordingList(); TOTAL = RECORDING_LIST.length; // 9.39.16: تسجيلات القسم القديمة تظهر ما دامت موجودة
  var done = RECORDING_LIST.filter(function(x){ return STATE.recordings[x.id]; }).length;
  var pct = TOTAL ? Math.round(done / TOTAL * 100) : 0;
  $('progress-count').textContent = done + ' من ' + TOTAL;
  $('progress-pct').textContent = pct + '%';
  $('progress-fill').style.width = pct + '%';

  var html = '';
  html += buildGroupHTML('greetings','🎁','التحيات','تحية عامة + تحيتان');
  html += buildGroupHTML('matn','📖','المتن (المنظومة)','أبيات تحفة الأطفال');
  html += buildGroupHTML('quran','📿','الآيات القرآنية','آيات أسئلة الاستخراج');
  $('groups-container').innerHTML = html;

  Object.keys(STATE.openGroups).forEach(function(g){
    var el = document.querySelector('.group[data-group="' + g + '"]');
    if (el && STATE.openGroups[g]) el.classList.add('open');
  });

  document.querySelectorAll('.rec-item').forEach(function(item){
    var id = item.dataset.id;
    var blob = STATE.recordings[id];
    if (blob){
      var audio = item.querySelector('audio');
      if (audio && !audio.src) audio.src = URL.createObjectURL(blob);
    }
  });

  if (done === TOTAL){
    $('export-hint').className = 'notice success';
    $('export-hint').textContent = '✅ اكتملت جميع التسجيلات! جاهز للتصدير.';
    $('btn-export').disabled = false;
  } else if (done === 0){
    $('export-hint').className = 'notice warn';
    $('export-hint').textContent = '⚠️ لم تُسجّل أي شيء بعد.';
    $('btn-export').disabled = true;
  } else {
    $('export-hint').className = 'notice warn';
    $('export-hint').textContent = '⚠️ يوجد ' + (TOTAL - done) + ' عنصر بدون تسجيل.';
    $('btn-export').disabled = false;
  }
}

function buildGroupHTML(groupId, emoji, title, subtitle){
  var items = RECORDING_LIST.filter(function(x){ return x.group === groupId; });
  var doneCount = items.filter(function(x){ return STATE.recordings[x.id]; }).length;
  var html = '<div class="group" data-group="' + groupId + '">';
  html += '<div class="group-header" data-call=\'["toggleGroup","' + groupId + '"]\'>';
  html += '<div class="emoji">' + emoji + '</div>';
  html += '<div class="info"><div class="title">' + title + '</div><div class="subtitle">' + subtitle + '</div></div>';
  html += '<div class="counter' + (doneCount === items.length ? ' done' : '') + '">' + doneCount + '/' + items.length + '</div>';
  html += '<div class="arrow">▼</div></div>';
  html += '<div class="group-body">';
  if (groupId === 'matn') html += matnToolsHTML(items); // 9.39.16 (ق4)
  items.forEach(function(it){
    var hasRec = !!STATE.recordings[it.id];
    html += '<div class="rec-item' + (hasRec ? ' done' : '') + '" data-id="' + it.id + '">';
    html += '<div class="rec-label"><span class="dot"></span>' + it.label + (it.short && it.short !== it.label ? ' <span style="font-weight:400;color:#64748b;font-size:.8rem">(' + it.short + ')</span>' : '') + '</div>';
    html += '<div class="rec-text' + (it.isQuran ? ' quran' : '') + '">' + it.text + '</div>';
    html += '<div class="rec-actions">';
    if (hasRec){
      html += '<button class="btn success" data-call=\'["playRecording","' + it.id + '"]\' type="button">🔊 اسمع</button>';
      html += '<button class="btn gold" data-call=\'["startRec","' + it.id + '"]\' type="button">🔄 أعد</button>';
      html += '<button class="btn danger" data-call=\'["deleteRec","' + it.id + '"]\' type="button">🗑️</button>';
    } else {
      html += '<button class="btn primary" data-call=\'["startRec","' + it.id + '"]\' type="button">🎙️ سجّل</button>';
    }
    html += '<button class="btn ghost sm" data-call=\'["clickById","upload-' + it.id + '"]\' type="button">📁</button>';
    html += '<input type="file" id="upload-' + it.id + '" accept="audio/*" class="hidden" data-change="uploadRec" data-arg="' + it.id + '">';
    html += '</div>';
    html += '<div class="rec-status" id="status-' + it.id + '">' + (hasRec ? '✅ تم التسجيل' : '—') + '</div>';
    if (hasRec) html += '<div class="audio-preview"><audio controls></audio></div>';
    html += '</div>';
  });
  html += '</div></div>';
  return html;
}

/* 9.39.16 (ق4): إرشادات التسجيل وزر «سجّل البيت التالي» */
function nextVerseItem(){ return RECORDING_LIST.filter(function(x){ return x.group === 'matn' && x.verse && !STATE.recordings[x.id]; })[0] || null; }
function matnToolsHTML(items){
  var verses = items.filter(function(x){ return x.verse; }), left = verses.filter(function(x){ return !STATE.recordings[x.id]; }).length, nx = nextVerseItem();
  var h = '<div class="notice" style="margin-bottom:10px;font-size:.88rem;line-height:1.8">🎙️ <b>تسجيل المتن بيتًا بيتًا</b> (' + (verses.length - left) + ' من ' + verses.length + '):' +
    '<br>• غرفة هادئة، والهاتف على بعد شبر. • إيقاع إنشاد ثابت في كل الأبيات. • نصف ثانية صمت في أول التسجيل وآخره.' +
    '<br>• يُسجَّل بعد اعتماد الشيخ لضبط الأبيات (ورقة المراجعة: docs/MATN_REVIEW_SHEET.md)، فيطابق الصوت النص.</div>';
  if (nx) h += '<button class="btn primary" style="width:100%;margin-bottom:10px" data-call=\'["recordNextVerse"]\' type="button" id="btn-next-verse">🎙️ سجّل البيت التالي: ' + nx.label + ' (' + nx.short + ')</button>';
  else h += '<div class="notice success" style="margin-bottom:10px">✅ سُجّلت الأبيات كلها.</div>';
  return h;
}
function recordNextVerse(){
  var nx = nextVerseItem(); if (!nx) return;
  STATE.openGroups.matn = true;
  var el = document.querySelector('.group[data-group="matn"]'); if (el) el.classList.add('open');
  var row = document.querySelector('.rec-item[data-id="' + nx.id + '"]'); if (row) try { row.scrollIntoView({block: 'center'}); } catch(e){}
  startRec(nx.id);
}
function toggleGroup(g){
  STATE.openGroups[g] = !STATE.openGroups[g];
  var el = document.querySelector('.group[data-group="' + g + '"]');
  if (el) el.classList.toggle('open', STATE.openGroups[g]);
}

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
      renderStudio();
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


async function maybeCompressAudio(file){
  if (!file || !file.size || file.size <= 3*1024*1024) return file;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || typeof MediaRecorder === 'undefined') return file;
  var ctx = null;
  try {
    var buf = await file.arrayBuffer();
    ctx = new AC();
    var audioBuffer = await ctx.decodeAudioData(buf.slice(0));
    if (!audioBuffer || !audioBuffer.duration) throw new Error('decode');
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
      var prepared = await maybeCompressAudio(file);
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
