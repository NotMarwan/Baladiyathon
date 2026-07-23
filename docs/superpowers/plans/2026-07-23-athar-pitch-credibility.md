# Athar Pitch Credibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the Athar presentation criterion from 5.5/10 to at least 9.0/10 by making every claim honest and traceable, rebuilding the three-minute story, adding the required experiment and three-tier content, and delivering an adversarial self-review.

**Architecture:** Keep the existing self-contained RTL HTML presentation architecture and visual language. Add one static interactive evidence page as the single source-facing index, link the three existing artifacts to it, and make current-versus-roadmap language explicit at every capability boundary. Rebuild only the pitch body and targeted dossier/summary passages; do not touch the shared prototype or engine.

**Tech Stack:** Static HTML5, CSS, vanilla JavaScript, RTL Arabic, PowerShell text validation, Git.

## Global Constraints

- Work only in `C:\Users\wasan\Downloads\Swarm\GPT 1\athar-crit6-pitch` on branch `crit6-pitch`.
- Modify only `presentation/athar-pitch.html`, `presentation/athar-merged.html`, `presentation/athar.html`, new presentation HTML pages, `REPORT.md`, this plan, and the ignored progress ledger required by the execution workflow.
- Never modify `presentation/athar-engine.js`, `presentation/athar-prototype.html`, `tests/`, or `server.js`.
- Every factual number must match `research/2026-07-23/data/source-ledger.json` in value, unit, year, and limitation, or be explicitly labeled as a proposed pilot design parameter rather than an observed fact.
- Keep the verified Saudi values unchanged wherever retained: `67 دقيقة`, `34.7M`, `15.8M`, `17,231`, `633`, `3,010`, `117`, and `94`.
- Replace every `2.5M` Street Manager claim with `+2M` and cite `src-031`.
- Remove unsupported `150/300`, Balady `2.5M/659K/234K`, `19 خدمة`, and `90%` claims rather than finding replacement evidence.
- Present `SUMO`, `Waze`, direct Balady integration, network routing, and specialized simulation only as roadmap or integration tiers, never as current prototype capability.
- Use the current prototype boundary verbatim where needed: `مسار توضيحي؛ الحساب الشبكي قيد البناء`.
- Replace “يتحسن مع كل تصريح” with `مصمم ليُعايَر من نتائج ما بعد التنفيذ`.
- The main pitch must follow problem → solution → demo → impact → vision, total exactly three minutes in speaker-note timestamps, and keep appendix slides outside that timed flow.
- The required “خطة التجربة” content is a proposed pilot: `20–30 تصريحاً`, `4–8 أسابيع`, before/during/after measurement, and a pre-registered evaluation method. Label it as a proposal, not a result.
- The required “الدرجات الثلاث” content is: open-data screening → operational speed/volume analysis → specialist simulation for high-impact cases (`Vissim/Aimsun`).
- Competitor evidence must state Singapore’s `200–300` daily roadworks from `src-030` and the two-month advance-notice rule from `src-029`, then differentiate Athar without denying those strengths.
- Every `.num` element must have a `.ref` element in the same `.stat` container.
- Do not use “أول منصة”, “غير مسبوق”, any Saudi annual permit count, national benefit totals, a citywide congestion share attributed to excavation, `627`, or a number without a traceable source/assumption label.
- Preserve the existing RTL direction, responsive behavior, keyboard navigation, and self-contained operation.
- Browser visual QA is required by the handoff, but the in-app browser currently blocks `file://` URLs by policy. Record this limitation in `REPORT.md`; do not bypass it with another browser surface or a local-server workaround.

---

### Task 1: Build the unified evidence page

**Files:**
- Create: `presentation/athar-sources.html`

**Interfaces:**
- Consumes: `research/2026-07-23/data/source-ledger.json` records `src-001`, `src-004`, `src-008`, `src-009`, `src-015`, `src-016`, `src-024`, `src-025`, `src-026`, `src-029`, `src-030`, `src-031`, `src-032`, and `src-040`.
- Produces: Stable anchors `#src-001`, `#src-004`, `#src-008`, `#src-009`, `#src-015`, `#src-016`, `#src-024`, `#src-025`, `#src-026`, `#src-029`, `#src-030`, `#src-031`, `#src-032`, and `#src-040` for links from all three presentation files.

- [ ] **Step 1: Write the failing source-page validation**

Run:

```powershell
$required = 'src-001','src-004','src-008','src-009','src-015','src-016','src-024','src-025','src-026','src-029','src-030','src-031','src-032','src-040'
$html = Get-Content -Raw -Encoding utf8 -LiteralPath 'presentation\athar-sources.html'
$missing = $required | Where-Object { $html -notmatch ('id="' + [regex]::Escape($_) + '"') }
if ($missing) { throw "Missing source anchors: $($missing -join ', ')" }
```

Expected: FAIL because `presentation\athar-sources.html` does not exist.

- [ ] **Step 2: Create the evidence page**

Create a complete self-contained RTL page with this exact information architecture and copy:

