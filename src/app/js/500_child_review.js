/* ===== 9.35: موافقة ولي الأمر تُطلب عند حفظ بيانات الطالب، لا عند أول تسجيل (وقت الولي هنا) ===== */
function askConsentAfterSetup(){
  setTimeout(function(){ if (STATE.student && STATE.student.name && !hasConsent()) ensureConsent(function(){}); }, 300);
}
