// أداة فحص المنهج: node qx_validate.js curriculum.json
// تفحص الأسئلة التفاعلية بنفس شيفرة التطبيق، وتفحص الأنواع الثلاثة التقليدية أيضًا.
var fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(__dirname, 'qx_core.js'), 'utf8') + '; global.QX = QX;');
var d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), E = [], W = [], ids = {}, n = {};
d.forEach(function(sec){
  if (!sec.id || !sec.title) E.push('قسم بلا id/عنوان');
  (sec.items || []).forEach(function(it){ if (ids[it.id]) E.push('معرّف مكرر ' + it.id); ids[it.id] = 1; if (!it.text) E.push(sec.id + '/' + it.id + ': نص فارغ'); });
  (sec.questions || []).forEach(function(q){
    if (ids[q.id]) E.push('معرّف مكرر ' + q.id); ids[q.id] = 1; n[q.type] = (n[q.type] || 0) + 1;
    if (QX.has(q.type)){ var r = QX.normalize(q); r.errors.forEach(function(e){ E.push(sec.id + '/' + q.id + ' (' + q.type + '): ' + e); }); return; }
    if (q.type === 'true_false'){ if (typeof q.answer !== 'boolean') E.push(q.id + ': answer يجب true/false'); }
    else if (q.type === 'multiple_choice' || q.type === 'extraction'){ if (!Array.isArray(q.options) || q.options.length < 2 || !(q.answer >= 0 && q.answer < q.options.length)) E.push(q.id + ': options/answer'); }
    else E.push(q.id + ': نوع غير معروف ' + q.type);
    if (!q.explanation) E.push(q.id + ': تعليل فارغ');
  });
});
console.log('الأقسام:', d.length, '| الأسئلة حسب النوع:', JSON.stringify(n));
W.forEach(function(w){ console.log('⚠', w); }); E.forEach(function(e){ console.log('✖', e); });
console.log(E.length ? ('✖ ' + E.length + ' خطأ') : '✔ نجح الفحص'); process.exit(E.length ? 1 : 0);
