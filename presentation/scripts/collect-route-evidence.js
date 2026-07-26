'use strict';
/**
 * جامع أدلة المسارات — لقطة واحدة لكل المسارات المرصودة في نافذة زمنية واحدة.
 * ---------------------------------------------------------------------------
 * **القاعدة التي تشكّل هذا الملف كله.**
 *
 * كل مسارات المجموعة تُقاس في **النافذة نفسها**. لأن المقارنة بين أساسي
 * وبديل هي غرض القياس، وقياسُ الأساسي في السابعة والبديل في العاشرة يفضّل
 * البديل لأنه قيس بعد الذروة. هذا ليس خطأ دقة — هو خطأ يقلب النتيجة.
 * ولذلك اللقطة وحدة واحدة: تنجح كلها أو تُعلَّم ناقصة.
 *
 * **وحين لا توجد مفاتيح.**
 *
 * لا يتظاهر بشيء. يطبع ما ينقص بالضبط لكل مزوّد — اسم المتغيّر البيئي، وما
 * هو، ومن أين يُؤخذ — ويكتب تقرير جاهزية. البنية التحتية الجاهزة ليست دليلاً،
 * ولا ترفع درجة الأثر؛ وهذا مكتوب في التقرير نفسه كي لا يُقرأ التقرير إنجازاً.
 *
 * التشغيل:
 *   node presentation/scripts/collect-route-evidence.js            # فحص جاهزية
 *   node presentation/scripts/collect-route-evidence.js --collect  # جمع فعلي
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const STORE = path.join(DATA, 'route-evidence');
const ROUTES = path.join(DATA, 'monitored-routes.json');

global.window = global;
const Evidence = require(path.join(ROOT, 'athar-route-evidence.js'));
const providers = require('./lib/evidence-providers/index.js');

/** أوسع فارق مقبول داخل اللقطة الواحدة (ثانية). */
const SNAPSHOT_WINDOW_SEC = 300;

/**
 * الإيقاع المقترح — مكتوب رقماً كي يُراجَع، لا مدفوناً في جدولة.
 *
 * خمس دقائق ليست اعتباطاً: أقصر منها يستهلك حصص الطلبات بلا معلومة جديدة
 * (المزوّدون لا يحدّثون أسرع من ذلك عادةً)، وأطول منها يفوّت ذروةً تتشكّل
 * وتنحلّ في ربع ساعة.
 */
const CADENCE = {
  snapshotEveryMinutes: 5,
  windowSeconds: SNAPSHOT_WINDOW_SEC,
  coverage: ['ذروة الصباح 06:00–09:00', 'الظهيرة 11:00–14:00',
    'ذروة المساء 15:00–19:00', 'الليل 21:00–02:00'],
  days: 'أيام العمل وعطلة نهاية الأسبوع — نمط الرياض يختلف بينهما اختلافاً حاداً',
  minimumForBaseline: 'أربعة أسابيع متصلة لبناء نمط بالساعة واليوم يُعتمد عليه',
};

function readiness() {
  const report = providers.readiness(process.env);
  const ready = report.filter((provider) => provider.ready);
  return { report, ready };
}

function printReadiness(report) {
  console.log('جاهزية المزوّدين:\n');
  report.forEach((provider) => {
    const mark = provider.ready ? '✓' : '⊘';
    const volume = provider.providesVolume ? 'يعطي حجماً' : 'لا يعطي حجم حركة';
    console.log(`${mark} ${provider.name} — ${volume}`);
    provider.missing.forEach((credential) => {
      console.log(`    ينقص: ${credential.env} — ${credential.what}`);
      console.log(`           من أين: ${credential.how}`);
    });
  });

  console.log('\nحدٌّ يجب ألا يضيع:');
  console.log('  لا مزوّد من هؤلاء ينتج حجم حركة. أي أن v/c يبقى مشتقّاً من');
  console.log('  افتراض مهما طال الرصد. مصدر الحجم يُطلب من جهة رسمية.');
  console.log('\n  ووجود المحوّلات جاهزةً **ليس دليلاً**: بنية تحتية لم تُشغَّل');
  console.log('  ببيانات حقيقية لا ترفع درجة الأثر ولا تُحسب إنجاز قياس.');
}

function writeReadinessReport(report) {
  if (!fs.existsSync(STORE)) fs.mkdirSync(STORE, { recursive: true });
  const payload = {
    generatedFrom: 'presentation/scripts/collect-route-evidence.js',
    providers: report,
    anyReady: report.some((provider) => provider.ready),
    volumeAvailable: report.some((provider) => provider.providesVolume && provider.ready),
    cadence: CADENCE,
    snapshotWindowSeconds: SNAPSHOT_WINDOW_SEC,
    honesty: 'هذا تقرير **جاهزية** لا تقرير قياس. ما دام anyReady=false فلا '
      + 'قياس محلي واحد في المستودع، ودرجة الدليل القصوى المتاحة هي '
      + '«مشتقّ من النموذج».',
  };
  const file = path.join(STORE, 'readiness.json');
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

/**
 * يجمع لقطة واحدة.
 *
 * لا يُستدعى بلا مفاتيح — والحارس هنا لا في نيّة المستدعي.
 */
async function collect(ready) {
  if (!ready.length) {
    throw new Error('لا مزوّد جاهز — الجمع مستحيل، لا مؤجَّل');
  }
  if (!fs.existsSync(ROUTES)) {
    throw new Error(`لا قائمة مسارات: ${ROUTES} — شغّل build-monitored-routes.js`);
  }
  const catalogue = JSON.parse(fs.readFileSync(ROUTES, 'utf8'));

  /* ختم اللقطة يُؤخذ مرة واحدة قبل أي طلب: لو أُخذ لكل مسار على حدة لصار
     الاختلاف بين الأختام هو نفسه الفرق الذي نحاول منعه. */
  const snapshotAt = new Date().toISOString();
  const rows = [];
  const failures = [];

  for (const group of catalogue.groups) {
    for (const route of group.routes) {
      for (const provider of ready) {
        const request = provider.buildRequest(route, {
          apiKey: process.env[provider.REQUIRED_CREDENTIALS[0].env],
        });
        if (!request.ok) {
          failures.push({ routeId: route.routeId, provider: provider.KEY,
            reason: request.reason });
          continue;
        }
        failures.push({ routeId: route.routeId, provider: provider.KEY,
          reason: 'الإرسال الفعلي غير منفَّذ في هذه النسخة — الطلب مبنيّ ومفحوص، '
            + 'ولم تُختبر الاستجابة الحيّة بعد.' });
      }
    }
  }

  return { snapshotAt, rows, failures, groups: catalogue.groups.length };
}

async function main() {
  const { report, ready } = readiness();
  const wantsCollect = process.argv.includes('--collect');

  printReadiness(report);
  const file = writeReadinessReport(report);
  console.log(`\nتقرير الجاهزية: ${file}`);

  if (!wantsCollect) return;

  if (!ready.length) {
    console.log('\n⊘ لا جمع: لا مزوّد جاهز. أضف المفاتيح أعلاه ثم أعد التشغيل.');
    process.exitCode = 1;
    return;
  }

  const result = await collect(ready.map((provider) => providers.byKey(provider.key)));
  console.log(`\nلقطة ${result.snapshotAt} — ${result.rows.length} قياساً `
    + `· ${result.failures.length} إخفاقاً`);
}

module.exports = { CADENCE, SNAPSHOT_WINDOW_SEC, readiness, collect, Evidence };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
