# تبادلية WZDx — محقّق أثر على إنتاج رسمي أجنبي

> مولَّد آلياً من `presentation/scripts/build-interop-report.js`.
> لا تُحرَّر الأرقام يدوياً — أعِد التشغيل.

## السؤال الذي يجيبه هذا الملف

محقّقٌ لم يقرأ إلا ما كتبه صاحبه لا يُثبت توافقاً مع أحد. فهل
يقبل مخططنا المثبَّت **إنتاج جهة أخرى حقيقية**؟

## المحقق

- المخطط: WZDx 4.2 — WorkZoneFeed.json (رسمي)
- الالتزام المثبَّت: `42b98fcdd837e897ae3e208780c45ce61f7fc12a`
- المحقق: ajv@8.20.0 · ajv-formats@3.0.1

## الحصيلة

**مخطط أثر المثبَّت (التزام 42b98fcdd837e897ae3e208780c45ce61f7fc12a) قبِل 576 منطقة عمل حقيقية من 1 تغذية حكومية أجنبية، بصفر أخطاء.**

⚠ ممنوع قراءة هذه النتيجة قياساً مرورياً أو دليلاً على صحة أي رقم في أثر. التبادلية بنية لا قياس، وتغذية ولايةٍ أخرى لا تقول شيئاً عن الرياض.

| الجهة | البلد | مناطق العمل | الإصدار | النتيجة |
|---|---|---:|---|---|
| Washington State DOT | الولايات المتحدة | 576 | 4.2 | ✅ صفر أخطاء |

## التثبيت

سجل التغذيات: https://data.transportation.gov/resource/69qe-yiui

| الجهة | المصدر | SHA-256 | تاريخ التغذية |
|---|---|---|---|
| Washington State DOT | `https://wzdx.wsdot.wa.gov/api/v4/WorkZoneFeed` | `5aaa26c547a3d370c561a9f639c4fba610177ed598983a7fea3e419ed31b4fab` | 2026-07-25T00:00:10.6206396+00:00 |

تاريخ السحب: 2026-07-26T14:05:28.769Z

التحقق بلا شبكة:

```bash
node presentation/scripts/fetch-reference-wzdx.js --check
```

## ما فُحص لأول مرة

مُخرَج أثر يمرّ على جزء من المخطط: حدثٌ واحد من نوع `work-zone`،
هندسة `LineString`، وتسعة حقول. التغذية المرجعية تمرّ على أكثر —
وهذه هي الفروع التي لم تكن مفحوصة قبل هذا التقرير.

### Washington State DOT

- أنواع الأحداث: work-zone
- أنواع الهندسة: LineString
- الاتجاهات: eastbound، northbound، southbound، westbound
- أثر المركبات: unknown
- طرق تحديد الموقع: unknown
- حقول لا يُصدِّرها أثر (9): beginning_accuracy، beginning_milepost، end_date_accuracy، ending_accuracy، ending_milepost، event_status، reduced_speed_limit_kph، start_date_accuracy، worker_presence

## درجة الدليل

`external-official` — رتبتها **3** من 8 في سُلَّم أثر: فوق النظير
العالمي والنموذج، ودون كل درجة محلية ودون القياس الميداني الأجنبي.

تُثبت أن العقد الذي نصدّر عليه هو العقد الذي تنشر عليه جهة حقيقية.
ولا تُثبت أي رقم مروري.
