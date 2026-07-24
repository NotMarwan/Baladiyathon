# استبدال خريطة أثر بخريطة الأعمال الجديدة — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** استبدال `athar-glmap.js` و `athar-ownedmap.js` بوحدة خريطة واحدة `athar-worksmap.js` تحمل لغة خريطة one.network البصرية (ثلاثية casing/line/symbol، شرطات، تجميع، لوحة طبقات) مع الحفاظ الحرفي على عقد الـ API الذي يعتمد عليه `athar-prototype.html`، وبقاء الخريطة تعمل بلا أي طلب شبكة خارجي.

**Architecture:** وحدة UMD واحدة بنفس نمط `athar-engine.js`، تبني style JSON يدوياً فوق مصادر GeoJSON محلية (`riyadh-roads.geojson` + `riyadh-base.geojson`)، وتضيف طبقات الأعمال من `works.geojson` عبر مصنع الثلاثية. الخطوط والأيقونات وإضافة RTL كلها مستضافة محلياً تحت `vendor/`. الدوال البانية نقية وتُختبر في Node بلا متصفح، تماماً كـ `glmap-test.js` اليوم.

**Tech Stack:** MapLibre GL JS (المستضاف محلياً في `vendor/maplibre-gl.js`) · UMD · Node `assert` · خادم `server.js` الحالي بلا أدوات بناء

---

## الوضع الحالي — ما تم التحقق منه فعلياً

فُحص الكود قبل كتابة الخطة. هذه ليست افتراضات:

| الحقيقة | الدليل |
|---|---|
| الخريطة الحالية وحدتان | `athar-glmap.js` (MapLibre، 17KB) و `athar-ownedmap.js` (Leaflet Canvas، 15KB) |
| النموذج يحمّل الاثنتين | `athar-prototype.html:441-445` |
| GL هو المسار الأساسي، Leaflet احتياطي | `athar-prototype.html:698-701, 741-746` |
| الخريطة **بلا اتصال خارجي** — شرط مختبَر | `tests/glmap-test.js`: `assert.ok(!/https?:\/\//.test(raw), 'style must be fully offline')` |
| لا glyphs ولا sprite اليوم | نفس الاختبار: `no glyph server — labels are DOM` |
| أسماء الطرق عناصر DOM | `collectLabelAnchors` في `athar-glmap.js` |
| شبكة الطرق محلية | `data/riyadh-roads.geojson` — 1035 مقطعاً، bbox `46.6355,24.5855 → 46.7360,24.7590` |
| خصائص الطريق | `{osmId, highway, name, lanes, aadt}` |
| بيانات الأعمال موجودة | `data/works.geojson` — 3 ميزات LineString، خصائص `{id, road, status, impactLevel, closureCountThisYear, from, to}` |
| للأعمال نقطة API | `server.js` → `handleApiWorks` يخدم `data/works.geojson` |
| لا أداة بناء ولا package.json | الاختبارات تُشغَّل `node tests/<name>-test.js` |

### عقد الـ API — الجزء الحرج

`athar-prototype.html` يستدعي **١٤ دالة** عبر `GL.api` بالإضافة إلى `GL.map` الخام. أي وحدة بديلة تكسر واحدة منها تكسر النموذج:

```
onReady(cb)                        setCorridorColor(idx, color)
setCorridor(coordPairs)            setDigSite(lngLat, popupHtml)
onCorridorClick(cb)                setAlternatives(featureCollection)
setCorridorState(idx, state)       sweepUnlock(idx, done)
setAllCorridorStates(states)       setPhase(phase)
setCorridorColors(colors)          updateRoad(osmId, props)
onRoadClick(cb)                    getData()
```

ومواضع استخدام `GL.map` الخام (لا تمر عبر api): `athar-prototype.html:772-804` (مصدر `deco` وطبقاته وبوب-أب)، `857` (Marker)، `1581, 1889, 1899`.

**هذا يحكم التصميم:** الوحدة الجديدة تُصدِّر `init(container, roadsGeoJSON, options)` وتُعيد `{ map, api }` بنفس الأسماء بالضبط. أي شيء آخر يعني تعديل النموذج في ٢٠ موضعاً.

---

## Global Constraints

- **صفر طلبات شبكة خارجية وقت التشغيل.** أي `http://` أو `https://` داخل style JSON يكسر الاختبار الموجود ويكسر العرض إن سقط الإنترنت في الهاكاثون.
- UMD بنفس نمط `athar-engine.js` — يعمل في Node (`module.exports`) وفي المتصفح (`root.AtharWorksMap`).
- لا أداة بناء، لا `package.json`، لا npm وقت التشغيل. الاعتماديات تُنسخ إلى `presentation/vendor/`.
- الدوال البانية (`buildStyle`, `buildTriple`, `buildWorksLayers`, `normalizeWorks`, `buildDateFilter`) **نقية** — لا تلمس DOM ولا `maplibregl`، فتُختبر في Node.
- كل ملف ≤ 400 سطر. `athar-worksmap.js` يتجاوزها ⇒ يُقسم كما في جدول الملفات أدناه.
- تعليق الرأس بالعربية بنفس أسلوب الوحدات الحالية (مبرر التصميم + إسناد ODbL).
- إسناد OpenStreetMap ODbL يبقى ظاهراً داخل الخريطة.
- شارة «بيانات توضيحية للعرض» تبقى — الصدق شرط تحكيم.
- الألوان من `WORKS_COLORS` فقط، لا قيمة لونية مكتوبة داخل منطق الطبقات.
- رسائل الالتزام: Conventional Commits.

---

## بنية الملفات

```
Baladiyathon/presentation/
├── athar-worksmap.js          ← جديد. init() + عقد api الكامل (≤ 400 سطر)
├── athar-worksmap-style.js    ← جديد. buildStyle() للخريطة الأساسية الفاتحة (نقي)
├── athar-worksmap-layers.js   ← جديد. buildTriple/buildWorksLayers/الفلاتر/التجميع (نقي)
├── athar-worksmap-data.js     ← جديد. normalizeWorks() محوّل works.geojson (نقي)
├── athar-map.css              ← تعديل. تنسيق لوحة الطبقات والبوب-أب
├── athar-prototype.html       ← تعديل. سطور 441-445 و 696-746 و 772-804
├── data/
│   ├── riyadh-roads.geojson   ← موجود، بلا تغيير
│   ├── riyadh-base.geojson    ← جديد. مياه + مساحات خضراء + أسماء أحياء
│   └── works.geojson          ← تعديل. توسعة الخصائص للمخطط القانوني
├── vendor/
│   ├── maplibre-gl.js         ← موجود، بلا تغيير
│   ├── mapbox-gl-rtl-text.js  ← جديد. تشكيل العربية
│   ├── glyphs/                ← جديد. Noto Sans، النطاقات المطلوبة فقط
│   └── sprite/                ← جديد. sprite.json/png (+@2x)
├── icons/                     ← جديد. مصادر SVG العشرة
├── scripts/
│   ├── build-sprite.js        ← جديد. يبني vendor/sprite من icons/
│   ├── fetch-glyphs.js        ← جديد. يجلب النطاقات مرة واحدة
│   └── fetch-base-layers.js   ← جديد. Overpass → data/riyadh-base.geojson
└── tests/
    ├── worksmap-style-test.js ← جديد
    ├── worksmap-layers-test.js← جديد
    ├── worksmap-data-test.js  ← جديد
    ├── worksmap-api-test.js   ← جديد. عقد api الكامل عبر stub لـ maplibregl
    ├── glmap-test.js          ← يُحذف مع الوحدة
    └── ownedmap-test.js       ← يُحذف مع الوحدة
```

**منطق التقسيم:** ثلاثة ملفات نقية + ملف واحد يلمس `maplibregl`. هذا يجعل ٨٠٪ من المنطق قابلاً للاختبار في Node بلا متصفح، وهو نفس ما يفعله `glmap-test.js` اليوم.

---

## قرار: الخريطة الأساسية محلية، لا PMTiles

المشروع اليوم يرسم الطرق من GeoJSON محلي ويمنع أي URL خارجي — باختبار صريح.

خريطة `onenetwork-clone` تجلب الخريطة الأساسية من Protomaps CDN (ملف كوكبي 137GB عبر HTTP Range). نقلها كما هي يعني:

1. كسر شرط «بلا اتصال» المختبَر.
2. إضافة دعم HTTP Range إلى `server.js` (غير موجود اليوم).
3. اعتماد العرض في الهاكاثون على الإنترنت.

**القرار:** تُنقل **اللغة البصرية** لا مصدر البلاطات. الخريطة الأساسية تُبنى من:

- `riyadh-roads.geojson` الموجود (1035 مقطعاً بتصنيف `highway`) → تدرّج الطرق بحواف
- `riyadh-base.geojson` جديد (مياه + مساحات خضراء + أسماء أحياء) → عمق بصري

هذا يعطي نفس المظهر داخل نطاق العرض، بلا خادم بلاطات وبلا Range وبلا إنترنت.

**مسار التوسع** (خارج نطاق هذه الخطة): استخراج PMTiles للرياض + دعم Range في `server.js` عند الحاجة لتغطية وطنية.

---

## قرار: لوحة فاتحة رسمية

واجهة النموذج اليوم داكنة (`#102535`)، لكن **الواجهة كلها ستتحول إلى الأبيض** لتقرأ كمنتج حكومي رسمي.

**القرار:** الخريطة تبقى فاتحة كما هي في النسخة العاملة — أرض `#f3f2ef`، طرق بيضاء بحواف رمادية، شرايين رئيسية كريمية، تسميات رمادية داكنة. لا تحويل إلى الداكن.

ألوان الأعمال (كهرماني/أحمر/أزرق/أخضر) تبقى كما هي — مضبوطة أصلاً على أرضية فاتحة.

لوحة التحكم بيضاء بحدود رمادية خفيفة، لا زجاج داكن.

---

## Task 1: تجهيز الأصول المحلية (خطوط، أيقونات، إضافة RTL)

**Files:**
- Create: `Baladiyathon/presentation/scripts/fetch-glyphs.js`
- Create: `Baladiyathon/presentation/scripts/build-sprite.js`
- Create: `Baladiyathon/presentation/icons/*.svg` (١٠ ملفات)
- Create: `Baladiyathon/presentation/vendor/mapbox-gl-rtl-text.js`
- Modify: `Baladiyathon/presentation/server.js` (أنواع MIME لـ `.pbf`)
- Test: `Baladiyathon/presentation/tests/worksmap-assets-test.js`

**Interfaces:**
- Consumes: لا شيء
- Produces: `vendor/glyphs/{fontstack}/{range}.pbf` · `vendor/sprite/sprite.json` + `sprite.png` (+`@2x`) · `vendor/mapbox-gl-rtl-text.js`

- [ ] **Step 1: كتابة جالب الخطوط**

`scripts/fetch-glyphs.js` — يُشغَّل مرة واحدة، والنتيجة تُلتزم في المستودع:

```js
'use strict';
/**
 * يجلب نطاقات خط Noto Sans المطلوبة للعربية والأرقام مرة واحدة.
 * الهدف: صفر طلبات شبكة وقت التشغيل — النطاقات تُلتزم داخل vendor/glyphs.
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://protomaps.github.io/basemaps-assets/fonts';
const FONTSTACK = 'Noto Sans Regular';
// لاتيني وأرقام · عربي · أشكال العربية التقديمية (تنتجها إضافة RTL)
const RANGES = ['0-255', '1536-1791', '64256-64511', '64512-64767', '65024-65279'];

async function main() {
  const outDir = path.join(__dirname, '..', 'vendor', 'glyphs', FONTSTACK);
  fs.mkdirSync(outDir, { recursive: true });

  for (const range of RANGES) {
    const url = `${BASE}/${encodeURIComponent(FONTSTACK)}/${range}.pbf`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${range}: HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(path.join(outDir, `${range}.pbf`), buffer);
    console.log(`glyphs: ${range}.pbf (${buffer.length} bytes)`);
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
```

- [ ] **Step 2: تشغيل الجالب**

Run: `node scripts/fetch-glyphs.js`
Expected: خمسة أسطر `glyphs: <range>.pbf (<n> bytes)` وإنشاء `vendor/glyphs/Noto Sans Regular/`

- [ ] **Step 3: نسخ إضافة RTL**

```bash
curl -sL https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.4.0/dist/mapbox-gl-rtl-text.js -o vendor/mapbox-gl-rtl-text.js
```

Expected: ملف > 100KB في `vendor/`

- [ ] **Step 4: كتابة أيقونة SVG واحدة كنموذج**

