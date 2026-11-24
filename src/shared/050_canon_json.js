/* 9.41.2: JSON القانوني (مفاتيح مرتبة، والقيم غير المعرّفة تسقط) للتوقيع والبصمات، نسخة واحدة للتطبيق والاستوديو.
   ونسخة web/host.js منفصلة لأنها سكربت الصفحة المضيفة؛ tests/test_units.js يتحقق أن نتيجتيهما متطابقتان. */
function canonJSON(v, skipTopKey){
  function c(x, top){
    if (x === null || typeof x !== 'object'){ var s = JSON.stringify(x); return s === undefined ? undefined : s; }
    if (Array.isArray(x)) return '[' + x.map(function(e){ var s = c(e, false); return s === undefined ? 'null' : s; }).join(',') + ']';
    var ks = Object.keys(x).sort(), out = [];
    for (var i = 0; i < ks.length; i++){ if (top && ks[i] === skipTopKey) continue; var s = c(x[ks[i]], false); if (s !== undefined) out.push(JSON.stringify(ks[i]) + ':' + s); }
    return '{' + out.join(',') + '}';
  }
  return c(v, true);
}
