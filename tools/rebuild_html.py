import re,hashlib,base64
def set_csp(p):
    s=open(p,encoding='utf-8').read()
    sc=re.findall(r'<script>(.*?)</script>',s,re.S); assert len(sc)==1
    h=base64.b64encode(hashlib.sha256(sc[0].encode()).digest()).decode()
    s=re.sub(r"script-src 'sha256-[^']+'","script-src 'sha256-"+h+"'",s,count=1)
    st=re.findall(r'<style>(.*?)</style>',s,re.S)
    if len(st)==1 and re.search(r"style-src 'sha256-",s):  # 9.39.10: تجزئة الأنماط أيضًا (بعد أي تعديل في CSS)
        hs=base64.b64encode(hashlib.sha256(st[0].encode()).digest()).decode()
        s=re.sub(r"style-src 'sha256-[^']+'","style-src 'sha256-"+hs+"'",s,count=1)
    open(p,'w',encoding='utf-8').write(s); return s
A='app/تطبيق_الطالب_والمعلم_v9.39.html'; M='app/تجربة_المرحلة1_للهاتف_v9.39.html'; S='studio/استوديو_المشرف_v9.39.html'
app=set_csp(A); set_csp(M)
st=open(S,encoding='utf-8').read()
m=re.search(r"(EMBEDDED_STUDENT_TEMPLATE_B64\s*=\s*['\"])([A-Za-z0-9+/=]+)(['\"])",st)
st=st[:m.start(2)]+base64.b64encode(app.encode()).decode()+st[m.end(2):]
open(S,'w',encoding='utf-8').write(st)
print('rebuilt; studio template matches:', base64.b64decode(re.search(r"EMBEDDED_STUDENT_TEMPLATE_B64\s*=\s*['\"]([A-Za-z0-9+/=]+)",st).group(1)).decode()==app)
