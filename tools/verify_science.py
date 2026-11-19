# -*- coding: utf-8 -*-
"""فاحص الصحة العلمية للمنهج: «جواب واحد صحيح» في كل سؤال قرآني.

التشغيل:
    python3 -I tools/verify_science.py [CURRICULUM] [--report]

لكل سؤال فيه نص قرآني (استخراج، صيد، تلوين، تصنيف، اسمع وميّز) في الدروس وبنك الاختبار:
  1) يحسب آليًا كل الأحكام الموجودة في الكلمة المقصودة (النون الساكنة والتنوين، الميم الساكنة،
     لام «ال»، النون والميم المشددتان، أنواع المد) من النص المضبوط، عثمانيًا كان أو إملائيًا.
  2) يتحقق أن الجواب المعلَّم موجود فعلًا، وأن أي خيار آخر ليس صحيحًا هو أيضًا في الكلمة نفسها
     (مثل «مد طبيعي» في «ءَامَنُوا» إلى جانب البدل، أو «إظهار» اللام القمرية في «ٱلْجِنَّةِ»).
  3) في الصيد: الكلمات المعلَّمة فيها الحكم، وغير المعلَّمة ليس فيها. في التلوين والتصنيف: لكل كلمة حكم
     سلّتها، ولا يصدق عليها حكم سلة أخرى.
ما يحتاج إلى حكم بشري (لأن المحرك لا يغطيه) يُكتب في ALLOW بسببه، فلا يمر خطأ جديد صامتًا.
يخرج بالرمز 0 إن لم يوجد خطأ، و1 إن وُجد.
"""
import sys, re, json, glob, unicodedata

FATHA, DAMMA, KASRA, SUKUN, SHADDA = 'َ', 'ُ', 'ِ', 'ْ', 'ّ'
TANWEEN = set('ًٌٍ')
VOWEL = {FATHA, DAMMA, KASRA} | TANWEEN
MADDAH = 'ٓ'
HAMZA = set('ءأإؤئ')
HALQ = set('ءهعحغخ')
YANMU = set('ينمو')
IKHFA = set('صذثكجشقسدطزفتضظ')
QAMARI = set('ابغحجكوخفعقيمهء')
SILENT = {'ۣ', '۟', '۠'}            # علامات الحرف الذي لا يُنطق
DROP = set('ۖۗۘۙۚۛۜ۞ۭۢـ')     # علامات وقف وإقلاب وتطويل لا تؤثر في الحكم
IQLAB_MARK = {'ۢ', 'ۭ'}

def letters(word):
    """[[حرف, علامات]] لكلمة مضبوطة عثمانية أو إملائية، بعد حذف ما لا يُنطق."""
    out = []
    w = unicodedata.normalize('NFC', word)
    i = 0
    while i < len(w):
        ch = w[i]
        if ch == 'آ':
            out.append(['ء', FATHA]); out.append(['ا', MADDAH])
        elif ch == 'ٰ':                                   # ألف خنجرية = ألف مد
            if out and out[-1][0] == 'ى' and not (set(out[-1][1]) & VOWEL):
                out[-1] = ['ا', '']
            else:
                out.append(['ا', ''])
        elif ch == 'ۥ':
            out.append(['و', '']); out[-1].append('صلة')
        elif ch == 'ۦ':
            out.append(['ي', '']); out[-1].append('صلة')
        elif (('ء' <= ch <= 'ي') and ch != 'ـ') or ch == 'ٱ':
            out.append([ch, ''])
        elif out and (ch in VOWEL or ch in (SUKUN, SHADDA, MADDAH, 'ٔ', 'ٕ') or ch in SILENT or ch in IQLAB_MARK):
            out[-1][1] += ch
        i += 1
    res = []
    for L in out:
        b, m = L[0], L[1]
        if any(s in m for s in SILENT): continue
        if 'ٔ' in m or 'ٕ' in m: b = 'ء'
        if b in HAMZA: b = 'ء'
        res.append([b, m] + L[2:])
    return res

def has_vowel(m): return bool(set(m) & VOWEL) or SHADDA in m

def words_of(text):
    t = re.sub(r'<[^>]+>', ' ', text)
    t = re.sub(r'[﴿﴾«»()\[\]:؛،,.!?؟]', ' ', t)
    return [w for w in t.split() if any(('ء' <= c <= 'ي') or c == 'ٱ' for c in w)]

