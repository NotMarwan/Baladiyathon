'use strict';

const assert = require('node:assert');
const { createServer, validateScoreInput } = require('../server.js');

let passed = 0;
let finished = false;

async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

/**
 * يفتح منفذاً عابراً ويتأكّد أن النظام منحه فعلاً.
 * ---------------------------------------------------------------------------
 * تحت ضغط شديد يعود `address().port` صفراً، فيصير العنوان `127.0.0.1:0`
 * ويرفضه undici بـ «bad port» — رسالة لا تدلّ على سببها.
 *
 * قيل هنا سابقاً إن «المحاولة الثانية تكفي دائماً». لم تكفِ: سقطت الحزمة مرة
 * في أربع تشغيلات متتالية على الجهاز نفسه. وبوابةٌ تسقط عشوائياً أسوأ من
 * بوابةٍ حمراء — الأولى تُعلَّم «معروفة» فتُهمَل قراءتها.
 *
 * خمس محاولات مع مهلة تصاعدية: النفاد لحظي، والانتظار بينهما هو ما كان
 * ناقصاً — إعادةُ المحاولة فوراً تصطدم بالحالة نفسها.
 */
const PORT_ATTEMPTS = 5;

async function listenOnFreePort(server, attempt) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address && address.port) return address.port;

  await new Promise((resolve) => server.close(resolve));
  if (attempt >= PORT_ATTEMPTS) {
    throw new Error(`تعذّر الحصول على منفذ عابر بعد ${PORT_ATTEMPTS} محاولات`);
  }
  await new Promise((resolve) => setTimeout(resolve, attempt * 25));
  return listenOnFreePort(server, attempt + 1);
}

/* WP-D1: مفتاح ثابت للاختبار، ودلو رموز واسع كي لا يخلط حدُّ المعدّل نتائج
   حزمةٍ تُطلق عشرات الطلبات في ثوانٍ. الحدّ نفسه مفحوص في حزمة الأمن بدلوٍ
   ضيّق خاص بها — فحصه هنا يجعل كل اختبار آخر رهينةً لتوقيته. */
const TEST_KEY = 'test-key-athar-d1';
/* WP-D3: الدور صار مشتقاً من المفتاح، فحزمة الخادم تستعمل مفتاح المعتمِد —
   أفعالها اعتماد وإرجاع. الفصل نفسه مفحوص في حزمة الأمن لا هنا. */
const TEST_KEYS = { screener: 'test-key-screener', approver: TEST_KEY,
  coordinator: 'test-key-coordinator', publisher: 'test-key-publisher' };

