import re,base64,hashlib,shutil
p='/home/claude/s28.html'
s=open(p,encoding='utf8').read()
def h(t): return base64.b64encode(hashlib.sha256(t.encode('utf8')).digest()).decode()
a=s.index('<script>'); b=s.rindex('</script>')
sh=h(s[a+8:b]); st=re.search(r'<style[^>]*>([\s\S]*?)</style>',s); th=h(st.group(1))
s=re.sub(r"script-src 'sha256-[A-Za-z0-9+/=_-]+';", "script-src 'sha256-"+sh+"';", s, count=1)
s=re.sub(r"style-src 'sha256-[A-Za-z0-9+/=_-]+';", "style-src 'sha256-"+th+"';", s, count=1)
open(p,'w',encoding='utf8').write(s)
base='/mnt/user-data/outputs/رفاق_التحفة_المرحلة1/2_الاستوديو/استوديو_المشرف_v9.27.html'
d=open(base,encoding='utf8',errors='surrogateescape').read()
d=re.sub(r"var APP_VERSION = '[0-9.]+';","var APP_VERSION = '9.28';",d,count=1)
b64=base64.b64encode(s.encode('utf8')).decode()
d2,n=re.subn(r"(EMBEDDED_STUDENT_TEMPLATE_B64\s*=\s*')[A-Za-z0-9+/=]+(')",lambda m:m.group(1)+b64+m.group(2),d); assert n==1
open('/home/claude/out/Developer_Studio_v9.28.html','w',encoding='utf8',errors='surrogateescape').write(d2)
open('/home/claude/out/Student_App_v9.28.html','w',encoding='utf8').write(s)
print('built 9.27', sh[:6], th[:6])
