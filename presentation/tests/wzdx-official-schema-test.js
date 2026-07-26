'use strict';
/**
 * بوابة المخطط الرسمي — WZDx 4.2 عبر AJV.
 * ---------------------------------------------------------------------------
 * **الفرق بينها وبين `wzdx-schema-test.js`.**
 *
 * تلك بوابة قيودٍ **منقولة يدوياً** من المواصفة إلى شيفرة. تفيد كتحقق مبكر
 * سريع، ولا تمنح توافقاً: من نقل القيود قد يكون أسقط قيداً.
 *
 * هذه تشغّل **ملف المخطط الرسمي نفسه**، مثبَّتاً بالتزام محدَّد في
 * `presentation/vendor/wzdx-4.2/`، عبر `ajv`. وهي وحدها التي يُبنى عليها
 * وصف «اجتاز مخطط WZDx 4.2».
 *
 * وتفحص أربعة أشياء لا واحداً:
 *   1. أن المحقق نفسه يعمل ويرفض ما يجب رفضه (بوابة لا تسقط ليست بوابة).
 *   2. أن مُخرَج المنتج الفعلي يجتاز.
 *   3. أن **كل** تصاريح المحفظة تُفحص، وأن الممنوعة ممنوعة بسبب مسمّى.
 *   4. أن أعلام التحقق لا تُرفع بلا دليل.
 *
 * التشغيل: node presentation/tests/wzdx-official-schema-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Engine = require(path.join(ROOT, 'athar-engine.js'));
const Mapping = require(path.join(ROOT, 'athar-wzdx-mapping.js'));
const Exporter = require(path.join(ROOT, 'athar-wzdx-export.js'));
const validator = require(path.join(ROOT, 'scripts', 'lib', 'wzdx-validator.js'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const INPUT = {
  id: 'BLD-2026-0001',
  roadName: 'طريق الملك فهد',
  direction: 'northbound',
  lanes: 4,
  lanesClosed: 1,
  startISO: '2026-08-01T22:00:00.000Z',
  durationHours: 8,
  coordinates: [[46.6753, 24.7136], [46.6801, 24.7192]],
  dataSourceId: 'athar-reviewer-desk',
};

// ---- المحقق نفسه ---------------------------------------------------------

test('المخطط مثبَّت بالتزام محدَّد لا بفرع متحرّك', () => {
  const meta = validator.meta();
  assert.match(meta.commit, /^[0-9a-f]{40}$/,
    `الالتزام غير مثبَّت: ${meta.commit} — «متوافق مع WZDx» يحتاج نسخة تُسمّى`);
  assert.match(meta.validator, /^ajv@8\./);
  assert.ok(meta.files.includes('wzdx-4.2/WorkZoneFeed.json'));
  assert.ok(meta.files.includes('wzdx-4.2/RoadEventFeature.json'),
    'مخطط الحدث غير محمَّل — الفحص كان سيمرّ على الغلاف وحده');
});

test('ملفات المخطط المثبَّتة هي الرسمية بمعرّفاتها', () => {
  const dir = path.join(ROOT, 'vendor', 'wzdx-4.2');
  const feed = JSON.parse(fs.readFileSync(path.join(dir, 'WorkZoneFeed.json'), 'utf8'));
  assert.strictEqual(feed.$id,
    'https://raw.githubusercontent.com/usdot-jpo-ode/wzdx/main/schemas/4.2/WorkZoneFeed.json');
  assert.strictEqual(feed.$schema, 'http://json-schema.org/draft-07/schema#');
  const direction = JSON.parse(fs.readFileSync(path.join(dir, 'Direction.json'), 'utf8'));
  assert.deepStrictEqual(direction.enum, Engine.WZDX_DIRECTIONS,
    'تعداد الاتجاه في المحرك خرج عن تعداد المخطط الرسمي');
  assert.deepStrictEqual(direction.enum, Mapping.WZDX_DIRECTIONS,
    'تعداد الاتجاه في جدول التحويل خرج عن تعداد المخطط الرسمي');
});

test('مخططات GeoJSON مثبَّتة ببصماتها — لا مرساة عند المنبع', () => {
  /* `geojson.org` ينشر مخططاته على رابط بلا وسم ولا التزام. أي أن تثبيتنا
     لها لا يملك مرساة زمنية عند المنبع كما تملك WZDx التزامها.
     فالمرساة تُصنع هنا: بصمات سُحبت وقُورنت بايتاً ببايت، وبوابةٌ تجعل أي
     تغيّر لاحق حدثاً يُرى بدل أن يمرّ. */
  const dir = path.join(ROOT, 'vendor', 'geojson');
  const file = path.join(dir, 'HASHES.txt');
  assert.ok(fs.existsSync(file), 'مخططات GeoJSON بلا ملف بصمات');

  const lines = fs.readFileSync(file, 'utf8').split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line[0] !== '#');
  assert.ok(lines.length >= 2, 'ملف البصمات شبه فارغ');

  lines.forEach((line) => {
    const parts = line.split(/\s+/);
    const digest = parts[0];
    const name = (parts[1] || '').replace(/^\*/, '');
    assert.strictEqual(digest.length, 64, `${name}: بصمة ليست SHA-256`);
    const target = path.join(dir, name);
    assert.ok(fs.existsSync(target), `${name}: مذكور في البصمات وغير موجود`);
    const actual = crypto.createHash('sha256')
      .update(fs.readFileSync(target)).digest('hex');
    assert.strictEqual(actual, digest,
      `${name}: المخطط تغيّر عن المثبَّت — راجع قبل الاعتماد عليه`);
  });

  /* الملفان اللذان يحلّهما المحقق فعلاً يجب أن يكونا مثبَّتين، لا الزائدان
     وحدهما. */
  const named = lines.map((line) => line.split(/\s+/)[1].replace(/^\*/, ''));
  ['LineString.json', 'MultiPoint.json'].forEach((one) => {
    assert.ok(named.includes(one), `${one}: مستعمَل في التحقق وغير مثبَّت`);
  });
});

