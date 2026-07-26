'use strict';
/**
 * بوابة جامع أدلة المسارات.
 * ---------------------------------------------------------------------------
 * ما تفحصه هذه الحزمة ليس «هل الشيفرة تعمل» بل **هل الادّعاءات مقيَّدة**:
 * أن الغائب يبقى غائباً لا صفراً، وأن `v/c` يُرفض بلا حجم، وأن قياسين من
 * لحظتين لا يُقارَنان، وأن التركيبي لا يُوصف بلغة المرصود.
 *
 * التشغيل: node presentation/tests/route-evidence-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Evidence = require(path.join(ROOT, 'athar-route-evidence.js'));
const providers = require(path.join(ROOT, 'scripts', 'lib', 'evidence-providers', 'index.js'));
const here = require(path.join(ROOT, 'scripts', 'lib', 'evidence-providers', 'here.js'));
const tomtom = require(path.join(ROOT, 'scripts', 'lib', 'evidence-providers', 'tomtom.js'));
const google = require(path.join(ROOT, 'scripts', 'lib', 'evidence-providers', 'google-routes.js'));

const SAMPLES = path.join(__dirname, 'fixtures', 'provider-samples');
const sample = (file) => JSON.parse(fs.readFileSync(path.join(SAMPLES, file), 'utf8'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const CONTEXT = {
  routeId: 'BLD-2026-0020-أساسي',
  segmentId: 'seg-1',
  observedAt: '2026-07-26T05:00:00.000Z',
  importedAt: '2026-07-26T05:00:05.000Z',
  dataMode: 'synthetic',
  sourceType: 'provider-sample',
  license: 'عيّنة مزوّد — لا ترخيص استعمال',
  coverage: 1,
};

// ---- درجات الدليل --------------------------------------------------------

test('درجات الدليل مرتَّبة بلا تساوٍ — الترتيب هو ما يمنع الخلط', () => {
  const ranks = Evidence.EVIDENCE_GRADES.map((grade) => grade.rank);
  assert.strictEqual(new Set(ranks).size, ranks.length, 'درجتان بالرتبة نفسها');
  const sorted = ranks.slice().sort((a, b) => b - a);
  assert.deepStrictEqual(ranks, sorted, 'الدرجات غير مرتَّبة تنازلياً');
});

test('كل درجة تقول ما تُثبته وما لا تُثبته', () => {
  Evidence.EVIDENCE_GRADES.forEach((grade) => {
    assert.ok(grade.proves && grade.proves.length > 15, `${grade.key}: بلا «يُثبت»`);
    assert.ok(grade.notProves && grade.notProves.length > 10,
      `${grade.key}: بلا «لا يُثبت» — درجةٌ بلا حدّ تتمدّد`);
    assert.strictEqual(typeof grade.narrows, 'boolean');
    assert.strictEqual(typeof grade.calibrates, 'boolean');
  });
});

test('المعايرة حكرٌ على الدليل الميداني المحلي وحده', () => {
  /* لو جاز لدرجة أدنى أن تعاير، لصار نظير عالمي قادراً على تثبيت معامل
     محلي — وهو بالضبط الانزلاق الذي تمنعه القاعدة. */
  const calibrating = Evidence.EVIDENCE_GRADES.filter((grade) => grade.calibrates);
  assert.deepStrictEqual(calibrating.map((grade) => grade.key), ['local-field']);
});

test('النموذج والتركيبي لا يضيّقان نطاقاً', () => {
  ['model-derived', 'synthetic'].forEach((key) => {
    assert.strictEqual(Evidence.gradeOf(key).narrows, false,
      `${key}: يدّعي تضييق نطاق — والنطاق يضيق ببيانات لا بحساب`);
  });
});

// ---- لغة العرض -----------------------------------------------------------

test('«مرصود» ممنوعة على ناتج النموذج', () => {
  const check = Evidence.checkLanguage('model-derived',
    'التأخير المرصود على هذا المقطع 4014 ساعة-مركبة');
  assert.strictEqual(check.ok, false);
  assert.match(check.violations[0], /مرصود/);
});

test('«محلي» ممنوعة على النظير العالمي', () => {
  assert.strictEqual(
    Evidence.checkLanguage('global-analog', 'قياس محلي من مدينة أخرى').ok, false);
});

