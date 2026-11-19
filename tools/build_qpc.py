# -*- coding: utf-8 -*-
"""9.39.17: خط المصحف (QPC V2، مجمع الملك فهد) للآيات العثمانية في المنهج.
QPC V2 خط لكل صفحة من صفحات المصحف الـ604، وكل كلمة رمز واحد (U+FC41…) يعني كلمة مختلفة في كل صفحة.
هذه الأداة:
 1) تحدد كل آية عثمانية في المنهج: مهام التسجيل (المرجع في سطر المهمة) والأسئلة العثمانية (المصدر «… (نص تنزيل)»)؛
 2) تطابق كلمات النص المعروض (نص تنزيل) بكلمات الآية في تنزيل، ثم تأخذ رموز QPC للكلمات نفسها (عدد كلمات QPC = كلمات تنزيل + علامة الآية)،
    وتحفظ مواضع الكلمة الملوّنة (<b>) والحكم المحوري للمهمة؛
 3) تقتطع من خط كل صفحة الرموز المستعملة وحدها (WOFF)، فيصغر الخط من مئات الكيلوبايتات إلى بضعة.
المخرجات (في المستودع):
 - curriculum/qpc/qpc_verses.json: رموز QPC للآيات المستعملة كاملة، ورقم صفحتها (مقتطع من بيانات QPC V2) — مرجع الفاحص.
 - curriculum/qpc/qpc_fonts.json: خطوط الصفحات المقتطعة (base64) وبصماتها.
 - curriculum/qpc/qpc_map.json: لكل سؤال ومهمة: الصفحة، ورموز الكلمات المعروضة، ومواضع الإبراز والحكم المحوري (مرجع للمراجعة).
 - حقل qpc في كل مهمة وسؤال عثماني في المنهج المصدر: {p الصفحة، w الرموز، e مواضع علامات الآيات، k هيكل الكلمات المعروضة، wp صفحة كل رمز إن تعددت}.
المدخلات (خارج المستودع، تمرَّر مسارات):
 --words  qpc-v2.json (كلمة كلمة)  --ayahs qpc-v2-ayah-by-ayah-glyphs.json (رقم الصفحة)
 --fonts  مجلد mushaf-v2 من github.com/nuqayah/qpc-fonts (QCF2001.ttf … QCF2604.ttf)
التشغيل: python3 -I tools/build_qpc.py --words … --ayahs … --fonts …"""
import base64, hashlib, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURR = os.path.join(ROOT, 'curriculum', 'منهج_المرحلة1_كامل_معتمد_v1.3.json')
TANZIL = os.path.join(ROOT, 'curriculum', 'نص_القرآن_تنزيل_العثماني.json')
OUT = os.path.join(ROOT, 'curriculum', 'qpc')
SRC_FONTS = 'github.com/nuqayah/qpc-fonts@8a4f39d (mushaf-v2/QCF2NNN.ttf)'

MARKS = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
def skel(w): return MARKS.sub('', w).replace('ٱ', 'ا')
def is_mark_token(t): return not skel(t).strip()
def words_of(text):
    """كلمات النص المعروض بلا علامات الوقف المستقلة، مع علم الإبراز لكل كلمة"""
    t = text.replace('﴿', ' ').replace('﴾', ' ')
    t = re.sub(r'<b>', ' \x01', t); t = re.sub(r'</b>', '\x02 ', t)
    out, inb = [], False
    for tok in t.split():
        if tok.startswith('\x01'): inb = True; tok = tok[1:]
        end = tok.endswith('\x02'); tok = tok.rstrip('\x02')
        if tok and not is_mark_token(tok): out.append((tok, inb))
        if end: inb = False
    return out

def arg(name):
    a = sys.argv
    if name not in a: sys.exit('missing ' + name)
    return a[a.index(name) + 1]

