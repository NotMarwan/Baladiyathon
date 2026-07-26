'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'masar-prototype.html'), 'utf8');

ok('النموذج يحمّل وحدات الخريطة الجديدة', () => {
  for (const file of [
    'masar-worksmap-style.js', 'masar-worksmap-layers.js',
    'masar-worksmap-data.js', 'masar-worksmap.js', 'masar-worksmap-panel.js',
  ]) {
    assert.ok(html.indexOf(file) !== -1, `غير محمّل: ${file}`);
  }
});

ok('الخريطتان القديمتان محذوفتان من القرص ومن النموذج', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'masar-glmap.js')), 'masar-glmap.js ما زال موجوداً');
  assert.ok(!fs.existsSync(path.join(ROOT, 'masar-ownedmap.js')), 'masar-ownedmap.js ما زال موجوداً');
  assert.ok(html.indexOf('MasarGlMap') === -1, 'إشارة متبقية إلى MasarGlMap');
  assert.ok(html.indexOf('MasarOwnedMap') === -1, 'إشارة متبقية إلى MasarOwnedMap');
});

ok('Leaflet أُزيل بالكامل', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'vendor', 'leaflet.js')), 'vendor/leaflet.js باقٍ');
  assert.ok(html.indexOf('leaflet') === -1, 'إشارة متبقية إلى leaflet في النموذج');
});

ok('حاوية اللوحة موجودة', () => {
  assert.ok(html.indexOf('id="masar-map-panel"') !== -1);
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
