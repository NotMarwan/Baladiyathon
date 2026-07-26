'use strict';
/**
 * يحلّ هندسة التصاريح النقطية بإسنادها إلى مقاطع شبكة الطرق الحقيقية.
 *
 * المخرج `data/point-geometry-resolution.json` — قاموس من رقم التصريح إلى
 * قرار الإسناد ودليله. لا يُعدَّل ملف المحفظة: الهندسة النقطية تبقى كما وصلت،
 * والاشتقاق يُخزَّن منفصلاً كي يبقى الفرق بين **ما وصل** و**ما استنتجناه**
 * قابلاً للقراءة بعد أشهر.
 *
 * التشغيل: node presentation/scripts/resolve-point-geometry.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { snapPointToNetwork } = require('./lib/point-snap.js');

const ROOT = path.join(__dirname, '..');
const PORTFOLIO = path.join(ROOT, 'data', 'city-portfolio.geojson');
const ROADS = path.join(ROOT, 'data', 'riyadh-roads.geojson');
const NEIGHBOURHOOD = path.join(ROOT, 'data', 'riyadh-roads-neighbourhood.geojson');
const OUT = path.join(ROOT, 'data', 'point-geometry-resolution.json');

/** مربّع بحث حول النقطة — يقصّ الشبكة قبل قياس المسافات. */
const SEARCH_DEG = 0.01; // ~1.1 كم

/**
 * سبب المنع بحسب رمز الرفض.
 *
 * الفصل مقصود: «لا هندسة» و«لا امتداد» عيبان مختلفان يُصلَحان بطلبين مختلفين
 * من الجهة. جمعهما تحت «نقص الهندسة» يجعل الجهة ترسل إحداثيات أدقّ فيبقى
 * التصريح ممنوعاً لأن الناقص كان طول العمل لا موضعه.
 */
const BLOCK_REASON = {
  'no-match': 'غير قابل للنشر المعياري بسبب نقص الهندسة — النقطة لا تُسنَد إلى '
    + 'محور مسمّى ضمن حدود الدقة',
  'segment-too-long': 'غير قابل للنشر المعياري بسبب نقص امتداد العمل — النقطة '
    + 'أُسنِدت إلى الطريق الصحيح، لكن التصريح لا يصرّح بطول موقع العمل، ومقطع '
    + 'الشبكة أطول من أن ينوب عنه',
  'segment-too-short': 'غير قابل للنشر المعياري بسبب نقص الهندسة — مقطع الشبكة '
    + 'المطابق أقصر من أن يصف موقع عمل',
};

function loadNetwork(file, label) {
  if (!fs.existsSync(file)) return [];
  const collection = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = [];
  for (const feature of collection.features) {
    if (!feature.geometry || feature.geometry.type !== 'LineString') continue;
    out.push({
      name: (feature.properties && feature.properties.name) || '',
      osmId: (feature.properties && feature.properties.osmId) || '',
      source: label,
      coordinates: feature.geometry.coordinates,
    });
  }
  return out;
}

function near(point, segment) {
  for (const pair of segment.coordinates) {
    if (Math.abs(pair[0] - point[0]) <= SEARCH_DEG
      && Math.abs(pair[1] - point[1]) <= SEARCH_DEG) return true;
  }
  return false;
}

function main() {
  const portfolio = JSON.parse(fs.readFileSync(PORTFOLIO, 'utf8'));
  const network = loadNetwork(ROADS, 'riyadh-roads')
    .concat(loadNetwork(NEIGHBOURHOOD, 'riyadh-roads-neighbourhood'));
  console.log(`شبكة: ${network.length} مقطع`);

  const points = portfolio.features.filter((f) => f.geometry
    && f.geometry.type === 'Point');
  console.log(`تصاريح نقطية: ${points.length}`);

  const resolutions = {};
  let resolved = 0;

  for (const feature of points) {
    const properties = feature.properties;
    const point = feature.geometry.coordinates;
    const candidates = network.filter((segment) => near(point, segment));
    const result = snapPointToNetwork(point, properties.street, candidates);

    resolutions[properties.permitRef] = {
      permitRef: properties.permitRef,
      id: properties.id,
      street: properties.street,
      roadClass: properties.roadClass,
      sourceGeometry: 'Point',
      point,
      resolved: result.resolved,
      reason: result.reason,
      evidence: result.evidence,
      coordinates: result.coordinates,
      /* حالة النشر المعياري تُكتب هنا لا تُستنتج لاحقاً: المُصدِّر يقرأ حقلاً
         واحداً بدل أن يعيد بناء الحكم من الدليل. */
      publishable: result.resolved,
      code: result.code,
      blockReason: result.resolved ? '' : BLOCK_REASON[result.code],
    };
    if (result.resolved) resolved += 1;

    const mark = result.resolved ? '✓' : '⊘';
    console.log(`${mark} ${properties.permitRef} — ${properties.street}: ${result.reason}`);
  }

  const payload = {
    generatedFrom: 'presentation/scripts/resolve-point-geometry.js',
    portfolioFeatures: portfolio.features.length,
    pointFeatures: points.length,
    resolvedCount: resolved,
    refusedCount: points.length - resolved,
    note: 'الهندسة هنا **مشتقّة** من شبكة الطرق (OpenStreetMap, ODbL) ولم تُقَس '
      + 'ميدانياً. أعلام تحقق الموضع تبقى false في كل تصدير.',
    resolutions,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  /* شِمّ المتصفح: الصفحات تُفتح من القرص بلا خادم أحياناً، و`fetch` على
     `file://` يسقط. بقية بيانات المشروع تتبع النمط نفسه. */
  fs.writeFileSync(`${OUT.replace(/\.json$/, '')}.js`,
    `window.MASAR_POINT_GEOMETRY = ${JSON.stringify(payload)};\n`);
  console.log(`\n${resolved}/${points.length} مُسنَد — ${OUT}`);
}

main();
