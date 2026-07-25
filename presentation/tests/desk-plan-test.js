'use strict';
const assert = require('assert');
const path = require('path');

const Plan = require(path.join(__dirname, '..', 'athar-desk-plan.js'));
const Engine = require(path.join(__dirname, '..', 'athar-engine.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const STAMP = '2026-07-25T09:30:00.000Z';

function work(props) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[46.68, 24.71], [46.69, 24.72]] },
    properties: Object.assign({
      id: 'w1', permitRef: 'BLD-2026-0084', street: 'طريق الملك فهد',
      promoter: 'شركة المياه الوطنية', contractor: 'مقاولات الخليج',
      status: 'Approved', version: 2, lanes: 4, lanesClosed: 2, direction: 'شمال',
      start: '2026-07-19T06:00:00Z', end: '2026-08-16T14:00:00Z',
      windowHours: 8, workDays: 18, confidence: 'low', escalate: false,
    }, props || {}),
  };
}

function analysis(props) {
  return Object.assign({
    scored: { delayVehHours: 781148, delayPct: 42.5, level: 'high' },
    alternatives: [{
      label: 'كتلة متواصلة تبدأ 22:00',
      windows: [{ dayOffset: 0, startHour: 22, durationHours: 8 }],
      reasons: ['نافذة خارج الذروة', 'تنفيذ في مرحلة واحدة'],
    }],
    conflicts: [],
  }, props || {});
}

/* ---- البناء: يقرأ ولا يخترع ---- */

const plan = Plan.build(work(), analysis(), STAMP);

ok('الخطة تحمل تعريف التصريح وجهته ومقاوله', () => {
  assert.strictEqual(plan.permitRef, 'BLD-2026-0084');
  assert.strictEqual(plan.promoter, 'شركة المياه الوطنية');
  assert.strictEqual(plan.contractor, 'مقاولات الخليج');
});

ok('النافذة الموصى بها من البديل الفائز لا من المطلوب', () => {
  assert.strictEqual(plan.recommendation, 'كتلة متواصلة تبدأ 22:00');
  assert.strictEqual(plan.windows.length, 1);
});

ok('الختم يُحقن ولا يُقرأ من الساعة — الخرج قابل لإعادة الإنتاج', () => {
  // Date.now() هنا كان سيجعل كل توليد مختلفاً، فيسقط أيّ اختبار على الوثيقة.
  const again = Plan.build(work(), analysis(), STAMP);
  assert.deepStrictEqual(Plan.toDocument(plan), Plan.toDocument(again));
});

ok('عمل بلا بديل يُنتج خطة بلا توصية لا خطة كاذبة', () => {
  const bare = Plan.build(work(), analysis({ alternatives: [] }), STAMP);
  assert.strictEqual(bare.recommendation, null);
  assert.ok(Plan.renderTab(bare).indexOf('لا بديل مرجَّح') !== -1);
  assert.ok(Plan.renderTab(bare).indexOf('deskExportPlan') === -1,
    'عرض زرّ تنزيل لخطة لا توصية فيها');
});

/* ---- الحدّ المعلن: ما لا يحسبه النظام ---- */

const tab = Plan.renderTab(plan);
const doc = Plan.toDocument(plan);

ok('القسمان مفصولان: ما حسبه النظام وما يستكمله المهندس', () => {
  assert.ok(doc.indexOf('ما حسبه النظام') !== -1);
  assert.ok(doc.indexOf('ما يستكمله مهندس المرور') !== -1);
});

ok('بنود المهندس مكتوبة بنداً بنداً لا مذكورة في هامش', () => {
  Plan.ENGINEER_ITEMS.forEach((item) => {
    assert.ok(doc.indexOf(item) !== -1, `بند غائب من الوثيقة: ${item}`);
    assert.ok(tab.indexOf(item) !== -1, `بند غائب من التبويب: ${item}`);
  });
  assert.ok(Plan.ENGINEER_ITEMS.length >= 5, 'قائمة الاستكمال قصيرة على نحو مريب');
});

ok('لا رقم هندسة مرور مخترَع في الوثيقة', () => {
  // أطوال الانتقال واللوحات تحتاج سرعة تصميمية وحكماً هندسياً؛ اختراعها
  // يجعل الوثيقة تبدو أكمل ويجعلها أخطر.
  assert.ok(!/طول الانتقال\s*[:：]\s*\d/.test(doc), 'رقم انتقال مخترَع');
  assert.ok(!/عدد اللوحات\s*[:：]\s*\d/.test(doc), 'جدول لوحات مخترَع');
  assert.ok(doc.indexOf('لا تكتمل الخطة بدونها') !== -1, 'النقص غير معلن');
});

/* ---- الوثيقة: مكتفية بذاتها ---- */

ok('الوثيقة بلا مورد خارجي — تُفتح من القرص', () => {
  assert.ok(doc.indexOf('http://') === -1 && doc.indexOf('https://') === -1,
    'مورد خارجي في وثيقة يُفترض أنها تعمل بلا شبكة');
  assert.ok(doc.indexOf('<link') === -1, 'ملف تنسيق خارجي');
});

