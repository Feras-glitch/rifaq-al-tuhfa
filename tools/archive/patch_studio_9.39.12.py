# -*- coding: utf-8 -*-
"""9.39.12 (E1): الاستوديو يحمل مفتاح توقيع المشرف منذ 9.39.11، وكان بلا CSP و16 معالجًا مضمَّنًا.
أي حقن HTML فيه كان سيجعله أداة توقّع مادة مزوّرة باسم المشرف. الآن:
- المعالجات المضمَّنة صارت data-call / data-change، يوزّعها مستمع واحد بقائمة دوال مسموحة (كالتطبيق)؛
- CSP صارمة للسكربت ببصمة sha256 (يعيد حسابها tools/rebuild_html.py)، بلا اتصال شبكي ولا إطارات ولا نماذج.
قابل لإعادة التشغيل. شغّله من جذر المستودع ثم tools/rebuild_html.py"""
import re, sys
SFILE = 'studio/استوديو_المشرف_v9.39.html'
VERSION = '9.39.12'
s = open(SFILE, encoding='utf-8').read()
orig = s

# 1) CSP (موضع ثابت بعد meta viewport). الأنماط تبقى مضمَّنة (style-src 'unsafe-inline')، فلا تنفيذ سكربت منها ولا اتصال.
CSP = ('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'sha256-PENDING\'; '
       'style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src \'none\'; '
       'worker-src \'none\'; frame-src \'none\'; form-action \'none\'; object-src \'none\'; base-uri \'none\'">')
if 'Content-Security-Policy' not in s:
    m = re.search(r'<meta name="viewport"[^>]*>', s)
    if not m: sys.exit('viewport meta not found')
    s = s[:m.end()] + '\n' + CSP + s[m.end():]

# 2) المعالجات الثابتة في HTML (قبل السكربت فقط)
head, sep, body = s.partition('<script>')
n0 = len(re.findall(r' on[a-z]+="', head))
head = re.sub(r'''onclick="document\.getElementById\('([A-Za-z0-9_-]+)'\)\.click\(\)"''', lambda m: '''data-call='["clickById","%s"]\'''' % m.group(1), head)
head = re.sub(r'''onclick="([A-Za-z_]\w*)\(\)"''', lambda m: '''data-call='["%s"]\'''' % m.group(1), head)
head = re.sub(r'''onchange="([A-Za-z_]\w*)\(event\)"''', lambda m: 'data-change="%s"' % m.group(1), head)
if re.search(r' on[a-z]+="', head): sys.exit('inline handler left in HTML: ' + re.search(r' on[a-z]+="[^"]*"', head).group(0))
s = head + sep + body

# 3) المعالجات في HTML المولَّد (المعرّفات تطابق ^[A-Za-z0-9_-]+$ أو ثوابت داخلية)
DYN = [
    ("""'<div class="group-header" onclick="toggleGroup(\\'' + groupId + '\\')">'""",
     """'<div class="group-header" data-call=\\'["toggleGroup","' + groupId + '"]\\'>'"""),
    ("""'<button class="btn success" onclick="playRecording(\\'' + it.id + '\\')" type="button">""",
     """'<button class="btn success" data-call=\\'["playRecording","' + it.id + '"]\\' type="button">"""),
    ("""'<button class="btn gold" onclick="startRec(\\'' + it.id + '\\')" type="button">""",
     """'<button class="btn gold" data-call=\\'["startRec","' + it.id + '"]\\' type="button">"""),
    ("""'<button class="btn danger" onclick="deleteRec(\\'' + it.id + '\\')" type="button">""",
     """'<button class="btn danger" data-call=\\'["deleteRec","' + it.id + '"]\\' type="button">"""),
    ("""'<button class="btn primary" onclick="startRec(\\'' + it.id + '\\')" type="button">""",
     """'<button class="btn primary" data-call=\\'["startRec","' + it.id + '"]\\' type="button">"""),
    ("""'<button class="btn ghost sm" onclick="document.getElementById(\\'upload-' + it.id + '\\').click()" type="button">""",
     """'<button class="btn ghost sm" data-call=\\'["clickById","upload-' + it.id + '"]\\' type="button">"""),
    ("""class="hidden" onchange="uploadRec(event, \\'' + it.id + '\\')">'""",
     """class="hidden" data-change="uploadRec" data-arg="' + it.id + '">'"""),
]
for old, new in DYN:
    if new in s: continue
    if s.count(old) != 1: sys.exit('dynamic handler not found once: ' + old[:90])
    s = s.replace(old, new)

# 4) الموزّع وقائمة الدوال المسموحة، أول السكربت
DISPATCH = r"""<script>
/* 9.39.12 (E1): موزّع الأحداث — لا معالجات مضمَّنة؛ data-call = ["اسم الدالة", وسائط...]، وdata-change = اسم دالة تستقبل الحدث */
var STUDIO_CALLABLE = ['clickById','startStudio','showSupervisorPublicKey','exportSheikhPack','newWorkspace','showResetDialog','toggleGroup','playRecording','startRec','deleteRec'];
var STUDIO_CHANGE = ['handleSheikhPhoto','handleSupervisorPhoto','handlePoemReciterPhoto','handleSchoolLogo','importCurriculum','uploadRec'];
function clickById(id){ var el = document.getElementById(String(id)); if (el) el.click(); }
document.addEventListener('click', function(ev){
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-call]') : null;
  if (!el || el.disabled) return;
  var spec; try { spec = JSON.parse(el.getAttribute('data-call')); } catch(e){ return; }
  if (!Array.isArray(spec) || typeof spec[0] !== 'string' || STUDIO_CALLABLE.indexOf(spec[0]) < 0) return;
  var fn = window[spec[0]]; if (typeof fn === 'function') fn.apply(null, spec.slice(1).map(String));
});
document.addEventListener('change', function(ev){
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-change]') : null;
  if (!el) return;
  var name = el.getAttribute('data-change');
  if (STUDIO_CHANGE.indexOf(name) < 0 || typeof window[name] !== 'function') return;
  var arg = el.getAttribute('data-arg');
  if (arg === null) window[name](ev); else window[name](ev, arg);
});
"""
if 'STUDIO_CALLABLE' not in s:
    if s.count('<script>\n') < 1: sys.exit('script tag not found')
    i = s.index('<script>\n')
    s = s[:i] + DISPATCH + s[i + len('<script>\n'):]

# 5) رقم الإصدار
s = re.sub(r"var APP_VERSION = '[^']*';", "var APP_VERSION = '" + VERSION + "';", s, count=1)

if s != orig:
    open(SFILE, 'w', encoding='utf-8').write(s)
print('studio patched; inline handlers in HTML before:', n0, 'after: 0')
