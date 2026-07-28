'use strict';
/**
 * بوابات سلامة البديل — `masar-detour-policy.js`.
 * ---------------------------------------------------------------------------
 * ما يُختبر: أن الحكم **بوابة لا وزن**. عقوبة اليسار في التوجيه تجعل الخطر
 * مكلفاً؛ هذه الوحدة تجعله مرفوضاً مسمّىً بموضعه وسببه. فالاختبارات هندسية
 * حتمية على رسمٍ صناعي صغير (كل بوابة لها تقاطع مبني لها)، ثم تمريرة دخانٍ
 * على محفظة المدينة الحقيقية تضمن أن الزينة لا تكسر شكل الناتج ولا تناقض
 * أحكام الحمل المحسوبة أصلاً.
 *
 * اصطلاح الرسم مأخوذ من `masar-city-routing.js` حرفياً: الضلع
 * `[a, b, طول, زمن حر, حارات, اتجاه, صنف, اتجاه الخروج من a, اتجاه الخروج
 * من b, اسم, رؤوس]`، والسالب في انحراف الانعطاف يسار (مُثبَت بقياسٍ في
 * `city-routing-test.js` — «اليسار أغلى من اليمين»).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const Routing = require(path.join(ROOT, 'masar-city-routing.js'));
const Policy = require(path.join(ROOT, 'masar-detour-policy.js'));

/* ---- رسم صناعي: كل بوابة لها تقاطعها ---- */

const PRIMARY = 0; // شرياني سريع
const LOCAL = 1;   // سكني

/**
 * A→B شرقاً ثم B→N شمالاً: يسارٌ عند B. الأصناف والتحكم يتغيّران في كل
 * اختبار عبر `build` — الهندسة واحدة والسياسة هي المتغيّر.
 */
function build(overrides) {
  const graph = {
    nodes: [[46.700, 24.710], [46.710, 24.710], [46.710, 24.720], [46.720, 24.710]],
    edges: [
      // A→B شرقاً: خروج a = 90، خروج b = 270 (عكسه)
      [0, 1, 1000, 1, 2, 0, PRIMARY, 90, 270, 0, []],
      // B→N شمالاً
      [1, 2, 1000, 1, 2, 0, PRIMARY, 0, 180, 1, []],
      // B→C شرقاً (استمرار مستقيم)
      [1, 3, 1000, 1, 2, 0, PRIMARY, 90, 270, 0, []],
    ],
    inMain: [1, 1, 1, 1],
    restrictions: [],
    control: [0, 0, 0, 0],
    names: ['الشارع الشرقي', 'الشارع الشمالي'],
    metadata: {
      classes: [
        { name: 'primary', kmh: 70, lanes: 2, capacity: 1800, aadt: 20000 },
        { name: 'residential', kmh: 30, lanes: 1, capacity: 900, aadt: 2000 },
      ],
      turn: { straightDeg: 25, uTurnDeg: 135, rightSec: 4, leftSec: 11, uTurnSec: 25 },
      controlSeconds: [0, 6, 22],
    },
  };
  Object.keys(overrides || {}).forEach((key) => { graph[key] = overrides[key]; });
  return Routing.prepare(graph);
}

/** حالتا العبور: A→B (الضلع 0 زوجياً) ثم B→N (الضلع 1 زوجياً). */
const LEFT_TURN_STATES = [0, 2];
/** A→B ثم B→C: مستقيم — لا انعطاف يُحاسَب. */
const STRAIGHT_STATES = [0, 4];

/* ---- بوابة اليسار غير المحمي ---- */

ok('يسار غير محمي عند تقاطع عارٍ على شرياني = رفض مسمّى بموضعه', () => {
  const prepared = build();
  const audit = Policy.auditRoute(prepared, { states: LEFT_TURN_STATES }, {});
  assert.strictEqual(audit.verdict, 'fail');
  const hit = audit.violations.find((v) => v.rule === Policy.RULES.UNPROTECTED_LEFT);
  assert.ok(hit, 'لا مخالفة يسار');
  assert.strictEqual(hit.place.node, 1, 'الموضع ليس العقدة B');
  assert.ok(Array.isArray(hit.place.at) && hit.place.at.length === 2, 'بلا إحداثيات تُرسم');
  assert.strictEqual(hit.place.from, 'الشارع الشرقي');
  assert.strictEqual(hit.place.to, 'الشارع الشمالي');
});

ok('نفس اليسار تحت إشارة = محمي، لا مخالفة', () => {
  const prepared = build({ control: [0, 2, 0, 0] });
  const audit = Policy.auditRoute(prepared, { states: LEFT_TURN_STATES }, {});
  assert.strictEqual(audit.verdict, 'pass');
  assert.strictEqual(audit.violations.length, 0);
});

