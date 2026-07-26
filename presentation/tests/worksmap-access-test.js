'use strict';
/**
 * سطح الخريطة العام: الوصول والبحث والمرجع والرمز والتوقيت.
 * ---------------------------------------------------------------------------
 * ما يُختبر هنا ليس أن الشيفرة تعمل، بل أن ثمانية أعطال معروفة لا تعود:
 * بحثٌ يسقط على إملاء الساكن، ومرجعٌ داخلي يُقدَّم مرجعاً منشوراً، وخريطةٌ لا
 * يبلغها Tab، وأيقونةٌ احتياطية تبتلع نوعَ العمل، وفترةُ «اليوم» بتوقيت مدينة
 * أخرى، وحدودٌ تنكسر على هندسة مركّبة. كل واحد منها كان يعمل «تقريباً» فمرّ.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const Data = require(path.join(ROOT, 'athar-worksmap-data.js'));
const Panel = require(path.join(ROOT, 'athar-worksmap-panel.js'));
const Layers = require(path.join(ROOT, 'athar-worksmap-layers.js'));
const Interactions = require(path.join(ROOT, 'athar-worksmap-interactions.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const html = fs.readFileSync(path.join(ROOT, 'athar-map.html'), 'utf8');
const portfolio = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'city-portfolio.geojson'), 'utf8')
);
const records = Data.normalizeWorks(portfolio).features;

// الاختيار بالخاصية لا بالموضع: مولّد المحفظة يُعاد تشغيله، وترتيب المصفوفة
// ليس عقداً — تثبيتُ الاختبار على `records[0]` يسقط على أول إعادة توليد.
const pick = (fn, label) => {
  const found = records.filter(fn)[0];
  assert.ok(found, `لا سجل في المحفظة يحقق: ${label}`);
  return found.properties;
};
const REFERENCED = pick((f) => f.properties.permitRef === 'BLD-2026-0001', 'permitRef=BLD-2026-0001');
const ROADWORK = pick((f) => f.properties.group === 'roadworks', 'group=roadworks');

/* ============ (١) البحث يطابق إملاء الساكن ============ */

ok('التطبيع يوحّد الهمزة والتاء المربوطة والألف المقصورة', () => {
  assert.strictEqual(Data.normalizeArabic('أبو عبيدة'), 'ابو عبيده');
  assert.strictEqual(Data.normalizeArabic('إبراهيم'), 'ابراهيم');
  assert.strictEqual(Data.normalizeArabic('آل سعود'), 'ال سعود');
  assert.strictEqual(Data.normalizeArabic('مصطفى'), 'مصطفي');
  assert.strictEqual(Data.normalizeArabic('مسؤول'), 'مسءول');
  assert.strictEqual(Data.normalizeArabic('قائم'), 'قاءم');
});

ok('التطبيع يحذف التشكيل والتطويل ويكبس المسافات', () => {
  assert.strictEqual(Data.normalizeArabic('عُبَيْدَة'), 'عبيده');
  assert.strictEqual(Data.normalizeArabic('طريـــق'), 'طريق');
  assert.strictEqual(Data.normalizeArabic('  طريق   الملك   فهد  '), 'طريق الملك فهد');
});

ok('اللاتينية تُخفَّض فيتطابق المرجع بأي حالة أحرف', () => {
  assert.strictEqual(Data.normalizeArabic('BLD-2026-0071'), 'bld-2026-0071');
});

ok('«ابو عبيدة» بلا همزة تجد ما تجده «أبو عبيدة» — العطل الأصلي', () => {
  // العطل المرصود حياً: المقارنة الخام أعادت صفراً على الأولى ونتيجةً على
  // الثانية. من يكتب بلا همزة — وهو الأغلب — كان يُقال له «لا يوجد».
  const bare = Data.filterRecords(records, { query: 'ابو عبيدة' });
  const hamza = Data.filterRecords(records, { query: 'أبو عبيدة' });
  assert.ok(bare.length > 0, 'البحث بلا همزة ما زال يعيد صفراً');
  assert.strictEqual(bare.length, hamza.length, 'الإملاءان يعطيان عددين مختلفين');
  assert.ok(bare[0].properties.street.indexOf('أبو عبيدة') !== -1);
});

