'use strict';
/**
 * WP-D1 — بوابة أمن الخادم.
 *
 * السؤال الذي تجيبه: هل الحماية **مفروضة في الخادم**، أم مجرد سلوك واجهة؟
 * الفرق أن الثانية تسقط بطلبٍ من `curl`، والأولى لا.
 *
 * ولذلك كل فحص هنا يتكلم بروتوكول HTTP مباشرة، ولا يمرّ بأي شيفرة واجهة.
 *
 * ما لا تدّعيه هذه البوابة: أن الخادم جاهز للإنتاج. لا مصادقة مستخدمين، ولا
 * تشفير نقل، ولا عزل مستأجرين. تفحص ما نُفِّذ فعلاً لا ما يُتمنّى.
 *
 * التشغيل: node presentation/tests/server-security-test.js
 */

const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const Server = require(path.join(ROOT, 'server.js'));

const KEY = 'gate-key-approver';
const KEYS = { screener: 'gate-key-screener', approver: KEY,
  coordinator: 'gate-key-coordinator', publisher: 'gate-key-publisher' };

let count = 0;
async function test(name, fn) {
  await fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

/* المنفذ العابر: الحارس مشترك، وسبب السقوط العابر مُثبَت في `helpers/free-port.js`
   — منفذٌ محظور في معيار fetch يمنحه نطاق المنافذ العابرة على هذا الجهاز. */
const { listenOnFreePort } = require('./helpers/free-port.js');

async function withServer(options, run) {
  /* سجل في الذاكرة ما لم يطلب الفحص غير ذلك — الثبات مفحوص في حزمته. */
  const server = Server.createServer({ roleKeys: KEYS, ledgerPath: null, ...options });
  const port = await listenOnFreePort(server, 1);
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

const DECISION = {
  version: 2,
  status: 'Approved',
  action: 'approve',
  actor: 'reviewer',
  at: '2026-07-26T02:00:00.000Z',
  inputs: { aadt: 85000, lanes: 4 },
};

(async () => {
  // ---- المفتاح -------------------------------------------------------
  await test('الكتابة بلا مفتاح تُرفض 401 — ولا تُخزَّن', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const denied = await fetch(`${base}/api/works/s001/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(DECISION),
      });
      assert.strictEqual(denied.status, 401, 'الكتابة بلا مفتاح لم تُرفض');

      /* الرفض وحده لا يكفي: لو خُزّن السجل ثم رُدّ 401 لكان الرفض شكلياً. */
      const listed = await (await fetch(`${base}/api/works/s001/decisions`)).json();
      assert.strictEqual(listed.decisions.length, 0,
        'قرار مرفوض وصل إلى السجل — الرفض شكليّ');
    });
  });

  await test('مفتاح خاطئ يُرفض، والصحيح يمرّ', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const wrong = await fetch(`${base}/api/works/s002/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Masar-Key': 'gate-key-d2' },
        body: JSON.stringify(DECISION),
      });
      assert.strictEqual(wrong.status, 401, 'مفتاح خاطئ بالطول نفسه مرّ');

      const right = await fetch(`${base}/api/works/s002/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Masar-Key': KEY },
        body: JSON.stringify(DECISION),
      });
      assert.strictEqual(right.status, 200, 'المفتاح الصحيح لم يمرّ');
    });
  });

  await test('المقارنة بزمن ثابت لا بـ===', () => {
    assert.ok(Server.keyMatches('abcdef', 'abcdef'));
    assert.ok(!Server.keyMatches('abcdef', 'abcdeg'));
    // بادئة مطابقة بطول مختلف: `===` ترفضها كذلك، لكن `startsWith` تقبلها.
    assert.ok(!Server.keyMatches('abcdef', 'abc'));
    assert.ok(!Server.keyMatches('abcdef', ''));
    assert.ok(!Server.keyMatches('abcdef', undefined));
  });


  // ---- الترويسات -----------------------------------------------------
/* القائمة مكتوبة هنا حرفياً، ولا تُقرأ من `BASE_SECURITY_HEADERS`.
 *
 * قرأتها من التنفيذ أولاً، فسقط الفحص في اختباره الخاص: حذف ترويسة من
 * الثابت يحذف فحصَها معه، فتمرّ البوابة على خادمٍ فقد حمايته. اختبارٌ يقرأ
 * توقّعه من المُختبَر يفحص الاتساق لا الصحة.
 *
 * القيم مكرّرة عمداً. التكرار هنا هو الفحص. */
const REQUIRED_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};

  await test('كل استجابة تحمل الترويسات الأمنية — صفحةً وواجهةً وخطأً', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const targets = ['/masar-home.html', '/api/decisions', '/لا-يوجد'];
      for (const target of targets) {
        const response = await fetch(base + target);
        Object.keys(REQUIRED_HEADERS).forEach((header) => {
          assert.strictEqual(
            response.headers.get(header),
            REQUIRED_HEADERS[header],
            `${target}: ترويسة ${header} مفقودة أو مختلفة`
          );
        });
      }
    });
  });

  await test('لا ادعاء نقلٍ مشفَّر على خادم http', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const response = await fetch(`${base}/masar-home.html`);
      assert.strictEqual(response.headers.get('strict-transport-security'), null,
        'HSTS على http — ادعاء تشفير لا وجود له');
    });
  });

  await test('CSP على الصفحات: لا unsafe-inline ولا مضيف خارجي', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const response = await fetch(`${base}/masar-home.html`);
      const csp = response.headers.get('content-security-policy') || '';
      assert.ok(csp, 'الصفحة بلا سياسة أمن محتوى');

      /* WP-G2 — الفحص صار موجَّهاً بالتوجيه لا بالنصّ كلّه.
         كان يرفض `'unsafe-inline'` أينما ورد. صحيح بوصفه قاعدة عامة، وخاطئ
         هنا: `style-src-attr` يحتاجها لأن الـ`nonce` لا يسري على سمات
         `style=""` بنصّ المواصفة — وحجبُها كسر ثلاثاً وثلاثين سمة بصمت.
         فالمرفوض هو ما ينفّذ شيفرة: `script-src`، وكتل `<style>`. */
      const directive = (name) => (csp.split(';')
        .map((part) => part.trim())
        .find((part) => part.split(/\s+/)[0] === name) || '');
      assert.ok(directive('script-src').indexOf("'unsafe-inline'") === -1,
        `unsafe-inline في script-src: ${csp}`);
      assert.ok(directive('style-src').indexOf("'unsafe-inline'") === -1,
        `unsafe-inline في style-src: ${csp}`);
      assert.ok(directive('default-src').indexOf("'unsafe-inline'") === -1,
        'unsafe-inline في default-src');
      assert.ok(directive('style-src-attr') === "style-src-attr 'unsafe-inline'",
        `style-src-attr غير معلن صراحةً — سمات النمط ستُحجب بصمت: ${csp}`);
      assert.ok(csp.indexOf("'unsafe-eval'") === -1, 'unsafe-eval في CSP');
      assert.ok(/script-src [^;]*'nonce-/.test(csp), 'CSP بلا nonce للنصوص');
      assert.ok(/default-src 'self'/.test(csp), 'CSP بلا default-src self');
      assert.ok(/frame-ancestors 'none'/.test(csp), 'CSP بلا منع التأطير');
      assert.ok(!/https?:\/\//.test(csp), `CSP يسمح بمضيف خارجي: ${csp}`);
    });
  });

  await test('كل صفحة تُقدَّم: لا نصّ مضمَّن بلا nonce', async () => {
    /* الفحص على **كل** الصفحات لا على واحدة: صفحة واحدة تفلت من الحقن تعمل
       عند المطوّر (لأنه يفتحها بلا خادم) وتنكسر عند المحكّم. وسبع صفحات
       تحمل نصوصاً مضمَّنة اليوم. */
    const fs = require('node:fs');
    const pages = fs.readdirSync(ROOT).filter((name) => /\.html$/.test(name));
    assert.ok(pages.length >= 8, `${pages.length} صفحة فقط — الجرد ناقص`);

    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const seen = new Set();
      for (const page of pages) {
        const response = await fetch(`${base}/${page}`);
        assert.strictEqual(response.status, 200, `${page}: ${response.status}`);
        const html = await response.text();
        const csp = response.headers.get('content-security-policy') || '';
        const match = csp.match(/'nonce-([^']+)'/);
        assert.ok(match, `${page}: بلا nonce في السياسة`);
        const nonce = match[1];
        seen.add(nonce);

        (html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []).forEach((tag) => {
          assert.ok(tag.indexOf(nonce) !== -1,
            `${page}: نصّ مضمَّن بلا nonce — ${tag.slice(0, 60)}`);
        });
        (html.match(/<style[^>]*>/g) || []).forEach((tag) => {
          assert.ok(tag.indexOf(nonce) !== -1,
            `${page}: نمط مضمَّن بلا nonce — ${tag.slice(0, 60)}`);
        });
      }
      assert.strictEqual(seen.size, pages.length,
        'الـnonce تكرّر بين الطلبات — يفقد غرضه');
    });
  });

  await test('حقن الـnonce يشمل الوسوم ذات src ولا يلتقط وسماً مشابهاً', () => {
    /* WP-G2 — انقلب هذا الفحص عن قصد.
       كان يشترط ألّا يتلقّى وسمُ `src` الـ`nonce` «بلا داعٍ». والداعي ظهر:
       `masar-nav.js` ينشئ `<style>` وقت التشغيل، فتحجبه `style-src-elem`
       ما لم يحمل الـ`nonce` — ولا يقرؤه السكربت إلا من وسمه هو. */
    const out = Server.injectNonce(
      '<script src="a.js"></script><script>x</script><style>b</style>'
      + '<scripting>c</scripting>', 'N');
    assert.ok(out.indexOf('<script nonce="N" src="a.js"') !== -1,
      'وسم بـsrc بلا nonce — لا يستطيع حقن نمط وقت التشغيل');
    assert.ok(out.indexOf('<script nonce="N">x') !== -1, 'النصّ المضمَّن بلا nonce');
    assert.ok(out.indexOf('<style nonce="N">b') !== -1, 'النمط بلا nonce');
    assert.ok(out.indexOf('<scripting>') !== -1, 'الاستبدال التقط وسماً مشابهاً');
  });

  await test('شريط التنقل يمرّر nonce وسمه إلى النمط الذي ينشئه', () => {
    /* الحارس الدائم ضد العودة: بلا هذا السطر يبقى الشريط بلا أنماط في كل
       صفحة، ولا يظهر ذلك في اختبار وحدة ولا في لقطة شاشة عابرة. */
    const fs = require('node:fs');
    const nav = fs.readFileSync(path.join(ROOT, 'masar-nav.js'), 'utf8');
    assert.ok(/document\.currentScript[\s\S]{0,40}nonce/.test(nav),
      'masar-nav.js لا يقرأ nonce وسمه');
    assert.ok(/style\.setAttribute\('nonce'/.test(nav),
      'النمط المحقون بلا nonce — سيُحجب بصمت');
  });

  // ---- حدّ المعدّل ---------------------------------------------------
  await test('حدّ المعدّل يردّ 429 مع Retry-After، ولا يمسّ الملفات', async () => {
    await withServer({ rateLimit: { capacity: 3, refillPerSecond: 0 } }, async (base) => {
      const codes = [];
      for (let i = 0; i < 5; i += 1) {
        codes.push((await fetch(`${base}/api/decisions`)).status);
      }
      assert.deepStrictEqual(codes, [200, 200, 200, 429, 429], `التتابع: ${codes}`);

      const limited = await fetch(`${base}/api/decisions`);
      assert.ok(Number(limited.headers.get('retry-after')) >= 1, 'بلا Retry-After');

      /* الحدّ على الواجهة لا على الصفحات: محكّم يفتح ثماني صفحات في ثوانٍ
         يجب ألّا يُحجب. */
      const page = await fetch(`${base}/masar-home.html`);
      assert.strictEqual(page.status, 200, 'حدّ المعدّل حجب صفحة ساكنة');
    });
  });

  await test('دلاء الحدّ لا تنمو بلا سقف — عنوان مزوَّر لكل طلب', () => {
    const take = Server.createRateLimiter({ capacity: 1, maxBuckets: 8 });
    for (let i = 0; i < 500; i += 1) take(`10.0.0.${i}`);
    // لا مدخل للخريطة من الخارج؛ الدليل أن أقدم عنوان أُزيح فعاد له رصيد.
    const revived = take('10.0.0.0');
    assert.ok(revived.allowed, 'الدلو القديم لم يُزَح — الخريطة تنمو بلا سقف');
  });

  // ---- ما لا يُقدَّم -------------------------------------------------
  await test('شيفرة الخادم وحزم الاختبار وسكربتات البناء لا تُقدَّم', () => {
    /* الاكتشاف الذي أوجب هذا: `GET /submission/../server.js` عاد `200`.
       `new URL()` تطبّع `..` قبل أي فحص، فيقع المسار على جذر الصفحات —
       وحارس الاجتياز سليم لأن الملف فعلاً داخله. العيب أن الجذر يحوي ما
       ليس صفحة.
       القائمة مكتوبة هنا حرفياً لا تُقرأ من التنفيذ: قائمةٌ تُقرأ من
       المُختبَر تُفرَّغ بحذف سطر منه فتمرّ البوابة. */
    ['server.js', 'tests/engine-test.js', 'tests/', 'scripts/build-city-portfolio.js']
      .forEach((relative) => {
        assert.ok(Server.isPrivatePath('/' + relative),
          `${relative} يُقدَّم — سطح بلا سبب`);
      });
    ['masar-home.html', 'masar-engine.js', 'data/city-portfolio.geojson.js',
      'vendor/anything.js'].forEach((relative) => {
      assert.ok(!Server.isPrivatePath('/' + relative),
        `${relative} حُجب وهو أصل صفحة`);
    });
  });

  await test('الحجب مفروض على السلك لا في دالة وحدها', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      for (const target of ['/server.js', '/tests/engine-test.js',
        '/scripts/build-city-portfolio.js']) {
        const response = await fetch(base + target);
        assert.strictEqual(response.status, 403, `${target} عاد ${response.status}`);
      }
      assert.strictEqual((await fetch(`${base}/masar-engine.js`)).status, 200,
        'المحرك محجوب — الحجب أوسع من هدفه');
    });
  });

  await test('تركيب مادة التسليم يحرس جذره وحده', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const deck = await fetch(
        `${base}${Server.SUBMISSION_MOUNT}/masar-baladiyathon-judging-deck.html`);
      assert.strictEqual(deck.status, 200, 'العرض لا يُقدَّم');

      /* الحارس مُعامَل لا موسَّع: الخروج من جذر التسليم مرفوض حتى لو وقع
         داخل جذر الصفحات. */
      assert.strictEqual(
        Server.resolveWithin(Server.SUBMISSION_DIR, '/../../presentation/server.js'),
        null, 'الخروج من جذر التسليم مسموح');
      assert.strictEqual(
        Server.resolveWithin(Server.SUBMISSION_DIR, '/masar-logo.png') === null,
        false, 'ملف داخل جذر التسليم مرفوض');

      const escaped = await fetch(
        `${base}${Server.SUBMISSION_MOUNT}/..%2F..%2Fpresentation%2Fserver.js`);
      assert.strictEqual(escaped.status, 403, `اجتياز مُرمَّز عاد ${escaped.status}`);
    });
  });

  // ---- عقد التصريح منفَذاً: أول خطوة تشغيلية للجهة --------------------
  await test('عقد التصريح يُفحص عبر HTTP — لا يحتاج كاتب Node', async () => {
    /* **ما يقيسه هذا الفحص ليس أمناً بل جدوى.**

       العقد يعرف أي حقل يمنع التشغيل وأيّه يخفض الثقة. وهذا أنفع جوابٍ
       يملكه المشروع لجهةٍ تسأل «ما الذي أرسله لكم؟». وكان محجوباً خلف
       وحدة UMD: من أراده كتب Node. فأعملُ خطوة تشغيلية في المشروع لم تكن
       تصل إلى من يحتاجها.

       والفحص هنا يمرّ بالسلك لا بالوحدة — استدعاء `Contract.validate`
       مباشرةً يمرّ على منفذٍ غير موصول. */
    const fs = require('node:fs');
    const sample = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'data', 'permit-contract-sample.json'), 'utf8'));
    const full = sample.records.find((item) => item.case.indexOf('سجل كامل') === 0).record;

    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const post = (body) => fetch(`${base}/api/permit-contract/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // سجل كامل يمرّ
      const okResponse = await post(full);
      assert.strictEqual(okResponse.status, 200, `عاد ${okResponse.status}`);
      const okBody = await okResponse.json();
      assert.strictEqual(okBody.summary.ready, 1, 'سجل كامل عُدّ محجوباً');
      assert.strictEqual(okBody.summary.blocked, 0);
      assert.ok(okBody.contractVersion, 'الردّ بلا نسخة عقد — لا يُنسب إلى مواصفة');

      // سجل ينقصه حقل مانع: الردّ يسمّي الحقل لا «غير صالح» فقط
      const broken = { ...full };
      delete broken.lanesClosed;
      const batch = await post({ records: [full, broken] });
      const batchBody = await batch.json();
      assert.strictEqual(batchBody.summary.records, 2);
      assert.strictEqual(batchBody.summary.ready, 1, 'الدفعة لا تفرّق بين السجلّين');
      assert.strictEqual(batchBody.summary.blocked, 1);
      assert.strictEqual(batchBody.summary.blockingFields.lanesClosed, 1,
        'الملخّص لا يسمّي الحقل المتكرر — تُصلَح السجلات بدل المصدر');
      const blockedResult = batchBody.results.find((r) => !r.ok);
      assert.ok(blockedResult.blocking.some((p) => p.key === 'lanesClosed'),
        'الردّ لا يسمّي الحقل المانع');
      assert.strictEqual(blockedResult.permitRef, full.permitRef,
        'النتيجة لا تُنسب إلى رقم تصريح — لا تُردّ إلى صاحبها');

      /* الحدّ يُقال مع النتيجة: العقد يصف حاجة المحرك لا أسماء منصة الجهة. */
      assert.ok(/لا تكامل منفَّذ/.test(batchBody.limits),
        'الردّ لا يعلن أنه ليس تكاملاً — يُقرأ مطابقةً محقَّقة');
    });
  });

  await test('مواصفة العقد تُقرأ عبر HTTP بدرجات الحاجة الثلاث', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const body = await (await fetch(`${base}/api/permit-contract`)).json();
      assert.ok(Array.isArray(body.fields) && body.fields.length >= 5,
        'المواصفة بلا حقول');
      const needs = new Set(body.fields.map((f) => f.need));
      assert.ok(needs.has('blocking') && needs.has('degrading'),
        'المواصفة بلا تمييز بين المانع والمخفِّض — ثنائيةٌ تُرفض بها ملفات كاملة');
      body.fields.forEach((field) => {
        assert.ok(field.expects, `${field.key}: بلا وصف للمتوقَّع`);
        assert.ok(field.derivedFrom, `${field.key}: بلا مصدر تسمية`);
      });
      assert.ok(body.needLegend.blocking, 'الدرجات بلا شرح');
    });
  });

  await test('فحص العقد محدود العدد ومحميّ بحدّ المعدّل كبقية الواجهة', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const many = { records: new Array(Server.MAX_CONTRACT_RECORDS + 1).fill({}) };
      const response = await fetch(`${base}/api/permit-contract/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(many),
      });
      assert.strictEqual(response.status, 422, `عاد ${response.status}`);
      assert.ok((await response.json()).fields.records, 'الرفض لا يسمّي الحقل');
    });

    /* الحدّ يشمل المنفذ الجديد لأنه تحت `/api/` — لا استثناء صامت. */
    await withServer({ rateLimit: { capacity: 2, refillPerSecond: 0 } }, async (base) => {
      const codes = [];
      for (let i = 0; i < 3; i += 1) {
        codes.push((await fetch(`${base}/api/permit-contract`)).status);
      }
      assert.deepStrictEqual(codes, [200, 200, 429], `التتابع: ${codes}`);
    });
  });

  // ---- أرقام «اليوم الأول» محسوبة لا مكتوبة ---------------------------
  await test('كل رقم في مسار اليوم الأول يطابق ما يُحسب وقت التشغيل', async () => {
    /* **القاعدة التي يفرضها هذا الفحص: لا رقم مخترَع.**

       وثيقة `SHADOW-PILOT.md` تعلن جرد حقول العقد ورسمَ وحدات الخادم. وكلاهما
       يتغيّر بتعديل شيفرة، فيصير الرقم المكتوب ادعاءً قديماً بلا تبليغ.
       فالفحص يُعيد الحساب من المصدر ويشترط أن الوثيقة تقول ما حُسب. */
    const fs = require('node:fs');
    const doc = fs.readFileSync(
      path.join(ROOT, '..', 'docs', 'engineering', 'SHADOW-PILOT.md'), 'utf8');

    const Contract = require(path.join(ROOT, 'masar-permit-contract.js'));
    const census = { blocking: 0, degrading: 0, optional: 0 };
    Contract.FIELDS.forEach((field) => { census[field.need] += 1; });
    const ours = Contract.FIELDS.filter((f) => f.derivedFrom === 'ours').length;

    const WORD = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة',
      'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر'];

    /* الجرد الكلي ودرجاته الثلاث — كلٌّ بلفظه في الوثيقة. */
    assert.ok(doc.indexOf(`${WORD[Contract.FIELDS.length]} حقلاً`) !== -1,
      `الوثيقة لا تقول «${WORD[Contract.FIELDS.length]} حقلاً» — الجرد ${Contract.FIELDS.length}`);
    assert.ok(doc.indexOf(`${WORD[census.blocking]} مانعة`) !== -1,
      `المانعة ${census.blocking} والوثيقة تقول غير ذلك`);
    assert.ok(doc.indexOf(`${WORD[census.degrading]} مخفِّضة`) !== -1,
      `المخفِّضة ${census.degrading} والوثيقة تقول غير ذلك`);
    assert.ok(doc.indexOf(`${WORD[census.optional]} اختياريان`) !== -1,
      `الاختيارية ${census.optional} والوثيقة تقول غير ذلك`);
    assert.ok(doc.indexOf(`${WORD[Contract.FIELDS.length - ours]} منها أسماؤها`) !== -1,
      `المشتقّة من خدمات منشورة ${Contract.FIELDS.length - ours}`);
    assert.ok(doc.indexOf(`${WORD[ours]} من عندنا`) !== -1,
      `«من عندنا» ${ours} والوثيقة تقول غير ذلك`);

    /* ادعاء «بلا npm install»: يُقاس بتحميل الخادم وعدّ ما جاء من
       `node_modules`. ادعاءُ نشرٍ بلا قياس هو أول ما يسقط عند التركيب. */
    const external = Object.keys(require.cache)
      .filter((file) => file.indexOf('node_modules') !== -1);
    assert.strictEqual(external.length, 0,
      `الخادم يحمّل ${external.length} وحدة من node_modules — ادعاء «بلا تثبيت» ساقط`);
    assert.ok(doc.indexOf('لا شيء منها من') !== -1
      && doc.indexOf('`node_modules`') !== -1,
    'الوثيقة لا تعلن ادعاء انعدام التبعيات الذي يقيسه هذا الفحص');

    /* الأمران المكتوبان في الوثيقة يجب أن يقعا على مسارين موصولين فعلاً. */
    const routes = (doc.match(/\/api\/permit-contract[a-z/-]*/g) || []);
    assert.ok(routes.length >= 2, 'الوثيقة بلا أمري العقد');
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      for (const route of new Set(routes)) {
        const method = route.endsWith('/validate') ? 'POST' : 'GET';
        const response = await fetch(base + route, method === 'POST'
          ? { method, headers: { 'Content-Type': 'application/json' }, body: '{}' }
          : {});
        assert.notStrictEqual(response.status, 404,
          `الوثيقة توثّق ${method} ${route} وهو غير موصول — أمرٌ يسقط عند الجهة`);
      }
    });
  });

  // ---- بقاء العملية تحت مسار مشوَّه ----------------------------------
  await test('مسارٌ مشوَّه يُردّ 400 ولا يُسقط العملية', async () => {
    /* **الاكتشاف الذي أوجب هذا الفحص.**
       نموذج التهديد المعلَن في `server.js` يسمّي الخطر الثالث: «طلب واحد
       يعلّق العملية». وقد عولج منه فرعٌ واحد — حلقة `score` بمدّة هائلة —
       وبقي فرعان أرخص منه يقتلان العملية كلها لا يعلّقانها:

         GET /%c0%af          →  URIError: URI malformed   (decodeURIComponent)
         GET /a.html%00.txt   →  TypeError ERR_INVALID_ARG_VALUE  (fs.stat)

       كلاهما رميٌ متزامن داخل معالج الطلب، فيخرج استثناءً غير ملتقَط وتموت
       العملية. لا مفتاح مطلوب ولا جسم ولا تكرار: طلب `GET` واحد.

       وأثره على الجدوى أكبر من أثره الأمني: محكّمٌ يخطئ حرفاً في شريط
       العنوان يُطفئ العرض، ولا يعود إلا بمن يشغّل الخادم من الطرفية.

       ولذلك يفحص هذا الاختبار **البقاء** لا رمز الحالة وحده: طلبٌ سليم
       بعد كل مسار مشوَّه. رمز `400` وحده يمرّ على خادم مات بعده. */
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const malformed = [
        '/%c0%af%c0%afpackage.json',   // ترميز مئوي غير صالح
        '/abc%zz',                     // بادئة % بلا رقمين ست عشريين
        '/%',                          // % وحدها في آخر المسار
        '/masar-home.html%00.txt',     // محرف صفري بعد امتداد سليم
        '/%00',                        // محرف صفري وحده
        `${Server.SUBMISSION_MOUNT}/%c0%af`,  // التركيب الآخر: حارسه مستقل
        `${Server.SUBMISSION_MOUNT}/x%00.png`,
      ];
      for (const target of malformed) {
        const response = await fetch(base + target);
        assert.ok(response.status === 400 || response.status === 403
          || response.status === 404,
        `${target}: عاد ${response.status} — يُنتظر رفضٌ لا تقديم`);

        /* **الشرط الحاكم**: الخادم ما يزال يردّ. */
        const alive = await fetch(`${base}/masar-home.html`);
        assert.strictEqual(alive.status, 200,
          `العملية ماتت بعد ${target} — طلبٌ واحد أطفأ الخادم`);
      }
    });
  });

  await test('حارس الجذر يرفض المحرف الصفري قبل أن يبلغ نظام الملفات', () => {
    /* `fs.stat` يرمي على محرف صفري بدل أن يعيد خطأً في نداء رجعي، فالرمي
       متزامن ولا يلتقطه معالج الملف. الحارس يوقفه قبل ذلك. */
    assert.strictEqual(Server.resolveWithin(Server.SUBMISSION_DIR, '/a\x00.png'),
      null, 'محرف صفري عبر الحارس — سيرمي في fs.stat');
    assert.strictEqual(Server.resolveWithin(Server.SUBMISSION_DIR, '/\x00'),
      null, 'محرف صفري وحده عبر الحارس');
    assert.ok(Server.resolveWithin(Server.SUBMISSION_DIR, '/masar-logo.png'),
      'الحارس رفض ملفاً سليماً — أوسع من هدفه');
  });

  await test('أي رمي متزامن في التوجيه يصير 500 لا موتاً', async () => {
    /* الحارسان أعلاه يعالجان ناقلَين معروفين. هذا يعالج **الصنف**: معالج
       الطلب كلّه داخل `try`، فرميٌ لم يُتوقَّع بعدُ يخرج استجابةً لا جنازة.
       يُحقن الرمي عبر مُحدِّد معدّل يرمي — وهو أقرب نقطة حقن حقيقية. */
    const exploding = () => { throw new Error('رمي مزروع في التوجيه'); };
    await withServer({ rateLimiter: exploding }, async (base) => {
      const response = await fetch(`${base}/api/decisions`);
      assert.strictEqual(response.status, 500, `عاد ${response.status}`);
      const alive = await fetch(`${base}/masar-home.html`);
      assert.strictEqual(alive.status, 200, 'العملية ماتت برميٍ في التوجيه');
    });
  });

  // ---- مفتاح الجلسة --------------------------------------------------
  await test('مفتاح الجلسة يُسلَّم للحلقة المحلية ويعلن حدّه', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const body = await (await fetch(`${base}/api/session-key`)).json();
      /* WP-D3 — لا يُسلَّم إلا مفتاح الفاحص. تسليم مفتاح المعتمِد عبر HTTP
         يجعل الفصل زينة: من يفتح أدوات المطوّر يأخذه في ثانية. */
      assert.strictEqual(body.key, KEYS.screener, 'المُسلَّم ليس مفتاح الفاحص');
      assert.strictEqual(body.role, 'screener');
      const served = JSON.stringify(body);
      ['approver', 'coordinator', 'publisher'].forEach((role) => {
        assert.ok(served.indexOf(KEYS[role]) === -1,
          `مفتاح ${role} سُلّم عبر HTTP`);
      });
      assert.ok(/لا يعتمد/.test(body.limits),
        'نقطة المفتاح لا تعلن أنها لا تعتمد');
    });
  });

  // ---- WP-D3 · فصل الصلاحيات -----------------------------------------

  /** يبني قراراً بحالة هدف ومنفِّذ. */
  const decision = (status, actor, version) => ({
    version: version || 2,
    status: status,
    action: 'act',
    actor: actor,
    at: '2026-07-26T04:00:00.000Z',
    inputs: { aadt: 85000, lanes: 4 },
  });

  const write = (base, work, body, key) => fetch(
    `${base}/api/works/${work}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Masar-Key': key },
      body: JSON.stringify(body),
    });

  const ledger = async (base, work) => (
    await (await fetch(`${base}/api/works/${work}/decisions`)).json()).decisions;

  await test('الفاحص لا يعتمد — 403 ولا يصل السجل', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const denied = await write(base, 'd001', decision('Approved', 'فاحص'),
        KEYS.screener);
      assert.strictEqual(denied.status, 403, `عاد ${denied.status}`);
      const body = await denied.json();
      assert.strictEqual(body.error, 'ROLE_NOT_PERMITTED');
      assert.strictEqual(body.role, 'screener');
      /* الرفض يسمّي ما يجيزه الدور، وإلا صار لغزاً يُقرأ عطلاً في النظام. */
      assert.ok(Array.isArray(body.allowed) && body.allowed.length,
        'الرفض لا يسمّي ما يجيزه الدور');
      assert.ok(body.allowed.indexOf('Approved') === -1);

      assert.strictEqual((await ledger(base, 'd001')).length, 0,
        'قرار مرفوض وصل السجل — الرفض شكليّ');
    });
  });

  await test('المعتمِد يعتمد، والفاحص يفحص — كلٌّ في نطاقه', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      assert.strictEqual(
        (await write(base, 'd002', decision('ImpactScreening', 'فاحص'),
          KEYS.screener)).status, 200, 'الفاحص لا يفحص');
      assert.strictEqual(
        (await write(base, 'd002', decision('Approved', 'معتمِد', 3),
          KEYS.approver)).status, 200, 'المعتمِد لا يعتمد');
      assert.strictEqual(
        (await write(base, 'd002', decision('ImpactScreening', 'معتمِد', 4),
          KEYS.approver)).status, 403, 'المعتمِد يفحص');
    });
  });

  await test('من فحص لا يعتمد — ولو كان مفتاحه مفتاح المعتمِد', async () => {
    /* **القاعدة المركزية.** الشرط ليس «دور مختلف» بل **شخص مختلف**: من فحص
       صار طرفاً في التحليل الذي يحكم عليه. */
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      await write(base, 'd003', decision('ImpactScreening', 'سعد'), KEYS.screener);

      const same = await write(base, 'd003', decision('Approved', 'سعد', 3),
        KEYS.approver);
      assert.strictEqual(same.status, 403, `الفاحص نفسه اعتمد — ${same.status}`);
      assert.strictEqual((await same.json()).error, 'SEGREGATION_OF_DUTIES');

      const other = await write(base, 'd003', decision('Approved', 'ليان', 3),
        KEYS.approver);
      assert.strictEqual(other.status, 200, 'معتمِدٌ آخر مُنع بلا سبب');

      const stored = await ledger(base, 'd003');
      assert.strictEqual(stored.filter((r) => r.status === 'Approved').length, 1,
        'اعتمادان مخزَّنان');
    });
  });

  await test('الدور المرسَل في الجسم لا يُصدَّق — يُستبدل بالمشتقّ من المفتاح', async () => {
    /* تغيير الدور من أدوات المطوّر لا يتجاوز فحص الخادم: الدور لا يُقرأ من
       الجسم إطلاقاً. */
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const forged = { ...decision('Approved', 'متسلل'), role: 'approver' };
      const denied = await write(base, 'd004', forged, KEYS.screener);
      assert.strictEqual(denied.status, 403, 'دورٌ مزوَّر في الجسم مرّ');
      assert.strictEqual((await ledger(base, 'd004')).length, 0);

      const honest = { ...decision('ImpactScreening', 'فاحص'), role: 'approver' };
      const accepted = await write(base, 'd004', honest, KEYS.screener);
      assert.strictEqual(accepted.status, 200);
      const stored = (await ledger(base, 'd004'))[0];
      assert.strictEqual(stored.role, 'screener',
        `الدور المخزَّن ${stored.role} — الجسم غلب المفتاح`);
      assert.strictEqual(stored.roleLabel, Server.ROLES.screener.label);
    });
  });

  await test('كل قرار مخزَّن يحمل الدور الذي أجازه', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      await write(base, 'd005', decision('ImpactScreening', 'أ'), KEYS.screener);
      await write(base, 'd005', decision('Approved', 'ب', 3), KEYS.approver);
      await write(base, 'd005', decision('Scheduled', 'ج', 4), KEYS.publisher);
      const stored = await ledger(base, 'd005');
      assert.deepStrictEqual(stored.map((r) => r.role),
        ['screener', 'approver', 'publisher']);
      stored.forEach((record) => {
        assert.ok(record.roleLabel, `${record.version}: بلا اسم دور مقروء`);
      });
    });
  });

  await test('لا دور يجمع الفحص والاعتماد', () => {
    /* حارس ضدّ توسعةٍ تُفرِغ القاعدة: دورٌ يملك الحالتين يجعل الفصل نصّاً.
       القائمة مكتوبة هنا حرفياً لا تُقرأ من `ROLES`. */
    Object.keys(Server.ROLES).forEach((role) => {
      const statuses = Server.ROLES[role].statuses;
      const screens = statuses.indexOf('ImpactScreening') !== -1;
      const binds = statuses.indexOf('Approved') !== -1
        || statuses.indexOf('Rejected') !== -1;
      assert.ok(!(screens && binds),
        `الدور «${role}» يفحص ويعتمد — الفصل نصّ لا قاعدة`);
    });
  });

  await test('مفتاح كل دور مستقل ومولَّد', () => {
    ['SCREENER', 'APPROVER', 'COORDINATOR', 'PUBLISHER']
      .forEach((role) => { delete process.env[`MASAR_KEY_${role}`]; });
    const first = Server.resolveRoleKeys();
    const second = Server.resolveRoleKeys();
    const values = Object.values(first.keys);
    assert.strictEqual(new Set(values).size, values.length,
      'دوران يتقاسمان مفتاحاً — الفصل لا يُميّزهما');
    values.forEach((key) => assert.ok(key.length >= 32, `مفتاح قصير: ${key}`));
    assert.notDeepStrictEqual(first.keys, second.keys, 'المفاتيح متوقَّعة');
    assert.strictEqual(Server.roleForKey(first.keys, second.keys.approver), null,
      'مفتاح جلسة أخرى قُبل');
  });

  // ---- حدود المدخلات -------------------------------------------------
  await test('الحدود العليا مفروضة — لا حلقة بمليار ساعة', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const cases = [
        { field: 'durationHours', value: 1e9 },
        { field: 'aadt', value: 9e9 },
        { field: 'lanes', value: 400 },
        { field: 'capacityPerLane', value: 999999 },
        { field: 'freeFlowMin', value: 100000 },
      ];
      for (const item of cases) {
        const input = {
          aadt: 85000, lanes: 4, lanesClosed: 1, startHour: 22, durationHours: 10,
        };
        input[item.field] = item.value;
        const response = await fetch(`${base}/api/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        assert.strictEqual(response.status, 422,
          `${item.field}=${item.value} لم يُرفض`);
        const body = await response.json();
        assert.ok(body.fields && body.fields[item.field],
          `${item.field}: الرفض لا يسمّي الحقل`);
      }
    });
  });

  await test('الحدّ الأعلى للمدة يمنع تعليق العملية فعلاً — لا بالإعلان', async () => {
    /* الدليل زمنيّ: الطلب المرفوض يعود فوراً. لو مرّ إلى المحرك لدارت حلقة
       `score` مليار مرة. العتبة واسعة عمداً كي لا تصير البوابة عشوائية. */
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const startedAt = process.hrtime.bigint();
      const response = await fetch(`${base}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aadt: 85000, lanes: 4, lanesClosed: 1, startHour: 22, durationHours: 5e8,
        }),
      });
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      assert.strictEqual(response.status, 422);
      assert.ok(elapsedMs < 2000, `الرفض استغرق ${elapsedMs.toFixed(0)}ms`);
    });
  });

  await test('المحرك يرفض المدة المفرطة كذلك — لا حماية بطبقة واحدة', () => {
    const Engine = require(path.join(ROOT, 'masar-engine.js'));
    assert.throws(() => Engine.score({
      aadt: 85000, lanes: 4, lanesClosed: 1, freeFlowMin: 6,
      startHour: 8, durationHours: 1e9,
    }), /durationHours/, 'المحرك يقبل مدة تعلّق العملية إن نودي مباشرة');
  });

  console.log(`ALL TESTS PASSED (${count})`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
