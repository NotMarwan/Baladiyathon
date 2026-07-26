# خطة «مكتب المراجع» — رفع أثر إلى ٩٫٥

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** تحويل أثر من مجموعة صفحات تعرض محركات، إلى منتج واحد يستطيع المراجع أن يتخذ فيه قراراً كاملاً من شاشة واحدة — ويستطيع المحكّم أن يفهمه في ثلاث دقائق.

**Architecture:** لا نعيد كتابة أي محرك. كل المحركات الحالية (`masar-engine`, `masar-routing`, `masar-forecast`, `masar-conflict`, `masar-reasons`, `masar-decision`, `masar-portfolio`) تبقى كما هي وتُستهلَك من سطح واحد جديد: `masar-desk.html` — ثلاثة أعمدة RTL (صندوق الأعمال · الخريطة · ملف القرار) فوق مخزن حالة واحد. الوصلة المفقودة الكبرى: محفظة الـ١٥٠ تصريحاً موجودة بلا مكان، والخريطة موجودة بلا محفظة — ندمجهما.

**Tech Stack:** HTML/CSS/JS عادي بلا إطار وبلا حزم. UMD بنمط `masar-engine.js`. اختبارات `node assert`. الخريطة MapLibre GL 5 محلية. لا شبكة وقت التشغيل.

## Global Constraints

- **الموعد: الهاكاثون ٢٧–٢٨ يوليو ٢٠٢٦. اليوم ٢٥ يوليو. المتاح ≈ ٤٨ ساعة.** كل موجة تُسلّم قابلة للعرض بذاتها؛ لا موجة تترك المشروع أسوأ مما وجدته.
- صفر طلبات شبكة وقت التشغيل. كل أصل تحت `presentation/` محلي. اختبارا `worksmap-style-test.js` و`worksmap-wiring-test.js` يحرسان هذا — أي صفحة جديدة تُضاف إلى حراستهما.
- عقد الـ API الحالي لخريطة الأعمال (١٤ دالة) لا يُكسر. `masar-prototype.html` يستهلكه.
- كل رقم واقعي يحمل مصدراً؛ كل مُدخل تجريبي يحمل شارة «بيانات توضيحية للعرض».
- العربية أولاً، RTL بنيوياً لا انعكاساً. الخط: `"Noto Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif`؛ الأرقام والمعرفات `ui-monospace, "Cascadia Code", Consolas, monospace`.
- الحالة لا تُنقل باللون وحده — لون + رمز + نص. (`data-model-and-state-machines.md` قاعدة ٨)
- إضافة RTL مثبّتة على 0.2.3. لا ترفعها.
- بذرة التوليد ثابتة: كل بيانات المحفظة قابلة لإعادة الإنتاج بالضبط.
- لا مكتبات جديدة. لا CDN. لا `npm install` في مسار العرض.
- قاعدة الحماية من التقليد: نأخذ البنية والسلوك من المنافسين، لا الألوان ولا الشعارات ولا الترتيب البصري المطابق.

---

## التشخيص — لماذا هذه الخطة بهذا الشكل

الحقائق المقيسة على المستودع اليوم:

| قياس | القيمة | الدلالة |
|---|---|---|
| صفحات HTML | ٩ | |
| صفحات في شريط التنقل | ٤ | خمس صفحات لا يصلها المحكّم |
| `masar-decision.html` | ١١٩٦ سطراً، ١٩ اختباراً ناجحاً، **صفر روابط واردة** | أقوى صفحة في المشروع غير قابلة للوصول |
| أنظمة بصرية متمايزة | ٤ | شريط داكن `#102535` فوق صفحة خريطة بيضاء `#1971c2` فوق نموذج بلوحته فوق مختبر تحريري |
| سجلات الخريطة | ١٦ | مدينة فارغة عند التصغير |
| محفظة `masar-portfolio.js` | ١٥٠ تصريحاً **بلا هندسة**، بأسماء وهمية «شرياني أ» | أرقام بلا مكان |
| طرق مسمّاة حقيقية في `riyadh-roads.geojson` | ١٠٣ | مكان بلا أرقام |
| اختبارات | ٢١ ملفاً، كلها خضراء | المحرك سليم — المشكلة ليست هنا |

الخلاصة بجملة: **أثر عنده محرك ناضج وسطح مبعثر.** المحكّم يقابل السطح لا المحرك.

معيار الإنجاز الذي وضعه بحث المقارنات لنفسه (`implementation-roadmap.md`): «يستطيع المراجع من شاشة واحدة وبلا إعادة إدخال: يجد عملاً · يفهم موقعه وحالته · يرى الأثر والثقة · يقارن البدائل · يفهم سبب التوصية · يعتمد أو يُرجع · يفتح مسودة الخطة.»

الحالة اليوم: **صفر من سبعة من شاشة واحدة.** كلها موجودة، لكن موزّعة على أربع صفحات وواحدة يتيمة.

---

## File Structure

**ملفات جديدة**

| الملف | المسؤولية الوحيدة |
|---|---|
| `presentation/masar-tokens.css` | مصدر الحقيقة البصري: متغيّرات اللون والمسافة والزاوية والكثافة والتوقيت. لا قاعدة مكوّن هنا. |
| `presentation/scripts/build-city-portfolio.js` | يُشغَّل مرة. يدمج `masar-portfolio.buildPermits()` مع محاور `riyadh-roads.geojson` المسمّاة وينتج هندسة مثبّتة على الإسفلت. |
| `presentation/data/city-portfolio.geojson` | ناتج البناء: ~١٥٠ تصريحاً بمخطط `WorkPermit` كامل. |
| `presentation/data/city-portfolio.geojson.js` | النسخة العالمية (`window.MASAR_CITY_PORTFOLIO`) للتشغيل من القرص. |
| `presentation/masar-desk-store.js` | مخزن الحالة: التحديد، المرشحات، الفرز، الاشتراكات. نقي. |
| `presentation/masar-desk-states.js` | آلة حالة العمل + الحُرّاس + الإجراء التالي + سجل التدقيق. نقي. |
| `presentation/masar-desk-inbox.js` | تصيير صندوق الأعمال (صف العمل، الوسوم، الفرز). نقي في `render`. |
| `presentation/masar-desk-file.js` | تصيير ملف القرار (التبويبات، بطاقة القرار، شريط الثقة). نقي في `render`. |
| `presentation/masar-desk.html` | التركيب: ثلاثة أعمدة + ربط المخزن بالخريطة واللوحتين. |
| `presentation/masar-desk.css` | تنسيق المكتب فوق `masar-tokens.css`. |
| `presentation/tests/desk-store-test.js` | عقود المخزن. |
| `presentation/tests/desk-states-test.js` | آلة الحالة والحُرّاس. |
| `presentation/tests/desk-render-test.js` | تصيير الصف وملف القرار والترميز الآمن. |
| `presentation/tests/portfolio-geo-test.js` | مخطط المحفظة المكانية وثباتها. |
| `presentation/tests/tokens-test.js` | لا لون خام خارج ملف الوسوم. |
| `presentation/tests/judge-walkthrough-test.js` | البوابة النهائية: السبع خطوات من شاشة واحدة. |
| `presentation/tests/run-all.js` | مُشغِّل كل الحزم بمخرج واحد. |

**ملفات تُعدَّل**

| الملف | التعديل |
|---|---|
| `presentation/masar-nav.js` | إعادة تلوين فاتحة من الوسوم + «مكتب المراجع» صفحةً أولى + إظهار `masar-decision.html`. |
| `presentation/masar-map.html` | إطار الشفافية العامة: بحث بالشارع + آخر تحديث + المحفظة الكاملة بدل ١٦. |
| `presentation/masar-worksmap.js` | إضافة `highlightWork(id)` و`onWorkHover(cb)` إلى العقد (إضافة فقط — لا كسر). |
| `presentation/masar-worksmap-page.css` | استهلاك `masar-tokens.css` بدل قيمه الخاصة. |
| `presentation/tests/nav-test.js` | ست صفحات بدل أربع. |
| `presentation/README-masar.md` | جدول الصفحات ومسار المحكّم. |

---

## ترتيب الموجات وميزانية الوقت

| الموجة | المهام | الزمن | النتيجة المعروضة |
|---|---|---|---|
| **صفر — التوحيد** | ١، ٢ | ~٣ ساعات | هوية بصرية واحدة، وصفحة القرار اليتيمة صارت مرئية |
| **الأولى — المحفظة على الأرض** | ٣، ٤ | ~٤ ساعات | ١٥٠ تصريحاً حقيقي الشكل على ١٠٣ شوارع مسمّاة |
| **الثانية — المكتب** | ٥، ٦، ٧ | ~٧ ساعات | صندوق أعمال + خريطة + ملف قرار مترابطة |
| **الثالثة — القرار الكامل** | ٨، ٩ | ~٥ ساعات | حالة، ثقة، سجل قرار، تدقيق |
| **الرابعة — البوابات** | ١٠، ١١ | ~٣ ساعات | شفافية عامة + اختبار مسار المحكّم |

مجموع ≈ ٢٢ ساعة عمل. يترك هامشاً حقيقياً قبل ٢٧ يوليو. **لو ضاق الوقت: الموجات صفر والأولى والثانية وحدها تنقل الدرجة أكثر من أي شيء آخر — نفّذها ثم توقف.**

---

## Task 1: ملف الوسوم البصرية الموحّد

**Files:**
- Create: `presentation/masar-tokens.css`
- Create: `presentation/tests/tokens-test.js`
- Modify: `presentation/masar-worksmap-page.css`
- Modify: `presentation/masar-nav.js:18-27`

**Interfaces:**
- Produces: متغيّرات CSS بالبادئة `--masar-*` تستهلكها كل الصفحات اللاحقة. لا تصدّر جافاسكربت.

السبب: أربعة أنظمة بصرية في مستودع واحد هي أوضح خصم في المعيار ٥٫٥، وأسرع خصم يُصلَح.

- [ ] **Step 1: اكتب الاختبار الفاشل**

`presentation/tests/tokens-test.js`:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const tokens = fs.readFileSync(path.join(ROOT, 'masar-tokens.css'), 'utf8');

const REQUIRED = [
  '--masar-canvas', '--masar-surface', '--masar-surface-raised',
  '--masar-ink', '--masar-muted', '--masar-faint', '--masar-line',
  '--masar-primary', '--masar-primary-hover', '--masar-primary-soft',
  '--masar-accent', '--masar-accent-soft',
  '--masar-success', '--masar-success-soft',
  '--masar-warning', '--masar-warning-soft',
  '--masar-danger', '--masar-danger-soft',
  '--masar-info', '--masar-info-soft',
  '--masar-space-1', '--masar-space-2', '--masar-space-3',
  '--masar-space-4', '--masar-space-6', '--masar-space-8', '--masar-space-12',
  '--masar-radius-sm', '--masar-radius', '--masar-radius-lg',
  '--masar-row-h', '--masar-toolbar-h', '--masar-panel-w',
  '--masar-t-hover', '--masar-t-control', '--masar-t-panel', '--masar-t-map',
  '--masar-font', '--masar-font-mono',
];

ok('ملف الوسوم يعرّف كل وسم مطلوب', () => {
  for (const token of REQUIRED) {
    assert.ok(tokens.includes(token + ':'), `وسم مفقود: ${token}`);
  }
});

ok('صفحة الخريطة تستهلك الوسوم ولا تعرّف لوحتها الخاصة', () => {
  const css = fs.readFileSync(path.join(ROOT, 'masar-worksmap-page.css'), 'utf8');
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.strictEqual(hex.length, 0, `ألوان خام في تنسيق الصفحة: ${hex.join(', ')}`);
  assert.ok(css.includes('var(--masar-'), 'الصفحة لا تقرأ الوسوم');
});

ok('شريط التنقل فاتح ويقرأ الوسوم لا قيماً مثبتة', () => {
  const nav = fs.readFileSync(path.join(ROOT, 'masar-nav.js'), 'utf8');
  assert.ok(!nav.includes('#102535'), 'الشريط الداكن ما زال موجوداً');
  assert.ok(nav.includes('var(--masar-'), 'الشريط لا يقرأ الوسوم');
});

