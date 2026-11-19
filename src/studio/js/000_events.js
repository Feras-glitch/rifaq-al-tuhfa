/* 9.39.12 (E1): موزّع الأحداث — لا معالجات مضمَّنة؛ data-call = ["اسم الدالة", وسائط...]، وdata-change = اسم دالة تستقبل الحدث */
var STUDIO_CALLABLE = ['clickById','startStudio','showSupervisorPublicKey','exportSheikhPack','newWorkspace','showResetDialog','toggleGroup','playRecording','startRec','deleteRec','recordNextVerse','openSheikhReview','closeSheikhReview','reviewDecide','exportSheikhReview',
  'startTeamMember','backToSetup','setRecRole','openRecSession','closeRecSession','recSessionToggle','recSessionMove','exportRecBundle','openRecSheet','closeRecSheet','printRecSheet'];
var STUDIO_CHANGE = ['handleSheikhPhoto','handleSupervisorPhoto','handlePoemReciterPhoto','handleSchoolLogo','importCurriculum','uploadRec','importRecBundle','importNamedAudio'];
function clickById(id){ var el = document.getElementById(String(id)); if (el) el.click(); }
document.addEventListener('click', function(ev){
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-call]') : null;
  if (!el || el.disabled) return;
  var spec; try { spec = JSON.parse(el.getAttribute('data-call')); } catch(e){ return; }
  if (!Array.isArray(spec) || typeof spec[0] !== 'string' || STUDIO_CALLABLE.indexOf(spec[0]) < 0) return;
  var fn = window[spec[0]]; if (typeof fn === 'function') fn.apply(null, spec.slice(1).map(String));
});
document.addEventListener('change', function(ev){
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-change]') : null;
  if (!el) return;
  var name = el.getAttribute('data-change');
  if (STUDIO_CHANGE.indexOf(name) < 0 || typeof window[name] !== 'function') return;
  var arg = el.getAttribute('data-arg');
  if (arg === null) window[name](ev); else window[name](ev, arg);
});
var APP_VERSION = '@@APP_VERSION@@';
