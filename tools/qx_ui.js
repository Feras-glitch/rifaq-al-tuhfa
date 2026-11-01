/* ===== QX UI: واجهات الأسئلة التفاعلية ===== */
var QX_UI = {};
(function(){
  var COLORS = ['#e53935', '#1e88e5', '#2e9e55', '#fb8c00', '#8e24aa', '#00897b'];
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function btn(cls, text){ var b = el('button', cls, text); b.type = 'button'; return b; }
  function shuffle(a){ var b = a.slice(), i, j, t; for (i = b.length - 1; i > 0; i--){ j = Math.floor(Math.random() * (i + 1)); t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
  function shuffleNotSame(a){ if (a.length < 2) return a.slice(); var b, n = 0; do { b = shuffle(a); n++; } while (n < 8 && b.every(function(x, i){ return x === a[i]; })); return b; }
  function shake(node){ node.classList.remove('qx-shake'); void node.offsetWidth; node.classList.add('qx-shake'); }
  function pulse(node){ node.classList.remove('qx-pulse'); void node.offsetWidth; node.classList.add('qx-pulse'); }

  QX_UI.classify = function(q, area, api){
    var x = q._x;
    var sel = null, remaining = x.items.length;
    var tray = el('div', 'qx-tray'), baskets = el('div', 'qx-baskets');
    var bEls = x.buckets.map(function(name, bi){
      var bx = btn('qx-basket'); bx.appendChild(el('div', 'qx-basket-title', '🧺 ' + name));
      var inner = el('div', 'qx-basket-items'); bx.appendChild(inner);
      bx.onclick = function(){ drop(bi, bx, inner); }; baskets.appendChild(bx); return bx;
    });
    x.items.forEach(function(it){
      var c = btn('qx-chip', it.t);
      c.onclick = function(){
        if (sel && sel.c === c){ c.classList.remove('sel'); sel = null; return; }
        if (sel) sel.c.classList.remove('sel');
        sel = {c: c, it: it}; c.classList.add('sel'); api.say('الآن اضغط على السلة المناسبة 🧺');
      };
      tray.appendChild(c);
    });
    // اخلط ترتيب البطاقات
    shuffleNotSame(Array.prototype.slice.call(tray.children)).forEach(function(c){ tray.appendChild(c); });
    function drop(bi, bx, inner){
      if (!sel){ api.say('اختر بطاقة أولًا 👆'); shake(bx); return; }
      if (sel.it.b === bi){
        inner.appendChild(el('span', 'qx-mini', sel.it.t)); sel.c.remove(); sel = null; remaining--; pulse(bx);
        if (!remaining) api.done(); else api.say('أحسنت! ✨ باقٍ ' + remaining);
      } else {
        api.mistake('ليست هذه سلتها، حاول مرة أخرى'); shake(sel.c); shake(bx); sel.c.classList.remove('sel'); sel = null;
      }
    }
    area.appendChild(tray); area.appendChild(baskets);
  };

  QX_UI.hunt = function(q, area, api){
    var x = q._x;
    var found = 0, box = el('div', 'qx-text');
    x.words.forEach(function(w){
      var wrap = el('span', 'qx-word' + (x.unit === 'letter' ? ' qx-letters' : ''));
      w.forEach(function(p){
        var b = btn('qx-tok', p.t);
        b.onclick = function(){
          if (b.classList.contains('ok')) return;
          if (p.hit){ b.classList.add('ok'); found++; pulse(b); if (found === x.total) api.done(); else api.say('وجدت ' + found + ' من ' + x.total + ' ✨'); }
          else { b.classList.add('bad'); shake(b); api.mistake('ليس هنا، ابحث مرة أخرى'); setTimeout(function(){ b.classList.remove('bad'); }, 700); }
        };
        wrap.appendChild(b);
      });
      box.appendChild(wrap); box.appendChild(document.createTextNode(' '));
    });
    area.appendChild(box); api.say('ابحث عن ' + x.total + (x.unit === 'letter' ? ' حرف 🔍' : ' كلمة 🔍'));
  };

  QX_UI.paint = function(q, area, api){
    var x = q._x;
    var cur = -1, left = x.total, pal = el('div', 'qx-palette'), box = el('div', 'qx-text');
    var palBtns = x.rules.map(function(r, i){
      var b = btn('qx-color', r); b.style.borderColor = COLORS[i]; b.style.color = COLORS[i];
      b.onclick = function(){ cur = i; palBtns.forEach(function(x, j){ x.classList.toggle('sel', j === i); x.style.background = j === i ? COLORS[j] : '#fff'; x.style.color = j === i ? '#fff' : COLORS[j]; }); api.say('لونك الآن: ' + r + ' 🎨'); };
      pal.appendChild(b); return b;
    });
    x.tokens.forEach(function(t){
      var b = btn('qx-tok', t.t);
      b.onclick = function(){
        if (b.classList.contains('ok')) return;
        if (cur < 0){ api.say('اختر لونًا أولًا 👆'); shake(pal); return; }
        if (t.rule === x.rules[cur]){ b.classList.add('ok'); b.style.background = COLORS[cur]; b.style.color = '#fff'; b.style.borderColor = COLORS[cur]; pulse(b); left--; if (!left) api.done(); else api.say('باقٍ ' + left + ' ✨'); }
        else { shake(b); api.mistake(t.rule ? 'هذه الكلمة لها حكم آخر' : 'ليس في هذه الكلمة حكم من هذه الأحكام'); }
      };
      box.appendChild(b); box.appendChild(document.createTextNode(' '));
    });
    area.appendChild(pal); area.appendChild(box);
  };

  QX_UI.match = function(q, area, api){
    var x = q._x;
    var sel = null, matched = 0, cols = el('div', 'qx-cols'), cl = el('div', 'qx-col'), cr = el('div', 'qx-col');
    x.pairs.forEach(function(p, i){
      var b = btn('qx-chip', p[0]);
      b.onclick = function(){ if (b.disabled) return; if (sel) sel.b.classList.remove('sel'); sel = {i: i, b: b}; b.classList.add('sel'); api.say('اختر ما يناسبه 👈'); };
      cl.appendChild(b);
    });
    shuffleNotSame(x.pairs.map(function(p, i){ return {t: p[1], i: i}; })).forEach(function(o){
      var b = btn('qx-chip alt', o.t);
      b.onclick = function(){
        if (b.disabled) return;
        if (!sel){ api.say('ابدأ من العمود الأول 👉'); shake(b); return; }
        if (sel.i === o.i){
          var col = COLORS[matched % COLORS.length];
          [sel.b, b].forEach(function(x){ x.disabled = true; x.classList.remove('sel'); x.classList.add('ok'); x.style.background = col; x.style.color = '#fff'; });
          sel = null; matched++; pulse(b); if (matched === x.pairs.length) api.done(); else api.say('أحسنت! ✨');
        } else { api.mistake('ليسا زوجين، حاول مرة أخرى'); shake(b); shake(sel.b); sel.b.classList.remove('sel'); sel = null; }
      };
      cr.appendChild(b);
    });
    cols.appendChild(cl); cols.appendChild(cr); area.appendChild(cols);
  };

  QX_UI.order = function(q, area, api){
    var x = q._x;
    var answer = [], pool = shuffleNotSame(x.pieces.concat(x.extra)), line = el('div', 'qx-line'), poolEl = el('div', 'qx-tray');
    function draw(){
      line.innerHTML = '';
      for (var i = 0; i < x.pieces.length; i++){
        (function(i){
          var s = btn('qx-slot' + (answer[i] !== undefined ? ' filled' : ''), answer[i] !== undefined ? answer[i] : String(i + 1));
          s.onclick = function(){ if (answer[i] !== undefined){ pool.push(answer[i]); answer.splice(i, 1); draw(); } };
          line.appendChild(s);
        })(i);
      }
      poolEl.innerHTML = '';
      pool.forEach(function(p){
        var c = btn('qx-chip', p);
        c.onclick = function(){
          if (answer.length >= x.pieces.length) return;
          answer.push(p); pool.splice(pool.indexOf(p), 1); draw(); if (answer.length === x.pieces.length) check();
        };
        poolEl.appendChild(c);
      });
    }
    function check(){
      var wrong = [];
      answer.forEach(function(a, i){ if (a !== x.pieces[i]) wrong.push(i); });
      if (!wrong.length){ Array.prototype.forEach.call(line.children, function(s){ s.classList.add('ok'); }); pulse(line); api.done(); }
      else { wrong.forEach(function(i){ line.children[i].classList.add('bad'); shake(line.children[i]); }); api.mistake('بعض القطع في غير مكانها — اضغط عليها لتعيدها'); }
    }
    area.appendChild(line); area.appendChild(poolEl); draw();
  };

  QX_UI.cloze = function(q, area, api){
    var x = q._x;
    var blanks = [], cur = 0, left = 0, sentence = el('div', 'qx-text qx-sentence'), pool = el('div', 'qx-tray');
    function firstOpen(){ for (var i = 0; i < blanks.length; i++) if (!blanks[i].filled) return i; return -1; }
    function mark(){ blanks.forEach(function(o, i){ o.el.classList.toggle('sel', i === cur && !o.filled); }); }
    x.parts.forEach(function(p){
      if (p.blank === undefined){ sentence.appendChild(document.createTextNode(p.t)); return; }
      var b = btn('qx-blank', '＿＿＿'), o = {ans: p.blank, el: b, filled: false};
      b.onclick = function(){ if (!o.filled){ cur = blanks.indexOf(o); mark(); } };
      blanks.push(o); left++; sentence.appendChild(b);
    });
    shuffleNotSame(blanks.map(function(o){ return o.ans; }).concat(x.distractors)).forEach(function(t){
      var c = btn('qx-chip', t);
      c.onclick = function(){
        if (c.disabled) return;
        var o = blanks[cur] && !blanks[cur].filled ? blanks[cur] : blanks[firstOpen()];
        if (!o) return;
        if (o.ans === t){ o.el.textContent = t; o.el.classList.remove('sel'); o.el.classList.add('ok'); o.filled = true; c.disabled = true; c.classList.add('used'); pulse(o.el); left--; cur = Math.max(0, firstOpen()); mark(); if (!left) api.done(); else api.say('أحسنت! ✨'); }
        else { api.mistake('هذه ليست الكلمة المناسبة'); shake(c); shake(o.el); }
      };
      pool.appendChild(c);
    });
    mark(); area.appendChild(sentence); area.appendChild(pool);
  };
})();
function renderQX(q){
  var host = $('options'); host.innerHTML = '';
  var wrap = document.createElement('div'); wrap.className = 'qx'; host.appendChild(wrap);
  var bar = document.createElement('div'); bar.className = 'qx-bar';
  var info = document.createElement('span'); info.className = 'qx-info'; info.textContent = QX.types[q.type].hint;
  var mis = document.createElement('span'); mis.className = 'qx-mis'; mis.textContent = '❌ 0';
  bar.appendChild(info); bar.appendChild(mis); wrap.appendChild(bar);
  var area = document.createElement('div'); area.className = 'qx-area'; wrap.appendChild(area);
  var m = 0, finished = false;
  var api = {
    say: function(msg){ info.textContent = msg; },
    mistake: function(msg){ if (finished) return; m++; mis.textContent = '❌ ' + m; if (msg) info.textContent = msg; },
    done: function(){ if (finished) return; finished = true; wrap.classList.add('qx-done'); info.textContent = '🎉 أكملت!'; finishCustom(q, m); }
  };
  QX_UI[q.type](q, area, api);
}
function finishCustom(q, mistakes){
  var correct = mistakes <= (typeof q.tolerance === 'number' ? q.tolerance : 1);
  finishAnswer(correct, q);
  if (!correct){ var t = document.querySelector('#feedback-box .feedback .title'); if (t) t.textContent = '💪 أكملت المهمة! راجع الشرح وحاول بأخطاء أقل'; }
}