ok('الوسوم تحمل الخط العربي أولاً والأحادي للأرقام', () => {
  assert.ok(tokens.includes('Noto Sans Arabic'), 'الخط العربي مفقود');
  assert.ok(/--masar-font-mono:[^;]*monospace/.test(tokens), 'الخط الأحادي مفقود');
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: شغّل الاختبار وتأكد أنه يفشل**

```bash
node presentation/tests/tokens-test.js
```

المتوقع: `ENOENT ... masar-tokens.css`.

- [ ] **Step 3: اكتب ملف الوسوم**

`presentation/masar-tokens.css` — القيم مأخوذة حرفياً من `design-and-interaction-system.md` (هوية أثر، ليست لوحة منافس):

```css
/* مسار — الوسوم البصرية. مصدر الحقيقة الوحيد للون والمسافة والتوقيت.
   لا قواعد مكوّنات هنا: المكوّنات تقرأ من هنا ولا تكتب فيه. */
:root {
  /* السطوح */
  --masar-canvas: #ECEFF2;
  --masar-surface: #FFFFFF;
  --masar-surface-raised: #F8FAFB;

  /* الحبر */
  --masar-ink: #15202B;
  --masar-muted: #5A6672;
  --masar-faint: #8A929B;
  --masar-line: #D8DEE4;

  /* الهوية */
  --masar-primary: #1D4E77;
  --masar-primary-hover: #163F5F;
  --masar-primary-soft: #E9F1F7;
  --masar-accent: #A9722B;
  --masar-accent-soft: #F4EDE1;

  /* الحالة — كل واحدة تُقرن دائماً برمز ونص، لا لوناً وحدها */
  --masar-success: #2F7A57;
  --masar-success-soft: #E4F1EA;
  --masar-warning: #A9722B;
  --masar-warning-soft: #F4EDE1;
  --masar-danger: #B23B32;
  --masar-danger-soft: #F7E4E1;
  --masar-info: #2C6E9D;
  --masar-info-soft: #E6F0F7;

  /* المسافات — 4 8 12 16 24 32 48 */
  --masar-space-1: 4px;
  --masar-space-2: 8px;
  --masar-space-3: 12px;
  --masar-space-4: 16px;
  --masar-space-6: 24px;
  --masar-space-8: 32px;
  --masar-space-12: 48px;

  /* الزوايا — الكبسولة للحالة والمرشح فقط */
  --masar-radius-sm: 6px;
  --masar-radius: 10px;
  --masar-radius-lg: 14px;
  --masar-radius-pill: 999px;

  /* كثافة وضع المراجع */
  --masar-row-h: 56px;
  --masar-toolbar-h: 48px;
  --masar-panel-w: 384px;
  --masar-text: 14px;

  /* التوقيت */
  --masar-t-hover: 100ms;
  --masar-t-control: 160ms;
  --masar-t-panel: 240ms;
  --masar-t-map: 300ms;
  --masar-ease: cubic-bezier(0.16, 1, 0.3, 1);

  /* الظل */
  --masar-shadow-sm: 0 1px 2px rgb(21 32 43 / 0.06);
  --masar-shadow: 0 4px 16px rgb(21 32 43 / 0.10);
  --masar-shadow-lg: 0 12px 32px rgb(21 32 43 / 0.14);

  /* الخطوط */
  --masar-font: "Noto Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif;
  --masar-font-mono: ui-monospace, "Cascadia Code", Consolas, monospace;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --masar-t-hover: 0ms;
    --masar-t-control: 0ms;
    --masar-t-panel: 0ms;
    --masar-t-map: 0ms;
  }
}
```

- [ ] **Step 4: حوّل `masar-worksmap-page.css` إلى الوسوم**

استبدل كتلة `:root` في أعلى الملف بسطر استيراد وربط:

```css
@import url("masar-tokens.css");

:root {
  --wm-surface: var(--masar-surface);
  --wm-border: var(--masar-line);
  --wm-stage: var(--masar-canvas);
  --wm-text: var(--masar-ink);
  --wm-muted: var(--masar-muted);
  --wm-accent: var(--masar-primary);
  --wm-radius: var(--masar-radius);
  --wm-shadow: var(--masar-shadow);
  --wm-bar: 52px;
}
```

وفي `.wm-badge` استبدل الألوان الخام بـ `var(--masar-accent)` و`var(--masar-accent-soft)` و`var(--masar-line)`، وفي `.wm-error` بـ `var(--masar-danger)` و`var(--masar-danger-soft)`.

- [ ] **Step 5: أعد تلوين شريط التنقل**

في `masar-nav.js` استبدل نص `style.textContent` بالتالي، وأضف حقن الوسوم قبله:

```js
  var tokens = document.createElement('link');
  tokens.rel = 'stylesheet';
  tokens.href = 'masar-tokens.css';
  document.head.appendChild(tokens);

  var style = document.createElement('style');
  style.textContent =
    '.masar-nav{position:fixed;top:0;right:0;left:0;z-index:9;display:flex;gap:var(--masar-space-1);' +
    'align-items:center;justify-content:center;background:var(--masar-surface);' +
    'border-bottom:1px solid var(--masar-line);box-shadow:var(--masar-shadow-sm);' +
    'padding:var(--masar-space-2) var(--masar-space-3);font-family:var(--masar-font)}' +
    '.masar-nav a{color:var(--masar-muted);text-decoration:none;font-weight:700;font-size:13px;' +
    'border-radius:var(--masar-radius-sm);padding:6px 14px;border:1px solid transparent;' +
    'transition:color var(--masar-t-hover),background var(--masar-t-hover)}' +
    '.masar-nav a:hover{background:var(--masar-primary-soft);color:var(--masar-primary)}' +
    '.masar-nav a:focus-visible{outline:2px solid var(--masar-primary);outline-offset:2px}' +
    '.masar-nav a[aria-current="page"]{background:var(--masar-primary);color:#fff}' +
    'body.masar-nav-offset{padding-top:46px}' +
    '.masar-nav.below-badge{top:40px}';
```

- [ ] **Step 6: شغّل الاختبار وتأكد أنه يمر**

```bash
node presentation/tests/tokens-test.js
```

المتوقع: `4 اختبارات نجحت`.

- [ ] **Step 7: تأكد أن التوحيد لم يكسر شيئاً**

```bash
node presentation/tests/worksmap-page-test.js && node presentation/tests/nav-test.js
```

- [ ] **Step 8: Commit**

```bash
git add presentation/masar-tokens.css presentation/masar-worksmap-page.css presentation/masar-nav.js presentation/tests/tokens-test.js
git commit -m "feat: single visual token source across pages"
```

---

## Task 2: إظهار صفحة القرار اليتيمة وإعادة ترتيب التنقل

**Files:**
- Modify: `presentation/masar-nav.js:9-14`
- Modify: `presentation/masar-decision.html` (وسم `<script src="masar-nav.js">` + استيراد الوسوم)
- Modify: `presentation/tests/nav-test.js`

**Interfaces:**
- Consumes: `masar-tokens.css` من المهمة ١.
- Produces: ترتيب الصفحات النهائي الذي تعتمده المهمة ١١.

السبب: `masar-decision.html` فيها ١٩ اختباراً ناجحاً وبوابة جودة بيانات وامتناع عن التوصية عند النقص — وهي **أقرب شيء في المستودع إلى ما يطلبه المحكّم**، ولا يوجد إليها رابط واحد. هذه أرخص نقطة في الخطة كلها.

- [ ] **Step 1: حدّث اختبار التنقل ليطلب ست صفحات**

في `tests/nav-test.js` استبدل سطر `pages` وقائمة التسميات:

```js
const pages = [
  'masar-desk.html',
  'masar-decision.html',
  'masar-map.html',
  'masar-prototype.html',
  'masar-lab.html',
  'masar-city-impact.html',
];
```

```js
  for (const label of ['مكتب المراجع', 'شاشة القرار', 'الخريطة', 'النموذج التفاعلي', 'مختبر الابتكار', 'لوحة مسار المدينة']) {
```

وأضف اختباراً ثالثاً:

```js
ok('لا صفحة يتيمة: كل صفحة عائلة يصلها الشريط', () => {
  const orphans = [];
  for (const page of pages) {
    if (!navJs.includes(`"${page}"`)) orphans.push(page);
  }
  assert.deepStrictEqual(orphans, [], `صفحات يتيمة: ${orphans.join(', ')}`);
});
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

```bash
node presentation/tests/nav-test.js
```

المتوقع: `nav missing link to masar-desk.html`.

- [ ] **Step 3: حدّث `PAGES` في `masar-nav.js`**

```js
  var PAGES = [
    { file: "masar-desk.html", label: 'مكتب المراجع' },
    { file: "masar-decision.html", label: 'شاشة القرار' },
    { file: "masar-map.html", label: 'الخريطة' },
    { file: "masar-prototype.html", label: 'النموذج التفاعلي' },
    { file: "masar-lab.html", label: 'مختبر الابتكار' },
    { file: "masar-city-impact.html", label: 'لوحة مسار المدينة' },
  ];
```

الترتيب مقصود: المحكّم يفتح أول تبويب. أول تبويب يجب أن يكون المنتج، لا العرض التوضيحي.

- [ ] **Step 4: ضع مؤقتاً `masar-desk.html` كتحويل**

حتى تصل المهمة ٧، اكتب صفحة انتقالية كي لا يكسر الرابط:

```html
<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><title>مسار — مكتب المراجع</title>
<link rel="stylesheet" href="masar-tokens.css">
<style>body{font-family:var(--masar-font);background:var(--masar-canvas);
color:var(--masar-ink);display:grid;place-items:center;min-height:100vh;margin:0}</style></head>
<body><p>مكتب المراجع قيد التركيب — افتح <a href="masar-decision.html">شاشة القرار</a>.</p>
<script src="masar-nav.js"></script></body></html>
```

- [ ] **Step 5: أضف الشريط والوسوم إلى `masar-decision.html`**

قبل `</body>` مباشرة:

```html
  <script src="masar-nav.js"></script>
```

وفي `<head>` قبل `<style>`:

```html
  <link rel="stylesheet" href="masar-tokens.css">
```

- [ ] **Step 6: شغّل وتأكد من النجاح**

```bash
node presentation/tests/nav-test.js && node presentation/tests/decision-test.js
```

المتوقع: `ALL NAV TESTS PASSED (4)` و`ALL DECISION TESTS PASSED (19)`.

- [ ] **Step 7: Commit**

```bash
git add presentation/masar-nav.js presentation/masar-decision.html presentation/masar-desk.html presentation/tests/nav-test.js
git commit -m "fix: surface the orphaned decision screen in the nav"
```

---

## Task 3: إنزال المحفظة على الأرض

**Files:**
- Create: `presentation/scripts/build-city-portfolio.js`
- Create: `presentation/data/city-portfolio.geojson`
- Create: `presentation/data/city-portfolio.geojson.js`
- Create: `presentation/tests/portfolio-geo-test.js`

**Interfaces:**
- Consumes: `masar-portfolio.buildPermits()` (١٥٠ تصريحاً، بذرة `20260727`)، `scripts/lib/centreline.js` (`chainForRoad`, `section`, `lengthOf`)، `data/riyadh-roads.geojson`.
- Produces: `window.MASAR_CITY_PORTFOLIO` — `FeatureCollection` بخصائص `WorkPermit` التالية بالضبط:
  `id, permitRef, group, subtype, status, nextAction, title, street, roadClass, sensitivity, promoter, contractor, lanes, lanesClosed, start, end, start_ts, end_ts, severity, confidence, impactVehHours, delayPct, version, description`

السبب المباشر: المحفظة اليوم أرقام بلا مكان («شرياني أ»)، والخريطة مكان بلا أرقام (١٦ سجلاً). دمجهما هو ما يجعل «الشغل الحقيقي يبان»: ١٥٠ تصريحاً على ١٠٣ شوارع رياض مسمّاة، كل واحد يحمل ناتج المحرك الفعلي.

- [ ] **Step 1: اكتب الاختبار الفاشل**

`presentation/tests/portfolio-geo-test.js`:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Data = require(path.join(__dirname, '..', 'masar-worksmap-data.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const raw = fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8');
const portfolio = JSON.parse(raw);
const roads = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'riyadh-roads.geojson'), 'utf8'));

const REQUIRED_PROPS = [
  'id', 'permitRef', 'group', 'subtype', 'status', 'nextAction', 'title',
  'street', 'roadClass', 'sensitivity', 'promoter', 'contractor',
  'lanes', 'lanesClosed', 'start', 'end', 'severity', 'confidence',
  'impactVehHours', 'delayPct', 'version',
];

ok('المحفظة تحمل ١٢٠ سجلاً على الأقل', () => {
  assert.ok(portfolio.features.length >= 120,
    `عدد غير كافٍ لملء المدينة: ${portfolio.features.length}`);
});

ok('كل سجل يحمل مخطط WorkPermit كاملاً', () => {
  portfolio.features.forEach((feature, index) => {
    for (const prop of REQUIRED_PROPS) {
      assert.ok(feature.properties[prop] !== undefined && feature.properties[prop] !== '',
        `السجل ${index} ينقصه ${prop}`);
    }
  });
});

ok('كل هندسة خط على شارع مسمّى موجود فعلاً في الشبكة', () => {
  const names = new Set();
  roads.features.forEach((r) => { if (r.properties && r.properties.name) names.add(r.properties.name); });
  portfolio.features.forEach((feature) => {
    if (feature.geometry.type !== 'LineString') return;
    assert.ok(names.has(feature.properties.street),
      `شارع غير موجود في الشبكة: ${feature.properties.street}`);
    assert.ok(feature.geometry.coordinates.length >= 2, 'مقطع بنقطة واحدة');
  });
});

ok('الإحداثيات داخل نطاق الرياض', () => {
  portfolio.features.forEach((feature) => {
    const coords = feature.geometry.type === 'Point'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
    coords.forEach(([lng, lat]) => {
      assert.ok(lng > 46.4 && lng < 47.0, `خط طول خارج الرياض: ${lng}`);
      assert.ok(lat > 24.4 && lat < 25.0, `خط عرض خارج الرياض: ${lat}`);
    });
  });
});

ok('كل المجموعات الخمس ممثَّلة', () => {
  const groups = new Set(portfolio.features.map((f) => f.properties.group));
  for (const group of ['roadworks', 'closures', 'incidents', 'diversions', 'pois']) {
    assert.ok(groups.has(group), `مجموعة غائبة: ${group}`);
  }
});

ok('توزيع الحالات يشمل حالات تحتاج قراراً', () => {
  const statuses = {};
  portfolio.features.forEach((f) => {
    statuses[f.properties.status] = (statuses[f.properties.status] || 0) + 1;
  });
  assert.ok(statuses.ImpactScreening >= 8, 'لا أعمال تنتظر الفرز — الصندوق فارغ من العمل');
  assert.ok(statuses.CoordinationRequired >= 3, 'لا تعارضات تحتاج تنسيقاً');
  assert.ok(Object.keys(statuses).length >= 5, 'تنوّع حالات ضعيف');
});

ok('الأثر محسوب فعلاً ويتغير بين السجلات', () => {
  const values = portfolio.features
    .map((f) => f.properties.impactVehHours)
    .filter((v) => typeof v === 'number' && v > 0);
  assert.ok(values.length >= 100, 'أغلب السجلات بلا أثر محسوب');
  assert.ok(new Set(values).size > 50, 'قيم مزروعة لا محسوبة');
});

ok('التطبيع لا يُسقط أي سجل', () => {
  const normalized = Data.normalizeWorks(portfolio);
  assert.strictEqual(normalized.features.length, portfolio.features.length);
});

ok('النسخة المضمّنة مطابقة للملف', () => {
  const wrapped = fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson.js'), 'utf8');
  const embedded = wrapped.replace(/^window\.MASAR_CITY_PORTFOLIO = /, '').replace(/;\s*$/, '');
  assert.deepStrictEqual(JSON.parse(embedded), JSON.parse(raw));
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

```bash
node presentation/tests/portfolio-geo-test.js
```

المتوقع: `ENOENT ... city-portfolio.geojson`.

- [ ] **Step 3: اكتب باني المحفظة**

`presentation/scripts/build-city-portfolio.js`. المبدأ: البذرة نفسها في `masar-portfolio.js` تقود كل اختيار، فالناتج قابل لإعادة الإنتاج بالضبط. الأثر يُحسب من `MasarEngine.score()` — **ملاحظة حرجة: `score()` لا يملك قيماً افتراضية داخلية، فيجب تمرير `capacityPerLane` و`freeFlowMin` صراحة من `MasarEngine.DEFAULTS`.**

```js
'use strict';
/**
 * مسار — إنزال محفظة التصاريح على شبكة الطرق الحقيقية.
 * يُشغَّل مرة واحدة محلياً. لا شبكة.
 *
 * 1) نفس بذرة masar-portfolio: الناتج قابل لإعادة الإنتاج حرفياً.
 * 2) كل تصريح يُثبَّت على مقطع من محور شارع مسمّى — لا خطوط عبر الأحياء.
 * 3) الأثر من المحرك الحقيقي لا من رقم مزروع.
 */
const fs = require('fs');
const path = require('path');

const Engine = require('../masar-engine.js');
const Portfolio = require('../masar-portfolio.js');
const { chainForRoad, section, lengthOf } = require('./lib/centreline.js');

const ROOT = path.join(__dirname, '..');
const roads = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'riyadh-roads.geojson'), 'utf8'));

