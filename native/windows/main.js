// رفاق التحفة — برنامج ويندوز (Electron)
// يخدم الموقع المضمَّن عبر بروتوكول خاص (rifaq://app/) ليعمل التخزين والميكروفون كما في المتصفح،
// ويفتح ملفات الحزم من «فتح ملف» أو «فتح باستخدام» أو سحبها على أيقونة البرنامج.
'use strict';
const { app, BrowserWindow, protocol, net, session, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const SITE = path.join(__dirname, 'site');
const HOME = 'rifaq://app/index.html';
const HOST = 'rifaq://app/open.html';
const MAX_BYTES = 80 * 1024 * 1024;

protocol.registerSchemesAsPrivileged([{
  scheme: 'rifaq',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

// نسخة ثانية: تسلّم الملف للأولى (second-instance) وتخرج فورًا دون تسجيل أي معالِجات
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let win = null;
let pending = null;   // ملف ينتظر جاهزية الصفحة المضيفة
let hostReady = false;

function fileArg(argv) {
  for (const a of argv.slice(1)) {
    if (/\.html?$/i.test(a)) { try { if (fs.statSync(a).isFile()) return a; } catch (e) { /* تجاهل */ } }
  }
  return null;
}

function readPack(p) {
  try {
    if (fs.statSync(p).size > MAX_BYTES) { dialog.showErrorBox('رفاق التحفة', 'الملف كبير جدًا.'); return null; }
    return { name: path.basename(p), text: fs.readFileSync(p, 'utf8') };
  } catch (e) {
    dialog.showErrorBox('رفاق التحفة', 'تعذّرت قراءة الملف:\n' + e.message);
    return null;
  }
}

function deliver(p) {
  const d = p && readPack(p);
  if (!d) return;
  if (!win) { pending = d; return; }
  if (win.isMinimized()) win.restore();
  win.focus();
  if (hostReady && win.webContents.getURL().startsWith(HOST)) win.webContents.send('open-file', d);
  else { pending = d; win.loadURL(HOST); }
}

async function chooseFile() {
  const r = await dialog.showOpenDialog(win, {
    title: 'فتح ملف رفاق التحفة',
    properties: ['openFile'],
    filters: [{ name: 'ملفات رفاق التحفة', extensions: ['html', 'htm'] }]
  });
  if (!r.canceled && r.filePaths[0]) deliver(r.filePaths[0]);
}

function buildMenu() {
  const t = [
    { label: 'ملف', submenu: [
      { label: 'الصفحة الرئيسية', accelerator: 'CmdOrCtrl+H', click: () => win && win.loadURL(HOME) },
      { label: 'فتح ملف…', accelerator: 'CmdOrCtrl+O', click: chooseFile },
      { type: 'separator' },
      { label: 'خروج', role: 'quit' }
    ] },
    { label: 'عرض', submenu: [
      { label: 'إعادة تحميل', accelerator: 'F5', click: () => win && win.webContents.reload() },
      { type: 'separator' },
      { label: 'تكبير', role: 'zoomIn' },
      { label: 'تصغير', role: 'zoomOut' },
      { label: 'الحجم الأصلي', role: 'resetZoom' },
      { type: 'separator' },
      { label: 'ملء الشاشة', role: 'togglefullscreen' },
      { label: 'أدوات المطوّر', accelerator: 'CmdOrCtrl+Shift+I', click: () => win && win.webContents.toggleDevTools() }
    ] },
    { label: 'مساعدة', submenu: [
      { label: 'المصدر وسجل التغييرات', click: () => shell.openExternal('https://github.com/Feras-glitch/rifaq-al-tuhfa') },
      { label: 'عن البرنامج', click: () => dialog.showMessageBox(win, {
        type: 'info', title: 'رفاق التحفة',
        message: 'رفاق التحفة ' + app.getVersion(),
        detail: 'تعليم التجويد للأطفال على متن تحفة الأطفال.\nيعمل دون إنترنت، وكل البيانات تبقى على هذا الجهاز.\nنص القرآن من مشروع تنزيل (CC BY 3.0).'
      }) }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

function createWindow(startUrl) {
  win = new BrowserWindow({
    width: 1180, height: 860, minWidth: 380, minHeight: 560,
    title: 'رفاق التحفة', backgroundColor: '#eef1fa', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false
    }
  });
  win.once('ready-to-show', () => { if (!(process.env.RIFAQ_SMOKE_OUT && process.argv.includes('--rifaq-self-test'))) win.show(); });
  win.webContents.on('did-navigate', () => { hostReady = false; });

  // روابط خارجية تفتح في المتصفح؛ لا نوافذ جديدة داخل البرنامج
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('rifaq://app/') || url.startsWith('blob:')) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
  win.on('closed', () => { win = null; });
  win.loadURL(startUrl);
}

ipcMain.on('host-ready', (e) => {
  hostReady = true;
  if (pending) { e.sender.send('open-file', pending); pending = null; }
});

app.on('second-instance', (_e, argv) => {
  const f = fileArg(argv);
  if (f) deliver(f);
  else if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  protocol.handle('rifaq', (req) => {
    let u, rel;
    try { u = new URL(req.url); rel = decodeURIComponent(u.pathname); }
    catch (e) { return new Response('Bad request', { status: 400 }); }
    if (u.host !== 'app') return new Response('Not found', { status: 404 });
    if (rel.endsWith('/')) rel += 'index.html';
    const f = path.normalize(path.join(SITE, rel));
    if (!f.startsWith(SITE + path.sep)) return new Response('Forbidden', { status: 403 });
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(f).toString());
  });

  const ses = session.defaultSession;
  // الميكروفون فقط (للتسجيل بعد موافقة ولي الأمر داخل التطبيق)؛ لا شيء غيره
  const allowed = new Set(['media', 'clipboard-sanitized-write', 'fullscreen']);
  ses.setPermissionRequestHandler((_wc, perm, cb, details) => {
    if (perm === 'media' && details && details.mediaTypes && details.mediaTypes.some((t) => t !== 'audio')) return cb(false);
    cb(allowed.has(perm));
  });
  ses.setPermissionCheckHandler((_wc, perm) => allowed.has(perm));

  // التنزيل: نافذة حفظ تبدأ في «المستندات/رفاق التحفة»
  ses.on('will-download', (_e, item) => {
    const dir = path.join(app.getPath('documents'), 'رفاق التحفة');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* تجاهل */ }
    item.setSaveDialogOptions({ title: 'حفظ الملف', defaultPath: path.join(dir, item.getFilename()) });
  });

  buildMenu();
  const f = fileArg(process.argv);
  if (f) pending = readPack(f);
  createWindow(pending ? HOST : HOME);

  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(HOME); });
});

app.on('window-all-closed', () => { app.quit(); });

/* فحص ذاتي يُشغَّل في CI على البرنامج المبني فعلًا: RIFAQ_SMOKE_OUT=مسار ملف النتائج */
// يتطلب متغير البيئة ومعامل سطر الأوامر معًا، فلا يُفعَّل عرضًا في تثبيت عادي
if (process.env.RIFAQ_SMOKE_OUT && process.argv.includes('--rifaq-self-test')) {
  const out = process.env.RIFAQ_SMOKE_OUT;
  const res = { checks: [], csp: [] };
  const ok = (name, pass, detail) => res.checks.push({ name, pass: !!pass, detail: String(detail || '').slice(0, 200) });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const load = (url) => new Promise((r) => { win.webContents.once('did-finish-load', r); win.loadURL(url); });
  const js = (code) => win.webContents.executeJavaScript(code, true);
  app.whenReady().then(async () => {
    try {
      while (!win) await wait(100);
      win.webContents.on('console-message', (...a) => {
        const m = a[0] && a[0].message !== undefined ? a[0].message : a[2];
        if (/Content Security Policy|Refused to/i.test(String(m))) res.csp.push(String(m).slice(0, 200));
      });
      await load(HOME); await wait(800);
      const hrefs = await js("Array.from(document.querySelectorAll('a.card')).map(a=>a.getAttribute('href'))");
      ok('launcher: 4 cards routed through host', hrefs.length === 4 && hrefs.every((h) => h.startsWith('./open.html')), JSON.stringify(hrefs));
      await load(HOST + '?src=app'); await wait(3000);
      const app1 = await js("(function(){var w=document.getElementById('frame').contentWindow;return {pd:typeof w.PACK_DATA, st:typeof w.STATE, v:w.APP_VERSION, secs:(w.CURRICULUM||[]).length};})()");
      ok('app runs inside host (blob frame, CSP ok)', app1.pd === 'object' && app1.st === 'object' && app1.secs === 16, JSON.stringify(app1));
      const trial = fs.readFileSync(path.join(SITE, 'trial', 'index.html'), 'utf8');
      await js('window.RIFAQ_HOST.openText("trial.html", ' + JSON.stringify(trial) + ')'); await wait(3000);
      const app2 = await js("(function(){var w=document.getElementById('frame').contentWindow;return {id:w.PACK_DATA&&w.PACK_DATA.packageId, title:document.getElementById('cur-title').textContent};})()");
      ok('open pack file via host', app2.id === 'pack_kids_stage1', JSON.stringify(app2));
      const mic = await js("navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'");
      ok('getUserMedia available (secure context)', mic, mic);
      const idb = await js("new Promise(r=>{var q=indexedDB.open('smoke',1);q.onsuccess=()=>r(true);q.onerror=()=>r(false);})");
      ok('IndexedDB works on rifaq://', idb, idb);
      ok('no CSP violations', res.csp.length === 0, res.csp.join(' | '));
    } catch (e) { ok('smoke exception', false, e && e.stack); }
    fs.writeFileSync(out, JSON.stringify(res, null, 2));
    app.exit(res.checks.every((c) => c.pass) ? 0 : 1);
  });
}
