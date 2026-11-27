/* ===== 9.42: سجل أعطال محلي =====
   لا خادم ولا تتبّع: آخر 50 خطأ تُحفظ على الجهاز نفسه، ويراها ولي الأمر في إعداداته، وتُرفق بالنسخة الاحتياطية.
   بلا هذا لا يُعرف أن شيئًا تعطّل عند طفل إلا إن اشتكى أهله. لا يُسجَّل أي نص من محتوى الطفل، فقط رسالة الخطأ وموضعه. */
var ERRLOG_KEY = 'rifaq_errlog_v1', ERRLOG_MAX = 50;
function readErrLog(){ try { var a = JSON.parse(localStorage.getItem(ERRLOG_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch(e){ return []; } }
function logClientError(msg, where){
  try {
    var a = readErrLog(), m = String(msg || '').slice(0, 200), w = String(where || '').replace(/^.*\//, '').slice(0, 80);
    var last = a[a.length - 1];
    if (last && last.m === m && last.w === w){ last.n = (last.n || 1) + 1; last.t = new Date().toISOString().slice(0, 16); }
    else a.push({t: new Date().toISOString().slice(0, 16), m: m, w: w, v: (typeof APP_VERSION === 'string' ? APP_VERSION : ''), n: 1});
    if (a.length > ERRLOG_MAX) a.splice(0, a.length - ERRLOG_MAX);
    localStorage.setItem(ERRLOG_KEY, JSON.stringify(a));
  } catch(e){}
}
window.addEventListener('error', function(e){ logClientError(e && e.message, (e && e.filename ? e.filename : '') + ':' + (e && e.lineno ? e.lineno : '')); });
window.addEventListener('unhandledrejection', function(e){ var r = e && e.reason; logClientError('promise: ' + (r && r.message ? r.message : String(r)), ''); });