def first_sound(W):
    """أول حرف منطوق في كلمة تالية: (حرف، علامات) أو ('ٱ', '') إن بدأت بهمزة وصل."""
    if not W: return None, None
    return W[0][0], W[0][1]

AL_PREFIX = ('', 'و', 'ف', 'ب', 'ك', 'ل', 'وب', 'فب', 'ول', 'فل', 'أ', 'وك')

UTHMANI = re.compile('[ٱٰۥۦۭۢ]')

def rules_in(words, idx, waqf_last=True, uthmani=None):
    """مجموعة الأحكام في الكلمة رقم idx من words (مع التقائها بالكلمة التالية)."""
    W = letters(words[idx])
    N = letters(words[idx + 1]) if idx + 1 < len(words) else None
    at_end = idx == len(words) - 1
    tags = set()
    n = len(W)
    if uthmani is None: uthmani = any(UTHMANI.search(w) for w in words)
    # المثلان: ساكن بعده مثله (صغير)، أو متحركان متجاوران بين كلمتين (كبير)
    if N and W and N[0][0] == W[-1][0] and not at_end:
        if SUKUN in W[-1][1] or (not has_vowel(W[-1][1]) and W[-1][0] not in 'اوى'): tags.add('mith_s')
        elif has_vowel(W[-1][1]) and SHADDA not in N[0][1] and has_vowel(N[0][1]): tags.add('mith_k')
    # النون الساكنة والتنوين، والميم الساكنة
    for i, L in enumerate(W):
        b, m = L[0], L[1]
        tanween = bool(set(m) & TANWEEN)
        sakin = (SUKUN in m) or (not has_vowel(m) and b in 'نم' and not (i == 0 and n > 1 and W[1][1] == '' ))
        if b == 'ن' and i == n - 1 and n == 1:
            sakin = SUKUN in m or (not has_vowel(m))
        if not (tanween or (b in 'نم' and sakin and not tanween)):
            continue
        # الحرف التالي
        j = i + 1
        if tanween:
            while j < n and W[j][0] in 'اى' and not has_vowel(W[j][1]): j += 1
        same = j < n
        if same:
            nb, nm = W[j][0], W[j][1]
        else:
            if at_end or N is None: continue           # وقف: لا حكم
            nb, nm = first_sound(N)
            if nb == 'ٱ': continue                     # التقاء ساكنين: تُحرَّك
        if b == 'ن' or tanween:
            if b == 'ن' and not tanween and not sakin: continue
            if nb in HALQ: tags.add('n_izhar')
            elif nb in YANMU: tags.add('n_izhar_mutlaq' if same else 'n_idg_g')
            elif nb in 'لر': tags.add('n_idg_ng')
            elif nb == 'ب': tags.add('n_iqlab')
            elif nb in IKHFA: tags.add('n_ikhfa')
        if b == 'م' and not tanween and sakin:
            if nb == 'ب': tags.add('m_ikhfa')
            elif nb == 'م': tags.add('m_idgham')
            else: tags.add('m_izhar')
    # الغنة في المشدد
    for i, L in enumerate(W):
        if L[0] in 'نم' and SHADDA in L[1]: tags.add('ghunna')
    # لام «ال»
    for p in AL_PREFIX:
        core = W[len(p):] if p else W
        if p and ''.join(x[0] for x in W[:len(p)]) != p: continue
        if len(core) >= 3 and core[0][0] in 'اٱ' and core[1][0] == 'ل' and not has_vowel(core[1][1]):
            nxt = core[2]
            if SUKUN in core[1][1]: tags.add('l_qamari')
            elif SHADDA in nxt[1]: tags.add('l_shamsi')
            elif nxt[0] in QAMARI: tags.add('l_qamari')
            break
    # المد
    eff_n = n
    iwad = n >= 2 and W[-1][0] in 'اى' and not has_vowel(W[-1][1]) and 'ً' in W[-2][1]
    if iwad: eff_n = n - 1
    for i, L in enumerate(W):
        b, m = L[0], L[1]
        sila = len(L) > 2 and L[2] == 'صلة'
        pb, pm = (W[i - 1][0], W[i - 1][1]) if i > 0 else (None, '')
        if sila:
            if at_end: continue                          # لا صلة في الوقف
            if N is None: continue
            nb, nm = first_sound(N)
            if nb == 'ٱ': continue
            tags.add('d_sila_k' if (MADDAH in m or nb == 'ء') else 'd_sila_s')
            continue
        madd = lin = False
        if b == 'ا' and not has_vowel(m) and SUKUN not in m:
            if i == 0: continue
            if i <= 2 and i + 1 < n and W[i + 1][0] == 'ل' and not has_vowel(W[i + 1][1]) and i + 2 < n: continue   # ألف «ال»
            if iwad and i == n - 1: continue
            madd = FATHA in pm or (pb == 'ء' and FATHA in pm)
        elif b == 'و' and not has_vowel(m) and SUKUN not in m and DAMMA in pm: madd = True
        elif b in 'يى' and not has_vowel(m) and SUKUN not in m and KASRA in pm: madd = True
        elif b in 'وي' and SUKUN in m and FATHA in pm: lin = True
        if madd:
            if i + 1 < eff_n:
                nb, nm = W[i + 1][0], W[i + 1][1]
                if nb == 'ء' and i == 1 and W[0][0] in 'يه' and n > 3: tags.add('d_munfasil')   # «يَٰٓأَيُّهَا» «هَٰٓأَنتُمْ»: يا النداء وها التنبيه كلمتان
                elif nb == 'ء': tags.add('d_muttasil')
                elif SHADDA in nm: tags.add('d_lazim_km')
                elif SUKUN in nm: tags.add('d_lazim_kk')
                elif at_end and waqf_last and i + 1 == eff_n - 1 and not iwad: tags.add('d_arid')
                elif pb == 'ء': tags.add('d_badal')
                else: tags.add('d_tabii')
            else:
                if at_end or N is None: tags.add('d_badal' if pb == 'ء' else 'd_tabii')
                else:
                    nb, nm = first_sound(N)
                    if nb == 'ء': tags.add('d_munfasil')
                    elif nb == 'ٱ': pass                 # يسقط في الوصل
                    else: tags.add('d_badal' if pb == 'ء' else 'd_tabii')
        if lin and at_end and waqf_last and i + 1 == eff_n - 1 and not iwad:
            tags.add('d_leen')
    if at_end and waqf_last and iwad and W[-2][0] != 'ة':
        tags.add('d_iwad')
    # صلة هاء الضمير في الرسم الإملائي (لا واو صغيرة فيه)
    if (not uthmani and n >= 2 and not at_end and N and W[-1][0] == 'ه' and (DAMMA in W[-1][1] or KASRA in W[-1][1])
            and has_vowel(W[-2][1]) and ''.join(x[0] for x in W) not in ('الله', 'لله', 'والله', 'بالله', 'فالله')
            and N[0][0] != 'ٱ' and has_vowel(N[0][1]) and not (N[0][0] in 'ا' and not has_vowel(N[0][1]))):
        tags.add('d_sila_k' if N[0][0] == 'ء' else 'd_sila_s')
    return tags

