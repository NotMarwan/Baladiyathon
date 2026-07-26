'use strict';
/**
 * تقرير مطابقة WZDx 4.2 لكل تصاريح المحفظة — أمام المخطط الرسمي عبر AJV.
 * ---------------------------------------------------------------------------
 * **ما يُثبته هذا التقرير.**
 *
 * أن مُخرَج المنتج الفعلي — لا عيّنة مكتوبة يدوياً في اختبار — مرّ على
 * `WorkZoneFeed.json` الرسمي المثبَّت بالتزام محدَّد، وأن كل حالة فاشلة لها
 * سبب مسمّى وحقل مسمّى.
 *
 * **وما لا يُثبته.**
 *
 * أن البيانات صحيحة. المخطط يفحص البنية والأنواع والتعدادات، ولا يعرف أن هذه
 * محفظة تمثيلية مولَّدة ولا أن أرقام الحركة فيها افتراضية. اجتياز المخطط
 * يعني «قابل للتبادل»، لا «صحيح ميدانياً».
 *
 * التشغيل: node presentation/scripts/build-wzdx-conformance.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Exporter = require(path.join(ROOT, 'masar-wzdx-export.js'));
const validator = require('./lib/wzdx-validator.js');

const PORTFOLIO = path.join(ROOT, 'data', 'city-portfolio.geojson');
const RESOLUTION = path.join(ROOT, 'data', 'point-geometry-resolution.json');
const OUT_JSON = path.join(ROOT, 'data', 'wzdx-conformance-report.json');
const OUT_MD = path.join(ROOT, '..', 'docs', 'WZDX-CONFORMANCE.md');

function loadResolutions() {
  if (!fs.existsSync(RESOLUTION)) return {};
  return JSON.parse(fs.readFileSync(RESOLUTION, 'utf8')).resolutions || {};
}

/**
 * يصنّف فشل المخطط بحسب أول حقل مسؤول.
 *
 * التصنيف من الحقول لا من نصّ الرسالة: نصوص AJV تتغيّر بين الإصدارات، وأسماء
 * الحقول من المواصفة.
 */
function classifySchemaFailure(fields) {
  if (fields.some((f) => /direction/.test(f))) return Exporter.OUTCOME.DIRECTION;
  if (fields.some((f) => /geometry|coordinates/.test(f))) return Exporter.OUTCOME.GEOMETRY;
  return Exporter.OUTCOME.REQUIRED;
}