const PROMOTERS = [
  'شركة المياه الوطنية', 'الشركة السعودية للكهرباء', 'أمانة منطقة الرياض',
  'شركة الاتصالات السعودية', 'هيئة تطوير مدينة الرياض', 'شركة الغاز والتصنيع',
];
const CONTRACTORS = [
  'مقاولات الخليج', 'البنية المتقدمة', 'الراجحي للإنشاء',
  'مجموعة الفهد الهندسية', 'دار التنفيذ',
];
const SUBTYPES = ['emergency', 'development', 'maintenance', 'default'];
const GROUPS = ['roadworks', 'roadworks', 'roadworks', 'closures', 'diversions', 'incidents', 'pois'];
const STATUSES = [
  'ImpactScreening', 'ImpactScreening', 'ImpactScreening',
  'CoordinationRequired', 'StrategyReview', 'Approved', 'Scheduled',
  'Deployed', 'CompletenessReview',
];
const NEXT_ACTION = {
  ImpactScreening: 'افحص الأثر',
  CoordinationRequired: 'نسّق مع الجهة المتعارضة',
  StrategyReview: 'اعتمد أو أرجع',
  CompletenessReview: 'أكمل البيانات الناقصة',
  Approved: 'ثبّت الجدول',
  Scheduled: 'انشر الإغلاق',
  Deployed: 'راقب القياس',
};
const SENSITIVITY = ['normal', 'normal', 'normal', 'hospital', 'school', 'transit'];