`icons/roadworks.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
  <circle cx="13" cy="13" r="10.2" fill="#ffffff" stroke="#f0a020" stroke-width="2.2"/>
  <path d="M13 7.6 L17.4 16.2 L8.6 16.2 Z" fill="#f0a020"/>
  <rect x="8.2" y="17" width="9.6" height="1.6" rx="0.8" fill="#f0a020"/>
</svg>
```

- [ ] **Step 5: كتابة الأيقونات التسع الباقية**

نفس القالب — دائرة `r=10.2` بتعبئة بيضاء وحلقة ملونة ورمز بنفس اللون:

| الملف | لون الحلقة | الرمز الداخلي |
|---|---|---|
| `works-emergency.svg` | `#e03131` | مستطيل رأسي `x=11.9 y=6.9 w=2.2 h=8.4` + دائرة `cy=18 r=1.4` |
| `works-development.svg` | `#f0a020` | مستطيلان: `x=7.4 y=12.6 w=4.2 h=6.2` و `x=12.8 y=8.4 w=5.4 h=10.4` |
| `works-end.svg` | `#2f9e44` | مسار صح `M8.2 13.3 L11.5 16.6 L17.9 9.6` عرض 2.4 |
| `closure.svg` | تعبئة `#c92a2a` وحلقة بيضاء | مستطيل أبيض `x=6.8 y=11.7 w=12.4 h=2.6 rx=1.3` |
| `incident.svg` | `#f76707` | مثلث `M13 7.2 L18.6 17.2 L7.4 17.2 Z` |
| `diversion.svg` | `#1c7ed6` | مسار منحنٍ `M8.6 18 L8.6 13.4 Q8.6 10.4 11.6 10.4 L15.6 10.4` + رأس سهم |
| `bus-stop.svg` | `#1971c2` | مستطيل `x=8.4 y=7.4 w=9.2 h=9.6 rx=1.8` + نافذة + عجلتان |
| `poi-parking.svg` | `#2f9e44` | حرف P مساري |
| `poi-information.svg` | `#1971c2` | دائرة `cy=8.6 r=1.5` + مستطيل `x=11.8 y=11.1 w=2.4 h=7.4` |

- [ ] **Step 6: كتابة باني الـ sprite**

`scripts/build-sprite.js` — بلا اعتماديات أصلية، يستخدم `sharp` إن توفر وإلا يفشل بوضوح:

```js
'use strict';
/**
 * يبني atlas الأيقونات (PNG + JSON) بصيغة MapLibre من icons/*.svg.
 * يُشغَّل مرة عند تغيير الأيقونات؛ الناتج يُلتزم داخل vendor/sprite.
 */
const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.error('sharp غير مثبت. شغّل: npm install --no-save sharp');
  process.exit(1);
}

const ICON_DIR = path.join(__dirname, '..', 'icons');
const OUT_DIR = path.join(__dirname, '..', 'vendor', 'sprite');
const ICON_SIZE = 26;
const PADDING = 2;

async function sheet(ratio, suffix) {
  const files = fs.readdirSync(ICON_DIR).filter((f) => f.endsWith('.svg')).sort();
  const size = ICON_SIZE * ratio;
  const stride = size + PADDING * ratio;

  const icons = [];
  for (const file of files) {
    const svg = fs.readFileSync(path.join(ICON_DIR, file));
    const buffer = await sharp(svg, { density: 72 * ratio * 4 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    icons.push({ name: path.basename(file, '.svg'), buffer });
  }

  const png = await sharp({
    create: {
      width: stride * icons.length,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(icons.map((icon, i) => ({ input: icon.buffer, left: i * stride, top: 0 })))
    .png()
    .toBuffer();

  const index = {};
  icons.forEach((icon, i) => {
    index[icon.name] = {
      x: i * stride, y: 0, width: size, height: size, pixelRatio: ratio, sdf: false,
    };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `sprite${suffix}.png`), png);
  fs.writeFileSync(path.join(OUT_DIR, `sprite${suffix}.json`), JSON.stringify(index, null, 2));
  console.log(`sprite${suffix}: ${icons.length} أيقونات`);
}

(async () => { await sheet(1, ''); await sheet(2, '@2x'); })();
```

- [ ] **Step 7: بناء الـ sprite**

Run: `npm install --no-save sharp && node scripts/build-sprite.js`
Expected: `sprite: 10 أيقونات` ثم `sprite@2x: 10 أيقونات`

- [ ] **Step 8: إضافة نوع MIME للخطوط في الخادم**

في `server.js` داخل `CONTENT_TYPES` أضف بعد سطر `.geojson`:

```js
  '.pbf': 'application/x-protobuf',
```

- [ ] **Step 9: كتابة اختبار الأصول**

`tests/worksmap-assets-test.js`:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const REQUIRED_ICONS = [
  'roadworks', 'works-emergency', 'works-development', 'works-end', 'closure',
  'incident', 'diversion', 'bus-stop', 'poi-parking', 'poi-information',
];

ok('sprite: يحوي كل أيقونة يشير إليها سجل الطبقات', () => {
  const sprite = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'vendor', 'sprite', 'sprite.json'), 'utf8')
  );
  for (const icon of REQUIRED_ICONS) {
    assert.ok(Object.keys(sprite).includes(icon), `أيقونة ناقصة: ${icon}`);
  }
});

ok('sprite: لا تتداخل الأيقونات داخل الـ atlas', () => {
  const sprite = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'vendor', 'sprite', 'sprite.json'), 'utf8')
  );
  const boxes = Object.values(sprite).sort((a, b) => a.x - b.x);
  for (let i = 1; i < boxes.length; i += 1) {
    assert.ok(boxes[i].x >= boxes[i - 1].x + boxes[i - 1].width, 'تداخل في الـ atlas');
  }
});

ok('glyphs: النطاق العربي وأشكاله التقديمية موجودة محلياً', () => {
  const dir = path.join(ROOT, 'vendor', 'glyphs', 'Noto Sans Regular');
  for (const range of ['0-255', '1536-1791', '65024-65279']) {
    assert.ok(fs.existsSync(path.join(dir, `${range}.pbf`)), `نطاق ناقص: ${range}`);
  }
});

ok('إضافة RTL محفوظة محلياً', () => {
  const file = path.join(ROOT, 'vendor', 'mapbox-gl-rtl-text.js');
  assert.ok(fs.existsSync(file), 'vendor/mapbox-gl-rtl-text.js مفقود');
  assert.ok(fs.statSync(file).size > 50000, 'الملف يبدو مبتوراً');
});