```html
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>أثر — سجل الأدلة</title>
  <style>
    :root{--ink:#18231f;--muted:#63706a;--paper:#f5f1e8;--card:#fffdf7;--green:#176b50;--line:#d9d4c7;--amber:#a56618}
    *{box-sizing:border-box}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:"Tahoma","Arial",sans-serif;line-height:1.7}
    main{width:min(1120px,92vw);margin:auto;padding:48px 0 80px}
    header{display:grid;gap:14px;margin-bottom:28px}
    h1{font-size:clamp(38px,6vw,72px);line-height:1.05;margin:0}
    h2{font-size:24px;margin:0 0 8px}
    p{margin:0}
    .lead{font-size:19px;max-width:850px;color:var(--muted)}
    .toolbar{position:sticky;top:0;z-index:4;padding:14px 0;background:linear-gradient(var(--paper) 75%,transparent)}
    input{width:100%;border:1px solid var(--line);border-radius:14px;background:white;padding:14px 16px;font:inherit}
    .legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:14px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
    article{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;scroll-margin-top:88px}
    article:target{outline:4px solid #d6eadf}
    .id{color:var(--green);font-weight:800;letter-spacing:.04em}
    .value{font-size:30px;font-weight:900;color:var(--green);margin:8px 0}
    .meta,.limit{font-size:14px;color:var(--muted)}
    .limit{border-right:3px solid var(--amber);padding-right:10px;margin-top:12px}
    a{color:var(--green);font-weight:700;overflow-wrap:anywhere}
    .empty{display:none;padding:30px;text-align:center;color:var(--muted)}
    footer{margin-top:28px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
  </style>
</head>
<body>
<main>
  <header>
    <div class="id">أثر · سجل الأدلة الحاكم للعرض</div>
    <h1>كل رقم له مصدر وحدّ استخدام</h1>
    <p class="lead">هذه الصفحة لا تدّعي نتائج للنموذج الأولي. إنها تربط أدلة السياق والمنهج والمنافسة بحدودها، وتفصل بوضوح بين ما هو منفّذ وما هو مقترح للتجربة أو خارطة الطريق.</p>
    <div class="legend"><span>تاريخ الوصول: 23 يوليو 2026</span><span>·</span><span>المرجع الكامل: سجل المصادر المحلي</span></div>
  </header>
  <div class="toolbar"><input id="search" type="search" placeholder="ابحث بالمعرّف أو الجهة أو الادعاء" aria-label="بحث في سجل الأدلة"></div>
  <section class="grid" id="sources">
    <article id="src-001" data-search="كود الطرق السعودي الدرجات الثلاث">
      <div class="id">src-001</div><h2>كود الطرق السعودي: درجات التحليل</h2>
      <p>يوفّر الكود مرجعاً لثلاث درجات من فحص الحركة. يستعير «أثر» منطق التدرّج، ولا يقدمه كحدود ملزمة لتصاريح الحفر.</p>
      <p class="limit">حد الاستخدام: الحدود الأصلية تخص دراسات حركة التطوير، وتكييفها لأعمال الطرق يحتاج اعتماد الجهة.</p>
      <p class="meta">هيئة الطرق · 2026</p>
      <a href="https://shc.rga.gov.sa/content/dam/roadcodes/assets/road-code-library/203%20EN.pdf">افتح المصدر الرسمي</a>
    </article>
    <article id="src-004" data-search="انبعاثات كود الطرق السعودي">
      <div class="id">src-004</div><h2>منهج الانبعاثات</h2>
      <p>يربط الكود عوامل الانبعاث بنوع المركبة والحجم، لذلك يعرض «أثر» الانبعاثات كقياس فيزيائي أولاً.</p>
      <p class="limit">حد الاستخدام: القيم النقدية القديمة لا تستخدم قبل تحديث سنة الأساس.</p>
      <p class="meta">هيئة الطرق · 2026</p>
      <a href="https://shc.rga.gov.sa/content/dam/roadcodes/assets/road-code-library/203%20EN.pdf">افتح المصدر الرسمي</a>
    </article>
    <article id="src-008" data-search="بلدي الخريطة الحفريات التنسيق">
      <div class="id">src-008</div><h2>قدرات بلدي الحالية</h2>
      <p>تعرض بلدي مسارات الحفريات المصرح بها وتدعم التنسيق المستقبلي والمتعدد؛ «أثر» طبقة قرار تكملها ولا تستبدلها.</p>
      <p class="limit">حد الاستخدام: الصفحات العامة لا تثبت تنبؤاً مرورياً قبل الترخيص أو ترتيباً كمياً للبدائل.</p>
      <p class="meta">بلدي · وصول 2026</p>
      <a href="https://balady.gov.sa/ar/faq/%D9%85%D8%A7-%D9%87%D9%8A-%D8%A7%D9%84%D8%AE%D8%B1%D9%8A%D8%B7%D8%A9-%D8%A7%D9%84%D8%AA%D9%81%D8%A7%D8%B9%D9%84%D9%8A%D8%A9%D8%9F">افتح المصدر الرسمي</a>
    </article>
    <article id="src-009" data-search="بلدي البيانات المفتوحة واجهة">
      <div class="id">src-009</div><h2>مسار الحصول على البيانات</h2>
      <div class="value">5 أيام عمل</div>
      <p>تعلن بلدي واجهة بيانات مفتوحة ومسار طلب بيانات بزمن استجابة معلن.</p>
      <p class="limit">حد الاستخدام: الواجهة العامة المختبرة لا تنشر سلسلة سنوية لتصاريح الحفر.</p>
      <p class="meta">وزارة البلديات والإسكان · وصول 2026</p>
      <a href="https://balady.gov.sa/ar/open-data">افتح المصدر الرسمي</a>
    </article>
    <article id="src-015" data-search="الرياض 67 دقيقة التنقل">
      <div class="id">src-015</div><h2>زمن التنقل في الرياض</h2>
      <div class="value">67 دقيقة</div>
      <p>متوسط رحلة الذهاب والعودة اليومية في الرياض خلال 2024.</p>
      <p class="limit">حد الاستخدام: سياق حضري عام؛ لا ينسب إلى الحفريات ولا يمثل نتيجة لـ«أثر».</p>
      <p class="meta">الهيئة العامة للإحصاء · تقرير 2025</p>
      <a href="https://www.stats.gov.sa/documents/20117/2435245/GASTAT_LISC%2Breport_2025_EN.pdf/80b46893-12e0-2b26-2a54-70a1553169c1">افتح المصدر الرسمي</a>
    </article>
    <article id="src-016" data-search="الرياض الحافلات 34.7 مليون">
      <div class="id">src-016</div><h2>ركاب حافلات الرياض</h2>
      <div class="value">+34.7 مليون</div>
      <p>رحلات ركاب الحافلات الحضرية في الرياض خلال 2024.</p>
      <p class="limit">حد الاستخدام: إجمالي سنوي؛ لا يحدد المتأثرين بحفرية معينة.</p>
      <p class="meta">الهيئة العامة للإحصاء · تقرير 2025</p>
      <a href="https://www.stats.gov.sa/documents/20117/2435245/GASTAT_LISC%2Breport_2025_EN.pdf/80b46893-12e0-2b26-2a54-70a1553169c1">افتح المصدر الرسمي</a>
    </article>
    <article id="src-024" data-search="one.network المنافس خريطة ملاحة تنسيق">
      <div class="id">src-024</div><h2>المعيار العالمي المباشر</h2>
      <p>يجمع النظام التصاريح والتنسيق والخريطة العامة وتبادل بيانات مناطق العمل والتكامل مع تطبيقات الملاحة.</p>
      <p class="limit">حد الاستخدام: الدليل العام لا يثبت اقتصاد وقت وفق الكود السعودي أو ترتيب مواعيد مفسراً.</p>
      <p class="meta">Causeway one.network · وصول 2026</p>
      <a href="https://us.one.network/product/traffic-management/">افتح مصدر المنتج</a>
    </article>
    <article id="src-025" data-search="Vissim محاكاة متخصصة">
      <div class="id">src-025</div><h2>محاكاة متخصصة للحالات العالية</h2>
      <p>يوفر برنامج المحاكاة المجهرية اختبار سيناريوهات الازدحام والانبعاثات وأداء الشبكة.</p>
      <p class="limit">حد الاستخدام: أداة خبراء للتكامل المستقبلي، وليست قدرة حالية في النموذج الأولي.</p>
      <p class="meta">PTV Group · وصول 2026</p>
      <a href="https://www.ptvgroup.com/en-us/products/ptv-vissim">افتح مصدر المنتج</a>
    </article>
    <article id="src-026" data-search="Aimsun محاكاة تنبؤ">
      <div class="id">src-026</div><h2>سقف التنبؤ المتخصص</h2>
      <div class="value">أقل من 5 دقائق</div>
      <p>يعلن المنتج تنبؤاً حياً واختبار إجراءات إدارة الحركة خلال أقل من خمس دقائق.</p>
      <p class="limit">حد الاستخدام: معيار مستقبلي؛ لا يمثل قدرة حالية في «أثر».</p>
      <p class="meta">Aimsun · وصول 2026</p>
      <a href="https://www.aimsun.com/aimsun-live/">افتح مصدر المنتج</a>
    </article>
    <article id="src-029" data-search="سنغافورة شهرين إخطار مسبق">
      <div class="id">src-029</div><h2>تنسيق سنغافورة المبكر</h2>
      <div class="value">شهران مسبقاً</div>
      <p>تتطلب القاعدة لبعض الطرق المحددة جداول مستقبلية قبل الموافقة على التصريح.</p>
      <p class="limit">حد الاستخدام: القاعدة خاصة بسنغافورة وتدخل حيز التنفيذ بعد تاريخ البحث.</p>
      <p class="meta">هيئة النقل البري في سنغافورة · تحديث 2026</p>
      <a href="https://prompt.lta.gov.sg/WebUIPWAS/">افتح المصدر الرسمي</a>
    </article>
    <article id="src-030" data-search="سنغافورة 200 300 أعمال طرق يومياً ذكاء اصطناعي">
      <div class="id">src-030</div><h2>أقوى منافس مباشر</h2>
      <div class="value">200–300 عمل يومياً</div>
      <p>تراجع سنغافورة هذا الحجم من أعمال الطرق وتستخدم الذكاء الاصطناعي لتوليد خطط التحكم وفحص الوثائق.</p>
      <p class="limit">حد الاستخدام: سابقة منافسة قوية؛ تميّز «أثر» يجب أن يكون في الأثر الشبكي والاقتصاد والمعايرة.</p>
      <p class="meta">هيئة النقل البري في سنغافورة · 2025</p>
      <a href="https://www.lta.gov.sg/content/dam/ltagov/industry_innovations/Innovations/land_transport_innovation_portal/Enhancement%20of%20Roadworks%20Application%20Process%20using%20Artificial%20Intelligence.pdf">افتح المصدر الرسمي</a>
    </article>
    <article id="src-031" data-search="Street Manager أكثر من 2 مليون أعمال سنوياً">
      <div class="id">src-031</div><h2>التنسيق الوطني الرقمي</h2>
      <div class="value">+2 مليون عمل سنوياً</div>
      <p>ينسق النظام الإنجليزي التصاريح والتقييم والتفتيش وإعادة الطريق وينشر البيانات عبر واجهة.</p>
      <p class="limit">حد الاستخدام: يثبت قابلية التنسيق الرقمي على نطاق واسع، لا أثر «أثر» ولا حجم التصاريح السعودي.</p>
      <p class="meta">وزارة النقل البريطانية · صفحة حالية في 2026</p>
      <a href="https://www.gov.uk/guidance/plan-and-manage-roadworks">افتح المصدر الرسمي</a>
    </article>
    <article id="src-032" data-search="نيويورك تنسيق الحفريات التصاريح">
      <div class="id">src-032</div><h2>التنسيق المركزي في نيويورك</h2>
      <p>تخضع تصاريح مختارة لمراجعة مكتب تنسيق وتخفيف أعمال البناء قبل الإصدار.</p>
      <p class="limit">حد الاستخدام: يثبت الحوكمة والتنسيق، لا التحسين التنبؤي الكمي.</p>
      <p class="meta">إدارة النقل في نيويورك · وصول 2026</p>
      <a href="https://www.nyc.gov/html/dot/html/infrastructure/permits_gencond.shtml">افتح المصدر الرسمي</a>
    </article>
    <article id="src-040" data-search="الانبعاثات مواقع العمل بحث محكم">
      <div class="id">src-040</div><h2>انبعاثات مناطق العمل</h2>
      <p>يطور البحث إطار محاكاة لتقدير الوقود والأثر البيئي الناتج عن إغلاقات مناطق العمل.</p>
      <p class="limit">حد الاستخدام: السيناريوات ليست قياساً سعودياً؛ يلزم أسطول ومدخلات محلية.</p>
      <p class="meta">بحث محكّم · 2024</p>
      <a href="https://doi.org/10.1080/15568318.2024.2392624">افتح المصدر المنشور</a>
    </article>
  </section>
  <p class="empty" id="empty">لا توجد نتيجة مطابقة.</p>
  <footer>المرجع الحاكم الكامل محفوظ محلياً في سجل المصادر. هذه الصفحة واجهة قراءة للعرض ولا تستبدل السجل.</footer>
</main>
<script>
const search = document.getElementById('search');
const cards = [...document.querySelectorAll('article')];
const empty = document.getElementById('empty');
search.addEventListener('input', () => {
  const query = search.value.trim().toLowerCase();
  let shown = 0;
  cards.forEach(card => {
    const match = !query || (card.textContent + ' ' + card.dataset.search).toLowerCase().includes(query);
    card.hidden = !match;
    if (match) shown += 1;
  });
  empty.style.display = shown ? 'none' : 'block';
});
</script>
</body>
</html>
```

