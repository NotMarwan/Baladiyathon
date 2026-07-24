'use strict';
const assert = require('assert');
const path = require('path');
const Panel = require(path.join(__dirname, '..', 'athar-worksmap-panel.js'));
const Layers = require(path.join(__dirname, '..', 'athar-worksmap-layers.js'));

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

ok('اللوحة تعرض كل مجموعة بعنوان عربي', () => {
  const html = Panel.render(Layers.LAYER_GROUPS);
  for (const group of Layers.LAYER_GROUPS) {
    assert.ok(html.indexOf(group.label) !== -1, `عنوان ناقص: ${group.label}`);
  }
});

ok('كل مجموعة لها مربع اختيار مفعّل بمعرّفها', () => {
  const html = Panel.render(Layers.LAYER_GROUPS);
  for (const group of Layers.LAYER_GROUPS) {
    assert.ok(html.indexOf(`data-group="${group.id}"`) !== -1, `مربع ناقص: ${group.id}`);
  }
  assert.ok(html.indexOf('checked') !== -1);
});

ok('اللوحة تعرض خيارات الفترة الأربع', () => {
  const html = Panel.render(Layers.LAYER_GROUPS);
  for (const label of ['اليوم', 'هذا الأسبوع', 'هذا الشهر', 'كل التواريخ']) {
    assert.ok(html.indexOf(label) !== -1, `خيار ناقص: ${label}`);
  }
});

ok('اللوحة لا تحقن HTML من العناوين', () => {
  const html = Panel.render([{ id: 'x', label: '<img src=x onerror=alert(1)>', swatch: '#fff', configs: [] }]);
  assert.ok(html.indexOf('<img') === -1, 'تسرب HTML من العنوان');
});

ok('نطاق «اليوم» يمتد من منتصف ليل إلى منتصف ليل', () => {
  const range = Panel.toEpochRange('today', Date.UTC(2026, 6, 24, 12, 0, 0));
  assert.strictEqual(range.from, Date.UTC(2026, 6, 24));
  assert.strictEqual(range.to, Date.UTC(2026, 6, 25));
});

ok('«كل التواريخ» يعيد null فلا يُطبق فلتر زمني', () => {
  assert.strictEqual(Panel.toEpochRange('all', Date.now()), null);
});

console.log(`\n${passed} اختبارات نجحت`);
