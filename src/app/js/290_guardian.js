/* ===== ولي الأمر: الموافقة والرمز والبوابة ===== */
function parentalGate(onPass, purpose){
  if (guardianPinSet()){ pinGate(onPass, purpose); return; }
  arithmeticGate(function(){ if (hasConsent()) pinSetupDialog(onPass, 'ضع رمزًا من 4 أرقام لولي الأمر. سيُطلب بدل المسألة الحسابية من الآن.'); else onPass(); }, purpose);
}
function arithmeticGate(onPass, purpose, waitSec){
  var old = document.getElementById('parent-gate'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'parent-gate';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:380px;width:100%;padding:18px;text-align:center;line-height:1.8';
  var h = document.createElement('h3'); h.style.cssText = 'margin:0 0 6px'; h.textContent = '🔒 لولي الأمر فقط';
  var p = document.createElement('p'); p.style.cssText = 'margin:0 0 8px'; p.textContent = (purpose || 'هذه الإعدادات لولي الأمر.') + ' اكتب ناتج الضرب للمتابعة:';
  var q = document.createElement('div'); q.id = 'parent-gate-q'; q.style.cssText = 'font-size:1.7rem;font-weight:800;direction:ltr;margin:6px 0';
  var inp = document.createElement('input'); inp.id = 'parent-gate-answer'; inp.type = 'text'; inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('autocomplete', 'off'); inp.maxLength = 4;
  inp.style.cssText = 'width:120px;font-size:1.3rem;text-align:center;padding:8px;border:2px solid #cfd8dc;border-radius:12px;direction:ltr';
  var msg = document.createElement('div'); msg.id = 'parent-gate-msg'; msg.style.cssText = 'min-height:1.6em;color:#b3261e;font-size:.9rem;margin:6px 0';
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
  var ok = document.createElement('button'); ok.type = 'button'; ok.id = 'parent-gate-ok'; ok.className = 'btn primary'; ok.textContent = 'متابعة';
  var cancel = document.createElement('button'); cancel.type = 'button'; cancel.id = 'parent-gate-cancel'; cancel.className = 'btn ghost'; cancel.textContent = 'إلغاء';
  row.appendChild(ok); row.appendChild(cancel);
  [h, p, q, inp, msg, row].forEach(function(e){ card.appendChild(e); });
  ov.appendChild(card); document.body.appendChild(ov);
  var a = 0, b = 0, tries = 0;
  function newQ(){ do { a = 12 + Math.floor(Math.random() * 88); } while (a % 10 === 0 || a % 11 === 0); b = 3 + Math.floor(Math.random() * 7); q.textContent = a + ' × ' + b + ' = ?'; inp.value = ''; }
  newQ();
  if (waitSec > 0){ // 9.39.13 (D7): استعادة الرمز المنسي حاجز صبر لا يحتمله طفل
    ok.disabled = true; inp.disabled = true; var left = waitSec;
    var tick = function(){ if (!document.body.contains(ov)) return; if (left <= 0){ ok.disabled = false; inp.disabled = false; msg.textContent = ''; try { inp.focus(); } catch(e){} return; } msg.textContent = '⏳ انتظر ' + left + ' ثانية ثم اكتب الناتج.'; left--; setTimeout(tick, 1000); };
    tick();
  }
  function check(){
    if (ok.disabled) return;
    if (toLatinDigits(inp.value) === String(a * b)){ ov.remove(); onPass(); return; }
    tries++;
    if (tries >= 3){
      ok.disabled = true; inp.disabled = true; msg.textContent = 'محاولات كثيرة. انتظر 30 ثانية.';
      setTimeout(function(){ if (!document.body.contains(ov)) return; ok.disabled = false; inp.disabled = false; tries = 0; msg.textContent = ''; newQ(); }, 30000);
      return;
    }
    msg.textContent = 'الإجابة غير صحيحة. هذه مسألة أخرى.'; newQ();
  }
  ok.onclick = check;
  cancel.onclick = function(){ ov.remove(); };
  inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') check(); });
  try { inp.focus(); } catch(e){}
}
function guardianPinSet(){ var p = STATE.student && STATE.student.guardianPin; return !!(p && typeof p.h === 'string' && typeof p.s === 'string'); }
function guardianPinProblem(a, b){
  a = toLatinDigits(a); b = toLatinDigits(b);
  if (!/^[0-9]{4}$/.test(a)) return 'رمز ولي الأمر أربعة أرقام.';
  if (a !== b) return 'الرمزان غير متطابقين.';
  if (/^(\d)\1{3}$/.test(a) || '0123456789'.indexOf(a) >= 0 || '9876543210'.indexOf(a) >= 0) return 'اختر رمزًا لا يسهل تخمينه (لا 1111 ولا 1234).';
  return '';
}
async function guardianPinHash(pin, salt){ return sha256b64('rifaq-guardian-pin|' + salt + '|' + toLatinDigits(pin)); }
async function setGuardianPin(pin){
  var u = new Uint8Array(16); crypto.getRandomValues(u); var salt = b64FromBytes(u);
  STATE.student = STATE.student || {};
  STATE.student.guardianPin = {s: salt, h: await guardianPinHash(pin, salt), at: new Date().toISOString()};
  save();
}
function gateShell(title, text){
  var old = document.getElementById('parent-gate'); if (old) old.remove();
  var ov = document.createElement('div'); ov.id = 'parent-gate';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:380px;width:100%;padding:18px;text-align:center;line-height:1.8';
  var h = document.createElement('h3'); h.style.cssText = 'margin:0 0 6px'; h.textContent = title;
  var p = document.createElement('p'); p.style.cssText = 'margin:0 0 8px'; p.textContent = text;
  card.appendChild(h); card.appendChild(p); ov.appendChild(card); document.body.appendChild(ov);
  return {ov: ov, card: card};
}
function pinInput(id, ph){
  var i = document.createElement('input'); i.id = id; i.type = 'password'; i.setAttribute('inputmode', 'numeric'); i.setAttribute('autocomplete', 'off'); i.maxLength = 4; i.placeholder = ph || '••••';
  i.style.cssText = 'width:130px;font-size:1.4rem;letter-spacing:.4em;text-align:center;padding:8px;border:2px solid #cfd8dc;border-radius:12px;direction:ltr;margin:4px';
  return i;
}
function pinGate(onPass, purpose){
  var g = gateShell('🔒 لولي الأمر فقط', (purpose || 'هذه الإعدادات لولي الأمر.') + ' اكتب رمز ولي الأمر:');
  var inp = pinInput('parent-gate-pin'); g.card.appendChild(inp);
  var msg = document.createElement('div'); msg.id = 'parent-gate-msg'; msg.style.cssText = 'min-height:1.6em;color:#b3261e;font-size:.9rem;margin:6px 0'; g.card.appendChild(msg);
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
  var ok = document.createElement('button'); ok.type = 'button'; ok.id = 'parent-gate-ok'; ok.className = 'btn primary'; ok.textContent = 'متابعة';
  var cancel = document.createElement('button'); cancel.type = 'button'; cancel.id = 'parent-gate-cancel'; cancel.className = 'btn ghost'; cancel.textContent = 'إلغاء';
  row.appendChild(ok); row.appendChild(cancel); g.card.appendChild(row);
  var forgot = document.createElement('button'); forgot.type = 'button'; forgot.id = 'parent-gate-forgot'; forgot.className = 'btn ghost'; forgot.textContent = 'نسيت الرمز؟';
  forgot.style.cssText = 'margin-top:8px;font-size:.85rem'; g.card.appendChild(forgot);
  var tries = 0;
  async function check(){
    if (ok.disabled) return;
    var p = STATE.student.guardianPin, v = toLatinDigits(inp.value);
    if (/^[0-9]{4}$/.test(v) && await guardianPinHash(v, p.s) === p.h){ g.ov.remove(); onPass(); return; }
    tries++; inp.value = '';
    if (tries >= 3){
      ok.disabled = true; inp.disabled = true; msg.textContent = 'محاولات كثيرة. انتظر 30 ثانية.';
      setTimeout(function(){ if (!document.body.contains(g.ov)) return; ok.disabled = false; inp.disabled = false; tries = 0; msg.textContent = ''; }, 30000);
      return;
    }
    msg.textContent = 'الرمز غير صحيح.';
  }
  ok.onclick = check;
  cancel.onclick = function(){ g.ov.remove(); };
  forgot.onclick = function(){ g.ov.remove(); arithmeticGate(function(){ pinSetupDialog(onPass, 'ضع رمزًا جديدًا لولي الأمر (4 أرقام).'); }, 'استعادة رمز ولي الأمر.', 60); };
  inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') check(); });
  try { inp.focus(); } catch(e){}
}
function pinSetupDialog(onDone, text){
  var g = gateShell('🔑 رمز ولي الأمر', text || 'ضع رمزًا من 4 أرقام.');
  var a = pinInput('pin-new', 'الرمز'), b = pinInput('pin-new2', 'أعده'); g.card.appendChild(a); g.card.appendChild(b);
  var msg = document.createElement('div'); msg.id = 'pin-new-msg'; msg.style.cssText = 'min-height:1.6em;color:#b3261e;font-size:.9rem;margin:6px 0'; g.card.appendChild(msg);
  var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
  var ok = document.createElement('button'); ok.type = 'button'; ok.id = 'pin-new-ok'; ok.className = 'btn success'; ok.textContent = 'حفظ الرمز';
  var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn ghost'; cancel.textContent = 'إلغاء';
  row.appendChild(ok); row.appendChild(cancel); g.card.appendChild(row);
  ok.onclick = async function(){
    var e = guardianPinProblem(a.value, b.value); if (e){ msg.textContent = e; return; }
    ok.disabled = true;
    try { await setGuardianPin(a.value); } catch(x){ ok.disabled = false; msg.textContent = 'تعذّر حفظ الرمز.'; return; }
    g.ov.remove(); toast('🔑 حُفظ رمز ولي الأمر.'); onDone();
  };
  cancel.onclick = function(){ g.ov.remove(); };
  try { a.focus(); } catch(e){}
}
function openGuardianSettings(){ parentalGate(openGuardianSettingsInner); }
function openGuardianSettingsInner(){
  var c = STATE.student && STATE.student.consent;
  var hasC = !!(c && c.v === CONSENT_VERSION);
  var ov = document.createElement('div');
  ov.id = 'guardian-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  if (!hasC){
    var card0 = document.createElement('div');
    card0.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:440px;width:100%;padding:18px;font-size:1rem;line-height:1.8';
    card0.innerHTML = '<h3 data-style="margin:0 0 8px">⚙️ إعدادات ولي الأمر</h3><p>لا توجد موافقة مسجّلة على هذا الجهاز بعد؛ تُطلب عند أول تسجيل صوتي.</p>' +
      '<p data-style="font-size:.85rem"><b>التصفير:</b> يحذف تقدّم الطالب وبياناته من هذا الجهاز.</p>' +
      '<button type="button" id="gs-delete" class="btn" data-style="background:#b3261e;color:#fff">🔄 تصفير: حذف بيانات الطالب من هذا الجهاز</button>' +
      '<div data-style="display:flex;justify-content:flex-end;margin-top:10px"><button type="button" id="gs-close" class="btn">إغلاق</button></div>';
    ov.appendChild(card0); document.body.appendChild(ov);
    guardianExtras(card0, ov); // 9.39.13 (D12، D7)
    $('gs-close').onclick = function(){ ov.remove(); };
    $('gs-delete').onclick = function(){ ov.remove(); deleteChildDataOnDevice(); };
    return;
  }
  var rows = Object.keys(STATE.studentAudios || {}).filter(function(k){ return STATE.studentAudios[k] && STATE.studentAudios[k].status !== undefined; }).map(function(k){
    var ex = !!(c.excludedRecordings && c.excludedRecordings[k]);
    return '<label data-style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" class="gs-rec" data-id="'+k+'" '+(ex?'':'checked')+'> شارِك تسجيل: '+escapeHTML(itemLabelById(k))+'</label>';
  }).join('') || '<p>لا توجد تسجيلات بعد.</p>';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:440px;width:100%;padding:18px;font-size:1rem;line-height:1.8;max-height:92vh;overflow:auto';
  card.innerHTML = '<h3 data-style="margin:0 0 8px">⚙️ إعدادات ولي الأمر</h3>' +
    '<label data-style="display:flex;gap:8px;align-items:center;margin:10px 0"><input id="gs-share" type="checkbox" '+(c.permissions && c.permissions.shareWithPeers ? 'checked' : '')+'> <b>السماح بمشاركة التسجيلات المعتمدة مع زملاء</b></label>' +
    '<p data-style="margin:6px 0">يمكنك استبعاد أي تسجيل بعينه:</p>' + rows +
    '<p data-style="font-size:.85rem;color:#555">تطبيق الإعدادات على الحزم المصدَّرة من الآن. الملفات التي نُسخت سابقًا لا تُسترجع.</p>' +
    '<hr><p data-style="font-size:.85rem"><b>حذف البيانات:</b> يحذف تسجيلات الطفل وتقدمه وموافقته من هذا الجهاز. لا يحذف ملف الحزمة المحفوظ ولا ما أُرسل إلى المعلم أو الزملاء.</p>' +
    '<button type="button" id="gs-summary" class="btn">📄 ملخص لولي الأمر</button> ' +
    '<button type="button" id="gs-report" class="btn">🖨️ تقرير للطباعة</button> ' +
    '<button type="button" id="gs-archive" class="btn">💾 تصدير ذكرى العائلة</button> ' +
    '<button type="button" id="gs-delete" class="btn" data-style="background:#b3261e;color:#fff">🔄 تصفير: حذف بيانات الطالب من هذا الجهاز</button>' +
    '<div data-style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button type="button" id="gs-close" class="btn">إغلاق</button><button type="button" id="gs-save" class="btn success">حفظ</button></div>';
  ov.appendChild(card); document.body.appendChild(ov);
  guardianExtras(card, ov); // 9.39.13 (D12، D7)
  $('gs-close').onclick = function(){ ov.remove(); };
  $('gs-delete').onclick = function(){ deleteChildDataOnDevice(); };
  $('gs-summary').onclick = function(){ showParentSummary(); };
  $('gs-archive').onclick = function(){ exportFamilyArchive(); };
  $('gs-report').onclick = function(){ showPrintableReport(); };
  $('gs-save').onclick = function(){
    var ex = {};
    Array.prototype.forEach.call(document.querySelectorAll('.gs-rec'), function(cb){ if (!cb.checked) ex[cb.getAttribute('data-id')] = true; });
    c.permissions = c.permissions || {record: true, review: true};
    c.permissions.shareWithPeers = !!$('gs-share').checked;
    c.excludedRecordings = ex;
    save(); ov.remove(); alert('تم حفظ الإعدادات.');
  };
}
function hasConsent(){
  var c = STATE.student && STATE.student.consent;
  return !!(c && c.v === CONSENT_VERSION && c.guardian && c.permissions && c.permissions.record === true && c.permissions.review === true);
}
function consentForExport(){
  var c = STATE.student && STATE.student.consent;
  if (!c || c.v !== CONSENT_VERSION) return null;
  var perm = c.permissions || {};
  return {v: CONSENT_VERSION, guardian: String(c.guardian || '').slice(0, 60), at: String(c.at || '').slice(0, 40),
    permissions: {record: perm.record === true, review: perm.review === true, shareWithPeers: perm.shareWithPeers === true},
    excludedRecordings: Object.keys(c.excludedRecordings || {}).slice(0, 200).reduce(function(o,k){ o[String(k).slice(0,64)] = true; return o; }, {})};
}
function sharesWithPeers(){
  var c = STATE.student && STATE.student.consent;
  return !!(c && c.v === CONSENT_VERSION && c.permissions && c.permissions.shareWithPeers === true);
}
/* القرار DECISION-001: ثلاثة أذونات مستقلة، والمشاركة غير مفعّلة افتراضيًا */
function ensureConsent(onAccept){
  if (hasConsent()){ onAccept(); return; }
  var ov = document.createElement('div');
  ov.id = 'consent-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#222;border-radius:18px;max-width:440px;width:100%;padding:18px;font-size:1rem;line-height:1.8;max-height:92vh;overflow:auto';
  card.innerHTML = '<h3 data-style="margin:0 0 8px">🛡️ موافقة ولي الأمر</h3>' +
    '<label data-style="display:block;margin:8px 0 4px">اسم ولي الأمر:</label>' +
    '<input id="consent-name" type="text" maxlength="60" data-style="width:100%;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:12px;font:inherit">' +
    (guardianPinSet() ? '' : '<label data-style="display:block;margin:10px 0 4px">رمز ولي الأمر (4 أرقام) — يُطلب قبل الإعدادات والتصفير، فلا {تخبر|تخبري} به الطفل:</label>' +
      '<div data-style="display:flex;gap:8px"><input id="consent-pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="4" placeholder="الرمز" data-style="flex:1;min-width:0;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:12px;font:inherit;text-align:center;direction:ltr">' +
      '<input id="consent-pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="4" placeholder="أعده" data-style="flex:1;min-width:0;box-sizing:border-box;padding:10px;border:2px solid #cfd8dc;border-radius:12px;font:inherit;text-align:center;direction:ltr"></div>') +
    '<label data-style="display:flex;gap:8px;align-items:flex-start;margin:12px 0"><input id="consent-record" type="checkbox" data-style="margin-top:6px"> <span><b>أوافق</b> على تسجيل صوت الطفل وحفظه على هذا الجهاز للتعلم.</span></label>' +
    '<label data-style="display:flex;gap:8px;align-items:flex-start;margin:12px 0"><input id="consent-review" type="checkbox" data-style="margin-top:6px"> <span><b>أوافق</b> على إرسال التسجيلات إلى المعلم للمراجعة التعليمية فقط.</span></label>' +
    '<label data-style="display:flex;gap:8px;align-items:flex-start;margin:12px 0;background:#f5f5f5;border-radius:10px;padding:8px"><input id="consent-share" type="checkbox" data-style="margin-top:6px"> <span><b>اختياري:</b> أوافق على أن تُضمَّن التسجيلات المعتمدة في حزم تصل إلى أطفال آخرين. يمكنني استبعاد أي تسجيل، وسحب هذه الموافقة في أي وقت (لا يسترجع ذلك ما سبق نسخه).</span></label>' +
    '<p id="consent-err" data-style="color:#b3261e;margin:4px 0;min-height:1.2em"></p>' +
    '<div data-style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button type="button" id="consent-no" class="btn">إلغاء</button><button type="button" id="consent-ok" class="btn success">حفظ وابدأ</button></div>';
  ov.appendChild(card); document.body.appendChild(ov);
  $('consent-no').onclick = function(){ ov.remove(); };
  $('consent-ok').onclick = async function(){
    var name = ($('consent-name').value || '').trim().slice(0, 60);
    if (name.length < 3){ $('consent-err').textContent = 'اكتب اسم ولي الأمر (٣ أحرف على الأقل).'; return; }
    var pinErr = $('consent-pin') ? guardianPinProblem($('consent-pin').value, $('consent-pin2').value) : ''; // 9.39.13 (D7)
    if (pinErr){ $('consent-err').textContent = pinErr; return; }
    if (!$('consent-record').checked || !$('consent-review').checked){ $('consent-err').textContent = 'الموافقتان الأولى والثانية مطلوبتان للتسجيل.'; return; }
    if ($('consent-pin')){ try { await setGuardianPin($('consent-pin').value); } catch(e){ $('consent-err').textContent = 'تعذّر حفظ الرمز على هذا الجهاز.'; return; } }
    STATE.student = STATE.student || {};
    STATE.student.consent = {v: CONSENT_VERSION, guardian: name, at: new Date().toISOString(),
      permissions: {record: true, review: true, shareWithPeers: !!$('consent-share').checked},
      excludedRecordings: {}};
    save(); ov.remove(); onAccept();
  };
}
/* ===== 9.35: موافقة ولي الأمر تُطلب عند حفظ بيانات الطالب، لا عند أول تسجيل (وقت الولي هنا) ===== */
function askConsentAfterSetup(){
  setTimeout(function(){ if (STATE.student && STATE.student.name && !hasConsent()) ensureConsent(function(){}); }, 300);
}
var CONSENT_VERSION = 2;
