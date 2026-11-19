#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""9.39.17: فاحص خط المصحف (QPC V2). تنفيذ مستقل عن أداة البناء tools/build_qpc.py.
التشغيل: python3 -I tools/verify_qpc.py   (يحتاج fontTools)
يفحص:
 1) التغطية: كل مهمة قرآنية (المرجع س:آ أو س:آ-آ في سطرها) وكل سؤال وصيغة سابقة مصدرها «… (نص تنزيل)» تحمل qpc، ولا qpc في غيرها.
 2) الصحة: كلمات النص المعروض (بلا الإبراز وعلامات الوقف المستقلة) متتالية في نص تنزيل للآية/الآيات،
    والرموز w هي رموز الكلمات نفسها في qpc_verses (عدد كلمات QPC = كلمات تنزيل + علامة الآية)،
    وبعد آخر كلمة في كل آية علامتها في موضعها e، والصفحة p/wp صفحة الآية، والهيكل k هيكل الكلمات المعروضة.
 3) الخطوط: لكل صفحة مستعملة خط واحد؛ بصمته مطابقة؛ يُقرأ WOFF؛ فيه كل رمز مستعمل في تلك الصفحة ولا رموز زائدة.
 4) النسخ: حقول qpc في نسختي التطبيق والاستوديو مطابقة للمصدر، وخطوط <style> ورمز الفحص لكل صفحة في التطبيق مطابقة لملف الخطوط.
