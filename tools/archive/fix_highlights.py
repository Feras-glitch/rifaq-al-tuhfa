import json,re,unicodedata,sys
T=json.load(open(sys.argv[1],encoding='utf8'))
SRC=sys.argv[2]; OUT=sys.argv[3]
d=json.load(open(SRC,encoding='utf8'))
def skel(t): return re.sub(r'[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\s]','',unicodedata.normalize('NFC',t)).replace('\u0671','\u0627')
MAP={ # question id: (ayah ref, phrase as in the lesson)
 'x2_1':('1:7','أَنْعَمْتَ'),
 'x3_1':('112:4','يَكُن لَّهُۥ'),
 'x3_2':('111:5','مِّن مَّسَدٍ'),
 'x4_1':('104:4','لَيُنۢبَذَنَّ'),
 'x5_1':('113:2','مِن شَرِّ'),
 'x5_2':('106:4','مِّن جُوعٍ'),
 'x6_1':('114:6','ٱلْجِنَّةِ'),
 'x7_1':('105:4','تَرْمِيهِم بِحِجَارَةٍ'),
 'x7_2':('105:1','أَلَمْ تَرَ'),
 'x8_1':('108:1','ٱلْكَوْثَرَ'),
 'x8_2':('112:2','ٱلصَّمَدُ'),
 'x10_1':('110:1','جَآءَ'),
 'x11_1':('106:3','ٱلْبَيْتِ'),
 'x11_2':('111:2','مَالُهُۥ'),
 'x12_1':('1:7','ٱلضَّآلِّينَ'),
 'x7_3':('106:4','أَطْعَمَهُم'),
 'x8b_1':('106:4','أَطْعَمَهُم مِّن'),
 'x8_3':('108:3','ٱلْأَبْتَرُ'),
 'x9_1':('103:3','ءَامَنُوا'),
 'x10_2':('108:1','إِنَّآ'),
}
def bold(ayah, phrase):
    words=ayah.split(' ')
    target=skel(phrase).split() if False else None
    pw=phrase.split(' ')
    for i in range(len(words)-len(pw)+1):
        if all(skel(words[i+j])==skel(pw[j]) for j in range(len(pw))):
            words[i:i+len(pw)]=['<b>'+' '.join(words[i:i+len(pw)])+'</b>']
            return ' '.join(words), True
    return ayah, False
fixed=[]; failed=[]
for s in d['sections']:
    for q in s['questions']:
        if q['id']=='ex_ikhfa_3':
            new,ok=bold(T['82:19'],'لِّنَفْسٍ')
            if ok: q['text']='﴿'+new+'﴾'; q['source']='الانفطار 82:19 (نص تنزيل)'; fixed.append(q['id'])
            else: failed.append(('ex_ikhfa_3','82:19'))
        if q['id'] in MAP:
            ref,phrase=MAP[q['id']]
            ayah=T[ref]
            new,ok=bold(ayah,phrase)
            if not ok: failed.append((q['id'],ref,phrase)); continue
            q['text']='﴿'+new+'﴾'
            q['source']=f"{ref} (نص تنزيل)"
            fixed.append(q['id'])
json.dump(d,open(OUT,'w',encoding='utf8'),ensure_ascii=False,indent=1)
print('fixed',len(fixed),'failed',failed)
