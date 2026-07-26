'use strict';
const assert = require('assert');
const path = require('path');
const Inbox = require(path.join(__dirname, '..', 'athar-desk-inbox.js'));
const File = require(path.join(__dirname, '..', 'athar-desk-file.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

function feature(props) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[46.68, 24.71], [46.69, 24.72]] },
    properties: Object.assign({
      id: 'w1', permitRef: 'BLD-2026-0001', status: 'StrategyReview',
      street: 'طريق الملك فهد', title: 'أعمال على طريق الملك فهد',
      severity: 3, confidence: 'low', impactVehHours: 940, delayPct: 42.5,
      start: '2026-07-22T06:00:00Z', end: '2026-07-24T06:00:00Z',
      promoter: 'شركة المياه الوطنية', contractor: 'دار التنفيذ',
      lanes: 4, lanesClosed: 2, direction: 'شمال', version: 1,
      escalate: false, escalateReason: '', sensitivity: 'normal',
    }, props || {}),
  };
}

/* ---- صندوق الأعمال ---- */

ok('الصف يعرض الحقول السبعة التي يطلبها نظام التصميم', () => {
  const html = Inbox.renderRow(feature(), false);
  ['BLD-2026-0001', 'طريق الملك فهد', 'مراجعة القرار', 'اعتمد أو أرجع']
    .forEach((needle) => assert.ok(html.indexOf(needle) !== -1, `الصف ينقصه: ${needle}`));
  assert.ok(/94\d/.test(html), 'الأثر غير معروض');
});

ok('الحالة تُنقل بلون ورمز ونص معاً لا باللون وحده', () => {
  const html = Inbox.renderRow(feature(), false);
  assert.ok(html.indexOf('◆') !== -1, 'رمز الحالة مفقود');
  assert.ok(html.indexOf('مراجعة القرار') !== -1, 'نص الحالة مفقود');
  assert.ok(html.indexOf('data-tone="danger"') !== -1, 'نبرة الحالة مفقودة');
});

ok('الصف المحدد يعلن نفسه للقارئ الصوتي', () => {
  assert.ok(Inbox.renderRow(feature(), true).indexOf('aria-selected="true"') !== -1);
  assert.ok(Inbox.renderRow(feature(), false).indexOf('aria-selected="false"') !== -1);
});

ok('كل صف قابل للوصول بلوحة المفاتيح', () => {
  const html = Inbox.renderRow(feature(), false);
  assert.ok(html.indexOf('tabindex') !== -1, 'الصف خارج مسار التنقل');
  assert.ok(html.indexOf('role="option"') !== -1);
});

ok('الصف يحمل معرّفه كي تربطه الخريطة', () => {
  assert.ok(Inbox.renderRow(feature(), false).indexOf('data-work-id="w1"') !== -1);
});

ok('العمل المُحال للتصعيد يُعلَّم في الصف', () => {
  const html = Inbox.renderRow(feature({ escalate: true, escalateReason: 'خارج النطاق' }), false);
  assert.ok(html.indexOf('تصعيد') !== -1, 'التصعيد غير ظاهر في الصندوق');
});

ok('المرفق الحساس يظهر في الصف', () => {
  assert.ok(Inbox.renderRow(feature({ sensitivity: 'hospital' }), false).indexOf('مستشفى') !== -1);
  assert.ok(Inbox.renderRow(feature({ sensitivity: 'school' }), false).indexOf('مدرسة') !== -1);
});

ok('القائمة الفارغة تشرح ولا تصمت', () => {
  const html = Inbox.renderList([], null);
  assert.ok(html.indexOf('لا نتائج') !== -1, 'حالة فارغة صامتة');
});

ok('القائمة صندوق خيارات معلن للقارئ الصوتي', () => {
  const html = Inbox.renderList([feature()], 'w1');
  assert.ok(html.indexOf('role="listbox"') !== -1);
  assert.ok(html.indexOf('aria-selected="true"') !== -1);
});

