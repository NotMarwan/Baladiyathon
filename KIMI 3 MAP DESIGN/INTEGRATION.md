# تكامل خريطة «غرفة التحكم»

المصدر الحي: `presentation/` — هذا المجلد نسخة تسليم مرجعية (Kimi K3 صمم، Claude أكمل ودمج وتحقق).

## الملفات

| ملف | دوره |
|---|---|
| `athar-ownedmap.js` | الوحدة المعاد كتابتها — نفس API القديم بالضبط: `{ styleFor, toRoutingSegments, load(map, geojson, L, onRoadClick), CLASS_AADT, CLASS_LANES }` |
| `athar-map.css` | كل تنسيق الخريطة: المسرح الداكن، التوهج، الدخول المتدرج، النبض، الموجة، الدليل، الأدوات، reduced-motion |
| `screenshots/before-*` | الشكل القديم (بيج مسطح) |
| `screenshots/after-*` | الشكل الجديد (تشغيل Playwright بلا شبكة — صفر طلبات، صفر أخطاء) |

## تهيئة الصفحة المضيفة (سطر واحد كما كان)

```html
<link rel="stylesheet" href="athar-map.css">
...
<script>AtharOwnedMap.load(map, RIYADH_ROADS, L);</script>
```

## ربط اختياري أضافته الصفحة المضيفة (athar-prototype.html)

- غلاف الممر + قلب سماوي `#59d6f2`، الإغلاق `#e5484d`، الانسياب `#34d399`.
- علامة حفر نابضة (`athar-dig-marker` divIcon).
- تدفق اتجاهي على المسار الموصى به (`athar-alt-flow`).
- موجة أحمر←أخضر عند اختيار الجدول: `sweepSegmentGreen(idx)` — stroke-dashoffset عبر rAF، ‏1.2s، تُلغى مع prefers-reduced-motion.
- أجواء اليوم: `renderTimeline` يضبط `#map[data-phase]` (peak/night/day) وCSS يتكفل بالباقي.

## التحقق

- 10 حزم اختبار خضراء (172 اختباراً) — العقد لم يتغير.
- Playwright ‏file:// مع حجب كامل للشبكة: EXTERNAL_REQUESTS: NONE، PAGE_ERRORS: NONE، CONSOLE_ERRORS: NONE.