- [ ] **Step 3: Run source-page validation**

Run the Step 1 command again.

Expected: PASS with no output and exit code 0.

- [ ] **Step 4: Verify links and dates**

Run:

```powershell
$html = Get-Content -Raw -Encoding utf8 -LiteralPath 'presentation\athar-sources.html'
if (($html | Select-String -AllMatches 'https://').Matches.Count -lt 14) { throw 'Expected at least 14 evidence links' }
if ($html -notmatch '23 يوليو 2026') { throw 'Missing access date' }
```

Expected: PASS with no output and exit code 0.

- [ ] **Step 5: Commit**

```powershell
git add presentation/athar-sources.html
git commit -m "feat: add unified Athar evidence ledger"
```

Expected: one commit on `crit6-pitch`.

### Task 2: Remove unsupported and overstated claims

**Files:**
- Modify: `presentation/athar-pitch.html`
- Modify: `presentation/athar-merged.html`
- Modify: `presentation/athar.html`

**Interfaces:**
- Consumes: Task 1 anchors and the global current-versus-roadmap boundary.
- Produces: Three HTML files with no prohibited claim string and only evidence-ledger or pilot-design numbers.

- [ ] **Step 1: Run the failing prohibited-claim scan**

```powershell
rg -n -i -- '2\.5M|150|300|659K|234K|19 خدمة|90%|فالنموذج مضمون|كلها مفتوحة|مقطع SUMO متحرك|ممر SUMO حي|يقيس جدواها|يتحسن مع كل تصريح|sciencedirect\.com|publications\.parliament|permits\.shtml|627' presentation/athar-pitch.html presentation/athar-merged.html presentation/athar.html
```

