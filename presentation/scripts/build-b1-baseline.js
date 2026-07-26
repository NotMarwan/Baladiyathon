'use strict';
/**
 * خط الأساس الذهبي قبل B1.
 *
 * B1 تعيد كتابة `optimize()`. وحين تتغيّر التوصيات لن يكون سؤال «هل تحسّنت؟»
 * قابلاً للإجابة بلا صورة دقيقة لما كانت عليه — فتُلتقط الصورة أولاً.
 *
 * يلتقط ستة أشياء: مدخلات الـ150 تصريحاً · نتائجها الحالية · توقيع أفضل ثلاث
 * نوافذ لكل تصريح · الإعدادات الحاكمة · بصمات الملفات الحاكمة · حالة الاختبارات.
 *
 * بصمات الملفات تحديداً تمنع سؤالاً لا جواب له لاحقاً: «هل تغيّر هذا الرقم
 * بسبب B1، أم بسبب تعديل آخر مرّ في الأثناء؟»
 *
 * التشغيل: node presentation/scripts/build-b1-baseline.js
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'city-portfolio.geojson.js'));
const Engine = require(path.join(ROOT, 'masar-engine.js'));

const features = global.window.MASAR_CITY_PORTFOLIO.features;
const D = Engine.DEFAULTS;

const permits = [];
const winners = {};
const signatures = {};

features.forEach((feature) => {
  const p = feature.properties;
  if (!p.aadt || !p.lanes) return;

  const input = {
    aadt: p.aadt,
    lanes: p.lanes,
    lanesClosed: p.lanesClosed,
    startHour: new Date(p.start).getUTCHours(),
    durationHours: p.durationHours,
    freeFlowMin: p.freeFlowMin || D.freeFlowMin,
    sensitivity: p.sensitivity,
    roadClass: p.roadClass,
  };

  const scored = Engine.score({ ...input, capacityPerLane: D.capacityPerLane });
  const optimized = Engine.optimize(input);
  const top3 = (optimized.top3 || []).map((c) => ({
    startHour: c.startHour,
    phases: c.phases,
    delayVehHours: c.delayVehHours,
    savedPct: c.savedPct,
    reasons: c.reasons,
  }));

  const signature = top3.map((c) => `${c.startHour}p${c.phases}`).join(',');
  const winner = top3.length ? `${top3[0].startHour}p${top3[0].phases}` : 'none';
  winners[winner] = (winners[winner] || 0) + 1;
  signatures[signature] = (signatures[signature] || 0) + 1;

  permits.push({
    id: p.id,
    permitRef: p.permitRef,
    input,
    baselineDelayVehHours: scored.delayVehHours,
    baselineScore: scored.score,
    baselineLevel: scored.level,
    top3,
    signature,
  });
});

function digest(relative) {
  const text = fs.readFileSync(path.join(ROOT, relative));
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

const GOVERNING = [
  'masar-engine.js',
  'masar-provenance.js',
  'masar-canonical.js',
  'masar-portfolio.js',
  'data/city-portfolio.geojson.js',
];

const baseline = {
  note: 'خط الأساس الذهبي قبل WP-B1. لا يُعاد توليده بعد بدء B1 — عندها يصير'
    + ' المرجع الذي يُقارَن به، لا نسخةً تُحدَّث.',
  capturedBefore: 'WP-B1',
  permitCount: permits.length,
  settings: {
    HOURLY_PROFILE: Engine.HOURLY_PROFILE,
    CALIBRATION: Engine.CALIBRATION,
    WORK_WINDOW_HOURS: Engine.WORK_WINDOW_HOURS,
    capacityPerLane: D.capacityPerLane,
    freeFlowMin: D.freeFlowMin,
  },
  governingDigests: GOVERNING.reduce((all, file) => {
    all[file] = digest(file);
    return all;
  }, {}),
  distribution: {
    winners,
    distinctWinners: Object.keys(winners).length,
    signatures,
    distinctSignatures: Object.keys(signatures).length,
  },
  permits,
};

const out = path.join(ROOT, 'tests', 'fixtures', 'b1-baseline.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(baseline, null, 1) + '\n', 'utf8');

console.log(`تصاريح: ${permits.length}`);
console.log(`فائزون متمايزون: ${baseline.distribution.distinctWinners}`
  + ` — ${JSON.stringify(winners)}`);
console.log(`توقيعات متمايزة: ${baseline.distribution.distinctSignatures}`);
console.log('بصمات حاكمة:');
Object.keys(baseline.governingDigests).forEach((f) =>
  console.log(`  ${f.padEnd(34)} ${baseline.governingDigests[f]}`));
console.log('كُتب إلى tests/fixtures/b1-baseline.json');