ok('الخادم يعرف نوع .pbf', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(server.includes("'.pbf'"), 'نوع MIME لـ .pbf غير مسجل');
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 10: تشغيل الاختبار**

Run: `node tests/worksmap-assets-test.js`
Expected: `5 اختبارات نجحت`

- [ ] **Step 11: Commit**

```bash
git add presentation/icons presentation/scripts presentation/vendor presentation/server.js presentation/tests/worksmap-assets-test.js
git commit -m "chore: vendor glyphs, sprite and rtl plugin for the works map"
```

---

## Task 2: طبقات الخريطة الأساسية المحلية

**Files:**
- Create: `Baladiyathon/presentation/scripts/fetch-base-layers.js`
- Create: `Baladiyathon/presentation/data/riyadh-base.geojson`
- Test: `Baladiyathon/presentation/tests/worksmap-base-test.js`

**Interfaces:**
- Consumes: لا شيء
- Produces: `data/riyadh-base.geojson` — FeatureCollection بخصائص `{kind: 'water'|'green'|'place', name?: string}`

- [ ] **Step 1: كتابة الجالب**

`scripts/fetch-base-layers.js`:

```js
'use strict';
/**
 * يجلب المياه والمساحات الخضراء وأسماء الأحياء داخل نطاق شبكة الطرق نفسها،
 * فتكتسب الخريطة عمقاً بصرياً بلا خادم بلاطات وبلا أي طلب وقت التشغيل.
 * يُشغَّل مرة؛ الناتج يُلتزم في المستودع.
 * بيانات © مساهمو OpenStreetMap — رخصة ODbL.
 */
const fs = require('fs');
const path = require('path');

// نفس نطاق data/riyadh-roads.geojson
const BBOX = { south: 24.5855, west: 46.6355, north: 24.759, east: 46.736 };
const OVERPASS = 'https://overpass-api.de/api/interpreter';

const QUERY = `[out:json][timeout:90];
(
  way["natural"="water"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["landuse"~"^(grass|forest|recreation_ground|village_green)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["leisure"~"^(park|garden|pitch)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  node["place"~"^(suburb|neighbourhood|quarter)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom;`;

function kindOf(element) {
  const tags = element.tags || {};
  if (tags.natural === 'water') return 'water';
  if (tags.place) return 'place';
  return 'green';
}

async function main() {
  const response = await fetch(OVERPASS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'athar-basemap-builder',
    },
    body: new URLSearchParams({ data: QUERY }).toString(),
  });
  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
  const body = await response.json();

  const features = [];
  for (const element of body.elements || []) {
    const kind = kindOf(element);

    if (element.type === 'node' && element.tags && element.tags.name) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [element.lon, element.lat] },
        properties: { kind: 'place', name: element.tags.name },
      });
      continue;
    }

    if (element.type === 'way' && Array.isArray(element.geometry) && element.geometry.length >= 4) {
      const ring = element.geometry.map((p) => [
        Number(p.lon.toFixed(5)),
        Number(p.lat.toFixed(5)),
      ]);
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: { kind, name: (element.tags && element.tags.name) || '' },
      });
    }
  }

  const out = { type: 'FeatureCollection', features };
  const file = path.join(__dirname, '..', 'data', 'riyadh-base.geojson');
  fs.writeFileSync(file, `${JSON.stringify(out)}\n`);
  console.log(`base layers: ${features.length} ميزة → data/riyadh-base.geojson`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
```

- [ ] **Step 2: تشغيل الجالب**

Run: `node scripts/fetch-base-layers.js`
Expected: سطر `base layers: <n> ميزة → data/riyadh-base.geojson` مع `n > 50`

- [ ] **Step 3: كتابة اختبار البيانات**

`tests/worksmap-base-test.js`:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const base = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'data', 'riyadh-base.geojson'), 'utf8'));

ok('FeatureCollection صالح وغير فارغ', () => {
  assert.strictEqual(base.type, 'FeatureCollection');
  assert.ok(base.features.length > 50, `عدد الميزات ${base.features.length} أقل من المتوقع`);
});

ok('كل ميزة تحمل kind من المجموعة المعروفة', () => {
  const allowed = new Set(['water', 'green', 'place']);
  for (const feature of base.features) {
    assert.ok(allowed.has(feature.properties.kind), `kind غير معروف: ${feature.properties.kind}`);
  }
});

ok('المضلعات مغلقة', () => {
  const polygons = base.features.filter((f) => f.geometry.type === 'Polygon');
  assert.ok(polygons.length > 0, 'لا مضلعات');
  for (const polygon of polygons) {
    const ring = polygon.geometry.coordinates[0];
    assert.deepStrictEqual(ring[0], ring[ring.length - 1], 'حلقة غير مغلقة');
  }
});

ok('نقاط الأحياء تحمل أسماء', () => {
  const places = base.features.filter((f) => f.properties.kind === 'place');
  assert.ok(places.length > 0, 'لا أسماء أحياء');
  for (const place of places) {
    assert.ok(place.properties.name.length > 0, 'اسم حي فارغ');
  }
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 4: تشغيل الاختبار**

Run: `node tests/worksmap-base-test.js`
Expected: `4 اختبارات نجحت`

- [ ] **Step 5: Commit**

```bash
git add presentation/scripts/fetch-base-layers.js presentation/data/riyadh-base.geojson presentation/tests/worksmap-base-test.js
git commit -m "feat: add local water, green and place layers for the works map"
```

---

## Task 3: باني الخريطة الأساسية الفاتحة

**Files:**
- Create: `Baladiyathon/presentation/athar-worksmap-style.js`
- Test: `Baladiyathon/presentation/tests/worksmap-style-test.js`

**Interfaces:**
- Consumes: `data/riyadh-roads.geojson` و `data/riyadh-base.geojson` (تُمرَّر ككائنات)
- Produces:
  ```
  AtharWorksMapStyle.BASE_COLORS   // كائن ألوان الخريطة الأساسية
  AtharWorksMapStyle.roadWidth(scale)      → تعبير عرض حسب التقريب والتصنيف
  AtharWorksMapStyle.buildStyle(roads, base, options) → style JSON
  ```
  `options = { glyphsUrl: string, spriteUrl: string }`

- [ ] **Step 1: كتابة الاختبار الفاشل**

`tests/worksmap-style-test.js`:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Style = require(path.join(__dirname, '..', 'athar-worksmap-style.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const roads = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'riyadh-roads.geojson'), 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'riyadh-base.geojson'), 'utf8'));

const OPTIONS = { glyphsUrl: 'vendor/glyphs/{fontstack}/{range}.pbf', spriteUrl: 'vendor/sprite/sprite' };

ok('style: هيكل صالح بإصدار 8', () => {
  const style = Style.buildStyle(roads, base, OPTIONS);
  assert.strictEqual(style.version, 8);
});

ok('style: بلا أي URL خارجي — العرض يعمل بلا إنترنت', () => {
  const style = Style.buildStyle(roads, base, OPTIONS);
  const raw = JSON.stringify(style);
  assert.ok(!/https?:\/\//.test(raw), 'وُجد رابط خارجي داخل الـ style');
});

ok('style: الخطوط والـ sprite مسارات نسبية محلية', () => {
  const style = Style.buildStyle(roads, base, OPTIONS);
  assert.strictEqual(style.glyphs, 'vendor/glyphs/{fontstack}/{range}.pbf');
  assert.strictEqual(style.sprite, 'vendor/sprite/sprite');
});

ok('style: المصادر مضمّنة لا مُشار إليها بروابط', () => {
  const style = Style.buildStyle(roads, base, OPTIONS);
  assert.strictEqual(style.sources.roads.type, 'geojson');
  assert.strictEqual(style.sources.base.type, 'geojson');
  assert.ok(!('url' in style.sources.roads), 'مصدر الطرق يجب أن يكون مضمّناً');
  assert.strictEqual(style.sources.roads.data.features.length, roads.features.length);
});

ok('style: ترتيب الطبقات — خلفية ثم مساحات ثم طرق ثم تسميات', () => {
  const ids = Style.buildStyle(roads, base, OPTIONS).layers.map((l) => l.id);
  for (const id of ['bg', 'base-green', 'base-water', 'roads-casing', 'roads', 'road-labels', 'place-labels']) {
    assert.ok(ids.includes(id), `طبقة ناقصة: ${id}`);
  }
  assert.ok(ids.indexOf('roads-casing') < ids.indexOf('roads'), 'الحافة يجب أن تسبق الخط');
  assert.ok(ids.indexOf('roads') < ids.indexOf('road-labels'), 'التسميات فوق الطرق');
});

ok('style: التسميات رمزية وتقرأ الاسم العربي', () => {
  const style = Style.buildStyle(roads, base, OPTIONS);
  const labels = style.layers.find((l) => l.id === 'road-labels');
  assert.strictEqual(labels.type, 'symbol');
  assert.deepStrictEqual(labels.layout['text-field'], ['get', 'name']);
  assert.strictEqual(labels.layout['symbol-placement'], 'line');
});

ok('style: عرض الطريق يكبر مع التقريب ويتدرج مع التصنيف', () => {
  const width = Style.roadWidth(1);
  assert.strictEqual(width[0], 'interpolate');
  const raw = JSON.stringify(width);
  assert.ok(raw.includes('motorway'), 'لا تدرّج حسب التصنيف');
});

ok('style: الحافة أعرض من الخط عند كل توقف', () => {
  const line = JSON.stringify(Style.roadWidth(1));
  const casing = JSON.stringify(Style.roadWidth(1.35));
  assert.notStrictEqual(line, casing, 'الحافة والخط بنفس العرض');
});

ok('style: أرضية فاتحة — الخريطة تقرأ كمنتج حكومي رسمي', () => {
  assert.strictEqual(Style.BASE_COLORS.stage, '#f3f2ef');
  assert.strictEqual(Style.BASE_COLORS.road, '#ffffff');
});

ok('style: تباين التسمية كافٍ على أرضية فاتحة', () => {
  // نص رمادي داكن مع هالة بيضاء — مقروء فوق الطرق وفوق المساحات الخضراء
  assert.strictEqual(Style.BASE_COLORS.labelHalo, '#ffffff');
  assert.ok(Style.BASE_COLORS.label.toLowerCase() < '#999999', 'لون التسمية فاتح أكثر من اللازم');
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `node tests/worksmap-style-test.js`
Expected: FAIL — `Cannot find module '.../athar-worksmap-style.js'`

- [ ] **Step 3: كتابة الوحدة**

`athar-worksmap-style.js`:

```js
/**
 * أثر — الخريطة الأساسية الفاتحة (بلا بلاط، بلا خوادم خارجية)
 * ---------------------------------------------------------------------------
 * 1) style JSON مكتوب يدوياً — نملك كل لون وعرض عند كل مستوى تكبير.
 * 2) أرضية فاتحة هادئة — الخريطة تقرأ كمستند حكومي رسمي لا كلوحة عرض.
 * 3) تدرّج الطرق بالعرض لا بالصخب: شرياني كريمي ← رئيسي أبيض ← فرعي أرفع.
 * 4) حافة رمادية تحت كل طريق — العمق من الطبقتين لا من الظل.
 * 5) الخطوط والأيقونات محلية تحت vendor/ — صفر طلبات وقت التشغيل.
 * 6) أسماء الطرق طبقة symbol حقيقية، فتشكيل العربية من إضافة RTL.
 * 7) المياه والمساحات الخضراء من data/riyadh-base.geojson.
 * 8) الدالة نقية تماماً — تُختبر في Node بلا متصفح.
 *
 * بيانات الطرق والمعالم © مساهمو OpenStreetMap — رخصة ODbL.
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharWorksMapStyle = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BASE_COLORS = {
    stage: '#f3f2ef',
    water: '#c3dcf0',
    green: '#dde9d2',
    road: '#ffffff',
    roadMajor: '#fdf6e3',
    casing: '#e2e0db',
    label: '#5b5b60',
    labelHalo: '#ffffff',
    placeLabel: '#3b3b40',
  };

  var MAJOR = ['motorway', 'motorway_link', 'trunk', 'trunk_link'];
  var PRIMARY = ['primary', 'primary_link', 'secondary', 'secondary_link'];

  /** عرض الطريق: يكبر مع التقريب ويتدرج مع التصنيف. scale يوسّع الحافة. */
  function roadWidth(scale) {
    function byClass(major, primary, minor) {
      return [
        'match', ['get', 'highway'],
        MAJOR, major * scale,
        PRIMARY, primary * scale,
        minor * scale,
      ];
    }
    return [
      'interpolate', ['exponential', 1.6], ['zoom'],
      10, byClass(1.6, 1, 0.5),
      13, byClass(4.5, 2.6, 1.2),
      15, byClass(11, 7, 3.4),
      18, byClass(30, 20, 11),
    ];
  }

  function buildStyle(roads, base, options) {
    var opts = options || {};
    return {
      version: 8,
      glyphs: opts.glyphsUrl,
      sprite: opts.spriteUrl,
      sources: {
        roads: { type: 'geojson', data: roads },
        base: { type: 'geojson', data: base },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': BASE_COLORS.stage } },
        {
          id: 'base-green', type: 'fill', source: 'base',
          filter: ['==', ['get', 'kind'], 'green'],
          paint: { 'fill-color': BASE_COLORS.green },
        },
        {
          id: 'base-water', type: 'fill', source: 'base',
          filter: ['==', ['get', 'kind'], 'water'],
          paint: { 'fill-color': BASE_COLORS.water },
        },
        {
          id: 'roads-casing', type: 'line', source: 'roads',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': BASE_COLORS.casing, 'line-width': roadWidth(1.35) },
        },
        {
          id: 'roads', type: 'line', source: 'roads',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': [
              'match', ['get', 'highway'],
              MAJOR, BASE_COLORS.roadMajor,
              PRIMARY, BASE_COLORS.roadMajor,
              BASE_COLORS.road,
            ],
            'line-width': roadWidth(1),
          },
        },
        {
          id: 'road-labels', type: 'symbol', source: 'roads', minzoom: 13,
          filter: ['all', ['has', 'name'], ['!=', ['get', 'name'], '']],
          layout: {
            'symbol-placement': 'line',
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 11,
            'text-max-angle': 30,
          },
          paint: {
            'text-color': BASE_COLORS.label,
            'text-halo-color': BASE_COLORS.labelHalo,
            'text-halo-width': 1.4,
          },
        },
        {
          id: 'place-labels', type: 'symbol', source: 'base',
          filter: ['==', ['get', 'kind'], 'place'],
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 14],
          },
          paint: {
            'text-color': BASE_COLORS.placeLabel,
            'text-halo-color': BASE_COLORS.labelHalo,
            'text-halo-width': 1.6,
          },
        },
      ],
    };
  }

  return { BASE_COLORS: BASE_COLORS, roadWidth: roadWidth, buildStyle: buildStyle };
});
```

- [ ] **Step 4: تشغيل الاختبار للتأكد من نجاحه**

Run: `node tests/worksmap-style-test.js`
Expected: `9 اختبارات نجحت`

- [ ] **Step 5: Commit**

```bash
git add presentation/athar-worksmap-style.js presentation/tests/worksmap-style-test.js
git commit -m "feat: add offline dark basemap style builder"
```

---

## Task 4: مصنع طبقات الأعمال

**Files:**
- Create: `Baladiyathon/presentation/athar-worksmap-layers.js`
- Test: `Baladiyathon/presentation/tests/worksmap-layers-test.js`

**Interfaces:**
- Consumes: لا شيء
- Produces:
  ```
  AtharWorksMapLayers.WORKS_COLORS
  AtharWorksMapLayers.LINE_WIDTH / CASING_WIDTH        // تعبيرات عرض
  AtharWorksMapLayers.dashByZoom(pattern)              → تعبير step
  AtharWorksMapLayers.LAYER_GROUPS                     // 5 مجموعات
  AtharWorksMapLayers.buildTriple(config)              → [casing, line, symbol]
  AtharWorksMapLayers.buildWorksLayers(binding)        → كل الطبقات
  AtharWorksMapLayers.buildClusterLayers(source)       → [circle, count]
  AtharWorksMapLayers.CLUSTER_OPTIONS
  AtharWorksMapLayers.baseFilters()                    → { layerId: filter }
  AtharWorksMapLayers.buildDateFilter(range)           → تعبير أو null
  AtharWorksMapLayers.composeFilter(base, extra)       → تعبير
  ```
  `binding = { points: string, lines: string }`

- [ ] **Step 1: كتابة الاختبار الفاشل**

`tests/worksmap-layers-test.js`:

```js
'use strict';
const assert = require('assert');
const path = require('path');
const Layers = require(path.join(__dirname, '..', 'athar-worksmap-layers.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const BINDING = { points: 'works', lines: 'works-lines' };

ok('الثلاثية: ثلاث طبقات بأسماء one.network', () => {
  const ids = Layers.buildTriple({
    name: 'roadworks-realtime', group: 'roadworks', source: 'works',
    lineColor: '#f0a020', casingColor: '#ffffff', iconImage: 'roadworks',
  }).map((l) => l.id);
  assert.deepStrictEqual(ids, [
    'roadworks-realtime-lines-casing',
    'roadworks-realtime-lines',
    'roadworks-realtime-symbols',
  ]);
});

ok('الثلاثية: كل طبقة مقيدة بمجموعتها', () => {
  const layers = Layers.buildTriple({
    name: 'closures-restrictions-realtime', group: 'closures', source: 'works',
    lineColor: '#c92a2a', casingColor: '#ffffff', iconImage: 'closure',
  });
  for (const layer of layers) {
    assert.ok(
      JSON.stringify(layer.filter).includes('"closures"'),
      `${layer.id} بلا شرط مجموعة — سترسم كل الميزات`
    );
  }
});

ok('الثلاثية: طبقة الرموز تستبعد التجميعات', () => {
  const symbol = Layers.buildTriple({
    name: 'x', group: 'roadworks', source: 'works',
    lineColor: '#f0a020', casingColor: '#ffffff', iconImage: 'roadworks',
  })[2];
  assert.ok(JSON.stringify(symbol.filter).includes('point_count'));
});

ok('الثلاثية: الخطوط على المصدر غير المجمَّع والرموز على المجمَّع', () => {
  const layers = Layers.buildTriple({
    name: 'x', group: 'roadworks', source: 'works', lineSource: 'works-lines',
    lineColor: '#f0a020', casingColor: '#ffffff', iconImage: 'roadworks',
  });
  assert.strictEqual(layers[0].source, 'works-lines');
  assert.strictEqual(layers[1].source, 'works-lines');
  assert.strictEqual(layers[2].source, 'works');
});

ok('كل الطبقات متقطعة بحاشية بيضاء', () => {
  const layers = Layers.buildWorksLayers(BINDING).filter((l) => l.type === 'line');
  const bodies = layers.filter((l) => l.id.endsWith('-lines'));
  const casings = layers.filter((l) => l.id.endsWith('-lines-casing'));
  for (const layer of bodies) {
    assert.ok(layer.paint['line-dasharray'], `${layer.id} ليس متقطعاً`);
  }
  for (const layer of casings) {
    assert.strictEqual(
      layer.paint['line-color'], Layers.WORKS_COLORS.dashCasing,
      `${layer.id} حاشيته داكنة — ستظهر من فجوات الشرطات`
    );
  }
});

ok('نمط الشرطات يشتد عند التقريب البعيد', () => {
  const dash = Layers.dashByZoom([1.6, 2.2]);
  assert.strictEqual(dash[0], 'step', 'line-dasharray لا يقبل interpolate');
  assert.ok(JSON.stringify(dash).includes('literal'));
});

ok('معرّفات الطبقات فريدة', () => {
  const ids = Layers.buildWorksLayers(BINDING).map((l) => l.id);
  assert.strictEqual(new Set(ids).size, ids.length);
});

ok('التجميع: نفس إعدادات one.network', () => {
  assert.strictEqual(Layers.CLUSTER_OPTIONS.cluster, true);
  assert.strictEqual(Layers.CLUSTER_OPTIONS.clusterRadius, 50);
  assert.strictEqual(Layers.CLUSTER_OPTIONS.clusterMaxZoom, 14);
});

ok('التجميع: دائرة وعدّاد يقرآن الميزات المجمَّعة فقط', () => {
  const layers = Layers.buildClusterLayers('works');
  assert.deepStrictEqual(layers.map((l) => l.id), ['works-clusters', 'works-cluster-count']);
  for (const layer of layers) {
    assert.deepStrictEqual(layer.filter, ['has', 'point_count']);
  }
});

ok('فلتر التاريخ: تداخل لا احتواء', () => {
  assert.deepStrictEqual(Layers.buildDateFilter({ from: 100, to: 200 }), [
    'all',
    ['<', ['get', 'start_ts'], 200],
    ['>', ['get', 'end_ts'], 100],
  ]);
  assert.strictEqual(Layers.buildDateFilter(null), null);
});

ok('دمج الفلاتر لا يسقط شرط المجموعة', () => {
  const base = ['all', ['!', ['has', 'point_count']], ['==', ['get', 'group'], 'closures']];
  const merged = Layers.composeFilter(base, ['<', ['get', 'start_ts'], 200]);
  assert.ok(JSON.stringify(merged).includes('"closures"'));
});

ok('baseFilters يغطي كل طبقة', () => {
  const filters = Layers.baseFilters();
  for (const layer of Layers.buildWorksLayers(BINDING)) {
    if (layer.id.indexOf('cluster') !== -1) continue;
    assert.ok(filters[layer.id], `لا فلتر أساسي لـ ${layer.id}`);
  }
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `node tests/worksmap-layers-test.js`
Expected: FAIL — `Cannot find module '.../athar-worksmap-layers.js'`

- [ ] **Step 3: كتابة الوحدة**

`athar-worksmap-layers.js`:

```js
/**
 * أثر — مصنع طبقات الأعمال (نمط one.network)
 * ---------------------------------------------------------------------------
 * 1) كل نوع بيانات = ثلاثية casing/line/symbol — نفس اصطلاح one.network حرفياً.
 * 2) كل طبقة مقيدة بمجموعتها؛ بلا هذا القيد ترسم كل طبقة كل الميزات.
 * 3) الخطوط متقطعة بفجوات أوسع من الشرطة — يبقى الإسفلت مقروءاً تحتها.
 * 4) الحاشية بيضاء تحت كل خط متقطع؛ الداكنة تظهر من كل فجوة وتبدو منقّطة.
 * 5) نمط الشرطات يشتد تحت z15 — بلا ذلك يتفكك إلى نقاط متناثرة.
 * 6) عرض الخط يتدرج مع التقريب فيغطي عرض الشارع لا خيطاً فوقه.
 * 7) التجميع لنقاط فقط؛ supercluster يُسقط كل ما ليس Point.
 * 8) baseFilters يحفظ شرط المجموعة كي لا يمحوه setFilter عند الفلترة الزمنية.
 * 9) كل الدوال نقية — تُختبر في Node بلا متصفح.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharWorksMapLayers = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var WORKS_COLORS = {
    roadworks: '#f0a020',
    emergency: '#e03131',
    closure: '#c92a2a',
    incident: '#f76707',
    diversion: '#1c7ed6',
    info: '#1971c2',
    poi: '#2f9e44',
    poiCasing: '#0f3a1c',
    dashCasing: '#ffffff',
    clusterSmall: '#f0a020',
    clusterMedium: '#f76707',
    clusterLarge: '#e03131',
    clusterText: '#ffffff',
  };

  var SIZES = { iconSize: 0.8, clusterSmall: 15, clusterMedium: 20, clusterLarge: 26 };

  var LINE_WIDTH = [
    'interpolate', ['exponential', 1.5], ['zoom'],
    10, 2, 13, 4, 15, 6.5, 17, 11, 20, 26,
  ];

  var CASING_WIDTH = [
    'interpolate', ['exponential', 1.5], ['zoom'],
    10, 3.4, 13, 6.6, 15, 10, 17, 16, 20, 36,
  ];

  var DASH_PATTERN = [1.6, 2.2];
  var DASH_PATTERN_ROUTE = [2, 2];

  /** line-dasharray خاصية cross-faded: تقبل step على التقريب لا interpolate. */
  function dashByZoom(pattern) {
    return [
      'step', ['zoom'],
      ['literal', [1.5, 0.9]],
      13, ['literal', [pattern[0] * 0.9, pattern[1] * 0.7]],
      15, ['literal', pattern],
    ];
  }

  function scaleWidth(expression, factor) {
    return expression.map(function (token, index) {
      var isStopValue = index >= 4 && index % 2 === 0 && typeof token === 'number';
      return isStopValue ? Number((token * factor).toFixed(2)) : token;
    });
  }

  var LINE_ONLY = ['==', ['geometry-type'], 'LineString'];
  var NOT_CLUSTER = ['!', ['has', 'point_count']];

  function matchFilter(config) {
    var parts = [['==', ['get', 'group'], config.group]];
    if (config.subtype) parts.push(['==', ['get', 'subtype'], config.subtype]);
    if (config.excludeSubtype) parts.push(['!=', ['get', 'subtype'], config.excludeSubtype]);
    return parts;
  }

  function buildTriple(config) {
    var scale = config.widthScale || 1;
    var lineWidth = scale === 1 ? LINE_WIDTH : scaleWidth(LINE_WIDTH, scale);
    var casingWidth = scale === 1 ? CASING_WIDTH : scaleWidth(CASING_WIDTH, scale);
    var dash = dashByZoom(config.dashPattern || DASH_PATTERN);
    var match = matchFilter(config);
    var lineFilter = ['all', LINE_ONLY].concat(match);
    var symbolFilter = ['all', NOT_CLUSTER].concat(match);
    var lineSource = config.lineSource || config.source;

    var casing = {
      id: config.name + '-lines-casing', type: 'line', source: lineSource,
      filter: lineFilter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': config.casingColor,
        'line-width': casingWidth,
        'line-opacity': 0.9,
      },
    };

    var line = {
      id: config.name + '-lines', type: 'line', source: lineSource,
      filter: lineFilter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': config.lineColor,
        'line-width': lineWidth,
        'line-dasharray': dash,
      },
    };

    var symbol = {
      id: config.name + '-symbols', type: 'symbol', source: config.source,
      filter: symbolFilter,
      layout: {
        'icon-image': config.iconImage,
        'icon-size': SIZES.iconSize,
        'icon-allow-overlap': true,
        'symbol-sort-key': ['-', 10, ['to-number', ['get', 'severity'], 0]],
      },
    };

    if (config.minzoom !== undefined) {
      casing.minzoom = config.minzoom;
      line.minzoom = config.minzoom;
      symbol.minzoom = config.minzoom;
    }

    return [casing, line, symbol];
  }

  var iconByType = function (prefix, fallback) {
    return ['coalesce', ['image', ['concat', prefix, ['get', 'subtype']]], ['image', fallback]];
  };

  var LAYER_GROUPS = [
    {
      id: 'roadworks', label: 'أعمال الطرق', swatch: WORKS_COLORS.roadworks,
      configs: [{
        name: 'roadworks-realtime', group: 'roadworks',
        lineColor: WORKS_COLORS.roadworks, casingColor: WORKS_COLORS.dashCasing,
        iconImage: iconByType('works-', 'roadworks'),
      }],
    },
    {
      id: 'closures', label: 'الإغلاقات والقيود', swatch: WORKS_COLORS.closure,
      configs: [{
        name: 'closures-restrictions-realtime', group: 'closures',
        lineColor: WORKS_COLORS.closure, casingColor: WORKS_COLORS.dashCasing,
        iconImage: 'closure',
      }],
    },
    {
      id: 'incidents', label: 'الحوادث', swatch: WORKS_COLORS.incident,
      configs: [{
        name: 'incidents-realtime', group: 'incidents',
        lineColor: WORKS_COLORS.incident, casingColor: WORKS_COLORS.dashCasing,
        iconImage: 'incident',
      }],
    },
    {
      id: 'diversions', label: 'مسارات التحويل والحافلات', swatch: WORKS_COLORS.diversion,
      configs: [
        {
          name: 'diversion-routes', group: 'diversions', excludeSubtype: 'bus',
          lineColor: WORKS_COLORS.diversion, casingColor: WORKS_COLORS.dashCasing,
          iconImage: 'diversion', dashPattern: DASH_PATTERN_ROUTE, widthScale: 0.7,
        },
        {
          name: 'bus-routes', group: 'diversions', subtype: 'bus',
          lineColor: WORKS_COLORS.info, casingColor: WORKS_COLORS.dashCasing,
          iconImage: 'bus-stop', dashPattern: DASH_PATTERN_ROUTE, widthScale: 0.55, minzoom: 11,
        },
      ],
    },
    {
      id: 'pois', label: 'نقاط الاهتمام', swatch: WORKS_COLORS.poi,
      configs: [{
        name: 'events-poi', group: 'pois',
        lineColor: WORKS_COLORS.poi, casingColor: WORKS_COLORS.poiCasing,
        iconImage: iconByType('poi-', 'poi-information'), minzoom: 11,
      }],
    },
  ];

  function buildWorksLayers(binding) {
    var out = [];
    LAYER_GROUPS.forEach(function (group) {
      group.configs.forEach(function (config) {
        var bound = Object.assign({}, config, {
          source: binding.points,
          lineSource: binding.lines || binding.points,
        });
        out = out.concat(buildTriple(bound));
      });
    });
    return out;
  }

  var CLUSTER_OPTIONS = {
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 14,
    clusterMinPoints: 2,
    clusterProperties: { max_severity: ['max', ['to-number', ['get', 'severity'], 0]] },
  };

  function buildClusterLayers(source) {
    return [
      {
        id: source + '-clusters', type: 'circle', source, filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step', ['get', 'point_count'],
            WORKS_COLORS.clusterSmall, 10, WORKS_COLORS.clusterMedium, 50, WORKS_COLORS.clusterLarge,
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            SIZES.clusterSmall, 10, SIZES.clusterMedium, 50, SIZES.clusterLarge,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      },
      {
        id: source + '-cluster-count', type: 'symbol', source, filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': WORKS_COLORS.clusterText },
      },
    ];
  }

  function baseFilters() {
    var result = {};
    buildWorksLayers({ points: '__base__', lines: '__base__' }).forEach(function (layer) {
      result[layer.id] = layer.filter;
    });
    return result;
  }

  function buildDateFilter(range) {
    if (!range) return null;
    return [
      'all',
      ['<', ['get', 'start_ts'], range.to],
      ['>', ['get', 'end_ts'], range.from],
    ];
  }

  function composeFilter(base, extra) {
    if (!extra) return base;
    if (!base) return extra;
    var parts = base[0] === 'all' ? base.slice(1) : [base];
    return ['all'].concat(parts, [extra]);
  }

  return {
    WORKS_COLORS: WORKS_COLORS,
    LINE_WIDTH: LINE_WIDTH,
    CASING_WIDTH: CASING_WIDTH,
    DASH_PATTERN: DASH_PATTERN,
    dashByZoom: dashByZoom,
    LAYER_GROUPS: LAYER_GROUPS,
    buildTriple: buildTriple,
    buildWorksLayers: buildWorksLayers,
    buildClusterLayers: buildClusterLayers,
    CLUSTER_OPTIONS: CLUSTER_OPTIONS,
    baseFilters: baseFilters,
    buildDateFilter: buildDateFilter,
    composeFilter: composeFilter,
  };
});
```

- [ ] **Step 4: تشغيل الاختبار للتأكد من نجاحه**

Run: `node tests/worksmap-layers-test.js`
Expected: `12 اختبارات نجحت`

- [ ] **Step 5: Commit**

```bash
git add presentation/athar-worksmap-layers.js presentation/tests/worksmap-layers-test.js
git commit -m "feat: add works layer factory with dashed group-scoped triples"
```

---

## Task 5: تطبيع بيانات أثر إلى المخطط القانوني

**Files:**
- Create: `Baladiyathon/presentation/athar-worksmap-data.js`
- Modify: `Baladiyathon/presentation/data/works.geojson`
- Test: `Baladiyathon/presentation/tests/worksmap-data-test.js`

**Interfaces:**
- Consumes: لا شيء
- Produces:
  ```
  AtharWorksMapData.normalizeWorks(raw)  → { type:'FeatureCollection', features:[...] }
  // خصائص كل ميزة: { id, group, subtype, title, description, start_ts, end_ts, severity, promoter, road }
  AtharWorksMapData.splitByGeometry(collection) → { points, lines }
  ```

- [ ] **Step 1: كتابة الاختبار الفاشل**

`tests/worksmap-data-test.js`:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Data = require(path.join(__dirname, '..', 'athar-worksmap-data.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const raw = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[46.68, 24.71], [46.69, 24.72]] },
    properties: {
      id: 'WORK-2026-0142',
      road: 'طريق الملك فهد (مقطع العليا)',
      status: 'قيد التنفيذ',
      impactLevel: 'high',
      closureCountThisYear: 1,
      from: 'تقاطع طريق العروبة',
      to: 'تقاطع طريق التخصصي',
      start: '2026-07-22T06:00:00Z',
      end: '2026-07-30T18:00:00Z',
    },
  }],
};

ok('impactLevel=high يصبح شدة 3 ونوع طوارئ', () => {
  const props = Data.normalizeWorks(raw).features[0].properties;
  assert.strictEqual(props.severity, 3);
  assert.strictEqual(props.subtype, 'emergency');
});

ok('المجموعة الافتراضية أعمال طرق', () => {
  assert.strictEqual(Data.normalizeWorks(raw).features[0].properties.group, 'roadworks');
});

ok('التواريخ تتحول إلى epoch بالمللي ثانية', () => {
  const props = Data.normalizeWorks(raw).features[0].properties;
  assert.strictEqual(props.start_ts, Date.parse('2026-07-22T06:00:00Z'));
  assert.strictEqual(props.end_ts, Date.parse('2026-07-30T18:00:00Z'));
});

ok('العنوان يجمع الطريق والمقطع', () => {
  const props = Data.normalizeWorks(raw).features[0].properties;
  assert.ok(props.title.indexOf('طريق الملك فهد') !== -1);
  assert.ok(props.description.indexOf('تقاطع طريق العروبة') !== -1);
});

ok('الحالة «مغلق» تنقل الميزة إلى مجموعة الإغلاقات', () => {
  const closed = JSON.parse(JSON.stringify(raw));
  closed.features[0].properties.status = 'مغلق';
  assert.strictEqual(Data.normalizeWorks(closed).features[0].properties.group, 'closures');
});

ok('الهندسة تبقى كما هي', () => {
  assert.deepStrictEqual(
    Data.normalizeWorks(raw).features[0].geometry,
    raw.features[0].geometry
  );
});

ok('الميزات بلا هندسة تُسقط بلا استثناء', () => {
  const broken = { type: 'FeatureCollection', features: raw.features.concat([
    { type: 'Feature', geometry: null, properties: { id: 'X' } },
  ]) };
  assert.strictEqual(Data.normalizeWorks(broken).features.length, 1);
});

ok('مدخل تالف يعطي مجموعة فارغة لا انهياراً', () => {
  assert.deepStrictEqual(Data.normalizeWorks(null).features, []);
  assert.deepStrictEqual(Data.normalizeWorks({ features: 'nope' }).features, []);
});

ok('الفصل حسب الهندسة: النقاط والخطوط مصدران', () => {
  const mixed = { type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [46.6, 24.7] }, properties: {} },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.7, 24.8]] }, properties: {} },
  ] };
  const split = Data.splitByGeometry(mixed);
  assert.strictEqual(split.points.features.length, 1);
  assert.strictEqual(split.lines.features.length, 1);
});

