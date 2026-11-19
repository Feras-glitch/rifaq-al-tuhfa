# -*- coding: utf-8 -*-
"""9.39.7: معالجة انتقالية للتسجيلات القديمة بلا rid — المطابقة الحرفية للتاريخ بدل المقارنة بالترتيب.
شغّله من جذر المستودع ثم tools/rebuild_html.py — قابل لإعادة التشغيل."""
import sys
FILES = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
R = [("""  if (local.rid) return String(fromPack && fromPack.v || '') !== local.rid;
  if (!local.updatedAt) return false;
  var pv = fromPack && fromPack.v ? (Date.parse(fromPack.v) || 0) : 0;
  return !pv || (Date.parse(local.updatedAt) || 0) > pv;""",
"""  if (local.rid) return String(fromPack && fromPack.v || '') !== local.rid;
  if (!local.updatedAt) return false;
  /* 9.39.7: التسجيل القديم بلا rid — في 9.39.5 كانت v هي updatedAt نفسه حرفيًا، فالمطابقة الحرفية تحدد التسجيل نفسه.
     لا مقارنة بالأقدم/الأحدث إطلاقًا، فرجوع الساعة أو تساويها لا يمنح تسجيلًا آخر قرارًا ليس له.
     الحزم الأقدم من 9.39.5 بلا v تبقى على سلوكها السابق (التسجيل المحلي يبقى قيد المراجعة). */
  var pv = fromPack && fromPack.v ? String(fromPack.v) : '';
  return !pv || pv !== String(local.updatedAt);""")]
for f in FILES:
    s = open(f, encoding='utf-8').read()
    for old, new in R:
        if new in s: continue
        if s.count(old) != 1: sys.exit('%s: no unique match' % f)
        s = s.replace(old, new)
    open(f, 'w', encoding='utf-8').write(s); print('patched', f)
