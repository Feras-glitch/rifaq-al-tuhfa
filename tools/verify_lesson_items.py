#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""فاحص أسئلة الاستخراج المختلطة (lesson_items.json) قبل دمجها في المنهج.

التشغيل:
    python3 -I verify_lesson_items.py [lesson_items.json] [curriculum.json] [tanzil.json] [quran-uthmani.xml]

يفحص:
 1) البنية (schema) وصيغة المعرّفات والحقول.
 2) تفرّد المعرّفات وعدم تعارضها مع معرّفات المنهج الحالي.
 3) أن كلمات كل نص متتالية فعلًا في الآية المذكورة (مطابقة الهيكل الحرفي بعد حذف الضبط
    والعلامات العثمانية، مع مراعاة ألف الوصل ٱ والألف الخنجرية وصور الهمزة والياء/الألف المقصورة).
 4) أن العرض إملائي: سكون عادي وتنوين عادي، بلا شدة على أول الكلمة التالية، بلا ميم إقلاب صغيرة،
    بلا علامات عثمانية؛ وأن في الكلمة الغامقة موضعًا واحدًا فقط للحكم.
 5) أن الحكم المحسوب آليًّا من الحرف التالي الفعلي (في نص تنزيل وفي النص المعروض) يساوي الجواب المعلَّم.
 6) أن الخيارات من الأحكام المدروسة حتى ذلك الدرس فقط.
 7) نسبة كون حكم عنوان الدرس هو الجواب قبل الإضافة وبعدها (≤ 50% في s3 وs4 وs5)، ومطابقتها لما في meta.
 8) عدم وجود تكرار قريب مع أسئلة المنهج الحالية أو بين الأسئلة الجديدة.
