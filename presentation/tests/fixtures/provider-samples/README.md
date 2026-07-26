# عيّنات المزوّدين — لاختبار المحلِّلات فقط

هذه الملفات **ليست قياسات للرياض**. هي حمولات بشكل الاستجابة كما تصفه وثيقة كل
مزوّد، مكتوبة هنا لاختبار المحلِّل (parser) وحده.

القاعدة التي تحكمها:

- لا تدخل أي قيمة منها في خط أساس، ولا في معايرة، ولا في أي رقم يُعرض.
- كل قياس مشتقّ منها يحمل `dataMode: "synthetic"` و`sourceType: "provider-sample"`.
- إحداثياتها في الرياض عمداً لتشغيل الإسناد، وهذا **لا يجعلها بيانات رياض**.

| الملف | المزوّد | مأخوذ الشكل من |
|---|---|---|
| `here-flow.json` | HERE Traffic API v7 — flow | https://docs.here.com/traffic-api/docs/flow |
| `tomtom-flow-segment.json` | TomTom Traffic — flowSegmentData | https://developer.tomtom.com/traffic-api/documentation/tomtom-maps/v1/product-information/introduction |
| `google-routes.json` | Google Routes API — computeRoutes | https://cloud.google.com/maps-platform/terms/maps-service-terms |

ما تُثبته هذه العيّنات: أن المحلِّل يقرأ الحقول الصحيحة، ويترك الغائب فارغاً لا
صفراً، ويصنّف الثقة المنخفضة `stale` بدل `ok`.

ما لا تُثبته: أن الاتصال يعمل، ولا أن التغطية تشمل الرياض، ولا أي رقم عن حركة
حقيقية.