ok('التطبيع يطال الطرفين: الهاء تجد التاء المربوطة أيضاً', () => {
  const plain = Data.filterRecords(records, { query: 'ابو عبيده' });
  assert.ok(plain.length > 0, 'الهاء لا تطابق التاء المربوطة في البيانات');
});

ok('البحث يطابق المرجع المنشور بأي حالة أحرف', () => {
  const upper = Data.filterRecords(records, { query: 'BLD-2026-0071' });
  const lower = Data.filterRecords(records, { query: 'bld-2026-0071' });
  assert.strictEqual(upper.length, 1, 'المرجع لا يطابق سجلاً واحداً');
  assert.strictEqual(lower.length, 1, 'المرجع حسّاس لحالة الأحرف');
  assert.strictEqual(upper[0].properties.permitRef, lower[0].properties.permitRef);
});

ok('بحث فارغ يعيد كل شيء ولا يفلتر', () => {
  assert.strictEqual(Data.filterRecords(records, { query: '   ' }).length, records.length);
  assert.strictEqual(Data.filterRecords(records, {}).length, records.length);
});

ok('صفحة الخريطة تستدعي المطابِق المُطبَّع لا المقارنة الخام', () => {
  assert.ok(html.indexOf('Data.filterRecords') !== -1, 'الصفحة لا تستعمل مرشّح الوحدة');
  assert.ok(!/String\(p\.street[^)]*\)\.indexOf/.test(html), 'المقارنة الخام باقية في الصفحة');
});

/* ============ (٢) المرجع المنشور رقم التصريح ============ */

ok('التطبيع يحمل permitRef ويبقي المفتاح الداخلي للربط', () => {
  assert.strictEqual(REFERENCED.permitRef, 'BLD-2026-0001');
  assert.ok(/^p\d+$/.test(REFERENCED.id), `المفتاح الداخلي ضاع أو تبدّل: ${REFERENCED.id}`);
  assert.notStrictEqual(REFERENCED.id, REFERENCED.permitRef, 'المفتاحان انصهرا في واحد');
});

ok('كل سجل في المحفظة يحمل مرجعاً منشوراً', () => {
  const missing = records.filter((f) => !/^BLD-/.test(f.properties.permitRef));
  assert.deepStrictEqual(missing.map((f) => f.properties.id), [], 'سجلات بلا رقم تصريح');
});

ok('البطاقة تعرض رقم التصريح تحت «المرجع» لا مفتاح المخزن', () => {
  const out = Interactions.popupHtml(REFERENCED);
  assert.ok(/المرجع<\/dt><dd>BLD-2026-0001<\/dd>/.test(out), '«المرجع» لا يحمل رقم التصريح');
  assert.ok(out.indexOf('>' + REFERENCED.id + '<') === -1, 'المفتاح الداخلي ما زال معروضاً');
});

ok('البطاقة تعود إلى المفتاح حين لا يوجد رقم تصريح', () => {
  const out = Interactions.popupHtml({ id: 'W-9' });
  assert.ok(/المرجع<\/dt><dd>W-9<\/dd>/.test(out), 'لا بديل حين يغيب رقم التصريح');
});

ok('permitRef يمر بترميز HTML كبقية الحقول', () => {
  const out = Interactions.popupHtml({ permitRef: '<img src=x onerror=alert(1)>' });
  assert.ok(out.indexOf('<img') === -1, 'تسرّب وسم من المرجع');
});

/* ============ (٣) الوصول بلوحة المفاتيح ============ */

ok('القائمة تصيّر صفاً واحداً لكل سجل معروض', () => {
  const shown = records.slice(0, 7).map((f) => f.properties);
  const out = Panel.renderRecords(shown, Layers.LAYER_GROUPS);
  assert.strictEqual((out.match(/<button/g) || []).length, shown.length);
  assert.strictEqual((out.match(/<li>/g) || []).length, shown.length);
});