ok('شريط الأدوات يفصل المرئي عن الكلي ويعدّ ما ينتظر قراراً', () => {
  const html = Inbox.renderToolbar({ total: 150, visible: 12, needsDecision: 40, byStatus: {} }, {});
  assert.ok(html.indexOf('12') !== -1 && html.indexOf('150') !== -1);
  assert.ok(html.indexOf('40') !== -1, 'عدّاد ما ينتظر قراراً مفقود');
});

ok('شريط الأدوات يحمل بحثاً ومرشح حالة ومنتقي فرز', () => {
  const html = Inbox.renderToolbar({ total: 1, visible: 1, needsDecision: 0, byStatus: {} }, {});
  ['desk-search', 'desk-status', 'desk-sort'].forEach((id) => {
    assert.ok(html.indexOf('id="' + id + '"') !== -1, `عنصر مفقود: ${id}`);
  });
});

ok('كل حقل في شريط الأدوات له تسمية — لا placeholder وحده', () => {
  const html = Inbox.renderToolbar({ total: 1, visible: 1, needsDecision: 0, byStatus: {} }, {});
  const labels = html.match(/<label/g) || [];
  assert.ok(labels.length >= 3, `تسميات ناقصة: ${labels.length}`);
});

/**
 * العدّاد وحده هو المتغيّر — لا الشريط كله.
 * ---------------------------------------------------------------------------
 * الشريط كان يُعاد بناؤه عند كل تغيّر في المخزن ليتحدّث سطر العدّادات، فيُهدَم
 * حقل البحث الذي يكتب فيه المراجع وتُفقد البؤرة والمؤشّر بعد أول حرف: تُكتب
 * «الملك» فتبقى «ا». فصل السطر يجعل تحديثه ممكناً بلا مساس بالحقول.
 */
ok('سطر العدّادات وحدة قائمة بذاتها تُحدَّث بلا إعادة بناء الشريط', () => {
  const counts = { total: 150, visible: 12, needsDecision: 40, byStatus: {} };
  const line = Inbox.renderCounts(counts);
  assert.ok(line.indexOf('12') !== -1 && line.indexOf('150') !== -1);
  assert.ok(line.indexOf('40') !== -1);
  assert.ok(line.indexOf('<input') === -1 && line.indexOf('<select') === -1,
    'السطر يحمل حقلاً — تحديثه سيهدم ما يكتب فيه المراجع');

  const bar = Inbox.renderToolbar(counts, {});
  assert.ok(bar.indexOf('id="desk-counts"') !== -1, 'لا مرساة للتحديث الموضعي');
  assert.ok(bar.indexOf(line) !== -1, 'الشريط لا يبني عدّاده من الدالة نفسها');
});

/* ---- ملف القرار ---- */

ok('ملف القرار الفارغ يوجّه الخطوة التالية', () => {
  const html = File.renderEmpty();
  assert.ok(html.indexOf('اختر') !== -1, 'لا توجيه للخطوة التالية');
});

ok('رأس الملف يعرض المرجع والشارع والنسخة', () => {
  const html = File.renderHeader(feature());
  ['BLD-2026-0001', 'طريق الملك فهد'].forEach((needle) => {
    assert.ok(html.indexOf(needle) !== -1, `الرأس ينقصه: ${needle}`);
  });
  assert.ok(/نسخة\s*1/.test(html), 'رقم النسخة مفقود');
});

ok('التبويبات السبعة كلها معلنة والنشط معلَّم', () => {
  const html = File.renderTabs('impact');
  ['الملخص', 'الأثر', 'التعارض', 'الخطة', 'التاريخ', 'النشر', 'القياس']
    .forEach((tab) => assert.ok(html.indexOf(tab) !== -1, `تبويب مفقود: ${tab}`));
  assert.ok(html.indexOf('aria-selected="true"') !== -1);
  assert.ok(html.indexOf('role="tablist"') !== -1);
});

ok('شريط الثقة يشرح سبب الانخفاض وما يرفعها', () => {
  const html = File.renderConfidence(feature({ confidence: 'low' }));
  assert.ok(html.indexOf('منخفضة') !== -1, 'مستوى الثقة مفقود');
  assert.ok(html.length > 120, 'شريط الثقة نسبة مجردة بلا تفسير');
  assert.ok(html.indexOf('يرفعها') !== -1, 'لا يذكر ما يرفع الثقة');
  assert.ok(html.indexOf('آخر معايرة') !== -1, 'لا إشارة إلى آخر معايرة');
});

