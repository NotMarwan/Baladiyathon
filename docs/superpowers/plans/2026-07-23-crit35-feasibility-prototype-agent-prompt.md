# برومبت الجدوى وجودة النموذج الأولي

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**

رفع معيار الجدوى وقابلية التنفيذ ومعيار جودة النموذج الأولي فقط، عبر إصلاح أخطاء معنى القرار والتصدير والتحقق من المدخلات بدلاً من إضافة مزايا جديدة.

**Architecture:**

جدولة ممثلة بنوافذ زمنية فعلية، وتصدير مطابق لها، وواجهة برمجية تفشل بإغلاق عند نقص المدخلات، وتوجيه يحسب السعة بعد تحميل الحركة المحولة، مع اختبارات تكامل قابلة للتكرار.

**Tech Stack:**

`JavaScript`

`Node.js`

`node:http`

`node:assert`

`HTML`

**Global Constraints:**

لا تعدّل أي ملف خارج قائمة الملكية. لا تفوّض العمل إلى وكلاء فرعيين. لا تسأل المستخدم. لا تغيّر العرض أو الادعاءات التسويقية أو نموذج الأثر. ابدأ بإعادة إنتاج كل خلل باختبار فاشل، واعزل السبب الجذري، ثم أصلح طبقة واحدة في كل مرة.

## البرومبت الجاهز للنسخ

انسخ النص من بداية السياج التالي إلى نهايته وأرسله كاملاً إلى الوكيل.

