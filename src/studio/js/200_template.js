var EMBEDDED_STUDENT_TEMPLATE_B64 = '@@APP_TEMPLATE_B64@@';
function getEmbeddedStudentTemplate(){
  var raw = atob(EMBEDDED_STUDENT_TEMPLATE_B64);
  var bytes = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
  return decodeURIComponent(escape(raw));
}

function parseTrustedKeysInput(text){
  text = String(text || '').trim(); if (!text) return [];
  var items = [];
  try { var v = JSON.parse(text); items = Array.isArray(v) ? v : [v]; }
  catch(e){ items = text.split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean).map(function(l){ return JSON.parse(l); }); }
  var ok = /^[A-Za-z0-9_\-]{20,100}$/;
  return items.map(function(k){
    if (!k || k.kty !== 'EC' || k.crv !== 'P-256' || !ok.test(String(k.x)) || !ok.test(String(k.y))) throw new Error('كل مفتاح يجب أن يكون EC / P-256 مع x و y صالحين');
    return {kty:'EC', crv:'P-256', x:String(k.x), y:String(k.y)};
  });
}
/* 9.20: تجزئة CSP تُحسب من نص السكربت الفعلي في الملف المُصدَّر (لا يوجد unsafe-inline للسكربت) */
async function studioCspWithScriptHash(html){
  var a = html.indexOf('<script>'), b = html.lastIndexOf('<\/script>');
  if (a < 0 || b < a) return html;
  var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html.substring(a + 8, b)));
  var bin = ''; var u8 = new Uint8Array(digest); for (var i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return html.replace(/script-src 'sha256-[A-Za-z0-9+\/=_-]+';/, "script-src 'sha256-" + btoa(bin) + "';");
}