ok('ملف البيانات الفعلي يمر بالتطبيع كاملاً', () => {
  const file = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data', 'works.geojson'), 'utf8'));
  const normalized = Data.normalizeWorks(file);
  assert.strictEqual(normalized.features.length, file.features.length);
  for (const feature of normalized.features) {
    assert.ok(feature.properties.start_ts > 0, `${feature.properties.id} بلا تاريخ بداية`);
    assert.ok(feature.properties.end_ts > feature.properties.start_ts, 'نهاية قبل البداية');
  }
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `node tests/worksmap-data-test.js`
Expected: FAIL — `Cannot find module '.../athar-worksmap-data.js'`

- [ ] **Step 3: كتابة المحوّل**

`athar-worksmap-data.js`:

```js
/**
 * أثر — تطبيع بيانات الأعمال إلى المخطط الذي ترسمه الطبقات
 * ---------------------------------------------------------------------------
 * 1) مخطط واحد يفصل الرسم عن مصدر البيانات — تغيير المصدر لا يمس الطبقات.
 * 2) impactLevel العربي يتحول إلى شدة رقمية تقود اللون وترتيب الرموز.
 * 3) الحالة تقرر المجموعة: مغلق ← إغلاقات، غير ذلك ← أعمال طرق.
 * 4) التواريخ إلى epoch — الفلترة الزمنية تقارن أرقاماً لا نصوصاً.
 * 5) الميزات بلا هندسة تُسقط بصمت بدل أن تُسقط الخريطة كلها.
 * 6) الفصل حسب الهندسة إجباري: التجميع يُسقط كل ما ليس Point.
 * 7) دوال نقية — تُختبر في Node.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharWorksMapData = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var IMPACT_SEVERITY = { high: 3, medium: 2, low: 1 };
  var IMPACT_SUBTYPE = { high: 'emergency', medium: 'development', low: 'default' };
  var CLOSED_STATUSES = ['مغلق', 'مغلقة', 'إغلاق كامل'];

  function text(value, fallback) {
    return typeof value === 'string' && value.length > 0 ? value : (fallback || '');
  }

  function epoch(value) {
    if (typeof value === 'number') return value;
    var parsed = typeof value === 'string' ? Date.parse(value) : NaN;
    return isNaN(parsed) ? 0 : parsed;
  }

  function groupOf(properties) {
    var status = text(properties.status);
    if (CLOSED_STATUSES.indexOf(status) !== -1) return 'closures';
    if (text(properties.group)) return text(properties.group);
    return 'roadworks';
  }

  function toCanonical(properties) {
    var impact = text(properties.impactLevel, 'low');
    var from = text(properties.from);
    var to = text(properties.to);
    var span = from && to ? from + ' ← ' + to : text(properties.description);

    return {
      id: text(properties.id, 'WORK-?'),
      group: groupOf(properties),
      subtype: text(properties.subtype, IMPACT_SUBTYPE[impact] || 'default'),
      title: text(properties.road, text(properties.title, 'أعمال طرق')),
      description: span,
      start_ts: epoch(properties.start || properties.start_ts),
      end_ts: epoch(properties.end || properties.end_ts),
      severity: IMPACT_SEVERITY[impact] || 0,
      promoter: text(properties.promoter),
      road: text(properties.road),
    };
  }

  function normalizeWorks(raw) {
    var source = raw || {};
    var input = Array.isArray(source.features) ? source.features : [];
    var features = [];

    for (var i = 0; i < input.length; i += 1) {
      var item = input[i];
      if (!item || !item.geometry) continue;
      features.push({
        type: 'Feature',
        geometry: item.geometry,
        properties: toCanonical(item.properties || {}),
      });
    }

    return { type: 'FeatureCollection', features: features };
  }

  function splitByGeometry(collection) {
    var points = { type: 'FeatureCollection', features: [] };
    var lines = { type: 'FeatureCollection', features: [] };

    (collection.features || []).forEach(function (feature) {
      var type = feature.geometry.type;
      if (type === 'Point' || type === 'MultiPoint') points.features.push(feature);
      else lines.features.push(feature);
    });

    return { points: points, lines: lines };
  }

  return { normalizeWorks: normalizeWorks, splitByGeometry: splitByGeometry };
});
```

- [ ] **Step 4: إضافة التواريخ إلى بيانات الأعمال**

`data/works.geojson` — أضف `start` و `end` لكل ميزة داخل `properties` (الاختبار يتطلبهما):

```json
"start": "2026-07-22T06:00:00Z",
"end": "2026-07-30T18:00:00Z"
```

استخدم للميزات الثلاث على الترتيب: `2026-07-22→2026-07-30` · `2026-07-10→2026-09-15` · `2026-07-24→2026-07-27`.

- [ ] **Step 5: تشغيل الاختبار للتأكد من نجاحه**

Run: `node tests/worksmap-data-test.js`
Expected: `10 اختبارات نجحت`

- [ ] **Step 6: Commit**

```bash
git add presentation/athar-worksmap-data.js presentation/data/works.geojson presentation/tests/worksmap-data-test.js
git commit -m "feat: normalize athar works data into the map schema"
```

---

## Task 6: وحدة الخريطة وعقد الـ API الكامل

هذه أخطر مهمة في الخطة: الوحدة يجب أن تُصدِّر **نفس** الأسماء الأربعة عشر وإلا انكسر النموذج.

**Files:**
- Create: `Baladiyathon/presentation/athar-worksmap.js`
- Test: `Baladiyathon/presentation/tests/worksmap-api-test.js`

**Interfaces:**
- Consumes: `AtharWorksMapStyle.buildStyle` (مهمة 3) · `AtharWorksMapLayers.*` (مهمة 4) · `AtharWorksMapData.*` (مهمة 5)
- Produces:
  ```
  AtharWorksMap.init(container, roadsGeoJSON, options) → { map, api }
  AtharWorksMap.API_METHODS  // مصفوفة أسماء العقد — يستخدمها الاختبار
  ```
  `api` يحوي بالضبط: `onReady, setCorridor, onCorridorClick, setCorridorState, setAllCorridorStates, setCorridorColors, setCorridorColor, setDigSite, setAlternatives, sweepUnlock, setPhase, updateRoad, onRoadClick, getData` — بالإضافة إلى الجديد `setWorks, setDateRange, toggleGroup`.

- [ ] **Step 1: كتابة اختبار العقد الفاشل**

`tests/worksmap-api-test.js`:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const WorksMap = require(path.join(__dirname, '..', 'athar-worksmap.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

// عقد الـ API كما يستدعيه athar-prototype.html اليوم. كسره يكسر النموذج.
const REQUIRED = [
  'onReady', 'setCorridor', 'onCorridorClick', 'setCorridorState',
  'setAllCorridorStates', 'setCorridorColors', 'setCorridorColor',
  'setDigSite', 'setAlternatives', 'sweepUnlock', 'setPhase',
  'updateRoad', 'onRoadClick', 'getData',
];

ok('العقد معلن في الوحدة', () => {
  for (const name of REQUIRED) {
    assert.ok(WorksMap.API_METHODS.indexOf(name) !== -1, `مفقود من العقد: ${name}`);
  }
});

ok('الوحدة تعمل في Node بلا maplibregl', () => {
  assert.strictEqual(typeof WorksMap.init, 'function');
});

ok('النموذج لا يستدعي دالة خارج العقد', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'athar-prototype.html'), 'utf8');
  const called = new Set();
  const pattern = /GL\.api\.([a-zA-Z]+)\(/g;
  let match;
  while ((match = pattern.exec(html)) !== null) called.add(match[1]);
  for (const name of called) {
    assert.ok(
      WorksMap.API_METHODS.indexOf(name) !== -1,
      `النموذج يستدعي GL.api.${name} وهي غير معلنة في العقد`
    );
  }
});

ok('كل دوال العقد موجودة فعلياً على الكائن المُعاد', () => {
  const api = WorksMap._buildApi(makeFakeMap(), { roads: emptyFC(), works: emptyFC() });
  for (const name of REQUIRED) {
    assert.strictEqual(typeof api[name], 'function', `${name} ليست دالة`);
  }
});

ok('setCorridor يخزن المقاطع و getData يعيدها', () => {
  const api = WorksMap._buildApi(makeFakeMap(), { roads: emptyFC(), works: emptyFC() });
  api.setCorridor([[[46.6, 24.7], [46.7, 24.8]]]);
  assert.strictEqual(api.getData().corridor.length, 1);
});

ok('setCorridorState يغيّر حالة المقطع فقط', () => {
  const api = WorksMap._buildApi(makeFakeMap(), { roads: emptyFC(), works: emptyFC() });
  api.setCorridor([[[46.6, 24.7], [46.7, 24.8]], [[46.7, 24.8], [46.8, 24.9]]]);
  api.setCorridorState(1, 'closed');
  const states = api.getData().corridor.map((s) => s.state);
  assert.strictEqual(states[1], 'closed');
  assert.notStrictEqual(states[0], 'closed');
});

ok('updateRoad يعدّل خصائص الطريق بالـ osmId', () => {
  const roads = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[46.6, 24.7], [46.7, 24.8]] },
      properties: { osmId: 'w1', highway: 'primary', name: 'طريق', lanes: null, aadt: null },
    }],
  };
  const api = WorksMap._buildApi(makeFakeMap(), { roads: roads, works: emptyFC() });
  api.updateRoad('w1', { aadt: 42000, lanes: 3 });
  assert.strictEqual(api.getData().roads.features[0].properties.aadt, 42000);
  assert.strictEqual(api.getData().roads.features[0].properties.lanes, 3);
});

