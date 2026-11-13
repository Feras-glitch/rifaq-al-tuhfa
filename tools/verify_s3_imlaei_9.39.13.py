#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""9.39.13 (ق3-أ): فاحص أسئلة الإدغام الـ12 في s3 بعد عرضها بالرسم الإملائي.
التشغيل: python3 -I tools/verify_s3_imlaei_9.39.13.py
يفحص لكل سؤال:
 1) المصدر «السورة س:آ (رسم إملائي، قوبل بنص تنزيل)» واسم السورة من quran-uthmani.xml.
 2) أن كلمات النص متتالية في الآية في نص تنزيل (الهيكل الحرفي بعد حذف الضبط؛ «ىٰ» وسط الكلمة ألف).
 3) العرض إملائي: لا علامات عثمانية ولا ألف وصل ولا ألف خنجرية ولا تطويل؛ النون الساكنة بسكون ظاهر.
 4) في الكلمة الملوّنة موضع واحد للنون الساكنة أو التنوين، والحكم المحسوب من الحرف التالي == الجواب المعلَّم.
 5) لا شدة على الحرف التالي لموضع الحكم، فلا تكشفه العلامات: «قاعدة العلامات» تتنبأ بالإظهار هنا وتخطئ.
 6) review = pending والصيغة السابقة محفوظة في prev، والنسخ في التطبيق والتجربة والاستوديو مطابقة للمصدر.
