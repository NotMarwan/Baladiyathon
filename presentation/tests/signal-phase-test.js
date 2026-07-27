'use strict';
/**
 * بوابة «طور الإشارة عند إغلاق مدخل».
 * ---------------------------------------------------------------------------
 * **العيب الذي تحرسه.**
 *
 * إغلاق مدخلٍ على تقاطع بإشارة يُنتج تأخيراً لا يظهر في أي نموذج وصلات: الأخضر
 * يبقى يُمنح لمدخلٍ مغلق، فيصير أحمرَ إضافياً على الباقين. والمنتج كان لا يراه
 * أصلاً — `masar-engine.js` لا يذكر التقاطعات، و`controlMinutes` تأخيرٌ موحّد
 * للعقدة لا نموذج أطوار.
 *
 * **وما تحرس منه — وهو الأخطر هنا.**
 *
 * أن يُقرأ الكشف حساباً. لا ثانيةَ واحدة محرَّرة يمكن أن تُحسب على هذه
 * البيانات: طول الدورة ونسبة الأخضر إلى الدورة غير موجودتين في أي مصدر. فكل
 * ما يخرج مظروفٌ معلَن الافتراض، ودرجته `model-derived` ولا تُرفَّع.
 *
 * وأن يُقرأ صفر `blocked` طمأنينة. الصفر بنيويّ: تمثيل الإغلاق يمنع كل ضلع عند
 * التقاطع، فلا بديل يعبره أصلاً. والفحص أدناه يثبت العلّة نفسها لا يكتفي
 * بالنتيجة — لأن أخضرَ بتعليل كاذب أسوأ من فحص ساقط.
 *
 * التشغيل: node presentation/tests/signal-phase-test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
global.window = global;

const Engine = require(path.join(ROOT, 'masar-engine.js'));
const Analysis = require(path.join(ROOT, 'masar-desk-analysis.js'));
const DeskFile = require(path.join(ROOT, 'masar-desk-file.js'));
const RouteEvidence = require(path.join(ROOT, 'masar-route-evidence.js'));

const REPORT = path.join(ROOT, 'data', 'signal-phase-impact.json');
const CONTEXT = path.join(ROOT, 'data', 'intersection-context.json');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`  ok - ${name}`);
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const context = JSON.parse(fs.readFileSync(CONTEXT, 'utf8'));
const portfolio = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8'));

const confirmed = Object.entries(report.permits)
  .filter(([, entry]) => entry.control === 'confirmed');

test('كل تصريح في المحفظة له حالة تحكّم — بلا إسقاط صامت', () => {
  /* إسقاط ما تعذّر قياسه يجعل النسب تُقرأ على محفظة أصغر من المعلَنة، وهي
     أخطر طريقة لتحسين رقم: لا تكذب، تُخفي المقام. */
  assert.strictEqual(report.total, portfolio.features.length);
  portfolio.features.forEach((feature) => {
    const entry = report.permits[feature.properties.permitRef];
    assert.ok(entry, `${feature.properties.permitRef}: بلا حالة تحكّم`);
    assert.ok(['confirmed', 'single-source', 'none', 'unmeasurable']
      .indexOf(entry.control) !== -1, `حالة غير معروفة: ${entry.control}`);
  });
  const summed = report.tally.confirmed + report.tally.singleSource
    + report.tally.none + report.tally.unmeasurable;
  assert.strictEqual(summed, report.total, 'مجموع الحالات لا يساوي المحفظة');
});

test('الحصيلة تطابق ما قاسه مؤشر السياق — حسابان مستقلان يتفقان', () => {
  /* الرقم يُقرأ من الملف المولَّد الآخر لا من ثابت مكتوب هنا: ثابتٌ مخزَّن
     يوافق نفسه إلى الأبد ولو انحرف الحسابان معاً. */
  const measured = context.summary.permitsWithConfirmedSignalControl;
  assert.strictEqual(report.tally.confirmed, measured,
    `التحكّم المؤكَّد ${report.tally.confirmed} لا يطابق ${measured} في مؤشر السياق`);
  assert.strictEqual(report.crossCheck.measured, measured);
  assert.strictEqual(report.crossCheck.matched, true);
});