NUN = {'n_izhar', 'n_idg_g', 'n_idg_ng', 'n_iqlab', 'n_ikhfa', 'n_izhar_mutlaq'}
MEEM = {'m_ikhfa', 'm_idgham', 'm_izhar'}
LAM = {'l_qamari', 'l_shamsi'}
MADD = {'d_tabii', 'd_muttasil', 'd_munfasil', 'd_badal', 'd_lazim_km', 'd_lazim_kk', 'd_lazim_h',
        'd_arid', 'd_leen', 'd_iwad', 'd_sila_s', 'd_sila_k'}

def opt_tags(o):
    o = re.sub(r'\{([^{}|]*)\|([^{}]*)\}', lambda m: m.group(1), o or '')
    if 'ليس' in o: return None
    t = set()
    if 'غنة كاملة' in o or o.strip() in ('غنة', 'الغنة'): t |= {'ghunna'}
    if 'إدغام بلا غنة' in o: t |= {'n_idg_ng'}
    elif 'إدغام بغنة' in o: t |= {'n_idg_g', 'm_idgham'}
    elif 'إدغام' in o: t |= {'n_idg_g', 'n_idg_ng', 'm_idgham', 'l_shamsi'}
    if 'إخفاء شفوي' in o: t |= {'m_ikhfa'}
    elif 'إخفاء' in o: t |= {'n_ikhfa', 'm_ikhfa'}
    if 'إظهار شفوي' in o: t |= {'m_izhar'}
    elif 'إظهار' in o: t |= ({'n_izhar', 'n_izhar_mutlaq'} if 'النون' in o else {'n_izhar', 'n_izhar_mutlaq', 'm_izhar', 'l_qamari'})
    if 'إقلاب' in o: t |= {'n_iqlab'}
    if 'قمرية' in o: t |= {'l_qamari'}
    if 'شمسية' in o: t |= {'l_shamsi'}
    for k, v in (('طبيعي', 'd_tabii'), ('متصل', 'd_muttasil'), ('منفصل', 'd_munfasil'), ('بدل', 'd_badal'),
                 ('عارض', 'd_arid'), ('لين', 'd_leen'), ('عوض', 'd_iwad')):
        if k in o: t.add(v)
    if 'لازم كلمي مثقل' in o: t.add('d_lazim_km')
    elif 'لازم كلمي مخفف' in o: t.add('d_lazim_kk')
    elif 'لازم حرفي' in o or o.strip().startswith('لازم ٦'): t.add('d_lazim_h')
    elif 'لازم' in o: t |= {'d_lazim_km', 'd_lazim_kk', 'd_lazim_h'}
    if 'صلة صغرى' in o: t.add('d_sila_s')
    elif 'صلة كبرى' in o: t.add('d_sila_k')
    elif 'صلة' in o: t |= {'d_sila_s', 'd_sila_k'}
    if 'مثلان صغير' in o: t.add('mith_s')
    if 'مثلان كبير' in o: t.add('mith_k')
    if 'متجانسان' in o: t.add('mutajanis')
    if 'متقاربان' in o: t.add('mutaqarib')
    return t or None

