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

if (!app.requestSingleInstanceLock()) { app.quit(); }

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
  win.once('ready-to-show', () => win.show());
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
    const u = new URL(req.url);
    if (u.host !== 'app') return new Response('Not found', { status: 404 });
    let rel = decodeURIComponent(u.pathname);
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