ok('الوثيقة عربية RTL ومكتملة البنية', () => {
  assert.ok(doc.indexOf('<html lang="ar" dir="rtl">') !== -1);
  assert.ok(doc.indexOf('<!doctype html>') === 0);
  assert.ok(doc.trim().endsWith('</html>'));
});

ok('الإسناد وختم التوليد في ذيل الوثيقة', () => {
  assert.ok(doc.indexOf('محرك أثر') !== -1, 'مصدر الأثر غير مذكور');
  assert.ok(doc.indexOf('OpenStreetMap') !== -1, 'مصدر الهندسة غير مذكور');
  assert.ok(doc.indexOf('بيانات توضيحية للعرض') !== -1, 'شارة الصدق ساقطة');
  assert.ok(doc.indexOf('2026') !== -1, 'بلا ختم زمني');
});

ok('التصعيد يُحمل إلى الوثيقة بحدّه لا برقمه وحده', () => {
  const escalated = Plan.build(
    work({ escalate: true, escalateReason: 'التأخير يتجاوز نطاق الفحص السريع المعلن' }),
    analysis(), STAMP
  );
  const html = Plan.toDocument(escalated);
  assert.ok(html.indexOf('تنبيه نطاق') !== -1);
  assert.ok(html.indexOf('رتبة مقدار للفرز لا تقدير للاعتماد') !== -1);
});

ok('التعارضات تُنقل إلى الوثيقة حين توجد وتُحذف حين لا توجد', () => {
  const withConflict = Plan.build(work(),
    analysis({ conflicts: [{ withRef: 'BLD-2026-0091', overlapHours: 96 }] }), STAMP);
  assert.ok(Plan.toDocument(withConflict).indexOf('BLD-2026-0091') !== -1);
  assert.ok(doc.indexOf('تعارضات على المقطع') === -1, 'قسم فارغ معروض');
});

/* ---- الترميز وأسماء الملفات ---- */

ok('كل قيمة تمر بترميز HTML', () => {
  const nasty = Plan.build(work({ street: '<img src=x onerror=alert(1)>' }), analysis(), STAMP);
  const html = Plan.toDocument(nasty);
  assert.ok(html.indexOf('<img src=x') === -1, 'نص غير مرمَّز في الوثيقة');
  assert.ok(html.indexOf('&lt;img') !== -1);
});

ok('اسم الملف مشتقّ من المرجع وآمن على نظام الملفات', () => {
  assert.strictEqual(Plan.fileName(plan, 'html'), 'athar-BLD-2026-0084.html');
  const evil = Plan.build(work({ permitRef: '../../etc/passwd' }), analysis(), STAMP);
  assert.ok(Plan.fileName(evil, 'geojson').indexOf('/') === -1, 'مسار في اسم ملف');
  assert.ok(Plan.fileName(evil, 'geojson').indexOf('..') === -1);
});

ok('الأرقام لاتينية في الوثيقة والتبويب', () => {
  assert.ok(!/[٠-٩]/.test(doc), 'أرقام عربية-هندية في الوثيقة');
  assert.ok(!/[٠-٩]/.test(tab), 'أرقام عربية-هندية في التبويب');
});

/* ---- WZDx: العقد المعياري ---- */

ok('WZDx يُبنى من نوافذ البديل الفائز لا من المطلوب', () => {
  const collection = Engine.wzdx({
    id: plan.permitRef, roadName: plan.street, direction: plan.direction,
    lanes: plan.lanes, lanesClosed: plan.lanesClosed,
    startISO: plan.start, durationHours: plan.windowHours,
    windows: plan.windows,
    coordinates: [[46.68, 24.71], [46.69, 24.72]],
  });

  assert.strictEqual(collection.type, 'FeatureCollection');
  assert.strictEqual(collection.features.length, plan.windows.length);
  const core = collection.features[0].properties.core_details;
  assert.strictEqual(core.event_type, 'work-zone');
  assert.strictEqual(core.data_source_id, 'athar-prototype',
    'الافتراض تغيّر — صفحات أخرى تعتمد عليه');
  assert.deepStrictEqual(core.road_names, ['طريق الملك فهد']);
  assert.strictEqual(collection.features[0].properties.vehicle_impact, 'some-lanes-closed');
});

ok('المُصدِّر يسمّي نفسه — ملف تبادل لا يُنسب إلى سطح لم يُنتجه', () => {
  const named = Engine.wzdx({
    dataSourceId: 'athar-reviewer-desk', id: 'x', roadName: 'ط', direction: 'شمال',
    lanes: 3, lanesClosed: 1, startISO: '2026-07-19T06:00:00Z', durationHours: 6,
    coordinates: [[46.6, 24.7], [46.7, 24.8]],
  });
  assert.strictEqual(named.features[0].properties.core_details.data_source_id,
    'athar-reviewer-desk');
});

ok('إغلاق كل المسارات يُعلن كذلك في WZDx', () => {
  const all = Engine.wzdx({
    id: 'x', roadName: 'ط', direction: 'شمال', lanes: 3, lanesClosed: 3,
    startISO: plan.start, durationHours: 6, coordinates: [[46.6, 24.7], [46.7, 24.8]],
  });
  assert.strictEqual(all.features[0].properties.vehicle_impact, 'all-lanes-closed');
});

console.log(`\n${passed} اختبارات نجحت`);