ok('كل صف زرٌّ حقيقي يحمل معرّف سجله', () => {
  const shown = records.slice(0, 5).map((f) => f.properties);
  const out = Panel.renderRecords(shown, Layers.LAYER_GROUPS);
  shown.forEach((record) => {
    assert.ok(out.indexOf('data-id="' + record.id + '"') !== -1, `صف بلا معرّف: ${record.id}`);
  });
  assert.ok(out.indexOf('type="button"') !== -1, 'الزر بلا نوع صريح — سيُرسل النموذج');
  assert.ok(out.indexOf('<div class="wm-record"') === -1, 'الصف div لا زر — لا يأخذ التركيز');
});

ok('الصف يذكر المجموعة والمرجع المنشور — يُقرأ صوتياً بلا خريطة', () => {
  const out = Panel.renderRecords([ROADWORK], Layers.LAYER_GROUPS);
  assert.ok(out.indexOf('أعمال الطرق') !== -1, 'اسم المجموعة مفقود من الصف');
  assert.ok(out.indexOf(ROADWORK.permitRef) !== -1, 'المرجع مفقود من الصف');
  assert.ok(out.indexOf(ROADWORK.title) !== -1, 'العنوان مفقود من الصف');
});

ok('القائمة تعلن الفراغ بدل أن تُترك بيضاء', () => {
  const out = Panel.renderRecords([], Layers.LAYER_GROUPS);
  assert.ok(out.indexOf('لا سجل') !== -1, 'لا رسالة فراغ');
  assert.ok(out.indexOf('<button') === -1);
});

ok('القائمة لا تحقن HTML من بيانات السجل', () => {
  const out = Panel.renderRecords(
    [{ id: '"><script>x</script>', title: '<img src=x onerror=alert(1)>', group: 'roadworks' }],
    Layers.LAYER_GROUPS
  );
  assert.ok(out.indexOf('<script>') === -1, 'تسرّب وسم من المعرّف');
  assert.ok(out.indexOf('<img') === -1, 'تسرّب وسم من العنوان');
});

ok('القائمة تتبع الفترة والطبقات والبحث معاً لا واحداً منها', () => {
  const range = Panel.toEpochRange('today', Date.UTC(2026, 6, 24, 12, 0, 0));
  const byDate = Data.filterRecords(records, { range: range });
  const withoutPois = Data.filterRecords(records, { range: range, hiddenGroups: { pois: true } });
  const searched = Data.filterRecords(records, { range: range, query: 'ابو عبيدة' });

  assert.ok(byDate.length < records.length, 'الفترة لا تُنقص شيئاً — الفلترة معطّلة');
  assert.ok(withoutPois.length <= byDate.length, 'إخفاء مجموعة لا يُنقص القائمة');
  assert.strictEqual(
    withoutPois.filter((f) => f.properties.group === 'pois').length, 0,
    'مجموعة مخفية ما زالت مسرودة'
  );
  assert.ok(searched.length <= byDate.length, 'البحث لا يضيّق داخل الفترة');
});

ok('الصفحة تعلن القائمة وتغذّيها من نفس المرشّح', () => {
  assert.ok(html.indexOf('id="wmRecordsBody"') !== -1, 'حاوية القائمة مفقودة');
  assert.ok(html.indexOf('renderRecords') !== -1, 'الصفحة لا تصيّر القائمة');
  assert.ok(html.indexOf('visibleFeatures()') !== -1, 'القائمة لا تقرأ المعروض فعلاً');
});

