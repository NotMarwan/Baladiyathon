# Agent Ownership and Integration — «مسار» — **V2**

**الحالة 2026-07-26 00:09:** خط الأساس **`46/46` أخضر** · المستودع **ما زال ساخناً** — `masar-worksmap-panel.js` عُدِّل 00:06 · **وكيل البحث التنافسي أنهى** عمله (10 ملفات، آخرها 23:40).

> ## البوابة الملزمة — V2
>
> **لا يُدمج أي عمل يمسّ الخريطة أو التوجيه أو المحرك حتى يسلّم الوكيل الحالي، وتُعاد الاختبارات، ويعود خط الأساس إلى `46/46` — أو يُفسَّر الانخفاض ويُقبل صراحةً بتوقيع.**
>
> `46/46` عند دمجك **لا** تُثبت `46/46` عند دمج غيرك. تُشغَّل **قبل كل دمج**، لا مرة واحدة.
> الأخضر الحالي **عابر** — الفشلان انحلّا خلال ساعة، وقد يعودان مع الدفعة التالية.

### تغييرات ملكية V2

| | |
|---|---|
| **أُفرِج عنه** | `research/competitive-intelligence/**` — الوكيل أنهى. تُقرأ ولا تُعدَّل؛ مصدر مرجعي مجمَّد |
| **ما زال مجمَّداً** | `masar-worksmap-*.js` · `masar-map.html` · `masar-city-routing.js` · `data/riyadh-route-graph.js` · `data/riyadh-turn-restrictions.js` · `data/city-portfolio.geojson*` · `tests/city-routing-test.js` · `tests/worksmap-*.js` |
| **حزم جديدة، صفر تلامس ساخن** | `T1` (`masar-provenance.js` جديد) · `T3` (`masar-publication.js` جديد) · `T4` (`masar-plan-rules.js` جديد) — **الثلاثة ملفات جديدة، تبدأ الآن** |
| **حزمة جديدة تلمس ملفاً مشتركاً** | `T2` → `masar-desk-states.js` + `masar-desk-boot.js`. تنتظر B1 وT1 · **لا تلمس ملف توجيه واحداً** |
| **عقد بلا تنفيذ** | سعة التحويلة: يُعرَّف العقد المطلوب من وكيل التوجيه (`{volumeBefore, volumeAfter, capacity, vcAfter}` لكل مقطع بديل)، **ولا يُنفَّذ الآن** |

---

## 1. الملفات المجمَّدة — لا تُمسّ

الملفات المعدَّلة في الدقائق الست السابقة للفحص (2026-07-25 23:14–23:21):

| الملف | آخر تعديل | المالك الحالي |
|---|---|---|
| `presentation/tests/city-routing-test.js` | 23:20:52 | وكيل التوجيه |
| `presentation/tests/worksmap-solution-test.js` | 23:17:34 | وكيل الخريطة |
| `presentation/masar-worksmap-panel.js` | 23:15:09 | وكيل الخريطة |
| `presentation/masar-map.html` | 23:14:48 | وكيل الخريطة |
| `presentation/masar-worksmap-solution.js` | 23:14:30 | وكيل الخريطة |
| `presentation/masar-city-routing.js` | 23:06:33 | وكيل التوجيه |
| `presentation/masar-worksmap-layers.js` + `-style.js` + `-page.css` | 21:15–21:26 | وكيل الخريطة |
| `presentation/data/riyadh-route-graph.js` + `riyadh-turn-restrictions.js` | 21:09–21:10 | وكيل التوجيه |
| `research/competitive-intelligence/**` | 23:14–23:20 | وكيل البحث التنافسي |

**قاعدة التجميد:** لا حزمة من هذه الخطة تكتب في أيٍّ من هذه الملفات قبل تحقق شرطين معاً:
1. الوكيل العامل يعلن انتهاءه.
2. `node tests/run-all.js` يعود `46/46`.

**استثناء وحيد مسموح:** `masar-city-routing.js:22` — سطر تعليق واحد في WP-A1 (تصحيح ادعاء مصدر الإشارات). تعديل سطر تعليق لا يتعارض دلالياً؛ يُدمج آخراً وبتنسيق معلن.

