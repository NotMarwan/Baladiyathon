'use strict';
/**
 * يحصد معالم الرياض البارزة — منشآت ومتاجر وجهات حكومية — من نتائج بحث خرائط
 * Google، ويحتفظ بما بلغ عدد تقييماته الحدّ (٥٠٠ افتراضاً).
 * ---------------------------------------------------------------------------
 * لماذا عدد التقييمات لا التصنيف وحده:
 * الخريطة قبل هذا الملف تعرض الطرق والمباني والاستعمال — نسيجاً بلا وجهات. وحين
 * يقرأ المحكّم مساراً بديلاً لا يعرف إن كان يمرّ بمركز تجاري يجذب عشرين ألف
 * زيارة أم بمستودع مغلق. عدد التقييمات أقرب وكيل عمومي متاح لجاذبية المكان:
 * مولٌ بـ٣٧ ألف تقييم يولّد حركةً لا يولّدها مستوصفٌ بـ٦٠٠. الحدّ عند ٥٠٠ يقصي
 * الذيل الطويل — عشرات الآلاف من المحلات الصغيرة — ويُبقي ما يُقرأ على خريطة
 * مدينة فعلاً.
 *
 * التصنيف المصدري لهذه الأرقام: **مُتحقَّق خارجياً** (سِجلّ Google العلني وقت
 * الحصاد). ليست قياساً مرورياً ولا تدخل معادلة الأثر — `masar-engine.js` يبقى
 * مصدر الحساب الوحيد. هذه طبقة سياق ووجهات لا مُدخل نموذج.
 *
 * الطريقة: شبكة بلاطات فوق نفس نطاق شبكة الطرق × قائمة استعلامات عربية، وكل
 * استعلام يُصفَّح ما دامت الصفحة تعيد جديداً فوق الحدّ. النتائج تُدمج بمعرّف
 * المكان فيسقط تكرار البلاطات المتجاورة.
 *
 * يُشغَّل مرة؛ الناتج يُلتزم في المستودع:
 *   node presentation/scripts/fetch-gmaps-poi.js
 *   node presentation/scripts/fetch-gmaps-poi.js --min=1000 --dry
 *
 * تنبيه: شروط خدمة Google تمنع الحصاد الآلي. البديل المطابق للشروط هو
 * Places API (الحقل `userRatingCount`) بمفتاح مدفوع، أو OpenStreetMap عبر
 * `fetch-poi-osm.js` — وهو المسار الاحتياطي إن سقط هذا. راجع سجل المصادر.
 */
const fs = require('fs');
const path = require('path');

/** نفس نطاق scripts/fetch-roads.js — المعالم يجب أن تقع فوق شبكة موجودة. */
const BBOX = { south: 24.545, west: 46.530, north: 24.880, east: 46.855 };

const MIN_REVIEWS = numArg('--min', 500);
const GRID = numArg('--grid', 4);
const MAX_PAGES = numArg('--pages', 4);
const CONCURRENCY = numArg('--jobs', 3);
const DRY = process.argv.indexOf('--dry') !== -1;

const OUT_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(OUT_DIR, 'poi-harvest-cache.json');

/**
 * قالب `pb` مأخوذ من جلسة متصفح حقيقية.
 * ---------------------------------------------------------------------------
 * لا تُعِد تركيبه يدوياً: عدّادات `!12m57` و`!24m107` تصف طول ما بعدها، وأي
 * خلل في العدّ يجعل الخادم يردّ صفحة فارغة بصمت (~٥ ك.ب بلا نتائج) بدل خطأ.
 * ثلاثة مواضع فقط تُستبدَل: الاستعلام (base64) والمركز والإزاحة.
 */