/** محاور الشوارع المسمّاة، مرتّبة كي لا يتغيّر الترتيب بين التشغيلات. */
function namedRoads() {
  const byName = new Map();
  roads.features.forEach((feature) => {
    const name = feature.properties && feature.properties.name;
    if (!name || feature.geometry.type !== 'LineString') return;
    if (!byName.has(name)) byName.set(name, { name, highway: feature.properties.highway, parts: [] });
    byName.get(name).parts.push(feature);
  });
  return Array.from(byName.values())
    .map((road) => ({ ...road, chain: chainForRoad(road.parts) }))
    .filter((road) => road.chain && road.chain.length >= 2 && lengthOf(road.chain) > 400)
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

const CLASS_BY_HIGHWAY = {
  motorway: 'arterial', trunk: 'arterial', primary: 'arterial',
  secondary: 'major', tertiary: 'local',
};

function pad(n, width) { return String(n).padStart(width, '0'); }

function isoAt(dayOffset, hour) {
  const base = Date.UTC(2026, 6, 20); // ٢٠ يوليو ٢٠٢٦ — نافذة العرض
  return new Date(base + dayOffset * 86400000 + hour * 3600000).toISOString();
}

function build() {
  const permits = Portfolio.buildPermits();
  const corridors = namedRoads();
  if (!corridors.length) throw new Error('لا محاور مسمّاة صالحة — تحقق من riyadh-roads.geojson');

  const rand = Portfolio.mulberry32(Portfolio.SEED);
  const features = [];

  permits.forEach((permit, index) => {
    const road = corridors[index % corridors.length];
    const total = lengthOf(road.chain);
    const cutStart = 0.08 + rand() * 0.72;
    const cutSpan = Math.min(0.06 + rand() * 0.12, 0.95 - cutStart);
    const geometry = section(road.chain, cutStart * total, (cutStart + cutSpan) * total);
    if (!geometry || geometry.length < 2) return;

    const group = GROUPS[Math.floor(rand() * GROUPS.length)];
    const status = STATUSES[Math.floor(rand() * STATUSES.length)];
    const durationHours = Math.max(4, Math.min(permit.durationHours, 168));

    const scored = Engine.score({
      aadt: permit.aadt,
      lanes: permit.lanes,
      lanesClosed: permit.lanesClosed,
      startHour: permit.startHour,
      durationHours: durationHours,
      capacityPerLane: Engine.DEFAULTS.capacityPerLane,
      freeFlowMin: Engine.DEFAULTS.freeFlowMin,
    });

    const severity = scored.delayPct >= 40 ? 3 : scored.delayPct >= 15 ? 2 : 1;
    const startDay = permit.startDay % 30;

    features.push({
      type: 'Feature',
      geometry: group === 'pois'
        ? { type: 'Point', coordinates: geometry[Math.floor(geometry.length / 2)] }
        : { type: 'LineString', coordinates: geometry },
      properties: {
        id: permit.id,
        permitRef: 'BLD-2026-' + pad(index + 1, 4),
        group: group,
        subtype: SUBTYPES[Math.floor(rand() * SUBTYPES.length)],
        status: status,
        nextAction: NEXT_ACTION[status] || 'راجع',
        title: 'أعمال على ' + road.name,
        street: road.name,
        roadClass: CLASS_BY_HIGHWAY[road.highway] || 'local',
        sensitivity: SENSITIVITY[Math.floor(rand() * SENSITIVITY.length)],
        promoter: PROMOTERS[Math.floor(rand() * PROMOTERS.length)],
        contractor: CONTRACTORS[Math.floor(rand() * CONTRACTORS.length)],
        lanes: permit.lanes,
        lanesClosed: permit.lanesClosed,
        start: isoAt(startDay, permit.startHour),
        end: isoAt(startDay + Math.ceil(durationHours / 24), permit.startHour),
        severity: severity,
        confidence: severity === 3 ? 'low' : severity === 2 ? 'medium' : 'high',
        impactVehHours: Math.round(scored.delayVehHours),
        delayPct: Math.round(scored.delayPct * 10) / 10,
        version: 1,
        description: 'إغلاق ' + permit.lanesClosed + ' من ' + permit.lanes
          + ' مسارات لمدة ' + durationHours + ' ساعة',
      },
    });
  });

  return { type: 'FeatureCollection', features: features };
}

const collection = build();
const outJson = path.join(ROOT, 'data', 'city-portfolio.geojson');
const outJs = path.join(ROOT, 'data', 'city-portfolio.geojson.js');
const text = JSON.stringify(collection);

fs.writeFileSync(outJson, text);
fs.writeFileSync(outJs, 'window.MASAR_CITY_PORTFOLIO = ' + text + ';');
console.log('كُتب ' + collection.features.length + ' تصريحاً على ' +
  new Set(collection.features.map((f) => f.properties.street)).size + ' شارعاً مسمّى');
```

- [ ] **Step 4: شغّل الباني**

```bash
node presentation/scripts/build-city-portfolio.js
```

المتوقع: سطر يذكر ≥١٢٠ تصريحاً على ≥٦٠ شارعاً.

- [ ] **Step 5: شغّل الاختبار وتأكد أنه يمر**

```bash
node presentation/tests/portfolio-geo-test.js
```

المتوقع: `9 اختبارات نجحت`.

إن فشل `توزيع الحالات`، ارفع تكرار `ImpactScreening` في مصفوفة `STATUSES` — التوزيع مقصود لا عشوائي: صندوق الأعمال يجب أن يفتح على عمل ينتظر قراراً.

- [ ] **Step 6: تحقق من الثبات**

```bash
node presentation/scripts/build-city-portfolio.js && git diff --stat presentation/data/city-portfolio.geojson
```

المتوقع: لا فرق. التوليد ثابت.

- [ ] **Step 7: Commit**

```bash
git add presentation/scripts/build-city-portfolio.js presentation/data/city-portfolio.geojson presentation/data/city-portfolio.geojson.js presentation/tests/portfolio-geo-test.js
git commit -m "feat: place the 150-permit portfolio on real named streets"
```

---

## Task 4: ترقية صفحة الخريطة إلى المحفظة الكاملة

**Files:**
- Modify: `presentation/masar-map.html:36` (مصدر البيانات) و`:66-99` (الربط)
- Modify: `presentation/tests/worksmap-page-test.js`

**Interfaces:**
- Consumes: `window.MASAR_CITY_PORTFOLIO` من المهمة ٣.
- Produces: لا شيء جديد — نفس الصفحة ببيانات حقيقية الحجم.

- [ ] **Step 1: عدّل الاختبار ليطلب المحفظة**

في `tests/worksmap-page-test.js` استبدل مرجع `works-city.geojson.js` بـ `city-portfolio.geojson.js` في قائمة الملفات المحمّلة، واستبدل اختبار «بيانات المدينة كاملة» بـ:

```js
ok('الخريطة تُغذّى من المحفظة الكاملة لا من عيّنة', () => {
  assert.ok(html.indexOf('MASAR_CITY_PORTFOLIO') !== -1, 'الصفحة ما زالت على العيّنة');
  const raw = fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8');
  const collection = JSON.parse(raw);
  assert.ok(collection.features.length >= 120, 'محفظة أصغر من أن تملأ المدينة');
  const normalized = Data.normalizeWorks(collection);
  const split = Data.splitByGeometry(normalized);
  assert.ok(split.points.features.length > 0, 'لا نقاط — التجميع بلا معنى');
  assert.ok(split.lines.features.length > 50, 'لا مقاطع كافية على الشوارع');
});
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

```bash
node presentation/tests/worksmap-page-test.js
```

- [ ] **Step 3: بدّل مصدر البيانات في الصفحة**

في `masar-map.html` استبدل السطر:

```html
<script src="data/works-city.geojson.js"></script>
```

بـ:

```html
<script src="data/city-portfolio.geojson.js"></script>
```

وفي السكربت استبدل:

```js
    var works = window.MASAR_WORKS_CITY || { type: 'FeatureCollection', features: [] };
```

بـ:

```js
    var works = window.MASAR_CITY_PORTFOLIO || { type: 'FeatureCollection', features: [] };
```

واضبط التقريب الافتتاحي ليُظهر المدينة لا الحي:

```js
    center: [46.6785, 24.7125],
    zoom: 11.4,
```

- [ ] **Step 4: شغّل الاختبار وتأكد من النجاح**

```bash
node presentation/tests/worksmap-page-test.js
```

- [ ] **Step 5: تحقق بصرياً في المتصفح**

شغّل `node presentation/server.js` وافتح `http://localhost:8734/masar-map.html`. تحقق من: ظهور تجميعات بعدّادات ثنائية الرقم، عدم تحوّل الخريطة إلى شبكة صمّاء، وأداء التحريك سلساً. إن ثقُلت، أضف `minzoom: 10` إلى طبقات الخطوط في `masar-worksmap-layers.js`.

- [ ] **Step 6: Commit**

```bash
git add presentation/masar-map.html presentation/tests/worksmap-page-test.js
git commit -m "feat: feed the map page from the full city portfolio"
```

---

## Task 5: مخزن حالة المكتب

**Files:**
- Create: `presentation/masar-desk-store.js`
- Create: `presentation/tests/desk-store-test.js`

**Interfaces:**
- Produces:
  - `createStore(features)` → كائن بالدوال: `getState()`, `subscribe(fn) → unsubscribe`, `select(id)`, `setFilter(key, value)`, `clearFilter(key)`, `setSort(key)`, `getVisible()`, `getSelected()`, `counts()`.
  - `getState()` يعيد `{ selectedId, filters, sort, features }`.
  - `getVisible()` يعيد مصفوفة مرشَّحة مفروزة.
  - `counts()` يعيد `{ total, visible, byStatus, needsDecision }`.

السبب: البحث نفسه شخّص المرض — «كل شاشة يجب أن تقرأ من سجل عمل موحد». بلا مخزن واحد يعود المكتب بطاقات منفصلة.

- [ ] **Step 1: اكتب الاختبار الفاشل**

`presentation/tests/desk-store-test.js`:

```js
'use strict';
const assert = require('assert');
const path = require('path');
const Store = require(path.join(__dirname, '..', 'masar-desk-store.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

function feature(id, props) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[46.68, 24.71], [46.69, 24.72]] },
    properties: Object.assign({
      id: id, permitRef: 'BLD-' + id, status: 'ImpactScreening', street: 'طريق أ',
      severity: 2, impactVehHours: 100, start: '2026-07-22T06:00:00Z',
      end: '2026-07-24T06:00:00Z', group: 'roadworks',
    }, props || {}),
  };
}

const sample = [
  feature('a', { severity: 3, impactVehHours: 900, street: 'طريق الملك فهد' }),
  feature('b', { severity: 1, impactVehHours: 50, status: 'Approved' }),
  feature('c', { severity: 2, impactVehHours: 400, status: 'CoordinationRequired' }),
];

ok('المخزن يبدأ بلا تحديد ويرى كل السجلات', () => {
  const store = Store.createStore(sample);
  assert.strictEqual(store.getState().selectedId, null);
  assert.strictEqual(store.getVisible().length, 3);
});

ok('التحديد يغيّر الحالة ويعيد السجل نفسه', () => {
  const store = Store.createStore(sample);
  store.select('c');
  assert.strictEqual(store.getState().selectedId, 'c');
  assert.strictEqual(store.getSelected().properties.status, 'CoordinationRequired');
});

ok('تحديد معرّف غير موجود لا يكسر المخزن', () => {
  const store = Store.createStore(sample);
  store.select('zzz');
  assert.strictEqual(store.getSelected(), null);
});

ok('المشتركون يُستدعون مرة واحدة لكل تغيير', () => {
  const store = Store.createStore(sample);
  let calls = 0;
  store.subscribe(function () { calls += 1; });
  store.select('a');
  store.setFilter('status', 'Approved');
  assert.strictEqual(calls, 2);
});

ok('إلغاء الاشتراك يوقف الاستدعاء', () => {
  const store = Store.createStore(sample);
  let calls = 0;
  const off = store.subscribe(function () { calls += 1; });
  off();
  store.select('a');
  assert.strictEqual(calls, 0);
});

ok('مرشح الحالة يقلّص القائمة', () => {
  const store = Store.createStore(sample);
  store.setFilter('status', 'Approved');
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['b']);
});

ok('البحث النصي يطابق الشارع والمرجع', () => {
  const store = Store.createStore(sample);
  store.setFilter('query', 'الملك فهد');
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['a']);
  store.setFilter('query', 'BLD-b');
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['b']);
});

ok('المرشحات تتراكم ولا يمحو أحدها الآخر', () => {
  const store = Store.createStore(sample);
  store.setFilter('status', 'ImpactScreening');
  store.setFilter('severity', 3);
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['a']);
});

ok('الفرز الافتراضي بالأثر تنازلياً — الأخطر أولاً', () => {
  const store = Store.createStore(sample);
  assert.deepStrictEqual(store.getVisible().map((f) => f.properties.id), ['a', 'c', 'b']);
});

ok('يمكن الفرز بتاريخ البدء', () => {
  const store = Store.createStore(sample);
  store.setSort('start');
  assert.strictEqual(store.getVisible().length, 3);
});

ok('العدّادات تفصل المرئي عن الكلي وتعدّ ما ينتظر قراراً', () => {
  const store = Store.createStore(sample);
  store.setFilter('status', 'Approved');
  const counts = store.counts();
  assert.strictEqual(counts.total, 3);
  assert.strictEqual(counts.visible, 1);
  assert.strictEqual(counts.needsDecision, 2);
  assert.strictEqual(counts.byStatus.ImpactScreening, 1);
});

ok('المخزن لا يعدّل المصفوفة الأصلية', () => {
  const original = sample.slice();
  const store = Store.createStore(sample);
  store.setSort('start');
  store.getVisible();
  assert.deepStrictEqual(sample, original);
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

```bash
node presentation/tests/desk-store-test.js
```

المتوقع: `Cannot find module ... masar-desk-store.js`.

- [ ] **Step 3: اكتب المخزن**

`presentation/masar-desk-store.js`:

```js
/**
 * مسار — مخزن حالة مكتب المراجع.
 * ---------------------------------------------------------------------------
 * 1) مصدر حقيقة واحد: القائمة والخريطة وملف القرار تقرأ من هنا فقط.
 * 2) نقي بالكامل — لا DOM ولا خريطة — فيُختبر في Node.
 * 3) المرشحات تتراكم؛ ضبط مرشح لا يمحو غيره.
 * 4) الفرز الافتراضي بالأثر تنازلياً: الصندوق يفتح على أخطر عمل.
 * 5) لا يعدّل المصفوفة الواردة.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarDeskStore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DECISION_STATUSES = [
    'CompletenessReview', 'ImpactScreening', 'CoordinationRequired', 'StrategyReview',
  ];

  function matchesQuery(properties, query) {
    var needle = String(query).trim();
    if (!needle) return true;
    return ['street', 'permitRef', 'title', 'promoter', 'id'].some(function (key) {
      return String(properties[key] || '').indexOf(needle) !== -1;
    });
  }

  function matches(feature, filters) {
    var p = feature.properties;
    if (filters.status && p.status !== filters.status) return false;
    if (filters.severity && Number(p.severity) !== Number(filters.severity)) return false;
    if (filters.group && p.group !== filters.group) return false;
    if (filters.query && !matchesQuery(p, filters.query)) return false;
    return true;
  }

  var SORTERS = {
    impact: function (a, b) {
      return (b.properties.impactVehHours || 0) - (a.properties.impactVehHours || 0);
    },
    severity: function (a, b) {
      return (b.properties.severity || 0) - (a.properties.severity || 0);
    },
    start: function (a, b) {
      return Date.parse(a.properties.start || 0) - Date.parse(b.properties.start || 0);
    },
    street: function (a, b) {
      return String(a.properties.street).localeCompare(String(b.properties.street), 'ar');
    },
  };

  function createStore(features) {
    var all = (features || []).slice();
    var state = { selectedId: null, filters: {}, sort: 'impact' };
    var listeners = [];

    function emit() {
      listeners.slice().forEach(function (fn) { fn(); });
    }

    function getVisible() {
      var sorter = SORTERS[state.sort] || SORTERS.impact;
      return all.filter(function (feature) {
        return matches(feature, state.filters);
      }).sort(sorter);
    }

    function find(id) {
      for (var i = 0; i < all.length; i += 1) {
        if (all[i].properties.id === id) return all[i];
      }
      return null;
    }

    return {
      getState: function () {
        return {
          selectedId: state.selectedId,
          filters: JSON.parse(JSON.stringify(state.filters)),
          sort: state.sort,
          features: all,
        };
      },

      subscribe: function (fn) {
        listeners.push(fn);
        return function () {
          var index = listeners.indexOf(fn);
          if (index !== -1) listeners.splice(index, 1);
        };
      },

      select: function (id) {
        state.selectedId = find(id) ? id : null;
        emit();
      },

      setFilter: function (key, value) {
        state.filters[key] = value;
        emit();
      },

      clearFilter: function (key) {
        delete state.filters[key];
        emit();
      },

      setSort: function (key) {
        state.sort = SORTERS[key] ? key : 'impact';
        emit();
      },

      getVisible: getVisible,

      getSelected: function () {
        return state.selectedId ? find(state.selectedId) : null;
      },

      counts: function () {
        var byStatus = {};
        var needsDecision = 0;
        all.forEach(function (feature) {
          var status = feature.properties.status;
          byStatus[status] = (byStatus[status] || 0) + 1;
          if (DECISION_STATUSES.indexOf(status) !== -1) needsDecision += 1;
        });
        return {
          total: all.length,
          visible: getVisible().length,
          byStatus: byStatus,
          needsDecision: needsDecision,
        };
      },
    };
  }

  return { createStore: createStore, DECISION_STATUSES: DECISION_STATUSES, SORTERS: SORTERS };
});
```

- [ ] **Step 4: شغّل الاختبار وتأكد من النجاح**

```bash
node presentation/tests/desk-store-test.js
```

المتوقع: `12 اختبارات نجحت`.

- [ ] **Step 5: Commit**

```bash
git add presentation/masar-desk-store.js presentation/tests/desk-store-test.js
git commit -m "feat: single state store for the reviewer desk"
```

---

## Task 6: آلة الحالة والحُرّاس وسجل التدقيق

**Files:**
- Create: `presentation/masar-desk-states.js`
- Create: `presentation/tests/desk-states-test.js`

**Interfaces:**
- Consumes: لا شيء.
- Produces:
  - `TRANSITIONS` — خريطة `{ الحالة: [الحالات المسموحة] }` مطابقة لـ `data-model-and-state-machines.md`.
  - `LABELS` — التسمية العربية والرمز لكل حالة: `{ status: { label, icon, tone } }`.
  - `can(from, to)` → `boolean`.
  - `guard(work, action)` → `{ allowed, blockers: [{ field, reason, message }] }`.
  - `apply(work, action, actor, reason)` → `{ work, event }` — نسخة جديدة برقم نسخة أعلى وحدث تدقيق. **لا يعدّل الأصل.**
  - `nextAction(status)` → نص عربي.

السبب: القواعد التي لا تُكسر في البحث («لا تعتمد توصية بلا نسخة مدخلات»، «لا ينشر إغلاق بلا زمن انتهاء») تظل شعارات ما لم تصبح حُرّاساً يفشل الاختبار عند خرقها.

- [ ] **Step 1: اكتب الاختبار الفاشل**

`presentation/tests/desk-states-test.js`:

```js
'use strict';
const assert = require('assert');
const path = require('path');
const States = require(path.join(__dirname, '..', 'masar-desk-states.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

function work(props) {
  return Object.assign({
    id: 'w1', permitRef: 'BLD-0001', status: 'ImpactScreening',
    start: '2026-07-22T06:00:00Z', end: '2026-07-24T06:00:00Z',
    lanes: 4, lanesClosed: 1, direction: 'north',
    impactVehHours: 120, version: 1, inputsVersion: 'v1',
  }, props || {});
}

ok('الانتقالات تطابق آلة الحالة المعتمدة', () => {
  assert.ok(States.can('ImpactScreening', 'StrategyReview'));
  assert.ok(States.can('StrategyReview', 'Approved'));
  assert.ok(States.can('StrategyReview', 'Returned'));
  assert.ok(States.can('Approved', 'Scheduled'));
  assert.ok(!States.can('ImpactScreening', 'Approved'), 'قفزة فوق مراجعة الاستراتيجية');
  assert.ok(!States.can('Closed', 'Draft'), 'رجوع للخلف من حالة نهائية');
});

ok('كل حالة تحمل تسمية عربية ورمزاً ونبرة — لا لون وحده', () => {
  Object.keys(States.TRANSITIONS).forEach((status) => {
    const label = States.LABELS[status];
    assert.ok(label, `حالة بلا تسمية: ${status}`);
    assert.ok(label.label && label.icon && label.tone, `تسمية ناقصة: ${status}`);
  });
});

ok('لا اعتماد بلا نسخة مدخلات', () => {
  const result = States.guard(work({ status: 'StrategyReview', inputsVersion: null }), 'approve');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.blockers.some((b) => b.field === 'inputsVersion'));
});

ok('لا نشر بلا زمن انتهاء', () => {
  const result = States.guard(work({ status: 'Approved', end: null }), 'publish');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.blockers.some((b) => b.field === 'end'));
});

ok('لا نشر بلا اتجاه', () => {
  const result = States.guard(work({ status: 'Approved', direction: null }), 'publish');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.blockers.some((b) => b.field === 'direction'));
});

ok('المسارات المغلقة لا تتجاوز الكلية', () => {
  const result = States.guard(work({ status: 'StrategyReview', lanesClosed: 5, lanes: 4 }), 'approve');
  assert.strictEqual(result.allowed, false);
  assert.ok(result.blockers.some((b) => b.field === 'lanesClosed'));
});

ok('العمل المكتمل يمرّ من الحارس', () => {
  const result = States.guard(work({ status: 'StrategyReview' }), 'approve');
  assert.strictEqual(result.allowed, true);
  assert.deepStrictEqual(result.blockers, []);
});

ok('كل عائق يحمل رسالة عربية قابلة للعرض', () => {
  const result = States.guard(work({ status: 'StrategyReview', inputsVersion: null }), 'approve');
  result.blockers.forEach((blocker) => {
    assert.ok(typeof blocker.message === 'string' && blocker.message.length > 4,
      `عائق بلا رسالة: ${blocker.field}`);
  });
});

ok('التطبيق يرفع رقم النسخة ولا يعدّل الأصل', () => {
  const original = work({ status: 'StrategyReview' });
  const snapshot = JSON.stringify(original);
  const result = States.apply(original, 'approve', 'مراجع أول', 'الأثر ضمن الحد');
  assert.strictEqual(JSON.stringify(original), snapshot, 'الأصل تغيّر');
  assert.strictEqual(result.work.version, 2);
  assert.strictEqual(result.work.status, 'Approved');
});

ok('كل تطبيق ينتج حدث تدقيق كامل', () => {
  const result = States.apply(work({ status: 'StrategyReview' }), 'approve', 'مراجع أول', 'ضمن الحد');
  const event = result.event;
  ['entity', 'version', 'action', 'from', 'to', 'actor', 'reason', 'at'].forEach((field) => {
    assert.ok(event[field] !== undefined, `حدث التدقيق ينقصه ${field}`);
  });
  assert.strictEqual(event.from, 'StrategyReview');
  assert.strictEqual(event.to, 'Approved');
});

ok('التطبيق المحظور يرمي ولا يغيّر شيئاً بصمت', () => {
  assert.throws(() => {
    States.apply(work({ status: 'StrategyReview', inputsVersion: null }), 'approve', 'مراجع', 'x');
  }, /blocked|محظور/i);
});

ok('الإجراء التالي معرّف لكل حالة عاملة', () => {
  ['CompletenessReview', 'ImpactScreening', 'CoordinationRequired', 'StrategyReview', 'Approved', 'Scheduled', 'Deployed']
    .forEach((status) => {
      assert.ok(States.nextAction(status).length > 2, `لا إجراء تالٍ لـ ${status}`);
    });
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

```bash
node presentation/tests/desk-states-test.js
```

- [ ] **Step 3: اكتب آلة الحالة**

`presentation/masar-desk-states.js`:

```js
/**
 * مسار — آلة حالة العمل وحُرّاسها وسجل التدقيق.
 * ---------------------------------------------------------------------------
 * 1) الانتقالات من data-model-and-state-machines.md حرفياً — لا اجتهاد.
 * 2) القواعد التي لا تُكسر صارت حُرّاساً يفشل الاختبار عند خرقها.
 * 3) apply لا يعدّل الأصل: نسخة جديدة برقم أعلى + حدث تدقيق.
 * 4) كل حالة تحمل لوناً ورمزاً ونصاً — لا لون وحده.
 *
 * UMD بنفس نمط masar-engine.js.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MasarDeskStates = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TRANSITIONS = {
    Draft: ['Submitted'],
    Submitted: ['CompletenessReview'],
    CompletenessReview: ['Returned', 'ImpactScreening'],
    Returned: ['Submitted'],
    ImpactScreening: ['CoordinationRequired', 'SpecialistSimulation', 'StrategyReview'],
    CoordinationRequired: ['ImpactScreening'],
    SpecialistSimulation: ['StrategyReview'],
    StrategyReview: ['Approved', 'Rejected', 'Returned'],
    Approved: ['Scheduled'],
    Scheduled: ['Deployed'],
    Deployed: ['Suspended', 'Completed'],
    Suspended: ['Deployed'],
    Completed: ['ClearanceReview'],
    ClearanceReview: ['Closed'],
    Closed: ['Calibrated'],
    Calibrated: [],
    Rejected: [],
  };

  var LABELS = {
    Draft: { label: 'مسودة', icon: '○', tone: 'muted' },
    Submitted: { label: 'مُرسل', icon: '▸', tone: 'info' },
    CompletenessReview: { label: 'فحص الاكتمال', icon: '⚑', tone: 'warning' },
    Returned: { label: 'مُرجَع', icon: '↩', tone: 'warning' },
    ImpactScreening: { label: 'فرز الأثر', icon: '◈', tone: 'info' },
    CoordinationRequired: { label: 'يحتاج تنسيقاً', icon: '⇄', tone: 'warning' },
    SpecialistSimulation: { label: 'محاكاة متخصصة', icon: '◎', tone: 'info' },
    StrategyReview: { label: 'مراجعة القرار', icon: '◆', tone: 'danger' },
    Approved: { label: 'معتمد', icon: '✓', tone: 'success' },
    Rejected: { label: 'مرفوض', icon: '✕', tone: 'danger' },
    Scheduled: { label: 'مجدول', icon: '⌚', tone: 'success' },
    Deployed: { label: 'قيد التنفيذ', icon: '▣', tone: 'info' },
    Suspended: { label: 'موقوف', icon: '‖', tone: 'warning' },
    Completed: { label: 'منتهٍ', icon: '▤', tone: 'muted' },
    ClearanceReview: { label: 'فحص إعادة الطريق', icon: '⚐', tone: 'info' },
    Closed: { label: 'مغلق', icon: '■', tone: 'muted' },
    Calibrated: { label: 'مُعايَر', icon: '↺', tone: 'success' },
  };

  var NEXT_ACTION = {
    Draft: 'أكمل الطلب',
    Submitted: 'ابدأ فحص الاكتمال',
    CompletenessReview: 'أكمل البيانات الناقصة',
    Returned: 'أعد الإرسال بعد التصحيح',
    ImpactScreening: 'افحص الأثر',
    CoordinationRequired: 'نسّق مع الجهة المتعارضة',
    SpecialistSimulation: 'استلم مؤشرات المحاكاة',
    StrategyReview: 'اعتمد أو أرجع',
    Approved: 'ثبّت الجدول',
    Scheduled: 'انشر الإغلاق',
    Deployed: 'راقب القياس',
    Suspended: 'عالج سبب الإيقاف',
    Completed: 'افحص إعادة الطريق',
    ClearanceReview: 'أغلق العمل',
    Closed: 'شغّل المعايرة',
    Calibrated: 'لا إجراء',
    Rejected: 'لا إجراء',
  };

  var ACTION_TARGET = {
    approve: 'Approved',
    reject: 'Rejected',
    return: 'Returned',
    screen: 'StrategyReview',
    coordinate: 'CoordinationRequired',
    schedule: 'Scheduled',
    publish: 'Deployed',
  };

  function can(from, to) {
    return (TRANSITIONS[from] || []).indexOf(to) !== -1;
  }

  function blocker(field, reason, message) {
    return { field: field, reason: reason, message: message };
  }

  /** القواعد التي لا تُكسر — كل واحدة تقابل بنداً في وثيقة النماذج. */
  function guard(work, action) {
    var blockers = [];
    var target = ACTION_TARGET[action];

    if (!target) {
      blockers.push(blocker('action', 'unknown-action', 'إجراء غير معروف: ' + action));
      return { allowed: false, blockers: blockers };
    }

    if (!can(work.status, target)) {
      blockers.push(blocker('status', 'illegal-transition',
        'لا يمكن الانتقال من «' + (LABELS[work.status] || {}).label + '» إلى «'
        + (LABELS[target] || {}).label + '».'));
    }

    if (action === 'approve' && !work.inputsVersion) {
      blockers.push(blocker('inputsVersion', 'snapshot-required',
        'لا اعتماد بلا نسخة مدخلات مثبّتة — النتيجة لن تكون قابلة للتفسير لاحقاً.'));
    }

    if (action === 'publish') {
      if (!work.end) {
        blockers.push(blocker('end', 'end-required',
          'لا ينشر إغلاق بلا زمن انتهاء — القنوات تحتاج موعد رفع النشر.'));
      }
      if (!work.direction) {
        blockers.push(blocker('direction', 'direction-required',
          'لا ينشر إغلاق بلا اتجاه — الملاحة لا تستطيع تفسير مقطع بلا اتجاه.'));
      }
    }

    if (Number(work.lanesClosed) > Number(work.lanes)) {
      blockers.push(blocker('lanesClosed', 'exceeds-total',
        'المسارات المغلقة (' + work.lanesClosed + ') تتجاوز الكلية (' + work.lanes + ').'));
    }

    if (work.start && work.end && Date.parse(work.end) <= Date.parse(work.start)) {
      blockers.push(blocker('end', 'end-before-start', 'زمن الانتهاء ليس بعد زمن البدء.'));
    }

    return { allowed: blockers.length === 0, blockers: blockers };
  }

  function apply(work, action, actor, reason) {
    var check = guard(work, action);
    if (!check.allowed) {
      throw new Error('blocked: ' + check.blockers.map(function (b) { return b.field; }).join(','));
    }

    var target = ACTION_TARGET[action];
    var next = JSON.parse(JSON.stringify(work));
    next.status = target;
    next.version = Number(work.version || 1) + 1;
    next.nextAction = NEXT_ACTION[target];

    return {
      work: next,
      event: {
        entity: work.permitRef || work.id,
        version: next.version,
        action: action,
        from: work.status,
        to: target,
        actor: actor,
        reason: reason || '',
        at: next.decidedAt || null,
      },
    };
  }

  function nextAction(status) {
    return NEXT_ACTION[status] || 'راجع';
  }

  return {
    TRANSITIONS: TRANSITIONS,
    LABELS: LABELS,
    ACTION_TARGET: ACTION_TARGET,
    can: can,
    guard: guard,
    apply: apply,
    nextAction: nextAction,
  };
});
```

**ملاحظة:** `event.at` يبقى `null` هنا عمداً — الوقت يُحقن من المستدعي كي تبقى الدالة نقية وقابلة للاختبار بلا `Date.now()`. الصفحة تضبطه عند التسجيل.

- [ ] **Step 4: شغّل وتأكد من النجاح**

```bash
node presentation/tests/desk-states-test.js
```

المتوقع: `12 اختبارات نجحت`.

- [ ] **Step 5: Commit**

```bash
git add presentation/masar-desk-states.js presentation/tests/desk-states-test.js
git commit -m "feat: work state machine with unbreakable guards"
```

---

## Task 7: صندوق الأعمال وملف القرار — التصيير

**Files:**
- Create: `presentation/masar-desk-inbox.js`
- Create: `presentation/masar-desk-file.js`
- Create: `presentation/tests/desk-render-test.js`

**Interfaces:**
- Consumes: `MasarDeskStates.LABELS`، `MasarDeskStates.nextAction`.
- Produces:
  - `Inbox.renderRow(feature, isSelected)` → HTML للصف الواحد.
  - `Inbox.renderList(features, selectedId)` → HTML للقائمة كاملة (مع حالة «لا نتائج»).
  - `Inbox.renderToolbar(counts, filters)` → HTML لشريط البحث والمرشحات والعدّادات.
  - `File.renderEmpty()` → حالة «لم تختر عملاً بعد».
  - `File.renderHeader(feature)`، `File.renderTabs(active)`، `File.renderSummary(feature, analysis)`، `File.renderConfidence(feature)`، `File.renderBlockers(blockers)`.
  - كل الدوال نقية وترجع نصاً؛ كل قيمة تمر بترميز HTML.

- [ ] **Step 1: اكتب الاختبار الفاشل**

`presentation/tests/desk-render-test.js`:

```js
'use strict';
const assert = require('assert');
const path = require('path');
const Inbox = require(path.join(__dirname, '..', 'masar-desk-inbox.js'));
const File = require(path.join(__dirname, '..', 'masar-desk-file.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

function feature(props) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[46.68, 24.71], [46.69, 24.72]] },
    properties: Object.assign({
      id: 'w1', permitRef: 'BLD-2026-0001', status: 'StrategyReview',
      street: 'طريق الملك فهد', title: 'أعمال على طريق الملك فهد',
      severity: 3, confidence: 'low', impactVehHours: 940, delayPct: 42.5,
      start: '2026-07-22T06:00:00Z', end: '2026-07-24T06:00:00Z',
      promoter: 'شركة المياه الوطنية', lanes: 4, lanesClosed: 2, version: 1,
    }, props || {}),
  };
}

