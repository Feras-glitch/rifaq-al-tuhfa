import re,base64,hashlib
p='/home/claude/s20.html'
s=open(p,encoding='utf8').read()
a=s.index('<script>'); b=s.rindex('</script>')
h=base64.b64encode(hashlib.sha256(s[a+8:b].encode('utf8')).digest()).decode()
s,n=re.subn(r"script-src 'sha256-[A-Za-z0-9+/=_-]+';", "script-src 'sha256-"+h+"';", s, count=1); assert n==1
open(p,'w',encoding='utf8').write(s)
# studio: re-embed the template
d=open('/home/claude/out/Developer_Studio_v9.20.html',encoding='utf8',errors='surrogateescape').read()
b64=base64.b64encode(s.encode('utf8')).decode()
d2,n2=re.subn(r"(EMBEDDED_STUDENT_TEMPLATE_B64\s*=\s*')[A-Za-z0-9+/=]+(')",lambda m:m.group(1)+b64+m.group(2),d); assert n2==1
open('/home/claude/out/Developer_Studio_v9.20.html','w',encoding='utf8',errors='surrogateescape').write(d2)
open('/home/claude/out/Student_App_v9.20.html','w',encoding='utf8').write(s)
print('hash',h[:12],'built')
