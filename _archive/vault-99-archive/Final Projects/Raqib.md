---
project: Raqib
name_ar: رقيب
challenge: 2
challenge_text: التفتيش الرقمي الاستباقي
score: 8.4
verdict: STRONG-BACKUP
status: merged-final
merges:
  - PRO-INSPECT
  - NADHEER
  - BASEERA
proven_origin: Chicago Food Inspection Forecasting (69% vs 55%, 7.5 days earlier)
tags: [baladiyathon, final, challenge-2]
---

# رقيب — Raqib

> نموذج تفتيش استباقي: نرتّب قائمة زيارات المفتش بالأدلة، ونرصد البناء بلا ترخيص بالأقمار، ونُنبّه المالك بالعربية **قبل** أن تُسجَّل عليه مخالفة.

## الدوسيه الكامل
📎 [افتح دوسيه العرض](attachments/raqib.html)

## الحكم — 8.4 / 10 🥈
راجع [[Ideas Evaluation Final]].

### القوة
- **أقوى دليل رقمي:** نموذج شيكاغو مُثبت (69% مقابل 55%، أبكر بـ7.5 أيام).
- **عدالة بالتصميم:** نُقيّم أماكن لا أشخاص (درسنا من إخفاق أمستردام وروتردام).
- **درع الأدلة الأنظف** بين المشاريع الثلاثة.

### الضعف
- **التحدي الأكثر ازدحاماً** — كل الفرق ستقترح "AI للتفتيش".

### الأصل المُثبت
- Chicago Food Inspection Forecasting (open-source, MIT).
- Cincinnati blight 78% vs 53%.
- Chelsea MA 81% vs 45% (محكّم).

## يدمج
- [[PRO-INSPECT]] — المحرّك الأساسي (نموذج شيكاغو).
- [[NADHEER]] — طبقة الأقمار Sentinel-2 فقط (**بدون درون**).
- [[BASEERA]] — التنبيه العربي الاستباقي للمالك.

## قرار الإقصاء
- **كل الدرونات حُذفت** (لغم خصوصية + GACA).
- **التعلّم الفيدرالي حُذف** (غير قابل للعرض).

## المصادر
- [[Research - Challenge 2]]
- [[Official Hackathon Rules]]
