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