def main():
    from fontTools.ttLib import TTFont
    from fontTools import subset
    W = json.load(open(arg('--words'), encoding='utf-8'))
    A = json.load(open(arg('--ayahs'), encoding='utf-8'))
    fonts_dir = arg('--fonts')
    T = json.load(open(TANZIL, encoding='utf-8'))
    C = json.load(open(CURR, encoding='utf-8'))
    qwords = {}
    for v in W.values():
        qwords.setdefault('%s:%s' % (v['surah'], v['ayah']), []).append((int(v['word']), v['text']))
    for k in qwords: qwords[k] = [t for _, t in sorted(qwords[k])]

    targets = []  # (kind, id, text, verse_key, desc, holder)
    for s in C['sections']:
        for it in s['items']:
            if it.get('type') == 'quran':
                m = re.search(r'(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?', it.get('desc', ''))
                if not m: sys.exit('item without verse ref: ' + it['id'])
                targets.append(('item', it['id'], it['text'], (int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2))), it.get('desc', ''), it))
        for q in s.get('questions', []) + s.get('examQuestions', []):
            for kind, holder in (('q', q), ('prev', q.get('prev'))):  # الصيغة العثمانية السابقة لسؤال حُوّل إملائيًا (تُعرض على الرئيسي)
                if not holder: continue
                m = re.search(r'(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))? \(نص تنزيل\)', str(holder.get('source', '')))
                if m: targets.append((kind, q['id'], holder['text'], (int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2))), '', holder))

    verses, mapping, used = {}, {}, {}
    for kind, tid, text, (su, a1, a2), desc, holder in targets:
        seq = []  # (مفتاح الآية، رقم الكلمة فيها، هيكلها) للآيات المعروضة متتالية
        for ay in range(a1, a2 + 1):
            vk = '%d:%d' % (su, ay)
            tz = [t for t in T[vk].split(' ') if t and not is_mark_token(t)]
            if len(qwords[vk]) != len(tz) + 1: sys.exit('%s: QPC words %d != Tanzil %d + 1' % (vk, len(qwords[vk]), len(tz)))
            seq += [(vk, i, skel(t), len(tz)) for i, t in enumerate(tz)]
            verses[vk] = {'p': A[vk]['page_number'], 'w': qwords[vk]}
        shown = words_of(text)
        ks = [skel(w) for w, _ in shown]; kz = [x[2] for x in seq]
        i0 = next((i for i in range(len(kz) - len(ks) + 1) if kz[i:i + len(ks)] == ks), None)
        if i0 is None: sys.exit('%s %s: words not found in Tanzil %d:%d-%d' % (kind, tid, su, a1, a2))
        glyphs, pages, bold, ends = [], [], [], []
        for j in range(len(ks)):
            vk, i, _, n = seq[i0 + j]
            if shown[j][1]: bold.append(len(glyphs))
            glyphs.append(qwords[vk][i]); pages.append(A[vk]['page_number'])
            if i == n - 1:  # آخر كلمة في الآية: علامة الآية، كما في المصحف
                ends.append(len(glyphs)); glyphs.append(qwords[vk][-1]); pages.append(A[vk]['page_number'])
        page = pages[0]
        vk = '%d:%d' % (su, a1) + ('-%d' % a2 if a2 != a1 else '')
        entry = {'p': page, 'k': vk, 'i': i0, 'w': glyphs, 'e': ends, 'b': bold}
        if len(set(pages)) > 1: entry['wp'] = pages
        if kind == 'item':
            pv = []
            for ph in re.findall(r'«([^»]+)»', re.sub(r'<br>.*', '', desc)):
                pw = [skel(x) for x in ph.split() if not is_mark_token(x)]
                for n in range(len(pw), 0, -1):
                    sub = pw[:n]
                    if n == 1 and len(sub[0]) < 2: break
                    def same(k, w): k2 = k[1:] if k[:1] in 'وفبل' else k; return k == w or k2 == w or (len(w) >= 3 and any(x.startswith(w) and len(x) - len(w) <= 1 for x in (k, k2)))
                    hit = next((i for i in range(len(ks) - n + 1) if all(same(ks[i + j], w) for j, w in enumerate(sub))), None)
                    if hit is not None: pv += list(range(hit, hit + n)); break
            # مواضع الكلمات المعروضة → مواضعها في قائمة الرموز (علامات الآيات بينها)
            pos, g = [], 0
            for j in range(len(ks)):
                pos.append(g); g += 1
                if seq[i0 + j][1] == seq[i0 + j][3] - 1: g += 1
            entry['pv'] = sorted(set(pos[x] for x in pv))
        # في المنهج: الصفحة والرموز ومواضع علامات الآيات وهيكل الكلمات المعروضة (يتحقق به التطبيق أن النص لم يتغير بعد البناء).
        # الإبراز والحكم المحوري يحسبهما التطبيق من النص الحالي نفسه، فلا يُخزَّنان فيه.
        holder['qpc'] = {'p': page, 'w': glyphs, 'e': ends, 'k': ' '.join(ks)}
        if 'wp' in entry: holder['qpc']['wp'] = entry['wp']
        mapping[(kind + ':' if kind != 'q' else '') + tid] = entry
        for g, p in zip(glyphs, pages): used.setdefault(p, set()).update(g)

    os.makedirs(OUT, exist_ok=True)
    fonts = {}
    for page in sorted(used):
        src = os.path.join(fonts_dir, 'QCF2%03d.ttf' % page)
        raw = open(src, 'rb').read()
        f = TTFont(io.BytesIO(raw), recalcTimestamp=False)  # بناء قابل للتكرار: لا يتغير الناتج بتغير وقت البناء
        cmap = f.getBestCmap()
        miss = [hex(ord(c)) for c in used[page] if ord(c) not in cmap]
        if miss: sys.exit('page %d font lacks %s' % (page, miss))
        opts = subset.Options(); opts.flavor = 'woff'; opts.layout_features = ['*']; opts.name_IDs = ['*']; opts.notdef_outline = True
        opts.drop_tables = [t for t in opts.drop_tables if t not in ('FFTM',)]
        sub = subset.Subsetter(opts); sub.populate(unicodes=[ord(c) for c in used[page]]); sub.subset(f)
        buf = io.BytesIO(); f.flavor = 'woff'; f.save(buf); data = buf.getvalue()
        fonts[str(page)] = {'woff': base64.b64encode(data).decode(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                            'source_sha256': hashlib.sha256(raw).hexdigest(), 'codepoints': sorted(ord(c) for c in used[page])}
    meta = {'fonts_source': SRC_FONTS, 'glyphs_source': 'QPC V2 word-by-word glyphs (qpc-v2.json) and page numbers (qpc-v2-ayah-by-ayah-glyphs.json), uploaded by the owner 2026-11-14',
            'note': 'خطوط مجمع الملك فهد لطباعة المصحف الشريف، مقتطعة للرموز المستعملة فقط (fsType 8: يسمح بالتضمين والاقتطاع).'}
    json.dump({'meta': meta, 'verses': verses}, open(os.path.join(OUT, 'qpc_verses.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'meta': meta, 'fonts': fonts}, open(os.path.join(OUT, 'qpc_fonts.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'meta': meta, 'map': mapping}, open(os.path.join(OUT, 'qpc_map.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(CURR, 'w', encoding='utf-8').write(json.dumps(C, ensure_ascii=False, indent=1) + '\n')
    tot = sum(v['bytes'] for v in fonts.values())
    print('verses', len(verses), '| shown texts', len(mapping), '| pages', len(fonts), '| fonts total %.1f KB' % (tot / 1024))

if __name__ == '__main__':
    main()
