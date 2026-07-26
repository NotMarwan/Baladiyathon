'use strict';
/**
 * WP-L1 — بوابة ثبات سجل القرارات.
 *
 * العيب الذي تحرسه ليس فقدان بيانات، بل **قاعدةٌ تُهزَم بإعادة تشغيل**.
 *
 * WP-D3 أعلنت «من فحص التصريح لا يعتمده»، و`segregationBreach` تقرأ ذلك من
 * سجل القرارات. وكان السجل في الذاكرة — فإعادة تشغيل الخادم تُفرغه، ويعود
 * الفاحص قادراً على اعتماد ما فحصه. لا ثغرة ولا التفاف: كفى أن يُعاد تشغيل.
 *
 * فالفحص الحاكم هنا ليس «هل حُفظ الملف» بل **«هل نجا القيد»**.
 *
 * وكل فحص يعيد إنشاء الخادم فعلاً على المسار نفسه — لا يستدعي دالة قراءة
 * ويسمّي ذلك إعادة تشغيل.
 *
 * التشغيل: node presentation/tests/ledger-persistence-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const Server = require(path.join(ROOT, 'server.js'));
const { createLedger } = require(path.join(ROOT, 'athar-ledger.js'));

const KEYS = {
  screener: 'ledger-key-screener',
  approver: 'ledger-key-approver',
  coordinator: 'ledger-key-coordinator',
  publisher: 'ledger-key-publisher',
};

let count = 0;
let scratchIndex = 0;
const scratchFiles = [];

async function test(name, fn) {
  await fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

function scratchPath() {
  scratchIndex += 1;
  const file = path.join(os.tmpdir(),
    `athar-ledger-${process.pid}-${scratchIndex}.jsonl`);
  scratchFiles.push(file);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return file;
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

/**
 * يشغّل خادماً على مسار سجل، ثم يغلقه.
 *
 * الإغلاق الكامل بين الجولتين هو ما يجعل الفحص فحصَ إعادة تشغيل: خادمٌ يبقى
 * حيّاً يحتفظ بالذاكرة، فيمرّ الفحص بلا أن يثبت شيئاً.
 */