يخرج بالرمز 0 إن نجح كل شيء."""
import json, re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
os.chdir(ROOT)
# أدوات التحليل من فاحص 9.39.11 (ما قبل الفحوص فقط)
_src = open(os.path.join(HERE, 'verify_lesson_items_9.39.11.py'), encoding='utf-8').read()
_cut = _src.index('# ---------------------------------------------------------------- 1) البنية')
_ns = {'__name__': 'helpers'}
_argv = sys.argv; sys.argv = [sys.argv[0]]
exec(compile(_src[:_cut], 'verify_lesson_items_9.39.11.py', 'exec'), _ns)
sys.argv = _argv
parse, key_imlai, plain, is_mark_token = _ns['parse'], _ns['key_imlai'], _ns['plain'], _ns['is_mark_token']
sites, following_letter, nun_rule, label_core = _ns['sites'], _ns['following_letter'], _ns['nun_rule'], _ns['label_core']
SURA, NAME_ALIASES, T = _ns['SURA'], _ns['NAME_ALIASES'], _ns['T']
SUKUN, SHADDA, TANWEEN = _ns['SUKUN'], _ns['SHADDA'], _ns['TANWEEN']

CURR = 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'
IDS = ['x3_1', 'x3_2'] + ['ex_idgham_g_%d' % i for i in range(1, 6)] + ['ex_idgham_n_%d' % i for i in range(1, 6)]
ERR = []
def err(i, m): ERR.append('%s: %s' % (i, m))

def ukey(w):
    """هيكل كلمة عثمانية: «ىٰ» قبل حرف آخر في الكلمة ألفٌ تُكتب ألفًا في الإملائي (سَوَّىٰهَا ← سَوَّاهَا)."""
    w = re.sub('ى' + 'ٰ' + r'(?=[ء-ي])', 'ا', w)
    return key_imlai(w)

C = json.load(open(CURR, encoding='utf-8'))
s3 = [s for s in C['sections'] if s['id'] == 's3_idgham'][0]
Q = {q['id']: q for q in s3['questions']}
for qid in IDS:
    q = Q.get(qid)
    if not q: err(qid, 'غير موجود'); continue
    m = re.fullmatch(r'(\S+) (\d+):(\d+) \(رسم إملائي، قوبل بنص تنزيل\)', q.get('source', ''))
    if not m: err(qid, 'صيغة المصدر: ' + q.get('source', '')); continue
    name, su, ay = m.group(1), int(m.group(2)), int(m.group(3))
    if NAME_ALIASES.get(SURA.get(su), SURA.get(su)) != NAME_ALIASES.get(name, name) and SURA.get(su) != name:
        err(qid, 'اسم السورة %s لا يطابق %s' % (name, SURA.get(su)))
    verse = T.get('%d:%d' % (su, ay))
    if not verse: err(qid, 'الآية غير موجودة في تنزيل'); continue
    vkeys = [ukey(w) for w in verse.split(' ') if not is_mark_token(w)]
    words = [w for w in plain(q['text']).split(' ') if not is_mark_token(w)]
    tkeys = [key_imlai(w) for w in words]
    if not any(vkeys[i:i + len(tkeys)] == tkeys for i in range(len(vkeys) - len(tkeys) + 1)):
        err(qid, 'الكلمات لا تطابق آية تنزيل: %s ↔ %s' % (tkeys, vkeys))
    raw = re.sub(r'<[^>]+>', '', q['text'])
    if re.search('[ۖ-ۭٱـٰ]', raw): err(qid, 'علامة عثمانية في النص المعروض')
    # الكلمات الملوّنة ومواضع النون الساكنة/التنوين فيها
    toks = plain(q['text']).split(' ')
    bold = [plain(b) for b in re.findall(r'<b>(.*?)</b>', q['text'])]
    if len(bold) != 1: err(qid, 'إبراز واحد مطلوب'); continue
    bwords = bold[0].split(' ')
    start = next((i for i in range(len(toks)) if toks[i:i + len(bwords)] == bwords), None)
    if start is None: err(qid, 'تعذّر تحديد الكلمة الملوّنة'); continue
    found = []
    for j in range(start, start + len(bwords)):
        L = parse(toks[j])
        for (i, typ) in sites(L, 'n'):
            if typ == 'nun' and SUKUN not in L[i][1]: err(qid, 'نون ساكنة بلا سكون ظاهر في «%s»' % toks[j])
            if following_letter(toks, j, i, typ)[1] != 'end': found.append((j, i, typ))  # آخر الآية وقف، لا حكم
    if len(found) != 1: err(qid, 'مواضع الحكم في الكلمة الملوّنة: %d' % len(found)); continue
    j, i, typ = found[0]
    nb, where, notes = following_letter(toks, j, i, typ)
    rule = nun_rule(nb) if nb else None
    ans = q['options'][q['answer']]
    if not rule or label_core(rule) != label_core(ans): err(qid, 'الحكم المحسوب %s ≠ الجواب %s' % (rule, ans))
    if where == 'cross':
        nxt = parse(toks[next(k for k in range(j + 1, len(toks)) if not is_mark_token(toks[k]))])
        if SHADDA in nxt[0][1]: err(qid, 'شدة على أول الكلمة التالية تكشف الإدغام')
    L = parse(toks[j]); marks = L[i][1]
    heuristic = 'الإظهار' if (SUKUN in marks or any(c in TANWEEN for c in marks)) else '?'
    if label_core(heuristic) == label_core(ans): err(qid, 'العلامات ما زالت تكشف الجواب')
    if q.get('review') != 'pending' or not isinstance(q.get('prev'), dict) or not q['prev'].get('text'):
        err(qid, 'review/prev مفقودان')

# النسخ الأخرى مطابقة للمصدر
RX = re.compile(r'(var PACK_DATA = )(.*?)(;\n/\* ===PACK_DATA_END)', re.S)
for f in ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']:
    pk = json.loads(RX.search(open(f, encoding='utf-8').read()).group(2))
    s = [x for x in pk['curriculum'] if x['id'] == 's3_idgham'][0]
    for q in s['questions']:
        if q['id'] in IDS and json.dumps(q, ensure_ascii=False, sort_keys=True) != json.dumps(Q[q['id']], ensure_ascii=False, sort_keys=True):
            err(q['id'], 'نسخة %s تختلف عن المصدر' % os.path.basename(f))
st = open('studio/استوديو_المشرف_v9.39.html', encoding='utf-8').read()
cur = json.loads(re.search(r'^var CURRICULUM = (.*);$', st, re.M).group(1))
for q in [x for x in cur if x['id'] == 's3_idgham'][0]['questions']:
    if q['id'] in IDS and json.dumps(q, ensure_ascii=False, sort_keys=True) != json.dumps(Q[q['id']], ensure_ascii=False, sort_keys=True):
        err(q['id'], 'نسخة الاستوديو تختلف عن المصدر')

if ERR:
    print('\n'.join(ERR)); print('FAIL', len(ERR)); sys.exit(1)
print('OK: %d أسئلة إدغام إملائية، كلها تطابق تنزيل، والحكم من الحرف التالي، ولا علامة تكشفه' % len(IDS))