test('المحقق يسقط على مُدخل معطوب متعمَّد — كل عطبٍ باسمه', () => {
  /* بوابةٌ لا تُختبَر بالسقوط تمرّر كل شيء وتبدو خضراء. */
  const damage = [
    { what: 'feed_info محذوف', apply: (f) => { delete f.feed_info; }, field: /الجذر|feed_info/ },
    { what: 'data_sources فارغة', apply: (f) => { f.feed_info.data_sources = []; }, field: /data_sources/ },
    { what: 'اتجاه غير معياري', apply: (f) => { f.features[0].properties.core_details.direction = 'شمال'; }, field: /direction/ },
    { what: 'vehicle_impact خارج التعداد', apply: (f) => { f.features[0].properties.vehicle_impact = 'closed'; }, field: /vehicle_impact/ },
    { what: 'location_method محذوف', apply: (f) => { delete f.features[0].properties.location_method; }, field: /location_method/ },
    { what: 'start_date بصيغة خاطئة', apply: (f) => { f.features[0].properties.start_date = '2026-08-01 22:00'; }, field: /start_date/ },
    { what: 'core_details محذوف', apply: (f) => { delete f.features[0].properties.core_details; }, field: /core_details/ },
    { what: 'road_names ليست مصفوفة', apply: (f) => { f.features[0].properties.core_details.road_names = 'طريق'; }, field: /road_names/ },
    { what: 'هندسة نقطية', apply: (f) => { f.features[0].geometry = { type: 'Point', coordinates: [46.6, 24.7] }; }, field: /geometry/ },
    { what: 'إحداثية واحدة', apply: (f) => { f.features[0].geometry.coordinates = [[46.6, 24.7]]; }, field: /geometry|coordinates/ },
    { what: 'id محذوف', apply: (f) => { delete f.features[0].id; }, field: /id/ },
    { what: 'type ليس FeatureCollection', apply: (f) => { f.type = 'Feature'; }, field: /./ },
  ];

  damage.forEach((item) => {
    const feed = JSON.parse(JSON.stringify(Engine.wzdx(INPUT)));
    item.apply(feed);
    const result = validator.validateFeed(feed);
    assert.strictEqual(result.valid, false,
      `المحقق قبِل «${item.what}» — المخطط الرسمي لا يقبله`);
    assert.ok(result.fields.some((field) => item.field.test(field))
      || result.errors.some((error) => item.field.test(error.at)),
      `المحقق سقط على «${item.what}» لكنه لم يسمِّ الحقل — وجد: ${result.fields.join('، ')}`);
  });
});

