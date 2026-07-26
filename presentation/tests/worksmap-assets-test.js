'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function ok(name, fn) { fn(); passed += 1; console.log(`  ok - ${name}`); }

// الرسم يقول نوع العمل واللون يقول المجموعة: `works-*` كهرمانية و `poi-*`
// خضراء بنفس الرسوم. الأربعة الأخيرة بلا مستهلك اليوم — مفردات محفوظة، وسببها
// مكتوب في رأس scripts/build-sprite.js لا متروك للتخمين.
const REQUIRED_ICONS = [
  'roadworks', 'works-maintenance', 'works-development', 'works-emergency',
  'closure', 'incident', 'diversion',
  'poi-default', 'poi-maintenance', 'poi-development', 'poi-emergency',
  'poi-information', 'bus-stop', 'poi-parking', 'works-end',
];

ok('sprite: يحوي كل أيقونة يشير إليها سجل الطبقات', () => {
  const sprite = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'vendor', 'sprite', 'sprite.json'), 'utf8')
  );
  for (const icon of REQUIRED_ICONS) {
    assert.ok(Object.keys(sprite).includes(icon), `أيقونة ناقصة: ${icon}`);
  }
});

ok('sprite: لا تتداخل الأيقونات داخل الـ atlas', () => {
  const sprite = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'vendor', 'sprite', 'sprite.json'), 'utf8')
  );
  const boxes = Object.values(sprite).sort((a, b) => a.x - b.x);
  for (let i = 1; i < boxes.length; i += 1) {
    assert.ok(boxes[i].x >= boxes[i - 1].x + boxes[i - 1].width, 'تداخل في الـ atlas');
  }
});

ok('glyphs: النطاق العربي وأشكاله التقديمية موجودة محلياً', () => {
  const dir = path.join(ROOT, 'vendor', 'glyphs', 'Noto Sans Regular');
  for (const range of ['0-255', '1536-1791', '65024-65279']) {
    assert.ok(fs.existsSync(path.join(dir, `${range}.pbf`)), `نطاق ناقص: ${range}`);
  }
});

ok('إضافة RTL محفوظة محلياً وبالبناء المتوافق', () => {
  const file = path.join(ROOT, 'vendor', 'mapbox-gl-rtl-text.js');
  assert.ok(fs.existsSync(file), 'vendor/mapbox-gl-rtl-text.js مفقود');
  assert.ok(fs.statSync(file).size > 50000, 'الملف يبدو مبتوراً');

  const body = fs.readFileSync(file, 'utf8');
  assert.ok(body.indexOf('registerRTLTextPlugin') !== -1, 'الملف لا يسجّل نفسه كإضافة');
  // بناء WebAssembly (0.4.0) يفشل استيراده داخل عامل MapLibre فتنكسر العربية.
  assert.ok(!/WebAssembly|\.wasm\b/.test(body), 'بناء WebAssembly غير متوافق مع MapLibre');
});

ok('الخادم يعرف نوع .pbf', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(server.includes("'.pbf'"), 'نوع MIME لـ .pbf غير مسجل');
});

console.log(`\n${passed} اختبارات نجحت`);