ok('updateRoad على معرّف غير موجود لا يرمي استثناءً', () => {
  const api = WorksMap._buildApi(makeFakeMap(), { roads: emptyFC(), works: emptyFC() });
  api.updateRoad('لا-يوجد', { aadt: 1 });
});

ok('setDateRange يبني فلتراً يحفظ شرط المجموعة', () => {
  const map = makeFakeMap();
  const api = WorksMap._buildApi(map, { roads: emptyFC(), works: emptyFC() });
  api.setDateRange({ from: 100, to: 200 });
  const applied = map._filters['roadworks-realtime-symbols'];
  assert.ok(JSON.stringify(applied).includes('"roadworks"'), 'شرط المجموعة سقط');
  assert.ok(JSON.stringify(applied).includes('start_ts'), 'شرط التاريخ لم يُطبق');
});

ok('toggleGroup يخفي كل طبقات المجموعة', () => {
  const map = makeFakeMap();
  const api = WorksMap._buildApi(map, { roads: emptyFC(), works: emptyFC() });
  api.toggleGroup('closures', false);
  assert.strictEqual(map._visibility['closures-restrictions-realtime-symbols'], 'none');
});

// --- أدوات الاختبار: أدنى بديل لـ maplibregl.Map ---
function emptyFC() { return { type: 'FeatureCollection', features: [] }; }