const PB_TEMPLATE = '!1z2YXYs9iq2LTZgdmJ!4m8!1m3!1d57990.1876952928!2d46.6753!3d24.7136!3m2!1i1024!2i768!4f13.1!7i20!10b1!12m57!1m5!18b1!30b1!31m1!1b1!34e1!2m4!5m1!6e2!20e3!39b1!6m30!32i1!49b1!63m0!66b1!85b1!114b1!149b1!206b1!209b1!212b1!216b1!222b1!223b1!232b1!234b1!235b1!246b1!253b1!260b1!266b1!270b1!273b1!277b1!280b1!281b1!286b1!291m0!293b1!302i300!303i100!10b1!12b1!13b1!14b1!16b1!17m1!3e1!20m3!5e2!6b1!14b1!46m1!1b0!96b1!99b1!19m4!2m3!1i360!2i120!4i8!20m57!2m2!1i203!2i100!3m2!2i4!5b1!6m6!1m2!1i86!2i86!1m2!1i408!2i240!7m33!1m3!1e1!2b0!3e3!1m3!1e2!2b1!3e2!1m3!1e2!2b0!3e3!1m3!1e8!2b0!3e3!1m3!1e10!2b0!3e3!1m3!1e10!2b1!3e2!1m3!1e10!2b0!3e4!1m3!1e9!2b1!3e2!2b1!9b0!15m8!1m7!1m2!1m1!1e2!2m2!1i195!2i195!3i20!24m107!1m25!13m9!2b1!3b1!4b1!6i1!8b1!9b1!14b1!20b1!25b1!18m14!3b1!4b1!5b1!6b1!13b1!14b1!17b1!21b1!22b1!32b1!33m1!1b1!34b1!36e2!10m1!8e3!11m1!3e1!17b1!20m2!1e3!1e6!24b1!25b1!26b1!27b1!29b1!30m1!2b1!36b1!37b1!39m3!2m2!2i1!3i1!43b1!52b1!54m1!1b1!55b1!56m1!1b1!61m2!1m1!1e1!65m5!3m4!1m3!1m2!1i224!2i298!72m22!1m8!2b1!5b1!7b1!12m4!1b1!2b1!4m1!1e1!4b1!8m10!1m6!4m1!1e1!4m1!1e3!4m1!1e4!3sother_user_google_review_posts__and__hotel_and_vr_partner_review_posts!6m1!1e1!9b1!89b1!90m2!1m1!1e2!98m3!1b1!2b1!3b1!103b1!113b1!114m3!1b1!2m1!1b1!117b1!122m1!1b1!126b1!127b1!128m1!1b0!26m4!2m3!1i80!2i92!4i8!30m28!1m6!1m2!1i0!2i0!2m2!1i122!2i768!1m6!1m2!1i494!2i0!2m2!1i1024!2i768!1m6!1m2!1i0!2i0!2m2!1i1024!2i20!1m6!1m2!1i0!2i748!2m2!1i1024!2i768!34m19!2b1!3b1!4b1!6b1!8m6!1b1!3b1!4b1!5b1!6b1!7b1!9b1!12b1!14b1!20b1!23b1!25b1!26b1!31b1!37m1!1e81!42b1!49m10!3b1!6m2!1b1!2b1!7m2!1e3!2b1!8b1!9b1!10e2!50m3!2e2!3m1!3b1!61b1!67m5!7b1!10b1!14b1!15m1!1b0!69i787!77b1';

/**
 * الاستعلامات مجموعةً مجموعة — والمجموعة هي ما يُلوَّن على الخريطة.
 * ---------------------------------------------------------------------------
 * `kind` ليس تصنيف Google بل تصنيفنا: Google يعيد عشرات المسمّيات («مستشفى
 * خاصة»، «مستشفى جامعي»، «المستشفى الحكومي») ولو لوّنّا كلاً منها لصار الدليل
 * أطول من الخريطة. الاستعلام يعرف مجموعته سلفاً، وتصنيف Google يُحفظ نصاً
 * للعرض في البطاقة.
 */
