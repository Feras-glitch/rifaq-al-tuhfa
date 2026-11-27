/* عامل الخدمة: يخزّن التطبيق كاملًا ليعمل دون إنترنت.
   قيمتا VERSION وPRECACHE يكتبهما tools/build_web.py عند البناء. */
'use strict';

const VERSION = "9.42.0-51d7bc91ea";
/* 9.39.14 (D8): الموقع الرئيسي والتجريبي (/beta/) على أصل واحد يتشاركان مخزن الذاكرة؛ لكل منهما بادئة لا يمسح غيرها،
   وعامل الرئيسي (نطاقه الجذر) لا يتدخل في طلبات /beta/ فلها عاملها. */
const PREFIX = "rifaq-beta-";
const CACHE = PREFIX + VERSION;
const PRECACHE = [
  "./app/index.html",
  "./app/template.txt",
  "./host.css",
  "./host.js",
  "./icons/favicon.ico",
  "./icons/icon-1024.png",
  "./icons/icon-128.png",
  "./icons/icon-144.png",
  "./icons/icon-152.png",
  "./icons/icon-167.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-256.png",
  "./icons/icon-384.png",
  "./icons/icon-48.png",
  "./icons/icon-512.png",
  "./icons/icon-72.png",
  "./icons/icon-96.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./index.html",
  "./launcher.css",
  "./launcher.js",
  "./manifest.webmanifest",
  "./open.html",
  "./trusted-teachers.json"
];
const MINE = (k) => k.startsWith(PREFIX) && !(PREFIX === 'rifaq-' && k.startsWith('rifaq-beta-'));
const BETA_PATH = new URL('./beta/', self.registration.scope).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))  // 9.39.2: لا نسخ قديمة من ذاكرة HTTP
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => MINE(k) && k !== CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (PREFIX === 'rifaq-' && url.pathname.startsWith(BETA_PATH)) return; // 9.39.14 (D8): للتجريبي عامله

  /* 9.42: التخزين المسبق كان 10.8 م.ب (تطبيق الطالب 3 نسخ، والاستوديو والتجربة نسختان لكل منهما). صار:
     - تطبيق الطالب نسختان: الصفحة (app/index.html، ومنها يُخدم المسار المختصر /app/) وقالب الصفحة المضيفة (app/template.txt).
       جُرّبت نسخة واحدة يُبنى منها ردّ القالب داخل عامل الخدمة، فعلّق طلب القالب في WebKit (اختبار الدخان W6)، فبقيت النسختان.
     - الاستوديو والتجربة لا يُنزَّلان مسبقًا؛ يُخزَّنان عند أول فتح لهما فيعملان بعدها دون إنترنت. */
  const cachedIndex = (path) => caches.match(new URL(path + 'index.html', url.origin).href);

  /* التنقل: نخدم الصفحة من المخزن، فإن لم تكن فيه نجلبها ونخزّنها، وإن تعذّر نرجع لصفحة الإطلاق. */
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const hit = (await caches.match(req, { ignoreSearch: true })) || (url.pathname.endsWith('/') ? await cachedIndex(url.pathname) : null);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      } catch (e) { return caches.match('./index.html'); }
    })());
    return;
  }

  /* بقية الملفات: المخزن أولًا (كلها ثابتة ومرقّمة بالإصدار). */
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
