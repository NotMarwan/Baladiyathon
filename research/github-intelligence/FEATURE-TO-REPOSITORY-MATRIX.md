# مصفوفة القدرة إلى المستودع

| القدرة | الأفضل الآن | البديل الثاني | البديل الثالث | القرار |
|---|---|---|---|---|
| تحقق مدخلات الخادم | `ajv` | `zod` | `typebox` | Wrap |
| تحقق تصدير مناطق العمل | `WZDx` مع `ajv` | فاحص مخصص | نماذج الولاية | Adopt |
| فهرسة أعمال متغيرة | `rbush` | `flatbush` | `geojson-rbush` | Wrap |
| فهرسة مبانٍ ثابتة | `flatbush` | `rbush` | `kdbush` | Monitor |
| أرشيف بلاطات | `PMTiles` | `FlatGeobuf` | ملفات مخصصة | Wrap |
| تبليط وقت التشغيل | `geojson-vt` | محرك الخريطة المدمج | `tippecanoe` وقت البناء | Monitor |
| بناء بلاطات | `tippecanoe` | `go-pmtiles` | `Planetiler` | Use as Development Tool |
| عمليات جغرافية صغيرة | وحدة مفردة من `Turf` | كود محلي مثبت | `martinez` للقص | Monitor |
| توجيه مرجعي سريع | `OSRM` | `GraphHopper` | `Valhalla` | Use for Verification |
| قيود ومطابقة طريق | `GraphHopper` | `Valhalla` | `OSRM` | Use for Verification |
| محاكاة مرجعية | `Eclipse SUMO` | `UXsim` | `MATSim` | Use for Verification |
| اختبار خصائص | `fast-check` | مولد محلي | `nanofuzz` | Use as Development Tool |
| رحلة متصفح | `Playwright` | `Puppeteer` | `WebdriverIO` | Use as Development Tool |
| اختبار إتاحة | `axe-core` | `Pa11y` | `sa11y` | Use as Development Tool |
| انحدار بصري | `Playwright` | `pixelmatch` | خدمة خارجية | Use as Development Tool |
| قياس واجهة محلية | `autocannon` | قياس مخصص | أداة حمل كاملة | Use as Development Tool |
| فحص ثغرات | `OSV-Scanner` | تدقيق سجل الحزم | ماسح شامل | Use as Development Tool |
| قائمة مكونات | `Syft` | أمر مدير الحزم | ماسح تراخيص كامل | Use as Development Tool |
| فحص رخص | `Grant` بعد `Syft` | مراجعة يدوية | منصة امتثال | Use as Development Tool |
| آلة حالات | الكود الحالي | `XState` كنمط | منصة سير عمل | Extract Pattern |
| فصل مهام محدود | حارس الخادم الحالي بعد تقويته | `node-casbin` | `OPA` | Extract Pattern |
| قواعد اكتمال الخطة | قواعد حتمية محلية مع مخطط | `json-rules-engine` | `OPA` | Extract Pattern |
| عقد مصدر وثقة | مخطط محلي | `OpenLineage` كنمط | إطار جودة بيانات | Extract Pattern |
| تخزين متصفح | التخزين الحالي | `idb` | قاعدة مزامنة كاملة | Monitor |
| تقارير قابلة للطباعة | القالب الحالي مع اختبار متصفح | `Puppeteer` | `Paged.js` | Use as Development Tool |

## قواعد الاختيار

- المكتبة المختارة لا تسيطر على المعمارية.
- المحرك الكبير يتحول إلى مرجع مستقل.
- المعيار يعتمد بالمخطط والإصدار.
- الأداة الثقيلة تبقى في التطوير.
- الوظيفة التي تمثل قرار «مسار» تبقى مخصصة ومختبرة.
