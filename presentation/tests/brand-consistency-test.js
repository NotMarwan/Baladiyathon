'use strict';
/*
 * حارس اسم المشروع.
 * ---------------------------------------------------------------------------
 * المشروع اسمه **مسار**. كان «أثر» حتى ٢٦ يوليو ٢٠٢٦، وأُعيدت تسمية كل ملفات
 * النموذج `masar-*`. لكن **النصّ** المعروض على الشاشة لم يُعَد تسميته معه:
 * بقيت أربعة مواضع تكتب الاسم الميت — أوّلها شريحة العرض الأولى، وآخرها ذيل
 * خطة إدارة المرور التي **يطبعها المحكّم بنفسه** أثناء الديمو.
 *
 * ونجت أربعتها من ١٢٧٨ فحصاً لأن أحداً لم يكن يفحص الاسم. الحارس الذي يفحص
 * الأرقام ولا يفحص ما فوقها بخطٍّ عريض حارسٌ على نصف الشريحة.
 *
 * وهذا الملف يفحص **الاسم في موضع العَلَم** لا كلمة «أثر» العربية: المشروع
 * كلّه يتكلّم عن «الأثر المروري» و«ساعات الأثر» و«درجة الأثر»، وحظرُ الكلمة
 * يجعل الحارس ضجيجاً يُعطَّل بعد أسبوع. الفصل أدناه بمحدّدات موضعية.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');

/* تجريد base64 قبل أي بحث نصّي.
   عروض التسليم تحمل صوراً مضمَّنة بمئات الكيلوبايتات، وأبجدية base64 تحوي
   `athar` و`ACO` وغيرهما كسلاسل عابرة. البحث الخام عليها يعطي إنذاراً كاذباً
   يُفقد الحارس مصداقيته — والحارس الذي يكذب يُعطَّل. */
function visibleText(source) {
  return source.replace(/data:[a-z/+.-]*;base64,[A-Za-z0-9+/=\s]+/gi, '[B64]');
}

/* النطاق مشتقّ من القرص لا مكتوب يدوياً.
   القائمة اليدوية تشيخ: ملفٌّ جديد يدخل العرض ولا يدخل الحارس، وهذا بالضبط
   ما جعل `اجوبة-الفورم.md` خارج الحراسة حتى كشفه تحكيم بارد. */
function filesIn(dir, pattern) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((name) => pattern.test(name))
    .map((name) => dir + '/' + name)
    .sort();
}

const surfaces = [
  ...filesIn('presentation', /\.(html|js|css)$/),
  ...filesIn('output/submission', /\.html$/),
  ...filesIn('docs/hackathon', /\.md$/),
];

/*
 * محدّدات موضع العَلَم.
 *
 * `أثر ·`  — الاسم متبوعاً بفاصل الترويسة. هذه صيغة التسريب الأربع كلها.
 *            واللقطة الخلفية تمنع `الأثر ·` — وهي عربية سليمة تظهر في
 *            `masar-journey-model.js` ضمن سرد تبويبات، ولا علاقة لها بالاسم.
 * `«أثر»`  — الاسم بين قوسي اقتباس، أي مذكوراً بوصفه اسماً.
 * `Athar`  — اللاتيني. لا استعمال مشروع له إطلاقاً.
 * `athar-` — بادئة ملفات الحقبة الميتة.
 */
const brandPatterns = [
  {
    id: 'أثر ·',
    re: /(?<!\p{L})أثر\s*·/u,
    why: 'الاسم الميت في موضع ترويسة — استبدله بـ«مسار»',
  },
  {
    id: '«أثر»',
    re: /«\s*أثر\s*»/u,
    why: 'الاسم الميت مقتبساً بوصفه اسم المشروع',
  },
  {
    id: 'Athar',
    re: /Athar/,
    why: 'الاسم اللاتيني الميت — المشروع Masar',
  },
  {
    id: 'athar-',
    re: /athar[-_]/i,
    why: 'بادئة ملفات حقبة «أثر» — كل ملفات النموذج `masar-*`',
  },
];

test('كل سطح معروض يحمل اسم «مسار» — ولا موضع علم للاسم الميت', () => {
  const hits = [];
  surfaces.forEach((file) => {
    const text = visibleText(fs.readFileSync(path.join(root, file), 'utf8'));
    brandPatterns.forEach((pattern) => {
      const match = text.match(pattern.re);
      if (!match) return;
      const at = match.index;
      hits.push(`${file} :: ${pattern.id} :: ${pattern.why}\n`
        + `      …${text.slice(Math.max(0, at - 60), at + 60).replace(/\s+/g, ' ')}…`);
    });
  });
  assert.deepStrictEqual(hits, [],
    `الاسم الميت «أثر» ظاهر في ${hits.length} موضع:\n    ` + hits.join('\n    '));
});

test('النطاق يغطي أسطح العرض الثلاثة فعلاً — حارسٌ بلا ملفات حارسٌ على لا شيء', () => {
  const groups = {
    presentation: surfaces.filter((f) => f.startsWith('presentation/')).length,
    submission: surfaces.filter((f) => f.startsWith('output/submission/')).length,
    hackathon: surfaces.filter((f) => f.startsWith('docs/hackathon/')).length,
  };
  assert.ok(groups.presentation >= 40,
    `presentation/ فيه ${groups.presentation} ملفاً فقط — النطاق انهار`);
  assert.ok(groups.submission >= 2,
    `output/submission/ فيه ${groups.submission} ملفاً — مادة التسليم خارج الحراسة`);
  assert.ok(groups.hackathon >= 3,
    `docs/hackathon/ فيه ${groups.hackathon} ملفاً — وثائق اللجنة خارج الحراسة`);
});

/* الحارس نفسه يجب أن يمسك ما وُضع له.
   حارسٌ بتعبيرٍ خاطئ يمرّ صامتاً على كل شيء ويقول «أخضر» — وهو أسوأ من غيابه
   لأنه يُطمئن. فتُحقن هنا الصيغ الأربع الحقيقية التي كانت في المستودع. */
test('التعبيرات تمسك صيغ التسريب الأربع الحقيقية، وتترك العربية السليمة', () => {
  const shouldCatch = [
    '<div class="eyebrow">أثر · قرار واحد قبل تصريح واحد</div>',
    '<div class="kicker">أثر · الملخص التنفيذي</div>',
    'وُلّدت من مكتب المراجع — أثر · ',
    'presentation/athar-portfolio.js',
    'AtharEngine.score(input)',
  ];
  const shouldPass = [
    'قراءة التبويبات: الملخص · الأثر · التعارض · الخطة',
    'الأثر بوحدات القرار: ساعات الأشخاص، والريال، والكربون',
    'درجة الأثر الميداني المثبت صفر',
    'لهذا القرار أثر على الشبكة كلها',
  ];
  shouldCatch.forEach((sample) => {
    assert.ok(brandPatterns.some((p) => p.re.test(sample)),
      `تسريب لم يُمسك: ${sample}`);
  });
  shouldPass.forEach((sample) => {
    const caught = brandPatterns.find((p) => p.re.test(sample));
    assert.ok(!caught,
      `إنذار كاذب على عربية سليمة عبر ${caught && caught.id}: ${sample}`);
  });
});