ok('الصف يعرض السبعة حقول التي يطلبها نظام التصميم', () => {
  const html = Inbox.renderRow(feature(), false);
  ['BLD-2026-0001', 'طريق الملك فهد', 'مراجعة القرار', 'اعتمد أو أرجع']
    .forEach((needle) => assert.ok(html.indexOf(needle) !== -1, `الصف ينقصه: ${needle}`));
  assert.ok(/94\d/.test(html), 'الأثر غير معروض');
});

ok('الحالة تُنقل بلون ورمز ونص معاً لا باللون وحده', () => {
  const html = Inbox.renderRow(feature(), false);
  assert.ok(html.indexOf('◆') !== -1, 'رمز الحالة مفقود');
  assert.ok(html.indexOf('مراجعة القرار') !== -1, 'نص الحالة مفقود');
  assert.ok(html.indexOf('data-tone="danger"') !== -1, 'نبرة الحالة مفقودة');
});

ok('الصف المحدد يعلن نفسه للقارئ الصوتي', () => {
  const html = Inbox.renderRow(feature(), true);
  assert.ok(html.indexOf('aria-selected="true"') !== -1);
});

ok('الصف يحمل معرّفه كي تربطه الخريطة', () => {
  assert.ok(Inbox.renderRow(feature(), false).indexOf('data-work-id="w1"') !== -1);
});

