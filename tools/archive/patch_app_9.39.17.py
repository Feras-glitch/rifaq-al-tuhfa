# -*- coding: utf-8 -*-
"""9.39.17: الآيات العثمانية بخط المصحف (QPC V2، مجمع الملك فهد) في التطبيق ونسخة التجربة.
- خطوط الصفحات المستعملة وحدها (مقتطعة، WOFF) مدمجة في <style> بين علامتي QPC_FONTS (من curriculum/qpc/qpc_fonts_9.39.17.json).
- كل مهمة وسؤال عثماني يحمل في المنهج qpc = {p، w، e، k[، wp]} (من tools/build_qpc_9.39.17.py).
- يُعرض النص بخط المصحف فقط إذا: حُمّل خط كل صفحة فعلًا (document.fonts)، وطابق هيكل كلمات النص الحالي k (فإن عُدّل النص في الاستوديو بعد البناء رجع العرض إلى نص تنزيل)،
  وكانت الرموز كلها من نطاق QPC. وإلا يبقى نص تنزيل كما كان.
- الكلمة المقصودة (<b>) والحكم المحوري (سطر المهمة، عند المعلم) يُحسبان من النص الحالي ويُلوَّنان على رموز المصحف نفسها.
- نص تنزيل يبقى في الصفحة لقارئ الشاشة (qpc-sr)، ورموز المصحف aria-hidden.
- على الموقع الرئيسي يرجع السؤال المحوّل إلى صيغته السابقة ومعها خطها (prev.qpc).
قابل لإعادة التشغيل. شغّله من جذر المستودع بعد سكربتات 9.39.16 ثم tools/rebuild_html.py"""
import json, re, sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
FONTS = 'curriculum/qpc/qpc_fonts_9.39.17.json'
R = []
def rep(old, new): R.append((old, new))

rep("""mark.pivot{""", """/* 9.39.17: خط المصحف (QPC V2) */
.qpc{font-weight:400;font-synthesis:none;font-size:1.05em;line-height:2.15}
.qpc .qg,.qpc b,.qpc mark{font-weight:400;font-style:normal}
.qpc-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
/* QPC_FONTS_BEGIN *//* QPC_FONTS_END */
mark.pivot{""")

# الدرس: نص المهمة
rep("""    html += verseAudioCount(item) ? matnVersesHTML(item) : '<div class="content-text">' + item.text + '</div>'; // 9.39.16 (ق4)""",
    """    html += verseAudioCount(item) ? matnVersesHTML(item) : '<div class="content-text">' + quranHTML(item.text, item) + '</div>'; // 9.39.16 (ق4)، 9.39.17 (خط المصحف)""")
# الدرس: آيات أسئلة لها تلاوة مرجعية
rep("""      quranCards.push('<div class="content-text quran">' + qtext + '</div>');""",
    """      quranCards.push('<div class="content-text quran">' + quranHTML(qtext, q) + '</div>');""")
# سؤال الاستخراج
rep("""    qHtml += '<span class="verse-text"' + (t === 'poem' ? ' data-style="font-size:1.35rem"' : '') + '>' + q.text + '</span>';""",
    """    qHtml += '<span class="verse-text"' + (t === 'poem' ? ' data-style="font-size:1.35rem"' : '') + '>' + (t === 'quran' ? quranHTML(q.text, q) : q.text) + '</span>';""")
# مراجعة المعلم
rep("""      if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[it.id]) items.push({id: it.id, text: it.text, type: detectTextType({text: it.text})});""",
    """      if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[it.id]) items.push({id: it.id, text: it.text, qpc: it.qpc, type: detectTextType({text: it.text})});""")
rep("""      if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[q.id]) items.push({id: q.id, text: q.text, type: detectTextType(q)});""",
    """      if (PACK_DATA.studentAudios && PACK_DATA.studentAudios[q.id]) items.push({id: q.id, text: q.text, qpc: q.qpc, type: detectTextType(q)});""")
rep("""    h += '<div class="text' + (it.type === 'quran' ? ' quran' : '') + '">' + highlightPivot(it.text, it.id) + '</div>'; // 9.39.15 (ق6-ب)""",
    """    h += '<div class="text' + (it.type === 'quran' ? ' quran' : '') + '">' + (it.type === 'quran' ? quranHTML(it.text, it, it.id) : highlightPivot(it.text, it.id)) + '</div>'; // 9.39.15 (ق6-ب)، 9.39.17""")
# مهام الطفل (قائمة التسجيلات)
rep("""  html += '<div class="text' + (type === 'quran' ? ' quran' : '') + '">' + text + '</div>';
  if (isRejected && !wasRerecorded){""",
    """  html += '<div class="text' + (type === 'quran' ? ' quran' : '') + '">' + (type === 'quran' ? quranHTML(text, qpcHolder(rawId)) : text) + '</div>';
  if (isRejected && !wasRerecorded){""")

# التنقية
rep("""            if (QX.has(q.type)){ var r = QX.normalize(q); if (r.errors.length){ SANITIZE_REPORT.dropped++; console.warn('QX question dropped', q.id, r.errors); return null; } if (q.set === 'A' || q.set === 'B') r.q.set = q.set; if (q.review === 'pending') r.q.review = 'pending'; return r.q; }""",
    """            if (QX.has(q.type)){ var r = QX.normalize(q); if (r.errors.length){ SANITIZE_REPORT.dropped++; console.warn('QX question dropped', q.id, r.errors); return null; } if (q.set === 'A' || q.set === 'B') r.q.set = q.set; if (q.review === 'pending') r.q.review = 'pending'; if (q.qpc) r.q.qpc = q.qpc; return r.q; }""")
