# -*- coding: utf-8 -*-
"""فاحص بنك الاختبار النهائي المحجوز (exam_bank.json).

التشغيل:
    python3 -I verify_exam_bank.py [BANK] [CURRICULUM] [TANZIL_JSON] [TANZIL_XML]

يفحص:
  1) البنية: 16 قسمًا مطابقة للمنهج، 3/3 للمفاهيم الكبيرة و2/2 لغيرها (80)، الأنواع والحقول، المعرّفات، فهرس الجواب.
  2) صواب/خطأ: 12 على الأكثر، وواحد على الأكثر في كل مجموعة.
  3) كل سؤال استخراج: المصدر، والمطابقة الحرفية مع نص تنزيل (بعد حذف الحركات والعلامات)، والرسم الإملائي
     (لا شدة على الحرف التالي ولا ميم صغيرة ولا علامات عثمانية)، والحكم المحسوب آليًا == الجواب المعلَّم،
     ومقابلة ثانوية مع علامات المصحف في تنزيل لأحكام النون والميم.
  4) أسئلة الاختيار التي فيها عبارات قرآنية أو حروف أو أبيات: تحقق آلي من أن خيارًا واحدًا فقط يحقق المطلوب.
  5) لا تشابه نصي > 0.8 (difflib) مع أي سؤال من أسئلة الدروس، وتوزيع فهرس الجواب الصحيح، وطول الخيارات،
     وطول الجذع (≤ 18 كلمة)، وصيغ التأنيث، وخيارات الأحكام مقصورة على ما دُرّس حتى القسم.
يخرج بالرمز 0 إن نجحت كل الفحوص، و1 إن وُجد خطأ.
"""
import sys, re, json, difflib, unicodedata
from collections import Counter, defaultdict

BANK = sys.argv[1] if len(sys.argv) > 1 else 'curriculum/drafts/exam_bank_9.39.11.json'
CURR = sys.argv[2] if len(sys.argv) > 2 else 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'
TANZ = sys.argv[3] if len(sys.argv) > 3 else 'curriculum/نص_القرآن_تنزيل_العثماني.json'
TXML = sys.argv[4] if len(sys.argv) > 4 else 'curriculum/quran-uthmani.xml'

D = json.load(open(BANK, encoding='utf8'))
C = json.load(open(CURR, encoding='utf8'))
T = json.load(open(TANZ, encoding='utf8'))
SURA = {int(a): b for a, b in re.findall(r'<sura index="(\d+)" name="([^"]*)"', open(TXML, encoding='utf8').read())}

ERR, WARN, INFO = [], [], []
def err(i, m): ERR.append(f'{i}: {m}')
def warn(i, m): WARN.append(f'{i}: {m}')

# ------------------------------------------------------------------ Arabic helpers
FATHA, DAMMA, KASRA, SUKUN, SHADDA = 'َ', 'ُ', 'ِ', 'ْ', 'ّ'
TANWEEN = set('ًٌٍ')
HARAKA = {FATHA, DAMMA, KASRA} | TANWEEN
HAMZA = set('ءأإؤئ')
HALQ = set('ءهعحغخ')
YANMU = set('ينمو')
LR = set('لر')
IKHFA = set('صذثكجشقسدطزفتضظ')
QAMARI = set('ابغحجكوخفعقيمه')         # ابغ حجك وخف عقيمه
SHAMSI = set('طثصرتضذندسظزشل')         # طب ثم صل رحما تفز ضف ذا نعم دع سوء ظن زر شريفا للكرم
LAZIM_HARF = set('كمعسلنقص')          # كم عسل نقص
TABII_HARF = set('حيطهر')             # حي طاهر
UTHMANI_ONLY = re.compile('[ٰٱۖ-ۭـٕٓٔ]')
LETTER_NAMES = {'الهمزة': 'ء', 'الهاء': 'ه', 'العين': 'ع', 'الحاء': 'ح', 'الغين': 'غ', 'الخاء': 'خ', 'القاف': 'ق',
                'الكاف': 'ك', 'الراء': 'ر', 'الباء': 'ب', 'الميم': 'م', 'النون': 'ن', 'اللام': 'ل', 'الصاد': 'ص',
                'السين': 'س', 'الشين': 'ش', 'الياء': 'ي', 'الواو': 'و', 'الفاء': 'ف', 'التاء': 'ت', 'الطاء': 'ط',
                'الدال': 'د', 'الذال': 'ذ', 'الثاء': 'ث', 'الجيم': 'ج', 'الزاي': 'ز', 'الضاد': 'ض', 'الظاء': 'ظ'}
SYMBOL_LETTER = {'ء': 'ء', 'هـ': 'ه', 'ع': 'ع', 'ح': 'ح', 'غ': 'غ', 'خ': 'خ', 'ق': 'ق', 'ك': 'ك', 'ب': 'ب', 'ص': 'ص',
                 'ذ': 'ذ', 'ث': 'ث', 'ل': 'ل'}

def is_letter(ch): return 'ء' <= ch <= 'ي' or ch == 'ٱ'
def norm_hamza(ch): return 'ء' if ch in HAMZA else ch

def parse(word):
    """حروف كلمة مضبوطة إملائيًا: [[حرف, علامات]]. «آ» = همزة مفتوحة + ألف."""
    out = []
    for ch in unicodedata.normalize('NFC', word):
        if ch == 'آ':
            out.append(['ء', FATHA]); out.append(['ا', ''])
        elif is_letter(ch):
            out.append([ch, ''])
        elif out and 'ً' <= ch <= 'ْ':
            out[-1][1] += ch
    return out

def plain(t):
    t = re.sub(r'<[^>]+>', '', t)
    return re.sub(r'\s+', ' ', re.sub(r'[﴿﴾«»()\[\]:؛،,.!?؟]', ' ', t)).strip()

def skel(t):
    """هيكل الحروف للمقارنة بين الإملائي والعثماني."""
    t = re.sub(r'<[^>]+>', '', t)
    t = t.replace('آ', 'ءا').replace('ٓ', '')
    t = unicodedata.normalize('NFC', t)
    t = re.sub(r'ى[ً-ٟ]*ٰ(?=[ء-ي])', 'ا', t)
    t = re.sub(r'[﴿﴾«»()\[\]:.،؛]', ' ', t)
    t = t.replace('آ', 'ءا').replace('ٔ', 'ء').replace('ٕ', 'ء')
    t = re.sub('[ؐ-ًؚ-ٰٟۖ-ۭـ]', '', t)
    t = t.translate(str.maketrans({'أ': 'ء', 'إ': 'ء', 'ؤ': 'ء', 'ئ': 'ء', 'ٱ': 'ا', 'ى': 'ي'}))
    t = t.replace('ا', '')
    return re.sub(r'\s+', ' ', t).strip()

def ayah_words(key):
    return [w for w in T.get(key, '').split() if any(is_letter(c) for c in w)]