ok('يسار داخل شبكة سكنية صرفة مقبول — منعه يمنع كل تحويلة حيّ', () => {
  const prepared = build();
  // الصنفان سكنيان: الانعطاف بين شارعي حيّ
  prepared.graph.edges[0][6] = LOCAL;
  prepared.graph.edges[1][6] = LOCAL;
  const audit = Policy.auditRoute(prepared, { states: LEFT_TURN_STATES }, {});
  assert.strictEqual(audit.verdict, 'pass');
});

ok('المرور المستقيم لا يوقظ أي بوابة', () => {
  const prepared = build();
  const audit = Policy.auditRoute(prepared, { states: STRAIGHT_STATES }, {});
  assert.strictEqual(audit.verdict, 'pass');
});

/* ---- بوابة الاندماج الحاد ---- */

ok('اندماج بزاوية حادة يميناً في طريق سريع بلا تحكم = رفض', () => {
  const prepared = build();
  // خروج B→N باتجاه 210: الانحراف عن الشرق (90) = +120 يمين حاد
  prepared.graph.edges[1][7] = 210;
  prepared.graph.edges[1][8] = 30;
  const audit = Policy.auditRoute(prepared, { states: LEFT_TURN_STATES }, {});
  assert.strictEqual(audit.verdict, 'fail');
  const hit = audit.violations.find((v) => v.rule === Policy.RULES.SHARP_MERGE);
  assert.ok(hit, 'لا مخالفة اندماج حاد');
  assert.ok(/120/.test(hit.text), `الزاوية لا تظهر في النص: ${hit.text}`);
});

ok('نفس الزاوية على شارع بطيء لا تُرفض — الخطر من سرعة المدخول', () => {
  const prepared = build();
  prepared.graph.edges[1][7] = 210;
  prepared.graph.edges[1][8] = 30;
  prepared.graph.edges[1][6] = LOCAL; // كم/س 30 — تحت حد السرعة
  prepared.graph.edges[0][6] = LOCAL; // ولا شرياني في الانعطاف فلا بوابة يسار
  const audit = Policy.auditRoute(prepared, { states: LEFT_TURN_STATES }, {});
  assert.strictEqual(audit.verdict, 'pass');
});

/* ---- بوابة الدوران الكامل ---- */

ok('دوران كامل عند عقدة عارية = تحذير لا رفض', () => {
  const prepared = build();
  // العودة على نفس الضلع: A→B ثم B→A (الحالة الفردية للضلع 0)
  const audit = Policy.auditRoute(prepared, { states: [0, 1] }, {});
  assert.strictEqual(audit.verdict, 'warn');
  assert.ok(audit.violations.some((v) => v.rule === Policy.RULES.U_TURN));
});

/* ---- بوابات الحمل: قراءة loadRoute لا حساب جديد ---- */

ok('فيضان شارع سكني بعد التحويل = رفض باسم الشارع ونسبته', () => {
  const prepared = build({ control: [0, 2, 0, 0] }); // الإشارة تعزل بوابة الحمل
  const audit = Policy.auditRoute(prepared, {
    states: STRAIGHT_STATES,
    load: {
      minorOverflows: true, minorBindingStreet: 'شارع البيوت', minorMaxRatioAfter: 1.42,
      overflows: true, bindingStreet: 'شارع البيوت', maxRatioAfter: 1.42,
    },
  }, {});
  assert.strictEqual(audit.verdict, 'fail');
  const hit = audit.violations.find((v) => v.rule === Policy.RULES.RESIDENTIAL_OVERFLOW);
  assert.ok(hit, 'لا مخالفة فيضان سكني');
  assert.ok(hit.text.indexOf('شارع البيوت') !== -1);
  assert.ok(/1\.42/.test(hit.text));
  // الفيضان السكني يبتلع تحذير الشرياني — لا حكمان على رقم واحد
  assert.ok(!audit.violations.some((v) => v.rule === Policy.RULES.ARTERIAL_OVERFLOW));
});

ok('فيضان شرياني وحده = تحذير — الطريق بُني ليحمل', () => {
  const prepared = build();
  const audit = Policy.auditRoute(prepared, {
    states: STRAIGHT_STATES,
    load: { minorOverflows: false, overflows: true, bindingStreet: 'الشريان', maxRatioAfter: 1.1 },
  }, {});
  assert.strictEqual(audit.verdict, 'warn');
  assert.ok(audit.violations.some((v) => v.rule === Policy.RULES.ARTERIAL_OVERFLOW));
});

/* ---- بوابة هبوط الدرجة ---- */

ok('إغلاق شرياني وبديل يدخل الحيّ = تحذير يسمّي شوارعه', () => {
  const prepared = build();
  const audit = Policy.auditRoute(prepared, {
    states: STRAIGHT_STATES,
    insideNeighbourhood: true,
    excursion: { streets: ['الأول', 'الثاني'] },
  }, { closedMajor: true });
  assert.strictEqual(audit.verdict, 'warn');
  const hit = audit.violations.find((v) => v.rule === Policy.RULES.CLASS_DROP);
  assert.ok(hit && hit.text.indexOf('الأول') !== -1);
});