```text
أنت مسؤول عن معيارين فقط:

٣. الجدوى وقابلية التنفيذ.
٥. جودة النموذج الأولي.

مهمتك إصلاح صحة السلوك التشغيلي للنموذج، لا تحسين العرض ولا إضافة فكرة ابتكارية جديدة.

اعمل باستقلال كامل حتى التسليم. لا تسألني، ولا تنتظر رداً، ولا تنشئ وكلاء فرعيين. لا تبدأ بالإصلاح. ابدأ بإعادة إنتاج العيب وتحديد مكان نشوء القيمة الخاطئة.

استخدم هذه المراحل لكل عيب:

١. إعادة إنتاج ثابتة بأرقام معروفة.
٢. تتبع القيمة من الإدخال إلى الإخراج.
٣. مقارنة بعقد صحيح أو نمط سليم في المستودع.
٤. فرضية سبب واحدة.
٥. أصغر اختبار يدحضها أو يثبتها.
٦. اختبار فاشل.
٧. إصلاح واحد.
٨. تحقق كامل من عدم التراجع.

إذا فشلت ثلاث محاولات للعيب نفسه، توقف عن الترقيع وراجع بنية تمثيل الجدول أو عقد البيانات.

مسار العمل:

C:\Users\wasan\Downloads\Swarm\Baladiyathon

ابدأ بقراءة هذه الملفات كاملة:

docs\FINAL-STRICT-EVALUATION.md
docs\FEASIBILITY.md
docs\REPORT-crit35.md
presentation\athar-engine.js
presentation\athar-routing.js
presentation\server.js
presentation\athar-prototype.html
presentation\README-athar.md
presentation\tests\engine-test.js
presentation\tests\routing-test.js
presentation\tests\ui-smoke-test.js

شغّل خط الأساس:

node presentation/tests/engine-test.js
node presentation/tests/ui-smoke-test.js
node presentation/tests/routing-test.js
node presentation/tests/innovation-test.js

حدود الملكية صارمة.

يمكنك تعديل هذه الملفات فقط:

presentation\athar-engine.js
presentation\athar-routing.js
presentation\server.js
presentation\athar-prototype.html
presentation\README-athar.md
presentation\tests\engine-test.js
presentation\tests\routing-test.js
presentation\tests\ui-smoke-test.js
presentation\tests\server-test.js
docs\FEASIBILITY.md
docs\REPORT-crit35-final.md

لا تعدّل ملفات العرض أو بطاقة الفكرة أو سجل المصادر أو ملفات الأثر أو ملفات القرار الجديدة.

العيوب المثبتة التي يجب إعادة إنتاجها:

العيب الأول:

طلب مدته عشر ساعات ليلاً يحتسب كليلتين كاملتين، أي ست عشرة ساعة. السبب المرجح أن عدد الليالي يقرب للأعلى ثم تضرب كل ليلة في ثماني ساعات.

المواضع التي يجب تتبعها:

presentation\athar-engine.js

حول الأسطر:

218
240
247

العيب الثاني:

التصدير يمثل الجدول الليلي المرحلي كإغلاق متصل واحد، فيخالف البديل الذي اختاره المستخدم.

المواضع التي يجب تتبعها:

presentation\athar-prototype.html

حول الأسطر:

1345
1360

presentation\athar-engine.js

حول الأسطر:

485
512

العيب الثالث:

جسم طلب فارغ يصل إلى المحرك ويعود بنتيجة منخفضة أو صفرية بدلاً من الرفض.

المواضع التي يجب تتبعها:

presentation\server.js

حول السطر:

94

presentation\athar-engine.js

حول السطر:

124

العيب الرابع:

المقارنة الافتراضية تعرض وفراً يقارب ستة وتسعين في المئة لأن خط الأساس المستمر والبديل الليلي لا يمثلان نافذة تشغيل قابلة للمقارنة.

العيب الخامس:

المسار البديل يعرض سعة متبقية قبل تحميل الحركة المحولة عليه، ولذلك قد يبدو صالحاً وهو غير صالح بعد التحويل.

المواضع التي يجب تتبعها:

presentation\athar-routing.js

حول الأسطر:

109
205
251

العيب السادس:

مسودة خطة إدارة المرور تستخدم وقت الطلب الأصلي، بينما النص المرئي يستخدم وقت البديل المختار.

المواضع التي يجب تتبعها:

presentation\athar-prototype.html

حول الأسطر:

1573
1576

المهمة الأولى: تثبيت تمثيل الجدول.

لا تجعل البديل الليلي مجرد وقت بداية وعدد ليال. يجب أن يعيد كل بديل مصفوفة نوافذ فعلية.

العقد:

windows

كل نافذة تحتوي:

dayOffset
startHour
durationHours

مثال طلب مدته عشر ساعات يبدأ عند الساعة الثانية والعشرين:

[
  { dayOffset: 0, startHour: 22, durationHours: 8 },
  { dayOffset: 1, startHour: 22, durationHours: 2 }
]

اكتب أولاً الاختبارات التالية في:

presentation\tests\engine-test.js

أضف دالة جمع صريحة داخل الاختبار:

function totalWindowHours(candidate) {
  return candidate.windows.reduce(
    (sum, window) => sum + window.durationHours,
    0
  );
}

أضف حالة عشر ساعات:

test('10-hour night schedule uses one full window and one 2-hour window', () => {
  const result = AtharEngine.optimize({
    aadt: 85000,
    lanes: 4,
    lanesClosed: 1,
    startHour: 22,
    durationHours: 10
  });
  const night = result.candidates.find((item) =>
    Array.isArray(item.windows)
    && item.windows.length === 2
  );
  assert.ok(night, 'expected a phased night candidate');
  assert.deepStrictEqual(
    night.windows.map((item) => item.durationHours),
    [8, 2]
  );
  assert.strictEqual(totalWindowHours(night), 10);
});

عدّل الوصول إلى النتيجة وفق العقد الحقيقي للدالة بعد قراءته، لكن لا تخفف التوقع.

أضف حالات الحدود:

- ساعة واحدة.
- ثماني ساعات.
- تسع ساعات.
- ست عشرة ساعة.
- سبع عشرة ساعة.
- مدة كسرية إذا كان العقد يسمح بها.

في كل حالة يجب أن يساوي مجموع مدد النوافذ مدة الطلب بدقة.

نفّذ دالة واحدة لبناء النوافذ، واستخدمها في الحساب والتصدير والعرض. لا تحسب عدد الليالي بطريقة مستقلة في ثلاثة مواضع.

واجهة الدالة المقترحة:

function buildNightWindows(startHour, durationHours, maxNightHours) {
  const windows = [];
  let remaining = durationHours;
  let dayOffset = 0;
  while (remaining > 0) {
    const duration = Math.min(maxNightHours, remaining);
    windows.push({ dayOffset, startHour, durationHours: duration });
    remaining -= duration;
    dayOffset += 1;
  }
  return windows;
}

تحقق من صحة القيم قبل الحلقة. لا تسمح بمدة غير موجبة أو وقت خارج النطاق.

المهمة الثانية: جعل كل الحسابات تقرأ النوافذ نفسها.

احسب الأثر لكل نافذة منفصلة ثم اجمع النتائج. لا تعامل الفاصل النهاري بين نافذتين كإغلاق.

يجب أن يكون خط الأساس والبديل قابلين للمقارنة على مدة العمل نفسها. إذا كان خط الأساس مستمراً، اذكر ذلك صراحة ولا تسم الوفر نتيجة تشغيلية مكافئة. الأفضل أن تبني خط أساس من النوافذ نفسها مع تغيير توقيت التنفيذ فقط.

اكتب اختباراً يثبت:

- مجموع ساعات خط الأساس يساوي مجموع ساعات البديل.
- لا توجد ساعة إغلاق بين نهاية نافذة ليلية وبداية التالية.
- الوفر لا ينتج من مقارنة عشر ساعات بست عشرة ساعة.
- البدائل الثلاثة الأولى ليست متطابقة في النوافذ والنتيجة.

المهمة الثالثة: إصلاح التصدير ومسودة خطة المرور.

يجب أن ينشئ التصدير معلماً منفصلاً لكل نافذة فعلية، أو تمثيلاً معيارياً مكافئاً لا يدعي الاستمرارية.

لكل نافذة:

start_date
end_date
dayOffset
durationHours

يجب أن يكون عدد عناصر الإغلاق في التصدير مساوياً لعدد النوافذ.

أضف فحوصاً في:

presentation\tests\ui-smoke-test.js

تثبت أن:

- مسار التصدير يمرر النوافذ المختارة.
- لا يعيد تكوين الجدول من مدة الطلب الأصلية.
- مسودة خطة المرور تقرأ وقت البديل المختار.
- الوقت الظاهر والوقت المطبوع متطابقان.
- مجموع مدد عناصر التصدير يساوي مدة الطلب.

إذا كان اختبار الواجهة الحالي نصياً، أضف أيضاً اختباراً حسابياً في المحرك لدالة إنشاء التصدير. لا تعتمد على مطابقة النص وحدها لإثبات صحة الزمن.

المهمة الرابعة: رفض مدخلات الواجهة البرمجية غير الصالحة.

أنشئ في الخادم عقد تحقق صريحاً لكل مسار.

الحقول الدنيا لمسار حساب الأثر:

aadt
lanes
lanesClosed
startHour
durationHours

القواعد:

- القيم أرقام منتهية.
- الحركة أكبر من صفر.
- عدد المسارات أكبر من صفر.
- عدد المسارات المغلقة بين واحد والعدد الكلي.
- وقت البداية عدد صحيح بين صفر وثلاثة وعشرين.
- المدة أكبر من صفر.

الإدخال الناقص أو غير الصالح يعيد:

422

وشكلاً ثابتاً:

{
  "error": "VALIDATION_ERROR",
  "fields": {
    "aadt": "required"
  }
}

البيانات ذات البنية غير الصالحة تعيد:

400

الحجم الزائد يعيد:

413

لا تغيّر الخطأ الداخلي إلى خطأ إدخال.

أعد هيكلة الخادم بحيث يصدّر:

createServer
validateScoreInput

وشغّل المنفذ الثابت فقط عندما يكون الملف هو نقطة الدخول:

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Athar server listening on http://localhost:${PORT}`);
  });
}

