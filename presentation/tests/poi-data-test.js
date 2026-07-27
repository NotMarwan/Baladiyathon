'use strict';
/**
 * بوابة بيانات المعالم.
 * ---------------------------------------------------------------------------
 * الحصاد شبكي: عشرات البلاطات × عشرات الاستعلامات، والنتيجة تُلتزم في المستودع
 * مرةً وتُقرأ بعدها سنةً. فما لا يُفحص هنا لا يُفحص أبداً — لا خادم يتحقق منه
 * ولا مستعمل يشتكي من نقطةٍ واحدة واقعةٍ في البحر الأحمر.
 *
 * أربعة أخطاء يقع فيها حصادٌ صامت، وكلها مغطّاة أدناه:
 *   ١) موضع حقلٍ تغيّر عند Google فتصير كل الأعداد صفراً — يُمسك بالحدّ.
 *   ٢) بلاطةٌ حدودية تُدخل معلماً خارج نطاق شبكة الطرق فيطفو على فراغ.
 *   ٣) بلاطتان متجاورتان تُدخلان المكان مرتين فتُرسم التسمية فوق نفسها.
 *   ٤) التوأم المغلَّف `.geojson.js` يتخلّف عن أصله بعد إعادة حصاد.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require(path.join(__dirname, '..', 'masar-worksmap-style.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const DATA = path.join(__dirname, '..', 'data');
const GEOJSON = path.join(DATA, 'riyadh-poi.geojson');
const WRAPPED = path.join(DATA, 'riyadh-poi.geojson.js');

/** نفس نطاق `fetch-roads.js` و`fetch-gmaps-poi.js` — مكتوب هنا للتثبيت لا للتوليد. */
const BBOX = { south: 24.545, west: 46.530, north: 24.880, east: 46.855 };

const poi = JSON.parse(fs.readFileSync(GEOJSON, 'utf8'));
const KINDS = Style.POI_KINDS.concat(['other']);

ok('المعالم: مجموعة ميزات صالحة بحجم يُقرأ مدينةً', () => {
  assert.strictEqual(poi.type, 'FeatureCollection');
  assert.ok(Array.isArray(poi.features), 'features ليست مصفوفة');
  // أرضية لا سقف. الرقم الحقيقي أكبر بكثير؛ هذه تمسك حصاداً سقط إلى حفنة.
  assert.ok(poi.features.length >= 300,
    `معالم قليلة جداً: ${poi.features.length} — يُرجّح أن الحصاد سقط`);
});

ok('المعالم: المصدر والتاريخ والتصنيف مصرّح بها', () => {
  const meta = poi.properties || {};
  assert.ok(meta.source, 'المصدر غير معلَن');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(meta.capturedAt || ''), 'تاريخ الحصاد مفقود أو بصيغة خاطئة');
  assert.strictEqual(typeof meta.minReviews, 'number');
  // قاعدة الأدلة: كل رقم يحمل تصنيفاً. هذه أرقام سِجلّ خارجي لا قياس ميداني.
  assert.strictEqual(meta.evidence, 'مُتحقَّق خارجياً');
});

ok('المعالم: كل معلم نقطة داخل نطاق شبكة الطرق', () => {
  for (const feature of poi.features) {
    assert.strictEqual(feature.geometry.type, 'Point', `هندسة غير نقطية: ${feature.properties.name}`);
    const [lng, lat] = feature.geometry.coordinates;
    assert.ok(lat >= BBOX.south && lat <= BBOX.north,
      `خارج النطاق عرضاً: ${feature.properties.name} @ ${lat}`);
    assert.ok(lng >= BBOX.west && lng <= BBOX.east,
      `خارج النطاق طولاً: ${feature.properties.name} @ ${lng}`);
  }
});

