"""فاحص الأسئلة القرآنية قبل الاستيراد:
1) كل نص قرآني في المنهج يطابق نص تنزيل حرفيًا (بعد إزالة الإبراز والحروف الزائدة).
2) في أسئلة الاستخراج التي تحمل حكم النون الساكنة/التنوين: الحكم المكتوب يطابق القاعدة الحرفية.
3) الكلمة المظللة موجودة فعلًا في الآية.
"""
import json,re,sys,unicodedata
TANZIL=sys.argv[1]; CURR=sys.argv[2]
T=json.load(open(TANZIL,encoding='utf8'))
S=json.load(open(CURR,encoding='utf8'))
S=S['sections'] if isinstance(S,dict) else S
ANN=re.compile(r'[\u06D6-\u06ED\u0640]')
def clean(t):
    t=re.sub(r'<[^>]+>','',t); t=re.sub(r'[﴿﴾\[\]]','',t)
    return unicodedata.normalize('NFC',re.sub(r'\s+',' ',ANN.sub('',unicodedata.normalize('NFC',t)))).strip()
def skel(t): return re.sub(r'[\u064B-\u065F\u0670\u0654\u0655\s]','',clean(t)).replace('ئ','ي').replace('ؤ','و').replace('أ','ا').replace('إ','ا').replace('آ','ا').replace('ٱ','ا')
def skel_imlai(t): return re.sub(r'[اءٱ]','',skel(re.sub('\u0649\u0670(?=[\u0621-\u064A])','ا',t))).replace('ى','ي')  # «ىٰ» وسط الكلمة ألف
HALQ=set('ءهعحغخ'); G=set('ينمو'); N=set('لر'); Q=set('ب'); K=set('صذثكجشقسدطزفتضظ')
def rule(l):
    l={'أ':'ء','إ':'ء','ؤ':'ء','ئ':'ء','آ':'ء'}.get(l,l)
    return 'الإظهار' if l in HALQ else 'الإدغام بغنة' if l in G else 'الإدغام بلا غنة' if l in N else 'الإقلاب' if l in Q else 'الإخفاء' if l in K else None
errs=[]; checked=0
for s in S:
    for q in s.get('questions',[]):
        if q.get('type')!='extraction': continue
        checked+=1
        txt=q.get('text','')
        m=re.search(r'<b>(.*?)</b>',txt)
        if not m: errs.append((q['id'],'no highlighted word')); continue
        word=clean(m.group(1))
        plain=clean(txt)
        if word and word not in plain: errs.append((q['id'],'highlight not in ayah'))
        src=q.get('source','')
        mm=re.search(r'(\d+):(\d+)',src)
        if mm:
            ref=T.get(f'{mm.group(1)}:{mm.group(2)}','')
            if '(رسم إملائي' in src:  # 9.39.13: النص الإملائي يُقابل بهيكله الحرفي (صور الألف والهمزة تختلف بين الرسمين)
                if skel_imlai(plain) not in skel_imlai(ref): errs.append((q['id'],'imla\'i text does not match Tanzil skeleton'))
            elif skel(plain) not in skel(ref): errs.append((q['id'],'ayah text not identical to Tanzil'))
        if q['id'].startswith('ex_'):
            words=plain.split(' ')
            idx=[i for i,w in enumerate(words) if word and word in w]
            if idx and idx[0]+1 < len(words):
                nxt=re.search(r'[\u0621-\u064A]', ANN.sub('',words[idx[0]+1]))
                expect=rule(nxt.group(0)) if nxt else None
                got=q['options'][q['answer']]
                if expect and expect!=got: errs.append((q['id'],f'rule mismatch: expected {expect} got {got}'))
# 9.39.12 (I1): السؤال الذي يحيل إلى «الكلمة الملوّنة» يحوي إبرازًا واحدًا بالضبط (اثنين لـ«الكلمتين»)، ولا تبقى «الغامقة»
for s in S:
    for q in s.get('questions',[]) + s.get('examQuestions',[]):
        qt = q.get('question','') or ''
        if 'الغامق' in qt: errs.append((q['id'],'wording: الغامقة'))
        if 'الملوّن' in qt:
            hl = re.findall(r'<b>(.*?)</b>', q.get('text',''))
            want = 2 if 'الكلمتين' in qt else 1
            nw = sum(len(h.split()) for h in hl) if 'الكلم' in qt else len(hl)
            if not hl or nw != want: errs.append((q['id'], f'highlighted: {nw} (want {want})'))
print('checked extraction questions:',checked)
print('problems:',len(errs))
for e in errs[:30]: print(e)