اكتب اختبار تكامل جديداً في:

presentation\tests\server-test.js

استخدم منفذاً عشوائياً:

const assert = require('node:assert');
const { createServer } = require('../server.js');

async function withServer(run) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

اختبر:

- جسم فارغ.
- كائن فارغ.
- حقل ناقص.
- قيمة نصية بدلاً من رقم.
- قيمة غير منتهية عبر مسار الوحدة.
- مسارات مغلقة أكثر من الكلي.
- طلب صحيح.
- بنية غير صالحة.

يجب ألا يفتح استيراد الخادم منفذاً تلقائياً.

المهمة الخامسة: تحميل الحركة المحولة على البدائل.

تتبع أولاً أين تحسب الحركة المتضررة وأين تحسب سعة كل مسار بديل.

عرّف:

divertedVehiclesPerHour

وزّعها على البدائل وفق حصة صريحة مجموعها واحد. إذا لم توجد معايرة، استخدم قاعدة توضيحية معلنة تعتمد على الكلفة النسبية، ولا تدّع أنها سلوك مقاس.

لكل بديل، احسب:

loadedVolumePerHour
volumeCapacityRatioAfterDiversion
residualCapacityAfterDiversion
travelTimeAfterDiversion

لا تعرض السعة قبل التحويل باسم السعة المتبقية.

أضف اختبارات في:

presentation\tests\routing-test.js

استخدم هذه العلاقات:

assert.ok(route.loadedVolumePerHour >= route.baseVolumePerHour);
assert.ok(
  route.residualCapacityAfterDiversion
  <= route.residualCapacityBeforeDiversion
);
assert.ok(route.travelTimeAfterDiversion >= route.freeFlowMinutes);

وأضف حالة يصبح فيها بديل صالح قبل التحويل وغير صالح بعده. يجب أن يخفضه الترتيب أو يوسمه بأنه غير موصى به.

تحقق من حفظ الحركة:

const assigned = alternatives.reduce(
  (sum, route) => sum + route.assignedDivertedVehiclesPerHour,
  0
);
assert.ok(Math.abs(assigned - divertedVehiclesPerHour) < 1e-6);

المهمة السادسة: تحديث الواجهة والتوثيق ضمن نطاقك.

في النموذج الرئيسي:

- اعرض السعة بعد التحويل فقط.
- اعرض وسم الافتراض بجانب توزيع الحركة.
- استخدم وقت ونوافذ البديل المختار في العرض والطباعة والتصدير.
- امنع زر التصدير إذا كانت النوافذ غير صالحة.
- اعرض رسالة خطأ مفهومة عند رفض الخادم.