test('المخطط الرسمي لا يثبّت الإصدار — والفاحص الداخلي يبقى ضرورياً', () => {
  /* اكتُشف عند تشغيل المخطط الرسمي أول مرة: `FeedInfo.version` قيدُه نمطٌ
     `major.minor` لا قيمة. فتغذيةٌ تعلن `4.1` وهي مبنية على 4.2 **تجتاز**
     المخطط الرسمي.
     هذا سببٌ مكتوب لبقاء `wzdx-schema-test.js` حياً بدل حذفه بعد وصول
     المحقق الرسمي: البوابتان تفحصان شيئين مختلفين، والادّعاء يحتاج الاثنين. */
  const feed = JSON.parse(JSON.stringify(Engine.wzdx(INPUT)));
  feed.feed_info.version = '4.1';
  assert.strictEqual(validator.validateFeed(feed).valid, true,
    'المخطط صار يثبّت الإصدار — راجع هذا التعليق وأزل الازدواج إن لزم');
  assert.strictEqual(Engine.wzdx(INPUT).feed_info.version, '4.2',
    'المحرك يعلن إصداراً غير 4.2');
});

test('رسائل المحقق مترجَمة — لا نصّ مكتبة خام للمستخدم', () => {
  const feed = JSON.parse(JSON.stringify(Engine.wzdx(INPUT)));
  delete feed.features[0].properties.location_method;
  const result = validator.validateFeed(feed);
  const messages = result.errors.map((error) => error.message).join('\n');
  assert.ok(/حقل إلزامي مفقود/.test(messages),
    `رسالة غير مترجَمة: ${messages}`);
  assert.ok(result.errors.every((error) => typeof error.raw === 'string'),
    'الرسالة الخام لم تُحفظ — من يصحّح المحقق يحتاجها');
});

// ---- مُخرَج المنتج -------------------------------------------------------

test('تصدير المحرك يجتاز المخطط الرسمي', () => {
  const result = validator.validateFeed(Engine.wzdx(INPUT));
  assert.strictEqual(result.valid, true,
    `سقط بـ${result.errorCount} خطأ:\n    `
    + result.errors.map((e) => e.message).join('\n    '));
});

test('كل اتجاه معياري يجتاز، والعربي يُرفض عند المحرك لا عند المخطط', () => {
  Engine.WZDX_DIRECTIONS.forEach((direction) => {
    const result = validator.validateFeed(Engine.wzdx({ ...INPUT, direction }));
    assert.strictEqual(result.valid, true, `اتجاه معياري سقط: ${direction}`);
  });
  /* الرفض المبكر عند المحرك أرخص من ملفٍ يُنزَّل ثم يُرفض عند الجهة. */
  assert.throws(() => Engine.wzdx({ ...INPUT, direction: 'شمال' }),
    /direction خارج تعداد WZDx/,
    'المحرك أنتج ملفاً باتجاه عربي — وهذا سبب فشل التصدير للمحفظة كاملة');
});

test('المحرك يرفض هندسة نقطية بدل مدّ خطٍّ مخترع حولها', () => {
  assert.throws(() => Engine.wzdx({ ...INPUT, coordinates: [[46.6, 24.7]] }),
    /نقطتين على الأقل/);
});