test('الحالة مشتقّة من القياس لا مكتوبة', () => {
  const pointGeometry = new Set(portfolio.features
    .filter((one) => !one.geometry || one.geometry.type !== 'LineString')
    .map((one) => one.properties.permitRef));

  Object.entries(report.permits).forEach(([ref, entry]) => {
    if (pointGeometry.has(ref)) {
      assert.strictEqual(entry.control, 'unmeasurable',
        `${ref}: هندسة نقطية وحالته ليست «غير قابل للقياس»`);
      return;
    }
    assert.notStrictEqual(entry.control, 'unmeasurable',
      `${ref}: خطّ يُقاس عليه وحالته «غير قابل للقياس»`);

    const pairs = entry.intersections.length;
    const anySource = entry.listedOnRoute > 0 || entry.signalsOnRoute > 0;
    if (pairs > 0) assert.strictEqual(entry.control, 'confirmed', `${ref}`);
    else if (anySource) assert.strictEqual(entry.control, 'single-source', `${ref}`);
    else assert.strictEqual(entry.control, 'none', `${ref}`);

    /* «غياب عقدة إشارة ليس دليل غياب إشارة» — الوسم يجب أن يصاحب كل حالة
       غير مؤكَّدة، وأن يغيب عن المؤكَّدة وحدها. */
    assert.strictEqual(entry.absenceIsNotEvidence, entry.control !== 'confirmed',
      `${ref}: وسم «الغياب ليس دليلاً» لا يطابق الحالة`);
  });
});

test('العتبات المعلنة محترمة — لا توسيع لالتقاط حالات', () => {
  /* توسيع عتبةٍ حتى تظهر حالات هو أرخص طريقة لجعل ميزة تبدو مفيدة. الفحص
     يمنعها: كل زوج مؤكَّد يجب أن يكون داخل العتبات الثلاث المعلنة. */
  assert.strictEqual(report.method.onRouteM, 50);
  assert.strictEqual(report.method.signalOnRouteM, 30);
  assert.strictEqual(report.method.corroborationM, 75);
  assert.strictEqual(report.method.onRouteM, context.method.onRouteM);
  assert.strictEqual(report.method.corroborationM, context.method.corroborationM);

  confirmed.forEach(([ref, entry]) => {
    assert.ok(entry.intersections.length > 0, `${ref}: مؤكَّد بلا تقاطع`);
    entry.intersections.forEach((one) => {
      assert.ok(one.intersectionToWorkM <= report.method.onRouteM,
        `${ref}: تقاطع على ${one.intersectionToWorkM} م — فوق العتبة`);
      assert.ok(one.signalToWorkM <= report.method.signalOnRouteM,
        `${ref}: إشارة على ${one.signalToWorkM} م — فوق العتبة`);
      assert.ok(one.pairM <= report.method.corroborationM,
        `${ref}: تطابق على ${one.pairM} م — فوق العتبة`);
    });
  });
});

test('إسناد العقدة محكوم بسقف، ومسحه منشور', () => {
  /* السقف بلا مسح يُقرأ منتقىً. والمسح يقول إن 50 و75 يعطيان العدد نفسه —
     أي أن النتيجة ليست أثر عتبة. */
  assert.strictEqual(report.method.nodeSnapM, 50);
  assert.ok(Array.isArray(report.method.nodeSnapSweepM));
  report.method.nodeSnapSweepM.forEach((threshold) => {
    assert.ok(Number.isFinite(report.method.nodeSnapSweep[String(threshold)]),
      `المسح لا يحمل عتبة ${threshold}`);
  });

  confirmed.forEach(([ref, entry]) => {
    entry.intersections.forEach((one) => {
      if (one.nodeStatus === 'resolved') {
        assert.ok(Number.isInteger(one.node), `${ref}: عقدة مُسنَدة بلا معرّف`);
        assert.ok(one.nodeSnapM <= report.method.nodeSnapM,
          `${ref}: إسناد على ${one.nodeSnapM} م فوق السقف ومع ذلك مقبول`);
        assert.ok(one.legs >= report.method.nodeMinDegree,
          `${ref}: عقدة بأقل من ${report.method.nodeMinDegree} أضلاع تُعدّ تقاطعاً`);
      } else {
        assert.strictEqual(one.node, null, `${ref}: عقدة غير مُسنَدة ولها معرّف`);
        assert.ok(one.nodeUnresolvedWhy, `${ref}: عدم الإسناد بلا سبب مكتوب`);
      }
    });
  });
});