function makeFakeMap() {
  const layers = {};
  ['roadworks-realtime', 'closures-restrictions-realtime', 'incidents-realtime',
   'diversion-routes', 'bus-routes', 'events-poi'].forEach((name) => {
    ['-lines-casing', '-lines', '-symbols'].forEach((suffix) => {
      layers[name + suffix] = true;
    });
  });

  return {
    _filters: {},
    _visibility: {},
    _sources: {},
    getLayer(id) { return layers[id] ? { id } : undefined; },
    setFilter(id, filter) { this._filters[id] = filter; },
    setLayoutProperty(id, prop, value) {
      if (prop === 'visibility') this._visibility[id] = value;
    },
    getSource(id) { return this._sources[id] || null; },
    addSource(id, spec) { this._sources[id] = { spec, setData(data) { spec.data = data; } }; },
    addLayer() {},
    on() {},
    once() {},
    getCanvas() { return { style: {} }; },
    isStyleLoaded() { return true; },
  };
}

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `node tests/worksmap-api-test.js`
Expected: FAIL — `Cannot find module '.../athar-worksmap.js'`

- [ ] **Step 3: كتابة الوحدة**

`athar-worksmap.js` — الهيكل الكامل:

```js
/**
 * أثر — خريطة الأعمال (لغة one.network البصرية فوق بيانات محلية)
 * ---------------------------------------------------------------------------
 * 1) بديل مباشر لـ athar-glmap.js: نفس init ونفس أربع عشرة دالة api.
 * 2) الخريطة الأساسية فاتحة من GeoJSON محلي — صفر طلبات شبكة وقت التشغيل.
 * 3) طبقات الأعمال ثلاثية casing/line/symbol متقطعة على محور الشارع.
 * 4) مصدران للأعمال: نقاط مجمَّعة وخطوط غير مجمَّعة — التجميع يُسقط الخطوط.
 * 5) طبقات الأعمال تُدرج تحت التسميات فتبقى أسماء الشوارع مقروءة فوقها.
 * 6) الطرق تبقى قابلة للنقر والتحرير — التوجيه يقرأ نفس البيانات كما قبل.
 * 7) إضافة RTL محلية تُسجَّل قبل إنشاء الخريطة وإلا ظهرت العربية منفصلة.
 * 8) الفلترة الزمنية تدمج مع الفلتر الأساسي؛ setFilter وحده يمحو شرط المجموعة.
 * 9) شارة الصدق وإسناد ODbL جزء من الخريطة لا زينة خارجها.
 *
 * بيانات الطرق والمعالم © مساهمو OpenStreetMap — رخصة ODbL.
 * UMD — _buildApi نقية وقابلة للاختبار في Node ببديل بسيط للخريطة.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./athar-worksmap-style.js'),
      require('./athar-worksmap-layers.js'),
      require('./athar-worksmap-data.js')
    );
  } else {
    root.AtharWorksMap = factory(
      root.AtharWorksMapStyle, root.AtharWorksMapLayers, root.AtharWorksMapData
    );
  }
})(typeof self !== 'undefined' ? self : this, function (Style, Layers, Data) {
  'use strict';

  var API_METHODS = [
    'onReady', 'setCorridor', 'onCorridorClick', 'setCorridorState',
    'setAllCorridorStates', 'setCorridorColors', 'setCorridorColor',
    'setDigSite', 'setAlternatives', 'sweepUnlock', 'setPhase',
    'updateRoad', 'onRoadClick', 'getData',
    'setWorks', 'setDateRange', 'toggleGroup',
  ];

  var POINT_SOURCE = 'works';
  var LINE_SOURCE = 'works-lines';
  var CORRIDOR_SOURCE = 'corridor';

  // ألوان مشبعة تُقرأ فوق أرضية فاتحة — لا ألوان نيون مصممة للداكن.
  var CORRIDOR_STATE_COLORS = {
    open: '#1c7ed6',
    closed: '#c92a2a',
    unlocked: '#2f9e44',
  };

  function featureCollection(features) {
    return { type: 'FeatureCollection', features: features || [] };
  }

  /**
   * يبني كائن الـ api فوق أي خريطة تحقق الحد الأدنى من واجهة MapLibre.
   * مفصولة عن init كي تُختبر في Node ببديل بسيط.
   */
  function buildApi(map, state) {
    var corridor = [];
    var corridorClickCb = null;
    var roadClickCb = null;
    var readyCbs = [];
    var phase = 'idle';
    var works = state.works || featureCollection([]);
    var roads = state.roads || featureCollection([]);
    var dateRange = null;
    var hiddenGroups = {};

    function corridorFC() {
      return featureCollection(corridor.map(function (segment, idx) {
        return {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: segment.coords },
          properties: {
            idx: idx,
            state: segment.state,
            color: segment.color || CORRIDOR_STATE_COLORS[segment.state] || CORRIDOR_STATE_COLORS.open,
          },
        };
      }));
    }

    function pushCorridor() {
      var source = map.getSource(CORRIDOR_SOURCE);
      if (source && source.setData) source.setData(corridorFC());
    }

    function layerIdsForGroup(groupId) {
      var ids = [];
      Layers.LAYER_GROUPS.forEach(function (group) {
        if (group.id !== groupId) return;
        group.configs.forEach(function (config) {
          ids.push(config.name + '-lines-casing');
          ids.push(config.name + '-lines');
          ids.push(config.name + '-symbols');
        });
      });
      return ids;
    }

    function allWorksLayerIds() {
      var ids = [];
      Layers.LAYER_GROUPS.forEach(function (group) {
        ids = ids.concat(layerIdsForGroup(group.id));
      });
      return ids;
    }

    function applyFilters() {
      var base = Layers.baseFilters();
      var dateFilter = Layers.buildDateFilter(dateRange);
      allWorksLayerIds().forEach(function (id) {
        if (!map.getLayer(id)) return;
        map.setFilter(id, Layers.composeFilter(base[id], dateFilter));
      });
    }

    return {
      onReady: function (cb) {
        if (typeof cb === 'function') readyCbs.push(cb);
      },

      _fireReady: function () {
        readyCbs.forEach(function (cb) { cb(); });
        readyCbs = [];
      },

      setCorridor: function (coordPairs) {
        corridor = (coordPairs || []).map(function (coords) {
          return { coords: coords, state: 'open', color: null };
        });
        pushCorridor();
      },

      onCorridorClick: function (cb) { corridorClickCb = cb; },

      _corridorClicked: function (idx) {
        if (corridorClickCb) corridorClickCb(idx);
      },

      setCorridorState: function (idx, nextState) {
        if (!corridor[idx]) return;
        corridor[idx].state = nextState;
        corridor[idx].color = null;
        pushCorridor();
      },

      setAllCorridorStates: function (states) {
        (states || []).forEach(function (nextState, idx) {
          if (corridor[idx]) {
            corridor[idx].state = nextState;
            corridor[idx].color = null;
          }
        });
        pushCorridor();
      },

      setCorridorColors: function (colors) {
        (colors || []).forEach(function (color, idx) {
          if (corridor[idx]) corridor[idx].color = color;
        });
        pushCorridor();
      },

      setCorridorColor: function (idx, color) {
        if (!corridor[idx]) return;
        corridor[idx].color = color;
        pushCorridor();
      },

      setDigSite: function (lngLat, popupHtml) {
        var source = map.getSource('dig-site');
        var data = featureCollection(lngLat ? [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: lngLat },
          properties: { popupHtml: popupHtml || '' },
        }] : []);
        if (source && source.setData) source.setData(data);
      },

      setAlternatives: function (collection) {
        var source = map.getSource('alternatives');
        if (source && source.setData) {
          source.setData(collection || featureCollection([]));
        }
      },

      sweepUnlock: function (idx, done) {
        if (corridor[idx]) {
          corridor[idx].state = 'unlocked';
          corridor[idx].color = null;
          pushCorridor();
        }
        if (typeof done === 'function') done();
      },

      setPhase: function (nextPhase) { phase = nextPhase; },

      updateRoad: function (osmId, props) {
        var features = roads.features || [];
        for (var i = 0; i < features.length; i += 1) {
          if (features[i].properties.osmId !== osmId) continue;
          Object.keys(props || {}).forEach(function (key) {
            features[i].properties[key] = props[key];
          });
          var source = map.getSource('roads');
          if (source && source.setData) source.setData(roads);
          return;
        }
      },

      onRoadClick: function (cb) { roadClickCb = cb; },

      _roadClicked: function (segment) {
        if (roadClickCb) roadClickCb(segment);
      },

      getData: function () {
        return { roads: roads, works: works, corridor: corridor, phase: phase };
      },

      setWorks: function (rawWorks) {
        works = Data.normalizeWorks(rawWorks);
        var split = Data.splitByGeometry(works);
        var pointSource = map.getSource(POINT_SOURCE);
        var lineSource = map.getSource(LINE_SOURCE);
        if (pointSource && pointSource.setData) pointSource.setData(split.points);
        if (lineSource && lineSource.setData) lineSource.setData(split.lines);
        applyFilters();
      },

      setDateRange: function (range) {
        dateRange = range || null;
        applyFilters();
      },

      toggleGroup: function (groupId, visible) {
        hiddenGroups[groupId] = !visible;
        layerIdsForGroup(groupId).forEach(function (id) {
          if (!map.getLayer(id)) return;
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        });
      },
    };
  }

  /** المعرّف الذي تُدرج قبله طبقات الأعمال — أول طبقة تسميات. */
  function firstLabelLayerId(style) {
    for (var i = 0; i < style.layers.length; i += 1) {
      if (style.layers[i].type === 'symbol') return style.layers[i].id;
    }
    return undefined;
  }

  function init(container, roadsGeoJSON, options) {
    var opts = options || {};
    var maplibre = opts.maplibregl || (typeof maplibregl !== 'undefined' ? maplibregl : null);
    if (!maplibre) throw new Error('maplibregl غير متوفر');

    if (maplibre.getRTLTextPluginStatus() === 'unavailable') {
      maplibre.setRTLTextPlugin(opts.rtlPluginUrl || 'vendor/mapbox-gl-rtl-text.js', false);
    }

    var style = Style.buildStyle(roadsGeoJSON, opts.baseGeoJSON || featureCollection([]), {
      glyphsUrl: opts.glyphsUrl || 'vendor/glyphs/{fontstack}/{range}.pbf',
      spriteUrl: opts.spriteUrl || 'vendor/sprite/sprite',
    });

    var map = new maplibre.Map({
      container: container,
      style: style,
      center: opts.center || [46.685, 24.7],
      zoom: opts.zoom || 13,
      pitch: opts.pitch || 0,
      scrollZoom: opts.scrollZoom !== false,
      attributionControl: { compact: true },
    });

    var api = buildApi(map, { roads: roadsGeoJSON, works: featureCollection([]) });
    var labelLayerId = firstLabelLayerId(style);

    map.on('load', function () {
      map.addSource(POINT_SOURCE, Object.assign(
        { type: 'geojson', data: featureCollection([]) }, Layers.CLUSTER_OPTIONS
      ));
      map.addSource(LINE_SOURCE, { type: 'geojson', data: featureCollection([]) });
      map.addSource(CORRIDOR_SOURCE, { type: 'geojson', data: featureCollection([]) });
      map.addSource('dig-site', { type: 'geojson', data: featureCollection([]) });
      map.addSource('alternatives', { type: 'geojson', data: featureCollection([]) });

      var worksLayers = Layers.buildWorksLayers({ points: POINT_SOURCE, lines: LINE_SOURCE });
      worksLayers.forEach(function (layer) {
        if (layer.type === 'line') map.addLayer(layer, labelLayerId);
      });

      map.addLayer({
        id: 'corridor-casing', type: 'line', source: CORRIDOR_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 14 },
      }, labelLayerId);
      map.addLayer({
        id: 'corridor-core', type: 'line', source: CORRIDOR_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 7 },
      }, labelLayerId);

      map.addLayer({
        id: 'alternatives-line', type: 'line', source: 'alternatives',
        paint: { 'line-color': '#2f9e44', 'line-width': 4, 'line-dasharray': [2, 2] },
      }, labelLayerId);

      worksLayers.forEach(function (layer) {
        if (layer.type !== 'line') map.addLayer(layer);
      });
      Layers.buildClusterLayers(POINT_SOURCE).forEach(function (layer) {
        map.addLayer(layer);
      });

      map.addLayer({
        id: 'dig-site-symbol', type: 'symbol', source: 'dig-site',
        layout: { 'icon-image': 'works-emergency', 'icon-size': 1, 'icon-allow-overlap': true },
      });

      map.on('click', 'corridor-core', function (event) {
        var feature = event.features && event.features[0];
        if (feature) api._corridorClicked(Number(feature.properties.idx));
      });

      map.on('click', 'roads', function (event) {
        var feature = event.features && event.features[0];
        if (feature) api._roadClicked(feature.properties);
      });

      ['corridor-core', 'roads'].forEach(function (layerId) {
        map.on('mouseenter', layerId, function () {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, function () {
          map.getCanvas().style.cursor = '';
        });
      });

      api._fireReady();
    });

    return { map: map, api: api };
  }

  return { init: init, API_METHODS: API_METHODS, _buildApi: buildApi };
});
```

