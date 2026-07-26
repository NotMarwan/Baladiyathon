'use strict';
/**
 * تثبيت لقطة تقاطعات الهيئة الملكية لمدينة الرياض داخل المنتج.
 * ---------------------------------------------------------------------------
 * **لماذا تُثبَّت لقطة بدل استعلام الواجهة.**
 *
 * الواجهة المفتوحة للهيئة الملكية تعمل بلا مفتاح، وهذا مكسب حقيقي. لكن ثلاثة
 * أسباب تمنع أن يعتمد المنتج عليها حيّةً — وكلها تعلَّمها هذا المستودع من
 * التغذية المرجعية الأجنبية قبل شهر:
 *   · المنتج يعمل بلا شبكة. سطحٌ يعتمد طلباً حياً يسقط في القاعة.
 *   · مجموعة قد تُحدَّث أو يتغيّر ترقيم حقولها، فتُصبح نتيجة الأمس غير قابلة
 *     لإعادة الإنتاج.
 *   · البصمة تجعل الادّعاء قابلاً للمراجعة: من شكّ حسب SHA-256 وقارن.
 *
 * **وما لا تُثبته هذه اللقطة — وهذا أهمّ ما يُكتب عنها.**
 *
 * المجموعة تحمل **مواقع** تقاطعات وأسماء شوارعها. ولا تحمل: نوع التحكّم
 * (إشارة أو دوران أو أفضلية)، ولا توقيت الإشارة (طول الدورة أو نسبة الأخضر)،
 * ولا فصلاً منسوباً (جسر أو نفق)، ولا حجماً، ولا سرعة، ولا زمن رحلة. أي أنها
 * **لا تعاير أي معامل في أثر**، ولا تجوز قراءتها دليل أداء.
 *
 * وفيها إحدى وثلاثون سجلاً وُسم صراحةً «منتصف الكتلة» — أي أنها نقاط مرجعية
 * لا تقاطعات. من يعدّها تقاطعات يبالغ في العدّ بنحو 5٪.
 *
 * المصدر داخل المستودع: `research/evidence-intelligence/lab/official-data/`
 * — سُحب بالواجهة العامة في `fetch-match-rcrc-intersections.mjs`.
 *
 * التشغيل: node presentation/scripts/pin-rcrc-intersections.js
 *          node presentation/scripts/pin-rcrc-intersections.js --check
 *            (يتحقق من البصمة المثبَّتة بلا شبكة)
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const SOURCE = path.join(REPO, 'research', 'evidence-intelligence', 'lab',
  'official-data', 'rcrc-traffic-intersections-2025.json');
const OUT = path.join(ROOT, 'data', 'rcrc-intersections.json');

const DATASET_ID = 'traffic-intersections-by-main-street-and-cross-street-2024';

/** بصمة الحمولة بصيغتها المضغوطة — لا تتغيّر بتغيّر المسافات في الملف. */
function fingerprint(records) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(records), 'utf8').digest('hex');
}

function midBlockCount(records) {
  return records.filter(function (row) {
    return /Mid-?block/i.test(row.nameEn || '') || /منتصف الكتلة/.test(row.nameAr || '');
  }).length;
}

function build(records) {
  return {
    _provenance: {
      note: 'لقطة حقيقية غير معدَّلة من الواجهة المفتوحة للهيئة الملكية لمدينة '
        + 'الرياض. مولَّدة من `presentation/scripts/pin-rcrc-intersections.js` '
        + '— لا تُحرَّر يدوياً.',
      publisher: 'الهيئة الملكية لمدينة الرياض',
      datasetId: DATASET_ID,
      datasetPage: 'https://opendata.rcrc.gov.sa/explore/dataset/'
        + DATASET_ID + '/export/?flg=en-gb',
      api: 'https://opendata.rcrc.gov.sa/api/explore/v2.1/catalog/datasets/'
        + DATASET_ID + '/records',
      publicApiWorkedWithoutKey: true,
      datasetVersion: 'نسخة 2025 — معالجة بيانات 6 مايو 2025',
      accessedOn: '2026-07-26',
      license: 'رخصة البيانات المفتوحة السعودية — استخدام وإعادة استخدام '
        + 'وتحويل مع الإسناد.',
      sourceLedgerRefs: ['src-010'],
      fetchedBy: 'research/evidence-intelligence/lab/fetch-match-rcrc-intersections.mjs',
      recordCount: records.length,
      sha256: fingerprint(records),
      /* الحقول تُكتب في الملف لا في وثيقة بعيدة: من يقرأ اللقطة بعد سنة يرى
         ما فيها وما ليس فيها في المكان نفسه. */
      fieldsProvided: ['رمز التقاطع', 'اسم التقاطع', 'الشارع الرئيسي',
        'الشارع المتقاطع', 'نقطة جغرافية', 'تعليقات التحديث'],
      fieldsAbsent: ['نوع التحكّم (إشارة/دوران/أفضلية)', 'طول الدورة',
        'نسبة الأخضر إلى الدورة', 'الفصل المنسوب (جسر أو نفق)', 'عدد المداخل',
        'حجم مروري', 'سرعة', 'زمن رحلة', 'توقيت منطقة عمل'],
      midBlockLabelledRecords: midBlockCount(records),
      isPerformanceEvidence: false,
      calibratesAnyParameter: false,
      decision: 'استخدام لتصميم مواقع القياس والتحقق الهندسي ومؤشر سياق معلَن. '
        + 'لا معايرة ولا دليل أداء.',
    },
    intersections: records,
  };
}

function main() {
  const check = process.argv.indexOf('--check') !== -1;

  if (check) {
    if (!fs.existsSync(OUT)) {
      throw new Error('اللقطة المثبَّتة غير موجودة: ' + OUT);
    }
    const pinned = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const actual = fingerprint(pinned.intersections);
    const declared = pinned._provenance.sha256;
    if (actual !== declared) {
      throw new Error('بصمة اللقطة لا تطابق حمولتها.\n  المعلَنة: ' + declared
        + '\n  المحسوبة: ' + actual);
    }
    if (pinned.intersections.length !== pinned._provenance.recordCount) {
      throw new Error('عدد السجلات لا يطابق المعلَن في بيان المنشأ.');
    }
    console.log('✅ ' + pinned.intersections.length + ' تقاطعاً · البصمة مطابقة · بلا شبكة');
    console.log('   ' + declared);
    return;
  }

  if (!fs.existsSync(SOURCE)) {
    throw new Error('نسخة المخبر غير موجودة: ' + SOURCE);
  }
  const records = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('نسخة المخبر فارغة أو ليست مصفوفة.');
  }
  const missingGeometry = records.filter(function (row) {
    return !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude);
  });
  if (missingGeometry.length) {
    throw new Error(missingGeometry.length + ' سجلاً بلا إحداثيات — تُستبعد في '
      + 'المخبر لا هنا.');
  }

  const payload = build(records);
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(records.length + ' تقاطعاً مثبَّتاً');
  console.log('  منها موسومة «منتصف الكتلة»: ' + payload._provenance.midBlockLabelledRecords);
  console.log('  SHA-256: ' + payload._provenance.sha256);
  console.log('\n' + OUT);
}

main();
