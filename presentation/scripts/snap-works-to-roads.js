'use strict';
/**
 * يثبّت هندسة الأعمال على محور الشارع الحقيقي المأخوذ من data/riyadh-roads.geojson.
 * ---------------------------------------------------------------------------
 * العيب الذي يعالجه: خط مرسوم يدوياً من نقطتين يقطع الأحياء ويبدو خطاً عشوائياً
 * فوق الخريطة. الأعمال الحقيقية تقع على مقطع من شارع مسمّى، فالهندسة يجب أن
 * تتبع انحناء الإسفلت بالضبط كي «تبتلع» الشارع بدل أن تعبره.
 *
 * الطريقة: لكل ميزة، يُجمع أطول محور متصل يحمل اسم الشارع، ثم يُقتطع منه مقطع
 * بين نسبتين من طوله. بلا شبكة — كل شيء من الملف المحلي.
 *
 * بيانات الطرق © مساهمو OpenStreetMap — رخصة ODbL.
 */
const fs = require('fs');
const path = require('path');
const { chainForRoad, section } = require('./lib/centreline.js');

const ROOT = path.join(__dirname, '..');
const ROADS = path.join(ROOT, 'data', 'riyadh-roads.geojson');
const WORKS = path.join(ROOT, 'data', 'works.geojson');

// كل ميزة والشارع الذي تقع عليه، والمقطع منه كنسبة من الطول الكلي.
const ASSIGNMENTS = {
  'WORK-2026-0142': { road: 'طريق الملك فهد', from: 0.44, to: 0.52 },
  'WORK-2026-0157': { road: 'طريق العروبة', from: 0.78, to: 0.90 },
  'WORK-2026-0163': { road: 'طريق التخصصي', from: 0.42, to: 0.66 },
};

function main() {
  const roads = JSON.parse(fs.readFileSync(ROADS, 'utf8'));
  const works = JSON.parse(fs.readFileSync(WORKS, 'utf8'));

  for (const feature of works.features) {
    const assignment = ASSIGNMENTS[feature.properties.id];
    if (!assignment) {
      console.log(`تخطي ${feature.properties.id} — لا شارع معيَّن`);
      continue;
    }

    const chain = chainForRoad(roads, assignment.road);
    const cut = section(chain, assignment.from, assignment.to);
    if (cut.length < 2) throw new Error(`مقطع فارغ لـ ${feature.properties.id}`);

    feature.geometry.coordinates = cut;
    console.log(
      `${feature.properties.id}: ${assignment.road} — ${cut.length} نقطة على المحور`
    );
  }

  fs.writeFileSync(WORKS, `${JSON.stringify(works, null, 2)}\n`);
}

main();
