'use strict';
/**
 * مسار — منع الانعطاف من OpenStreetMap.
 * ---------------------------------------------------------------------------
 * الرسم صار يحترم الاتجاه والانعطاف والإشارة، وبقيت فجوة معلنة في `src-P05`:
 * علاقات `turn_restriction`. أثرها أن المحرك قد يقترح «انعطف يساراً هنا» عند
 * تقاطعٍ ممنوعٍ فيه اليسار — وهو خطأ لا يظهر على الخريطة، ويظهر عند أول سائق
 * يحاول تنفيذه.
 *
 * العلاقة في OSM ثلاثة أعضاء: `from` طريقٌ داخل، و`via` عقدةٌ أو طريق، و`to`
 * طريقٌ خارج. والوسم نوعان:
 *   - `no_*`   ممنوع: هذا الانتقال بالذات محظور.
 *   - `only_*` إلزامي: كل انتقال آخر من `from` عبر `via` محظور.
 * والثاني أقوى وأخطر إسقاطاً: تجاهلُه يفتح كل الاتجاهات عند تقاطعٍ لا يسمح
 * إلا بواحد.
 *
 * `via` طريقٌ لا عقدة (تقاطعات مركّبة) تُترك: تمثيلها يحتاج حالةً بطول المسار
 * لا بضلعين، والتقاطعات المركّبة في الرياض قليلة. العدد المتروك يُطبع ويُعلن.
 *
 *     node scripts/fetch-turn-restrictions.js
 *
 * يُشغَّل مرة؛ الناتج يُلتزم في المستودع. لا طلب شبكة وقت التشغيل.
 * بيانات © مساهمو OpenStreetMap — رخصة ODbL.
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');

/** نفس نطاق الطرق والمباني. */
const WIDE = { south: 24.545, west: 46.530, north: 24.880, east: 46.855 };

/** الترتيب مقيس — انظر `fetch-neighbourhood-roads.js`. */
const MIRRORS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const REQUEST_TIMEOUT_MS = 90000;

/**
 * `out geom` لا `out body`.
 * العضو `via` معرّف عقدة في OSM، ورسمُنا يرقّم عقده بنفسه بعد اللحام — فلا
 * جسر بين الترقيمين إلا الإحداثية. و`out geom` يرفق إحداثية كل عضو.
 */
const QUERY = `[out:json][timeout:180];
(relation["type"="restriction"](${WIDE.south},${WIDE.west},${WIDE.north},${WIDE.east}););
out geom;`;

async function ask() {
  let last = 'لا مرايا';
  for (const endpoint of MIRRORS) {
    process.stdout.write(`محاولة ${endpoint.split('/')[2]} … `);
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'masar-roads-builder',
        },
        body: new URLSearchParams({ data: QUERY }).toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      console.log(`تخطي — ${err.message}`);
      last = err.message;
      continue;
    }
    if (response.ok) { console.log('نجحت'); return response.json(); }
    console.log(`تخطي — HTTP ${response.status}`);
    last = `HTTP ${response.status}`;
  }
  throw new Error(`كل المرايا فشلت — ${last}`);
}

/**
 * قيمة القيد المفيدة.
 * `restriction:conditional` و`restriction:hgv` وأخواتها تخصّ أوقاتاً أو مركبات
 * بعينها — تجاهلها هنا أدقّ من تطبيقها على كل سيارة في كل ساعة.
 */
function kindOf(tags) {
  const raw = tags.restriction || tags['restriction:motor_vehicle'];
  if (!raw) return null;
  if (/^no_/.test(raw)) return 'no';
  if (/^only_/.test(raw)) return 'only';
  return null;
}

async function main() {
  const body = await ask();
  const rows = [];
  let viaWay = 0;
  let incomplete = 0;
  let conditional = 0;

  for (const element of body.elements || []) {
    if (element.type !== 'relation') continue;
    const tags = element.tags || {};
    const kind = kindOf(tags);
    if (!kind) { conditional += 1; continue; }

    let from = null;
    let to = null;
    let via = null;
    let viaIsWay = false;
    for (const member of element.members || []) {
      if (member.role === 'from' && member.type === 'way') from = member.ref;
      else if (member.role === 'to' && member.type === 'way') to = member.ref;
      else if (member.role === 'via') {
        viaIsWay = member.type === 'way';
        if (member.type === 'node' && Number.isFinite(member.lat)) {
          via = [Number(member.lon.toFixed(6)), Number(member.lat.toFixed(6))];
        }
      }
    }

    if (viaIsWay) { viaWay += 1; continue; }
    if (from === null || to === null || via === null) { incomplete += 1; continue; }
    rows.push([`w${from}`, via, `w${to}`, kind === 'no' ? 0 : 1]);
  }

  const payload = {
    metadata: {
      source: 'OpenStreetMap contributors — ODbL 1.0',
      bbox: WIDE,
      note: 'from(osmId)/via(lon,lat)/to(osmId)؛ 0 = ممنوع، 1 = إلزامي (كل ما عداه ممنوع). '
        + 'قيود via-way والمشروطة متروكة ومعدودة.',
      viaWaySkipped: viaWay,
      incompleteSkipped: incomplete,
      conditionalSkipped: conditional,
    },
    // [fromWay, [lon,lat], toWay, kind]
    rules: rows,
  };

  const json = JSON.stringify(payload);
  fs.writeFileSync(
    path.join(DATA, 'riyadh-turn-restrictions.js'),
    `window.RIYADH_TURN_RESTRICTIONS = JSON.parse(${JSON.stringify(json)});\n`
  );

  const only = rows.filter((r) => r[3] === 1).length;
  console.log(`${rows.length} قيداً (${rows.length - only} ممنوع · ${only} إلزامي) · `
    + `${viaWay} عبر طريق متروك · ${incomplete} ناقص · ${conditional} مشروط · `
    + `${(json.length / 1024).toFixed(0)} ك.ب`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