test('المظروف معلَن الافتراض، ولا يدّعي ثوانيَ ولا درجةً أعلى', () => {
  const ladderRank = (key) => {
    const grade = RouteEvidence.EVIDENCE_GRADES
      .filter((one) => one.key === key)[0];
    assert.ok(grade, `درجة غير معروفة في السُّلَّم: ${key}`);
    return grade.rank;
  };
  const modelRank = ladderRank('model-derived');

  let envelopes = 0;
  confirmed.forEach(([ref, entry]) => {
    entry.intersections.forEach((one) => {
      if (one.nodeStatus !== 'resolved') {
        assert.strictEqual(one.envelope, null, `${ref}: مظروف بلا عقدة`);
        return;
      }
      const envelope = one.envelope;
      envelopes += 1;
      assert.strictEqual(envelope.lowPct, 0,
        `${ref}: أدنى المظروف ليس صفراً — الخطة الثابتة هي الوضع القائم`);
      assert.strictEqual(envelope.highPct, Math.round(100 / one.legs),
        `${ref}: أعلى المظروف ليس حصة مدخل واحد من ${one.legs} أضلاع`);
      assert.ok(envelope.assumption && envelope.assumption.length > 40,
        `${ref}: مظروف بلا افتراض معلن`);
      assert.match(envelope.unit, /٪/, `${ref}: وحدة المظروف ليست نسبة`);
      assert.match(envelope.notSeconds, /طول الدورة/,
        `${ref}: المظروف لا يقول لماذا لا يصير ثواني`);
      assert.ok(ladderRank(envelope.evidenceLevel) <= modelRank,
        `${ref}: درجة «${envelope.evidenceLevel}» أعلى من مشتقّ من النموذج`);
    });
  });
  assert.ok(envelopes > 0, 'لا مظروف واحد في التقرير — الفحص يمرّ فارغاً');
});

test('لغة التقرير تلتزم بدرجته — لا مفردة قياس على رقم مشتقّ', () => {
  /* «مرصود» و«مقيس» و«ميداني» ترفع الدليل الضعيف إلى قوي بلا بيانات جديدة،
     وهي أرخص طريقة لذلك. تُمنع بفحص لا بعُرف. */
  assert.strictEqual(report.grade, 'model-derived');
  const prose = [report.role, report.doesNotProve, report.method.confirmedMeans]
    .concat(Object.values(report.limits).map((one) => one.why))
    .concat(confirmed.flatMap(([, entry]) => entry.intersections
      .filter((one) => one.envelope)
      .flatMap((one) => [one.envelope.assumption, one.envelope.highMeans])))
    .join(' ');
  const verdict = RouteEvidence.checkLanguage('model-derived', prose);
  assert.ok(verdict.ok, 'مفردات ممنوعة: ' + verdict.violations.join('، '));
  assert.match(report.doesNotProve, /طول الدورة/);
});

test('صفر «محجوب» معلَّل بنيوياً — لا يُقرأ فحصاً نجح', () => {
  /* هذه أهمّ حراسة في الملف. الصفر صحيح، وقراءته «تحقّقنا أن البدائل سليمة»
     كذب. والعلّة تُفحص لا تُدّعى: ما دام كل ضلع عند التقاطع ممنوعاً، فلا
     بديل يعبره أصلاً. */
  assert.strictEqual(report.tally.blocked, 0,
    'ظهر «محجوب» — القاعدة صارت قابلة للاختبار، فحدِّث التعليل قبل أن تمرّر');
  assert.ok(report.limits.zeroBlockedIsStructural.why.length > 60,
    'الصفر بلا تعليل مكتوب');
  assert.ok(report.limits.zeroBlockedIsStructural.wouldBecomeTestableWhen,
    'التعليل لا يقول متى تصير القاعدة قابلة للاختبار');

  let checked = 0;
  confirmed.forEach(([ref, entry]) => {
    entry.intersections.filter((one) => one.nodeStatus === 'resolved')
      .forEach((one) => {
        checked += 1;
        assert.strictEqual(one.legsUnderClosure, one.legs,
          `${ref}: ليست كل أضلاع التقاطع ممنوعة — العلّة المكتوبة للصفر لم تعد صحيحة`);
      });
  });
  assert.ok(checked > 0, 'لا عقدة مُسنَدة — الفحص يمرّ فارغاً');
});

