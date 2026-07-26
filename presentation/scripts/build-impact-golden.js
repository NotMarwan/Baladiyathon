'use strict';
/**
 * يبني الملف المرجعي لقيم الأثر — WP-H2.
 *
 * الغرض: تجميد ما يحسبه `score()` اليوم على المحفظة كاملة، قبل أي مسّ
 * بالمحرك. `optimize()` سيتغيّر في B1؛ `score()` يجب ألّا تتغيّر معه. هذا
 * الملف هو الفرق بين «أصلحنا المحسّن» و«أصلحنا المحسّن وكسرنا الحساب صامتين».
 *
 * لا يُعاد توليده إلا بقرار مكتوب: تغيّر القيم المرجعية يعني أن الأرقام
 * المنشورة تغيّرت، وهو حدث يستحق تبريراً لا تحديثاً تلقائياً.
 *
 * التشغيل: node presentation/scripts/build-impact-golden.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'data', 'city-portfolio.geojson.js'));
const Engine = require(path.join(ROOT, 'masar-engine.js'));

const features = global.window.MASAR_CITY_PORTFOLIO.features;
const DEFAULTS = Engine.DEFAULTS;

const entries = [];
features.forEach((feature) => {
  const p = feature.properties;
  if (!p.aadt || !p.lanes) return;
  const input = {
    aadt: p.aadt,
    lanes: p.lanes,
    lanesClosed: p.lanesClosed,
    capacityPerLane: DEFAULTS.capacityPerLane,
    freeFlowMin: p.freeFlowMin || DEFAULTS.freeFlowMin,
    startHour: new Date(p.start).getUTCHours(),
    durationHours: p.durationHours,
  };
  const result = Engine.score(input);
  entries.push({
    id: p.id,
    permitRef: p.permitRef,
    input,
    delayVehHours: result.delayVehHours,
    score: result.score,
    level: result.level,
  });
});

const golden = {
  note: 'مرجع مجمَّد لقيم score(). لا يُعاد توليده إلا بقرار مكتوب — انظر رأس '
    + 'scripts/build-impact-golden.js.',
  generatedBy: 'scripts/build-impact-golden.js',
  portfolio: 'data/city-portfolio.geojson.js',
  tolerancePct: 1,
  count: entries.length,
  entries,
};

const out = path.join(ROOT, 'tests', 'fixtures', 'impact-golden.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(golden, null, 1) + '\n', 'utf8');
console.log(`كُتب ${entries.length} مدخلاً إلى tests/fixtures/impact-golden.json`);