- [ ] **Step 4: تشغيل الاختبار للتأكد من نجاحه**

Run: `node tests/worksmap-api-test.js`
Expected: `10 اختبارات نجحت`

- [ ] **Step 5: Commit**

```bash
git add presentation/athar-worksmap.js presentation/tests/worksmap-api-test.js
git commit -m "feat: add works map module preserving the full glmap api contract"
```

---

## Task 7: لوحة الطبقات والفترة الزمنية

**Files:**
- Modify: `Baladiyathon/presentation/athar-map.css`
- Modify: `Baladiyathon/presentation/athar-prototype.html` (حاوية اللوحة)
- Create: `Baladiyathon/presentation/athar-worksmap-panel.js`
- Test: `Baladiyathon/presentation/tests/worksmap-panel-test.js`

**Interfaces:**
- Consumes: `AtharWorksMapLayers.LAYER_GROUPS` (مهمة 4) · `api.setDateRange` و `api.toggleGroup` (مهمة 6)
- Produces: `AtharWorksMapPanel.render(groups)` → سلسلة HTML · `AtharWorksMapPanel.mount(root, api, nowMs)`

- [ ] **Step 1: كتابة الاختبار الفاشل**

`tests/worksmap-panel-test.js`:

```js
'use strict';
const assert = require('assert');
const path = require('path');
const Panel = require(path.join(__dirname, '..', 'athar-worksmap-panel.js'));
const Layers = require(path.join(__dirname, '..', 'athar-worksmap-layers.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

ok('اللوحة تعرض كل مجموعة بعنوان عربي', () => {
  const html = Panel.render(Layers.LAYER_GROUPS);
  for (const group of Layers.LAYER_GROUPS) {
    assert.ok(html.indexOf(group.label) !== -1, `عنوان ناقص: ${group.label}`);
  }
});

ok('كل مجموعة لها مربع اختيار مفعّل بمعرّفها', () => {
  const html = Panel.render(Layers.LAYER_GROUPS);
  for (const group of Layers.LAYER_GROUPS) {
    assert.ok(html.indexOf(`data-group="${group.id}"`) !== -1, `مربع ناقص: ${group.id}`);
  }
  assert.ok(html.indexOf('checked') !== -1);
});

ok('اللوحة تعرض خيارات الفترة الأربع', () => {
  const html = Panel.render(Layers.LAYER_GROUPS);
  for (const label of ['اليوم', 'هذا الأسبوع', 'هذا الشهر', 'كل التواريخ']) {
    assert.ok(html.indexOf(label) !== -1, `خيار ناقص: ${label}`);
  }
});

ok('اللوحة لا تحقن HTML من العناوين', () => {
  const html = Panel.render([{ id: 'x', label: '<img src=x onerror=alert(1)>', swatch: '#fff', configs: [] }]);
  assert.ok(html.indexOf('<img') === -1, 'تسرب HTML من العنوان');
});

ok('نطاق «اليوم» يمتد من منتصف ليل إلى منتصف ليل', () => {
  const range = Panel.toEpochRange('today', Date.UTC(2026, 6, 24, 12, 0, 0));
  assert.strictEqual(range.from, Date.UTC(2026, 6, 24));
  assert.strictEqual(range.to, Date.UTC(2026, 6, 25));
});

ok('«كل التواريخ» يعيد null فلا يُطبق فلتر زمني', () => {
  assert.strictEqual(Panel.toEpochRange('all', Date.now()), null);
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `node tests/worksmap-panel-test.js`
Expected: FAIL — `Cannot find module '.../athar-worksmap-panel.js'`

- [ ] **Step 3: كتابة الوحدة**

`athar-worksmap-panel.js`:

```js
/**
 * أثر — لوحة التحكم بالخريطة (الفترة الزمنية + إظهار الطبقات)
 * ---------------------------------------------------------------------------
 * 1) render نقية تُعيد HTML — تُختبر في Node بلا DOM.
 * 2) كل نص يمر بترميز HTML؛ العناوين بيانات لا شيفرة.
 * 3) الافتراضي «اليوم» — نفس سلوك one.network عند الفتح.
 * 4) الفترة تُحسب بتوقيت UTC فلا تتأرجح النتيجة مع منطقة المتصفح.
 *
 * UMD بنفس نمط athar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AtharWorksMapPanel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY_MS = 24 * 3600 * 1000;
  var PRESETS = [
    { value: 'today', label: 'اليوم' },
    { value: 'week', label: 'هذا الأسبوع' },
    { value: 'month', label: 'هذا الشهر' },
    { value: 'all', label: 'كل التواريخ' },
  ];
  var SPANS = { today: 1, week: 7, month: 30 };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function toEpochRange(preset, nowMs) {
    if (preset === 'all') return null;
    var now = new Date(nowMs);
    var from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return { from: from, to: from + (SPANS[preset] || 1) * DAY_MS };
  }

  function render(groups) {
    var options = PRESETS.map(function (preset) {
      return '<option value="' + preset.value + '">' + escapeHtml(preset.label) + '</option>';
    }).join('');

    var toggles = groups.map(function (group) {
      return '<label class="athar-map-toggle">' +
        '<input type="checkbox" data-group="' + escapeHtml(group.id) + '" checked />' +
        '<span class="athar-map-swatch" style="background:' + escapeHtml(group.swatch) + '"></span>' +
        '<span>' + escapeHtml(group.label) + '</span>' +
        '</label>';
    }).join('');

    return '<label class="athar-map-field"><span>الفترة</span>' +
      '<select id="athar-date-preset">' + options + '</select></label>' +
      '<fieldset class="athar-map-field"><legend>الطبقات</legend>' + toggles + '</fieldset>';
  }

  function mount(root, api, nowMs) {
    root.innerHTML = render(require_groups());

    var select = root.querySelector('#athar-date-preset');
    if (select) {
      select.addEventListener('change', function () {
        api.setDateRange(toEpochRange(select.value, nowMs));
      });
    }

    var boxes = root.querySelectorAll('input[data-group]');
    for (var i = 0; i < boxes.length; i += 1) {
      (function (box) {
        box.addEventListener('change', function () {
          api.toggleGroup(box.getAttribute('data-group'), box.checked);
        });
      })(boxes[i]);
    }

    api.setDateRange(toEpochRange('today', nowMs));
  }

  function require_groups() {
    var globalScope = typeof self !== 'undefined' ? self : this;
    return globalScope.AtharWorksMapLayers.LAYER_GROUPS;
  }

  return { render: render, mount: mount, toEpochRange: toEpochRange, PRESETS: PRESETS };
});
```

- [ ] **Step 4: إضافة حاوية اللوحة إلى النموذج**

في `athar-prototype.html` مباشرة بعد سطر `<div id="map" ...></div>` (السطر 201) أضف:

```html
    <aside id="athar-map-panel" aria-label="عناصر التحكم بالخريطة"></aside>
```

- [ ] **Step 5: إضافة تنسيق اللوحة**

في نهاية `athar-map.css`:

```css
#athar-map-panel {
  position: absolute;
  inset-inline-start: 14px;
  inset-block-start: 14px;
  z-index: 6;
  width: 240px;
  padding: 13px 15px;
  background: #ffffff;
  border: 1px solid #e2e0db;
  border-radius: 12px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.12);
  color: #1d1d1f;
  display: grid;
  gap: 11px;
}

.athar-map-field { display: grid; gap: 6px; font-size: 0.83rem; }
.athar-map-field select {
  padding: 6px 9px;
  font: inherit;
  color: inherit;
  background: #ffffff;
  border: 1px solid #e2e0db;
  border-radius: 8px;
}
.athar-map-field select:focus-visible { outline: 2px solid #1971c2; outline-offset: 1px; }
fieldset.athar-map-field { border: 0; padding: 0; }
fieldset.athar-map-field legend { font-weight: 600; margin-bottom: 5px; }
.athar-map-toggle { display: flex; align-items: center; gap: 8px; padding: 2px 0; cursor: pointer; }
.athar-map-toggle input { accent-color: #1971c2; width: 15px; height: 15px; }
.athar-map-swatch { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; }

/*
 * ملاحظة: `#map` قد يرث خلفية داكنة من تنسيق النموذج الحالي. الخريطة الآن
 * فاتحة، فالحاوية تُثبَّت على الأبيض كي لا يومض الداكن قبل أول إطار.
 */
#map { background: #f3f2ef; }