**الحزم المتأثرة بالتجميد:** WP-I1، WP-I2، WP-B2 (تكتب `data/city-portfolio.geojson*` التي تقرأها الخريطة). هذه الثلاث **تنتظر**.

---

## 2. مصفوفة الملكية

| حزمة العمل | الملفات المحتملة | المالك المقترح | التعارض المحتمل | ترتيب الدمج |
|---|---|---|---|---|
| **G0** إعادة الأخضر | `tests/city-routing-test.js`, `tests/worksmap-layers-test.js` + ملفاتهما | **الوكيل العامل نفسه** | — (هو المالك) | **1** |
| **A1** تطهير الادعاءات | `masar-prototype.html`, `README-masar.md`, `masar-city-routing.js:22` | doc-updater | **تعليق واحد في ملف مجمَّد** | 2 (بعد إعلان الوكيل) |
| **A3** تقاعد الصفحات | `masar.html`, `masar-merged.html`, `masar-pitch.html`, `masar-nav.js` | refactor-cleaner | `masar-nav.js` مشترك مع G3 | 3 |
| **A2** حذف الرقم المالي | `masar-engine.js` (`digOnce`), `masar-city-impact.html` | sonnet-worker | **`masar-engine.js` مشترك مع B1 و C1** | 4 |
| **H2** ملف مرجعي | `tests/fixtures/*`, `tests/impact-golden-test.js` | tdd-guide | — (ملفات جديدة) | 5 |
| **H4** تنوّع القرار | `tests/decision-diversity-test.js` | tdd-guide | — (ملف جديد) | 5 |
| **A5** بوابة الاتساق | `tests/consistency-gate.js`, `tests/run-all.js` | tdd-guide | `run-all.js` مشترك مع كل حزم H | 6 |
| **D1** الأمن والحدود | `server.js`, `tests/api-security-test.js` | security-reviewer | **`server.js` منفرد — متوازٍ تماماً** | متوازٍ |
| **E4** بوابة التخطيط | `tests/layout-gate.py` | tdd-guide | — | متوازٍ |
| **B1** المحسّن | `masar-engine.js` (`optimize`), `masar-desk-file.js`, `scripts/build-city-portfolio.js` | architect + sonnet-worker | **أعلى تعارض: `masar-engine.js`** | 7 (بعد A2) |
| **B2** إعادة التوليد | `data/city-portfolio.geojson*` | sonnet-worker | **مجمَّدة — تقرأها الخريطة** | 8 (مع B1، بعد رفع التجميد) |
| **C1** السيناريوهات | `masar-engine.js`, `masar-desk-file.js`, `masar-city-impact.html` | architect | **`masar-engine.js` بعد B1 مباشرة** | 9 |
| **A4** بطاقة الفكرة | `بطاقة-الفكرة.md` | doc-updater | — | متوازٍ (بعد A3) |
| **E1** تبويب الأثر | `masar-desk-boot.js:348`, `masar-desk-file.js` | sonnet-worker | **`masar-desk-file.js` مشترك مع B1/C1** | 10 (بعد C1) |
| **E2** الجوال | `masar-desk.css`, `masar-desk-boot.js` (تنقّل) | a11y-architect | `masar-desk-boot.js` مشترك مع E1 و E3 | 11 |
| **E3** نقل التنبؤ | `masar-desk.html`, `masar-desk-boot.js`, `masar-forecast.js` | sonnet-worker | نفس الأعلى | 12 |
| **B3** «لا وفر» | `masar-desk-file.js` | sonnet-worker | نفس الأعلى | 13 |
| **B4** توحيد المحفظتين | `masar-city-impact.html`, حذف `masar-portfolio.js` | refactor-cleaner | `masar-city-impact.html` مشترك مع A2 و C1 | 14 (آخر من يمسّها) |
| **C2** لوحة الافتراضات | `masar-sources.html` | doc-updater | مشترك مع G2 | 15 |
| **F1** الاستخراج | `masar-intake.js`, `data/intake-gold/*` (جديدة) | architect + sonnet-worker | نقطة وصل واحدة في `masar-desk.html` | متوازٍ |
| **F2** صياغة الخطة | `masar-plan-narrative.js` (جديد) | sonnet-worker | — | بعد F1 |
| **G1** مُولِّد العرض | `scripts/build-submission-deck.js`, `tests/submission-gate.js`, `output/submission/*` | architect + doc-updater | **يقرأ كل شيء ولا يكتب في المنتج** | 16 (بعد B2 و C1) |
| **G2** البحث التنافسي | قوالب G1, `بطاقة-الفكرة.md`, `masar-sources.html` | doc-updater | مع G1 و C2 | 17 |
| **G3** «ما لم يُنفَّذ» | `masar-limits.html` (جديد), `masar-nav.js` | doc-updater | `masar-nav.js` مع A3 | 18 |
| **H1** الرحلة سلوكياً | `tests/judge-journey-e2e.py` (جديد) | e2e-runner | — | بعد E2 |
| **H3** التدهور الرشيق | `tests/offline-degradation-test.py` (جديد) | e2e-runner | — | متوازٍ |
| **D2/D3** السجل والأدوار | `server.js` | security-reviewer + sonnet-worker | `server.js` بعد D1 | بعد D1 |
| **I1/I2** الأداء | ملفات الخريطة والتوجيه | performance-optimizer | **مجمَّدة** | آخر شيء |
| **J1/J2** خارجي | `docs/DATA-REQUESTS.md` | الفريق البشري | — | فوراً وبالتوازي |

