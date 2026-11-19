# -*- coding: utf-8 -*-
"""9.39.6: RT9395-01 (هوية لكل تسجيل مستقلة عن الساعة) وRT9395-02 (بيان الإهداء من الأصوات الموجودة فعلًا).
شغّله من جذر المستودع ثم tools/rebuild_html.py — قابل لإعادة التشغيل."""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = []
def rep(old, new): R.append((old, new))

# ---------- RT9395-01: معرّف عشوائي لكل تسجيل؛ القرار مربوط بالمعرّف لا بالتاريخ ----------
rep("""function newStudentId(){""",
"""/* 9.39.6 (RT9395-01): هوية التسجيل رقم عشوائي يُنشأ مع كل تسجيل جديد، فلا تتأثر برجوع ساعة الجهاز أو تساويها */
function newRecId(){
  try { var u = new Uint8Array(12); crypto.getRandomValues(u); var s = ''; for (var i = 0; i < u.length; i++) s += ('0' + u[i].toString(16)).slice(-2); return 'rec_' + s; } catch(e){}
  return 'rec_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
/* هل التسجيل المحلي غير التسجيل الذي صدر عنه قرار الحزمة؟ بالمعرّف إن وُجد، وبالتاريخ للبيانات القديمة وحدها */
function isNewerLocalRecording(local, fromPack){
  if (!local || local.status !== 'pending') return false;
  if (local.rid) return String(fromPack && fromPack.v || '') !== local.rid;
  if (!local.updatedAt) return false;
  var pv = fromPack && fromPack.v ? (Date.parse(fromPack.v) || 0) : 0;
  return !pv || (Date.parse(local.updatedAt) || 0) > pv;
}
function newStudentId(){""")

rep("""                STATE.studentAudios[itemId] = {status: 'pending', updatedAt: new Date().toISOString(), partial: !!interrupted};""",
"""                STATE.studentAudios[itemId] = {status: 'pending', updatedAt: new Date().toISOString(), rid: newRecId(), partial: !!interrupted};""")
rep("""    STATE.studentAudios[itemId] = {status:'pending', updatedAt:new Date().toISOString(), source: prepared !== file ? 'uploaded-compressed' : 'uploaded-replacement'};""",
"""    STATE.studentAudios[itemId] = {status:'pending', updatedAt:new Date().toISOString(), rid: newRecId(), source: prepared !== file ? 'uploaded-compressed' : 'uploaded-replacement'};""")

rep("""    if (local && local.status === 'pending' && local.updatedAt){
      var lt = Date.parse(local.updatedAt) || 0, pv = fromPack.v ? (Date.parse(fromPack.v) || 0) : 0;
      if (!pv || lt > pv) return;
    }""",
"""    if (isNewerLocalRecording(local, fromPack)) return; // 9.39.6: بالمعرّف لا بالساعة""")

rep("""        var reRecorded = !!(prevRec && localRec.status === 'pending' && localRec.updatedAt && (!prevRec.v || (Date.parse(localRec.updatedAt) || 0) > (Date.parse(prevRec.v) || 0)));""",
"""        var reRecorded = !!(prevRec && isNewerLocalRecording(localRec, prevRec)); // 9.39.6: بالمعرّف لا بالساعة""")

rep("""          studentAudiosOut[id] = {audio: await blobToBase64(blob), status:'pending', partial: !!localRec.partial, v: localRec.updatedAt || ''};""",
"""          studentAudiosOut[id] = {audio: await blobToBase64(blob), status:'pending', partial: !!localRec.partial, v: localRec.rid || localRec.updatedAt || ''};""")

# ---------- RT9395-02: البيان من الأصوات الموجودة فعلًا (الشيخ والزملاء) لكل مهمة ----------
rep("""function curriculumTasks(){
  var out = [];""", """function curriculumTasks(masters){
  masters = masters || {};
  var out = [];""")