ok('نفس البديل حين يكون المغلق سكنياً: لا هبوط درجة', () => {
  const prepared = build();
  const audit = Policy.auditRoute(prepared, {
    states: STRAIGHT_STATES, insideNeighbourhood: true,
  }, { closedMajor: false });
  assert.strictEqual(audit.verdict, 'pass');
});

/* ---- العتبات قابلة للتجاوز — لا رقم مدفون ---- */

ok('رفع حدّ الاندماج فوق الزاوية يسكت البوابة', () => {
  const prepared = build();
  prepared.graph.edges[1][7] = 210;
  prepared.graph.edges[1][8] = 30;
  const audit = Policy.auditRoute(prepared, { states: LEFT_TURN_STATES },
    { options: { sharpMergeDeg: 130 } });
  assert.ok(!audit.violations.some((v) => v.rule === Policy.RULES.SHARP_MERGE));
});

/* ---- التزيين والتصعيد ---- */

ok('audit ينسخ ولا يعدّل في المكان، وescalate يُرفع حين لا بديل يمرّ', () => {
  const prepared = build();
  const result = {
    ok: true,
    banned: { 0: true }, // الضلع 0 شرياني ⇒ closedMajor
    alternatives: [
      { states: LEFT_TURN_STATES, minutes: 5 },
      { states: LEFT_TURN_STATES, minutes: 7 },
    ],
  };
  const audited = Policy.audit(prepared, result);
  assert.notStrictEqual(audited, result, 'أعاد نفس الكائن');
  assert.strictEqual(result.alternatives[0].policy, undefined, 'عدّل الأصل');
  assert.strictEqual(audited.alternatives[0].policy.verdict, 'fail');
  assert.strictEqual(audited.policy.escalate, true);
  assert.strictEqual(audited.policy.passing, 0);
  assert.ok(audited.policy.note.indexOf('عدّل التصريح') !== -1);
});

ok('بديل واحد يمرّ يكفي لإسقاط التصعيد', () => {
  const prepared = build();
  const result = {
    ok: true,
    banned: { 0: true },
    alternatives: [
      { states: LEFT_TURN_STATES, minutes: 5 },
      { states: STRAIGHT_STATES, minutes: 7 },
    ],
  };
  const audited = Policy.audit(prepared, result);
  assert.strictEqual(audited.policy.escalate, false);
  assert.strictEqual(audited.policy.passing, 1);
  assert.strictEqual(audited.policy.note, null);
});

ok('نتيجة فاشلة تمرّ كما هي — لا زينة على لا شيء', () => {
  const prepared = build();
  const result = { ok: false, reason: 'no-detour' };
  assert.strictEqual(Policy.audit(prepared, result), result);
});

/* ---- دخان على المحفظة الحقيقية ---- */

function loadGlobal(file, name) {
  const previous = global.window;
  global.window = {};
  require(path.join(DATA, file));
  const value = global.window[name];
  global.window = previous;
  return value;
}

ok('على شبكة الرياض: الزينة سليمة الشكل ولا تناقض أحكام الحمل', () => {
  const graph = loadGlobal('riyadh-route-graph.js', 'RIYADH_ROUTE_GRAPH');
  const portfolio = JSON.parse(
    fs.readFileSync(path.join(DATA, 'city-portfolio.geojson'), 'utf8'));
  const prepared = Routing.prepare(graph);
  const lines = portfolio.features.filter((f) => f.geometry.type === 'LineString');
  assert.ok(lines.length >= 5, 'المحفظة أصغر من المتوقع');

  let audited = 0;
  for (let i = 0; i < lines.length && audited < 5; i += 1) {
    const result = Routing.alternativesAround(prepared,
      lines[i].geometry.coordinates, { hour: 8, count: 2 });
    if (!result.ok) continue;
    const out = Policy.audit(prepared, result);
    audited += 1;
    out.alternatives.forEach((route) => {
      assert.ok(route.policy, 'بديل بلا حكم');
      assert.ok([Policy.VERDICTS.PASS, Policy.VERDICTS.WARN, Policy.VERDICTS.FAIL]
        .indexOf(route.policy.verdict) !== -1, `حكم غريب: ${route.policy.verdict}`);
      assert.ok(Array.isArray(route.policy.violations));
      // الاتساق مع الحساب القائم: فيضان سكني محسوب ⇒ الحكم رفض حتماً
      if (route.load && route.load.minorOverflows) {
        assert.strictEqual(route.policy.verdict, 'fail',
          'فيضان سكني بلا رفض — البوابة لا تقرأ الحمل');
      }
      route.policy.violations.forEach((v) => {
        assert.ok(v.rule && v.severity && v.text, 'مخالفة ناقصة الحقول');
      });
    });
    assert.strictEqual(typeof out.policy.escalate, 'boolean');
  }
  assert.ok(audited >= 3, `عُيّن ${audited} تصريحاً فقط — الدخان أضيق من أن يطمئن`);
});

console.log(`\n${passed} passed`);
