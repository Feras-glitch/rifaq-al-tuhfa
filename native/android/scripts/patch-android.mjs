// يعدّل مشروع أندرويد الذي يولّده `npx cap add android`:
// الصلاحيات (الميكروفون والتخزين القديم)، «فتح باستخدام» لملفات HTML، الاسم، الأيقونات، رقم الإصدار، والتوقيع.
// يفشل بصوت عالٍ إن تغيّر شكل القالب، حتى لا يخرج APK ناقص بصمت.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, '..');
const repo = path.resolve(proj, '..', '..');
const A = path.join(proj, 'android', 'app');
const MAIN = path.join(A, 'src', 'main');
const VERSION_NAME = JSON.parse(fs.readFileSync(path.join(proj, 'package.json'), 'utf8')).version; // 9.39.0
const [maj, min, pat] = VERSION_NAME.split('.').map(Number);
const VERSION_CODE = maj * 10000 + min * 100 + pat; // 9.39.0 → 93900

function edit(file, fn, allowSame = false) {
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  if (after === before && !allowSame) throw new Error('لم يتغير الملف: ' + file);
  fs.writeFileSync(file, after);
  console.log('✓', path.relative(proj, file));
}
function must(s, needle, file) { if (!s.includes(needle)) throw new Error(`القالب تغيّر: لم يُعثر على «${needle}» في ${file}`); }

/* 1) AndroidManifest.xml */
const manifest = path.join(MAIN, 'AndroidManifest.xml');
edit(manifest, (s) => {
  must(s, '<application', manifest);
  must(s, 'android.intent.category.LAUNCHER', manifest);
  const perms = [
    '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
    '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />',
    '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
    '<uses-feature android:name="android.hardware.microphone" android:required="false" />'
  ].filter((p) => !s.includes(p.split('"')[1])).join('\n    ');
  s = s.replace(/(<manifest[^>]*>)/, `$1\n    ${perms}`);
  s = s.replace('<application', '<application\n        android:requestLegacyExternalStorage="true"');
  // «فتح باستخدام رفاق التحفة» لملفات HTML من واتساب ومدير الملفات والبريد
  const openWith = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="content" />
                <data android:mimeType="text/html" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="file" />
                <data android:mimeType="text/html" />
            </intent-filter>`;
  const launcherEnd = s.indexOf('</intent-filter>', s.indexOf('android.intent.category.LAUNCHER')) + '</intent-filter>'.length;
  return s.slice(0, launcherEnd) + openWith + s.slice(launcherEnd);
});

/* 2) الاسم */
const strings = path.join(MAIN, 'res', 'values', 'strings.xml');
edit(strings, (s) => s
  .replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">رفاق التحفة</string>')
  .replace(/<string name="title_activity_main">[^<]*<\/string>/, '<string name="title_activity_main">رفاق التحفة</string>'), true);

/* 3) الإصدار والتوقيع */
const gradle = path.join(A, 'build.gradle');
edit(gradle, (s) => {
  must(s, 'versionCode', gradle); must(s, 'buildTypes', gradle);
  s = s.replace(/versionCode\s+\d+/, `versionCode ${VERSION_CODE}`)
       .replace(/versionName\s+"[^"]*"/, `versionName "${VERSION_NAME}"`);
  // مفتاح ثابت من أسرار GitHub إن وُجد؛ وإلا يُوقَّع بمفتاح التصحيح (يُثبَّت، لكن التحديث يتطلب إزالة النسخة السابقة)
  const signing = `
    signingConfigs {
        rifaq {
            def ks = System.getenv("RIFAQ_KEYSTORE_PATH")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("RIFAQ_KEYSTORE_PASSWORD")
                keyAlias System.getenv("RIFAQ_KEY_ALIAS")
                keyPassword System.getenv("RIFAQ_KEY_PASSWORD")
            }
        }
    }
    buildTypes {`;
  s = s.replace(/\n\s*buildTypes\s*\{/, signing);
  s = s.replace(/release\s*\{/, 'release {\n            signingConfig System.getenv("RIFAQ_KEYSTORE_PATH") ? signingConfigs.rifaq : signingConfigs.debug');
  return s;
});

/* 4) الأيقونات (تكيفية + تقليدية) ولون الخلفية */
const icons = path.join(repo, 'web', 'icons');
const dens = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
for (const [d, [legacy, fg]] of Object.entries(dens)) {
  const dir = path.join(MAIN, 'res', `mipmap-${d}`);
  if (!fs.existsSync(dir)) throw new Error('مجلد أيقونات مفقود: ' + dir);
  fs.copyFileSync(path.join(icons, `icon-${legacy}.png`), path.join(dir, 'ic_launcher.png'));
  fs.copyFileSync(path.join(icons, `icon-${legacy}.png`), path.join(dir, 'ic_launcher_round.png'));
  fs.copyFileSync(path.join(icons, `android-fg-${fg}.png`), path.join(dir, 'ic_launcher_foreground.png'));
}
console.log('✓ icons');
const bg = path.join(MAIN, 'res', 'values', 'ic_launcher_background.xml');
fs.writeFileSync(bg, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#283593</color>\n</resources>\n');
console.log('✓', path.relative(proj, bg));

console.log(`تم: الإصدار ${VERSION_NAME} (${VERSION_CODE})`);
