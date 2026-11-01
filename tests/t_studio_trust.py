import json, re, shutil
from playwright.sync_api import sync_playwright
errs=[]; log=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(accept_downloads=True).new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)[:120])); pg.on('dialog',lambda d:(log.append(('dialog',d.message[:90])),d.accept()))
    pg.goto('file:///home/claude/out/Developer_Studio_v9.18.html'); pg.wait_for_timeout(700)
    log.append(('version',pg.evaluate("APP_VERSION")))
    log.append(('parse good',pg.evaluate("JSON.stringify(parseTrustedKeysInput('{\"kty\":\"EC\",\"crv\":\"P-256\",\"x\":\"'+'A'.repeat(43)+'\",\"y\":\"'+'B'.repeat(43)+'\"}'))").count('"kty"')))
    log.append(('parse bad curve',pg.evaluate("(()=>{try{parseTrustedKeysInput('{\"kty\":\"EC\",\"crv\":\"P-384\",\"x\":\"'+'A'.repeat(43)+'\",\"y\":\"'+'B'.repeat(43)+'\"}');return 'accepted'}catch(e){return 'rejected'}})()")))
    log.append(('parse injection',pg.evaluate("(()=>{try{parseTrustedKeysInput('{\"kty\":\"EC\",\"crv\":\"P-256\",\"x\":\"<img onerror=1>\",\"y\":\"'+'B'.repeat(43)+'\"}');return 'accepted'}catch(e){return 'rejected'}})()")))
    b.close()
for l in log: print(l)
print('ERRORS',errs)
