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
  /* 9.40: «اسمع وميّز»: قراءتان لكل سؤال، صحيحة وخاطئة عمدًا كما يصفها السؤال */
  CURRICULUM.forEach(function(sec){
    (sec.questions || []).forEach(function(q){
      if (q.type !== 'listen') return;
      list.push({id:q.id + '__ok',group:'listen',label:'✅ ' + q.id + ' — القراءة الصحيحة',text:'<b>' + q.word + '</b> — ' + q.rule,short:sec.title,isQuran:false});
      list.push({id:q.id + '__lahn',group:'listen',label:'❌ ' + q.id + ' — القراءة الخاطئة عمدًا',text:'<b>' + q.word + '</b> — اقرأ: ' + q.lahn,short:sec.title,isQuran:false});
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
  openGroups:{greetings:true, matn:false, quran:false, listen:false}
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