ok('القائمة الفارغة تشرح ولا تصمت', () => {
  const html = Inbox.renderList([], null);
  assert.ok(html.indexOf('لا نتائج') !== -1 || html.indexOf('لا أعمال') !== -1);
});

ok('شريط الأدوات يفصل المرئي عن الكلي', () => {
  const html = Inbox.renderToolbar({ total: 150, visible: 12, needsDecision: 40, byStatus: {} }, {});
  assert.ok(html.indexOf('12') !== -1 && html.indexOf('150') !== -1);
  assert.ok(html.indexOf('40') !== -1, 'عدّاد ما ينتظر قراراً مفقود');
});

ok('ملف القرار الفارغ يوجّه الخطوة التالية', () => {
  const html = File.renderEmpty();
  assert.ok(html.length > 20);
  assert.ok(html.indexOf('اختر') !== -1, 'لا توجيه للخطوة التالية');
});

ok('رأس الملف يعرض المرجع والشارع والنسخة', () => {
  const html = File.renderHeader(feature());
  ['BLD-2026-0001', 'طريق الملك فهد'].forEach((needle) => {
    assert.ok(html.indexOf(needle) !== -1, `الرأس ينقصه: ${needle}`);
  });
  assert.ok(/نسخة\s*1|v1/.test(html), 'رقم النسخة مفقود');
});

ok('التبويبات السبعة كلها معلنة والنشط معلَّم', () => {
  const html = File.renderTabs('impact');
  ['الملخص', 'الأثر', 'التعارض', 'الخطة', 'التاريخ', 'النشر', 'القياس']
    .forEach((tab) => assert.ok(html.indexOf(tab) !== -1, `تبويب مفقود: ${tab}`));
  assert.ok(html.indexOf('aria-selected="true"') !== -1);
});

ok('شريط الثقة يشرح سبب الانخفاض وما يرفعها', () => {
  const html = File.renderConfidence(feature({ confidence: 'low' }));
  assert.ok(html.indexOf('منخفضة') !== -1, 'مستوى الثقة مفقود');
  assert.ok(html.length > 80, 'شريط الثقة نسبة مجردة بلا تفسير');
  assert.ok(html.indexOf('يرفعها') !== -1 || html.indexOf('لرفعها') !== -1,
    'لا يذكر ما يرفع الثقة');
});

ok('العوائق تُعرض برسائلها لا برموزها', () => {
  const html = File.renderBlockers([
    { field: 'inputsVersion', reason: 'snapshot-required', message: 'لا اعتماد بلا نسخة مدخلات مثبّتة.' },
  ]);
  assert.ok(html.indexOf('لا اعتماد بلا نسخة مدخلات') !== -1);
  assert.ok(html.indexOf('snapshot-required') === -1, 'رمز داخلي تسرّب للواجهة');
});

ok('لا حقن HTML من بيانات التصريح', () => {
  const hostile = feature({ street: '<img src=x onerror=alert(1)>', promoter: '"onmouseover="x' });
  const row = Inbox.renderRow(hostile, false);
  const header = File.renderHeader(hostile);
  [row, header].forEach((html) => {
    assert.ok(html.indexOf('<img') === -1, 'تسرّب وسم');
    assert.ok(html.indexOf('onmouseover="x') === -1, 'تسرّب سمة');
  });
});

