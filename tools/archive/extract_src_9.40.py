# -*- coding: utf-8 -*-
"""تشغيل مرة واحدة (9.40): نقل التطبيق والاستوديو من ملفات HTML المبنية إلى مصادر في src/.
بعده يُبنى كل شيء بـ tools/build.py، ويُطابَق الناتج بايتًا ببايت مع الملفات قبل النقل."""
import json, os, re, sys

A = 'app/تطبيق_الطالب_والمعلم_v9.39.html'
T = 'app/تجربة_المرحلة1_للهاتف_v9.39.html'
S = 'studio/استوديو_المشرف_v9.39.html'
CUR = 'curriculum/منهج_المرحلة1_كامل_معتمد_v1.3.json'

# حدود ملفات السكربت: رقم السطر (في ملف التطبيق) الذي يبدأ به كل ملف، واسمه
APP_JS = [
    (573, '000_boot.js'), (588, '010_pack.js'), (591, '020_state_core.js'),
    (688, '100_qx_core.js'), (813, '110_qx_ui.js'), (1037, '200_app_main.js'),
    (2188, '300_signing.js'), (2278, '310_supervisor_signing.js'), (2399, '320_consent.js'),
    (2404, '330_attr_gates.js'), (2412, '340_click_handlers.js'), (2483, '400_assessment.js'),
    (2691, '410_final_exam.js'), (2853, '420_family_memory.js'), (2889, '430_lesson_cards.js'),
    (2942, '440_quiz_nav.js'), (2974, '450_track.js'), (3050, '460_measure_mode.js'),
    (3080, '470_answer_log.js'), (3091, '480_resume.js'), (3249, '500_child_review.js'),
    (3300, '510_sheikh_audio.js'), (3988, '520_matn_verses.js'), (4040, '530_qpc.js'),
    (4177, '600_followup.js'), (5097, '700_lesson_quiz.js'), (5147, '710_backup.js'),
]
STUDIO_JS = [(259, '000_events.js'), (279, '010_curriculum.js'), (284, '100_studio_main.js'),
             (934, '200_template.js'), (962, '300_supervisor_key.js')]


def lines_of(p):
    return open(p, encoding='utf-8').read().split('\n')


def chunks(L, spec, end_line):
    out = []
    for k, (start, name) in enumerate(spec):
        stop = spec[k + 1][0] if k + 1 < len(spec) else end_line
        out.append((name, '\n'.join(L[start - 1:stop - 1]) + '\n'))
    return out


def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(s)


def main():
    L = lines_of(A)
    assert L[8] == '<style>' and L[297] == '</style>' and L[571] == '<script>' and L[5396] == '</script>'
    shell = '\n'.join(L[:9]) + '\n@@STYLE@@' + '\n'.join(L[297:572]) + '\n@@SCRIPT@@' + '\n'.join(L[5396:])
    shell = re.sub(r"script-src 'sha256-[^']+'", "script-src '@@SCRIPT_HASH@@'", shell, count=1)
    shell = re.sub(r"style-src 'sha256-[^']+'", "style-src '@@STYLE_HASH@@'", shell, count=1)
    write('src/app/shell.html', shell)
    css = '\n'.join(L[9:297]) + '\n'
    i = css.index('/* ===== QX: أنماط')
    main_css, qx_css = css[:i], css[i:]
    main_css, n = re.subn(r'/\* QPC_FONTS_BEGIN \*/.*?/\* QPC_FONTS_END \*/', '/* QPC_FONTS_BEGIN */@@QPC_FONTS@@/* QPC_FONTS_END */', main_css, flags=re.S)
    assert n == 1
    write('src/app/css/100_main.css', main_css)
    write('src/app/css/200_qx.css', qx_css)
    for name, text in chunks(L, APP_JS, 5397):
        text, _ = re.subn(r"var APP_VERSION = '[^']*';", "var APP_VERSION = '@@APP_VERSION@@';", text)
        text = re.sub(r'(var PACK_DATA = ).*?(;\n/\* ===PACK_DATA_END)', lambda m: m.group(1) + '@@PACK_DATA@@' + m.group(2), text, flags=re.S)
        text = re.sub(r'/\* QPC_PROBE_BEGIN \*/.*?/\* QPC_PROBE_END \*/', '/* QPC_PROBE_BEGIN */@@QPC_PROBE@@/* QPC_PROBE_END */', text, flags=re.S)
        write('src/app/js/' + name, text)
    # الحزمتان: كل ما في PACK_DATA إلا المنهج
    for p, name in ((A, 'app'), (T, 'trial')):
        s = open(p, encoding='utf-8').read()
        pk = json.loads(re.search(r'var PACK_DATA = (.*?);\n/\* ===PACK_DATA_END', s, re.S).group(1))
        cur = pk['curriculum']
        assert list(pk)[-1] == 'curriculum'
        meta = {k: v for k, v in pk.items() if k != 'curriculum'}
        write('src/app/packs/%s.json' % name, json.dumps(meta, ensure_ascii=False, indent=1) + '\n')
    # المنهج: المصدر الواحد = النسخة المضمنة (تختلف عن ملف المنهج في صياغة أبيات المتن فقط)
    C = json.load(open(CUR, encoding='utf-8'))
    C['sections'] = cur
    write(CUR, json.dumps(C, ensure_ascii=False, indent=1) + '\n')
    # الاستوديو
    L = lines_of(S)
    assert L[7] == '<style>' and L[122] == '</style>' and L[257] == '<script>' and L[1135] == '</script>'
    shell = '\n'.join(L[:8]) + '\n@@STYLE@@' + '\n'.join(L[122:258]) + '\n@@SCRIPT@@' + '\n'.join(L[1135:])
    shell = re.sub(r"script-src 'sha256-[^']+'", "script-src '@@SCRIPT_HASH@@'", shell, count=1)
    if "style-src 'sha256-" in shell:
        shell = re.sub(r"style-src 'sha256-[^']+'", "style-src '@@STYLE_HASH@@'", shell, count=1)
    write('src/studio/shell.html', shell)
    write('src/studio/css/100_studio.css', '\n'.join(L[8:122]) + '\n')
    for name, text in chunks(L, STUDIO_JS, 1136):
        text, _ = re.subn(r"var APP_VERSION = '[^']*';", "var APP_VERSION = '@@APP_VERSION@@';", text)
        text = re.sub(r'^(var CURRICULUM = ).*(;)$', lambda m: m.group(1) + '@@CURRICULUM@@' + m.group(2), text, flags=re.M)
        text = re.sub(r"(EMBEDDED_STUDENT_TEMPLATE_B64\s*=\s*')[A-Za-z0-9+/=]+(')", lambda m: m.group(1) + '@@APP_TEMPLATE_B64@@' + m.group(2), text)
        write('src/studio/js/' + name, text)
    v = re.search(r"var APP_VERSION = '([^']*)';", open(A, encoding='utf-8').read()).group(1)
    write('src/VERSION', v + '\n')
    print('extracted; version', v)


if __name__ == '__main__':
    main()