def domain(stem):
    s = stem or ''
    if 'نوع المد' in s or re.search(r'\bالمد\b', s) or 'مدّ' in s or 'المد ' in s: return MADD
    if 'الميم الساكنة' in s: return MEEM | {'mith_s', 'mith_k', 'mutajanis', 'mutaqarib'}
    if 'اللام' in s or 'لام' in s: return LAM
    if 'النون' in s or 'التنوين' in s: return NUN
    return None                                          # كل الأحكام

ERR, WARN, INFO = [], [], []
# ما يحكم فيه الإنسان لأن المحرك لا يغطيه؛ لكل استثناء سبب.
ALLOW = {
    ('x_s12_B1', 'answer'): 'حروف فواتح السور تُقرأ بأسمائها (لَامْ مِيمْ)؛ يفحصها fawatih_amounts في فاحص البنك',
}

def check_extraction(q, where):
    qid = q['id']
    txt = q.get('text', '')
    ws = words_of(txt)
    marked = re.findall(r'<b>(.*?)</b>', txt)
    if not marked: return
    hw = words_of(' '.join(marked))
    toks = re.sub(r'[﴿﴾«»]', ' ', re.sub(r'<(?!/?b>)[^>]+>', '', txt))
    toks = re.sub(r'<b>(.*?)</b>', lambda m: ' '.join('§' + w for w in m.group(1).split()), toks).split()
    toks = [w for w in toks if any(('ء' <= c <= 'ي') or c == 'ٱ' for c in w)]
    idxs = [i for i, w in enumerate(toks) if w.startswith('§')]
    toks = [w.lstrip('§') for w in toks]
    present = set()
    for i in idxs: present |= rules_in(toks, i)
    dom = domain(q.get('question') or '')
    if dom is not None: present &= dom
    opts = q.get('options') or []
    ans = q.get('answer')
    if not isinstance(ans, int) or ans >= len(opts): return
    neg = {j: opt_tags(o.replace('ليس', '').replace('إظهارًا', 'إظهار')) for j, o in enumerate(opts) if 'ليس' in o}
    at = opt_tags(opts[ans])
    if at is None:                                        # «ليس إظهارًا»: في الكلمة حكم آخر من الباب، وليس فيها المنفي
        nt = neg[ans] & (dom or NUN)
        if not present or (nt & present):
            ERR.append(f'{where}/{qid}: الجواب «{opts[ans]}» والمحرك يجد {sorted(present)}')
        return
    if dom is not None: at &= dom | {'ghunna'}
    if not (at & present):
        key = (qid, 'answer')
        (WARN if key in ALLOW else ERR).append(f'{where}/{qid}: الجواب «{opts[ans]}» لا يجده المحرك في {hw} (الموجود: {sorted(present)})' + (f' — مقبول: {ALLOW[key]}' if key in ALLOW else ''))
    for j, o in enumerate(opts):
        if j == ans: continue
        ot = opt_tags(o)
        if not ot: continue
        hit = ot & present
        if hit:
            key = (qid, o)
            (WARN if key in ALLOW else ERR).append(f'{where}/{qid}: الخيار «{o}» صحيح أيضًا في {hw} ({sorted(hit)})' + (f' — مقبول: {ALLOW[key]}' if key in ALLOW else ''))