test('«أثر الإغلاق» ممنوعة على رصد طريق بلا إغلاق', () => {
  /* أخطر انزلاق في المسار الثاني كله: نرصد الطريق في ظرفه العادي شهوراً، ثم
     تُقرأ السلسلة «أثر الإغلاق». الطريق بلا إغلاق لا يقول شيئاً عن الإغلاق. */
  assert.strictEqual(
    Evidence.checkLanguage('local-route', 'يعرض أثر الإغلاق على المسار').ok, false);
});

test('اللغة الصحيحة تمرّ — البوابة ليست منعاً شاملاً', () => {
  assert.strictEqual(
    Evidence.checkLanguage('model-derived',
      'تأخير مقدَّر من النموذج تحت الافتراضات المعلنة').ok, true);
});

// ---- عقد القياس ----------------------------------------------------------

test('قياس بحالة ok وبلا أي مقياس يُرفض — سجلُّ محاولة لا قياس', () => {
  const record = {
    routeId: 'R', segmentId: 'S', provider: 'p', sourceType: 'probe',
    observedAt: CONTEXT.observedAt, importedAt: CONTEXT.importedAt,
    timezone: 'Asia/Riyadh', status: 'ok', dataMode: 'synthetic', license: 'x',
  };
  const result = Evidence.validateMeasurement(record);
  assert.strictEqual(result.ok, false);
  assert.ok(result.blocking.some((item) => /سجلُّ محاولة/.test(item.reason)));
});

test('حجم بلا مصدر يُرفض — وإلا صار بسط v/c بلا أصل', () => {
  const record = {
    routeId: 'R', segmentId: 'S', provider: 'p', sourceType: 'sensor',
    observedAt: CONTEXT.observedAt, importedAt: CONTEXT.importedAt,
    timezone: 'Asia/Riyadh', status: 'ok', dataMode: 'local-route',
    license: 'x', volumeVehPerHour: 1800,
  };
  assert.ok(Evidence.validateMeasurement(record).blocking
    .some((item) => item.key === 'volumeSource'));
});

// ---- v/c -----------------------------------------------------------------

test('v/c مرفوض بلا حجم — والغياب ليس صفراً', () => {
  const decision = Evidence.canComputeVolumeCapacity(
    { speedKph: 40, volumeVehPerHour: null },
    { value: 1800, source: 'HCM' });
  assert.strictEqual(decision.allowed, false);
  assert.match(decision.reason, /غياب الحجم ليس صفراً/);
});

test('v/c مرفوض بسعة بلا مصدر — قيمة الصنف ليست قياس سعة', () => {
  const decision = Evidence.canComputeVolumeCapacity(
    { volumeVehPerHour: 1500, volumeSource: 'عدّاد الأمانة' },
    { value: 1800 });
  assert.strictEqual(decision.allowed, false);
  assert.match(decision.reason, /سعة بلا مصدر/);
});

test('v/c مسموح حين يوجد حجم ومصدره وسعة ومصدرها', () => {
  const decision = Evidence.canComputeVolumeCapacity(
    { volumeVehPerHour: 1500, volumeSource: 'عدّاد الأمانة' },
    { value: 1800, source: 'قياس ميداني' });
  assert.strictEqual(decision.allowed, true);
});

// ---- المقارنة ------------------------------------------------------------

test('قياسان بفارق ساعتين لا يُقارَنان', () => {
  const a = { observedAt: '2026-07-26T05:00:00Z', provider: 'here-traffic-v7', dataMode: 'local-route' };
  const b = { observedAt: '2026-07-26T07:00:00Z', provider: 'here-traffic-v7', dataMode: 'local-route' };
  const verdict = Evidence.comparable(a, b, 300);
  assert.strictEqual(verdict.ok, false);
  assert.match(verdict.reason, /الفرق قد يكون ساعةً لا مساراً/);
});

test('قياسان من مزوّدين مختلفين لا يُقارَنان', () => {
  const a = { observedAt: '2026-07-26T05:00:00Z', provider: 'here-traffic-v7', dataMode: 'local-route' };
  const b = { observedAt: '2026-07-26T05:01:00Z', provider: 'tomtom-traffic', dataMode: 'local-route' };
  assert.strictEqual(Evidence.comparable(a, b, 300).ok, false);
});

