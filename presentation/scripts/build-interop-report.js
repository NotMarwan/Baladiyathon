'use strict';
/**
 * تقرير التبادلية — محقّق أثر على إنتاج جهة رسمية أجنبية.
 * ---------------------------------------------------------------------------
 * **ما يُثبته هذا التقرير.**
 *
 * أن `WorkZoneFeed.json` الرسمي المثبَّت في هذا المستودع — بالتزامه المحدَّد
 * وعبر `ajv` — يقبل تغذيةً تشغيلية حقيقية تنشرها إدارة نقل حكومية لمناطق
 * عملها الفعلية. أي أن المحقق ليس أداةً مفصَّلة على مخرجات أثر وحدها.
 *
 * وهذا الفرق ليس لفظياً. محققٌ لم يقرأ إلا ما كتبناه قد يكون متساهلاً في
 * قيدٍ لم نمرّ به قط: نحن لا نُصدِّر `detour`، ولا `lanes`، ولا
 * `worker_presence`، ولا `related_road_events`. تغذية ولايةٍ كاملة تمرّ على
 * فروعٍ من المخطط لا يبلغها مُخرَجنا أبداً.
 *
 * **وما لا يُثبته.**
 *
 * لا رقم مروري، ولا صحة أي قيمة في أثر، ولا شيئاً عن الرياض. البنية ليست
 * القياس. درجة الدليل هنا `external-official` — ورتبتها دون كل درجة محلية،
 * ودون القياس الميداني الأجنبي.
 *
 * التشغيل: node presentation/scripts/build-interop-report.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FEED_DIR = path.join(ROOT, 'data', 'reference-feeds');
const MANIFEST = path.join(FEED_DIR, 'MANIFEST.json');
const OUT_JSON = path.join(ROOT, 'data', 'wzdx-interop-summary.json');
const OUT_JS = path.join(ROOT, 'data', 'wzdx-interop-summary.js');
const OUT_MD = path.join(ROOT, '..', 'docs', 'WZDX-INTEROP.md');

const validator = require('./lib/wzdx-validator.js');

/**
 * يُحصي الفروع التي تمرّ عليها التغذية ولا يمرّ عليها مُخرَج مسار.
 *
 * هذا هو مربط الفرس: الرقم الذي يقول كم قيداً في المخطط فُحص لأول مرة.
 */
function coverageOf(feed) {
  const seen = {
    eventTypes: new Set(),
    vehicleImpacts: new Set(),
    locationMethods: new Set(),
    directions: new Set(),
    geometryTypes: new Set(),
    optionalFields: new Set(),
  };
  /* الحقول التي يُصدِّرها أثر اليوم. ما عداها في التغذية المرجعية هو سطحٌ
     من المخطط لم يكن مفحوصاً قبل هذا التقرير. */
  const MASAR_EXPORTS = new Set(['core_details', 'start_date', 'end_date',
    'is_start_date_verified', 'is_end_date_verified',
    'is_start_position_verified', 'is_end_position_verified',
    'location_method', 'vehicle_impact']);

  for (const feature of feed.features || []) {
    const properties = feature.properties || {};
    const core = properties.core_details || {};
    if (core.event_type) seen.eventTypes.add(core.event_type);
    if (core.direction) seen.directions.add(core.direction);
    if (properties.vehicle_impact) seen.vehicleImpacts.add(properties.vehicle_impact);
    if (properties.location_method) seen.locationMethods.add(properties.location_method);
    if (feature.geometry && feature.geometry.type) {
      seen.geometryTypes.add(feature.geometry.type);
    }
    for (const key of Object.keys(properties)) {
      if (!MASAR_EXPORTS.has(key)) seen.optionalFields.add(key);
    }
  }
  const out = {};
  for (const [key, set] of Object.entries(seen)) out[key] = [...set].sort();
  return out;
}

