'use strict';
const assert = require('assert');
const path = require('path');

const Session = require(path.join(__dirname, '..', 'athar-desk-session.js'));
const Engine = require(path.join(__dirname, '..', 'athar-engine.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

function record(props) {
  return Object.assign({
    schema: 1, permitRef: 'BLD-0001', workId: 'w1', version: 2,
    status: 'StrategyReview', action: 'screen', actor: 'مناوب الفرز',
    at: '2026-07-25T08:00:00.000Z',
    asked: { delayVehHours: 1000, delayPct: 40, level: 'high' },
    recommendation: { label: 'كتلة ليلية', delayVehHours: 600, savedPct: 40 },
    delta: -40, reasons: [], conflicts: [], confidence: 'low', escalated: false,
  }, props || {});
}

/* ---- العدّ: عمل واحد يبقى واحداً مهما لمسه المراجع ---- */

ok('السجل الفارغ يعطي حصيلة صفرية لا استثناء', () => {
  const s = Session.summarize({});
  assert.strictEqual(s.works, 0);
  assert.strictEqual(s.headroomVehHours, 0);
  assert.strictEqual(Session.summarize(null).works, 0);
});

ok('عمل مرّ بثلاثة قرارات عملٌ واحد لا ثلاثة', () => {
  const s = Session.summarize({
    w1: [record({ version: 2 }), record({ version: 3 }), record({ version: 4 })],
  });
  assert.strictEqual(s.works, 1);
  assert.strictEqual(s.decisions, 3);
});

ok('الأثر يُجمع من آخر نسخة فقط — لا يُضاعف بعدد اللمسات', () => {
  // العطب الذي يُضخّم كل رقم: جمع نسخ العمل الواحد.
  const s = Session.summarize({
    w1: [
      record({ version: 2, asked: { delayVehHours: 1000 } }),
      record({ version: 3, asked: { delayVehHours: 1000 } }),
      record({ version: 4, asked: { delayVehHours: 1000 } }),
    ],
  });
  assert.strictEqual(s.reviewedVehHours, 1000, 'جُمعت النسخ فتضاعف الرقم');
});

ok('آخر نسخة هي الأعلى رقماً لا الأخيرة في المصفوفة', () => {
  const latest = Session.latestOf([record({ version: 5 }), record({ version: 2 })]);
  assert.strictEqual(latest.version, 5);
});

/* ---- الفرق المتاح: صدقه في حدوده ---- */

ok('الفرق المتاح هو الفجوة بين المطلوب والبديل', () => {
  const s = Session.summarize({ w1: [record()] });
  assert.strictEqual(s.headroomVehHours, 400);
  assert.strictEqual(s.headroomWorks, 1);
});

ok('بديل أسوأ من المطلوب لا يُحسب فرقاً — ولا يُطرح سالباً', () => {
  const s = Session.summarize({
    w1: [record({ asked: { delayVehHours: 500 }, recommendation: { delayVehHours: 900 } })],
  });
  assert.strictEqual(s.headroomVehHours, 0);
  assert.strictEqual(s.headroomWorks, 0);
});

ok('عمل بلا بديل يدخل المفحوص ولا يدخل الفرق', () => {
  const s = Session.summarize({ w1: [record({ recommendation: null })] });
  assert.strictEqual(s.reviewedVehHours, 1000);
  assert.strictEqual(s.headroomVehHours, 0);
});

ok('العمل المُصعَّد يخرج من الفرق ويُعدّ صراحةً', () => {
  // رتبة مقدار لا تُجمع مع تقدير، ولا تُترجم إلى ريال.
  const s = Session.summarize({ w1: [record({ escalated: true })] });
  assert.strictEqual(s.headroomVehHours, 0);
  assert.strictEqual(s.escalatedExcluded, 1);
  assert.strictEqual(s.reviewedVehHours, 1000, 'خرج من المفحوص أيضاً — وهو مفحوص فعلاً');
});

ok('التعارضات تُعدّ من آخر نسخة لكل عمل', () => {
  const s = Session.summarize({
    w1: [record({ version: 2, conflicts: [{ withRef: 'x' }] }),
      record({ version: 3, conflicts: [{ withRef: 'x' }, { withRef: 'y' }] })],
  });
  assert.strictEqual(s.conflictsSeen, 2);
});

ok('الإجراءات تُحصى بأسمائها', () => {
  const s = Session.summarize({
    w1: [record({ action: 'screen' }), record({ version: 3, action: 'approve' })],
    w2: [record({ workId: 'w2', action: 'approve' })],
  });
  assert.strictEqual(s.actions.approve, 2);
  assert.strictEqual(s.actions.screen, 1);
});

ok('أول وآخر توقيت يحدّان الجلسة', () => {
  const s = Session.summarize({
    w1: [record({ at: '2026-07-25T09:00:00.000Z' }),
      record({ version: 3, at: '2026-07-25T07:00:00.000Z' })],
  });
  assert.strictEqual(s.firstAt, '2026-07-25T07:00:00.000Z');
  assert.strictEqual(s.lastAt, '2026-07-25T09:00:00.000Z');
});

/* ---- العرض: لا يدّعي ما لا يملك ---- */

const rendered = Session.render(Session.summarize({
  w1: [record()],
  w2: [record({ workId: 'w2', escalated: true })],
}), Engine, 64);

ok('العرض يسمّي الرقم فرقاً متاحاً لا وفراً محقّقاً', () => {
  assert.ok(rendered.indexOf('فرق متاح') !== -1, 'العنوان لا يقيّد الادعاء');
  assert.ok(rendered.indexOf('وفر محقّق') === -1, 'ادّعى تحقّقاً لم يقع');
  assert.ok(/لا يصير محقّقاً إلا برصد ميداني/.test(rendered), 'شرط التحقّق غير مذكور');
});

ok('كل وحدة قرار تُعرض بنطاقها لا برقم واحد', () => {
  ['ساعات أشخاص', 'قيمة الوقت', 'انبعاثات'].forEach((unit) => {
    assert.ok(rendered.indexOf(unit) !== -1, `وحدة غائبة: ${unit}`);
  });
  const ranges = rendered.match(/–/g) || [];
  assert.ok(ranges.length >= 3, 'وحدة عُرضت برقم واحد بلا نطاق');
});

ok('استبعاد المُصعَّد يُذكر في الوجه لا يُخفى', () => {
  assert.ok(rendered.indexOf('مُصعَّداً خارج هذا الحساب') !== -1,
    'استُبعد عمل بلا إعلان — الرقم يبدو شاملاً وليس كذلك');
});

ok('الأرقام لاتينية في واجهة عربية — كبقية المكتب', () => {
  assert.ok(!/[٠-٩]/.test(rendered), 'أرقام عربية-هندية تكسر اتساق المكتب');
});

ok('الحصيلة الفارغة ترشد إلى أول خطوة ولا تعرض أصفاراً', () => {
  const empty = Session.render(Session.summarize({}), Engine, 118);
  assert.ok(empty.indexOf('لم تُقرّر شيئاً بعد') !== -1);
  assert.ok(empty.indexOf('فرق متاح') === -1, 'عرض أصفاراً بلا معنى');
  assert.ok(empty.indexOf('<kbd>N</kbd>') !== -1, 'لا يقول ما الخطوة التالية');
});

ok('الشارة تصمت قبل أول قرار وتنطق بعده', () => {
  assert.strictEqual(Session.renderBadge(Session.summarize({})), '');
  const badge = Session.renderBadge(Session.summarize({ w1: [record()] }));
  assert.ok(badge.indexOf('قرّرت') !== -1 && badge.indexOf('فرق متاح') !== -1);
});

console.log(`\n${passed} اختبارات نجحت`);
