'use strict';
/**
 * يملأ فجوات النسيج العمراني بمبانٍ مولَّدة — بعد استنفاد الحقيقي.
 * ---------------------------------------------------------------------------
 * OpenStreetMap يعرف ٨٦٬٠٥٦ مبنى داخل نطاق العرض (سألناه `out count;`)، وعندنا
 * ٨٥٬٧٣٨ منها. أي أن الفجوات ليست نقصاً في الجلب بل نقصاً في المصدر: أحياءٌ
 * قائمة لم يرسمها متطوّع بعد. المصادر المفتوحة الأوسع (Microsoft Global
 * Buildings) غير قابلة للوصول من هنا.
 *
 * فالخيار: خريطةٌ فيها ثقوب تُقرأ صحراءَ في وسط المدينة، أو نسيجٌ مولَّد يقول
 * الحقيقة العمرانية — هنا حي — دون أن يدّعي معرفة كل جدار. اخترنا الثاني،
 * ومعه ثلاثة قيود تجعله أميناً:
 *
 * 1) المولَّد لا يقترب من الحقيقي: كل خلية فيها مبنى من OSM محجوزة هي وجاراتها.
 * 2) المولَّد مثبَّت على جغرافيا حقيقية: لا يوجد إلا قرب طريق حقيقي، ويحاذي
 *    اتجاه أقرب شارع، ويمتنع عن الماء والخضرة والرمل ومن على الأسفلت نفسه.
 * 3) المولَّد موسوم `f: 1` — تمييزه سؤالُ مرشِّحٍ واحد في أي وقت لاحق.
 *
 * حتمي بالبذرة: التشغيل الثاني ينتج الملف نفسه بايتاً ببايت.
 * ولا يتراكم: يقرأ الملف الحالي ويطرح منه المولَّد قبل أن يولّد من جديد.
 *
 * بيانات الطرق والمباني الحقيقية © مساهمو OpenStreetMap — رخصة ODbL.
 * المباني الموسومة `f: 1` مولَّدة ولا تمثّل عقاراً قائماً.
 */
const fs = require('fs');
const path = require('path');
const F = require('./lib/fabric.js');

const DATA = path.join(__dirname, '..', 'data');
const BBOX = { south: 24.545, west: 46.530, north: 24.880, east: 46.855 };
const SEED = 20260725;

/** دقة القناعين: الطريق يحتاج عشرة أمتار، القسيمة تكفيها ثمان وأربعون. */
const ROAD_CELL_M = 10;
const PLOT_CELL_M = 48;
const EXCLUSION_CELL_M = 12;

/**
 * نصف عرض الأسفلت لكل تصنيف، زائد حرمٍ للرصيف والموقف.
 * الحرم ليس تجميلاً: بدونه يقف المولَّد على حافة الطريق فيبدو النسيج ملتصقاً
 * بالخط، وهو أول ما يفضح التوليد.
 */
const HALF_WIDTH_M = {
  motorway: 26, motorway_link: 16,
  trunk: 24, trunk_link: 15,
  primary: 19, primary_link: 13,
  secondary: 15, secondary_link: 11,
  tertiary: 11, tertiary_link: 9,
};
const VERGE_M = 8;
const DEFAULT_HALF_WIDTH_M = 10;

/**
 * ما بعد ٤٥٠ متراً من أقرب طريق ليس حياً.
 * شبكة الطرق عندنا شرايين وثانوية فقط، وهي في الرياض تحيط بكل حي؛ فالقرب منها
 * هو أصدق تعريف متاح لحدود العمران، وأصدق من مضلعات الاستعمال الناقصة.
 */
const URBAN_RADIUS_M = 450;

/** الأرض الممنوعة: ماء وخضرة ورمل — مضلعات حقيقية من OSM. */
const EXCLUDED_KINDS = ['water', 'green', 'sand'];

/**
 * الحي وحدة التوليد، لا القسيمة.
 * ---------------------------------------------------------------------------
 * حقلٌ متصل من المستطيلات يُقرأ عند مقياس ٥٠٠ متر شاشةَ نقاطٍ منتظمة لا مدينة.
 * ما يجعل النسيج نسيجاً أن فيه بلوكات تفصلها شوارع، وأن كل حي بمقاس قسيمة
 * وطورٍ واتجاه يخصّه — وهو حال الرياض فعلاً: أحياء متجاورة شبكاتها غير متطابقة.
 *
 * ٤٨٠ متراً حجم حي معقول: يسع خمسة بلوكات في كل اتجاه، وأصغر من أن ينحرف
 * اتجاه الشارع داخله.
 */