function main() {
  const portfolio = JSON.parse(fs.readFileSync(PORTFOLIO, 'utf8'));
  const resolutions = loadResolutions();

  const rows = [];
  const tally = {};
  const fieldTally = {};

  for (const feature of portfolio.features) {
    const properties = feature.properties || {};
    const ref = properties.permitRef || properties.id || '(بلا رقم)';
    const resolution = resolutions[ref] || null;

    const built = Exporter.buildFeed(feature, { resolution });

    const row = {
      permitRef: ref,
      street: properties.street || '',
      roadClass: properties.roadClass || '',
      sourceGeometry: feature.geometry ? feature.geometry.type : '(بلا هندسة)',
      exportState: built.ok ? 'صُدِّر' : 'مُنع',
      directionInput: properties.direction || '',
      directionMapped: built.direction && built.direction.ok
        ? built.direction.value : '',
      directionState: built.direction
        ? (built.direction.ok ? 'محوَّل' : 'فشل: ' + built.direction.reason)
        : 'لم يُفحص',
      geometryState: built.geometry
        ? (built.geometry.ok ? built.geometry.source : 'مرفوضة')
        : 'لم تُفحص',
      /* التحقق الزمني: أثر لا يثبّت تواريخ ميدانياً، فالحالة معلَنة ثابتة
         بدل أن تُقرأ من ملف قد يُرفع علمه سهواً. */
      timeVerification: 'غير متحقَّق — التواريخ من جدول مقترح لا من تثبيت ميداني',
      positionVerification: 'غير متحقَّق — الهندسة من شبكة الطرق لا من مسح موقعي',
      schemaValid: null,
      schemaErrorCount: null,
      failedFields: [],
      publishable: false,
      outcome: built.outcome,
      blockReason: built.blockers.join(' · '),
      notes: built.notes,
    };

    if (built.ok) {
      let result;
      try {
        result = validator.validateFeed(built.feed);
      } catch (error) {
        row.outcome = Exporter.OUTCOME.ERROR;
        row.blockReason = error.message;
        rows.push(row);
        tally[row.outcome] = (tally[row.outcome] || 0) + 1;
        continue;
      }
      row.schemaValid = result.valid;
      row.schemaErrorCount = result.errorCount;
      row.failedFields = result.fields;
      row.featureCount = built.feed.features.length;
      if (result.valid) {
        row.outcome = Exporter.OUTCOME.PASSED;
        row.publishable = true;
      } else {
        row.outcome = classifySchemaFailure(result.fields);
        row.blockReason = result.errors.map((e) => e.message).join(' · ');
        result.fields.forEach((field) => {
          fieldTally[field] = (fieldTally[field] || 0) + 1;
        });
      }
    }

    rows.push(row);
    tally[row.outcome] = (tally[row.outcome] || 0) + 1;
  }

  const passed = rows.filter((r) => r.publishable).length;
  const report = {
    generatedFrom: 'presentation/scripts/build-wzdx-conformance.js',
    validator: validator.meta(),
    total: rows.length,
    passed,
    failed: rows.length - passed,
    byOutcome: tally,
    byFailedField: fieldTally,
    /* الادّعاء المسموح يُولَّد من العدّ لا يُكتب يدوياً في شريحة. جملةٌ مكتوبة
       تتقادم في أول تغيير بيانات ولا ينبّه أحد. */
    permittedClaim: passed === rows.length
      ? `كل التصاريح (${rows.length}) اجتازت مخطط WZDx 4.2 الرسمي.`
      : `${passed} من ${rows.length} تصريحاً اجتازت مخطط WZDx 4.2 الرسمي، `
        + `و${rows.length - passed} حالة مُنعت — التفصيل في التقرير.`,
    forbiddenClaim: passed === rows.length ? ''
      : 'ممنوع قول «التصدير متوافق مع WZDx 4.2» بلا تقييد ما دامت هناك حالات ممنوعة.',
    rows,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(OUT_MD, markdown(report));

  /* ملخّص خفيف يقرؤه المصدر الحاكم والواجهة.
     التقرير الكامل يحمل 150 صفاً — تحميله في كل صفحة لقراءة رقمين إسرافٌ،
     وكتابة الرقمين يدوياً في الواجهة هو بالضبط ما يُنتج تناقضات الأسطح. */
  const summary = {
    total: report.total,
    passed: report.passed,
    failed: report.failed,
    commit: report.validator.commit,
    validator: report.validator.validator,
    schema: report.validator.schema,
    byOutcome: report.byOutcome,
  };
  fs.writeFileSync(path.join(ROOT, 'data', 'wzdx-conformance-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(ROOT, 'data', 'wzdx-conformance-summary.js'),
    `window.MASAR_WZDX_CONFORMANCE = ${JSON.stringify(summary)};\n`);

  console.log(report.permittedClaim);
  Object.keys(tally).sort().forEach((key) => console.log(`  ${key}: ${tally[key]}`));
  console.log(`\n${OUT_JSON}\n${OUT_MD}`);
}

function markdown(report) {
  const lines = [];
  lines.push('# مطابقة WZDx 4.2 — تقرير المحفظة');
  lines.push('');
  lines.push('> مولَّد آلياً من `presentation/scripts/build-wzdx-conformance.js`.');
  lines.push('> لا تُحرَّر الأرقام يدوياً — أعِد التشغيل.');
  lines.push('');
  lines.push('## المحقق');
  lines.push('');
  lines.push(`- المخطط: ${report.validator.schema}`);
  lines.push(`- المعرّف: \`${report.validator.schemaId}\``);
  lines.push(`- الالتزام المثبَّت: \`${report.validator.commit}\``);
  lines.push(`- المحقق: ${report.validator.validator} · ${report.validator.formats}`);
  lines.push(`- الملفات المثبَّتة: ${report.validator.files.join('، ')}`);
  lines.push('');
  lines.push('## الحصيلة');
  lines.push('');
  lines.push(`**${report.permittedClaim}**`);
  if (report.forbiddenClaim) lines.push('', `⚠ ${report.forbiddenClaim}`);
  lines.push('');
  lines.push('| التصنيف | العدد |');
  lines.push('|---|---|');
  Object.keys(report.byOutcome).sort().forEach((key) => {
    lines.push(`| ${key} | ${report.byOutcome[key]} |`);
  });
  lines.push('');

  const blocked = report.rows.filter((row) => !row.publishable);
  if (blocked.length) {
    lines.push('## الحالات الممنوعة');
    lines.push('');
    lines.push('| التصريح | الشارع | الهندسة | التصنيف | السبب |');
    lines.push('|---|---|---|---|---|');
    blocked.forEach((row) => {
      lines.push(`| ${row.permitRef} | ${row.street} | ${row.sourceGeometry} `
        + `| ${row.outcome} | ${row.blockReason} |`);
    });
    lines.push('');
  }

  lines.push('## أعلام التحقق');
  lines.push('');
  lines.push('كل التصاريح المصدَّرة تحمل:');
  lines.push('');
  lines.push('- `is_start_date_verified: false` · `is_end_date_verified: false`');
  lines.push('- `is_start_position_verified: false` · `is_end_position_verified: false`');
  lines.push('');
  lines.push('التواريخ من جدول مقترح، والهندسة من شبكة الطرق (OpenStreetMap · ODbL). '
    + 'لا مسح ميداني ولا جهاز موقعي في هذه السلسلة، فرفع أي علم منها ادّعاء لا سند له.');
  lines.push('');
  lines.push('## جدول كامل');
  lines.push('');
  lines.push('| التصريح | الشارع | الهندسة المصدر | الاتجاه (داخلي ← معياري) | حالة التصدير | المخطط | أخطاء | حقول فاشلة | قابل للنشر |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  report.rows.forEach((row) => {
    const schema = row.schemaValid === null ? '—' : (row.schemaValid ? 'اجتاز' : 'سقط');
    lines.push(`| ${row.permitRef} | ${row.street} | ${row.sourceGeometry} `
      + `| ${row.directionInput} ← ${row.directionMapped || '—'} `
      + `| ${row.exportState} | ${schema} | ${row.schemaErrorCount === null ? '—' : row.schemaErrorCount} `
      + `| ${row.failedFields.join('، ') || '—'} | ${row.publishable ? 'نعم' : 'لا'} |`);
  });
  lines.push('');
  return lines.join('\n');
}

main();