rep("""    (sec.questions || []).forEach(function(q){ if ((q.textType === 'quran' || detectTextType(q) === 'quran') && PACK_DATA.masterAudios && PACK_DATA.masterAudios[q.id]) out.push(""",
"""    (sec.questions || []).forEach(function(q){ if ((q.textType === 'quran' || detectTextType(q) === 'quran') && masters[q.id]) out.push(""")
rep("""function buildGiftContents(groups){
  var have = {};""", """function buildGiftContents(groups, masters){
  masters = (masters && typeof masters === 'object') ? masters : {};
  var have = {};""")
rep("""  var secs = [], byId = {}, total = 0, withPeer = 0;
  curriculumTasks().forEach(function(t){
    var s = byId[t.sec]; if (!s){ s = byId[t.sec] = {id: String(t.sec), title: String(t.secTitle || '').slice(0, 80), total: 0, withPeer: 0, items: []}; secs.push(s); }
    s.total++; total++;
    if (have[t.id]){ s.withPeer++; withPeer++; s.items.push({id: String(t.id), kind: t.kind, label: t.label, peers: have[t.id]}); }
  });
  return {v: 1, totalTasks: total, withPeer: withPeer, complete: total > 0 && withPeer === total, sections: secs};""",
"""  var secs = [], byId = {}, total = 0, withPeer = 0, withMaster = 0, noAudio = 0;
  curriculumTasks(masters).forEach(function(t){
    var s = byId[t.sec]; if (!s){ s = byId[t.sec] = {id: String(t.sec), title: String(t.secTitle || '').slice(0, 80), total: 0, withPeer: 0, withMaster: 0, items: []}; secs.push(s); }
    var m = !!masters[t.id], p = !!have[t.id];
    s.total++; total++;
    if (m){ s.withMaster++; withMaster++; }
    if (!m && !p) noAudio++;
    if (p){ s.withPeer++; withPeer++; s.items.push({id: String(t.id), kind: t.kind, label: t.label, peers: have[t.id], master: m}); }
  });
  return {v: 2, totalTasks: total, withPeer: withPeer, withMaster: withMaster, noAudio: noAudio, complete: total > 0 && withPeer === total, sections: secs};""")

rep("""  var lines = ['📚 ما ستتعلمه: المنهج كاملًا (' + gc.sections.length + ' درسًا) بالشرح والأبيات والاختبارات وتلاوة الشيخ.',
    '🎧 تسجيلات زميل معتمدة من المعلم في ' + gc.withPeer + ' من ' + gc.totalTasks + ' مهمة' + (gc.complete ? ' (الإهداء كامل).' : '. المهام الأخرى فيها تلاوة الشيخ وحدها.'), ''];
  gc.sections.forEach(function(s){
    lines.push((s.withPeer ? '✅ ' : '○ ') + s.title + (s.withPeer ? ' — تسجيل زميل في ' + s.withPeer + ' من ' + s.total : ''));
    (s.items || []).forEach(function(it){ lines.push('    • ' + it.kind + (it.label ? ': ' + it.label : '')); });
  });""",
"""  /* 9.39.6 (RT9395-02): كل جملة هنا تُشتق من الأصوات الموجودة فعلًا؛ لا وعد بتلاوة غير موجودة */
  var T = gc.totalTasks || 0, M = gc.withMaster || 0, P = gc.withPeer || 0, N = gc.noAudio || 0;
  var masterLine = !T ? '' : (M === T ? '📿 تلاوة الشيخ موجودة في كل المهام (' + T + ').' : (M ? '📿 تلاوة الشيخ موجودة في ' + M + ' من ' + T + ' مهمة فقط.' : '⚠️ لا توجد تلاوة مرجعية للشيخ في هذا الإهداء.'));
  var lines = ['📚 ما ستتعلمه: المنهج كاملًا (' + gc.sections.length + ' درسًا) بالشرح والأبيات والاختبارات.', masterLine,
    '🎧 تسجيلات زميل معتمدة من المعلم في ' + P + ' من ' + T + ' مهمة' + (gc.complete ? ' (كل المهام).' : '.')];
  if (N) lines.push('🔇 ' + N + ' مهمة بلا أي صوت مرجعي (لا تلاوة شيخ ولا تسجيل زميل): تعتمد فيها على الشرح والنص.');
  lines.push('');
  gc.sections.forEach(function(s){
    var parts = [];
    if (s.withPeer) parts.push('تسجيل زميل في ' + s.withPeer + ' من ' + s.total);
    if (typeof s.withMaster === 'number') parts.push(s.withMaster === s.total ? 'تلاوة الشيخ في كلها' : (s.withMaster ? 'تلاوة الشيخ في ' + s.withMaster + ' من ' + s.total : 'بلا تلاوة شيخ'));
    lines.push((s.withPeer ? '✅ ' : '○ ') + s.title + (parts.length ? ' — ' + parts.join('، ') : ''));
    (s.items || []).forEach(function(it){ lines.push('    • ' + it.kind + (it.label ? ': ' + it.label : '') + (it.master === false ? ' (زميل فقط، بلا تلاوة شيخ)' : '')); });
  });""")

