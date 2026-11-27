/* ===== الملف الشخصي ===== */
function showProfile(){
  applyBigText(); // 9.42
  var s = STATE.student;
  var av = $('profile-avatar');
  if (s.photo) av.innerHTML = '<img data-media="' + mediaRef('img', s.photo) + '" alt="">';
  else av.innerHTML = '<span class="emoji">' + (s.gender === 'girl' ? '🧚‍♀️' : '🦸‍♂️') + '</span>';
  $('profile-name').textContent = s.name || '—';
  $('profile-sub').textContent = s.gender === 'girl' ? '🌸 طالبة متميزة' : '⭐ طالب متميز';
  $('profile-points').textContent = STATE.stats.totalPoints || 0;
  $('profile-stats').textContent = 'أقسام: ' + (STATE.stats.completedSections || 0) + '/' + realSections().length + ' · مفاهيم متقنة: ' + certLevel().mastered + '/' + realSections().length;

  var list = $('profile-recordings-list');
  var keys = Object.keys(STATE.studentAudios);
  if (!keys.length){
    list.innerHTML = '<div class="notice info">لم تسجّل شيئاً بعد.</div>';
  } else {
    var h = '';
    keys.forEach(function(id){
      var status = STATE.studentAudios[id].status || 'pending';
      var label = status === 'approved' ? '✅ معتمد' : status === 'rejected' ? '🔁 أعد تسجيله' : (STATE.studentAudios[id].sentAt ? '⏳ بانتظار المعلم' : '💾 لم يُرسل بعد');
      h += '<div data-rec-id="' + escapeHTML(id) + '" data-style="padding:10px;border-bottom:1px solid #eef0f6;display:flex;justify-content:space-between;align-items:center;gap:8px">';
      h += '<div data-style="font-weight:800;color:var(--primary);font-size:.88rem">' + escapeHTML(itemLabelById(id)) + '</div>';
      h += '<span class="pill">' + label + '</span></div>';
    });
    list.innerHTML = h;
  }
  show('view-profile');
  try { updateExamButtons(); updateRetestButtons(); } catch(e){}
  try { inPersonProfileExtras(); } catch(e){} // 9.40
}
