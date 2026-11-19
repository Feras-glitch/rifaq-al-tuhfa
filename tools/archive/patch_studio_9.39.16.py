# -*- coding: utf-8 -*-
"""9.39.16 (قرار المالك ق4): تسجيل المتن بيتًا بيتًا في الاستوديو.
- المتن صار 61 عنصرًا (بيت لكل عنصر) بمعرّف «<عنصر القسم>__v<رقم البيت في القسم>»، لا قطعة لكل قسم.
  التطبيق يعرض لكل بيت مشغّلًا و«كرّر 3 مرات»، ويظلل البيت الجاري.
- زر «🎙️ سجّل البيت التالي» يفتح أول بيت بلا تسجيل ويبدأ تسجيله؛ وإرشادات التسجيل فوق الأبيات.
- تسجيل القسم كاملًا من إصدار سابق يبقى ظاهرًا (قديم) ما دام موجودًا، ليُسمع أو يُحذف، ويُصدَّر كما كان.
- صوت المتن جزء من المادة المرجعية، فيغطيه توقيع المشرف (ق1-ب) دون تغيير.
قابل لإعادة التشغيل. ثم tools/rebuild_html.py"""
import sys
SFILE = 'studio/استوديو_المشرف_v9.39.html'
R = []
def rep(old, new): R.append((old, new))

rep("""      var isQ = it.type === 'quran'; list.push({id:it.id,group:isQ ? 'quran' : 'matn',label:it.id + (isQ ? ' — آية' : ' — متن'),text:it.text,short:sec.title,isQuran:isQ});""",
    """      var isQ = it.type === 'quran';
      if (isQ){ list.push({id:it.id,group:'quran',label:it.id + ' — آية',text:it.text,short:sec.title,isQuran:true}); return; }
      /* 9.39.16 (ق4): بيت لكل تسجيل؛ وتسجيل القسم كاملًا (إصدار سابق) يظهر ما دام موجودًا */
      if (typeof STATE !== 'undefined' && STATE.recordings && STATE.recordings[it.id]) list.push({id:it.id,group:'matn',label:'تسجيل القسم كاملًا (قديم)',text:'',short:sec.title,isQuran:false,legacy:true});
      String(it.text || '').split(/<br\\s*\\/?>/i).map(function(v){ return v.trim(); }).filter(Boolean).forEach(function(v, i){
        VERSE_NO++; list.push({id:it.id + '__v' + (i + 1),group:'matn',label:'البيت ' + VERSE_NO,text:v,short:sec.title,isQuran:false,verse:VERSE_NO});
      });""")
rep("""function buildRecordingList(){
  var list = [];""", """var VERSE_NO = 0;
function buildRecordingList(){
  var list = []; VERSE_NO = 0;""")
rep("""function renderStudio(){
  var done = Object.keys(STATE.recordings).length;""", """function renderStudio(){
  RECORDING_LIST = buildRecordingList(); TOTAL = RECORDING_LIST.length; // 9.39.16: تسجيلات القسم القديمة تظهر ما دامت موجودة
  var done = RECORDING_LIST.filter(function(x){ return STATE.recordings[x.id]; }).length;""")
rep("""  html += '<div class="group-body">';
  items.forEach(function(it){""", """  html += '<div class="group-body">';
  if (groupId === 'matn') html += matnToolsHTML(items); // 9.39.16 (ق4)
  items.forEach(function(it){""")
rep("""function toggleGroup(g){""", """/* 9.39.16 (ق4): إرشادات التسجيل وزر «سجّل البيت التالي» */
function nextVerseItem(){ return RECORDING_LIST.filter(function(x){ return x.group === 'matn' && x.verse && !STATE.recordings[x.id]; })[0] || null; }
function matnToolsHTML(items){
  var verses = items.filter(function(x){ return x.verse; }), left = verses.filter(function(x){ return !STATE.recordings[x.id]; }).length, nx = nextVerseItem();
  var h = '<div class="notice" style="margin-bottom:10px;font-size:.88rem;line-height:1.8">🎙️ <b>تسجيل المتن بيتًا بيتًا</b> (' + (verses.length - left) + ' من ' + verses.length + '):' +
    '<br>• غرفة هادئة، والهاتف على بعد شبر. • إيقاع إنشاد ثابت في كل الأبيات. • نصف ثانية صمت في أول التسجيل وآخره.' +
    '<br>• يُسجَّل بعد اعتماد الشيخ لضبط الأبيات (ورقة المراجعة: docs/MATN_REVIEW_SHEET.md)، فيطابق الصوت النص.</div>';
  if (nx) h += '<button class="btn primary" style="width:100%;margin-bottom:10px" data-call=\\'["recordNextVerse"]\\' type="button" id="btn-next-verse">🎙️ سجّل البيت التالي: ' + nx.label + ' (' + nx.short + ')</button>';
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
function toggleGroup(g){""")
rep("""var STUDIO_CALLABLE = ['clickById','startStudio','showSupervisorPublicKey','exportSheikhPack','newWorkspace','showResetDialog','toggleGroup','playRecording','startRec','deleteRec'];""",
    """var STUDIO_CALLABLE = ['clickById','startStudio','showSupervisorPublicKey','exportSheikhPack','newWorkspace','showResetDialog','toggleGroup','playRecording','startRec','deleteRec','recordNextVerse'];""")

s = open(SFILE, encoding='utf-8').read()
for old, new in R:
    if new in s: continue
    if s.count(old) != 1: sys.exit('expected 1 match for: ' + old[:100])
    s = s.replace(old, new)
open(SFILE, 'w', encoding='utf-8').write(s); print('patched', SFILE)
