// يكشف للصفحة المضيفة (open.html) واجهة صغيرة فقط: استقبال الملف المفتوح وإعلان الجاهزية.
// لا يصل إلى الإطار الذي يعمل فيه التطبيق (preload للإطار الرئيسي فقط).
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rifaqNative', {
  platform: 'windows',
  onOpenFile: (cb) => { ipcRenderer.on('open-file', (_e, d) => cb(d)); },
  ready: () => ipcRenderer.send('host-ready')
});