def locate(phrase, key):
    """موضع العبارة (بالكلمات) في الآية، أو None."""
    pw = [skel(w) for w in plain(phrase).split()]
    aw = [skel(w) for w in ayah_words(key)]
    for k in range(len(aw) - len(pw) + 1):
        if aw[k:k + len(pw)] == pw:
            return k
    return None

def gt_m(t): return re.sub(r'\{([^{}|]*)\|([^{}]*)\}', lambda m: m.group(1), t)
def strip_cmp(t):
    t = gt_m(re.sub(r'<[^>]+>', ' ', t or ''))
    t = t.replace('(مكتوبة بالرسم الإملائي)', ' ').replace('(مكتوبة بلا تشكيل)', ' ')
    t = re.sub('[ً-ٰٟۖ-ۭـ]', '', t)
    t = t.translate(str.maketrans({'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه'}))
    t = re.sub(r'[﴿﴾«»()\[\]:؛،,.!?؟\-–{}|]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()

# ------------------------------------------------------------------ rule engines (imla'i text)
def nun_rule_from(letter, same_word):
    l = norm_hamza(letter)
    if l in HALQ: return 'الإظهار'
    if l in YANMU: return 'الإظهار' if same_word else 'الإدغام بغنة'   # دنيا/صنوان/قنوان/بنيان: لا إدغام
    if l in LR: return 'الإدغام بلا غنة'
    if l == 'ب': return 'الإقلاب'
    if l in IKHFA: return 'الإخفاء'
    return None

def meem_rule_from(letter):
    if letter == 'ب': return 'إخفاء شفوي'
    if letter == 'م': return 'إدغام'
    return 'إظهار شفوي'

def occurrences(words, idxs, kind):
    """مواضع النون الساكنة/التنوين (kind='nun') أو الميم الساكنة (kind='meem') في الكلمات المحددة."""
    occ = []
    for wi in idxs:
        L = parse(words[wi])
        for li, (b, m) in enumerate(L):
            if kind == 'nun' and ((b == 'ن' and SUKUN in m) or (set(m) & TANWEEN)):
                occ.append((wi, li))
            if kind == 'meem' and b == 'م' and SUKUN in m:
                occ.append((wi, li))
    return occ

def following(words, wi, li):
    """(الحرف التالي وعلاماته، هل هو في الكلمة نفسها، رقم كلمته)"""
    L = parse(words[wi])
    j = li + 1
    if set(L[li][1]) & TANWEEN:            # ألف/ألف مقصورة بعد تنوين النصب لا تُنطق
        while j < len(L) and L[j][0] in 'اى' and not L[j][1]:
            j += 1
    if j < len(L):
        return L[j][0], L[j][1], True, wi
    if wi + 1 < len(words):
        N = parse(words[wi + 1])
        return N[0][0], N[0][1], False, wi + 1
    return None, None, None, None

def madd_types(word, nxt, waqf):
    """أنواع المد في كلمة إملائية مضبوطة، بحسب الوصل أو الوقف."""
    L = parse(word); n = len(L); types = set(); count = 0
    iwad_carrier = n >= 2 and L[-1][0] in 'اى' and not L[-1][1] and bool(set(L[-2][1]) & {'ً'})
    eff_last = n - 2 if iwad_carrier else n - 1
    NX = parse(nxt) if nxt else None
    for i, (b, m) in enumerate(L):
        pb, pm = (L[i - 1] if i > 0 else (None, ''))
        madd = lin = False
        if b == 'ا' and not m:
            if i == 0 or (iwad_carrier and i == n - 1): continue
            if pb == 'و' and not pm: continue                                  # ألف بعد واو الجماعة
            if i <= 1 and i + 1 < n and L[i + 1][0] == 'ل' and (L[i + 1][1] in ('', SUKUN)): continue  # «ال»
            madd = FATHA in pm
        elif b == 'و' and not m and DAMMA in pm: madd = True
        elif b in 'يى' and not m and KASRA in pm: madd = True
        elif b in 'وي' and m == SUKUN and FATHA in pm: lin = True
        if madd:
            count += 1
            if i + 1 <= eff_last:
                nb, nm = L[i + 1]
                if nb in HAMZA: types.add('متصل')
                elif SHADDA in nm: types.add('لازم كلمي مثقل')
                elif SUKUN in nm: types.add('لازم كلمي مخفف')
                elif waqf and i + 1 == eff_last and not iwad_carrier: types.add('عارض للسكون')
                elif pb in HAMZA: types.add('بدل')
                else: types.add('طبيعي')
            else:
                if waqf or not NX: types.add('بدل' if pb in HAMZA else 'طبيعي')
                elif NX[0][0] in HAMZA: types.add('منفصل')
                elif NX[0][0] == 'ا' and not NX[0][1]: pass                      # يسقط في الوصل
                else: types.add('بدل' if pb in HAMZA else 'طبيعي')
        if lin and waqf and i + 1 == eff_last and not iwad_carrier:
            types.add('لين')
    if waqf and iwad_carrier and L[-2][0] != 'ة':
        types.add('عوض')
    if (not waqf and NX and n >= 2 and L[-1][0] == 'ه' and (DAMMA in L[-1][1] or KASRA in L[-1][1])
            and (set(L[-2][1]) & HARAKA) and (set(NX[0][1]) & HARAKA)):
        types.add('صلة كبرى' if NX[0][0] in HAMZA else 'صلة صغرى')
    return types, count

def canon_madd(opt):
    o = opt.strip()
    return o[3:] if o.startswith('مد ') else o

# حروف فواتح السور: الاسم ومقدار المد (0 = لا مد، 2 = طبيعي، 6 = لازم)
def fawatih_amounts(f):
    out = []
    for ch in f:
        if ch == 'ا': out.append(0)
        elif ch in TABII_HARF: out.append(2)
        elif ch in LAZIM_HARF: out.append(6)
        else: out.append(None)
    return out

# ------------------------------------------------------------------ curriculum material
SECS = C['sections']
SEC_IDS = [s['id'] for s in SECS]
BIG = {'s1_intro', 's3_idgham', 's5_ikhfa', 's9_madd1', 's10_madd2', 's11_madd3', 's12_lazim', 's12b_fawatih'}

def poem_verses(sid):
    s = next(x for x in SECS if x['id'] == sid)
    vs = []
    for it in s['items']:
        if it['type'] == 'poem':
            for line in it['text'].split('<br>'):
                h = [x.strip() for x in re.split(r'\s{2,}', line.strip()) if x.strip()]
                if len(h) == 2: vs.append(h)
    return vs
def eqv(a, b): return strip_cmp(a) == strip_cmp(b)

LESSON = []   # (id, stem, stem+options)
for s in SECS:
    for q in s['questions']:
        stem = ' '.join(x for x in [q.get('text', ''), q.get('question', '')] if x)
        extra = []
        if q.get('options'): extra += q['options']
        if q.get('pairs'): extra += [' '.join(p) for p in q['pairs']]
        if q.get('pieces'): extra += q['pieces']
        if q.get('sentence'): extra.append(q['sentence'].replace('{{', '').replace('}}', ''))
        if q.get('ayah'): extra.append(re.sub(r'\[\[([^|\]]*)(\|[^\]]*)?\]\]', r'\1', q['ayah']))
        if isinstance(q.get('items'), dict):
            extra += [w for v in q['items'].values() for w in v]
        LESSON.append((q['id'], strip_cmp(stem), strip_cmp(stem + ' ' + ' '.join(extra))))
        if q.get('pairs'):
            for p in q['pairs']: LESSON.append((q['id'] + '#pair', strip_cmp(' '.join(p)), strip_cmp(' '.join(p))))
LESSON_IDS = {q['id'] for s in SECS for q in s['questions']}
LESSON_AYAT = {}      # آيات الدروس (أسئلة ومهام)
LESSON_QSTR = []      # نصوص الاستخراج القرآنية في الدروس (للمقارنة النصية)
LESSON_QTEXT = []     # هياكل كلمات كل نص قرآني يراه الطفل في الدروس
for s in SECS:
    for q in s['questions']:
        for m in re.finditer(r'(\d+):(\d+)', q.get('source', '')): LESSON_AYAT.setdefault(f'{m.group(1)}:{m.group(2)}', q['id'])
        qt = q.get('text', '')
        if q.get('type') == 'extraction' or q.get('textType') == 'quran' or '﴿' in qt:
            LESSON_QSTR.append((q['id'], strip_cmp(qt)))
            LESSON_QTEXT.append((q['id'], [skel(w) for w in plain(qt).split()]))
        if q.get('ayah'):
            LESSON_QTEXT.append((q['id'], [skel(w) for w in plain(re.sub(r'\[\[([^|\]]*)(\|[^\]]*)?\]\]', r'\1', q['ayah'])).split()]))
        if isinstance(q.get('items'), dict):
            for v in q['items'].values():
                for w in v: LESSON_QTEXT.append((q['id'], [skel(x) for x in plain(w).split()]))
    for it in s['items']:
        for m in re.finditer(r'(\d+):(\d+)(?:-(\d+))?', it.get('desc', '')):
            for a in range(int(m.group(2)), int(m.group(3) or m.group(2)) + 1): LESSON_AYAT.setdefault(f'{m.group(1)}:{a}', it['id'])
        if it.get('type') == 'quran':
            LESSON_QTEXT.append((it['id'], [skel(w) for w in plain(it['text']).split()]))

# ------------------------------------------------------------------ taught-so-far labels for rule options
NUN_LABELS = ['الإظهار', 'الإدغام بغنة', 'الإدغام بلا غنة', 'الإقلاب', 'الإخفاء']
TAUGHT = {
 's2_idhhar': ['الإظهار'], 's3_idgham': NUN_LABELS[:3], 's4_iqlab': NUN_LABELS[:4], 's5_ikhfa': NUN_LABELS,
 's7_meem': NUN_LABELS + ['إخفاء شفوي', 'إدغام', 'إظهار شفوي', 'إقلاب'],
 's8b_mithl': ['مثلان صغير', 'مثلان كبير', 'متجانسان صغير', 'متجانسان كبير', 'متقاربان صغير', 'متقاربان كبير'],
 's9_madd1': ['طبيعي', 'بدل', 'عوض'],
}
TAUGHT['s10_madd2'] = TAUGHT['s9_madd1'] + ['متصل', 'منفصل']
TAUGHT['s11_madd3'] = TAUGHT['s10_madd2'] + ['عارض للسكون', 'لين', 'صلة صغرى', 'صلة كبرى']
TAUGHT['s12_lazim'] = TAUGHT['s11_madd3'] + ['لازم كلمي مثقل', 'لازم كلمي مخفف', 'لازم حرفي مثقل', 'لازم حرفي مخفف']
ALL_LABELS = {x for v in TAUGHT.values() for x in v}   # مصطلحات الأحكام الثابتة (طولها جزء من المصطلح)

# ------------------------------------------------------------------ semantic checks for non-extraction items
# العبارات القرآنية في الخيارات: النص الإملائي ← موضعه في تنزيل
REFS = {
 'مَنْ خَافَ': '79:40', 'مَنْ طَغَى': '79:37', 'لِمَنْ يَخْشَى': '79:26', 'عَنْ رَبِّهِمْ': '83:15',
 'شَيْءٍ خَلَقَهُ': '80:18', 'نَارًا تَلَظَّى': '92:14', 'قَرِيبًا يَوْمَ': '78:40', 'وَيْلٌ لِلْمُطَفِّفِينَ': '83:1',
 'قِنْوَانٌ دَانِيَةٌ': '6:99', 'مَنْ يَقُولُ آمَنَّا': '2:8', 'فَمَا لَهُ مِنْ نُورٍ': '24:40', 'مِنْ مَاءٍ مَهِينٍ': '77:20',
 'بُنْيَانٌ': '61:4',
 'مِنْ بَعْدِ': '98:4', 'مِنْ شَيْءٍ': '6:38', 'عَذَابٌ أَلِيمٌ': '2:10',
 'وَقُلْ لَهُمْ': '4:63', 'قُلْ هُوَ اللَّهُ': '112:1', 'قُلْنَا': '2:34', 'الْتَقَى': '8:41', 'وَقُلْ جَاءَ': '17:81',
 'قُلْ رَبِّي': '18:22', 'يَجْعَلْ لَهُ': '65:2', 'وَقُلْ لِعِبَادِي': '17:53',
 'دَابَّةٍ': '11:6', 'الْعَالَمِينَ': '1:2', 'يَشَاءُ': '2:105', 'آدَمَ': '2:31',
 'الْحَاقَّةُ': '69:1', 'تَشَاءُونَ': '81:29', 'قُلُوبُهُمْ': '8:2', 'آذَانِهِمْ': '2:19', 'تَعْلَمُونَ': '2:22',
 'عَمَّ': '78:1', 'يس': '36:1', 'حم': '40:1', 'طه': '20:1', 'طس': '27:1', 'ق': '50:1', 'الر': '15:1', 'ص': '38:1',
 'طسم': '26:1', 'المر': '13:1', 'الم': '29:1',
}
def quoted(t): return re.findall(r'«([^«»]+)»', t)

def nun_rule_phrase(ph):
    w = plain(ph).split(); occ = occurrences(w, range(len(w)), 'nun')
    res = []
    for wi, li in occ:
        l, m, same, _ = following(w, wi, li)
        if l: res.append(nun_rule_from(l, same))
    return res

def lam_fiil_rule(ph):
    w = plain(ph).split()
    for wi in range(len(w)):
        L = parse(w[wi])
        for li, (b, m) in enumerate(L):
            if b == 'ل' and SUKUN in m:
                if li + 1 < len(L): nb = L[li + 1][0]
                elif wi + 1 < len(w): nb = parse(w[wi + 1])[0][0]
                else: return None
                return 'إدغام' if nb in LR else 'إظهار'
    return None

def lam_type(word):
    w = plain(word)
    if not w.startswith('ال') or len(w) < 3: return None
    return 'قمرية' if w[2] in QAMARI else 'شمسية' if w[2] in SHAMSI else None

def one_correct(q, pred, label):
    hits = [i for i, o in enumerate(q['options']) if pred(o)]
    if hits != [q['answer']]:
        err(q['id'], f'{label}: الخيارات المحققة {hits} والجواب المعلَّم {q["answer"]}')
        return False
    return True

def amounts_from_option(o):
    if o.startswith('كلاهما'):
        a = 2 if 'حركتان' in o else 6 if 'ست' in o else None
        return [a, a]
    return [2 if x == 'حركتان' else 6 for x in re.findall(r'(حركتان|ست)', o)]

def chk_matn(q, sid, mode, given):
    vs = poem_verses(sid); opts = q['options']; ans = opts[q['answer']]
    for o in opts:
        if not any(eqv(o, h) for v in vs for h in v):
            # خيارات من قسم آخر (للتمويه) يجب أن تكون أنصاف أبيات حقيقية أيضًا
            allv = [h for s2 in SEC_IDS for v in poem_verses(s2) for h in v]
            if not any(eqv(o, h) for h in allv): err(q['id'], f'خيار ليس شطرًا من المتن: {o}')
    for k, (h1, h2) in enumerate(vs):
        if mode == 'second_of' and eqv(h1, given):
            return eqv(ans, h2) or err(q['id'], 'الشطر الثاني لا يطابق المتن')
        if mode == 'first_of' and eqv(h2, given):
            return eqv(ans, h1) or err(q['id'], 'الشطر الأول لا يطابق المتن')
        if mode == 'next_first' and eqv(h1, given):
            return (k + 1 < len(vs) and eqv(ans, vs[k + 1][0])) or err(q['id'], 'البيت التالي لا يطابق ترتيب المتن')
    err(q['id'], f'لم يوجد البيت المذكور في المتن: {given}')

def desc_has(sid, *words):
    s = next(x for x in SECS if x['id'] == sid)
    txt = strip_cmp(' '.join(it.get('desc', '') + ' ' + it.get('text', '') for it in s['items']))
    return all(strip_cmp(w) in txt for w in words)

SEM = {}   # id -> function(q) ; تُستدعى بعد فحص البنية
def sem(i):
    def deco(f): SEM[i] = f; return f
    return deco

sem('x_s0_A1')(lambda q: chk_matn(q, 's0_muqaddima', 'second_of', 'الْحَمْدُ لِلَّهِ مُصَلِّيًا عَلَى'))
sem('x_s0_B1')(lambda q: chk_matn(q, 's0_muqaddima', 'first_of', 'فِي النُّونِ وَالتَّنْوِينِ وَالْمُدُودِ'))
sem('x_s0_A2')(lambda q: chk_matn(q, 's0_muqaddima', 'next_first', 'سَمَّيْتُهُ بِتُحْفَةِ الْأَطْفَالِ'))
sem('x_s0_B2')(lambda q: chk_matn(q, 's0_muqaddima', 'next_first', 'يَقُولُ رَاجِي رَحْمَةِ الْغَفُورِ'))
sem('x_s13_A2')(lambda q: chk_matn(q, 's13_khatima', 'next_first', 'أَبْيَاتُهُ نَدٌّ بَدَا لِذِي النُّهَى'))
sem('x_s13_B2')(lambda q: chk_matn(q, 's13_khatima', 'next_first', 'وَتَمَّ ذَا النَّظْمُ بِحَمْدِ اللهِ'))
@sem('x_s13_A1')
def _(q):
    ABJAD = {'ن': 50, 'د': 4}
    v = sum(ABJAD[c] for c in 'ند')
    one_correct(q, lambda o: o.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩', '0123456789')) == str(v), 'حساب الجمّل')
sem('x_s13_B1')(lambda q: desc_has('s13_khatima', 'سبعة أبيات', 'أُلحقت') or err(q['id'], 'شرح الخاتمة لا يذكر الأبيات الملحقة'))

sem('x_s1_A1')(lambda q: one_correct(q, lambda o: any(set(m) & TANWEEN for _, m in parse(o)), 'كلمة فيها تنوين'))
sem('x_s1_B1')(lambda q: one_correct(q, lambda o: any(b == 'ن' and SUKUN in m for b, m in parse(o)), 'كلمة فيها نون ساكنة'))
def determining(q):
    ph = quoted(q['text'])[0]; w = plain(ph).split()
    occ = occurrences(w, [0], 'nun')
    if len(occ) != 1: return err(q['id'], 'العبارة يجب أن تحوي نونًا ساكنة/تنوينًا واحدًا في كلمتها الأولى')
    l, _, _, _ = following(w, *occ[0])
    one_correct(q, lambda o: LETTER_NAMES.get(o) == norm_hamza(l), 'الحرف المحدِّد للحكم')
sem('x_s1_A2')(determining); sem('x_s1_B2')(determining)
FOUR = {'الإظهار', 'الإدغام', 'الإقلاب', 'الإخفاء'}
sem('x_s1_A3')(lambda q: one_correct(q, lambda o: o not in FOUR, 'ليس من الأحكام الأربعة'))
sem('x_s1_B3')(lambda q: one_correct(q, lambda o: o in FOUR, 'من الأحكام الأربعة'))

sem('x_s2_A1')(lambda q: one_correct(q, lambda o: nun_rule_phrase(o) == ['الإظهار'], 'موضع إظهار'))
sem('x_s2_B1')(lambda q: one_correct(q, lambda o: nun_rule_phrase(o) == ['الإظهار'], 'موضع إظهار'))
sem('x_s2_A2')(lambda q: one_correct(q, lambda o: LETTER_NAMES[o] not in HALQ, 'ليس حلقيًّا'))
sem('x_s2_B2')(lambda q: one_correct(q, lambda o: all(SYMBOL_LETTER[x.strip()] in HALQ for x in o.split('،')), 'كلها حلقية'))
sem('x_s3_A3')(lambda q: one_correct(q, lambda o: not any(r and r.startswith('الإدغام') for r in nun_rule_phrase(o))
                                     and any(b == 'ن' and SUKUN in m for b, m in parse(o)), 'لا إدغام مع حرف ينمو'))
@sem('x_s3_B3')
def _(q):
    w = 'بُنْيَانٌ'; occ = occurrences([w], [0], 'nun')
    l, _, same, _ = following([w], *occ[0])
    if not (same and l in YANMU): err(q['id'], 'المثال ليس نونًا ساكنة وحرف ينمو في كلمة واحدة')
@sem('x_s4_B2')
def _(q):
    if nun_rule_phrase(quoted(q['text'])[0]) != ['الإقلاب']: err(q['id'], 'المثال ليس إقلابًا')
sem('x_s4_A2')(lambda q: desc_has('s4_iqlab', 'دون أن نضغط') or err(q['id'], 'وصف الشفتين غير موجود في شرح الدرس'))
sem('x_s5_A3')(lambda q: one_correct(q, lambda o: LETTER_NAMES[o] in IKHFA, 'حرف إخفاء'))
sem('x_s5_B3')(lambda q: one_correct(q, lambda o: all(SYMBOL_LETTER[x.strip()] in IKHFA for x in o.split('،')), 'كلها حروف إخفاء'))
MUSH = lambda o: any(b in 'نم' and SHADDA in m for b, m in parse(o))
sem('x_s6_A1')(lambda q: one_correct(q, MUSH, 'نون أو ميم مشددة'))
sem('x_s6_B1')(lambda q: one_correct(q, MUSH, 'نون أو ميم مشددة'))
sem('x_s6_A2')(lambda q: (desc_has('s6_ghunna', 'وصلًا ووقفًا') and q['answer'] is False) or err(q['id'], 'وصلًا ووقفًا'))
sem('x_s6_B2')(lambda q: desc_has('s6_ghunna', 'وصلًا ووقفًا') or err(q['id'], 'وصلًا ووقفًا'))
def lam_opts(q, want):
    for o in q['options']:
        if re.search('[ً-ْ]', o): err(q['id'], f'الخيار «{o}» يجب أن يكون بلا تشكيل')
    one_correct(q, lambda o: lam_type(o) == want, f'لام {want}')
sem('x_s8_A1')(lambda q: lam_opts(q, 'شمسية'))
sem('x_s8_B1')(lambda q: lam_opts(q, 'قمرية'))
sem('x_s8_A2')(lambda q: one_correct(q, lambda o: lam_fiil_rule(o) == 'إدغام', 'لام فعل مدغمة'))
sem('x_s8_B2')(lambda q: one_correct(q, lambda o: lam_fiil_rule(o) == 'إظهار', 'لام فعل مظهرة'))
sem('x_s8b_A2')(lambda q: desc_has('s8b_mithl', 'متقاربان', 'صغيرًا') or err(q['id'], 'المصطلح غير موجود في الشرح'))
sem('x_s8b_B2')(lambda q: (desc_has('s8b_mithl', 'متجانسان', 'كبيرًا') and q['answer'] is True) or err(q['id'], 'تعريف المتجانسين'))
sem('x_s9_A3')(lambda q: one_correct(q, lambda o: sorted(b for b, _ in parse(o)) == sorted('واي'), 'كلمة حروفها حروف المد الثلاثة'))
@sem('x_s9_B3')
def _(q):
    _, cnt = madd_types('نُوحِيهَا', None, False)
    one_correct(q, lambda o: {'واحد': 1, 'اثنان': 2, 'ثلاثة': 3}.get(o) == cnt, 'عدد حروف المد')
sem('x_s10_A3')(lambda q: (desc_has('s10_madd2', 'وَجَائِزٌ', 'الْمُنْفَصِلْ') and q['answer'] is True) or err(q['id'], 'حكم المنفصل'))
sem('x_s10_B3')(lambda q: (desc_has('s10_madd2', 'فَوَاجِبٌ') and q['options'][q['answer']] == 'واجب') or err(q['id'], 'حكم المتصل'))
def has_lazim(o):
    t, _ = madd_types(plain(o), None, False); return any(x.startswith('لازم') for x in t)
sem('x_s12_A2')(lambda q: one_correct(q, has_lazim, 'كلمة فيها مد لازم'))
sem('x_s12_B2')(lambda q: one_correct(q, has_lazim, 'كلمة فيها مد لازم'))
@sem('x_s12_A3')
def _(q):
    t, _ = madd_types('تَعْلَمُونَ', None, True)
    truth = any(x.startswith('لازم') for x in t)
    if truth != q['answer'] or 'عارض للسكون' not in t: err(q['id'], f'الوقف على «تعلمون» يعطي {t}')
sem('x_s12_B3')(lambda q: desc_has('s12_lazim', 'سكونًا أصليًّا', 'وصلًا ووقفًا') or err(q['id'], 'تعريف اللازم'))
def fpair(q):
    f = quoted(q['text'])[0]; a = fawatih_amounts(f)
    one_correct(q, lambda o: amounts_from_option(o) == a, f'مقادير «{f}»')
sem('x_s12b_A1')(fpair); sem('x_s12b_B1')(fpair)
sem('x_s12b_A2')(lambda q: one_correct(q, lambda o: all(x == 2 for x in fawatih_amounts(o)), 'كل حروفها حركتان'))
sem('x_s12b_B2')(lambda q: one_correct(q, lambda o: fawatih_amounts(o).count(6) == 2, 'فيها حرفان مدهما ست'))
sem('x_s12b_A3')(lambda q: one_correct(q, lambda o: LETTER_NAMES[o] not in LAZIM_HARF, 'ليس من كم عسل نقص'))
sem('x_s12b_B3')(lambda q: (('ه' in TABII_HARF) == q['answer']) or err(q['id'], 'مقدار الهاء'))

# ------------------------------------------------------------------ 1) structure
bank = D.get('bank', {}); meta = D.get('meta', {})
if meta.get('needsSheikhReview') is not True: err('meta', 'needsSheikhReview يجب أن تكون true')
if set(bank) != set(SEC_IDS): err('bank', f'الأقسام لا تطابق المنهج: ناقص {set(SEC_IDS) - set(bank)} زائد {set(bank) - set(SEC_IDS)}')
KEYS = {'multiple_choice': {'id', 'set', 'type', 'text', 'options', 'answer', 'explanation', 'points'},
        'true_false': {'id', 'set', 'type', 'text', 'answer', 'explanation', 'points'},
        'extraction': {'id', 'set', 'type', 'text', 'textType', 'question', 'options', 'answer', 'explanation', 'points', 'source'}}
ids = Counter(); ALL = []; per_set = {}
for sid in SEC_IDS:
    short = sid.split('_')[0]
    lst = bank.get(sid, [])
    if not isinstance(lst, list): err(sid, 'bank[section] يجب أن يكون قائمة أسئلة لكل منها set = A أو B'); lst = []
    for q in lst:
        if q.get('set') not in ('A', 'B'): err(q.get('id', sid), f'set غير صالح: {q.get("set")}')
    for form in 'AB':
        qs = [q for q in lst if q.get('set') == form]
        want = 3 if sid in BIG else 2
        per_set[(sid, form)] = qs
        if len(qs) != want: err(f'{sid}/{form}', f'عدد الأسئلة {len(qs)} والمطلوب {want}')
        tfs = sum(q.get('type') == 'true_false' for q in qs)
        if tfs > 1: err(f'{sid}/{form}', f'{tfs} أسئلة صواب/خطأ في المجموعة نفسها')
        for n, q in enumerate(qs, 1):
            i = q.get('id', '?'); ids[i] += 1; ALL.append((sid, form, q))
            if i != f'x_{short}_{form}{n}': err(i, f'المعرّف المتوقع x_{short}_{form}{n}')
            if i in LESSON_IDS: err(i, 'المعرّف مستعمل في أسئلة الدروس')
            t = q.get('type')
            if t not in KEYS: err(i, f'نوع غير مسموح: {t}'); continue
            if set(q) != KEYS[t]: err(i, f'الحقول {sorted(set(q) ^ KEYS[t])} زائدة أو ناقصة')
            if q.get('points') != 10: err(i, 'points يجب أن تكون 10')
            if t == 'true_false':
                if not isinstance(q.get('answer'), bool): err(i, 'جواب صواب/خطأ يجب أن يكون true/false')
            else:
                o = q.get('options', [])
                if not (isinstance(o, list) and 3 <= len(o) <= 4 and all(isinstance(x, str) and x.strip() for x in o)):
                    err(i, 'الخيارات يجب أن تكون 3–4 نصوص')
                if len(set(o)) != len(o): err(i, 'خيارات مكررة')
                a = q.get('answer')
                if not (isinstance(a, int) and not isinstance(a, bool) and 0 <= a < len(o)): err(i, f'فهرس الجواب خارج المدى: {a}')
            if t == 'extraction' and q.get('textType') != 'quran': err(i, 'textType يجب أن يكون quran')
for i, c in ids.items():
    if c > 1: err(i, f'معرّف مكرر {c} مرات')
total = len(ALL)
if total != 80: err('bank', f'المجموع {total} والمطلوب 80')
n_tf = sum(q['type'] == 'true_false' for _, _, q in ALL)
if n_tf > 12: err('bank', f'{n_tf} سؤال صواب/خطأ (الحد 12)')

# ------------------------------------------------------------------ 2) text hygiene
GTRE = re.compile(r'\{([^{}|]*)\|([^{}]*)\}')
for sid, form, q in ALL:
    i = q['id']
    blob = json.dumps(q, ensure_ascii=False)
    if 'ﷺ' in blob or 'صلى الله عليه وسلم' in blob: err(i, 'ﷺ غير مسموح')
    for f in ('text', 'question', 'explanation'):
        v = q.get(f, '')
        if v.count('{') != v.count('}') or any('|' in m.group(2) for m in GTRE.finditer(v)): err(i, f'صيغة تأنيث غير صحيحة في {f}')
    for o in q.get('options', []):
        if '{' in o or '|' in o: err(i, 'صيغ التأنيث لا تُعرض في الخيارات (لا تمر على GT)')
        if re.search(r'(موسى|عيسى|نوح|إبراهيم|أحمد)', o) and 'عليه السلام' not in o: err(i, 'اسم نبي بلا «عليه السلام»')
    if q['type'] == 'extraction' and '{' in q['text']: err(i, 'نص الاستخراج لا يمر على GT')
    stem = q['question'] if q['type'] == 'extraction' else q['text']
    nw = len(plain(gt_m(stem)).split())
    if nw > 18: err(i, f'الجذع {nw} كلمة (الحد 18)')
    ex = q.get('explanation', '')
    sents = [s for s in re.split(r'[.!؟?]\s*', re.sub(r'\(بيت[^)]*\)', '', ex)) if s.strip()]
    if not 1 <= len(sents) <= 2: err(i, f'الشرح {len(sents)} جمل (المطلوب 1–2)')
    if q['type'] != 'true_false':
        ans = q['options'][q['answer']]
        if len(strip_cmp(ans)) >= 3 and strip_cmp(ans) in strip_cmp(stem + ' ' + (q['text'] if q['type'] == 'extraction' else '')):
            err(i, 'نص الجواب الصحيح ظاهر في السؤال')
        L = [len(strip_cmp(x)) for x in q['options']]; c = L[q['answer']]; oth = [x for k, x in enumerate(L) if k != q['answer']]
        labels_only = all(canon_madd(o) in ALL_LABELS or o in ALL_LABELS for o in q['options'])
        if not labels_only and max(L) > 6 and ((c > max(oth) and c >= 1.3 * max(oth)) or (c < min(oth) and c <= 0.6 * min(oth))):
            err(i, f'طول الجواب الصحيح يميّزه ({c} مقابل {oth})')

# ------------------------------------------------------------------ 3) extraction items vs Tanzil + computed rules
SRC = re.compile(r'^(.+) (\d+):(\d+) \(نص تنزيل(?:، بالرسم الإملائي)?\)$')
def nz(s): return re.sub('[أإآا]', 'ا', s.replace('ى', 'ي'))
quran_checked = 0; rule_table = []
for sid, form, q in ALL:
    if q['type'] != 'extraction': continue
    i = q['id']; quran_checked += 1
    m = SRC.match(q['source'])
    if not m: err(i, 'source بصيغة غير صحيحة'); continue
    name, s, a = m.group(1), int(m.group(2)), int(m.group(3)); key = f'{s}:{a}'
    if key not in T: err(i, f'لا توجد آية {key}'); continue
    if nz(SURA.get(s, '')) != nz(name): err(i, f'اسم السورة «{name}» لا يطابق «{SURA.get(s)}»')
    text = q['text']
    if '(مكتوبة بالرسم الإملائي)' not in q['question']: err(i, 'السؤال لا يذكر «(مكتوبة بالرسم الإملائي)»')
    if UTHMANI_ONLY.search(re.sub(r'<[^>]+>', '', text)): err(i, 'النص فيه علامات عثمانية (الرسم يجب أن يكون إملائيًّا)')
    if len(re.findall(r'<b>', text)) != 1: err(i, 'يجب أن يكون في النص إبراز واحد <b>…</b>'); continue
    words = plain(text).split()
    pre = plain(text.split('<b>')[0]).split(); boldw = plain(re.search(r'<b>(.*?)</b>', text).group(1)).split()
    bidx = list(range(len(pre), len(pre) + len(boldw)))
    k = locate(text, key)
    if k is None: err(i, f'النص لا يطابق حروف الآية {key} في تنزيل'); continue
    uw = ayah_words(key)
    waqf = 'الوقف' in q['question']
    if waqf and (bidx[-1] != len(words) - 1 or k + len(words) != len(uw)):
        err(i, 'سؤال الوقف يجب أن تكون كلمته الغامقة آخر الآية')
    ans = q['options'][q['answer']]
    # options limited to labels taught so far
    taught = TAUGHT.get(sid)
    if taught:
        for o in q['options']:
            if canon_madd(o) not in taught and o not in taught: err(i, f'الخيار «{o}» لم يُدرَّس حتى هذا القسم')
    computed = None
    if sid in ('s2_idhhar', 's3_idgham', 's4_iqlab', 's5_ikhfa'):
        occ = occurrences(words, bidx, 'nun')
        if len(occ) != 1: err(i, f'الكلمة الغامقة فيها {len(occ)} موضع نون/تنوين (المطلوب 1)'); continue
        wi, li = occ[0]; l, lm, same, nwi = following(words, wi, li)
        if l is None: err(i, 'لا حرف بعد النون/التنوين'); continue
        if l == 'ا' and not lm: err(i, 'بعد النون همزة وصل؛ المثال غير صالح')
        if SHADDA in (lm or ''): err(i, 'شدة على الحرف التالي تكشف الحكم')
        computed = nun_rule_from(l, same)
        # مقابلة ثانوية مع علامات المصحف في تنزيل
        U = uw[k + wi]; Un = uw[k + nwi] if not same else None
        ul = [c for c in U]
        if same and computed == 'الإقلاب' and 'ۢ' not in U and 'ۭ' not in U: err(i, 'تنزيل لا يضع ميمًا صغيرة هنا')
        # في رسم المصحف: الإدغام الكامل (ن م ل ر) بشدة على التالي، والناقص (و ي) بلا شدة
        if not same and computed.startswith('الإدغام'):
            if l in 'نملر' and SHADDA not in Un[:3]: err(i, 'تنزيل لا يشدد الحرف التالي (إدغام كامل؟)')
            if l in 'وي' and SHADDA in Un[:3]: err(i, 'تنزيل يشدد الواو/الياء (المتوقع إدغام ناقص بلا شدة)')
        if not same and computed in ('الإظهار', 'الإقلاب', 'الإخفاء') and Un and SHADDA in Un[:3] and not Un.startswith('ٱ'):
            err(i, 'تنزيل يشدد الحرف التالي وهو ليس إدغامًا')
        if parse(words[wi])[li][0] == 'ن' and not same:
            last = U.rstrip('ۭۢ')
            if computed == 'الإظهار' and not last.endswith(SUKUN): err(i, 'نون الإظهار بلا سكون في تنزيل')
            if computed == 'الإقلاب' and 'ۢ' not in U: err(i, 'نون الإقلاب بلا ميم صغيرة في تنزيل')
        rule_table.append((i, words[wi], l, computed, ans))
    elif sid == 's7_meem':
        occ = occurrences(words, bidx, 'meem')
        if len(occ) != 1: err(i, f'الكلمة الغامقة فيها {len(occ)} ميم ساكنة (المطلوب 1)'); continue
        wi, li = occ[0]; l, lm, same, nwi = following(words, wi, li)
        if SHADDA in (lm or ''): err(i, 'شدة على الحرف التالي تكشف الحكم')
        computed = meem_rule_from(l)
        U = uw[k + wi]; Un = uw[k + nwi]
        if computed == 'إدغام' and SHADDA not in Un[:3]: err(i, 'تنزيل لا يشدد الميم التالية')
        if computed == 'إظهار شفوي' and not U.endswith(SUKUN): err(i, 'ميم الإظهار بلا سكون في تنزيل')
        if computed == 'إخفاء شفوي' and U.endswith(SUKUN): err(i, 'ميم الإخفاء عليها سكون في تنزيل')
        rule_table.append((i, words[wi], l, computed, ans))
    elif sid == 's8b_mithl':
        if len(boldw) != 2: err(i, 'المطلوب كلمتان غامقتان'); continue
        A_, B_ = parse(boldw[0]), parse(boldw[1])
        if norm_hamza(A_[-1][0]) != norm_hamza(B_[0][0]): err(i, 'الحرفان ليسا مثلين'); continue
        if SHADDA in B_[0][1]: err(i, 'شدة على الحرف الثاني تكشف الإدغام')
        computed = 'مثلان صغير' if SUKUN in A_[-1][1] else 'مثلان كبير' if set(A_[-1][1]) & HARAKA else None
        rule_table.append((i, ' '.join(boldw), A_[-1][0], computed, ans))
    elif sid in ('s9_madd1', 's10_madd2', 's11_madd3', 's12_lazim'):
        if len(boldw) != 1: err(i, 'المطلوب كلمة غامقة واحدة'); continue
        bw = boldw[0]; nxt = words[bidx[0] + 1] if bidx[0] + 1 < len(words) else None
        if not re.search('[\u064B-\u0652]', bw):      # فاتحة سورة تُقرأ حروفها بأسمائها (بلا ضبط)
            FN = {'ا': 'ألف', 'ل': 'لام', 'م': 'ميم', 'ص': 'صاد', 'ر': 'را', 'ك': 'كاف', 'ه': 'ها', 'ي': 'يا', 'ع': 'عين',
                  'ط': 'طا', 'س': 'سين', 'ح': 'حا', 'ق': 'قاف', 'ن': 'نون'}
            if T[key].split()[0] and skel(T[key].split()[0]) != skel(bw): err(i, 'الحروف ليست فاتحة هذه السورة'); continue
            if len(bw) == 1: tgt = 0
            else:
                names = [re.sub('[\u064B-\u0652]', '', x) for x in quoted(q['question'])]
                cand = [k3 for k3, ch in enumerate(bw) if FN.get(ch) in names]
                if len(cand) != 1: err(i, 'لم يتعين الحرف المسؤول عنه في السؤال'); continue
                tgt = cand[0]
            ch = bw[tgt]
            if fawatih_amounts(ch) != [6]: err(i, 'الحرف ليس من حروف اللازم الحرفي'); continue
            last = FN[ch][-1]
            if tgt + 1 < len(bw): nfirst = FN[bw[tgt + 1]][0]
            else: nfirst = parse(nxt)[0][0] if nxt else None
            # مثقل إذا أُدغم آخر الاسم الساكن فيما بعده (مثلان، أو نون قبل ميم)، وإلا فمخفف
            merged = nfirst is not None and (nfirst == last or (last == 'ن' and nfirst == 'م'))
            types = {'لازم حرفي مثقل' if merged else 'لازم حرفي مخفف'}
            bw = f'{bw}:{FN[ch]}'
        else:
            types, _ = madd_types(bw, nxt, waqf)
            if not types: err(i, 'لا مد محسوب في الكلمة'); continue
        want = canon_madd(ans)
        if want not in types: err(i, f'المحسوب {sorted(types)} لا يحوي الجواب «{want}»')
        for k2, o in enumerate(q['options']):
            if k2 != q['answer'] and canon_madd(o) in types: err(i, f'الخيار «{o}» صحيح أيضًا بحسب الحساب')
        computed = want if want in types else '|'.join(sorted(types))
        rule_table.append((i, bw, 'وقف' if waqf else 'وصل', '+'.join(sorted(types)), ans))
        continue
    else:
        err(i, 'قسم بلا محرك حكم للاستخراج'); continue
    if computed != ans: err(i, f'الحكم المحسوب «{computed}» ≠ الجواب المعلَّم «{ans}»')

# ------------------------------------------------------------------ 4) Quranic phrases in MC options/stems + semantic checks
phrase_checked = 0
for sid, form, q in ALL:
    i = q['id']
    cand = list(q.get('options', [])) + quoted(q.get('text', ''))
    for o in cand:
        if o in REFS:
            phrase_checked += 1
            if locate(o, REFS[o]) is None: err(i, f'العبارة «{o}» لا توجد في {REFS[o]} بنص تنزيل')
            pw = [skel(w) for w in plain(o).split()]
            for lid, lw in LESSON_QTEXT:
                if any(lw[k:k + len(pw)] == pw for k in range(len(lw) - len(pw) + 1)):
                    err(i, f'العبارة «{o}» ظاهرة في نص قرآني من الدروس ({lid})'); break
    if i in SEM:
        try:
            SEM[i](q)
        except Exception as e:
            err(i, f'فشل الفحص الدلالي: {e!r}')
manual_only = [q['id'] for _, _, q in ALL if q['type'] != 'extraction' and q['id'] not in SEM]
for i in manual_only: warn(i, 'لا فحص آلي لمضمونه (مراجعة بشرية)')

# ------------------------------------------------------------------ 5) similarity with lesson questions
# اختيار متعدد وصواب/خطأ: يُقارن الجذع، والجذع مع الخيارات، بكل أسئلة الدروس.
# الاستخراج: جملة السؤال قالب ثابت مشترك («ما حكم ... في الكلمة الغامقة؟»)، فهويّة السؤال هي نصه القرآني:
#   يُقارن النص القرآني بنصوص استخراج الدروس (> 0.8 خطأ)، ويُمنع استعمال آية وردت في أي سؤال أو مهمة من الدروس.
#   ويُذكر في التقرير أعلى تشابه للجذع الكامل (النص + القالب) للعلم.
best_stem = (0, None, None); best_full = (0, None, None); best_qtext = (0, None, None); best_tmpl = (0, None, None)
for sid, form, q in ALL:
    if q['type'] == 'extraction':
        s0 = strip_cmp(q['text'])
        for lid, lt in LESSON_QSTR:
            r = difflib.SequenceMatcher(None, s0, lt).ratio()
            if r > best_qtext[0]: best_qtext = (r, q['id'], lid)
            if r > 0.8: err(q['id'], f'نصه القرآني قريب من سؤال الدرس {lid}: {r:.2f}')
        m = SRC.match(q['source'])
        if m and f'{m.group(2)}:{m.group(3)}' in LESSON_AYAT:
            err(q['id'], f'الآية {m.group(2)}:{m.group(3)} مستعملة في الدروس ({LESSON_AYAT[m.group(2) + ":" + m.group(3)]})')
        s1 = strip_cmp(q['text'] + ' ' + q['question'])
        for lid, ls, lf in LESSON:
            r = difflib.SequenceMatcher(None, s1, ls).ratio()
            if r > best_tmpl[0]: best_tmpl = (r, q['id'], lid)
        continue
    s1 = strip_cmp(q['text']); s2 = strip_cmp(q['text'] + ' ' + ' '.join(q.get('options', [])))
    for lid, ls, lf in LESSON:
        r1 = difflib.SequenceMatcher(None, s1, ls).ratio()
        r2 = difflib.SequenceMatcher(None, s2, lf).ratio()
        if r1 > best_stem[0]: best_stem = (r1, q['id'], lid)
        if r2 > best_full[0]: best_full = (r2, q['id'], lid)
        if r1 > 0.8 or r2 > 0.8: err(q['id'], f'تشابه مرتفع مع سؤال الدرس {lid}: {max(r1, r2):.2f}')
# intra-bank duplicates
seen = {}
for sid, form, q in ALL:
    key = strip_cmp(q['text'] + ' ' + q.get('question', '') + ' ' + ' '.join(q.get('options', [])))
    if key in seen: err(q['id'], f'مكرر حرفيًّا مع {seen[key]}')
    seen[key] = q['id']

# ------------------------------------------------------------------ 6) correct-index distribution
dist = defaultdict(Counter)
for sid, form, q in ALL:
    if q['type'] != 'true_false': dist[len(q['options'])][q['answer']] += 1
for n, cnt in dist.items():
    tot = sum(cnt.values()); exp = tot / n
    for p in range(n):
        if not (0.6 * exp <= cnt[p] <= 1.4 * exp): err('dist', f'{n} خيارات: الموضع {p} = {cnt[p]} (المتوقع ≈ {exp:.1f})')
tf_dist = Counter(q['answer'] for _, _, q in ALL if q['type'] == 'true_false')

# ------------------------------------------------------------------ report
print('=== فاحص بنك الاختبار النهائي ===')
print(f'الملف: {BANK}')
print(f'الأسئلة: {total} | الأقسام: {len(bank)} | الأنواع: {dict(Counter(q["type"] for _, _, q in ALL))}')
print('لكل قسم (A/B):', ' '.join(f'{sid.split("_")[0]}={len(per_set[(sid,"A")])}/{len(per_set[(sid,"B")])}' for sid in SEC_IDS))
print(f'صواب/خطأ: {n_tf} (الحد 12)، توزيع الأجوبة: صحيح={tf_dist[True]} خطأ={tf_dist[False]}')
for n in sorted(dist):
    print(f'فهرس الجواب الصحيح ({n} خيارات، {sum(dist[n].values())} سؤالًا):', dict(sorted(dist[n].items())))
allc = Counter(); [allc.update(c) for c in dist.values()]
print('فهرس الجواب الصحيح (كل الخيارات):', dict(sorted(allc.items())))
print(f'أسئلة استخراج قوبلت بتنزيل وحُسب حكمها: {quran_checked} | عبارات قرآنية في الخيارات/الأسئلة قوبلت: {phrase_checked}')
print(f'فحوص دلالية آلية لغير الاستخراج: {len(SEM)} | بلا فحص آلي (مراجعة بشرية): {len(manual_only)} {manual_only}')
print(f'أعلى تشابه مع أسئلة الدروس — اختيار/صواب وخطأ (الجذع): {best_stem[0]:.3f} — {best_stem[1]} ↔ {best_stem[2]}')
print(f'أعلى تشابه مع أسئلة الدروس — اختيار/صواب وخطأ (الجذع + الخيارات): {best_full[0]:.3f} — {best_full[1]} ↔ {best_full[2]}')
print(f'أعلى تشابه مع أسئلة الدروس — الاستخراج (النص القرآني): {best_qtext[0]:.3f} — {best_qtext[1]} ↔ {best_qtext[2]}')
print(f'للعلم: أعلى تشابه للاستخراج مع القالب المشترك (النص + جملة السؤال): {best_tmpl[0]:.3f} — {best_tmpl[1]} ↔ {best_tmpl[2]}')
print(f'آيات الدروس الممنوعة على البنك: {len(LESSON_AYAT)} | نصوص قرآنية في الدروس فُحص تكرارها: {len(LESSON_QTEXT)}')
print('--- جدول الأحكام المحسوبة لأسئلة الاستخراج ---')
for r in rule_table:
    print(f'  {r[0]:<11} {r[1]:<16} بعدها/السياق: {r[2]:<5} محسوب: {r[3]:<22} معلَّم: {r[4]}')
if WARN:
    print(f'--- تنبيهات ({len(WARN)}) ---')
    for w in WARN: print('  ' + w)
if ERR:
    print(f'--- أخطاء ({len(ERR)}) ---')
    for e in ERR: print('  ' + e)
    print('النتيجة: فشل'); sys.exit(1)
print('النتيجة: نجح — لا أخطاء')
