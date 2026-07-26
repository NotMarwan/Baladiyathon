'use strict';
/**
 * تثبيت تغذية WZDx مرجعية من جهة رسمية أجنبية.
 * ---------------------------------------------------------------------------
 * **لماذا يوجد هذا السكربت.**
 *
 * كان أثر يُنتج WZDx ويفحص إنتاجه بمخططه المثبَّت. وهذا يُثبت أن المُخرَج
 * مطابق للمواصفة، ولا يُثبت أن **المحقق نفسه** ليس مفصَّلاً على مخرجاتنا:
 * محققٌ لم يقرأ إلا ما كتبناه قد يكون متساهلاً في موضع لم نمرّ به قط، ولا
 * أحد يعرف.
 *
 * الفحص الحاسم أن يُمرَّر عليه **إنتاج جهة أخرى حقيقية** — تغذية تشغيلية
 * تنشرها إدارة نقل حكومية لمناطق عملها الفعلية، لم يكتبها أحد منّا ولم تُكتب
 * لأجل فحصنا. إن قبلها المحقق فالعقد الذي نصدّر عليه هو العقد الذي تنشر عليه
 * جهة حقيقية.
 *
 * **ولماذا تُثبَّت على القرص بدل أن تُسحب عند العرض.**
 *
 * ثلاثة أسباب، كلها تعلّمناها بالطريقة الصعبة في هذا المستودع:
 *   · المنتج يعمل بلا شبكة. عرضٌ يعتمد طلباً حياً يسقط في القاعة.
 *   · التغذية الحية تتغيّر كل ساعة. نتيجةٌ لا تُعاد إنتاجها ليست دليلاً.
 *   · البصمة تجعل الادّعاء قابلاً للمراجعة: من شكّ يحسب SHA-256 ويقارن.
 *
 * **وما لا يُثبته أي شيء هنا.** لا رقم مروري. التبادلية بنية لا قياس،
 * وتغذية ولايةٍ أخرى لا تقول شيئاً عن الرياض.
 *
 * التشغيل: node presentation/scripts/fetch-reference-wzdx.js
 *          node presentation/scripts/fetch-reference-wzdx.js --check
 *            (يتحقق من البصمات المثبَّتة بلا شبكة)
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'reference-feeds');
const MANIFEST = path.join(OUT_DIR, 'MANIFEST.json');

/**
 * التغذيات المرجعية.
 *
 * الشرط في الاختيار: **بلا مفتاح**. تغذيةٌ خلف مفتاح تجعل إعادة الإنتاج
 * حكراً على من يملكه، ويصير الادّعاء غير قابل للفحص من الخارج — وهو ضد
 * الغرض كله. ومصدر القائمة سجل تغذيات WZDx الرسمي لدى وزارة النقل
 * الأمريكية: https://data.transportation.gov/resource/69qe-yiui
 */
const FEEDS = [
  {
    key: 'wsdot',
    publisher: 'Washington State DOT',
    country: 'الولايات المتحدة',
    url: 'https://wzdx.wsdot.wa.gov/api/v4/WorkZoneFeed',
    declaredVersion: '4.2',
    note: 'تغذية تشغيلية عامة بلا مفتاح — مسجَّلة في سجل وزارة النقل الأمريكية.',
  },
];

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function readManifest() {
  if (!fs.existsSync(MANIFEST)) return { feeds: [] };
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

/**
 * يتحقق من التغذيات المثبَّتة بلا أي طلب شبكة.
 *
 * هذا الوضع هو ما يُشغَّل في خط الاختبارات وفي أي مراجعة لاحقة: البصمة
 * المسجَّلة يجب أن تطابق الملف على القرص، وإلا فالمثبَّت ليس ما يُدَّعى.
 */
function check() {
  const manifest = readManifest();
  if (!manifest.feeds.length) {
    console.log('لا تغذية مثبَّتة. شغّل السكربت بلا `--check` أولاً.');
    process.exitCode = 1;
    return;
  }
  let bad = 0;
  for (const entry of manifest.feeds) {
    const file = path.join(OUT_DIR, entry.file);
    if (!fs.existsSync(file)) {
      console.log(`✗ ${entry.key}: الملف مفقود — ${entry.file}`);
      bad += 1;
      continue;
    }
    const actual = sha256(fs.readFileSync(file, 'utf8'));
    if (actual !== entry.sha256) {
      console.log(`✗ ${entry.key}: البصمة لا تطابق المثبَّت`);
      console.log(`    مسجَّلة: ${entry.sha256}`);
      console.log(`    فعلية : ${actual}`);
      bad += 1;
      continue;
    }
    console.log(`✓ ${entry.key}: ${entry.featureCount} منطقة عمل · بصمة مطابقة`);
  }
  if (bad) process.exitCode = 1;
}

async function fetchOne(feed) {
  const response = await fetch(feed.url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${feed.key}: HTTP ${response.status}`);
  const text = await response.text();
  const parsed = JSON.parse(text);

  /* التحقق البنيوي الأدنى قبل التثبيت: تغذيةٌ فارغة أو بإصدار آخر تُثبَّت
     صامتةً ثم تُقرأ لاحقاً دليلَ تبادلية وهي ليست كذلك. */
  const version = (parsed.feed_info && parsed.feed_info.version) || '(بلا إصدار)';
  const features = Array.isArray(parsed.features) ? parsed.features.length : 0;
  if (!features) throw new Error(`${feed.key}: التغذية بلا مناطق عمل`);

  const file = `${feed.key}.json`;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, file), text, 'utf8');

  return {
    key: feed.key,
    file,
    publisher: feed.publisher,
    country: feed.country,
    source: feed.url,
    note: feed.note,
    declaredVersion: feed.declaredVersion,
    feedVersion: version,
    featureCount: features,
    feedUpdateDate: (parsed.feed_info && parsed.feed_info.update_date) || null,
    bytes: Buffer.byteLength(text, 'utf8'),
    sha256: sha256(text),
  };
}

async function main() {
  if (process.argv.includes('--check')) return check();

  const previous = readManifest();
  const entries = [];
  for (const feed of FEEDS) {
    process.stdout.write(`${feed.key} … `);
    const entry = await fetchOne(feed);
    const before = previous.feeds.find((one) => one.key === feed.key);
    const changed = before && before.sha256 !== entry.sha256;
    console.log(`${entry.featureCount} منطقة عمل · v${entry.feedVersion}`
      + (before ? (changed ? ' · تغيّرت عن المثبَّت' : ' · كما هي') : ' · جديدة'));
    entries.push(entry);
  }

  /* `fetchedAt` يُكتب من ساعة التشغيل، وهو الحقل الوحيد هنا الذي يتغيّر بلا
     تغيّر البيانات. يُترك كما هو عمداً: تاريخ السحب جزء من الادّعاء، ومن
     يقرأ «تغذية رسمية» بعد ستة أشهر يحتاج أن يعرف كم عمرها. */
  const manifest = {
    note: 'تغذيات WZDx مرجعية من جهات رسمية أجنبية، مثبَّتة ببصماتها. '
      + 'مولَّد من `presentation/scripts/fetch-reference-wzdx.js` — لا يُحرَّر يدوياً.',
    registry: 'https://data.transportation.gov/resource/69qe-yiui',
    fetchedAt: new Date().toISOString(),
    proves: 'أن المخطط الذي نصدّر عليه يقبل إنتاج جهة رسمية حقيقية.',
    doesNotProve: 'أي رقم مروري، ولا أي شيء عن الرياض.',
    feeds: entries,
  };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`\n${MANIFEST}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