في ملف التشغيل:

presentation\README-athar.md

وثّق عقد الإدخال، ورموز الأخطاء، وتشغيل الاختبارات، وحدود أن النموذج محلي توضيحي.

في ملف الجدوى:

docs\FEASIBILITY.md

حدّث فقط ما تغير فعلاً في صلاحية التشغيل والتحقق من المدخلات والتصدير. لا تضف نتيجة ميدانية أو تكاملاً حكومياً غير منفذ.

دورات الالتزام:

الدورة الأولى:

git add presentation/athar-engine.js presentation/tests/engine-test.js
git commit -m "fix: preserve exact hours across phased schedules"

الدورة الثانية:

git add presentation/athar-routing.js presentation/tests/routing-test.js
git commit -m "fix: load diverted demand onto route alternatives"

الدورة الثالثة:

git add presentation/server.js presentation/tests/server-test.js
git commit -m "fix: reject invalid scoring requests"

الدورة الرابعة:

git add presentation/athar-prototype.html presentation/tests/ui-smoke-test.js presentation/README-athar.md docs/FEASIBILITY.md docs/REPORT-crit35-final.md
git commit -m "fix: align selected schedule across UI and exports"

قبل كل التزام شغّل:

node presentation/tests/engine-test.js
node presentation/tests/ui-smoke-test.js
node presentation/tests/routing-test.js
node presentation/tests/innovation-test.js
node presentation/tests/server-test.js

بعد اكتمال الاختبارات افتح النموذج عبر الخادم، لا عبر ملف محلي فقط:

node presentation/server.js

تحقق في المتصفح من:

- الطلب الافتراضي.
- مدة عشر ساعات.
- مدة سبع عشرة ساعة.
- جدول ليلي مرحلي.
- تبديل البديل ثم الطباعة.
- تصدير الجدول ومقارنة كل نافذة.
- طلب ناقص عبر الواجهة البرمجية.
- مسار يصبح مزدحماً بعد التحويل.
- عدم وجود أخطاء في وحدة التحكم.

لا تقل إن التصدير صحيح حتى تفك الملف الناتج وتقارن عدد النوافذ والبداية والنهاية ومجموع الساعات بالبديل المختار.

أنشئ التقرير النهائي في:

docs\REPORT-crit35-final.md

يجب أن يحتوي:

- إعادة الإنتاج الرقمية لكل عيب.
- السبب الجذري، لا وصف العرض فقط.
- الاختبار الذي فشل قبل الإصلاح.
- التغيير الأدنى الذي أصلحه.
- نتيجة كل حزمة اختبار بالأعداد.
- نتيجة المتصفح والخادم.
- مثال طلب صحيح ومثال رفض.
- مقارنة التصدير بالجدول المختار.
- العيوب المتبقية.
- تقييم بارد للجدوى من عشرة.
- تقييم بارد لجودة النموذج الأولي من عشرة.

لا تقيّم المعايير الأربعة الأخرى.

بوابة القبول:

- مجموع مدد النوافذ يساوي مدة الطلب في جميع حالات الحدود.
- لا يحسب الفاصل بين الليالي كإغلاق.
- كل عنصر تصدير يطابق نافذة فعلية.
- الطباعة والعرض والتصدير تستخدم البديل نفسه.
- الطلب الناقص لا يعود بنتيجة أثر.
- الخادم قابل للاختبار بلا منفذ ثابت.
- السعة المتبقية تحسب بعد الحركة المحولة.
- حفظ الحركة متحقق رقمياً.
- لا بدائل عليا مكررة.
- الاختبارات القديمة والجديدة خضراء.
- التحقق الحي بلا أخطاء.
- لا تعديل خارج الملكية.

صيغة ردك النهائي:

ابدأ بالحكم، ثم الالتزامات، ثم أعداد الاختبارات، ثم رابط التقرير، ثم الدرجتين الباردتين، ثم العيوب المتبقية. لا تطلب مني تنفيذ خطوة إضافية.
```

## قائمة تحقق الوكيل

- [ ] تشغيل خط الأساس.
- [ ] إعادة إنتاج العيوب الستة.
- [ ] إثبات السبب الجذري لكل عيب.
- [ ] كتابة اختبارات النوافذ قبل الإصلاح.
- [ ] توحيد الحساب والتصدير حول النوافذ نفسها.
- [ ] إضافة تحقق صارم واختبارات خادم.
- [ ] تحميل الحركة المحولة على المسارات.
- [ ] تحديث العرض والطباعة والتصدير.
- [ ] التحقق عبر الخادم والمتصفح.
- [ ] تشغيل جميع الاختبارات.
- [ ] كتابة التقرير والتقييم لمعيارين فقط.