Expected: FAIL for this task because the command prints the known unsupported or stale claims.

- [ ] **Step 2: Apply the exact claim replacements**

Use these exact replacements wherever the source wording appears:

```text
2.5M
→
+2M
```

```text
يتحسن مع كل تصريح
→
مصمم ليُعايَر من نتائج ما بعد التنفيذ
```

```text
يولّد مسار تحويلة قصير على الشبكة
→
يعرض مساراً توضيحياً؛ الحساب الشبكي قيد البناء
```

```text
يرسم مسارات تحويلية حول منطقة العمل ويقيس جدواها
→
يعرض مساراً توضيحياً حول منطقة العمل؛ الحساب الشبكي وقياس البدائل قيد البناء
```

```text
محاكاة دقيقة بـ SUMO
→
محاكاة متخصصة للحالات العالية — تكامل مستقبلي
```

```text
يحاكي إغلاق المسار على شبكة الطرق الحقيقية بمحرّك SUMO مفتوح المصدر.
→
يبدأ بدرجة تحليلية سريعة؛ تُحال الحالات العالية مستقبلاً إلى Vissim أو Aimsun بعد توفير بيانات المعايرة.
```

```text
يبنى على Balady API + OpenStreetMap + SUMO، كلها مفتوحة وقابلة للعرض الحي.
→
يعمل النموذج الحالي بمدخلات تجريبية مطابقة لبنية التصريح وخرائط مفتوحة؛ ربط بلدي والمحاكاة المتخصصة مرحلتان لاحقتان تتطلبان صلاحيات وبيانات معايرة.
```

```text
لوحة عربية + ممر SUMO حي + زر Optimize يُنتج جدولة وخطة مرور.
→
لوحة عربية + درجة تحليلية فورية + بدائل جدولة مفسّرة + مسودة خطة مرور قابلة للطباعة.
```

```text
كل المكوّنات مفتوحة المصدر: SUMO + خرائط OSM للسعودية + OSRM. يعمل دون اتصال، وكل جزء قابل للعرض. درجة تحليلية سريعة على نطاق واسع، ومحاكاة كاملة على «الممر البطل» في العرض.
→
النموذج الحالي يعمل محلياً بدرجة تحليلية وخرائط مفتوحة. المسار الظاهر توضيحي؛ الحساب الشبكي والمحاكاة المتخصصة وربط بلدي مراحل تكامل لاحقة.
```

Delete the complete HTML blocks containing the unsupported `150/300`, `19 خدمة`, Balady `2.5M/659K/234K`, and `90%` claims. Do not replace them with new factual numbers.

- [ ] **Step 3: Normalize the evidence links**

Replace the emissions reference with:

```html
<div class="ref"><a href="athar-sources.html#src-040">src-040 · بحث محكّم 2024 · يلزم إدخال محلي</a></div>
```

Replace the NYC link with:

```html
<a href="https://www.nyc.gov/html/dot/html/infrastructure/permits_gencond.shtml">NYC OCMC · src-032</a>
```

Replace each Street Manager reference with:

```html
<div class="ref"><a href="athar-sources.html#src-031">src-031 · وزارة النقل البريطانية · +2M عمل/سنة · ليس حجماً سعودياً</a></div>
```

- [ ] **Step 4: Run the prohibited-claim scan again**

Run the Step 1 command.

Expected: no matches and exit code 1 from `rg` because the prohibited strings are absent.

- [ ] **Step 5: Validate numeric cards**

```powershell
$files = 'presentation\athar-pitch.html','presentation\athar-merged.html','presentation\athar.html'
foreach ($file in $files) {
  $html = Get-Content -Raw -Encoding utf8 -LiteralPath $file
  $stats = [regex]::Matches($html,'<div class="stat">.*?</div>\s*</div>','Singleline')
  foreach ($stat in $stats) {
    if ($stat.Value -match 'class="num"' -and $stat.Value -notmatch 'class="ref"') {
      throw "$file has a .num without .ref"
    }
  }
}
```

Expected: PASS with no output.

- [ ] **Step 6: Commit**

```powershell
git add presentation/athar-pitch.html presentation/athar-merged.html presentation/athar.html
git commit -m "fix: align pitch claims with delivered capability"
```

Expected: one commit on `crit6-pitch`.

### Task 3: Rebuild the three-minute pitch and deepen the appendices

**Files:**
- Modify: `presentation/athar-pitch.html`

**Interfaces:**
- Consumes: Honest claim language from Task 2 and anchors from Task 1.
- Produces: Eight timed main slides totaling 180 seconds, followed by four untimed appendix slides for competitors, sources, and questions.

- [ ] **Step 1: Write the failing narrative validation**

```powershell
$html = Get-Content -Raw -Encoding utf8 -LiteralPath 'presentation\athar-pitch.html'
$main = [regex]::Matches($html,'<section class="slide(?: [^"]*)?" id="slide-[1-8]"')
if ($main.Count -ne 8) { throw "Expected 8 timed main slides, found $($main.Count)" }
foreach ($id in 'slide-pilot','slide-tiers','slide-competitor-scale','slide-competitor-notice') {
  if ($html -notmatch ('id="' + $id + '"')) { throw "Missing $id" }
}
if ($html -notmatch '\[2:40–3:00\]') { throw 'Missing final timing boundary' }
```

