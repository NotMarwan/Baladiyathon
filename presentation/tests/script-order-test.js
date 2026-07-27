'use strict';
/*
 * حارس ترتيب التحميل — التبعية تُحمَّل قبل مستهلِكها.
 * ---------------------------------------------------------------------------
 * كل وحدة في النموذج بنمط UMD: `root.MasarX = factory(root.MasarA, root.MasarB)`.
 * والوسم `<script>` لا يعتذر: إن جاء المستهلِك قبل تبعيته، فالمعامل `undefined`
 * وقت **بناء الوحدة** لا وقت استعمالها. ولهذا الخطأ وجهان، وكلاهما وقع فعلاً:
 *
 *   · **الوجه الصاخب** — `masar-portfolio.js` يستدعي `TrafficLoad.estimate()` في
 *     جسم المصنع نفسه. فغياب `masar-trafficload.js` قبله لا يُفقد رقماً واحداً
 *     بل يرمي قبل أن يُعرَّف `MasarPortfolio`. وهذا ما كان في `masar-pitch.html`
 *     و`masar-city-impact.html`: شريحة الأثر تعرض «—» ولوحة المدينة فارغة
 *     بالكامل — عدّاداتها ورسمها وصفوف حساسيتها.
 *
 *   · **الوجه الصامت وهو الأسوأ** — `masar-sensitivity.js` يكتب
 *     `(Cases && Cases.priorFor(…)) || null`. فالترتيب المقلوب لا يرمي شيئاً:
 *     تختفي الأولويات المسنودة بسجل الحالات ويبقى اللوح يعمل ويبدو سليماً. وكان
 *     هذا حال `masar-desk.html` — المنتج الحاكم — حيث جاء `masar-sensitivity.js`
 *     قبل `masar-comparable-cases.js` بسطرين.
 *
 * ولا يلتقط أيَّهما اختبارُ وحدة: وحدات Node تستورد تبعياتها بـ`require` فتصل
 * دائماً. العطل يعيش في **صفحة HTML** وحدها، ولا يُرى إلا بقراءة ترتيب الوسوم.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

/* من يعرّف كل اسم عالمي: وحدات UMD في `presentation/`، وملفات بيانات في
   `presentation/data/` تسند إلى `window` مباشرة. */
function buildProviderMap() {
  const map = new Map();
  fs.readdirSync(ROOT).filter((n) => n.endsWith('.js')).forEach((file) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const declared = src.match(/root\.([A-Za-z_$][\w$]*)\s*=\s*factory\(/);
    if (declared) map.set(declared[1], file);
  });
  if (fs.existsSync(DATA)) {
    fs.readdirSync(DATA).filter((n) => n.endsWith('.js')).forEach((file) => {
      const src = fs.readFileSync(path.join(DATA, file), 'utf8');
      const re = /window\.([A-Za-z_$][\w$]*)\s*=/g;
      let hit;
      while ((hit = re.exec(src))) map.set(hit[1], 'data/' + file);
    });
  }
  return map;
}

/* ما تطلبه الوحدة: وسائط فرع المتصفّح من نداء المصنع. */
function requiredGlobals(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const call = src.match(/root\.[A-Za-z_$][\w$]*\s*=\s*factory\(([\s\S]*?)\);/);
  if (!call) return [];
  return (call[1].match(/root\.([A-Za-z_$][\w$]*)/g) || []).map((s) => s.slice(5));
}

/* ترتيب وسوم السكربت كما يقرؤها المتصفّح. `defer` لا يغيّر الترتيب — يؤجّل
   التنفيذ كله إلى ما بعد التحليل ثم ينفّذ بترتيب الوثيقة نفسه. */
function scriptsOf(page) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  const out = [];
  let hit;
  while ((hit = re.exec(html))) {
    const src = hit[1];
    if (/^https?:|^\/\//.test(src)) continue;
    out.push(src.replace(/^\.\//, ''));
  }
  return out;
}

const providers = buildProviderMap();
const pages = fs.readdirSync(ROOT).filter((n) => n.endsWith('.html')).sort();

ok('خريطة المعرِّفات مبنية من القرص لا مكتوبة يدوياً', () => {
  assert.ok(providers.size >= 20,
    `عدد الوحدات المعرِّفة ${providers.size} — التحليل لم يقرأ المستودع`);
  assert.strictEqual(providers.get('MasarTrafficLoad'), 'masar-trafficload.js');
  assert.strictEqual(providers.get('MasarPortfolio'), 'masar-portfolio.js');
});

ok('كل صفحة تحمّل تبعيات وحداتها قبلها', () => {
  const breaks = [];
  pages.forEach((page) => {
    const loaded = scriptsOf(page);
    loaded.forEach((script, index) => {
      if (!script.endsWith('.js') || script.indexOf('/') !== -1) return;
      if (!fs.existsSync(path.join(ROOT, script))) return;
      requiredGlobals(script).forEach((dep) => {
        const source = providers.get(dep);
        if (!source) return; // اسم لا تعرّفه أي وحدة — خارج نطاق هذا الحارس
        const base = source.replace(/^data\//, '');
        const earlier = loaded.slice(0, index)
          .some((s) => s.replace(/^data\//, '') === base);
        if (!earlier) breaks.push(`${page}: ${script} ← ${dep} (${source})`);
      });
    });
  });
  assert.deepStrictEqual(breaks, [],
    'تبعية بعد مستهلِكها أو غائبة عن الصفحة:\n  ' + breaks.join('\n  '));
});

ok('صفحتا الأثر تحمّلان مقدّر الحمل قبل المحفظة', () => {
  ['masar-pitch.html', 'masar-city-impact.html'].forEach((page) => {
    const loaded = scriptsOf(page);
    const load = loaded.indexOf('masar-trafficload.js');
    const portfolio = loaded.indexOf('masar-portfolio.js');
    assert.ok(load !== -1, `${page} لا يحمّل masar-trafficload.js`);
    assert.ok(portfolio !== -1, `${page} لا يحمّل masar-portfolio.js`);
    assert.ok(load < portfolio,
      `${page}: المحفظة قبل مقدّر الحمل — MasarPortfolio لن يُعرَّف أصلاً`);
  });
});

ok('لوح الحساسية يجد سجل الحالات فلا تسقط أولوياته صمتاً', () => {
  ['masar-desk.html', 'masar-city-impact.html'].forEach((page) => {
    const loaded = scriptsOf(page);
    const cases = loaded.indexOf('masar-comparable-cases.js');
    const data = loaded.indexOf('data/comparable-cases.js');
    const sensitivity = loaded.indexOf('masar-sensitivity.js');
    if (sensitivity === -1) return;
    assert.ok(data !== -1 && data < cases,
      `${page}: بيانات الحالات غائبة أو بعد وحدتها`);
    assert.ok(cases !== -1 && cases < sensitivity,
      `${page}: سجل الحالات بعد لوح الحساسية — الأولويات المسنودة تصير null بصمت`);
  });
});

console.log(`\n${passed} فحصاً نجح`);
