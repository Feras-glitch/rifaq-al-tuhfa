/* 9.41.1: تسليم الملف المصدَّر. على الهاتف (آيفون خاصة) يُحفظ التنزيل بصمت في مجلد يصعب على ولي الأمر إيجاده،
   فتُعرض نافذة المشاركة (واتساب، البريد، الملفات) بلمسة جديدة من المستخدم؛ وعلى الحاسوب يُنزَّل الملف كما كان.
   وفي تطبيق أندرويد يعترض الغلاف التنزيل ويفتح المشاركة بنفسه. */
function canShareFile(){
  try {
    if (typeof File !== 'function' || !navigator.share || !navigator.canShare) return false;
    if (!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) return false;
    return navigator.canShare({files: [new File(['x'], 'x.html', {type: 'text/html'})]});
  } catch(e){ return false; }
}
function downloadBlob(blob, fname){
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 3000);
}
function offerFile(blob, fname, title, body){
  var share = async function(){
    closeModal();
    try { await navigator.share({files: [new File([blob], fname, {type: blob.type || 'text/html'})], title: fname}); }
    catch(e){ if (!e || e.name !== 'AbortError') downloadBlob(blob, fname); }
  };
  showModal(title, body + '\n\nأرسله الآن (واتساب أو البريد)، أو احفظه في جهازك.', [
    {label: '📤 أرسل الملف', class: 'success', action: share},
    {label: '💾 احفظه في الجهاز', class: 'ghost', action: function(){ closeModal(); downloadBlob(blob, fname); }}
  ]);
}
