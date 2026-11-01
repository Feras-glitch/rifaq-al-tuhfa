# صيغة حزمة الملف (PACK_DATA)

كل ملف HTML مُصدَّر يحمل كتلة واحدة بين العلامتين:
```
/* ===PACK_DATA_START=== */
var PACK_DATA = {...};
/* ===PACK_DATA_END=== */
```
عند فتح الملف يُفحص المحتوى وتُعقَّم الحقول (`sanitizePackData`) قبل أي عرض. الحقول غير المعروفة تُهمَل.

## نوع الحزمة (`packageType`) يحدد الدور
| القيمة | الدور | متى تُنشأ | من يفتحها |
|---|---|---|---|
| `student_fresh` | الطالب | الاستوديو (قالب المشرف) | الطفل: يدخل اسمه ويسجّل |
| `student_submission` | المعلم | الطالب بعد التسجيل | المعلم: يستمع ويعتمد أو يرفض |
| `student_returned` | الطالب | المعلم عند الرفض | الطفل: يرى ملاحظة المعلم ويعيد التسجيل |
| `approved_gift` | المستلم الجديد | المعلم عند الاعتماد | طفل جديد: يدخل هويته ويبدأ |
| `teacher_review` | المعلم | (محجوز) | — |

## الحقول الرئيسية
| الحقل | المعنى | يظهر في |
|---|---|---|
| `packageId` | معرّف الحزمة (ثابت عبر الأجيال) | الكل |
| `curriculum` | الأقسام والأسئلة (انظر AUTHOR_GUIDE) | الكل |
| `appVersion`, `schemaVersion` | إصدار التطبيق ومخطط البيانات | الكل |
| `sheikhName`, `sheikhPhoto` | الشيخ/القارئ (شخصية واحدة) | الكل |
| `poemReciterName`, `poemReciterPhoto` | منشد الأبيات | الكل |
| `supervisorName`, `supervisorPhoto`, `supervisorGender` | المشرف | الكل |
| `teacherName`, `teacherGender`, `teacherPhoto` | المعلم المراجع | الكل |
| `masterAudios` | تسجيلات الشيخ والمنشد (مرجع) | الكل |
| `studentName`, `studentId`, `studentGender`, `studentPhoto` | هوية الطالب | الطالب والمعلم |
| `studentAudios` | تسجيلات الطالب: `{id: {audio, status, feedback?, partial?}}`، و`status` ∈ pending / approved / rejected | الطالب والمعلم |
| `studentConsent` | موافقة ولي الأمر: `{v, guardian, at}` | المعلم (لا يُنقل إلى الإهداء) |
| `teacherFeedbacks` | تعليقات صوتية للرفض `{id: dataURL}` | الطالب |
| `teacherNotes` | ملاحظات مكتوبة للرفض `{id: text≤400}` | الطالب |
| `reviewCount`, `submissionVersion` | عداد المراجعات | المعلم |
| `approvedPeerRecordings` | مجموعات تسجيلات الزملاء المعتمدة: `[{id, name, gender, photo, audios}]` | الكل |
| `sourceGiftStudentName`, `sourceGiftStudentPhoto`, `sourceGiftStudentGender` | صاحب الإهداء (للعرض فقط) | المستلم |
| `recipientSetupRequired` | يطلب من المستلم إدخال هويته | المستلم |
| `trustedTeacherKeys` | مفاتيح المعلمين الموثوقة بصيغة JWK (P-256) | الكل |
| `signature` | توقيع الاعتماد: `{alg, key, sig, signedAt}` | المستلم (يتحقق منه) |

## ما يُنقل إلى ملف الإهداء ولا يُنقل
- يُنقل: المحتوى، وتسجيلات الزملاء المعتمدة، والشيخ، والمشرف، والمعلم، ومفاتيح الثقة، وتوقيع الاعتماد.
- لا يُنقل: هوية الطفل الأصلي، وصورته، ومعرّفه، وتسجيلاته الخاصة، **وموافقة ولي الأمر**.

## تسجيلات الطالب والمعلم
- `studentAudios` لتسجيلات الطالب الحالي، و`approvedPeerRecordings` لتسجيلات الزملاء المعتمدة. لا تختلطان.
- التسجيل المعتمد لا يُستبدل من الطالب.