---

## 3. الملفات عالية التعارض

| الملف | عدد الحزم التي تمسّه | قاعدة التسلسل |
|---|---:|---|
| **`masar-engine.js`** | 4 (A2, B1, C1, وغير مباشر B3) | **وكيل واحد في المرة الواحدة.** التسلسل الملزم: A2 ← B1 ← C1. لا تفرّع متوازٍ عليه إطلاقاً |
| **`masar-desk-file.js`** | 5 (B1, B3, C1, C2, E1) | يُدمج بعد استقرار `masar-engine.js` |
| **`masar-desk-boot.js`** | 4 (E1, E2, E3, B3) | E1 ← E2 ← E3. ملف 55 ك.ب — تعارضات الدمج مؤلمة |
| **`masar-city-impact.html`** | 3 (A2, C1, B4) | B4 آخر من يمسّها لأنها تحذف مصدر بياناتها |
| **`masar-nav.js`** | 2 (A3, G3) | A3 يحذف، G3 يضيف. A3 أولاً |
| **`tests/run-all.js`** | 5 (A5, H1–H4) | إضافات سطر واحد؛ تعارض بسيط ومحتمل |
| **`data/city-portfolio.geojson*`** | 2 (B2) + الخريطة | **مجمَّد.** لا كتابة قبل رفع التجميد |
| **`server.js`** | 3 (D1, D2, D3) | متوازٍ مع كل شيء آخر. D1 ← D2 ← D3 |

---

## 4. ما يمكن تشغيله بالتوازي الآن — **V2**

ستّ حِزم لا تلمس أي ملف مجمَّد ولا أي ملف عالي التعارض:

| # | العمل | الملفات | المالك |
|---|---|---|---|
| 1 | **D1** الأمن والحدود | `server.js` فقط | security-reviewer |
| 2 | **H2 + H4** الملف المرجعي واختبار التنوّع | ملفات اختبار جديدة | tdd-guide |
| 3 | **T4** 🆕 فاحص اكتمال الخطة الحتمي | `masar-plan-rules.js` جديد | sonnet-worker |
| 4 | **E4** بوابة الارتفاع | `tests/layout-gate.py` | tdd-guide |
| 5 | **J1** طلبات البيانات | `docs/DATA-REQUESTS.md` | الفريق البشري |
| 6 | **A1** تطهير الادعاءات | `masar-prototype.html` + `README-masar.md` (+ سطر تعليق واحد في ملف مجمَّد، يُدمج آخراً) | doc-updater |

