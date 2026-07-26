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
/* لا معلَّقات حالياً.
   رُفعت `decision-diversity-test.js` بعد WP-B1: صارت بوابة انحدار لا تعريف
   «تمّ». الآلية تبقى — إعلان العيب أنظف من تعطيل الحزمة. */
const PENDING = {};

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
   بوصفه مصدراً حاكماً لأرقام الشريحة السادسة عشرة. */
if (!failed && !pendingFailed) {
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
