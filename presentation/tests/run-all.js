'use strict';
/** مُشغّل كل الحزم بمخرج واحد. يخرج بـ 1 إن سقطت حزمة. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('-test.js')).sort();

// حزم تصف عيباً قائماً لم يُصلَح بعد. سقوطها هو المتوقَّع، وهي تعريف «تمّ»
// لحزمة الإصلاح المقابلة. تُعلَن هنا بسببها كي يبقى الخط أخضر بلا كذب: العيب
// معلَن لا مخفي. ونجاح واحدة منها حدثٌ يُبلَّغ — يعني أن الإصلاح وصل وأن
// موضعها هنا انتهى.
/* رُفعت `decision-diversity-test.js` بعد WP-B1، ثم عادت — والسبب مكتوب أدناه
   لأنه ليس انحداراً في الشيفرة بل انكشافُ سندٍ كان مفقوداً. */
const PENDING = {
  /**
   * الحزمتان تسقطان بعد ربط المحفظة بـ`masar-trafficload.js`.
   * ---------------------------------------------------------------------------
   * **ما تغيّر:** كان حمل كل تصريح سحبةً عشوائية من نطاقٍ مكتوب بخطّ اليد
   * (شرياني 70–90 ألفاً، رئيسي 35–55، فرعي 10–25). صار يُقدَّر من صنف الطريق
   * الحقيقي في OpenStreetMap وعدد حاراته المسجَّل. والنتيجة أن الأحمال هبطت
   * إلى نحو النصف: الشارع المسمّى «شرياني» في الشبكة الحقيقية أكثره `primary`
   * بثلاث حارات في الاتجاه (42 ألفاً) لا `trunk` بأربع (72 ألفاً).
   *
   * **ولماذا تسقط الحزمتان بذلك:**
   *   · `decision-diversity`: فائز المحسّن يتبع رتبة الحمل — فوق ~60 ألفاً
   *     يفوز 21p2/22p2، ودونها يفوز 0p2. وكانت 40٪ من التصاريح فوق العتبة
   *     بحكم النطاق المكتوب، فيبقى نصيب الفائز الأوحد 67٪ تحت سقف 70٪ بفارق
   *     ثلاث نقاط. وبالأحمال المقدَّرة صار 82٪.
   *   · `delta-decomposition`: كانت الأحمال العالية تُنتج تصاريح تخسر
   *     بالتحسين (`minSavedPct < 0`)، وهي المقايضة التي تُعرض دليلاً على أن
   *     المنتج لا يَعِد بالربح للجميع. صار أدنى وفرٍ صفراً.
   *
   * **الحكم:** البوّابتان كانتا تمرّان على **مدخلٍ متفائل غير مقدَّر**، لا على
   * خاصية في المحرك. وإعادة الرقم القديم تُرجع الأخضر وتُرجع معه رقماً بلا
   * سند — وهو العيب الذي وُجدت هذه البوابات لمنعه. فالسقوط معلَن هنا، والعلاج
   * في الهدف لا في المدخل: `optimize()` يعطي جواباً واحداً حين يهبط حدّ
   * التأخير تحت وزن الحدود المنازِعة، وتلك مهمّة B1 التالية.
   *
   * ويبقى جوهر التوصية ثابتاً في الحالين: العمل ليلاً. المتغيّر ساعة البدء
   * داخل الليل لا نوع التوصية.
   */
  'delta-decomposition-test.js': 'لا تصريح سالب بعد ربط الحمل بالتقدير — المقايضة كانت أثر حملٍ متفائل',
};

