# -*- coding: utf-8 -*-
"""9.39.15: قرار المالك ق6 (مقياس تقييم التلاوة)، في التطبيق ونسخة التجربة.
- (أ) المقياس: متقن / جيد / يحتاج تدريبًا، و«لا يصلح للتقييم» خيار منفصل ليس درجة (يطلب إعادة التسجيل).
      «لم يُطبَّق» القديمة تصير «يحتاج تدريبًا» أينما وُجدت (ملف وارد، حالة الطالب، نسخة احتياطية).
- (ب) الحكم المحوري: لكل مهمة تسجيل حكمها، يظهر للمعلم مع كلماته مظللة في الآية؛ و«ملاحظة على حكم آخر»
      علامات تصل الطفل تنبيهًا ولا تغيّر الدرجة.
- (ج) معايير كل حكم من curriculum/rating_criteria_9.39.15.json (مسودة لاعتماد الشيخ) تظهر للمعلم عند التقييم.
- (هـ) شهادة «الإتقان التام»: لا «يحتاج تدريبًا» في أي حكم محوري، و«جيد» يكفي؛ و«لا يصلح» لا يُحسب تقييمًا.
قابل لإعادة التشغيل. شغّله من جذر المستودع بعد سكربتات 9.39.14 ثم tools/rebuild_html.py"""
import json, sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
CRIT = json.load(open('curriculum/rating_criteria_9.39.15.json', encoding='utf-8'))
EMBED = {'rules': CRIT['rules'], 'tasks': CRIT['tasks'], 'other': CRIT['other']}
CRIT_JS = json.dumps(EMBED, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
R = []
def rep(old, new, count=1): R.append((old, new, count))

rep("""var RIFAQ_CHANNEL = 'main'; /* RIFAQ_CHANNEL */""",
    """var RIFAQ_CHANNEL = 'main'; /* RIFAQ_CHANNEL */
/* 9.39.15 (ق6): الحكم المحوري لكل مهمة تسجيل ومعايير تقييمه (مسودة لاعتماد الشيخ)، من curriculum/rating_criteria_9.39.15.json */
var RATING_CRITERIA = """ + CRIT_JS + """;""")

rep(""".verse-text b,.verse-text strong{""",
    """mark.pivot{background:#fff59d;color:inherit;border-bottom:3px solid #f9a825;border-radius:4px;padding:0 .15em}
.rubric{font-size:.85rem;margin:6px 0;background:#f7f9fc;border-radius:10px;padding:6px 10px}
.rubric div{margin:3px 0}
.verse-text b,.verse-text strong{""")

rep("""var RATING_STATES = {mastered: '✅ متقن', needs: '🔁 يحتاج تدريبًا', notapplied: '⛔ لم يُطبَّق'};""",
    """var RATING_STATES = {mastered: '✅ متقن', good: '👍 جيد', needs: '🔁 يحتاج تدريبًا'}; // 9.39.15 (ق6-أ)
var RATING_UNUSABLE = '🔇 لا يصلح للتقييم'; // ليس درجة: ضجيج أو صمت أو انقطاع، ويُطلب إعادة التسجيل
/* يُستدعى أثناء تعقيم الملف عند الإقلاع، قبل تعريف RATING_STATES، فلا يعتمد عليه */
function normRating(v){ v = String(v || ''); if (v === 'notapplied') return 'needs'; return ({mastered: 1, good: 1, needs: 1, unusable: 1})[v] ? v : ''; }
function arSkel(w){ return String(w || '').replace(/<[^>]+>/g, '').replace(/[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640﴿﴾«»()،.]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim(); }
/* العبارات بين «» في سطر «🎯 مهمتك» هي موضع الحكم المحوري */
function pivotPhrases(id){
  var it = null; CURRICULUM.forEach(function(s){ (s.items || []).forEach(function(x){ if (x.id === id) it = x; }); });
  var m = String((it && it.desc) || '').replace(/<br>[\\s\\S]*$/, '').match(/«[^»]+»/g) || [];
  return m.map(function(x){ return x.slice(1, -1).trim(); }).filter(Boolean);
}
function highlightPivot(html, id){
  var phr = pivotPhrases(id); if (!phr.length || /<[a-z]/i.test(String(html))) return html;
  var toks = String(html).split(' '), keys = toks.map(arSkel), hit = {};
  /* الكلمة نفسها، أو بلا حرف عطف أو جر ملتصق في أولها، أو تزيد عليها حرفًا واحدًا في آخرها */
  var same = function(k, w){ var k2 = k.replace(/^[وفبل]/, ''); var pre = function(x){ return x.indexOf(w) === 0 && x.length - w.length <= 1; }; return k === w || k2 === w || (w.length >= 3 && (pre(k) || pre(k2))); };
  phr.forEach(function(p){
    var ws = p.split(/\\s+/).map(arSkel).filter(function(w){ return w.length >= 1; });
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
  return toks.map(function(t, i){ return hit[i] ? '<mark class="pivot">' + t + '</mark>' : t; }).join(' ');
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
}""")

rep("""    var rstate = (PACK_DATA.teacherRatings || {})[it.id] || '';
    h += '<div class="rating-row" data-style="margin:8px 0;display:flex;gap:6px;flex-wrap:wrap">';
    Object.keys(RATING_STATES).forEach(function(k){ h += '<button class="btn ' + (rstate === k ? 'success' : 'ghost') + '" ' + ACT('setRating', it.id, k) + ' type="button">' + RATING_STATES[k] + '</button>'; });
    h += '</div>';""", """    h += ratingBlockHTML(it); // 9.39.15 (ق6)""")
rep("""    h += '<div class="text' + (it.type === 'quran' ? ' quran' : '') + '">' + it.text + '</div>';""",
    """    h += '<div class="text' + (it.type === 'quran' ? ' quran' : '') + '">' + highlightPivot(it.text, it.id) + '</div>'; // 9.39.15 (ق6-ب)""")
rep("""  if (!RATING_STATES[state] || !PACK_DATA.studentAudios || !PACK_DATA.studentAudios[id]) return;""",
    """  if ((!RATING_STATES[state] && state !== 'unusable') || !PACK_DATA.studentAudios || !PACK_DATA.studentAudios[id]) return;""")

# العدّ في واجهة الطالب وملخص ولي الأمر
rep("""var rc = {mastered: 0, needs: 0, notapplied: 0};""", """var rc = {mastered: 0, good: 0, needs: 0, unusable: 0};""", count=2)
rep("""    Object.keys(PACK_DATA.teacherRatings).forEach(function(k){ if (rc[PACK_DATA.teacherRatings[k]] !== undefined) rc[PACK_DATA.teacherRatings[k]]++; });
    var rn = document.createElement('div');""", """    Object.keys(PACK_DATA.teacherRatings).forEach(function(k){ var v = normRating(PACK_DATA.teacherRatings[k]); if (rc[v] !== undefined) rc[v]++; });
    var rn = document.createElement('div');""")
rep("""    rn.textContent = '📋 تقييم المعلم: ' + RATING_STATES.mastered + ' ' + rc.mastered + ' · ' + RATING_STATES.needs + ' ' + rc.needs + ' · ' + RATING_STATES.notapplied + ' ' + rc.notapplied;""",
    """    rn.textContent = '📋 تقييم المعلم: ' + RATING_STATES.mastered + ' ' + rc.mastered + ' · ' + RATING_STATES.good + ' ' + rc.good + ' · ' + RATING_STATES.needs + ' ' + rc.needs + (rc.unusable ? ' · ' + RATING_UNUSABLE + ' ' + rc.unusable : '');""")
rep("""  Object.keys(PACK_DATA.teacherRatings || {}).forEach(function(k){ if (rc[PACK_DATA.teacherRatings[k]] !== undefined) rc[PACK_DATA.teacherRatings[k]]++; });
  var lines = [""", """  Object.keys(PACK_DATA.teacherRatings || {}).forEach(function(k){ var v = normRating(PACK_DATA.teacherRatings[k]); if (rc[v] !== undefined) rc[v]++; });
  var lines = [""")
rep("""    'تقييم المعلم للتلاوة: متقن ' + rc.mastered + ' · يحتاج تدريبًا ' + rc.needs + ' · لم يُطبَّق ' + rc.notapplied,""",
    """    'تقييم المعلم للتلاوة: متقن ' + rc.mastered + ' · جيد ' + rc.good + ' · يحتاج تدريبًا ' + rc.needs + (rc.unusable ? ' · لا يصلح للتقييم ' + rc.unusable : ''),""")

# التعقيم والترحيل
rep("""      var okStates = {mastered: 1, needs: 1, notapplied: 1}, rr = {};
      Object.keys(P.teacherRatings).slice(0, 300).forEach(function(k){ if (okStates[P.teacherRatings[k]]) rr[String(k).slice(0, 64)] = P.teacherRatings[k]; });
      P.teacherRatings = rr;
    } else P.teacherRatings = {};""", """      var rr = {}; // 9.39.15 (ق6-أ): «لم يُطبَّق» القديمة تصير «يحتاج تدريبًا»
      Object.keys(P.teacherRatings).slice(0, 300).forEach(function(k){ var v = normRating(P.teacherRatings[k]); if (v) rr[safeIdString(k)] = v; });
      P.teacherRatings = rr;
    } else P.teacherRatings = {};
    if (P.teacherOtherRules && typeof P.teacherOtherRules === 'object' && !Array.isArray(P.teacherOtherRules)){
      var orr = {}; Object.keys(P.teacherOtherRules).slice(0, 300).forEach(function(k){ var a = P.teacherOtherRules[k]; if (!Array.isArray(a)) return; a = a.map(String).filter(function(x){ return RATING_CRITERIA.other[x]; }).slice(0, 12); if (a.length) orr[safeIdString(k)] = a; });
      P.teacherOtherRules = orr;
    } else P.teacherOtherRules = {};""")
rep("""    base.teacherRatings = {}; Object.keys(raw.teacherRatings).slice(0, 200).forEach(function(k){ var v = raw.teacherRatings[k]; if (typeof v === 'string') base.teacherRatings[String(k).slice(0, 64)] = v.slice(0, 20); });""",
    """    base.teacherRatings = {}; Object.keys(raw.teacherRatings).slice(0, 200).forEach(function(k){ var v = normRating(raw.teacherRatings[k]); if (v) base.teacherRatings[String(k).slice(0, 64)] = v; }); // 9.39.15: ترحيل «لم يُطبَّق»""")

# الشهادة: «لا يصلح» ليس تقييمًا
rep("""  return {allMastered: secs.length > 0 && mastered === secs.length, mastered: mastered, rated: keys.length, needs: keys.filter(function(k){ return r[k] === 'needs'; }).length};""",
    """  keys = keys.filter(function(k){ var v = normRating(r[k]); return v && v !== 'unusable'; }); // 9.39.15 (ق6-هـ): «جيد» يكفي، و«لا يصلح» ليس تقييمًا
  return {allMastered: secs.length > 0 && mastered === secs.length, mastered: mastered, rated: keys.length, needs: keys.filter(function(k){ return normRating(r[k]) === 'needs'; }).length};""")

# الإهداء لا يحمل تقييم الطفل الأصلي
rep("""'studentAssessment','teacherRatings','teacherNotes','teacherFeedbacks',""", """'studentAssessment','teacherRatings','teacherOtherRules','teacherNotes','teacherFeedbacks',""")
rep('''var CALLABLE_ALLOW = ["showGiftContents", ''', '''var CALLABLE_ALLOW = ["showGiftContents", "toggleOtherRule", ''')

# واجهة الطالب: التقييم وملاحظات الأحكام الأخرى تحت كل تسجيل
rep("""function tfItemHTML(id, text, type, packStatus, localStatus){""",
    """function tfItemHTML(id, text, type, packStatus, localStatus){ var h = tfItemHTMLInner(id, text, type, packStatus, localStatus), x = studentRatingNote(id); return x ? h.replace(/<\\/div>\\s*$/, x + '</div>') : h; } // 9.39.15 (ق6)
function tfItemHTMLInner(id, text, type, packStatus, localStatus){""")

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new, cnt in R:
        if new and new in s: continue
        n = s.count(old)
        if n != cnt: sys.exit('%s: expected %d match, got %d for: %s' % (f, cnt, n, old[:110]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
