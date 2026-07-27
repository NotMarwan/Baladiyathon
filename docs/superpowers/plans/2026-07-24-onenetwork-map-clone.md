# خطة تنفيذ: نسخة خريطة one.network (Live Works Map)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** بناء خريطة ويب تفاعلية تعرض أعمال الطرق والإغلاقات والحوادث ونقاط الاهتمام بنفس بنية وسلوك خريطة one.network، مع خادم بلاطات خاص فوق PostGIS.

**Architecture:** MapLibre GL JS يرسم خريطة أساسية من style متجهي مستضاف، وفوقها طبقات بيانات. كل نوع بيانات يُرسم بثلاثية طبقات `casing → line → symbol` (نفس اصطلاح one.network حرفياً). البيانات تُقدَّم أولاً كـ GeoJSON مع تجميع supercluster المدمج، ثم تُبدَّل إلى vector tiles عبر Martin فوق PostGIS عند تجاوز ١٠٠٠٠ ميزة — بتبديل مصدر واحد فقط، بلا مساس بتعريفات الطبقات.

**Tech Stack:** MapLibre GL JS 5.x · TypeScript · Vite · Vitest · Playwright · PostGIS 16 · Martin 0.14+ · spreet (بناء sprite) · Turf.js · Docker Compose

---

## المصدر المرجعي (ما تم استخراجه فعلياً من one.network)

هذه ليست تخمينات. مُستخرجة بفحص مباشر لـ `https://one.network` بتاريخ 2026-07-24، إصدار `5.0.0-20260723121514.0f398eb`:

| العنصر | القيمة المرصودة |
|---|---|
| محرك الخريطة | `window.maplibregl` — MapLibre GL JS |
| الإطار | ليس React — bundle خاص، namespace عام `Elgin` (الاسم القديم للشركة) |
| حجم الحزمة | `bundle.js` ≈ 10.04 MB |
| الخريطة الأساسية | MapTiler Cloud، style مخصص باسم `one.network`، **183 layer**، مصدر `openmaptiles` (vector, OSM) |
| خادم بلاطات البيانات | `martinTileServer: ${region}-prd-tiles.one.network` → **Martin** |
| قالب البلاطات | `${region}-prd-${source}${randomizer}.one.network` (domain sharding) |
| التجميع | `clusterRadius`, `clusterMaxZoom`, `clusterMinPoints`, `clusterProperties` |
| المكتبات المرصودة في bundle | `supercluster`, `turf`, `martin` |
| طبقة الازدحام | TomTom Traffic Flow: `https://{a,b,c,d}.api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.pbf` |
| الخطوط | Poppins (300–700 + italics)، Geist |
| علم مهم | `tilesDisabled: true` للمستخدم المجهول → الزائر العام يُخدَّم GeoJSON، والبلاطات للمستخدمين المسجّلين |

**أسماء الطبقات المرصودة حرفياً** (تُنسخ كما هي في المهمة 4):

```
roadworks-realtime-lines-casing
roadworks-realtime-lines
roadworks-realtime-symbols
closures-restrictions-realtime-lines-casing
closures-restrictions-realtime-lines
closures-restrictions-realtime-symbols
incidents-realtime-lines
incidents-realtime-symbols
bridge-restrictions-lines
bridge-restrictions-symbols
bridge-restrictions-line-symbols
clean-air-zones-casing
clean-air-zones-symbols
bus-routes-lines
lorry-routes-lines
priority-routes-lines
strategic-routes-lines
lane-rental-scheme-lines
nsg-lines
nsg-road-status-lines
nsg-permit-streets-lines
nsg-reinstatement-lines
nsg-special-designation-lines
bus-stop-symbols
train-station-symbols
tube-station-symbols
car-parks-symbols
cctv-symbols
traffic-lights-symbols
level-crossings-symbols
ev-charge-points-symbols
```

**أسماء الأيقونات المرصودة حرفياً** (تُنسخ في المهمة 5):

```
RoadworksIcon · EmergencyWorksIcon · DevelopmentWorksIcon · EndOfWorksIcon
WorksFootprintIcon · WorksPlanningModuleIcon
EventsPoiCareHomeIcon · EventsPoiClimbIcon · EventsPoiDisabledAccessIcon
EventsPoiDisabledParkingIcon · EventsPoiFestivalSiteIcon · EventsPoiFirstAidIcon
EventsPoiHospitalityAreaIcon · EventsPoiInformationIcon · EventsPoiParkingIcon
EventsPoiPedestrianBridgeIcon · EventsPoiPedestrianCrossingIcon · EventsPoiPharmacyIcon
EventsPoiRailIcon · EventsPoiSchoolIcon · EventsPoiSprintIcon
EventsPoiStartFinishIcon · EventsPoiWCIcon · EventsPoiWalkingRouteIcon
```

**تحذير ترخيص:** الأيقونات نفسها والـ style المخصص أصول محمية بحقوق Causeway. يُنسخ **النمط المعماري وأسماء الطبقات** (غير محمية — اصطلاح تسمية)، وتُصمَّم الأيقونات والألوان من جديد. المهمة 5 تبني sprite أصلياً.

---

## Global Constraints

- Node.js ≥ 20.11 · pnpm ≥ 9
- MapLibre GL JS `^5.0.0` — لا mapbox-gl (رخصة مقيدة)
- TypeScript strict mode مُفعّل: `"strict": true, "noUncheckedIndexedAccess": true`
- كل ملف مصدر ≤ 400 سطر. تجاوز 400 = قسّم الملف.
- كل دالة ≤ 50 سطر.
- لا قيم لونية مكتوبة داخل TypeScript — كل الألوان من `src/styles/tokens.ts` فقط.
- كل تعريفات الطبقات دوال نقية (pure) تُعيد كائن `LayerSpecification` — تُختبر بلا WebGL.
- التجميع فقط عبر MapLibre المدمج (`cluster: true`) — لا استدعاء `supercluster` يدوياً.
- الحركة على `transform` و `opacity` فقط.
- مفاتيح API لا تُكتب في الشيفرة أبداً — `import.meta.env.VITE_*` حصراً، و`.env` في `.gitignore`.
- كل مفتاح خرائط يُقيَّد بـ HTTP referrer في لوحة المزوّد قبل أي نشر.
- تغطية اختبارات ≥ 80% على `src/map/` و `src/data/`.
- رسائل الالتزام: Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`).

---

## مقارنة التكاليف — كل البدائل، بلا انحياز

**تحذير:** الأسعار مرصودة من صفحات المزوّدين العامة وقت كتابة الخطة (يوليو 2026). **لا تُعتمد كمصدر قرار.** تُعاد مراجعة كل صف على صفحة التسعير الرسمية قبل الالتزام بأي مزوّد. الأرقام تقديرية لسيناريو مرجعي: **٥٠٠٠٠ تحميل خريطة شهرياً**.

### أ. الخريطة الأساسية (Basemap)

| الخيار | نموذج التسعير | التكلفة عند 50k/شهر | المزايا | العيوب |
|---|---|---|---|---|
| **MapTiler Cloud** (ما يستخدمونه) | باقات ثابتة | ~$25–$295/شهر | محرر style رسومي، تسليم فوري، style عربي جاهز، RTL مدعوم | تبعية مزوّد، حد أقصى للطلبات، بياناتك تمر عبرهم |
| **Protomaps (PMTiles ذاتي)** | تخزين + نقل فقط | ~$1–$8/شهر (R2/S3) | ملف واحد `.pmtiles`، بلا خادم، أرخص خيار على الإطلاق، سيطرة كاملة | التحديث يعني إعادة بناء الملف كاملاً، لا محرر رسومي، إعداد أولي أطول |
| **OpenMapTiles ذاتي الاستضافة** | خادم VPS | ~$12–$40/شهر | سيطرة كاملة، تحديث تدريجي | إدارة خادم، بناء البلاطات يحتاج ذاكرة كبيرة |
| **Mapbox** | لكل تحميل | ~$0 حتى 50k ثم ~$5/1000 | جودة عالية، أدوات ناضجة | مكلف عند التوسع، SDK مقيد الرخصة |
| **Stadia Maps** | باقات | ~$0–$65/شهر | تسعير واضح، حد مجاني سخي | خيارات style أقل |
| **Esri / ArcGIS** | مؤسسي | يبدأ ~$100+/شهر | تكامل GIS مؤسسي، دعم عربي قوي | الأغلى، مقيد بمنظومته |
| **Google Maps Platform** | لكل تحميل | ~$350/شهر عند 50k | تعرف المستخدمين عليه | الأغلى بفارق، لا يعمل مع MapLibre، لا سيطرة على style |

### ب. خادم بلاطات البيانات

| الخيار | الرخصة | التكلفة | ملاحظة |
|---|---|---|---|
| **Martin** (ما يستخدمونه) | Apache-2.0 مجاني | تكلفة الخادم فقط (~$12–$40/شهر VPS) | Rust، سريع، يقرأ PostGIS مباشرة، ودوال SQL كمصادر |
| **pg_tileserv** | Apache-2.0 مجاني | نفسها | Go، أبسط، ميزات أقل |
| **Tegola** | MIT مجاني | نفسها | Go، تخزين مؤقت مدمج |
| **tileserver-gl** | BSD مجاني | نفسها | يخدم mbtiles جاهزة، لا يقرأ PostGIS حياً |
| **PMTiles على CDN** | BSD مجاني | ~$1–$5/شهر | بلا خادم إطلاقاً، لكن البيانات ثابتة لا حيّة |

### ج. طبقة الازدحام المروري (اختيارية بالكامل)

| الخيار | التكلفة التقديرية | ملاحظة |
|---|---|---|
| **TomTom Traffic** (ما يستخدمونه) | مجاني حتى 2500 طلب/يوم، ثم ~$0.5–$4/1000 | تغطية السعودية جيدة |
| **HERE Traffic** | باقات مؤسسية، تبدأ ~$200+/شهر | تغطية قوية |
| **Mapbox Traffic** | ضمن باقة Mapbox | يتطلب حزمة Mapbox |
| **بلا طبقة ازدحام** | **٠** | **الافتراضي في هذه الخطة** — تُضاف لاحقاً إن لزم |

### د. الاستضافة والتشغيل

| المكوّن | خيار رخيص | خيار متوسط | خيار مؤسسي |
|---|---|---|---|
| الواجهة (static) | Cloudflare Pages / Netlify — **٠** | Vercel Pro ~$20/شهر | CDN خاص ~$100+ |
| PostGIS | Docker على VPS ~$12/شهر | Supabase ~$25/شهر · Neon ~$19/شهر | RDS/Aurora ~$150+/شهر |
| Martin | نفس VPS — **٠ إضافي** | Fly.io ~$10/شهر | ECS/K8s ~$80+/شهر |
| تخزين الأصول | Cloudflare R2 ~$0.015/GB | S3 ~$0.023/GB | — |

### هـ. ثلاث حزم كاملة (الحد الأدنى الشهري)

| الحزمة | التركيب | التكلفة/شهر |
|---|---|---|
| **الأرخص المطلق** | Protomaps PMTiles على R2 + PostGIS و Martin على VPS واحد $12 + Cloudflare Pages | **~$13** |
| **الأقرب لما يستخدمونه** | MapTiler $25 + VPS $24 (PostGIS + Martin) + Pages | **~$49** |
| **مؤسسي كامل** | Esri أو MapTiler Enterprise + RDS + ECS + TomTom | **~$450+** |

**القرار في هذه الخطة:** الشيفرة تدعم **الاثنين** — MapTiler و Protomaps — عبر مبدّل واحد في متغير بيئة (`VITE_BASEMAP_PROVIDER`). لا التزام بمزوّد قبل مقارنتك النهائية. المهمة 2 تبني هذا المبدّل بالضبط لهذا السبب.

---

## بنية الملفات

```
onenetwork-clone/
├── docker-compose.yml              خدمتان: postgis + martin
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── .env.example                    كل المتغيرات، بلا قيم حقيقية
├── .gitignore                      يحوي .env
│
├── db/
│   ├── 001_schema.sql              جداول features + فهارس مكانية
│   ├── 002_tile_functions.sql      دوال Martin لبلاطات المتجهات
│   └── seed/works.sample.geojson   ٣٠ ميزة تجريبية للتطوير
│
├── martin/
│   └── config.yaml                 تعريف مصادر Martin
│
├── icons/                          مصادر SVG (٢٤×٢٤) — تُصمَّم أصلياً
│   ├── roadworks.svg
│   ├── emergency-works.svg
│   ├── development-works.svg
│   ├── end-of-works.svg
│   ├── closure.svg
│   ├── incident.svg
│   ├── poi-parking.svg
│   ├── poi-first-aid.svg
│   ├── poi-school.svg
│   └── poi-rail.svg
│
├── public/
│   └── sprite/                     مُولَّد بـ spreet — في .gitignore
│
├── src/
│   ├── main.ts                     نقطة الدخول فقط
│   ├── env.ts                      قراءة وتحقق متغيرات البيئة
│   │
│   ├── styles/
│   │   ├── tokens.ts               ألوان/أحجام كثوابت TypeScript
│   │   ├── tokens.css              نفس القيم كـ CSS custom properties
│   │   └── app.css
│   │
│   ├── map/
│   │   ├── basemap.ts              resolveBasemapStyle() — مبدّل المزوّد
│   │   ├── createMap.ts            تهيئة MapLibre
│   │   ├── buildTriple.ts          مصنع casing/line/symbol ← جوهر النسخ
│   │   ├── clusterLayers.ts        طبقات التجميع
│   │   ├── registry.ts             تعريف كل أنواع الطبقات
│   │   ├── install.ts              يركّب المصادر والطبقات على الخريطة
│   │   ├── interactions.ts         النقر، التمرير، البوب-أب
│   │   └── filters.ts              تعبيرات الفلترة الزمنية
│   │
│   ├── data/
│   │   ├── types.ts                CanonicalFeature وأنواعها
│   │   ├── normalize.ts            أي مصدر → CanonicalFeature
│   │   └── adapters/
│   │       ├── streetManager.ts    محوّل تنسيق Street Manager (DfT)
│   │       └── generic.ts          محوّل GeoJSON/CSV عام
│   │
│   └── ui/
│       ├── controlPanel.ts         لوحة البحث + التاريخ
│       └── layerToggle.ts          تشغيل/إطفاء الطبقات
│
└── tests/
    ├── unit/
    │   ├── basemap.test.ts
    │   ├── buildTriple.test.ts
    │   ├── clusterLayers.test.ts
    │   ├── registry.test.ts
    │   ├── filters.test.ts
    │   └── normalize.test.ts
    └── e2e/
        ├── map-loads.spec.ts
        └── interactions.spec.ts
