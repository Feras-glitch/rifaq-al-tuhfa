import json, re

def fix_sections(secs):
    changed = []
    def walk(obj, fn):
        for sec in secs:
            for x in (sec.get('items') or []) + (sec.get('questions') or []):
                fn(sec, x)
    def f(sec, x):
        i = x.get('id')
        if i == 'q_mut_1':
            x.clear()
            x.update({
                "id": "q_mut_1", "type": "true_false",
                "text": "ذكر الناظم في الأبيات 31–32 تعريف المتقاربين، ولم يذكر في المتن حكم إدغامهما.",
                "answer": True,
                "explanation": "المتن يعرّف المتقاربين فقط: «وَإِنْ يَكُونَا مَخْرَجًا تَقَارَبَا وَفِي الصِّفَاتِ اخْتَلَفَا يُلَقَّبَا مُتَقَارِبَيْنِ». أما حكم إدغامهما في رواية حفص (مثل «قُل رَّبِّ») فيُدرس في المرحلة الثانية.",
                "points": 10
            })
            changed.append('q_mut_1')
        elif i == 's13_khatima_matn':
            old = x['desc']
            x['desc'] = re.sub(r'قال: <b>«أبياتُه نَدٌّ»</b>\..*?\(بيت 59\)\.',
                'قال: <b>«أبياتُه نَدٌّ»</b>. و«ندّ» بحساب الجُمَّل: ن (٥٠) + د (٤) = <b>٥٤</b> بيتًا، وهي أبيات الناظم الأصلية؛ والنسخة المتداولة التي ندرسها <b>٦١</b> بيتًا لأن سبعة أبيات (المثلان والمتقاربان والمتجانسان ولام الفعل وغيرها) أُلحقت بها (بيت 59).', old)
            assert x['desc'] != old, 'khatima desc not matched'
            changed.append('s13 desc')
        elif i == 'q13_2':
            x['text'] = 'عدد أبيات التحفة في النسخة المتداولة التي ندرسها:'
            x['explanation'] = 'النسخة المتداولة ٦١ بيتًا. أما قول الناظم «أَبْيَاتُهُ نَدٌّ» فيساوي بحساب الجُمَّل ٥٤ (ن ٥٠ + د ٤)، وهي الأبيات الأصلية قبل الأبيات الملحقة.'
            changed.append('q13_2')
        elif i == 'ex_iqlab_2':
            x['explanation'] = x['explanation'].replace('سورة 77، الآية 50', 'سورة المرسلات، الآية 50')
            x['source'] = 'المرسلات 77:50 (نص تنزيل)'
            changed.append('ex_iqlab_2')
        elif i == 'rec_lamfil_1':
            x['desc'] = x['desc'].replace('(الصافات 37:18 · ص)', '(الصافات 37:18 · ص446)').replace('فأظهر اللام', '{فأظهر|فأظهري} اللام')
            changed.append('rec_lamfil_1')
        elif i == 'r2_1':
            x['desc'] = x['desc'].replace('أَظهِر النون', '{أَظهِر|أَظهِري} النون'); changed.append('r2_1')
        elif i == 's6_ghunna_matn':
            x['desc'] = x['desc'].replace('فأطِل الغنة', '{فأطِل|فأطيلي} الغنة'); changed.append('s6 desc')
        elif i == 'r11_1':
            x['desc'] = x['desc'].replace('وقِف على', '{وقِف|وقِفي} على'); changed.append('r11_1')
    walk(secs, f)
    return changed

# 1) approved JSON
cur = json.load(open('curriculum.json', encoding='utf-8'))
ch = fix_sections(cur['sections']); print('json:', ch)
cur['meta']['version'] = '1.3'
cur['meta']['fixes_9_39'] = 'حذف نسبة ملفّقة للمتن في q_mut_1 وإعادة بنائه؛ تصحيح حساب ندّ (54) في الخاتمة وq13_2؛ اسم سورة المرسلات؛ صفحة الصافات؛ أربع صيغ تأنيث في المهام.'
json.dump(cur, open('curriculum.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# 2) embedded in app / mobile (PACK_DATA) and studio (CURRICULUM)
def patch_embedded(path, start_marker, end_marker):
    s = open(path, encoding='utf-8').read()
    a = s.index(start_marker) + len(start_marker)
    b = s.index(end_marker, a)
    data = json.loads(s[a:b])
    secs = data['curriculum'] if isinstance(data, dict) else data
    ch = fix_sections(secs); print(path, ch)
    if isinstance(data, dict): data['appVersion'] = '9.39'
    out = json.dumps(data, ensure_ascii=False)
    s = s[:a] + out + s[b:]
    open(path, 'w', encoding='utf-8').write(s)

patch_embedded('app.html', 'var PACK_DATA = ', ';\n/* ===PACK_DATA_END=== */')
patch_embedded('mobile.html', 'var PACK_DATA = ', ';\n/* ===PACK_DATA_END=== */')
# studio: CURRICULUM = [...];  find end by bracket matching
s = open('studio.html', encoding='utf-8').read()
a = s.index('var CURRICULUM = ') + len('var CURRICULUM = ')
depth = 0
for k in range(a, len(s)):
    c = s[k]
    if c == '[': depth += 1
    elif c == ']':
        depth -= 1
        if depth == 0: b = k + 1; break
secs = json.loads(s[a:b]); ch = fix_sections(secs); print('studio', ch)
s = s[:a] + json.dumps(secs, ensure_ascii=False) + s[b:]
open('studio.html', 'w', encoding='utf-8').write(s)