ok('الخريطة لا تَعِد بما لا تفعل: role="application" أُزيلت', () => {
  // الدور يَعِد القارئ الصوتي بأن كل مفتاح يُدار داخل العنصر، فيصمت عن بنيته.
  // وعده كاذب ما دام ١٥٠ سجلاً لا يبلغها Tab. الآن منطقةٌ موصوفة، والوصول
  // الحقيقي في القائمة المجاورة — والوصف يقول ذلك صراحة.
  assert.ok(html.indexOf('role="application"') === -1, 'الوعد الكاذب باقٍ');
  assert.ok(/id="map"[\s\S]{0,200}role="region"/.test(html), 'الخريطة بلا دور معلن');
  assert.ok(html.indexOf('aria-describedby="wmMapNote"') !== -1, 'الخريطة بلا وصف يحيل للقائمة');
  assert.ok(html.indexOf('id="wmMapNote"') !== -1, 'نص الوصف مفقود');
});

/* ============ (٤) لكل نوع رمزه ============ */

const sprite = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vendor', 'sprite', 'sprite.json'), 'utf8')
);

/** يحاكي `coalesce(image(prefix + subtype), image(fallback))` خارج المتصفح. */
function resolveIcon(iconImage, subtype) {
  if (typeof iconImage === 'string') return { name: iconImage, fellBack: false };
  const prefix = iconImage[1][1][1];
  const fallback = iconImage[2][1];
  const wanted = prefix + subtype;
  return sprite[wanted]
    ? { name: wanted, fellBack: false }
    : { name: fallback, fellBack: true };
}

function configFor(groupId, subtype) {
  for (const group of Layers.LAYER_GROUPS) {
    if (group.id !== groupId) continue;
    for (const config of group.configs) {
      if (!config.subtype || config.subtype === subtype) return config;
    }
  }
  return null;
}

// الاحتياط المقصود وحده: المخروط هو رسم «أعمال طرق عادية». ما عداه احتياطٌ
// يعني أن نوعاً فقد رمزه — وذلك ما كان يبتلع ٢٢ صيانةً و١٦ نقطةَ اهتمام.
const INTENDED_FALLBACK = { 'roadworks/default': 'roadworks' };

ok('كل رمز تحتاجه البيانات موجود في الـ atlas', () => {
  for (const name of [
    'works-maintenance', 'works-development', 'works-emergency',
    'poi-default', 'poi-maintenance', 'poi-development', 'poi-emergency',
  ]) {
    assert.ok(sprite[name], `أيقونة ناقصة: ${name}`);
  }
});

ok('لا نوع في المحفظة يقع على رمز احتياطي غير مقصود', () => {
  const fellBack = {};
  for (const feature of portfolio.features) {
    const { group, subtype } = feature.properties;
    const config = configFor(group, subtype);
    assert.ok(config, `لا طبقة ترسم ${group}/${subtype}`);

    const resolved = resolveIcon(config.iconImage, subtype);
    assert.ok(sprite[resolved.name], `الرمز ${resolved.name} غير موجود في الـ atlas`);
    if (resolved.fellBack) fellBack[`${group}/${subtype}`] = resolved.name;
  }
  assert.deepStrictEqual(fellBack, INTENDED_FALLBACK,
    'أنواع تسقط على رمز احتياطي بلا قصد');
});

ok('الرسم يقول النوع واللون يقول المجموعة', () => {
  // نفس الرسم في `works-*` و `poi-*` بلونين: الشكل يحمل نوع العمل والشارة
  // تحمل المجموعة، فيبقى لون صف الدليل هو لون الشارة على الخريطة.
  const icons = path.join(ROOT, 'icons');
  const amber = Layers.WORKS_COLORS.roadworks;
  const green = Layers.WORKS_COLORS.poi;

  assert.ok(fs.readFileSync(path.join(icons, 'works-maintenance.svg'), 'utf8').includes(amber),
    'رمز الصيانة في أعمال الطرق ليس بلون المجموعة');
  ['poi-default', 'poi-maintenance', 'poi-development', 'poi-emergency'].forEach((name) => {
    const svg = fs.readFileSync(path.join(icons, name + '.svg'), 'utf8');
    assert.ok(svg.includes(green), `${name} ليس بلون مجموعة نقاط الاهتمام`);
    assert.ok(!svg.includes(amber), `${name} يحمل لون مجموعة أخرى`);
  });
});

