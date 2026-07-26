'use strict';
/**
 * WP-H2 — الملف المرجعي لقيم الأثر.
 *
 * أقوى ما يملكه المشروع أن `score()` تحسب فعلاً: إعادة حساب مستقلة طابقت
 * 150 من 150 ضمن واحد بالمئة. وهذا الأصل كان بلا حماية.
 *
 * تُعدَّل `optimize()` في B1، وهي تشارك `score()` الملف نفسه والثوابت نفسها.
 * انزلاقة في ثابت أو في ترتيب عملية تغيّر كل رقم منشور بصمت. هذه الحزمة
 * تجعل الانزلاقة تفشل في الثانية بدل أن تُكتشف في التحكيم.
 *
 * القاعدة: لا يُعاد توليد المرجع لإسكات فشل. الفشل هنا خبر، لا عائق.
 * تغيير القيم المرجعية يعني أن الأرقام المنشورة تغيّرت — وذلك قرار مكتوب
 * يُبرَّر، لا تحديث تلقائي.
 *
 * التشغيل: node presentation/tests/impact-golden-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const Engine = require(path.join(ROOT, 'athar-engine.js'));

const GOLDEN_PATH = path.join(__dirname, 'fixtures', 'impact-golden.json');
const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

/* النسبة لا الفرق المطلق: تصريح بثلاثة آلاف ساعة-مركبة وتصريح بثلاثين ألفاً
   لا يحتملان العتبة نفسها. واحد بالمئة يمرّ فروق الفاصلة العائمة ويسقط أي
   تغيير حقيقي في المعادلة. */
function pctDiff(actual, expected) {
  if (expected === 0) return actual === 0 ? 0 : Infinity;
  return Math.abs((actual - expected) / expected) * 100;
}

test('المرجع مكتمل — مئة وخمسون مدخلاً لا عيّنة منها', () => {
  assert.strictEqual(golden.count, 150, `المرجع فيه ${golden.count} لا 150`);
  assert.strictEqual(golden.entries.length, golden.count);
});

test('كل مدخل يحمل مدخلاته كاملة فيُعاد حسابه لا يُصدَّق', () => {
  const required = ['aadt', 'lanes', 'lanesClosed', 'capacityPerLane',
    'freeFlowMin', 'startHour', 'durationHours'];
  golden.entries.forEach((entry) => {
    required.forEach((field) => {
      assert.ok(entry.input[field] !== undefined,
        `${entry.id}: الحقل ${field} مفقود — المرجع غير قابل لإعادة التشغيل`);
    });
  });
});

test('ساعات التأخير تطابق المرجع ضمن واحد بالمئة — كل المئة والخمسين', () => {
  const drifted = [];
  golden.entries.forEach((entry) => {
    const actual = Engine.score(entry.input).delayVehHours;
    const drift = pctDiff(actual, entry.delayVehHours);
    if (drift > golden.tolerancePct) {
      drifted.push(`${entry.permitRef}: ${entry.delayVehHours.toFixed(1)}`
        + ` صار ${actual.toFixed(1)} (${drift.toFixed(2)}٪)`);
    }
  });
  assert.strictEqual(drifted.length, 0,
    `${drifted.length} تصريحاً انزلقت قيمته:\n    ` + drifted.slice(0, 8).join('\n    ')
    + '\n  الحساب تغيّر. إن كان التغيير مقصوداً فبرِّره كتابةً ثم أعد توليد المرجع'
    + ' بـ scripts/build-impact-golden.js — ولا تعِد توليده لإسكات هذا الفشل.');
});

test('الدرجة ومستواها لا ينزلقان — العتبات تحكم لون البطاقة', () => {
  const drifted = [];
  golden.entries.forEach((entry) => {
    const result = Engine.score(entry.input);
    if (result.score !== entry.score || result.level !== entry.level) {
      drifted.push(`${entry.permitRef}: ${entry.score}/${entry.level}`
        + ` صار ${result.score}/${result.level}`);
    }
  });
  assert.strictEqual(drifted.length, 0,
    `${drifted.length} تصريحاً تغيّر تصنيفه:\n    ` + drifted.slice(0, 8).join('\n    '));
});

test('الثوابت الحاكمة مثبَّتة — تغيّرها يغيّر كل رقم منشور', () => {
  /* هذه الثوابت غير مصدرية ومعلنة كذلك. تثبيتها هنا ليس ادعاء صحتها، بل
     ضمان ألّا تتحرك دون أن يلاحظ أحد. C1 ستعرض نطاقها؛ حتى ذلك الحين
     تُثبَّت قيمتها الحالية. */
  const c = Engine.CALIBRATION;
  assert.strictEqual(c.SCORE_CALIBRATION, 0.35, 'SCORE_CALIBRATION تحرّك');
  assert.strictEqual(c.WORK_ZONE_FRICTION, 1.10, 'WORK_ZONE_FRICTION تحرّك');
  assert.strictEqual(c.COMPOUND_FACTOR, 1.3, 'COMPOUND_FACTOR تحرّك');
});

console.log(`ALL TESTS PASSED (${count})`);