const QUERIES = [
  { q: 'مستشفى', kind: 'health' },
  { q: 'مركز طبي', kind: 'health' },
  { q: 'مجمع عيادات', kind: 'health' },
  { q: 'صيدلية', kind: 'health' },
  { q: 'جامعة', kind: 'education' },
  { q: 'مدرسة', kind: 'education' },
  { q: 'كلية', kind: 'education' },
  { q: 'مول', kind: 'retail' },
  { q: 'مركز تجاري', kind: 'retail' },
  { q: 'سوق', kind: 'retail' },
  { q: 'هايبر ماركت', kind: 'retail' },
  { q: 'سوبرماركت', kind: 'retail' },
  { q: 'معرض سيارات', kind: 'retail' },
  { q: 'مطعم', kind: 'food' },
  { q: 'مقهى', kind: 'food' },
  { q: 'فندق', kind: 'hospitality' },
  { q: 'قاعة أفراح', kind: 'hospitality' },
  { q: 'وزارة', kind: 'government' },
  { q: 'هيئة', kind: 'government' },
  { q: 'أمانة منطقة الرياض', kind: 'government' },
  { q: 'بلدية', kind: 'government' },
  { q: 'محكمة', kind: 'government' },
  { q: 'مركز شرطة', kind: 'government' },
  { q: 'الدفاع المدني', kind: 'government' },
  { q: 'الأحوال المدنية', kind: 'government' },
  { q: 'بنك', kind: 'finance' },
  { q: 'شركة', kind: 'business' },
  { q: 'برج', kind: 'business' },
  { q: 'محطة مترو', kind: 'transport' },
  { q: 'محطة وقود', kind: 'transport' },
  { q: 'مطار', kind: 'transport' },
  { q: 'مواقف سيارات', kind: 'transport' },
  { q: 'حديقة', kind: 'leisure' },
  { q: 'متنزه', kind: 'leisure' },
  { q: 'ملعب', kind: 'leisure' },
  { q: 'نادي رياضي', kind: 'leisure' },
  { q: 'متحف', kind: 'leisure' },
  { q: 'جامع', kind: 'worship' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Accept-Language': 'ar,en;q=0.9',
  Referer: 'https://www.google.com/maps/',
};

function numArg(flag, fallback) {
  const hit = process.argv.find((a) => a.indexOf(flag + '=') === 0);
  return hit ? Number(hit.split('=')[1]) : fallback;
}

function tiles(grid) {
  const out = [];
  const dLat = (BBOX.north - BBOX.south) / grid;
  const dLng = (BBOX.east - BBOX.west) / grid;
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      out.push({
        lat: Number((BBOX.south + dLat * (row + 0.5)).toFixed(5)),
        lng: Number((BBOX.west + dLng * (col + 0.5)).toFixed(5)),
        // مدى العرض بالأمتار تقريباً: عرض البلاطة × ١١١ كم/درجة مضروباً في هامش
        // تراكب، فلا تسقط المعالم على الحدود بين بلاطتين.
        span: Math.round(dLng * 111000 * 1.6),
      });
    }
  }
  return out;
}

function buildUrl(query, tile, offset) {
  const b64 = Buffer.from(query, 'utf8').toString('base64').replace(/=+$/, '');
  const pb = PB_TEMPLATE
    .replace(/^!1z[^!]*/, '!1z' + b64)
    .replace('!1d57990.1876952928!2d46.6753!3d24.7136',
      '!1d' + tile.span + '!2d' + tile.lng + '!3d' + tile.lat)
    .replace('!7i20!10b1', '!7i20!8i' + offset + '!10b1');
  return 'https://www.google.com/search?tbm=map&authuser=0&hl=ar&gl=sa&q=' +
    encodeURIComponent(query) + '&pb=' + pb;
}

/**
 * مواضع الحقول في مصفوفة المكان — مثبّتة بالمعاينة لا بالتخمين.
 * `[37][1]` عدد التقييمات وليس `[4][8]` كما في الأدلة القديمة؛ Google نقلها،
 * والقراءة من الموضع القديم تعيد صفراً لكل مكان فيُقصى الحصاد كله بالمرشّح.
 */
function readPlace(place) {
  if (!place || !place[11] || !place[9]) return null;
  const lat = place[9][2];
  const lng = place[9][3];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return {
    id: place[78] || place[10] || null,
    name: String(place[11]).trim(),
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    rating: (place[4] && place[4][7]) || null,
    reviews: (place[37] && place[37][1]) || 0,
    gcat: (place[13] && place[13][0]) || '',
    district: place[14] || '',
    address: place[18] || '',
  };
}

async function fetchPage(query, tile, offset) {
  const res = await fetch(buildUrl(query, tile, offset), { headers: HEADERS });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text.replace(/^\)\]\}'\n?/, ''));
  } catch (err) {
    throw new Error('رد غير قابل للتحليل (' + text.length + ' بايت)');
  }
  const rows = Array.isArray(data[64]) ? data[64] : [];
  return rows.map((row) => readPlace(row && row[1])).filter(Boolean);
}

function inBox(p) {
  return p.lat >= BBOX.south && p.lat <= BBOX.north &&
    p.lng >= BBOX.west && p.lng <= BBOX.east;
}

/** أعلى تقييماً يفوز عند التكرار — البلاطة الأقرب تعيد رقماً أطزج. */
function merge(store, place, kind) {
  if (!place.id || !inBox(place)) return;
  const prev = store.get(place.id);
  if (prev && prev.reviews >= place.reviews) return;
  store.set(place.id, Object.assign({}, place, { kind: kind }));
}

