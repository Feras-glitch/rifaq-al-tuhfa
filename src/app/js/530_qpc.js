/* ===== 9.39.17: خط المصحف (QPC V2، مجمع الملك فهد) للآيات العثمانية ===== */
var QPC_PROBE = /* QPC_PROBE_BEGIN */@@QPC_PROBE@@/* QPC_PROBE_END */;
var QPC_OK = {}, QPC_LOADING = null;
/* يُعتمد خط الصفحة بعد أن يحمّله المتصفح فعلًا؛ قبل ذلك (أو إن تعذّر) يبقى نص تنزيل */
function qpcInit(){
  if (!document.fonts || typeof document.fonts.load !== 'function') return Promise.resolve(QPC_OK);
  return Promise.all(Object.keys(QPC_PROBE).map(function(p){
    return document.fonts.load('20px qpc' + p, QPC_PROBE[p]).then(function(fs){
      if (fs && fs.length && fs.every(function(f){ return f.status === 'loaded'; })) QPC_OK[p] = true;
    }, function(){});
  })).then(function(){ return QPC_OK; });
}
function qpcSkel(w){ return String(w).replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/ٱ/g, 'ا'); }
/* كلمات النص المعروض (بلا علامات الوقف المستقلة) مع علم الإبراز؛ مثل words_of في tools/build_qpc.py */
function qpcWords(text){
  var t = String(text || '').replace(/[﴾﴿]/g, ' ').replace(/<b>/g, ' \x01').replace(/<\/b>/g, '\x02 ');
  if (/[<>&]/.test(t)) return null;
  var out = [], inb = false;
  t.split(/\s+/).forEach(function(tok){
    if (!tok) return;
    if (tok.charAt(0) === '\x01'){ inb = true; tok = tok.slice(1); }
    var end = /\x02$/.test(tok); tok = tok.replace(/\x02+$/, '');
    if (tok && qpcSkel(tok).trim()) out.push({w: tok, b: inb});
    if (end) inb = false;
  });
  return out;
}
function cleanQpc(x){
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  var pg = function(n){ return typeof n === 'number' && n % 1 === 0 && n >= 1 && n <= 604; };
  if (!pg(x.p) || !Array.isArray(x.w) || !x.w.length || x.w.length > 400 || typeof x.k !== 'string' || x.k.length > 4000) return null;
  if (!x.w.every(function(g){ return typeof g === 'string' && /^[ﭐ-﷿]{1,4}$/.test(g); })) return null;
  var e = x.e === undefined ? [] : x.e;
  if (!Array.isArray(e) || !e.every(function(i){ return typeof i === 'number' && i % 1 === 0 && i >= 0 && i < x.w.length; })) return null;
  var out = {p: x.p, w: x.w.slice(), e: e.slice(), k: x.k};
  if (x.wp !== undefined){ if (!Array.isArray(x.wp) || x.wp.length !== x.w.length || !x.wp.every(pg)) return null; out.wp = x.wp.slice(); }
  return out;
}
function qpcHTML(text, raw, pivotId){
  var q = cleanQpc(raw); if (!q) return null;
  var ws = qpcWords(text); if (!ws || !ws.length) return null;
  var ends = {}, ne = 0; q.e.forEach(function(i){ if (!ends[i]){ ends[i] = 1; ne++; } });
  if (ws.length + ne !== q.w.length) return null;
  if (ws.map(function(x){ return qpcSkel(x.w); }).join(' ') !== q.k) return null; // النص تغيّر بعد البناء
  var pg = function(i){ return q.wp ? q.wp[i] : q.p; };
  for (var i = 0; i < q.w.length; i++) if (!QPC_OK[pg(i)]) return null;
  var hit = pivotId ? pivotHits(ws.map(function(x){ return x.w; }), pivotId) : {};
  var toks = [], j = 0;
  q.w.forEach(function(g, i){
    var t = {h: '<span class="qg qp' + pg(i) + (ends[i] ? ' qe' : '') + '">' + g + '</span>', b: false, pv: false, e: !!ends[i]};
    if (!ends[i]){ t.b = ws[j].b; t.pv = !!hit[j]; j++; }
    toks.push(t);
  });
  /* الكلمات المتتالية المبرزة في إطار واحد؛ وعلامة الآية لا تنفصل عن آخر كلمة قبلها في السطر */
  var sep = function(t){ return t.e ? '\u00a0' : ' '; }, body = '';
  for (var a = 0; a < toks.length;){
    var z = a; while (z + 1 < toks.length && toks[z + 1].b === toks[a].b && toks[z + 1].pv === toks[a].pv) z++;
    var s = toks[a].h; for (var m = a + 1; m <= z; m++) s += sep(toks[m]) + toks[m].h;
    if (toks[a].b) s = '<b>' + s + '</b>'; if (toks[a].pv) s = '<mark class="pivot">' + s + '</mark>';
    body += (a ? sep(toks[a]) : '') + s; a = z + 1;
  }
  return '<span class="qpc-sr">' + escapeHTML(plainText(text)) + '</span><span class="qpc" aria-hidden="true">' + body + '</span>';
}
function qpcHolder(id){
  var h = null;
  (CURRICULUM || []).forEach(function(s){ if (!s || h) return; (s.items || []).concat(s.questions || [], s.examQuestions || []).forEach(function(x){ if (!h && x && x.id === id) h = x; }); });
  return h;
}
/* بخط المصحف إن أمكن، وإلا نص تنزيل (مع الحكم المحوري عند المعلم) */
function quranHTML(text, holder, pivotId){
  var h = null; try { h = qpcHTML(text, holder && holder.qpc, pivotId); } catch(e){ h = null; }
  return h || (pivotId ? highlightPivot(text, pivotId) : text);
}
function arSkel(w){ return String(w || '').replace(/<[^>]+>/g, '').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640﴿﴾«»()،.]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim(); }
/* العبارات بين «» في سطر «🎯 مهمتك» هي موضع الحكم المحوري */
function pivotPhrases(id){
  var it = null; CURRICULUM.forEach(function(s){ (s.items || []).forEach(function(x){ if (x.id === id) it = x; }); });
  var m = String((it && it.desc) || '').replace(/<br>[\s\S]*$/, '').match(/«[^»]+»/g) || [];
  return m.map(function(x){ return x.slice(1, -1).trim(); }).filter(Boolean);
}
function highlightPivot(html, id){
  var phr = pivotPhrases(id); if (!phr.length || /<[a-z]/i.test(String(html))) return html;
  var toks = String(html).split(' '), hit = pivotHits(toks, id);
  return toks.map(function(t, i){ return hit[i] ? '<mark class="pivot">' + t + '</mark>' : t; }).join(' ');
}
function pivotHits(toks, id){
  var phr = pivotPhrases(id), keys = toks.map(arSkel), hit = {};
  /* الكلمة نفسها، أو بلا حرف عطف أو جر ملتصق في أولها، أو تزيد عليها حرفًا واحدًا في آخرها */
  var same = function(k, w){ var k2 = k.replace(/^[وفبل]/, ''); var pre = function(x){ return x.indexOf(w) === 0 && x.length - w.length <= 1; }; return k === w || k2 === w || (w.length >= 3 && (pre(k) || pre(k2))); };
  phr.forEach(function(p){
    var ws = p.split(/\s+/).map(arSkel).filter(function(w){ return w.length >= 1; });
    /* العبارة كاملة، وإلا أطول بداية منها (الرسم في سطر المهمة قد يختلف عن رسم المصحف في آخرها) */
    for (var n = ws.length; n >= 1; n--){
      var sub = ws.slice(0, n), found = false;
      if (n === 1 && sub[0].length < 2) break;
      for (var i = 0; i + n <= toks.length && !found; i++){
        if (sub.every(function(w, j){ return same(keys[i + j], w); })){ for (var j = 0; j < n; j++) hit[i + j] = 1; found = true; }
      }
      if (found) break;
    }
  });
  return hit;
}
function otherRulesOf(id){ var o = (PACK_DATA.teacherOtherRules || {})[id]; return Array.isArray(o) ? o.filter(function(k){ return RATING_CRITERIA.other[k]; }) : []; }
function toggleOtherRule(id, k){
  if (!RATING_CRITERIA.other[k] || !PACK_DATA.studentAudios || !PACK_DATA.studentAudios[id]) return;
  PACK_DATA.teacherOtherRules = PACK_DATA.teacherOtherRules || {};
  var o = otherRulesOf(id), i = o.indexOf(k); if (i >= 0) o.splice(i, 1); else o.push(k);
  if (o.length) PACK_DATA.teacherOtherRules[id] = o; else delete PACK_DATA.teacherOtherRules[id];
  showTeacherReview();
}
function ratingBlockHTML(it){
  var code = RATING_CRITERIA.tasks[it.id], rule = code && RATING_CRITERIA.rules[code], rstate = normRating((PACK_DATA.teacherRatings || {})[it.id]), h = '';
  if (rule){
    var phr = pivotPhrases(it.id);
    h += '<div class="pivot-line" data-style="margin:6px 0;font-size:.92rem">🎯 الحكم المحوري: <b>' + escapeHTML(rule.label) + '</b>' + (phr.length ? ' — عند ' + phr.map(function(p){ return '«' + escapeHTML(p) + '»'; }).join(' و') : '') + '</div>';
    h += '<details class="rubric"><summary>📏 معايير التقييم (مسودة تنتظر اعتماد الشيخ)</summary><div>👂 ' + escapeHTML(rule.listen) + '</div><div>✅ متقن: ' + escapeHTML(rule.mastered) + '</div><div>👍 جيد: ' + escapeHTML(rule.good) + '</div><div>🔁 يحتاج تدريبًا: ' + escapeHTML(rule.needs) + '</div></details>';
  }
  h += '<div class="rating-row" data-style="margin:8px 0;display:flex;gap:6px;flex-wrap:wrap">';
  Object.keys(RATING_STATES).forEach(function(k){ h += '<button class="btn ' + (rstate === k ? 'success' : 'ghost') + '" ' + ACT('setRating', it.id, k) + ' type="button">' + RATING_STATES[k] + '</button>'; });
  h += '<button class="btn ' + (rstate === 'unusable' ? 'gold' : 'ghost') + ' sm" ' + ACT('setRating', it.id, 'unusable') + ' type="button">' + RATING_UNUSABLE + '</button></div>';
  if (rstate === 'unusable') h += '<div class="notice warn" data-style="font-size:.85rem">التسجيل لا يصلح للتقييم فلا يُحسب درجة. اضغط «❌ رفض» ليعيد الطفل التسجيل.</div>';
  var others = otherRulesOf(it.id);
  h += '<div class="other-rules" data-style="font-size:.85rem;margin:4px 0;display:flex;gap:4px;flex-wrap:wrap;align-items:center"><span>📌 ملاحظة على حكم آخر (لا تغيّر الدرجة):</span>';
  Object.keys(RATING_CRITERIA.other).forEach(function(k){ h += '<button class="btn ' + (others.indexOf(k) >= 0 ? 'gold' : 'ghost') + ' sm" ' + ACT('toggleOtherRule', it.id, k) + ' type="button">' + escapeHTML(RATING_CRITERIA.other[k]) + '</button>'; });
  return h + '</div>';
}
function studentRatingNote(id){
  var r = normRating((PACK_DATA.teacherRatings || {})[id]), o = otherRulesOf(id), code = RATING_CRITERIA.tasks[id], rule = code && RATING_CRITERIA.rules[code], h = '';
  var who = genderWord(PACK_DATA.teacherGender || 'boy', 'المعلم', 'المعلمة');
  if (r === 'unusable') h += '<div class="notice warn" data-style="font-size:.85rem">🔇 لم يصلح التسجيل للتقييم (ضجيج أو صمت أو انقطاع). {أعد|أعيدي} التسجيل في مكان هادئ.</div>';
  else if (r) h += '<div class="rating-note" data-style="font-size:.88rem;margin:4px 0">📋 تقييم ' + who + (rule ? ' في ' + escapeHTML(rule.label) : '') + ': <b>' + RATING_STATES[r] + '</b></div>';
  if (o.length) h += '<div class="other-note" data-style="font-size:.85rem;color:#8a4b00;margin:2px 0">📌 {انتبه|انتبهي} أيضًا إلى: ' + o.map(function(k){ return escapeHTML(RATING_CRITERIA.other[k]); }).join('، ') + '</div>';
  return h ? GT(h) : '';
}