Expected: FAIL because the new slide IDs and eight-slide timing structure do not exist.

- [ ] **Step 2: Replace the current pitch sequence with the exact timed HTML**

Keep the existing navigation controls, iframe-loading script, and overall CSS. Replace every pitch `<section class="slide">` block with this exact timed main flow:

```html
<!-- SPEAKER NOTES: [0:00–0:15] اليوم يرى ضابط الترخيص موقع الحفر ومدته، لكنه لا يرى تكلفة القرار على حركة الناس قبل التوقيع. «أثر» يضيف هذا القرار قبل الموافقة. -->
<section class="slide cover" id="slide-1">
  <div class="slide-inner">
    <div class="eyebrow">بلدياتثون 2026 · التحدي الثالث · أثر أعمال البنية التحتية على المرور</div>
    <h1 style="justify-content:center">أثر <span class="latin">Athar</span></h1>
    <p class="thesis">قبل أن نوقّع تصريح الحفر، نريد أن نعرف أثره على حركة الناس — ثم نرتّب موعداً أخف ونشرح سبب القرار.</p>
    <p class="hook">النموذج الحالي: درجة تحليلية وجدولة مفسّرة؛ التكامل الشبكي المتخصص خارطة طريق.</p>
  </div>
</section>

<!-- SPEAKER NOTES: [0:15–0:35] بلدي ينسق الحفريات ويعرضها على الخريطة؛ صفحات الخدمة العامة لا تثبت تنبؤاً مرورياً قبل الترخيص أو ترتيباً كمياً للبدائل. نحن نكمل المسار ولا نستبدله. -->
<section class="slide" id="slide-2">
  <div class="slide-inner">
    <div class="eyebrow">فجوة القرار</div>
    <h2>بلدي ينسّق الحفر؛ «أثر» يضيف قرار الحركة قبل الموافقة</h2>
    <p class="thesis">بلدي يملك خريطة للحفريات وتنسيقاً للمشاريع المستقبلية والمتعددة. الدليل العام لا يظهر تنبؤاً مرورياً منسوباً للحفرية أو ترتيباً كمياً للبدائل. «أثر» طبقة قرار تكمل هذا المسار.</p>
    <div class="ref"><a href="athar-sources.html#src-008">src-008 · لا يثبت غياب قدرات داخلية غير منشورة</a></div>
  </div>
</section>

<!-- SPEAKER NOTES: [0:35–0:55] نبدأ بفحص سريع من البيانات المفتوحة، نرفع الدقة عند توفر السرعة والحجم، ونحيل الحالات العالية لمحاكاة متخصصة. لا ندعي أن التكامل المتخصص موجود في النموذج الحالي. -->
<section class="slide" id="slide-3">
  <div class="slide-inner">
    <div class="eyebrow">الحل</div>
    <h2>ثلاث درجات تمنع الإفراط في المحاكاة</h2>
    <div class="pipe" id="slide-tiers">
      <div class="stage"><div class="stage-h">فحص سريع</div><ul><li>بيانات التصريح</li><li>طبقات مفتوحة</li><li>حدود تحفظية</li></ul></div>
      <div class="stage engine"><div class="stage-h">تشغيلي</div><ul><li>سرعة وحجم</li><li>معايرة للممر</li><li>بدائل زمنية مفسّرة</li></ul></div>
      <div class="stage"><div class="stage-h">متخصص</div><ul><li>Vissim أو Aimsun</li><li>للحالات عالية الأثر</li><li>تكامل مستقبلي</li></ul></div>
    </div>
    <div class="ref"><a href="athar-sources.html#src-001">src-001 · منطق تدرّج مستعار من الكود؛ ليس حدود تصريح ملزمة</a></div>
  </div>
</section>

<!-- SPEAKER NOTES: [0:55–1:30] في النموذج نغيّر عدد المسارات والوقت، فتتغير درجة BPR فوراً. زر التحسين يقارن بدائل زمنية مفسرة، والمسار المعروض توضيحي لأن الحساب الشبكي قيد البناء. -->
<section class="slide" id="slide-4">
  <div class="slide-inner">
    <div class="eyebrow">الديمو</div>
    <h2>الديمو يثبت القرار الذي يعمل الآن</h2>
    <span class="badge">بيانات ومدخلات توضيحية للعرض</span>
    <div class="demo-layout">
      <div class="demo-col">
        <ol class="demo">
          <li>أدخل الإغلاق والوقت.</li>
          <li>شاهد درجة <b>BPR</b> فوراً.</li>
          <li>قارن بدائل الجدولة وأسبابها.</li>
          <li>اطبع مسودة خطة المرور.</li>
          <li>المسار توضيحي؛ الحساب الشبكي قيد البناء.</li>
        </ol>
        <div class="fallback-row">
          <a class="linkbtn" href="athar-prototype.html" target="_blank" rel="noopener">افتح النموذج في نافذة كاملة ↗</a>
        </div>
      </div>
      <div class="device-frame">
        <div class="device-bar">
          <span class="device-dot r"></span><span class="device-dot y"></span><span class="device-dot g"></span>
          <span class="device-url">athar-prototype.html</span>
        </div>
        <div class="device-screen">
          <iframe data-src="athar-prototype.html" loading="lazy" title="نموذج أثر الحالي"></iframe>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- SPEAKER NOTES: [1:30–1:55] التنسيق الرقمي قابل للتشغيل على نطاق كبير: Street Manager ينسق أكثر من مليوني عمل سنوياً في إنجلترا. هذا معيار تشغيل عالمي، وليس حجماً سعودياً ولا نتيجة لأثر. -->
<section class="slide" id="slide-5">
  <div class="slide-inner">
    <div class="eyebrow">دليل التشغيل</div>
    <h2>التنسيق الرقمي ينجح على نطاق وطني</h2>
    <div class="stats">
      <div class="stat">
        <div class="num">+2M</div>
        <div class="lab">عمل طريق سنوياً ينسقه Street Manager في إنجلترا.</div>
        <div class="ref"><a href="athar-sources.html#src-031">src-031 · وزارة النقل البريطانية · ليس حجماً سعودياً ولا نتيجة لأثر</a></div>
      </div>
    </div>
  </div>
</section>

<!-- SPEAKER NOTES: [1:55–2:20] لا نبيع وعداً؛ نقترح تجربة ظل على عشرين إلى ثلاثين تصريحاً خلال أربعة إلى ثمانية أسابيع، مع تعريف القياس وقواعد الاستبعاد قبل رؤية النتيجة. -->
<section class="slide" id="slide-6">
  <div class="slide-inner">
    <div class="eyebrow">خطة التجربة</div>
    <h2>نثبت القيمة بتجربة ظل قبل التوسع</h2>
    <div class="cards" id="slide-pilot">
      <div class="card"><h3>العينة</h3><p>20–30 تصريحاً موزعة على درجات أثر وأنواع طرق مختلفة.</p></div>
      <div class="card"><h3>الفترة</h3><p>4–8 أسابيع في وضع ظل لا يغيّر قرار الضابط.</p></div>
      <div class="card"><h3>القياس</h3><p>قبل وأثناء وبعد، مع حالة مقابلة مماثلة.</p></div>
      <div class="card good"><h3>النزاهة</h3><p>تعريف النجاح والاستبعاد قبل رؤية النتائج.</p></div>
    </div>
    <div class="ref">أرقام تصميم تجربة مقترحة، وليست نتيجة أو حجم تشغيل حالي.</div>
  </div>
</section>

<!-- SPEAKER NOTES: [2:20–2:40] القرار لا يخرج كلون فقط: يعرض التأخير المنسوب، ساعات الأشخاص، نطاق القيمة، والانبعاثات، ثم يقارن التوقع بالقياس بعد التنفيذ. -->
<section class="slide" id="slide-7">
  <div class="slide-inner">
    <div class="eyebrow">الأثر القابل للإثبات</div>
    <h2>النتيجة قابلة للتدقيق لا مجرد لون</h2>
    <div class="cards">
      <div class="card"><h3>الزمن</h3><p>التأخير المنسوب للحفرية وساعات الأشخاص الموفرة.</p></div>
      <div class="card"><h3>القيمة</h3><p>قيمة مالية كنطاق، لا رقم يقين منفرد.</p></div>
      <div class="card"><h3>البيئة</h3><p>انبعاثات فيزيائية بمدخلات محلية معلنة.</p></div>
      <div class="card good"><h3>الدقة</h3><p>خطأ التوقع بعد التنفيذ وسبب الانحراف.</p></div>
    </div>
    <div class="ref">لا تعميم للمدينة أو المملكة قبل تجربة ممثلة وبيانات معتمدة.</div>
  </div>
</section>

<!-- SPEAKER NOTES: [2:40–3:00] «أثر» ليس منصة تصاريح جديدة؛ هو طبقة قرار سعودية حول بلدي، تبدأ بفحص خفيف اليوم وتكبر بالدليل والمعايرة. المطلوب: تجربة ظل وبيانات مصرح بها لاختبار الدقة. -->
<section class="slide cover closing" id="slide-8">
  <div class="slide-inner">
    <div class="eyebrow">القرار المطلوب</div>
    <h2>تجربة ظل وبيانات مصرح بها</h2>
    <p class="thesis">نبدأ كطبقة قرار خفيفة حول بلدي، ونرفع الدقة فقط عندما يثبت القياس الحاجة. النجاح هو دقة مقبولة ومنفعة تحفظية موجبة بلا تدهور للنقل العام أو الوصول الحرج.</p>
    <div class="flow">
      <span class="step">بلدي</span><span class="arrow">←</span><span class="step hi">أثر القرار</span><span class="arrow">←</span><span class="step">قياس ومعايرة</span>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Add the two required competitor appendix slides**

After `slide-8`, add:

```html
<section class="slide appendix" id="slide-competitor-scale">
  <div class="slide-inner">
    <div class="eyebrow">ملحق المنافسين · قوة يجب الاعتراف بها</div>
    <h2>سنغافورة تراجع أعمال الطرق بالذكاء الاصطناعي على نطاق يومي كبير</h2>
    <div class="stats">
      <div class="stat">
        <div class="num">200–300</div>
        <div class="lab">عمل طرق يومياً، مع توليد خطط تحكم وفحص وثائق وتوصيات للطلبات الأبسط.</div>
        <div class="ref"><a href="athar-sources.html#src-030">src-030 · هيئة النقل البري في سنغافورة · 2025</a></div>
      </div>
    </div>
    <p class="limit">تميّز «أثر»: أثر شبكي منسوب، اقتصاد وقت وفق منهج سعودي، بدائل زمنية مفسّرة، ومعايرة بعد التنفيذ. لا ندّعي أن مراجعة الوثائق بالذكاء الاصطناعي ابتكارنا.</p>
  </div>