test('تسمية المدخل المغلق غير مدّعاة — والعجز مكتوب', () => {
  /* الفكرة تفترض «مدخلاً واحداً مغلقاً»، والبيانات لا تسمّيه: تمثيل الإغلاق
     يمنع كل ضلع، وبُعد الطرف البعيد لا يفصل. فيُعرض التفصيل خاماً. */
  assert.ok(report.limits.closedApproachNotDerivable.why.length > 60);
  confirmed.forEach(([ref, entry]) => {
    entry.intersections.filter((one) => one.nodeStatus === 'resolved')
      .forEach((one) => {
        assert.strictEqual(one.legDetail.length, one.legs,
          `${ref}: عدد الأضلاع لا يطابق تفصيلها`);
        one.legDetail.forEach((leg) => {
          assert.ok(Number.isInteger(leg.edge), `${ref}: ضلع بلا معرّف`);
          assert.ok(Number.isFinite(leg.farEndToWorkM), `${ref}: ضلع بلا مسافة`);
          assert.strictEqual(typeof leg.underClosure, 'boolean');
        });
        assert.ok(!Object.prototype.hasOwnProperty.call(one, 'closedApproach'),
          `${ref}: التقرير يسمّي مدخلاً مغلقاً وهو غير مشتَقّ`);
      });
  });
});

test('التوصية لا تُرفع إلا على مؤكَّدٍ مرشَّح', () => {
  Object.entries(report.permits).forEach(([ref, entry]) => {
    const eligible = entry.control === 'confirmed' && entry.rule.state === 'eligible';
    if (!eligible) {
      assert.strictEqual(entry.recommendation, null,
        `${ref}: توصية على حالة ${entry.control}/${entry.rule.state}`);
      return;
    }
    assert.ok(entry.recommendation, `${ref}: مرشَّح بلا توصية`);
    assert.strictEqual(entry.recommendation.action, 'coordinate-retiming');
    assert.match(entry.recommendation.label, /إدارة المرور/);
  });
  assert.strictEqual(report.tally.eligible + report.tally.blocked
    + report.tally.ruleUnmeasurable, report.tally.confirmed,
  'عدّا القاعدة لا يجمعان إلى المؤكَّد');
  assert.ok(report.tally.eligible > 0, 'لا مرشَّح واحد — الفحص يمرّ فارغاً');
});

test('البطاقة تسمّي الإجراء بلغة تُقرأ بلا مصطلح', () => {
  const ref = confirmed.filter(([, entry]) => entry.rule.state === 'eligible')[0][0];
  const feature = portfolio.features
    .find((one) => one.properties.permitRef === ref);

  global.MASAR_SIGNAL_PHASE = report;
  const analysis = Analysis.evaluate(feature.properties, Engine);
  const html = DeskFile.renderSummary(feature, analysis);

  assert.ok(html.indexOf('طور الإشارة') !== -1, 'البطاقة لا تطرح المسألة أصلاً');
  assert.ok(html.indexOf('أخضرَ لمدخلٍ مغلق') !== -1,
    'البطاقة لا تشرح الآلية — «تقاطع بإشارة» وحدها لا تعني شيئاً للقارئ');
  assert.ok(html.indexOf('تنسيق إعادة توقيت مع إدارة المرور') !== -1,
    'الإجراء غير مسمّى — البلاغ بلا جهة ولا فعل لا يُنفَّذ');
  assert.ok(html.indexOf('افتراض معلن لا قياس') !== -1,
    'المدى يُعرض بلا افتراضه — يُقرأ حساباً');
  assert.ok(html.indexOf('طول الدورة غير منشور') !== -1,
    'البطاقة لا تقول لماذا لا ثوانيَ هنا');

  /* تمييز العدد: «5 ضلعاً» خطأ يقرؤه المستخدم قبل أن يقرأ الرقم. */
  const legs = report.permits[ref].intersections
    .filter((one) => one.nodeStatus === 'resolved')[0].legs;
  if (legs >= 3 && legs <= 10) {
    assert.ok(html.indexOf(legs + ' أضلاع') !== -1,
      `البطاقة لا تميّز العدد: ${legs} تأخذ الجمع لا المفرد المنصوب`);
  }
});

