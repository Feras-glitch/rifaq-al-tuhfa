/* ===== 9.28: تقسيم الدرس إلى بطاقات قصيرة (عرض فقط، بلا تغيير في المحتوى أو المنطق) ===== */
function paginateLessonCards(){
  var c = document.getElementById('lesson-content');
  if (!c || c.dataset.paged === '1') return;
  var startIdx = Number(c.dataset.pageIdx || 0) || 0;
  var kids = Array.prototype.slice.call(c.children), groups = [], cur = [];
  kids.forEach(function(k){
    if (k.classList && k.classList.contains('content-text') && cur.length){ groups.push(cur); cur = []; }
    cur.push(k);
  });
  if (cur.length) groups.push(cur);
  if (groups.length <= 1) return;
  var cards = groups.map(function(g){ var d = document.createElement('div'); d.className = 'lesson-card'; g.forEach(function(k){ d.appendChild(k); }); return d; });
  c.innerHTML = '';
  var idx = 0, total = cards.length;
  var bar = document.createElement('div'); bar.className = 'lesson-pager'; bar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin:8px 0';
  var prev = document.createElement('button'); prev.type = 'button'; prev.className = 'btn ghost'; prev.textContent = '‹ السابق';
  var next = document.createElement('button'); next.type = 'button'; next.className = 'btn ghost'; next.textContent = 'التالي ›';
  var label = document.createElement('span'); label.style.cssText = 'font-size:.9rem;color:#555';
  bar.appendChild(prev); bar.appendChild(label); bar.appendChild(next);
  function show(i){
    idx = Math.max(0, Math.min(total - 1, i));
    cards.forEach(function(d, j){ d.style.display = (j === idx) ? '' : 'none'; });
    label.textContent = 'بطاقة ' + (idx + 1) + ' من ' + total; c.dataset.pageIdx = String(idx);
    prev.disabled = idx === 0; next.disabled = idx === total - 1;
    try { c.scrollIntoView({block: 'start', behavior: 'smooth'}); } catch(e){}
  }
  prev.addEventListener('click', function(){ show(idx - 1); });
  next.addEventListener('click', function(){ show(idx + 1); });
  c.appendChild(bar);
  cards.forEach(function(d){ c.insertBefore(d, bar); });
  c.dataset.paged = '1';
  show(Math.min(startIdx, total - 1));
}
/* 9.39: إعادة عرض الدرس (بعد تسجيل أو حذف) تحافظ على تقسيم البطاقات والبطاقة الحالية */
function renderLesson(){
  var c0 = document.getElementById('lesson-content');
  var keep = c0 && c0.dataset.paged === '1' ? (c0.dataset.pageIdx || '0') : null; // تبقى البطاقة نفسها بعد إعادة الرسم
  renderLessonContent();
  var c = document.getElementById('lesson-content');
  if (c){ delete c.dataset.paged; if (keep !== null) c.dataset.pageIdx = keep; setTimeout(paginateLessonCards, 0); }
}
