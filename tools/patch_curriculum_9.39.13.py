# -*- coding: utf-8 -*-
"""9.39.13 (ق3-أ، قرار المالك ج): أسئلة الإدغام الـ12 القائمة في درس s3 تُعرض بالرسم الإملائي.
كانت بالرسم العثماني، والشدة على أول الحرف التالي تكشف الإدغام، والسكون الظاهر في الأسئلة الإملائية يكشف الإظهار،
فكان الدرس كله يُحل من العلامات. بالرسم الإملائي النون الساكنة ساكنة دائمًا والتنوين عادي ولا شدة على الحرف التالي،
فيلزم معرفة الحكم من الحرف التالي نفسه.
- كل سؤال يحفظ صيغته السابقة في prev، ويحمل review = pending حتى يراجعه الشيخ (يُخفى على الموقع الرئيسي، D5).
- المصدر: «(رسم إملائي، قوبل بنص تنزيل)»، والفاحص tools/verify_s3_imlaei_9.39.13.py يقابل الهيكل الحرفي بنص تنزيل.
يُطبَّق على المنهج المصدر، ونسختي التطبيق، والاستوديو. قابل لإعادة التشغيل. ثم tools/rebuild_html.py"""
import json, re

SRC = 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'
APP = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
STUDIO = 'studio/استوديو_المشرف_v9.39.html'

QN = 'ما حكم النون الساكنة أو التنوين في الكلمة الملوّنة؟ (مكتوبة بالرسم الإملائي)'
LBL = '(رسم إملائي، قوبل بنص تنزيل)'
# المعرّف ← (النص الإملائي، السؤال، المصدر)
CONV = {
    'x3_1': ('﴿وَلَمْ <b>يَكُنْ لَهُ</b> كُفُوًا أَحَدٌ﴾', 'ما حكم النون الساكنة في «يَكُنْ لَهُ»؟ (مكتوبة بالرسم الإملائي)', 'الإخلاص 112:4 ' + LBL),
    'x3_2': ('﴿فِي جِيدِهَا حَبْلٌ <b>مِنْ مَسَدٍ</b>﴾', 'ما حكم النون الساكنة في «مِنْ مَسَدٍ»؟ (مكتوبة بالرسم الإملائي)', 'المسد 111:5 ' + LBL),
    'ex_idgham_g_1': ('﴿لِكُلِّ <b>امْرِئٍ</b> مِنْهُمْ يَوْمَئِذٍ شَأْنٌ يُغْنِيهِ﴾', QN, 'عبس 80:37 ' + LBL),
    'ex_idgham_g_2': ('﴿<b>وَوَالِدٍ</b> وَمَا وَلَدَ﴾', QN, 'البلد 90:3 ' + LBL),
    'ex_idgham_g_3': ('﴿<b>وَنَفْسٍ</b> وَمَا سَوَّاهَا﴾', QN, 'الشمس 91:7 ' + LBL),
    'ex_idgham_g_4': ('﴿بَلْ هُوَ <b>قُرْآنٌ</b> مَجِيدٌ﴾', QN, 'البروج 85:21 ' + LBL),
    'ex_idgham_g_5': ('﴿<b>رَسُولٌ</b> مِنَ اللَّهِ يَتْلُو صُحُفًا مُطَهَّرَةً﴾', QN, 'البينة 98:2 ' + LBL),
    'ex_idgham_n_1': ('﴿إِنَّ رَبَّهُمْ بِهِمْ <b>يَوْمَئِذٍ</b> لَخَبِيرٌ﴾', QN, 'العاديات 100:11 ' + LBL),
    'ex_idgham_n_2': ('﴿وَيْلٌ <b>يَوْمَئِذٍ</b> لِلْمُكَذِّبِينَ﴾', QN, 'المطففين 83:10 ' + LBL),
    'ex_idgham_n_3': ('﴿هَلْ فِي ذَلِكَ <b>قَسَمٌ</b> لِذِي حِجْرٍ﴾', QN, 'الفجر 89:5 ' + LBL),
    'ex_idgham_n_4': ('﴿إِنْ كُلُّ <b>نَفْسٍ</b> لَمَّا عَلَيْهَا حَافِظٌ﴾', QN, 'الطارق 86:4 ' + LBL),
    'ex_idgham_n_5': ('﴿وَمَا هُوَ بِقَوْلِ <b>شَيْطَانٍ</b> رَجِيمٍ﴾', QN, 'التكوير 81:25 ' + LBL),
}

def fix_q(q):
    c = CONV.get(q.get('id'))
    if not c or q.get('text') == c[0]: return 0
    q['prev'] = {'text': q.get('text'), 'question': q.get('question'), 'source': q.get('source')}
    q['text'], q['question'], q['source'] = c
    q['review'] = 'pending'
    return 1

def fix_sections(secs):
    return sum(fix_q(q) for s in secs if s.get('id') == 's3_idgham' for q in (s.get('questions') or []))

def main():
    src = json.load(open(SRC, encoding='utf-8'))
    n = fix_sections(src['sections'])
    src['meta']['fixes_9_39_13'] = ('ق3-أ: أسئلة الإدغام الـ12 في s3 بالرسم الإملائي (لا شدة تكشف الإدغام)، وصيغتها السابقة في prev، '
        'وتنتظر مراجعة الشيخ (review = pending).')
    open(SRC, 'w', encoding='utf-8').write(json.dumps(src, ensure_ascii=False, indent=1)); print(SRC, n)
    RX = re.compile(r'(var PACK_DATA = )(.*?)(;\n/\* ===PACK_DATA_END)', re.S)
    for f in APP:
        s = open(f, encoding='utf-8').read(); m = RX.search(s)
        pk = json.loads(m.group(2)); assert json.dumps(pk, ensure_ascii=False) == m.group(2)
        n = fix_sections(pk['curriculum'])
        open(f, 'w', encoding='utf-8').write(s[:m.start(2)] + json.dumps(pk, ensure_ascii=False) + s[m.end(2):]); print(f, n)
    s = open(STUDIO, encoding='utf-8').read()
    m = re.search(r'^(var CURRICULUM = )(.*)(;)$', s, re.M)
    cur = json.loads(m.group(2)); assert json.dumps(cur, ensure_ascii=False) == m.group(2)
    n = fix_sections(cur)
    open(STUDIO, 'w', encoding='utf-8').write(s[:m.start(2)] + json.dumps(cur, ensure_ascii=False) + s[m.end(2):]); print(STUDIO, n)

if __name__ == '__main__':
    main()