const DISTRICT_M = 480;
const GAP_U = 5;
const GAP_V = 8;
const PLOT_DROPOUT = 0.1;

const MASK = { FREE: 0, TAKEN: 1 };

function loadGlobal(file, name) {
  const previous = global.window;
  global.window = {};
  require(path.join(DATA, file));
  const value = global.window[name];
  global.window = previous;
  return value;
}

/** المباني الحقيقية وحدها — المولَّد السابق يُطرح فلا يتراكم عبر التشغيلات. */
function realBuildings() {
  const all = loadGlobal('riyadh-buildings.geojson.js', 'RIYADH_BUILDINGS');
  return all.features.filter(function (f) { return !f.properties.f; });
}

function allRoads() {
  const arterial = loadGlobal('riyadh-roads.geojson.js', 'RIYADH_ROADS');
  const local = loadGlobal('riyadh-roads-local.geojson.js', 'RIYADH_ROADS_LOCAL');
  return arterial.features.concat(local.features);
}

/** يمشي على الخط بخطوة ثابتة ويستدعي الدالة عند كل موضع مع اتجاه المقطع. */
function walkLine(points, stepM, visit) {
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1e-6) continue;
    const bearing = Math.atan2(dy, dx);
    const steps = Math.max(1, Math.ceil(length / stepM));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      visit(a[0] + dx * t, a[1] + dy * t, bearing);
    }
  }
}