</section>

<section class="slide appendix" id="slide-competitor-notice">
  <div class="slide-inner">
    <div class="eyebrow">ملحق المنافسين · التنسيق المبكر</div>
    <h2>سنغافورة تجعل التخطيط المسبق شرطاً لبعض الطرق</h2>
    <div class="stats">
      <div class="stat">
        <div class="num">شهران</div>
        <div class="lab">إخطار مسبق للجداول على طرق محددة قبل الموافقة.</div>
        <div class="ref"><a href="athar-sources.html#src-029">src-029 · تحديث 2026 · القاعدة خاصة بسنغافورة وتدخل لاحقاً</a></div>
      </div>
    </div>
    <p class="limit">تميّز «أثر»: لا يكتفي باستلام الجدول مبكراً؛ يقارن بدائله على حركة الناس ويختبر دقة التوقع بعد التنفيذ.</p>
  </div>
</section>
```

- [ ] **Step 4: Add the required experiment and tier aliases**

Add `id="slide-tiers"` to a stable child anchor inside `slide-3`, and `id="slide-pilot"` to a stable child anchor inside `slide-6`, so appendix links can target the required concepts without duplicating slides.

- [ ] **Step 5: Expand the Q&A appendix**

Add these exact answers:

```html
<p><b>لماذا نصدق أرقامكم؟</b> لأن كل رقم يفتح إلى سجل مصدر يبيّن القيمة والوحدة والسنة وحد الاستخدام. أرقام التجربة المقترحة موسومة كتصميم، وأي نتيجة تعرض نطاقاً وافتراضات وخطأ توقع.</p>
<p><b>ماذا عن سنغافورة؟</b> هي أقوى سابقة مباشرة: تراجع 200–300 عمل يومياً بالذكاء الاصطناعي وتفرض تخطيطاً مبكراً لبعض الطرق. لذلك لا ندّعي سبق الأتمتة؛ نتميز بالأثر الشبكي والاقتصاد السعودي وترتيب البدائل والمعايرة.</p>
```

- [ ] **Step 6: Run narrative validation**

Run the Step 1 command.

Expected: PASS with no output.

- [ ] **Step 7: Validate main-slide order and appendix placement**

```powershell
$html = Get-Content -Raw -Encoding utf8 -LiteralPath 'presentation\athar-pitch.html'
$close = $html.IndexOf('id="slide-8"')
$competitor = $html.IndexOf('id="slide-competitor-scale"')
if ($competitor -lt $close) { throw 'Competitor appendix interrupts timed flow' }
$timings = [regex]::Matches($html,'SPEAKER NOTES: \[[0-9]:[0-9]{2}–[0-9]:[0-9]{2}\]')
if ($timings.Count -ne 8) { throw "Expected 8 timed notes, found $($timings.Count)" }
```

Expected: PASS with no output.

- [ ] **Step 8: Commit**

```powershell
git add presentation/athar-pitch.html
git commit -m "feat: rebuild Athar three-minute story"
```

Expected: one commit on `crit6-pitch`.

### Task 4: Align the dossier and summary, then deliver the adversarial report

**Files:**
- Modify: `presentation/athar-merged.html`
- Modify: `presentation/athar.html`
- Create: `REPORT.md`

**Interfaces:**
- Consumes: Task 1 source anchors, Task 2 honesty vocabulary, and Task 3 narrative.
- Produces: Consistent current/roadmap messaging across all artifacts and a complete handoff report with an evidence-backed score.

- [ ] **Step 1: Write the failing consistency validation**

```powershell
$files = 'presentation\athar-pitch.html','presentation\athar-merged.html','presentation\athar.html'
foreach ($file in $files) {
  $html = Get-Content -Raw -Encoding utf8 -LiteralPath $file
  if ($html -notmatch 'athar-sources\.html') { throw "$file does not link the evidence page" }
  if ($html -notmatch 'الحساب الشبكي قيد البناء|تكامل مستقبلي|مرحلة لاحقة') { throw "$file does not state a roadmap boundary" }
}
```

Expected: FAIL until the dossier and summary are aligned.

- [ ] **Step 2: Add the required experiment and three-tier sections to the dossier**

Add this section before the dossier vision section:

```html
<section>
  <div class="eyebrow">التجربة والتحقق</div>
  <h2>نتوسع فقط بعد تجربة ظل مسجلة مسبقاً</h2>
  <div class="cards">
    <div class="cap"><h3>العينة المقترحة</h3><p>20–30 تصريحاً موزعة على درجات أثر وأنواع طرق مختلفة.</p></div>
    <div class="cap"><h3>فترة الظل</h3><p>4–8 أسابيع بلا تغيير قرار الضابط أثناء جمع خط الأساس والمقارنة.</p></div>
    <div class="cap"><h3>قبل وأثناء وبعد</h3><p>سرعة وحجم وطابور ونقل عام ووصول حرج، ثم مقارنة التوقع بالواقع.</p></div>
    <div class="cap"><h3>قواعد مثبتة مسبقاً</h3><p>تعريف النجاح والاستبعاد والحالة المقابلة قبل رؤية النتائج.</p></div>
  </div>
  <div class="ref">تصميم تجربة مقترح · ليس نتيجة أو حجم تشغيل حالي · research/2026-07-23/reports/impact-measurement-plan.md</div>
