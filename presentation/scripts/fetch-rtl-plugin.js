'use strict';
/**
 * يجلب إضافة تشكيل العربية مرة واحدة إلى vendor/ — الناتج يُلتزم في المستودع.
 * ---------------------------------------------------------------------------
 * الإصدار مثبَّت على 0.2.3 عن قصد. الإصدار 0.4.0 مبني على WebAssembly ويفشل
 * تحميله داخل عامل MapLibre («RTL Text Plugin failed to import scripts»)،
 * فتظهر العربية حروفاً منفصلة معكوسة. لا ترفعه بلا اختبار في المتصفح.
 */
const fs = require('fs');
const path = require('path');

const VERSION = '0.2.3';
const URL = `https://unpkg.com/@mapbox/mapbox-gl-rtl-text@${VERSION}/mapbox-gl-rtl-text.js`;

async function main() {
  const response = await fetch(URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());

  const body = buffer.toString('utf8');
  if (body.indexOf('registerRTLTextPlugin') === -1) {
    throw new Error('الملف لا يسجّل نفسه كإضافة RTL — مصدر خاطئ');
  }
  if (/WebAssembly|\.wasm\b/.test(body)) {
    throw new Error('بناء WebAssembly غير متوافق مع عامل MapLibre');
  }

  const target = path.join(__dirname, '..', 'vendor', 'mapbox-gl-rtl-text.js');
  fs.writeFileSync(target, buffer);
  console.log(`rtl plugin ${VERSION}: ${buffer.length} bytes → vendor/mapbox-gl-rtl-text.js`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
