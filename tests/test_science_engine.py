# -*- coding: utf-8 -*-
"""اختبارات محرك الأحكام في tools/verify_science.py: كلمات معروفة الحكم، ثم «طفرات» في نسخة من المنهج
يجب أن يكتشفها الفاحص (جواب خاطئ، خيار ثانٍ صحيح، كلمة في سلة خطأ، صيد بلا تعليم).
التشغيل: python3 -I tests/test_science_engine.py"""
import copy, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOL = os.path.join(ROOT, 'tools', 'verify_science.py')
CUR = os.path.join(ROOT, 'curriculum', 'منهج_المرحلة1_كامل_معتمد_v1.3.json')
G = {'__name__': 'engine'}                     # يُحمَّل دون تشغيل main()
exec(compile(open(TOOL, encoding='utf-8').read(), TOOL, 'exec'), G)
rules_in = G['rules_in']

R = []
def ok(name, cond, info=''):
    R.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + str(info)))

def tags(phrase, idx=0, waqf=False):
    ws = phrase.split()
    return rules_in(ws, idx, waqf_last=waqf)

# أحكام النون الساكنة والتنوين (عثماني تنزيل وإملائي)
ok('E1 izhar أنعمت', 'n_izhar' in tags('أَنْعَمْتَ عَلَيْهِمْ'))
ok('E2 idgham bighunna مِّن مَّسَدٍ', 'n_idg_g' in tags('حَبْلٌۭ مِّن مَّسَدٍۭ', 1))
ok('E3 idgham bila ghunna يكن له', 'n_idg_ng' in tags('يَكُن لَّهُۥ'))
ok('E4 iqlab لينبذن', 'n_iqlab' in tags('لَيُنۢبَذَنَّ'))
ok('E5 ikhfa من شر', 'n_ikhfa' in tags('مِن شَرِّ'))
ok('E6 izhar mutlaq دنيا', 'n_izhar_mutlaq' in tags('دُنْيَا') and 'n_idg_g' not in tags('دُنْيَا'))
ok('E7 tanween before alif wasla: no rule', not (tags('خَيْرٌ ٱلْيَوْمَ') & {'n_izhar', 'n_idg_g', 'n_ikhfa'}))
# الميم الساكنة
ok('E8 ikhfa shafawi ترميهم بحجارة', 'm_ikhfa' in tags('تَرْمِيهِم بِحِجَارَةٍۢ'))
ok('E9 izhar shafawi ألم تر', 'm_izhar' in tags('أَلَمْ تَرَ'))
ok('E10 idgham mithlain أطعمهم من', {'m_idgham', 'mith_s'} <= tags('أَطْعَمَهُم مِّن'))
# اللام
ok('E11 lam qamari الكوثر', 'l_qamari' in tags('ٱلْكَوْثَرَ'))
ok('E12 lam shamsi الصمد', 'l_shamsi' in tags('ٱلصَّمَدُ'))
ok('E13 lam qamari الجنة (with ghunna)', {'l_qamari', 'ghunna'} <= tags('ٱلْجِنَّةِ'))
# المدود
ok('E14 muttasil جاء', 'd_muttasil' in tags('جَآءَ'))
ok('E15 munfasil إنا أعطيناك', 'd_munfasil' in tags('إِنَّآ أَعْطَيْنَـٰكَ'))
ok('E16 munfasil (يا النداء) يا أيها', 'd_munfasil' in tags('يَٰٓأَيُّهَا') and 'd_muttasil' not in tags('يَٰٓأَيُّهَا'))
ok('E17 badal + tabii in آمنوا', {'d_badal', 'd_tabii'} <= tags('ءَامَنُوا۟ وَعَمِلُوا۟'))
ok('E18 badal only آنية', tags('ءَانِيَةٍ') & G['MADD'] == {'d_badal'})
ok('E19 lazim kalimi muthaqqal الضالين', 'd_lazim_km' in tags('ٱلضَّآلِّينَ', 0, True))
ok('E20 arid at waqf العالمين', 'd_arid' in tags('ٱلْعَـٰلَمِينَ', 0, True))
ok('E21 leen at waqf البيت', 'd_leen' in tags('هَـٰذَا ٱلْبَيْتِ', 1, True))
ok('E22 iwad at waqf أفواجا', 'd_iwad' in tags('ٱللَّهِ أَفْوَاجًۭا', 1, True))
ok('E23 no iwad on ta marbuta', 'd_iwad' not in tags('رَاضِيَةًۭ', 0, True))
ok('E24 sila sughra ماله و', 'd_sila_s' in tags('مَالُهُۥ وَمَا'))
ok('E25 sila kubra ماله أخلده', 'd_sila_k' in tags('مَالَهُۥٓ أَخْلَدَهُۥ'))
ok('E26 imla\'i sila kubra يره أحد', 'd_sila_k' in tags('يَرَهُ أَحَدٌ'))
ok('E27 no sila at waqf', not (tags('يَرَهُ', 0, True) & {'d_sila_s', 'd_sila_k'}))
ok('E28 alif of أل is not madd والصيف', 'd_tabii' not in tags('وَالصَّيْفِ', 0, True))
ok('E29 madd dropped before wasla فأما اليتيم', 'd_tabii' not in tags('فَأَمَّا ٱلْيَتِيمَ'))
ok('E30 tatweel+dagger alif أصحاب', 'd_tabii' in tags('بِأَصْحَـٰبِ'))
ok('E31 unvocalized shamsi النور / qamari القمر', 'l_shamsi' in tags('النور') and 'l_qamari' in tags('القمر') and 'l_shamsi' not in tags('القمر'))

