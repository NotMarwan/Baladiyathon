'use strict';
/**
 * أثر — وسوم الاتجاه والسرعة للشرايين.
 * ---------------------------------------------------------------------------
 * `fetch-roads.js` نزّل الشرايين قبل أن يكون التوجيه على الشبكة الحقيقية
 * مطروحاً، فأخذ ما تحتاجه الخريطة: التصنيف والاسم وعدد المسارات. والتوجيه
 * يحتاج وسمين آخرين — `oneway` و`maxspeed` — وبدون الأول تخرج مساراتٌ تعبر
 * شارعاً باتجاه واحد عكس اتجاهه، وهو خطأ لا يُكتشف إلا على الأرض.
 *
 * ولا يُعاد التنزيل بالهندسة. الهندسة الحالية مبنيّ عليها إسنادُ التصاريح إلى
 * الطرق (`snap-works-to-roads.js`) والمحفظةُ المنشورة؛ وتنزيلٌ جديد قد يعيد
 * أشكالاً تغيّرت في OSM بعدها فينفصل الإسناد بلا سبب ظاهر. فيُطلب هنا `out
 * tags;` وحده: معرّفات ووسوم بلا إحداثية واحدة، وتُدمج بالمعرّف.
 *
 *     node scripts/enrich-arterial-tags.js
 *     node scripts/enrich-arterial-tags.js --dry   # يطبع الفرق ولا يكتب
 *
 * بيانات © مساهمو OpenStreetMap — رخصة ODbL.
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');

/** نفس نطاق `fetch-roads.js` الواسع — الشرايين مرسومة عليه. */
const WIDE = { south: 24.545, west: 46.530, north: 24.880, east: 46.855 };

const ARTERIAL = '^(motorway|trunk|primary|secondary|motorway_link|trunk_link'
  + '|primary_link|secondary_link|tertiary|tertiary_link)$';

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const QUERY = `[out:json][timeout:180];
(way["highway"~"${ARTERIAL}"](${WIDE.south},${WIDE.west},${WIDE.north},${WIDE.east}););
out tags;`;

async function ask() {
  let last = 'لا مرايا';
  for (const endpoint of MIRRORS) {
    process.stdout.write(`محاولة ${endpoint} … `);
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'athar-roads-builder',
        },
        body: new URLSearchParams({ data: QUERY }).toString(),
      });
    } catch (err) {
      console.log(`تخطي — ${err.message}`);
      last = err.message;
      continue;
    }
    if (response.ok) { console.log('نجحت'); return response.json(); }
    console.log(`تخطي — HTTP ${response.status}`);
    last = `HTTP ${response.status}`;
  }
  throw new Error(`كل المرايا فشلت — ${last}`);
}

function toMaxspeed(raw) {
  if (!raw) return null;
  const mph = /mph/i.test(raw);
  const value = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(mph ? value * 1.609 : value);
}

function toOneway(tags) {
  const raw = tags.oneway;
  if (raw === 'yes' || raw === '1' || raw === 'true') return 1;
  if (raw === '-1' || raw === 'reverse') return -1;
  if (raw === 'no') return 0;
  // قاعدة OSM المعلنة: الدوّار اتجاهٌ واحد ولو لم يُوسم.
  if (tags.junction === 'roundabout' || tags.junction === 'circular') return 1;
  return 0;
}

async function main() {
  const dry = process.argv.includes('--dry');
  const file = path.join(DATA, 'riyadh-roads.geojson');
  const collection = JSON.parse(fs.readFileSync(file, 'utf8'));

  const body = await ask();
  const tagsById = new Map();
  for (const element of body.elements || []) {
    if (element.type !== 'way') continue;
    tagsById.set(`w${element.id}`, element.tags || {});
  }
  console.log(`${tagsById.size} طريقاً في الردّ · ${collection.features.length} في الملف`);

  let oneway = 0;
  let speeds = 0;
  let unmatched = 0;
  for (const feature of collection.features) {
    const tags = tagsById.get(feature.properties.osmId);
    if (!tags) { unmatched += 1; continue; }
    const direction = toOneway(tags);
    if (direction) { feature.properties.oneway = direction; oneway += 1; }
    const maxspeed = toMaxspeed(tags.maxspeed);
    if (maxspeed) { feature.properties.maxspeed = maxspeed; speeds += 1; }
  }

  console.log(`${oneway} مقطعاً باتجاه واحد · ${speeds} بسرعة معلنة · `
    + `${unmatched} بلا مقابل في الردّ`);

  if (dry) { console.log('تجربة — لم يُكتب شيء.'); return; }
  const text = JSON.stringify(collection);
  fs.writeFileSync(file, `${text}\n`);
  console.log(`كُتب ${(text.length / 1048576).toFixed(2)} م.ب — أعد بناء الرسم.`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