ok('الثقة المرتفعة لا تدّعي معايرة لم تحدث', () => {
  const html = File.renderConfidence(feature({ confidence: 'high', severity: 1 }));
  assert.ok(html.indexOf('عالية') !== -1);
  assert.ok(html.indexOf('—') !== -1, 'آخر معايرة تُقدَّم كأنها موجودة');
});

ok('سبب التصعيد يظهر في شريط الثقة حين يُعلَّم العمل', () => {
  const html = File.renderConfidence(feature({
    confidence: 'low', escalate: true, escalateReason: 'التأخير يتجاوز نطاق الفحص السريع المعلن',
  }));
  assert.ok(html.indexOf('التأخير يتجاوز نطاق الفحص السريع') !== -1);
});

ok('العوائق تُعرض برسائلها لا برموزها', () => {
  const html = File.renderBlockers([
    { field: 'inputsVersion', reason: 'snapshot-required', message: 'لا اعتماد بلا نسخة مدخلات مثبّتة.' },
  ]);
  assert.ok(html.indexOf('لا اعتماد بلا نسخة مدخلات') !== -1);
  assert.ok(html.indexOf('snapshot-required') === -1, 'رمز داخلي تسرّب للواجهة');
  assert.ok(html.indexOf('role="alert"') !== -1, 'العائق لا يُعلَن للقارئ الصوتي');
});

ok('لا عوائق يعني لا صندوق تحذير', () => {
  assert.strictEqual(File.renderBlockers([]), '');
});

ok('بطاقة القرار تعرض ثلاثة أسباب رقمية بحد أقصى', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 42.5, delayVehHours: 940 },
    alternatives: [{ label: 'نافذة ليلية', delayVehHours: 310 }],
    reasons: [{ label: 'ساعة الذروة', value: 0.42 }, { label: 'مساران مغلقان', value: 0.31 },
      { label: 'حجم الحركة', value: 0.18 }, { label: 'عامل رابع', value: 0.09 }],
    conflicts: [], delta: -67,
  });
  assert.ok(html.indexOf('عامل رابع') === -1, 'أكثر من ثلاثة أسباب');
  assert.ok(html.indexOf('ساعة الذروة') !== -1);
});

ok('الأسباب النصية القادمة من المحرك تُعرض كما هي', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 42.5, delayVehHours: 940 },
    alternatives: [{ label: 'كتلة متواصلة تبدأ 22:00', delayVehHours: 78 }],
    reasons: ['نافذة خارج الذروة (الطلب أقل بـ65%)', 'تنفيذ في مرحلة واحدة', 'تفادي ذروة الصباح', 'سبب رابع'],
    conflicts: [], delta: -94,
  });
  assert.ok(html.indexOf('نافذة خارج الذروة') !== -1, 'السبب النصي لم يُعرض');
  assert.ok(html.indexOf('سبب رابع') === -1, 'أكثر من ثلاثة أسباب');
  assert.ok(html.indexOf('NaN') === -1, 'قيمة NaN مكان النسبة الغائبة');
});

ok('البطاقة تعرض الفرق عن الطلب الأصلي', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 42.5, delayVehHours: 940 },
    alternatives: [{ label: 'نافذة ليلية', delayVehHours: 310 }],
    reasons: [], conflicts: [], delta: -67,
  });
  assert.ok(/67/.test(html), 'الفرق عن الطلب مفقود');
  assert.ok(html.indexOf('نافذة ليلية') !== -1, 'البديل الفائز غير مسمّى');
});

