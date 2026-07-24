'use strict';
/**
 * يجلب نطاقات خط Noto Sans المطلوبة للعربية والأرقام مرة واحدة.
 * الهدف: صفر طلبات شبكة وقت التشغيل — النطاقات تُلتزم داخل vendor/glyphs.
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://protomaps.github.io/basemaps-assets/fonts';
const FONTSTACK = 'Noto Sans Regular';
// لاتيني وأرقام · عربي · أشكال العربية التقديمية (تنتجها إضافة RTL)
const RANGES = ['0-255', '1536-1791', '64256-64511', '64512-64767', '65024-65279'];

async function main() {
  const outDir = path.join(__dirname, '..', 'vendor', 'glyphs', FONTSTACK);
  fs.mkdirSync(outDir, { recursive: true });

  for (const range of RANGES) {
    const url = `${BASE}/${encodeURIComponent(FONTSTACK)}/${range}.pbf`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${range}: HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(path.join(outDir, `${range}.pbf`), buffer);
    console.log(`glyphs: ${range}.pbf (${buffer.length} bytes)`);
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
