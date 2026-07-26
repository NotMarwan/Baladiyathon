# القائمة الطويلة

تاريخ الفحص: 2026-07-26.

## بطاقات الهوية المختصرة للمستودعات التي اجتازت الاكتشاف

عدد المساهمين النشطين هو عدد الهويات الفريدة في أحدث مئة التزام منذ 2026-04-26. الصفر يعني عدم وجود التزام على الفرع الافتراضي في النافذة، ولا يعني أن المشروع مهجور. لم يظهر فرع أحدث حاكم لأي مستودع في هذا الجدول.

| المستودع | النوع واللغة | آخر إصدار | آخر التزام أو دفع مفحوص | نشطون | مؤرشف | الرخصة |
|---|---|---|---|---:|---|---|
| `ajv-validator/ajv` | مكتبة، تايب سكربت | 8.20.0 · 2026-04-24 | 2026-05-12 | 0 | لا | MIT |
| `usdot-jpo-ode/wzdx` | مواصفة ومخططات | 4.2 · 2023-02-14 | 2025-02-18 | 0 | لا | CC0-1.0 |
| `mourner/rbush` | مكتبة، جافاسكربت | 4.0.1 · 2024-08-21 | دفع 2026-07-21 | 0 | لا | MIT |
| `mourner/flatbush` | مكتبة، جافاسكربت | 4.6.2 · 2026-06-09 | 2026-07-08 | 1 | لا | ISC |
| `protomaps/PMTiles` | مواصفة وتطبيقات، تايب سكربت | حزمة 4.4.1 · 2026-04-08 | 2026-05-26 | 1 | لا | BSD-3-Clause |
| `mapbox/geojson-vt` | مكتبة، جافاسكربت | 4.0.3 · 2026-05-14 | 2026-07-02 | 4 | لا | ISC |
| `dubzzz/fast-check` | مكتبة اختبار، تايب سكربت | 4.9.0 · 2026-07-08 | 2026-07-23 | 5 على أحدث مئة | لا | MIT |
| `microsoft/playwright` | إطار اختبار، تايب سكربت | سجل الحزمة 1.62.0 · 2026-07-25 | 2026-07-24 | 15 على أحدث مئة | لا | Apache-2.0 |
| `dequelabs/axe-core` | محرك اختبار، جافاسكربت | 4.12.1 · 2026-06-10 | 2026-07-24 | 15 | لا | MPL-2.0 |
| `mapbox/pixelmatch` | مكتبة اختبار، جافاسكربت | 7.2.0 · 2026-04-29 | 2026-07-07 | 2 | لا | ISC |
| `google/osv-scanner` | أداة، غو | 2.4.0 · 2026-06-18 | 2026-07-24 | 25 | لا | Apache-2.0 |
| `anchore/syft` | أداة، غو | 1.49.0 · 2026-07-21 | 2026-07-24 | 29 على أحدث مئة | لا | Apache-2.0 |
| `graphhopper/graphhopper` | محرك، جافا | 11.0 · 2025-10-14 | 2026-07-23 | 9 | لا | Apache-2.0 |
| `Project-OSRM/osrm-backend` | محرك، سي بلس بلس | 26.7.3 · 2026-07-10 | 2026-07-19 | 8 على أحدث مئة | لا | BSD-2-Clause |
| `valhalla/valhalla` | محرك، سي بلس بلس | 3.8.3 · 2026-07-25 | 2026-07-25 | 15 | لا | MIT من ملف الرخصة |
| `eclipse-sumo/sumo` | محاكي، بايثون وسي بلس بلس | لا إصدار جيت هب أخير | 2026-07-23 | 8 على أحدث مئة | لا | EPL-2.0 |
| `toruseo/UXsim` | محاكي، بايثون | 1.13.0 · 2026-03-27 | 2026-07-16 | 4 | لا | MIT |

## مجموعة الاكتشاف والفرز

الجدول التالي يضم أيضاً نتائج اكتشاف استبعدت قبل الفحص العميق. سبب بقائها هنا هو جعل مسار الاستبعاد قابلاً للتدقيق، ولا تعد كلها مرشحين نهائيين.

