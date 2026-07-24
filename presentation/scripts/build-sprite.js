'use strict';
/**
 * يبني atlas الأيقونات (PNG + JSON) بصيغة MapLibre من icons/*.svg.
 * يُشغَّل مرة عند تغيير الأيقونات؛ الناتج يُلتزم داخل vendor/sprite.
 */
const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.error('sharp غير مثبت. شغّل: npm install --no-save sharp');
  process.exit(1);
}

const ICON_DIR = path.join(__dirname, '..', 'icons');
const OUT_DIR = path.join(__dirname, '..', 'vendor', 'sprite');
const ICON_SIZE = 26;
const PADDING = 2;

async function sheet(ratio, suffix) {
  const files = fs.readdirSync(ICON_DIR).filter((f) => f.endsWith('.svg')).sort();
  const size = ICON_SIZE * ratio;
  const stride = size + PADDING * ratio;

  const icons = [];
  for (const file of files) {
    const svg = fs.readFileSync(path.join(ICON_DIR, file));
    const buffer = await sharp(svg, { density: 72 * ratio * 4 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    icons.push({ name: path.basename(file, '.svg'), buffer });
  }

  const png = await sharp({
    create: {
      width: stride * icons.length,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(icons.map((icon, i) => ({ input: icon.buffer, left: i * stride, top: 0 })))
    .png()
    .toBuffer();

  const index = {};
  icons.forEach((icon, i) => {
    index[icon.name] = {
      x: i * stride, y: 0, width: size, height: size, pixelRatio: ratio, sdf: false,
    };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `sprite${suffix}.png`), png);
  fs.writeFileSync(path.join(OUT_DIR, `sprite${suffix}.json`), JSON.stringify(index, null, 2));
  console.log(`sprite${suffix}: ${icons.length} أيقونات`);
}

(async () => { await sheet(1, ''); await sheet(2, '@2x'); })();