test('قياسان في النافذة نفسها ومن المزوّد نفسه يُقارَنان', () => {
  const a = { observedAt: '2026-07-26T05:00:00Z', provider: 'here-traffic-v7', dataMode: 'local-route' };
  const b = { observedAt: '2026-07-26T05:02:00Z', provider: 'here-traffic-v7', dataMode: 'local-route' };
  assert.strictEqual(Evidence.comparable(a, b, 300).ok, true);
});

// ---- المحوّلات ------------------------------------------------------------

test('لا مزوّد بين المفحوصين ينتج حجم حركة', () => {
  /* هذه ليست تفصيلة تقنية: عليها يقوم أن `v/c` — وهو مُدخل المحرك المباشر —
     لا يُعاير من أي مصدر تجاري مهما طال الرصد. */
  assert.deepStrictEqual(providers.volumeProviders().map((p) => p.KEY), []);
});

test('محوّل HERE يقرأ الحقول ويترك الحجم فارغاً لا صفراً', () => {
  const parsed = here.parse(sample('here-flow.json'), CONTEXT);
  assert.strictEqual(parsed.measurements.length, 2);
  const first = parsed.measurements[0];
  assert.strictEqual(first.speedKph, 42);
  assert.strictEqual(first.freeFlowKph, 80);
  assert.strictEqual(first.volumeVehPerHour, null,
    'الحجم صفر بدل غياب — الصفر ادّعاء «لا مركبات مرّت»');
  assert.ok(first.travelTimeSec > 0);
  assert.ok(first.delaySec > 0);
});

test('ثقة HERE دون العتبة تُعلَّم stale لا ok', () => {
  /* 0.7 عند HERE تعني «تاريخي بحت». قبولها `ok` يُدخل قيمة تاريخية إلى خط
     أساس بوصفها رصداً للحظة، فيقيس خط الأساس نفسه. */
  const parsed = here.parse(sample('here-flow.json'), CONTEXT);
  const historical = parsed.measurements[1];
  assert.strictEqual(historical.confidence, 0.6);
  assert.strictEqual(historical.status, 'stale');
  assert.match(historical.knownLimits, /سرعات تاريخية/);
});

test('عنصر بلا سرعة يُسجَّل متخطّى بسببه لا يُحذف صامتاً', () => {
  const parsed = here.parse(sample('here-flow.json'), CONTEXT);
  assert.strictEqual(parsed.skipped.length, 1);
  assert.match(parsed.skipped[0].reason, /لا سرعة/);
});

test('محوّل TomTom يقرأ الزمن والتأخير ويعلن حدّ الاحتفاظ', () => {
  const parsed = tomtom.parse(sample('tomtom-flow-segment.json'), CONTEXT);
  const row = parsed.measurements[0];
  assert.strictEqual(row.travelTimeSec, 189);
  assert.strictEqual(row.delaySec, 93);
  assert.strictEqual(row.volumeVehPerHour, null);
  assert.strictEqual(row.retentionDays, tomtom.MAX_RETENTION_DAYS);
  /* حدّ الاحتفاظ يُعلن في `knownLimits` لا في `license` وحده: الترخيص نصّ
     يمرّره المستدعي وقد يستبدله، وحدّ الاحتفاظ خاصية المزوّد لا خيار المستدعي. */
  assert.match(row.knownLimits, /90 يوماً/);
});

test('حدّ احتفاظ TomTom مفحوص لا متروك للذاكرة', () => {
  const old = { observedAt: '2026-01-01T00:00:00Z' };
  const fresh = { observedAt: '2026-07-20T00:00:00Z' };
  assert.strictEqual(tomtom.retentionExpired(old, '2026-07-26T00:00:00Z'), true);
  assert.strictEqual(tomtom.retentionExpired(fresh, '2026-07-26T00:00:00Z'), false);
});

test('محوّل Google يحوّل «612s» ويعلن أن السرعة مشتقّة لا مقيسة', () => {
  const parsed = google.parse(sample('google-routes.json'), CONTEXT);
  const row = parsed.measurements[0];
  assert.strictEqual(row.travelTimeSec, 612);
  assert.strictEqual(row.delaySec, 191);
  assert.match(row.segmentId, /كامل/);
  assert.match(row.knownLimits, /متوسط مشتقّ/);
  assert.strictEqual(google.seconds('42.5s'), 42.5);
  assert.strictEqual(google.seconds('نصف ساعة'), null);
});