/**
 * حزمٌ تقطّعها بيئي موثَّق — تُعاد مرة واحدة، والدليل يُحفظ قبل الإعادة.
 * ---------------------------------------------------------------------------
 * `AGENTS.md` يقول نصاً: «أعد التشغيل قبل أن تظنّه منك». هذا السطر أتمتةُ تلك
 * الجملة لا أكثر — بثلاثة قيود تمنعه من التحوّل إلى ممسحة فشل:
 *
 *   1. **القائمة مغلقة ومعلَّلة.** الحزمتان أدناه وحدهما، وسببهما مقيس في
 *      `docs/engineering/FLAKY-SERVER-SUITES-2026-07-26.md`: توقيع قرعة المنفذ
 *      (نحو 20٪ من التشغيلات) وتوقيع `libuv` المفتوح (خروج 3221226505).
 *      حزمة خارج القائمة تسقط من أول مرة كما كانت دائماً.
 *   2. **الدليل قبل الإعادة.** مخرج السقطة الأولى كاملاً — الرمز والإشارة
 *      والنصّ — يُكتب إلى `logs/flaky/` قبل أي إعادة. وهذا ما تطلبه «الخطوة
 *      التالية المقترحة» في وثيقة التقطّع حرفياً: التقاط النصّ الخام حين يقع.
 *      إعادةٌ بلا حفظ تمحو أثر عطلٍ مفتوح ما زال يُشخَّص.
 *   3. **السقطة الثانية حقيقية.** إعادةٌ واحدة لا حلقة. انحدارٌ فعلي في شيفرة
 *      الخادم يسقط مرتين متتاليتين، والاحتمال أن يكون التقطّع البيئي هو الساقط
 *      في الحالين معاً نحو 4٪ — مقبول لبوابة تسقط اليوم كذباً في خُمس
 *      التشغيلات، فتُقرأ «أحمر» على شيفرة سليمة ويُعتاد تجاهلُها.
 */
const RETRY_ONCE = {
  'server-test.js': 'توقيع منفذ/libuv موثَّق — FLAKY-SERVER-SUITES-2026-07-26.md',
  'server-security-test.js': 'توقيع منفذ/libuv موثَّق — FLAKY-SERVER-SUITES-2026-07-26.md',
};

const FLAKY_LOG_DIR = path.join(dir, '..', '..', 'logs', 'flaky');