# الفاحص كاملًا: المنهج الحالي نظيف، والطفرات تُكتشف
def run(cur):
    fd, path = tempfile.mkstemp(suffix='.json'); os.close(fd)
    json.dump(cur, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
    p = subprocess.run([sys.executable, '-I', TOOL, path], capture_output=True, text=True, cwd=ROOT)
    os.unlink(path)
    return p.returncode, p.stdout

C = json.load(open(CUR, encoding='utf-8'))
code, out = run(C)
ok('V1 curriculum passes', code == 0, out[-400:])
def Q(c, qid): return next(q for s in c['sections'] for q in s['questions'] + s.get('examQuestions', []) if q['id'] == qid)

m = copy.deepcopy(C); Q(m, 'x4_1')['answer'] = 0                     # إظهار بدل إقلاب
code, out = run(m); ok('V2 wrong answer caught', code == 1 and 'x4_1' in out, out[-300:])
m = copy.deepcopy(C); Q(m, 'x9_1')['options'][2] = 'مد طبيعي'         # الخيار المحذوف يعود
code, out = run(m); ok('V3 second correct option caught', code == 1 and 'x9_1' in out, out[-300:])
m = copy.deepcopy(C); q = Q(m, 'i9_2'); q['items']['بدل'].append('ٱلنَّاسَ')
code, out = run(m); ok('V4 classify wrong bucket caught', code == 1 and 'i9_2' in out, out[-300:])
m = copy.deepcopy(C); q = Q(m, 'i4_1'); q['ayah'] = q['ayah'].replace('[[', '').replace(']]', '')
code, out = run(m); ok('V5 hunt unmarked target caught', code == 1 and 'i4_1' in out, out[-300:])
m = copy.deepcopy(C); q = Q(m, 'i5_2'); q['ayah'] = q['ayah'].replace('[[غَاسِقٍ|إظهار]]', '[[غَاسِقٍ|إخفاء]]')
code, out = run(m); ok('V6 paint wrong rule caught', code == 1 and 'i5_2' in out, out[-300:])
m = copy.deepcopy(C); Q(m, 'L5_1')['rule'] = 'إقلاب'
code, out = run(m); ok('V7 listen wrong rule caught', code == 1 and 'L5_1' in out, out[-300:])

passed = sum(1 for _, c in R if c); print('\nSUMMARY: %d / %d' % (passed, len(R)))
sys.exit(0 if passed == len(R) else 1)