ok('البطاقة تترجم الأثر إلى وحدات القرار بنطاقاتها', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 42.5, delayVehHours: 940 },
    alternatives: [{ label: 'كتلة ليلية', delayVehHours: 310 }],
    reasons: [], conflicts: [], delta: -67,
    units: {
      personHoursLow: 1128, personHoursHigh: 1504, occLow: 1.2, occHigh: 1.6,
      sarLow: 16359, sarHigh: 38171, wageHourlySAR: 36.25, shareLow: 0.4, shareHigh: 0.7,
      co2Low: 1520, co2High: 2389,
    },
  });
  ['ساعات الأشخاص', 'قيمة الوقت', 'انبعاثات كربون'].forEach((label) => {
    assert.ok(html.indexOf(label) !== -1, `وحدة قرار مفقودة: ${label}`);
  });
  assert.ok(html.indexOf('–') !== -1, 'القيم مطويّة إلى رقم واحد بلا نطاق');
  assert.ok(html.indexOf('ريال') !== -1 && html.indexOf('كجم') !== -1);
});

ok('كل وحدة قرار تحمل افتراضها معها', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 10, delayVehHours: 100 },
    alternatives: [{ label: 'x', delayVehHours: 90 }],
    reasons: [], conflicts: [], delta: -10,
    units: {
      personHoursLow: 120, personHoursHigh: 160, occLow: 1.2, occHigh: 1.6,
      sarLow: 1740, sarHigh: 4060, wageHourlySAR: 36.25, shareLow: 0.4, shareHigh: 0.7,
      co2Low: 162, co2High: 254,
    },
  });
  assert.ok(html.indexOf('إشغال') !== -1, 'نطاق الإشغال غير معلن');
  assert.ok(html.indexOf('أجر') !== -1, 'سنة/قيمة الأجر غير معلنة');
  assert.ok(html.indexOf('لا يشمل انبعاثات التنفيذ') !== -1, 'حدود حساب الكربون غير معلنة');
});

ok('غياب الوحدات لا يطبع قسماً فارغاً', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 10, delayVehHours: 100 },
    alternatives: [{ label: 'x', delayVehHours: 90 }],
    reasons: [], conflicts: [], delta: -10,
  });
  assert.ok(html.indexOf('الأثر بوحدات القرار') === -1);
  assert.ok(html.indexOf('NaN') === -1 && html.indexOf('undefined') === -1);
});

ok('قيمة الوقت غير المحسوبة تُعرض شرطة لا صفراً', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 10, delayVehHours: 100 },
    alternatives: [{ label: 'x', delayVehHours: 90 }],
    reasons: [], conflicts: [], delta: -10,
    units: {
      personHoursLow: 120, personHoursHigh: 160, occLow: 1.2, occHigh: 1.6,
      sarLow: null, sarHigh: null, wageHourlySAR: 36.25, shareLow: 0.4, shareHigh: 0.7,
      co2Low: 162, co2High: 254,
    },
  });
  assert.ok(html.indexOf('0 ريال') === -1, 'صفر مكان قيمة غير محسوبة');
  assert.ok(html.indexOf('—') !== -1);
});

ok('العمل المُصعَّد لا يُعرض تأخيره رقماً دقيقاً', () => {
  const html = File.renderSummary(feature({ escalate: true, escalateReason: 'خارج النطاق' }), {
    scored: { delayPct: 1007.8, delayVehHours: 781148 },
    alternatives: [{ label: 'كتلة ليلية', delayVehHours: 2000 }],
    reasons: [], conflicts: [], delta: -99.7,
  });
  assert.ok(html.indexOf('1,007.8٪') === -1, 'رقم خارج النطاق مُقدَّم كتقدير');
  assert.ok(html.indexOf('خارج نطاق الفحص السريع') !== -1, 'لا إحالة معلنة');
});

ok('وحدات القرار المشتقّة من تقدير خارج النطاق تحمل تحفظه', () => {
  const units = {
    personHoursLow: 937378, personHoursHigh: 1249837, occLow: 1.2, occHigh: 1.6,
    sarLow: 13591981, sarHigh: 31714623, wageHourlySAR: 36.25, shareLow: 0.4, shareHigh: 0.7,
    co2Low: 1263117, co2High: 1984898,
  };
  const analysis = {
    scored: { delayPct: 1007.8, delayVehHours: 781148 },
    alternatives: [{ label: 'كتلة ليلية', delayVehHours: 2000 }],
    reasons: [], conflicts: [], delta: -99.7, units: units,
  };
  const beyond = File.renderSummary(feature({ escalate: true, escalateReason: 'خارج النطاق' }), analysis);
  assert.ok(beyond.indexOf('رتبة مقدار') !== -1, 'الريال يُقدَّم دقيقاً وأصله خارج النطاق');

  const normal = File.renderSummary(feature({ escalate: false }), analysis);
  assert.ok(normal.indexOf('رتبة مقدار') === -1, 'تحفظ على عمل داخل النطاق');
});

