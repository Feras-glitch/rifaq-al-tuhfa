#!/usr/bin/env bash
# يُشغَّل داخل محاكي أندرويد في CI: تثبيت APK، فتح التطبيق، قراءة الشاشة، الضغط على «تطبيق الطالب والمعلم»،
# والتحقق من ظهور شاشة الإعداد داخل الصفحة المضيفة، مع طباعة أخطاء WebView.
set -u
APK=$(ls apk/*.apk | head -1)
PKG=org.rifaq.tuhfa
fail=0

dump() { adb shell uiautomator dump "/sdcard/$1.xml" >/dev/null 2>&1; adb pull "/sdcard/$1.xml" "$1.xml" >/dev/null 2>&1; }
texts() { grep -oE '(text|content-desc)="[^"]+"' "$1" | head -40; }
bounds_of() { # يطبع مركز أول عنصر يحوي النص
  grep -oE "<node[^>]*(text|content-desc)=\"[^\"]*$2[^\"]*\"[^>]*>" "$1" | head -1 \
    | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' \
    | sed -E 's/bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]"/\1 \2 \3 \4/'
}

echo "== تثبيت $APK"
adb install -r "$APK" || exit 1
adb shell pm grant $PKG android.permission.RECORD_AUDIO || true
adb logcat -c

echo "== تشغيل"
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null
for i in $(seq 1 30); do sleep 2; dump ui1; grep -q "تطبيق الطالب والمعلم" ui1.xml 2>/dev/null && break; done
adb shell screencap -p /sdcard/s1.png; adb pull /sdcard/s1.png 1-launcher.png >/dev/null
echo "-- نصوص الشاشة:"; texts ui1.xml
if grep -q "تطبيق الطالب والمعلم" ui1.xml; then echo "PASS: صفحة الإطلاق ظاهرة"; else echo "FAIL: صفحة الإطلاق غير ظاهرة"; fail=1; fi

echo "== فتح تطبيق الطالب"
set -- $(bounds_of ui1.xml "تطبيق الطالب والمعلم")
if [ $# -eq 4 ]; then
  adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
  for i in $(seq 1 30); do sleep 2; dump ui2; grep -qE "قبل أن نبدأ|إعداد تعليمي|تخطي" ui2.xml 2>/dev/null && break; done
  adb shell screencap -p /sdcard/s2.png; adb pull /sdcard/s2.png 2-app.png >/dev/null
  echo "-- نصوص الشاشة:"; texts ui2.xml
  if grep -qE "قبل أن نبدأ|إعداد تعليمي|تخطي" ui2.xml; then echo "PASS: التطبيق يعمل داخل الصفحة المضيفة"; else echo "FAIL: التطبيق لم يظهر"; fail=1; fi
  grep -q "فتح ملف" ui2.xml && echo "PASS: شريط الصفحة المضيفة ظاهر" || echo "INFO: شريط الصفحة المضيفة لم يُقرأ"
else
  echo "FAIL: لم يُعثر على زر «تطبيق الطالب والمعلم»"; fail=1
fi

echo "== أخطاء WebView وتعطّل التطبيق"
# 9.39.16: كان الفحص يلتقط «Uncaught» من أي عملية في المحاكي، فأفشل تشغيلًا بسبب عطل في عملية نظام لا علاقة لها بالتطبيق.
# الآن: رسائل وحدة التحكم في صفحات التطبيق (chromium وCapacitor)، وتعطّل عملية التطبيق نفسها فقط.
adb logcat -d > logcat.txt
grep -E "chromium|Capacitor|Console" logcat.txt | grep -E "Uncaught|Refused to|Content Security Policy" | head -30 | tee errors.txt
grep -A3 "FATAL EXCEPTION" logcat.txt | grep -B1 -A2 "Process: $PKG" | head -20 | tee -a errors.txt
grep -A2 "FATAL EXCEPTION" logcat.txt | grep "Process:" | grep -v "$PKG" | head -5 | sed 's/^/INFO: عطل في عملية أخرى في المحاكي (لا يُفشل الفحص): /'
if [ -s errors.txt ]; then echo "FAIL: أخطاء في WebView"; fail=1; else echo "PASS: لا أخطاء في WebView"; fi
exit $fail
