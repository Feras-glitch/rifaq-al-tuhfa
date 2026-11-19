# -*- coding: utf-8 -*-
"""9.39.16 (قرار المالك ق4): المتن بيتًا بيتًا في التطبيق ونسخة التجربة.
إن وُجد في المادة المرجعية تسجيل لأبيات القسم (masterAudios["<عنصر القسم>__v<رقم البيت>"]، من الاستوديو 9.39.16):
- يُعرض كل بيت في سطره مع ▶️ و«🔁 ×3» (يكرره ثلاث مرات ليحفظه الطفل)، والبيت الجاري مظلَّل؛
- وفوق الأبيات «استمع للأبيات كلها» بصورة المنشد واسمه.
وإلا يبقى المشغّل الواحد للقسم كما كان (تسجيلات الاستوديو السابقة).
قابل لإعادة التشغيل. شغّله من جذر المستودع بعد سكربتات 9.39.15 ثم tools/rebuild_html.py"""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = []
def rep(old, new): R.append((old, new))

rep("""mark.pivot{""", """.matn-verse{padding:4px 6px;border-radius:10px;transition:background .2s}
.matn-verse.playing{background:#fff59d;box-shadow:0 0 0 2px #f9a825 inset}
.mv-btns{display:inline-flex;gap:4px;margin-inline-start:6px;vertical-align:middle}
.mv-btns .btn{padding:4px 8px;font-size:.8rem;min-height:0}
mark.pivot{""")
rep("""    html += '<div class="content-text">' + item.text + '</div>';
    if (item.desc) html += '<div class="desc-text">💡 ' + GT(item.desc) + '</div>';

    if (PACK_DATA.masterAudios && PACK_DATA.masterAudios[item.id]){""",
    """    html += verseAudioCount(item) ? matnVersesHTML(item) : '<div class="content-text">' + item.text + '</div>'; // 9.39.16 (ق4)
    if (item.desc) html += '<div class="desc-text">💡 ' + GT(item.desc) + '</div>';

    if (verseAudioCount(item)){ html += matnHeaderHTML(item); }
    else if (PACK_DATA.masterAudios && PACK_DATA.masterAudios[item.id]){""")
rep('''var CALLABLE_ALLOW = ["showGiftContents", "toggleOtherRule", ''', '''var CALLABLE_ALLOW = ["showGiftContents", "toggleOtherRule", "playVerse", "stopVerse", ''')
rep("""function arSkel(w){""", """/* ===== 9.39.16 (ق4): المتن بيتًا بيتًا ===== */
function matnVerses(item){ return String((item && item.text) || '').split(/<br\\s*\\/?>/i).map(function(v){ return v.trim(); }).filter(Boolean); }
function verseKey(id, n){ return String(id) + '__v' + n; }
function verseAudioCount(item){
  if (!item || detectTextType({text: item.text}) === 'quran' || !PACK_DATA.masterAudios) return 0;
  var n = 0; matnVerses(item).forEach(function(_, i){ if (audSrc(PACK_DATA.masterAudios[verseKey(item.id, i + 1)])) n++; }); return n;
}
function matnVersesHTML(item){
  var h = '<div class="content-text matn-verses">';
  matnVerses(item).forEach(function(v, i){
    var k = verseKey(item.id, i + 1), has = !!audSrc(PACK_DATA.masterAudios[k]);
    h += '<div class="matn-verse" id="mv-' + safeIdString(k) + '">' + v + (has ? '<span class="mv-btns"><button class="btn ghost" ' + ACT('playVerse', item.id, String(i + 1), '1') + ' type="button" aria-label="استمع للبيت">▶️</button><button class="btn ghost" ' + ACT('playVerse', item.id, String(i + 1), '3') + ' type="button" aria-label="كرّر البيت ثلاث مرات">🔁 ×3</button></span>' : '') + '</div>';
  });
  return h + '</div>';
}
function matnHeaderHTML(item){
  var name = PACK_DATA.poemReciterName || '';
  return '<div class="master-person-audio matn-head" data-style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0">' +
    (PACK_DATA.poemReciterPhoto ? '<img data-media="' + mediaRef('img', PACK_DATA.poemReciterPhoto) + '" alt="" data-style="width:40px;height:40px;border-radius:50%;object-fit:cover">' : '<span>🎧</span>') +
    '<span>' + GT('إنشاد الأبيات') + (name && !isGenericName(name) ? ': ' + escapeHTML(name) : '') + '</span>' +
    '<button class="btn primary sm" ' + ACT('playVerse', item.id, '0', '1') + ' type="button">▶️ ' + GT('{استمع|استمعي} للأبيات كلها') + '</button>' +
    '<button class="btn ghost sm" ' + ACT('stopVerse') + ' type="button">⏹️</button></div>';
}
var VERSE_PLAYER = null;
function stopVerse(){
  var p = VERSE_PLAYER; VERSE_PLAYER = null;
  if (p && p.a){ try { p.a.pause(); } catch(e){} }
  Array.prototype.forEach.call(document.querySelectorAll('.matn-verse.playing'), function(el){ el.classList.remove('playing'); });
}
function playVerse(id, n, times){
  n = Number(n) || 0; times = Math.max(1, Math.min(5, Number(times) || 1));
  var item = null; CURRICULUM.forEach(function(s){ (s.items || []).forEach(function(x){ if (x.id === id) item = x; }); });
  if (!item) return;
  var queue = [];
  if (n === 0) matnVerses(item).forEach(function(_, i){ if (audSrc(PACK_DATA.masterAudios[verseKey(id, i + 1)])) queue.push(i + 1); });
  else for (var t = 0; t < times; t++) queue.push(n);
  stopVerse();
  Array.prototype.forEach.call(document.querySelectorAll('audio'), function(a){ try { a.pause(); } catch(e){} });
  var token = {played: []}; VERSE_PLAYER = token;
  (function next(){
    if (VERSE_PLAYER !== token) return;
    Array.prototype.forEach.call(document.querySelectorAll('.matn-verse.playing'), function(el){ el.classList.remove('playing'); });
    var m = queue.shift(); if (!m){ VERSE_PLAYER = null; return; }
    var el = document.getElementById('mv-' + safeIdString(verseKey(id, m)));
    if (el){ el.classList.add('playing'); try { el.scrollIntoView({block: 'nearest'}); } catch(e){} }
    var a = new Audio(audSrc(PACK_DATA.masterAudios[verseKey(id, m)])); token.a = a; token.played.push(m);
    var fired = false, go = function(){ if (fired) return; fired = true; if (VERSE_PLAYER === token) setTimeout(next, 450); };
    a.onended = go; a.onerror = go;
    var pr = a.play(); if (pr && pr.catch) pr.catch(go);
  })();
  return token;
}
function arSkel(w){""")

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new in s: continue
        n = s.count(old)
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:110]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
