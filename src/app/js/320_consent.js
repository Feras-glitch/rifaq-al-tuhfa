/* ===== 9.18: موافقة ولي الأمر قبل أي تسجيل صوتي لطفل ===== */
/* صيغة {مذكر|مؤنث} تُختار حسب جنس الطفل المسجَّل */
/* 9.39: تمييز العدد العربي للعدادات */
function arCount(n, one, two, few){ n = Number(n) || 0; if (n === 1) return one + ' واحد'; if (n === 2) return two; if (n >= 3 && n <= 10) return n + ' ' + few; return n + ' ' + one + (one.slice(-1) === 'ة' ? '' : 'ًا'); }
function GT(t){ if (t === null || t === undefined) return t; var fem = !!(STATE.student && STATE.student.gender === 'girl'); return String(t).replace(/\{([^{}|]*)\|([^{}]*)\}/g, function(_, m, f){ return fem ? f : m; }); }