```

**منطق التقسيم:** كل ملف في `src/map/` دالة نقية واحدة تُعيد بيانات — لهذا كلها قابلة للاختبار بـ Vitest بلا WebGL ولا متصفح. الملف الوحيد الذي يلمس MapLibre فعلياً هو `createMap.ts` و `install.ts` و `interactions.ts`، وتُختبر بـ Playwright.

---

## Task 1: هيكل المشروع وأول اختبار أخضر

**Files:**
- Create: `onenetwork-clone/package.json`
- Create: `onenetwork-clone/tsconfig.json`
- Create: `onenetwork-clone/vite.config.ts`
- Create: `onenetwork-clone/vitest.config.ts`
- Create: `onenetwork-clone/.gitignore`
- Create: `onenetwork-clone/.env.example`
- Create: `onenetwork-clone/src/env.ts`
- Test: `onenetwork-clone/tests/unit/env.test.ts`

**Interfaces:**
- Consumes: لا شيء (المهمة الأولى)
- Produces: `readEnv(source: Record<string, string | undefined>): AppEnv` حيث
  `type AppEnv = { basemapProvider: 'maptiler' | 'protomaps'; maptilerKey: string; maptilerStyleId: string; protomapsUrl: string; tileServer: string; dataUrl: string }`

- [ ] **Step 1: إنشاء المجلد والحزمة**

```bash
mkdir -p onenetwork-clone/src onenetwork-clone/tests/unit
cd onenetwork-clone
pnpm init
pnpm add maplibre-gl@^5.0.0 @turf/turf
pnpm add -D typescript vite vitest @types/node
```

- [ ] **Step 2: كتابة `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: كتابة `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: { include: ['src/map/**', 'src/data/**'], thresholds: { lines: 80 } },
  },
});
```

- [ ] **Step 4: كتابة `.gitignore`**

```
node_modules/
dist/
.env
.env.local
public/sprite/
coverage/
test-results/
```

- [ ] **Step 5: كتابة `.env.example`**

```
VITE_BASEMAP_PROVIDER=maptiler
VITE_MAPTILER_KEY=
VITE_MAPTILER_STYLE_ID=
VITE_PROTOMAPS_URL=
VITE_TILE_SERVER=http://localhost:3000
VITE_DATA_URL=/db/seed/works.sample.geojson
```

- [ ] **Step 6: كتابة الاختبار الفاشل**

`tests/unit/env.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { readEnv } from '../../src/env';

describe('readEnv', () => {
  test('returns maptiler config when provider is maptiler', () => {
    const env = readEnv({
      VITE_BASEMAP_PROVIDER: 'maptiler',
      VITE_MAPTILER_KEY: 'k1',
      VITE_MAPTILER_STYLE_ID: 's1',
      VITE_TILE_SERVER: 'http://localhost:3000',
      VITE_DATA_URL: '/data.geojson',
    });
    expect(env.basemapProvider).toBe('maptiler');
    expect(env.maptilerKey).toBe('k1');
  });

  test('throws when provider is maptiler but key is missing', () => {
    expect(() =>
      readEnv({ VITE_BASEMAP_PROVIDER: 'maptiler', VITE_MAPTILER_STYLE_ID: 's1' })
    ).toThrow('VITE_MAPTILER_KEY is required');
  });

  test('throws when provider value is unknown', () => {
    expect(() => readEnv({ VITE_BASEMAP_PROVIDER: 'google' })).toThrow(
      'VITE_BASEMAP_PROVIDER must be "maptiler" or "protomaps"'
    );
  });
});
```

- [ ] **Step 7: تشغيل الاختبار للتأكد من فشله**

Run: `pnpm vitest run tests/unit/env.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/env"`

- [ ] **Step 8: كتابة التنفيذ الأدنى**

`src/env.ts`:

```ts
export type BasemapProvider = 'maptiler' | 'protomaps';

export interface AppEnv {
  basemapProvider: BasemapProvider;
  maptilerKey: string;
  maptilerStyleId: string;
  protomapsUrl: string;
  tileServer: string;
  dataUrl: string;
}

type EnvSource = Record<string, string | undefined>;

function required(source: EnvSource, key: string): string {
  const value = source[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

export function readEnv(source: EnvSource): AppEnv {
  const provider = source.VITE_BASEMAP_PROVIDER;
  if (provider !== 'maptiler' && provider !== 'protomaps') {
    throw new Error('VITE_BASEMAP_PROVIDER must be "maptiler" or "protomaps"');
  }

  return {
    basemapProvider: provider,
    maptilerKey: provider === 'maptiler' ? required(source, 'VITE_MAPTILER_KEY') : '',
    maptilerStyleId: provider === 'maptiler' ? required(source, 'VITE_MAPTILER_STYLE_ID') : '',
    protomapsUrl: provider === 'protomaps' ? required(source, 'VITE_PROTOMAPS_URL') : '',
    tileServer: source.VITE_TILE_SERVER ?? 'http://localhost:3000',
    dataUrl: source.VITE_DATA_URL ?? '/db/seed/works.sample.geojson',
  };
}
```

- [ ] **Step 9: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm vitest run tests/unit/env.test.ts`
Expected: PASS — 3 passed

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json vite.config.ts vitest.config.ts .gitignore .env.example src/env.ts tests/unit/env.test.ts
git commit -m "feat: scaffold project with validated env config"
```

---

## Task 2: مبدّل الخريطة الأساسية (MapTiler ↔ Protomaps)

يبني الدالة التي تجعل قرار المزوّد قابلاً للتأجيل — تُبدَّل بمتغير بيئة واحد، بلا تعديل شيفرة.

**Files:**
- Create: `onenetwork-clone/src/map/basemap.ts`
- Test: `onenetwork-clone/tests/unit/basemap.test.ts`

**Interfaces:**
- Consumes: `AppEnv` من `src/env.ts` (المهمة 1)
- Produces: `resolveBasemapStyle(env: AppEnv): string | StyleSpecification`

- [ ] **Step 1: كتابة الاختبار الفاشل**

`tests/unit/basemap.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { resolveBasemapStyle } from '../../src/map/basemap';
import type { AppEnv } from '../../src/env';

const base: AppEnv = {
  basemapProvider: 'maptiler',
  maptilerKey: 'KEY123',
  maptilerStyleId: 'STYLE456',
  protomapsUrl: '',
  tileServer: 'http://localhost:3000',
  dataUrl: '/data.geojson',
};

describe('resolveBasemapStyle', () => {
  test('builds a MapTiler style URL from key and style id', () => {
    const result = resolveBasemapStyle(base);
    expect(result).toBe('https://api.maptiler.com/maps/STYLE456/style.json?key=KEY123');
  });

  test('builds an inline style object for protomaps', () => {
    const result = resolveBasemapStyle({
      ...base,
      basemapProvider: 'protomaps',
      maptilerKey: '',
      maptilerStyleId: '',
      protomapsUrl: 'https://cdn.example.com/planet.pmtiles',
    });
    expect(typeof result).toBe('object');
    const style = result as Record<string, any>;
    expect(style.sources.protomaps.type).toBe('vector');
    expect(style.sources.protomaps.url).toBe('pmtiles://https://cdn.example.com/planet.pmtiles');
  });

  test('protomaps style includes an attribution', () => {
    const style = resolveBasemapStyle({
      ...base,
      basemapProvider: 'protomaps',
      protomapsUrl: 'https://cdn.example.com/planet.pmtiles',
    }) as Record<string, any>;
    expect(style.sources.protomaps.attribution).toContain('OpenStreetMap');
  });
});
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `pnpm vitest run tests/unit/basemap.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/map/basemap"`

