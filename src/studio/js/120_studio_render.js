/* عرض الاستوديو: التقدم ومجموعات التسجيل وأدوات المتن */
function renderStudio(){
  RECORDING_LIST = buildRecordingList(); TOTAL = RECORDING_LIST.length; // 9.39.16: تسجيلات القسم القديمة تظهر ما دامت موجودة
  var done = RECORDING_LIST.filter(function(x){ return STATE.recordings[x.id]; }).length;
  var pct = TOTAL ? Math.round(done / TOTAL * 100) : 0;
  $('progress-count').textContent = done + ' من ' + TOTAL;
  $('progress-pct').textContent = pct + '%';
  $('progress-fill').style.width = pct + '%';

  var tb = document.getElementById('team-bar'); if (tb) tb.innerHTML = teamBarHTML();
  var show = REC_ROLES[recRole()].groups, html = '';
  if (show.indexOf('greetings') >= 0) html += buildGroupHTML('greetings','🎁','التحيات','تحية عامة + تحيتان');
  if (show.indexOf('matn') >= 0) html += buildGroupHTML('matn','📖','المتن (المنظومة)','أبيات تحفة الأطفال');
  if (show.indexOf('quran') >= 0) html += buildGroupHTML('quran','📿','الآيات القرآنية','آيات أسئلة الاستخراج');
  if (show.indexOf('listen') >= 0) html += buildGroupHTML('listen','🎧','اسمع وميّز','قراءتان لكل كلمة: صحيحة، وخاطئة عمدًا كما هو مكتوب (يظهر السؤال للطفل حين تُسجَّلا)');
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