async function withServer(run) {
  /* WP-L1: سجل في الذاكرة وحدها. بلا هذا تتقاسم الحزم ملفاً واحداً على
     القرص فتتسرّب حالة اختبار إلى اختبار — وقد وقع فعلاً. */
  const server = createServer({ roleKeys: TEST_KEYS, ledgerPath: null,
    rateLimit: { capacity: 10000 } });
  const port = await listenOnFreePort(server, 1);
  const address = { port };
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    /**
     * الإغلاق يقطع الاتصالات الحيّة أولاً.
     * -----------------------------------------------------------------------
     * `fetch` في Node يُبقي الاتصال مفتوحاً للاستعمال التالي، و`server.close`
     * ينتظر انتهاء ما هو مفتوح — فلا يُستدعى نداؤه الراجع أبداً، ويبقى
     * `await` معلّقاً. النتيجة تحت الضغط: العمليّة تخرج صامتة بعد أول
     * اختبار، بلا رسالة ولا استثناء، فتُقرأ كفشل عشوائي بلا سبب.
     *
     * ظهرت مرة في كل ~12 تشغيلاً متوازياً — أي بالضبط حين يكون الجهاز مشغولاً،
     * وهو الوقت الذي تُصدَّق فيه البوابة أقلّ ما تستحق.
     */
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

async function postRaw(baseUrl, route, raw, key) {
  const response = await fetch(baseUrl + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Athar-Key': key || TEST_KEY },
    body: raw,
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch (error) {
    body = text;
  }
  return { status: response.status, body };
}

async function post(baseUrl, route, body, key) {
  return postRaw(baseUrl, route, JSON.stringify(body), key);
}

const validScoreInput = {
  aadt: 85000,
  lanes: 4,
  lanesClosed: 1,
  startHour: 22,
  durationHours: 10,
};

(async () => {
  await test('importing the server module does not open a port', async () => {
    const server = createServer();
    assert.strictEqual(server.listening, false);
  });

  await test('empty request body is rejected with 422', async () => {
    await withServer(async (baseUrl) => {
      const result = await postRaw(baseUrl, '/api/score', '');
      assert.strictEqual(result.status, 422);
      assert.strictEqual(result.body.error, 'VALIDATION_ERROR');
      assert.strictEqual(result.body.fields.aadt, 'required');
    });
  });

  await test('empty object is rejected with required field errors', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/score', {});
      assert.strictEqual(result.status, 422);
      assert.strictEqual(result.body.error, 'VALIDATION_ERROR');
      for (const field of ['aadt', 'lanes', 'lanesClosed', 'startHour', 'durationHours']) {
        assert.strictEqual(result.body.fields[field], 'required');
      }
    });
  });

  await test('one missing field returns the stable validation shape', async () => {
    await withServer(async (baseUrl) => {
      const { aadt, ...withoutAadt } = validScoreInput;
      void aadt;
      const result = await post(baseUrl, '/api/score', withoutAadt);
      assert.strictEqual(result.status, 422);
      assert.deepStrictEqual(result.body, {
        error: 'VALIDATION_ERROR',
        fields: { aadt: 'required' },
      });
    });
  });

  await test('numeric strings are rejected instead of coerced', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/score', {
        ...validScoreInput,
        aadt: '85000',
      });
      assert.strictEqual(result.status, 422);
      assert.strictEqual(result.body.fields.aadt, 'must be a finite number');
    });
  });

  await test('non-finite values are rejected by the unit validation path', async () => {
    const validation = validateScoreInput({
      ...validScoreInput,
      aadt: Infinity,
    });
    assert.strictEqual(validation.valid, false);
    assert.strictEqual(validation.fields.aadt, 'must be a finite number');
  });

  await test('closed lanes cannot exceed total lanes', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/score', {
        ...validScoreInput,
        lanesClosed: 5,
      });
      assert.strictEqual(result.status, 422);
      assert.strictEqual(result.body.fields.lanesClosed, 'must be between 1 and lanes');
    });
  });

  await test('malformed JSON returns 400 without becoming a validation error', async () => {
    await withServer(async (baseUrl) => {
      const result = await postRaw(baseUrl, '/api/score', '{"aadt":');
      assert.strictEqual(result.status, 400);
      assert.deepStrictEqual(result.body, { error: 'INVALID_JSON' });
    });
  });

  await test('invalid JSON structure returns 400', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/score', []);
      assert.strictEqual(result.status, 400);
      assert.deepStrictEqual(result.body, { error: 'INVALID_JSON_STRUCTURE' });
    });
  });

  await test('oversized body returns 413', async () => {
    await withServer(async (baseUrl) => {
      const raw = JSON.stringify({ padding: 'x'.repeat(1024 * 1024) });
      const result = await postRaw(baseUrl, '/api/score', raw);
      assert.strictEqual(result.status, 413);
      assert.deepStrictEqual(result.body, { error: 'PAYLOAD_TOO_LARGE' });
    });
  });

  await test('valid minimum score request returns a finite impact result', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/score', validScoreInput);
      assert.strictEqual(result.status, 200);
      assert.ok(Number.isFinite(result.body.delayVehHours));
      assert.ok(result.body.delayVehHours > 0);
    });
  });

  await test('valid optimize request returns exact selected windows', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/optimize', validScoreInput);
      assert.strictEqual(result.status, 200);
      assert.ok(Array.isArray(result.body.top3));
      assert.ok(Array.isArray(result.body.top3[0].windows));
      assert.strictEqual(
        result.body.top3[0].windows.reduce((sum, window) => sum + window.durationHours, 0),
        validScoreInput.durationHours
      );
    });
  });

  /* ---- دورة القرار عبر الواجهة ---- */

  const validDecision = {
    version: 2,
    status: 'Approved',
    action: 'approve',
    actor: 'مراجع أول',
    reason: 'الأثر ضمن الحد',
    at: '2026-07-25T10:00:00Z',
    inputs: { aadt: 80000, lanes: 4, lanesClosed: 2, startHour: 8, durationHours: 8 },
  };

  await test('decision endpoint stores a record and returns the trail', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/works/p001/decisions', validDecision);
      assert.strictEqual(result.status, 200);
      assert.strictEqual(result.body.workId, 'p001');
      assert.strictEqual(result.body.stored, 1);
      assert.strictEqual(result.body.decisions[0].actor, 'مراجع أول');
    });
  });

  await test('an undo is accepted without inputs — it recomputed nothing', async () => {
    // Rejecting it would split the server ledger from the browser's and show
    // a decision with no trace of the undo that reversed it.
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/works/p001/decisions', {
        version: 3, status: 'StrategyReview', action: 'undo', actor: 'مناوب الفرز',
        reason: 'تراجع عن «approve» (نسخة 2)', at: '2026-07-25T11:00:00Z', inputs: {},
      });
      assert.strictEqual(result.status, 200);
      assert.strictEqual(result.body.decisions[0].action, 'undo');
    });
  });

  await test('an undo that names nothing is rejected', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/works/p001/decisions', {
        version: 3, status: 'StrategyReview', action: 'undo', actor: 'م',
        reason: '   ', at: '2026-07-25T11:00:00Z', inputs: {},
      });
      assert.strictEqual(result.status, 422);
      assert.strictEqual(result.body.fields.reason,
        'an undo must name the decision it reverses');
    });
  });

  await test('the inputs rule still binds every deciding action', async () => {
    await withServer(async (baseUrl) => {
      for (const action of ['approve', 'reject', 'return', 'screen']) {
        const result = await post(baseUrl, '/api/works/p001/decisions',
          { ...validDecision, action, inputs: {} });
        assert.strictEqual(result.status, 422, `${action} slipped through without inputs`);
      }
    });
  });

  await test('decision without an inputs snapshot is rejected', async () => {
    await withServer(async (baseUrl) => {
      const { inputs, ...withoutInputs } = validDecision;
      const result = await post(baseUrl, '/api/works/p001/decisions', withoutInputs);
      assert.strictEqual(result.status, 422);
      assert.strictEqual(result.body.error, 'VALIDATION_ERROR');
      assert.ok(result.body.fields.inputs, 'inputs must be flagged');
    });
  });

  await test('decision version below two is rejected', async () => {
    await withServer(async (baseUrl) => {
      const result = await post(baseUrl, '/api/works/p001/decisions',
        { ...validDecision, version: 1 });
      assert.strictEqual(result.status, 422);
      assert.ok(result.body.fields.version);
    });
  });

  await test('missing actor or timestamp is rejected', async () => {
    await withServer(async (baseUrl) => {
      for (const field of ['actor', 'at', 'status', 'action']) {
        const body = { ...validDecision };
        delete body[field];
        const result = await post(baseUrl, '/api/works/p001/decisions', body);
        assert.strictEqual(result.status, 422, `${field} must be required`);
        assert.ok(result.body.fields[field]);
      }
    });
  });

  await test('decisions accumulate by version and never silently drop', async () => {
    await withServer(async (baseUrl) => {
      await post(baseUrl, '/api/works/p007/decisions', validDecision);
      await post(baseUrl, '/api/works/p007/decisions',
        /* WP-D3: تثبيت الجدول انتقالٌ إلى `Scheduled` — يخصّ الناشر لا
           المعتمِد. مفتاح المعتمِد هنا يردّ 403 بحق. */
        { ...validDecision, version: 3, action: 'schedule', status: 'Scheduled' },
        TEST_KEYS.publisher);
      const response = await fetch(`${baseUrl}/api/works/p007/decisions`);
      const body = await response.json();
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(body.decisions.map((d) => d.version), [2, 3]);
    });
  });

  await test('re-posting the same version replaces it rather than duplicating', async () => {
    await withServer(async (baseUrl) => {
      await post(baseUrl, '/api/works/p009/decisions', validDecision);
      const result = await post(baseUrl, '/api/works/p009/decisions',
        { ...validDecision, actor: 'مراجع ثانٍ' });
      assert.strictEqual(result.body.stored, 1);
      assert.strictEqual(result.body.decisions[0].actor, 'مراجع ثانٍ');
    });
  });

  await test('decisions of an untouched work read back empty, not 404', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/works/p999/decisions`);
      const body = await response.json();
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(body.decisions, []);
    });
  });

  await test('a malformed work id does not reach the decision store', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/works/..%2F..%2Fetc/decisions`);
      // The body must be drained even when unused: an unconsumed body keeps the
      // connection checked out of the pool, and the server then waits on a
      // socket that never ends.
      await response.text();
      assert.strictEqual(response.status, 404);
    });
  });

  await test('portfolio-wide decision ledger reports both counts', async () => {
    await withServer(async (baseUrl) => {
      await post(baseUrl, '/api/works/p001/decisions', validDecision);
      await post(baseUrl, '/api/works/p002/decisions', validDecision);
      await post(baseUrl, '/api/works/p002/decisions', { ...validDecision, version: 3 });
      const response = await fetch(`${baseUrl}/api/decisions`);
      const body = await response.json();
      assert.strictEqual(body.counts.works, 2);
      assert.strictEqual(body.counts.decisions, 3);
    });
  });

  finished = true;
  console.log(`ALL SERVER TESTS PASSED (${passed})`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * حارس الخروج الصامت.
 * ---------------------------------------------------------------------------
 * حين يبقى `await` معلّقاً بلا مقبض مفتوح، تُستنزف حلقة الأحداث وتخرج العمليّة
 * برمز 0 بلا استثناء ولا رسالة — فتبدو الحزمة ناجحة وقد توقّفت في منتصفها.
 * هذا الحارس يحوّل ذلك الصمت إلى فشل معلن يذكر أين توقّف.
 */
process.on('exit', () => {
  if (finished) return;
  process.exitCode = 1;
  console.error(`\nSUITE DIED SILENTLY after ${passed} tests — `
    + 'the event loop drained with a promise still pending.');
});