- [ ] **Step 3: كتابة التنفيذ**

`src/map/basemap.ts`:

```ts
import type { StyleSpecification } from 'maplibre-gl';
import type { AppEnv } from '../env';
import { COLORS } from '../styles/tokens';

const OSM_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>';

function protomapsStyle(pmtilesUrl: string): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution: OSM_ATTRIBUTION,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': COLORS.basemapLand } },
      {
        id: 'water',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'water',
        paint: { 'fill-color': COLORS.basemapWater },
      },
      {
        id: 'landuse-green',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landuse',
        paint: { 'fill-color': COLORS.basemapGreen },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        paint: { 'line-color': COLORS.basemapRoad, 'line-width': 1.2 },
      },
      {
        id: 'place-labels',
        type: 'symbol',
        source: 'protomaps',
        'source-layer': 'places',
        layout: { 'text-field': ['get', 'name'], 'text-size': 12 },
        paint: { 'text-color': COLORS.basemapLabel },
      },
    ],
  };
}

export function resolveBasemapStyle(env: AppEnv): string | StyleSpecification {
  if (env.basemapProvider === 'maptiler') {
    return `https://api.maptiler.com/maps/${env.maptilerStyleId}/style.json?key=${env.maptilerKey}`;
  }
  return protomapsStyle(env.protomapsUrl);
}
```

- [ ] **Step 4: كتابة ملف الرموز اللونية**

`src/styles/tokens.ts`:

```ts
export const COLORS = {
  basemapLand: '#f5f4f1',
  basemapWater: '#c3dcf0',
  basemapGreen: '#d9e8cd',
  basemapRoad: '#ffffff',
  basemapLabel: '#4a4a4a',

  roadworks: '#f0a020',
  roadworksCasing: '#a86d10',
  emergency: '#e03131',
  emergencyCasing: '#8c1d1d',
  closure: '#c92a2a',
  closureCasing: '#7a1010',
  incident: '#f76707',
  incidentCasing: '#9c4106',
  diversion: '#1c7ed6',
  diversionCasing: '#0b4a86',
  poi: '#2f9e44',
  poiCasing: '#1a5c28',
  info: '#1971c2',
  infoCasing: '#0f4478',

  clusterSmall: '#f0a020',
  clusterMedium: '#f76707',
  clusterLarge: '#e03131',
  clusterText: '#ffffff',
} as const;

export const SIZES = {
  casingWidth: 7,
  lineWidth: 3,
  iconSize: 0.85,
  clusterRadiusSmall: 16,
  clusterRadiusMedium: 22,
  clusterRadiusLarge: 28,
} as const;
```

- [ ] **Step 5: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm vitest run tests/unit/basemap.test.ts`
Expected: PASS — 3 passed

- [ ] **Step 6: Commit**

```bash
git add src/map/basemap.ts src/styles/tokens.ts tests/unit/basemap.test.ts
git commit -m "feat: add basemap provider switch for maptiler and protomaps"
```

---

## Task 3: مصنع ثلاثية الطبقات `buildTriple` — جوهر النسخ

هذه هي الدالة التي تنسخ نمط one.network المعماري بالضبط: كل نوع بيانات = `-lines-casing` + `-lines` + `-symbols`.

**Files:**
- Create: `onenetwork-clone/src/map/buildTriple.ts`
- Test: `onenetwork-clone/tests/unit/buildTriple.test.ts`

**Interfaces:**
- Consumes: `COLORS`, `SIZES` من `src/styles/tokens.ts` (المهمة 2)
- Produces:
  ```ts
  interface TripleConfig {
    name: string;          // مثال: 'roadworks-realtime'
    source: string;
    sourceLayer?: string;
    lineColor: string;
    casingColor: string;
    iconImage: string | unknown[];
    lineDasharray?: number[];
    minzoom?: number;
    symbolSortKey?: unknown[];
  }
  function buildTriple(config: TripleConfig): LayerSpecification[]
  ```

- [ ] **Step 1: كتابة الاختبار الفاشل**

`tests/unit/buildTriple.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { buildTriple } from '../../src/map/buildTriple';
import { COLORS, SIZES } from '../../src/styles/tokens';

const config = {
  name: 'roadworks-realtime',
  source: 'works',
  lineColor: COLORS.roadworks,
  casingColor: COLORS.roadworksCasing,
  iconImage: 'roadworks',
};

describe('buildTriple', () => {
  test('produces exactly three layers', () => {
    expect(buildTriple(config)).toHaveLength(3);
  });

  test('names layers with the one.network convention', () => {
    const ids = buildTriple(config).map((l) => l.id);
    expect(ids).toEqual([
      'roadworks-realtime-lines-casing',
      'roadworks-realtime-lines',
      'roadworks-realtime-symbols',
    ]);
  });

  test('casing is wider than the line so it reads as a border', () => {
    const [casing, line] = buildTriple(config);
    expect(casing.paint!['line-width']).toBe(SIZES.casingWidth);
    expect(line.paint!['line-width']).toBe(SIZES.lineWidth);
    expect(SIZES.casingWidth).toBeGreaterThan(SIZES.lineWidth);
  });

  test('line layers only render LineString geometry', () => {
    const [casing, line] = buildTriple(config);
    expect(casing.filter).toEqual(['==', ['geometry-type'], 'LineString']);
    expect(line.filter).toEqual(['==', ['geometry-type'], 'LineString']);
  });

  test('symbol layer excludes cluster features', () => {
    const [, , symbol] = buildTriple(config);
    expect(symbol.filter).toEqual(['!', ['has', 'point_count']]);
  });

  test('symbol layer allows icon overlap so nothing silently disappears', () => {
    const [, , symbol] = buildTriple(config);
    expect(symbol.layout!['icon-allow-overlap']).toBe(true);
    expect(symbol.layout!['icon-image']).toBe('roadworks');
  });

  test('applies dasharray when provided', () => {
    const [, line] = buildTriple({ ...config, lineDasharray: [2, 2] });
    expect(line.paint!['line-dasharray']).toEqual([2, 2]);
  });

  test('omits dasharray key entirely when not provided', () => {
    const [, line] = buildTriple(config);
    expect(line.paint).not.toHaveProperty('line-dasharray');
  });

  test('propagates minzoom to all three layers', () => {
    const layers = buildTriple({ ...config, minzoom: 11 });
    expect(layers.every((l) => l.minzoom === 11)).toBe(true);
  });

  test('adds source-layer to every layer when given', () => {
    const layers = buildTriple({ ...config, sourceLayer: 'works_tiles' });
    expect(layers.every((l) => (l as any)['source-layer'] === 'works_tiles')).toBe(true);
  });
});
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `pnpm vitest run tests/unit/buildTriple.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/map/buildTriple"`

- [ ] **Step 3: كتابة التنفيذ**

`src/map/buildTriple.ts`:

```ts
import type { LayerSpecification } from 'maplibre-gl';
import { SIZES } from '../styles/tokens';

export interface TripleConfig {
  name: string;
  source: string;
  sourceLayer?: string;
  lineColor: string;
  casingColor: string;
  iconImage: string | unknown[];
  lineDasharray?: number[];
  minzoom?: number;
  symbolSortKey?: unknown[];
}

const LINE_ONLY = ['==', ['geometry-type'], 'LineString'] as const;
const NOT_CLUSTER = ['!', ['has', 'point_count']] as const;

function withOptional<T extends Record<string, unknown>>(
  base: T,
  extras: Record<string, unknown>
): T {
  const result = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(extras)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
}

export function buildTriple(config: TripleConfig): LayerSpecification[] {
  const shared = {
    source: config.source,
    ...(config.sourceLayer ? { 'source-layer': config.sourceLayer } : {}),
    ...(config.minzoom !== undefined ? { minzoom: config.minzoom } : {}),
  };

  const casing = {
    ...shared,
    id: `${config.name}-lines-casing`,
    type: 'line',
    filter: LINE_ONLY,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': config.casingColor, 'line-width': SIZES.casingWidth },
  };

  const line = {
    ...shared,
    id: `${config.name}-lines`,
    type: 'line',
    filter: LINE_ONLY,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: withOptional(
      { 'line-color': config.lineColor, 'line-width': SIZES.lineWidth },
      { 'line-dasharray': config.lineDasharray }
    ),
  };

  const symbol = {
    ...shared,
    id: `${config.name}-symbols`,
    type: 'symbol',
    filter: NOT_CLUSTER,
    layout: withOptional(
      {
        'icon-image': config.iconImage,
        'icon-size': SIZES.iconSize,
        'icon-allow-overlap': true,
        'icon-ignore-placement': false,
      },
      { 'symbol-sort-key': config.symbolSortKey }
    ),
  };

  return [casing, line, symbol] as unknown as LayerSpecification[];
}
```

- [ ] **Step 4: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm vitest run tests/unit/buildTriple.test.ts`
Expected: PASS — 10 passed

- [ ] **Step 5: Commit**

```bash
git add src/map/buildTriple.ts tests/unit/buildTriple.test.ts
git commit -m "feat: add casing/line/symbol layer triple factory"
```

---

## Task 4: سجل الطبقات بأسماء one.network الحرفية

**Files:**
- Create: `onenetwork-clone/src/map/registry.ts`
- Test: `onenetwork-clone/tests/unit/registry.test.ts`

**Interfaces:**
- Consumes: `buildTriple`, `TripleConfig` من `src/map/buildTriple.ts` (المهمة 3)؛ `COLORS` من `src/styles/tokens.ts`
- Produces:
  ```ts
  interface LayerGroup { id: string; label: string; labelAr: string; configs: TripleConfig[] }
  const LAYER_GROUPS: LayerGroup[]
  function buildAllLayers(source: string, sourceLayer?: string): LayerSpecification[]
  ```

- [ ] **Step 1: كتابة الاختبار الفاشل**

`tests/unit/registry.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { LAYER_GROUPS, buildAllLayers } from '../../src/map/registry';

describe('LAYER_GROUPS', () => {
  test('covers the five core one.network data groups', () => {
    const ids = LAYER_GROUPS.map((g) => g.id);
    expect(ids).toEqual(['roadworks', 'closures', 'incidents', 'diversions', 'pois']);
  });

  test('every group has both English and Arabic labels', () => {
    for (const group of LAYER_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.labelAr.length).toBeGreaterThan(0);
    }
  });
});

