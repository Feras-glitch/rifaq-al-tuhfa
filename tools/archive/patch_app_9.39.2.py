"""9.39.2 — ترقيع التطبيق (والنسخة الهاتفية) بعد مراجعة الخصم الثانية.
(ترقيع __proto__ والتحقق المرتبط به طُبِّق قبله؛ انظر CHANGELOG.)

1) مرساة ثقة خارج الملف: PINNED_TEACHER_KEYS. التطبيق المثبَّت (الصفحة المضيفة) يحقن قائمة مفاتيح المعلمين
   من web/trusted-teachers.json في الكود قبل حساب تجزئة CSP. إذا كانت مُعرَّفة (مصفوفة، ولو فارغة)
   فهي وحدها مرجع الثقة، وتُهمل قائمة الملف trustedTeacherKeys (التي يستطيع أي أحد تعديلها).
   الملف المستقل خارج التطبيق يبقى كما كان (الثقة فيه ذاتية) — قيد معلن.
2) زر «تم الحذف» كان معطَّلًا منذ 9.39 (لم يُدرج markRosterDeleted في قائمة الدوال المسموحة).
3) الحذف يمتد إلى نسخ «الملفات الأخيرة» في الصفحة المضيفة (حذف بيانات الطفل، و«تم الحذف» عند المعلم).
"""
import re
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']

def rep(s, old, new, label):
    n = s.count(old); assert n == 1, f'[{label}] matches={n}'
    return s.replace(old, new)

for path in FILES:
    s = open(path, encoding='utf-8').read()
    # (1) المتغير وموضعه: بعد تنظيف __proto__ مباشرة
    s = rep(s, "})(PACK_DATA, 0);\n\n// Runtime sanity check",
"""})(PACK_DATA, 0);
/* 9.39.2: مرساة الثقة. تحقنها الصفحة المضيفة من إعداد التطبيق المثبَّت (web/trusted-teachers.json).
   null = ملف مستقل خارج التطبيق: الثقة من قائمة الملف نفسه (ذاتية، قيد معلن). */
var PINNED_TEACHER_KEYS = null; /* RIFAQ_PINNED_KEYS */
function trustedKeysFor(pack){ return Array.isArray(PINNED_TEACHER_KEYS) ? PINNED_TEACHER_KEYS : (Array.isArray(pack && pack.trustedTeacherKeys) ? pack.trustedTeacherKeys : []); }

// Runtime sanity check""", 'pinned-var')
    s = rep(s, """  var trusted = Array.isArray(pack.trustedTeacherKeys) ? pack.trustedTeacherKeys : [];
  var th = jwkThumb(sg.key);""", """  var trusted = trustedKeysFor(pack);
  var th = jwkThumb(sg.key);""", 'verify-trusted')
    s = rep(s, """  var trusted = Array.isArray(PACK_DATA.trustedTeacherKeys) ? PACK_DATA.trustedTeacherKeys : [];
  if (!rec || !rec.publicJwk)""", """  var trusted = trustedKeysFor(PACK_DATA);
  if (!rec || !rec.publicJwk)""", 'teacher-status')
    s = rep(s, "untrusted: ' — ⚠️ التوقيع ليس من معلم موثوق'", "untrusted: ' — ⚠️ التوقيع ليس من معلم مسجَّل لدى المشرف'", 'badge')
    # (2) قائمة الدوال المسموحة
    s = rep(s, '"markRosterDeleted"' if '"markRosterDeleted"' in s else '"nextFromResults", ', '"markRosterDeleted", "nextFromResults", ', 'allow')
    # (3) امتداد الحذف إلى الصفحة المضيفة
    s = rep(s, """  roster[sid].deletedAt = new Date().toISOString();
  await keyDbPut('roster', roster);""", """  roster[sid].deletedAt = new Date().toISOString();
  await keyDbPut('roster', roster);
  await forgetInHost(null, sid);""", 'roster-forget')
    s = rep(s, """async function deleteChildDataOnDevice(){""", """/* 9.39.2: إن كان التطبيق يعمل داخل الصفحة المضيفة، نحذف أيضًا نسخ هذا الملف من «الملفات الأخيرة» */
async function forgetInHost(packageId, studentId){
  try { var h = window.parent !== window && window.parent.RIFAQ_HOST; if (h && typeof h.forgetPack === 'function') await h.forgetPack(packageId, studentId); } catch(e){ console.warn('host forget failed', e); }
}
async function deleteChildDataOnDevice(){""", 'forget-fn')
    s = rep(s, """    localStorage.removeItem(STORAGE_KEY);
    if (localStorage.getItem(ACTIVE_PROFILE_KEY) === INITIAL_PROFILE_NAME) localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch(e){}""", """    localStorage.removeItem(STORAGE_KEY);
    if (localStorage.getItem(ACTIVE_PROFILE_KEY) === INITIAL_PROFILE_NAME) localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch(e){}
  await forgetInHost(PACK_DATA.packageId || PACKAGE_ID, PACK_DATA.studentId || (STATE.student && STATE.student.id) || null);""", 'delete-forget')
    open(path, 'w', encoding='utf-8').write(s)
    print('patched', path)