RULE_WORDS = [
    ('إقلاب', {'n_iqlab'}), ('إخفاء شفوي', {'m_ikhfa'}), ('إظهار شفوي', {'m_izhar'}),
    ('إدغام بلا غنة', {'n_idg_ng'}), ('إدغام بغنة', {'n_idg_g'}), ('مد متصل', {'d_muttasil'}),
    ('مد منفصل', {'d_munfasil'}), ('مد صلة', {'d_sila_s', 'd_sila_k'}), ('مد العوض', {'d_iwad'}),
    ('مد لين', {'d_leen'}), ('مد بدل', {'d_badal'}),
]

def hunt_target(stem):
    s = re.sub(r'\{([^{}|]*)\|([^{}]*)\}', lambda m: m.group(1), stem)
    if 'ميم ساكنة بعدها فاء' in s: return 'custom_meem_fa'
    if 'تنوين حكمه الإظهار' in s: return {'n_izhar'}
    for k, v in RULE_WORDS:
        if k in s: return v
    if 'ينتهي تنوينها بألف' in s: return {'d_iwad'}
    return None

def check_hunt(q, where):
    if q.get('unit') == 'letter': INFO.append(f'{where}/{q["id"]}: صيد بالحرف (يُراجع بالعين)'); return
    t = hunt_target(q.get('text', ''))
    if t is None: INFO.append(f'{where}/{q["id"]}: صيد لا يعرف المحرك هدفه: {q.get("text")}'); return
    ay = q.get('ayah', '')
    toks = re.sub(r'\[\[(.*?)\]\]', lambda m: ' '.join('§' + w for w in m.group(1).split()), ay).split()
    toks = [w for w in toks if any(('ء' <= c <= 'ي') or c == 'ٱ' for c in w)]
    marked = {i for i, w in enumerate(toks) if w.startswith('§')}
    toks = [w.lstrip('§') for w in toks]
    for i in range(len(toks)):
        if t == 'custom_meem_fa':
            W = letters(toks[i]); N = letters(toks[i + 1]) if i + 1 < len(toks) else None
            has = bool(W and W[-1][0] == 'م' and not has_vowel(W[-1][1]) and N and N[0][0] == 'ف')
        else:
            has = bool(rules_in(toks, i) & t)
        if (i in marked) != has:
            key = (q['id'], toks[i])
            msg = f'{where}/{q["id"]}: «{toks[i]}» ' + ('معلَّمة وليس فيها الحكم' if i in marked else 'فيها الحكم ولم تُعلَّم')
            (WARN if key in ALLOW else ERR).append(msg + (f' — مقبول: {ALLOW[key]}' if key in ALLOW else ''))

LAZIM_HARF = set('كمعسلنقص'); TABII_HARF = set('حيطهر')

def check_classify(q, where):
    items = q.get('items') or {}
    buckets = {b: opt_tags(b) for b in items}
    if not all(buckets.values()): INFO.append(f'{where}/{q["id"]}: تصنيف بسلال لا يعرفها المحرك: {list(items)}'); return
    if all(len(w) == 1 for ws in items.values() for w in ws):          # حروف فواتح السور
        for b, ws in items.items():
            for w in ws:
                got = {'d_lazim_h'} if w in LAZIM_HARF else {'d_tabii'} if w in TABII_HARF else set()
                if not (got & buckets[b]) or any(ob != b and got & ot for ob, ot in buckets.items()):
                    ERR.append(f'{where}/{q["id"]}: الحرف «{w}» في سلة «{b}» وحكمه {sorted(got)}')
        return
    for b, ws in items.items():
        for w in ws:
            toks = words_of(w)
            present = set()
            for i in range(len(toks)): present |= rules_in(toks, i, waqf_last=False)
            if len(toks) > 1:   # عبارة: الحكم في التقاء الكلمتين
                present = rules_in(toks, 0, waqf_last=False) | (rules_in(toks, 1, waqf_last=False) if 'ل' not in buckets else set())
            dom = set().union(*buckets.values())
            present &= dom | {'n_izhar_mutlaq'}
            if not (buckets[b] & present):
                key = (q['id'], w)
                (WARN if key in ALLOW else ERR).append(f'{where}/{q["id"]}: «{w}» في سلة «{b}» ولا يجد المحرك حكمها ({sorted(present)})' + (f' — مقبول: {ALLOW[key]}' if key in ALLOW else ''))
            for ob, ot in buckets.items():
                if ob != b and ot & present:
                    key = (q['id'], w, ob)
                    (WARN if key in ALLOW else ERR).append(f'{where}/{q["id"]}: «{w}» في سلة «{b}» ويصدق عليها «{ob}» أيضًا' + (f' — مقبول: {ALLOW[key]}' if key in ALLOW else ''))