ok('المعالم: لا معلم دون الحدّ المعلَن', () => {
  const min = poi.properties.minReviews;
  for (const feature of poi.features) {
    assert.ok(typeof feature.properties.rev === 'number',
      `عدد التقييمات ليس رقماً: ${feature.properties.name}`);
    assert.ok(feature.properties.rev >= min,
      `دون الحدّ: ${feature.properties.name} = ${feature.properties.rev} < ${min}`);
  }
});

ok('المعالم: عدد التقييمات ليس صفراً عبر المجموعة كلها', () => {
  /**
   * الفحص الذي يمسك تغيّر موضع الحقل عند Google.
   * قراءةٌ من موضعٍ خاطئ تعيد `0` لكل مكان، فيُقصي المرشّح الحصاد كله ويبقى
   * الملف صالحاً شكلاً وفارغاً معنىً. أعلى قيمة يجب أن تكون بالآلاف في مدينة
   * بحجم الرياض — مولٌ واحد يتجاوز عشرة آلاف تقييم.
   */
  const top = Math.max(...poi.features.map((f) => f.properties.rev));
  assert.ok(top >= 5000, `أعلى عدد تقييمات ${top} — يُرجّح أن موضع الحقل تغيّر`);
});

ok('المعالم: لا تكرار بمعرّف المكان', () => {
  const seen = new Set();
  for (const feature of poi.features) {
    const id = feature.properties.id;
    assert.ok(id, `معلم بلا معرّف: ${feature.properties.name}`);
    assert.ok(!seen.has(id), `معرّف مكرّر: ${id} (${feature.properties.name})`);
    seen.add(id);
  }
});

ok('المعالم: الاسم موجود ومقتضب بما يُرسم', () => {
  for (const feature of poi.features) {
    const name = feature.properties.name;
    assert.ok(typeof name === 'string' && name.trim().length > 0, 'معلم بلا اسم');
    assert.ok(name.length <= 120, `اسم أطول مما يُرسم: ${name}`);
  }
});

ok('المعالم: كل مجموعة معروفة للنمط — لا لون احتياطي صامت', () => {
  /**
   * `kind` مجهولة تسقط على اللون الاحتياطي فتُرسم رمادية بلا شكوى، ويظنّ
   * القارئ أنها فئة قائمة بذاتها. المجموعات مغلقة عمداً: تُضاف في النمط أولاً.
   */
  for (const feature of poi.features) {
    assert.ok(KINDS.indexOf(feature.properties.kind) !== -1,
      `مجموعة مجهولة: ${feature.properties.kind} (${feature.properties.name})`);
  }
});

ok('المعالم: الرتبة تتبع عدد التقييمات بحدود ثابتة', () => {
  for (const feature of poi.features) {
    const { rev, t, name } = feature.properties;
    const expected = rev >= 5000 ? 1 : (rev >= 1500 ? 2 : 3);
    assert.strictEqual(t, expected, `رتبة خاطئة: ${name} (${rev} تقييماً → ${t})`);
  }
});

ok('المعالم: الرتب الثلاث كلها ممثَّلة', () => {
  /**
   * لو خلت الرتبة الأولى لبقيت الخريطة فارغةً حتى z13.2 — وهي بالضبط الشكوى
   * «الطبقة لا تعمل». الفحص يمسكها قبل أن تُرى.
   */
  const tiers = new Set(poi.features.map((f) => f.properties.t));
  [1, 2, 3].forEach((t) => assert.ok(tiers.has(t), `الرتبة ${t} خالية`));
});

ok('المعالم: التوأم المغلَّف مطابق للأصل', () => {
  const wrapped = fs.readFileSync(WRAPPED, 'utf8');
  assert.ok(wrapped.startsWith('window.RIYADH_POI = '), 'الغلاف لا يعلن المتغيّر المتوقَّع');
  const inner = JSON.parse(wrapped.replace(/^window\.RIYADH_POI = /, '').replace(/;\s*$/, ''));
  assert.strictEqual(inner.features.length, poi.features.length, 'التوأم متخلّف عن الأصل');
  assert.deepStrictEqual(inner.properties, poi.properties);
});

console.log(`\n${passed} فحصاً`);
