/* ===== 9.40: تسميع المتن غيبًا ومراجعته المتباعدة =====
   في درس المتن زر «سمّع الأبيات غيبًا»: يُخفى البيت إلا أول كلمة من شطريه، فيقرؤه الطفل بصوت مسموع ثم يُظهره ويتحقق،
   ويضع علامة «حفظته» أو «أعيده». البيت المحفوظ يعود للمراجعة بعد 1 ثم 3 ثم 7 ثم 14 ثم 30 ثم 60 يومًا (صناديق لايتنر)،
   و«أعيده» يرجعه إلى البداية. في الخريطة زر «مراجعة حفظ المتن» حين يحين موعد أبيات.
   الحالة في STATE.hifz = {«معرّف المهمة__vرقم البيت»: {b: الصندوق 0..6، due: موعد المراجعة، n: عدد المراجعات}}. */
var HIFZ_DAYS = [0, 1, 3, 7, 14, 30, 60];
function hifzVerseParts(v){ // صدر البيت وعجزه نصًّا
  var m = String(v).match(/<span class="v-a">([\s\S]*?)<\/span><span class="v-b">([\s\S]*?)<\/span>/);
  var parts = m ? [m[1], m[2]] : String(v).split(/ +|\s{2,}/);
  return parts.map(function(p){ return plainText(p); }).filter(Boolean);
}
function hifzAllVerses(){
  var out = [];
  realSections().forEach(function(s){ (s.items || []).forEach(function(it){
    if (it.type !== 'poem') return;
    matnVerses(it).forEach(function(v, i){ out.push({key: verseKey(it.id, i + 1), item: it.id, n: i + 1, sec: s, parts: hifzVerseParts(v)}); });
  }); });
  return out;
}
function hifzState(){ STATE.hifz = (STATE.hifz && typeof STATE.hifz === 'object') ? STATE.hifz : {}; return STATE.hifz; }
function hifzDue(nowIso){
  var H = hifzState(), now = nowIso || new Date().toISOString();
  return hifzAllVerses().filter(function(v){ var h = H[v.key]; return h && String(h.due || '') <= now; });
}
function hifzSolidCount(){ var H = hifzState(); return Object.keys(H).filter(function(k){ return (H[k].b || 0) >= 3; }).length; }
function hifzMark(key, ok){
  var H = hifzState(), h = H[key] || {b: 0, n: 0};
  h.b = ok ? Math.min((h.b || 0) + 1, HIFZ_DAYS.length - 1) : 0;
  h.n = (h.n || 0) + 1;
  h.due = new Date(Date.now() + HIFZ_DAYS[h.b] * 864e5).toISOString();
  H[key] = h; save();
  return h;
}
function hifzHint(part){ var w = String(part).split(/\s+/).filter(Boolean); return (w[0] || '') + (w.length > 1 ? ' …' : ''); }
function closeHifz(){ var o = document.getElementById('hifz-overlay'); if (o) o.remove(); try { stopVerse(); } catch(e){} try { renderTrack(); } catch(e){} }
function hifzOverlay(title, verses, intro){
  closeHifz();
  var ov = document.createElement('div'); ov.id = 'hifz-overlay'; ov.className = 'hifz-overlay';
  var box = document.createElement('div'); box.className = 'hifz-box'; ov.appendChild(box);
  var head = document.createElement('div'); head.className = 'hifz-head';
  var h3 = document.createElement('h3'); h3.textContent = title; head.appendChild(h3);
  var x = document.createElement('button'); x.type = 'button'; x.className = 'btn ghost sm'; x.textContent = '✕'; x.setAttribute('aria-label', 'إغلاق'); x.addEventListener('click', closeHifz); head.appendChild(x);
  box.appendChild(head);
  var p = document.createElement('p'); p.className = 'hifz-intro'; p.textContent = GT(intro); box.appendChild(p);
  var stat = document.createElement('div'); stat.className = 'hifz-stat'; box.appendChild(stat);
  var updStat = function(){ stat.textContent = '📊 ' + GT('{حفظت|حفظتِ}') + ' حفظًا ثابتًا ' + hifzSolidCount() + ' من ' + hifzAllVerses().length + ' بيتًا'; };
  updStat();
  var H = hifzState();
  verses.forEach(function(v){
    var card = document.createElement('div'); card.className = 'hifz-card';
    var num = document.createElement('div'); num.className = 'hifz-num'; num.textContent = 'البيت ' + v.n + ' · ' + v.sec.title; card.appendChild(num);
    var txt = document.createElement('div'); txt.className = 'hifz-text';
    var hidden = v.parts.map(hifzHint);
    var showHidden = function(){ txt.innerHTML = ''; hidden.forEach(function(t){ var d = document.createElement('div'); d.textContent = t; txt.appendChild(d); }); };
    showHidden(); card.appendChild(txt);
    var row = document.createElement('div'); row.className = 'hifz-row';
    var reveal = document.createElement('button'); reveal.type = 'button'; reveal.className = 'btn primary sm'; reveal.textContent = '👁 ' + GT('{أظهر|أظهري}') + ' البيت';
    var okB = document.createElement('button'); okB.type = 'button'; okB.className = 'btn success sm hidden'; okB.textContent = '✅ حفظتُه';
    var noB = document.createElement('button'); noB.type = 'button'; noB.className = 'btn gold sm hidden'; noB.textContent = '🔁 لم أحفظه بعد';
    reveal.addEventListener('click', function(){
      txt.innerHTML = ''; v.parts.forEach(function(t){ var d = document.createElement('div'); d.textContent = t; txt.appendChild(d); });
      reveal.classList.add('hidden'); okB.classList.remove('hidden'); noB.classList.remove('hidden');
    });
    var res = document.createElement('div'); res.className = 'hifz-res';
    var done = function(ok){
      var h = hifzMark(v.key, ok); okB.disabled = noB.disabled = true; card.classList.add(ok ? 'ok' : 'again');
      res.textContent = ok ? ('✅ موعد مراجعته بعد ' + HIFZ_DAYS[h.b] + (HIFZ_DAYS[h.b] === 1 ? ' يوم' : ' أيام')) : '🔁 ' + GT('{كرّره|كرّريه}') + ' الآن، ثم {سمّعه|سمّعيه} مرة أخرى';
      if (!ok) setTimeout(function(){ okB.disabled = noB.disabled = false; okB.classList.add('hidden'); noB.classList.add('hidden'); reveal.classList.remove('hidden'); card.classList.remove('again'); showHidden(); }, 1500);
      updStat();
    };
    okB.addEventListener('click', function(){ done(true); });
    noB.addEventListener('click', function(){ done(false); });
    row.appendChild(reveal); row.appendChild(okB); row.appendChild(noB);
    if (audSrc((PACK_DATA.masterAudios || {})[v.key])){
      var lis = document.createElement('button'); lis.type = 'button'; lis.className = 'btn ghost sm'; lis.textContent = '🔊';
      lis.setAttribute('aria-label', 'استمع إلى البيت'); lis.addEventListener('click', function(){ playVerse(v.item, String(v.n), '1'); });
      row.appendChild(lis);
    }
    card.appendChild(row); card.appendChild(res);
    if (H[v.key] && H[v.key].due) { var nx = document.createElement('div'); nx.className = 'hifz-next'; nx.textContent = 'مراجَع ' + (H[v.key].n || 0) + ' مرة'; card.appendChild(nx); }
    box.appendChild(card);
  });
  var close = document.createElement('button'); close.type = 'button'; close.className = 'btn ghost block'; close.textContent = '↩ رجوع'; close.addEventListener('click', closeHifz);
  box.appendChild(close);
  document.body.appendChild(ov);
  try { box.scrollTop = 0; } catch(e){}
}
/* من درس المتن: أبيات هذا الدرس كلها (وتدخل جدول المراجعة من أول تسميع) */
function openHifz(itemId){
  var vs = hifzAllVerses().filter(function(v){ return v.item === itemId; }); if (!vs.length) return;
  hifzOverlay('🧠 تسميع: ' + vs[0].sec.title, vs, '{اقرأ|اقرئي} كل بيت غيبًا بصوت مسموع، ثم {اضغط|اضغطي} «{أظهر|أظهري} البيت» {وتأكد|وتأكدي}.');
}
/* من الخريطة: ما حان موعد مراجعته */
function openHifzDue(){
  var vs = hifzDue().slice(0, 12);
  if (!vs.length){ toast(GT('لا أبيات للمراجعة الآن. {أحسنت|أحسنتِ}!')); return; }
  hifzOverlay('🧠 مراجعة حفظ المتن', vs, 'هذه أبيات حان موعد مراجعتها. {سمّعها|سمّعيها} غيبًا ثم {تأكد|تأكدي}.');
}
function hifzHomeButton(card){
  var old = document.getElementById('hifz-cta'); if (old) old.remove();
  var n = hifzDue().length; if (!n || !card || !card.parentNode) return;
  var b = document.createElement('button'); b.type = 'button'; b.id = 'hifz-cta'; b.className = 'btn purple block';
  b.textContent = '🧠 مراجعة حفظ المتن (' + n + (n === 1 ? ' بيت' : n === 2 ? ' بيتان' : n <= 10 ? ' أبيات' : ' بيتًا') + ')'; b.style.cssText = 'margin:10px 0 0';
  b.addEventListener('click', openHifzDue);
  var after = document.getElementById('next-lesson-cta') || card;
  after.parentNode.insertBefore(b, after.nextSibling);
}
function hifzLessonButton(item){
  return '<button class="btn purple block" data-style="margin:10px 0" ' + ACT('openHifz', item.id) + ' type="button">🧠 ' + GT('{سمّع|سمّعي} الأبيات غيبًا') + '</button>';
}