ok('الأيقونة 32 بشارة 26 وظل مخبوز — قالب واحد لكل الطقم', () => {
  for (const name of ['works-maintenance', 'poi-default', 'poi-maintenance',
    'poi-development', 'poi-emergency']) {
    const svg = fs.readFileSync(path.join(ROOT, 'icons', name + '.svg'), 'utf8');
    assert.ok(svg.indexOf('viewBox="0 0 32 32"') !== -1, `${name}: لوحة غير قياسية`);
    assert.ok(svg.indexOf('r="10.9"') !== -1, `${name}: قطر الشارة غير قياسي`);
    assert.ok(svg.indexOf('stroke-width="2.4"') !== -1, `${name}: حلقة الشارة غير قياسية`);
    assert.ok(svg.indexOf('radialGradient') !== -1, `${name}: بلا ظل — تلتصق بالخريطة`);
  }
});

/* ============ (٦) حدّ اليوم بتوقيت الرياض ============ */

const HOUR = 3600 * 1000;
const RIYADH_MIDNIGHT = (y, m, d) => Date.UTC(y, m, d) - 3 * HOUR;

ok('الساعة الواحدة ليلاً بالرياض تقع في يومها هي لا في الأمس', () => {
  // 22:00 UTC من الرابع والعشرين = 01:00 من الخامس والعشرين بالرياض. الحساب
  // القديم بـ UTC كان يعطي نافذة الرابع والعشرين: خريطةُ أمسٍ لعامل الليل.
  const range = Panel.toEpochRange('today', Date.UTC(2026, 6, 24, 22, 0, 0));
  assert.strictEqual(range.from, RIYADH_MIDNIGHT(2026, 6, 25), 'بداية النافذة يومٌ سابق');
  assert.strictEqual(range.to, RIYADH_MIDNIGHT(2026, 6, 26));
  assert.ok(Date.UTC(2026, 6, 24, 22, 0, 0) >= range.from, 'اللحظة نفسها خارج نافذتها');
});

ok('الثانية عشرة إلا دقيقة ليلاً تبقى في اليوم المنصرم', () => {
  const range = Panel.toEpochRange('today', RIYADH_MIDNIGHT(2026, 6, 25) - 60000);
  assert.strictEqual(range.from, RIYADH_MIDNIGHT(2026, 6, 24));
});

ok('«هذا الأسبوع» و«هذا الشهر» يبدآن من الحدّ نفسه', () => {
  const at = Date.UTC(2026, 6, 24, 22, 0, 0);
  const day = Panel.toEpochRange('today', at);
  assert.strictEqual(Panel.toEpochRange('week', at).from, day.from);
  assert.strictEqual(Panel.toEpochRange('month', at).from, day.from);
  assert.strictEqual(Panel.toEpochRange('week', at).to, day.from + 7 * 24 * HOUR);
});

ok('النتيجة واحدة مهما كانت منطقة المتصفح — الحتمية باقية', () => {
  // الثبات كان نيّة الحساب الأصلي بـ UTC ويجب أن يبقى بعد التثبيت على +٣.
  const probe = 'const P=require(' + JSON.stringify(path.join(ROOT, 'athar-worksmap-panel.js'))
    + ');process.stdout.write(String(P.toEpochRange("today",Date.UTC(2026,6,24,22,0,0)).from));';
  const run = (tz) => execFileSync(process.execPath, ['-e', probe], {
    env: Object.assign({}, process.env, { TZ: tz }), encoding: 'utf8',
  });
  const far = run('Pacific/Kiritimati');
  const near = run('Pacific/Niue');
  assert.strictEqual(far, near, `+14 تعطي ${far} و−11 تعطي ${near}`);
  assert.strictEqual(Number(far), RIYADH_MIDNIGHT(2026, 6, 25));
});

/* ============ (٧) الدليل واللوحة يتفقان ============ */

