#!/usr/bin/env python3
"""يبني مجلد الموقع (_site) من المصادر: صفحة الإطلاق + نسخ التطبيق والاستوديو والتجربة.

لا يعدّل أي ملف من ملفات التطبيق — ينسخها كما هي إلى مسارات لاتينية نظيفة،
ثم يحقن في عامل الخدمة قائمة الملفات ورقم إصدار مشتق من محتواها.

التشغيل:  python3 tools/build_web.py  [مجلد الخرج]
"""
import hashlib
import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# المصدر الموثوق → المسار على الموقع
PAGES = {
    "app/تطبيق_الطالب_والمعلم_v9.39.html": "app/index.html",
    "studio/استوديو_المشرف_v9.39.html": "studio/index.html",
    "app/تجربة_المرحلة1_للهاتف_v9.39.html": "trial/index.html",
}

STATIC = ["index.html", "launcher.css", "launcher.js", "manifest.webmanifest",
          "open.html", "host.js", "host.css", "trusted-teachers.json"]


def app_version():
    src = os.path.join(ROOT, "app", "تطبيق_الطالب_والمعلم_v9.39.html")
    with open(src, encoding="utf-8") as fh:
        m = re.search(r"var APP_VERSION = '([^']+)'", fh.read())
    return m.group(1) if m else "0"


def check_csp(path):
    """يفشل البناء إن لم تطابق تجزئة CSP سكربت الصفحة (مثلًا بعد تحويل نهايات الأسطر)."""
    import base64
    with open(path, "rb") as fh:
        raw = fh.read()
    html = raw.decode("utf-8")
    if "Content-Security-Policy" not in html:
        return  # الاستوديو بلا CSP
    a, b = html.find("<script>"), html.rfind("</script>")
    m = re.search(r"script-src 'sha256-([A-Za-z0-9+/=]+)'", html)
    assert a >= 0 and b > a and m, "بنية CSP غير متوقعة: " + path
    h = base64.b64encode(hashlib.sha256(html[a + 8:b].encode("utf-8")).digest()).decode()
    assert h == m.group(1), "تجزئة CSP لا تطابق السكربت (نهايات أسطر؟): " + path
    ms = re.search(r"style-src 'sha256-([A-Za-z0-9+/=]+)'", html)
    if ms:  # 9.39.10: تجزئة الأنماط يجب أن تطابق أيضًا، وإلا تُحجب الأنماط كلها
        st = re.findall(r"<style>(.*?)</style>", html, re.S)
        assert len(st) == 1, "عدد عناصر <style> غير متوقع: " + path
        hs = base64.b64encode(hashlib.sha256(st[0].encode("utf-8")).digest()).decode()
        assert hs == ms.group(1), "تجزئة CSP لا تطابق الأنماط: " + path
    assert b"\r\n" not in raw[:4000], "نهايات أسطر CRLF في: " + path


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "_site")
    if os.path.isdir(out):
        shutil.rmtree(out)
    os.makedirs(out)

    copied = []

    # 1) الملفات الثابتة لصفحة الإطلاق
    # 9.39.12: رقم الإصدار واحد في كل مكان — التطبيق والاستوديو وحزمتا أندرويد وويندوز وصفحة الإطلاق
    ver = app_version()
    for pj in ("native/android/package.json", "native/windows/package.json"):
        with open(os.path.join(ROOT, pj), encoding="utf-8") as fh:
            pv = json.load(fh).get("version")
        if pv != ver:
            raise SystemExit("رقم الإصدار غير متسق: APP_VERSION=%s و%s=%s" % (ver, pj, pv))
    with open(os.path.join(ROOT, "studio", "استوديو_المشرف_v9.39.html"), encoding="utf-8") as fh:
        sm = re.search(r"var APP_VERSION = '([^']+)'", fh.read())
    if not sm or sm.group(1) != ver:
        raise SystemExit("رقم إصدار الاستوديو غير متسق مع التطبيق")
    for name in STATIC:
        src = os.path.join(ROOT, "web", name)
        dst = os.path.join(out, name)
        shutil.copy2(src, dst)
        copied.append("./" + name)
    with open(os.path.join(out, "index.html"), encoding="utf-8") as fh:
        idx = fh.read()
    idx2 = re.sub(r'(<p class="ver" id="ver">)الإصدار [^<]*(</p>)', lambda m: m.group(1) + "الإصدار " + ver + m.group(2), idx)
    if idx2 == idx and ("الإصدار " + ver) not in idx:
        raise SystemExit("لم يُعثر على سطر الإصدار في صفحة الإطلاق")
    with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(idx2)

    # 2) الأيقونات
    icons_src = os.path.join(ROOT, "web", "icons")
    icons_dst = os.path.join(out, "icons")
    os.makedirs(icons_dst, exist_ok=True)
    for name in sorted(os.listdir(icons_src)):
        if name.startswith("android-fg-"):
            continue  # خاصة بتطبيق أندرويد، لا تلزم الموقع
        shutil.copy2(os.path.join(icons_src, name), os.path.join(icons_dst, name))
        copied.append("./icons/" + name)

    # 3) صفحات التطبيق كما هي (بايتًا بايت)
    for src_rel, dst_rel in PAGES.items():
        src = os.path.join(ROOT, src_rel)
        dst = os.path.join(out, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        with open(src, "rb") as a, open(dst, "rb") as b:
            assert a.read() == b.read(), "نسخة الموقع لا تطابق المصدر: " + src_rel
        check_csp(dst)
        copied.append("./" + dst_rel)
        # المسار المختصر الذي يستعمله الزائر (/app/) يُخدم من نفس الملف
        copied.append("./" + os.path.dirname(dst_rel) + "/")

    # 3ب) قالب التطبيق الموثوق للصفحة المضيفة (نص خام، فلا يحقن فيه غلاف أندرويد شيئًا)
    tpl_src = os.path.join(ROOT, "app/تطبيق_الطالب_والمعلم_v9.39.html")
    shutil.copy2(tpl_src, os.path.join(out, "app", "template.txt"))
    copied.append("./app/template.txt")

    # 4) ملف يمنع Jekyll من تجاهل الملفات التي تبدأ بشرطة سفلية
    open(os.path.join(out, ".nojekyll"), "w").close()

    # 5) عامل الخدمة: رقم إصدار مشتق من محتوى كل الملفات
    h = hashlib.sha256()
    for root, _dirs, files in os.walk(out):
        for name in sorted(files):
            p = os.path.join(root, name)
            h.update(os.path.relpath(p, out).encode())
            with open(p, "rb") as fh:
                h.update(fh.read())
    version = app_version() + "-" + h.hexdigest()[:10]

    with open(os.path.join(ROOT, "web", "sw.js"), encoding="utf-8") as fh:
        sw = fh.read()
    precache = sorted(set(copied))
    sw = sw.replace("'__VERSION__'", json.dumps(version, ensure_ascii=False))
    sw = sw.replace("__PRECACHE__", json.dumps(precache, ensure_ascii=False, indent=2))
    with open(os.path.join(out, "sw.js"), "w", encoding="utf-8") as fh:
        fh.write(sw)

    total = sum(
        os.path.getsize(os.path.join(r, f))
        for r, _d, fs in os.walk(out) for f in fs
    )
    print("الإصدار:", version, "| CSP: مطابقة")
    print("الملفات:", len(precache), "| الحجم:", round(total / 1024 / 1024, 2), "ميغابايت")
    print("الخرج:", out)


if __name__ == "__main__":
    main()
