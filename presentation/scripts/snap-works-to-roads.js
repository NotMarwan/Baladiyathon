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

const ROOT = path.join(__dirname, '..');
const ROADS = path.join(ROOT, 'data', 'riyadh-roads.geojson');
const WORKS = path.join(ROOT, 'data', 'works.geojson');

// كل ميزة والشارع الذي تقع عليه، والمقطع منه كنسبة من الطول الكلي.
const ASSIGNMENTS = {
  'WORK-2026-0142': { road: 'طريق الملك فهد', from: 0.18, to: 0.52 },
  'WORK-2026-0157': { road: 'طريق العروبة', from: 0.34, to: 0.58 },
  'WORK-2026-0163': { road: 'طريق التخصصي', from: 0.42, to: 0.66 },
};

const EPSILON = 1e-6;

function key(point) {
  return point[0].toFixed(6) + ',' + point[1].toFixed(6);
}

function distance(a, b) {
  // مسافة مستوية كافية داخل مدينة واحدة — التصحيح بجيب تمام خط العرض.
  const dx = (a[0] - b[0]) * Math.cos((a[1] * Math.PI) / 180);
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function lengthOf(line) {
  let total = 0;
  for (let i = 1; i < line.length; i += 1) total += distance(line[i - 1], line[i]);
  return total;
}

/** يصل المقاطع التي تشترك في نقطة طرفية إلى أطول سلسلة ممكنة. */
function longestChain(segments) {
  const chains = segments.map((s) => s.slice());
  let merged = true;

  while (merged) {
    merged = false;
    outer:
    for (let i = 0; i < chains.length; i += 1) {
      for (let j = i + 1; j < chains.length; j += 1) {
        const a = chains[i];
        const b = chains[j];
        let joined = null;

        if (key(a[a.length - 1]) === key(b[0])) joined = a.concat(b.slice(1));
        else if (key(a[a.length - 1]) === key(b[b.length - 1])) joined = a.concat(b.slice().reverse().slice(1));
        else if (key(a[0]) === key(b[b.length - 1])) joined = b.concat(a.slice(1));
        else if (key(a[0]) === key(b[0])) joined = b.slice().reverse().concat(a.slice(1));

        if (joined) {
          chains.splice(j, 1);
          chains[i] = joined;
          merged = true;
          break outer;
        }
      }
    }
  }

  return chains.sort((x, y) => lengthOf(y) - lengthOf(x))[0] || [];
}

/** يقتطع مقطعاً من خط بين نسبتين من طوله، ويولّد نقطتي القطع بالضبط. */
function section(line, fromFraction, toFraction) {
  const total = lengthOf(line);
  const start = total * fromFraction;
  const end = total * toFraction;
  const out = [];
  let walked = 0;

  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];
    const step = distance(a, b);
    if (step < EPSILON) continue;
    const next = walked + step;

    if (next >= start && walked <= end) {
      const enter = Math.max(0, (start - walked) / step);
      const exit = Math.min(1, (end - walked) / step);
      const at = (t) => [
        Number((a[0] + (b[0] - a[0]) * t).toFixed(6)),
        Number((a[1] + (b[1] - a[1]) * t).toFixed(6)),
      ];
      const head = at(enter);
      if (!out.length || key(out[out.length - 1]) !== key(head)) out.push(head);
      const tail = at(exit);
      if (key(out[out.length - 1]) !== key(tail)) out.push(tail);
    }

    walked = next;
    if (walked > end) break;
  }

  return out;
}

function main() {
  const roads = JSON.parse(fs.readFileSync(ROADS, 'utf8'));
  const works = JSON.parse(fs.readFileSync(WORKS, 'utf8'));

  for (const feature of works.features) {
    const assignment = ASSIGNMENTS[feature.properties.id];
    if (!assignment) {
      console.log(`تخطي ${feature.properties.id} — لا شارع معيَّن`);
      continue;
    }

    const segments = roads.features
      .filter((road) => road.properties.name === assignment.road)
      .map((road) => road.geometry.coordinates);

    if (!segments.length) throw new Error(`لا مقاطع باسم ${assignment.road}`);

    const chain = longestChain(segments);
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
