'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'athar-prototype.html'), 'utf8');

ok('النموذج يحمّل وحدات الخريطة الجديدة', () => {
  for (const file of [
    'athar-worksmap-style.js', 'athar-worksmap-layers.js',
    'athar-worksmap-data.js', 'athar-worksmap.js', 'athar-worksmap-panel.js',
  ]) {
    assert.ok(html.indexOf(file) !== -1, `غير محمّل: ${file}`);
  }
});

ok('الخريطتان القديمتان محذوفتان من القرص ومن النموذج', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'athar-glmap.js')), 'athar-glmap.js ما زال موجوداً');
  assert.ok(!fs.existsSync(path.join(ROOT, 'athar-ownedmap.js')), 'athar-ownedmap.js ما زال موجوداً');
  assert.ok(html.indexOf('AtharGlMap') === -1, 'إشارة متبقية إلى AtharGlMap');
  assert.ok(html.indexOf('AtharOwnedMap') === -1, 'إشارة متبقية إلى AtharOwnedMap');
});

ok('Leaflet أُزيل بالكامل', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'vendor', 'leaflet.js')), 'vendor/leaflet.js باقٍ');
  assert.ok(html.indexOf('leaflet') === -1, 'إشارة متبقية إلى leaflet في النموذج');
});

ok('حاوية اللوحة موجودة', () => {
  assert.ok(html.indexOf('id="athar-map-panel"') !== -1);
});

ok('لا رابط خارجي داخل وسوم script أو link في النموذج', () => {
  const tags = html.match(/<(script|link)[^>]*>/g) || [];
  for (const tag of tags) {
    assert.ok(!/https?:\/\//.test(tag), `مورد خارجي: ${tag}`);
  }
});

ok('كل ملفات الخريطة المشار إليها موجودة فعلاً', () => {
  const refs = html.match(/(?:src|href)="([^"]+\.(?:js|css))"/g) || [];
  for (const ref of refs) {
    const file = ref.match(/"([^"]+)"/)[1];
    if (file.indexOf('://') !== -1) continue;
    assert.ok(fs.existsSync(path.join(ROOT, file)), `ملف مفقود: ${file}`);
  }
});

console.log(`\n${passed} اختبارات نجحت`);