describe('buildAllLayers', () => {
  test('emits three layers per config', () => {
    const configCount = LAYER_GROUPS.reduce((n, g) => n + g.configs.length, 0);
    expect(buildAllLayers('works')).toHaveLength(configCount * 3);
  });

  test('reproduces the exact one.network layer ids', () => {
    const ids = buildAllLayers('works').map((l) => l.id);
    expect(ids).toContain('roadworks-realtime-lines-casing');
    expect(ids).toContain('roadworks-realtime-lines');
    expect(ids).toContain('roadworks-realtime-symbols');
    expect(ids).toContain('closures-restrictions-realtime-lines-casing');
    expect(ids).toContain('closures-restrictions-realtime-symbols');
    expect(ids).toContain('incidents-realtime-symbols');
  });

  test('every layer id is unique', () => {
    const ids = buildAllLayers('works').map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('passes source-layer through to every layer when given', () => {
    const layers = buildAllLayers('works', 'works_tiles');
    expect(layers.every((l) => (l as any)['source-layer'] === 'works_tiles')).toBe(true);
  });
});
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `pnpm vitest run tests/unit/registry.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/map/registry"`

- [ ] **Step 3: كتابة التنفيذ**

`src/map/registry.ts`:

```ts
import type { LayerSpecification } from 'maplibre-gl';
import { buildTriple, type TripleConfig } from './buildTriple';
import { COLORS } from '../styles/tokens';

export interface LayerGroup {
  id: string;
  label: string;
  labelAr: string;
  configs: TripleConfig[];
}

const iconByType = (prefix: string, fallback: string) =>
  ['coalesce', ['image', ['concat', prefix, ['get', 'subtype']]], ['image', fallback]];

export const LAYER_GROUPS: LayerGroup[] = [
  {
    id: 'roadworks',
    label: 'Roadworks',
    labelAr: 'أعمال الطرق',
    configs: [
      {
        name: 'roadworks-realtime',
        source: '',
        lineColor: COLORS.roadworks,
        casingColor: COLORS.roadworksCasing,
        iconImage: iconByType('works-', 'roadworks'),
        symbolSortKey: ['-', 10, ['coalesce', ['get', 'severity'], 0]],
      },
    ],
  },
  {
    id: 'closures',
    label: 'Closures & restrictions',
    labelAr: 'الإغلاقات والقيود',
    configs: [
      {
        name: 'closures-restrictions-realtime',
        source: '',
        lineColor: COLORS.closure,
        casingColor: COLORS.closureCasing,
        iconImage: 'closure',
        symbolSortKey: ['-', 5, ['coalesce', ['get', 'severity'], 0]],
      },
    ],
  },
  {
    id: 'incidents',
    label: 'Incidents',
    labelAr: 'الحوادث',
    configs: [
      {
        name: 'incidents-realtime',
        source: '',
        lineColor: COLORS.incident,
        casingColor: COLORS.incidentCasing,
        iconImage: 'incident',
        symbolSortKey: ['-', 1, ['coalesce', ['get', 'severity'], 0]],
      },
    ],
  },
  {
    id: 'diversions',
    label: 'Diversion & bus routes',
    labelAr: 'مسارات التحويل والحافلات',
    configs: [
      {
        name: 'diversion-routes',
        source: '',
        lineColor: COLORS.diversion,
        casingColor: COLORS.diversionCasing,
        iconImage: 'diversion',
        lineDasharray: [2, 2],
      },
      {
        name: 'bus-routes',
        source: '',
        lineColor: COLORS.info,
        casingColor: COLORS.infoCasing,
        iconImage: 'bus-stop',
        lineDasharray: [3, 2],
        minzoom: 12,
      },
    ],
  },
  {
    id: 'pois',
    label: 'Points of interest',
    labelAr: 'نقاط الاهتمام',
    configs: [
      {
        name: 'events-poi',
        source: '',
        lineColor: COLORS.poi,
        casingColor: COLORS.poiCasing,
        iconImage: iconByType('poi-', 'poi-information'),
        minzoom: 13,
      },
    ],
  },
];

export function buildAllLayers(source: string, sourceLayer?: string): LayerSpecification[] {
  return LAYER_GROUPS.flatMap((group) =>
    group.configs.flatMap((config) =>
      buildTriple({ ...config, source, ...(sourceLayer ? { sourceLayer } : {}) })
    )
  );
}
```

- [ ] **Step 4: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm vitest run tests/unit/registry.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/map/registry.ts tests/unit/registry.test.ts
git commit -m "feat: add layer registry mirroring one.network layer ids"
```

---

## Task 5: بناء sprite الأيقونات

**Files:**
- Create: `onenetwork-clone/icons/*.svg` (١٠ ملفات)
- Modify: `onenetwork-clone/package.json` (إضافة سكربت `sprite`)
- Test: `onenetwork-clone/tests/unit/sprite.test.ts`

**Interfaces:**
- Consumes: لا شيء
- Produces: `public/sprite/sprite.json` + `sprite.png` (+ `@2x`) تحوي المفاتيح:
  `roadworks`, `works-emergency`, `works-development`, `works-end`, `closure`, `incident`, `diversion`, `bus-stop`, `poi-parking`, `poi-information`

- [ ] **Step 1: تثبيت أداة بناء الـ sprite**

```bash
pnpm add -D spreet
```

- [ ] **Step 2: كتابة أيقونة SVG واحدة كنموذج**

`icons/roadworks.svg` — دائرة ملونة بحدود بيضاء ورمز داخلها، تماماً كنمطهم:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="12" fill="#f0a020" stroke="#ffffff" stroke-width="2"/>
  <path d="M10 18 L14 8 L18 18 Z" fill="#ffffff"/>
  <rect x="9" y="18" width="10" height="2" rx="1" fill="#ffffff"/>
</svg>
```

- [ ] **Step 3: كتابة باقي الأيقونات التسع**

نفس القالب مع تغيير `fill` للدائرة والرمز الداخلي:

| الملف | لون الدائرة | الرمز الداخلي |
|---|---|---|
| `works-emergency.svg` | `#e03131` | علامة تعجب `!` |
| `works-development.svg` | `#f0a020` | رافعة/مبنى |
| `works-end.svg` | `#2f9e44` | علامة صح |
| `closure.svg` | `#c92a2a` | شريط أفقي أبيض (ممنوع المرور) |
| `incident.svg` | `#f76707` | مثلث تحذير |
| `diversion.svg` | `#1c7ed6` | سهم منحني |
| `bus-stop.svg` | `#1971c2` | حافلة مبسطة |
| `poi-parking.svg` | `#2f9e44` | حرف P |
| `poi-information.svg` | `#1971c2` | حرف i |

مثال `closure.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="12" fill="#c92a2a" stroke="#ffffff" stroke-width="2"/>
  <rect x="7" y="12.5" width="14" height="3" rx="1.5" fill="#ffffff"/>
</svg>
```

- [ ] **Step 4: إضافة سكربت البناء**

في `package.json` تحت `"scripts"`:

```json
"sprite": "spreet --unique icons public/sprite/sprite && spreet --unique --ratio 2 icons public/sprite/sprite@2x"
```

- [ ] **Step 5: تشغيل البناء**

Run: `pnpm sprite`
Expected: إنشاء `public/sprite/sprite.json`, `sprite.png`, `sprite@2x.json`, `sprite@2x.png`

- [ ] **Step 6: كتابة اختبار يتحقق من تطابق أسماء الأيقونات مع السجل**

`tests/unit/sprite.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const SPRITE_JSON = 'public/sprite/sprite.json';

const REQUIRED_ICONS = [
  'roadworks', 'works-emergency', 'works-development', 'works-end',
  'closure', 'incident', 'diversion', 'bus-stop',
  'poi-parking', 'poi-information',
];

describe('sprite', () => {
  test('sprite.json exists — run `pnpm sprite` if this fails', () => {
    expect(existsSync(SPRITE_JSON)).toBe(true);
  });

  test('contains every icon referenced by the layer registry', () => {
    const sprite = JSON.parse(readFileSync(SPRITE_JSON, 'utf8'));
    for (const icon of REQUIRED_ICONS) {
      expect(Object.keys(sprite)).toContain(icon);
    }
  });

  test('every icon has non-zero dimensions', () => {
    const sprite = JSON.parse(readFileSync(SPRITE_JSON, 'utf8'));
    for (const [name, meta] of Object.entries<any>(sprite)) {
      expect(meta.width, `${name} width`).toBeGreaterThan(0);
      expect(meta.height, `${name} height`).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 7: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm vitest run tests/unit/sprite.test.ts`
Expected: PASS — 3 passed

- [ ] **Step 8: Commit**

```bash
git add icons/ package.json tests/unit/sprite.test.ts
git commit -m "feat: add original icon set and sprite build pipeline"
```

---

## Task 6: طبقات التجميع (الدوائر المجمّعة)

**Files:**
- Create: `onenetwork-clone/src/map/clusterLayers.ts`
- Test: `onenetwork-clone/tests/unit/clusterLayers.test.ts`

**Interfaces:**
- Consumes: `COLORS`, `SIZES` من `src/styles/tokens.ts`
- Produces:
  ```ts
  const CLUSTER_OPTIONS: { cluster: true; clusterRadius: number; clusterMaxZoom: number; clusterMinPoints: number; clusterProperties: Record<string, unknown[]> }
  function buildClusterLayers(source: string): LayerSpecification[]
  ```

- [ ] **Step 1: كتابة الاختبار الفاشل**

`tests/unit/clusterLayers.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { buildClusterLayers, CLUSTER_OPTIONS } from '../../src/map/clusterLayers';

describe('CLUSTER_OPTIONS', () => {
  test('matches the one.network clustering shape', () => {
    expect(CLUSTER_OPTIONS.cluster).toBe(true);
    expect(CLUSTER_OPTIONS.clusterRadius).toBe(50);
    expect(CLUSTER_OPTIONS.clusterMaxZoom).toBe(14);
    expect(CLUSTER_OPTIONS.clusterMinPoints).toBe(2);
  });

  test('aggregates a severity count so cluster colour reflects worst item', () => {
    expect(CLUSTER_OPTIONS.clusterProperties).toHaveProperty('max_severity');
  });
});

describe('buildClusterLayers', () => {
  test('produces a circle layer and a count label layer', () => {
    const layers = buildClusterLayers('works');
    expect(layers.map((l) => l.id)).toEqual(['works-clusters', 'works-cluster-count']);
  });

  test('cluster layers only render clustered features', () => {
    for (const layer of buildClusterLayers('works')) {
      expect(layer.filter).toEqual(['has', 'point_count']);
    }
  });

  test('circle radius steps up with point count', () => {
    const [circle] = buildClusterLayers('works');
    const radius = circle.paint!['circle-radius'] as unknown[];
    expect(radius[0]).toBe('step');
    expect(radius).toContain(10);
    expect(radius).toContain(50);
  });

  test('count label reads point_count_abbreviated', () => {
    const [, count] = buildClusterLayers('works');
    expect(count.layout!['text-field']).toEqual(['get', 'point_count_abbreviated']);
  });
});
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `pnpm vitest run tests/unit/clusterLayers.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/map/clusterLayers"`

- [ ] **Step 3: كتابة التنفيذ**

`src/map/clusterLayers.ts`:

```ts
import type { LayerSpecification } from 'maplibre-gl';
import { COLORS, SIZES } from '../styles/tokens';

const CLUSTERED = ['has', 'point_count'] as const;

export const CLUSTER_OPTIONS = {
  cluster: true as const,
  clusterRadius: 50,
  clusterMaxZoom: 14,
  clusterMinPoints: 2,
  clusterProperties: {
    max_severity: ['max', ['coalesce', ['get', 'severity'], 0]],
  },
};

export function buildClusterLayers(source: string): LayerSpecification[] {
  const circle = {
    id: `${source}-clusters`,
    type: 'circle',
    source,
    filter: CLUSTERED,
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        COLORS.clusterSmall,
        10,
        COLORS.clusterMedium,
        50,
        COLORS.clusterLarge,
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        SIZES.clusterRadiusSmall,
        10,
        SIZES.clusterRadiusMedium,
        50,
        SIZES.clusterRadiusLarge,
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  };

  const count = {
    id: `${source}-cluster-count`,
    type: 'symbol',
    source,
    filter: CLUSTERED,
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 12,
      'text-font': ['Noto Sans Bold'],
      'text-allow-overlap': true,
    },
    paint: { 'text-color': COLORS.clusterText },
  };

  return [circle, count] as unknown as LayerSpecification[];
}
```

- [ ] **Step 4: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm vitest run tests/unit/clusterLayers.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/map/clusterLayers.ts tests/unit/clusterLayers.test.ts
git commit -m "feat: add supercluster-backed cluster circle layers"
```

---

## Task 7: تعبيرات الفلترة الزمنية (زر "Today")

**Files:**
- Create: `onenetwork-clone/src/map/filters.ts`
- Test: `onenetwork-clone/tests/unit/filters.test.ts`

**Interfaces:**
- Consumes: لا شيء
- Produces:
  ```ts
  type DateRangePreset = 'today' | 'week' | 'month' | 'all';
  function toEpochRange(preset: DateRangePreset, nowMs: number): { from: number; to: number } | null
  function buildDateFilter(range: { from: number; to: number } | null): unknown[] | null
  function buildGroupFilter(enabledGroups: string[]): unknown[] | null
  ```

- [ ] **Step 1: كتابة الاختبار الفاشل**

`tests/unit/filters.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { toEpochRange, buildDateFilter, buildGroupFilter } from '../../src/map/filters';

const NOW = Date.UTC(2026, 6, 24, 12, 0, 0); // 2026-07-24T12:00:00Z

describe('toEpochRange', () => {
  test('today spans midnight to midnight UTC', () => {
    const range = toEpochRange('today', NOW)!;
    expect(range.from).toBe(Date.UTC(2026, 6, 24, 0, 0, 0));
    expect(range.to).toBe(Date.UTC(2026, 6, 25, 0, 0, 0));
  });

  test('week spans seven days forward from today start', () => {
    const range = toEpochRange('week', NOW)!;
    expect(range.to - range.from).toBe(7 * 24 * 3600 * 1000);
  });

  test('all returns null so no date filter is applied', () => {
    expect(toEpochRange('all', NOW)).toBeNull();
  });
});

describe('buildDateFilter', () => {
  test('returns an overlap expression, not a containment one', () => {
    const filter = buildDateFilter({ from: 100, to: 200 })!;
    // feature overlaps window when start < to AND end > from
    expect(filter).toEqual([
      'all',
      ['<', ['get', 'start_ts'], 200],
      ['>', ['get', 'end_ts'], 100],
    ]);
  });

  test('returns null for a null range', () => {
    expect(buildDateFilter(null)).toBeNull();
  });
});

describe('buildGroupFilter', () => {
  test('matches features whose group is enabled', () => {
    expect(buildGroupFilter(['roadworks', 'closures'])).toEqual([
      'in',
      ['get', 'group'],
      ['literal', ['roadworks', 'closures']],
    ]);
  });

  test('returns a never-match expression when nothing is enabled', () => {
    expect(buildGroupFilter([])).toEqual(['==', 1, 0]);
  });
});
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `pnpm vitest run tests/unit/filters.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/map/filters"`

- [ ] **Step 3: كتابة التنفيذ**

`src/map/filters.ts`:

```ts
export type DateRangePreset = 'today' | 'week' | 'month' | 'all';

export interface EpochRange {
  from: number;
  to: number;
}

const DAY_MS = 24 * 3600 * 1000;

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function toEpochRange(preset: DateRangePreset, nowMs: number): EpochRange | null {
  if (preset === 'all') return null;
  const from = startOfUtcDay(nowMs);
  const spans: Record<Exclude<DateRangePreset, 'all'>, number> = {
    today: 1,
    week: 7,
    month: 30,
  };
  return { from, to: from + spans[preset] * DAY_MS };
}

export function buildDateFilter(range: EpochRange | null): unknown[] | null {
  if (!range) return null;
  return [
    'all',
    ['<', ['get', 'start_ts'], range.to],
    ['>', ['get', 'end_ts'], range.from],
  ];
}

export function buildGroupFilter(enabledGroups: string[]): unknown[] {
  if (enabledGroups.length === 0) return ['==', 1, 0];
  return ['in', ['get', 'group'], ['literal', enabledGroups]];
}
```

- [ ] **Step 4: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm vitest run tests/unit/filters.test.ts`
Expected: PASS — 7 passed

- [ ] **Step 5: Commit**

```bash
git add src/map/filters.ts tests/unit/filters.test.ts
git commit -m "feat: add date range and group filter expressions"
```

---

## Task 8: تطبيع البيانات — أي مصدر إلى شكل موحّد

**Files:**
- Create: `onenetwork-clone/src/data/types.ts`
- Create: `onenetwork-clone/src/data/normalize.ts`
- Create: `onenetwork-clone/src/data/adapters/generic.ts`
- Create: `onenetwork-clone/src/data/adapters/streetManager.ts`
- Test: `onenetwork-clone/tests/unit/normalize.test.ts`

**Interfaces:**
- Consumes: لا شيء
- Produces:
  ```ts
  interface CanonicalProps {
    id: string; group: 'roadworks' | 'closures' | 'incidents' | 'diversions' | 'pois';
    subtype: string; title: string; description: string;
    start_ts: number; end_ts: number; severity: number; promoter: string;
  }
  function normalizeCollection(raw: unknown, adapter: Adapter): FeatureCollection<Geometry, CanonicalProps>
  const genericAdapter: Adapter
  const streetManagerAdapter: Adapter
  ```

- [ ] **Step 1: كتابة الاختبار الفاشل**

`tests/unit/normalize.test.ts`:

```ts
import { describe, test, expect } from 'vitest';
import { normalizeCollection } from '../../src/data/normalize';
import { genericAdapter } from '../../src/data/adapters/generic';
import { streetManagerAdapter } from '../../src/data/adapters/streetManager';

describe('normalizeCollection with genericAdapter', () => {
  const raw = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [46.6753, 24.7136] },
        properties: {
          id: 'W-1',
          group: 'roadworks',
          subtype: 'emergency',
          title: 'Water main repair',
          start: '2026-07-24T06:00:00Z',
          end: '2026-07-28T18:00:00Z',
          severity: 3,
        },
      },
    ],
  };

  test('converts ISO dates to epoch milliseconds', () => {
    const [feature] = normalizeCollection(raw, genericAdapter).features;
    expect(feature.properties.start_ts).toBe(Date.parse('2026-07-24T06:00:00Z'));
    expect(feature.properties.end_ts).toBe(Date.parse('2026-07-28T18:00:00Z'));
  });

  test('keeps geometry untouched', () => {
    const [feature] = normalizeCollection(raw, genericAdapter).features;
    expect(feature.geometry).toEqual({ type: 'Point', coordinates: [46.6753, 24.7136] });
  });

  test('defaults severity to 0 when absent', () => {
    const noSeverity = {
      ...raw,
      features: [
        { ...raw.features[0], properties: { ...raw.features[0].properties, severity: undefined } },
      ],
    };
    const [feature] = normalizeCollection(noSeverity, genericAdapter).features;
    expect(feature.properties.severity).toBe(0);
  });

  test('drops features with no geometry instead of throwing', () => {
    const broken = {
      ...raw,
      features: [...raw.features, { type: 'Feature', geometry: null, properties: { id: 'X' } }],
    };
    expect(normalizeCollection(broken, genericAdapter).features).toHaveLength(1);
  });

  test('falls back to pois for an unknown group value', () => {
    const odd = {
      ...raw,
      features: [
        { ...raw.features[0], properties: { ...raw.features[0].properties, group: 'nonsense' } },
      ],
    };
    const [feature] = normalizeCollection(odd, genericAdapter).features;
    expect(feature.properties.group).toBe('pois');
  });
});

describe('normalizeCollection with streetManagerAdapter', () => {
  const raw = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-2.13, 52.58], [-2.12, 52.59]] },
        properties: {
          permit_reference_number: 'PRM-42',
          work_category: 'Immediate - urgent',
          street_name: 'Bridgnorth Road',
          proposed_start_date: '2026-07-24T00:00:00.000Z',
          proposed_end_date: '2026-07-30T00:00:00.000Z',
          promoter_organisation: 'Severn Trent',
        },
      },
    ],
  };

  test('maps permit reference to id', () => {
    const [feature] = normalizeCollection(raw, streetManagerAdapter).features;
    expect(feature.properties.id).toBe('PRM-42');
  });

  test('maps an immediate work category to the emergency subtype', () => {
    const [feature] = normalizeCollection(raw, streetManagerAdapter).features;
    expect(feature.properties.subtype).toBe('emergency');
    expect(feature.properties.group).toBe('roadworks');
  });

  test('carries the promoter through for the popup', () => {
    const [feature] = normalizeCollection(raw, streetManagerAdapter).features;
    expect(feature.properties.promoter).toBe('Severn Trent');
  });
});
```

- [ ] **Step 2: تشغيل الاختبار للتأكد من فشله**

Run: `pnpm vitest run tests/unit/normalize.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/data/normalize"`

- [ ] **Step 3: كتابة الأنواع**

`src/data/types.ts`:

```ts
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export const GROUPS = ['roadworks', 'closures', 'incidents', 'diversions', 'pois'] as const;
export type Group = (typeof GROUPS)[number];

export interface CanonicalProps {
  id: string;
  group: Group;
  subtype: string;
  title: string;
  description: string;
  start_ts: number;
  end_ts: number;
  severity: number;
  promoter: string;
}

export type CanonicalFeature = Feature<Geometry, CanonicalProps>;
export type CanonicalCollection = FeatureCollection<Geometry, CanonicalProps>;

export interface Adapter {
  toCanonical(properties: Record<string, unknown>): CanonicalProps;
}
```

- [ ] **Step 4: كتابة المحوّل العام**

`src/data/adapters/generic.ts`:

```ts
import { GROUPS, type Adapter, type CanonicalProps, type Group } from '../types';

function toGroup(value: unknown): Group {
  return GROUPS.includes(value as Group) ? (value as Group) : 'pois';
}

function toEpoch(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function toText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export const genericAdapter: Adapter = {
  toCanonical(p: Record<string, unknown>): CanonicalProps {
    return {
      id: toText(p.id, crypto.randomUUID()),
      group: toGroup(p.group),
      subtype: toText(p.subtype, 'default'),
      title: toText(p.title, 'Untitled'),
      description: toText(p.description),
      start_ts: toEpoch(p.start ?? p.start_ts),
      end_ts: toEpoch(p.end ?? p.end_ts),
      severity: typeof p.severity === 'number' ? p.severity : 0,
      promoter: toText(p.promoter),
    };
  },
};
```

- [ ] **Step 5: كتابة محوّل Street Manager**

`src/data/adapters/streetManager.ts`:

```ts
import type { Adapter, CanonicalProps } from '../types';

function toEpoch(value: unknown): number {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

const CATEGORY_TO_SUBTYPE: Record<string, string> = {
  'immediate - urgent': 'emergency',
  'immediate - emergency': 'emergency',
  major: 'development',
  standard: 'default',
  minor: 'default',
};

const CATEGORY_TO_SEVERITY: Record<string, number> = {
  emergency: 3,
  development: 2,
  default: 1,
};

export const streetManagerAdapter: Adapter = {
  toCanonical(p: Record<string, unknown>): CanonicalProps {
    const category = toText(p.work_category).toLowerCase();
    const subtype = CATEGORY_TO_SUBTYPE[category] ?? 'default';
    return {
      id: toText(p.permit_reference_number, toText(p.work_reference_number, 'unknown')),
      group: 'roadworks',
      subtype,
      title: toText(p.street_name, 'Roadworks'),
      description: toText(p.description_of_work, toText(p.work_category)),
      start_ts: toEpoch(p.actual_start_date ?? p.proposed_start_date),
      end_ts: toEpoch(p.actual_end_date ?? p.proposed_end_date),
      severity: CATEGORY_TO_SEVERITY[subtype] ?? 1,
      promoter: toText(p.promoter_organisation),
    };
  },
};
```

- [ ] **Step 6: كتابة المطبّع**

`src/data/normalize.ts`:

```ts
import type { Feature, Geometry } from 'geojson';
import type { Adapter, CanonicalCollection, CanonicalFeature } from './types';

interface RawCollection {
  features?: unknown[];
}

function hasGeometry(feature: unknown): feature is Feature<Geometry> {
  return (
    typeof feature === 'object' &&
    feature !== null &&
    'geometry' in feature &&
    (feature as { geometry: unknown }).geometry !== null
  );
}

export function normalizeCollection(raw: unknown, adapter: Adapter): CanonicalCollection {
  const source = (raw ?? {}) as RawCollection;
  const input = Array.isArray(source.features) ? source.features : [];

  const features: CanonicalFeature[] = [];
  for (const item of input) {
    if (!hasGeometry(item)) continue;
    const properties = (item.properties ?? {}) as Record<string, unknown>;
    features.push({
      type: 'Feature',
      geometry: item.geometry,
      properties: adapter.toCanonical(properties),
    });
  }

  return { type: 'FeatureCollection', features };
}
```

- [ ] **Step 7: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm vitest run tests/unit/normalize.test.ts`
Expected: PASS — 8 passed

- [ ] **Step 8: Commit**

```bash
git add src/data/ tests/unit/normalize.test.ts
git commit -m "feat: add canonical feature normalization with two source adapters"
```

---

## Task 9: تركيب الخريطة وتشغيلها فعلياً

**Files:**
- Create: `onenetwork-clone/src/map/createMap.ts`
- Create: `onenetwork-clone/src/map/install.ts`
- Create: `onenetwork-clone/src/main.ts`
- Create: `onenetwork-clone/index.html`
- Create: `onenetwork-clone/src/styles/app.css`
- Create: `onenetwork-clone/db/seed/works.sample.geojson`
- Create: `onenetwork-clone/playwright.config.ts`
- Test: `onenetwork-clone/tests/e2e/map-loads.spec.ts`

**Interfaces:**
- Consumes: `resolveBasemapStyle` (المهمة 2)، `buildAllLayers` (المهمة 4)، `buildClusterLayers` + `CLUSTER_OPTIONS` (المهمة 6)، `normalizeCollection` + `genericAdapter` (المهمة 8)، `readEnv` (المهمة 1)
- Produces: `createMap(container: HTMLElement, env: AppEnv): Promise<maplibregl.Map>` و `installDataLayers(map: maplibregl.Map, sourceId: string, data: CanonicalCollection): void`

- [ ] **Step 1: تثبيت Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: كتابة بيانات البذرة**

`db/seed/works.sample.geojson` — ٣ ميزات تكفي لإثبات الخط والأيقونة والتجميع:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "LineString", "coordinates": [[46.6700, 24.7100], [46.6760, 24.7150]] },
      "properties": {
        "id": "W-1", "group": "roadworks", "subtype": "emergency",
        "title": "إصلاح خط مياه رئيسي", "description": "إغلاق مسار واحد",
        "start": "2026-07-24T06:00:00Z", "end": "2026-07-28T18:00:00Z",
        "severity": 3, "promoter": "شركة المياه الوطنية"
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [46.6820, 24.7190] },
      "properties": {
        "id": "C-1", "group": "closures", "subtype": "default",
        "title": "إغلاق تقاطع", "description": "إغلاق كامل حتى نهاية الأعمال",
        "start": "2026-07-24T00:00:00Z", "end": "2026-08-01T00:00:00Z",
        "severity": 3, "promoter": "أمانة الرياض"
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [46.6825, 24.7195] },
      "properties": {
        "id": "C-2", "group": "incidents", "subtype": "default",
        "title": "حادث مروري", "description": "تصادم — مسار مغلق",
        "start": "2026-07-24T08:00:00Z", "end": "2026-07-24T14:00:00Z",
        "severity": 2, "promoter": "المرور"
      }
    }
  ]
}
```

- [ ] **Step 3: كتابة `index.html`**

```html
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>خريطة الأعمال الحية</title>
    <link rel="stylesheet" href="/src/styles/app.css" />
  </head>
  <body>
    <main>
      <div id="map" role="application" aria-label="خريطة أعمال الطرق والإغلاقات"></div>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: كتابة `app.css`**

```css
@import 'maplibre-gl/dist/maplibre-gl.css';

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, main, #map { width: 100%; height: 100%; }
body { font-family: system-ui, 'Segoe UI', sans-serif; }
```

- [ ] **Step 5: كتابة `createMap.ts`**

```ts
import maplibregl, { type Map } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import type { AppEnv } from '../env';
import { resolveBasemapStyle } from './basemap';

const RIYADH: [number, number] = [46.6753, 24.7136];

let pmtilesRegistered = false;

function registerPmtilesProtocol(): void {
  if (pmtilesRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesRegistered = true;
}

export function createMap(container: HTMLElement, env: AppEnv): Promise<Map> {
  if (env.basemapProvider === 'protomaps') registerPmtilesProtocol();

  const map = new maplibregl.Map({
    container,
    style: resolveBasemapStyle(env),
    center: RIYADH,
    zoom: 12,
    attributionControl: { compact: true },
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), 'top-right');

  return new Promise((resolve, reject) => {
    map.once('load', () => resolve(map));
    map.once('error', (event) => reject(event.error ?? new Error('map failed to load')));
  });
}
```

تثبيت اعتماد pmtiles:

```bash
pnpm add pmtiles
```

- [ ] **Step 6: كتابة `install.ts`**

```ts
import type { Map } from 'maplibre-gl';
import type { CanonicalCollection } from '../data/types';
import { buildAllLayers } from './registry';
import { buildClusterLayers, CLUSTER_OPTIONS } from './clusterLayers';

export function installDataLayers(
  map: Map,
  sourceId: string,
  data: CanonicalCollection
): void {
  map.addSource(sourceId, { type: 'geojson', data, ...CLUSTER_OPTIONS });

  for (const layer of buildAllLayers(sourceId)) {
    map.addLayer(layer);
  }
  for (const layer of buildClusterLayers(sourceId)) {
    map.addLayer(layer);
  }
}
```

- [ ] **Step 7: كتابة `main.ts`**

```ts
import { readEnv } from './env';
import { createMap } from './map/createMap';
import { installDataLayers } from './map/install';
import { normalizeCollection } from './data/normalize';
import { genericAdapter } from './data/adapters/generic';

async function bootstrap(): Promise<void> {
  const container = document.getElementById('map');
  if (!container) throw new Error('#map container missing');

  const env = readEnv(import.meta.env as Record<string, string | undefined>);
  const map = await createMap(container, env);

  const response = await fetch(env.dataUrl);
  if (!response.ok) throw new Error(`data fetch failed: ${response.status}`);
  const data = normalizeCollection(await response.json(), genericAdapter);

  installDataLayers(map, 'works', data);
  (window as unknown as { __map: unknown }).__map = map;
}

bootstrap().catch((error: unknown) => {
  console.error('[bootstrap]', error);
  document.body.insertAdjacentHTML(
    'beforeend',
    '<p role="alert" style="padding:1rem">تعذّر تحميل الخريطة. راجع الإعدادات.</p>'
  );
});
```

- [ ] **Step 8: كتابة `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
  webServer: { command: 'pnpm dev', url: 'http://localhost:5173', reuseExistingServer: true },
});
```

- [ ] **Step 9: كتابة اختبار E2E الفاشل**

`tests/e2e/map-loads.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('map renders a WebGL canvas', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#map canvas')).toBeVisible({ timeout: 15000 });
});

test('all registry layers are installed on the map', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__map?.isStyleLoaded(), null, { timeout: 15000 });

  const ids = await page.evaluate(() =>
    (window as any).__map.getStyle().layers.map((l: { id: string }) => l.id)
  );

  expect(ids).toContain('roadworks-realtime-lines-casing');
  expect(ids).toContain('roadworks-realtime-symbols');
  expect(ids).toContain('closures-restrictions-realtime-symbols');
  expect(ids).toContain('works-clusters');
});

test('no console errors during load', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto('/');
  await page.waitForTimeout(4000);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 10: تشغيل E2E للتأكد من فشله ثم نجاحه**

Run: `pnpm exec playwright test`
Expected أولاً: FAIL (الملفات غير مكتملة أو `.env` غير مضبوط)
بعد ضبط `.env` من `.env.example` وتشغيل `pnpm sprite`:
Expected: PASS — 3 passed

- [ ] **Step 11: Commit**

```bash
git add index.html src/main.ts src/map/createMap.ts src/map/install.ts src/styles/app.css db/seed/ playwright.config.ts tests/e2e/map-loads.spec.ts
git commit -m "feat: bootstrap live map with data layers and e2e coverage"
```

---

## Task 10: التفاعل — النقر، البوب-أب، فرد التجميعات

**Files:**
- Create: `onenetwork-clone/src/map/interactions.ts`
- Modify: `onenetwork-clone/src/main.ts` (سطر واحد: استدعاء `installInteractions`)
- Test: `onenetwork-clone/tests/e2e/interactions.spec.ts`

**Interfaces:**
- Consumes: `LAYER_GROUPS` من `src/map/registry.ts` (المهمة 4)
- Produces: `installInteractions(map: maplibregl.Map, sourceId: string): void`

- [ ] **Step 1: كتابة `interactions.ts`**

```ts
import maplibregl, { type Map, type MapGeoJSONFeature } from 'maplibre-gl';
import { LAYER_GROUPS } from './registry';

function symbolLayerIds(): string[] {
  return LAYER_GROUPS.flatMap((group) => group.configs.map((c) => `${c.name}-symbols`));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string
  );
}

function formatDate(ms: number): string {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium' }).format(new Date(ms));
}

function popupHtml(feature: MapGeoJSONFeature): string {
  const p = feature.properties as Record<string, string | number>;
  return `
    <article class="works-popup">
      <h3>${escapeHtml(String(p.title ?? ''))}</h3>
      <p>${escapeHtml(String(p.description ?? ''))}</p>
      <dl>
        <dt>من</dt><dd>${formatDate(Number(p.start_ts))}</dd>
        <dt>إلى</dt><dd>${formatDate(Number(p.end_ts))}</dd>
        <dt>الجهة</dt><dd>${escapeHtml(String(p.promoter ?? '—'))}</dd>
      </dl>
    </article>`;
}

export function installInteractions(map: Map, sourceId: string): void {
  const symbols = symbolLayerIds();

  for (const layerId of symbols) {
    map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
  }

  map.on('click', (event) => {
    const hits = map.queryRenderedFeatures(event.point, { layers: symbols });
    const feature = hits[0];
    if (!feature) return;
    new maplibregl.Popup({ closeButton: true, maxWidth: '320px' })
      .setLngLat(event.lngLat)
      .setHTML(popupHtml(feature))
      .addTo(map);
  });

  map.on('click', `${sourceId}-clusters`, (event) => {
    const feature = map.queryRenderedFeatures(event.point, {
      layers: [`${sourceId}-clusters`],
    })[0];
    if (!feature) return;

    const clusterId = feature.properties?.cluster_id as number;
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
    void source.getClusterExpansionZoom(clusterId).then((zoom) => {
      map.easeTo({
        center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom,
        duration: 400,
      });
    });
  });
}
```

- [ ] **Step 2: توصيلها في `main.ts`**

بعد سطر `installDataLayers(map, 'works', data);` أضف:

```ts
  installInteractions(map, 'works');
```

وفي أعلى الملف:

```ts
import { installInteractions } from './map/interactions';
```

- [ ] **Step 3: إضافة تنسيق البوب-أب في `app.css`**

```css
.works-popup h3 { font-size: 1rem; margin-bottom: 0.35rem; }
.works-popup p { font-size: 0.85rem; color: #555; margin-bottom: 0.5rem; }
.works-popup dl { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.6rem; font-size: 0.8rem; }
.works-popup dt { font-weight: 600; color: #333; }
```

- [ ] **Step 4: كتابة اختبار E2E**

`tests/e2e/interactions.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('clicking a feature opens a popup with its title', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__map?.isStyleLoaded(), null, { timeout: 15000 });

  const point = await page.evaluate(() => {
    const map = (window as any).__map;
    const p = map.project([46.6820, 24.7190]);
    return { x: p.x, y: p.y };
  });

  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.works-popup h3')).toBeVisible({ timeout: 5000 });
});

test('popup escapes HTML in feature text', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__map?.isStyleLoaded(), null, { timeout: 15000 });

  const html = await page.evaluate(() => {
    const map = (window as any).__map;
    const p = map.project([46.6820, 24.7190]);
    map.fire('click', { point: p, lngLat: map.unproject(p) });
    return document.querySelector('.works-popup')?.innerHTML ?? '';
  });

  expect(html).not.toContain('<script');
});
```

- [ ] **Step 5: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm exec playwright test tests/e2e/interactions.spec.ts`
Expected: PASS — 2 passed

- [ ] **Step 6: Commit**

```bash
git add src/map/interactions.ts src/main.ts src/styles/app.css tests/e2e/interactions.spec.ts
git commit -m "feat: add popup and cluster expansion interactions"
```

---

## Task 11: لوحة التحكم — الفلترة الزمنية وتشغيل/إطفاء الطبقات

**Files:**
- Create: `onenetwork-clone/src/ui/controlPanel.ts`
- Modify: `onenetwork-clone/src/main.ts`
- Modify: `onenetwork-clone/index.html`
- Modify: `onenetwork-clone/src/styles/app.css`
- Test: `onenetwork-clone/tests/e2e/control-panel.spec.ts`

**Interfaces:**
- Consumes: `toEpochRange`, `buildDateFilter`, `buildGroupFilter` من `src/map/filters.ts` (المهمة 7)؛ `LAYER_GROUPS` من `src/map/registry.ts` (المهمة 4)
- Produces: `mountControlPanel(root: HTMLElement, map: maplibregl.Map, nowMs: number): void`

- [ ] **Step 1: إضافة حاوية اللوحة في `index.html`**

داخل `<main>` قبل `<div id="map">`:

```html
      <aside id="control-panel" aria-label="عناصر التحكم بالخريطة"></aside>
```

- [ ] **Step 2: كتابة `controlPanel.ts`**

```ts
import type { Map } from 'maplibre-gl';
import { LAYER_GROUPS } from '../map/registry';
import { toEpochRange, buildDateFilter, type DateRangePreset } from '../map/filters';

const PRESETS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'all', label: 'كل التواريخ' },
];

function layerIdsForGroup(groupId: string): string[] {
  const group = LAYER_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  return group.configs.flatMap((c) => [
    `${c.name}-lines-casing`,
    `${c.name}-lines`,
    `${c.name}-symbols`,
  ]);
}

function allDataLayerIds(): string[] {
  return LAYER_GROUPS.flatMap((g) => layerIdsForGroup(g.id));
}

function applyDateFilter(map: Map, preset: DateRangePreset, nowMs: number): void {
  const filter = buildDateFilter(toEpochRange(preset, nowMs));
  for (const id of allDataLayerIds()) {
    if (!map.getLayer(id)) continue;
    map.setFilter(id, filter as never);
  }
}

function toggleGroup(map: Map, groupId: string, visible: boolean): void {
  for (const id of layerIdsForGroup(groupId)) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }
}

export function mountControlPanel(root: HTMLElement, map: Map, nowMs: number): void {
  root.innerHTML = `
    <label class="panel-field">
      <span>الفترة</span>
      <select id="date-preset">
        ${PRESETS.map((p) => `<option value="${p.value}">${p.label}</option>`).join('')}
      </select>
    </label>
    <fieldset class="panel-field">
      <legend>الطبقات</legend>
      ${LAYER_GROUPS.map(
        (g) => `
        <label class="panel-toggle">
          <input type="checkbox" data-group="${g.id}" checked />
          <span>${g.labelAr}</span>
        </label>`
      ).join('')}
    </fieldset>
  `;

  const select = root.querySelector<HTMLSelectElement>('#date-preset');
  select?.addEventListener('change', () => {
    applyDateFilter(map, select.value as DateRangePreset, nowMs);
  });

  for (const input of root.querySelectorAll<HTMLInputElement>('input[data-group]')) {
    input.addEventListener('change', () => {
      toggleGroup(map, input.dataset.group as string, input.checked);
    });
  }

  applyDateFilter(map, 'today', nowMs);
}
```

**ملاحظة سلوكية مقصودة:** الفلتر الزمني الافتراضي `today` — نفس ما تعرضه واجهتهم عند الفتح.

- [ ] **Step 3: توصيلها في `main.ts`**

بعد `installInteractions(map, 'works');`:

```ts
  const panel = document.getElementById('control-panel');
  if (panel) mountControlPanel(panel, map, Date.now());
```

وفي الأعلى:

```ts
import { mountControlPanel } from './ui/controlPanel';
```

- [ ] **Step 4: تنسيق اللوحة في `app.css`**

```css
main { position: relative; }
#control-panel {
  position: absolute; inset-inline-start: 12px; inset-block-start: 12px;
  z-index: 2; width: 260px; padding: 14px;
  background: #fff; border-radius: 12px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.12);
  display: grid; gap: 12px;
}
.panel-field { display: grid; gap: 6px; font-size: 0.85rem; }
.panel-field select { padding: 6px 8px; border: 1px solid #ddd; border-radius: 8px; }
.panel-toggle { display: flex; align-items: center; gap: 8px; padding: 3px 0; cursor: pointer; }
.panel-toggle input { accent-color: #1971c2; }
fieldset.panel-field { border: 0; }
fieldset.panel-field legend { font-weight: 600; margin-bottom: 6px; }

@media (max-width: 640px) {
  #control-panel { inset-inline: 12px; width: auto; }
}
```

- [ ] **Step 5: كتابة اختبار E2E**

`tests/e2e/control-panel.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('date preset defaults to today', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#date-preset')).toHaveValue('today');
});

test('unchecking a group hides its layers', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__map?.isStyleLoaded(), null, { timeout: 15000 });

  await page.uncheck('input[data-group="roadworks"]');

  const visibility = await page.evaluate(() =>
    (window as any).__map.getLayoutProperty('roadworks-realtime-symbols', 'visibility')
  );
  expect(visibility).toBe('none');
});

test('switching to all dates clears the date filter', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__map?.isStyleLoaded(), null, { timeout: 15000 });

  await page.selectOption('#date-preset', 'all');

  const filter = await page.evaluate(() =>
    (window as any).__map.getFilter('roadworks-realtime-symbols')
  );
  expect(filter).toBeUndefined();
});
```

- [ ] **Step 6: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm exec playwright test tests/e2e/control-panel.spec.ts`
Expected: PASS — 3 passed

- [ ] **Step 7: Commit**

```bash
git add src/ui/controlPanel.ts src/main.ts index.html src/styles/app.css tests/e2e/control-panel.spec.ts
git commit -m "feat: add control panel with date presets and layer toggles"
```

---

## Task 12: PostGIS و Martin — التبديل إلى vector tiles

يُنفَّذ عند تجاوز البيانات ~١٠٠٠٠ ميزة. قبل ذلك GeoJSON أسرع وأبسط.

**Files:**
- Create: `onenetwork-clone/docker-compose.yml`
- Create: `onenetwork-clone/db/001_schema.sql`
- Create: `onenetwork-clone/db/002_tile_functions.sql`
- Create: `onenetwork-clone/martin/config.yaml`
- Modify: `onenetwork-clone/src/map/install.ts`
- Test: `onenetwork-clone/tests/e2e/vector-tiles.spec.ts`

**Interfaces:**
- Consumes: `buildAllLayers(source, sourceLayer)` (المهمة 4)، `CLUSTER_OPTIONS` (المهمة 6)
- Produces: `installVectorTileLayers(map: maplibregl.Map, tileServer: string): void`

- [ ] **Step 1: كتابة `docker-compose.yml`**

```yaml
services:
  postgis:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: works
      POSTGRES_USER: works
      POSTGRES_PASSWORD: works_dev_only
    ports: ['5432:5432']
    volumes:
      - ./db:/docker-entrypoint-initdb.d:ro
      - pgdata:/var/lib/postgresql/data

  martin:
    image: ghcr.io/maplibre/martin:latest
    depends_on: [postgis]
    environment:
      DATABASE_URL: postgres://works:works_dev_only@postgis/works
    ports: ['3000:3000']
    volumes:
      - ./martin/config.yaml:/config.yaml:ro
    command: ['--config', '/config.yaml']

volumes:
  pgdata:
```

**أمان:** `works_dev_only` كلمة مرور تطوير محلي فقط. الإنتاج يقرأها من مدير أسرار، لا من الملف.

- [ ] **Step 2: كتابة المخطط**

`db/001_schema.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS works_features (
  id          text PRIMARY KEY,
  "group"     text NOT NULL,
  subtype     text NOT NULL DEFAULT 'default',
  title       text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  start_ts    bigint NOT NULL DEFAULT 0,
  end_ts      bigint NOT NULL DEFAULT 0,
  severity    smallint NOT NULL DEFAULT 0,
  promoter    text NOT NULL DEFAULT '',
  geom        geometry(Geometry, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS works_features_geom_idx ON works_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS works_features_time_idx ON works_features (start_ts, end_ts);
CREATE INDEX IF NOT EXISTS works_features_group_idx ON works_features ("group");
```

- [ ] **Step 3: كتابة دالة البلاطات**

`db/002_tile_functions.sql`:

```sql
CREATE OR REPLACE FUNCTION works_tiles(
  z integer, x integer, y integer, query_params json
) RETURNS bytea AS $$
DECLARE
  mvt bytea;
  ts_from bigint := COALESCE((query_params->>'from')::bigint, 0);
  ts_to   bigint := COALESCE((query_params->>'to')::bigint, 9223372036854775807);
BEGIN
  SELECT INTO mvt ST_AsMVT(tile, 'works_tiles', 4096, 'geom') FROM (
    SELECT
      ST_AsMVTGeom(
        ST_Transform(ST_CurveToLine(f.geom), 3857),
        ST_TileEnvelope(z, x, y),
        4096, 64, true
      ) AS geom,
      f.id, f."group", f.subtype, f.title, f.description,
      f.start_ts, f.end_ts, f.severity, f.promoter
    FROM works_features f
    WHERE ST_Transform(f.geom, 3857) && ST_TileEnvelope(z, x, y)
      AND f.start_ts < ts_to
      AND f.end_ts   > ts_from
  ) AS tile
  WHERE tile.geom IS NOT NULL;

  RETURN COALESCE(mvt, ''::bytea);
END
$$ LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE;
```

- [ ] **Step 4: كتابة إعداد Martin**

`martin/config.yaml`:

```yaml
listen_addresses: '0.0.0.0:3000'

postgres:
  connection_string: ${DATABASE_URL}
  pool_size: 20
  auto_publish:
    tables: false
    functions: true

  functions:
    works_tiles:
      schema: public
      function: works_tiles
      minzoom: 6
      maxzoom: 18
```

- [ ] **Step 5: تشغيل المكدس والتحقق**

```bash
docker compose up -d
curl -s http://localhost:3000/catalog
```

Expected: JSON يحوي `"works_tiles"`

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/works_tiles/12/2445/1673"
```

Expected: `200`

- [ ] **Step 6: إضافة دالة التركيب بالبلاطات**

في `src/map/install.ts` أضف:

```ts
const TILE_SOURCE_LAYER = 'works_tiles';

export function installVectorTileLayers(map: Map, tileServer: string): void {
  map.addSource('works-tiles', {
    type: 'vector',
    tiles: [`${tileServer}/works_tiles/{z}/{x}/{y}`],
    minzoom: 6,
    maxzoom: 18,
  });

  for (const layer of buildAllLayers('works-tiles', TILE_SOURCE_LAYER)) {
    map.addLayer(layer);
  }
}
```

وأضف الاستيراد أعلى الملف إن لم يكن موجوداً:

```ts
import type { Map } from 'maplibre-gl';
```

**ملاحظة مقصودة:** التجميع غير متاح على مصادر vector tile في MapLibre. عند التبديل إلى البلاطات يُستبدل التجميع بالفرز عبر `symbol-sort-key` والـ `minzoom` — وهذا بالضبط ما تفعله one.network (`tilesDisabled: true` للزائر المجهول الذي يحصل على GeoJSON مُجمَّع، والبلاطات للمستخدم المسجَّل).

- [ ] **Step 7: كتابة اختبار البلاطات**

`tests/e2e/vector-tiles.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('martin serves a tile catalog', async ({ request }) => {
  const response = await request.get('http://localhost:3000/catalog');
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain('works_tiles');
});

test('martin returns a protobuf tile for a covered area', async ({ request }) => {
  const response = await request.get('http://localhost:3000/works_tiles/12/2445/1673');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('protobuf');
});
```

- [ ] **Step 8: تشغيل الاختبار للتأكد من نجاحه**

Run: `pnpm exec playwright test tests/e2e/vector-tiles.spec.ts`
Expected: PASS — 2 passed

- [ ] **Step 9: Commit**

```bash
git add docker-compose.yml db/ martin/ src/map/install.ts tests/e2e/vector-tiles.spec.ts
git commit -m "feat: add postgis schema and martin vector tile source"
```

---

## Task 13: الأداء وإمكانية الوصول والانحدار البصري

**Files:**
- Create: `onenetwork-clone/tests/e2e/visual.spec.ts`
- Create: `onenetwork-clone/tests/e2e/a11y.spec.ts`
- Modify: `onenetwork-clone/src/styles/app.css`

**Interfaces:**
- Consumes: كل ما سبق
- Produces: لقطات مرجعية في `tests/e2e/visual.spec.ts-snapshots/`

- [ ] **Step 1: تثبيت أداة فحص الوصول**

```bash
pnpm add -D @axe-core/playwright
```

- [ ] **Step 2: إضافة دعم تقليل الحركة**

في `app.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: كتابة اختبار الانحدار البصري**

`tests/e2e/visual.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const bp of BREAKPOINTS) {
  test(`layout is stable at ${bp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__map?.isStyleLoaded(), null, { timeout: 15000 });
    await page.waitForTimeout(1500);
    await expect(page).toHaveScreenshot(`${bp.name}.png`, { maxDiffPixelRatio: 0.02 });
  });

  test(`no horizontal overflow at ${bp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });
}
```

- [ ] **Step 4: كتابة اختبار الوصول**

`tests/e2e/a11y.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('no critical accessibility violations', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__map?.isStyleLoaded(), null, { timeout: 15000 });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .exclude('.maplibregl-canvas')
    .analyze();

  const serious = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''));
  expect(serious.map((v) => v.id)).toEqual([]);
});

test('control panel is fully keyboard reachable', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const tag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
  expect(['select', 'input', 'button', 'a']).toContain(tag);
});
```

- [ ] **Step 5: توليد اللقطات المرجعية ثم تشغيل الاختبارات**

```bash
pnpm exec playwright test tests/e2e/visual.spec.ts --update-snapshots
pnpm exec playwright test
```

Expected: PASS — كل الاختبارات خضراء

- [ ] **Step 6: التحقق من التغطية**

Run: `pnpm vitest run --coverage`
Expected: تغطية `src/map/` و `src/data/` ≥ 80%

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/visual.spec.ts tests/e2e/a11y.spec.ts src/styles/app.css
git commit -m "test: add visual regression and accessibility coverage"
```

---

## موضوع على جنب — قرارات تحتاج مراجعتك لاحقاً

لا تُطرح الآن كأسئلة. الشيفرة أعلاه مكتوبة بحيث لا يعطّلها أيٌّ منها. تُراجَع عند الاستعداد:

1. **اختيار مزوّد الخريطة الأساسية.** الشيفرة تدعم MapTiler و Protomaps بالتساوي عبر `VITE_BASEMAP_PROVIDER`. القرار = مقارنة التكاليف في القسم أعلاه بعد التحقق من الأسعار الحالية. لا تغيير شيفرة مطلوب.

2. **مصدر البيانات الفعلي.** المحوّلان جاهزان: `genericAdapter` لأي GeoJSON، و `streetManagerAdapter` لتنسيق DfT. للسعودية يُكتب محوّل ثالث في `src/data/adapters/` بنفس واجهة `Adapter` — ملف واحد، لا مساس بأي شيء آخر.

3. **طبقة الازدحام المروري.** غير مضمّنة (تكلفة). إضافتها = مصدر واحد + طبقة واحدة عند اتخاذ القرار.

4. **صور القمر الصناعي.** غير مضمّنة. تُضاف كـ raster source عند الحاجة.

5. **المصادقة وصلاحيات الجهات.** الخطة تبني الخريطة العامة فقط — بلا تسجيل دخول ولا رفع تصاريح. نظام التصاريح مشروع مستقل بخطة منفصلة.

6. **الأيقونات.** الأيقونات العشر في المهمة 5 وظيفية لا نهائية. تُستبدل بمجموعة مصممة عند توفر الهوية البصرية — تغيير ملفات SVG وإعادة `pnpm sprite`، بلا مساس بالشيفرة.

7. **التوطين والاتجاه.** الواجهة عربية RTL. أسماء الطبقات ومفاتيح البيانات إنجليزية عمداً (تطابق اصطلاح one.network ويسهّل التكامل). إضافة إنجليزية كاملة = ملف ترجمة واحد.

8. **دورة تحديث البيانات.** الخطة تجلب البيانات مرة عند التحميل. التحديث الحي (polling أو SSE) قرار منفصل يعتمد على تردد تغيّر مصدرك.

---

## مراجعة ذاتية

**تغطية المتطلبات:** «نسخ ما عندهم» ← المهام 3 و4 و6 تنسخ نمط الطبقات وأسماءها وإعدادات التجميع حرفياً · «مقارنة كل التكاليف بلا انحياز» ← قسم مقارنة التكاليف يغطي ٧ مزوّدي خرائط أساسية و٥ خوادم بلاطات و٤ مزوّدي ازدحام و٣ حزم كاملة، مع تحذير صريح بعدم الاعتماد قبل التحقق · «ما يحتاج قراري يوضع جانباً» ← قسم «موضوع على جنب» يحوي ٨ قرارات مؤجلة، ولا واحد منها يعطّل التنفيذ.

**فحص العناصر الناقصة:** لا `TBD` ولا «أضف معالجة أخطاء مناسبة» ولا «مشابه للمهمة N». كل خطوة تحوي شيفرتها كاملة.

**اتساق الأنواع:** `TripleConfig` (المهمة 3) تُستهلك بنفس الحقول في المهمة 4 · `CanonicalProps` (المهمة 8) تُقرأ في `interactions.ts` (المهمة 10) بنفس أسماء الحقول `title/description/start_ts/end_ts/promoter` وتطابق أعمدة `works_features` (المهمة 12) · `buildAllLayers(source, sourceLayer?)` تُستدعى بنفس التوقيع في المهمتين 9 و12 · `AppEnv` (المهمة 1) تُستهلك في المهمتين 2 و9 بنفس الحقول.
