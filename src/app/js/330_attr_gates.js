/* ===== 9.19: بوابات الخاصيات قبل أي إدراج في HTML =====
   أي قيمة تُدرج في src يجب أن تطابق صيغة data: صحيحة، وإلا تُستبدل بسلسلة فارغة.
   هذا يحمي حتى لو فشل التعقيم العام. */
var IMG_DATA_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/]+=*$/;
var AUD_DATA_RE = /^data:(audio|video)\/[a-z0-9.+\-]+(;codecs=[a-z0-9.,\-]+)?;base64,[A-Za-z0-9+\/]*=*$/i;
function imgSrc(v){ v = (v === null || v === undefined) ? '' : String(v); return IMG_DATA_RE.test(v) ? v : ''; }
function audSrc(v){ v = (v === null || v === undefined) ? '' : String(v); return AUD_DATA_RE.test(v) ? v : ''; }

