// 9.42: فاحص الكود. يُشغَّل في CI على السكربت المبني (ملف واحد لكل تطبيق)، لأن الدوال كلها في مجال عام واحد،
// فاسم دالة خاطئ أو متغير غير معرّف لا يُكشف في الملفات المنفردة. التشغيل: انظر خطوة «فاحص الكود» في .github/workflows/build.yml
import globals from "globals";
export default [{
  files: ["**/*.js"],
  languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser, ...globals.serviceworker, Capacitor: "readonly" } },
  linterOptions: { reportUnusedDisableDirectives: "off" },
  rules: {
    "no-undef": "error", "no-dupe-keys": "error", "no-dupe-args": "error", "no-const-assign": "error", "no-func-assign": "error",
    "use-isnan": "error", "valid-typeof": "error", "no-unreachable": "warn", "no-self-assign": "warn",
    "no-unused-vars": ["warn", { vars: "local", args: "none", caughtErrors: "none" }]
  }
}];