test('كل قياس من عيّنة مزوّد يمرّ عقد القياس', () => {
  const rows = []
    .concat(here.parse(sample('here-flow.json'), CONTEXT).measurements)
    .concat(tomtom.parse(sample('tomtom-flow-segment.json'), CONTEXT).measurements)
    .concat(google.parse(sample('google-routes.json'), CONTEXT).measurements);
  assert.ok(rows.length >= 4);
  rows.forEach((row) => {
    const result = Evidence.validateMeasurement(row);
    assert.strictEqual(result.ok, true,
      `${row.provider}/${row.segmentId}: ${result.blocking.map((b) => b.key + ' ' + b.reason).join('، ')}`);
  });
});

test('قياسات العيّنات كلها تركيبية — لا واحد منها يدّعي رصداً محلياً', () => {
  const rows = here.parse(sample('here-flow.json'), CONTEXT).measurements;
  rows.forEach((row) => {
    assert.strictEqual(row.dataMode, 'synthetic');
    assert.strictEqual(row.sourceType, 'provider-sample');
  });
});

// ---- الجاهزية ------------------------------------------------------------

test('الجاهزية تسمّي ما ينقص لكل مزوّد بدل «غير متاح»', () => {
  const report = providers.readiness({});
  assert.strictEqual(report.length, 3);
  report.forEach((provider) => {
    assert.strictEqual(provider.ready, false);
    assert.ok(provider.missing.length > 0);
    provider.missing.forEach((credential) => {
      assert.ok(credential.env && credential.what && credential.how,
        `${provider.key}: نقصٌ بلا وصف ولا طريق`);
    });
  });
});

test('مفتاح موجود يقلب الجاهزية — الفحص يفحص فعلاً', () => {
  const report = providers.readiness({ HERE_API_KEY: 'x' });
  const hereRow = report.find((provider) => provider.key === 'here-traffic-v7');
  assert.strictEqual(hereRow.ready, true);
  assert.strictEqual(hereRow.missing.length, 0);
});

test('المفتاح لا يظهر في وصف الطلب', () => {
  /* وصف الطلب يُطبع ويُسجَّل. مفتاحٌ فيه يتسرّب إلى سجل ثم إلى مستودع. */
  const request = here.buildRequest({ bbox: [46.6, 24.6, 46.8, 24.8] }, { apiKey: 'سرّ' });
  assert.strictEqual(request.ok, true);
  assert.strictEqual(JSON.stringify(request).indexOf('سرّ'), -1,
    'المفتاح مطبوع في وصف الطلب');
});

test('بلا مفتاح لا يُبنى طلب — الرفض لا التأجيل', () => {
  [here, tomtom, google].forEach((provider) => {
    const request = provider.buildRequest({ bbox: [46, 24, 47, 25],
      probePoint: [46.7, 24.7], origin: [46.6, 24.6], destination: [46.8, 24.8] }, {});
    assert.strictEqual(request.ok, false, `${provider.KEY}: بنى طلباً بلا مفتاح`);
  });
});

// ---- المسارات المرصودة ----------------------------------------------------

test('قائمة المسارات مبنيّة وتحمل الأدوار الثلاثة', () => {
  const file = path.join(ROOT, 'data', 'monitored-routes.json');
  assert.ok(fs.existsSync(file), 'لا قائمة مسارات — شغّل build-monitored-routes.js');
  const catalogue = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(catalogue.groups.length >= 3, 'مجموعات أقل من ثلاث');

  catalogue.groups.forEach((group) => {
    const roles = group.routes.map((route) => route.role);
    assert.ok(roles.includes('primary'), `${group.groupId}: بلا مسار أساسي`);
    assert.ok(roles.includes('work-segment'), `${group.groupId}: بلا مقطع عمل`);
    assert.ok(roles.includes('alternate'), `${group.groupId}: بلا بديل`);
    assert.ok(Array.isArray(group.departurePoint), `${group.groupId}: بلا نقطة مغادرة`);
    assert.ok(Array.isArray(group.rejoinPoint), `${group.groupId}: بلا نقطة عودة`);
  });
});