# العرض للمهدى إليه يُحسب من محتوى الملف الفعلي وما سيُعرض فعلًا (أصوات الزملاء تُعرض فقط عند التوثيق)
rep("""function showGiftContents(){
  var gc = PACK_DATA.giftContents;
  var txt = gc ? giftContentsText(gc) : 'هذا الإهداء صادر بإصدار سابق لا يحمل بيانًا بمحتواه.';""",
"""function displayedGiftContents(){ return buildGiftContents(peerAudiosAllowed() ? normalizePeerGroups() : [], PACK_DATA.masterAudios); }
function giftContentsDisplayText(){
  var txt = giftContentsText(displayedGiftContents());
  if (!PACK_DATA.giftContents) txt += '\\n\\nℹ️ هذا الإهداء صادر بإصدار سابق، فهذا الوصف محسوب من محتوى الملف.';
  if (!peerAudiosAllowed()) txt += '\\n\\n⚠️ الاعتماد غير موثّق، فلا تُعرض تسجيلات الزملاء ولا تُحسب في هذا الوصف.';
  return txt;
}
function refreshGiftContentsBox(){ var b = document.getElementById('gift-contents-box'); if (b) b.textContent = giftContentsDisplayText(); }
function showGiftContents(){
  var txt = giftContentsDisplayText();"""),
("""  var txt = giftContentsDisplayText();
  if (GIFT_TRUST !== 'verified') txt += '\\n\\n⚠️ الاعتماد غير موثّق، فلن تُعرض تسجيلات الزملاء.';""", """  var txt = giftContentsDisplayText();""")
rep("""    gcBox.textContent = PACK_DATA.giftContents ? giftContentsText(PACK_DATA.giftContents) : 'هذا الإهداء صادر بإصدار سابق لا يحمل بيانًا بمحتواه.';""",
"""    gcBox.textContent = giftContentsDisplayText();""")
rep("""    try { GIFT_TRUST = await verifyGiftPack(PACK_DATA); } catch(e){ GIFT_TRUST = 'invalid'; }""",
"""    try { GIFT_TRUST = await verifyGiftPack(PACK_DATA); } catch(e){ GIFT_TRUST = 'invalid'; }
    try { refreshGiftContentsBox(); } catch(e){}""")
rep("""  var preview = buildGiftContents(_inherited.concat([{audios: _own}]));""",
"""  var preview = buildGiftContents(_inherited.concat([{audios: _own}]), PACK_DATA.masterAudios);""")
rep("""    newPack.giftContents = buildGiftContents(mergedGroups); // 9.39.5 (R08): يدخل في التوقيع v4""",
"""    newPack.giftContents = buildGiftContents(mergedGroups, newPack.masterAudios || PACK_DATA.masterAudios); // 9.39.5/9.39.6: يدخل في التوقيع v4""")

rep("""  var txt = giftContentsDisplayText();
  if (GIFT_TRUST !== 'verified') txt += '\\n\\n⚠️ الاعتماد غير موثّق، فلن تُعرض تسجيلات الزملاء.';""", """  var txt = giftContentsDisplayText(); // التنبيه صار داخل giftContentsDisplayText""")

for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new in s: continue
        n = s.count(old)
        if n != 1: sys.exit('%s: expected 1 match, got %d for: %s' % (f, n, old[:100]))
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