test('جدول مرحلي كامل يجتاز — لا حالة واحدة منتقاة', () => {
  const windows = Engine.buildNightWindows(22, 40, 8);
  const feed = Engine.wzdx({ ...INPUT, windows, durationHours: 40 });
  assert.strictEqual(feed.features.length, windows.length);
  const result = validator.validateFeed(feed);
  assert.strictEqual(result.valid, true,
    `جدول مرحلي سقط:\n    ${result.errors.map((e) => e.message).join('\n    ')}`);
});

// ---- جدول التحويل --------------------------------------------------------

test('كل قيمة اتجاه في المحفظة لها تحويل معياري', () => {
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8'));
  const values = new Set(portfolio.features.map((f) => f.properties.direction));
  assert.ok(values.size > 0, 'المحفظة بلا اتجاهات');
  values.forEach((value) => {
    const mapped = Mapping.mapDirection(value);
    assert.strictEqual(mapped.ok, true,
      `قيمة اتجاه في المحفظة بلا تحويل: «${value}» — ${mapped.reason}`);
    assert.ok(Engine.WZDX_DIRECTIONS.includes(mapped.value));
  });
});

test('«كلا الاتجاهين» تُرفض ولا تُحوَّل إلى undefined صامتة', () => {
  ['الاتجاهين', 'كلا الاتجاهين', 'both'].forEach((value) => {
    const mapped = Mapping.mapDirection(value);
    assert.strictEqual(mapped.ok, false, `«${value}» مرّت — وهي ليست في التعداد`);
    assert.match(mapped.reason, /حدثاً لكل اتجاه/);
  });
});

test('قيمة غير معروفة تفشل ولا تسقط على افتراض صامت', () => {
  const mapped = Mapping.mapDirection('شمال شرق');
  assert.strictEqual(mapped.ok, false);
  assert.strictEqual(mapped.value, null,
    'قيمة افتراضية صامتة — تجعل كل خطأ نقلٍ يخرج «مجهولاً» في ملف يقرؤه غيرنا');
});

test('صيغ عربية متعددة للاتجاه نفسه تُحوَّل جميعها', () => {
  ['شمال', 'شمالاً', 'الشمال', 'شمالي', 'باتجاه الشمال'].forEach((value) => {
    assert.strictEqual(Mapping.mapDirection(value).value, 'northbound', value);
  });
  ['جنوب', 'جنوباً', 'الجنوب'].forEach((value) => {
    assert.strictEqual(Mapping.mapDirection(value).value, 'southbound', value);
  });
});

// ---- المحفظة كاملة -------------------------------------------------------

function portfolioRun() {
  const portfolio = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8'));
  const resolutionFile = path.join(ROOT, 'data', 'point-geometry-resolution.json');
  const resolutions = fs.existsSync(resolutionFile)
    ? JSON.parse(fs.readFileSync(resolutionFile, 'utf8')).resolutions
    : {};

  const outcomes = [];
  portfolio.features.forEach((feature) => {
    const ref = feature.properties.permitRef;
    const built = Exporter.buildFeed(feature, { resolution: resolutions[ref] });
    if (!built.ok) {
      outcomes.push({ ref, ok: false, outcome: built.outcome,
        reason: built.blockers.join(' · '), feed: null });
      return;
    }
    const result = validator.validateFeed(built.feed);
    outcomes.push({ ref, ok: result.valid, outcome: built.outcome,
      reason: result.errors.map((e) => e.message).join(' · '),
      feed: built.feed, fields: result.fields });
  });
  return outcomes;
}

test('المحفظة كاملة تُفحص — لا عيّنة', () => {
  const outcomes = portfolioRun();
  assert.strictEqual(outcomes.length, 150,
    `فُحص ${outcomes.length} تصريحاً لا 150 — التقرير عن عيّنة لا عن محفظة`);
});

test('لا تصريح يسقط أمام المخطط بعد نجاح التصدير', () => {
  /* الفرق بين «مُنع» و«سقط» جوهري: المنع قرارٌ واعٍ بسبب مسمّى، والسقوط عيب.
     تصريحٌ صُدِّر ثم سقط أمام المخطط يعني أن حرّاس المُصدِّر لا تكفي. */
  const fell = portfolioRun().filter((row) => row.feed && !row.ok);
  assert.deepStrictEqual(fell.map((row) => `${row.ref}: ${row.reason}`), [],
    `${fell.length} تصريحاً صُدِّر ثم سقط أمام المخطط`);
});

