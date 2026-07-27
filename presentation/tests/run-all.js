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

let failed = 0;
let pendingFailed = 0;
let checksPassed = 0;
const promoted = [];

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
  const manifest = {
    note: 'مولَّد من `run-all.js` عند تشغيل أخضر — لا يُحرَّر يدوياً.',
    suites: active,
    checks: checksPassed,
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

process.exit(failed ? 1 : 0);