async function withServerOn(ledgerPath, run, extra) {
  const warnings = [];
  const server = Server.createServer({
    roleKeys: KEYS,
    ledgerPath,
    rateLimit: { capacity: 10000 },
    onWarn: (message) => warnings.push(message),
    ...(extra || {}),
  });
  const port = await listenOnFreePort(server, 1);
  /* منفذٌ صفر يعطي «bad port» من undici — رسالة لا تدلّ على سببها، وقد
     أضاعت وقتاً هنا فعلاً. الفشل يُسمّى عند مصدره. */
  assert.ok(port > 0, `منفذ غير صالح: ${port}`);
  try {
    return await run(`http://127.0.0.1:${port}`, warnings);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

const decision = (status, actor, version) => ({
  version: version || 2,
  status,
  action: 'act',
  actor,
  at: '2026-07-26T06:00:00.000Z',
  inputs: { aadt: 85000, lanes: 4 },
});

const write = (base, work, body, key) => fetch(
  `${base}/api/works/${work}/decisions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Athar-Key': key },
    body: JSON.stringify(body),
  });

const read = async (base, work) => (
  await (await fetch(`${base}/api/works/${work}/decisions`)).json()).decisions;

(async () => {
  // ---- الفحص الحاكم ---------------------------------------------------
  await test('قيد فصل الواجبات ينجو من إعادة التشغيل', async () => {
    const file = scratchPath();

    await withServerOn(file, async (base) => {
      const screened = await write(base, 'w001',
        decision('ImpactScreening', 'سعد'), KEYS.screener);
      assert.strictEqual(screened.status, 200, 'الفحص لم يُقبل');
    });

    /* الخادم أُغلق. لو كان السجل في الذاكرة لبدأ الثاني فارغاً، ولمرّ
       الاعتماد — وهو بالضبط ما كان يحدث قبل WP-L1. */
    await withServerOn(file, async (base) => {
      const denied = await write(base, 'w001',
        decision('Approved', 'سعد', 3), KEYS.approver);
      assert.strictEqual(denied.status, 403,
        `الفاحص نفسه اعتمد بعد إعادة التشغيل — ${denied.status}`);
      assert.strictEqual((await denied.json()).error, 'SEGREGATION_OF_DUTIES');

      const other = await write(base, 'w001',
        decision('Approved', 'ليان', 3), KEYS.approver);
      assert.strictEqual(other.status, 200, 'معتمِدٌ آخر مُنع بلا سبب');
    });
  });

  await test('القرار ودوره ومنفِّذه وزمنه يعودون بعد إعادة التشغيل', async () => {
    const file = scratchPath();
    await withServerOn(file, async (base) => {
      await write(base, 'w002', decision('ImpactScreening', 'أ'), KEYS.screener);
      await write(base, 'w002', decision('Approved', 'ب', 3), KEYS.approver);
      await write(base, 'w002', decision('Scheduled', 'ج', 4), KEYS.publisher);
    });

    await withServerOn(file, async (base) => {
      const stored = await read(base, 'w002');
      assert.strictEqual(stored.length, 3, `${stored.length} قرار بعد الإقلاع`);
      assert.deepStrictEqual(stored.map((r) => r.role),
        ['screener', 'approver', 'publisher'], 'الأدوار لم تنجُ');
      assert.deepStrictEqual(stored.map((r) => r.actor), ['أ', 'ب', 'ج']);
      assert.deepStrictEqual(stored.map((r) => r.version), [2, 3, 4]);
      stored.forEach((record) => {
        assert.ok(record.at, 'قرار بلا زمن');
        assert.ok(record.roleLabel, 'قرار بلا اسم دور مقروء');
        assert.strictEqual(record.workId, 'w002');
      });
    });
  });

  await test('استبدال النسخة ينجو كذلك — لا نسختان لرقم واحد', async () => {
    /* الملف مُلحَق به، فالنسخة القديمة تبقى سطراً فيه. إعادةُ البناء يجب أن
       تطبّق قاعدة الاستبدال نفسها، وإلا عاد قرارٌ نُقض. */
    const file = scratchPath();
    await withServerOn(file, async (base) => {
      await write(base, 'w003', decision('ImpactScreening', 'أول'), KEYS.screener);
      await write(base, 'w003', decision('StrategyReview', 'ثانٍ'), KEYS.screener);
    });
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 2, 'الملف لا يُلحَق به — أُعيدت كتابته');

    await withServerOn(file, async (base) => {
      const stored = await read(base, 'w003');
      assert.strictEqual(stored.length, 1, `${stored.length} قرار لنسخة واحدة`);
      assert.strictEqual(stored[0].actor, 'ثانٍ', 'الاستبدال لم يُطبَّق عند البناء');
    });
  });

  // ---- الإلحاق لا إعادة الكتابة ---------------------------------------
  await test('الملف يُلحَق به: سطرٌ لكل قرار وما قبله لا يُمسّ', async () => {
    const file = scratchPath();
    await withServerOn(file, async (base) => {
      await write(base, 'w004', decision('ImpactScreening', 'أ'), KEYS.screener);
    });
    const afterFirst = fs.readFileSync(file, 'utf8');

    await withServerOn(file, async (base) => {
      await write(base, 'w005', decision('ImpactScreening', 'ب'), KEYS.screener);
    });
    const afterSecond = fs.readFileSync(file, 'utf8');

    assert.ok(afterSecond.startsWith(afterFirst),
      'الكتابة الثانية غيّرت ما قبلها — ليست إلحاقاً');
    assert.strictEqual(afterSecond.trim().split('\n').length, 2);
  });

  // ---- التلف لا يُسقط ولا يُخفى ---------------------------------------
  await test('سطر تالف يُتخطّى ويُبلَّغ ولا يُحذف ولا يُسقط الخادم', async () => {
    const file = scratchPath();
    await withServerOn(file, async (base) => {
      await write(base, 'w006', decision('ImpactScreening', 'سليم'), KEYS.screener);
    });

    /* تلفٌ في المنتصف: سطر ناقص ثم سطر سليم بعده. لو توقّفت القراءة عند
       التالف لضاع ما بعده صامتاً. */
    const good = fs.readFileSync(file, 'utf8').trim();
    const later = JSON.stringify({
      ...decision('ImpactScreening', 'بعد التلف'), workId: 'w007', role: 'screener',
      roleLabel: 'فاحص الأثر',
    });
    fs.writeFileSync(file, `${good}\n{"workId":"w006","version":\n${later}\n`, 'utf8');
    const before = fs.readFileSync(file, 'utf8');

    await withServerOn(file, async (base, warnings) => {
      const first = await read(base, 'w006');
      const after = await read(base, 'w007');
      assert.strictEqual(first.length, 1, 'السطر السليم قبل التلف ضاع');
      assert.strictEqual(after.length, 1, 'السطر السليم بعد التلف ضاع');
      assert.ok(warnings.some((message) => /سطر 2 تالف/.test(message)),
        `التلف لم يُبلَّغ: ${warnings.join(' | ')}`);
    });

    assert.strictEqual(fs.readFileSync(file, 'utf8'), before,
      'الملف عُدِّل عند القراءة — التالف حُذف بصمت');
  });

  await test('الجرد يعدّ المحمَّل والمتخطَّى ويسمّي أرقام السطور', () => {
    const file = scratchPath();
    fs.writeFileSync(file, [
      JSON.stringify({ workId: 'a', version: 2, actor: 'x' }),
      'ليس JSON',
      JSON.stringify({ workId: 'b', version: 2, actor: 'y' }),
      '{"workId":"c"',
    ].join('\n') + '\n', 'utf8');

    const messages = [];
    const ledger = createLedger(file, { onWarn: (m) => messages.push(m) });
    assert.strictEqual(ledger.stats.loaded, 2);
    assert.strictEqual(ledger.stats.skipped, 2);
    assert.deepStrictEqual(ledger.stats.corruptLines, [2, 4],
      'أرقام السطور التالفة غير مسمّاة — لا يُعرف أين يُصلح');
    assert.strictEqual(messages.length, 2);
  });

  await test('سجلٌّ بلا سطر صالح لا يُسقط الخادم', async () => {
    const file = scratchPath();
    fs.writeFileSync(file, 'تلف\nتلف آخر\n', 'utf8');
    await withServerOn(file, async (base) => {
      const response = await fetch(`${base}/api/decisions`);
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual((await response.json()).counts,
        { works: 0, decisions: 0 });
    });
  });

  // ---- العزل والمسار ---------------------------------------------------
  await test('`ledgerPath: null` يعطي سجلاً في الذاكرة ولا يكتب ملفاً', async () => {
    /* بلا هذا الخيار تتقاسم كل الحزم ملفاً واحداً وتتسرّب حالة اختبار إلى
       اختبار — وقد وقع فعلاً عند تركيب هذه الحزمة. */
    const before = fs.existsSync(Server.DEFAULT_LEDGER_PATH)
      ? fs.readFileSync(Server.DEFAULT_LEDGER_PATH, 'utf8') : null;
    await withServerOn(null, async (base) => {
      await write(base, 'w008', decision('ImpactScreening', 'أ'), KEYS.screener);
      assert.strictEqual((await read(base, 'w008')).length, 1);
    });
    const after = fs.existsSync(Server.DEFAULT_LEDGER_PATH)
      ? fs.readFileSync(Server.DEFAULT_LEDGER_PATH, 'utf8') : null;
    assert.strictEqual(after, before,
      'سجل الذاكرة كتب في الملف الافتراضي');
  });

  await test('السجل الافتراضي خارج جذر الصفحات — لا يُقدَّم عبر HTTP', () => {
    /* ملفٌ تحت `presentation/` يُقدَّم لأي طالب. سجل القرارات يحمل أسماء
       المنفِّذين وأدوارهم. */
    const root = path.resolve(ROOT);
    assert.ok(!Server.DEFAULT_LEDGER_PATH.startsWith(root + path.sep),
      `السجل داخل جذر الصفحات: ${Server.DEFAULT_LEDGER_PATH}`);
    assert.ok(/\.jsonl$/.test(Server.DEFAULT_LEDGER_PATH));
  });

  await test('المكتب يقرأ سجل الخادم فعلاً — الدالة مُنادى عليها لا معرَّفة فقط', () => {
    /* هذا الفحص وُلد من إصابة: نداءُ `mergeServerLedger` أُدرج بخطأ **داخل
       تعليق الرأس** فلم يُنفَّذ أبداً. الحزم الثماني والخمسون بقيت خضراء —
       لا حزمة تُحمّل هذا الملف — وكشفَه المتصفح وحده.
       تعريفٌ بلا نداء دالةٌ ميتة تبدو ميزةً في مراجعة الشيفرة. */
    const boot = fs.readFileSync(path.join(ROOT, 'athar-desk-boot.js'), 'utf8');
    const visible = boot
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/[^\n]*/gm, ' ');
    assert.ok(/function mergeServerLedger\s*\(/.test(visible),
      'المكتب لا يعرّف قراءة سجل الخادم');
    const calls = (visible.match(/mergeServerLedger\s*\(/g) || []).length;
    assert.ok(calls >= 2,
      'قراءة سجل الخادم معرَّفة ولا يُنادى عليها — سجلٌّ أحاديّ الاتجاه');
    assert.ok(/\/api\/decisions/.test(visible),
      'المكتب لا يطلب سجل الخادم');
  });

  await test('المسار يُضبط بمتغيّر بيئة', () => {
    assert.ok(/ATHAR_LEDGER/.test(
      fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8')
    ), 'مسار السجل غير قابل للضبط من البيئة');
  });

  // ---- التثبيت لا يبتلع الفشل ------------------------------------------
  await test('فشل الكتابة يُبلَّغ ولا يُسقط القرار من الذاكرة', async () => {
    /* قرصٌ ممتلئ أو صلاحية مفقودة عطلُ وسيط، لا سببٌ لإسقاط قرار المراجع.
       المسار هنا مجلدٌ لا ملف — الكتابة تفشل حتماً. */
    const impossible = path.join(os.tmpdir(), `athar-ledger-dir-${process.pid}`);
    fs.mkdirSync(impossible, { recursive: true });
    const messages = [];
    const ledger = createLedger(impossible, { onWarn: (m) => messages.push(m) });
    const stored = ledger.append({ workId: 'z', version: 2, actor: 'أ' });
    assert.ok(stored && stored.length === 1, 'القرار سقط لفشل قرص');
    assert.strictEqual(ledger.stats.writeFailures, 1);
    assert.ok(messages.some((m) => /تعذّر التثبيت/.test(m)),
      'فشل التثبيت ابتُلع صامتاً');
    fs.rmSync(impossible, { recursive: true, force: true });
  });

  scratchFiles.forEach((file) => {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  console.log(`ALL TESTS PASSED (${count})`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