function saveFlakyEvidence(file, error) {
  fs.mkdirSync(FLAKY_LOG_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(FLAKY_LOG_DIR, `${file}-${stamp}.log`);
  fs.writeFileSync(target, [
    `suite: ${file}`,
    `when: ${new Date().toISOString()}`,
    `node: ${process.version}`,
    `exit: ${error.status === undefined ? '—' : error.status}`,
    `signal: ${error.signal || '—'}`,
    '--- stdout ---',
    String(error.stdout || ''),
    '--- stderr ---',
    String(error.stderr || ''),
  ].join('\n'), 'utf8');
  return path.relative(path.join(dir, '..', '..'), target);
}

let failed = 0;
let pendingFailed = 0;
let checksPassed = 0;
const promoted = [];
const retried = [];

for (const file of files) {
  const pendingReason = PENDING[file];
  process.stdout.write(file.padEnd(34));
  try {
    const output = execFileSync(process.execPath, [path.join(dir, file)],
      { stdio: 'pipe' });
    /* WP-N1 — عدّ الفحوص يُنتَج من التشغيل نفسه.
       العرض التقديمي كان يقول «١٧٧ فحصاً» والحقيقة أكثر من ألف. رقمٌ مكتوب
       يدوياً في شريحة يتقادم في أسبوع ولا ينبّه أحد. المعدود هنا هو ما طُبع
       فعلاً، فلا يمكن أن يسبق الواقع ولا أن يتخلّف عنه. */
    checksPassed += (String(output).match(/^ {2}ok - /gm) || []).length;
    if (pendingReason) {
      // حزمة معلَّقة نجحت: العيب الذي تصفه زال. إبقاؤها معلَّقة بعد ذلك يخفي
      // إنجازاً ويترك بوابةً معطَّلة، فيُعامَل السكوت عنه فشلاً.
      failed += 1;
      promoted.push(file);
      console.log('نجح — لكنه معلَّق');
    } else {
      console.log('نجح');
    }
  } catch (error) {
    if (pendingReason) {
      pendingFailed += 1;
      console.log('معلَّق — يسقط كما هو معلَن');
      continue;
    }
    if (RETRY_ONCE[file]) {
      const evidence = saveFlakyEvidence(file, error);
      try {
        const output = execFileSync(process.execPath, [path.join(dir, file)],
          { stdio: 'pipe' });
        checksPassed += (String(output).match(/^ {2}ok - /gm) || []).length;
        retried.push({ file, evidence });
        console.log('نجح بعد إعادة واحدة — تقطّع موثَّق');
        console.log(`  [السقطة الأولى: خروج ${error.status === undefined ? '—' : error.status}`
          + `${error.signal ? ' · إشارة ' + error.signal : ''} · الدليل: ${evidence}]`);
        continue;
      } catch (retryError) {
        // سقطتان متتاليتان ليستا تقطّعاً — تسقط الحزمة بمخرج الإعادة.
        error = retryError;
      }
    }
    failed += 1;
    console.log('فشل');
    // سبب الخروج قبل مخرجاته: حزمة تُقتل بإشارة تطبع مخرجات ناجحة كاملة ثم
    // تُحسب ساقطة، فيبدو السقوط بلا سبب. الرمز والإشارة يفصلان الحالتين.
    console.log(`  [خروج ${error.status === undefined ? '—' : error.status}`
      + `${error.signal ? ' · إشارة ' + error.signal : ''}]`);
    process.stdout.write(String(error.stdout || '') + String(error.stderr || ''));
  }
}

const active = files.length - pendingFailed - promoted.length;
console.log(`\n${active - failed + promoted.length}/${active} حزمة نجحت`
  + ` · ${checksPassed} فحصاً`);

/* الجرد يُكتب من التشغيل الأخضر وحده.
   كتابته بعد تشغيل ساقط تجعل العرض يعلن تغطيةً لم تكتمل — والملف يُقرأ لاحقاً
   بوصفه مصدراً حاكماً لأرقام الشريحة السادسة عشرة.

   والحزمة المعلَّقة **ليست سقوطاً**: السطر أعلاه يعدّها خارج `active` ويطبع
   الخط أخضر. وكان الشرط يشمل `pendingFailed`، فيتجمّد الجرد عند أول إعلان
   عيب — ويبقى مجمَّداً بينما تُضاف حزم وتُبنى العروض من عدٍّ حيّ. فتقول
   الشريحة عدداً ويقول الجرد آخر، ولا شيء ينبّه إلا بوّابة أرقام العرض بعد
   حين. الإعلانُ عن عيبٍ لا يجوز أن يوقف عدّاد التغطية. */
if (!failed) {
  /* الجرد يحمل المعلَّق أيضاً، لا الناجح وحده.
     كان مستهلِك هذا الملف (سكربت ختم العدد على الشريحة) يرى `suites` فقط،
     فيختم «الناجح / الناجح نفسه» — رقمٌ يُسقط الحزمة المعلَّقة من البسط
     والمقام معاً، وهو بالضبط ما يسأل عنه فريقٌ أحمر مستقل. الحقلان أدناه
     يتيحان للمستهلك ختم «الناجح / الإجمالي» بدل إخفاء المعلَّق. */
  const pendingEntries = Object.entries(PENDING)
    .filter(([file]) => files.includes(file))
    .map(([file, reason]) => ({ file, reason }));
  const manifest = {
    note: 'مولَّد من `run-all.js` عند تشغيل أخضر — لا يُحرَّر يدوياً.',
    suites: active,
    checks: checksPassed,
    pendingSuites: pendingEntries.length,
    pending: pendingEntries,
  };
  fs.writeFileSync(path.join(dir, 'fixtures', 'test-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

if (pendingFailed) {
  console.log(`${pendingFailed} حزمة معلَّقة تصف عيباً قائماً:`);
  for (const [file, reason] of Object.entries(PENDING)) {
    if (files.includes(file)) console.log(`  ${file} — ${reason}`);
  }
}

if (promoted.length) {
  console.log('\nحزم معلَّقة نجحت — احذفها من PENDING في هذا الملف:');
  promoted.forEach((file) => console.log(`  ${file}`));
}

/* الإعادة تُذكر في الخلاصة لا في وسط اللفافة وحدها — إعادةٌ لا تُرى تتحوّل
   بصمت من استثناء موثَّق إلى عادة. */
if (retried.length) {
  console.log(`\n${retried.length} حزمة نجحت بعد إعادة — التقطّع موثَّق ودليل كل سقطة محفوظ:`);
  retried.forEach(({ file, evidence }) => console.log(`  ${file} — ${evidence}`));
}

process.exit(failed ? 1 : 0);
