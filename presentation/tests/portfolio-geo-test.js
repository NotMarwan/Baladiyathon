'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Data = require(path.join(__dirname, '..', 'athar-worksmap-data.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const raw = fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8');
const portfolio = JSON.parse(raw);
const roads = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'riyadh-roads.geojson'), 'utf8'));

const REQUIRED_PROPS = [
  'id', 'permitRef', 'group', 'subtype', 'status', 'nextAction', 'title',
  'street', 'roadClass', 'sensitivity', 'promoter', 'contractor',
  'aadt', 'lanes', 'lanesClosed', 'direction', 'start', 'end',
  'severity', 'confidence', 'impactVehHours', 'delayPct',
  'inputsVersion', 'version', 'description',
];

ok('المحفظة تحمل ١٢٠ سجلاً على الأقل', () => {
  assert.ok(portfolio.features.length >= 120,
    `عدد غير كافٍ لملء المدينة: ${portfolio.features.length}`);
});

ok('كل سجل يحمل مخطط WorkPermit كاملاً', () => {
  portfolio.features.forEach((feature, index) => {
    for (const prop of REQUIRED_PROPS) {
      const value = feature.properties[prop];
      assert.ok(value !== undefined && value !== null && value !== '',
        `السجل ${index} ينقصه ${prop}`);
    }
  });
});

ok('كل هندسة خط على شارع مسمّى موجود فعلاً في الشبكة', () => {
  const names = new Set();
  roads.features.forEach((road) => {
    if (road.properties && road.properties.name) names.add(road.properties.name);
  });
  portfolio.features.forEach((feature) => {
    assert.ok(names.has(feature.properties.street),
      `شارع غير موجود في الشبكة: ${feature.properties.street}`);
    if (feature.geometry.type !== 'LineString') return;
    assert.ok(feature.geometry.coordinates.length >= 2, 'مقطع بنقطة واحدة');
  });
});

ok('المحفظة تغطي الشرايين لا الشوارع الفرعية وحدها', () => {
  const classes = {};
  portfolio.features.forEach((f) => {
    classes[f.properties.roadClass] = (classes[f.properties.roadClass] || 0) + 1;
  });
  assert.ok(classes.arterial >= 30,
    `شرايين قليلة: ${classes.arterial || 0} — المحفظة على شوارع لا يعرفها أحد`);
  assert.ok(classes.major >= 20, 'طرق رئيسية قليلة');
  assert.ok(classes.local >= 10, 'لا تمثيل للشوارع الفرعية');
});

ok('البحث عن شريان معروف يجد نتيجة — الطبقة العامة تُستعمل بالاسم', () => {
  const streets = portfolio.features.map((f) => f.properties.street);
  ['الملك فهد', 'الدائري'].forEach((needle) => {
    assert.ok(streets.some((street) => street.indexOf(needle) !== -1),
      `لا تصريح على شارع يحوي «${needle}»`);
  });
});

ok('كل اسم شارع بالعربية — لا أسماء لاتينية في واجهة عربية', () => {
  const latin = portfolio.features
    .map((f) => f.properties.street)
    .filter((street) => !/[؀-ۿ]/.test(street));
  assert.deepStrictEqual([...new Set(latin)], [], 'أسماء لاتينية تسربت');
});

ok('الإحداثيات داخل نطاق الرياض', () => {
  portfolio.features.forEach((feature) => {
    const coords = feature.geometry.type === 'Point'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
    coords.forEach(([lng, lat]) => {
      assert.ok(lng > 46.4 && lng < 47.0, `خط طول خارج الرياض: ${lng}`);
      assert.ok(lat > 24.4 && lat < 25.0, `خط عرض خارج الرياض: ${lat}`);
    });
  });
});

ok('كل المجموعات الخمس ممثَّلة', () => {
  const groups = new Set(portfolio.features.map((f) => f.properties.group));
  for (const group of ['roadworks', 'closures', 'incidents', 'diversions', 'pois']) {
    assert.ok(groups.has(group), `مجموعة غائبة: ${group}`);
  }
});

ok('توزيع الحالات يشمل ما ينتظر قراراً — الصندوق يفتح على عمل', () => {
  const statuses = {};
  portfolio.features.forEach((feature) => {
    statuses[feature.properties.status] = (statuses[feature.properties.status] || 0) + 1;
  });
  assert.ok(statuses.ImpactScreening >= 8, 'لا أعمال تنتظر الفرز');
  assert.ok(statuses.StrategyReview >= 8, 'لا أعمال تنتظر الاعتماد');
  assert.ok(statuses.CoordinationRequired >= 3, 'لا تعارضات تحتاج تنسيقاً');
  assert.ok(Object.keys(statuses).length >= 5, 'تنوّع حالات ضعيف');
});

ok('الأثر محسوب فعلاً ويتغير بين السجلات', () => {
  const values = portfolio.features
    .map((f) => f.properties.impactVehHours)
    .filter((value) => typeof value === 'number' && value > 0);
  assert.ok(values.length >= 100, 'أغلب السجلات بلا أثر محسوب');
  assert.ok(new Set(values).size > 50, 'قيم مزروعة لا محسوبة');
});

ok('ما يتجاوز نطاق الفحص السريع مُعلَّم للتصعيد لا مُقدَّم رقماً دقيقاً', () => {
  const beyond = portfolio.features.filter((f) => f.properties.delayPct > 150);
  beyond.forEach((feature) => {
    assert.strictEqual(feature.properties.escalate, true,
      `تأخير ${feature.properties.delayPct}% بلا علامة تصعيد: ${feature.properties.permitRef}`);
    assert.ok(feature.properties.escalateReason.length > 4, 'تصعيد بلا سبب معلن');
    assert.strictEqual(feature.properties.confidence, 'low', 'ثقة مرتفعة فوق نطاق النموذج');
  });
  assert.ok(beyond.length < portfolio.features.length * 0.25,
    'أكثر من ربع المحفظة خارج نطاق النموذج — المدخل خاطئ لا البوابة');
});

ok('نافذة العرض تغطي أيام التحكيم', () => {
  const judging = Date.UTC(2026, 6, 27);
  const active = portfolio.features.filter((feature) => {
    return Date.parse(feature.properties.start) <= judging + 86400000
      && Date.parse(feature.properties.end) >= judging;
  });
  assert.ok(active.length >= 20,
    `أعمال قليلة في نافذة التحكيم: ${active.length} — مرشح «اليوم» سيبدو فارغاً`);
});

ok('زمن الانتهاء بعد زمن البدء في كل سجل', () => {
  portfolio.features.forEach((feature) => {
    assert.ok(Date.parse(feature.properties.end) > Date.parse(feature.properties.start),
      `نافذة معكوسة: ${feature.properties.permitRef}`);
  });
});

ok('المسارات المغلقة لا تتجاوز الكلية', () => {
  portfolio.features.forEach((feature) => {
    assert.ok(feature.properties.lanesClosed <= feature.properties.lanes,
      `إغلاق يتجاوز السعة: ${feature.properties.permitRef}`);
  });
});

ok('التطبيع لا يُسقط أي سجل', () => {
  const normalized = Data.normalizeWorks(portfolio);
  assert.strictEqual(normalized.features.length, portfolio.features.length);
});

ok('النسخة المضمّنة مطابقة للملف', () => {
  const wrapped = fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson.js'), 'utf8');
  const embedded = wrapped.replace(/^window\.ATHAR_CITY_PORTFOLIO = /, '').replace(/;\s*$/, '');
  assert.deepStrictEqual(JSON.parse(embedded), JSON.parse(raw));
});

console.log(`\n${passed} اختبارات نجحت`);
