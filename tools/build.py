#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""يبني التطبيق ونسخة التجربة والاستوديو من المصادر. هذا هو الطريق الوحيد لتغيير ملفات HTML.

المصادر:
  src/VERSION                      رقم الإصدار (يضبطه tools/set_version.py)
  src/app/shell.html               هيكل الصفحة وفيه @@STYLE@@ و@@SCRIPT@@ و@@SCRIPT_HASH@@ و@@STYLE_HASH@@
  src/app/css/*.css                الأنماط بترتيب أسماء الملفات (فيها @@QPC_FONTS@@)
  src/shared/*.js                  مشترك بين التطبيق والاستوديو (نواة أنواع الأسئلة QX)، يدخل بترتيب اسمه
  src/app/js/*.js                  السكربت بترتيب أسماء الملفات (فيه @@APP_VERSION@@ و@@PACK_DATA@@ و@@QPC_PROBE@@ و@@RATING_CRITERIA@@)
  src/app/packs/app.json|trial.json  بيانات الحزمة دون المنهج
  src/studio/...                   مثلها، وفيها @@CURRICULUM@@ و@@APP_TEMPLATE_B64@@
  curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json   المنهج (المصدر الوحيد)
  curriculum/qpc/qpc_fonts.json             خطوط المصحف المقتطعة
  curriculum/rating_criteria.json   معايير تقييم التلاوة (المصدر الوحيد؛ منها أيضًا docs/TEACHER_RUBRIC.md)
ويرفض البناء أي دالة عُرّفت مرتين في المستوى الأعلى من سكربت واحد، فلا تعود «طبقات الاستبدال»،
وأي دالة في المستوى الأعلى كُتبت تعبيرًا (var f = function / const f = () =>) لأنها لا تُرفع فيكسر كود التحميل.
المخرجات: app/تطبيق_الطالب_والمعلم_v9.39.html، app/تجربة_المرحلة1_للهاتف_v9.39.html، studio/استوديو_المشرف_v9.39.html
الاستعمال:  python3 -I tools/build.py          يبني ويكتب
            python3 -I tools/build.py --check  يتحقق أن الملفات المحفوظة مطابقة للمصادر (في CI)"""
import base64, glob, hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUR = 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'
FONTS = 'curriculum/qpc/qpc_fonts.json'
RATING = 'curriculum/rating_criteria.json'
OUT_APP = 'app/تطبيق_الطالب_والمعلم_v9.39.html'
OUT_TRIAL = 'app/تجربة_المرحلة1_للهاتف_v9.39.html'
OUT_STUDIO = 'studio/استوديو_المشرف_v9.39.html'


def rd(p):
    return open(os.path.join(ROOT, p), encoding='utf-8').read()


def cat(*patterns):
    # ملفات عدة أنماط بترتيب أسمائها معًا (المشترك في src/shared يدخل في موضعه من الترتيب)
    files = sorted((f for pat in patterns for f in glob.glob(os.path.join(ROOT, pat))), key=os.path.basename)
    if not files: sys.exit('no files: %s' % (patterns,))
    return ''.join(open(f, encoding='utf-8').read() for f in files)


def sha(s):
    return 'sha256-' + base64.b64encode(hashlib.sha256(s.encode('utf-8')).digest()).decode()


def fill(text, **kv):
    for k, v in kv.items():
        tok = '@@%s@@' % k
        if text.count(tok) != 1: sys.exit('placeholder %s found %d times' % (tok, text.count(tok)))
        text = text.replace(tok, v)
    return text


TOP_FN = re.compile(r'^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', re.M)


TOP_FN_EXPR = re.compile(r'^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^)\n]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)', re.M)


def no_duplicates(js, label):
    # تعريف واحد لكل دالة في المستوى الأعلى: التعريف الثاني يُخفي الأول بصمت
    seen, dup = set(), []
    for name in TOP_FN.findall(js):
        if name in seen: dup.append(name)
        seen.add(name)
    if dup: sys.exit('%s: functions defined more than once: %s' % (label, ', '.join(sorted(set(dup)))))
    # 9.41.2: الدوال في المستوى الأعلى تعريفات (function name)، لا تعابير مسندة إلى متغير؛ فكود التحميل في وحدة مبكرة
    # يستدعي دالة وحدة لاحقة لأن التعريفات تُرفع إلى أول السكربت، والتعبير لا يُرفع فيكسر الإقلاع.
    expr = TOP_FN_EXPR.findall(js)
    if expr: sys.exit('%s: top-level functions must be declarations, not expressions: %s' % (label, ', '.join(sorted(set(expr)))))


def page(shell, style, script):
    h = fill(shell, STYLE=style, SCRIPT=script)
    # البصمة على النص الكامل بين الوسمين، كما يحسبها المتصفح
    sc = re.findall(r'<script>(.*?)</script>', h, re.S); st = re.findall(r'<style>(.*?)</style>', h, re.S)
    if len(sc) != 1 or len(st) != 1: sys.exit('expected one <script> and one <style>')
    h = fill(h, SCRIPT_HASH=sha(sc[0]))
    if '@@STYLE_HASH@@' in h: h = fill(h, STYLE_HASH=sha(st[0]))
    return h


def build():
    version = rd('src/VERSION').strip()
    sections = json.loads(rd(CUR))['sections']
    F = json.loads(rd(FONTS))['fonts']
    pages = sorted(F, key=int)
    fonts_css = ''.join("@font-face{font-family:qpc%s;src:url(data:font/woff;base64,%s) format('woff');font-display:block}.qp%s{font-family:qpc%s}"
                        % (p, F[p]['woff'], p, p) for p in pages)
    probe = json.dumps({p: chr(F[p]['codepoints'][0]) for p in pages}, ensure_ascii=True)
    style = fill(cat('src/app/css/*.css'), QPC_FONTS=fonts_css)
    js = cat('src/shared/*.js', 'src/app/js/*.js')
    no_duplicates(js, 'app')
    rating = json.loads(rd(RATING)); rating.pop('meta', None)
    js = fill(js, RATING_CRITERIA=json.dumps(rating, ensure_ascii=False, separators=(',', ':')))
    shell = rd('src/app/shell.html')
    out = {}
    for name, path in (('app', OUT_APP), ('trial', OUT_TRIAL)):
        pk = json.loads(rd('src/app/packs/%s.json' % name))
        pk['curriculum'] = sections
        script = fill(js, APP_VERSION=version, PACK_DATA=json.dumps(pk, ensure_ascii=False), QPC_PROBE=probe)
        out[path] = page(shell, style, script)
    sjs = cat('src/shared/*.js', 'src/studio/js/*.js')
    no_duplicates(sjs, 'studio')
    sjs = fill(sjs, APP_VERSION=version, CURRICULUM=json.dumps(sections, ensure_ascii=False),
               APP_TEMPLATE_B64=base64.b64encode(out[OUT_APP].encode('utf-8')).decode())
    out[OUT_STUDIO] = page(rd('src/studio/shell.html'), cat('src/studio/css/*.css'), sjs)
    return out


def main():
    check = '--check' in sys.argv[1:]
    out = build()
    bad, wrote = [], 0
    for path, html in out.items():
        full = os.path.join(ROOT, path)
        cur = open(full, encoding='utf-8').read() if os.path.exists(full) else None
        if cur == html: continue
        if check: bad.append(path)
        else:
            open(full, 'w', encoding='utf-8').write(html); wrote += 1; print('wrote', path, len(html.encode('utf-8')))
    if check:
        if bad:
            print('OUT OF DATE (run python3 -I tools/build.py):', *bad, sep='\n  '); sys.exit(1)
        print('build up to date')
    elif not wrote:
        print('build up to date (no changes)')


if __name__ == '__main__':
    main()