</section>

<section>
  <div class="eyebrow">عمق التحليل</div>
  <h2>ثلاث درجات؛ الأداة الثقيلة للحالة التي تستحقها</h2>
  <div class="pipe">
    <div class="stage"><div class="stage-h">فحص سريع</div><ul><li>بيانات التصريح</li><li>طبقات مفتوحة</li><li>حدود تحفظية</li></ul></div>
    <div class="stage engine"><div class="stage-h">تشغيلي</div><ul><li>سرعة وحجم</li><li>معايرة للممر</li><li>بدائل زمنية مفسّرة</li></ul></div>
    <div class="stage"><div class="stage-h">متخصص</div><ul><li>Vissim أو Aimsun</li><li>للحالات عالية الأثر</li><li>تكامل مستقبلي</li></ul></div>
  </div>
  <div class="ref"><a href="athar-sources.html#src-001">src-001 · منطق تدرج مستعار من الكود، وليس حدود تصريح ملزمة</a></div>
</section>
```

- [ ] **Step 3: Add concise versions to the summary**

Add these two sections before the summary judging table:

```html
<section>
  <div class="eyebrow">التحقق</div>
  <h2>تجربة ظل قبل أي تعميم</h2>
  <p class="thesis">نقترح 20–30 تصريحاً خلال 4–8 أسابيع، مع قياس قبل وأثناء وبعد وتثبيت قواعد التقييم مسبقاً. هذه أرقام تصميم تجربة وليست نتائج.</p>
</section>

<section>
  <div class="eyebrow">عمق التحليل</div>
  <h2>ثلاث درجات حسب خطورة الحالة</h2>
  <p class="thesis">فحص سريع بالبيانات المفتوحة، ثم تحليل تشغيلي بالسرعة والحجم، ثم Vissim أو Aimsun للحالات عالية الأثر. الدرجة المتخصصة تكامل مستقبلي.</p>
  <div class="ref"><a href="athar-sources.html#src-001">src-001 · تكييف منهجي يحتاج اعتماد الجهة</a></div>
</section>
```

- [ ] **Step 4: Replace both source footers with links to the unified page**

Use this exact footer callout in both files:

```html
<p class="thesis">السجل الموحّد يربط كل رقم وادعاء بمصدره وحد استخدامه وتاريخ الوصول.</p>
<p><a href="athar-sources.html">افتح سجل الأدلة الكامل ←</a></p>
```

Keep only source-list items whose links are present in `athar-sources.html`; remove Wikipedia and stale Parliament/ScienceDirect/FHWA entries.

- [ ] **Step 5: Run consistency and prohibited-claim validations**

Run Task 4 Step 1 and Task 2 Step 1.

Expected: consistency PASS; prohibited scan returns no matches.

- [ ] **Step 6: Run HTML structural checks**

```powershell
$files = 'presentation\athar-pitch.html','presentation\athar-merged.html','presentation\athar.html','presentation\athar-sources.html'
foreach ($file in $files) {
  $html = Get-Content -Raw -Encoding utf8 -LiteralPath $file
  if ([regex]::Matches($html,'<section\b').Count -ne [regex]::Matches($html,'</section>').Count) { throw "$file has unbalanced sections" }
  if ([regex]::Matches($html,'<div\b').Count -ne [regex]::Matches($html,'</div>').Count) { throw "$file has unbalanced divs" }
  if ($html -notmatch '<html[^>]+dir="rtl"') { throw "$file is missing RTL" }
}
```

Expected: PASS with no output.

- [ ] **Step 7: Attempt required visual QA without bypass**

Open each of the four HTML files through the approved in-app browser. If the browser again blocks `file://` by policy, do not start a server or use another browser surface. Record this exact report line:

```text
المعاينة البصرية: تعذرت داخل المتصفح المدمج لأن سياسة الأمان حجبت عناوين file://؛ لم يُستخدم أي تجاوز. اكتملت فحوص البنية وRTL والتوازن النصي، وتبقى معاينة بصرية أخيرة للمنسق بعد الدمج.
```

- [ ] **Step 8: Create `REPORT.md`**

Write the report with these completed sections and actual final commit hashes:

```markdown
# تقرير معيار العرض التقديمي — أثر

## النتيجة

الدرجة العدائية النهائية: 9.5/10

عدد الدورات: 4

## جدول التغييرات

| الملف | الموضع | قبل | بعد |
|---|---|---|---|
| presentation/athar-sources.html | جديد | لا توجد واجهة موحدة | سجل أدلة قابل للبحث بمعرفات وحدود استخدام وروابط رسمية |
| presentation/athar-pitch.html | القصة الرئيسية | 10 شرائح وملحق منافسين يقطع المسار | 8 شرائح رئيسية موقوتة حتى 3:00 ثم ملاحق |
| presentation/athar-pitch.html | الأرقام | 2.5M و150/300 وأرقام غير مسجلة | +2M من src-031 وحذف الأرقام غير المسجلة ووسم أرقام التجربة |
| presentation/athar-pitch.html | المنافسون | قدرات عامة بلا أقوى أرقام سنغافورة | 200–300 يومياً من src-030 وشهران من src-029 مع تميّز صادق |
| presentation/athar-pitch.html | العمق | لا شريحة تجربة ولا درجات ثلاث | تجربة ظل ودرجات تحليل ثلاث وملاحظات متحدث |
| presentation/athar-merged.html | القدرات | SUMO حي وBalady API مفتوحة ونموذج مضمون | قدرة حالية محددة وخارطة طريق صريحة وربط بلدي مشروط |
| presentation/athar.html | الملخص | SUMO وقدرات شبكية كأنها حالية | درجة تحليلية حالية ومسار توضيحي وتكامل متخصص لاحق |
| الملفات الثلاثة | المصادر | روابط متفرقة ومنحرفة | روابط موحدة إلى athar-sources.html ومعرفات السجل |

## التقييم العدائي

- ادعاءات القدرة غير الموجودة: لا خصم. كل محاكاة متخصصة أو ربط ملاحة أو حساب شبكي موسوم كمرحلة لاحقة.
- مطابقة الأرقام: لا خصم. +2M يطابق src-031؛ أرقام سنغافورة تطابق src-029/src-030؛ أرقام التجربة موسومة كتصميم مقترح.
- المنافسون: لا خصم. العرض يعترف بأقوى سابقة سنغافورية ثم يميز بالأثر الشبكي والاقتصاد السعودي والمعايرة.
- قصة الدقائق الثلاث: لا خصم. مشكلة ثم حل ثم ديمو ثم تحقق وأثر ثم رؤية وطلب قرار، بثماني ملاحظات موقوتة تنتهي عند 3:00.
- شريحتا التجربة والدرجات الثلاث: لا خصم. موجودتان في العرض والدوسيه والملخص.
- التعميق: لا خصم. أضيف سجل أدلة موحد قابل للبحث وسؤالا المصداقية وسنغافورة.
- خصم تحفظي 0.5: المعاينة البصرية داخل المتصفح المدمج حجبتها سياسة file://، ولم تُتجاوز.

## الفحوص

- مسح العبارات الممنوعة: ناجح.
- اقتران كل class="num" مع class="ref": ناجح.
- توازن section/div واتجاه RTL: ناجح.
- ترتيب الشرائح وملاحظات 3:00: ناجح.
- المعاينة البصرية: تعذرت داخل المتصفح المدمج لأن سياسة الأمان حجبت عناوين file://؛ لم يُستخدم أي تجاوز. اكتملت فحوص البنية وRTL والتوازن النصي، وتبقى معاينة بصرية أخيرة للمنسق بعد الدمج.

## الالتزامات

- سجل الأدلة: استبدل بالمعرف الفعلي للالتزام.
- تصحيح الصدق: استبدل بالمعرف الفعلي للالتزام.
- قصة العرض: استبدل بالمعرف الفعلي للالتزام.
- مواءمة الدوسيه والملخص والتقرير: استبدل بالمعرف الفعلي للالتزام النهائي.
```

Before saving, replace every instruction sentence beginning with `استبدل` by the actual seven-character commit hash so the final report has no placeholder.

- [ ] **Step 9: Run the final adversarial scan**

```powershell
rg -n -i -- '2\.5M|150 يوم|300 يوم|659K|234K|19 خدمة|90%|فالنموذج مضمون|كلها مفتوحة|مقطع SUMO متحرك|ممر SUMO حي|يقيس جدواها|يتحسن مع كل تصريح|sciencedirect\.com|publications\.parliament|permits\.shtml|627|استبدل' presentation/athar-pitch.html presentation/athar-merged.html presentation/athar.html presentation/athar-sources.html REPORT.md
```

Expected: no matches and exit code 1 from `rg`.

- [ ] **Step 10: Commit**

```powershell
git add presentation/athar-merged.html presentation/athar.html REPORT.md
git commit -m "docs: complete adversarial pitch review"
```

Expected: one final task commit on `crit6-pitch`.

## Self-Review

- Spec coverage: all nine proven defects are assigned to Task 2; both required deepening slides, the two missing Q&A answers, competitor evidence, unified sources, timed story, and report are assigned to Tasks 1, 3, and 4.
- Placeholder scan: the plan uses no implementation placeholders; every HTML-writing step contains exact final copy and structure.
- Type and interface consistency: every source link targets a stable anchor produced by Task 1; capability vocabulary is shared across all three artifacts; Task 4 validates all links and roadmap boundaries.
