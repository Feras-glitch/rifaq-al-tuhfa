/* ===== الشهادة ===== */
/* الشهادة */
function hashString(str){ var h = 0; for (var i = 0; i < str.length; i++){ h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return h; }
function generateCertId(){
  var d = new Date();
  var s = d.getFullYear().toString() + (d.getMonth()+1).toString().padStart(2,'0') + d.getDate().toString().padStart(2,'0');
  var h = Math.abs(hashString((STATE.student.name || '') + s)).toString(36).toUpperCase().slice(0, 6);
  return 'TTA-' + s + '-' + h;
}
function certLevel(){
  var secs = realSections(), cs = (STATE.assess && STATE.assess.concepts) || {};
  var mastered = secs.filter(function(s){ return cs[s.id] && cs[s.id].mastered; }).length;
  var r = STATE.teacherRatings || {}, keys = Object.keys(r);
  keys = keys.filter(function(k){ var v = normRating(r[k]); return v && v !== 'unusable'; }); // 9.39.15 (ق6-هـ): «جيد» يكفي، و«لا يصلح» ليس تقييمًا
  return {allMastered: secs.length > 0 && mastered === secs.length, mastered: mastered, rated: keys.length, needs: keys.filter(function(k){ return normRating(r[k]) === 'needs'; }).length};
}
function buildCertData(){
  var s = STATE.student;
  var stats = STATE.stats;
  var _n = realSections().length;
  /* 9.39.11 (ق2-ب): «الإتقان» يعني إتقان كل المفاهيم في جولات القياس (لا نجوم الدروس)، مع تقييم معلم موثّق للتلاوة بلا «يحتاج تدريبًا» */
  var lv = certLevel(), isF = s.gender === 'girl';
  var isPerfect = lv.allMastered && lv.rated > 0 && lv.needs === 0;
  var W = function(m, f){ return isF ? f : m; };
  var desc = isPerfect ? W('أتمّ جميع أقسام منهج تحفة الأطفال، وأتقن أحكامها في الاختبار النهائي، واعتمد معلمه تلاوته.', 'أتمّت جميع أقسام منهج تحفة الأطفال، وأتقنت أحكامها في الاختبار النهائي، واعتمد معلمها تلاوتها.')
    : lv.allMastered ? (W('أتقن أحكام منهج تحفة الأطفال في الاختبار النهائي.', 'أتقنت أحكام منهج تحفة الأطفال في الاختبار النهائي.') + (lv.needs ? ' وتحتاج التلاوة تدريبًا في ' + arCount(lv.needs, 'موضع', 'موضعين', 'مواضع') + '.' : ' وتقييم المعلم للتلاوة لم يصل بعد.'))
    : (W('أتمّ ', 'أتمّت ') + stats.completedSections + ' من ' + _n + ' أقسام' + (lv.mastered ? '، ' + W('وأتقن ', 'وأتقنت ') + lv.mastered + ' من مفاهيمها.' : '.'));
  var now = new Date();
  var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return {
    title: lv.allMastered ? 'شهادة إتقان' : 'شهادة تقدّم', // 9.41.3: «إتقان» بعد إتقان المنهج في الاختبار النهائي
    name: s.name || '—',
    role: isPerfect ? (isF ? '🏆 بطلة المنهج بإتقان تام' : '🏆 بطل المنهج بإتقان تام') : lv.allMastered ? (isF ? '🏆 متقنة لأحكام المنهج' : '🏆 متقن لأحكام المنهج') : (isF ? '🏆 متقدمة في المنهج' : '🏆 متقدم في المنهج'),
    desc: desc, isF: isF,
    points: stats.totalPoints, completed: stats.completedSections,
    total: _n, perfect: lv.mastered,
    sheikhName: PACK_DATA.sheikhName || PACK_DATA.quranReciterName || '—',
    sheikhLabel: 'القارئ',
    supervisorName: STATE.student.supervisorName || '',
    supervisorLabel: STATE.student.supervisorGender === 'girl' ? 'بإشراف المعلمة' : 'بإشراف المعلم',
    schoolName: PACK_DATA.schoolName || '', schoolLogo: PACK_DATA.schoolLogo || null,
    date: 'حُرّرت في ' + now.getDate() + ' من ' + months[now.getMonth()] + ' ' + now.getFullYear() + 'م',
    certId: 'رقم الشهادة: ' + generateCertId(),
    sealText: isPerfect ? 'ختم الإتقان' : 'ختم الاعتماد',
    photo: s.photo, gender: s.gender
  };
}
function showCertificate(){
  LAST_CERT_BLOB = null; // 9.41.3: الصورة تُرسم من بيانات اللحظة، لا من شهادة سابقة في الجلسة نفسها
  var d = buildCertData();
  var tt = document.querySelector('#certificate-card .cert-title'); if (tt) tt.textContent = d.title;
  var ph = $('cert-photo');
  if (d.photo) ph.innerHTML = '<img data-media="' + mediaRef('img', d.photo) + '" alt="">';
  else ph.innerHTML = '<span class="emoji">' + (d.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️') + '</span>';
  $('cert-name').textContent = d.name;
  $('cert-role').textContent = d.role;
  $('cert-desc').textContent = d.desc;
  if (d.schoolName){
    $('cert-school-box').style.display = 'flex';
    $('cert-school-name').textContent = d.schoolName;
    var lb = $('cert-school-logo');
    if (d.schoolLogo) lb.innerHTML = '<img data-media="' + mediaRef('img', d.schoolLogo) + '" alt="">';
    else lb.innerHTML = '<div class="cert-school-logo-ph">🏫</div>';
  } else $('cert-school-box').style.display = 'none';
  $('cert-stats').innerHTML =
    '<div class="cert-stat"><div class="n">' + d.points + '</div><div class="l">نقطة</div></div>' +
    '<div class="cert-stat"><div class="n">' + d.completed + '/' + d.total + '</div><div class="l">أقسام</div></div>' +
    '<div class="cert-stat"><div class="n">' + d.perfect + '</div><div class="l">مفاهيم متقنة</div></div>';
  $('cert-sheikh-label').textContent = d.sheikhLabel;
  $('cert-sheikh-name').textContent = d.sheikhName;
  if (d.supervisorName){
    $('cert-supervisor-sign').style.display = 'block';
    $('cert-supervisor-label').textContent = d.supervisorLabel;
    $('cert-supervisor-name').textContent = d.supervisorName;
  } else $('cert-supervisor-sign').style.display = 'none';
  $('cert-seal').innerHTML = d.sealText.replace(' ', '<br>');
  $('cert-date').textContent = d.date;
  $('cert-id').textContent = d.certId;
  show('view-certificate');
  confetti(40);
}
function closeCertificate(){ show('view-home'); }
function printCertificate(){
  document.body.classList.add('printing-cert');
  var after = function(){ document.body.classList.remove('printing-cert'); window.removeEventListener('afterprint', after); };
  window.addEventListener('afterprint', after);
  setTimeout(function(){ window.print(); }, 100);
  setTimeout(after, 4000);
}
function loadImage(src){
  return new Promise(function(resolve){
    if (!src){ resolve(null); return; }
    var img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = function(){ resolve(img); };
    img.onerror = function(){ resolve(null); };
    img.src = src;
  });
}
function roundRectPath(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawEmoji(ctx, emoji, x, y, size){
  ctx.save(); ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji",Tahoma';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y); ctx.restore();
}
function drawCenterText(ctx, text, x, y, maxWidth){
  var words = text.split(' '); var line = ''; var lineHeight = parseInt(ctx.font, 10) * 1.4; var cy = y;
  for (var i = 0; i < words.length; i++){
    var test = line + (line ? ' ' : '') + words[i];
    if (ctx.measureText(test).width > maxWidth && line){ ctx.fillText(line, x, cy); cy += lineHeight; line = words[i]; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
  return cy;
}
async function renderCertificateToBlob(){
  var d = buildCertData();
  var W = 1200, H = 1700, scale = 2;
  var canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  var ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  var bg = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, H);
  bg.addColorStop(0, '#fffbe6'); bg.addColorStop(1, '#fffdf5');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 6; ctx.strokeRect(20, 20, W-40, H-40);
  ctx.strokeStyle = '#FFC107'; ctx.lineWidth = 2; ctx.strokeRect(34, 34, W-68, H-68);
  ctx.strokeStyle = '#FFC10766'; ctx.lineWidth = 1; ctx.strokeRect(46, 46, W-92, H-92);
  ctx.font = '28px Tahoma'; ctx.fillStyle = '#b8860b';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('✦', 60, 80); ctx.textAlign = 'right'; ctx.fillText('✦', W-60, 80);
  ctx.textBaseline = 'bottom'; ctx.fillText('✦', W-60, H-50);
  ctx.textAlign = 'left'; ctx.fillText('✦', 60, H-50);
  drawEmoji(ctx, '🏅', W/2, 130, 100);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8b6f00'; ctx.font = 'bold 78px Tahoma'; ctx.fillText(d.title, W/2, 260);
  ctx.fillStyle = '#6b7280'; ctx.font = 'bold 28px Tahoma'; ctx.fillText('منهج تحفة الأطفال', W/2, 305);
  var cy = 345;
  if (d.schoolName){
    var sbW = 460, sbH = 80; var sx = (W - sbW) / 2;
    ctx.fillStyle = '#fffdf5'; roundRectPath(ctx, sx, cy, sbW, sbH, 16); ctx.fill();
    ctx.strokeStyle = '#FFC10766'; ctx.lineWidth = 2; ctx.stroke();
    var logo = d.schoolLogo ? await loadImage(d.schoolLogo) : null;
    var lcx = sx + 55, lcy = cy + sbH/2;
    if (logo){ ctx.save(); ctx.beginPath(); ctx.arc(lcx, lcy, 26, 0, Math.PI*2); ctx.clip(); ctx.drawImage(logo, lcx-26, lcy-26, 52, 52); ctx.restore(); }
    else { ctx.fillStyle = '#283593'; ctx.beginPath(); ctx.arc(lcx, lcy, 26, 0, Math.PI*2); ctx.fill(); drawEmoji(ctx, '🏫', lcx, lcy+2, 30); }
    ctx.textAlign = 'right'; ctx.fillStyle = '#6b7280'; ctx.font = 'bold 16px Tahoma';
    ctx.fillText('بمدرسة', sx + sbW - 20, cy + 28);
    ctx.fillStyle = '#8b6f00'; ctx.font = 'bold 26px Tahoma';
    ctx.fillText(d.schoolName, sx + sbW - 20, cy + 60);
    ctx.textAlign = 'center'; cy += sbH + 25;
  }
  var divY = cy + 15;
  ctx.strokeStyle = '#FFC107'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W/2-140, divY); ctx.lineTo(W/2-30, divY);
  ctx.moveTo(W/2+30, divY); ctx.lineTo(W/2+140, divY);
  ctx.stroke();
  ctx.fillStyle = '#FFC107'; ctx.font = '24px Tahoma'; ctx.fillText('✿', W/2, divY+8);
  cy = divY + 40;
  var pcx = W/2, pcy = cy + 90, pr = 90;
  ctx.fillStyle = '#FFC107'; ctx.beginPath(); ctx.arc(pcx, pcy, pr+12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fffdf5'; ctx.beginPath(); ctx.arc(pcx, pcy, pr+8, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#b8860b'; ctx.beginPath(); ctx.arc(pcx, pcy, pr+4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fffdf5'; ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI*2); ctx.fill();
  var ph = d.photo ? await loadImage(d.photo) : null;
  if (ph){ ctx.save(); ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, Math.PI*2); ctx.clip(); ctx.drawImage(ph, pcx-pr, pcy-pr, pr*2, pr*2); ctx.restore(); }
  else drawEmoji(ctx, d.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️', pcx, pcy+5, 130);
  cy = pcy + pr + 50;
  ctx.fillStyle = '#6b7280'; ctx.font = 'bold 24px Tahoma'; ctx.textAlign = 'center';
  ctx.fillText('تتشرف هذه الشهادة بأن تمنح', W/2, cy);
  cy += 70;
  ctx.fillStyle = '#283593'; ctx.font = 'bold 76px Tahoma';
  ctx.fillText(d.name, W/2, cy);
  cy += 40;
  var roleTxt = d.role.replace('🏆 ', '').trim();
  ctx.font = 'bold 26px Tahoma';
  var rW = ctx.measureText(roleTxt).width + 60;
  var rH = 50; var rX = (W - rW) / 2; var rY = cy;
  var rg = ctx.createLinearGradient(rX, 0, rX + rW, 0);
  rg.addColorStop(0, '#FFC107'); rg.addColorStop(1, '#FFD54F');
  ctx.fillStyle = rg;
  roundRectPath(ctx, rX, rY, rW, rH, 25); ctx.fill();
  ctx.fillStyle = '#6b4d00'; ctx.textBaseline = 'middle';
  ctx.fillText(roleTxt, W/2, rY + rH/2 + 2);
  ctx.textBaseline = 'alphabetic';
  cy += rH + 55;
  ctx.fillStyle = '#374151'; ctx.font = '22px Tahoma';
  cy = drawCenterText(ctx, d.desc, W/2, cy, 820);
  cy += 65;
  drawEmoji(ctx, '⭐', W/2-80, cy, 60);
  drawEmoji(ctx, '⭐', W/2, cy, 60);
  drawEmoji(ctx, '⭐', W/2+80, cy, 60);
  cy += 70;
  var sD = [{n:String(d.points),l:'نقطة'},{n:d.completed+'/'+d.total,l:'أقسام'},{n:String(d.perfect),l:'إتقان'}];
  var bw = 160, bh = 90, gap = 16;
  var tw = sD.length*bw + (sD.length-1)*gap;
  var bx0 = (W - tw)/2;
  sD.forEach(function(s,i){
    var bx = bx0 + i*(bw+gap);
    ctx.fillStyle = '#fffdf5'; roundRectPath(ctx, bx, cy, bw, bh, 14); ctx.fill();
    ctx.strokeStyle = '#FFC10766'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#8b6f00'; ctx.font = 'bold 30px Tahoma'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.n, bx + bw/2, cy + 34);
    ctx.fillStyle = '#6b7280'; ctx.font = 'bold 15px Tahoma';
    ctx.fillText(s.l, bx + bw/2, cy + 66);
  });
  ctx.textBaseline = 'alphabetic';
  cy += bh + 40;
  ctx.strokeStyle = '#c5cae9'; ctx.lineWidth = 1.5; ctx.setLineDash([6,6]);
  ctx.beginPath(); ctx.moveTo(140, cy); ctx.lineTo(W-140, cy); ctx.stroke();
  ctx.setLineDash([]);
  cy += 40;
  var sigSlots = d.supervisorName
    ? [{x: W/2-200, label: d.sheikhLabel, name: d.sheikhName}, {x: W/2+200, label: d.supervisorLabel, name: d.supervisorName}]
    : [{x: W/2, label: d.sheikhLabel, name: d.sheikhName}];
  sigSlots.forEach(function(sig){
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b7280'; ctx.font = 'bold 16px Tahoma';
    ctx.fillText(sig.label, sig.x, cy);
    ctx.strokeStyle = '#28359344'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sig.x-100, cy+30); ctx.lineTo(sig.x+100, cy+30); ctx.stroke();
    ctx.fillStyle = '#283593'; ctx.font = 'bold 22px Tahoma';
    ctx.fillText(sig.name, sig.x, cy+60);
  });
  ctx.fillStyle = '#6b7280'; ctx.font = 'bold 18px Tahoma'; ctx.textAlign = 'center';
  ctx.fillText(d.date, W/2, H-110);
  ctx.fillStyle = '#9ca3af'; ctx.font = '15px monospace';
  ctx.fillText(d.certId, W/2, H-80);
  return new Promise(function(resolve){
    canvas.toBlob(function(blob){ resolve(blob); }, 'image/png', 0.95);
  });
}
function blobToDataURL(blob){
  return new Promise(function(resolve){
    var r = new FileReader();
    r.onload = function(){ resolve(r.result); };
    r.readAsDataURL(blob);
  });
}
async function ensureCertBlob(){
  if (LAST_CERT_BLOB) return LAST_CERT_BLOB;
  try { LAST_CERT_BLOB = await renderCertificateToBlob(); return LAST_CERT_BLOB; }
  catch(e){ alert('تعذر توليد صورة الشهادة'); return null; }
}
function showPreview(src){ $('preview-img').src = src; show('view-preview'); }
function closePreview(){ show('view-certificate'); }
async function shareCertificate(){
  var blob = await ensureCertBlob(); if (!blob) return;
  var url = await blobToDataURL(blob); showPreview(url);
}
async function doSharePreview(){
  var blob = LAST_CERT_BLOB;
  if (!blob){ toast('جارٍ التحضير...'); blob = await ensureCertBlob(); }
  if (!blob) return;
  var d = buildCertData();
  var file = new File([blob], 'شهادة_' + d.name + '.png', {type: 'image/png'});
  if (navigator.canShare && navigator.canShare({files: [file]})){
    try { await navigator.share({files: [file], title: d.title}); return; }
    catch(e){ if (e.name === 'AbortError') return; }
  }
  await downloadImageFallback(blob, d.name);
  toast('📋 نُسخت الشهادة');
}
async function downloadCertificate(){
  var blob = await ensureCertBlob(); if (!blob) return;
  await downloadImageFallback(blob, buildCertData().name);
}
async function downloadImageFallback(blob, name){
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'شهادة_' + name + '.png';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
  toast('💾 تم تنزيل الشهادة');
}
function doDownloadPreview(){ closePreview(); downloadCertificate(); }
var LAST_CERT_BLOB = null;