ok('الدليل صفٌّ لكل مجموعة في اللوحة — مصدر واحد فلا انحراف', () => {
  const legend = Panel.renderLegend(Layers.LAYER_GROUPS);
  const toggles = Panel.render(Layers.LAYER_GROUPS);
  assert.strictEqual((legend.match(/wm-legend-row/g) || []).length, Layers.LAYER_GROUPS.length);
  for (const group of Layers.LAYER_GROUPS) {
    assert.ok(legend.indexOf(group.label) !== -1, `الدليل بلا صف لـ ${group.label}`);
    assert.ok(legend.indexOf(group.swatch) !== -1, `الدليل بلا لون ${group.label}`);
    assert.ok(toggles.indexOf(group.label) !== -1, `اللوحة بلا مربع لـ ${group.label}`);
  }
});

ok('الصفحة لا تكتب صفوف الدليل بيدها', () => {
  assert.ok(html.indexOf('renderLegend') !== -1, 'الدليل لا يُبنى من سجل الطبقات');
  assert.ok(html.indexOf('wm-legend-row') === -1, 'صفوف دليل مكتوبة يدوياً باقية في الصفحة');
});

/* ============ (٨) الحدود تتحمل الهندسة المركّبة ============ */

ok('الحدود تمشي MultiLineString ولا تنتج NaN', () => {
  const bounds = Data.boundsOf([{
    geometry: {
      type: 'MultiLineString',
      coordinates: [[[46.6, 24.7], [46.8, 24.9]], [[46.5, 24.6], [46.9, 25.0]]],
    },
  }]);
  assert.deepStrictEqual(bounds, [[46.5, 24.6], [46.9, 25.0]]);
});

ok('الحدود تمشي Polygon و MultiPolygon أيضاً', () => {
  const polygon = Data.boundsOf([{
    geometry: { type: 'Polygon', coordinates: [[[46.6, 24.7], [46.8, 24.7], [46.8, 24.9], [46.6, 24.7]]] },
  }]);
  assert.deepStrictEqual(polygon, [[46.6, 24.7], [46.8, 24.9]]);

  const multi = Data.boundsOf([{
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[[[46.1, 24.1], [46.2, 24.2], [46.1, 24.1]]],
        [[[46.9, 24.9], [47.0, 25.0], [46.9, 24.9]]]],
    },
  }]);
  assert.deepStrictEqual(multi, [[46.1, 24.1], [47.0, 25.0]]);
});

ok('الحدود تخلط النقطة والخط في مجموعة واحدة', () => {
  const bounds = Data.boundsOf([
    { geometry: { type: 'Point', coordinates: [46.7, 24.8] } },
    { geometry: { type: 'LineString', coordinates: [[46.5, 24.6], [46.6, 24.7]] } },
  ]);
  assert.deepStrictEqual(bounds, [[46.5, 24.6], [46.7, 24.8]]);
});

ok('الحدود تعيد null على الفارغ ولا ترمي على التالف', () => {
  assert.strictEqual(Data.boundsOf([]), null);
  assert.strictEqual(Data.boundsOf(null), null);
  assert.strictEqual(Data.boundsOf([{ geometry: null }, {}]), null);
});

ok('حدود المحفظة الحقيقية أرقام منتهية داخل الرياض', () => {
  const bounds = Data.boundsOf(records);
  bounds.forEach((corner) => corner.forEach((value) => {
    assert.ok(Number.isFinite(value), `حدّ غير منتهٍ: ${value}`);
  }));
  assert.ok(bounds[0][0] > 46 && bounds[1][0] < 48, 'خط الطول خارج الرياض');
  assert.ok(bounds[0][1] > 24 && bounds[1][1] < 25.5, 'خط العرض خارج الرياض');
});

ok('الصفحة تؤطّر البحث بالمشي المركّب لا بالمسطّح', () => {
  assert.ok(html.indexOf('Data.boundsOf') !== -1, 'الصفحة ما زالت تمشي الإحداثيات بنفسها');
  assert.ok(html.indexOf('coords.forEach') === -1, 'المشي المسطّح باقٍ');
});

console.log(`\n${passed} اختبارات نجحت`);
