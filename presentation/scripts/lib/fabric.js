'use strict';
/**
 * أدوات نسيج المدينة — الجزء النقي من التوليد، يُختبر في Node بلا ملفات.
 * ---------------------------------------------------------------------------
 * OpenStreetMap يغطي ٨٦ ألف مبنى في نطاق الرياض المعروض، والمدينة أضعاف ذلك.
 * الفجوات ليست أرضاً فضاء بل أحياءً لم يرسمها أحد بعد، فتُقرأ الخريطة ثقوباً.
 *
 * ما هنا يولّد نسيجاً يملأ تلك الفجوات وحدها: مثبَّتاً على شبكة طرق حقيقية،
 * محاذياً لاتجاه الشارع المجاور، ممتنعاً عن الماء والخضرة وعن كل موضع فيه مبنى
 * حقيقي. المولَّد يُوسم `f: 1` فيبقى تمييزه ممكناً في أي وقت.
 *
 * كله حتمي: بذرة ثابتة تعطي الناتج نفسه في كل تشغيل، فالمستودع لا يمتلئ
 * باختلافات وهمية والاختبار يقارن أرقاماً ثابتة.
 */

/** مولّد عشوائي حتمي — بذرة واحدة تعطي التسلسل نفسه دائماً. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * إسقاط مستوٍ محلي: المدينة أصغر من أن تحتاج مسقطاً حقيقياً.
 * الخطأ عبر ٣٥ كم دون المتر — أدق من دقة الرصف نفسه.
 */
const M_PER_LAT = 110574;

function projection(origin) {
  const mPerLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  return {
    mPerLon: mPerLon,
    toMetres: function (lon, lat) {
      return [(lon - origin.lon) * mPerLon, (lat - origin.lat) * M_PER_LAT];
    },
    toLonLat: function (x, y) {
      return [origin.lon + x / mPerLon, origin.lat + y / M_PER_LAT];
    },
  };
}

/** مستطيل مُدار حول مركزه — حلقة مغلقة بخمس نقاط في فضاء الأمتار. */
function rectangle(cx, cy, width, height, bearing) {
  const c = Math.cos(bearing);
  const s = Math.sin(bearing);
  const hw = width / 2;
  const hh = height / 2;
  const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const ring = corners.map(function (p) {
    return [cx + p[0] * c - p[1] * s, cy + p[0] * s + p[1] * c];
  });
  ring.push(ring[0]);
  return ring;
}

/**
 * شريحة المساحة لا المساحة نفسها.
 * الفيلا والبرج يفصلهما رقم كبير؛ ما يحتاجه اللون أربع درجات لا مئة، والشريحة
 * تُخزَّن رقماً واحداً بدل عشري لكل مبنى.
 */
function areaBucket(area) {
  if (area >= 4000) return 3;
  if (area >= 1200) return 2;
  if (area >= 350) return 1;
  return 0;
}

/**
 * شبكة نقطية بسيطة فوق النطاق — ذاكرة مسطحة لا مصفوفة مصفوفات.
 * كل قناع في التوليد شبكةٌ من هذا النوع: الطرق، الاستثناء، المبنى الحقيقي.
 */
function makeGrid(widthM, heightM, cellM, ArrayType) {
  const cols = Math.ceil(widthM / cellM);
  const rows = Math.ceil(heightM / cellM);
  return {
    cols: cols,
    rows: rows,
    cell: cellM,
    data: new (ArrayType || Uint8Array)(cols * rows),
    index: function (x, y) {
      const cx = Math.floor(x / cellM);
      const cy = Math.floor(y / cellM);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return -1;
      return cy * cols + cx;
    },
    get: function (x, y) {
      const i = this.index(x, y);
      return i < 0 ? 0 : this.data[i];
    },
    centre: function (i) {
      const cy = Math.floor(i / cols);
      const cx = i - cy * cols;
      return [(cx + 0.5) * cellM, (cy + 0.5) * cellM];
    },
  };
}

/** يختم قرصاً بقيمة ثابتة — أثر الطريق على الأرض دائرة لا نقطة. */
function stampDisc(grid, x, y, radiusM, value) {
  const r = Math.ceil(radiusM / grid.cell);
  const cx = Math.floor(x / grid.cell);
  const cy = Math.floor(y / grid.cell);
  const rr = (radiusM / grid.cell) * (radiusM / grid.cell);
  for (let dy = -r; dy <= r; dy += 1) {
    const gy = cy + dy;
    if (gy < 0 || gy >= grid.rows) continue;
    for (let dx = -r; dx <= r; dx += 1) {
      const gx = cx + dx;
      if (gx < 0 || gx >= grid.cols) continue;
      if (dx * dx + dy * dy > rr) continue;
      grid.data[gy * grid.cols + gx] = value;
    }
  }
}

/**
 * يملأ مضلعاً في الشبكة بمسح أفقي.
 * الماء والحدائق والرمل تُستثنى بالمضلع لا بالنقطة: مركز الحديقة ليس وحده
 * الممنوع، بل كل ما تحتها.
 */
function fillRing(grid, ringMetres, value) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of ringMetres) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const first = Math.max(0, Math.floor(minY / grid.cell));
  const last = Math.min(grid.rows - 1, Math.floor(maxY / grid.cell));

  for (let row = first; row <= last; row += 1) {
    const y = (row + 0.5) * grid.cell;
    const crossings = [];
    for (let i = 0; i < ringMetres.length - 1; i += 1) {
      const a = ringMetres[i];
      const b = ringMetres[i + 1];
      if ((a[1] > y) === (b[1] > y)) continue;
      crossings.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    crossings.sort(function (m, n) { return m - n; });
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil(crossings[k] / grid.cell - 0.5));
      const to = Math.min(grid.cols - 1, Math.floor(crossings[k + 1] / grid.cell - 0.5));
      for (let col = from; col <= to; col += 1) grid.data[row * grid.cols + col] = value;
    }
  }
}

/** مساحة حلقة بالمتر المربع — صيغة الحذاء في فضاء مستوٍ بالأمتار. */
function ringAreaMetres(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(sum) / 2;
}

module.exports = {
  mulberry32: mulberry32,
  projection: projection,
  rectangle: rectangle,
  areaBucket: areaBucket,
  makeGrid: makeGrid,
  stampDisc: stampDisc,
  fillRing: fillRing,
  ringAreaMetres: ringAreaMetres,
  M_PER_LAT: M_PER_LAT,
};