rep("""        sec.items.forEach(function(it){ it.id = reg(it.id); it.text = safeHTML(it.text); if (it.desc) it.desc = safeHTML(it.desc); });""",
    """        sec.items.forEach(function(it){ it.id = reg(it.id); it.text = safeHTML(it.text); if (it.desc) it.desc = safeHTML(it.desc); var qp = cleanQpc(it.qpc); if (qp) it.qpc = qp; else delete it.qpc; });""")
rep("""            var pv = {}; ['text','question','source'].forEach(function(f){ if (typeof q.prev[f] === 'string') pv[f] = safeHTML(q.prev[f]); }); q.prev = pv;""",
    """            var pv = {}; ['text','question','source'].forEach(function(f){ if (typeof q.prev[f] === 'string') pv[f] = safeHTML(q.prev[f]); }); var pq = cleanQpc(q.prev.qpc); if (pq) pv.qpc = pq; q.prev = pv;""")
rep("""          if (q.textType !== undefined && q.textType !== 'quran' && q.textType !== 'poem') delete q.textType;
        });""",
    """          if (q.textType !== undefined && q.textType !== 'quran' && q.textType !== 'poem') delete q.textType;
          var qq = cleanQpc(q.qpc); if (qq) q.qpc = qq; else delete q.qpc; // 9.39.17
        });""")
# الموقع الرئيسي: الصيغة السابقة بخطها
rep("""if (typeof q.prev.source === 'string') r.source = q.prev.source; delete r.prev; delete r.review; return r; }""",
    """if (typeof q.prev.source === 'string') r.source = q.prev.source; if (q.prev.qpc) r.qpc = q.prev.qpc; else delete r.qpc; delete r.prev; delete r.review; return r; }""")
# التحميل
rep("""  applyContentChannel(); // 9.39.14 (D5): بعد استبدال المنهج غير الموثّق إن حدث
""", """  applyContentChannel(); // 9.39.14 (D5): بعد استبدال المنهج غير الموثّق إن حدث
  QPC_LOADING = new Promise(function(r){ setTimeout(r, 150); }).then(qpcInit); // 9.39.17
""")

# الحكم المحوري: المطابقة على قائمة كلمات (لنص تنزيل ولرموز المصحف معًا)
rep("""  var toks = String(html).split(' '), keys = toks.map(arSkel), hit = {};
  /* الكلمة نفسها""", """  var toks = String(html).split(' '), hit = pivotHits(toks, id);
  return toks.map(function(t, i){ return hit[i] ? '<mark class="pivot">' + t + '</mark>' : t; }).join(' ');
}
function pivotHits(toks, id){
  var phr = pivotPhrases(id), keys = toks.map(arSkel), hit = {};
  /* الكلمة نفسها""")
rep("""      if (found) break;
    }
  });
  return toks.map(function(t, i){ return hit[i] ? '<mark class="pivot">' + t + '</mark>' : t; }).join(' ');
}""", """      if (found) break;
    }
  });
  return hit;
}""")

rep("""function arSkel(w){""", r"""/* ===== 9.39.17: خط المصحف (QPC V2، مجمع الملك فهد) للآيات العثمانية ===== */
var QPC_PROBE = /* QPC_PROBE_BEGIN */{}/* QPC_PROBE_END */;
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
/* كلمات النص المعروض (بلا علامات الوقف المستقلة) مع علم الإبراز؛ مثل words_of في tools/build_qpc_9.39.17.py */
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
function arSkel(w){""")


def fonts_region():
    F = json.load(open(FONTS, encoding='utf-8'))['fonts']
    css = ''.join("@font-face{font-family:qpc%s;src:url(data:font/woff;base64,%s) format('woff');font-display:block}.qp%s{font-family:qpc%s}"
                  % (p, f['woff'], p, p) for p, f in sorted(F.items(), key=lambda x: int(x[0])))
    probe = json.dumps({p: chr(f['codepoints'][0]) for p, f in sorted(F.items(), key=lambda x: int(x[0]))}, ensure_ascii=True)
    return css, probe


css, probe = fonts_region()
for f in FILES:
    s = open(f, encoding='utf-8').read()
    # تفريغ المنطقتين المولّدتين أولًا ليبقى التشغيل المتكرر مطابقًا
    s = re.sub(r'/\* QPC_FONTS_BEGIN \*/.*?/\* QPC_FONTS_END \*/', '/* QPC_FONTS_BEGIN *//* QPC_FONTS_END */', s, flags=re.S)
    s = re.sub(r'/\* QPC_PROBE_BEGIN \*/.*?/\* QPC_PROBE_END \*/', '/* QPC_PROBE_BEGIN */{}/* QPC_PROBE_END */', s, flags=re.S)
    for old, new in R:
        if new in s: continue
        n = s.count(old)
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:110]))
        s = s.replace(old, new)
    s, n1 = re.subn(r'/\* QPC_FONTS_BEGIN \*/.*?/\* QPC_FONTS_END \*/', lambda m: '/* QPC_FONTS_BEGIN */' + css + '/* QPC_FONTS_END */', s, flags=re.S)
    s, n2 = re.subn(r'/\* QPC_PROBE_BEGIN \*/.*?/\* QPC_PROBE_END \*/', lambda m: '/* QPC_PROBE_BEGIN */' + probe + '/* QPC_PROBE_END */', s, flags=re.S)
    if n1 != 1 or n2 != 1: sys.exit('%s: QPC markers %d %d' % (f, n1, n2))
    open(f, 'w', encoding='utf-8').write(s); print('patched', f, len(s.encode()))
