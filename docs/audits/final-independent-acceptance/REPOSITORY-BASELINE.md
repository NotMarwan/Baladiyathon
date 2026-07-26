# نسخة التدقيق — Repository Baseline

## الالتزام والفرع

| البند | القيمة |
|---|---|
| Commit SHA | `2c9a5cae5872be99430658c9928398dbd954ec1f` |
| الفرع | `main` |
| رسالة الالتزام | `docs: cold re-evaluation, with the fifteenth acceptance condition applied literally` |
| المؤلف · التاريخ | Wasan · Sun Jul 26 12:55:25 2026 +0300 |
| `git status --short` عند البدء | فارغ — الشجرة المتتبَّعة نظيفة |
| الملفات غير الملتزم بها عند البدء | لا شيء |
| جذر المستودع | `C:\Users\wasan\Downloads\Swarm\Baladiyathon` |

**ملاحظة على الجذر:** `C:\Users\wasan\Downloads\Swarm` نفسه **ليس** مستودع
Git. المستودع هو المجلد الفرعي `Baladiyathon/`. كل مرجع «الشجرة» في هذه
الحزمة يعني شجرة `Baladiyathon/`.

## نافذة المقارنة قبل/بعد

| البند | القيمة |
|---|---|
| آخر التزام للوكيل السابق | `2c9a5ca` |
| أول التزام في نافذة العمل | `55d909c` — *run the official WZDx 4.2 schema…* |
| الالتزام السابق مباشرة لبدء العمل (خط الأساس) | `590583c` — *docs: record cycle 13 and declare the loop converged* |
| حجم النافذة | 7 التزامات · 989 ملفاً · ‎+71,796 / ‎-2,757 سطراً |

سلسلة النافذة كاملة:

```
2c9a5ca docs: cold re-evaluation, with the fifteenth acceptance condition applied literally
650601f feat: a text deck the judge's tooling can actually read
96b0d7e feat: measurement pack — built before the data arrives, not after
b32a489 feat: classify recommendation stability, and let the desk abstain
518cd47 feat: a comparable-case ledger — and the evidence widened the range instead of narrowing it
95c99b0 feat: build the route evidence collector, and find out what the providers cannot give
55d909c feat: run the official WZDx 4.2 schema, and stop exporting files it rejects
```

## البيئة

| البند | القيمة |
|---|---|
| Node | `v24.15.0` |
| npm | `11.12.1` |
| نظام التشغيل | Windows 11 Home 10.0.26200 (win32) |
| صدفة الفحوص | Git Bash (POSIX) |
| اعتماديات المنتج | `ajv ^8.20.0` · `ajv-formats ^3.0.1` (وحدهما في `package.json`) |
| إصدار AJV المحلول فعلياً | `ajv@8.20.0` · `ajv-formats@3.0.1` — مقروء من `require('ajv/package.json').version` وقت التشغيل |
| بدء التدقيق (UTC) | `2026-07-26T10:19:18Z` |
| نهاية طور الأدلة (UTC) | `2026-07-26T11:21:18Z` |

## ثبات المستودع أثناء التدقيق

### الشجرة المتتبَّعة — ثابتة

`git status --short -- presentation docs output` خرج فارغاً في **كل** نقطة
فحص، بما فيها بعد:

- ثلاث تشغيلات كاملة لخط الاختبارات،
- إعادة توليد تقرير مطابقة WZDx،
- إعادة توليد تقرير الاستقرار،
- إعادة توليد جرد العرض النصّي.

أي أن كل مخرَج مسلَّم في المستودع **مطابق بايتاً ببايت** لما تولّده الشيفرة
اليوم. هذه أقوى نتيجة إعادة إنتاج ممكنة، وهي محقَّقة.

### لكن المستودع ككل غير مجمَّد

أثناء التدقيق (بين 13:36 و13:42 بتوقيت الجهاز) ظهر مجلد غير متتبَّع جديد:

```
research/evidence-intelligence/          19 ملفاً
research/evidence-intelligence/lab/node_modules -> .../codex-primary-runtime/...
```

وجود ارتباط رمزي إلى `codex-primary-runtime` يعني أن **وكيلاً آخر كان يكتب
في المستودع أثناء هذا التدقيق**.

المحتوى: مصنّفات رسمية (`traffic-flow-data.xlsx`، `traffic-density-on-roads.xlsx`،
`average-speed-on-roads.xlsx`) واستخراج أوراق بحثية. أي أن الوكيل الآخر يعمل
على **بيانات ميدانية/رسمية** — وهي بالضبط الفجوة الحاكمة التي يرصدها هذا
التدقيق.

**الأثر على الحكم:**

> `Repository state is not stable enough to freeze the repository as a whole.`

وفي الوقت نفسه:

> شجرة المنتج المتتبَّعة عند `2c9a5ca` كانت ثابتة طوال التدقيق، ولم يمسّها
> النشاط المتزامن. كل نتيجة في هذه الحزمة تخصّ تلك الشجرة، وهي صالحة.

الحكم في [GO-NO-GO.md](GO-NO-GO.md) مقيَّد بهذا التمييز: صالح على
`2c9a5ca/presentation`، وغير صالح كإعلان تجميد للمستودع.

## سطح الاختبارات

| البند | القيمة |
|---|---|
| مُشغّل | `presentation/tests/run-all.js` |
| عدد ملفات `*-test.js` (عدّ مستقل) | **69** |
| `PENDING` في المُشغّل | `{}` — **صفر معلَّقات**، لا استثناء صامت |
| جرد مولَّد | `presentation/tests/fixtures/test-manifest.json` → `{suites: 69, checks: 1173}` |
| هل يُكتب الجرد إلا من تشغيل أخضر؟ | نعم — `if (!failed && !pendingFailed)` |

`package.json` في جذر المستودع يحمل `"test": "echo \"Error: no test specified\" && exit 1"`.
خط الاختبارات الحقيقي يُشغَّل مباشرةً بـ `node presentation/tests/run-all.js`.
هذا لا يبطل النتيجة، لكنه يعني أن `npm test` لا يقود إلى الخط — مرشّح إصلاح
في [REMEDIATION-HANDOFF.md](REMEDIATION-HANDOFF.md).
