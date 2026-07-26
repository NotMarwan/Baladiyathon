'use strict';
/**
 * حزمة القياس الميداني — نقطة الدخول.
 * ---------------------------------------------------------------------------
 * **لماذا تُبنى قبل وصول البيانات.**
 *
 * لأن اللحظة التي تصل فيها حالة ميدانية هي أسوأ لحظة لبناء منظومة قياس: تكون
 * البيانات بصيغة الجهة، والوقت ضيّقاً، والإغراء إلى «نستوردها الآن ونرتّبها
 * لاحقاً» أقوى ما يكون. وما يُرتَّب لاحقاً يُرتَّب على ما تقوله النتيجة.
 *
 * فالمخطط والفحوص والقواعد مكتوبة **الآن**، وقبل أن نعرف ما ستقوله البيانات.
 *
 * **وما لا تدّعيه الحزمة.**
 *
 * وجودها ليس دليلاً. لا حالة ميدانية واحدة في المستودع، والمثال المرفق تركيبي
 * موسوم يرفض حارسُ السببية أن يُحسب منه أثر. البنية التحتية الجاهزة لا ترفع
 * درجة الأثر المثبت — ترفع فقط سرعة الاستفادة من أول حالة تصل.
 */

const path = require('node:path');
const fs = require('node:fs');

const checks = require('./lib/checks.js');
const counterfactual = require('./lib/counterfactual.js');
const reports = require('./lib/reports.js');

const ROOT = __dirname;

/** ملفات الحزمة المعلنة — تُفحص وجودها في البوابة. */
const FILES = {
  schema: path.join(ROOT, 'field-study.schema.json'),
  dictionary: path.join(ROOT, 'DATA-DICTIONARY.md'),
  request: path.join(ROOT, 'DATA-REQUEST.md'),
  sufficiency: path.join(ROOT, 'SUFFICIENCY.md'),
  example: path.join(ROOT, 'examples', 'synthetic-example.json'),
  templates: [
    path.join(ROOT, 'templates', 'series.csv'),
    path.join(ROOT, 'templates', 'closure-phases.csv'),
    path.join(ROOT, 'templates', 'confounders.csv'),
  ],
};

function schema() {
  return JSON.parse(fs.readFileSync(FILES.schema, 'utf8'));
}

function example() {
  return JSON.parse(fs.readFileSync(FILES.example, 'utf8'));
}

/**
 * يستورد حزمة ويعيد حكماً كاملاً عليها.
 *
 * الترتيب مقصود: الاكتمال ثم الجودة ثم الاتساق ثم السببية. حزمةٌ ناقصة لا
 * يُسأل عن سببيتها، وحكمُ السببية على بيانات مفكّكة يوهم بأنها قابلة للتحليل.
 *
 * @param {object} study
 * @param {object} [predicted] توقّع المحرك `{ delayVehHours, source }`
 */
function ingest(study, predicted) {
  const inspection = checks.inspect(study);
  const causal = counterfactual.canClaimCausal(study);

  if (!inspection.importable) {
    return {
      accepted: false,
      stage: 'الاكتمال',
      inspection,
      causal,
      reports: null,
      statement: 'الحزمة غير قابلة للاستيراد — حقول مفقودة: '
        + inspection.parts.completeness.missing.join('، '),
    };
  }

  const comparison = reports.beforeDuringAfter(study);
  const calibration = reports.expectedVsObserved(study, predicted);

  return {
    accepted: true,
    /* «مقبولة» تعني قابلة للاستيراد، لا صالحة للاستنتاج. `usable` هو الحقل
       الذي يقرؤه من يريد أن يستنتج، و`causal.allowed` هو الذي يقرؤه من يريد
       أن ينسب. الثلاثة مفصولة عمداً. */
    usable: inspection.usable,
    stage: 'مكتملة',
    inspection,
    causal,
    reports: { comparison, calibration },
    statement: comparison.statement,
  };
}

/** هل ملفات الحزمة كلها موجودة؟ */
function manifest() {
  const rows = [];
  Object.keys(FILES).forEach((key) => {
    const value = FILES[key];
    const list = Array.isArray(value) ? value : [value];
    list.forEach((file) => {
      rows.push({ key, file: path.relative(ROOT, file), exists: fs.existsSync(file) });
    });
  });
  return { complete: rows.every((row) => row.exists), rows };
}

module.exports = {
  FILES,
  schema,
  example,
  ingest,
  manifest,
  checks,
  counterfactual,
  reports,
};