test('غير المؤكَّد يُقال غير مؤكَّد، ولا يُدّعى نفياً', () => {
  const ref = Object.entries(report.permits)
    .filter(([, entry]) => entry.control === 'single-source')[0][0];
  const feature = portfolio.features
    .find((one) => one.properties.permitRef === ref);

  global.MASAR_SIGNAL_PHASE = report;
  const html = DeskFile.renderSummary(feature, Analysis.evaluate(feature.properties, Engine));

  assert.ok(html.indexOf('غير مؤكَّد') !== -1, 'الحالة غير المؤكَّدة تُعرض مؤكَّدة');
  assert.ok(html.indexOf('تنسيق إعادة توقيت مع إدارة المرور') === -1,
    'توصية توقيت على تحكّم غير مؤكَّد');
  assert.ok(html.indexOf('ولا يُقرأ ذلك نفياً') !== -1,
    'البطاقة تترك الغياب يُقرأ نفياً لوجود إشارة');
});

test('حيث لا مصدر — صمت لا تخمين', () => {
  const ref = Object.entries(report.permits)
    .filter(([, entry]) => entry.control === 'none')[0][0];
  const feature = portfolio.features
    .find((one) => one.properties.permitRef === ref);

  global.MASAR_SIGNAL_PHASE = report;
  const html = DeskFile.renderSummary(feature, Analysis.evaluate(feature.properties, Engine));
  assert.ok(html.indexOf('طور الإشارة') === -1,
    'البطاقة تتكلم عن الإشارة حيث لا مصدر يذكر تقاطعاً');
});

test('غياب الملخّص يُسكت البطاقة ولا يُسقطها', () => {
  /* بطاقةٌ صامتة أصدق من تقدير، وأسلم من صفحة تسقط. */
  const feature = portfolio.features[0];
  const saved = global.MASAR_SIGNAL_PHASE;
  delete global.MASAR_SIGNAL_PHASE;
  try {
    const html = DeskFile.renderSummary(feature,
      Analysis.evaluate(feature.properties, Engine));
    assert.ok(html.indexOf('طور الإشارة') === -1, 'البطاقة تعرض القسم بلا بيانات');
    assert.ok(html.length > 100, 'البطاقة سقطت بغياب ملف اختياري');
  } finally {
    global.MASAR_SIGNAL_PHASE = saved;
  }
});

test('المكتب يُحمّل الملخّص', () => {
  const page = fs.readFileSync(path.join(ROOT, 'masar-desk.html'), 'utf8');
  assert.match(page, /data\/signal-phase-impact\.js/,
    'المكتب لا يُحمّل ملخّص طور الإشارة');
});

test('سلامة اللقطة معلنة — والخلل السابق مكتوب لا مطموس', () => {
  /* البصمة المعلَنة في اللقطة لا تطابق حمولتها على `main`، فبوابتها تسقط.
     ولم تُصحَّح هنا لأنها منشورة في قرار ووثائق. والمكتوب بدلها أقوى: أن
     الحمولة مطابقة لنسخة المخبر. */
  const integrity = report.sources[0].integrity;
  assert.strictEqual(integrity.payloadMatchesLabCopy, true,
    'لقطة التقاطعات لا تطابق نسخة المخبر — حُرِّرت');
  assert.strictEqual(integrity.declaredFingerprintStale, true,
    'البصمة صارت مطابقة — احذف هذا التحفّظ وأعد استدعاء البوابة القائمة');
  assert.ok(report.limits.pinnedFingerprintStale.blocks
    .indexOf('build-intersection-context.js') !== -1,
  'أثر الخلل على مولِّد مؤشر السياق غير مكتوب');
});

console.log(`ALL TESTS PASSED (${count})`);
