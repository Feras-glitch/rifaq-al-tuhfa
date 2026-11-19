/* Snapshot of the untouched page (taken before any rendering) used for clean exports. The PACK data block is cut out to save memory. */
var TEMPLATE_HEAD = null, TEMPLATE_TAIL = null;
(function(){
  try {
    var m1 = '/* ===PACK_DATA_' + 'START=== */', m2 = '/* ===PACK_DATA_' + 'END=== */';
    var h = '<!doctype html>\n' + document.documentElement.outerHTML;
    var a = h.indexOf(m1); var b = a < 0 ? -1 : h.indexOf(m2, a);
    if (a >= 0 && b > a){ TEMPLATE_HEAD = h.substring(0, a); TEMPLATE_TAIL = h.substring(b + m2.length); }
  } catch(e) { console.warn('template snapshot failed', e); }
})();
var MAX_HTML_WARN_BYTES = 25 * 1024 * 1024;
var APP_VERSION = '@@APP_VERSION@@';
var SCHEMA_VERSION = 2;
var PACK_SOURCE_VERSION = '';
var PACK_COMPATIBLE = true;