function main() {
  const project = F.projection({ lon: BBOX.west, lat: BBOX.south });
  const widthM = (BBOX.east - BBOX.west) * project.mPerLon;
  const heightM = (BBOX.north - BBOX.south) * F.M_PER_LAT;

  const roadMask = F.makeGrid(widthM, heightM, ROAD_CELL_M);
  const urban = F.makeGrid(widthM, heightM, PLOT_CELL_M);
  const occupied = F.makeGrid(widthM, heightM, PLOT_CELL_M);
  // الممنوع بدقّته لا بدقّة القسيمة: حافة الحديقة تُقاس بأمتار، وثمانٍ وأربعون
  // متراً تسمح لمبنى أن يدخل خمسة أمتار داخل الحديقة قبل أن يلحظه القناع.
  const forbidden = F.makeGrid(widthM, heightM, EXCLUSION_CELL_M);
  const bearing = F.makeGrid(widthM, heightM, PLOT_CELL_M);
  const bearingDistance = F.makeGrid(widthM, heightM, PLOT_CELL_M, Uint16Array);
  bearingDistance.data.fill(65535);

  /* ---- ١) الطرق: قناع الأسفلت، ومظروف العمران، واتجاه أقرب شارع ---- */

  const roads = allRoads();
  for (const road of roads) {
    const half = HALF_WIDTH_M[road.properties.highway] || DEFAULT_HALF_WIDTH_M;
    const radius = half + VERGE_M;
    const points = road.geometry.coordinates.map(function (p) {
      return project.toMetres(p[0], p[1]);
    });

    walkLine(points, ROAD_CELL_M * 0.6, function (x, y) {
      F.stampDisc(roadMask, x, y, radius, MASK.TAKEN);
    });

    // مظروف العمران واتجاه الشارع يُختمان بخطوة أخشن — القسيمة ٤٨ متراً.
    walkLine(points, PLOT_CELL_M * 0.5, function (x, y, angle) {
      F.stampDisc(urban, x, y, URBAN_RADIUS_M, MASK.TAKEN);

      const degrees = ((Math.round((angle * 180) / Math.PI) % 180) + 180) % 180;
      const span = Math.ceil(URBAN_RADIUS_M / 2 / PLOT_CELL_M);
      const cx = Math.floor(x / PLOT_CELL_M);
      const cy = Math.floor(y / PLOT_CELL_M);
      for (let dy = -span; dy <= span; dy += 1) {
        const gy = cy + dy;
        if (gy < 0 || gy >= bearing.rows) continue;
        for (let dx = -span; dx <= span; dx += 1) {
          const gx = cx + dx;
          if (gx < 0 || gx >= bearing.cols) continue;
          const d = dx * dx + dy * dy;
          const at = gy * bearing.cols + gx;
          if (d >= bearingDistance.data[at]) continue;
          bearingDistance.data[at] = d;
          bearing.data[at] = degrees;
        }
      }
    });
  }

  /* ---- ٢) الممنوع: ماء وخضرة ورمل ---- */

  const base = loadGlobal('riyadh-base.geojson.js', 'RIYADH_BASE');
  let excludedRings = 0;
  for (const feature of base.features) {
    if (EXCLUDED_KINDS.indexOf(feature.properties.kind) === -1) continue;
    if (feature.geometry.type !== 'Polygon') continue;
    for (const ring of feature.geometry.coordinates) {
      F.fillRing(forbidden, ring.map(function (p) { return project.toMetres(p[0], p[1]); }), MASK.TAKEN);
      excludedRings += 1;
    }
  }

  /* ---- ٣) الحقيقي: كل خلية يمسّها مبنى من OSM محجوزة هي وجاراتها ---- */

  const real = realBuildings();
  const touched = [];
  for (const feature of real) {
    for (const point of feature.geometry.coordinates[0]) {
      const metres = project.toMetres(point[0], point[1]);
      const at = occupied.index(metres[0], metres[1]);
      if (at >= 0 && occupied.data[at] !== MASK.TAKEN) {
        occupied.data[at] = MASK.TAKEN;
        touched.push(at);
      }
    }
  }
  // توسيع خلية واحدة: الحي المرسوم يبقى مرسوماً، ولا يلتصق مولَّدٌ بجدار حقيقي.
  for (const at of touched) {
    const cy = Math.floor(at / occupied.cols);
    const cx = at - cy * occupied.cols;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const gy = cy + dy;
        const gx = cx + dx;
        if (gy < 0 || gx < 0 || gy >= occupied.rows || gx >= occupied.cols) continue;
        occupied.data[gy * occupied.cols + gx] = MASK.TAKEN;
      }
    }
  }

  /* ---- ٤) التوليد: حيٌّ حيٌّ، لا خليةً خلية ---- */

  const features = [];
  let onRoad = 0;
  let districts = 0;

  const cols = Math.ceil(widthM / DISTRICT_M);
  const rows = Math.ceil(heightM / DISTRICT_M);
  const reach = Math.ceil((DISTRICT_M * Math.SQRT2) / 2);

  for (let dy = 0; dy < rows; dy += 1) {
    for (let dx = 0; dx < cols; dx += 1) {
      const west = dx * DISTRICT_M;
      const south = dy * DISTRICT_M;
      const cx = west + DISTRICT_M / 2;
      const cy = south + DISTRICT_M / 2;
      if (urban.get(cx, cy) !== MASK.TAKEN) continue;
      districts += 1;

      /**
       * بذرة الحي من موقعه لا من ترتيبه في الحلقة.
       * فلو تغيّر النطاق أو رتّبنا الحلقة بغير هذا الترتيب بقي كل حي على شكله،
       * ولم ينقلب المستودع كله سطراً واحداً في كل تعديل.
       */
      const random = F.mulberry32(SEED + dx * 73856093 + dy * 19349663);
      const angle = (bearing.get(cx, cy) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // قياس القسيمة يتغيّر بين حي وحي — لا مقاس واحد يعمّ المدينة.
      const pitchU = 18 + random() * 13;
      const pitchV = 24 + random() * 15;
      const blockCols = 5 + Math.floor(random() * 4);
      const blockRows = 3 + Math.floor(random() * 3);
      const phaseU = random() * pitchU;
      const phaseV = random() * pitchV;

      const spanU = Math.ceil(reach / pitchU);
      const spanV = Math.ceil(reach / pitchV);
      const taken = {};
      const isStreetCol = function (i) {
        return ((i % (blockCols + 1)) + blockCols + 1) % (blockCols + 1) === blockCols;
      };
      const isStreetRow = function (i) {
        return ((i % (blockRows + 1)) + blockRows + 1) % (blockRows + 1) === blockRows;
      };

      for (let iv = -spanV; iv <= spanV; iv += 1) {
        // صفٌّ من كل بضعة صفوف يُترك شارعاً — بلا شوارع لا تُقرأ بلوكات.
        if (isStreetRow(iv)) continue;

        for (let iu = -spanU; iu <= spanU; iu += 1) {
          if (isStreetCol(iu)) continue;
          if (taken[iu + ':' + iv]) continue;

          const u = phaseU + iu * pitchU;
          const v = phaseV + iv * pitchV;
          const x = cx + u * cos - v * sin;
          const y = cy + u * sin + v * cos;
          // الحدود تُحسم بمربّع الحي: كل موضع لحيٍّ واحد، فلا تراكب بين شبكتين.
          if (x < west || x >= west + DISTRICT_M || y < south || y >= south + DISTRICT_M) continue;

          if (urban.get(x, y) !== MASK.TAKEN) continue;
          if (occupied.get(x, y) === MASK.TAKEN) continue;
          if (forbidden.get(x, y) === MASK.TAKEN) continue;
          if (roadMask.get(x, y) === MASK.TAKEN) { onRoad += 1; continue; }
          if (random() < PLOT_DROPOUT) continue;

          /**
           * القسيمة تبتلع جاراتها أحياناً — والحي بلا هذا الابتلاع صفٌّ واحد.
           * ---------------------------------------------------------------
           * لو كانت كل القسائم بمقاس واحد لوقعت كلها في شريحة مساحة واحدة،
           * فيسطح تدرّج اللون الذي يقرأ به الناظر كثافة المكان. الفيلا تبقى
           * فيلا، والعمارة تأخذ قسيمتين، والمدرسة أو المسجد ستاً.
           */
          const roll = random();
          const spread = roll < 0.02 ? [3, 2] : roll < 0.09 ? [2, 2] : roll < 0.28 ? [2, 1] : [1, 1];
          let fits = true;
          for (let du = 0; du < spread[0] && fits; du += 1) {
            for (let dv = 0; dv < spread[1]; dv += 1) {
              if (du === 0 && dv === 0) continue;
              if (isStreetCol(iu + du) || isStreetRow(iv + dv) || taken[(iu + du) + ':' + (iv + dv)]) {
                fits = false;
                break;
              }
            }
          }
          const cells = fits ? spread : [1, 1];
          for (let du = 0; du < cells[0]; du += 1) {
            for (let dv = 0; dv < cells[1]; dv += 1) taken[(iu + du) + ':' + (iv + dv)] = true;
          }

          const wide = cells[0] * pitchU - GAP_U;
          const deep = cells[1] * pitchV - GAP_V;
          const shiftU = ((cells[0] - 1) * pitchU) / 2;
          const shiftV = ((cells[1] - 1) * pitchV) / 2;

          const jx = x + (random() - 0.5) * 4 + shiftU * cos - shiftV * sin;
          const jy = y + (random() - 0.5) * 4 + shiftU * sin + shiftV * cos;
          const ring = F.rectangle(jx, jy, wide, deep, angle);

          // الأركان لا المركز: مبنى مركزه خارج الأسفلت قد يمدّ ركنه في الطريق
          // أو في الحديقة، وهو أول ما تراه العين على الحافة.
          let clear = true;
          for (let i = 0; i < 4; i += 1) {
            if (roadMask.get(ring[i][0], ring[i][1]) === MASK.TAKEN
              || forbidden.get(ring[i][0], ring[i][1]) === MASK.TAKEN) { clear = false; break; }
          }
          if (!clear) continue;

          features.push({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [ring.map(function (p) {
                const lonLat = project.toLonLat(p[0], p[1]);
                return [Number(lonLat[0].toFixed(6)), Number(lonLat[1].toFixed(6))];
              })],
            },
            properties: { a: F.areaBucket(F.ringAreaMetres(ring)), f: 1 },
          });
        }
      }
    }
  }

  /* ---- ٥) الكتابة ---- */

  const all = real.concat(features);
  const json = JSON.stringify({ type: 'FeatureCollection', features: all });
  // JSON.parse أسرع من قراءة كائن حرفي بعشرات الميغابايت: المحرّك يقرأ نصاً
  // بمُحلّل مخصّص بدل أن يترجم مصدراً. الفرق ثوانٍ على هذا الحجم.
  const file = path.join(DATA, 'riyadh-buildings.geojson.js');
  fs.writeFileSync(file, 'window.RIYADH_BUILDINGS = JSON.parse(' + JSON.stringify(json) + ');\n');

  const mb = (fs.statSync(file).size / 1048576).toFixed(1);
  console.log(
    'fabric: ' + real.length + ' حقيقي + ' + features.length + ' مولَّد = ' + all.length + ' مبنى\n'
    + '        ' + districts + ' حياً، ' + excludedRings + ' حلقة ممنوعة، '
    + onRoad + ' قسيمة على الأسفلت → ' + mb + ' ميغابايت'
  );
}

main();
