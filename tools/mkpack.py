import json, re, hashlib, base64
def _csp_hash(s):
    a = s.index('<script>'); b = s.rindex('</script>')
    return base64.b64encode(hashlib.sha256(s[a+8:b].encode('utf8')).digest()).decode()
def make(src, out, pack):
    s = open(src, encoding='utf8').read()
    a = '/* ===PACK_DATA_START=== */'; b = '/* ===PACK_DATA_END=== */'
    i = s.index(a); j = s.index(b) + len(b)
    blk = a + '\nvar PACK_DATA = ' + json.dumps(pack, ensure_ascii=False).replace('</', '<\\/') + ';\n' + b
    s = s[:i] + blk + s[j:]
    # keep CSP hash in sync with the generated script body (CSP has no unsafe-inline for scripts)
    s = re.sub(r"script-src 'sha256-[A-Za-z0-9+/=_-]+';", "script-src 'sha256-" + _csp_hash(s) + "';", s, count=1)
    open(out, 'w', encoding='utf8').write(s)


def gift(name='سعاد',pid='pack_gift1'):
    return {"packageId":pid,"packageType":"approved_gift","approved":True,"schemaVersion":2,"appVersion":"9.13","sheikhName":"الشيخ","supervisorName":"مشرف","teacherName":"محمد","teacherGender":"boy","sourceGiftStudentName":name,"sourceGiftStudentGender":"girl","studentName":"","studentId":"","masterAudios":{},"curriculum":CURR,"approvedStudentAudios":{"v1":{"audio":"data:audio/webm;base64,AAAA","status":"approved"}},"approvedPeerRecordings":[{"id":"g1","name":name,"gender":"girl","photo":None,"audios":{"v1":{"audio":"data:audio/webm;base64,AAAA","status":"approved"}}}],"studentAudios":{}}

CURR = json.load(open('/home/claude/kids/kids_curriculum_stage1_full.json', encoding='utf8'))['sections']
