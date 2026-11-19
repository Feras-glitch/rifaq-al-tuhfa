# -*- coding: utf-8 -*-
"""9.39.17: ينسخ حقول qpc (خط المصحف) من المنهج المصدر إلى نسختي التطبيق (PACK_DATA) ونسخة الاستوديو (CURRICULUM).
المطابقة بمعرّف القسم والمهمة/السؤال، ويُشترط أن يكون النص في النسخة مطابقًا للمصدر (وإلا يتوقف).
المصدر يُبنى بـ tools/build_qpc_9.39.17.py. قابل لإعادة التشغيل."""
import json, re, sys

SRC = 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'
APP = ['app/تطبيق_الطالب_والمعلم_v9.39.html', 'app/تجربة_المرحلة1_للهاتف_v9.39.html']
STUDIO = 'studio/استوديو_المشرف_v9.39.html'


def holders(secs):
    for s in secs:
        for it in s.get('items') or []:
            yield (s['id'], 'item', it['id']), it
        for key in ('questions', 'examQuestions'):
            for q in s.get(key) or []:
                yield (s['id'], key, q['id']), q
                if isinstance(q.get('prev'), dict):
                    yield (s['id'], key + '.prev', q['id']), q['prev']


def apply(secs, src, where):
    n = 0
    for k, h in holders(secs):
        sh = src.get(k)
        if sh is None:
            continue
        if 'qpc' in sh:
            if h.get('text') != sh.get('text'):
                sys.exit('%s %s: text differs from source; refusing to attach qpc' % (where, k))
            if h.get('qpc') != sh['qpc']:
                h['qpc'] = sh['qpc']; n += 1
        elif 'qpc' in h:
            del h['qpc']; n += 1
    return n


def main():
    S = json.load(open(SRC, encoding='utf-8'))
    src = dict(holders(S['sections']))
    total = sum(1 for h in src.values() if 'qpc' in h)
    RX = re.compile(r'(var PACK_DATA = )(.*?)(;\n/\* ===PACK_DATA_END)', re.S)
    for f in APP:
        s = open(f, encoding='utf-8').read(); m = RX.search(s)
        pk = json.loads(m.group(2)); assert json.dumps(pk, ensure_ascii=False) == m.group(2)
        n = apply(pk['curriculum'], src, f)
        open(f, 'w', encoding='utf-8').write(s[:m.start(2)] + json.dumps(pk, ensure_ascii=False) + s[m.end(2):])
        print(f, 'changed', n, 'with qpc', sum(1 for _, h in holders(pk['curriculum']) if 'qpc' in h), '/', total)
    s = open(STUDIO, encoding='utf-8').read()
    m = re.search(r'^(var CURRICULUM = )(.*)(;)$', s, re.M)
    cur = json.loads(m.group(2)); assert json.dumps(cur, ensure_ascii=False) == m.group(2)
    n = apply(cur, src, STUDIO)
    open(STUDIO, 'w', encoding='utf-8').write(s[:m.start(2)] + json.dumps(cur, ensure_ascii=False) + s[m.end(2):])
    print(STUDIO, 'changed', n, 'with qpc', sum(1 for _, h in holders(cur) if 'qpc' in h), '/', total)


if __name__ == '__main__':
    main()