function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error('لا تغذية مرجعية مثبَّتة.');
    console.error('  شغّل: node presentation/scripts/fetch-reference-wzdx.js');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const rows = [];

  for (const entry of manifest.feeds) {
    const raw = fs.readFileSync(path.join(FEED_DIR, entry.file), 'utf8');
    const feed = JSON.parse(raw);
    const result = validator.validateFeed(feed);
    rows.push({
      key: entry.key,
      publisher: entry.publisher,
      country: entry.country,
      source: entry.source,
      sha256: entry.sha256,
      featureCount: entry.featureCount,
      feedVersion: entry.feedVersion,
      feedUpdateDate: entry.feedUpdateDate,
      valid: result.valid,
      errorCount: result.errorCount,
      failedFields: result.fields,
      /* أول خمسة أخطاء تكفي للتشخيص. الركام الكامل يُعاد إنتاجه بتشغيل
         السكربت — ولا يُخزَّن في تقرير يُقرأ. */
      firstErrors: result.errors.slice(0, 5).map((one) => one.message),
      coverage: coverageOf(feed),
    });
  }

  const allValid = rows.every((row) => row.valid);
  const totalFeatures = rows.reduce((sum, row) => sum + row.featureCount, 0);

  const report = {
    generatedFrom: 'presentation/scripts/build-interop-report.js',
    validator: validator.meta(),
    fetchedAt: manifest.fetchedAt,
    registry: manifest.registry,
    feeds: rows.length,
    totalFeatures,
    allValid,
    evidenceGrade: 'external-official',
    /* الادّعاء يُولَّد من النتيجة لا يُكتب. جملةٌ مكتوبة تتقادم في أول تغيّر
       تغذية ولا ينبّه أحد — وهي نفس العلّة التي عالجها جرد العرض. */
    permittedClaim: allValid
      ? `مخطط أثر المثبَّت (التزام ${validator.meta().commit}) قبِل `
        + `${totalFeatures} منطقة عمل حقيقية من ${rows.length} تغذية حكومية `
        + 'أجنبية، بصفر أخطاء.'
      : `${rows.filter((r) => r.valid).length} من ${rows.length} تغذية اجتازت — `
        + 'التفصيل في التقرير.',
    forbiddenClaim: 'ممنوع قراءة هذه النتيجة قياساً مرورياً أو دليلاً على '
      + 'صحة أي رقم في مسار. التبادلية بنية لا قياس، وتغذية ولايةٍ أخرى لا '
      + 'تقول شيئاً عن الرياض.',
    rows,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  /* ملخّص خفيف للواجهة — التقرير الكامل يحمل جرد التغطية، وتحميله في صفحة
     لقراءة رقمين إسراف. */
  const summary = {
    feeds: report.feeds,
    totalFeatures: report.totalFeatures,
    allValid: report.allValid,
    errorCount: rows.reduce((sum, row) => sum + row.errorCount, 0),
    commit: report.validator.commit,
    validator: report.validator.validator,
    publishers: rows.map((row) => row.publisher),
    fetchedAt: report.fetchedAt,
    grade: report.evidenceGrade,
  };
  fs.writeFileSync(OUT_JS,
    `window.MASAR_WZDX_INTEROP = ${JSON.stringify(summary)};\n`, 'utf8');
  fs.writeFileSync(OUT_MD, markdown(report));

  console.log(report.permittedClaim);
  rows.forEach((row) => {
    console.log(`  ${row.publisher}: ${row.featureCount} منطقة · `
      + `${row.valid ? 'اجتازت' : 'سقطت (' + row.errorCount + ')'}`);
  });
  console.log(`\n${OUT_JSON}\n${OUT_MD}`);
}

