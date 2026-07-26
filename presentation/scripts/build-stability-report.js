'use strict';
/**
 * تقرير استقرار التوصية عبر المحفظة كاملة.
 *
 * يجيب سؤالاً واحداً بصراحة: **على كم تصريحاً يجوز أن يُبنى قرار؟** ويقول
 * لبقيتها ما الذي يُطلب بالضبط كي تصير قابلة للقرار.
 *
 * التشغيل: node presentation/scripts/build-stability-report.js
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Stability = require(path.join(ROOT, 'masar-stability.js'));

const PORTFOLIO = path.join(ROOT, 'data', 'city-portfolio.geojson');
const OUT_JSON = path.join(ROOT, 'data', 'stability-report.json');
const OUT_SHIM = path.join(ROOT, 'data', 'stability-summary.js');
const OUT_MD = path.join(ROOT, '..', 'docs', 'STABILITY.md');

/** يبني مُدخل المحرك من خصائص تصريح — نفس التحويل المستعمل في المكتب. */
function inputOf(properties) {
  return {
    aadt: properties.aadt,
    lanes: properties.lanes,
    lanesClosed: properties.lanesClosed,
    startHour: new Date(properties.start).getUTCHours(),
    durationHours: properties.durationHours,
    capacityPerLane: Engine.DEFAULTS.capacityPerLane,
    freeFlowMin: Engine.DEFAULTS.freeFlowMin,
    sensitivity: properties.sensitivity || 'normal',
  };
}

function main() {
  const portfolio = JSON.parse(fs.readFileSync(PORTFOLIO, 'utf8'));

  const rows = [];
  const dominance = {};
  const counts = { stable: 0, conditional: 0, fragile: 0, insufficient: 0 };

  portfolio.features.forEach((feature) => {
    const properties = feature.properties;
    const verdict = Stability.classify(inputOf(properties));
    counts[verdict.state] += 1;
    verdict.flippingAssumptions.forEach((item) => {
      dominance[item.key] = (dominance[item.key] || 0) + 1;
    });
    rows.push({
      permitRef: properties.permitRef,
      street: properties.street,
      roadClass: properties.roadClass,
      state: verdict.state,
      label: verdict.label,
      decidable: verdict.decidable,
      reason: verdict.reason,
      abstention: verdict.abstention,
      dominant: verdict.dominant ? verdict.dominant.key : null,
      magnitude: verdict.magnitude,
      flipping: verdict.flippingAssumptions.map((item) => item.key),
    });
  });

  const total = rows.length;
  const decidable = counts.stable + counts.conditional;

  /* ترتيب البيانات المطلوبة بأثرها لا بأهميتها المتخيَّلة: الافتراض الذي
     يقلب أكثر التوصيات هو أول ما يُطلب، وإن كان أصعب مناﻻً. */
  const asks = Object.keys(dominance)
    .sort((a, b) => dominance[b] - dominance[a])
    .map((key) => ({
      assumption: key,
      flipsRecommendations: dominance[key],
      flipsShare: Math.round((dominance[key] / total) * 100),
      dataNeeded: Stability.dataNeededFor(key),
    }));

  const report = {
    generatedFrom: 'presentation/scripts/build-stability-report.js',
    total,
    counts,
    decidable,
    abstained: total - decidable,
    abstainedShare: Math.round(((total - decidable) / total) * 100),
    thresholds: Stability.THRESHOLDS,
    abstentionMessage: Stability.ABSTENTION,
    dataAsks: asks,
    honesty: 'التصنيف يقيس **ترتيب البدائل** لا حجم الأثر. حجم الأثر يتأرجح '
      + 'أكثر من مئتي بالمئة في كل حالة تقريباً، ولذلك يُعرض مدىً لا رقماً '
      + 'حتى حين يكون الترتيب مستقراً.',
    rows,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);

  const summary = {
    total, counts, decidable,
    abstained: total - decidable,
    abstainedShare: report.abstainedShare,
    topAsk: asks[0] || null,
  };
  fs.writeFileSync(OUT_SHIM,
    `window.MASAR_STABILITY = ${JSON.stringify(summary)};\n`);
  fs.writeFileSync(path.join(ROOT, 'data', 'stability-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(OUT_MD, markdown(report));

  console.log(`${total} تصريحاً — ${decidable} قابل للقرار · `
    + `${total - decidable} امتناع (${report.abstainedShare}٪)`);
  Object.keys(counts).forEach((key) => console.log(`  ${key}: ${counts[key]}`));
  console.log('\nأول ما يُطلب:');
  asks.slice(0, 3).forEach((ask) => {
    console.log(`  ${ask.assumption} — يقلب ${ask.flipsRecommendations} توصية`);
  });
  console.log(`\n${OUT_JSON}\n${OUT_MD}`);
}

function markdown(report) {
  const lines = [];
  lines.push('# استقرار التوصية — تقرير المحفظة');
  lines.push('');
  lines.push('> مولَّد آلياً من `presentation/scripts/build-stability-report.js`.');
  lines.push('');
  lines.push('## الحصيلة');
  lines.push('');
  lines.push(`| الحالة | العدد | النسبة |`);
  lines.push('|---|---|---|');
  Object.keys(report.counts).forEach((key) => {
    const value = report.counts[key];
    lines.push(`| ${key} | ${value} | ${Math.round((value / report.total) * 100)}٪ |`);
  });
  lines.push('');
  lines.push(`**${report.decidable} من ${report.total} توصية يجوز أن يُبنى عليها قرار. `
    + `و${report.abstained} تمتنع (${report.abstainedShare}٪).**`);
  lines.push('');
  lines.push('الامتناع نتيجة مقبولة لا عطل. ورسالته:');
  lines.push('');
  lines.push(`> ${report.abstentionMessage}`);
  lines.push('');
  lines.push('## ما الذي يُطلب، مرتَّباً بأثره');
  lines.push('');
  lines.push('| الافتراض | يقلب توصيات | النسبة | البيانات التي تضيّقه |');
  lines.push('|---|---|---|---|');
  report.dataAsks.forEach((ask) => {
    lines.push(`| ${ask.assumption} | ${ask.flipsRecommendations} | ${ask.flipsShare}٪ `
      + `| ${ask.dataNeeded} |`);
  });
  lines.push('');
  lines.push('## حدٌّ يخصّ حجم الأثر');
  lines.push('');
  lines.push(report.honesty);
  lines.push('');
  return lines.join('\n');
}

main();