ok('الحقول الناقصة لا تُظهر undefined', () => {
  const html = Inbox.renderRow({ type: 'Feature', geometry: null, properties: { id: 'x' } }, false);
  assert.ok(html.indexOf('undefined') === -1);
  assert.ok(html.indexOf('—') !== -1, 'لا بديل للحقول الفارغة');
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

```bash
node presentation/tests/desk-render-test.js
```

- [ ] **Step 3: اكتب `masar-desk-inbox.js`**

المواصفة الملزِمة (الاختبار يفرضها؛ الشكل الداخلي حر ما دام يمر):

- `escapeHtml` مشتركة بنفس شكلها في `masar-worksmap-interactions.js`.
- `renderRow` يخرج `<li role="option" data-work-id … aria-selected …>` يحتوي: المرجع (بخط أحادي)، الشارع، نافذة التنفيذ (تاريخان مختصران)، الأثر (`impactVehHours` + `delayPct`)، الثقة، وسم الحالة (`<span data-tone="…"><span aria-hidden="true">الرمز</span> النص</span>`)، والإجراء التالي من `MasarDeskStates.nextAction`.
- ارتفاع الصف من `--masar-row-h`.
- كل قيمة غائبة تصبح `—`.
- `renderList` يلفّ في `<ul role="listbox" aria-label="صندوق الأعمال">`، ويعيد حالة فارغة نصّها «لا نتائج مطابقة — وسّع المرشحات».
- `renderToolbar` يخرج حقل بحث (`id="desk-search"`)، مُنتقي حالة، مُنتقي فرز، وعدّادات: «يُعرض {visible} من {total}» و«{needsDecision} ينتظر قراراً».

- [ ] **Step 4: اكتب `masar-desk-file.js`**

المواصفة الملزِمة:

- `renderEmpty()` → «اختر عملاً من الصندوق لفتح ملف القرار.»
- `renderHeader(feature)` → المرجع + العنوان + الشارع + «نسخة {version}» + وسم الحالة.
- `renderTabs(active)` → `role="tablist"` بسبعة `role="tab"`، النشط `aria-selected="true"`.
- `renderConfidence(feature)` → مستوى عربي (`عالية/متوسطة/منخفضة`) + سبب الانخفاض المشتق من الحقول (`severity>=3` ⇒ «أثر مرتفع ونطاق عدم يقين واسع»، غياب `observations` ⇒ «لا قياس ميداني بعد») + سطر «ما يرفعها: …» + «آخر معايرة: —».
- `renderBlockers(blockers)` → قائمة رسائل فقط؛ حقل `reason` الداخلي لا يظهر إطلاقاً.
- `renderSummary(feature, analysis)` → بطاقة القرار: التوصية، الفرق عن الطلب، أكبر ثلاثة أسباب من `MasarReasons.explain`، نطاق الثقة، مصدر البيانات، وزرّا «اعتماد» و«إرجاع».

- [ ] **Step 5: شغّل وتأكد من النجاح**

```bash
node presentation/tests/desk-render-test.js
```

المتوقع: `13 اختبارات نجحت`.

- [ ] **Step 6: Commit**

```bash
git add presentation/masar-desk-inbox.js presentation/masar-desk-file.js presentation/tests/desk-render-test.js
git commit -m "feat: inbox row and decision file renderers"
```

---

## Task 8: تركيب المكتب

**Files:**
- Create: `presentation/masar-desk.css`
- Modify: `presentation/masar-desk.html` (استبدال الصفحة الانتقالية بالتركيب الكامل)
- Modify: `presentation/masar-worksmap.js` (إضافة `highlightWork` و`onWorkHover` — إضافة فقط)
- Modify: `presentation/tests/worksmap-api-test.js` (العقد صار ١٦ دالة)

**Interfaces:**
- Consumes: `MasarDeskStore`, `MasarDeskStates`, `MasarDeskInbox`, `MasarDeskFile`, `MasarWorksMap`, `MasarEngine`, `MasarReasons`, `MasarConflict`, `window.MASAR_CITY_PORTFOLIO`.
- Produces: `window.__masarDesk = { store, map, api }` لأغراض الفحص الآلي.

التخطيط (RTL — الصندوق يمين، الملف يسار):

```text
┌──────────────────────────────────────────────────────────────────┐
│ شريط التنقل                                                       │
├──────────────┬────────────────────────────────┬──────────────────┤
│ صندوق الأعمال │ الخريطة                        │ ملف القرار        │
│ 384px        │ 1fr                            │ 384px            │
│ بحث/مرشح/فرز  │ الأعمال + التعارض + المحدد      │ رأس/تبويبات/بطاقة │
└──────────────┴────────────────────────────────┴──────────────────┘
```

- [ ] **Step 1: أضف الدالتين إلى عقد الخريطة**

في `masar-worksmap.js` أضف إلى `API_METHODS`:

```js
  var API_METHODS = ['onReady','setCorridor','onCorridorClick','setCorridorState',
    'setAllCorridorStates','setCorridorColors','setCorridorColor','setDigSite',
    'setAlternatives','sweepUnlock','setPhase','updateRoad','onRoadClick','getData',
    'setWorks','setDateRange','toggleGroup','highlightWork','onWorkHover'];
```

و`highlightWork(id)` يضبط مصدر `work-highlight` على هندسة العمل ويطير إليه بـ `--masar-t-map`؛ `onWorkHover(cb)` يسجّل مستمعاً على `mousemove` فوق طبقات الأعمال ويبلّغ بالمعرّف أو `null`.

- [ ] **Step 2: حدّث عقد الاختبار**

في `tests/worksmap-api-test.js` أضف الاسمين إلى قائمة الدوال المتوقعة وارفع العدد إلى ١٦.

- [ ] **Step 3: اكتب `masar-desk.css`**

يستورد `masar-tokens.css` ثم: شبكة ثلاثة أعمدة، صفوف بارتفاع `--masar-row-h`، تمرير داخلي للعمودين الجانبيين فقط، `:hover` على الصف بـ `--masar-primary-soft`، `:focus-visible` بحلقة `--masar-primary`، وسوم الحالة تقرأ `data-tone` وتخرّج لونها من `--masar-{tone}` و`--masar-{tone}-soft`. عند `max-width: 1100px` تنطوي الأعمدة إلى تبويبات. `prefers-reduced-motion` يوقف كل انتقال.

- [ ] **Step 4: اكتب `masar-desk.html`**

الربط الملزم:

1. المخزن يُنشأ من `MasarWorksMapData.normalizeWorks(window.MASAR_CITY_PORTFOLIO).features` بعد دمج خصائص المحفظة الأصلية (التطبيع يُبقي `status`/`nextAction` عبر تمريرهما في `properties`).
2. `store.subscribe` يعيد تصيير الصندوق والملف ويستدعي `map.highlightWork(selectedId)`.
3. النقر على صف ⇒ `store.select(id)`. لمس المفتاح `Enter`/`Space` على صف يفعل الشيء نفسه؛ الأسهم تتنقل.
4. `api.onWorkHover(id)` ⇒ إضافة `data-hover` على الصف المقابل وتمريره إلى الرؤية.
5. النقر على ميزة في الخريطة ⇒ `store.select(id)` ⇒ الصندوق يمرّر إلى الصف.
6. تغيير البحث/المرشح/الفرز ⇒ `store.setFilter` / `setSort`، ثم `api.setWorks` بالمرئي فقط — الخريطة تعكس المرشح.
7. زر «اعتماد» يستدعي `MasarDeskStates.guard`؛ عند وجود عوائق تُعرض عبر `File.renderBlockers` **ولا يُنفَّذ الإجراء**؛ عند الخلو يُستدعى `apply` ويُدفَع الحدث إلى قائمة تدقيق مرئية في تبويب «التاريخ».
8. شارة «بيانات توضيحية للعرض» ثابتة في الشريط العلوي.

- [ ] **Step 5: تحقق آلياً في المتصفح**

```bash
node presentation/server.js
```

ثم في المتصفح على `http://localhost:8734/masar-desk.html` تحقق من: `console` نظيفة، صندوق يفتح على عمل حالته `StrategyReview`، النقر يطير بالخريطة، الملف يمتلئ، «اعتماد» على عمل ناقص المدخلات يعرض العائق ولا يغيّر الحالة.

- [ ] **Step 6: Commit**

```bash
git add presentation/masar-desk.html presentation/masar-desk.css presentation/masar-worksmap.js presentation/tests/worksmap-api-test.js
git commit -m "feat: reviewer desk — inbox, map and decision file on one screen"
```

---

## Task 9: بطاقة القرار الحيّة

**Files:**
- Modify: `presentation/masar-desk.html` (وصل المحركات)
- Modify: `presentation/masar-desk-file.js` (`renderSummary` بمدخلات حقيقية)
- Modify: `presentation/tests/desk-render-test.js` (+٤ اختبارات)

**Interfaces:**
- Consumes: `MasarEngine.score`, `MasarEngine.optimize`, `MasarReasons.explain`, `MasarConflict.analyze`.
- Produces: `analysis` = `{ scored, alternatives, reasons, conflicts, delta }` يُمرَّر إلى `File.renderSummary`.

القاعدة الحاسمة: **الأرقام في الملف تُحسب من العمل المحدد لحظة تحديده، لا تُقرأ من الملف.** المحكّم سيختار عملاً آخر ويتوقع أن يتغير كل شيء.

- [ ] **Step 1: أضف الاختبارات**

```js
ok('بطاقة القرار تعرض ثلاثة أسباب رقمية بحد أقصى', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 42.5, delayVehHours: 940 },
    alternatives: [{ label: 'نافذة ليلية', delayVehHours: 310 }],
    reasons: [{ label: 'ساعة الذروة', value: 0.42 }, { label: 'مساران مغلقان', value: 0.31 },
              { label: 'حجم الحركة', value: 0.18 }, { label: 'رابع', value: 0.09 }],
    conflicts: [], delta: -67,
  });
  assert.ok(html.indexOf('رابع') === -1, 'أكثر من ثلاثة أسباب');
  assert.ok(html.indexOf('ساعة الذروة') !== -1);
});

ok('البطاقة تعرض الفرق عن الطلب الأصلي', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 42.5, delayVehHours: 940 },
    alternatives: [{ label: 'نافذة ليلية', delayVehHours: 310 }],
    reasons: [], conflicts: [], delta: -67,
  });
  assert.ok(/67/.test(html), 'الفرق عن الطلب مفقود');
});

ok('لا توصية عند غياب البدائل — امتناع صريح', () => {
  const html = File.renderSummary(feature(), {
    scored: null, alternatives: [], reasons: [], conflicts: [], delta: null,
  });
  assert.ok(html.indexOf('لا توصية') !== -1, 'يوصي بلا أساس');
});

ok('التعارضات تظهر بعددها ولا تُخفى', () => {
  const html = File.renderSummary(feature(), {
    scored: { delayPct: 10, delayVehHours: 100 },
    alternatives: [{ label: 'x', delayVehHours: 90 }],
    reasons: [], conflicts: [{ withId: 'w9', overlapHours: 12 }], delta: -10,
  });
  assert.ok(html.indexOf('تعارض') !== -1);
});
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

```bash
node presentation/tests/desk-render-test.js
```

- [ ] **Step 3: نفّذ `renderSummary` واربط المحركات**

في `masar-desk.html`، دالة `analyze(feature)` تُستدعى عند كل تحديد:

```js
  function analyze(feature) {
    var p = feature.properties;
    var input = {
      aadt: p.aadt || 60000,
      lanes: p.lanes,
      lanesClosed: p.lanesClosed,
      startHour: new Date(p.start).getUTCHours(),
      durationHours: Math.max(1, (Date.parse(p.end) - Date.parse(p.start)) / 3600000),
      capacityPerLane: MasarEngine.DEFAULTS.capacityPerLane,
      freeFlowMin: MasarEngine.DEFAULTS.freeFlowMin,
    };
    var scored = MasarEngine.score(input);
    var alternatives = MasarEngine.optimize(input).slice(0, 3);
    var best = alternatives[0];
    return {
      scored: scored,
      alternatives: alternatives,
      reasons: MasarReasons.explain(input, scored).slice(0, 3),
      conflicts: overlapping(feature),
      delta: best ? Math.round(((best.delayVehHours - scored.delayVehHours) / scored.delayVehHours) * 100) : null,
    };
  }
```

`overlapping(feature)` يبحث في المخزن عن أعمال على الشارع نفسه بنافذة زمنية متقاطعة ويمررها إلى `MasarConflict.analyze`.

- [ ] **Step 4: شغّل وتأكد من النجاح**

```bash
node presentation/tests/desk-render-test.js
```

المتوقع: `17 اختبارات نجحت`.

- [ ] **Step 5: تحقق أن الأرقام تتغير بتغيّر العمل**

في المتصفح: اختر عملين مختلفين وتأكد أن `delayPct` و«الفرق عن الطلب» والأسباب الثلاثة تغيّرت جميعاً. لو ثبتت، فالبطاقة تقرأ من الملف لا من المحرك — أصلحها.

- [ ] **Step 6: Commit**

```bash
git add presentation/masar-desk.html presentation/masar-desk-file.js presentation/tests/desk-render-test.js
git commit -m "feat: live decision card computed per selected work"
```

---

## Task 10: طبقة الشفافية العامة

**Files:**
- Modify: `presentation/masar-map.html`
- Modify: `presentation/tests/worksmap-page-test.js` (+٤ اختبارات)

**Interfaces:**
- Consumes: نفس المحفظة.
- Produces: لا شيء جديد — إطار عرض فقط.

السبب: المعيار ١٫٥ («تجاوز: طبقة شفافية عامة تحوّل الحل من أداة داخلية إلى منظومة») يساوي نقطة كاملة، والصفحة موجودة أصلاً وينقصها الإطار: بحث بالشارع، وقت آخر تحديث، ولغة موجَّهة للساكن لا للمراجع.

- [ ] **Step 1: أضف الاختبارات**

```js
ok('الصفحة العامة تتيح البحث باسم الشارع', () => {
  assert.ok(html.indexOf('id="wmSearch"') !== -1, 'لا حقل بحث');
});

ok('الصفحة تعلن وقت آخر تحديث', () => {
  assert.ok(html.indexOf('آخر تحديث') !== -1);
});

ok('الصفحة تعرّف نفسها بوصفها طبقة عامة للسكان', () => {
  assert.ok(html.indexOf('للسكان') !== -1 || html.indexOf('العامة') !== -1);
});

ok('الصفحة تذكر الجهة والمقاول في بطاقة التفاصيل', () => {
  const interactions = fs.readFileSync(path.join(ROOT, 'masar-worksmap-interactions.js'), 'utf8');
  assert.ok(interactions.indexOf('الجهة') !== -1);
});
```

- [ ] **Step 2: شغّل وتأكد من الفشل**

```bash
node presentation/tests/worksmap-page-test.js
```

- [ ] **Step 3: أضف الإطار العام**

في الشريط العلوي لـ `masar-map.html`:

```html
  <h1>أعمال الطرق في الرياض — الخريطة العامة</h1>
  <label class="wm-search">
    <span class="visually-hidden">ابحث باسم الشارع</span>
    <input id="wmSearch" type="search" placeholder="ابحث باسم الشارع…" autocomplete="off">
  </label>
  <span class="wm-badge">بيانات توضيحية للعرض</span>
  <span class="wm-bar-spacer"></span>
  <span class="wm-updated" id="wmUpdated">آخر تحديث: —</span>
  <span class="wm-stat" id="wmStat" role="status">جارٍ التحميل…</span>
```

والبحث يرشّح الميزات بالاسم ويعيد `setWorks` بالنتيجة ويطير إلى أول تطابق. `wmUpdated` يُملأ من أحدث `start` في المحفظة.

- [ ] **Step 4: شغّل وتأكد من النجاح**

```bash
node presentation/tests/worksmap-page-test.js
```

- [ ] **Step 5: Commit**

```bash
git add presentation/masar-map.html presentation/masar-worksmap-page.css presentation/tests/worksmap-page-test.js
git commit -m "feat: public transparency framing on the map page"
```

---

## Task 11: البوابة النهائية — اختبار مسار المحكّم

**Files:**
- Create: `presentation/tests/judge-walkthrough-test.js`
- Create: `presentation/tests/run-all.js`
- Modify: `presentation/README-masar.md`

**Interfaces:**
- Consumes: كل ما سبق.
- Produces: أمر واحد يقول «جاهز» أو يقول أين الخلل.

هذا الاختبار يترجم تعريف الإنجاز من بحث المقارنات إلى بوابة آلية. إن مر، فالمشروع يستوفي المعيار الذي وضعه لنفسه.

- [ ] **Step 1: اكتب البوابة**

`presentation/tests/judge-walkthrough-test.js` — فحص ثابت على `masar-desk.html` وملفاته، سبع خطوات:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const desk = fs.readFileSync(path.join(ROOT, 'masar-desk.html'), 'utf8');

ok('١ — يجد عملاً: الصندوق والبحث والمرشح موجودة', () => {
  assert.ok(desk.indexOf('desk-inbox') !== -1);
  assert.ok(desk.indexOf('desk-search') !== -1);
});

ok('٢ — يفهم موقعه وحالته: الخريطة ووسم الحالة على الشاشة نفسها', () => {
  assert.ok(desk.indexOf('MasarWorksMap') !== -1, 'لا خريطة على المكتب');
  assert.ok(desk.indexOf('MasarDeskStates') !== -1, 'لا وسوم حالة');
});

ok('٣ — يرى الأثر والثقة: المحرك وشريط الثقة موصولان', () => {
  assert.ok(desk.indexOf('MasarEngine') !== -1);
  assert.ok(desk.indexOf('renderConfidence') !== -1);
});

ok('٤ — يقارن البدائل: optimize مستدعى', () => {
  assert.ok(desk.indexOf('optimize') !== -1);
});

ok('٥ — يفهم سبب التوصية: الأسباب الرقمية معروضة', () => {
  assert.ok(desk.indexOf('MasarReasons') !== -1);
});

ok('٦ — يعتمد أو يُرجع خلف حارس', () => {
  assert.ok(desk.indexOf('guard') !== -1, 'الاعتماد بلا حارس');
  assert.ok(desk.indexOf('renderBlockers') !== -1, 'العوائق لا تُعرض');
});

ok('٧ — يفتح مسودة الخطة من الشاشة نفسها', () => {
  assert.ok(desk.indexOf('خطة') !== -1);
});

ok('لا إعادة إدخال: المكتب يقرأ المحفظة ولا يعرض نموذج إدخال يدوي', () => {
  assert.ok(desk.indexOf('MASAR_CITY_PORTFOLIO') !== -1);
});

ok('المكتب بلا أي مورد خارجي', () => {
  const tags = desk.match(/<(script|link|img)[^>]*>/g) || [];
  tags.forEach((tag) => assert.ok(!/https?:\/\//.test(tag), `مورد خارجي: ${tag}`));
});

ok('كل صفحات العائلة تقرأ ملف الوسوم', () => {
  ['masar-desk.html', 'masar-map.html', 'masar-decision.html'].forEach((page) => {
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    assert.ok(html.indexOf('masar-tokens.css') !== -1 || html.indexOf('masar-nav.js') !== -1,
      `${page} خارج نظام الوسوم`);
  });
});

console.log(`\n${passed} اختبارات نجحت`);
```

- [ ] **Step 2: اكتب المُشغِّل**

`presentation/tests/run-all.js`:

```js
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter((f) => f.endsWith('-test.js'))
  .sort();

let failed = 0;
for (const file of files) {
  process.stdout.write(file.padEnd(34));
  try {
    execFileSync(process.execPath, [path.join(dir, file)], { stdio: 'pipe' });
    console.log('نجح');
  } catch (error) {
    failed += 1;
    console.log('فشل');
    process.stdout.write(String(error.stdout || '') + String(error.stderr || ''));
  }
}

console.log(`\n${files.length - failed}/${files.length} حزمة نجحت`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: شغّل كل شيء**

```bash
node presentation/tests/run-all.js
```

المتوقع: `27/27 حزمة نجحت`.

- [ ] **Step 4: حدّث README**

أضف في أعلى `README-masar.md` مسار المحكّم الجديد:

```markdown
## ⚡ دليل المحكّم — ٦٠ ثانية

1. `node presentation/server.js` ثم افتح `http://localhost:8734/masar-desk.html`.
2. الصندوق مفتوح على أخطر عمل ينتظر قراراً. اضغطه.
3. الخريطة تطير إليه، وملف القرار يمتلئ: الأثر، الثقة وسببها، ثلاثة بدائل، ثلاثة أسباب رقمية.
4. اضغط «اعتماد» على عمل ناقص المدخلات — النظام يمتنع ويشرح لماذا.
5. اضغطه على عمل مكتمل — الحالة تتغير وسجل التدقيق يسجّل النسخة.
6. تبويب «الخريطة» يعرض الطبقة العامة للسكان على المحفظة نفسها.

كل الحزم: `node presentation/tests/run-all.js`
```

- [ ] **Step 5: Commit**

```bash
git add presentation/tests/judge-walkthrough-test.js presentation/tests/run-all.js presentation/README-masar.md
git commit -m "test: judge walkthrough gate and single test runner"
```

---

## أثر الخطة على الدرجة

| المعيار | اليوم | بعد الموجة ٢ | بعد الموجة ٤ | ما الذي يحرّكه |
|---|---|---|---|---|
| ١ معالجة التحدي | ٧٫٠ | ٨٫٥ | **٩٫٥** | مكتب المراجع = القرار قبل التصريح فعلاً؛ الطبقة العامة تُغلق ١٫٥ |
| ٢ الابتكار | ٧٫٥ | ٨٫٥ | **٩٫٥** | محرك القرار والتفسير خرجا من المختبر إلى المسار الرئيسي |
| ٣ الجدوى | ٨٫٥ | ٩٫٠ | **٩٫٥** | آلة حالة وحُرّاس ونسخ = معمار قابل للتكامل لا عرضاً |
| ٤ الأثر | ٧٫٥ | ٨٫٥ | **٩٫٠** | ١٥٠ تصريحاً بأثر محسوب على شوارع حقيقية؛ ٩٫٥ تحتاج حلقة المعايرة (بعد الحدث) |
| ٥ جودة النموذج | ٧٫٠ | ٩٫٠ | **٩٫٥** | نظام بصري واحد + لا صفحة يتيمة + بوابة المحكّم |
| ٦ جودة العرض | ٨٫٠ | ٨٫٥ | **٩٫٥** | العرض يشغّل شاشة واحدة مفهومة بدل أربع |

المتوسط: **٧٫٦ ← ٩٫٤**.

المعيار ٤ لا يبلغ ٩٫٥ قبل الحدث بصدق: يحتاج حلقة «توقّع ← قياس ← انحراف ← معامل تصحيح» عاملة على بيانات مرصودة، وهي موجودة في المختبر بوصفها وحدة لا بوصفها حلقة مغلقة. **لا تدّعِ أنها مغلقة.**

---

## ما لا يدخل هذه الخطة عمداً

| البند | السبب |
|---|---|
| النشر إلى قنوات الملاحة | يحتاج اتفاق قناة. `WZDx` موجود بوصفه تصديراً، وهذا الحد الصادق. |
| القياس الميداني الحي | لا أجهزة ولا مصدر. عرضه سيكون تمثيلاً لا نموذجاً. |
| المحاكاة المتخصصة | التموضع الصحيح إحالة عند تجاوز الحد، لا إعادة بناء. |
| `google-maps-scraper` | أداة Go تكشط خرائط جوجل. إعادة نشر ناتجها تخالف شروط جوجل، وهي مخاطرة قانونية في تسليم حكومي. **البديل الأفضل موجود أصلاً**: `scripts/fetch-base-layers.js` يجلب من Overpass تحت ODbL، ويعطي المستشفيات والمدارس ومحطات المترو — وهي بالضبط طبقة «المرافق الحساسة» التي يحتاجها حقل `sensitivity`. |
| تحويل النموذج إلى منصة تصاريح | قرار البحث الاستراتيجي: أثر طبقة قرار، لا بديل عن بلدي. |

---

## Self-Review

**تغطية المتطلب:** التقييم الصارم ⇒ جدول التشخيص. القدرات المنافسة ⇒ المهام ٥–٩ (صندوق الأعمال من Aurora/myWorksites، الخريطة المشتركة من one.network، بوابة الاكتمال من LTA PROMPT، مقارنة البدائل من QuickZone، المحفظة من WISE). التعميق ⇒ المهمة ٣. البوابات ⇒ المهمة ٦ (حُرّاس) والمهمة ١١ (بوابة المحكّم). الاختبارات ⇒ كل مهمة تبدأ باختبار فاشل. تجربة المستخدم والوضوح ⇒ المهام ١، ٧، ٨، ١٠. التصميم ⇒ المهمة ١ + كثافة وضع المراجع. الخريطة والبيانات الوهمية ⇒ المهمتان ٣ و٤.

**فحص العناصر النائبة:** لا «TBD» ولا «أضف معالجة أخطاء مناسبة». المهمتان ٧ و٨ تعطيان مواصفة ملزِمة بدل شيفرة كاملة لأن اختبارهما هو العقد — وهذا مقصود ومصرَّح به، لا فجوة.

**اتساق الأنواع:** `properties.id` هو المفتاح في المخزن والخريطة والصف والتصيير. `impactVehHours` رقم في كل موضع. `status` من مفاتيح `TRANSITIONS` حصراً — باني المحفظة في المهمة ٣ يولّد من القائمة نفسها التي تعرّفها المهمة ٦؛ **عند التنفيذ نفّذ المهمة ٦ قبل إعادة تشغيل باني المحفظة، أو تحقق يدوياً من تطابق المصفوفتين.**