function markdown(report) {
  const lines = [];
  lines.push('# تبادلية WZDx — محقّق أثر على إنتاج رسمي أجنبي');
  lines.push('');
  lines.push('> مولَّد آلياً من `presentation/scripts/build-interop-report.js`.');
  lines.push('> لا تُحرَّر الأرقام يدوياً — أعِد التشغيل.');
  lines.push('');
  lines.push('## السؤال الذي يجيبه هذا الملف');
  lines.push('');
  lines.push('محقّقٌ لم يقرأ إلا ما كتبه صاحبه لا يُثبت توافقاً مع أحد. فهل');
  lines.push('يقبل مخططنا المثبَّت **إنتاج جهة أخرى حقيقية**؟');
  lines.push('');
  lines.push('## المحقق');
  lines.push('');
  lines.push(`- المخطط: ${report.validator.schema}`);
  lines.push(`- الالتزام المثبَّت: \`${report.validator.commit}\``);
  lines.push(`- المحقق: ${report.validator.validator} · ${report.validator.formats}`);
  lines.push('');
  lines.push('## الحصيلة');
  lines.push('');
  lines.push(`**${report.permittedClaim}**`);
  lines.push('');
  lines.push(`⚠ ${report.forbiddenClaim}`);
  lines.push('');
  lines.push('| الجهة | البلد | مناطق العمل | الإصدار | النتيجة |');
  lines.push('|---|---|---:|---|---|');
  report.rows.forEach((row) => {
    lines.push(`| ${row.publisher} | ${row.country} | ${row.featureCount} `
      + `| ${row.feedVersion} | ${row.valid ? '✅ صفر أخطاء' : '❌ ' + row.errorCount} |`);
  });
  lines.push('');
  lines.push('## التثبيت');
  lines.push('');
  lines.push(`سجل التغذيات: ${report.registry}`);
  lines.push('');
  lines.push('| الجهة | المصدر | SHA-256 | تاريخ التغذية |');
  lines.push('|---|---|---|---|');
  report.rows.forEach((row) => {
    lines.push(`| ${row.publisher} | \`${row.source}\` | \`${row.sha256}\` `
      + `| ${row.feedUpdateDate || '—'} |`);
  });
  lines.push('');
  lines.push(`تاريخ السحب: ${report.fetchedAt}`);
  lines.push('');
  lines.push('التحقق بلا شبكة:');
  lines.push('');
  lines.push('```bash');
  lines.push('node presentation/scripts/fetch-reference-wzdx.js --check');
  lines.push('```');
  lines.push('');
  lines.push('## ما فُحص لأول مرة');
  lines.push('');
  lines.push('مُخرَج مسار يمرّ على جزء من المخطط: حدثٌ واحد من نوع `work-zone`،');
  lines.push('هندسة `LineString`، وتسعة حقول. التغذية المرجعية تمرّ على أكثر —');
  lines.push('وهذه هي الفروع التي لم تكن مفحوصة قبل هذا التقرير.');
  lines.push('');
  report.rows.forEach((row) => {
    lines.push(`### ${row.publisher}`);
    lines.push('');
    const c = row.coverage;
    lines.push(`- أنواع الأحداث: ${c.eventTypes.join('، ') || '—'}`);
    lines.push(`- أنواع الهندسة: ${c.geometryTypes.join('، ') || '—'}`);
    lines.push(`- الاتجاهات: ${c.directions.join('، ') || '—'}`);
    lines.push(`- أثر المركبات: ${c.vehicleImpacts.join('، ') || '—'}`);
    lines.push(`- طرق تحديد الموقع: ${c.locationMethods.join('، ') || '—'}`);
    lines.push(`- حقول لا يُصدِّرها أثر (${c.optionalFields.length}): `
      + (c.optionalFields.join('، ') || '—'));
    lines.push('');
    if (!row.valid) {
      lines.push('**أخطاء:**');
      lines.push('');
      row.firstErrors.forEach((one) => lines.push(`- ${one}`));
      lines.push('');
    }
  });
  lines.push('## درجة الدليل');
  lines.push('');
  lines.push('`external-official` — رتبتها **3** من 8 في سُلَّم أثر: فوق النظير');
  lines.push('العالمي والنموذج، ودون كل درجة محلية ودون القياس الميداني الأجنبي.');
  lines.push('');
  lines.push('تُثبت أن العقد الذي نصدّر عليه هو العقد الذي تنشر عليه جهة حقيقية.');
  lines.push('ولا تُثبت أي رقم مروري.');
  lines.push('');
  return lines.join('\n');
}

main();