ويطبع للعلم: دقة «قاعدة العلامات» الآلية على الأسئلة الجديدة، والتوافق مع فاحص المستودع check_questions.py.
"""
import json, re, sys, unicodedata, difflib
from collections import Counter

ARGS = sys.argv[1:]
ITEMS = ARGS[0] if len(ARGS) > 0 else 'curriculum/drafts/lesson_items_9.39.11.json'
CURR = ARGS[1] if len(ARGS) > 1 else 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'
TANZIL = ARGS[2] if len(ARGS) > 2 else 'curriculum/نص_القرآن_تنزيل_العثماني.json'
XML = ARGS[3] if len(ARGS) > 3 else 'curriculum/quran-uthmani.xml'

ERR, WARN = [], []
def err(qid, msg): ERR.append(f'{qid}: {msg}')
def warn(qid, msg): WARN.append(f'{qid}: {msg}')

D = json.load(open(ITEMS, encoding='utf8'))
C = json.load(open(CURR, encoding='utf8'))
T = json.load(open(TANZIL, encoding='utf8'))
SECS = {s['id']: s for s in C['sections']}
SURA = {int(m.group(1)): m.group(2) for m in
        re.finditer(r'<sura index="(\d+)" name="([^"]+)"', open(XML, encoding='utf8').read())}
# أسماء السور كما يكتبها المنهج (همزة الوصل في «الانشقاق» و«الانفطار»، و«النبأ»)
NAME_ALIASES = {'الإنشقاق': 'الانشقاق', 'الإنفطار': 'الانفطار', 'النبإ': 'النبأ'}

# ---------------------------------------------------------------- الحروف والعلامات
FATHA, DAMMA, KASRA, SUKUN, SHADDA = 'َ', 'ُ', 'ِ', 'ْ', 'ّ'
TANWEEN = set('ًٌٍ')
HARAKAT = {FATHA, DAMMA, KASRA}
SMALL_MEEM = {'ۢ', 'ۭ'}
UTHMANI_SIGNS = set(chr(c) for c in range(0x06D6, 0x06EE))   # علامات الوقف والحروف الصغيرة ونحوها
WAQF = set('ۖۗۘۙۚۛ۞۩')
SAKT = 'ۜ'
DAGGER, WASLA, TATWEEL, MADDAH = 'ٰ', 'ٱ', 'ـ', 'ٓ'
HAMZA_ABOVE, HAMZA_BELOW = 'ٔ', 'ٕ'

def is_base(ch):
    return ('ء' <= ch <= 'ي') or ch in (WASLA, TATWEEL)

def parse(word):
    """يقسم الكلمة إلى [حرف، علاماته] (على صورة NFD لتظهر الهمزة المركبة علامةً)."""
    out = []
    for ch in unicodedata.normalize('NFD', word):
        if is_base(ch):
            out.append([ch, ''])
        elif out:
            out[-1][1] += ch
    # إعادة تركيب صور الهمزة: ا+ٔ=أ، ا+ٕ=إ، و+ٔ=ؤ، ي+ٔ=ئ، ـ+ٔ = همزة على كرسي
    for p in out:
        if HAMZA_ABOVE in p[1] or HAMZA_BELOW in p[1]:
            p[0] = 'ء'
            p[1] = p[1].replace(HAMZA_ABOVE, '').replace(HAMZA_BELOW, '')
    return out

def is_mark_token(w):
    return not any(is_base(c) for c in w)

def letter_class(ch):
    return 'ء' if ch in 'ءأإؤئآ' else ch

def key(word):
    """الهيكل الحرفي للمطابقة: يحذف الضبط والعلامات العثمانية والتطويل وكل صور الألف
    (ومنها ألف الوصل ٱ والألف الخنجرية)، ويوحّد صور الهمزة (أ إ ؤ ئ ـٔ ء ← ء)، والياء/الألف المقصورة."""
    out = []
    for b, m in parse(word):
        if b in ('ا', WASLA, TATWEEL):
            continue
        out.append('ي' if b == 'ى' else b)
    return ''.join(out)

def key_imlai(word):
    """مثل key لكن «آ» في الإملائي = همزة + ألف."""
    w = unicodedata.normalize('NFC', word).replace('آ', 'ءا')
    return key(w)

def vowel_key(word):
    """للمقارنة بين الكلمات الغامقة: الحروف + الحركات القصيرة والتنوين (بلا سكون/شدة/علامات)،
    مع حذف واو العطف وفائه في أول الكلمة."""
    L = parse(word)
    s = ''
    for b, m in L:
        if b in (TATWEEL,):
            continue
        b = 'ا' if b == WASLA else ('ي' if b == 'ى' else b)
        s += b + ''.join(c for c in m if c in HARAKAT or c in TANWEEN)
    s = unicodedata.normalize('NFC', s)
    return re.sub(r'^[وف]َ', '', s)

def plain(t):
    t = re.sub(r'<[^>]+>', '', t)
    t = re.sub(r'[﴿﴾\[\]]', '', t)
    return re.sub(r'\s+', ' ', t).strip()

def skel_text(t):
    return ''.join(key_imlai(w) for w in plain(t).split(' ') if not is_mark_token(w))

# ---------------------------------------------------------------- الأحكام
HALQ, YANMU, LR = set('ءهعحغخ'), set('ينمو'), set('لر')
IKHFA = set('صذثكجشقسدطزفتضظ')
def nun_rule(l):
    l = letter_class(l)
    if l in HALQ: return 'الإظهار'
    if l in YANMU: return 'الإدغام بغنة'
    if l in LR: return 'الإدغام بلا غنة'
    if l == 'ب': return 'الإقلاب'
    if l in IKHFA: return 'الإخفاء'
    return None
def meem_rule(l):
    l = letter_class(l)
    return 'إخفاء شفوي' if l == 'ب' else 'إدغام مثلين صغير' if l == 'م' else 'إظهار شفوي'
IDH_MUTLAQ = ['دنيا', 'صنوان', 'قنوان', 'بنيان']   # تُقارن بهيكلها key() عند النون الوسطى

def sites(L, kind):
    """مواضع النون الساكنة/التنوين (kind='n') أو الميم الساكنة (kind='m') في كلمة محللة."""
    res = []
    for i, (b, m) in enumerate(L):
        if kind == 'n':
            if any(c in TANWEEN for c in m):
                res.append((i, 'tanween'))
            elif b == 'ن' and not any(c in HARAKAT or c == SHADDA for c in m):
                res.append((i, 'nun'))
        else:
            if b == 'م' and not any(c in HARAKAT or c in TANWEEN or c == SHADDA for c in m):
                res.append((i, 'meem'))
    return res

def following_letter(tokens, j, i, typ):
    """الحرف الذي يلي الموضع: داخل الكلمة أو أول حرف في الكلمة التالية.
    يرجع (الحرف، 'inner'/'cross'، ملاحظات)."""
    L = parse(tokens[j])
    notes = []
    if typ != 'tanween':
        for b, m in L[i + 1:]:
            if b == TATWEEL:
                continue
            return b, 'inner', notes
    k = j + 1
    while k < len(tokens) and is_mark_token(tokens[k]):
        if any(c in WAQF for c in tokens[k]): notes.append('علامة وقف بعد الكلمة')
        if SAKT in tokens[k]: notes.append('سكت')
        k += 1
    if any(c == SAKT for c in tokens[j]): notes.append('سكت')
    if k >= len(tokens):
        return None, 'end', notes
    nb = parse(tokens[k])[0][0]
    if nb == WASLA:
        notes.append('همزة وصل بعدها')
    return nb, 'cross', notes

# ---------------------------------------------------------------- إعدادات الأقسام
ALLOWED = {
    's2_idhhar': ["الإظهار", "ليس إظهارًا (حكم سندرسه لاحقًا)"],
    's3_idgham': ["الإظهار", "الإدغام بغنة", "الإدغام بلا غنة"],
    's4_iqlab':  ["الإظهار", "الإدغام بغنة", "الإدغام بلا غنة", "الإقلاب"],
    's5_ikhfa':  ["الإظهار", "الإدغام بغنة", "الإدغام بلا غنة", "الإقلاب", "الإخفاء"],
    's7_meem':   ["إخفاء شفوي", "إدغام مثلين صغير", "إظهار شفوي"],
}
SHORT = {'s2_idhhar': 's2', 's3_idgham': 's3', 's4_iqlab': 's4', 's5_ikhfa': 's5', 's7_meem': 's7'}
QN = "ما حكم النون الساكنة أو التنوين في الكلمة الملوّنة؟ (مكتوبة بالرسم الإملائي)"
QM = "ما حكم الميم الساكنة في الكلمة الملوّنة؟ (مكتوبة بالرسم الإملائي)"
TITLE = {'s2_idhhar': 'إظهار', 's3_idgham': 'إدغام', 's4_iqlab': 'إقلاب', 's5_ikhfa': 'إخفاء'}
LETTER_NAME = {'ء': 'الهمزة', 'ه': 'الهاء', 'ع': 'العين', 'ح': 'الحاء', 'غ': 'الغين', 'خ': 'الخاء',
               'ي': 'الياء', 'ن': 'النون', 'م': 'الميم', 'و': 'الواو', 'ل': 'اللام', 'ر': 'الراء',
               'ب': 'الباء', 'ط': 'الطاء', 'ف': 'الفاء', 'ت': 'التاء', 'د': 'الدال', 'ك': 'الكاف'}
REQ_KEYS = {"id", "type", "text", "textType", "question", "options", "answer", "explanation", "points", "source"}

def label_core(x):
    x = x.strip()
    return x[2:] if x.startswith('ال') else x

def is_title(sec, label):
    return label_core(label).startswith(TITLE[sec])

# ---------------------------------------------------------------- 1) البنية
if set(D.keys()) != {'meta', 'add'}:
    err('root', f'المفاتيح العليا يجب أن تكون meta وadd فقط: {list(D.keys())}')
META, ADD = D.get('meta', {}), D.get('add', {})
if META.get('needsSheikhReview') is not True:
    err('meta', 'needsSheikhReview يجب أن تكون true')
for sec in ADD:
    if sec not in ALLOWED:
        err(sec, 'قسم غير مستهدف')

existing_ids = set()
for s in C['sections']:
    for it in s.get('items', []): existing_ids.add(it['id'])
    for q in s.get('questions', []): existing_ids.add(q['id'])
new_ids = Counter()

# ---------------------------------------------------------------- مواد التكرار من المنهج
def section_used_words(s):
    used = set()
    for q in s.get('questions', []):
        if q.get('type') == 'extraction':
            for b in re.findall(r'<b>(.*?)</b>', q.get('text', '')):
                for w in plain(b).split(' '):
                    if not is_mark_token(w): used.add(vowel_key(w))
        for fld in ('ayah',):
            for m in re.findall(r'\[\[([^\]|]+)', q.get(fld, '') or ''):
                for w in plain(m).split(' '):
                    if w and not is_mark_token(w) and len(key(w)) > 1: used.add(vowel_key(w))
        if q.get('type') == 'classify':
            for vals in (q.get('items') or {}).values():
                for v in vals:
                    for w in v.split(' '): used.add(vowel_key(w))
    return used

existing_extractions = []   # (sec, qid, ayah key, bold vowel_key, skeleton)
existing_texts = []         # (sec, id, skeleton)
for s in C['sections']:
    for q in s.get('questions', []):
        txt = q.get('text') or ''
        if q.get('type') == 'extraction':
            m = re.search(r'(\d+):(\d+)', q.get('source', ''))
            b = re.search(r'<b>(.*?)</b>', txt)
            existing_extractions.append((s['id'], q['id'], m.group(0) if m else None,
                                         vowel_key(plain(b.group(1)).split(' ')[0]) if b else None, skel_text(txt)))
        for fld in ('text', 'ayah'):
            v = q.get(fld)
            if isinstance(v, str) and ('﴿' in v or fld == 'ayah'):
                existing_texts.append((s['id'], q['id'], skel_text(v)))
    for it in s.get('items', []):
        if it.get('type') == 'quran':
            existing_texts.append((s['id'], it['id'], skel_text(it.get('text', ''))))

# ---------------------------------------------------------------- فحص كل سؤال
REPO_ANN = re.compile(r'[ۖ-ۭـ]')
def repo_clean(t):
    t = re.sub(r'<[^>]+>', '', t); t = re.sub(r'[﴿﴾\[\]]', '', t)
    return unicodedata.normalize('NFC', re.sub(r'\s+', ' ', REPO_ANN.sub('', unicodedata.normalize('NFC', t)))).strip()
def repo_skel(t):
    return (re.sub(r'[ً-ٰٟٕٔ\s]', '', repo_clean(t)).replace('ئ', 'ي').replace('ؤ', 'و')
            .replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا'))

heur = {}
repo_incompat = []
new_seen_ayah, new_seen_bold = {}, {}
per_item_log = []

def mark_heuristic(word_L, i, typ, next_L, kind):
    """«قاعدة العلامات» الآلية مطبقة على النص كما يُعرض: سكون على النون أو تنوين متراكب (عادي) ← إظهار،
    ميم صغيرة ← إقلاب، شدة على أول الكلمة التالية ← إدغام، وإلا ← إخفاء."""
    b, m = word_L[i]
    nxt_shadda = bool(next_L) and SHADDA in next_L[0][1]
    if kind == 'm':
        if nxt_shadda: return 'إدغام مثلين صغير'
        return 'إظهار شفوي' if SUKUN in m else 'إخفاء شفوي'
    if any(c in SMALL_MEEM for c in m): return 'الإقلاب'
    if nxt_shadda: return 'إدغام'
    if SUKUN in m or typ == 'tanween': return 'الإظهار'
    return 'الإخفاء'

for sec, qs in ADD.items():
    if not isinstance(qs, list):
        err(sec, 'add[sec] يجب أن تكون قائمة'); continue
    for n, q in enumerate(qs, 1):
        qid = q.get('id', f'{sec}#{n}')
        new_ids[qid] += 1
        # --- البنية
        if set(q.keys()) != REQ_KEYS:
            err(qid, f'المفاتيح غير مطابقة: ناقص {REQ_KEYS - set(q)} زائد {set(q) - REQ_KEYS}')
        if not re.fullmatch(rf'mx_{SHORT.get(sec, "?")}_\d+', str(qid)):
            err(qid, 'صيغة المعرّف يجب أن تكون mx_<sec>_<n> وموافقة للقسم')
        if qid in existing_ids:
            err(qid, 'المعرّف موجود في المنهج الحالي')
        if q.get('type') != 'extraction' or q.get('textType') != 'quran' or q.get('points') != 10:
            err(qid, 'type/textType/points')
        kind = 'm' if sec == 's7_meem' else 'n'
        if q.get('question') != (QM if kind == 'm' else QN):
            err(qid, 'نص السؤال لا يطابق القالب')
        opts = q.get('options')
        if opts != ALLOWED.get(sec):
            err(qid, f'الخيارات يجب أن تكون بالضبط {ALLOWED.get(sec)} (الأحكام المدروسة حتى هذا الدرس)')
        ans = q.get('answer')
        if not (isinstance(ans, int) and opts and 0 <= ans < len(opts)):
            err(qid, 'answer خارج المدى'); continue
        expl = q.get('explanation', '')
        if not expl or not re.search(r'\((?:بيت|بيتا|أبيات) [0-9–\-]+\)$', expl):
            err(qid, 'التعليل فارغ أو بلا رقم بيت في آخره')
        if re.search(r'\{[^{}|]*\}', expl) or expl.count('{') != expl.count('}'):
            err(qid, 'صيغة تأنيث غير سليمة في التعليل')
        text = q.get('text', '')
        if not (text.startswith('﴿') and text.endswith('﴾')):
            err(qid, 'النص يجب أن يكون بين ﴿ ﴾')
        bolds = re.findall(r'<b>(.*?)</b>', text)
        if len(bolds) != 1 or ' ' in bolds[0].strip():
            err(qid, 'يجب كلمة غامقة واحدة بالضبط'); continue
        src = q.get('source', '')
        ms = re.fullmatch(r'(\S+(?: \S+)?) (\d+):(\d+) \(رسم إملائي، قوبل بنص تنزيل\)', src)  # 9.39.12: لا يُنسب النص المعدَّل إلى تنزيل
        if not ms:
            err(qid, f'صيغة المصدر: {src}'); continue
        s_no, a_no = int(ms.group(2)), int(ms.group(3))
        sname = NAME_ALIASES.get(SURA.get(s_no), SURA.get(s_no))
        if ms.group(1) != sname:
            err(qid, f'اسم السورة «{ms.group(1)}» لا يطابق رقمها ({sname})')
        akey = f'{s_no}:{a_no}'
        if akey not in T:
            err(qid, f'الآية {akey} غير موجودة'); continue

        # --- العرض الإملائي
        words = plain(text).split(' ')
        tgt = [i for i, w in enumerate(re.sub(r'[﴿﴾]', '', text).split(' ')) if '<b>' in w]
        ti = tgt[0]
        if len(words) > 8:
            warn(qid, f'المقطع أطول من 8 كلمات ({len(words)})')
        nfc = unicodedata.normalize('NFC', plain(text))
        bad = [c for c in nfc if c in UTHMANI_SIGNS or c in (DAGGER, WASLA, TATWEEL, MADDAH, HAMZA_ABOVE, HAMZA_BELOW)]
        if bad:
            err(qid, f'علامات عثمانية في النص المعروض: {[hex(ord(c)) for c in bad]}')
        for w in words:
            Lw = parse(unicodedata.normalize('NFC', w).replace('آ', 'ا'))
            if Lw and SHADDA in Lw[0][1]:
                err(qid, f'شدة على أول كلمة «{w}» (تكشف الإدغام)')
        Lt = parse(words[ti])
        st = sites(Lt, kind)
        if len(st) != 1:
            err(qid, f'في الكلمة الغامقة {len(st)} موضع/مواضع للحكم (المطلوب واحد)'); continue
        i_site, typ = st[0]
        bm = Lt[i_site][1]
        if typ in ('nun', 'meem') and SUKUN not in bm:
            err(qid, 'النون/الميم الغامقة بلا سكون عادي')
        if any(c in SMALL_MEEM for c in bm):
            err(qid, 'ميم إقلاب صغيرة في الكلمة الغامقة')
        f_imlai, pos_imlai, _ = following_letter(words, ti, i_site, typ)
        if pos_imlai == 'end':
            err(qid, 'الكلمة الغامقة في آخر المقطع؛ لا يظهر الحرف التالي'); continue

        # --- المطابقة مع نص تنزيل
        atoks = [w for w in T[akey].split(' ')]
        content_idx = [k for k, w in enumerate(atoks) if not is_mark_token(w)]
        akeys = [key(atoks[k]) for k in content_idx]
        fkeys = [key_imlai(w) for w in words]
        starts = [p for p in range(len(akeys) - len(fkeys) + 1) if akeys[p:p + len(fkeys)] == fkeys]
        if not starts:
            err(qid, f'الكلمات ليست متتالية في {akey} بحسب الهيكل الحرفي: {fkeys} ضد {akeys}'); continue
        p0 = starts[0]
        uj = content_idx[p0 + ti]                 # موضع الكلمة الغامقة في نص تنزيل
        Lu = parse(atoks[uj])
        su = sites(Lu, kind)
        if len(su) != 1:
            err(qid, f'الكلمة في نص تنزيل فيها {len(su)} موضع'); continue
        iu, typu = su[0]
        if typu != typ:
            err(qid, f'نوع الموضع مختلف بين العرض ({typ}) ونص تنزيل ({typu})')
        f_uth, pos_uth, notes = following_letter(atoks, uj, iu, typu)
        if pos_uth == 'end':
            err(qid, 'الكلمة الغامقة آخر الآية في نص تنزيل (وقف)'); continue
        for nt in notes:
            err(qid, f'حالة خاصة في نص تنزيل: {nt}')
        if letter_class(f_uth) != letter_class(f_imlai):
            err(qid, f'الحرف التالي مختلف: تنزيل «{f_uth}» والعرض «{f_imlai}»')
        if pos_uth == 'inner' and kind == 'n' and letter_class(f_uth) in (YANMU | LR):
            err(qid, 'نون ساكنة وبعدها حرف إدغام في كلمة واحدة (إظهار مطلق) — مستبعد')
        if pos_uth == 'inner' and any(key(x) in key(atoks[uj]) for x in IDH_MUTLAQ):
            err(qid, 'كلمة من كلمات الإظهار المطلق — مستبعدة')
        rule = meem_rule(f_uth) if kind == 'm' else nun_rule(f_uth)
        if rule is None:
            err(qid, f'لم يُحسب حكم للحرف «{f_uth}»'); continue
        expected_label = rule
        if sec == 's2_idhhar' and rule != 'الإظهار':
            expected_label = ALLOWED['s2_idhhar'][1]
        if expected_label not in ALLOWED[sec]:
            err(qid, f'الحكم المحسوب «{rule}» غير مدروس في هذا الدرس'); continue
        if opts[ans] != expected_label:
            err(qid, f'الجواب المعلَّم «{opts[ans]}» ≠ المحسوب «{expected_label}» (الحرف التالي «{f_uth}»)')
        lname = LETTER_NAME.get(letter_class(f_uth))
        if lname and lname not in expl:
            err(qid, f'التعليل لا يسمّي الحرف التالي ({lname})')

        # --- قاعدة العلامات (للعلم): هل يكفي شكل العلامات في النص المعروض للوصول إلى الجواب؟
        nxtL_imlai = parse(words[ti + 1]) if pos_imlai == 'cross' else None
        h_im = mark_heuristic(Lt, i_site, typ, nxtL_imlai, kind)
        if sec == 's2_idhhar':
            h_ok = (h_im == 'الإظهار') == (rule == 'الإظهار')
        else:
            h_ok = h_im == rule or (h_im == 'إدغام' and 'إدغام' in rule)
        hs = heur.setdefault(sec, [0, 0]); hs[0] += h_ok; hs[1] += 1

        # --- التكرار القريب
        bkey = vowel_key(words[ti])
        if bkey in section_used_words(SECS[sec]):
            err(qid, f'الكلمة الغامقة «{words[ti]}» مستعملة في أسئلة القسم الحالية')
        for (es, eid, eak, ebk, esk) in existing_extractions:
            if eak == akey and ebk == bkey:
                err(qid, f'تكرار: نفس الآية والكلمة في {es}/{eid}')
        fsk = skel_text(text)
        for (es, eid, esk) in existing_texts:
            if not esk: continue
            r = difflib.SequenceMatcher(None, fsk, esk).ratio()
            if r >= 0.85 or (fsk in esk and es == sec and len(fsk) >= 6):
                err(qid, f'تكرار قريب مع {es}/{eid} (تشابه {r:.2f})')
        if akey in new_seen_ayah:
            err(qid, f'الآية {akey} مستعملة أيضًا في {new_seen_ayah[akey]}')
        new_seen_ayah[akey] = qid
        if (sec, bkey) in new_seen_bold:
            err(qid, f'الكلمة الغامقة مكررة في القسم مع {new_seen_bold[(sec, bkey)]}')
        new_seen_bold[(sec, bkey)] = qid

        # --- التوافق مع فاحص المستودع (تحذير فقط)
        if repo_skel(plain(text)) not in repo_skel(T[akey]):
            repo_incompat.append(qid)
        per_item_log.append((qid, akey, words[ti], f_uth, rule, opts[ans]))

for i, c in new_ids.items():
    if c > 1: err(i, 'معرّف مكرر بين الأسئلة الجديدة')

# ---------------------------------------------------------------- 7) النسب
def share(sec):
    ex = [q for q in SECS[sec]['questions'] if q.get('type') == 'extraction']
    b_t = sum(is_title(sec, q['options'][q['answer']]) for q in ex)
    new = ADD.get(sec, [])
    a_t = b_t + sum(is_title(sec, q['options'][q['answer']]) for q in new)
    return {'before': [b_t, len(ex)], 'after': [a_t, len(ex) + len(new)]}

shares = {sec: share(sec) for sec in TITLE}
for sec in ('s3_idgham', 's4_iqlab', 's5_ikhfa'):
    a_t, a_n = shares[sec]['after']
    if a_t * 2 > a_n:
        err(sec, f'نسبة حكم العنوان بعد الإضافة {a_t}/{a_n} > 50%')
if META.get('titleRuleShare') != shares:
    err('meta', f'titleRuleShare في meta لا يطابق الحساب: {shares}')
total = sum(len(v) for v in ADD.values())
if META.get('counts', {}).get('total') != total or \
        META.get('counts', {}).get('perSection') != {k: len(v) for k, v in ADD.items()}:
    err('meta', 'counts في meta لا يطابق عدد الأسئلة')

# ---------------------------------------------------------------- التقرير
def pct(a, n): return f'{a}/{n} = {100 * a / n:.0f}%' if n else '—'
print('الملف:', ITEMS)
print('عدد الأسئلة الجديدة:', total, {k: len(v) for k, v in ADD.items()})
print('\nنسبة كون حكم عنوان الدرس هو الجواب (أسئلة الاستخراج):')
for sec, v in shares.items():
    print(f'  {sec:10s} قبل: {pct(*v["before"]):14s} بعد: {pct(*v["after"])}')
s7 = Counter(q['options'][q['answer']] for q in SECS['s7_meem']['questions'] if q.get('type') == 'extraction')
s7n = Counter(q['options'][q['answer']] for q in ADD.get('s7_meem', []))
print(f'  s7_meem    قبل: {dict(s7)}  الجديدة: {dict(s7n)}')
print('\n«قاعدة العلامات» (سكون/تنوين عادي ← إظهار، ميم صغيرة ← إقلاب، شدة على التالي ← إدغام، وإلا إخفاء)')
print('مطبقة على الأسئلة الجديدة كما تُعرض — عدد ما تصيبه:')
for sec, (ok, n) in heur.items():
    print(f'  {sec:10s} {pct(ok, n)}')
print(f'توافق مع tests/check_questions.py (مطابقة حرفية للهيكل العثماني): '
      f'{total - len(repo_incompat)}/{total}' + (f' — لا يتوافق: {repo_incompat}' if repo_incompat else ''))
print('\nالحكم المحسوب لكل سؤال:')
for qid, akey, w, f, r, a in per_item_log:
    print(f'  {qid:9s} {akey:7s} {w:16s} التالي «{f}» ← {r}  | المعلَّم: {a}')
for w in WARN: print('⚠', w)
for e in ERR: print('✖', e)
print('\n' + ('✖ ' + str(len(ERR)) + ' خطأ' if ERR else '✔ نجح الفحص'))
sys.exit(1 if ERR else 0)
