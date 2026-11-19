"""Build v9.39: mobile = app code + mobile pack; recompute CSP hashes; re-embed template in studio; write outputs."""
import re, hashlib, base64, json
PACK_RE = re.compile(r'(/\* ===PACK_DATA_START=== \*/\nvar PACK_DATA = )(.*?)(;\n/\* ===PACK_DATA_END=== \*/)', re.S)

def set_csp(html):
    scripts = re.findall(r'<script>(.*?)</script>', html, re.S); assert len(scripts) == 1
    styles = re.findall(r'<style>(.*?)</style>', html, re.S); assert len(styles) == 1
    sh = base64.b64encode(hashlib.sha256(scripts[0].encode()).digest()).decode()
    st = base64.b64encode(hashlib.sha256(styles[0].encode()).digest()).decode()
    html = re.sub(r"script-src 'sha256-[^']+'", "script-src 'sha256-" + sh + "'", html, count=1)
    html = re.sub(r"style-src 'sha256-[^']+'", "style-src 'sha256-" + st + "'", html, count=1)
    return html

app = open('app.html', encoding='utf-8').read()
mobile_old = open('mobile.html', encoding='utf-8').read()
mobile_pack = PACK_RE.search(mobile_old).group(2)
mobile = PACK_RE.sub(lambda m: m.group(1) + mobile_pack.replace('\\', '\\\\') + m.group(3), app, count=1)
# safer: direct splice
m = PACK_RE.search(app); mobile = app[:m.start(2)] + mobile_pack + app[m.end(2):]
app = set_csp(app); mobile = set_csp(mobile)
assert "'9.39'" in app and json.loads(PACK_RE.search(mobile).group(2))['appVersion'] == '9.39'
open('out_app.html', 'w', encoding='utf-8').write(app)
open('out_mobile.html', 'w', encoding='utf-8').write(mobile)

# studio: re-embed template (the app file itself) as base64
studio = open('studio.html', encoding='utf-8').read()
b64 = base64.b64encode(app.encode('utf-8')).decode()
m2 = re.search(r"(EMBEDDED_STUDENT_TEMPLATE_B64\s*=\s*['\"])([A-Za-z0-9+/=\s]+)(['\"])", studio)
studio = studio[:m2.start(2)] + b64 + studio[m2.end(2):]
open('out_studio.html', 'w', encoding='utf-8').write(studio)
# verify
dec = base64.b64decode(re.search(r"EMBEDDED_STUDENT_TEMPLATE_B64\s*=\s*['\"]([A-Za-z0-9+/=\s]+)['\"]", studio).group(1)).decode('utf-8')
print('template identical:', dec == app, len(app), len(mobile), len(studio))