| المستودع | الفئة | سبب الإدراج | النتيجة الأولية |
|---|---|---|---|
| [`ajv`](https://github.com/ajv-validator/ajv) | تحقق بالمخطط | يدعم مسودات متعددة وله اختبارات ومجتمع مكتمل | قائمة قصيرة |
| [`zod`](https://github.com/colinhacks/zod) | تحقق | واجهة مريحة واستدلال أنواع | بديل؛ المشروع ليس تايب سكربت |
| [`typebox`](https://github.com/sinclairzx81/typebox) | تحقق | يولد مخطط جيسون مع أنواع ثابتة | بديل؛ يضيف طبقة أنواع غير موجودة |
| [`Hyperjump`](https://github.com/hyperjump-io/json-schema) | تحقق | دعم قوي للمواصفات والتجميع | بديل أقل انتشاراً في هذا السياق |
| [`rbush`](https://github.com/mourner/rbush) | فهرس مكاني | إدخال وحذف واستعلام ديناميكي | قائمة قصيرة |
| [`flatbush`](https://github.com/mourner/flatbush) | فهرس مكاني | أسرع لفهرس ثابت ومضغوط | قائمة قصيرة |
| [`kdbush`](https://github.com/mourner/kdbush) | فهرس نقاط | خفيف جداً للنقاط | جزئي؛ لا يغطي الصناديق والأعمال |
| [`geojson-rbush`](https://github.com/DenisCarriere/geojson-rbush) | فهرس جغرافي | غلاف جاهز لجيسون الجغرافي | مرفوض؛ نشاط أضعف من الأصل |
| [`PMTiles`](https://github.com/protomaps/PMTiles) | بلاطات | أرشيف واحد ودعم مباشر لمحرك الخريطة | قائمة قصيرة |
| [`go-pmtiles`](https://github.com/protomaps/go-pmtiles) | أداة بناء | تحويل وفحص أرشيفات البلاطات | أداة تطوير مرشحة |
| [`geojson-vt`](https://github.com/mapbox/geojson-vt) | تبليط متصفح | صفر اعتماديات وتكامل مباشر | قائمة قصيرة مع تحفظ ذاكرة |
| [`tippecanoe`](https://github.com/felt/tippecanoe) | بناء بلاطات | ناضج للبيانات الكبيرة | أداة تطوير؛ تشغيل ويندوز أقل بساطة |
| [`Planetiler`](https://github.com/onthegomap/planetiler) | بناء بلاطات | يولد بلاطات على نطاق كبير | أكبر من بيانات المشروع الحالية |
| [`FlatGeobuf`](https://github.com/flatgeobuf/flatgeobuf) | تنسيق جغرافي | وصول جزئي وفهرسة داخلية | لاحقاً؛ لا تكامل مباشر حالي |
| [`geobuf`](https://github.com/mapbox/geobuf) | ضغط | تنسيق ثنائي صغير | فائدة محدودة مقارنة بالبلاطات |
| [`Turf`](https://github.com/Turfjs/turf) | عمليات جغرافية | يغطي التقاطع والمسافات والتحقق | لا تعتمد الحزمة الكاملة |
| [`martinez`](https://github.com/w8r/martinez) | قص مضلعات | خوارزمية مخصصة ناضجة | جزئي عند إثبات حاجة قص معقد |
| [`MapLibre GL JS`](https://github.com/maplibre/maplibre-gl-js) | عرض خرائط | المحرك الموجود في المنتج | أبقِ الموجود وراقب التحديث |
| [`GraphHopper`](https://github.com/graphhopper/graphhopper) | توجيه | اتجاهات وقيود ومطابقة طريق | تحقق مستقل |
| [`OSRM`](https://github.com/Project-OSRM/osrm-backend) | توجيه | سريع وناضج وله اختبارات وفز | تحقق مستقل |
| [`Valhalla`](https://github.com/valhalla/valhalla) | توجيه | متعدد الوسائط وتكاليف مخصصة | تحقق مستقل، تشغيل أثقل |
| [`openrouteservice`](https://github.com/GIScience/openrouteservice) | توجيه | واجهة وميزات جاهزة | مرفوض للإدماج؛ ترخيص قوي وتشغيل كبير |
| [`RoutingKit`](https://github.com/RoutingKit/RoutingKit) | توجيه | مكتبة تخطيط متقدمة | غير ملائمة مباشرة لجافاسكربت |
| [`libosmium`](https://github.com/osmcode/libosmium) | قراءة بيانات الطرق | سريع ومرن | أداة بناء فقط، يحتاج ربطاً أصلياً |
| [`osm2pgsql`](https://github.com/osm2pgsql-dev/osm2pgsql) | استيراد بيانات الطرق | ناضج للإنتاج | يفرض قاعدة بيانات جديدة |
| [`osmtogeojson`](https://github.com/tyrasd/osmtogeojson) | تحويل | جافاسكربت ورخصة متساهلة | مراقبة؛ نشاط وصيانة أضعف |
| [`WZDx`](https://github.com/usdot-jpo-ode/wzdx) | معيار مناطق عمل | المخطط الرسمي | قائمة قصيرة |
| [`wzdx.models`](https://github.com/WSDOT/wzdx.models) | مولدات | تنفيذ حكومي مساعد | لغة مختلفة ولا حاجة للكود |
| [`Eclipse SUMO`](https://github.com/eclipse-sumo/sumo) | محاكاة | مرجع هندسي واسع وأدوات سيناريو | تحقق مستقل |
| [`UXsim`](https://github.com/toruseo/UXsim) | محاكاة | أخف وأسهل لتجارب صغيرة | تحقق مستقل |
| [`MATSim`](https://github.com/matsim-org/matsim-libs) | محاكاة | ناضج على مستوى الوكلاء | مرفوض حالياً؛ تشغيل وترخيص ونطاق |
| [`CityFlow`](https://github.com/cityflow-project/CityFlow) | محاكاة | واسع لتعلم تعزيز الإشارات | موضوع قريب لا حاجة فعلية |
| [`A/B Street`](https://github.com/a-b-street/abstreet) | تخطيط ومحاكاة | تطبيق غني للمقارنة | تطبيق كامل أكبر من الحاجة |
| [`XState`](https://github.com/statelyai/xstate) | حالات | آلة حالات ناضجة | خذ النمط فقط |
| [`node-casbin`](https://github.com/apache/casbin-node-casbin) | صلاحيات | أدوار وسياسات متعددة | أكبر من دورين وفصل مهام |
| [`json-rules-engine`](https://github.com/CacheControl/json-rules-engine) | قواعد | قواعد مصرح بها | أكبر من فاحص حتمي صغير |
| [`OPA`](https://github.com/open-policy-agent/opa) | سياسات | محرك سياسات عام | مرفوض؛ خدمة ولغة سياسة وتشغيل |
| [`Helmet`](https://github.com/helmetjs/helmet) | أمن | ترويسات ناضجة | غير متوافق مع الخادم الخام دون إعادة تشكيل |
| [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit) | أمن | تحديد معدل جاهز | يتطلب إكسبريس غير الموجود |
| [`jose`](https://github.com/panva/jose) | هوية وتوقيع | تنفيذ معياري قوي | لا حاجة لرموز هوية في نطاق مفتاح الواجهة |
| [`fast-check`](https://github.com/dubzzz/fast-check) | اختبار خصائص | نشط ومخصص لجافاسكربت | قائمة قصيرة |
| [`Playwright`](https://github.com/microsoft/playwright) | اختبار متصفح | متعدد المحركات وله صور وتتبع | قائمة قصيرة |
| [`axe-core`](https://github.com/dequelabs/axe-core) | إتاحة | محرك تدقيق ناضج | قائمة قصيرة |
| [`pixelmatch`](https://github.com/mapbox/pixelmatch) | انحدار بصري | صغير وبسيط | قائمة قصيرة |
| [`Puppeteer`](https://github.com/puppeteer/puppeteer) | متصفح وتقارير | مناسب لتوليد ملفات | بديل؛ أضيق من أداة المتصفح المختارة |
| [`Cypress`](https://github.com/cypress-io/cypress) | اختبار متصفح | تجربة تطوير جيدة | أثقل وأقل ملاءمة للصفحات المحلية |
| [`WebdriverIO`](https://github.com/webdriverio/webdriverio) | اختبار متصفح | مرن جداً | إعداد أكبر من الحاجة |
| [`OSV-Scanner`](https://github.com/google/osv-scanner) | ثغرات | قاعدة ثغرات مفتوحة وأداة رسمية | قائمة قصيرة |
| [`Syft`](https://github.com/anchore/syft) | قائمة مكونات | يولد صيغاً معيارية | قائمة قصيرة |
| [`Grant`](https://github.com/anchore/grant) | رخص | يفحص رخص قائمة المكونات | أداة لاحقة بعد توليد القائمة |
| [`OpenLineage`](https://github.com/OpenLineage/OpenLineage) | نسب بيانات | معيار مؤسسي | أكبر من عقد القيم المطلوب |
| [`Great Expectations`](https://github.com/fivetran/great_expectations) | جودة بيانات | إطار واسع | مرفوض حالياً؛ بايثون وتشغيل وملكية متغيرة |
| [`idb`](https://github.com/jakearchibald/idb) | تخزين متصفح | غلاف خفيف للقاعدة المحلية | لاحقاً عند بدء المزامنة الميدانية |

## خلاصة الفرز

انتقل إلى الفحص العميق فقط ما يحل فجوة مثبتة من دون إعادة تشكيل المنتج. بقية المستودعات بقيت بدائل مقارنة أو مراجع رفض.
