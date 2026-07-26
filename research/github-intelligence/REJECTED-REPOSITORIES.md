# المستودعات المرفوضة

| المستودع | القرار | السبب المباشر |
|---|---|---|
| [`@turf/turf`](https://github.com/Turfjs/turf) | Reject للحزمة الكاملة | أكثر من مئة اعتماد مباشر؛ انتقِ وحدة صغيرة فقط بعد إثبات الحاجة |
| [`openrouteservice`](https://github.com/GIScience/openrouteservice) | Reject للإدماج | خدمة جافا كبيرة وترخيص قوي، مع وجود مراجع أخف |
| [`MATSim`](https://github.com/matsim-org/matsim-libs) | Reject | محاكاة وكلاء كاملة تحتاج بيانات وفريقاً وتشغيلاً |
| [`CityFlow`](https://github.com/cityflow-project/CityFlow) | Reject | بيئة تعلم تعزيز للإشارات لا فجوة التصاريح الحالية |
| [`A/B Street`](https://github.com/a-b-street/abstreet) | Reject | تطبيق تخطيط ومحاكاة كامل، وليس مكوناً قابلاً للعزل |
| [`osm2pgsql`](https://github.com/osm2pgsql-dev/osm2pgsql) | Reject | يفرض قاعدة بيانات جديدة وخط تشغيل لا يحتاجه الديمو |
| [`Planetiler`](https://github.com/onthegomap/planetiler) | Reject الآن | أداة بناء على نطاق كوكبي أكبر من الحاجة؛ يبقى مرجعاً |
| [`mapbox/tilelive`](https://github.com/mapbox/tilelive) | Reject | يعلن صراحة أنه غير مصان بنشاط |
| [`node-osrm`](https://github.com/Project-OSRM/node-osrm) | Reject | مؤرشف واستبدل بالوظيفة في المستودع الرئيسي |
| [`graphhopper/map-matching`](https://github.com/graphhopper/map-matching) | Reject | مؤرشف ونقلت الوظيفة إلى المستودع الرئيسي |
| [`XState`](https://github.com/statelyai/xstate) | Extract Pattern | آلة الحالات الحالية صغيرة؛ إدخال نموذج الممثلين يزيد التعقيد |
| [`node-casbin`](https://github.com/apache/casbin-node-casbin) | Extract Pattern | دورا فصل المهام لا يحتاجان محرك سياسات عاماً |
| [`json-rules-engine`](https://github.com/CacheControl/json-rules-engine) | Reject | فاحص الخطة يحتاج قواعد حتمية قليلة ومراجع واضحة |
| [`OPA`](https://github.com/open-policy-agent/opa) | Reject | خدمة ولغة وسياسة وتشغيل لحاجة صغيرة |
| [`Helmet`](https://github.com/helmetjs/helmet) | Reject | مخصص لإكسبريس، والخادم الحالي خام |
| [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit) | Reject | يفرض إطاراً غير موجود من أجل وظيفة واحدة |
| [`jose`](https://github.com/panva/jose) | Monitor | ممتاز لكنه يحل رموز هوية لا مفتاح واجهة بسيط |
| [`OpenLineage`](https://github.com/OpenLineage/OpenLineage) | Reject | منصة ومعيار نسب خطوط بيانات أكبر من عقد ست حالات |
| [`Great Expectations`](https://github.com/fivetran/great_expectations) | Reject | إطار بايثون وتشغيل مؤسسي وملكية متغيرة لحاجة مخطط صغيرة |
| [`Cypress`](https://github.com/cypress-io/cypress) | Reject | أثقل من أداة المتصفح المختارة ومسار الملف المحلي أقل مباشرة |
| [`WebdriverIO`](https://github.com/webdriverio/webdriverio) | Reject | إعداد وتشعبات أكثر من الحاجة |
| [`Pa11y`](https://github.com/pa11y/pa11y) | Reject | ترخيص أقوى وحزمة تشغيل متصفح، بينما المحرك المختار يندمج في الاختبار الحالي |
| [`geojson-rbush`](https://github.com/DenisCarriere/geojson-rbush) | Reject | غلاف أقل نشاطاً؛ عقدنا الصغير حول الأصل أوضح |
| [`geobuf`](https://github.com/mapbox/geobuf) | Reject | الضغط وحده لا يحل التحميل التدريجي أو التبليط |
| [`osmtogeojson`](https://github.com/tyrasd/osmtogeojson) | Monitor | مفيد للتحويل لكنه ليس بديلاً لبناء شبكة بقيود كاملة |
| [`FMM`](https://github.com/cyang-kth/fmm) | Reject الآن | مطابقة طريق مستقلة بلغة أصلية ولا توجد حاجة إنتاجية مثبتة |
| [`Barefoot`](https://github.com/bmwcarit/barefoot) | Reject الآن | نشاط ضعيف وتشغيل جافا لخدمة محدودة |

## قواعد رفض عامة

- لا مشروع بلا رخصة.
- لا مشروع مؤرشف مع وجود البديل الرئيسي.
- لا منصة تغير معمارية المنتج.
- لا محاكاة بلا بيانات ومعايرة.
- لا حزمة شاملة إذا حلت وحدة صغيرة الحاجة.
- لا أداة تطوير تدخل حزمة المنتج.