test('كل مسار مرصود يحمل ما يلزم لاستعلام المزوّدين الثلاثة', () => {
  const catalogue = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'monitored-routes.json'), 'utf8'));
  catalogue.groups.forEach((group) => {
    group.routes.forEach((route) => {
      assert.ok(Array.isArray(route.bbox) && route.bbox.length === 4,
        `${route.routeId}: بلا صندوق إحاطة — HERE يستعلم به`);
      assert.ok(Array.isArray(route.probePoint),
        `${route.routeId}: بلا نقطة استعلام — TomTom يستعلم بها`);
      assert.ok(Array.isArray(route.origin) && Array.isArray(route.destination),
        `${route.routeId}: بلا طرفين — Google يستعلم بهما`);
    });
  });
});

test('لا قياس في قائمة المسارات — القائمة خطة رصد لا نتيجة', () => {
  /* الخلط هنا سهل ومكلف: ملفٌّ فيه `minutes` بجوار اسم مسار يُقرأ قياساً.
     التسمية `modelMinutes` والحقل `measurementStatus` يمنعان ذلك. */
  const catalogue = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'monitored-routes.json'), 'utf8'));
  catalogue.groups.forEach((group) => {
    group.routes.forEach((route) => {
      assert.strictEqual(route.speedKph, undefined, `${route.routeId}: سرعة في خطة رصد`);
      assert.ok('modelMinutes' in route, `${route.routeId}: الزمن بلا بادئة model`);
      assert.match(route.measurementStatus, /لم يُرصد بعد/);
    });
  });
});

// ---- سجل المزوّدين --------------------------------------------------------

test('سجل المزوّدين يعلن ما لم يُتحقق منه بدل ملئه بالتقدير', () => {
  const registry = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'traffic-provider-registry.json'), 'utf8'));
  assert.ok(registry.accessedOn, 'سجل بلا تاريخ وصول — شروط المزوّدين تتغيّر');
  assert.ok(registry.providers.length >= 5);
  registry.providers.forEach((provider) => {
    assert.ok(provider.verdict && provider.verdict.length > 15,
      `${provider.key}: بلا حكم`);
    assert.ok(Array.isArray(provider.sources),
      `${provider.key}: بلا حقل مصادر`);
  });
  const cited = registry.providers.filter((provider) => provider.sources.length);
  assert.ok(cited.length >= 4, 'أقل من أربعة مزوّدين بمصادر');
});

test('السجل يعلن أن مصدر الحجم الوحيد رسمي لا تجاري', () => {
  const registry = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'traffic-provider-registry.json'), 'utf8'));
  const withVolume = registry.providers.filter((provider) => provider.volumeProvided === true);
  assert.ok(withVolume.length >= 1);
  withVolume.forEach((provider) => {
    assert.ok(/رسمي/.test(provider.kind),
      `${provider.key}: يَعِد بحجم وهو غير رسمي — راجع`);
  });
  /* البوابة تثبّت المعنى لا جملةً بعينها.
     كانت تطابق «لا واحد من مزوّدي حركة المسبار…» — وهي صياغة على مستوى
     **المزوّد** أوسع مما فُحص فعلاً: المفحوص واجهاتٌ بأعيانها (flow وRoutes)،
     ومنتجات التحليلات التاريخية مسجَّلة «غير متحقَّق» في بنودها. تثبيتُ
     التعميم يجعل البوابة تحرس ادّعاءً زائداً بدل أن تمنعه.
     فالمثبَّت الآن ثلاثة: أن النتيجة عن الحجم، وأن نطاقها معلَن بالواجهات
     المفحوصة، وأن قاعدة منع التعميم مكتوبة في السجل نفسه. */
  assert.match(registry.criticalFinding, /لا تعيد حجماً مرورياً عددياً/);
  assert.match(registry.criticalFinding, /التي فُحصت|المفحوصة|بأعيانها/);
  assert.ok(typeof registry.scopeRule === 'string' && registry.scopeRule.length > 40,
    'السجل بلا قاعدة نطاق تمنع التعميم من واجهة إلى مزوّد');
  assert.ok(!/^لا واحد من مزوّدي/.test(registry.criticalFinding),
    'النتيجة معمَّمة على المزوّد وقد فُحصت واجهة');
});

console.log(`ALL TESTS PASSED (${count})`);