test('كل حالة ممنوعة لها تصنيف من التصنيفات المعلنة وسببٌ مكتوب', () => {
  const taxonomy = Object.keys(Exporter.OUTCOME).map((key) => Exporter.OUTCOME[key]);
  portfolioRun().filter((row) => !row.ok).forEach((row) => {
    assert.ok(taxonomy.includes(row.outcome),
      `${row.ref}: تصنيف خارج القائمة المعلنة — «${row.outcome}»`);
    assert.ok(row.reason && row.reason.length > 10,
      `${row.ref}: مُنع بلا سبب مقروء`);
  });
});

test('عدد الناجحين لا ينحدر تحت الخط المسجَّل', () => {
  /* الرقم مسجَّل لا محسوب من التشغيل: بوابةٌ تقارن النتيجة بنفسها تمرّ دائماً.
     رفعُه بعد تحسّن حقيقي تغييرٌ يُكتب في التزام، لا يُحدَّث بصمت. */
  const BASELINE = 144;
  const passed = portfolioRun().filter((row) => row.ok).length;
  assert.ok(passed >= BASELINE,
    `${passed} اجتاز — انحدار عن الخط المسجَّل ${BASELINE}`);
});

test('التقرير المكتوب يطابق التشغيل الحيّ', () => {
  /* تقريرٌ مولَّد ثم عُدِّلت البيانات تحته يقول رقماً لم يعد صحيحاً، ولا شيء
     ينبّه. هذه البوابة تجعل نسيان إعادة التوليد فشلاً. */
  const file = path.join(ROOT, 'data', 'wzdx-conformance-report.json');
  assert.ok(fs.existsSync(file),
    'تقرير المطابقة غير مولَّد — شغّل scripts/build-wzdx-conformance.js');
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const live = portfolioRun();
  assert.strictEqual(report.total, live.length);
  assert.strictEqual(report.passed, live.filter((row) => row.ok).length,
    'التقرير متقادم — أعِد توليده');
  assert.match(report.validator.commit, /^[0-9a-f]{40}$/);
});

// ---- الأمانة في الادّعاء -------------------------------------------------

test('أعلام التحقق الأربعة false في كل تصدير من المحفظة', () => {
  /* أسهل طريق لاجتياز المخطط أن تُكتب `true` وتُنسى. وذلك يعلن للمستهلك أن
     التاريخ مثبَّت ميدانياً وهو مقترح، والموقع ممسوح وهو مشتقّ من الشبكة. */
  portfolioRun().filter((row) => row.feed).forEach((row) => {
    row.feed.features.forEach((feature) => {
      ['is_start_date_verified', 'is_end_date_verified',
        'is_start_position_verified', 'is_end_position_verified'].forEach((flag) => {
        assert.strictEqual(feature.properties[flag], false,
          `${row.ref}: ${flag} مرفوع بلا دليل ميداني`);
      });
    });
  });
});

test('الهندسة المُسنَدة تحمل location_method = other لا طريقة تدّعي جهازاً', () => {
  const method = Mapping.mapLocationMethod('snapped');
  assert.strictEqual(method.value, 'other');
  assert.ok(Engine.WZDX_LOCATION_METHODS.includes(method.value));
});

test('الادّعاء المسموح مولَّد من العدّ لا مكتوب يدوياً', () => {
  const report = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'data', 'wzdx-conformance-report.json'), 'utf8'));
  assert.ok(report.permittedClaim.includes(String(report.passed)));
  if (report.passed < report.total) {
    assert.ok(report.forbiddenClaim.length > 0,
      'حالات ممنوعة موجودة والادّعاء المطلق غير محظور');
    assert.ok(!/^متوافق مع WZDx 4\.2$/.test(report.permittedClaim));
  }
});

console.log(`ALL TESTS PASSED (${count})`);