يخرج بالرمز 0 إن نجح كل شيء."""
import base64, hashlib, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
CURR = 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'
TANZIL = 'curriculum/نص_القرآن_تنزيل_العثماني.json'
VERSES = 'curriculum/qpc/qpc_verses.json'
FONTS = 'curriculum/qpc/qpc_fonts.json'
APP = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
STUDIO = 'studio/استوديو_المشرف_v9.39.html'

ERR = []
def bad(msg): ERR.append(msg)

HARAKAT = set(chr(c) for c in list(range(0x0610, 0x061B)) + list(range(0x064B, 0x0660)) + [0x0670] + list(range(0x06D6, 0x06EE)) + [0x0640])
def skeleton(w): return ''.join('ا' if ch == 'ٱ' else ch for ch in w if ch not in HARAKAT)

def shown_words(text):
    """[(كلمة، مبرزة؟)] — بتحليل مستقل: الوسوم <b> فقط مقبولة، وتُحذف الأقواس المزخرفة وعلامات الوقف المستقلة"""
    out, bold = [], False
    for part in re.split(r'(</?b>)', text):
        if part == '<b>': bold = True; continue
        if part == '</b>': bold = False; continue
        if '<' in part or '>' in part: return None
        for w in part.replace('﴾', ' ').replace('﴿', ' ').split():
            if skeleton(w).strip(): out.append((w, bold))
    return out

def ref_of(holder, kind):
    if kind == 'item':
        if holder.get('type') != 'quran': return None
        m = re.search(r'(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?', holder.get('desc', ''))
        if not m: bad('item %s: no verse ref in desc' % holder.get('id')); return None
    else:
        if holder.get('_qtype') not in ('extraction', 'listen'): return None  # الآية في الاستخراج، والكلمة المقروءة في «اسمع وميّز»
        m = re.search(r'(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))? \(نص تنزيل\)', str(holder.get('source', '')))
        if not m: return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3) or m.group(2))

def holders(secs):
    for s in secs:
        for it in s.get('items') or []:
            yield ('item', s['id'], it['id']), 'item', it
        for key in ('questions', 'examQuestions'):
            for q in s.get(key) or []:
                yield (key, s['id'], q['id']), 'q', q
                if isinstance(q.get('prev'), dict):
                    yield (key + '.prev', s['id'], q['id']), 'prev', q['prev']

def main():
    from fontTools.ttLib import TTFont
    C = json.load(open(CURR, encoding='utf-8'))
    T = json.load(open(TANZIL, encoding='utf-8'))
    V = json.load(open(VERSES, encoding='utf-8'))['verses']
    F = json.load(open(FONTS, encoding='utf-8'))['fonts']
    used = {}
    n = 0
    qtype = {}
    for s in C['sections']:
        for k2 in ('questions', 'examQuestions'):
            for q in s.get(k2) or []:
                qtype[(k2, s['id'], q['id'])] = qtype[(k2 + '.prev', s['id'], q['id'])] = q.get('type')
    src = {}
    for key, kind, h in holders(C['sections']):
        src[key] = h
        ref = ref_of(dict(h, _qtype=qtype.get(key)), kind)
        qp = h.get('qpc')
        if ref is None:
            if qp is not None: bad('%s: qpc on a non-Uthmani text' % (key,))
            continue
        if qp is None: bad('%s: Uthmani text without qpc' % (key,)); continue
        n += 1
        su, a1, a2 = ref
        flat = []  # (مفتاح الآية، رقم الكلمة، هيكلها، عدد كلمات الآية في تنزيل)
        for ay in range(a1, a2 + 1):
            vk = '%d:%d' % (su, ay)
            if vk not in T or vk not in V: bad('%s: verse %s missing' % (key, vk)); break
            tz = [w for w in T[vk].split() if skeleton(w).strip()]
            if len(V[vk]['w']) != len(tz) + 1: bad('%s: %s QPC words %d != Tanzil %d + 1' % (key, vk, len(V[vk]['w']), len(tz)))
            flat += [(vk, i, skeleton(w), len(tz)) for i, w in enumerate(tz)]
        ws = shown_words(h.get('word', '') if qtype.get(key) == 'listen' else h.get('text', ''))
        if not ws: bad('%s: unparsable text' % (key,)); continue
        ks = [skeleton(w) for w, _ in ws]
        starts = [i for i in range(len(flat) - len(ks) + 1) if [x[2] for x in flat[i:i + len(ks)]] == ks]
        if len(starts) != 1: bad('%s: shown words found %d times in Tanzil %s' % (key, len(starts), ref)); continue
        w, e, pages = [], [], []
        for x in flat[starts[0]:starts[0] + len(ks)]:
            vk, i, _, cnt = x
            w.append(V[vk]['w'][i]); pages.append(V[vk]['p'])
            if i == cnt - 1: e.append(len(w)); w.append(V[vk]['w'][-1]); pages.append(V[vk]['p'])
        want = {'p': pages[0], 'w': w, 'e': e, 'k': ' '.join(ks)}
        if len(set(pages)) > 1: want['wp'] = pages
        if qp != want: bad('%s: qpc differs from recomputed %s' % (key, json.dumps(want, ensure_ascii=True)[:160]))
        for g, p in zip(w, pages): used.setdefault(str(p), set()).update(g)
    # 3) الخطوط
    if set(F) != set(used): bad('font pages %s != used pages %s' % (sorted(F, key=int), sorted(used, key=int)))
    for p, f in F.items():
        data = base64.b64decode(f['woff'])
        if hashlib.sha256(data).hexdigest() != f['sha256'] or len(data) != f['bytes']: bad('font %s: hash/size mismatch' % p)
        font = TTFont(io.BytesIO(data))
        if font.flavor != 'woff': bad('font %s: not WOFF' % p)
        cmap = set(font.getBestCmap())
        need = set(ord(c) for c in used.get(p, ()))
        if need - cmap: bad('font %s lacks %s' % (p, sorted(hex(c) for c in need - cmap)))
        if sorted(need) != f['codepoints']: bad('font %s: codepoints list != used' % p)
        if not all(0xFB50 <= c <= 0xFDFF for c in cmap): bad('font %s: codepoint outside U+FB50..FDFF' % p)
    # 4) النسخ
    RX = re.compile(r'var PACK_DATA = (.*?);\n/\* ===PACK_DATA_END', re.S)
    css = ''.join("@font-face{font-family:qpc%s;src:url(data:font/woff;base64,%s) format('woff');font-display:block}.qp%s{font-family:qpc%s}"
                  % (p, f['woff'], p, p) for p, f in sorted(F.items(), key=lambda x: int(x[0])))
    probe = json.dumps({p: chr(f['codepoints'][0]) for p, f in sorted(F.items(), key=lambda x: int(x[0]))}, ensure_ascii=True)
    copies = []
    for f in APP:
        s = open(f, encoding='utf-8').read()
        copies.append((f, json.loads(RX.search(s).group(1))['curriculum']))
        if s.count('/* QPC_FONTS_BEGIN */' + css + '/* QPC_FONTS_END */') != 1: bad('%s: embedded fonts differ from %s' % (f, FONTS))
        if s.count('/* QPC_PROBE_BEGIN */' + probe + '/* QPC_PROBE_END */') != 1: bad('%s: font probe differs' % f)
    s = open(STUDIO, encoding='utf-8').read()
    copies.append((STUDIO, json.loads(re.search(r'^var CURRICULUM = (.*);$', s, re.M).group(1))))
    for f, secs in copies:
        m = 0
        for key, kind, h in holders(secs):
            sh = src.get(key)
            if sh is None: continue
            if h.get('qpc') != sh.get('qpc'): bad('%s %s: qpc differs from source' % (f, key))
            elif 'qpc' in h: m += 1
        if m != n: bad('%s: %d qpc fields, source has %d' % (f, m, n))
    tot = sum(f['bytes'] for f in F.values())
    print('QPC: %d texts | %d pages | fonts %.1f KB' % (n, len(F), tot / 1024))
    if ERR:
        for e in ERR[:40]: print('FAIL', e)
        sys.exit(1)
    print('OK')

if __name__ == '__main__':
    main()