ok('لا توصية عند غياب البدائل — امتناع صريح', () => {
  const html = File.renderSummary(feature(), {
    scored: null, alternatives: [], reasons: [], conflicts: [], delta: null,
  });
  assert.ok(html.indexOf('لا توصية') !== -1, 'يوصي بلا أساس');
});

ok('التعارضات تظهر بعددها ولا تُخفى', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 10, delayVehHours: 100 },
    alternatives: [{ label: 'x', delayVehHours: 90 }],
    reasons: [], conflicts: [{ withRef: 'BLD-2026-0099', overlapHours: 12 }], delta: -10,
  });
  assert.ok(html.indexOf('تعارض') !== -1);
  assert.ok(html.indexOf('BLD-2026-0099') !== -1, 'العمل المتعارض غير مسمّى');
});

ok('أزرار الإجراء مشتقة من الحالة لا مكتوبة يدوياً', () => {
  const review = File.renderActions(feature({ status: 'StrategyReview' }));
  assert.ok(review.indexOf('data-action="approve"') !== -1);
  assert.ok(review.indexOf('data-action="return"') !== -1);
  const approved = File.renderActions(feature({ status: 'Approved' }));
  assert.ok(approved.indexOf('data-action="approve"') === -1, 'اعتماد ما هو معتمد');
  assert.ok(approved.indexOf('data-action="schedule"') !== -1);
});

ok('الحالة النهائية بلا أزرار ومع تفسير', () => {
  const html = File.renderActions(feature({ status: 'Calibrated' }));
  assert.ok(html.indexOf('<button') === -1, 'أزرار على حالة نهائية');
  assert.ok(html.length > 10, 'صمت بلا تفسير');
});

ok('سجل التدقيق يعرض الأحداث بترتيبها ولا يُخفي شيئاً', () => {
  const html = File.renderAudit([
    { action: 'approve', from: 'StrategyReview', to: 'Approved', actor: 'مراجع أول',
      reason: 'ضمن الحد', at: '2026-07-25T10:00:00Z', version: 2 },
  ]);
  assert.ok(html.indexOf('مراجع أول') !== -1);
  assert.ok(html.indexOf('ضمن الحد') !== -1);
  assert.ok(html.indexOf('اعتماد') !== -1, 'الإجراء بالرمز الإنجليزي لا بالعربية');
});

ok('سجل تدقيق فارغ يقول ذلك صراحة', () => {
  assert.ok(File.renderAudit([]).indexOf('لا قرارات') !== -1);
});

/* ---- الأمان والصلابة ---- */

ok('لا حقن HTML من بيانات التصريح', () => {
  const hostile = feature({ street: '<img src=x onerror=alert(1)>', promoter: '"onmouseover="x' });
  [Inbox.renderRow(hostile, false), File.renderHeader(hostile),
    File.renderSummary(hostile, { scored: null, alternatives: [], reasons: [], conflicts: [], delta: null }),
  ].forEach((html) => {
    assert.ok(html.indexOf('<img') === -1, 'تسرّب وسم');
    assert.ok(html.indexOf('onmouseover="x') === -1, 'تسرّب سمة');
  });
});

ok('الحقول الناقصة لا تُظهر undefined', () => {
  const bare = { type: 'Feature', geometry: null, properties: { id: 'x' } };
  [Inbox.renderRow(bare, false), File.renderHeader(bare), File.renderConfidence(bare)]
    .forEach((html) => {
      assert.ok(html.indexOf('undefined') === -1, 'قيمة غير معرّفة تسربت');
      assert.ok(html.indexOf('NaN') === -1, 'قيمة NaN تسربت');
    });
});

console.log(`\n${passed} اختبارات نجحت`);