async function harvestOne(job, store, progress) {
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let batch;
    try {
      batch = await fetchPage(job.q, job.tile, offset);
    } catch (err) {
      progress.errors.push(job.q + '@' + job.tile.lat + ',' + job.tile.lng + ': ' + err.message);
      return;
    }
    if (!batch.length) return;
    batch.forEach((p) => merge(store, p, job.kind));
    // الصفحة التالية تُطلب فقط إن بقي في هذه ما يتجاوز الحدّ — الترتيب بالبروز،
    // فأول صفحة تنزل تحت الحدّ كلها تعني أن ما بعدها أدنى منها.
    if (!batch.some((p) => p.reviews >= MIN_REVIEWS)) return;
    offset += 20;
    progress.pages += 1;
    await sleep(650 + Math.floor(Math.random() * 500));
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function pool(jobs, store, progress) {
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      await harvestOne(job, store, progress);
      progress.done += 1;
      if (progress.done % 25 === 0 || progress.done === jobs.length) {
        console.log('  ' + progress.done + '/' + jobs.length +
          ' مهمة · ' + store.size + ' معلماً · ' + progress.errors.length + ' خطأ');
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

/**
 * ثلاث رتب بحسب البروز — وهي ما يقرّر متى يظهر المعلم على الخريطة.
 * الرتبة في البيانات لا في النمط: النمط يقرأ `t` مباشرةً، فيبقى منطق العتبات
 * في مكان واحد قابل للاختبار في Node.
 */
function tierOf(reviews) {
  if (reviews >= 5000) return 1;
  if (reviews >= 1500) return 2;
  return 3;
}

function toFeature(p) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: {
      id: p.id,
      name: p.name,
      kind: p.kind,
      cat: p.gcat,
      rev: p.reviews,
      rate: p.rating,
      t: tierOf(p.reviews),
      district: p.district,
    },
  };
}

async function main() {
  const jobs = [];
  tiles(GRID).forEach((tile) => {
    QUERIES.forEach((entry) => jobs.push({ q: entry.q, kind: entry.kind, tile: tile }));
  });

  console.log('حصاد معالم الرياض — ' + GRID + '×' + GRID + ' بلاطة × ' +
    QUERIES.length + ' استعلام = ' + jobs.length + ' مهمة، حدّ ' + MIN_REVIEWS + ' تقييماً');

  const store = new Map();
  const progress = { done: 0, pages: 0, errors: [] };
  const startedAt = new Date().toISOString();
  await pool(jobs, store, progress);

  const all = Array.from(store.values());
  const kept = all.filter((p) => p.reviews >= MIN_REVIEWS)
    .sort((a, b) => b.reviews - a.reviews);

  console.log('\nالحصيلة: ' + all.length + ' معلماً فريداً، ' +
    kept.length + ' منها فوق ' + MIN_REVIEWS + ' تقييماً');
  if (progress.errors.length) {
    console.log('أخطاء: ' + progress.errors.length + ' (أول ثلاثة)');
    progress.errors.slice(0, 3).forEach((e) => console.log('  ' + e));
  }

  const byKind = {};
  kept.forEach((p) => { byKind[p.kind] = (byKind[p.kind] || 0) + 1; });
  Object.keys(byKind).sort((a, b) => byKind[b] - byKind[a])
    .forEach((k) => console.log('  ' + k + ': ' + byKind[k]));

  if (DRY) { console.log('\n--dry — لم يُكتب شيء'); return; }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({
    startedAt: startedAt,
    finishedAt: new Date().toISOString(),
    grid: GRID, minReviews: MIN_REVIEWS, jobs: jobs.length,
    pages: progress.pages, unique: all.length, kept: kept.length,
    errors: progress.errors,
  }, null, 2) + '\n');

  const collection = {
    type: 'FeatureCollection',
    properties: {
      source: 'Google Maps — نتائج البحث العلنية',
      capturedAt: startedAt.slice(0, 10),
      minReviews: MIN_REVIEWS,
      evidence: 'مُتحقَّق خارجياً',
      note: 'عدد التقييمات وكيل جاذبية لا قياس مروري — لا يدخل معادلة الأثر',
    },
    features: kept.map(toFeature),
  };
  const text = JSON.stringify(collection);
  fs.writeFileSync(path.join(OUT_DIR, 'riyadh-poi.geojson'), text + '\n');
  fs.writeFileSync(path.join(OUT_DIR, 'riyadh-poi.geojson.js'),
    'window.RIYADH_POI = ' + text + ';\n');
  console.log('\n→ data/riyadh-poi.geojson (' + Math.round(text.length / 1024) + ' ك.ب)');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
