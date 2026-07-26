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

async function listenOnFreePort(server, attempt) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address && address.port) return address.port;
  await new Promise((resolve) => server.close(resolve));
  if (attempt >= 5) throw new Error('تعذّر الحصول على منفذ عابر');
  await new Promise((resolve) => setTimeout(resolve, attempt * 25));
  return listenOnFreePort(server, attempt + 1);
}

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
        headers: { 'Content-Type': 'application/json', 'X-Athar-Key': 'gate-key-d2' },
        body: JSON.stringify(DECISION),
      });
      assert.strictEqual(wrong.status, 401, 'مفتاح خاطئ بالطول نفسه مرّ');

      const right = await fetch(`${base}/api/works/s002/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Athar-Key': KEY },
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
      const targets = ['/athar-home.html', '/api/decisions', '/لا-يوجد'];
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
      const response = await fetch(`${base}/athar-home.html`);
      assert.strictEqual(response.headers.get('strict-transport-security'), null,
        'HSTS على http — ادعاء تشفير لا وجود له');
    });
  });

  await test('CSP على الصفحات: لا unsafe-inline ولا مضيف خارجي', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const response = await fetch(`${base}/athar-home.html`);
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
       `athar-nav.js` ينشئ `<style>` وقت التشغيل، فتحجبه `style-src-elem`
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
    const nav = fs.readFileSync(path.join(ROOT, 'athar-nav.js'), 'utf8');
    assert.ok(/document\.currentScript[\s\S]{0,40}nonce/.test(nav),
      'athar-nav.js لا يقرأ nonce وسمه');
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
      const page = await fetch(`${base}/athar-home.html`);
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
    ['athar-home.html', 'athar-engine.js', 'data/city-portfolio.geojson.js',
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
      assert.strictEqual((await fetch(`${base}/athar-engine.js`)).status, 200,
        'المحرك محجوب — الحجب أوسع من هدفه');
    });
  });

  await test('تركيب مادة التسليم يحرس جذره وحده', async () => {
    await withServer({ rateLimit: { capacity: 10000 } }, async (base) => {
      const deck = await fetch(
        `${base}${Server.SUBMISSION_MOUNT}/athar-baladiyathon-judging-deck.html`);
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
      headers: { 'Content-Type': 'application/json', 'X-Athar-Key': key },
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
      .forEach((role) => { delete process.env[`ATHAR_KEY_${role}`]; });
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
    const Engine = require(path.join(ROOT, 'athar-engine.js'));
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