def check_paint(q, where):
    ay = q.get('ayah', '')
    rules = set(re.findall(r'\[\[[^|\]]+\|([^\]]+)\]\]', ay)) | set(q.get('extraRules') or [])
    rt = {r: opt_tags(r) for r in rules}
    if not all(rt.values()): INFO.append(f'{where}/{q["id"]}: تلوين بأحكام لا يعرفها المحرك: {sorted(rules)}'); return
    dom = set().union(*rt.values())
    toks = re.sub(r'\[\[([^|\]]+)\|([^\]]+)\]\]', lambda m: '§' + m.group(1) + '§' + m.group(2).replace(' ', '_'), ay).split()
    words, lab = [], {}
    for w in toks:
        if w.startswith('§'):
            _, ww, r = w.split('§'); lab[len(words)] = r.replace('_', ' '); words.append(ww)
        elif any(('ء' <= c <= 'ي') or c == 'ٱ' for c in w): words.append(w)
    for i, w in enumerate(words):
        present = rules_in(words, i, waqf_last=False) & dom
        if i in lab:
            if not (rt[lab[i]] & present):
                ERR.append(f'{where}/{q["id"]}: «{w}» لُوّنت «{lab[i]}» ولا يجد المحرك الحكم ({sorted(present)})')
            for r, t in rt.items():
                if r != lab[i] and t & present and not (t & rt[lab[i]]):
                    ERR.append(f'{where}/{q["id"]}: «{w}» لُوّنت «{lab[i]}» ويصدق عليها «{r}» أيضًا')
        elif present:
            key = (q['id'], w)
            (WARN if key in ALLOW else ERR).append(f'{where}/{q["id"]}: «{w}» غير ملوّنة وفيها {sorted(present)}' + (f' — مقبول: {ALLOW[key]}' if key in ALLOW else ''))

LISTEN = {'إظهار': {'n_izhar'}, 'إدغام بغنة': {'n_idg_g'}, 'إدغام بلا غنة': {'n_idg_ng'}, 'إقلاب': {'n_iqlab'},
          'إخفاء': {'n_ikhfa'}, 'غنة كاملة': {'ghunna'}, 'إخفاء شفوي': {'m_ikhfa'}, 'إظهار شفوي': {'m_izhar'},
          'لام قمرية تُظهر': {'l_qamari'}, 'لام شمسية تُدغم': {'l_shamsi'}}

def check_listen(q, where):
    r = q.get('rule', '')
    t = LISTEN.get(r) or opt_tags(r)
    if not t: INFO.append(f'{where}/{q["id"]}: اسمع وميّز بحكم لا يعرفه المحرك: {r}'); return
    toks = words_of(q.get('word', ''))
    present = set()
    for i in range(len(toks)): present |= rules_in(toks, i, waqf_last=False)
    if 'حرفي' in r: return                                   # فواتح السور: يغطيها فاحص البنك
    if not (t & present):
        ERR.append(f'{where}/{q["id"]}: «{q.get("word")}» حكمها المعلَّم «{r}» ولا يجده المحرك ({sorted(present)})')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    report = '--report' in sys.argv
    cur = args[0] if args else glob.glob('curriculum/منهج_المرحلة1_*.json')[0]
    C = json.load(open(cur, encoding='utf8'))
    n = 0
    for s in C['sections']:
        for q in s.get('questions', []) + s.get('examQuestions', []):
            check = {'extraction': check_extraction, 'hunt': check_hunt, 'classify': check_classify,
                     'paint': check_paint, 'listen': check_listen}.get(q.get('type'))
            if check: check(q, s['id']); n += 1
    print(f'فاحص الصحة العلمية: {n} سؤالًا قرآنيًا — أخطاء {len(ERR)}، استثناءات مقبولة {len(WARN)}')
    for e in ERR: print('  ✗', e)
    if report:
        for w in WARN: print('  ~', w)
        for i in INFO: print('  ·', i)
    sys.exit(1 if ERR else 0)


if __name__ == '__main__':
    main()
