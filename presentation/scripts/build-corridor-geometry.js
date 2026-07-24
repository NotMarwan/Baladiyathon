'use strict';
/**
 * يبني هندسة الممر من محور طريق الملك فهد الحقيقي.
 * ---------------------------------------------------------------------------
 * الممر كان ست نقاط مرسومة يدوياً، فيظهر كخط مستقيم يعبر الأحياء. الممر
 * الحقيقي مقطع من شارع، فيجب أن ينحني مع الإسفلت ويغطي عرض الشارع.
 *
 * الناتج ملفان في كائن واحد:
 *   ATHAR_CORRIDOR_NODES    ست نقاط [lat,lng] — حدود المقاطع الخمسة (يستهلكها
 *                           النموذج في منتصف المقطع والتصدير وموجة الصدمة)
 *   ATHAR_CORRIDOR_SEGMENTS خمسة مسارات [[lng,lat]…] تتبع المحور نقطةً نقطة
 *
 * بيانات الطرق © مساهمو OpenStreetMap — رخصة ODbL.
 */
const fs = require('fs');
const path = require('path');
const { chainForRoad, section } = require('./lib/centreline.js');

const ROOT = path.join(__dirname, '..');
const ROAD_NAME = 'طريق الملك فهد';
const SEGMENTS = 5;
// نطاق العرض: نفس امتداد الممر القديم تقريباً، من العليا شمالاً.
const FROM = 0.55;
const TO = 0.85;

function main() {
  const roads = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'riyadh-roads.geojson'), 'utf8'));
  const chain = chainForRoad(roads, ROAD_NAME);
  const corridor = section(chain, FROM, TO);
  if (corridor.length < SEGMENTS * 2) throw new Error('المحور أقصر من أن يُقسَّم');

  const segments = [];
  const nodes = [];

  for (let i = 0; i < SEGMENTS; i += 1) {
    const part = section(corridor, i / SEGMENTS, (i + 1) / SEGMENTS);
    segments.push(part);
    nodes.push([part[0][1], part[0][0]]);
    if (i === SEGMENTS - 1) {
      const last = part[part.length - 1];
      nodes.push([last[1], last[0]]);
    }
  }

  const body = 'window.ATHAR_CORRIDOR_NODES = ' + JSON.stringify(nodes) + ';\n'
    + 'window.ATHAR_CORRIDOR_SEGMENTS = ' + JSON.stringify(segments) + ';\n';

  fs.writeFileSync(path.join(ROOT, 'data', 'corridor-geometry.js'), body);
  console.log(
    `الممر: ${SEGMENTS} مقاطع، ${corridor.length} نقطة على محور ${ROAD_NAME}`
  );
}

main();