**`F1` خرجت من قائمة المتوازي** — صارت P2 مشروطة وتعتمد على T4.
**`T1` ليست متوازية** رغم أنها ملف جديد: تُدخل عقد المصدر في `masar-desk-file.js` و`masar-sources.html`، فتتسلسل بعد A5 وقبل B1.

**حدّ التزامن:** وكيلان تنفيذيان في الوقت نفسه بحدّ أقصى، بحسب قاعدة التفويض المعتمدة. الأولوية للأول والثاني.

---

## 5. ما يجب تجميده من هذه الخطة

| العمل | حتى متى |
|---|---|
| كل عمل على `masar-worksmap-*`, `masar-city-routing.js`, `masar-map.html` | حتى إعلان الوكيل العامل + `46/46` |
| **B2** إعادة توليد المحفظة | نفسه |
| **I1, I2** الأداء | نفسه |
| **A3** تقاعد `masar-prototype.html` (المرحلة الثانية) | حتى تنجز **E3** نقل التنبؤ — الصفحة تستضيف الوظيفة الوحيدة |
| **B4** حذف `masar-portfolio.js` | حتى يتحوّل `masar-city-impact.html` لقراءة المحفظة الجغرافية |
| ذكر **F1** في أي مادة تسليم | حتى يُنشر جدول دقة الحقول |

---

## 6. نقاط التكامل

| النقطة | ما يجب أن يكون صحيحاً عندها |
|---|---|
| **بعد G0** | `46/46` أخضر، وقائمة الملفات المجمَّدة أُفرِج عنها رسمياً |
| **بعد A1–A5** | `consistency-gate` أخضر؛ صفر ادعاء متعارض قابل للوصول |
| **بعد B1+B2** | `impact-golden` أخضر، `decision-diversity` أخضر، WZDx يطابق الجدول الجديد، كل رقم منشور يطابق المحفظة الجديدة |
| **بعد C1** | صفر رقم مسار مفرد في HTML الناتج |
| **بعد D1** | 401 بلا مفتاح، **و422 بأسماء الحقول ما زال يعمل** |
| **بعد E1–E3** | التبويبات السبعة متمايزة، `deskList` ارتفاعه > 400 عند 390، التنبؤ داخل المكتب |
| **بعد G1** | العرض مولَّد من HEAD، وبوابة التسليم خضراء |

---

## 7. الاختبارات المشتركة — تُشغَّل بعد كل دمج

```bash
node tests/run-all.js
```

```bash
python tests/layout-gate.py
```

الحزم التي تمسّ المحرك (A2, B1, B2, C1) تشغّل إضافةً:

```bash
node tests/impact-golden-test.js && node tests/decision-diversity-test.js
```

---

## 8. ترتيب الدمج الآمن — **V2**

```
Gate 0 (بوابة دائمة: 46/46 قبل كل دمج)
├─ [متوازٍ] D1 → D2 → D3(P1، فصل المهام)
├─ [متوازٍ] H2 · H4 · E4 · H3
├─ [متوازٍ] T4 ─────────────────────────────► (يولّد المجموعة الذهبية) ──► F1 (P2 مشروطة)
├─ [متوازٍ] J1 → J2
└─ [تسلسلي] A1 → A2 → A5 → T1 → B1+B2 → C1 → T2 → E1 → E2 → E3 → B3 → A3 → B4 → G1 → G2 → G3 → H1
                                                   └─ T3 (بعد D2)
                                                   └─ [بعد رفع التجميد] I1 · I2
```

**تغيّر جوهري:** `T1` أُدخلت **بين A5 و B1**. تعرّف عقد القيمة الذي ستنتجه B1 وC1؛ بناؤها بعدهما = إعادة كتابة مخرجاتهما.
**`C2` حُذفت** من السلسلة (ابتُلعت في T1). **`F2` حُذفت** (مرفوضة). **`A3` انتقلت متأخرة** (خُفضت إلى P1).

**قاعدة أخيرة:** لا يُدمج فرعان يمسّان `masar-engine.js` أو `masar-desk-boot.js` في اليوم نفسه. الملفان كبيران والدمج فيهما مكلف.