@media (max-width: 640px) {
  #athar-map-panel { inset-inline: 12px; width: auto; }
}
```

- [ ] **Step 6: تشغيل الاختبار للتأكد من نجاحه**

Run: `node tests/worksmap-panel-test.js`
Expected: `6 اختبارات نجحت`

- [ ] **Step 7: Commit**

```bash
git add presentation/athar-worksmap-panel.js presentation/athar-map.css presentation/athar-prototype.html presentation/tests/worksmap-panel-test.js
git commit -m "feat: add map control panel for date range and layer toggles"
```

---

## Task 8: التبديل داخل النموذج وحذف الخريطتين القديمتين

**Files:**
- Modify: `Baladiyathon/presentation/athar-prototype.html` (سطور 441-445 و 696-746)
- Delete: `Baladiyathon/presentation/athar-glmap.js`
- Delete: `Baladiyathon/presentation/athar-ownedmap.js`
- Delete: `Baladiyathon/presentation/vendor/leaflet.js` · `vendor/leaflet.css` · `vendor/images/`
- Delete: `Baladiyathon/presentation/tests/glmap-test.js` · `tests/ownedmap-test.js`
- Test: `Baladiyathon/presentation/tests/worksmap-wiring-test.js`

**Interfaces:**
- Consumes: `AtharWorksMap.init` (مهمة 6) · `AtharWorksMapPanel.mount` (مهمة 7)
- Produces: لا شيء لمهام لاحقة

- [ ] **Step 1: كتابة اختبار التوصيل الفاشل**

`tests/worksmap-wiring-test.js`:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'athar-prototype.html'), 'utf8');

ok('النموذج يحمّل وحدات الخريطة الجديدة', () => {
  for (const file of [
    'athar-worksmap-style.js', 'athar-worksmap-layers.js',
    'athar-worksmap-data.js', 'athar-worksmap.js', 'athar-worksmap-panel.js',
  ]) {
    assert.ok(html.indexOf(file) !== -1, `غير محمّل: ${file}`);
  }
});

ok('الخريطتان القديمتان محذوفتان من القرص ومن النموذج', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'athar-glmap.js')), 'athar-glmap.js ما زال موجوداً');
  assert.ok(!fs.existsSync(path.join(ROOT, 'athar-ownedmap.js')), 'athar-ownedmap.js ما زال موجوداً');
  assert.ok(html.indexOf('AtharGlMap') === -1, 'إشارة متبقية إلى AtharGlMap');
  assert.ok(html.indexOf('AtharOwnedMap') === -1, 'إشارة متبقية إلى AtharOwnedMap');
});

ok('Leaflet أُزيل بالكامل', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'vendor', 'leaflet.js')), 'vendor/leaflet.js باقٍ');
  assert.ok(html.indexOf('leaflet') === -1, 'إشارة متبقية إلى leaflet في النموذج');
});

ok('حاوية اللوحة موجودة', () => {
  assert.ok(html.indexOf('id="athar-map-panel"') !== -1);
});

ok('لا رابط خارجي داخل وسوم script أو link في النموذج', () => {
  const tags = html.match(/<(script|link)[^>]*>/g) || [];
  for (const tag of tags) {
    assert.ok(!/https?:\/\//.test(tag), `مورد خارجي: ${tag}`);
  }
});

ok('كل ملفات الخريطة المشار إليها موجودة فعلاً', () => {
  const refs = html.match(/(?:src|href)="([^"]+\.(?:js|css))"/g) || [];
  for (const ref of refs) {
    const file = ref.match(/"([^"]+)"/)[1];
    if (file.indexOf('://') !== -1) continue;
    assert.ok(fs.existsSync(path.join(ROOT, file)), `ملف مفقود: ${file}`);
  }
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `node tests/worksmap-wiring-test.js`
Expected: FAIL — `athar-glmap.js ما زال موجوداً`

- [ ] **Step 3: استبدال وسوم التحميل**

في `athar-prototype.html` استبدل السطور 441-445:

```html
<script src="vendor/leaflet.js"></script>
<script src="vendor/maplibre-gl.js"></script>

<script src="athar-ownedmap.js"></script>
<script src="athar-glmap.js"></script>
```

بـ:

```html
<script src="vendor/maplibre-gl.js"></script>

<script src="athar-worksmap-style.js"></script>
<script src="athar-worksmap-layers.js"></script>
<script src="athar-worksmap-data.js"></script>
<script src="athar-worksmap.js"></script>
<script src="athar-worksmap-panel.js"></script>
```

- [ ] **Step 4: استبدال تهيئة الخريطة**

استبدل كتلة التهيئة (السطور 696-746 تقريباً — من `var GL = null;` حتى نهاية فرع Leaflet الاحتياطي) بـ:

```js
  var GL = null;
  var GL_MODE = false;

  fetch('data/riyadh-base.geojson')
    .then(function (response) { return response.ok ? response.json() : { type: 'FeatureCollection', features: [] }; })
    .catch(function () { return { type: 'FeatureCollection', features: [] }; })
    .then(function (baseGeoJSON) {
      GL = AtharWorksMap.init(document.getElementById('map'), RIYADH_ROADS, {
        scrollZoom: false,
        baseGeoJSON: baseGeoJSON,
        center: [46.685, 24.70],
        zoom: 13,
      });
      GL_MODE = true;

      GL.api.onReady(function () {
        var panel = document.getElementById('athar-map-panel');
        if (panel) AtharWorksMapPanel.mount(panel, GL.api, Date.now());

        fetch('api/works')
          .then(function (response) { return response.json(); })
          .then(function (works) { GL.api.setWorks(works); })
          .catch(function () { /* الخريطة تبقى صالحة بلا طبقة الأعمال */ });
      });

      startScenario();
    });
```

**ملاحظة للمنفّذ:** `startScenario` هو اسم الدالة التي كانت تُستدعى بعد تهيئة الخريطة في الكود الحالي. افتح الملف وتأكد من الاسم الفعلي قبل الاستبدال، واستدعِ نفس الدالة.

- [ ] **Step 5: حذف الخريطتين القديمتين و Leaflet**

```bash
cd Baladiyathon/presentation
git rm athar-glmap.js athar-ownedmap.js
git rm tests/glmap-test.js tests/ownedmap-test.js
git rm -r vendor/leaflet.js vendor/leaflet.css vendor/images
```

- [ ] **Step 6: تشغيل اختبار التوصيل**

Run: `node tests/worksmap-wiring-test.js`
Expected: `6 اختبارات نجحت`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: swap athar map to the works map and drop leaflet"
```

---

## Task 9: التحقق من عدم الانحدار والعرض الحي

**Files:**
- Modify: `Baladiyathon/presentation/tests/ui-smoke-test.js` (إن أشار إلى الوحدات المحذوفة)
- Test: كل ملفات `tests/*.js` الموجودة

**Interfaces:**
- Consumes: كل ما سبق
- Produces: لا شيء

- [ ] **Step 1: تشغيل كل الاختبارات**

```bash
cd Baladiyathon/presentation
for f in tests/*-test.js; do echo "--- $f"; node "$f" || echo "FAILED: $f"; done
```

Expected: لا سطر `FAILED:`. أي فشل في `ui-smoke-test.js` أو `server-test.js` بسبب إشارة إلى `athar-glmap.js` أو `leaflet` يُصلَح بتحديث الإشارة إلى `athar-worksmap.js`.

- [ ] **Step 2: تشغيل الخادم**

```bash
node server.js
```

Expected: الخادم يستمع على المنفذ 8734

- [ ] **Step 3: التحقق من الموارد**

```bash
curl -s -o /dev/null -w "html %{http_code}\n" http://localhost:8734/
curl -s -o /dev/null -w "works %{http_code}\n" http://localhost:8734/api/works
curl -s -o /dev/null -w "sprite %{http_code}\n" http://localhost:8734/vendor/sprite/sprite.json
curl -s -o /dev/null -w "glyph %{http_code}\n" "http://localhost:8734/vendor/glyphs/Noto%20Sans%20Regular/1536-1791.pbf"
curl -s -o /dev/null -w "base %{http_code}\n" http://localhost:8734/data/riyadh-base.geojson
```

Expected: خمسة أسطر بالقيمة `200`

- [ ] **Step 4: فحص بصري يدوي**

افتح `http://localhost:8734/` وتحقق من:

- [ ] الخريطة تظهر فاتحة بتدرّج طرق واضح، بلا ومضة داكنة عند التحميل
- [ ] أسماء الشوارع العربية **متصلة** لا حروفاً منفصلة معكوسة
- [ ] خطوط الأعمال متقطعة بلون كهرماني على محور الشارع
- [ ] لوحة الطبقات تظهر أعلى يمين الخريطة وتعمل مربعاتها
- [ ] تغيير الفترة إلى «كل التواريخ» يُظهر ميزات أكثر
- [ ] النقر على مقطع الممر يفتح تفاصيل الإغلاق كما قبل
- [ ] النقر على طريق يفتح محرر AADT/المسارات كما قبل
- [ ] لا خطأ في وحدة تحكم المتصفح
- [ ] قطع الإنترنت ثم تحديث الصفحة: الخريطة تعمل كاملة

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: update smoke tests after the map swap"
```

---

## Task 10: تحديث التوثيق والرسم المعرفي

**Files:**
- Modify: `Baladiyathon/presentation/README-athar.md`
- Modify: `Baladiyathon/README.md` (إن ذكر الخريطة القديمة)

- [ ] **Step 1: تحديث وصف الخريطة**

في `README-athar.md` استبدل أي ذكر لـ `athar-glmap.js` / `athar-ownedmap.js` بفقرة:

```markdown
## الخريطة

`athar-worksmap.js` — خريطة الأعمال بلغة one.network البصرية فوق بيانات محلية:

| الملف | المسؤولية |
|---|---|
| `athar-worksmap-style.js` | الخريطة الأساسية الفاتحة من GeoJSON محلي |
| `athar-worksmap-layers.js` | ثلاثية casing/line/symbol + التجميع + الفلاتر |
| `athar-worksmap-data.js` | تطبيع `works.geojson` إلى مخطط الرسم |
| `athar-worksmap-panel.js` | لوحة الفترة الزمنية وإظهار الطبقات |
| `athar-worksmap.js` | التهيئة وعقد الـ API الذي يستهلكه النموذج |

**بلا اتصال خارجي:** الخطوط (`vendor/glyphs/`) والأيقونات (`vendor/sprite/`) وإضافة
تشكيل العربية (`vendor/mapbox-gl-rtl-text.js`) كلها محلية. اختبار
`worksmap-style-test.js` يمنع تسرب أي رابط خارجي.

**إعادة بناء الأصول** (عند تغيير الأيقونات أو نطاق الخريطة):

```bash
node scripts/build-sprite.js        # يحتاج: npm install --no-save sharp
node scripts/fetch-glyphs.js        # مرة واحدة
node scripts/fetch-base-layers.js   # مرة واحدة
```

بيانات الطرق والمعالم © مساهمو OpenStreetMap — رخصة ODbL.
```

- [ ] **Step 2: إعادة فهرسة الرسم المعرفي**

```bash
cd ../..
graphify update
```

Expected: تحديث `graphify-out/graph.json` بلا خطأ

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: describe the works map modules and asset rebuild steps"
```

---

## موضوع على جنب — قرارات لا تعطّل التنفيذ

1. **تغطية وطنية عبر PMTiles.** الخطة تغطي نطاق شبكة الطرق المحلية فقط. التوسع = استخراج PMTiles للمملكة + دعم HTTP Range في `server.js`. لا يمس أي طبقة من طبقات الأعمال.

2. **تحويل بقية الواجهة إلى الأبيض.** الخريطة فاتحة من اللحظة الأولى، لكن `athar-map.css` وبقية النموذج ما زالت داكنة. توحيد الواجهة كلها على الأبيض الرسمي مشروع منفصل بخطة مستقلة — لا يعطّل تبديل الخريطة، والخطوة الوحيدة المطلوبة هنا هي تثبيت خلفية `#map` على الفاتح (مهمة ٧).

3. **طبقة الازدحام المروري.** غير مضمّنة (تكلفة مزوّد + اتصال خارجي يكسر شرط العرض بلا إنترنت).

4. **مصدر بيانات الأعمال الحقيقي.** `athar-worksmap-data.js` يحوّل مخطط أثر الحالي. أي مصدر بلدي جديد = دالة `toCanonical` ثانية في نفس الملف.

5. **حجم `riyadh-base.geojson`.** إن تجاوز 3MB، أضف تبسيطاً هندسياً إلى `fetch-base-layers.js` أو قلّص النطاق. لا يؤثر على منطق الطبقات.

6. **الرسوم المتحركة السينمائية** (الميلان، موجة الفتح `line-gradient`) الموجودة في `athar-glmap.js` غير منقولة. إن كانت مطلوبة للعرض، تُضاف كطبقة `corridor-glow` مستقلة بعد استقرار التبديل.

---

## مراجعة ذاتية

**تغطية المتطلبات:** «اربط الخريطة الجديدة بالمشروع» ← مهام 3-7 تبني الوحدات، ومهمة 8 توصّلها · «احذف الخريطة الحالية» ← مهمة 8 تحذف الوحدتين و Leaflet واختباريهما · «الخريطة التي تعمل على localhost» ← نُقلت لغتها البصرية بالكامل: الثلاثية، الشرطات، التجميع، اللوحة، تحميل الأيقونات، إدراج الطبقات تحت التسميات.

**فحص العناصر الناقصة:** لا `TBD` ولا «أضف معالجة مناسبة». الاستثناء الوحيد المقصود: اسم دالة `startScenario` في مهمة 8 خطوة 4 — مُعلَّم صراحة بأن يتحقق المنفّذ من الاسم الفعلي في الملف، لأن الكتلة المستبدلة تتجاوز 50 سطراً في ملف 110KB.

**اتساق الأنواع:** `binding = {points, lines}` نفسه في مهمة 4 ومهمة 6 · `CanonicalProps` من مهمة 5 تُقرأ في فلاتر مهمة 4 بنفس أسماء الحقول `group/subtype/severity/start_ts/end_ts` · `API_METHODS` في مهمة 6 هي نفسها المُختبرة في مهمة 6 خطوة 1 والمستهلكة في مهمة 8 · `LAYER_GROUPS[].swatch` المُضاف في مهمة 4 يستهلكه `Panel.render` في مهمة 7.

**فجوة معروفة:** `athar-worksmap.js` يقارب 400 سطر عند اكتماله. إن تجاوزها، اسحب دوال الممر (`corridorFC`, `pushCorridor`, حالات الممر) إلى `athar-worksmap-corridor.js` بنفس نمط UMD.
